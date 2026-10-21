import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { sweep, trigAnswerOf } from '../trig/testkit'
import { AM_HINTS, AM_RULES } from '.'

const LOOP_TIMEOUT = 120_000

describe('the angleMeasure module', () => {
  it('is registered after the growth and decay module, with its four templates and five rule cards', () => {
    const mod = getModule('angleMeasure')
    expect(mod.title).toBe('Angles and radian measure')
    expect(mod.templates.map((t) => t.id)).toEqual(['am.convert', 'am.coterminal', 'am.reference', 'am.arc'])
    expect(mod.order).toBeGreaterThan(getModule('expModels').order)
    expect(mod.ruleCards.map((c) => c.id)).toEqual(['am-radians', 'am-coterminal', 'am-quadrant', 'am-reference', 'am-arc'])
  })

  it('a problem shows its angle on a figure, with the angle given as its label, and no answer in its words', () => {
    const a = trigAnswerOf(generateProblem('angleMeasure', 'am.reference', 1))
    expect(a.figure.kind).toBe('circle')
    expect(a.figure.ariaLabel).toMatch(/standard position/)
    expect(a.figure.ariaLabel).not.toMatch(/Quadrant/)
  })
})

const BRIEF: Record<string, string[]> = {
  'am.convert': ['trig_pi_dropped', 'trig_pi_kept', 'trig_conversion_inverted'],
  'am.coterminal': ['trig_coterminal_half_turn', 'trig_coterminal_short', 'trig_negative_direction', 'trig_pi_dropped'],
  'am.reference': ['trig_reference_from_y_axis', 'trig_reference_wrong_way', 'trig_reference_is_coterminal', 'trig_negative_direction', 'trig_coterminal_half_turn'],
  'am.arc': ['trig_arc_degrees', 'trig_sector_no_half', 'trig_sector_r_not_squared', 'trig_arc_sector_swapped', 'trig_pi_dropped'],
}

describe.each(Object.keys(BRIEF))('%s over 300 seeds', (templateId) => {
  it(
    'deterministic; every answer and spelling right; every slip its own id; the promised slip real; nothing early spells an answer; the re-solve agrees; varied',
    () => {
      const r = sweep('angleMeasure', templateId, 300, AM_RULES, AM_HINTS)
      expect(r.distinctProblems, 'distinct problems').toBeGreaterThanOrEqual(25)
      expect(r.maxAnswerShare, `the answer ${r.topAnswer} is too common`).toBeLessThanOrEqual(0.1)
      for (const id of BRIEF[templateId]!) expect(r.promised.has(id), `${id} is promised somewhere`).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})

describe('what the templates draw', () => {
  it(
    'conversions: both directions, exact and rounded, negative angles and angles past a turn, and not only multiples of 15°',
    () => {
      const seen = { toRad: 0, toDeg: 0, decimal: 0, negative: 0, pastTurn: 0, notFifteen: 0 }
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('angleMeasure', 'am.convert', seed))
        const c = a.stages[0]!.check
        if (c.kind === 'decimal') seen.decimal++
        if ((c.kind === 'angle' || c.kind === 'decimal') && c.unit === 'rad') seen.toRad++
        else seen.toDeg++
        if (a.figure.deg < 0) seen.negative++
        if (Math.abs(a.figure.deg) > 360) seen.pastTurn++
        if (c.kind === 'angle' && c.unit === 'rad' && Number(c.deg) % 15 !== 0) seen.notFifteen++
      }
      expect(seen.decimal).toBeGreaterThan(45)
      expect(seen.decimal).toBeLessThan(105)
      for (const [k, v] of Object.entries(seen)) expect(v, k).toBeGreaterThan(10)
    },
    LOOP_TIMEOUT,
  )

  it(
    'coterminal angles are past a full turn either way, in degrees and in radians',
    () => {
      let negative = 0
      let radians = 0
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('angleMeasure', 'am.coterminal', seed))
        expect(Math.abs(a.figure.deg)).toBeGreaterThan(360)
        if (a.figure.deg < 0) negative++
        if (a.stages[0]!.check.kind === 'angle' && a.stages[0]!.check.unit === 'rad') radians++
      }
      expect(negative).toBeGreaterThan(90)
      expect(radians).toBeGreaterThan(90)
    },
    LOOP_TIMEOUT,
  )

  it(
    'reference angles: every quadrant, an axis now and then (one part only), and the reference angle drawn on the figure only after',
    () => {
      const quadrants = new Set<string>()
      let axis = 0
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('angleMeasure', 'am.reference', seed))
        quadrants.add(a.stages[0]!.answerText)
        if (a.stages[0]!.answerText === 'axis') {
          axis++
          expect(a.stages).toHaveLength(1)
          expect(a.figure.reference).toBeUndefined()
        } else {
          expect(a.stages.map((s) => s.id)).toEqual(['quadrant', 'reference'])
          expect(a.figure.reference).toBeDefined()
        }
      }
      expect([...quadrants].sort()).toEqual(['Q1', 'Q2', 'Q3', 'Q4', 'axis'])
      expect(axis).toBeGreaterThan(0)
    },
    LOOP_TIMEOUT,
  )

  it(
    'arcs and sectors: both, in degrees and radians, exact and rounded, word problems among them',
    () => {
      const seen = new Set<string>()
      for (let seed = 1; seed <= 300; seed++) {
        const p = generateProblem('angleMeasure', 'am.arc', seed)
        const a = trigAnswerOf(p)
        seen.add(a.figure.sector!.shade)
        seen.add(a.stages[0]!.kind)
        seen.add(/°/.test(a.figure.label) ? 'degrees' : 'radians')
        if (/pendulum|clock|wheel|sprinkler|pizza/.test(p.statementText)) seen.add('word problem')
      }
      for (const k of ['arc', 'area', 'value', 'decimal', 'degrees', 'radians', 'word problem']) expect(seen.has(k), k).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})
