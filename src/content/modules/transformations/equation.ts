import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildTransform } from './build'
import { cardsFor, TR_NUDGE } from './copy'
import { draftTransform } from './draft'

const VERSION = 1

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const draft = draftTransform(seed, 'equation')
  const cards = cardsFor(draft.trap)
  return buildTransform({
    question: 'equation',
    templateId: 'tr.equation',
    version: VERSION,
    seed,
    knobs,
    title: 'Write the equation of g',
    instructions: 'The parent and the transformations are given in words. Type g(x) as a formula in x, with the parent written out. Do not leave it in f-notation.',
    draft,
    nudge: TR_NUDGE[draft.trap] ?? TR_NUDGE['shift-right']!,
    ...cards,
  })
}

export const equationTemplate: TemplateDef = {
  id: 'tr.equation',
  title: 'Write the equation of g',
  description: 'Turn a list of transformations into an explicit formula. Factor the inside, and keep a and k outside the parentheses.',
  version: VERSION,
  knobs: [],
  generate,
}
