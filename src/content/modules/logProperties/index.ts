import { registerModule } from '@/content/registry'
import type { ModuleDef, ProblemInstance } from '@/content/types'
import { checkLogRewrite, isExpandedLog, isSingleLog } from '@/engine'
import { logNextStep, logProgress } from '../explog/anchor'
import { LP_MODULE_ID, LP_TEMPLATES } from './build'
import { LP_RULES } from './rules'

export { LP_RULES, LP_RULE_IDS, lpRuleFor } from './rules'
export { LP_MODULE_ID, LP_TEMPLATES, condenseTemplate, expandTemplate } from './build'
export type { LogPropertiesAnswer } from './build'

function finished(instance: ProblemInstance, currentLine: string | null): boolean {
  if (!currentLine || instance.answer.type !== 'logProperties') return false
  const answer = instance.answer
  const same = checkLogRewrite(answer.expr, currentLine, { assumePositive: true, vars: answer.vars }).ok
  if (!same) return false
  return answer.question === 'expand' ? isExpandedLog(currentLine, answer.vars) : isSingleLog(currentLine, answer.vars)
}

/**
 * Properties of logarithms (precalculus Unit 3). Expand or condense one checked line at a time.
 * The problem says to assume every variable is positive.
 */
export const logPropertiesModule: ModuleDef = {
  id: LP_MODULE_ID,
  title: 'Properties of logarithms',
  blurb: 'Expand a logarithm or condense a sum of logarithms to a single log, one line at a time.',
  order: 5.98,
  templates: [...LP_TEMPLATES],
  ruleCards: LP_RULES,
  progress: (instance, current) => logProgress(instance, current, 'write your first line'),
  nextStep: (instance, current) => logNextStep(instance, current),
  solved: finished,
}

registerModule(logPropertiesModule)
