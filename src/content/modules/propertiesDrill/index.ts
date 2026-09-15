import { registerDrillGenerator, registerModule } from '@/content/registry'
import { makeRng } from '@/content/rng'
import type { DrillItem, ModuleDef, RuleCard } from '@/content/types'
import { DRILL_FAMILIES, DRILL_PAIRS, type DrillCore, type DrillPair } from './bank'

export { DRILL_FAMILIES, DRILL_PAIRS }

/**
 * Deterministic drill session: `count` items built from legal/illegal twin pairs (CG-12).
 * Pairs are instantiated with fresh constants, both twins are kept (so `twinId` resolves inside
 * the returned list whenever `count` is even), and the whole list is shuffled so twins are not
 * adjacent. Pass `family` to restrict to one family (see DRILL_FAMILIES).
 */
export function generateDrill(seed: number, count: number, family?: string): DrillItem[] {
  const rng = makeRng(seed >>> 0)
  const pool = family ? DRILL_PAIRS.filter((p) => p.family === family) : DRILL_PAIRS
  if (pool.length === 0) throw new Error(`Unknown drill family: ${family}`)
  const seed36 = (seed >>> 0).toString(36)
  const pairsNeeded = Math.max(1, Math.ceil(count / 2))
  const items: DrillItem[] = []
  let order: DrillPair[] = rng.shuffle(pool)
  for (let n = 0; n < pairsNeeded; n++) {
    if (n > 0 && n % order.length === 0) order = rng.shuffle(pool)
    const tpl = order[n % order.length]!
    const [first, second] = tpl.make(rng)
    const idA = `drill/${tpl.key}@${seed36}#${n}a`
    const idB = `drill/${tpl.key}@${seed36}#${n}b`
    items.push(toItem(idA, idB, tpl, first, rng), toItem(idB, idA, tpl, second, rng))
  }
  return rng.shuffle(items).slice(0, count)
}

function toItem(
  id: string,
  twinId: string,
  tpl: DrillPair,
  core: DrillCore,
  rng: ReturnType<typeof makeRng>,
): DrillItem {
  const askProperty = core.verdict === 'legal' && !!core.chip && rng.chance(0.5)
  const item: DrillItem = {
    id,
    family: tpl.family,
    mode: tpl.mode,
    before: core.before,
    after: core.after,
    question: askProperty ? 'which_property' : 'legal_or_illegal',
    verdict: core.verdict,
    lesson: core.lesson,
    twinId,
  }
  if (core.relOp) item.relOp = core.relOp
  if (core.chip) item.chip = core.chip
  if (core.patternId) item.patternId = core.patternId
  return item
}

export const DRILL_RULES: RuleCard[] = [
  {
    id: 'both-sides',
    title: 'Legal moves act on BOTH sides',
    body: 'Add, subtract, multiply, or divide — the same thing to every term on both sides. Multiplying or dividing an inequality by a negative flips the symbol.',
    example: '-2x < 6  →  x > -3',
  },
  {
    id: 'same-side',
    title: 'Same-side rewrites must keep the value',
    body: 'Distribute, combine like terms, reorder (commutative), regroup (associative), or rewrite a fraction — the expression must equal the old one for EVERY x. When in doubt, plug in a number.',
    example: '3(x + 4) = 3x + 12, but (x + 3)^2 is NOT x^2 + 9 (try x = 1).',
  },
  {
    id: 'roots-powers',
    title: 'Roots and powers',
    body: 'Even root of both sides → ±. sqrt(u^2) = |u|. Odd roots and odd powers keep the sign: cbrt(−8) = −2. Powers distribute over × but never over +.',
    example: 'x^2 = 9  →  x = ±3;   cbrt(−8x) = −2·cbrt(x)',
  },
  {
    id: 'lost-solutions',
    title: 'Never divide by the variable',
    body: 'Dividing both sides by x (or any expression that can be 0) can erase a solution. Move everything to one side and factor instead.',
    example: 'x^2 = 3x  →  x(x − 3) = 0  →  x = 0 or x = 3',
  },
]

export const propertiesDrillModule: ModuleDef = {
  id: 'propertiesDrill',
  title: 'Properties drill',
  blurb: 'Legal or illegal? Which property? Quick-fire twins of the moves that come up in every module.',
  order: 5,
  // Items come from generateDrill (registered below); there are no seeded problem templates.
  templates: [],
  ruleCards: DRILL_RULES,
  progress: () => ({ stage: 0, total: 1, label: 'one step', anchorIndex: -1, path: 'none' }),
  nextStep: () => null,
}

registerModule(propertiesDrillModule)
registerDrillGenerator(generateDrill)
