/**
 * Hand-worked textbook problems through the builders the templates use: each answer worked out by hand in the test's
 * name, checked as she would type it, the slip named, and the worked solution showing the real steps.
 */
import { describe, expect, it } from 'vitest'
import { q } from '@/engine/trig'
import { arcProblem, convertDecimalProblem, convertProblem, coterminalProblem, referenceProblem } from '../angleMeasure'
import { exactProblem, pointProblem } from '../unitCircle'
import { gradeTrigPart } from './parts'
import { plain } from './text'
import type { TrigPart } from '@/content/types'

function check(part: TrigPart, right: string[], slips: [string, string][] = []) {
  expect(right).toContain(part.answerText)
  for (const t of right) expect(gradeTrigPart(part, t).verdict, `“${t}”`).toBe('correct')
  for (const [t, id] of slips) {
    const g = gradeTrigPart(part, t)
    expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `“${t}”`).toBe(id)
  }
}

const words = (lines: string[]) => lines.map(plain).join(' ')

describe('hand-worked: converting', () => {
  it('150° = 150 · π/180 = 5π/6 (5/6 drops the π)', () => {
    const d = convertProblem({ deg: q(150), to: 'rad' })
    expect(plain(d.prompt)).toBe('Convert 150° to radians. Give the exact answer in terms of π.')
    check(d.stages[0]!, ['5π/6', '5pi/6', '(5/6)π'], [['5/6', 'trig_pi_dropped']])
    expect(words(d.stages[0]!.reveal)).toContain('150/180 = 5/6')
  })

  it('72° = 72π/180 = 2π/5', () => {
    check(convertProblem({ deg: q(72), to: 'rad' }).stages[0]!, ['2π/5'], [['2/5', 'trig_pi_dropped']])
  })

  it('−7π/4 = −7/4 · 180° = −315° (−315π keeps the π)', () => {
    const d = convertProblem({ deg: q(-315), to: 'deg' })
    check(d.stages[0]!, ['-315', '-315°', '−315 degrees'], [['-315π', 'trig_pi_kept']])
    expect(words(d.stages[0]!.reveal)).toContain('−7/4 · 180° = −315°')
  })

  it('2.5 radians = 2.5 · 180°/π ≈ 143.2° (2.5 · 180 = 450 leaves out π)', () => {
    const d = convertDecimalProblem({ given: 2.5, from: 'rad', places: 1 })
    check(d.stages[0]!, ['143.2', '143.2°', '143.24'], [['450', 'trig_pi_dropped']])
    expect(gradeTrigPart(d.stages[0]!, '143').verdict).toBe('invalid')
  })

  it('40° = 2π/9 ≈ 0.70 radians', () => {
    check(convertDecimalProblem({ given: 40, from: 'deg', places: 2 }).stages[0]!, ['0.70', '0.698'], [['0.22', 'trig_pi_dropped']])
  })
})

describe('hand-worked: coterminal angles', () => {
  it('−510° + 360° = −150°, still negative; + 360° = 210°', () => {
    const d = coterminalProblem({ deg: q(-510), unit: 'deg' })
    check(d.stages[0]!, ['210', '210°'], [
      ['-150', 'trig_coterminal_short'],
      ['30', 'trig_coterminal_half_turn'],
      ['150', 'trig_negative_direction'],
    ])
    expect(words(d.stages[0]!.reveal)).toContain('−510° + 360° = −150°, still negative')
    expect(words(d.stages[0]!.reveal)).toContain('−150° + 360° = 210°')
  })

  it('23π/6 − 2π = 11π/6', () => {
    const d = coterminalProblem({ deg: q(690), unit: 'rad' })
    check(d.stages[0]!, ['11π/6', '11pi/6'], [['11/6', 'trig_pi_dropped']])
    expect(words(d.stages[0]!.reveal)).toContain('23π/6 − 2π = 11π/6')
  })

  it('−11π/4 + 2π = −3π/4, + 2π = 5π/4', () => {
    check(coterminalProblem({ deg: q(-495), unit: 'rad' }).stages[0]!, ['5π/4'], [
      ['-3π/4', 'trig_coterminal_short'],
      ['3π/4', 'trig_negative_direction'],
    ])
  })
})

describe('hand-worked: quadrant and reference angle', () => {
  it('7π/6 is in Quadrant III; its reference angle is 7π/6 − π = π/6', () => {
    const d = referenceProblem({ deg: q(210), unit: 'rad' })
    check(d.stages[0]!, ['Q3'], [])
    check(d.stages[1]!, ['π/6', 'pi/6'], [
      ['π/3', 'trig_reference_from_y_axis'],
      ['-π/6', 'trig_reference_wrong_way'],
      ['7π/6', 'trig_reference_is_coterminal'],
    ])
    expect(words(d.stages[1]!.reveal)).toContain('7π/6 − π = π/6')
  })

  it('−120° turns clockwise into Quadrant III (counterclockwise it would be Quadrant II); reference 60°', () => {
    const d = referenceProblem({ deg: q(-120), unit: 'deg' })
    check(d.stages[0]!, ['Q3'], [['Q2', 'trig_negative_direction']])
    check(d.stages[1]!, ['60'], [['30', 'trig_reference_from_y_axis']])
  })

  it('300° is in Quadrant IV: 360° − 300° = 60°; 300° − 180° = 120° measures to the wrong part of the axis', () => {
    const d = referenceProblem({ deg: q(300), unit: 'deg' })
    check(d.stages[1]!, ['60', '60°'], [['120', 'trig_reference_wrong_way']])
  })

  it('−270° lies on the positive y-axis: one part, no reference angle', () => {
    const d = referenceProblem({ deg: q(-270), unit: 'deg' })
    expect(d.stages).toHaveLength(1)
    check(d.stages[0]!, ['axis'])
    expect(gradeTrigPart(d.stages[0]!, 'Q2').verdict).toBe('wrong')
  })
})

describe('hand-worked: the six functions at special angles', () => {
  it('sin(−225°): −225° + 360° = 135°, Quadrant II, reference 45°, sine positive: √2/2', () => {
    const d = exactProblem({ fn: 'sin', deg: q(-225), unit: 'deg' })
    check(d.stages[0]!, ['√2/2', 'sqrt(2)/2'], [['-√2/2', 'trig_sign_quadrant']])
    const w = words(d.stages[0]!.reveal)
    expect(w).toContain('−225° + 360° = 135°')
    expect(w).toContain('its reference angle is 45°')
    expect(w).toContain('sin is positive')
  })

  it('tan(3π/2): the point is (0, −1), y/x = −1/0: undefined (0 is the slip)', () => {
    const d = exactProblem({ fn: 'tan', deg: q(270), unit: 'rad' })
    check(d.stages[0]!, ['undefined', 'DNE'], [['0', 'trig_zero_for_undefined']])
    expect(words(d.stages[0]!.reveal)).toContain('the bottom is zero')
  })

  it('cos 150° = −√3/2 (√3/2 has the wrong sign; 1/2 is sin)', () => {
    check(exactProblem({ fn: 'cos', deg: q(150), unit: 'deg' }).stages[0]!, ['-√3/2'], [
      ['√3/2', 'trig_sign_quadrant'],
      ['1/2', 'trig_sin_cos_swapped'],
    ])
  })

  it('csc(π/6) = 1/sin(π/6) = 2 (1/2 is sin itself)', () => {
    const d = exactProblem({ fn: 'csc', deg: q(30), unit: 'rad' })
    check(d.stages[0]!, ['2'], [['1/2', 'trig_reciprocal_missing']])
    expect(words(d.stages[0]!.reveal)).toContain('sin(π/6) = 1/2, so csc(π/6) = 1/(1/2) = 2')
  })

  it('cot 90° = 0/1 = 0 ("undefined" is the slip)', () => {
    check(exactProblem({ fn: 'cot', deg: q(90), unit: 'deg' }).stages[0]!, ['0'], [['undefined', 'trig_undefined_for_zero']])
  })

  it('tan(13π/6) = tan(π/6) = √3/3 (√3 is cot)', () => {
    check(exactProblem({ fn: 'tan', deg: q(390), unit: 'rad' }).stages[0]!, ['√3/3'], [['√3', 'trig_tan_inverted']])
  })
})

describe('hand-worked: a point on the terminal side', () => {
  it('(−3, 4): r = √(9 + 16) = 5 and cos θ = −3/5', () => {
    const d = pointProblem({ x: -3, y: 4, fns: ['cos'] })
    check(d.stages[0]!, ['5'], [['25', 'trig_r_not_rooted']])
    check(d.stages[1]!, ['-3/5', '-0.6'], [
      ['-3', 'trig_r_left_out'],
      ['3/5', 'trig_sign_quadrant'],
      ['4/5', 'trig_sin_cos_swapped'],
    ])
    expect(words(d.stages[0]!.reveal)).toContain('√((−3)² + 4²) = √(9 + 16) = √25 = 5')
  })

  it('(−2, 3): r = √13, sin θ = 3/√13 = 3√13/13 (3/√13 is the same number, not yet simplest form)', () => {
    const d = pointProblem({ x: -2, y: 3, fns: ['sin', 'tan'] })
    check(d.stages[0]!, ['√13', 'sqrt(13)'], [['13', 'trig_r_not_rooted']])
    check(d.stages[1]!, ['3√13/13'], [['3', 'trig_r_left_out']])
    expect(gradeTrigPart(d.stages[1]!, '3/√13').verdict).toBe('invalid')
    check(d.stages[2]!, ['-3/2', '-1.5'], [['-2/3', 'trig_tan_inverted']])
  })
})

describe('hand-worked: arc length and sector area', () => {
  it('a 6 cm radius and 2π/3: s = 6 · 2π/3 = 4π cm (12π is the sector’s area)', () => {
    const d = arcProblem({ r: 6, theta: { kind: 'rad', deg: q(120) }, what: 'arc', unit: 'cm', context: 'plain', places: null })
    check(d.stages[0]!, ['4π', '4π cm', '4pi'], [
      ['12π', 'trig_arc_sector_swapped'],
      ['4', 'trig_pi_dropped'],
    ])
  })

  it('a pendulum 24 inches long through 40°: 40° = 2π/9, s = 16π/3 ≈ 16.8 in (24 · 40 = 960 uses degrees)', () => {
    const d = arcProblem({ r: 24, theta: { kind: 'deg', deg: q(40) }, what: 'arc', unit: 'in', context: 'pendulum', places: 1 })
    expect(plain(d.prompt)).toMatch(/^A pendulum 24 inches long swings through an angle of 40°/)
    check(d.stages[0]!, ['16.8', '16.8 in', '16.76 inches'], [['960', 'trig_arc_degrees']])
    expect(words(d.stages[0]!.reveal)).toContain('40° · π/180° = 2π/9')
  })

  it('a sprinkler 15 ft through 120°: A = 1/2 · 15² · 2π/3 = 75π ≈ 235.6 ft²', () => {
    const d = arcProblem({ r: 15, theta: { kind: 'deg', deg: q(120) }, what: 'area', unit: 'ft', context: 'sprinkler', places: 1 })
    check(d.stages[0]!, ['235.6', '235.6 ft²', '235.6 square feet'], [
      ['471.2', 'trig_sector_no_half'],
      ['15.7', 'trig_sector_r_not_squared'],
      ['13500', 'trig_arc_degrees'],
    ])
  })
})
