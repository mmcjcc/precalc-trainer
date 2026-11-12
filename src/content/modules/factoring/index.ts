import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { FA_MODULE_ID, FA_TEMPLATES } from './build'
import { FA_RULES } from './rules'

export { FA_RESERVED, FA_MODULE_ID, FA_TEMPLATE_IDS, FA_TEMPLATES, faSelfTest, leaks, lin, stageAnswers, std } from './build'
export { FA_FIRST_KEY, FA_KEYS, binomialText, canonicalEntries, faAllCorrect, faBlocked, faShow, faWork, gcfText, gradeFactoringStage, gradeProduct } from './grade'
export type { FactoringAnswer, FaGrade, FaPart, FaStageGrade } from './grade'
export { FA_RULE_FOR, FA_RULE_IDS, FA_RULES, faRuleIdFor } from './rules'

/**
 * Factoring polynomials (precalculus Unit 2, a factoring review before quadratics): the greatest common factor,
 * squares (difference, perfect square, or a sum that does not factor), sum or difference of cubes, trinomials,
 * grouping, and factoring completely. Her product is checked exactly by the engine (src/engine/polynomials/factor.ts).
 */
export const factoringModule: ModuleDef = {
  id: FA_MODULE_ID,
  title: 'Factoring polynomials',
  blurb: 'Take out the greatest common factor, factor squares, sums and differences of cubes, trinomials and four terms by grouping, and keep going until every factor is finished.',
  // Just before completing the square (5.6), so Home shows it first in Unit 2.
  order: 5.58,
  templates: FA_TEMPLATES,
  ruleCards: FA_RULES,
  // The flow counts the checked parts itself; nothing anchors on a canonical path here.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(factoringModule)
