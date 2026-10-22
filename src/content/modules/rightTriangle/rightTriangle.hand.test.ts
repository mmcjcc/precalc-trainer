/**
 * Hand-worked textbook problems through the builders the second half's templates use: each answer worked out by hand
 * in the test's name, checked as she would type it, a slip named, the prompt read as words, and the worked solution
 * showing the real steps.
 */
import { describe, expect, it } from 'vitest'
import type { TrigPart } from '@/content/types'
import { q, readExact, type TrigExact } from '@/engine/trig'
import { givenProblem, solveProblem } from '../unitCircle'
import { gradeTrigPart } from '../trig/parts'
import { plain } from '../trig/text'
import { angleProblem, ratiosProblem, sideProblem, specialProblem } from '.'

function check(part: TrigPart, right: string[], slips: [string, string][] = []) {
  expect(right).toContain(part.answerText)
  for (const t of right) expect(gradeTrigPart(part, t).verdict, `“${t}”`).toBe('correct')
  for (const [t, id] of slips) {
    const g = gradeTrigPart(part, t)
    expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `“${t}”`).toBe(id)
  }
}

const words = (lines: string[]) => lines.map(plain).join(' ')
const ex = (t: string): TrigExact => readExact(t) as TrigExact

describe('hand-worked: the third side and the ratios', () => {
  it('sides 5 and 13: the third side is √(169 − 25) = 12, and tan of the angle opposite 12 is 12/5 (5/12 swaps them)', () => {
    const d = ratiosProblem({ given: { adj: 5, hyp: 13 }, fns: ['tan'], rightAt: 'right', thetaAt: 'base' })
    expect(plain(d.prompt)).toBe('In the right triangle shown, one leg is 5 and the hypotenuse is 13. Find the third side, then the exact value of tan θ.')
    check(d.stages[0]!, ['12', 'c = 12'], [['√194', 'trig_pythag_added'], ['144', 'trig_side_not_rooted']])
    check(d.stages[1]!, ['12/5', '2.4'], [['5/12', 'trig_opposite_adjacent_swapped'], ['12/13', 'trig_hypotenuse_as_leg']])
    expect(words(d.stages[0]!.reveal)).toContain('b² = 13² − 5² = 169 − 25 = 144')
    expect(words(d.stages[1]!.reveal)).toContain('tan θ = opposite/adjacent = 12/5')
  })

  it('legs 2 and 3: the hypotenuse is √13; sin θ = 2/√13 = 2√13/13 (2/√13 is a note), csc θ = √13/2', () => {
    const d = ratiosProblem({ given: { opp: 2, adj: 3 }, fns: ['sin', 'csc'], rightAt: 'left', thetaAt: 'top' })
    check(d.stages[0]!, ['√13', 'sqrt(13)'], [['13', 'trig_side_not_rooted'], ['√5', 'trig_pythag_subtracted']])
    check(d.stages[1]!, ['2√13/13'], [['3√13/13', 'trig_opposite_adjacent_swapped'], ['√13/2', 'trig_hypotenuse_as_leg']])
    expect(gradeTrigPart(d.stages[1]!, '2/√13').verdict).toBe('invalid')
    check(d.stages[2]!, ['√13/2'], [['2√13/13', 'trig_reciprocal_missing']])
    expect(words(d.stages[1]!.reveal)).toContain('with the denominator rationalized')
  })
})

describe('hand-worked: the special right triangles', () => {
  it('a 30°-60°-90° triangle with hypotenuse 10 has legs 5 and 5√3 (5√3 for x swaps the legs; 20 doubles)', () => {
    const d = specialProblem({ tri: '30', given: 'hyp', value: ex('10'), rightAt: 'right', smallAt: 'base' })
    expect(plain(d.prompt)).toBe('In the 30°-60°-90° triangle shown, the hypotenuse is 10. Find x and y. Give exact answers in simplest radical form.')
    check(d.stages[0]!, ['5', 'x = 5'], [['5√3', 'trig_special_legs_swapped'], ['20', 'trig_special_wrong_way']])
    check(d.stages[1]!, ['5√3', '5sqrt(3)'], [['5', 'trig_special_legs_swapped']])
    expect(words(d.stages[0]!.reveal)).toContain('x = 10/2 = 5')
    expect(words(d.stages[1]!.reveal)).toContain('y = 5 · √3 = 5√3')
  })

  it('a 45°-45°-90° triangle with leg 6 has hypotenuse 6√2 (12 is the leg doubled)', () => {
    const d = specialProblem({ tri: '45', given: 'leg', value: ex('6'), rightAt: 'left', smallAt: 'base' })
    check(d.stages[0]!, ['6√2'], [['12', 'trig_special_45_two'], ['3√2', 'trig_special_wrong_way']])
    expect(words(d.stages[0]!.reveal)).toContain('x = 6 · √2 = 6√2')
  })

  it('a 45°-45°-90° triangle with hypotenuse 6√2 has legs 6 (3√2 halves it)', () => {
    const d = specialProblem({ tri: '45', given: 'hyp', value: ex('6√2'), rightAt: 'right', smallAt: 'top' })
    expect(plain(d.prompt)).toContain('the hypotenuse is 6√2')
    check(d.stages[0]!, ['6'], [['3√2', 'trig_special_45_two'], ['12', 'trig_special_wrong_way']])
  })

  it('a 30°-60°-90° triangle with long leg 6: short leg 6/√3 = 2√3 (6√3 multiplies), hypotenuse 4√3 (12 doubles the long leg)', () => {
    const d = specialProblem({ tri: '30', given: 'long', value: ex('6'), rightAt: 'left', smallAt: 'base' })
    check(d.stages[0]!, ['2√3'], [['6√3', 'trig_special_wrong_way'], ['3', 'trig_special_root3_two_swapped']])
    check(d.stages[1]!, ['4√3'], [['12', 'trig_special_legs_swapped']])
    expect(words(d.stages[1]!.reveal)).toContain('y = 2 · 2√3 = 4√3')
  })
})

describe('hand-worked: a side on the calculator', () => {
  it('a 20 ft ladder at 70° reaches 20 sin 70° ≈ 18.8 ft (6.8 uses cos; 15.5 is RADIAN mode)', () => {
    const d = sideProblem({ scene: 'ladder', deg: 70, known: { role: 'hyp', value: 20 }, asked: 'opp', places: 1, caseIndex: 0 })
    expect(plain(d.prompt)).toBe('A 20-foot ladder leans against a wall and makes a 70° angle with the ground. How high up the wall does the ladder reach? Round to the nearest tenth of a foot.')
    check(d.stages[0]!, ['18.8', '18.8 ft', '18.79 feet'], [['6.8', 'trig_opposite_adjacent_swapped'], ['15.5', 'trig_radian_mode'], ['21.3', 'trig_hypotenuse_as_leg']])
    expect(words(d.stages[0]!.reveal)).toContain('x = 20 · sin 70° ≈ 18.794')
  })

  it('a 60 m lighthouse with a 25° angle of depression: the boat is 60/tan 25° ≈ 129 m out (28 measures from the vertical)', () => {
    const d = sideProblem({ scene: 'lighthouse', deg: 25, known: { role: 'opp', value: 60 }, asked: 'adj', places: 0, caseIndex: 0 })
    check(d.stages[0]!, ['129', '129 m', '128.7'], [['28', 'trig_depression_from_vertical']])
    expect(words(d.stages[0]!.reveal)).toContain('the angle at the boat is 25°')
    expect(d.figure.triangle!.angles[0]).toMatchObject({ at: 'O', label: '25°', fromHorizontal: true })
  })

  it('a tree with a 30 ft shadow and the sun 52° up is 30 tan 52° ≈ 38.4 ft tall; a 150 ft kite string at 40° holds the kite 96.4 ft up', () => {
    check(sideProblem({ scene: 'tree', deg: 52, known: { role: 'adj', value: 30 }, asked: 'opp', places: 1, caseIndex: 0 }).stages[0]!, ['38.4'], [['23.4', 'trig_opposite_adjacent_swapped']])
    check(sideProblem({ scene: 'kite', deg: 40, known: { role: 'hyp', value: 150 }, asked: 'opp', places: 1, caseIndex: 0 }).stages[0]!, ['96.4'], [['114.9', 'trig_opposite_adjacent_swapped']])
  })
})

describe('hand-worked: an angle on the calculator', () => {
  it('legs 12 and 16: θ = tan⁻¹(12/16) ≈ 36.9° (53.1 is the other angle; 0.6 is RADIAN mode)', () => {
    const d = angleProblem({ scene: 'plain', a: { role: 'opp', value: 12 }, b: { role: 'adj', value: 16 }, unit: null })
    check(d.stages[0]!, ['36.9', '36.9°', '36.87'], [['53.1', 'trig_opposite_adjacent_swapped'], ['0.6', 'trig_radian_mode']])
    expect(words(d.stages[0]!.reveal)).toContain('θ = tan^−1(12/16) ≈ 36.870°')
  })

  it('a 45 m lighthouse and a boat 120 m out: the angle of depression is tan⁻¹(45/120) ≈ 20.6° (69.4 is from the vertical)', () => {
    const d = angleProblem({ scene: 'lighthouse', a: { role: 'opp', value: 45 }, b: { role: 'adj', value: 120 }, caseIndex: 0 })
    expect(plain(d.prompt)).toBe('A lighthouse is 45 meters tall, and a boat is 120 meters from its base. What is the angle of depression from the top of the lighthouse to the boat? Round to the nearest tenth of a degree.')
    check(d.stages[0]!, ['20.6'], [['69.4', 'trig_depression_from_vertical']])
  })

  it('a ramp 24 ft long that rises 2 ft: sin⁻¹(2/24) ≈ 4.8°', () => {
    check(angleProblem({ scene: 'ramp', a: { role: 'opp', value: 2 }, b: { role: 'hyp', value: 24 }, caseIndex: 1 }).stages[0]!, ['4.8'], [['85.2', 'trig_opposite_adjacent_swapped']])
  })
})

describe('hand-worked: one value and the quadrant', () => {
  it('sin θ = 5/13 with cos θ < 0: x = −12 (12 ignores the sign), cos θ = −12/13', () => {
    const d = givenProblem({ fn: 'sin', value: q(5, 13), quadrant: 2, where: 'sign', signFn: 'cos', asked: ['cos'] })
    expect(plain(d.prompt)).toBe('sin θ = 5/13 and cos θ < 0. For the point on the terminal side with y = 5 and r = 13, find x, then the exact value of cos θ.')
    check(d.stages[0]!, ['-12', '−12', 'x = -12'], [['12', 'trig_coordinate_sign'], ['-144', 'trig_side_not_rooted']])
    check(d.stages[1]!, ['-12/13'], [['12/13', 'trig_sign_quadrant']])
    expect(words(d.stages[0]!.reveal)).toContain('so θ is in Quadrant II. There x is negative: x = −12.')
  })

  it('tan θ = −3/4 in Quadrant II: r = 5 (−5 is a negative distance), sin θ = 3/5, cos θ = −4/5', () => {
    const d = givenProblem({ fn: 'tan', value: q(-3, 4), quadrant: 2, where: 'quadrant', asked: ['sin', 'cos'] })
    check(d.stages[0]!, ['5'], [['-5', 'trig_r_negative'], ['25', 'trig_r_not_rooted']])
    check(d.stages[1]!, ['3/5', '0.6'], [['-3/5', 'trig_sign_quadrant']])
    check(d.stages[2]!, ['-4/5', '-0.8'], [['4/5', 'trig_sign_quadrant']])
    expect(d.figure.waitFor).toBe('sin')
  })
})

describe('hand-worked: every angle in one turn', () => {
  it('sin θ = −√3/2 in [0°, 360°): 240° and 300° (60 is the reference angle alone)', () => {
    const d = solveProblem({ fn: 'sin', value: ex('-√3/2'), unit: 'deg' })
    expect(plain(d.prompt)).toBe('Solve sin θ = −√3/2 for θ in [0°, 360°). Give every solution exactly, in degrees.')
    check(d.stages[0]!, ['240, 300', '300, 240', '240°, 300°'], [['60', 'trig_solve_reference_only'], ['240', 'trig_solve_one_answer']])
    const w = words(d.stages[0]!.reveal)
    expect(w).toContain('The reference angle is 60°')
    expect(w).toContain('θ = 180° + 60° = 240°')
    expect(w).toContain('θ = 360° − 60° = 300°')
  })

  it('cos θ = −1/2 in [0, 2π): 2π/3 and 4π/3 (2/3, 4/3 drops the π)', () => {
    const d = solveProblem({ fn: 'cos', value: ex('-1/2'), unit: 'rad' })
    check(d.stages[0]!, ['2π/3, 4π/3', '4pi/3, 2pi/3'], [['2/3, 4/3', 'trig_pi_dropped']])
    const w = words(d.stages[0]!.reveal)
    expect(w).toContain('θ = π − π/3 = 2π/3')
    expect(w).toContain('θ = π + π/3 = 4π/3')
  })

  it('tan θ = 1: 45° and 225°; csc θ = 2: 30° and 150° (csc θ = 2 means sin θ = 1/2); sec θ = −√2: 135° and 225°', () => {
    check(solveProblem({ fn: 'tan', value: ex('1'), unit: 'deg' }).stages[0]!, ['45, 225'], [['45, 135', 'trig_solve_wrong_sign_quadrant']])
    const csc = solveProblem({ fn: 'csc', value: ex('2'), unit: 'deg' })
    check(csc.stages[0]!, ['30, 150'], [['60, 300', 'trig_reciprocal_mixed']])
    expect(words(csc.stages[0]!.reveal)).toContain('csc θ = 2 means sin θ = 1/2')
    check(solveProblem({ fn: 'sec', value: ex('-√2'), unit: 'deg' }).stages[0]!, ['135, 225'], [['135, -135', 'trig_solve_out_of_range']])
  })

  it('cos θ = 0: 90° and 270°, on the axes; sin θ = −1 in radians: 3π/2 alone (−π/2 is outside the range)', () => {
    const cos0 = solveProblem({ fn: 'cos', value: ex('0'), unit: 'deg' })
    check(cos0.stages[0]!, ['90, 270'])
    expect(words(cos0.stages[0]!.reveal)).toContain('At θ = 90° the point on the unit circle is (0, 1), so cos θ = 0.')
    check(solveProblem({ fn: 'sin', value: ex('-1'), unit: 'rad' }).stages[0]!, ['3π/2', '3pi/2'], [['-π/2', 'trig_solve_out_of_range']])
  })
})
