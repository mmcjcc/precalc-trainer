/**
 * The optimization core's named mistakes and shared shapes. Each id fires only when her equation or number is
 * exactly what that slip gives for the problem in front of her (the template computes the slip's equation or value
 * for THIS problem), never on a right answer.
 */
import type { ErrorPatternId } from '@/shared/types'

export const OPT_MISTAKE_IDS = [
  'opt_wall_fenced',
  'opt_wall_wrong_side',
  'opt_pen_ends_short',
  'opt_pen_long_short',
  'opt_coefficients_swapped',
  'opt_revenue_wrong_way',
  'opt_revenue_whole_price',
  'opt_revenue_steps',
  'opt_primary_secondary_swapped',
  'opt_area_as_fence',
  'opt_area_one_pen',
  'opt_area_wrong_count',
  'opt_binomial_square',
  'opt_term_dropped',
  'opt_solve_divide',
  'opt_opens_wrong_way',
  'opt_vertex_ab_swapped',
  'opt_vertex_sign',
  'opt_vertex_no_two',
  'opt_max_as_dimension',
  'opt_dimensions_swapped',
  'opt_other_from_primary',
  'opt_x_as_max',
] as const satisfies readonly ErrorPatternId[]

export type OptMistakeId = (typeof OPT_MISTAKE_IDS)[number]

export function isOptMistake(id: string): id is OptMistakeId {
  return (OPT_MISTAKE_IDS as readonly string[]).includes(id)
}

/** The two letters of every problem in this unit; the figure or the prompt names them. */
export type OptVar = 'x' | 'y'

/**
 * Where the variables live in the problem (both lengths positive and the fence used up, or the price between free
 * and no sales). Equations are compared by evaluation at points inside it.
 */
export interface OptDomain {
  x: readonly [number, number]
  y: readonly [number, number]
}

/** What one check gave. `route` is the variable her final equation is written in. */
export type OptGrade =
  | { verdict: 'correct'; message: string; route?: OptVar }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
