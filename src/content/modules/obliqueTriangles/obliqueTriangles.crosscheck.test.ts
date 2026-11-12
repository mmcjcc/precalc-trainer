/**
 * Solve it again from the wording: every problem's answers worked out from the numbers the prompt gives, read with a
 * pattern of this test's own and plain arithmetic (Math only, none of the module's helpers), over 300 seeds per
 * template. The figure is checked against the same numbers: its labels are the givens, and the triangle it draws has
 * the true shape (its side lengths in the ratio of the solved triangle's).
 */
import { describe, expect, it } from 'vitest'
import '@/content/modules'
import type { ObliqueAnswer } from '@/content/types'
import { plain } from '../trig/text'
import { problemAt } from './testkit'

const R = Math.PI / 180
const sin = (d: number) => Math.sin(d * R)
const cos = (d: number) => Math.cos(d * R)
const asin = (x: number) => Math.asin(x) / R
const acos = (x: number) => Math.acos(x) / R
const tenth = (v: number) => (Math.round(Math.abs(v) * 10 + 1e-9) / 10) * Math.sign(v)
const T = 120_000

type Letters = { A?: number; B?: number; C?: number; a?: number; b?: number; c?: number }

function read(prompt: string): Letters {
  const words = plain(prompt)
  const out: Letters = {}
  for (const g of words.matchAll(/\b([ABCabc]) = (\d+(?:\.\d+)?)/g)) out[g[1] as keyof Letters] = Number(g[2])
  return out
}

const UP = ['A', 'B', 'C'] as const
type Up = (typeof UP)[number]
const low = (v: Up) => v.toLowerCase() as 'a' | 'b' | 'c'

/** Sides and angles of the whole triangle from three sides. */
function fromSides(s: Record<Up, number>): Record<Up, number> {
  const ang = (x: Up) => {
    const [p, q] = UP.filter((v) => v !== x)
    return acos((s[p!] ** 2 + s[q!] ** 2 - s[x] ** 2) / (2 * s[p!] * s[q!]))
  }
  return { A: ang('A'), B: ang('B'), C: ang('C') }
}

function close(got: string, want: number, what: string) {
  expect(Number(got), what).toBeCloseTo(tenth(want), 6)
}

/** The asked thing, from the prompt's last sentence. */
function asked(prompt: string): { side?: Up; angle?: Up; largest?: boolean; area?: boolean } {
  const w = plain(prompt)
  if (/area/.test(w)) return { area: true }
  if (/largest angle/.test(w)) return { largest: true }
  const side = /find side ([abc])/i.exec(w) ?? /then side ([abc])/.exec(w)
  if (side) return { side: side[1]!.toUpperCase() as Up }
  const angle = /find angle ([ABC])/i.exec(w)
  if (angle) return { angle: angle[1] as Up }
  throw new Error(`cannot tell what is asked: ${w}`)
}

/** The triangle from what the prompt gives, solved with plain arithmetic, or null for SSA (handled on its own). */
function solve(g: Letters): { sides: Record<Up, number>; angles: Record<Up, number> } {
  const angles = UP.filter((v) => g[v] !== undefined)
  const sides = UP.filter((v) => g[low(v)] !== undefined)
  if (angles.length >= 2) {
    const third = UP.find((v) => g[v] === undefined)!
    const A = { ...g } as Record<Up, number>
    A[third] = 180 - UP.filter((v) => v !== third).reduce((t, v) => t + g[v]!, 0)
    const k = sides[0]!
    const ratio = g[low(k)]! / sin(A[k])
    return { angles: A, sides: { A: ratio * sin(A.A), B: ratio * sin(A.B), C: ratio * sin(A.C) } }
  }
  if (sides.length === 3) {
    const s = { A: g.a!, B: g.b!, C: g.c! }
    return { sides: s, angles: fromSides(s) }
  }
  // Two sides and one angle: SAS when the angle is between them, SSA (one triangle) when it is across from one.
  const at = angles[0]!
  if (sides.includes(at)) {
    const other = sides.find((v) => v !== at)!
    const Bo = asin((g[low(other)]! * sin(g[at]!)) / g[low(at)]!)
    const third = UP.find((v) => v !== at && v !== other)!
    const A = { [at]: g[at]!, [other]: Bo, [third]: 180 - g[at]! - Bo } as Record<Up, number>
    const ratio = g[low(at)]! / sin(g[at]!)
    return { angles: A, sides: { A: ratio * sin(A.A), B: ratio * sin(A.B), C: ratio * sin(A.C) } }
  }
  const [p, q] = sides as [Up, Up]
  const x = g[low(p)]!
  const y = g[low(q)]!
  const s = { [p]: x, [q]: y, [at]: Math.sqrt(x * x + y * y - 2 * x * y * cos(g[at]!)) } as Record<Up, number>
  return { sides: s, angles: fromSides(s) }
}

/** The figure's corners are the triangle's, up to size: every side's length over the solved side's is the same. */
function trueShape(a: ObliqueAnswer, sides: Record<Up, number>) {
  const spec = a.oblique.after?.spec ?? a.oblique.before
  const at = (id: string) => spec.points.find((p) => p.id === id)!
  if (!['A', 'B', 'C'].every((id) => spec.points.some((p) => p.id === id))) return
  const len = (u: string, v: string) => Math.hypot(at(u).x - at(v).x, at(u).y - at(v).y)
  const k = [len('B', 'C') / sides.A, len('A', 'C') / sides.B, len('A', 'B') / sides.C]
  expect(Math.max(...k) / Math.min(...k), `${a.prompt}: not its true shape`).toBeLessThan(1 + 1e-6)
}

/** Every number the figure labels is one the prompt gives. */
function labelsAreGivens(a: ObliqueAnswer, g: Letters) {
  for (const spec of [a.oblique.before, a.oblique.after?.spec]) {
    if (!spec) continue
    for (const label of [...(spec.segments ?? []).map((s) => s.label ?? ''), ...(spec.angles ?? []).map((x) => x.label ?? '')]) {
      for (const n of label.matchAll(/\d+(?:\.\d+)?/g)) expect(Object.values(g), `${label} in ${a.prompt}`).toContain(Number(n[0]))
    }
  }
}

describe.each(['ot.sines', 'ot.cosines', 'ot.area', 'ot.choose'] as const)('%s solved again from the words', (id) => {
  it(
    '300 seeds agree',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        const { a } = problemAt(id, seed)
        const g = read(a.prompt)
        labelsAreGivens(a, g)
        const rightAngle = UP.find((v) => g[v] === 90)
        const t = rightAngle ? null : solve(g)
        const what = asked(a.prompt)
        for (const part of a.stages) {
          if (part.id === 'law') {
            const nAngles = UP.filter((v) => g[v] !== undefined).length
            const paired = UP.some((v) => g[v] !== undefined && g[low(v)] !== undefined)
            const want = rightAngle ? 'neither' : nAngles >= 2 || paired ? 'sines' : 'cosines'
            expect(part.answerText, a.prompt).toBe(want)
            continue
          }
          if (part.id === 'third') {
            expect(Number(part.answerText), a.prompt).toBe(t!.angles[UP.find((v) => g[v] === undefined)!])
            continue
          }
          if (rightAngle) {
            // The right-triangle case: the Pythagorean theorem or SOH CAH TOA, from the words.
            const side = what.side!
            const known = UP.filter((v) => g[low(v)] !== undefined)
            const acute = UP.find((v) => v !== rightAngle && g[v] !== undefined)
            let want: number
            if (acute) want = side === acute ? g[low(rightAngle)]! * sin(g[acute]!) : g[low(rightAngle)]! * cos(g[acute]!)
            else if (side === rightAngle) want = Math.hypot(g[low(known[0]!)]!, g[low(known[1]!)]!)
            else {
              const leg = known.find((v) => v !== rightAngle)!
              want = Math.sqrt(g[low(rightAngle)]! ** 2 - g[low(leg)]! ** 2)
            }
            close(part.answerText, want, a.prompt)
            continue
          }
          if (what.area) {
            const s = t!.sides
            const p = (s.A + s.B + s.C) / 2
            close(part.answerText, Math.sqrt(p * (p - s.A) * (p - s.B) * (p - s.C)), a.prompt)
          } else if (what.largest) {
            close(part.answerText, Math.max(...Object.values(t!.angles)), a.prompt)
          } else if (what.angle) {
            close(part.answerText, t!.angles[what.angle], a.prompt)
          } else if (what.side) {
            close(part.answerText, t!.sides[what.side], a.prompt)
          }
        }
        if (t) trueShape(a, t.sides)
      }
    },
    T,
  )
})

describe('ot.ambiguous solved again from the words', () => {
  it(
    '300 seeds agree: the count from h = b sin A, then each B',
    () => {
      for (let seed = 1; seed <= 300; seed++) {
        const { a } = problemAt('ot.ambiguous', seed)
        const g = read(a.prompt)
        labelsAreGivens(a, g)
        const h = g.b! * sin(g.A!)
        const count = g.a! < h ? 'none' : g.a! < g.b! ? 'two' : 'one'
        expect(a.stages[0]!.answerText, a.prompt).toBe(count)
        const B = asin((g.b! * sin(g.A!)) / g.a!)
        if (count === 'one') close(a.stages[1]!.answerText, B, a.prompt)
        if (count === 'two') {
          close(a.stages[1]!.answerText, B, a.prompt)
          close(a.stages[2]!.answerText, 180 - B, a.prompt)
          // Both triangles are real: the third angle of the obtuse one is still at least 15°.
          expect(180 - g.A! - (180 - B)).toBeGreaterThanOrEqual(15)
        }
        // Before she answers, the figure draws no B at all.
        expect(a.oblique.before.points.some((p) => p.id.startsWith('B'))).toBe(false)
      }
    },
    T,
  )
})
