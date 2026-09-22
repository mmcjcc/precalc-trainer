import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { domainTemplate } from './domain'
import { rangeTemplate } from './range'
import { DR_RULES } from './rules'

export { DR_RULE_IDS, DR_RULES } from './rules'
export { FN_PATTERN } from './patterns'

/**
 * Domain and range (precalculus). Answer-only: she writes the set, and the engine grades it.
 * The graph of f stays behind the reveal gate — it shows the answer.
 */
export const domainRangeModule: ModuleDef = {
  id: 'domainRange',
  title: 'Domain and range',
  blurb: 'Find the domain or the range of a function from its formula, and write the set in interval notation.',
  // Right after Reading a graph (1.5), before inequalities (2).
  order: 1.6,
  templates: [domainTemplate, rangeTemplate],
  ruleCards: DR_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(domainRangeModule)
