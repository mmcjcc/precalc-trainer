/**
 * The functions of this module: f(x) = a·b^(x − h) + k and g(x) = a·log_b(x − h) + k, with b > 0, b ≠ 1, a ≠ 0.
 * Written three ways from the same numbers: app syntax (the parser reads it), KaTeX (the statement), and
 * reading text (sentences). The exact features (domain, range, asymptote, intercept, direction) come from the
 * parameters, never from sampling.
 */
import type { GraphSpec } from '@/shared/types'
import { frac, ipow } from '../explog/text'
import { say } from '../explog/parts'

export type Family = 'exponential' | 'logarithmic'

/** b = p/q (whole p, q), or e. */
export interface Base {
  /** App syntax: "2", "1/2", "3/2", "e", "10". */
  text: string
  value: number
  p: number
  q: number
  e: boolean
}

export interface Curve {
  family: Family
  a: number
  base: Base
  h: number
  k: number
}

export function baseOf(text: string): Base {
  if (text === 'e') return { text, value: Math.E, p: 0, q: 1, e: true }
  const m = /^(\d+)(?:\/(\d+))?$/.exec(text)
  if (!m) throw new Error(`base ${text}`)
  const p = Number(m[1])
  const q = m[2] ? Number(m[2]) : 1
  return { text, value: p / q, p, q, e: false }
}

/** The base above 1 and the base below 1 are each other's reciprocal. */
export function flipBase(b: Base): Base {
  if (b.e) throw new Error('e has no fraction flip here')
  return baseOf(b.p === 1 ? String(b.q) : b.q === 1 ? `1/${b.p}` : `${b.q}/${b.p}`)
}

/** "x - 3", "x + 2", "x". */
export function inside(h: number): string {
  return h === 0 ? 'x' : h > 0 ? `x - ${h}` : `x + ${-h}`
}

/** " + 3", " - 2", "". */
export function plus(k: number): string {
  return k === 0 ? '' : k > 0 ? ` + ${k}` : ` - ${-k}`
}

/** Name of the log with this base, app syntax: log, ln, log_2, log_(1/2). */
export function logName(b: Base): string {
  if (b.e) return 'ln'
  if (b.text === '10') return 'log'
  return b.q === 1 ? `log_${b.p}` : `log_(${b.text})`
}

/** The power b^u in app syntax (u already parenthesized when it needs it). */
function powerText(b: Base, exponent: string): string {
  const e = exponent === 'x' || /^-?\d+$/.test(exponent) ? exponent : `(${exponent})`
  if (b.e) return `e^${e}`
  return b.q === 1 ? `${b.p}^${e}` : `(${b.text})^${e}`
}

/** a·b^(x − h) + k or a·log_b(x − h) + k, app syntax. */
export function curveText(c: Curve): string {
  if (c.family === 'exponential') {
    const power = powerText(c.base, inside(c.h))
    const lead = c.a === 1 ? power : c.a === -1 ? `-${power}` : c.base.e ? `${c.a}${power}` : `${c.a} * ${power}`
    return `${lead}${plus(c.k)}`
  }
  const log = `${logName(c.base)}(${inside(c.h)})`
  const lead = c.a === 1 ? log : c.a === -1 ? `-${log}` : `${c.a}${log}`
  return `${lead}${plus(c.k)}`
}

/** Reading text: "2·3^(x − 1) − 4", "−log₂(x + 3) + 1". */
export function curveSay(c: Curve): string {
  return say(curveText(c))
}

function texInside(h: number): string {
  return h === 0 ? 'x' : h > 0 ? `x-${h}` : `x+${-h}`
}

function texPlus(k: number): string {
  return k === 0 ? '' : k > 0 ? `+${k}` : `-${-k}`
}

function texBase(b: Base): string {
  if (b.e) return 'e'
  return b.q === 1 ? String(b.p) : `\\left(\\frac{${b.p}}{${b.q}}\\right)`
}

function texLog(b: Base): string {
  if (b.e) return '\\ln'
  if (b.text === '10') return '\\log'
  return b.q === 1 ? `\\log_{${b.p}}` : `\\log_{${b.p}/${b.q}}`
}

/** KaTeX of "f(x) = …" (the dot between a whole a and a whole base, so 2·3^x never reads as 23^x). */
export function curveTex(c: Curve, name: string): string {
  let body: string
  if (c.family === 'exponential') {
    const power = `${texBase(c.base)}^{${texInside(c.h)}}`
    const dot = !c.base.e && c.base.q === 1 ? '\\cdot ' : ''
    body = c.a === 1 ? power : c.a === -1 ? `-${power}` : `${c.a}${dot}${power}`
  } else {
    const log = `${texLog(c.base)}\\left(${texInside(c.h)}\\right)`
    body = c.a === 1 ? log : c.a === -1 ? `-${log}` : `${c.a}${log}`
  }
  return `${name}(x) = ${body}${texPlus(c.k)}`
}

/** f(x) as a number (NaN outside the domain). */
export function valueAt(c: Curve, x: number): number {
  if (c.family === 'exponential') return c.a * c.base.value ** (x - c.h) + c.k
  const u = x - c.h
  if (!(u > 0)) return Number.NaN
  return (c.a * Math.log(u)) / Math.log(c.base.value) + c.k
}

/** Rises from left to right: a > 0 with b > 1, or a < 0 with 0 < b < 1. */
export function increasing(c: Curve): boolean {
  return c.a > 0 === c.base.value > 1
}

// ---------------------------------------------------------------------------
// Exact numbers: b^m and the intercepts
// ---------------------------------------------------------------------------

/** b^m for a whole m, as a fraction [n, d] (rational bases only). */
export function powerFraction(b: Base, m: number): [number, number] {
  if (b.e) throw new Error('e is not rational')
  return m >= 0 ? [ipow(b.p, m), ipow(b.q, m)] : [ipow(b.q, -m), ipow(b.p, -m)]
}

/** c·e^m + d in app syntax: "2e^(-1) + 3", "-e^2 + 4", "e + 3". */
function ePowerText(c: number, m: number, d: number): string {
  const power = m === 1 ? 'e' : `e^${m < 0 ? `(${m})` : m}`
  const lead = c === 1 ? power : c === -1 ? `-${power}` : `${c}${power}`
  return `${lead}${plus(d)}`
}

/** The y-coordinate a·b^(−h) + k of an exponential's y-intercept: exact text and value. */
export function yIntercept(c: Curve): { text: string; value: number; rational: boolean } {
  if (c.base.e) {
    if (c.h === 0) return { text: String(c.a + c.k), value: c.a + c.k, rational: true }
    return { text: ePowerText(c.a, -c.h, c.k), value: c.a * Math.E ** -c.h + c.k, rational: false }
  }
  const [n, d] = powerFraction(c.base, -c.h)
  return { text: frac(c.a * n + c.k * d, d), value: (c.a * n) / d + c.k, rational: true }
}

/** The exponent m = −k/a at a log's x-intercept (a whole number for every generated log). */
export function interceptExponent(c: Curve): number {
  return -c.k / c.a
}

/** The x-coordinate h + b^m of a log's x-intercept: exact text and value. */
export function xIntercept(c: Curve): { text: string; value: number; rational: boolean } {
  const m = interceptExponent(c)
  if (c.base.e) {
    if (m === 0) return { text: String(c.h + 1), value: c.h + 1, rational: true }
    return { text: ePowerText(1, m, c.h), value: Math.E ** m + c.h, rational: false }
  }
  const [n, d] = powerFraction(c.base, m)
  return { text: frac(c.h * d + n, d), value: n / d + c.h, rational: true }
}

/** The intercept of the part this module asks for: (0, f(0)) or (x, 0). */
export function interceptPoint(c: Curve): { text: string; x: number; y: number } {
  if (c.family === 'exponential') {
    const y = yIntercept(c)
    return { text: `(0, ${y.text})`, x: 0, y: y.value }
  }
  const x = xIntercept(c)
  return { text: `(${x.text}, 0)`, x: x.value, y: 0 }
}

/** Interval text of the domain and the range, app syntax. */
export function domainText(c: Curve): string {
  return c.family === 'exponential' ? '(-inf, inf)' : `(${c.h}, inf)`
}

export function rangeText(c: Curve): string {
  if (c.family === 'logarithmic') return '(-inf, inf)'
  return c.a > 0 ? `(${c.k}, inf)` : `(-inf, ${c.k})`
}

export function asymptoteText(c: Curve): string {
  return c.family === 'exponential' ? `y = ${c.k}` : `x = ${c.h}`
}

// ---------------------------------------------------------------------------
// Graphs
// ---------------------------------------------------------------------------

/** A square window that shows the asymptote and, when it fits, the intercept. */
export function windowFor(c: Curve, point?: { x: number; y: number }): number {
  let half = Math.max(6, Math.abs(c.h) + 3, Math.abs(c.k) + 3)
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const far = Math.max(Math.abs(point.x), Math.abs(point.y)) + 1
    if (far <= 14) half = Math.max(half, Math.ceil(far))
  }
  return half
}

/** The graph of the curve with its asymptote dashed, and a dot at the intercept when one is given. */
export function curveGraph(c: Curve, opts: { half: number; dot?: { x: number; y: number }; ariaLabel?: string; finv?: string }): GraphSpec {
  const spec: GraphSpec = {
    kind: 'function',
    f: curveText(c),
    xDomain: [-opts.half, opts.half],
    guides: [c.family === 'exponential' ? { expr: String(c.k), label: `y = ${c.k}` } : { x: c.h, label: `x = ${c.h}` }],
  }
  if (c.family === 'logarithmic') spec.fBreaks = [c.h]
  if (opts.dot && Math.abs(opts.dot.x) <= opts.half && Math.abs(opts.dot.y) <= opts.half) spec.dots = [{ x: opts.dot.x, y: opts.dot.y, closed: true }]
  if (opts.ariaLabel) spec.ariaLabel = opts.ariaLabel
  if (opts.finv) {
    spec.finv = opts.finv
    spec.showIdentity = true
  }
  return spec
}
