/**
 * Difference quotient (precalculus Unit 1, Day 5): DQ = (f(x + h) − f(x))/h, the slope of a secant.
 *
 * Two kinds of line are checked here:
 *  - the f(x + h) line (`checkFxhLine`): equivalent to f with every x replaced by (x + h);
 *  - every later line (`checkDqLine`): a legal rewrite of the line before it (via `verifyRewrite`,
 *    which also names the chip) and equivalent to the DQ. A line is FINISHED (`simplified`) when it is
 *    equivalent AND defined at h = 0 for sampled x: the h in the denominator has been cancelled. That
 *    numeric test works for polynomial, rational and radical f alike.
 *
 * Named mistakes are found the Tier-3 way: compute what each mistake WOULD produce for this f and
 * compare it numerically with her line on the x/h samples (h ≠ 0, x + h ≠ 0; see `makeSamples`).
 * Anything else wrong gets a counterexample at a friendly integer point.
 */
import type { Counterexample, ErrorPatternId, PatternHit, StepContext, StepResult, VarName } from '@/shared/types'
import { verifyRewrite } from './expressions'
import { collectVars, compileExpression, evalNode, isOp, isUnaryMinus, nodeArgs, tryConst, type MathNode } from './math'
import { patternHit } from './matchers/catalog'
import { normalizeGlyphs, parseExpression } from './parse'
import { DEFAULT_SEED, exprEquiv, makeSamples, niceNumber, nicenessRank, prettyNumber } from './samples'

/** The variables every difference-quotient line may use. */
export const DQ_VARS: readonly VarName[] = ['x', 'h']

export interface DqSpec {
  /** f(x) in app syntax, e.g. "3x^2 + 2x - 1". */
  f: string
  /**
   * The simplified difference quotient (in x and h). Optional: when given, the h → 0 limit is this
   * expression at h = 0 (exact); otherwise a Richardson central difference of f.
   */
  answer?: string
}

/** A checked line: the shared StepResult plus the difference-quotient verdicts. */
export interface DqLineResult extends StepResult {
  /** Equivalent to the DQ AND defined at h = 0 for sampled x: the problem's finished form. */
  simplified?: boolean
  /** Accepted but not simplified yet: what is left to do, in one sentence. */
  leftToDo?: string
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const X_TOKEN = /(?<![A-Za-z])x(?![A-Za-z])/g
const H_TOKEN = /(?<![A-Za-z])h(?![A-Za-z])/g

/**
 * Every x in `f` replaced by `(by)`: substituteX("5x - 2", "x + h") → "5(x + h) - 2". A single
 * letter goes in bare: substituteX("3x^2 + 2x", "h") → "3h^2 + 2h".
 */
export function substituteX(f: string, by: string): string {
  const b = by.trim()
  return normalizeGlyphs(f.trim()).replace(X_TOKEN, /^[a-z]$/i.test(b) ? b : `(${b})`)
}

/** f(x + h), unexpanded: "3x^2 + 2x - 1" → "3(x + h)^2 + 2(x + h) - 1". */
export function fOfXPlusH(f: string): string {
  return substituteX(f, 'x + h')
}

/**
 * The start line of the difference quotient with the f(x + h) line dropped in and f(x) IN
 * PARENTHESES, the way it is written on the worksheet: (5(x + h) - 2 - (5x - 2))/h.
 */
export function dqStartLine(fxhLine: string, f: string): string {
  return `(${normalizeGlyphs(fxhLine.trim())} - (${normalizeGlyphs(f.trim())}))/h`
}

/** The difference quotient of f as one expression: (f(x + h) - (f(x)))/h. */
export function differenceQuotient(f: string): string {
  return dqStartLine(fOfXPlusH(f), f)
}

/** "f(x+h) = 5(x+h) - 2" → "5(x+h) - 2": the function-notation left side is optional in the f(x + h) box. */
export function stripFxhLabel(text: string): string {
  return text.replace(/^\s*f\s*\(\s*x\s*\+\s*h\s*\)\s*=/i, '').trim()
}

/**
 * Plain app-syntax text of a node with implicit multiplication ("5x", "3(x + h)^2", "-5x + 2"), for
 * witness sentences. Not a round-trip printer: display only.
 */
export function appText(node: MathNode): string {
  const rec = node as unknown as Record<string, unknown>
  if (node.type === 'ConstantNode') {
    const v = tryConst(node)
    return v == null ? String(rec.value) : niceNumber(v)
  }
  if (node.type === 'SymbolNode') return String(rec.name)
  if (node.type === 'ParenthesisNode') return appText(rec.content as MathNode)
  if (node.type === 'FunctionNode') {
    const fn = rec.fn as { name?: string } | string
    const name = typeof fn === 'string' ? fn : (fn.name ?? 'f')
    return `${name}(${nodeArgs(node).map(appText).join(', ')})`
  }
  const args = nodeArgs(node)
  const isSum = (n: MathNode) => isOp(n, '+') || (isOp(n, '-') && nodeArgs(n).length === 2)
  const wrapIf = (n: MathNode, cond: boolean) => (cond ? `(${appText(n)})` : appText(n))
  if (isUnaryMinus(node)) {
    const a = args[0]!
    return `-${wrapIf(a, isSum(a) || isUnaryMinus(a))}`
  }
  if (isOp(node, '+')) {
    const right = appText(args[1]!)
    return right.startsWith('-') ? `${appText(args[0]!)} - ${right.slice(1)}` : `${appText(args[0]!)} + ${right}`
  }
  if (isOp(node, '-') && args.length === 2) {
    const b = args[1]!
    return `${appText(args[0]!)} - ${wrapIf(b, isSum(b) || isUnaryMinus(b))}`
  }
  if (isOp(node, '*')) {
    const [a, b] = [args[0]!, args[1]!]
    const left = wrapIf(a, isSum(a))
    const right = wrapIf(b, isSum(b) || isUnaryMinus(b))
    const juxtapose = /^[a-z(]/i.test(right) && !(b.type === 'ConstantNode')
    return juxtapose ? `${left}${right}` : `${left} * ${right}`
  }
  if (isOp(node, '/')) {
    const [a, b] = [args[0]!, args[1]!]
    const simpleDen = b.type === 'SymbolNode' || b.type === 'ConstantNode' || b.type === 'FunctionNode'
    return `${wrapIf(a, isSum(a) || isUnaryMinus(a))}/${wrapIf(b, !simpleDen)}`
  }
  if (isOp(node, '^')) {
    const [a, b] = [args[0]!, args[1]!]
    const simpleBase = a.type === 'SymbolNode' || a.type === 'ConstantNode' || a.type === 'FunctionNode'
    const simpleExp = b.type === 'SymbolNode' || b.type === 'ConstantNode'
    return `${wrapIf(a, !simpleBase || (tryConst(a) ?? 0) < 0)}^${wrapIf(b, !simpleExp)}`
  }
  return node.toString()
}

// ---------------------------------------------------------------------------
// Numeric model
// ---------------------------------------------------------------------------

type Val = number | 'undef'
type Fn2 = (x: number, h: number) => Val
type Pt = { x: number; h: number }

function nodeOf(text: string): MathNode | null {
  const p = parseExpression(text, DQ_VARS)
  return p.ok ? p.node : null
}

function fnOf(node: MathNode): Fn2 {
  return (x, h) => evalNode(node, { x, h })
}

function close(a: number, b: number, tol = 1e-9): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))
}

/** The x/h sample points (h ≠ 0, x + h ≠ 0, extra rows inside a radical's domain). */
export function dqSamplePoints(seed = DEFAULT_SEED): Pt[] {
  return makeSamples(['h', 'x'], seed).map((s) => ({ x: s.x!, h: s.h! }))
}

/** Same function on the samples: ≥ 6 points where both are defined, all close, ≤ 1 one-sided point. */
function sameFunction(a: Fn2, b: Fn2, pts: readonly Pt[], tol = 1e-9): boolean {
  let both = 0
  let oneSided = 0
  for (const { x, h } of pts) {
    const va = a(x, h)
    const vb = b(x, h)
    if (va === 'undef' && vb === 'undef') continue
    if (va === 'undef' || vb === 'undef') {
      oneSided++
      continue
    }
    both++
    if (!close(va, vb, tol)) return false
  }
  return both >= 6 && oneSided <= 1
}

/** Friendly probe points, integers first, h never 0. */
const NICE_POINTS: readonly Pt[] = [
  { x: 1, h: 1 },
  { x: 1, h: 2 },
  { x: 2, h: 1 },
  { x: 2, h: 2 },
  { x: 3, h: 1 },
  { x: 1, h: 3 },
  { x: 2, h: 3 },
  { x: 3, h: 2 },
  { x: 4, h: 1 },
  { x: 4, h: 5 },
  { x: 0, h: 1 },
  { x: -1, h: 2 },
  { x: -2, h: 1 },
  { x: 1, h: -2 },
  { x: 5, h: 4 },
  { x: 9, h: 7 },
  { x: 0.5, h: 0.5 },
]

/** Integers and simple fractions read well in a sentence; 0.414 does not. */
function niceValue(v: Val): boolean {
  return v !== 'undef' && nicenessRank(v) <= 1
}

/**
 * The first friendly point where every function is defined and `differ` holds, preferring a point
 * where every value is an integer or a simple fraction (sqrt: x = 4, h = 5 gives 1/5, not 0.414).
 */
function nicePoint(fns: readonly Fn2[], differ: (vals: number[]) => boolean): { pt: Pt; vals: number[] } | null {
  let fallback: { pt: Pt; vals: number[] } | null = null
  for (const pt of NICE_POINTS) {
    const vals = fns.map((f) => f(pt.x, pt.h))
    if (vals.some((v) => v === 'undef')) continue
    const nums = vals as number[]
    if (!differ(nums)) continue
    if (nums.every(niceValue)) return { pt, vals: nums }
    fallback ??= { pt, vals: nums }
  }
  return fallback
}

const differs = (v: number[]) => !close(v[0]!, v[1]!, 1e-6)

function at(pt: Pt): string {
  return `x = ${prettyNumber(pt.x)}, h = ${prettyNumber(pt.h)}`
}

function num(v: number): string {
  return prettyNumber(v)
}

/** Pretty text for display in a sentence: unicode minus, spaced. */
function pretty(text: string): string {
  return text.replace(/-/g, '−')
}

// ---------------------------------------------------------------------------
// Polynomial structure (for the expansion and partial-cancel mistakes)
// ---------------------------------------------------------------------------

const FIT_POINTS = [0.25, 1.1, 1.9, 2.6, 3.7]
const CHECK_POINTS = [-1.3, 4.9, 0.6, -3.4]

/** Coefficients p0..pd of f when f is a polynomial of degree ≤ 4 (checked off the fit points), else null. */
export function polynomialCoefficients(f: string): number[] | null {
  const node = nodeOf(f)
  if (!node) return null
  const fx = (x: number) => evalNode(node, { x, h: 0 })
  const ys = FIT_POINTS.map(fx)
  if (ys.some((y) => y === 'undef')) return null
  // Solve the 5×5 Vandermonde system by Gaussian elimination with partial pivoting.
  const n = FIT_POINTS.length
  const m = FIT_POINTS.map((t, i) => [...Array.from({ length: n }, (_, k) => t ** k), ys[i] as number])
  for (let c = 0; c < n; c++) {
    let piv = c
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r
    ;[m[c], m[piv]] = [m[piv]!, m[c]!]
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const k = m[r]![c]! / m[c]![c]!
      for (let j = c; j <= n; j++) m[r]![j]! -= k * m[c]![j]!
    }
  }
  let p = m.map((row, i) => row[n]! / row[i]!)
  p = p.map((v) => (Math.abs(v - Math.round(v)) < 1e-7 ? Math.round(v) : v)).map((v) => (Math.abs(v) < 1e-9 ? 0 : v))
  const polyAt = (x: number) => p.reduce((s, c, k) => s + c * x ** k, 0)
  for (const t of CHECK_POINTS) {
    const y = fx(t)
    if (y === 'undef' || !close(y, polyAt(t), 1e-7)) return null
  }
  while (p.length > 1 && p[p.length - 1] === 0) p.pop()
  return p
}

function binom(n: number, k: number): number {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/** One monomial c·x^i·h^j of the expanded numerator. */
interface Mono {
  c: number
  i: number
  j: number
}

/** Monomials of f(x + h) − f(x) for a polynomial f (every one has j ≥ 1). */
function numeratorMonomials(p: readonly number[]): Mono[] {
  const out: Mono[] = []
  for (let k = p.length - 1; k >= 1; k--) {
    for (let j = 1; j <= k; j++) {
      const c = p[k]! * binom(k, j)
      if (c !== 0) out.push({ c, i: k - j, j })
    }
  }
  // Reading order: highest total degree first, then more x (6xh + 3h^2 + 2h).
  out.sort((a, b) => b.i + b.j - (a.i + a.j) || b.i - a.i)
  return out
}

function monoValue(m: Mono, x: number, h: number): number {
  return m.c * x ** m.i * h ** m.j
}

function powText(v: string, e: number): string {
  return e === 0 ? '' : e === 1 ? v : `${v}^${e}`
}

/** "6xh", "3h^2", "-h", "2" */
function monoText(c: number, i: number, j: number): string {
  const vars = `${powText('x', i)}${powText('h', j)}`
  const abs = Math.abs(c)
  const coef = vars && abs === 1 ? '' : Number.isInteger(abs) ? String(abs) : `(${niceNumber(abs)})`
  return `${c < 0 ? '-' : ''}${coef}${vars || (coef ? '' : '1')}`
}

function sumText(terms: readonly string[]): string {
  if (!terms.length) return '0'
  return terms.reduce((acc, t, idx) => (idx === 0 ? t : t.startsWith('-') ? `${acc} - ${t.slice(1)}` : `${acc} + ${t}`), '')
}

/** Nonempty proper subsets of {0..n−1} as bit masks (n ≤ 5). */
function properSubsets(n: number): number[] {
  const out: number[] = []
  for (let mask = 1; mask < (1 << n) - 1; mask++) out.push(mask)
  return out
}

// ---------------------------------------------------------------------------
// Candidates: what each named mistake would produce for this f
// ---------------------------------------------------------------------------

interface Candidate {
  id: ErrorPatternId
  fn: Fn2
  /** One or two sentences about HER numbers. */
  witness: string
  /** Looser tolerance for numerically differentiated candidates. */
  tol?: number
  /** Only for lines without h (the h → 0 limit). */
  noH?: boolean
}

interface Model {
  f: string
  fNode: MathNode
  F: (x: number) => Val
  /** Correct f(x + h). */
  fxh: Fn2
  dq: Fn2
  poly: number[] | null
}

function modelOf(spec: DqSpec): Model | null {
  const fNode = nodeOf(spec.f)
  if (!fNode) return null
  const F = (x: number) => evalNode(fNode, { x, h: 0 })
  const fxh: Fn2 = (x, h) => F(x + h)
  const dq: Fn2 = (x, h) => {
    const a = F(x + h)
    const b = F(x)
    return a === 'undef' || b === 'undef' || h === 0 ? 'undef' : (a - b) / h
  }
  return { f: normalizeGlyphs(spec.f.trim()), fNode, F, fxh, dq, poly: polynomialCoefficients(spec.f) }
}

/** Positions of the x tokens in f. */
function xPositions(f: string): number[] {
  return [...f.matchAll(X_TOKEN)].map((m) => m.index ?? 0)
}

/** f with the x tokens at the chosen positions replaced by (x + h). */
function substituteSome(f: string, positions: readonly number[], chosen: (k: number) => boolean): string {
  let out = ''
  let last = 0
  positions.forEach((pos, k) => {
    out += f.slice(last, pos) + (chosen(k) ? '(x + h)' : 'x')
    last = pos + 1
  })
  return out + f.slice(last)
}

/** Mistaken versions of f(x + h), each as a function of (x, h), with the id and witness text. */
function fxhSlips(model: Model): Candidate[] {
  const out: Candidate[] = []
  const { f, F } = model
  const correct = model.fxh
  const describe = (wrongText: string, wrong: Fn2): string => {
    const p = nicePoint([correct, wrong], differs)
    if (!p) return `Your line matches ${pretty(wrongText)}.`
    return `At ${at(p.pt)}: f(x + h) = f(${num(p.pt.x + p.pt.h)}) = ${num(p.vals[0]!)}, but ${pretty(wrongText)} gives ${num(p.vals[1]!)}.`
  }

  // f(x) + h
  const plusH: Fn2 = (x, h) => {
    const v = F(x)
    return v === 'undef' ? v : v + h
  }
  out.push({ id: 'dq_fx_plus_h', fn: plusH, witness: `Your line is f(x) + h = ${pretty(f)} + h. ${describe(`${f} + h`, plusH)}` })

  // f(x) + f(h)
  const fh = substituteX(f, 'h')
  const plusFh: Fn2 = (x, h) => {
    const a = F(x)
    const b = F(h)
    return a === 'undef' || b === 'undef' ? 'undef' : a + b
  }
  out.push({ id: 'dq_fx_plus_fh', fn: plusFh, witness: `Your line is f(x) + f(h) = (${pretty(f)}) + (${pretty(fh)}). ${describe(`f(x) + f(h)`, plusFh)}` })

  // Some x's replaced, others not (including none of them: f(x) itself).
  const pos = xPositions(f)
  if (pos.length >= 1 && pos.length <= 4) {
    const masks = [0, ...properSubsets(pos.length)]
    for (const mask of masks) {
      const text = substituteSome(f, pos, (k) => ((mask >> k) & 1) === 1)
      const node = nodeOf(text)
      if (!node) continue
      const fn = fnOf(node)
      const lead = mask === 0 ? 'Your line is still f(x): none of the x’s became (x + h).' : `Your line is ${pretty(text)}: some x’s became (x + h) and some did not.`
      out.push({ id: 'dq_partial_sub', fn, witness: `${lead} ${describe(text, fn)}` })
    }
  }

  // Polynomial f: expansion slips.
  const p = model.poly
  if (p && p.length >= 2) {
    // (x + h)^k → x^k + h^k for every power k ≥ 2.
    if (p.length >= 3) {
      const wrong: Fn2 = (x, h) => p.reduce((s, c, k) => s + (k >= 2 ? c * (x ** k + h ** k) : k === 1 ? c * (x + h) : c), 0)
      const k = p.length - 1
      const right = sumText(Array.from({ length: k + 1 }, (_, j) => monoText(binom(k, j), k - j, j)))
      out.push({
        id: 'power_over_sum',
        fn: wrong,
        witness: `(x + h)^${k} is not x^${k} + h^${k}: multiply it out, (x + h)^${k} = ${pretty(right)}. ${describe(`the x^${k} + h^${k} version`, wrong)}`,
      })
    }
    // The coefficient of (x + h)^k reached only some pieces of its expansion.
    for (let k = 1; k < p.length; k++) {
      const a = p[k]!
      if (a === 0 || a === 1) continue
      const pieces = Array.from({ length: k + 1 }, (_, j) => ({ j, c: binom(k, j) }))
      for (const mask of properSubsets(pieces.length)) {
        const missed = pieces.filter((_, idx) => ((mask >> idx) & 1) === 1)
        const variants: { coef: number; id: ErrorPatternId }[] = [{ coef: 1, id: a < 0 ? 'negative_not_distributed' : 'partial_distribute' }]
        if (a < 0 && a !== -1) variants.push({ coef: -a, id: 'negative_not_distributed' })
        for (const v of variants) {
          const wrong: Fn2 = (x, h) => {
            const base = correct(x, h)
            if (base === 'undef') return base
            return missed.reduce((s, pc) => s + (v.coef - a) * pc.c * x ** (k - pc.j) * h ** pc.j, base)
          }
          const factor = a === -1 ? '−' : num(a)
          const who = a === -1 ? 'The minus' : `The ${a < 0 ? 'negative ' : ''}${num(a)}`
          const inside = sumText(pieces.map((pc) => monoText(pc.c, k - pc.j, pc.j)))
          const shouldBe = sumText(pieces.map((pc) => monoText(a * pc.c, k - pc.j, pc.j)))
          const what = k === 1 ? `${factor}(x + h)` : `${factor}(x + h)^${k}`
          const lesson = `${who} multiplies every piece: ${pretty(what)} = ${factor}(${pretty(inside)}) = ${pretty(shouldBe)}.`
          out.push({ id: v.id, fn: wrong, witness: `${lesson} ${describe('your expansion', wrong)}` })
        }
      }
    }
  }
  // Where two readings produce the same line (f = x^2: f(x) + f(h) IS x^2 + h^2), the more telling
  // lesson wins: (x + h)^2 ≠ x^2 + h^2 before "a function doesn't split over +". Stable sort.
  return out.sort((a, b) => (FXH_RANK[a.id] ?? 9) - (FXH_RANK[b.id] ?? 9))
}

const FXH_RANK: Partial<Record<ErrorPatternId, number>> = {
  dq_fx_plus_h: 0,
  power_over_sum: 1,
  dq_fx_plus_fh: 2,
  dq_partial_sub: 3,
  partial_distribute: 4,
  negative_not_distributed: 4,
}

/** Mistakes on the difference-quotient lines (stage 2), most specific first. */
function dqSlips(model: Model, spec: DqSpec): Candidate[] {
  const out: Candidate[] = []
  const { F, dq } = model

  // h set to 0 at the end: her line equals the limit as h → 0 (the derivative), not the DQ.
  const answerNode = spec.answer ? nodeOf(spec.answer.replace(H_TOKEN, '(0)')) : null
  const limit: Fn2 = answerNode
    ? (x) => evalNode(answerNode, { x, h: 0 })
    : (x) => {
        const e = 1e-3
        const v = [F(x + e), F(x - e), F(x + 2 * e), F(x - 2 * e)]
        if (v.some((t) => t === 'undef')) return 'undef'
        const [a, b, c, d] = v as number[]
        return (8 * (a! - b!) - (c! - d!)) / (12 * e)
      }
  {
    const p = nicePoint([dq, limit], differs)
    const w = p
      ? `At ${at(p.pt)} the difference quotient is ${num(p.vals[0]!)}, but your line gives ${num(p.vals[1]!)}: it is what the quotient approaches as h → 0.`
      : 'Your line is what the quotient approaches as h → 0.'
    out.push({ id: 'dq_set_h_zero', fn: limit, witness: w, tol: answerNode ? 1e-9 : 1e-6, noH: true })
  }

  // Forgot to divide by h: her line equals the numerator f(x + h) − f(x).
  const numer: Fn2 = (x, h) => {
    const a = F(x + h)
    const b = F(x)
    return a === 'undef' || b === 'undef' ? 'undef' : a - b
  }
  {
    const monos = model.poly ? numeratorMonomials(model.poly) : null
    const numText = monos ? ` = ${pretty(sumText(monos.map((m) => monoText(m.c, m.i, m.j))))}` : ''
    const p = nicePoint([dq, numer], differs)
    const w = p
      ? `Your line is the numerator f(x + h) − f(x)${numText}, not yet divided by h. At ${at(p.pt)} it gives ${num(p.vals[1]!)}; divided by h = ${num(p.pt.h)} that is ${num(p.vals[0]!)}.`
      : `Your line is the numerator f(x + h) − f(x)${numText}, not yet divided by h.`
    out.push({ id: 'dq_forgot_divide', fn: numer, witness: w })
  }

  // h cancelled from only some terms of the expanded numerator.
  if (model.poly) {
    const monos = numeratorMonomials(model.poly)
    if (monos.length >= 2 && monos.length <= 5) {
      for (const mask of properSubsets(monos.length)) {
        const kept = (idx: number) => ((mask >> idx) & 1) === 1
        const fn: Fn2 = (x, h) => monos.reduce((s, m, idx) => s + monoValue(m, x, h) / (kept(idx) ? 1 : h), 0)
        const each = monos.map((m) => `${pretty(monoText(m.c, m.i, m.j))} → ${pretty(monoText(m.c, m.i, m.j - 1))}`).join(', ')
        const skipped = monos.filter((_, idx) => kept(idx)).map((m) => pretty(monoText(m.c, m.i, m.j)))
        out.push({
          id: 'dq_partial_cancel',
          fn,
          witness: `Dividing by h takes one h from EVERY term: ${each}. Your line kept ${skipped.join(' and ')} whole.`,
        })
      }
    }
  }

  // The minus in front of f(x) reached only some of its terms (the parentheses were dropped).
  const terms = additiveTermsOf(model.fNode)
  if (terms.length >= 2 && terms.length <= 5) {
    const negated = terms.map((t) => appText(negTerm(t)))
    const rightText = sumText(negated)
    const fTerms = terms.map((t) => fnOf(t))
    for (let mask = 1; mask < 1 << (terms.length - 1); mask++) {
      // bit k of mask ↔ term k + 1 kept its sign (the first term always gets the minus).
      const keptIdx = terms.map((_, i) => i).filter((i) => i > 0 && ((mask >> (i - 1)) & 1) === 1)
      const fn: Fn2 = (x, h) => {
        const base = dq(x, h)
        if (base === 'undef') return base
        let extra = 0
        for (const i of keptIdx) {
          const v = fTerms[i]!(x, h)
          if (v === 'undef') return 'undef'
          extra += 2 * v
        }
        return base + extra / h
      }
      const wrongText = sumText(terms.map((t, i) => (keptIdx.includes(i) ? appText(t) : negated[i]!)))
      out.push({
        id: 'negative_not_distributed',
        fn,
        witness: `The minus in front of f(x) changes the sign of EVERY term: −(${pretty(model.f)}) = ${pretty(rightText)}, not ${pretty(wrongText)}.`,
      })
    }
  }

  // Expansion slips inside the numerator: (wrong f(x + h) − f(x))/h.
  for (const slip of fxhSlips(model)) {
    if (slip.id !== 'power_over_sum' && slip.id !== 'partial_distribute' && slip.id !== 'negative_not_distributed') continue
    const fn: Fn2 = (x, h) => {
      const a = slip.fn(x, h)
      const b = F(x)
      return a === 'undef' || b === 'undef' ? 'undef' : (a - b) / h
    }
    out.push({ id: slip.id, fn, witness: slip.witness.replace(/ At x = .*$/, '') })
  }
  return out
}

/** −t without a double minus: −(−u) → u. */
function negTerm(t: MathNode): MathNode {
  return isUnaryMinus(t) ? nodeArgs(t)[0]! : compileExpression(`-(${t.toString()})`)
}

/** Signed additive terms of a sum node (a − b → [a, −b]). */
function additiveTermsOf(node: MathNode): MathNode[] {
  if (isOp(node, '+') && nodeArgs(node).length === 2) return nodeArgs(node).flatMap(additiveTermsOf)
  if (isOp(node, '-') && nodeArgs(node).length === 2) {
    const [a, b] = nodeArgs(node)
    return [...additiveTermsOf(a!), ...additiveTermsOf(b!).map(negTerm)]
  }
  return [node]
}

/** The first candidate that is her line and is NOT the correct target. */
function firstMatch(cands: readonly Candidate[], her: Fn2, herHasH: boolean, target: Fn2, pts: readonly Pt[]): Candidate | null {
  for (const c of cands) {
    if (c.noH && herHasH) continue
    if (sameFunction(c.fn, target, pts, c.tol)) continue // this slip changes nothing for this f
    if (sameFunction(her, c.fn, pts, c.tol)) return c
  }
  return null
}

// ---------------------------------------------------------------------------
// Public checks
// ---------------------------------------------------------------------------

function parseFailure(message: string, position: number, length?: number): DqLineResult {
  return { ok: false, verdict: 'parse_error', acceptableChips: [], parseError: { message, position, length } }
}

function counterexampleOf(pt: Pt, message: string): Counterexample {
  return { point: { x: pt.x, h: pt.h }, pointDisplay: at(pt), oldTruth: true, newTruth: false, message }
}

/** Named mistakes that fit a wrong f(x + h) line (tests and the sandbox use this too). */
export function fxhMistake(typed: string, spec: DqSpec, seed = DEFAULT_SEED): PatternHit | null {
  const model = modelOf(spec)
  const node = nodeOf(stripFxhLabel(typed))
  if (!model || !node) return null
  const c = firstMatch(fxhSlips(model), fnOf(node), collectVars(node).includes('h'), model.fxh, dqSamplePoints(seed))
  return c ? patternHit(c.id, c.witness) : null
}

/** Named mistakes that fit a wrong difference-quotient line. */
export function dqMistake(typed: string, spec: DqSpec, seed = DEFAULT_SEED): PatternHit | null {
  const model = modelOf(spec)
  const node = nodeOf(typed)
  if (!model || !node) return null
  const c = firstMatch(dqSlips(model, spec), fnOf(node), collectVars(node).includes('h'), model.dq, dqSamplePoints(seed))
  return c ? patternHit(c.id, c.witness) : null
}

/**
 * Stage 1: is `typed` f(x + h)? Unexpanded or expanded, any equivalent form is accepted (no chip:
 * substituting is not a property move). A leading "f(x + h) =" is allowed.
 */
export function checkFxhLine(typed: string, spec: DqSpec, ctx: StepContext): DqLineResult {
  const text = stripFxhLabel(typed)
  if (!text) return parseFailure('Type f(x + h) first.', 0)
  const vars = ctx.vars.length ? ctx.vars : DQ_VARS
  const p = parseExpression(text, vars)
  if (!p.ok) {
    // `text` is `typed` minus trailing spaces and an optional "f(x + h) =" label in front.
    const shift = typed.trimEnd().length - text.length
    return parseFailure(p.error.message, p.error.position + Math.max(0, shift), p.error.length)
  }
  const model = modelOf(spec)
  const target = nodeOf(fOfXPlusH(spec.f))
  const normalized = { text: p.text, latex: '' }
  if (!model || !target) return { ok: false, verdict: 'undecidable', acceptableChips: [], normalized }
  const res = exprEquiv(target, p.node, ['h', 'x'], ctx.seed, { domain: 'strict' })
  if (res.equivalent) return { ok: true, verdict: 'equivalent', acceptableChips: [], normalized }
  if (res.undecidable) return { ok: false, verdict: 'undecidable', acceptableChips: [], normalized }
  const her = fnOf(p.node)
  const result: DqLineResult = { ok: false, verdict: 'not_equivalent', acceptableChips: [], normalized }
  const hit = firstMatch(fxhSlips(model), her, collectVars(p.node).includes('h'), model.fxh, dqSamplePoints(ctx.seed))
  if (hit) result.pattern = patternHit(hit.id, hit.witness)
  const w = witnessPoint(model.fxh, her)
  if (w) {
    const yours = w.b === 'undef' ? 'your line is undefined there' : `your line gives ${num(w.b)}`
    result.counterexample = counterexampleOf(w.pt, `At ${at(w.pt)}: f(x + h) = f(${num(w.pt.x + w.pt.h)}) = ${num(w.a)}, but ${yours}.`)
  }
  return result
}

const SIMPLIFY_XS = [0.7, 1.3, 2.9, 4.1, 6.3, -1.7, -3.3, -5.1, 0.35, 9.4]

/**
 * Finished form: `line` is defined at h = 0 for every sampled x at which the difference quotient
 * itself is defined for small h (at least two such x). Equivalence is checked separately.
 */
export function definedAtHZero(line: string, spec: DqSpec): boolean {
  const model = modelOf(spec)
  const node = nodeOf(line)
  if (!model || !node) return false
  let tested = 0
  for (const x of SIMPLIFY_XS) {
    if (model.dq(x, 1e-3) === 'undef' && model.dq(x, -1e-3) === 'undef') continue
    tested++
    if (evalNode(node, { x, h: 0 }) === 'undef') return false
  }
  return tested >= 2
}

/** Equivalent to the difference quotient (h ≠ 0) and, separately, in finished form. */
export function dqStatus(line: string, spec: DqSpec, seed = DEFAULT_SEED): { equivalent: boolean; simplified: boolean } {
  const node = nodeOf(line)
  const target = nodeOf(differenceQuotient(spec.f))
  if (!node || !target) return { equivalent: false, simplified: false }
  const equivalent = exprEquiv(target, node, ['h', 'x'], seed, { domain: 'strict' }).equivalent
  return { equivalent, simplified: equivalent && definedAtHZero(line, spec) }
}

export const LEFT_TO_DO =
  'Correct, and not finished yet: h is still in a denominator, so at h = 0 this line would divide by zero. Keep simplifying until the h underneath cancels.'

/**
 * Stage 2: `typed` must be a legal rewrite of `prev` (the chip comes from the rewrite classifier)
 * and equivalent to the difference quotient. A rejection names the mistake when a candidate fits,
 * else falls back to the generic matchers and a counterexample at a friendly point.
 */
export function checkDqLine(prev: string, typed: string, spec: DqSpec, ctx: StepContext): DqLineResult {
  const text = typed.trim()
  if (!text) return parseFailure('Type the next line first.', 0)
  const vars = ctx.vars.length ? ctx.vars : DQ_VARS
  const rewrite = verifyRewrite(prev, text, { ...ctx, vars: [...vars] })
  if (rewrite.verdict === 'parse_error') return rewrite
  const status = dqStatus(text, spec, ctx.seed)
  if (rewrite.ok || status.equivalent) {
    const accepted: DqLineResult = rewrite.ok ? { ...rewrite } : { ...rewrite, ok: true, verdict: 'equivalent', acceptableChips: [] }
    delete accepted.pattern
    delete accepted.counterexample
    accepted.simplified = status.simplified
    if (!status.simplified) accepted.leftToDo = LEFT_TO_DO
    return accepted
  }
  const model = modelOf(spec)
  const her = nodeOf(text)
  const before = nodeOf(prev)
  const result: DqLineResult = { ...rewrite, ok: false, verdict: rewrite.verdict === 'undecidable' ? 'undecidable' : 'not_equivalent' }
  if (!model || !her || !before) return result
  const herFn = fnOf(her)
  const hit = firstMatch(dqSlips(model, spec), herFn, collectVars(her).includes('h'), model.dq, dqSamplePoints(ctx.seed))
  if (hit) result.pattern = patternHit(hit.id, hit.witness)
  const w = witnessPoint(fnOf(before), herFn)
  if (w) {
    const yours = w.b === 'undef' ? 'yours is undefined there' : `yours gives ${num(w.b)}`
    result.counterexample = counterexampleOf(w.pt, `At ${at(w.pt)} the line before gives ${num(w.a)}, but ${yours}.`)
  }
  return result
}

/** The first friendly point where `a` is defined and `b` is undefined or different. */
function witnessPoint(a: Fn2, b: Fn2): { pt: Pt; a: number; b: Val } | null {
  let differing: { pt: Pt; a: number; b: Val } | null = null
  let undefinedThere: { pt: Pt; a: number; b: Val } | null = null
  for (const pt of NICE_POINTS) {
    const va = a(pt.x, pt.h)
    if (va === 'undef') continue
    const vb = b(pt.x, pt.h)
    if (vb === 'undef') {
      undefinedThere ??= { pt, a: va, b: vb }
      continue
    }
    if (close(va, vb, 1e-6)) continue
    if (niceValue(va) && niceValue(vb)) return { pt, a: va, b: vb }
    differing ??= { pt, a: va, b: vb }
  }
  return differing ?? undefinedThere
}
