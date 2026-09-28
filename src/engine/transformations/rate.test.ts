import { describe, expect, it } from 'vitest'
import { ratToString } from '@/notation/rational'
import { averageRateMistakes, averageRateOfChange, gradeAverageRate } from './rate'
import type { TransformGrade } from './types'

const verdictOf = (g: TransformGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)

describe('averageRateOfChange', () => {
  it.each([
    ['x^2', 1, 4, '5'],
    ['1/x', 1, 3, '-1/3'],
    ['x^3 - 2x', -1, 2, '1'],
    ['(x + 1)/(x - 2)', 3, 5, '-1'],
    ['-2(x - 3)^2 + 1', 2, 5, '-2'],
    ['f(x) = 3x - 5', 0, 10, '3'],
    ['x^2', 0.5, '3/2', '2'],
    ['x^2', 4, 1, '5'],
    ['sqrt(x)', 1, 4, '1/3'],
    ['abs(2x - 3)', -1, 3, '-1/2'],
  ])('%s on [%s, %s] = %s', (f, a, b, rate) => {
    const r = averageRateOfChange(f, a, b)
    expect(r, f).not.toBeNull()
    expect(ratToString(r!.rate)).toBe(rate)
    expect(r!.text).toBe(rate)
  })

  it('shows the work exactly', () => {
    expect(averageRateOfChange('x^2', 1, 4)!.steps).toEqual([
      'f(4) = 4^2 = 16 and f(1) = 1^2 = 1.',
      'Average rate of change = (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 15/3 = 5.',
    ])
    expect(averageRateOfChange('1/x', 1, 3)!.steps).toEqual([
      'f(3) = 1/3 and f(1) = 1/1 = 1.',
      'Average rate of change = (f(3) − f(1))/(3 − 1) = (1/3 − 1)/(3 − 1) = (−2/3)/2 = −1/3.',
    ])
    expect(averageRateOfChange('x^3', -2, -1)!.steps[1]).toBe('Average rate of change = (f(−1) − f(−2))/(−1 − (−2)) = (−1 − (−8))/(−1 − (−2)) = 7/1 = 7.')
  })

  it('returns null rather than guessing', () => {
    expect(averageRateOfChange('sqrt(x)', 1, 2)).toBeNull() // f(2) = sqrt(2) is not rational
    expect(averageRateOfChange('1/(x - 2)', 0, 2)).toBeNull() // undefined at 2
    expect(averageRateOfChange('x^2', 3, 3)).toBeNull() // no interval
    expect(averageRateOfChange('x^', 0, 1)).toBeNull()
    expect(averageRateOfChange('log(x)', 1, 10)).toBeNull()
    expect(averageRateOfChange('x^2', 'one', 2)).toBeNull()
  })
})

describe('gradeAverageRate', () => {
  it('accepts the exact rate in any form', () => {
    for (const a of ['5', '15/3', '5.0', '10/2']) expect(verdictOf(gradeAverageRate('x^2', 1, 4, a))).toBe('correct')
    expect(gradeAverageRate('x^2', 1, 4, '5')).toEqual({
      verdict: 'correct',
      message: 'Correct: f(4) = 4^2 = 16 and f(1) = 1^2 = 1. Average rate of change = (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 15/3 = 5.',
    })
    expect(verdictOf(gradeAverageRate('1/x', 1, 4, '-0.25'))).toBe('correct')
  })

  it('names each mistake with the wrong number it gives', () => {
    expect(averageRateMistakes('x^2', 1, 4)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['rate_sign_flipped', '-5', []],
      ['rate_no_division', '15', []],
      ['rate_inverted', '1/5', []],
      ['rate_divided_by_b', '15/4', []],
    ])
    expect(gradeAverageRate('x^2', 1, 4, '-5')).toEqual({
      verdict: 'mistake',
      mistake: 'rate_sign_flipped',
      witness:
        'Subtract in the same order on top and bottom: (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 5. Your −5 has the opposite sign, which is what you get when the top subtracts one way and the bottom the other way.',
    })
    expect(gradeAverageRate('x^2', 1, 4, '15')).toEqual({
      verdict: 'mistake',
      mistake: 'rate_no_division',
      witness: '15 is the change in f, f(4) − f(1) = 16 − 1 = 15. Divide it by the change in x, 4 − 1 = 3: (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 5.',
    })
    expect(gradeAverageRate('x^2', 1, 4, '1/5')).toEqual({
      verdict: 'mistake',
      mistake: 'rate_inverted',
      witness: 'Rate of change is the change in y over the change in x (rise over run): (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 5. Your 1/5 is run over rise, (4 − 1)/(16 − 1).',
    })
    expect(gradeAverageRate('x^2', 1, 4, '3.75')).toEqual({
      verdict: 'mistake',
      mistake: 'rate_divided_by_b',
      witness: 'Divide by the change in x, 4 − 1 = 3, not by 4: (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 5. Your 15/4 is (16 − 1)/4.',
    })
  })

  it('realistic slips on other functions', () => {
    // 1/x on [1, 3]: rate −1/3.
    expect(verdictOf(gradeAverageRate('1/x', 1, 3, '1/3'))).toBe('rate_sign_flipped')
    expect(verdictOf(gradeAverageRate('1/x', 1, 3, '-2/3'))).toBe('rate_no_division')
    expect(verdictOf(gradeAverageRate('1/x', 1, 3, '-3'))).toBe('rate_inverted')
    expect(verdictOf(gradeAverageRate('1/x', 1, 3, '-2/9'))).toBe('rate_divided_by_b')
    // -2(x - 3)^2 + 1 on [2, 5]: rate −2.
    expect(verdictOf(gradeAverageRate('-2(x - 3)^2 + 1', 2, 5, '2'))).toBe('rate_sign_flipped')
    expect(verdictOf(gradeAverageRate('-2(x - 3)^2 + 1', 2, 5, '-6'))).toBe('rate_no_division')
    expect(verdictOf(gradeAverageRate('-2(x - 3)^2 + 1', 2, 5, '-1/2'))).toBe('rate_inverted')
    expect(verdictOf(gradeAverageRate('-2(x - 3)^2 + 1', 2, 5, '-6/5'))).toBe('rate_divided_by_b')
  })

  it('drops candidates equal to the answer and reports coincidences in shadows', () => {
    // x^2 on [−2, 1]: rise −3, run 3, rate −1. Run over rise is −1 too (dropped); dividing by b = 1 is no division.
    expect(averageRateMistakes('x^2', -2, 1)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['rate_sign_flipped', '1', []],
      ['rate_no_division', '-3', ['rate_divided_by_b']],
    ])
    expect(gradeAverageRate('x^2', -2, 1, '-1').verdict).toBe('correct')
  })

  it('plain wrong, rounded decimals, "undefined", unreadable answers and unsupported problems', () => {
    expect(gradeAverageRate('x^2', 1, 4, '7')).toEqual({
      verdict: 'wrong',
      message: 'f(4) = 4^2 = 16 and f(1) = 1^2 = 1. Average rate of change = (f(4) − f(1))/(4 − 1) = (16 − 1)/(4 − 1) = 15/3 = 5. Your answer, 7, is not 5.',
    })
    const rounded = gradeAverageRate('1/x', 1, 3, '-0.33')
    expect(rounded.verdict === 'wrong' && rounded.message.endsWith('−0.33 is a rounded decimal: give the exact value, −1/3.')).toBe(true)
    expect(gradeAverageRate('x^2', 1, 4, 'undefined').verdict).toBe('wrong')
    expect(gradeAverageRate('x^2', 1, 4, 'five').verdict).toBe('invalid')
    expect(gradeAverageRate('x^2', 1, 4, '1/0').verdict).toBe('invalid')
    expect(gradeAverageRate('sqrt(x)', 1, 2, '1').verdict).toBe('unsupported')
  })

  it('never names a mistake on the right answer', () => {
    const cases: [string, number, number][] = [
      ['x^2', 1, 4],
      ['x^2', -3, 3],
      ['1/x', 1, 3],
      ['x^3 - x', 0, 2],
      ['(2x - 1)/(x + 1)', 0, 3],
      ['5', 1, 2],
      ['sqrt(x)', 4, 9],
    ]
    for (const [f, a, b] of cases) {
      const r = averageRateOfChange(f, a, b)!
      expect(gradeAverageRate(f, a, b, r.text).verdict, f).toBe('correct')
      expect(averageRateMistakes(f, a, b)!.some((c) => c.text === r.text)).toBe(false)
    }
  })
})
