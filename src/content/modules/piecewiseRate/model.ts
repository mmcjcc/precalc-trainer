/**
 * Exact piecewise pieces for the graph, domain, continuity, and write templates.
 * Images are exact: each piece over its own interval, then the union (notation merges pieces that touch).
 */
import type { PiecewisePiece } from '@/engine'
import { evaluatePiecewise, pieceConditionText, piecewiseProblem } from '@/engine'
import type { Endpoint, GraphDot, GraphSample, GraphSpec, Piece, Rational, SolutionSet } from '@/shared/types'
import {
  allReals,
  components,
  emptySet,
  rat,
  ratAdd,
  ratCompare,
  ratDiv,
  ratEquals,
  ratMul,
  ratNeg,
  ratSub,
  ratToNumber,
  ratToString,
  setComplement,
  setContains,
  setFromPieces,
  setIntersection,
  setIsEmpty,
  setUnion,
  type Piece as SetPiece,
} from '@/notation'

export const ZERO = rat(0)
export const ONE = rat(1)

export type Expr =
  | { kind: 'const'; c: Rational }
  | { kind: 'linear'; m: Rational; b: Rational }
  | { kind: 'square' }
  | { kind: 'abs' }

export interface BuiltPiece {
  expr: Expr
  formula: string
  lo: Endpoint
  hi: Endpoint
  loClosed: boolean
  hiClosed: boolean
}

export interface StoredPiece {
  formula: string
  condition: string
  lo: string
  hi: string
  loClosed: boolean
  hiClosed: boolean
  expr?: { kind: 'const'; c: string } | { kind: 'linear'; m: string; b: string } | { kind: 'square' } | { kind: 'abs' }
}

/** Integer or half-integer slopes, never zero. */
export const SLOPES: readonly Rational[] = [rat(-4), rat(-3), rat(-2), rat(-1), rat(-1, 2), rat(1, 2), rat(1), rat(2), rat(3), rat(4)]

export function linearFormula(m: Rational, b: Rational): string {
  const t = linearTerm(m)
  if (!t) return ratToString(b)
  if (ratEquals(b, ZERO)) return t
  if (b.n < 0) return `${t} - ${ratToString(ratNeg(b))}`
  return `${t} + ${ratToString(b)}`
}

function linearTerm(m: Rational): string {
  if (ratEquals(m, ZERO)) return ''
  const neg = m.n < 0
  const mag = rat(Math.abs(m.n), m.d)
  const body = ratEquals(mag, ONE) ? 'x' : mag.d === 1 ? `${mag.n}x` : `(${mag.n}/${mag.d})x`
  return neg ? `-${body}` : body
}

export function formulaOf(expr: Expr): string {
  if (expr.kind === 'const') return ratToString(expr.c)
  if (expr.kind === 'square') return 'x^2'
  if (expr.kind === 'abs') return 'abs(x)'
  return linearFormula(expr.m, expr.b)
}

export function evalExpr(expr: Expr, x: Rational): Rational {
  if (expr.kind === 'const') return expr.c
  if (expr.kind === 'linear') return ratAdd(ratMul(expr.m, x), expr.b)
  if (expr.kind === 'square') return ratMul(x, x)
  return x.n < 0 ? ratNeg(x) : x
}

export function piece(expr: Expr, lo: number | '-inf', hi: number | 'inf', loClosed: boolean, hiClosed: boolean): BuiltPiece {
  return {
    expr,
    formula: formulaOf(expr),
    lo: lo === '-inf' ? '-inf' : rat(lo),
    hi: hi === 'inf' ? 'inf' : rat(hi),
    loClosed,
    hiClosed,
  }
}

export function asPiece(p: BuiltPiece): SetPiece {
  return { lo: p.lo, hi: p.hi, loClosed: p.loClosed, hiClosed: p.hiClosed }
}

function endText(e: Endpoint): string {
  return e === '-inf' || e === 'inf' ? e : ratToString(e)
}

function storedExpr(expr: Expr): StoredPiece['expr'] {
  if (expr.kind === 'const') return { kind: 'const', c: ratToString(expr.c) }
  if (expr.kind === 'linear') return { kind: 'linear', m: ratToString(expr.m), b: ratToString(expr.b) }
  return { kind: expr.kind }
}

export function storedPiece(p: BuiltPiece): StoredPiece {
  return {
    formula: p.formula,
    condition: pieceConditionText(asPiece(p)),
    lo: endText(p.lo),
    hi: endText(p.hi),
    loClosed: p.loClosed,
    hiClosed: p.hiClosed,
    expr: storedExpr(p.expr),
  }
}

export function toEngine(pieces: readonly BuiltPiece[]): PiecewisePiece[] {
  return pieces.map((p) => ({ formula: p.formula, interval: asPiece(p) }))
}

function parseEnd(text: string): Endpoint | null {
  if (text === '-inf' || text === 'inf') return text
  const r = parseRat(text)
  return r
}

/** "3", "-1/2", "5/4" — the same shapes `ratToString` writes. */
export function parseRat(text: string): Rational | null {
  const t = text.trim()
  const m = /^(-?\d+)(?:\/(\d+))?$/.exec(t)
  if (!m) return null
  const n = Number(m[1])
  const d = m[2] ? Number(m[2]) : 1
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) return null
  return rat(n, d)
}

export function fromStored(pieces: readonly StoredPiece[]): BuiltPiece[] | null {
  const out: BuiltPiece[] = []
  for (const p of pieces) {
    if (!p.expr) return null
    const lo = parseEnd(p.lo)
    const hi = parseEnd(p.hi)
    if (lo === null || hi === null) return null
    let expr: Expr
    if (p.expr.kind === 'square') expr = { kind: 'square' }
    else if (p.expr.kind === 'abs') expr = { kind: 'abs' }
    else if (p.expr.kind === 'const') {
      const c = parseRat(p.expr.c)
      if (!c) return null
      expr = { kind: 'const', c }
    } else {
      const m = parseRat(p.expr.m)
      const b = parseRat(p.expr.b)
      if (!m || !b) return null
      expr = { kind: 'linear', m, b }
    }
    out.push({ expr, formula: p.formula, lo, hi, loClosed: p.loClosed, hiClosed: p.hiClosed })
  }
  return out
}

function finite(e: Endpoint): e is Rational {
  return e !== '-inf' && e !== 'inf'
}

function imageEnd(x: Endpoint, yAt: (x: Rational) => Rational, increasing: boolean): Endpoint {
  if (finite(x)) return yAt(x)
  if (x === '-inf') return increasing ? '-inf' : 'inf'
  return increasing ? 'inf' : '-inf'
}

/** Image of a monotone piece. `increasing` is as x grows. */
function monoImage(increasing: boolean, yAt: (x: Rational) => Rational, iv: SetPiece): SolutionSet {
  const xLo = increasing ? iv.lo : iv.hi
  const xHi = increasing ? iv.hi : iv.lo
  const cLo = increasing ? iv.loClosed : iv.hiClosed
  const cHi = increasing ? iv.hiClosed : iv.loClosed
  const yLo = imageEnd(xLo, yAt, increasing)
  const yHi = imageEnd(xHi, yAt, increasing)
  return setFromPieces([{ lo: yLo, hi: yHi, loClosed: yLo === '-inf' ? false : cLo, hiClosed: yHi === 'inf' ? false : cHi }])
}

const NEG_SIDE: SetPiece = { lo: '-inf', hi: ZERO, loClosed: false, hiClosed: true }
const POS_SIDE: SetPiece = { lo: ZERO, hi: 'inf', loClosed: true, hiClosed: false }

/** x^2 and |x|: decreasing on (-inf, 0], increasing on [0, inf). */
function splitImage(yAt: (x: Rational) => Rational, iv: SetPiece): SolutionSet {
  const whole = setFromPieces([iv])
  let img = emptySet()
  for (const c of componentsOf(setIntersection(whole, setFromPieces([NEG_SIDE])))) img = setUnion(img, monoImage(false, yAt, c))
  for (const c of componentsOf(setIntersection(whole, setFromPieces([POS_SIDE])))) img = setUnion(img, monoImage(true, yAt, c))
  return img
}

function componentsOf(set: SolutionSet): SetPiece[] {
  return components(set)
}

export function imageOf(p: BuiltPiece): SolutionSet {
  const iv = asPiece(p)
  if (setIsEmpty(setFromPieces([iv]))) return emptySet()
  if (p.expr.kind === 'const') return setFromPieces([], [p.expr.c])
  if (p.expr.kind === 'linear') {
    if (ratEquals(p.expr.m, ZERO)) return setFromPieces([], [p.expr.b])
    const { m, b } = p.expr
    return monoImage(ratCompare(m, ZERO) > 0, (x) => ratAdd(ratMul(m, x), b), iv)
  }
  if (p.expr.kind === 'square') return splitImage((x) => ratMul(x, x), iv)
  return splitImage((x) => (x.n < 0 ? ratNeg(x) : x), iv)
}

export function domainOf(pieces: readonly BuiltPiece[]): SolutionSet {
  return setFromPieces(pieces.map(asPiece))
}

export function rangeOf(pieces: readonly BuiltPiece[]): SolutionSet {
  let s = emptySet()
  for (const p of pieces) s = setUnion(s, imageOf(p))
  return s
}

/** Fill every bounded hole, including a missing point. Rays of the complement stay out. */
export function domainFillGaps(domain: SolutionSet): SolutionSet {
  let s = domain
  for (const c of components(setComplement(domain))) {
    if (finite(c.lo) && finite(c.hi)) s = setUnion(s, setFromPieces([c]))
  }
  return s
}

/** Close the leftmost finite endpoint the domain actually excludes. Null when every finite end is already in. */
export function domainCloseOne(domain: SolutionSet): SolutionSet | null {
  const candidates: Rational[] = []
  for (const c of components(domain)) {
    if (finite(c.lo) && !c.loClosed && !setContains(domain, c.lo)) candidates.push(c.lo)
    if (finite(c.hi) && !c.hiClosed && !setContains(domain, c.hi)) candidates.push(c.hi)
  }
  if (candidates.length === 0) return null
  let pick = candidates[0]!
  for (const c of candidates) if (ratCompare(c, pick) < 0) pick = c
  return setUnion(domain, setFromPieces([], [pick]))
}

/** Closed interval from the smallest finite boundary x to the largest — inputs, not outputs. */
export function rangeFromX(pieces: readonly BuiltPiece[]): SolutionSet | null {
  const xs: Rational[] = []
  for (const p of pieces) {
    if (finite(p.lo)) xs.push(p.lo)
    if (finite(p.hi)) xs.push(p.hi)
  }
  if (xs.length === 0) return null
  let lo = xs[0]!
  let hi = xs[0]!
  for (const x of xs) {
    if (ratCompare(x, lo) < 0) lo = x
    if (ratCompare(x, hi) > 0) hi = x
  }
  if (ratEquals(lo, hi)) return setFromPieces([], [lo])
  return setFromPieces([{ lo, hi, loClosed: true, hiClosed: true }])
}

/** Each piece's image if x were allowed to be any real, then the union. */
export function unrestrictedRange(pieces: readonly BuiltPiece[]): SolutionSet {
  let s = emptySet()
  for (const p of pieces) {
    if (p.expr.kind === 'const') s = setUnion(s, setFromPieces([], [p.expr.c]))
    else if (p.expr.kind === 'linear') {
      s = setUnion(s, ratEquals(p.expr.m, ZERO) ? setFromPieces([], [p.expr.b]) : allReals())
    } else {
      s = setUnion(s, setFromPieces([{ lo: ZERO, hi: 'inf', loClosed: true, hiClosed: false }]))
    }
  }
  return s
}

/** The formula the engine evaluates agrees with the exact piece at the points that decide it. */
export function agreesWithEngine(pieces: readonly BuiltPiece[]): boolean {
  const eng = toEngine(pieces)
  if (piecewiseProblem(eng)) return false
  for (const p of pieces) {
    for (const x of probePiece(p)) {
      const ev = evaluatePiecewise(eng, x)
      const inside = setContains(setFromPieces([asPiece(p)]), x)
      if (!inside) continue
      if (!ev || !ev.defined || !ratEquals(ev.value, evalExpr(p.expr, x))) return false
    }
  }
  return true
}

function probePiece(p: BuiltPiece): Rational[] {
  const out: Rational[] = []
  if (finite(p.lo) && finite(p.hi)) {
    const span = ratSub(p.hi, p.lo)
    const steps = Math.max(4, Math.ceil(ratToNumber(span)) * 2)
    for (let k = 0; k <= steps; k++) out.push(ratAdd(p.lo, ratMul(span, rat(k, steps))))
  } else {
    if (finite(p.lo)) out.push(p.lo, ratAdd(p.lo, ONE))
    if (finite(p.hi)) out.push(p.hi, ratSub(p.hi, ONE))
  }
  return out
}

function windowOf(pieces: readonly BuiltPiece[]): [number, number] {
  const vals: number[] = [0]
  for (const p of pieces) {
    for (const e of [p.lo, p.hi]) {
      if (!finite(e)) continue
      vals.push(ratToNumber(e))
      vals.push(ratToNumber(evalExpr(p.expr, e)))
    }
    if (finite(p.lo) && finite(p.hi)) {
      const mid = ratDiv(ratAdd(p.lo, p.hi), rat(2))
      if (setContains(setFromPieces([asPiece(p)]), mid)) vals.push(ratToNumber(evalExpr(p.expr, mid)))
    }
  }
  let lo = Math.floor(Math.min(...vals) - 1)
  let hi = Math.ceil(Math.max(...vals) + 1)
  if (hi - lo < 4) {
    lo -= 1
    hi += 1
  }
  return [lo, hi]
}

function samplePiece(p: BuiltPiece, wLo: number, wHi: number): GraphSample[] {
  const lo = p.lo === '-inf' ? rat(Math.ceil(wLo)) : p.lo === 'inf' ? rat(Math.floor(wHi)) : p.lo
  const hi = p.hi === 'inf' ? rat(Math.floor(wHi)) : p.hi === '-inf' ? rat(Math.ceil(wLo)) : p.hi
  if (!finite(lo) || !finite(hi) || ratCompare(lo, hi) > 0) return []
  const span = ratSub(hi, lo)
  const steps = Math.max(8, Math.ceil(ratToNumber(span)) * 4)
  const run: GraphSample[] = []
  for (let k = 0; k <= steps; k++) {
    const x = ratEquals(span, ZERO) ? lo : ratAdd(lo, ratMul(span, rat(k, steps)))
    const y = evalExpr(p.expr, x)
    run.push({ x: ratToNumber(x), y: ratToNumber(y) })
  }
  return run
}

function pushDot(dots: GraphDot[], p: BuiltPiece, side: 'lo' | 'hi'): void {
  const e = side === 'lo' ? p.lo : p.hi
  if (!finite(e)) return
  dots.push({ x: ratToNumber(e), y: ratToNumber(evalExpr(p.expr, e)), closed: side === 'lo' ? p.loClosed : p.hiClosed })
}

function mergeDots(dots: GraphDot[]): GraphDot[] {
  const out: GraphDot[] = []
  for (const d of dots) {
    const hit = out.find((o) => Math.abs(o.x - d.x) < 1e-6 && Math.abs(o.y - d.y) < 1e-6)
    if (!hit) out.push({ x: d.x, y: d.y, closed: d.closed })
    else if (d.closed) hit.closed = true
  }
  return out
}

/** Square window so a slope reads as a slope. Rays are clipped to the window; far samples do not stretch it. */
export function sketchOf(pieces: readonly BuiltPiece[]): GraphSpec {
  const [lo, hi] = windowOf(pieces)
  const runs: GraphSample[][] = []
  const dots: GraphDot[] = []
  for (const p of pieces) {
    const run = samplePiece(p, lo, hi)
    if (run.length > 1) runs.push(run)
    pushDot(dots, p, 'lo')
    pushDot(dots, p, 'hi')
  }
  return { kind: 'function', xDomain: [lo, hi], yDomain: [lo, hi], runs, dots: mergeDots(dots) }
}

export function showMinus(text: string): string {
  return text.replace(/-/g, '−')
}

/** A rational strictly inside a finite piece, or null. Integer boundaries only. */
export function interiorInteger(p: BuiltPiece): number | null {
  if (!finite(p.lo) || !finite(p.hi) || p.lo.d !== 1 || p.hi.d !== 1) return null
  const from = p.lo.n + 1
  const to = p.hi.n - 1
  return from <= to ? from : null
}

export function containsInt(p: BuiltPiece, x: number): boolean {
  return setContains(setFromPieces([asPiece(p)]), rat(x))
}

// Piece is referenced so the shared interval type stays the one the engine uses.
export type { Piece }
