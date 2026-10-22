import { registerModule } from '@/content/registry'
import type { ModuleDef, OtherTrigGraphsAnswer } from '@/content/types'
import { gradeTrigPart, trigWork, type TrigPartGrade } from '../trig/parts'
import { OG_MODULE_ID, OG_TEMPLATES } from './build'
import { OG_RULES } from './rules'

export { OG_RULES, OG_RULE_IDS } from './rules'
export { OG_HINTS, OG_INSTRUCTIONS, OG_TITLES } from './words'
export { OG_MODULE_ID, OG_TEMPLATES, matchTemplate, ogFeaturesTemplate } from './build'
export { ogFeaturesProblem, type OgFeaturesInput } from './features'
export { lookApart, matchProblem, matchSlips, type MatchInput } from './match'

/** Grade her entry for one part of a tan, cot, sec or csc problem. */
export function gradeOgPart(answer: OtherTrigGraphsAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeTrigPart(part, text)
}

export { trigWork as ogWork }

/** Graphs of tan, cot, sec and csc (precalculus Unit 5): period, asymptotes, zeros, range; matching graphs. */
export const otherTrigGraphsModule: ModuleDef = {
  id: OG_MODULE_ID,
  title: 'Graphs of tangent, cotangent, secant and cosecant',
  blurb: 'Periods, vertical asymptotes as families, the zeros of tan and cot, the range of sec and csc, and which graph is which.',
  order: 5.996,
  templates: [...OG_TEMPLATES],
  ruleCards: OG_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(otherTrigGraphsModule)
