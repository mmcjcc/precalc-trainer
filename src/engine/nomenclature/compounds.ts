/**
 * The compound model: building compounds from ions, their canonical names and formulas, every accepted way of
 * writing them, and the lists the property tests and templates draw from.
 *
 * Rules (CK-12 ch. 7):
 *  - ionic: cation first, then anion; the lowest whole-number ratio that balances the charges; parentheses only
 *    around a polyatomic ion with a subscript above 1; no prefixes; a Roman numeral for a metal with more than
 *    one charge (ions.ts). Hg₂²⁺ and O₂²⁻ are single ions: Hg2Cl2 and K2O2 are not reduced.
 *  - binary molecular: the element written first (MOLECULAR_ELEMENTS order) is named first with a Greek prefix
 *    (never mono-); the second takes a prefix (mono- included) and -ide; the a/o of a prefix is dropped before
 *    oxide in printed names; formulas are never reduced (S2Cl2). H2O, NH3 and CH4 are water, ammonia, methane
 *    (the systematic names are accepted too).
 *  - hydrogen with F, Cl, Br, I, S or CN is a molecular compound named without prefixes (hydrogen chloride)
 *    unless it is in water: then it is a binary acid, hydro-…-ic acid (HCl(aq) hydrochloric acid).
 *  - oxyacids (H with an -ate or -ite ion) are acids with or without (aq): -ate → -ic, -ite → -ous, with the
 *    roots sulfur- and phosphor- (sulfuric, phosphorous).
 *  - hydrates: the salt's name and a Greek prefix + hydrate (copper(II) sulfate pentahydrate; 1 is mono-).
 */
import { BINARY_ACID_ROOTS, COMMON_NAMES, IDE_NAMES, MOLECULAR_ELEMENTS } from './data'
import {
  compoundCations,
  elementNameOf,
  isBinaryAcidAnion,
  isOxyacidAnion,
  nmAnions,
  takesPeroxideOrHydride,
} from './ions'
import { nameKey } from './names'
import { gcd, prefixed } from './text'
import type {
  AcidCompound,
  Compound,
  CompoundClass,
  HydrateCompound,
  HydrogenCompound,
  IonicCompound,
  MolecularCompound,
  NmIon,
} from './types'

// --- building ----------------------------------------------------------------------------------------

/** The lowest whole-number counts that balance a cation's and an anion's charges: (3, -2) → [2, 3]. */
export function balancedCounts(cationCharge: number, anionCharge: number): [number, number] {
  const g = gcd(cationCharge, anionCharge)
  return [Math.abs(anionCharge) / g, cationCharge / g]
}

/** Why a cation and an anion do not make a compound of the model, or null when they do. */
export function ionPairProblem(cation: NmIon, anion: NmIon): string | null {
  if (cation.role !== 'cation') return `${cation.name} is not a cation.`
  if (anion.role !== 'anion') return `${anion.name} is not an anion.`
  if (cation.formula === 'H3O') return 'Hydronium compounds are not part of the model: hydronium is asked about as an ion only.'
  if ((anion.formula === 'O2' || anion.formula === 'H') && !takesPeroxideOrHydride(cation))
    return `The model pairs ${anion.name} only with the metals of groups 1 and 2 (like ${anion.formula === 'O2' ? 'K₂O₂ and BaO₂' : 'NaH and CaH₂'}).`
  return null
}

/** The ionic compound of a cation and an anion. Throws RangeError for a pair outside the model. */
export function ionicCompound(cation: NmIon, anion: NmIon): IonicCompound {
  const problem = ionPairProblem(cation, anion)
  if (problem) throw new RangeError(problem)
  const [cationCount, anionCount] = balancedCounts(cation.charge, anion.charge)
  return { kind: 'ionic', cation, cationCount, anion, anionCount }
}

/** Why two elements and counts are not a binary molecular compound of the model, or null. */
export function molecularProblem(first: string, firstCount: number, second: string, secondCount: number): string | null {
  const a = MOLECULAR_ELEMENTS.indexOf(first)
  const b = MOLECULAR_ELEMENTS.indexOf(second)
  if (a < 0 || b < 0) return `Binary molecular compounds in the model are made of two of these elements: ${MOLECULAR_ELEMENTS.join(', ')}.`
  if (a === b) return 'A binary compound has two different elements.'
  if (a > b) return `${second} is written before ${first} in a formula.`
  for (const n of [firstCount, secondCount]) if (!Number.isInteger(n) || n < 1 || n > 10) return 'The prefixes go from mono- (1) to deca- (10).'
  if (first === 'H' && !(second === 'O' && firstCount === 2 && secondCount === 1))
    return 'Hydrogen written first with a halogen or sulfur is an acid or a hydrogen compound (HCl); other hydrogen-first compounds are outside the model.'
  return null
}

export function molecularCompound(first: string, firstCount: number, second: string, secondCount: number): MolecularCompound {
  const problem = molecularProblem(first, firstCount, second, secondCount)
  if (problem) throw new RangeError(problem)
  return { kind: 'molecular', first, firstCount, second, secondCount }
}

/** H with an anion: an acid (in water, or any oxyacid) or, for a binary-acid anion not in water, a hydrogen compound. */
export function hydrogenCompoundOf(anion: NmIon, inWater: boolean): AcidCompound | HydrogenCompound | null {
  const hydrogenCount = -anion.charge
  if (isOxyacidAnion(anion)) return { kind: 'acid', anion, hydrogenCount, binary: false }
  if (isBinaryAcidAnion(anion)) return inWater ? { kind: 'acid', anion, hydrogenCount, binary: true } : { kind: 'hydrogen', anion, hydrogenCount }
  return null
}

export function hydrateCompound(salt: IonicCompound, waters: number): HydrateCompound {
  if (!Number.isInteger(waters) || waters < 1 || waters > 10) throw new RangeError('A hydrate in the model has 1 to 10 water molecules (mono- to deca-).')
  return { kind: 'hydrate', salt, waters }
}

// --- formulas ----------------------------------------------------------------------------------------

/** One ion written n times: 'Fe2', '(SO4)3', 'NH4', 'Cl'. */
export function unitText(formula: string, polyatomic: boolean, n: number): string {
  if (n === 1) return formula
  return polyatomic ? `(${formula})${n}` : `${formula}${n}`
}

function ionicText(c: IonicCompound, anionFormula = c.anion.formula): string {
  return unitText(c.cation.formula, c.cation.kind === 'polyatomic', c.cationCount) + unitText(anionFormula, c.anion.kind === 'polyatomic', c.anionCount)
}

const hText = (n: number) => `H${n === 1 ? '' : n}`

/** The canonical formula, app text: 'Fe2(SO4)3', 'N2O5', 'HCl(aq)', 'H2SO4', 'CH3COOH', 'HCl', 'CuSO4·5H2O'. */
export function compoundFormula(c: Compound): string {
  switch (c.kind) {
    case 'ionic':
      return ionicText(c)
    case 'molecular':
      return `${c.first}${c.firstCount === 1 ? '' : c.firstCount}${c.second}${c.secondCount === 1 ? '' : c.secondCount}`
    case 'hydrogen':
      return `${hText(c.hydrogenCount)}${c.anion.formula}`
    case 'acid':
      if (c.anion.formula === 'CH3COO') return 'CH3COOH'
      return `${hText(c.hydrogenCount)}${c.anion.formula}${c.binary ? '(aq)' : ''}`
    case 'hydrate':
      return `${ionicText(c.salt)}·${c.waters === 1 ? '' : c.waters}H2O`
  }
}

/** Every formula text that is right for the compound (no state; acids: with and without (aq) is the caller's call). */
export function acceptedFormulas(c: Compound): string[] {
  switch (c.kind) {
    case 'ionic':
      return [c.anion.formula, ...c.anion.otherFormulas].map((f) => ionicText(c, f))
    case 'hydrate':
      return [c.salt.anion.formula, ...c.salt.anion.otherFormulas].map((f) => `${ionicText(c.salt, f)}·${c.waters === 1 ? '' : c.waters}H2O`)
    case 'acid': {
      const forms = [c.anion.formula, ...c.anion.otherFormulas].map((f) => `${hText(c.hydrogenCount)}${f}`)
      if (c.anion.formula === 'CH3COO') forms.push('CH3COOH', 'CH3CO2H')
      return forms
    }
    default:
      return [compoundFormula(c)]
  }
}

// --- names -------------------------------------------------------------------------------------------

/** -ate → -ic acid, -ite → -ous acid, with the roots sulfur- and phosphor-: 'sulfate' → 'sulfuric acid'. */
export function oxyacidName(anionName: string): string {
  const ending = anionName.endsWith('ate') ? 'ic' : 'ous'
  let root = anionName.slice(0, -3)
  if (root.endsWith('sulf')) root += 'ur'
  if (root.endsWith('phosph')) root += 'or'
  return `${root}${ending} acid`
}

/** hydro-…-ic acid for a binary-acid anion: Cl⁻ → 'hydrochloric acid', CN⁻ → 'hydrocyanic acid'. */
export function binaryAcidName(anion: NmIon): string {
  const root = BINARY_ACID_ROOTS[anion.text]
  if (!root) throw new RangeError(`${anion.name} does not form a binary acid.`)
  return `hydro${root}ic acid`
}

function molecularName(c: MolecularCompound): string {
  return `${prefixed(c.firstCount, elementNameOf(c.first), true)} ${prefixed(c.secondCount, IDE_NAMES[c.second]!)}`
}

/** The canonical name, as the textbook prints it: 'iron(III) sulfate', 'dinitrogen pentoxide', 'water'. */
export function compoundName(c: Compound): string {
  switch (c.kind) {
    case 'ionic':
      return `${c.cation.name} ${c.anion.name}`
    case 'molecular':
      return COMMON_NAMES[compoundFormula(c)] ?? molecularName(c)
    case 'hydrogen':
      return `hydrogen ${c.anion.name}`
    case 'acid':
      return c.binary ? binaryAcidName(c.anion) : oxyacidName(c.anion.name)
    case 'hydrate':
      return `${compoundName(c.salt)} ${prefixed(c.waters, 'hydrate')}`
  }
}

/** The systematic name of a molecular compound that has a common one ('dihydrogen monoxide' for water), or null. */
export function systematicName(c: Compound): string | null {
  return c.kind === 'molecular' && COMMON_NAMES[compoundFormula(c)] ? molecularName(c) : null
}

function ionicKeys(c: IonicCompound): string[] {
  const out = new Set<string>()
  for (const cn of [c.cation.name, ...c.cation.otherNames]) for (const an of [c.anion.name, ...c.anion.otherNames]) out.add(nameKey(`${cn} ${an}`))
  return [...out]
}

/** Every right name, as keys (names.ts nameKey): spellings, aliases and the accepted alternatives. */
export function acceptedNameKeys(c: Compound): string[] {
  switch (c.kind) {
    case 'ionic':
      return ionicKeys(c)
    case 'molecular': {
      const sys = systematicName(c)
      return sys ? [nameKey(compoundName(c)), nameKey(sys)] : [nameKey(compoundName(c))]
    }
    case 'hydrogen': {
      // Hydrogen compounds are named without prefixes; the strict prefix forms are accepted too.
      const out = new Set<string>()
      const hs = c.hydrogenCount === 1 ? ['hydrogen'] : ['hydrogen', prefixed(c.hydrogenCount, 'hydrogen')]
      const as = c.anion.kind === 'monatomic' ? [c.anion.name, prefixed(1, c.anion.name)] : [c.anion.name]
      for (const h of hs) for (const a of as) out.add(nameKey(`${h} ${a}`))
      return [...out]
    }
    case 'acid':
      return [nameKey(compoundName(c))]
    case 'hydrate':
      return ionicKeys(c.salt).map((k) => `${k} ${nameKey(prefixed(c.waters, 'hydrate'))}`)
  }
}

/** The class a compound belongs to: hydrogen compounds (HCl not in water) are molecular. */
export function compoundClass(c: Compound): CompoundClass {
  return c.kind === 'hydrogen' ? 'molecular' : c.kind
}

// --- lists -------------------------------------------------------------------------------------------

/** Every ionic compound the ion tables give: each compound cation with each anion (pairs outside the model left out). */
export function ionicCompounds(): IonicCompound[] {
  const out: IonicCompound[] = []
  const anions = nmAnions()
  for (const cat of compoundCations()) for (const an of anions) if (!ionPairProblem(cat, an)) out.push(ionicCompound(cat, an))
  return out
}

/** Every acid of the model: the six binary acids (in water) and one oxyacid per -ate/-ite ion. */
export function acidCompounds(): AcidCompound[] {
  return nmAnions()
    .map((a) => hydrogenCompoundOf(a, true))
    .filter((c): c is AcidCompound => c !== null && c.kind === 'acid')
}

/** HF, HCl, HBr, HI, H2S and HCN not in water (molecular hydrogen compounds). */
export function hydrogenCompounds(): HydrogenCompound[] {
  return nmAnions()
    .map((a) => hydrogenCompoundOf(a, false))
    .filter((c): c is HydrogenCompound => c !== null && c.kind === 'hydrogen')
}

/** Every pair of elements a binary molecular compound can be made of, in the written order (hydrogen-first pairs left out). */
export function molecularPairs(): [string, string][] {
  const out: [string, string][] = []
  MOLECULAR_ELEMENTS.forEach((a, i) => {
    if (a === 'H') return
    for (const b of MOLECULAR_ELEMENTS.slice(i + 1)) out.push([a, b])
  })
  return out
}

/** Every binary molecular compound the rules name: each pair with counts 1 to 10, plus water. */
export function molecularCompounds(): MolecularCompound[] {
  const out: MolecularCompound[] = []
  for (const [a, b] of molecularPairs()) for (let m = 1; m <= 10; m++) for (let n = 1; n <= 10; n++) out.push(molecularCompound(a, m, b, n))
  out.push(molecularCompound('H', 2, 'O', 1))
  return out
}
