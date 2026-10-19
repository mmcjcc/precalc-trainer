import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { EM_MODULE_ID, EM_TEMPLATES } from './build'
import { EM_RULES } from './rules'

export { EM_MISTAKE_IDS, EM_RULE_FOR, EM_RULE_IDS, EM_RULES, type EmMistakeId } from './rules'
export {
  EM_KEYS,
  canonicalModelEntries,
  emWork,
  evalModelValue,
  gradeExpModelsStage,
  type EmGrade,
} from './grade'
export {
  EM_MODULE_ID,
  EM_TEMPLATES,
  growthTemplate,
  halflifeTemplate,
  interestTemplate,
} from './build'

export const expModelsModule: ModuleDef = {
  id: EM_MODULE_ID,
  title: 'Exponential growth and decay',
  blurb: 'Solve compound and continuous interest, radioactive half-life, carbon-14 dating, and continuous growth models.',
  order: 5.992,
  templates: [...EM_TEMPLATES],
  ruleCards: EM_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(expModelsModule)
