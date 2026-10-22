/**
 * How the grapher writes a number: exact for integers and simple fractions (1/3, −5/2; a fraction whose decimal ends,
 * like 1/4, is written 0.25), otherwise rounded to what fits a label (about five significant digits, at least one
 * decimal so a rounded value never looks exact), and in scientific notation when it is very large or very small.
 * Negative numbers take the true minus sign (−), which screen readers read as "minus". Pure.
 */

export const MINUS = '−'

/** The largest denominator that still counts as a simple fraction. */
export const SIMPLE_DENOMINATOR = 12

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
}

function sign(text: string, negative: boolean): string {
  return negative ? `${MINUS}${text}` : text
}

/** A denominator whose fractions end as decimals (only 2s and 5s in it). */
function terminates(d: number): boolean {
  let n = d
  while (n % 2 === 0) n /= 2
  while (n % 5 === 0) n /= 5
  return n === 1
}

/** The integer or simple fraction p/q (q ≤ 12) that v is, within a relative tolerance; null when it is neither. */
export function asSimpleFraction(v: number, relTol = 1e-9): { n: number; d: number } | null {
  if (!Number.isFinite(v)) return null
  const tol = relTol * Math.max(1, Math.abs(v))
  // Past a million a fraction's twelfths are finer than the tolerance: only whole numbers count there.
  const dMax = Math.abs(v) < 1e6 ? SIMPLE_DENOMINATOR : 1
  for (let d = 1; d <= dMax; d++) {
    const n = Math.round(v * d)
    if (Math.abs(v - n / d) <= tol && Math.abs(n) < 1e15) return { n, d }
  }
  return null
}

function integerText(n: number): string {
  if (Math.abs(n) >= 1e9) return scientific(n)
  return sign(String(Math.abs(n)), n < 0)
}

/** "1.2346 × 10⁻⁵": four decimals in the mantissa, trailing zeros dropped. */
export function scientific(v: number, digits = 4): string {
  if (v === 0) return '0'
  const negative = v < 0
  const [mantissa, exponent] = Math.abs(v).toExponential(digits).split('e') as [string, string]
  const m = mantissa.includes('.') ? mantissa.replace(/0+$/, '').replace(/\.$/, '') : mantissa
  const e = String(Number(exponent))
  const sup = [...e].map((c) => SUPERSCRIPT[c] ?? c).join('')
  return sign(`${m} × 10${sup}`, negative)
}

/** Exact text for an integer or a simple fraction, else null. */
export function exactText(v: number): string | null {
  const f = asSimpleFraction(v)
  if (!f) return null
  if (f.d === 1) return integerText(f.n)
  const negative = f.n < 0
  if (terminates(f.d)) {
    // 1/4 is 0.25 exactly; at most three decimals for denominators up to 12 (1/8).
    const text = (Math.abs(f.n) / f.d).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
    return sign(text, negative)
  }
  return sign(`${Math.abs(f.n)}/${f.d}`, negative)
}

/**
 * A coordinate, a table value or a slider value for a person to read. NaN is "undefined" (the TI-84 says ERROR);
 * an infinite value is ∞ or −∞.
 */
export function formatNumber(v: number): string {
  if (Number.isNaN(v)) return 'undefined'
  if (v === Infinity) return '∞'
  if (v === -Infinity) return `${MINUS}∞`
  const exact = exactText(v)
  if (exact !== null) return exact
  const a = Math.abs(v)
  if (a >= 1e6 || a < 1e-4) return scientific(v)
  const decimals = Math.min(6, Math.max(1, 4 - Math.floor(Math.log10(a))))
  let text = a.toFixed(decimals)
  // Trailing zeros go, but one decimal stays: a rounded value never reads as exact.
  text = text.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '.0')
  return sign(text, v < 0)
}

/**
 * A row's text the way it reads aloud and on screen: x^2 as x², <= as ≤, the true minus, √, π and ·, so a screen reader
 * says "x squared minus 4", not "x caret 2 hyphen 4". Other powers keep their caret.
 */
export function speakable(text: string): string {
  return text
    .replace(/\^\(2\)|\^2(?![\d.])/g, '²')
    .replace(/\^\(3\)|\^3(?![\d.])/g, '³')
    .replace(/<=/g, '≤')
    .replace(/>=/g, '≥')
    .replace(/\bsqrt\(/g, '√(')
    .replace(/\bpi\b/g, 'π')
    .replace(/\*/g, '·')
    .replace(/-/g, MINUS)
}

/** "(125, 31250)". */
export function formatPoint(x: number, y: number): string {
  return `(${formatNumber(x)}, ${formatNumber(y)})`
}

/** A number in app syntax (ASCII minus, no rounding marks), for text she can edit: slider values, imported rows. */
export function plainNumber(v: number): string {
  if (!Number.isFinite(v)) return '0'
  const f = asSimpleFraction(v, 1e-12)
  if (f && f.d === 1) return String(f.n)
  // Up to 10 significant digits, without float noise (0.30000000000000004 is 0.3).
  const text = Number(v.toPrecision(10)).toString()
  return text.includes('e') ? v.toPrecision(6) : text
}

/**
 * A tick label for a tick step of 1, 2 or 5 times a power of ten: as many decimals as the step needs (0.5 → one,
 * 0.05 → two), scientific notation for very large or very small steps.
 */
export function tickLabel(v: number, step: number): string {
  if (Math.abs(v) < step * 1e-6) return '0'
  const a = Math.abs(v)
  if (a >= 1e6 || step < 1e-4) {
    const digits = Math.max(0, Math.min(6, Math.ceil(Math.log10(a / step) - 1e-9)))
    return scientific(v, digits)
  }
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9))
  return sign(a.toFixed(Math.min(decimals, 10)), v < 0)
}
