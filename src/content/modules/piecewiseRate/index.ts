import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { continuousTemplate } from './continuous'
import { domainTemplate } from './domain'
import { evaluateTemplate } from './evaluate'
import { graphTemplate } from './graph'
import { rateTemplate } from './rate'
import { PW_RULES } from './rules'
import { writeTemplate } from './write'

export { PW_RULE_IDS, PW_RULES } from './rules'

/**
 * Piecewise functions and average rate of change (precalculus). Evaluation and the rate are
 * answer-only. The graph is the problem for reading and writing a piecewise function; for domain
 * and continuity it stays hidden until she finishes.
 */
export const piecewiseRateModule: ModuleDef = {
  id: 'piecewiseRate',
  title: 'Piecewise functions and rate of change',
  blurb: 'Evaluate a piecewise function, read one from a graph, give its domain and range, choose k so it is continuous, write one from a graph, and find an average rate of change.',
  // Immediately after Transformations (1.75), still before inequalities (2).
  order: 1.8,
  templates: [evaluateTemplate, graphTemplate, domainTemplate, continuousTemplate, writeTemplate, rateTemplate],
  ruleCards: PW_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(piecewiseRateModule)
