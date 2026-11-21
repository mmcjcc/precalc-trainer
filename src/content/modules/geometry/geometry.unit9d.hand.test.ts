/**
 * Hand-worked problems of the last module of Unit 9 (Jurgensen 11-5 to 11-8). Each number is worked here with plain
 * arithmetic in the comment beside it, then held against the generator's answers and its named slips.
 */
import { describe, expect, it } from 'vitest'
import type { GeometryAnswer } from '@/content/types'
import { gradeGeoStage } from './grade'
import { handChance, handShaded, handShared, handSimilar } from './unit9Ratios'

const HEAVY = 120_000

const answers = (a: GeometryAnswer) => a.stages.map((s) => s.answerText)

function named(a: GeometryAnswer, stage: 'a' | 'b' | 'c', typed: string, id: string) {
  const g = gradeGeoStage(a, stage, typed)
  expect(g.verdict === 'mistake' && g.mistake, `${typed} on ${stage}`).toBe(id)
}

function right(a: GeometryAnswer, stage: 'a' | 'b' | 'c', typed: string) {
  expect(gradeGeoStage(a, stage, typed).verdict, `${typed} on ${stage}`).toBe('correct')
}

describe('hand-worked triangles that share a height', () => {
  it(
    'BD 4, DC 6: ABD to ADC is 2/3, ABD to ABC is 2/5',
    () => {
      const parts = handShared({ ask: 'parts', bd: 4, dc: 6, first: 'ABD', s: 2, half: false }).answer
      // Same height from A, so the areas are as the bases: 4 to 6 = 2/3.
      expect(answers(parts)).toEqual(['2/3'])
      right(parts, 'a', '2:3')
      right(parts, 'a', '2 to 3')
      right(parts, 'a', '4:6')
      // (4/6)² = 4/9; the other way round 3/2; against the whole 4/10 = 2/5.
      named(parts, 'a', '4/9', 'geo_area_ratio_squared')
      named(parts, 'a', '3:2', 'geo_area_ratio_reversed')
      named(parts, 'a', '2/5', 'geo_part_to_part_for_whole')
      const whole = handShared({ ask: 'whole', bd: 4, dc: 6, first: 'ABD', s: 2, half: false }).answer
      // BD to BC = 4 to 10 = 2/5.
      expect(answers(whole)).toEqual(['2/5'])
      // 4 to 6 is the other piece; (4/10)² = 4/25; 10 to 4 = 5/2.
      named(whole, 'a', '2/3', 'geo_part_to_part_for_whole')
      named(whole, 'a', '4/25', 'geo_area_ratio_squared')
      named(whole, 'a', '5:2', 'geo_area_ratio_reversed')
    },
    HEAVY,
  )

  it(
    'BD 3, DC 5, area ABD 12: area ADC 20',
    () => {
      // 12 · 5/3 = 20.
      const a = handShared({ ask: 'fromPart', bd: 3, dc: 5, first: 'ABD', s: 4, half: false }).answer
      expect(a.prompt).toContain('The area of triangle ABD is 12 cm².')
      expect(answers(a)).toEqual(['20'])
      // 12 · 3/5 = 36/5; 12 · 25/9 = 100/3; 12 · 8/3 = 32, the whole triangle.
      named(a, 'a', '36/5', 'geo_area_ratio_reversed')
      named(a, 'a', '100/3', 'geo_area_ratio_squared')
      named(a, 'a', '32', 'geo_part_to_part_for_whole')
    },
    HEAVY,
  )

  it(
    'BD 2, DC 3, area ABC 60: area ABD 24',
    () => {
      // 60 · 2/5 = 24.
      const a = handShared({ ask: 'fromWhole', bd: 2, dc: 3, first: 'ABD', s: 12, half: false }).answer
      expect(a.prompt).toContain('The area of triangle ABC is 60 cm².')
      expect(answers(a)).toEqual(['24'])
      // 60 · 2/3 = 40 (the part-to-part ratio); 60 · 4/25 = 48/5.
      named(a, 'a', '40', 'geo_part_to_part_for_whole')
      named(a, 'a', '48/5', 'geo_area_ratio_squared')
    },
    HEAVY,
  )
})

const SIM = { n: 3 as const, k: 1, m: 1, knownFirst: true, ad: 1, db: 1 }

describe('hand-worked areas of similar figures', () => {
  it(
    'scale factor 3:5: perimeters 3/5, areas 9/25',
    () => {
      const a = handSimilar({ ...SIM, variant: 'pair', a: 3, b: 5 }).answer
      // Perimeters keep the scale factor, 3/5; areas square it, 9/25.
      expect(answers(a)).toEqual(['3/5', '9/25'])
      named(a, 'a', '9/25', 'geo_perimeter_ratio_squared')
      named(a, 'a', '5:3', 'geo_area_ratio_reversed')
      named(a, 'b', '3/5', 'geo_area_ratio_not_squared')
      named(a, 'b', '25/9', 'geo_area_ratio_reversed')
      right(a, 'b', '9:25')
      right(a, 'b', '9 to 25')
    },
    HEAVY,
  )

  it(
    'areas 16 and 49: scale factor 4/7',
    () => {
      const a = handSimilar({ ...SIM, variant: 'areas', a: 4, b: 7 }).answer
      expect(a.prompt).toContain('is 16 cm² and the area of triangle DEF is 49 cm²')
      // √16 to √49 = 4 to 7.
      expect(answers(a)).toEqual(['4/7'])
      named(a, 'a', '16/49', 'geo_scale_from_areas_not_rooted')
      named(a, 'a', '7/4', 'geo_scale_factor_inverted')
    },
    HEAVY,
  )

  it(
    'scale factor 2:3 and the smaller area 12: the larger area 27',
    () => {
      const a = handSimilar({ ...SIM, variant: 'other', a: 2, b: 3, m: 3 }).answer
      expect(a.prompt).toContain('The area of triangle ABC is 12 cm². Find the area of triangle DEF')
      // 12 · (3/2)² = 12 · 9/4 = 27.
      expect(answers(a)).toEqual(['27'])
      // 12 · 3/2 = 18; 12 · (2/3)² = 16/3.
      named(a, 'a', '18', 'geo_area_ratio_not_squared')
      named(a, 'a', '16/3', 'geo_area_ratio_reversed')
    },
    HEAVY,
  )

  it(
    'DE parallel to BC, AD 2, DB 3: ADE to ABC 4/25, ADE to DBCE 4/21',
    () => {
      const a = handSimilar({ ...SIM, variant: 'parallel', a: 2, b: 3, ad: 2, db: 3 }).answer
      // Scale factor AD:AB = 2:5, so 4/25; the trapezoid is 25 − 4 = 21 parts, so 4/21.
      expect(answers(a)).toEqual(['4/25', '4/21'])
      // AD:DB as the scale factor: 4/9; unsquared 2/5; the trapezoid 4/21 for part a; the other way 25/4.
      named(a, 'a', '4/9', 'geo_part_over_whole')
      named(a, 'a', '2/5', 'geo_area_ratio_not_squared')
      named(a, 'a', '4/21', 'geo_part_to_part_for_whole')
      named(a, 'a', '25/4', 'geo_area_ratio_reversed')
      named(a, 'b', '4/25', 'geo_part_to_part_for_whole')
      named(a, 'b', '2/3', 'geo_area_ratio_not_squared')
      // AD:DB as the scale factor: 4 to 9 − 4 = 4/5.
      named(a, 'b', '4/5', 'geo_part_over_whole')
      named(a, 'b', '21/4', 'geo_area_ratio_reversed')
    },
    HEAVY,
  )

  it(
    'AD 3, DB 3: 1/4 and 1/3',
    () => {
      const a = handSimilar({ ...SIM, variant: 'parallel', a: 2, b: 3, ad: 3, db: 3 }).answer
      // AD:AB = 3:6 = 1:2, so 1/4; the trapezoid is 4 − 1 = 3 parts, so 1/3.
      expect(answers(a)).toEqual(['1/4', '1/3'])
      right(a, 'a', '9:36')
      right(a, 'b', '9 to 27')
    },
    HEAVY,
  )
})

const SH = { three: true, s: 0, big: 0, l: 0, w: 0, cx: 0, cy: 0, dir: 150 }

describe('hand-worked shaded regions', () => {
  it(
    'circle inscribed in a square of side 10: 100, 25π, 100 - 25π',
    () => {
      const a = handShaded({ ...SH, shape: 'squareCircle', s: 10 }).answer
      // 10 · 10 = 100; the radius is half the side, 5, so π · 25 = 25π; 100 − 25π.
      expect(answers(a)).toEqual(['100', '25π', '100 - 25π'])
      right(a, 'c', '25(4 - pi)')
      right(a, 'c', '-25pi + 100')
      // The perimeter 40; the side as the radius, π · 100 = 100π; the square itself; the two added.
      named(a, 'a', '40', 'geo_perimeter_for_area')
      named(a, 'b', '100pi', 'geo_circle_diameter_as_radius')
      named(a, 'c', '100', 'geo_region_not_subtracted')
      named(a, 'c', '100 + 25pi', 'geo_region_added')
    },
    HEAVY,
  )

  it(
    'square inscribed in a circle of radius 5: 25π, 50, 25π - 50',
    () => {
      const a = handShaded({ ...SH, shape: 'circleSquare', s: 5 }).answer
      // π · 5² = 25π; the diagonals are diameters, 10, so half of 10 · 10 = 50; 25π − 50.
      expect(answers(a)).toEqual(['25π', '50', '25π - 50'])
      // The radius as the side: 5 · 5 = 25. Without the half: 100.
      named(a, 'b', '25', 'geo_inscribed_side_from_radius')
      named(a, 'b', '100', 'geo_area_not_halved')
      named(a, 'c', '25pi - 25', 'geo_inscribed_side_from_radius')
      named(a, 'c', '25pi', 'geo_region_not_subtracted')
    },
    HEAVY,
  )

  it(
    'ring with radii 5 and 3: 25π, 9π, 16π',
    () => {
      const a = handShaded({ ...SH, shape: 'ring', big: 5, s: 3 }).answer
      // π · 25 − π · 9 = 16π.
      expect(answers(a)).toEqual(['25π', '9π', '16π'])
      named(a, 'c', '34pi', 'geo_region_added')
      named(a, 'c', '2pi', 'geo_circle_radius_not_squared')
      named(a, 'c', '16', 'geo_pi_left_off')
    },
    HEAVY,
  )

  it(
    'rectangle 12 by 8 with a circle of radius 3: 96, 9π, 96 - 9π',
    () => {
      const a = handShaded({ ...SH, shape: 'pond', s: 3, l: 12, w: 8, cx: 6, cy: 4 }).answer
      // 12 · 8 = 96; π · 9 = 9π; 96 − 9π.
      expect(answers(a)).toEqual(['96', '9π', '96 - 9π'])
      named(a, 'a', '40', 'geo_perimeter_for_area')
      named(a, 'a', '48', 'geo_half_applied')
      named(a, 'b', '6pi', 'geo_circumference_for_area')
      named(a, 'c', '96 - 3pi', 'geo_circle_radius_not_squared')
    },
    HEAVY,
  )

  it(
    'regular hexagon inscribed in a circle of radius 4: 16π, 24√3, 16π - 24√3',
    () => {
      const a = handShaded({ ...SH, shape: 'circleHexagon', s: 4 }).answer
      // Six equilateral triangles of side 4: 6 · (√3/4) · 16 = 24√3. Or apothem 2√3, perimeter 24: half of 48√3.
      expect(answers(a)).toEqual(['16π', '24√3', '16π - 24√3'])
      // The radius as the apothem: half of 4 · 24 = 48. No half: 48√3.
      named(a, 'b', '48', 'geo_apothem_for_radius')
      named(a, 'b', '48sqrt(3)', 'geo_area_not_halved')
      right(a, 'c', '8(2pi - 3sqrt(3))')
    },
    HEAVY,
  )

  it(
    'equilateral triangle inscribed in a circle of radius 4: 16π, 12√3, 16π - 12√3',
    () => {
      const a = handShaded({ ...SH, shape: 'circleTriangle', s: 4 }).answer
      // The side is 4√3 and the height 6: half of 4√3 · 6 = 12√3.
      expect(answers(a)).toEqual(['16π', '12√3', '16π - 12√3'])
      // The radius as the side: (√3/4) · 16 = 4√3.
      named(a, 'b', '4sqrt(3)', 'geo_inscribed_side_from_radius')
      named(a, 'b', '24sqrt(3)', 'geo_area_not_halved')
      named(a, 'c', '16pi - 4sqrt(3)', 'geo_inscribed_side_from_radius')
    },
    HEAVY,
  )
})

const CH = { ab: 0, bc: 0, cd: 0, piece: 'BC' as const, big: 0, r: 0, inner: true, l: 0, w: 0, cx: 0, cy: 0, a: 0, b: 0, dir: 150 }

describe('hand-worked geometric probability', () => {
  it(
    'AB 3, BC 2, CD 5: on BC 1/5, on AC 1/2',
    () => {
      const bc = handChance({ ...CH, variant: 'segment', ab: 3, bc: 2, cd: 5, piece: 'BC' }).answer
      // AD = 3 + 2 + 5 = 10; BC is 2 of it: 2/10 = 1/5.
      expect(answers(bc)).toEqual(['1/5'])
      right(bc, 'a', '2/10')
      right(bc, 'a', '0.2')
      // Over the rest: 2/8 = 1/4. The rest: 8/10 = 4/5.
      named(bc, 'a', '1/4', 'geo_part_to_part_for_whole')
      named(bc, 'a', '4/5', 'geo_probability_complement')
      const ac = handChance({ ...CH, variant: 'segment', ab: 3, bc: 2, cd: 5, piece: 'AC' }).answer
      // AC = 3 + 2 = 5 of 10.
      expect(answers(ac)).toEqual(['1/2'])
    },
    HEAVY,
  )

  it(
    'target with radii 2 and 6: inside the small circle 1/9, in the ring 8/9',
    () => {
      const inside = handChance({ ...CH, variant: 'target', big: 6, r: 2, inner: true }).answer
      // 4π out of 36π.
      expect(answers(inside)).toEqual(['1/9'])
      // The radii: 2/6 = 1/3. The ring: 32/36 = 8/9.
      named(inside, 'a', '1/3', 'geo_area_ratio_not_squared')
      named(inside, 'a', '8/9', 'geo_probability_complement')
      const ring = handChance({ ...CH, variant: 'target', big: 6, r: 2, inner: false }).answer
      // (36π − 4π) out of 36π = 32/36.
      expect(answers(ring)).toEqual(['8/9'])
      named(ring, 'a', '1/9', 'geo_probability_complement')
      named(ring, 'a', '8', 'geo_part_to_part_for_whole')
    },
    HEAVY,
  )

  it(
    'target with radii 3 and 5: in the ring 16/25',
    () => {
      const ring = handChance({ ...CH, variant: 'target', big: 5, r: 3, inner: false }).answer
      // (25π − 9π) out of 25π.
      expect(answers(ring)).toEqual(['16/25'])
      // (5 − 3)/5 = 2/5 compares the radii.
      named(ring, 'a', '2/5', 'geo_area_ratio_not_squared')
    },
    HEAVY,
  )

  it(
    'rectangle 12 by 10 with a circle of radius 3: inside (3π)/40, outside 1 - (3π)/40',
    () => {
      const pond = { ...CH, variant: 'pond' as const, l: 12, w: 10, r: 3, cx: 6, cy: 5 }
      const inside = handChance({ ...pond, inner: true }).answer
      // 9π out of 120 = 3π/40.
      expect(answers(inside)).toEqual(['(3π)/40'])
      right(inside, 'a', '3pi/40')
      // An unreduced number in front of π is the reader's existing simplest-form note (as on the circle module): not
      // an attempt, and the note does not show the reduced value.
      const unreduced = gradeGeoStage(inside, 'a', '9pi/120')
      expect(unreduced.verdict).toBe('invalid')
      expect(unreduced.verdict === 'invalid' && unreduced.message).toMatch(/Reduce the number in front of π/)
      expect(unreduced.verdict === 'invalid' && unreduced.message).not.toContain('40')
      named(inside, 'a', '1 - 3pi/40', 'geo_probability_complement')
      named(inside, 'a', '3/40', 'geo_pi_left_off')
      named(inside, 'a', '3pi/10', 'geo_circle_diameter_as_radius')
      const outside = handChance({ ...pond, inner: false }).answer
      expect(answers(outside)).toEqual(['1 - (3π)/40'])
      right(outside, 'a', '(40 - 3pi)/40')
      named(outside, 'a', '3pi/40', 'geo_probability_complement')
    },
    HEAVY,
  )
})
