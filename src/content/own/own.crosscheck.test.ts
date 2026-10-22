/**
 * Reviewer's cross-check of "Check my own problem" (docs/progress/own-problem.md, Review). The builder's round trips
 * prove that the constructors agree with the generator on generated problems; her homework can be anything inside
 * the class a constructor accepts. Here random problems of every accepted shape, made by this file's own generator
 * (not the templates'), are built with `buildOwnProblem`, and every accepted one's answer is checked against an
 * answer worked out here without the app's engine: solution sets by evaluating the inequality itself, inverses by
 * composing them with f, equation roots from their closed forms, rewrites and vertex forms and difference quotients by
 * evaluating both sides. Plain floating point and math.js evaluation only; nothing from src/engine.
 *
 * REVIEW_OWN_N (default 12) sets how many problems each shape makes; the review ran it at 150.
 */
import { all, create } from 'mathjs'
import { describe, expect, it } from 'vitest'
import { gradeLogEquation } from '@/engine/logs'
import { rat, ratAdd, ratSub, setContains, type Rational } from '@/notation'
import type { Piece, SolutionSet } from '@/shared/types'
import { buildOwnProblem } from './index'

const M = create(all, {})
const N = Number(process.env.REVIEW_OWN_N ?? 12)
const SLOW = { timeout: 600_000 }

// ---------------------------------------------------------------------------
// A seeded generator of this file's own (mulberry32)
// ---------------------------------------------------------------------------

function makeRand(seed: number) {
  let s = seed >>> 0
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1))
  const nz = (lo: number, hi: number) => {
    for (;;) {
      const v = int(lo, hi)
      if (v !== 0) return v
    }
  }
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!
  return { next, int, nz, pick }
}

/** p·v + q as she would type it: "3x - 4", "-x + 2", "x", "5". */
function lin(p: number, q: number, v = 'x'): string {
  const head = p === 0 ? '' : p === 1 ? v : p === -1 ? `-${v}` : `${p}${v}`
  if (!head) return String(q)
  if (q === 0) return head
  return `${head} ${q < 0 ? '-' : '+'} ${Math.abs(q)}`
}

// ---------------------------------------------------------------------------
// Evaluating app syntax without the app: logs and roots become this file's own functions
// ---------------------------------------------------------------------------

function toJs(app: string): string {
  return app
    .replace(/[−–]/g, '-')
    .replace(/(?<![A-Za-z_])log_(\d+)\s*\(/g, 'lgb$1(')
    .replace(/(?<![A-Za-z_])log\s*\(/g, 'lg10(')
    .replace(/(?<![A-Za-z_])ln\s*\(/g, 'lnn(')
    .replace(/(?<![A-Za-z_])cbrt\s*\(/g, 'cbrtt(')
    .replace(/(?<![A-Za-z_])sqrt\s*\(/g, 'sqrtt(')
    // A letter before a bracket multiplies it, as in the app: x(x + h) is not a call of x.
    .replace(/(?<![A-Za-z_])([xhyn])\s*\(/g, '$1*(')
}

const compiled = new Map<string, { evaluate: (scope: Record<string, unknown>) => unknown; bases: number[] }>()

function evalApp(app: string, vars: Record<string, number>): number {
  let c = compiled.get(app)
  if (!c) {
    const js = toJs(app)
    const bases = [...js.matchAll(/lgb(\d+)\(/g)].map((m) => Number(m[1]))
    const code = M.compile(js)
    c = { evaluate: (scope) => code.evaluate(scope), bases }
    compiled.set(app, c)
  }
  const scope: Record<string, unknown> = {
    lg10: (v: number) => (v > 0 ? Math.log10(v) : NaN),
    lnn: (v: number) => (v > 0 ? Math.log(v) : NaN),
    cbrtt: (v: number) => Math.cbrt(v),
    sqrtt: (v: number) => (v >= 0 ? Math.sqrt(v) : NaN),
    ...vars,
  }
  for (const b of c.bases) scope[`lgb${b}`] = (v: number) => (v > 0 ? Math.log(v) / Math.log(b) : NaN)
  const v = c.evaluate(scope)
  return typeof v === 'number' ? v : NaN
}

const close = (a: number, b: number, tol = 1e-7) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))

interface Tally {
  made: number
  accepted: number
  reasons: Map<string, number>
}
const tally = (): Tally => ({ made: 0, accepted: 0, reasons: new Map() })
function note(t: Tally, ok: boolean, code?: string) {
  t.made++
  if (ok) t.accepted++
  else t.reasons.set(code ?? '?', (t.reasons.get(code ?? '?') ?? 0) + 1)
}
const summary = (t: Tally) => `${t.accepted}/${t.made} accepted; refused: ${[...t.reasons].map(([k, v]) => `${k} ${v}`).join(', ')}`

// ---------------------------------------------------------------------------
// Inequalities: the answer's set against the inequality itself
// ---------------------------------------------------------------------------

type Op = '<' | '<=' | '>' | '>='
function holds(l: number, op: Op, r: number): boolean {
  const d = l - r
  const eq = Math.abs(d) < 1e-9 * Math.max(1, Math.abs(l), Math.abs(r))
  if (op === '<') return !eq && d < 0
  if (op === '<=') return eq || d < 0
  if (op === '>') return !eq && d > 0
  return eq || d > 0
}

interface IneqCase {
  text: string
  truth: (x: number) => boolean
}

function ineqCases(seed: number): IneqCase[] {
  const R = makeRand(seed)
  const ops: Op[] = ['<', '<=', '>', '>=']
  const out: IneqCase[] = []
  for (let i = 0; i < N; i++) {
    const v = R.pick(['x', 'x', 'x', 'n', 'y'])
    // A: a v + b op c v + d
    {
      const a = R.nz(-9, 9)
      let c = R.int(-9, 9)
      if (c === a) c = a + 1
      const [b, d] = [R.int(-20, 20), R.int(-20, 20)]
      const op = R.pick(ops)
      out.push({ text: `${lin(a, b, v)} ${op} ${lin(c, d, v)}`, truth: (x) => holds(a * x + b, op, c * x + d) })
    }
    // B: a(v + b) + c op d(v + e), sometimes a negative outside the bracket
    {
      const [a, d] = [R.nz(-6, 6), R.nz(-6, 6)]
      if (a !== d) {
        const [b, c, e] = [R.int(-9, 9), R.int(-15, 15), R.int(-9, 9)]
        const op = R.pick(ops)
        const left = `${a}(${lin(1, b, v)})${c === 0 ? '' : ` ${c < 0 ? '-' : '+'} ${Math.abs(c)}`}`
        out.push({ text: `${left} ${op} ${d}(${lin(1, e, v)})`, truth: (x) => holds(a * (x + b) + c, op, d * (x + e)) })
      }
    }
    // C: fractions (p v + q)/m op (r v + s)/n + t
    {
      const [m, n] = [R.pick([2, 3, 4, 5, 6]), R.pick([2, 3, 4, 5, 6])]
      const [p, r] = [R.nz(-7, 7), R.nz(-7, 7)]
      const [q, s, t] = [R.int(-9, 9), R.int(-9, 9), R.int(-6, 6)]
      if (p * n !== r * m) {
        const op = R.pick(ops)
        const tail = t === 0 ? '' : ` ${t < 0 ? '-' : '+'} ${Math.abs(t)}`
        out.push({ text: `(${lin(p, q, v)})/${m} ${op} (${lin(r, s, v)})/${n}${tail}`, truth: (x) => holds((p * x + q) / m, op, (r * x + s) / n + t) })
      }
    }
    // D: decimals
    {
      const p = R.pick([0.5, 1.5, -0.25, 2.5, -1.5, 0.75])
      const r = R.pick([0, 0.25, -0.5, 1])
      const q = R.pick([1.25, -2.5, 0.5, 3])
      const s = R.pick([2.75, -1, 0, 4.5])
      if (p !== r) {
        const op = R.pick(ops)
        out.push({ text: `${p}${v} ${q < 0 ? '-' : '+'} ${Math.abs(q)} ${op} ${r === 0 ? '' : `${r}${v} + `}${s}`.replace('+ -', '- '), truth: (x) => holds(p * x + q, op, r * x + s) })
      }
    }
    // E: a chain lo op1 a v + b op2 hi
    {
      const a = R.nz(-6, 6)
      const b = R.int(-12, 12)
      const lo = R.int(-20, 10)
      const hi = lo + R.int(1, 25)
      const op1 = R.pick(['<', '<='] as const)
      const op2 = R.pick(['<', '<='] as const)
      out.push({ text: `${lo} ${op1} ${lin(a, b, v)} ${op2} ${hi}`, truth: (x) => holds(lo, op1, a * x + b) && holds(a * x + b, op2, hi) })
    }
    // F: two joined by "and" / "or"
    {
      const [a, d] = [R.nz(-5, 5), R.nz(-5, 5)]
      const [b, c, e, f] = [R.int(-10, 10), R.int(-15, 15), R.int(-10, 10), R.int(-15, 15)]
      const [op1, op2] = [R.pick(ops), R.pick(ops)]
      const join = R.pick(['and', 'or'] as const)
      out.push({
        text: `${lin(a, b, v)} ${op1} ${c} ${join} ${lin(d, e, v)} ${op2} ${f}`,
        truth: (x) => (join === 'and' ? holds(a * x + b, op1, c) && holds(d * x + e, op2, f) : holds(a * x + b, op1, c) || holds(d * x + e, op2, f)),
      })
    }
  }
  return out
}

const ratNum = (r: Rational) => r.n / r.d
function endpoints(set: SolutionSet): Rational[] {
  const out: Rational[] = [...set.points]
  for (const p of set.pieces as Piece[]) {
    if (typeof p.lo === 'object') out.push(p.lo)
    if (typeof p.hi === 'object') out.push(p.hi)
  }
  return out
}

describe('reviewer cross-check: inequalities she types', () => {
  it('every accepted inequality has the solution set the inequality itself gives', SLOW, () => {
    const t = tally()
    const wrong: string[] = []
    for (const c of ineqCases(20261022)) {
      const r = buildOwnProblem('inequalities', 'solve', c.text)
      note(t, r.ok, r.ok ? undefined : r.reason.code)
      if (!r.ok) continue
      const set = (r.instance.answer as { set: SolutionSet }).set
      const probes: Rational[] = []
      for (const e of endpoints(set)) probes.push(e, ratAdd(e, rat(1, 1000)), ratSub(e, rat(1, 1000)), ratAdd(e, rat(1, 2)), ratSub(e, rat(1, 2)))
      for (let x = -70; x <= 70; x += 1) probes.push(rat(x, 1), rat(2 * x + 1, 2))
      for (const p of probes) {
        const truth = c.truth(ratNum(p))
        if (setContains(set, p) !== truth) {
          wrong.push(`${c.text}: at ${p.n}/${p.d} the answer says ${!truth}, the inequality says ${truth}`)
          break
        }
      }
    }
    console.log(`inequalities: ${summary(t)}`)
    expect(wrong).toEqual([])
    expect(t.accepted / t.made).toBeGreaterThan(0.6)
  })
})

// ---------------------------------------------------------------------------
// Inverses: compose them with f
// ---------------------------------------------------------------------------

interface InvCase {
  text: string
  f: (x: number) => number
  oneToOne: boolean
}

function invCases(seed: number): InvCase[] {
  const R = makeRand(seed)
  const out: InvCase[] = []
  for (let i = 0; i < N; i++) {
    {
      const [a, b] = [R.nz(-9, 9), R.int(-15, 15)]
      out.push({ text: `f(x) = ${lin(a, b)}`, f: (x) => a * x + b, oneToOne: true })
    }
    {
      const [p, q] = [R.nz(-5, 5), R.pick([2, 3, 4, 5])]
      const b = R.int(-9, 9)
      if (p % q !== 0) out.push({ text: `f(x) = (${p}/${q})x ${b < 0 ? '-' : '+'} ${Math.abs(b)}`, f: (x) => (p / q) * x + b, oneToOne: true })
    }
    {
      const [p, q, r] = [R.nz(-6, 6), R.int(-9, 9), R.int(-9, 9)]
      out.push({ text: `f(x) = cbrt(${lin(p, q)})${r === 0 ? '' : ` ${r < 0 ? '-' : '+'} ${Math.abs(r)}`}`, f: (x) => Math.cbrt(p * x + q) + r, oneToOne: true })
    }
    {
      const [k, c, d, m] = [R.nz(-9, 9), R.nz(-4, 4), R.int(-8, 8), R.int(-6, 6)]
      out.push({ text: `f(x) = ${k}/(${lin(c, d)})${m === 0 ? '' : ` ${m < 0 ? '-' : '+'} ${Math.abs(m)}`}`, f: (x) => k / (c * x + d) + m, oneToOne: true })
    }
    {
      const [a, b, c, d] = [R.nz(-6, 6), R.int(-9, 9), R.nz(-4, 4), R.int(-8, 8)]
      if (a * d - b * c !== 0) out.push({ text: `f(x) = (${lin(a, b)})/(${lin(c, d)})`, f: (x) => (a * x + b) / (c * x + d), oneToOne: true })
    }
    {
      const [a, h, k] = [R.nz(-4, 4), R.nz(-6, 6), R.int(-9, 9)]
      out.push({ text: `f(x) = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${h < 0 ? '+' : '-'} ${Math.abs(h)})^2${k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`}`, f: (x) => a * (x - h) ** 2 + k, oneToOne: false })
    }
  }
  return out
}

describe('reviewer cross-check: inverses she types', () => {
  it('every accepted function gets the right one-to-one verdict, and its inverse undoes f both ways', SLOW, () => {
    const t = tally()
    const wrong: string[] = []
    const R = makeRand(7)
    for (const c of invCases(20261023)) {
      const r = buildOwnProblem('inverses', 'inverse', c.text)
      note(t, r.ok, r.ok ? undefined : r.reason.code)
      if (!r.ok) continue
      const a = r.instance.answer as { type: string; oneToOne: boolean; inverse?: string }
      if (a.type !== 'inverse' || a.oneToOne !== c.oneToOne) {
        wrong.push(`${c.text}: one-to-one ${a.oneToOne}, should be ${c.oneToOne}`)
        continue
      }
      if (!c.oneToOne) continue
      let checked = 0
      for (let k = 0; k < 40 && checked < 12; k++) {
        const x = Math.round((R.next() * 16 - 8) * 100) / 100
        const y = c.f(x)
        if (!Number.isFinite(y) || Math.abs(y) > 1e4) continue
        const back = evalApp(a.inverse!, { x: y })
        checked++
        if (!close(back, x, 1e-6)) {
          wrong.push(`${c.text}: f^-1 = ${a.inverse}, f^-1(f(${x})) = ${back}`)
          break
        }
      }
      if (checked < 6) wrong.push(`${c.text}: only ${checked} points to check`)
    }
    console.log(`inverses: ${summary(t)}`)
    expect(wrong).toEqual([])
    expect(t.accepted / t.made).toBeGreaterThan(0.6)
  })
})

// ---------------------------------------------------------------------------
// Exponential and log equations: roots from their closed forms
// ---------------------------------------------------------------------------

interface EqCase {
  text: string
  roots: number[]
}

const lgb = (b: number, v: number) => Math.log(v) / Math.log(b)

function eqCases(seed: number): EqCase[] {
  const R = makeRand(seed)
  const out: EqCase[] = []
  const quad = (B: number, C: number) => {
    const D = B * B - 4 * C
    if (D < 0) return []
    if (D === 0) return [-B / 2]
    return [(-B - Math.sqrt(D)) / 2, (-B + Math.sqrt(D)) / 2]
  }
  for (let i = 0; i < N; i++) {
    // a·b^(p x + q) = c
    {
      const [a, b, p, q] = [R.pick([1, 1, 2, 3, 5]), R.pick([2, 3, 5, 10]), R.nz(-3, 3), R.int(-4, 4)]
      const c = a * R.pick([4, 8, 9, 20, 7, 100, 1 / 1]) * (R.next() < 0.1 ? -1 : 1)
      const lhs = `${a === 1 ? '' : `${a} * `}${b}^(${lin(p, q)})`
      out.push({ text: `${lhs} = ${c}`, roots: c / a > 0 ? [(lgb(b, c / a) - q) / p] : [] })
    }
    // b1^(p x + q) = b2^(r x + s)
    {
      const [b1, b2] = R.pick([
        [2, 4],
        [4, 8],
        [3, 9],
        [2, 3],
        [5, 2],
        [27, 9],
      ] as const)
      const [p, q, r, s] = [R.nz(-3, 3), R.int(-4, 4), R.nz(-3, 3), R.int(-4, 4)]
      const den = p * Math.log(b1) - r * Math.log(b2)
      if (Math.abs(den) > 1e-9) out.push({ text: `${b1}^(${lin(p, q)}) = ${b2}^(${lin(r, s)})`, roots: [(s * Math.log(b2) - q * Math.log(b1)) / den] })
    }
    // log_b(p x + q) = c
    {
      const [b, p, q, c] = [R.pick([2, 3, 5]), R.nz(-4, 4), R.int(-9, 9), R.int(-1, 4)]
      out.push({ text: `log_${b}(${lin(p, q)}) = ${c}`, roots: [(b ** c - q) / p] })
    }
    // log_b(x + p) + log_b(x + q) = c
    {
      const [b, p, q, c] = [R.pick([2, 3, 10]), R.int(-6, 6), R.int(-6, 6), R.int(1, 3)]
      if (p !== q) {
        const name = b === 10 ? 'log' : `log_${b}`
        const roots = quad(p + q, p * q - b ** c).filter((x) => x + p > 0 && x + q > 0)
        out.push({ text: `${name}(${lin(1, p)}) + ${name}(${lin(1, q)}) = ${c}`, roots })
      }
    }
    // ln(p x + q) = ln(r x + s)
    {
      const [p, q, r, s] = [R.nz(-4, 4), R.int(-9, 9), R.nz(-4, 4), R.int(-9, 9)]
      if (p !== r) {
        const x = (s - q) / (p - r)
        out.push({ text: `ln(${lin(p, q)}) = ln(${lin(r, s)})`, roots: p * x + q > 0 && r * x + s > 0 ? [x] : [] })
      }
    }
    // A quadratic in disguise: b^(2x) - (u1 + u2) b^x + u1 u2 = 0
    {
      const b = R.pick([2, 3, 'e'] as const)
      const [u1, u2] = [R.pick([1, 2, 3, 4, 5, -1, -2]), R.pick([1, 2, 3, 4, 6, 8, -3])]
      if (u1 !== u2) {
        const B = -(u1 + u2)
        const C = u1 * u2
        const base = b === 'e' ? Math.E : b
        const roots = [u1, u2].filter((u) => u > 0).map((u) => Math.log(u) / Math.log(base))
        const mid = B === 0 ? '' : ` ${B < 0 ? '-' : '+'} ${Math.abs(B) === 1 ? '' : `${Math.abs(B)} * `}${b}^x`
        out.push({ text: `${b}^(2x)${mid} ${C < 0 ? '-' : '+'} ${Math.abs(C)} = 0`, roots })
      }
    }
    // log_b(x) - log_b(x - p) = c
    {
      const [b, p, c] = [R.pick([2, 3]), R.int(1, 8), R.int(1, 3)]
      const x = (p * b ** c) / (b ** c - 1)
      out.push({ text: `log_${b}(x) - log_${b}(x - ${p}) = ${c}`, roots: x > p ? [x] : [] })
    }
  }
  return out
}

/** "x = 2 or x = 5", "x = log(20)/log(3)", "x = 2, x = 3" → the numbers. */
function rootsOf(answerText: string): number[] {
  return answerText
    .split(/\s+or\s+|,\s*(?=x\s*=)/)
    .map((s) => s.replace(/^\s*x\s*=\s*/, '').trim())
    .filter(Boolean)
    .map((s) => evalApp(s, {}))
}

describe('reviewer cross-check: exponential and log equations she types', () => {
  it('every accepted equation has exactly the roots its closed form gives, and equations with none are refused', SLOW, () => {
    const t = tally()
    const wrong: string[] = []
    for (const c of eqCases(20261024)) {
      const r = buildOwnProblem('expLogEquations', 'solve', c.text)
      note(t, r.ok, r.ok ? undefined : r.reason.code)
      if (!r.ok) {
        // Refusing an equation that has roots is allowed (a reason is given); claiming none when there are some is not.
        if (r.reason.code === 'no_solution' && c.roots.length) wrong.push(`${c.text}: said no solution, has ${c.roots.join(', ')}`)
        continue
      }
      const a = r.instance.answer as { answerText: string; equation: string }
      const got = rootsOf(a.answerText).sort((p, q) => p - q)
      const want = [...new Set(c.roots.map((x) => Math.round(x * 1e9) / 1e9))].sort((p, q) => p - q)
      if (got.length !== want.length || got.some((g, k) => !close(g, want[k]!, 1e-6))) wrong.push(`${c.text}: answer ${a.answerText} (${got.join(', ')}), roots ${want.join(', ')}`)
    }
    console.log(`exp/log equations: ${summary(t)}`)
    expect(wrong).toEqual([])
    expect(t.accepted / t.made).toBeGreaterThan(0.5)
  })

  it('rounded: every accepted one-root equation asks for its places and takes the closed-form root rounded there', SLOW, () => {
    const t = tally()
    const wrong: string[] = []
    let i = 0
    for (const c of eqCases(20261028)) {
      if (c.roots.length !== 1) continue
      const places = 1 + (i++ % 4)
      const r = buildOwnProblem('expLogEquations', 'solve', c.text, { places })
      note(t, r.ok, r.ok ? undefined : r.reason.code)
      if (!r.ok) continue
      const a = r.instance.answer as { places?: number; accept: string[]; equation: string }
      const want = c.roots[0]!.toFixed(places)
      const graded = gradeLogEquation(a.equation, want, { decimal: { places } }).verdict
      const listed = a.accept.some((s) => Number(s.replace(/^\s*x\s*[=≈]\s*/, '')) === Number(want))
      if (a.places !== places || graded !== 'correct' || !listed) wrong.push(`${c.text} at ${places}: places ${a.places}, ${want} graded ${graded}, accept ${a.accept.join(' ; ')}`)
    }
    console.log(`exp/log equations, rounded: ${summary(t)}`)
    expect(wrong).toEqual([])
    expect(t.accepted / t.made).toBeGreaterThan(0.6)
  })
})

// ---------------------------------------------------------------------------
// Log properties: the finished form equals her expression for positive x, y, n
// ---------------------------------------------------------------------------

function logCases(seed: number): { kind: 'expand' | 'condense'; text: string }[] {
  const R = makeRand(seed)
  const out: { kind: 'expand' | 'condense'; text: string }[] = []
  const name = () => R.pick(['log', 'ln', 'log_2', 'log_3', 'log_5'])
  for (let i = 0; i < N; i++) {
    const L = name()
    const [a, c, d] = [R.int(1, 5), R.int(1, 4), R.int(1, 4)]
    const pw = (v: string, k: number) => (k === 1 ? v : `${v}^${k}`)
    out.push({ kind: 'expand', text: `${L}(${pw('x', a)} ${pw('y', c)} / ${pw('n', d)})` })
    out.push({ kind: 'expand', text: `${L}(${pw('x', a)} sqrt(y))` })
    out.push({ kind: 'expand', text: `${L}((x y)^${R.int(2, 4)} / n)` })
    out.push({ kind: 'expand', text: `${L}(${R.pick([2, 3, 5, 8, 9, 10])}${pw('x', a)})` })
    const k = R.int(-3, 4)
    out.push({ kind: 'condense', text: `${a === 1 ? '' : a}${L}(x) + ${c === 1 ? '' : c}${L}(y) - ${d === 1 ? '' : d}${L}(n)` })
    out.push({ kind: 'condense', text: `${L}(x) - ${c === 1 ? '' : c}${L}(y)${k === 0 ? '' : ` ${k < 0 ? '-' : '+'} ${Math.abs(k)}`}` })
    out.push({ kind: 'condense', text: `(1/2)${L}(x) + ${d}${L}(y)` })
  }
  return out
}

describe('reviewer cross-check: log rewrites she types', () => {
  it('every accepted expression’s finished form equals it for positive x, y and n', SLOW, () => {
    const t = tally()
    const wrong: string[] = []
    const R = makeRand(11)
    for (const c of logCases(20261025)) {
      const r = buildOwnProblem('logProperties', c.kind, c.text)
      note(t, r.ok, r.ok ? undefined : r.reason.code)
      if (!r.ok) continue
      const a = r.instance.answer as { answerText: string; expr: string }
      for (let k = 0; k < 8; k++) {
        const vars = { x: 0.3 + R.next() * 6, y: 0.3 + R.next() * 6, n: 0.3 + R.next() * 6 }
        const want = evalApp(c.text, vars)
        const got = evalApp(a.answerText, vars)
        if (!close(got, want, 1e-9)) {
          wrong.push(`${c.kind} ${c.text}: ${a.answerText} gives ${got}, should be ${want}`)
          break
        }
      }
    }
    console.log(`log properties: ${summary(t)}`)
    expect(wrong).toEqual([])
    expect(t.accepted / t.made).toBeGreaterThan(0.6)
  })
})

// ---------------------------------------------------------------------------
// Quadratics: the vertex form equals f, with the vertex worked out here
// ---------------------------------------------------------------------------

function fracOf(text: string): number {
  return evalApp(text.trim(), {})
}

describe('reviewer cross-check: quadratics she types', () => {
  it('every accepted quadratic gets a vertex form equal to it, the vertex (−b/2a, f(−b/2a)), and the right opening', SLOW, () => {
    const R = makeRand(20261026)
    const t = tally()
    const wrong: string[] = []
    for (let i = 0; i < N * 6; i++) {
      const a = R.pick([1, -1, 2, -2, 3, -3, 4, 5, -5])
      const [b, c] = [R.int(-16, 16), R.int(-20, 20)]
      const forms = [
        `${a === 1 ? '' : a === -1 ? '-' : a}x^2 ${b < 0 ? '-' : '+'} ${Math.abs(b)}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}`,
        `${c} ${b < 0 ? '-' : '+'} ${Math.abs(b)}x ${a < 0 ? '-' : '+'} ${Math.abs(a) === 1 ? '' : Math.abs(a)}x^2`,
      ]
      const text = R.pick(forms)
      const r = buildOwnProblem('quadratics', 'form', text)
      note(t, r.ok, r.ok ? undefined : r.reason.code)
      if (!r.ok) continue
      const q = r.instance.answer as { vertexForm: string; vertexText: string; opens: 'up' | 'down'; extremumKind: string; extremumText: string }
      const f = (x: number) => a * x * x + b * x + c
      for (const x of [-3.5, -1, 0, 0.25, 2, 7]) {
        if (!close(evalApp(q.vertexForm, { x }), f(x), 1e-9)) {
          wrong.push(`${text}: vertex form ${q.vertexForm} differs at ${x}`)
          break
        }
      }
      const h = -b / (2 * a)
      const m = /^\(\s*(.+?)\s*,\s*(.+?)\s*\)$/.exec(q.vertexText)
      if (!m || !close(fracOf(m[1]!), h, 1e-12) || !close(fracOf(m[2]!), f(h), 1e-12)) wrong.push(`${text}: vertex ${q.vertexText}, should be (${h}, ${f(h)})`)
      if (q.opens !== (a > 0 ? 'up' : 'down') || q.extremumKind !== (a > 0 ? 'minimum' : 'maximum') || !close(fracOf(q.extremumText), f(h), 1e-12)) {
        wrong.push(`${text}: opens ${q.opens}, ${q.extremumKind} ${q.extremumText}`)
      }
    }
    console.log(`quadratics: ${summary(t)}`)
    expect(wrong).toEqual([])
    expect(t.accepted / t.made).toBeGreaterThan(0.8)
  })
})

// ---------------------------------------------------------------------------
// Difference quotient: (f(x + h) − f(x))/h at many points
// ---------------------------------------------------------------------------

describe('reviewer cross-check: difference quotients she types', () => {
  it('every accepted f gets a simplified quotient equal to (f(x + h) − f(x))/h, and its f(x + h) line is f(x + h)', SLOW, () => {
    const R = makeRand(20261027)
    const t = tally()
    const wrong: string[] = []
    for (let i = 0; i < N * 3; i++) {
      const cases: { text: string; f: (x: number) => number }[] = []
      {
        const [a, b] = [R.nz(-12, 12), R.int(-20, 20)]
        cases.push({ text: `f(x) = ${lin(a, b)}`, f: (x) => a * x + b })
      }
      {
        const [a, b, c] = [R.nz(-6, 6), R.int(-9, 9), R.int(-9, 9)]
        cases.push({ text: `f(x) = ${a === 1 ? '' : a === -1 ? '-' : a}x^2 ${b < 0 ? '-' : '+'} ${Math.abs(b)}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}`, f: (x) => a * x * x + b * x + c })
      }
      {
        const [k, m, c] = [R.nz(-9, 9), R.nz(-5, 5), R.int(-9, 9)]
        cases.push({ text: `f(x) = ${k}/(${lin(m, c)})`, f: (x) => k / (m * x + c) })
      }
      for (const cs of cases) {
        const r = buildOwnProblem('diffQuotient', 'dq', cs.text)
        note(t, r.ok, r.ok ? undefined : r.reason.code)
        if (!r.ok) continue
        const a = r.instance.answer as { simplified: string; fxh: string }
        for (const [x, h] of [
          [0.7, 0.3],
          [-2.2, 1.1],
          [3.1, -0.4],
          [-0.35, 2.5],
        ] as const) {
          const want = (cs.f(x + h) - cs.f(x)) / h
          if (!Number.isFinite(want) || Math.abs(want) > 1e6) continue
          if (!close(evalApp(a.simplified, { x, h }), want, 1e-8) || !close(evalApp(a.fxh, { x, h }), cs.f(x + h), 1e-8)) {
            wrong.push(`${cs.text}: simplified ${a.simplified}, f(x + h) ${a.fxh} at x = ${x}, h = ${h}`)
            break
          }
        }
      }
    }
    console.log(`difference quotient: ${summary(t)}`)
    expect(wrong).toEqual([])
    expect(t.accepted / t.made).toBeGreaterThan(0.8)
  })
})
