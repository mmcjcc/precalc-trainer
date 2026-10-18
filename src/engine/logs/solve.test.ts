import { describe, expect, it } from 'vitest'
import { analyzeLogEquation, gradeLogEquation, logEquationMistakes, parseSolutionAnswer } from './solve'
import type { LogGrade, LogMistakeId } from './types'

function mistakeOf(g: LogGrade): LogMistakeId | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

describe('analyzeLogEquation', () => {
  it('a log equation: domain, algebraic form, candidates, the extraneous one and why', () => {
    const a = analyzeLogEquation('log(x) + log(x - 3) = 1')!
    expect(a.kind).toBe('logarithmic')
    expect(a.domainText).toBe('x > 3')
    expect(a.algebraic).toBe('x(x - 3) = 10')
    expect(a.candidates.map((c) => c.text)).toEqual(['-2', '5'])
    expect(a.solutions).toEqual([{ value: 5, text: '5', exact: true }])
    expect(a.extraneous.map((e) => [e.text, e.argument, e.argumentValue])).toEqual([['-2', 'x', '−2']])
    expect(a.explanation).toEqual([
      'Domain: every log needs a positive input, so x > 3.',
      'Combine the logs and rewrite without them: x(x − 3) = 10.',
      'Solve: x = −2 or x = 5.',
      'x = −2 makes log(x) undefined: its input is −2, and a log needs a positive input. So x = −2 is extraneous.',
      'Solution: x = 5.',
    ])
  })

  it.each([
    ['log_2(x) + log_2(x - 2) = 3', ['4'], ['-2'], 'x(x - 2) = 8'],
    ['ln(x) + ln(x + 2) = ln(8)', ['2'], ['-4'], 'x(x + 2) = 8'],
    ['2log(x) = log(x + 6)', ['3'], ['-2'], 'x^2 = x + 6'],
    ['log(x + 9) - log(x) = 1', ['1'], [], 'x + 9 = 10x'],
    ['log_3(x^2 - 8x) = 2', ['-1', '9'], [], 'x^2 - 8x = 9'],
    ['log(x + 5) = log(3)', ['-2'], [], 'x + 5 = 3'],
    ['log_2(x + 1) = 3', ['7'], [], 'x + 1 = 8'],
  ])('%s', (eq, sols, extr, alg) => {
    const a = analyzeLogEquation(eq)!
    expect(a.solutions.map((s) => s.text)).toEqual(sols)
    expect(a.extraneous.map((e) => e.text)).toEqual(extr)
    expect(a.algebraic).toBe(alg)
    expect(a.solutions.every((s) => s.exact)).toBe(true)
  })

  it.each([
    ['2^x = 7', 'log(7)/log(2)'],
    ['3e^(2x) + 1 = 13', 'ln(4)/2'],
    ['5^(x - 1) = 12', 'log(12)/log(5) + 1'],
    ['2^(x + 1) = 3^x', 'ln(2)/(ln(3) - ln(2))'],
    ['5^(2x) = 3^(x - 1)', 'ln(3)/(ln(3) - 2ln(5))'],
    ['4^x = 8^(x - 1)', '3'],
    ['e^(2x) = 3e^x', 'ln(3)'],
    ['1000(1.05)^x = 2000', 'log(2)/log(1.05)'],
  ])('%s has the closed form %s', (eq, text) => {
    const a = analyzeLogEquation(eq)!
    expect(a.kind).toBe('exponential')
    expect(a.solutions.length).toBe(1)
    expect(a.solutions[0]!.text).toBe(text)
    expect(a.solutions[0]!.exact).toBe(true)
  })

  it('a quadratic in eˣ: u = eˣ, and a root u ≤ 0 gives nothing', () => {
    const a = analyzeLogEquation('e^(2x) - 5e^x + 6 = 0')!
    expect(a.solutions.map((s) => s.text)).toEqual(['ln(2)', 'ln(3)'])
    const b = analyzeLogEquation('e^(2x) - e^x - 2 = 0')!
    expect(b.solutions.map((s) => s.text)).toEqual(['ln(2)'])
    expect(b.explanation).toContain('e^x = −1 has no solution: a power of e is never 0 or negative.')
  })

  it('no solution', () => {
    const a = analyzeLogEquation('3^x = -2')!
    expect(a.solutions).toEqual([])
    expect(a.explanation[0]).toMatch(/no solution/)
  })

  it('a half-life equation (root near 10⁴)', () => {
    const a = analyzeLogEquation('0.5^(x/5730) = 0.3')!
    expect(a.solutions[0]!.value).toBeCloseTo((5730 * Math.log(0.3)) / Math.log(0.5), 6)
    expect(a.solutions[0]!.text).toBe('5730log(0.3)/log(0.5)')
  })
})

describe('parseSolutionAnswer', () => {
  it.each([
    ['x = 5 or x = -2', [5, -2]],
    ['x = 5, x = -2', [5, -2]],
    ['x = 5 and x = -2', [5, -2]],
    ['5, -2', [5, -2]],
    ['{5}', [5]],
    ['x = log(8, 2)', [3]],
    ['x = ln(7)/ln(2)', [Math.log(7) / Math.log(2)]],
  ])('%s', (text, values) => {
    const p = parseSolutionAnswer(text)
    expect(p.ok).toBe(true)
    if (p.ok) values.forEach((v, i) => expect(p.values[i]!.value).toBeCloseTo(v, 12))
  })

  it('no solution, and errors', () => {
    expect(parseSolutionAnswer('no solution')).toEqual({ ok: true, values: [], none: true })
    expect(parseSolutionAnswer('∅')).toMatchObject({ ok: true, none: true })
    expect(parseSolutionAnswer('x = y').ok).toBe(false)
    expect(parseSolutionAnswer('').ok).toBe(false)
    expect(parseSolutionAnswer('x > 5').ok).toBe(false)
  })
})

describe('gradeLogEquation', () => {
  it.each([
    ['log(x) + log(x - 3) = 1', 'x = 5'],
    ['log_2(x) + log_2(x - 2) = 3', '4'],
    ['log_3(x^2 - 8x) = 2', 'x = -1 or x = 9'],
    ['log(x + 5) = log(3)', 'x = -2'],
    ['2^x = 7', 'x = log(7)/log(2)'],
    ['2^x = 7', 'x = ln(7)/ln(2)'],
    ['2^x = 7', 'x = log_2(7)'],
    ['3^x = 20', 'x = ln(20)/ln(3)'],
    ['2^(x + 1) = 3^x', 'x = ln(2)/(ln(3) - ln(2))'],
    ['3^x = -2', 'no solution'],
    ['e^(2x) - 5e^x + 6 = 0', 'x = ln(2) or x = ln(3)'],
  ])('%s: %s is correct', (eq, answer) => {
    const g = gradeLogEquation(eq, answer)
    expect(g.verdict, JSON.stringify(g)).toBe('correct')
  })

  it.each([
    ['log(x) + log(x - 3) = 1', 'x = 5 or x = -2', 'log_extraneous_kept'],
    ['log_2(x) + log_2(x - 2) = 3', 'x = 4, x = -2', 'log_extraneous_kept'],
    ['log(x) + log(x - 3) = 1', 'x = 13/2', 'log_sum_split'],
    ['log_3(x^2 - 8x) = 2', 'x = 9', 'log_valid_rejected'],
    ['log(x + 5) = log(3)', 'no solution', 'log_valid_rejected'],
    ['2^x = 7', 'x = log(2)/log(7)', 'log_change_base_inverted'],
    ['2^x = 7', 'x = log_7(2)', 'log_convert_swapped'],
    ['3^x = 20', 'x = 20/3', 'log_convert_multiplied'],
    ['2 * 3^x = 18', 'x = log(18)/log(6)', 'log_exp_coefficient_base'],
    ['log_2(x) = 5', 'x = 25', 'log_convert_swapped'],
    ['log(x) = 2', 'x = 2', 'log_convert_dropped'],
  ] as [string, string, LogMistakeId][])('%s: %s is %s', (eq, answer, id) => {
    const g = gradeLogEquation(eq, answer)
    expect(mistakeOf(g), JSON.stringify(g)).toBe(id)
  })

  it('witnesses say why, with her numbers', () => {
    const g = gradeLogEquation('log(x) + log(x - 3) = 1', 'x = 5 or x = -2')
    expect(g.verdict === 'mistake' && g.witness).toBe('x = −2 makes log(x) undefined: its input is −2, and a log needs a positive input. Check every answer in the ORIGINAL equation: x = −2 is extraneous.')
    const h = gradeLogEquation('log_3(x^2 - 8x) = 2', 'x = 9')
    expect(h.verdict === 'mistake' && h.witness).toBe('x = −1 keeps every log input positive (x^2 − 8x is 9), so it is a real solution. Only an answer that makes a log’s input 0 or negative is extraneous.')
  })

  it('exact unless a decimal is asked for', () => {
    expect(gradeLogEquation('2^x = 7', 'x = 2.807')).toMatchObject({ verdict: 'invalid', reason: 'not_exact' })
    expect(gradeLogEquation('2^x = 7', 'x = 2.807', { decimal: { places: 3 } }).verdict).toBe('correct')
    expect(gradeLogEquation('3^x = 20', 'x = 2.73', { decimal: { places: 3 } })).toMatchObject({ verdict: 'invalid', reason: 'not_rounded' })
    expect(gradeLogEquation('3^x = 20', 'x = log(20)/log(3)', { decimal: { places: 3 } })).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    // A decimal that IS the exact answer is exact.
    expect(gradeLogEquation('log(x + 9) - log(x) = 1', 'x = 1.0').verdict).toBe('correct')
  })

  it('plain wrong answers say what is off without giving the answer', () => {
    const g = gradeLogEquation('log_2(x) + log_2(x - 2) = 3', 'x = 7')
    expect(g.verdict).toBe('wrong')
    expect(g.verdict === 'wrong' && g.message).toBe('x = 7 does not solve log(x,2)+log(x−2,2) = 3: the left side is 5.129 there and the right side is 3.')
    const h = gradeLogEquation('log_3(x^2 - 8x) = 2', 'x = 9 or x = 4')
    expect(h.verdict).toBe('wrong')
    const m = gradeLogEquation('2^x = 7', 'no solution')
    expect(m.verdict === 'wrong' && m.message).toBe('This equation has a solution: check your algebra, then check each candidate in the original.')
  })

  it('unreadable answers are not attempts; non-equations are unsupported', () => {
    expect(gradeLogEquation('2^x = 7', 'x = ').verdict).toBe('invalid')
    expect(gradeLogEquation('2^x + y = 7', 'x = 1').verdict).toBe('unsupported')
  })
})

describe('logEquationMistakes', () => {
  it('lists what each slip makes the answer, without the right answer or a legal line', () => {
    const c = logEquationMistakes('log(x) + log(x - 3) = 1')
    expect(c[0]).toMatchObject({ id: 'log_extraneous_kept', text: 'x = -2 or x = 5' })
    expect(c.map((m) => m.id)).toContain('log_sum_split')
    expect(c.every((m) => m.text !== 'x = 5')).toBe(true)
    // log_b A = 1 → A = b·1 is the right line here (b·1 = b¹), so it is not listed as a slip.
    expect(c.some((m) => m.id === 'log_convert_multiplied' && m.text === 'x = -2 or x = 5')).toBe(false)
  })
})
