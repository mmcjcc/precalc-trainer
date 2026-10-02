import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { PZ_MODULE_ID } from './build'
import { endTemplate } from './end'
import { fromZerosTemplate } from './fromZeros'
import { rationalTemplate } from './rational'
import { PZ_RULES } from './rules'
import { zerosTemplate } from './zeros'

export { PZ_RULE_FOR, PZ_RULE_IDS, PZ_RULES, pzRuleIdFor } from './rules'
export { PZ_FIRST_KEY, PZ_KEYS, PZ_MAX_ROWS, gradeZerosStage, removeZeroRow, zeroRowCount, zeroRows, zerosSpec, zerosWork } from './grade'
export type { PzPart } from './grade'
export { PZ_MAX_DEGREE, PZ_MODULE_ID, PZ_QUESTION_STAGES, canonicalEntries, pmShow, pzSelfTest, pzStageOf, pzTrapKinds } from './build'
export type { PolyZerosAnswer, PolyZerosQuestion, PolyZerosStage, PolyZerosStageId, PzProblem } from './build'
export { givenZeros } from './fromZeros'

/**
 * Zeros and end behavior (precalculus Unit 2, polynomial half). Four templates: the zeros of a factored
 * polynomial with their multiplicities and what the graph does at each, the end behavior of a polynomial in
 * factored or standard form, the polynomial of least degree with given zeros through a point, and the
 * rational root candidates of a cubic with the ones that are zeros. All of the mathematics is the engine's
 * (`src/engine/polynomials`).
 */
export const polyZerosModule: ModuleDef = {
  id: PZ_MODULE_ID,
  title: 'Zeros and end behavior',
  blurb: 'Read zeros and multiplicities off a factored polynomial, say where the ends of its graph go, build a polynomial from its zeros, and list and test possible rational zeros.',
  // After synthetic division (5.7), before chemistry (6): the last module of Unit 2's polynomial half.
  order: 5.8,
  templates: [zerosTemplate, endTemplate, fromZerosTemplate, rationalTemplate],
  ruleCards: PZ_RULES,
  // The flow counts the checked parts itself; nothing anchors on a canonical path here.
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(polyZerosModule)
