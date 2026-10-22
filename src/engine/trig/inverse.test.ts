/**
 * Sides and angles on the calculator, against Math worked out here: sin, cos, tan in DEGREE and RADIAN mode, their
 * inverses, a side from each pair of sides, an angle from each pair, and the slips with their numbers.
 */
import { describe, expect, it } from 'vitest'
import {
  angleAnswer,
  angleSlips,
  fnDegrees,
  fnRadians,
  inverseDegrees,
  inverseRadians,
  linkOf,
  sideAnswer,
  sideSlips,
  type RtNames,
} from './inverse'
import type { RtRole } from './triangle'

const D = Math.PI / 180
const NAMES: RtNames = { opp: 'the height', adj: 'the distance along the ground', hyp: 'the ladder' }

describe('the functions and their inverses', () => {
  it('DEGREE mode is Math with degrees turned into radians; RADIAN mode takes the number as it is', () => {
    for (const d of [5, 17, 30, 35, 45, 52, 60, 70, 84]) {
      expect(fnDegrees('sin', d)).toBeCloseTo(Math.sin(d * D), 14)
      expect(fnDegrees('cos', d)).toBeCloseTo(Math.cos(d * D), 14)
      expect(fnDegrees('tan', d)).toBeCloseTo(Math.tan(d * D), 12)
      expect(fnRadians('sin', d)).toBeCloseTo(Math.sin(d), 14)
    }
  })

  it('sin⁻¹, cos⁻¹, tan⁻¹ in degrees at the special values, and in radians', () => {
    expect(inverseDegrees('sin', 0.5)).toBeCloseTo(30, 10)
    expect(inverseDegrees('cos', 0.5)).toBeCloseTo(60, 10)
    expect(inverseDegrees('tan', 1)).toBeCloseTo(45, 10)
    expect(inverseDegrees('tan', Math.sqrt(3))).toBeCloseTo(60, 10)
    expect(inverseDegrees('sin', Math.SQRT1_2)).toBeCloseTo(45, 10)
    expect(inverseRadians('sin', 0.6)).toBeCloseTo(0.643501109, 8)
    // Each inverse undoes its function.
    for (const d of [12, 36.87, 48.2, 71]) for (const fn of ['sin', 'cos', 'tan'] as const) expect(inverseDegrees(fn, fnDegrees(fn, d))).toBeCloseTo(d, 9)
  })

  it('which function links two sides', () => {
    expect(linkOf('opp', 'hyp')).toEqual({ fn: 'sin', top: 'opp', bottom: 'hyp' })
    expect(linkOf('hyp', 'opp')).toEqual({ fn: 'sin', top: 'opp', bottom: 'hyp' })
    expect(linkOf('hyp', 'adj')).toEqual({ fn: 'cos', top: 'adj', bottom: 'hyp' })
    expect(linkOf('adj', 'opp')).toEqual({ fn: 'tan', top: 'opp', bottom: 'adj' })
    expect(() => linkOf('opp', 'opp')).toThrow()
  })
})

describe('a side from an angle and one side', () => {
  const at35 = (known: RtRole, asked: RtRole) => sideAnswer({ deg: 35, known: { role: known, value: 12 }, asked, names: NAMES })
  it('every pair of sides at 35° with 12 known, against the formulas worked here', () => {
    expect(at35('hyp', 'opp')).toBeCloseTo(12 * Math.sin(35 * D), 12)
    expect(at35('hyp', 'adj')).toBeCloseTo(12 * Math.cos(35 * D), 12)
    expect(at35('opp', 'hyp')).toBeCloseTo(12 / Math.sin(35 * D), 12)
    expect(at35('adj', 'hyp')).toBeCloseTo(12 / Math.cos(35 * D), 12)
    expect(at35('adj', 'opp')).toBeCloseTo(12 * Math.tan(35 * D), 12)
    expect(at35('opp', 'adj')).toBeCloseTo(12 / Math.tan(35 * D), 12)
  })

  it('a 20 ft ladder at 70° reaches 20 sin 70° ≈ 18.8 ft up the wall', () => {
    const p = { deg: 70, known: { role: 'hyp' as const, value: 20 }, asked: 'opp' as const, names: NAMES }
    expect(sideAnswer(p)).toBeCloseTo(18.794, 3)
    const slips = sideSlips(p)
    expect(slips.map((s) => s.id)).toEqual(['trig_radian_mode', 'trig_opposite_adjacent_swapped', 'trig_hypotenuse_as_leg'])
    expect(slips[0]!.value).toBeCloseTo(20 * Math.sin(70), 9)
    expect(slips[1]!.value).toBeCloseTo(20 * Math.cos(70 * D), 9)
    expect(slips[2]!.value).toBeCloseTo(20 / Math.sin(70 * D), 9)
    for (const s of slips) expect(s.witness).not.toMatch(/18\.8|18\.79/)
  })

  it('an angle of depression: from the vertical is its own slip (60 m lighthouse, 25°: 60/tan 25° ≈ 128.7 m)', () => {
    const p = { deg: 25, known: { role: 'opp' as const, value: 60 }, asked: 'adj' as const, names: { opp: 'the height of the lighthouse', adj: 'the distance to the boat', hyp: 'the line of sight' }, depression: { high: 'the top of the lighthouse', low: 'the boat' } }
    expect(sideAnswer(p)).toBeCloseTo(128.67, 2)
    const slips = sideSlips(p)
    expect(slips.map((s) => s.id)).toEqual(['trig_radian_mode', 'trig_depression_from_vertical', 'trig_hypotenuse_as_leg'])
    expect(slips[1]!.value).toBeCloseTo(60 * Math.tan(25 * D), 9)
    // tan link: a leg taken for the hypotenuse.
    expect(slips[2]!.value).toBeCloseTo(60 * Math.cos(25 * D), 9)
  })
})

describe('an angle from two sides', () => {
  it('the angle with tan 0.75 (legs 12 and 16) is tan⁻¹ 0.75 ≈ 36.9°', () => {
    const p = { a: { role: 'opp' as const, value: 12 }, b: { role: 'adj' as const, value: 16 }, names: NAMES }
    expect(angleAnswer(p)).toBeCloseTo(36.87, 2)
    const s = angleSlips(p)
    expect(s.map((x) => x.id)).toEqual(['trig_radian_mode', 'trig_ratio_for_angle', 'trig_ratio_for_angle', 'trig_opposite_adjacent_swapped', 'trig_hypotenuse_as_leg'])
    expect(s[0]!.value).toBeCloseTo(Math.atan(0.75), 12)
    expect(s[1]!.value).toBeCloseTo(Math.tan(0.75 * D), 12)
    expect(s[2]!.value).toBe(0.75)
    expect(s[3]!.value).toBeCloseTo(90 - 36.8699, 3)
    expect(s[4]!.value).toBeCloseTo(Math.asin(0.75) / D, 9)
  })

  it('sin θ = 12/20: 36.9°; SIN instead of 2nd SIN gives sin(0.6) ≈ 0.0105; RADIAN mode gives 0.6435', () => {
    const p = { a: { role: 'hyp' as const, value: 20 }, b: { role: 'opp' as const, value: 12 }, names: NAMES }
    expect(angleAnswer(p)).toBeCloseTo(36.87, 2)
    const s = angleSlips(p)
    expect(s[0]!.value).toBeCloseTo(0.6435, 4)
    expect(s[1]!.value).toBeCloseTo(0.0105, 4)
    expect(s.at(-1)!.value).toBeCloseTo(Math.atan(0.6) / D, 9)
    for (const x of s) expect(x.witness).not.toMatch(/36\.9|36\.87/)
  })

  it('cos θ = 5/13 with the hypotenuse as a leg: tan⁻¹(13/5)', () => {
    const p = { a: { role: 'adj' as const, value: 5 }, b: { role: 'hyp' as const, value: 13 }, names: NAMES }
    expect(angleAnswer(p)).toBeCloseTo(Math.acos(5 / 13) / D, 10)
    expect(angleSlips(p).at(-1)!.value).toBeCloseTo(Math.atan(13 / 5) / D, 10)
  })
})
