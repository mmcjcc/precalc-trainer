import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { logNextStep, logProgress } from '../explog/anchor'
import { EE_MODULE_ID, EE_TEMPLATES } from './build'
import { EE_RULES } from './rules'

export { EE_RULES, EE_RULE_IDS, eeRuleFor } from './rules'
export { EE_KEYS, EE_MODULE_ID, EE_TEMPLATES, exponentialTemplate, logarithmicTemplate, quadraticTemplate } from './build'
export type { ExpLogAnswer } from './build'

/**
 * Exponential and logarithmic equations (precalculus Unit 3). One checked line at a time, then a
 * final answer. The worked solution is the engine's explanation, shown after she finishes.
 */
export const expLogEquationsModule: ModuleDef = {
  id: EE_MODULE_ID,
  title: 'Exponential and logarithmic equations',
  blurb: 'Solve an exponential or logarithmic equation one line at a time, then give the solution and check the domain.',
  order: 5.99,
  templates: [...EE_TEMPLATES],
  ruleCards: EE_RULES,
  progress: (instance, current) => logProgress(instance, current, 'write your first line'),
  nextStep: (instance, current) => logNextStep(instance, current),
}

registerModule(expLogEquationsModule)
