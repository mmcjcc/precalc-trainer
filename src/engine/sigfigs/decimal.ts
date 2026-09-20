/**
 * Exact arithmetic for the significant-figures engine. BigInt only: no JavaScript float ever
 * touches a chemistry value (2.50 vs 2.5, 0.1 + 0.2 and half-way rounding all break on floats).
 *
 *   Dec  = int × 10^exp     (what a typed numeral or a rounded answer is)
 *   Rat  = n / d, d > 0     (what a quotient is; reduced)
 */

export interface Dec {
  int: bigint
  exp: number
}

export interface Rat {
  n: bigint
  d: bigint
}

const POW10_CACHE: bigint[] = [1n]

/** 10^k for k ≥ 0. */
export function pow10(k: number): bigint {
  if (!Number.isInteger(k) || k < 0) throw new Error(`pow10: bad exponent ${k}`)
  for (let i = POW10_CACHE.length; i <= k; i++) POW10_CACHE.push(POW10_CACHE[i - 1] * 10n)
  return POW10_CACHE[k]
}

export function absBig(a: bigint): bigint {
  return a < 0n ? -a : a
}

function gcd(a: bigint, b: bigint): bigint {
  let x = absBig(a)
  let y = absBig(b)
  while (y !== 0n) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

/** Number of decimal digits of |a| (0 → 1). */
export function digitCount(a: bigint): number {
  return absBig(a).toString().length
}

export function rat(n: bigint, d: bigint = 1n): Rat {
  if (d === 0n) throw new Error('division by zero')
  if (d < 0n) {
    n = -n
    d = -d
  }
  const g = gcd(n, d)
  return g === 0n || g === 1n ? { n, d } : { n: n / g, d: d / g }
}

export function ratFromDec(x: Dec): Rat {
  return x.exp >= 0 ? rat(x.int * pow10(x.exp)) : rat(x.int, pow10(-x.exp))
}

export const ratAdd = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d)
export const ratSub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d)
export const ratMul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d)
export function ratDiv(a: Rat, b: Rat): Rat {
  if (b.n === 0n) throw new Error('division by zero')
  return rat(a.n * b.d, a.d * b.n)
}
export const ratEq = (a: Rat, b: Rat): boolean => a.n === b.n && a.d === b.d
export const ratIsZero = (a: Rat): boolean => a.n === 0n
export const ratAbs = (a: Rat): Rat => ({ n: absBig(a.n), d: a.d })
/** −1, 0 or 1. */
export function ratCmp(a: Rat, b: Rat): number {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}

/** floor(log10 |r|): the place of the first nonzero digit. r must not be zero. */
export function ratFirstPlace(r: Rat): number {
  if (r.n === 0n) throw new Error('ratFirstPlace: zero has no first digit')
  const n = absBig(r.n)
  // |r| lies in (10^(k-1), 10^(k+1)) for k = digits(n) - digits(d); test the upper candidate.
  const k = digitCount(n) - digitCount(r.d)
  const atLeast = k >= 0 ? n >= r.d * pow10(k) : n * pow10(-k) >= r.d
  return atLeast ? k : k - 1
}

export interface RoundedRat {
  /** Signed kept digits: rounded value = m × 10^place. */
  m: bigint
  place: number
  /** The discarded part was exactly half a unit of the last kept place. */
  tie: boolean
  /** On the magnitude. */
  direction: 'up' | 'down' | 'exact'
  /** What chopping gives: truncM × 10^truncPlace. */
  truncM: bigint
  truncPlace: number
  /** First discarded digit (0-9). */
  firstDropped: number
  /** Rounding to N figures carried into a new digit (9.96 → 10.), so place moved up by one. */
  carried: boolean
}

/** Round half-up on the magnitude to the given place, by integer division with remainder. */
export function roundRatToPlace(r: Rat, place: number): RoundedRat {
  const neg = r.n < 0n
  const num = place >= 0 ? absBig(r.n) : absBig(r.n) * pow10(-place)
  const den = place >= 0 ? r.d * pow10(place) : r.d
  const q = num / den
  const rem = num % den
  const twice = rem * 2n
  const tie = rem !== 0n && twice === den
  const direction: RoundedRat['direction'] = rem === 0n ? 'exact' : twice >= den ? 'up' : 'down'
  const mag = direction === 'up' ? q + 1n : q
  return {
    m: neg ? -mag : mag,
    place,
    tie,
    direction,
    truncM: neg ? -q : q,
    truncPlace: place,
    firstDropped: Number((rem * 10n) / den),
    carried: false,
  }
}

/** Round half-up to n significant figures. r must not be zero; n ≥ 1. */
export function roundRatToSigFigs(r: Rat, n: number): RoundedRat {
  if (!Number.isInteger(n) || n < 1) throw new Error(`cannot round to ${n} significant figures`)
  const place = ratFirstPlace(r) - n + 1
  const res = roundRatToPlace(r, place)
  if (absBig(res.m) === pow10(n)) {
    // 9.96 → 10.0 at the tenths place is THREE figures; two figures is 10. (one place up).
    return { ...res, m: res.m / 10n, place: place + 1, carried: true }
  }
  return res
}

/** Does n/d have a finite decimal expansion? */
export function ratTerminates(r: Rat): boolean {
  let d = r.d
  while (d % 2n === 0n) d /= 2n
  while (d % 5n === 0n) d /= 5n
  return d === 1n
}

/** Exact Dec of a terminating rational, with the fewest digits. */
export function ratToDec(r: Rat): Dec {
  if (!ratTerminates(r)) throw new Error('ratToDec: value does not terminate')
  let twos = 0
  let fives = 0
  let d = r.d
  while (d % 2n === 0n) {
    d /= 2n
    twos++
  }
  while (d % 5n === 0n) {
    d /= 5n
    fives++
  }
  const k = Math.max(twos, fives)
  return minimalDec({ int: (r.n * pow10(k)) / r.d, exp: -k })
}

/** Strip factors of ten so the Dec has no trailing zero digits (0 → {0, 0}). */
export function minimalDec(x: Dec): Dec {
  if (x.int === 0n) return { int: 0n, exp: 0 }
  let { int, exp } = x
  while (int % 10n === 0n) {
    int /= 10n
    exp++
  }
  return { int, exp }
}

export function decEq(a: Dec, b: Dec): boolean {
  return ratEq(ratFromDec(a), ratFromDec(b))
}

/**
 * Plain decimal text showing EVERY digit of `int`: {100, −2} → "1.00", {12, 3} → "12000",
 * {−45, −4} → "-0.0045", {0, −2} → "0.00". ASCII minus.
 */
export function decToPlain(x: Dec): string {
  const neg = x.int < 0n
  const digits = absBig(x.int).toString()
  let body: string
  if (x.exp >= 0) {
    body = x.int === 0n ? '0' : digits + '0'.repeat(x.exp)
  } else {
    const frac = -x.exp
    const padded = digits.padStart(frac + 1, '0')
    body = padded.slice(0, padded.length - frac) + '.' + padded.slice(padded.length - frac)
  }
  return (neg ? '-' : '') + body
}

/** Minimal plain text of a value: "4.8" (not "4.800"), "1200", "-0.0045". */
export function decToMinimalPlain(x: Dec): string {
  return decToPlain(minimalDec(x))
}

/**
 * The calculator display of a rational: every digit when it terminates, otherwise at least `figures`
 * significant digits (chopped) followed by "…". The cut is never above the tenths: cutting at a
 * whole-number place would fill it with placeholder zeros that read as digits ("3333333333330…"
 * for 1e13 ÷ 3), and every digit shown here must be a true digit of the value.
 */
export function ratToDisplay(r: Rat, figures = 12): { text: string; terminates: boolean } {
  if (ratTerminates(r)) return { text: decToMinimalPlain(ratToDec(r)), terminates: true }
  const place = Math.min(ratFirstPlace(r) - figures + 1, -1)
  const cut = roundRatToPlace(r, place)
  return { text: decToPlain({ int: cut.truncM, exp: place }) + '…', terminates: false }
}

/**
 * Standard-notation text that shows exactly the figures of m × 10^place, or null when standard
 * notation cannot (2000 to two figures). A whole number whose last significant digit is a zero in
 * the ones place gets a trailing decimal point ("2000.").
 */
export function standardText(m: bigint, place: number): string | null {
  if (m === 0n) return place < 0 ? decToPlain({ int: 0n, exp: place }) : '0'
  if (place < 0) return decToPlain({ int: m, exp: place })
  if (place === 0) return decToPlain({ int: m, exp: 0 }) + (m % 10n === 0n ? '.' : '')
  return m % 10n === 0n ? null : decToPlain({ int: m, exp: place })
}

/** Scientific-notation text showing exactly the digits of m: (20, 2) → "2.0 x 10^3". m ≠ 0. */
export function scientificText(m: bigint, place: number): string {
  if (m === 0n) throw new Error('scientificText: zero has no scientific form')
  const digits = absBig(m).toString()
  const exponent = place + digits.length - 1
  const coefficient = digits.length === 1 ? digits : digits[0] + '.' + digits.slice(1)
  return `${m < 0n ? '-' : ''}${coefficient} x 10^${exponent}`
}
