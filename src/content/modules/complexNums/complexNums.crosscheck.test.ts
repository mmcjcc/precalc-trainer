/**
 * Reviewer's cross-check of the complex-number templates, written separately from the module. The true
 * values come from mathjs's own complex arithmetic: the expression evaluated as written, the quadratic
 * formula applied to the coefficients read off the equation, and every zero of a polynomial found by
 * dividing out the given zero's conjugate pair. The module's answer (decoded by its parser) must be the
 * same set of numbers, the grader must accept it, and each seed's trap must be named as its trap.
 */
import { all, create, type Complex } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ratToNumber } from '@/notation'
import type { Cx } from './arith'
import { canonicalEntries, gradeCxStage, type ComplexNumsAnswer } from './build'
import { parseCxAnswer } from './parse'

const math = create(all, {})
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const SWEEP = { timeout: 180_000 }
const EPS = 1e-7

type Z = { re: number; im: number }
const z = (v: unknown): Z => {
  if (typeof v === 'number') return { re: v, im: 0 }
  const c = v as Complex
  return { re: c.re, im: c.im }
}

function prep(text: string): string {
  return text
    .replace(/−/g, '-')
    .replace(/[·×]/g, '*')
    .replace(/√\(/g, 'sqrt(')
    .replace(/√(\d+)/g, 'sqrt($1)')
    .replace(/\)\s*\(/g, ')*(')
}

const floatOf = (c: Cx): Z => ({
  re: ratToNumber(c.re) * Math.sqrt(c.reRad),
  im: ratToNumber(c.im) * Math.sqrt(c.imRad),
})

function sameSet(a: Z[], b: Z[]): boolean {
  if (a.length !== b.length) return false
  const left = b.slice()
  for (const x of a) {
    const i = left.findIndex((y) => Math.abs(x.re - y.re) < EPS && Math.abs(x.im - y.im) < EPS)
    if (i < 0) return false
    left.splice(i, 1)
  }
  return true
}

/** Real coefficients, constant term first, of left - right in x (degree at most 5), by divided differences. */
function coefficients(equation: string): number[] {
  const [l, r = '0'] = prep(equation).split('=')
  const f = (x: number) => Number(math.evaluate(l!, { x })) - Number(math.evaluate(r, { x }))
  const n = 6
  const dd = Array.from({ length: n }, (_, i) => f(i))
  for (let j = 1; j < n; j++) for (let i = n - 1; i >= j; i--) dd[i] = (dd[i]! - dd[i - 1]!) / j
  let poly = [0]
  let basis = [1]
  for (let j = 0; j < n; j++) {
    poly = Array.from({ length: Math.max(poly.length, basis.length) }, (_, k) => (poly[k] ?? 0) + dd[j]! * (basis[k] ?? 0))
    basis = Array.from({ length: basis.length + 1 }, (_, k) => (basis[k - 1] ?? 0) - j * (basis[k] ?? 0))
  }
  const c = poly.map((v) => Math.round(v * 1e9) / 1e9)
  while (c.length > 1 && Math.abs(c[c.length - 1]!) < 1e-9) c.pop()
  return c
}

function quadraticRoots(c: number[]): Z[] {
  const [cc, b, a] = [c[0] ?? 0, c[1] ?? 0, c[2]!]
  const disc = b * b - 4 * a * cc
  if (disc >= 0) return [{ re: (-b + Math.sqrt(disc)) / (2 * a), im: 0 }, { re: (-b - Math.sqrt(disc)) / (2 * a), im: 0 }]
  const im = Math.sqrt(-disc) / (2 * a)
  return [{ re: -b / (2 * a), im }, { re: -b / (2 * a), im: -im }]
}

/** Every zero: divide out the conjugate pair of the given zero, then solve what is left. */
function allZeros(c: number[], given: Z): Z[] {
  // (x - g)(x - conj g) = x^2 - 2 Re(g) x + |g|^2
  const q = [given.re ** 2 + given.im ** 2, -2 * given.re, 1]
  let rem = c.slice().reverse() // highest power first
  const out: number[] = []
  const qh = q.slice().reverse()
  while (rem.length >= qh.length) {
    const k = rem[0]! / qh[0]!
    out.push(k)
    rem = rem.map((v, i) => (i < qh.length ? v - k * qh[i]! : v)).slice(1)
  }
  expect(rem.every((v) => Math.abs(v) < 1e-7), 'the conjugate pair divides f').toBe(true)
  const rest = out.slice().reverse()
  const pair = [given, { re: given.re, im: -given.im }]
  if (rest.length === 2) return [...pair, { re: -rest[0]! / rest[1]!, im: 0 }]
  if (rest.length === 3) return [...pair, ...quadraticRoots(rest)]
  return pair
}

function answerOf(t: string, seed: number): ComplexNumsAnswer {
  const p = generateProblem('complexNums', t, seed)
  if (p.answer.type !== 'complexNums') throw new Error(`${p.id}: not a complex-number answer`)
  return p.answer
}

function truth(a: ComplexNumsAnswer): Z[] {
  switch (a.question) {
    case 'arith':
    case 'divide':
    case 'powers':
      return [z(math.evaluate(prep(a.expression)))]
    case 'quadratic':
      // The equation is in `expression` for this template (`f` is the zeros template's polynomial).
      return quadraticRoots(coefficients(a.f || a.expression))
    case 'zeros': {
      const g = z(math.evaluate(prep(a.givenZero)))
      const c = coefficients(a.f)
      const fg = z(math.evaluate(prep(a.f.split('=')[0]!).replace(/x/g, `(${prep(a.givenZero)})`)))
      expect(Math.hypot(fg.re, fg.im), `${a.f} is 0 at ${a.givenZero}`).toBeLessThan(1e-6)
      return allZeros(c, g)
    }
  }
}

describe.each(['cx.arith', 'cx.divide', 'cx.powers', 'cx.quadratic', 'cx.zeros'] as const)('%s', (templateId) => {
  it('the answer is the value mathjs computes, 300 seeds', SWEEP, () => {
    for (const seed of SEEDS) {
      const a = answerOf(templateId, seed)
      const id = `${templateId}/${seed}: ${a.expression || a.f} ${a.givenZero ?? ''}`
      const canonical = canonicalEntries(a).answer!
      const parsed = parseCxAnswer(canonical)
      expect(parsed.ok, `${id}: the module's own answer ${canonical} parses`).toBe(true)
      if (!parsed.ok) continue
      const theirs = parsed.values.map(floatOf)
      const mine = truth(a)
      expect(sameSet(theirs, mine), `${id}: module ${JSON.stringify(theirs)} vs mathjs ${JSON.stringify(mine)}`).toBe(true)
      expect(gradeCxStage(a, 'answer', canonical).verdict, id).toBe('correct')
      if (a.trap && a.trapAnswer) {
        const g = gradeCxStage(a, 'answer', a.trapAnswer)
        expect(g.verdict === 'mistake' ? g.mistake : g.verdict, `${id}: trap ${a.trap} with ${a.trapAnswer}`).toBe(a.trap)
      }
      if (canonical.length > 3) expect(a.prompt, id).not.toContain(canonical)
    }
  })
})
