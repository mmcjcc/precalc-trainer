import { describe, expect, it } from 'vitest'
import type { VarName } from '@/shared/types'
import { checkLogStep, decimalPlaces, decimalTolerance } from './step'
import type { LogMistakeId, LogStepContext } from './types'

function step(prev: string, next: string, ctx: LogStepContext = {}) {
  return checkLogStep(prev, next, { seed: 11, ...ctx })
}

describe('a log equation, line by line, with the extraneous check', () => {
  const O = 'log(x) + log(x - 3) = 1'
  const ctx = { original: O }

  it('combining the logs is legal, and the caveat names the answer that will not work', () => {
    const r = step(O, 'log(x(x - 3)) = 1', ctx)
    expect(r.ok).toBe(true)
    expect(r.verdict).toBe('extraneous_superset')
    expect(r.caveat).toBe('extraneous_check')
    expect(r.pattern?.id).toBe('log_check_answers')
    expect(r.extraneous?.map((e) => e.value)).toEqual([-2])
    expect(r.extraneous?.[0]?.sentence).toBe('x = −2 makes log(x) undefined: its input is −2, and a log needs a positive input.')
    expect(r.logMove?.properties).toEqual(['product_rule'])
  })

  it('then exponential form, algebra, and the zero-product step are legal', () => {
    const a = step('log(x(x - 3)) = 1', 'x(x - 3) = 10', ctx)
    expect(a.ok).toBe(true)
    expect(a.logMove?.properties).toEqual(['convert_form'])
    expect(step('x(x - 3) = 10', 'x^2 - 3x - 10 = 0', ctx).ok).toBe(true)
    expect(step('x^2 - 3x - 10 = 0', '(x - 5)(x + 2) = 0', ctx).ok).toBe(true)
    expect(step('(x - 5)(x + 2) = 0', 'x = 5 or x = -2', ctx).ok).toBe(true)
  })

  it('rejecting the extraneous candidate is legal and says why', () => {
    const r = step('x = 5 or x = -2', 'x = 5', ctx)
    expect(r.ok).toBe(true)
    expect(r.rejected?.map((e) => e.value)).toEqual([-2])
    expect(r.logMove?.detail).toBe('rejected x = −2: x = −2 makes log(x) undefined: its input is −2, and a log needs a positive input.')
  })

  it('dropping the REAL answer is log_valid_rejected', () => {
    const r = step('x = 5 or x = -2', 'x = -2', ctx)
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('log_valid_rejected')
    expect(r.pattern?.witness).toBe('x = 5 keeps every log in the original defined (x is 5, x − 3 is 2), and it solves the original, so it stays. Only an answer that makes a log’s input 0 or negative is extraneous.')
  })

  it('without the original, dropping a candidate of a log-free line is a plain lost solution (no log name)', () => {
    const r = step('x = 5 or x = -2', 'x = 5')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('lost_subset')
    expect(r.pattern?.id).not.toBe('log_valid_rejected')
  })

  it('a negative candidate that keeps every log input positive stays', () => {
    const o = 'log(x + 5) + log(x + 3) = log(3)'
    expect(step(o, 'log((x + 5)(x + 3)) = log(3)', { original: o }).ok).toBe(true)
    const keep = step('x = -2 or x = -6', 'x = -2', { original: o })
    expect(keep.ok).toBe(true)
    expect(keep.rejected?.map((e) => e.value)).toEqual([-6])
    expect(step('x = -2 or x = -6', 'x = -6', { original: o }).pattern?.id).toBe('log_valid_rejected')
  })
})

describe('named slips of a step', () => {
  it.each([
    ['log(x(x - 3)) = 1', 'x(x - 3) = 1', 'log_convert_dropped'],
    ['log_2(x) = 5', 'x = 25', 'log_convert_swapped'],
    ['log_2(x) = 5', 'x = 10', 'log_convert_multiplied'],
    ['log(x) = 2', 'x = 2', 'log_convert_dropped'],
    ['log(x) = 2', 'x = e^2', 'log_ln_confused'],
    ['ln(x) = 2', 'x = 10^2', 'log_ln_confused'],
    ['2^x = 8', 'x = 4', 'log_convert_multiplied'],
    ['2^x = 7', 'x = log_7(2)', 'log_convert_swapped'],
    ['log(x) + log(x - 3) = 1', 'log(2x - 3) = 1', 'log_sum_split'],
    ['log(x) + log(x - 3) = 1', 'x + x - 3 = 10', 'log_sum_split'],
    ['2^x = 7', 'x log(2) = 7', 'log_one_side'],
    ['2^x + 3 = 7', 'log(2^x) + log(3) = log(7)', 'log_sum_split'],
    ['2^x + 3 = 7', 'x log(2) + log(3) = log(7)', 'log_sum_split'],
    ['3^(2x) = 5', '(log(3))^(2x) = log(5)', 'log_power_as_power'],
    ['2 * 3^x = 18', '6^x = 18', 'log_exp_coefficient_base'],
    ['x log(2) = log(7)', 'x = log(2)/log(7)', 'log_change_base_inverted'],
    ['x log(2) = log(7)', 'x = log(7/2)', 'log_quotient_as_quotient'],
    ['x log(2) = log(7)', 'x = log(7) - log(2)', 'log_quotient_as_quotient'],
    ['ln(x^2) = 4', '2ln(x) = 4', 'log_power_abs'],
    ['0.5^(x/5730) = 0.3', 'x = 5730log(0.5)/log(0.3)', 'log_change_base_inverted'],
    ['e^(x + 1) = 5', 'e^x + e = 5', 'log_exp_sum_split'],
  ] as [string, string, LogMistakeId][])('%s → %s is %s', (prev, next, id) => {
    const r = step(prev, next)
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe(id)
    expect(r.pattern?.witness).toBeTruthy()
    expect(r.counterexample).toBeTruthy()
  })

  it('witnesses use her numbers', () => {
    expect(step('log_2(x) = 5', 'x = 25').pattern?.witness).toBe('log₂(x) = 5 means x = 2^5: the base 2 raised to the power 5. Your line x = 5^2 has the base and the exponent the other way round.')
    expect(step('x log(2) = log(7)', 'x = log(2)/log(7)').pattern?.witness).toBe('x · log(2) = log(7) means x = log(7)/log(2): divide both sides by log(2). Your line x = log(2)/log(7) is upside down: the number you divide BY goes on the bottom.')
  })

  it('a wrong line that is no log slip still gets the engine’s algebra names', () => {
    const r = step('2^x + 3 = 7', '2^x = 7 + 3')
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('term_across_sign')
  })
})

describe('legal exponential steps', () => {
  it.each([
    ['2^x = 7', 'x log(2) = log(7)', 'take_log'],
    ['2^x = 7', 'log(2^x) = log(7)', 'take_log'],
    ['2^x = 7', 'ln(2^x) = ln(7)', 'take_log'],
    ['2^x = 7', 'x = log_2(7)', 'convert_form'],
    ['x log(2) = log(7)', 'x = log(7)/log(2)', 'both_sides'],
    ['3e^(2x) + 1 = 13', '3e^(2x) = 12', 'both_sides'],
    ['e^(2x) = 4', '2x = ln(4)', 'take_log'],
    ['2^(3x - 1) = 2^(x + 5)', '3x - 1 = x + 5', 'one_to_one'],
    ['log_3(2x + 1) = log_3(x + 4)', '2x + 1 = x + 4', 'one_to_one'],
    ['0.5^(x/5730) = 0.3', 'x = 5730log(0.3)/log(0.5)', null],
  ] as [string, string, string | null][])('%s → %s', (prev, next, prop) => {
    const r = step(prev, next)
    expect(r.ok, JSON.stringify(r)).toBe(true)
    if (prop) expect(r.logMove?.properties).toContain(prop)
  })

  it('dividing by a log is described with the log, not its decimal', () => {
    expect(step('x log(2) = log(7)', 'x = log(7)/log(2)').logMove?.detail).toBe('divided both sides by log(2)')
  })

  it('a step that would only be checked on [−60, 60] before: 1.01^x = 2 → x = 70 is wrong (x ≈ 69.66)', () => {
    expect(step('1.01^x = 2', 'x = log(2)/log(1.01)').ok).toBe(true)
    expect(step('1.01^x = 2', 'x = 70').ok).toBe(false)
  })
})

describe('decimals: rounded when the problem asks, otherwise not exact', () => {
  it('the exact answer is wanted: x = 2.807 is a calculator approximation (not a mistake)', () => {
    const r = step('x = log(7)/log(2)', 'x = 2.807')
    expect(r.ok).toBe(false)
    expect(r.notExact).toBe(true)
    expect(r.pattern).toBeUndefined()
    expect(r.message).toBe('2.807 is a calculator approximation. This problem wants the exact answer: keep it written with logs (or e) instead of a decimal.')
  })

  it('a decimal is asked for: rounding is a legal last step, too few places is not', () => {
    const r = step('x = log(7)/log(2)', 'x = 2.807', { decimal: { places: 3 } })
    expect(r.ok).toBe(true)
    expect(r.logMove?.properties).toEqual(['rounded'])
    const short = step('x = log(7)/log(2)', 'x = 2.8', { decimal: { places: 3 } })
    expect(short.ok).toBe(false)
    expect(short.message).toBe('2.8 is rounded too far: give 3 decimal places.')
    expect(step('x = log(7)/log(2)', 'x = 2.809', { decimal: { places: 3 } }).ok).toBe(false)
  })

  it('decimalTolerance and decimalPlaces', () => {
    expect(decimalTolerance({ places: 3 })).toBeCloseTo(0.0005, 9)
    expect(decimalTolerance({ tolerance: 0.01 })).toBe(0.01)
    expect(decimalPlaces('2.807')).toBe(3)
    expect(decimalPlaces('-0.5')).toBe(1)
    expect(decimalPlaces('3')).toBeNull()
  })
})

describe('inequalities carry their domain', () => {
  it('log x < 2 → x < 100 is wrong at x = 0 (the original is undefined there); 0 < x < 100 is right', () => {
    const r = step('log(x) < 2', 'x < 100')
    expect(r.ok).toBe(false)
    expect(r.counterexample?.message).toMatch(/UNDEFINED/)
    expect(step('log(x) < 2', '0 < x < 100').ok).toBe(true)
  })

  it('multiplying by a negative log flips the symbol', () => {
    expect(step('x log(0.5) > log(3)', 'x < log(3)/log(0.5)').ok).toBe(true)
    const r = step('x log(0.5) > log(3)', 'x > log(3)/log(0.5)')
    expect(r.ok).toBe(false)
  })
})

describe('the assumption x > 0 and lines with two variables', () => {
  it('with x > 0 assumed, ln(x²) = 4 → 2 ln x = 4 is the power rule', () => {
    expect(step('ln(x^2) = 4', '2ln(x) = 4', { assumePositive: true }).ok).toBe(true)
  })

  it('two variables go to the engine’s general checker', () => {
    const vars: VarName[] = ['x', 'y']
    const r = step('y = 2x + 3', 'y - 3 = 2x', { vars })
    expect(r.ok).toBe(true)
    expect(r.logMove).toBeUndefined()
  })

  it('parse errors', () => {
    expect(step('log(x', 'x = 1').verdict).toBe('parse_error')
    expect(step('log(x) = 1', 'x = ').verdict).toBe('parse_error')
  })
})

describe('sameLogLine (progress anchoring)', () => {
  it('the same line written another way, judged on the domain', async () => {
    const { sameLogLine } = await import('./step')
    expect(sameLogLine('log(x(x - 3)) = 1', 'log(x^2 - 3x) = 1')).toBe(true)
    expect(sameLogLine('x log(2) = log(7)', 'log(7) = log(2^x)')).toBe(true)
    expect(sameLogLine('x = 5 or x = -2', 'x = -2 or x = 5')).toBe(true)
    expect(sameLogLine('log(x - 200) = 1', 'log(x - 200) = 1')).toBe(true)
    // Different lines, even with the same solutions.
    expect(sameLogLine('2^x = 8', 'x = 3')).toBe(false)
    expect(sameLogLine('ln(x^2) = 4', '2ln(x) = 4')).toBe(false)
  })
})
