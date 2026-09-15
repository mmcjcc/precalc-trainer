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
