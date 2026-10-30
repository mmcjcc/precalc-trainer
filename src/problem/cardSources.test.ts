import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ModuleId } from '@/shared/types'
import { logSame } from '@/content/modules/explog/anchor'
import { gradeDqStep, gradeFxh } from '@/content/modules/diffQuotient/grade'
import { POLY_PATTERN } from '@/content/modules/polynomials/patterns'
import { checkLogRewrite, checkLogStep, checkSquareLine, ERROR_PATTERNS, LOG_MISTAKE_IDS, verifyStep } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { gradeSlotLine } from './evenOdd'
import { buildStepContext } from './stepEngine'
import { clearLineCardsCache, expLogStepContext, lineCardsFor, offersLineCards } from './cardSources'

const SLOW = 120_000
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1)
const PATH_SEEDS = Array.from({ length: 12 }, (_, i) => i + 1)
const squash = (t: string) => t.replace(/\s+/g, '')

describe('which problem types offer cards', () => {
  it('line-by-line types with a source do; types without a source do not', () => {
    expect(offersLineCards(generateProblem('expLogEquations', 'ee.exponential', 1))).toBe(true)
    expect(offersLineCards(generateProblem('logProperties', 'lp.expand', 1))).toBe(true)
    expect(offersLineCards(generateProblem('inequalities', 'ineq.linear', 1))).toBe(true)
    expect(offersLineCards(generateProblem('quadratics', 'cs.form', 1))).toBe(true)
    expect(offersLineCards(generateProblem('quadratics', 'cs.vertex', 1))).toBe(false)
    expect(offersLineCards(generateProblem('inverses', 'inv.linear', 1))).toBe(true)
    expect(offersLineCards(generateProblem('diffQuotient', 'dq.linear', 1))).toBe(true)
    expect(offersLineCards(generateProblem('evenOdd', 'evenOdd.poly', 1))).toBe(true)
    expect(offersLineCards(generateProblem('numberLine', 'nl.read', 1))).toBe(false)
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

function assertPathCards(
  label: string,
  moduleId: ModuleId,
  templateId: string,
  walk: (p: ReturnType<typeof generateProblem>) => { current: string; right: string }[],
  check: (p: ReturnType<typeof generateProblem>, prev: string, next: string) => { ok: boolean; pattern?: string },
  opts: { minShare?: number; needThree?: boolean } = {},
) {
  describe(`the cards for ${label}, along the path, over many seeds`, () => {
    it(
      'the right line is the next canonical line and is kept; each wrong card is named as exactly the mistake it was built from',
      () => {
        let lines = 0
        let withCards = 0
        let three = 0
        const mistakes = new Set<string>()
        for (const seed of PATH_SEEDS) {
          const p = generateProblem(moduleId, templateId, seed)
          expect(offersLineCards(p), `${moduleId}/${templateId}`).toBe(true)
          walk(p).forEach(({ current, right }, line) => {
            lines++
            const cards = lineCardsFor(p, current, line)
            const where = `${p.statementText} #${seed} line ${line}: ${current} → ${right}`
            if (cards.length > 0) {
              withCards++
              if (cards.length === 3) three++
              expect(cards.length, where).toBeLessThanOrEqual(3)
              const rightCard = cards.filter((c) => c.right)
              expect(rightCard, where).toHaveLength(1)
              expect(rightCard[0]!.key).toBe('right')
              expect(rightCard[0]!.latex, where).not.toBe('')
              expect(check(p, current, rightCard[0]!.text).ok, where).toBe(true)
              const wrong = cards.filter((c) => !c.right)
              expect(new Set(wrong.map((c) => c.mistake)).size, where).toBe(wrong.length)
              for (const w of wrong) {
                const at = `${where}: ${w.text}`
                expect(w.key, at).toBe(w.mistake)
                expect(ERROR_PATTERNS[w.mistake as ErrorPatternId], at).toBeTruthy()
                const r = check(p, current, w.text)
                expect(r.ok, at).toBe(false)
                expect(r.pattern, at).toBe(w.mistake)
                expect(squash(w.text), at).not.toBe(squash(right))
                expect(w.latex, at).not.toBe('')
                mistakes.add(w.mistake!)
              }
              clearLineCardsCache()
              expect(lineCardsFor(p, current, line), where).toEqual(cards)
            }
          })
        }
        expect(withCards, `${withCards} of ${lines} lines`).toBeGreaterThan(lines * (opts.minShare ?? 1 / 3))
        if (opts.needThree !== false) expect(three).toBeGreaterThan(0)
        expect(mistakes.size).toBeGreaterThan(0)
      },
      SLOW,
    )
  })
}

assertPathCards(
  'ineq.linear',
  'inequalities',
  'ineq.linear',
  (p) => {
    const rows: { current: string; right: string }[] = []
    let current = p.start ?? ''
    for (const step of p.canonical) {
      rows.push({ current, right: step.text })
      current = step.text
    }
    return rows
  },
  (p, prev, next) => {
    const r = verifyStep(prev, next, buildStepContext(p, false))
    return { ok: r.ok, pattern: r.pattern?.id }
  },
)

assertPathCards(
  'cs.form',
  'quadratics',
  'cs.form',
  (p) => {
    if (p.answer.type !== 'quadratics') return []
    const path = p.answer.path
    const rows: { current: string; right: string }[] = []
    for (let i = 0; i < path.length - 1; i++) rows.push({ current: path[i]!.text, right: path[i + 1]!.text })
    return rows
  },
  (p, _prev, next) => {
    if (p.answer.type !== 'quadratics') return { ok: false }
    const g = checkSquareLine(p.answer.f, next)
    if (g.verdict === 'correct') return { ok: true }
    if (g.verdict === 'mistake') return { ok: false, pattern: POLY_PATTERN[g.mistake] }
    return { ok: false }
  },
)

assertPathCards(
  'inv.linear',
  'inverses',
  'inv.linear',
  (p) => {
    const rows: { current: string; right: string }[] = []
    let current = p.start ?? ''
    for (const step of p.canonical) {
      rows.push({ current, right: step.text })
      current = step.text
    }
    return rows
  },
  (p, prev, next) => {
    const r = verifyStep(prev, next, buildStepContext(p, false))
    return { ok: r.ok, pattern: r.pattern?.id }
  },
  { minShare: 0.2 },
)

assertPathCards(
  'lp.expand',
  'logProperties',
  'lp.expand',
  (p) => {
    const rows: { current: string; right: string }[] = []
    let current = p.start ?? (p.answer.type === 'logProperties' ? p.answer.expr : '')
    for (const step of p.canonical) {
      rows.push({ current, right: step.text })
      current = step.text
    }
    return rows
  },
  (p, prev, next) => {
    const vars = p.answer.type === 'logProperties' ? p.answer.vars : p.vars
    const r = checkLogRewrite(prev, next, { assumePositive: true, vars })
    return { ok: r.ok, pattern: r.pattern?.id }
  },
)

assertPathCards(
  'dq.linear',
  'diffQuotient',
  'dq.linear',
  (p) => {
    const rows: { current: string; right: string }[] = []
    rows.push({ current: '', right: p.canonical[0]!.text })
    for (let i = 1; i < p.canonical.length - 1; i++) {
      rows.push({ current: p.canonical[i]!.text, right: p.canonical[i + 1]!.text })
    }
    return rows
  },
  (p, prev, next) => {
    if (!prev) {
      const r = gradeFxh(p, next)
      return { ok: r.ok, pattern: r.pattern?.id }
    }
    const r = gradeDqStep(p, prev, next)
    return { ok: r.ok, pattern: r.pattern?.id }
  },
)

assertPathCards(
  'evenOdd.poly',
  'evenOdd',
  'evenOdd.poly',
  (p) => {
    if (p.answer.type !== 'parity') return []
    const first = p.answer.fNegX[0]
    if (!first) return []
    const rows: { current: string; right: string }[] = [{ current: p.start ?? p.answer.f, right: first }]
    if (p.answer.fNegX[1] && squash(p.answer.fNegX[1]) !== squash(first)) {
      rows.push({ current: first, right: p.answer.fNegX[1] })
    }
    return rows
  },
  (p, prev, next) => {
    if (p.answer.type !== 'parity') return { ok: false }
    const atStart = squash(prev) === squash(p.start ?? '') || squash(prev) === squash(p.answer.f)
    const previous = atStart ? [] : [prev]
    const ctx = { vars: p.vars, seed: p.seed, checkValue: p.answer.k, moduleId: p.moduleId }
    const o = gradeSlotLine('A', previous, next, p.answer, ctx)
    if (o.kind === 'accepted') return { ok: true }
    if (o.kind === 'rejected') return { ok: false, pattern: o.result.pattern?.id }
    return { ok: false }
  },
  { minShare: 0.15, needThree: false },
)
