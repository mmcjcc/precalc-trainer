/**
 * Honors geometry Unit 5, worked by hand. Each case is one fixed seed, solved on paper first; the test pins the
 * prompt's numbers, the answers, and the value of the promised slip. A change to a generator that moves these
 * numbers has to be worked again by hand.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import { gradeGeoStage } from './grade'

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return p.answer
}

const answers = (a: GeometryAnswer) => a.stages.map((s) => s.answerText)
const verdict = (a: GeometryAnswer, stage: string, text: string) => gradeGeoStage(a, stage as never, text)

describe('parallelograms, worked by hand', () => {
  it('gq.props/1: a half-diagonal and the whole diagonal', () => {
    // VY = 2·YE: 2x − 4 = 2(4x − 38) = 8x − 76, so 6x = 72 and x = 12. EV = YE = 48 − 38 = 10.
    // The slip YE = VY: 4x − 38 = 2x − 4, so x = 17.
    const a = answerOf('geoParallelograms', 'gq.props', 1)
    expect(a.prompt).toBe('The diagonals of parallelogram VWYZ meet at E. YE = 4x − 38 and VY = 2x − 4. Find x, then EV.')
    expect(answers(a)).toEqual(['12', '10'])
    expect([a.trap, a.trapStage, a.trapAnswer]).toEqual(['geo_diagonal_half_as_whole', 'x', '17'])
    // Giving the whole diagonal, 2(12) − 4 = 20, for the half is the same slip.
    expect(verdict(a, 'result', '20')).toMatchObject({ verdict: 'mistake', mistake: 'geo_diagonal_half_as_whole' })
  })

  it('gq.props/2: opposite angles are congruent, and the angle beside them is supplementary', () => {
    // ∠Q and ∠S are opposite in SRQP: 5x + 73 = 6x + 63, x = 10, m∠Q = 123. ∠R shares a side: 180 − 123 = 57.
    // Opposite angles set supplementary: 11x + 136 = 180, x = 4.
    const a = answerOf('geoParallelograms', 'gq.props', 2)
    expect(a.prompt).toBe('In parallelogram SRQP, m∠Q = (5x + 73)° and m∠S = (6x + 63)°. Find x, then m∠R.')
    expect(answers(a)).toEqual(['10', '57'])
    expect([a.trap, a.trapAnswer]).toEqual(['geo_opposite_angles_supplementary', '4'])
    expect(verdict(a, 'result', '123')).toMatchObject({ verdict: 'mistake', mistake: 'geo_consecutive_angles_equal' })
    expect(verdict(a, 'result', '57°').verdict).toBe('correct')
  })

  it('gq.props/3: the two halves of one diagonal, with a half of the other as a distractor', () => {
    // YQ = QV: 4x − 14 = 2x + 10, x = 12, YQ = 34, YV = 68. YQ = WQ gives x = 24; QV = WQ gives 3x = 48, x = 16.
    const a = answerOf('geoParallelograms', 'gq.props', 3)
    expect(a.prompt).toBe('The diagonals of parallelogram YWVU meet at Q. YQ = 4x − 14, QV = 2x + 10, and WQ = 5x − 38. Find x, then YV.')
    expect(answers(a)).toEqual(['12', '68'])
    expect(a.trapAnswer).toBe('24')
    expect(verdict(a, 'x', '16')).toMatchObject({ verdict: 'mistake', mistake: 'geo_diagonals_assumed_congruent' })
    expect(verdict(a, 'result', '34')).toMatchObject({ verdict: 'mistake', mistake: 'geo_diagonal_half_as_whole' })
  })

  it('gq.prove/1, 2, and 3: two tests and a pair that is not enough', () => {
    // YZAB: arcs on Y and A, and on Z and B, are the two pairs of opposite angles.
    const one = answerOf('geoParallelograms', 'gq.prove', 1)
    expect(one.figure.ariaLabel).toBe('Quadrilateral YZAB. Angles Y and A have 1 arc each. Angles Z and B have 2 arcs each.')
    expect(answers(one)).toEqual(['angles'])
    expect(verdict(one, 'a', 'none')).toMatchObject({ verdict: 'mistake', mistake: 'geo_parallelogram_test_missed' })
    // QPHG: QP ∥ HG and PH ∥ GQ, the definition.
    expect(answers(answerOf('geoParallelograms', 'gq.prove', 2))).toEqual(['parallel'])
    // HGFE: only HG ≅ FE. An isosceles trapezoid with legs HG and FE has that mark.
    const three = answerOf('geoParallelograms', 'gq.prove', 3)
    expect(three.figure.ariaLabel).toBe('Quadrilateral HGFE. Sides HG and FE have 1 tick each.')
    expect(answers(three)).toEqual(['none'])
    expect(verdict(three, 'a', 'onePair')).toMatchObject({ verdict: 'mistake', mistake: 'geo_one_pair_half_test' })
    expect(verdict(three, 'a', 'sides')).toMatchObject({ verdict: 'mistake', mistake: 'geo_one_pair_half_test' })
    expect(verdict(three, 'a', 'angles').verdict).toBe('wrong')
  })

  it('gq.coords/1: four slopes show a trapezoid', () => {
    // AB: (−1 + 7)/(−6 + 2) = −3/2. CD: (−3 − 0)/(3 − 1) = −3/2. BC: (0 + 1)/(1 + 6) = 1/7. DA: (−7 + 3)/(−2 − 3) = 4/5.
    const a = answerOf('geoParallelograms', 'gq.coords', 1)
    expect(a.prompt).toBe('Quadrilateral ABCD has vertices A(−2, −7), B(−6, −1), C(1, 0), and D(3, −3). Find the slope of each side. What do the slopes show?')
    expect(answers(a)).toEqual(['-3/2', '-3/2', '1/7', '4/5', 'onlyOne'])
    expect(verdict(a, 'a', '-2/3')).toMatchObject({ verdict: 'mistake', mistake: 'geo_slope_inverted' })
    expect(verdict(a, 'a', '−3/2').verdict).toBe('correct')
    expect(verdict(a, 'a', '-1.5').verdict).toBe('correct')
    expect(verdict(a, 'e', 'oneEnough')).toMatchObject({ verdict: 'mistake', mistake: 'geo_one_pair_half_test' })
  })

  it('gq.coords/2: four lengths show both pairs congruent', () => {
    // BA: changes 2 and 5, √29. ZY: √29. AZ: changes 4 and 6, √52 = 2√13. YB: 2√13.
    const a = answerOf('geoParallelograms', 'gq.coords', 2)
    expect(answers(a)).toEqual(['√29', '√29', '2√13', '2√13', 'both'])
    expect(verdict(a, 'a', 'sqrt(29)').verdict).toBe('correct')
    expect(verdict(a, 'a', '29')).toMatchObject({ verdict: 'mistake', mistake: 'geo_distance_no_root' })
    expect(verdict(a, 'a', '7')).toMatchObject({ verdict: 'mistake', mistake: 'geo_distance_not_squared' })
    // √52 is the right value but not simplest form: not an attempt.
    expect(verdict(a, 'c', 'sqrt(52)').verdict).toBe('invalid')
    expect(verdict(a, 'c', '7.21').verdict).toBe('invalid')
  })

  it('gq.coords/3: slopes of one pair and lengths of the other prove nothing', () => {
    // HP: (3 − 5)/6 = −1/3 and QR: (0 + 4)/(−12) = −1/3, so HP ∥ QR. PQ: changes 1 and 7, √50 = 5√2. RH: changes 5 and 5, 5√2.
    const a = answerOf('geoParallelograms', 'gq.coords', 3)
    expect(answers(a)).toEqual(['-1/3', '-1/3', '5√2', '5√2', 'notProved'])
    expect(verdict(a, 'e', 'mixed')).toMatchObject({ verdict: 'mistake', mistake: 'geo_parallel_congruent_mixed' })
    expect(verdict(a, 'd', '10')).toMatchObject({ verdict: 'mistake', mistake: 'geo_distance_not_squared' })
  })
})

describe('rectangles, rhombuses, and squares, worked by hand', () => {
  it('gs.props/1: a rhombus diagonal bisects the corner', () => {
    // x + 44 = 2x + 34, x = 10; each part is 54, so m∠RSP = 108. As a rectangle's corner: 3x + 78 = 90, x = 4.
    const a = answerOf('geoSpecialQuads', 'gs.props', 1)
    expect(a.prompt).toBe('In rhombus PQRS, the diagonals meet at E, m∠PSE = (x + 44)°, and m∠ESR = (2x + 34)°. Find x, then m∠RSP.')
    expect(answers(a)).toEqual(['10', '108'])
    expect([a.trap, a.trapAnswer]).toEqual(['geo_rect_rhombus_swapped', '4'])
    expect(verdict(a, 'result', '54')).toMatchObject({ verdict: 'mistake', mistake: 'geo_half_for_whole' })
  })

  it('gs.props/2: a rhombus’s diagonals are perpendicular', () => {
    // (2x − 8) + (x + 35) = 90, x = 21; ∠HBA = 34, and the diagonal bisects ∠CBA: 68. Set equal (a rectangle’s fact): x = 43.
    const a = answerOf('geoSpecialQuads', 'gs.props', 2)
    expect(a.prompt).toBe('In rhombus CBAZ, the diagonals meet at H, m∠HBA = (2x − 8)°, and m∠HAB = (x + 35)°. Find x, then m∠CBA.')
    expect(answers(a)).toEqual(['21', '68'])
    expect(a.trapAnswer).toBe('43')
  })

  it('gs.props/3: a rectangle’s diagonals are congruent', () => {
    // HD = HA, so x + 18 = 3x, x = 9, each 27; m∠HDC = 90 − 27 = 63. Set complementary (a rhombus’s fact): 4x + 18 = 90, x = 18.
    const a = answerOf('geoSpecialQuads', 'gs.props', 3)
    expect(a.prompt).toBe('In rectangle ABCD, the diagonals meet at H, m∠HDA = (x + 18)°, and m∠HAD = (3x)°. Find x, then m∠HDC.')
    expect(answers(a)).toEqual(['9', '63'])
    expect(a.trapAnswer).toBe('18')
  })

  it('gs.classify/1 and 2: a square from its sides and a right angle, a parallelogram from coordinates', () => {
    const one = answerOf('geoSpecialQuads', 'gs.classify', 1)
    expect(one.prompt).toBe('All four sides of RSTU are congruent, and ∠R is a right angle. What is the most specific name for RSTU?')
    expect(answers(one)).toEqual(['square'])
    for (const general of ['rectangle', 'rhombus', 'parallelogram', 'quadrilateral']) {
      expect(verdict(one, 'a', general)).toMatchObject({ verdict: 'mistake', mistake: 'geo_not_most_specific' })
    }
    expect(verdict(one, 'a', 'kite').verdict).toBe('wrong')
    // SR (3, 2) ∥ QP (−3, −2), RQ (1, −5) ∥ PS (−1, 5); lengths² 13 and 26; SR · RQ = −7, not perpendicular.
    const two = answerOf('geoSpecialQuads', 'gs.classify', 2)
    expect(two.prompt).toBe('SRQP has vertices S(−4, 3), R(−1, 5), Q(0, 0), and P(−3, −2). What is the most specific name for SRQP?')
    expect(answers(two)).toEqual(['parallelogram'])
  })
})

describe('trapezoids, kites, and midsegments, worked by hand', () => {
  it('gz.midseg/1, 2, and 3: the median of a trapezoid', () => {
    // (2x + 37) + (x + 8) = 2 · 39, 3x = 33, x = 11, SR = 19. The sum as the median: x = −2; a base as the median: x = 1 or 31.
    const one = answerOf('geoTrapezoids', 'gz.midseg', 1)
    expect(answers(one)).toEqual(['11', '19'])
    expect([one.trap, one.trapAnswer]).toEqual(['geo_median_as_base', '1'])
    expect(verdict(one, 'x', '-2')).toMatchObject({ verdict: 'mistake', mistake: 'geo_median_not_halved' })
    // (34 + 16)/2 = 25 = x + 3, x = 22. Sum: x = 47. Bases: x = 31 or 13.
    const two = answerOf('geoTrapezoids', 'gz.midseg', 2)
    expect(two.prompt).toBe('PHGF is a trapezoid with bases PH and FG. D is the midpoint of leg FP and A is the midpoint of leg HG, so DA is the median. PH = 34, FG = 16, and DA = x + 3. Find x, then DA.')
    expect(answers(two)).toEqual(['22', '25'])
    expect(verdict(two, 'x', '47')).toMatchObject({ verdict: 'mistake', mistake: 'geo_median_not_halved' })
    expect(verdict(two, 'x', '13')).toMatchObject({ verdict: 'mistake', mistake: 'geo_median_as_base' })
    // (12 + 30)/2 = 21 = 3x, x = 7.
    expect(answers(answerOf('geoTrapezoids', 'gz.midseg', 3))).toEqual(['7', '21'])
  })

  it('gz.isosceles/1 and 2: base angles of an isosceles trapezoid', () => {
    // ∠U ≅ ∠T: 3x + 48 = x + 60, x = 6, 66°; ∠S = 180 − 66 = 114. As a parallelogram's consecutive angles: 4x + 108 = 180, x = 18.
    const one = answerOf('geoTrapezoids', 'gz.isosceles', 1)
    expect(one.prompt).toBe('In isosceles trapezoid UTSR with bases UT and RS, m∠U = (3x + 48)° and m∠T = (x + 60)°. Find x, then m∠S.')
    expect(answers(one)).toEqual(['6', '114'])
    expect(one.trapAnswer).toBe('18')
    // ∠S and ∠Q: ∠Q ≅ ∠R, and ∠R + ∠S = 180, so (5x + 2) + (6x − 64) = 180, x = 22; ∠S = 112, ∠R = 68. As opposite angles of a parallelogram: x = 66.
    const two = answerOf('geoTrapezoids', 'gz.isosceles', 2)
    expect(answers(two)).toEqual(['22', '68'])
    expect(verdict(two, 'x', '66')).toMatchObject({ verdict: 'mistake', mistake: 'geo_trapezoid_as_parallelogram' })
  })

  it('gz.isosceles/3: a kite’s congruent angles are where unequal sides meet', () => {
    // RS ≅ RU and TS ≅ TU: the congruent angles are ∠S and ∠U. 3x + 40 = 4x + 18, x = 22, 106° each.
    // m∠T = 360 − 94 − 212 = 54. Taking ∠T ≅ ∠R gives 94.
    const a = answerOf('geoTrapezoids', 'gz.isosceles', 3)
    expect(a.prompt).toBe('In kite RSTU, RS ≅ RU, TS ≅ TU, m∠S = (3x + 40)°, m∠U = (4x + 18)°, and m∠R = 94°. Find x, then m∠T.')
    expect(answers(a)).toEqual(['22', '54'])
    expect([a.trap, a.trapStage, a.trapAnswer]).toEqual(['geo_kite_angles_wrong_pair', 'result', '94'])
  })
})
