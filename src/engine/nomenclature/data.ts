/**
 * Data for the chemical-nomenclature core (CK-12 Chemistry - Intermediate, chapter 7 "Chemical Nomenclature").
 *
 * POLYATOMIC IONS. Source: CK-12 Chemistry - Intermediate, chapter 7, lesson "Polyatomic Ions", table "Common
 * Polyatomic Ions" (the same lesson is mirrored as LibreTexts "Introductory Chemistry (CK-12)", section 7.9,
 * Table 7.9.1; read 2026-10-18). Every row marked `inTextbook: true` is printed in that table with that formula
 * and charge, except two choices:
 *   - mercury(I), Hg2 2+, is printed there as "dimercury"; its compound name, mercury(I), is the one CK-12's
 *     Table 7.5.1 (transition metal ions) and lesson 7.10 use (Hg2Cl2 is mercury(I) chloride). Both names are
 *     accepted;
 *   - arsenate is left out: the table prints it as AsO3 3−, a misprint (arsenate is AsO4 3−, AsO3 3− is
 *     arsenite), and a student who learned the printed row would be marked wrong either way.
 * Rows marked `inTextbook: false` are not in that table; they were required by the build brief: hydronium,
 * thiocyanate, hydrogen sulfite (the sulfite partner of hydrogen sulfate), and the bromine and iodine members of
 * the chlorine family, which the lesson's own rule gives (per-…-ate one more oxygen than -ate, -ite one fewer,
 * hypo-…-ite one fewer than -ite; bromate, BrO3−, is in the table).
 *
 * MONATOMIC IONS come only from `commonCharges` in engine/chem/elements.ts (see ions.ts). The names of the
 * monatomic anions (-ide) and of the binary acids are below.
 */
import type { PolyatomicIonInfo } from './types'

const row = (name: string, formula: string, charge: number, inTextbook: boolean, otherFormulas: string[] = [], otherNames: string[] = []): PolyatomicIonInfo => ({
  name,
  formula,
  charge,
  otherFormulas,
  otherNames,
  inTextbook,
})

/** The polyatomic ions of the model: name, formula, charge (column names as in the table). */
export const POLYATOMIC_IONS: readonly PolyatomicIonInfo[] = [
  // 1− (CK-12 table, first column)
  row('acetate', 'CH3COO', -1, true, ['C2H3O2', 'CH3CO2']),
  row('bromate', 'BrO3', -1, true),
  row('chlorate', 'ClO3', -1, true),
  row('chlorite', 'ClO2', -1, true),
  row('cyanide', 'CN', -1, true),
  row('dihydrogen phosphate', 'H2PO4', -1, true),
  row('hydrogen carbonate', 'HCO3', -1, true, [], ['bicarbonate']),
  row('hydrogen sulfate', 'HSO4', -1, true, [], ['bisulfate']),
  row('hydrogen sulfide', 'HS', -1, true),
  row('hydroxide', 'OH', -1, true),
  row('hypochlorite', 'ClO', -1, true),
  row('nitrate', 'NO3', -1, true),
  row('nitrite', 'NO2', -1, true),
  row('perchlorate', 'ClO4', -1, true),
  row('permanganate', 'MnO4', -1, true),
  // 2−
  row('carbonate', 'CO3', -2, true),
  row('chromate', 'CrO4', -2, true),
  row('dichromate', 'Cr2O7', -2, true),
  row('hydrogen phosphate', 'HPO4', -2, true),
  row('oxalate', 'C2O4', -2, true),
  row('peroxide', 'O2', -2, true),
  row('silicate', 'SiO3', -2, true),
  row('sulfate', 'SO4', -2, true),
  row('sulfite', 'SO3', -2, true),
  // 3−
  row('phosphate', 'PO4', -3, true),
  row('phosphite', 'PO3', -3, true),
  // 1+ and 2+
  row('ammonium', 'NH4', 1, true),
  row('mercury(I)', 'Hg2', 2, true, [], ['dimercury', 'dimercury(I)']),
  // Not in the CK-12 table: required by the build brief (see the header).
  row('hydronium', 'H3O', 1, false),
  row('thiocyanate', 'SCN', -1, false),
  row('hydrogen sulfite', 'HSO3', -1, false, [], ['bisulfite']),
  row('perbromate', 'BrO4', -1, false),
  row('bromite', 'BrO2', -1, false),
  row('hypobromite', 'BrO', -1, false),
  row('periodate', 'IO4', -1, false),
  row('iodate', 'IO3', -1, false),
  row('iodite', 'IO2', -1, false),
  row('hypoiodite', 'IO', -1, false),
]

/** -ide names: monatomic anions and the second element of a binary molecular compound. */
export const IDE_NAMES: Readonly<Record<string, string>> = {
  H: 'hydride',
  B: 'boride',
  C: 'carbide',
  N: 'nitride',
  O: 'oxide',
  F: 'fluoride',
  Si: 'silicide',
  P: 'phosphide',
  S: 'sulfide',
  Cl: 'chloride',
  As: 'arsenide',
  Se: 'selenide',
  Br: 'bromide',
  Te: 'telluride',
  I: 'iodide',
}

/** Greek prefixes, index = count − 1 (CK-12 lesson 7.11, Table 1). */
export const GREEK_PREFIXES: readonly string[] = ['mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca']

/**
 * The nonmetals (and metalloids) of the binary molecular compounds, in the order they are WRITTEN: an element
 * comes before every element after it in this list. It is the IUPAC (1990) sequence restricted to these 15
 * elements; CK-12's own list (C, P, N, H, S, I, Br, Cl, O, F) is in the same order. So CO2, NH3, H2S, Cl2O7,
 * OF2, PCl5, B4H10.
 */
export const MOLECULAR_ELEMENTS: readonly string[] = ['B', 'Si', 'C', 'As', 'P', 'N', 'H', 'Te', 'Se', 'S', 'I', 'Br', 'Cl', 'O', 'F']

/** Molecular compounds known by a common name. The systematic name is accepted too. */
export const COMMON_NAMES: Readonly<Record<string, string>> = {
  H2O: 'water',
  NH3: 'ammonia',
  CH4: 'methane',
}

/** The anions whose acids are binary acids (hydro-…-ic acid), with the root the acid name uses. */
export const BINARY_ACID_ROOTS: Readonly<Record<string, string>> = {
  'F^-': 'fluor',
  'Cl^-': 'chlor',
  'Br^-': 'brom',
  'I^-': 'iod',
  'S^2-': 'sulfur',
  'CN^-': 'cyan',
}

/** Classical (-ous/-ic) cation names: not used by the class (Stock system); read only to say so. */
export const CLASSICAL_NAMES: Readonly<Record<string, string>> = {
  ferric: 'iron(III)',
  ferrous: 'iron(II)',
  cupric: 'copper(II)',
  cuprous: 'copper(I)',
  stannic: 'tin(IV)',
  stannous: 'tin(II)',
  plumbic: 'lead(IV)',
  plumbous: 'lead(II)',
  auric: 'gold(III)',
  aurous: 'gold(I)',
  mercuric: 'mercury(II)',
  mercurous: 'mercury(I)',
  cobaltic: 'cobalt(III)',
  cobaltous: 'cobalt(II)',
  chromic: 'chromium(III)',
  chromous: 'chromium(II)',
  manganic: 'manganese(III)',
  manganous: 'manganese(II)',
  nickelous: 'nickel(II)',
}

/**
 * Binary molecular compounds a first-year text names (CK-12 lessons 7.1 and 7.11 and their exercises, plus the
 * usual oxides and halides). Every formula here is in the model; a template can draw from this list instead of
 * from every pair the rules can name.
 */
export const COMMON_MOLECULAR_FORMULAS: readonly string[] = [
  'CO', 'CO2', 'CS2', 'CCl4', 'CF4', 'CBr4', 'CI4', 'NO', 'NO2', 'N2O', 'N2O3', 'N2O4', 'N2O5', 'NF3', 'NCl3',
  'NI3', 'N2H4', 'PCl3', 'PCl5', 'PF5', 'PBr3', 'PI3', 'P2O5', 'P4O10', 'P4O6', 'P2S5', 'SO2', 'SO3', 'SF4',
  'SF6', 'SCl2', 'S2Cl2', 'SiO2', 'SiCl4', 'SiF4', 'SiC', 'BF3', 'BCl3', 'BN', 'B2O3', 'B4H10', 'B2H6', 'ClF',
  'ClF3', 'ClF5', 'BrF3', 'BrF5', 'IF5', 'IF7', 'ICl', 'ICl3', 'IBr', 'Cl2O', 'ClO2', 'Cl2O7', 'OF2', 'As2O3',
  'As2O5', 'AsCl3', 'AsH3', 'SeO2', 'SeF6', 'TeO2', 'H2O', 'NH3', 'CH4', 'SiH4', 'PH3',
]

/** Hydrates a first-year text uses (formula app text, waters after the dot). */
export const COMMON_HYDRATES: readonly string[] = [
  'CuSO4·5H2O', 'Na2CO3·10H2O', 'MgSO4·7H2O', 'CaCl2·2H2O', 'BaCl2·2H2O', 'CoCl2·6H2O', 'Na2SO4·10H2O',
  'CaSO4·2H2O', 'FeSO4·7H2O', 'ZnSO4·7H2O', 'NiCl2·6H2O', 'Ba(OH)2·8H2O', 'CuCl2·2H2O', 'FeCl3·6H2O',
  'Mg(NO3)2·6H2O', 'LiCl·H2O', 'Sr(OH)2·8H2O', 'CoCl2·2H2O',
]
