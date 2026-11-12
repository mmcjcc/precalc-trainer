import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { ALL_RULES } from '../moles/grade'
import { CF_TEMPLATES } from './generate'

export { CF_CARD_SLIPS, CF_RULES } from './rules'
export { cleanEmpiricalData, EMPIRICAL_POOL, MOLECULAR_POOL } from './generate'

/**
 * Percent composition and formulas (chemistry; CK-12 Chemistry - Intermediate ch. 10). Same kind
 * ('mole') and screen as the moles module; grade a part with `gradeMoStage` from '../moles'.
 */
export const chemFormulasModule: ModuleDef = {
  id: 'chemFormulas',
  subject: 'Chemistry',
  title: 'Percent composition and formulas',
  blurb: 'Percent by mass from a formula or a sample, percent water in a hydrate, empirical formulas from percents or masses, and molecular formulas from a molar mass. Chapter 10.',
  order: 8.92,
  templates: [...CF_TEMPLATES],
  ruleCards: [...ALL_RULES],
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(chemFormulasModule)
