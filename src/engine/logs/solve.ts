/**
 * Exponential and log equations as whole problems: the solutions, the algebraic equation a textbook
 * solves on the way, the extraneous candidates it lets in, and the grading of her final answer.
 *
 *  - Solutions are the points where the ORIGINAL equation holds (wide grid, wide.ts), so they are always
 *    inside its domain. Each is given exactly when possible: a rational number verified by exact
 *    substitution, a quadratic surd, or the closed form of the exponential families
 *      A·b^(kx + m) + C = D     x = (log_b((D − C)/A) − m)/k
 *      A·b^(k₁x + m₁) = B·c^(k₂x + m₂)   (logs of both sides, then a linear equation)
 *  - Log equations: every side is condensed to one log per base and the equation is rewritten without
 *    logs (log_b P = C → P = b^C; log_b P = log_b Q → P = Q). The solutions of that algebraic equation
 *    are the candidates; the ones outside the original's domain are the extraneous ones (with the log
 *    input that fails).
 *  - Her answer: "x = 5", "5", "x = 5 or x = -2", "5, -2", "{5}", "no solution". Exact unless the problem
 *    asks for a decimal. Named mistakes: an extraneous candidate kept (log_extraneous_kept), a valid
 *    negative solution thrown out (log_valid_rejected), or exactly the solutions one of the equation's
 *    slips leads to (relslips.ts), e.g. log x + log(x − 3) = 1 answered 13/2 (log_sum_split).
 */
import type { Rational, VarName } from '@/shared/types'
import { rat, ratDiv, ratNeg, ratToNumber, ratToString } from '@/notation/rational'
import { collectVars, compileExpression, evalNode, nearlyEqual, substituteVars, tryConst, type MathNode } from '../math'
import { patternHit } from '../matchers/catalog'
import { makeStatement, parseExpression, parseStatement, singleRelation } from '../parse'
import { exactEval, surdAdd, surdOf, surdScale, surdSqrt, surdToNumber, surdToText, Unsupported } from '../functions/exact'
import { polyDeg, rationalRoots, ratFnOf, type Poly } from '../functions/poly'
import type { Relation } from '../types'
import { domain1D, samplesInDomain } from './equiv'
import { exactEquals, exactIsRational, tryExact } from './exact'
import { relationSlips } from './relslips'
import { slipWitness } from './rewrite'
import { asExpPower, asLogCall, expPowersOf, logCallsOf, productFactors, sameBase, signedTerms, src, type LogCall } from './slips'
import { decimalTolerance, extraneousNote } from './step'
import { appText, display, displayNode, fixed, joinAnd, joinOr, num, numText } from './text'
import type { DecimalSpec, ExtraneousNote, LogGrade, LogMistakeCandidate, LogMistakeId } from './types'
import { inDomain, sidesOf, solutionsWide, type Interval } from './wide'

export interface LogSolution {
  value: number
  /** App syntax: "5", "1 + sqrt(2)", "log(7)/log(2)"; a 3-decimal number when no exact form is known. */
  text: string
  /** `text` is exact. */
  exact: boolean
}

export interface LogEquation {
  /** The equation as parsed (app syntax). */
  equation: string
  variable: string
  kind: 'exponential' | 'logarithmic' | 'other'
  /** Ascending. */
  solutions: LogSolution[]
  /** The equation without logs that a textbook solves (log equations), app syntax, or null. */
  algebraic: string | null
  /** The algebraic equation's solutions: the real ones and the extraneous ones. */
  candidates: LogSolution[]
  extraneous: ExtraneousNote[]
  /** The original's domain: open intervals. */
  domain: Interval[]
  /** "x > 3", "x < 0 or x > 3", "every real x". */
  domainText: string
  /** The worked solution (display text). */
  explanation: string[]
}

// ---------------------------------------------------------------------------
// Exact forms of numbers
// ---------------------------------------------------------------------------

function snapRational(v: number): Rational | null {
  for (let d = 1; d <= 1000; d++) {
    const n = Math.round(v * d)
    if (Number.isSafeInteger(n) && Math.abs(n / d - v) <= 1e-12 * Math.max(1, Math.abs(v))) return rat(n, d)
  }
  return null
}

/** The original holds EXACTLY at the rational r (exact substitution in the exact model). */
function holdsExactly(rel: Relation, v: string, r: Rational): boolean {
  const map = { [v]: `(${ratToString(r)})` }
  const l = tryExact(substituteVars(rel.lhs, map))
  const rr = tryExact(substituteVars(rel.rhs, map))
  if (!l || !rr || l === 'undef' || rr === 'undef') return false
  return exactEquals(l, rr)
}

/** Exact roots of a polynomial up to degree 2 after its rational roots (surds for the quadratic rest). */
function polyRootsExact(p: Poly): { value: number; text: string }[] | null {
  try {
    const rr = rationalRoots(p)
    const out: { value: number; text: string }[] = rr.roots.map((r) => ({ value: ratToNumber(r), text: ratToString(r) }))
    const rest = rr.rest
    const d = polyDeg(rest)
    if (d >= 3) return null
    if (d === 2) {
      const [c, b, a] = rest as [Rational, Rational, Rational]
      // (−b ± √(b² − 4ac)) / (2a)
      const disc = exactEval(compileExpression(`(${ratToString(b)})^2 - 4 * (${ratToString(a)}) * (${ratToString(c)})`), null)
      if (disc === 'undef') return null
      if (surdToNumber(disc) >= 0) {
        const root = surdSqrt(disc)
        if (root === 'undef') return null
        const twoA = ratDiv(rat(1), rat(2 * a.n, a.d))
        for (const sign of [-1, 1]) {
          const s = surdScale(surdAdd(surdOf(ratNeg(b)), surdScale(root, rat(sign))), twoA)
          out.push({ value: surdToNumber(s), text: surdToText(s) })
        }
      }
    }
    return out.sort((x, y) => x.value - y.value)
  } catch (e) {
    if (e instanceof Unsupported || e instanceof RangeError) return null
    throw e
  }
}

function exactTextOfNumber(rel: Relation, v: string, t: number): LogSolution {
  const r = snapRational(t)
  if (r && holdsExactly(rel, v, r)) return { value: t, text: ratToString(r), exact: true }
  return { value: t, text: numText(t), exact: false }
}

// ---------------------------------------------------------------------------
// Exponential families
// ---------------------------------------------------------------------------

interface Linear {
  k: number
  m: number
}

/** u = k·v + m (checked at four points), else null. */
function linearIn(u: MathNode, v: string): Linear | null {
  const at = (t: number) => evalNode(u, { [v]: t })
  const u0 = at(0)
  const u1 = at(1)
  const u2 = at(2)
  const u5 = at(-5)
  if (u0 === 'undef' || u1 === 'undef' || u2 === 'undef' || u5 === 'undef') return null
  const k = u1 - u0
  if (Math.abs(k) < 1e-12) return null
  if (!nearlyEqual(u2, u0 + 2 * k, Math.max(1, Math.abs(u2))) || !nearlyEqual(u5, u0 - 5 * k, Math.max(1, Math.abs(u5)))) return null
  return { k, m: u0 }
}

interface ExpTerm {
  coef: MathNode
  base: string
  baseValue: number
  viaE: boolean
  exponent: MathNode
  lin: Linear
}

/** A·b^u with A constant and u linear in v. */
function expTerm(node: MathNode, v: string): ExpTerm | null {
  const fs = productFactors(node)
  const powers = fs.filter((f) => collectVars(f).includes(v))
  if (powers.length !== 1) return null
  const p = asExpPower(powers[0]!)
  if (!p) return null
  const lin = linearIn(p.exponent, v)
  if (!lin) return null
  const rest = fs.filter((f) => f !== powers[0])
  const coef = rest.length ? compileExpression(rest.map(src).join(' * ')) : compileExpression('1')
  if (collectVars(coef).length) return null
  return { coef, base: p.viaExp ? 'e' : p.baseText, baseValue: p.baseValue, viaE: p.viaExp || Math.abs(p.baseValue - Math.E) < 1e-12, exponent: p.exponent, lin }
}

/** A number for exact text: an integer, a short decimal as written (0.3, 1.05), else a fraction (4/3). */
function cText(v: number): string {
  if (Number.isInteger(v)) return String(v)
  for (let j = 1; j <= 6; j++) {
    const s = v * 10 ** j
    if (Math.abs(s - Math.round(s)) <= 1e-9 * Math.max(1, Math.abs(s))) return String(Number(v.toFixed(j)))
  }
  const r = snapRational(v)
  return r ? ratToString(r) : String(Number(v.toPrecision(15)))
}

/** "log(q)/log(b)" with the base written the calculator way (ln for e, log for 10). */
function logRatioText(q: string, base: string, viaE: boolean, baseValue: number): string {
  if (viaE) return `ln(${q})`
  if (Math.abs(baseValue - 10) < 1e-12) return `log(${q})`
  return `log(${q})/log(${base.replace(/^\((.*)\)$/, '$1')})`
}

interface ClosedForm {
  node: MathNode
  text: string
  explanation: string[]
}

/** A·b^(kx + m) + C = D. */
function solveSingleExp(rel: Relation, v: string): ClosedForm | 'none' | null {
  for (const [s, o] of [
    [rel.lhs, rel.rhs],
    [rel.rhs, rel.lhs],
  ] as const) {
    if (collectVars(o).length) continue
    const terms = signedTerms(s)
    const varying = terms.filter((t) => collectVars(t.node).includes(v))
    if (varying.length !== 1) continue
    const et = expTerm(varying[0]!.node, v)
    if (!et) continue
    const consts = terms.filter((t) => t !== varying[0])
    const A = (tryConst(et.coef) ?? Number.NaN) * varying[0]!.sign
    const C = consts.reduce((acc, t) => acc + t.sign * (tryConst(t.node) ?? Number.NaN), 0)
    const D = tryConst(o)
    if (!Number.isFinite(A) || !Number.isFinite(C) || D == null || A === 0) continue
    const q = (D - C) / A
    if (!(q > 0)) return 'none'
    const qText = cText(q)
    const { k, m } = et.lin
    const lr = logRatioText(qText, et.base, et.viaE, et.baseValue)
    const core = Math.abs(m) < 1e-15 ? lr : `${lr} ${m > 0 ? '-' : '+'} ${cText(Math.abs(m))}`
    // Divide by an integer k; multiply by 1/k when THAT is the integer (x/5730 in the exponent).
    const inv = 1 / k
    const invInt = !Number.isInteger(k) && Math.abs(inv - Math.round(inv)) <= 1e-9 * Math.max(1, Math.abs(inv))
    const text =
      Math.abs(k - 1) < 1e-15
        ? core
        : invInt
          ? Math.abs(m) < 1e-15
            ? `${cText(Math.round(inv))}${lr}`
            : `${cText(Math.round(inv))}(${core})`
          : Math.abs(m) < 1e-15 && !lr.includes('/')
            ? `${lr}/${cText(k)}`
            : `(${core})/${cText(k)}`
    const parsed = parseExpression(text, [v as VarName])
    if (!parsed.ok) return null
    const baseShown = et.viaE ? 'e' : et.base.replace(/^\((.*)\)$/, '$1')
    const powText = `${baseShown}^(${appText(et.exponent)})`
    const takeLog = et.viaE
      ? `Take ln of both sides (ln undoes e^): ${display(appText(et.exponent))} = ln(${display(qText)}).`
      : `Take the log of both sides and bring the exponent down: (${display(appText(et.exponent))}) · log(${display(baseShown)}) = log(${display(qText)}).`
    const explanation = [
      ...(Math.abs(A - 1) < 1e-15 && Math.abs(C) < 1e-15 ? [] : [`Get the power by itself: ${display(powText)} = ${display(qText)}.`]),
      takeLog,
      `Solve for ${v}: ${v} = ${display(text)}.`,
    ]
    return { node: parsed.node, text, explanation }
  }
  return null
}

interface Term {
  c: number
  /** "ln(2)", or "1" for a constant term. */
  a: string
}

/** Like terms merged, zeros dropped, positive terms first. */
function tidy(ts: readonly Term[]): Term[] {
  const merged: Term[] = []
  for (const t of ts) {
    if (!t.a || Math.abs(t.c) < 1e-15) continue
    const same = merged.find((m) => m.a === t.a)
    if (same) same.c += t.c
    else merged.push({ ...t })
  }
  const kept = merged.filter((t) => Math.abs(t.c) > 1e-15)
  return [...kept.filter((t) => t.c > 0), ...kept.filter((t) => t.c < 0)]
}

/** "ln(2) - 3ln(5) + 1/2" (app syntax); "0" for nothing. */
function linearText(ts: readonly Term[]): string {
  if (!ts.length) return '0'
  return ts
    .map((t, i) => {
      const mag = Math.abs(t.c)
      const coef = t.a === '1' ? cText(mag) : Math.abs(mag - 1) < 1e-15 ? '' : cText(mag).includes('/') ? `(${cText(mag)})` : cText(mag)
      const body = t.a === '1' ? coef : `${coef}${t.a}`
      const sign = t.c < 0 ? (i === 0 ? '-' : ' - ') : i === 0 ? '' : ' + '
      return `${sign}${body}`
    })
    .join('')
}

function wrapSum(t: string): string {
  return /\s[+-]\s/.test(t) ? `(${t})` : t
}

/** A·b^(k₁x + m₁) = B·c^(k₂x + m₂): ln both sides, then a linear equation. */
function solveTwoExp(rel: Relation, v: string): ClosedForm | null {
  const a = expTerm(rel.lhs, v)
  const b = expTerm(rel.rhs, v)
  if (!a || !b) return null
  const A = tryConst(a.coef)
  const B = tryConst(b.coef)
  if (A == null || B == null || !(A > 0) || !(B > 0)) return null
  const lb1 = Math.log(a.baseValue)
  const lb2 = Math.log(b.baseValue)
  const denValue = a.lin.k * lb1 - b.lin.k * lb2
  if (Math.abs(denValue) < 1e-12) return null
  const lnOf = (base: string, viaE: boolean) => (viaE ? '1' : `ln(${base.replace(/^\((.*)\)$/, '$1')})`)
  // x · (k₁ ln b₁ − k₂ ln b₂) = ln B − ln A + m₂ ln b₂ − m₁ ln b₁
  const num: Term[] = [
    { c: 1, a: Math.abs(B - 1) > 1e-15 ? `ln(${cText(B)})` : '' },
    { c: -1, a: Math.abs(A - 1) > 1e-15 ? `ln(${cText(A)})` : '' },
    { c: b.lin.m, a: lnOf(b.base, b.viaE) },
    { c: -a.lin.m, a: lnOf(a.base, a.viaE) },
  ]
  const den: Term[] = [
    { c: a.lin.k, a: lnOf(a.base, a.viaE) },
    { c: -b.lin.k, a: lnOf(b.base, b.viaE) },
  ]
  // Lead with a plus sign on top: −ln 2 / (ln 2 − ln 3) reads better as ln 2 / (ln 3 − ln 2).
  const firstNum = tidy(num)
  const flip = firstNum.length > 0 && firstNum.every((t) => t.c < 0)
  const n0 = tidy(flip ? num.map((t) => ({ c: -t.c, a: t.a })) : num)
  const d0 = tidy(flip ? den.map((t) => ({ c: -t.c, a: t.a })) : den)
  const top = linearText(n0)
  const bottom = linearText(d0)
  const constantBottom = d0.length === 1 && d0[0]!.a === '1'
  const raw = constantBottom
    ? Math.abs(d0[0]!.c - 1) < 1e-15
      ? top
      : `${wrapSum(top)}/${d0[0]!.c < 0 ? `(${bottom})` : bottom}`
    : d0.length === 1 && Math.abs(d0[0]!.c - 1) < 1e-15
      ? `${wrapSum(top)}/${bottom}`
      : `${wrapSum(top)}/(${bottom})`
  const parsed = parseExpression(raw, [v as VarName])
  if (!parsed.ok) return null
  const node = parsed.node
  const text = raw
  const explanation = [
    `Take ln of both sides: ${display(`ln(${appText(rel.lhs)}) = ln(${appText(rel.rhs)})`)}.`,
    'Bring the exponents down (power rule) and collect the terms with the variable on one side.',
    `Solve for ${v}: ${v} = ${display(text)}.`,
  ]
  return { node, text, explanation }
}

/**
 * A quadratic in one exponential: c₂u² + c₁u + c₀ = 0 with u = b^(kx), written with b^(2kx) and b^(kx)
 * (e^(2x) − 5e^x + 6 = 0). Each root u > 0 gives x = log_b(u)/k; a root u ≤ 0 gives nothing (a power of a
 * positive base is never 0 or negative).
 */
function solveExpQuadratic(
  rel: Relation,
  v: string,
): { solutions: LogSolution[]; explanation: string[]; uText: string; uRoots: { value: number; text: string }[] } | null {
  const terms = [...signedTerms(rel.lhs), ...signedTerms(rel.rhs).map((t) => ({ sign: (t.sign === 1 ? -1 : 1) as 1 | -1, node: t.node }))]
  type Base = { text: string; value: number; viaE: boolean }
  const parts: { coef: number; k: number; b: Base | null }[] = []
  for (const t of terms) {
    if (!collectVars(t.node).includes(v)) {
      const c = tryConst(t.node)
      if (c == null) return null
      parts.push({ coef: t.sign * c, k: 0, b: null })
      continue
    }
    const et = expTerm(t.node, v)
    if (!et || Math.abs(et.lin.m) > 1e-15) return null
    const c = tryConst(et.coef)
    if (c == null) return null
    parts.push({ coef: t.sign * c, k: et.lin.k, b: { text: et.viaE ? 'e' : et.base.replace(/^\((.*)\)$/, '$1'), value: et.baseValue, viaE: et.viaE } })
  }
  // One base for u: the smallest. Another base must be a whole power of it (4^x = (2^x)^2, 27^x = (3^x)^3).
  const used = parts.flatMap((p) => (p.b ? [p.b] : []))
  if (!used.length) return null
  const base = used.reduce((m, b) => (b.value < m.value ? b : m))
  const rewritten: string[] = []
  for (const p of parts) {
    if (!p.b || Math.abs(p.b.value - base.value) <= 1e-12 * base.value) continue
    if (p.b.viaE || base.viaE || !(base.value > 1)) return null
    const m = Math.log(p.b.value) / Math.log(base.value)
    const mr = Math.round(m)
    if (mr < 2 || Math.abs(m - mr) > 1e-9) return null
    p.k *= mr
    const line = `Write ${display(`${p.b.text}^${v}`)} as (${display(`${base.text}^${v}`)})^${mr}.`
    if (!rewritten.includes(line)) rewritten.push(line)
  }
  const ks = parts.filter((p) => p.k !== 0).map((p) => p.k)
  const k0 = Math.min(...ks.map(Math.abs)) * Math.sign(ks[0]!)
  const coeffs = [0, 0, 0]
  for (const p of parts) {
    const deg = p.k === 0 ? 0 : p.k / k0
    if (!Number.isInteger(Math.round(deg)) || Math.abs(deg - Math.round(deg)) > 1e-12 || deg < 0 || deg > 2) return null
    coeffs[Math.round(deg)]! += p.coef
  }
  if (Math.abs(coeffs[2]!) < 1e-15) return null
  const rs = coeffs.map((c) => snapRational(c))
  if (rs.some((r) => !r)) return null
  const roots = polyRootsExact(rs as Rational[])
  if (!roots) return null
  const uText = `${base.viaE ? 'e' : base.text}^${Math.abs(k0 - 1) < 1e-15 ? v : `(${cText(k0)}${v})`}`
  const quad = `${linearText([
    { c: coeffs[2]!, a: 'u^2' },
    { c: coeffs[1]!, a: 'u' },
    { c: coeffs[0]!, a: '1' },
  ].filter((t) => Math.abs(t.c) > 1e-15))} = 0`
  const explanation = [...rewritten, `Let u = ${display(uText)}: ${display(quad)}.`, `Solve for u: ${joinOr(roots.map((r) => `u = ${display(r.text)}`))}.`]
  const solutions: LogSolution[] = []
  for (const r of roots) {
    if (!(r.value > 0)) {
      explanation.push(`${display(uText)} = ${display(r.text)} has no solution: a power of ${display(base.text)} is never 0 or negative.`)
      continue
    }
    const inner = r.text
    const lg = base.viaE ? `ln(${inner})` : Math.abs(base.value - 10) < 1e-12 ? `log(${inner})` : `log(${inner})/log(${base.text})`
    const text = Math.abs(k0 - 1) < 1e-15 ? lg : `${/\//.test(lg) ? `(${lg})` : lg}/${cText(k0)}`
    const p = parseExpression(text, [v as VarName])
    if (!p.ok) return null
    const val = evalNode(p.node, {})
    if (val === 'undef') return null
    const rr = snapRational(val)
    const ex = tryExact(p.node)
    const rational = ex && ex !== 'undef' ? exactIsRational(ex) : false
    solutions.push({ value: rational && rr ? ratToNumber(rr) : val, text: rational && rr ? ratToString(rr) : text, exact: true })
    explanation.push(`${display(uText)} = ${display(inner)} gives ${v} = ${display(rational && rr ? ratToString(rr) : text)}.`)
  }
  return { solutions: solutions.sort((a, b) => a.value - b.value), explanation, uText, uRoots: roots.map((r) => ({ value: r.value, text: r.text })) }
}

// ---------------------------------------------------------------------------
// Log equations: the algebraic form
// ---------------------------------------------------------------------------

interface LogSide {
  base: LogCall
  /** ∏ argᵢ^cᵢ (num) and the denominators. */
  num: string[]
  den: string[]
  /** Constant terms (moved to the other side). */
  constant: number
  /** The side has ONE log term k·log_b(arg): divide by k instead of raising arg to the k (no fake candidates). */
  single: { arg: MathNode; k: number } | null
}

function logSide(side: MathNode, v: string): LogSide | null {
  let base: LogCall | null = null
  const num: string[] = []
  const den: string[] = []
  let constant = 0
  const singles: { arg: MathNode; k: number }[] = []
  for (const t of signedTerms(side)) {
    const fs = productFactors(t.node)
    const logs = fs.filter((f) => asLogCall(f) && collectVars(f).includes(v))
    if (!logs.length) {
      if (collectVars(t.node).includes(v)) return null
      const c = tryConst(t.node)
      if (c == null) return null
      constant += t.sign * c
      continue
    }
    if (logs.length !== 1) return null
    const call = asLogCall(logs[0]!)!
    if (base && !sameBase(base, call)) return null
    base ??= call
    const others = fs.filter((f) => f !== logs[0])
    if (others.some((f) => collectVars(f).length)) return null
    const k = others.reduce((acc, f) => acc * (tryConst(f) ?? Number.NaN), 1) * t.sign
    if (!Number.isFinite(k) || Math.abs(k) < 1e-12) return null
    const kr = snapRational(Math.abs(k))
    if (!kr) return null
    const piece = kr.n === 1 && kr.d === 1 ? src(call.arg) : `${src(call.arg)} ^ (${ratToString(kr)})`
    ;(k > 0 ? num : den).push(piece)
    singles.push({ arg: call.arg, k })
  }
  return base ? { base, num, den, constant, single: singles.length === 1 ? singles[0]! : null } : null
}

function product(ps: string[]): string {
  return ps.length ? ps.join(' * ') : '1'
}

function baseValueText(call: LogCall): string {
  return call.kind === 'ln' ? 'e' : call.kind === 'log10' ? '10' : src(call.base!)
}

/** b^c as text, worked out when it is a simple rational (10^1 → 10, 2^3 → 8, 4^(1/2) → 2). */
function powerText(call: LogCall, c: number): string {
  if (call.baseValue != null && call.kind !== 'ln') {
    const v = call.baseValue ** c
    const r = snapRational(v)
    if (r && Math.abs(v) < 1e12) return ratToString(r)
  }
  return `${baseValueText(call)} ^ (${cText(c)})`
}

/** The equation without logs, or null when the equation is not one-base logs of the variable. */
function algebraicFormOf(rel: Relation, v: string): Relation | null {
  if (rel.op !== '=') return null
  const L = logSide(rel.lhs, v)
  const R = logSide(rel.rhs, v)
  const mk = (l: string, r: string): Relation | null => {
    try {
      const ln = compileExpression(l)
      const rn = compileExpression(r)
      return { lhs: ln, rhs: rn, op: '=', lhsSrc: appText(ln), rhsSrc: appText(rn) }
    } catch {
      return null
    }
  }
  const one = (S: LogSide, other: MathNode, flip: boolean): Relation | null => {
    if (collectVars(other).length) return null
    // log_b P = log_b(c): one-to-one, P = c (not b raised to the decimal value of log_b c).
    const oc = asLogCall(other)
    const lhs = product(S.num)
    if (oc && sameBase(oc, S.base) && Math.abs(S.constant) < 1e-15) {
      const rhs = S.den.length ? `${src(oc.arg)} * ${product(S.den)}` : oc.arg.toString()
      return flip ? mk(rhs, lhs) : mk(lhs, rhs)
    }
    const C = tryConst(other)
    if (C == null) return null
    if (S.single) {
      // k·log_b(A) = C → A = b^(C/k): 5 + 2 ln x = 4 gives x = e^(−1/2), with no x = −e^(−1/2) to throw away.
      const power = powerText(S.base, (C - S.constant) / S.single.k)
      return flip ? mk(power, S.single.arg.toString()) : mk(S.single.arg.toString(), power)
    }
    const power = powerText(S.base, C - S.constant)
    const rhs = S.den.length ? `${power} * ${product(S.den)}` : power
    return flip ? mk(rhs, lhs) : mk(lhs, rhs)
  }
  if (L && !R) return one(L, rel.rhs, false)
  if (R && !L) return one(R, rel.lhs, true)
  if (L && R && sameBase(L.base, R.base)) {
    const k = R.constant - L.constant
    const lhs = product([...L.num, ...R.den])
    const rhsCore = product([...R.num, ...L.den])
    const rhs = Math.abs(k) < 1e-15 ? rhsCore : `${powerText(L.base, k)} * ${rhsCore}`
    return mk(lhs, rhs)
  }
  return null
}

/** Exact solutions of an algebraic relation (a rational equation), else the numeric ones. */
function algebraicSolutions(rel: Relation, v: string): LogSolution[] {
  const stmt = makeStatement([[rel]])
  const numeric = solutionsWide(stmt, v)
  try {
    const f = ratFnOf(compileExpression(`(${rel.lhs.toString()}) - (${rel.rhs.toString()})`), v)
    if (f && polyDeg(f.num) >= 1 && polyDeg(f.num) <= 4) {
      const exact = polyRootsExact(f.num)
      if (exact) {
        const keep = exact.filter((r) => Math.abs(f.den.reduce((s, c, i) => s + ratToNumber(c) * r.value ** i, 0)) > 1e-12)
        if (keep.length === numeric.length && keep.every((r, i) => Math.abs(r.value - numeric[i]!) <= 1e-7 * Math.max(1, Math.abs(r.value)))) {
          return keep.map((r) => ({ value: r.value, text: r.text, exact: true }))
        }
      }
    }
  } catch (e) {
    if (!(e instanceof Unsupported) && !(e instanceof RangeError)) throw e
  }
  return numeric.map((t) => exactTextOfNumber(rel, v, t))
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function domainText(d: Interval[], v: string): string {
  if (d.length === 1 && d[0]!.lo === Number.NEGATIVE_INFINITY && d[0]!.hi === Number.POSITIVE_INFINITY) return `every real ${v}`
  const parts = d.map((iv) => {
    const lo = Number.isFinite(iv.lo) ? num(iv.lo) : null
    const hi = Number.isFinite(iv.hi) ? num(iv.hi) : null
    if (lo !== null && hi !== null) return `${lo} < ${v} < ${hi}`
    if (lo !== null) return `${v} > ${lo}`
    if (hi !== null) return `${v} < ${hi}`
    return `every real ${v}`
  })
  return d.length ? joinOr(parts) : `no real ${v}`
}

const ANALYSIS_CACHE = new Map<string, LogEquation | null>()

/** Solutions, algebraic form, extraneous candidates and the worked solution of a one-variable equation. */
export function analyzeLogEquation(equation: string, vars: readonly VarName[] = ['x']): LogEquation | null {
  const key = `${vars.join(',')}|${equation}`
  if (ANALYSIS_CACHE.has(key)) return ANALYSIS_CACHE.get(key)!
  const out = analyzeUncached(equation, vars)
  if (ANALYSIS_CACHE.size > 256) ANALYSIS_CACHE.clear()
  ANALYSIS_CACHE.set(key, out)
  return out
}

function analyzeUncached(equation: string, vars: readonly VarName[]): LogEquation | null {
  const p = parseStatement(equation, vars)
  if (!p.ok) return null
  const rel = singleRelation(p.statement)
  if (!rel || rel.op !== '=' || p.statement.vars.length !== 1) return null
  const v = p.statement.vars[0]!
  const stmt = p.statement
  const D = domain1D(sidesOf(stmt), v)
  const logs = [...logCallsOf(rel.lhs), ...logCallsOf(rel.rhs)].filter((c) => collectVars(c.node).includes(v))
  const exps = [...expPowersOf(rel.lhs), ...expPowersOf(rel.rhs)].filter((e) => collectVars(e.exponent).includes(v))
  const kind: LogEquation['kind'] = logs.length && !exps.length ? 'logarithmic' : exps.length && !logs.length ? 'exponential' : 'other'
  const numeric = solutionsWide(stmt, v)
  let solutions: LogSolution[] = numeric.map((t) => exactTextOfNumber(rel, v, t))
  const explanation: string[] = []
  let algebraic: string | null = null
  let candidates: LogSolution[] = []
  let extraneous: ExtraneousNote[] = []
  if (kind === 'exponential') {
    const single = solveSingleExp(rel, v)
    const closed = single === 'none' ? null : (single ?? solveTwoExp(rel, v))
    if (single === 'none') explanation.push(`The power is positive for every ${v}, but it would have to equal a number that is 0 or negative: no solution.`)
    const quadratic = !closed && single !== 'none' ? solveExpQuadratic(rel, v) : null
    if (quadratic && quadratic.solutions.length === numeric.length && quadratic.solutions.every((s, i) => Math.abs(s.value - numeric[i]!) <= 1e-7 * Math.max(1, Math.abs(s.value)))) {
      solutions = quadratic.solutions
      explanation.push(...quadratic.explanation)
    }
    if (closed && numeric.length === 1) {
      const cv = evalNode(closed.node, {})
      if (cv !== 'undef' && Math.abs(cv - numeric[0]!) <= 1e-7 * Math.max(1, Math.abs(cv))) {
        const ex = tryExact(closed.node)
        const r = snapRational(cv)
        const rational = ex && ex !== 'undef' ? exactIsRational(ex) : !!r
        solutions = [{ value: cv, text: rational && r ? ratToString(r) : closed.text, exact: true }]
        explanation.push(...closed.explanation)
        if (!rational) explanation.push(`${v} ≈ ${fixed(cv, 4)}.`)
      }
    }
  }
  if (kind === 'logarithmic') {
    explanation.push(`Domain: every log needs a positive input, so ${domainText(D.intervals, v)}.`)
    const alg = algebraicFormOf(rel, v)
    if (alg) {
      algebraic = `${alg.lhsSrc} = ${alg.rhsSrc}`
      candidates = algebraicSolutions(alg, v)
      const isSolution = (t: number) => numeric.some((s) => Math.abs(s - t) <= 1e-7 * Math.max(1, Math.abs(s)))
      extraneous = candidates.filter((c) => !isSolution(c.value)).map((c) => ({ ...extraneousNote(stmt, v, c.value), text: c.text }))
      const exactByValue = (t: number) => candidates.find((c) => Math.abs(c.value - t) <= 1e-7 * Math.max(1, Math.abs(t)))
      solutions = solutions.map((s) => {
        const c = exactByValue(s.value)
        return c && c.exact ? { value: s.value, text: c.text, exact: true } : s
      })
      explanation.push(`Combine the logs and rewrite without them: ${display(algebraic)}.`)
      if (candidates.length) explanation.push(`Solve: ${joinOr(candidates.map((c) => `${v} = ${display(c.text)}`))}.`)
      for (const e of extraneous) explanation.push(`${e.sentence} So ${v} = ${display(e.text)} is extraneous.`)
    }
  }
  if (!explanation.length || (kind !== 'exponential' && kind !== 'logarithmic')) {
    if (!explanation.length) explanation.push(`Solve for ${v}, then check each answer in the original equation.`)
  }
  explanation.push(solutions.length ? `Solution: ${joinOr(solutions.map((s) => `${v} = ${display(s.text)}${s.exact ? '' : ' (approximately)'}`))}.` : 'No solution.')
  return {
    equation: `${rel.lhsSrc} = ${rel.rhsSrc}`,
    variable: v,
    kind,
    solutions,
    algebraic,
    candidates,
    extraneous,
    domain: D.intervals,
    domainText: domainText(D.intervals, v),
    explanation,
  }
}

// ---------------------------------------------------------------------------
// Her answer
// ---------------------------------------------------------------------------

export interface AnswerValue {
  value: number
  text: string
  /** Exactly a terminating decimal or a fraction (no log, e, root). */
  rational: boolean
  /** Decimal places typed, when it is a plain decimal. */
  places: number | null
}

export type SolutionAnswer = { ok: true; values: AnswerValue[]; none: boolean } | { ok: false; message: string; position?: number; length?: number }

const NONE = /^(no\s*solutions?|none|dne|\{\s*\}|∅|empty(\s*set)?)$/i

function valueOf(text: string, v: string): AnswerValue | { error: string; position: number; length?: number } {
  const p = parseExpression(text, [v as VarName])
  if (!p.ok) return { error: p.error.message, position: p.error.position, ...(p.error.length ? { length: p.error.length } : {}) }
  if (collectVars(p.node).length) return { error: `A solution is a number: no ${v} should be left in it.`, position: 0 }
  const val = evalNode(p.node, {})
  if (val === 'undef') return { error: 'That value is undefined as written. Check the input of each log.', position: 0 }
  const ex = tryExact(p.node)
  const rational = ex && ex !== 'undef' ? exactIsRational(ex) && !/(log|ln|e\b|exp|sqrt|cbrt)/.test(p.text) : false
  const m = text.trim().replace(/[−–]/g, '-').match(/^[-+]?\d*\.(\d+)$/)
  return { value: val, text: p.text, rational, places: m ? m[1]!.length : null }
}

/** Splits at top-level commas (log(8, 2) keeps its comma). */
function splitTop(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i))
      start = i + 1
    }
  }
  out.push(text.slice(start))
  return out.map((s) => s.trim()).filter(Boolean)
}

/** "x = 5 or x = -2", "5, -2", "{5}", "x = log(7)/log(2)", "no solution". */
export function parseSolutionAnswer(answer: string, v = 'x'): SolutionAnswer {
  let t = (answer ?? '').trim()
  if (!t) return { ok: false, message: 'Type your answer first.' }
  if (NONE.test(t)) return { ok: true, values: [], none: true }
  const braces = t.match(/^\{(.*)\}$/)
  if (braces) t = braces[1]!.trim()
  // "x = 3, x = -2" and "x = 3 and x = -2" list the solutions the way "or" does.
  const parts = splitTop(t)
  if (parts.length > 1 && parts.every((p) => /=/.test(p))) t = parts.join(' or ')
  t = t.replace(/\s+and\s+/gi, ' or ')
  if (/[=<>]/.test(t)) {
    const p = parseStatement(t, [v as VarName])
    if (!p.ok) return { ok: false, message: p.error.message, position: p.error.position, ...(p.error.length ? { length: p.error.length } : {}) }
    const values: AnswerValue[] = []
    for (const clause of p.statement.disjuncts) {
      if (clause.length !== 1 || clause[0]!.op !== '=') return { ok: false, message: `Write each solution as ${v} = a number, joined with "or".` }
      const r = clause[0]!
      const [sym, other, otherSrc] = r.lhs.toString() === v ? [r.lhs, r.rhs, r.rhsSrc] : [r.rhs, r.lhs, r.lhsSrc]
      if (sym.toString() !== v || collectVars(other).length) return { ok: false, message: `Write each solution as ${v} = a number, joined with "or".` }
      const val = valueOf(otherSrc, v)
      if ('error' in val) return { ok: false, message: val.error }
      values.push(val)
    }
    return { ok: true, values, none: false }
  }
  const values: AnswerValue[] = []
  for (const part of splitTop(t.replace(/\s+or\s+/gi, ','))) {
    const val = valueOf(part, v)
    if ('error' in val) return { ok: false, message: val.error, position: val.position, ...(val.length ? { length: val.length } : {}) }
    values.push(val)
  }
  return { ok: true, values, none: false }
}

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))
}

function dedupeValues(vs: readonly number[]): number[] {
  const out: number[] = []
  for (const x of [...vs].sort((a, b) => a - b)) if (!out.some((y) => near(x, y, 1e-9))) out.push(x)
  return out
}

function sameSet(a: readonly number[], b: readonly number[], tol = 1e-7): boolean {
  const x = dedupeValues(a)
  const y = dedupeValues(b)
  return x.length === y.length && x.every((t, i) => Math.abs(t - y[i]!) <= tol * Math.max(1, Math.abs(y[i]!)))
}

/** What each slip makes her final answer (solution sets), in priority order, without the right one. */
export function logEquationMistakes(equation: string, opts: { vars?: VarName[] } = {}): LogMistakeCandidate[] {
  const a = analyzeLogEquation(equation, opts.vars)
  if (!a) return []
  return slipSets(a, equation, opts.vars).map((c) => ({ id: c.id, text: setText(c.values, a.variable), values: c.values, witness: c.witness, shadows: c.shadows }))
}

interface SlipSet {
  id: LogMistakeId
  values: number[]
  witness: string
  shadows: LogMistakeId[]
}

function setText(values: readonly number[], v: string): string {
  return values.length ? values.map((t) => `${v} = ${numText(t)}`).join(' or ') : 'no solution'
}

function slipSets(a: LogEquation, equation: string, vars?: readonly VarName[]): SlipSet[] {
  const v = a.variable
  const right = a.solutions.map((s) => s.value)
  const out: SlipSet[] = []
  const push = (id: LogMistakeId, values: number[], witness: string) => {
    const vs = dedupeValues(values)
    if (sameSet(vs, right)) return
    // Some of the solutions and nothing else reads as a missing solution, not as this slip (x = 1 alone for
    // 4^x − 3·2^x + 2 = 0 also solves a slipped line), unless the slip IS throwing a valid answer out.
    if (id !== 'log_valid_rejected' && vs.length > 0 && vs.length < right.length && vs.every((t) => right.some((s) => near(t, s, 1e-9)))) return
    // A value a hair from a real solution (5.001 for 5) is a rounding of it, not a slip.
    if (vs.some((t) => right.some((s) => !near(t, s, 1e-9) && near(t, s, 2e-3)))) return
    const twin = out.find((o) => sameSet(o.values, vs))
    if (twin) {
      if (twin.id !== id && !twin.shadows.includes(id)) twin.shadows.push(id)
      return
    }
    out.push({ id, values: vs, witness, shadows: [] })
  }
  if (a.extraneous.length) {
    push('log_extraneous_kept', [...right, ...a.extraneous.map((e) => e.value)], `${a.extraneous.map((e) => e.sentence).join(' ')} Check every answer in the ORIGINAL equation: ${joinAnd(a.extraneous.map((e) => `${v} = ${display(e.text)}`))} is extraneous.`)
  }
  const p = parseStatement(equation, vars ?? ['x'])
  const rel = p.ok ? singleRelation(p.statement) : null
  // Quadratic in an exponential: the values of u reported as the solutions (2^x = 8 written as x = 8).
  const quad = rel && a.kind === 'exponential' ? solveExpQuadratic(rel, v) : null
  if (quad) {
    const sentence = `Those are the values of u = ${display(quad.uText)}, not of ${v}. Each value of u still has to be turned back into ${v}: set ${display(quad.uText)} equal to it and solve for the exponent.`
    const positive = quad.uRoots.filter((r) => r.value > 0).map((r) => r.value)
    if (positive.length) push('log_convert_dropped', positive, sentence)
    if (positive.length < quad.uRoots.length) push('log_convert_dropped', quad.uRoots.map((r) => r.value), sentence)
  }
  // Only a log equation has a domain that could make her throw a negative answer out.
  const negatives = a.kind === 'logarithmic' ? a.solutions.filter((s) => s.value < 0) : []
  if (negatives.length) {
    push(
      'log_valid_rejected',
      right.filter((t) => t >= 0),
      `${negatives.map((s) => `${v} = ${display(s.text)} keeps every log input positive (${inputsAt(equation, v, s.value, vars)}), so it is a real solution.`).join(' ')} Only an answer that makes a log’s input 0 or negative is extraneous.`,
    )
  }
  if (rel) {
    const D = { intervals: a.domain, boundaries: [] as number[] }
    // The slips of the equation itself, then of the line a textbook writes after taking logs
    // (u·log b = log q), where the division slips happen: u = log(q/b), u = log b / log q.
    const lines = [rel, ...(a.kind === 'exponential' ? [expIntermediate(rel, v)].filter((r): r is Relation => r !== null) : [])]
    for (const line of lines) {
      for (const s of relationSlips(line)) {
        if (s.id === 'log_power_abs') continue
        const sol = solutionsWide(s.stmt, v)
        if (!sol.length || sol.length > 6) continue
        const inside = sol.filter((t) => inDomain(D, t))
        // A "slip" whose solutions inside the domain are the right ones is a legal line here
        // (log_b A = 1 → A = b·1 is right when the exponent is 1).
        if (sameSet(inside, right)) continue
        const witness = s.witness ?? (s.slip ? slipWitness(s.slip, [v], samplesInDomain([s.slip.from], [v])) : '')
        push(s.id, sol, witness)
        if (inside.length && inside.length < sol.length) push(s.id, inside, witness)
      }
    }
  }
  return out
}

/** A·b^u + C = D written the way a textbook does after taking logs: u · log(b) = log((D − C)/A). */
function expIntermediate(rel: Relation, v: string): Relation | null {
  for (const [s, o] of [
    [rel.lhs, rel.rhs],
    [rel.rhs, rel.lhs],
  ] as const) {
    if (collectVars(o).length) continue
    const terms = signedTerms(s)
    const varying = terms.filter((t) => collectVars(t.node).includes(v))
    if (varying.length !== 1) continue
    const et = expTerm(varying[0]!.node, v)
    if (!et) continue
    const A = (tryConst(et.coef) ?? Number.NaN) * varying[0]!.sign
    const C = terms.filter((t) => t !== varying[0]).reduce((acc, t) => acc + t.sign * (tryConst(t.node) ?? Number.NaN), 0)
    const D = tryConst(o)
    if (!Number.isFinite(A) || !Number.isFinite(C) || D == null || A === 0) continue
    const q = (D - C) / A
    if (!(q > 0)) return null
    const base = et.viaE ? 'e' : et.base.replace(/^\((.*)\)$/, '$1')
    try {
      const lhs = compileExpression(et.viaE ? `(${et.exponent.toString()}) * ln(e)` : `(${et.exponent.toString()}) * log(${base})`)
      const rhs = compileExpression(et.viaE ? `ln(${cText(q)})` : `log(${cText(q)})`)
      return { lhs, rhs, op: '=', lhsSrc: appText(lhs), rhsSrc: appText(rhs) }
    } catch {
      return null
    }
  }
  return null
}

/** Her answer is written as a quotient of logs (log(2)/log(7)): the change-of-base reading of a swapped answer. */
function writtenAsLogRatio(texts: readonly string[]): boolean {
  return texts.some((t) => /(log|ln)[^/]*\)\s*\/\s*\(?\s*(log|ln)/.test(t))
}

function inputsAt(equation: string, v: string, t: number, vars?: readonly VarName[]): string {
  const p = parseStatement(equation, vars ?? ['x'])
  if (!p.ok) return ''
  const calls = sidesOf(p.statement).flatMap((s) => logCallsOf(s)).filter((c) => collectVars(c.arg).length)
  return calls
    .slice(0, 3)
    .map((c) => {
      const a = evalNode(c.arg, { [v]: t })
      return `${displayNode(c.arg)} is ${a === 'undef' ? 'undefined' : num(a)}`
    })
    .join(', ')
}

/**
 * Grade her final answer to an equation. `decimal`: the problem asks for rounded decimals; otherwise the
 * exact solutions are wanted (a calculator decimal of an irrational solution is 'invalid' / 'not_exact').
 */
export function gradeLogEquation(equation: string, answer: string, opts: { decimal?: DecimalSpec; vars?: VarName[] } = {}): LogGrade {
  const a = analyzeLogEquation(equation, opts.vars)
  if (!a) return { verdict: 'unsupported', message: `${equation} is not a one-variable equation I can solve.` }
  const v = a.variable
  const explanation = a.explanation
  const parsed = parseSolutionAnswer(answer, v)
  if (!parsed.ok) return { verdict: 'invalid', reason: 'unreadable', message: parsed.message, ...(parsed.position !== undefined ? { position: parsed.position } : {}), ...(parsed.length ? { length: parsed.length } : {}) }
  const her = parsed.values
  const right = a.solutions
  const herVals = her.map((h) => h.value)
  const tol = opts.decimal ? decimalTolerance(opts.decimal) : 0
  const matches = (h: AnswerValue, s: LogSolution): boolean => (opts.decimal ? Math.abs(h.value - s.value) <= tol : near(h.value, s.value, 1e-9))

  // Exactly right?
  const allMatched = her.every((h) => right.some((s) => matches(h, s))) && right.every((s) => her.some((h) => matches(h, s)))
  if (allMatched) {
    if (opts.decimal) {
      const exactTyped = her.find((h) => h.places === null && !/^[-+]?\d+$/.test(h.text.trim()))
      if (exactTyped && right.some((s) => !Number.isInteger(s.value))) return { verdict: 'invalid', reason: 'not_in_form', message: 'That is the exact answer. This problem asks for a decimal: work it out on the calculator and round it.' }
    } else {
      const approx = her.find((h) => h.rational && right.some((s) => matches(h, s) && !s.exact && !Number.isInteger(s.value)) )
      const approxExact = her.find((h) => h.rational && right.some((s) => matches(h, s) && s.exact && !isRationalText(s.text)))
      if (approx || approxExact) return notExact(approx ?? approxExact!)
    }
    if (!right.length) return { verdict: 'correct', message: 'Correct: no solution.', explanation }
    const shown = opts.decimal ? joinOr(her.map((h) => `${v} ≈ ${display(h.text)}`)) : joinOr(right.map((s) => `${v} = ${display(s.text)}`))
    return { verdict: 'correct', message: `Correct: ${shown}.`, explanation }
  }

  // A calculator decimal where the exact answer is wanted (right to the places she typed).
  if (!opts.decimal && her.length && her.every((h) => h.places !== null && right.some((s) => Math.abs(h.value - s.value) <= 0.5 * 10 ** -(h.places ?? 0) + 1e-12)) && her.length === right.length) {
    return notExact(her[0]!)
  }
  if (opts.decimal && 'places' in opts.decimal) {
    const places = opts.decimal.places
    const shortRight = her.length === right.length && her.every((h) => h.places !== null && h.places < places && right.some((s) => Math.abs(h.value - s.value) <= 0.5 * 10 ** -(h.places ?? 0) + 1e-12))
    if (shortRight) return { verdict: 'invalid', reason: 'not_rounded', message: `Keep ${places} decimal place${places === 1 ? '' : 's'}: your answer is rounded too far.` }
  }

  // Named slips: the whole answer is what one slip leads to.
  const sets = slipSets(a, equation, opts.vars)
  const slack = opts.decimal ? tol : 1e-7
  const fits = (s: SlipSet) =>
    her.length === s.values.length && her.every((h) => s.values.some((t) => Math.abs(h.value - t) <= slack * Math.max(1, Math.abs(t)) || (h.places !== null && Math.abs(h.value - t) <= 0.5 * 10 ** -h.places + 1e-12)))
  const hit = sets.find(fits)
  if (hit) {
    const ids = [hit.id, ...hit.shadows]
    const ratio = writtenAsLogRatio(her.map((h) => h.text))
    const id: LogMistakeId = ratio && ids.includes('log_convert_swapped') ? 'log_change_base_inverted' : ratio && ids.includes('log_change_base_inverted') ? 'log_change_base_inverted' : hit.id
    const witness =
      id === hit.id
        ? hit.witness
        : `${hit.witness} Written as a quotient of logs, the log of the number goes on top and the log of the base on the bottom.`
    return { verdict: 'mistake', mistake: id, pattern: patternHit(id, witness), witness, explanation }
  }

  // Plain wrong: say what is off without giving the answer.
  const extra = her.filter((h) => !right.some((s) => matches(h, s)))
  if (extra.length) {
    const h = extra[0]!
    const ext = a.extraneous.find((e) => near(h.value, e.value, 1e-7))
    if (ext) return { verdict: 'mistake', mistake: 'log_extraneous_kept', pattern: patternHit('log_extraneous_kept', ext.sentence), witness: ext.sentence, explanation }
    return { verdict: 'wrong', message: `${v} = ${display(h.text)} does not solve ${display(a.equation)}: ${checkSentence(equation, v, h.value, opts.vars)}`, explanation }
  }
  if (parsed.none) return { verdict: 'wrong', message: `This equation has ${right.length === 1 ? 'a solution' : `${right.length} solutions`}: check your algebra, then check each candidate in the original.`, explanation }
  return { verdict: 'wrong', message: `You have ${herVals.length} of the ${right.length} solutions. Look for the one you are missing.`, explanation }
}

function isRationalText(text: string): boolean {
  return /^[-+]?\d+(\/\d+)?$/.test(text.trim())
}

function notExact(h: AnswerValue): LogGrade {
  return {
    verdict: 'invalid',
    reason: 'not_exact',
    message: `${display(h.text)} is a calculator approximation. This problem wants the exact answer: keep it written with logs (or e).`,
  }
}

function checkSentence(equation: string, v: string, t: number, vars?: readonly VarName[]): string {
  const p = parseStatement(equation, vars ?? ['x'])
  const rel = p.ok ? singleRelation(p.statement) : null
  if (!rel) return 'check it in the original.'
  const s = { [v]: t }
  const l = evalNode(rel.lhs, s)
  const r = evalNode(rel.rhs, s)
  if (l === 'undef' || r === 'undef') return extraneousNote(p.ok ? p.statement : makeStatement([[rel]]), v, t).sentence
  return `the left side is ${num(l)} there and the right side is ${num(r)}.`
}
