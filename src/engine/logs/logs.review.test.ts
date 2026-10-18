/**
 * Reviewer's spot check of the exponentials-and-logarithms core (not written by its author): textbook
 * problems with answers worked by hand, pushed through the public API.
 */
import { describe, expect, it } from 'vitest'
import { checkLogStep, gradeConvertForm, gradeLogEquation, gradeLogValue } from '@/engine'
import { InputSyntaxError, rewriteLogSyntax } from './syntax'

const verdict = (g: { verdict: string }) => g.verdict
const named = (g: { verdict: string; pattern?: { id: string }; mistake?: string }) =>
  g.verdict === 'mistake' ? (g.pattern?.id ?? g.mistake ?? 'mistake') : g.verdict

describe('exact values, as a textbook answers them', () => {
  const RIGHT: [string, string][] = [
    ['log(100)', '2'],
    ['log(1000)', '3'],
    ['log(1)', '0'],
    ['ln(e^4)', '4'],
    ['log_3(81)', '4'],
    ['log_5(1/25)', '-2'],
    ['log_2(1/8)', '-3'],
    ['log_(1/2)(8)', '-3'],
    ['log_9(27)', '3/2'],
    ['log_9(27)', '1.5'],
    ['log_8(2)', '1/3'],
    ['e^(ln(5))', '5'],
    ['10^(log(7))', '7'],
    ['log(8, 2)', '3'],
    ['logBASE(8, 2)', '3'],
    ['log2(8)', '3'],
  ]
  it('the right value is correct, whichever way the base is written', () => {
    for (const [problem, answer] of RIGHT) expect(verdict(gradeLogValue(problem, answer)), `${problem} = ${answer}`).toBe('correct')
  })
  it('log means base 10 here, not e', () => {
    expect(verdict(gradeLogValue('log(100)', '4.605', { decimal: { places: 3 } }))).not.toBe('correct')
    expect(verdict(gradeLogValue('ln(100)', '4.605', { decimal: { places: 3 } }))).toBe('correct')
  })
  it('classic slips are named, not just marked wrong', () => {
    expect(named(gradeLogValue('log_3(81)', '27'))).toBe('log_value_divided')
    expect(named(gradeLogValue('log(0.01)', '2'))).toBe('log_value_sign')
    expect(named(gradeLogValue('log_9(27)', '2/3'))).toBe('log_change_base_inverted')
  })
  it('a wrong value is never accepted', () => {
    for (const [problem, answer] of [['log_3(81)', '3'], ['log(1000)', '30'], ['log_9(27)', '3'], ['ln(e^4)', 'e^4']] as const) {
      expect(verdict(gradeLogValue(problem, answer)), `${problem} = ${answer}`).not.toBe('correct')
    }
  })
})

describe('equations, with the domain checked', () => {
  it('keeps the valid root and names a kept extraneous one', () => {
    // x(x - 2) = 8 gives 4 and -2; log_2(-2) is undefined.
    expect(verdict(gradeLogEquation('log_2(x) + log_2(x - 2) = 3', '4'))).toBe('correct')
    expect(verdict(gradeLogEquation('log_2(x) + log_2(x - 2) = 3', 'x = 4'))).toBe('correct')
    expect(named(gradeLogEquation('log_2(x) + log_2(x - 2) = 3', '4, -2'))).toBe('log_extraneous_kept')
    // x(x + 21) = 100 gives 4 and -25.
    expect(verdict(gradeLogEquation('log(x) + log(x + 21) = 2', '4'))).toBe('correct')
  })
  it('keeps both roots when both are in the domain', () => {
    // x^2 - 8 = 1: x = 3 or x = -3, and x^2 - 8 = 1 > 0 for both.
    expect(verdict(gradeLogEquation('log_3(x^2 - 8) = 0', '3, -3'))).toBe('correct')
    expect(verdict(gradeLogEquation('log_3(x^2 - 8) = 0', 'x = -3 or x = 3'))).toBe('correct')
    expect(verdict(gradeLogEquation('log_3(x^2 - 8) = 0', '3'))).not.toBe('correct')
  })
  it('solves exponential equations exactly', () => {
    expect(verdict(gradeLogEquation('3^(2x) = 81', '2'))).toBe('correct')
    expect(verdict(gradeLogEquation('2^(x + 1) = 16', '3'))).toBe('correct')
    expect(verdict(gradeLogEquation('5^x = 5^(2x - 3)', '3'))).toBe('correct')
    expect(verdict(gradeLogEquation('e^x = 5', 'ln(5)'))).toBe('correct')
    expect(verdict(gradeLogEquation('e^x = 5', 'x = ln 5'))).toBe('correct')
    expect(verdict(gradeLogEquation('e^x = 5', '1.609', { decimal: { places: 3 } }))).toBe('correct')
    expect(verdict(gradeLogEquation('ln(x + 1) = 2', 'e^2 - 1'))).toBe('correct')
    expect(verdict(gradeLogEquation('2^x = 7', 'log(7)/log(2)'))).toBe('correct')
    expect(verdict(gradeLogEquation('2^x = 7', 'ln(7)/ln(2)'))).toBe('correct')
    expect(verdict(gradeLogEquation('2^x = 7', 'log_2(7)'))).toBe('correct')
    expect(verdict(gradeLogEquation('2^x = 7', 'log(2)/log(7)'))).not.toBe('correct')
  })
  it('an equation with no solution', () => {
    // log(x) = log(-x) needs x > 0 and -x > 0 at once.
    expect(verdict(gradeLogEquation('log(x) = log(-x)', 'no solution'))).toBe('correct')
  })
})

describe('form conversion', () => {
  it('reads either form and names the swapped base', () => {
    expect(verdict(gradeConvertForm('log_4(64) = 3', '4^3 = 64'))).toBe('correct')
    expect(verdict(gradeConvertForm('10^-2 = 0.01', 'log(0.01) = -2'))).toBe('correct')
    expect(named(gradeConvertForm('log_4(64) = 3', '3^4 = 64'))).toBe('log_convert_swapped')
  })
})

describe('parser findings from the Gemini 4 review, each confirmed by running it', () => {
  it('a / or * after a log without parentheses asks for them, unless another log follows', () => {
    expect(rewriteLogSyntax('ln 7/ln 2')).toBe('ln(7)/ln(2)')
    expect(rewriteLogSyntax('log 7 / log 2')).toBe('log(7) / log(2)')
    // "ln 1/2" was read as ln(1)/2, and "log_2 1/8" as log_2(1)/8 (then named a quotient-rule slip).
    for (const s of ['ln 1/2', 'log_2 1/8', 'log 2*x', 'ln 5/2', 'lnx/2', 'log100/2']) {
      expect(() => rewriteLogSyntax(s), s).toThrow(InputSyntaxError)
    }
    expect(verdict(gradeLogEquation('e^(2x) = 5', 'ln 5/2'))).toBe('invalid')
    expect(verdict(gradeLogEquation('e^(2x) = 5', 'ln(5)/2'))).toBe('correct')
    expect(verdict(gradeLogEquation('2^x = 7', 'ln 7/ln 2'))).toBe('correct')
    expect(verdict(gradeLogValue('log_2(1/8)', 'log_2 1/8'))).toBe('invalid')
  })
  it('logBASE needs both inputs, as on the TI-84', () => {
    expect(() => rewriteLogSyntax('logBASE(8)')).toThrow(InputSyntaxError)
    expect(rewriteLogSyntax('logBASE(8, 2)')).toBe('log(8, 2)')
    expect(rewriteLogSyntax('logBASE(log(100), 2)')).toBe('log(log(100), 2)')
  })
  it('base e written as E is ln', () => {
    expect(rewriteLogSyntax('log_{E}(x)')).toBe('ln(x)')
    expect(rewriteLogSyntax('log_e(x)')).toBe('ln(x)')
  })
  it('an error inside a log points at its own character in the whole entry', () => {
    let caught: unknown
    try {
      rewriteLogSyntax('log_2(ln 2x)')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(InputSyntaxError)
    expect((caught as InputSyntaxError).position).toBe(6)
  })
})

describe('single steps', () => {
  it('legal steps pass and the classic slips are caught', () => {
    expect(checkLogStep('ln(x) = 3', 'x = e^3').ok).toBe(true)
    expect(checkLogStep('3^x = 20', 'x ln(3) = ln(20)').ok).toBe(true)
    expect(checkLogStep('log(x + 3) = 2', 'x + 3 = 100').ok).toBe(true)
    expect(checkLogStep('log(x + 3) = 2', 'log(x) + log(3) = 2').ok).toBe(false)
    expect(checkLogStep('ln(x) = 3', 'x = 3e').ok).toBe(false)
    expect(checkLogStep('2^x = 7', 'x = 7/2').ok).toBe(false)
    expect(checkLogStep('log(x) < 2', 'x < 100').ok).toBe(false)
    expect(checkLogStep('log(x) < 2', '0 < x < 100').ok).toBe(true)
  })
})
