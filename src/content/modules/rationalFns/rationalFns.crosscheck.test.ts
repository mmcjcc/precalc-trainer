/**
 * Reviewer's cross-check of the rational-function templates, written separately from the module. Each
 * f is split into numerator and denominator, both are turned into coefficients by evaluating them with
 * a mathjs instance in exact fractions, and every feature is recomputed here (polynomial gcd for the
 * holes, rational roots, the degree rule, long division for a slant line). Equations are solved by
 * brute force over small fractions. The module's graders must accept the recomputed answers, and each
 * seed's trap answer must be named as its trap.
 */
import { all, create, type Fraction } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { gradeRfStage, type RationalFnsAnswer } from './build'
import type { RfStageId } from './grade'

const math = create(all, { number: 'Fraction' })
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SWEEP = { timeout: 180_000 }

type Fr = Fraction
type Poly = Fr[] // constant term first
const fr = (v: number | string): Fr => math.fraction(typeof v === 'string' ? v.replace(/−/g, '-').trim() : v) as Fr
const add = (a: Fr, b: Fr): Fr => math.add(a, b) as Fr
const sub = (a: Fr, b: Fr): Fr => math.subtract(a, b) as Fr
const mul = (a: Fr, b: Fr): Fr => math.multiply(a, b) as Fr
const div = (a: Fr, b: Fr): Fr => math.divide(a, b) as Fr
const isZero = (a: Fr): boolean => Number(a.n) === 0
const sign = (a: Fr): number => (isZero(a) ? 0 : Number(a.s) < 0 ? -1 : 1)
const txt = (a: Fr): string => a.toFraction()
const cmp = (a: Fr, b: Fr): number => sign(sub(a, b))

function prep(text: string): string {
  return text.replace(/−/g, '-').replace(/([0-9x)])\s*\(/g, '$1*(')
}

/** "(A)/(B)" or "A/(B)" at the top level, without a parser of the module's. */
function splitFraction(text: string): [string, string] {
  let depth = 0
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === '/' && depth === 0) return [text.slice(0, i), text.slice(i + 1)]
  }
  return [text, '1']
}

function coefficients(text: string): Poly {
  const n = 9
  const dd = Array.from({ length: n }, (_, i) => math.evaluate(prep(text), { x: fr(i + 10) }) as Fr)
  for (let j = 1; j < n; j++) for (let i = n - 1; i >= j; i--) dd[i] = div(sub(dd[i]!, dd[i - 1]!), fr(j))
  let poly: Poly = [fr(0)]
  let basis: Poly = [fr(1)]
  for (let j = 0; j < n; j++) {
    poly = Array.from({ length: Math.max(poly.length, basis.length) }, (_, k) => add(poly[k] ?? fr(0), mul(dd[j]!, basis[k] ?? fr(0))))
    basis = Array.from({ length: basis.length + 1 }, (_, k) => sub(basis[k - 1] ?? fr(0), mul(fr(j + 10), basis[k] ?? fr(0))))
  }
  return trim(poly)
}

function trim(p: Poly): Poly {
  const q = p.slice()
  while (q.length > 1 && isZero(q[q.length - 1]!)) q.pop()
  return q
}

const deg = (p: Poly): number => (p.length === 1 && isZero(p[0]!) ? -1 : p.length - 1)
const horner = (p: Poly, x: Fr): Fr => p.reduceRight((acc, k) => add(mul(acc, x), k), fr(0))

function divmod(a: Poly, b: Poly): [Poly, Poly] {
  let r = trim(a)
  const db = deg(b)
  const q: Poly = Array.from({ length: Math.max(1, deg(r) - db + 1) }, () => fr(0))
  while (deg(r) >= db && deg(r) >= 0) {
    const shift = deg(r) - db
    const c = div(r[deg(r)]!, b[db]!)
    q[shift] = c
    r = trim(r.map((v, i) => (i >= shift && i - shift <= db ? sub(v, mul(c, b[i - shift]!)) : v)))
  }
  return [trim(q), r]
}

function gcd(a: Poly, b: Poly): Poly {
  let x = trim(a)
  let y = trim(b)
  while (deg(y) >= 0) {
    const [, r] = divmod(x, y)
    x = y
    y = r
  }
  const lead = x[deg(x)]!
  return x.map((v) => div(v, lead))
}

function divisors(n: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= Math.abs(n); d++) if (Math.abs(n) % d === 0) out.push(d)
  return out
}

/** Distinct rational zeros, ascending. */
function zeros(p: Poly): Fr[] {
  if (deg(p) <= 0) return []
  const out: Fr[] = []
  let low = p.slice()
  if (isZero(low[0]!)) {
    out.push(fr(0))
    while (low.length > 1 && isZero(low[0]!)) low = low.slice(1)
  }
  const lcm = low.reduce((m, k) => (m * Number(k.d)) / gcdInt(m, Number(k.d)), 1)
  const whole = low.map((k) => Number(txt(mul(k, fr(lcm)))))
  if (whole.length > 1) {
    for (const pp of divisors(whole[0]!)) for (const qq of divisors(whole[whole.length - 1]!)) for (const s of [1, -1]) {
      const z = div(fr(s * pp), fr(qq))
      if (isZero(horner(low, z)) && !out.some((o) => isZero(sub(o, z)))) out.push(z)
    }
  }
  return out.sort(cmp)
}

function gcdInt(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcdInt(b, a % b)
}

function polyText(high: Poly): string {
  const n = high.length - 1
  const parts: string[] = []
  high.forEach((k, i) => {
    if (isZero(k) && n > 0) return
    const power = n - i
    const size = txt(math.abs(k) as Fr)
    const coef = power > 0 && size === '1' ? '' : size.includes('/') ? `(${size})` : size
    const body = power === 0 ? size : power === 1 ? `${coef}x` : `${coef}x^${power}`
    parts.push(parts.length === 0 ? (sign(k) < 0 ? `-${body}` : body) : `${sign(k) < 0 ? '-' : '+'} ${body}`)
  })
  return parts.join(' ') || '0'
}

const point = (x: Fr, y: Fr): string => `(${txt(x)}, ${txt(y)})`

function domainText(excluded: Fr[]): string {
  if (excluded.length === 0) return '(-inf, inf)'
  const ends = ['-inf', ...excluded.map(txt), 'inf']
  return ends.slice(0, -1).map((e, i) => `(${e}, ${ends[i + 1]})`).join(' U ')
}

interface Features {
  domain: string
  va: string
  holes: string
  asymptote: string
  xint: string
  yint: string
}

function features(f: string): Features {
  const [nt, dt] = splitFraction(f)
  const N = coefficients(nt)
  const D = coefficients(dt)
  const G = gcd(N, D)
  const [Nr] = divmod(N, G)
  const [Dr] = divmod(D, G)
  const excluded = zeros(D)
  const holeXs = zeros(G).filter((x) => excluded.some((e) => isZero(sub(e, x))))
  const vas = zeros(Dr)
  const holes = holeXs.map((x) => point(x, div(horner(Nr, x), horner(Dr, x))))
  let asymptote = 'none'
  if (deg(N) < deg(D)) asymptote = 'y = 0'
  else if (deg(N) === deg(D)) asymptote = `y = ${txt(div(N[deg(N)]!, D[deg(D)]!))}`
  else if (deg(N) === deg(D) + 1) asymptote = `y = ${polyText(divmod(N, D)[0].slice().reverse())}`
  const xs = zeros(Nr).filter((x) => !excluded.some((e) => isZero(sub(e, x))))
  const zeroOk = !excluded.some(isZero)
  return {
    domain: domainText(excluded),
    va: vas.length ? vas.map((x) => `x = ${txt(x)}`).join(', ') : 'none',
    holes: holes.length ? holes.join(', ') : 'none',
    asymptote,
    xint: xs.length ? xs.map((x) => point(x, fr(0))).join(', ') : 'none',
    yint: zeroOk ? point(fr(0), div(horner(N, fr(0)), horner(D, fr(0)))) : 'none',
  }
}

const GRID: Fr[] = []
for (let q = 1; q <= 6; q++) for (let p = -60; p <= 60; p++) if (gcdInt(p, q) === 1) GRID.push(div(fr(p), fr(q)))

function solve(equation: string): Fr[] {
  const [l, r] = equation.split('=')
  const out: Fr[] = []
  for (const x of GRID) {
    try {
      const lv = math.evaluate(prep(l!), { x }) as Fr
      const rv = math.evaluate(prep(r!), { x }) as Fr
      if (typeof lv === 'object' && typeof rv === 'object' && isZero(sub(lv, rv))) out.push(x)
    } catch {
      // a denominator of 0: not in the domain
    }
  }
  return out.sort(cmp)
}

function answerOf(templateId: string, seed: number): RationalFnsAnswer {
  const p = generateProblem('rationalFns', templateId, seed)
  if (p.answer.type !== 'rationalFns') throw new Error(`${p.id}: not a rational-function answer`)
  return p.answer
}

function expectTrap(a: RationalFnsAnswer, id: string): void {
  if (!a.trap || !a.trapAnswer) return
  const g = gradeRfStage(a, a.trapStage as RfStageId, a.trapAnswer)
  expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `${id}: trap ${a.trap} at ${a.trapStage} with ${a.trapAnswer}`).toBe(a.trap)
}

describe('rf.features', () => {
  it('every part matches the separate computation, 300 seeds', SWEEP, () => {
    let holes = 0
    for (const seed of SEEDS) {
      const a = answerOf('rf.features', seed)
      const id = `rf.features/${seed}: ${a.f}`
      const mine = features(a.f)
      if (mine.holes !== 'none') holes++
      for (const stage of ['domain', 'va', 'holes', 'asymptote', 'xint', 'yint'] as const) {
        const g = gradeRfStage(a, stage, mine[stage])
        expect(g.verdict, `${id}: ${stage} = ${mine[stage]} (${'message' in g ? g.message : ''})`).toBe('correct')
      }
      expectTrap(a, id)
      // The prompt names the parts to find; it must not contain an answer.
      for (const ans of [mine.holes, mine.va, mine.xint]) if (ans !== 'none') expect(a.prompt, id).not.toContain(ans)
      expect(a.graph, id).toBeDefined()
    }
    expect(holes, 'about half have a hole').toBeGreaterThan(90)
  })
})

describe('rf.asymptote', () => {
  it('the degree rule and the slant line match the separate computation, 300 seeds', SWEEP, () => {
    const kinds = new Set<string>()
    for (const seed of SEEDS) {
      const a = answerOf('rf.asymptote', seed)
      const id = `rf.asymptote/${seed}: ${a.f}`
      const mine = features(a.f).asymptote
      kinds.add(mine === 'y = 0' ? 'zero' : /x/.test(mine) ? 'slant' : 'ratio')
      expect(gradeRfStage(a, 'asymptote', mine).verdict, `${id}: ${mine}`).toBe('correct')
      expectTrap(a, id)
    }
    expect(kinds.size).toBe(3)
  })
})

describe('rf.equation', () => {
  it('the solution set is what brute force finds, extraneous values left out, 300 seeds', SWEEP, () => {
    let none = 0
    for (const seed of SEEDS) {
      const a = answerOf('rf.equation', seed)
      const id = `rf.equation/${seed}: ${a.equation}`
      const sols = solve(a.equation)
      if (sols.length === 0) none++
      const text = sols.length ? `{${sols.map(txt).join(', ')}}` : 'no solution'
      const g = gradeRfStage(a, 'solution', text)
      expect(g.verdict, `${id}: ${text} (${'message' in g ? g.message : ''})`).toBe('correct')
      expectTrap(a, id)
    }
    expect(none, 'some equations have no solution').toBeGreaterThan(5)
  })
})
