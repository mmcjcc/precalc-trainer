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
] as const satisfies readonly ErrorPatternId[]

export type TrigMistakeId = (typeof TRIG_MISTAKE_IDS)[number]

export function isTrigMistake(id: string): id is TrigMistakeId {
  return (TRIG_MISTAKE_IDS as readonly string[]).includes(id)
}
