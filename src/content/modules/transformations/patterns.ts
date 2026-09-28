/**
 * TransformMistakeKind → ErrorPatternId. Transformation kinds use `tr_`, piecewise kinds use `pw_`,
 * and the rate kinds already start with `rate_`, so that prefix is the id. The catalog holds the
 * lesson and the wrong → right example. The engine's witness is about her numbers and is shown as-is.
 */
import { patternHit } from '@/engine'
import type { TransformMistakeKind } from '@/engine'
import type { ErrorPatternId, PatternHit } from '@/shared/types'

export const TR_PATTERN: Record<TransformMistakeKind, ErrorPatternId> = {
  h_shift_reversed: 'tr_h_shift_reversed',
  v_shift_reversed: 'tr_v_shift_reversed',
  h_factor_inverted: 'tr_h_factor_inverted',
  v_factor_inverted: 'tr_v_factor_inverted',
  reflection_wrong_axis: 'tr_reflection_wrong_axis',
  unfactored_shift: 'tr_unfactored_shift',
  missing_reflection: 'tr_missing_reflection',
  missing_step: 'tr_missing_step',
  extra_step: 'tr_extra_step',
  h_order: 'tr_h_order',
  v_order: 'tr_v_order',
  factors_swapped: 'tr_factors_swapped',
  v_factor_inside: 'tr_v_factor_inside',
  v_shift_inside: 'tr_v_shift_inside',
  piecewise_boundary: 'pw_piecewise_boundary',
  piecewise_wrong_piece: 'pw_piecewise_wrong_piece',
  piecewise_value_where_undefined: 'pw_piecewise_value_where_undefined',
  piecewise_undefined_where_defined: 'pw_piecewise_undefined_where_defined',
  rate_sign_flipped: 'rate_sign_flipped',
  rate_no_division: 'rate_no_division',
  rate_inverted: 'rate_inverted',
  rate_divided_by_b: 'rate_divided_by_b',
}

/** The catalog lesson for a named transformation mistake, with her witness attached. */
export function transformPattern(kind: TransformMistakeKind, witness: string): PatternHit {
  return patternHit(TR_PATTERN[kind], witness)
}
