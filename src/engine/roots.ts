/**
 * Tier 2, one variable: the boundary method (engine-design §5a).
 *
 *  1. For every relation of both statements, g = L − R on a grid over [−60, 60]; bracketed sign
 *     changes → bisection; a root is accepted only if |g(r)| ≤ 1e-7·S(r) (else it is a pole).
 *     Grid-local minima of |g| are refined by golden section (tangential roots like (x−3)^2 ≤ 0).
 *  2. Domain points: the same on every denominator / even-root radicand of both lines.
 *  3. B = sorted, deduped union; T = B ∪ midpoints ∪ {min−1, max+1} ∪ seeded randoms.
 *  4. Truth values (tolerance-aware, strict vs non-strict at the boundary itself) compared at every t.
 */
import type { Truth, Verdict } from '@/shared/types'
import { domainSubexpressions, evalNode, type MathNode } from './math'
import { mulberry32, statementHolds, statementHoldsNear, type Scope } from './samples'
import type { Relation, Statement } from './types'

export const GRID_LO = -60
export const GRID_HI = 60
export const GRID_N_1D = 2400
export const GRID_N_SLICE = 960

const ROOT_TOL = 1e-7
const DEDUPE_TOL = 1e-7

export interface Mismatch {
  scope: Scope
  old: Truth
  new: Truth
}

export interface SetComparison {
  verdict: Verdict
  mismatches: Mismatch[]
  /** Test points where at least one statement was defined. */
  informative: number
  boundaries: number[]
  /** Roots (not poles/domain points) of the old and new statements, for slice messages. */
  oldRoots: number[]
  newRoots: number[]
}

type G = (t: number) => { g: number; scale: number } | 'undef'

function bisect(gf: G, a: number, b: number, ga: number): number {
  let lo = a
  let hi = b
  let glo = ga
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    const r = gf(mid)
    if (r === 'undef') return mid
    if (r.g === 0) return mid
    if (Math.sign(r.g) === Math.sign(glo)) {
      lo = mid
      glo = r.g
    } else {
      hi = mid
    }
    if (hi - lo <= 1e-13 * Math.max(1, Math.abs(lo))) break
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
  for (let i = 0; i < 70; i++) {
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
    if (hi - lo < 1e-12 * Math.max(1, Math.abs(lo))) break
  }
  return (lo + hi) / 2
}

function acceptRoot(gf: G, r: number): boolean {
  const v = gf(r)
  return v !== 'undef' && Math.abs(v.g) <= ROOT_TOL * v.scale
}

/**
 * A bisected sign change whose |g| fails the tolerance test is still a root when |g| shrinks as t
 * closes in on it (infinite slope, e.g. cbrt(3y + 10) at y = −10/3, where no float lands close
 * enough). A pole grows toward the point (1/(x − 2)); a jump stays flat. Both stay poles.
 */
function shrinksToward(gf: G, r: number, dt: number): boolean {
  const near = Math.max(dt * 1e-4, 1e-9 * Math.max(1, Math.abs(r)))
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

/** Roots and poles of g on the grid. `poles` are bracketed sign changes that failed the |g| test. */
export function findRootsOf(gf: G, gridN = GRID_N_1D): { roots: number[]; poles: number[] } {
  const roots: number[] = []
  const poles: number[] = []
  const dt = (GRID_HI - GRID_LO) / gridN
  const vals: ({ g: number; scale: number } | 'undef')[] = new Array(gridN + 1)
  let zeroCount = 0
  let defined = 0
  for (let i = 0; i <= gridN; i++) {
    const r = gf(GRID_LO + i * dt)
    vals[i] = r
    if (r !== 'undef') {
      defined++
      if (Math.abs(r.g) <= ROOT_TOL * r.scale) zeroCount++
    }
  }
  // Identically-zero (or zero on a big share of the grid): the relation holds on a whole region;
  // there is no boundary to report from it (the test points handle the truth values).
  if (defined === 0 || zeroCount > defined * 0.5) return { roots, poles }

  for (let i = 1; i <= gridN; i++) {
    const a = vals[i - 1]!
    const b = vals[i]!
    if (a === 'undef' || b === 'undef') continue
    const ta = GRID_LO + (i - 1) * dt
    const tb = GRID_LO + i * dt
    const aZero = Math.abs(a.g) <= ROOT_TOL * a.scale
    const bZero = Math.abs(b.g) <= ROOT_TOL * b.scale
    if (aZero) {
      roots.push(ta)
      continue
    }
    if (bZero) continue
    if (Math.sign(a.g) !== Math.sign(b.g)) {
      const r = bisect(gf, ta, tb, a.g)
      if (acceptRoot(gf, r) || shrinksToward(gf, r, dt)) roots.push(r)
      else poles.push(r)
      continue
    }
    // tangential candidate: local minimum of |g| that is small relative to scale
    if (i >= 2) {
      const p = vals[i - 2]!
      if (p !== 'undef') {
        const ap = Math.abs(p.g)
        const aa = Math.abs(a.g)
        const ab = Math.abs(b.g)
        if (aa < ap && aa <= ab && aa <= 0.25 * Math.max(1, a.scale)) {
          const r = goldenMin(gf, ta - dt, tb)
          if (acceptRoot(gf, r)) roots.push(r)
        }
      }
    }
  }
  return { roots: dedupe(roots), poles: dedupe(poles) }
}

export function dedupe(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  const out: number[] = []
  for (const v of sorted) {
    const last = out[out.length - 1]
    if (last == null || Math.abs(v - last) > DEDUPE_TOL * Math.max(1, Math.abs(v))) out.push(v)
  }
  return out
}

function relationG(rel: Relation, v: string, fixed: Scope): G {
  const scope: Scope = { ...fixed }
  return (t) => {
    scope[v] = t
    const l = evalNode(rel.lhs, scope)
    const r = evalNode(rel.rhs, scope)
    if (l === 'undef' || r === 'undef') return 'undef'
    return { g: l - r, scale: Math.max(1, Math.abs(l), Math.abs(r)) }
  }
}

function nodeG(node: MathNode, v: string, fixed: Scope): G {
  const scope: Scope = { ...fixed }
  return (t) => {
    scope[v] = t
    const val = evalNode(node, scope)
    if (val === 'undef') return 'undef'
    return { g: val, scale: 1 }
  }
}

function nodeMentions(node: MathNode, v: string): boolean {
  let found = false
  node.traverse((n) => {
    if (n.type === 'SymbolNode' && (n as { name?: string }).name === v) found = true
  })
  return found
}

/** Roots of every relation of `stmt` in variable `v` (other variables fixed). */
export function statementRoots(stmt: Statement, v: string, fixed: Scope = {}, gridN = GRID_N_1D): { roots: number[]; poles: number[] } {
  const roots: number[] = []
  const poles: number[] = []
  for (const clause of stmt.disjuncts) {
    for (const rel of clause) {
      if (!nodeMentions(rel.lhs, v) && !nodeMentions(rel.rhs, v)) continue
      const r = findRootsOf(relationG(rel, v, fixed), gridN)
      roots.push(...r.roots)
      poles.push(...r.poles)
    }
  }
  return { roots: dedupe(roots), poles: dedupe(poles) }
}

/** Domain boundary points of every side of `stmt` in variable `v`. */
export function statementDomainPoints(stmt: Statement, v: string, fixed: Scope = {}, gridN = GRID_N_1D): number[] {
  const pts: number[] = []
  for (const clause of stmt.disjuncts) {
    for (const rel of clause) {
      for (const side of [rel.lhs, rel.rhs]) {
        const { zero, nonneg } = domainSubexpressions(side)
        for (const sub of [...zero, ...nonneg]) {
          if (!nodeMentions(sub, v)) continue
          const r = findRootsOf(nodeG(sub, v, fixed), gridN)
          pts.push(...r.roots, ...r.poles)
        }
      }
    }
  }
  return dedupe(pts)
}

/** Test set T from the boundary set B (engine-design §5a.4). */
export function testPoints(boundaries: number[], seed: number): number[] {
  const pts: number[] = []
  const B = dedupe(boundaries)
  for (const b of B) pts.push(b)
  for (let i = 0; i < B.length - 1; i++) pts.push((B[i]! + B[i + 1]!) / 2)
  if (B.length) {
    pts.push(B[0]! - 1, B[B.length - 1]! + 1)
  } else {
    pts.push(-7, 0, 7)
  }
  const rand = mulberry32(seed ^ 0x7f4a7c15)
  for (let i = 0; i < 6; i++) pts.push(rand() * 20 - 10)
  pts.push(-7, 0, 7)
  return pts
}

/**
 * Compare the solution sets of two statements in variable `v` (other variables fixed by `fixed`).
 * Both statements' boundary/domain points are used; a mismatch is a point where (old === true)
 * differs from (new === true); 'undef' is preserved for messaging.
 */
export function compareSets1D(
  oldS: Statement,
  newS: Statement,
  v: string,
  fixed: Scope = {},
  seed = 1,
  gridN = GRID_N_1D,
  extraPoints: readonly number[] = [],
): SetComparison {
  const ro = statementRoots(oldS, v, fixed, gridN)
  const rn = statementRoots(newS, v, fixed, gridN)
  const dom = [...statementDomainPoints(oldS, v, fixed, gridN), ...statementDomainPoints(newS, v, fixed, gridN)]
  const boundaries = dedupe([...ro.roots, ...rn.roots, ...ro.poles, ...rn.poles, ...dom])
  const T = [...testPoints(boundaries, seed), ...extraPoints.filter((p) => Number.isFinite(p))]
  const mismatches: Mismatch[] = []
  let informative = 0
  const seen = new Set<string>()
  for (const t of T) {
    const key = t.toPrecision(12)
    if (seen.has(key)) continue
    seen.add(key)
    const scope: Scope = { ...fixed, [v]: t }
    const o = statementHoldsNear(oldS, scope, v)
    const n = statementHoldsNear(newS, scope, v)
    if (o === 'undef' && n === 'undef') continue
    informative++
    if ((o === true) !== (n === true)) mismatches.push({ scope, old: o, new: n })
  }
  return {
    verdict: verdictFromMismatches(mismatches, informative),
    mismatches,
    informative,
    boundaries,
    oldRoots: ro.roots,
    newRoots: rn.roots,
  }
}

export function verdictFromMismatches(mismatches: Mismatch[], informative: number, minInformative = 8): Verdict {
  if (mismatches.length === 0) return informative >= minInformative ? 'equivalent' : 'undecidable'
  const lost = mismatches.every((m) => m.old === true && m.new !== true)
  const extra = mismatches.every((m) => m.new === true && m.old !== true)
  if (lost) return 'lost_subset'
  if (extra) return 'extraneous_superset'
  return 'not_equivalent'
}

// ---------------------------------------------------------------------------
// Legacy helpers (NumberLine component, engine/sets/interval.ts)
// ---------------------------------------------------------------------------

/** @deprecated boundary points (roots + domain points) of a one-variable statement. */
export function findBoundaries(stmt: Statement, v: string): number[] {
  const r = statementRoots(stmt, v)
  return dedupe([...r.roots, ...r.poles, ...statementDomainPoints(stmt, v)])
}

/** @deprecated probe points around boundaries. */
export function probePoints(boundaries: number[]): number[] {
  const pts: number[] = [-12, 12, -20, 0, 20]
  for (const b of boundaries) pts.push(b, b - 0.001, b + 0.001)
  for (let i = 0; i < boundaries.length - 1; i++) pts.push((boundaries[i]! + boundaries[i + 1]!) / 2)
  if (boundaries.length) pts.push(boundaries[0]! - 3, boundaries[boundaries.length - 1]! + 3)
  for (let n = -8; n <= 8; n++) pts.push(n)
  return pts
}

export function evalAtVar(stmt: Statement, v: string, t: number): Truth {
  return statementHolds(stmt, { [v]: t })
}

/** Compatibility wrappers used by verify.ts / equiv.ts. */
export function sampleTruthMismatch(
  oldS: Statement,
  newS: Statement,
  v: string,
): { t: number; oldHolds: boolean; newHolds: boolean }[] {
  return compareSets1D(oldS, newS, v).mismatches.map((m) => ({
    t: m.scope[v] ?? 0,
    oldHolds: m.old === true,
    newHolds: m.new === true,
  }))
}

export function truthEquivalent1D(oldS: Statement, newS: Statement, v: string): boolean {
  const cmp = compareSets1D(oldS, newS, v)
  return cmp.mismatches.length === 0 && cmp.informative > 0
}

export function newSuperset1D(oldS: Statement, newS: Statement, v: string): boolean {
  return compareSets1D(oldS, newS, v).verdict === 'extraneous_superset'
}

export function newSubset1D(oldS: Statement, newS: Statement, v: string): boolean {
  return compareSets1D(oldS, newS, v).verdict === 'lost_subset'
}
