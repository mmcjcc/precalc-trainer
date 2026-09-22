/**
 * Grade a "reading a graph" answer.
 *
 * Intervals go through the notation parser, so a backwards interval, a missing U, a bracket on ∞,
 * and the other notation mistakes keep their own pattern ids. Point lists are "(x, y)" separated
 * by "and" or a comma, or "none". U between points is the headline mistake: U joins intervals.
 */
import type { AnswerSpec } from '@/content/types'
import { patternHit } from '@/engine/matchers/catalog'
import {
  compareAnswerSet,
  normalizeSet,
  parseInterval,
  ratToNumber,
  setContains,
  setsEqual,
  type IntervalParseResult,
} from '@/notation'
import type { PatternHit, Piece, SolutionSet } from '@/shared/types'
import { formatQuarter, joinPoints, near, type XY } from './format'

export type GfAnswer = Extract<AnswerSpec, { type: 'graphFeatures' }>

export type GfFieldId = 'increasing' | 'decreasing' | 'globalMax' | 'globalMin' | 'localMax' | 'localMin'

export interface GfEntries {
  increasing: string
  decreasing: string
  globalMax: string
  globalMin: string
  localMax: string
  localMin: string
}

export interface GfFieldGrade {
  id: GfFieldId
  status: 'ok' | 'wrong' | 'empty' | 'unchecked'
  /** Specific sentence for this box. Set when wrong or empty. */
  message?: string
  pattern?: PatternHit
}

export interface GfGrade {
  correct: boolean
  /** A box was left blank: nothing was graded and nothing should be recorded. */
  incomplete: boolean
  fields: GfFieldGrade[]
  /** Distinct named mistakes, field order, first witness kept. */
  patterns: PatternHit[]
}

export const GF_PATTERN_IDS = [
  'gf_union_between_points',
  'gf_y_for_intervals',
  'gf_brackets_at_turns',
  'gf_swapped_inc_dec',
  'gf_global_on_ray',
  'gf_global_not_local',
  'gf_not_turning_point',
  'gf_swapped_coordinates',
] as const

const FIELD_LABEL: Record<GfFieldId, string> = {
  increasing: 'increasing interval',
  decreasing: 'decreasing interval',
  globalMax: 'global max',
  globalMin: 'global min',
  localMax: 'local max',
  localMin: 'local min',
}

export function canonicalEntries(answer: GfAnswer): GfEntries {
  return {
    increasing: answer.increasing,
    decreasing: answer.decreasing,
    globalMax: answer.globalMax,
    globalMin: answer.globalMin,
    localMax: answer.localMax,
    localMin: answer.localMin,
  }
}

export function gradeGraphFeatures(answer: GfAnswer, entries: GfEntries): GfGrade {
  const ids: GfFieldId[] = ['increasing', 'decreasing', 'globalMax', 'globalMin', 'localMax', 'localMin']
  if (ids.some((id) => entries[id].trim() === '')) {
    return {
      correct: false,
      incomplete: true,
      patterns: [],
      fields: ids.map((id) =>
        entries[id].trim() === ''
          ? { id, status: 'empty', message: `Type the ${FIELD_LABEL[id]}.` }
          : { id, status: 'unchecked' },
      ),
    }
  }

  const [increasing, decreasing] = gradeIntervals(answer, entries.increasing, entries.decreasing)
  const fields: GfFieldGrade[] = [
    increasing,
    decreasing,
    gradePoints(answer, 'globalMax', entries.globalMax, answer.globalMaxPoint ? [answer.globalMaxPoint] : []),
    gradePoints(answer, 'globalMin', entries.globalMin, answer.globalMinPoint ? [answer.globalMinPoint] : []),
    gradePoints(answer, 'localMax', entries.localMax, answer.localMaxPoints),
    gradePoints(answer, 'localMin', entries.localMin, answer.localMinPoints),
  ]
  const patterns: PatternHit[] = []
  for (const f of fields) {
    if (f.pattern && !patterns.some((p) => p.id === f.pattern!.id)) patterns.push(f.pattern)
  }
  return { correct: fields.every((f) => f.status === 'ok'), incomplete: false, fields, patterns }
}

// ---------------------------------------------------------------------------
// Intervals
// ---------------------------------------------------------------------------

function gradeIntervals(answer: GfAnswer, incText: string, decText: string): [GfFieldGrade, GfFieldGrade] {
  const inc = parseInterval(incText)
  const dec = parseInterval(decText)
  const swapWitness = `Increasing and decreasing are swapped. Increasing is ${answer.increasing}; decreasing is ${answer.decreasing}.`
  const incSwapped = inc.ok && setsEqual(inc.set, answer.decreasingSet) && !setsEqual(inc.set, answer.increasingSet)
  const decSwapped = dec.ok && setsEqual(dec.set, answer.increasingSet) && !setsEqual(dec.set, answer.decreasingSet)
  return [
    gradeIntervalField('increasing', incText, inc, answer.increasingSet, answer.increasing, answer, incSwapped ? swapWitness : null),
    gradeIntervalField('decreasing', decText, dec, answer.decreasingSet, answer.decreasing, answer, decSwapped ? swapWitness : null),
  ]
}

function gradeIntervalField(
  id: 'increasing' | 'decreasing',
  text: string,
  parsed: IntervalParseResult,
  target: SolutionSet,
  targetText: string,
  answer: GfAnswer,
  swapWitness: string | null,
): GfFieldGrade {
  const name = id === 'increasing' ? 'increasing' : 'decreasing'
  if (!parsed.ok) {
    const pattern = parsed.pattern ? { ...parsed.pattern, witness: parsed.pattern.witness ?? parsed.error.message } : undefined
    return { id, status: 'wrong', message: parsed.error.message, pattern }
  }
  if (setsEqual(parsed.set, target)) return { id, status: 'ok' }
  if (swapWitness) {
    return { id, status: 'wrong', message: swapWitness, pattern: patternHit('gf_swapped_inc_dec', swapWitness) }
  }
  if (usedYValues(text, answer.turns)) {
    const witness = `Those endpoints are heights of the turning points, not their x-values. This graph is ${name} on ${targetText}.`
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_y_for_intervals', witness) }
  }
  if (setsEqual(opened(parsed.set), target)) {
    const witness = `At each labelled turn the graph is flat for an instant, so that x is not included. Write ${targetText} — parentheses at the turns.`
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_brackets_at_turns', witness) }
  }
  const cmp = compareAnswerSet(parsed.set, target, 'x')
  if (cmp.pattern?.id === 'endpoint_type') {
    const witness = `At each labelled turn the graph is flat for an instant, so that x is not included. Write ${targetText} — parentheses at the turns.`
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_brackets_at_turns', witness) }
  }
  if (cmp.pattern) {
    const witness =
      cmp.pattern.id === 'dropped_union'
        ? `A piece is missing. This graph is ${name} on ${targetText}.`
        : `This graph is ${name} on ${targetText}.`
    return { id, status: 'wrong', message: witness, pattern: patternHit(cmp.pattern.id, witness) }
  }
  const message = plainInterval(name, target, targetText, cmp.witness)
  return { id, status: 'wrong', message }
}

function plainInterval(name: string, target: SolutionSet, targetText: string, witness: ReturnType<typeof compareAnswerSet>['witness']): string {
  if (!witness) return `This graph is ${name} on ${targetText}.`
  const w = niceEndpoint(witness)
  return setContains(target, witness)
    ? `x = ${w} is where the graph is ${name}, but your interval leaves it out. This graph is ${name} on ${targetText}.`
    : `x = ${w} is not where the graph is ${name}, but your interval includes it. This graph is ${name} on ${targetText}.`
}

function niceEndpoint(v: NonNullable<ReturnType<typeof compareAnswerSet>['witness']>): string {
  return formatQuarter(ratToNumber(v))
}

/** Every number she wrote is a turning-point height, and at least one is not an x-value. */
function usedYValues(text: string, turns: GfAnswer['turns']): boolean {
  const nums = numbersIn(text)
  if (nums.length === 0) return false
  const xs = turns.map((t) => t.x)
  const ys = turns.map((t) => t.y)
  const inList = (n: number, list: number[]) => list.some((v) => near(v, n))
  return nums.every((n) => inList(n, ys)) && nums.some((n) => !inList(n, xs))
}

function numbersIn(text: string): number[] {
  const masked = text.replace(/[−–—]/g, '-').replace(/-?\b(?:inf|infinity|oo)\b/gi, ' ')
  const re = /[+-]?(?:\d+\.\d+|\d+|\.\d+)(?:\s*\/\s*[+-]?\d+)?/g
  const out: number[] = []
  for (const m of masked.matchAll(re)) {
    const n = parseNum(m[0])
    if (n !== null) out.push(n)
  }
  return out
}

function opened(set: SolutionSet): SolutionSet {
  return normalizeSet({
    pieces: set.pieces.map((p) => ({ ...p, loClosed: false, hiClosed: false }) satisfies Piece),
    points: set.points,
  })
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

type PointParse =
  | { kind: 'none' }
  | { kind: 'union'; raw: string; points: XY[] }
  | { kind: 'or' }
  | { kind: 'infinity'; raw: string }
  | { kind: 'points'; points: XY[] }
  | { kind: 'bad'; message: string }

function gradePoints(answer: GfAnswer, id: 'globalMax' | 'globalMin' | 'localMax' | 'localMin', text: string, expected: XY[]): GfFieldGrade {
  const parsed = parsePointAnswer(text)
  const which = id.endsWith('Max') ? 'max' : 'min'
  const expectedText = joinPoints(expected)
  if (parsed.kind === 'bad') return { id, status: 'wrong', message: parsed.message }
  if (parsed.kind === 'union') {
    const witness = unionWitness(parsed.raw, parsed.points, expectedText)
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_union_between_points', witness) }
  }
  if (parsed.kind === 'or') {
    return {
      id,
      status: 'wrong',
      message: `"or" joins conditions in set-builder notation, {x | x <= -5 or 2 < x <= 7}. A list of points uses and or a comma${expected.length ? `: ${expectedText}` : ''}.`,
    }
  }
  if (parsed.kind === 'infinity') {
    if (expected.length === 0) {
      const witness = rayWitness(answer, which, parsed.raw)
      return { id, status: 'wrong', message: witness, pattern: patternHit('gf_global_on_ray', witness) }
    }
    return { id, status: 'wrong', message: `∞ is not a point on this graph. The ${FIELD_LABEL[id]} is ${expectedText}.` }
  }
  if (parsed.kind === 'none') {
    if (expected.length === 0) return { id, status: 'ok' }
    return { id, status: 'wrong', message: `This graph does reach ${which === 'max' ? 'a highest' : 'a lowest'} point. The ${FIELD_LABEL[id]} ${expected.length === 1 ? 'is' : 'are'} ${expectedText}.` }
  }
  if (samePoints(parsed.points, expected)) return { id, status: 'ok' }
  // A global extremum that does not exist: naming any point is the ray mistake, ahead of "not a turn".
  if (expected.length === 0) {
    const witness = rayWitness(answer, which, text.trim())
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_global_on_ray', witness) }
  }
  const dup = duplicate(parsed.points)
  if (dup) return { id, status: 'wrong', message: `You listed ${formatPointLocal(dup)} twice. The ${FIELD_LABEL[id]} ${expected.length === 1 ? 'is' : 'are'} ${expectedText}.` }

  const swaps = swappedPoints(parsed.points, answer.turns)
  if (swaps.length > 0) {
    const s = swaps[0]!
    const witness = `You wrote ${formatPointLocal(s.given)}, which is ${formatPointLocal(s.actual)} with x and y swapped. Across first, then up.`
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_swapped_coordinates', witness) }
  }
  const stranger = parsed.points.find((g) => !answer.turns.some((t) => same(g, t)))
  if (stranger) {
    const turns = answer.turns.map((t) => formatPointLocal(t)).join(', ')
    const witness = `${formatPointLocal(stranger)} is not a turning point on this graph. The labelled turns are ${turns}.`
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_not_turning_point', witness) }
  }
  const leftOut = globalLeftOut(answer, id, parsed.points, expected)
  if (leftOut) {
    const witness = `The global ${which} ${formatPointLocal(leftOut)} is also a local ${which} — the graph turns there. The ${FIELD_LABEL[id]} ${expected.length === 1 ? 'is' : 'are'} ${expectedText}.`
    return { id, status: 'wrong', message: witness, pattern: patternHit('gf_global_not_local', witness) }
  }
  return { id, status: 'wrong', message: pointPlain(answer, id, parsed.points, expected) }
}

function unionWitness(raw: string, points: XY[], expectedText: string): string {
  const backwards = points.filter((p) => p.x > p.y + 1e-9).map((p) => formatPointLocal(p))
  const back =
    backwards.length === 0
      ? ''
      : ` ${backwards.join(' and ')} ${backwards.length === 1 ? 'runs' : 'run'} backwards read as an interval.`
  const right = expectedText === 'none' ? 'none' : expectedText
  return `U joins intervals, so ${raw.trim()} reads as intervals, not a list of points.${back} Write ${right}.`
}

function rayWitness(answer: GfAnswer, which: 'max' | 'min', given: string): string {
  const up = which === 'max'
  const rising = (end: 'up' | 'down') => (up ? end === 'up' : end === 'down')
  const left = rising(answer.leftEnd)
  const right = rising(answer.rightEnd)
  const dir = up ? '+∞' : '−∞'
  const word = up ? 'rising' : 'falling'
  const where =
    left && right
      ? `Both ends keep ${word}, so y goes to ${dir}`
      : right
        ? `The right end keeps ${word}, so y goes to ${dir}`
        : `The left end keeps ${word}, so y goes to ${dir}`
  return `${where}. There is no ${up ? 'highest' : 'lowest'} point — the global ${which} is none, not ${given}.`
}

function globalLeftOut(answer: GfAnswer, id: GfFieldId, given: XY[], expected: XY[]): XY | null {
  const global = id === 'localMin' ? answer.globalMinPoint : id === 'localMax' ? answer.globalMaxPoint : null
  if (!global) return null
  if (given.some((g) => same(g, global))) return null
  const missing = expected.filter((e) => !given.some((g) => same(g, e)))
  const extra = given.filter((g) => !expected.some((e) => same(e, g)))
  if (extra.length === 0 && missing.length === 1 && same(missing[0]!, global)) return global
  return null
}

function pointPlain(answer: GfAnswer, id: GfFieldId, given: XY[], expected: XY[]): string {
  const label = FIELD_LABEL[id]
  const expectedText = joinPoints(expected)
  if ((id === 'globalMin' || id === 'globalMax') && given.length === 1 && expected.length === 1) {
    const g = given[0]!
    const turn = answer.turns.find((t) => same(t, g))
    const kind = id === 'globalMin' ? 'min' : 'max'
    if (turn && turn.kind === kind) {
      const cmp = kind === 'min' ? 'lower' : 'higher'
      return `${formatPointLocal(g)} is a local ${kind}, but ${formatPointLocal(expected[0]!)} is ${cmp}, so that is the global ${kind}.`
    }
  }
  const missing = expected.filter((e) => !given.some((g) => same(g, e)))
  const extra = given.filter((g) => !expected.some((e) => same(e, g)))
  if (missing.length > 0 && extra.length === 0) {
    return `Missing ${missing.map(formatPointLocal).join(' and ')}. The ${label} ${expected.length === 1 ? 'is' : 'are'} ${expectedText}.`
  }
  if (extra.length > 0 && missing.length === 0) {
    return `${extra.map(formatPointLocal).join(' and ')} ${extra.length === 1 ? 'is' : 'are'} not part of the ${label}. It is ${expectedText}.`
  }
  return `The ${label} ${expected.length === 1 ? 'is' : 'are'} ${expectedText}.`
}

function parsePointAnswer(text: string): PointParse {
  const raw = text.trim()
  if (isNone(raw)) return { kind: 'none' }
  if (isInfinity(raw)) return { kind: 'infinity', raw }
  if (hasUnion(raw)) {
    const extracted = extractPoints(raw)
    if (extracted.error) return { kind: 'bad', message: extracted.error }
    return { kind: 'union', raw, points: extracted.points }
  }
  if (/\bor\b/i.test(raw)) return { kind: 'or' }
  const extracted = extractPoints(raw)
  if (extracted.error) return { kind: 'bad', message: extracted.error }
  if (extracted.points.length === 0) {
    const bare = raw.match(/^([^,]+),\s*([^,]+)$/)
    if (bare) {
      const x = parseNum(bare[1]!)
      const y = parseNum(bare[2]!)
      if (x !== null && y !== null) return { kind: 'points', points: [{ x, y }] }
    }
    return { kind: 'bad', message: 'Write a point as (x, y), or none.' }
  }
  const rest = leftover(raw, extracted.spans)
  if (rest !== '') return { kind: 'bad', message: `Couldn't read "${rest}". Separate points with and or a comma: (x, y) and (x, y).` }
  return { kind: 'points', points: extracted.points }
}

function extractPoints(text: string): { points: XY[]; spans: string[]; error?: string } {
  const points: XY[] = []
  const spans: string[] = []
  for (const m of text.matchAll(/\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g)) {
    const x = parseNum(m[1]!)
    const y = parseNum(m[2]!)
    if (x === null || y === null) return { points: [], spans: [], error: `Couldn't read ${m[0]} as (x, y). Use numbers, like (2, 3.25).` }
    points.push({ x, y })
    spans.push(m[0]!)
  }
  return { points, spans }
}

function leftover(text: string, spans: string[]): string {
  let rest = text
  for (const s of spans) rest = rest.replace(s, ' ')
  return rest
    .replace(/\band\b/gi, ' ')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasUnion(text: string): boolean {
  return /∪/.test(text) || /\b[Uu]\b/.test(text)
}

function isNone(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/[.!]+$/g, '')
  return (
    t === 'none' ||
    t === 'no' ||
    t === 'dne' ||
    t === '∅' ||
    t === '{}' ||
    t === 'empty' ||
    t === 'no max' ||
    t === 'no min' ||
    t === 'no maximum' ||
    t === 'no minimum' ||
    t === 'no global max' ||
    t === 'no global min' ||
    t === 'no local max' ||
    t === 'no local min' ||
    t === 'does not exist' ||
    t === "doesn't exist" ||
    t === 'n/a'
  )
}

function isInfinity(s: string): boolean {
  const t = s.trim().toLowerCase().replace(/∞/g, 'inf').replace(/[−–—]/g, '-')
  return /^[+-]?(?:inf|infinity)$/.test(t) || t === 'positive infinity' || t === 'negative infinity'
}

export function parseNum(raw: string): number | null {
  const t = raw.trim().replace(/[−–—]/g, '-').replace(/\s+/g, '')
  if (!t) return null
  const frac = /^([+-]?\d+)\/([+-]?\d+)$/.exec(t)
  if (frac) {
    const d = Number(frac[2])
    if (d === 0 || !Number.isFinite(d)) return null
    return Number(frac[1]) / d
  }
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(t)) {
    const n = Number(t)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function same(a: XY, b: XY): boolean {
  return near(a.x, b.x) && near(a.y, b.y)
}

function samePoints(given: XY[], expected: XY[]): boolean {
  if (given.length !== expected.length) return false
  const used = expected.map(() => false)
  for (const g of given) {
    const i = expected.findIndex((e, idx) => !used[idx] && same(g, e))
    if (i < 0) return false
    used[i] = true
  }
  return true
}

function duplicate(points: XY[]): XY | null {
  for (let i = 0; i < points.length; i++) {
    if (points.slice(0, i).some((p) => same(p, points[i]!))) return points[i]!
  }
  return null
}

function swappedPoints(given: XY[], turns: GfAnswer['turns']): { given: XY; actual: XY }[] {
  const out: { given: XY; actual: XY }[] = []
  for (const g of given) {
    if (turns.some((t) => same(g, t))) continue
    const actual = turns.find((t) => near(t.y, g.x) && near(t.x, g.y))
    if (actual) out.push({ given: g, actual })
  }
  return out
}

function formatPointLocal(p: XY): string {
  return `(${formatQuarter(p.x)}, ${formatQuarter(p.y)})`
}
