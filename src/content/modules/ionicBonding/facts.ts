/**
 * Chapter 8 facts: which elements the templates may draw, and the arithmetic of one electron
 * transfer. Charges come from the element table (`commonCharges`), configurations from the
 * econfig engine, and formula units from the nomenclature engine — nothing here re-derives them.
 *
 * Exclusions (messy behaviour stays out of the draw; docs/progress/chem-bonding.md):
 *  - H: its two taught charges and bare-proton cation mislead every question of this chapter.
 *  - He and the other noble gases: no ion to form (neutral noble gases do appear in dot counts).
 *  - Transition metals, metalloids, C and Si: no single clean noble-gas ion in `commonCharges`.
 *  - Sn and Pb: two charges, and neither ion is a noble-gas configuration.
 *  - Fr and Ra: radioactive, and reserved for rule-card examples so the cards never leak answers.
 *  - Ion-configuration parts stay within Z ≤ 36, the econfig engine's model.
 */
import { configurationText, ionicFormula } from '@/engine'
import { ELEMENTS, elementByZ, type ElementInfo } from '@/engine/chem/elements'

/** Kept out of every chapter 8 draw so rule cards and catalog examples can use them. */
export const IB_RESERVED_SYMBOLS: readonly string[] = ['Fr', 'Ra']

export function ibElement(z: number): ElementInfo {
  const el = elementByZ(z)
  if (!el) throw new Error(`ionicBonding: no element Z ${z}`)
  return el
}

/** The one taught charge of a single-charge main-group element. Throws elsewhere. */
export function chargeOf(z: number): number {
  const el = ibElement(z)
  if (el.commonCharges.length !== 1) throw new Error(`ionicBonding: ${el.symbol} has no single taught charge`)
  return el.commonCharges[0]!
}

/** Valence electrons of a main-group atom. Helium is 2; d- and f-block atoms are not this chapter's. */
export function ibValence(el: ElementInfo): number | null {
  if (el.symbol === 'He') return 2
  if (el.group == null) return null
  if (el.group === 1 || el.group === 2) return el.group
  if (el.group >= 13 && el.group <= 18) return el.group - 10
  return null
}

function nobleGasElectrons(n: number): boolean {
  return n === 2 || n === 10 || n === 18 || n === 36 || n === 54
}

/** One single taught charge, a main-group column, and a noble-gas ion. */
function cleanIon(el: ElementInfo): boolean {
  if (el.symbol === 'H' || IB_RESERVED_SYMBOLS.includes(el.symbol)) return false
  if (ibValence(el) == null || el.commonCharges.length !== 1) return false
  return nobleGasElectrons(el.z - el.commonCharges[0]!)
}

/** Atom-to-ion walks, kept at Z ≤ 36 so the econfig engine can write the ion's shorthand. */
export const VALENCE_POOL: readonly ElementInfo[] = ELEMENTS.filter((el) => el.z <= 36 && cleanIon(el))

/** Neutral atoms for dot symbols: main group, Z ≤ 36, without H and He. */
export const DOTS_NEUTRAL_POOL: readonly ElementInfo[] = ELEMENTS.filter(
  (el) => el.z <= 36 && el.symbol !== 'H' && el.symbol !== 'He' && !IB_RESERVED_SYMBOLS.includes(el.symbol) && ibValence(el) != null,
)

/** Simple ions for dot symbols: every clean single-charge noble-gas ion, heavier rows included. */
export const DOTS_ION_POOL: readonly ElementInfo[] = ELEMENTS.filter(cleanIon)

/** Metals of the transfer templates: groups 1 and 2 plus aluminum, one positive charge each. */
export const TRANSFER_METALS: readonly ElementInfo[] = ELEMENTS.filter((el) => cleanIon(el) && el.commonCharges[0]! > 0)

/** Nonmetals of the transfer templates: one negative charge each. */
export const TRANSFER_NONMETALS: readonly ElementInfo[] = ELEMENTS.filter((el) => cleanIon(el) && el.commonCharges[0]! < 0)

/**
 * Formula units the shared catalog prints in its wrong → right examples. The formula template
 * never asks for them, so every catalog example line can be shown while she answers (the ch7 rule).
 */
export const RESERVED_FORMULAS: readonly string[] = ['NaCl', 'MgO', 'Al2O3', 'KCl', 'CaCl2', 'KF']

export interface TransferPair {
  metal: ElementInfo
  nonmetal: ElementInfo
}

/** Every metal + nonmetal pair the transfer template may draw, catalog-example compounds excluded. */
export const TRANSFER_PAIRS: readonly TransferPair[] = TRANSFER_METALS.flatMap((metal) =>
  TRANSFER_NONMETALS.filter((nonmetal) => !RESERVED_FORMULAS.includes(ionicFormula(`${metal.symbol}^${ibChargeText(metal.commonCharges[0]!)}`, `${nonmetal.symbol}^${ibChargeText(nonmetal.commonCharges[0]!)}`))).map((nonmetal) => ({ metal, nonmetal })),
)

/** Familiar solid metals for the electron-sea prompts (mercury, liquid, stays out). */
export const SEA_METALS: readonly string[] = [
  'lithium',
  'sodium',
  'potassium',
  'magnesium',
  'calcium',
  'barium',
  'aluminum',
  'titanium',
  'chromium',
  'iron',
  'cobalt',
  'nickel',
  'copper',
  'zinc',
  'silver',
  'tin',
  'tungsten',
  'platinum',
  'gold',
  'lead',
]

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

export function lcm(a: number, b: number): number {
  return (Math.abs(a) / gcd(a, b)) * Math.abs(b)
}

/** '+', '2+', '-', '3-' (the nomenclature app-text order). */
export function ibChargeText(charge: number): string {
  const size = Math.abs(charge)
  return `${size === 1 ? '' : size}${charge > 0 ? '+' : '-'}`
}

/** App text of the taught ion: 'Na^+', 'O^2-'. */
export function ionTextOf(z: number): string {
  return `${ibElement(z).symbol}^${ibChargeText(chargeOf(z))}`
}

/** Cations : anions per formula unit, in lowest terms. */
export function ratioOf(cationZ: number, anionZ: number): { cations: number; anions: number } {
  const cm = Math.abs(chargeOf(cationZ))
  const am = Math.abs(chargeOf(anionZ))
  const g = gcd(cm, am)
  return { cations: am / g, anions: cm / g }
}

/** Electrons transferred in one formula unit: the charge the two sides cancel. */
export function transferCount(cationZ: number, anionZ: number): number {
  return lcm(Math.abs(chargeOf(cationZ)), Math.abs(chargeOf(anionZ)))
}

/** Dots on the electron-dot symbol: the outer shell as it is now. */
export function dotsOf(z: number, charge: number): number {
  if (charge > 0) return 0
  if (charge < 0) return 8
  const valence = ibValence(ibElement(z))
  if (valence == null) throw new Error(`ionicBonding: no dot count for Z ${z}`)
  return valence
}

/** The neutral atom's full configuration, app text, for the read-a-configuration prompts (Z ≤ 36). */
export function atomConfigText(z: number): string {
  return configurationText({ z })
}

/** The ion's noble-gas shorthand, app text — the electrons module's own format. */
export function ionConfigText(z: number): string {
  return configurationText({ z, charge: chargeOf(z) }, { form: 'shorthand' })
}

/**
 * True when `text` contains `answer` as its own token or phrase. A digit inside a longer number
 * does not count, and a letter inside a word does not count. (The shared leak rule; the same
 * check the periodic module uses.)
 */
export function answerLeaks(text: string, answer: string): boolean {
  const norm = (s: string) => s.replace(/−/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()
  const ans = norm(answer)
  if (!ans) return false
  const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(norm(text))
}

/** 'sodium' → 'Sodium' for a sentence start. */
export function capName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}
