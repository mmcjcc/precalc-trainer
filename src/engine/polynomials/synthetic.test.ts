import { describe, expect, it } from 'vitest'
import { ratToString } from '@/notation/rational'
import {
  divisorText,
  gradeBottomRow,
  gradeCoefficientRow,
  gradeIsFactor,
  gradeQuotient,
  gradeRemainder,
  gradeSyntheticTable,
  polyValueAt,
  quotientMistakes,
  remainderMistakes,
  syntheticDivision,
  syntheticMistakes,
} from './synthetic'
import type { PolyGrade } from './types'

/** (2x^3 − 3x^2 + 0x − 5) ÷ (x − 2) = 2x^2 + x + 2, remainder −1. */
const F = '2x^3 - 3x^2 - 5'

function mistakeOf(g: PolyGrade): string | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

describe('syntheticDivision — the table', () => {
  it('(2x^3 − 3x^2 + 0x − 5) ÷ (x − 2): bottom row 2, 1, 2, −1', () => {
    const t = syntheticDivision(F, 2)!
    expect(t.f).toBe('2x^3 - 3x^2 - 5')
    expect(t.divisor).toBe('x - 2')
    expect(ratToString(t.c)).toBe('2')
    expect(t.degree).toBe(3)
    expect(t.rows).toEqual({ coefficients: ['2', '-3', '0', '-5'], products: ['4', '2', '4'], bottom: ['2', '1', '2', '-1'] })
    expect(t.coefficients.map(ratToString)).toEqual(['2', '-3', '0', '-5'])
    expect(t.missingPowers).toEqual([1])
    expect(t.quotientCoefficients.map(ratToString)).toEqual(['2', '1', '2'])
    expect(t.quotientText).toBe('2x^2 + x + 2')
    expect(t.remainderText).toBe('-1')
    expect(t.isFactor).toBe(false)
    expect(t.substitution).toBe('2(2)^3 - 3(2)^2 - 5')
    expect(t.explanation).toEqual([
      'x − 2 is 0 at x = 2, so 2 goes in the box.',
      'Write the coefficients of 2x^3 − 3x^2 − 5 from the highest power down, with a 0 for the missing x term: 2, −3, 0, −5.',
      'Bring the first coefficient straight down: 2.',
      'Multiply 2·2 = 4, write it under −3 and add: −3 + 4 = 1.',
      'Multiply 2·1 = 2, write it under 0 and add: 0 + 2 = 2.',
      'Multiply 2·2 = 4, write it under −5 and add: −5 + 4 = −1.',
      'The bottom row is 2, 1, 2, −1. Its last number is the remainder, −1; the others are the coefficients of the quotient, which is one degree lower than f(x): 2x^2 + x + 2.',
      'Remainder theorem: the remainder is f(2). Check: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1.',
      'Factor theorem: the remainder is not 0, so x − 2 is not a factor of f(x).',
    ])
  })

  it('accepts the same polynomial as text with the 0 written, or as coefficients', () => {
    for (const f of ['2x^3 - 3x^2 + 0x - 5', 'f(x) = 2x^3 - 3x^2 - 5', [2, -3, 0, -5], ['2', '-3', '0', '-5']] as const) {
      expect(syntheticDivision(f, 2)!.rows.bottom, String(f)).toEqual(['2', '1', '2', '-1'])
    }
  })

  it('divisor x + 2 puts −2 in the box; two missing powers; a factor', () => {
    const t = syntheticDivision('x^4 - 3x^2 + 2x', -2)!
    expect(t.divisor).toBe('x + 2')
    expect(t.rows).toEqual({ coefficients: ['1', '0', '-3', '2', '0'], products: ['-2', '4', '-2', '0'], bottom: ['1', '-2', '1', '0', '0'] })
    expect(t.missingPowers).toEqual([3, 0])
    expect(t.quotientText).toBe('x^3 - 2x^2 + x')
    expect(t.isFactor).toBe(true)
    expect(t.explanation[0]).toBe('x + 2 = x − (−2) is 0 at x = −2, so −2 goes in the box.')
    expect(t.explanation[1]).toBe('Write the coefficients of x^4 − 3x^2 + 2x from the highest power down, with a 0 for the missing x^3 term and constant term: 1, 0, −3, 2, 0.')
    expect(t.explanation[3]).toBe('Multiply (−2)·1 = −2, write it under 0 and add: 0 + (−2) = −2.')
    expect(t.explanation[t.explanation.length - 1]).toBe('Factor theorem: the remainder is 0, so x + 2 is a factor: f(x) = (x + 2)(x^3 − 2x^2 + x).')
  })

  it('more hand-checked tables', () => {
    const cases: [string, number | string, string[], string, string][] = [
      ['x^3 - 7x + 6', -3, ['1', '-3', '2', '0'], 'x^2 - 3x + 2', '0'],
      ['x^3 - 7x + 6', 3, ['1', '3', '2', '12'], 'x^2 + 3x + 2', '12'],
      ['2x^3 + x^2 - 5x + 2', '1/2', ['2', '2', '-4', '0'], '2x^2 + 2x - 4', '0'],
      ['x^2 - 5x + 6', 1, ['1', '-4', '2'], 'x - 4', '2'],
      ['3x - 6', 2, ['3', '0'], '3', '0'],
      ['3x^4 - 2x^3 + x - 7', -1, ['3', '-5', '5', '-4', '-3'], '3x^3 - 5x^2 + 5x - 4', '-3'],
      ['x^3 + 8', -2, ['1', '-2', '4', '0'], 'x^2 - 2x + 4', '0'],
      ['4x^3 - x', '-1/2', ['4', '-2', '0', '0'], '4x^2 - 2x', '0'],
    ]
    for (const [f, c, bottom, q, r] of cases) {
      const t = syntheticDivision(f, c)!
      expect([t.rows.bottom, t.quotientText, t.remainderText], `${f} ÷ ${t.divisor}`).toEqual([bottom, q, r])
      expect(ratToString(polyValueAt(f, c)!), f).toBe(r)
    }
  })

  it('divisorText and polyValueAt', () => {
    expect(divisorText(2)).toBe('x - 2')
    expect(divisorText(-2)).toBe('x + 2')
    expect(divisorText('1/2')).toBe('x - 1/2')
    expect(divisorText(0)).toBe('x')
    expect(ratToString(polyValueAt(F, 2)!)).toBe('-1')
    expect(ratToString(polyValueAt(F, -2)!)).toBe('-33')
    expect(ratToString(polyValueAt(F, '1/2')!)).toBe('-11/2')
    expect(polyValueAt('1/x', 2)).toBeNull()
  })

  it('is null outside the model', () => {
    expect(syntheticDivision('5', 2)).toBeNull()
    expect(syntheticDivision('sqrt(x)', 2)).toBeNull()
    expect(syntheticDivision(F, 'two')).toBeNull()
    expect(gradeBottomRow('5', 2, '5').verdict).toBe('unsupported')
    expect(gradeQuotient('1/x', 2, 'x').verdict).toBe('unsupported')
    expect(gradeRemainder('x^2', 'c', '1').verdict).toBe('unsupported')
    expect(gradeIsFactor('7', 1, 'no').verdict).toBe('unsupported')
  })
})

describe('gradeBottomRow / gradeSyntheticTable', () => {
  it('reads the row from boxes, commas or spaces', () => {
    for (const a of ['2, 1, 2, -1', '2 1 2 -1', '2,1,2,−1', ['2', '1', '2', '-1'], ['2', ' 1 ', '4/2', '-1.0']] as const) {
      const g = gradeBottomRow(F, 2, a)
      expect(g.verdict, String(a)).toBe('correct')
      if (g.verdict === 'correct') expect(g.message).toBe('Correct: the bottom row is 2, 1, 2, −1, so the quotient is 2x^2 + x + 2 and the remainder is −1.')
    }
  })

  it('names each table slip', () => {
    const cases: [string, string][] = [
      ['2, -7, 14, -33', 'sd_wrong_sign_c'],
      ['2, 1, -3', 'sd_missing_placeholder'],
      ['4, 5, 10, 15', 'sd_first_coefficient'],
      ['6, 9, 18, 31', 'sd_first_coefficient'],
      ['2, 1, -2, -9', 'sd_subtracted'],
      ['2, -7, 2, -1', 'sd_subtracted'],
    ]
    for (const [a, kind] of cases) expect(mistakeOf(gradeBottomRow(F, 2, a)), a).toBe(kind)
    expect(syntheticMistakes(F, 2)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['sd_wrong_sign_c', '2, -7, 14, -33', ['sd_subtracted']],
      ['sd_missing_placeholder', '2, 1, -3', []],
      ['sd_first_coefficient', '4, 5, 10, 15', []],
      ['sd_first_coefficient', '6, 9, 18, 31', []],
    ])
  })

  it('witness sentences', () => {
    const w = (a: string) => {
      const g = gradeBottomRow(F, 2, a)
      return g.verdict === 'mistake' ? g.witness : g.verdict
    }
    expect(w('2, -7, 14, -33')).toBe(
      'The box holds the number that makes x − 2 zero: x = 2. Your bottom row 2, −7, 14, −33 is what −2 in the box gives (the same as subtracting each product instead of adding it).',
    )
    expect(w('2, 1, -3')).toBe(
      'f(x) has no x term, so the coefficient row needs a 0 in that place: 2, −3, 0, −5. Without it every later number lines up with the wrong power. Your bottom row 2, 1, −3 comes from the row 2, −3, −5.',
    )
    expect(w('4, 5, 10, 15')).toBe(
      'The first coefficient comes straight down: the bottom row starts with 2. The multiplying starts in the next column (2·2 = 4 goes under −3). Your bottom row 4, 5, 10, 15 comes from starting the bottom row with the product 4.',
    )
    expect(w('2, 1, -2, -9')).toBe(
      'Your first 2 numbers, 2, 1, are right. In the third column (under 0) you subtracted the product: 0 − 2 = −2. Synthetic division ADDS each column (the sign change is already in the box number 2): 0 + 2 = 2.',
    )
  })

  it('divisor x + 2 worked with 2 instead of −2', () => {
    const f = 'x^3 + 4x^2 + x - 6' // = (x + 2)(x^2 + 2x − 3)
    expect(syntheticDivision(f, -2)!.rows.bottom).toEqual(['1', '2', '-3', '0'])
    const g = gradeBottomRow(f, -2, '1, 6, 13, 20')
    expect(g).toMatchObject({
      verdict: 'mistake',
      mistake: 'sd_wrong_sign_c',
      witness: 'The box holds the number that makes x + 2 zero: x = −2. Your bottom row 1, 6, 13, 20 is what 2 in the box gives (the same as subtracting each product instead of adding it).',
    })
  })

  it('the products row and the box tell "−c in the box" from "subtracted"', () => {
    const bottom = ['2', '-7', '14', '-33']
    expect(mistakeOf(gradeSyntheticTable(F, 2, { bottom, products: ['4', '-14', '28'] }))).toBe('sd_subtracted')
    expect(mistakeOf(gradeSyntheticTable(F, 2, { bottom, products: ['-4', '14', '-28'] }))).toBe('sd_wrong_sign_c')
    expect(mistakeOf(gradeSyntheticTable(F, 2, { bottom, products: '4, -14, 28', box: '2' }))).toBe('sd_subtracted')
    const boxed = gradeSyntheticTable(F, 2, { bottom, box: '-2' })
    expect(boxed).toMatchObject({ verdict: 'mistake', mistake: 'sd_wrong_sign_c', witness: 'The box holds the number that makes x − 2 zero: x − 2 = 0 at x = 2, so write 2, not −2.' })
    expect(gradeSyntheticTable(F, 2, { bottom: ['2', '1', '2', '-1'], box: '5' })).toMatchObject({ verdict: 'wrong', message: 'The box holds the number that makes the divisor zero: x − 2 = 0 at x = 2.' })
    expect(gradeSyntheticTable(F, 2, { bottom: ['2', '1', '2', '-1'], products: ['4', '2', '4'], box: '2' }).verdict).toBe('correct')
  })

  it('a right bottom row with a wrong middle row is not yet right', () => {
    expect(gradeSyntheticTable(F, 2, { bottom: ['2', '1', '2', '-1'], products: ['4', '3', '4'] })).toMatchObject({
      verdict: 'wrong',
      message: 'Your bottom row is right. In the middle row, the number under 0 is 2·1 = 2: the box number times the bottom entry one column to the left.',
    })
    expect(gradeSyntheticTable(F, 2, { bottom: ['2', '1', '2', '-1'], products: ['2', '4', '2', '4'] })).toMatchObject({
      verdict: 'wrong',
      message: 'Your bottom row is right. The middle row has 3 numbers, one under each coefficient after the first (nothing goes under 2); you gave 4.',
    })
  })

  it('the right number in the box with the wrong-sign row can only be a subtraction', () => {
    expect(mistakeOf(gradeSyntheticTable(F, 2, { bottom: ['2', '-7', '14', '-33'], box: '2' }))).toBe('sd_subtracted')
    expect(mistakeOf(gradeSyntheticTable(F, 2, { bottom: ['2', '-7', '14', '-33'] }))).toBe('sd_wrong_sign_c')
  })

  it('an arithmetic slip is pinned to its column, against her own previous entry', () => {
    expect(gradeBottomRow(F, 2, '2, 1, 3, 1')).toMatchObject({
      verdict: 'wrong',
      message: 'Your first 2 numbers, 2, 1, are right. In the third column (under 0): multiply 2·1 = 2, then add 0 + 2 = 2, not 3.',
    })
    expect(gradeBottomRow(F, 2, '2, 2, 4, 3')).toMatchObject({
      verdict: 'wrong',
      message: 'Your first number, 2, is right. In the second column (under −3): multiply 2·2 = 4, then add −3 + 4 = 1, not 2.',
    })
    expect(gradeBottomRow(F, 2, '3, 3, 6, 7')).toMatchObject({ verdict: 'wrong', message: 'The first coefficient comes straight down: the bottom row starts with 2, not 3.' })
    expect(gradeBottomRow(F, 2, '2, 1, 2')).toMatchObject({
      verdict: 'wrong',
      message: 'The bottom row has one number under each coefficient of the top row 2, −3, 0, −5: 4 numbers. You gave 3.',
    })
  })

  it('missing placeholders: every way of leaving zeros out is recognised', () => {
    const f = 'x^4 - 3x^2 + 2x' // 1, 0, −3, 2, 0
    expect(syntheticMistakes(f, -2)!.filter((c) => c.kind === 'sd_missing_placeholder').map((c) => [c.coefficients.map(ratToString).join(' '), c.text])).toEqual([
      ['1 -3 2', '1, -5, 12'],
      ['1 0 -3 2', '1, -2, 1, 0'],
      ['1 -3 2 0', '1, -5, 12, -24'],
    ])
    const g = gradeBottomRow(f, -2, '1, -5, 12')
    expect(g.verdict === 'mistake' && g.witness).toBe(
      'f(x) has no x^3 term and constant term, so the coefficient row needs a 0 in those places: 1, 0, −3, 2, 0. Without them every later number lines up with the wrong power. Your bottom row 1, −5, 12 comes from the row 1, −3, 2.',
    )
    expect(mistakeOf(gradeBottomRow(f, -2, '1, -2, 1, 0'))).toBe('sd_missing_placeholder')
    // No missing power: no such candidate.
    expect(syntheticMistakes('x^3 + 4x^2 + x - 6', -2)!.some((c) => c.kind === 'sd_missing_placeholder')).toBe(false)
  })

  it('unreadable rows are invalid and say which box', () => {
    expect(gradeBottomRow(F, 2, ['2', '', '2', '-1'])).toMatchObject({ verdict: 'invalid', reason: 'unreadable', index: 1, message: 'Fill in every box of the bottom row.' })
    expect(gradeBottomRow(F, 2, '2, 1, 2, x')).toMatchObject({ verdict: 'invalid', index: 3, position: 9 })
    expect(gradeBottomRow(F, 2, '')).toMatchObject({ verdict: 'invalid' })
    expect(gradeBottomRow(F, 2, '2, 1, , -1')).toMatchObject({ verdict: 'invalid', index: 2 })
    expect(gradeSyntheticTable(F, 2, { bottom: '2, 1, 2, -1', box: 'two' })).toMatchObject({ verdict: 'invalid' })
    expect(gradeSyntheticTable(F, 2, { bottom: '2, 1, 2, -1', products: ['4', '', '4'] })).toMatchObject({ verdict: 'invalid', index: 1, message: 'Fill in every box of the middle row.' })
  })
})

describe('gradeQuotient', () => {
  it('accepts the quotient in any form', () => {
    for (const a of ['2x^2 + x + 2', 'q(x) = 2x^2 + x + 2', '2 + x + 2x^2', 'x(2x + 1) + 2', '2x^2+1x+2']) expect(gradeQuotient(F, 2, a).verdict, a).toBe('correct')
    expect(gradeQuotient('3x - 6', 2, '3').verdict).toBe('correct')
  })

  it('names the slips', () => {
    const cases: [string, string][] = [
      ['2x^3 + x^2 + 2x', 'sd_quotient_degree'],
      ['2x^3 + x^2 + 2x - 1', 'sd_quotient_degree'],
      ['2x + 1', 'sd_quotient_degree'],
      ['2x^2 - 7x + 14', 'sd_wrong_sign_c'],
      ['4x^2 + 5x + 10', 'sd_first_coefficient'],
    ]
    for (const [a, kind] of cases) expect(mistakeOf(gradeQuotient(F, 2, a)), a).toBe(kind)
    const g = gradeQuotient(F, 2, '2x^3 + x^2 + 2x')
    expect(g.verdict === 'mistake' && g.witness).toBe(
      'Dividing by x − 2 lowers the degree by one: f(x) has degree 3, so the quotient starts with x^2. The bottom row 2, 1, 2, −1 reads 2x^2 + x + 2, remainder −1. Yours starts one power too high, at x^3.',
    )
    expect(quotientMistakes(F, 2)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['sd_quotient_degree', '2x^3 + x^2 + 2x', []],
      ['sd_quotient_degree', '2x^3 + x^2 + 2x - 1', []],
      ['sd_quotient_degree', '2x + 1', ['sd_missing_placeholder']],
      ['sd_wrong_sign_c', '2x^2 - 7x + 14', ['sd_subtracted']],
      ['sd_first_coefficient', '4x^2 + 5x + 10', []],
      ['sd_first_coefficient', '6x^2 + 9x + 18', []],
    ])
    // With no missing power the placeholder slip has its own quotient.
    const f = 'x^4 - 3x^2 + 2x'
    expect(mistakeOf(gradeQuotient(f, -2, 'x - 5'))).toBe('sd_missing_placeholder')
  })

  it('the whole division result is not an attempt at the quotient', () => {
    expect(gradeQuotient(F, 2, '2x^2 + x + 2 - 1/(x - 2)')).toMatchObject({
      verdict: 'invalid',
      reason: 'not_in_form',
      message: 'That is the whole result of the division. This answer is only the quotient, the polynomial part; the remainder −1 goes in its own answer.',
    })
    expect(gradeQuotient(F, 2, '(2x^3 - 3x^2 - 5)/(x - 2)')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeQuotient(F, 2, '2x^2 + x + 2 + 1/(x - 2)')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeQuotient(F, 2, '2x^2 + + ')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
  })

  it('other wrong quotients are multiplied back', () => {
    expect(gradeQuotient(F, 2, '2x^2 + x + 3')).toMatchObject({
      verdict: 'wrong',
      message:
        "Check by multiplying back: (x − 2)·(your quotient) + (−1) should give f(x). Yours gives 2x^3 − 3x^2 + x − 7, but f(x) = 2x^3 − 3x^2 − 5. The quotient's coefficients are the bottom row without its last number.",
    })
  })
})

describe('gradeRemainder and the remainder theorem', () => {
  it('correct, as a remainder and as f(c)', () => {
    expect(gradeRemainder(F, 2, '-1')).toMatchObject({
      verdict: 'correct',
      message: 'Correct: the remainder is −1, the last number of the bottom row 2, 1, 2, −1. (Remainder theorem: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1.)',
    })
    expect(gradeRemainder(F, 2, '−1', { ask: 'value' })).toMatchObject({ verdict: 'correct', message: 'Correct: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1, the last number of the bottom row 2, 1, 2, −1.' })
    expect(gradeRemainder('x^3 - 7x + 6', -3, '0').verdict).toBe('correct')
    expect(gradeRemainder('x^3 - 7x + 6', -3, 'none').verdict).toBe('correct')
    expect(gradeRemainder(F, '1/2', '-11/2').verdict).toBe('correct')
    expect(gradeRemainder(F, '1/2', '-5.5').verdict).toBe('correct')
  })

  it('names the slips', () => {
    const cases: [string, string][] = [
      ['2', 'sd_remainder_last_quotient'],
      ['-33', 'sd_wrong_sign_c'],
      ['-3', 'sd_missing_placeholder'],
      ['15', 'sd_first_coefficient'],
    ]
    for (const [a, kind] of cases) expect(mistakeOf(gradeRemainder(F, 2, a)), a).toBe(kind)
    const g = gradeRemainder(F, 2, '2')
    expect(g.verdict === 'mistake' && g.witness).toBe('The remainder is the LAST number of the bottom row 2, 1, 2, −1: −1. Your 2 is the number before it, the constant term of the quotient.')
    const v = gradeRemainder(F, 2, '-33', { ask: 'value' })
    expect(v.verdict === 'mistake' && v.witness).toBe('f(2) means x = 2: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1. Your −33 is f(−2), the value at the opposite number.')
    const r = gradeRemainder(F, 2, '-33')
    expect(r.verdict === 'mistake' && r.witness).toBe(
      'x − 2 is 0 at x = 2, so the remainder is f(2) = −1. Your −33 is f(−2): it comes from −2 in the box (or from subtracting each product instead of adding).',
    )
    expect(remainderMistakes(F, 2)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['sd_remainder_last_quotient', '2', []],
      ['sd_wrong_sign_c', '-33', ['sd_subtracted']],
      ['sd_missing_placeholder', '-3', []],
      ['sd_first_coefficient', '15', []],
      ['sd_first_coefficient', '31', []],
    ])
  })

  it('plain wrong and invalid', () => {
    expect(gradeRemainder(F, 2, '7')).toMatchObject({
      verdict: 'wrong',
      message: 'The remainder is the last number of the bottom row, −1. Check with the remainder theorem: f(2) = 2(2)^3 − 3(2)^2 − 5 = −1. Your answer, 7, is not −1.',
    })
    expect(gradeRemainder(F, 2, '-1/(x - 2)')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeRemainder(F, 2, '')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('gradeIsFactor — the factor theorem', () => {
  const g = 'x^3 - 7x + 6' // (x − 1)(x − 2)(x + 3)

  it('correct answers explain why', () => {
    expect(gradeIsFactor(g, -3, 'yes')).toMatchObject({
      verdict: 'correct',
      message: 'Correct: f(−3) = (−3)^3 − 7(−3) + 6 = 0, so x + 3 is a factor (factor theorem): f(x) = (x + 3)(x^2 − 3x + 2).',
    })
    expect(gradeIsFactor(g, 3, false)).toMatchObject({ verdict: 'correct', message: 'Correct: f(3) = 3^3 − 7(3) + 6 = 12, which is not 0, so x − 3 is not a factor (factor theorem).' })
    expect(gradeIsFactor(F, 2, 'No').verdict).toBe('correct')
    expect(gradeIsFactor(g, 1, true).verdict).toBe('correct')
  })

  it('testing the opposite number is named', () => {
    expect(gradeIsFactor(g, -3, 'no')).toMatchObject({
      verdict: 'mistake',
      mistake: 'sd_wrong_sign_c',
      witness: 'x + 3 is 0 at x = −3, so the number to test is −3: f(−3) = (−3)^3 − 7(−3) + 6 = 0. Testing 3 gives f(3) = 12, which answers the question for x − 3 instead.',
    })
    expect(mistakeOf(gradeIsFactor(g, 3, 'yes'))).toBe('sd_wrong_sign_c')
  })

  it('otherwise a wrong answer is plain', () => {
    // f(2) = −1 and f(−2) = −33: both readings say "not a factor".
    expect(gradeIsFactor(F, 2, 'yes')).toMatchObject({
      verdict: 'wrong',
      message: 'f(2) = 2(2)^3 − 3(2)^2 − 5 = −1. The remainder is not 0, so x − 2 does not divide f(x) evenly: it is not a factor.',
    })
    // x^2 − 4: both 2 and −2 are zeros.
    expect(gradeIsFactor('x^2 - 4', 2, 'no')).toMatchObject({ verdict: 'wrong' })
    expect(gradeIsFactor(g, 1, 'maybe')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('synthetic mistakes never fire on the right answer', () => {
  it('every candidate differs from the right answer and grades as its own kind', () => {
    const problems: [string, number | string][] = [
      [F, 2],
      ['x^4 - 3x^2 + 2x', -2],
      ['x^3 - 7x + 6', -3],
      ['x^3 - 7x + 6', 3],
      ['2x^3 + x^2 - 5x + 2', '1/2'],
      ['x^2 - 5x + 6', 1],
      ['3x - 6', 2],
      ['x^3 + 8', -2],
      ['-x^3 + 2x^2 - 5', -1],
      ['x^5 - 1', 1],
    ]
    for (const [f, c] of problems) {
      const t = syntheticDivision(f, c)!
      const label = `${f} ÷ (${t.divisor})`
      expect(gradeBottomRow(f, c, t.rows.bottom).verdict, label).toBe('correct')
      expect(gradeSyntheticTable(f, c, { bottom: t.rows.bottom, products: t.rows.products, box: ratToString(t.c) }).verdict, label).toBe('correct')
      expect(gradeQuotient(f, c, t.quotientText).verdict, label).toBe('correct')
      expect(gradeRemainder(f, c, t.remainderText).verdict, label).toBe('correct')
      expect(gradeIsFactor(f, c, t.isFactor).verdict, label).toBe('correct')
      for (const k of syntheticMistakes(f, c)!) {
        expect(k.text, label).not.toBe(t.rows.bottom.join(', '))
        expect(mistakeOf(gradeBottomRow(f, c, k.text)), `${label}: ${k.text}`).toBe(k.kind)
      }
      for (const k of quotientMistakes(f, c)!) {
        expect(k.text, label).not.toBe(t.quotientText)
        expect(mistakeOf(gradeQuotient(f, c, k.text)), `${label}: ${k.text}`).toBe(k.kind)
      }
      for (const k of remainderMistakes(f, c)!) {
        expect(k.text, label).not.toBe(t.remainderText)
        expect(mistakeOf(gradeRemainder(f, c, k.text)), `${label}: ${k.text}`).toBe(k.kind)
      }
    }
  })
})

describe('numbers too large for exact arithmetic', () => {
  it('are reported, never thrown', () => {
    expect(['invalid', 'wrong']).toContain(gradeBottomRow(F, 2, '2, 9007199254740991, 2, -1').verdict)
    expect(['invalid', 'wrong']).toContain(gradeQuotient(F, 2, '9007199254740991x^2 + 9007199254740991x').verdict)
    expect(['invalid', 'wrong']).toContain(gradeRemainder(F, 2, '99999999999999999999999').verdict)
  })
})

describe('gradeCoefficientRow — setting up the top row', () => {
  it('the row with its placeholders', () => {
    expect(gradeCoefficientRow(F, '2, -3, 0, -5')).toMatchObject({ verdict: 'correct', message: 'Correct: 2, −3, 0, −5 (the 0 holds the place of the missing x term).' })
    expect(gradeCoefficientRow(F, ['2', '-3', '0', '-5']).verdict).toBe('correct')
    expect(gradeCoefficientRow('x^2 - 5x + 6', '1 -5 6')).toMatchObject({ verdict: 'correct', message: 'Correct: 1, −5, 6.' })
    const g = gradeCoefficientRow(F, '2, -3, 0, -5')
    expect(g.verdict === 'correct' && g.explanation).toEqual([
      'f(x) = 2x^3 − 3x^2 − 5 has degree 3, so the row has 4 numbers: the coefficient of each power from x^3 down to the constant term.',
      'There is no x term, so its place gets a 0: 2, −3, 0, −5.',
    ])
  })

  it('a placeholder left out is named', () => {
    expect(gradeCoefficientRow(F, '2, -3, -5')).toMatchObject({
      verdict: 'mistake',
      mistake: 'sd_missing_placeholder',
      witness:
        'f(x) = 2x^3 − 3x^2 − 5 has no x term. Its place still needs a 0 in the row, or every later number lines up with the wrong power: a degree-3 polynomial has 4 coefficients, and your row has 3.',
    })
    const f = 'x^4 - 3x^2 + 2x' // 1, 0, −3, 2, 0
    expect(gradeCoefficientRow(f, '1, 0, -3, 2, 0').verdict).toBe('correct')
    for (const a of ['1, -3, 2', '1, 0, -3, 2', '1, -3, 2, 0']) expect(mistakeOf(gradeCoefficientRow(f, a)), a).toBe('sd_missing_placeholder')
  })

  it('other slips are pointed at without giving the number away', () => {
    expect(gradeCoefficientRow(F, '-5, 0, -3, 2')).toMatchObject({
      verdict: 'wrong',
      message: 'Start with the highest power: the first number is the coefficient of x^3, and the constant term comes last. Your row is in the opposite order.',
    })
    expect(gradeCoefficientRow(F, '2, 3, 0, -5')).toMatchObject({ verdict: 'wrong', message: 'Check the second number: it is the coefficient of the x^2 term in f(x) = 2x^3 − 3x^2 − 5, sign included.' })
    expect(gradeCoefficientRow(F, '2, -3, 1, -5')).toMatchObject({ verdict: 'wrong', message: 'Check the third number: it is the coefficient of the x term in f(x) = 2x^3 − 3x^2 − 5 (that power is missing).' })
    expect(gradeCoefficientRow(F, '2, -3, 0, -5, 0')).toMatchObject({
      verdict: 'wrong',
      message: 'f(x) has degree 3, so the row has 4 numbers: one for each power from x^3 down to the constant term (a 0 for a power that is missing). You gave 5.',
    })
    expect(gradeCoefficientRow(F, '2, -3, , -5')).toMatchObject({ verdict: 'invalid', index: 2 })
    expect(gradeCoefficientRow('7', '7').verdict).toBe('unsupported')
  })
})
