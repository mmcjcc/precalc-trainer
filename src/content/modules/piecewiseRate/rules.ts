import type { RuleCard } from '@/content/types'

/** Rule cards for piecewise functions and average rate of change. */
export const PW_RULE_IDS = {
  boundary: 'pw-boundary',
  rate: 'pw-rate',
  dots: 'pw-dots',
  domain: 'pw-domain',
  range: 'pw-range',
  continuous: 'pw-continuous',
  write: 'pw-write',
} as const

export const PW_RULES: RuleCard[] = [
  {
    id: PW_RULE_IDS.boundary,
    title: 'A boundary belongs to ≤',
    body: 'A boundary point belongs to the piece whose inequality includes it (≤ or ≥), not the one with < or >. < leaves the endpoint out. If no piece includes x, f(x) is undefined.',
    example: 'x^2 for x < 2, and 2x + 1 for 2 ≤ x. f(2) = 5, not 4',
  },
  {
    id: PW_RULE_IDS.rate,
    title: 'Average rate of change',
    body: 'Average rate of change of f on [a, b] is (f(b) − f(a)) / (b − a), the slope of the secant line. Subtract the same way on the top and the bottom, then divide by the change in x, not by b alone.',
    example: 'f(x) = x^2 on [1, 4] → (16 − 1) / (4 − 1) = 5, not 15 or 1/5',
  },
  {
    id: PW_RULE_IDS.dots,
    title: 'Filled and hollow dots',
    body: 'A filled dot is an endpoint the piece includes. A hollow dot is an endpoint it leaves out. If that x has only a hollow dot, or no dot at all, f(x) is undefined.',
    example: 'hollow at height 4 and filled at height 5 → f = 5, not 4',
  },
  {
    id: PW_RULE_IDS.domain,
    title: 'The domain is every x a piece includes',
    body: 'The domain is the x-values the pieces include, joined together. An open end is left out, and a gap between pieces is left out. Closing an open end or filling a gap adds x-values the function does not have.',
    example: '[-2, 5] ✗ → [-2, 1) U (3, 5]',
  },
  {
    id: PW_RULE_IDS.range,
    title: 'The range is the outputs',
    body: 'Each piece covers the y-values it reaches on its own interval, with the same open or closed ends. The range is those y-values together. The x-boundaries are inputs, and a line does not cover every real y just because it would if x could be anything.',
    example: '2x + 1 on [0, 2] → [1, 5], not [0, 2] and not all real numbers',
  },
  {
    id: PW_RULE_IDS.continuous,
    title: 'The pieces have to meet',
    body: 'f is continuous where the pieces meet when both pieces give the same height there. The number k belongs in the piece that actually has k, and the match uses the shared boundary, not the other end.',
    example: 'k = −3 ✗ → k = 3',
  },
  {
    id: PW_RULE_IDS.write,
    title: 'Each piece owns its interval',
    body: 'Write the formula of each drawn piece and the interval that piece covers. A filled dot belongs to that piece; a hollow dot does not. The y-intercept of a line is where the line crosses x = 0, which may be off the drawn piece. Two pieces cannot both claim the same x.',
    example: '2x + 5 on [1, 4] ✗ → 2x + 1 on [1, 4]',
  },
]
