import { describe, expect, it } from 'vitest'
import { gradeTrigAnswer, type TrigCandidate, type TrigGrade, type TrigSpec } from './grade'
import { q } from './rational'
import { conversionDecimalAnswer, conversionDecimalSlips, conversionSlips, coterminalSlips, referenceSlips, valueSlips } from './slips'
import { trigValue } from './values'

const verdict = (g: TrigGrade) => (g.verdict === 'mistake' ? `mistake:${g.mistake}` : g.verdict === 'invalid' ? `invalid:${g.reason}` : g.verdict)

describe('an exact angle', () => {
  const toRad: TrigSpec = { kind: 'angle', unit: 'rad', deg: q(150) }
  const cands: TrigCandidate[] = conversionSlips(q(150), 'rad')

  it('every spelling of 5π/6 is right', () => {
    for (const t of ['5π/6', '5pi/6', '(5/6)π', '5/6π', '5π/6 radians', '5π/6 rad']) expect(verdict(gradeTrigAnswer(toRad, t, cands)), t).toBe('correct')
  })

  it('the named slips', () => {
    expect(verdict(gradeTrigAnswer(toRad, '5/6', cands))).toBe('mistake:trig_pi_dropped')
    expect(verdict(gradeTrigAnswer(toRad, '27000/π', cands))).toBe('mistake:trig_conversion_inverted')
    expect(verdict(gradeTrigAnswer(toRad, '150*180/pi', cands))).toBe('mistake:trig_conversion_inverted')
  })

  it('the angle in degrees, or a decimal, is a note, not an attempt', () => {
    expect(verdict(gradeTrigAnswer(toRad, '150°', cands))).toBe('invalid:wrong_unit')
    expect(verdict(gradeTrigAnswer(toRad, '150', cands))).toBe('invalid:wrong_unit')
    expect(verdict(gradeTrigAnswer(toRad, '2.618', cands))).toBe('invalid:not_exact')
    expect(verdict(gradeTrigAnswer(toRad, '2.62', cands))).toBe('invalid:not_exact')
    const note = gradeTrigAnswer(toRad, '2.618', cands)
    expect(note.verdict === 'invalid' && note.message).not.toMatch(/5π\/6/)
  })

  it('a wrong angle is wrong, and a sum of turns is not one number yet', () => {
    expect(verdict(gradeTrigAnswer(toRad, '7π/6', cands))).toBe('wrong')
    expect(verdict(gradeTrigAnswer(toRad, 'π - π/6', cands))).toBe('invalid:not_simplest')
  })

  it('degrees: π kept, the factor upside down, the angle in radians', () => {
    const toDeg: TrigSpec = { kind: 'angle', unit: 'deg', deg: q(150) }
    const c = conversionSlips(q(150), 'deg')
    for (const t of ['150', '150°', '150 degrees', '150.0']) expect(verdict(gradeTrigAnswer(toDeg, t, c)), t).toBe('correct')
    expect(verdict(gradeTrigAnswer(toDeg, '150π', c))).toBe('mistake:trig_pi_kept')
    expect(verdict(gradeTrigAnswer(toDeg, 'π^2/216', c))).toBe('mistake:trig_conversion_inverted')
    expect(verdict(gradeTrigAnswer(toDeg, '5π/6', c))).toBe('invalid:wrong_unit')
    expect(verdict(gradeTrigAnswer(toDeg, '7π/6', c))).toBe('invalid:wrong_unit')
    expect(verdict(gradeTrigAnswer(toDeg, '160', c))).toBe('wrong')
  })

  it('coterminal and reference angles', () => {
    const cot: TrigSpec = { kind: 'angle', unit: 'deg', deg: q(210) }
    const c = coterminalSlips(q(-510), 'deg')
    expect(verdict(gradeTrigAnswer(cot, '210', c))).toBe('correct')
    expect(verdict(gradeTrigAnswer(cot, '30', c))).toBe('mistake:trig_coterminal_half_turn')
    expect(verdict(gradeTrigAnswer(cot, '-150', c))).toBe('mistake:trig_coterminal_short')
    expect(verdict(gradeTrigAnswer(cot, '150°', c))).toBe('mistake:trig_negative_direction')
    const ref: TrigSpec = { kind: 'angle', unit: 'rad', deg: q(30) }
    const r = referenceSlips(q(210), 'rad')
    expect(verdict(gradeTrigAnswer(ref, 'π/6', r))).toBe('correct')
    expect(verdict(gradeTrigAnswer(ref, 'pi/3', r))).toBe('mistake:trig_reference_from_y_axis')
    expect(verdict(gradeTrigAnswer(ref, '-π/6', r))).toBe('mistake:trig_reference_wrong_way')
    expect(verdict(gradeTrigAnswer(ref, '7π/6', r))).toBe('mistake:trig_reference_is_coterminal')
    expect(verdict(gradeTrigAnswer(ref, '1/6', r))).toBe('mistake:trig_pi_dropped')
    expect(verdict(gradeTrigAnswer(ref, '30°', r))).toBe('invalid:wrong_unit')
  })
})

describe('an exact value', () => {
  const spec = (fn: 'sin' | 'cos' | 'tan' | 'csc' | 'sec' | 'cot', d: number): [TrigSpec, TrigCandidate[]] => [
    { kind: 'value', value: trigValue(fn, q(d))!, fn },
    valueSlips(fn, q(d), 'deg'),
  ]

  it('every equal exact form is right', () => {
    const [s, c] = spec('cos', 30)
    for (const t of ['√3/2', 'sqrt(3)/2', '(√3)/2', '1/2√3', '(1/2)√3', 'cos θ = √3/2', '√3 / 2']) expect(verdict(gradeTrigAnswer(s, t, c)), t).toBe('correct')
    const [h, hc] = spec('sin', 30)
    for (const t of ['1/2', '0.5', '.5', '2/4']) expect(verdict(gradeTrigAnswer(h, t, hc)), t).toBe('correct')
  })

  it('an equal value not in simplest radical form is a note', () => {
    const [s, c] = spec('sin', 45)
    for (const t of ['1/√2', '√2/√4', '√8/4', '√(1/2)', '2√2/4']) expect(verdict(gradeTrigAnswer(s, t, c)), t).toBe('invalid:not_simplest')
    const [r, rc] = spec('cos', 30)
    expect(verdict(gradeTrigAnswer(r, '√12/4', rc))).toBe('invalid:not_simplest')
  })

  it('a calculator decimal is a note that does not give the value', () => {
    const [s, c] = spec('cos', 150)
    for (const t of ['-0.866', '-0.87', '-0.8660254']) {
      const g = gradeTrigAnswer(s, t, c)
      expect(verdict(g), t).toBe('invalid:not_exact')
      expect(g.verdict === 'invalid' && g.message).not.toMatch(/√3/)
    }
  })

  it('the named slips at a special angle', () => {
    const [s, c] = spec('cos', 150)
    expect(verdict(gradeTrigAnswer(s, '√3/2', c))).toBe('mistake:trig_sign_quadrant')
    expect(verdict(gradeTrigAnswer(s, '1/2', c))).toBe('mistake:trig_sin_cos_swapped')
    expect(verdict(gradeTrigAnswer(s, '-1/2', c))).toBe('wrong')
    const [t, tc] = spec('tan', 90)
    expect(verdict(gradeTrigAnswer(t, 'undefined', tc))).toBe('correct')
    expect(verdict(gradeTrigAnswer(t, 'DNE', tc))).toBe('correct')
    expect(verdict(gradeTrigAnswer(t, '0', tc))).toBe('mistake:trig_zero_for_undefined')
    expect(verdict(gradeTrigAnswer(t, '1', tc))).toBe('wrong')
    const [k, kc] = spec('cot', 90)
    expect(verdict(gradeTrigAnswer(k, '0', kc))).toBe('correct')
    expect(verdict(gradeTrigAnswer(k, 'undefined', kc))).toBe('mistake:trig_undefined_for_zero')
    const [cs, csc] = spec('csc', 30)
    expect(verdict(gradeTrigAnswer(cs, '2', csc))).toBe('correct')
    expect(verdict(gradeTrigAnswer(cs, '1/2', csc))).toBe('mistake:trig_reciprocal_missing')
    expect(verdict(gradeTrigAnswer(cs, '2/√3', csc))).toBe('mistake:trig_reciprocal_mixed')
  })

  it('a box labelled with another function, and a degree sign on a value, are notes', () => {
    const [s, c] = spec('sin', 30)
    expect(verdict(gradeTrigAnswer(s, 'cos θ = 1/2', c))).toBe('invalid:wrong_label')
    expect(verdict(gradeTrigAnswer(s, '1/2°', c))).toBe('invalid:wrong_unit')
    expect(verdict(gradeTrigAnswer(s, 'sin(30°)', c))).toBe('invalid:unreadable')
  })
})

describe('a rounded number', () => {
  const value = conversionDecimalAnswer(2.5, 'rad')
  const spec: TrigSpec = { kind: 'decimal', value, places: 1, unit: 'deg' }
  const cands = conversionDecimalSlips(2.5, 'rad', '2.5')

  it('every correctly rounded decimal is right, more places too', () => {
    for (const t of ['143.2', '143.2°', '143.24', '143.239', '143.2 degrees']) expect(verdict(gradeTrigAnswer(spec, t, cands)), t).toBe('correct')
  })

  it('rounded too far, the exact form, the wrong unit', () => {
    expect(verdict(gradeTrigAnswer(spec, '143', cands))).toBe('invalid:not_rounded')
    expect(verdict(gradeTrigAnswer(spec, '450/π', cands))).toBe('invalid:not_decimal')
    expect(verdict(gradeTrigAnswer(spec, '143.2 rad', cands))).toBe('invalid:wrong_unit')
  })

  it('the slips at the rounding asked, or at her own places', () => {
    expect(verdict(gradeTrigAnswer(spec, '450', cands))).toBe('mistake:trig_pi_dropped')
    expect(verdict(gradeTrigAnswer(spec, '0.04', cands))).toBe('mistake:trig_conversion_inverted')
    expect(verdict(gradeTrigAnswer(spec, '0.0436', cands))).toBe('mistake:trig_conversion_inverted')
    expect(verdict(gradeTrigAnswer(spec, '143.3', cands))).toBe('wrong')
  })

  it('radians to two places: 40° is 0.70', () => {
    const s: TrigSpec = { kind: 'decimal', value: conversionDecimalAnswer(40, 'deg'), places: 2, unit: 'rad' }
    const c = conversionDecimalSlips(40, 'deg', '40')
    expect(verdict(gradeTrigAnswer(s, '0.70', c))).toBe('correct')
    expect(verdict(gradeTrigAnswer(s, '.698', c))).toBe('correct')
    // 0.7 is the number 0.70: within half a hundredth of 0.698, so it is right.
    expect(verdict(gradeTrigAnswer(s, '0.7', c))).toBe('correct')
    expect(verdict(gradeTrigAnswer(s, '1', c))).toBe('invalid:not_rounded')
    expect(verdict(gradeTrigAnswer(s, '0.70°', c))).toBe('invalid:wrong_unit')
    expect(verdict(gradeTrigAnswer(s, '2291.83', c))).toBe('mistake:trig_conversion_inverted')
    expect(verdict(gradeTrigAnswer(s, '0.22', c))).toBe('mistake:trig_pi_dropped')
  })
})
