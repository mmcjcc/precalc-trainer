/**
 * Writing the equation of g: she types g(x) as an explicit formula (not f-notation), graded against
 * g(x) = a·f(b(x − h)) + k.
 *
 * Her formula is accepted when it is the same FUNCTION as g, in any form (expanded, factored, the inside
 * multiplied out, "g(x) =" or "y =" in front):
 *  1. the same exact domain, from the functions core's restriction walk (so sqrt(3 − x) is not
 *     sqrt(x − 3), and (x + 1)/(x^2 − 1) is not 1/(x − 1));
 *  2. the same exact value at 14 rational probes inside g's domain, chosen so every root is exact (for sqrt
 *     the inside b(x − h) is a perfect square, for cbrt a perfect cube), and undefined at probes outside it;
 *  3. no disagreement from the existing float sampler (`compareOnSamples`, strict domain) at other points
 *     inside g's domain — samples are taken where g is defined, never where sqrt or 1/x is not.
 * Where her formula leaves the exact model at a probe (a cube root of a non-cube, a log), that probe is
 * compared as a float (relative 1e-9), the functions core's precedent.
 *
 * Mistakes are named by candidate formulas. Each is a variant spec (h → −h, b → 1/b, a moved inside, …) and
 * her formula is compared with it the same way. Candidates drawing the same graph as g are dropped (x^2 hides
 * a reflection over the y-axis); a later kind drawing the same graph as an earlier one goes in its `shadows`.
 */
import type { Rational, SolutionSet } from '@/shared/types'
import { rat, ratAbs, ratAdd, ratCompare, ratDiv, ratMul, ratNeg, ratSub, ratToNumber } from '@/notation/rational'
import { setDifference, setsEqual } from '@/notation/sets/solutionSet'
import { evalNode, nearlyEqual, type MathNode } from '../math'
import { parseExpression } from '../parse'
import { compareOnSamples, niceNumber, type Scope } from '../samples'
import { friendlyPoint } from '../functions/common'
import { exactEval, surdEquals, surdRational, surdToNumber, surdToText, type Surd } from '../functions/exact'
import { domainSet } from '../functions/solve'
import { stepSentence } from './describe'
import { explicitFormula, insideText, PARENTS, parentFormula, sameGraph, specDomain, specProblem, specValue } from './spec'
import { coefPrefix, isOne, pointPretty, pretty, rp, shiftWords, xMinus } from './text'
import type { EquationMistakeCandidate, StatementForm, TransformGrade, TransformMistakeKind, TransformSpec } from './types'

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

const Q = (n: number, d = 1): Rational => rat(n, d)

/** Values u of the inside b(x − h) where g is probed: every root exact, every point inside the domain. */
const U_POLY = [Q(0), Q(1), Q(-1), Q(2), Q(-2), Q(3), Q(-3), Q(1, 2), Q(-1, 2), Q(5, 2), Q(-7, 3), Q(5), Q(-6), Q(10)]
const U_RECIP = [Q(1), Q(-1), Q(2), Q(-2), Q(3), Q(-3), Q(1, 2), Q(-1, 2), Q(5, 2), Q(-7, 3), Q(5), Q(-6), Q(10), Q(1, 4)]
const U_SQRT = [Q(0), Q(1), Q(4), Q(9), Q(16), Q(25), Q(1, 4), Q(9, 4), Q(25, 4), Q(49, 4), Q(1, 9), Q(36), Q(64), Q(100)]
const U_CBRT = [Q(0), Q(1), Q(-1), Q(8), Q(-8), Q(27), Q(-27), Q(1, 8), Q(-1, 8), Q(64), Q(-64), Q(125), Q(-125), Q(27, 8)]
/** Where g is undefined: sqrt of a negative inside, 1/0. */
const U_OUT_SQRT = [Q(-1), Q(-4), Q(-1, 4), Q(-9)]
/** Float-guard values of the inside (never a probe value). */
const FLOAT_U = [0.37, 1.3, 2.9, 6.1, 11.7, 0.83, 4.4, 17.2, 0.61]

interface Probe {
  t: Rational
  want: Surd | 'undef'
}

function tFor(spec: TransformSpec, u: Rational): Rational {
  return ratAdd(ratDiv(u, spec.b), spec.h)
}

function exactG(spec: TransformSpec, t: Rational): Surd | 'undef' | null {
  try {
    return specValue(spec, t)
  } catch {
    return null
  }
}

function probesOf(spec: TransformSpec): Probe[] {
  const us = spec.parent === 'sqrt' ? U_SQRT : spec.parent === 'cbrt' ? U_CBRT : spec.parent === 'reciprocal' ? U_RECIP : U_POLY
  const out: Probe[] = []
  for (const u of us) {
    const t = tFor(spec, u)
    const want = exactG(spec, t)
    if (want !== null && want !== 'undef') out.push({ t, want })
  }
  const outside = spec.parent === 'sqrt' ? U_OUT_SQRT : spec.parent === 'reciprocal' ? [Q(0)] : []
  for (const u of outside) out.push({ t: tFor(spec, u), want: 'undef' })
  return out
}

function floatSamples(spec: TransformSpec): Scope[] {
  const us = spec.parent === 'sqrt' ? FLOAT_U : [...FLOAT_U, ...FLOAT_U.map((u) => -u)]
  const b = ratToNumber(spec.b)
  const h = ratToNumber(spec.h)
  return us.map((u) => ({ x: u / b + h }))
}

type Val = Surd | 'undef' | number

/** Her formula at t: exact when it stays in the exact model, else a float. */
function valueOf(node: MathNode, t: Rational): Val {
  try {
    return exactEval(node, t)
  } catch {
    return evalNode(node, { x: ratToNumber(t) })
  }
}

function agrees(got: Val, want: Surd | 'undef'): boolean {
  if (want === 'undef' || got === 'undef') return got === want
  if (typeof got === 'number') {
    const w = surdToNumber(want)
    return nearlyEqual(got, w, Math.max(1, Math.abs(got), Math.abs(w)))
  }
  return surdEquals(got, want)
}

function nodeOf(text: string): MathNode | null {
  const p = parseExpression(text, ['x'])
  return p.ok ? p.node : null
}

function herDomainOf(node: MathNode): SolutionSet | null {
  try {
    return domainSet(node)
  } catch {
    return null
  }
}

/** Is her formula the same function as `spec`'s g? (See the file comment.) */
function formulaMatches(her: MathNode, herDom: SolutionSet | null, spec: TransformSpec): boolean {
  if (herDom && !setsEqual(herDom, specDomain(spec))) return false
  for (const p of probesOf(spec)) if (!agrees(valueOf(her, p.t), p.want)) return false
  const g = nodeOf(explicitFormula(spec))
  if (g) {
    const res = compareOnSamples(g, her, floatSamples(spec), { domain: 'strict', minDefined: 1 })
    if (res.witness || res.domainMismatches.length) return false
  }
  return true
}

// ---------------------------------------------------------------------------
// Witness points and value text
// ---------------------------------------------------------------------------

function valText(v: Val): string {
  if (v === 'undef') return 'undefined'
  return pretty(typeof v === 'number' ? niceNumber(v) : surdToText(v))
}

function isRationalVal(v: Val): boolean {
  return v !== 'undef' && typeof v !== 'number' && surdRational(v) !== null
}

/** Integers near h first, then near 0, then g's probes (whose values are exact). */
function nicePoints(spec: TransformSpec): Rational[] {
  const out: Rational[] = []
  const seen = new Set<string>()
  const push = (r: Rational) => {
    const key = `${r.n}/${r.d}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(r)
    }
  }
  const c = Math.round(ratToNumber(spec.h))
  for (let j = 0; j <= 8; j++) for (const s of j === 0 ? [0] : [j, -j]) push(Q(c + s))
  for (let j = 0; j <= 8; j++) for (const s of j === 0 ? [0] : [j, -j]) push(Q(s))
  for (const p of probesOf(spec)) push(p.t)
  return out
}

type Diff = { t: Rational; g: Val; her: Val }

/**
 * Rank of a difference for a witness (lower is friendlier): 0 both defined with rational values; 1 one side
 * undefined and the other rational; 2 both defined (a root in a value); 3 anything else.
 */
function diffRank(d: Diff): number {
  if (d.g !== 'undef' && d.her !== 'undef') return isRationalVal(d.g) && isRationalVal(d.her) ? 0 : 2
  const defined = d.g === 'undef' ? d.her : d.g
  return isRationalVal(defined) ? 1 : 3
}

/** The friendliest x (see `diffRank`, then the order of `nicePoints`) where g and `other` differ. */
function differingPoint(spec: TransformSpec, other: (t: Rational) => Val): Diff | null {
  let best: Diff | null = null
  for (const t of nicePoints(spec)) {
    const g = exactG(spec, t)
    if (g === null) continue
    const her = other(t)
    if (g === 'undef' && her === 'undef') continue
    if (g !== 'undef' && her !== 'undef' && agrees(her, g)) continue
    const d = { t, g, her }
    if (diffRank(d) === 0) return d
    if (!best || diffRank(d) < diffRank(best)) best = d
  }
  return best
}

function whyUndefined(spec: TransformSpec, t: Rational): string {
  if (spec.parent === 'reciprocal') return `x = ${rp(spec.h)} is g's vertical asymptote (it divides by 0 there)`
  const u = ratMul(spec.b, ratSub(t, spec.h))
  return `the inside ${pretty(insideText(spec))} is ${rp(u)} there, and the square root of a negative number is undefined`
}

/** "at x = 4, g(4) = −1 but your formula gives 3" (or the domain difference, also starting "at x = …"). */
function diffText(spec: TransformSpec, d: Diff): string {
  const t = rp(d.t)
  if (d.g === 'undef') return `at x = ${t} your formula gives ${valText(d.her)}, but g(${t}) is undefined: ${whyUndefined(spec, d.t)}`
  if (d.her === 'undef') return `at x = ${t}, g(${t}) = ${valText(d.g)}, but your formula is undefined there`
  return `at x = ${t}, g(${t}) = ${valText(d.g)} but your formula gives ${valText(d.her)}`
}

function candValue(c: TransformSpec): (t: Rational) => Val {
  return (t) => exactG(c, t) ?? evalNode(nodeOf(explicitFormula(c))!, { x: ratToNumber(t) })
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

type Variant = 'plain' | 'inside_unfactored' | 'inside_refactored' | 'a' | 'b'

interface Raw {
  kind: TransformMistakeKind
  spec: TransformSpec
  variant: Variant
}

function rawCandidates(spec: TransformSpec, form: StatementForm): Raw[] {
  const { a, b, h, k } = spec
  const out: Raw[] = []
  const push = (kind: TransformMistakeKind, s: Partial<TransformSpec>, variant: Variant = 'plain') => out.push({ kind, spec: { ...spec, ...s }, variant })
  const reversed = () => {
    if (h.n !== 0) push('h_shift_reversed', { h: ratNeg(h) })
  }
  const unfactored = () => {
    if (isOne(b) || h.n === 0) return
    // f(bx − h): the shift went into the multiplied-out inside, so it gets divided by b when factored.
    push('unfactored_shift', { h: ratDiv(h, b) }, 'inside_unfactored')
    // f(b(x − b·h)): the constant of f(bx − bh) was kept as the shift.
    push('unfactored_shift', { h: ratMul(b, h) }, 'inside_refactored')
  }
  if (form === 'unfactored') {
    unfactored()
    reversed()
  } else reversed()
  if (k.n !== 0) push('v_shift_reversed', { k: ratNeg(k) })
  if (form !== 'unfactored') unfactored()
  if (a.n < 0) push('missing_reflection', { a: ratAbs(a) }, 'a')
  if (b.n < 0) push('missing_reflection', { b: ratAbs(b) }, 'b')
  if ((a.n < 0) !== (b.n < 0)) push('reflection_wrong_axis', { a: ratNeg(a), b: ratNeg(b) })
  if (!isOne(ratAbs(b))) push('h_factor_inverted', { b: ratDiv(Q(1), b) })
  if (!isOne(ratAbs(a))) push('v_factor_inverted', { a: ratDiv(Q(1), a) })
  if (!isOne(a)) push('v_factor_inside', { a: Q(1), b: ratMul(a, b) })
  if (k.n !== 0) push('v_shift_inside', { h: ratSub(h, ratDiv(k, b)), k: Q(0) })
  return out
}

function cap(s: string): string {
  return s ? s[0]!.toUpperCase() + s.slice(1) : s
}

function signText(k: Rational): string {
  return k.n > 0 ? `+ ${rp(k)}` : `− ${rp(ratAbs(k))}`
}

function bxText(b: Rational): string {
  return pretty(`${coefPrefix(b)}x`)
}

/** Where the candidate's key feature sits compared with g's. */
function featureCompare(spec: TransformSpec, c: TransformSpec, axis: 'h' | 'v'): string {
  const anchor = PARENTS[spec.parent].anchor
  if (anchor) return `its ${anchor} is ${pointPretty({ x: c.h, y: c.k })}, not ${pointPretty({ x: spec.h, y: spec.k })}`
  return axis === 'h' ? `its vertical asymptote is x = ${rp(c.h)}, not x = ${rp(spec.h)}` : `its horizontal asymptote is y = ${rp(c.k)}, not y = ${rp(spec.k)}`
}

function witnessFor(spec: TransformSpec, r: Raw): string {
  const c = r.spec
  const T = pretty(explicitFormula(spec))
  const d = differingPoint(spec, candValue(c))
  const at = d ? diffText(spec, d) : 'it draws a different graph'
  const formula = pretty(parentFormula(spec.parent))
  switch (r.kind) {
    case 'h_shift_reversed':
      return `g shifts ${shiftWords(spec.h, 'h')}, so ${pretty(xMinus(spec.h))} goes inside f: ${T}. Your formula has ${pretty(xMinus(c.h))}, a shift ${shiftWords(c.h, 'h')}: ${featureCompare(spec, c, 'h')}.`
    case 'v_shift_reversed':
      return `g shifts ${shiftWords(spec.k, 'v')}, so ${signText(spec.k)} goes after f: ${T}. Your formula has ${signText(c.k)}: ${featureCompare(spec, c, 'v')}.`
    case 'unfactored_shift': {
      const F = pretty(insideText(spec, 'factored'))
      const U = pretty(insideText(spec, 'unfactored'))
      const CF = pretty(insideText(c, 'factored'))
      if (r.variant === 'inside_unfactored') {
        const CU = pretty(insideText(c, 'unfactored'))
        return `The shift ${shiftWords(spec.h, 'h')} applies to x itself: x becomes ${pretty(xMinus(spec.h))}, so the inside is ${F} = ${U}: ${T}. Your inside ${CU} factors as ${CF}, a shift ${shiftWords(c.h, 'h')}.`
      }
      return `Factor ${rp(spec.b)} out of ${U}: ${U} = ${F}, so the shift is ${shiftWords(spec.h, 'h')}: ${T}. Your formula has ${CF}, a shift ${shiftWords(c.h, 'h')}.`
    }
    case 'missing_reflection':
      if (r.variant === 'a') {
        const even = PARENTS[spec.parent].symmetry === 'even' ? ` (For f(x) = ${formula} a minus sign inside the parentheses changes nothing: f(−u) = f(u).)` : ''
        return `g is reflected over the x-axis, so the minus sign goes in front of f: ${T}. Your formula is not reflected: ${at}.${even}`
      }
      return `g is reflected over the y-axis, so x is multiplied by ${rp(spec.b)} inside f: ${T}. Your formula is not reflected: ${at}.`
    case 'reflection_wrong_axis':
      return spec.a.n < 0
        ? `A reflection over the x-axis changes the sign of the OUTPUT, so the minus sign goes in front of f: ${T}. Your formula puts it on x inside f, which reflects over the y-axis: ${at}.`
        : `A reflection over the y-axis changes the sign of the INPUT, so the minus sign goes on x inside f: ${T}. Your formula puts it in front of f, which reflects over the x-axis: ${at}.`
    case 'h_factor_inverted': {
      const m = ratDiv(Q(1), ratAbs(spec.b))
      const sentence = stepSentence({ kind: 'scale', axis: 'horizontal', word: ratCompare(m, Q(1)) > 0 ? 'stretch' : 'compress', factor: m })
      const theirs = stepSentence({ kind: 'scale', axis: 'horizontal', word: ratCompare(m, Q(1)) > 0 ? 'compress' : 'stretch', factor: ratAbs(spec.b) })
      return `${cap(sentence)} multiplies every x-value by ${rp(m)}, so x is replaced by ${bxText(spec.b)} inside f: ${T}. Your formula has ${bxText(c.b)}, which would ${theirs} instead.`
    }
    case 'v_factor_inverted': {
      const A = ratAbs(spec.a)
      const sentence = stepSentence({ kind: 'scale', axis: 'vertical', word: ratCompare(A, Q(1)) > 0 ? 'stretch' : 'compress', factor: A })
      return `${cap(sentence)} multiplies every output by ${rp(A)}: ${T}. Your formula multiplies by ${rp(ratDiv(Q(1), A))}: ${at}.`
    }
    case 'v_factor_inside':
      return `The ${rp(spec.a)} multiplies the OUTPUT of f, so it goes in front: ${T}. Inside the parentheses it multiplies x instead, a horizontal change: ${at}.`
    case 'v_shift_inside':
      return `The ${signText(spec.k)} is added to the OUTPUT of f, so it goes after f: ${T}. Inside f it moves the graph sideways instead: ${at}.`
    default:
      return `That formula draws a different graph: ${at}.`
  }
}

function candidateText(r: Raw): string {
  return explicitFormula(r.spec, r.variant === 'inside_unfactored' ? 'unfactored' : 'factored')
}

function candidatesFor(spec: TransformSpec, form: StatementForm): (EquationMistakeCandidate & { raw: Raw })[] {
  const kept: (EquationMistakeCandidate & { raw: Raw })[] = []
  for (const r of rawCandidates(spec, form)) {
    if (sameGraph(r.spec, spec)) continue
    const twin = kept.find((k) => sameGraph(k.spec, r.spec))
    if (twin) {
      if (twin.kind !== r.kind && !twin.shadows.includes(r.kind)) twin.shadows.push(r.kind)
      continue
    }
    kept.push({ kind: r.kind, spec: r.spec, text: candidateText(r), witness: '', shadows: [], raw: r })
  }
  return kept
}

/**
 * What each equation mistake gives for g, in priority order (each a different graph from g and from the
 * others). `witness` is the sentence the grader returns for it. Null for an invalid spec.
 */
export function equationMistakes(spec: TransformSpec, options: { form?: StatementForm } = {}): EquationMistakeCandidate[] | null {
  if (specProblem(spec)) return null
  return candidatesFor(spec, options.form ?? 'factored').map(({ kind, spec: s, text, shadows, raw }) => ({
    kind,
    spec: s,
    text,
    witness: witnessFor(spec, raw),
    shadows,
  }))
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

const LABEL = /^\s*(?:[a-z]\s*\(\s*x\s*\)|y)\s*=/i
const F_CALL = /(?<![A-Za-z])[fg]\s*\(/

/** Is `answer` (an explicit formula) the same function as g? Exposed for flows that only need yes/no. */
export function isSameFunction(spec: TransformSpec, answer: string): boolean {
  if (specProblem(spec)) return false
  const label = answer.match(LABEL)
  const node = nodeOf(label ? answer.slice(label[0].length) : answer)
  return !!node && formulaMatches(node, herDomainOf(node), spec)
}

/**
 * Grade her g(x): an explicit formula in x ("g(x) =" or "y =" in front is fine). Any equivalent form is
 * correct; a formula on a different domain is not. `form` orders the unfactored-shift candidates first when
 * the problem wrote the inside multiplied out.
 */
export function gradeEquation(spec: TransformSpec, answer: string, options: { form?: StatementForm } = {}): TransformGrade {
  const problem = specProblem(spec)
  if (problem) return { verdict: 'unsupported', message: `This transformation is not valid: ${problem}.` }
  const text = answer ?? ''
  const label = text.match(LABEL)
  const afterLabel = label ? text.slice(label[0].length) : text
  const shift = (label ? label[0].length : 0) + (afterLabel.length - afterLabel.trimStart().length)
  const body = afterLabel.trim()
  if (!body) return { verdict: 'invalid', message: 'Type the formula for g(x) first.', position: 0 }
  const call = body.match(F_CALL)
  if (call) {
    const inside = pretty(insideText(spec))
    return {
      verdict: 'invalid',
      message: `Write g(x) as a formula in x, with f's formula in place of f: f(x) = ${pretty(parentFormula(spec.parent))}, so f(${inside}) is ${pretty(explicitFormula({ ...spec, a: Q(1), k: Q(0) }))}.`,
      position: shift + (call.index ?? 0),
      length: 1,
    }
  }
  const parsed = parseExpression(body, ['x'])
  if (!parsed.ok) {
    return { verdict: 'invalid', message: parsed.error.message, position: shift + parsed.error.position, length: parsed.error.length }
  }
  const her = parsed.node
  const herDom = herDomainOf(her)
  const T = pretty(explicitFormula(spec))
  if (formulaMatches(her, herDom, spec)) return { verdict: 'correct', message: `Correct: g(x) = ${T}.` }
  for (const c of candidatesFor(spec, options.form ?? 'factored')) {
    if (formulaMatches(her, herDom, c.spec)) return { verdict: 'mistake', mistake: c.kind, witness: witnessFor(spec, c.raw) }
  }
  return { verdict: 'wrong', message: plainMessage(spec, her, herDom) }
}

function plainMessage(spec: TransformSpec, her: MathNode, herDom: SolutionSet | null): string {
  const tail = 'Check each piece: what is inside f, the number in front of f, and the number added after it.'
  const dom = specDomain(spec)
  if (herDom && !setsEqual(herDom, dom)) {
    const extra = friendlyPoint(setDifference(herDom, dom), her)
    if (extra) {
      const v = valueOf(her, extra)
      return `Your formula is defined at x = ${rp(extra)} (it gives ${valText(v)}), but g(${rp(extra)}) is undefined: ${whyUndefined(spec, extra)}. ${tail}`
    }
    const missing = friendlyPoint(setDifference(dom, herDom))
    if (missing) {
      const g = exactG(spec, missing)
      return `At x = ${rp(missing)}, g(${rp(missing)}) = ${g === null ? 'defined' : valText(g)}, but your formula is undefined there. ${tail}`
    }
  }
  const d = differingPoint(spec, (t) => valueOf(her, t))
  if (d) return `${cap(diffText(spec, d))}. ${tail}`
  return `That is not g(x). ${tail}`
}
