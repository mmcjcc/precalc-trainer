import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { EG_MODULE_ID, EG_TEMPLATES } from './build'
import { EG_RULES } from './rules'

export { EG_RULES, EG_RULE_IDS } from './rules'
export {
  CHOICE_HINT,
  EG_MODULE_ID,
  EG_TEMPLATES,
  FORMULA_HINT,
  INSTRUCTIONS as EG_INSTRUCTIONS,
  INTERVAL_HINT,
  LINE_HINT,
  POINT_HINT,
  curveOf,
  egWork,
  featuresAnswer,
  featuresTemplate,
  gradeEgPart,
  inverseAnswer,
  inverseCheck,
  inverseTemplate,
  inverseText,
  matchTemplate,
} from './build'
export type { ExpLogGraphsAnswer } from './build'
export { baseOf, curveText, type Curve } from './curve'

/**
 * Graphs of exponential and logarithmic functions (precalculus Unit 3, second half): the features of one graph
 * part by part, matching a graph, and the inverse of an exponential or a log.
 */
export const expLogGraphsModule: ModuleDef = {
  id: EG_MODULE_ID,
  title: 'Graphs of exponential and logarithmic functions',
  blurb: 'Domain, range, asymptote, intercept and direction of a shifted exponential or log, matching graphs, and inverses.',
  order: 5.991,
  templates: [...EG_TEMPLATES],
  ruleCards: EG_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(expLogGraphsModule)
