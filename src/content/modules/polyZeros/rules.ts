import type { RuleCard } from '@/content/types'
import type { PolyMistakeKind } from '@/engine'

/** Rule cards for zeros, end behavior and rational root candidates, in this module's own words. Ids are stable. */
export const PZ_RULE_IDS = {
  zero: 'pz-zero-of-a-factor',
  nonmonic: 'pz-number-in-front-of-x',
  multiplicity: 'pz-multiplicity',
  crossTouch: 'pz-cross-or-touch',
  degree: 'pz-degree',
  lead: 'pz-leading-coefficient',
  ends: 'pz-end-behavior',
  build: 'pz-from-zeros',
  candidates: 'pz-rational-candidates',
  test: 'pz-test-candidates',
} as const

export type PzRuleKey = keyof typeof PZ_RULE_IDS

export const PZ_RULES: RuleCard[] = [
  {
    id: PZ_RULE_IDS.zero,
    title: 'A zero is where a factor equals 0',
    body: 'A product is 0 exactly when one of its factors is 0. Set each factor equal to 0 and solve. The zero has the opposite sign to the number you see inside the factor. The number in front of the whole product never makes it 0.',
    example: '(x + 1)(x − 3) → x + 1 = 0 gives x = −1, and x − 3 = 0 gives x = 3',
  },
  {
    id: PZ_RULE_IDS.nonmonic,
    title: 'A number in front of x: solve the small equation',
    body: 'When a factor has a number in front of x, setting it equal to 0 takes two steps: move the constant across, then divide by the number in front of x.',
    example: '(2x − 1) → 2x − 1 = 0, 2x = 1, x = 1/2',
  },
  {
    id: PZ_RULE_IDS.multiplicity,
    title: 'Multiplicity is the exponent on the factor',
    body: 'The exponent on a factor says how many times its zero is repeated. A factor with no exponent has multiplicity 1. Each exponent belongs to the zero of its own factor and to no other.',
    example: '(x + 1)^2(x − 3) → x = −1 has multiplicity 2, x = 3 has multiplicity 1',
  },
  {
    id: PZ_RULE_IDS.crossTouch,
    title: 'Odd multiplicity crosses, even multiplicity touches',
    body: 'At a zero of odd multiplicity the factor changes sign, so the graph passes through the x-axis. At a zero of even multiplicity the factor is raised to a power that is never negative, so the graph comes to the x-axis, touches it and turns back.',
    example: '(x + 1)^2(x − 3) → touches at x = −1, crosses at x = 3',
  },
  {
    id: PZ_RULE_IDS.degree,
    title: 'The degree is the sum of the exponents',
    body: 'In standard form the degree is the highest power of x. In factored form, add the exponents of all the factors, counting 1 for a factor with no exponent. Count the exponents, not the factors.',
    example: '(x + 1)^2(x − 3)(x − 5)^3 → 2 + 1 + 3 = 6',
  },
  {
    id: PZ_RULE_IDS.lead,
    title: 'The leading coefficient',
    body: 'In standard form it is the number on the highest power of x. In factored form it is the number in front, times the number in front of x in each factor (raised to that factor’s exponent).',
    example: '−2(x + 1)^2(x − 3) → −2.   3(2x − 1)(x + 4)^2 → 3·2 = 6',
  },
  {
    id: PZ_RULE_IDS.ends,
    title: 'The ends: the degree and the sign decide',
    body: 'An even degree sends both ends the same way; an odd degree sends them opposite ways. The sign of the leading coefficient says where the right end goes: positive is up, negative is down.',
    example: 'degree 3, leading coefficient −2 → left end up, right end down',
  },
  {
    id: PZ_RULE_IDS.build,
    title: 'From zeros to a formula',
    body: 'Each zero c gives the factor (x − c), raised to its multiplicity. Those factors fix where the graph meets the x-axis, not how tall it is: put a number a in front, then substitute the extra point for x and f(x) and solve for a.',
    example: 'zeros −1 (twice) and 3, through (0, 6): 6 = a(0 + 1)^2(0 − 3), so a = −2',
  },
  {
    id: PZ_RULE_IDS.candidates,
    title: 'Possible rational zeros are p over q',
    body: 'p runs through the factors of the constant term and q through the factors of the leading coefficient. Every fraction p/q is a candidate, positive and negative, and no other rational number can be a zero.',
    example: '2x^3 − 5x^2 − 4x + 3 → p: 1, 3 and q: 1, 2 → ±1, ±3, ±1/2, ±3/2',
  },
  {
    id: PZ_RULE_IDS.test,
    title: 'A candidate is a zero only if f gives 0 there',
    body: 'The list says where to look, not what you will find. Put each candidate into f(x), or divide synthetically with it in the box: a result of 0 means it is a zero. It can happen that none of them is.',
    example: 'f(x) = 2x^3 − 5x^2 − 4x + 3: f(3) = 0, so 3 is a zero; f(1) = −4, so 1 is not',
  },
]

/** The rule card that answers each named slip of this module. */
export const PZ_RULE_FOR: Partial<Record<PolyMistakeKind, PzRuleKey>> = {
  zero_sign_reversed: 'zero',
  zero_nonmonic_factor: 'nonmonic',
  multiplicity_ignored: 'multiplicity',
  multiplicity_wrong_zero: 'multiplicity',
  cross_touch_swapped: 'crossTouch',
  end_sign_ignored: 'ends',
  end_parity_swapped: 'degree',
  lead_coefficient_omitted: 'build',
  rrt_inverted: 'candidates',
  rrt_no_plus_minus: 'candidates',
  rrt_integers_only: 'candidates',
  rrt_wrong_coefficients: 'candidates',
}

/** Rule-card id for a mistake kind (or a kind given as text, such as `answer.trap`), if this module has one. */
export function pzRuleIdFor(kind: string): string | undefined {
  const key = (PZ_RULE_FOR as Record<string, PzRuleKey | undefined>)[kind]
  return key ? PZ_RULE_IDS[key] : undefined
}
