import { describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import type { ProblemInstance } from '@/content/types'
import {
  averageRateMistakes,
  averageRateOfChange,
  evaluatePiecewise,
  gradeAverageRate,
  gradePiecewiseValue,
  piecewiseProblem,
  toRational,
  type PiecewisePiece,
} from '@/engine'
import type { TransformMistakeKind } from '@/engine'

const SEEDS = 300

function list(template: string): ProblemInstance[] {
  return Array.from({ length: SEEDS }, (_, i) => generateProblem('piecewiseRate', template, i + 1))
}

function ans(p: ProblemInstance) {
  if (p.answer.type !== 'piecewiseRate') throw new Error(`${p.id} answer type ${p.answer.type}`)
  return p.answer
}

function piecesOf(p: ProblemInstance): PiecewisePiece[] {
  const a = ans(p)
  return (a.pieces ?? []).map((piece) => ({
    formula: piece.formula,
    interval: {
      lo: piece.lo === '-inf' ? '-inf' : toRational(piece.lo)!,
      hi: piece.hi === 'inf' ? 'inf' : toRational(piece.hi)!,
      loClosed: piece.loClosed,
      hiClosed: piece.hiClosed,
    },
  }))
}

describe('piecewise and rate registration', () => {
  it('sits under precalculus, right after Transformations', () => {
    const ids = MODULES.filter((m) => !m.subject).map((m) => m.id)
    expect(ids.indexOf('piecewiseRate')).toBe(ids.indexOf('transformations') + 1)
    const mod = MODULES.find((m) => m.id === 'piecewiseRate')!
    expect(mod.title).toBe('Piecewise functions and rate of change')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['pw.evaluate', 'arc.rate'])
    expect(mod.ruleCards.map((c) => c.title)).toEqual(['A boundary belongs to ≤', 'Average rate of change'])
  })
})

describe('pw.evaluate over 300 seeds', () => {
  const problems = list('pw.evaluate')

  it('is deterministic, core-supported, and the canonical value grades correct', () => {
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'pw.evaluate', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.kind).toBe('piecewiseRate')
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc.ti84).toEqual([])
      expect(p.calc.nspire).toEqual([])
      expect(p.start).toBeNull()
      const pieces = piecesOf(p)
      expect(pieces.length === 2 || pieces.length === 3).toBe(true)
      expect(piecewiseProblem(pieces), a.trap).toBeNull()
      const ev = evaluatePiecewise(pieces, a.x!)
      expect(ev, a.x).not.toBeNull()
      expect(gradePiecewiseValue(pieces, a.x!, a.valueText!).verdict).toBe('correct')
      expect(a.reveal).toEqual(ev!.steps)
      for (const piece of a.pieces ?? []) {
        expect(piece.formula.length).toBeGreaterThan(0)
        expect(piece.condition.length).toBeGreaterThan(0)
      }
    }
  }, 60_000)

  it('includes a boundary on each side, an interior point, and a point outside every piece', () => {
    const traps = new Set(problems.map((p) => ans(p).trap))
    expect(traps.has('boundary-leq')).toBe(true)
    expect(traps.has('boundary-lt')).toBe(true)
    expect(traps.has('inside')).toBe(true)
    expect(traps.has('outside')).toBe(true)
    const conditions = problems.flatMap((p) => ans(p).pieces?.map((piece) => piece.condition) ?? [])
    expect(conditions.some((c) => c.includes('<') && !c.includes('='))).toBe(true)
    expect(conditions.some((c) => c.includes('<='))).toBe(true)
    const outside = problems.filter((p) => ans(p).trap === 'outside')
    expect(outside.every((p) => ans(p).valueText === 'undefined')).toBe(true)
    const inside = problems.filter((p) => ans(p).trap === 'inside')
    expect(inside.every((p) => ans(p).valueText !== 'undefined')).toBe(true)
  })

  it('every piecewise mistake is reachable from a realistic wrong answer', () => {
    const seen = new Set<TransformMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      const pieces = piecesOf(p)
      const x = a.x!
      if (a.valueText === 'undefined') {
        const g = gradePiecewiseValue(pieces, x, '0')
        if (g.verdict === 'mistake') seen.add(g.mistake)
        continue
      }
      const undef = gradePiecewiseValue(pieces, x, 'undefined')
      if (undef.verdict === 'mistake') seen.add(undef.mistake)
      for (const piece of a.pieces ?? []) {
        const ev = evaluatePiecewise([{ formula: piece.formula, interval: { lo: '-inf', hi: 'inf', loClosed: false, hiClosed: false } }], x)
        if (!ev || !ev.defined || ev.text === a.valueText) continue
        const g = gradePiecewiseValue(pieces, x, ev.text)
        if (g.verdict === 'mistake') seen.add(g.mistake)
      }
    }
    for (const kind of ['piecewise_boundary', 'piecewise_wrong_piece', 'piecewise_value_where_undefined', 'piecewise_undefined_where_defined'] as const) {
      expect(seen.has(kind), kind).toBe(true)
    }
  }, 60_000)
})

describe('arc.rate over 300 seeds', () => {
  const problems = list('arc.rate')

  it('is deterministic, core-supported, and the canonical rate grades correct', () => {
    const families = new Set<string>()
    let integers = 0
    let fractions = 0
    for (const p of problems) {
      expect(JSON.stringify(generateProblem('piecewiseRate', 'arc.rate', p.seed))).toBe(JSON.stringify(p))
      const a = ans(p)
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc.ti84).toEqual([])
      const rate = averageRateOfChange(a.f!, a.a!, a.b!)
      expect(rate, a.f).not.toBeNull()
      expect(rate!.text).toBe(a.rateText)
      expect(gradeAverageRate(a.f!, a.a!, a.b!, a.rateText!).verdict).toBe('correct')
      expect(a.reveal).toEqual(rate!.steps)
      const mistakes = averageRateMistakes(a.f!, a.a!, a.b!)
      expect(mistakes!.every((c) => c.shadows.length === 0)).toBe(true)
      families.add(a.trap.split('-')[0]!)
      if (a.trap.endsWith('integer')) integers++
      if (a.trap.endsWith('fraction')) fractions++
    }
    expect([...families].sort()).toEqual(['linear', 'quadratic', 'rational'])
    expect(integers).toBeGreaterThan(0)
    expect(fractions).toBeGreaterThan(0)
  }, 60_000)

  it('every rate mistake is what a realistic wrong answer grades as', () => {
    const seen = new Set<TransformMistakeKind>()
    for (const p of problems) {
      const a = ans(p)
      for (const c of averageRateMistakes(a.f!, a.a!, a.b!) ?? []) {
        const g = gradeAverageRate(a.f!, a.a!, a.b!, c.text)
        expect(g.verdict, `${a.f} ${c.kind} ${c.text}`).toBe('mistake')
        if (g.verdict === 'mistake') {
          expect(g.mistake).toBe(c.kind)
          expect(g.witness.length).toBeGreaterThan(0)
          seen.add(c.kind)
        }
      }
    }
    for (const kind of ['rate_sign_flipped', 'rate_no_division', 'rate_inverted', 'rate_divided_by_b'] as const) {
      expect(seen.has(kind), kind).toBe(true)
    }
  }, 60_000)
})
