import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { sameTrigExpr, verifyTrigStep } from '@/engine/trig'
import { trigIdentitiesStepContext } from '@/problem/cardSources'
import { gradeTiPart, TI_RULE_CARDS } from './index'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)

describe('trigIdentities module — 300-seed sweep and self-verification', () => {
  it('rule cards contain required phrases and never use degrees', () => {
    const joined = TI_RULE_CARDS.map((c) => `${c.title}\n${c.body}\n${c.example ?? ''}`).join('\n')
    for (const phrase of [
      'sin²x + cos²x = 1',
      '1 + tan²x = sec²x',
      '1 + cot²x = csc²x',
      '1/sin',
      '1/cos',
      '1/tan',
      'sin x/cos x',
      'cos x/sin x',
    ]) {
      expect(joined).toContain(phrase)
    }
    expect(joined).not.toContain('°')
    expect(joined.toLowerCase()).not.toMatch(/\bdeg(rees?)?\b/)
  })

  it('ti.express: 300 seeds are deterministic, varied across quadrants and pairs, and self-verify parts & traps', () => {
    const statements = new Map<string, number>()
    const quadrantCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    const pairs = new Set<string>()

    for (const seed of SEEDS) {
      const p1 = generateProblem('trigIdentities', 'ti.express', seed)
      const p2 = generateProblem('trigIdentities', 'ti.express', seed)
      expect(p1).toEqual(p2)
      expect(p1.answer.type).toBe('trigIdentities')
      if (p1.answer.type !== 'trigIdentities') continue
      const a = p1.answer
      expect(a.question).toBe('express')
      expect(a.stages).toHaveLength(3)

      statements.set(p1.statementText, (statements.get(p1.statementText) ?? 0) + 1)
      const q = a.expressSpec!.quadrant
      quadrantCounts[q] = (quadrantCounts[q] ?? 0) + 1
      pairs.add(`${a.expressSpec!.targetFn}:${a.expressSpec!.givenFn}`)

      // Every stage grades its canonical answerText as correct
      for (const stage of a.stages) {
        const g = gradeTiPart(a, stage.id, stage.answerText)
        expect(g.verdict, `${p1.statementText} stage ${stage.id}`).toBe('correct')
      }

      // Promised trap exists and grades as that exact trig_ mistake ID
      expect(a.trap).toBeTruthy()
      expect(a.trapStage).toBe('expr')
      expect(a.trapAnswer).toBeTruthy()
      const trapGrade = gradeTiPart(a, a.trapStage!, a.trapAnswer!)
      expect(trapGrade.verdict).toBe('mistake')
      if (trapGrade.verdict === 'mistake') {
        expect(trapGrade.mistake).toBe(a.trap)
      }
    }

    expect(statements.size).toBeGreaterThanOrEqual(20)
    for (const [stmt, count] of statements) {
      expect(count, `statement "${stmt}" appeared ${count}/300 times`).toBeLessThanOrEqual(30)
    }
    for (const q of [1, 2, 3, 4]) {
      const share = quadrantCounts[q]! / SEEDS.length
      expect(share, `Quadrant ${q} share ${share}`).toBeGreaterThanOrEqual(0.15)
      expect(share, `Quadrant ${q} share ${share}`).toBeLessThanOrEqual(0.35)
    }
    expect(pairs.size).toBeGreaterThanOrEqual(6)
  })

  describe.each(['ti.simplify', 'ti.verify'] as const)('%s: 300-seed sweep', (templateId) => {
    it('is deterministic, produces >= 20 distinct problems with no start > 10%, and self-verifies walks and traps', () => {
      const mod = getModule('trigIdentities')
      const starts = new Map<string, number>()
      const statements = new Set<string>()

      for (const seed of SEEDS) {
        const p1 = generateProblem('trigIdentities', templateId, seed)
        const p2 = generateProblem('trigIdentities', templateId, seed)
        expect(p1).toEqual(p2)
        expect(p1.answer.type).toBe('trigIdentities')
        if (p1.answer.type !== 'trigIdentities') continue
        const a = p1.answer
        const start = p1.start!
        expect(start).toBeTruthy()
        statements.add(p1.statementText)
        starts.set(start, (starts.get(start) ?? 0) + 1)

        // Total walk length <= 6 lines (start + canonical steps)
        expect(1 + p1.canonical.length).toBeGreaterThanOrEqual(3)
        expect(1 + p1.canonical.length).toBeLessThanOrEqual(6)

        const ctx = trigIdentitiesStepContext(p1)!
        expect(ctx).toBeTruthy()

        let prev = start
        for (let i = 0; i < p1.canonical.length; i++) {
          const step = p1.canonical[i]!
          expect(sameTrigExpr(prev, step.text, 'x'), `${prev} -> ${step.text}`).toBe(false)
          const r = verifyTrigStep(prev, step.text, ctx)
          expect(r.ok, `${p1.statementText}: ${prev} -> ${step.text}`).toBe(true)
          if (i === p1.canonical.length - 1) {
            expect(r.done, `final step of ${p1.statementText}: ${step.text}`).toBe(true)
            expect(mod.solved?.(p1, step.text)).toBe(true)
          }
          prev = step.text
        }

        // Promised trap exists and grades as that exact trig_ mistake ID
        expect(a.trap).toBeTruthy()
        expect(a.trapAnswer).toBeTruthy()
        const trapRes = verifyTrigStep(start, a.trapAnswer!, ctx)
        expect(trapRes.ok).toBe(false)
        expect(trapRes.pattern?.id).toBe(a.trap)
      }

      expect(statements.size).toBeGreaterThanOrEqual(20)
      for (const [s, count] of starts) {
        expect(count, `start "${s}" appeared ${count}/300 times`).toBeLessThanOrEqual(30)
      }
    })
  })
})
