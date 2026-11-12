import type { RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'

/**
 * Rule cards for factoring, in this module's own words, one idea per card. Ids are stable. Every example uses
 * numbers no problem draws (reserved in build.ts and checked by the tests): 7 as a common factor or a leading
 * coefficient, 10 as a cube root, 11 and 12, and x^4 − 10000.
 */
export const FA_RULE_IDS = {
  gcf: 'fa-greatest-common-factor',
  gcfOne: 'fa-common-factor-leaves-one',
  squares: 'fa-two-squares',
  dos: 'fa-difference-of-squares',
  sos: 'fa-sum-of-squares',
  pst: 'fa-perfect-square-trinomial',
  cubeRoots: 'fa-what-is-cubed',
  cubes: 'fa-sum-difference-of-cubes',
  tri: 'fa-trinomial-monic',
  triA: 'fa-trinomial-leading',
  signs: 'fa-trinomial-signs',
  group: 'fa-grouping',
  groupSign: 'fa-grouping-negative',
  complete: 'fa-factor-completely',
} as const

export type FaRuleKey = keyof typeof FA_RULE_IDS

export const FA_RULES: RuleCard[] = [
  {
    id: FA_RULE_IDS.gcf,
    title: 'Take out the greatest common factor',
    body: 'Find the biggest number that divides every coefficient and the lowest power of x that appears in every term. Their product is the greatest common factor: write it in front, and divide each term by it to get what goes inside the parentheses.',
    example: '14x^3 + 21x^2 = 7x^2(2x + 3)',
  },
  {
    id: FA_RULE_IDS.gcfOne,
    title: 'A term equal to the common factor leaves 1',
    body: 'Each term divided by the common factor leaves something behind. When a term is the common factor itself, what it leaves is 1, and that 1 stays inside the parentheses.',
    example: '7x^2 + 21x + 7 = 7(x^2 + 3x + 1)',
  },
  {
    id: FA_RULE_IDS.squares,
    title: 'Two squares: three cases',
    body: 'Two squares with a minus between them: a^2 − b^2 = (a + b)(a − b). A square, a middle term 2ab and a square: a^2 + 2ab + b^2 = (a + b)^2 and a^2 − 2ab + b^2 = (a − b)^2. Two squares with a plus between them and nothing in the middle: a^2 + b^2 does not factor over the integers.',
    example: 'x^2 − 144 = (x + 12)(x − 12);  x^2 + 22x + 121 = (x + 11)^2;  x^2 + 144 does not factor',
  },
  {
    id: FA_RULE_IDS.dos,
    title: 'Difference of two squares',
    body: 'a^2 − b^2 = (a + b)(a − b). The two binomials have opposite signs, so the middle terms cancel when you multiply them back. Find a and b by taking the square root of each term, the number in front of x^2 included.',
    example: 'x^2 − 144 = (x + 12)(x − 12)',
  },
  {
    id: FA_RULE_IDS.sos,
    title: 'A sum of two squares does not factor',
    body: 'a^2 + b^2 has no factors with whole-number coefficients: (a + b)(a − b) gives a minus sign, and (a + b)^2 gives a middle term. When the polynomial is a sum of two squares and nothing else, say that it does not factor over the integers.',
    example: 'x^2 + 144 does not factor over the integers',
  },
  {
    id: FA_RULE_IDS.pst,
    title: 'Perfect-square trinomial',
    body: 'When the first and last terms are squares, a^2 and b^2, and the middle term is 2ab, the trinomial is the square of a binomial. The sign inside the square is the sign of the middle term; the last term is positive either way.',
    example: 'x^2 − 22x + 121 = (x − 11)^2',
  },
  {
    id: FA_RULE_IDS.cubeRoots,
    title: 'What is cubed: the cube root of the whole term',
    body: 'To write a term as something cubed, take the cube root of the number in front and of the power of x together: the cube root of x^3 is x, and the cube root of a number is the number that, multiplied by itself three times, gives it.',
    example: '1000x^3 + 343 = (10x)^3 + 7^3',
  },
  {
    id: FA_RULE_IDS.cubes,
    title: 'Sum or difference of cubes: same, opposite, always plus',
    body: 'a^3 + b^3 = (a + b)(a^2 − ab + b^2) and a^3 − b^3 = (a − b)(a^2 + ab + b^2). The binomial has the SAME sign as the cubes, the middle term of the trinomial the OPPOSITE sign, and its last term is ALWAYS plus. The trinomial never factors further over the integers, so you are done with it.',
    example: 'x^3 − 1000 = (x − 10)(x^2 + 10x + 100)',
  },
  {
    id: FA_RULE_IDS.tri,
    title: 'x^2 + bx + c: multiply to c, add to b',
    body: 'Look for two numbers whose product is the last term c and whose sum is the middle coefficient b. Then x^2 + bx + c = (x + first)(x + second).',
    example: 'x^2 + 3x − 88 = (x + 11)(x − 8): 11 · (−8) = −88 and 11 + (−8) = 3',
  },
  {
    id: FA_RULE_IDS.triA,
    title: 'ax^2 + bx + c: first terms, last terms, then the middle',
    body: 'The first terms of the two binomials multiply to ax^2 and the last terms multiply to c. Try the pairs until the outer product plus the inner product gives the middle term bx.',
    example: '7x^2 + 15x + 2 = (7x + 1)(x + 2): outer 7x · 2 = 14x, inner 1 · x = x, and 14x + x = 15x',
  },
  {
    id: FA_RULE_IDS.signs,
    title: 'The signs of the two numbers',
    body: 'If the last term is positive, the two numbers have the same sign, the sign of the middle term. If the last term is negative, they have opposite signs, and the one farther from 0 takes the sign of the middle term.',
    example: 'x^2 + 3x − 88: −88 is negative, so opposite signs, and the bigger number is positive: 11 and −8',
  },
  {
    id: FA_RULE_IDS.group,
    title: 'Four terms: factor by grouping',
    body: 'Group the first two terms and the last two terms. Take the greatest common factor out of each pair, so both pairs show the same binomial. Then take that binomial out: what is left of the two pairs is the other factor.',
    example: 'x^3 + 11x^2 + 2x + 22 = x^2(x + 11) + 2(x + 11) = (x + 11)(x^2 + 2)',
  },
  {
    id: FA_RULE_IDS.groupSign,
    title: 'Taking out a negative changes both signs',
    body: 'When the third term is negative, take a negative number out of the second pair. Dividing both of its terms by a negative number changes both of their signs, and that is what makes its binomial match the first pair’s.',
    example: '−2x − 22 = −2(x + 11)',
  },
  {
    id: FA_RULE_IDS.complete,
    title: 'Factor completely: an order to follow',
    body: 'First take out the greatest common factor. Then count the terms of what is left: two terms, try the difference of squares or the sum or difference of cubes; three terms, a trinomial or a perfect square; four terms, grouping. Last, check every factor again: keep going until none of them factors.',
    example: 'x^4 − 10000 = (x^2 + 100)(x^2 − 100) = (x^2 + 100)(x + 10)(x − 10)',
  },
]

/** The card that teaches the idea a named mistake missed. */
export const FA_RULE_FOR: Partial<Record<ErrorPatternId, FaRuleKey>> = {
  fa_gcf_not_greatest: 'gcf',
  fa_gcf_dropped_one: 'gcfOne',
  fa_sum_of_squares: 'sos',
  fa_diff_as_square: 'dos',
  fa_square_sign: 'pst',
  fa_cube_middle_sign: 'cubes',
  fa_cube_middle_doubled: 'cubes',
  fa_cube_last_negative: 'cubes',
  fa_cube_binomial_cubed: 'cubes',
  fa_cube_root_coefficient: 'cubeRoots',
  fa_tri_signs_swapped: 'signs',
  fa_tri_wrong_pair: 'tri',
  fa_group_sign: 'groupSign',
  fa_stopped_early: 'complete',
}

export function faRuleIdFor(id: string): string | null {
  const key = FA_RULE_FOR[id as ErrorPatternId]
  return key ? FA_RULE_IDS[key] : null
}
