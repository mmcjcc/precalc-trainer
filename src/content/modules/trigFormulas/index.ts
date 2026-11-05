import { registerModule } from '@/content/registry'
import type { ModuleDef, TrigFormulasAnswer } from '@/content/types'
import type { TrigPartGrade } from '../trig/parts'
import { TF_MODULE_ID, TF_TEMPLATES } from './build'
import { gradeDoublePart } from './double'
import { gradeHalfPart } from './half'
import { TF_RULES } from './rules'
import { gradeSumPart } from './sumdiff'

export { TF_RULES }
export { TF_MODULE_ID, TF_TEMPLATES, doubleProblem, halfProblem, sumdiffProblem } from './build'

/** Grade one part of a sum, difference, double-angle or half-angle problem. */
export function gradeTfPart(answer: TrigFormulasAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((stage) => stage.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  if (answer.question === 'sumdiff') return gradeSumPart(part, text)
  if (answer.question === 'double') return gradeDoublePart(part, text)
  return gradeHalfPart(part, text)
}

/** Sum, difference, double-angle and half-angle formulas (precalculus Unit 6, part 2). */
export const trigFormulasModule: ModuleDef = {
  id: TF_MODULE_ID,
  title: 'Sum, difference, double and half angles',
  blurb: 'Exact values from the sum and difference formulas, the double-angle formulas, and the half-angle formulas.',
  order: 5.9985,
  templates: [...TF_TEMPLATES],
  ruleCards: TF_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(trigFormulasModule)
