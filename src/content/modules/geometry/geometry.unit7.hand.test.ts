/**
 * Honors geometry Unit 7, worked by hand. The brief's examples are built from their own numbers (the letters and the
 * turn are whatever passes the gate); a few more are fixed seeds, solved on paper first. Each pins the answers, the
 * value of each slip, and how equal forms of the answer grade.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import { simplifyRadical } from './answer'
import { gradeGeoStage } from './grade'
import { altitudeFor, meanProblem } from './unit7Mean'
import { classifyProblem, rightTriangleFor } from './unit7Pyth'
import { specialFor } from './unit7Special'

const int = (n: number) => simplifyRadical(n, 1, 1)
const rad = (k: number, r: number) => simplifyRadical(k, 1, r)

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return p.answer
}

const answers = (a: GeometryAnswer) => a.stages.map((s) => s.answerText)
const grade = (a: GeometryAnswer, stage: string, text: string) => gradeGeoStage(a, stage as never, text)
const slip = (a: GeometryAnswer, stage: string, text: string, id: string) => expect(grade(a, stage, text), `${stage} ${text}`).toMatchObject({ verdict: 'mistake', mistake: id })
const right = (a: GeometryAnswer, stage: string, text: string) => expect(grade(a, stage, text).verdict, `${stage} ${text}`).toBe('correct')
const note = (a: GeometryAnswer, stage: string, text: string) => expect(grade(a, stage, text).verdict, `${stage} ${text}`).toBe('invalid')

describe('the geometric mean, worked by hand', () => {
  it('the geometric mean of 4 and 9 is 6', () => {
    // 4/x = x/9, so x² = 36 and x = 6. The average is 13/2; the product 36 is x², not x.
    const a = meanProblem(4, 9, null)!.answer
    expect(a.prompt).toBe('Find the geometric mean of 4 and 9.')
    expect(answers(a)).toEqual(['6'])
    slip(a, 'result', '13/2', 'geo_geometric_as_arithmetic')
    slip(a, 'result', '6.5', 'geo_geometric_as_arithmetic')
    slip(a, 'result', '36', 'geo_mean_not_rooted')
    right(a, 'result', 'sqrt(36)'.replace('sqrt(36)', '6'))
    note(a, 'result', 'sqrt(36)')
  })

  it('the geometric mean of 3 and 15 is 3√5, and √45 is a note asking for simplest form', () => {
    // x² = 45 = 9 · 5, so x = 3√5. The average is 9; the product is 45.
    const a = meanProblem(3, 15, null)!.answer
    expect(answers(a)).toEqual(['3√5'])
    for (const t of ['3√5', '3sqrt(5)', '3*sqrt(5)', '3 sqrt(5)']) right(a, 'result', t)
    slip(a, 'result', '9', 'geo_geometric_as_arithmetic')
    slip(a, 'result', '45', 'geo_mean_not_rooted')
    note(a, 'result', 'sqrt(45)')
    expect(grade(a, 'result', 'sqrt(45)')).toMatchObject({ verdict: 'invalid', message: expect.stringMatching(/perfect-square factor/) })
    note(a, 'result', '6sqrt(5)/2')
    expect(grade(a, 'result', '6.708')).toMatchObject({ verdict: 'invalid', message: expect.stringMatching(/exact value, in simplest radical form/) })
  })
})

describe('the altitude to the hypotenuse, worked by hand', () => {
  it('with hypotenuse segments 4 and 9 the altitude is 6 and the legs are 2√13 and 3√13', () => {
    // CD² = 4 · 9 = 36, CD = 6. AB = 13; AC² = 13 · 4 = 52, AC = 2√13; BC² = 13 · 9 = 117, BC = 3√13.
    const a = altitudeFor({ tri: { p: 4, q: 9 }, kind: 'pq', asked: ['h', 'a'] }).answer
    expect(a.prompt).toMatch(/[A-Z]{2} = 4 and [A-Z]{2} = 9\. Find x, the length of [A-Z]{2}, and y, the length of [A-Z]{2}\.$/)
    expect(answers(a)).toEqual(['6', '2√13'])
    slip(a, 'x', '13/2', 'geo_geometric_as_arithmetic')
    slip(a, 'x', '36', 'geo_mean_not_rooted')
    // The leg with the far segment: √(13 · 9) = 3√13, which is the other leg.
    slip(a, 'result', '3√13', 'geo_leg_far_segment')
    slip(a, 'result', '52', 'geo_mean_not_rooted')
    slip(a, 'result', '17/2', 'geo_geometric_as_arithmetic')
    slip(a, 'result', '6', 'geo_altitude_leg_mixed')
    const b = altitudeFor({ tri: { p: 4, q: 9 }, kind: 'pq', asked: ['b'] }).answer
    expect(answers(b)).toEqual(['3√13'])
    slip(b, 'x', '2√13', 'geo_leg_far_segment')
    right(b, 'x', 'sqrt(117)'.replace('sqrt(117)', '3sqrt(13)'))
    note(b, 'x', 'sqrt(117)')
  })

  it('the altitude from a segment and the leg next to it, set as a mean of the leg and the segment', () => {
    // AD = 16 and AC = 20: in right triangle ACD, CD² = 400 − 256 = 144, CD = 12. The altitude as the geometric mean
    // of the leg and the segment: √(20 · 16) = 8√5. Adding the squares: √656 = 4√41.
    const a = altitudeFor({ tri: { p: 16, q: 9 }, kind: 'pa', asked: ['h'] }).answer
    expect(a.prompt).toMatch(/[A-Z]{2} = 16 and [A-Z]{2} = 20\. Find x, the length of [A-Z]{2}\.$/)
    expect(answers(a)).toEqual(['12'])
    slip(a, 'x', '8√5', 'geo_altitude_leg_mixed')
    slip(a, 'x', '4√41', 'trig_pythag_added')
    slip(a, 'x', '144', 'trig_side_not_rooted')
  })

  it('a segment in x: x(x + 7) = 144 gives x = 9', () => {
    // AD = x, DB = x + 7, CD = 12: x² + 7x − 144 = 0 = (x − 9)(x + 16), x = 9. DB itself is 16; the average slip gives
    // 12 = (2x + 7)/2, x = 17/2. (x = 4 from x(x + 5) = 36 cannot carry the answered-x slip: its catalog example
    // shows a 4, so the gate refuses it.)
    const a = altitudeFor({ tri: { p: 9, q: 16 }, kind: 'quad', asked: [], x: 9, extra: null }).answer
    expect(a.prompt).toMatch(/[A-Z]{2} = x, [A-Z]{2} = x \+ 7, and [A-Z]{2} = 12\. Find x\.$/)
    expect(answers(a)).toEqual(['9'])
    slip(a, 'x', '16', 'geo_answered_x')
    slip(a, 'x', '17/2', 'geo_geometric_as_arithmetic')
    right(a, 'x', 'x = 9')
  })
})

describe('the Pythagorean Theorem and its converse, worked by hand', () => {
  it('legs 5 and 12 give a hypotenuse of 13', () => {
    // 25 + 144 = 169 = 13². Not rooted: 169. Subtracted: √119.
    const a = rightTriangleFor({ a: int(5), b: int(12), c: int(13) }, 'hyp').answer
    expect(a.prompt).toMatch(/[A-Z]{2} = 5, and [A-Z]{2} = 12\. Find x, the length of [A-Z]{2}\.$/)
    expect(answers(a)).toEqual(['13'])
    slip(a, 'x', '169', 'trig_side_not_rooted')
    slip(a, 'x', '√119', 'trig_pythag_subtracted')
  })

  it('a leg from a leg of 2√3 and a hypotenuse of 6: √24 = 2√6, with the coefficient left unsquared giving √30', () => {
    // 36 − 12 = 24, so the leg is 2√6. Adding: √48 = 4√3. (2√3)² as 6: √(36 − 6) = √30.
    const a = rightTriangleFor({ a: rad(2, 6), b: rad(2, 3), c: int(6) }, 'a').answer
    expect(answers(a)).toEqual(['2√6'])
    slip(a, 'x', '4√3', 'trig_pythag_added')
    slip(a, 'x', '24', 'trig_side_not_rooted')
    slip(a, 'x', '√30', 'geo_coefficient_not_squared')
  })

  it('7, 24, 25 is right; 4, 5, 6 is acute; 4, 5, 7 is obtuse; 3, 4, 8 is not a triangle', () => {
    // 49 + 576 = 625: right. 16 + 25 = 41 > 36: acute. 41 < 49: obtuse. 3 + 4 = 7 < 8: no triangle.
    const r = classifyProblem([int(7), int(25), int(24)], 1, null)!.answer
    expect(answers(r)).toEqual(['right'])
    // 24 listed last is not the longest: its square against the other two always reads acute.
    slip(r, 'result', 'acute', 'geo_converse_wrong_side')
    expect(grade(r, 'result', 'obtuse').verdict).toBe('wrong')
    const acute = classifyProblem([int(4), int(5), int(6)], 1, null)!.answer
    expect(answers(acute)).toEqual(['acute'])
    slip(acute, 'result', 'obtuse', 'geo_acute_obtuse_swapped')
    const obtuse = classifyProblem([int(4), int(5), int(7)], 1, null)!.answer
    expect(answers(obtuse)).toEqual(['obtuse'])
    slip(obtuse, 'result', 'acute', 'geo_acute_obtuse_swapped')
    const none = classifyProblem([int(3), int(4), int(8)], 1, null)!.answer
    expect(answers(none)).toEqual(['none'])
    for (const pick of ['acute', 'right', 'obtuse']) slip(none, 'result', pick, 'geo_triangle_inequality_skipped')
    expect(none.prompt).toBe('Can segments with lengths 3, 4, and 8 form a triangle? If they can, classify the triangle by its angles.')
  })

  it('4, 6, 2√13 is right, and (2√13)² taken as 26 reads acute', () => {
    // 16 + 36 = 52 = (2√13)². With 2 · 13 = 26 < 52 for the longest: acute.
    const a = classifyProblem([int(6), rad(2, 13), int(4)], 1, null)!.answer
    expect(answers(a)).toEqual(['right'])
    slip(a, 'result', 'acute', 'geo_coefficient_not_squared')
  })
})

describe('special right triangles, worked by hand', () => {
  it('a square with side 6 has diagonal 6√2', () => {
    // 6 · √2. Twice the side: 12. Divided by √2: 3√2.
    const a = specialFor.square({ fromSide: true, given: int(6) }).answer
    expect(a.prompt).toMatch(/^[A-Z]{4} is a square with sides of length 6\. Find x, the length of diagonal [A-Z]{2}\.$/)
    expect(answers(a)).toEqual(['6√2'])
    slip(a, 'x', '12', 'trig_special_45_two')
    slip(a, 'x', '3√2', 'trig_special_wrong_way')
    right(a, 'x', '6sqrt(2)')
    note(a, 'x', 'sqrt(72)')
    note(a, 'x', '8.485')
  })

  it('an equilateral triangle with side 10 has altitude 5√3', () => {
    // The shorter leg is 5, the altitude 5√3. The whole side as the shorter leg: 10√3. The legs swapped: 5.
    const a = specialFor.equilateral({ fromSide: true, given: int(10) }).answer
    expect(answers(a)).toEqual(['5√3'])
    slip(a, 'x', '10√3', 'geo_half_not_taken')
    slip(a, 'x', '5', 'trig_special_legs_swapped')
    slip(a, 'x', '(20√3)/3', 'trig_special_root3_two_swapped')
    slip(a, 'x', '20√3/3', 'trig_special_root3_two_swapped')
  })

  it('a 30°-60°-90° triangle with hypotenuse 14 has legs 7 and 7√3', () => {
    const a = specialFor.tri30({ from: 'hyp', given: int(14), asked: ['short', 'long'], at60: false }).answer
    expect(a.prompt).toMatch(/^In 30°-60°-90° triangle [A-Z]{3}, ∠[A-Z] is the right angle, m∠[A-Z] = 30, and [A-Z]{2} = 14\. Find x, the length of [A-Z]{2}, and y, the length of [A-Z]{2}\.$/)
    expect(answers(a)).toEqual(['7', '7√3'])
    // The shorter leg from the hypotenuse divided by √3 (the factors swapped): 14√3/3; the longer leg in its place: 7√3.
    slip(a, 'x', '(14√3)/3', 'trig_special_root3_two_swapped')
    slip(a, 'x', '7√3', 'trig_special_legs_swapped')
    slip(a, 'result', '7', 'trig_special_legs_swapped')
  })

  it('a 30°-60°-90° triangle whose longer leg is 9: the shorter leg 3√3 and the hypotenuse 6√3', () => {
    // 9/√3 = 3√3, and twice that is 6√3. Halving the long leg: 9/2 (the factors swapped).
    const a = specialFor.tri30({ from: 'long', given: int(9), asked: ['short', 'hyp'], at60: true }).answer
    expect(answers(a)).toEqual(['3√3', '6√3'])
    slip(a, 'x', '9/2', 'trig_special_root3_two_swapped')
    slip(a, 'result', '18', 'trig_special_legs_swapped')
    note(a, 'x', '9/sqrt(3)')
  })
})

describe('fixed seeds, worked by hand', () => {
  it('rs.altitude/1: the altitude in x', () => {
    // WC² = GC · CD = 16 · 4 = 64, WC = 8 = x + 1, so x = 7. WC itself: 8. The average of 16 and 4 is 10 = x + 1: 9.
    const a = answerOf('geoRightSimilar', 'rs.altitude', 1)
    expect(a.prompt).toBe('In right triangle GDW, ∠GWD is a right angle and WC is the altitude to the hypotenuse. GC = 16, CD = 4, and WC = x + 1. Find x.')
    expect(answers(a)).toEqual(['7'])
    slip(a, 'x', '8', 'geo_answered_x')
    slip(a, 'x', '9', 'geo_geometric_as_arithmetic')
    slip(a, 'x', '63', 'geo_mean_not_rooted')
  })

  it('rs.mean/1: the geometric mean of 12 and 27 is 18', () => {
    const a = answerOf('geoRightSimilar', 'rs.mean', 1)
    expect(a.prompt).toBe('Find the geometric mean of 12 and 27.')
    expect(answers(a)).toEqual(['18'])
    slip(a, 'result', '39/2', 'geo_geometric_as_arithmetic')
    slip(a, 'result', '324', 'geo_mean_not_rooted')
  })

  it('py.side/1: the distance from T(−7, −3) to C(1, −9) is 10', () => {
    // The legs are 8 and 6: √100 = 10. Walking the grid: 14. Not rooted: 100.
    const a = answerOf('geoPythagorean', 'py.side', 1)
    expect(a.prompt).toBe('Find the distance between T(−7, −3) and C(1, −9).')
    expect(answers(a)).toEqual(['10'])
    slip(a, 'result', '14', 'geo_distance_not_squared')
    slip(a, 'result', '100', 'geo_distance_no_root')
  })

  it('py.apply/6: a ladder whose top is 15 feet up, its foot 6 feet out, is 16.2 feet long', () => {
    // √(36 + 225) = √261 ≈ 16.155, which rounds to 16.2. Subtracting: √189 ≈ 13.7. Not rooted: 261.
    const a = answerOf('geoPythagorean', 'py.apply', 6)
    expect(a.prompt).toBe('The top of a ladder rests against a wall 15 feet above the ground, and its foot is 6 feet from the base of the wall. How long is the ladder? Round to the nearest tenth of a foot.')
    expect(answers(a)).toEqual(['16.2'])
    for (const t of ['16.2', '16.2 ft', '16.2 feet', '16.16', '16.155']) right(a, 'result', t)
    note(a, 'result', '16')
    note(a, 'result', '3sqrt(29)')
    note(a, 'result', '16.2 m')
    slip(a, 'result', '13.7', 'trig_pythag_subtracted')
    slip(a, 'result', '261', 'trig_side_not_rooted')
  })
})
