/**
 * Exact decimal arithmetic for the isotope calculations, on the significant-figures engine's BigInt
 * rationals. No float ever touches a mass or an abundance.
 */
import {
  decToPlain,
  ratAdd,
  ratCmp,
  ratDiv,
  ratEq,
  ratFromDec,
  ratMul,
  ratSub,
  ratToDisplay,
  roundRatToPlace,
  type Rat,
} from '../sigfigs/decimal'

export type { Rat }
export { ratAdd, ratCmp, ratDiv, ratEq, ratMul, ratSub }

export const R0: Rat = { n: 0n, d: 1n }
export const R100: Rat = { n: 100n, d: 1n }

/** Plain non-negative decimal text ("34.969", "100", ".5") → exact rational. Throws on anything else (data, not input). */
export function ratFromText(text: string): Rat {
  const m = /^(\d*)(?:\.(\d*))?$/.exec(text.trim())
  if (!m || (m[1] === '' && (m[2] ?? '') === '')) throw new Error(`atoms: not a plain decimal: ${text}`)
  const frac = m[2] ?? ''
  return ratFromDec({ int: BigInt((m[1] || '0') + frac), exp: -frac.length })
}

export function ratFromInt(n: number): Rat {
  return { n: BigInt(n), d: 1n }
}

export function ratSum(values: Rat[]): Rat {
  return values.reduce((a, b) => ratAdd(a, b), R0)
}

/** Value rounded half-up to a place, as a rational. */
export function roundedAt(r: Rat, place: number): Rat {
  const x = roundRatToPlace(r, place)
  return ratFromDec({ int: x.m, exp: place })
}

/** Value chopped at a place, as a rational. */
export function choppedAt(r: Rat, place: number): Rat {
  const x = roundRatToPlace(r, place)
  return ratFromDec({ int: x.truncM, exp: place })
}

/** Plain text of r rounded to a place, every digit shown down to that place: (35.453…, −2) → "35.45". */
export function textAt(r: Rat, place: number): string {
  const x = roundRatToPlace(r, place)
  return decToPlain({ int: x.m, exp: place })
}

/** Would rounding (or chopping) r at `place` give exactly v? */
export function consistentAt(v: Rat, place: number, r: Rat): boolean {
  return ratEq(v, roundedAt(r, place)) || ratEq(v, choppedAt(r, place))
}

/** Calculator-style display: every digit when it terminates, else 10 figures and "…". */
export function display(r: Rat): string {
  return ratToDisplay(r, 10).text
}

/** Unicode minus for sentences. */
export function minusText(text: string): string {
  return text.replace(/^-/, '−')
}

/** Number of digits after the point in a plain decimal text: "34.969" → 3, "100" → 0. */
export function decimalsOf(text: string): number {
  const i = text.indexOf('.')
  return i < 0 ? 0 : text.length - i - 1
}

/**
 * Percent text → decimal fraction text by moving the point two places, keeping every written digit:
 * "75.76" → "0.7576", "10.00" → "0.1000", "7.59" → "0.0759", "0.0115" → "0.000115", "100" → "1.00".
 */
export function percentToDecimalText(text: string): string {
  const t = text.trim()
  if (!/^\d+(\.\d+)?$/.test(t)) throw new Error(`atoms: not a percent: ${text}`)
  const [whole = '', frac = ''] = t.split('.')
  const digits = whole + frac
  // The point moves two places left: it now sits after (whole.length - 2) digits.
  const pointAt = whole.length - 2
  const padded = pointAt < 1 ? '0'.repeat(1 - pointAt) + digits : digits
  const at = Math.max(pointAt, 1)
  const intPart = padded.slice(0, at).replace(/^0+(?=\d)/, '')
  const fracPart = padded.slice(at)
  return fracPart === '' ? intPart : `${intPart}.${fracPart}`
}

/** Is the tie exactly half a unit at this place? */
export function isTieAt(r: Rat, place: number): boolean {
  return roundRatToPlace(r, place).tie
}

export function ratIsBetween(r: Rat, lo: Rat, hi: Rat): boolean {
  return ratCmp(r, lo) >= 0 && ratCmp(r, hi) <= 0
}
