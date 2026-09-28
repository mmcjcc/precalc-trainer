/**
 * Seeded property loops for the transformations core.
 *
 * - 300 random specs a·f(b(x − h)) + k over the six parents: the image of every key point lies EXACTLY on g
 *   (checked through the rendered formula, both forms, parsed and evaluated exactly), the right image grades
 *   correct and every point-mistake candidate grades as its own kind; her steps in shuffled order grade
 *   correct.
 * - 100 of those specs: both formula forms (and the expanded polynomial for x^2 and x^3) grade correct and
 *   every equation-mistake candidate grades as its own kind.
 * - 300 random piecewise functions and x values: the evaluation agrees with the formula of the piece whose
 *   interval contains x (an independent float oracle), and the right value grades correct.
 * - 200 random average rates: exact value against a float oracle; every candidate grades as its own kind.
 */
import { describe, expect, it } from 'vitest'
import { rat, ratToNumber, ratToString } from '@/notation/rational'
import type { Piece, Rational } from '@/shared/types'
import { exactEval, surdEquals, surdOf } from '../functions/exact'
import { polyAdd, polyPow, polyScale, polyToText, polyTrim, type Poly } from '../functions/poly'
import { evalNode } from '../math'
import { parseExpression } from '../parse'
import { mulberry32 } from '../samples'
import { describeAsInputs, gradeDescription } from './describe'
import { equationMistakes, gradeEquation } from './equation'
import { evaluatePiecewise, gradePiecewiseValue } from './piecewise'
import { gradeMappedPoint, mappedPointMistakes } from './points'
import { averageRateMistakes, averageRateOfChange, gradeAverageRate } from './rate'
import { explicitFormula, makeTransform, mapPoint, PARENT_NAMES, PARENTS } from './spec'
import { pointText } from './text'
import type { PiecewisePiece, StatementForm, TransformSpec } from './types'

type Rand = () => number

function int(r: Rand, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1))
}

function pick<T>(r: Rand, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!
}

/** Mostly integers, sometimes halves or thirds. */
function ratIn(r: Rand, lo: number, hi: number, nonzero = false): Rational {
  const den = r() < 0.65 ? 1 : r() < 0.7 ? 2 : 3
  for (;;) {
    const n = int(r, lo * den, hi * den)
    if (!nonzero || n !== 0) return rat(n, den)
  }
}

function randomSpec(r: Rand): TransformSpec {
  return makeTransform(pick(r, PARENT_NAMES), { a: ratIn(r, -4, 4, true), b: ratIn(r, -3, 3, true), h: ratIn(r, -6, 6), k: ratIn(r, -6, 6) })
}

function node(text: string) {
  const p = parseExpression(text, ['x'])
  if (!p.ok) throw new Error(`does not parse: ${text}`)
  return p.node
}

function shuffle<T>(r: Rand, xs: T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** a·(b(x − h))^n + k multiplied out, for the square and cube parents. */
function expanded(spec: TransformSpec): string {
  const n = spec.parent === 'square' ? 2 : 3
  const inner: Poly = [rat(-spec.b.n * spec.h.n, spec.b.d * spec.h.d), spec.b]
  return polyToText(polyAdd(polyScale(polyPow(inner, n), spec.a), [spec.k]))
}

describe('transformations — seeded properties', () => {
  it('300 specs: key point images lie exactly on g; points and descriptions grade consistently', () => {
    const r = mulberry32(20260927)
    let points = 0
    let candidates = 0
    for (let i = 0; i < 300; i++) {
      const spec = randomSpec(r)
      const forms: StatementForm[] = ['factored', 'unfactored']
      const gs = forms.map((f) => node(explicitFormula(spec, f)))
      for (const p of PARENTS[spec.parent].keyPoints) {
        const img = mapPoint(spec, p)
        for (const g of gs) {
          const v = exactEval(g, img.x)
          expect(v !== 'undef' && surdEquals(v, surdOf(img.y)), `${explicitFormula(spec)} at ${pointText(img)}`).toBe(true)
        }
        const form = pick(r, forms)
        expect(gradeMappedPoint(spec, p, pointText(img), { form }).verdict).toBe('correct')
        for (const c of mappedPointMistakes(spec, p, { form })!) {
          expect(c.text).not.toBe(pointText(img))
          const g = gradeMappedPoint(spec, p, c.text, { form })
          expect(g.verdict === 'mistake' && g.mistake, `${explicitFormula(spec)}: ${c.kind} ${c.text}`).toBe(c.kind)
          candidates++
        }
        points++
      }
      const steps = shuffle(r, describeAsInputs(spec))
      expect(gradeDescription(spec, steps, { form: pick(r, forms) }).verdict, explicitFormula(spec)).toBe('correct')
    }
    expect(points).toBeGreaterThan(1200)
    expect(candidates).toBeGreaterThan(5000)
  }, 120_000)

  it('100 specs: every form of g grades correct and every equation mistake grades as its own kind', () => {
    const r = mulberry32(0x7ab5)
    let n = 0
    for (let i = 0; i < 100; i++) {
      const spec = randomSpec(r)
      const forms = [explicitFormula(spec), explicitFormula(spec, 'unfactored')]
      if (spec.parent === 'square' || spec.parent === 'cube') forms.push(expanded(spec))
      for (const f of forms) expect(gradeEquation(spec, f).verdict, `${explicitFormula(spec)} as ${f}`).toBe('correct')
      for (const c of equationMistakes(spec)!) {
        const g = gradeEquation(spec, c.text)
        expect(g.verdict === 'mistake' && g.mistake, `${explicitFormula(spec)}: ${c.kind} ${c.text}`).toBe(c.kind)
        n++
      }
    }
    expect(n).toBeGreaterThan(400)
  }, 120_000)

  it('300 piecewise functions: the value comes from the piece whose interval contains x', () => {
    const r = mulberry32(0xbeef)
    const formula = (): string => {
      if (r() < 0.3) return `${pick(r, ['', '-', '2', '1/2'])}abs(${pick(r, ['x', '2x', '-x'])} ${pick(r, ['+', '-'])} ${int(r, 0, 5)})${pick(r, ['', ' + 1', ' - 3'])}`
      const c = [int(r, -3, 3), int(r, -4, 4), int(r, -5, 5)]
      const q = polyTrim([rat(c[2]!), rat(c[1]!), rat(c[0]!)])
      return q.length ? polyToText(q) : '0'
    }
    let defined = 0
    let undefinedCount = 0
    for (let i = 0; i < 300; i++) {
      // Sorted breakpoints (multiples of 1/2, so the float oracle compares exactly).
      const count = int(r, 2, 4)
      const cuts: number[] = []
      let at = int(r, -8, -2) / 2
      for (let j = 0; j < count - 1; j++) {
        cuts.push(at)
        at += int(r, 1, 6) / 2
      }
      const pieces: PiecewisePiece[] = []
      for (let j = 0; j < count; j++) {
        const lo = j === 0 ? '-inf' : cuts[j - 1]!
        const hi = j === count - 1 ? 'inf' : cuts[j]!
        // At a shared cut the left piece may take it, the right piece may take it, or neither (a hole).
        const interval: Piece = {
          lo: lo === '-inf' ? '-inf' : rat(lo * 2, 2),
          hi: hi === 'inf' ? 'inf' : rat(hi * 2, 2),
          loClosed: false,
          hiClosed: false,
        }
        pieces.push({ formula: formula(), interval })
      }
      for (let j = 0; j < cuts.length; j++) {
        const who = int(r, 0, 2)
        if (who === 0) pieces[j]!.interval.hiClosed = true
        else if (who === 1) pieces[j + 1]!.interval.loClosed = true
      }
      const xs = [...cuts, ...cuts.map((c) => c + 0.5), ...cuts.map((c) => c - 0.5), int(r, -20, 20) / 2]
      for (const x of xs) {
        const t = rat(Math.round(x * 2), 2)
        const inside = (p: Piece) =>
          (p.lo === '-inf' || (p.loClosed ? x >= ratToNumber(p.lo as Rational) : x > ratToNumber(p.lo as Rational))) &&
          (p.hi === 'inf' || (p.hiClosed ? x <= ratToNumber(p.hi as Rational) : x < ratToNumber(p.hi as Rational)))
        const oracle = pieces.findIndex((p) => inside(p.interval))
        const ev = evaluatePiecewise(pieces, t)
        expect(ev, JSON.stringify({ pieces: pieces.map((p) => p.formula), x })).not.toBeNull()
        if (oracle < 0) {
          expect(ev!.defined).toBe(false)
          expect(gradePiecewiseValue(pieces, t, 'undefined').verdict).toBe('correct')
          undefinedCount++
          continue
        }
        expect(ev!.defined && ev!.pieceIndex).toBe(oracle)
        const float = evalNode(node(pieces[oracle]!.formula), { x })
        expect(ev!.defined && Math.abs(ratToNumber(ev!.value) - (float as number)) < 1e-9).toBe(true)
        expect(gradePiecewiseValue(pieces, t, ev!.defined ? ratToString(ev!.value) : '').verdict).toBe('correct')
        defined++
      }
    }
    expect(defined).toBeGreaterThan(1000)
    expect(undefinedCount).toBeGreaterThan(50)
  }, 120_000)

  it('200 average rates: exact against a float oracle, candidates grade as their own kind', () => {
    const r = mulberry32(0x5eed)
    let n = 0
    for (let i = 0; i < 200; i++) {
      const c = [int(r, -3, 3), int(r, -4, 4), int(r, -5, 5), int(r, -2, 2)]
      const p: Poly = polyTrim([rat(c[3]!), rat(c[2]!), rat(c[1]!), rat(c[0]!)])
      const f = polyToText(p.length ? p : [rat(1)])
      const a = ratIn(r, -5, 5)
      let b = ratIn(r, -5, 5)
      if (a.n * b.d === b.n * a.d) b = rat(b.n + b.d, b.d)
      const ar = averageRateOfChange(f, a, b)!
      expect(ar, `${f} on [${ratToString(a)}, ${ratToString(b)}]`).not.toBeNull()
      const g = node(f)
      const fa = evalNode(g, { x: ratToNumber(a) }) as number
      const fb = evalNode(g, { x: ratToNumber(b) }) as number
      expect(Math.abs(ratToNumber(ar.rate) - (fb - fa) / (ratToNumber(b) - ratToNumber(a)))).toBeLessThan(1e-6)
      expect(gradeAverageRate(f, a, b, ar.text).verdict).toBe('correct')
      for (const cand of averageRateMistakes(f, a, b)!) {
        const gr = gradeAverageRate(f, a, b, cand.text)
        expect(gr.verdict === 'mistake' && gr.mistake).toBe(cand.kind)
        n++
      }
    }
    expect(n).toBeGreaterThan(400)
  }, 120_000)
})
