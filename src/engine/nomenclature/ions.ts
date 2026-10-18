/**
 * The ions of the model.
 *
 * Monatomic ions come only from `commonCharges` in engine/chem/elements.ts:
 *  - cations: every metal's positive charges. H⁺ is left out (it appears only in acids), and mercury's 1+ is
 *    the polyatomic ion Hg₂²⁺, mercury(I), never a lone Hg⁺;
 *  - anions: H⁻ hydride, N³⁻ nitride, O²⁻ oxide, F⁻, P³⁻ phosphide, S²⁻ sulfide, Cl⁻, Br⁻, I⁻.
 * Polyatomic ions are the rows of POLYATOMIC_IONS (data.ts).
 *
 * ROMAN NUMERALS. A metal's name carries one when elements.ts lists more than one positive charge for it: Cr, Mn,
 * Fe, Co, Cu, Sn, Au, Hg, Pb (`NUMERAL_METALS`). Nickel has one taught charge (Ni²⁺), but CK-12 writes it
 * "nickel (II)" (Table 7.5.1 and the exercise "nickel (II) hydroxide"), so for nickel the numeral is printed
 * and both nickel(II) and plain nickel are right. Every other metal has one charge and never takes a numeral
 * (silver, zinc, aluminum, the group 1 and 2 metals). Cadmium has no taught charge in elements.ts, so cadmium
 * compounds are outside the model (see the API document).
 */
import { ELEMENTS, elementBySymbol } from '../chem/elements'
import { BINARY_ACID_ROOTS, IDE_NAMES, POLYATOMIC_IONS } from './data'
import { readIon, sequenceKey, simpleParts } from './formula'
import { nameKey } from './names'
import { chargeDisplay, chargeText, formulaDisplay, formulaLatex, romanNumeral } from './text'
import type { FormulaPart, IonLike, IonReading, NmIon } from './types'

/** Metals whose names carry a Roman numeral: more than one positive charge in elements.ts. */
export const NUMERAL_METALS: readonly string[] = ELEMENTS.filter((e) => e.symbol !== 'H' && e.commonCharges.filter((c) => c > 0).length > 1).map((e) => e.symbol)

/** Metals whose numeral is printed but may be left off (nickel: one taught charge, written nickel (II) by CK-12). */
export const OPTIONAL_NUMERAL_METALS: readonly string[] = ['Ni']

/** Cations that combine with peroxide and hydride in the model: groups 1 and 2 (K2O2, BaO2, NaH, CaH2). */
export function takesPeroxideOrHydride(cation: NmIon): boolean {
  if (cation.kind !== 'monatomic' || !cation.symbol) return false
  const g = elementBySymbol(cation.symbol)?.group
  return g === 1 || g === 2
}

function ionText(formula: string, charge: number): string {
  return `${formula}^${chargeText(charge)}`
}

function monatomicCation(symbol: string, metal: string, charge: number): NmIon {
  const numeral = NUMERAL_METALS.includes(symbol)
  const optional = OPTIONAL_NUMERAL_METALS.includes(symbol)
  const withNumeral = `${metal}(${romanNumeral(charge)})`
  return {
    text: ionText(symbol, charge),
    formula: symbol,
    otherFormulas: [],
    charge,
    role: 'cation',
    kind: 'monatomic',
    name: numeral || optional ? withNumeral : metal,
    otherNames: optional ? [metal] : [],
    symbol,
    metalName: metal,
    numeral: numeral || optional ? charge : null,
    numeralOptional: optional,
    inTextbook: true,
  }
}

function monatomicAnion(symbol: string, charge: number): NmIon {
  return {
    text: ionText(symbol, charge),
    formula: symbol,
    otherFormulas: [],
    charge,
    role: 'anion',
    kind: 'monatomic',
    name: IDE_NAMES[symbol]!,
    otherNames: [],
    symbol,
    metalName: null,
    numeral: null,
    numeralOptional: false,
    inTextbook: true,
  }
}

function buildIons(): NmIon[] {
  const out: NmIon[] = []
  for (const el of ELEMENTS) {
    if (el.symbol === 'H') continue
    for (const c of el.commonCharges) {
      if (c <= 0) continue
      if (el.symbol === 'Hg' && c === 1) continue // mercury(I) is Hg2 2+, below
      out.push(monatomicCation(el.symbol, el.name, c))
    }
  }
  for (const row of POLYATOMIC_IONS) {
    if (row.charge <= 0) continue
    const mercury = row.formula === 'Hg2'
    out.push({
      text: ionText(row.formula, row.charge),
      formula: row.formula,
      otherFormulas: row.otherFormulas,
      charge: row.charge,
      role: 'cation',
      kind: 'polyatomic',
      name: row.name,
      otherNames: row.otherNames,
      symbol: null,
      metalName: mercury ? 'mercury' : null,
      numeral: mercury ? 1 : null,
      numeralOptional: false,
      inTextbook: row.inTextbook,
    })
  }
  for (const el of ELEMENTS) for (const c of el.commonCharges) if (c < 0) out.push(monatomicAnion(el.symbol, c))
  for (const row of POLYATOMIC_IONS) {
    if (row.charge >= 0) continue
    out.push({
      text: ionText(row.formula, row.charge),
      formula: row.formula,
      otherFormulas: row.otherFormulas,
      charge: row.charge,
      role: 'anion',
      kind: 'polyatomic',
      name: row.name,
      otherNames: row.otherNames,
      symbol: null,
      metalName: null,
      numeral: null,
      numeralOptional: false,
      inTextbook: row.inTextbook,
    })
  }
  return out
}

const IONS: readonly NmIon[] = buildIons()

/** Every ion of the model: cations first (monatomic in order of Z, then NH4+, Hg2 2+, H3O+), then anions. */
export function nmIons(): NmIon[] {
  return [...IONS]
}

export function nmCations(): NmIon[] {
  return IONS.filter((i) => i.role === 'cation')
}

export function nmAnions(): NmIon[] {
  return IONS.filter((i) => i.role === 'anion')
}

/** The cations a compound can have (hydronium salts are not taught: H3O+ is an ion question only). */
export function compoundCations(): NmIon[] {
  return IONS.filter((i) => i.role === 'cation' && i.formula !== 'H3O')
}

// --- lookups ----------------------------------------------------------------------------------------

const BY_SEQUENCE = new Map<string, NmIon[]>()
for (const ion of IONS) {
  for (const f of [ion.formula, ...ion.otherFormulas]) {
    const key = sequenceKey(simpleParts(f))
    const list = BY_SEQUENCE.get(key) ?? []
    list.push(ion)
    BY_SEQUENCE.set(key, list)
  }
}

/** Ions whose formula (or other formula) is written exactly as these parts, any charge. */
export function ionsWrittenAs(parts: readonly FormulaPart[]): NmIon[] {
  return BY_SEQUENCE.get(sequenceKey(parts)) ?? []
}

/** The ion with this written formula and charge, or null. */
export function ionOfReading(reading: Pick<IonReading, 'parts' | 'charge'>): NmIon | null {
  if (reading.charge === null) return null
  return ionsWrittenAs(reading.parts).find((i) => i.charge === reading.charge) ?? null
}

const BY_NAME = new Map<string, NmIon>()
for (const ion of IONS) for (const n of [ion.name, ...ion.otherNames]) if (!BY_NAME.has(nameKey(n))) BY_NAME.set(nameKey(n), ion)

/** The ion with this name (any accepted spelling; a trailing "ion" is allowed), or null. */
export function ionByName(text: string): NmIon | null {
  const key = nameKey(text).replace(/ ion$/, '')
  return BY_NAME.get(key) ?? null
}

/** The ion with this formula text ('Fe3+', 'SO4 2-', 'SO₄²⁻', 'Cl-'), or null. */
export function ionByFormula(text: string): NmIon | null {
  const r = readIon(text)
  if (!r.ok) return null
  for (const reading of r.value) {
    const ion = ionOfReading(reading)
    if (ion) return ion
  }
  return null
}

/** An ion as templates give it: an NmIon, a formula with its charge, or a name. Null when it is not in the model. */
export function resolveIon(ion: IonLike): NmIon | null {
  if (typeof ion !== 'string') return IONS.find((i) => i.text === ion?.text) ?? null
  return ionByFormula(ion) ?? ionByName(ion)
}

/** The same, throwing RangeError for an ion outside the model (a template bug). */
export function nmIon(ion: IonLike): NmIon {
  const found = resolveIon(ion)
  if (!found) throw new RangeError(`${typeof ion === 'string' ? ion : ion?.text} is not an ion of the nomenclature model.`)
  return found
}

/** Display text of an ion: 'Fe³⁺', 'SO₄²⁻'. */
export function ionDisplay(ion: NmIon): string {
  return formulaDisplay(ion.formula) + chargeDisplay(ion.charge)
}

/** LaTeX of an ion: '\mathrm{SO_4^{2-}}'. */
export function ionLatex(ion: NmIon): string {
  return formulaLatex(ion.text)
}

/** A sentence label for an ion: 'the sulfate ion (SO₄²⁻)', 'Fe³⁺'. */
export function ionLabel(ion: NmIon): string {
  return ionDisplay(ion)
}

/** The element name of a monatomic anion's element: chloride → 'chlorine'. */
export function elementNameOf(symbol: string): string {
  return elementBySymbol(symbol)?.name ?? symbol
}

// --- relations between ions (what the slips swap) ----------------------------------------------------

const anionNamed = (name: string) => IONS.find((i) => i.role === 'anion' && nameKey(i.name) === nameKey(name)) ?? null

/** The -ate/-ite partner of an anion that exists in the table: nitrate ↔ nitrite, hydrogen sulfate ↔ hydrogen sulfite. */
export function ateItePartner(ion: NmIon): NmIon | null {
  if (ion.role !== 'anion' || ion.kind !== 'polyatomic') return null
  if (/^(?:per|hypo)/.test(ion.name)) return null
  if (ion.name.endsWith('ate')) return anionNamed(`${ion.name.slice(0, -3)}ite`)
  if (ion.name.endsWith('ite')) return anionNamed(`${ion.name.slice(0, -3)}ate`)
  return null
}

/** The per-/hypo- neighbours in the table: perchlorate → chlorate; chlorate → perchlorate; chlorite → hypochlorite … */
export function perHypoVariants(ion: NmIon): NmIon[] {
  if (ion.role !== 'anion' || ion.kind !== 'polyatomic' || !/(?:ate|ite)$/.test(ion.name)) return []
  const out: (NmIon | null)[] = []
  if (ion.name.startsWith('per')) out.push(anionNamed(ion.name.slice(3)))
  else if (ion.name.startsWith('hypo')) out.push(anionNamed(ion.name.slice(4)))
  else if (ion.name.endsWith('ate')) out.push(anionNamed(`per${ion.name}`))
  else out.push(anionNamed(`hypo${ion.name}`))
  return out.filter((i): i is NmIon => i !== null && i !== ion)
}

const HYDROGEN_FAMILIES: readonly string[][] = [
  ['carbonate', 'hydrogen carbonate'],
  ['sulfate', 'hydrogen sulfate'],
  ['sulfite', 'hydrogen sulfite'],
  ['phosphate', 'hydrogen phosphate', 'dihydrogen phosphate'],
  ['sulfide', 'hydrogen sulfide'],
]

/** The anions that differ from this one only in the hydrogen part of the name: carbonate ↔ hydrogen carbonate … */
export function hydrogenSiblings(ion: NmIon): NmIon[] {
  if (ion.role !== 'anion') return []
  const family = HYDROGEN_FAMILIES.find((f) => f.includes(ion.name))
  if (!family) return []
  return family.filter((n) => n !== ion.name).map((n) => anionNamed(n)).filter((i): i is NmIon => i !== null)
}

const NO_IDE_SLIP = new Set(['acetate', 'oxalate', 'thiocyanate'])

/**
 * The name an -ate/-ite ion gets when -ide is used for it (the -ide of its central element, the hydrogen part
 * kept): sulfate → 'sulfide', nitrate → 'nitride', perchlorate → 'chloride', hydrogen sulfate → 'hydrogen
 * sulfide', carbonate → 'carbide'. Null when the ion has no such slip (acetate, chromate, permanganate …).
 */
export function ideSlipName(ion: NmIon): string | null {
  if (ion.role !== 'anion' || ion.kind !== 'polyatomic' || !/(?:ate|ite)$/.test(ion.name) || NO_IDE_SLIP.has(ion.name)) return null
  const hydrogen = /^((?:di)?hydrogen )/.exec(ion.name)?.[1] ?? ''
  const central = simpleParts(ion.formula).find((p) => p.symbol !== 'H' && p.symbol !== 'O')?.symbol
  const ide = central ? IDE_NAMES[central] : undefined
  return ide ? `${hydrogen}${ide}` : null
}

/** The ion that name is, when it is one (sulfate → S²⁻; hydrogen sulfate → HS⁻); null for carbide and the like. */
export function ideSlipIon(ion: NmIon): NmIon | null {
  const name = ideSlipName(ion)
  return name ? anionNamed(name) : null
}

/** Hg2 2+ and O2 2−: ions whose inner 2 belongs to the ion (never divided out of a formula). */
export function isUnitIon(ion: NmIon): boolean {
  return ion.formula === 'Hg2' || ion.formula === 'O2'
}

/** True for an anion whose acid is a binary acid: F⁻, Cl⁻, Br⁻, I⁻, S²⁻ and CN⁻. */
export function isBinaryAcidAnion(ion: NmIon): boolean {
  return ion.role === 'anion' && BINARY_ACID_ROOTS[ion.text] !== undefined
}

/** True for an anion that forms an oxyacid: an -ate or -ite ion with no hydrogen part in its name. */
export function isOxyacidAnion(ion: NmIon): boolean {
  return ion.role === 'anion' && ion.kind === 'polyatomic' && /(?:ate|ite)$/.test(ion.name) && !/hydrogen/.test(ion.name)
}

/** The display text of an ion's charge for a sentence: '2−'. */
export function ionChargeWords(ion: NmIon): string {
  return `${Math.abs(ion.charge)}${ion.charge > 0 ? '+' : '−'}`
}
