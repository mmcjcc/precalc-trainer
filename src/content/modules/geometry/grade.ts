/**
 * Grades one part of a geometry problem. A named mistake is whatever that slip produces for
 * THIS problem, compared exactly. A candidate equal to the right answer is never used, and when
 * two slips produce the same value the earlier one keeps it. An equal value that is not in
 * simplest radical form is not an attempt.
 */
import type { ErrorPatternId } from '@/shared/types'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import { readGeoAnswer, sameGeoValue, type GeoQty } from './answer'
import { formatLine, readLine, sameLine } from './lines'
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

/** Unit 3 mistakes. A number is named only when it is exactly what that slip produces here. */
export const GEO_UNIT3_MISTAKE_IDS = [
  'geo_same_side_congruent',
  'geo_alt_int_corr_swapped',
  'geo_alt_ext_corr_swapped',
  'geo_parallel_only_when_not',
  'geo_congruent_as_same_side',
  'geo_perp_reciprocal_only',
  'geo_perp_sign_only',
  'geo_parallel_kept_intercept',
  'geo_vertical_as_zero',
  'geo_exterior_adjacent',
  'geo_interior_sum_n180',
  'geo_interior_not_divided',
  'geo_exterior_180_over_n',
  'geo_sides_from_interior_360',
  'geo_sides_from_exterior_180',
  'geo_exterior_sum_as_interior',
  'geo_lines_relation_swapped',
] as const

/** Unit 4 mistakes. A pick is named only when it is exactly what that slip produces here. */
export const GEO_UNIT4_MISTAKE_IDS = [
  'geo_ssa_as_congruence',
  'geo_aaa_as_congruence',
  'geo_sas_not_included',
  'geo_asa_aas_swapped',
  'geo_hl_no_right',
  'geo_vertices_out_of_order',
  'geo_cpctc_too_soon',
  'geo_shared_side_missed',
  'geo_base_angles_wrong_vertex',
  'geo_equilateral_angle_for_side',
  'geo_vertical_angles_missed',
] as const

/** Unit 5 mistakes (quadrilaterals). A number or pick is named only when it is exactly what that slip produces here. */
export const GEO_UNIT5_MISTAKE_IDS = [
  'geo_consecutive_angles_equal',
  'geo_opposite_angles_supplementary',
  'geo_diagonal_half_as_whole',
  'geo_diagonals_assumed_congruent',
  'geo_parallelogram_as_rhombus',
  'geo_rect_rhombus_swapped',
  'geo_median_not_halved',
  'geo_median_as_base',
  'geo_midsegment_doubled',
  'geo_kite_angles_wrong_pair',
  'geo_trapezoid_as_parallelogram',
  'geo_parallel_congruent_mixed',
  'geo_one_pair_half_test',
  'geo_consecutive_marks_as_opposite',
  'geo_one_diagonal_bisected',
  'geo_parallelogram_test_missed',
  'geo_square_not_rectangle',
  'geo_not_most_specific',
  'geo_converse_property',
  'geo_slope_inverted',
] as const

/** Unit 6 mistakes (similarity). A number or pick is named only when it is exactly what that slip produces here. */
export const GEO_UNIT6_MISTAKE_IDS = [
  'geo_matched_by_position',
  'geo_part_over_whole',
  'geo_scale_factor_inverted',
  'geo_perimeter_ratio_squared',
  'geo_cross_multiplied_wrong',
  'geo_geometric_as_arithmetic',
  'geo_bisector_ratio_swapped',
  'geo_ssa_as_similarity',
  'geo_corresponding_supplementary',
  'geo_shadows_crossed',
  'geo_shared_angle_missed',
  'geo_similarity_test_missed',
  'geo_sss_two_pairs',
  'geo_aa_one_angle',
  'geo_proportion_distribute',
  'geo_mean_not_rooted',
  'geo_angle_scaled',
  'geo_one_ratio_inverted',
] as const

export const GEO_UNIT1_MISTAKE_IDS = GEO_MISTAKE_IDS

export type GeoMistakeId =
  | (typeof GEO_MISTAKE_IDS)[number]
  | (typeof GEO_UNIT2_MISTAKE_IDS)[number]
  | (typeof GEO_UNIT3_MISTAKE_IDS)[number]
  | (typeof GEO_UNIT4_MISTAKE_IDS)[number]
  | (typeof GEO_UNIT5_MISTAKE_IDS)[number]
  | (typeof GEO_UNIT6_MISTAKE_IDS)[number]

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
  if (stage.kind === 'line') return gradeLine(stage, text)
  const opts = { ...(stage.allowUndefined ? { allowUndefined: true as const } : {}), ...(stage.ratio ? { ratio: true as const } : {}) }
  const unitless = stage.lengthUnit ? withoutLengthUnit(text, stage.lengthUnit) : { ok: true as const, text }
  if (!unitless.ok) return { verdict: 'invalid', message: unitless.message }
  const read = readGeoAnswer(unitless.text, opts)
  if (!read.ok) return { verdict: 'invalid', message: read.message }
  if (read.value.kind === 'point' && stage.kind !== 'point') return { verdict: 'invalid', message: 'This part asks for one number, not a point.' }
  if (read.value.kind !== 'point' && stage.kind === 'point') return { verdict: 'invalid', message: 'This part asks for a point. Write it as (x, y).' }
  if (read.degrees && stage.unit !== 'deg') {
    return { verdict: 'invalid', message: 'This part is not an angle measure, so leave off the degree sign.' }
  }
  if (!read.simplest) {
    return { verdict: 'invalid', message: read.note ?? 'Write that in simplest radical form.' }
  }
  const right = readGeoAnswer(stage.answerText, opts)
  if (!right.ok || !right.simplest) return { verdict: 'invalid', message: 'This problem has no answer to check.' }
  if (sameGeoValue(read.value, right.value)) return { verdict: 'correct', message: `Correct: ${stage.answerText}.` }
  for (const trap of stage.traps) {
    const got = readGeoAnswer(trap.text, opts)
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

function gradeLine(stage: GeometryAnswer['stages'][number], text: string): GeoGrade {
  const read = readLine(text)
  if (!read.ok) return { verdict: 'invalid', message: read.message }
  const right = readLine(stage.answerText)
  if (!right.ok) return { verdict: 'invalid', message: 'This problem has no answer to check.' }
  if (sameLine(read.line, right.line)) return { verdict: 'correct', message: `Correct: ${formatLine(right.line)}.` }
  for (const trap of stage.traps) {
    const got = readLine(trap.text)
    if (!got.ok || !sameLine(read.line, got.line) || !isGeoMistake(trap.id)) continue
    return { verdict: 'mistake', mistake: trap.id, witness: trap.witness }
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

const UNIT_WORDS: Record<'ft' | 'm', { words: RegExp; name: string; other: RegExp; otherName: string }> = {
  ft: { words: /\s*(?:ft|feet|foot)\.?$/i, name: 'feet', other: /\s*(?:m|meters?|metres?)\.?$/i, otherName: 'meters' },
  m: { words: /\s*(?:m|meters?|metres?)\.?$/i, name: 'meters', other: /\s*(?:ft|feet|foot)\.?$/i, otherName: 'feet' },
}

/** A story's length: "12 ft", "12 feet", or "12" all read as 12. A length in the other unit is a note, not an attempt. */
function withoutLengthUnit(text: string, unit: 'ft' | 'm'): { ok: true; text: string } | { ok: false; message: string } {
  const rule = UNIT_WORDS[unit]
  const trimmed = text.trim()
  if (rule.words.test(trimmed)) return { ok: true, text: trimmed.replace(rule.words, '') }
  if (/\d/.test(trimmed) && rule.other.test(trimmed)) {
    return { ok: false, message: `This problem measures in ${rule.name}, not ${rule.otherName}. Give the length in ${rule.name}.` }
  }
  return { ok: true, text: trimmed }
}

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
  return (
    (GEO_MISTAKE_IDS as readonly string[]).includes(id) ||
    (GEO_UNIT2_MISTAKE_IDS as readonly string[]).includes(id) ||
    (GEO_UNIT3_MISTAKE_IDS as readonly string[]).includes(id) ||
    (GEO_UNIT4_MISTAKE_IDS as readonly string[]).includes(id) ||
    (GEO_UNIT5_MISTAKE_IDS as readonly string[]).includes(id) ||
    (GEO_UNIT6_MISTAKE_IDS as readonly string[]).includes(id)
  )
}

/** The generator calls this for every seed. A bad problem throws instead of shipping. */
export function assertGeoAnswer(where: string, answer: GeometryAnswer): void {
  const pickCount = answer.stages.filter((stage) => stage.kind === 'choice' || stage.kind === 'reason').length
  if (pickCount === answer.stages.length && answer.stages.length > 0) {
    assertPickAnswer(where, answer)
    return
  }
  if (pickCount > 0) {
    assertMixedAnswer(where, answer)
    return
  }
  for (const n of answer.lengths) {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${where}: length ${n} is not a positive integer`)
  }
  for (const a of answer.angles) {
    if (!Number.isInteger(a) || a <= 0 || a >= 180) throw new Error(`${where}: angle ${a} is not strictly between 0 and 180`)
  }
  // A problem stated in words alone (a proportion to solve) has no figure to describe.
  if (answer.figure.points.length > 0 && !answer.figure.ariaLabel.trim()) throw new Error(`${where}: figure has no description`)
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
    // The Given list is the problem. A row whose answer is the reason "Given" repeats it on purpose.
    const givenReason = stage.kind === 'reason' && stage.answerText === 'given'
    if (!givenReason && containsAnswer(sharedBlob, display)) throw new Error(`${where}: ${stage.id} answer is on screen before she finishes`)
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

/**
 * A Unit 3 problem with a number (or a line) and a choice. Each part grades on its own,
 * and a hint, nudge, or witness she can still act on does not contain any part's answer.
 */
function assertMixedAnswer(where: string, answer: GeometryAnswer): void {
  if (answer.figure.points.length > 0 && !answer.figure.ariaLabel.trim()) throw new Error(`${where}: figure has no description`)
  if (answer.stages.length === 0) throw new Error(`${where}: no parts`)
  for (const phrase of METHOD) {
    if (phrase.test(answer.prompt)) throw new Error(`${where}: prompt teaches the method (${phrase})`)
  }
  for (const n of answer.lengths) {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${where}: length ${n} is not a positive integer`)
  }
  for (const a of answer.angles) {
    if (!Number.isInteger(a) || a <= 0 || a >= 180) throw new Error(`${where}: angle ${a} is not strictly between 0 and 180`)
  }
  const ids = new Set<string>()
  const displays = answer.stages.map((stage) => stageDisplay(stage))
  for (const stage of answer.stages) {
    if (ids.has(stage.id)) throw new Error(`${where}: repeated part ${stage.id}`)
    ids.add(stage.id)
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
      }
      if (correct !== 1) throw new Error(`${where}: ${stage.id} has ${correct} correct choices`)
    }
    for (const trap of stage.traps) {
      const g = gradeGeoStage(answer, stage.id, trap.text)
      if (g.verdict !== 'mistake' || g.mistake !== trap.id) {
        throw new Error(`${where}: ${stage.id} trap ${trap.id} graded ${g.verdict}`)
      }
      for (const other of displays) {
        if (containsAnswer(trap.witness, other)) throw new Error(`${where}: ${stage.id} witness contains “${other}”`)
      }
    }
    const garbage = stage.kind === 'choice' ? '' : '???'
    const plain = gradeGeoStage(answer, stage.id, garbage)
    if (plain.verdict !== 'invalid') throw new Error(`${where}: ${stage.id} garbage graded ${plain.verdict}`)
  }
  const shared = [answer.prompt, answer.figure.ariaLabel, ...(answer.lines ?? [])]
  for (const stage of answer.stages) shared.push(stage.hint, stage.nudge, stage.note ?? '')
  const sharedBlob = shared.join('\n')
  for (const display of displays) {
    if (containsAnswer(sharedBlob, display)) throw new Error(`${where}: “${display}” is on screen before she finishes`)
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
  for (const l of answer.figure.lines ?? []) if (l.label) bits.push(l.label)
  return bits.join(' \n ')
}

/** True when `secret` shows up as its own number, not as a digit inside a longer one. */
export function exposed(blob: string, secret: string): boolean {
  const trimmed = secret.trim()
  if (!trimmed) return false
  const esc = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^0-9A-Za-z√])${esc}(?:$|[^0-9A-Za-z])`).test(blob)
}
