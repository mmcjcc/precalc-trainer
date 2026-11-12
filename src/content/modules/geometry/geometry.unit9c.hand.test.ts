/**
 * Hand-worked circle problems (Jurgensen 11-5 and 11-6). Each number is worked here with plain arithmetic in the
 * comment beside it, then held against the generator's answers and its named slips.
 */
import { describe, expect, it } from 'vitest'
import type { GeometryAnswer } from '@/content/types'
import { gradeGeoStage } from './grade'
import { handCircle, handSector, handSegment } from './unit9Circles'

const HEAVY = 120_000

const answers = (a: GeometryAnswer) => a.stages.map((s) => s.answerText)
const trapsOf = (a: GeometryAnswer, i: number) => a.stages[i]!.traps.map((t) => [t.id, t.text])

function named(a: GeometryAnswer, stage: 'a' | 'b' | 'c', typed: string, id: string) {
  const g = gradeGeoStage(a, stage, typed)
  expect(g.verdict === 'mistake' && g.mistake, `${typed} on ${stage}`).toBe(id)
}

describe('hand-worked circumference and area', () => {
  it(
    'radius 7: circumference 14π, area 49π',
    () => {
      const a = handCircle('radius', { n: 7, d: 1, m: 1 }).answer
      expect(answers(a)).toEqual(['14π', '49π'])
      // 2·π·7 = 14π; π·7² = 49π. Slips: πr² = 49π, 2π·14 = 28π, π·7 = 7π, 14 without π.
      expect(trapsOf(a, 0)).toEqual([
        ['geo_area_for_circumference', '49π'],
        ['geo_circle_diameter_as_radius', '28π'],
        ['geo_circle_radius_as_diameter', '7π'],
        ['geo_pi_left_off', '14'],
      ])
      // 2πr = 14π, π·14² = 196π, π·7 = 7π, 49 without π.
      expect(trapsOf(a, 1)).toEqual([
        ['geo_circumference_for_area', '14π'],
        ['geo_circle_diameter_as_radius', '196π'],
        ['geo_circle_radius_not_squared', '7π'],
        ['geo_pi_left_off', '49'],
      ])
      expect(gradeGeoStage(a, 'b', '49pi').verdict).toBe('correct')
      expect(gradeGeoStage(a, 'b', '49 π').verdict).toBe('correct')
      // 49π ≈ 153.94: a calculator decimal is a note that asks for π, not an attempt.
      const decimal = gradeGeoStage(a, 'b', '153.94')
      expect(decimal.verdict).toBe('invalid')
      expect(decimal.verdict === 'invalid' && decimal.message).toMatch(/in terms of π/)
      // 98π/2 is the area in a form that is not simplest: not a named mistake.
      expect(gradeGeoStage(a, 'b', '98pi/2').verdict).not.toBe('mistake')
    },
    HEAVY,
  )

  it(
    'diameter 10: circumference 10π, area 25π',
    () => {
      const a = handCircle('diameter', { n: 5, d: 1, m: 1 }).answer
      expect(answers(a)).toEqual(['10π', '25π'])
      // π·10 = 10π; radius 5, π·5² = 25π. The π left off the circumference is 10, the given diameter, so it is dropped.
      expect(a.stages[0]!.traps.map((t) => t.text)).not.toContain('10')
      named(a, 'b', '100pi', 'geo_circle_diameter_as_radius')
      named(a, 'b', '10pi', 'geo_circumference_for_area')
      named(a, 'b', '5pi', 'geo_circle_radius_not_squared')
      named(a, 'a', '5pi', 'geo_circle_radius_as_diameter')
    },
    HEAVY,
  )

  it(
    'diameter 7: circumference 7π, area (49π)/4',
    () => {
      const a = handCircle('diameter', { n: 7, d: 2, m: 1 }).answer
      // π·7 = 7π; radius 7/2, π·(7/2)² = 49π/4.
      expect(answers(a)).toEqual(['7π', '(49π)/4'])
      expect(gradeGeoStage(a, 'b', '49pi/4').verdict).toBe('correct')
      expect(gradeGeoStage(a, 'b', '12.25pi').verdict).toBe('correct')
      named(a, 'b', '49pi', 'geo_circle_diameter_as_radius')
      named(a, 'b', '49/4', 'geo_pi_left_off')
    },
    HEAVY,
  )

  it(
    'circumference 18π: radius 9, area 81π',
    () => {
      const a = handCircle('circumference', { n: 9, d: 1, m: 1 }).answer
      // 18π ÷ π = 18, the diameter; the radius is 9; π·9² = 81π.
      expect(answers(a)).toEqual(['9', '81π'])
      expect(trapsOf(a, 0)).toEqual([['geo_circle_diameter_as_radius', '18']])
      // 2π·9 = 18π for the area is the given circumference: dropped as a copy.
      expect(a.stages[1]!.traps.map((t) => t.text)).not.toContain('18π')
      named(a, 'b', '81', 'geo_pi_left_off')
      named(a, 'b', '324pi', 'geo_circle_diameter_as_radius')
    },
    HEAVY,
  )

  it(
    'area 36π: radius 6, circumference 12π',
    () => {
      const a = handCircle('area', { n: 6, d: 1, m: 1 }).answer
      // 36π ÷ π = 36 = r², r = 6; 2π·6 = 12π.
      expect(answers(a)).toEqual(['6', '12π'])
      expect(trapsOf(a, 0)).toEqual([
        ['trig_side_not_rooted', '36'],
        ['geo_circle_diameter_as_radius', '12'],
      ])
      named(a, 'b', '6pi', 'geo_circle_radius_as_diameter')
      named(a, 'b', '24pi', 'geo_circle_diameter_as_radius')
      named(a, 'b', '12', 'geo_pi_left_off')
    },
    HEAVY,
  )

  it(
    'radius 3√2: circumference 6π√2, area 18π',
    () => {
      const a = handCircle('radius', { n: 3, d: 1, m: 2 }).answer
      // 2·π·3√2 = 6π√2; π·(3√2)² = π·18 = 18π.
      expect(answers(a)).toEqual(['6π√2', '18π'])
      expect(gradeGeoStage(a, 'a', '6sqrt(2)pi').verdict).toBe('correct')
      expect(gradeGeoStage(a, 'a', '6pi sqrt(2)').verdict).toBe('correct')
      named(a, 'b', '3pi sqrt(2)', 'geo_circle_radius_not_squared')
      named(a, 'b', '18', 'geo_pi_left_off')
    },
    HEAVY,
  )
})

describe('hand-worked arcs and sectors', () => {
  const both = (theta: number, r: number) => handSector({ ask: 'both', theta, r, major: false, from: 'arc' }).answer

  it(
    '60° and radius 9: arc length 3π, sector (27π)/2',
    () => {
      const a = both(60, 9)
      // 60/360 · 2π·9 = 3π; 60/360 · 81π = 27π/2.
      expect(answers(a)).toEqual(['3π', '(27π)/2'])
      named(a, 'a', '18pi', 'geo_sector_fraction_left_off')
      named(a, 'a', '15pi', 'geo_major_minor_swapped')
      named(a, 'a', '3', 'geo_pi_left_off')
      // The arc's degrees given as its length: 60.
      named(a, 'a', '60', 'geo_arc_measure_for_length')
      named(a, 'b', '81pi', 'geo_sector_fraction_left_off')
      named(a, 'b', '3pi', 'geo_arc_sector_swapped')
      // 60/360 · π·9 = 3π/2.
      named(a, 'b', '3pi/2', 'geo_circle_radius_not_squared')
    },
    HEAVY,
  )

  it(
    '90° and radius 8: 4π and 16π',
    () => {
      // 90/360 · 16π = 4π; 90/360 · 64π = 16π.
      expect(answers(both(90, 8))).toEqual(['4π', '16π'])
    },
    HEAVY,
  )

  it(
    '120° and radius 6: 4π and 12π',
    () => {
      // 120/360 · 12π = 4π; 120/360 · 36π = 12π.
      expect(answers(both(120, 6))).toEqual(['4π', '12π'])
    },
    HEAVY,
  )

  it(
    '45° and radius 4: π and 2π (built without the screen gate: "in terms of π" already prints π)',
    () => {
      const a = both(45, 4)
      // 45/360 · 8π = π; 45/360 · 16π = 2π.
      expect(answers(a)).toEqual(['π', '2π'])
      expect(gradeGeoStage(a, 'a', 'pi').verdict).toBe('correct')
      named(a, 'a', '8pi', 'geo_sector_fraction_left_off')
      named(a, 'b', '16pi', 'geo_sector_fraction_left_off')
    },
    HEAVY,
  )

  it(
    '150° and radius 12: 10π and 60π',
    () => {
      // 150/360 · 24π = 10π; 150/360 · 144π = 60π.
      expect(answers(both(150, 12))).toEqual(['10π', '60π'])
    },
    HEAVY,
  )

  it(
    'minor angle 120°, radius 6: major arc 8π and major sector 24π',
    () => {
      const arc = handSector({ ask: 'arc', theta: 120, r: 6, major: true, from: 'arc' }).answer
      // (360 − 120)/360 · 12π = 8π. The minor arc, 4π, is the swapped slip; the major arc's 240 degrees the measure slip.
      expect(answers(arc)).toEqual(['8π'])
      expect(arc.figure.points.some((p) => p.id === 'C')).toBe(true)
      named(arc, 'a', '4pi', 'geo_major_minor_swapped')
      named(arc, 'a', '240', 'geo_arc_measure_for_length')
      const sector = handSector({ ask: 'sector', theta: 120, r: 6, major: true, from: 'arc' }).answer
      // (360 − 120)/360 · 36π = 24π; the minor sector is 12π.
      expect(answers(sector)).toEqual(['24π'])
      named(sector, 'a', '12pi', 'geo_major_minor_swapped')
      named(sector, 'a', '36pi', 'geo_sector_fraction_left_off')
    },
    HEAVY,
  )

  it(
    'sector 6π in a circle of radius 6: central angle 60°',
    () => {
      const a = handSector({ ask: 'angle', theta: 60, r: 6, major: false, from: 'sector' }).answer
      expect(a.prompt).toContain('the area of sector AOB is 6π cm²')
      // 6π / 36π = 1/6 of the circle; 360/6 = 60.
      expect(answers(a)).toEqual(['60'])
      expect(a.stages[0]!.unit).toBe('deg')
      expect(gradeGeoStage(a, 'a', '60°').verdict).toBe('correct')
      // 6π read as an arc length: 180·6/6 = 180.
      named(a, 'a', '180', 'geo_arc_sector_swapped')
    },
    HEAVY,
  )

  it(
    'arc length 5π with a central angle of 100°: radius 9',
    () => {
      const a = handSector({ ask: 'radius', theta: 100, r: 9, major: false, from: 'arc' }).answer
      expect(a.prompt).toContain('the arc length of minor arc AB is 5π cm')
      // 5π = 100/360 · 2πr, so 2r = 18 and r = 9.
      expect(answers(a)).toEqual(['9'])
      named(a, 'a', '18', 'geo_circle_diameter_as_radius')
      // 5π read as the whole circumference: r = 5/2.
      named(a, 'a', '5/2', 'geo_sector_fraction_left_off')
    },
    HEAVY,
  )

  it(
    'arc length 2π, radius 8: central angle 45°',
    () => {
      const a = handSector({ ask: 'angle', theta: 45, r: 8, major: false, from: 'arc' }).answer
      expect(a.prompt).toContain('the arc length of minor arc AB is 2π cm')
      // 2π / 16π = 1/8 of the circle; 360/8 = 45.
      expect(answers(a)).toEqual(['45'])
    },
    HEAVY,
  )
})

describe('hand-worked segments of a circle', () => {
  it(
    '90° and radius 4: 4π, 8, 4π - 8',
    () => {
      const a = handSegment(90, 4).answer
      // 90/360 · 16π = 4π; ½ · 4 · 4 = 8; 4π − 8.
      expect(answers(a)).toEqual(['4π', '8', '4π - 8'])
      expect(trapsOf(a, 2)).toEqual([
        ['geo_segment_triangle_not_subtracted', '4π'],
        ['geo_segment_triangle_added', '4π + 8'],
        ['geo_sector_fraction_left_off', '16π - 8'],
      ])
      for (const typed of ['4(pi - 2)', '4(π-2)', '-8 + 4pi', '4pi-8']) expect(gradeGeoStage(a, 'c', typed).verdict, typed).toBe('correct')
      named(a, 'b', '16', 'geo_area_not_halved')
      named(a, 'c', '4pi', 'geo_segment_triangle_not_subtracted')
      named(a, 'c', '8 + 4pi', 'geo_segment_triangle_added')
      // 4π − 8 ≈ 4.566: the decimal asks for π.
      expect(gradeGeoStage(a, 'c', '4.57').verdict).toBe('invalid')
    },
    HEAVY,
  )

  it(
    '60° and radius 6: 6π, 9√3, 6π - 9√3',
    () => {
      const a = handSegment(60, 6).answer
      // 60/360 · 36π = 6π; equilateral, 36√3/4 = 9√3.
      expect(answers(a)).toEqual(['6π', '9√3', '6π - 9√3'])
      // 18√3 without the half; 36/4 = 9 with half the radius as the height; 36√3/3 = 12√3 with the factors swapped.
      expect(trapsOf(a, 1)).toEqual([
        ['geo_area_not_halved', '18√3'],
        ['trig_special_legs_swapped', '9'],
        ['trig_special_root3_two_swapped', '12√3'],
      ])
      expect(gradeGeoStage(a, 'c', '3(2pi - 3sqrt(3))').verdict).toBe('correct')
    },
    HEAVY,
  )

  it(
    '120° and radius 6: 12π, 9√3, 12π - 9√3',
    () => {
      const a = handSegment(120, 6).answer
      // 120/360 · 36π = 12π; base 6√3, height 3, ½ · 6√3 · 3 = 9√3.
      expect(answers(a)).toEqual(['12π', '9√3', '12π - 9√3'])
      named(a, 'b', '18sqrt(3)', 'geo_area_not_halved')
      // The long leg 3√3 as the height: ½ · 6√3 · 3√3 = 27.
      named(a, 'b', '27', 'trig_special_legs_swapped')
      // Twice the triangle taken away: 12π − 18√3 (still positive).
      named(a, 'c', '12pi - 18sqrt(3)', 'geo_area_not_halved')
    },
    HEAVY,
  )

  it(
    '90° and radius 6: 9π, 18, 9π - 18',
    () => {
      // 90/360 · 36π = 9π; ½ · 6 · 6 = 18.
      expect(answers(handSegment(90, 6).answer)).toEqual(['9π', '18', '9π - 18'])
    },
    HEAVY,
  )

  it(
    '60° and radius 4: (8π)/3, 4√3, (8π)/3 - 4√3',
    () => {
      const a = handSegment(60, 4).answer
      // 60/360 · 16π = 8π/3; 16√3/4 = 4√3.
      expect(answers(a)).toEqual(['(8π)/3', '4√3', '(8π)/3 - 4√3'])
      expect(gradeGeoStage(a, 'c', '8pi/3 - 4sqrt(3)').verdict).toBe('correct')
    },
    HEAVY,
  )
})
