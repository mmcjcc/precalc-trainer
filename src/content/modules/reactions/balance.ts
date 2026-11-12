/**
 * The balancer: coefficients of an equation from the integer null space of its element matrix.
 * One row per element, one column per species (reactants counted +, products −); the equation
 * balances exactly when the coefficient vector is in the matrix's null space. Exact rational
 * Gaussian elimination finds that space; a reaction of the table must have a one-dimensional
 * null space with a vector of all-positive entries, scaled to the lowest whole numbers.
 */
import { atomCounts, type RxReaction } from './facts'

export function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x
}

function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b
}

/** A fraction in lowest terms with a positive denominator. */
interface Frac {
  n: number
  d: number
}

function frac(n: number, d = 1): Frac {
  if (d === 0) throw new Error('balance: division by zero')
  const g = gcd(n, d) || 1
  const sign = d < 0 ? -1 : 1
  return { n: (sign * n) / g, d: (sign * d) / g }
}

const sub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d)
const div = (a: Frac, b: Frac) => frac(a.n * b.d, a.d * b.n)

/** Rows = elements (first-seen order), columns = reactants then products; products negative. */
export function elementMatrix(r: RxReaction): { elements: string[]; matrix: number[][] } {
  const species = [...r.reactants, ...r.products]
  const counts = species.map((s) => atomCounts(s.formula))
  const elements: string[] = []
  for (const c of counts) for (const el of c.keys()) if (!elements.includes(el)) elements.push(el)
  const matrix = elements.map((el) => counts.map((c, j) => (j < r.reactants.length ? 1 : -1) * (c.get(el) ?? 0) || 0))
  return { elements, matrix }
}

export type BalanceResult =
  | { ok: true; coefficients: number[] }
  | { ok: false; reason: 'no-solution' | 'many-solutions' | 'not-positive' }

/** Balances the reaction: the unique lowest-terms positive solution, or why there is none. */
export function balanceReaction(r: RxReaction): BalanceResult {
  const { matrix } = elementMatrix(r)
  const cols = r.reactants.length + r.products.length
  const m: Frac[][] = matrix.map((row) => row.map((v) => frac(v)))
  const pivots: number[] = []
  let row = 0
  for (let col = 0; col < cols && row < m.length; col++) {
    const p = m.findIndex((line, i) => i >= row && line[col]!.n !== 0)
    if (p < 0) continue
    ;[m[row], m[p]] = [m[p]!, m[row]!]
    const lead = m[row]![col]!
    m[row] = m[row]!.map((v) => div(v, lead))
    for (let i = 0; i < m.length; i++) {
      if (i === row) continue
      const factor = m[i]![col]!
      if (factor.n === 0) continue
      m[i] = m[i]!.map((v, j) => sub(v, mul(factor, m[row]![j]!)))
    }
    pivots.push(col)
    row++
  }
  const free = Array.from({ length: cols }, (_, j) => j).filter((j) => !pivots.includes(j))
  if (free.length === 0) return { ok: false, reason: 'no-solution' }
  if (free.length > 1) return { ok: false, reason: 'many-solutions' }
  const f = free[0]!
  const x: Frac[] = Array.from({ length: cols }, () => frac(0))
  x[f] = frac(1)
  pivots.forEach((col, i) => {
    x[col] = frac(-m[i]![f]!.n, m[i]![f]!.d)
  })
  const den = x.reduce((acc, v) => lcm(acc, v.d), 1)
  let ints = x.map((v) => (v.n * den) / v.d)
  if (ints.every((v) => v <= 0)) ints = ints.map((v) => -v)
  if (ints.some((v) => v <= 0)) return { ok: false, reason: 'not-positive' }
  const g = ints.reduce((acc, v) => gcd(acc, v), 0)
  return { ok: true, coefficients: ints.map((v) => v / g) }
}

const CACHE = new Map<string, number[]>()

/** The lowest-terms coefficients of a table reaction (throws for one that does not balance uniquely). */
export function coefficientsOf(r: RxReaction): number[] {
  const hit = CACHE.get(r.id)
  if (hit) return hit
  const result = balanceReaction(r)
  if (!result.ok) throw new Error(`reactions: ${r.id} does not balance (${result.reason})`)
  CACHE.set(r.id, result.coefficients)
  return result.coefficients
}

/** True when every element has the same number of atoms on both sides. */
export function balances(r: RxReaction, coefficients: readonly number[]): boolean {
  const { matrix } = elementMatrix(r)
  return matrix.every((line) => line.reduce((acc, v, j) => acc + v * (coefficients[j] ?? 0), 0) === 0)
}

export function commonFactor(coefficients: readonly number[]): number {
  return coefficients.reduce((acc, v) => gcd(acc, v), 0)
}
