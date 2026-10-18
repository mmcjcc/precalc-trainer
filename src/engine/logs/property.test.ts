/**
 * Seeded cross-checks of the logs core against independent oracles.
 *
 * Every expected value here is computed from the problem's PARAMETERS with plain JavaScript (Math.log,
 * integer and rational arithmetic), never by the code under test:
 *  - 300 exact values log_{m^p}(m^(±q)) = ±q/p (exact rationals), with each slip's value graded as its id;
 *  - 300 exponential equations A·b^(kx + m) + C = D, x = (ln((D − C)/A)/ln b − m)/k, through the solver,
 *    the grader (exact and decimal) and the canonical path line by line;
 *  - 300 log equations log_b(x + p) + log_b(x + q) = r: the candidates are the roots of
 *    (x + p)(x + q) = b^r by the quadratic formula, valid exactly when x + p > 0 and x + q > 0;
 *  - 200 expansions of log_b(x^a y^c / n^d), whose value is (a ln x + c ln y − d ln n)/ln b, and the
 *    power slip (log_b x)^a written by the test itself;
 *  - 200 exponent-rule lines e^(ax + c), (b^x)^k, b^(−kx), each with its slip built by the test.
 */
import { describe, expect, it } from 'vitest'
import type { VarName } from '@/shared/types'
import { evalNode } from '../math'
import { parseExpression } from '../parse'
import { mulberry32 } from '../samples'
import { checkLogRewrite, expandLog } from './rewrite'
import { legalRewrites } from './rules'
import { analyzeLogEquation, gradeLogEquation } from './solve'
import { appText } from './text'
import { checkLogStep } from './step'
import { gradeLogValue, logValueMistakes } from './value'

type Rand = () => number

function int(r: Rand, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1))
}

function pick<T>(r: Rand, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)]!
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x
}

function fracText(n: number, d: number): string {
  const g = gcd(n, d)
  const nn = n / g
  const dd = d / g
  return dd === 1 ? String(nn) : `${nn}/${dd}`
}

function engineValue(text: string, scope: Record<string, number> = {}, vars: VarName[] = ['x', 'y', 'n']): number {
  const p = parseExpression(text, vars)
  if (!p.ok) throw new Error(`${text}: ${p.error.message}`)
  const v = evalNode(p.node, scope)
  if (v === 'undef') throw new Error(`${text} is undefined`)
  return v
}

const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b))

describe('property: exact values of log_{m^p}(m^(±q))', () => {
  it('300 problems: the value is ±q/p exactly; each slip value grades as its own id', { timeout: 120_000 }, () => {
    const r = mulberry32(0x10a5)
    for (let i = 0; i < 300; i++) {
      const m = pick(r, [2, 3, 5, 7, 10])
      const p = int(r, 1, m === 10 ? 2 : 3)
      const q = int(r, 0, m === 10 ? 4 : 4)
      const neg = r() < 0.35 && q > 0
      const base = m ** p
      const arg = neg ? `1/${m ** q}` : String(m ** q)
      const problem = base === 10 ? `log(${arg})` : `log_${base}(${arg})`
      const expected = fracText(neg ? -q : q, p)
      // Independent float check of the oracle itself.
      expect(rel(Math.log(neg ? 1 / m ** q : m ** q) / Math.log(base), (neg ? -q : q) / p)).toBeLessThan(1e-12)
      const g = gradeLogValue(problem, expected)
      expect(g.verdict, `${problem} = ${expected}: ${JSON.stringify(g)}`).toBe('correct')
      for (const c of logValueMistakes(problem)) {
        if (c.values![0] === (neg ? -q : q) / p) throw new Error(`${problem}: candidate ${c.id} equals the answer`)
        const h = gradeLogValue(problem, c.text)
        // A candidate printed as a 12-digit decimal is an approximation: graded exact problems call it not_exact or name it.
        if (/^-?\d+(\/\d+)?$/.test(c.text)) {
          expect(h.verdict === 'mistake' && [c.id, ...c.shadows].includes(h.mistake), `${problem} ← ${c.text} (${c.id}): ${JSON.stringify(h)}`).toBe(true)
        }
      }
    }
  })
})

describe('property: exponential equations A·b^(kx + m) + C = D', () => {
  it('300 equations: solution, exact text, grading and the canonical path', { timeout: 120_000 }, () => {
    const r = mulberry32(0xe4b0)
    let checked = 0
    for (let i = 0; i < 300; i++) {
      const b = pick(r, [2, 3, 5, 10, 'e'] as const)
      const bv = b === 'e' ? Math.E : b
      const A = pick(r, [1, 1, 2, 3, 4])
      const C = pick(r, [0, 0, 1, -2, 5])
      const k = pick(r, [1, 1, 2, 3, -1])
      const m = pick(r, [0, 0, 1, -1, 2])
      const q = pick(r, [3, 5, 6, 7, 11, 12, 20])
      const D = A * q + C
      const xs = k === 1 ? 'x' : k === -1 ? '-x' : `${k}x`
      const u = m === 0 ? xs : `${xs} ${m > 0 ? '+' : '-'} ${Math.abs(m)}`
      const pow = `${b}^(${u})`
      const lhs = `${A === 1 ? '' : `${A} * `}${pow}${C === 0 ? '' : C > 0 ? ` + ${C}` : ` - ${-C}`}`
      const eq = `${lhs} = ${D}`
      const oracle = (Math.log(q) / Math.log(bv) - m) / k
      const a = analyzeLogEquation(eq)!
      expect(a, eq).toBeTruthy()
      expect(a.solutions.length, eq).toBe(1)
      const s = a.solutions[0]!
      expect(rel(s.value, oracle), `${eq}: ${s.value} vs ${oracle}`).toBeLessThan(1e-9)
      // The exact text, read back by the parser, is the same number.
      expect(rel(engineValue(s.text), oracle), `${eq}: ${s.text}`).toBeLessThan(1e-9)
      expect(gradeLogEquation(eq, `x = ${s.text}`).verdict, eq).toBe('correct')
      expect(gradeLogEquation(eq, `x = ${oracle.toFixed(3)}`, { decimal: { places: 3 } }).verdict, eq).toBe('correct')
      // A decimal of an irrational solution is an approximation; a decimal that IS the solution (−0.5) is exact.
      if (Math.abs(oracle - Number(oracle.toFixed(3))) > 1e-12) {
        expect(gradeLogEquation(eq, `x = ${oracle.toFixed(3)}`).verdict, eq).toBe('invalid')
      }
      // The canonical path, line by line against the original.
      const logName = b === 'e' ? 'ln' : 'log'
      const lines = [eq, `${pow} = ${q}`, `(${u}) * ${logName}(${b}) = ${logName}(${q})`, `x = ${s.text}`]
      for (let j = 1; j < lines.length; j++) {
        const res = checkLogStep(lines[j - 1]!, lines[j]!, { original: eq, seed: i })
        expect(res.ok, `${lines[j - 1]} → ${lines[j]}: ${JSON.stringify({ v: res.verdict, p: res.pattern?.id })}`).toBe(true)
      }
      // The one-side slip, built here: the log taken of the left side only. (For base e or 10, u·ln(e) = q IS the
      // line that drops the base, and that earlier id names it.)
      const one = checkLogStep(lines[1]!, `(${u}) * ${logName}(${b}) = ${q}`, { seed: i })
      expect(one.ok, eq).toBe(false)
      expect(one.pattern?.id, eq).toBe(b === 'e' || b === 10 ? 'log_convert_dropped' : 'log_one_side')
      checked++
    }
    expect(checked).toBe(300)
  })
})

describe('property: log equations log_b(x + p) + log_b(x + q) = r', () => {
  it('300 equations: candidates, the extraneous ones, grading and the steps', { timeout: 120_000 }, () => {
    const r = mulberry32(0x1092)
    let withExtraneous = 0
    for (let i = 0; i < 300; i++) {
      const b = pick(r, [2, 3, 10])
      const rr = b === 10 ? 1 : int(r, 1, 3)
      const p = int(r, -6, 6)
      let q = int(r, -6, 6)
      if (q === p) q = p + 1
      const br = b ** rr
      // (x + p)(x + q) = b^r  →  x² + (p + q)x + pq − b^r = 0
      const B = p + q
      const Cc = p * q - br
      const disc = B * B - 4 * Cc
      const roots = disc < 0 ? [] : [(-B - Math.sqrt(disc)) / 2, (-B + Math.sqrt(disc)) / 2]
      const valid = roots.filter((x) => x + p > 0 && x + q > 0)
      const extraneous = roots.filter((x) => !(x + p > 0 && x + q > 0))
      const term = (c: number) => (c === 0 ? 'x' : `x ${c > 0 ? '+' : '-'} ${Math.abs(c)}`)
      const L = b === 10 ? 'log' : `log_${b}`
      const eq = `${L}(${term(p)}) + ${L}(${term(q)}) = ${rr}`
      const a = analyzeLogEquation(eq)!
      expect(a, eq).toBeTruthy()
      expect(a.solutions.map((s) => s.value).length, eq).toBe(valid.length)
      a.solutions.forEach((s, j) => expect(rel(s.value, valid[j]!), eq).toBeLessThan(1e-9))
      expect(a.extraneous.length, eq).toBe(extraneous.length)
      a.extraneous.forEach((e, j) => expect(rel(e.value, extraneous[j]!), eq).toBeLessThan(1e-9))
      // Grading: the right set; with the extraneous kept when there is one.
      const answer = valid.length ? valid.map((x) => `x = ${a.solutions.find((s) => rel(s.value, x) < 1e-9)!.text}`).join(' or ') : 'no solution'
      expect(gradeLogEquation(eq, answer).verdict, `${eq}: ${answer}`).toBe('correct')
      if (extraneous.length && valid.length) {
        withExtraneous++
        const all = [...a.solutions, ...a.extraneous.map((e) => ({ text: e.text }))].map((s) => `x = ${s.text}`).join(' or ')
        const g = gradeLogEquation(eq, all)
        expect(g.verdict === 'mistake' && g.mistake, `${eq}: ${all}`).toBe('log_extraneous_kept')
      }
      // The combining step is legal; it carries the caveat exactly when the method lets in an extraneous root.
      const combined = `${L}((${term(p)})(${term(q)})) = ${rr}`
      const st = checkLogStep(eq, combined, { original: eq, seed: i })
      expect(st.ok, `${eq} → ${combined}`).toBe(true)
      expect(st.caveat === 'extraneous_check', `${eq} → ${combined}`).toBe(extraneous.length > 0)
      // Converting to exponential form is legal; the swapped conversion (written here) is named.
      const conv = checkLogStep(combined, `(${term(p)})(${term(q)}) = ${br}`, { original: eq, seed: i })
      expect(conv.ok, eq).toBe(true)
      // With r = 1 the swapped line 1^b = 1 is the dropped line too (the earlier id names it).
      if (rr !== 1 && b !== rr && rr ** b !== br) {
        const sw = checkLogStep(combined, `(${term(p)})(${term(q)}) = ${rr}^${b}`, { original: eq, seed: i })
        expect(sw.ok, eq).toBe(false)
        expect(sw.pattern?.id, eq).toBe('log_convert_swapped')
      }
    }
    expect(withExtraneous).toBeGreaterThan(30)
  })
})

describe('property: expansions of log_b(x^a · y^c / n^d)', () => {
  it('200 expressions: the expansion has the right value; the power slip is named', { timeout: 120_000 }, () => {
    const r = mulberry32(0x5e9a)
    const vars: VarName[] = ['x', 'y', 'n']
    for (let i = 0; i < 200; i++) {
      const b = pick(r, [2, 3, 5, 10, 'e'] as const)
      const a = int(r, 1, 4)
      const c = int(r, 1, 3)
      const d = int(r, 1, 3)
      const pw = (v: string, k: number) => (k === 1 ? v : `${v}^${k}`)
      const name = b === 'e' ? 'ln' : b === 10 ? 'log' : `log_${b}`
      const expr = `${name}(${pw('x', a)} ${pw('y', c)}/${pw('n', d)})`
      const e = expandLog(expr, vars)!
      expect(e, expr).toBeTruthy()
      const lb = Math.log(b === 'e' ? Math.E : b)
      for (const [x, y, n] of [
        [2, 3, 5],
        [0.5, 7, 1.5],
        [11, 0.2, 4],
      ] as const) {
        const oracle = (a * Math.log(x) + c * Math.log(y) - d * Math.log(n)) / lb
        expect(rel(engineValue(e, { x, y, n }), oracle), `${expr} → ${e}`).toBeLessThan(1e-9)
      }
      expect(checkLogRewrite(expr, e, { vars, assumePositive: true, seed: i }).ok, `${expr} → ${e}`).toBe(true)
      if (a >= 2) {
        // The power left on top of the log, written by the test: (log_b x)^a + c·log_b y − d·log_b n.
        const term = (v: string, k: number) => (k === 1 ? `${name}(${v})` : `${k}${name}(${v})`)
        const slip = `(${name}(x))^${a} + ${term('y', c)} - ${term('n', d)}`
        const res = checkLogRewrite(expr, slip, { vars, assumePositive: true, seed: i })
        expect(res.ok, `${expr} → ${slip}`).toBe(false)
        expect(res.pattern?.id, `${expr} → ${slip}`).toBe('log_power_as_power')
      }
    }
  })
})

describe('property: a right line is never flagged', () => {
  it('200 expressions: every legal rewrite the rules produce is accepted with no pattern', { timeout: 120_000 }, () => {
    const r = mulberry32(0x9a7e)
    const vars: VarName[] = ['x', 'y', 'n']
    let lines = 0
    for (let i = 0; i < 200; i++) {
      const name = pick(r, ['log', 'ln', 'log_2', 'log_3'])
      const coef = pick(r, ['', '2', '5', '(1/3)'])
      const a = int(r, 1, 3)
      const c = int(r, 0, 2)
      const inner = [`${coef}x^${a}`, c ? `y^${c}` : ''].filter(Boolean).join(' ')
      const shape = i % 4
      const prev =
        shape === 0
          ? `${name}(${inner})`
          : shape === 1
            ? `${name}(${inner}/n)`
            : shape === 2
              ? `${int(r, 2, 4)}${name}(x) - ${name}(y)`
              : `${name}(x) + ${name}(y^${int(r, 2, 3)}) + ${name}(${int(r, 2, 9)})`
      const p = parseExpression(prev, vars)
      if (!p.ok) throw new Error(`${prev}: ${p.error.message}`)
      for (const legal of legalRewrites(p.node)) {
        const next = appText(legal.node)
        const res = checkLogRewrite(prev, next, { vars, assumePositive: true, seed: i })
        expect(res.ok, `${prev} → ${next} (${legal.property}): ${JSON.stringify({ v: res.verdict, p: res.pattern?.id })}`).toBe(true)
        expect(res.pattern).toBeUndefined()
        lines++
      }
    }
    expect(lines).toBeGreaterThan(300)
  })
})

describe('property: exponent rules', () => {
  it('200 lines: the right rewrite is accepted and the slip built here is named', { timeout: 120_000 }, () => {
    const r = mulberry32(0x7e57)
    const vars: VarName[] = ['x']
    for (let i = 0; i < 200; i++) {
      const b = pick(r, ['2', '3', 'e', '10', '(1/2)'])
      const k = int(r, 2, 4)
      const c = int(r, 1, 5)
      const kind = i % 3
      let prev: string
      let right: string
      let slip: string
      let id: string
      if (kind === 0) {
        prev = `${b}^(x + ${c})`
        right = `${b}^x * ${b}^${c}`
        slip = `${b}^x + ${b}^${c}`
        id = 'log_exp_sum_split'
      } else if (kind === 1) {
        prev = `(${b}^x)^${k}`
        right = `${b}^(${k}x)`
        slip = `${b}^(x + ${k})`
        id = 'log_exp_power_added'
      } else {
        prev = `${b}^(-${k}x)`
        right = `1/${b}^(${k}x)`
        slip = `-${b}^(${k}x)`
        id = 'log_exp_negative_exponent'
      }
      // Independent value check of the right line.
      const bv = b === 'e' ? Math.E : b === '(1/2)' ? 0.5 : Number(b)
      const x = 0.7
      const oracle = kind === 0 ? bv ** (x + c) : kind === 1 ? (bv ** x) ** k : bv ** (-k * x)
      expect(rel(engineValue(right, { x }, vars), oracle)).toBeLessThan(1e-9)
      expect(checkLogRewrite(prev, right, { vars, seed: i }).ok, `${prev} → ${right}`).toBe(true)
      const res = checkLogRewrite(prev, slip, { vars, seed: i })
      expect(res.ok, `${prev} → ${slip}`).toBe(false)
      expect(res.pattern?.id, `${prev} → ${slip}`).toBe(id)
    }
  })
})
