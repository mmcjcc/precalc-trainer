/**
 * Exact sign charts for polynomial and rational inequalities. Every critical number is rational,
 * every comparison is on rationals, and a float is used only when a coordinate is handed to the plotter.
 */
import type { Endpoint, GraphSpec, Piece, Rational, SolutionSet } from '@/shared/types'
import { readFormula } from '@/engine/polynomials/common'
import {
  P_ONE,
  polyDeg,
  polyDivmod,
  polyEval,
  polyIsZero,
  polyLead,
  polyMul,
  polyNeg,
  polyScale,
  polySub,
  polyToText,
  ratFnToText,
  rationalRoots,
  type Poly,
  type RatFn,
} from '@/engine/functions/poly'
import { pretty } from '@/engine/functions/text'
import {
  rat,
  ratAdd,
  ratCompare,
  ratDiv,
  ratEquals,
  ratSub,
  ratToNumber,
  ratToString,
  setContains,
  setFromPieces,
  setIsEmpty,
  setsEqual,
  setToInterval,
} from '@/notation'

export type Rel = '<' | '<=' | '>' | '>='
export type ScSign = '+' | '-'

export class ScSkip extends Error {}

export interface ScCritical {
  x: Rational
  numMult: number
  denMult: number
  /** numMult − denMult. The sign changes only when this is odd and not zero. */
  exponent: number
}

export interface ScChart {
  op: Rel
  num: Poly
  den: Poly
  criticals: ScCritical[]
  /** One sign per interval, from the left. Length is criticals.length + 1. */
  signs: ScSign[]
  solution: SolutionSet
  solutionText: string
  criticalText: string
}

export interface ScProblem {
  inequality: string
  op: Rel
  /** 'sides' when the right side is not the zero polynomial. */
  shape: 'zero' | 'sides'
  kind: 'poly' | 'rational'
  left: RatFn
  right: RatFn
  chart: ScChart
  /** The one-fraction inequality, app syntax: the expression compared with 0. */
  oneSided: string
  /** Left side compared with 0, or the cross-multiplied polynomial, when that is a different problem. */
  notOneSide: SolutionSet | null
  notOneSideText: string | null
  /** Numerator compared with 0, for a rational inequality that is already compared with 0. */
  multiplied: SolutionSet | null
  multipliedText: string | null
}

export function math(text: string): string {
  return pretty(text)
}

export function signsText(signs: readonly ScSign[]): string {
  return signs.join(', ')
}

export function criticalText(criticals: readonly { x: Rational }[]): string {
  if (criticals.length === 0) return 'none'
  return criticals.map((c) => ratToString(c.x)).join(', ')
}

export function solutionTextOf(set: SolutionSet): string {
  if (setIsEmpty(set)) return 'no solution'
  return setToInterval(set)
}

/** Interval labels in order, app syntax, one per sign. */
export function intervalLabels(criticals: readonly { x: Rational }[]): string[] {
  const n = criticals.length + 1
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const lo = i === 0 ? '-inf' : ratToString(criticals[i - 1]!.x)
    const hi = i === criticals.length ? 'inf' : ratToString(criticals[i]!.x)
    out.push(`(${lo}, ${hi})`)
  }
  return out
}

export function oppositeSign(sign: ScSign): ScSign {
  return sign === '+' ? '-' : '+'
}

export function nonstrict(op: Rel): boolean {
  return op === '<=' || op === '>='
}

export function wantSign(op: Rel): ScSign {
  return op === '>' || op === '>=' ? '+' : '-'
}

function leadSign(p: Poly): ScSign {
  const lead = polyLead(p)
  if (lead.n === 0) throw new Error('the leading coefficient is 0')
  return lead.n > 0 ? '+' : '-'
}

function rootsOf(p: Poly): { r: Rational; m: number }[] {
  if (polyIsZero(p) || polyDeg(p) < 1) return []
  const found = rationalRoots(p)
  if (polyDeg(found.rest) >= 1) throw new ScSkip('a factor does not split into rational roots')
  return found.roots.map((r, i) => ({ r, m: found.mult[i]! }))
}

function midpoint(a: Rational, b: Rational): Rational {
  return ratDiv(ratAdd(a, b), rat(2))
}

/** A test point in each interval between the critical numbers (and outside the ends). */
export function intervalTests(criticals: readonly { x: Rational }[]): Rational[] {
  if (criticals.length === 0) return [rat(0)]
  const xs = criticals.map((c) => c.x)
  const out: Rational[] = [ratSub(xs[0]!, rat(1))]
  for (let i = 0; i < xs.length - 1; i++) out.push(midpoint(xs[i]!, xs[i + 1]!))
  out.push(ratAdd(xs[xs.length - 1]!, rat(1)))
  return out
}

/** Sign of num/den at x, or 'undef' / 'zero'. Not a float comparison. */
export function valueSign(num: Poly, den: Poly, x: Rational): ScSign | 'zero' | 'undef' {
  const d = polyEval(den, x)
  if (d.n === 0) return 'undef'
  const n = polyEval(num, x)
  if (n.n === 0) return 'zero'
  return ratDiv(n, d).n > 0 ? '+' : '-'
}

function expressionText(num: Poly, den: Poly): string {
  if (polyDeg(den) <= 0) return polyToText(num)
  return ratFnToText({ num, den })
}

export type BracketMode = 'true' | 'flipEndpoints' | 'includeDen' | 'noIsolated'

function definedZero(c: ScCritical): boolean {
  return c.numMult > 0 && c.denMult === 0
}

function denZero(c: ScCritical): boolean {
  return c.denMult > 0
}

function endpointClosed(c: ScCritical, op: Rel, mode: BracketMode): boolean {
  if (mode === 'flipEndpoints') return definedZero(c) && !nonstrict(op)
  // A bracket at a denominator zero is the slip whatever the inequality: (1, 2] for (x - 1)/(x - 2) < 0.
  if (mode === 'includeDen' && denZero(c)) return true
  if (!nonstrict(op)) return false
  return definedZero(c)
}

function isEndpoint(p: Piece, x: Rational): boolean {
  return (typeof p.lo !== 'string' && ratEquals(p.lo, x)) || (typeof p.hi !== 'string' && ratEquals(p.hi, x))
}

/**
 * The solution set for these signs and this bracket rule.
 * 'flipEndpoints' includes a numerator zero exactly when the inequality is strict.
 * 'includeDen' also closes a denominator zero, on any inequality.
 * 'noIsolated' keeps the true brackets but does not add a zero that sits alone.
 */
export function solutionFrom(criticals: readonly ScCritical[], signs: readonly ScSign[], op: Rel, mode: BracketMode): SolutionSet {
  if (signs.length !== criticals.length + 1) throw new Error('the sign row does not match the critical numbers')
  const want = wantSign(op)
  const pieces: Piece[] = []
  for (let i = 0; i < signs.length; i++) {
    if (signs[i] !== want) continue
    const lo: Endpoint = i === 0 ? '-inf' : criticals[i - 1]!.x
    const hi: Endpoint = i === criticals.length ? 'inf' : criticals[i]!.x
    pieces.push({
      lo,
      hi,
      loClosed: typeof lo !== 'string' && endpointClosed(criticals[i - 1]!, op, mode),
      hiClosed: typeof hi !== 'string' && endpointClosed(criticals[i]!, op, mode),
    })
  }
  const points: Rational[] = []
  if (mode !== 'noIsolated') {
    for (const c of criticals) {
      const take =
        mode === 'flipEndpoints'
          ? definedZero(c) && !nonstrict(op)
          : mode === 'includeDen'
            ? nonstrict(op) && (definedZero(c) || denZero(c))
            : nonstrict(op) && definedZero(c)
      if (!take) continue
      if (pieces.some((p) => isEndpoint(p, c.x) || setContains({ pieces: [p], points: [] }, c.x))) continue
      points.push(c.x)
    }
  }
  return setFromPieces(pieces, points)
}

/** True signs, but also flip at each even nonzero exponent (the sign does not really change there). */
export function evenFlipSigns(criticals: readonly ScCritical[], signs: readonly ScSign[]): ScSign[] {
  if (signs.length !== criticals.length + 1) throw new Error('the sign row does not match the critical numbers')
  const out: ScSign[] = [signs[0]!]
  for (let i = 0; i < criticals.length; i++) {
    const exp = criticals[i]!.exponent
    const trueFlip = exp % 2 !== 0
    const evenFlip = exp !== 0 && exp % 2 === 0
    const prev = out[i]!
    out.push(trueFlip || evenFlip ? oppositeSign(prev) : prev)
  }
  return out
}

export function flippedSigns(signs: readonly ScSign[]): ScSign[] {
  return signs.map(oppositeSign)
}

/** Drop one critical number and give the two intervals beside it the sign of the left one. */
export function omitCritical(
  criticals: readonly ScCritical[],
  signs: readonly ScSign[],
  index: number,
): { criticals: ScCritical[]; signs: ScSign[] } {
  if (index < 0 || index >= criticals.length) throw new Error('no such critical number')
  const nextSigns = [...signs]
  nextSigns.splice(index + 1, 1)
  return { criticals: criticals.filter((_, i) => i !== index), signs: nextSigns }
}

function assertChart(chart: ScChart): void {
  const tests = intervalTests(chart.criticals)
  if (tests.length !== chart.signs.length) throw new Error('a test point is missing')
  const far = leadSign(chart.num) === leadSign(chart.den) ? '+' : '-'
  if (chart.signs[chart.signs.length - 1] !== far) {
    throw new Error('the far-right sign does not match the leading coefficient')
  }
  const check = (x: Rational) => {
    const sign = valueSign(chart.num, chart.den, x)
    const inside =
      sign === 'undef' ? false : sign === 'zero' ? nonstrict(chart.op) : sign === '+' ? chart.op === '>' || chart.op === '>=' : chart.op === '<' || chart.op === '<='
    if (setContains(chart.solution, x) !== inside) {
      throw new Error(`the solution set disagrees with the expression at x = ${ratToString(x)}`)
    }
  }
  for (let i = 0; i < tests.length; i++) {
    const x = tests[i]!
    const sign = valueSign(chart.num, chart.den, x)
    if (sign === 'undef' || sign === 'zero') throw new Error(`a test point landed on a critical number (${ratToString(x)})`)
    if (sign !== chart.signs[i]) throw new Error(`the sign at x = ${ratToString(x)} was stored wrong`)
    check(x)
  }
  for (const c of chart.criticals) check(c.x)
}

/** Sign chart of num/den compared with 0. Denominator degree 0 is scaled into the numerator first. */
export function chartOf(num: Poly, den: Poly, op: Rel): ScChart {
  if (polyIsZero(den)) throw new ScSkip('zero denominator')
  if (polyIsZero(num)) throw new ScSkip('the expression is identically zero')
  let n = num
  let d = den
  if (polyDeg(d) === 0) {
    const lead = polyLead(d)
    if (lead.n === 0) throw new ScSkip('zero denominator')
    n = polyScale(n, ratDiv(rat(1), lead))
    d = P_ONE
  }
  const numRoots = rootsOf(n)
  const denRoots = rootsOf(d)
  const map = new Map<string, ScCritical>()
  for (const item of numRoots) {
    map.set(ratToString(item.r), { x: item.r, numMult: item.m, denMult: 0, exponent: item.m })
  }
  for (const item of denRoots) {
    const key = ratToString(item.r)
    const prev = map.get(key)
    if (prev) {
      prev.denMult = item.m
      prev.exponent = prev.numMult - item.m
    } else {
      map.set(key, { x: item.r, numMult: 0, denMult: item.m, exponent: -item.m })
    }
  }
  const criticals = [...map.values()].sort((a, b) => ratCompare(a.x, b.x))
  const tests = intervalTests(criticals)
  const signs: ScSign[] = []
  for (const x of tests) {
    const sign = valueSign(n, d, x)
    if (sign === 'undef' || sign === 'zero') throw new Error(`a test point landed on a critical number (${ratToString(x)})`)
    signs.push(sign)
  }
  const solution = solutionFrom(criticals, signs, op, 'true')
  const chart: ScChart = {
    op,
    num: n,
    den: d,
    criticals,
    signs,
    solution,
    solutionText: solutionTextOf(solution),
    criticalText: criticalText(criticals),
  }
  assertChart(chart)
  return chart
}

function tryChart(num: Poly, den: Poly, op: Rel): ScChart | null {
  try {
    return chartOf(num, den, op)
  } catch (e) {
    if (e instanceof ScSkip) return null
    throw e
  }
}

const OPS: Rel[] = ['<=', '>=', '<', '>']

export function splitInequality(text: string): { left: string; op: Rel; right: string } | null {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0) {
      const op = OPS.find((item) => text.startsWith(item, i))
      if (!op) continue
      const left = text.slice(0, i).trim()
      const right = text.slice(i + op.length).trim()
      if (!left || !right) return null
      return { left, op, right }
    }
  }
  return null
}

function readSide(text: string): RatFn {
  const read = readFormula(text)
  if (!read.ok || !read.ratFn) throw new ScSkip(read.ok ? `"${text}" is not a rational expression` : read.error.message)
  return read.ratFn
}

function polyText(p: Poly): string {
  return polyToText(p)
}

/**
 * Read an inequality in app syntax into its sign chart.
 * Throws Error when the text is not an inequality. Throws ScSkip when a factor does not split
 * into rational roots (a generator filter, not her mistake).
 */
export function parseInequality(text: string): ScProblem {
  const split = splitInequality(text.trim())
  if (!split) throw new Error(`not an inequality: ${text}`)
  const left = readSide(split.left)
  const right = readSide(split.right)
  if (polyIsZero(left.den) || polyIsZero(right.den)) throw new ScSkip('zero denominator')
  const combinedNum = polySub(polyMul(left.num, right.den), polyMul(right.num, left.den))
  const combinedDen = polyMul(left.den, right.den)
  const chart = chartOf(combinedNum, combinedDen, split.op)
  const kind: ScProblem['kind'] = polyDeg(left.den) > 0 || polyDeg(right.den) > 0 ? 'rational' : 'poly'
  const shape: ScProblem['shape'] = polyIsZero(right.num) ? 'zero' : 'sides'
  const oneSided = `${expressionText(chart.num, chart.den)} ${split.op} 0`

  let notOneSide: SolutionSet | null = null
  let notOneSideText: string | null = null
  if (shape === 'sides' && kind === 'poly') {
    const slip = tryChart(left.num, P_ONE, split.op)
    if (slip) {
      notOneSide = slip.solution
      notOneSideText = `${polyText(left.num)} ${split.op} 0`
    }
  } else if (shape === 'sides' && kind === 'rational') {
    const slip = tryChart(combinedNum, P_ONE, split.op)
    if (slip) {
      notOneSide = slip.solution
      notOneSideText = `${polyText(polyMul(left.num, right.den))} ${split.op} ${polyText(polyMul(right.num, left.den))}`
    }
  }

  let multiplied: SolutionSet | null = null
  let multipliedText: string | null = null
  if (kind === 'rational' && shape === 'zero') {
    const slip = tryChart(combinedNum, P_ONE, split.op)
    if (slip) {
      multiplied = slip.solution
      multipliedText = `${polyText(chart.num)} ${split.op} 0`
    }
  }

  return {
    inequality: text.trim(),
    op: split.op,
    shape,
    kind,
    left,
    right,
    chart,
    oneSided,
    notOneSide,
    notOneSideText,
    multiplied,
    multipliedText,
  }
}

function divideOut(p: Poly, root: Rational, times: number): Poly | null {
  let cur: Poly = p
  const factor: Poly = [rat(-root.n), rat(root.d)]
  for (let i = 0; i < times; i++) {
    const { q, r } = polyDivmod(cur, factor)
    if (!polyIsZero(r)) return null
    cur = q
  }
  return cur
}

/** Floats only as plot coordinates. */
function windowOf(values: readonly number[]): [number, number] {
  const vs = values.filter((v) => Number.isFinite(v))
  if (vs.length === 0) return [-8, 8]
  let lo = Math.min(...vs) - 2
  let hi = Math.max(...vs) + 2
  if (hi - lo < 8) {
    const mid = (lo + hi) / 2
    lo = mid - 4
    hi = mid + 4
  }
  return [lo, hi]
}

/** The graph of the one-sided expression. Gold axis marks are the solution. Denominator zeros break the curve. */
export function graphOf(p: ScProblem): GraphSpec {
  const c = p.chart
  const denCrits = c.criticals.filter((item) => item.denMult > 0)
  const breaks = denCrits.map((item) => ratToNumber(item.x))
  const dots: NonNullable<GraphSpec['dots']> = []
  for (const item of c.criticals) {
    if (item.denMult <= 0 || item.numMult < item.denMult) continue
    const num = divideOut(c.num, item.x, item.denMult)
    const den = divideOut(c.den, item.x, item.denMult)
    if (!num || !den) continue
    const d = polyEval(den, item.x)
    if (d.n === 0) continue
    const y = ratDiv(polyEval(num, item.x), d)
    dots.push({ x: ratToNumber(item.x), y: ratToNumber(y), closed: false })
  }
  const asymptotes = denCrits.filter((item) => item.denMult > item.numMult)
  const guides = asymptotes.map((item) => ({ x: ratToNumber(item.x), label: `x = ${ratToString(item.x)}` }))
  const xs = c.criticals.map((item) => ratToNumber(item.x))
  return {
    kind: 'function',
    f: expressionText(c.num, c.den),
    ...(breaks.length ? { fBreaks: breaks } : {}),
    ...(guides.length ? { guides } : {}),
    ...(dots.length ? { dots } : {}),
    solutionMarks: c.solution,
    xDomain: windowOf(xs),
  }
}

export function explainLines(p: ScProblem): { critical: string[]; signs: string[]; solution: string[] } {
  const c = p.chart
  const critical = [
    c.criticals.length === 0
      ? 'There is no critical number, so the expression keeps one sign on the whole number line.'
      : `The critical numbers are ${math(c.criticalText)}.`,
    c.criticals.length === 0
      ? 'Nothing makes the numerator or the denominator 0.'
      : 'Each one is a zero of the numerator or of the denominator, listed from least to greatest.',
  ]
  const signs = [
    `The signs, from left to right, are ${signsText(c.signs)}.`,
    'The sign changes only at a factor whose exponent is odd. An even exponent keeps the sign.',
  ]
  const solution = [
    `The solution is ${math(c.solutionText)}.`,
    `Every term is on one side first: ${math(p.oneSided)}.`,
    p.kind === 'rational'
      ? 'A number that makes the denominator 0 is left out, even when the inequality is ≤ or ≥.'
      : 'A zero of the expression is included only when the inequality is ≤ or ≥.',
  ]
  return { critical, signs, solution }
}

/** A polynomial split into two nonzero sides whose "left side only" solution is different, when one exists. */
export function splitPolynomial(p: Poly, op: Rel): { text: string } | null {
  const truth = chartOf(p, P_ONE, op)
  let best: { text: string; rightDeg: number } | null = null
  for (let k = 0; k < p.length; k++) {
    const coef = p[k]
    if (!coef || coef.n === 0) continue
    const term: Rational[] = Array.from({ length: k + 1 }, () => rat(0))
    term[k] = coef
    const left = polySub(p, term)
    const right = polyNeg(term)
    if (polyIsZero(left) || polyIsZero(right)) continue
    const slip = tryChart(left, P_ONE, op)
    if (!slip || setsEqual(slip.solution, truth.solution)) continue
    const text = `${polyToText(left)} ${op} ${polyToText(right)}`
    const rightDeg = polyDeg(right)
    if (!best || (rightDeg > 0 && best.rightDeg <= 0)) best = { text, rightDeg }
  }
  return best ? { text: best.text } : null
}
