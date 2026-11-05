import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { IB_TEMPLATES } from './generate'
import { IB_RULES } from './rules'

export type { IonicBondingAnswer } from '@/content/types'
export { assertIonicBonding, canonicalIbAnswer, exampleShowsAnswer, gradeIbStage, ibWork, IB_KEYS, IB_MISTAKE_IDS, IB_REUSED_MISTAKE_IDS, trapsForIb } from './grade'
export type { IbGrade, IbMistakeId, IbTrap } from './grade'
export { GAIN_LOSE_TEXT, DOTS_STAND_TEXT, IB_RULE_FOR, IB_RULES, PROPS_CORRECT, PROPS_WRONG, SEA_CORRECT, SEA_WRONG } from './rules'

/**
 * Ionic and metallic bonding (chemistry; CK-12 Chemistry - Intermediate ch. 8). Answer-only kind
 * 'ionicBonding': each part is on `instance.answer.stages`. Grade with `gradeIbStage`; the formula
 * part runs on the nomenclature engine and the ion-configuration part on the econfig engine.
 */
export const ionicBondingModule: ModuleDef = {
  id: 'ionicBonding',
  subject: 'Chemistry',
  title: 'Ionic and metallic bonding',
  blurb: 'From atom to ion, electron-dot symbols, the criss-cross into a formula unit, and why ionic crystals and metals behave the way they do. Chapter 8.',
  order: 8.8,
  templates: [...IB_TEMPLATES],
  ruleCards: [...IB_RULES],
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(ionicBondingModule)
