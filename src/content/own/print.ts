/**
 * Exact numbers and linear pieces printed in the app's syntax, for the lines the constructors build from her problem
 * (content/own). Rationals print as whole numbers or a/b; a term's coefficient as 3x, -x, (3/5)x.
 */
import { rat, ratCompare, ratIsInteger, ratNeg, ratToString, type Rational } from '@/notation'

export const ZERO = rat(0)
export const ONE = rat(1)
export const isZero = (r: Rational): boolean => r.n === 0
export const sign = (r: Rational): number => Math.sign(r.n)
export const isOne = (r: Rational): boolean => ratCompare(r, ONE) === 0
export const isMinusOne = (r: Rational): boolean => ratCompare(r, rat(-1)) === 0

/** "3", "-10/3". */
export function num(r: Rational): string {
  return ratToString(r)
}

/** A number as a factor or a divisor: "3", "(-3)", "(3/5)". */
export function factor(r: Rational): string {
  return r.n < 0 || !ratIsInteger(r) ? `(${num(r)})` : num(r)
}

/** p·v: "x", "-x", "3x", "-(3/5)x". `v` may be a product of letters ("xy"). */
export function term(p: Rational, v: string): string {
  if (isOne(p)) return v
  if (isMinusOne(p)) return `-${v}`
  if (ratIsInteger(p)) return `${p.n}${v}`
  return `${p.n < 0 ? '-' : ''}(${Math.abs(p.n)}/${p.d})${v}`
}

/** p·v + q, with the sign of q written as an operation: "3x - 2", "-x + 1/2", "4". */
export function lin(p: Rational, q: Rational, v: string): string {
  if (isZero(p)) return num(q)
  return plus(term(p, v), q)
}

/** `text` + q, the sign of q written as an operation; nothing added when q = 0. */
export function plus(text: string, q: Rational): string {
  if (isZero(q)) return text
  return sign(q) > 0 ? `${text} + ${num(q)}` : `${text} - ${num(ratNeg(q))}`
}

/** What she reads in a nudge: the true minus sign. */
export function words(text: string): string {
  return text.replace(/-/g, '−')
}
