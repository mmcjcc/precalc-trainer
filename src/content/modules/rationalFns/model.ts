/**
 * Exact rational functions for the rationalFns module. Polynomials are the engine's (`src/engine/functions/poly`);
 * every comparison is rational. Floats appear only when a graph coordinate is handed to the plotter.
 */
import type { GraphSpec, Rational } from '@/shared/types'
import { readFormula } from '@/engine/polynomials/common'
import {
  P_ONE,
  P_X,
  factoredText,
  polyAdd,
  polyDeg,
  polyDivmod,
  polyEval,
  polyIsZero,
  polyLead,
  polyMul,
  polySub,
  polyToText,
  ratFnReduce,
  ratFnToText,
  rationalRoots,
  type Poly,
  type RatFn,
} from '@/engine/functions/poly'
import { pretty } from '@/engine/functions/text'
import {
  allReals,
  rat,
  ratCompare,
  ratDiv,
  ratEquals,
  ratMul,
  ratToNumber,
  ratToString,
  setDifference,
  setFromPieces,
  setToInterval,
} from '@/notation'

export interface RfPoint {
  x: Rational
  y: Rational
}

export type AsymptoteKind = 'horizontal' | 'slant' | 'none'
export type RfForm = 'factored' | 'standard'

/** A drawn function that did not pass the generator's filters. Not a bug in the arithmetic. */
export class RfSkip extends Error {}

export interface RfFeatures {
  num: Poly
  den: Poly
  reduced: RatFn
  degreeNum: number
  degreeDen: number
  vas: Rational[]
  holes: RfPoint[]
  xIntercepts: RfPoint[]
  yIntercept: RfPoint | null
  asymptoteKind: AsymptoteKind
  /** The line, or null when the numerator is two or more degrees higher (no horizontal or slant asymptote). */
  asymptote: Poly | null
  quotient: Poly
  remainder: Poly
  domainText: string
  vaText: string
  holesText: string
  asymptoteText: string
  xIntText: string
  yIntText: string
  explain: Record<'domain' | 'va' | 'holes' | 'asymptote' | 'xint' | 'yint', string[]>
}

export interface RfEquation {
  left: RatFn
  right: RatFn
  /** Roots of the cleared polynomial, before the denominator check. */
  candidates: Rational[]
  /** Values that make a denominator 0. */
  excluded: Rational[]
  solutions: Rational[]
  solutionText: string
  explain: string[]
}

export function math(text: string): string {
  return pretty(text)
}

export function pointText(p: RfPoint): string {
  return `(${ratToString(p.x)}, ${ratToString(p.y)})`
}

export function pointsText(ps: readonly RfPoint[]): string {
  if (ps.length === 0) return 'none'
  return [...ps]
    .sort((a, b) => ratCompare(a.x, b.x) || ratCompare(a.y, b.y))
    .map(pointText)
    .join(', ')
}

export function vaText(xs: readonly Rational[]): string {
  if (xs.length === 0) return 'none'
  return [...xs]
    .sort(ratCompare)
    .map((x) => `x = ${ratToString(x)}`)
    .join(', ')
}

export function lineText(p: Poly): string {
  return `y = ${polyToText(p)}`
}

export function domainText(excluded: readonly Rational[]): string {
  return setToInterval(setDifference(allReals(), setFromPieces([], [...excluded])))
}

export function solutionText(values: readonly Rational[]): string {
  if (values.length === 0) return 'no solution'
  return setToInterval(setFromPieces([], [...values]))
}

export function samePoints(a: readonly RfPoint[], b: readonly RfPoint[]): boolean {
  if (a.length !== b.length) return false
  const as = [...a].sort((p, q) => ratCompare(p.x, q.x) || ratCompare(p.y, q.y))
  const bs = [...b].sort((p, q) => ratCompare(p.x, q.x) || ratCompare(p.y, q.y))
  return as.every((p, i) => ratEquals(p.x, bs[i]!.x) && ratEquals(p.y, bs[i]!.y))
}

export function sameRats(a: readonly Rational[], b: readonly Rational[]): boolean {
  if (a.length !== b.length) return false
  const as = [...a].sort(ratCompare)
  const bs = [...b].sort(ratCompare)
  return as.every((r, i) => ratEquals(r, bs[i]!))
}

/** num/den and other/other are the same function when num·otherDen − otherNum·den is the zero polynomial. */
export function sameRational(a: RatFn, b: RatFn): boolean {
  return polyIsZero(polySub(polyMul(a.num, b.den), polyMul(b.num, a.den)))
}

export function showPoly(p: Poly, form: RfForm): string {
  if (form === 'factored') {
    const factored = factoredText(p)
    if (factored) return factored
  }
  return polyToText(p)
}

/** Both sides of a fraction stay in parentheses, so a product is not read as multiplication by the denominator. */
export function fractionText(num: Poly, den: Poly, form: RfForm): string {
  if (polyIsZero(den)) throw new RfSkip('zero denominator')
  if (polyDeg(den) === 0 && ratEquals(polyLead(den), rat(1))) return showPoly(num, form)
  if (polyDeg(den) === 0) return `(${showPoly(num, form)})/(${ratToString(polyLead(den))})`
  return `(${showPoly(num, form)})/(${showPoly(den, form)})`
}

function joinAnd(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function xsText(xs: readonly Rational[]): string {
  return joinAnd([...xs].sort(ratCompare).map((x) => `x = ${math(ratToString(x))}`))
}

interface RootInfo {
  r: Rational
  m: number
}

function rootsOf(p: Poly): RootInfo[] {
  if (polyIsZero(p)) throw new RfSkip('zero polynomial')
  if (polyDeg(p) < 1) return []
  const found = rationalRoots(p)
  if (polyDeg(found.rest) >= 1) throw new RfSkip('a factor does not split into rational roots')
  return found.roots.map((r, i) => ({ r, m: found.mult[i]! }))
}

function multAt(roots: readonly RootInfo[], x: Rational): number {
  return roots.find((item) => ratEquals(item.r, x))?.m ?? 0
}

function holeHeight(reduced: RatFn, x: Rational): Rational {
  const d = polyEval(reduced.den, x)
  if (d.n === 0) throw new RfSkip('the reduced denominator is still 0 at a hole')
  return ratDiv(polyEval(reduced.num, x), d)
}

/**
 * Domain, holes, asymptotes and intercepts of num/den.
 * A denominator zero that outnumbers the numerator is a vertical asymptote. A shared factor that
 * cancels (the numerator has it at least as many times) is a hole, and its height is the reduced
 * function. An x-intercept is a numerator zero the denominator does not have.
 */
export function featuresFrom(num: Poly, den: Poly): RfFeatures {
  if (polyIsZero(den)) throw new RfSkip('zero denominator')
  if (polyIsZero(num)) throw new RfSkip('zero numerator')
  const reduced = ratFnReduce({ num, den })
  if (polyIsZero(reduced.den)) throw new RfSkip('zero denominator')
  const numRoots = rootsOf(num)
  const denRoots = rootsOf(den)
  const seen = new Map<string, Rational>()
  for (const item of [...numRoots, ...denRoots]) seen.set(ratToString(item.r), item.r)
  const vas: Rational[] = []
  const holes: RfPoint[] = []
  for (const x of [...seen.values()].sort(ratCompare)) {
    const mN = multAt(numRoots, x)
    const mD = multAt(denRoots, x)
    if (mD > mN) vas.push(x)
    else if (mD > 0 && mN >= mD) holes.push({ x, y: holeHeight(reduced, x) })
  }
  const xIntercepts: RfPoint[] = numRoots
    .filter((item) => multAt(denRoots, item.r) === 0)
    .map((item) => ({ x: item.r, y: rat(0) }))
  const excluded = [...vas, ...holes.map((h) => h.x)].sort(ratCompare)
  const zero = rat(0)
  const yIntercept = excluded.some((x) => ratEquals(x, zero))
    ? null
    : { x: zero, y: ratDiv(polyEval(num, zero), polyEval(den, zero)) }
  const degreeNum = polyDeg(num)
  const degreeDen = polyDeg(den)
  const diff = degreeNum - degreeDen
  const { q: quotient, r: remainder } = polyDivmod(num, den)
  let asymptoteKind: AsymptoteKind
  let asymptote: Poly | null
  if (diff >= 2) {
    asymptoteKind = 'none'
    asymptote = null
  } else if (diff < 0) {
    asymptoteKind = 'horizontal'
    asymptote = []
  } else if (diff === 0) {
    asymptoteKind = 'horizontal'
    asymptote = [ratDiv(polyLead(num), polyLead(den))]
  } else {
    asymptoteKind = 'slant'
    asymptote = quotient
  }
  const built: RfFeatures = {
    num,
    den,
    reduced,
    degreeNum,
    degreeDen,
    vas,
    holes,
    xIntercepts,
    yIntercept,
    asymptoteKind,
    asymptote,
    quotient,
    remainder,
    domainText: domainText(excluded),
    vaText: vaText(vas),
    holesText: pointsText(holes),
    asymptoteText: asymptote ? lineText(asymptote) : 'none',
    xIntText: pointsText(xIntercepts),
    yIntText: yIntercept ? pointText(yIntercept) : 'none',
    explain: { domain: [], va: [], holes: [], asymptote: [], xint: [], yint: [] },
  }
  built.explain = explainFeatures(built)
  return built
}

export function featuresFromText(expr: string): RfFeatures {
  const read = readFormula(expr)
  if (!read.ok || !read.ratFn) throw new RfSkip(read.ok ? 'not a rational function' : read.error.message)
  if (polyIsZero(read.ratFn.den)) throw new RfSkip('zero denominator')
  return featuresFrom(read.ratFn.num, read.ratFn.den)
}

function explainFeatures(f: RfFeatures): RfFeatures['explain'] {
  const excluded = [...f.vas, ...f.holes.map((h) => h.x)]
  const domain = [
    excluded.length
      ? `The denominator is 0 at ${xsText(excluded)}, so those values are not in the domain.`
      : 'The denominator is never 0, so the domain is every real number.',
    `Domain: ${math(f.domainText)}.`,
  ]
  const va = [
    f.vas.length
      ? `A factor that is still in the denominator after canceling gives a vertical asymptote: ${xsText(f.vas)}.`
      : 'After canceling, nothing is left that makes the denominator 0, so there is no vertical asymptote.',
    `Vertical asymptotes: ${math(f.vaText)}.`,
  ]
  const holes = [
    f.holes.length
      ? `A factor in both the top and the bottom cancels. ${f.holes
          .map((h) => `At x = ${math(ratToString(h.x))} the reduced function gives ${math(ratToString(h.y))}, so the hole is ${math(pointText(h))}.`)
          .join(' ')}`
      : 'No factor cancels, so there is no hole.',
    `Holes: ${math(f.holesText)}.`,
  ]
  let asymptote: string[]
  if (f.asymptoteKind === 'none') {
    asymptote = [
      `The numerator's degree is ${f.degreeNum} and the denominator's is ${f.degreeDen}. The top is higher by ${f.degreeNum - f.degreeDen}, so there is no horizontal or slant asymptote.`,
      'Horizontal or slant asymptote: none.',
    ]
  } else if (f.degreeNum < f.degreeDen) {
    asymptote = [
      `The numerator's degree (${f.degreeNum}) is lower than the denominator's (${f.degreeDen}), so the horizontal asymptote is y = 0.`,
      `Horizontal or slant asymptote: ${math(f.asymptoteText)}.`,
    ]
  } else if (f.degreeNum === f.degreeDen) {
    asymptote = [
      `The degrees match (both ${f.degreeNum}), so the horizontal asymptote is the ratio of the leading coefficients: ${math(f.asymptoteText)}.`,
      `Horizontal or slant asymptote: ${math(f.asymptoteText)}.`,
    ]
  } else {
    asymptote = [
      `The numerator is exactly one degree higher (${f.degreeNum} against ${f.degreeDen}). Divide. The quotient is the slant asymptote ${math(f.asymptoteText)}. The remainder is not part of the line.`,
      `Horizontal or slant asymptote: ${math(f.asymptoteText)}.`,
    ]
  }
  const xint = [
    f.xIntercepts.length
      ? `The numerator is 0 at ${xsText(f.xIntercepts.map((p) => p.x))}, and ${f.xIntercepts.length === 1 ? 'that factor was' : 'those factors were'} not canceled, so ${f.xIntercepts.length === 1 ? 'the x-intercept is' : 'the x-intercepts are'} ${math(f.xIntText)}.`
      : 'Every numerator zero was canceled, or there is none, so there is no x-intercept.',
    `x-intercepts: ${math(f.xIntText)}.`,
  ]
  const yint = [
    f.yIntercept
      ? `f(0) = ${math(ratToString(f.yIntercept.y))}, and x = 0 is in the domain, so the y-intercept is ${math(f.yIntText)}.`
      : 'x = 0 makes the denominator 0, so there is no y-intercept.',
    `y-intercept: ${math(f.yIntText)}.`,
  ]
  return { domain, va, holes, asymptote, xint, yint }
}

/** The graph of the reduced function: the curve breaks only at vertical asymptotes, and a hole is an open dot. */
export function graphOfFeatures(f: RfFeatures): GraphSpec {
  const xs = [...f.vas, ...f.holes.map((h) => h.x), ...f.xIntercepts.map((p) => p.x)]
  const ys = [...f.holes.map((h) => h.y), ...f.xIntercepts.map((p) => p.y)]
  if (f.yIntercept) {
    xs.push(f.yIntercept.x)
    ys.push(f.yIntercept.y)
  }
  const lineSamples: number[] = []
  if (f.asymptote && f.asymptote.length <= 2) {
    const at = (x: number) => {
      let acc = 0
      for (let k = f.asymptote!.length - 1; k >= 0; k--) acc = acc * x + ratToNumber(f.asymptote![k]!)
      return acc
    }
    lineSamples.push(at(0), at(-2), at(2))
  }
  const values = [...xs.map((x) => ratToNumber(x)), ...ys.map((y) => ratToNumber(y)), ...lineSamples]
  return {
    kind: 'function',
    f: ratFnToText(f.reduced),
    fBreaks: f.vas.map((x) => ratToNumber(x)),
    xDomain: windowOf(values),
    guides: [
      ...f.vas.map((x) => ({ x: ratToNumber(x), label: `x = ${ratToString(x)}` })),
      ...(f.asymptote ? [{ expr: polyToText(f.asymptote), label: f.asymptoteText }] : []),
    ],
    dots: f.holes.map((h) => ({ x: ratToNumber(h.x), y: ratToNumber(h.y), closed: false })),
  }
}

function windowOf(values: readonly number[]): [number, number] {
  const vs = values.filter((v) => Number.isFinite(v))
  if (vs.length === 0) return [-8, 8]
  let lo = Math.min(...vs)
  let hi = Math.max(...vs)
  if (hi - lo < 8) {
    const mid = (lo + hi) / 2
    lo = mid - 4
    hi = mid + 4
  } else {
    lo -= 1
    hi += 1
  }
  return [lo, hi]
}

export function equationFromSides(left: RatFn, right: RatFn): RfEquation {
  if (polyIsZero(left.den) || polyIsZero(right.den)) throw new RfSkip('zero denominator')
  const cleared = polySub(polyMul(left.num, right.den), polyMul(right.num, left.den))
  if (polyIsZero(cleared)) throw new RfSkip('the equation is an identity')
  if (polyDeg(cleared) > 2) throw new RfSkip('clearing denominators leaves a degree above 2')
  const found = polyDeg(cleared) >= 1 ? rationalRoots(cleared) : { roots: [], mult: [], rest: cleared }
  if (polyDeg(found.rest) >= 1) throw new RfSkip('a candidate is not rational')
  const excluded = uniqueRats([...rootsOf(left.den).map((item) => item.r), ...rootsOf(right.den).map((item) => item.r)])
  const candidates = found.roots
  const solutions = candidates.filter((x) => !excluded.some((e) => ratEquals(e, x)))
  const eq: RfEquation = {
    left,
    right,
    candidates,
    excluded,
    solutions,
    solutionText: solutionText(solutions),
    explain: [],
  }
  eq.explain = explainEquation(eq)
  return eq
}

export function equationFromText(text: string): RfEquation {
  const parts = splitEquation(text)
  if (!parts) throw new RfSkip('an equation needs one = sign')
  const left = readSide(parts[0])
  const right = readSide(parts[1])
  return equationFromSides(left, right)
}

function readSide(text: string): RatFn {
  const read = readFormula(text)
  if (!read.ok || !read.ratFn) throw new RfSkip(read.ok ? `"${text}" is not a rational expression` : read.error.message)
  return read.ratFn
}

/** Split on the top-level = (the one not inside parentheses). */
export function splitEquation(text: string): [string, string] | null {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === '=' && depth === 0) {
      const left = text.slice(0, i).trim()
      const right = text.slice(i + 1).trim()
      if (!left || !right || right.includes('=')) return null
      return [left, right]
    }
  }
  return null
}

function uniqueRats(values: readonly Rational[]): Rational[] {
  const out: Rational[] = []
  for (const v of values) if (!out.some((u) => ratEquals(u, v))) out.push(v)
  return out.sort(ratCompare)
}

function explainEquation(eq: RfEquation): string[] {
  const lines: string[] = ['Clear the denominators, then solve the polynomial that is left.']
  if (eq.candidates.length === 0) {
    lines.push('That polynomial has no solution.')
  } else {
    lines.push(`The candidates are ${xsText(eq.candidates)}.`)
  }
  const dropped = eq.candidates.filter((x) => eq.excluded.some((e) => ratEquals(e, x)))
  if (dropped.length) {
    lines.push(`${xsText(dropped)} ${dropped.length === 1 ? 'makes' : 'make'} a denominator 0, so ${dropped.length === 1 ? 'it is' : 'they are'} not ${dropped.length === 1 ? 'a solution' : 'solutions'}.`)
  }
  lines.push(eq.solutions.length ? `The solution set is ${math(eq.solutionText)}.` : 'Nothing that is left makes the equation true, so there is no solution.')
  return lines
}

/** Both sides, for the graph. Vertical guides mark where a denominator is 0. */
export function graphOfEquation(leftText: string, rightText: string, eq: RfEquation): GraphSpec {
  const xs = [...eq.excluded, ...eq.solutions, ...eq.candidates].map((x) => ratToNumber(x))
  return {
    kind: 'function',
    f: leftText,
    fBreaks: eq.excluded.map((x) => ratToNumber(x)),
    extra: [{ expr: rightText, color: 'coral', style: 'dashed', label: 'right side' }],
    guides: eq.excluded.map((x) => ({ x: ratToNumber(x), label: `x = ${ratToString(x)}` })),
    xDomain: windowOf(xs),
  }
}

/** (d·x − n), the factor with root n/d and integer coefficients. */
export function linearFactor(root: Rational): Poly {
  return [rat(-root.n), rat(root.d)]
}

export function polyFromRoots(front: number, roots: readonly Rational[]): Poly {
  let p: Poly = front === 0 ? [] : [rat(front)]
  for (const root of roots) p = polyMul(p, linearFactor(root))
  return p
}

/** Divide by the leading term only, ignoring the rest of the divisor. A wrong quotient for a slant line. */
export function divideByLeadingTerm(num: Poly, den: Poly): Poly {
  const shift = polyDeg(den)
  const lead = polyLead(den)
  if (lead.n === 0) return []
  const acc: Rational[] = []
  for (let k = shift; k < num.length; k++) acc[k - shift] = ratDiv(num[k]!, lead)
  for (let i = 0; i < acc.length; i++) if (!acc[i]) acc[i] = rat(0)
  while (acc.length > 0 && acc[acc.length - 1]!.n === 0) acc.pop()
  return acc
}

export interface LeadParts {
  front: Rational
  inside: Rational
  constant: Rational
}

/** Leading coefficient = front × (product of each root's denominator, to its multiplicity). */
export function leadParts(p: Poly): LeadParts {
  const constant = p[0] ?? rat(0)
  if (polyDeg(p) < 1) return { front: polyLead(p), inside: rat(1), constant }
  const found = rationalRoots(p)
  let inside = rat(1)
  for (let i = 0; i < found.roots.length; i++) inside = ratMul(inside, rat(found.roots[i]!.d ** found.mult[i]!))
  return { front: ratDiv(polyLead(p), inside), inside, constant }
}

export { P_ONE, P_X, polyAdd, polyToText }
