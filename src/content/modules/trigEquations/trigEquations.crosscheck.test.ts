/**
 * Independent numeric check of trigEquations. The equation is read off the sentence, both sides are
 * evaluated with Math at every stored solution, and the special angles that satisfy it are exactly the
 * stored list. The solver in the generator is not asked.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { TrigEquationsAnswer } from '@/content/types'
import { gradeTePart } from './index'

const SEEDS = 300
const TOL = 1e-9
const SLOW = 180_000
const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b))
}

function fnAt(fn: string, deg: number): number {
  const r = (deg * Math.PI) / 180
  if (fn === 'sin') return Math.sin(r)
  if (fn === 'cos') return Math.cos(r)
  return Math.tan(r)
}

function defined(fn: string, deg: number): boolean {
  return !(fn === 'tan' && (deg === 90 || deg === 270))
}

/** "π/6", "5π/6", "π", "2π", "0", "3π/2". */
function angleDeg(token: string): number {
  const s = token.trim().replace(/−/g, '-').replace(/pi/g, 'π')
  if (s === '0') return 0
  const m = /^(-?)(\d*)π(?:\/(\d+))?$/.exec(s)
  if (!m) throw new Error(`angle ${token}`)
  const sign = m[1] === '-' ? -1 : 1
  const coef = m[2] ? Number(m[2]) : 1
  const den = m[3] ? Number(m[3]) : 1
  return (sign * coef * 180) / den
}

function listDegs(text: string): number[] {
  return text.split(',').map((piece) => angleDeg(piece))
}

function sameSet(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  const used = new Set<number>()
  return a.every((x) => {
    const i = b.findIndex((y, k) => !used.has(k) && Math.abs(x - y) < 1e-4)
    if (i < 0) return false
    used.add(i)
    return true
  })
}

interface ConstTerm {
  n: number
  root: number
}

function parseConst(raw: string): ConstTerm {
  const s = raw.replace(/−/g, '-').replace(/\s+/g, '')
  if (s === '' || s === '+') return { n: 0, root: 1 }
  const m = /^([+-]?)(\d*)(√(\d+))?$/.exec(s)
  if (!m || (!m[2] && !m[3])) throw new Error(`term ${raw}`)
  const sign = m[1] === '-' ? -1 : 1
  const coef = m[2] ? Number(m[2]) : 1
  return { n: sign * coef, root: m[4] ? Number(m[4]) : 1 }
}

function parseLinear(statement: string): { fn: string; A: number; B: ConstTerm; C: ConstTerm } {
  const body = statement.replace(/^Solve /, '').replace(/ for x in \[0, 2π\)\.$/, '')
  const [left, right] = body.split(' = ')
  if (!left || right === undefined) throw new Error(statement)
  const head = left.match(/^(\d*)(sin|cos|tan) x(.*)$/)
  if (!head) throw new Error(`left ${left}`)
  return {
    fn: head[2]!,
    A: head[1] ? Number(head[1]) : 1,
    B: parseConst(head[3]!),
    C: parseConst(right),
  }
}

function isolated(row: { A: number; B: ConstTerm; C: ConstTerm }): number {
  if (row.B.root !== row.C.root && row.B.n !== 0 && row.C.n !== 0) throw new Error('mixed radicals')
  const root = row.B.n !== 0 ? row.B.root : row.C.root
  return ((row.C.n - row.B.n) / row.A) * Math.sqrt(root)
}

function parseFactor(statement: string): { fn: string; a: number; b: number; c: number } {
  const satisfies = statement.match(/satisfies (.+)\.$/)
  const makes = statement.match(/that makes (.+) equal to zero\.$/)
  const solveZero = statement.match(/^Solve (.+?), set equal to zero/)
  const solve = statement.match(/^Solve (.+?) for x in/)
  let expr = satisfies?.[1] ?? makes?.[1] ?? solveZero?.[1] ?? solve?.[1] ?? ''
  if (!expr) throw new Error(statement)
  expr = expr.replace(/ = 0$/, '')
  const fn = expr.includes('sin') ? 'sin' : expr.includes('cos') ? 'cos' : 'tan'
  const replaced = expr.replaceAll(`${fn}² x`, ' U2 ').replaceAll(`${fn} x`, ' U ')
  const pieces = replaced
    .replace(/−/g, '-')
    .replace(/-/g, '+-')
    .split('+')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
  const terms: string[] = []
  for (const piece of pieces) {
    const prev = terms.at(-1)
    if ((prev === '-' || prev === '+') && piece !== '-' && piece !== '+') {
      terms.pop()
      terms.push(prev === '-' ? `-${piece}` : piece)
    } else {
      terms.push(piece)
    }
  }
  let a = 0
  let b = 0
  let c = 0
  for (const term of terms) {
    if (term.includes('U2')) {
      const coef = term.replace('U2', '').replace(/\s/g, '')
      a += coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : Number(coef)
    } else if (term.includes('U')) {
      const coef = term.replace('U', '').replace(/\s/g, '')
      b += coef === '' || coef === '+' ? 1 : coef === '-' ? -1 : Number(coef)
    } else {
      c += Number(term.replace(/\s/g, ''))
    }
  }
  if (![a, b, c].every((n) => Number.isFinite(n))) throw new Error(`unparsed ${statement}`)
  return { fn, a, b, c }
}

describe('trigEquations cross-check', () => {
  it('te.linear: every stored solution satisfies the equation, and the list is complete, over 300 seeds', () => {
    const statements = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('trigEquations', 'te.linear', seed)
      if (seed <= 60) statements.add(p.statementText)
      const again = generateProblem('trigEquations', 'te.linear', seed)
      expect(again.id).toBe(p.id)
      if (p.answer.type !== 'trigEquations') throw new Error('kind')
      const a = p.answer as TrigEquationsAnswer
      const row = parseLinear(p.statementText)
      const value = isolated(row)
      const root = row.B.n !== 0 ? row.B.root : row.C.root
      const solutions = a.stages.find((s) => s.id === 'solutions')!
      const got = listDegs(solutions.answerText)
      expect(got.length).toBeGreaterThanOrEqual(2)
      for (const deg of got) {
        const y = fnAt(row.fn, deg)
        const left = row.A * y + row.B.n * Math.sqrt(row.B.root)
        const right = row.C.n * Math.sqrt(root)
        expect(close(left, right), `${p.statementText} at ${deg}`).toBe(true)
        expect(close(y, value)).toBe(true)
      }
      const want = SPECIAL.filter((deg) => defined(row.fn, deg) && close(fnAt(row.fn, deg), value))
      expect(sameSet(got, want), `${p.statementText}: ${got} vs ${want}`).toBe(true)
      const reference = a.stages.find((s) => s.id === 'reference')!
      const ref = row.fn === 'sin' ? Math.asin(Math.abs(value)) : row.fn === 'cos' ? Math.acos(Math.abs(value)) : Math.atan(Math.abs(value))
      expect(close(angleDeg(reference.answerText), (ref * 180) / Math.PI)).toBe(true)
      const flipped = [...got].reverse().map((deg) => solutions.answerText.split(', ').find((token) => Math.abs(angleDeg(token) - deg) < 1e-6)!)
      // The reversed spelling of the same angles is the same answer.
      const reversed = solutions.answerText.split(', ').reverse().join(', ')
      if (reversed !== solutions.answerText) expect(gradeTePart(a, 'solutions', reversed).verdict).toBe('correct')
      expect(flipped).toBeTruthy()
    }
    expect(statements.size).toBeGreaterThanOrEqual(40)
  }, SLOW)

  it('te.factor: the combined list is exactly the special angles that make the polynomial zero, over 300 seeds', () => {
    const statements = new Set<string>()
    let lost = 0
    let nosol = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('trigEquations', 'te.factor', seed)
      if (seed <= 60) statements.add(p.statementText)
      if (p.answer.type !== 'trigEquations') throw new Error('kind')
      const a = p.answer as TrigEquationsAnswer
      const poly = parseFactor(p.statementText)
      const all = a.stages.find((s) => s.id === 'all')!
      const got = listDegs(all.answerText)
      expect(got.length).toBeGreaterThan(0)
      for (const deg of got) {
        const u = fnAt(poly.fn, deg)
        expect(close(poly.a * u * u + poly.b * u + poly.c, 0), `${p.statementText} at ${deg}`).toBe(true)
      }
      const want = SPECIAL.filter((deg) => {
        if (!defined(poly.fn, deg)) return false
        const u = fnAt(poly.fn, deg)
        return close(poly.a * u * u + poly.b * u + poly.c, 0)
      })
      expect(sameSet(got, want), `${p.statementText}: ${got} vs ${want}`).toBe(true)
      const factor = a.stages.find((s) => s.id === 'factor')!
      expect(factor.choices?.find((c) => c.value === 'ok')?.label.startsWith('Divide')).toBe(false)
      if (factor.traps.some((t) => t.id === 'te_lost_solution')) lost++
      if (a.stages.some((s) => s.traps.some((t) => t.id === 'te_no_solution'))) nosol++
      const reversed = all.answerText.split(', ').reverse().join(', ')
      if (reversed !== all.answerText) expect(gradeTePart(a, 'all', reversed).verdict).toBe('correct')
    }
    expect(statements.size).toBeGreaterThanOrEqual(40)
    expect(lost).toBeGreaterThan(0)
    expect(nosol).toBeGreaterThan(0)
  }, SLOW)
})
