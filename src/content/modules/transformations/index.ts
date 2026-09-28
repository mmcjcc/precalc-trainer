import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { describeTemplate } from './describe'
import { equationTemplate } from './equation'
import { pointTemplate } from './point'
import { TR_RULES } from './rules'

export { TR_RULE_IDS, TR_RULES } from './rules'
export { TR_PATTERN, transformPattern } from './patterns'

/**
 * Transformations of functions (precalculus). Answer-only. She builds a set of steps, maps a point,
 * or writes g(x). The engine grades the set, the point, and any equivalent formula. The graph of f
 * and g stays behind the reveal gate.
 */
export const transformationsModule: ModuleDef = {
  id: 'transformations',
  title: 'Transformations',
  blurb: 'Read how g moves, stretches, and reflects f. Map a point, and write the equation of g.',
  // Immediately after Composition (1.7), still before inequalities (2).
  order: 1.75,
  templates: [describeTemplate, pointTemplate, equationTemplate],
  ruleCards: TR_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(transformationsModule)
