import { describe, expect, it } from 'vitest'
import { gradeLogValue, logValue, logValueMistakes } from './value'
import type { LogGrade, LogMistakeId } from './types'

function mistakeOf(g: LogGrade): LogMistakeId | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

describe('logValue', () => {
  it('exact rational values, and irrational ones flagged', () => {
    expect(logValue('log_2(8)')).toMatchObject({ value: 3, exactText: '3', rational: true })
    expect(logValue('log_4(8)')).toMatchObject({ value: 1.5, exactText: '3/2', rational: true })
    const v = logValue('log_2(7)')!
    expect(v.rational).toBe(false)
    expect(v.exactText).toBeNull()
    expect(v.value).toBeCloseTo(2.807354922057604, 14)
    expect(logValue('log(-3)')).toBeNull()
    expect(logValue('x + 1')).toBeNull()
  })
})

describe('exact value problems', () => {
  it.each([
    ['log_2(8)', '3'],
    ['log(0.001)', '-3'],
    ['ln(e^5)', '5'],
    ['e^(ln(7))', '7'],
    ['log_4(8)', '3/2'],
    ['log_4(8)', '1.5'],
    ['log_4(8)', '6/4'],
    ['log_(1/2)(8)', '-3'],
    ['log_6(4) + log_6(9)', '2'],
    ['log_2(3) * log_3(8)', '3'],
    ['10^(log(7))', '7'],
    ['log(5) + log(20)', '2'],
  ])('%s = %s is correct', (problem, answer) => {
    const g = gradeLogValue(problem, answer)
    expect(g.verdict, JSON.stringify(g)).toBe('correct')
  })

  it.each([
    ['log_2(8)', '4', 'log_value_divided'],
    ['log_3(81)', '27', 'log_value_divided'],
    ['log(0.001)', '3', 'log_value_sign'],
    ['log_2(1/8)', '3', 'log_value_sign'],
    ['log_4(8)', '2/3', 'log_change_base_inverted'],
    ['log_9(3)', '2', 'log_change_base_inverted'],
    ['log_5(1)', '1', 'log_identity_misused'],
    ['log_5(5)', '0', 'log_identity_misused'],
    ['ln(e)', '0', 'log_identity_misused'],
    ['log(5) + log(20)', 'log(25)', 'log_sum_split'],
    ['2^(-3)', '-8', 'log_exp_negative_exponent'],
  ] as [string, string, LogMistakeId][])('%s answered %s is %s', (problem, answer, id) => {
    const g = gradeLogValue(problem, answer)
    expect(mistakeOf(g), JSON.stringify(g)).toBe(id)
    if (g.verdict === 'mistake') {
      expect(g.pattern.id).toBe(id)
      expect(g.pattern.witness).toBe(g.witness)
    }
  })

  it('witnesses use her numbers', () => {
    const g = gradeLogValue('log(0.001)', '3')
    expect(g.verdict === 'mistake' && g.witness).toBe('0.001 is between 0 and 1, so it takes a negative power of the base: log(0.001) = −3.')
    const h = gradeLogValue('log_2(8)', '4')
    expect(h.verdict === 'mistake' && h.witness).toBe('log₂(8) asks: 2 to what power gives 8? That power is 3. Dividing 8 by 2 answers a different question.')
  })

  it('a calculator decimal is not the exact answer (and the message does not give it away)', () => {
    const g = gradeLogValue('log_2(8)', '2.999')
    expect(g.verdict).toBe('wrong')
    const h = gradeLogValue('log_2(7)', '2.807')
    expect(h.verdict).toBe('invalid')
    expect(h.verdict === 'invalid' && h.reason).toBe('not_exact')
    expect(h.verdict === 'invalid' && h.message).not.toMatch(/log\(7\)|2\.8073/)
  })

  it('a plain wrong answer is wrong, with no answer given', () => {
    const g = gradeLogValue('ln(e^5)', '5e')
    expect(g.verdict).toBe('wrong')
    expect(g.verdict === 'wrong' && g.message).not.toMatch(/= 5\b/)
  })

  it('unreadable answers are not attempts; problems outside the model are unsupported', () => {
    expect(gradeLogValue('log_2(8)', '').verdict).toBe('invalid')
    expect(gradeLogValue('log_2(8)', 'x')).toMatchObject({ verdict: 'invalid', reason: 'unreadable', position: 0 })
    expect(gradeLogValue('log(-2)', '1').verdict).toBe('unsupported')
  })

  it('the worked solution for the reveal', () => {
    const g = gradeLogValue('log_4(8)', '3/2')
    expect(g.verdict === 'correct' && g.explanation).toEqual(['log₄(8) asks: 4 to what power gives 8?', '4^(3/2) = 8, so log₄(8) = 3/2.'])
    const h = gradeLogValue('ln(e^5)', '5')
    expect(h.verdict === 'correct' && h.explanation).toEqual(['A log undoes a power of its own base: ln(e^5) = 5.'])
  })
})

describe('decimal problems ("to three decimal places")', () => {
  const D = { decimal: { places: 3 } } as const

  it('within half a unit in the last place is right', () => {
    expect(gradeLogValue('log_2(7)', '2.807', D).verdict).toBe('correct')
    expect(gradeLogValue('log_2(7)', '2.8074', D).verdict).toBe('correct')
    expect(gradeLogValue('log(7)', '0.845', D).verdict).toBe('correct')
    expect(gradeLogValue('log_2(7)', '2.809', D).verdict).toBe('wrong')
  })

  it.each([
    ['log_2(7)', '0.356', 'log_change_base_inverted'],
    ['log_2(7)', '0.544', 'log_quotient_as_quotient'],
    ['log_2(7)', '3.5', 'log_value_divided'],
    ['log(7)', '1.946', 'log_ln_confused'],
    ['ln(7)', '0.845', 'log_ln_confused'],
  ] as [string, string, LogMistakeId][])('%s ≈ %s is %s', (problem, answer, id) => {
    expect(mistakeOf(gradeLogValue(problem, answer, D))).toBe(id)
  })

  it('too few places, and an exact answer where a decimal is asked, are not attempts', () => {
    expect(gradeLogValue('log_2(7)', '2.81', D)).toMatchObject({ verdict: 'invalid', reason: 'not_rounded' })
    expect(gradeLogValue('log_2(7)', 'log(7)/log(2)', D)).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
  })

  it('an explicit tolerance', () => {
    expect(gradeLogValue('log_2(7)', '2.8', { decimal: { tolerance: 0.01 } }).verdict).toBe('correct')
    expect(gradeLogValue('log_2(7)', '2.8', { decimal: { tolerance: 0.001 } }).verdict).not.toBe('correct')
  })
})

describe('logValueMistakes lists what each slip gives, never the answer', () => {
  it('log₂ 8', () => {
    const c = logValueMistakes('log_2(8)')
    expect(c.map((m) => [m.id, m.text])).toEqual([
      ['log_value_divided', '4'],
      ['log_value_sign', '-3'],
      ['log_change_base_inverted', '1/3'],
      // The calculator route: log(8)/log(2) typed as log(8/2).
      ['log_quotient_as_quotient', '0.602059991328'],
    ])
    expect(c.every((m) => m.values![0] !== 3)).toBe(true)
  })

  it('a slip that gives the right answer for this problem is left out: log₂ 4 = 2 and 4/2 = 2', () => {
    expect(logValueMistakes('log_2(4)').map((m) => m.id)).not.toContain('log_value_divided')
  })

  it('decimal problems add the calculator slips', () => {
    const ids = logValueMistakes('log(7)', { decimal: { places: 3 } }).map((m) => m.id)
    expect(ids).toContain('log_ln_confused')
  })
})
