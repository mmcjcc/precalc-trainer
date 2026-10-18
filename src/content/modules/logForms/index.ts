import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { LF_MODULE_ID, LF_TEMPLATES } from './build'
import { LF_RULES } from './rules'

export { LF_RULES, LF_RULE_IDS, lfRuleFor } from './rules'
export { LF_KEYS, LF_MODULE_ID, LF_TEMPLATES, decimalTemplate, convertTemplate, valueTemplate, logFormsWork } from './build'
export type { LogFormsAnswer } from './build'

/**
 * Logarithms and exponential form (precalculus Unit 3). Evaluate an exact value, rewrite between
 * exponential and logarithmic form, or round a change-of-base value from the calculator.
 */
export const logFormsModule: ModuleDef = {
  id: LF_MODULE_ID,
  title: 'Logarithms and exponential form',
  blurb: 'Evaluate a logarithm, rewrite between exponential and logarithmic form, and round a change of base on the TI-84.',
  order: 5.97,
  templates: [...LF_TEMPLATES],
  ruleCards: LF_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(logFormsModule)
