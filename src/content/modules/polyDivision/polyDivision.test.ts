import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { AnswerSpec, ProblemInstance } from '@/content/types'
import {
  ERROR_PATTERNS,
  POLY_MISTAKE_KINDS,
  divisorText,
  gradeBottomRow,
  gradeCoefficientRow,
  gradeIsFactor,
  gradeQuotient,
  gradeRemainder,
  gradeSyntheticTable,
  polyValueAt,
  quotientMistakes,
  remainderMistakes,
  syntheticDivision,
  syntheticMistakes,
} from '@/engine'
import type { PolyMistakeKind } from '@/engine'
import { ratToString } from '@/notation'
import { POLY_PATTERN } from '@/content/modules/polynomials/patterns'
import {
  SD_FIRST_KEY,
  SD_KEYS,
  SD_RULE_FOR,
  SD_RULE_IDS,
  SD_RULES,
  cellKey,
  divisionWork,
  factorSlip,
  gradeDivisionStage,
  gradeDivisionTable,
  sdRuleIdFor,
  sdSelfTest,
  sdStageOf,
  sdTrapKinds,
  tableEntries,
} from './index'

type SdAnswer = Extract<AnswerSpec, { type: 'polyDivision' }>

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

const TEMPLATES = ['sd.table', 'sd.value', 'sd.factor'] as const
const QUESTION = { 'sd.table': 'table', 'sd.value': 'value', 'sd.factor': 'factor' } as const

function sd(p: ProblemInstance): SdAnswer {
  if (p.answer.type !== 'polyDivision') throw new Error(`${p.id}: not a polyDivision answer`)
  return p.answer
}

/** Her boxes when every one holds the engine's own answer. */
function canonicalEntries(a: SdAnswer): Record<string, string> {
  const e: Record<string, string> = {
    [SD_KEYS.row]: a.rows.coefficients.join(', '),
    [SD_KEYS.box]: a.c,
    [SD_KEYS.quotient]: a.quotientText,
    [SD_KEYS.remainder]: a.remainderText,
    [SD_KEYS.bottomRow]: a.rows.bottom.join(', '),
    [SD_KEYS.value]: a.remainderText,
    [SD_KEYS.factor]: a.isFactor ? 'yes' : 'no',
  }
  a.rows.products.forEach((v, i) => (e[SD_KEYS.product(i + 1)] = v))
  a.rows.bottom.forEach((v, i) => (e[SD_KEYS.bottom(i)] = v))
  return e
}

/**
 * Words that would hand her the method or the trap. The sentences above the work may not use them: which
 * number goes in the box, the 0 for a missing power, what the last number of the bottom row is.
 */
const METHOD_WORDS = /zero|opposite|sign\b|placeholder|missing|skip|bring|multiply|\badd|subtract|last number|in the box|theorem|\b0\b/i

describe('polyDivision module', () => {
  it('is registered after completing the square with three templates and its own rule cards', () => {
    const mod = getModule('polyDivision')
    expect(mod.title).toBe('Synthetic division')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['sd.table', 'sd.value', 'sd.factor'])
    expect(mod.order).toBeGreaterThan(getModule('quadratics').order)
    expect(mod.order).toBeLessThan(getModule('sigFigs').order)
    expect(mod.ruleCards).toBe(SD_RULES)
    expect(new Set(SD_RULES.map((c) => c.id)).size).toBe(SD_RULES.length)
    expect(SD_RULES.map((c) => c.id).sort()).toEqual(Object.values(SD_RULE_IDS).sort())
    for (const template of mod.templates) expect(template.knobs).toEqual([])
  })

  it('has a rule card for every synthetic-division mistake kind, and none for the others', () => {
    const kinds = POLY_MISTAKE_KINDS.filter((k) => k.startsWith('sd_'))
    expect(kinds).toHaveLength(6)
    expect(Object.keys(SD_RULE_FOR).sort()).toEqual([...kinds].sort())
    for (const kind of kinds) {
      expect(SD_RULES.some((c) => c.id === sdRuleIdFor(kind)), kind).toBe(true)
      expect(ERROR_PATTERNS[POLY_PATTERN[kind]]).toBeTruthy()
    }
    expect(sdRuleIdFor('cs_h_sign')).toBeUndefined()
    expect(sdRuleIdFor('none')).toBeUndefined()
  })

  it('knows which part of each question a slip belongs to', () => {
    expect(sdStageOf('table', 'sd_missing_placeholder')).toBe('row')
    expect(sdStageOf('table', 'sd_subtracted')).toBe('grid')
    expect(sdStageOf('table', 'sd_remainder_last_quotient')).toBe('answers')
    expect(sdStageOf('value', 'sd_missing_placeholder')).toBe('bottom')
    expect(sdStageOf('value', 'sd_remainder_last_quotient')).toBe('value')
    expect(sdStageOf('factor', 'sd_wrong_sign_c')).toBe('bottom')
    expect(sdStageOf('factor', 'sd_quotient_degree')).toBeNull()
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  const question = QUESTION[templateId]

  it(
    'is deterministic, passes the engine self-tests, grades its own answers correct, and promises a real trap',
    () => {
      const traps = new Set<string>()
      const degrees = new Set<number>()
      let negative = 0
      let missing = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('polyDivision', templateId, seed)
        expect(generateProblem('polyDivision', templateId, seed), p.id).toEqual(p)
        const a = sd(p)
        expect(p.kind).toBe('polyDivision')
        expect(p.moduleId).toBe('polyDivision')
        expect(p.skill).toBe(templateId)
        expect(a.question).toBe(question)
        expect(p.canonical).toEqual([])
        expect(p.start).toBeNull()
        expect(p.vars).toEqual(['x'])
        // No graph and no calculator panel in this module.
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })

        // §5 self-tests, straight from the engine.
        expect(sdSelfTest(a.f, a.c), p.id).toBeNull()
        const t = syntheticDivision(a.f, a.c)
        expect(t, p.id).not.toBeNull()
        if (!t) continue
        expect(gradeSyntheticTable(a.f, a.c, { bottom: t.rows.bottom, products: t.rows.products, box: ratToString(t.c) }).verdict, p.id).toBe('correct')
        expect(gradeQuotient(a.f, a.c, t.quotientText).verdict, p.id).toBe('correct')
        expect(gradeRemainder(a.f, a.c, t.remainderText).verdict, p.id).toBe('correct')
        expect(gradeRemainder(a.f, a.c, t.remainderText, { ask: 'value' }).verdict, p.id).toBe('correct')
        expect(gradeIsFactor(a.f, a.c, t.isFactor).verdict, p.id).toBe('correct')
        expect(gradeCoefficientRow(a.f, t.rows.coefficients.join(', ')).verdict, p.id).toBe('correct')
        expect(gradeBottomRow(a.f, a.c, t.rows.bottom.join(', ')).verdict, p.id).toBe('correct')

        // The answer spec is the engine's.
        expect(a.f).toBe(t.f)
        expect(p.statementText).toBe(t.f)
        expect(a.c).toBe(ratToString(t.c))
        expect(a.degree).toBe(t.degree)
        expect(a.rows).toEqual(t.rows)
        expect(a.quotientText).toBe(t.quotientText)
        expect(a.remainderText).toBe(t.remainderText)
        expect(a.isFactor).toBe(t.isFactor)
        // The divisor is shown the engine's way: "x + 2", never "x - (-2)".
        expect(a.divisor).toBe(divisorText(a.c))
        expect(a.divisor).toMatch(/^x [+-] \d+$/)
        expect(a.prompt).not.toMatch(/- -|\(-|−\s*\(/)
        if (question !== 'value') expect(a.prompt).toContain(a.divisor.replace(/-/g, '−'))
        else expect(a.prompt).toContain(`f(${a.c.replace(/-/g, '−')})`)

        // Every part, answered with the engine's own answer, grades correct (never unsupported or invalid).
        const entries = canonicalEntries(a)
        expect(a.stages.map((s) => s.id)).toEqual(question === 'table' ? ['row', 'grid', 'answers'] : ['bottom', question])
        for (const stage of a.stages) {
          const { parts, focus } = gradeDivisionStage(a, stage.id, entries)
          expect(focus).toBeNull()
          for (const part of parts) expect(part.grade.verdict, `${p.id} ${stage.id}`).toBe('correct')
          expect(stage.nudge.length).toBeGreaterThan(40)
          expect(stage.nudge).not.toContain(a.quotientText)
          expect(stage.reveal.length).toBeGreaterThan(0)
          for (const line of stage.reveal) expect(question === 'table' && stage.id === 'row' ? true : t.explanation.includes(line), line).toBe(true)
          expect(SD_RULES.some((c) => c.id === stage.ruleCard), stage.ruleCard).toBe(true)
          expect(entries[SD_FIRST_KEY[stage.id]]).toBeTruthy()
        }
        expect(a.nudge).toBe(a.stages[0]!.nudge)
        expect(a.reveal).toEqual(question === 'value' ? t.explanation.slice(0, -1) : t.explanation)

        // What to avoid (§5): dividing by x, a degree-1 dividend. Plus: whole numbers a phone-width cell holds.
        expect(t.c.n).not.toBe(0)
        expect(t.c.d).toBe(1)
        expect(t.degree === 3 || t.degree === 4, p.id).toBe(true)
        for (const v of [...t.coefficients, ...t.products, ...t.bottom]) {
          expect(v.d, p.id).toBe(1)
          expect(Math.abs(v.n), p.id).toBeLessThanOrEqual(60)
        }
        // The leading and constant terms are there; a missing power is always in the middle.
        expect(t.coefficients[0]!.n).not.toBe(0)
        expect(t.coefficients[t.degree]!.n).not.toBe(0)
        expect(t.missingPowers.length).toBeLessThanOrEqual(1)
        expect(p.params.missing).toBe(t.missingPowers.length === 1)

        // The promised trap is one the engine lists for THIS screen, and its rule card leads.
        const kinds = sdTrapKinds(a.f, a.c, question)
        expect(kinds, `${p.id} trap ${a.trap}`).toContain(a.trap)
        expect(p.params.trap).toBe(a.trap)
        expect(a.ruleCard).toBe(sdRuleIdFor(a.trap))
        expect(a.ruleCards[0]).toBe(a.ruleCard)
        expect(new Set(a.ruleCards).size).toBe(a.ruleCards.length)
        for (const id of a.ruleCards) expect(SD_RULES.some((c) => c.id === id), id).toBe(true)
        const trapStage = sdStageOf(question, a.trap)
        expect(trapStage, `${p.id} trap ${a.trap}`).not.toBeNull()
        expect(a.stages.find((s) => s.id === trapStage)!.ruleCard).toBe(a.ruleCard)
        if (a.trap === 'sd_missing_placeholder') expect(t.missingPowers.length).toBe(1)
        // With 1 in the box the first product equals the first coefficient (§5): not promised there.
        if (a.trap === 'sd_first_coefficient') expect(t.c.n).not.toBe(1)

        // The sentences above the work say what the problem is, not how to do it. The method is the hint.
        for (const text of [p.title, p.instructions, a.prompt]) expect(text, text).not.toMatch(METHOD_WORDS)

        traps.add(a.trap)
        degrees.add(t.degree)
        if (t.c.n < 0) negative++
        if (t.missingPowers.length) missing++
      }
      expect([...degrees].sort()).toEqual([3, 4])
      // Divisors x + k (the sign trap) and missing powers are both common, and neither is the rule.
      expect(negative).toBeGreaterThan(SEEDS * 0.4)
      expect(negative).toBeLessThan(SEEDS * 0.8)
      expect(missing).toBeGreaterThan(SEEDS * 0.3)
      expect(missing).toBeLessThan(SEEDS * 0.7)
      const expected: Record<typeof question, PolyMistakeKind[]> = {
        table: ['sd_first_coefficient', 'sd_missing_placeholder', 'sd_quotient_degree', 'sd_remainder_last_quotient', 'sd_subtracted', 'sd_wrong_sign_c'],
        value: ['sd_first_coefficient', 'sd_missing_placeholder', 'sd_remainder_last_quotient', 'sd_wrong_sign_c'],
        factor: ['sd_missing_placeholder', 'sd_wrong_sign_c'],
      }
      expect([...traps].sort()).toEqual(expected[question])
    },
    LOOP_TIMEOUT,
  )
})

describe('sd.table', () => {
  it(
    'every slip the engine lists is named when she types it into the table, the quotient or the remainder',
    () => {
      for (let seed = 1; seed <= 60; seed++) {
        const a = sd(generateProblem('polyDivision', 'sd.table', seed))
        const text = (v: { n: number; d: number }) => ratToString(v)
        for (const cand of syntheticMistakes(a.f, a.c) ?? []) {
          if (cand.kind === 'sd_missing_placeholder') {
            // A short row: caught where she sets the row up, before there is a table.
            const g = gradeCoefficientRow(a.f, cand.coefficients.map(text).join(', '))
            expect(g.verdict, `${a.f}: ${cand.text}`).toBe('mistake')
            if (g.verdict === 'mistake') expect(g.mistake).toBe('sd_missing_placeholder')
            continue
          }
          const typed = { box: text(cand.box), products: cand.products.map(text), bottom: cand.bottom.map(text) }
          const { grade, cell } = gradeDivisionTable(a.f, a.c, typed)
          expect(cell).toBeNull()
          expect(grade.verdict, `${a.f} ÷ ${a.divisor}: ${cand.text}`).toBe('mistake')
          if (grade.verdict === 'mistake') expect(grade.mistake).toBe(cand.kind)

          if (cand.kind === 'sd_wrong_sign_c') {
            // The same bottom row with the RIGHT box and her own products is "subtracted", not the sign of c:
            // only the box and the products row can tell the two apart (core §4).
            expect(cand.shadows).toContain('sd_subtracted')
            const subtracted = { box: a.c, products: cand.products.map((v) => text({ n: -v.n, d: v.d })), bottom: cand.bottom.map(text) }
            const g = gradeDivisionTable(a.f, a.c, subtracted).grade
            expect(g.verdict, `${a.f} ÷ ${a.divisor}: subtracted`).toBe('mistake')
            if (g.verdict === 'mistake') expect(g.mistake).toBe('sd_subtracted')
          }
        }
        for (const cand of quotientMistakes(a.f, a.c) ?? []) {
          const g = gradeQuotient(a.f, a.c, cand.text)
          expect(g.verdict, `${a.f}: quotient ${cand.text}`).toBe('mistake')
          if (g.verdict === 'mistake') expect(g.mistake).toBe(cand.kind)
        }
        for (const cand of remainderMistakes(a.f, a.c) ?? []) {
          const g = gradeRemainder(a.f, a.c, cand.text)
          expect(g.verdict, `${a.f}: remainder ${cand.text}`).toBe('mistake')
          if (g.verdict === 'mistake') expect(g.mistake).toBe(cand.kind)
        }
      }
    },
    LOOP_TIMEOUT,
  )

  it('placeholder seeds promise the missing 0, and sign seeds divide by x + k', () => {
    let placeholder = 0
    for (let seed = 1; seed <= SEEDS; seed++) {
      const p = generateProblem('polyDivision', 'sd.table', seed)
      if (p.params.scenario === 'placeholder') {
        placeholder++
        expect(sd(p).trap).toBe('sd_missing_placeholder')
      }
      if (p.params.scenario === 'sign') expect(sd(p).divisor).toMatch(/^x \+ /)
    }
    expect(placeholder).toBeGreaterThan(SEEDS * 0.2)
  }, LOOP_TIMEOUT)

  it('an empty or unreadable cell is not an attempt, and says which cell to focus', () => {
    const F = '2x^3 - 3x^2 - 5'
    const right = { box: '2', products: ['4', '2', '4'], bottom: ['2', '1', '2', '-1'] }
    expect(gradeDivisionTable(F, '2', right)).toMatchObject({ grade: { verdict: 'correct' }, cell: null })

    const noBox = gradeDivisionTable(F, '2', { ...right, box: '' })
    expect(noBox.grade.verdict).toBe('invalid')
    expect(noBox.cell).toEqual({ row: 'box' })
    expect(cellKey(noBox.cell!)).toBe('box')

    const noProduct = gradeDivisionTable(F, '2', { ...right, products: ['4', '', '4'] })
    expect(noProduct.grade).toMatchObject({ verdict: 'invalid', message: 'Fill in every box of the middle row.' })
    expect(noProduct.cell).toEqual({ row: 'products', index: 1 })
    // The middle row starts in the second column: cell 1 of the row is column 2.
    expect(cellKey(noProduct.cell!)).toBe(SD_KEYS.product(2))

    const noBottom = gradeDivisionTable(F, '2', { ...right, bottom: ['2', '1', '', '-1'] })
    expect(noBottom.grade).toMatchObject({ verdict: 'invalid', message: 'Fill in every box of the bottom row.' })
    expect(noBottom.cell).toEqual({ row: 'bottom', index: 2 })
    expect(cellKey(noBottom.cell!)).toBe(SD_KEYS.bottom(2))

    const unreadable = gradeDivisionTable(F, '2', { ...right, bottom: ['2', '1', '2x', '-1'] })
    expect(unreadable.grade.verdict).toBe('invalid')
    expect(unreadable.cell).toEqual({ row: 'bottom', index: 2 })

    // The engine stops at a wrong box. A table with a hole in it is still not an attempt.
    expect(gradeSyntheticTable(F, '2', { box: '-2', products: ['4', '', '4'], bottom: right.bottom }).verdict).toBe('mistake')
    const wrongBoxWithHole = gradeDivisionTable(F, '2', { box: '-2', products: ['4', '', '4'], bottom: right.bottom })
    expect(wrongBoxWithHole.grade.verdict).toBe('invalid')
    expect(wrongBoxWithHole.cell).toEqual({ row: 'products', index: 1 })
    // Complete, with −c in the box: the named slip.
    expect(gradeDivisionTable(F, '2', { box: '-2', products: ['-4', '14', '-28'], bottom: ['2', '-7', '14', '-33'] }).grade).toMatchObject({ verdict: 'mistake', mistake: 'sd_wrong_sign_c' })
    // A held-down key: never a throw, never blamed on the box.
    const huge = gradeDivisionTable(F, '2', { ...right, bottom: ['2', '1', '99999999999999999999999', '-1'] })
    expect(['invalid', 'wrong']).toContain(huge.grade.verdict)
    expect(huge.cell?.row).not.toBe('box')
    const hugeBox = gradeDivisionTable(F, '2', { ...right, box: '99999999999999999999999' })
    expect(['invalid', 'wrong']).toContain(hugeBox.grade.verdict)
    // A right bottom row over a wrong middle row is a plain wrong, not a pass.
    expect(gradeDivisionTable(F, '2', { ...right, products: ['4', '3', '4'] }).grade.verdict).toBe('wrong')
  })

  it('reads "none" as a remainder of 0, with or without a space after it', () => {
    const p = generateProblem('polyDivision', 'sd.factor', 2)
    const a = sd(p)
    expect(a.isFactor).toBe(true)
    const entries = { ...canonicalEntries(a), [SD_KEYS.remainder]: 'none ' }
    const parts = gradeDivisionStage({ ...a, question: 'table' }, 'answers', entries).parts
    expect(parts.map((part) => part.label)).toEqual(['Quotient', 'Remainder'])
    expect(parts[1]!.grade.verdict).toBe('correct')
  })

  it('reads her cells out of the stored boxes, and writes her work as rows for the tutor', () => {
    const entries = { row: '2, -3, 0, -5', box: '2', p1: '4', p3: '4', b0: '2', b1: '1', quotient: '2x^2 + x + 2', remainder: '' }
    expect(tableEntries(entries, 3)).toEqual({ box: '2', products: ['4', '', '4'], bottom: ['2', '1', '', ''] })
    expect(divisionWork('table', 3, '2', entries)).toEqual(['top row: 2, -3, 0, -5', 'box: 2', 'products row: 4, _, 4', 'bottom row: 2, 1, _, _', 'quotient: 2x^2 + x + 2'])
    expect(divisionWork('table', 3, '2', { row: '2, -3, -5' })).toEqual(['top row: 2, -3, -5'])
    expect(divisionWork('value', 3, '-2', { bottom: '2, -7, 14, -33', value: '-33' })).toEqual(['bottom row: 2, -7, 14, -33', 'f(-2): -33'])
    expect(divisionWork('factor', 3, '-3', { bottom: '1, -3, 2, 0', factor: 'yes' })).toEqual(['bottom row: 1, -3, 2, 0', 'factor: yes'])
    expect(divisionWork('table', 3, '2', undefined)).toEqual([])
    expect(divisionWork('value', 3, '2', {})).toEqual([])
  })
})

describe('sd.value and sd.factor', () => {
  it(
    'every bottom-row slip the engine lists is named from the list she types, and so is each wrong value',
    () => {
      for (const templateId of ['sd.value', 'sd.factor'] as const) {
        for (let seed = 1; seed <= 60; seed++) {
          const a = sd(generateProblem('polyDivision', templateId, seed))
          for (const cand of syntheticMistakes(a.f, a.c) ?? []) {
            const g = gradeDivisionStage(a, 'bottom', { [SD_KEYS.bottomRow]: cand.text }).parts[0]!.grade
            expect(g.verdict, `${a.f} ÷ ${a.divisor}: ${cand.text}`).toBe('mistake')
            if (g.verdict === 'mistake') expect(g.mistake).toBe(cand.kind)
          }
          if (templateId === 'sd.value') {
            for (const cand of remainderMistakes(a.f, a.c) ?? []) {
              const g = gradeDivisionStage(a, 'value', { [SD_KEYS.value]: cand.text }).parts[0]!.grade
              expect(g.verdict, `${a.f}: f(${a.c}) = ${cand.text}`).toBe('mistake')
              if (g.verdict === 'mistake') expect(g.mistake).toBe(cand.kind)
            }
            // A value of 0 is the factor question's business.
            expect(a.isFactor).toBe(false)
          }
        }
      }
    },
    LOOP_TIMEOUT,
  )

  it(
    'about half of sd.factor are factors, each with the sign slip live; "opposite" seeds are its mirror image',
    () => {
      let factors = 0
      const scenarios = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('polyDivision', 'sd.factor', seed)
        const a = sd(p)
        const scenario = String(p.params.scenario)
        scenarios.add(scenario)
        const opposite = polyValueAt(a.f, ratToString({ n: -Number(a.c), d: 1 }))!
        const wrong = gradeDivisionStage(a, 'factor', { [SD_KEYS.factor]: a.isFactor ? 'no' : 'yes' }).parts[0]!.grade
        if (a.isFactor) {
          factors++
          expect(scenario).toBe('factor')
          // §5: f(c) = 0 but f(−c) ≠ 0, so testing the opposite number says "no" and the engine names it.
          expect(a.remainderText).toBe('0')
          expect(opposite.n, p.id).not.toBe(0)
          expect(wrong, p.id).toMatchObject({ verdict: 'mistake', mistake: 'sd_wrong_sign_c' })
          expect(factorSlip(a.f, a.c)).toBe('sd_wrong_sign_c')
          expect(a.expectedDisplay).toContain('yes, ')
        } else if (scenario === 'opposite') {
          expect(opposite.n, p.id).toBe(0)
          expect(wrong, p.id).toMatchObject({ verdict: 'mistake', mistake: 'sd_wrong_sign_c' })
          expect(a.expectedDisplay).toContain('no, ')
        } else {
          expect(scenario).toBe('plain')
          expect(opposite.n, p.id).not.toBe(0)
          expect(wrong.verdict, p.id).toBe('wrong')
          expect(factorSlip(a.f, a.c)).toBeNull()
        }
        expect(gradeDivisionStage(a, 'factor', {}).parts[0]!.grade).toMatchObject({ verdict: 'invalid', message: 'Answer yes or no.' })
      }
      expect(factors).toBeGreaterThan(SEEDS * 0.4)
      expect(factors).toBeLessThan(SEEDS * 0.6)
      expect([...scenarios].sort()).toEqual(['factor', 'opposite', 'plain'])
    },
    LOOP_TIMEOUT,
  )
})
