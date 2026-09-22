import type { RuleCard } from '@/content/types'

/** Rule cards for domain and range, in this module's own words. */
export const DR_RULE_IDS = {
  denominator: 'dr-denominator',
  evenRoot: 'dr-even-root',
  rootDenom: 'dr-root-denom',
  flip: 'dr-flip',
  anyInput: 'dr-any-input',
  outputs: 'dr-outputs',
  asymptote: 'dr-asymptote',
} as const

export const DR_RULES: RuleCard[] = [
  {
    id: DR_RULE_IDS.denominator,
    title: 'A denominator cannot be 0',
    body: 'If the formula divides, the bottom is not allowed to be 0. Solve bottom ≠ 0 and leave those x-values out of the domain. A negative bottom is fine.',
    example: '1/(x - 3) → (-inf, 3) U (3, inf), not [3, inf)',
  },
  {
    id: DR_RULE_IDS.evenRoot,
    title: 'An even root needs its inside ≥ 0',
    body: 'A square root (or any even root) is defined only when the radicand is at least 0. The square root of 0 is 0, so the endpoint stays in — a bracket, not a parenthesis.',
    example: 'sqrt(x + 2) → [-2, inf), not (-2, inf)',
  },
  {
    id: DR_RULE_IDS.rootDenom,
    title: 'A root in a denominator must be positive',
    body: 'When an even root sits in a denominator, 0 is not allowed either: the root of 0 is 0, and dividing by 0 is undefined. The inside has to be strictly greater than 0.',
    example: '1/sqrt(x - 1) → (1, inf), not [1, inf)',
  },
  {
    id: DR_RULE_IDS.flip,
    title: 'Dividing by a negative flips the inequality',
    body: 'A negative number in front of x flips the inequality sign when you divide by it. Solve the inside, and flip when you divide by that negative.',
    example: 'sqrt(-2x + 6): -2x + 6 ≥ 0 → x ≤ 3, so (-inf, 3]',
  },
  {
    id: DR_RULE_IDS.anyInput,
    title: 'Cube roots and polynomials take every real number',
    body: 'A cube root of a negative number is a real number (cbrt(-8) = -2). A polynomial has no denominator and no even root, so it accepts every real x too.',
    example: 'cbrt(x - 2) → (-inf, inf), not [2, inf)',
  },
  {
    id: DR_RULE_IDS.outputs,
    title: 'The range is the set of outputs',
    body: 'The range is the set of y-values f actually reaches, not the x-values it accepts. A negative in front of a square root, an absolute value, or a parabola flips which way those outputs go.',
    example: '-2sqrt(x + 1) + 5 reaches y ≤ 5, so (-inf, 5], not the domain [-1, inf)',
  },
  {
    id: DR_RULE_IDS.asymptote,
    title: 'Leave out the horizontal asymptote',
    body: 'For a/(x - h) + k, the graph gets close to y = k and never reaches it. That one value is not an output, so it is left out of the range.',
    example: '3/(x - 2) + 1 → (-inf, 1) U (1, inf), not (-inf, inf)',
  },
]
