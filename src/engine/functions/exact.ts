/**
 * Exact real values for the functions core: numbers of the form c0 + c1·√m1 + c2·√m2 + … with
 * rational coefficients and distinct square-free radicands m (m = 1 is the rational part).
 *
 * Square roots of distinct square-free integers are linearly independent over Q, so this form is
 * canonical: two values are equal exactly when their term lists are equal, and a value is 0 exactly
 * when it has no terms. The set is closed under + − ×; division works by a rational, by a single term,
 * or by a + b√m (conjugate); √ and odd roots work on rationals (other roots only on perfect powers).
 * Anything else throws `Unsupported`, which the public functions turn into null ("cannot decide
 * exactly") instead of guessing.
 */
import type { Rational } from '@/shared/types'
import { rat, ratAdd, ratCompare, ratDiv, ratFromString, ratMul, ratNeg, ratToNumber, ratToString } from '@/notation/rational'
import { fnName, isOp, isUnaryMinus, nodeArgs, type MathNode } from '../math'

/** Thrown for anything outside the exact model (irrational constants, 4th roots of 2, pi, log…). */
export class Unsupported extends Error {
  constructor(message = 'unsupported') {
    super(message)
    this.name = 'Unsupported'
  }
}

export interface SurdTerm {
  /** Square-free positive integer; 1 for the rational part. */
  readonly m: number
  readonly c: Rational
}

/** c0 + Σ c_i·√m_i, terms sorted by m, no zero coefficients. */
export interface Surd {
  readonly terms: readonly SurdTerm[]
}

export type ExactValue = Surd | 'undef'

/** Wraps rat() so an overflow of the safe-integer range becomes `Unsupported`, not a crash. */
function safe<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Unsupported) throw e
    throw new Unsupported(String((e as { message?: string })?.message ?? e))
  }
}

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

// ---------------------------------------------------------------------------
// Square-free parts and integer roots
// ---------------------------------------------------------------------------

/** n = out² · inside with `inside` square-free (n ≥ 1, at most 1e12). */
export function squareFree(n: number): { out: number; inside: number } {
  if (!Number.isSafeInteger(n) || n < 1 || n > 1e12) throw new Unsupported(`square-free part of ${n}`)
  let rest = n
  let out = 1
  for (let k = 2; k * k <= rest; k++) {
    while (rest % (k * k) === 0) {
      rest /= k * k
      out *= k
    }
  }
  return { out, inside: rest }
}

/** The exact integer k-th root of a nonnegative safe integer, or null when it is not a perfect power. */
export function integerRoot(n: number, k: number): number | null {
  if (n === 0 || n === 1) return n
  const guess = Math.round(n ** (1 / k))
  for (const r of [guess - 1, guess, guess + 1]) {
    if (r < 0) continue
    if (BigInt(r) ** BigInt(k) === BigInt(n)) return r
  }
  return null
}

// ---------------------------------------------------------------------------
// Construction and inspection
// ---------------------------------------------------------------------------

export const SURD_ZERO: Surd = { terms: [] }

export function surdOf(r: Rational): Surd {
  return r.n === 0 ? SURD_ZERO : { terms: [{ m: 1, c: r }] }
}

export function surdInt(n: number): Surd {
  return surdOf(rat(n))
}

function normalize(terms: readonly SurdTerm[]): Surd {
  const byM = new Map<number, Rational>()
  for (const t of terms) {
    const prev = byM.get(t.m)
    byM.set(t.m, prev ? safe(() => ratAdd(prev, t.c)) : t.c)
  }
  const out: SurdTerm[] = []
  for (const [m, c] of [...byM.entries()].sort((a, b) => a[0] - b[0])) {
    if (c.n !== 0) out.push({ m, c })
  }
  return { terms: out }
}

export function surdIsZero(s: Surd): boolean {
  return s.terms.length === 0
}

/** The value as a Rational when it has no radical part, else null. */
export function surdRational(s: Surd): Rational | null {
  if (s.terms.length === 0) return rat(0)
  if (s.terms.length === 1 && s.terms[0]!.m === 1) return s.terms[0]!.c
  return null
}

export function surdEquals(a: Surd, b: Surd): boolean {
  if (a.terms.length !== b.terms.length) return false
  return a.terms.every((t, i) => {
    const u = b.terms[i]!
    return t.m === u.m && ratCompare(t.c, u.c) === 0
  })
}

export function surdToNumber(s: Surd): number {
  return s.terms.reduce((sum, t) => sum + ratToNumber(t.c) * Math.sqrt(t.m), 0)
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export function surdAdd(a: Surd, b: Surd): Surd {
  return normalize([...a.terms, ...b.terms])
}

export function surdNeg(a: Surd): Surd {
  return { terms: a.terms.map((t) => ({ m: t.m, c: ratNeg(t.c) })) }
}

export function surdSub(a: Surd, b: Surd): Surd {
  return surdAdd(a, surdNeg(b))
}

export function surdScale(a: Surd, r: Rational): Surd {
  if (r.n === 0) return SURD_ZERO
  return normalize(a.terms.map((t) => ({ m: t.m, c: safe(() => ratMul(t.c, r)) })))
}

function mulTerms(s: SurdTerm, t: SurdTerm): SurdTerm {
  const g = gcd(s.m, t.m)
  const m = (s.m / g) * (t.m / g)
  if (!Number.isSafeInteger(m)) throw new Unsupported('radicand overflow')
  return { m, c: safe(() => ratMul(ratMul(s.c, t.c), rat(g))) }
}

export function surdMul(a: Surd, b: Surd): Surd {
  const out: SurdTerm[] = []
  for (const s of a.terms) for (const t of b.terms) out.push(mulTerms(s, t))
  return normalize(out)
}

/** a / b; 'undef' for b = 0; throws Unsupported for a divisor outside the model. */
export function surdDiv(a: Surd, b: Surd): ExactValue {
  if (surdIsZero(b)) return 'undef'
  const br = surdRational(b)
  if (br) return surdScale(a, safe(() => ratDiv(rat(1), br)))
  if (b.terms.length === 1) {
    // a / (c√m) = a·√m / (c·m)
    const t = b.terms[0]!
    return surdScale(surdMul(a, { terms: [{ m: t.m, c: rat(1) }] }), safe(() => ratDiv(rat(1), ratMul(t.c, rat(t.m)))))
  }
  if (b.terms.length === 2 && b.terms[0]!.m === 1) {
    // a / (p + q√m) = a·(p − q√m) / (p² − q²m)
    const p = b.terms[0]!.c
    const q = b.terms[1]!.c
    const m = b.terms[1]!.m
    const conj: Surd = normalize([
      { m: 1, c: p },
      { m, c: ratNeg(q) },
    ])
    const den = safe(() => ratAdd(ratMul(p, p), ratNeg(ratMul(ratMul(q, q), rat(m)))))
    return surdScale(surdMul(a, conj), safe(() => ratDiv(rat(1), den)))
  }
  throw new Unsupported('division by a sum of several radicals')
}

/** √r for a rational r ≥ 0 as a single term (a/b)·√m. */
function sqrtRational(r: Rational): Surd {
  if (r.n === 0) return SURD_ZERO
  const p = squareFree(r.n)
  const q = squareFree(r.d)
  // √(n/d) = (p.out/q.out)·√(p.in/q.in) = (p.out/q.out)·√(p.in·q.in)/q.in
  const m = p.inside * q.inside
  if (!Number.isSafeInteger(m)) throw new Unsupported('radicand overflow')
  return normalize([{ m, c: safe(() => rat(p.out, q.out * q.inside)) }])
}

/** √s: exact for rational s; 'undef' for s < 0. */
export function surdSqrt(s: Surd): ExactValue {
  const r = surdRational(s)
  if (!r) throw new Unsupported('square root of an irrational value')
  if (r.n < 0) return 'undef'
  return sqrtRational(r)
}

/** k-th root (k ≥ 2): √ for k = 2; otherwise exact only for rational perfect powers. */
export function surdRoot(s: Surd, k: number): ExactValue {
  if (!Number.isInteger(k) || k < 2) throw new Unsupported(`root index ${k}`)
  if (k === 2) return surdSqrt(s)
  const r = surdRational(s)
  if (!r) throw new Unsupported('root of an irrational value')
  if (r.n < 0 && k % 2 === 0) return 'undef'
  const n = integerRoot(Math.abs(r.n), k)
  const d = integerRoot(r.d, k)
  if (n === null || d === null) throw new Unsupported(`${ratToString(r)} is not a perfect ${k}th power`)
  return surdOf(rat(r.n < 0 ? -n : n, d))
}

/** s^n for an integer n (0^0 = 1, like math.js); 'undef' for 0^negative. */
export function surdPow(s: Surd, n: number): ExactValue {
  if (!Number.isInteger(n) || Math.abs(n) > 64) throw new Unsupported(`exponent ${n}`)
  if (n === 0) return surdInt(1)
  if (n < 0) {
    const pos = surdPow(s, -n)
    return pos === 'undef' ? pos : surdDiv(surdInt(1), pos)
  }
  let out: Surd = surdInt(1)
  for (let i = 0; i < n; i++) out = surdMul(out, s)
  return out
}

/** Sign, exact for up to two terms, by a float with a safety margin otherwise. */
export function surdSign(s: Surd): -1 | 0 | 1 {
  const ts = s.terms
  if (ts.length === 0) return 0
  const sg = (r: Rational): -1 | 1 => (r.n < 0 ? -1 : 1)
  if (ts.length === 1) return sg(ts[0]!.c)
  if (ts.length === 2) {
    const [a, b] = [ts[0]!, ts[1]!]
    if (sg(a.c) === sg(b.c)) return sg(a.c)
    // Opposite signs: the larger square wins (they are never equal in canonical form).
    const a2 = safe(() => ratMul(ratMul(a.c, a.c), rat(a.m)))
    const b2 = safe(() => ratMul(ratMul(b.c, b.c), rat(b.m)))
    return ratCompare(a2, b2) > 0 ? sg(a.c) : sg(b.c)
  }
  const v = surdToNumber(s)
  const scale = ts.reduce((sum, t) => sum + Math.abs(ratToNumber(t.c)) * Math.sqrt(t.m), 0)
  if (Math.abs(v) <= 1e-12 * scale) throw new Unsupported('sign too close to call')
  return v < 0 ? -1 : 1
}

export function surdAbs(s: Surd): Surd {
  return surdSign(s) < 0 ? surdNeg(s) : s
}

/** Compare a value with a rational: exact. */
export function surdCompareRat(s: Surd, r: Rational): -1 | 0 | 1 {
  return surdSign(surdSub(s, surdOf(r)))
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** App syntax: "3", "-1/2", "2sqrt(3)", "1 + sqrt(2)", "-sqrt(6)/2", "3 - 2sqrt(2)". */
export function surdToText(s: Surd): string {
  if (s.terms.length === 0) return '0'
  const parts = s.terms.map((t) => {
    const neg = t.c.n < 0
    const p = Math.abs(t.c.n)
    const q = t.c.d
    let body: string
    if (t.m === 1) body = q === 1 ? `${p}` : `${p}/${q}`
    else {
      const root = `sqrt(${t.m})`
      body = `${p === 1 ? '' : p}${root}${q === 1 ? '' : `/${q}`}`
    }
    return { neg, body }
  })
  return parts.reduce((acc, part, i) => {
    if (i === 0) return `${part.neg ? '-' : ''}${part.body}`
    return `${acc} ${part.neg ? '-' : '+'} ${part.body}`
  }, '')
}

// ---------------------------------------------------------------------------
// Exact evaluation of a parsed expression
// ---------------------------------------------------------------------------

/**
 * Exact value of a number literal as written: 0.1 is 1/10, not the nearest binary float, and a long
 * decimal such as 0.333333333 stays itself (it is NOT snapped to 1/3).
 */
export function exactLiteral(v: number): Rational {
  if (!Number.isFinite(v)) throw new Unsupported(`literal ${v}`)
  if (Number.isSafeInteger(v)) return rat(v)
  const text = String(v)
  const direct = ratFromString(text)
  if (direct) return direct
  const m = text.match(/^(-?)(\d+(?:\.\d+)?)e([+-]\d+)$/)
  if (m) {
    const mant = ratFromString(m[2]!)
    const e = Number(m[3])
    if (mant && Math.abs(e) <= 15) {
      const scaled = e >= 0 ? safe(() => ratMul(mant, rat(10 ** e))) : safe(() => ratDiv(mant, rat(10 ** -e)))
      return m[1] === '-' ? ratNeg(scaled) : scaled
    }
  }
  throw new Unsupported(`literal ${text}`)
}

function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

/** The exponent of a power node as an exact rational (it must not contain the variable). */
export function exactConstant(node: MathNode): Rational {
  const v = exactEval(node, null)
  if (v === 'undef') throw new Unsupported('undefined constant')
  const r = surdRational(v)
  if (!r) throw new Unsupported('irrational constant')
  return r
}

/**
 * Exact value of `node` at x (null: the expression must be constant). 'undef' when a denominator is 0
 * or an even root has a negative radicand anywhere in the tree (the same points math.js marks 'undef').
 * Throws `Unsupported` for pi, e, other functions, and values outside the model.
 */
export function exactEval(node: MathNode, x: Rational | Surd | null, variable = 'x'): ExactValue {
  const n = unwrap(node)
  const rec = n as unknown as Record<string, unknown>
  if (n.type === 'ConstantNode') {
    if (typeof rec.value !== 'number') throw new Unsupported('non-numeric constant')
    return surdOf(exactLiteral(rec.value))
  }
  if (n.type === 'SymbolNode') {
    if (rec.name === variable && x) return 'terms' in x ? x : surdOf(x)
    throw new Unsupported(`symbol ${String(rec.name)}`)
  }
  const args = nodeArgs(n)
  const vals = (): Surd[] | 'undef' => {
    const out: Surd[] = []
    for (const a of args) {
      const v = exactEval(a, x, variable)
      if (v === 'undef') return 'undef'
      out.push(v)
    }
    return out
  }
  if (n.type === 'OperatorNode') {
    if (isUnaryMinus(n)) {
      const v = vals()
      return v === 'undef' ? v : surdNeg(v[0]!)
    }
    if (rec.fn === 'unaryPlus') {
      const v = vals()
      return v === 'undef' ? v : v[0]!
    }
    if (isOp(n, '^')) {
      const base = exactEval(args[0]!, x, variable)
      const e = exactConstant(args[1]!)
      if (base === 'undef') return base
      return powRational(base, e)
    }
    const v = vals()
    if (v === 'undef') return v
    const [a, b] = [v[0]!, v[1]!]
    if (isOp(n, '+')) return surdAdd(a, b)
    if (isOp(n, '-')) return surdSub(a, b)
    if (isOp(n, '*')) return surdMul(a, b)
    if (isOp(n, '/')) return surdDiv(a, b)
    throw new Unsupported(`operator ${String(rec.op)}`)
  }
  if (n.type === 'FunctionNode') {
    const name = fnName(n)
    if (name === 'nthRoot') {
      const k = exactConstant(args[1]!)
      if (k.d !== 1) throw new Unsupported('root index')
      const a = exactEval(args[0]!, x, variable)
      return a === 'undef' ? a : surdRoot(a, k.n)
    }
    const v = vals()
    if (v === 'undef') return v
    const a = v[0]!
    if (args.length !== 1) throw new Unsupported(`function ${name}`)
    if (name === 'sqrt') return surdSqrt(a)
    if (name === 'cbrt') return surdRoot(a, 3)
    if (name === 'abs') return surdAbs(a)
    throw new Unsupported(`function ${name}`)
  }
  throw new Unsupported(`node ${n.type}`)
}

/** base^(p/q) for a rational exponent. */
function powRational(base: Surd, e: Rational): ExactValue {
  if (e.d === 1) return surdPow(base, e.n)
  const root = surdRoot(base, e.d)
  if (root === 'undef') return root
  return surdPow(root, e.n)
}

/** Float value of an exact value (for display and ordering only). */
export function exactToNumber(v: ExactValue): number {
  return v === 'undef' ? NaN : surdToNumber(v)
}
