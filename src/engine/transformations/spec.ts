/**
 * A transformation of a parent function, g(x) = a·f(b(x − h)) + k, with exact rational a, b, h, k.
 *
 * - `makeTransform` builds and checks a spec (a ≠ 0, b ≠ 0).
 * - Renderers give app-syntax text the parser reads back: f-notation ("-2f(x - 3) + 1"), the explicit
 *   formula ("-2(x - 3)^2 + 1", "sqrt(-(x + 2))", "3/(x - 1) + 2") and, with form 'unfactored', the inside
 *   multiplied out ("f(2x - 6)", "sqrt(2x - 6)"), the form templates use to set the classic trap.
 * - `mapPoint`: (p, q) on f → (p/b + h, a·q + k) on g, exactly. `keyFeatures`: anchor, asymptotes, key
 *   points, domain and range.
 * - `sameGraph`: two specs draw the same graph (exact canonical forms: a·(b(x − h))^2 = a·b²·(x − h)^2 …).
 * - `specValue`: g(x) exactly (a surd for sqrt), used by the graders' probes.
 */
import type { Rational, SolutionSet } from '@/shared/types'
import { rat, ratAbs, ratAdd, ratCompare, ratDiv, ratMul, ratNeg, ratSub } from '@/notation/rational'
import { allReals, setFromPieces } from '@/notation/sets/solutionSet'
import {
  surdAdd,
  surdEquals,
  surdOf,
  surdRoot,
  surdScale,
  surdSqrt,
  Unsupported,
  type ExactValue,
  type Surd,
} from '../functions/exact'
import { intervalText } from '../functions/text'
import { coefPrefix, isMinusOne, isOne, pointPretty, pretty, rp, signedTerm, toRational, xMinus } from './text'
import type { ExactPoint, KeyFeatures, ParentInfo, ParentName, PointLike, RatLike, StatementForm, TransformSpec } from './types'

const R = (n: number, d = 1): Rational => rat(n, d)
const P = (x: Rational, y: Rational): ExactPoint => ({ x, y })

export const PARENT_NAMES: readonly ParentName[] = ['square', 'cube', 'sqrt', 'cbrt', 'abs', 'reciprocal']

export const PARENTS: Readonly<Record<ParentName, ParentInfo>> = {
  square: {
    name: 'square',
    formula: 'x^2',
    words: 'squaring',
    symmetry: 'even',
    anchor: 'vertex',
    keyPoints: [P(R(-2), R(4)), P(R(-1), R(1)), P(R(0), R(0)), P(R(1), R(1)), P(R(2), R(4))],
  },
  cube: {
    name: 'cube',
    formula: 'x^3',
    words: 'cubing',
    symmetry: 'odd',
    anchor: 'center',
    keyPoints: [P(R(-2), R(-8)), P(R(-1), R(-1)), P(R(0), R(0)), P(R(1), R(1)), P(R(2), R(8))],
  },
  sqrt: {
    name: 'sqrt',
    formula: 'sqrt(x)',
    words: 'square root',
    symmetry: 'none',
    anchor: 'start point',
    keyPoints: [P(R(0), R(0)), P(R(1), R(1)), P(R(4), R(2)), P(R(9), R(3))],
  },
  cbrt: {
    name: 'cbrt',
    formula: 'cbrt(x)',
    words: 'cube root',
    symmetry: 'odd',
    anchor: 'center',
    keyPoints: [P(R(-8), R(-2)), P(R(-1), R(-1)), P(R(0), R(0)), P(R(1), R(1)), P(R(8), R(2))],
  },
  abs: {
    name: 'abs',
    formula: 'abs(x)',
    words: 'absolute value',
    symmetry: 'even',
    anchor: 'vertex',
    keyPoints: [P(R(-2), R(2)), P(R(-1), R(1)), P(R(0), R(0)), P(R(1), R(1)), P(R(2), R(2))],
  },
  reciprocal: {
    name: 'reciprocal',
    formula: '1/x',
    words: 'reciprocal',
    symmetry: 'odd',
    anchor: null,
    keyPoints: [
      P(R(-2), R(-1, 2)),
      P(R(-1), R(-1)),
      P(R(-1, 2), R(-2)),
      P(R(1, 2), R(2)),
      P(R(1), R(1)),
      P(R(2), R(1, 2)),
    ],
  },
}

export interface TransformParams {
  a?: RatLike
  b?: RatLike
  h?: RatLike
  k?: RatLike
}

/**
 * g(x) = a·f(b(x − h)) + k (defaults a = 1, b = 1, h = 0, k = 0). Throws RangeError for an unknown parent,
 * an unreadable number, a = 0 or b = 0 (templates call this; a throw is a template bug).
 */
export function makeTransform(parent: ParentName, params: TransformParams = {}): TransformSpec {
  if (!PARENT_NAMES.includes(parent)) throw new RangeError(`unknown parent function "${String(parent)}"`)
  const read = (v: RatLike | undefined, fallback: number, name: string): Rational => {
    const r = toRational(v ?? fallback)
    if (!r) throw new RangeError(`${name} = ${String(v)} is not a number`)
    return r
  }
  const spec: TransformSpec = {
    parent,
    a: read(params.a, 1, 'a'),
    b: read(params.b, 1, 'b'),
    h: read(params.h, 0, 'h'),
    k: read(params.k, 0, 'k'),
  }
  const problem = specProblem(spec)
  if (problem) throw new RangeError(problem)
  return spec
}

/** Why a spec is not a valid transformation (null when it is). Graders return 'unsupported' with it. */
export function specProblem(spec: TransformSpec): string | null {
  if (!spec || !PARENT_NAMES.includes(spec.parent)) return `unknown parent function "${String(spec?.parent)}"`
  for (const key of ['a', 'b', 'h', 'k'] as const) {
    const r = spec[key]
    if (!r || !Number.isSafeInteger(r.n) || !Number.isSafeInteger(r.d) || r.d <= 0) return `${key} is not an exact rational`
  }
  if (spec.a.n === 0) return 'a cannot be 0 (g would be the constant k)'
  if (spec.b.n === 0) return 'b cannot be 0 (g would be the constant a·f(0) + k)'
  return null
}

/** App-syntax formula of the parent: "x^2", "sqrt(x)", "1/x". */
export function parentFormula(parent: ParentName): string {
  return PARENTS[parent].formula
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** b·h: the constant of the multiplied-out inside b·x − b·h. */
export function unfactoredConstant(spec: TransformSpec): Rational {
  return ratMul(spec.b, spec.h)
}

/** The unfactored form differs from the factored one (b ≠ 1 and h ≠ 0): f(2x − 6) vs f(2(x − 3)). */
export function hasUnfactoredForm(spec: TransformSpec): boolean {
  return !isOne(spec.b) && spec.h.n !== 0
}

/**
 * The inside of f, app syntax. Factored: "x - 3", "2(x - 3)", "-x", "-(x + 2)", "(1/2)x".
 * Unfactored: "2x - 6", "-x + 3", "(1/2)x - 2" (the same text as factored when b = 1 or h = 0).
 */
export function insideText(spec: TransformSpec, form: StatementForm = 'factored'): string {
  const { b, h } = spec
  if (form === 'unfactored' && hasUnfactoredForm(spec)) {
    const bx = isOne(b) ? 'x' : isMinusOne(b) ? '-x' : `${coefPrefix(b)}x`
    return `${bx}${signedTerm(ratNeg(ratMul(b, h)))}`
  }
  const xh = xMinus(h)
  if (isOne(b)) return xh
  if (isMinusOne(b)) return h.n === 0 ? '-x' : `-(${xh})`
  return h.n === 0 ? `${coefPrefix(b)}x` : `${coefPrefix(b)}(${xh})`
}

/** g in f-notation, app syntax: "-2f(x - 3) + 1", "f(-x)", "(1/2)f(2(x + 1)) - 4"; unfactored: "f(2x - 6)". */
export function fNotation(spec: TransformSpec, form: StatementForm = 'factored'): string {
  return `${coefPrefix(spec.a)}f(${insideText(spec, form)})${signedTerm(spec.k)}`
}

function powBase(u: string): string {
  return u === 'x' ? 'x' : `(${u})`
}

function reciprocalText(a: Rational, u: string): string {
  // a/(u) with a = p/q written p/(q·u): "3/(x - 1)", "1/x", "-1/(2(x - 3))".
  if (a.d === 1) return `${a.n}/${powBase(u)}`
  const den = u === 'x' ? `${a.d}x` : `${a.d}(${u})`
  return `${a.n}/(${den})`
}

/** The formula of g with the parent written out, app syntax. */
export function explicitFormula(spec: TransformSpec, form: StatementForm = 'factored'): string {
  const u = insideText(spec, form)
  const c = coefPrefix(spec.a)
  const tail = signedTerm(spec.k)
  switch (spec.parent) {
    case 'square':
      return `${c}${powBase(u)}^2${tail}`
    case 'cube':
      return `${c}${powBase(u)}^3${tail}`
    case 'sqrt':
      return `${c}sqrt(${u})${tail}`
    case 'cbrt':
      return `${c}cbrt(${u})${tail}`
    case 'abs':
      return `${c}abs(${u})${tail}`
    case 'reciprocal':
      return `${reciprocalText(spec.a, u)}${tail}`
  }
}

// ---------------------------------------------------------------------------
// Exact values
// ---------------------------------------------------------------------------

function ratPowInt(r: Rational, n: number): Rational {
  let out = rat(1)
  for (let i = 0; i < n; i++) out = ratMul(out, r)
  return out
}

/**
 * f(u) exactly: a Surd, or 'undef' (sqrt of a negative, 1/0). Throws `Unsupported` for a cube root of a
 * rational that is not a perfect cube (outside the exact model), or on overflow.
 */
export function parentValue(parent: ParentName, u: Rational): ExactValue {
  const guard = <T>(fn: () => T): T => {
    try {
      return fn()
    } catch (e) {
      if (e instanceof Unsupported) throw e
      throw new Unsupported(String((e as { message?: string })?.message ?? e))
    }
  }
  return guard(() => {
    switch (parent) {
      case 'square':
        return surdOf(ratMul(u, u))
      case 'cube':
        return surdOf(ratPowInt(u, 3))
      case 'abs':
        return surdOf(ratAbs(u))
      case 'reciprocal':
        return u.n === 0 ? 'undef' : surdOf(ratDiv(rat(1), u))
      case 'sqrt':
        return surdSqrt(surdOf(u))
      case 'cbrt':
        return surdRoot(surdOf(u), 3)
    }
  })
}

/** The inside b(x − h) at x. */
export function insideValue(spec: TransformSpec, x: Rational): Rational {
  return ratMul(spec.b, ratSub(x, spec.h))
}

/** g(x) exactly; throws `Unsupported` outside the exact model (cube root of a non-cube). */
export function specValue(spec: TransformSpec, x: Rational): ExactValue {
  const f = parentValue(spec.parent, insideValue(spec, x))
  if (f === 'undef') return f
  try {
    return surdAdd(surdScale(f, spec.a), surdOf(spec.k))
  } catch (e) {
    if (e instanceof Unsupported) throw e
    throw new Unsupported(String((e as { message?: string })?.message ?? e))
  }
}

/** g(x) exactly: a Surd (rational or with square roots), 'undef', or null (unreadable x or outside the exact model). */
export function transformValueAt(spec: TransformSpec, x: RatLike): Surd | 'undef' | null {
  const t = toRational(x)
  if (!t || specProblem(spec)) return null
  try {
    return specValue(spec, t)
  } catch (e) {
    if (e instanceof Unsupported || e instanceof RangeError) return null
    throw e
  }
}

// ---------------------------------------------------------------------------
// Points and features
// ---------------------------------------------------------------------------

/** (p, q) on f → (p/b + h, a·q + k) on g. Throws RangeError for an unreadable point. */
export function mapPoint(spec: TransformSpec, point: PointLike): ExactPoint {
  const x = toRational(point.x)
  const y = toRational(point.y)
  if (!x || !y) throw new RangeError('mapPoint needs numeric coordinates')
  return { x: ratAdd(ratDiv(x, spec.b), spec.h), y: ratAdd(ratMul(spec.a, y), spec.k) }
}

/** Exact domain of g. */
export function specDomain(spec: TransformSpec): SolutionSet {
  const { h, b } = spec
  if (spec.parent === 'sqrt') {
    return b.n > 0
      ? setFromPieces([{ lo: h, hi: 'inf', loClosed: true, hiClosed: false }])
      : setFromPieces([{ lo: '-inf', hi: h, loClosed: false, hiClosed: true }])
  }
  if (spec.parent === 'reciprocal') {
    return setFromPieces([
      { lo: '-inf', hi: h, loClosed: false, hiClosed: false },
      { lo: h, hi: 'inf', loClosed: false, hiClosed: false },
    ])
  }
  return allReals()
}

/** Exact range of g. */
export function specRange(spec: TransformSpec): SolutionSet {
  const { a, k } = spec
  switch (spec.parent) {
    case 'square':
    case 'abs':
    case 'sqrt':
      return a.n > 0
        ? setFromPieces([{ lo: k, hi: 'inf', loClosed: true, hiClosed: false }])
        : setFromPieces([{ lo: '-inf', hi: k, loClosed: false, hiClosed: true }])
    case 'reciprocal':
      return setFromPieces([
        { lo: '-inf', hi: k, loClosed: false, hiClosed: false },
        { lo: k, hi: 'inf', loClosed: false, hiClosed: false },
      ])
    default:
      return allReals()
  }
}

function fx(spec: TransformSpec): string {
  return `y = ${pretty(parentFormula(spec.parent))}`
}

/** Anchor, asymptotes, key points, domain and range of g, with reading lines. */
export function keyFeatures(spec: TransformSpec): KeyFeatures {
  const info = PARENTS[spec.parent]
  const origin = P(rat(0), rat(0))
  const points = info.keyPoints.map((p) => ({ parent: p, image: mapPoint(spec, p) }))
  const domain = specDomain(spec)
  const range = specRange(spec)
  const lines: string[] = []
  let anchor: KeyFeatures['anchor'] = null
  let asymptotes: KeyFeatures['asymptotes'] = null
  const hk = pointPretty(P(spec.h, spec.k))
  if (info.anchor) {
    anchor = { name: info.anchor, parent: origin, image: P(spec.h, spec.k) }
    lines.push(`The ${info.anchor} (0, 0) of ${fx(spec)} moves to ${hk}.`)
    if (info.anchor === 'vertex') {
      lines.push(spec.a.n > 0 ? `a = ${rp(spec.a)} > 0, so the graph opens up.` : `a = ${rp(spec.a)} < 0, so the graph opens down.`)
    }
    if (spec.parent === 'sqrt') {
      const lr = spec.b.n > 0 ? 'right' : 'left'
      const ud = spec.a.n > 0 ? 'up' : 'down'
      lines.push(`From ${hk} the graph goes ${lr} (b = ${rp(spec.b)}) and ${ud} (a = ${rp(spec.a)}).`)
    }
  } else {
    asymptotes = { vertical: spec.h, horizontal: spec.k }
    lines.push(`The asymptotes x = 0 and y = 0 of ${fx(spec)} move to x = ${rp(spec.h)} and y = ${rp(spec.k)}.`)
  }
  lines.push(`Domain: ${pretty(intervalText(domain))}. Range: ${pretty(intervalText(range))}.`)
  return {
    anchor,
    asymptotes,
    points,
    domain,
    range,
    domainInterval: intervalText(domain),
    rangeInterval: intervalText(range),
    explanation: lines,
  }
}

/**
 * A symmetric square window [−w, w] for the graph's xDomain: at least [−8, 8], wide enough for (h, k) and
 * for the images of f's key points near the origin (|x|, |y| ≤ 4), with a margin of 2, at most [−30, 30].
 */
export function graphWindow(spec: TransformSpec): [number, number] {
  const num = (r: Rational) => r.n / r.d
  const coords: number[] = [num(spec.h), num(spec.k)]
  for (const p of PARENTS[spec.parent].keyPoints) {
    if (Math.abs(num(p.x)) > 4 || Math.abs(num(p.y)) > 4) continue
    const img = mapPoint(spec, p)
    coords.push(num(img.x), num(img.y))
  }
  const w = Math.min(30, Math.max(8, Math.ceil(Math.max(...coords.map(Math.abs)) + 2)))
  return [-w, w]
}

// ---------------------------------------------------------------------------
// Same graph
// ---------------------------------------------------------------------------

type Canon =
  | { kind: 'rational'; A: Rational; s: number }
  | { kind: 'surd'; A: Surd; s: number }

/** The one number (and a sign) that, with h and k, pins down g: a·b² for x^2, a·√|b| and sign(b) for sqrt … */
function canon(spec: TransformSpec): Canon {
  const { a, b } = spec
  switch (spec.parent) {
    case 'square':
      return { kind: 'rational', A: ratMul(a, ratMul(b, b)), s: 1 }
    case 'cube':
      return { kind: 'rational', A: ratMul(a, ratPowInt(b, 3)), s: 1 }
    case 'abs':
      return { kind: 'rational', A: ratMul(a, ratAbs(b)), s: 1 }
    case 'reciprocal':
      return { kind: 'rational', A: ratDiv(a, b), s: 1 }
    case 'cbrt':
      // a·cbrt(b(x − h)) = (a·cbrt(b))·cbrt(x − h), and a·cbrt(b) is fixed by its cube a³·b.
      return { kind: 'rational', A: ratMul(ratPowInt(a, 3), b), s: 1 }
    case 'sqrt': {
      const root = surdSqrt(surdOf(ratAbs(b)))
      if (root === 'undef') throw new Unsupported('sqrt of |b|')
      return { kind: 'surd', A: surdScale(root, a), s: b.n > 0 ? 1 : -1 }
    }
  }
}

/** Do the two specs draw the same graph (the same function)? Exact. */
export function sameGraph(s1: TransformSpec, s2: TransformSpec): boolean {
  if (s1.parent !== s2.parent) return false
  if (ratCompare(s1.h, s2.h) !== 0 || ratCompare(s1.k, s2.k) !== 0) return false
  const c1 = canon(s1)
  const c2 = canon(s2)
  if (c1.s !== c2.s) return false
  if (c1.kind === 'rational' && c2.kind === 'rational') return ratCompare(c1.A, c2.A) === 0
  if (c1.kind === 'surd' && c2.kind === 'surd') return surdEquals(c1.A, c2.A)
  return false
}
