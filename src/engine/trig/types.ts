/**
 * The trig core's named mistakes. Each id fires only when her answer is exactly what that slip gives for the
 * problem in front of her (computed by the slip builders in slips.ts), never on a right answer.
 */
import type { ErrorPatternId } from '@/shared/types'

export const TRIG_MISTAKE_IDS = [
  'trig_conversion_inverted',
  'trig_pi_dropped',
  'trig_pi_kept',
  'trig_coterminal_half_turn',
  'trig_coterminal_short',
  'trig_negative_direction',
  'trig_reference_from_y_axis',
  'trig_reference_wrong_way',
  'trig_reference_is_coterminal',
  'trig_sign_quadrant',
  'trig_sin_cos_swapped',
  'trig_tan_inverted',
  'trig_reciprocal_mixed',
  'trig_reciprocal_missing',
  'trig_zero_for_undefined',
  'trig_undefined_for_zero',
  'trig_r_left_out',
  'trig_r_not_rooted',
  'trig_arc_degrees',
  'trig_sector_no_half',
  'trig_sector_r_not_squared',
  'trig_arc_sector_swapped',
  // The second half: right triangles, the special triangles, the calculator's inverse functions, one value and the
  // quadrant (uc.given), and every angle in one turn (uc.solve).
  'trig_opposite_adjacent_swapped',
  'trig_hypotenuse_as_leg',
  'trig_pythag_added',
  'trig_pythag_subtracted',
  'trig_side_not_rooted',
  'trig_special_root3_two_swapped',
  'trig_special_45_two',
  'trig_special_wrong_way',
  'trig_special_legs_swapped',
  'trig_depression_from_vertical',
  'trig_radian_mode',
  'trig_ratio_for_angle',
  'trig_coordinate_sign',
  'trig_r_negative',
  'trig_solve_reference_only',
  'trig_solve_one_answer',
  'trig_solve_out_of_range',
  'trig_solve_wrong_sign_quadrant',
  // Unit 5: the graphs of the six functions (amplitude, period, phase shift, midline, range, asymptotes, zeros, key
  // points, an equation from a graph or a description, sinusoidal models) and the inverse functions.
  'trig_amplitude_negative',
  'trig_amplitude_with_d',
  'trig_amplitude_as_span',
  'trig_period_as_b',
  'trig_period_times_b',
  'trig_period_base_mixed',
  'trig_shift_not_divided',
  'trig_shift_wrong_way',
  'trig_midline_zero',
  'trig_range_ignores_d',
  'trig_sec_range_as_sinusoid',
  'trig_reflection_missed',
  'trig_asymptotes_zeros_swapped',
  'trig_sec_asymptotes_at_sin_zeros',
  'trig_period_half',
  'trig_period_quarter',
  'trig_b_as_period',
  'trig_midline_at_extreme',
  'trig_cofunction_graph',
  'trig_vertical_shift_sign',
  'trig_amplitude_as_diameter',
  'trig_model_start_point',
  'trig_degree_mode',
  'trig_model_later_time',
  'trig_inverse_other_angle',
  'trig_inverse_not_principal',
  'trig_arccos_range_as_arcsin',
  'trig_inverse_as_reciprocal',
  'trig_inverse_cancel_outside',
  'trig_inverse_outside_domain',
  'trig_inverse_sign_dropped',
] as const satisfies readonly ErrorPatternId[]

export type TrigMistakeId = (typeof TRIG_MISTAKE_IDS)[number]

export function isTrigMistake(id: string): id is TrigMistakeId {
  return (TRIG_MISTAKE_IDS as readonly string[]).includes(id)
}
