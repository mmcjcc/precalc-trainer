import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { CB_TEMPLATES } from './generate'
import { CB_RULES } from './rules'

export type { CovalentBondingAnswer } from '@/content/types'
export { assertCovalentBonding, canonicalCbAnswer, cbWork, CB_KEYS, CB_MISTAKE_IDS, drawableFormulas, exampleShowsAnswer, gradeCbStage, trapsForCb } from './grade'
export type { CbGrade, CbMistakeId, CbTrap } from './grade'
export { BAND_TEXT, BEND_RIGHT, BOND_TYPE_TEXT, CB_RULE_FOR, CB_RULES, DUET_RIGHT, FORCE_TEXT, ORDER_TEXT, POLAR_TEXT, SHAPE_CHOICES } from './rules'

/**
 * Covalent bonding (chemistry; CK-12 Chemistry - Intermediate ch. 9). Answer-only kind
 * 'covalentBonding': each part is on `instance.answer.stages`. Grade with `gradeCbStage`;
 * every value re-derives from the molecule table (facts.ts) and the trend data.
 */
export const covalentBondingModule: ModuleDef = {
  id: 'covalentBonding',
  subject: 'Chemistry',
  title: 'Covalent bonding',
  blurb: 'Shared pairs and dot structures, the five molecular shapes, electronegativity bands, polar molecules, and the forces that set boiling points. Chapter 9.',
  order: 8.9,
  templates: [...CB_TEMPLATES],
  ruleCards: [...CB_RULES],
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(covalentBondingModule)
