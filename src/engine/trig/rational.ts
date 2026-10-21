/**
 * Small exact rationals for the trig core (angles in degrees, coefficients of exact values). Numerators and
 * denominators stay safe integers; an operation that would leave that range throws `TrigOverflow`, which the
 * reader turns into "that number is longer than this problem needs".
 */

/** n/d in lowest terms with d > 0. */
export interface Q {
  n: number
  d: number
}

export class TrigOverflow extends Error {
  constructor() {
    super('number too large')
    this.name = 'TrigOverflow'
  }
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

function safe(v: number): number {
  if (!Number.isSafeInteger(v)) throw new TrigOverflow()
  return v
}

/** n/d reduced, sign on the numerator. */
export function q(n: number, d = 1): Q {
  if (!Number.isInteger(n) || !Number.isInteger(d)) throw new Error(`q needs integers, got ${n}/${d}`)
  if (d === 0) throw new Error('zero denominator')
  safe(n)
  safe(d)
  if (n === 0) return { n: 0, d: 1 }
  const g = gcd(n, d)
  const sign = d < 0 ? -1 : 1
  return { n: (sign * n) / g, d: (sign * d) / g }
}

export const Q0: Q = { n: 0, d: 1 }
export const Q1: Q = { n: 1, d: 1 }

export function qAdd(a: Q, b: Q): Q {
  return q(safe(a.n * b.d + b.n * a.d), safe(a.d * b.d))
}

export function qSub(a: Q, b: Q): Q {
  return q(safe(a.n * b.d - b.n * a.d), safe(a.d * b.d))
}

export function qMul(a: Q, b: Q): Q {
  return q(safe(a.n * b.n), safe(a.d * b.d))
}

export function qDiv(a: Q, b: Q): Q {
  if (b.n === 0) throw new Error('division by zero')
  return q(safe(a.n * b.d), safe(a.d * b.n))
}

export function qNeg(a: Q): Q {
  return a.n === 0 ? a : { n: -a.n, d: a.d }
}

export function qAbs(a: Q): Q {
  return a.n < 0 ? qNeg(a) : a
}

export function qCmp(a: Q, b: Q): number {
  const l = a.n * b.d
  const r = b.n * a.d
  return l === r ? 0 : l < r ? -1 : 1
}

export function qEq(a: Q, b: Q): boolean {
  return a.n === b.n && a.d === b.d
}

export function qIsInt(a: Q): boolean {
  return a.d === 1
}

export function qNum(a: Q): number {
  return a.n / a.d
}

/** The largest integer ≤ a. */
export function qFloor(a: Q): number {
  return Math.floor(a.n / a.d)
}

/** "5/6", "-7/4", "3". */
export function qText(a: Q): string {
  return a.d === 1 ? String(a.n) : `${a.n}/${a.d}`
}

/** A decimal's exact value: "0.25" is 1/4. */
export function qFromDecimal(text: string): Q {
  const m = /^([-+]?)(\d*)(?:\.(\d*))?$/.exec(text.trim())
  if (!m || (!m[2] && !m[3])) throw new Error(`not a decimal: ${text}`)
  const frac = m[3] ?? ''
  if (frac.length > 12 || (m[2] ?? '').length > 15) throw new TrigOverflow()
  const digits = `${m[2] || '0'}${frac}`
  const n = Number(digits)
  const d = 10 ** frac.length
  return q(m[1] === '-' ? -n : n, d)
}
