import type { RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

export const EG_MISTAKE_IDS = [
  'exp_asymptote_unshifted',
  'exp_asymptote_sign',
  'exp_asymptote_axis',
  'exp_range_reflection',
  'exp_domain_closed',
  'exp_intercept_shift',
  'exp_monotonicity_flipped',
  'exp_graph_sign',
  'exp_graph_base',
  'exp_graph_shift',
  'exp_inverse_shift',
  'exp_inverse_swapped',
  'exp_inverse_reciprocal',
] as const

export type EgMistakeId = (typeof EG_MISTAKE_IDS)[number]

/** Rule card ids for exponential and logarithmic graphs. */
export const EG_RULE_IDS = {
  domain: 'eg-domain',
  range: 'eg-range',
  asymptote: 'eg-asymptote',
  intercept: 'eg-intercept',
  behavior: 'eg-behavior',
  match: 'eg-match',
  inverse: 'eg-inverse',
} as const

export const EG_RULE_FOR: Partial<Record<ErrorPatternId, string>> = {
  exp_domain_closed: EG_RULE_IDS.domain,
  exp_range_reflection: EG_RULE_IDS.range,
  exp_asymptote_unshifted: EG_RULE_IDS.asymptote,
  exp_asymptote_sign: EG_RULE_IDS.asymptote,
  exp_asymptote_axis: EG_RULE_IDS.asymptote,
  exp_intercept_shift: EG_RULE_IDS.intercept,
  exp_monotonicity_flipped: EG_RULE_IDS.behavior,
  exp_graph_sign: EG_RULE_IDS.match,
  exp_graph_base: EG_RULE_IDS.match,
  exp_graph_shift: EG_RULE_IDS.match,
  exp_inverse_shift: EG_RULE_IDS.inverse,
  exp_inverse_swapped: EG_RULE_IDS.inverse,
  exp_inverse_reciprocal: EG_RULE_IDS.inverse,
}

export const EG_RULES: RuleCard[] = [
  {
    id: EG_RULE_IDS.domain,
    title: 'Domain of exponential and logarithmic functions',
    body: 'Every exponential function a · b^(x − h) + k is defined for all real x. Every logarithmic function a · log_b(x − h) + k requires a strictly positive input: x − h > 0, so x > h with an open parenthesis at h.',
    example: 'a · b^(x − h) + k has domain (−∞, ∞); a · log_b(x − h) + k has domain (h, ∞)',
  },
  {
    id: EG_RULE_IDS.range,
    title: 'Range and the sign of the leading factor a',
    body: 'Because b^(x − h) is strictly positive, the sign of a determines whether the exponential curve lies above or below its horizontal asymptote y = k. Every logarithmic curve spans all real outputs.',
    example: 'For a · b^(x − h) + k: range is (k, ∞) when a > 0 and (−∞, k) when a < 0',
  },
  {
    id: EG_RULE_IDS.asymptote,
    title: 'Horizontal and vertical asymptotes after shifts',
    body: 'Shifting an exponential graph vertically by k moves its horizontal asymptote to the line y = k. The logarithm log_b(x − h) has a vertical asymptote where its input is zero: x − h = 0, which gives the vertical line x = h.',
    example: 'a · b^(x − h) + k → horizontal asymptote y = k; a · log_b(x − h) + k → vertical asymptote x = h',
  },
  {
    id: EG_RULE_IDS.intercept,
    title: 'Finding the exact intercept by substitution',
    body: 'For the y-intercept of f(x), substitute x = 0 into the full formula (including the shift −h) and write the point (0, f(0)). For the x-intercept of g(x), set g(x) = 0, isolate the logarithm, convert to exponential form, and write the point (x, 0).',
    example: 'y-intercept at x = 0 → (0, a · b^(−h) + k); x-intercept where g(x) = 0 → (h + b^(−k/a), 0)',
  },
  {
    id: EG_RULE_IDS.behavior,
    title: 'Monotonicity from base b and coefficient a',
    body: 'With a > 0, b^(x − h) and log_b(x − h) rise from left to right when b > 1 and fall when 0 < b < 1. Multiplying by a negative coefficient a < 0 reflects the graph across its horizontal line y = k and reverses whether the curve rises or falls.',
    example: 'b > 1 and a > 0 → rises left to right; b > 1 and a < 0 → falls left to right',
  },
  {
    id: EG_RULE_IDS.match,
    title: 'Matching a formula to its graph',
    body: 'Check three things in order: the asymptote line (y = k or x = h), which side of the asymptote the curve is on (set by the sign of a), and whether the curve rises or falls from left to right (set by the base b and the sign of a) along with one anchor point.',
    example: 'Match asymptote y = k or x = h first, then sign of a, then base b > 1 vs 0 < b < 1',
  },
  {
    id: EG_RULE_IDS.inverse,
    title: 'Inverting an exponential or logarithmic function',
    body: 'Swap x and y, then undo the operations in reverse order: undo the outside shift +k first, divide by a, convert between exponential and logarithmic form with the same base b, and finally undo the inside shift −h.',
    example: 'y = a · b^(x − h) + k ↔ x − k = a · b^(y − h) ↔ y = log_b((x − k)/a) + h',
  },
]
