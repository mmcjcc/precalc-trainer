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
  DEFAULT_SAT_REVIEW_COUNT,
  REVIEW_COUNTS,
  REVIEWS,
  SAT_DOMAIN_REVIEW_COUNT,
  SAT_PRACTICE_REVIEW_ID,
  SAT_REVIEW_COUNTS,
  getReview,
  resolveReview,
  satReviews,
  type ReviewCount,
  type ReviewDef,
  type ReviewTopicRef,
  type ResolvedTemplate,
  type ResolvedTopic,
  type SatReviewCount,
} from './reviews'
export {
  COURSES,
  courseOfModule,
  courseOfSkill,
  getCourse,
  modulesInUnit,
  unitsWithModules,
  type CourseDef,
  type UnitDef,
} from './courses'
export {
  SAT_DOMAINS,
  SAT_SKILLS,
  domainTemplateIds,
  domainTypeRefs,
  getSatDomain,
  getSatDomainByReview,
  getSatDomainByUnit,
  satCoverage,
  satCoverageSummary,
  skillStatus,
  skillTemplateIds,
  skillsInDomain,
  type SatCoverage,
  type SatDomainDef,
  type SatDomainId,
  type SatSkillDef,
  type SatSkillStatus,
  type SatTypeRef,
} from './sat/skills'
