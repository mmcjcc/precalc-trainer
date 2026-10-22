import { registerModule } from '@/content/registry'
import type { ModuleDef, SinusoidsAnswer } from '@/content/types'
import { gradeTrigPart, trigWork, type TrigPartGrade } from '../trig/parts'
import { SG_MODULE_ID, SG_TEMPLATES } from './build'
import { SG_RULES } from './rules'

export { SG_RULES, SG_RULE_IDS } from './rules'
export { SG_HINTS, SG_INSTRUCTIONS, SG_TITLES } from './words'
export { SG_MODULE_ID, SG_TEMPLATES, equationTemplate, featuresTemplate, modelTemplate } from './build'
export { featuresProblem, type FeaturesInput } from './features'
export { equationProblem, type EquationFromGraph, type EquationFromWords } from './equation'
export { crossings, modelProblem, modelValue, type ModelInput } from './model'

/** Grade her entry for one part of a sinusoid problem. */
export function gradeSgPart(answer: SinusoidsAnswer, stageId: string, text: string): TrigPartGrade {
  const part = answer.stages.find((s) => s.id === stageId)
  if (!part) return { verdict: 'invalid', message: 'This part could not be found.' }
  return gradeTrigPart(part, text)
}

export { trigWork as sgWork }

/**
 * Graphs of sine and cosine (precalculus Unit 5): the amplitude, period, phase shift, midline and range of
 * y = A sin(B(x − C)) + D, an equation from a graph or a description, and sinusoidal models.
 */
export const sinusoidsModule: ModuleDef = {
  id: SG_MODULE_ID,
  title: 'Graphs of sine and cosine',
  blurb: 'Amplitude, period, phase shift and midline; an equation from a graph or a description; Ferris wheels, tides and temperatures.',
  order: 5.995,
  templates: [...SG_TEMPLATES],
  ruleCards: SG_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(sinusoidsModule)
