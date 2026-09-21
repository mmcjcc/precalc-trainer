import type { RelOp, Truth } from '@/shared/types'
import { evalNode, nearlyEqual, operandScale, type MathNode } from './math'
import { isInequality, type Relation, type Statement } from './types'

export type Scope = Record<string, number>

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEFAULT_SEED = 0x9e3779b9

/** Uniform in [lo, hi] rejecting values within 0.05 of {−1, 0, 1} (x^2 = x at 1, 2x = x at 0). */
function drawAvoiding(rand: () => number, lo: number, hi: number): number {
  for (let guard = 0; guard < 50; guard++) {
    const v = lo + rand() * (hi - lo)
    if ([-1, 0, 1].every((k) => Math.abs(v - k) >= 0.05)) return v
  }
  return 0.37
}

/** One-variable Tier-1 sample values (engine-design §3). */
export function sampleValues1D(seed: number, checkValue?: number, widen = false): number[] {
  const rand = mulberry32(seed ^ (widen ? 0x51ed27 : 0))
  const out: number[] = []
  const range = widen ? 30 : 10
  for (let i = 0; i < 12; i++) out.push(drawAvoiding(rand, -range, range))
  for (let i = 0; i < 2; i++) {
    let v = rand() * 2 - 1
    if (Math.abs(v) < 0.05) v = 0.3
    out.push(v)
  }
  if (!widen) out.push(-37.5, 37.5, -250, 250)
  else out.push(-3.7, 3.7, -0.7, 0.7, 2.3, -2.3)
  if (checkValue != null && Number.isFinite(checkValue)) out.push(checkValue)
  return out
}

/**
 * Sample scopes for `vars` (1 or more). Two-variable sets are 14 seeded pairs plus a few fixed
 * pairs, plus rows using the stored check value. Never |v| ≥ 1e3.
 */
export function makeSamples(vars: readonly string[], seed = DEFAULT_SEED, checkValue?: number, widen = false): Scope[] {
  if (vars.length === 0) return [{}]
  if (vars.length === 1) {
    const v = vars[0]!
    return sampleValues1D(seed, checkValue, widen).map((n) => ({ [v]: n }))
  }
  const rand = mulberry32(seed ^ 0x2545f491 ^ (widen ? 0x51ed27 : 0))
  const range = widen ? 30 : 10
  const out: Scope[] = []
  for (let i = 0; i < 14; i++) {
    const row: Scope = {}
    for (const v of vars) row[v] = drawAvoiding(rand, -range, range)
    out.push(row)
  }
  const fixedPairs: [number, number][] = widen
    ? [
        [-3.7, 2.3],
        [2.3, -0.7],
        [0.7, 3.7],
      ]
    : [
        [2, 0.5],
        [-3, 2.5],
        [37.5, -2.3],
        [-2.3, 37.5],
        [250, 0.6],
        [-0.6, -250],
      ]
  for (const [a, b] of fixedPairs) {
    const row: Scope = {}
    vars.forEach((v, i) => {
      row[v] = i === 0 ? a : i === 1 ? b : drawAvoiding(rand, -range, range)
    })
    out.push(row)
  }
  if (checkValue != null && Number.isFinite(checkValue)) {
    for (const v of vars) {
      const row: Scope = {}
      for (const w of vars) row[w] = w === v ? checkValue : drawAvoiding(rand, -range, range)
      out.push(row)
    }
  }
  return vars.includes('h') ? withStepH(out, vars, rand) : out
}

/** (x, h) rows inside a radical's domain: x > 0 and x + h > 0 (sqrt(x + h) − sqrt(x) needs both). */
const STEP_H_ROWS: readonly [number, number][] = [
  [0.7, 0.3],
  [1.3, 2.1],
  [2.9, -0.4],
  [4.1, 1.7],
  [6.3, -2.2],
  [0.35, 5.5],
  [3.6, 0.15],
  [9.4, -3.1],
  [2.2, 0.9],
  [5.3, -1.3],
  [7.7, 0.6],
  [11.2, -2.7],
  [8.4, 3.3],
  [12.5, 1.1],
]

/**
 * Variable sets with the difference-quotient step `h` (a variable only that module owns): h is never
 * near 0 and x + h is never near 0 (the DQ of 1/x), and extra rows sit inside a square root's domain so
 * sqrt(x + h) − sqrt(x) still has enough defined samples. Other variable sets are untouched.
 */
function withStepH(rows: Scope[], vars: readonly string[], rand: () => number): Scope[] {
  const away = (v: number | undefined) => v == null || Math.abs(v) >= 0.05
  const keep = rows.filter((r) => away(r.h) && (r.x == null || r.h == null || away(r.x + r.h)))
  if (!vars.includes('x')) return keep
  for (const [x, h] of STEP_H_ROWS) {
    const row: Scope = {}
    for (const v of vars) row[v] = v === 'x' ? x : v === 'h' ? h : drawAvoiding(rand, -10, 10)
    keep.push(row)
  }
  return keep
}

/** Legacy helper used by the interval parser and NumberLine component. */
export function samplesFor(vars: string[], seed = DEFAULT_SEED): Scope[] {
  return makeSamples(vars, seed)
}

// ---------------------------------------------------------------------------
// Relation truth (tolerance-aware)
// ---------------------------------------------------------------------------

/** Tolerance-aware comparison: `eq` when |L−R| ≤ 1e-9·max(1, |L|, |R|, scale). */
export function relHolds(op: RelOp, left: number, right: number, scale = 0): boolean {
  const eq = nearlyEqual(left, right, Math.max(Math.abs(left), Math.abs(right), scale))
  switch (op) {
    case '=':
      return eq
    case '<':
      return left < right && !eq
    case '<=':
      return left < right || eq
    case '>':
      return left > right && !eq
    case '>=':
      return left > right || eq
  }
}

export function relScale(rel: Relation, scope: Scope): number {
  return Math.max(operandScale(rel.lhs, scope), operandScale(rel.rhs, scope))
}

export function evalRelation(rel: Relation, scope: Scope): Truth {
  const l = evalNode(rel.lhs, scope)
  const r = evalNode(rel.rhs, scope)
  if (l === 'undef' || r === 'undef') return 'undef'
  return relHolds(rel.op, l, r, relScale(rel, scope))
}

/**
 * `evalRelation`, but a relation sitting on a root of L − R within a hair of `v` counts as being
 * AT that root (so = / ≤ / ≥ hold and < / > do not). Needed where the slope is infinite: at the
 * nearest float to y = −10/3, cbrt(3y + 10) is still 1e-5 away from 0. The root must be real:
 * L − R changes sign across t ± 1e-9·|t| and |L − R| is smaller at t than on either side (a pole
 * also changes sign but grows toward t).
 */
export function evalRelationNear(rel: Relation, scope: Scope, v: string): Truth {
  const truth = evalRelation(rel, scope)
  const t = scope[v]
  if (truth === 'undef' || t == null) return truth
  const l = evalNode(rel.lhs, scope) as number
  const r = evalNode(rel.rhs, scope) as number
  const g = l - r
  if (nearlyEqual(l, r, Math.max(Math.abs(l), Math.abs(r), relScale(rel, scope)))) return truth
  if (Math.abs(g) > 1e-3 * Math.max(1, Math.abs(l), Math.abs(r))) return truth
  const d = 1e-9 * Math.max(1, Math.abs(t))
  const gAt = (u: number): number => {
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

/** `statementHolds` with `evalRelationNear` in variable `v` (Tier 2 truth values). */
export function statementHoldsNear(stmt: Statement, scope: Scope, v: string): Truth {
  return holdsWith(stmt, (rel) => evalRelationNear(rel, scope, v))
}

/** OR over disjuncts of AND over conjuncts; 'undef' when no clause could be evaluated. */
export function statementHolds(stmt: Statement, scope: Scope): Truth {
  return holdsWith(stmt, (rel) => evalRelation(rel, scope))
}

function holdsWith(stmt: Statement, evalRel: (rel: Relation) => Truth): Truth {
  let sawDef = false
  for (const clause of stmt.disjuncts) {
    let allTrue = true
    for (const rel of clause) {
      const v = evalRel(rel)
      if (v === 'undef') {
        allTrue = false
        break
      }
      sawDef = true
      if (!v) {
        allTrue = false
        break
      }
    }
    if (allTrue) return true
  }
  return sawDef ? false : 'undef'
}

export function gValue(rel: Relation, scope: Scope): number | 'undef' {
  const l = evalNode(rel.lhs, scope)
  const r = evalNode(rel.rhs, scope)
  if (l === 'undef' || r === 'undef') return 'undef'
  return l - r
}

// ---------------------------------------------------------------------------
// Expression equivalence on samples
// ---------------------------------------------------------------------------

export interface ExprCompare {
  equivalent: boolean
  /** Fewer than `minDefined` samples where both are defined (after widening). */
  undecidable: boolean
  /** First sample where the values differ (both defined). */
  witness?: { scope: Scope; a: number; b: number }
  /** Samples where exactly one side was defined. */
  domainMismatches: Scope[]
  compared: number
}

export interface ExprOptions {
  /** 'strict': a point where only one side is defined counts against equivalence (≤1 tolerated
   *  for an isolated point hit by a fixed sample). 'loose': ignore one-sided undefined points. */
  domain?: 'strict' | 'loose'
  minDefined?: number
}

export function compareOnSamples(a: MathNode, b: MathNode, samples: Scope[], opts: ExprOptions = {}): ExprCompare {
  const domain = opts.domain ?? 'strict'
  const minDefined = opts.minDefined ?? 8
  let compared = 0
  const domainMismatches: Scope[] = []
  let witness: ExprCompare['witness']
  for (const s of samples) {
    const va = evalNode(a, s)
    const vb = evalNode(b, s)
    if (va === 'undef' && vb === 'undef') continue
    if (va === 'undef' || vb === 'undef') {
      domainMismatches.push(s)
      continue
    }
    compared++
    const scale = Math.max(operandScale(a, s), operandScale(b, s))
    if (!nearlyEqual(va, vb, scale)) {
      witness ??= { scope: s, a: va, b: vb }
    }
  }
  const undecidable = compared < minDefined && !witness
  const domainBad = domain === 'strict' && domainMismatches.length > 1
  return {
    equivalent: !witness && !undecidable && !domainBad,
    undecidable,
    witness,
    domainMismatches,
    compared,
  }
}

/**
 * Numeric equivalence of two expressions on the seeded sample set (widened once when too few
 * samples are defined).
 */
export function exprEquiv(
  a: MathNode,
  b: MathNode,
  vars: readonly string[],
  seed = DEFAULT_SEED,
  opts: ExprOptions = {},
  checkValue?: number,
): ExprCompare {
  const vs = vars.length ? vars : ['x']
  let res = compareOnSamples(a, b, makeSamples(vs, seed, checkValue), opts)
  if (res.undecidable) {
    const more = [...makeSamples(vs, seed, checkValue), ...makeSamples(vs, seed, checkValue, true)]
    res = compareOnSamples(a, b, more, opts)
  }
  return res
}

/** Boolean convenience (strict domain). */
export function exprEquivalent(a: MathNode, b: MathNode, vars: readonly string[], seed = DEFAULT_SEED): boolean {
  return exprEquiv(a, b, vars, seed).equivalent
}

/** Same value at every defined sample (≥ 4 of them) → that value, else null. */
export function constantOnSamples(values: (number | 'undef')[], min = 4): number | null {
  const nums = values.filter((v): v is number => v !== 'undef')
  if (nums.length < min) return null
  const first = nums[0]!
  for (const n of nums) {
    if (!nearlyEqual(n, first, Math.max(1, Math.abs(first), Math.abs(n)))) return null
  }
  return first
}

// ---------------------------------------------------------------------------
// Number display
// ---------------------------------------------------------------------------

/** Snap to an integer or a fraction with denominator ≤ 6 when within 1e-6; else 3 decimals. */
export function niceNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  for (const den of [1, 2, 3, 4, 5, 6]) {
    const num = Math.round(n * den)
    if (Math.abs(n * den - num) < 1e-6) {
      if (den === 1) return String(num === 0 ? 0 : num)
      return `${num}/${den}`
    }
  }
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

/** Prose form: unicode minus, e.g. "−14", "−1/2". */
export function prettyNumber(n: number): string {
  return niceNumber(n).replace(/-/g, '−')
}

/** Rank for counterexample choice: integers (0) → fractions den ≤ 6 (1) → other (2). */
export function nicenessRank(v: number): number {
  if (Math.abs(v - Math.round(v)) < 1e-6) return 0
  for (const den of [2, 3, 4, 5, 6]) {
    if (Math.abs(v * den - Math.round(v * den)) < 1e-6) return 1
  }
  return 2
}

export function snapNumber(v: number): number {
  for (const den of [1, 2, 3, 4, 5, 6]) {
    const num = Math.round(v * den)
    if (Math.abs(v * den - num) < 1e-6) return num / den
  }
  return v
}

export function primaryVar(stmt: Statement, fallback = 'x'): string {
  if (stmt.vars.includes('x')) return 'x'
  if (stmt.vars.includes('n')) return 'n'
  if (stmt.vars.includes('y') && stmt.vars.length === 1) return 'y'
  return stmt.vars[0] ?? fallback
}

export function relationCount(stmt: Statement): number {
  return stmt.disjuncts.reduce((n, c) => n + c.length, 0)
}

export function isInequalityStatement(stmt: Statement): boolean {
  return stmt.disjuncts.some((c) => c.some((r) => isInequality(r.op)))
}
