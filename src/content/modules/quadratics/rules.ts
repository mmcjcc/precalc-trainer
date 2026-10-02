import type { RuleCard } from '@/content/types'
import type { PolyMistakeKind } from '@/engine'

/** Rule cards for completing the square, in this module's own words. Ids are stable: templates point at them. */
export const CS_RULE_IDS = {
  factor: 'cs-factor-a',
  half: 'cs-half-square',
  balance: 'cs-balance',
  scale: 'cs-scale',
  vertex: 'cs-vertex',
  axis: 'cs-axis',
  opens: 'cs-opens',
} as const

export type CsRuleKey = keyof typeof CS_RULE_IDS

export const CS_RULES: RuleCard[] = [
  {
    id: CS_RULE_IDS.factor,
    title: 'Factor a out of the x-terms first',
    body: 'When the number in front of x^2 is not 1, take it out of the x^2 term and the x term only. Both of them are divided by a. The constant stays outside the parentheses.',
    example: '2x^2 − 12x + 13 → 2(x^2 − 6x) + 13',
  },
  {
    id: CS_RULE_IDS.half,
    title: 'Half of the x-coefficient, then square it',
    body: 'Inside the parentheses, take half of the number in front of x and square that half. The square is what you add to make a perfect square, and the half is what ends up inside ( )^2, with its sign.',
    example: 'x^2 − 6x: half of −6 is −3, and (−3)^2 = 9 → x^2 − 6x + 9 = (x − 3)^2',
  },
  {
    id: CS_RULE_IDS.balance,
    title: 'Add it and subtract it',
    body: 'Adding the square changes the expression, so subtract the same number in the same place straight away. Adding and subtracting the same number changes nothing, and that is the point.',
    example: 'x^2 − 6x + 13 → x^2 − 6x + 9 − 9 + 13',
  },
  {
    id: CS_RULE_IDS.scale,
    title: 'What leaves the parentheses is multiplied by a',
    body: 'The number you subtracted is still inside a( ). When it comes out it is multiplied by a, sign included, and only then does it join the constant.',
    example: '2((x − 3)^2 − 9) + 13 → 2(x − 3)^2 − 18 + 13',
  },
  {
    id: CS_RULE_IDS.vertex,
    title: 'Read the vertex from a(x − h)^2 + k',
    body: 'The vertex is the point (h, k), x-coordinate first. h is the x that makes the square zero, so its sign is opposite to the one you see inside the parentheses. k is the number added after the square.',
    example: '2(x − 3)^2 − 5 → vertex (3, −5), not (−3, −5)',
  },
  {
    id: CS_RULE_IDS.axis,
    title: 'The axis of symmetry is x = h',
    body: 'A parabola is a mirror image across the vertical line through its vertex, so the axis of symmetry is x = h. Straight from standard form, that is x = −b/(2a): divide by 2a, not by 2.',
    example: '2x^2 − 12x + 13 → x = 12/4 = 3',
  },
  {
    id: CS_RULE_IDS.opens,
    title: 'a decides up or down, and k is the value',
    body: 'When a is positive the parabola opens up and the vertex is its lowest point, so k is the minimum value. When a is negative it opens down and k is the maximum value. The value is k, the height of the vertex, not h.',
    example: '2(x − 3)^2 − 5 → opens up, minimum value −5',
  },
]

/** The rule card that answers each named slip of this module. */
export const CS_RULE_FOR: Partial<Record<PolyMistakeKind, CsRuleKey>> = {
  cs_no_factor_a: 'factor',
  cs_unbalanced: 'balance',
  cs_constant_not_scaled: 'scale',
  cs_half_or_square: 'half',
  cs_h_sign: 'vertex',
  cs_vertex_swapped: 'vertex',
}

/** Rule-card id for a mistake kind (or a kind given as text, such as `answer.trap`), if this module has one. */
export function csRuleIdFor(kind: string): string | undefined {
  const key = (CS_RULE_FOR as Record<string, CsRuleKey | undefined>)[kind]
  return key ? CS_RULE_IDS[key] : undefined
}
