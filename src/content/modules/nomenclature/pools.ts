/**
 * What chapter 7 draws its problems from: ions and compounds of the engine's nomenclature model, weighted toward
 * what CK-12 Chemistry - Intermediate chapter 7 uses (the common metals, the polyatomic ions of the textbook's
 * table, the common molecular compounds and acids, real hydrates). A template draws the ions, the compound and
 * the direction from the seed; nothing here is a list of problems. The tests check every entry against the
 * engine (`nomenclatureProblem`, `ionicPairProblem`).
 *
 * RESERVED, never asked:
 *  - the compounds the shared catalog prints in its wrong → right examples (NaCl, MgO, Ca(NO₃)₂, Al₂O₃, FeCl₃,
 *    Hg₂Cl₂, KNO₃ …), so a catalog example never shows an answer a template can generate;
 *  - the ions this module's own rule cards and examples use: rubidium, cesium, beryllium and gold compounds,
 *    bromate and silicate as ions, ammonium iodide; and the radioactive metals.
 */
import {
  acidCompounds,
  compoundFormula,
  ionicCompound,
  ionPairProblem,
  nmIon,
  COMMON_MOLECULAR_FORMULAS,
  type AcidCompound,
  type IonicCompound,
  type NmIon,
} from '@/engine'
import type { Rng } from '@/content/rng'

export interface Weighted<T> {
  item: T
  weight: number
}

/** Draw one item, each with probability proportional to its weight. */
export function pickWeighted<T>(rng: Rng, list: readonly Weighted<T>[]): T {
  if (list.length === 0) throw new Error('pickWeighted: empty list')
  const total = list.reduce((sum, w) => sum + w.weight, 0)
  let r = rng.next() * total
  for (const w of list) {
    r -= w.weight
    if (r < 0) return w.item
  }
  return list[list.length - 1]!.item
}

// --- ions ----------------------------------------------------------------------------------------------

/** Cations, as the engine writes them, with how often CK-12's chapter uses them (3 often, 1 now and then). */
const CATION_WEIGHTS: Readonly<Record<string, number>> = {
  'Li^+': 2,
  'Na^+': 3,
  'K^+': 3,
  'Mg^2+': 3,
  'Ca^2+': 3,
  'Sr^2+': 1,
  'Ba^2+': 2,
  'Al^3+': 3,
  'Zn^2+': 2,
  'Ag^+': 2,
  'NH4^+': 3,
  'Fe^2+': 3,
  'Fe^3+': 3,
  'Cu^+': 2,
  'Cu^2+': 3,
  'Pb^2+': 2,
  'Pb^4+': 2,
  'Sn^2+': 2,
  'Sn^4+': 2,
  'Co^2+': 2,
  'Co^3+': 1,
  'Cr^2+': 1,
  'Cr^3+': 2,
  'Mn^2+': 1,
  'Mn^3+': 1,
  'Hg2^2+': 1,
  'Hg^2+': 2,
  'Ni^2+': 2,
}

/** Anions: the monatomic ions of the periodic table and the textbook's polyatomic ions. */
const ANION_WEIGHTS: Readonly<Record<string, number>> = {
  'F^-': 2,
  'Cl^-': 3,
  'Br^-': 2,
  'I^-': 2,
  'O^2-': 3,
  'S^2-': 2,
  'N^3-': 2,
  'P^3-': 1,
  'H^-': 1,
  'OH^-': 3,
  'NO3^-': 3,
  'NO2^-': 2,
  'SO4^2-': 3,
  'SO3^2-': 2,
  'PO4^3-': 3,
  'PO3^3-': 1,
  'CO3^2-': 3,
  'HCO3^-': 2,
  'CH3COO^-': 2,
  'ClO3^-': 2,
  'ClO4^-': 2,
  'ClO2^-': 1,
  'ClO^-': 1,
  'CN^-': 2,
  'MnO4^-': 2,
  'CrO4^2-': 1,
  'Cr2O7^2-': 1,
  'HSO4^-': 1,
  'H2PO4^-': 1,
  'HPO4^2-': 1,
  'C2O4^2-': 1,
  'O2^2-': 1,
  'HS^-': 1,
}

function ionsOf(weights: Readonly<Record<string, number>>): Weighted<NmIon>[] {
  return Object.entries(weights).map(([text, weight]) => ({ item: nmIon(text), weight }))
}

let CATIONS: Weighted<NmIon>[] | null = null
let ANIONS: Weighted<NmIon>[] | null = null

/** The cations the templates use, weighted. */
export function poolCations(): Weighted<NmIon>[] {
  CATIONS ??= ionsOf(CATION_WEIGHTS)
  return CATIONS
}

/** The anions the templates use, weighted. */
export function poolAnions(): Weighted<NmIon>[] {
  ANIONS ??= ionsOf(ANION_WEIGHTS)
  return ANIONS
}

/** Every ion a single-ion question can ask about (cations and anions), weighted. */
export function poolIons(): Weighted<NmIon>[] {
  return [...poolCations(), ...poolAnions()]
}

/** A metal whose name needs a Roman numeral (nickel's is optional, so it is not one of these). */
export function needsNumeral(ion: NmIon): boolean {
  return ion.numeral !== null && !ion.numeralOptional
}

// --- ionic compounds -----------------------------------------------------------------------------------

/** Compounds the shared catalog prints in its examples (formula app text). Never asked, either way. */
export const CATALOG_EXAMPLE_COMPOUNDS: readonly string[] = [
  'NaCl',
  'MgO',
  'Ca(NO3)2',
  'Al2O3',
  'FeCl3',
  'Hg2Cl2',
  'KNO3',
  'KNO2',
  'KCl',
  'CaCl2',
  'CuO',
  'SnO',
  'SnO2',
  'KF',
  'NaNO3',
  'NaNO2',
  'KClO3',
  'KClO4',
  'KBr',
  'KH2PO4',
  'K2HPO4',
]

/** Ammonium with these anions is a compound nobody names in this chapter (no such salt, or not a salt). */
const NO_AMMONIUM: ReadonlySet<string> = new Set(['O^2-', 'N^3-', 'P^3-', 'PO3^3-', 'HS^-'])

/** Reserved for this module's own examples (rule cards and the example lines shown in place of a catalog one). */
const RESERVED_FORMULAS: ReadonlySet<string> = new Set([...CATALOG_EXAMPLE_COMPOUNDS, 'NH4I'])

function ionicAllowed(cat: NmIon, an: NmIon): boolean {
  if (ionPairProblem(cat, an)) return false
  // Hydride is asked about as an ion; its compounds (LiH, CaH₂) are not chapter 7's.
  if (an.text === 'H^-') return false
  if (cat.formula === 'NH4' && NO_AMMONIUM.has(an.text)) return false
  return !RESERVED_FORMULAS.has(compoundFormula(ionicCompound(cat, an)))
}

export interface PoolCompound {
  compound: IonicCompound
  weight: number
}

let IONIC: PoolCompound[] | null = null

/** Every ionic compound the templates can ask about: a pool cation with a pool anion, weighted by both. */
export function poolIonicCompounds(): PoolCompound[] {
  if (IONIC) return IONIC
  const out: PoolCompound[] = []
  for (const c of poolCations())
    for (const a of poolAnions()) if (ionicAllowed(c.item, a.item)) out.push({ compound: ionicCompound(c.item, a.item), weight: c.weight * a.weight })
  IONIC = out
  return out
}

/** The pool's anions that a pool cation forms a compound with, weighted. */
export function anionsFor(cation: NmIon, filter: (anion: NmIon) => boolean = () => true): Weighted<NmIon>[] {
  return poolAnions().filter((a) => filter(a.item) && ionicAllowed(cation, a.item))
}

// --- molecular compounds -------------------------------------------------------------------------------

/**
 * Binary molecular compounds from the engine's list of real ones, without the hydrides (named by common names:
 * water, ammonia, methane, phosphine …), SiC and BN (known as silicon carbide and boron nitride, not by the
 * strict prefixes), and the catalog's own examples.
 */
const MOLECULAR_LEFT_OUT: ReadonlySet<string> = new Set(['H2O', 'NH3', 'CH4', 'SiH4', 'PH3', 'AsH3', 'B2H6', 'B4H10', 'N2H4', 'SiC', 'BN', 'As2O5', 'S2Cl2'])

/** Molecular compounds the catalog's examples name (asked only as a formula from the name). */
export const MOLECULAR_NAME_RESERVED: ReadonlySet<string> = new Set(['NO', 'Cl2O7'])

const MOLECULAR_COMMON: ReadonlySet<string> = new Set([
  'CO',
  'CO2',
  'NO',
  'NO2',
  'N2O',
  'N2O3',
  'N2O4',
  'N2O5',
  'SO2',
  'SO3',
  'PCl3',
  'PCl5',
  'CCl4',
  'SF6',
  'CS2',
  'P4O10',
  'P2O5',
  'NF3',
  'SiO2',
  'BF3',
  'OF2',
  'ICl',
])

export function poolMolecular(): Weighted<string>[] {
  return COMMON_MOLECULAR_FORMULAS.filter((f) => !MOLECULAR_LEFT_OUT.has(f)).map((f) => ({ item: f, weight: MOLECULAR_COMMON.has(f) ? 3 : 1 }))
}

// --- acids ---------------------------------------------------------------------------------------------

/** How often each acid comes up (by the anion's name); acids not listed are not asked. */
const ACID_WEIGHTS: Readonly<Record<string, number>> = {
  fluoride: 3,
  chloride: 3,
  bromide: 3,
  iodide: 3,
  sulfide: 3,
  cyanide: 2,
  nitrate: 3,
  nitrite: 3,
  sulfate: 3,
  sulfite: 3,
  phosphate: 3,
  phosphite: 2,
  carbonate: 3,
  acetate: 3,
  perchlorate: 3,
  chlorate: 3,
  chlorite: 3,
  hypochlorite: 3,
  chromate: 2,
  dichromate: 1,
  oxalate: 2,
  permanganate: 1,
  bromate: 2,
  perbromate: 1,
  bromite: 1,
  hypobromite: 1,
  periodate: 1,
  iodate: 1,
  iodite: 1,
  hypoiodite: 1,
}

/** Acids named only as a formula from the name: phosphorous acid is this module's example for the sulfur-/phosphor- root. */
export const ACID_NAME_RESERVED: ReadonlySet<string> = new Set(['H3PO3'])

export function poolAcids(): Weighted<AcidCompound>[] {
  return acidCompounds()
    .filter((a) => ACID_WEIGHTS[a.anion.name] !== undefined)
    .map((a) => ({ item: a, weight: ACID_WEIGHTS[a.anion.name]! }))
}

/** How the acid's formula is printed for naming: binary acids with (aq); acetic acid as CK-12 writes it. */
export function printedAcidFormula(a: AcidCompound): string {
  if (a.anion.formula === 'CH3COO') return 'HC2H3O2'
  return compoundFormula(a)
}

// --- hydrates ------------------------------------------------------------------------------------------

/**
 * Real hydrates a first-year course names: the engine's COMMON_HYDRATES (weight 3, or 2 for the less common ones),
 * then other real hydrates (weight 1). Na₂CO₃·10H₂O is left out: it is the catalog's example.
 */
const HYDRATE_WEIGHTS: Readonly<Record<string, number>> = {
  'CuSO4·5H2O': 3,
  'MgSO4·7H2O': 3,
  'BaCl2·2H2O': 3,
  'CoCl2·6H2O': 3,
  'Na2SO4·10H2O': 3,
  'CaSO4·2H2O': 3,
  'FeSO4·7H2O': 3,
  'ZnSO4·7H2O': 3,
  'NiCl2·6H2O': 3,
  'Ba(OH)2·8H2O': 3,
  'CuCl2·2H2O': 3,
  'FeCl3·6H2O': 3,
  'Mg(NO3)2·6H2O': 3,
  'LiCl·H2O': 2,
  'Sr(OH)2·8H2O': 2,
  'CoCl2·2H2O': 2,
  'CaCl2·2H2O': 3,
  'MgCl2·6H2O': 2,
  'SrCl2·6H2O': 1,
  'NiSO4·6H2O': 1,
  'CoSO4·7H2O': 1,
  'MnSO4·H2O': 1,
  'MnCl2·4H2O': 1,
  'CrCl3·6H2O': 1,
  'AlCl3·6H2O': 1,
  'FeCl2·4H2O': 1,
  'SnCl2·2H2O': 1,
  'SnCl4·5H2O': 1,
  'Co(NO3)2·6H2O': 1,
  'Ni(NO3)2·6H2O': 1,
  'Cu(NO3)2·3H2O': 1,
  'Zn(NO3)2·6H2O': 1,
  'Ca(NO3)2·4H2O': 1,
  'Sr(NO3)2·4H2O': 1,
  'Al(NO3)3·9H2O': 1,
  'Fe(NO3)3·9H2O': 1,
  'Cr(NO3)3·9H2O': 1,
  'LiNO3·3H2O': 1,
  'Hg2(NO3)2·2H2O': 1,
  'NaC2H3O2·3H2O': 1,
  'Pb(C2H3O2)2·3H2O': 1,
  'Cu(C2H3O2)2·H2O': 1,
  'Zn(C2H3O2)2·2H2O': 1,
  'Mg(C2H3O2)2·4H2O': 1,
  'Na2HPO4·7H2O': 1,
  'NaH2PO4·H2O': 1,
  'Na2SO3·7H2O': 1,
  'Na2CrO4·4H2O': 1,
  'K2C2O4·H2O': 1,
  'FeC2O4·2H2O': 1,
  'Na2CO3·H2O': 1,
  'MgSO4·H2O': 1,
  'LiOH·H2O': 1,
  'NaBr·2H2O': 1,
  'NaI·2H2O': 1,
  'MgBr2·6H2O': 1,
  'BaBr2·2H2O': 1,
  'Na2S·9H2O': 1,
  'Mg(ClO4)2·6H2O': 1,
  'Cu(ClO4)2·6H2O': 1,
  '(NH4)2C2O4·H2O': 1,
}

export function poolHydrates(): Weighted<string>[] {
  return Object.entries(HYDRATE_WEIGHTS).map(([item, weight]) => ({ item, weight }))
}

// --- classify ------------------------------------------------------------------------------------------

/** Ammonium salts a classify question uses (the no-metal trap), by anion. NH₄I is this module's example. */
const CLASSIFY_AMMONIUM: readonly string[] = ['Cl^-', 'Br^-', 'F^-', 'NO3^-', 'NO2^-', 'SO4^2-', 'SO3^2-', 'PO4^3-', 'CO3^2-', 'HCO3^-', 'CH3COO^-', 'CN^-', 'ClO4^-', 'Cr2O7^2-', 'CrO4^2-', 'C2O4^2-', 'S^2-', 'OH^-', 'H2PO4^-', 'HPO4^2-']

function classifyAmmonium(): Weighted<string>[] {
  const nh4 = nmIon('NH4^+')
  return CLASSIFY_AMMONIUM.map((text) => ({ item: compoundFormula(ionicCompound(nh4, nmIon(text))), weight: ANION_WEIGHTS[text] ?? 1 }))
}

/** The five groups a classify question draws from: the three traps the engine names, and the two plain kinds. */
export type ClassifyGroup = 'ammonium' | 'hydrate' | 'acid' | 'ionic' | 'molecular'

export interface ClassifyItem {
  /** The formula as printed: binary acids with (aq), so no formula is two kinds at once. */
  formula: string
  group: ClassifyGroup
}

let CLASSIFY: Weighted<ClassifyItem>[] | null = null

/** Every formula a classify question can print, weighted within its group. */
export function classifyPool(): Weighted<ClassifyItem>[] {
  if (CLASSIFY) return CLASSIFY
  const out: Weighted<ClassifyItem>[] = []
  for (const w of classifyAmmonium()) out.push({ item: { formula: w.item, group: 'ammonium' }, weight: w.weight })
  for (const w of poolHydrates()) out.push({ item: { formula: w.item, group: 'hydrate' }, weight: w.weight })
  for (const w of poolAcids()) out.push({ item: { formula: printedAcidFormula(w.item), group: 'acid' }, weight: w.weight })
  for (const p of poolIonicCompounds()) if (p.compound.cation.formula !== 'NH4') out.push({ item: { formula: compoundFormula(p.compound), group: 'ionic' }, weight: p.weight })
  for (const w of poolMolecular()) out.push({ item: { formula: w.item, group: 'molecular' }, weight: w.weight })
  CLASSIFY = out
  return out
}
