import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { MO_TEMPLATES } from './generate'
import { ALL_RULES } from './grade'

export type { MoleAnswer, MoStage } from '@/content/types'
export {
  ALL_RULES,
  assertMoleAnswer,
  canonicalMoAnswer,
  cardBlob,
  enteredText,
  exampleSurfaces,
  gradeMoStage,
  leakReport,
  modelFor,
  MO_KEYS,
  MO_MISTAKE_IDS,
  moWork,
  stageLeaks,
  trapsForMo,
} from './grade'
export type { MoGrade, MoMistakeId, MoTrap } from './grade'
export { displayAnswer, displayOf, prettyNumber } from './build'
export { splitNumeral } from './numeric'
export { MO_CARD_SLIPS, MO_RULES, PARTICLE_TEXT, STP_TEXT } from './rules'
export { CF_CARD_SLIPS, CF_RULES } from '../chemFormulas/rules'

/** Which card to put first when she makes a slip (each card lists the slips it answers). */
export { MO_RULE_FOR } from './rules'

/**
 * The mole (chemistry; CK-12 Chemistry - Intermediate ch. 10). Answer-only kind 'mole': each part
 * is on `instance.answer.stages`; grade with `gradeMoStage`. Every value re-derives from the
 * substance table (facts.ts) and the printed numbers, through the sig-fig engine.
 */
export const molesModule: ModuleDef = {
  id: 'moles',
  subject: 'Chemistry',
  title: 'The mole: particles, mass and gas volume',
  blurb: 'Avogadro’s number and the counting unit of each substance, molar mass from a formula, grams to moles to particles, and 22.4 L/mol for a gas at STP. Chapter 10.',
  order: 8.91,
  templates: [...MO_TEMPLATES],
  ruleCards: [...ALL_RULES],
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(molesModule)
