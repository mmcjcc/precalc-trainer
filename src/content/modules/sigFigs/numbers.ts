/**
 * Digit-string builders for lab-style measurements. No floats anywhere: a measurement is born as
 * text ("12.50", "0.00450", "1.20 x 10^3") so its zeros and its decimal point are exactly what the
 * student sees, and all chemistry arithmetic is left to the engine (BigInt).
 *
 * Small integers (hundredths of a gram, a count of tablets) are used only to CONSTRUCT inputs.
 */
import type { Rng } from '@/content/rng'

const NONZERO = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
const ANY = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

export function nonzeroDigit(rng: Rng): string {
  return rng.pick(NONZERO)
}

/** A digit in [lo, hi]. */
export function digitBetween(rng: Rng, lo: number, hi: number): string {
  return String(rng.int(lo, hi))
}

export interface DigitOptions {
  /** Last digit is nonzero (default true), so the figure count does not depend on how it is written. */
  lastNonzero?: boolean
  /** No zero anywhere (default false: inner zeros are allowed, they are captive and count). */
  noZeros?: boolean
}

/** `n` random digits with a nonzero first digit. */
export function digitsOf(rng: Rng, n: number, opts: DigitOptions = {}): string {
  const lastNonzero = opts.lastNonzero !== false
  let out = ''
  for (let i = 0; i < n; i++) {
    const edge = i === 0 || (i === n - 1 && lastNonzero)
    out += edge || opts.noZeros === true ? rng.pick(NONZERO) : rng.pick(ANY)
  }
  return out
}

export function zeros(n: number): string {
  return '0'.repeat(Math.max(0, n))
}

/**
 * Place a decimal point in a digit string: `fractionDigits` of the digits sit after the point.
 *   decimal('1250', 2) → '12.50'    decimal('45', 4) → '0.0045'    decimal('12', 0) → '12'
 *   decimal('12', -2) → '1200' (placeholder zeros, no point)
 */
export function decimal(digits: string, fractionDigits: number): string {
  if (fractionDigits <= 0) return digits + zeros(-fractionDigits)
  if (fractionDigits >= digits.length) return `0.${zeros(fractionDigits - digits.length)}${digits}`
  return `${digits.slice(0, digits.length - fractionDigits)}.${digits.slice(digits.length - fractionDigits)}`
}

/** Normalized scientific notation in the engine's ASCII spelling: ('120', 3) → '1.20 x 10^3'. */
export function scientific(digits: string, power: number): string {
  const coefficient = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits
  return `${coefficient} x 10^${power}`
}

/**
 * A measurement with exactly `figs` significant figures and `intDigits` digits in front of the
 * decimal point (intDigits 0 → "0.ddd"). With `trailingZero` the last figure is a (significant) zero,
 * which needs a decimal point to show, so it is ignored for whole numbers.
 */
export function measurement(rng: Rng, figs: number, intDigits: number, trailingZero = false): string {
  const fraction = figs - intDigits
  if (trailingZero && fraction > 0 && figs >= 2) {
    return decimal(`${digitsOf(rng, figs - 1, { lastNonzero: false })}0`, fraction)
  }
  return decimal(digitsOf(rng, figs), fraction)
}

/** A whole number of hundredths (or any integer) as a decimal with `fractionDigits` places: (526, 2) → '5.26'. */
export function fromInteger(value: number, fractionDigits: number): string {
  if (!Number.isInteger(value) || value < 0) throw new Error(`fromInteger: ${value}`)
  return decimal(String(value), fractionDigits)
}

export interface Weighted<T> {
  weight: number
  value: T
}

/** Weighted pick; consumes exactly one random number. */
export function pickWeighted<T>(rng: Rng, items: readonly Weighted<T>[]): T {
  const total = items.reduce((sum, it) => sum + it.weight, 0)
  if (items.length === 0 || total <= 0) throw new Error('pickWeighted: nothing to pick')
  let roll = rng.next() * total
  for (const it of items) {
    roll -= it.weight
    if (roll < 0) return it.value
  }
  return items[items.length - 1]!.value
}
