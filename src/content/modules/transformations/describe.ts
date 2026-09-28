import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildTransform } from './build'
import { cardsFor, TR_NUDGE } from './copy'
import { draftTransform } from './draft'

const VERSION = 1

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const draft = draftTransform(seed, 'describe')
  const cards = cardsFor(draft.trap)
  return buildTransform({
    question: 'describe',
    templateId: 'tr.describe',
    version: VERSION,
    seed,
    knobs,
    title: 'Describe the transformations',
    instructions: 'List every transformation that takes the graph of f to the graph of g. Add a card for each one. Order does not matter.',
    draft,
    nudge: TR_NUDGE[draft.trap] ?? TR_NUDGE['shift-right']!,
    ...cards,
  })
}

export const describeTemplate: TemplateDef = {
  id: 'tr.describe',
  title: 'Describe the transformations',
  description: 'Build the list of shifts, stretches, and reflections that take f to g, including the unfactored f(bx − c) trap.',
  version: VERSION,
  knobs: [],
  generate,
}
