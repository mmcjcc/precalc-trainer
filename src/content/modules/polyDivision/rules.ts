import type { RuleCard } from '@/content/types'
import type { PolyMistakeKind } from '@/engine'

/** Rule cards for synthetic division, in this module's own words. Ids are stable: templates point at them. */
export const SD_RULE_IDS = {
  row: 'sd-top-row',
  box: 'sd-box',
  down: 'sd-bring-down',
  add: 'sd-multiply-add',
  read: 'sd-read-bottom-row',
  remainder: 'sd-remainder-theorem',
  factor: 'sd-factor-theorem',
  ldDivide: 'ld-divide-leading-terms',
  ldMultiply: 'ld-multiply-whole-divisor',
  ldSubtract: 'ld-subtract-every-term',
  ldColumns: 'ld-like-terms-in-columns',
  ldStop: 'ld-stop-and-write',
} as const

export type SdRuleKey = keyof typeof SD_RULE_IDS

/**
 * The one division every long-division card's example comes from: (2x^3 + x^2 − 3x + 4) ÷ (x^2 + 2),
 * quotient 2x + 1, remainder −7x + 2. No problem is ever this division (long.ts refuses to draw it, and
 * it is not on her worksheet), so a card never shows the answer of the problem it is opened on.
 */
export const LD_CARD_EXAMPLE = { dividend: [2, 1, -3, 4], divisor: [1, 0, 2] } as const

/** Long division: the same three moves every round, and the two places it goes wrong (signs, columns). */
const LD_RULES: RuleCard[] = [
  {
    id: SD_RULE_IDS.ldDivide,
    title: 'Each round starts with the leading terms only',
    body: 'Divide the first term of what is left by the first term of the divisor: coefficients divide, exponents subtract. The answer is the next term of the quotient. The other terms of the divisor wait for the multiplying.',
    example: '(2x^3 + x^2 − 3x + 4) ÷ (x^2 + 2): 2x^3 ÷ x^2 = 2x',
  },
  {
    id: SD_RULE_IDS.ldMultiply,
    title: 'Multiply the whole divisor by that term',
    body: 'The term you just found multiplies every term of the divisor, signs included. Write each piece of the product under the term with the same power.',
    example: '2x · (x^2 + 2) = 2x^3 + 4x',
  },
  {
    id: SD_RULE_IDS.ldSubtract,
    title: 'Subtracting changes every sign of the product',
    body: 'You subtract the whole product, so change the sign of each of its terms and then add. The leading terms always cancel. Terms with nothing under them come down unchanged.',
    example: '(2x^3 + x^2 − 3x + 4) − (2x^3 + 4x) = x^2 − 7x + 4',
  },
  {
    id: SD_RULE_IDS.ldColumns,
    title: 'Like terms share a column, and a missing power keeps its place',
    body: 'Only like terms subtract: x^2 from x^2, x from x, numbers from numbers. When the divisor skips a power, the product skips one too. Leave that column empty (or write 0x) so nothing slides under the wrong term.',
    example: '2x^3 + 4x under 2x^3 + x^2 − 3x + 4: the 4x goes under −3x, and nothing goes under x^2',
  },
  {
    id: SD_RULE_IDS.ldStop,
    title: 'Stop when what is left has a lower degree than the divisor',
    body: 'What is left then is the remainder. The quotient is the sum of the terms you found. The whole result is the quotient plus the remainder over the divisor.',
    example: 'quotient 2x + 1, remainder −7x + 2 → 2x + 1 + (−7x + 2)/(x^2 + 2)',
  },
]

export const SD_RULES: RuleCard[] = [
  {
    id: SD_RULE_IDS.row,
    title: 'Every power gets a place in the top row',
    body: 'Write the coefficients from the highest power down to the constant term, signs included. Count the powers down one at a time. A power that f(x) skips still needs its place, and that place holds a 0.',
    example: '2x^3 − 3x^2 − 5 → 2, −3, 0, −5',
  },
  {
    id: SD_RULE_IDS.box,
    title: 'The box holds the number that makes the divisor 0',
    body: 'Set the divisor equal to 0 and solve for x. That number goes in the box, so its sign is opposite to the one you see in the divisor. The same number is the c in f(c).',
    example: 'x − 2 → 2 in the box; x + 2 → −2 in the box',
  },
  {
    id: SD_RULE_IDS.down,
    title: 'The first coefficient comes straight down',
    body: 'Nothing is written under the first coefficient, so it drops to the bottom row unchanged. The multiplying starts with that number and lands in the second column.',
    example: 'top row 2, −3, 0, −5 → the bottom row starts with 2',
  },
  {
    id: SD_RULE_IDS.add,
    title: 'Multiply, write it under the next coefficient, add',
    body: 'Multiply the box number by the bottom number you just wrote. Put the product under the next coefficient and add that column. Every column is added: the sign change is already inside the box number.',
    example: 'box 2, bottom 2 → product 4 under −3 → −3 + 4 = 1',
  },
  {
    id: SD_RULE_IDS.read,
    title: 'Read the bottom row: quotient, then remainder',
    body: 'The last number of the bottom row is the remainder. The numbers before it are the coefficients of the quotient, and the quotient starts one power lower than f(x).',
    example: 'cubic, bottom row 2, 1, 2, −1 → quotient 2x^2 + x + 2, remainder −1',
  },
  {
    id: SD_RULE_IDS.remainder,
    title: 'Remainder theorem',
    body: 'When f(x) is divided by x − c, the remainder is f(c). So synthetic division with c in the box is a quick way to find the value of f at c.',
    example: '(2x^3 − 3x^2 − 5) ÷ (x − 2) leaves −1 → f(2) = −1',
  },
  {
    id: SD_RULE_IDS.factor,
    title: 'Factor theorem',
    body: 'x − c is a factor of f(x) exactly when f(c) = 0, which means the remainder is 0. Any other remainder means it is not a factor.',
    example: 'x^3 − 7x + 6 with −3 in the box leaves 0 → x + 3 is a factor',
  },
  ...LD_RULES,
]

/** The rule card that answers each named slip of this module. */
export const SD_RULE_FOR: Partial<Record<PolyMistakeKind, SdRuleKey>> = {
  sd_wrong_sign_c: 'box',
  sd_missing_placeholder: 'row',
  sd_subtracted: 'add',
  sd_first_coefficient: 'down',
  sd_quotient_degree: 'read',
  sd_remainder_last_quotient: 'read',
}

/** Rule-card id for a mistake kind (or a kind given as text, such as `answer.trap`), if this module has one. */
export function sdRuleIdFor(kind: string): string | undefined {
  const key = (SD_RULE_FOR as Record<string, SdRuleKey | undefined>)[kind]
  return key ? SD_RULE_IDS[key] : undefined
}
