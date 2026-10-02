/**
 * Completing the square: f(x) = ax^2 + bx + c (rational coefficients, a ≠ 0) → a(x − h)^2 + k.
 *
 * `completeSquare` gives the vertex form, vertex, axis of symmetry and a canonical worked path: factor a
 * from the x-terms, add and subtract (b/(2a))^2 inside, write the square, distribute, combine. Every line
 * of the path is an expression equal to f(x), so the existing step checker (`verifyRewrite`) accepts each
 * consecutive pair.
 *
 * Grading is exact: her formula is multiplied out to rational coefficients and compared with f's. A
 * mistake is named by comparing with what each slip WOULD produce:
 *  - cs_no_factor_a:         halved b without factoring a out first          2(x − 6)^2 − 23
 *  - cs_unbalanced:          added the square and never took it away         2(x − 3)^2 + 13
 *  - cs_constant_not_scaled: took it away without multiplying by a           2(x − 3)^2 + 4
 *  - cs_half_or_square:      b^2/2 for (b/2)^2, or did not halve             2(x − 3)^2 − 23, 2(x − 6)^2 − 5
 *  - cs_h_sign:              the sign inside the square / of h backwards     2(x + 3)^2 − 5, vertex (−3, −5)
 *  - cs_vertex_swapped:      vertex given as (k, h)                          (−5, 3)
 * (samples for f(x) = 2x^2 − 12x + 13 = 2(x − 3)^2 − 5).
 */
import type { Rational } from '@/shared/types'
import { rat, ratAdd, ratCompare, ratDiv, ratMul, ratNeg, ratSub } from '@/notation/rational'
import { collectVars, isOp, isUnaryMinus, nodeArgs, substituteVars, type MathNode } from '../math'
import { parseExpression } from '../parse'
import { exactConstant } from '../functions/exact'
import { polyDeg, polyEquals, polyLead, polyOf, polyScale, polySub, polyTrim, type Poly } from '../functions/poly'
import { parsePointAnswer } from '../transformations/points'
import { coefPrefix, isOne, pointPretty, pointText, rf, rp, rt, signedTerm } from '../transformations/text'
import type { ExactPoint } from '../transformations/types'
import {
  checked,
  dedupeCandidates,
  guard,
  invalidParse,
  minusText,
  plain,
  polyPretty,
  pretty,
  readFormula,
  readNumber,
  readPoly,
  same,
  valueAt,
  xTerm,
} from './common'
import type {
  CompletedSquare,
  NumberMistakeCandidate,
  PointValueCandidate,
  PolyGrade,
  PolyInput,
  PolyMistakeKind,
  SquareLine,
  SquareLineGrade,
  SquareMistakeCandidate,
  SquareStep,
} from './types'

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** "(x - 3)^2", "(x + 3/2)^2", "x^2": the square (x + half)^2 in app syntax. */
function squareText(half: Rational): string {
  return half.n === 0 ? 'x^2' : `(x${signedTerm(half)})^2`
}

/** a(x − h)^2 + k in app syntax: "2(x - 3)^2 - 5", "-(x + 1)^2", "(1/2)x^2 + 3". */
export function vertexFormText(a: Rational, h: Rational, k: Rational): string {
  return `${coefPrefix(a)}${squareText(ratNeg(h))}${signedTerm(k)}`
}

/** a(x − h)^2 + k multiplied out. */
function tripleToPoly(a: Rational, h: Rational, k: Rational): Poly {
  return polyTrim([ratAdd(ratMul(a, ratMul(h, h)), k), ratMul(rat(-2), ratMul(a, h)), a])
}

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

interface Model extends CompletedSquare {
  poly: Poly
}

function build(f: PolyInput): Model | null {
  const src = readPoly(f)
  if (!src || polyDeg(src.poly) !== 2) return null
  return guard(() => {
    const [c, b, a] = [src.poly[0]!, src.poly[1]!, src.poly[2]!]
    const B = ratDiv(b, a)
    const half = ratDiv(B, rat(2))
    const square = ratMul(half, half)
    const aSq = ratMul(a, square)
    const h = ratNeg(half)
    const k = ratSub(c, aSq)
    const A = coefPrefix(a)
    const one = isOne(a)
    const sqr = squareText(half)
    const inner = `x^2${xTerm(B)}`
    const vertexForm = vertexFormText(a, h, k)

    const path: SquareLine[] = []
    const push = (step: SquareStep, text: string, reason: string): void => {
      if (path.length && path[path.length - 1]!.text === text) return
      path.push({ step, text, reason })
    }
    push('start', src.text, 'Start with f(x) in standard form.')
    if (b.n !== 0) {
      if (!one) {
        push(
          'factor',
          `${A}(${inner})${signedTerm(c)}`,
          `Factor ${rp(a)} out of the x-terms only: ${pretty(`${coefPrefix(a)}x^2${xTerm(b)}`)} = ${pretty(`${A}(${inner})`)}.${c.n !== 0 ? ` The constant ${rp(c)} stays outside.` : ''}`,
        )
      }
      const addSub = `${inner} + ${rt(square)} - ${rt(square)}`
      push(
        'add_subtract',
        one ? `${addSub}${signedTerm(c)}` : `${A}(${addSub})${signedTerm(c)}`,
        `Half of ${rp(B)} is ${rp(half)}, and ${rf(half)}^2 = ${rp(square)}. Add ${rp(square)}${one ? '' : ' inside the parentheses'} to make a perfect square, and subtract it again so the value does not change.`,
      )
      push(
        'square',
        one ? `${sqr} - ${rt(square)}${signedTerm(c)}` : `${A}(${sqr} - ${rt(square)})${signedTerm(c)}`,
        `${pretty(`${inner} + ${rt(square)}`)} is a perfect square: ${pretty(sqr)}.`,
      )
      if (!one) {
        push(
          'distribute',
          `${A}${sqr}${signedTerm(ratNeg(aSq))}${signedTerm(c)}`,
          `Multiply the ${rp(a)} back through: ${rf(a)}·${rf(ratNeg(square))} = ${rp(ratNeg(aSq))}.`,
        )
      }
      push('combine', vertexForm, `Combine the constants: ${minusText(c, aSq)} = ${rp(k)}.`)
    }

    const vertex: ExactPoint = { x: h, y: k }
    const opens = a.n > 0 ? 'up' : 'down'
    const explanation = [
      ...path.slice(1).map((l) => l.reason),
      b.n === 0
        ? `f(x) = ${pretty(vertexForm)} is already in vertex form (there is no x term), with h = 0.`
        : `Vertex form: f(x) = ${pretty(vertexForm)}.`,
      `The vertex is (h, k) = ${pointPretty(vertex)} and the axis of symmetry is x = ${rp(h)}. (The sign inside the square is opposite to h.)`,
      `a = ${rp(a)} is ${a.n > 0 ? 'positive' : 'negative'}, so the parabola opens ${opens} and ${rp(k)} is the ${a.n > 0 ? 'minimum' : 'maximum'} value.`,
    ]
    return {
      poly: src.poly,
      f: src.text,
      a,
      b,
      c,
      h,
      k,
      half,
      square,
      vertexForm,
      vertex,
      vertexText: pointText(vertex),
      axis: h,
      axisText: `x = ${rt(h)}`,
      opens,
      extremum: { kind: a.n > 0 ? 'minimum' : 'maximum', value: k },
      path,
      explanation,
    }
  })
}

function publicModel(m: Model): CompletedSquare {
  const { poly: _poly, ...rest } = m
  void _poly
  return rest
}

/**
 * Vertex form, vertex, axis of symmetry and the canonical worked path of f(x) = ax^2 + bx + c.
 * Null when f is not a quadratic with rational coefficients.
 */
export function completeSquare(f: PolyInput): CompletedSquare | null {
  const m = build(f)
  return m ? publicModel(m) : null
}

const NOT_QUADRATIC = 'This problem needs a quadratic ax^2 + bx + c with a ≠ 0 and rational coefficients.'

// ---------------------------------------------------------------------------
// Is a formula written in vertex form?
// ---------------------------------------------------------------------------

function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

function hasX(node: MathNode): boolean {
  return collectVars(node).includes('x')
}

function sumTerms(node: MathNode, out: MathNode[]): void {
  const n = unwrap(node)
  const args = nodeArgs(n)
  if (args.length === 2 && (isOp(n, '+') || isOp(n, '-'))) {
    sumTerms(args[0]!, out)
    sumTerms(args[1]!, out)
  } else out.push(n)
}

/** `term` is (constant factors) × (x − h)^2: one squared monic binomial, nothing else with x in it. */
function isScaledSquare(term: MathNode): boolean {
  const n = unwrap(term)
  const args = nodeArgs(n)
  if (isUnaryMinus(n)) return isScaledSquare(args[0]!)
  if (isOp(n, '*') && args.length === 2) {
    const [l, r] = [args[0]!, args[1]!]
    if (hasX(l) === hasX(r)) return false
    return isScaledSquare(hasX(l) ? l : r)
  }
  if (isOp(n, '/') && args.length === 2) return !hasX(args[1]!) && isScaledSquare(args[0]!)
  if (isOp(n, '^') && args.length === 2) {
    if (hasX(args[1]!)) return false
    const e = guard(() => exactConstant(args[1]!))
    if (!e || e.n !== 2 || e.d !== 1) return false
    const base = guard(() => polyOf(args[0]!))
    return !!base && polyDeg(base) === 1 && isOne(polyLead(base))
  }
  return false
}

/**
 * Is this formula written as a(x − h)^2 + k: one squared binomial x − h (x alone when h = 0) times a
 * number, plus at most one constant? "2(x - 3)^2 - 5", "-5 + 2(x - 3)^2", "(x + 1)^2", "(x - 3)^2/2 + 1" are;
 * "2x^2 - 12x + 13", "2(x - 3)^2 - 18 + 13" and "2((x - 3)^2 - 9) + 13" are not.
 */
export function isVertexForm(text: string): boolean {
  const r = readFormula(text)
  return r.ok && nodeInVertexForm(r.node)
}

function nodeInVertexForm(node: MathNode): boolean {
  const terms: MathNode[] = []
  sumTerms(node, terms)
  const withX = terms.filter(hasX)
  if (withX.length !== 1 || terms.length > 2) return false
  return isScaledSquare(withX[0]!)
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

interface RawForm {
  kind: PolyMistakeKind
  a: Rational
  h: Rational
  k: Rational
  witness: string
}

function rawForms(m: Model): RawForm[] {
  const { a, b, c, h, k, half, square } = m
  if (b.n === 0) return []
  const out: RawForm[] = []
  const one = isOne(a)
  const B = ratDiv(b, a)
  const aSq = ratMul(a, square)
  const A = rp(a)
  const sqr = pretty(squareText(half))
  const inner = pretty(`x^2${xTerm(B)}`)
  const VF = pretty(m.vertexForm)
  const push = (kind: PolyMistakeKind, a2: Rational, h2: Rational, k2: Rational, witness: (form: string) => string): void => {
    out.push({ kind, a: a2, h: h2, k: k2, witness: witness(pretty(vertexFormText(a2, h2, k2))) })
  }
  const expandSquare = (hf: Rational): string => polyPretty(tripleToPoly(rat(1), ratNeg(hf), rat(0)))

  // The sign inside the square.
  push(
    'cs_h_sign',
    a,
    ratNeg(h),
    k,
    () =>
      `${inner} + ${rp(square)} = ${sqr}: the sign inside the square is the sign of the x-term (half of ${rp(B)} is ${rp(half)}). ${pretty(squareText(ratNeg(half)))} multiplies out to ${expandSquare(ratNeg(half))}, which has the wrong middle term.`,
  )

  // Added the square, never took it away (or added it a second time).
  push('cs_unbalanced', a, h, c, () =>
    one
      ? `Adding ${rp(square)} makes the perfect square ${sqr}, but it also changes the value. Take it away again: the constant is ${minusText(c, square)} = ${rp(k)}, not ${rp(c)}.`
      : `Adding ${rp(square)} inside the parentheses makes the perfect square ${sqr}, but it also changes the value: inside ${pretty(coefPrefix(a))}( ) it is worth ${rf(a)}·${rf(square)} = ${rp(aSq)}. Take that away again: the constant is ${minusText(c, aSq)} = ${rp(k)}, not ${rp(c)}.`,
  )
  push(
    'cs_unbalanced',
    a,
    h,
    ratAdd(c, aSq),
    () =>
      `After adding ${rp(square)}${one ? '' : ' inside the parentheses'} to make ${sqr}, SUBTRACT its value to keep f(x) the same: ${minusText(c, aSq)} = ${rp(k)}. Adding it a second time gives ${rp(ratAdd(c, aSq))}.`,
  )

  if (!one) {
    // Took the square out of the parentheses without multiplying by a.
    push(
      'cs_constant_not_scaled',
      a,
      h,
      ratSub(c, square),
      () =>
        `The ${rp(square)} you added sits inside ${pretty(coefPrefix(a))}( ), so it is worth ${rf(a)}·${rf(square)} = ${rp(aSq)}. Taking it out of the parentheses changes the constant by ${rp(aSq)}, not by ${rp(square)}: ${minusText(c, aSq)} = ${rp(k)}, not ${minusText(c, square)} = ${rp(ratSub(c, square))}.`,
    )

    // Halved b itself, without factoring a out first.
    const hb = ratDiv(b, rat(2))
    const hb2 = ratMul(hb, hb)
    const lead = `Factor ${A} out of the x-terms BEFORE halving: ${pretty(`${coefPrefix(a)}x^2${xTerm(b)}`)} = ${pretty(`${coefPrefix(a)}(x^2${xTerm(B)})`)}, and half of ${rp(B)} is ${rp(half)}.`
    push('cs_no_factor_a', a, ratNeg(hb), ratSub(c, hb2), (form) => `${lead} You halved ${rp(b)} instead (${rp(hb)}), which leads to ${form}. The vertex form is ${VF}.`)
    // The same slip one step earlier: a written in front, but the x-term not divided by it, a(x^2 + bx) + c.
    push(
      'cs_no_factor_a',
      a,
      ratNeg(hb),
      ratSub(c, ratMul(a, hb2)),
      () =>
        `Factoring ${A} out of the x-terms divides BOTH of them by ${A}: ${pretty(`${coefPrefix(a)}x^2${xTerm(b)}`)} = ${pretty(`${coefPrefix(a)}(x^2${xTerm(B)})`)}, not ${pretty(`${coefPrefix(a)}(x^2${xTerm(b)})`)}. Then half of ${rp(B)} is ${rp(half)}, so the square is ${sqr} and the vertex form is ${VF}.`,
    )
    push(
      'cs_no_factor_a',
      rat(1),
      ratNeg(hb),
      ratSub(c, hb2),
      (form) =>
        `${form} multiplies out to ${pretty(`x^2${xTerm(b)}${signedTerm(c)}`)}: the ${A} in front of x^2 is gone. Factor ${A} out of the x-terms first, ${pretty(`${coefPrefix(a)}(x^2${xTerm(B)})${signedTerm(c)}`)}, then halve ${rp(B)}.`,
    )
  }

  // Halved or squared wrong.
  const B2 = ratMul(B, B)
  const halfB2 = ratDiv(B2, rat(2))
  push(
    'cs_half_or_square',
    a,
    h,
    ratSub(c, ratMul(a, halfB2)),
    () =>
      `Halve first, then square: half of ${rp(B)} is ${rp(half)}, and ${rf(half)}^2 = ${rp(square)}. You used ${rf(B)}^2/2 = ${rp(halfB2)}, which gives the constant ${rp(ratSub(c, ratMul(a, halfB2)))} instead of ${rp(k)}.`,
  )
  const noHalf = `The square uses HALF of ${rp(B)}: ${inner} + ${rp(square)} = ${sqr}. You used ${rp(B)} itself: ${pretty(squareText(B))} multiplies out to ${expandSquare(B)}, which has the wrong middle term.`
  push('cs_half_or_square', a, ratNeg(B), ratSub(c, ratMul(a, B2)), () => noHalf)
  push('cs_half_or_square', a, ratNeg(B), k, () => noHalf)
  return out
}

function sameTriple(x: { a: Rational; h: Rational; k: Rational }, y: { a: Rational; h: Rational; k: Rational }): boolean {
  return same(x.a, y.a) && same(x.h, y.h) && same(x.k, y.k)
}

function formCandidates(m: Model): SquareMistakeCandidate[] {
  const raw = rawForms(m).map((r) => ({ ...r, text: vertexFormText(r.a, r.h, r.k), shadows: [] as PolyMistakeKind[] }))
  return dedupeCandidates(raw, (r) => sameTriple(r, m), sameTriple)
}

/**
 * The vertex form each slip ends with, in priority order (see the file comment), each different from the
 * right one and from the others (`shadows`: later kinds giving the same form). Null when f is not a quadratic.
 */
export function squareMistakes(f: PolyInput): SquareMistakeCandidate[] | null {
  const m = build(f)
  return m ? formCandidates(m) : null
}

function vertexCandidates(m: Model): PointValueCandidate[] {
  const right = pointPretty(m.vertex)
  const VF = pretty(m.vertexForm)
  const raw: PointValueCandidate[] = []
  const add = (kind: PolyMistakeKind, point: ExactPoint, witness: string): void => {
    raw.push({ kind, point, text: pointText(point), witness, shadows: [] })
  }
  add(
    'cs_h_sign',
    { x: ratNeg(m.h), y: m.k },
    `In a(x − h)^2 + k the sign inside the square is opposite to h: ${VF} has the square ${pretty(squareText(m.half))}, which is 0 at x = ${rp(m.h)}. So h = ${rp(m.h)} and the vertex is ${right}, not ${pointPretty({ x: ratNeg(m.h), y: m.k })}.`,
  )
  add(
    'cs_vertex_swapped',
    { x: m.k, y: m.h },
    `The vertex is (h, k): x-coordinate first. h = ${rp(m.h)} comes from the square ${pretty(squareText(m.half))} and k = ${rp(m.k)} is the constant added after it, so the vertex is ${right}; ${pointPretty({ x: m.k, y: m.h })} has them the other way round.`,
  )
  for (const c of rawForms(m)) {
    if (c.kind === 'cs_h_sign') continue
    const pt = { x: c.h, y: c.k }
    add(c.kind, pt, `${c.witness} That is how the vertex comes out as ${pointPretty(pt)}; it is ${right}.`)
  }
  const samePt = (u: PointValueCandidate, v: PointValueCandidate) => same(u.point.x, v.point.x) && same(u.point.y, v.point.y)
  return dedupeCandidates(raw, (r) => same(r.point.x, m.h) && same(r.point.y, m.k), samePt)
}

/** The wrong vertex each slip gives, in priority order; null when f is not a quadratic. */
export function vertexMistakes(f: PolyInput): PointValueCandidate[] | null {
  const m = build(f)
  return m ? vertexCandidates(m) : null
}

function axisCandidates(m: Model): NumberMistakeCandidate[] {
  const { a, b, h } = m
  const formula = `x = −b/(2a) = ${rp(ratNeg(b))}/${rf(ratMul(rat(2), a))} = ${rp(h)}`
  const raw: NumberMistakeCandidate[] = []
  const add = (kind: PolyMistakeKind, value: Rational, witness: string): void => {
    raw.push({ kind, value, text: rt(value), witness, shadows: [] })
  }
  add(
    'cs_h_sign',
    ratNeg(h),
    `The axis of symmetry goes through the vertex: x = h. In ${pretty(m.vertexForm)} the square ${pretty(squareText(m.half))} is 0 at x = ${rp(h)}, so the axis is x = ${rp(h)} (the sign is opposite to the one inside the square). Check: ${formula}.`,
  )
  const hb = ratNeg(ratDiv(b, rat(2)))
  add('cs_no_factor_a', hb, `Divide by 2a, not by 2: ${formula}. Your ${rp(hb)} is −b/2, which leaves a = ${rp(a)} out.`)
  const nb = ratNeg(ratDiv(b, a))
  add('cs_half_or_square', nb, `Do not forget the 2 in 2a: ${formula}. Your ${rp(nb)} is −b/a.`)
  return dedupeCandidates(
    raw,
    (r) => same(r.value, h),
    (u, v) => same(u.value, v.value),
  )
}

/** The wrong axis x = … each slip gives; null when f is not a quadratic. */
export function axisMistakes(f: PolyInput): NumberMistakeCandidate[] | null {
  const m = build(f)
  return m ? axisCandidates(m) : null
}

// ---------------------------------------------------------------------------
// Plain messages
// ---------------------------------------------------------------------------

/** Which term of her multiplied-out formula differs from f, and what to check. */
function differenceNote(her: Poly, m: Model): string {
  const at = (p: Poly, i: number): Rational => p[i] ?? rat(0)
  const B = ratDiv(m.b, m.a)
  if (polyDeg(her) > 2) return `Yours has degree ${polyDeg(her)}; f(x) has degree 2.`
  if (!same(at(her, 2), m.a)) {
    return `The x^2 terms differ (yours has ${rp(at(her, 2))}, f has ${rp(m.a)}): the number in front of the square must be a = ${rp(m.a)}.`
  }
  if (!same(at(her, 1), m.b)) {
    return `The x terms differ (yours has ${rp(at(her, 1))}, f has ${rp(m.b)}): the number inside the square is half of ${rp(B)}, which is ${rp(m.half)}.`
  }
  return `The x^2 and x terms match, so the square is right. Multiplied out, the constants differ (yours is ${rp(at(her, 0))}, f has ${rp(m.c)}): k = ${minusText(m.c, ratMul(m.a, m.square))} = ${rp(m.k)}.`
}

// ---------------------------------------------------------------------------
// Graders
// ---------------------------------------------------------------------------

/**
 * Grade her vertex form of f. Correct: any formula equal to f that is written as a(x − h)^2 + k (see
 * `isVertexForm`). Equal to f but not in that form is `invalid` with `reason: 'not_in_form'` (a legal line,
 * not an attempt at the answer).
 */
export function gradeVertexForm(f: PolyInput, answer: string): PolyGrade {
  return checked(() => gradeVertexFormUnchecked(f, answer))
}

function gradeVertexFormUnchecked(f: PolyInput, answer: string): PolyGrade {
  const m = build(f)
  if (!m) return { verdict: 'unsupported', message: NOT_QUADRATIC }
  const her = readFormula(answer)
  if (!her.ok) return invalidParse(her.error)
  if (!her.poly) {
    return { verdict: 'invalid', reason: 'unreadable', message: 'Vertex form is a(x − h)^2 + k: a polynomial in x, with no x in a denominator and no roots.' }
  }
  const explanation = m.explanation
  if (polyEquals(her.poly, m.poly)) {
    if (nodeInVertexForm(her.node)) return { verdict: 'correct', message: `Correct: f(x) = ${pretty(m.vertexForm)}.`, explanation }
    return {
      verdict: 'invalid',
      reason: 'not_in_form',
      message: `That is equal to f(x), but it is not vertex form yet. Vertex form is a(x − h)^2 + k: one squared binomial (x − h) times a number, plus one constant.`,
    }
  }
  const hit = formCandidates(m).find((c) => polyEquals(her.poly!, tripleToPoly(c.a, c.h, c.k)))
  if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  return {
    verdict: 'wrong',
    message: `Multiply your answer back out: it gives ${polyPretty(her.poly)}, but f(x) = ${pretty(m.f)}. ${differenceNote(her.poly, m)}`,
    explanation,
  }
}

/** Grade her vertex "(h, k)" (exact coordinates). */
export function gradeVertex(f: PolyInput, answer: string): PolyGrade {
  return checked(() => gradeVertexUnchecked(f, answer))
}

function gradeVertexUnchecked(f: PolyInput, answer: string): PolyGrade {
  const m = build(f)
  if (!m) return { verdict: 'unsupported', message: NOT_QUADRATIC }
  const her = parsePointAnswer(plain(answer))
  if (!her.ok) return invalidParse(her.error)
  const explanation = m.explanation
  const right = pointPretty(m.vertex)
  const xOk = same(her.x, m.h)
  const yOk = same(her.y, m.k)
  if (xOk && yOk) return { verdict: 'correct', message: `Correct: f(x) = ${pretty(m.vertexForm)}, so the vertex is ${right}.`, explanation }
  if (her.x && her.y) {
    const hit = vertexCandidates(m).find((c) => same(c.point.x, her.x) && same(c.point.y, her.y))
    if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  }
  const fAtH = `f(${rp(m.h)}) = ${rp(m.k)}`
  let message: string
  if (xOk) message = `Your x-coordinate ${rp(m.h)} is right. The y-coordinate is the value of f there: ${fAtH} (the k of ${pretty(m.vertexForm)}).`
  else if (yOk) message = `Your y-coordinate ${rp(m.k)} is right. The x-coordinate is h = −b/(2a) = ${rp(ratNeg(m.b))}/${rf(ratMul(rat(2), m.a))} = ${rp(m.h)}.`
  else message = `f(x) = ${pretty(m.vertexForm)}, so h = ${rp(m.h)} (where the square is 0) and k = ${rp(m.k)}: the vertex is ${right}.`
  return { verdict: 'wrong', message, explanation }
}

/** Grade her axis of symmetry: "x = 3" or just "3". */
export function gradeAxisOfSymmetry(f: PolyInput, answer: string): PolyGrade {
  return checked(() => gradeAxisOfSymmetryUnchecked(f, answer))
}

function gradeAxisOfSymmetryUnchecked(f: PolyInput, answer: string): PolyGrade {
  const m = build(f)
  if (!m) return { verdict: 'unsupported', message: NOT_QUADRATIC }
  const raw = plain(answer)
  const label = raw.match(/^\s*([A-Za-z])\s*=/)
  if (label && label[1]!.toLowerCase() !== 'x') {
    return {
      verdict: 'invalid',
      reason: 'unreadable',
      message: 'The axis of symmetry of a parabola like this one is a vertical line: write it as x = a number.',
      position: raw.indexOf(label[1]!),
      length: 1,
    }
  }
  const offset = label ? label[0].length : 0
  const her = readNumber(raw.slice(offset))
  if (!her.ok) return invalidParse({ ...her.error, position: her.error.position + offset })
  const explanation = m.explanation
  if (same(her.value, m.h)) return { verdict: 'correct', message: `Correct: the axis of symmetry is x = ${rp(m.h)}, the vertical line through the vertex ${pointPretty(m.vertex)}.`, explanation }
  if (her.value) {
    const hit = axisCandidates(m).find((c) => same(c.value, her.value))
    if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  }
  const isK = same(her.value, m.k)
  return {
    verdict: 'wrong',
    message: `${isK ? `${rp(m.k)} is k, the y-coordinate of the vertex. ` : ''}The axis of symmetry is the vertical line through the vertex, x = h: x = −b/(2a) = ${rp(ratNeg(m.b))}/${rf(ratMul(rat(2), m.a))} = ${rp(m.h)}.`,
    explanation,
  }
}

// ---------------------------------------------------------------------------
// The line-by-line helper
// ---------------------------------------------------------------------------

type LineRead =
  | { ok: true; poly: Poly; /** The expression's tree, or null for an equation line. */ node: MathNode | null }
  | { ok: false; grade: Extract<SquareLineGrade, { verdict: 'invalid' }> }

const NOT_POLYNOMIAL = 'Every line of this problem is a polynomial in x: no x in a denominator and no roots.'

/** L(x, y) with y replaced by a number, as a polynomial in x; null when it is not one. */
function polyWithY(node: MathNode, y: number): Poly | null {
  return guard(() => polyOf(substituteVars(node, { y: `${y}` })))
}

/**
 * A line of her work as the function of x it says y (or f(x)) is:
 *  - an expression, "2(x^2 - 6x) + 13" (with "f(x) =" or "y =" in front if she likes);
 *  - an equation in x and y with y to the first power, "y - 13 = 2(x^2 - 6x)" or "y - 13 + 18 = 2(x - 3)^2"
 *    (the method that moves the constant to y's side first): it is solved for y exactly.
 */
function readLine(line: string): LineRead {
  const text = plain(line)
  const eq = text.indexOf('=')
  const labelled = /^\s*(?:[A-Za-z]\s*\(\s*x\s*\)|y)\s*=[^=]*$/.test(text)
  if (eq < 0 || labelled) {
    const her = readFormula(line)
    if (!her.ok) return { ok: false, grade: invalidParse(her.error) }
    if (!her.poly) return { ok: false, grade: { verdict: 'invalid', reason: 'unreadable', message: NOT_POLYNOMIAL } }
    return { ok: true, poly: her.poly, node: her.node }
  }
  const bad = (message: string, position = eq, length = 1): LineRead => ({ ok: false, grade: { verdict: 'invalid', reason: 'unreadable', message, position, length } })
  if (text.indexOf('=', eq + 1) >= 0 || /[<>]/.test(text)) return bad('Write one equation per line: one = sign.', Math.max(eq, text.indexOf('=', eq + 1)))
  const sides = [text.slice(0, eq), text.slice(eq + 1)]
  const nodes: MathNode[] = []
  for (let i = 0; i < 2; i++) {
    const p = parseExpression(sides[i]!, ['x', 'y'])
    if (!p.ok) {
      const lead = sides[i]!.length - sides[i]!.trimStart().length
      return { ok: false, grade: invalidParse({ ...p.error, position: p.error.position + lead + (i === 1 ? eq + 1 : 0) }) }
    }
    nodes.push(p.node)
  }
  if (!nodes.some((n) => collectVars(n).includes('y'))) {
    return bad('Write one expression per line, or an equation with y in it (like y - 13 = 2(x^2 - 6x)).')
  }
  // L(x, y) = left − right must be α·y + P(x) with α a nonzero number: then y = −P(x)/α.
  const at = (y: number): Poly | null => {
    const l = polyWithY(nodes[0]!, y)
    const r = polyWithY(nodes[1]!, y)
    return l && r ? polySub(l, r) : null
  }
  const [p0, p1, p2] = [at(0), at(1), at(2)]
  if (!p0 || !p1 || !p2) return { ok: false, grade: { verdict: 'invalid', reason: 'unreadable', message: NOT_POLYNOMIAL } }
  const alpha = polySub(p1, p0)
  if (polyDeg(alpha) !== 0 || !polyEquals(polySub(p2, p1), alpha)) {
    return bad('Keep y to the first power and by itself (no x multiplying it), so the line can be solved for y.')
  }
  return { ok: true, poly: polyScale(p0, ratNeg(ratDiv(rat(1), alpha[0]!))), node: null }
}

/**
 * The line-by-line helper: is this line of her work still the same function as f(x)? When it is not, the
 * slip is named if the line multiplies out to what one of the slips produces. `done` says an equal line is
 * already in vertex form. A line may be an expression or an equation with y (see `readLine`). Whether a line
 * follows from the PREVIOUS line is the step checker's job; every legal line of this problem is equal to f.
 */
export function checkSquareLine(f: PolyInput, line: string): SquareLineGrade {
  return checked(() => checkSquareLineUnchecked(f, line))
}

function checkSquareLineUnchecked(f: PolyInput, line: string): SquareLineGrade {
  const m = build(f)
  if (!m) return { verdict: 'unsupported', message: NOT_QUADRATIC }
  const her = readLine(line)
  if (!her.ok) return her.grade
  const explanation = m.explanation
  if (polyEquals(her.poly, m.poly)) {
    const done = !!her.node && nodeInVertexForm(her.node)
    return {
      verdict: 'correct',
      done,
      message: done ? `This is vertex form: f(x) = ${pretty(m.vertexForm)}.` : 'This line is still equal to f(x).',
      explanation,
    }
  }
  const hit = formCandidates(m).find((c) => polyEquals(her.poly, tripleToPoly(c.a, c.h, c.k)))
  if (hit) return { verdict: 'mistake', mistake: hit.kind, witness: hit.witness, explanation }
  let t = rat(0)
  for (const n of [0, 1, -1, 2, -2, 3, -3, 4]) {
    t = rat(n)
    if (ratCompare(valueAt(her.poly, t), valueAt(m.poly, t)) !== 0) break
  }
  const says = her.node ? 'it multiplies out to' : 'solved for y it says y ='
  return {
    verdict: 'wrong',
    message: `This line is not equal to f(x) any more: ${says} ${polyPretty(her.poly)}, but f(x) = ${pretty(m.f)} (at x = ${rp(t)} the line gives ${rp(valueAt(her.poly, t))} and f gives ${rp(valueAt(m.poly, t))}). ${differenceNote(her.poly, m)}`,
    explanation,
  }
}
