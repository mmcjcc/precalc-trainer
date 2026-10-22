/**
 * One-variable analysis on a WIDE grid, for exponential and log lines.
 *
 * The engine's Tier 2 scans [−60, 60]. Exponential equations leave that range easily (a half-life
 * problem has t ≈ 10⁴; 1.01^x = 2 has x ≈ 69.7), and log equations put roots right next to a domain
 * edge (log(x − 3) = −2 has x = 3.01). This grid has
 *   - x = k/20 for |x| ≤ 60 (exact multiples of 0.05),
 *   - ±10^(k/40) from 10⁻⁹ to 10⁷ (about 6% apart),
 *   - points 10⁻¹⁰ … 10⁻¹ on both sides of every domain boundary (the roots of every log input, square
 *     root radicand and denominator).
 * Roots are bracketed sign changes refined by bisection (accepted only when |L − R| is small: a pole also
 * changes sign), plus tangential minima of |L − R| refined by golden section.
 */
import type { Truth } from '@/shared/types'
import { collectVars, domainSubexpressions, evalNode, type MathNode } from '../math'
import { mulberry32, type Scope } from '../samples'
import type { Relation, Statement } from '../types'

const ROOT_TOL = 1e-7
const DEDUPE_TOL = 1e-9

/** g = lhs − rhs at t, its scale, and whether both sides are within ROOT_TOL of 0 there (`small`: says nothing). */
type G = (t: number) => { g: number; scale: number; small?: boolean } | 'undef'

let BASE_GRID: number[] | null = null

/** The fixed part of the grid (sorted): steps of 0.05 on [−12, 12], 0.25 on [−60, 60], then geometric. */
export function baseGrid(): number[] {
  if (BASE_GRID) return BASE_GRID
  const pts: number[] = []
  for (let k = -240; k <= 240; k++) pts.push(k / 20)
  for (let k = -240; k <= 240; k++) pts.push(k / 4)
  for (let k = -360; k <= 280; k++) {
    const m = 10 ** (k / 40)
    pts.push(m, -m)
  }
  BASE_GRID = sortUnique(pts)
  return BASE_GRID
}

function sortUnique(pts: number[]): number[] {
  const s = pts.filter((p) => Number.isFinite(p)).sort((a, b) => a - b)
  const out: number[] = []
  for (const p of s) if (!out.length || p !== out[out.length - 1]) out.push(p)
  return out
}

/** Points just inside and outside each boundary: b ± 10⁻ᵏ, b ± 2·10⁻ᵏ, b ± 5·10⁻ᵏ (k = 1 … 10). */
export function nearPoints(boundaries: readonly number[]): number[] {
  const out: number[] = []
  for (const b of boundaries) {
    const s = Math.max(1, Math.abs(b))
    for (let k = 1; k <= 10; k++) {
      for (const m of [1, 2, 5]) {
        const d = m * 10 ** -k * s
        out.push(b - d, b + d)
      }
    }
  }
  return out
}

/** The full grid for a set of boundaries. */
export function gridWith(boundaries: readonly number[]): number[] {
  if (!boundaries.length) return baseGrid()
  return sortUnique([...baseGrid(), ...boundaries, ...nearPoints(boundaries)])
}

function bisect(gf: G, a: number, b: number, ga: number): number {
  let lo = a
  let hi = b
  let glo = ga
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (mid === lo || mid === hi) break
    const r = gf(mid)
    if (r === 'undef') return mid
    if (r.g === 0) return mid
    if (Math.sign(r.g) === Math.sign(glo)) {
      lo = mid
      glo = r.g
    } else hi = mid
  }
  return (lo + hi) / 2
}

function goldenMin(gf: G, a: number, b: number): number {
  const phi = (Math.sqrt(5) - 1) / 2
  let lo = a
  let hi = b
  const f = (t: number) => {
    const r = gf(t)
    return r === 'undef' ? Number.POSITIVE_INFINITY : Math.abs(r.g)
  }
  let c = hi - phi * (hi - lo)
  let d = lo + phi * (hi - lo)
  let fc = f(c)
  let fd = f(d)
  for (let i = 0; i < 120; i++) {
    if (fc < fd) {
      hi = d
      d = c
      fd = fc
      c = hi - phi * (hi - lo)
      fc = f(c)
    } else {
      lo = c
      c = d
      fc = fd
      d = lo + phi * (hi - lo)
      fd = f(d)
    }
    if (hi - lo < 1e-14 * Math.max(1, Math.abs(lo))) break
  }
  return (lo + hi) / 2
}

function isRootAt(gf: G, r: number): boolean {
  const v = gf(r)
  return v !== 'undef' && Math.abs(v.g) <= ROOT_TOL * v.scale
}

/** |g| shrinks toward a bracketed point (a root with an infinite slope), instead of growing (a pole). */
function shrinksToward(gf: G, r: number, dt: number): boolean {
  const near = Math.max(dt * 1e-4, 1e-12 * Math.max(1, Math.abs(r)))
  const far = dt / 4
  const mag = (t: number) => {
    const v = gf(t)
    return v === 'undef' ? Number.NaN : Math.abs(v.g)
  }
  const n = [mag(r - near), mag(r + near)]
  const f = [mag(r - far), mag(r + far)]
  if (![...n, ...f].every(Number.isFinite)) return false
  return Math.max(...n) < 0.5 * Math.min(...f)
}

export function dedupe(values: readonly number[]): number[] {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (last == null || Math.abs(v - last) > DEDUPE_TOL * Math.max(1, Math.abs(v))) out.push(v)
  }
  return out
}

/**
 * Roots of g on a sorted grid. A root is a bracketed sign change (bisected; a pole also changes sign, so
 * |g| must be small there or shrink toward it), an exact 0 at a grid point, or a local minimum of |g| that
 * golden section drives to a root (a tangential root such as (x − 3)² = 0). A grid point merely CLOSE to 0
 * is not a root by itself: the geometric grid has points like 10⁻⁹, where g = x is "small" but x = 0 is
 * the only root. A region where g ≡ 0 gives no roots (the relation holds on a whole stretch).
 *
 * "A whole stretch" is measured by LENGTH along x, each grid point weighted by its spacing, not by counting points:
 * the geometric part of the grid crowds around 0, so a shallow root at 0 put hundreds of points within ROOT_TOL of
 * it, and 4^(x − 3) = 8^(x − 2) (x = 0) was read as holding on a stretch and given no roots (review 2026-10-22).
 * Points where both sides are within ROOT_TOL of 0 (2^(2x − 6) and 2^(3x − 6) at x = −20) say nothing either way and
 * are left out of the measure, as underflowed ones are.
 */
export function rootsOnGrid(gf: G, grid: readonly number[]): number[] {
  const vals = grid.map((t) => gf(t))
  let zeroLength = 0
  let definedLength = 0
  for (let i = 0; i < grid.length; i++) {
    const v = vals[i]!
    if (v === 'undef' || v.small) continue
    const w = (grid[Math.min(i + 1, grid.length - 1)]! - grid[Math.max(i - 1, 0)]!) / 2
    definedLength += w
    if (Math.abs(v.g) <= ROOT_TOL * v.scale) zeroLength += w
  }
  if (!(definedLength > 0) || zeroLength > definedLength * 0.3) return []
  const roots: number[] = []
  const mag = (i: number) => {
    const v = vals[i]
    return v === undefined || v === 'undef' ? Number.POSITIVE_INFINITY : Math.abs(v.g)
  }
  for (let i = 0; i < grid.length; i++) {
    const b = vals[i]!
    if (b === 'undef') continue
    if (b.g === 0) {
      roots.push(grid[i]!)
      continue
    }
    if (i > 0) {
      const a = vals[i - 1]!
      if (a !== 'undef' && a.g !== 0 && Math.sign(a.g) !== Math.sign(b.g)) {
        const r = bisect(gf, grid[i - 1]!, grid[i]!, a.g)
        if (isRootAt(gf, r) || shrinksToward(gf, r, grid[i]! - grid[i - 1]!)) roots.push(r)
        continue
      }
    }
    // Local minimum of |g| that is small, inside a defined stretch: refine between the neighbours.
    const m = Math.abs(b.g)
    const neighboursDefined = i > 0 && i < grid.length - 1 && vals[i - 1] !== 'undef' && vals[i + 1] !== 'undef'
    if (neighboursDefined && m <= 0.25 * Math.max(1, b.scale) && m < mag(i - 1) && m <= mag(i + 1)) {
      const r = goldenMin(gf, grid[i - 1]!, grid[i + 1]!)
      if (isRootAt(gf, r)) {
        const rv = gf(r)
        // A tangential root: |g| at the refined point is far smaller than at the grid point, or exactly 0.
        if (rv !== 'undef' && (rv.g === 0 || Math.abs(rv.g) < 1e-3 * m || Math.abs(rv.g) <= 1e-12 * rv.scale)) roots.push(r)
      }
    }
  }
  return dedupe(roots)
}

function mentions(node: MathNode, v: string): boolean {
  return collectVars(node).includes(v)
}

/** Below this both sides have underflowed (2^(x+1) and 3^x at x = −10⁴ are both 0): "0 = 0" says nothing. */
const TINY = 1e-200

function relationG(rel: Relation, v: string, fixed: Scope): G {
  const scope: Scope = { ...fixed }
  return (t) => {
    scope[v] = t
    const l = evalNode(rel.lhs, scope)
    const r = evalNode(rel.rhs, scope)
    if (l === 'undef' || r === 'undef') return 'undef'
    if (Math.abs(l) < TINY && Math.abs(r) < TINY && (l !== 0 || r !== 0 || underflows(rel, scope))) return 'undef'
    // Both sides within ROOT_TOL of 0 but not both exactly 0 (log(1) = log(1) at a real root is exact).
    const small = Math.abs(l) <= ROOT_TOL && Math.abs(r) <= ROOT_TOL && (l !== 0 || r !== 0)
    return { g: l - r, scale: Math.max(1, Math.abs(l), Math.abs(r)), small }
  }
}

/** A side that is (nearly) 0 only because an exponential underflowed (e^(−10⁴)). */
function underflows(rel: Relation, scope: Scope): boolean {
  return nodeUnderflows(rel.lhs, scope) || nodeUnderflows(rel.rhs, scope)
}

/**
 * l = r for the logs core. The engine's own test (1e-9 of the larger of 1, |l|, |r| and the operands)
 * calls 2^(3x − 1) and 2^(x + 5) equal at x = −30 (4·10⁻²⁸ and 3·10⁻⁸: the exponent 91 is an "operand").
 * Here: against an exact 0 the test is absolute (x² − 2 = 0 holds at the float nearest √2); when both
 * sides are nonzero and below 10⁻⁶ it is relative (e^x = 10⁻¹⁰ does not hold at x = −25); otherwise
 * 1e-9 of max(1, |l|, |r|).
 */
export function equalLog(l: number, r: number): boolean {
  if (l === r) return true
  const m = Math.max(Math.abs(l), Math.abs(r))
  if (l === 0 || r === 0) return m <= 1e-9
  if (m < 1e-6) return Math.abs(l - r) <= 1e-9 * m
  return Math.abs(l - r) <= 1e-9 * Math.max(1, m)
}

function relTruth(op: Relation['op'], l: number, r: number): boolean {
  const eq = equalLog(l, r)
  switch (op) {
    case '=':
      return eq
    case '<':
      return l < r && !eq
    case '<=':
      return l < r || eq
    case '>':
      return l > r && !eq
    case '>=':
      return l > r || eq
  }
}

/** Truth of one relation at t, counting a point within a hair of a real root of L − R as the root (infinite slopes). */
function relationTruth(rel: Relation, scope: Scope, v: string): Truth {
  const l = evalNode(rel.lhs, scope)
  const r = evalNode(rel.rhs, scope)
  if (l === 'undef' || r === 'undef') return 'undef'
  const truth = relTruth(rel.op, l, r)
  const t = scope[v]
  if (t == null || equalLog(l, r)) return truth
  const g = l - r
  if (Math.abs(g) > 1e-3 * Math.max(1, Math.abs(l), Math.abs(r))) return truth
  const d = 1e-9 * Math.max(1, Math.abs(t))
  const gAt = (u: number) => {
    const s = { ...scope, [v]: u }
    const a = evalNode(rel.lhs, s)
    const b = evalNode(rel.rhs, s)
    return a === 'undef' || b === 'undef' ? Number.NaN : a - b
  }
  const gl = gAt(t - d)
  const gr = gAt(t + d)
  if (!Number.isFinite(gl) || !Number.isFinite(gr) || Math.sign(gl) === Math.sign(gr)) return truth
  if (Math.abs(g) >= Math.min(Math.abs(gl), Math.abs(gr))) return truth
  return rel.op === '=' || rel.op === '<=' || rel.op === '>='
}

/** OR of ANDs with `relationTruth`; 'undef' when no clause could be evaluated. */
export function holdsLog(stmt: Statement, scope: Scope, v: string): Truth {
  let sawDef = false
  for (const clause of stmt.disjuncts) {
    let allTrue = true
    for (const rel of clause) {
      const t = relationTruth(rel, scope, v)
      if (t === 'undef') {
        allTrue = false
        break
      }
      sawDef = true
      if (!t) {
        allTrue = false
        break
      }
    }
    if (allTrue) return true
  }
  return sawDef ? false : 'undef'
}

/** Every relation of the statement compares numbers that have not underflowed to nothing. */
export function meaningfulAt(stmt: Statement, scope: Scope): boolean {
  for (const rel of stmt.disjuncts.flat()) {
    const l = evalNode(rel.lhs, scope)
    const r = evalNode(rel.rhs, scope)
    if (l === 'undef' || r === 'undef') continue
    if (Math.abs(l) < TINY && Math.abs(r) < TINY && (l !== 0 || r !== 0 || underflows(rel, scope))) return false
  }
  return true
}

function nodeG(node: MathNode, v: string, fixed: Scope): G {
  const scope: Scope = { ...fixed }
  return (t) => {
    scope[v] = t
    const val = evalNode(node, scope)
    if (val === 'undef') return 'undef'
    // e^(2x) is 0 at x = −400 only because it underflowed: not a root of the log input.
    if (Math.abs(val) < TINY && nodeUnderflows(node, scope)) return 'undef'
    return { g: val, scale: 1 }
  }
}

/** Some exponential inside the tree has underflowed to (nearly) nothing at this point. */
function nodeUnderflows(node: MathNode, scope: Scope): boolean {
  let found = false
  node.traverse((n) => {
    if (found) return
    const isPow = n.type === 'OperatorNode' && (n as unknown as { op: string }).op === '^'
    const isExp = n.type === 'FunctionNode' && (n as unknown as { fn: { name?: string } }).fn?.name === 'exp'
    if (!isPow && !isExp) return
    const v = evalNode(n, scope)
    if (v !== 'undef' && Math.abs(v) < TINY) {
      const e = isExp ? (n as unknown as { args: MathNode[] }).args[0] : (n as unknown as { args: MathNode[] }).args[1]
      const ev = e ? evalNode(e, scope) : 'undef'
      if (ev !== 'undef' && Math.abs(ev) > 50) found = true
    }
  })
  return found
}

/** Every side of every relation of a statement. */
export function sidesOf(stmt: Statement): MathNode[] {
  return stmt.disjuncts.flat().flatMap((r) => [r.lhs, r.rhs])
}

/** Constraint sub-expressions of some trees: log inputs and bases, radicands, denominators. */
export function constraintNodes(nodes: readonly MathNode[]): MathNode[] {
  const out: MathNode[] = []
  for (const n of nodes) {
    const d = domainSubexpressions(n)
    out.push(...d.pos, ...d.nonneg, ...d.zero)
  }
  return out
}

/**
 * Domain boundaries of some trees in v: roots of every constraint sub-expression (on the base grid, then
 * once more on the grid refined around what was found), plus the points where "every tree is defined"
 * switches between neighbouring grid points.
 */
/** Beyond this, a switch in definedness that no log input, radicand or denominator explains is float overflow. */
const SWITCH_SPAN = 200

const BOUNDARY_MEMO = new Map<string, number[]>()
const ROOTS_MEMO = new Map<string, number[]>()

function memo<T>(map: Map<string, T>, key: string, make: () => T): T {
  const hit = map.get(key)
  if (hit !== undefined) return hit
  const out = make()
  if (map.size > 1024) map.clear()
  map.set(key, out)
  return out
}

function fixedKey(fixed: Scope): string {
  return Object.keys(fixed).length ? JSON.stringify(fixed) : ''
}

export function domainBoundaries(nodes: readonly MathNode[], v: string, fixed: Scope = {}): number[] {
  const key = `${v}|${fixedKey(fixed)}|${nodes.map((n) => n.toString()).join(';')}`
  return memo(BOUNDARY_MEMO, key, () => domainBoundariesUncached(nodes, v, fixed))
}

function domainBoundariesUncached(nodes: readonly MathNode[], v: string, fixed: Scope): number[] {
  const cons = constraintNodes(nodes).filter((c) => mentions(c, v))
  let pts: number[] = []
  for (const c of cons) pts.push(...rootsOnGrid(nodeG(c, v, fixed), baseGrid()))
  pts = dedupe(pts)
  const grid = gridWith(pts)
  const defined = (t: number) => nodes.every((n) => evalNode(n, { ...fixed, [v]: t }) !== 'undef')
  const switches: number[] = []
  let prev: boolean | null = null
  for (let i = 0; i < grid.length; i++) {
    const d = defined(grid[i]!)
    // Far out, "defined" flips because 2^x overflows to Infinity or underflows to 0: not a domain edge.
    if (prev !== null && d !== prev && Math.abs(grid[i]!) > SWITCH_SPAN) {
      prev = d
      continue
    }
    if (prev !== null && d !== prev) {
      // A grid point that is itself a constraint root (ln(x²) at 0) explains the switch exactly.
      if (pts.some((p) => p === grid[i] || p === grid[i - 1])) {
        prev = d
        continue
      }
      // Locate the switch by bisection on definedness.
      let lo = grid[i - 1]!
      let hi = grid[i]!
      for (let k = 0; k < 80; k++) {
        const mid = (lo + hi) / 2
        if (mid === lo || mid === hi) break
        if (defined(mid) === prev) lo = mid
        else hi = mid
      }
      switches.push((lo + hi) / 2)
    }
    prev = d
  }
  // Constraint roots are exact; a bisected switch only adds a point no root accounts for.
  for (const s of switches) if (!pts.some((p) => Math.abs(p - s) <= 1e-9 * Math.max(1, Math.abs(p)))) pts.push(s)
  return dedupe(pts)
}

export interface Interval {
  lo: number
  hi: number
}

export interface Domain1D {
  /** Open intervals where every tree is defined, sorted. lo/hi may be ±Infinity. */
  intervals: Interval[]
  boundaries: number[]
}

/** The domain of some trees in v, as open intervals between consecutive boundaries. */
export function domainOf(nodes: readonly MathNode[], v: string, fixed: Scope = {}): Domain1D {
  const boundaries = domainBoundaries(nodes, v, fixed)
  const edges = [Number.NEGATIVE_INFINITY, ...boundaries, Number.POSITIVE_INFINITY]
  const defined = (t: number) => nodes.every((n) => evalNode(n, { ...fixed, [v]: t }) !== 'undef')
  const intervals: Interval[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const lo = edges[i]!
    const hi = edges[i + 1]!
    const probes = interiorProbes(lo, hi)
    if (probes.length && probes.every(defined)) {
      const last = intervals[intervals.length - 1]
      // A boundary that is not a real break (a root of a constraint inside the domain) merges back.
      if (last && last.hi === lo && defined(lo)) last.hi = hi
      else intervals.push({ lo, hi })
    }
  }
  return { intervals, boundaries }
}

/** A few points strictly inside (lo, hi). */
function interiorProbes(lo: number, hi: number): number[] {
  if (lo === Number.NEGATIVE_INFINITY && hi === Number.POSITIVE_INFINITY) return [-3.7, 0.3, 4.1]
  if (lo === Number.NEGATIVE_INFINITY) return [hi - 0.01 * Math.max(1, Math.abs(hi)), hi - 1.3, hi - 7.9]
  if (hi === Number.POSITIVE_INFINITY) return [lo + 0.01 * Math.max(1, Math.abs(lo)), lo + 1.3, lo + 7.9]
  const w = hi - lo
  return [lo + 0.13 * w, lo + 0.5 * w, lo + 0.87 * w].filter((t) => t > lo && t < hi)
}

export function inDomain(d: Domain1D, t: number): boolean {
  return d.intervals.some((iv) => t > iv.lo && t < iv.hi)
}

/** Intersection of a domain with (0, ∞) (the problem says the variable is positive). */
export function positivePart(d: Domain1D): Domain1D {
  const intervals = d.intervals.map((iv) => ({ lo: Math.max(iv.lo, 0), hi: iv.hi })).filter((iv) => iv.hi > iv.lo)
  return { intervals, boundaries: dedupe([...d.boundaries, 0]) }
}

/**
 * Sample points inside a domain: friendly numbers first (integers, halves), then seeded points in every
 * interval, near both ends and in the middle. At least `count` points when the domain is not empty.
 */
export function domainSamples(d: Domain1D, seed: number, count = 16): number[] {
  const rand = mulberry32(seed ^ 0x3c6ef372)
  const out: number[] = []
  for (const raw of d.intervals) {
    // Stay inside |x| ≤ 120 when the interval reaches there: far out, 2^x and e^x underflow or overflow
    // (their "domain edges" near ±1000 are floating-point artifacts, not mathematics).
    const clipped = { lo: Math.max(raw.lo, -SAMPLE_SPAN), hi: Math.min(raw.hi, SAMPLE_SPAN) }
    const iv = clipped.hi > clipped.lo ? { lo: clipped.lo === -SAMPLE_SPAN && raw.lo < -SAMPLE_SPAN ? Number.NEGATIVE_INFINITY : clipped.lo, hi: clipped.hi === SAMPLE_SPAN && raw.hi > SAMPLE_SPAN ? Number.POSITIVE_INFINITY : clipped.hi } : raw
    const lo = iv.lo
    const hi = iv.hi
    const finiteLo = Number.isFinite(lo)
    const finiteHi = Number.isFinite(hi)
    const span = finiteLo && finiteHi ? hi - lo : Number.POSITIVE_INFINITY
    const pts: number[] = []
    if (span === Number.POSITIVE_INFINITY) {
      const anchor = finiteLo ? lo : finiteHi ? hi : 0
      const dir = finiteLo ? 1 : finiteHi ? -1 : 0
      const steps = [0.01, 0.07, 0.3, 0.8, 1.7, 3.4, 6.1, 11.3, 23.9, 61.7]
      if (dir === 0) for (const s of [0.3, 1.7, 3.4, 6.1, 11.3]) pts.push(s, -s)
      else for (const s of steps) pts.push(anchor + dir * s * Math.max(1, Math.abs(anchor) * 0.1))
    } else {
      for (const f of [0.003, 0.05, 0.21, 0.5, 0.77, 0.95, 0.997]) pts.push(lo + f * span)
    }
    for (let i = 0; i < 6; i++) {
      const u = rand()
      if (span === Number.POSITIVE_INFINITY) {
        const anchor = finiteLo ? lo : finiteHi ? hi : 0
        const dir = finiteLo ? 1 : finiteHi ? -1 : rand() < 0.5 ? -1 : 1
        pts.push(anchor + dir * (0.05 + u * 15))
      } else pts.push(lo + (0.02 + 0.96 * u) * span)
    }
    out.push(...pts.filter((t) => t > lo && t < hi))
  }
  return out.length >= count || !out.length ? out : [...out, ...out.map((t) => t * (1 + 1e-3))].slice(0, Math.max(count, out.length))
}

const SAMPLE_SPAN = 120

/** Integers and halves inside the domain, nearest 0 first (for readable counterexamples). */
export function friendlyPoints(d: Domain1D, limit = 12): number[] {
  const cands: number[] = []
  for (let k = 0; k <= 40; k++) for (const s of k === 0 ? [0] : [k, -k]) cands.push(s)
  for (let k = 1; k <= 40; k += 2) cands.push(k / 2, -k / 2)
  for (const p of [100, 1000, 0.1, 0.01, 0.001]) cands.push(p)
  return cands.filter((t) => inDomain(d, t)).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Solution sets
// ---------------------------------------------------------------------------

/** Roots of every relation of a statement on the wide grid refined around the domain boundaries. */
export function statementRootsWide(stmt: Statement, v: string, fixed: Scope = {}, extraBoundaries: readonly number[] = []): number[] {
  const own = domainBoundaries(sidesOf(stmt), v, fixed)
  const bounds = dedupe([...own, ...extraBoundaries])
  const grid = gridWith(bounds)
  const roots: number[] = []
  for (const rel of stmt.disjuncts.flat()) {
    if (!mentions(rel.lhs, v) && !mentions(rel.rhs, v)) continue
    const key = `${v}|${fixedKey(fixed)}|${rel.lhs.toString()}|${rel.op}|${rel.rhs.toString()}|${bounds.map((b) => b.toPrecision(12)).join(',')}`
    roots.push(...memo(ROOTS_MEMO, key, () => rootsOnGrid(relationG(rel, v, fixed), grid)))
  }
  return dedupe(roots)
}

/** The points where an EQUATION statement holds (its finite solution set), ascending. */
export function solutionsWide(stmt: Statement, v: string, fixed: Scope = {}): number[] {
  return statementRootsWide(stmt, v, fixed).filter((t) => {
    const s = { ...fixed, [v]: t }
    return meaningfulAt(stmt, s) && holdsLog(stmt, s, v) === true
  })
}

export interface WideMismatch {
  scope: Scope
  old: Truth
  new: Truth
}

export interface WideComparison {
  mismatches: WideMismatch[]
  /** Test points where at least one statement was defined. */
  informative: number
  /** Points where the old statement holds / the new one holds (equations: the solutions; test points only). */
  oldTrue: number[]
  newTrue: number[]
  points: number[]
}

/**
 * Truth of both statements at every test point: the roots and domain boundaries of both, midpoints
 * between them, one beyond each end, wide points (±100 … ±10⁶) and seeded points in [−10, 10]. `inScope`
 * limits which points count as mismatches (the original's domain, for equations); the truth lists keep
 * every point.
 */
export function compareWide(oldS: Statement, newS: Statement, v: string, opts: { seed?: number; inScope?: (t: number) => boolean; extraPoints?: readonly number[] } = {}): WideComparison {
  const seed = opts.seed ?? 1
  const bo = domainBoundaries(sidesOf(oldS), v)
  const bn = domainBoundaries(sidesOf(newS), v)
  const ro = statementRootsWide(oldS, v, {}, bn)
  const rn = statementRootsWide(newS, v, {}, bo)
  const B = dedupe([...ro, ...rn, ...bo, ...bn, ...(opts.extraPoints ?? [])])
  const T: number[] = [...B]
  for (let i = 0; i < B.length - 1; i++) T.push((B[i]! + B[i + 1]!) / 2)
  if (B.length) T.push(B[0]! - 1, B[B.length - 1]! + 1, B[0]! - 0.01 * Math.max(1, Math.abs(B[0]!)), B[B.length - 1]! + 0.01 * Math.max(1, Math.abs(B[B.length - 1]!)))
  for (const w of [30, 100, 1000]) T.push(w, -w)
  const rand = mulberry32(seed ^ 0x7f4a7c15)
  for (let i = 0; i < 8; i++) T.push(rand() * 20 - 10)
  T.push(-7, 0, 7, 0.5, 2.5)
  // Test points within a hair of a boundary would be judged "at" it by the engine's tolerance (x = 10⁻⁹
  // makes 0 < x false), so only the boundary itself is tested there.
  const pts = dedupe(T).filter((t) => B.some((b) => b === t) || !B.some((b) => Math.abs(t - b) <= 1e-8 * Math.max(1, Math.abs(b))))
  const mismatches: WideMismatch[] = []
  const oldTrue: number[] = []
  const newTrue: number[] = []
  let informative = 0
  for (const t of pts) {
    const scope: Scope = { [v]: t }
    if (!meaningfulAt(oldS, scope) || !meaningfulAt(newS, scope)) continue
    const o = holdsLog(oldS, scope, v)
    const n = holdsLog(newS, scope, v)
    if (o === true) oldTrue.push(t)
    if (n === true) newTrue.push(t)
    if (o === 'undef' && n === 'undef') continue
    informative++
    if (opts.inScope && !opts.inScope(t)) continue
    if ((o === true) !== (n === true)) mismatches.push({ scope, old: o, new: n })
  }
  return { mismatches, informative, oldTrue, newTrue, points: pts }
}
