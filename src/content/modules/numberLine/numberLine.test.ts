import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content/index'
import { parseStatement } from '@/engine/parse'
import {
  describeSet,
  normalizeSet,
  parseInterval,
  parseSetBuilder,
  ratToNumber,
  setFromRelation,
  setsEqual,
  setToInterval,
} from '@/notation'
import type { Endpoint } from '@/shared/types'
import { HOLE_GAP, NL_MAX, NL_MIN, SEGMENT_GAP } from './read'

const num = (e: Endpoint) => (typeof e === 'object' ? ratToNumber(e) : e === 'inf' ? Infinity : -Infinity)

describe('numberLine/nl.read', () => {
  it('answer-only instance shape, progress and nextStep', () => {
    const mod = getModule('numberLine')
    expect(mod.order).toBe(1)
    const p = generateProblem('numberLine', 'nl.read', 42)
    expect(p.kind).toBe('numberLine')
    expect(p.start).toBeNull()
    expect(p.canonical).toEqual([])
    expect(p.instructions).toBe('Write this set in interval notation AND set-builder notation.')
    expect(p.answer.type).toBe('set')
    if (p.answer.type === 'set') {
      expect(p.answer.requireInterval).toBe(true)
      expect(p.answer.requireSetBuilder).toBe(true)
    }
    expect(p.graph.kind).toBe('numberLine')
    expect(p.graph.set).toBeDefined()
    expect(mod.progress(p, null, false)).toEqual({
      stage: 0,
      total: 1,
      label: 'write both notations',
      anchorIndex: -1,
      path: 'none',
    })
    expect(mod.nextStep(p, null, false)).toBeNull()
    expect(p.calc.ti84.length).toBeGreaterThan(0)
    expect(p.calc.nspire.length).toBeGreaterThan(0)
    for (const id of ['brackets', 'infinity', 'point', 'union']) {
      expect(mod.ruleCards.map((c) => c.id)).toContain(id)
    }
  })

  it('60 seeds: CG-06 generator constraints, normalized sets, round trips, describeSet', () => {
    const shapes = new Set<string>()
    for (let n = 1; n <= 60; n++) {
      const p = generateProblem('numberLine', 'nl.read', n * 7457 + 23)
      expect(p.answer.type).toBe('set')
      if (p.answer.type !== 'set') continue
      const set = p.answer.set
      shapes.add(String(p.params.shape))
      const total = set.pieces.length + set.points.length
      expect(total).toBeGreaterThanOrEqual(1)
      expect(total).toBeLessThanOrEqual(3)
      expect(set.points.length).toBeLessThanOrEqual(1)
      expect(set.pieces.filter((pc) => pc.lo === '-inf').length).toBeLessThanOrEqual(1)
      expect(set.pieces.filter((pc) => pc.hi === 'inf').length).toBeLessThanOrEqual(1)
      // Integer critical values in [−8, 8]; segments ≥ 2 wide; ≥ 3 across each gap.
      const comps = [
        ...set.pieces.map((pc) => ({ lo: num(pc.lo), hi: num(pc.hi) })),
        ...set.points.map((pt) => ({ lo: ratToNumber(pt), hi: ratToNumber(pt) })),
      ].sort((a, b) => a.lo - b.lo)
      for (const c of comps) {
        for (const v of [c.lo, c.hi]) {
          if (!Number.isFinite(v)) continue
          expect(Number.isInteger(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(NL_MIN)
          expect(v).toBeLessThanOrEqual(NL_MAX)
        }
        if (Number.isFinite(c.lo) && Number.isFinite(c.hi) && c.lo !== c.hi) {
          expect(c.hi - c.lo).toBeGreaterThanOrEqual(SEGMENT_GAP)
        }
      }
      for (let i = 1; i < comps.length; i++) {
        expect(comps[i]!.lo - comps[i - 1]!.hi, p.answer.interval).toBeGreaterThanOrEqual(HOLE_GAP)
      }
      // Normalized: normalizing again changes nothing (structurally).
      expect(normalizeSet(set)).toEqual(set)
      // Round trips through both printers and the statement predicate.
      const iv = parseInterval(setToInterval(set))
      expect(iv.ok, p.answer.interval).toBe(true)
      if (iv.ok) expect(setsEqual(iv.set, set)).toBe(true)
      expect(p.answer.interval).toBe(setToInterval(set))
      const sb = parseSetBuilder(p.answer.setBuilder)
      expect(sb.ok, p.answer.setBuilder).toBe(true)
      if (sb.ok) expect(setsEqual(sb.set, set)).toBe(true)
      const fromPredicate = setFromRelation(p.statementText)
      expect(fromPredicate, p.statementText).not.toBeNull()
      if (fromPredicate) expect(setsEqual(fromPredicate, set)).toBe(true)
      expect(parseStatement(p.statementText).ok, p.statementText).toBe(true)
      // Screen-reader text is non-empty and mentions every critical value.
      const text = describeSet(set)
      expect(text.length).toBeGreaterThan(0)
      for (const c of comps) {
        for (const v of [c.lo, c.hi]) if (Number.isFinite(v)) expect(text).toContain(String(v))
      }
      // Notation rules the cards teach: ∞ never bracketed, a point prints as {a}.
      expect(p.answer.interval).not.toMatch(/\[-inf|inf\]/)
      if (set.points.length) expect(p.answer.interval).toMatch(/\{-?\d+\}/)
    }
    // Variety: single, double and triple component layouts all occur, with points and rays.
    const lengths = new Set(Array.from(shapes).map((s) => s.length))
    expect(lengths).toEqual(new Set([1, 2, 3]))
    expect(Array.from(shapes).some((s) => s.includes('P'))).toBe(true)
    expect(Array.from(shapes).some((s) => s.includes('L'))).toBe(true)
    expect(Array.from(shapes).some((s) => s.includes('R'))).toBe(true)
  })

  it('is deterministic per seed', () => {
    const a = generateProblem('numberLine', 'nl.read', 777)
    const b = generateProblem('numberLine', 'nl.read', 777)
    expect(a).toEqual(b)
    expect(a.id).toBe(`numberLine/nl.read@1/${(777).toString(36)}`)
  })
})
