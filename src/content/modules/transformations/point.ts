import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildTransform } from './build'
import { cardsFor, TR_NUDGE } from './copy'
import { draftTransform } from './draft'

const VERSION = 1

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const draft = draftTransform(seed, 'point')
  const cards = cardsFor(draft.trap)
  return buildTransform({
    question: 'point',
    templateId: 'tr.point',
    version: VERSION,
    seed,
    knobs,
    title: 'Map a point',
    instructions: 'A point on f is given. Type the point on g as (x, y). x goes through the inside backwards, and y goes through the outside forwards.',
    draft,
    nudge: TR_NUDGE[draft.trap] ?? TR_NUDGE['v-order']!,
    ...cards,
  })
}

export const pointTemplate: TemplateDef = {
  id: 'tr.point',
  title: 'Map a point',
  description: 'A point on f moves to a point on g. Includes a negative a with a vertical shift, where multiply-then-shift matters.',
  version: VERSION,
  knobs: [],
  generate,
}
