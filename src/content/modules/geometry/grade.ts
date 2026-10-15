/**
 * Grades one part of a geometry problem. A named mistake is whatever that slip produces for
 * THIS problem, compared exactly. A candidate equal to the right answer is never used, and when
 * two slips produce the same value the earlier one keeps it. An equal value that is not in
 * simplest radical form is not an attempt.
 */
import type { ErrorPatternId } from '@/shared/types'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import { readGeoAnswer, sameGeoValue, type GeoQty } from './answer'

export const GEO_MISTAKE_IDS = [
  'geo_answered_x',
  'geo_parts_equal',
  'geo_part_equals_whole',
  'geo_half_for_whole',
  'geo_midpoint_subtracted',
  'geo_endpoint_averaged',
  'geo_distance_not_squared',
  'geo_distance_no_root',
  'geo_comp_supp_swapped',
  'geo_vertical_as_supplementary',
  'geo_linear_pair_equal',
  'geo_complement_reversed',
] as const

export type GeoMistakeId = (typeof GEO_MISTAKE_IDS)[number]

export type GeoGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: GeoMistakeId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

const METHOD = [/postulate/i, /congruent/i, /add to 90/i, /add to 180/i, /midpoint formula/i, /distance formula/i]

export function gradeGeoStage(answer: GeometryAnswer, stageId: GeometryStageId, text: string): GeoGrade {
  const stage = answer.stages.find((s) => s.id === stageId)
  if (!stage) return { verdict: 'invalid', message: 'That part is not part of this problem.' }
  const read = readGeoAnswer(text)
  if (!read.ok) return { verdict: 'invalid', message: read.message }
  if (read.value.kind === 'point' && stage.kind !== 'point') return { verdict: 'invalid', message: 'This part asks for one number, not a point.' }
  if (read.value.kind !== 'point' && stage.kind === 'point') return { verdict: 'invalid', message: 'This part asks for a point. Write it as (x, y).' }
  if (read.degrees && stage.unit !== 'deg') {
    return { verdict: 'invalid', message: 'This part is not an angle measure, so leave off the degree sign.' }
  }
  if (!read.simplest) {
    return { verdict: 'invalid', message: read.note ?? 'Write that in simplest radical form.' }
  }
  const right = readGeoAnswer(stage.answerText)
  if (!right.ok || !right.simplest) return { verdict: 'invalid', message: 'This problem has no answer to check.' }
  if (sameGeoValue(read.value, right.value)) return { verdict: 'correct', message: `Correct: ${stage.answerText}.` }
  for (const trap of stage.traps) {
    const got = readGeoAnswer(trap.text)
    if (!got.ok || !got.simplest) continue
    if (!sameGeoValue(read.value, got.value)) continue
    if (!isGeoMistake(trap.id)) continue
    return { verdict: 'mistake', mistake: trap.id, witness: trap.witness }
  }
  if (read.decimal && read.value.kind === 'qty' && right.value.kind === 'qty') {
    // A calculator decimal close to the exact answer: right idea, wrong form. Not an attempt.
    const near = Math.abs(approx(read.value.q) - approx(right.value.q)) <= 0.01 * Math.max(1, Math.abs(approx(right.value.q)))
    if (near) {
      const form = right.value.q.rad > 1 ? 'in simplest radical form' : 'as an integer or a fraction'
      return { verdict: 'invalid', message: `That looks like a calculator decimal. Give the exact value, ${form}.` }
    }
  }
  return { verdict: 'wrong', message: `That is not ${stage.label}.` }
}

const approx = (q: GeoQty) => (q.n / q.d) * Math.sqrt(q.rad)

/**
 * True when a mistake's catalog example (written for another problem) contains this part's answer on
 * either side of the arrow. The flow leaves such an example out: "→ 15" beside her slip reads as the
 * answer, and "15 ✗" reads as if the answer were wrong.
 */
export function exampleShowsAnswer(example: string, answerText: string): boolean {
  const norm = (s: string) => s.replace(/−/g, '-').replace(/\s+/g, '')
  const ans = norm(answerText)
  if (!ans) return false
  const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\d./√-])${escaped}(?![\\d/√])`).test(norm(example))
}

export function isGeoMistake(id: ErrorPatternId): id is GeoMistakeId {
  return (GEO_MISTAKE_IDS as readonly string[]).includes(id)
}

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertGeoAnswer(where: string, answer: GeometryAnswer): void {
  for (const n of answer.lengths) {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${where}: length ${n} is not a positive integer`)
  }
  for (const a of answer.angles) {
    if (!Number.isInteger(a) || a <= 0 || a >= 180) throw new Error(`${where}: angle ${a} is not strictly between 0 and 180`)
  }
  if (!answer.figure.ariaLabel.trim()) throw new Error(`${where}: figure has no description`)
  for (const phrase of METHOD) {
    if (phrase.test(answer.prompt)) throw new Error(`${where}: prompt teaches the method (${phrase})`)
  }
  const blob = visibleBlob(answer)
  for (const stage of answer.stages) {
    const g = gradeGeoStage(answer, stage.id, stage.answerText)
    if (g.verdict !== 'correct') throw new Error(`${where}: ${stage.id} answer ${stage.answerText} graded ${g.verdict}`)
    if (exposed(blob, stage.answerText)) throw new Error(`${where}: ${stage.label} answer ${stage.answerText} is on the figure or in the prompt`)
  }
  const trapGrade = gradeGeoStage(answer, answer.trapStage, answer.trapAnswer)
  if (trapGrade.verdict !== 'mistake' || trapGrade.mistake !== answer.trap) {
    throw new Error(`${where}: trap ${answer.trap} graded ${trapGrade.verdict}${trapGrade.verdict === 'mistake' ? ` ${trapGrade.mistake}` : ''}`)
  }
  const stage = answer.stages.find((s) => s.id === answer.trapStage)
  if (!stage?.traps.some((t) => t.id === answer.trap && t.text === answer.trapAnswer)) {
    throw new Error(`${where}: promised trap ${answer.trap} is not a candidate`)
  }
  // A trap may repeat a given (copying AC = 41 when AB was asked). The correct answers may not.
  for (const line of answer.reveal) {
    if (answer.prompt.includes(line)) throw new Error(`${where}: the worked solution is in the prompt`)
  }
}

function visibleBlob(answer: GeometryAnswer): string {
  const bits = [answer.prompt, answer.figure.ariaLabel]
  for (const p of answer.figure.points) bits.push(p.label ?? '', p.id)
  for (const s of answer.figure.segments ?? []) if (s.label) bits.push(s.label)
  for (const a of answer.figure.angles ?? []) if (a.label) bits.push(a.label)
  return bits.join(' \n ')
}

/** True when `secret` shows up as its own number, not as a digit inside a longer one. */
export function exposed(blob: string, secret: string): boolean {
  const trimmed = secret.trim()
  if (!trimmed) return false
  const esc = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^0-9A-Za-z√])${esc}(?:$|[^0-9A-Za-z])`).test(blob)
}
