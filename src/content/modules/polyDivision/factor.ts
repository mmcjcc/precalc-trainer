import { makeRng, mixSeed } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import type { PolyMistakeKind } from '@/engine'
import { ratToString } from '@/notation'
import { buildDivision, drawDivision, factorSlip, sdTrapKinds, type SdWant } from './build'

const VERSION = 1

/**
 * Half the seeds are factors. In every one of those the opposite number is NOT a zero, so testing it says
 * "no" and the engine names the sign slip. `opposite` is the mirror image: not a factor, but the opposite
 * number is a zero, so the slip says "yes". `plain` is not a factor either way.
 */
const SCENARIOS: readonly { id: string; weight: number; remainder: SdWant['remainder'] }[] = [
  { id: 'factor', weight: 5, remainder: 'zero' },
  { id: 'opposite', weight: 2, remainder: 'zero-at-opposite' },
  { id: 'plain', weight: 3, remainder: 'nonzero' },
]

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not the same polynomial as seed n of the other two templates.
  const rng = makeRng(mixSeed(seed, 3))
  let roll = rng.next() * SCENARIOS.reduce((sum, s) => sum + s.weight, 0)
  const scenario = SCENARIOS.find((s) => (roll -= s.weight) < 0) ?? SCENARIOS[0]!
  const want: SdWant = {
    degree: rng.chance(0.25) ? 4 : 3,
    missing: rng.chance(0.4),
    sign: 0,
    remainder: scenario.remainder,
  }
  const signSlip = scenario.id !== 'plain'
  const draft = drawDivision(rng, want, (d) => {
    const f = d.table.f
    const c = ratToString(d.table.c)
    // factor and opposite: the wrong yes / no must be the one that testing −c gives.
    if (signSlip) return factorSlip(f, c) === 'sd_wrong_sign_c'
    // plain: neither number is a zero, so a wrong "yes" is not the sign slip.
    return factorSlip(f, c) === null
  })
  // A plain seed's trap is in the table: the 0 for a missing power when there is one, else the box number.
  const trap: PolyMistakeKind = signSlip || draft.table.missingPowers.length === 0 ? 'sd_wrong_sign_c' : 'sd_missing_placeholder'
  if (!sdTrapKinds(draft.table.f, ratToString(draft.table.c), 'factor').includes(trap)) throw new Error(`sd.factor/${seed}: trap ${trap} is not a candidate`)
  return buildDivision({
    question: 'factor',
    templateId: 'sd.factor',
    version: VERSION,
    seed,
    knobs,
    title: 'Is it a factor?',
    instructions: 'Work the table on paper. Type its bottom row here, then answer yes or no.',
    draft,
    trap,
    scenario: scenario.id,
  })
}

export const factorTemplate: TemplateDef = {
  id: 'sd.factor',
  title: 'Is x − c a factor?',
  description: 'The factor theorem: decide whether x − c or x + c is a factor of a cubic or quartic. She types the bottom row of her table, then yes or no. About half are factors.',
  version: VERSION,
  knobs: [],
  generate,
}
