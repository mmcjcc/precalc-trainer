import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { RX_TEMPLATES } from './generate'
import { RX_RULES } from './rules'

export type { ReactionsAnswer } from '@/content/types'
export {
  assertReactions,
  canonicalRxAnswer,
  coefficientText,
  exampleShowsAnswer,
  gradeRxStage,
  RX_KEYS,
  RX_MISTAKE_IDS,
  RX_REUSED_MISTAKE_IDS,
  rxWork,
  singlesOut,
  slotKey,
  trapsForRx,
} from './grade'
export type { RxGrade, RxMistakeId, RxTrap } from './grade'
export { RX_RULE_FOR, RX_RULES } from './rules'
export { rxLeaks } from './facts'

/**
 * Chemical reactions (chemistry; CK-12 Chemistry - Intermediate ch. 11). Answer-only kind
 * 'reactions': each part is on `instance.answer.stages`. Grade with `gradeRxStage`; every value
 * re-derives from the reaction table (facts.ts), the balancer (balance.ts) and the nomenclature engine.
 */
export const reactionsModule: ModuleDef = {
  id: 'reactions',
  subject: 'Chemistry',
  title: 'Chemical reactions',
  blurb: 'Counting atoms, balancing equations, the five kinds of reaction, predicting products with the activity series, and word equations. Chapter 11.',
  order: 8.95,
  templates: [...RX_TEMPLATES],
  ruleCards: [...RX_RULES],
  // Answer-only kind: no worked column, so progress is a single stage reached on submit.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(reactionsModule)
