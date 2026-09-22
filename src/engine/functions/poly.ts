/**
 * Exact polynomials with rational coefficients, rational functions read off the parse tree, rational
 * roots (rational-root theorem with exact deflation) and a Sturm count that proves "no other real
 * roots". Every entry point either answers exactly or throws `Unsupported`.
 */
import type { Rational } from '@/shared/types'
import { rat, ratAdd, ratCompare, ratDiv, ratMul, ratNeg, ratSub, ratToString } from '@/notation/rational'
import { fnName, isOp, isUnaryMinus, nodeArgs, type MathNode } from '../math'
import { exactConstant, exactLiteral, Unsupported } from './exact'

/** Coefficients from the constant term up; trimmed (no zero leading coefficient); [] is the zero polynomial. */
export type Poly = readonly Rational[]

/** A rational function num/den as it was written (common factors are NOT cancelled). */
export interface RatFn {
  num: Poly
  den: Poly
}

const MAX_DEGREE = 24

function safe<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Unsupported) throw e
    throw new Unsupported(String((e as { message?: string })?.message ?? e))
  }
}

export function polyTrim(p: readonly Rational[]): Poly {
  let end = p.length
  while (end > 0 && p[end - 1]!.n === 0) end--
  return p.slice(0, end)
}

export const P_ZERO: Poly = []
export const P_ONE: Poly = [rat(1)]
export const P_X: Poly = [rat(0), rat(1)]

export function polyConst(r: Rational): Poly {
  return polyTrim([r])
}

/** Degree; −1 for the zero polynomial. */
export function polyDeg(p: Poly): number {
  return p.length - 1
}

export function polyLead(p: Poly): Rational {
  return p[p.length - 1] ?? rat(0)
}

export function polyIsZero(p: Poly): boolean {
  return p.length === 0
}

export function polyEquals(a: Poly, b: Poly): boolean {
  return a.length === b.length && a.every((c, i) => ratCompare(c, b[i]!) === 0)
}

export function polyAdd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length)
  const out: Rational[] = []
  for (let i = 0; i < n; i++) out.push(safe(() => ratAdd(a[i] ?? rat(0), b[i] ?? rat(0))))
  return polyTrim(out)
}

export function polyNeg(a: Poly): Poly {
  return a.map(ratNeg)
}

export function polySub(a: Poly, b: Poly): Poly {
  return polyAdd(a, polyNeg(b))
}

export function polyScale(a: Poly, r: Rational): Poly {
  return polyTrim(a.map((c) => safe(() => ratMul(c, r))))
}

export function polyMul(a: Poly, b: Poly): Poly {
  if (!a.length || !b.length) return P_ZERO
  if (a.length + b.length - 2 > MAX_DEGREE) throw new Unsupported('degree too high')
  const out: Rational[] = Array.from({ length: a.length + b.length - 1 }, () => rat(0))
  a.forEach((x, i) => {
    b.forEach((y, j) => {
      out[i + j] = safe(() => ratAdd(out[i + j]!, ratMul(x, y)))
    })
  })
  return polyTrim(out)
}

export function polyPow(a: Poly, n: number): Poly {
  if (!Number.isInteger(n) || n < 0) throw new Unsupported(`power ${n}`)
  let out: Poly = P_ONE
  for (let i = 0; i < n; i++) out = polyMul(out, a)
  return out
}

/** Horner, exact. */
export function polyEval(p: Poly, x: Rational): Rational {
  let acc = rat(0)
  for (let i = p.length - 1; i >= 0; i--) acc = safe(() => ratAdd(ratMul(acc, x), p[i]!))
  return acc
}

export function polyDivmod(a: Poly, b: Poly): { q: Poly; r: Poly } {
  if (!b.length) throw new Unsupported('division by the zero polynomial')
  const db = b.length - 1
  const lb = polyLead(b)
  const r: Rational[] = [...a]
  const q: Rational[] = Array.from({ length: Math.max(0, a.length - db) }, () => rat(0))
  for (let i = a.length - 1; i >= db; i--) {
    const c = r[i]!
    if (c.n === 0) continue
    const f = safe(() => ratDiv(c, lb))
    q[i - db] = f
    for (let j = 0; j <= db; j++) r[i - db + j] = safe(() => ratSub(r[i - db + j]!, ratMul(f, b[j]!)))
  }
  return { q: polyTrim(q), r: polyTrim(r.slice(0, db)) }
}

/** Monic gcd (the zero polynomial when both are zero). */
export function polyGcd(a: Poly, b: Poly): Poly {
  let x = a
  let y = b
  while (y.length) {
    const { r } = polyDivmod(x, y)
    x = y
    y = r
  }
  if (!x.length) return P_ZERO
  return polyScale(x, safe(() => ratDiv(rat(1), polyLead(x))))
}

export function polyDerivative(p: Poly): Poly {
  return polyTrim(p.slice(1).map((c, i) => safe(() => ratMul(c, rat(i + 1)))))
}

// ---------------------------------------------------------------------------
// Reading polynomials and rational functions off the tree
// ---------------------------------------------------------------------------

function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

function ratFnInner(node: MathNode, v: string): RatFn {
  const n = unwrap(node)
  const rec = n as unknown as Record<string, unknown>
  if (n.type === 'ConstantNode') {
    if (typeof rec.value !== 'number') throw new Unsupported('constant')
    return { num: polyConst(exactLiteral(rec.value)), den: P_ONE }
  }
  if (n.type === 'SymbolNode') {
    if (rec.name === v) return { num: P_X, den: P_ONE }
    throw new Unsupported(`symbol ${String(rec.name)}`)
  }
  if (n.type !== 'OperatorNode') throw new Unsupported(`not rational: ${n.type} ${fnName(n) ?? ''}`)
  const args = nodeArgs(n)
  if (isUnaryMinus(n)) {
    const a = ratFnInner(args[0]!, v)
    return { num: polyNeg(a.num), den: a.den }
  }
  if (rec.fn === 'unaryPlus') return ratFnInner(args[0]!, v)
  if (isOp(n, '^')) {
    const e = exactConstant(args[1]!)
    if (e.d !== 1) throw new Unsupported('fractional power')
    const b = ratFnInner(args[0]!, v)
    if (e.n >= 0) return { num: polyPow(b.num, e.n), den: polyPow(b.den, e.n) }
    if (polyIsZero(b.num)) throw new Unsupported('zero to a negative power')
    return { num: polyPow(b.den, -e.n), den: polyPow(b.num, -e.n) }
  }
  const a = ratFnInner(args[0]!, v)
  const b = ratFnInner(args[1]!, v)
  if (isOp(n, '+') || isOp(n, '-')) {
    const sign = isOp(n, '-') ? polyNeg : (p: Poly) => p
    if (polyEquals(a.den, b.den)) return { num: polyAdd(a.num, sign(b.num)), den: a.den }
    return { num: polyAdd(polyMul(a.num, b.den), sign(polyMul(b.num, a.den))), den: polyMul(a.den, b.den) }
  }
  if (isOp(n, '*')) return { num: polyMul(a.num, b.num), den: polyMul(a.den, b.den) }
  if (isOp(n, '/')) {
    if (polyIsZero(b.num)) throw new Unsupported('division by zero')
    return { num: polyMul(a.num, b.den), den: polyMul(a.den, b.num) }
  }
  throw new Unsupported(`operator ${String(rec.op)}`)
}

/** num/den when `node` is built from numbers, the variable, + − × ÷ and integer powers; else null. */
export function ratFnOf(node: MathNode, v = 'x'): RatFn | null {
  try {
    return ratFnInner(node, v)
  } catch (e) {
    if (e instanceof Unsupported) return null
    throw e
  }
}

/** The polynomial when `node` is one (its written denominators are all constants); else null. */
export function polyOf(node: MathNode, v = 'x'): Poly | null {
  const f = ratFnOf(node, v)
  if (!f || polyDeg(f.den) !== 0) return null
  return polyScale(f.num, safe(() => ratDiv(rat(1), f.den[0]!)))
}

/** Cancel the gcd; denominator with positive leading coefficient and integer coefficients. */
export function ratFnReduce(f: RatFn): RatFn {
  const g = polyGcd(f.num, f.den)
  let num = f.num
  let den = f.den
  if (g.length > 1) {
    num = polyDivmod(num, g).q
    den = polyDivmod(den, g).q
  }
  // Scale both by the lcm of all denominators / gcd of numerators so everything is an integer.
  const all = [...num, ...den]
  let l = 1
  for (const c of all) l = lcm(l, c.d)
  let gn = 0
  for (const c of all) gn = gcdInt(gn, c.n * (l / c.d))
  let factor = safe(() => rat(l, gn || 1))
  if (polyLead(den).n < 0) factor = ratNeg(factor)
  return { num: polyScale(num, factor), den: polyScale(den, factor) }
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

function lcm(a: number, b: number): number {
  const out = (a / gcdInt(a, b)) * b
  if (!Number.isSafeInteger(out)) throw new Unsupported('lcm overflow')
  return out
}

// ---------------------------------------------------------------------------
// Roots
// ---------------------------------------------------------------------------

export interface RationalRoots {
  /** Distinct rational roots, ascending. */
  roots: Rational[]
  /** Multiplicity of each root (same order). */
  mult: number[]
  /** What is left after dividing out every (x − r)^m: no rational roots. */
  rest: Poly
}

function divisors(n: number): number[] {
  const out: number[] = []
  for (let k = 1; k * k <= n; k++) {
    if (n % k === 0) {
      out.push(k)
      if (k * k !== n) out.push(n / k)
    }
  }
  return out
}

/** (x − r) divided out of p (p(r) = 0 is assumed). */
function deflate(p: Poly, r: Rational): Poly {
  return polyDivmod(p, [ratNeg(r), rat(1)]).q
}

/** Rational roots of a nonzero polynomial by the rational-root theorem, verified exactly. */
export function rationalRoots(p: Poly): RationalRoots {
  if (polyIsZero(p)) throw new Unsupported('zero polynomial')
  const found: { r: Rational; m: number }[] = []
  let work: Poly = p
  // Zero roots first.
  let zeros = 0
  while (work.length > 1 && work[0]!.n === 0) {
    work = work.slice(1)
    zeros++
  }
  if (zeros) found.push({ r: rat(0), m: zeros })
  if (polyDeg(work) >= 1) {
    let l = 1
    for (const c of work) l = lcm(l, c.d)
    const ints = work.map((c) => c.n * (l / c.d))
    if (!ints.every(Number.isSafeInteger)) throw new Unsupported('coefficients too large')
    const a0 = Math.abs(ints[0]!)
    const an = Math.abs(ints[ints.length - 1]!)
    if (a0 > 1e9 || an > 1e9) throw new Unsupported('coefficients too large')
    const ps = divisors(a0)
    const qs = divisors(an)
    if (ps.length * qs.length > 20000) throw new Unsupported('too many candidates')
    const seen = new Set<string>()
    const cands: Rational[] = []
    for (const pp of ps) {
      for (const qq of qs) {
        for (const s of [1, -1]) {
          const r = rat(s * pp, qq)
          const key = ratToString(r)
          if (!seen.has(key)) {
            seen.add(key)
            cands.push(r)
          }
        }
      }
    }
    for (const r of cands) {
      let m = 0
      while (polyDeg(work) >= 1 && polyEval(work, r).n === 0) {
        work = deflate(work, r)
        m++
      }
      if (m) found.push({ r, m })
    }
  }
  found.sort((a, b) => ratCompare(a.r, b.r))
  return { roots: found.map((f) => f.r), mult: found.map((f) => f.m), rest: work }
}

function signOf(r: Rational): number {
  return r.n < 0 ? -1 : r.n > 0 ? 1 : 0
}

/** Number of DISTINCT real roots (Sturm's theorem, exact). */
export function sturmCount(p: Poly): number {
  if (polyDeg(p) < 1) return 0
  const seq: Poly[] = [p, polyDerivative(p)]
  while (seq[seq.length - 1]!.length > 0 && polyDeg(seq[seq.length - 1]!) > 0) {
    const r = polyDivmod(seq[seq.length - 2]!, seq[seq.length - 1]!).r
    if (!r.length) break
    seq.push(polyNeg(r))
  }
  const variations = (signs: number[]) => {
    let v = 0
    let prev = 0
    for (const s of signs) {
      if (s === 0) continue
      if (prev !== 0 && s !== prev) v++
      prev = s
    }
    return v
  }
  const atPlus = seq.map((q) => signOf(polyLead(q)))
  const atMinus = seq.map((q) => signOf(polyLead(q)) * (polyDeg(q) % 2 === 0 ? 1 : -1))
  return variations(atMinus) - variations(atPlus)
}

/** All distinct real roots when every one of them is rational; throws Unsupported otherwise. */
export function realRootsExact(p: Poly): Rational[] {
  const rr = rationalRoots(p)
  if (polyDeg(rr.rest) >= 1 && sturmCount(rr.rest) > 0) throw new Unsupported('irrational real roots')
  return rr.roots
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function powText(v: string, k: number): string {
  return k === 0 ? '' : k === 1 ? v : `${v}^${k}`
}

/** App syntax, highest power first: "x^2 - 6x + 10", "-x^2 + 4x", "(1/2)x - 3/4", "0". */
export function polyToText(p: Poly, v = 'x'): string {
  if (!p.length) return '0'
  const terms: { neg: boolean; body: string }[] = []
  for (let k = p.length - 1; k >= 0; k--) {
    const c = p[k]!
    if (c.n === 0) continue
    const abs = rat(Math.abs(c.n), c.d)
    let coef: string
    if (k === 0) coef = ratToString(abs)
    else if (abs.n === 1 && abs.d === 1) coef = ''
    else if (abs.d === 1) coef = `${abs.n}`
    else coef = `(${ratToString(abs)})`
    terms.push({ neg: c.n < 0, body: `${coef}${powText(v, k)}` })
  }
  return terms.reduce((acc, t, i) => (i === 0 ? `${t.neg ? '-' : ''}${t.body}` : `${acc} ${t.neg ? '-' : '+'} ${t.body}`), '')
}

/** Number of written terms (for deciding whether a polynomial needs parentheses). */
export function polyTermCount(p: Poly): number {
  return p.filter((c) => c.n !== 0).length
}

/** The linear factor with root r as it is usually written: "x - 3", "2x + 1", "x". */
export function linearFactorText(r: Rational, v = 'x'): string {
  if (r.n === 0) return v
  const lead = r.d === 1 ? v : `${r.d}${v}`
  return r.n > 0 ? `${lead} - ${Math.abs(r.n)}` : `${lead} + ${Math.abs(r.n)}`
}

/**
 * Factored form when every root is rational, e.g. x^2 - 9 → "(x + 3)(x - 3)", 2x^2 - x - 1 →
 * "(2x + 1)(x - 1)". Null when there is an irreducible factor of degree ≥ 2 or p is constant.
 */
export function factoredText(p: Poly, v = 'x'): string | null {
  if (polyDeg(p) < 1) return null
  let rr: RationalRoots
  try {
    rr = rationalRoots(p)
  } catch (e) {
    if (e instanceof Unsupported) return null
    throw e
  }
  if (polyDeg(rr.rest) >= 1) return null
  // p = c · Π (d_i x − n_i)^m_i
  let c = polyLead(p)
  const parts: string[] = []
  rr.roots.forEach((r, i) => {
    const m = rr.mult[i]!
    c = safe(() => ratDiv(c, rat(r.d ** m)))
    const wrapped = r.n === 0 ? v : `(${linearFactorText(r, v)})`
    parts.push(m === 1 ? wrapped : `${wrapped}^${m}`)
  })
  const coef = c.n === c.d ? '' : c.n === -c.d ? '-' : c.d === 1 ? `${c.n}` : `(${ratToString(c)})`
  return `${coef}${parts.join('')}`
}

/** "(x + 1)/(2x - 1)", "x^2 - 6x + 10", "3/x", "-x/(2x - 1)" for a reduced rational function. */
export function ratFnToText(f: RatFn, v = 'x'): string {
  if (polyDeg(f.den) === 0) return polyToText(polyScale(f.num, safe(() => ratDiv(rat(1), f.den[0]!))), v)
  const numText = polyToText(f.num, v)
  const denText = polyToText(f.den, v)
  const numWrapped = polyTermCount(f.num) > 1 ? `(${numText})` : numText
  const denSimple = polyTermCount(f.den) === 1 && /^[a-z]$/.test(denText)
  return `${numWrapped}/${denSimple ? denText : `(${denText})`}`
}
