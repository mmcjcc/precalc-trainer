/**
 * Hand-worked examples for Unit 7, second half. The numbers are the textbook's, worked here with plain Math and then
 * held against the problem the builder ships. A note (lowest terms, simplest radical, rounding) is not a correct
 * answer and does not name the answer.
 */
import { describe, expect, it } from 'vitest'
import { gradeGeoStage, type GeoGrade } from './grade'
import { int, sqrtQ } from './unit7Build'
import { angleProblem, ratioProblem, sideProblem, tanDegrees, type AngleFixed, type RatioFixed, type SideFixed } from './unit7bRatios'
import { storyProblem, twoProblem, type StoryFixed, type TwoFixed } from './unit7bElev'
import type { GeometryAnswer } from '@/content/types'

const RAD = Math.PI / 180
const HEAVY = 120_000

function roundAway(v: number, places: number): string {
  const f = 10 ** places
  const r = Math.floor(Math.abs(v) * f + 0.5 + 1e-9) / f
  return (v < 0 ? '-' : '') + r.toFixed(places)
}

function said(g: GeoGrade): string {
  return g.verdict === 'mistake' ? g.witness : g.message
}

function grade(a: GeometryAnswer, text: string): GeoGrade {
  return gradeGeoStage(a, a.stages[0]!.id, text)
}

function expectNote(a: GeometryAnswer, typed: string, pattern: RegExp) {
  const g = grade(a, typed)
  expect(g.verdict, typed).not.toBe('correct')
  expect(g.verdict, typed).not.toBe('mistake')
  expect(said(g), typed).toMatch(pattern)
  expect(said(g), typed).not.toContain(a.stages[0]!.answerText)
}

describe('hand-worked ratios, sides, and angles', () => {
  it('tan 35° is about 0.7002, and a side from it rounds to the hundredth', () => {
    expect(tanDegrees(35)).toBeCloseTo(0.7002, 4)
    const a = sideProblem({ deg: 35, known: 'adj', asked: 'opp', value: 10, places: 2 })
    const want = roundAway(10 * Math.tan(35 * RAD), 2)
    expect(a.stages[0]!.answerText).toBe(want)
    expect(Number(want)).toBeCloseTo(7.0, 2)
    expect(grade(a, want).verdict).toBe('correct')
    expectNote(a, roundAway(10 * Math.tan(35 * RAD), 1), /rounded too far/)
  })

  it('in a 6-8-10 triangle the angle opposite 6 has sin 3/5 and tan 3/4, and an unreduced fraction is a note', () => {
    const sides = { opp: int(6), adj: int(8), hyp: int(10) }
    const sin = ratioProblem({ ...sides, fn: 'sin', mode: 'fraction' })
    expect(sin.stages[0]!.answerText).toBe('3/5')
    expect(grade(sin, '3/5').verdict).toBe('correct')
    expect(grade(sin, '0.6').verdict).not.toBe('correct')
    expectNote(sin, '6/10', /lowest terms/)
    const tan = ratioProblem({ ...sides, fn: 'tan', mode: 'fraction' })
    expect(tan.stages[0]!.answerText).toBe('3/4')
    expect(grade(tan, '3/4').verdict).toBe('correct')
    expectNote(tan, '6/8', /lowest terms/)
    // Adjacent over opposite is the tangent upside down.
    const flipped = tan.stages[0]!.traps.find((t) => t.id === 'trig_opposite_adjacent_swapped')
    expect(flipped?.text).toBe('4/3')
    expect(grade(tan, '4/3')).toMatchObject({ verdict: 'mistake', mistake: 'trig_opposite_adjacent_swapped' })
    // The hypotenuse on top of the sine, and a leg where the hypotenuse belongs.
    const sineTraps = sin.stages[0]!.traps.filter((t) => t.id === 'trig_hypotenuse_as_leg').map((t) => t.text)
    expect(sineTraps).toContain('5/3')
    expect(sineTraps).toContain('3/4')
    expect(grade(sin, '5/3')).toMatchObject({ verdict: 'mistake', mistake: 'trig_hypotenuse_as_leg' })
    const cos = ratioProblem({ ...sides, fn: 'cos', mode: 'fraction' })
    expect(cos.stages[0]!.answerText).toBe('4/5')
    expect(grade(cos, '4/5').verdict).toBe('correct')
  })

  it('a radical left unsimplified is the simplest-form note, not a mistake', () => {
    const a = ratioProblem({ opp: sqrtQ(3), adj: int(1), hyp: int(2), fn: 'sin', mode: 'fraction' })
    expect(grade(a, a.stages[0]!.answerText).verdict).toBe('correct')
    expect(a.stages[0]!.answerText.replace(/[()]/g, '')).toBe('√3/2')
    expect(grade(a, 'sqrt(3)/2').verdict).toBe('correct')
    expectNote(a, 'sqrt(12)/4', /simplest/)
  })

  it('naming sine for cosine, or the tangent for a leg and the hypotenuse, is the borrowed slip', () => {
    const sides: RatioFixed = { opp: int(6), adj: int(8), hyp: int(10), fn: 'sin', mode: 'which' }
    const a = ratioProblem(sides)
    expect(a.stages[0]!.answerText).toBe('sin')
    expect(a.prompt.toLowerCase()).not.toContain('sine ratio')
    expect(a.prompt.toLowerCase()).not.toContain('cosine ratio')
    expect(a.prompt.toLowerCase()).not.toContain('tangent ratio')
    expect(grade(a, 'cos')).toMatchObject({ verdict: 'mistake', mistake: 'trig_sin_cos_swapped' })
    expect(grade(a, 'tan')).toMatchObject({ verdict: 'mistake', mistake: 'trig_hypotenuse_as_leg' })
    const tangent: RatioFixed = { ...sides, fn: 'tan' }
    const b = ratioProblem(tangent)
    expect(grade(b, 'sin')).toMatchObject({ verdict: 'mistake', mistake: 'trig_hypotenuse_as_leg' })
  })

  it('finds a side by multiplying or by dividing, and a negative radian-mode value is that mistake', () => {
    const multiply: SideFixed = { deg: 68, known: 'hyp', asked: 'opp', value: 6, places: 2 }
    const up = sideProblem(multiply)
    const upWant = roundAway(6 * Math.sin(68 * RAD), 2)
    expect(up.stages[0]!.answerText).toBe(upWant)
    expect(Number(upWant)).toBeCloseTo(5.56, 2)
    const divide: SideFixed = { deg: 37, known: 'opp', asked: 'hyp', value: 15, places: 2 }
    const down = sideProblem(divide)
    const downWant = roundAway(15 / Math.sin(37 * RAD), 2)
    expect(down.stages[0]!.answerText).toBe(downWant)
    const times = down.stages[0]!.traps.find((t) => t.id === 'trig_hypotenuse_as_leg')
    expect(times).toBeTruthy()
    expect(Number(times!.text)).toBeCloseTo(15 * Math.sin(37 * RAD), 1)
    expect(grade(down, times!.text)).toMatchObject({ verdict: 'mistake', mistake: 'trig_hypotenuse_as_leg' })
    const along: SideFixed = { deg: 23, known: 'hyp', asked: 'adj', value: 20, places: 1 }
    const adj = sideProblem(along)
    expect(adj.stages[0]!.answerText).toBe(roundAway(20 * Math.cos(23 * RAD), 1))
    const rad = adj.stages[0]!.traps.find((t) => t.id === 'trig_radian_mode')
    expect(rad).toBeTruthy()
    expect(Number(rad!.text)).toBeLessThan(0)
    expect(grade(adj, rad!.text)).toMatchObject({ verdict: 'mistake', mistake: 'trig_radian_mode' })
    expect(Number(rad!.text)).toBeCloseTo(20 * Math.cos(23), 1)
  })

  it('tan⁻¹(1) is 45° and sin⁻¹(1/2) is 30°, and the ratio itself is not the angle', () => {
    const fortyFive: AngleFixed = { opp: 8, adj: 8, hyp: Math.hypot(8, 8), known: ['opp', 'adj'], places: 0 }
    const a = angleProblem(fortyFive)
    expect(a.stages[0]!.answerText).toBe('45')
    expect(grade(a, '45').verdict).toBe('correct')
    const thirty: AngleFixed = { opp: 5, adj: Math.sqrt(75), hyp: 10, known: ['opp', 'hyp'], places: 0 }
    const b = angleProblem(thirty)
    expect(b.stages[0]!.answerText).toBe('30')
    expect(grade(b, '30').verdict).toBe('correct')
    const ratio: AngleFixed = { opp: 8, adj: 15, hyp: 17, known: ['opp', 'adj'], places: 0 }
    const c = angleProblem(ratio)
    const skipped = c.stages[0]!.traps.find((t) => t.id === 'trig_ratio_for_angle')
    expect(skipped).toBeTruthy()
    expect(grade(c, skipped!.text)).toMatchObject({ verdict: 'mistake', mistake: 'trig_ratio_for_angle' })
    expect(Number(skipped!.text)).not.toBe(Number(c.stages[0]!.answerText))
  })
})

describe('hand-worked elevation and depression', () => {
  it('a 6 m ladder at 68° reaches about 5.56 m, and a tree at 32° from 25 m is about 15.6 m', () => {
    const ladder: StoryFixed = {
      kind: 'ladder',
      asked: 'opp',
      deg: 68,
      opp: 6 * Math.sin(68 * RAD),
      adj: 6 * Math.cos(68 * RAD),
      hyp: 6,
      show: ['hyp'],
      places: 2,
    }
    const a = storyProblem(ladder)
    expect(a.stages[0]!.answerText).toBe(roundAway(6 * Math.sin(68 * RAD), 2))
    expect(Number(a.stages[0]!.answerText)).toBeCloseTo(5.56, 2)
    expect(a.prompt).toMatch(/ladder 6 meters long/)
    expect(a.prompt).toMatch(/68°/)
    const tree: StoryFixed = {
      kind: 'tree',
      asked: 'opp',
      deg: 32,
      opp: 25 * Math.tan(32 * RAD),
      adj: 25,
      hyp: 25 / Math.cos(32 * RAD),
      show: ['adj'],
      places: 1,
    }
    const b = storyProblem(tree)
    expect(b.stages[0]!.answerText).toBe(roundAway(25 * Math.tan(32 * RAD), 1))
    expect(Number(b.stages[0]!.answerText)).toBeCloseTo(15.6, 1)
    expect(b.prompt).toMatch(/25 meters/)
    expect(b.prompt).toMatch(/angle of elevation/)
    expect(b.prompt).not.toMatch(/\b[Aa]n? \d/)
  })

  it('from a cliff 40 m high at 25° of depression the boat is about 85.8 m out, and the complement is the vertical slip', () => {
    const scene: StoryFixed = {
      kind: 'cliff',
      asked: 'adj',
      deg: 25,
      opp: 40,
      adj: 40 / Math.tan(25 * RAD),
      hyp: 40 / Math.sin(25 * RAD),
      show: ['opp'],
      places: 1,
    }
    const a = storyProblem(scene)
    expect(a.stages[0]!.answerText).toBe(roundAway(40 / Math.tan(25 * RAD), 1))
    expect(Number(a.stages[0]!.answerText)).toBeCloseTo(85.8, 1)
    expect(a.prompt).toMatch(/cliff 40 meters high/)
    expect(a.prompt).toMatch(/angle of depression/)
    expect(a.prompt).not.toMatch(/\b[Aa]n? \d/)
    const dashed = (a.figure.segments ?? []).find((s) => s.dashed)
    expect(dashed).toBeTruthy()
    const marked = (a.figure.angles ?? []).find((g) => g.label && !g.right)!
    const rays = new Set([marked.from, marked.to])
    expect(rays.has(dashed!.from === marked.vertex ? dashed!.to : dashed!.from)).toBe(true)
    const foot = (a.figure.angles ?? []).find((g) => g.right)!.vertex
    expect(rays.has(foot)).toBe(false)
    const complement = a.stages[0]!.traps.find((t) => t.id === 'trig_depression_from_vertical')
    expect(complement).toBeTruthy()
    expect(Number(complement!.text)).toBeCloseTo(40 / Math.tan(65 * RAD), 1)
    expect(grade(a, complement!.text)).toMatchObject({ verdict: 'mistake', mistake: 'trig_depression_from_vertical' })
  })

  it('a tower at 30° and, from 100 m closer, 45° is about 136.6 m, and adding the distances is the other picture', () => {
    const spec: TwoFixed = { layout: 'closer', asked: 'height', nearDeg: 45, farDeg: 30, gap: 100, places: 1 }
    const h = (100 * Math.tan(30 * RAD) * Math.tan(45 * RAD)) / (Math.tan(45 * RAD) - Math.tan(30 * RAD))
    const a = twoProblem(spec)
    expect(a.stages[0]!.answerText).toBe(roundAway(h, 1))
    expect(Number(a.stages[0]!.answerText)).toBeCloseTo(136.6, 1)
    expect(a.prompt).toMatch(/100 meters closer/)
    expect(a.prompt).toMatch(/30°/)
    expect(a.prompt).toMatch(/45°/)
    const wrong = (100 * Math.tan(30 * RAD) * Math.tan(45 * RAD)) / (Math.tan(45 * RAD) + Math.tan(30 * RAD))
    const trap = a.stages[0]!.traps.find((t) => t.id === 'geo_distances_combined')
    expect(trap).toBeTruthy()
    expect(Number(trap!.text)).toBeCloseTo(wrong, 1)
    expect(grade(a, trap!.text)).toMatchObject({ verdict: 'mistake', mistake: 'geo_distances_combined' })
    expect(trap!.witness).not.toMatch(/\d/)
    const opposite: TwoFixed = { layout: 'opposite', asked: 'height', nearDeg: 45, farDeg: 30, gap: 100, places: 1 }
    const b = twoProblem(opposite)
    expect(b.stages[0]!.answerText).toBe(roundAway(wrong, 1))
    const swapped = b.stages[0]!.traps.find((t) => t.id === 'geo_distances_combined')
    expect(Number(swapped!.text)).toBeCloseTo(h, 1)
    expect(grade(b, swapped!.text)).toMatchObject({ verdict: 'mistake', mistake: 'geo_distances_combined' })
  })
})

describe('the messages she can retry on', () => {
  it('a rounded decimal is right, and the wrong place is only a note', { timeout: HEAVY }, () => {
    const a = sideProblem({ deg: 23, known: 'opp', asked: 'adj', value: 12, places: 2 })
    const exact = 12 / Math.tan(23 * RAD)
    const want = roundAway(exact, 2)
    expect(a.stages[0]!.answerText).toBe(want)
    expect(grade(a, want).verdict).toBe('correct')
    expectNote(a, roundAway(exact, 1), /rounded too far/)
    expectNote(a, roundAway(exact, 0), /rounded too far/)
  })
})
