import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { convertExpr } from '@/content/calc/format'
import type { ProblemInstance } from '@/content/types'
import {
  ERROR_PATTERNS,
  POLY_MISTAKE_KINDS,
  analyzeFactored,
  endBehaviorMistakes,
  gradeCrossTouch,
  gradeEndBehavior,
  gradePolynomialFromZeros,
  gradeRationalZeros,
  gradeRootCandidates,
  gradeZeros,
  polynomialFromZeros,
  polynomialFromZerosMistakes,
  rationalRootCandidates,
  rootCandidateMistakes,
  zeroMistakes,
} from '@/engine'
import type { PolyMistakeKind } from '@/engine'
import { ratToString } from '@/notation'
import { POLY_PATTERN } from '@/content/modules/polynomials/patterns'
import {
  PZ_FIRST_KEY,
  PZ_KEYS,
  PZ_MAX_DEGREE,
  PZ_MAX_ROWS,
  PZ_QUESTION_STAGES,
  PZ_RULE_FOR,
  PZ_RULE_IDS,
  PZ_RULES,
  canonicalEntries,
  gradeZerosStage,
  pmShow,
  pzRuleIdFor,
  pzSelfTest,
  pzStageOf,
  pzTrapKinds,
  removeZeroRow,
  zeroRowCount,
  zeroRows,
  zerosSpec,
  zerosWork,
  type PolyZerosAnswer,
  type PolyZerosQuestion,
} from './index'

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

const TEMPLATES = [
  ['pz.zeros', 'zeros'],
  ['pz.end', 'end'],
  ['pz.build', 'build'],
  ['pz.rational', 'rational'],
] as const

function pz(p: ProblemInstance): PolyZerosAnswer {
  if (p.answer.type !== 'polyZeros') throw new Error(`${p.id}: not a polyZeros answer`)
  return p.answer
}

function answerOf(templateId: string, seed: number): PolyZerosAnswer {
  return pz(generateProblem('polyZeros', templateId, seed))
}

function find(templateId: string, pred: (a: PolyZerosAnswer, p: ProblemInstance) => boolean): PolyZerosAnswer {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const p = generateProblem('polyZeros', templateId, seed)
    if (pred(pz(p), p)) return pz(p)
  }
  throw new Error(`no ${templateId} seed`)
}

const verdict = (a: PolyZerosAnswer, stage: PolyZerosAnswer['stages'][number]['id'], entries: Record<string, string>) => gradeZerosStage(a, stage, entries).parts[0]!.grade

/** Words that would hand her the method or the trap. The sentences above the work may not use them. */
const METHOD_WORDS = /opposite|exponent|\beven\b|\bodd\b|leading|constant term|\bsign\b|factors? of|p\/q|numerator|denominator/i

describe('polyZeros module', () => {
  it('is registered after synthetic division with four templates and its own rule cards', () => {
    const mod = getModule('polyZeros')
    expect(mod.title).toBe('Zeros and end behavior')
    expect(mod.subject).toBeUndefined()
    expect(mod.templates.map((t) => t.id)).toEqual(['pz.zeros', 'pz.end', 'pz.build', 'pz.rational'])
    expect(mod.order).toBeGreaterThan(getModule('polyDivision').order)
    expect(mod.order).toBeLessThan(getModule('sigFigs').order)
    expect(mod.ruleCards).toBe(PZ_RULES)
    expect(new Set(PZ_RULES.map((c) => c.id)).size).toBe(PZ_RULES.length)
    expect(PZ_RULES.map((c) => c.id).sort()).toEqual(Object.values(PZ_RULE_IDS).sort())
    for (const template of mod.templates) expect(template.knobs).toEqual([])
  })

  it('has a rule card and a catalog lesson for every mistake kind of this module, and none for the others', () => {
    const mine = POLY_MISTAKE_KINDS.filter((k) => !k.startsWith('cs_') && !k.startsWith('sd_'))
    expect(mine).toHaveLength(12)
    expect(Object.keys(PZ_RULE_FOR).sort()).toEqual([...mine].sort())
    for (const kind of mine) {
      expect(PZ_RULES.some((c) => c.id === pzRuleIdFor(kind)), kind).toBe(true)
      const info = ERROR_PATTERNS[POLY_PATTERN[kind]]
      expect(info.title.length, kind).toBeGreaterThan(5)
      expect(info.lesson.length, kind).toBeGreaterThan(20)
    }
    expect(pzRuleIdFor('sd_subtracted')).toBeUndefined()
    expect(pzRuleIdFor('none')).toBeUndefined()
    // Every kind belongs to a part of some question, so its card can lead that part's hints.
    for (const kind of mine) expect(TEMPLATES.some(([, q]) => pzStageOf(q, kind) !== null), kind).toBe(true)
  })

  it('shows ± for +- and a real minus sign', () => {
    expect(pmShow('+-1, +-3/2, -5')).toBe('±1, ±3/2, −5')
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId, question) => {
  it(
    'is deterministic, passes the engine self-tests, grades its own answers correct, and promises a real trap',
    () => {
      const traps = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('polyZeros', templateId, seed)
        expect(generateProblem('polyZeros', templateId, seed), p.id).toEqual(p)
        const a = pz(p)
        expect(p.kind).toBe('polyZeros')
        expect(p.moduleId).toBe('polyZeros')
        expect(p.skill).toBe(templateId)
        expect(a.question).toBe(question)
        expect(p.canonical).toEqual([])
        expect(p.start).toBeNull()
        expect(p.vars).toEqual(['x'])
        // The rail's graph panel can be opened before she finishes: nothing is ever put there.
        expect(p.graph).toEqual({ kind: 'none' })

        // §5 self-tests, and every part answered with the engine's own answer grades correct.
        expect(pzSelfTest({ question, f: a.f, zeros: a.zeros, ...(a.point ? { point: a.point } : {}) }), p.id).toBeNull()
        const entries = canonicalEntries(a)
        expect(a.stages.map((s) => s.id)).toEqual(PZ_QUESTION_STAGES[question])
        for (const stage of a.stages) {
          const { parts, focus } = gradeZerosStage(a, stage.id, entries)
          expect(focus).toBeNull()
          for (const part of parts) expect(part.grade.verdict, `${p.id} ${stage.id}`).toBe('correct')
          expect(stage.nudge.length).toBeGreaterThan(40)
          expect(stage.reveal.length).toBeGreaterThan(0)
          expect(PZ_RULES.some((c) => c.id === stage.ruleCard), stage.ruleCard).toBe(true)
          expect(entries[PZ_FIRST_KEY[stage.id]]).toBeTruthy()
        }
        expect(a.nudge).toBe(a.stages[0]!.nudge)
        expect(a.reveal.length).toBeGreaterThan(1)
        expect(a.expectedDisplay.length).toBeGreaterThan(5)

        // The promised trap is one the engine names on THIS screen, and its rule card leads.
        const kinds = pzTrapKinds({ question, f: a.f, zeros: a.zeros, ...(a.point ? { point: a.point } : {}) })
        expect(kinds, `${p.id} trap ${a.trap}`).toContain(a.trap)
        expect(p.params.trap).toBe(a.trap)
        expect(a.ruleCard).toBe(pzRuleIdFor(a.trap))
        expect(a.ruleCards[0]).toBe(a.ruleCard)
        expect(new Set(a.ruleCards).size).toBe(a.ruleCards.length)
        for (const id of a.ruleCards) expect(PZ_RULES.some((c) => c.id === id), id).toBe(true)
        const trapStage = pzStageOf(question, a.trap)
        expect(trapStage, `${p.id} trap ${a.trap}`).not.toBeNull()
        expect(a.stages.find((s) => s.id === trapStage)!.ruleCard).toBe(a.ruleCard)

        // The sentences above the work say what the problem is, not how to do it. The method is the hint.
        for (const text of [p.title, p.instructions, a.prompt]) expect(text, text).not.toMatch(METHOD_WORDS)

        // A graph only where the brief has one, and a calculator panel only where a keystroke check helps.
        expect(a.graph.kind).toBe(question === 'zeros' || question === 'end' ? 'function' : 'none')
        const hasCalc = p.calc.ti84.length > 0 && p.calc.nspire.length > 0
        expect(hasCalc).toBe(question === 'zeros' || question === 'rational')
        expect(p.calc.ti84.length > 0).toBe(hasCalc)
        expect(p.calc.nspire.length > 0).toBe(hasCalc)
        traps.add(a.trap)
      }
      const expected: Record<PolyZerosQuestion, PolyMistakeKind[]> = {
        zeros: ['cross_touch_swapped', 'multiplicity_ignored', 'multiplicity_wrong_zero', 'zero_nonmonic_factor', 'zero_sign_reversed'],
        end: ['end_parity_swapped', 'end_sign_ignored'],
        build: ['lead_coefficient_omitted', 'multiplicity_ignored', 'multiplicity_wrong_zero', 'zero_sign_reversed'],
        rational: ['rrt_integers_only', 'rrt_inverted', 'rrt_no_plus_minus', 'rrt_wrong_coefficients', 'zero_sign_reversed'],
      }
      expect([...traps].sort()).toEqual(expected[question])
    },
    LOOP_TIMEOUT,
  )
})

describe('pz.zeros', () => {
  it(
    'is the engine’s reading of a product of linear factors, and every slip the engine lists is named when she types it',
    () => {
      let nonmonic = 0
      let origin = 0
      let fronted = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('polyZeros', 'pz.zeros', seed)
        const a = pz(p)
        const m = analyzeFactored(a.f)
        expect(m, p.id).not.toBeNull()
        if (!m) continue
        // The answer spec is the engine's: the text reads back unchanged, zeros ascending.
        expect(m.text).toBe(a.f)
        expect(p.statementText).toBe(a.f)
        expect(a.form).toBe('factored')
        expect(a.zeros).toEqual(m.zeros.map((z) => ({ text: z.text, mult: z.mult, behavior: z.behavior })))
        expect(a.end).toEqual(m.end)
        expect(gradeZeros(a.f, m.zeros.map((z) => ({ zero: z.text, mult: z.mult }))).verdict).toBe('correct')
        expect(gradeCrossTouch(a.f, m.zeros.map((z) => z.behavior)).verdict).toBe('correct')
        expect(gradeEndBehavior(a.f, m.end).verdict).toBe('correct')
        // Her rows may come in any order.
        const reversed = { ...canonicalEntries(a) }
        const n = a.zeros.length
        a.zeros.forEach((z, i) => {
          reversed[PZ_KEYS.zero(n - 1 - i)] = z.text
          reversed[PZ_KEYS.mult(n - 1 - i)] = String(z.mult)
        })
        expect(verdict(a, 'zeros', reversed).verdict, p.id).toBe('correct')

        // What to avoid (§5): degree above 6, big denominators, opposite zeros.
        expect(m.degree).toBeLessThanOrEqual(PZ_MAX_DEGREE)
        expect(m.degree).toBeGreaterThanOrEqual(3)
        expect(n === 2 || n === 3).toBe(true)
        for (const z of m.zeros) {
          expect(z.zero.d).toBeLessThanOrEqual(3)
          expect(m.zeros.some((o) => o !== z && o.zero.d === z.zero.d && o.zero.n === -z.zero.n), `${p.id} opposite zeros`).toBe(false)
        }
        // One zero where the graph touches and one where it crosses; the exponents are not all alike.
        expect(m.zeros.some((z) => z.behavior === 'touches'), p.id).toBe(true)
        expect(m.zeros.some((z) => z.behavior === 'crosses'), p.id).toBe(true)

        // Every wrong zero the engine lists, typed in place of the right one, is named as that slip.
        const slips = zeroMistakes(a.f) ?? []
        expect(slips.filter((c) => c.kind === 'zero_sign_reversed')).toHaveLength(m.zeros.filter((z) => z.zero.n !== 0).length)
        for (const c of slips) {
          expect(c.shadows).toEqual([])
          const entries = { ...canonicalEntries(a) }
          const at = a.zeros.findIndex((z) => z.text === ratToString(c.zero))
          expect(at, `${p.id} ${c.factor}`).toBeGreaterThanOrEqual(0)
          entries[PZ_KEYS.zero(at)] = c.text
          const g = verdict(a, 'zeros', entries)
          expect(g.verdict, `${p.id} ${c.text}`).toBe('mistake')
          if (g.verdict === 'mistake') expect(g.mistake).toBe(c.kind)
        }
        // Multiplicities all 1, and the exponents moved round the zeros.
        const ones = { ...canonicalEntries(a) }
        const moved = { ...canonicalEntries(a) }
        a.zeros.forEach((_, i) => {
          ones[PZ_KEYS.mult(i)] = '1'
          moved[PZ_KEYS.mult(i)] = String(a.zeros[(i + 1) % n]!.mult)
        })
        expect(verdict(a, 'zeros', ones)).toMatchObject({ verdict: 'mistake', mistake: 'multiplicity_ignored' })
        expect(verdict(a, 'zeros', moved)).toMatchObject({ verdict: 'mistake', mistake: 'multiplicity_wrong_zero' })
        // Any wrong crosses / touches choice.
        const swapped = { ...canonicalEntries(a), [PZ_KEYS.cross(n - 1)]: a.zeros[n - 1]!.behavior === 'crosses' ? 'touches' : 'crosses' }
        expect(verdict(a, 'cross', swapped)).toMatchObject({ verdict: 'mistake', mistake: 'cross_touch_swapped' })

        // The trap matches the problem: a number in front of x is only promised where there is one.
        if (a.trap === 'zero_nonmonic_factor') expect(p.params.nonmonic).toBe(true)
        // Hints: a nudge with no number of the answer in it, then the engine's lines for the zeros.
        expect(a.stages[0]!.reveal).toEqual(m.explanation.slice(0, n))
        expect(a.reveal).toEqual(m.explanation.slice(0, n + 3))
        expect(a.reveal.join(' ')).not.toContain('y-intercept')

        // The graph is f on a square window that holds every zero and the origin.
        expect(a.graph.f).toBe(a.f)
        const [lo, hi] = a.graph.xDomain!
        expect(lo).toBe(-hi)
        for (const z of m.zeros) expect(Math.abs(z.zero.n / z.zero.d)).toBeLessThan(hi - 1)
        // The calculator steps enter f and never name a zero.
        expect(p.calc.ti84[0]!.keys).toContain(convertExpr('ti84', a.f))
        expect(p.calc.nspire[0]!.keys).toContain(convertExpr('nspire', a.f))
        expect(JSON.stringify([p.calc.ti84.slice(1), p.calc.nspire.slice(1)])).not.toMatch(/\d\/\d|x = /)

        if (p.params.nonmonic) nonmonic++
        if (p.params.origin) origin++
        if (p.params.lead !== '1') fronted++
      }
      // A number in front of x, a zero at 0 and a number in front of the product all come up, and none is the rule.
      expect(nonmonic).toBeGreaterThan(SEEDS * 0.2)
      expect(nonmonic).toBeLessThan(SEEDS * 0.5)
      expect(origin).toBeGreaterThan(SEEDS * 0.04)
      expect(fronted).toBeGreaterThan(SEEDS * 0.4)
      expect(fronted).toBeLessThan(SEEDS * 0.8)
    },
    LOOP_TIMEOUT,
  )

  it('an empty table, a zero with no multiplicity, or an unreadable box is not an attempt, and the right box is pointed at', () => {
    const a = find('pz.zeros', (x) => x.zeros.length === 3)
    const right = canonicalEntries(a)
    let r = gradeZerosStage(a, 'zeros', {})
    expect(r.parts[0]!.grade).toMatchObject({ verdict: 'invalid', message: 'Type a zero in the first row, with its multiplicity.' })
    expect(r.focus).toBe('z0')
    // The engine's own empty notice gives a fixed example list; this one names no number.
    expect(r.parts[0]!.grade.verdict === 'invalid' && r.parts[0]!.grade.message).not.toMatch(/\d/)

    // The engine grades the zeros alone when no multiplicity is given. This question needs both.
    const bare: Record<string, string> = { rows: '3' }
    a.zeros.forEach((z, i) => (bare[PZ_KEYS.zero(i)] = z.text))
    expect(gradeZeros(a.f, zeroRows(bare)).verdict).toBe('correct')
    r = gradeZerosStage(a, 'zeros', bare)
    expect(r.parts[0]!.grade).toMatchObject({ verdict: 'invalid', message: 'Zero 1 needs its multiplicity: a positive whole number.' })
    expect(r.focus).toBe('m0')

    r = gradeZerosStage(a, 'zeros', { ...right, m1: '' })
    expect(r.parts[0]!.grade.verdict).toBe('invalid')
    expect(r.focus).toBe('m1')
    r = gradeZerosStage(a, 'zeros', { ...right, m2: '1.5' })
    expect(r.parts[0]!.grade).toMatchObject({ verdict: 'invalid', index: 2 })
    expect(r.focus).toBe('m2')
    r = gradeZerosStage(a, 'zeros', { ...right, m2: '0' })
    expect(r.focus).toBe('m2')
    r = gradeZerosStage(a, 'zeros', { ...right, z1: '3)' })
    expect(r.parts[0]!.grade).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(r.focus).toBe('z1')
    r = gradeZerosStage(a, 'zeros', { ...right, z1: '' })
    expect(r.parts[0]!.grade).toMatchObject({ verdict: 'invalid', message: 'Zero 2 is empty: type a number, or remove the row.' })
    expect(r.focus).toBe('z1')
    // The same zero twice.
    r = gradeZerosStage(a, 'zeros', { ...right, z2: right.z0! })
    expect(r.parts[0]!.grade.verdict).toBe('invalid')
    expect(r.focus).toBe('z2')

    // A spare empty row is skipped; a missing zero is a wrong answer that does not give the zero away.
    expect(verdict(a, 'zeros', { ...right, rows: '5' }).verdict).toBe('correct')
    const short = removeZeroRow(right, 2)
    expect(zeroRowCount(short)).toBe(2)
    const g = verdict(a, 'zeros', short)
    expect(g.verdict).toBe('wrong')
    if (g.verdict === 'wrong') expect(g.message).not.toContain(`x = ${a.zeros[2]!.text.replace('-', '−')}`)

    // Crosses / touches: an unanswered zero is not an attempt.
    r = gradeZerosStage(a, 'cross', { c0: 'crosses', c2: 'touches' })
    expect(r.parts[0]!.grade).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(r.focus).toBe('c1')
    expect(gradeZerosStage(a, 'cross', {}).focus).toBe('c0')
  })

  it('keeps her rows in order when one is removed, and never grows past the limit', () => {
    const entries = { rows: '3', z0: '1', m0: '2', z1: '-4', m1: '1', z2: '1/2', m2: '3', c0: 'crosses', left: 'up' }
    expect(zeroRows(entries)).toEqual([
      { zero: '1', mult: '2' },
      { zero: '-4', mult: '1' },
      { zero: '1/2', mult: '3' },
    ])
    expect(removeZeroRow(entries, 1)).toEqual({ rows: '2', z0: '1', m0: '2', z1: '1/2', m1: '3', c0: 'crosses', left: 'up' })
    expect(removeZeroRow(entries, 0)).toEqual({ rows: '2', z0: '-4', m0: '1', z1: '1/2', m1: '3', c0: 'crosses', left: 'up' })
    expect(removeZeroRow({ rows: '1', z0: '5' }, 0)).toEqual({ rows: '1' })
    expect(zeroRowCount({})).toBe(1)
    expect(zeroRowCount({ rows: 'x' })).toBe(1)
    expect(zeroRowCount({ rows: '99' })).toBe(PZ_MAX_ROWS)
    expect(PZ_MAX_ROWS).toBeGreaterThan(PZ_MAX_DEGREE)
  })
})

describe('pz.end', () => {
  it(
    'gives both forms, names each slip the engine lists, and keeps the third wrong answer plain',
    () => {
      let standard = 0
      let negative = 0
      let countNote = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('polyZeros', 'pz.end', seed)
        const a = pz(p)
        expect(p.statementText).toBe(a.f)
        expect(a.zeros).toEqual([])
        const end = a.end!
        expect(gradeEndBehavior(a.f, end).verdict, p.id).toBe('correct')
        const m = analyzeFactored(a.f)
        if (a.form === 'standard') {
          // Multiplied out: a sum, not a product of linear factors, with coefficients of two digits at most.
          expect(m, p.id).toBeNull()
          expect(a.f).toMatch(/x\^[3-5]/)
          for (const n of a.f.match(/\d+/g) ?? []) expect(Number(n), p.id).toBeLessThanOrEqual(60)
          standard++
        } else {
          expect(a.form).toBe('factored')
          expect(m?.text).toBe(a.f)
          expect(m?.end).toEqual(end)
          expect(m!.degree).toBeLessThanOrEqual(PZ_MAX_DEGREE)
        }
        expect(Number(p.params.degree)).toBeGreaterThanOrEqual(3)

        const slips = endBehaviorMistakes(a.f)!
        expect(slips.map((c) => c.kind)).toContain(a.trap)
        for (const c of slips) {
          expect(c.shadows).toEqual([])
          expect(verdict(a, 'end', { left: c.end.left, right: c.end.right })).toMatchObject({ verdict: 'mistake', mistake: c.kind })
        }
        // The promised sign slip needs a negative leading coefficient; with a positive one it cannot happen.
        const hasSign = slips.some((c) => c.kind === 'end_sign_ignored')
        expect(hasSign).toBe(String(p.params.lead).startsWith('-'))
        if (hasSign) negative++
        if (slips.some((c) => c.witness.includes('Count the exponents'))) countNote++
        // Only the right end flipped is both slips at once: a plain wrong answer, never unsupported.
        const flip = (d: string) => (d === 'up' ? 'down' : 'up')
        expect(verdict(a, 'end', { left: end.left, right: flip(end.right) }).verdict).toBe('wrong')

        expect(a.stages[0]!.reveal).toEqual(a.reveal)
        const right = gradeEndBehavior(a.f, end)
        if (right.verdict === 'correct') expect(a.reveal).toEqual(right.explanation)
        expect(a.graph.f).toBe(a.f)
        expect(a.expectedDisplay).toContain(`left end ${end.left}, right end ${end.right}`)
      }
      // Both ways of writing f are common; a negative leading coefficient is neither rare nor the rule.
      expect(standard).toBeGreaterThan(SEEDS * 0.3)
      expect(standard).toBeLessThan(SEEDS * 0.6)
      expect(negative).toBeGreaterThan(SEEDS * 0.5)
      expect(negative).toBeLessThan(SEEDS * 0.85)
      // Factored problems where counting factors instead of exponents gives the wrong pattern.
      expect(countNote).toBeGreaterThan(SEEDS * 0.15)
    },
    LOOP_TIMEOUT,
  )

  it('an end with no choice is not an attempt, and the unanswered end is pointed at', () => {
    const a = answerOf('pz.end', 1)
    let r = gradeZerosStage(a, 'end', {})
    expect(r.parts[0]!.grade.verdict).toBe('invalid')
    expect(r.focus).toBe('left')
    r = gradeZerosStage(a, 'end', { left: 'up' })
    expect(r.parts[0]!.grade.verdict).toBe('invalid')
    expect(r.focus).toBe('right')
  })
})

describe('pz.build', () => {
  it(
    'gives zeros and a point that fix one polynomial, and every slip the engine lists is named when she types it',
    () => {
      let intercept = 0
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('polyZeros', 'pz.build', seed)
        const a = pz(p)
        const spec = zerosSpec(a)
        const b = polynomialFromZeros(spec)
        expect(b, p.id).not.toBeNull()
        if (!b) continue
        // The answer is the engine's; it is never part of the statement.
        expect(a.form).toBe('hidden')
        expect(a.f).toBe(b.text)
        expect(p.statementText).not.toContain(b.text)
        expect(p.statementText).toContain(`(${a.point!.x}, ${a.point!.y})`)
        for (const z of a.zeros) expect(p.statementText).toContain(`x = ${z.text} (multiplicity ${z.mult})`)
        expect(gradePolynomialFromZeros(spec, b.text).verdict).toBe('correct')
        expect(gradePolynomialFromZeros(spec, b.expandedText).verdict).toBe('correct')
        expect(verdict(a, 'formula', { formula: `f(x) = ${b.expandedText}` }).verdict).toBe('correct')

        // Good traps (§5): a whole number in front that is not 1, one repeated zero, whole-number zeros and point.
        expect(b.a.d).toBe(1)
        expect(b.a.n).not.toBe(1)
        expect(a.zeros.filter((z) => z.mult > 1)).toHaveLength(1)
        expect(b.degree).toBeGreaterThanOrEqual(3)
        expect(b.degree).toBeLessThanOrEqual(5)
        for (const z of a.zeros) {
          expect(z.text).toMatch(/^-?[1-4]$/)
          expect(z.behavior).toBeUndefined()
          expect(a.zeros.some((o) => o.text === String(-Number(z.text))), `${p.id} opposite zeros`).toBe(false)
        }
        expect(a.point!.y).toMatch(/^-?\d+$/)
        expect(Math.abs(Number(a.point!.y))).toBeLessThanOrEqual(100)
        expect(a.zeros.some((z) => z.text === a.point!.x)).toBe(false)
        if (a.point!.x === '0') intercept++

        const slips = polynomialFromZerosMistakes(spec)!
        expect(slips.map((c) => c.kind).sort()).toEqual(['lead_coefficient_omitted', 'multiplicity_ignored', 'multiplicity_wrong_zero', 'zero_sign_reversed'])
        for (const c of slips) {
          expect(c.shadows).toEqual([])
          expect(verdict(a, 'formula', { formula: c.text })).toMatchObject({ verdict: 'mistake', mistake: c.kind })
        }
        expect(a.reveal).toEqual(b.explanation)
        expect(a.stages[0]!.nudge).not.toMatch(/\d/)
      }
      // The y-intercept is the usual point, not the only one.
      expect(intercept).toBeGreaterThan(SEEDS * 0.5)
      expect(intercept).toBeLessThan(SEEDS * 0.85)
    },
    LOOP_TIMEOUT,
  )

  it('an empty or unreadable formula, or one that is not a polynomial, is not an attempt', () => {
    const a = answerOf('pz.build', 1)
    for (const formula of ['', '   ', '2(x + 1', 'sqrt(x)', '1/x']) {
      const r = gradeZerosStage(a, 'formula', { formula })
      expect(r.parts[0]!.grade.verdict, formula).toBe('invalid')
      expect(r.focus).toBe('formula')
    }
    // Right zeros and the wrong height is a wrong answer, not a named slip.
    const tall = a.f.startsWith('-') ? `7${a.f.replace(/^-\d*/, '')}` : `-7${a.f.replace(/^\d*/, '')}`
    expect(verdict(a, 'formula', { formula: tall }).verdict).toBe('wrong')
  })
})

describe('pz.rational', () => {
  it(
    'has a list worth typing, zeros the engine found, and every slip the engine lists is named when she types it',
    () => {
      const scenarios: Record<string, number> = {}
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('polyZeros', 'pz.rational', seed)
        const a = pz(p)
        const m = rationalRootCandidates(a.f)
        expect(m, p.id).not.toBeNull()
        if (!m) continue
        expect(m.f).toBe(a.f)
        expect(p.statementText).toBe(a.f)
        expect(a.form).toBe('standard')
        expect(a.candidatesText).toBe(m.text)
        expect(a.rationalZerosText).toBe(m.zeros.map(ratToString).join(', ') || 'none')
        expect(gradeRootCandidates(a.f, m.text).verdict).toBe('correct')
        expect(gradeRationalZeros(a.f, a.rationalZerosText!).verdict).toBe('correct')
        // Every value written out, with ± glyphs, in braces: the spellings of core §2.4.
        expect(verdict(a, 'candidates', { candidates: m.candidates.map(ratToString).join(', ') }).verdict).toBe('correct')
        expect(verdict(a, 'candidates', { candidates: `{${m.text.replace(/\+-/g, '±')}}` }).verdict).toBe('correct')

        // Good traps and what to avoid (§5).
        expect(m.constant).not.toBe(0)
        expect(Math.abs(m.constant)).not.toBe(Math.abs(m.leading))
        expect([2, 3, 4, 6]).toContain(m.leading)
        expect(m.p.length).toBeGreaterThanOrEqual(2)
        expect(m.p.length).toBeLessThanOrEqual(4)
        expect(m.candidates.length).toBeLessThanOrEqual(16)
        expect(m.candidates.some((c) => c.d !== 1)).toBe(true)
        for (const n of a.f.match(/\d+/g) ?? []) expect(Number(n), p.id).toBeLessThanOrEqual(40)
        expect(a.f).toMatch(/^\d*x\^3/)
        // No zero is the opposite of another, so "every sign backwards" is a different list.
        for (const z of m.zeros) expect(m.zeros.some((o) => o.d === z.d && o.n === -z.n)).toBe(false)

        const slips = rootCandidateMistakes(a.f)!
        const kinds = new Set(slips.map((c) => c.kind))
        for (const kind of ['rrt_no_plus_minus', 'rrt_inverted', 'rrt_integers_only'] as const) expect(kinds.has(kind), `${p.id} ${kind}`).toBe(true)
        for (const c of slips) expect(verdict(a, 'candidates', { candidates: c.text }), `${p.id} ${c.text}`).toMatchObject({ verdict: 'mistake' })
        for (const c of slips.filter((s) => s.shadows.length === 0)) expect(verdict(a, 'candidates', { candidates: c.text })).toMatchObject({ mistake: c.kind })
        if (m.zeros.length > 0) {
          const backwards = m.zeros.map((z) => ratToString({ n: -z.n, d: z.d })).join(', ')
          expect(verdict(a, 'rational', { rational: backwards })).toMatchObject({ verdict: 'mistake', mistake: 'zero_sign_reversed' })
          expect(verdict(a, 'rational', { rational: 'none' }).verdict).toBe('wrong')
        } else {
          expect(a.trap).not.toBe('zero_sign_reversed')
          expect(verdict(a, 'rational', { rational: ' None ' }).verdict).toBe('correct')
          expect(verdict(a, 'rational', { rational: ratToString(m.candidates[0]!) }).verdict).toBe('wrong')
        }

        expect(a.stages[0]!.reveal).toEqual(m.explanation)
        expect(a.stages[1]!.reveal).toEqual(m.zeroExplanation)
        expect(a.reveal).toEqual([...m.explanation, ...m.zeroExplanation])
        // How to type ± is said up front; the calculator steps enter f and never list a candidate.
        expect(p.instructions).toContain('"+-1, +-3"')
        expect(p.calc.ti84[0]!.keys).toContain(convertExpr('ti84', a.f))
        expect(p.calc.nspire[0]!.keys).toContain(convertExpr('nspire', a.f))
        expect(JSON.stringify([p.calc.ti84.slice(1), p.calc.nspire.slice(1)])).not.toMatch(/\d\/\d|±|\+-|, \d/)
        expect(p.params.zeros).toBe(m.zeros.length)
        scenarios[String(p.params.scenario)] = (scenarios[String(p.params.scenario)] ?? 0) + 1
        expect(m.zeros.length).toBe(p.params.scenario === 'product' ? 3 : p.params.scenario === 'one' ? 1 : 0)
      }
      // Mostly three rational zeros; sometimes one, sometimes none at all.
      expect(scenarios.product).toBeGreaterThan(SEEDS * 0.55)
      expect(scenarios.one).toBeGreaterThan(SEEDS * 0.1)
      expect(scenarios.none).toBeGreaterThan(SEEDS * 0.04)
    },
    LOOP_TIMEOUT,
  )

  it('an empty or unreadable list is not an attempt, and the notice gives no example that could be the answer', () => {
    const a = answerOf('pz.rational', 1)
    for (const stage of ['candidates', 'rational'] as const) {
      for (const text of ['', '  ']) {
        const r = gradeZerosStage(a, stage, { [stage]: text })
        expect(r.parts[0]!.grade.verdict).toBe('invalid')
        expect(r.parts[0]!.grade.verdict === 'invalid' && r.parts[0]!.grade.message).not.toMatch(/\d/)
        expect(r.focus).toBe(stage)
      }
      for (const text of ['1, , 2', '+-1, +-x', '1; 2)']) {
        const r = gradeZerosStage(a, stage, { [stage]: text })
        expect(r.parts[0]!.grade.verdict, text).toBe('invalid')
        expect(r.focus).toBe(stage)
      }
    }
    // A number that is not on the list, and a list that is short: wrong answers, never unsupported.
    expect(verdict(a, 'candidates', { candidates: `${a.candidatesText}, +-7/5` }).verdict).toBe('wrong')
    expect(verdict(a, 'candidates', { candidates: '+-1' }).verdict).toBe('wrong')
  })
})

describe('zerosWork (her entries for the tutor)', () => {
  it('reads her boxes in order and leaves out what she has not touched', () => {
    const z = find('pz.zeros', (x) => x.zeros.length === 3)
    expect(zerosWork(z, undefined)).toEqual([])
    expect(zerosWork(z, {})).toEqual([])
    expect(zerosWork(z, { rows: '3', z0: ' 4 ', m0: '2', z2: '-1', c1: 'touches' })).toEqual(['zero 1: 4, multiplicity 2', 'zero 3: -1, multiplicity _', `at x = ${z.zeros[1]!.text}: touches`])
    const e = answerOf('pz.end', 1)
    expect(zerosWork(e, { left: 'up', right: 'down' })).toEqual(['left end: up', 'right end: down'])
    expect(zerosWork(e, { right: 'down' })).toEqual(['right end: down'])
    const b = answerOf('pz.build', 1)
    expect(zerosWork(b, { formula: '2(x - 1)' })).toEqual(['formula: 2(x - 1)'])
    const r = answerOf('pz.rational', 1)
    expect(zerosWork(r, { candidates: '+-1, +-2', rational: 'none' })).toEqual(['possible rational zeros: +-1, +-2', 'rational zeros: none'])
  })
})
