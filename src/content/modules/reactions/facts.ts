/**
 * Chapter 11 facts: the reaction table, stored UNBALANCED (no coefficient is ever typed here: the
 * balancer in balance.ts computes them), the activity series, the seven diatomic elements, the
 * names a word equation uses, and the reserved species that only rule cards and catalog examples
 * may show. Every formula is read by the nomenclature engine's reader, and every compound is a
 * compound of its model (pinned in reactions.test.ts); hydrocarbons other than methane are the
 * one exception — the engine reads their formulas, but it has no names for them.
 */
import { elementBySymbol } from '@/engine/chem/elements'
import { formulaDisplay, nameOfFormula, readChemicalFormula, type FormulaPart } from '@/engine'

export type RxType = 'combination' | 'decomposition' | 'single' | 'double' | 'combustion'
export type RxState = 's' | 'l' | 'g' | 'aq'

export interface RxSpecies {
  /** App text, no state: 'Fe2O3', 'HCl', 'O2'. */
  formula: string
  state: RxState
}

export interface RxReaction {
  id: string
  type: RxType
  reactants: readonly RxSpecies[]
  products: readonly RxSpecies[]
}

function sp(text: string): RxSpecies {
  const m = /^(.*)\((s|l|g|aq)\)$/.exec(text)
  if (!m) throw new Error(`reactions: species ${text} has no state`)
  return { formula: m[1]!, state: m[2] as RxState }
}

function rx(id: string, type: RxType, left: string, right: string): RxReaction {
  return {
    id,
    type,
    reactants: left.split(' + ').map(sp),
    products: right.split(' + ').map(sp),
  }
}

/**
 * 59 reactions of the chapter, unbalanced. Coefficients come from the balancer; the hand-worked
 * balanced equations are pinned in balance.test.ts.
 */
export const REACTIONS: readonly RxReaction[] = [
  // combination: two or more substances become one
  rx('c.h2o', 'combination', 'H2(g) + O2(g)', 'H2O(l)'),
  rx('c.fe2o3', 'combination', 'Fe(s) + O2(g)', 'Fe2O3(s)'),
  rx('c.nacl', 'combination', 'Na(s) + Cl2(g)', 'NaCl(s)'),
  rx('c.mgo', 'combination', 'Mg(s) + O2(g)', 'MgO(s)'),
  rx('c.al2o3', 'combination', 'Al(s) + O2(g)', 'Al2O3(s)'),
  rx('c.nh3', 'combination', 'N2(g) + H2(g)', 'NH3(g)'),
  rx('c.kbr', 'combination', 'K(s) + Br2(l)', 'KBr(s)'),
  rx('c.alcl3', 'combination', 'Al(s) + Cl2(g)', 'AlCl3(s)'),
  rx('c.mg3n2', 'combination', 'Mg(s) + N2(g)', 'Mg3N2(s)'),
  rx('c.caoh2', 'combination', 'CaO(s) + H2O(l)', 'Ca(OH)2(s)'),
  rx('c.h2so4', 'combination', 'SO3(g) + H2O(l)', 'H2SO4(aq)'),
  rx('c.zns', 'combination', 'Zn(s) + S(s)', 'ZnS(s)'),
  rx('c.cuo', 'combination', 'Cu(s) + O2(g)', 'CuO(s)'),
  rx('c.p4o10', 'combination', 'P4(s) + O2(g)', 'P4O10(s)'),
  // decomposition: one substance breaks into two or more
  rx('d.h2o', 'decomposition', 'H2O(l)', 'H2(g) + O2(g)'),
  rx('d.kclo3', 'decomposition', 'KClO3(s)', 'KCl(s) + O2(g)'),
  rx('d.caco3', 'decomposition', 'CaCO3(s)', 'CaO(s) + CO2(g)'),
  rx('d.hgo', 'decomposition', 'HgO(s)', 'Hg(l) + O2(g)'),
  rx('d.nacl', 'decomposition', 'NaCl(l)', 'Na(l) + Cl2(g)'),
  rx('d.ag2o', 'decomposition', 'Ag2O(s)', 'Ag(s) + O2(g)'),
  rx('d.nahco3', 'decomposition', 'NaHCO3(s)', 'Na2CO3(s) + H2O(g) + CO2(g)'),
  rx('d.al2o3', 'decomposition', 'Al2O3(l)', 'Al(l) + O2(g)'),
  rx('d.cuoh2', 'decomposition', 'Cu(OH)2(s)', 'CuO(s) + H2O(g)'),
  rx('d.h2co3', 'decomposition', 'H2CO3(aq)', 'H2O(l) + CO2(g)'),
  rx('d.mgcl2', 'decomposition', 'MgCl2(l)', 'Mg(l) + Cl2(g)'),
  // single replacement: an element takes the place of one in a compound
  rx('s.zn.hcl', 'single', 'Zn(s) + HCl(aq)', 'ZnCl2(aq) + H2(g)'),
  rx('s.al.hcl', 'single', 'Al(s) + HCl(aq)', 'AlCl3(aq) + H2(g)'),
  rx('s.fe.cuso4', 'single', 'Fe(s) + CuSO4(aq)', 'FeSO4(aq) + Cu(s)'),
  rx('s.cu.agno3', 'single', 'Cu(s) + AgNO3(aq)', 'Cu(NO3)2(aq) + Ag(s)'),
  rx('s.zn.cuso4', 'single', 'Zn(s) + CuSO4(aq)', 'ZnSO4(aq) + Cu(s)'),
  rx('s.mg.hcl', 'single', 'Mg(s) + HCl(aq)', 'MgCl2(aq) + H2(g)'),
  rx('s.na.h2o', 'single', 'Na(s) + H2O(l)', 'NaOH(aq) + H2(g)'),
  rx('s.k.h2o', 'single', 'K(s) + H2O(l)', 'KOH(aq) + H2(g)'),
  rx('s.cl2.nabr', 'single', 'Cl2(g) + NaBr(aq)', 'NaCl(aq) + Br2(l)'),
  rx('s.cl2.kbr', 'single', 'Cl2(g) + KBr(aq)', 'KCl(aq) + Br2(l)'),
  rx('s.al.cucl2', 'single', 'Al(s) + CuCl2(aq)', 'AlCl3(aq) + Cu(s)'),
  rx('s.ca.h2o', 'single', 'Ca(s) + H2O(l)', 'Ca(OH)2(aq) + H2(g)'),
  rx('s.zn.agno3', 'single', 'Zn(s) + AgNO3(aq)', 'Zn(NO3)2(aq) + Ag(s)'),
  rx('s.mg.h2so4', 'single', 'Mg(s) + H2SO4(aq)', 'MgSO4(aq) + H2(g)'),
  // double replacement: two compounds trade partners
  rx('x.agcl', 'double', 'AgNO3(aq) + NaCl(aq)', 'AgCl(s) + NaNO3(aq)'),
  rx('x.baso4', 'double', 'BaCl2(aq) + Na2SO4(aq)', 'BaSO4(s) + NaCl(aq)'),
  rx('x.pbi2', 'double', 'Pb(NO3)2(aq) + KI(aq)', 'PbI2(s) + KNO3(aq)'),
  rx('x.hcl.naoh', 'double', 'HCl(aq) + NaOH(aq)', 'NaCl(aq) + H2O(l)'),
  rx('x.h2so4.naoh', 'double', 'H2SO4(aq) + NaOH(aq)', 'Na2SO4(aq) + H2O(l)'),
  rx('x.ca3po42', 'double', 'Ca(OH)2(aq) + H3PO4(aq)', 'Ca3(PO4)2(s) + H2O(l)'),
  rx('x.caco3', 'double', 'CaCl2(aq) + Na2CO3(aq)', 'CaCO3(s) + NaCl(aq)'),
  rx('x.feoh3', 'double', 'FeCl3(aq) + NaOH(aq)', 'Fe(OH)3(s) + NaCl(aq)'),
  rx('x.cuoh2', 'double', 'CuSO4(aq) + NaOH(aq)', 'Cu(OH)2(s) + Na2SO4(aq)'),
  rx('x.hno3.koh', 'double', 'HNO3(aq) + KOH(aq)', 'KNO3(aq) + H2O(l)'),
  rx('x.aloh3', 'double', 'AlCl3(aq) + NaOH(aq)', 'Al(OH)3(s) + NaCl(aq)'),
  rx('x.na3po4', 'double', 'Na3PO4(aq) + CaCl2(aq)', 'Ca3(PO4)2(s) + NaCl(aq)'),
  // combustion: a hydrocarbon burns in oxygen
  rx('b.ch4', 'combustion', 'CH4(g) + O2(g)', 'CO2(g) + H2O(g)'),
  rx('b.c2h6', 'combustion', 'C2H6(g) + O2(g)', 'CO2(g) + H2O(g)'),
  rx('b.c3h8', 'combustion', 'C3H8(g) + O2(g)', 'CO2(g) + H2O(g)'),
  rx('b.c2h4', 'combustion', 'C2H4(g) + O2(g)', 'CO2(g) + H2O(g)'),
  rx('b.c2h2', 'combustion', 'C2H2(g) + O2(g)', 'CO2(g) + H2O(g)'),
  rx('b.c3h6', 'combustion', 'C3H6(g) + O2(g)', 'CO2(g) + H2O(g)'),
  rx('b.c5h12', 'combustion', 'C5H12(l) + O2(g)', 'CO2(g) + H2O(g)'),
  rx('b.c4h8', 'combustion', 'C4H8(g) + O2(g)', 'CO2(g) + H2O(g)'),
]

const BY_ID = new Map(REACTIONS.map((r) => [r.id, r]))

export function reactionOf(id: string): RxReaction {
  const r = BY_ID.get(id)
  if (!r) throw new Error(`reactions: unknown reaction ${id}`)
  return r
}

export function speciesOf(r: RxReaction): RxSpecies[] {
  return [...r.reactants, ...r.products]
}

// ---------------------------------------------------------------------------
// Atoms in a formula (read by the nomenclature engine's reader; no second parser)
// ---------------------------------------------------------------------------

export function formulaParts(formula: string): FormulaPart[] {
  const read = readChemicalFormula(formula)
  if (!read.ok) throw new Error(`reactions: ${formula} does not read: ${read.error.message}`)
  return read.value.parts
}

function addParts(parts: readonly FormulaPart[], times: number, out: Map<string, number>) {
  for (const part of parts) {
    if (part.type === 'element') out.set(part.symbol, (out.get(part.symbol) ?? 0) + part.count * times)
    else addParts(part.parts, times * part.count, out)
  }
}

/** Atoms of each element in one unit of the formula, in first-seen order. */
export function atomCounts(formula: string): Map<string, number> {
  const out = new Map<string, number>()
  addParts(formulaParts(formula), 1, out)
  return out
}

/** Elements of a reaction in first-seen order across the equation. */
export function elementsOf(r: RxReaction): string[] {
  const seen: string[] = []
  for (const s of speciesOf(r)) for (const el of atomCounts(s.formula).keys()) if (!seen.includes(el)) seen.push(el)
  return seen
}

/** Atoms of one element on each side for the given coefficients (reactants first). */
export function sideCounts(r: RxReaction, coefficients: readonly number[], element: string): { left: number; right: number } {
  let left = 0
  let right = 0
  r.reactants.forEach((s, i) => (left += (coefficients[i] ?? 0) * (atomCounts(s.formula).get(element) ?? 0)))
  r.products.forEach((s, i) => (right += (coefficients[r.reactants.length + i] ?? 0) * (atomCounts(s.formula).get(element) ?? 0)))
  return { left, right }
}

/** Elements whose atoms do not match on the two sides. */
export function offElements(r: RxReaction, coefficients: readonly number[]): string[] {
  return elementsOf(r).filter((el) => {
    const { left, right } = sideCounts(r, coefficients, el)
    return left !== right
  })
}

// ---------------------------------------------------------------------------
// Elements, diatomics, names
// ---------------------------------------------------------------------------

/** The seven elements that exist as two-atom molecules when free. */
export const DIATOMIC = ['H', 'N', 'O', 'F', 'Cl', 'Br', 'I'] as const

export function isDiatomic(symbol: string): boolean {
  return (DIATOMIC as readonly string[]).includes(symbol)
}

/** The formula of a free element, as an equation writes it: O2, Cu, S, P4. */
export function elementalFormula(symbol: string): string {
  if (isDiatomic(symbol)) return `${symbol}2`
  if (symbol === 'P') return 'P4'
  return symbol
}

/** The element a free-element formula stands for ('O2' → 'O'), or null for a compound. */
export function elementOfFormula(formula: string): string | null {
  const counts = atomCounts(formula)
  if (counts.size !== 1) return null
  const [symbol] = [...counts.keys()]
  return symbol ?? null
}

export function elementName(symbol: string): string {
  const el = elementBySymbol(symbol)
  if (!el) throw new Error(`reactions: no element ${symbol}`)
  return el.name
}

export function capName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

const HYDROCARBON_NAMES: Readonly<Record<string, string>> = {
  CH4: 'methane',
  C2H6: 'ethane',
  C3H8: 'propane',
  C2H4: 'ethene',
  C2H2: 'ethyne',
  C3H6: 'propene',
  C5H12: 'pentane',
  C4H8: 'butene',
}

export function isHydrocarbon(formula: string): boolean {
  const counts = atomCounts(formula)
  return counts.size === 2 && counts.has('C') && counts.has('H')
}

/** The gases among the diatomics are named "… gas" in a word equation. */
const GAS_WORD = new Set(['H', 'N', 'O', 'F', 'Cl'])

/** The name a word equation uses for a species. Compounds are named by the nomenclature engine. */
export function speciesName(s: RxSpecies): string {
  const element = elementOfFormula(s.formula)
  if (element) return GAS_WORD.has(element) ? `${elementName(element)} gas` : elementName(element)
  if (s.formula !== 'CH4' && HYDROCARBON_NAMES[s.formula]) return HYDROCARBON_NAMES[s.formula]!
  return nameOfFormula(s.formula, { inWater: s.state === 'aq' })
}

/** A hydrocarbon's name (methane included), for the combustion prompts. */
export function fuelName(formula: string): string {
  const name = HYDROCARBON_NAMES[formula]
  if (!name) throw new Error(`reactions: ${formula} is not a listed hydrocarbon`)
  return name
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function speciesDisplay(s: RxSpecies, coefficient?: number): string {
  const lead = coefficient == null || coefficient === 1 ? '' : String(coefficient)
  return `${lead}${formulaDisplay(s.formula)}(${s.state})`
}

/** '2H₂(g) + O₂(g) → 2H₂O(l)'; with no coefficients, the skeleton. */
export function equationDisplay(r: RxReaction, coefficients?: readonly number[]): string {
  const left = r.reactants.map((s, i) => speciesDisplay(s, coefficients?.[i])).join(' + ')
  const right = r.products.map((s, i) => speciesDisplay(s, coefficients?.[r.reactants.length + i])).join(' + ')
  return `${left} → ${right}`
}

// ---------------------------------------------------------------------------
// The activity series (the card prints it in names)
// ---------------------------------------------------------------------------

/** Most active first. H sits among the metals, as the chapter's series puts it. */
export const METAL_SERIES = ['K', 'Ca', 'Na', 'Mg', 'Al', 'Zn', 'Fe', 'Ni', 'Sn', 'Pb', 'H', 'Cu', 'Ag', 'Au'] as const
/** Only the metals at the very top push hydrogen out of cold water. */
export const COLD_WATER_METALS = ['K', 'Ca', 'Na'] as const
export const HALOGEN_SERIES = ['F', 'Cl', 'Br', 'I'] as const

export function metalRank(symbol: string): number {
  const i = (METAL_SERIES as readonly string[]).indexOf(symbol)
  if (i < 0) throw new Error(`reactions: ${symbol} is not in the activity series`)
  return i
}

export function halogenRank(symbol: string): number {
  const i = (HALOGEN_SERIES as readonly string[]).indexOf(symbol)
  if (i < 0) throw new Error(`reactions: ${symbol} is not a halogen of the series`)
  return i
}

/**
 * What a lone element could push out of a compound: a halogen pushes out the compound's halide;
 * a metal pushes out hydrogen (water or an acid) or the compound's metal.
 */
export function displacedBy(lone: string, compound: string): string {
  const counts = atomCounts(compound)
  const symbols = [...counts.keys()]
  if ((HALOGEN_SERIES as readonly string[]).includes(lone)) {
    const halide = symbols.find((el) => (HALOGEN_SERIES as readonly string[]).includes(el))
    if (!halide) throw new Error(`reactions: ${compound} has no halide for ${lone}`)
    return halide
  }
  if (compound === 'H2O' || symbols[0] === 'H') return 'H'
  return symbols[0]!
}

/** Does the lone element react with the compound? The activity series decides. */
export function reactsWith(lone: string, compound: string): boolean {
  const out = displacedBy(lone, compound)
  if ((HALOGEN_SERIES as readonly string[]).includes(lone)) return halogenRank(lone) < halogenRank(out)
  if (compound === 'H2O') return (COLD_WATER_METALS as readonly string[]).includes(lone)
  return metalRank(lone) < metalRank(out)
}

// ---------------------------------------------------------------------------
// Pools
// ---------------------------------------------------------------------------

/** Element + element (metal with nonmetal) combinations: the predict template's first kind. */
export const PREDICT_COMBINATION = ['c.fe2o3', 'c.nacl', 'c.mgo', 'c.al2o3', 'c.kbr', 'c.alcl3', 'c.mg3n2', 'c.zns', 'c.cuo'] as const
/** A binary compound splitting into its two elements. */
export const PREDICT_DECOMPOSITION = ['d.h2o', 'd.hgo', 'd.nacl', 'd.ag2o', 'd.al2o3', 'd.mgcl2'] as const
/** Single replacements that react, each with the less active elements that would not. */
export const PREDICT_SINGLE: readonly { id: string; idle: readonly string[] }[] = [
  { id: 's.zn.hcl', idle: ['Cu', 'Ag'] },
  { id: 's.mg.hcl', idle: ['Cu', 'Au'] },
  { id: 's.na.h2o', idle: ['Cu', 'Ag'] },
  { id: 's.fe.cuso4', idle: ['Ag', 'Au'] },
  { id: 's.zn.cuso4', idle: ['Ag', 'Au'] },
  { id: 's.al.cucl2', idle: ['Ag', 'Au'] },
  { id: 's.cu.agno3', idle: ['Au'] },
  { id: 's.zn.agno3', idle: ['Au'] },
  { id: 's.cl2.nabr', idle: ['I'] },
  { id: 's.cl2.kbr', idle: ['I'] },
]
/** Double replacements between ionic compounds (no acids: H⁺ is not an ion of the naming model). */
export const PREDICT_DOUBLE = ['x.agcl', 'x.baso4', 'x.pbi2', 'x.caco3', 'x.feoh3', 'x.cuoh2', 'x.na3po4'] as const
export const PREDICT_COMBUSTION = REACTIONS.filter((r) => r.type === 'combustion').map((r) => r.id)

/**
 * For classifying, the combination pool leaves out anything burning in oxygen: an element plus
 * O₂ is a combination AND, by the chapter's wider definition, a combustion, and the app never
 * asks a question with two right answers.
 */
export function typesPool(type: RxType): string[] {
  return REACTIONS.filter((r) => r.type === type && !(type === 'combination' && r.reactants.some((s) => s.formula === 'O2'))).map((r) => r.id)
}

/** Word equations: every species has a name the engine (or the element table) gives; no P₄. */
export function wordPool(): string[] {
  return REACTIONS.filter((r) => speciesOf(r).every((s) => s.formula !== 'P4' && (s.formula === 'CH4' || !isHydrocarbon(s.formula)))).map((r) => r.id)
}

/** Compounds a counting question can draw: two or more elements, from the table. */
export function countPool(): string[] {
  const out: string[] = []
  for (const r of REACTIONS) for (const s of speciesOf(r)) if (atomCounts(s.formula).size >= 2 && !out.includes(s.formula)) out.push(s.formula)
  return out
}

// ---------------------------------------------------------------------------
// Reserved: only rule cards and catalog examples show these; no template draws them
// ---------------------------------------------------------------------------

export const RX_RESERVED_FORMULAS = ['Li', 'F2', 'LiF', 'Ni', 'Sn', 'Sn(NO3)2', 'Ni(NO3)2', 'SrCl2', 'Li2SO4', 'SrSO4', 'LiCl', 'Sr(NO3)2', 'C4H10', 'SrF2'] as const

// ---------------------------------------------------------------------------
// Leaks
// ---------------------------------------------------------------------------

const WORD = 'a-z0-9₀-₉⁰-⁹'

function norm(s: string): string {
  return s.replace(/−/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * True when `text` shows `answer` as its own token, in app text or display text. A subscript
 * digit counts as part of a token, so Al₂O₃ does not show Al and CO₂ does not show CO.
 */
export function rxLeaks(text: string, answer: string): boolean {
  const forms = new Set([answer, formulaDisplay(answer)])
  const hay = norm(text)
  for (const form of forms) {
    const ans = norm(form)
    if (!ans) continue
    const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?<![${WORD}])${escaped}(?![${WORD}])`).test(hay)) return true
  }
  return false
}
