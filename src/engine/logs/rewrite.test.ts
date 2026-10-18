import { describe, expect, it } from 'vitest'
import type { VarName } from '@/shared/types'
import { checkLogRewrite, condenseLog, expandLog, isExpandedLog, isSingleLog } from './rewrite'
import type { LogMistakeId, LogRewriteContext } from './types'

const V: VarName[] = ['x', 'y', 'n']

function rw(prev: string, next: string, ctx: LogRewriteContext = {}) {
  return checkLogRewrite(prev, next, { vars: V, seed: 5, ...ctx })
}

describe('each slip is named when it produces her line', () => {
  it.each([
    ['log(x + 2)', 'log(x) + log(2)', 'log_sum_split'],
    ['log(x) + log(3)', 'log(x + 3)', 'log_sum_split'],
    ['ln(x - 4)', 'ln(x) - ln(4)', 'log_sum_split'],
    ['log(2x)', 'log(2)log(x)', 'log_product_as_product'],
    ['log(x)log(y)', 'log(xy)', 'log_product_as_product'],
    ['log(x/3)', 'log(x)/log(3)', 'log_quotient_as_quotient'],
    ['log(x) - log(3)', 'log(x)/log(3)', 'log_quotient_as_quotient'],
    ['log(x)/log(3)', 'log(x/3)', 'log_quotient_as_quotient'],
    ['log(x^3)', 'log(x)^3', 'log_power_as_power'],
    ['ln(x^4)', '(ln(x))^4', 'log_power_as_power'],
    ['2log(x)', 'log(x)^2', 'log_coefficient_as_power'],
    ['log(x)^2', '2log(x)', 'log_coefficient_as_power'],
    ['2log(x)', 'log(2x)', 'log_coefficient_inside'],
    ['log(3x)', '3log(x)', 'log_coefficient_inside'],
    ['log_2(7)', 'log(2)/log(7)', 'log_change_base_inverted'],
    ['log_5(x)', 'ln(5)/ln(x)', 'log_change_base_inverted'],
    ['log_5(5)', '0', 'log_identity_misused'],
    ['log(x) + log(10)', 'log(x)', 'log_identity_misused'],
    ['ln(1) + x', '1 + x', 'log_identity_misused'],
    ['ln(x^2)', '2ln(x)', 'log_power_abs'],
    ['e^(x + 2)', 'e^x + e^2', 'log_exp_sum_split'],
    ['2^x + 2^3', '2^(x + 3)', 'log_exp_sum_split'],
    ['(e^x)^3', 'e^(x + 3)', 'log_exp_power_added'],
    ['e^x e^(2x)', 'e^(2x^2)', 'log_exp_power_added'],
    ['2^(-x)', '-2^x', 'log_exp_negative_exponent'],
    ['5^(-2)', '-25', 'log_exp_negative_exponent'],
    ['2 * 3^x', '6^x', 'log_exp_coefficient_base'],
  ] as [string, string, LogMistakeId][])('%s → %s is %s', (prev, next, id) => {
    const r = rw(prev, next)
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe(id)
    expect(r.pattern?.witness).toBeTruthy()
    expect(r.counterexample?.message).toBeTruthy()
  })

  it('the slip may come with legal rewriting on top: log(x + 2) → log(2x) is still the split', () => {
    const r = rw('log(x + 2)', 'log(2x)')
    expect(r.pattern?.id).toBe('log_sum_split')
  })

  it('the witness talks about HER numbers', () => {
    const r = rw('log(x/3)', 'log(x)/log(3)')
    expect(r.pattern?.witness).toBe('log(x/3) is not log(x)/log(3): the log of a quotient is the DIFFERENCE of the logs, and a quotient of logs is a change of base. At x = 1: log(x/3) ≈ −0.477, but log(x)/log(3) = 0.')
    expect(r.counterexample?.message).toBe('At x = 1 the original expression gives −0.477, but yours gives 0.')
  })

  it('a wrong line that is no log slip gets the counterexample (and the algebra matchers)', () => {
    const r = rw('log(x) + log(y)', 'log(x) + log(y) + 1')
    expect(r.ok).toBe(false)
    expect(r.pattern).toBeUndefined()
    expect(r.counterexample?.message).toMatch(/^At x = 1, y = /)
  })
})

describe('right lines are never flagged', () => {
  it.each([
    ['log(x^2 y^3)', '2log(x) + 3log(y)', true, ['product_rule', 'power_rule']],
    ['log(x) + log(y) - log(n)', 'log(xy/n)', false, ['product_rule', 'quotient_rule']],
    ['3ln(x) - ln(y)', 'ln(x^3/y)', true, ['power_rule', 'quotient_rule']],
    ['log_2(8x)', '3 + log_2(x)', false, ['product_rule', 'evaluate']],
    ['log(100x)', '2 + log(x)', false, ['product_rule', 'evaluate']],
    ['e^(x + 2)', 'e^x e^2', false, ['exp_product']],
    ['(e^x)^3', 'e^(3x)', false, ['exp_power']],
    ['2^(-x)', '1/2^x', false, ['exp_negative']],
    ['log_3(81)', '4', false, ['evaluate']],
    ['ln(e^(2x))', '2x', false, ['inverse_property']],
    ['e^(ln(x))', 'x', false, ['inverse_property']],
    ['log_2(x) + log_2(3)', 'log_2(3x)', false, ['product_rule']],
    ['ln(x) - ln(y)', 'ln(x/y)', false, ['quotient_rule']],
    ['log(x^5)', '5log(x)', false, ['power_rule']],
    ['log_4(x)', 'log(x)/log(4)', false, ['change_of_base']],
    ['2ln(x)', 'ln(x^2)', false, ['power_rule']],
    ['log(x) + log(x - 3)', 'log(x(x - 3))', false, ['product_rule']],
    ['log(2 + 2)', 'log(2) + log(2)', false, []],
  ] as [string, string, boolean, string[]][])('%s → %s', (prev, next, positive, props) => {
    const r = rw(prev, next, { assumePositive: positive })
    expect(r.ok, JSON.stringify(r)).toBe(true)
    expect(r.pattern).toBeUndefined()
    if (props.length) expect(r.logMove?.properties).toEqual(props)
  })
})

describe('the domain decision (a rewrite must hold wherever the previous line is defined)', () => {
  it('ln(x²) → 2 ln x: wrong at x = −1 unless the problem says x > 0', () => {
    const r = rw('ln(x^2)', '2ln(x)')
    expect(r.ok).toBe(false)
    expect(r.counterexample?.message).toBe('At x = −1 the original expression gives 0, but yours is undefined.')
    expect(r.message).toBe('x = −1 is in the domain of the original expression but not of yours.')
    expect(rw('ln(x^2)', '2ln(x)', { assumePositive: true }).ok).toBe(true)
  })

  it('log(x(x − 3)) → log x + log(x − 3): wrong at x = −1 unless x > 0 is assumed (then the domain is x > 3)', () => {
    expect(rw('log(x(x - 3))', 'log(x) + log(x - 3)').ok).toBe(false)
    expect(rw('log(x(x - 3))', 'log(x) + log(x - 3)', { assumePositive: true }).ok).toBe(true)
  })

  it('condensing only widens the domain: accepted', () => {
    expect(rw('2ln(x)', 'ln(x^2)').ok).toBe(true)
    expect(rw('ln(x) + ln(y)', 'ln(xy)').ok).toBe(true)
  })

  it('a narrow domain is still sampled inside: log(x − 200) + log(x − 201) → log((x − 200)(x − 201))', () => {
    expect(rw('log(x - 200) + log(x - 201)', 'log((x - 200)(x - 201))').ok).toBe(true)
    expect(rw('log(x - 200) + log(x - 201)', 'log(2x - 401)').pattern?.id).toBe('log_sum_split')
  })

  it('an expression defined nowhere cannot be checked', () => {
    const r = rw('log(-x^2 - 1)', 'log(x)')
    expect(r.verdict).toBe('undecidable')
  })
})

describe('constant expressions are compared exactly', () => {
  it('log₂ 8 → 3 and 2log₅ 10 − log₅ 4 → 2 are right; log₂ 8 → 4 is not', () => {
    expect(rw('log_2(8)', '3').ok).toBe(true)
    expect(rw('2log_5(10) - log_5(4)', 'log_5(25)').ok).toBe(true)
    expect(rw('log_5(25)', '2').ok).toBe(true)
    const bad = rw('log_2(8)', '4')
    expect(bad.ok).toBe(false)
    expect(bad.counterexample?.message).toBe('The original is 3, but your line is 4.')
  })
})

describe('expand, condense, and the finished forms', () => {
  it.each([
    ['log(x^2 y / n)', '2log(x) + log(y) - log(n)'],
    ['ln(x^3 sqrt(y))', '3ln(x) + (1/2)ln(y)'],
    ['log_2(8x)', '3 + log_2(x)'],
    ['log(x(x - 3))', 'log(x) + log(x - 3)'],
    ['ln(e^(2x))', '2x'],
    ['log((x + 1)/x^2)', 'log(x + 1) - 2log(x)'],
    ['log_3(9x^4)', '2 + 4log_3(x)'],
  ])('expandLog(%s) = %s', (text, expected) => {
    expect(expandLog(text, V)).toBe(expected)
  })

  it.each([
    ['2log(x) + log(y) - log(n)', 'log(x^2y/n)'],
    ['3ln(x) - ln(y)', 'ln(x^3/y)'],
    ['log_2(x) + log_2(x - 2)', 'log_2(x(x - 2))'],
    ['(1/2)log(x) - 2log(y)', 'log(sqrt(x)/y^2)'],
    ['log(x) + log(3)', 'log(3x)'],
  ])('condenseLog(%s) = %s', (text, expected) => {
    expect(condenseLog(text, V)).toBe(expected)
  })

  it('condenseLog is null for logs of different bases', () => {
    expect(condenseLog('log(x) + ln(x)', V)).toBeNull()
  })

  it('isExpandedLog and isSingleLog', () => {
    expect(isExpandedLog('2log(x) + log(y) - log(n)', V)).toBe(true)
    expect(isExpandedLog('log(x + 1) - 2log(x)', V)).toBe(true)
    for (const t of ['log(x^2)', 'log(2x)', 'ln(sqrt(x))', 'log(x/y)']) expect(isExpandedLog(t, V), t).toBe(false)
    expect(isSingleLog('log(x^2 y)', V)).toBe(true)
    expect(isSingleLog('ln(x/y)', V)).toBe(true)
    for (const t of ['2log(x)', 'log(x) + log(y)']) expect(isSingleLog(t, V), t).toBe(false)
  })

  it('every expansion is a legal line from its start (so it can be a canonical path)', () => {
    for (const t of ['log(x^2 y / n)', 'ln(x^3 sqrt(y))', 'log_2(8x)', 'log((x + 1)/x^2)', 'log_3(9x^4)']) {
      const e = expandLog(t, V)!
      expect(rw(t, e, { assumePositive: true }).ok, `${t} → ${e}`).toBe(true)
      const c = condenseLog(e, V)
      if (c) expect(rw(e, c, { assumePositive: true }).ok, `${e} → ${c}`).toBe(true)
    }
  })
})

describe('parse errors keep the step API shape', () => {
  it('previous and next line', () => {
    const a = rw('log(', 'x')
    expect(a.verdict).toBe('parse_error')
    expect(a.parseError?.message).toMatch(/^Previous line:/)
    const b = rw('log(x)', 'ln 2x')
    expect(b.verdict).toBe('parse_error')
    expect(b.parseError?.message).toMatch(/parentheses/)
  })
})
