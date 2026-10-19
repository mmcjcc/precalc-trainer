import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { EM_MODULE_ID, EM_TEMPLATES } from './build'
import { EM_RULES } from './rules'

export { EM_RULES, EM_RULE_IDS } from './rules'
export {
  EM_MODULE_ID,
  EM_TEMPLATES,
  EXACT_HINT,
  INSTRUCTIONS as EM_INSTRUCTIONS,
  MONEY_HINT,
  NUMBER_HINT,
  emWork,
  gradeEmPart,
  growthProblem,
  growthTemplate,
  halfLifeProblem,
  halflifeTemplate,
  interestProblem,
  interestTemplate,
  modelAnswer,
  modelForms,
} from './build'
export type { Drafted, ExpModelsAnswer } from './build'

/**
 * Exponential growth and decay (precalculus Unit 3, second half): compound and continuous interest, half-life
 * and carbon-14 dating, and continuous growth from two counts, as textbook word problems.
 */
export const expModelsModule: ModuleDef = {
  id: EM_MODULE_ID,
  title: 'Exponential growth and decay',
  blurb: 'Compound and continuous interest, half-life and carbon-14 dating, and continuous growth, as word problems.',
  order: 5.992,
  templates: [...EM_TEMPLATES],
  ruleCards: EM_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(expModelsModule)
