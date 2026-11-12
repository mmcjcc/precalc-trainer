/**
 * Hand-worked area problems. The numbers are worked here with plain arithmetic, then held against the
 * generator's answers and the named slips.
 */
import { describe, expect, it } from 'vitest'
import { gradeGeoStage } from './grade'
import {
  handEquilateral6,
  handHex4,
  handIso13,
  handIsoTrap,
  handKite98,
  handOctagon65,
  handPara14810,
  handRectMissing,
  handRectangle85,
  handRhombus1024,
  handRight512,
  handSquareR6,
  handTrapezoid6104,
  handTri30,
  handTri45,
  handTriangle106,
} from './unit9Polygons'

function texts(built: { answer: { stages: { id: string; answerText: string; traps: { id: string; text: string }[] }[] } }) {
  return built.answer.stages.map((s) => `${s.id}=${s.answerText} [${s.traps.map((t) => `${t.id}:${t.text}`).join(', ')}]`)
}

describe('hand-worked areas of polygons', () => {
  it('a triangle with base 10 and height 6 has area 30', () => {
    const a = handTriangle106().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['30'])
    expect(a.stages[0]!.traps.map((t) => t.id)).toEqual(['geo_area_not_halved', 'geo_slant_as_height'])
    expect(a.stages[0]!.traps.map((t) => t.text)).toEqual(['60', '10√34'])
  })

  it('a trapezoid with bases 6 and 10 and height 4 has area 32', () => {
    const a = handTrapezoid6104().answer
    expect(a.stages[0]!.answerText).toBe('32')
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '64'],
      ['geo_bases_multiplied', '120'],
    ])
  })

  it('a rhombus with diagonals 10 and 24 has area 120', () => {
    const a = handRhombus1024().answer
    expect(a.stages[0]!.answerText).toBe('120')
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '240'],
      ['geo_perimeter_for_area', '52'],
    ])
  })

  it('an equilateral triangle of side 6 has height 3√3 and area 9√3', () => {
    const a = handEquilateral6().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['3√3', '9√3'])
    expect(a.stages[0]!.traps.some((t) => t.id === 'geo_half_not_taken' && t.text === '6√3')).toBe(true)
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '18√3'],
      ['geo_slant_as_height', '18'],
    ])
  })

  it('an isosceles triangle with legs 13 and base 10 has height 12 and area 60', () => {
    const a = handIso13().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['12', '60'])
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['trig_pythag_added', '√194'],
      ['trig_side_not_rooted', '144'],
      ['geo_half_not_taken', '√69'],
    ])
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '120'],
      ['geo_slant_as_height', '65'],
    ])
  })

  it('a rectangle 8 by 5 has area 40, and half of that is the slip', () => {
    const a = handRectangle85().answer
    expect(a.stages[0]!.answerText).toBe('40')
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_half_applied', '20'],
      ['geo_perimeter_for_area', '26'],
    ])
  })

  it('a parallelogram with base 14, height 8 and slant 10 has area 112', () => {
    const a = handPara14810().answer
    expect(a.stages[0]!.answerText).toBe('112')
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_slant_as_height', '140'],
      ['geo_half_applied', '56'],
    ])
  })

  it('a kite with diagonals 9 and 8 has area 36', () => {
    const a = handKite98().answer
    expect(a.stages[0]!.answerText).toBe('36')
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([['geo_area_not_halved', '72']])
    expect(a.prompt).toMatch(/kite/)
  })

  it('a 5-12-13 right triangle has hypotenuse 13 and area 30', () => {
    const a = handRight512().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['13', '30'])
    expect(a.stages[0]!.traps.map((t) => t.id)).toContain('trig_side_not_rooted')
    expect(a.stages[0]!.traps.find((t) => t.id === 'trig_side_not_rooted')!.text).toBe('169')
    expect(a.stages[0]!.traps.find((t) => t.id === 'trig_pythag_subtracted')!.text).toBe('√119')
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '60'],
      ['geo_slant_as_height', '65/2'],
    ])
  })

  it('a 30-60-90 triangle with short leg 6 has height 6√3 and area 18√3', () => {
    const a = handTri30().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['6√3', '18√3'])
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '36√3'],
      ['geo_slant_as_height', '36'],
    ])
  })

  it('a 45-45-90 triangle with hypotenuse 10 has leg 5√2 and area 25', () => {
    const a = handTri45().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['5√2', '25'])
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '50'],
      ['geo_slant_as_height', '25√2'],
    ])
  })

  it('an isosceles trapezoid with bases 6 and 16 and leg 13 has height 12 and area 132', () => {
    const a = handIsoTrap().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['12', '132'])
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['trig_pythag_added', '√194'],
      ['trig_side_not_rooted', '144'],
      ['geo_half_not_taken', '√69'],
    ])
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '264'],
      ['geo_bases_multiplied', '576'],
    ])
  })

  it('a square with radius 6 has apothem 3√2 and area 72', () => {
    const a = handSquareR6().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['3√2', '72'])
    expect(a.stages[0]!.traps[0]).toMatchObject({ id: 'geo_apothem_for_radius', text: '6' })
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '144'],
      ['geo_perimeter_for_area', '24√2'],
    ])
  })

  it('a rectangle of area 48 and height 6 has base 8', () => {
    const a = handRectMissing().answer
    expect(a.stages[0]!.answerText).toBe('8')
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([['geo_half_applied', '4']])
    expect(a.prompt).toMatch(/area of the rectangle is 48 cm²/)
  })
})

describe('hand-worked regular polygons', () => {
  it('a regular hexagon of side 4 has apothem 2√3 and area 24√3', () => {
    const a = handHex4().answer
    expect(a.stages.map((s) => s.answerText)).toEqual(['2√3', '24√3'])
    expect(a.stages[0]!.traps[0]).toMatchObject({ id: 'geo_apothem_for_radius', text: '4' })
    expect(a.stages[0]!.traps.some((t) => t.id === 'geo_half_not_taken' && t.text === '4√3')).toBe(true)
    expect(a.stages[1]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '48√3'],
      ['geo_perimeter_for_area', '24'],
    ])
  })

  it('a regular octagon with apothem 6 and side 5 has area 120', () => {
    const a = handOctagon65().answer
    expect(a.stages[0]!.answerText).toBe('120')
    expect(a.stages[0]!.traps.map((t) => [t.id, t.text])).toEqual([
      ['geo_area_not_halved', '240'],
      ['geo_perimeter_for_area', '40'],
    ])
    expect(a.prompt).toMatch(/apothem of 6 cm and a side of 5 cm/)
  })
})

describe('a correct radical left unsimplified', () => {
  it('quotes what she typed and does not name a mistake or show the simplified value', () => {
    const a = handEquilateral6().answer
    const g = gradeGeoStage(a, 'a', 'sqrt(27)')
    expect(g.verdict).toBe('invalid')
    if (g.verdict !== 'invalid') return
    expect(g.message).toContain('√(27)')
    expect(g.message).not.toContain('3√3')
    expect(texts({ answer: a }).join(' ')).toContain('3√3')
  })
})
