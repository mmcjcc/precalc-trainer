import { registerModule } from '@/content/registry'
import type { ModuleDef, RightTriangleAnswer } from '@/content/types'
import { gradeTrigPart, trigWork, type TrigPartGrade } from '../trig/parts'
import { RT_MODULE_ID, RT_TEMPLATES } from './build'
import { RT_RULES } from './rules'

export { RT_RULES, RT_RULE_IDS } from './rules'
export { RT_EXACT_HINT, RT_ANGLE_HINT, RT_HINTS, RT_INSTRUCTIONS, RT_SIDE_HINT, RT_TITLES } from './words'
export { RT_MODULE_ID, RT_TEMPLATES, angleTemplate, finishRt, ratiosTemplate, sideTemplate, specialTemplate } from './build'
export { ratiosProblem } from './ratios'
export { specialProblem } from './specials'
export { sideProblem } from './sides'
export { angleProblem } from './angles'

/** Grade her entry for one part of a right-triangle problem. */
export function gradeRtPart(answer: RightTriangleAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeTrigPart(part, text)
}

export { trigWork as rtWork }

/**
 * Right triangle trigonometry (precalculus Unit 4, second half): the six ratios from two sides, the special right
 * triangles, a side from an angle and a side, an angle from two sides; angles of elevation and depression.
 */
export const rightTriangleModule: ModuleDef = {
  id: RT_MODULE_ID,
  title: 'Right triangle trigonometry',
  blurb: 'SOH CAH TOA, the special right triangles, and sides and angles on the calculator, with elevation and depression word problems.',
  order: 5.9935,
  templates: [...RT_TEMPLATES],
  ruleCards: RT_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(rightTriangleModule)
