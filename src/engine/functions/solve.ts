/**
 * Exact domains and preimages.
 *
 * - `analyzeDomain(node)` walks the tree and lists every restriction: a denominator ≠ 0, an even-root
 *   radicand ≥ 0, an even root that is a factor of a denominator (radicand > 0), a negative integer
 *   power (base ≠ 0). The domain is the intersection of their solution sets. Odd roots are recorded (they
 *   restrict nothing; the odd-root mistake needs them).
 * - `solveEq(node, c)` = {x in dom : node(x) = c}, exactly. Rational functions go through their
 *   numerator polynomial (every real root must be rational; Sturm proves there are no others). Anything
 *   else is peeled from the outside: ± a constant, × or ÷ a constant, a constant ÷ it, −, √, even and odd
 *   roots, |·| and integer powers.
 * - `preimage(node, S)` = {x in dom : node(x) in S} by an exact sign chart: the cut points are the
 *   critical values of dom and of every solution set of node = c (c an endpoint of S), so the node
 *   is continuous and never crosses an endpoint of S inside a cell. Membership at the cut points is
 *   exact; inside a cell it is read at an interior rational point (exactly when the value is a surd)
 *   and double-checked at a second point.
 *
 * Every function throws `Unsupported` when it cannot decide exactly; the public functions turn that
 * into null.
 */
import type { Piece, Rational, SolutionSet } from '@/shared/types'
import { rat, ratAdd, ratDiv, ratMidpoint, ratMul, ratNeg, ratSub, ratToNumber, ratToString } from '@/notation/rational'
import {
  allReals,
  components,
  emptySet,
  isFiniteEndpoint,
  normalizeSet,
  setContains,
  setCriticalValues,
  setFromPieces,
  setIntersection,
  setUnion,
} from '@/notation/sets/solutionSet'
import { collectVars, compileExpression, evalNode, fnName, isOp, isUnaryMinus, nodeArgs, type MathNode } from '../math'
import {
  exactConstant,
  exactEval,
  integerRoot,
  surdCompareRat,
  surdToNumber,
  Unsupported,
  type ExactValue,
  type Surd,
} from './exact'
import { polyDeg, polyIsZero, polyOf, polyScale, polySub, ratFnOf, realRootsExact } from './poly'
import { showNode } from './text'

// ---------------------------------------------------------------------------
// Sets used as conditions
// ---------------------------------------------------------------------------

const ZERO = rat(0)
/** ℝ \ {0}: the condition "≠ 0". */
export const NONZERO: SolutionSet = setFromPieces([
  { lo: '-inf', hi: ZERO, loClosed: false, hiClosed: false },
  { lo: ZERO, hi: 'inf', loClosed: false, hiClosed: false },
])
/** [0, ∞): the condition "≥ 0". */
export const NONNEG: SolutionSet = setFromPieces([{ lo: ZERO, hi: 'inf', loClosed: true, hiClosed: false }])
/** (0, ∞): the condition "> 0". */
export const POSITIVE: SolutionSet = setFromPieces([{ lo: ZERO, hi: 'inf', loClosed: false, hiClosed: false }])

export type Relation = '!=' | '>=' | '>'

export function relationSet(rel: Relation): SolutionSet {
  return rel === '!=' ? NONZERO : rel === '>=' ? NONNEG : POSITIVE
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

export function unwrap(node: MathNode): MathNode {
  let n = node
  while (n.type === 'ParenthesisNode') n = (n as unknown as { content: MathNode }).content
  return n
}

export function hasX(node: MathNode): boolean {
  return collectVars(node).length > 0
}

export interface RootShape {
  /** The root node itself (sqrt(A), nthRoot(A, k), cbrt(A), A^(p/q)). */
  node: MathNode
  radicand: MathNode
  index: number
  even: boolean
  /** p of A^(p/q) (1 for the function forms). */
  power: number
}

/** sqrt / cbrt / nthRoot / fractional power → its radicand and index; null for anything else. */
export function rootShape(node: MathNode): RootShape | null {
  const n = unwrap(node)
  const args = nodeArgs(n)
  const name = fnName(n)
  if (name === 'sqrt' && args.length === 1) return { node: n, radicand: args[0]!, index: 2, even: true, power: 1 }
  if (name === 'cbrt' && args.length === 1) return { node: n, radicand: args[0]!, index: 3, even: false, power: 1 }
  if (name === 'nthRoot' && args.length === 2) {
    const k = exactConstant(args[1]!)
    if (k.d !== 1 || k.n < 2) throw new Unsupported('root index')
    return { node: n, radicand: args[0]!, index: k.n, even: k.n % 2 === 0, power: 1 }
  }
  if (isOp(n, '^') && !hasX(args[1]!)) {
    const e = exactConstant(args[1]!)
    if (e.d > 1) return { node: n, radicand: args[0]!, index: e.d, even: e.d % 2 === 0, power: e.n }
  }
  return null
}

// ---------------------------------------------------------------------------
// Restrictions
// ---------------------------------------------------------------------------

export type RestrictionKind = 'denominator' | 'even_root' | 'even_root_denominator'

export interface RestrictionInfo {
  kind: RestrictionKind
  /** The denominator D (kind 'denominator') or the radicand A (root kinds). */
  node: MathNode
  expr: string
  relation: Relation
  /** {x in dom(expr) : expr relation 0}. */
  set: SolutionSet
  /** Root index (root kinds). */
  index?: number
  /** Text of the whole root, e.g. "sqrt(x - 1)" (root kinds). */
  rootText?: string
  /** expr = a·x + b exactly (degree 1). */
  linear?: { a: Rational; b: Rational }
}

export interface OddRootInfo {
  radicand: MathNode
  expr: string
  rootText: string
  index: number
  /** The odd root is a factor of a denominator (so the odd-root mistake reads "radicand > 0"). */
  inDenominator: boolean
}

export interface DomainAnalysis {
  set: SolutionSet
  restrictions: RestrictionInfo[]
  oddRoots: OddRootInfo[]
}

interface WalkCtx {
  restrictions: RestrictionInfo[]
  oddRoots: OddRootInfo[]
}

function linearOf(node: MathNode): { a: Rational; b: Rational } | undefined {
  const p = polyOf(node)
  return p && polyDeg(p) === 1 ? { a: p[1]!, b: p[0]! } : undefined
}

function makeRestriction(kind: RestrictionKind, node: MathNode, relation: Relation, root?: RootShape): RestrictionInfo {
  const out: RestrictionInfo = {
    kind,
    node,
    expr: showNode(node),
    relation,
    set: preimage(node, relationSet(relation)),
  }
  const lin = linearOf(node)
  if (lin) out.linear = lin
  if (root) {
    out.index = root.index
    out.rootText = showNode(root.node)
  }
  return out
}

/** Non-constant multiplicative factors of a denominator (constants must be nonzero). */
function mulFactors(node: MathNode): MathNode[] {
  const n = unwrap(node)
  if (isOp(n, '*')) return nodeArgs(n).flatMap(mulFactors)
  if (isUnaryMinus(n) || (n as unknown as { fn?: string }).fn === 'unaryPlus') return mulFactors(nodeArgs(n)[0]!)
  if (!hasX(n)) {
    const v = constValue(n)
    if (v === 'undef' || v === 0 || (typeof v !== 'number' && v.terms.length === 0)) throw new Unsupported('zero denominator')
    return []
  }
  return [n]
}

/** An even root, or a positive integer power of one, as a denominator factor. */
function evenRootFactor(node: MathNode): RootShape | null {
  const n = unwrap(node)
  const r = rootShape(n)
  if (r) return r.even && r.power > 0 ? r : null
  if (isOp(n, '^') && !hasX(nodeArgs(n)[1]!)) {
    const e = exactConstant(nodeArgs(n)[1]!)
    if (e.d === 1 && e.n > 0) {
      const inner = rootShape(nodeArgs(n)[0]!)
      if (inner && inner.even && inner.power > 0) return inner
    }
  }
  return null
}

function pushEvenRoot(ctx: WalkCtx, r: RootShape, inDenominator: boolean): void {
  ctx.restrictions.push(makeRestriction(inDenominator ? 'even_root_denominator' : 'even_root', r.radicand, inDenominator ? '>' : '>=', r))
}

function denominator(d: MathNode, ctx: WalkCtx): void {
  const factors = mulFactors(d)
  const evens: RootShape[] = []
  const others: MathNode[] = []
  for (const f of factors) {
    const r = evenRootFactor(f)
    if (r) evens.push(r)
    else others.push(f)
  }
  for (const r of evens) {
    walk(r.radicand, ctx, false)
    pushEvenRoot(ctx, r, true)
  }
  if (!others.length) return
  for (const o of others) walk(o, ctx, true)
  const p = evens.length ? compileExpression(others.map((o) => `(${o.toString()})`).join(' * ')) : unwrap(d)
  ctx.restrictions.push(makeRestriction('denominator', p, '!='))
}

function walk(node: MathNode, ctx: WalkCtx, inDen: boolean): void {
  const n = unwrap(node)
  const rec = n as unknown as Record<string, unknown>
  if (n.type === 'ConstantNode') return
  if (n.type === 'SymbolNode') {
    if (rec.name === 'x' || rec.name === 'pi' || rec.name === 'e') return
    throw new Unsupported(`symbol ${String(rec.name)}`)
  }
  const args = nodeArgs(n)
  if (n.type === 'FunctionNode') {
    const name = fnName(n)
    if (name === 'abs' && args.length === 1) {
      walk(args[0]!, ctx, false)
      return
    }
    const r = rootShape(n)
    if (!r) throw new Unsupported(`function ${name}`)
    walk(r.radicand, ctx, false)
    if (r.even) pushEvenRoot(ctx, r, false)
    else ctx.oddRoots.push({ radicand: r.radicand, expr: showNode(r.radicand), rootText: showNode(n), index: r.index, inDenominator: inDen })
    return
  }
  if (n.type !== 'OperatorNode') throw new Unsupported(`node ${n.type}`)
  if (isOp(n, '/')) {
    walk(args[0]!, ctx, false)
    denominator(args[1]!, ctx)
    return
  }
  if (isOp(n, '^')) {
    if (hasX(args[1]!)) throw new Unsupported('variable exponent')
    const e = exactConstant(args[1]!)
    if (e.d === 1) {
      if (e.n < 0) denominator(args[0]!, ctx)
      else walk(args[0]!, ctx, inDen)
      return
    }
    // A^(p/q), q > 1: a q-th root raised to p (p < 0 puts it in a denominator).
    const r = rootShape(n)!
    walk(r.radicand, ctx, false)
    if (r.even) pushEvenRoot(ctx, r, e.n < 0)
    else {
      ctx.oddRoots.push({ radicand: r.radicand, expr: showNode(r.radicand), rootText: showNode(n), index: r.index, inDenominator: inDen || e.n < 0 })
      if (e.n < 0) ctx.restrictions.push(makeRestriction('denominator', r.radicand, '!='))
    }
    return
  }
  for (const a of args) walk(a, ctx, false)
}

const ANALYSIS_CACHE = new WeakMap<MathNode, DomainAnalysis>()

/** Every restriction of `node` and the exact domain (their intersection). Throws Unsupported. */
export function analyzeDomain(node: MathNode): DomainAnalysis {
  const n = unwrap(node)
  const hit = ANALYSIS_CACHE.get(n)
  if (hit) return hit
  const ctx: WalkCtx = { restrictions: [], oddRoots: [] }
  walk(n, ctx, false)
  const set = ctx.restrictions.reduce((s, r) => setIntersection(s, r.set), allReals())
  const out: DomainAnalysis = { set: normalizeSet(set), restrictions: ctx.restrictions, oddRoots: ctx.oddRoots }
  ANALYSIS_CACHE.set(n, out)
  return out
}

export function domainSet(node: MathNode): SolutionSet {
  return analyzeDomain(node).set
}

// ---------------------------------------------------------------------------
// Values and membership
// ---------------------------------------------------------------------------

/** Exact value of a constant subtree; a float for constants outside the exact model (pi). */
function constValue(node: MathNode): Surd | number | 'undef' {
  try {
    return exactEval(node, null)
  } catch (e) {
    if (!(e instanceof Unsupported)) throw e
    return evalNode(node, {})
  }
}

/** Exact rational value of a constant subtree (throws Unsupported when irrational). */
function K(node: MathNode): Rational {
  return exactConstant(node)
}

function cmpFloat(v: number, r: Rational): -1 | 0 | 1 {
  const d = ratToNumber(r)
  if (Math.abs(v - d) <= 1e-9 * Math.max(1, Math.abs(d))) throw new Unsupported('value too close to an endpoint')
  return v < d ? -1 : 1
}

/** Is the value (exact surd, or a float known not to equal any endpoint) in S? */
export function valueInSet(v: Surd | number, S: SolutionSet): boolean {
  const cmp = (r: Rational) => (typeof v === 'number' ? cmpFloat(v, r) : surdCompareRat(v, r))
  return components(S).some((p) => {
    if (isFiniteEndpoint(p.lo)) {
      const c = cmp(p.lo)
      if (c < 0 || (c === 0 && !p.loClosed)) return false
    }
    if (isFiniteEndpoint(p.hi)) {
      const c = cmp(p.hi)
      if (c > 0 || (c === 0 && !p.hiClosed)) return false
    }
    return true
  })
}

/** Value at a rational point: exact when possible, else a float; 'undef' outside the domain. */
export function valueAt(node: MathNode, t: Rational | Surd): ExactValue | number {
  try {
    return exactEval(node, t)
  } catch (e) {
    if (!(e instanceof Unsupported)) throw e
    const x = 'terms' in t ? surdToNumber(t) : ratToNumber(t)
    return evalNode(node, { x })
  }
}

// ---------------------------------------------------------------------------
// Solving node = c
// ---------------------------------------------------------------------------

const SOLVE_CACHE = new WeakMap<MathNode, Map<string, SolutionSet>>()

function points(rs: Rational[]): SolutionSet {
  return setFromPieces([], rs)
}

/** Exact rational k-th root of c (throws when c is not a perfect k-th power). */
function ratRoot(c: Rational, k: number): Rational {
  const n = integerRoot(Math.abs(c.n), k)
  const d = integerRoot(c.d, k)
  if (n === null || d === null) throw new Unsupported(`${ratToString(c)} is not a perfect power`)
  return rat(c.n < 0 ? -n : n, d)
}

function ratPow(c: Rational, k: number): Rational {
  let out = rat(1)
  for (let i = 0; i < k; i++) out = ratMul(out, c)
  return out
}

function safeRat<T>(fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof Unsupported) throw e
    throw new Unsupported(String((e as { message?: string })?.message ?? e))
  }
}

/** {x in dom(node) : node(x) = c}, exactly. Throws Unsupported. */
export function solveEq(node: MathNode, c: Rational): SolutionSet {
  const n = unwrap(node)
  const key = ratToString(c)
  let memo = SOLVE_CACHE.get(n)
  const hit = memo?.get(key)
  if (hit) return hit
  const dom = domainSet(n)
  let out: SolutionSet
  if (!hasX(n)) {
    const v = constValue(n)
    const equal = v !== 'undef' && (typeof v === 'number' ? cmpFloatEq(v, c) : surdCompareRat(v, c) === 0)
    out = equal ? dom : emptySet()
  } else {
    const rf = ratFnOf(n)
    if (rf) {
      const p = polySub(rf.num, polyScale(rf.den, c))
      out = polyIsZero(p) ? dom : setIntersection(points(realRootsExact(p)), dom)
    } else {
      out = setIntersection(safeRat(() => solveStructural(n, c)), dom)
    }
  }
  if (!memo) {
    memo = new Map()
    SOLVE_CACHE.set(n, memo)
  }
  memo.set(key, out)
  return out
}

function cmpFloatEq(v: number, c: Rational): boolean {
  const d = ratToNumber(c)
  return Math.abs(v - d) <= 1e-12 * Math.max(1, Math.abs(d))
}

function solvePow(a: MathNode, k: number, c: Rational): SolutionSet {
  if (k === 0) return c.n === c.d ? allReals() : emptySet()
  if (k < 0) {
    if (c.n === 0) return emptySet()
    return solvePow(a, -k, ratDiv(rat(1), c))
  }
  if (k % 2 === 1) return solveEq(a, ratRoot(c, k))
  if (c.n < 0) return emptySet()
  if (c.n === 0) return solveEq(a, ZERO)
  const r = ratRoot(c, k)
  return setUnion(solveEq(a, r), solveEq(a, ratNeg(r)))
}

function solveStructural(n: MathNode, c: Rational): SolutionSet {
  const args = nodeArgs(n)
  const rec = n as unknown as Record<string, unknown>
  if (n.type === 'OperatorNode') {
    if (isUnaryMinus(n)) return solveEq(args[0]!, ratNeg(c))
    if (rec.fn === 'unaryPlus') return solveEq(args[0]!, c)
    const [a, b] = [args[0]!, args[1]!]
    if (isOp(n, '+')) {
      if (!hasX(b)) return solveEq(a, ratSub(c, K(b)))
      if (!hasX(a)) return solveEq(b, ratSub(c, K(a)))
      throw new Unsupported('sum of two variable terms')
    }
    if (isOp(n, '-')) {
      if (!hasX(b)) return solveEq(a, ratAdd(c, K(b)))
      if (!hasX(a)) return solveEq(b, ratSub(K(a), c))
      throw new Unsupported('difference of two variable terms')
    }
    if (isOp(n, '*')) {
      const [k, inner] = !hasX(a) ? [K(a), b] : !hasX(b) ? [K(b), a] : [null, null]
      if (!k || !inner) throw new Unsupported('product of two variable factors')
      if (k.n === 0) return c.n === 0 ? allReals() : emptySet()
      return solveEq(inner, ratDiv(c, k))
    }
    if (isOp(n, '/')) {
      if (!hasX(b)) {
        const k = K(b)
        if (k.n === 0) return emptySet()
        return solveEq(a, ratMul(c, k))
      }
      if (!hasX(a)) {
        const k = K(a)
        if (k.n === 0) return c.n === 0 ? allReals() : emptySet()
        if (c.n === 0) return emptySet()
        return solveEq(b, ratDiv(k, c))
      }
      throw new Unsupported('quotient of two variable parts')
    }
    if (isOp(n, '^')) {
      const e = K(b)
      if (e.d === 1) return solvePow(a, e.n, c)
      // A^(p/q): a q-th root raised to p.
      const r = rootShape(n)!
      return solveRootPower(r, c)
    }
    throw new Unsupported(`operator ${String(rec.op)}`)
  }
  if (n.type === 'FunctionNode') {
    if (fnName(n) === 'abs') {
      const inner = args[0]!
      if (c.n < 0) return emptySet()
      if (c.n === 0) return solveEq(inner, ZERO)
      return setUnion(solveEq(inner, c), solveEq(inner, ratNeg(c)))
    }
    const r = rootShape(n)
    if (r) return solveRootPower(r, c)
  }
  throw new Unsupported(`cannot solve ${showNode(n)} = ${ratToString(c)}`)
}

/** root_q(A)^p = c. */
function solveRootPower(r: RootShape, c: Rational): SolutionSet {
  // First the value the root itself must take.
  let rootValues: Rational[]
  if (r.power === 1) rootValues = [c]
  else if (r.power < 0) {
    if (c.n === 0) return emptySet()
    const inv = ratDiv(rat(1), c)
    const k = -r.power
    if (k % 2 === 1) rootValues = [ratRoot(inv, k)]
    else if (inv.n < 0) return emptySet()
    else {
      const s = ratRoot(inv, k)
      rootValues = [s, ratNeg(s)]
    }
  } else {
    const k = r.power
    if (k % 2 === 1) rootValues = [ratRoot(c, k)]
    else if (c.n < 0) return emptySet()
    else {
      const s = ratRoot(c, k)
      rootValues = s.n === 0 ? [s] : [s, ratNeg(s)]
    }
  }
  let out = emptySet()
  for (const v of rootValues) {
    if (r.even && v.n < 0) continue
    out = setUnion(out, solveEq(r.radicand, ratPow(v, r.index)))
  }
  return out
}

// ---------------------------------------------------------------------------
// Preimage (exact sign chart)
// ---------------------------------------------------------------------------

function sortUnique(values: Rational[]): Rational[] {
  const sorted = [...values].sort((a, b) => (a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0))
  const out: Rational[] = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (!last || last.n * v.d !== v.n * last.d) out.push(v)
  }
  return out
}

/** Two rational points strictly inside each cell cut out by `cuts`. */
function cellProbes(cuts: Rational[]): { lo: Rational | '-inf'; hi: Rational | 'inf'; probes: [Rational, Rational] }[] {
  if (!cuts.length) return [{ lo: '-inf', hi: 'inf', probes: [rat(0), rat(1)] }]
  const out: { lo: Rational | '-inf'; hi: Rational | 'inf'; probes: [Rational, Rational] }[] = []
  const first = cuts[0]!
  out.push({ lo: '-inf', hi: first, probes: [ratSub(first, rat(1)), ratSub(first, rat(7, 2))] })
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i]!
    const b = cuts[i + 1]!
    out.push({ lo: a, hi: b, probes: [ratMidpoint(a, b), ratAdd(a, ratDiv(ratSub(b, a), rat(3)))] })
  }
  const last = cuts[cuts.length - 1]!
  out.push({ lo: last, hi: 'inf', probes: [ratAdd(last, rat(1)), ratAdd(last, rat(7, 2))] })
  return out
}

/** {x in dom(node) : node(x) in S}, exactly. Throws Unsupported. */
export function preimage(node: MathNode, S: SolutionSet): SolutionSet {
  const n = unwrap(node)
  const dom = domainSet(n)
  const target = normalizeSet(S)
  if (!hasX(n)) {
    const v = constValue(n)
    if (v === 'undef' || (typeof v === 'number' && !Number.isFinite(v))) return emptySet()
    return valueInSet(v, target) ? dom : emptySet()
  }
  const sols = setCriticalValues(target).map((c) => ({ c, set: solveEq(n, c) }))
  const cuts = sortUnique([...setCriticalValues(dom), ...sols.flatMap((s) => setCriticalValues(s.set))])
  const decide = (t: Rational): boolean => {
    if (!setContains(dom, t)) return false
    for (const s of sols) if (setContains(s.set, t)) return setContains(target, s.c)
    const v = valueAt(n, t)
    if (v === 'undef' || (typeof v === 'number' && !Number.isFinite(v))) throw new Unsupported('undefined inside the domain')
    return valueInSet(v, target)
  }
  const pts: Rational[] = cuts.filter((p) => decide(p))
  const pieces: Piece[] = []
  for (const cell of cellProbes(cuts)) {
    const [a, b] = cell.probes.map(decide)
    if (a !== b) throw new Unsupported('inconsistent sign chart')
    if (a) pieces.push({ lo: cell.lo, hi: cell.hi, loClosed: false, hiClosed: false })
  }
  return setFromPieces(pieces, pts)
}

/** Intersection of the sets (all reals for none): the domain from a list of restriction sets. */
export function intersectAll(sets: SolutionSet[]): SolutionSet {
  return sets.reduce((acc, s) => setIntersection(acc, s), allReals())
}
