import { makeRng, mixSeed } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import type { PolyMistakeKind } from '@/engine'
import { ratToString } from '@/notation'
import { buildDivision, drawDivision, sdTrapKinds, type SdWant } from './build'

const VERSION = 1

/** `theorem`: which number of the bottom row is f(c). `sign`: a negative c. `placeholder`: a missing power. */
const SCENARIOS: readonly { id: string; weight: number; trap: PolyMistakeKind }[] = [
  { id: 'theorem', weight: 4, trap: 'sd_remainder_last_quotient' },
  { id: 'sign', weight: 3, trap: 'sd_wrong_sign_c' },
  { id: 'placeholder', weight: 3, trap: 'sd_missing_placeholder' },
  { id: 'columns', weight: 1, trap: 'sd_first_coefficient' },
]

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  // Salted, so seed n here is not the same polynomial as seed n of sd.table.
  const rng = makeRng(mixSeed(seed, 2))
  let roll = rng.next() * SCENARIOS.reduce((sum, s) => sum + s.weight, 0)
  const scenario = SCENARIOS.find((s) => (roll -= s.weight) < 0) ?? SCENARIOS[0]!
  const trap = scenario.trap
  const want: SdWant = {
    degree: rng.chance(0.35) ? 4 : 3,
    missing: scenario.id === 'placeholder' || rng.chance(0.3),
    sign: scenario.id === 'sign' ? -1 : 0,
    // A value of 0 is the factor question's business.
    remainder: 'nonzero',
  }
  const draft = drawDivision(rng, want, (d) => {
    if (trap === 'sd_first_coefficient' && d.c === 1) return false
    return sdTrapKinds(d.table.f, ratToString(d.table.c), 'value').includes(trap)
  })
  return buildDivision({
    question: 'value',
    templateId: 'sd.value',
    version: VERSION,
    seed,
    knobs,
    title: 'Find the value of f',
    instructions: 'Work the table on paper. Type its bottom row here, then the value. Exact numbers only.',
    draft,
    trap,
    scenario: scenario.id,
  })
}

export const valueTemplate: TemplateDef = {
  id: 'sd.value',
  title: 'f(c) from the table',
  description: 'The remainder theorem: find f(c) for a cubic or quartic by synthetic division. She types the bottom row of her table, then the value.',
  version: VERSION,
  knobs: [],
  generate,
}
