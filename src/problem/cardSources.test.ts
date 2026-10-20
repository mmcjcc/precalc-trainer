import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { logSame } from '@/content/modules/explog/anchor'
import { checkLogStep, ERROR_PATTERNS, LOG_MISTAKE_IDS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { clearLineCardsCache, expLogStepContext, lineCardsFor, offersLineCards } from './cardSources'

const SLOW = 120_000
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
const squash = (t: string) => t.replace(/\s+/g, '')

describe('which problem types offer cards', () => {
  it('exponential and log equations do; expanding logs and other line-by-line types do not (yet)', () => {
    expect(offersLineCards(generateProblem('expLogEquations', 'ee.exponential', 1))).toBe(true)
    expect(offersLineCards(generateProblem('logProperties', 'lp.expand', 1))).toBe(false)
    expect(offersLineCards(generateProblem('inequalities', 'ineq.linear', 1))).toBe(false)
    expect(lineCardsFor(generateProblem('inequalities', 'ineq.linear', 1), '2x + 3 < 7', 0)).toEqual([])
  }, SLOW)
})

describe.each(['ee.exponential', 'ee.logarithmic', 'ee.quadratic'] as const)('the cards for %s, along the path, over many seeds', (templateId) => {
  it(
    'the right line is the next canonical line and is kept; each wrong card is named as exactly the mistake it was built from',
    () => {
      let lines = 0
      let withCards = 0
      let three = 0
      const rightAt = new Set<number>()
      const mistakes = new Set<string>()
      for (const seed of SEEDS) {
        const p = generateProblem('expLogEquations', templateId, seed)
        const ctx = expLogStepContext(p)!
        expect(ctx).toBeTruthy()
        let current = p.start!
        p.canonical.forEach((step, line) => {
          lines++
          const cards = lineCardsFor(p, current, line)
          const where = `${p.statementText} #${seed} line ${line}: ${current} → ${step.text}`
          if (cards.length > 0) {
            withCards++
            if (cards.length === 3) three++
            expect(cards.length, where).toBeLessThanOrEqual(3)
            const right = cards.filter((c) => c.right)
            expect(right, where).toHaveLength(1)
            expect(right[0]!.text, where).toBe(step.text)
            expect(right[0]!.key).toBe('right')
            expect(right[0]!.latex, where).not.toBe('')
            expect(checkLogStep(current, right[0]!.text, ctx).ok, where).toBe(true)
            const wrong = cards.filter((c) => !c.right)
            expect(new Set(wrong.map((c) => c.mistake)).size, where).toBe(wrong.length)
            for (const w of wrong) {
              const at = `${where}: ${w.text}`
              expect(w.key, at).toBe(w.mistake)
              expect(LOG_MISTAKE_IDS as readonly string[], at).toContain(w.mistake)
              expect(ERROR_PATTERNS[w.mistake as ErrorPatternId], at).toBeTruthy()
              const r = checkLogStep(current, w.text, ctx)
              expect(r.ok, at).toBe(false)
              expect(r.pattern?.id, at).toBe(w.mistake)
              expect(squash(w.text), at).not.toBe(squash(step.text))
              expect(logSame(w.text, step.text, ['x']), at).toBe(false)
              expect(w.latex, at).not.toBe('')
              mistakes.add(w.mistake!)
            }
            // A fixed order: built again from scratch, the same cards come out in the same places.
            clearLineCardsCache()
            expect(lineCardsFor(p, current, line), where).toEqual(cards)
            rightAt.add(cards.findIndex((c) => c.right))
          }
          const kept = checkLogStep(current, step.text, ctx)
          expect(kept.ok, where).toBe(true)
          current = kept.normalized?.text || step.text
        })
      }
      // Most lines get cards; the right card is not always in one place; the mistakes vary.
      expect(withCards, `${withCards} of ${lines} lines`).toBeGreaterThan(lines / 3)
      expect(three).toBeGreaterThan(0)
      if (templateId !== 'ee.quadratic') expect(rightAt.size).toBe(3)
      expect(mistakes.size).toBeGreaterThan(1)
    },
    SLOW,
  )
})

describe('cards for a known line', () => {
  it('3^x = 13: the wrong cards take logs wrongly, then divide wrongly', () => {
    const p = (() => {
      for (let seed = 1; seed < 400; seed++) {
        const q = generateProblem('expLogEquations', 'ee.exponential', seed)
        if (q.statementText === '3^x = 13') return q
      }
      throw new Error('no 3^x = 13 in 400 seeds')
    })()
    const first = lineCardsFor(p, '3^x = 13', 0)
    expect(first.map((c) => c.text).sort()).toEqual(['3^x = log(13)', 'log(3)^x = log(13)', 'x * log(3) = log(13)'].sort())
    const second = lineCardsFor(p, 'x*log(3) = log(13)', 1)
    expect(new Set(second.filter((c) => !c.right).map((c) => c.mistake))).toEqual(new Set(['log_change_base_inverted', 'log_quotient_as_quotient']))
    // Her own legal route (ln instead of log) is off the path: no cards, she types the next line.
    expect(checkLogStep('3^x = 13', 'x*ln(3) = ln(13)', expLogStepContext(p)!).ok).toBe(true)
    expect(lineCardsFor(p, 'x*ln(3) = ln(13)', 1)).toEqual([])
    // At the end of the path there is no next line.
    expect(lineCardsFor(p, 'x = log(13)/log(3)', 2)).toEqual([])
  }, SLOW)
})
