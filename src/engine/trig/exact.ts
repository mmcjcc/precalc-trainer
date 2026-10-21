/**
 * Exact values of the trig core: c·√m·πᵏ with c rational, m a square-free whole number (1 for none) and k a whole
 * number. That covers every value of the six functions at a multiple of 30° or 45° (√3/2, −2√3/3), the ratios of a
 * point with whole coordinates (3√13/13), radian measures (5π/6), arc lengths (16π/3) and the values slips give
 * (27000/π, π²/216). Two values are equal exactly when their normal forms are the same.
 */
import { Q0, Q1, gcd, q, qAdd, qCmp, qDiv, qEq, qMul, qNeg, qNum, type Q } from './rational'

export interface TrigExact {
  /** The rational coefficient. */
  c: Q
  /** Square-free radicand, 1 for no radical. */
  root: number
  /** The power of π. */
  pi: number
}

export const EXACT_ZERO: TrigExact = { c: Q0, root: 1, pi: 0 }
export const EXACT_ONE: TrigExact = { c: Q1, root: 1, pi: 0 }

/** c·√root·π^pi in normal form: square factors pulled out of the radical, zero as 0. */
export function tx(c: Q, root = 1, pi = 0): TrigExact {
  if (!Number.isInteger(root) || root < 1) throw new Error(`radicand must be a positive whole number, got ${root}`)
  if (c.n === 0) return EXACT_ZERO
  let m = root
  let out = 1
  for (let f = 2; f * f <= m; f += f === 2 ? 1 : 2) {
    while (m % (f * f) === 0) {
      m /= f * f
      out *= f
    }
  }
  return { c: out === 1 ? c : qMul(c, q(out)), root: m, pi }
}

/** A whole number or fraction as an exact value. */
export function exactQ(c: Q): TrigExact {
  return tx(c)
}

export function exactInt(n: number): TrigExact {
  return tx(q(n))
}

/** c·π, a radian measure. */
export function exactPi(c: Q): TrigExact {
  return tx(c, 1, 1)
}

export function isZero(a: TrigExact): boolean {
  return a.c.n === 0
}

export function exactEq(a: TrigExact, b: TrigExact): boolean {
  return qEq(a.c, b.c) && a.root === b.root && a.pi === b.pi
}

export function exactNeg(a: TrigExact): TrigExact {
  return isZero(a) ? a : { ...a, c: qNeg(a.c) }
}

export function exactMul(a: TrigExact, b: TrigExact): TrigExact {
  if (isZero(a) || isZero(b)) return EXACT_ZERO
  return tx(qMul(a.c, b.c), a.root * b.root, a.pi + b.pi)
}

/** 1/(c√m·πᵏ) = √m/(c·m)·π⁻ᵏ. */
export function exactInv(a: TrigExact): TrigExact {
  if (isZero(a)) throw new Error('division by zero')
  return tx(qDiv(Q1, qMul(a.c, q(a.root))), a.root, -a.pi)
}

export function exactDiv(a: TrigExact, b: TrigExact): TrigExact {
  return exactMul(a, exactInv(b))
}

/** a + b when they are like terms (same radical, same power of π), else null. */
export function exactAdd(a: TrigExact, b: TrigExact): TrigExact | null {
  if (isZero(a)) return b
  if (isZero(b)) return a
  if (a.root !== b.root || a.pi !== b.pi) return null
  return tx(qAdd(a.c, b.c), a.root, a.pi)
}

export function exactPow(a: TrigExact, k: number): TrigExact {
  if (!Number.isInteger(k)) throw new Error('whole powers only')
  if (k === 0) return EXACT_ONE
  const base = k < 0 ? exactInv(a) : a
  let out = EXACT_ONE
  for (let i = 0; i < Math.abs(k); i++) out = exactMul(out, base)
  return out
}

/** √a for a rational a ≥ 0 times an even power of π; null otherwise (a fourth root, a negative). */
export function exactSqrt(a: TrigExact): TrigExact | null {
  if (isZero(a)) return EXACT_ZERO
  if (a.root !== 1 || a.pi % 2 !== 0 || a.c.n < 0) return null
  // √(n/d) = √(n·d)/d
  return tx(q(1, a.c.d), a.c.n * a.c.d, a.pi / 2)
}

export function exactNum(a: TrigExact): number {
  return qNum(a.c) * Math.sqrt(a.root) * Math.PI ** a.pi
}

/** −1, 0 or 1. */
export function exactSign(a: TrigExact): number {
  return Math.sign(a.c.n)
}

export function exactAbs(a: TrigExact): TrigExact {
  return a.c.n < 0 ? exactNeg(a) : a
}

/** Compare two values by size (exact when they are like terms, numeric otherwise). */
export function exactCmp(a: TrigExact, b: TrigExact): number {
  if (a.root === b.root && a.pi === b.pi) return qCmp(a.c, b.c)
  const d = exactNum(a) - exactNum(b)
  return d === 0 ? 0 : d < 0 ? -1 : 1
}

/** The rational value, when there is no radical and no π. */
export function exactRational(a: TrigExact): Q | null {
  return a.root === 1 && a.pi === 0 ? a.c : null
}

type Style = 'typed' | 'ascii' | 'say'

function piPart(k: number, style: Style): string {
  const pi = style === 'ascii' ? 'pi' : 'π'
  if (k === 1) return pi
  if (style === 'say') return `${pi}${k === 2 ? '²' : k === 3 ? '³' : `^${k}`}`
  return `${pi}^${k}`
}

function rootPart(m: number, style: Style): string {
  return style === 'ascii' ? `sqrt(${m})` : `√${m}`
}

function render(a: TrigExact, style: Style): string {
  if (isZero(a)) return '0'
  const minus = a.c.n < 0 ? (style === 'say' ? '−' : '-') : ''
  const num = Math.abs(a.c.n)
  const den = a.c.d
  const top: string[] = []
  if (num !== 1 || (a.root === 1 && a.pi <= 0)) top.push(String(num))
  if (a.root > 1) top.push(rootPart(a.root, style))
  if (a.pi > 0) top.push(piPart(a.pi, style))
  const bottom: string[] = []
  if (den !== 1) bottom.push(String(den))
  if (a.pi < 0) bottom.push(piPart(-a.pi, style))
  const numer = top.join('')
  if (!bottom.length) return `${minus}${numer}`
  const denom = bottom.length > 1 ? `(${bottom.join('')})` : bottom[0]!
  return `${minus}${numer}/${denom}`
}

/** As she would type it, with the glyphs: "√3/2", "-2√3/3", "5π/6", "π^2/216", "27000/π". */
export function exactText(a: TrigExact): string {
  return render(a, 'typed')
}

/** As she would type it on a keyboard: "sqrt(3)/2", "5pi/6". */
export function exactAscii(a: TrigExact): string {
  return render(a, 'ascii')
}

/** For a sentence: the minus sign and π²: "−√3/2", "π²/216". */
export function exactSay(a: TrigExact): string {
  return render(a, 'say')
}

/** KaTeX: "\frac{\sqrt{3}}{2}", "-\frac{5\pi}{6}", "2\sqrt{3}". */
export function exactTex(a: TrigExact): string {
  if (isZero(a)) return '0'
  const minus = a.c.n < 0 ? '-' : ''
  const num = Math.abs(a.c.n)
  const den = a.c.d
  const pi = (k: number) => (k === 1 ? '\\pi' : `\\pi^{${k}}`)
  let top = ''
  if (num !== 1 || (a.root === 1 && a.pi <= 0)) top += String(num)
  if (a.root > 1) top += `\\sqrt{${a.root}}`
  if (a.pi > 0) top += pi(a.pi)
  let bottom = ''
  if (den !== 1) bottom += String(den)
  if (a.pi < 0) bottom += pi(-a.pi)
  return bottom ? `${minus}\\frac{${top}}{${bottom}}` : `${minus}${top}`
}

/** Lowest common multiple, for the generators. */
export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b)
}
