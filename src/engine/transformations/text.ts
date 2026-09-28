/**
 * Number and formula text for the transformations core.
 *
 * Convention (same as the functions core): fields named `text`, `formula`, `condition` are ASCII app syntax
 * that the parser reads back ("-2(x - 3)^2 + 1", "x >= 2"). Sentences (witnesses, messages, steps) are
 * display text with the unicode minus sign, made with `pretty`.
 */
import type { Rational } from '@/shared/types'
import { rat, ratAbs, ratFromString, ratToString } from '@/notation/rational'
import { exactLiteral, Unsupported } from '../functions/exact'
import { pretty } from '../functions/text'
import type { ExactPoint, PointLike, RatLike } from './types'

export { pretty }

/** A Rational, a JS number (read exactly as written: 0.1 is 1/10) or text ("-7/4", "0.5") → Rational; null if unreadable. */
export function toRational(v: RatLike): Rational | null {
  if (typeof v === 'string') return ratFromString(v)
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    try {
      return exactLiteral(v)
    } catch (e) {
      if (e instanceof Unsupported) return null
      throw e
    }
  }
  if (typeof v !== 'object' || v === null || !Number.isSafeInteger(v.n) || !Number.isSafeInteger(v.d) || v.d === 0) return null
  return rat(v.n, v.d)
}

/** Both coordinates readable → an ExactPoint, else null. */
export function toPoint(p: PointLike): ExactPoint | null {
  const x = toRational(p.x)
  const y = toRational(p.y)
  return x && y ? { x, y } : null
}

/** ASCII text of a rational: "3", "-1/2". */
export function rt(r: Rational): string {
  return ratToString(r)
}

/** Display text of a rational: "−1/2". */
export function rp(r: Rational): string {
  return pretty(ratToString(r))
}

/** Display text of a rational as a factor or operand: negatives and fractions in parentheses, "(−2)", "(1/2)". */
export function rf(r: Rational): string {
  return r.n < 0 || r.d !== 1 ? `(${rp(r)})` : rp(r)
}

/** ASCII point "(4, -1)". */
export function pointText(p: ExactPoint): string {
  return `(${rt(p.x)}, ${rt(p.y)})`
}

/** Display point "(4, −1)". */
export function pointPretty(p: ExactPoint): string {
  return pretty(pointText(p))
}

export function isOne(r: Rational): boolean {
  return r.n === 1 && r.d === 1
}

export function isMinusOne(r: Rational): boolean {
  return r.n === -1 && r.d === 1
}

/**
 * The coefficient in front of a factor, app syntax: 1 → '', −1 → '-', 2 → '2', −2 → '-2',
 * 1/2 → '(1/2)', −1/2 → '-(1/2)'.
 */
export function coefPrefix(r: Rational): string {
  if (isOne(r)) return ''
  if (isMinusOne(r)) return '-'
  const abs = ratAbs(r)
  const body = abs.d === 1 ? `${abs.n}` : `(${ratToString(abs)})`
  return r.n < 0 ? `-${body}` : body
}

/** A constant term added at the end, app syntax: 0 → '', 1 → ' + 1', −4 → ' - 4', 1/2 → ' + 1/2'. */
export function signedTerm(r: Rational): string {
  if (r.n === 0) return ''
  return r.n > 0 ? ` + ${ratToString(r)}` : ` - ${ratToString(ratAbs(r))}`
}

/** "x" (h = 0), "x - 3" (h = 3), "x + 1/2" (h = −1/2), app syntax. */
export function xMinus(h: Rational): string {
  return `x${signedTerm(rat(-h.n, h.d))}`
}

/** a + b as display text with the sign folded in: "4 + 3", "4 − 3", "−2 − 1/2". */
export function plusText(a: string, b: Rational): string {
  if (b.n === 0) return a
  return b.n > 0 ? `${a} + ${rp(b)}` : `${a} − ${rp(ratAbs(b))}`
}

/** "right 3" / "left 3" for a horizontal shift h; "up 1" / "down 1" for a vertical shift. */
export function shiftWords(v: Rational, axis: 'h' | 'v'): string {
  const dir = axis === 'h' ? (v.n > 0 ? 'right' : 'left') : v.n > 0 ? 'up' : 'down'
  return `${dir} ${rp(ratAbs(v))}`
}
