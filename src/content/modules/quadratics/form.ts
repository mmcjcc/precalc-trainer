import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildQuadratic, drawQuadratic, quadTrapKinds } from './build'
import { CS_RULE_IDS } from './rules'

const VERSION = 1

const NUDGE_MONIC =
  'Look at the x-term. Take half of its coefficient and square that half: add the square to make a perfect square, and subtract it again in the same line so nothing changes. Then write the first three terms as ( )^2 and tidy up the constants.'
const NUDGE_LEAD =
  'Start by factoring the number in front of x^2 out of the two x-terms only. Inside the parentheses, add and subtract the square of half the x-coefficient. When the subtracted number comes out of the parentheses, it is multiplied by the number in front.'

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed)
  const draft = drawQuadratic(rng, Boolean(knobs.fractions))
  const trap = rng.pick(quadTrapKinds(draft.coefficients, 'form'))
  const monic = draft.coefficients[0] === '1'
  return buildQuadratic({
    question: 'form',
    templateId: 'cs.form',
    version: VERSION,
    seed,
    knobs,
    title: 'Rewrite in vertex form',
    instructions: 'Type one line of your work at a time. Every line is checked, and the problem is finished when a line is in vertex form, a(x − h)^2 + k.',
    prompt: 'Write f(x) in vertex form.',
    nudge: monic ? NUDGE_MONIC : NUDGE_LEAD,
    draft,
    trap,
    ruleCards: monic
      ? [CS_RULE_IDS.half, CS_RULE_IDS.balance, CS_RULE_IDS.vertex]
      : [CS_RULE_IDS.factor, CS_RULE_IDS.half, CS_RULE_IDS.balance, CS_RULE_IDS.scale, CS_RULE_IDS.vertex],
  })
}

export const formTemplate: TemplateDef = {
  id: 'cs.form',
  title: 'Vertex form, line by line',
  description: 'Complete the square on ax^2 + bx + c, one checked line at a time. a is 1 about a third of the time; otherwise 3, −2, −1, 1/2 or 2. h is a whole number unless the fractions knob is on.',
  version: VERSION,
  knobs: [{ key: 'fractions', label: 'Fractional h (odd b/a)', default: false }],
  generate,
}
