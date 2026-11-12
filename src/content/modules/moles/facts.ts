/**
 * The chapter 10 substance table and the arithmetic every part shares. Each substance stores its
 * formula as DATA (symbols and counts, parenthesised groups, hydrate waters separate); its text,
 * its display with Unicode subscripts, its counts and every molar mass are derived. Atomic masses
 * are never typed: each is engine/chem/elements.ts atomicWeight rounded to the hundredths place
 * (the rule her class uses), and all arithmetic is exact (BigInt rationals from the sig-fig engine).
 */
import { elementBySymbol } from '@/engine/chem/elements'
import { formulaDisplay, parseSigFigNumeral } from '@/engine'
import { decToPlain, rat, ratAdd, ratEq, ratFromDec, ratMul, roundRatToPlace, type Rat } from '@/engine/sigfigs/decimal'
import { sigFigDec } from '@/engine/sigfigs/parse'
import type { MoCount } from '@/content/types'

export { answerLeaks, capName } from '@/content/modules/ionicBonding/facts'

export type MoKind = 'element' | 'diatomic' | 'molecular' | 'ionic' | 'hydrate'
export type MoState = 'gas' | 'liquid' | 'solid'

/** One piece of a formula: an element with its subscript, or a parenthesised group with its own. */
export type FormulaPiece = { symbol: string; n: number } | { group: { symbol: string; n: number }[]; n: number }

export interface MoSubstance {
  /** ASCII formula, the table key: 'CuSO4·5H2O', '(NH4)2SO4'. Derived text must equal it (tested). */
  key: string
  name: string
  pieces: FormulaPiece[]
  /** Waters of hydration after the dot; 0 for everything else. */
  waters: number
  kind: MoKind
  /** State at 0 °C and 1 atm. */
  state: MoState
}

const el = (symbol: string, n = 1): FormulaPiece => ({ symbol, n })
const grp = (n: number, ...inner: [string, number][]): FormulaPiece => ({ group: inner.map(([symbol, k]) => ({ symbol, n: k })), n })

function row(key: string, name: string, kind: MoKind, state: MoState, pieces: FormulaPiece[], waters = 0): MoSubstance {
  return { key, name, kind, state, pieces, waters }
}

/** Forty substances she meets in chapter 10. */
export const SUBSTANCES: readonly MoSubstance[] = [
  // elements counted in atoms
  row('C', 'carbon', 'element', 'solid', [el('C')]),
  row('Fe', 'iron', 'element', 'solid', [el('Fe')]),
  row('Al', 'aluminum', 'element', 'solid', [el('Al')]),
  row('Mg', 'magnesium', 'element', 'solid', [el('Mg')]),
  row('He', 'helium', 'element', 'gas', [el('He')]),
  // the diatomic elements
  row('H2', 'hydrogen', 'diatomic', 'gas', [el('H', 2)]),
  row('N2', 'nitrogen', 'diatomic', 'gas', [el('N', 2)]),
  row('O2', 'oxygen', 'diatomic', 'gas', [el('O', 2)]),
  row('F2', 'fluorine', 'diatomic', 'gas', [el('F', 2)]),
  row('Cl2', 'chlorine', 'diatomic', 'gas', [el('Cl', 2)]),
  row('Br2', 'bromine', 'diatomic', 'liquid', [el('Br', 2)]),
  row('I2', 'iodine', 'diatomic', 'solid', [el('I', 2)]),
  // molecular compounds
  row('H2O', 'water', 'molecular', 'liquid', [el('H', 2), el('O')]),
  row('CO2', 'carbon dioxide', 'molecular', 'gas', [el('C'), el('O', 2)]),
  row('CO', 'carbon monoxide', 'molecular', 'gas', [el('C'), el('O')]),
  row('NH3', 'ammonia', 'molecular', 'gas', [el('N'), el('H', 3)]),
  row('CH4', 'methane', 'molecular', 'gas', [el('C'), el('H', 4)]),
  row('C2H6', 'ethane', 'molecular', 'gas', [el('C', 2), el('H', 6)]),
  row('C3H8', 'propane', 'molecular', 'gas', [el('C', 3), el('H', 8)]),
  row('C6H12O6', 'glucose', 'molecular', 'solid', [el('C', 6), el('H', 12), el('O', 6)]),
  row('C12H22O11', 'sucrose', 'molecular', 'solid', [el('C', 12), el('H', 22), el('O', 11)]),
  row('H2O2', 'hydrogen peroxide', 'molecular', 'liquid', [el('H', 2), el('O', 2)]),
  row('SO2', 'sulfur dioxide', 'molecular', 'gas', [el('S'), el('O', 2)]),
  row('C6H6', 'benzene', 'molecular', 'solid', [el('C', 6), el('H', 6)]),
  row('C10H8', 'naphthalene', 'molecular', 'solid', [el('C', 10), el('H', 8)]),
  row('C8H18', 'octane', 'molecular', 'liquid', [el('C', 8), el('H', 18)]),
  // ionic compounds, counted in formula units
  row('NaCl', 'sodium chloride', 'ionic', 'solid', [el('Na'), el('Cl')]),
  row('CaCO3', 'calcium carbonate', 'ionic', 'solid', [el('Ca'), el('C'), el('O', 3)]),
  row('MgO', 'magnesium oxide', 'ionic', 'solid', [el('Mg'), el('O')]),
  row('Al2O3', 'aluminum oxide', 'ionic', 'solid', [el('Al', 2), el('O', 3)]),
  row('Ca(OH)2', 'calcium hydroxide', 'ionic', 'solid', [el('Ca'), grp(2, ['O', 1], ['H', 1])]),
  row('(NH4)2SO4', 'ammonium sulfate', 'ionic', 'solid', [grp(2, ['N', 1], ['H', 4]), el('S'), el('O', 4)]),
  row('Fe2O3', 'iron(III) oxide', 'ionic', 'solid', [el('Fe', 2), el('O', 3)]),
  row('KNO3', 'potassium nitrate', 'ionic', 'solid', [el('K'), el('N'), el('O', 3)]),
  row('Na2CO3', 'sodium carbonate', 'ionic', 'solid', [el('Na', 2), el('C'), el('O', 3)]),
  row('Mg3(PO4)2', 'magnesium phosphate', 'ionic', 'solid', [el('Mg', 3), grp(2, ['P', 1], ['O', 4])]),
  // hydrates
  row('CuSO4·5H2O', 'copper(II) sulfate pentahydrate', 'hydrate', 'solid', [el('Cu'), el('S'), el('O', 4)], 5),
  row('MgSO4·7H2O', 'magnesium sulfate heptahydrate', 'hydrate', 'solid', [el('Mg'), el('S'), el('O', 4)], 7),
  row('Na2CO3·10H2O', 'sodium carbonate decahydrate', 'hydrate', 'solid', [el('Na', 2), el('C'), el('O', 3)], 10),
  row('BaCl2·2H2O', 'barium chloride dihydrate', 'hydrate', 'solid', [el('Ba'), el('Cl', 2)], 2),
]

/**
 * Three table rows that NO problem ever draws (tested). Rule-card and catalog examples work only
 * these, so an example can never show a part's answer.
 */
export const MO_RESERVED: readonly string[] = ['Br2', 'Ca(OH)2', 'BaCl2·2H2O']

/** Every word or formula spelling of the reserved rows, for the leak checks. */
export const MO_RESERVED_WORDS: readonly string[] = ['Br₂', 'Br2', 'bromine', 'Ca(OH)₂', 'Ca(OH)2', 'calcium hydroxide', 'BaCl₂', 'BaCl2', 'barium']

const BY_KEY = new Map(SUBSTANCES.map((s) => [s.key, s]))

export function substanceOf(key: string): MoSubstance {
  const s = BY_KEY.get(key)
  if (!s) throw new Error(`moles: no substance ${key}`)
  return s
}

export const DRAWABLE: readonly MoSubstance[] = SUBSTANCES.filter((s) => !MO_RESERVED.includes(s.key))

// ---------------------------------------------------------------------------
// Formula text, display and counts (all derived from the pieces)
// ---------------------------------------------------------------------------

function sub(n: number): string {
  return n === 1 ? '' : String(n)
}

/** ASCII text of the formula from its pieces: 'Mg3(PO4)2', 'CuSO4·5H2O'. */
export function formulaText(s: Pick<MoSubstance, 'pieces' | 'waters'>): string {
  const body = s.pieces
    .map((p) => ('symbol' in p ? `${p.symbol}${sub(p.n)}` : `(${p.group.map((g) => `${g.symbol}${sub(g.n)}`).join('')})${sub(p.n)}`))
    .join('')
  return s.waters > 0 ? `${body}·${s.waters}H2O` : body
}

/** Unicode-subscript display: 'CuSO₄·5H₂O'. */
export function show(key: string): string {
  return formulaDisplay(key)
}

/** Counts per element in order of first appearance, hydrate water included (H then O after the dot). */
export function countsOf(s: Pick<MoSubstance, 'pieces' | 'waters'>): MoCount[] {
  const out: MoCount[] = []
  const add = (symbol: string, n: number) => {
    const found = out.find((c) => c.symbol === symbol)
    if (found) found.n += n
    else out.push({ symbol, n })
  }
  for (const p of s.pieces) {
    if ('symbol' in p) add(p.symbol, p.n)
    else for (const g of p.group) add(g.symbol, g.n * p.n)
  }
  if (s.waters > 0) {
    add('H', 2 * s.waters)
    add('O', s.waters)
  }
  return out
}

/** Counts of the formula without its waters (the anhydrous salt). */
export function anhydrousCounts(s: MoSubstance): MoCount[] {
  return countsOf({ pieces: s.pieces, waters: 0 })
}

/** Total atoms in one formula unit (or molecule). */
export function atomTotal(counts: readonly MoCount[]): number {
  return counts.reduce((sum, c) => sum + c.n, 0)
}

export function countOf(counts: readonly MoCount[], symbol: string): number {
  return counts.find((c) => c.symbol === symbol)?.n ?? 0
}

/** Counts as she enters them: 'C=1;H=2;O=1'. */
export function countsText(counts: readonly MoCount[]): string {
  return counts.map((c) => `${c.symbol}=${c.n}`).join(';')
}

/** Counts as a formula, ASCII: 'CH2O'. */
export function countsFormula(counts: readonly MoCount[]): string {
  return counts.map((c) => `${c.symbol}${sub(c.n)}`).join('')
}

/** Counts as a displayed formula: 'CH₂O'. */
export function countsDisplay(counts: readonly MoCount[]): string {
  return formulaDisplay(countsFormula(counts))
}

/** Read 'C=1;H=2;O=1' back; null when unreadable. */
export function parseCounts(text: string): MoCount[] | null {
  const parts = text.split(';').map((p) => p.trim())
  const out: MoCount[] = []
  for (const part of parts) {
    const m = /^([A-Z][a-z]?)=(\d{1,3})$/.exec(part)
    if (!m) return null
    out.push({ symbol: m[1]!, n: Number(m[2]) })
  }
  return out
}

export function sameCounts(a: readonly MoCount[], b: readonly MoCount[]): boolean {
  return a.length === b.length && a.every((c, i) => c.symbol === b[i]!.symbol && c.n === b[i]!.n)
}

export function gcdOf(values: readonly number[]): number {
  const g2 = (a: number, b: number): number => (b === 0 ? a : g2(b, a % b))
  return values.reduce((g, v) => g2(g, v), 0)
}

/** Lowest whole-number ratio of the counts (the empirical formula). */
export function empiricalCounts(counts: readonly MoCount[]): MoCount[] {
  const g = gcdOf(counts.map((c) => c.n))
  return counts.map((c) => ({ symbol: c.symbol, n: c.n / g }))
}

// ---------------------------------------------------------------------------
// Atomic and molar masses (hundredths, exact)
// ---------------------------------------------------------------------------

export function ratOf(text: string): Rat {
  const parsed = parseSigFigNumeral(text)
  if (!parsed.ok) throw new Error(`moles: unreadable number ${text}`)
  return ratFromDec(sigFigDec(parsed.numeral))
}

/** The atomic weight exactly as the periodic table prints it. */
export function atomicWeightRat(symbol: string): Rat {
  const info = elementBySymbol(symbol)
  if (!info) throw new Error(`moles: no element ${symbol}`)
  return ratOf(info.atomicWeight)
}

/** The atomic mass her class uses: the printed weight rounded to the hundredths, in hundredths. */
export function massHundredths(symbol: string): bigint {
  return roundRatToPlace(atomicWeightRat(symbol), -2).m
}

/** Hundredths → text with two decimals: 1801n → '18.01'. */
export function hundredthsText(h: bigint): string {
  return decToPlain({ int: h, exp: -2 })
}

export function hundredthsRat(h: bigint): Rat {
  return rat(h, 100n)
}

export function atomicMassText(symbol: string): string {
  return hundredthsText(massHundredths(symbol))
}

export function elementName(symbol: string): string {
  const info = elementBySymbol(symbol)
  if (!info) throw new Error(`moles: no element ${symbol}`)
  return info.name
}

/** Σ count × rounded atomic mass, in hundredths. */
export function countsMassHundredths(counts: readonly MoCount[]): bigint {
  return counts.reduce((sum, c) => sum + BigInt(c.n) * massHundredths(c.symbol), 0n)
}

export function molarMassHundredths(s: MoSubstance): bigint {
  return countsMassHundredths(countsOf(s))
}

export function molarMassText(s: MoSubstance): string {
  return hundredthsText(molarMassHundredths(s))
}

/** The molar mass from the unrounded printed weights (the other honest path), exact. */
export function fullMolarMass(counts: readonly MoCount[]): Rat {
  return counts.reduce((sum, c) => ratAdd(sum, ratMul(rat(BigInt(c.n)), atomicWeightRat(c.symbol))), rat(0n))
}

/** Every element symbol that appears in the substance, in order. */
export function symbolsOf(s: MoSubstance): string[] {
  return countsOf(s).map((c) => c.symbol)
}

/** The element list a prompt prints: 'H 1.01, O 16.00'. */
export function massList(symbols: readonly string[]): string {
  return symbols.map((symbol) => `${symbol} ${atomicMassText(symbol)}`).join(', ')
}

export const WATER_HUNDREDTHS = 2n * massHundredths('H') + massHundredths('O')

// ---------------------------------------------------------------------------
// What each molar-mass slip weighs (hundredths), null where the slip does not apply
// ---------------------------------------------------------------------------

/** One of each element, subscripts ignored (hydrate water as its H and O once each too). */
export function subscriptsIgnoredHundredths(s: MoSubstance): bigint | null {
  const counts = countsOf(s)
  if (counts.every((c) => c.n === 1)) return null
  return counts.reduce((sum, c) => sum + massHundredths(c.symbol), 0n)
}

/** A parenthesis subscript applied to the first element inside only. */
export function parenFirstOnlyHundredths(s: MoSubstance): bigint | null {
  const groups = s.pieces.filter((p): p is Extract<FormulaPiece, { group: unknown }> => 'group' in p)
  if (!groups.some((g) => g.n > 1 && g.group.length > 1)) return null
  let sum = 0n
  for (const p of s.pieces) {
    if ('symbol' in p) sum += BigInt(p.n) * massHundredths(p.symbol)
    else p.group.forEach((g, i) => (sum += BigInt(g.n * (i === 0 ? p.n : 1)) * massHundredths(g.symbol)))
  }
  if (s.waters > 0) sum += BigInt(s.waters) * WATER_HUNDREDTHS
  return sum
}

/** A diatomic element weighed as one atom. */
export function diatomicSingleHundredths(s: MoSubstance): bigint | null {
  if (s.kind !== 'diatomic') return null
  return massHundredths(countsOf(s)[0]!.symbol)
}

/** A hydrate weighed without its water. */
export function waterLeftOutHundredths(s: MoSubstance): bigint | null {
  if (s.waters === 0) return null
  return countsMassHundredths(anhydrousCounts(s))
}

/** A hydrate weighed with one water instead of its coefficient. */
export function waterOnceHundredths(s: MoSubstance): bigint | null {
  if (s.waters < 2) return null
  return countsMassHundredths(anhydrousCounts(s)) + WATER_HUNDREDTHS
}

// ---------------------------------------------------------------------------
// Particles, gases, constants
// ---------------------------------------------------------------------------

export type ParticleKind = 'atoms' | 'molecules' | 'formula units'

export function particleKindOf(s: MoSubstance): ParticleKind {
  if (s.kind === 'element') return 'atoms'
  if (s.kind === 'diatomic' || s.kind === 'molecular') return 'molecules'
  return 'formula units'
}

/** Avogadro's number as her class writes it (4 significant figures). */
export const AVOGADRO_TEXT = '6.022 x 10^23'
/** Molar volume of a gas at STP (3 significant figures). */
export const MOLAR_VOLUME_TEXT = '22.4'

// ---------------------------------------------------------------------------
// Leak checks on numbers
// ---------------------------------------------------------------------------

const SUPER: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' }

/**
 * Every number written in a surface, as an exact value: '1.51 × 10²⁴', '2.50 x 10^24', '18.02'.
 * Subscript digits are not numbers; a hydrate's water coefficient ('·5H₂O') is skipped.
 */
export function numbersIn(text: string): Rat[] {
  const normalized = text
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => `^${[...m].map((c) => SUPER[c] ?? c).join('')}`)
    .replace(/−/g, '-')
    .replace(/·\d+/g, '·')
  const out: Rat[] = []
  const re = /(?<![\w.^])(\d+(?:\.\d+)?|\.\d+)(?:\s*[x×]\s*10\s*\^\s*\(?(-?\d+)\)?)?/g
  for (const m of normalized.matchAll(re)) {
    const body = m[1]!
    const power = m[2]
    try {
      out.push(ratOf(power ? `${body} x 10^${power}` : body))
    } catch {
      // not a readable numeral: ignore
    }
  }
  return out
}

/** True when the surface writes a number whose VALUE equals the answer's value. */
export function numberLeaks(text: string, answer: Rat): boolean {
  return numbersIn(text).some((value) => ratEq(value, answer))
}
