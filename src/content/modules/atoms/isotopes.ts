/**
 * Which isotopes and ions the atomic-structure problems may use. Nothing here is invented:
 *
 * - isotopes come from `NATURAL_ISOTOPES` and `NOTABLE_ISOTOPES` (engine/chem/elements.ts), plus the
 *   stable isotopes in `STABLE_ISOTOPES` below (a fixed list of common stable nuclides);
 * - ion charges come only from `ELEMENTS[].commonCharges`;
 * - ion names follow the standard naming rules (-ide for a monatomic anion, a Roman numeral for a
 *   metal taught with more than one charge).
 */
import { elementBySymbol, NATURAL_ISOTOPES, NOTABLE_ISOTOPES, type ElementInfo } from '@/engine/chem/elements'

export interface IsotopeRef {
  symbol: string
  massNumber: number
}

/** Stable isotopes this module may add beyond the engine's tables (element symbol, mass number). */
export const STABLE_ISOTOPES: readonly IsotopeRef[] = [
  { symbol: 'F', massNumber: 19 },
  { symbol: 'Ne', massNumber: 20 },
  { symbol: 'Na', massNumber: 23 },
  { symbol: 'Al', massNumber: 27 },
  { symbol: 'P', massNumber: 31 },
  { symbol: 'S', massNumber: 32 },
  { symbol: 'Ar', massNumber: 40 },
  { symbol: 'Ca', massNumber: 40 },
  { symbol: 'Sc', massNumber: 45 },
  { symbol: 'Mn', massNumber: 55 },
  { symbol: 'Fe', massNumber: 56 },
  { symbol: 'Co', massNumber: 59 },
  { symbol: 'Ni', massNumber: 58 },
  { symbol: 'Zn', massNumber: 64 },
  { symbol: 'As', massNumber: 75 },
  { symbol: 'Y', massNumber: 89 },
  { symbol: 'I', massNumber: 127 },
  { symbol: 'Cs', massNumber: 133 },
  { symbol: 'Au', massNumber: 197 },
  { symbol: 'Bi', massNumber: 209 },
]

export interface PoolIsotope extends IsotopeRef {
  element: ElementInfo
  /** One short sentence from NOTABLE_ISOTOPES, when the isotope is one students meet by name. */
  note?: string
}

function buildPool(): PoolIsotope[] {
  const refs: IsotopeRef[] = []
  for (const [symbol, list] of Object.entries(NATURAL_ISOTOPES)) for (const iso of list) refs.push({ symbol, massNumber: iso.massNumber })
  for (const n of NOTABLE_ISOTOPES) refs.push({ symbol: n.symbol, massNumber: n.massNumber })
  refs.push(...STABLE_ISOTOPES)
  const out: PoolIsotope[] = []
  for (const r of refs) {
    if (out.some((o) => o.symbol === r.symbol && o.massNumber === r.massNumber)) continue
    const element = elementBySymbol(r.symbol)
    if (!element) throw new Error(`atoms: unknown element ${r.symbol}`)
    const notable = NOTABLE_ISOTOPES.find((n) => n.symbol === r.symbol && n.massNumber === r.massNumber)
    const entry: PoolIsotope = { symbol: r.symbol, massNumber: r.massNumber, element }
    if (notable) entry.note = notable.note
    out.push(entry)
  }
  return out.sort((a, b) => a.element.z - b.element.z || a.massNumber - b.massNumber)
}

/** Every isotope a problem may show, sorted by Z then A. */
export const ISOTOPE_POOL: readonly PoolIsotope[] = buildPool()

export function isPoolIsotope(symbol: string, massNumber: number): boolean {
  return ISOTOPE_POOL.some((i) => i.symbol === symbol && i.massNumber === massNumber)
}

/** Exact comparison of two plain non-negative decimal texts ("7.59" < "92.41"), by digits, no floats. */
export function compareDecimalText(a: string, b: string): number {
  const [ai = '', af = ''] = a.split('.')
  const [bi = '', bf = ''] = b.split('.')
  const aInt = ai.replace(/^0+(?=\d)/, '')
  const bInt = bi.replace(/^0+(?=\d)/, '')
  if (aInt.length !== bInt.length) return aInt.length < bInt.length ? -1 : 1
  const width = Math.max(af.length, bf.length)
  const x = aInt + af.padEnd(width, '0')
  const y = bInt + bf.padEnd(width, '0')
  return x < y ? -1 : x > y ? 1 : 0
}

/** Monatomic anion names (-ide), for the elements whose taught charges include a negative one. */
const ANION_NAMES: Readonly<Record<string, string>> = {
  H: 'hydride',
  N: 'nitride',
  O: 'oxide',
  F: 'fluoride',
  P: 'phosphide',
  S: 'sulfide',
  Cl: 'chloride',
  Br: 'bromide',
  I: 'iodide',
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/**
 * "sodium ion", "iron(III) ion", "sulfide ion". Throws when the charge is not one the element is
 * taught with (the data rule), or when an anion has no name in the table above.
 */
export function ionName(el: ElementInfo, charge: number): string {
  if (charge === 0 || !el.commonCharges.includes(charge)) throw new Error(`atoms: ${el.symbol} is not taught with charge ${charge}`)
  if (charge < 0) {
    const name = ANION_NAMES[el.symbol]
    if (!name) throw new Error(`atoms: no anion name for ${el.symbol}`)
    return `${name} ion`
  }
  const positives = el.commonCharges.filter((c) => c > 0)
  return positives.length > 1 ? `${el.name}(${ROMAN[charge]}) ion` : `${el.name} ion`
}

/** Can this element form an ion with a name we know, for the given sign? Hydrogen ions are left out (a bare proton / hydride confuses chapter 4). */
export function ionCharges(el: ElementInfo, sign: 1 | -1 | 0 = 0): number[] {
  if (el.symbol === 'H') return []
  return el.commonCharges.filter((c) => (sign === 0 ? true : Math.sign(c) === sign) && (c > 0 || ANION_NAMES[el.symbol] !== undefined))
}
