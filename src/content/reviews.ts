/**
 * Mixed review sets. A review names topics; templates are read from the module registry
 * when a set is built, so the definition never copies problem text. A later unit is another
 * entry in REVIEWS — the page and the builder are shared.
 */
import type { ModuleId } from '@/shared/types'
import { getModule } from './registry'

export const REVIEW_COUNTS = [8, 12, 20] as const
export type ReviewCount = (typeof REVIEW_COUNTS)[number]
export const DEFAULT_REVIEW_COUNT: ReviewCount = 12

export interface ReviewTopicRef {
  /** Stable id. Unit 1 uses the module id: one topic per module. */
  id: string
  moduleId: ModuleId
}

export interface ReviewDef {
  id: string
  title: string
  /** Curriculum order. Summary rows follow this, not the shuffled set. */
  topics: ReviewTopicRef[]
}

export const REVIEWS: readonly ReviewDef[] = [
  {
    id: 'unit1',
    title: 'Unit 1 review',
    topics: [
      { id: 'numberLine', moduleId: 'numberLine' },
      { id: 'inequalities', moduleId: 'inequalities' },
      { id: 'evenOdd', moduleId: 'evenOdd' },
      { id: 'inverses', moduleId: 'inverses' },
      { id: 'diffQuotient', moduleId: 'diffQuotient' },
      { id: 'graphFeatures', moduleId: 'graphFeatures' },
      { id: 'domainRange', moduleId: 'domainRange' },
      { id: 'composition', moduleId: 'composition' },
      { id: 'functionOps', moduleId: 'functionOps' },
      { id: 'transformations', moduleId: 'transformations' },
      { id: 'piecewiseRate', moduleId: 'piecewiseRate' },
    ],
  },
]

export function getReview(id: string): ReviewDef | undefined {
  return REVIEWS.find((r) => r.id === id)
}

export interface ResolvedTemplate {
  id: string
  title: string
}

export interface ResolvedTopic {
  id: string
  moduleId: ModuleId
  /** Module title from the registry. */
  title: string
  templates: ResolvedTemplate[]
}

/** Topic titles and every template the module currently registers. */
export function resolveReview(def: ReviewDef): ResolvedTopic[] {
  return def.topics.map((topic) => {
    const mod = getModule(topic.moduleId)
    if (mod.templates.length === 0) throw new Error(`Review ${def.id}: ${topic.moduleId} has no templates`)
    return {
      id: topic.id,
      moduleId: topic.moduleId,
      title: mod.title,
      templates: mod.templates.map((t) => ({ id: t.id, title: t.title })),
    }
  })
}
