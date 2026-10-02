import { makeRng, mixSeed } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { buildQuadratic, drawQuadratic, quadTrapKinds } from './build'
import { CS_RULE_IDS } from './rules'

const VERSION = 1

const NUDGE =
  'Complete the square, or find the axis with x = −b/(2a) and put that x into f(x) for the height. The vertex is the point (h, k). The sign of the number in front of x^2 says which way the parabola opens, and that decides whether k is a minimum or a maximum.'

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not the same quadratic as seed n of cs.form.
  const rng = makeRng(mixSeed(seed, 2))
  const draft = drawQuadratic(rng, Boolean(knobs.fractions))
  const trap = rng.pick(quadTrapKinds(draft.coefficients, 'vertex'))
  const monic = draft.coefficients[0] === '1'
  return buildQuadratic({
    question: 'vertex',
    templateId: 'cs.vertex',
    version: VERSION,
    seed,
    knobs,
    title: 'Vertex, axis of symmetry, and direction',
    instructions: 'Give the vertex as a point, the axis of symmetry as an equation, which way the parabola opens, and its minimum or maximum value. Exact numbers: a fraction stays a fraction.',
    prompt: 'Find the vertex, the axis of symmetry, the direction the parabola opens, and its minimum or maximum value.',
    nudge: NUDGE,
    draft,
    trap,
    ruleCards: monic
      ? [CS_RULE_IDS.vertex, CS_RULE_IDS.axis, CS_RULE_IDS.opens, CS_RULE_IDS.half, CS_RULE_IDS.balance]
      : [CS_RULE_IDS.vertex, CS_RULE_IDS.axis, CS_RULE_IDS.opens, CS_RULE_IDS.factor, CS_RULE_IDS.half, CS_RULE_IDS.balance, CS_RULE_IDS.scale],
  })
}

export const vertexTemplate: TemplateDef = {
  id: 'cs.vertex',
  title: 'Vertex and axis of symmetry',
  description: 'A quadratic in standard form: its vertex, axis of symmetry, direction, and minimum or maximum value. The graph with the vertex marked appears once she has finished.',
  version: VERSION,
  knobs: [{ key: 'fractions', label: 'Fractional h (odd b/a)', default: false }],
  generate,
}
