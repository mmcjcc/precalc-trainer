import { registerModule } from '@/content/registry'
import type { InverseTrigAnswer, ModuleDef } from '@/content/types'
import { gradeTrigPart, trigWork, type TrigPartGrade } from '../trig/parts'
import { IT_MODULE_ID, IT_TEMPLATES } from './build'
import { IT_RULES } from './rules'

export { IT_RULES, IT_RULE_IDS } from './rules'
export { IT_HINTS, IT_INSTRUCTIONS, IT_TITLES } from './words'
export { IT_MODULE_ID, IT_TEMPLATES, composeTemplate, evaluateTemplate } from './build'
export { evaluateProblem, invTex, type EvaluateInput } from './evaluate'
export { ALG_SHAPES, algText, algebraicProblem, cancelProblem, identityProblem, quadrantOf, triangleProblem, type AlgebraicInput, type CancelInput, type IdentityInput, type TriangleInput } from './compose'

/** Grade her entry for one part of an inverse-function problem. */
export function gradeItPart(answer: InverseTrigAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeTrigPart(part, text)
}

export { trigWork as itWork }

/** Inverse trig functions (precalculus Unit 5): exact and calculator values, compositions. */
export const inverseTrigModule: ModuleDef = {
  id: IT_MODULE_ID,
  title: 'Inverse trigonometric functions',
  blurb: 'arcsin, arccos and arctan at special values and on the calculator, inputs with no angle, and compositions with a reference triangle.',
  order: 5.997,
  templates: [...IT_TEMPLATES],
  ruleCards: IT_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(inverseTrigModule)
