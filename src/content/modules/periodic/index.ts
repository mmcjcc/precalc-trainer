import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { ionsTemplate, locateTemplate, trendsTemplate, valenceTemplate, whyTemplate } from './generate'
import { PT_RULES } from './rules'

export type { PeriodicAnswer } from '@/content/types'
export { PT_KEYS, PT_MISTAKE_IDS, exampleShowsAnswer, gradePtStage, ptWork } from './grade'
export type { PtGrade, PtMistakeId } from './grade'
export { PT_RULE_FOR, PT_RULES } from './rules'

/**
 * The periodic table (chemistry; CK-12 Chemistry - Intermediate ch. 6). Answer-only kind
 * 'periodic': each part is on `instance.answer.stages`. Grade with `gradePtStage`, never by
 * comparing the typed text to a stored string alone — a ranking is the trend table's order.
 */
export const periodicModule: ModuleDef = {
  id: 'periodic',
  subject: 'Chemistry',
  title: 'The periodic table',
  blurb: 'Where an element sits, valence electrons, and the trends in radius, ionization energy and electronegativity. Chapter 6.',
  order: 8.5,
  templates: [locateTemplate, valenceTemplate, trendsTemplate, ionsTemplate, whyTemplate],
  ruleCards: [...PT_RULES],
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(periodicModule)
