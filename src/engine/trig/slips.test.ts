import { describe, expect, it } from 'vitest'
import { placeWords } from './angle'
import { exactNum } from './exact'
import { q } from './rational'
import {
  arcAnswer,
  arcSlips,
  conversionDecimalAnswer,
  conversionDecimalSlips,
  conversionSlips,
  coterminalAnswer,
  coterminalSlips,
  placeSlips,
  pointSlips,
  referenceAnswer,
  referenceSlips,
  rSlips,
  valueSlips,
  type TrigSlip,
} from './slips'
import { trigValue, valueText, type TrigValue } from './values'

const table = (slips: TrigSlip[]) => Object.fromEntries(slips.map((s) => [s.id, valueText(s.value)]))
const text = (v: TrigValue) => valueText(v)

describe('conversion slips', () => {
  it('150° to radians: π/180 upside down, and π dropped', () => {
    expect(table(conversionSlips(q(150), 'rad'))).toEqual({ trig_conversion_inverted: '27000/π', trig_pi_dropped: '5/6' })
  })

  it('5π/6 to degrees: π kept, and the factor upside down', () => {
    expect(table(conversionSlips(q(150), 'deg'))).toEqual({ trig_pi_kept: '150π', trig_conversion_inverted: 'π^2/216' })
  })

  it('decimals: 2.5 radians to degrees, 40° to radians', () => {
    expect(conversionDecimalAnswer(2.5, 'rad')).toBeCloseTo(143.239, 3)
    const rad = Object.fromEntries(conversionDecimalSlips(2.5, 'rad', '2.5').map((s) => [s.id, s.value]))
    expect(rad.trig_conversion_inverted).toBeCloseTo(0.0436, 4)
    expect(rad.trig_pi_dropped).toBe(450)
    const deg = Object.fromEntries(conversionDecimalSlips(40, 'deg', '40').map((s) => [s.id, s.value]))
    expect(deg.trig_conversion_inverted).toBeCloseTo(2291.83, 2)
    expect(deg.trig_pi_dropped).toBeCloseTo(0.2222, 4)
  })
})

describe('coterminal slips', () => {
  it('−510°: half turns give 30°, one turn short is −150°, the other direction gives 150°', () => {
    expect(text(coterminalAnswer(q(-510), 'deg'))).toBe('210')
    expect(table(coterminalSlips(q(-510), 'deg'))).toEqual({ trig_coterminal_half_turn: '30', trig_coterminal_short: '-150', trig_negative_direction: '150' })
  })

  it('23π/6: two half turns are one turn and one turn is enough, so only π dropped is left', () => {
    expect(text(coterminalAnswer(q(690), 'rad'))).toBe('11π/6')
    expect(table(coterminalSlips(q(690), 'rad'))).toEqual({ trig_pi_dropped: '11/6' })
  })

  it('−11π/4 is coterminal with 5π/4', () => {
    expect(text(coterminalAnswer(q(-495), 'rad'))).toBe('5π/4')
    expect(table(coterminalSlips(q(-495), 'rad'))).toEqual({
      trig_coterminal_half_turn: 'π/4',
      trig_coterminal_short: '-3π/4',
      trig_negative_direction: '3π/4',
      trig_pi_dropped: '5/4',
    })
  })

  it('a slip that lands on the right answer, or on the angle itself, is left out (600°)', () => {
    expect(coterminalSlips(q(600), 'deg').map((s) => s.id)).toEqual([])
    expect(table(coterminalSlips(q(510), 'deg'))).toEqual({ trig_coterminal_half_turn: '330' })
  })
})

describe('quadrant slips', () => {
  it('−120° is in Quadrant III; turned counterclockwise it would be in II, and a half turn added puts it in I', () => {
    const s = placeSlips(q(-120), 'deg')
    expect(s.map((x) => [x.id, placeWords(x.place)])).toEqual([
      ['trig_negative_direction', 'Quadrant II'],
      ['trig_coterminal_half_turn', 'Quadrant I'],
    ])
  })

  it('510° is in Quadrant II; half turns put it in IV', () => {
    expect(placeSlips(q(510), 'deg').map((x) => [x.id, placeWords(x.place)])).toEqual([['trig_coterminal_half_turn', 'Quadrant IV']])
  })
})

describe('reference-angle slips', () => {
  it('210°: from the y-axis 60°, the wrong way −30°, the angle itself', () => {
    expect(text(referenceAnswer(q(210), 'deg')!)).toBe('30')
    expect(table(referenceSlips(q(210), 'deg'))).toEqual({ trig_reference_from_y_axis: '60', trig_reference_wrong_way: '-30', trig_reference_is_coterminal: '210' })
  })

  it('300°: the Quadrant III rule gives 120°', () => {
    const s = referenceSlips(q(300), 'deg')
    expect(s.filter((x) => x.id === 'trig_reference_wrong_way').map((x) => text(x.value))).toEqual(['-120', '120'])
  })

  it('7π/6 in radians: π/6, and the slips in radians', () => {
    expect(text(referenceAnswer(q(210), 'rad')!)).toBe('π/6')
    expect(table(referenceSlips(q(210), 'rad'))).toEqual({
      trig_reference_from_y_axis: 'π/3',
      trig_reference_wrong_way: '-π/6',
      trig_reference_is_coterminal: '7π/6',
      trig_pi_dropped: '1/6',
    })
  })

  it('45°: from the y-axis is the same 45°, so that slip is left out', () => {
    expect(referenceSlips(q(45), 'deg').map((s) => s.id)).toEqual([])
    expect(referenceSlips(q(270), 'deg')).toEqual([])
  })
})

describe('value slips at a special angle', () => {
  it('cos 150°: the sign, and sin in its place', () => {
    expect(table(valueSlips('cos', q(150), 'deg'))).toEqual({ trig_sign_quadrant: '√3/2', trig_sin_cos_swapped: '1/2' })
  })

  it('sin(−225°) = √2/2: the sign; cos is the same as sin here; turned the other way is the sign again', () => {
    expect(table(valueSlips('sin', q(-225), 'deg'))).toEqual({ trig_sign_quadrant: '-√2/2' })
  })

  it('tan(3π/2) does not exist: zero is named; cot there is zero too (a shadow)', () => {
    expect(table(valueSlips('tan', q(270), 'rad'))).toEqual({ trig_zero_for_undefined: '0' })
  })

  it('cot 90° is zero: "undefined" is named', () => {
    expect(table(valueSlips('cot', q(90), 'deg'))).toEqual({ trig_undefined_for_zero: 'undefined' })
  })

  it('csc 30°: sin itself, and one over cos', () => {
    expect(table(valueSlips('csc', q(30), 'deg'))).toEqual({ trig_sign_quadrant: '-2', trig_reciprocal_missing: '1/2', trig_reciprocal_mixed: '2√3/3' })
  })

  it('sec 90° does not exist: zero first (cos 90° is a shadow), then csc', () => {
    expect(table(valueSlips('sec', q(90), 'deg'))).toEqual({ trig_zero_for_undefined: '0', trig_reciprocal_mixed: '1' })
  })

  it('sentences never state the right value', () => {
    // The answer as a whole token: not inside a longer number, not right after a letter or a slash.
    const shows = (sentence: string, answer: string) => {
      const tight = sentence.replace(/\s+/g, '').replace(/−/g, '-')
      const esc = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?<![\\d./A-Za-z_])${esc}(?![\\d/A-Za-z])`).test(tight)
    }
    for (const fn of ['sin', 'cos', 'tan', 'csc', 'sec', 'cot'] as const) {
      for (let d = -360; d <= 720; d += 15) {
        if (d % 30 !== 0 && d % 45 !== 0) continue
        const answer = valueText(trigValue(fn, q(d))!)
        // sin 0° = 0: the angle itself shows the digit, so that problem is never shown (the generators check the prompt).
        if (shows(`${d}°`, answer)) continue
        for (const s of valueSlips(fn, q(d), 'deg')) expect(shows(s.witness, answer), `${fn}(${d}°) ${s.id}: ${s.witness}`).toBe(false)
      }
    }
  })
})

describe('slips for a point on the terminal side', () => {
  it('(−3, 4): r squared, and each function’s slips', () => {
    expect(table(rSlips(-3, 4))).toEqual({ trig_r_not_rooted: '25' })
    expect(table(pointSlips('cos', -3, 4))).toEqual({ trig_sign_quadrant: '3/5', trig_r_left_out: '-3', trig_sin_cos_swapped: '4/5' })
    expect(table(pointSlips('tan', -3, 4))).toEqual({ trig_sign_quadrant: '4/3', trig_tan_inverted: '-3/4' })
    expect(table(pointSlips('csc', -3, 4))).toEqual({ trig_sign_quadrant: '-5/4', trig_reciprocal_missing: '4/5', trig_reciprocal_mixed: '-5/3', trig_r_left_out: '1/4' })
  })

  it('(−2, 3): r = √13, and the slips stay exact', () => {
    expect(table(rSlips(-2, 3))).toEqual({ trig_r_not_rooted: '13' })
    expect(table(pointSlips('sin', -2, 3))).toEqual({ trig_sign_quadrant: '-3√13/13', trig_r_left_out: '3', trig_sin_cos_swapped: '-2√13/13' })
  })
})

describe('arc length and sector area', () => {
  it('a 6 cm radius and 2π/3: an arc of 4π cm', () => {
    const p = { r: 6, theta: { kind: 'rad', deg: q(120) }, what: 'arc' } as const
    expect(text(arcAnswer(p))).toBe('4π')
    expect(table(arcSlips(p))).toEqual({ trig_arc_sector_swapped: '12π', trig_pi_dropped: '4' })
  })

  it('a pendulum 24 inches long through 40°: 16π/3 inches, and 960 with degrees', () => {
    const p = { r: 24, theta: { kind: 'deg', deg: q(40) }, what: 'arc' } as const
    expect(text(arcAnswer(p))).toBe('16π/3')
    expect(exactNum(arcAnswer(p))).toBeCloseTo(16.755, 3)
    expect(table(arcSlips(p))).toEqual({ trig_arc_degrees: '960', trig_conversion_inverted: '172800/π', trig_arc_sector_swapped: '64π', trig_pi_dropped: '16/3' })
  })

  it('a sprinkler 15 ft through 120°: 75π square feet', () => {
    const p = { r: 15, theta: { kind: 'deg', deg: q(120) }, what: 'area' } as const
    expect(text(arcAnswer(p))).toBe('75π')
    expect(table(arcSlips(p))).toEqual({
      trig_arc_degrees: '13500',
      trig_conversion_inverted: '2430000/π',
      trig_sector_no_half: '150π',
      trig_sector_r_not_squared: '5π',
      trig_arc_sector_swapped: '10π',
      trig_pi_dropped: '75',
    })
  })

  it('θ as a plain number of radians: 2.5 radians on a radius of 8', () => {
    const p = { r: 8, theta: { kind: 'plain', rad: q(5, 2) }, what: 'arc' } as const
    expect(text(arcAnswer(p))).toBe('20')
    expect(table(arcSlips(p))).toEqual({ trig_arc_sector_swapped: '80' })
  })
})
