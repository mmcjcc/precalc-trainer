import type { RuleCard } from '@/content/types'

/** Rule cards for piecewise functions and average rate of change. */
export const PW_RULE_IDS = {
  boundary: 'pw-boundary',
  rate: 'pw-rate',
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
]
