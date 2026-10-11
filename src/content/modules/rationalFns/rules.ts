import type { RuleCard } from '@/content/types'
import type { RfMistakeId } from './grade'

/** Rule cards for rational functions, in this module's own words. Ids are stable. */
export const RF_RULE_IDS = {
  domain: 'rf-domain',
  vertical: 'rf-vertical-asymptote',
  hole: 'rf-hole',
  degree: 'rf-degree-rule',
  leading: 'rf-leading-ratio',
  slant: 'rf-slant',
  intercept: 'rf-intercept',
  solve: 'rf-rational-equation',
} as const

export const RF_RULE_FOR: Record<RfMistakeId, string> = {
  rf_hole_as_asymptote: RF_RULE_IDS.vertical,
  rf_asymptote_from_numerator: RF_RULE_IDS.vertical,
  rf_hole_left_out: RF_RULE_IDS.domain,
  rf_hole_y_unreduced: RF_RULE_IDS.hole,
  rf_degree_rule: RF_RULE_IDS.degree,
  rf_ratio_not_leading: RF_RULE_IDS.leading,
  rf_slant_remainder: RF_RULE_IDS.slant,
  rf_intercept_at_hole: RF_RULE_IDS.intercept,
  rf_intercept_swapped: RF_RULE_IDS.intercept,
  rf_extraneous_kept: RF_RULE_IDS.solve,
  rf_valid_dropped: RF_RULE_IDS.solve,
}

export const RF_RULES: RuleCard[] = [
  {
    id: RF_RULE_IDS.domain,
    title: 'Out of the domain where the denominator is 0',
    body: 'A rational function is undefined wherever its denominator is 0. That includes a hole: canceling a common factor does not put the x-value back into the domain. Write what is left as a union of open intervals.',
    example: '(x^2 − 9)/(x^2 − x − 6) excludes x = −2 and x = 3 → (−∞, −2) ∪ (−2, 3) ∪ (3, ∞)',
  },
  {
    id: RF_RULE_IDS.vertical,
    title: 'A vertical asymptote is a factor that is still there',
    body: 'After you cancel factors that are in both the numerator and the denominator, what is left in the denominator gives the vertical asymptotes. A canceled factor is a hole. A numerator zero, with the denominator not 0, is an x-intercept.',
    example: '(x − 3) cancels and (x + 2) remains → hole at x = 3, vertical asymptote x = −2',
  },
  {
    id: RF_RULE_IDS.hole,
    title: "A hole's height comes from the reduced function",
    body: 'Where a factor cancels, the original function is 0/0, and that is not a number. Cancel first, then substitute the x-value into what remains. That output is the y-coordinate of the hole.',
    example: '(x^2 − 9)/(x^2 − x − 6) reduces to (x + 3)/(x + 2) → hole (3, 6/5)',
  },
  {
    id: RF_RULE_IDS.degree,
    title: 'Compare the degrees',
    body: 'If the numerator has a lower degree than the denominator, the horizontal asymptote is y = 0. If the degrees are equal, the horizontal asymptote is the ratio of the leading coefficients. If the numerator is exactly one degree higher, there is a slant asymptote, the quotient of the division.',
    example: 'degree 2 over degree 2 → y = (leading of the top) / (leading of the bottom)',
  },
  {
    id: RF_RULE_IDS.leading,
    title: 'The ratio uses the leading coefficients',
    body: 'When the degrees match, divide the leading coefficient of the numerator by the leading coefficient of the denominator. The constant terms are a different ratio. In factored form the leading coefficient includes the number in front and the number in front of x in each factor.',
    example: '(2x − 1)/(x − 3) → y = 2/1 = 2, not the constant terms −1 and −3',
  },
  {
    id: RF_RULE_IDS.slant,
    title: 'The slant asymptote is the quotient',
    body: 'When the numerator is one degree higher, divide the numerator by the denominator. The asymptote is the quotient, a line. The remainder is left over; it is not added onto the line.',
    example: '(x^2 − 1)/(x − 2) = x + 2 + 3/(x − 2) → slant asymptote y = x + 2',
  },
  {
    id: RF_RULE_IDS.intercept,
    title: 'Intercepts are points',
    body: 'An x-intercept is an uncanceled zero of the numerator, written as a point on the x-axis. A canceled zero is a hole, not an intercept. The y-intercept is the point (0, f(0)), and only when x = 0 is in the domain. A bare number is not a point.',
    example: '(x^2 − 9)/(x^2 − x − 6) → x-intercept (−3, 0), y-intercept (0, 3/2)',
  },
  {
    id: RF_RULE_IDS.solve,
    title: 'Drop a candidate that makes a denominator 0',
    body: 'Multiply through by the denominators and solve the polynomial that is left. Then test each candidate in the original equation. If it makes a denominator 0, it is not a solution. A candidate that makes the equation true and keeps every denominator defined stays in the set.',
    example: '(x + 1)(x − 3)/(x − 3) = 2 → x = 1 works, x = 3 does not → {1}',
  },
]
