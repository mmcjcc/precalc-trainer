import { registerModule } from '@/content/registry'
import type { ModuleDef } from '@/content/types'
import { CX_MODULE_ID, CX_TEMPLATES } from './build'
import { CX_RULES } from './rules'

export { CX_RULE_FOR, CX_RULE_IDS, CX_RULES } from './rules'
export { CX_MISTAKE_IDS, gradeModel, trapsFor } from './grade'
export type { CxGrade, CxMistakeId, CxModel, CxStageId, CxTrap } from './grade'
export {
  CX_KEYS,
  CX_MODULE_ID,
  CX_TEMPLATES,
  arithTemplate,
  canonicalEntries,
  divideTemplate,
  gradeCxStage,
  modelOf,
  powersTemplate,
  quadraticTemplate,
  zerosTemplate,
  cxWork,
} from './build'
export type { ComplexNumsAnswer } from './build'
export { parseCxAnswer } from './parse'
export {
  cx,
  cxAdd,
  cxDiv,
  cxEq,
  cxIPower,
  cxMul,
  cxSqrt,
  cxSub,
  formatCx,
  formatPair,
  showCx,
} from './arith'
export type { Cx } from './arith'

/**
 * Complex numbers (precalculus Unit 2). Arithmetic, division, powers of i, square roots of negatives,
 * quadratics with a negative discriminant, and zeros of a real polynomial given one complex zero.
 * The arithmetic lives in this folder, on exact rationals.
 */
export const complexNumsModule: ModuleDef = {
  id: CX_MODULE_ID,
  title: 'Complex numbers',
  blurb: 'Add, subtract, multiply and divide complex numbers, simplify powers of i, and solve quadratics with complex roots.',
  // After sign charts (5.95), before chemistry (6).
  order: 5.96,
  templates: [...CX_TEMPLATES],
  ruleCards: CX_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(complexNumsModule)
