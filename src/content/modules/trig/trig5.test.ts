/**
 * Unit 5's seven templates over 300 seeds each (trig/testkit.ts sweep, with the second half's leak matcher): each
 * problem is deterministic; every answer and every listed spelling grades right; every slip grades as its own id and is
 * never the answer; nonsense is not an attempt; the promised slip is a real candidate that grades as its id, promised
 * wherever one is possible; nothing she sees before a part (the prompt, the cards, the hints, the figure's labels as they
 * stand then, the part's texts and the catalog entries of its slips) spells that part's answer or a later one; the
 * independent re-solve (trig/resolve5.ts: the given equation, the graphs and the words, with mathjs and Math) agrees.
 * Then: at least 25 distinct problems, no answer above 10% of the seeds, every slip of the brief a candidate somewhere
 * (and the common ones promised), og.match's right graph in each place 15-35% of the time.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ModuleId } from '@/shared/types'
import type { RuleCard } from '@/content/types'
import { IT_HINTS, IT_RULES } from '../inverseTrig'
import { OG_HINTS, OG_RULES } from '../otherTrigGraphs'
import { SG_HINTS, SG_RULES } from '../sinusoids'
import { showsNumber } from './text'
import { sweep, trigAnswerOf } from './testkit'

// Seeded sweeps run past 2 minutes when the whole suite shares the laptop with a builder (review 2026-10-22).
const LOOP_TIMEOUT = 600_000

const TEMPLATES: [ModuleId, string, readonly RuleCard[], readonly string[], readonly string[], readonly string[]][] = [
  [
    'sinusoids',
    'sg.features',
    SG_RULES,
    SG_HINTS,
    // candidates somewhere
    ['trig_amplitude_negative', 'trig_amplitude_with_d', 'trig_amplitude_as_span', 'trig_period_as_b', 'trig_period_times_b', 'trig_period_base_mixed', 'trig_shift_not_divided', 'trig_shift_wrong_way', 'trig_midline_zero', 'trig_range_ignores_d', 'trig_reflection_missed'],
    // promised somewhere
    ['trig_amplitude_negative', 'trig_amplitude_with_d', 'trig_period_as_b', 'trig_period_times_b', 'trig_shift_not_divided', 'trig_shift_wrong_way', 'trig_range_ignores_d'],
  ],
  [
    'sinusoids',
    'sg.equation',
    SG_RULES,
    SG_HINTS,
    ['trig_amplitude_as_span', 'trig_period_half', 'trig_period_quarter', 'trig_b_as_period', 'trig_midline_at_extreme', 'trig_reflection_missed', 'trig_shift_wrong_way', 'trig_shift_not_divided', 'trig_period_times_b', 'trig_vertical_shift_sign'],
    ['trig_amplitude_as_span', 'trig_period_half', 'trig_period_quarter', 'trig_b_as_period', 'trig_midline_at_extreme', 'trig_reflection_missed', 'trig_shift_wrong_way', 'trig_shift_not_divided'],
  ],
  [
    'sinusoids',
    'sg.model',
    SG_RULES,
    SG_HINTS,
    ['trig_amplitude_as_diameter', 'trig_amplitude_as_span', 'trig_midline_zero', 'trig_b_as_period', 'trig_model_start_point', 'trig_degree_mode', 'trig_model_later_time', 'trig_shift_wrong_way'],
    ['trig_amplitude_as_diameter', 'trig_midline_zero', 'trig_b_as_period', 'trig_model_start_point', 'trig_degree_mode', 'trig_model_later_time'],
  ],
  [
    'otherTrigGraphs',
    'og.features',
    OG_RULES,
    OG_HINTS,
    ['trig_period_as_b', 'trig_period_times_b', 'trig_period_base_mixed', 'trig_asymptotes_zeros_swapped', 'trig_sec_asymptotes_at_sin_zeros', 'trig_shift_not_divided', 'trig_shift_wrong_way', 'trig_sec_range_as_sinusoid', 'trig_range_ignores_d'],
    ['trig_period_base_mixed', 'trig_asymptotes_zeros_swapped', 'trig_sec_asymptotes_at_sin_zeros', 'trig_sec_range_as_sinusoid'],
  ],
  [
    'otherTrigGraphs',
    'og.match',
    OG_RULES,
    OG_HINTS,
    ['trig_period_times_b', 'trig_reflection_missed', 'trig_shift_wrong_way', 'trig_cofunction_graph', 'trig_vertical_shift_sign'],
    ['trig_period_times_b', 'trig_reflection_missed', 'trig_shift_wrong_way', 'trig_cofunction_graph', 'trig_vertical_shift_sign'],
  ],
  [
    'inverseTrig',
    'it.evaluate',
    IT_RULES,
    IT_HINTS,
    ['trig_inverse_other_angle', 'trig_inverse_not_principal', 'trig_arccos_range_as_arcsin', 'trig_inverse_sign_dropped', 'trig_sin_cos_swapped', 'trig_tan_inverted', 'trig_inverse_outside_domain', 'trig_degree_mode', 'trig_inverse_as_reciprocal', 'trig_ratio_for_angle'],
    ['trig_inverse_other_angle', 'trig_inverse_not_principal', 'trig_arccos_range_as_arcsin', 'trig_inverse_outside_domain', 'trig_degree_mode', 'trig_inverse_as_reciprocal'],
  ],
  [
    'inverseTrig',
    'it.compose',
    IT_RULES,
    IT_HINTS,
    ['trig_inverse_cancel_outside', 'trig_inverse_outside_domain', 'trig_sign_quadrant', 'trig_inverse_other_angle', 'trig_arccos_range_as_arcsin', 'trig_coordinate_sign', 'trig_pythag_added', 'trig_sin_cos_swapped', 'trig_tan_inverted', 'trig_reciprocal_missing'],
    ['trig_inverse_cancel_outside', 'trig_inverse_outside_domain', 'trig_sign_quadrant', 'trig_inverse_other_angle'],
  ],
]

describe.each(TEMPLATES)('%s/%s over 300 seeds', (moduleId, templateId, cards, hints, candidates, promised) => {
  it(
    'deterministic, self-checking, nothing early spells an answer, the re-solve agrees, varied, every slip there',
    () => {
      const r = sweep(moduleId, templateId, 300, cards, hints, showsNumber)
      expect(r.distinctProblems, 'distinct problems').toBeGreaterThanOrEqual(25)
      // og.match's answer is a letter: its spread is the place balance below, and its equations are checked there.
      if (templateId !== 'og.match') expect(r.maxAnswerShare, `the most common answer: ${r.topAnswer}`).toBeLessThanOrEqual(0.1)
      const seen = new Set<string>()
      for (let seed = 1; seed <= 300; seed++) for (const s of trigAnswerOf(generateProblem(moduleId, templateId, seed)).stages) for (const t of s.traps) seen.add(t.id)
      for (const id of candidates) expect(seen.has(id), `${id} is a candidate somewhere`).toBe(true)
      for (const id of promised) expect(r.promised.has(id), `${id} is promised somewhere`).toBe(true)
    },
    LOOP_TIMEOUT,
  )
})

describe('og.match places the right graph fairly', () => {
  it(
    'each of the four places holds it 15-35% of the time over 300 seeds; the other three are the named slips',
    () => {
      const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
      const equations = new Map<string, number>()
      for (let seed = 1; seed <= 300; seed++) {
        const a = trigAnswerOf(generateProblem('otherTrigGraphs', 'og.match', seed))
        const part = a.stages[0]!
        counts[part.answerText]!++
        equations.set(a.display!, (equations.get(a.display!) ?? 0) + 1)
        expect(part.traps.map((t) => t.text).sort()).toEqual(['A', 'B', 'C', 'D'].filter((l) => l !== part.answerText))
        expect(a.figure.graphs!.map((g) => g.graph.ariaLabel)).toEqual(['Graph A', 'Graph B', 'Graph C', 'Graph D'])
      }
      for (const [letter, n] of Object.entries(counts)) {
        expect(n / 300, `graph ${letter}`).toBeGreaterThanOrEqual(0.15)
        expect(n / 300, `graph ${letter}`).toBeLessThanOrEqual(0.35)
      }
      // The right equation itself: no one equation above 10% of the seeds.
      expect(Math.max(...equations.values()) / 300).toBeLessThanOrEqual(0.1)
    },
    LOOP_TIMEOUT,
  )
})
