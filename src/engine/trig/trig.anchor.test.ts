/**
 * Hand-worked textbook examples, each worked out by hand in the comment and then graded through the core: the
 * right answer is right in the spellings she would use, and the slip in the comment is named.
 */
import { describe, expect, it } from 'vitest'
import { placeWords } from './angle'
import { exactText } from './exact'
import { gradeTrigAnswer, type TrigCandidate, type TrigSpec } from './grade'
import { q } from './rational'
import {
  arcAnswer,
  arcSlips,
  conversionDecimalAnswer,
  conversionDecimalSlips,
  conversionSlips,
  coterminalAnswer,
  coterminalSlips,
  placeAnswer,
  placeSlips,
  pointAnswer,
  pointSlips,
  rAnswer,
  referenceAnswer,
  referenceSlips,
  rSlips,
  valueAnswer,
  valueSlips,
} from './slips'
import { valueText, type TrigFn } from './values'

function grade(spec: TrigSpec, cands: TrigCandidate[], right: string[], slips: [string, string][]) {
  for (const t of right) expect(gradeTrigAnswer(spec, t, cands).verdict, `“${t}” is right`).toBe('correct')
  for (const [t, id] of slips) {
    const g = gradeTrigAnswer(spec, t, cands)
    expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `“${t}”`).toBe(id)
  }
}

describe('hand-worked: degrees and radians', () => {
  it('150° = 150·π/180 = 5π/6; with 180/π it would be 27000/π', () => {
    expect(exactText(coterminalAnswer(q(150), 'rad'))).toBe('5π/6')
    grade({ kind: 'angle', unit: 'rad', deg: q(150) }, conversionSlips(q(150), 'rad'), ['5π/6', '5pi/6', '(5/6)π'], [
      ['27000/π', 'trig_conversion_inverted'],
      ['5/6', 'trig_pi_dropped'],
    ])
  })

  it('72° = 72π/180 = 2π/5', () => {
    grade({ kind: 'angle', unit: 'rad', deg: q(72) }, conversionSlips(q(72), 'rad'), ['2π/5', '2pi/5', '0.4π'], [['2/5', 'trig_pi_dropped']])
  })

  it('−7π/4 = −7·180/4 = −315°', () => {
    grade({ kind: 'angle', unit: 'deg', deg: q(-315) }, conversionSlips(q(-315), 'deg'), ['-315', '−315°', '-315 degrees'], [['-315π', 'trig_pi_kept']])
  })

  it('11π/6 = 330°; π²/216·11 is the factor upside down', () => {
    grade({ kind: 'angle', unit: 'deg', deg: q(330) }, conversionSlips(q(330), 'deg'), ['330', '330°'], [['11π^2/1080', 'trig_conversion_inverted']])
  })

  it('2.5 radians = 2.5·180/π ≈ 143.2°; 2.5·180 = 450 leaves out π', () => {
    const v = conversionDecimalAnswer(2.5, 'rad')
    expect(v).toBeCloseTo(143.2394, 4)
    grade({ kind: 'decimal', value: v, places: 1, unit: 'deg' }, conversionDecimalSlips(2.5, 'rad', '2.5'), ['143.2', '143.2°', '143.24'], [['450', 'trig_pi_dropped']])
  })

  it('40° = 40π/180 ≈ 0.70 radians; 40/180 ≈ 0.22 leaves out π', () => {
    grade({ kind: 'decimal', value: conversionDecimalAnswer(40, 'deg'), places: 2, unit: 'rad' }, conversionDecimalSlips(40, 'deg', '40'), ['0.70', '.70', '0.698'], [['0.22', 'trig_pi_dropped']])
  })
})

describe('hand-worked: coterminal angles and quadrants', () => {
  it('−510° + 2·360° = 210°; three half turns give 30°; one turn gives −150°', () => {
    expect(exactText(coterminalAnswer(q(-510), 'deg'))).toBe('210')
    grade({ kind: 'angle', unit: 'deg', deg: q(210) }, coterminalSlips(q(-510), 'deg'), ['210', '210°'], [
      ['30', 'trig_coterminal_half_turn'],
      ['-150', 'trig_coterminal_short'],
      ['150', 'trig_negative_direction'],
    ])
  })

  it('23π/6 − 2π = 11π/6', () => {
    expect(exactText(coterminalAnswer(q(690), 'rad'))).toBe('11π/6')
    grade({ kind: 'angle', unit: 'rad', deg: q(330) }, coterminalSlips(q(690), 'rad'), ['11π/6', '11pi/6'], [['11/6', 'trig_pi_dropped']])
  })

  it('−11π/4 + 4π = 5π/4; adding 2π once leaves −3π/4', () => {
    expect(exactText(coterminalAnswer(q(-495), 'rad'))).toBe('5π/4')
    grade({ kind: 'angle', unit: 'rad', deg: q(225) }, coterminalSlips(q(-495), 'rad'), ['5π/4'], [['-3π/4', 'trig_coterminal_short']])
  })

  it('845° − 720° = 125°, in Quadrant II', () => {
    expect(exactText(coterminalAnswer(q(845), 'deg'))).toBe('125')
    expect(placeWords(placeAnswer(q(845)))).toBe('Quadrant II')
  })

  it('−120° turns clockwise into Quadrant III (counterclockwise it would be in II)', () => {
    expect(placeWords(placeAnswer(q(-120)))).toBe('Quadrant III')
    expect(placeSlips(q(-120), 'deg').map((s) => placeWords(s.place))).toContain('Quadrant II')
  })
})

describe('hand-worked: reference angles', () => {
  it('7π/6 is in Quadrant III: 7π/6 − π = π/6', () => {
    expect(exactText(referenceAnswer(q(210), 'rad')!)).toBe('π/6')
    grade({ kind: 'angle', unit: 'rad', deg: q(30) }, referenceSlips(q(210), 'rad'), ['π/6', 'pi/6'], [
      ['π/3', 'trig_reference_from_y_axis'],
      ['-π/6', 'trig_reference_wrong_way'],
    ])
  })

  it('300° is in Quadrant IV: 360° − 300° = 60°; 300° − 180° = 120° is the Quadrant III rule', () => {
    expect(exactText(referenceAnswer(q(300), 'deg')!)).toBe('60')
    grade({ kind: 'angle', unit: 'deg', deg: q(60) }, referenceSlips(q(300), 'deg'), ['60', '60°'], [
      ['120', 'trig_reference_wrong_way'],
      ['30', 'trig_reference_from_y_axis'],
      ['300', 'trig_reference_is_coterminal'],
    ])
  })

  it('−510° is coterminal with 210°: its reference angle is 30°', () => {
    expect(exactText(referenceAnswer(q(-510), 'deg')!)).toBe('30')
  })
})

describe('hand-worked: the six functions at special angles', () => {
  const at = (fn: TrigFn, d: number) => ({ spec: { kind: 'value', value: valueAnswer(fn, q(d))!, fn } as TrigSpec, cands: valueSlips(fn, q(d), 'deg') })

  it('sin(−225°): −225° + 360° = 135°, Quadrant II, reference 45°, sine positive: √2/2', () => {
    expect(valueText(valueAnswer('sin', q(-225))!)).toBe('√2/2')
    const { spec, cands } = at('sin', -225)
    grade(spec, cands, ['√2/2', 'sqrt(2)/2', '(1/2)√2'], [['-√2/2', 'trig_sign_quadrant']])
  })

  it('tan(3π/2): the point is (0, −1), y/x divides by zero: undefined', () => {
    expect(valueText(valueAnswer('tan', q(270))!)).toBe('undefined')
    const { spec, cands } = at('tan', 270)
    grade(spec, cands, ['undefined', 'DNE', 'does not exist'], [['0', 'trig_zero_for_undefined']])
  })

  it('cos 150° = −√3/2 (Quadrant II, reference 30°, cosine negative)', () => {
    const { spec, cands } = at('cos', 150)
    grade(spec, cands, ['-√3/2', '−sqrt(3)/2'], [
      ['√3/2', 'trig_sign_quadrant'],
      ['1/2', 'trig_sin_cos_swapped'],
    ])
  })

  it('csc 30° = 1/sin 30° = 2', () => {
    const { spec, cands } = at('csc', 30)
    grade(spec, cands, ['2', '2.0'], [['1/2', 'trig_reciprocal_missing']])
  })

  it('sec(−120°) = 1/cos(−120°) = 1/(−1/2) = −2', () => {
    const { spec, cands } = at('sec', -120)
    grade(spec, cands, ['-2'], [['2', 'trig_sign_quadrant']])
  })

  it('cot 90° = cos 90°/sin 90° = 0/1 = 0', () => {
    const { spec, cands } = at('cot', 90)
    grade(spec, cands, ['0'], [['undefined', 'trig_undefined_for_zero']])
  })

  it('tan 13π/6 = tan π/6 = √3/3; cot π/6 = √3 is the ratio upside down', () => {
    const { spec, cands } = at('tan', 390)
    grade(spec, cands, ['√3/3', 'sqrt(3)/3'], [['√3', 'trig_tan_inverted']])
  })
})

describe('hand-worked: a point on the terminal side', () => {
  it('(−3, 4): r = √(9 + 16) = 5, cos θ = −3/5; 25 is r², −3 leaves out r', () => {
    expect(valueText(rAnswer(-3, 4))).toBe('5')
    grade({ kind: 'value', value: rAnswer(-3, 4) }, rSlips(-3, 4), ['5', 'r = 5'], [['25', 'trig_r_not_rooted']])
    expect(valueText(pointAnswer('cos', -3, 4))).toBe('-3/5')
    grade({ kind: 'value', value: pointAnswer('cos', -3, 4), fn: 'cos' }, pointSlips('cos', -3, 4), ['-3/5', '-0.6', 'cos θ = -3/5'], [
      ['-3', 'trig_r_left_out'],
      ['3/5', 'trig_sign_quadrant'],
      ['4/5', 'trig_sin_cos_swapped'],
    ])
  })

  it('(−2, 3): r = √13, sin θ = 3/√13 = 3√13/13 (3/√13 itself is not simplest form)', () => {
    expect(valueText(rAnswer(-2, 3))).toBe('√13')
    const spec: TrigSpec = { kind: 'value', value: pointAnswer('sin', -2, 3), fn: 'sin' }
    const cands = pointSlips('sin', -2, 3)
    grade(spec, cands, ['3√13/13', '3sqrt(13)/13'], [['3', 'trig_r_left_out']])
    expect(gradeTrigAnswer(spec, '3/√13', cands)).toMatchObject({ verdict: 'invalid', reason: 'not_simplest' })
  })
})

describe('hand-worked: arc length and sector area', () => {
  it('a 6 cm radius and 2π/3: s = 6·2π/3 = 4π cm; ½·36·2π/3 = 12π is the area', () => {
    const p = { r: 6, theta: { kind: 'rad', deg: q(120) }, what: 'arc' } as const
    expect(exactText(arcAnswer(p))).toBe('4π')
    grade({ kind: 'value', value: arcAnswer(p), units: ['cm'] }, arcSlips(p), ['4π', '4π cm', '4pi'], [['12π', 'trig_arc_sector_swapped']])
  })

  it('a pendulum 24 in through 40°: 40° = 2π/9, s = 24·2π/9 = 16π/3 ≈ 16.8 in; 24·40 = 960 uses degrees', () => {
    const p = { r: 24, theta: { kind: 'deg', deg: q(40) }, what: 'arc' } as const
    expect(exactText(arcAnswer(p))).toBe('16π/3')
    grade({ kind: 'decimal', value: (16 * Math.PI) / 3, places: 1, units: ['in', 'inches'] }, arcSlips(p).map((s) => ({ ...s, value: s.value === 'undefined' ? 0 : Number(exactValue(s.value)) })), ['16.8', '16.8 in', '16.76'], [['960', 'trig_arc_degrees']])
  })

  it('a sprinkler 15 ft through 120°: A = ½·225·2π/3 = 75π ≈ 235.6 ft²', () => {
    const p = { r: 15, theta: { kind: 'deg', deg: q(120) }, what: 'area' } as const
    expect(exactText(arcAnswer(p))).toBe('75π')
    grade({ kind: 'value', value: arcAnswer(p), units: ['ft²', 'square feet', 'sq ft'] }, arcSlips(p), ['75π', '75π square feet', '75pi ft²'], [
      ['150π', 'trig_sector_no_half'],
      ['5π', 'trig_sector_r_not_squared'],
    ])
  })

  it('a pizza slice, radius 8 in, 45°: ½·64·π/4 = 8π in²', () => {
    expect(exactText(arcAnswer({ r: 8, theta: { kind: 'deg', deg: q(45) }, what: 'area' }))).toBe('8π')
  })
})

function exactValue(v: Exclude<ReturnType<typeof arcAnswer>, never>): number {
  return (v.c.n / v.c.d) * Math.sqrt(v.root) * Math.PI ** v.pi
}
