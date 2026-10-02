/**
 * Seeded property loops for the polynomials core. The oracle in every loop is `exactEval` on the PARSED
 * TEXT of a formula (a tree walk in exact arithmetic), which shares no code with the coefficient
 * arithmetic the core uses.
 *
 * - 300 quadratics: the vertex form and every line of the worked path evaluate to f exactly; f(h) = k;
 *   right answers grade correct; every mistake candidate differs from the right answer (or is listed as a
 *   shadow) and grades as its own kind.
 * - 300 divisions: quotient·(x − c) + remainder = f exactly; the remainder is f(c); the table's arithmetic
 *   holds column by column; candidates grade as their own kind.
 * - 200 factored polynomials: the expansion agrees with the product; zeros vanish; crosses/touches agrees
 *   with the sign of f on both sides of each zero; end behavior agrees with the sign of f far out.
 * - 200 "polynomial from zeros" problems: the answer goes through the point and vanishes at the zeros.
 * - 200 integer polynomials: every constructed rational zero is on the candidate list; every candidate
 *   graded as a zero makes f vanish exactly and no other candidate does.
 */
import { describe, expect, it } from 'vitest'
import { rat, ratAdd, ratCompare, ratMul, ratNeg, ratSub, ratToString } from '@/notation/rational'
import type { Rational } from '@/shared/types'
import { exactEval, surdRational } from '../functions/exact'
import { polyMul, polyToText, polyTrim, type Poly } from '../functions/poly'
import type { MathNode } from '../math'
import { parseExpression } from '../parse'
import { mulberry32 } from '../samples'
import { gradeRationalZeros, gradeRootCandidates, rationalRootCandidates, rootCandidateMistakes } from './roots'
import { axisMistakes, checkSquareLine, completeSquare, gradeAxisOfSymmetry, gradeVertex, gradeVertexForm, squareMistakes, vertexMistakes } from './square'
import { gradeBottomRow, gradeIsFactor, gradeQuotient, gradeRemainder, gradeSyntheticTable, quotientMistakes, remainderMistakes, syntheticDivision, syntheticMistakes } from './synthetic'
import type { PolyGrade, PolyMistakeKind, SquareLineGrade } from './types'
import {
  analyzeFactored,
  endBehaviorMistakes,
  factoredFormText,
  gradeCrossTouch,
  gradeEndBehavior,
  gradePolynomialFromZeros,
  gradeYIntercept,
  gradeZeros,
  makeFactored,
  polynomialFromZeros,
  polynomialFromZerosMistakes,
  yInterceptMistakes,
  zeroMistakes,
} from './zeros'

type Rand = () => number

function int(r: Rand, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1))
}

function pick<T>(r: Rand, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!
}

/** Mostly integers, sometimes halves or thirds. */
function ratIn(r: Rand, lo: number, hi: number, nonzero = false): Rational {
  const den = r() < 0.7 ? 1 : r() < 0.6 ? 2 : 3
  for (;;) {
    const n = int(r, lo * den, hi * den)
    if (!nonzero || n !== 0) return rat(n, den)
  }
}

const NODES = new Map<string, MathNode>()

function nodeOf(text: string): MathNode {
  let n = NODES.get(text)
  if (!n) {
    const p = parseExpression(text, ['x'])
    if (!p.ok) throw new Error(`does not parse: ${text}`)
    n = p.node
    NODES.set(text, n)
  }
  return n
}

/** The exact value of a formula's text at x, by walking its parse tree. */
function at(text: string, x: Rational): Rational {
  const v = exactEval(nodeOf(text), x)
  if (v === 'undef') throw new Error(`undefined: ${text} at ${ratToString(x)}`)
  const out = surdRational(v)
  if (!out) throw new Error(`not rational: ${text}`)
  return out
}

const PROBES = [rat(0), rat(1), rat(-1), rat(2), rat(-3), rat(5), rat(1, 2), rat(-7, 3), rat(10), rat(-11)]

/** Two formulas with the same exact value at ten points (more than the degree of anything here). */
function sameFunction(a: string, b: string): boolean {
  return PROBES.every((x) => ratCompare(at(a, x), at(b, x)) === 0)
}

function kindOf(g: PolyGrade | SquareLineGrade): PolyMistakeKind | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

function sign(r: Rational): number {
  return r.n > 0 ? 1 : r.n < 0 ? -1 : 0
}

describe('polynomials — seeded properties', () => {
  it('300 quadratics: expanding the vertex form gives back f exactly; candidates grade as their own kind', () => {
    const r = mulberry32(20261001)
    let candidates = 0
    let shadows = 0
    for (let i = 0; i < 300; i++) {
      const a = ratIn(r, -4, 4, true)
      const b = ratIn(r, -12, 12)
      const c = ratIn(r, -15, 15)
      const fText = polyToText(polyTrim([c, b, a]))
      const m = completeSquare(fText)!
      expect(m, fText).not.toBeNull()
      expect(sameFunction(m.vertexForm, fText), `${fText} → ${m.vertexForm}`).toBe(true)
      for (const line of m.path) expect(sameFunction(line.text, fText), `${fText}: ${line.text}`).toBe(true)
      // The vertex is on the graph and f is symmetric about the axis.
      expect(ratCompare(at(fText, m.h), m.k), fText).toBe(0)
      expect(ratCompare(at(fText, ratAdd(m.h, rat(3))), at(fText, ratSub(m.h, rat(3)))), fText).toBe(0)
      expect(sign(ratSub(at(fText, ratAdd(m.h, rat(1))), m.k))).toBe(m.opens === 'up' ? 1 : -1)

      expect(gradeVertexForm(fText, m.vertexForm).verdict, fText).toBe('correct')
      expect(gradeVertex(fText, m.vertexText).verdict, fText).toBe('correct')
      expect(gradeAxisOfSymmetry(fText, m.axisText).verdict, fText).toBe('correct')
      for (const line of m.path) expect(checkSquareLine(fText, line.text).verdict, `${fText}: ${line.text}`).toBe('correct')

      // Every listed candidate is a different parabola from f and from the other candidates (the triples
      // (a, h, k) are compared exactly; one parabola has one triple).
      const forms = squareMistakes(fText)!
      const triple = (t: { a: Rational; h: Rational; k: Rational }) => `${ratToString(t.a)}|${ratToString(t.h)}|${ratToString(t.k)}`
      const triples = forms.map(triple)
      expect(triples.includes(triple(m)), fText).toBe(false)
      expect(new Set(triples).size, fText).toBe(triples.length)
      shadows += forms.reduce((s, k) => s + k.shadows.length, 0)
      // Grading every candidate parses a formula each time: done for the first 100 problems.
      if (i >= 100) continue
      for (const k of forms) {
        expect(sameFunction(k.text, fText), `${fText}: ${k.kind} ${k.text}`).toBe(false)
        expect(kindOf(gradeVertexForm(fText, k.text)), `${fText}: ${k.text}`).toBe(k.kind)
        expect(kindOf(checkSquareLine(fText, k.text)), `${fText}: line ${k.text}`).toBe(k.kind)
        candidates++
      }
      for (const k of vertexMistakes(fText)!) {
        expect(k.text).not.toBe(m.vertexText)
        expect(kindOf(gradeVertex(fText, k.text)), `${fText}: ${k.text}`).toBe(k.kind)
        candidates++
      }
      for (const k of axisMistakes(fText)!) {
        expect(k.text).not.toBe(ratToString(m.h))
        expect(kindOf(gradeAxisOfSymmetry(fText, k.text)), `${fText}: ${k.text}`).toBe(k.kind)
        candidates++
      }
    }
    expect(candidates).toBeGreaterThan(1500)
    expect(shadows).toBeGreaterThan(50)
  }, 120_000)

  it('300 divisions: quotient·(x − c) + remainder = f exactly, the remainder is f(c)', () => {
    const r = mulberry32(0x5d17)
    let factors = 0
    let missing = 0
    let candidates = 0
    for (let i = 0; i < 300; i++) {
      const c = r() < 0.8 ? rat(int(r, -5, 5)) : ratIn(r, -3, 3)
      const degree = int(r, 1, 5)
      let coefs: Rational[] = []
      for (let k = 0; k <= degree; k++) coefs.push(k === 0 ? rat(pick(r, [-3, -2, -1, 1, 2, 3, 4])) : r() < 0.25 ? rat(0) : rat(int(r, -9, 9)))
      // A third of the time, a polynomial that x − c divides.
      if (r() < 0.33) {
        const q: Poly = polyTrim([...coefs].reverse())
        coefs = [...polyMul(q, [ratNeg(c), rat(1)])].reverse()
      }
      const fText = polyToText(polyTrim([...coefs].reverse()))
      const t = syntheticDivision(coefs, c)!
      const label = `(${fText}) ÷ (${t.divisor})`
      expect(t, label).not.toBeNull()
      expect(t.f).toBe(fText)
      const n = t.degree
      expect(t.coefficients.length).toBe(n + 1)
      expect(t.products.length).toBe(n)
      expect(t.bottom.length).toBe(n + 1)
      // The table's arithmetic, column by column.
      expect(ratCompare(t.bottom[0]!, t.coefficients[0]!)).toBe(0)
      for (let k = 1; k <= n; k++) {
        expect(ratCompare(t.products[k - 1]!, ratMul(t.c, t.bottom[k - 1]!)), label).toBe(0)
        expect(ratCompare(t.bottom[k]!, ratAdd(t.coefficients[k]!, t.products[k - 1]!)), label).toBe(0)
      }
      // quotient·(x − c) + remainder = f, exactly, as functions (degree ≤ 6 < 10 probes).
      const back = `(${t.quotientText})(${t.divisor}) + (${t.remainderText})`
      expect(sameFunction(back, fText), `${label}: ${back}`).toBe(true)
      // Remainder theorem and factor theorem against direct substitution.
      const fc = at(fText, c)
      expect(ratCompare(t.remainder, fc), label).toBe(0)
      expect(ratCompare(at(t.substitution, rat(0)), fc), `${label}: ${t.substitution}`).toBe(0)
      expect(t.isFactor).toBe(fc.n === 0)
      if (t.isFactor) factors++
      if (t.missingPowers.length) missing++

      expect(gradeBottomRow(coefs, c, t.rows.bottom).verdict, label).toBe('correct')
      expect(gradeSyntheticTable(fText, c, { bottom: t.rows.bottom.join(', '), products: t.rows.products, box: ratToString(t.c) }).verdict, label).toBe('correct')
      expect(gradeQuotient(fText, c, t.quotientText).verdict, label).toBe('correct')
      expect(gradeRemainder(fText, c, t.remainderText).verdict, label).toBe('correct')
      expect(gradeIsFactor(fText, c, t.isFactor ? 'yes' : 'no').verdict, label).toBe('correct')
      expect(gradeIsFactor(fText, c, !t.isFactor).verdict, label).not.toBe('correct')

      const rightRow = t.rows.bottom.join(', ')
      if (i >= 150) continue
      for (const k of syntheticMistakes(fText, c)!) {
        expect(k.text, label).not.toBe(rightRow)
        expect(kindOf(gradeBottomRow(fText, c, k.text)), `${label}: ${k.text}`).toBe(k.kind)
        // The whole table of the slip is consistent with the slip's own rule.
        expect(k.products.length).toBe(k.bottom.length - 1)
        candidates++
      }
      for (const k of quotientMistakes(fText, c)!) {
        expect(sameFunction(k.text, t.quotientText), `${label}: ${k.text}`).toBe(false)
        expect(kindOf(gradeQuotient(fText, c, k.text)), `${label}: ${k.text}`).toBe(k.kind)
        candidates++
      }
      for (const k of remainderMistakes(fText, c)!) {
        expect(k.text, label).not.toBe(t.remainderText)
        expect(kindOf(gradeRemainder(fText, c, k.text)), `${label}: ${k.text}`).toBe(k.kind)
        candidates++
      }
    }
    expect(factors).toBeGreaterThan(80)
    expect(missing).toBeGreaterThan(80)
    expect(candidates).toBeGreaterThan(1200)
  }, 120_000)

  it('200 factored polynomials: zeros, crosses or touches, end behavior and y-intercept against the signs of f', () => {
    const r = mulberry32(0xface)
    let touches = 0
    let nonMonic = 0
    let named = 0
    for (let i = 0; i < 200; i++) {
      // At most three zeros and degree 6 (the size of the unit's problems; exact values stay in range).
      const count = int(r, 1, 3)
      let budget = 6
      const zeros: Rational[] = []
      while (zeros.length < count) {
        const z = ratIn(r, -5, 5)
        if (!zeros.some((o) => ratCompare(o, z) === 0)) zeros.push(z)
      }
      const lead = pick(r, [rat(1), rat(-1), rat(2), rat(-2), rat(3), rat(1, 2), rat(-1, 3)])
      const fp = makeFactored(
        lead,
        zeros.map((z) => {
          const mult = Math.min(pick(r, [1, 1, 1, 2, 2, 3]), budget - (count - 1))
          budget -= mult - 1
          // Sometimes written with integer coefficients: (2x − 1) for the zero 1/2, or (3 − x) for 3.
          if (z.d !== 1 && r() < 0.6) return { coef: z.d, constant: -z.n, mult }
          if (z.d === 1 && z.n !== 0 && r() < 0.1) return { coef: -1, constant: z.n, mult }
          return { zero: z, mult }
        }),
      )
      const text = factoredFormText(fp)
      const a = analyzeFactored(text)!
      expect(a, text).not.toBeNull()
      expect(factoredFormText(a.factored)).toBe(text)
      expect(sameFunction(a.expandedText, text), `${text} → ${a.expandedText}`).toBe(true)
      expect(a.degree).toBe(fp.factors.reduce((s, f) => s + f.mult, 0))
      expect(ratCompare(a.yIntercept, at(text, rat(0))), text).toBe(0)
      if (fp.factors.some((f) => f.coef.n !== 1 || f.coef.d !== 1)) nonMonic++

      for (const z of a.zeros) {
        expect(at(text, z.zero).n, `${text} at ${z.text}`).toBe(0)
        // Other zeros are at least 1/6 away, so 1/8 on either side stays between zeros.
        const left = sign(at(text, ratSub(z.zero, rat(1, 8))))
        const right = sign(at(text, ratAdd(z.zero, rat(1, 8))))
        expect(left !== 0 && right !== 0).toBe(true)
        expect(z.behavior, `${text} at ${z.text}`).toBe(left === right ? 'touches' : 'crosses')
        if (z.behavior === 'touches') touches++
      }
      // Every zero is within 5 of the origin, so the sign at ±10 is the end behavior.
      expect(a.end.right).toBe(sign(at(text, rat(10))) > 0 ? 'up' : 'down')
      expect(a.end.left).toBe(sign(at(text, rat(-10))) > 0 ? 'up' : 'down')
      // The leading coefficient is the limit of f(x)/x^degree: compare with the expansion's first term.
      expect(a.expandedText.startsWith('-')).toBe(a.leadingCoefficient.n < 0)

      expect(gradeZeros(text, a.zeros.map((z) => z.text).join(', ')).verdict, text).toBe('correct')
      expect(gradeZeros(text, a.zeros.map((z) => ({ zero: z.text, mult: z.mult }))).verdict, text).toBe('correct')
      expect(gradeCrossTouch(text, a.zeros.map((z) => z.behavior)).verdict, text).toBe('correct')
      expect(gradeEndBehavior(text, a.end).verdict, text).toBe('correct')
      expect(gradeEndBehavior(a.expandedText, a.end).verdict, text).toBe('correct')
      expect(gradeYIntercept(text, ratToString(a.yIntercept)).verdict, text).toBe('correct')

      for (const k of zeroMistakes(text)!) {
        expect(at(text, k.wrong).n, `${text}: ${k.text} is a zero after all`).not.toBe(0)
        const list = a.zeros.map((z) => (ratCompare(z.zero, k.zero) === 0 ? k.text : z.text)).join(', ')
        expect(kindOf(gradeZeros(text, list)), `${text}: ${list}`).toBe(k.kind)
        named++
      }
      for (const k of endBehaviorMistakes(text)!) {
        expect(k.end).not.toEqual(a.end)
        expect(kindOf(gradeEndBehavior(text, k.end)), text).toBe(k.kind)
        named++
      }
      for (const k of yInterceptMistakes(text)!) {
        expect(ratCompare(k.value, a.yIntercept)).not.toBe(0)
        expect(kindOf(gradeYIntercept(text, k.text)), `${text}: ${k.text}`).toBe(k.kind)
        named++
      }
      // Flipping every choice is the swap, wherever it lands.
      const swapped = a.zeros.map((z) => (z.behavior === 'crosses' ? 'touches' : 'crosses'))
      expect(kindOf(gradeCrossTouch(text, swapped)), text).toBe('cross_touch_swapped')
    }
    expect(touches).toBeGreaterThan(80)
    expect(nonMonic).toBeGreaterThan(40)
    expect(named).toBeGreaterThan(700)
  }, 120_000)

  it('200 polynomials from zeros: through the point, zero at the zeros, candidates named', () => {
    const r = mulberry32(0xbead)
    let named = 0
    for (let i = 0; i < 200; i++) {
      const count = int(r, 1, 3)
      const zeros: { zero: Rational; mult: number }[] = []
      while (zeros.length < count) {
        const z = r() < 0.85 ? rat(int(r, -5, 5)) : rat(pick(r, [1, -1, 3, -3]), 2)
        if (!zeros.some((o) => ratCompare(o.zero, z) === 0)) zeros.push({ zero: z, mult: pick(r, [1, 1, 2, 3]) })
      }
      let x0 = rat(int(r, -4, 4))
      while (zeros.some((o) => ratCompare(o.zero, x0) === 0)) x0 = ratAdd(x0, rat(1))
      // y0 chosen so that a is a "nice" number: a times the product at x0.
      const aWanted = pick(r, [rat(2), rat(-1), rat(3), rat(-2), rat(1, 2), rat(-3), rat(1)])
      const body = factoredFormText(makeFactored(1, zeros))
      const y0 = ratMul(aWanted, at(body, x0))
      const spec = { zeros, point: { x: x0, y: y0 } }
      const b = polynomialFromZeros(spec)!
      const label = `zeros ${zeros.map((z) => `${ratToString(z.zero)}^${z.mult}`).join(' ')} through (${ratToString(x0)}, ${ratToString(y0)})`
      expect(b, label).not.toBeNull()
      expect(ratCompare(b.a, aWanted), label).toBe(0)
      expect(ratCompare(at(b.text, x0), y0), label).toBe(0)
      for (const z of zeros) expect(at(b.text, z.zero).n, label).toBe(0)
      expect(sameFunction(b.text, b.expandedText), label).toBe(true)
      expect(b.degree).toBe(zeros.reduce((s, z) => s + z.mult, 0))
      expect(gradePolynomialFromZeros(spec, b.text).verdict, label).toBe('correct')
      expect(gradePolynomialFromZeros(spec, b.expandedText).verdict, label).toBe('correct')
      // Without the point, any multiple is right.
      expect(gradePolynomialFromZeros({ zeros }, b.text).verdict, label).toBe('correct')
      expect(gradePolynomialFromZeros({ zeros }, body).verdict, label).toBe('correct')
      for (const k of polynomialFromZerosMistakes(spec)!) {
        expect(sameFunction(k.text, b.text), `${label}: ${k.text}`).toBe(false)
        expect(kindOf(gradePolynomialFromZeros(spec, k.text)), `${label}: ${k.kind} ${k.text}`).toBe(k.kind)
        named++
      }
    }
    expect(named).toBeGreaterThan(350)
  }, 120_000)

  it('200 integer polynomials: every rational zero is a candidate, and a candidate is a zero exactly when f vanishes there', () => {
    const r = mulberry32(0x4007)
    let withZeros = 0
    let named = 0
    for (let i = 0; i < 200; i++) {
      // A product of (q·x − p) factors with p ≠ 0, times an irreducible quadratic half the time.
      const built: Rational[] = []
      let p: Poly = [rat(pick(r, [1, 1, -1, 2]))]
      const k = int(r, 0, 3)
      for (let j = 0; j < k; j++) {
        const q = pick(r, [1, 1, 1, 2, 3])
        const top = pick(r, [-4, -3, -2, -1, 1, 2, 3, 5])
        p = polyMul(p, [rat(-top), rat(q)])
        built.push(rat(top, q))
      }
      if (r() < 0.5 || k === 0) p = polyMul(p, [rat(pick(r, [1, 2, 3, 5])), rat(pick(r, [0, 1, -1])), rat(1)])
      const fText = polyToText(p)
      const m = rationalRootCandidates(fText)!
      expect(m, fText).not.toBeNull()
      const onList = (z: Rational) => m.candidates.some((c) => ratCompare(c, z) === 0)
      for (const z of built) {
        expect(onList(z), `${fText}: ${ratToString(z)} is a zero but not a candidate`).toBe(true)
        expect(m.zeros.some((c) => ratCompare(c, z) === 0), `${fText}: ${ratToString(z)}`).toBe(true)
      }
      // p/q with p | a0 and q | an, in lowest terms, both signs, no repeats.
      for (const c of m.candidates) {
        expect(Math.abs(m.constant % c.n), fText).toBe(0)
        expect(Math.abs(m.leading % c.d), fText).toBe(0)
        expect(onList(ratNeg(c))).toBe(true)
      }
      expect(new Set(m.candidates.map(ratToString)).size).toBe(m.candidates.length)
      // A candidate is listed as a zero exactly when f vanishes there (independent evaluation).
      for (let j = 0; j < m.candidates.length; j++) {
        const c = m.candidates[j]!
        const zero = at(fText, c).n === 0
        expect(m.zeros.some((z) => ratCompare(z, c) === 0), `${fText} at ${ratToString(c)}`).toBe(zero)
        // The grader agrees (checked for the zeros and a spread of the other candidates).
        if (!zero && j % 4 !== i % 4) continue
        const alone = gradeRationalZeros(fText, m.zeros.length ? [...m.zeros.map(ratToString), ratToString(c)].join(', ') : ratToString(c))
        expect(alone.verdict === 'correct', `${fText}: adding ${ratToString(c)}`).toBe(zero)
      }
      if (m.zeros.length) withZeros++
      expect(gradeRootCandidates(fText, m.text).verdict, fText).toBe('correct')
      expect(gradeRationalZeros(fText, m.zeros.length ? m.zeros.map(ratToString).join(', ') : 'none').verdict, fText).toBe('correct')
      const right = m.candidates.map(ratToString).join(', ')
      for (const c of rootCandidateMistakes(fText)!) {
        expect(c.text, fText).not.toBe(right)
        expect(kindOf(gradeRootCandidates(fText, c.text)), `${fText}: ${c.text}`).toBe(c.kind)
        named++
      }
    }
    expect(withZeros).toBeGreaterThan(120)
    expect(named).toBeGreaterThan(600)
  }, 120_000)
})
