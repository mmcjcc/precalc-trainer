import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import {
  acidTemplate,
  classifyTemplate,
  hydrateTemplate,
  ionicFormulaTemplate,
  ionicFromNameTemplate,
  ionicNameTemplate,
  ionTemplate,
  molecularTemplate,
} from './generate'
import { ION_RULE_IDS, MOLECULAR_RULE_IDS, nmRule } from './rules'

export type { NomenclatureAnswer, NmStage } from '@/content/types'
export { gradeCheck, gradeNmStage, NM_KEYS, NM_MISTAKE_IDS, nmWork, notAnAttempt } from './grade'
export type { NmGrade, NmMistakeId } from './grade'
export { exampleFor, examplesFor, nmShown, NM_EXAMPLES, NM_ION_EXAMPLES, safeLesson, safeNote } from './feedback'
export type { NmShown } from './feedback'
export { halogenFamilyReference, nmRule, nmRuleFor, NM_RULES, polyatomicReference } from './rules'
export type { PolyatomicRow } from './rules'
export { everyProblem, HINTS, nmAnswer, NM_TEMPLATES } from './generate'
export type { NmDrawn } from './generate'
export { assertNomenclature, engineAnswer } from './check'
export { CLASS_CHOICES, stageOf } from './build'
export { showsAnyAnswer, universeKeys, NM_PART_KINDS } from './universe'
export { leaks, leaksTo, stageKeys } from './leaks'
export type { LeakKeys, PartKeys } from './leaks'

// Answer-only kind: no worked column, so progress is a single stage reached on submit.
const progress = () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' as const })

/**
 * Ions and ionic compounds (chemistry; CK-12 Chemistry - Intermediate ch. 7). Kind 'nomenclature': each part is
 * on `instance.answer.stages`; grade it with `gradeNmStage`, and show the grade with `nmShown`.
 */
export const ionicNamesModule: ModuleDef = {
  id: 'ionicNames',
  subject: 'Chemistry',
  title: 'Ions and ionic compounds',
  blurb: 'Name and write ions, ionic formulas from two ions, and ionic compounds both ways: charges, Roman numerals, polyatomic ions. Chapter 7.',
  order: 8.6,
  templates: [ionTemplate, ionicFormulaTemplate, ionicNameTemplate, ionicFromNameTemplate],
  ruleCards: ION_RULE_IDS.map(nmRule),
  progress,
  nextStep: () => null,
}

/** Binary molecular compounds, acids and hydrates, and which kind a formula is (chemistry; CK-12 ch. 7). */
export const molecularAcidsModule: ModuleDef = {
  id: 'molecularAcids',
  subject: 'Chemistry',
  title: 'Molecular compounds, acids, and hydrates',
  blurb: 'Greek prefixes, acid names from their anions, hydrates, and deciding which naming rules a formula follows. Chapter 7.',
  order: 8.7,
  templates: [molecularTemplate, acidTemplate, hydrateTemplate, classifyTemplate],
  ruleCards: MOLECULAR_RULE_IDS.map(nmRule),
  progress,
  nextStep: () => null,
}

registerModule(ionicNamesModule)
registerModule(molecularAcidsModule)
