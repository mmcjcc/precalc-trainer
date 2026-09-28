import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { evaluateTemplate } from './evaluate'
import { rateTemplate } from './rate'
import { PW_RULES } from './rules'

export { PW_RULE_IDS, PW_RULES } from './rules'

/**
 * Piecewise functions and average rate of change (precalculus). Answer-only. No graph: a sketch of
 * the pieces or the secant would give the value away, and the rate reuses the same arithmetic as
 * the difference quotient without drawing it.
 */
export const piecewiseRateModule: ModuleDef = {
  id: 'piecewiseRate',
  title: 'Piecewise functions and rate of change',
  blurb: 'Evaluate a piecewise function, including the boundary, and find an average rate of change.',
  // Immediately after Transformations (1.75), still before inequalities (2).
  order: 1.8,
  templates: [evaluateTemplate, rateTemplate],
  ruleCards: PW_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(piecewiseRateModule)
