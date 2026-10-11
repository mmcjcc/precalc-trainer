import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { RF_MODULE_ID, RF_TEMPLATES } from './build'
import { RF_RULES } from './rules'

export { RF_RULE_FOR, RF_RULE_IDS, RF_RULES } from './rules'
export {
  RF_MISTAKE_IDS,
  featureTraps,
  gradeAsymptote,
  gradeDomain,
  gradeFeatureStage,
  gradeHoles,
  gradeSolution,
  gradeVertical,
  gradeXIntercepts,
  gradeYIntercept,
  solutionTraps,
} from './grade'
export type { RfGrade, RfMistakeId, RfStageId, RfTrap } from './grade'
export {
  RF_KEYS,
  RF_MODULE_ID,
  RF_TEMPLATES,
  asymptoteTemplate,
  canonicalEntries,
  equationTemplate,
  featuresTemplate,
  gradeRfStage,
  rfWork,
} from './build'
export type { RationalFnsAnswer } from './build'
export { equationFromSides, equationFromText, featuresFrom, featuresFromText, graphOfEquation, graphOfFeatures } from './model'
export type { RfEquation, RfFeatures, RfForm, RfPoint } from './model'

/**
 * Rational functions (precalculus Unit 2). Three templates: the domain, asymptotes, holes and intercepts
 * of f(x) = p(x)/q(x); the horizontal or slant asymptote alone; and a rational equation. The arithmetic
 * lives in this folder, on the engine's polynomials.
 */
export const rationalFnsModule: ModuleDef = {
  id: RF_MODULE_ID,
  title: 'Rational functions',
  blurb: 'Find the domain, holes, asymptotes and intercepts of a rational function, and solve a rational equation.',
  // After zeros and end behavior (5.8), before chemistry (6): the rational half of Unit 2.
  order: 5.9,
  templates: [...RF_TEMPLATES],
  ruleCards: RF_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(rationalFnsModule)
