/**
 * Exact values of CONSTANT exponential and log expressions.
 *
 * Every value is one of
 *   - zero,
 *   - a power product  ± ∏ p^(r_p) · e^(r_e)   (p prime, r rational): every nonzero rational, √2, 8^(2/3), e³,
 *   - a log-linear form  c + Σ k_p · ln p        (c, k rational): ln 6 = ln 2 + ln 3, ln(e^5) = 5, log₂ 8 · ln 2,
 *   - a ratio of two log-linear forms            log₂ 7 = ln 7 / ln 2, log 5 / (2 log 3).
 *
 * The logs of distinct primes are linearly independent over the rationals (unique factorization), so two
 * power products or two log-linear forms are equal exactly when their exponent / coefficient maps are
 * equal, and a log-linear form is rational exactly when it has no log terms. That makes log₂ 8 = 3,
 * log 0.001 = −3, ln(e⁵) = 5, e^(ln 7) = 7, 10^(log 7) = 7, log₆ 4 + log₆ 9 = 2 and log₂ 3 · log₃ 8 = 3
 * exact, and proves log₂ 7 irrational (7^q = 2^p has no solution). Two RATIOS are compared by
 * cross-multiplying as polynomials in the ln p: equal polynomials are certainly equal numbers.
 *
 * Anything else (π, a sum of different radicals, sin) throws `Unsupported`; callers fall back to floats.
 */
import type { Rational } from '@/shared/types'
import { rat, ratAdd, ratCompare, ratDiv, ratMul, ratNeg, ratToNumber } from '@/notation/rational'
import { fnName, isOp, isUnaryMinus, nodeArgs, symbolName, type MathNode } from '../math'
import { exactLiteral, Unsupported } from '../functions/exact'

export { Unsupported }

/** Key 0 stands for e in a power product. */
const E = 0

type Exps = ReadonlyMap<number, Rational>

export type ExactValue =
  | { kind: 'zero' }
  | { kind: 'pp'; sign: 1 | -1; exps: Exps }
  | { kind: 'll'; c: Rational; logs: Exps }
  | { kind: 'ratio'; num: LL; den: LL }

type LL = Extract<ExactValue, { kind: 'll' }>
type PP = Extract<ExactValue, { kind: 'pp' }>

const ZERO: ExactValue = { kind: 'zero' }
const R0 = rat(0)
const R1 = rat(1)

function safe<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Unsupported) throw e
    throw new Unsupported(String((e as { message?: string })?.message ?? e))
  }
}

const add = (a: Rational, b: Rational) => safe(() => ratAdd(a, b))
const mul = (a: Rational, b: Rational) => safe(() => ratMul(a, b))
const div = (a: Rational, b: Rational) => safe(() => ratDiv(a, b))

// ---------------------------------------------------------------------------
// Factorization
// ---------------------------------------------------------------------------

function factorInt(n: number, sign: 1 | -1, into: Map<number, Rational>): void {
  if (!Number.isSafeInteger(n) || n < 1) throw new Unsupported(`factor ${n}`)
  let rest = n
  for (let p = 2; p * p <= rest; p++) {
    if (p > 1_000_000) throw new Unsupported('number too large to factor')
    let k = 0
    while (rest % p === 0) {
      rest /= p
      k++
    }
    if (k) into.set(p, add(into.get(p) ?? R0, rat(sign * k)))
  }
  if (rest > 1) into.set(rest, add(into.get(rest) ?? R0, rat(sign)))
}

function cleaned(m: Map<number, Rational>): Map<number, Rational> {
  for (const [k, v] of [...m]) if (v.n === 0) m.delete(k)
  return m
}

/** A nonzero rational as a power product. */
export function ppOfRational(r: Rational): ExactValue {
  if (r.n === 0) return ZERO
  const exps = new Map<number, Rational>()
  factorInt(Math.abs(r.n), 1, exps)
  factorInt(r.d, -1, exps)
  return { kind: 'pp', sign: r.n < 0 ? -1 : 1, exps: cleaned(exps) }
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

function ppRational(v: PP): Rational | null {
  let num = 1
  let den = 1
  for (const [p, e] of v.exps) {
    if (p === E || e.d !== 1) return null
    const f = p ** Math.abs(e.n)
    if (!Number.isSafeInteger(f)) return null
    if (e.n > 0) num *= f
    else den *= f
    if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den)) return null
  }
  return safe(() => rat(v.sign * num, den))
}

/** The value as a Rational when it is one, else null. */
export function exactRational(v: ExactValue): Rational | null {
  if (v.kind === 'zero') return R0
  if (v.kind === 'pp') return ppRational(v)
  if (v.kind === 'll') return v.logs.size === 0 ? v.c : null
  return null
}

function llOf(c: Rational, logs: Map<number, Rational> = new Map()): LL {
  return { kind: 'll', c, logs: cleaned(logs) }
}

function llRational(v: LL): Rational | null {
  return v.logs.size === 0 ? v.c : null
}

function asLL(v: ExactValue): LL | null {
  if (v.kind === 'll') return v
  const r = exactRational(v)
  return r ? llOf(r) : null
}

/** Canonical form: rationals as power products (or zero), log-linear forms without logs as rationals, ratios reduced. */
function norm(v: ExactValue): ExactValue {
  if (v.kind === 'll') {
    const r = llRational(v)
    if (r) return r.n === 0 ? ZERO : ppOfRational(r)
    return v
  }
  if (v.kind === 'ratio') {
    const dr = llRational(v.den)
    if (dr) {
      if (dr.n === 0) throw new Unsupported('ratio over zero')
      return norm(llScale(v.num, div(R1, dr)))
    }
    const k = proportional(v.num, v.den)
    if (k) return k.n === 0 ? ZERO : ppOfRational(k)
    return v
  }
  if (v.kind === 'pp' && v.exps.size === 0) return ppOfRational(rat(v.sign))
  return v
}

function llScale(v: LL, k: Rational): LL {
  const logs = new Map<number, Rational>()
  for (const [p, c] of v.logs) logs.set(p, mul(c, k))
  return llOf(mul(v.c, k), logs)
}

function llAdd(a: LL, b: LL): LL {
  const logs = new Map<number, Rational>(a.logs)
  for (const [p, c] of b.logs) logs.set(p, add(logs.get(p) ?? R0, c))
  return llOf(add(a.c, b.c), logs)
}

/** k with a = k·b (b not all-zero), else null. */
function proportional(a: LL, b: LL): Rational | null {
  let k: Rational | null = null
  const keys = new Set([...a.logs.keys(), ...b.logs.keys(), -1])
  for (const p of keys) {
    const ca = p === -1 ? a.c : (a.logs.get(p) ?? R0)
    const cb = p === -1 ? b.c : (b.logs.get(p) ?? R0)
    if (cb.n === 0) {
      if (ca.n !== 0) return null
      continue
    }
    const q = div(ca, cb)
    if (k && ratCompare(k, q) !== 0) return null
    k = q
  }
  return k
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export function exactAdd(a: ExactValue, b: ExactValue): ExactValue {
  if (a.kind === 'zero') return b
  if (b.kind === 'zero') return a
  const ra = exactRational(a)
  const rb = exactRational(b)
  if (ra && rb) return norm(llOf(add(ra, rb)))
  const la = asLL(a)
  const lb = asLL(b)
  if (la && lb) return norm(llAdd(la, lb))
  if (a.kind === 'ratio' && b.kind === 'ratio') {
    const k = proportional(b.den, a.den)
    if (k) return norm({ kind: 'ratio', num: llAdd(a.num, llScale(b.num, div(R1, k))), den: a.den })
    throw new Unsupported('sum of ratios with different denominators')
  }
  const ratio = a.kind === 'ratio' ? a : b.kind === 'ratio' ? b : null
  const other = ratio === a ? b : a
  if (ratio && ratio.kind === 'ratio') {
    const ro = exactRational(other)
    if (ro) return norm({ kind: 'ratio', num: llAdd(ratio.num, llScale(ratio.den, ro)), den: ratio.den })
  }
  throw new Unsupported('sum outside the exact model')
}

export function exactNeg(a: ExactValue): ExactValue {
  if (a.kind === 'zero') return a
  if (a.kind === 'pp') return { kind: 'pp', sign: a.sign === 1 ? -1 : 1, exps: a.exps }
  if (a.kind === 'll') return llScale(a, rat(-1))
  return { kind: 'ratio', num: llScale(a.num, rat(-1)), den: a.den }
}

function ppMul(a: PP, b: PP): ExactValue {
  const exps = new Map<number, Rational>(a.exps)
  for (const [p, e] of b.exps) exps.set(p, add(exps.get(p) ?? R0, e))
  return norm({ kind: 'pp', sign: a.sign === b.sign ? 1 : -1, exps: cleaned(exps) })
}

export function exactMul(a: ExactValue, b: ExactValue): ExactValue {
  if (a.kind === 'zero' || b.kind === 'zero') return ZERO
  if (a.kind === 'pp' && b.kind === 'pp') return ppMul(a, b)
  const ra = exactRational(a)
  const rb = exactRational(b)
  if (ra || rb) {
    const k = (ra ?? rb)!
    const v = ra ? b : a
    if (v.kind === 'll') return norm(llScale(v, k))
    if (v.kind === 'ratio') return norm({ kind: 'ratio', num: llScale(v.num, k), den: v.den })
    if (v.kind === 'pp') return ppMul(v, ppOfRational(k) as PP)
  }
  // LL × ratio, ratio × ratio: only when a numerator cancels a denominator, or a numerator is rational.
  const asRatio = (v: ExactValue): { num: LL; den: LL } | null => (v.kind === 'ratio' ? v : v.kind === 'll' ? { num: v, den: llOf(R1) } : null)
  const x = asRatio(a)
  const y = asRatio(b)
  if (x && y) {
    const k1 = proportional(x.num, y.den)
    if (k1) return norm(ratioOf(llScale(y.num, k1), x.den))
    const k2 = proportional(y.num, x.den)
    if (k2) return norm(ratioOf(llScale(x.num, k2), y.den))
    const rxn = llRational(x.num)
    const ryd = llRational(y.den)
    if (rxn && ryd) return norm(ratioOf(llScale(y.num, div(rxn, ryd)), x.den))
    const ryn = llRational(y.num)
    const rxd = llRational(x.den)
    if (ryn && rxd) return norm(ratioOf(llScale(x.num, div(ryn, rxd)), y.den))
  }
  throw new Unsupported('product outside the exact model')
}

function ratioOf(num: LL, den: LL): ExactValue {
  return { kind: 'ratio', num, den }
}

export function exactInverse(a: ExactValue): ExactValue | 'undef' {
  if (a.kind === 'zero') return 'undef'
  if (a.kind === 'pp') {
    const exps = new Map<number, Rational>()
    for (const [p, e] of a.exps) exps.set(p, ratNeg(e))
    return { kind: 'pp', sign: a.sign, exps }
  }
  if (a.kind === 'll') return norm(ratioOf(llOf(R1), a))
  return norm(ratioOf(a.den, a.num))
}

export function exactDiv(a: ExactValue, b: ExactValue): ExactValue | 'undef' {
  const inv = exactInverse(b)
  return inv === 'undef' ? inv : exactMul(a, inv)
}

/** ln of a positive power product: Σ r_p ln p + r_e. */
export function exactLn(a: ExactValue): ExactValue | 'undef' {
  if (a.kind === 'zero') return 'undef'
  if (a.kind !== 'pp') {
    // ln of a log-linear value: only a rational one is in the model (it is a power product then).
    throw new Unsupported('ln of a log')
  }
  if (a.sign < 0) return 'undef'
  let c = R0
  const logs = new Map<number, Rational>()
  for (const [p, e] of a.exps) {
    if (p === E) c = add(c, e)
    else logs.set(p, e)
  }
  return norm(llOf(c, logs))
}

/** e^v for a log-linear (or rational) v: a power product. */
function exactExpOf(v: ExactValue): ExactValue {
  const l = asLL(v)
  if (!l) throw new Unsupported('e to a power outside the model')
  const exps = new Map<number, Rational>(l.logs)
  if (l.c.n !== 0) exps.set(E, l.c)
  return norm({ kind: 'pp', sign: 1, exps: cleaned(exps) })
}

/** a^b. */
export function exactPow(a: ExactValue, b: ExactValue): ExactValue | 'undef' {
  const rb = exactRational(b)
  if (rb) {
    if (a.kind === 'zero') return rb.n > 0 ? ZERO : rb.n === 0 ? ppOfRational(R1) : 'undef'
    if (rb.n === 0) return ppOfRational(R1)
    if (a.kind === 'pp') {
      let sign: 1 | -1 = 1
      if (a.sign < 0) {
        if (rb.d % 2 === 0) return 'undef'
        sign = rb.n % 2 === 0 ? 1 : -1
      }
      const exps = new Map<number, Rational>()
      for (const [p, e] of a.exps) exps.set(p, mul(e, rb))
      return norm({ kind: 'pp', sign, exps: cleaned(exps) })
    }
    if (rb.d === 1 && Math.abs(rb.n) <= 8) {
      let out: ExactValue = ppOfRational(R1)
      for (let i = 0; i < Math.abs(rb.n); i++) out = exactMul(out, a)
      return rb.n < 0 ? exactInverse(out) : out
    }
    throw new Unsupported('power of a log')
  }
  // Irrational exponent: a must be a positive power product, a^b = e^(b · ln a).
  if (a.kind !== 'pp' || a.sign < 0) {
    if (a.kind === 'zero') throw new Unsupported('0 to an irrational power')
    if (a.kind === 'pp') return 'undef'
    throw new Unsupported('log to an irrational power')
  }
  const lnA = exactLn(a)
  if (lnA === 'undef') return lnA
  return exactExpOf(exactMul(b, lnA))
}

/** log_b(a) = ln a / ln b; b must be positive and not 1. */
export function exactLog(a: ExactValue, b: ExactValue): ExactValue | 'undef' {
  const la = exactLn(a)
  if (la === 'undef') return la
  const lb = exactLn(b)
  if (lb === 'undef' || lb.kind === 'zero') return 'undef'
  return exactDiv(la, lb)
}

// ---------------------------------------------------------------------------
// Numbers and comparison
// ---------------------------------------------------------------------------

function llNumber(v: LL): number {
  let s = ratToNumber(v.c)
  for (const [p, k] of v.logs) s += ratToNumber(k) * Math.log(p)
  return s
}

/** The value is a rational number (integer exponents, no e), however large. */
export function exactIsRational(v: ExactValue): boolean {
  const x = norm(v)
  if (x.kind === 'zero') return true
  if (x.kind === 'pp') return [...x.exps].every(([p, e]) => p !== E && e.d === 1)
  return false
}

export function exactToNumber(v: ExactValue): number {
  if (v.kind === 'zero') return 0
  const r = exactRational(v)
  if (r) return ratToNumber(r)
  if (v.kind === 'pp') {
    let s = 0
    for (const [p, e] of v.exps) s += ratToNumber(e) * (p === E ? 1 : Math.log(p))
    return v.sign * Math.exp(s)
  }
  if (v.kind === 'll') return llNumber(v)
  return llNumber(v.num) / llNumber(v.den)
}

function mapsEqual<K>(a: ReadonlyMap<K, Rational>, b: ReadonlyMap<K, Rational>): boolean {
  if (a.size !== b.size) return false
  for (const [k, v] of a) {
    const w = b.get(k)
    if (!w || ratCompare(v, w) !== 0) return false
  }
  return true
}

type Quad = Map<string, Rational>

/** The product of two log-linear forms as a polynomial in the ln p (for comparing ratios). */
function llProduct(a: LL, b: LL): Quad {
  const terms: [string, Rational][] = []
  const parts = (v: LL): [string, Rational][] => [['1', v.c], ...[...v.logs].map(([p, k]) => [String(p), k] as [string, Rational])]
  for (const [ka, ca] of parts(a)) {
    for (const [kb, cb] of parts(b)) {
      const key = ka === '1' ? kb : kb === '1' ? ka : [ka, kb].sort((x, y) => Number(x) - Number(y)).join('*')
      terms.push([key, mul(ca, cb)])
    }
  }
  const out: Quad = new Map()
  for (const [k, c] of terms) out.set(k, add(out.get(k) ?? R0, c))
  for (const [k, v] of [...out]) if (v.n === 0) out.delete(k)
  return out
}

/** Exact equality (throws Unsupported only from inside the arithmetic, never here). */
export function exactEquals(a: ExactValue, b: ExactValue): boolean {
  const x = norm(a)
  const y = norm(b)
  if (x.kind === 'zero' || y.kind === 'zero') return x.kind === y.kind
  if (x.kind === 'pp' && y.kind === 'pp') return x.sign === y.sign && mapsEqual(x.exps, y.exps)
  if (x.kind === 'll' && y.kind === 'll') return ratCompare(x.c, y.c) === 0 && mapsEqual(x.logs, y.logs)
  const rx = x.kind === 'ratio' ? x : x.kind === 'll' ? { num: x, den: llOf(R1) } : null
  const ry = y.kind === 'ratio' ? y : y.kind === 'll' ? { num: y, den: llOf(R1) } : null
  if (rx && ry) return mapsEqual(llProduct(rx.num, ry.den), llProduct(ry.num, rx.den))
  // A power product with an irrational part never equals a log form unless both are rational (handled above).
  return false
}

// ---------------------------------------------------------------------------
// Evaluation of a parsed constant expression
// ---------------------------------------------------------------------------

function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

const LN10: ExactValue = { kind: 'll', c: R0, logs: new Map([[2, R1], [5, R1]]) }

/**
 * Exact value of a constant tree (no variables): numbers (0.001 is 1/1000), e, + − × ÷ ^, sqrt, cbrt,
 * nthRoot, abs, exp, ln, log (base 10), log(u, b). 'undef' where the evaluator is undefined (log of 0 or a
 * negative, a base of 1, division by 0, an even root of a negative). Throws Unsupported outside the model.
 */
export function exactEvalLog(node: MathNode): ExactValue | 'undef' {
  const n = unwrap(node)
  const rec = n as unknown as Record<string, unknown>
  if (n.type === 'ConstantNode') {
    if (typeof rec.value !== 'number') throw new Unsupported('non-numeric constant')
    const r = safe(() => exactLiteral(rec.value as number))
    return r.n === 0 ? ZERO : ppOfRational(r)
  }
  if (n.type === 'SymbolNode') {
    if (symbolName(n) === 'e') return { kind: 'pp', sign: 1, exps: new Map([[E, R1]]) }
    throw new Unsupported(`symbol ${String(rec.name)}`)
  }
  const args = nodeArgs(n)
  const val = (i: number): ExactValue | 'undef' => exactEvalLog(args[i]!)
  if (n.type === 'OperatorNode') {
    if (isUnaryMinus(n)) {
      const v = val(0)
      return v === 'undef' ? v : exactNeg(v)
    }
    if (rec.fn === 'unaryPlus') return val(0)
    const a = val(0)
    const b = val(1)
    if (a === 'undef' || b === 'undef') return 'undef'
    if (isOp(n, '+')) return exactAdd(a, b)
    if (isOp(n, '-')) return exactAdd(a, exactNeg(b))
    if (isOp(n, '*')) return exactMul(a, b)
    if (isOp(n, '/')) return exactDiv(a, b)
    if (isOp(n, '^')) return exactPow(a, b)
    throw new Unsupported(`operator ${String(rec.op)}`)
  }
  if (n.type === 'FunctionNode') {
    const name = fnName(n)
    const a = val(0)
    if (a === 'undef') return a
    switch (name) {
      case 'ln':
        return exactLn(a)
      case 'log':
      case 'log10': {
        if (args.length === 2) {
          const b = val(1)
          if (b === 'undef') return b
          if (b.kind === 'pp' && b.sign > 0 && exactEquals(b, ppOfRational(R1))) return 'undef'
          return exactLog(a, b)
        }
        const la = exactLn(a)
        return la === 'undef' ? la : exactDiv(la, LN10)
      }
      case 'log2': {
        const la = exactLn(a)
        return la === 'undef' ? la : exactDiv(la, { kind: 'll', c: R0, logs: new Map([[2, R1]]) })
      }
      case 'exp':
        return exactPow({ kind: 'pp', sign: 1, exps: new Map([[E, R1]]) }, a)
      case 'sqrt': {
        if (a.kind === 'pp' && a.sign < 0) return 'undef'
        if (a.kind !== 'pp' && a.kind !== 'zero') {
          if (exactToNumber(a) < 0) return 'undef'
          throw new Unsupported('square root of a log')
        }
        return exactPow(a, ppOfRational(rat(1, 2)))
      }
      case 'cbrt':
        return exactPow(a, ppOfRational(rat(1, 3)))
      case 'nthRoot':
      case 'nthroot': {
        const k = val(1)
        if (k === 'undef') return k
        const kr = exactRational(k)
        if (!kr || kr.d !== 1 || kr.n < 2) throw new Unsupported('root index')
        if (kr.n % 2 === 0 && a.kind === 'pp' && a.sign < 0) return 'undef'
        return exactPow(a, ppOfRational(rat(1, kr.n)))
      }
      case 'abs':
        return exactToNumber(a) < 0 ? exactNeg(a) : a
      default:
        throw new Unsupported(`function ${name}`)
    }
  }
  throw new Unsupported(`node ${n.type}`)
}

/** Exact value or null when outside the model. */
export function tryExact(node: MathNode): ExactValue | 'undef' | null {
  try {
    return exactEvalLog(node)
  } catch (e) {
    if (e instanceof Unsupported) return null
    throw e
  }
}
