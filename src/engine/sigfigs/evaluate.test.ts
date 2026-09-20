import { describe, expect, it } from 'vitest'
import type { SigFigTask, SigFigTerm } from '@/shared/types'
import { evaluateSigFigTask, sigFigTaskExpression, sigFigTaskTerms, SigFigTaskError, validateSigFigTask } from './evaluate'

const t = (text: string): SigFigTerm => ({ text })
const exact = (text: string, note?: string): SigFigTerm => ({ text, exact: true, note })

describe('count tasks', () => {
  it('0.00450 → 3, with an explanation that names each kind of zero', () => {
    const e = evaluateSigFigTask({ kind: 'count', text: '0.00450' })
    expect(e.expected.text).toBe('3')
    expect(e.expected.sigFigs).toBe(3)
    expect(e.limit.rule).toBe('count')
    expect(e.steps.join(' ')).toMatch(/leading zeros/)
    expect(e.steps.join(' ')).toMatch(/decimal point is written/)
    expect(e.steps[e.steps.length - 1]).toBe('Total: 3 significant figures (4, 5, 0).')
    expect(e.tie).toBe(false)
  })
  it('refuses to ask about zero', () => {
    expect(() => evaluateSigFigTask({ kind: 'count', text: '0.00' })).toThrow(SigFigTaskError)
  })
})

describe('round tasks', () => {
  it('anchors', () => {
    expect(evaluateSigFigTask({ kind: 'round', text: '0.004567', sigFigs: 2 }).expected.text).toBe('0.0046')
    const big = evaluateSigFigTask({ kind: 'round', text: '12345', sigFigs: 2 })
    expect(big.expected.text).toBe('12000')
    expect(big.expected.alternates).toEqual(['1.2 x 10^4'])
    const hidden = evaluateSigFigTask({ kind: 'round', text: '1999', sigFigs: 2 })
    expect(hidden.expected.text).toBe('2.0 x 10^3')
    expect(hidden.expected.display).toBe('2.0 × 10³')
    expect(hidden.expected.value).toBe('2000')
    expect(hidden.steps.join(' ')).toMatch(/read as only 1 significant figure/)
    const carry = evaluateSigFigTask({ kind: 'round', text: '0.99961', sigFigs: 3 })
    expect(carry.expected.text).toBe('1.00')
    expect(carry.steps.join(' ')).toMatch(/carried/)
  })
  it('to a place', () => {
    const e = evaluateSigFigTask({ kind: 'round', text: '12.3456', place: -2 })
    expect(e.expected.text).toBe('12.35')
    expect(e.limit.placeName).toBe('hundredths')
    expect(e.rounding).toBe('up')
  })
  it('needs exactly one of sigFigs / place', () => {
    expect(() => evaluateSigFigTask({ kind: 'round', text: '1.5' })).toThrow(SigFigTaskError)
    expect(() => evaluateSigFigTask({ kind: 'round', text: '1.5', sigFigs: 1, place: 0 })).toThrow(SigFigTaskError)
    expect(() => evaluateSigFigTask({ kind: 'round', text: '1.5', sigFigs: 0 })).toThrow(SigFigTaskError)
  })
})

describe('multiply / divide', () => {
  it('3.20 × 1.5 → 4.8', () => {
    const e = evaluateSigFigTask({ kind: 'muldiv', terms: [t('3.20'), t('1.5')], ops: ['*'] })
    expect(e.expression).toBe('3.20 × 1.5')
    expect(e.unrounded).toBe('4.8')
    expect(e.unroundedTerminates).toBe(true)
    expect(e.expected.text).toBe('4.8')
    expect(e.expected.sigFigs).toBe(2)
    expect(e.limit).toMatchObject({ rule: 'muldiv', termIndices: [1], sigFigs: 2, place: -1 })
    expect(e.limit.text).toBe('1.5 has the fewest significant figures (2).')
  })
  it('12.50 ÷ 4.1 → 3.0, keeping the significant zero', () => {
    const e = evaluateSigFigTask({ kind: 'muldiv', terms: [t('12.50'), t('4.1')], ops: ['/'] })
    expect(e.expected.text).toBe('3.0')
    expect(e.unrounded).toBe('3.04878048780…')
    expect(e.unroundedTerminates).toBe(false)
    expect(e.rounding).toBe('down')
    expect(e.steps.join(' ')).toMatch(/Keep the final zero/)
  })
  it('exact numbers never limit (rule 6)', () => {
    const e = evaluateSigFigTask({ kind: 'muldiv', terms: [exact('3', 'counted beakers'), t('2.45')], ops: ['*'] })
    expect(e.expected.text).toBe('7.35')
    expect(e.limit.termIndices).toEqual([1])
    expect(e.steps.join(' ')).toMatch(/exact number \(counted beakers\)/)
    const conv = evaluateSigFigTask({ kind: 'muldiv', terms: [t('2.54'), exact('100', 'defined: 100 cm = 1 m')], ops: ['/'] })
    expect(conv.expected.text).toBe('0.0254')
  })
  it('chains left to right and handles scientific notation', () => {
    const e = evaluateSigFigTask({ kind: 'muldiv', terms: [t('6.022e23'), t('2.0'), t('4.00')], ops: ['*', '/'] })
    expect(e.expected.text).toBe('3.0 x 10^23')
    expect(e.expression).toBe('6.022 × 10²³ × 2.0 ÷ 4.00')
    const small = evaluateSigFigTask({ kind: 'muldiv', terms: [t('1.5e-9'), t('3.11e-3')], ops: ['*'] })
    expect(small.expected.text).toBe('4.7 x 10^-12')
  })
  it('a result whose zeros would hide the figures is written in scientific notation', () => {
    const e = evaluateSigFigTask({ kind: 'muldiv', terms: [t('25.0'), t('8.00')], ops: ['*'] })
    expect(e.unrounded).toBe('200')
    expect(e.expected.text).toBe('200.')
    expect(e.expected.alternates).toEqual(['2.00 x 10^2'])
    const two = evaluateSigFigTask({ kind: 'muldiv', terms: [t('25'), t('8.00')], ops: ['*'] })
    expect(two.expected.text).toBe('2.0 x 10^2')
    expect(two.expected.alternates).toEqual([])
  })
  it('negative factors', () => {
    const e = evaluateSigFigTask({ kind: 'muldiv', terms: [t('-2.50'), t('-4.1')], ops: ['*'] })
    expect(e.expression).toBe('−2.50 × (−4.1)')
    expect(e.expected.text).toBe('10.')
    const n = evaluateSigFigTask({ kind: 'muldiv', terms: [t('-12.50'), t('4.1')], ops: ['/'] })
    expect(n.expected.text).toBe('-3.0')
    expect(n.expected.display).toBe('−3.0')
  })
  it('malformed tasks throw', () => {
    expect(() => evaluateSigFigTask({ kind: 'muldiv', terms: [t('1.0'), t('0.0')], ops: ['/'] })).toThrow(/zero/)
    expect(() => evaluateSigFigTask({ kind: 'muldiv', terms: [t('1.0'), t('0.00')], ops: ['*'] })).toThrow(/measured zero/)
    expect(() => evaluateSigFigTask({ kind: 'muldiv', terms: [t('1.0'), t('2.0')], ops: ['+'] })).toThrow(SigFigTaskError)
    expect(() => evaluateSigFigTask({ kind: 'muldiv', terms: [t('1.0'), t('2.0')], ops: [] })).toThrow(SigFigTaskError)
    expect(() => evaluateSigFigTask({ kind: 'muldiv', terms: [t('1.0')], ops: [] })).toThrow(SigFigTaskError)
    expect(() => evaluateSigFigTask({ kind: 'muldiv', terms: [t('1,0'), t('2.0')], ops: ['*'] })).toThrow(/cannot read/)
    expect(() => evaluateSigFigTask({ kind: 'muldiv', terms: [exact('2'), exact('3')], ops: ['*'] })).toThrow(/exact/)
  })
})

describe('add / subtract', () => {
  it('12.11 + 18.0 + 1.013 → 31.1', () => {
    const e = evaluateSigFigTask({ kind: 'addsub', terms: [t('12.11'), t('18.0'), t('1.013')], ops: ['+', '+'] })
    expect(e.unrounded).toBe('31.123')
    expect(e.expected.text).toBe('31.1')
    expect(e.limit).toMatchObject({ rule: 'addsub', termIndices: [1], place: -1, placeName: 'tenths', sigFigs: 3 })
  })
  it('5.26 − 5.21 → 0.05: subtraction can lose figures', () => {
    const e = evaluateSigFigTask({ kind: 'addsub', terms: [t('5.26'), t('5.21')], ops: ['-'] })
    expect(e.expected.text).toBe('0.05')
    expect(e.expected.sigFigs).toBe(1)
    expect(e.limit.termIndices).toEqual([0, 1])
    expect(e.steps.join(' ')).toMatch(/loses figures/)
  })
  it('0.1 + 0.2 is exactly 0.3', () => {
    const e = evaluateSigFigTask({ kind: 'addsub', terms: [t('0.1'), t('0.2')], ops: ['+'] })
    expect(e.unrounded).toBe('0.3')
    expect(e.expected.text).toBe('0.3')
    expect(e.rounding).toBe('exact')
  })
  it('placeholder zeros set the place: 1200 + 34.5 → 1200', () => {
    const e = evaluateSigFigTask({ kind: 'addsub', terms: [t('1200'), t('34.5')], ops: ['+'] })
    expect(e.limit.place).toBe(2)
    expect(e.expected.text).toBe('1200')
    const dotted = evaluateSigFigTask({ kind: 'addsub', terms: [t('1200.'), t('34.5')], ops: ['+'] })
    expect(dotted.expected.text).toBe('1235')
  })
  it('scientific notation terms line up by place', () => {
    const e = evaluateSigFigTask({ kind: 'addsub', terms: [t('1.20e3'), t('45')], ops: ['+'] })
    expect(e.limit.place).toBe(1)
    expect(e.expected.text).toBe('1250')
  })
  it('exact terms do not set the place', () => {
    const e = evaluateSigFigTask({ kind: 'addsub', terms: [t('2.345'), exact('1')], ops: ['+'] })
    expect(e.expected.text).toBe('3.345')
  })
  it('a zero result keeps its place', () => {
    const task: SigFigTask = { kind: 'addsub', terms: [t('5.26'), t('5.26')], ops: ['-'] }
    const e = evaluateSigFigTask(task)
    expect(e.expected.text).toBe('0.00')
    expect(e.expected.sigFigs).toBe(0)
    expect(validateSigFigTask(task).map((i) => i.code)).toEqual(['zero_result'])
  })
  it('negative results', () => {
    const e = evaluateSigFigTask({ kind: 'addsub', terms: [t('1.2'), t('3.456')], ops: ['-'] })
    expect(e.unrounded).toBe('-2.256')
    expect(e.expected.text).toBe('-2.3')
  })
})

describe('mixed operations: carry every digit, round once', () => {
  const sumThenDivide: SigFigTask = {
    kind: 'mixed',
    operands: [{ terms: [t('12.11'), t('1.3')], ops: ['+'] }, t('2.0')],
    ops: ['/'],
  }
  it('(12.11 + 1.3) ÷ 2.0 → 6.7, with the intermediate precision noted', () => {
    const e = evaluateSigFigTask(sumThenDivide)
    expect(e.expression).toBe('(12.11 + 1.3) ÷ 2.0')
    expect(e.unrounded).toBe('6.705')
    expect(e.expected.text).toBe('6.7')
    expect(e.intermediates).toHaveLength(1)
    expect(e.intermediates[0]).toMatchObject({
      operandIndex: 0,
      rule: 'addsub',
      expression: '12.11 + 1.3',
      unrounded: '13.41',
      roundedDisplay: '13.4',
      sigFigs: 3,
      place: -1,
      placeName: 'tenths',
    })
    expect(e.intermediates[0].limit.termIndices).toEqual([1])
    expect(e.limit.termIndices).toEqual([2])
    expect(e.steps.join(' ')).toMatch(/Do not round yet/)
  })
  it('the intermediate, not the raw terms, limits the answer', () => {
    // 1.23 has 3 figures and 0.9 has 1, but their sum 2.13 → 2.1 has TWO; 4.000 has four.
    const e = evaluateSigFigTask({ kind: 'mixed', operands: [{ terms: [t('1.23'), t('0.9')], ops: ['+'] }, t('4.000')], ops: ['*'] })
    expect(e.intermediates[0].sigFigs).toBe(2)
    expect(e.expected.text).toBe('8.5')
    expect(e.limit.termIndices).toEqual([1])
  })
  it('a × b − c goes by the place the product is good to', () => {
    const e = evaluateSigFigTask({ kind: 'mixed', operands: [{ terms: [t('2.51'), t('3.42')], ops: ['*'] }, t('1.113')], ops: ['-'] })
    expect(e.expression).toBe('2.51 × 3.42 − 1.113')
    expect(e.intermediates[0]).toMatchObject({ rule: 'muldiv', unrounded: '8.5842', sigFigs: 3, place: -2, roundedDisplay: '8.58' })
    expect(e.unrounded).toBe('7.4712')
    expect(e.expected.text).toBe('7.47')
  })
  it('two groups: (a + b) ÷ (c − d)', () => {
    const e = evaluateSigFigTask({
      kind: 'mixed',
      operands: [
        { terms: [t('8.21'), t('1.4')], ops: ['+'] },
        { terms: [t('5.26'), t('5.21')], ops: ['-'] },
      ],
      ops: ['/'],
    })
    expect(e.expression).toBe('(8.21 + 1.4) ÷ (5.26 − 5.21)')
    expect(e.intermediates.map((i) => i.sigFigs)).toEqual([2, 1])
    expect(e.unrounded).toBe('192.2')
    expect(e.expected.text).toBe('200')
    expect(e.expected.alternates).toEqual(['2 x 10^2'])
    expect(e.limit.termIndices).toEqual([2, 3])
  })
  it('group position and flat term indices', () => {
    const task: SigFigTask = { kind: 'mixed', operands: [t('9.11'), { terms: [t('1.20'), t('0.345')], ops: ['+'] }], ops: ['/'] }
    expect(sigFigTaskTerms(task).map((x) => x.text)).toEqual(['9.11', '1.20', '0.345'])
    expect(sigFigTaskExpression(task)).toBe('9.11 ÷ (1.20 + 0.345)')
    const e = evaluateSigFigTask(task)
    expect(e.intermediates[0].operandIndex).toBe(1)
    expect(e.intermediates[0].limit.termIndices).toEqual([1])
  })
  it('malformed mixed tasks throw', () => {
    expect(() => evaluateSigFigTask({ kind: 'mixed', operands: [t('1.0'), t('2.0')], ops: ['*'] })).toThrow(/group/)
    expect(() => evaluateSigFigTask({ kind: 'mixed', operands: [{ terms: [t('1.0'), t('2.0')], ops: ['*'] }, t('2.0')], ops: ['*'] })).toThrow(/other kind/)
    expect(() => evaluateSigFigTask({ kind: 'mixed', operands: [{ terms: [t('1.0'), t('2.0')], ops: ['+'] }, t('2.0'), t('3.0')], ops: ['*', '+'] })).toThrow(SigFigTaskError)
  })
  it('flags an intermediate that carries into a new digit', () => {
    const task: SigFigTask = { kind: 'mixed', operands: [{ terms: [t('9.93'), t('0.04')], ops: ['+'] }, t('3.111')], ops: ['*'] }
    // 9.97 to the tenths would be 10.0: two figures or three? Generators skip these.
    expect(validateSigFigTask({ ...task, operands: [{ terms: [t('9.9'), t('0.07')], ops: ['+'] }, t('3.111')] }).map((i) => i.code)).toContain('intermediate_carry')
    expect(validateSigFigTask(task).map((i) => i.code)).not.toContain('intermediate_carry')
  })
})

describe('conversion', () => {
  it('to scientific notation keeps every figure', () => {
    const e = evaluateSigFigTask({ kind: 'convert', text: '0.00450', to: 'scientific' })
    expect(e.expected.text).toBe('4.50 x 10^-3')
    expect(e.expected.display).toBe('4.50 × 10⁻³')
    expect(e.expected.alternates).toEqual([])
    expect(e.expected.sigFigs).toBe(3)
    expect(evaluateSigFigTask({ kind: 'convert', text: '1200', to: 'scientific' }).expected.text).toBe('1.2 x 10^3')
    expect(evaluateSigFigTask({ kind: 'convert', text: '1200.', to: 'scientific' }).expected.text).toBe('1.200 x 10^3')
    expect(evaluateSigFigTask({ kind: 'convert', text: '-93000000', to: 'scientific' }).expected.text).toBe('-9.3 x 10^7')
    expect(evaluateSigFigTask({ kind: 'convert', text: '5', to: 'scientific' }).expected.text).toBe('5 x 10^0')
  })
  it('to standard notation', () => {
    expect(evaluateSigFigTask({ kind: 'convert', text: '6.02e-4', to: 'standard' }).expected.text).toBe('0.000602')
    expect(evaluateSigFigTask({ kind: 'convert', text: '1.2 x 10^3', to: 'standard' }).expected.text).toBe('1200')
    expect(evaluateSigFigTask({ kind: 'convert', text: '1.200e3', to: 'standard' }).expected.text).toBe('1200.')
    expect(evaluateSigFigTask({ kind: 'convert', text: '3.05e8', to: 'standard' }).expected.text).toBe('305000000')
  })
  it('refuses a conversion standard notation cannot show', () => {
    const task: SigFigTask = { kind: 'convert', text: '1.20e3', to: 'standard' }
    expect(() => evaluateSigFigTask(task)).toThrow(SigFigTaskError)
    expect(validateSigFigTask(task).map((i) => i.code)).toEqual(['not_representable'])
  })
})

describe('validateSigFigTask', () => {
  it('[] for a good task', () => {
    expect(validateSigFigTask({ kind: 'muldiv', terms: [t('12.50'), t('4.1')], ops: ['/'] })).toEqual([])
  })
  it('flags ties (rule 10)', () => {
    expect(validateSigFigTask({ kind: 'round', text: '2.5', sigFigs: 1 }).map((i) => i.code)).toEqual(['tie'])
    expect(validateSigFigTask({ kind: 'round', text: '2.51', sigFigs: 1 })).toEqual([])
    // 2.5 × 1.30 = 3.25 → two figures: the dropped part is exactly 5.
    expect(validateSigFigTask({ kind: 'muldiv', terms: [t('2.5'), t('1.30')], ops: ['*'] }).map((i) => i.code)).toEqual(['tie'])
    // 1.25 + 1.2 = 2.45 → tenths: tie.
    expect(validateSigFigTask({ kind: 'addsub', terms: [t('1.25'), t('1.2')], ops: ['+'] }).map((i) => i.code)).toEqual(['tie'])
    // 1/8 exactly
    expect(validateSigFigTask({ kind: 'muldiv', terms: [t('1.0'), t('8.0')], ops: ['/'] }).map((i) => i.code)).toEqual(['tie'])
  })
  it('never throws', () => {
    expect(validateSigFigTask({ kind: 'muldiv', terms: [t('abc'), t('4.1')], ops: ['/'] })[0].code).toBe('invalid')
    expect(validateSigFigTask({ kind: 'count', text: '' })[0].code).toBe('invalid')
  })
})

describe('fuzz fixes: large magnitudes', () => {
  it('the calculator display never pads placeholder zeros that read as digits (1e13 ÷ 3)', () => {
    const e = evaluateSigFigTask({ kind: 'muldiv', terms: [t('1e13'), t('3')], ops: ['/'] })
    expect(e.unroundedTerminates).toBe(false)
    expect(e.unrounded).toBe('3333333333333.3…')
    const big = evaluateSigFigTask({ kind: 'muldiv', terms: [t('6.022e23'), t('3.0')], ops: ['/'] })
    expect(big.unrounded).toBe('200733333333333333333333.3…')
    // the same display inside a mixed task's intermediate
    const mixed = evaluateSigFigTask({
      kind: 'mixed',
      operands: [{ terms: [t('1e13'), t('3')], ops: ['/'] }, t('1.0')],
      ops: ['+'],
    })
    expect(mixed.intermediates[0].unrounded).toBe('3333333333333.3…')
    expect(mixed.unrounded).toBe('3333333333334.3…')
  })
  it('a round task whose plain expansion has more than 30 digits still evaluates (4.0e30 to 2 s.f.)', () => {
    const task: SigFigTask = { kind: 'round', text: '4.0e30', sigFigs: 2 }
    expect(validateSigFigTask(task)).toEqual([])
    const e = evaluateSigFigTask(task)
    expect(e.expected.text).toBe('4.0 x 10^30')
    expect(e.expected.alternates).toEqual([])
    expect(e.steps.join(' ')).toMatch(/read as only 1 significant figure/)
    expect(evaluateSigFigTask({ kind: 'round', text: '8.00e30', sigFigs: 2 }).expected.text).toBe('8.0 x 10^30')
    expect(evaluateSigFigTask({ kind: 'convert', text: '1.0e-30', to: 'standard' }).expected.text).toBe('0.0000000000000000000000000000010')
  })
})
