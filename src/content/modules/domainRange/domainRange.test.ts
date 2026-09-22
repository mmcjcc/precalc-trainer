import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import type { ProblemInstance } from '@/content/types'
import {
  domainMistakes,
  domainOf,
  ERROR_PATTERNS,
  FUNCTION_MISTAKE_KINDS,
  gradeDomain,
  gradeRange,
  rangeMistakes,
  rangeOf,
  type FunctionGrade,
  type FunctionMistakeKind,
} from '@/engine'
import { FN_PATTERN } from './patterns'

const SEEDS = 300

function dr(template: 'dr.domain' | 'dr.range', seed: number): ProblemInstance {
  return generateProblem('domainRange', template, seed)
}

function ans(p: ProblemInstance) {
  if (p.answer.type !== 'domainRange') throw new Error(`${p.id} answer type ${p.answer.type}`)
  return p.answer
}

function expectCorrect(grade: (answer: string) => FunctionGrade, interval: string, builder: string) {
  expect(grade(interval).verdict, interval).toBe('correct')
  expect(grade(builder).verdict, builder).toBe('correct')
}

describe('domain and range registration', () => {
  it('sits under precalculus, right after Reading a graph', () => {
    const ids = MODULES.filter((m) => !m.subject).map((m) => m.id)
    expect(ids.indexOf('domainRange')).toBe(ids.indexOf('graphFeatures') + 1)
    const mod = MODULES.find((m) => m.id === 'domainRange')!
    expect(mod.title).toBe('Domain and range')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['dr.domain', 'dr.range'])
  })

  it('registers every function mistake as an fn_ catalog entry', () => {
    for (const kind of FUNCTION_MISTAKE_KINDS) {
      const id = FN_PATTERN[kind]
      expect(id).toBe(`fn_${kind}`)
      const info = ERROR_PATTERNS[id]
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(0)
      expect(info.example).toMatch(/→/)
    }
  })
})

describe('dr.domain over 300 seeds', () => {
  const problems = Array.from({ length: SEEDS }, (_, i) => dr('dr.domain', i + 1))

  it('is deterministic, core-supported, and the canonical set grades correct', () => {
    for (const p of problems) {
      expect(JSON.stringify(dr('dr.domain', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.kind).toBe('domainRange')
      expect(p.start).toBeNull()
      expect(p.canonical).toEqual([])
      expect(p.calc.ti84).toEqual([])
      expect(p.calc.nspire).toEqual([])
      expect(p.graph.kind).toBe('function')
      expect(p.graph.f).toBe(a.f)
      const dom = domainOf(a.f)
      expect(dom, a.f).not.toBeNull()
      if (!dom) continue
      expect(dom.interval).toBe(a.interval)
      expect(gradeDomain(a.f, dom.set).verdict).toBe('correct')
      expectCorrect((text) => gradeDomain(a.f, text), a.interval, a.builder)
      expect(a.reveal).toEqual(dom.explanation)
      expect(a.reveal.length).toBeGreaterThan(0)
    }
  }, 60_000)

  it('hits every domain trap, including the textbook examples', () => {
    const traps = new Set(problems.map((p) => ans(p).trap))
    expect([...traps].sort()).toEqual([
      'cube-root',
      'denominator',
      'factored-denominator',
      'negative-under-root',
      'polynomial',
      'root-and-denominator',
      'root-in-denominator',
      'square-root',
    ])
    const fs = problems.map((p) => ans(p).f)
    expect(fs.some((f) => f === 'sqrt(x + 2)/(x - 3)')).toBe(true)
    expect(fs.some((f) => f === '1/(sqrt(x - 1))')).toBe(true)
    expect(fs.some((f) => f === 'sqrt(-2x + 6)')).toBe(true)
    expect(fs.some((f) => f === '1/(x^2 - 9)')).toBe(true)
    expect(fs.some((f) => f.startsWith('cbrt('))).toBe(true)
    for (const p of problems) {
      const a = ans(p)
      const dom = domainOf(a.f)!
      if (a.trap === 'denominator') {
        expect(a.f.includes('/'), a.f).toBe(true)
        expect(a.f.includes('sqrt'), a.f).toBe(false)
        expect(dom.interval).not.toBe('(-inf, inf)')
      }
      if (a.trap === 'square-root') {
        expect(a.f).toMatch(/sqrt\([^)]+\)/)
        expect(a.f.includes('/')).toBe(false)
        expect(a.f).not.toMatch(/sqrt\(-/)
      }
      if (a.trap === 'root-and-denominator') {
        expect(a.f).toMatch(/sqrt\([^)]+\)\//)
        expect(a.f).not.toMatch(/\/sqrt\(/)
      }
      if (a.trap === 'root-in-denominator') expect(a.f).toMatch(/\/\(sqrt\(/)
      if (a.trap === 'negative-under-root') expect(a.f).toMatch(/sqrt\(-/)
      if (a.trap === 'cube-root') {
        expect(a.f).toMatch(/cbrt\(/)
        expect(dom.interval).toBe('(-inf, inf)')
      }
      if (a.trap === 'polynomial') {
        expect(a.f).not.toMatch(/sqrt|cbrt|abs|\//)
        expect(dom.interval).toBe('(-inf, inf)')
      }
      if (a.trap === 'factored-denominator') {
        expect(a.f).toMatch(/x\^2/)
        expect(dom.set.pieces.length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('every domain mistake is what a realistic wrong answer grades as', () => {
    const seen = new Set<FunctionMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      const candidates = domainMistakes(a.f)
      expect(candidates, a.f).not.toBeNull()
      for (const c of candidates ?? []) {
        const g = gradeDomain(a.f, c.interval)
        expect(g.verdict, `${a.f} ${c.kind} ${c.interval}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          expect(g.witness.length).toBeGreaterThan(0)
          seen.add(c.kind)
        }
      }
    }
    for (const kind of FUNCTION_MISTAKE_KINDS) {
      if (!kind.startsWith('domain_')) continue
      expect(seen.has(kind), kind).toBe(true)
    }
  }, 60_000)
})

describe('dr.range over 300 seeds', () => {
  const problems = Array.from({ length: SEEDS }, (_, i) => dr('dr.range', i + 1))

  it('is deterministic, core-supported, and the canonical set grades correct', () => {
    for (const p of problems) {
      expect(JSON.stringify(dr('dr.range', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.graph.kind).toBe('function')
      expect(p.calc.ti84).toEqual([])
      const range = rangeOf(a.f)
      expect(range, a.f).not.toBeNull()
      if (!range) continue
      expect(range.family).toBe(a.family)
      expect(range.interval).toBe(a.interval)
      expect(gradeRange(a.f, range.set).verdict).toBe('correct')
      expectCorrect((text) => gradeRange(a.f, text), a.interval, a.builder)
      expect(a.builder.startsWith('{y |'), a.builder).toBe(true)
      expect(a.reveal).toEqual(range.explanation)
    }
  }, 60_000)

  it('covers every range family, both parabola directions, and a negative root', () => {
    const byTrap = new Map<string, string[]>()
    for (const p of problems) {
      const a = ans(p)
      const list = byTrap.get(a.trap) ?? []
      list.push(a.f)
      byTrap.set(a.trap, list)
    }
    expect([...byTrap.keys()].sort()).toEqual([
      'abs-down',
      'abs-up',
      'cube-root',
      'linear',
      'quadratic-down',
      'quadratic-up',
      'reciprocal',
      'sqrt-down',
      'sqrt-up',
    ])
    const family = (trap: string) => rangeOf(byTrap.get(trap)![0]!)!.family
    expect(family('linear')).toBe('linear')
    expect(family('quadratic-up')).toBe('quadratic')
    expect(family('quadratic-down')).toBe('quadratic')
    expect(family('sqrt-up')).toBe('even_root')
    expect(family('sqrt-down')).toBe('even_root')
    expect(family('abs-up')).toBe('absolute_value')
    expect(family('abs-down')).toBe('absolute_value')
    expect(family('reciprocal')).toBe('reciprocal')
    expect(family('cube-root')).toBe('odd_root')
    for (const f of byTrap.get('quadratic-up')!) expect(f.startsWith('-'), f).toBe(false)
    for (const f of byTrap.get('quadratic-down')!) expect(f.startsWith('-'), f).toBe(true)
    for (const f of byTrap.get('sqrt-down')!) expect(f.startsWith('-'), f).toBe(true)
    for (const f of byTrap.get('abs-down')!) expect(f.startsWith('-'), f).toBe(true)
    expect(byTrap.get('sqrt-down')!.includes('-2sqrt(x + 1) + 5')).toBe(true)
    expect(byTrap.get('reciprocal')!.includes('3/(x - 2) + 1')).toBe(true)
  })

  it('every range mistake is what a realistic wrong answer grades as', () => {
    const seen = new Set<FunctionMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      for (const c of rangeMistakes(a.f) ?? []) {
        const g = gradeRange(a.f, c.interval)
        expect(g.verdict, `${a.f} ${c.kind}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          expect(g.witness.length).toBeGreaterThan(0)
          seen.add(c.kind)
        }
      }
    }
    expect(seen.has('range_gave_domain')).toBe(true)
    expect(seen.has('range_reflection_ignored')).toBe(true)
    expect(seen.has('range_included_asymptote')).toBe(true)
  }, 60_000)
})
