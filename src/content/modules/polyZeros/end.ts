import { makeRng, mixSeed } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { gradeEndBehavior } from '@/engine'
import type { PolyMistakeKind } from '@/engine'
import { buildZerosProblem, drawFactored, largestNumber, zerosGraph, type FactoredDraft } from './build'

const VERSION = 1

/**
 * Exponents for a factored statement. In MISMATCH the number of factors is even when the degree is odd, or
 * the other way round, so counting factors instead of exponents gives the wrong pattern for the ends.
 */
const MISMATCH: readonly (readonly number[])[] = [[1, 2], [2, 1], [2, 3], [3, 2], [2, 1, 1], [1, 2, 1], [1, 1, 2], [2, 2, 2], [3, 1, 2], [1, 1, 4]]
const MATCH: readonly (readonly number[])[] = [[1, 3], [3, 1], [2, 2], [2, 4], [1, 1, 1], [2, 2, 1], [1, 2, 2], [1, 1, 3], [3, 1, 1]]

/** Exponents for a statement that is multiplied out: degree 3 to 5, so the coefficients stay small. */
const EXPANDED: readonly (readonly number[])[] = [[1, 1, 1], [2, 1], [1, 2], [1, 1, 2], [2, 1, 1], [2, 2], [1, 3], [3, 1], [2, 3], [3, 2], [1, 2, 2]]

const NEGATIVE = ['-1', '-2', '-3', '-1', '-2'] as const
const ANY_SIGN = ['1', '2', '3', '1', '-1', '-2'] as const

/** No coefficient of a multiplied-out statement is larger than this. */
const COEFFICIENT_LIMIT = 60

const NUDGE_FACTORED =
  'Far out to the left and to the right, only the highest power of x matters. Picture f(x) multiplied out: what would its highest power be, and would the number in front of that power be positive or negative?'
const NUDGE_STANDARD =
  'Far out to the left and to the right, only the term with the highest power of x matters. Is that power even or odd? Is the number in front of it positive or negative?'

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not the same polynomial as seed n of the other templates.
  const rng = makeRng(mixSeed(seed, 12))
  const standard = rng.chance(0.45)
  // `sign`: a negative leading coefficient. `parity`: either sign; the slip is the even / odd pattern.
  const scenario = rng.chance(0.5) ? 'sign' : 'parity'
  const lead = rng.pick(scenario === 'sign' ? NEGATIVE : ANY_SIGN)
  const trap: PolyMistakeKind = scenario === 'sign' ? 'end_sign_ignored' : 'end_parity_swapped'

  let shown: string
  let draft: FactoredDraft
  if (standard) {
    // Multiplied out from whole-number zeros close to 0: the graph meets the x-axis inside a small window.
    draft = drawFactored(rng, { mults: rng.pick(EXPANDED), nonmonic: false, origin: rng.chance(0.2), lead, reach: 3 }, (d) => largestNumber(d.analysis.expandedText) <= COEFFICIENT_LIMIT)
    shown = draft.analysis.expandedText
  } else {
    const mults = rng.pick(scenario === 'parity' ? MISMATCH : rng.chance(0.5) ? MISMATCH : MATCH)
    const nonmonic = rng.chance(0.25)
    draft = drawFactored(rng, { mults, nonmonic, origin: !nonmonic && rng.chance(0.15), lead, reach: 5 })
    shown = draft.text
  }
  const a = draft.analysis
  // The explanation the engine gives for THIS way of writing f (the leading term, or the sum of the exponents).
  const right = gradeEndBehavior(shown, a.end)
  if (right.verdict !== 'correct') throw new Error(`pz.end/${seed}: the engine's ends do not grade correct for ${shown}`)

  return buildZerosProblem({
    question: 'end',
    templateId: 'pz.end',
    version: VERSION,
    seed,
    knobs,
    title: 'End behavior',
    instructions: 'Choose where f(x) goes at each end of the graph.',
    prompt: 'Describe the end behavior of f: where does f(x) go at the far left, and at the far right?',
    statementText: shown,
    f: shown,
    form: standard ? 'standard' : 'factored',
    zeros: [],
    end: a.end,
    nudges: [standard ? NUDGE_STANDARD : NUDGE_FACTORED],
    reveals: [right.explanation],
    reveal: right.explanation,
    expectedDisplay: `left end ${a.end.left}, right end ${a.end.right}. ${a.endText}`,
    trap,
    scenario,
    graph: zerosGraph(shown, a),
    params: { degree: a.degree, factors: draft.want.mults.length, lead, standard },
  })
}

export const endTemplate: TemplateDef = {
  id: 'pz.end',
  title: 'End behavior',
  description: 'A polynomial in factored form or in standard form: where each end of its graph goes. The graph appears once she has finished.',
  version: VERSION,
  knobs: [],
  generate,
}
