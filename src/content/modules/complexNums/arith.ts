/**
 * Exact complex numbers for this module: two rationals, plus an optional square-free radical on
 * each part (so 4i sqrt(3) is exact). Nothing here compares floats.
 */
import { pretty } from '@/engine/functions/text'
import {
  rat,
  ratAdd,
  ratDiv,
  ratEquals,
  ratMul,
  ratNeg,
  ratSub,
  ratToString,
  type Rational,
} from '@/notation'

/** A draw that did not pass the generator's filters. Not a bug in the arithmetic. */
export class CxSkip extends Error {}

/**
 * re * sqrt(reRad) + im * sqrt(imRad) * i, with reRad and imRad square-free and 1 when that part is 0.
 * Gaussian rationals are the case reRad = imRad = 1.
 */
export interface Cx {
  re: Rational
  reRad: number
  im: Rational
  imRad: number
}

export function asRat(n: Rational | number): Rational {
  return typeof n === 'number' ? rat(n) : n
}

export function cx(re: Rational | number, im: Rational | number = 0, reRad = 1, imRad = 1): Cx {
  return cxNorm({ re: asRat(re), reRad, im: asRat(im), imRad })
}

export function cxNorm(z: Cx): Cx {
  return {
    re: z.re,
    reRad: z.re.n === 0 ? 1 : z.reRad,
    im: z.im,
    imRad: z.im.n === 0 ? 1 : z.imRad,
  }
}

export function cxEq(a: Cx, b: Cx): boolean {
  const x = cxNorm(a)
  const y = cxNorm(b)
  return ratEquals(x.re, y.re) && x.reRad === y.reRad && ratEquals(x.im, y.im) && x.imRad === y.imRad
}

export function cxIsZero(z: Cx): boolean {
  return z.re.n === 0 && z.im.n === 0
}

export function cxIsReal(z: Cx): boolean {
  return z.im.n === 0
}

export function cxIsGaussian(z: Cx): boolean {
  const n = cxNorm(z)
  return n.reRad === 1 && n.imRad === 1
}

export function cxNeg(z: Cx): Cx {
  return cxNorm({ re: ratNeg(z.re), reRad: z.reRad, im: ratNeg(z.im), imRad: z.imRad })
}

export function cxConj(z: Cx): Cx {
  return cxNorm({ re: z.re, reRad: z.reRad, im: ratNeg(z.im), imRad: z.imRad })
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = x % y
    x = y
    y = t
  }
  return x || 1
}

/** n = coeff² * rad with rad square-free and positive. n must be a positive integer. */
export function splitSquare(n: number): { coeff: number; rad: number } {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`splitSquare needs a positive integer, got ${n}`)
  let coeff = 1
  let rad = n
  for (let p = 2; p * p <= rad; p++) {
    let e = 0
    while (rad % p === 0) {
      rad /= p
      e++
    }
    for (let i = 0; i < Math.floor(e / 2); i++) coeff *= p
    if (e % 2 === 1) rad *= p
  }
  return { coeff, rad }
}

/** √a · √b as c √r with r square-free. */
function surdMul(c1: Rational, r1: number, c2: Rational, r2: number): { c: Rational; r: number } {
  const prod = r1 * r2
  if (!Number.isSafeInteger(prod) || prod <= 0) throw new RangeError('a radical in that answer is too large to check exactly')
  const { coeff, rad } = splitSquare(prod)
  return { c: ratMul(ratMul(c1, c2), rat(coeff)), r: rad }
}

function addSurd(c1: Rational, r1: number, c2: Rational, r2: number): { c: Rational; r: number } | null {
  if (c1.n === 0) return { c: c2, r: c2.n === 0 ? 1 : r2 }
  if (c2.n === 0) return { c: c1, r: r1 }
  if (r1 !== r2) return null
  const c = ratAdd(c1, c2)
  return { c, r: c.n === 0 ? 1 : r1 }
}

export function cxAdd(a: Cx, b: Cx): Cx {
  const re = addSurd(a.re, a.reRad, b.re, b.reRad)
  const im = addSurd(a.im, a.imRad, b.im, b.imRad)
  if (!re || !im) throw new CxSkip('unlike radicals')
  return cxNorm({ re: re.c, reRad: re.r, im: im.c, imRad: im.r })
}

export function cxSub(a: Cx, b: Cx): Cx {
  return cxAdd(a, cxNeg(b))
}

/**
 * (re1 √r1 + im1 √s1 i)(re2 √r2 + im2 √s2 i)
 * = re1 re2 √(r1 r2) − im1 im2 √(s1 s2)  +  (re1 im2 √(r1 s2) + im1 re2 √(s1 r2)) i
 */
export function cxMul(a: Cx, b: Cx): Cx {
  const ac = surdMul(a.re, a.reRad, b.re, b.reRad)
  const bd = surdMul(a.im, a.imRad, b.im, b.imRad)
  const re = addSurd(ac.c, ac.r, ratNeg(bd.c), bd.r)
  const ad = surdMul(a.re, a.reRad, b.im, b.imRad)
  const bc = surdMul(a.im, a.imRad, b.re, b.reRad)
  const im = addSurd(ad.c, ad.r, bc.c, bc.r)
  if (!re || !im) throw new CxSkip('unlike radicals in a product')
  return cxNorm({ re: re.c, reRad: re.r, im: im.c, imRad: im.r })
}

/** Product of Gaussians using i² = +1 (the named slip). */
export function cxMulI2Positive(a: Cx, b: Cx): Cx {
  if (!cxIsGaussian(a) || !cxIsGaussian(b)) throw new CxSkip('i² slip needs Gaussian parts')
  const ac = ratMul(a.re, b.re)
  const bd = ratMul(a.im, b.im)
  const ad = ratMul(a.re, b.im)
  const bc = ratMul(a.im, b.re)
  return cx(ratAdd(ac, bd), ratAdd(ad, bc))
}

/** First and last of FOIL, with i² = −1: ac − bd, a real. */
export function cxMulFoilDropped(a: Cx, b: Cx): Cx {
  if (!cxIsGaussian(a) || !cxIsGaussian(b)) throw new CxSkip('FOIL slip needs Gaussian parts')
  const ac = ratMul(a.re, b.re)
  const bd = ratMul(a.im, b.im)
  return cx(ratSub(ac, bd), 0)
}

export function cxDiv(a: Cx, b: Cx): Cx {
  if (cxIsZero(b)) throw new RangeError('division by zero')
  if (cxIsReal(b) && b.reRad === 1) {
    return cxNorm({
      re: ratDiv(a.re, b.re),
      reRad: a.reRad,
      im: ratDiv(a.im, b.re),
      imRad: a.imRad,
    })
  }
  const conj = cxConj(b)
  const num = cxMul(a, conj)
  const den = cxMul(b, conj)
  if (!cxIsReal(den) || den.reRad !== 1 || den.re.n === 0) throw new CxSkip('denominator did not become real')
  return cxNorm({
    re: ratDiv(num.re, den.re),
    reRad: num.reRad,
    im: ratDiv(num.im, den.re),
    imRad: num.imRad,
  })
}

/** i^n for any integer n, using the cycle of 4. */
export function cxIPower(n: number): Cx {
  if (!Number.isSafeInteger(n)) throw new RangeError(`power ${n}`)
  const r = ((n % 4) + 4) % 4
  if (r === 0) return cx(1)
  if (r === 1) return cx(0, 1)
  if (r === 2) return cx(-1)
  return cx(0, -1)
}

export function cxPow(base: Cx, exp: Cx): Cx {
  if (!cxIsReal(exp) || exp.reRad !== 1 || exp.re.d !== 1) throw new CxSkip('non-integer power')
  const n = exp.re.n
  if (cxEq(base, cx(0, 1))) return cxIPower(n)
  if (cxIsReal(base) && base.reRad === 1 && base.re.d === 1 && Math.abs(base.re.n) === 1) {
    // (±1)^n
    if (n < 0) throw new CxSkip('negative power of ±1 is fine but unused')
    const s = base.re.n === -1 && n % 2 !== 0 ? -1 : 1
    return cx(s)
  }
  if (n === 0) {
    if (cxIsZero(base)) throw new CxSkip('0^0')
    return cx(1)
  }
  if (n === 1) return cxNorm(base)
  if (n === 2 && cxEq(base, cx(0, 1))) return cx(-1)
  if (n < 0) {
    if (cxEq(base, cx(0, 1))) return cxIPower(n)
    return cxDiv(cx(1), cxPow(base, cx(-n)))
  }
  let out = cx(1)
  for (let i = 0; i < n; i++) out = cxMul(out, base)
  return out
}

/** Square root of a real rational. Negative → k i sqrt(m). Non-integer radicand after clearing is skipped. */
export function cxSqrt(z: Cx): Cx {
  if (!cxIsReal(z) || z.reRad !== 1) throw new CxSkip('sqrt of a non-real')
  const r = z.re
  if (r.n === 0) return cx(0)
  const sign = r.n < 0 ? -1 : 1
  const num = Math.abs(r.n)
  const den = r.d
  const ns = splitSquare(num)
  // sqrt(n/d) = sqrt(n)/sqrt(d) = (ns.coeff / ds.coeff) * sqrt(ns.rad / ds.rad)
  // Make the radicand an integer: sqrt(a/b) = sqrt(a b) / b when b is square-free? ds.rad may be > 1.
  // sqrt(num/den) = sqrt(num * den) / den, then split.
  if (den === 1) {
    if (sign > 0) return cx(rat(ns.coeff), 0, ns.rad, 1)
    return cx(0, rat(ns.coeff), 1, ns.rad)
  }
  const inside = num * den
  if (!Number.isSafeInteger(inside)) throw new RangeError('a square root in that answer is too large to check exactly')
  const sp = splitSquare(inside)
  const coeff = rat(sp.coeff, den)
  if (sign > 0) return cx(coeff, 0, sp.rad, 1)
  return cx(0, coeff, 1, sp.rad)
}

export function cxCompareKey(z: Cx): string {
  const n = cxNorm(z)
  return `${n.re.n}/${n.re.d}r${n.reRad},${n.im.n}/${n.im.d}r${n.imRad}`
}

export function sameCxList(a: readonly Cx[], b: readonly Cx[]): boolean {
  if (a.length !== b.length) return false
  const as = [...a].sort((x, y) => cxCompareKey(x).localeCompare(cxCompareKey(y)))
  const bs = [...b].sort((x, y) => cxCompareKey(x).localeCompare(cxCompareKey(y)))
  return as.every((z, i) => cxEq(z, bs[i]!))
}

function ratAbs(r: Rational): Rational {
  return rat(Math.abs(r.n), r.d)
}

function formatSurd(c: Rational, rad: number, asImag: boolean): string {
  const abs = ratAbs(c)
  if (rad === 1) {
    if (asImag && abs.n === 1 && abs.d === 1) return 'i'
    if (!asImag) return ratToString(abs)
    return abs.d === 1 ? `${ratToString(abs)}i` : `${ratToString(abs)} i`
  }
  const sqrt = `sqrt(${rad})`
  if (abs.n === 1 && abs.d === 1) return asImag ? `i ${sqrt}` : sqrt
  if (asImag) return `${ratToString(abs)}i ${sqrt}`
  return `${ratToString(abs)} ${sqrt}`
}

/** App-syntax a + bi, with optional radicals. */
export function formatCx(z: Cx): string {
  const n = cxNorm(z)
  if (cxIsZero(n)) return '0'
  const parts: { neg: boolean; body: string }[] = []
  if (n.re.n !== 0) parts.push({ neg: n.re.n < 0, body: formatSurd(n.re, n.reRad, false) })
  if (n.im.n !== 0) parts.push({ neg: n.im.n < 0, body: formatSurd(n.im, n.imRad, true) })
  return parts.reduce((acc, p, i) => {
    if (i === 0) return p.neg ? `-${p.body}` : p.body
    return `${acc} ${p.neg ? '-' : '+'} ${p.body}`
  }, '')
}

export function formatCxList(values: readonly Cx[]): string {
  return values.map(formatCx).join(', ')
}

/** "2 +- 3i" when the two values are a+bi and a-bi. */
export function formatPm(a: Cx, b: Cx): string | null {
  if (!cxIsGaussian(a) || !cxIsGaussian(b)) return null
  if (!ratEquals(a.re, b.re)) return null
  if (!ratEquals(a.im, ratNeg(b.im))) return null
  if (a.im.n === 0) return null
  const pos = a.im.n > 0 ? a : b
  const re = formatCx(cx(pos.re, 0))
  const im = formatSurd(pos.im, 1, true)
  return `${re} +- ${im}`
}

export function formatPair(values: readonly Cx[]): string {
  if (values.length === 2) {
    const pm = formatPm(values[0]!, values[1]!)
    if (pm) return pm
  }
  return formatCxList(values)
}

export function show(text: string): string {
  return pretty(text)
}

export function showCx(z: Cx): string {
  return pretty(formatCx(z))
}

function ratLatex(r: Rational): string {
  if (r.d === 1) return `${r.n}`
  const sign = r.n < 0 ? '-' : ''
  return `${sign}\\frac{${Math.abs(r.n)}}{${r.d}}`
}

function surdLatex(c: Rational, rad: number, asImag: boolean): string {
  const abs = ratAbs(c)
  const i = asImag ? 'i' : ''
  const sqrt = rad === 1 ? '' : `\\sqrt{${rad}}`
  if (rad === 1) {
    if (asImag && abs.n === 1 && abs.d === 1) return 'i'
    if (!asImag) return ratLatex(abs)
    if (abs.d === 1 && abs.n === 1) return 'i'
    return `${ratLatex(abs)}${i}`
  }
  if (abs.n === 1 && abs.d === 1) return asImag ? `i\\sqrt{${rad}}` : `\\sqrt{${rad}}`
  return `${ratLatex(abs)}${i}${sqrt}`
}

export function cxToLatex(z: Cx): string {
  const n = cxNorm(z)
  if (cxIsZero(n)) return '0'
  const parts: { neg: boolean; body: string }[] = []
  if (n.re.n !== 0) parts.push({ neg: n.re.n < 0, body: surdLatex(n.re, n.reRad, false) })
  if (n.im.n !== 0) parts.push({ neg: n.im.n < 0, body: surdLatex(n.im, n.imRad, true) })
  return parts.reduce((acc, p, i) => {
    if (i === 0) return p.neg ? `-${p.body}` : p.body
    return p.neg ? `${acc}-${p.body}` : `${acc}+${p.body}`
  }, '')
}

export function listToLatex(values: readonly Cx[]): string {
  if (values.length === 2) {
    const pm = formatPm(values[0]!, values[1]!)
    if (pm) {
      const pos = values[0]!.im.n > 0 ? values[0]! : values[1]!
      return `${cxToLatex(cx(pos.re, 0))}\\pm ${surdLatex(ratAbs(pos.im), 1, true)}`
    }
  }
  return values.map(cxToLatex).join(',\\ ')
}

export function gcd(a: number, b: number): number {
  return gcdInt(a, b)
}
