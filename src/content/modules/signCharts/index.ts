import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { SC_MODULE_ID, SC_TEMPLATES } from './build'
import { SC_RULES } from './rules'

export { SC_RULE_FOR, SC_RULE_IDS, SC_RULES } from './rules'
export {
  SC_MISTAKE_IDS,
  gradeCritical,
  gradeScPart,
  gradeSigns,
  gradeSolution,
  stageTraps,
} from './grade'
export type { ScGrade, ScMistakeId, ScStageId, ScTrap } from './grade'
export {
  SC_KEYS,
  SC_MODULE_ID,
  SC_TEMPLATES,
  canonicalEntries,
  chartTemplate,
  gradeScStage,
  polyTemplate,
  rationalTemplate,
  scWork,
} from './build'
export type { SignChartsAnswer } from './build'
export { graphOf, parseInequality } from './model'
export type { Rel, ScProblem } from './model'

/**
 * Polynomial and rational inequalities (precalculus Unit 2), solved with a sign chart.
 * The arithmetic lives in this folder, on exact rationals.
 */
export const signChartsModule: ModuleDef = {
  id: SC_MODULE_ID,
  title: 'Polynomial and rational inequalities',
  blurb: 'Solve a polynomial or rational inequality and write the solution in interval notation.',
  // After rational functions (5.9), before chemistry (6).
  order: 5.95,
  templates: [...SC_TEMPLATES],
  ruleCards: SC_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(signChartsModule)
