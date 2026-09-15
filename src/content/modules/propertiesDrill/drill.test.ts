import { describe, expect, it } from 'vitest'
import { generateDrill, getModule } from '@/content/index'
import { parseExpression } from '@/engine/parse'
import { exprEquivalent } from '@/engine/samples'
import { verifyStep } from '@/engine/verify'
import { ALL_CHIPS } from '@/shared/types'
import { DRILL_FAMILIES, DRILL_PAIRS } from './index'

const VARS = ['x', 'y'] as const

function expressionsAgree(a: string, b: string): boolean {
  const pa = parseExpression(a, VARS)
  const pb = parseExpression(b, VARS)
  if (!pa.ok) throw new Error(`${a}: ${pa.error.message}`)
  if (!pb.ok) throw new Error(`${b}: ${pb.error.message}`)
  return exprEquivalent(pa.node, pb.node, VARS)
}

describe('propertiesDrill module', () => {
  it('registers with order 5, no templates, trivial progress', () => {
    const mod = getModule('propertiesDrill')
    expect(mod.order).toBe(5)
    expect(mod.templates).toEqual([])
    expect(mod.ruleCards.length).toBeGreaterThan(0)
    expect(mod.nextStep(undefined as never, null, false)).toBeNull()
    expect(mod.progress(undefined as never, null, false).total).toBe(1)
  })

  it('the bank covers every CG-12 twin pair', () => {
    const keys = DRILL_PAIRS.map((p) => p.key)
    for (const k of [
      'power-of-product',
      'split-fraction',
      'divide-negative',
      'minus-denominator',
      'clear-denominator',
      'reorder',
      'distribute',
      'distribute-negative',
      'cbrt-sign',
      'sqrt-square',
      'move-constant',
      'lost-root',
    ]) {
      expect(keys).toContain(k)
    }
    expect(new Set(keys).size).toBe(keys.length)
    expect(DRILL_FAMILIES.length).toBeGreaterThanOrEqual(5)
  })
})

describe('generateDrill — every item agrees with the engine', () => {
  it('25 seeds × 40 items: relation items match verifyStep, expression items match exprEquivalent', { timeout: 20000 }, () => {
    let relationItems = 0
    let expressionItems = 0
    let whichProperty = 0
    for (let n = 1; n <= 25; n++) {
      const seed = n * 5381 + 7
      const items = generateDrill(seed, 40)
      expect(items).toHaveLength(40)
      expect(new Set(items.map((i) => i.id)).size).toBe(40)
      const byId = new Map(items.map((i) => [i.id, i]))
      for (const item of items) {
        const label = `${item.id}: ${item.before}  →  ${item.after}`
        expect(item.lesson.length, label).toBeGreaterThan(20)
        expect(item.family).toBeTruthy()
        // Twin resolves and is the other side of the same pair.
        expect(item.twinId, label).toBeTruthy()
        const twin = byId.get(item.twinId!)
        expect(twin, label).toBeDefined()
        expect(twin!.twinId).toBe(item.id)
        expect(twin!.family).toBe(item.family)
        // Legal items carry a chip; illegal items carry a pattern; questions are consistent.
        if (item.verdict === 'legal') {
          expect(item.chip, label).toBeDefined()
          expect(ALL_CHIPS).toContain(item.chip!)
          expect(item.patternId, label).toBeUndefined()
        } else {
          expect(item.patternId, label).toBeDefined()
          expect(item.chip, label).toBeUndefined()
          expect(item.question).toBe('legal_or_illegal')
        }
        if (item.question === 'which_property') {
          whichProperty++
          expect(item.verdict).toBe('legal')
        }
        // Engine agreement.
        if (item.mode === 'relation') {
          relationItems++
          expect(item.relOp, label).toBeDefined()
          expect(item.before.includes(item.relOp!), label).toBe(true)
          const r = verifyStep(item.before, item.after)
          expect(r.ok, `${label}\nexpected ${item.verdict}, engine said ${JSON.stringify(r)}`).toBe(
            item.verdict === 'legal',
          )
        } else {
          expressionItems++
          expect(item.relOp, label).toBeUndefined()
          expect(/[<>=]/.test(item.before) || /[<>=]/.test(item.after), label).toBe(false)
          expect(expressionsAgree(item.before, item.after), `${label} (expected ${item.verdict})`).toBe(
            item.verdict === 'legal',
          )
        }
      }
    }
    expect(relationItems).toBeGreaterThan(0)
    expect(expressionItems).toBeGreaterThan(0)
    expect(whichProperty).toBeGreaterThan(0)
  })

  it('every pair template survives 25 instantiations', { timeout: 30000 }, () => {
    for (const family of DRILL_FAMILIES) {
      for (let n = 1; n <= 25; n++) {
        const items = generateDrill(n * 977 + 3, 2 * DRILL_PAIRS.filter((p) => p.family === family).length, family)
        expect(items.length).toBeGreaterThan(0)
        for (const item of items) {
          expect(item.family).toBe(family)
          const ok =
            item.mode === 'relation'
              ? verifyStep(item.before, item.after).ok
              : expressionsAgree(item.before, item.after)
          expect(ok, `${item.id}: ${item.before} → ${item.after}`).toBe(item.verdict === 'legal')
        }
      }
    }
  })

  it('is deterministic, honors count, and rejects unknown families', () => {
    expect(generateDrill(99, 7)).toEqual(generateDrill(99, 7))
    expect(generateDrill(99, 7)).toHaveLength(7)
    expect(generateDrill(99, 1)).toHaveLength(1)
    expect(generateDrill(99, 50).length).toBe(50)
    expect(() => generateDrill(1, 4, 'no-such-family')).toThrow()
  })
})
