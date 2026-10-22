/**
 * The four optimization templates over 300 seeds each (testkit `sweep`): deterministic; every answer and spelling
 * right on both routes (the final equation in x or in y); every slip its own id and never the answer; nonsense not an
 * attempt; a slip promised on every problem, a real one that grades as its id; nothing she sees before a part spells
 * it; an independent re-solve from the words and the figure agrees; at least 25 distinct problems; no answer above
 * 10% of the seeds; and between them the templates promise every slip of the brief.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, modulesInUnit, getCourse } from '@/content'
import { OPT_MISTAKE_IDS } from '@/engine/optim'
import { sweep, type SweepResult } from './testkit'

const LOOP_TIMEOUT = 120_000
const results = new Map<string, SweepResult>()

const TEMPLATES = ['opt.wall', 'opt.pens', 'opt.numbers', 'opt.revenue'] as const

/** The slips each template must be able to promise (the brief's list, where the template has it). */
const PROMISES: Record<(typeof TEMPLATES)[number], string[]> = {
  'opt.wall': ['opt_wall_fenced', 'opt_wall_wrong_side', 'opt_term_dropped', 'opt_opens_wrong_way', 'opt_vertex_ab_swapped', 'opt_vertex_sign', 'opt_vertex_no_two', 'opt_max_as_dimension', 'opt_x_as_max', 'opt_pen_ends_short'],
  'opt.pens': ['opt_pen_ends_short', 'opt_pen_long_short', 'opt_area_one_pen', 'opt_area_wrong_count', 'opt_term_dropped', 'opt_solve_divide', 'opt_other_from_primary', 'opt_vertex_ab_swapped', 'opt_x_as_max'],
  'opt.numbers': ['opt_coefficients_swapped', 'opt_term_dropped', 'opt_binomial_square', 'opt_vertex_ab_swapped', 'opt_vertex_sign', 'opt_opens_wrong_way'],
  'opt.revenue': ['opt_revenue_wrong_way', 'opt_revenue_whole_price', 'opt_revenue_steps', 'opt_term_dropped', 'opt_vertex_ab_swapped', 'opt_x_as_max'],
}

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  it(
    'validates its answers and slips, hides every answer until its part, and agrees with a re-solve from what it shows',
    () => {
      const r = sweep(templateId, 300)
      results.set(templateId, r)
      expect(r.distinctProblems).toBeGreaterThanOrEqual(25)
      expect(r.maxAnswerShare, r.topAnswer).toBeLessThanOrEqual(0.1)
      for (const id of PROMISES[templateId]) expect([...r.promised], `${templateId} promises ${id}`).toContain(id)
      for (const id of r.named) expect((OPT_MISTAKE_IDS as readonly string[]).includes(id), id).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})

describe('the optimization module', () => {
  it('sits in Unit 2 right after completing the square', () => {
    const precalc = getCourse('precalc')!
    const unit2 = modulesInUnit(precalc.units[1]!).map((m) => m.id)
    expect(unit2.slice(0, 2)).toEqual(['quadratics', 'optimization'])
    expect(getModule('optimization').templates.map((t) => t.id)).toEqual([...TEMPLATES])
  })

  it(
    'between them the templates name every opt_ id somewhere, and promise every slip of the brief',
    () => {
      for (const t of TEMPLATES) if (!results.has(t)) results.set(t, sweep(t, 300))
      const named = new Set([...results.values()].flatMap((r) => [...r.named]))
      for (const id of OPT_MISTAKE_IDS) expect([...named], id).toContain(id)
      const promised = new Set([...results.values()].flatMap((r) => [...r.promised]))
      const brief = [
        'opt_vertex_ab_swapped',
        'opt_vertex_sign',
        'opt_wall_fenced',
        'opt_wall_wrong_side',
        'opt_pen_ends_short',
        'opt_pen_long_short',
        'opt_area_one_pen',
        'opt_area_wrong_count',
        'opt_term_dropped',
        'opt_x_as_max',
        'opt_max_as_dimension',
        'opt_other_from_primary',
        'opt_opens_wrong_way',
        'opt_revenue_wrong_way',
      ]
      for (const id of brief) expect([...promised], id).toContain(id)
    },
    LOOP_TIMEOUT,
  )

  it('every problem is in parts of six, with the final equation’s other letter ready for parts 4 and 5', () => {
    for (const t of TEMPLATES) {
      const a = generateProblem('optimization', t, 7).answer
      if (a.type !== 'optimization') throw new Error('not optimization')
      expect(a.stages.map((s) => s.id)).toEqual(['secondary', 'primary', 'final', 'best', 'other', 'max'])
      expect(a.yStages.map((s) => s.id)).toEqual(['best', 'other'])
      expect(a.yStages[0]!.check.kind === 'number' && a.yStages[0]!.check.name).toBe('y')
      expect(a.stages[3]!.check.kind === 'number' && a.stages[3]!.check.name).toBe('x')
    }
  })
})
