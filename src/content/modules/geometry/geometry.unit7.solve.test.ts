/**
 * Honors geometry Unit 7, solved again from what she reads. This file reads each prompt and the figure's labels with its
 * own parsers, decides every answer from the GIVEN lengths with its own arithmetic (numbers, not the generators' exact
 * forms: a search for the altitude triangle, sines for the special triangles, the stories read word by word), and
 * holds the generator to it. It also requires real triangles: positive lengths, the Triangle Inequality, a right angle
 * wherever one is marked, angles as labeled, the figure drawn to the problem's sizes, and every label on the segment the
 * words name. It imports no generator code. GEO7_SEEDS sets the seeds per template (300 by default).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoPoint, ModuleId } from '@/shared/types'

const N = Number(process.env.GEO7_SEEDS ?? 300)
const SEEDS = Array.from({ length: N }, (_, i) => i + 1)
const HEAVY = 600_000

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return p.answer
}

// --- reading numbers ---------------------------------------------------------------------------------------------

/** "12", "4√3", "√13", "(13√3)/2", "13/2", "37.6", "−3" as a number. */
function num(text: string): number {
  const t = text.trim().replace(/−/g, '-')
  let m = /^\((\d*)√(\d+)\)\/(\d+)$/.exec(t)
  if (m) return ((m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2]))) / Number(m[3])
  m = /^(\d*)√(\d+)\/(\d+)$/.exec(t)
  if (m) return ((m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2]))) / Number(m[3])
  m = /^(-?\d*)√(\d+)$/.exec(t)
  if (m) return (m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1])) * Math.sqrt(Number(m[2]))
  m = /^(-?\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[1]) / Number(m[2])
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  throw new Error(`not a number: ${text}`)
}

/** The square of a length written as k√r, exactly. */
function squareOf(text: string): number {
  const m = /^(\d*)√(\d+)$/.exec(text.trim())
  if (m) return (m[1] ? Number(m[1]) ** 2 : 1) * Number(m[2])
  const v = num(text)
  return v * v
}

/** Is the answer text in simplest radical form: a whole number, a fraction in lowest terms, or k√r (over d) with r square-free and nothing left to cancel? */
function simplest(text: string): boolean {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  const squareFree = (r: number) => {
    for (let f = 2; f * f <= r; f++) if (r % (f * f) === 0) return false
    return r > 1
  }
  if (/^\d+$/.test(text)) return true
  let m = /^(\d+)\/(\d+)$/.exec(text)
  if (m) return gcd(Number(m[1]), Number(m[2])) === 1 && Number(m[2]) > 1
  m = /^(\d*)√(\d+)$/.exec(text)
  if (m) return squareFree(Number(m[2])) && m[1] !== '1'
  m = /^\((\d*)√(\d+)\)\/(\d+)$/.exec(text) ?? /^(\d*)√(\d+)\/(\d+)$/.exec(text)
  if (m) return squareFree(Number(m[2])) && gcd(m[1] ? Number(m[1]) : 1, Number(m[3])) === 1 && Number(m[3]) > 1
  return false
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(b))

/** A linear expression in x as written: "x + 3", "2x − 1", "3x", "x". */
function expr(text: string): { a: number; b: number } | null {
  const m = /^(\d*)x(?: ([+−]) (\d+))?$/.exec(text.trim())
  if (!m) return null
  return { a: m[1] ? Number(m[1]) : 1, b: m[2] ? (m[2] === '+' ? 1 : -1) * Number(m[3]) : 0 }
}

/** "AB = 4", "AD = x + 3": every name = value in a sentence. */
function pairs(text: string): [string, string][] {
  return [...text.matchAll(/\b([A-Z]{2}) = ([^,.]+?)(?=,| and |\.|$)/g)].map((m) => [m[1]!, m[2]!.trim()])
}

// --- the figure ---------------------------------------------------------------------------------------------------

function pt(a: GeometryAnswer, id: string): GeoPoint {
  const p = a.figure.points.find((q) => q.id === id)
  if (!p) throw new Error(`no point ${id}`)
  return p
}
const len = (a: GeometryAnswer, s: string) => {
  const p = pt(a, s[0]!)
  const q = pt(a, s[1]!)
  return Math.hypot(p.x - q.x, p.y - q.y)
}
function angleAt(a: GeometryAnswer, v: string, f: string, t: string): number {
  const V = pt(a, v)
  const F = pt(a, f)
  const T = pt(a, t)
  const c = ((F.x - V.x) * (T.x - V.x) + (F.y - V.y) * (T.y - V.y)) / (Math.hypot(F.x - V.x, F.y - V.y) * Math.hypot(T.x - V.x, T.y - V.y))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

/** Every right-angle mark is on a right angle, and every labeled angle measures what it says. */
function marksHold(a: GeometryAnswer, where: string): void {
  for (const g of a.figure.angles ?? []) {
    const m = angleAt(a, g.vertex, g.from, g.to)
    if (g.right) expect(Math.abs(m - 90), `${where} right angle at ${g.vertex}`).toBeLessThan(0.02)
    else if (g.label && /^\d+°$/.test(g.label)) expect(Math.abs(m - Number(g.label.slice(0, -1))), `${where} angle ${g.label} at ${g.vertex}`).toBeLessThan(0.05)
  }
}

/** The label the figure puts on a segment (either direction), trimmed, or undefined. */
function labelOn(a: GeometryAnswer, name: string): string | undefined {
  const s = (a.figure.segments ?? []).find((g) => (g.from === name[0] && g.to === name[1]) || (g.from === name[1] && g.to === name[0]))
  return s?.label?.trim()
}

/** The figure is drawn to scale: every pair of named lengths has the drawn ratio of their values. */
function toScale(a: GeometryAnswer, lengths: Record<string, number>, where: string): void {
  const names = Object.keys(lengths)
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const p = names[i]!
      const q = names[j]!
      const drawn = len(a, p) / len(a, q)
      expect(Math.abs(drawn / (lengths[p]! / lengths[q]!) - 1), `${where} ${p}:${q} drawn to scale`).toBeLessThan(0.002)
    }
  }
}

/** Three positive lengths that make a triangle. */
function triangle(x: number, y: number, z: number, where: string): void {
  for (const v of [x, y, z]) expect(v, `${where} positive`).toBeGreaterThan(0)
  const [p, q, r] = [x, y, z].sort((m, n) => m - n) as [number, number, number]
  expect(p + q, `${where} triangle inequality`).toBeGreaterThan(r)
}

/** The answers of the parts, by the label she sees: x, y, or a segment name. */
function answersByLabel(a: GeometryAnswer): Record<string, string> {
  return Object.fromEntries(a.stages.map((s) => [s.label, s.answerText]))
}

function checkAnswer(a: GeometryAnswer, label: string, want: number, where: string): void {
  const got = answersByLabel(a)[label]
  expect(got, `${where} part ${label}`).toBeDefined()
  expect(close(num(got!), want), `${where} ${label}: ${got} vs ${want}`).toBe(true)
  expect(simplest(got!), `${where} ${label}: ${got} in simplest form`).toBe(true)
}

// --- rs.mean ------------------------------------------------------------------------------------------------------

describe('rs.mean, solved again', () => {
  it(`${N} seeds`, { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoRightSimilar', 'rs.mean', seed)
      const where = `rs.mean/${seed}`
      let m = /^Find the geometric mean of (\d+) and (\d+)\.$/.exec(a.prompt)
      if (m) {
        const want = Math.sqrt(Number(m[1]) * Number(m[2]))
        checkAnswer(a, 'Geometric mean', want, where)
        continue
      }
      m = /^The geometric mean of (\d+) and x is (\S+)\. Find x\.$/.exec(a.prompt)
      expect(m, `${where} ${a.prompt}`).not.toBeNull()
      // a/m = m/x, so x = m²/a.
      checkAnswer(a, 'x', squareOf(m![2]!) / Number(m![1]), where)
    }
  })
})

// --- rs.altitude ----------------------------------------------------------------------------------------------------

type Role = 'segA' | 'segB' | 'c' | 'h' | 'legA' | 'legB'

/** Every role's length from the two segments s = AD and t = DB of the hypotenuse. */
function lengthsFrom(s: number, t: number): Record<Role, number> {
  return { segA: s, segB: t, c: s + t, h: Math.sqrt(s * t), legA: Math.sqrt(s * (s + t)), legB: Math.sqrt(t * (s + t)) }
}

/** The two segments from two given lengths, by a search on a grid and then Newton's method; null when none fits. */
function solveSegments(given: [Role, number][]): [number, number] | null {
  const res = (s: number, t: number) => {
    const L = lengthsFrom(s, t)
    return given.map(([r, v]) => L[r] / v - 1)
  }
  let best: [number, number] = [1, 1]
  let bestErr = Infinity
  for (let i = 0; i <= 160; i++) {
    for (let j = 0; j <= 160; j++) {
      const s = 0.2 * 1.05 ** i
      const t = 0.2 * 1.05 ** j
      const e = res(s, t).reduce((acc, r) => acc + r * r, 0)
      if (e < bestErr) {
        bestErr = e
        best = [s, t]
      }
    }
  }
  let [s, t] = best
  for (let k = 0; k < 60; k++) {
    const r = res(s, t)
    const hS = s * 1e-7
    const hT = t * 1e-7
    const rs = res(s + hS, t)
    const rt = res(s, t + hT)
    const j11 = (rs[0]! - r[0]!) / hS
    const j12 = (rt[0]! - r[0]!) / hT
    const j21 = (rs[1]! - r[1]!) / hS
    const j22 = (rt[1]! - r[1]!) / hT
    const det = j11 * j22 - j12 * j21
    if (Math.abs(det) < 1e-18) break
    s -= (r[0]! * j22 - r[1]! * j12) / det
    t -= (j11 * r[1]! - j21 * r[0]!) / det
    if (!(s > 0 && t > 0)) return null
  }
  return res(s, t).every((e) => Math.abs(e) < 1e-10) ? [s, t] : null
}

describe('rs.altitude, solved again from the words and the figure', () => {
  it(`${N} seeds`, { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoRightSimilar', 'rs.altitude', seed)
      const where = `rs.altitude/${seed}`
      const head = /^In right triangle ([A-Z]{3}), ∠([A-Z])([A-Z])([A-Z]) is a right angle and ([A-Z])([A-Z]) is the altitude to the hypotenuse\. (.*?)\. (Find .*)$/.exec(a.prompt)
      expect(head, `${where} ${a.prompt}`).not.toBeNull()
      const [, tri, e1, C, e2, C2, D, givenText, question] = head as unknown as string[]
      expect(C2, where).toBe(C)
      expect(new Set(tri!.split('')), where).toEqual(new Set([e1, C, e2]))
      const A = e1!
      const B = e2!
      // The role of a segment, from its letters alone.
      const roleOf = (name: string): Role => {
        const set = new Set(name.split(''))
        if (set.has(A) && set.has(B)) return 'c'
        if (set.has(C!) && set.has(D!)) return 'h'
        if (set.has(D!)) return set.has(A) ? 'segA' : 'segB'
        return set.has(A) ? 'legA' : 'legB'
      }
      const givens = pairs(givenText!)
      const numeric: [Role, number][] = []
      const inX: [Role, { a: number; b: number }][] = []
      for (const [name, value] of givens) {
        const e = expr(value)
        if (e) inX.push([roleOf(name), e])
        else numeric.push([roleOf(name), num(value)])
      }
      // The asked lengths: "x, the length of NAME" and "y, the length of NAME", or "Find NAME, then x."
      const asked: Record<string, string> = {}
      for (const m of question!.matchAll(/\b([xy]), the length of ([A-Z]{2})/g)) asked[m[1]!] = m[2]!
      const first = /^Find ([A-Z]{2}), then x\.$/.exec(question!)
      if (first) asked[first[1]!] = first[1]!
      let segs: [number, number] | null
      let x: number | null = null
      if (inX.length === 0) {
        expect(numeric.length, where).toBe(2)
        segs = solveSegments(numeric as [Role, number][])
      } else if (numeric.length === 2) {
        segs = solveSegments(numeric)
        const [role, e] = inX[0]!
        const L = lengthsFrom(...segs!)
        x = (L[role] - e.b) / e.a
      } else {
        // Both segments in x, the altitude a number: x(x + d) = h², the positive root.
        expect(inX.length, where).toBe(2)
        const h = numeric.find(([r]) => r === 'h')![1]
        const [ea, eb] = [inX.find(([r]) => r === 'segA')![1], inX.find(([r]) => r === 'segB')![1]]
        let lo = 1e-6
        let hi = 1000
        const f = (v: number) => (ea.a * v + ea.b) * (eb.a * v + eb.b) - h * h
        for (let k = 0; k < 200; k++) {
          const mid = (lo + hi) / 2
          if (f(mid) > 0) hi = mid
          else lo = mid
        }
        x = lo
        segs = [ea.a * x + ea.b, eb.a * x + eb.b]
      }
      expect(segs, `${where} the givens fit no right triangle`).not.toBeNull()
      const [s, t] = segs!
      const L = lengthsFrom(s, t)
      for (const v of Object.values(L)) expect(v, `${where} positive`).toBeGreaterThan(0)
      triangle(L.legA, L.legB, L.c, where)
      expect(Math.abs(L.legA ** 2 + L.legB ** 2 - L.c ** 2), `${where} right`).toBeLessThan(1e-6 * L.c ** 2)
      const answers = answersByLabel(a)
      if (x !== null) {
        expect(x, `${where} x positive`).toBeGreaterThan(0)
        checkAnswer(a, 'x', x, where)
        // Every expression is a positive length at that x.
        for (const [, e] of inX) expect(e.a * x + e.b, where).toBeGreaterThan(0)
      }
      for (const [label, name] of Object.entries(asked)) {
        checkAnswer(a, label === name ? name : label, L[roleOf(name)], where)
        // The figure labels an asked length with its letter only, never a number.
        if (label !== name) expect(labelOn(a, name), `${where} ${name}`).toBe(label)
      }
      expect(Object.keys(answers).length, where).toBe(Object.keys(asked).length + (x !== null && !Object.keys(asked).includes('x') ? 1 : 0))
      // The figure: right angles at C and D, D between A and B, drawn to scale, each given on its own segment.
      marksHold(a, where)
      const marks = (a.figure.angles ?? []).filter((g) => g.right).map((g) => g.vertex)
      expect(marks.sort(), where).toEqual([C, D].sort())
      expect(Math.abs(len(a, `${A}${D}`) + len(a, `${D}${B}`) - len(a, `${A}${B}`)), `${where} D on AB`).toBeLessThan(1e-3)
      toScale(a, { [`${A}${D}`]: s, [`${D}${B}`]: t, [`${C}${D}`]: L.h, [`${A}${C}`]: L.legA, [`${B}${C}`]: L.legB }, where)
      for (const [name, value] of givens) if (roleOf(name) !== 'c') expect(labelOn(a, name), `${where} label on ${name}`).toBe(value)
    }
  })
})

// --- py.side ------------------------------------------------------------------------------------------------------

describe('py.side, solved again from the words and the figure', () => {
  it(`${N} seeds`, { timeout: HEAVY }, () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      const a = answerOf('geoPythagorean', 'py.side', seed)
      const where = `py.side/${seed}`
      const P = a.prompt
      let m = /^In right triangle ([A-Z]{3}), ∠([A-Z])([A-Z])([A-Z]) is a right angle, ([A-Z]{2}) = (\S+), and ([A-Z]{2}) = (\S+)\. Find x, the length of ([A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('triangle')
        const [, , , R, , n1, v1, n2, v2, n3] = m as unknown as string[]
        const sides: Record<string, number> = { [n1!]: num(v1!), [n2!]: num(v2!) }
        const isHyp = (n: string) => !n.includes(R!)
        let want: number
        if (isHyp(n3!)) want = Math.sqrt(squareOf(v1!) + squareOf(v2!))
        else {
          const hyp = isHyp(n1!) ? v1! : v2!
          const leg = isHyp(n1!) ? v2! : v1!
          want = Math.sqrt(squareOf(hyp) - squareOf(leg))
        }
        checkAnswer(a, 'x', want, where)
        sides[n3!] = want
        triangle(...(Object.values(sides) as [number, number, number]), where)
        marksHold(a, where)
        toScale(a, sides, where)
        expect(labelOn(a, n3!), where).toBe('x')
        expect(labelOn(a, n1!), where).toBe(v1)
        continue
      }
      m = /^([A-Z]{4}) is a rectangle with ([A-Z]{2}) = (\S+) and (diagonal )?([A-Z]{2}) = (\S+)\. Find x, the length of (diagonal )?([A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('rectangle')
        const [, , n1, v1, d2, n2, v2, d3, n3] = m as unknown as string[]
        const want = d3 ? Math.hypot(num(v1!), num(v2!)) : Math.sqrt(num(v2!) ** 2 - num(v1!) ** 2)
        expect(Boolean(d2) !== Boolean(d3), where).toBe(true)
        checkAnswer(a, 'x', want, where)
        const L = d3 ? { [n1!]: num(v1!), [n2!]: num(v2!), [n3!]: want } : { [n1!]: num(v1!), [n3!]: want, [n2!]: num(v2!) }
        toScale(a, L, where)
        marksHold(a, where)
        // The four corners of a rectangle are right angles.
        const [r0, r1, r2, r3] = m[1]!.split('')
        for (const [v, f, t] of [
          [r1, r0, r2],
          [r2, r1, r3],
          [r3, r2, r0],
          [r0, r3, r1],
        ] as [string, string, string][])
          expect(Math.abs(angleAt(a, v, f, t) - 90), `${where} corner ${v}`).toBeLessThan(0.02)
        continue
      }
      m = /^In isosceles triangle ([A-Z]{3}), (.*)$/.exec(P)
      if (m) {
        seen.add('isosceles')
        const [A, B, C] = m[1]!.split('') as [string, string, string]
        const all = pairs(P)
        const legPair = /([A-Z]{2}) = ([A-Z]{2})(?: = (\S+?))?(?: and|\.)/.exec(P)!
        const leg = legPair[3] ? num(legPair[3]) : null
        const base = all.find(([n]) => n === `${B}${C}`)?.[1]
        const alt = /The altitude to the base is ([A-Z]{2}) = (\S+)\./.exec(P) ?? /([A-Z]{2}) is the altitude to the base\./.exec(P)
        const altName = alt![1]!
        const altValue = alt![2] ? num(alt![2]) : null
        const D = altName[1]!
        const baseV = base ? num(base) : null
        // The altitude to the base of an isosceles triangle bisects it.
        let want: number
        let label: string
        let sides: { leg: number; base: number; alt: number }
        if (/Find x, the length of ([A-Z]{2})\.$/.exec(P)?.[1] === altName) {
          want = Math.sqrt(leg! ** 2 - (baseV! / 2) ** 2)
          label = 'x'
          sides = { leg: leg!, base: baseV!, alt: want }
        } else if (/Find x, the length of ([A-Z]{2})\.$/.exec(P)?.[1] === `${A}${B}`) {
          want = Math.hypot(baseV! / 2, altValue!)
          label = 'x'
          sides = { leg: want, base: baseV!, alt: altValue! }
        } else {
          expect(P, where).toMatch(/Find the length of the base [A-Z]{2}\.$/)
          want = 2 * Math.sqrt(leg! ** 2 - altValue! ** 2)
          label = `${B}${C}`
          sides = { leg: leg!, base: want, alt: altValue! }
        }
        checkAnswer(a, label, want, where)
        triangle(sides.leg, sides.leg, sides.base, where)
        toScale(a, { [`${A}${B}`]: sides.leg, [`${A}${C}`]: sides.leg, [`${B}${C}`]: sides.base, [`${A}${D}`]: sides.alt, [`${B}${D}`]: sides.base / 2 }, where)
        marksHold(a, where)
        continue
      }
      m = /^The diagonals of rhombus ([A-Z]{4}) meet at ([A-Z]), with ([A-Z]{2}) = (\d+) and ([A-Z]{2}) = (\d+)\. Find x, the length of ([A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('rhombus')
        const want = Math.hypot(Number(m[4]) / 2, Number(m[6]) / 2)
        checkAnswer(a, 'x', want, where)
        toScale(a, { [m[3]!]: Number(m[4]), [m[5]!]: Number(m[6]), [m[7]!]: want }, where)
        marksHold(a, where)
        continue
      }
      m = /^Rhombus ([A-Z]{4}) has sides of length (\S+), and its diagonals meet at ([A-Z])\. The diagonal ([A-Z]{2}) = (\d+)\. Find ([A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('rhombus')
        const side = num(m[2]!)
        const want = 2 * Math.sqrt(side ** 2 - (Number(m[5]) / 2) ** 2)
        checkAnswer(a, m[6]!, want, where)
        const r = m[1]!
        toScale(a, { [`${r[0]}${r[1]}`]: side, [m[4]!]: Number(m[5]), [m[6]!]: want }, where)
        marksHold(a, where)
        continue
      }
      m = /^Find the distance between ([A-Z])\((−?\d+), (−?\d+)\) and ([A-Z])\((−?\d+), (−?\d+)\)\.$/.exec(P)
      expect(m, `${where} ${P}`).not.toBeNull()
      seen.add('grid')
      const [x1, y1, x2, y2] = [m![2], m![3], m![5], m![6]].map((v) => num(v!))
      checkAnswer(a, `${m![1]}${m![4]}`, Math.hypot(x2! - x1!, y2! - y1!), where)
      expect([pt(a, m![1]!).x, pt(a, m![1]!).y, pt(a, m![4]!).x, pt(a, m![4]!).y], where).toEqual([x1, y1, x2, y2])
      marksHold(a, where)
    }
    expect([...seen].sort()).toEqual(['grid', 'isosceles', 'rectangle', 'rhombus', 'triangle'])
  })
})

// --- py.classify ------------------------------------------------------------------------------------------------

describe('py.classify, solved again', () => {
  it(`${N} seeds`, { timeout: HEAVY }, () => {
    for (const seed of SEEDS) {
      const a = answerOf('geoPythagorean', 'py.classify', seed)
      const where = `py.classify/${seed}`
      const m = /^Can segments with lengths (\S+), (\S+), and (\S+) form a triangle\? If they can, classify the triangle by its angles\.$/.exec(a.prompt)
      expect(m, `${where} ${a.prompt}`).not.toBeNull()
      const sides = [m![1]!, m![2]!, m![3]!].sort((p, q) => num(p) - num(q))
      const [s, t, u] = sides.map(num) as [number, number, number]
      let want: string
      if (s + t <= u + 1e-12) want = 'none'
      else {
        const lhs = squareOf(sides[2]!)
        const rhs = squareOf(sides[0]!) + squareOf(sides[1]!)
        want = Math.abs(lhs - rhs) < 1e-9 ? 'right' : lhs < rhs ? 'acute' : 'obtuse'
      }
      expect(a.stages[0]!.answerText, `${where} ${sides.join(', ')}`).toBe(want)
      // A named slip is the slip on these lengths: the last length taken as c only when it is not the longest; every
      // kind of triangle picked for lengths that make none; the comparison read backwards.
      for (const c of a.stages[0]!.choices ?? []) {
        if (!c.trap) continue
        if (c.trap === 'geo_converse_wrong_side') {
          expect(num(m![3]!) < u, `${where} last is not the longest`).toBe(true)
          expect(c.id, where).toBe('acute')
        }
        if (c.trap === 'geo_triangle_inequality_skipped') expect(want, where).toBe('none')
        if (c.trap === 'geo_acute_obtuse_swapped') expect([want, c.id].sort(), where).toEqual(['acute', 'obtuse'])
      }
    }
  })
})

// --- py.apply -----------------------------------------------------------------------------------------------------

/** Halves away from zero, as the problem rounds. */
const roundTo = (v: number, places: number) => (Math.floor(v * 10 ** places + 0.5) / 10 ** places).toFixed(places)

describe('py.apply, solved again from the story', () => {
  it(`${N} seeds`, { timeout: HEAVY }, () => {
    const stories = new Set<string>()
    for (const seed of SEEDS) {
      const a = answerOf('geoPythagorean', 'py.apply', seed)
      const where = `py.apply/${seed}`
      const P = a.prompt
      const round = /Round to the nearest (tenth|hundredth)? ?(?:of an? )?(\w+)\.$/.exec(P)
      expect(round, `${where} ${P}`).not.toBeNull()
      const places = round![1] === 'tenth' ? 1 : round![1] === 'hundredth' ? 2 : 0
      const n = (re: RegExp) => {
        const m = re.exec(P)
        if (!m) throw new Error(`${where}: ${re} in ${P}`)
        return Number(m[1])
      }
      let want: number
      let legs: [number, number]
      let hyp: number
      if (/ladder/.test(P)) {
        stories.add('ladder')
        if (/How high/.test(P)) {
          hyp = n(/ladder (\d+) feet long/)
          const foot = n(/foot is (\d+) feet/)
          want = Math.sqrt(hyp ** 2 - foot ** 2)
          legs = [foot, want]
        } else if (/How long is the ladder/.test(P)) {
          const up = n(/wall (\d+) feet above/)
          const foot = n(/foot is (\d+) feet/)
          want = Math.hypot(up, foot)
          hyp = want
          legs = [foot, up]
        } else {
          hyp = n(/ladder (\d+) feet long/)
          const up = n(/reaches (\d+) feet up/)
          want = Math.sqrt(hyp ** 2 - up ** 2)
          legs = [want, up]
        }
      } else if (/screen/.test(P)) {
        stories.add('screen')
        if (/How long is its diagonal/.test(P)) {
          legs = [n(/(\d+) inches wide/), n(/(\d+) inches tall/)]
          want = Math.hypot(...legs)
          hyp = want
        } else {
          hyp = n(/diagonal of (\d+) inches/)
          const w = n(/(\d+) inches wide/)
          want = Math.sqrt(hyp ** 2 - w ** 2)
          legs = [w, want]
        }
      } else if (/ramp/.test(P)) {
        stories.add('ramp')
        if (/How long is the ramp/.test(P)) {
          legs = [n(/horizontal distance of (\d+) feet/), n(/rises (\d+) feet/)]
          want = Math.hypot(...legs)
          hyp = want
        } else {
          hyp = n(/ramp (\d+) feet long/)
          const rise = n(/rises (\d+) feet/)
          want = Math.sqrt(hyp ** 2 - rise ** 2)
          legs = [want, rise]
        }
      } else if (/field/.test(P)) {
        stories.add('field')
        if (/How long is a straight path/.test(P)) {
          legs = [n(/is (\d+) (?:meters|yards) long/), n(/and (\d+) (?:meters|yards) wide/)]
          want = Math.hypot(...legs)
          hyp = want
        } else {
          hyp = n(/path (\d+) (?:meters|yards) long/)
          const long = n(/field is (\d+) (?:meters|yards) long/)
          want = Math.sqrt(hyp ** 2 - long ** 2)
          legs = [long, want]
        }
      } else if (/kite/.test(P)) {
        stories.add('kite')
        if (/How high is the kite/.test(P)) {
          hyp = n(/string (\d+) feet long/)
          const d = n(/point (\d+) feet from the stake/)
          want = Math.sqrt(hyp ** 2 - d ** 2)
          legs = [d, want]
        } else {
          const up = n(/flies (\d+) feet above/)
          const d = n(/point (\d+) feet from where/)
          want = Math.hypot(up, d)
          hyp = want
          legs = [d, up]
        }
      } else {
        expect(P, where).toMatch(/ship/)
        stories.add('ship')
        if (/How far is the ship from where it started/.test(P)) {
          const first = n(/sails (\d+) (?:kilometers|miles) due/)
          const second = n(/then (\d+) (?:kilometers|miles) due/)
          want = Math.hypot(first, second)
          hyp = want
          legs = [second, first]
        } else {
          const second = n(/then (\d+) (?:kilometers|miles) due/)
          hyp = n(/then (\d+) (?:kilometers|miles) from where/)
          want = Math.sqrt(hyp ** 2 - second ** 2)
          legs = [second, want]
        }
      }
      const stage = a.stages[0]!
      expect(stage.answerText, `${where} ${P}`).toBe(roundTo(want, places))
      triangle(legs[0], legs[1], hyp, where)
      // The rounded answer is not one of the story's own numbers.
      const given = [...P.matchAll(/\d+/g)].map((m) => Number(m[0]))
      expect(given.includes(Number(stage.answerText)), `${where} ${stage.answerText} is given`).toBe(false)
      // The figure: the right angle marked, drawn to scale, the asked side marked ? and the others numbered.
      marksHold(a, where)
      const segs = a.figure.segments!.filter((s) => s.label)
      const marked = segs.filter((s) => s.label!.trim() === '?')
      expect(marked.length, where).toBe(1)
      for (const s of segs) if (s.label!.trim() !== '?') expect(Number.isInteger(Number(s.label!.trim())), `${where} ${s.label}`).toBe(true)
      const byLabel = Object.fromEntries(segs.map((s) => [s.label!.trim(), Math.hypot(pt(a, s.from).x - pt(a, s.to).x, pt(a, s.from).y - pt(a, s.to).y)]))
      const drawnAsked = byLabel['?']!
      for (const s of segs) {
        const v = s.label!.trim() === '?' ? want : Number(s.label!.trim())
        expect(Math.abs(byLabel[s.label!.trim()]! / drawnAsked - v / want), `${where} ${s.label} to scale`).toBeLessThan(0.002 * (v / want))
      }
    }
    expect([...stories].sort()).toEqual(['field', 'kite', 'ladder', 'ramp', 'screen', 'ship'])
  })
})

// --- sp.special ---------------------------------------------------------------------------------------------------

const sin = (deg: number) => Math.sin((deg * Math.PI) / 180)
const cos = (deg: number) => Math.cos((deg * Math.PI) / 180)

describe('sp.special, solved again with the sines of the angles', () => {
  it(`${N} seeds`, { timeout: HEAVY }, () => {
    const seen = new Set<string>()
    for (const seed of SEEDS) {
      const a = answerOf('geoSpecialRight', 'sp.special', seed)
      const where = `sp.special/${seed}`
      const P = a.prompt
      marksHold(a, where)
      // A triangle whose angles are known at each vertex: each side is the hypotenuse times the sine of the angle across.
      const solveTri = (letters: string, angles: Record<string, number>, knownName: string, knownValue: number) => {
        const across = (name: string) => letters.split('').find((ch) => !name.includes(ch))!
        const hyp = knownValue / sin(angles[across(knownName)]!)
        return (name: string) => hyp * sin(angles[across(name)]!)
      }
      let m = /^In 45°-45°-90° triangle ([A-Z]{3}), ∠([A-Z]) is the right angle and ([A-Z]{2}) = (\S+)\. Find x, the length of (each leg|[A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('tri45')
        const [, letters, R, known, value, target] = m as unknown as string[]
        const angles = Object.fromEntries(letters!.split('').map((ch) => [ch, ch === R ? 90 : 45]))
        const side = solveTri(letters!, angles, known!, num(value!))
        const legName = letters!.split('').filter((ch) => ch !== R)[0]! + R
        checkAnswer(a, 'x', target === 'each leg' ? side(legName) : side(target!), where)
        continue
      }
      m = /^In 30°-60°-90° triangle ([A-Z]{3}), ∠([A-Z]) is the right angle, m∠([A-Z]) = (30|60), and ([A-Z]{2}) = (\S+)\. Find x, the length of ([A-Z]{2})(?:, and y, the length of ([A-Z]{2}))?\.$/.exec(P)
      if (m) {
        seen.add('tri30')
        const [, letters, R, V, deg, known, value, xName, yName] = m as unknown as string[]
        const other = letters!.split('').find((ch) => ch !== R && ch !== V)!
        const angles = { [R!]: 90, [V!]: Number(deg), [other]: 90 - Number(deg) }
        const side = solveTri(letters!, angles, known!, num(value!))
        checkAnswer(a, 'x', side(xName!), where)
        if (yName) checkAnswer(a, 'y', side(yName), where)
        // The figure's angle label says the same angle the words do.
        const mark = (a.figure.angles ?? []).find((g) => g.label)!
        expect(Math.abs(angleAt(a, mark.vertex, mark.from, mark.to) - angles[mark.vertex]!), where).toBeLessThan(0.05)
        continue
      }
      m = /^([A-Z]{4}) is a square with (?:sides of length (\S+)|diagonal ([A-Z]{2}) = (\S+))\. Find x, the length of (?:diagonal )?([A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('square')
        const want = m[2] ? num(m[2]) / cos(45) : num(m[4]!) * cos(45)
        checkAnswer(a, 'x', want, where)
        const sq = m[1]!
        for (let i = 0; i < 4; i++) expect(Math.abs(angleAt(a, sq[i]!, sq[(i + 3) % 4]!, sq[(i + 1) % 4]!) - 90), `${where} corner`).toBeLessThan(0.02)
        continue
      }
      m = /^Equilateral triangle ([A-Z]{3}) has sides of length (\S+), and ([A-Z]{2}) is an altitude\. Find x, the length of ([A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('equilateral')
        checkAnswer(a, 'x', num(m[2]!) * sin(60), where)
        const t = m[1]!
        for (let i = 0; i < 3; i++) expect(Math.abs(angleAt(a, t[i]!, t[(i + 1) % 3]!, t[(i + 2) % 3]!) - 60), `${where} equilateral`).toBeLessThan(0.02)
        continue
      }
      m = /^The altitude ([A-Z]{2}) of equilateral triangle ([A-Z]{3}) has length (\S+)\. Find x, the length of ([A-Z]{2})\.$/.exec(P)
      if (m) {
        seen.add('equilateral')
        checkAnswer(a, 'x', num(m[3]!) / sin(60), where)
        continue
      }
      m = /^In rectangle ([A-Z]{4}), diagonal ([A-Z]{2}) makes an angle of 30° with side ([A-Z]{2}), and ([A-Z]{2}) = (\S+)\. Find x, the length of ([A-Z]{2})(?:, and y, the length of ([A-Z]{2}))?\.$/.exec(P)
      if (m) {
        seen.add('rectangle30')
        const [, rect, diag, sideName, known, value, xName, yName] = m as unknown as string[]
        // In the right triangle on the diagonal and the 30° side: the diagonal is the hypotenuse.
        const third = rect!.split('').find((ch) => diag!.includes(ch) === false && sideName!.includes(ch))!
        const A = diag!.split('').find((ch) => sideName!.includes(ch))!
        const Cc = diag!.split('').find((ch) => ch !== A)!
        const letters = `${A}${third}${Cc}`
        const side = solveTri(letters, { [A]: 30, [third]: 90, [Cc]: 60 }, known!, num(value!))
        checkAnswer(a, 'x', side(xName!), where)
        if (yName) checkAnswer(a, 'y', side(yName), where)
        continue
      }
      m = /^(?:Rhombus ([A-Z]{4}) has sides of length (\S+) and m∠([A-Z]{3}) = 60|In rhombus ([A-Z]{4}), m∠([A-Z]{3}) = 60 and the (shorter|longer) diagonal ([A-Z]{2}) = (\S+))\. (?:Its diagonals|The diagonals) meet at ([A-Z])\. Find (?:the length of the longer diagonal, ([A-Z]{2})|x, the length of ([A-Z]{2}))\.$/.exec(P)
      if (m) {
        seen.add('rhombus60')
        // Sides s, an angle of 60°: the shorter diagonal is s (an equilateral triangle) and the longer is 2s·cos 30°.
        let s: number
        if (m[2]) s = num(m[2])
        else if (m[6] === 'shorter') s = num(m[8]!)
        else s = num(m[8]!) / (2 * cos(30))
        if (m[10]) checkAnswer(a, m[10], 2 * s * cos(30), where)
        else checkAnswer(a, 'x', s, where)
        continue
      }
      m = /^The hypotenuse ([A-Z]{2}) of isosceles right triangle ([A-Z]{3}) has length (\S+)\. Find x, the length of each leg\.$/.exec(P)
      expect(m, `${where} ${P}`).not.toBeNull()
      seen.add('isoRight')
      checkAnswer(a, 'x', num(m![3]!) * cos(45), where)
    }
    expect([...seen].sort()).toEqual(['equilateral', 'isoRight', 'rectangle30', 'rhombus60', 'square', 'tri30', 'tri45'])
  })
})
