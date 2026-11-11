/**
 * The long-division templates (polyDivision/long.ts): `ld.long` draws a cubic over a quadratic that
 * divides in two clean rounds, `ld.worksheet` is the four problems of her worksheet. Every part takes
 * the engine's own answer, the sentences above the work give none of them away, and the parts are
 * graded in order (a product is not checked against a term that is still wrong).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { AnswerSpec, ProblemInstance } from '@/content/types'
import { longDivision } from '@/engine'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { LD_CARD_EXAMPLE, LD_ROUND, LD_WORKSHEET, SD_FIRST_KEY, SD_KEYS, SD_RULES, divisionWork, gradeDivisionStage, ldProblem, sdStageOf } from './index'

type LdAnswer = Extract<AnswerSpec, { type: 'polyDivision' }>

const SEEDS = 300
const STAGES = ['ldStep1', 'ldSub1', 'ldStep2', 'ldSub2', 'ldAnswer'] as const

function ld(p: ProblemInstance): LdAnswer & { long: NonNullable<LdAnswer['long']> } {
  if (p.answer.type !== 'polyDivision' || p.answer.question !== 'long' || !p.answer.long) throw new Error(`${p.id}: not a long division`)
  return p.answer as LdAnswer & { long: NonNullable<LdAnswer['long']> }
}

/** Her boxes when every one holds the engine's own answer. */
function rightEntries(a: ReturnType<typeof ld>): Record<string, string> {
  const e: Record<string, string> = { [SD_KEYS.ldQuotient]: a.quotientText, [SD_KEYS.ldRemainder]: a.remainderText }
  a.long.rounds.forEach((r, round) => {
    e[SD_KEYS.ldTerm(round)] = r.term
    e[SD_KEYS.ldProduct(round)] = r.product
    e[SD_KEYS.ldDifference(round)] = r.difference
  })
  return e
}

describe('ld.long', () => {
  const problems = Array.from({ length: SEEDS }, (_, i) => generateProblem('polyDivision', 'ld.long', i + 1))

  it('every seed is a cubic over a quadratic in two rounds, with the five parts in order', () => {
    for (const p of problems) {
      const a = ld(p)
      expect(p.kind).toBe('polyDivision')
      expect(a.stages.map((s) => s.id), p.id).toEqual([...STAGES])
      expect(a.degree).toBe(3)
      expect(a.long.rounds).toHaveLength(2)
      expect(a.f).toBe(`(${a.long.dividend})/(${a.divisor})`)
      expect(p.statementText).toBe(a.f)
      expect(a.isFactor).toBe(false)
      expect(a.remainderText).not.toBe('0')
      expect(a.c).toBe('')
      expect(p.graph).toEqual({ kind: 'none' })
      // The engine agrees with what the template stored.
      const d = longDivision(a.long.dividend, a.divisor)!
      expect(d.quotient).toBe(a.quotientText)
      expect(d.remainder).toBe(a.remainderText)
      expect(d.rounds.map((r) => r.difference)).toEqual(a.long.rounds.map((r) => r.difference))
      expect(a.long.rounds[1]!.current).toBe(a.long.rounds[0]!.difference)
      expect(a.long.rounds[1]!.difference).toBe(a.remainderText)
    }
  })

  it('the dividend has all four terms and every number she meets is small', () => {
    for (const p of problems) {
      const a = ld(p)
      expect(a.long.rounds[0]!.currentRow.every((c) => c !== '0'), p.id).toBe(true)
      for (const r of a.long.rounds) for (const c of [...r.currentRow, ...r.productRow]) expect(Math.abs(Number(c)), p.id).toBeLessThanOrEqual(20)
    }
  })

  it('every part takes the engine’s own answer, and only then', () => {
    for (const p of problems.slice(0, 120)) {
      const a = ld(p)
      const entries = rightEntries(a)
      for (const stage of a.stages) {
        const graded = gradeDivisionStage(a, stage.id, entries)
        expect(graded.parts.every((part) => part.grade.verdict === 'correct'), `${p.id} ${stage.id}`).toBe(true)
        expect(graded.focus).toBeNull()
        const empty = gradeDivisionStage(a, stage.id, {})
        expect(empty.parts.some((part) => part.grade.verdict === 'invalid'), `${p.id} ${stage.id} empty`).toBe(true)
        expect(empty.focus).toBe(SD_FIRST_KEY[stage.id])
      }
    }
  })

  it('the sentences above the work, the nudges and a right part’s message never state a later answer', () => {
    for (const p of problems.slice(0, 120)) {
      const a = ld(p)
      const secrets = [a.quotientText, a.remainderText].map(polyShow)
      for (const text of [p.title, p.instructions, a.prompt, ...a.stages.map((s) => s.nudge)]) {
        for (const secret of secrets) expect(text.includes(secret), `${p.id}: "${text}" has ${secret}`).toBe(false)
      }
      // Part 1 right: its message may name the term and the product, not the quotient or the remainder.
      const first = gradeDivisionStage(a, 'ldStep1', rightEntries(a))
      for (const part of first.parts) {
        const message = 'message' in part.grade ? part.grade.message : ''
        expect(message.includes(`quotient is`)).toBe(false)
        expect(message.includes(polyShow(a.remainderText) + '.'), `${p.id}: ${message}`).toBe(false)
      }
    }
  })

  it('each part’s reveal is that part’s lines of the engine’s worked division, and the rule cards exist', () => {
    const cards = new Set(SD_RULES.map((c) => c.id))
    for (const p of problems.slice(0, 60)) {
      const a = ld(p)
      expect(a.reveal).toHaveLength(7)
      expect(a.stages.flatMap((s) => s.reveal)).toEqual(a.reveal)
      for (const s of a.stages) expect(cards.has(s.ruleCard), `${p.id} ${s.ruleCard}`).toBe(true)
      for (const id of a.ruleCards) expect(cards.has(id)).toBe(true)
      expect(a.ruleCards[0]).toBe(a.ruleCard)
      expect(['ld_columns', 'ld_signs']).toContain(a.trap)
      // A divisor that skips its x term leads the subtraction with the columns card.
      const skips = /^x\^2 [+-] \d+$/.test(a.divisor)
      expect(a.trap === 'ld_columns', `${p.id} ${a.divisor}`).toBe(skips)
      expect(sdStageOf('long', a.trap)).toBeNull()
    }
  })

  it('the rule cards work one division that is never a problem, and they work it right', () => {
    const d = longDivision([...LD_CARD_EXAMPLE.dividend], [...LD_CARD_EXAMPLE.divisor])!
    expect(d.dividend).toBe('2x^3 + x^2 - 3x + 4')
    expect(d.divisor).toBe('x^2 + 2')
    expect(d.rounds[0]).toMatchObject({ term: '2x', product: '2x^3 + 4x', difference: 'x^2 - 7x + 4' })
    expect(d.quotient).toBe('2x + 1')
    expect(d.remainder).toBe('-7x + 2')
    // Every number the cards print is one of those.
    const cards = SD_RULES.filter((c) => c.id.startsWith('ld-')).map((c) => c.example ?? '')
    expect(cards).toHaveLength(5)
    expect(cards.join(' ')).toContain('2x^3 ÷ x^2 = 2x')
    expect(cards.join(' ')).toContain('2x · (x^2 + 2) = 2x^3 + 4x')
    expect(cards.join(' ')).toContain('= x^2 − 7x + 4')
    expect(cards.join(' ')).toContain('quotient 2x + 1, remainder −7x + 2')
    const example = `(${d.dividend})/(${d.divisor})`
    for (const p of problems) expect(ld(p).f).not.toBe(example)
    for (const w of LD_WORKSHEET) expect(ld(generateProblem('polyDivision', 'ld.worksheet', w.n - 5)).f).not.toBe(example)
  })

  it('is the same problem for the same seed, and mostly a different one for a different seed', () => {
    for (const seed of [1, 7, 42, 199]) expect(generateProblem('polyDivision', 'ld.long', seed)).toEqual(problems[seed - 1])
    expect(new Set(problems.map((p) => p.statementText)).size).toBeGreaterThan(SEEDS * 0.9)
  })

  it('mixes the three kinds of divisor', () => {
    const count = (scenario: string) => problems.filter((p) => p.params?.scenario === scenario).length
    for (const scenario of ['full', 'placeholder', 'signs']) {
      expect(count(scenario), scenario).toBeGreaterThan(SEEDS * 0.15)
      expect(count(scenario), scenario).toBeLessThan(SEEDS * 0.6)
    }
    const placeholder = problems.filter((p) => p.params?.scenario === 'placeholder').map((p) => ld(p))
    expect(placeholder.every((a) => a.long.rounds[0]!.productRow[1] === '0')).toBe(true)
  })
})

describe('grading the parts in order', () => {
  const a = ld(generateProblem('polyDivision', 'ld.worksheet', 4))

  it('a product is not checked while the term is wrong', () => {
    const wrongTerm = gradeDivisionStage(a, 'ldStep1', { [SD_KEYS.ldTerm(0)]: '1', [SD_KEYS.ldProduct(0)]: 'x^2 + 1' })
    expect(wrongTerm.parts).toHaveLength(1)
    expect(wrongTerm.parts[0]!.grade.verdict).toBe('wrong')
    const wrongProduct = gradeDivisionStage(a, 'ldStep1', { [SD_KEYS.ldTerm(0)]: 'x', [SD_KEYS.ldProduct(0)]: 'x^3' })
    expect(wrongProduct.parts.map((p) => p.grade.verdict)).toEqual(['correct', 'wrong'])
    const noProduct = gradeDivisionStage(a, 'ldStep1', { [SD_KEYS.ldTerm(0)]: 'x' })
    expect(noProduct.parts.map((p) => p.grade.verdict)).toEqual(['correct', 'invalid'])
    expect(noProduct.focus).toBe(SD_KEYS.ldProduct(0))
  })

  it('each part knows its round', () => {
    expect(LD_ROUND).toEqual({ ldStep1: 0, ldSub1: 0, ldStep2: 1, ldSub2: 1 })
  })

  it('her work reaches the tutor as lines in the order she did it', () => {
    expect(divisionWork('long', 3, '', { [SD_KEYS.ldTerm(0)]: 'x', [SD_KEYS.ldProduct(0)]: 'x^3 + x', [SD_KEYS.ldDifference(0)]: ' 2x^2 + 2x - 5 ', [SD_KEYS.ldQuotient]: '' })).toEqual([
      'round 1, next term of the quotient: x',
      'round 1, term times the divisor: x^3 + x',
      'round 1, after subtracting: 2x^2 + 2x - 5',
    ])
    expect(divisionWork('long', 3, '', undefined)).toEqual([])
  })
})

describe('ld.worksheet: problems 5 to 8 of her worksheet', () => {
  const WORKED = [
    { n: 5, f: '(x^3 + 3x^2 + 2x - 5)/(x^2 + 1)', quotient: 'x + 3', remainder: 'x - 8' },
    { n: 6, f: '(2x^3 - 3x^2 + 4x + 7)/(x^2 - x + 2)', quotient: '2x - 1', remainder: '-x + 9' },
    { n: 7, f: '(3x^3 + 5x^2 - 2x + 6)/(x^2 + 2x - 3)', quotient: '3x - 1', remainder: '9x + 3' },
    { n: 8, f: '(4x^3 - 7x^2 + 3x - 8)/(x^2 - 3x + 4)', quotient: '4x + 5', remainder: '2x - 28' },
  ]

  it('is listed in the module with the long division template', () => {
    const ids = getModule('polyDivision').templates.map((t) => t.id)
    expect(ids).toContain('ld.long')
    expect(ids).toContain('ld.worksheet')
    expect(LD_WORKSHEET.map((w) => w.n)).toEqual([5, 6, 7, 8])
    for (const w of LD_WORKSHEET) expect(ldProblem(w.dividend, w.divisor)).toBeNull()
  })

  it.each(WORKED)('seed for problem $n is the printed problem with the answers worked by hand', (w) => {
    const seed = w.n - 5
    const p = generateProblem('polyDivision', 'ld.worksheet', seed)
    const a = ld(p)
    expect(p.title).toBe(`Worksheet problem ${w.n}`)
    expect(a.f).toBe(w.f)
    expect(a.quotientText).toBe(w.quotient)
    expect(a.remainderText).toBe(w.remainder)
    // The four cycle: the next "new problem" of the template is the next worksheet problem.
    expect(ld(generateProblem('polyDivision', 'ld.worksheet', seed + 4)).f).toBe(w.f)
    const entries = rightEntries(a)
    for (const stage of a.stages) expect(gradeDivisionStage(a, stage.id, entries).parts.every((part) => part.grade.verdict === 'correct'), stage.id).toBe(true)
  })

  it('a division the screen cannot ask is refused with the reason', () => {
    expect(ldProblem([1, 0, 0, 0], [1, 0, 1])).toMatch(/rounds|small|read back/)
    expect(ldProblem([1, 3, 3, 1], [1, 2, 1])).toBe('the division is exact')
    expect(ldProblem([1, 1], [1, 0, 1])).toBe('longDivision returned null')
  })
})
