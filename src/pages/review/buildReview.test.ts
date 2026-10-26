import { describe, expect, it } from 'vitest'
import { domainTemplateIds, getReview, getTemplate, resolveReview, SAT_DOMAINS, type SatDomainId } from '@/content'
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

  it('draws SAT practice sets across all four domains weighted 35/35/15/15 with at least one from each domain', () => {
    const allowedByDomain = new Map<SatDomainId, Set<string>>(
      SAT_DOMAINS.map((d) => [d.id, new Set(domainTemplateIds(d.id))]),
    )
    for (const count of [8, 12, 22]) {
      for (let seed = 1; seed <= 30; seed++) {
        const set = buildReviewSet('sat', { count, seed, events: [] })
        expect(set.problems).toHaveLength(count)
        const domainsSeen = new Set<SatDomainId>()
        for (const p of set.problems) {
          const domainId = p.topicId.split(':')[0] as SatDomainId
          domainsSeen.add(domainId)
          expect(allowedByDomain.get(domainId)?.has(p.templateId)).toBe(true)
        }
        expect(domainsSeen.size).toBe(4)
      }
    }

    // Every set has each domain's share exactly (largest remainder), whatever the seed: review 2026-10-25 saw an
    // 8-problem set come out 2 / 4 / 1 / 1. Inside a domain no type comes twice while another of its types is unused.
    const expected: Record<number, Record<SatDomainId, number>> = {
      8: { algebra: 3, 'advanced-math': 3, 'data-analysis': 1, 'geometry-trig': 1 },
      12: { algebra: 4, 'advanced-math': 4, 'data-analysis': 2, 'geometry-trig': 2 },
      22: { algebra: 8, 'advanced-math': 8, 'data-analysis': 3, 'geometry-trig': 3 },
    }
    for (const count of [8, 12, 22]) {
      for (let seed = 1; seed <= 100; seed++) {
        const set = buildReviewSet('sat', { count, seed, events: [] })
        const byDomain = new Map<SatDomainId, string[]>()
        for (const p of set.problems) {
          const domainId = p.topicId.split(':')[0] as SatDomainId
          byDomain.set(domainId, [...(byDomain.get(domainId) ?? []), p.templateId])
        }
        for (const domain of SAT_DOMAINS) {
          const ids = byDomain.get(domain.id) ?? []
          expect(ids.length).toBe(expected[count]![domain.id])
          expect(new Set(ids).size).toBe(Math.min(ids.length, allowedByDomain.get(domain.id)!.size))
        }
      }
    }
  })

  it('builds 8-problem per-domain SAT sets strictly from that domain’s mapped types', () => {
    for (const domain of SAT_DOMAINS) {
      const allowed = new Set(domainTemplateIds(domain.id))
      const set = buildReviewSet(domain.reviewId, { seed: 19, events: [] })
      expect(set.problems).toHaveLength(8)
      for (const p of set.problems) {
        expect(allowed.has(p.templateId)).toBe(true)
        expect(getTemplate(p.moduleId as ModuleId, p.templateId).id).toBe(p.templateId)
      }
      // Every type of the domain once before any type comes again.
      for (let seed = 1; seed <= 50; seed++) {
        const ids = buildReviewSet(domain.reviewId, { seed, events: [] }).problems.map((p) => p.templateId)
        expect(new Set(ids).size).toBe(Math.min(8, allowed.size))
      }
    }
  })
})
