/**
 * App-syntax builders for the domain/range and composition templates. Integers only, so every
 * boundary the core reports is an integer a student can write.
 */
import type { SolutionSet } from '@/shared/types'
import { addConst, linearExpr } from './format'

/** Polynomial from low degree to high: polyExpr([-2, 3]) is "3x - 2", polyExpr([-9, 0, 1]) is "x^2 - 9". */
export function polyExpr(coeffs: readonly number[]): string {
  const parts: { sign: 1 | -1; body: string }[] = []
  for (let p = coeffs.length - 1; p >= 0; p--) {
    const c = coeffs[p] ?? 0
    if (c === 0) continue
    const mag = Math.abs(c)
    let body: string
    if (p === 0) body = String(mag)
    else if (p === 1) body = mag === 1 ? 'x' : `${mag}x`
    else body = mag === 1 ? `x^${p}` : `${mag}x^${p}`
    parts.push({ sign: c < 0 ? -1 : 1, body })
  }
  if (parts.length === 0) return '0'
  let s = parts[0]!.sign < 0 ? `-${parts[0]!.body}` : parts[0]!.body
  for (const part of parts.slice(1)) s += part.sign < 0 ? ` - ${part.body}` : ` + ${part.body}`
  return s
}

/** "3/(x - 2)", "1/x", "-1/(x^2 - 9)". A single letter needs no parentheses. */
export function fraction(numer: number, denom: string): string {
  const top = numer === 1 ? '1' : numer === -1 ? '-1' : String(numer)
  const bottom = /^[A-Za-z]$/.test(denom) ? denom : `(${denom})`
  return `${top}/${bottom}`
}

/** "sqrt(x + 1)", "-2sqrt(x + 1)", "abs(x - 3)", "-cbrt(x)". */
export function scaledAtom(a: number, fn: 'sqrt' | 'cbrt' | 'abs', inside: string): string {
  const call = `${fn}(${inside})`
  if (a === 1) return call
  if (a === -1) return `-${call}`
  return `${a}${call}`
}

/** ax + b that is not the identity x (so a decomposition's inner function does real work). */
export function nonTrivialLinear(a: number, b: number): string {
  return linearExpr(a === 1 && b === 0 ? 1 : a, a === 1 && b === 0 ? 2 : b)
}

/** Finite endpoints of a set, as numbers, for picking a graph window. */
export function finiteXs(set: SolutionSet): number[] {
  const xs: number[] = []
  const push = (e: SolutionSet['pieces'][number]['lo']) => {
    if (typeof e === 'object') xs.push(e.n / e.d)
  }
  for (const piece of set.pieces) {
    push(piece.lo)
    push(piece.hi)
  }
  for (const pt of set.points) xs.push(pt.n / pt.d)
  return xs
}

/** A window that shows the interesting x-values, or [-8, 8] when the set is all reals. */
export function xWindow(xs: number[]): [number, number] {
  if (xs.length === 0) return [-8, 8]
  let lo = Math.min(-2, ...xs)
  let hi = Math.max(2, ...xs)
  lo = Math.floor(lo - 2)
  hi = Math.ceil(hi + 2)
  if (hi - lo < 8) {
    const mid = (lo + hi) / 2
    lo = Math.floor(mid - 4)
    hi = Math.ceil(mid + 4)
  }
  lo = Math.max(lo, -12)
  hi = Math.min(hi, 12)
  if (hi - lo < 6) return [-8, 8]
  return [lo, hi]
}

export { addConst, linearExpr }
