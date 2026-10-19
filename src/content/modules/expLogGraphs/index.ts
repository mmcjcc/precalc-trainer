import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { EG_MODULE_ID, EG_TEMPLATES } from './build'
import { EG_RULES } from './rules'

export { EG_MISTAKE_IDS, EG_RULE_FOR, EG_RULE_IDS, EG_RULES, type EgMistakeId } from './rules'
export {
  EG_KEYS,
  canonicalGraphEntries,
  egWork,
  gradeExpLogGraphsStage,
  gradeExpLogInverse,
  type EgGrade,
} from './grade'
export {
  EG_MODULE_ID,
  EG_TEMPLATES,
  expFormula,
  featuresTemplate,
  inverseTemplate,
  kSuffix,
  logFormula,
  matchTemplate,
  xShiftText,
} from './build'

export const expLogGraphsModule: ModuleDef = {
  id: EG_MODULE_ID,
  title: 'Graphs of exponential and logarithmic functions',
  blurb: 'Find domains, ranges, asymptotes, intercepts, matching graphs, and inverses of exponential and logarithmic functions.',
  order: 5.991,
  templates: [...EG_TEMPLATES],
  ruleCards: EG_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(expLogGraphsModule)
