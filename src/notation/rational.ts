/**
 * Exact rationals for solution-set endpoints and answer comparison.
 *
 * Every value returned from this module is normalized: d > 0 and gcd(|n|, d) = 1, so two equal
 * rationals are structurally equal. Parts stay in the JS safe-integer range, which comfortably
 * covers every endpoint a student can type.
 */
import type { Rational } from '@/shared/types'

export type { Rational }

/** Relative tolerance used when snapping floats to simple fractions. */
export const SNAP_TOLERANCE = 1e-9
/** Largest denominator `ratFromNumber` snaps to (twelfths cover thirds, quarters, fifths, sixths). */
export const SNAP_MAX_DENOMINATOR = 12

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

/** Build a normalized rational n/d. Throws on non-integer parts or a zero denominator. */
export function rat(n: number, d = 1): Rational {
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    throw new RangeError(`rat() needs integer parts, got ${n}/${d}`)
  }
  if (d === 0) throw new RangeError('rat() denominator cannot be 0')
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) {
    throw new RangeError(`rat() parts are outside the safe-integer range: ${n}/${d}`)
  }
  let num = n
  let den = d
  if (den < 0) {
    num = -num
    den = -den
  }
  const g = gcd(num, den) || 1
  const nn = num / g
  return { n: nn === 0 ? 0 : nn, d: den / g }
}

export function isRational(v: unknown): v is Rational {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { n?: unknown }).n === 'number' &&
    typeof (v as { d?: unknown }).d === 'number'
  )
}

export function ratEquals(a: Rational, b: Rational): boolean {
  return a.n * b.d === b.n * a.d
}

export function ratCompare(a: Rational, b: Rational): -1 | 0 | 1 {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}

export function ratToNumber(r: Rational): number {
  return r.n / r.d
}

/** "-7/4", "3", "0". */
export function ratToString(r: Rational): string {
  return r.d === 1 ? `${r.n}` : `${r.n}/${r.d}`
}

/** "-\frac{7}{4}", "3". */
export function ratToLatex(r: Rational): string {
  if (r.d === 1) return `${r.n}`
  const sign = r.n < 0 ? '-' : ''
  return `${sign}\frac{${Math.abs(r.n)}}{${r.d}}`
}

export function ratNeg(r: Rational): Rational {
  return rat(-r.n, r.d)
}

export function ratAbs(r: Rational): Rational {
  return rat(Math.abs(r.n), r.d)
}

export function ratAdd(a: Rational, b: Rational): Rational {
  return rat(a.n * b.d + b.n * a.d, a.d * b.d)
}

export function ratSub(a: Rational, b: Rational): Rational {
  return rat(a.n * b.d - b.n * a.d, a.d * b.d)
}

export function ratMul(a: Rational, b: Rational): Rational {
  return rat(a.n * b.n, a.d * b.d)
}

export function ratDiv(a: Rational, b: Rational): Rational {
  if (b.n === 0) throw new RangeError('division by zero')
  return rat(a.n * b.d, a.d * b.n)
}

export function ratMidpoint(a: Rational, b: Rational): Rational {
  return rat(a.n * b.d + b.n * a.d, 2 * a.d * b.d)
}

export function ratIsInteger(r: Rational): boolean {
  return r.d === 1
}

export function ratFloor(r: Rational): number {
  return Math.floor(r.n / r.d)
}

export function ratCeil(r: Rational): number {
  return Math.ceil(r.n / r.d)
}

export function ratMin(a: Rational, b: Rational): Rational {
  return ratCompare(a, b) <= 0 ? a : b
}

export function ratMax(a: Rational, b: Rational): Rational {
  return ratCompare(a, b) >= 0 ? a : b
}

/** Exact value of a decimal digit string such as "0.75", "2.", ".5", "10". */
function decimalToRational(digits: string): Rational | null {
  const [intPart = '', fracRaw = ''] = digits.split('.')
  const frac = fracRaw.replace(/0+$/, '')
  const whole = `${intPart}${frac}`.replace(/^0+(?=\d)/, '') || '0'
  if (whole.length > 15) return null
  const n = Number(whole)
  const d = 10 ** frac.length
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) return null
  return rat(n, d)
}

/**
 * Parse what a student types as an endpoint: "-7/4", "3", "+3", "0.75", "2.5", ".5", "(-7/4)".
 * Unicode minus signs are accepted. Returns null for anything else (including "3/0").
 */
export function ratFromString(text: string): Rational | null {
  let s = text.trim().replace(/[−–—]/g, '-').replace(/\s+/g, '')
  const paren = s.match(/^\((.*)\)$/)
  if (paren) s = paren[1]!
  const m = s.match(/^([+-]?)(\d+\.?\d*|\.\d+)(?:\/([+-]?)(\d+))?$/)
  if (!m) return null
  const num = decimalToRational(m[2]!)
  if (!num) return null
  let r = m[1] === '-' ? ratNeg(num) : num
  if (m[4] !== undefined) {
    const den = Number(m[4])
    if (!Number.isSafeInteger(den) || den === 0) return null
    r = ratDiv(r, rat(m[3] === '-' ? -den : den))
  }
  return r
}

function continuedFraction(x: number, maxDen: number): Rational {
  let h1 = 1
  let h0 = 0
  let k1 = 0
  let k0 = 1
  let b = x
  const tol = SNAP_TOLERANCE * Math.max(1, Math.abs(x))
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(b)
    const h2 = a * h1 + h0
    const k2 = a * k1 + k0
    if (k2 > maxDen || !Number.isSafeInteger(h2) || !Number.isSafeInteger(k2)) break
    h0 = h1
    h1 = h2
    k0 = k1
    k1 = k2
    const frac = b - a
    if (Math.abs(h1 / k1 - x) <= tol || frac < 1e-15) break
    b = 1 / frac
  }
  return rat(h1, k1 || 1)
}

/**
 * Snap a float to the simplest fraction with denominator <= maxDenominator when it is within 1e-9
 * (relative); otherwise keep it exact as the shortest decimal expansion that reproduces it.
 * Throws on NaN / ±Infinity — those are not rationals (callers guard with Number.isFinite).
 */
export function ratFromNumber(value: number, maxDenominator = SNAP_MAX_DENOMINATOR): Rational {
  if (!Number.isFinite(value)) throw new RangeError(`cannot make a rational from ${value}`)
  const tol = SNAP_TOLERANCE * Math.max(1, Math.abs(value))
  for (let d = 1; d <= maxDenominator; d++) {
    const n = Math.round(value * d)
    if (Number.isSafeInteger(n) && Math.abs(n / d - value) <= tol) return rat(n, d)
  }
  for (let k = 1; k <= 12; k++) {
    const scale = 10 ** k
    const n = Math.round(value * scale)
    if (!Number.isSafeInteger(n)) break
    if (Math.abs(n / scale - value) <= tol) return rat(n, scale)
  }
  return continuedFraction(value, 1e9)
}
