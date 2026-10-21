import { registerModule } from '@/content/registry'
import type { ModuleDef, UnitCircleAnswer } from '@/content/types'
import { gradeTrigPart, trigWork, type TrigPartGrade } from '../trig/parts'
import { UC_MODULE_ID, UC_TEMPLATES } from './build'
import { UC_RULES } from './rules'

export { UC_RULES, UC_RULE_IDS } from './rules'
export { R_HINT, UC_HINTS, UC_INSTRUCTIONS, UC_MODULE_ID, UC_TEMPLATES, VALUE_HINT, exactProblem, exactTemplate, pointProblem, pointTemplate, valueForms } from './build'

/** Grade her entry for one part of a unit-circle problem. */
export function gradeUcPart(answer: UnitCircleAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeTrigPart(part, text)
}

export { trigWork as ucWork }

/**
 * The unit circle and the trig functions of any angle (precalculus Unit 4, first half): exact values at the special
 * angles in every quadrant and on the axes, and the six ratios from a point on the terminal side.
 */
export const unitCircleModule: ModuleDef = {
  id: UC_MODULE_ID,
  title: 'The unit circle and trig functions of any angle',
  blurb: 'Exact values of the six functions at special angles in any quadrant, and from a point on the terminal side.',
  order: 5.994,
  templates: [...UC_TEMPLATES],
  ruleCards: UC_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(unitCircleModule)
