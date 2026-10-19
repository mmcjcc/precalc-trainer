/**
 * Public types of the chemical-nomenclature core (CK-12 Chemistry - Intermediate, chapter 7). Every named
 * mistake is an ErrorPatternId with the prefix nm_ (registered in @/shared/types, worded in
 * matchers/catalog.ts), so a grade's `pattern` is a PatternHit the flows can record as it is.
 */
import type { ErrorPatternId, ParseError, PatternHit } from '@/shared/types'

/** Every nm_ id of the shared catalog (all of them are mistakes). */
export type NmMistakeId = Extract<ErrorPatternId, `nm_${string}`>

export const NM_MISTAKE_IDS: readonly NmMistakeId[] = [
  // Writing an ionic formula
  'nm_charges_unbalanced',
  'nm_not_lowest_ratio',
  'nm_parentheses_missing',
  'nm_crisscross_reversed',
  'nm_numeral_as_subscript',
  'nm_unit_ion_reduced',
  'nm_polyatomic_formula_wrong',
  'nm_anion_first',
  // Naming an ionic compound (and single ions)
  'nm_prefix_on_ionic',
  'nm_numeral_missing',
  'nm_numeral_wrong',
  'nm_numeral_on_fixed',
  'nm_ide_for_polyatomic',
  'nm_ate_ite_swapped',
  'nm_per_hypo_wrong',
  'nm_element_name_for_anion',
  'nm_hydrogen_prefix_wrong',
  // Binary molecular compounds
  'nm_prefix_missing',
  'nm_mono_on_first',
  'nm_molecular_reduced',
  'nm_stock_on_molecular',
  // Acids
  'nm_hydro_on_oxyacid',
  'nm_hydro_missing',
  'nm_ic_ous_swapped',
  'nm_acid_root',
  'nm_acid_named_as_salt',
  'nm_acid_anion_ending',
  // Hydrates
  'nm_hydrate_count_wrong',
  // Single ions
  'nm_ion_charge_wrong',
  // Classifying
  'nm_class_ammonium_molecular',
  'nm_class_hydrate_ignored',
  'nm_class_acid_ignored',
]

// ---------------------------------------------------------------------------
// Ions
// ---------------------------------------------------------------------------

/** One row of the polyatomic-ion table (data.ts). */
export interface PolyatomicIonInfo {
  /** The name, lower case, as a compound name uses it: 'sulfate', 'hydrogen carbonate', 'mercury(I)'. */
  name: string
  /** The formula without its charge, app text: 'SO4', 'HCO3', 'CH3COO', 'Hg2'. */
  formula: string
  /** Signed charge: -2 for sulfate, 1 for ammonium. */
  charge: number
  /** Other formulas read as this ion: acetate 'C2H3O2'. */
  otherFormulas: readonly string[]
  /** Other names accepted for this ion: 'bicarbonate'. */
  otherNames: readonly string[]
  /** True when the row is printed in CK-12's "Common Polyatomic Ions" table (see the data.ts header). */
  inTextbook: boolean
}

/** An ion of the model: a monatomic ion from elements.ts commonCharges, or a row of the polyatomic table. */
export interface NmIon {
  /** App text with the charge, unique per ion: 'Fe^3+', 'SO4^2-', 'Cl^-', 'NH4^+', 'Hg2^2+'. */
  text: string
  /** The formula without the charge, app text: 'Fe', 'SO4', 'NH4', 'Hg2', 'CH3COO'. */
  formula: string
  /** Other formulas read as this ion ('C2H3O2' for acetate). */
  otherFormulas: readonly string[]
  /** Signed charge. */
  charge: number
  role: 'cation' | 'anion'
  kind: 'monatomic' | 'polyatomic'
  /** The name a compound name uses: 'iron(III)', 'sodium', 'sulfate', 'chloride', 'mercury(I)'. */
  name: string
  /** Other accepted names: 'bicarbonate'; 'nickel' for nickel(II); 'dimercury' for mercury(I). */
  otherNames: readonly string[]
  /** Element symbol of a monatomic ion; null for a polyatomic ion. */
  symbol: string | null
  /** The metal's name without the numeral ('iron' for iron(III), 'mercury' for mercury(I)); null otherwise. */
  metalName: string | null
  /** The Roman numeral's value when the name carries one (3 for iron(III), 1 for mercury(I)); else null. */
  numeral: number | null
  /** True for nickel: the textbook writes nickel(II), and nickel alone is accepted (one taught charge). */
  numeralOptional: boolean
  /** Printed in CK-12's chapter 7 tables (monatomic ions: always true). */
  inTextbook: boolean
}

/** An ion as templates give it: an NmIon, its app text ('Fe3+', 'SO4 2-', 'SO4^2-', 'Fe³⁺') or its name ('sulfate', 'iron(III)'). */
export type IonLike = NmIon | string

// ---------------------------------------------------------------------------
// Compounds
// ---------------------------------------------------------------------------

/** The four kinds of compound the course names (the answer to a classify question). */
export type CompoundClass = 'ionic' | 'molecular' | 'acid' | 'hydrate'

export const COMPOUND_CLASSES: readonly CompoundClass[] = ['ionic', 'molecular', 'acid', 'hydrate']

/** A cation and an anion in the lowest whole-number ratio that balances their charges. */
export interface IonicCompound {
  kind: 'ionic'
  cation: NmIon
  cationCount: number
  anion: NmIon
  anionCount: number
}

/** Two nonmetals named with Greek prefixes: N2O5 is { first: 'N', firstCount: 2, second: 'O', secondCount: 5 }. */
export interface MolecularCompound {
  kind: 'molecular'
  first: string
  firstCount: number
  second: string
  secondCount: number
}

/** Hydrogen with a halogen, sulfur or cyanide, NOT in water: HCl is hydrogen chloride (a molecular compound). */
export interface HydrogenCompound {
  kind: 'hydrogen'
  anion: NmIon
  hydrogenCount: number
}

/** H⁺ ions with an anion, in water: HCl(aq) hydrochloric acid, H2SO4 sulfuric acid. */
export interface AcidCompound {
  kind: 'acid'
  anion: NmIon
  hydrogenCount: number
  /** True for a binary acid (hydro-…-ic: the anion's name ends in -ide); false for an oxyacid. */
  binary: boolean
}

/** An ionic compound with water in its crystals: CuSO4·5H2O. */
export interface HydrateCompound {
  kind: 'hydrate'
  salt: IonicCompound
  waters: number
}

export type Compound = IonicCompound | MolecularCompound | HydrogenCompound | AcidCompound | HydrateCompound

/** Options for a problem given as a formula. */
export interface FormulaProblemOptions {
  /**
   * The problem says the compound is dissolved in water (or calls it an acid). A hydrogen compound such as
   * HCl is then named as an acid even without (aq). Oxyacids (H2SO4, HNO3 …) are acids either way.
   */
  inWater?: boolean
}

// ---------------------------------------------------------------------------
// What she types
// ---------------------------------------------------------------------------

/** A parse problem with where it is in her text and why. */
export interface NmParseError extends ParseError {
  /** 'unreadable': not a formula/name; 'case': a capital-letter problem; 'not_in_form': readable, but not written the textbook way. */
  reason: 'unreadable' | 'case' | 'not_in_form'
}

export interface FormulaElementPart {
  type: 'element'
  symbol: string
  count: number
  position: number
  length: number
}

export interface FormulaGroupPart {
  type: 'group'
  parts: FormulaPart[]
  count: number
  position: number
  length: number
}

/** One unit of a formula as she wrote it: an element symbol with its subscript, or a parenthesized group. */
export type FormulaPart = FormulaElementPart | FormulaGroupPart

export interface FormulaReading {
  /** The formula (before any ·nH2O), in her order, her parentheses kept. */
  parts: FormulaPart[]
  /** n of ·nH2O; null when there is no water part. */
  waters: number | null
  /** A state written after the formula: (aq), (s), (l), (g). */
  state: 'aq' | 's' | 'l' | 'g' | null
  /** App text of what she wrote, tidied (ASCII digits, '·' for the dot, no spaces): 'Ca(NO3)2', 'CuSO4·5H2O', 'HCl(aq)'. */
  text: string
}

export type FormulaParse = { ok: true; value: FormulaReading } | { ok: false; error: NmParseError }

/** An ion formula as she wrote it: the formula part and the charge (null when she wrote none). */
export interface IonReading {
  parts: FormulaPart[]
  charge: number | null
  /** App text: 'SO4^2-', 'Fe^3+', 'NO3' (no charge written). */
  text: string
}

/**
 * Readings of an ion formula. A charge typed straight after a subscript is ambiguous ('SO42-': SO4 with 2−,
 * or SO42 with 1−; 'Fe3+': Fe with 3+, or Fe3 with 1+), so both readings are returned; the graders pick the
 * one that is an ion of the model.
 */
export type IonParse = { ok: true; value: IonReading[] } | { ok: false; error: NmParseError }

/** A name as she typed it, normalized for comparison (see names.ts). */
export interface NameReading {
  /** Lower case, single spaces, accepted spellings unified: 'iron(iii) sulfate', 'dinitrogen pentoxide'. */
  key: string
  /** The words of the key. */
  words: string[]
}

export type NameParse = { ok: true; value: NameReading } | { ok: false; error: NmParseError }

// ---------------------------------------------------------------------------
// Grades and candidates
// ---------------------------------------------------------------------------

/**
 * A grader's verdict (the shape of the econfig and logs cores):
 *  - correct:     right; `message` is a short confirmation.
 *  - mistake:     wrong, and exactly what the named slip produces for this problem; `witness` is a sentence
 *                 about HER answer (it does not print the finished answer); `pattern` is the catalog entry.
 *  - wrong:       wrong, no named slip fits; `message` is a plain, specific sentence (never the answer).
 *  - invalid:     not an attempt: show `message` and do not count it. `reason` 'unreadable' (cannot be read),
 *                 'case' (capital letters: CO is not Co), 'not_in_form' (a name where a formula was asked,
 *                 an Arabic numeral for the charge, a classical name, a subscript of 1 …). `position` and
 *                 `length` point into her text when there is a place to point at.
 *  - unsupported: the PROBLEM is outside the model (a template bug, never her fault).
 */
export type NmGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'mistake'; mistake: NmMistakeId; pattern: PatternHit; witness: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; reason: 'unreadable' | 'case' | 'not_in_form'; message: string; position?: number; length?: number }
  | { verdict: 'unsupported'; message: string }

/** What one slip produces for a problem. `shadows`: later slips that produce the same text. */
export interface NmMistakeCandidate {
  id: NmMistakeId
  /** The wrong answer as she would type it (app text: a name, a formula, an ion, or a class). */
  text: string
  /** The sentence the grader returns for it. */
  witness: string
  shadows: NmMistakeId[]
}

/** The worked solution of a problem (it REVEALS the answer: last hint rung, or after the problem is done). */
export interface NmExplanation {
  /** The steps, display text with Unicode subscripts and charges (Fe₂(SO₄)₃, Fe³⁺, SO₄²⁻). */
  steps: string[]
  /** The answer, display text: 'Fe₂(SO₄)₃', 'iron(III) sulfate', 'ionic'. */
  answer: string
  /** The formula the problem is about, LaTeX for KaTeX: '\mathrm{Fe_2(SO_4)_3}'. */
  formulaLatex: string
}
