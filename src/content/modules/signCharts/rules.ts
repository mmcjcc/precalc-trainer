import type { RuleCard } from '@/content/types'
import type { ScMistakeId } from './grade'

/** Rule cards for sign charts, in this module's own words. Ids are stable. */
export const SC_RULE_IDS = {
  denominator: 'sc-denominator',
  endpoints: 'sc-endpoints',
  signs: 'sc-signs',
  oneSide: 'sc-one-side',
  multiply: 'sc-multiply',
  critical: 'sc-critical',
  intervals: 'sc-intervals',
} as const

export const SC_RULE_FOR: Record<ScMistakeId, string> = {
  sc_denominator_included: SC_RULE_IDS.denominator,
  sc_endpoints_wrong: SC_RULE_IDS.endpoints,
  sc_even_sign_flip: SC_RULE_IDS.signs,
  sc_signs_reversed: SC_RULE_IDS.signs,
  sc_not_one_side: SC_RULE_IDS.oneSide,
  sc_multiplied_by_denominator: SC_RULE_IDS.multiply,
  sc_critical_missing: SC_RULE_IDS.critical,
  sc_wrong_intervals: SC_RULE_IDS.intervals,
}

export const SC_RULES: RuleCard[] = [
  {
    id: SC_RULE_IDS.denominator,
    title: 'A denominator zero is never a solution',
    body: 'Where the denominator is 0, the expression is not a number. That x stays out of the solution, even when the inequality is ≤ or ≥. A bracket can close on a numerator zero. It cannot close on a denominator zero.',
    example: '(x + 3)/(x − 1) ≤ 0 includes −3 and excludes 1 → [−3, 1)',
  },
  {
    id: SC_RULE_IDS.endpoints,
    title: 'Include a zero only for ≤ or ≥',
    body: 'A zero of the numerator, where the expression is defined, is part of the solution only for ≤ or ≥. For < or > the graph touches the axis and the interval stays open.',
    example: '(x − 2)^2(x + 1) ≥ 0 includes x = −1 → [−1, ∞)',
  },
  {
    id: SC_RULE_IDS.signs,
    title: 'The sign follows the factors and the leading coefficient',
    body: 'The sign changes only when the exponent of a factor is odd. An even exponent touches and turns back, so the sign stays. On the far right, the sign is the sign of the leading coefficient.',
    example: '(x − 2)^2(x + 1) is negative, then positive, then still positive → [−1, ∞) for ≥ 0',
  },
  {
    id: SC_RULE_IDS.oneSide,
    title: 'Move every term to one side first',
    body: 'An inequality with terms on both sides is not solved by ignoring one of them. Subtract so one side is 0, and combine the other side into one fraction. 2/(x − 1) < 1 is not the same as 2 < x − 1.',
    example: '2/(x − 1) < 1 becomes (3 − x)/(x − 1) < 0 → (−∞, 1) ∪ (3, ∞)',
  },
  {
    id: SC_RULE_IDS.multiply,
    title: 'Do not multiply by a quantity whose sign you do not know',
    body: 'Multiplying both sides by the denominator keeps the inequality sign only when that denominator is positive. When it can be negative, the direction flips, so the comparison is not the numerator alone.',
    example: '(x + 3)/(x − 1) ≤ 0 is not x + 3 ≤ 0 → [−3, 1), not (−∞, −3]',
  },
  {
    id: SC_RULE_IDS.critical,
    title: 'Every critical number splits the number line',
    body: 'The critical numbers are the zeros of the numerator and the zeros of the denominator. Leave one out and two intervals get glued together, so a sign is used on a stretch where it does not hold.',
    example: '(x + 3)/(x − 1) has critical numbers −3 and 1, not −3 alone',
  },
  {
    id: SC_RULE_IDS.intervals,
    title: 'Keep the intervals with the matching sign',
    body: 'Once the signs are written, the solution is the intervals whose sign matches the inequality. > or ≥ keeps the positive intervals. < or ≤ keeps the negative ones. The brackets still follow the inequality.',
    example: '(x − 2)^2(x + 1) ≥ 0 keeps the positive side → [−1, ∞), not (−∞, −1]',
  },
]
