/**
 * Grades one part of a geometry problem. A named mistake is whatever that slip produces for
 * THIS problem, compared exactly. A candidate equal to the right answer is never used, and when
 * two slips produce the same value the earlier one keeps it. An equal value that is not in
 * simplest radical form is not an attempt.
 */
import type { ErrorPatternId } from '@/shared/types'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import { readGeoAnswer, sameGeoValue, type GeoQty } from './answer'
import { isReason, reasonLabel, reasonMistake, reasonWitness } from './reasons'

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

/** Unit 2 mistakes. A pick is named only when it is exactly one of these. */
export const GEO_UNIT2_MISTAKE_IDS = [
  'geo_converse_inverse_swapped',
  'geo_contrapositive_half',
  'geo_contrapositive_unswitched',
  'geo_false_converse',
  'geo_counterexample_hypothesis',
  'geo_affirm_conclusion',
  'geo_deny_hypothesis',
  'geo_syllogism_order',
  'geo_missed_detachment',
  'geo_midpoint_for_addition',
  'geo_addition_for_midpoint',
  'geo_substitution_for_transitive',
  'geo_equality_for_postulate',
  'geo_reflexive_for_symmetric',
  'geo_congruent_for_midpoint',
  'geo_linear_for_vertical',
  'geo_vertical_for_linear',
] as const

export const GEO_UNIT1_MISTAKE_IDS = GEO_MISTAKE_IDS

export type GeoMistakeId = (typeof GEO_MISTAKE_IDS)[number] | (typeof GEO_UNIT2_MISTAKE_IDS)[number]

export type GeoGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: GeoMistakeId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }

const METHOD = [/postulate/i, /congruent/i, /add to 90/i, /add to 180/i, /midpoint formula/i, /distance formula/i]

const STAGE_IDS: readonly GeometryStageId[] = ['x', 'result', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

/** Unit 2 part ids in order: 0 is `a`, 1 is `b`, and so on through `h`. */
export function stageIdAt(index: number): GeometryStageId {
  const id = STAGE_IDS[index + 2]
  if (!id) throw new Error(`no Unit 2 stage at index ${index}`)
  return id
}

/** The words she would point at. Choice and reason answers are ids; this is the sentence or the reason name. */
export function stageDisplay(stage: GeometryAnswer['stages'][number]): string {
  if (stage.kind === 'choice') return stage.choices?.find((choice) => choice.id === stage.answerText)?.text ?? stage.answerText
  if (stage.kind === 'reason') return reasonLabel(stage.answerText)
  return stage.answerText
}

export function gradeGeoStage(answer: GeometryAnswer, stageId: GeometryStageId, text: string): GeoGrade {
  const stage = answer.stages.find((s) => s.id === stageId)
  if (!stage) return { verdict: 'invalid', message: 'That part is not part of this problem.' }
  if (stage.kind === 'choice') return gradeChoice(stage, text)
  if (stage.kind === 'reason') return gradeReason(stage, text)
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

function gradeChoice(stage: GeometryAnswer['stages'][number], text: string): GeoGrade {
  const picked = text.trim()
  if (!picked) return { verdict: 'invalid', message: 'Pick one of the choices before you check.' }
  const choice = stage.choices?.find((item) => item.id === picked)
  if (!choice) return { verdict: 'invalid', message: 'Pick one of the choices on this part.' }
  if (picked === stage.answerText) return { verdict: 'correct', message: 'Correct.' }
  if (choice.trap && isGeoMistake(choice.trap)) {
    return { verdict: 'mistake', mistake: choice.trap, witness: choice.witness ?? 'That choice is a different move from the one this part asks for.' }
  }
  return { verdict: 'wrong', message: 'That choice does not answer this part.' }
}

function gradeReason(stage: GeometryAnswer['stages'][number], text: string): GeoGrade {
  const picked = text.trim()
  if (!picked) return { verdict: 'invalid', message: 'Pick a reason from the list before you check.' }
  if (!isReason(picked)) return { verdict: 'invalid', message: 'Pick a reason from the list.' }
  // `accept` lists other names books give this same step (substitution for transitive, say).
  if (picked === stage.answerText || stage.accept?.includes(picked)) return { verdict: 'correct', message: 'Correct.' }
  const mistake = reasonMistake(stage.answerText, picked)
  if (mistake && isGeoMistake(mistake)) {
    const listed = stage.traps.find((trap) => trap.id === mistake && trap.text === picked)
    return { verdict: 'mistake', mistake, witness: listed?.witness ?? reasonWitness(mistake, picked) }
  }
  return { verdict: 'wrong', message: 'That reason does not justify this line.' }
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
  return (GEO_MISTAKE_IDS as readonly string[]).includes(id) || (GEO_UNIT2_MISTAKE_IDS as readonly string[]).includes(id)
}

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertGeoAnswer(where: string, answer: GeometryAnswer): void {
  if (answer.stages.some((stage) => stage.kind === 'choice' || stage.kind === 'reason')) {
    assertPickAnswer(where, answer)
    return
  }
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

/**
 * A Unit 2 problem: every part's own answer grades correct, the promised trap is a real choice and grades
 * as that mistake, and a hint, nudge, or witness she can still act on does not contain the part's answer.
 */
function assertPickAnswer(where: string, answer: GeometryAnswer): void {
  if (answer.figure.points.length > 0 && !answer.figure.ariaLabel.trim()) throw new Error(`${where}: figure has no description`)
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  if (answer.stages.length > 8) throw new Error(`${where}: more than 8 parts`)
  const ids = new Set<string>()
  for (const stage of answer.stages) {
    if (ids.has(stage.id)) throw new Error(`${where}: repeated part ${stage.id}`)
    ids.add(stage.id)
    if (stage.kind !== 'choice' && stage.kind !== 'reason') throw new Error(`${where}: ${stage.id} is not a pick`)
    const display = stageDisplay(stage)
    if (!display.trim()) throw new Error(`${where}: ${stage.id} has no answer to show`)
    const graded = gradeGeoStage(answer, stage.id, stage.answerText)
    if (graded.verdict !== 'correct') throw new Error(`${where}: ${stage.id} answer graded ${graded.verdict}`)
    if (stage.kind === 'choice') {
      const choices = stage.choices ?? []
      if (choices.length < 2) throw new Error(`${where}: ${stage.id} has fewer than 2 choices`)
      const texts = new Set<string>()
      let correct = 0
      for (const choice of choices) {
        if (texts.has(choice.text)) throw new Error(`${where}: ${stage.id} repeats “${choice.text}”`)
        texts.add(choice.text)
        if (choice.id === stage.answerText) correct += 1
        if (choice.trap) {
          const g = gradeGeoStage(answer, stage.id, choice.id)
          if (g.verdict !== 'mistake' || g.mistake !== choice.trap) {
            throw new Error(`${where}: ${stage.id} choice ${choice.id} graded ${g.verdict}`)
          }
        }
      }
      if (correct !== 1) throw new Error(`${where}: ${stage.id} has ${correct} correct choices`)
    } else if (!isReason(stage.answerText)) {
      throw new Error(`${where}: ${stage.id} reason ${stage.answerText} is not in the bank`)
    }
    if (stage.accept) {
      if (stage.kind !== 'reason') throw new Error(`${where}: ${stage.id} lists other accepted answers on a part that is not a reason`)
      for (const other of stage.accept) {
        if (!isReason(other) || other === stage.answerText) throw new Error(`${where}: ${stage.id} accepts ${other}, which is not another reason in the bank`)
        if (stage.traps.some((trap) => trap.text === other)) throw new Error(`${where}: ${stage.id} accepts ${other} and also names it a mistake`)
      }
    }
    for (const trap of stage.traps) {
      const g = gradeGeoStage(answer, stage.id, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) {
        throw new Error(`${where}: ${stage.id} trap ${trap.id} graded ${g.verdict}`)
      }
      if (containsAnswer(trap.witness, display)) throw new Error(`${where}: ${stage.id} witness contains the answer`)
    }
    const plain = gradeGeoStage(answer, stage.id, 'not-a-real-choice')
    if (plain.verdict !== 'invalid') throw new Error(`${where}: ${stage.id} garbage graded ${plain.verdict}`)
  }
  // Prompt, figure, printed lines, and every part's hint, nudge, and note stay on screen while a later
  // part is still open. None of them may contain any part's answer. A witness may not contain any part's
  // answer either: naming the right button while she can still change a row gives the row away.
  const shared = [answer.prompt, answer.figure.ariaLabel, ...(answer.lines ?? [])]
  for (const stage of answer.stages) shared.push(stage.hint, stage.nudge, stage.note ?? '')
  const sharedBlob = shared.join('\n')
  const displays = answer.stages.map((stage) => stageDisplay(stage))
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    if (containsAnswer(sharedBlob, display)) throw new Error(`${where}: ${stage.id} answer is on screen before she finishes`)
    for (const line of stage.reveal) {
      if (line && answer.prompt.includes(line)) throw new Error(`${where}: ${stage.id} worked line is in the prompt`)
    }
    for (const trap of stage.traps) {
      for (const other of displays) {
        if (containsAnswer(trap.witness, other)) throw new Error(`${where}: ${stage.id} witness contains “${other}”`)
      }
    }
  }
  const trapGrade = gradeGeoStage(answer, answer.trapStage, answer.trapAnswer)
  if (trapGrade.verdict !== 'mistake' || trapGrade.mistake !== answer.trap) {
    throw new Error(`${where}: trap ${answer.trap} graded ${trapGrade.verdict}`)
  }
  const stage = answer.stages.find((item) => item.id === answer.trapStage)
  if (!stage?.traps.some((trap) => trap.id === answer.trap && trap.text === answer.trapAnswer)) {
    throw new Error(`${where}: promised trap ${answer.trap} is not a candidate`)
  }
  for (const line of answer.reveal) {
    if (line && answer.prompt.includes(line)) throw new Error(`${where}: the worked solution is in the prompt`)
  }
}

/** True when `secret` shows up whole. Short tokens use a boundary so "x = 5" is not found inside "x = 50". */
export function containsAnswer(blob: string, secret: string): boolean {
  const trimmed = secret.trim()
  if (!trimmed || !blob) return false
  if (trimmed.length >= 12 || /[A-Za-z]{4}/.test(trimmed)) return blob.includes(trimmed)
  return exposed(blob, trimmed)
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
