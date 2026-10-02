import { describe, expect, it } from 'vitest'
import { getReview, getTemplate, resolveReview } from '@/content'
import type { ModuleId } from '@/shared/types'
import type { Ev } from '@/store/types'
import { buildReviewSet, reviewTemplateWeights } from './buildReview'

function mastered(skill: string): Ev[] {
  return [0, 1, 2, 3, 4].map((i) => ({
    t: 'problem_done' as const,
    at: 1_000_000 + i,
    attemptId: `${skill}#${i}`,
    skill,
    moduleId: 'inequalities',
    steps: 3,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal' as const,
    secs: 30,
  }))
}

function rejections(skill: string, n: number, pattern = 'no_sign_flip'): Ev[] {
  return Array.from({ length: n }, (_, i) => ({
    t: 'step_rejected' as const,
    at: i + 1,
    attemptId: 'a',
    skill,
    stepIdx: 0,
    pattern,
  }))
}

describe('buildReviewSet', () => {
  const topics = resolveReview(getReview('unit1')!)

  it('is deterministic for a seed and defaults to 12', () => {
    const events = rejections('ineq.linear', 3)
    const a = buildReviewSet('unit1', { seed: 42, events })
    const b = buildReviewSet('unit1', { seed: 42, events })
    expect(a.count).toBe(12)
    expect(a).toEqual(b)
    expect(buildReviewSet('unit1', { seed: 43, events })).not.toEqual(a)
    for (const problem of a.problems) {
      expect(getTemplate(problem.moduleId as ModuleId, problem.templateId).id).toBe(problem.templateId)
    }
  })

  it('covers every topic when the count allows, and that many topics when it does not', () => {
    for (const n of [topics.length, 12, 20]) {
      const set = buildReviewSet('unit1', { count: n, seed: 7, events: [] })
      expect(set.problems).toHaveLength(n)
      expect(new Set(set.problems.map((p) => p.topicId)).size).toBe(topics.length)
    }
    const short = buildReviewSet('unit1', { count: 8, seed: 7, events: [] })
    expect(short.problems).toHaveLength(8)
    expect(new Set(short.problems.map((p) => p.topicId)).size).toBe(8)
  })

  it('weights a template with rejections above one she has never tried, and a never-tried one above a mastered one', () => {
    const slips: Ev[] = [
      ...rejections('ineq.linear', 2, 'no_sign_flip'),
      { t: 'final_answer', at: 9, attemptId: 'a', skill: 'ineq.fraction', correct: false, pattern: 'endpoint_type' },
    ]
    const weights = reviewTemplateWeights(slips, ['ineq.linear', 'ineq.fraction', 'dq.linear'])
    expect(weights.get('ineq.linear')!).toBeGreaterThan(weights.get('dq.linear')!)
    expect(weights.get('ineq.fraction')!).toBeGreaterThan(weights.get('dq.linear')!)

    const neverVsMastered = reviewTemplateWeights(mastered('ineq.linear'), ['ineq.linear', 'ineq.distribute'])
    expect(neverVsMastered.get('ineq.distribute')!).toBeGreaterThan(neverVsMastered.get('ineq.linear')!)

    // Enough slips that the fill slots are not a coin flip: the rejected template shows up
    // far more often than an untouched one across seeds.
    const heavy = rejections('ineq.linear', 30)
    let weak = 0
    let calm = 0
    for (let seed = 1; seed <= 15; seed++) {
      const set = buildReviewSet('unit1', { count: 20, seed, events: heavy })
      weak += set.problems.filter((p) => p.templateId === 'ineq.linear').length
      calm += set.problems.filter((p) => p.templateId === 'dq.radical').length
    }
    expect(weak).toBeGreaterThan(calm * 5)
  })
})
