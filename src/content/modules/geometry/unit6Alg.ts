/**
 * Exact arithmetic for honors Unit 6: rationals, linear expressions a·x + b with rational coefficients, and the
 * equations a proportion turns into. Every answer and every slip is computed here, never with floating point.
 */
import { rat, ratAdd, ratDiv, ratMul, ratSub, ratToString, type Rational } from '@/notation'

export type { Rational }
export { rat, ratAdd, ratDiv, ratMul, ratSub, ratToString }

export const MINUS = '−'

export const R = (n: number, d = 1): Rational => rat(n, d)

export function isWhole(q: Rational): boolean {
  return q.d === 1
}

export function positive(q: Rational | null): q is Rational {
  return q !== null && q.n > 0
}

/** "7", "15/2", "-3" as she would type it (ASCII minus). */
export function qText(q: Rational): string {
  return ratToString(q)
}

/** "7", "15/2", "−3" as she reads it. */
export function qShow(q: Rational): string {
  return ratToString(q).replace('-', MINUS)
}

/** A linear expression a·x + b. */
export interface LinQ {
  a: Rational
  b: Rational
}

export const lin6 = (a: number | Rational, b: number | Rational): LinQ => ({
  a: typeof a === 'number' ? rat(a) : a,
  b: typeof b === 'number' ? rat(b) : b,
})

export const konst = (b: number | Rational): LinQ => lin6(0, b)

export function lmul(c: Rational, e: LinQ): LinQ {
  return { a: ratMul(c, e.a), b: ratMul(c, e.b) }
}

export function ladd(e: LinQ, f: LinQ): LinQ {
  return { a: ratAdd(e.a, f.a), b: ratAdd(e.b, f.b) }
}

export function lsub(e: LinQ, f: LinQ): LinQ {
  return { a: ratSub(e.a, f.a), b: ratSub(e.b, f.b) }
}

export function isConst(e: LinQ): boolean {
  return e.a.n === 0
}

export function evalAt(e: LinQ, x: Rational): Rational {
  return ratAdd(ratMul(e.a, x), e.b)
}

/** The x that makes left = right, or null when every x works or none does. */
export function lsolve(left: LinQ, right: LinQ): Rational | null {
  const a = ratSub(left.a, right.a)
  if (a.n === 0) return null
  return ratDiv(ratSub(right.b, left.b), a)
}

/** The product of two expressions when it is still linear (at least one is a constant), else null. */
export function lprod(e: LinQ, f: LinQ): LinQ | null {
  if (isConst(e)) return lmul(e.b, f)
  if (isConst(f)) return lmul(f.b, e)
  return null
}

/**
 * The product written the slip's way: the constant multiplies only the x term of a binomial, so c(x + p) becomes
 * cx + p. Null when nothing is lost (no binomial, or a factor of 1).
 */
export function lprodUndistributed(e: LinQ, f: LinQ): LinQ | null {
  const [c, bin] = isConst(e) ? [e.b, f] : isConst(f) ? [f.b, e] : [null, null]
  if (!c || !bin) return null
  if (bin.a.n === 0 || bin.b.n === 0) return null
  if (c.n === c.d) return null
  return { a: ratMul(c, bin.a), b: bin.b }
}

/** "2x + 3", "x − 4", "12", "3x" from integer coefficients; rationals print as fractions. */
export function linShow(e: LinQ): string {
  const a = e.a
  const b = e.b
  if (a.n === 0) return qShow(b)
  const head = a.n === a.d ? 'x' : a.n === -a.d ? `${MINUS}x` : a.d === 1 ? `${qShow(a)}x` : `(${qShow(a)})x`
  if (b.n === 0) return head
  return b.n > 0 ? `${head} + ${qShow(b)}` : `${head} ${MINUS} ${qShow({ n: -b.n, d: b.d })}`
}

/** An expression in a product: a binomial gets parentheses, "(x + 3)"; a number or a lone term does not. */
export function factorShow(e: LinQ): string {
  if (e.a.n !== 0 && e.b.n !== 0) return `(${linShow(e)})`
  return linShow(e)
}

/** "a · b" with a binomial in parentheses and a number first: "20(x + 3)", "8 · 15", "15x". */
export function productShow(e: LinQ, f: LinQ): string {
  const [first, second] = isConst(e) || !isConst(f) ? [e, f] : [f, e]
  if (isConst(first) && isConst(second)) return `${linShow(first)} · ${linShow(second)}`
  if (isConst(first)) {
    if (second.a.n !== 0 && second.b.n !== 0) return `${linShow(first)}(${linShow(second)})`
    return linShow(lmul(first.b, second))
  }
  return `${factorShow(first)}${factorShow(second)}`
}

/** "8x + 24 = 60" from an equation with both sides linear, x terms gathered on the left when they cancel nowhere. */
export function equationShow(left: LinQ, right: LinQ): string {
  return `${linShow(left)} = ${linShow(right)}`
}

/** The worked steps from left = right to x: "20x + 60 = 120, so 20x = 60, and x = 3". */
export function solveSteps(left: LinQ, right: LinQ): string {
  let a = ratSub(left.a, right.a)
  let c = ratSub(right.b, left.b)
  if (a.n < 0) {
    a = { n: -a.n, d: a.d }
    c = { n: -c.n, d: c.d }
  }
  const x = ratDiv(c, a)
  const isolated = `${linShow({ a, b: rat(0) })} = ${qShow(c)}`
  const start = equationShow(left, right)
  const alreadyIsolated = left.b.n === 0 && right.a.n === 0
  if (a.n === a.d || isolated === start || alreadyIsolated) return `${start}, so x = ${qShow(x)}`
  return `${start}, so ${isolated}, and x = ${qShow(x)}`
}

export function sameQ(p: Rational, q: Rational): boolean {
  return p.n === q.n && p.d === q.d
}

/**
 * "Cross-multiply: 20(x + 3) = 8 · 15. That gives 20x + 60 = 120, so 20x = 60, and x = 3." The products as written,
 * then the algebra; a step that would repeat the one before it is left out.
 */
export function crossText(shown: string, left: LinQ, right: LinQ): string {
  const steps = solveSteps(left, right)
  if (steps.startsWith(`${shown},`)) return `Cross-multiply: ${steps}.`
  return `Cross-multiply: ${shown}. That gives ${steps}.`
}
