/**
 * Models of the percent-composition and formula parts (chemistry chapter 10). Graded by the shared
 * machinery in moles/numeric.ts, dispatched from moles/grade.ts. Every percent and every formula
 * re-derives from the substance table and the printed amounts.
 */
import type { MoCheck, MoCount } from '@/content/types'
import type { ErrorPatternId, SigFigTask } from '@/shared/types'
import { analyseSigFigTask } from '@/engine/sigfigs/evaluate'
import { decToPlain, rat, ratAdd, ratDiv, ratMul, roundRatToPlace, roundRatToSigFigs, ratSub, type Rat } from '@/engine/sigfigs/decimal'
import {
  atomicMassText,
  countOf,
  countsMassHundredths,
  countsOf,
  fullMolarMass,
  ratOf,
  substanceOf,
} from '../moles/facts'
import type { NumericTrap, PartModel } from '../moles/numeric'
import { massRatioSlip, percentByCount, percentByMass, percentOneAtom, percentOverRest, percentWater, percentWaterOnce, percentWaterOverSalt, roundedRatioSlips, solveEmpirical } from './facts'

const CF_KINDS = new Set<MoCheck['kind']>(['percent', 'percent-water', 'percent-sample', 'element-moles', 'empirical', 'formula-mass', 'multiplier', 'molecular'])

type CfCheck = Extract<MoCheck, { kind: 'percent' | 'percent-water' | 'percent-sample' | 'element-moles' | 'empirical' | 'formula-mass' | 'multiplier' | 'molecular' }>

export function isCfCheck(check: MoCheck): check is CfCheck {
  return CF_KINDS.has(check.kind)
}

export const CF_WITNESS = {
  byCount:
    'You counted atoms instead of weighing them. Percent composition is by mass, and a heavy atom outweighs a light one, so each element’s share comes from its mass, not its number.',
  oneAtom: (symbol: string) => `You weighed one ${symbol} atom. The formula holds more than one, so multiply its atomic mass by the subscript first.`,
  overRest: 'You divided by the rest of the compound. A percent compares one part with the WHOLE, so divide by the molar mass of the entire formula.',
  overOther: 'You divided one element’s grams by the other’s. A percent compares a part with the whole sample, so divide by all the grams together.',
  waterOverSalt: 'You divided the water by the salt alone. Percent water compares the waters with the whole hydrate, salt and water together.',
  waterOnce: 'You counted one water. The number in front of H₂O says how many waters each formula unit carries, and all of them belong in the percent.',
  molarMultiplied: 'You multiplied by the atomic mass. Grams turn into moles by dividing by the mass of one mole.',
  massRatio: 'You used the grams themselves as the ratio. Subscripts count atoms, so turn each element’s grams into moles before you compare them.',
  ratioRounded:
    'You rounded a ratio that was not close to a whole number. A ratio that ends in a half, a third or a quarter means multiply every ratio up until they are all whole.',
  empiricalBack: 'That is the empirical formula itself. The molar mass is a whole number of times bigger, so every subscript gets multiplied.',
  multiplierBack: 'You wrote the multiplier in place of the subscripts. Multiply each subscript of the empirical formula by it instead.',
  subscripts: 'You added one of each atom. Every subscript multiplies its atom’s mass — the formula counts how many of each there are.',
} as const

const HUNDRED = rat(100n)

/** A long chopped decimal of an exact value, for a sig-fig 'round' task (the rounding happens far above the cut). */
export function chopText(r: Rat, digits = 24): string {
  const cut = roundRatToSigFigs(r, digits)
  return decToPlain({ int: cut.truncM, exp: cut.place })
}

function roundTask(exact: Rat, place: number): SigFigTask {
  return { kind: 'round', text: chopText(exact), place }
}

function trap(id: ErrorPatternId, exact: Rat, witness: string): NumericTrap {
  return { id, exact, witness }
}

/** The percent-from-measured-masses calculation: part ÷ (sum of parts) × 100. */
export function sampleTask(parts: readonly { symbol: string; grams: string }[], element: string): SigFigTask {
  const part = parts.find((p) => p.symbol === element)
  if (!part) throw new Error(`chemFormulas: ${element} is not in the sample`)
  return {
    kind: 'mixed',
    operands: [{ text: part.grams }, { terms: parts.map((p) => ({ text: p.grams })), ops: parts.slice(1).map(() => '+' as const) }, { text: '100', exact: true, note: 'percent' }],
    ops: ['/', '*'],
  }
}

export function elementMolesTask(symbol: string, grams: string): SigFigTask {
  return { kind: 'muldiv', terms: [{ text: grams }, { text: atomicMassText(symbol) }], ops: ['/'] }
}

/** The multiplier: measured molar mass over the empirical formula mass, to the nearest whole number. */
export function multiplierOf(counts: readonly MoCount[], molarMass: string): number {
  const ratio = ratDiv(ratOf(molarMass), rat(countsMassHundredths(counts), 100n))
  return Number(roundRatToPlace(ratio, 0).m)
}

export function cfModel(check: CfCheck): PartModel {
  switch (check.kind) {
    case 'percent': {
      const s = substanceOf(check.formula)
      const k = countOf(countsOf(s), check.element)
      const exact = percentByMass(s, check.element)
      const traps: NumericTrap[] = [trap('mo_percent_by_count', percentByCount(s, check.element), CF_WITNESS.byCount)]
      if (k > 1) traps.push(trap('mo_percent_one_atom', percentOneAtom(s, check.element), CF_WITNESS.oneAtom(check.element)))
      traps.push(trap('mo_percent_part_over_part', percentOverRest(s, check.element), CF_WITNESS.overRest))
      return { mode: 'numeric', task: roundTask(exact, check.place), exact, traps }
    }
    case 'percent-water': {
      const s = substanceOf(check.formula)
      const exact = percentWater(s)
      const traps: NumericTrap[] = []
      if (s.waters > 1) traps.push(trap('mo_hydrate_water_once', percentWaterOnce(s), CF_WITNESS.waterOnce))
      traps.push(trap('mo_percent_part_over_part', percentWaterOverSalt(s), CF_WITNESS.waterOverSalt))
      return { mode: 'numeric', task: roundTask(exact, check.place), exact, traps }
    }
    case 'percent-sample': {
      const task = sampleTask(check.parts, check.element)
      const exact = analyseSigFigTask(task).exactValue
      const part = ratOf(check.parts.find((p) => p.symbol === check.element)!.grams)
      const total = check.parts.reduce((sum, p) => ratAdd(sum, ratOf(p.grams)), rat(0n))
      const overRest = ratMul(ratDiv(part, ratSub(total, part)), HUNDRED)
      return { mode: 'numeric', task, exact, traps: [trap('mo_percent_part_over_part', overRest, CF_WITNESS.overOther)] }
    }
    case 'element-moles': {
      const task = elementMolesTask(check.symbol, check.grams)
      const wrongTask: SigFigTask = { kind: 'muldiv', terms: [{ text: check.grams }, { text: atomicMassText(check.symbol) }], ops: ['*'] }
      return {
        mode: 'numeric',
        task,
        exact: analyseSigFigTask(task).exactValue,
        traps: [trap('mo_molar_mass_inverted', analyseSigFigTask(wrongTask).exactValue, CF_WITNESS.molarMultiplied)],
      }
    }
    case 'empirical': {
      const solve = solveEmpirical(check.data)
      if (!solve) throw new Error('chemFormulas: these amounts give no clean empirical formula')
      const symbols = check.data.map((d) => d.symbol)
      const traps = []
      const mass = massRatioSlip(check.data)
      if (mass) traps.push({ id: 'mo_mass_ratio_as_mole_ratio' as const, counts: mass, witness: CF_WITNESS.massRatio })
      for (const counts of roundedRatioSlips(solve)) traps.push({ id: 'mo_ratio_rounded' as const, counts, witness: CF_WITNESS.ratioRounded })
      return { mode: 'counts', symbols, counts: solve.counts, traps, lowest: true }
    }
    case 'formula-mass': {
      const hundredths = countsMassHundredths(check.counts)
      const once = check.counts.reduce((sum, c) => sum + countsMassHundredths([{ symbol: c.symbol, n: 1 }]), 0n)
      const far = (a: bigint, b: bigint) => (a > b ? a - b : b - a) > 4n
      return {
        mode: 'tolerance',
        hundredths,
        full: fullMolarMass(check.counts),
        traps: check.counts.some((c) => c.n > 1) && far(once, hundredths) ? [{ id: 'mo_subscripts_ignored', hundredths: once, witness: CF_WITNESS.subscripts }] : [],
      }
    }
    case 'multiplier':
      return { mode: 'whole', value: multiplierOf(check.counts, check.molarMass) }
    case 'molecular': {
      const k = multiplierOf(check.counts, check.molarMass)
      const counts = check.counts.map((c) => ({ symbol: c.symbol, n: c.n * k }))
      const traps = [
        { id: 'mo_empirical_as_molecular' as const, counts: check.counts.map((c) => ({ ...c })), witness: CF_WITNESS.empiricalBack },
        { id: 'mo_empirical_as_molecular' as const, counts: check.counts.map((c) => ({ symbol: c.symbol, n: k })), witness: CF_WITNESS.multiplierBack },
      ]
      return { mode: 'counts', symbols: check.counts.map((c) => c.symbol), counts, traps, lowest: false }
    }
    default: {
      const never: never = check
      return never
    }
  }
}
