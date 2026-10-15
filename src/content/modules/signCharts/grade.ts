/**
 * Grades one part of a sign-chart problem. A named mistake is whatever that slip produces for
 * THIS inequality, compared exactly. A candidate equal to the right answer is never used, and when
 * two slips produce the same answer the earlier one keeps it.
 */
import type { ErrorPatternId, Rational, SolutionSet } from '@/shared/types'
import { readRow } from '@/engine/polynomials/common'
import { parseSetAnswer } from '@/engine/functions/answer'
import { Unsupported } from '@/engine/functions/exact'
import { emptySet, ratCompare, ratEquals, ratToString, setsEqual } from '@/notation'
import {
  criticalText,
  evenFlipSigns,
  flippedSigns,
  math,
  nonstrict,
  omitCritical,
  signsText,
  solutionFrom,
  solutionTextOf,
  wantSign,
  type BracketMode,
  type Rel,
  type ScCritical,
  type ScProblem,
  type ScSign,
  ScSkip,
} from './model'

export const SC_MISTAKE_IDS = [
  'sc_denominator_included',
  'sc_endpoints_wrong',
  'sc_even_sign_flip',
  'sc_signs_reversed',
  'sc_not_one_side',
  'sc_multiplied_by_denominator',
  'sc_critical_missing',
  'sc_wrong_intervals',
] as const

export type ScMistakeId = (typeof SC_MISTAKE_IDS)[number]

export type ScStageId = 'critical' | 'signs' | 'solution'

export type ScGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: ScMistakeId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

export interface ScTrap {
  id: ScMistakeId
  stage: ScStageId
  text: string
}

const EMPTY_SOLUTION =
  /^(?:no\s+solutions?|none|empty(?:\s+set)?|no\s+real(?:\s+solutions?)?|∅|\{\}|dne|does\s+not\s+exist)$/i

const NONE_CRITICAL = /^(?:none|no\s+critical\s+numbers?|no\s+numbers?|∅|\{\}|n\/a)$/i

function correct(message: string): ScGrade {
  return { verdict: 'correct', message }
}

function mistake(id: ScMistakeId, witness: string): ScGrade {
  return { verdict: 'mistake', mistake: id, witness }
}

function wrong(message: string): ScGrade {
  return { verdict: 'wrong', message }
}

function invalid(message: string): ScGrade {
  return { verdict: 'invalid', message }
}

function rightSolution(p: ScProblem): string {
  return p.chart.solutionText === 'no solution' ? 'There is no solution.' : `The solution is ${math(p.chart.solutionText)}.`
}

function slipText(set: SolutionSet): string {
  return solutionTextOf(set)
}

interface SetCand {
  id: ScMistakeId
  set: SolutionSet
  witness: string
}

function solutionCandidates(p: ScProblem): SetCand[] {
  const chart = p.chart
  const target = chart.solution
  const right = rightSolution(p)
  const out: SetCand[] = []
  const add = (id: ScMistakeId, set: SolutionSet | null, witness: string) => {
    if (!set) return
    if (setsEqual(set, target)) return
    if (out.some((c) => setsEqual(c.set, set))) return
    out.push({ id, set, witness })
  }
  const from = (signs: readonly ScSign[], mode: BracketMode) => solutionFrom(chart.criticals, signs, chart.op, mode)

  const dens = chart.criticals.filter((c) => c.denMult > 0)
  if (dens.length > 0) {
    const set = from(chart.signs, 'includeDen')
    const names = dens.map((c) => `x = ${math(ratToString(c.x))}`).join(' and ')
    add(
      'sc_denominator_included',
      set,
      `${names} ${dens.length === 1 ? 'makes' : 'make'} the denominator 0, so the expression is not a number there. Including ${dens.length === 1 ? 'it' : 'them'} gives ${math(slipText(set))}. ${right}`,
    )
  }

  const zeros = chart.criticals.filter((c) => c.numMult > 0 && c.denMult === 0)
  if (zeros.length > 0) {
    const set = from(chart.signs, 'flipEndpoints')
    const sample = zeros[0]!
    add(
      'sc_endpoints_wrong',
      set,
      `x = ${math(ratToString(sample.x))} is a zero of the numerator. The inequality is ${prettyOp(chart.op)}, so that endpoint ${nonstrict(chart.op) ? 'is included' : 'is not included'}. ${math(slipText(set))} has that backwards. ${right}`,
    )
  }

  const evens = chart.criticals.filter((c) => c.exponent !== 0 && c.exponent % 2 === 0)
  const evenSigns = evenFlipSigns(chart.criticals, chart.signs)
  if (evens.length > 0 && signsText(evenSigns) !== signsText(chart.signs)) {
    const set = from(evenSigns, 'true')
    const sample = evens[0]!
    add(
      'sc_even_sign_flip',
      set,
      `The power at x = ${math(ratToString(sample.x))} is even, so the sign does not change there. Changing it gives ${math(slipText(set))}. ${right}`,
    )
  }

  const reversed = flippedSigns(chart.signs)
  if (signsText(reversed) !== signsText(chart.signs)) {
    const set = solutionFrom(chart.criticals, reversed, closedOp(chart.op), 'true')
    add(
      'sc_signs_reversed',
      set,
      `The signs are ${signsText(chart.signs)}, not ${signsText(reversed)}. Reading every sign the other way gives ${math(slipText(set))}. ${right}`,
    )
  }

  if (p.notOneSide && p.notOneSideText) {
    add(
      'sc_not_one_side',
      p.notOneSide,
      `${math(p.inequality)} is not the same as ${math(p.notOneSideText)}. That gives ${math(slipText(p.notOneSide))}. ${right}`,
    )
  }

  if (p.multiplied && p.multipliedText) {
    add(
      'sc_multiplied_by_denominator',
      p.multiplied,
      `Multiplying both sides by the denominator gives ${math(p.multipliedText)}, which is ${math(slipText(p.multiplied))}. The denominator's sign is not known, so that is not the solution. ${right}`,
    )
  }

  for (const index of omissionOrder(chart.criticals)) {
    const dropped = chart.criticals[index]!
    const omitted = omitCritical(chart.criticals, chart.signs, index)
    const set = solutionFrom(omitted.criticals, omitted.signs, chart.op, 'true')
    add(
      'sc_critical_missing',
      set,
      `Leaving out x = ${math(ratToString(dropped.x))} joins the intervals on either side of it, and that gives ${math(slipText(set))}. ${right}`,
    )
  }

  const other = from(reversed, 'noIsolated')
  const want = wantSign(chart.op)
  const wrongIntervals = (set: SolutionSet) =>
    add(
      'sc_wrong_intervals',
      set,
      `The signs are ${signsText(chart.signs)}, so the solution is where the expression is ${want === '+' ? 'positive' : 'negative'}. The other intervals are ${math(slipText(set))}. ${right}`,
    )
  wrongIntervals(other)
  // The exact complement too: (-inf, 1) U (2, inf) for (x - 1)(x - 2) <= 0.
  wrongIntervals(solutionFrom(chart.criticals, chart.signs, negated(chart.op), 'true'))
  return out
}

function omissionOrder(criticals: readonly ScCritical[]): number[] {
  const dens: number[] = []
  const rest: number[] = []
  criticals.forEach((c, i) => (c.denMult > 0 ? dens : rest).push(i))
  return [...dens, ...rest]
}

function prettyOp(op: Rel): string {
  if (op === '<=') return '≤'
  if (op === '>=') return '≥'
  return op
}

/** Flipping every sign is graded with ≤ or ≥ brackets, so a strict inequality still closes a numerator zero. */
/** The inequality that holds exactly where op does not (on the domain): <= becomes >, < becomes >=. */
function negated(op: Rel): Rel {
  return op === '<' ? '>=' : op === '<=' ? '>' : op === '>' ? '<=' : '<'
}

function closedOp(op: Rel): Rel {
  if (op === '<') return '<='
  if (op === '>') return '>='
  return op
}

interface SignCand {
  id: ScMistakeId
  signs: ScSign[]
  witness: string
}

function signCandidates(p: ScProblem): SignCand[] {
  const chart = p.chart
  const right = signsText(chart.signs)
  const out: SignCand[] = []
  const add = (id: ScMistakeId, signs: ScSign[], witness: string) => {
    if (signsText(signs) === right) return
    if (out.some((c) => signsText(c.signs) === signsText(signs))) return
    out.push({ id, signs, witness })
  }
  const evens = chart.criticals.filter((c) => c.exponent !== 0 && c.exponent % 2 === 0)
  const evenSigns = evenFlipSigns(chart.criticals, chart.signs)
  if (evens.length > 0) {
    const sample = evens[0]!
    add(
      'sc_even_sign_flip',
      evenSigns,
      `The power at x = ${math(ratToString(sample.x))} is even, so the sign does not change there. The signs are ${right}, not ${signsText(evenSigns)}.`,
    )
  }
  const reversed = flippedSigns(chart.signs)
  add(
    'sc_signs_reversed',
    reversed,
    `Those signs are the opposite of this expression. The signs are ${right}, not ${signsText(reversed)}.`,
  )
  return out
}

interface ListCand {
  id: ScMistakeId
  values: Rational[]
  witness: string
}

function listCandidates(p: ScProblem): ListCand[] {
  const chart = p.chart
  const right = chart.criticalText
  const out: ListCand[] = []
  for (const index of omissionOrder(chart.criticals)) {
    const dropped = chart.criticals[index]!
    const values = chart.criticals.filter((_, i) => i !== index).map((c) => c.x)
    const text = criticalText(values.map((x) => ({ x })))
    if (text === right) continue
    if (out.some((c) => sameSequence(c.values, values))) continue
    out.push({
      id: 'sc_critical_missing',
      values,
      witness: `x = ${math(ratToString(dropped.x))} is also a critical number. The critical numbers are ${math(right)}.`,
    })
  }
  return out
}

function sameSequence(a: readonly Rational[], b: readonly Rational[]): boolean {
  return a.length === b.length && a.every((r, i) => ratEquals(r, b[i]!))
}

function sameMultiset(a: readonly Rational[], b: readonly Rational[]): boolean {
  if (a.length !== b.length) return false
  const as = [...a].sort(ratCompare)
  const bs = [...b].sort(ratCompare)
  return as.every((r, i) => ratEquals(r, bs[i]!))
}

export function stageTraps(p: ScProblem, stage: ScStageId): ScTrap[] {
  if (stage === 'solution') {
    return solutionCandidates(p).map((c) => ({ id: c.id, stage, text: slipText(c.set) }))
  }
  if (stage === 'signs') {
    return signCandidates(p).map((c) => ({ id: c.id, stage, text: signsText(c.signs) }))
  }
  return listCandidates(p).map((c) => ({ id: c.id, stage, text: criticalText(c.values.map((x) => ({ x }))) }))
}

function parseSolution(text: string): { set: SolutionSet } | ScGrade {
  const t = text.trim()
  if (!t) return invalid('Type the solution set first.')
  if (EMPTY_SOLUTION.test(t)) return { set: emptySet() }
  try {
    const parsed = parseSetAnswer(t)
    if (!parsed.ok) return invalid(parsed.error.message)
    return { set: parsed.set }
  } catch (e) {
    if (e instanceof Unsupported || e instanceof RangeError) return invalid('A number in that answer is too large to check exactly.')
    throw e
  }
}

export function gradeSolution(p: ScProblem, text: string): ScGrade {
  const parsed = parseSolution(text)
  if (!('set' in parsed)) return parsed
  if (setsEqual(parsed.set, p.chart.solution)) {
    return correct(p.chart.solutionText === 'no solution' ? 'Correct: there is no solution.' : `Correct: the solution is ${math(p.chart.solutionText)}.`)
  }
  for (const cand of solutionCandidates(p)) {
    if (setsEqual(parsed.set, cand.set)) return mistake(cand.id, cand.witness)
  }
  return wrong('That is not the solution set. Check each interval, and include a zero only for ≤ or ≥.')
}

function parseSigns(text: string, n: number): { signs: ScSign[] } | ScGrade {
  const raw = text.trim()
  if (!raw) return invalid('Choose + or − for every interval.')
  const norm = raw.replace(/[−–—]/g, '-')
  let tokens: string[]
  if (norm.includes(',')) {
    tokens = norm.split(',').map((part) => part.trim())
    if (tokens.some((part) => part === '')) return invalid('Choose + or − for every interval.')
  } else {
    const compact = norm.replace(/\s+/g, '')
    tokens = /^[+-]+$/.test(compact) ? [...compact] : norm.split(/\s+/)
  }
  if (tokens.length !== n) return invalid(`Type one sign for each interval (${n} in all).`)
  const signs: ScSign[] = []
  for (const token of tokens) {
    const sign = signToken(token)
    if (!sign) return invalid('Each sign should be + or −.')
    signs.push(sign)
  }
  return { signs }
}

/** Whole words before the short ones, so "positive" is not read as "pos" plus leftover. */
function signToken(token: string): ScSign | null {
  const t = token.trim().toLowerCase().replace(/[−–—]/g, '-')
  if (t === '+' || t === 'positive' || t === 'pos') return '+'
  if (t === '-' || t === 'negative' || t === 'neg') return '-'
  return null
}

export function gradeSigns(p: ScProblem, text: string): ScGrade {
  const parsed = parseSigns(text, p.chart.signs.length)
  if (!('signs' in parsed)) return parsed
  const right = signsText(p.chart.signs)
  if (signsText(parsed.signs) === right) return correct(`Correct: the signs are ${right}.`)
  for (const cand of signCandidates(p)) {
    if (signsText(parsed.signs) === signsText(cand.signs)) return mistake(cand.id, cand.witness)
  }
  return wrong('Those are not the signs of this expression. Check a test point in each interval.')
}

function parseCritical(text: string): { values: Rational[] } | ScGrade {
  const t = text.trim()
  if (!t) return invalid('Type the critical numbers first.')
  if (NONE_CRITICAL.test(t)) return { values: [] }
  const row = readRow(t, 'critical numbers')
  if (!row.ok) return invalid(row.message)
  if (row.values.some((v) => v === null)) return invalid('Write each critical number as a fraction or a whole number.')
  return { values: row.values.filter((v): v is Rational => v !== null) }
}

export function gradeCritical(p: ScProblem, text: string): ScGrade {
  const parsed = parseCritical(text)
  if (!('values' in parsed)) return parsed
  const rightValues = p.chart.criticals.map((c) => c.x)
  const right = p.chart.criticalText
  if (sameSequence(parsed.values, rightValues)) {
    return correct(right === 'none' ? 'Correct: there is no critical number.' : `Correct: the critical numbers are ${math(right)}.`)
  }
  if (sameMultiset(parsed.values, rightValues)) return wrong('Those are the right numbers, but list them from least to greatest.')
  // A named slip is named in any order: "2, 1" for -1, 1, 2 is a missing critical number first, an order second.
  for (const cand of listCandidates(p)) {
    if (sameMultiset(parsed.values, cand.values)) return mistake(cand.id, cand.witness)
  }
  return wrong('That is not the list of critical numbers.')
}

export function gradeScPart(p: ScProblem, stage: ScStageId, text: string): ScGrade {
  try {
    if (stage === 'critical') return gradeCritical(p, text)
    if (stage === 'signs') return gradeSigns(p, text)
    return gradeSolution(p, text)
  } catch (e) {
    if (e instanceof ScSkip || e instanceof Unsupported || e instanceof RangeError) {
      return invalid('This answer could not be checked exactly.')
    }
    throw e
  }
}

export function isScMistake(id: string): id is ScMistakeId {
  return (SC_MISTAKE_IDS as readonly string[]).includes(id)
}

export function scMistakeId(id: ErrorPatternId): ScMistakeId | null {
  return isScMistake(id) ? id : null
}
