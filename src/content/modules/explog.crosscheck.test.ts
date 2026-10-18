/**
 * Independent re-solve of precalculus Unit 3, first half (written by the reviewer, not the generator's
 * author). Every problem is solved again from its own text without the logs core's solver: values with
 * Math.log, equations by a sign-change scan and bisection over a wide range inside the domain (where every
 * log is defined), expansions and condensations by evaluating both forms at random positive points. Only
 * the app's parser is shared, to read the text. The stored answers must agree, every equal form must
 * grade right, and an answer with one of two solutions must never be named as a slip it only partly fits.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { gradeLogEquation, gradeLogValue } from '@/engine'
import { evalNode } from '@/engine/math'
import { parseExpression, parseStatement, singleRelation } from '@/engine/parse'
import type { ModuleId, VarName } from '@/shared/types'

const SEEDS = Number(process.env.EXPLOG_SEEDS ?? 300)
const HEAVY = 240000

function answerOf(module: string, template: string, seed: number): Record<string, unknown> {
  return generateProblem(module as ModuleId, template, seed).answer as unknown as Record<string, unknown>
}

/** The value of a constant expression in app syntax ("log(13)/log(3)", "e^2 - 3", "4/3"). */
function value(text: string): number {
  const p = parseExpression(text.replace(/^\s*x\s*=\s*/, ''), ['x'])
  if (!p.ok) throw new Error(`unreadable value “${text}”: ${p.error.message}`)
  const v = evalNode(p.node, {})
  if (v === 'undef') throw new Error(`undefined value “${text}”`)
  return v
}

/** "x = 3 or x = -1", "no solution" as a sorted list of numbers. */
function solutionList(text: string): number[] {
  if (/^no solution$/i.test(text.trim())) return []
  return text
    .split(/\s+or\s+/)
    .map((t) => value(t))
    .sort((a, b) => a - b)
}

/** Every real solution of a one-variable equation inside its domain, by scanning and bisecting. */
function solveNumerically(equation: string): number[] {
  const p = parseStatement(equation, ['x'] as VarName[])
  if (!p.ok) throw new Error(`unreadable equation ${equation}`)
  const rel = singleRelation(p.statement)
  if (!rel) throw new Error(`not one relation: ${equation}`)
  const f = (x: number): number | null => {
    const l = evalNode(rel.lhs, { x })
    const r = evalNode(rel.rhs, { x })
    if (l === 'undef' || r === 'undef' || !Number.isFinite(l) || !Number.isFinite(r)) return null
    // Far out, two powers that have both underflowed to 0 say nothing about a root.
    if (Math.abs(x) > 50 && Math.abs(l) < 1e-250 && Math.abs(r) < 1e-250) return null
    return l - r
  }
  // Fine near 0 (roots like ln 2 and ln 3 sit 0.4 apart), coarser further out, geometric past 300.
  const grid: number[] = []
  for (let i = -3000; i <= 3000; i++) grid.push(i / 50)
  for (let x = 60.25; x <= 300; x += 0.25) grid.push(x, -x)
  for (let x = 300; x <= 20000; x *= 1.01) grid.push(x, -x)
  grid.sort((a, b) => a - b)
  const roots: number[] = []
  const add = (r: number) => {
    if (!roots.some((s) => Math.abs(s - r) <= 1e-6 * Math.max(1, Math.abs(r)))) roots.push(r)
  }
  let px = grid[0]!
  let pf = f(px)
  for (let i = 1; i < grid.length; i++) {
    const x = grid[i]!
    const fx = f(x)
    // An exact hit on the grid (log_3(81) − 4 is exactly 0). Underflowed sides were dropped above.
    if (fx === 0) add(x)
    else if (fx !== null && pf !== null && pf !== 0 && Math.sign(fx) !== Math.sign(pf)) {
      let a = px
      let b = x
      let fa = pf
      for (let k = 0; k < 200; k++) {
        const m = (a + b) / 2
        const fm = f(m)
        if (fm === null) break
        if (Math.sign(fm) === Math.sign(fa)) {
          a = m
          fa = fm
        } else b = m
      }
      const r = (a + b) / 2
      const fr = f(r)
      // A sign change across a pole is not a root.
      if (fr !== null && Math.abs(fr) < 1e-6 * Math.max(1, Math.abs(f(px) ?? 1))) add(r)
    }
    px = x
    pf = fx
  }
  return roots.sort((a, b) => a - b)
}

const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))
const sameList = (a: number[], b: number[], tol = 1e-6) => a.length === b.length && a.every((t, i) => close(t, b[i]!, tol))

function sweep(template: string, module: string, check: (where: string, a: Record<string, unknown>) => string[]): void {
  const bad: string[] = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    const where = `${template}/${seed}`
    try {
      bad.push(...check(where, answerOf(module, template, seed)))
    } catch (e) {
      bad.push(`${where}: ${(e as Error).message}`)
    }
  }
  expect(bad.slice(0, 12), `${bad.length} problems`).toEqual([])
}

describe('Unit 3 (exponentials and logarithms) solved again from the wording', () => {
  it('lf.value: Math.log gives the stored exact value, in lowest terms, at textbook sizes', () => {
    sweep('lf.value', 'logForms', (where, a) => {
      const bad: string[] = []
      const problem = String(a.problem)
      const ans = String(a.answerText)
      const mine = value(problem)
      if (!close(value(ans), mine, 1e-9)) bad.push(`${where}: ${problem} is ${mine}, stored ${ans}`)
      const frac = /^(-?\d+)\/(\d+)$/.exec(ans)
      if (frac) {
        const g = (x: number, y: number): number => (y ? g(y, x % y) : x)
        if (g(Math.abs(Number(frac[1])), Number(frac[2])) !== 1) bad.push(`${where}: ${ans} is not in lowest terms`)
      }
      for (const n of problem.match(/\d+/g) ?? []) if (Number(n) > 1_000_000) bad.push(`${where}: ${n} is not a textbook size`)
      // 1.5 for 3/2: an equal decimal is right.
      if (!Number.isInteger(mine) && Number.isInteger(mine * 4)) {
        const g = gradeLogValue(problem, String(mine))
        if (g.verdict !== 'correct') bad.push(`${where}: ${mine} graded ${g.verdict}`)
      }
      return bad
    })
  }, HEAVY)

  it('lf.convert: the other form has the same base, exponent and result', () => {
    sweep('lf.convert', 'logForms', (where, a) => {
      const given = String(a.problem)
      const ans = String(a.answerText)
      // Both are true statements about the same numbers: evaluate each side (x found from the given).
      const parts = (eq: string) => {
        const exp = /^(e|\d+)\^\(?(-?\d*x|-?\d+)\)? = (\d+(?:\.\d+)?)$/.exec(eq)
        if (exp) return { base: exp[1] === 'e' ? Math.E : Number(exp[1]), power: exp[2]!, result: Number(exp[3]) }
        const lg = /^(?:log_(\d+)|log|ln)\((\d+(?:\.\d+)?)\) = (-?\d*x|-?\d+)$/.exec(eq)
        if (lg) return { base: eq.startsWith('ln') ? Math.E : lg[1] ? Number(lg[1]) : 10, power: lg[3]!, result: Number(lg[2]) }
        return null
      }
      const g = parts(given)
      const r = parts(ans)
      if (!g || !r) return [`${where}: unreadable “${given}” → “${ans}”`]
      const sameForm = /^(?:log|ln)/.test(given) === /^(?:log|ln)/.test(ans)
      if (sameForm) return [`${where}: “${ans}” is the same form as “${given}”`]
      if (!close(g.base, r.base) || g.power.replace(/\s/g, '') !== r.power.replace(/\s/g, '') || !close(g.result, r.result)) return [`${where}: “${given}” is not “${ans}”`]
      return []
    })
  }, HEAVY)

  it('lf.decimal: Math.log rounded to the asked places is the stored answer', () => {
    sweep('lf.decimal', 'logForms', (where, a) => {
      const places = Number(a.places)
      const mine = value(String(a.problem)).toFixed(places)
      return mine === String(a.answerText) ? [] : [`${where}: ${a.problem} to ${places} places is ${mine}, stored ${a.answerText}`]
    })
  }, HEAVY)

  for (const template of ['lp.expand', 'lp.condense'] as const) {
    it(`${template}: the finished form equals the start at random positive points and is finished`, () => {
      sweep(template, 'logProperties', (where, a) => {
        const bad: string[] = []
        const vars = (a.vars as VarName[]) ?? ['x', 'y']
        const start = parseExpression(String(a.expr), vars)
        const end = parseExpression(String(a.answerText), vars)
        if (!start.ok || !end.ok) return [`${where}: unreadable`]
        for (let i = 0; i < 12; i++) {
          const scope = Object.fromEntries(vars.map((v, k) => [v, 0.3 + ((i * 7 + k * 3) % 11) * 0.77]))
          const s = evalNode(start.node, scope)
          const e = evalNode(end.node, scope)
          if (s === 'undef' || e === 'undef' || !close(s, e, 1e-9)) {
            bad.push(`${where}: ${a.expr} vs ${a.answerText} at ${JSON.stringify(scope)}`)
            break
          }
        }
        const text = String(a.answerText)
        const logs = text.match(/\b(?:log_\d+|log|ln)\(/g) ?? []
        if (template === 'lp.condense' && logs.length !== 1) bad.push(`${where}: “${text}” is not one logarithm`)
        if (template === 'lp.expand') {
          for (const m of text.matchAll(/\b(?:log_\d+|log|ln)\(([^()]*(?:\([^()]*\))?[^()]*)\)/g)) {
            if (/[*/^]|sqrt|cbrt|\d[a-z]|[a-z]\s*[a-z(]/.test(m[1]!)) bad.push(`${where}: “${m[1]}” inside a log in “${text}” could still be expanded`)
          }
        }
        return bad
      })
    }, HEAVY)
  }

  for (const template of ['ee.exponential', 'ee.logarithmic', 'ee.quadratic'] as const) {
    it(`${template}: a numeric solve inside the domain gives the stored solutions`, () => {
      sweep(template, 'expLogEquations', (where, a) => {
        const bad: string[] = []
        const eq = String(a.equation)
        const mine = solveNumerically(eq)
        const places = a.places as number | undefined
        if (places) {
          if (mine.length !== 1) return [`${where}: ${eq} has ${mine.length} solutions, rounded problem`]
          const r = mine[0]!.toFixed(places)
          if (r !== String(a.answerText)) bad.push(`${where}: ${eq} gives ${r}, stored ${a.answerText}`)
        } else {
          const stored = solutionList(String(a.answerText))
          if (!sameList(stored, mine, 1e-6)) bad.push(`${where}: ${eq} gives ${mine.map((t) => t.toFixed(6)).join(', ') || 'none'}, stored ${a.answerText}`)
        }
        for (const n of eq.match(/\d+(?:\.\d+)?/g) ?? []) if (Number(n) > 20000) bad.push(`${where}: ${n} is not a textbook size`)
        // Every accepted spelling is right, and the trap is not.
        for (const form of (a.accept as string[]) ?? []) {
          const g = gradeLogEquation(eq, form, places ? { decimal: { places } } : {})
          if (g.verdict !== 'correct') bad.push(`${where}: accepted “${form}” graded ${g.verdict}`)
        }
        const trapG = gradeLogEquation(eq, String(a.trapAnswer), places ? { decimal: { places } } : {})
        if (trapG.verdict !== 'mistake' || trapG.mistake !== a.trap) bad.push(`${where}: trap “${a.trapAnswer}” graded ${trapG.verdict}`)
        // One of two solutions alone is a missing solution: only a log equation's negative root
        // thrown out has its own name.
        const roots = String(a.answerText).split(/\s+or\s+/)
        if (!places && roots.length === 2) {
          for (const [kept, dropped] of [
            [roots[0]!, roots[1]!],
            [roots[1]!, roots[0]!],
          ]) {
            const g = gradeLogEquation(eq, kept)
            const ok =
              (g.verdict === 'wrong' && /1 of the 2 solutions/.test(g.message)) ||
              (g.verdict === 'mistake' && g.mistake === 'log_valid_rejected' && value(dropped) < 0 && /\blog|ln/.test(eq))
            if (!ok) bad.push(`${where}: only “${kept}” graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`)
          }
        }
        return bad
      })
    }, HEAVY)
  }
})
