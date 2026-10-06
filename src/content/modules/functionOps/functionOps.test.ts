import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { dataFromAnswer } from './generate'
import { gradeFunctionOps, OP_PRIORITY, opsSlips, uniqueSlips } from './ops'

const SEEDS = 300
const LOOP = 120_000

const BANNED = [/undefined/i, /trap/, /inside out/i, /distribut/i, /parenthes/i, /x-axis/i, /cross term/i, /wrong/i]

const TABLE_TRAPS = [
  'op_wrong_function',
  'op_difference_reversed',
  'op_quotient_flipped',
  'op_order_reversed',
  'op_product_for_composition',
  'op_composition_for_product',
  'op_undefined_missed',
]

const GRAPH_TRAPS = ['op_sign_flipped', ...TABLE_TRAPS.filter((id) => id !== 'op_undefined_missed'), 'op_undefined_missed']

const FORMULA_TRAPS = [
  'op_wrong_function',
  'op_difference_reversed',
  'op_quotient_flipped',
  'op_order_reversed',
  'op_product_for_composition',
  'op_composition_for_product',
  'op_minus_not_distributed',
  'op_inner_not_squared',
]

function list(template: string): ProblemInstance[] {
  return Array.from({ length: SEEDS }, (_, i) => generateProblem('functionOps', template, i + 1))
}

function ans(p: ProblemInstance) {
  if (p.answer.type !== 'functionOps') throw new Error(`${p.id} answer type ${p.answer.type}`)
  return p.answer
}

function officialOf(text: string, formula: boolean): number | string | undefined {
  if (text === 'undefined') return undefined
  if (formula) return text
  return Number(text)
}

describe('functionOps registration', () => {
  it('sits under precalculus, right after Composition', () => {
    const ids = MODULES.filter((m) => !m.subject).map((m) => m.id)
    expect(ids.indexOf('functionOps')).toBe(ids.indexOf('composition') + 1)
    const mod = MODULES.find((m) => m.id === 'functionOps')!
    expect(mod.title).toBe('Operations with functions')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['ops.table', 'ops.graph', 'ops.formula'])
  })

  it('registers every op_ id in the catalog, with a wrong → right example', () => {
    for (const id of OP_PRIORITY) {
      const info = ERROR_PATTERNS[id]
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(20)
      expect(info.example).toContain('→')
    }
  })
})

function checkSeeds(template: string, problems: ProblemInstance[], traps: readonly string[]) {
  const seen = new Set<string>()
  for (const p of problems) {
    expect(JSON.stringify(generateProblem('functionOps', template, p.seed))).toBe(JSON.stringify(p))
    const a = ans(p)
    expect(p.kind).toBe('functionOps')
    expect(p.moduleId).toBe('functionOps')
    expect(p.instructions).toBe(a.prompt)
    expect(p.canonical).toEqual([])
    expect(p.calc).toEqual({ ti84: [], nspire: [] })
    expect(p.params.trap).toBe(a.trap)
    expect(a.answerText).not.toBe(a.trapAnswer)
    expect(a.reveal.length).toBeGreaterThan(0)
    for (const re of BANNED) {
      expect(a.prompt, p.id).not.toMatch(re)
      expect(p.instructions, p.id).not.toMatch(re)
    }
    for (const line of a.reveal) {
      expect(a.prompt.includes(line), p.id).toBe(false)
      expect(p.instructions.includes(line), p.id).toBe(false)
    }
    const data = dataFromAnswer(a)
    expect(gradeFunctionOps(data, a.answerText), p.id).toMatchObject({ verdict: 'correct' })
    expect(gradeFunctionOps(data, a.trapAnswer), p.id).toMatchObject({ verdict: 'mistake', mistake: a.trap })
    if (a.answerText !== 'undefined') {
      const typed = gradeFunctionOps(data, 'undefined')
      expect(typed.verdict, p.id).toBe('wrong')
    }
    const slips = opsSlips(data)
    const unique = uniqueSlips(slips, officialOf(a.answerText, a.question === 'formula'), a.answerText === 'undefined')
    expect(unique.some((s) => s.id === a.trap), `${p.id} trap ${a.trap}`).toBe(true)
    seen.add(a.trap)
  }
  for (const id of traps) expect(seen.has(id), id).toBe(true)
}

describe('ops.table over 300 seeds', () => {
  const problems = list('ops.table')

  it('is deterministic, checks its own answers, and promises a real trap', () => {
    checkSeeds('ops.table', problems, TABLE_TRAPS)
    for (const p of problems) {
      const a = ans(p)
      expect(p.graph).toEqual({ kind: 'none' })
      expect(a.question).toBe('table')
      expect(a.xs).toHaveLength(8)
      expect(new Set(a.xs).size).toBe(8)
    }
  }, LOOP)
})

describe('ops.graph over 300 seeds', () => {
  const problems = list('ops.graph')

  it('is deterministic, checks its own answers, and promises a real trap', () => {
    checkSeeds('ops.graph', problems, GRAPH_TRAPS)
    let partial = 0
    for (const p of problems) {
      const a = ans(p)
      expect(a.question).toBe('graph')
      expect(p.graph.kind).toBe('function')
      expect(p.graph.xDomain).toEqual([-5, 5])
      expect(p.graph.yDomain).toEqual([-6, 6])
      expect(p.graph.endLabel).toBe('f')
      expect(p.graph.gEndLabel).toBe('g')
      const curves = [a.fPts!, a.gPts!]
      for (const pts of curves) {
        expect(pts.length).toBeGreaterThan(1)
        for (let i = 0; i < pts.length - 1; i++) {
          const dx = pts[i + 1]!.x - pts[i]!.x
          const dy = pts[i + 1]!.y - pts[i]!.y
          expect(dx).toBeGreaterThan(0)
          // A negative multiple leaves a remainder of -0, which is still an integer slope.
          expect(dy % dx === 0, p.id).toBe(true)
        }
      }
      const f = a.fPts!
      const g = a.gPts!
      const fPartial = f[0]!.x > -5 || f[f.length - 1]!.x < 5
      const gPartial = g[0]!.x > -5 || g[g.length - 1]!.x < 5
      if (fPartial || gPartial) partial++
      if (a.trap === 'op_undefined_missed') expect(fPartial || gPartial, p.id).toBe(true)
    }
    expect(partial).toBeGreaterThanOrEqual(SEEDS / 2)
  }, LOOP)
})

describe('ops.formula over 300 seeds', () => {
  const problems = list('ops.formula')

  it('is deterministic, checks its own answers, and promises a real trap', () => {
    checkSeeds('ops.formula', problems, FORMULA_TRAPS)
    for (const p of problems) {
      const a = ans(p)
      expect(p.graph).toEqual({ kind: 'none' })
      expect(a.question).toBe('formula')
      expect(a.at).toBe('x')
      expect(a.f!.includes(a.answerText), p.id).toBe(false)
      expect(a.g!.includes(a.answerText), p.id).toBe(false)
      expect(a.prompt.includes(a.answerText), p.id).toBe(false)
    }
  }, LOOP)
})
