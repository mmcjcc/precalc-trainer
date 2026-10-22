/**
 * Hand-worked textbook examples for the second half of Unit 4, each worked out by hand in its name, then graded through
 * the core as she would type it: the right answer in its spellings, and the slip in the name named by its id.
 */
import { describe, expect, it } from 'vitest'
import { exactInt, exactText, type TrigExact } from './exact'
import { givenCoordinateSlips, givenPoint, givenRSlips, givenValue, givenValueSlips } from './given'
import { gradeTrigAnswer, type TrigCandidate, type TrigSpec } from './grade'
import { angleAnswer, angleSlips, sideAnswer, sideSlips, type AngleProblem, type SideProblem } from './inverse'
import { readExact } from './reader'
import { q } from './rational'
import { gradeAngleList, solveAnswer, solveSlips } from './solve'
import { specialSide, specialSlips, type SpecialRole, type SpecialTriangle } from './special'
import { hypotenuseOf, hypotenuseSlips, legOf, legSlips, rtRatio, rtRatioSlips } from './triangle'
import { valueText, type TrigFn } from './values'

const ex = (t: string): TrigExact => {
  const v = readExact(t)
  if (v === null || v === 'undefined') throw new Error(`cannot read ${t}`)
  return v
}
const n = (v: number) => exactInt(v)

function grade(spec: TrigSpec, cands: TrigCandidate[], right: string[], slips: [string, string][] = []) {
  for (const t of right) expect(gradeTrigAnswer(spec, t, cands).verdict, `“${t}” is right`).toBe('correct')
  for (const [t, id] of slips) {
    const g = gradeTrigAnswer(spec, t, cands)
    expect(g.verdict === 'mistake' ? g.mistake : g.verdict === 'invalid' ? `invalid:${g.reason}` : g.verdict, `“${t}”`).toBe(id)
  }
}

const value = (v: TrigExact): TrigSpec => ({ kind: 'value', value: v })
const special = (tri: SpecialTriangle, from: SpecialRole, given: string, to: SpecialRole, right: string[], slips: [string, string][]) =>
  grade(value(specialSide(tri, from, ex(given), to)), specialSlips(tri, from, ex(given), to), right, slips)

const decimal = (v: number, places: number, units: string[] = []): TrigSpec => ({ kind: 'decimal', value: v, places, units })
const NAMES = { opp: 'the opposite side', adj: 'the adjacent side', hyp: 'the hypotenuse' }

describe('hand-worked: the special right triangles', () => {
  it('a 30°-60°-90° triangle with hypotenuse 10 has legs 5 and 5√3 (5√3 for the short leg swaps the legs; 20 doubles)', () => {
    special('30', 'hyp', '10', 'short', ['5', '5.0', 'x = 5'], [['5√3', 'trig_special_legs_swapped'], ['20', 'trig_special_wrong_way']])
    special('30', 'hyp', '10', 'long', ['5√3', '5sqrt(3)', '5*sqrt(3)'], [['5', 'trig_special_legs_swapped']])
    // √75 is the same length, not in simplest radical form: a note, not an attempt.
    expect(gradeTrigAnswer(value(ex('5√3')), '√75', []).verdict).toBe('invalid')
  })

  it('a 45°-45°-90° triangle with leg 6 has hypotenuse 6√2 (12 is the leg times two)', () => {
    special('45', 'leg', '6', 'hyp', ['6√2', '6sqrt(2)', '6*sqrt(2)'], [['12', 'trig_special_45_two'], ['3√2', 'trig_special_wrong_way']])
  })

  it('a 45°-45°-90° triangle with hypotenuse 8 has legs 8/√2 = 4√2 (4 halves the hypotenuse; 8/√2 is not simplest)', () => {
    special('45', 'hyp', '8', 'leg', ['4√2', '4sqrt(2)'], [['4', 'trig_special_45_two'], ['8√2', 'trig_special_wrong_way'], ['8/√2', 'invalid:not_simplest']])
  })

  it('short leg 7: long leg 7√3 (14 swaps the √3 and the 2), hypotenuse 14 (7√3 swaps them the other way)', () => {
    special('30', 'short', '7', 'long', ['7√3'], [['14', 'trig_special_root3_two_swapped']])
    special('30', 'short', '7', 'hyp', ['14'], [['7√3', 'trig_special_root3_two_swapped'], ['7/2', 'trig_special_wrong_way']])
  })

  it('long leg 6: short leg 6/√3 = 2√3 (6√3 multiplies the wrong way), hypotenuse 4√3 (12 doubles the long leg)', () => {
    special('30', 'long', '6', 'short', ['2√3', '2sqrt(3)'], [['6√3', 'trig_special_wrong_way'], ['3', 'trig_special_root3_two_swapped'], ['6/√3', 'invalid:not_simplest']])
    special('30', 'long', '6', 'hyp', ['4√3'], [['12', 'trig_special_legs_swapped']])
  })

  it('long leg 4√3: short leg 4, hypotenuse 8; hypotenuse 6√2 of a 45°-45°-90° triangle: legs 6', () => {
    special('30', 'long', '4√3', 'short', ['4'], [['12', 'trig_special_wrong_way']])
    special('30', 'long', '4√3', 'hyp', ['8'], [['8√3', 'trig_special_legs_swapped']])
    special('45', 'hyp', '6√2', 'leg', ['6'], [['3√2', 'trig_special_45_two'], ['12', 'trig_special_wrong_way']])
  })
})

describe('hand-worked: the third side and the ratios', () => {
  it('sides 5 and 13: the third side is √(169 − 25) = 12; tan of the angle opposite 12 is 12/5 (5/12 swaps them)', () => {
    expect(exactText(legOf(n(5), n(13)))).toBe('12')
    grade(value(n(12)), legSlips(n(5), n(13)), ['12'], [['√194', 'trig_pythag_added'], ['144', 'trig_side_not_rooted']])
    const s = { opp: n(12), adj: n(5), hyp: n(13) }
    grade({ kind: 'value', value: rtRatio('tan', s), fn: 'tan' }, rtRatioSlips('tan', s), ['12/5', '2.4', 'tan θ = 12/5'], [['5/12', 'trig_opposite_adjacent_swapped'], ['12/13', 'trig_hypotenuse_as_leg']])
    grade({ kind: 'value', value: rtRatio('sin', s), fn: 'sin' }, rtRatioSlips('sin', s), ['12/13'], [['13/12', 'trig_hypotenuse_as_leg'], ['5/13', 'trig_opposite_adjacent_swapped']])
  })

  it('legs 2 and 3: the hypotenuse is √13 (13 is not rooted; √5 subtracts); sin of the angle opposite 2 is 2√13/13', () => {
    expect(exactText(hypotenuseOf(n(2), n(3)))).toBe('√13')
    grade(value(ex('√13')), hypotenuseSlips(n(2), n(3)), ['√13', 'sqrt(13)'], [['13', 'trig_side_not_rooted'], ['√5', 'trig_pythag_subtracted']])
    const s = { opp: n(2), adj: n(3), hyp: ex('√13') }
    grade(value(rtRatio('sin', s)), rtRatioSlips('sin', s), ['2√13/13', '2sqrt(13)/13'], [['2/√13', 'invalid:not_simplest'], ['3√13/13', 'trig_opposite_adjacent_swapped'], ['√13/2', 'trig_hypotenuse_as_leg']])
  })

  it('a leg of 2 and a hypotenuse of 5: the other leg is √21 (√29 adds the squares; 21 is not rooted)', () => {
    grade(value(ex('√21')), legSlips(n(2), n(5)), ['√21'], [['√29', 'trig_pythag_added'], ['21', 'trig_side_not_rooted']])
  })

  it('opposite 12, hypotenuse 13: csc θ = 13/12 (12/13 is sin itself), sec θ = 13/5 (13/12 is csc)', () => {
    const s = { opp: n(12), adj: n(5), hyp: n(13) }
    grade(value(rtRatio('csc', s)), rtRatioSlips('csc', s), ['13/12'], [['12/13', 'trig_reciprocal_missing'], ['13/5', 'trig_reciprocal_mixed']])
    grade(value(rtRatio('sec', s)), rtRatioSlips('sec', s), ['13/5', '2.6'], [['13/12', 'trig_reciprocal_mixed']])
  })
})

describe('hand-worked: a side on the calculator, DEGREE mode', () => {
  const side = (p: SideProblem, places: number, right: string[], slips: [string, string][], units: string[] = []) => grade(decimal(sideAnswer(p), places, units), sideSlips(p), right, slips)

  it('a 20 ft ladder at 70° reaches 20 sin 70° ≈ 18.8 ft (6.8 uses cos; 15.5 is RADIAN mode; 21.3 divides)', () => {
    const p: SideProblem = { deg: 70, known: { role: 'hyp', value: 20 }, asked: 'opp', names: NAMES }
    expect(sideAnswer(p)).toBeCloseTo(18.79, 2)
    side(p, 1, ['18.8', '18.79', '18.8 ft'], [['6.8', 'trig_opposite_adjacent_swapped'], ['15.5', 'trig_radian_mode'], ['21.3', 'trig_hypotenuse_as_leg'], ['19', 'invalid:not_rounded']], ['ft', 'feet'])
  })

  it('a 150 ft kite string at 40° holds the kite 150 sin 40° ≈ 96.4 ft up (114.9 uses cos)', () => {
    const p: SideProblem = { deg: 40, known: { role: 'hyp', value: 150 }, asked: 'opp', names: NAMES }
    side(p, 1, ['96.4'], [['114.9', 'trig_opposite_adjacent_swapped'], ['233.4', 'trig_hypotenuse_as_leg']])
  })

  it('a 60 m lighthouse, angle of depression 25°: the boat is 60/tan 25° ≈ 128.7 m out (28.0 measures from the vertical)', () => {
    const p: SideProblem = { deg: 25, known: { role: 'opp', value: 60 }, asked: 'adj', names: NAMES, depression: { high: 'the top', low: 'the boat' } }
    expect(sideAnswer(p)).toBeCloseTo(128.67, 2)
    side(p, 1, ['128.7', '128.67 m'], [['28.0', 'trig_depression_from_vertical'], ['28', 'trig_depression_from_vertical']], ['m'])
  })

  it('a tree casting a 30 ft shadow with the sun 52° up is 30 tan 52° ≈ 38.4 ft tall (23.4 has the legs the other way)', () => {
    const p: SideProblem = { deg: 52, known: { role: 'adj', value: 30 }, asked: 'opp', names: NAMES }
    expect(sideAnswer(p)).toBeCloseTo(38.4, 1)
    side(p, 1, ['38.4'], [['23.4', 'trig_opposite_adjacent_swapped']])
  })

  it('the hypotenuse across from a 35° angle with a 12 cm leg opposite it: 12/sin 35° ≈ 20.92 cm (6.88 multiplies)', () => {
    const p: SideProblem = { deg: 35, known: { role: 'opp', value: 12 }, asked: 'hyp', names: NAMES }
    side(p, 2, ['20.92'], [['6.88', 'trig_hypotenuse_as_leg'], ['14.65', 'trig_opposite_adjacent_swapped']])
  })
})

describe('hand-worked: an angle on the calculator', () => {
  const angle = (p: AngleProblem, right: string[], slips: [string, string][]) => grade({ kind: 'decimal', value: angleAnswer(p), places: 1, unit: 'deg' }, angleSlips(p), right, slips)

  it('the angle with tan 0.75 (legs 12 and 16) is tan⁻¹ 0.75 ≈ 36.9° (53.1 is the other angle; 0.6 RADIAN mode)', () => {
    const p: AngleProblem = { a: { role: 'opp', value: 12 }, b: { role: 'adj', value: 16 }, names: NAMES }
    angle(p, ['36.9', '36.9°', '36.87', '36.9 degrees'], [['53.1', 'trig_opposite_adjacent_swapped'], ['0.6', 'trig_radian_mode'], ['37', 'invalid:not_rounded']])
  })

  it('sin θ = 12/20 gives 36.9°; SIN pressed for 2nd SIN gives sin(0.6) ≈ 0.0105', () => {
    const p: AngleProblem = { a: { role: 'opp', value: 12 }, b: { role: 'hyp', value: 20 }, names: NAMES }
    angle(p, ['36.9'], [['0.0105', 'trig_ratio_for_angle'], ['53.1', 'trig_opposite_adjacent_swapped'], ['31.0', 'trig_hypotenuse_as_leg']])
  })

  it('a ramp that rises 2 ft along 24 ft of ramp is sin⁻¹(2/24) ≈ 4.8° steep', () => {
    const p: AngleProblem = { a: { role: 'opp', value: 2 }, b: { role: 'hyp', value: 24 }, names: NAMES }
    expect(angleAnswer(p)).toBeCloseTo(4.78, 2)
    angle(p, ['4.8'], [['85.2', 'trig_opposite_adjacent_swapped']])
  })

  it('a 45 m lighthouse and a boat 120 m out: the angle of depression is tan⁻¹(45/120) ≈ 20.6° (69.4 is from the vertical)', () => {
    const p: AngleProblem = { a: { role: 'opp', value: 45 }, b: { role: 'adj', value: 120 }, names: NAMES, depression: { high: 'the top', low: 'the boat' } }
    angle(p, ['20.6'], [['69.4', 'trig_depression_from_vertical']])
  })
})

describe('hand-worked: one value and the quadrant', () => {
  it('sin θ = 5/13 with cos θ < 0: Quadrant II, x = −12 (12 ignores the sign), cos θ = −12/13 (12/13 the sign again)', () => {
    const p = givenPoint('sin', q(5, 13), 2)
    grade(value(p.x), givenCoordinateSlips(p, 2), ['-12', '−12', 'x = -12'], [['12', 'trig_coordinate_sign'], ['-144', 'trig_side_not_rooted']])
    grade({ kind: 'value', value: givenValue('cos', p) as TrigExact, fn: 'cos' }, givenValueSlips('cos', p, 2), ['-12/13', 'cos θ = -12/13'], [['12/13', 'trig_sign_quadrant'], ['-12', 'trig_r_left_out']])
  })

  it('tan θ = −3/4 in Quadrant II: r = 5 (25 is not rooted, −5 is a negative distance); sin θ = 3/5, cos θ = −4/5', () => {
    const p = givenPoint('tan', q(-3, 4), 2)
    grade(value(p.r), givenRSlips(p), ['5'], [['25', 'trig_r_not_rooted'], ['-5', 'trig_r_negative']])
    expect(valueText(givenValue('sin', p))).toBe('3/5')
    grade({ kind: 'value', value: givenValue('cos', p) as TrigExact }, givenValueSlips('cos', p, 2), ['-4/5', '-0.8'], [['4/5', 'trig_sign_quadrant'], ['3/5', 'trig_sin_cos_swapped']])
  })

  it('cos θ = 1/3 in Quadrant IV: y = −√8 = −2√2, tan θ = −2√2', () => {
    const p = givenPoint('cos', q(1, 3), 4)
    grade(value(p.y), givenCoordinateSlips(p, 4), ['-2√2', '-2sqrt(2)'], [['2√2', 'trig_coordinate_sign'], ['-√8', 'invalid:not_simplest']])
    expect(valueText(givenValue('tan', p))).toBe('-2√2')
  })
})

describe('hand-worked: every angle in one turn', () => {
  const list = (fn: TrigFn, v: string, unit: 'deg' | 'rad', right: string[], slips: [string, string][]) => {
    const spec = { fn, value: ex(v), unit, degs: solveAnswer(fn, ex(v)) }
    const cands = solveSlips(fn, ex(v), unit)
    for (const t of right) expect(gradeAngleList(spec, t, cands).verdict, t).toBe('correct')
    for (const [t, id] of slips) {
      const g = gradeAngleList(spec, t, cands)
      expect(g.verdict === 'mistake' ? g.mistake : g.verdict, t).toBe(id)
    }
  }

  it('sin θ = −√3/2 in [0°, 360°): 240° and 300° (60 is the reference angle alone; −60 is the calculator’s angle)', () => {
    list('sin', '-√3/2', 'deg', ['240, 300', '300°, 240°'], [['60', 'trig_solve_reference_only'], ['240, -60', 'trig_solve_out_of_range'], ['240', 'trig_solve_one_answer'], ['60, 120', 'trig_solve_wrong_sign_quadrant']])
  })

  it('cos θ = −1/2 in [0, 2π): 2π/3 and 4π/3 (2/3, 4/3 drops the π; 2π/3, −2π/3 leaves the range)', () => {
    list('cos', '-1/2', 'rad', ['2π/3, 4π/3', '4pi/3, 2pi/3'], [['2/3, 4/3', 'trig_pi_dropped'], ['2π/3, -2π/3', 'trig_solve_out_of_range'], ['2π/3', 'trig_solve_one_answer']])
  })

  it('tan θ = 1: 45° and 225° (45° and 135° puts one in Quadrant II, where tan is negative)', () => {
    list('tan', '1', 'deg', ['45, 225'], [['45, 135', 'trig_solve_wrong_sign_quadrant'], ['45', 'trig_solve_one_answer']])
  })

  it('csc θ = 2: 30° and 150° (60° and 300° solve sec θ = 2)', () => {
    list('csc', '2', 'deg', ['30, 150'], [['60, 300', 'trig_reciprocal_mixed']])
  })

  it('sec θ = −√2: 135° and 225°; cos θ = 0: 90° and 270°; sin θ = −1: 270° alone (−90 is the calculator’s angle)', () => {
    list('sec', '-√2', 'deg', ['135, 225'], [['135, -135', 'trig_solve_out_of_range'], ['45', 'trig_solve_reference_only']])
    list('cos', '0', 'deg', ['90, 270', '270, 90'], [['90', 'trig_solve_one_answer']])
    list('sin', '-1', 'deg', ['270'], [['-90', 'trig_solve_out_of_range'], ['90', 'trig_solve_wrong_sign_quadrant']])
  })

  it('cot θ = √3: 30° and 210° (60° and 240° solve tan θ = √3)', () => {
    list('cot', '√3', 'deg', ['30, 210'], [['60, 240', 'trig_reciprocal_missing']])
  })
})
