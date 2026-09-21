/**
 * Atoms and ions: counts, names, notation text, and parsing of what she types into the small answer
 * boxes. Pure; element facts come only from `engine/chem/elements.ts`.
 *
 *   protons = Z        neutrons = A − Z        electrons = Z − charge
 */
import type { AtomParticle, AtomParticleCounts, ParseError } from '@/shared/types'
import { elementBySymbol, elementByZ, ELEMENTS, type ElementInfo } from '../chem/elements'

export function particleCounts(p: AtomParticle): AtomParticleCounts {
  return { protons: p.z, neutrons: p.massNumber - p.z, electrons: p.z - p.charge }
}

/** The particle whose nucleus and electron cloud have these counts. Throws when no element has that many protons. */
export function particleFromCounts(c: AtomParticleCounts): AtomParticle {
  const el = elementByZ(c.protons)
  if (!el) throw new Error(`no element has ${c.protons} protons`)
  return { symbol: el.symbol, z: el.z, massNumber: c.protons + c.neutrons, charge: c.protons - c.electrons }
}

/** Throws on a particle a generator should never produce (unknown element, symbol/Z mismatch, A < Z, negative electrons). */
export function assertParticle(p: AtomParticle): ElementInfo {
  const el = elementBySymbol(p.symbol)
  if (!el || el.z !== p.z) throw new Error(`atoms: ${p.symbol} is not element ${p.z}`)
  if (!Number.isInteger(p.massNumber) || p.massNumber < p.z) throw new Error(`atoms: mass number ${p.massNumber} < Z for ${p.symbol}`)
  if (!Number.isInteger(p.charge) || p.z - p.charge < 0) throw new Error(`atoms: charge ${p.charge} leaves negative electrons`)
  return el
}

export function elementNameOf(z: number): string {
  return elementByZ(z)?.name ?? `element ${z}`
}

/** "chlorine-37" */
export function hyphenName(p: Pick<AtomParticle, 'z' | 'massNumber'>): string {
  return `${elementNameOf(p.z)}-${p.massNumber}`
}

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '−': '⁻', '-': '⁻' }
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉' }

export function superscript(text: string): string {
  return [...text].map((ch) => SUP[ch] ?? ch).join('')
}

export function subscript(text: string): string {
  return [...text].map((ch) => SUB[ch] ?? ch).join('')
}

/** Charge as chemists write it on the symbol: 0 → '', 1 → '+', −1 → '−', 2 → '2+', −3 → '3−'. */
export function chargeText(c: number): string {
  if (c === 0) return ''
  const mag = Math.abs(c) === 1 ? '' : String(Math.abs(c))
  return `${mag}${c > 0 ? '+' : '−'}`
}

/** Charge with its size always shown, for sentences: 1 → "1+", −2 → "2−". */
export function chargeLabel(c: number): string {
  return c === 0 ? "0" : `${Math.abs(c)}${c > 0 ? "+" : "−"}`
}

/** "a 2+ charge", "a 1− charge", "no charge". */
export function chargeWords(c: number): string {
  if (c === 0) return 'no charge'
  return `a ${Math.abs(c)}${c > 0 ? '+' : '−'} charge`
}

/** Signed charge as a number in a sentence: 2 → '+2', −1 → '−1', 0 → '0'. */
export function signedNumber(n: number): string {
  if (n === 0) return '0'
  return n > 0 ? `+${n}` : `−${-n}`
}

/** "Cl⁻", "Mg²⁺", "Na" (no charge). */
export function formulaText(p: Pick<AtomParticle, 'symbol' | 'charge'>): string {
  return `${p.symbol}${superscript(chargeText(p.charge))}`
}

/** "³⁷₁₇Cl⁻" for plain-text sentences. */
export function nuclearSymbolText(p: AtomParticle): string {
  return `${superscript(String(p.massNumber))}${subscript(String(p.z))}${formulaText(p)}`
}

/** KaTeX for a nuclear symbol: {}^{37}_{17}\mathrm{Cl}^{-}. Letters of the symbol are ASCII. */
export function nuclearSymbolLatex(p: { symbol: string; z: number | string; massNumber: number | string; charge: number }): string {
  const charge = chargeText(p.charge).replace('−', '-')
  const sym = /^[A-Za-z]{1,3}$/.test(p.symbol) ? p.symbol : '?'
  return `{}^{${p.massNumber}}_{${p.z}}\\mathrm{${sym}}${charge ? `^{${charge}}` : ''}`
}

// ---------------------------------------------------------------------------
// Parsing what she types (never throws: problems come back as a ParseError)
// ---------------------------------------------------------------------------

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: ParseError }

function fail<T>(message: string, position = 0, length?: number): Parsed<T> {
  return { ok: false, error: length === undefined ? { message, position } : { message, position, length } }
}

/** A whole number for a box ("17", " 20 "). `empty` is the message for a blank box. */
export function parseWholeNumber(text: string, empty: string): Parsed<number> {
  const lead = text.length - text.trimStart().length
  const t = text.trim()
  if (t === '') return fail(empty)
  if (/^[-−]/.test(t)) return fail('This number counts particles, so it can’t be negative.', lead, 1)
  const bad = t.search(/[^0-9]/)
  if (bad >= 0) return fail('Type a whole number here, like 17.', lead + bad, 1)
  if (t.length > 3) return fail('That is far bigger than any atom’s numbers.', lead, t.length)
  return { ok: true, value: Number(t) }
}

/**
 * Charge as written on a symbol or as a signed number: "2-", "2−", "-2", "+", "−", "3+", "+1", "0".
 * Blank means neutral.
 */
export function parseChargeText(text: string): Parsed<number> {
  const lead = text.length - text.trimStart().length
  const t = text.trim().replace(/\s+/g, '').replace(/[−–—]/g, '-')
  if (t === '' || t === '0' || t === '+0' || t === '-0') return { ok: true, value: 0 }
  const m = /^([+-])?(\d{1,2})?([+-])?$/.exec(t)
  if (!m || (m[1] && m[3]) || (!m[1] && !m[3])) {
    if (m && m[2] && !m[1] && !m[3]) return fail('Give the charge a sign: 2+ for positive, 2- for negative.', lead + t.length, 0)
    const bad = t.search(/[^0-9+-]/)
    return fail('Write the charge like 2+, 3-, + or - (leave it blank for a neutral atom).', bad >= 0 ? lead + bad : lead, bad >= 0 ? 1 : t.length)
  }
  const sign = (m[1] ?? m[3]) === '-' ? -1 : 1
  const mag = m[2] === undefined ? 1 : Number(m[2])
  return { ok: true, value: sign * mag || 0 }
}

export interface SymbolReading {
  typed: string
  /** The element whose symbol matches exactly, case included. */
  exact?: ElementInfo
  /** The element whose symbol matches when case is ignored. */
  loose?: ElementInfo
  /** The element whose NAME she typed. */
  byName?: ElementInfo
}

/** An element symbol: letters only. Anything that is not an element comes back with no match (a grading matter). */
export function parseSymbolText(text: string): Parsed<SymbolReading> {
  const lead = text.length - text.trimStart().length
  const t = text.trim()
  if (t === '') return fail('Type the element symbol, like Na.')
  const bad = t.search(/[^A-Za-z]/)
  if (bad >= 0) return fail('The symbol is just letters, like Na or O. The numbers and the charge have their own boxes.', lead + bad, 1)
  const lower = t.toLowerCase()
  const reading: SymbolReading = { typed: t }
  const exact = ELEMENTS.find((e) => e.symbol === t)
  const loose = ELEMENTS.find((e) => e.symbol.toLowerCase() === lower)
  const byName = ELEMENTS.find((e) => e.name === lower || (lower === 'aluminium' && e.symbol === 'Al') || (lower === 'sulphur' && e.symbol === 'S'))
  if (exact) reading.exact = exact
  if (loose) reading.loose = loose
  if (byName) reading.byName = byName
  return { ok: true, value: reading }
}

/** "1 electron", "3 electrons". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}
