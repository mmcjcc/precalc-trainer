/**
 * Worked by hand. Each polynomial is a seed the templates really draw (found once by a scan, pinned here), each
 * right answer was multiplied out by hand first (beside it), and each named slip is what a student writes.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { sameFactorization } from '@/engine'
import { canonicalEntries, gradeFactoringStage, type FactoringAnswer } from '.'

function problem(templateId: string, seed: number, f: string): FactoringAnswer {
  const p = generateProblem('factoring', templateId, seed)
  if (p.answer.type !== 'factoring') throw new Error('expected factoring')
  expect(p.answer.f).toBe(f)
  return p.answer
}

function graded(a: FactoringAnswer, stage: FactoringAnswer['stages'][number]['id'], entries: Record<string, string>): string[] {
  return gradeFactoringStage(a, stage, { ...canonicalEntries(a), ...entries }).parts.map((p) => (p.grade.verdict === 'mistake' ? p.grade.mistake : p.grade.verdict))
}

const product = (a: FactoringAnswer, text: string) => graded(a, 'product', { product: text })[0]

/** [template, seed, polynomial, the answer worked by hand (multiplied back beside it)] */
const PINS: [string, number, string, string][] = [
  // (x − 2)(x^2 + 2x + 4) = x^3 + 2x^2 + 4x − 2x^2 − 4x − 8 = x^3 − 8
  ['fa.cubes', 66, 'x^3 - 8', '(x - 2)(x^2 + 2x + 4)'],
  // (x + 3)(x^2 − 3x + 9) = x^3 − 3x^2 + 9x + 3x^2 − 9x + 27 = x^3 + 27
  ['fa.cubes', 15, 'x^3 + 27', '(x + 3)(x^2 - 3x + 9)'],
  // (2x + 3)(4x^2 − 6x + 9) = 8x^3 − 12x^2 + 18x + 12x^2 − 18x + 27 = 8x^3 + 27
  ['fa.cubes', 1, '8x^3 + 27', '(2x + 3)(4x^2 - 6x + 9)'],
  // (3x − 1)(9x^2 + 3x + 1) = 27x^3 + 9x^2 + 3x − 9x^2 − 3x − 1 = 27x^3 − 1
  ['fa.cubes', 87, '27x^3 - 1', '(3x - 1)(9x^2 + 3x + 1)'],
  // 2(x + 3)(x^2 − 3x + 9) = 2(x^3 + 27) = 2x^3 + 54
  ['fa.cubes', 348, '2x^3 + 54', '2(x + 3)(x^2 - 3x + 9)'],
  // 3(x − 3)(x^2 + 3x + 9) = 3(x^3 − 27) = 3x^3 − 81
  ['fa.cubes', 383, '3x^3 - 81', '3(x - 3)(x^2 + 3x + 9)'],
  // x(x − 2)(x^2 + 2x + 4) = x(x^3 − 8) = x^4 − 8x
  ['fa.cubes', 277, 'x^4 - 8x', 'x(x - 2)(x^2 + 2x + 4)'],
  // (x − 2)(x + 2)(x^2 + 4) = (x^2 − 4)(x^2 + 4) = x^4 − 16
  ['fa.complete', 33, 'x^4 - 16', '(x - 2)(x + 2)(x^2 + 4)'],
  // (x − 1)(x + 1)(x − 2)(x + 2) = (x^2 − 1)(x^2 − 4) = x^4 − 5x^2 + 4
  ['fa.complete', 191, 'x^4 - 5x^2 + 4', '(x - 1)(x + 1)(x - 2)(x + 2)'],
  // 2(x − 2)(x^2 + 2x + 4) = 2(x^3 − 8) = 2x^3 − 16
  ['fa.complete', 674, '2x^3 - 16', '2(x - 2)(x^2 + 2x + 4)'],
  // 3x(x − 2)(x + 2) = 3x(x^2 − 4) = 3x^3 − 12x
  ['fa.complete', 980, '3x^3 - 12x', '3x(x - 2)(x + 2)'],
  // (x + 3)(x − 2) = x^2 − 2x + 3x − 6 = x^2 + x − 6
  ['fa.trinomial', 123, 'x^2 + x - 6', '(x + 3)(x - 2)'],
  // (x − 3)(x − 4) = x^2 − 4x − 3x + 12 = x^2 − 7x + 12
  ['fa.trinomial', 385, 'x^2 - 7x + 12', '(x - 3)(x - 4)'],
  // (2x + 3)(3x − 1) = 6x^2 − 2x + 9x − 3 = 6x^2 + 7x − 3
  ['fa.trinomial', 923, '6x^2 + 7x - 3', '(2x + 3)(3x - 1)'],
  // (2x + 1)(x − 3) = 2x^2 − 6x + x − 3 = 2x^2 − 5x − 3
  ['fa.trinomial', 1028, '2x^2 - 5x - 3', '(2x + 1)(x - 3)'],
  // (3x + 4)(x + 2) = 3x^2 + 6x + 4x + 8 = 3x^2 + 10x + 8
  ['fa.trinomial', 1505, '3x^2 + 10x + 8', '(3x + 4)(x + 2)'],
  // (x − 2)(x − 3)(x + 3) = (x − 2)(x^2 − 9) = x^3 − 2x^2 − 9x + 18
  ['fa.grouping', 154, 'x^3 - 2x^2 - 9x + 18', '(x - 2)(x - 3)(x + 3)'],
  // (x + 3)(x^2 + 4) = x^3 + 4x + 3x^2 + 12
  ['fa.grouping', 288, 'x^3 + 3x^2 + 4x + 12', '(x + 3)(x^2 + 4)'],
  // (2x + 9)(2x − 9) = 4x^2 − 18x + 18x − 81 = 4x^2 − 81
  ['fa.squares', 1, '4x^2 - 81', '(2x + 9)(2x - 9)'],
  // (2x − 3)^2 = 4x^2 − 12x + 9
  ['fa.squares', 13, '4x^2 - 12x + 9', '(2x - 3)^2'],
  // (x + 7)(x − 7) = x^2 − 49
  ['fa.squares', 14, 'x^2 - 49', '(x + 7)(x - 7)'],
  // (3x + 5)(3x − 5) = 9x^2 − 25
  ['fa.squares', 83, '9x^2 - 25', '(3x + 5)(3x - 5)'],
  // (x + 5)^2 = x^2 + 10x + 25
  ['fa.squares', 264, 'x^2 + 10x + 25', '(x + 5)^2'],
  // 3x(2x + 3) = 6x^2 + 9x
  ['fa.gcf', 5846, '6x^2 + 9x', '3x(2x + 3)'],
]

describe('factoring worked by hand: the right answers', () => {
  for (const [templateId, seed, f, hand] of PINS) {
    it(`${f} = ${hand}`, { timeout: 120_000 }, () => {
      const a = problem(templateId, seed, f)
      expect(sameFactorization(a.answerText, hand), `${a.answerText} vs ${hand}`).toBe(true)
      expect(product(a, hand)).toBe('correct')
    })
  }

  it('x^2 + 49 does not factor over the integers', { timeout: 120_000 }, () => {
    const a = problem('fa.squares', 49, 'x^2 + 49')
    expect(a.prime).toBe(true)
    expect(graded(a, 'product', { choice: 'prime', product: '' })).toEqual(['correct'])
    expect(graded(a, 'product', { choice: 'factors', product: '(x + 7)(x - 7)' })).toEqual(['fa_sum_of_squares'])
    expect(graded(a, 'product', { choice: 'factors', product: '(x + 7)^2' })).toEqual(['fa_sum_of_squares'])
  })
})

describe('factoring worked by hand: the slips she writes', () => {
  it('cubes: same, opposite, always plus, each missed', { timeout: 120_000 }, () => {
    const a = problem('fa.cubes', 66, 'x^3 - 8')
    expect(graded(a, 'cubed', { cube1: 'x', cube2: '2' })).toEqual(['correct', 'correct'])
    expect(graded(a, 'cubed', { cube1: 'x', cube2: '8' })).toEqual(['correct', 'fa_cube_root_coefficient'])
    // (x − 2)(x^2 − 2x + 4) = x^3 − 4x^2 + 8x − 8: the middle sign is the binomial's.
    expect(product(a, '(x - 2)(x^2 - 2x + 4)')).toBe('fa_cube_middle_sign')
    // (x − 2)(x^2 + 4x + 4) = (x − 2)(x + 2)^2: the 2ab of a square.
    expect(product(a, '(x - 2)(x^2 + 4x + 4)')).toBe('fa_cube_middle_doubled')
    // (x − 2)(x^2 + 2x − 4): the last term negative.
    expect(product(a, '(x - 2)(x^2 + 2x - 4)')).toBe('fa_cube_last_negative')
    // (x − 2)^3 = x^3 − 6x^2 + 12x − 8.
    expect(product(a, '(x - 2)^3')).toBe('fa_cube_binomial_cubed')
    // Typed back, or unreadable: not an attempt.
    expect(product(a, 'x^3 - 8')).toBe('invalid')
    expect(product(a, '(x - 2)(x^2 + 2x + 4')).toBe('invalid')
  })

  it('cubes: the cube root of the 8 not taken; a common factor not taken out first', { timeout: 120_000 }, () => {
    const a = problem('fa.cubes', 1, '8x^3 + 27')
    expect(graded(a, 'cubed', { cube1: '8x', cube2: '3' })).toEqual(['fa_cube_root_coefficient', 'correct'])
    // (8x + 3)(64x^2 − 24x + 9) = 512x^3 + 27.
    expect(product(a, '(8x + 3)(64x^2 - 24x + 9)')).toBe('fa_cube_root_coefficient')
    const g = problem('fa.cubes', 348, '2x^3 + 54')
    expect(product(g, '2(x^3 + 27)')).toBe('fa_stopped_early')
    expect(product(g, '(2x + 6)(x^2 - 3x + 9)')).toBe('fa_stopped_early')
  })

  it('complete: a pattern left unfinished, a sum of squares split, a difference written as a square', { timeout: 120_000 }, () => {
    const a = problem('fa.complete', 33, 'x^4 - 16')
    expect(product(a, '(x^2 + 4)(x^2 - 4)')).toBe('fa_stopped_early')
    // (x^2 + 4)(x − 2)^2 = (x^2 + 4)(x^2 − 4x + 4): not x^4 − 16.
    expect(product(a, '(x^2 + 4)(x - 2)^2')).toBe('fa_diff_as_square')
    // (x + 2)(x − 2)(x + 2)(x − 2) = (x^2 − 4)^2 = x^4 − 8x^2 + 16.
    expect(product(a, '(x + 2)(x - 2)(x + 2)(x - 2)')).toBe('fa_sum_of_squares')
    expect(product(problem('fa.complete', 980, '3x^3 - 12x'), '3x(x^2 - 4)')).toBe('fa_stopped_early')
    expect(product(problem('fa.complete', 191, 'x^4 - 5x^2 + 4'), '(x^2 - 1)(x^2 - 4)')).toBe('fa_stopped_early')
  })

  it('trinomials: the signs swapped, and a pair that multiplies right but adds wrong', { timeout: 120_000 }, () => {
    const a = problem('fa.trinomial', 123, 'x^2 + x - 6')
    // (x − 3)(x + 2) = x^2 − x − 6.
    expect(product(a, '(x - 3)(x + 2)')).toBe('fa_tri_signs_swapped')
    // (x + 6)(x − 1) = x^2 + 5x − 6.
    expect(product(a, '(x + 6)(x - 1)')).toBe('fa_tri_wrong_pair')
    const b = problem('fa.trinomial', 923, '6x^2 + 7x - 3')
    // (2x − 3)(3x + 1) = 6x^2 − 7x − 3.
    expect(product(b, '(2x - 3)(3x + 1)')).toBe('fa_tri_signs_swapped')
    // (6x − 1)(x + 3) = 6x^2 + 17x − 3.
    expect(product(b, '(6x - 1)(x + 3)')).toBe('fa_tri_wrong_pair')
    // Multiplied back to something else entirely: plain wrong.
    expect(product(b, '(6x + 1)(x + 3)')).toBe('wrong')
  })

  it('grouping: the sign kept when a negative comes out, the pair not finished, the product not finished', { timeout: 120_000 }, () => {
    const a = problem('fa.grouping', 154, 'x^3 - 2x^2 - 9x + 18')
    expect(graded(a, 'pairs', { pair1: 'x^2(x - 2)', pair2: '-9(x - 2)' })).toEqual(['correct', 'correct'])
    // −9(x + 2) = −9x − 18, not −9x + 18.
    expect(graded(a, 'pairs', { pair1: 'x^2(x - 2)', pair2: '-9(x + 2)' })).toEqual(['correct', 'fa_group_sign'])
    expect(graded(a, 'pairs', { pair1: 'x(x^2 - 2x)', pair2: '-9(x - 2)' })).toEqual(['fa_gcf_not_greatest', 'correct'])
    // 9(−x + 2) is equal, but its binomial does not match the first pair's: not an attempt.
    expect(graded(a, 'pairs', { pair1: 'x^2(x - 2)', pair2: '9(-x + 2)' })).toEqual(['correct', 'invalid'])
    expect(product(a, '(x - 2)(x^2 - 9)')).toBe('fa_stopped_early')
    expect(product(a, '(x - 2)(x - 3)^2')).toBe('fa_diff_as_square')
    // Any order, either sign of a factor.
    expect(product(a, '(3 - x)(2 - x)(x + 3)')).toBe('correct')
  })

  it('squares: a difference written as a square; the sign inside a perfect square', { timeout: 120_000 }, () => {
    expect(product(problem('fa.squares', 14, 'x^2 - 49'), '(x - 7)^2')).toBe('fa_diff_as_square')
    expect(product(problem('fa.squares', 264, 'x^2 + 10x + 25'), '(x - 5)^2')).toBe('fa_square_sign')
    expect(graded(problem('fa.squares', 14, 'x^2 - 49'), 'product', { choice: 'prime', product: '' })).toEqual(['wrong'])
  })

  it('common factor: not the greatest, from the number or from x', { timeout: 120_000 }, () => {
    const a = problem('fa.gcf', 5846, '6x^2 + 9x')
    expect(product(a, '3(2x^2 + 3x)')).toBe('fa_gcf_not_greatest')
    expect(product(a, 'x(6x + 9)')).toBe('fa_gcf_not_greatest')
    expect(product(a, '3x(2x + 9)')).toBe('wrong')
  })
})
