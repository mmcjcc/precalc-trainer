import { makeRng, mixSeed } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import type { PolyMistakeKind } from '@/engine'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { buildZerosProblem, drawFactored, pzTrapKinds, weighted, zerosCalc, zerosGraph, type PolyZerosAnswer } from './build'

const VERSION = 1

/**
 * Exponents for two or three factors. Every list has an even one and an odd one, so the graph touches at
 * one zero and crosses at another, and the exponents are never all alike (moving them to the wrong zeros
 * shows). The total stays at 6 or less.
 */
const MULTS_TWO: readonly (readonly number[])[] = [[2, 1], [1, 2], [2, 1], [1, 2], [2, 3], [3, 2]]
const MULTS_THREE: readonly (readonly number[])[] = [
  [2, 1, 1],
  [1, 2, 1],
  [1, 1, 2],
  [2, 2, 1],
  [2, 1, 2],
  [1, 2, 2],
  [2, 1, 3],
  [3, 2, 1],
  [1, 3, 2],
]

/** The number in front never changes a zero. It is there about half the time, so it is not a signal. */
const LEADS: readonly { item: string; weight: number }[] = [
  { item: '1', weight: 5 },
  { item: '-1', weight: 2 },
  { item: '2', weight: 2 },
  { item: '-2', weight: 2 },
  { item: '3', weight: 1 },
  { item: '1/2', weight: 1 },
]

const TRAP_WEIGHTS: readonly { item: PolyMistakeKind; weight: number }[] = [
  { item: 'zero_sign_reversed', weight: 3 },
  { item: 'zero_nonmonic_factor', weight: 6 },
  { item: 'multiplicity_ignored', weight: 2 },
  { item: 'multiplicity_wrong_zero', weight: 2 },
  { item: 'cross_touch_swapped', weight: 3 },
]

const NUDGE_ZEROS =
  'A product is 0 exactly when one of its factors is 0. Take the factors one at a time: set each one equal to 0 and solve it. Then look at how each factor is written to see how many times its zero counts.'
const NUDGE_CROSS =
  'Think about the sign of f(x) just to the left and just to the right of each zero. Does the factor that is 0 there change sign as x passes the zero, or is it raised to a power that can never be negative?'

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not the same polynomial as seed n of the other templates.
  const rng = makeRng(mixSeed(seed, 11))
  const mults = rng.pick(rng.chance(0.6) ? MULTS_THREE : MULTS_TWO)
  const nonmonic = rng.chance(0.35)
  const origin = !nonmonic && rng.chance(0.15)
  const lead = weighted(rng, LEADS)
  const draft = drawFactored(rng, { mults, nonmonic, origin, lead, reach: 5 })
  const a = draft.analysis
  const zeros: PolyZerosAnswer['zeros'] = a.zeros.map((z) => ({ text: z.text, mult: z.mult, behavior: z.behavior }))
  const kinds = pzTrapKinds({ question: 'zeros', f: draft.text, zeros })
  const trap = weighted(rng, TRAP_WEIGHTS.filter((t) => kinds.includes(t.item)))
  const perZero = a.explanation.slice(0, a.zeros.length)
  return buildZerosProblem({
    question: 'zeros',
    templateId: 'pz.zeros',
    version: VERSION,
    seed,
    knobs,
    title: 'Zeros and multiplicity',
    instructions: 'Give each zero a row of its own, with its multiplicity. Then choose what the graph does at each zero.',
    prompt: 'Find every zero of f and its multiplicity. Then say what the graph of f does at each zero.',
    statementText: draft.text,
    f: draft.text,
    form: 'factored',
    zeros,
    end: a.end,
    nudges: [NUDGE_ZEROS, NUDGE_CROSS],
    reveals: [perZero, perZero],
    // Everything but the y-intercept, which this problem does not ask for.
    reveal: a.explanation.slice(0, a.zeros.length + 3),
    expectedDisplay: a.zeros.map((z) => `x = ${polyShow(z.text)} (multiplicity ${z.mult}, ${z.behavior})`).join('; '),
    trap,
    scenario: nonmonic ? 'nonmonic' : origin ? 'origin' : 'plain',
    graph: zerosGraph(draft.text, a),
    calc: zerosCalc(draft.text),
    params: { degree: a.degree, zeros: a.zeros.length, nonmonic, origin, lead },
  })
}

export const zerosTemplate: TemplateDef = {
  id: 'pz.zeros',
  title: 'Zeros of a factored polynomial',
  description: 'A polynomial in factored form: every zero with its multiplicity, then whether the graph crosses or touches the x-axis at each one. The graph appears once she has finished.',
  version: VERSION,
  knobs: [],
  generate,
}
