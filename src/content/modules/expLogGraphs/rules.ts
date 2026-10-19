/**
 * Rule cards for graphs of exponential and logarithmic functions. They stay on screen while she can still
 * answer, so their examples use base 7 and shifts of 8 and 9, which no template draws, and letters otherwise.
 * No card spells a domain, range, asymptote, intercept or inverse a template can generate.
 */
import type { RuleCard } from '@/content/types'

export const EG_RULE_IDS = {
  asymptote: 'eg-asymptote',
  domain: 'eg-domain-range',
  intercept: 'eg-intercept',
  direction: 'eg-direction',
  match: 'eg-match',
  inverse: 'eg-inverse',
} as const

export const EG_RULES: RuleCard[] = [
  {
    id: EG_RULE_IDS.asymptote,
    title: 'The asymptote moves with the shifts',
    body: 'b^x levels off along the x-axis, so a·b^(x − h) + k levels off along the flat line y = k: adding k moves it up or down. log_b(x) runs down along the y-axis, so a·log_b(x − h) + k runs along the upright line x = h, the x that makes the input 0.',
    example: '2^x + 9 → y = 9;  log(x + 9) → x = −9',
  },
  {
    id: EG_RULE_IDS.domain,
    title: 'Domain and range',
    body: 'An exponential takes any input. Its outputs stay on one side of y = k, above it when a > 0 and below it when a < 0, and never equal k. A log takes only the inputs that make x − h positive, so x > h with a parenthesis at h, and its outputs have no top and no bottom.',
    example: 'log(x − 9): x − 9 > 0, so x > 9',
  },
  {
    id: EG_RULE_IDS.intercept,
    title: 'Intercepts, exactly',
    body: 'For the y-intercept, put x = 0 into the whole formula, shifts included, and write the point (0, f(0)). For a log’s x-intercept, set the function equal to 0, isolate the log, and rewrite it: log_b(u) = m means u = b^m. Keep fractions, powers and e exact.',
    example: '7^(x − 9) + 1 at x = 0 → (0, 7^(−9) + 1)',
  },
  {
    id: EG_RULE_IDS.direction,
    title: 'Rising or falling',
    body: 'With a > 0, a base above 1 rises from left to right and a base between 0 and 1 falls. A negative a flips the graph over its asymptote, which reverses that. Look at the base and the sign of a together.',
    example: '−(1/7)^x: the base falls, and the minus flips it',
  },
  {
    id: EG_RULE_IDS.match,
    title: 'Reading the graph',
    body: 'Find the asymptote first: a flat line y = k for an exponential, an upright line x = h for a log. Then see which side of it the curve is on (the sign of a) and whether it rises or falls (the base and a). One point, such as where it crosses an axis, settles a shift.',
    example: 'asymptote, then side, then direction, then one point',
  },
  {
    id: EG_RULE_IDS.inverse,
    title: 'The inverse of an exponential or a log',
    body: 'Swap x and y, then undo f from the outside in: subtract k, divide by a, and rewrite the power as a log (or the log as a power) with the same base. The shift that was inside ends up outside, and the one outside ends up inside.',
    example: 'y = 7^(x − 9) + 8 → x − 8 = 7^(y − 9) → y = log_7(x − 8) + 9',
  },
]
