/**
 * Chemical nomenclature (chemistry, CK-12 Chemistry - Intermediate ch. 7): ions, ionic compounds, binary
 * molecular compounds, acids and hydrates, from formula to name and back, with named mistakes (nm_ ids).
 * Public API; re-exported from `@/engine`. The API document is docs/progress/nomenclature-core.md.
 */
import { compoundClass, compoundFormula, compoundName, ionicCompound, ionPairProblem } from './compounds'
import { ionByFormula, nmIon, resolveIon } from './ions'
import { readCompoundFormula, readCompoundName } from './read'
import { romanNumeral } from './text'
import type { CompoundClass, FormulaProblemOptions, IonLike } from './types'

export type {
  AcidCompound,
  Compound,
  CompoundClass,
  FormulaElementPart,
  FormulaGroupPart,
  FormulaParse,
  FormulaPart,
  FormulaProblemOptions,
  FormulaReading,
  HydrateCompound,
  HydrogenCompound,
  IonicCompound,
  IonLike,
  IonParse,
  IonReading,
  MolecularCompound,
  NameParse,
  NameReading,
  NmExplanation,
  NmGrade,
  NmIon,
  NmMistakeCandidate,
  NmMistakeId,
  NmParseError,
  PolyatomicIonInfo,
} from './types'
export { COMPOUND_CLASSES, NM_MISTAKE_IDS } from './types'

// Data
export { COMMON_HYDRATES, COMMON_MOLECULAR_FORMULAS, COMMON_NAMES, GREEK_PREFIXES, IDE_NAMES, MOLECULAR_ELEMENTS, POLYATOMIC_IONS } from './data'

// Ions
export {
  compoundCations as ionicCations,
  ionByFormula,
  ionByName,
  ionDisplay,
  ionLatex,
  nmAnions,
  nmCations,
  nmIon,
  nmIons,
  NUMERAL_METALS,
  OPTIONAL_NUMERAL_METALS,
  resolveIon,
} from './ions'

// Readers and text
export { readFormula as readChemicalFormula, readIon as readIonFormula } from './formula'
export { nameKey as chemicalNameKey, readName as readChemicalName } from './names'
export { formulaDisplay, formulaLatex, greekPrefix, romanNumeral, romanValue } from './text'

// Compounds
export {
  acceptedFormulas,
  acceptedNameKeys,
  acidCompounds,
  balancedCounts,
  binaryAcidName,
  compoundClass,
  compoundFormula,
  compoundName,
  hydrateCompound,
  hydrogenCompounds,
  ionicCompound,
  ionicCompounds,
  ionPairProblem,
  molecularCompound,
  molecularCompounds,
  molecularPairs,
  molecularProblem,
  oxyacidName,
  systematicName,
} from './compounds'
export { compoundOfFormula, compoundOfName, readCompoundFormula, readCompoundName } from './read'

// Graders and what each slip produces
export {
  classifyMistakes,
  formulaFromNameMistakes,
  gradeClassify,
  gradeFormulaFromName,
  gradeIonFormula,
  gradeIonicFormula,
  gradeIonName,
  gradeNameFromFormula,
  ionFormulaMistakes,
  ionicFormulaMistakes,
  ionNameMistakes,
  nameFromFormulaMistakes,
} from './grade'

// Worked solutions
export { explainClassify, explainFormulaFromName, explainIon, explainIonicFormula, explainNameFromFormula } from './explain'

/** The questions the core grades; the validator takes one to say whether a problem suits it. */
export type NmQuestion = 'name' | 'formula' | 'classify' | 'ion_name' | 'ion_formula'

/**
 * The validator for the content stage: why this problem does not suit this question, or null when it does.
 *   nomenclatureProblem('Fe2(SO4)3', 'name')       → null
 *   nomenclatureProblem('iron(III) sulfate', 'formula') → null
 *   nomenclatureProblem('MnO2', 'name')            → 'MnO₂ would need Mn⁴⁺, and the taught charges of manganese are 2+ and 3+.'
 *   nomenclatureProblem('V2O5', 'name')            → 'Vanadium has no ion taught in this course, so V₂O₅ is outside the model.'
 *   nomenclatureProblem('SO4 2-', 'ion_name')      → null
 * 'name' and 'classify' take a formula, 'formula' a name, 'ion_name' an ion's formula, 'ion_formula' an ion's
 * name (or formula). Call it on every generated problem.
 */
export function nomenclatureProblem(problem: string, question: NmQuestion, options: FormulaProblemOptions = {}): string | null {
  switch (question) {
    case 'name':
    case 'classify': {
      const r = readCompoundFormula(problem, options)
      return r.ok ? null : r.message
    }
    case 'formula': {
      const r = readCompoundName(problem)
      return r.ok ? null : r.message
    }
    case 'ion_name':
      return ionByFormula(problem) ? null : `${problem} is not the formula of an ion in the model (write it with its charge, like SO4^2-).`
    case 'ion_formula':
      return resolveIon(problem) ? null : `${problem} is not an ion of the model.`
  }
}

/** Why two ions do not make a compound of the model, or null (either may be text: 'Fe3+', 'sulfate'). */
export function ionicPairProblem(cation: IonLike, anion: IonLike): string | null {
  const cat = resolveIon(cation)
  const an = resolveIon(anion)
  if (!cat) return `${typeof cation === 'string' ? cation : cation.text} is not an ion of the model.`
  if (!an) return `${typeof anion === 'string' ? anion : anion.text} is not an ion of the model.`
  return ionPairProblem(cat, an)
}

/** The canonical name of a formula: nameOfFormula('FeCl3') → 'iron(III) chloride'. Throws RangeError outside the model. */
export function nameOfFormula(formula: string, options: FormulaProblemOptions = {}): string {
  const r = readCompoundFormula(formula, options)
  if (!r.ok) throw new RangeError(r.message)
  return compoundName(r.compound)
}

/** The canonical formula of a name (app text): formulaOfName('iron(III) sulfate') → 'Fe2(SO4)3'. Throws RangeError. */
export function formulaOfName(name: string): string {
  const r = readCompoundName(name)
  if (!r.ok) throw new RangeError(r.message)
  return compoundFormula(r.compound)
}

/** The formula of the compound of two ions: ionicFormula('Fe3+', 'SO4 2-') → 'Fe2(SO4)3'. Throws RangeError. */
export function ionicFormula(cation: IonLike, anion: IonLike): string {
  return compoundFormula(ionicCompound(nmIon(cation), nmIon(anion)))
}

/** The class of a formula: 'ionic' | 'molecular' | 'acid' | 'hydrate'. Throws RangeError outside the model. */
export function classOfFormula(formula: string, options: FormulaProblemOptions = {}): CompoundClass {
  const r = readCompoundFormula(formula, options)
  if (!r.ok) throw new RangeError(r.message)
  return compoundClass(r.compound)
}

/**
 * The charge of the cation in an ionic formula (or a hydrate), from charge balance: FeCl3 → 3, Cu2O → 1,
 * PbO2 → 4, Hg2Cl2 → 2 (the whole Hg₂²⁺ ion). Throws RangeError for a formula that is not ionic.
 */
export function cationChargeOf(formula: string): number {
  const r = readCompoundFormula(formula)
  if (!r.ok) throw new RangeError(r.message)
  const c = r.compound.kind === 'hydrate' ? r.compound.salt : r.compound
  if (c.kind !== 'ionic') throw new RangeError(`${formula} is not an ionic compound.`)
  return c.cation.charge
}

/**
 * The Roman numeral the name of an ionic formula carries, from charge balance: FeCl3 → 'III', Fe2O3 → 'III',
 * FeO → 'II', Cu2O → 'I', PbO2 → 'IV', Hg2Cl2 → 'I', NiCl2 → 'II'; null for a cation that takes none (NaCl).
 * Throws RangeError for a formula that is not ionic.
 */
export function romanNumeralOf(formula: string): string | null {
  const r = readCompoundFormula(formula)
  if (!r.ok) throw new RangeError(r.message)
  const c = r.compound.kind === 'hydrate' ? r.compound.salt : r.compound
  if (c.kind !== 'ionic') throw new RangeError(`${formula} is not an ionic compound.`)
  return c.cation.numeral === null ? null : romanNumeral(c.cation.numeral)
}
