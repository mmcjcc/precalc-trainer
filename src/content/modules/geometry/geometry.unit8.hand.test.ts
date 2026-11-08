/**
 * Fifteen hand-worked circle problems. The numbers are worked here with plain arithmetic, then held against the
 * problem the builder ships. A radical left unsimplified is a note, and that note does not print the simplified value.
 */
import { describe, expect, it } from 'vitest'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import { gradeGeoStage, type GeoGrade } from './grade'
import {
  handChordDistance,
  handConverseNo,
  handConverseYes,
  handTangentHypotenuse,
  handTangentRadical,
} from './unit8Tangent'
import { handCyclic, handInscribed86, handInside90, handSemicircleAngle, handTwoTangentAngle } from './unit8Angles'
import { handChordParts, handCircleGeneral, handCircleRead, handSecants, handTangentSecant } from './unit8Measures'

function said(g: GeoGrade): string {
  return g.verdict === 'mistake' ? g.witness : g.verdict === 'invalid' || g.verdict === 'wrong' ? g.message : ''
}

function trap(a: GeometryAnswer, id: string, text: string) {
  const hit = a.stages.flatMap((s) => s.traps.filter((t) => t.id === id).map((t) => ({ stage: s.id, text: t.text })))
  expect(hit.map((t) => t.text), id).toContain(text)
  const stage = hit.find((t) => t.text === text)!.stage
  expect(gradeGeoStage(a, stage, text), `${id} ${text}`).toMatchObject({ verdict: 'mistake', mistake: id })
}

function correct(a: GeometryAnswer, id: GeometryStageId, text: string) {
  expect(a.stages.find((s) => s.id === id)?.answerText).toBe(text)
  expect(gradeGeoStage(a, id, text).verdict).toBe('correct')
}

function note(a: GeometryAnswer, id: GeometryStageId, typed: string, hidden: string) {
  const g = gradeGeoStage(a, id, typed)
  expect(g.verdict, typed).toBe('invalid')
  expect(said(g), typed).toMatch(/simplest|perfect square/)
  expect(said(g), typed).not.toContain(hidden)
}

describe('hand-worked tangents, arcs, and chords', () => {
  it('a tangent from 8 cm out to a circle of radius 6 is √28 = 2√7', () => {
    const a = handTangentRadical().answer
    expect(a.prompt).toContain('OT is 6 cm')
    expect(a.prompt).toContain('is 8 cm')
    expect(Math.sqrt(28)).toBeCloseTo(2 * Math.sqrt(7), 12)
    correct(a, 'a', '2√7')
    trap(a, 'trig_pythag_added', '10')
    trap(a, 'trig_side_not_rooted', '28')
    note(a, 'a', 'sqrt(28)', '2√7')
    expect(gradeGeoStage(a, 'a', '2√7').verdict).toBe('correct')
  })

  it('legs 5 and 12 give a hypotenuse of 13, and subtracting the squares is the other slip', () => {
    const a = handTangentHypotenuse().answer
    expect(a.prompt).toContain('OT is 5 cm')
    expect(a.prompt).toContain('is 12 cm')
    expect(5 * 5 + 12 * 12).toBe(169)
    expect(Math.abs(25 - 144)).toBe(119)
    correct(a, 'a', '13')
    trap(a, 'trig_pythag_subtracted', '√119')
    trap(a, 'trig_side_not_rooted', '169')
    note(a, 'a', 'sqrt(169)', '13')
  })

  it('6-8-10 is a tangent: the right angle is at the point of tangency, and it is not marked', () => {
    const a = handConverseYes().answer
    expect(a.prompt).toContain('OT is 6 cm')
    expect(a.prompt).toContain('PT is 8 cm')
    expect(a.prompt).toContain('OP is 10 cm')
    expect(6 * 6 + 8 * 8).toBe(10 * 10)
    correct(a, 'a', 'yes')
    trap(a, 'geo_tangent_right_vertex', 'wrong')
    expect(a.figure.angles ?? []).toEqual([])
  })

  it('5-12-13 with the right angle at the center is not a tangent, and no right angle is marked', () => {
    const a = handConverseNo().answer
    expect(a.prompt).toContain('OT is 5 cm')
    expect(a.prompt).toContain('PT is 13 cm')
    expect(a.prompt).toContain('OP is 12 cm')
    expect(5 * 5 + 12 * 12).toBe(13 * 13)
    expect(5 * 5 + 13 * 13).not.toBe(12 * 12)
    correct(a, 'a', 'no')
    trap(a, 'geo_tangent_right_vertex', 'wrong')
    expect(a.figure.angles ?? []).toEqual([])
  })

  it('a radius 10 perpendicular to a 16-chord sits 6 from the center', () => {
    const a = handChordDistance().answer
    expect(a.prompt).toContain('OA is 10')
    expect(a.prompt).toContain('AB is 16')
    expect(6 * 6 + 8 * 8).toBe(10 * 10)
    correct(a, 'a', '6')
    trap(a, 'trig_pythag_added', '2√41')
    trap(a, 'trig_side_not_rooted', '36')
    expect(a.stages[0]!.traps.some((t) => t.id === 'geo_half_not_taken')).toBe(false)
  })
})

describe('hand-worked inscribed and other angles', () => {
  it('an inscribed angle on an 86° arc is 43°', () => {
    const a = handInscribed86().answer
    expect(a.prompt).toContain('86 degrees')
    expect(86 / 2).toBe(43)
    correct(a, 'a', '43')
    trap(a, 'geo_inscribed_not_halved', '86')
  })

  it('opposite an inscribed 70° is 110°', () => {
    const a = handCyclic().answer
    expect(a.prompt).toContain('70 degrees')
    expect(180 - 70).toBe(110)
    correct(a, 'a', '110')
    trap(a, 'geo_cyclic_not_supplementary', '70')
    expect(a.prompt.toLowerCase()).not.toContain('add to 180')
  })

  it('35° in a triangle inscribed in a semicircle leaves 55°, and the right angle is not marked', () => {
    const a = handSemicircleAngle().answer
    expect(a.prompt).toContain('35 degrees')
    expect(a.prompt).toContain('inscribed in a semicircle')
    expect(90 - 35).toBe(55)
    expect(180 - 35).toBe(145)
    correct(a, 'a', '55')
    trap(a, 'geo_semicircle_right_missed', '145')
    expect((a.figure.angles ?? []).some((g) => g.right)).toBe(false)
  })

  it('two chords over arcs 70° and 110° make an angle of 90°', () => {
    const a = handInside90().answer
    expect(a.prompt).toContain('70 degrees')
    expect(a.prompt).toContain('110 degrees')
    expect((70 + 110) / 2).toBe(90)
    expect(Math.abs(110 - 70) / 2).toBe(20)
    correct(a, 'a', '90')
    trap(a, 'geo_half_sum_difference_swapped', '20')
  })

  it('two tangents over a near arc of 110° see an angle of 70°', () => {
    const a = handTwoTangentAngle().answer
    expect(a.prompt).toContain('110 degrees')
    expect((360 - 110 - 110) / 2).toBe(70)
    expect(180 - 110).toBe(70)
    correct(a, 'a', '70')
    trap(a, 'geo_half_sum_difference_swapped', '180')
  })
})

describe('hand-worked lengths and circle equations', () => {
  it('chords crossing with parts 3, 8, and 4 give 6', () => {
    const a = handChordParts().answer
    expect(a.prompt).toContain('AE is 3')
    expect(a.prompt).toContain('EB is 8')
    expect(a.prompt).toContain('CE is 4')
    expect((3 * 8) / 4).toBe(6)
    expect((3 * 4) / 8).toBe(1.5)
    correct(a, 'a', '6')
    trap(a, 'geo_chord_parts_crossed', '3/2')
  })

  it('two secants 4×9 = 3×12, and outside times the inside part is 20/3', () => {
    const a = handSecants().answer
    expect(a.prompt).toContain('PA is 4')
    expect(a.prompt).toContain('PB is 9')
    expect(a.prompt).toContain('PC is 3')
    expect((4 * 9) / 3).toBe(12)
    expect((4 * (9 - 4)) / 3).toBeCloseTo(20 / 3, 12)
    correct(a, 'a', '12')
    trap(a, 'geo_secant_part_not_whole', '20/3')
  })

  it('a tangent with outside 4 and whole 7 is √28 = 2√7, and skipping the square gives 7/4', () => {
    const a = handTangentSecant().answer
    expect(a.prompt).toContain('PA is 4')
    expect(a.prompt).toContain('PB is 7')
    expect(4 * 7).toBe(28)
    expect(7 / 4).toBe(1.75)
    correct(a, 'a', '2√7')
    trap(a, 'geo_tangent_not_squared', '7/4')
    trap(a, 'trig_side_not_rooted', '28')
    note(a, 'a', 'sqrt(28)', '2√7')
  })

  it('(x−3)² + (y+2)² = 25 has center (3, −2) and radius 5', () => {
    const a = handCircleRead().answer
    expect(a.prompt).toContain('(x − 3)² + (y + 2)² = 25')
    correct(a, 'a', '(3, -2)')
    correct(a, 'b', '5')
    trap(a, 'geo_center_signs_flipped', '(-3, 2)')
    trap(a, 'geo_radius_unsquared', '25')
    trap(a, 'geo_diameter_for_radius', '10')
    expect(a.stages[0]!.reveal.join('\n')).not.toMatch(/(?:^|[^0-9])5(?![0-9])/)
    const degrees = gradeGeoStage(a, 'a', '(3, -2)°')
    expect(degrees.verdict).toBe('invalid')
    expect(said(degrees)).not.toContain('(3, -2)')
    const O = a.figure.points.find((p) => p.id === 'O')!
    expect(O.x).toBeCloseTo(3, 6)
    expect(O.y).toBeCloseTo(-2, 6)
    expect(a.figure.circles?.[0]?.r).toBe(5)
  })

  it('x² + y² − 6x + 4y − 12 = 0 completes to center (3, −2), radius 5', () => {
    const a = handCircleGeneral().answer
    expect(a.prompt).toContain('x² + y² − 6x + 4y − 12 = 0')
    const h = -(-6) / 2
    const k = -4 / 2
    const r2 = h * h + k * k - -12
    expect(h).toBe(3)
    expect(k).toBe(-2)
    expect(r2).toBe(25)
    correct(a, 'a', '(3, -2)')
    correct(a, 'b', '5')
    trap(a, 'geo_center_signs_flipped', '(-3, 2)')
    trap(a, 'geo_radius_unsquared', '25')
    trap(a, 'geo_diameter_for_radius', '10')
    expect(a.stages[0]!.reveal.join('\n')).not.toMatch(/(?:^|[^0-9])5(?![0-9])/)
  })
})
