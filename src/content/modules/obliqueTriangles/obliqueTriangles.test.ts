/**
 * Every oblique-triangle template over 300 seeds (testkit sweepOt: deterministic, answers and slips graded, the promised
 * slip real, nothing early spells an answer, English everywhere), then the mix: distinct statements, answer shares,
 * the brief's distributions (the three ambiguous outcomes, the largest and obtuse angles of SSS, the laws), every
 * named mistake of the brief promised somewhere, and the reserved example angles never drawn.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { getModule } from '@/content/registry'
import '@/content/modules'
import { ERROR_PATTERNS } from '@/engine'
import { plain } from '../trig/text'
import { OT_RESERVED_ANGLES, OT_RULES } from './rules'
import { givensOf, sweepOt, type OtSweep } from './testkit'

const T = 120_000
const TEMPLATES = ['ot.sines', 'ot.ambiguous', 'ot.cosines', 'ot.area', 'ot.choose'] as const
const results = new Map<string, OtSweep>()
const sweep = (id: string) => {
  if (!results.has(id)) results.set(id, sweepOt(id, 300))
  return results.get(id)!
}

describe('the module', () => {
  it('registers five templates and nine rule cards with catalog entries for every slip', () => {
    const mod = getModule('obliqueTriangles')
    expect(mod.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(mod.ruleCards).toHaveLength(OT_RULES.length)
    expect(new Set(OT_RULES.map((c) => c.id)).size).toBe(OT_RULES.length)
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (id) => {
  beforeAll(() => {
    sweep(id)
  }, T)

  it('passes every check, seed by seed', () => {
    expect(sweep(id).answers).toHaveLength(300)
  })

  it('gives at least 40 distinct statements in seeds 1..60', () => {
    expect(sweep(id).distinctFirst60).toBeGreaterThanOrEqual(40)
  })

  it('no typed answer is more than 10% of the seeds, no right choice more than 60% of its part', () => {
    const s = sweep(id)
    for (const [part, share] of Object.entries(s.maxShare)) expect(share, part).toBeLessThanOrEqual(0.1)
    for (const [part, share] of Object.entries(s.maxChoiceShare)) expect(share, part).toBeLessThanOrEqual(0.6)
  })

  it('every slip it names has a catalog entry, and it promises a slip on every seed', () => {
    const s = sweep(id)
    for (const m of s.candidates) expect(ERROR_PATTERNS[m as keyof typeof ERROR_PATTERNS], m).toBeTruthy()
    expect(s.answers.every((a) => a.trap)).toBe(true)
  })

  it('never draws a reserved example angle, as a given or as an answer', () => {
    for (const a of sweep(id).answers) {
      const words = plain(a.prompt)
      for (const g of words.matchAll(/(\d+(?:\.\d+)?)°/g)) expect(OT_RESERVED_ANGLES as readonly number[]).not.toContain(Number(g[1]))
      for (const part of a.stages) {
        const isAngle = part.check.kind === 'angle' || (part.check.kind === 'decimal' && part.check.unit === 'deg')
        if (!isAngle) continue
        const n = Number(part.answerText)
        expect(OT_RESERVED_ANGLES.some((r) => Math.abs(r - n) < 0.05), `${part.id} ${part.answerText}`).toBe(false)
      }
    }
  })
})

describe('the mix the brief asks for', () => {
  it('ot.ambiguous: none, one and two each 25-45% of seeds, and never a right angle at B', () => {
    const counts = { none: 0, one: 0, two: 0 }
    for (const a of sweep('ot.ambiguous').answers) {
      counts[a.stages[0]!.answerText as keyof typeof counts]++
      for (const s of a.stages.slice(1)) expect(Math.abs(Number(s.answerText) - 90)).toBeGreaterThan(3)
    }
    for (const n of Object.values(counts)) {
      expect(n / 300).toBeGreaterThanOrEqual(0.25)
      expect(n / 300).toBeLessThanOrEqual(0.45)
    }
  }, T)

  it('ot.ambiguous: two triangles ask for both B, the acute and the obtuse, adding to 180°', () => {
    for (const a of sweep('ot.ambiguous').answers) {
      const ids = a.stages.map((s) => s.id)
      if (a.stages[0]!.answerText === 'two') {
        expect(ids).toEqual(['count', 'B1', 'B2'])
        const [b1, b2] = [Number(a.stages[1]!.answerText), Number(a.stages[2]!.answerText)]
        expect(b1).toBeLessThan(90)
        expect(b2).toBeGreaterThan(90)
        expect(Math.abs(b1 + b2 - 180)).toBeLessThan(0.11)
      } else if (a.stages[0]!.answerText === 'one') expect(ids).toEqual(['count', 'B'])
      else expect(ids).toEqual(['count'])
    }
  }, T)

  it('ot.cosines: SAS and SSS both drawn; the largest angle asked in at least 40% of seeds, obtuse in at least 20%', () => {
    const answers = sweep('ot.cosines').answers
    const sss = answers.filter((a) => a.stages[0]!.id === 'angle')
    const largest = sss.filter((a) => a.stages[0]!.label === 'The largest angle')
    const obtuse = largest.filter((a) => Number(a.stages[0]!.answerText) > 90)
    expect(sss.length).toBeGreaterThan(90)
    expect(answers.length - sss.length).toBeGreaterThan(90)
    expect(largest.length / 300).toBeGreaterThanOrEqual(0.4)
    expect(obtuse.length / 300).toBeGreaterThanOrEqual(0.2)
    // The largest angle really is across from the longest side.
    for (const a of largest) {
      const g = givensOf(a.prompt)
      const longest = Math.max(g.a!, g.b!, g.c!)
      const [x, y] = [g.a!, g.b!, g.c!].filter((v) => v !== longest) as [number, number]
      const want = (Math.acos((x * x + y * y - longest * longest) / (2 * x * y)) * 180) / Math.PI
      expect(Math.abs(Number(a.stages[0]!.answerText) - want)).toBeLessThan(0.051)
    }
  }, T)

  it('ot.area: both formulas drawn', () => {
    const answers = sweep('ot.area').answers
    const heron = answers.filter((a) => a.ruleCard === 'ot-heron').length
    expect(heron).toBeGreaterThan(90)
    expect(300 - heron).toBeGreaterThan(90)
  }, T)

  it('ot.choose: every answer drawn, the right triangle about one in five', () => {
    const counts = { sines: 0, cosines: 0, neither: 0 }
    for (const a of sweep('ot.choose').answers) counts[a.stages[0]!.answerText as keyof typeof counts]++
    expect(counts.sines).toBeGreaterThan(90)
    expect(counts.cosines).toBeGreaterThan(90)
    expect(counts.neither).toBeGreaterThan(35)
  }, T)

  it('every named mistake of the brief is promised somewhere', () => {
    const promised = new Set(TEMPLATES.flatMap((id) => [...sweep(id).promised]))
    for (const id of [
      'trig_radian_mode',
      'ot_sines_wrong_pair',
      'ot_third_angle_skipped',
      'ot_cosines_term_dropped',
      'ot_square_root_skipped',
      'ot_cos_sign_obtuse',
      'ot_sine_acute_taken',
      'ot_ssa_second_missed',
      'ot_ssa_two_claimed',
      'ot_area_half_dropped',
      'ot_area_cosine',
      'ot_heron_perimeter',
      'ot_cosines_wrong_side',
      'ot_cosines_order',
      'ot_sines_no_pair',
      'ot_cosines_for_pair',
      'ot_right_missed',
      'ot_right_assumed',
    ])
      expect(promised.has(id), id).toBe(true)
  }, T)
})
