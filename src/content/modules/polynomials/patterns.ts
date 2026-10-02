/**
 * PolyMistakeKind → ErrorPatternId (`poly_`), shared by the three Unit 2 modules (completing the square,
 * synthetic division, zeros and rational roots). The catalog holds the lesson and the wrong → right
 * example. The engine's witness is the sentence about her numbers and is shown as-is.
 */
import { POLY_MISTAKE_KINDS, patternHit } from '@/engine'
import type { PolyGrade, PolyMistakeKind, SquareLineGrade } from '@/engine'
import type { ErrorPatternId, PatternHit } from '@/shared/types'

export const POLY_PATTERN: Record<PolyMistakeKind, ErrorPatternId> = {
  cs_no_factor_a: 'poly_cs_no_factor_a',
  cs_unbalanced: 'poly_cs_unbalanced',
  cs_constant_not_scaled: 'poly_cs_constant_not_scaled',
  cs_half_or_square: 'poly_cs_half_or_square',
  cs_h_sign: 'poly_cs_h_sign',
  cs_vertex_swapped: 'poly_cs_vertex_swapped',
  sd_wrong_sign_c: 'poly_sd_wrong_sign_c',
  sd_missing_placeholder: 'poly_sd_missing_placeholder',
  sd_subtracted: 'poly_sd_subtracted',
  sd_first_coefficient: 'poly_sd_first_coefficient',
  sd_quotient_degree: 'poly_sd_quotient_degree',
  sd_remainder_last_quotient: 'poly_sd_remainder_last_quotient',
  zero_sign_reversed: 'poly_zero_sign_reversed',
  zero_nonmonic_factor: 'poly_zero_nonmonic_factor',
  multiplicity_ignored: 'poly_multiplicity_ignored',
  multiplicity_wrong_zero: 'poly_multiplicity_wrong_zero',
  cross_touch_swapped: 'poly_cross_touch_swapped',
  end_sign_ignored: 'poly_end_sign_ignored',
  end_parity_swapped: 'poly_end_parity_swapped',
  lead_coefficient_omitted: 'poly_lead_coefficient_omitted',
  rrt_inverted: 'poly_rrt_inverted',
  rrt_no_plus_minus: 'poly_rrt_no_plus_minus',
  rrt_integers_only: 'poly_rrt_integers_only',
  rrt_wrong_coefficients: 'poly_rrt_wrong_coefficients',
}

/** Every poly_ id, in engine order. */
export const POLY_MISTAKE_IDS: readonly ErrorPatternId[] = POLY_MISTAKE_KINDS.map((kind) => POLY_PATTERN[kind])

/** The catalog lesson for a named polynomial mistake, with her witness attached. */
export function polyPattern(kind: PolyMistakeKind, witness?: string): PatternHit {
  return patternHit(POLY_PATTERN[kind], witness)
}

/** The PatternHit for a grade when it names a mistake, else null (correct, wrong, invalid, unsupported). */
export function polyGradePattern(grade: PolyGrade | SquareLineGrade): PatternHit | null {
  return grade.verdict === 'mistake' ? polyPattern(grade.mistake, grade.witness) : null
}

/** Display text for app-syntax math in a sentence: ASCII minus becomes −. */
export function polyShow(text: string): string {
  return text.replace(/-/g, '−')
}
