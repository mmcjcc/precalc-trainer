/**
 * Factoring over the integers (precalculus Unit 2, factoring review): the complete factorization of a
 * polynomial with integer coefficients, her typed product read factor by factor, and the comparison of the
 * two as multisets of factors up to order and sign.
 *
 * Exact throughout. The polynomial arithmetic, the rational roots and the reader are the existing ones
 * (`../functions/poly`, `readFormula`); this file only splits a parse tree at its top-level products and
 * normalizes each factor.
 *
 * Model: a factorization is an integer unit (the content, with the sign that makes every other factor's
 * leading coefficient positive) times primitive integer polynomials with multiplicities. Linear factors come
 * from the rational roots; what is left after them must have degree 3 or less (it then has no rational root,
 * so it is irreducible over the integers). A leftover of degree 4 or more is outside the model: null.
 */
import type { ParseError, Rational } from '@/shared/types'
import { rat, ratCompare, ratDiv, ratMul, ratNeg, ratToString } from '@/notation/rational'
import { isOp, isUnaryMinus, nodeArgs, type MathNode } from '../math'
import { exactConstant } from '../functions/exact'
import { polyDeg, polyEquals, polyLead, polyMul, polyOf, polyPow, polyScale, polyToText, rationalRoots, type Poly } from '../functions/poly'
import { guard, readFormula, readPoly } from './common'
import type { PolyInput } from './types'

/** One irreducible factor over the integers: primitive, integer coefficients, positive leading coefficient. */
export interface IntFactor {
  /** Coefficients from the constant term up (the functions core's `Poly`). */
  poly: Poly
  mult: number
  /** The factor alone, app syntax: "x - 2", "x^2 + 2x + 4", "x". */
  text: string
}

export interface IntFactorization {
  /** The polynomial, standard form, app syntax. */
  f: string
  /** The integer in front (the content, signed so every factor has a positive leading coefficient). */
  unit: Rational
  /** Monomial x first, then by degree, then linear factors by their zero (ascending). */
  factors: IntFactor[]
  /** The whole product, app syntax: "2(x + 3)(x^2 - 3x + 9)", "x(x - 2)(x^2 + 2x + 4)". */
  text: string
  /** True when the polynomial is itself irreducible over the integers (no factor of degree ≥ 1 splits off, unit ±1). */
  prime: boolean
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

function lcmInt(a: number, b: number): number {
  return (a / gcdInt(a, b)) * b
}

/** Integer coefficients? */
export function isIntegerPoly(p: Poly): boolean {
  return p.every((c) => c.d === 1)
}

/**
 * p = content · primitive, where primitive has integer coefficients with gcd 1 and a positive leading
 * coefficient. Works for rational coefficients too (the content is then a fraction). The zero polynomial
 * has no content: null.
 */
export function primitivePart(p: Poly): { content: Rational; primitive: Poly } | null {
  if (!p.length) return null
  let l = 1
  for (const c of p) l = lcmInt(l, c.d)
  let g = 0
  for (const c of p) g = gcdInt(g, c.n * (l / c.d))
  let content = rat(g, l)
  if (polyLead(p).n < 0) content = ratNeg(content)
  const primitive = polyScale(p, ratDiv(rat(1), content))
  return { content, primitive }
}

/** "x - 2" for a factor alone; "(x - 2)" inside a product (a single term like x stays bare). */
function factorAlone(p: Poly): string {
  return polyToText(p)
}

function wrapped(p: Poly): string {
  const text = polyToText(p)
  return p.filter((c) => c.n !== 0).length === 1 && /^[a-z](\^\d+)?$/.test(text) ? text : `(${text})`
}

/** "2", "-", "" (for 1), "(1/2)" in front of a product. */
function unitText(u: Rational): string {
  if (u.n === u.d) return ''
  if (u.n === -u.d) return '-'
  return u.d === 1 ? `${u.n}` : `(${ratToString(u)})`
}

/** A product as text, app syntax: the unit, then each factor with its exponent. */
export function productText(unit: Rational, factors: readonly { poly: Poly; mult: number }[]): string {
  const body = factors.map((f) => `${wrapped(f.poly)}${f.mult > 1 ? `^${f.mult}` : ''}`).join('')
  if (!body) return ratToString(unit)
  return `${unitText(unit)}${body}`
}

const X: Poly = [rat(0), rat(1)]

function factorOrder(a: IntFactor, b: IntFactor): number {
  const ax = polyEquals(a.poly, X)
  const bx = polyEquals(b.poly, X)
  if (ax !== bx) return ax ? -1 : 1
  const da = polyDeg(a.poly)
  const db = polyDeg(b.poly)
  if (da !== db) return da - db
  if (da === 1) {
    // Linear: by the zero, ascending: (x + 2) before (x - 2).
    const za = rat(-a.poly[0]!.n * b.poly[1]!.n, 1)
    const zb = rat(-b.poly[0]!.n * a.poly[1]!.n, 1)
    return ratCompare(za, zb) || a.poly[1]!.n - b.poly[1]!.n
  }
  return polyToText(a.poly).localeCompare(polyToText(b.poly))
}

const FACTOR_CACHE = new Map<string, IntFactorization | null>()

/**
 * The complete factorization over the integers. Null unless the polynomial has integer coefficients and
 * degree ≥ 1, or when what is left after the rational roots has degree 4 or more (outside the model).
 */
export function factorOverIntegers(input: PolyInput): IntFactorization | null {
  const key = typeof input === 'string' ? input : JSON.stringify(input)
  const hit = FACTOR_CACHE.get(key)
  if (hit !== undefined) return hit
  const out = guard(() => factorUncached(input))
  if (FACTOR_CACHE.size > 512) FACTOR_CACHE.clear()
  FACTOR_CACHE.set(key, out)
  return out
}

function factorUncached(input: PolyInput): IntFactorization | null {
  const src = readPoly(input)
  if (!src || polyDeg(src.poly) < 1 || !isIntegerPoly(src.poly)) return null
  const pp = primitivePart(src.poly)!
  const factors: IntFactor[] = []
  const rr = rationalRoots(pp.primitive)
  rr.roots.forEach((r, i) => {
    // (x − n/d) → the primitive factor d·x − n.
    const poly: Poly = r.n === 0 ? X : [rat(-r.n), rat(r.d)]
    factors.push({ poly, mult: rr.mult[i]!, text: factorAlone(poly) })
  })
  if (polyDeg(rr.rest) >= 1) {
    if (polyDeg(rr.rest) >= 4) return null
    const rest = primitivePart(rr.rest)!.primitive
    factors.push({ poly: rest, mult: 1, text: factorAlone(rest) })
  }
  factors.sort(factorOrder)
  // The product must give the polynomial back exactly (the unit absorbs nothing else: Gauss's lemma).
  let back: Poly = [pp.content]
  for (const f of factors) back = polyMul(back, polyPow(f.poly, f.mult))
  if (!polyEquals(back, src.poly)) return null
  const total = factors.reduce((s, f) => s + f.mult, 0)
  return {
    f: src.text,
    unit: pp.content,
    factors,
    text: productText(pp.content, factors),
    prime: total === 1 && Math.abs(pp.content.n) === 1 && pp.content.d === 1,
  }
}

// ---------------------------------------------------------------------------
// Her typed product
// ---------------------------------------------------------------------------

/** One factor of her product as she wrote it. */
export interface ProductLeaf {
  /** Exact coefficients of the factor. */
  poly: Poly
  /** Its exponent (written ^n, or repeated). */
  mult: number
  /** The factor, app syntax as the engine prints it: "2x - 4". */
  text: string
}

export type ProductReading =
  | {
      ok: true
      /** Everything multiplied out. */
      poly: Poly
      /** The numbers in front, multiplied together. */
      constant: Rational
      /** The factors that contain x, in the order she wrote them. */
      leaves: ProductLeaf[]
      /** More than one factor with x, or one with a number other than ±1 in front. */
      isProduct: boolean
    }
  | { ok: false; error: ParseError }
  | { ok: false; notPolynomial: true }

function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

class NotPoly extends Error {}

function splitInto(node: MathNode, mult: number, acc: { constant: Rational; leaves: ProductLeaf[] }): void {
  const n = unwrap(node)
  const args = nodeArgs(n)
  if (n.type === 'OperatorNode') {
    if (isUnaryMinus(n)) {
      if (mult % 2 === 1) acc.constant = ratNeg(acc.constant)
      splitInto(args[0]!, mult, acc)
      return
    }
    if ((n as unknown as { fn?: string }).fn === 'unaryPlus') {
      splitInto(args[0]!, mult, acc)
      return
    }
    if (isOp(n, '*')) {
      for (const a of args) splitInto(a, mult, acc)
      return
    }
    if (isOp(n, '^')) {
      const e = guard(() => exactConstant(args[1]!))
      if (e && e.d === 1 && e.n >= 1 && e.n <= 24) {
        splitInto(args[0]!, mult * e.n, acc)
        return
      }
    }
    if (isOp(n, '/')) {
      const d = guard(() => exactConstant(args[1]!))
      if (d && d.n !== 0) {
        acc.constant = ratMul(acc.constant, powRat(ratDiv(rat(1), d), mult))
        splitInto(args[0]!, mult, acc)
        return
      }
    }
  }
  const poly = polyOf(n)
  if (!poly) throw new NotPoly()
  if (polyDeg(poly) <= 0) {
    acc.constant = ratMul(acc.constant, powRat(poly[0] ?? rat(0), mult))
    return
  }
  acc.leaves.push({ poly, mult, text: polyToText(poly) })
}

function powRat(r: Rational, e: number): Rational {
  let out = rat(1)
  for (let i = 0; i < e; i++) out = ratMul(out, r)
  return out
}

/** Her answer read as a product: the numbers in front and each factor with x. Never throws. */
export function readProduct(text: string): ProductReading {
  const f = readFormula(text)
  if (!f.ok) return { ok: false, error: f.error }
  const out = guard(() => {
    const acc = { constant: rat(1), leaves: [] as ProductLeaf[] }
    try {
      splitInto(f.node, 1, acc)
    } catch (e) {
      if (e instanceof NotPoly) return null
      throw e
    }
    let poly: Poly = [acc.constant]
    for (const leaf of acc.leaves) poly = polyMul(poly, polyPow(leaf.poly, leaf.mult))
    const count = acc.leaves.reduce((s, l) => s + l.mult, 0)
    const unitLike = acc.constant.d === 1 && Math.abs(acc.constant.n) === 1
    return { ok: true as const, poly: polyScale(poly, rat(1)), constant: acc.constant, leaves: acc.leaves, isProduct: count >= 2 || (count === 1 && !unitLike) }
  })
  if (!out) return { ok: false, notPolynomial: true }
  return out
}

// ---------------------------------------------------------------------------
// Comparing her product with the complete factorization
// ---------------------------------------------------------------------------

export type FactoredCheck =
  /** Her text does not parse. */
  | { status: 'unreadable'; error: ParseError }
  /** It parses, but it is not a polynomial in x (a square root, x in a denominator, …). */
  | { status: 'not_polynomial' }
  /** Multiplied out, it is a different polynomial. */
  | { status: 'not_equal'; herPoly: Poly; reading: Extract<ProductReading, { ok: true }> }
  /** It is the polynomial itself, not a product (typed back, perhaps rearranged). */
  | { status: 'not_product'; herPoly: Poly }
  /** A factor has a coefficient that is not a whole number (x − 1/2 with a 2 in front). */
  | { status: 'not_integer'; leaf: ProductLeaf }
  /**
   * The right product, not finished: `leaf` still has a common factor (`common_factor`: a whole number, or
   * x, divides every term) or splits into factors over the integers (`splits`).
   */
  | { status: 'incomplete'; reason: 'common_factor' | 'splits'; leaf: ProductLeaf; reading: Extract<ProductReading, { ok: true }> }
  /** Factored completely: her factors are the engine's, up to order and sign. */
  | { status: 'complete'; reading: Extract<ProductReading, { ok: true }> }

/**
 * Her typed product against the complete factorization of `given`. In this order: it must read, be a
 * polynomial, multiply out to `given` exactly, be a product, have whole-number coefficients, and have no
 * factor that still factors. Null when `given` is outside the model (see `factorOverIntegers`).
 */
export function checkFactored(given: PolyInput, answer: string): FactoredCheck | null {
  const full = factorOverIntegers(given)
  const src = readPoly(given)
  if (!full || !src) return null
  const r = readProduct(answer)
  if (!r.ok) return 'error' in r ? { status: 'unreadable', error: r.error } : { status: 'not_polynomial' }
  if (!polyEquals(r.poly, src.poly)) return { status: 'not_equal', herPoly: r.poly, reading: r }
  if (!r.isProduct) return { status: 'not_product', herPoly: r.poly }
  for (const leaf of r.leaves) if (!isIntegerPoly(leaf.poly)) return { status: 'not_integer', leaf }
  for (const leaf of r.leaves) {
    if (hasCommonFactor(leaf.poly)) return { status: 'incomplete', reason: 'common_factor', leaf, reading: r }
  }
  // Every primitive factor of hers must be one of the irreducible factors; one that is not splits further.
  for (const leaf of r.leaves) {
    const prim = primitivePart(leaf.poly)!.primitive
    if (!full.factors.some((f) => polyEquals(f.poly, prim))) return { status: 'incomplete', reason: 'splits', leaf, reading: r }
  }
  return sameMultiset(r.leaves, full.factors) ? { status: 'complete', reading: r } : { status: 'incomplete', reason: 'splits', leaf: r.leaves[0]!, reading: r }
}

/** A whole number other than ±1 divides every coefficient, or x divides every term (and the factor is not x itself). */
export function hasCommonFactor(p: Poly): boolean {
  const pp = primitivePart(p)
  if (!pp) return false
  if (!(Math.abs(pp.content.n) === 1 && pp.content.d === 1) && isIntegerPoly(p)) return true
  return polyDeg(p) >= 1 && p[0]!.n === 0 && !polyEquals(pp.primitive, X)
}

function sameMultiset(leaves: readonly { poly: Poly; mult: number }[], factors: readonly { poly: Poly; mult: number }[]): boolean {
  const count = (list: readonly { poly: Poly; mult: number }[]) => {
    const m = new Map<string, number>()
    for (const f of list) {
      const prim = primitivePart(f.poly)!.primitive
      const k = polyToText(prim)
      m.set(k, (m.get(k) ?? 0) + f.mult)
    }
    return m
  }
  const a = count(leaves)
  const b = count(factors)
  return a.size === b.size && [...a].every(([k, v]) => b.get(k) === v)
}

/**
 * Two products are the same factorization: the same irreducible factors with the same multiplicities, up to
 * order and sign, and the same polynomial when multiplied out. For tests and hand-worked pins.
 */
export function sameFactorization(a: string, b: string): boolean {
  const ra = readProduct(a)
  const rb = readProduct(b)
  if (!ra.ok || !rb.ok) return false
  if (!polyEquals(ra.poly, rb.poly)) return false
  return sameMultiset(ra.leaves, rb.leaves)
}

/** Her product multiplied out, display text with the real minus sign: "x^3 + 4x^2 + 4x + 8". */
export function expandedPretty(p: Poly): string {
  return polyToText(p).replace(/-/g, '−')
}
