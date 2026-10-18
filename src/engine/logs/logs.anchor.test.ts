/**
 * Hand-worked textbook examples (the style of Larson's and Sullivan's Precalculus exponential and log
 * chapters). Every value below was worked out by hand, not by the code under test; each worked solution
 * is pushed through the line checker one line at a time with the problem's first line as the original,
 * and the final answer through the grader.
 */
import { describe, expect, it } from 'vitest'
import { checkLogRewrite } from './rewrite'
import { analyzeLogEquation, gradeLogEquation } from './solve'
import { checkLogStep } from './step'
import { convertForm, gradeConvertForm } from './convert'
import { gradeLogValue } from './value'
import type { DecimalSpec, LogStepContext } from './types'

interface Worked {
  name: string
  lines: string[]
  /** Hand-computed solutions. */
  solutions: number[]
  /** Hand-computed extraneous candidates the method lets in. */
  extraneous?: number[]
  /** Exact final answer as she would write it. */
  answer: string
  decimal?: DecimalSpec
  /** A wrong final answer and the slip that produces it. */
  slip?: [string, string]
}

const WORKED: Worked[] = [
  {
    name: '1. 2^x = 32 (one-to-one)',
    lines: ['2^x = 32', '2^x = 2^5', 'x = 5'],
    solutions: [5],
    answer: 'x = 5',
    slip: ['x = 16', 'log_convert_multiplied'],
  },
  {
    name: '2. 4^(x − 3) = 32 (common base 2)',
    lines: ['4^(x - 3) = 32', '2^(2(x - 3)) = 2^5', '2x - 6 = 5', '2x = 11', 'x = 11/2'],
    solutions: [5.5],
    answer: 'x = 11/2',
  },
  {
    name: '3. e^x = 7',
    lines: ['e^x = 7', 'ln(e^x) = ln(7)', 'x = ln(7)'],
    solutions: [Math.log(7)],
    answer: 'x = ln(7)',
    slip: ['x = log(7)', 'log_ln_confused'],
  },
  {
    name: '4. 2(3^(2x − 5)) − 4 = 11 (Larson)',
    lines: ['2(3^(2x - 5)) - 4 = 11', '2(3^(2x - 5)) = 15', '3^(2x - 5) = 15/2', 'log_3(3^(2x - 5)) = log_3(15/2)', '2x - 5 = log_3(7.5)', '2x = 5 + log_3(7.5)', 'x = (5 + log_3(7.5))/2'],
    solutions: [(5 + Math.log(7.5) / Math.log(3)) / 2],
    answer: 'x = (5 + log_3(7.5))/2',
  },
  {
    name: '5. 3^(2x) = 5 (logs of both sides)',
    lines: ['3^(2x) = 5', 'log(3^(2x)) = log(5)', '2x log(3) = log(5)', 'x = log(5)/(2log(3))'],
    solutions: [Math.log(5) / (2 * Math.log(3))],
    answer: 'x = log(5)/(2log(3))',
    slip: ['x = log(5/3)/2', 'log_quotient_as_quotient'],
  },
  {
    name: '6. e^(2x) − 3e^x + 2 = 0 (quadratic in e^x)',
    lines: ['e^(2x) - 3e^x + 2 = 0', '(e^x - 1)(e^x - 2) = 0', 'e^x = 1 or e^x = 2', 'x = 0 or x = ln(2)'],
    solutions: [0, Math.log(2)],
    answer: 'x = 0 or x = ln(2)',
  },
  {
    name: '7. ln x = 2',
    lines: ['ln(x) = 2', 'x = e^2'],
    solutions: [Math.E ** 2],
    answer: 'x = e^2',
    slip: ['x = 100', 'log_ln_confused'],
  },
  {
    name: '8. 5 + 2 ln x = 4',
    lines: ['5 + 2ln(x) = 4', '2ln(x) = -1', 'ln(x) = -1/2', 'x = e^(-1/2)'],
    solutions: [Math.E ** -0.5],
    answer: 'x = e^(-1/2)',
  },
  {
    name: '9. log₃(5x − 1) = log₃(x + 7) (one-to-one)',
    lines: ['log_3(5x - 1) = log_3(x + 7)', '5x - 1 = x + 7', '4x = 8', 'x = 2'],
    solutions: [2],
    answer: 'x = 2',
  },
  {
    name: '10. log₂ x + log₂(x − 7) = 3 (extraneous −1)',
    lines: ['log_2(x) + log_2(x - 7) = 3', 'log_2(x(x - 7)) = 3', 'x(x - 7) = 8', 'x^2 - 7x - 8 = 0', '(x - 8)(x + 1) = 0', 'x = 8 or x = -1', 'x = 8'],
    solutions: [8],
    extraneous: [-1],
    answer: 'x = 8',
    slip: ['x = 8 or x = -1', 'log_extraneous_kept'],
  },
  {
    name: '11. ln(x − 2) + ln(2x − 3) = 2 ln x (Larson; extraneous 1)',
    lines: ['ln(x - 2) + ln(2x - 3) = 2ln(x)', 'ln((x - 2)(2x - 3)) = ln(x^2)', '(x - 2)(2x - 3) = x^2', '2x^2 - 7x + 6 = x^2', 'x^2 - 7x + 6 = 0', '(x - 1)(x - 6) = 0', 'x = 1 or x = 6', 'x = 6'],
    solutions: [6],
    extraneous: [1],
    answer: 'x = 6',
    slip: ['x = 1 or x = 6', 'log_extraneous_kept'],
  },
  {
    name: '12. log₆(3x + 14) − log₆ 5 = log₆ 2x (Larson)',
    lines: ['log_6(3x + 14) - log_6(5) = log_6(2x)', 'log_6((3x + 14)/5) = log_6(2x)', '(3x + 14)/5 = 2x', '3x + 14 = 10x', '14 = 7x', 'x = 2'],
    solutions: [2],
    answer: 'x = 2',
  },
  {
    name: '13. log x + log(x − 3) = 1 (extraneous −2)',
    lines: ['log(x) + log(x - 3) = 1', 'log(x(x - 3)) = 1', 'x(x - 3) = 10', 'x^2 - 3x - 10 = 0', '(x - 5)(x + 2) = 0', 'x = 5 or x = -2', 'x = 5'],
    solutions: [5],
    extraneous: [-2],
    answer: 'x = 5',
    slip: ['x = 13/2', 'log_sum_split'],
  },
  {
    name: '14. 2 log x = log(x + 6) (extraneous −2)',
    lines: ['2log(x) = log(x + 6)', 'log(x^2) = log(x + 6)', 'x^2 = x + 6', 'x^2 - x - 6 = 0', '(x - 3)(x + 2) = 0', 'x = 3 or x = -2', 'x = 3'],
    solutions: [3],
    extraneous: [-2],
    answer: 'x = 3',
  },
  {
    name: '15. log₃(x² − 8x) = 2 (both answers valid, one negative)',
    lines: ['log_3(x^2 - 8x) = 2', 'x^2 - 8x = 9', 'x^2 - 8x - 9 = 0', '(x - 9)(x + 1) = 0', 'x = 9 or x = -1'],
    solutions: [-1, 9],
    answer: 'x = -1 or x = 9',
    slip: ['x = 9', 'log_valid_rejected'],
  },
  {
    name: '16. Compound interest: 1000(1 + 0.05/12)^(12x) = 2000, to three decimal places',
    lines: ['1000(1 + 0.05/12)^(12x) = 2000', '(1 + 0.05/12)^(12x) = 2', '12x ln(1 + 0.05/12) = ln(2)', 'x = ln(2)/(12ln(1 + 0.05/12))', 'x = 13.892'],
    solutions: [Math.log(2) / (12 * Math.log(1 + 0.05 / 12))],
    answer: 'x = 13.892',
    decimal: { places: 3 },
  },
  {
    name: '17. Carbon-14: 0.5^(x/5730) = 0.3, to the nearest year',
    lines: ['0.5^(x/5730) = 0.3', '(x/5730)log(0.5) = log(0.3)', 'x = 5730log(0.3)/log(0.5)', 'x = 9953'],
    solutions: [(5730 * Math.log(0.3)) / Math.log(0.5)],
    answer: 'x = 9953',
    decimal: { places: 0 },
    // 5730·log(0.5)/log(0.3) = 3298.9: the base and the number swapped (the inverted change of base gives the same number).
    slip: ['x = 3299', 'log_convert_swapped'],
  },
]

describe('hand-worked equations, line by line and the final answer', () => {
  for (const w of WORKED) {
    it(w.name, () => {
      const ctx: LogStepContext = { original: w.lines[0]!, decimal: w.decimal, seed: 23 }
      for (let i = 1; i < w.lines.length; i++) {
        const r = checkLogStep(w.lines[i - 1]!, w.lines[i]!, ctx)
        expect(r.ok, `${w.lines[i - 1]} → ${w.lines[i]}: ${JSON.stringify({ v: r.verdict, p: r.pattern?.id, ce: r.counterexample?.message, m: r.message })}`).toBe(true)
      }
      const a = analyzeLogEquation(w.lines[0]!)!
      expect(a.solutions.length).toBe(w.solutions.length)
      a.solutions.forEach((s, i) => expect(Math.abs(s.value - w.solutions[i]!)).toBeLessThan(1e-9 * Math.max(1, Math.abs(w.solutions[i]!))))
      expect(a.extraneous.map((e) => e.value)).toEqual(w.extraneous ?? [])
      const g = gradeLogEquation(w.lines[0]!, w.answer, { decimal: w.decimal })
      expect(g.verdict, JSON.stringify(g)).toBe('correct')
      if (w.slip) {
        const s = gradeLogEquation(w.lines[0]!, w.slip[0], { decimal: w.decimal })
        expect(s.verdict === 'mistake' && s.mistake, JSON.stringify(s)).toBe(w.slip[1])
      }
    })
  }

  it('the extraneous candidates are announced at the step that lets them in', () => {
    const r = checkLogStep('log_2(x) + log_2(x - 7) = 3', 'log_2(x(x - 7)) = 3', { original: 'log_2(x) + log_2(x - 7) = 3' })
    expect(r.caveat).toBe('extraneous_check')
    expect(r.extraneous?.map((e) => e.value)).toEqual([-1])
    const s = checkLogStep('ln(x - 2) + ln(2x - 3) = 2ln(x)', 'ln((x - 2)(2x - 3)) = ln(x^2)', { original: 'ln(x - 2) + ln(2x - 3) = 2ln(x)' })
    expect(s.caveat).toBe('extraneous_check')
    expect(s.extraneous?.map((e) => e.value)).toEqual([1])
  })
})

describe('hand-worked values', () => {
  it.each([
    ['log_2(32)', '5'],
    ['log_3(1/81)', '-4'],
    ['log(0.0001)', '-4'],
    ['ln(1/e^2)', '-2'],
    ['2^(log_2(9))', '9'],
    ['log_8(2)', '1/3'],
    ['log_27(9)', '2/3'],
    ['log_(1/3)(9)', '-2'],
    ['log_5(sqrt(125))', '3/2'],
    ['ln(e^(-0.5))', '-0.5'],
  ])('%s = %s', (problem, answer) => {
    expect(gradeLogValue(problem, answer).verdict).toBe('correct')
  })

  it('log₃ 10 ≈ 2.096 (change of base, three places)', () => {
    // ln 10 / ln 3 = 2.302585 / 1.098612 = 2.0959
    expect(gradeLogValue('log_3(10)', '2.096', { decimal: { places: 3 } }).verdict).toBe('correct')
    const inv = gradeLogValue('log_3(10)', '0.477', { decimal: { places: 3 } })
    expect(inv.verdict === 'mistake' && inv.mistake).toBe('log_change_base_inverted')
  })
})

describe('hand-worked conversions', () => {
  it.each([
    ['3^4 = 81', 'log_3(81) = 4'],
    ['log_5(125) = 3', '5^3 = 125'],
    ['ln(1/e) = -1', 'e^(-1) = 1/e'],
    ['10^(-3) = 0.001', 'log(0.001) = -3'],
    ['e^(0.5) = sqrt(e)', 'ln(sqrt(e)) = 0.5'],
    ['2^(-1) = 1/2', 'log_2(1/2) = -1'],
  ])('%s → %s', (given, answer) => {
    expect(convertForm(given)).not.toBeNull()
    expect(gradeConvertForm(given, answer).verdict).toBe('correct')
  })
})

describe('hand-worked expansions and condensations (variables positive)', () => {
  it.each([
    ['log_4(5x^3 y)', 'log_4(5) + 3log_4(x) + log_4(y)'],
    ['ln(sqrt(3x - 5)/7)', '(1/2)ln(3x - 5) - ln(7)'],
    ['log((x^2 + 1)/(x y^4))', 'log(x^2 + 1) - log(x) - 4log(y)'],
    ['2ln(3) - ln(x + 1)', 'ln(9/(x + 1))'],
    ['log(x) - 2log(x + 1)', 'log(x/(x + 1)^2)'],
    ['3log_2(x) + log_2(y) - 2log_2(n)', 'log_2(x^3 y/n^2)'],
  ])('%s → %s', (prev, next) => {
    const r = checkLogRewrite(prev, next, { vars: ['x', 'y', 'n'], assumePositive: true })
    expect(r.ok, JSON.stringify(r)).toBe(true)
  })

  it('and the textbook slip on the same problems is named', () => {
    expect(checkLogRewrite('log_4(5x^3 y)', 'log_4(5) + (log_4(x))^3 + log_4(y)', { vars: ['x', 'y'], assumePositive: true }).pattern?.id).toBe('log_power_as_power')
    expect(checkLogRewrite('2ln(3) - ln(x + 1)', 'ln(6/(x + 1))', { vars: ['x'], assumePositive: true }).pattern?.id).toBe('log_coefficient_inside')
  })
})

describe('two slips that give the same answer', () => {
  it('carbon-14 answered 3299: the swapped base, with the inverted change of base as its shadow', async () => {
    const { logEquationMistakes } = await import('./solve')
    const c = logEquationMistakes('0.5^(x/5730) = 0.3').find((m) => m.id === 'log_convert_swapped' && Math.abs(m.values![0]! - 3298.856) < 0.01)
    expect(c).toBeTruthy()
    expect(c!.shadows).toContain('log_change_base_inverted')
  })

  it('written as a quotient of logs, the same answer is named the inverted change of base', () => {
    const g = gradeLogEquation('0.5^(x/5730) = 0.3', 'x = 5730log(0.5)/log(0.3)')
    expect(g.verdict === 'mistake' && g.mistake).toBe('log_change_base_inverted')
  })
})
