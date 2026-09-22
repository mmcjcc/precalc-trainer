/**
 * Seeded property loops over generated Unit 1 functions.
 *
 * For every generated function: the exact domain agrees with a float evaluation of the formula away
 * from the boundary points and with exact evaluation AT them; the canonical answer (as a set, as
 * interval text and as set-builder text) grades correct; every mistake candidate differs from the
 * answer and grades as its own mistake. Ranges: sampled outputs lie in the range and the answer grades
 * correct. Compositions: the composite domain agrees with a float evaluation of f(g(x)) and with the
 * restriction walk of the unsimplified formula; both composition texts grade correct; every formula
 * candidate grades as a mistake; (f o g)(a) matches floats and is undefined exactly off the domain.
 */
import { describe, expect, it } from 'vitest'
import { rat, setContains, setCriticalValues, setsEqual } from '@/notation'
import type { Rational, SolutionSet } from '@/shared/types'
import { evalNode } from '../math'
import { parseExpression } from '../parse'
import { mulberry32 } from '../samples'
import { compositeDomain, compositeValue, compositionMistakes, composeText, gradeComposition, gradeCompositeDomain, gradeCompositeValue } from './compose'
import { domainMistakes, domainOf, gradeDomain } from './domain'
import { exactEval } from './exact'
import { linearFactorText, polyMul, polyToText, type Poly } from './poly'
import { gradeRange, rangeMistakes, rangeOf } from './range'

type Rand = () => number

function int(r: Rand, lo: number, hi: number, nonzero = false): number {
  for (;;) {
    const v = lo + Math.floor(r() * (hi - lo + 1))
    if (!nonzero || v !== 0) return v
  }
}

function pick<T>(r: Rand, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!
}

/** A nonzero rational, mostly an integer, sometimes a half. */
function coef(r: Rand, lo = -5, hi = 5): Rational {
  const n = int(r, lo, hi, true)
  return r() < 0.2 ? rat(n, 2) : rat(n)
}

function lin(r: Rand): string {
  const a = coef(r, -4, 4)
  const b = rat(int(r, -6, 6))
  return polyToText([b, a])
}

function quadFromRoots(r: Rand, sign: number): string {
  const r1 = int(r, -5, 5)
  let r2 = int(r, -5, 5)
  if (r2 === r1) r2 = r1 + 2
  const p: Poly = polyMul([rat(-r1), rat(1)], [rat(-r2), rat(1)]).map((c) => rat(c.n * sign, c.d))
  return polyToText(p)
}

function num(r: Rand): string {
  const c = coef(r)
  return c.d === 1 ? `${c.n}` : `(${c.n}/${c.d})`
}

function shift(r: Rand): string {
  const d = int(r, -6, 6)
  return d === 0 ? '' : d > 0 ? ` + ${d}` : ` - ${-d}`
}

/** Functions whose domain the core must find. */
function domainFunction(r: Rand): string {
  const k = int(r, 0, 13)
  switch (k) {
    case 0:
      return `${num(r)}/(${lin(r)})${shift(r)}`
    case 1:
      return `(${lin(r)})/(${quadFromRoots(r, 1)})`
    case 2:
      return `1/(${quadFromRoots(r, pick(r, [1, -1]))})`
    case 3:
      return `${num(r)}sqrt(${lin(r)})${shift(r)}`
    case 4:
      return `sqrt(${quadFromRoots(r, pick(r, [1, -1]))})`
    case 5:
      return `${num(r)}/sqrt(${lin(r)})`
    case 6:
      return pick(r, [`cbrt(${lin(r)})${shift(r)}`, `1/cbrt(${lin(r)})`])
    case 7:
      return `sqrt(${lin(r)})/(${linearFactorText(rat(int(r, -5, 5)))})`
    case 8:
      return `sqrt(${lin(r)}) + ${num(r)}/(${lin(r)})`
    case 9:
      return `sqrt(${lin(r)}) * sqrt(${lin(r)})`
    case 10:
      return polyToText([rat(int(r, -5, 5)), rat(int(r, -5, 5)), rat(int(r, -3, 3)), rat(int(r, -2, 2))])
    case 11:
      return `nthRoot(${lin(r)}, 4)`
    case 12:
      return `abs(${lin(r)}) + 1/(${lin(r)})`
    default:
      return `(x^2 + ${int(r, 1, 5)})/((${lin(r)})sqrt(${lin(r)}))`
  }
}

/** Functions from the range families. */
function rangeFunction(r: Rand): string {
  const k = int(r, 0, 6)
  switch (k) {
    case 0:
      return polyToText([rat(int(r, -5, 5)), coef(r)])
    case 1:
      return polyToText([rat(int(r, -5, 5)), rat(int(r, -6, 6)), coef(r, -3, 3)])
    case 2:
      return `${num(r)}sqrt(${lin(r)})${shift(r)}`
    case 3:
      return `${num(r)}abs(${lin(r)})${shift(r)}`
    case 4:
      return `${num(r)}cbrt(${lin(r)})${shift(r)}`
    case 5:
      return `${num(r)}/(${linearFactorText(rat(int(r, -5, 5)))})${shift(r)}`
    default:
      return `(${lin(r)})/(${lin(r)})`
  }
}

/** Pairs (f, g) for composition. */
function compositionPair(r: Rand): [string, string] {
  const outer = [
    () => `x^2${shift(r)}`,
    () => `${num(r)}x${shift(r)}`,
    () => `sqrt(x${shift(r)})`,
    () => `1/(${linearFactorText(rat(int(r, -4, 4)))})`,
    () => `abs(x)${shift(r)}`,
    () => `x^2 + ${num(r)}x`,
    () => `cbrt(x)`,
  ]
  const inner = [
    () => lin(r),
    () => `x^2${shift(r)}`,
    () => `sqrt(${lin(r)})`,
    () => `1/x`,
    () => `abs(x)${shift(r)}`,
    () => `${num(r)}/(${lin(r)})`,
  ]
  return [pick(r, outer)(), pick(r, inner)()]
}

function node(text: string) {
  const p = parseExpression(text.replace(/^f\(x\) = /, ''), ['x'])
  if (!p.ok) throw new Error(`generator produced unparseable ${text}`)
  return p.node
}

function farFromCuts(x: number, set: SolutionSet): boolean {
  return setCriticalValues(set).every((c) => Math.abs(x - c.n / c.d) > 1e-6)
}

describe('seeded domain properties', () => {
  it('exact domain = where the formula is defined; the answer grades correct; candidates are distinct mistakes', () => {
    let checkedCandidates = 0
    for (let seed = 1; seed <= 250; seed++) {
      const r = mulberry32(seed * 7919)
      const f = domainFunction(r)
      const d = domainOf(f)
      expect(d, `seed ${seed}: ${f}`).not.toBeNull()
      const set = d!.set
      const n = node(f)
      // Float evaluation away from the boundary points.
      for (let i = 0; i < 40; i++) {
        const x = -12 + 24 * r()
        if (!farFromCuts(x, set)) continue
        const defined = evalNode(n, { x }) !== 'undef'
        expect(defined, `seed ${seed}: ${f} at x = ${x}`).toBe(setContains(set, x))
      }
      // Exact evaluation at the boundary points themselves.
      for (const c of setCriticalValues(set)) {
        const v = exactEval(n, c)
        expect(v !== 'undef', `seed ${seed}: ${f} at x = ${c.n}/${c.d}`).toBe(setContains(set, c))
      }
      expect(gradeDomain(f, set).verdict, `${f}`).toBe('correct')
      expect(gradeDomain(f, d!.interval).verdict, `${f} ${d!.interval}`).toBe('correct')
      expect(gradeDomain(f, d!.builder).verdict, `${f} ${d!.builder}`).toBe('correct')
      for (const c of domainMistakes(f)!) {
        expect(setsEqual(c.set, set), `${f} ${c.kind}`).toBe(false)
        const g = gradeDomain(f, c.set)
        expect(g.verdict === 'mistake' && g.mistake, `${f} ${c.kind} ${c.interval}`).toBe(c.kind)
        expect(c.witness.length).toBeGreaterThan(20)
        checkedCandidates++
      }
    }
    expect(checkedCandidates).toBeGreaterThan(300)
  }, 120_000)
})

describe('seeded range properties', () => {
  it('sampled outputs lie in the range; the answer grades correct; candidates are distinct mistakes', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const r = mulberry32(seed * 104729)
      const f = rangeFunction(r)
      const rg = rangeOf(f)
      if (!rg) {
        // Only the degenerate Möbius case (a constant with a hole) may fall outside the families.
        expect(f, `seed ${seed}`).toMatch(/\)\/\(/)
        continue
      }
      const n = node(f)
      const values: number[] = []
      for (let i = 0; i < 60; i++) {
        const v = evalNode(n, { x: -15 + 30 * r() })
        if (v !== 'undef') values.push(v)
      }
      for (const v of values) {
        const inRange = setContains(rg.set, v) || setCriticalValues(rg.set).some((c) => Math.abs(v - c.n / c.d) < 1e-9)
        expect(inRange, `seed ${seed}: ${f} gave ${v}, range ${rg.interval}`).toBe(true)
      }
      expect(gradeRange(f, rg.set).verdict).toBe('correct')
      expect(gradeRange(f, rg.interval).verdict).toBe('correct')
      for (const c of rangeMistakes(f)!) {
        expect(setsEqual(c.set, rg.set)).toBe(false)
        const g = gradeRange(f, c.set)
        expect(g.verdict === 'mistake' && g.mistake, `${f} ${c.kind}`).toBe(c.kind)
      }
    }
  }, 120_000)
})

describe('seeded composition properties', () => {
  it('composite domain, texts, candidates and values agree with direct evaluation', () => {
    let hidden = 0
    let refused = 0
    for (let seed = 1; seed <= 150; seed++) {
      const r = mulberry32(seed * 15485863)
      const [f, g] = compositionPair(r)
      const cd = compositeDomain(f, g)
      if (!cd) {
        // Irrational boundary points (sqrt(x - 1) after x^2 - 1 needs x^2 >= 2): both paths must refuse.
        expect(domainOf(composeText(f, g)!.unsimplified), `seed ${seed}: f = ${f}, g = ${g}`).toBeNull()
        refused++
        continue
      }
      const set = cd.set
      const fn = node(f)
      const gn = node(g)
      for (let i = 0; i < 40; i++) {
        const x = -12 + 24 * r()
        if (!farFromCuts(x, set)) continue
        const gx = evalNode(gn, { x })
        const defined = gx !== 'undef' && evalNode(fn, { x: gx }) !== 'undef'
        expect(defined, `seed ${seed}: f = ${f}, g = ${g} at x = ${x}`).toBe(setContains(set, x))
      }
      const texts = composeText(f, g)!
      const viaFormula = domainOf(texts.unsimplified)
      expect(viaFormula && setsEqual(viaFormula.set, set), `${texts.unsimplified}`).toBe(true)
      if (cd.hidesRestriction) hidden++
      expect(gradeCompositeDomain(f, g, set).verdict).toBe('correct')
      expect(gradeComposition(f, g, texts.unsimplified).verdict, texts.unsimplified).toBe('correct')
      expect(gradeComposition(f, g, texts.simplified).verdict, texts.simplified).toBe('correct')
      for (const c of compositionMistakes(f, g)!) {
        const res = gradeComposition(f, g, c.text)
        expect(res.verdict, `f = ${f}, g = ${g}: ${c.kind} ${c.text}`).toBe('mistake')
      }
      for (const a of [-3, -1, 0, 1, 2, 4]) {
        const v = compositeValue(f, g, a)
        expect(v, `f = ${f}, g = ${g}, a = ${a}`).not.toBeNull()
        expect(v!.defined, `f = ${f}, g = ${g}, a = ${a}`).toBe(setContains(set, rat(a)))
        if (v!.defined) {
          const gx = evalNode(gn, { x: a }) as number
          const direct = evalNode(fn, { x: gx }) as number
          expect(Math.abs(v!.value.approx - direct)).toBeLessThan(1e-9 * Math.max(1, Math.abs(direct)))
          expect(gradeCompositeValue(f, g, a, v!.value.text), `f = ${f}, g = ${g}, a = ${a}, value ${v!.value.text}`).toMatchObject({ verdict: 'correct' })
        } else {
          expect(gradeCompositeValue(f, g, a, 'undefined').verdict).toBe('correct')
        }
      }
    }
    expect(hidden).toBeGreaterThan(0)
    expect(refused).toBeLessThan(15)
  }, 120_000)
})
