import { registerModule } from '@/content/registry'
import type { ModuleDef, TrigEquationsAnswer } from '@/content/types'
import type { TrigPartGrade } from '../trig/parts'
import { TE_MODULE_ID, TE_TEMPLATES } from './build'
import { gradeFactorPart } from './factor'
import { gradeLinearPart } from './linear'
import { TE_RULES } from './rules'

export { TE_RULES }
export { TE_MODULE_ID, TE_TEMPLATES, factorProblem, linearProblem } from './build'

/** Grade one part of a linear or factored trig equation. */
export function gradeTePart(answer: TrigEquationsAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((stage) => stage.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  if (answer.question === 'linear') return gradeLinearPart(part, text)
  return gradeFactorPart(part, text)
}

/** Solving trig equations on one full turn (precalculus Unit 6, part 2). */
export const trigEquationsModule: ModuleDef = {
  id: TE_MODULE_ID,
  title: 'Solving trigonometric equations',
  blurb: 'Linear and quadratic equations in one trig function, solved on one full turn.',
  order: 5.999,
  templates: [...TE_TEMPLATES],
  ruleCards: TE_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(trigEquationsModule)
