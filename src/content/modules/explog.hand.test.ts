/**
 * Hand-worked logarithms, the textbook ones, graded by the engine directly.
 * These are not generated seeds: each line is a problem a precalculus book prints.
 */
import { describe, expect, it } from 'vitest'
import {
  analyzeLogEquation,
  checkLogRewrite,
  checkLogStep,
  condenseLog,
  convertForm,
  expandLog,
  gradeConvertForm,
  gradeLogEquation,
  gradeLogValue,
  isExpandedLog,
  isSingleLog,
  logValue,
} from '@/engine'

const V = ['x', 'y', 'n'] as const

describe('exact values a textbook prints', () => {
  it.each([
    ['log_2(32)', '5'],
    ['log(0.001)', '-3'],
    ['ln(e^4)', '4'],
    ['log_9(27)', '3/2'],
    ['log_9(27)', '1.5'],
    ['log_(1/2)(8)', '-3'],
    ['log_5(1)', '0'],
    ['e^(ln(7))', '7'],
    ['e^(ln 7)', '7'],
    ['10^(log(3))', '3'],
    ['10^(log 3)', '3'],
    ['log_6(4) + log_6(9)', '2'],
    ['log_8(2)', '1/3'],
  ])('%s = %s', (problem, answer) => {
    expect(gradeLogValue(problem, answer).verdict, problem).toBe('correct')
  })

  it('log_9(27) is the fraction 3/2, and 1.5 is the same number', () => {
    expect(logValue('log_9(27)')).toMatchObject({ exactText: '3/2', value: 1.5, rational: true })
  })
})

describe('the other form', () => {
  it.each([
    ['2^5 = 32', 'log_2(32) = 5'],
    ['log_3(81) = 4', '3^4 = 81'],
    ['e^(2x) = 7', 'ln(7) = 2x'],
    ['10^(-2) = 0.01', 'log(0.01) = -2'],
    ['log_2(x) = 3', '2^3 = x'],
    ['(1/2)^x = 8', 'log_(1/2)(8) = x'],
  ])('%s rewrites as %s', (given, answer) => {
    expect(convertForm(given)).toBe(answer)
    expect(gradeConvertForm(given, answer).verdict).toBe('correct')
  })
})

describe('log base 2 of 7, exact and rounded', () => {
  it.each(['ln(7)/ln(2)', 'log(7)/log(2)', 'log_2(7)', 'logBASE(7, 2)'])('%s is an exact value of log_2(7)', (form) => {
    expect(gradeLogValue('log_2(7)', form).verdict, form).toBe('correct')
  })

  it('a decimal is not the exact value, and it is right only when the problem asks her to round', () => {
    expect(gradeLogValue('log_2(7)', '2.807')).toMatchObject({ verdict: 'invalid', reason: 'not_exact' })
    expect(gradeLogValue('log_2(7)', '2.807', { decimal: { places: 3 } }).verdict).toBe('correct')
    // Extra digits of the same rounded value stay inside half a unit of the last place.
    expect(gradeLogValue('log_2(7)', '2.8070', { decimal: { places: 3 } }).verdict).toBe('correct')
    expect(gradeLogValue('log_2(7)', 'ln(7)/ln(2)', { decimal: { places: 3 } })).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    const value = Math.log(7) / Math.log(2)
    expect(value).toBeCloseTo(2.807, 3)
    // A full last-place unit away is outside the tolerance.
    expect(gradeLogValue('log_2(7)', '2.806', { decimal: { places: 3 } }).verdict).not.toBe('correct')
    expect(gradeLogValue('log_2(7)', '2.808', { decimal: { places: 3 } }).verdict).not.toBe('correct')
  })

  it('2^x = 7 to three decimal places is 2.807, and the four exact spellings are right when no rounding is asked', () => {
    expect(gradeLogEquation('2^x = 7', 'x = 2.807')).toMatchObject({ verdict: 'invalid', reason: 'not_exact' })
    expect(gradeLogEquation('2^x = 7', 'x = 2.807', { decimal: { places: 3 } }).verdict).toBe('correct')
    expect(gradeLogEquation('2^x = 7', '2.807', { decimal: { places: 3 } }).verdict).toBe('correct')
    for (const form of ['log(7)/log(2)', 'ln(7)/ln(2)', 'log_2(7)', 'logBASE(7, 2)']) {
      expect(gradeLogEquation('2^x = 7', `x = ${form}`).verdict, form).toBe('correct')
      expect(gradeLogEquation('2^x = 7', form).verdict, form).toBe('correct')
    }
  })
})

describe('expand and condense', () => {
  it('log(x^2 * y^3) expands to 2log(x) + 3log(y)', () => {
    const start = 'log(x^2 * y^3)'
    const expanded = expandLog(start, ['x', 'y'])
    expect(expanded).toBe('2log(x) + 3log(y)')
    expect(isExpandedLog(expanded!, ['x', 'y'])).toBe(true)
    expect(checkLogRewrite(start, expanded!, { assumePositive: true, vars: ['x', 'y'] }).ok).toBe(true)
  })

  it('2log(x) + log(y) - log(n) condenses to one log of x^2 y / n', () => {
    const start = '2log(x) + log(y) - log(n)'
    const condensed = condenseLog(start, [...V])
    expect(condensed).toBe('log(x^2y/n)')
    expect(isSingleLog(condensed!, [...V])).toBe(true)
    expect(checkLogRewrite(start, condensed!, { assumePositive: true, vars: [...V] }).ok).toBe(true)
    expect(checkLogRewrite(start, 'log(x^2 * y / n)', { assumePositive: true, vars: [...V] }).ok).toBe(true)
  })
})

describe('equations worked by hand', () => {
  it('log(x) + log(x - 3) = 1 has only x = 5; x = -2 is extraneous', () => {
    const eq = 'log(x) + log(x - 3) = 1'
    const a = analyzeLogEquation(eq)!
    expect(a.kind).toBe('logarithmic')
    expect(a.solutions.map((s) => s.value)).toEqual([5])
    expect(a.extraneous.length).toBeGreaterThan(0)
    expect(gradeLogEquation(eq, 'x = 5').verdict).toBe('correct')
    expect(gradeLogEquation(eq, '5').verdict).toBe('correct')
    expect(gradeLogEquation(eq, 'x = 5 or x = -2')).toMatchObject({ verdict: 'mistake', mistake: 'log_extraneous_kept' })
    const combined = checkLogStep(eq, 'log(x(x - 3)) = 1', { original: eq, vars: ['x'] })
    expect(combined.ok).toBe(true)
    expect(combined.caveat).toBe('extraneous_check')
  })

  it('e^(2x) - 5e^x + 6 = 0 is ln 2 and ln 3', () => {
    const eq = 'e^(2x) - 5e^x + 6 = 0'
    const a = analyzeLogEquation(eq)!
    expect(a.kind).toBe('exponential')
    expect(a.solutions.map((s) => s.text).sort()).toEqual(['ln(2)', 'ln(3)'])
    expect(gradeLogEquation(eq, 'x = ln(2) or x = ln(3)').verdict).toBe('correct')
    expect(gradeLogEquation(eq, 'ln(2) or ln(3)').verdict).toBe('correct')
  })

  it('4^x - 3 * 2^x - 4 = 0 keeps x = 2 and drops u = -1', () => {
    const eq = '4^x - 3 * 2^x - 4 = 0'
    const a = analyzeLogEquation(eq)!
    expect(a.kind).toBe('exponential')
    expect(a.solutions.map((s) => s.value)).toEqual([2])
    expect(gradeLogEquation(eq, 'x = 2').verdict).toBe('correct')
    expect(gradeLogEquation(eq, '2').verdict).toBe('correct')
    // u = 2^x = -1 is not a solution. The engine reports only x = 2.
    expect(a.solutions).toHaveLength(1)
    expect(gradeLogEquation(eq, 'x = 2 or x = -1').verdict).not.toBe('correct')
  })

  it('9^x - 4 * 3^x + 3 = 0 is x = 0 or x = 1', () => {
    const eq = '9^x - 4 * 3^x + 3 = 0'
    const a = analyzeLogEquation(eq)!
    expect(a.solutions.map((s) => s.value).sort((p, q) => p - q)).toEqual([0, 1])
    expect(gradeLogEquation(eq, 'x = 0 or x = 1').verdict).toBe('correct')
    expect(gradeLogEquation(eq, '0 or 1').verdict).toBe('correct')
  })

  it('ln(x + 1) = 2 is x = e^2 - 1, and log(x + 5) = log(3) keeps x = -2', () => {
    expect(gradeLogEquation('ln(x + 1) = 2', 'x = e^2 - 1').verdict).toBe('correct')
    expect(gradeLogEquation('log(x + 5) = log(3)', 'x = -2').verdict).toBe('correct')
    expect(gradeLogEquation('log(x + 5) = log(3)', 'no solution')).toMatchObject({ verdict: 'mistake', mistake: 'log_valid_rejected' })
  })
})
