/**
 * The graph as the plane, the points of interest, the table and "Zoom to fit" see it: every row parsed (parse.ts) and
 * compiled (compile.ts) once, with the sliders' values and the angle mode read live from one shared Env, so dragging
 * a slider or switching DEGREE redraws without recompiling. Each row becomes what it draws: a curve y = f(x), a
 * shaded region with its edge, a vertical line, shading beside one, or points; a row with y in it once (2x + 3y = 6,
 * xy = 1) is solved for y here, with the sliders' values. Pure.
 */
import type { RelOp } from '@/shared/types'
import { CompileError, compileExpression, inX, makeEnv, type AngleMode, type Closure, type Compiled, type Env } from './compile'
import { parseRows, type FunctionInfo, type Ineq, type ParsedRows, type Restriction, type RowError, type RowParse, type RowShape } from './parse'
import type { Fn } from './roots'

export interface GraphRowInput {
  id: string
  text: string
  hidden?: boolean
}

/** One row as a function of x (a curve, her function, a region's edge): what is sampled, analysed and tabled. */
export interface CurveFn {
  f: Fn
  crit: Fn[]
  allow?: (x: number) => boolean
  allowCrit?: Fn[]
}

export type DrawItem =
  | ({ kind: 'curve' } & CurveFn)
  | ({ kind: 'region'; below: boolean; strict: boolean } & CurveFn)
  | { kind: 'vline'; x: number }
  | { kind: 'xregion'; x: number; left: boolean; strict: boolean }
  | { kind: 'points'; points: { x: number; y: number }[] }

export interface ModelRow {
  id: string
  index: number
  parse: RowParse
  kind: RowShape['kind']
  /** Why it is not drawn: a parse error, or something the grapher cannot compute (it is not linear in y...). */
  error: RowError | null
  hidden: boolean
}

export interface GraphModel {
  rows: ModelRow[]
  /** Letters that get a slider (used, and not given a value by a row), in order of first use. */
  sliders: string[]
  /** Letters given a value by a row (a = 2): letter → row index. */
  constants: Map<string, number>
  functions: Map<string, FunctionInfo>
  env: Env
  /** The sliders' values; letters with no value get 1. Constant rows are worked out from them. */
  setParams(values: Readonly<Record<string, number>>): void
  setMode(mode: AngleMode): void
  /** The value a constant row gives its letter now (NaN where it cannot be worked out). */
  constantValue(letter: string): number
  /** Row i as it draws now (null: empty, hidden, an error, a constant). Errors found here are written to rows[i]. */
  draw(i: number): DrawItem | null
  /** Row i as a function of x, when it is one (a curve, her function, a region's edge). */
  curve(i: number): CurveFn | null
}

const DEFAULT_SLIDER_VALUE = 1

interface RelC {
  l: Compiled
  r: Compiled
  op: RelOp
}

/** A restriction compiled: whether x is in it, and its boundaries (left side minus right side of each condition). */
function compileRestriction(restrict: Restriction | null, scope: Parameters<typeof compileExpression>[1], env: Env): { allow?: (x: number) => boolean; allowCrit?: Fn[] } {
  if (!restrict) return {}
  const clauses: RelC[][] = restrict.disjuncts.map((clause) => clause.map((rel) => ({ l: compileExpression(rel.lhs, scope), r: compileExpression(rel.rhs, scope), op: rel.op })))
  const holds = (rel: RelC, e: Env): boolean => {
    const a = rel.l.run(e)
    const b = rel.r.run(e)
    if (Number.isNaN(a) || Number.isNaN(b)) return false
    // At the boundary itself (found to about 1e-16) the comparison decides open or filled; a hair inside it (the
    // sampler looks 1e-9 of the way in) is inside.
    const tol = 1e-12 * Math.max(1, Math.abs(a), Math.abs(b))
    switch (rel.op) {
      case '<':
        return a < b - tol
      case '<=':
        return a <= b + tol
      case '>':
        return a > b + tol
      case '>=':
        return a >= b - tol
      case '=':
        return Math.abs(a - b) <= tol
      default:
        return false
    }
  }
  const allow = (x: number) => {
    env.x = x
    env.y = 0
    return clauses.some((clause) => clause.every((rel) => holds(rel, env)))
  }
  const allowCrit: Fn[] = clauses.flat().map((rel) => inX((e: Env) => rel.l.run(e) - rel.r.run(e), env))
  return { allow, allowCrit }
}

function errorOf(e: unknown): RowError {
  if (e instanceof CompileError) return { message: e.message }
  return { message: 'The grapher could not work this row out.' }
}

/** Test points for "is it linear in y": spread out, none a likely special value. */
const PROBES = [-3.71, -1.29, 0.37, 1.83, 4.61, -7.3, 9.1, 0.11]

/**
 * F(x, y) = 0 (or < 0...) with y in it once, linearly: F = A·y + B(x). Returns y as a function of x (−B/A) and the sign
 * of A (an inequality turns when A is negative), or a sentence when it is not linear in y, or A depends on x in an
 * inequality.
 */
function solveForY(F: Closure, env: Env, inequality: boolean): { y: Closure; aCrit: Closure | null; sign: number } | RowError {
  const at = (x: number, y: number) => {
    env.x = x
    env.y = y
    return F(env)
  }
  let checked = 0
  let a0: number | null = null
  let aVaries = false
  for (const x of PROBES) {
    const f0 = at(x, 0)
    const f1 = at(x, 1)
    const f2 = at(x, 2)
    const f5 = at(x, -5)
    if (![f0, f1, f2, f5].every(Number.isFinite)) continue
    const a = f1 - f0
    const scale = Math.max(1, Math.abs(f0), Math.abs(f1), Math.abs(f2), Math.abs(f5))
    if (Math.abs(f2 - f0 - 2 * a) > 1e-9 * scale || Math.abs(f5 - f0 + 5 * a) > 1e-9 * scale) {
      return { message: 'This grapher draws y as a function of x. Solve for y first, like y = sqrt(25 - x^2) and y = -sqrt(25 - x^2) for a circle.' }
    }
    if (a0 === null) a0 = a
    else if (Math.abs(a - a0) > 1e-9 * Math.max(1, Math.abs(a0))) aVaries = true
    checked++
  }
  if (checked === 0 || a0 === null) return { message: 'This row is not defined anywhere the grapher can see.' }
  if (!aVaries && Math.abs(a0) < 1e-12) return { message: 'y cancels out of this row: there is nothing to solve for.' }
  if (aVaries && inequality) return { message: 'Write the inequality with y alone on one side, like y < 2x + 1.' }
  const A: Closure = (e) => {
    const x = e.x
    e.y = 1
    const f1 = F(e)
    e.y = 0
    const f0 = F(e)
    e.x = x
    return f1 - f0
  }
  const y: Closure = (e) => {
    e.y = 0
    const b = F(e)
    const a = aVaries ? A(e) : (a0 as number)
    return a === 0 ? Number.NaN : -b / a
  }
  return { y, aCrit: aVaries ? A : null, sign: Math.sign(a0) }
}

export function buildModel(input: readonly GraphRowInput[], mode: AngleMode = 'rad'): GraphModel {
  const parsed: ParsedRows = parseRows(input.map((r) => r.text))
  const letters = [...parsed.sliders, ...parsed.constants.keys()]
  const index = new Map<string, number>(letters.map((l, i) => [l, i]))
  const env = makeEnv(letters.length, mode)
  const scope = { params: index, functions: parsed.bodies, allowY: false }
  const scopeY = { ...scope, allowY: true }

  const rows: ModelRow[] = input.map((r, i) => {
    const p = parsed.rows[i]!
    return { id: r.id, index: i, parse: p, kind: p.shape.kind, error: p.shape.kind === 'error' ? p.shape.error : null, hidden: Boolean(r.hidden) }
  })

  // ---- compile every row once ----
  type Built =
    | { kind: 'fn'; run: Closure; crit: Closure[]; restrict: ReturnType<typeof compileRestriction>; region?: { op: Ineq } }
    | { kind: 'implicit'; F: Compiled; op: '=' | Ineq; restrict: ReturnType<typeof compileRestriction> }
    | { kind: 'value'; run: Closure }
    | { kind: 'xregion'; run: Closure; op: Ineq }
    | { kind: 'points'; pts: { x: Closure; y: Closure }[] }
    | null
  const built: Built[] = rows.map((row) => {
    if (row.error) return null
    const shape = row.parse.shape
    try {
      switch (shape.kind) {
        case 'curve':
        case 'define': {
          const c = compileExpression(shape.expr, scope)
          return { kind: 'fn', run: c.run, crit: c.crit, restrict: compileRestriction(shape.restrict, scope, env) }
        }
        case 'region': {
          const c = compileExpression(shape.expr, scope)
          return { kind: 'fn', run: c.run, crit: c.crit, restrict: compileRestriction(shape.restrict, scope, env), region: { op: shape.op } }
        }
        case 'implicit': {
          const l = compileExpression(shape.lhs, scopeY)
          const r = compileExpression(shape.rhs, scopeY)
          const lr = l.run
          const rr = r.run
          const F: Compiled = { run: (e) => lr(e) - rr(e), crit: [...l.crit, ...r.crit], usesX: l.usesX || r.usesX, usesY: l.usesY || r.usesY }
          return { kind: 'implicit', F, op: shape.op, restrict: compileRestriction(shape.restrict, scope, env) }
        }
        case 'vline':
        case 'constant':
          return { kind: 'value', run: compileExpression(shape.expr, scope).run }
        case 'xregion':
          return { kind: 'xregion', run: compileExpression(shape.expr, scope).run, op: shape.op }
        case 'points':
          return { kind: 'points', pts: shape.points.map((pt) => ({ x: compileExpression(pt.x, scope).run, y: compileExpression(pt.y, scope).run })) }
        default:
          return null
      }
    } catch (e) {
      row.error = errorOf(e)
      return null
    }
  })

  const constantRows = [...parsed.constants.entries()]
  const constants = new Map<string, number>()
  const sliderValues: Record<string, number> = {}

  function setParams(values: Readonly<Record<string, number>>) {
    for (const l of parsed.sliders) {
      const v = values[l]
      const value = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_SLIDER_VALUE
      sliderValues[l] = value
      env.p[index.get(l)!] = value
    }
    // Constant rows, in as many passes as their dependencies need (a = 2, b = a + 1).
    for (const [l] of constantRows) env.p[index.get(l)!] = Number.NaN
    for (let pass = 0; pass <= constantRows.length; pass++) {
      let changed = false
      for (const [l, rowIndex] of constantRows) {
        const b = built[rowIndex]
        const v = b && b.kind === 'value' ? b.run(env) : Number.NaN
        const i = index.get(l)!
        if (!Object.is(env.p[i], v)) {
          env.p[i] = v
          changed = true
        }
        constants.set(l, v)
      }
      if (!changed) break
    }
  }
  setParams({})

  const xOnly = (run: Closure): Fn => inX(run, env)

  function curve(i: number): CurveFn | null {
    const b = built[i]
    if (!b) return null
    if (b.kind === 'fn') return { f: xOnly(b.run), crit: b.crit.map(xOnly), ...b.restrict }
    if (b.kind === 'implicit') {
      const solved = solveForY(b.F.run, env, b.op !== '=')
      if ('message' in solved) {
        rows[i]!.error = solved
        return null
      }
      rows[i]!.error = null
      const crit = b.F.crit.map(xOnly)
      if (solved.aCrit) crit.push(xOnly(solved.aCrit))
      return { f: xOnly(solved.y), crit, ...b.restrict }
    }
    return null
  }

  function draw(i: number): DrawItem | null {
    const row = rows[i]!
    if (row.hidden) return null
    const b = built[i]
    if (!b) return null
    switch (b.kind) {
      case 'fn': {
        const c = curve(i)
        if (!c) return null
        if (b.region) {
          const op = b.region.op
          return { kind: 'region', below: op === '<' || op === '<=', strict: op === '<' || op === '>', ...c }
        }
        return { kind: 'curve', ...c }
      }
      case 'implicit': {
        const c = curve(i)
        if (!c) return null
        if (b.op === '=') return { kind: 'curve', ...c }
        // A·y + B < 0 is y < −B/A when A > 0, and turns over when A < 0 (A is a constant here: curve() checked).
        const solved = solveForY(b.F.run, env, true)
        const sign = 'sign' in solved ? solved.sign : 1
        const below = (b.op === '<' || b.op === '<=') === sign > 0
        return { kind: 'region', below, strict: b.op === '<' || b.op === '>', ...c }
      }
      case 'value': {
        if (row.kind !== 'vline') return null
        const x = b.run(env)
        return Number.isFinite(x) ? { kind: 'vline', x } : null
      }
      case 'xregion': {
        const x = b.run(env)
        if (!Number.isFinite(x)) return null
        return { kind: 'xregion', x, left: b.op === '<' || b.op === '<=', strict: b.op === '<' || b.op === '>' }
      }
      case 'points': {
        const points = b.pts.map((pt) => ({ x: pt.x(env), y: pt.y(env) })).filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))
        return { kind: 'points', points }
      }
      default:
        return null
    }
  }

  return {
    rows,
    sliders: parsed.sliders,
    constants: new Map(parsed.constants),
    functions: parsed.functions,
    env,
    setParams,
    setMode: (m) => {
      env.deg = m === 'deg'
    },
    constantValue: (l) => constants.get(l) ?? Number.NaN,
    draw,
    curve,
  }
}

/** A number she typed for a slider or a table (−1/2, 2pi, 3.5); null when it is not a number. */
export function evaluateConstant(text: string): number | null {
  if (!text.trim()) return null
  const m = buildModel([{ id: 'v', text: `y = ${text}` }])
  if (m.rows[0]!.error || m.sliders.length > 0 || m.functions.size > 0) return null
  const c = m.curve(0)
  if (!c) return null
  const a = c.f(0)
  const b = c.f(1)
  return Number.isFinite(a) && a === b ? a : null
}

/** Rows that are functions of x right now, with their index (for points of interest, the table, Zoom to fit). */
export function visibleCurves(model: GraphModel): { index: number; id: string; fn: CurveFn }[] {
  const out: { index: number; id: string; fn: CurveFn }[] = []
  for (const row of model.rows) {
    if (row.hidden) continue
    const item = model.draw(row.index)
    if (item && (item.kind === 'curve' || item.kind === 'region')) out.push({ index: row.index, id: row.id, fn: item })
  }
  return out
}
