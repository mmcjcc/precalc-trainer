/**
 * Content registry — public API of the content layer (see docs/BUILD_GUIDE.md §6).
 */
export { makeRng, mixSeed, mulberry32, randomSeed, seedFromBase36, seedToBase36 } from './rng'
export type * from './types'
export {
  MODULES,
  allTemplates,
  generateDrill,
  generateProblem,
  getModule,
  getTemplate,
  hasModule,
  problemId,
  registerDrillGenerator,
  registerModule,
} from './registry'

import './modules'

export {
  DEFAULT_REVIEW_COUNT,
  REVIEW_COUNTS,
  REVIEWS,
  getReview,
  resolveReview,
  type ReviewCount,
  type ReviewDef,
  type ReviewTopicRef,
  type ResolvedTemplate,
  type ResolvedTopic,
} from './reviews'
