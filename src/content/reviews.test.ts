import { describe, expect, it } from 'vitest'
import { getModule, getReview, resolveReview, REVIEWS } from '@/content'

describe('review definitions', () => {
  it('reads Unit 1 topics from the registry, including every inequality template', () => {
    const review = getReview('unit1')
    expect(review?.title).toBe('Unit 1 review')
    const topics = resolveReview(review!)
    expect(topics.map((t) => t.moduleId)).toEqual([
      'numberLine',
      'inequalities',
      'evenOdd',
      'inverses',
      'diffQuotient',
      'graphFeatures',
      'domainRange',
      'composition',
      'transformations',
      'piecewiseRate',
    ])
    for (const topic of topics) {
      const mod = getModule(topic.moduleId)
      expect(topic.title).toBe(mod.title)
      expect(topic.templates.map((t) => t.id)).toEqual(mod.templates.map((t) => t.id))
    }
    const inequalities = topics.find((t) => t.moduleId === 'inequalities')!
    expect(inequalities.templates).toHaveLength(4)
    expect(inequalities.templates.map((t) => t.id)).toEqual([
      'ineq.linear',
      'ineq.distribute',
      'ineq.fraction',
      'ineq.compound',
    ])
    const ids = topics.map((t) => t.moduleId)
    expect(ids).not.toContain('propertiesDrill')
    expect(ids).not.toContain('sigFigs')
    expect(ids).not.toContain('atoms')
    expect(ids).not.toContain('electrons')
  })

  it('is a list, so a later unit is another entry', () => {
    expect(REVIEWS.map((r) => r.id)).toEqual(['unit1'])
  })
})
