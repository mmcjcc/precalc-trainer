import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { decomposeTemplate } from './decompose'
import { domainTemplate } from './domain'
import { exprTemplate } from './expr'
import { COMP_RULES } from './rules'
import { valueTemplate } from './value'

export { COMP_RULE_IDS, COMP_RULES } from './rules'

/**
 * Composition of functions (precalculus). Answer-only. Formulas, values, the composite domain, and
 * decompositions are graded by the engine — any equivalent formula, and any valid non-trivial pair, is right.
 */
export const compositionModule: ModuleDef = {
  id: 'composition',
  title: 'Composition of functions',
  blurb: 'Build f(g(x)), evaluate it, find where it is defined, and take a function apart into f and g.',
  // Immediately after Domain and range (1.6), still before inequalities (2).
  order: 1.7,
  templates: [exprTemplate, valueTemplate, domainTemplate, decomposeTemplate],
  ruleCards: COMP_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(compositionModule)
