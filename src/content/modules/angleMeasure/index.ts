import { registerModule } from '@/content/registry'
import type { AngleMeasureAnswer, ModuleDef } from '@/content/types'
import { gradeTrigPart, trigWork, type TrigPartGrade } from '../trig/parts'
import { AM_MODULE_ID, AM_TEMPLATES } from './build'
import { AM_RULES } from './rules'

export { AM_RULES, AM_RULE_IDS } from './rules'
export {
  AM_HINTS,
  AM_INSTRUCTIONS,
  AM_MODULE_ID,
  AM_TEMPLATES,
  ARC_DECIMAL_HINT,
  ARC_EXACT_HINT,
  CHOICE_HINT,
  DECIMAL_HINT,
  DEG_HINT,
  RAD_HINT,
  arcProblem,
  arcTemplate,
  convertDecimalProblem,
  convertProblem,
  convertTemplate,
  coterminalProblem,
  coterminalTemplate,
  referenceProblem,
  referenceTemplate,
} from './build'

/** Grade her entry for one part of an angle-measure problem. */
export function gradeAmPart(answer: AngleMeasureAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeTrigPart(part, text)
}

export { trigWork as amWork }

/**
 * Angles and radian measure (precalculus Unit 4, first half): degrees and radians, coterminal angles, the quadrant
 * and the reference angle, arc length and sector area.
 */
export const angleMeasureModule: ModuleDef = {
  id: AM_MODULE_ID,
  title: 'Angles and radian measure',
  blurb: 'Degrees and radians, coterminal angles, quadrants and reference angles, arc length and sector area.',
  order: 5.993,
  templates: [...AM_TEMPLATES],
  ruleCards: AM_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(angleMeasureModule)
