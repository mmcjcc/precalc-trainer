/**
 * Grades one part of a rational-function problem. A named mistake is whatever that slip produces for
 * THIS function, compared exactly. A candidate equal to the right answer is never used, and when two
 * slips produce the same answer the earlier one keeps it.
 */
import type { Rational } from '@/shared/types'
import type { ErrorPatternId } from '@/shared/types'
import { readFormula, readNumber } from '@/engine/polynomials/common'
import { polyEquals, polyIsZero, polyLead, polyToText, type Poly } from '@/engine/functions/poly'
import { parseSetAnswer } from '@/engine/functions/answer'
import { gradeSetAgainst } from '@/engine/functions/common'
import { Unsupported } from '@/engine/functions/exact'
import { parsePointAnswer } from '@/engine/transformations/points'
import {
  allReals,
  emptySet,
  rat,
  ratCompare,
  ratDiv,
  ratEquals,
  ratToString,
  setDifference,
  setFromPieces,
  setIsEmpty,
  setIsSubset,
  setsEqual,
  type SolutionSet,
} from '@/notation'
import {
  domainText,
  leadParts,
  lineText,
  math,
  pointText,
  pointsText,
  polyAdd,
  samePoints,
  sameRats,
  sameRational,
  solutionText,
  vaText,
  divideByLeadingTerm,
  type RfEquation,
  type RfFeatures,
  type RfPoint,
} from './model'

export const RF_MISTAKE_IDS = [
  'rf_hole_as_asymptote',
  'rf_asymptote_from_numerator',
  'rf_hole_left_out',
  'rf_hole_y_unreduced',
  'rf_degree_rule',
  'rf_ratio_not_leading',
  'rf_slant_remainder',
  'rf_intercept_at_hole',
  'rf_intercept_swapped',
  'rf_extraneous_kept',
  'rf_valid_dropped',
] as const

export type RfMistakeId = (typeof RF_MISTAKE_IDS)[number]

export type RfStageId = 'domain' | 'va' | 'holes' | 'asymptote' | 'xint' | 'yint' | 'solution'

export type RfGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: RfMistakeId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

export interface RfTrap {
  id: RfMistakeId
  text: string
}

const NONE_WORD =
  /^(?:none|no\s+(?:vertical\s+|horizontal\s+|slant\s+)?asymptotes?|no\s+holes?|no\s+x-?intercepts?|no\s+y-?intercepts?|no\s+intercepts?|n\/a|∅|\{\}|dne|does\s+not\s+exist)$/i

const EMPTY_SOLUTION =
  /^(?:no\s+solutions?|none|empty(?:\s+set)?|no\s+real(?:\s+solutions?)?|undefined|undef|not\s+defined|n\/a|∅|\{\}|dne|does\s+not\s+exist)$/i

function correct(message: string): RfGrade {
  return { verdict: 'correct', message }
}

function mistake(id: RfMistakeId, witness: string): RfGrade {
  return { verdict: 'mistake', mistake: id, witness }
}

function wrong(message: string): RfGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): RfGrade {
  return { verdict: 'invalid', message }
}

function setOf(values: readonly Rational[]): SolutionSet {
  return setFromPieces([], [...values])
}

/** Top-level commas and "and", not commas inside parentheses. */
function splitList(text: string): string[] {
  let depth = 0
  let start = 0
  const parts: string[] = []
  const s = text
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && (c === ',' || c === ';')) {
      parts.push(s.slice(start, i))
      start = i + 1
    } else if (depth === 0 && s.slice(i, i + 5).toLowerCase() === ' and ') {
      parts.push(s.slice(start, i))
      start = i + 5
    }
  }
  parts.push(s.slice(start))
  return parts.map((p) => p.trim()).filter(Boolean)
}

function isOverflow(e: unknown): boolean {
  return e instanceof RangeError || e instanceof Unsupported
}

function readRat(text: string): Rational | null {
  try {
    const n = readNumber(text)
    return n.ok ? n.value : null
  } catch (e) {
    if (isOverflow(e)) return null
    throw e
  }
}

interface PointRead {
  none: boolean
  points: RfPoint[]
  /** Set when the text has no parentheses and every piece is a number. */
  numbers: Rational[] | null
}

function parsePointList(text: string): PointRead | RfGrade {
  const t = text.trim()
  if (!t) return invalid('Type your answer first.')
  if (NONE_WORD.test(t)) return { none: true, points: [], numbers: null }
  const pieces = splitList(t)
  if (t.includes('(')) {
    const points: RfPoint[] = []
    for (const piece of pieces) {
      const p = parsePointAnswer(piece)
      if (!p.ok) return invalid(p.error.message)
      if (!p.x || !p.y) return invalid('Each coordinate has to be a rational number, like 1/2 or -3.')
      points.push({ x: p.x, y: p.y })
    }
    if (points.length === 0) return invalid('Type a point, like (3, 1/2), or none.')
    return { none: false, points, numbers: null }
  }
  const numbers = pieces.every((piece) => readRat(piece) !== null) ? pieces.map((piece) => readRat(piece)!) : null
  const whole = parsePointAnswer(t)
  if (whole.ok && whole.x && whole.y) return { none: false, points: [{ x: whole.x, y: whole.y }], numbers }
  if (numbers) return { none: false, points: [], numbers }
  if (whole.ok) return invalid('Each coordinate has to be a rational number, like 1/2 or -3.')
  return invalid(whole.error.message)
}

function parseXs(text: string): Rational[] | RfGrade {
  const t = text.trim()
  if (!t) return invalid('Type your answer first.')
  if (NONE_WORD.test(t)) return []
  const values: Rational[] = []
  for (const piece of splitList(t)) {
    if (/^y\s*=/i.test(piece)) {
      return invalid('A vertical asymptote is a vertical line, x = a number, not y = …')
    }
    const body = piece.replace(/^x\s*=\s*/i, '')
    const n = readRat(body)
    if (!n) return invalid(`Could not read "${piece.trim()}" as x = a number.`)
    values.push(n)
  }
  return values
}

function asRead(parsed: PointRead | RfGrade): parsed is PointRead {
  return !('verdict' in parsed)
}

function domainSet(xs: readonly Rational[]): SolutionSet {
  return setDifference(allReals(), setFromPieces([], [...xs]))
}

export function gradeDomain(f: RfFeatures, text: string): RfGrade {
  const t = text.trim()
  if (!t) return invalid('Type your answer first.')
  if (NONE_WORD.test(t)) return invalid('The domain is an interval, or a union of intervals, not the word none.')
  let parsed: ReturnType<typeof parseSetAnswer>
  try {
    parsed = parseSetAnswer(t)
  } catch (e) {
    if (!isOverflow(e)) throw e
    return invalid('A number in that answer is too large to check exactly.')
  }
  if (!parsed.ok) return invalid(parsed.error.message)
  const excluded = [...f.vas, ...f.holes.map((h) => h.x)]
  const target = domainSet(excluded)
  const base = gradeSetAgainst(parsed.set, target, [], () => 'That is not the domain. A number is out exactly when the denominator is 0, and a hole counts.', `The domain is ${math(f.domainText)}.`)
  if (base.verdict === 'correct') return correct(base.message)
  if (base.verdict !== 'wrong') return wrong(base.verdict === 'mistake' ? base.witness : base.message)
  const onlyVas = domainSet(f.vas)
  if (f.holes.length > 0 && setsEqual(parsed.set, onlyVas) && !setsEqual(onlyVas, target)) {
    const missed = f.holes.map((h) => h.x)
    return mistake(
      'rf_hole_left_out',
      `${xsTextPhrase(missed)} ${missed.length === 1 ? 'is a hole, so it is' : 'are holes, so they are'} out of the domain too. Canceling a factor does not put that x-value back in.`,
    )
  }
  return wrong(base.message)
}

function xsTextPhrase(xs: readonly Rational[]): string {
  const shown = xs.map((x) => `x = ${math(ratToString(x))}`)
  if (shown.length === 1) return shown[0]!
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
}

export function gradeVertical(f: RfFeatures, text: string): RfGrade {
  const parsed = parseXs(text)
  if (!Array.isArray(parsed)) return parsed
  if (sameRats(parsed, f.vas)) return correct(f.vas.length ? `The vertical asymptotes are ${math(f.vaText)}.` : 'There is no vertical asymptote.')
  const withHoles = [...f.vas, ...f.holes.map((h) => h.x)]
  if (f.holes.length > 0 && sameRats(parsed, withHoles) && !sameRats(withHoles, f.vas)) {
    const shared = f.holes.map((h) => h.x)
    return mistake(
      'rf_hole_as_asymptote',
      `${xsTextPhrase(shared)} ${shared.length === 1 ? 'makes' : 'make'} both the top and the bottom 0, so ${shared.length === 1 ? 'it is a hole' : 'they are holes'}, not ${shared.length === 1 ? 'a vertical asymptote' : 'vertical asymptotes'}.`,
    )
  }
  const fromNum = f.xIntercepts.map((p) => p.x)
  if (fromNum.length > 0 && sameRats(parsed, fromNum) && !sameRats(fromNum, f.vas)) {
    return mistake(
      'rf_asymptote_from_numerator',
      `${xsTextPhrase(fromNum)} ${fromNum.length === 1 ? 'makes' : 'make'} the numerator 0, not the denominator. A vertical asymptote comes from a factor that is still in the denominator.`,
    )
  }
  return wrong('Those are not the vertical asymptotes. A vertical asymptote is a denominator zero that is still there after you cancel shared factors.')
}

export function gradeHoles(f: RfFeatures, text: string): RfGrade {
  const parsed = parsePointList(text)
  if (!asRead(parsed)) return parsed
  if (parsed.none && f.holes.length === 0) return correct('There is no hole.')
  if (!parsed.none && samePoints(parsed.points, f.holes)) return correct(f.holes.length === 1 ? `The hole is ${math(f.holesText)}.` : `The holes are ${math(f.holesText)}.`)
  if (f.holes.length > 0 && (parsed.none || isProperSubset(parsed.points, f.holes))) {
    const missed = f.holes.filter((h) => !parsed.points.some((p) => ratEquals(p.x, h.x) && ratEquals(p.y, h.y)))
    return mistake(
      'rf_hole_left_out',
      missed.length === 1
        ? `There is a hole at x = ${math(ratToString(missed[0]!.x))}. Its height, from the reduced function, is ${math(ratToString(missed[0]!.y))}.`
        : `Some holes are missing. Each canceled factor leaves a hole, and its height comes from the reduced function.`,
    )
  }
  const unreduced = f.holes.map((h) => ({ x: h.x, y: rat(0) }))
  if (f.holes.length > 0 && !parsed.none && samePoints(parsed.points, unreduced) && !samePoints(unreduced, f.holes)) {
    const sample = f.holes.find((h) => h.y.n !== 0) ?? f.holes[0]!
    return mistake(
      'rf_hole_y_unreduced',
      `At x = ${math(ratToString(sample.x))} the original function is 0/0, which is not a height. The reduced function gives ${math(ratToString(sample.y))}, so the hole is ${math(pointText(sample))}.`,
    )
  }
  if (parsed.numbers && parsed.points.length === 0) {
    return invalid('Write each hole as a point, like (3, 1/2). Type none if there are none.')
  }
  return wrong('Those are not the holes. A hole is a canceled factor, and its y-value comes from the reduced function.')
}

function isProperSubset(hers: readonly RfPoint[], holes: readonly RfPoint[]): boolean {
  if (hers.length === 0 || hers.length >= holes.length) return false
  return hers.every((p) => holes.some((h) => ratEquals(h.x, p.x) && ratEquals(h.y, p.y)))
}

function degreeRulePoly(f: RfFeatures): Poly | null {
  if (!f.asymptote) return null
  if (f.degreeNum === f.degreeDen) {
    const zero: Poly = []
    return polyEquals(zero, f.asymptote) ? null : zero
  }
  if (f.degreeNum < f.degreeDen || f.asymptoteKind === 'slant') {
    const ratio: Poly = [ratDiv(polyLead(f.num), polyLead(f.den))]
    return polyEquals(ratio, f.asymptote) ? null : ratio
  }
  return null
}

function ratioPolys(f: RfFeatures): Poly[] {
  const out: Poly[] = []
  const num = leadParts(f.num)
  const den = leadParts(f.den)
  const push = (p: Poly) => {
    if (f.asymptote && polyEquals(p, f.asymptote)) return
    const rule = degreeRulePoly(f)
    if (rule && polyEquals(p, rule)) return
    if (out.some((o) => polyEquals(o, p))) return
    out.push(p)
  }
  if (den.constant.n !== 0) push([ratDiv(num.constant, den.constant)])
  if (den.front.n !== 0) push([ratDiv(num.front, den.front)])
  if (den.inside.n !== 0) push([ratDiv(num.inside, den.inside)])
  if (f.asymptoteKind === 'slant' && den.constant.n !== 0) {
    const slope = ratDiv(num.constant, den.constant)
    if (slope.n !== 0) push([rat(0), slope])
  }
  return out
}

/** The slant line with the remainder added, and the quotient from dividing by the leading term only. */
function slantRemainderPolys(f: RfFeatures): Poly[] {
  if (f.asymptoteKind !== 'slant' || !f.asymptote) return []
  const asymptote = f.asymptote
  const out: Poly[] = []
  const push = (p: Poly) => {
    if (polyEquals(p, asymptote)) return
    if (out.some((o) => polyEquals(o, p))) return
    out.push(p)
  }
  if (!polyIsZero(f.remainder)) push(polyAdd(asymptote, f.remainder))
  push(divideByLeadingTerm(f.num, f.den))
  return out
}

interface LineRead {
  none: boolean
  poly: Poly | null
  ratFn: { num: Poly; den: Poly } | null
}

function parseLine(text: string): LineRead | RfGrade {
  const t = text.trim()
  if (!t) return invalid('Type your answer first.')
  if (/^x\s*=/i.test(t)) return invalid('The horizontal or slant asymptote is a line y = …, not a vertical line.')
  if (NONE_WORD.test(t)) return { none: true, poly: null, ratFn: null }
  let read: ReturnType<typeof readFormula>
  try {
    read = readFormula(t)
  } catch (e) {
    if (!isOverflow(e)) throw e
    return invalid('A number in that answer is too large to check exactly.')
  }
  if (!read.ok) return invalid(read.error.message)
  if (!read.poly && !read.ratFn) return invalid('Type the asymptote as an equation, like y = 2 or y = x + 1.')
  return { none: false, poly: read.poly, ratFn: read.ratFn }
}

export function gradeAsymptote(f: RfFeatures, text: string): RfGrade {
  const parsed = parseLine(text)
  if (!('none' in parsed)) return parsed
  const right = f.asymptote
  if (parsed.none && !right) return correct('There is no horizontal or slant asymptote.')
  if (!parsed.none && parsed.poly && right && polyEquals(parsed.poly, right)) {
    return correct(`The asymptote is ${math(f.asymptoteText)}.`)
  }
  const rule = degreeRulePoly(f)
  if (!parsed.none && parsed.poly && rule && polyEquals(parsed.poly, rule)) {
    return mistake('rf_degree_rule', degreeWitness(f))
  }
  for (const ratio of ratioPolys(f)) {
    if (!parsed.none && parsed.poly && polyEquals(parsed.poly, ratio)) {
      return mistake('rf_ratio_not_leading', ratioWitness(f, ratio))
    }
  }
  if (!parsed.none && parsed.poly) {
    for (const kept of slantRemainderPolys(f)) {
      if (polyEquals(parsed.poly, kept)) return mistake('rf_slant_remainder', slantWitness(f, kept))
    }
  }
  if (!parsed.none && parsed.ratFn && f.asymptoteKind === 'slant' && sameRational(parsed.ratFn, { num: f.num, den: f.den }) && !(parsed.poly && right && polyEquals(parsed.poly, right))) {
    return mistake('rf_slant_remainder', `That is f itself. The slant asymptote is the quotient ${math(f.asymptoteText)}, not the whole function.`)
  }
  if (parsed.none) return wrong('There is a horizontal or slant asymptote. Compare the degree of the numerator with the degree of the denominator.')
  return wrong('That is not the horizontal or slant asymptote. Compare the degrees, and if you divide, keep the quotient only.')
}

function degreeWitness(f: RfFeatures): string {
  if (f.degreeNum === f.degreeDen) {
    return `The degrees match, both ${f.degreeNum}, so the horizontal asymptote is the ratio of the leading coefficients, ${math(f.asymptoteText)}, not y = 0.`
  }
  if (f.degreeNum < f.degreeDen) {
    return `The numerator's degree (${f.degreeNum}) is lower than the denominator's (${f.degreeDen}), so the horizontal asymptote is y = 0, not the ratio of the leading coefficients.`
  }
  return `The numerator is one degree higher, so the asymptote is the slant line ${math(f.asymptoteText)}, not a horizontal line.`
}

function ratioWitness(f: RfFeatures, hers: Poly): string {
  const num = leadParts(f.num)
  const den = leadParts(f.den)
  const lead = ratDiv(polyLead(f.num), polyLead(f.den))
  const constant = den.constant.n !== 0 ? ratDiv(num.constant, den.constant) : null
  const hersLead = hers.length === 1 ? hers[0]! : null
  if (constant && hersLead && ratEquals(hersLead, constant)) {
    return `The constant terms are ${math(ratToString(num.constant))} and ${math(ratToString(den.constant))}. The horizontal asymptote uses the leading coefficients, ${math(ratToString(lead))}, so it is ${math(f.asymptoteText)}.`
  }
  return `That ratio is not the leading coefficients ${math(ratToString(polyLead(f.num)))} and ${math(ratToString(polyLead(f.den)))}. The asymptote is ${math(f.asymptoteText)}.`
}

function slantWitness(f: RfFeatures, hers: Poly): string {
  const kept = !polyIsZero(f.remainder) ? polyAdd(f.asymptote ?? [], f.remainder) : null
  if (kept && polyEquals(hers, kept)) {
    return `The remainder is ${math(polyToText(f.remainder))}. The slant asymptote is the quotient ${math(f.asymptoteText)}, and the remainder is not part of the line.`
  }
  return `That quotient is what you get from dividing by the leading term only. The slant asymptote is ${math(f.asymptoteText)}.`
}

export function gradeXIntercepts(f: RfFeatures, text: string): RfGrade {
  const parsed = parsePointList(text)
  if (!asRead(parsed)) return parsed
  if (parsed.none && f.xIntercepts.length === 0) return correct('There is no x-intercept.')
  if (!parsed.none && samePoints(parsed.points, f.xIntercepts)) {
    return correct(f.xIntercepts.length ? `The x-intercepts are ${math(f.xIntText)}.` : 'There is no x-intercept.')
  }
  const withHoles = [...f.xIntercepts, ...f.holes.map((h) => ({ x: h.x, y: rat(0) }))]
  if (f.holes.length > 0 && !parsed.none && samePoints(parsed.points, withHoles) && !samePoints(withHoles, f.xIntercepts)) {
    const canceled = f.holes.map((h) => h.x)
    return mistake(
      'rf_intercept_at_hole',
      `${xsTextPhrase(canceled)} ${canceled.length === 1 ? 'was' : 'were'} canceled, so the graph does not meet the x-axis there. ${f.xIntercepts.length ? `The x-intercepts are ${math(f.xIntText)}.` : 'There is no x-intercept.'}`,
    )
  }
  if (swappedPoints(parsed, f, 'xint')) return swappedGrade(f, 'xint')
  return wrong('Those are not the x-intercepts. An x-intercept is an uncanceled numerator zero, written as a point.')
}

export function gradeYIntercept(f: RfFeatures, text: string): RfGrade {
  const parsed = parsePointList(text)
  if (!asRead(parsed)) return parsed
  const right = f.yIntercept ? [f.yIntercept] : []
  if (parsed.none && !f.yIntercept) return correct('There is no y-intercept.')
  if (!parsed.none && samePoints(parsed.points, right)) return correct(f.yIntercept ? `The y-intercept is ${math(f.yIntText)}.` : 'There is no y-intercept.')
  if (swappedPoints(parsed, f, 'yint')) return swappedGrade(f, 'yint')
  return wrong('That is not the y-intercept. It is the point (0, f(0)), when x = 0 is in the domain.')
}

function swappedPoints(parsed: PointRead, f: RfFeatures, stage: 'xint' | 'yint'): boolean {
  if (stage === 'xint') {
    const other = f.yIntercept ? [f.yIntercept] : []
    if (!parsed.none && other.length > 0 && samePoints(parsed.points, other) && !samePoints(other, f.xIntercepts)) return true
    if (parsed.numbers && f.xIntercepts.length > 0 && sameRats(parsed.numbers, f.xIntercepts.map((p) => p.x))) return true
    return false
  }
  if (f.yIntercept && parsed.numbers && parsed.numbers.length === 1 && ratEquals(parsed.numbers[0]!, f.yIntercept.y)) return true
  if (!parsed.none && f.xIntercepts.length > 0 && samePoints(parsed.points, f.xIntercepts) && !(f.yIntercept && samePoints(f.xIntercepts, [f.yIntercept]))) return true
  return false
}

function swappedGrade(f: RfFeatures, stage: 'xint' | 'yint'): RfGrade {
  if (stage === 'xint') {
    return mistake(
      'rf_intercept_swapped',
      f.xIntercepts.length
        ? `An x-intercept is a point on the x-axis, not a bare number and not the y-intercept. ${f.xIntercepts.length === 1 ? 'It is' : 'They are'} ${math(f.xIntText)}.`
        : `That is the y-intercept. There is no x-intercept.`,
    )
  }
  return mistake(
    'rf_intercept_swapped',
    f.yIntercept
      ? `The y-intercept is the point ${math(f.yIntText)}, not the number ${math(ratToString(f.yIntercept.y))} and not an x-intercept.`
      : 'That is an x-intercept. x = 0 is not in the domain, so there is no y-intercept.',
  )
}

export function gradeSolution(eq: RfEquation, text: string): RfGrade {
  const parsed = parseSolution(text)
  if (!('set' in parsed)) return parsed
  const target = setOf(eq.solutions)
  const right = eq.solutions.length ? `The solution set is ${math(eq.solutionText)}.` : 'There is no solution.'
  const base = gradeSetAgainst(parsed.set, target, [], () => 'That is not the solution set. A value that makes a denominator 0 is not a solution, and a value that works has to stay.', right)
  if (base.verdict === 'correct') return correct(base.message)
  if (base.verdict !== 'wrong') return wrong(base.verdict === 'mistake' ? base.witness : base.message)
  const extras = setDifference(parsed.set, target)
  const missing = setDifference(target, parsed.set)
  const excl = setOf(eq.excluded)
  if (setIsEmpty(missing) && !setIsEmpty(extras) && setIsSubset(extras, excl)) {
    const kept = eq.excluded.filter((e) => !eq.solutions.some((s) => ratEquals(s, e)) && containsRat(parsed.set, e))
    return mistake(
      'rf_extraneous_kept',
      `${xsTextPhrase(kept.length ? kept : eq.excluded)} ${kept.length === 1 || eq.excluded.length === 1 ? 'makes' : 'make'} a denominator 0, so ${kept.length === 1 ? 'it is' : 'that value is'} not a solution. ${right}`,
    )
  }
  if (!setIsEmpty(missing) && setIsSubset(extras, excl)) {
    const dropped = eq.solutions.filter((s) => !containsRat(parsed.set, s))
    return mistake(
      'rf_valid_dropped',
      `${xsTextPhrase(dropped)} ${dropped.length === 1 ? 'makes' : 'make'} the equation true and ${dropped.length === 1 ? 'does' : 'do'} not make a denominator 0, so ${dropped.length === 1 ? 'it stays' : 'they stay'}. ${right}`,
    )
  }
  return wrong(base.message)
}

function containsRat(set: SolutionSet, x: Rational): boolean {
  return set.points.some((p) => ratEquals(p, x)) || false
}

function parseSolution(text: string): { set: SolutionSet } | RfGrade {
  const t = text.trim()
  if (!t) return invalid('Type your answer first.')
  if (EMPTY_SOLUTION.test(t)) return { set: emptySet() }
  try {
    const parsed = parseSetAnswer(t)
    if (parsed.ok) return { set: parsed.set }
    const pieces = splitList(t)
    const values = pieces.map((piece) => readRat(piece))
    if (values.every((v): v is Rational => v !== null)) return { set: setOf(values) }
    return invalid(parsed.error.message)
  } catch (e) {
    if (!isOverflow(e)) throw e
    return invalid('A number in that answer is too large to check exactly.')
  }
}

export function gradeFeatureStage(f: RfFeatures, stage: Exclude<RfStageId, 'solution'>, text: string): RfGrade {
  switch (stage) {
    case 'domain':
      return gradeDomain(f, text)
    case 'va':
      return gradeVertical(f, text)
    case 'holes':
      return gradeHoles(f, text)
    case 'asymptote':
      return gradeAsymptote(f, text)
    case 'xint':
      return gradeXIntercepts(f, text)
    case 'yint':
      return gradeYIntercept(f, text)
  }
}

function rawFeatureTraps(f: RfFeatures, stage: Exclude<RfStageId, 'solution'>): RfTrap[] {
  const out: RfTrap[] = []
  if (stage === 'domain' && f.holes.length > 0) out.push({ id: 'rf_hole_left_out', text: domainText(f.vas) })
  if (stage === 'va' && f.holes.length > 0) out.push({ id: 'rf_hole_as_asymptote', text: vaText([...f.vas, ...f.holes.map((h) => h.x)]) })
  if (stage === 'va' && f.xIntercepts.length > 0) out.push({ id: 'rf_asymptote_from_numerator', text: vaText(f.xIntercepts.map((p) => p.x)) })
  if (stage === 'holes' && f.holes.length > 0) {
    out.push({ id: 'rf_hole_left_out', text: 'none' })
    out.push({ id: 'rf_hole_y_unreduced', text: pointsText(f.holes.map((h) => ({ x: h.x, y: rat(0) }))) })
  }
  if (stage === 'asymptote') {
    const rule = degreeRulePoly(f)
    if (rule) out.push({ id: 'rf_degree_rule', text: lineText(rule) })
    for (const ratio of ratioPolys(f)) out.push({ id: 'rf_ratio_not_leading', text: lineText(ratio) })
    for (const kept of slantRemainderPolys(f)) out.push({ id: 'rf_slant_remainder', text: lineText(kept) })
    if (f.asymptoteKind === 'slant') out.push({ id: 'rf_slant_remainder', text: `y = (${polyToText(f.num)})/(${polyToText(f.den)})` })
  }
  if (stage === 'xint' && f.holes.length > 0) {
    out.push({ id: 'rf_intercept_at_hole', text: pointsText([...f.xIntercepts, ...f.holes.map((h) => ({ x: h.x, y: rat(0) }))]) })
  }
  if (stage === 'xint') {
    if (f.xIntercepts.length > 0) out.push({ id: 'rf_intercept_swapped', text: [...f.xIntercepts].sort((a, b) => ratCompare(a.x, b.x)).map((p) => ratToString(p.x)).join(', ') })
    else if (f.yIntercept) out.push({ id: 'rf_intercept_swapped', text: pointText(f.yIntercept) })
  }
  if (stage === 'yint') {
    if (f.yIntercept) out.push({ id: 'rf_intercept_swapped', text: ratToString(f.yIntercept.y) })
    else if (f.xIntercepts.length > 0) out.push({ id: 'rf_intercept_swapped', text: pointsText(f.xIntercepts) })
  }
  return out
}

export function featureTraps(f: RfFeatures, stage: Exclude<RfStageId, 'solution'>): RfTrap[] {
  const out: RfTrap[] = []
  for (const cand of rawFeatureTraps(f, stage)) {
    const g = gradeFeatureStage(f, stage, cand.text)
    if (g.verdict === 'mistake' && g.mistake === cand.id && !out.some((o) => o.id === cand.id)) out.push(cand)
  }
  return out
}

export function solutionTraps(eq: RfEquation): RfTrap[] {
  const out: RfTrap[] = []
  const extras = eq.excluded.filter((e) => !eq.solutions.some((s) => ratEquals(s, e)))
  if (extras.length > 0) {
    const kept = solutionText([...eq.solutions, ...extras])
    const g = gradeSolution(eq, kept)
    if (g.verdict === 'mistake' && g.mistake === 'rf_extraneous_kept') out.push({ id: 'rf_extraneous_kept', text: kept })
  }
  if (eq.solutions.length > 0) {
    const dropped = 'no solution'
    const g = gradeSolution(eq, dropped)
    if (g.verdict === 'mistake' && g.mistake === 'rf_valid_dropped') out.push({ id: 'rf_valid_dropped', text: dropped })
    if (extras.length > 0) {
      const onlyExtra = solutionText(extras)
      const g2 = gradeSolution(eq, onlyExtra)
      if (g2.verdict === 'mistake' && g2.mistake === 'rf_valid_dropped' && !out.some((o) => o.id === 'rf_valid_dropped')) {
        out.push({ id: 'rf_valid_dropped', text: onlyExtra })
      }
    }
  }
  return out
}

export function isRfMistake(id: string): id is RfMistakeId {
  return (RF_MISTAKE_IDS as readonly string[]).includes(id)
}

export function rfMistakeId(id: ErrorPatternId): RfMistakeId | null {
  return isRfMistake(id) ? id : null
}
