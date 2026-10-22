/**
 * Graphs of sine and cosine (precalculus Unit 5), drawn from the seed: the function, A, B, the phase shift, D and the
 * form of the equation; a graph's window and labelled points, or a description's words; a model's story and numbers.
 * Answers and slips come from the trig core (engine/trig: wave, shift, expr); every problem passes the gate
 * (trig/build5.ts) before it is shown, and a seed whose draw fails it tries the next draw from the same seed.
 */
import type { SinusoidsAnswer, TemplateDef } from '@/content/types'
import { generate5, type Module5 } from '../trig/build5'
import { drawEquation } from './equation'
import { drawFeatures } from './features'
import { drawModel } from './model'
import { SG_RULES } from './rules'
import { SG_HINTS, SG_INSTRUCTIONS, SG_TITLES } from './words'

export const SG_MODULE_ID = 'sinusoids' as const
const VERSION = 1

export const SG_MODULE: Module5 = {
  moduleId: SG_MODULE_ID,
  kind: 'sinusoids',
  version: VERSION,
  titles: SG_TITLES,
  instructions: SG_INSTRUCTIONS,
  cards: SG_RULES,
  hints: SG_HINTS,
}

export const featuresTemplate: TemplateDef = {
  id: 'sg.features',
  title: 'Features of a sine or cosine graph',
  description: 'From y = A sin(B(x − C)) + D or A cos(Bx − C) + D: the amplitude, period, phase shift, midline and range, and sometimes the five key points.',
  version: VERSION,
  knobs: [],
  generate: generate5<SinusoidsAnswer>(SG_MODULE, 'sinusoids', 'sg.features', 501, drawFeatures),
}

export const equationTemplate: TemplateDef = {
  id: 'sg.equation',
  title: 'An equation for a sinusoid',
  description: 'An equation from a graph with its highest and lowest points labelled, or from a description; any equivalent equation is right.',
  version: VERSION,
  knobs: [],
  generate: generate5<SinusoidsAnswer>(SG_MODULE, 'sinusoids', 'sg.equation', 502, drawEquation),
}

export const modelTemplate: TemplateDef = {
  id: 'sg.model',
  title: 'Sinusoidal models',
  description: 'A Ferris wheel, tides, daylight or temperature: write the model, find a value, and the first time it reaches a height, in RADIAN mode.',
  version: VERSION,
  knobs: [],
  generate: generate5<SinusoidsAnswer>(SG_MODULE, 'sinusoids', 'sg.model', 503, drawModel),
}

export const SG_TEMPLATES = [featuresTemplate, equationTemplate, modelTemplate] as const
