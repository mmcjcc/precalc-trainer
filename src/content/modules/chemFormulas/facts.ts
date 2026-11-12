/**
 * Percent composition and the empirical-formula procedure, on the shared substance table
 * (moles/facts.ts). Exact arithmetic throughout; every atomic mass is the rounded-to-hundredths
 * value her class uses.
 */
import { rat, ratAbs, ratCmp, ratDiv, ratMul, ratSub, roundRatToPlace, roundRatToSigFigs, type Rat } from '@/engine/sigfigs/decimal'
import { ratFromDec } from '@/engine/sigfigs/decimal'
import type { MoCount } from '@/content/types'
import {
  anhydrousCounts,
  countOf,
  countsMassHundredths,
  countsOf,
  hundredthsRat,
  massHundredths,
  molarMassHundredths,
  ratOf,
  WATER_HUNDREDTHS,
  type MoSubstance,
} from '../moles/facts'

const HUNDRED = rat(100n)

/** Percent by mass of one element in the substance (hydrate water included in the formula). */
export function percentByMass(s: MoSubstance, symbol: string): Rat {
  const k = BigInt(countOf(countsOf(s), symbol))
  return ratMul(ratDiv(rat(k * massHundredths(symbol)), rat(molarMassHundredths(s))), HUNDRED)
}

/** Percent of the atoms that are this element: the by-count slip. */
export function percentByCount(s: MoSubstance, symbol: string): Rat {
  const counts = countsOf(s)
  const total = counts.reduce((sum, c) => sum + c.n, 0)
  return ratMul(rat(BigInt(countOf(counts, symbol)), BigInt(total)), HUNDRED)
}

/** One atom's mass over the molar mass: the one-atom slip (only meaningful when the count is above one). */
export function percentOneAtom(s: MoSubstance, symbol: string): Rat {
  return ratMul(ratDiv(rat(massHundredths(symbol)), rat(molarMassHundredths(s))), HUNDRED)
}

/** The element's mass over the REST of the formula: the part-over-part slip. */
export function percentOverRest(s: MoSubstance, symbol: string): Rat {
  const part = BigInt(countOf(countsOf(s), symbol)) * massHundredths(symbol)
  return ratMul(ratDiv(rat(part), rat(molarMassHundredths(s) - part)), HUNDRED)
}

/** Percent water by mass in a hydrate. */
export function percentWater(s: MoSubstance): Rat {
  return ratMul(ratDiv(rat(BigInt(s.waters) * WATER_HUNDREDTHS), rat(molarMassHundredths(s))), HUNDRED)
}

/** One water over the salt plus one water: the counted-once slip. */
export function percentWaterOnce(s: MoSubstance): Rat {
  const salt = countsMassHundredths(anhydrousCounts(s))
  return ratMul(ratDiv(rat(WATER_HUNDREDTHS), rat(salt + WATER_HUNDREDTHS)), HUNDRED)
}

/** All the water over the salt alone: the part-over-part slip. */
export function percentWaterOverSalt(s: MoSubstance): Rat {
  const salt = countsMassHundredths(anhydrousCounts(s))
  return ratMul(ratDiv(rat(BigInt(s.waters) * WATER_HUNDREDTHS), rat(salt)), HUNDRED)
}

// ---------------------------------------------------------------------------
// The empirical-formula procedure
// ---------------------------------------------------------------------------

/** Each ratio must sit this close to its target (the brief's 0.03). */
export const RATIO_WINDOW = rat(3n, 100n)
/** A smaller multiplier must miss by at least this much, so no ratio could be read two ways. */
export const RATIO_MARGIN = rat(8n, 100n)

export interface EmpiricalSolve {
  moles: Rat[]
  /** Each element's moles over the smallest. */
  ratios: Rat[]
  /** The whole number every ratio is multiplied by (1 to 4). */
  factor: number
  counts: MoCount[]
}

function nearestWhole(r: Rat): bigint {
  return roundRatToPlace(r, 0).m
}

function distanceToTarget(r: Rat, factor: number): Rat {
  const target = rat(nearestWhole(ratMul(r, rat(BigInt(factor)))), BigInt(factor))
  return ratAbs(ratSub(r, target))
}

/** Moles of each element from its grams (a percent is read as grams of a 100 g sample). */
export function molesOf(data: readonly { symbol: string; amount: string }[], roundTo?: number): Rat[] {
  return data.map((d) => {
    const exact = ratDiv(ratOf(d.amount), hundredthsRat(massHundredths(d.symbol)))
    if (roundTo == null) return exact
    const r = roundRatToSigFigs(exact, roundTo)
    return ratFromDec({ int: r.m, exp: r.place })
  })
}

/** Divide by the smallest, then find the smallest multiplier (1 to 4) that makes every ratio whole. */
export function solveFromMoles(symbols: readonly string[], moles: readonly Rat[]): EmpiricalSolve | null {
  let min = moles[0]!
  for (const m of moles) if (ratCmp(m, min) < 0) min = m
  const ratios = moles.map((m) => ratDiv(m, min))
  for (let factor = 1; factor <= 4; factor++) {
    if (!ratios.every((r) => ratCmp(distanceToTarget(r, factor), RATIO_WINDOW) <= 0)) continue
    // Every smaller multiplier must clearly fail, or a ratio could be read two ways.
    for (let smaller = 1; smaller < factor; smaller++) {
      if (!ratios.some((r) => ratCmp(distanceToTarget(r, smaller), RATIO_MARGIN) >= 0)) return null
    }
    const counts = ratios.map((r, i) => ({ symbol: symbols[i]!, n: Number(nearestWhole(ratMul(r, rat(BigInt(factor))))) }))
    return { moles: [...moles], ratios, factor, counts }
  }
  return null
}

export function solveEmpirical(data: readonly { symbol: string; amount: string }[]): EmpiricalSolve | null {
  return solveFromMoles(
    data.map((d) => d.symbol),
    molesOf(data),
  )
}

/** The rounded-ratio slip: each ratio rounded to a whole number instead of multiplied up. */
export function roundedRatioSlips(solve: EmpiricalSolve): MoCount[][] {
  if (solve.factor === 1) return []
  const down = solve.ratios.map((r, i) => {
    const t = ratMul(r, rat(2n))
    // a ratio near x.5: halve-down reading
    const half = ratCmp(ratAbs(ratSub(t, rat(nearestWhole(t)))), rat(1n, 10n)) <= 0 && nearestWhole(t) % 2n === 1n
    const n = half ? (nearestWhole(t) - 1n) / 2n : nearestWhole(r)
    return { symbol: solve.counts[i]!.symbol, n: Number(n) }
  })
  const up = solve.ratios.map((r, i) => {
    const t = ratMul(r, rat(2n))
    const half = ratCmp(ratAbs(ratSub(t, rat(nearestWhole(t)))), rat(1n, 10n)) <= 0 && nearestWhole(t) % 2n === 1n
    const n = half ? (nearestWhole(t) + 1n) / 2n : nearestWhole(r)
    return { symbol: solve.counts[i]!.symbol, n: Number(n) }
  })
  const out: MoCount[][] = []
  for (const c of [down, up]) {
    if (c.some((x) => x.n < 1)) continue
    if (out.some((o) => o.every((x, i) => x.n === c[i]!.n))) continue
    out.push(c)
  }
  return out
}

/**
 * The mass-ratio slip: the given amounts divided by the smallest and read as the subscripts, with
 * no conversion to moles. Only when every such ratio clearly rounds (within 0.3 of a whole number).
 */
export function massRatioSlip(data: readonly { symbol: string; amount: string }[]): MoCount[] | null {
  const amounts = data.map((d) => ratOf(d.amount))
  let min = amounts[0]!
  for (const a of amounts) if (ratCmp(a, min) < 0) min = a
  const counts: MoCount[] = []
  for (let i = 0; i < data.length; i++) {
    const q = ratDiv(amounts[i]!, min)
    const n = nearestWhole(q)
    if (ratCmp(ratAbs(ratSub(q, rat(n))), rat(3n, 10n)) > 0) return null
    if (n < 1n || n > 99n) return null
    counts.push({ symbol: data[i]!.symbol, n: Number(n) })
  }
  return counts
}
