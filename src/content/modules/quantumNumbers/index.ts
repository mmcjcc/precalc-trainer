import { EC_RULES } from '@/content/modules/electrons/rules'
import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { QN_TEMPLATES } from './generate'
import { QN_RULES } from './rules'

export type { QuantumAnswer } from '@/content/types'
export { QN_KEYS, QN_MISTAKE_IDS, exampleShowsAnswer, gradeQnStage, qnWork } from './grade'
export type { QnGrade, QnMistakeId } from './grade'
export { QN_RULE_FOR, QN_RULE_IDS, QN_RULES } from './rules'

const pauli = EC_RULES.find((card) => card.id === 'ec-pauli')
if (!pauli) throw new Error('ec-pauli rule card is missing')

/**
 * Quantum numbers and orbitals (chemistry; CK-12 Chemistry ch. 5, after electrons).
 * Answer-only kind 'quantumNumbers': each part is on `instance.answer.stages`.
 * Grade with `gradeQnStage`. The Pauli card is the electrons module's, linked, not copied.
 */
export const quantumNumbersModule: ModuleDef = {
  id: 'quantumNumbers',
  subject: 'Chemistry',
  title: 'Quantum numbers and orbitals',
  blurb: 'What each quantum number tells you, which sets can belong to an electron, counting orbitals and electrons, and the shapes of s, p and d orbitals. Chapter 5.',
  order: 8.2,
  templates: [...QN_TEMPLATES],
  ruleCards: [...QN_RULES, pauli],
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(quantumNumbersModule)
