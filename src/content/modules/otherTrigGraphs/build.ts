/**
 * Graphs of tan, cot, sec and csc (precalculus Unit 5), drawn from the seed: the function, A, B, the phase shift, D and
 * the form of the equation; for a list of asymptotes, the interval; for matching, the three slips and the order of the
 * four graphs. Every problem passes the gate (trig/build5.ts) before it is shown.
 */
import type { OtherTrigGraphsAnswer, TemplateDef } from '@/content/types'
import { generate5, type Module5 } from '../trig/build5'
import { drawOgFeatures } from './features'
import { drawMatch } from './match'
import { OG_RULES } from './rules'
import { OG_HINTS, OG_INSTRUCTIONS, OG_TITLES } from './words'

export const OG_MODULE_ID = 'otherTrigGraphs' as const
const VERSION = 1

export const OG_MODULE: Module5 = {
  moduleId: OG_MODULE_ID,
  kind: 'otherTrigGraphs',
  version: VERSION,
  titles: OG_TITLES,
  instructions: OG_INSTRUCTIONS,
  cards: OG_RULES,
  hints: OG_HINTS,
}

export const ogFeaturesTemplate: TemplateDef = {
  id: 'og.features',
  title: 'Features of tan, cot, sec and csc graphs',
  description: 'The period, the vertical asymptotes (a family, or the ones in an interval), the x-intercepts of tan and cot, the range of sec and csc.',
  version: VERSION,
  knobs: [],
  generate: generate5<OtherTrigGraphsAnswer>(OG_MODULE, 'otherTrigGraphs', 'og.features', 511, drawOgFeatures),
}

export const matchTemplate: TemplateDef = {
  id: 'og.match',
  title: 'Match the graph',
  description: 'Which of four graphs is the equation? tan, cot, sec, csc and sinusoids; the wrong graphs are common slips.',
  version: VERSION,
  knobs: [],
  generate: generate5<OtherTrigGraphsAnswer>(OG_MODULE, 'otherTrigGraphs', 'og.match', 512, drawMatch),
}

export const OG_TEMPLATES = [ogFeaturesTemplate, matchTemplate] as const
