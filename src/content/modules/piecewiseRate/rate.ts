import type { DifficultyKnobs, ProblemInstance, TemplateDef } from '@/content/types'
import { makeRng, type Rng } from '@/content/rng'
import { averageRateMistakes, averageRateOfChange } from '@/engine'
import { fraction, linearExpr, polyExpr } from '../fnExpr'
import { buildRate } from './build'

const VERSION = 1
const TRIES = 48
const FAMILIES = ['linear', 'quadratic', 'rational'] as const
type Family = (typeof FAMILIES)[number]

const NUDGE = 'Average rate of change is the change in the outputs over the change in the inputs. Compute f at both ends, then divide.'

function rationalExpr(rng: Rng, a: number, b: number): string {
  const banned: number[] = []
  for (let t = a; t <= b; t++) banned.push(t)
  const h = rng.intExcept(-6, 6, banned)
  const numer = rng.pick([1, -1, 2])
  const denom = h === 0 ? 'x' : linearExpr(1, -h)
  return fraction(numer, denom)
}

function tryDraft(rng: Rng, family: Family): { f: string; a: number; b: number; text: string; steps: string[]; trap: string } | null {
  const a = rng.int(-4, 2)
  const b = a + rng.int(1, 4)
  const f =
    family === 'linear'
      ? linearExpr(rng.intExcept(-5, 5, [0]), rng.int(-6, 6))
      : family === 'quadratic'
        ? polyExpr([rng.int(-5, 5), rng.int(-4, 4), rng.pick([1, -1, 2, -2])])
        : rationalExpr(rng, a, b)
  const rate = averageRateOfChange(f, a, b)
  if (!rate) return null
  if (Math.abs(rate.rate.n) > 48 || rate.rate.d > 12) return null
  const mistakes = averageRateMistakes(f, a, b)
  if (!mistakes || mistakes.some((c) => c.shadows.length > 0)) return null
  const kinds = new Set(mistakes.map((c) => c.kind))
  for (const kind of ['rate_sign_flipped', 'rate_no_division', 'rate_inverted', 'rate_divided_by_b'] as const) {
    if (!kinds.has(kind)) return null
  }
  return { f, a, b, text: rate.text, steps: rate.steps, trap: `${family}-${rate.rate.d === 1 ? 'integer' : 'fraction'}` }
}

function generate(seed: number, knobs: DifficultyKnobs = {}): ProblemInstance {
  const rng = makeRng(seed >>> 0)
  const family = FAMILIES[(seed >>> 0) % FAMILIES.length]!
  for (let n = 0; n < TRIES; n++) {
    const draft = tryDraft(rng, family)
    if (!draft) continue
    return buildRate({
      version: VERSION,
      seed,
      knobs,
      f: draft.f,
      a: String(draft.a),
      b: String(draft.b),
      rateText: draft.text,
      nudge: NUDGE,
      reveal: draft.steps,
      trap: draft.trap,
    })
  }
  throw new Error(`arc.rate/${family}: no core-supported rate for seed ${seed}`)
}

export const rateTemplate: TemplateDef = {
  id: 'arc.rate',
  title: 'Average rate of change',
  description: 'The slope of the secant line for a polynomial or a rational function, as an integer or a fraction.',
  version: VERSION,
  knobs: [],
  generate,
}
