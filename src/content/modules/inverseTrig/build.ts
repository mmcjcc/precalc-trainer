/**
 * Inverse trig functions (precalculus Unit 5), drawn from the seed: the function, its input (a special value, one
 * outside the domain, or a decimal for the calculator), the unit; for compositions, the kind (the inverse property,
 * an angle outside the range, a reference triangle, an expression in x) and its numbers. Every problem passes the gate
 * (trig/build5.ts) before it is shown.
 */
import type { InverseTrigAnswer, TemplateDef } from '@/content/types'
import { generate5, type Module5 } from '../trig/build5'
import { drawCompose } from './compose'
import { drawEvaluate } from './evaluate'
import { IT_RULES } from './rules'
import { IT_HINTS, IT_INSTRUCTIONS, IT_TITLES } from './words'

export const IT_MODULE_ID = 'inverseTrig' as const
const VERSION = 1

export const IT_MODULE: Module5 = {
  moduleId: IT_MODULE_ID,
  kind: 'inverseTrig',
  version: VERSION,
  titles: IT_TITLES,
  instructions: IT_INSTRUCTIONS,
  cards: IT_RULES,
  hints: IT_HINTS,
}

export const evaluateTemplate: TemplateDef = {
  id: 'it.evaluate',
  title: 'Values of the inverse functions',
  description: 'Exact values of arcsin, arccos and arctan at the special values (or no value at all), and values on the calculator in radians.',
  version: VERSION,
  knobs: [],
  generate: generate5<InverseTrigAnswer>(IT_MODULE, 'inverseTrig', 'it.evaluate', 521, drawEvaluate),
}

export const composeTemplate: TemplateDef = {
  id: 'it.compose',
  title: 'Compositions with inverse functions',
  description: 'sin(arcsin u), arcsin(sin θ), a function of an inverse with a reference triangle, and expressions in x.',
  version: VERSION,
  knobs: [],
  generate: generate5<InverseTrigAnswer>(IT_MODULE, 'inverseTrig', 'it.compose', 522, drawCompose),
}

export const IT_TEMPLATES = [evaluateTemplate, composeTemplate] as const
