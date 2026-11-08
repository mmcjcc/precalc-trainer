/**
 * Chapter 9 facts: the fixed table of small molecules the templates may draw, and the arithmetic
 * of shared pairs, shapes and electronegativity differences. Valence counts come from the element
 * table's groups (the same reading ionicBonding uses) and electronegativities from
 * `engine/chem/trends` (READ-ONLY; Allred's revision of the Pauling scale) — nothing here retypes
 * either. A list test pins every row of every table against an independent hand check.
 *
 * Exclusions (docs/progress/chem-covalent.md):
 *  - Octet breakers (BF3, BeCl2, SF6, PCl5, NO, O3, benzene...) are not in the table at all.
 *  - PH3, SiH4 and HBr are reserved: no template draws them, so rule cards and catalog examples
 *    can work them without ever showing an answer.
 *  - H2S, PH3, NCl3 and Cl2O sit under the 0.4 bond cutoff, so the chapter's own rule calls them
 *    nonpolar while finer data gives them small dipoles; they stay out of the polarity and force
 *    draws rather than be taught either way.
 */
import { trendByZ } from '@/engine/chem/trends'
import { elementBySymbol, type ElementInfo } from '@/engine/chem/elements'
import { answerLeaks, capName, ibValence } from '@/content/modules/ionicBonding/facts'
import type { CbBand, CbShape } from '@/content/types'

export { answerLeaks, capName }

// ---------------------------------------------------------------------------
// The molecule table
// ---------------------------------------------------------------------------

export interface CbMolecule {
  /** App text: 'H2O'. Display via `formulaDisplay`. */
  formula: string
  name: string
  /** Symbol of the central atom, or null for a two-atom molecule. */
  central: string | null
  /** Atoms around the central atom — or, for a diatomic, the one or two kinds of atom in it. */
  atoms: readonly { symbol: string; count: number }[]
  /** Order of the (named) bond. Every bond of these molecules has the same order. */
  bondOrder: 1 | 2 | 3
  /** Lone pairs on the central atom; null for a diatomic. */
  lonePairsCentral: number | null
}

/** 25 molecules she will actually meet; every row pinned by hand in the list test. */
export const MOLECULES: readonly CbMolecule[] = [
  // two-atom molecules
  { formula: 'H2', name: 'hydrogen', central: null, atoms: [{ symbol: 'H', count: 2 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'N2', name: 'nitrogen', central: null, atoms: [{ symbol: 'N', count: 2 }], bondOrder: 3, lonePairsCentral: null },
  { formula: 'O2', name: 'oxygen', central: null, atoms: [{ symbol: 'O', count: 2 }], bondOrder: 2, lonePairsCentral: null },
  { formula: 'F2', name: 'fluorine', central: null, atoms: [{ symbol: 'F', count: 2 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'Cl2', name: 'chlorine', central: null, atoms: [{ symbol: 'Cl', count: 2 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'Br2', name: 'bromine', central: null, atoms: [{ symbol: 'Br', count: 2 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'I2', name: 'iodine', central: null, atoms: [{ symbol: 'I', count: 2 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'HF', name: 'hydrogen fluoride', central: null, atoms: [{ symbol: 'H', count: 1 }, { symbol: 'F', count: 1 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'HCl', name: 'hydrogen chloride', central: null, atoms: [{ symbol: 'H', count: 1 }, { symbol: 'Cl', count: 1 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'HBr', name: 'hydrogen bromide', central: null, atoms: [{ symbol: 'H', count: 1 }, { symbol: 'Br', count: 1 }], bondOrder: 1, lonePairsCentral: null },
  { formula: 'CO', name: 'carbon monoxide', central: null, atoms: [{ symbol: 'C', count: 1 }, { symbol: 'O', count: 1 }], bondOrder: 3, lonePairsCentral: null },
  // linear, 180°
  { formula: 'CO2', name: 'carbon dioxide', central: 'C', atoms: [{ symbol: 'O', count: 2 }], bondOrder: 2, lonePairsCentral: 0 },
  { formula: 'CS2', name: 'carbon disulfide', central: 'C', atoms: [{ symbol: 'S', count: 2 }], bondOrder: 2, lonePairsCentral: 0 },
  // bent, 104.5°
  { formula: 'H2O', name: 'water', central: 'O', atoms: [{ symbol: 'H', count: 2 }], bondOrder: 1, lonePairsCentral: 2 },
  { formula: 'H2S', name: 'hydrogen sulfide', central: 'S', atoms: [{ symbol: 'H', count: 2 }], bondOrder: 1, lonePairsCentral: 2 },
  { formula: 'OF2', name: 'oxygen difluoride', central: 'O', atoms: [{ symbol: 'F', count: 2 }], bondOrder: 1, lonePairsCentral: 2 },
  { formula: 'Cl2O', name: 'dichlorine monoxide', central: 'O', atoms: [{ symbol: 'Cl', count: 2 }], bondOrder: 1, lonePairsCentral: 2 },
  // trigonal pyramidal, 107°
  { formula: 'NH3', name: 'ammonia', central: 'N', atoms: [{ symbol: 'H', count: 3 }], bondOrder: 1, lonePairsCentral: 1 },
  { formula: 'PH3', name: 'phosphine', central: 'P', atoms: [{ symbol: 'H', count: 3 }], bondOrder: 1, lonePairsCentral: 1 },
  { formula: 'PCl3', name: 'phosphorus trichloride', central: 'P', atoms: [{ symbol: 'Cl', count: 3 }], bondOrder: 1, lonePairsCentral: 1 },
  { formula: 'NCl3', name: 'nitrogen trichloride', central: 'N', atoms: [{ symbol: 'Cl', count: 3 }], bondOrder: 1, lonePairsCentral: 1 },
  // tetrahedral, 109.5°
  { formula: 'CH4', name: 'methane', central: 'C', atoms: [{ symbol: 'H', count: 4 }], bondOrder: 1, lonePairsCentral: 0 },
  { formula: 'SiH4', name: 'silane', central: 'Si', atoms: [{ symbol: 'H', count: 4 }], bondOrder: 1, lonePairsCentral: 0 },
  { formula: 'CCl4', name: 'carbon tetrachloride', central: 'C', atoms: [{ symbol: 'Cl', count: 4 }], bondOrder: 1, lonePairsCentral: 0 },
  { formula: 'SiCl4', name: 'silicon tetrachloride', central: 'Si', atoms: [{ symbol: 'Cl', count: 4 }], bondOrder: 1, lonePairsCentral: 0 },
]

/** Kept out of every chapter 9 draw so rule cards and catalog examples can work them. */
export const CB_RESERVED_FORMULAS: readonly string[] = ['PH3', 'SiH4', 'HBr']

const BY_FORMULA = new Map<string, CbMolecule>(MOLECULES.map((m) => [m.formula, m]))

export function moleculeOf(formula: string): CbMolecule {
  const m = BY_FORMULA.get(formula)
  if (!m) throw new Error(`covalentBonding: no molecule ${formula}`)
  return m
}

export function cbElement(symbol: string): ElementInfo {
  const el = elementBySymbol(symbol)
  if (!el) throw new Error(`covalentBonding: unknown element ${symbol}`)
  return el
}

/** Valence electrons of one atom, from its group (H is one, He two — the ionicBonding reading). */
export function atomValence(symbol: string): number {
  const v = ibValence(cbElement(symbol))
  if (v == null) throw new Error(`covalentBonding: no valence count for ${symbol}`)
  return v
}

/** Total valence electrons in the molecule: every atom's group share added up. */
export function totalValence(m: CbMolecule): number {
  const outer = m.atoms.reduce((sum, a) => sum + a.count * atomValence(a.symbol), 0)
  return m.central ? outer + atomValence(m.central) : outer
}

/** Atoms bonded to the central atom (a diatomic has one bond, no central atom). */
export function bondedAtoms(m: CbMolecule): number {
  if (!m.central) throw new Error(`covalentBonding: ${m.formula} has no central atom`)
  return m.atoms.reduce((sum, a) => sum + a.count, 0)
}

/** Shared (bonding) pairs in the whole molecule. */
export function sharedPairs(m: CbMolecule): number {
  return m.central ? bondedAtoms(m) * m.bondOrder : m.bondOrder
}

/** Lone pairs an outer (or diatomic) atom keeps: hydrogen none, every other atom fills to eight. */
export function atomLonePairs(symbol: string, bondOrder: number): number {
  if (symbol === 'H') return 0
  return (8 - 2 * bondOrder) / 2
}

/** Unshared (lone) pairs in the whole molecule. */
export function unsharedPairs(m: CbMolecule): number {
  const outer = m.atoms.reduce((sum, a) => sum + a.count * atomLonePairs(a.symbol, m.bondOrder), 0)
  return m.central ? (m.lonePairsCentral ?? 0) + outer : outer
}

/** Electrons shown around one atom of the finished structure: its shared pairs (both electrons) plus its own. */
export function dotsAround(m: CbMolecule, symbol: string): number {
  if (m.central && symbol === m.central) {
    return 2 * m.bondOrder * bondedAtoms(m) + 2 * (m.lonePairsCentral ?? 0)
  }
  if (!m.atoms.some((a) => a.symbol === symbol) && symbol !== m.central) {
    throw new Error(`covalentBonding: no ${symbol} in ${m.formula}`)
  }
  return 2 * m.bondOrder + 2 * atomLonePairs(symbol, m.bondOrder)
}

// ---------------------------------------------------------------------------
// Shapes (VSEPR)
// ---------------------------------------------------------------------------

export const SHAPE_NAMES: readonly CbShape[] = ['Linear', 'Trigonal planar', 'Tetrahedral', 'Trigonal pyramidal', 'Bent']

/** The five possible typed angles, pinned; a surface that shows all five singles out none. */
export const ANGLE_TEXTS: readonly string[] = ['180', '120', '109.5', '107', '104.5']

/** Shape from atoms bonded to the center and lone pairs on it (the chapter's five cases only). */
export function shapeOf(bonded: number, lone: number): CbShape {
  if (lone === 0 && bonded === 2) return 'Linear'
  if (lone === 0 && bonded === 3) return 'Trigonal planar'
  if (lone === 0 && bonded === 4) return 'Tetrahedral'
  if (lone === 1 && bonded === 3) return 'Trigonal pyramidal'
  if (lone === 2 && bonded === 2) return 'Bent'
  throw new Error(`covalentBonding: no chapter 9 shape for ${bonded} atoms + ${lone} lone pairs`)
}

/** Approximate bond angle of that shape, as she types it. */
export function angleOf(bonded: number, lone: number): string {
  switch (shapeOf(bonded, lone)) {
    case 'Linear':
      return '180'
    case 'Trigonal planar':
      return '120'
    case 'Tetrahedral':
      return '109.5'
    case 'Trigonal pyramidal':
      return '107'
    case 'Bent':
      return '104.5'
  }
}

/** The shape of the molecule's own central-atom counts. */
export function moleculeShape(m: CbMolecule): CbShape {
  if (!m.central) throw new Error(`covalentBonding: ${m.formula} has no shape question`)
  return shapeOf(bondedAtoms(m), m.lonePairsCentral ?? 0)
}

// ---------------------------------------------------------------------------
// Electronegativity
// ---------------------------------------------------------------------------

/** Allred's Pauling-scale value from the trend table (READ-ONLY source). */
export function enOf(symbol: string): number {
  const trend = trendByZ(cbElement(symbol).z)
  if (!trend) throw new Error(`covalentBonding: no electronegativity for ${symbol}`)
  return trend.electronegativity
}

/** |EN(a) − EN(b)| to the hundredth. */
export function enDiff(a: string, b: string): number {
  return Math.round(Math.abs(enOf(a) - enOf(b)) * 100) / 100
}

/** '0.96' — the difference as she types it. */
export function enDiffText(a: string, b: string): string {
  return enDiff(a, b).toFixed(2)
}

/** The cutoffs the rule card states. No drawn pair sits exactly on either. */
export const NONPOLAR_BELOW = 0.4
export const IONIC_ABOVE = 1.7

export function bandOf(diff: number): CbBand {
  if (diff < NONPOLAR_BELOW) return 'Nonpolar covalent'
  if (diff > IONIC_ABOVE) return 'Ionic'
  return 'Polar covalent'
}

/**
 * Element pairs for the difference-and-band parts. Fixed by hand so no pair sits on a cutoff and
 * no pair spells a reserved molecule (H–Br, P–H, Si–H stay out for the catalog's use). The list
 * test restates every pair's difference and band independently.
 */
export const EN_PAIRS: readonly [string, string][] = [
  // below 0.4 — even sharing
  ['C', 'H'],
  ['N', 'Cl'],
  ['C', 'S'],
  ['C', 'I'],
  ['O', 'Cl'],
  ['Br', 'Cl'],
  ['I', 'Br'],
  // 0.4 to 1.7 — lopsided sharing
  ['H', 'Cl'],
  ['H', 'O'],
  ['H', 'N'],
  ['C', 'O'],
  ['C', 'Cl'],
  ['C', 'F'],
  ['Si', 'Cl'],
  ['P', 'Cl'],
  ['S', 'O'],
  ['H', 'I'],
  ['O', 'F'],
  ['Si', 'O'],
  // above 1.7 — a hand-over
  ['Na', 'Cl'],
  ['K', 'Cl'],
  ['Li', 'F'],
  ['Na', 'F'],
  ['Mg', 'O'],
  ['Ca', 'Cl'],
  ['Li', 'Cl'],
  ['K', 'Br'],
  ['Ca', 'F'],
  ['Mg', 'Cl'],
  ['Na', 'Br'],
  ['K', 'O'],
]

// ---------------------------------------------------------------------------
// Polarity and forces
// ---------------------------------------------------------------------------

/** The largest electronegativity difference across one bond of the molecule. */
export function bondDiff(m: CbMolecule): number {
  if (m.central) {
    const outer = m.atoms[0]!
    return enDiff(m.central, outer.symbol)
  }
  if (m.atoms.length === 1) return 0
  return enDiff(m.atoms[0]!.symbol, m.atoms[1]!.symbol)
}

/** Is each bond polar by the chapter's own cutoff? */
export function bondsPolar(m: CbMolecule): boolean {
  return bondDiff(m) >= NONPOLAR_BELOW
}

/**
 * Is the MOLECULE polar? The taught rule exactly: polar bonds PLUS a shape that does not cancel
 * them. Every central molecule of the table has identical outer atoms, so its shape cancels
 * unless lone pairs bend it; a two-atom molecule has nothing to cancel with.
 */
export function moleculePolar(m: CbMolecule): boolean {
  if (!bondsPolar(m)) return false
  if (!m.central) return true
  return (m.lonePairsCentral ?? 0) > 0
}

/** H bonded straight to N, O or F — the only hydrogen-bonding molecules of the table. */
export function hasHydrogenBonding(m: CbMolecule): boolean {
  const NOF = ['N', 'O', 'F']
  if (m.central) return m.atoms.some((a) => a.symbol === 'H') && NOF.includes(m.central)
  if (!m.atoms.some((a) => a.symbol === 'H')) return false
  const partner = m.atoms.length === 1 ? m.atoms[0]!.symbol : m.atoms.find((a) => a.symbol !== 'H')!.symbol
  return NOF.includes(partner)
}

export function containsH(m: CbMolecule): boolean {
  return m.atoms.some((a) => a.symbol === 'H') || m.central === 'H'
}

export type CbForce = 'dispersion' | 'dipole' | 'hbond'

/** The strongest force between molecules of a pure sample, by the chapter's own rules. */
export function forceOf(m: CbMolecule): CbForce {
  if (hasHydrogenBonding(m)) return 'hbond'
  if (moleculePolar(m)) return 'dipole'
  return 'dispersion'
}

// ---------------------------------------------------------------------------
// Draw pools (reserved molecules never appear; the list test pins each pool)
// ---------------------------------------------------------------------------

function drawable(m: CbMolecule): boolean {
  return !CB_RESERVED_FORMULAS.includes(m.formula)
}

/** Every drawable molecule (the electrons and dots templates use all of them). */
export const DRAW_POOL: readonly CbMolecule[] = MOLECULES.filter(drawable)

/** Two-atom molecules with one shared pair. */
export const SINGLE_DIATOMICS: readonly CbMolecule[] = DRAW_POOL.filter((m) => !m.central && m.bondOrder === 1)

/** Two-atom molecules with a double or triple bond. */
export const MULTI_DIATOMICS: readonly CbMolecule[] = DRAW_POOL.filter((m) => !m.central && m.bondOrder > 1)

/** Molecules with a central atom (the shape template's molecule draws). */
export const CENTRAL_POOL: readonly CbMolecule[] = DRAW_POOL.filter((m) => m.central !== null)

/**
 * Near-cutoff molecules: their bond differences sit under 0.4, so the taught rule calls them
 * nonpolar while finer data gives them small dipoles. They stay out of the polarity and force
 * draws (they still appear in the electrons, dots and shape templates).
 */
export const POLARITY_EXCLUDED: readonly string[] = ['H2S', 'NCl3', 'Cl2O']

/** Polar molecules the polarity template may ask about. */
export const POLAR_MOLECULES: readonly CbMolecule[] = DRAW_POOL.filter((m) => moleculePolar(m) && !POLARITY_EXCLUDED.includes(m.formula))

/** The catch molecules: symmetric shapes whose bonds (mostly) pull, 25–45 % of the molecule part. */
export const CATCH_FORMULAS: readonly string[] = ['CO2', 'CS2', 'CCl4']

/** Nonpolar molecules outside the catch trio. */
export const NONPOLAR_MOLECULES: readonly CbMolecule[] = DRAW_POOL.filter(
  (m) => !moleculePolar(m) && !POLARITY_EXCLUDED.includes(m.formula) && !CATCH_FORMULAS.includes(m.formula),
)

/** Samples for the force question, by their force. */
export const FORCE_POOLS: Readonly<Record<CbForce, readonly CbMolecule[]>> = {
  hbond: DRAW_POOL.filter((m) => forceOf(m) === 'hbond'),
  dipole: DRAW_POOL.filter((m) => forceOf(m) === 'dipole' && !POLARITY_EXCLUDED.includes(m.formula)),
  dispersion: DRAW_POOL.filter((m) => forceOf(m) === 'dispersion' && !POLARITY_EXCLUDED.includes(m.formula)),
}

/** Chapter 8 contrast compounds for the shared-or-transferred part. Never an answer here. */
export const CONTRAST_SALTS: readonly { name: string; formula: string }[] = [
  { name: 'sodium chloride', formula: 'NaCl' },
  { name: 'potassium bromide', formula: 'KBr' },
  { name: 'calcium oxide', formula: 'CaO' },
  { name: 'magnesium chloride', formula: 'MgCl2' },
  { name: 'lithium fluoride', formula: 'LiF' },
]

export interface BoilPair {
  kind: 'hbond' | 'dipole' | 'size'
  /** Formulas from the table; `higher` is the one that boils higher. */
  a: string
  b: string
  higher: string
}

/** Comparison pairs that differ in exactly the force being tested. */
export const BOIL_PAIRS: readonly BoilPair[] = [
  { kind: 'hbond', a: 'H2O', b: 'H2S', higher: 'H2O' },
  { kind: 'hbond', a: 'HF', b: 'HCl', higher: 'HF' },
  { kind: 'dipole', a: 'N2', b: 'CO', higher: 'CO' },
  { kind: 'size', a: 'F2', b: 'Cl2', higher: 'Cl2' },
  { kind: 'size', a: 'F2', b: 'Br2', higher: 'Br2' },
  { kind: 'size', a: 'F2', b: 'I2', higher: 'I2' },
  { kind: 'size', a: 'Cl2', b: 'Br2', higher: 'Br2' },
  { kind: 'size', a: 'Cl2', b: 'I2', higher: 'I2' },
  { kind: 'size', a: 'Br2', b: 'I2', higher: 'I2' },
]

/** 'no', 'one', 'two' … for the dot-structure descriptions, so a prompt never types an answer. */
export function pairWord(n: number): string {
  const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
  return words[n] ?? String(n)
}
