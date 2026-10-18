import { describe, expect, it } from 'vitest'
import { convertForm, convertMistakes, gradeConvertForm, readForm } from './convert'

describe('readForm and convertForm', () => {
  it.each([
    ['2^5 = 32', 'log_2(32) = 5'],
    ['32 = 2^5', 'log_2(32) = 5'],
    ['log_3(81) = 4', '3^4 = 81'],
    ['e^(2x) = 7', 'ln(7) = 2x'],
    ['ln(x) = 3', 'e^3 = x'],
    ['10^(-2) = 0.01', 'log(0.01) = -2'],
    ['log(x) = 2', '10^2 = x'],
    ['(1/2)^x = 8', 'log_(1/2)(8) = x'],
    ['4 = log_2(x + 1)', '2^4 = x + 1'],
  ])('%s ⟷ %s', (given, other) => {
    expect(convertForm(given)).toBe(other)
    expect(convertForm(other)).not.toBeNull()
  })

  it('neither form', () => {
    expect(convertForm('x = 3')).toBeNull()
    expect(readForm('x + 1 = 2')).toBeNull()
  })

  it('the parts', () => {
    const p = readForm('e^(2x) = 7')!
    expect(p.form).toBe('exp')
    expect(p.baseValue).toBeCloseTo(Math.E, 15)
    expect(p.exponent.toString()).toBe('2 * x')
    expect(p.result.toString()).toBe('7')
  })
})

describe('gradeConvertForm', () => {
  it.each([
    ['2^5 = 32', 'log_2(32) = 5'],
    ['2^5 = 32', '5 = log_2(32)'],
    ['2^5 = 32', 'logBASE(32, 2) = 5'],
    ['log_3(81) = 4', '3^4 = 81'],
    ['log_3(81) = 4', '81 = 3^4'],
    ['e^(2x) = 7', 'ln(7) = 2x'],
    ['e^(2x) = 7', '2x = ln(7)'],
    ['e^(2x) = 7', 'log_e(7) = 2x'],
    ['ln(x) = 3', 'e^3 = x'],
    ['10^3 = 1000', 'log(1000) = 3'],
  ])('%s → %s is correct', (given, answer) => {
    expect(gradeConvertForm(given, answer).verdict).toBe('correct')
  })

  it.each([
    ['2^5 = 32', 'log_5(32) = 2', 'the base and the exponent traded places'],
    ['2^5 = 32', 'log_2(5) = 32', 'the exponent and the result traded places'],
    ['2^5 = 32', 'log_32(2) = 5', 'the base and the result traded places'],
    ['log_3(81) = 4', '4^3 = 81', 'the base and the exponent traded places'],
    ['log_3(81) = 4', '81^4 = 3', 'the base and the result traded places'],
    ['10^3 = 1000', 'log_3(1000) = 10', 'the base and the exponent traded places'],
  ])('%s → %s is log_convert_swapped (%s)', (given, answer, say) => {
    const g = gradeConvertForm(given, answer)
    expect(g.verdict).toBe('mistake')
    if (g.verdict !== 'mistake') return
    expect(g.mistake).toBe('log_convert_swapped')
    expect(g.witness).toContain(say)
  })

  it('b times y is log_convert_multiplied', () => {
    const g = gradeConvertForm('log_3(81) = 4', '3 * 4 = 81')
    expect(g.verdict === 'mistake' && g.mistake).toBe('log_convert_multiplied')
  })

  it('the same equation in the wrong form is not an attempt', () => {
    expect(gradeConvertForm('2^5 = 32', '2^5 = 32')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeConvertForm('log(x) = 2', 'x = 100')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
  })

  it('a wrong answer that is no swap is plain wrong; unreadable is invalid; a given in neither form is unsupported', () => {
    expect(gradeConvertForm('2^5 = 32', 'log_2(30) = 5').verdict).toBe('wrong')
    expect(gradeConvertForm('2^5 = 32', 'log_2(32 = 5').verdict).toBe('invalid')
    expect(gradeConvertForm('x = 3', 'x = 3').verdict).toBe('unsupported')
  })
})

describe('convertMistakes', () => {
  it('every swap of two parts, plus b·y for the exponential form', () => {
    expect(convertMistakes('log_3(81) = 4').map((c) => [c.id, c.text])).toEqual([
      ['log_convert_swapped', '4^3 = 81'],
      ['log_convert_swapped', '3^81 = 4'],
      ['log_convert_swapped', '81^4 = 3'],
      ['log_convert_multiplied', '3 * 4 = 81'],
    ])
  })

  it('a swap that is not a valid base (1, 0, negative, a variable) is left out', () => {
    expect(convertMistakes('2^1 = 2').map((c) => c.text)).not.toContain('log_1(2) = 2')
    expect(convertMistakes('e^(2x) = 7').every((c) => !c.text.includes('log_(2x)'))).toBe(true)
  })
})
