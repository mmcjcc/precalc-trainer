import { describe, expect, it } from 'vitest'
import type { ErrorPatternId, SigFigGrade, SigFigTask, SigFigTerm } from '@/shared/types'
import { ERROR_PATTERNS } from '../matchers/catalog'
import { evaluateSigFigTask } from './evaluate'
import { gradeSigFigAnswer, gradeSigFigIntermediate, gradeSigFigTaps, sigFigMistakeCandidates } from './grade'
import { parseSigFigNumeral } from './parse'

const t = (text: string): SigFigTerm => ({ text })
const count = (text: string): SigFigTask => ({ kind: 'count', text })
const round = (text: string, sigFigs: number): SigFigTask => ({ kind: 'round', text, sigFigs })
const mul = (a: string, b: string): SigFigTask => ({ kind: 'muldiv', terms: [t(a), t(b)], ops: ['*'] })
const div = (a: string, b: string): SigFigTask => ({ kind: 'muldiv', terms: [t(a), t(b)], ops: ['/'] })
const add = (...xs: string[]): SigFigTask => ({ kind: 'addsub', terms: xs.map(t), ops: xs.slice(1).map(() => '+' as const) })
const sub = (a: string, b: string): SigFigTask => ({ kind: 'addsub', terms: [t(a), t(b)], ops: ['-'] })

function expectCorrect(task: SigFigTask, answer: string): SigFigGrade {
  const g = gradeSigFigAnswer(task, answer)
  expect(g.status, `${answer}: ${g.message}`).toBe('correct')
  expect(g.pattern).toBeUndefined()
  return g
}

function expectPattern(task: SigFigTask, answer: string, id: ErrorPatternId): SigFigGrade {
  const g = gradeSigFigAnswer(task, answer)
  expect(g.status, `${answer}: ${g.message}`).toBe('wrong')
  expect(g.pattern?.id, `${answer}: ${g.message}`).toBe(id)
  expect(g.pattern?.witness).toBeTruthy()
  expect(g.message).toBe(g.pattern?.witness)
  expect(g.pattern?.lesson).toBe(ERROR_PATTERNS[id].lesson)
  return g
}

function expectPlainWrong(task: SigFigTask, answer: string, message?: RegExp): SigFigGrade {
  const g = gradeSigFigAnswer(task, answer)
  expect(g.status, `${answer}: ${g.message}`).toBe('wrong')
  expect(g.pattern, `${answer}: ${g.pattern?.id}`).toBeUndefined()
  expect(g.message.length).toBeGreaterThan(20)
  if (message) expect(g.message).toMatch(message)
  return g
}

describe('rule 11: value AND figures', () => {
  it('12.50 ÷ 4.1: "3.0" is right, "3" dropped a significant zero', () => {
    expectCorrect(div('12.50', '4.1'), '3.0')
    expectCorrect(div('12.50', '4.1'), ' 3.0 ')
    expectCorrect(div('12.50', '4.1'), '3.0e0')
    expectPattern(div('12.50', '4.1'), '3', 'sf_dropped_zero')
    expectPattern(div('12.50', '4.1'), '3.', 'sf_dropped_zero')
  })
  it('12345 to two figures: "12000" and "1.2e4" are both right', () => {
    for (const a of ['12000', '1.2e4', '1.2 x 10^4', '1.2×10^4', '1.2 × 10⁴', '1.2E+4', '+12000']) expectCorrect(round('12345', 2), a)
    const loose = expectCorrect(round('12345', 2), '12e3')
    expect(loose.note).toMatch(/1\.2 × 10⁴/)
  })
  it('1999 to two figures: "2.0e3" is right, "2000" reads as one figure', () => {
    expectCorrect(round('1999', 2), '2.0e3')
    expectCorrect(round('1999', 2), '2.0 x 10^3')
    expectPattern(round('1999', 2), '2000', 'sf_ambiguous_zeros')
    expectPattern(round('1999', 2), '2000.', 'sf_extra_zeros')
    expectPattern(round('1999', 2), '2e3', 'sf_dropped_zero')
  })
  it('a trailing decimal point shows every zero counts', () => {
    expectCorrect(round('1999.7', 4), '2000.')
    expectCorrect(round('1999.7', 4), '2.000e3')
    expectPattern(round('1999.7', 4), '2000', 'sf_ambiguous_zeros')
  })
  it('the other anchors', () => {
    expectCorrect(round('0.004567', 2), '0.0046')
    expectCorrect(round('0.004567', 2), '.0046')
    expectCorrect(round('0.004567', 2), '4.6e-3')
    expectCorrect(round('0.99961', 3), '1.00')
    expectPattern(round('0.99961', 3), '1.0', 'sf_dropped_zero')
    expectCorrect(mul('3.20', '1.5'), '4.8')
    expectCorrect(add('12.11', '18.0', '1.013'), '31.1')
    expectCorrect(sub('5.26', '5.21'), '0.05')
    expectCorrect(sub('5.26', '5.21'), '5e-2')
    expectCorrect(sub('5.26', '5.21'), '.05')
  })
  it('count answers are whole numbers', () => {
    const anchors: [string, number][] = [
      ['0.00450', 3],
      ['1200', 2],
      ['1200.', 4],
      ['100.0', 4],
      ['5002', 4],
      ['0.10050', 5],
      ['300', 1],
      ['3.00e8', 3],
      ['40.', 2],
      ['0.5', 1],
    ]
    for (const [text, n] of anchors) {
      expectCorrect(count(text), String(n))
      expect(gradeSigFigAnswer(count(text), String(n + 1)).status).toBe('wrong')
    }
  })
  it('negative answers need the sign', () => {
    const task = sub('1.2', '3.456')
    expectCorrect(task, '-2.3')
    expectCorrect(task, '−2.3')
    expectPlainWrong(task, '2.3')
  })
  it('a zero result is graded by its place', () => {
    const task = sub('5.26', '5.26')
    expectCorrect(task, '0.00')
    expect(gradeSigFigAnswer(task, '0').status).toBe('wrong')
    expect(gradeSigFigAnswer(task, '0.0').status).toBe('wrong')
  })
})

describe('parse errors come back as values, with positions', () => {
  it('value answers', () => {
    const g = gradeSigFigAnswer(div('12.50', '4.1'), '3.0 g')
    expect(g.status).toBe('parse_error')
    expect(g.parseError?.position).toBe(4)
    expect(g.message).toBe(g.parseError?.message)
    expect(gradeSigFigAnswer(round('12345', 2), '12,000').parseError?.position).toBe(2)
    expect(gradeSigFigAnswer(round('12345', 2), '').status).toBe('parse_error')
  })
  it('count answers', () => {
    expect(gradeSigFigAnswer(count('1200'), '').status).toBe('parse_error')
    expect(gradeSigFigAnswer(count('1200'), 'two').status).toBe('parse_error')
    expect(gradeSigFigAnswer(count('1200'), '2.0').status).toBe('parse_error')
    expect(gradeSigFigAnswer(count('1200'), ' 2.0').parseError).toMatchObject({ position: 1, length: 3 })
    expect(gradeSigFigAnswer(count('1200'), ' 2 ').status).toBe('correct')
  })
})

describe('named mistakes: counting', () => {
  it('sf_leading_zeros', () => {
    expectPattern(count('0.00450'), '6', 'sf_leading_zeros')
    expectPattern(count('0.00450'), '5', 'sf_leading_zeros')
    expectPattern(count('0.5'), '2', 'sf_leading_zeros')
    expectCorrect(count('0.00450'), '3')
  })
  it('sf_trailing_zeros_decimal', () => {
    expectPattern(count('0.00450'), '2', 'sf_trailing_zeros_decimal')
    expectPattern(count('100.0'), '1', 'sf_trailing_zeros_decimal')
    expectPattern(count('40.'), '1', 'sf_trailing_zeros_decimal')
    expectPattern(count('3.00e8'), '1', 'sf_trailing_zeros_decimal')
    expectCorrect(count('100.0'), '4')
  })
  it('sf_placeholder_zeros', () => {
    expectPattern(count('1200'), '4', 'sf_placeholder_zeros')
    expectPattern(count('300'), '3', 'sf_placeholder_zeros')
    expectCorrect(count('1200'), '2')
    // With the decimal point written, 4 is simply right.
    expectCorrect(count('1200.'), '4')
  })
  it('sf_captive_zero', () => {
    expectPattern(count('5002'), '2', 'sf_captive_zero')
    expectPattern(count('0.10050'), '3', 'sf_captive_zero')
    expectCorrect(count('5002'), '4')
  })
  it('anything else gets the plain digit-by-digit message', () => {
    expectPlainWrong(count('5002'), '3', /digit by digit/)
    expectPlainWrong(count('5002'), '9', /only has 4 digits/)
  })
})

describe('named mistakes: the wrong rule', () => {
  it('sf_addsub_rule_on_muldiv: decimal places on a multiplication', () => {
    const task = mul('2.0', '11.31') // 22.62 → 23
    expectCorrect(task, '23')
    expectPattern(task, '22.6', 'sf_addsub_rule_on_muldiv')
  })
  it('sf_muldiv_rule_on_addsub: counting figures on an addition', () => {
    const task = add('104.52', '3.1') // 107.62 → 107.6
    expectCorrect(task, '107.6')
    expectPattern(task, '110', 'sf_muldiv_rule_on_addsub')
    expectPattern(task, '1.1e2', 'sf_muldiv_rule_on_addsub')
  })
  it('sf_most_precise: matched the strongest number', () => {
    const task = mul('2.4', '3.421') // 8.2104 → 8.2
    expectCorrect(task, '8.2')
    expectPattern(task, '8.210', 'sf_most_precise')
    const sum = add('12.11', '18.0', '1.0137') // 31.1237 → 31.1
    expectCorrect(sum, '31.1')
    // For a sum, "as far as the most precise number" IS the whole calculator display.
    expectPattern(sum, '31.1237', 'sf_unrounded')
  })
  it('sf_places_not_figures: N decimal places instead of N figures', () => {
    expectPattern(round('0.004567', 2), '0.00', 'sf_places_not_figures')
    expectPattern(round('12.3456', 3), '12.346', 'sf_places_not_figures')
    expectCorrect(round('12.3456', 3), '12.3')
    expectPattern(div('12.50', '4.1'), '3.05', 'sf_places_not_figures')
  })
  it('sf_exact_limited: an exact number limited the figures', () => {
    const task: SigFigTask = { kind: 'muldiv', terms: [{ text: '3', exact: true, note: 'counted beakers' }, t('2.45')], ops: ['*'] }
    expectCorrect(task, '7.35')
    const g = expectPattern(task, '7', 'sf_exact_limited')
    expect(g.pattern?.witness).toMatch(/counted beakers/)
    const conversion: SigFigTask = { kind: 'muldiv', terms: [t('254.6'), { text: '100', exact: true, note: 'defined: 100 cm = 1 m' }], ops: ['/'] }
    expectCorrect(conversion, '2.546')
    expectPattern(conversion, '3', 'sf_exact_limited')
  })
})

describe('named mistakes: rounding and writing the answer', () => {
  it('sf_unrounded: the calculator display', () => {
    expectPattern(div('12.50', '4.1'), '3.04878', 'sf_unrounded')
    expectPattern(div('12.50', '4.1'), '3.048780488', 'sf_unrounded')
    expectPattern(div('12.50', '4.1'), '3.0487804', 'sf_unrounded') // chopped display
    expectPattern(add('12.11', '18.0', '1.013'), '31.123', 'sf_unrounded')
    expectPattern(mul('2.5', '3.42'), '8.55', 'sf_unrounded')
    expectCorrect(mul('2.5', '3.42'), '8.6')
  })
  it('sf_truncated: chopped instead of rounded', () => {
    expectPattern(round('0.004567', 2), '0.0045', 'sf_truncated')
    expectPattern(round('1999', 2), '1900', 'sf_truncated')
    expectPattern(mul('2.4', '3.19'), '7.6', 'sf_truncated') // 7.656 → 7.7
    expectCorrect(mul('2.4', '3.19'), '7.7')
    // Rounding DOWN and chopping agree, so nothing to name.
    expectCorrect(round('12345', 2), '12000')
  })
  it('sf_dropped_zero: 2.5 for 2.50', () => {
    const task = mul('1.25', '2.00') // 2.5000 → 2.50
    expectCorrect(task, '2.50')
    expectPattern(task, '2.5', 'sf_dropped_zero')
    expectPattern(div('4.50', '1.50'), '3', 'sf_dropped_zero')
    expectCorrect(div('4.50', '1.50'), '3.00')
  })
  it('sf_extra_zeros: padding', () => {
    expectPattern(add('12.11', '18.0', '1.013'), '31.10', 'sf_extra_zeros')
    expectPattern(round('12345', 2), '12000.', 'sf_extra_zeros')
    expectPattern(round('12345', 2), '1.20e4', 'sf_extra_zeros')
    expectPattern(div('12.50', '4.1'), '3.00', 'sf_extra_zeros')
  })
  it('sf_ambiguous_zeros: a whole number hiding the intended figures', () => {
    const task = mul('25', '8.00') // 200 → 2.0 × 10²
    expectCorrect(task, '2.0e2')
    expectPattern(task, '200', 'sf_ambiguous_zeros')
    const three = mul('25.0', '8.00')
    expectCorrect(three, '200.')
    expectCorrect(three, '2.00e2')
    expectPattern(three, '200', 'sf_ambiguous_zeros')
  })
  it('sf_lost_placeholders: 12 for 12000', () => {
    expectPattern(round('12345', 2), '12', 'sf_lost_placeholders')
    expectPattern(round('12345', 2), '120', 'sf_lost_placeholders')
    expectPattern(round('186282', 3), '186', 'sf_lost_placeholders')
    expectCorrect(round('186282', 3), '186000')
    expectPlainWrong(round('12345', 2), '1.2', /power of ten/)
  })
})

describe('named mistakes: mixed operations', () => {
  const task: SigFigTask = {
    kind: 'mixed',
    operands: [{ terms: [t('11.07'), t('1.1')], ops: ['+'] }, t('2.115')],
    ops: ['*'],
  }
  it('sf_rounded_early: rounding the intermediate first', () => {
    // 12.17 × 2.115 = 25.73955 → 25.7, but 12.2 × 2.115 = 25.803 → 25.8
    expectCorrect(task, '25.7')
    const g = expectPattern(task, '25.8', 'sf_rounded_early')
    expect(g.pattern?.witness).toMatch(/12\.2/)
  })
  it('sf_muldiv_rule_on_addsub inside the group', () => {
    // She gives the sum 2 figures (like 1.1) instead of 3 (tenths place): 26.
    expectPattern(task, '26', 'sf_muldiv_rule_on_addsub')
  })
  it('sf_rounded_early on a plain chain', () => {
    const chain: SigFigTask = { kind: 'muldiv', terms: [t('2.4'), t('3.19'), t('1.277')], ops: ['*', '*'] }
    // exact 9.776712 → 9.8; stepwise 7.7 × 1.277 = 9.8329 → 9.8: no difference, so no candidate.
    expectCorrect(chain, '9.8')
    expect(sigFigMistakeCandidates(chain).some((c) => c.id === 'sf_rounded_early')).toBe(false)
    const drift: SigFigTask = { kind: 'muldiv', terms: [t('1.4'), t('1.11'), t('6.111')], ops: ['*', '*'] }
    // exact 9.4964… → 9.5; stepwise 1.554 → 1.6, 1.6 × 6.111 = 9.7776 → 9.8
    expectCorrect(drift, '9.5')
    expectPattern(drift, '9.8', 'sf_rounded_early')
  })
  it('intermediate precision question', () => {
    expect(gradeSigFigIntermediate(task, 0, { sigFigs: 3 }).status).toBe('correct')
    expect(gradeSigFigIntermediate(task, 0, { place: -1 }).status).toBe('correct')
    expect(gradeSigFigIntermediate(task, 0, { sigFigs: 2 }).pattern?.id).toBe('sf_muldiv_rule_on_addsub')
    expect(gradeSigFigIntermediate(task, 0, { place: -2 }).pattern?.id).toBe('sf_most_precise')
    const plain = gradeSigFigIntermediate(task, 0, { sigFigs: 5 })
    expect(plain.status).toBe('wrong')
    expect(plain.pattern).toBeUndefined()
    expect(gradeSigFigIntermediate(task, 0, {}).status).toBe('parse_error')
    expect(() => gradeSigFigIntermediate(task, 1, { sigFigs: 3 })).toThrow()

    const product: SigFigTask = { kind: 'mixed', operands: [{ terms: [t('2.51'), t('3.42')], ops: ['*'] }, t('1.113')], ops: ['-'] }
    expect(gradeSigFigIntermediate(product, 0, { sigFigs: 3 }).status).toBe('correct')
    expect(gradeSigFigIntermediate(product, 0, { place: -2 }).status).toBe('correct')
    // 2.51 × 34.257 = 85.98507 → three figures → 86.0, good to the tenths place.
    const lopsided: SigFigTask = { kind: 'mixed', operands: [{ terms: [t('2.51'), t('34.257')], ops: ['*'] }, t('1.1138')], ops: ['-'] }
    expect(gradeSigFigIntermediate(lopsided, 0, { sigFigs: 3 }).status).toBe('correct')
    expect(gradeSigFigIntermediate(lopsided, 0, { place: -1 }).status).toBe('correct')
    expect(gradeSigFigIntermediate(lopsided, 0, { sigFigs: 5 }).pattern?.id).toBe('sf_most_precise')
    expect(gradeSigFigIntermediate(lopsided, 0, { place: -2 }).pattern?.id).toBe('sf_addsub_rule_on_muldiv')
  })
})

describe('named mistakes: scientific notation', () => {
  const toSci: SigFigTask = { kind: 'convert', text: '0.00450', to: 'scientific' }
  const toStd: SigFigTask = { kind: 'convert', text: '6.020e-4', to: 'standard' }
  it('right answers in any spelling', () => {
    for (const a of ['4.50e-3', '4.50 x 10^-3', '4.50×10^−3', '4.50 × 10⁻³', '4.50*10^(-3)']) expectCorrect(toSci, a)
    expectCorrect(toStd, '0.0006020')
    expectCorrect(toStd, '.0006020')
  })
  it('sf_sci_changed_figures', () => {
    expectPattern(toSci, '4.5e-3', 'sf_sci_changed_figures')
    expectPattern(toSci, '4.500e-3', 'sf_sci_changed_figures')
    expectPattern(toStd, '0.000602', 'sf_sci_changed_figures')
    expectPattern({ kind: 'convert', text: '1200', to: 'scientific' }, '1.200e3', 'sf_sci_changed_figures')
    expectCorrect({ kind: 'convert', text: '1200', to: 'scientific' }, '1.2e3')
  })
  it('sf_sci_exponent', () => {
    expectPattern(toSci, '4.50e3', 'sf_sci_exponent')
    expectPattern(toSci, '4.50e-2', 'sf_sci_exponent')
    expectPattern(toStd, '6020', 'sf_sci_exponent')
  })
  it('sf_sci_form', () => {
    expectPattern(toSci, '45.0e-4', 'sf_sci_form')
    expectPattern(toSci, '0.450e-2', 'sf_sci_form')
  })
  it('plain messages: right number in the wrong notation, or changed digits', () => {
    expectPlainWrong(toSci, '0.00450', /scientific notation yet/)
    expectPlainWrong(toStd, '6.020e-4', /still scientific notation/)
    expectPlainWrong(toSci, '4.05e-3', /digits changed/)
  })
})

describe('a wrong answer that matches no named mistake', () => {
  it('says the digits are off and carries no pattern id', () => {
    expectPlainWrong(div('12.50', '4.1'), '3.2', /recheck the arithmetic/)
    expectPlainWrong(div('12.50', '4.1'), '51', /recheck the arithmetic/)
    expectPlainWrong(round('0.004567', 2), '0.0047', /first nonzero digit/)
    expectPlainWrong(add('12.11', '18.0', '1.013'), '0', /recheck the arithmetic/)
  })
  it('right arithmetic, wrong number of figures, no rule to blame', () => {
    const task: SigFigTask = { kind: 'muldiv', terms: [t('2.4'), t('3.4217'), t('1.10')], ops: ['*', '/'] }
    // 7.4655… → 7.5 ; most precise would be 5 figures, places-not-figures 7.47
    expectCorrect(task, '7.5')
    expectPlainWrong(task, '7.466', /more digits than the measurements support/)
    expectPlainWrong(task, '7', /rounded away a digit/)
  })
})

describe('gradeSigFigTaps', () => {
  const indexOf = (text: string, wanted: (role: string, ch: string) => boolean): number[] => {
    const parsed = parseSigFigNumeral(text)
    if (!parsed.ok) throw new Error('bad numeral')
    return parsed.numeral.chars.filter((c) => c.digit && wanted(c.role, c.ch)).map((c) => c.index)
  }
  it('all the right digits', () => {
    const g = gradeSigFigTaps('0.00450', [4, 5, 6])
    expect(g.correct).toBe(true)
    expect(g.sigFigs).toBe(3)
    expect(g.selectedCount).toBe(3)
    expect(g.patterns).toEqual([])
    expect(g.digits).toHaveLength(6)
    expect(g.digits.every((d) => d.ok)).toBe(true)
  })
  it('per-character feedback with the rule for each wrong character', () => {
    const g = gradeSigFigTaps('0.00450', [2, 3, 4, 5])
    expect(g.correct).toBe(false)
    const wrong = g.digits.filter((d) => !d.ok)
    expect(wrong.map((d) => [d.index, d.selected, d.patternId])).toEqual([
      [2, true, 'sf_leading_zeros'],
      [3, true, 'sf_leading_zeros'],
      [6, false, 'sf_trailing_zeros_decimal'],
    ])
    expect(wrong[0].rule).toMatch(/Leading zeros/)
    expect(wrong[2].rule).toMatch(/decimal point/)
    expect(g.patterns.map((p) => p.id)).toEqual(['sf_leading_zeros', 'sf_trailing_zeros_decimal'])
    expect(g.patterns[0].witness).toMatch(/2 zeros/)
    expect(g.message).toBe(g.patterns[0].witness)
  })
  it('each zero mistake', () => {
    expect(gradeSigFigTaps('1200', [0, 1, 2, 3]).patterns.map((p) => p.id)).toEqual(['sf_placeholder_zeros'])
    expect(gradeSigFigTaps('5002', [0, 3]).patterns.map((p) => p.id)).toEqual(['sf_captive_zero'])
    expect(gradeSigFigTaps('1200.', [0, 1]).patterns.map((p) => p.id)).toEqual(['sf_trailing_zeros_decimal'])
    expect(gradeSigFigTaps('1200.', [0, 1, 2, 3]).correct).toBe(true)
    expect(gradeSigFigTaps('1200', [0, 1]).correct).toBe(true)
  })
  it('a skipped nonzero digit has no pattern, only the rule', () => {
    const g = gradeSigFigTaps('5002', [1, 2, 3])
    expect(g.correct).toBe(false)
    expect(g.patterns).toEqual([])
    expect(g.digits[0]).toMatchObject({ ok: false, selected: false, significant: true })
    expect(g.digits[0].patternId).toBeUndefined()
    expect(g.message).toMatch(/nonzero/)
  })
  it('ignores taps on the sign, the point and the power of ten', () => {
    const text = '-3.00 x 10^8'
    const digits = indexOf(text, () => true)
    expect(digits).toEqual([1, 3, 4])
    expect(gradeSigFigTaps(text, [0, 1, 2, 3, 4, 8, 9, 11]).correct).toBe(true)
  })
})

describe('sigFigMistakeCandidates', () => {
  it('lists realistic wrong answers with the id the grader gives them', () => {
    const c = sigFigMistakeCandidates(round('1999', 2))
    expect(c.map((x) => [x.text, x.id])).toEqual(
      expect.arrayContaining([
        ['2000', 'sf_ambiguous_zeros'],
        ['1900', 'sf_truncated'],
        ['20', 'sf_lost_placeholders'],
      ]),
    )
    for (const x of c) expect(gradeSigFigAnswer(round('1999', 2), x.text).pattern?.id).toBe(x.id)
  })
  it('never lists the right answer', () => {
    const tasks: SigFigTask[] = [div('12.50', '4.1'), mul('3.20', '1.5'), add('12.11', '18.0', '1.013'), sub('5.26', '5.21'), count('0.00450')]
    for (const task of tasks) {
      const e = evaluateSigFigTask(task)
      const texts = sigFigMistakeCandidates(task).map((x) => x.text)
      expect(texts).not.toContain(e.expected.text)
      for (const a of e.expected.alternates) expect(texts).not.toContain(a)
    }
  })
})

describe('catalog', () => {
  it('has warm, complete coaching for every sf_ id', () => {
    const ids = (Object.keys(ERROR_PATTERNS) as ErrorPatternId[]).filter((id) => id.startsWith('sf_'))
    expect(ids.length).toBeGreaterThanOrEqual(15)
    for (const id of ids) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length).toBeGreaterThan(5)
      expect(info.lesson.length).toBeGreaterThan(30)
      expect(info.example).toMatch(/→/)
    }
  })
})

describe('fuzz fixes: every spelling the engine offers is accepted when typed back', () => {
  it('round 1e-30 to 1 s.f.: the 31-digit standard alternate is a right answer, not a parse error', () => {
    const task = round('1e-30', 1)
    const e = evaluateSigFigTask(task)
    expect(e.expected.alternates).toEqual(['0.000000000000000000000000000001'])
    for (const text of [e.expected.text, ...e.expected.alternates]) expectCorrect(task, text)
  })
  it('6.022e23 × 2.0e8: the 33-digit standard alternate is accepted too', () => {
    const task = mul('6.022e23', '2.0e8')
    const e = evaluateSigFigTask(task)
    expect(e.expected.text).toBe('1.2 x 10^32')
    for (const text of [e.expected.text, ...e.expected.alternates]) expectCorrect(task, text)
    // and the whole 33-digit calculator value is still named as such
    expectPattern(task, e.unrounded, 'sf_unrounded')
  })
})
