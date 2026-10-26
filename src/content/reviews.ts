/**
 * Mixed review sets. A review names topics; templates are read from the module registry
 * when a set is built, so the definition never copies problem text. A later unit is another
 * entry in REVIEWS — the page and the builder are shared.
 */
import type { ModuleId } from '@/shared/types'
import { getModule } from './registry'
import { domainTypeRefs, SAT_DOMAINS, type SatDomainId } from './sat/skills'

export const REVIEW_COUNTS = [8, 12, 20] as const
export type ReviewCount = (typeof REVIEW_COUNTS)[number]
export const DEFAULT_REVIEW_COUNT: ReviewCount = 12

export const SAT_REVIEW_COUNTS = [8, 12, 22] as const
export type SatReviewCount = (typeof SAT_REVIEW_COUNTS)[number]
export const DEFAULT_SAT_REVIEW_COUNT: SatReviewCount = 22
export const SAT_DOMAIN_REVIEW_COUNT = 8
export const SAT_PRACTICE_REVIEW_ID = 'sat'

export interface ReviewTopicRef {
  /** Stable id. Unit 1 uses the module id: one topic per module. */
  id: string
  moduleId: ModuleId
  /** Optional subset of template ids within `moduleId`. When omitted, every template in the module is included. */
  templateIds?: readonly string[]
  /** Optional relative weight for this topic when drawing a review set. */
  weight?: number
  /** Optional SAT domain id when generated from the SAT skill map. */
  domainId?: SatDomainId
}

export interface ReviewDef {
  id: string
  title: string
  /** Curriculum order. Summary rows follow this, not the shuffled set. */
  topics: ReviewTopicRef[]
  /** Allowed problem counts on the start screen; defaults to `REVIEW_COUNTS`. */
  counts?: readonly number[]
  /** Default problem count; defaults to `DEFAULT_REVIEW_COUNT`. */
  defaultCount?: number
  /** Marks reviews generated from the SAT skill map. */
  satKind?: 'sat-mixed' | 'sat-domain'
  /** Domain id when `satKind === 'sat-domain'`. */
  domainId?: SatDomainId
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

/**
 * Generate the SAT practice review and the four per-domain SAT reviews directly
 * from the SAT skill map (`src/content/sat/skills.ts`).
 */
export function satReviews(): ReviewDef[] {
  const mixedTopics: ReviewTopicRef[] = []
  const domainReviews: ReviewDef[] = []

  for (const domain of SAT_DOMAINS) {
    const refs = domainTypeRefs(domain.id)
    const totalTemplates = refs.reduce((sum, ref) => sum + ref.templateIds.length, 0)
    if (totalTemplates > 0) {
      for (const ref of refs) {
        mixedTopics.push({
          id: `${domain.id}:${ref.moduleId}`,
          moduleId: ref.moduleId as ModuleId,
          templateIds: ref.templateIds,
          weight: domain.share * (ref.templateIds.length / totalTemplates),
          domainId: domain.id,
        })
      }
    }
    domainReviews.push({
      id: domain.reviewId,
      title: `Practice ${domain.title}`,
      counts: [SAT_DOMAIN_REVIEW_COUNT],
      defaultCount: SAT_DOMAIN_REVIEW_COUNT,
      satKind: 'sat-domain',
      domainId: domain.id,
      // Weighted by its types, so the set takes the weighted path in buildReviewSet: every type of the domain once
      // before any comes again (review 2026-10-25: the with-replacement fill gave one type 3 of 8 problems).
      topics: refs.map((ref) => ({
        id: ref.moduleId,
        moduleId: ref.moduleId as ModuleId,
        templateIds: ref.templateIds,
        weight: ref.templateIds.length,
        domainId: domain.id,
      })),
    })
  }

  const mixed: ReviewDef = {
    id: SAT_PRACTICE_REVIEW_ID,
    title: 'SAT practice set',
    counts: SAT_REVIEW_COUNTS,
    defaultCount: DEFAULT_SAT_REVIEW_COUNT,
    satKind: 'sat-mixed',
    topics: mixedTopics,
  }

  return [mixed, ...domainReviews]
}

export function getReview(id: string): ReviewDef | undefined {
  const direct = REVIEWS.find((r) => r.id === id)
  if (direct) return direct
  const normalized = id === 'sat-practice' ? SAT_PRACTICE_REVIEW_ID : id
  return satReviews().find((r) => r.id === normalized)
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
  /** Optional relative weight from `ReviewTopicRef.weight`. */
  weight?: number
  /** Optional SAT domain id from `ReviewTopicRef.domainId`. */
  domainId?: SatDomainId
}

/** Topic titles and the templates the review topic includes from the module registry. */
export function resolveReview(def: ReviewDef): ResolvedTopic[] {
  return def.topics.map((topic) => {
    const mod = getModule(topic.moduleId)
    if (mod.templates.length === 0) throw new Error(`Review ${def.id}: ${topic.moduleId} has no templates`)
    let templates = mod.templates
    if (topic.templateIds) {
      const wanted = new Set(topic.templateIds)
      for (const id of wanted) {
        if (!mod.templates.some((t) => t.id === id)) {
          throw new Error(`Review ${def.id}: ${topic.moduleId} has no template ${id}`)
        }
      }
      templates = mod.templates.filter((t) => wanted.has(t.id))
      if (templates.length === 0) {
        throw new Error(`Review ${def.id}: ${topic.id} selected no templates from ${topic.moduleId}`)
      }
    }
    const resolved: ResolvedTopic = {
      id: topic.id,
      moduleId: topic.moduleId,
      title: mod.title,
      templates: templates.map((t) => ({ id: t.id, title: t.title })),
    }
    if (topic.weight !== undefined) resolved.weight = topic.weight
    if (topic.domainId !== undefined) resolved.domainId = topic.domainId
    return resolved
  })
}
