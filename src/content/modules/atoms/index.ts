import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { abundanceTemplate } from './abundance'
import { avgmassTemplate } from './avgmass'
import { AT_MODULE_ID } from './build'
import { notationTemplate } from './notation'
import { particlesTemplate } from './particles'
import { AT_RULES } from './rules'

export { AT_RULE_IDS, AT_RULES } from './rules'
export { ISOTOPE_POOL, STABLE_ISOTOPES, isPoolIsotope } from './isotopes'

/**
 * Atomic structure (chemistry; CK-12 Chemistry - Intermediate ch. 4: atoms, the nuclear model,
 * isotopes and atomic mass). Answer-only kind 'atoms': everything the flow needs is on
 * `instance.answer` (question, prompt, context, symbol, periodic-table lookups, nudge, rule cards,
 * reveal). Grade with the engine by `answer.question.kind`, never by comparing text.
 */
export const atomsModule: ModuleDef = {
  id: AT_MODULE_ID,
  subject: 'Chemistry',
  title: 'Atomic structure',
  blurb: 'Protons, neutrons and electrons from a symbol, nuclear notation, isotopes and average atomic mass: chapter 4, with the classic slips built in.',
  order: 7,
  templates: [particlesTemplate, notationTemplate, avgmassTemplate, abundanceTemplate],
  ruleCards: AT_RULES,
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(atomsModule)
