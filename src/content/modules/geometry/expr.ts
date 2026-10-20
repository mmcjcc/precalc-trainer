/**
 * Linear expressions in x, the way a geometry problem states a length or an angle.
 * Display uses the minus sign; answer text stays ASCII so it matches what she types.
 */
import { rat, ratToString } from '@/notation'

export interface Lin {
  a: number
  b: number
}

export interface Q {
  n: number
  d: number
}

const MINUS = '\u2212'

export function lin(a: number, b: number): Lin {
  return { a, b }
}

export function evalLin(e: Lin, x: number): number {
  return e.a * x + e.b
}

export function formatLin(e: Lin): string {
  if (e.a === 0) return showNum(e.b)
  const head = e.a === 1 ? 'x' : `${e.a}x`
  if (e.b === 0) return head
  if (e.b > 0) return `${head} + ${e.b}`
  return `${head} ${MINUS} ${Math.abs(e.b)}`
}

/** "(2x + 3)°" or "41°". The expression is what the problem states. */
export function angleLabel(e: Lin): string {
  return e.a === 0 ? `${showNum(e.b)}°` : `(${formatLin(e)})°`
}

export function showNum(n: number): string {
  return n < 0 ? `${MINUS}${Math.abs(n)}` : String(n)
}

export function showPt(x: number, y: number): string {
  return `(${showNum(x)}, ${showNum(y)})`
}

/** Solve left = right. Null when the equation is an identity or impossible. */
export function solveEqual(left: Lin, right: Lin): Q | null {
  const a = left.a - right.a
  const c = right.b - left.b
  if (a === 0) return null
  const r = rat(c, a)
  return { n: r.n, d: r.d }
}

export function qText(q: Q): string {
  return ratToString(rat(q.n, q.d))
}

/** "2(30) + 10 = 70": the expression with x put in, then its value (the worked line for a measure). */
export function atX(e: Lin, x: number): string {
  const head = e.a === 1 ? `${x}` : `${e.a}(${x})`
  const value = e.a * x + e.b
  if (e.b === 0) return `${head} = ${value}`
  return `${head} ${e.b < 0 ? MINUS : '+'} ${Math.abs(e.b)} = ${value}`
}

/**
 * The algebra of a worked line, from the equation with like terms combined: "7x + 117 = 180, so 7x = 63 and
 * x = 9". The x terms go to the side where they are positive ("3x + 10 = 5x − 30, so 2x = 40 and x = 20").
 */
export function solveText(left: Lin, right: Lin): string {
  let a = left.a - right.a
  let c = right.b - left.b
  if (a < 0) {
    a = -a
    c = -c
  }
  const x = qText(solveEqual(left, right) ?? { n: 0, d: 1 })
  const combined = `${formatLin(left)} = ${formatLin(right)}`
  const isolated = `${a}x = ${showNum(c)}`
  // "9x = 180" is already isolated: straight to x.
  const isolate = a === 1 || isolated === combined ? '' : `${isolated} and `
  return `${combined}, so ${isolate}x = ${x}`
}

export function qIs(q: Q, n: number): boolean {
  return q.d === 1 && q.n === n
}

export function qSame(a: Q, b: Q): boolean {
  return a.n === b.n && a.d === b.d
}

/** A coefficient in 1..4 whose constant term is not ±x, and not a forbidden coefficient. */
export function fitExpr(value: number, x: number, salt: number, forbidden: readonly number[] = []): Lin {
  for (let k = 0; k < 8; k++) {
    const a = 1 + ((salt + k) % 4)
    if (forbidden.includes(a)) continue
    const b = value - a * x
    if (Math.abs(b) === x) continue
    return { a, b }
  }
  throw new Error(`no expression for ${value} at x = ${x}`)
}

export function fitTwo(v1: number, v2: number, x: number, salt: number): [Lin, Lin] {
  const left = fitExpr(v1, x, salt)
  const right = fitExpr(v2, x, salt + 5, [left.a])
  if (left.a === right.a) throw new Error('fitTwo produced the same coefficient')
  return [left, right]
}
