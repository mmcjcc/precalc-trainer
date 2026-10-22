/**
 * The inverse functions' principal values (Unit 5): every special input of arcsin, arccos and arctan, in degrees and in
 * radians, against a table written out by hand and against Math.asin, Math.acos and Math.atan; no value outside the
 * domain; the slips of each question by hand; arcsin(sin θ) and its relatives; the calculator's slips.
 */
import { describe, expect, it } from 'vitest'
import { exactNum, exactText, type TrigExact } from './exact'
import { principalDegrees } from './expr'
import { angleIn, cancelSlips, cancelValue, evaluateSlips, inPrincipalRange, inverseDecimalSlips, inverseRad, principalValue, type InvFn } from './principal'
import { q } from './rational'
import { readExact } from './reader'

const ex = (t: string): TrigExact => {
  const v = readExact(t)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${t}`)
  return v
}

/** fn, input, degrees, radians: written by hand from the unit circle and the principal ranges. */
const TABLE: [InvFn, string, number, string][] = [
  ['asin', '0', 0, '0'],
  ['asin', '1/2', 30, 'π/6'],
  ['asin', '-1/2', -30, '-π/6'],
  ['asin', '√2/2', 45, 'π/4'],
  ['asin', '-√2/2', -45, '-π/4'],
  ['asin', '√3/2', 60, 'π/3'],
  ['asin', '-√3/2', -60, '-π/3'],
  ['asin', '1', 90, 'π/2'],
  ['asin', '-1', -90, '-π/2'],
  ['acos', '0', 90, 'π/2'],
  ['acos', '1/2', 60, 'π/3'],
  ['acos', '-1/2', 120, '2π/3'],
  ['acos', '√2/2', 45, 'π/4'],
  ['acos', '-√2/2', 135, '3π/4'],
  ['acos', '√3/2', 30, 'π/6'],
  ['acos', '-√3/2', 150, '5π/6'],
  ['acos', '1', 0, '0'],
  ['acos', '-1', 180, 'π'],
  ['atan', '0', 0, '0'],
  ['atan', '√3/3', 30, 'π/6'],
  ['atan', '-√3/3', -30, '-π/6'],
  ['atan', '1', 45, 'π/4'],
  ['atan', '-1', -45, '-π/4'],
  ['atan', '√3', 60, 'π/3'],
  ['atan', '-√3', -60, '-π/3'],
]

const MATH: Record<InvFn, (x: number) => number> = { asin: Math.asin, acos: Math.acos, atan: Math.atan }

describe('principal values: the hand table and Math', () => {
  it.each(TABLE)('%s(%s) = %i° = %s', (fn, input, deg, rad) => {
    const v = ex(input)
    expect(principalDegrees(fn, v)).toBe(deg)
    const p = principalValue(fn, v)!
    expect(exactText(angleIn(p, 'deg'))).toBe(String(deg))
    expect(exactText(angleIn(p, 'rad'))).toBe(rad)
    expect(exactNum(angleIn(p, 'rad'))).toBeCloseTo(MATH[fn](exactNum(v)), 12)
    expect(inPrincipalRange(fn, p)).toBe(true)
  })

  it('every special input of the table is in it, and no other special value has an exact angle', () => {
    const specials = ['0', '1/2', '-1/2', '√2/2', '-√2/2', '√3/2', '-√3/2', '1', '-1', '√3/3', '-√3/3', '√3', '-√3']
    for (const fn of ['asin', 'acos', 'atan'] as const) {
      for (const s of specials) {
        const d = principalDegrees(fn, ex(s))
        const listed = TABLE.find(([f, i]) => f === fn && i === s)
        if (listed) expect(d).toBe(listed[2])
        else if (fn === 'atan') expect(d).toBeNull()
        else expect(Math.abs(exactNum(ex(s))) > 1 ? d === 'none' : d === null).toBe(true)
      }
      // Not special: 0.3, 2/3, √5/3.
      for (const s of ['3/10', '2/3', '√5/3']) expect(principalDegrees(fn, ex(s))).toBeNull()
    }
  })

  it('no value outside the domain of arcsin and arccos; arctan takes every input', () => {
    for (const s of ['2', '-2', '3/2', '-5/4', '√3', '-√2', 'π/2']) {
      expect(principalValue('asin', ex(s))).toBeNull()
      expect(principalValue('acos', ex(s))).toBeNull()
    }
    expect(principalDegrees('atan', ex('2'))).toBeNull()
    expect(() => principalValue('atan', ex('2'))).toThrow()
  })
})

const slipTexts = (fn: InvFn, input: string, unit: 'deg' | 'rad') =>
  Object.fromEntries(evaluateSlips(fn, ex(input)).map((s) => [s.id, exactText(angleIn(s.deg, unit))]))

describe('the slips of an exact value, by hand', () => {
  it('arcsin(−√3/2) = −π/3: the other angle 4π/3, the full turn 5π/3, the sign dropped π/3, the cosine’s angle 5π/6', () => {
    expect(slipTexts('asin', '-√3/2', 'rad')).toEqual({
      trig_inverse_other_angle: '4π/3',
      trig_inverse_not_principal: '5π/3',
      trig_inverse_sign_dropped: 'π/3',
      trig_sin_cos_swapped: '5π/6',
    })
  })

  it('arccos(−1/2) = 2π/3: arcsin’s way −π/3, the other angle 4π/3, the positive input’s π/3, the sine’s angle −π/6', () => {
    expect(slipTexts('acos', '-1/2', 'rad')).toEqual({
      trig_arccos_range_as_arcsin: '-π/3',
      trig_inverse_other_angle: '4π/3',
      trig_inverse_sign_dropped: 'π/3',
      trig_sin_cos_swapped: '-π/6',
    })
  })

  it('arctan(−1) = −π/4: the other angle 3π/4, the full turn 7π/4, the sign dropped π/4 (cot = tan here, so no tan slip)', () => {
    expect(slipTexts('atan', '-1', 'rad')).toEqual({
      trig_inverse_other_angle: '3π/4',
      trig_inverse_not_principal: '7π/4',
      trig_inverse_sign_dropped: 'π/4',
    })
  })

  it('arctan(√3) = 60°: the other angle 240°, the cotangent read as the tangent 30°', () => {
    expect(slipTexts('atan', '√3', 'deg')).toEqual({ trig_inverse_other_angle: '240', trig_tan_inverted: '30' })
  })

  it('arcsin(1/2) = π/6: the other angle 5π/6, the cosine’s angle π/3', () => {
    expect(slipTexts('asin', '1/2', 'rad')).toEqual({ trig_inverse_other_angle: '5π/6', trig_sin_cos_swapped: 'π/3' })
  })

  it('no slip is the answer, and no two slips are the same angle', () => {
    for (const [fn, input, deg] of TABLE) {
      const slips = evaluateSlips(fn, ex(input))
      for (const s of slips) expect(s.deg.n / s.deg.d).not.toBe(deg)
      expect(new Set(slips.map((s) => `${s.deg.n}/${s.deg.d}`)).size).toBe(slips.length)
      for (const s of slips) expect(s.witness).not.toMatch(/\d/)
    }
  })
})

describe('arcsin(sin θ), arccos(cos θ), arctan(tan θ)', () => {
  /** fn, θ in degrees, the answer in degrees: by hand. */
  const CANCEL: [InvFn, number, number][] = [
    ['asin', 150, 30],
    ['asin', 120, 60],
    ['asin', 210, -30],
    ['asin', 300, -60],
    ['asin', 225, -45],
    ['asin', -150, -30],
    ['acos', -60, 60],
    ['acos', 240, 120],
    ['acos', 300, 60],
    ['acos', 210, 150],
    ['acos', -135, 135],
    ['atan', 135, -45],
    ['atan', 120, -60],
    ['atan', 210, 30],
    ['atan', 240, 60],
    ['atan', -150, 30],
  ]
  it.each(CANCEL)('%s of its function at %i° is %i°', (fn, theta, want) => {
    expect(cancelValue(fn, q(theta))).toEqual(q(want))
    const t = (theta * Math.PI) / 180
    const inner = fn === 'asin' ? Math.sin(t) : fn === 'acos' ? Math.cos(t) : Math.tan(t)
    expect((MATH[fn](inner) * 180) / Math.PI).toBeCloseTo(want, 9)
  })

  it('arcsin(sin(5π/6)) = π/6, and keeping 5π/6 is named', () => {
    const slips = cancelSlips('asin', q(150))
    expect(slips[0]).toMatchObject({ id: 'trig_inverse_cancel_outside', deg: q(150) })
    const arctan = Object.fromEntries(cancelSlips('atan', q(135)).map((s) => [s.id, exactText(angleIn(s.deg, 'rad'))]))
    expect(arctan).toEqual({ trig_inverse_cancel_outside: '3π/4', trig_inverse_not_principal: '7π/4', trig_inverse_sign_dropped: 'π/4' })
  })
})

describe('calculator values in radians', () => {
  it('arccos(−0.35) ≈ 1.928; DEGREE mode 110.487, one over cos 1.065, cos itself 0.939', () => {
    expect(inverseRad('acos', -0.35).toFixed(3)).toBe('1.928')
    const s = Object.fromEntries(inverseDecimalSlips('acos', -0.35, '−0.35').map((x) => [x.id, x.value.toFixed(3)]))
    expect(s).toEqual({ trig_degree_mode: '110.487', trig_inverse_as_reciprocal: '1.065', trig_ratio_for_angle: '0.939' })
  })

  it('arctan(2.5) ≈ 1.190 and arcsin(0.6) ≈ 0.644', () => {
    expect(inverseRad('atan', 2.5).toFixed(3)).toBe('1.190')
    expect(inverseRad('asin', 0.6).toFixed(3)).toBe('0.644')
  })
})
