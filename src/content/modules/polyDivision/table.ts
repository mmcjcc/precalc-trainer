import { makeRng } from '@/content/rng'
import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import type { PolyMistakeKind } from '@/engine'
import { ratToString } from '@/notation'
import { buildDivision, drawDivision, sdTrapKinds, type SdWant } from './build'

const VERSION = 1

/**
 * What a seed is built around. `placeholder`: a power is missing in the middle of f. `sign`: the divisor
 * is x + k. `columns`: the arithmetic of the table. `read`: reading the quotient and remainder off the
 * bottom row. The promised trap is one of the scenario's kinds, checked against the engine's candidates.
 */
const SCENARIOS: readonly { id: string; weight: number; traps: readonly PolyMistakeKind[] }[] = [
  { id: 'placeholder', weight: 4, traps: ['sd_missing_placeholder'] },
  { id: 'sign', weight: 3, traps: ['sd_wrong_sign_c'] },
  { id: 'columns', weight: 3, traps: ['sd_subtracted', 'sd_first_coefficient'] },
  { id: 'read', weight: 2, traps: ['sd_quotient_degree', 'sd_remainder_last_quotient'] },
]

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed)
  let roll = rng.next() * SCENARIOS.reduce((sum, s) => sum + s.weight, 0)
  const scenario = SCENARIOS.find((s) => (roll -= s.weight) < 0) ?? SCENARIOS[0]!
  const trap = rng.pick(scenario.traps)
  const want: SdWant = {
    degree: rng.chance(0.3) ? 4 : 3,
    // A missing power also turns up outside its own scenario, so the 0 is never a signal by itself.
    missing: scenario.id === 'placeholder' || rng.chance(0.3),
    sign: scenario.id === 'sign' ? -1 : 0,
    remainder: 'free',
  }
  const draft = drawDivision(rng, want, (d) => {
    // With 1 in the box the first product equals the first coefficient, so "started with the product" hides.
    if (trap === 'sd_first_coefficient' && d.c === 1) return false
    return sdTrapKinds(d.table.f, ratToString(d.table.c), 'table').includes(trap)
  })
  return buildDivision({
    question: 'table',
    templateId: 'sd.table',
    version: VERSION,
    seed,
    knobs,
    title: 'Synthetic division',
    instructions: 'Three parts, checked one at a time: the top row of the table, the table itself, then the quotient and the remainder. Exact numbers only.',
    draft,
    trap,
    scenario: scenario.id,
  })
}

export const tableTemplate: TemplateDef = {
  id: 'sd.table',
  title: 'The division table',
  description: 'Divide a cubic or quartic by x − c or x + c. She types the coefficient row herself, fills in the box, the products and the bottom row cell by cell, then gives the quotient and the remainder.',
  version: VERSION,
  knobs: [],
  generate,
}
