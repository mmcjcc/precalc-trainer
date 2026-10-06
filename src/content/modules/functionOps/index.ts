import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { formulaTemplate, graphTemplate, tableTemplate } from './generate'
import { OPS_RULES } from './rules'

export { OPS_RULE_IDS, OPS_RULES } from './rules'

/**
 * Operations with functions (precalculus). Answer-only. A value from a table or from two graphs is a
 * number or "undefined"; a formula is accepted in any equivalent form, including an unsimplified quotient.
 */
export const functionOpsModule: ModuleDef = {
  id: 'functionOps',
  title: 'Operations with functions',
  blurb: 'Add, subtract, multiply, and divide functions, and compose them, from a table, from graphs, or from formulas.',
  // Immediately after Composition (1.7), still before Transformations (1.75).
  order: 1.72,
  templates: [tableTemplate, graphTemplate, formulaTemplate],
  ruleCards: OPS_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(functionOpsModule)
