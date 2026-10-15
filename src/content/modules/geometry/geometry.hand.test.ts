import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ModuleId } from '@/shared/types'
import { gradeGeoStage, type GeometryAnswer } from '.'

function geo(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error('not geometry')
  return p.answer
}

function text(a: GeometryAnswer, id: GeometryAnswer['stages'][number]['id']): string {
  const stage = a.stages.find((s) => s.id === id)
  if (!stage) throw new Error(`no ${id}`)
  return stage.answerText
}

function trap(a: GeometryAnswer, id: string): string {
  for (const stage of a.stages) {
    const hit = stage.traps.find((t) => t.id === id)
    if (hit) return hit.text
  }
  throw new Error(`no trap ${id}`)
}

describe('hand-worked geometry', () => {
  it('segment addition: AB = 2x + 3, BC = 5x − 4, AC = 41', () => {
    const a = geo('geoSegments', 'gs.addition', 1)
    // (2x + 3) + (5x − 4) = 41 → 7x − 1 = 41 → x = 6. AB = 15, BC = 26.
    expect(a.prompt).toContain('AB = 2x + 3')
    expect(a.prompt).toContain('BC = 5x − 4')
    expect(a.prompt).toContain('AC = 41')
    expect(text(a, 'x')).toBe('6')
    expect(text(a, 'result')).toBe('15')
    expect(a.lengths).toEqual([15, 26, 41])
    // 2x + 3 = 5x − 4 → x = 7/3. 2x + 3 = 41 → x = 19. Copying x, or copying AC.
    expect(trap(a, 'geo_parts_equal')).toBe('7/3')
    expect(trap(a, 'geo_part_equals_whole')).toBe('19')
    expect(trap(a, 'geo_answered_x')).toBe('6')
    expect(trap(a, 'geo_half_for_whole')).toBe('41')
    expect(a.trap).toBe('geo_parts_equal')
    expect(gradeGeoStage(a, 'x', '7/3').verdict).toBe('mistake')
    expect(gradeGeoStage(a, 'result', '6')).toMatchObject({ verdict: 'mistake', mistake: 'geo_answered_x' })
    expect(gradeGeoStage(a, 'result', '41')).toMatchObject({ verdict: 'mistake', mistake: 'geo_half_for_whole' })
    expect(gradeGeoStage(a, 'result', '15').verdict).toBe('correct')
  })

  it('midpoint: AM = 3x + 5, MB = 5x − 7, so AB = 46', () => {
    const a = geo('geoSegments', 'gs.midpoint', 1)
    // 3x + 5 = 5x − 7 → x = 6. Each half is 23, and the whole is 46.
    expect(a.prompt).toContain('AM = 3x + 5')
    expect(a.prompt).toContain('MB = 5x − 7')
    expect(text(a, 'x')).toBe('6')
    expect(text(a, 'result')).toBe('46')
    expect(trap(a, 'geo_half_for_whole')).toBe('23')
    expect(trap(a, 'geo_answered_x')).toBe('6')
    expect(a.stages.flatMap((s) => s.traps).some((t) => t.id === 'geo_parts_equal')).toBe(false)
    expect(gradeGeoStage(a, 'result', '23')).toMatchObject({ verdict: 'mistake', mistake: 'geo_half_for_whole' })
    expect(gradeGeoStage(a, 'result', '46').verdict).toBe('correct')
  })

  it('angle addition uses the same numbers and asks for m∠ABD', () => {
    const a = geo('geoAngles', 'ga.addition', 1)
    expect(a.prompt).toContain('m∠ABD = 2x + 3')
    expect(a.prompt).toContain('m∠DBC = 5x − 4')
    expect(a.prompt).toContain('m∠ABC = 41')
    expect(text(a, 'x')).toBe('6')
    expect(text(a, 'result')).toBe('15')
    expect(a.angles).toEqual([15, 26, 41])
    expect(gradeGeoStage(a, 'x', '19')).toMatchObject({ verdict: 'mistake', mistake: 'geo_part_equals_whole' })
  })

  it('bisector: m∠ABD = 4x + 6, m∠DBC = 7x − 9, so m∠ABC = 52', () => {
    const a = geo('geoAngles', 'ga.bisector', 1)
    // 4x + 6 = 7x − 9 → x = 5. Each half is 26, and the whole is 52.
    expect(text(a, 'x')).toBe('5')
    expect(text(a, 'result')).toBe('52')
    expect(a.angles).toEqual([26, 52])
    expect(trap(a, 'geo_half_for_whole')).toBe('26')
    expect(a.stages.flatMap((s) => s.traps).some((t) => t.id === 'geo_parts_equal')).toBe(false)
    expect(gradeGeoStage(a, 'result', '26')).toMatchObject({ verdict: 'mistake', mistake: 'geo_half_for_whole' })
  })

  it('complementary: (4x + 2) + (5x + 34) = 90', () => {
    const a = geo('geoAngles', 'ga.pairs', 1)
    // 9x + 36 = 90 → x = 6. The angles are 26° and 64°. Using 180 gives x = 16.
    expect(a.prompt).toContain('complementary')
    expect(a.prompt).not.toMatch(/add to 90/i)
    expect(text(a, 'x')).toBe('6')
    expect(text(a, 'result')).toBe('26')
    expect(a.angles).toEqual([26, 64])
    expect(trap(a, 'geo_comp_supp_swapped')).toBe('16')
    expect(a.trap).toBe('geo_comp_supp_swapped')
    expect(gradeGeoStage(a, 'x', '16')).toMatchObject({ verdict: 'mistake', mistake: 'geo_comp_supp_swapped' })
    expect(gradeGeoStage(a, 'result', '26').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', '64').verdict).toBe('wrong')
  })

  it('an angle is 12 more than twice its complement', () => {
    const a = geo('geoAngles', 'ga.words', 1)
    // a = 2(90 − a) + 12 → 3a = 192 → a = 64. The complement is 26. Using 180 gives 124.
    expect(a.prompt).toBe('An angle measures 12 more than twice its complement. Find the angle.')
    expect(a.stages).toHaveLength(1)
    expect(text(a, 'result')).toBe('64')
    expect(a.angles).toEqual([64, 26])
    expect(trap(a, 'geo_complement_reversed')).toBe('26')
    expect(trap(a, 'geo_comp_supp_swapped')).toBe('124')
    expect(gradeGeoStage(a, 'result', '26')).toMatchObject({ verdict: 'mistake', mistake: 'geo_complement_reversed' })
    expect(gradeGeoStage(a, 'result', '124')).toMatchObject({ verdict: 'mistake', mistake: 'geo_comp_supp_swapped' })
    expect(gradeGeoStage(a, 'result', '64°').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', '64 deg').verdict).toBe('correct')
  })

  it('midpoint of (2, 4) and (8, 10) is (5, 7), not the difference', () => {
    const a = geo('geoSegments', 'gs.coord', 1)
    expect(a.prompt).toBe('Find the midpoint of AB.')
    expect(text(a, 'result')).toBe('(5, 7)')
    expect(trap(a, 'geo_midpoint_subtracted')).toBe('(-3, -3)')
    expect(gradeGeoStage(a, 'result', '(-3, -3)')).toMatchObject({ verdict: 'mistake', mistake: 'geo_midpoint_subtracted' })
    expect(gradeGeoStage(a, 'result', '(5,7)').verdict).toBe('correct')
  })

  it('the other endpoint of A(1, 5) and M(4, 7) is B(7, 9)', () => {
    const a = geo('geoSegments', 'gs.coord', 2)
    // B = 2M − A = (8 − 1, 14 − 5) = (7, 9). Averaging A and M gives (5/2, 6).
    expect(text(a, 'result')).toBe('(7, 9)')
    expect(trap(a, 'geo_endpoint_averaged')).toBe('(5/2, 6)')
    expect(gradeGeoStage(a, 'result', '(5/2, 6)')).toMatchObject({ verdict: 'mistake', mistake: 'geo_endpoint_averaged' })
    expect(gradeGeoStage(a, 'result', '(7, 9)').verdict).toBe('correct')
  })

  it('distance from (0, 0) to (3, 4) is 5, not 7 and not 25', () => {
    const a = geo('geoSegments', 'gs.coord', 3)
    expect(text(a, 'result')).toBe('5')
    expect(trap(a, 'geo_distance_not_squared')).toBe('7')
    expect(trap(a, 'geo_distance_no_root')).toBe('25')
    expect(gradeGeoStage(a, 'result', '7')).toMatchObject({ verdict: 'mistake', mistake: 'geo_distance_not_squared' })
    expect(gradeGeoStage(a, 'result', '25')).toMatchObject({ verdict: 'mistake', mistake: 'geo_distance_no_root' })
    expect(gradeGeoStage(a, 'result', '5').verdict).toBe('correct')
  })

  it('distance from (0, 0) to (2, 4) is 2√5, and √20 is not an attempt', () => {
    const a = geo('geoSegments', 'gs.coord', 6)
    // √(4 + 16) = √20 = 2√5. |Δx| + |Δy| = 6. The square is 20.
    expect(text(a, 'result')).toBe('2√5')
    expect(trap(a, 'geo_distance_not_squared')).toBe('6')
    expect(trap(a, 'geo_distance_no_root')).toBe('20')
    expect(gradeGeoStage(a, 'result', '2sqrt(5)').verdict).toBe('correct')
    expect(gradeGeoStage(a, 'result', '2 sqrt 5').verdict).toBe('correct')
    const unsimplified = gradeGeoStage(a, 'result', '√20')
    expect(unsimplified.verdict).toBe('invalid')
    if (unsimplified.verdict === 'invalid') expect(unsimplified.message.toLowerCase()).toContain('simpl')
    const fortyFive = gradeGeoStage(a, 'result', '√45')
    expect(fortyFive.verdict).toBe('invalid')
  })

  it('an angle is 10 more than its complement', () => {
    const a = geo('geoAngles', 'ga.words', 4)
    // a = (90 − a) + 10 → 2a = 100 → a = 50. The complement is 40. Using 180 gives 95.
    expect(a.prompt).toBe('An angle measures 10 more than its complement. Find the angle.')
    expect(text(a, 'result')).toBe('50')
    expect(a.angles).toEqual([50, 40])
    expect(trap(a, 'geo_complement_reversed')).toBe('40')
    expect(trap(a, 'geo_comp_supp_swapped')).toBe('95')
    expect(gradeGeoStage(a, 'result', '50°').verdict).toBe('correct')
  })

  it('an angle is 12 less than twice its complement', () => {
    const a = geo('geoAngles', 'ga.words', 8)
    // a = 2(90 − a) − 12 → 3a = 168 → a = 56. The complement is 34. Using 180 gives 116.
    expect(a.prompt).toBe('An angle measures 12 less than twice its complement. Find the angle.')
    expect(text(a, 'result')).toBe('56')
    expect(a.angles).toEqual([56, 34])
    expect(trap(a, 'geo_complement_reversed')).toBe('34')
    expect(trap(a, 'geo_comp_supp_swapped')).toBe('116')
  })

  it('an angle is twice its complement', () => {
    const a = geo('geoAngles', 'ga.words', 13)
    // a = 2(90 − a) → a = 60. The complement is 30. Using 180 gives 120.
    expect(a.prompt).toBe('An angle measures twice its complement. Find the angle.')
    expect(text(a, 'result')).toBe('60')
    expect(a.angles).toEqual([60, 30])
    expect(trap(a, 'geo_complement_reversed')).toBe('30')
    expect(trap(a, 'geo_comp_supp_swapped')).toBe('120')
  })

  it('an angle is 12 more than twice its supplement', () => {
    const a = geo('geoAngles', 'ga.words', 17)
    // a = 2(180 − a) + 12 → 3a = 372 → a = 124. The supplement is 56. Using 90 gives 64.
    expect(a.prompt).toBe('An angle measures 12 more than twice its supplement. Find the angle.')
    expect(text(a, 'result')).toBe('124')
    expect(a.angles).toEqual([124, 56])
    expect(trap(a, 'geo_complement_reversed')).toBe('56')
    expect(trap(a, 'geo_comp_supp_swapped')).toBe('64')
  })

  it('an angle is four times its supplement', () => {
    const a = geo('geoAngles', 'ga.words', 26)
    // a = 4(180 − a) → a = 144. The supplement is 36. Using 90 gives 72.
    expect(a.prompt).toBe('An angle measures four times its supplement. Find the angle.')
    expect(text(a, 'result')).toBe('144')
    expect(a.angles).toEqual([144, 36])
    expect(trap(a, 'geo_complement_reversed')).toBe('36')
    expect(trap(a, 'geo_comp_supp_swapped')).toBe('72')
    expect(gradeGeoStage(a, 'result', '144 deg').verdict).toBe('correct')
  })
})
