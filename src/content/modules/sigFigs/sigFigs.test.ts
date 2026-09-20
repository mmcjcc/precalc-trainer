import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content/index'
import type { DifficultyKnobs, ProblemInstance } from '@/content/types'
import {
  countSigFigs,
  ERROR_PATTERNS,
  evaluateSigFigTask,
  gradeSigFigAnswer,
  parseSigFigNumeral,
  roundToSigFigs,
  sigFigMistakeCandidates,
  sigFigTaskTerms,
  validateSigFigTask,
} from '@/engine'
import type { SigFigCharRole, SigFigEvaluation, SigFigNumeral, SigFigTask, SigFigTerm } from '@/shared/types'
import { buildPrompt } from './build'
import { SF_RULE_IDS, SF_RULES } from './rules'

type SigFigAnswer = Extract<ProblemInstance['answer'], { type: 'sigFigs' }>

const TEMPLATE_IDS = ['sf.count', 'sf.round', 'sf.muldiv', 'sf.addsub', 'sf.mixed', 'sf.sci'] as const
const SEEDS = 300

interface Sample {
  seed: number
  instance: ProblemInstance
  answer: SigFigAnswer
  task: SigFigTask
  terms: SigFigTerm[]
  numerals: SigFigNumeral[]
  evaluation: SigFigEvaluation
}

function numeralOf(text: string): SigFigNumeral {
  const p = parseSigFigNumeral(text)
  if (!p.ok) throw new Error(`${text}: ${p.error.message}`)
  return p.numeral
}

function answerOf(p: ProblemInstance): SigFigAnswer {
  if (p.answer.type !== 'sigFigs') throw new Error(`${p.id}: answer type ${p.answer.type}`)
  return p.answer
}

const cache = new Map<string, Sample[]>()

/** Seeds 1..300 of a template, generated once per test file. */
function samples(templateId: string, knobs: DifficultyKnobs = {}, count = SEEDS): Sample[] {
  const key = `${templateId}|${JSON.stringify(knobs)}|${count}`
  const hit = cache.get(key)
  if (hit) return hit
  const out: Sample[] = []
  for (let seed = 1; seed <= count; seed++) {
    const instance = generateProblem('sigFigs', templateId, seed, knobs)
    const answer = answerOf(instance)
    const terms = sigFigTaskTerms(answer.task)
    out.push({
      seed,
      instance,
      answer,
      task: answer.task,
      terms,
      numerals: terms.map((t) => numeralOf(t.text)),
      evaluation: evaluateSigFigTask(answer.task),
    })
  }
  cache.set(key, out)
  return out
}

const hasRole = (n: SigFigNumeral, role: SigFigCharRole): boolean => n.chars.some((c) => c.role === role)
const isSci = (text: string): boolean => text.includes('x 10^')
const endsWithPoint = (text: string): boolean => text.endsWith('.')
const some = (list: Sample[], pred: (s: Sample) => boolean, label: string): void => {
  expect(list.some(pred), `no seed in 1..${list.length} shows: ${label}`).toBe(true)
}

describe('sigFigs module', () => {
  const mod = getModule('sigFigs')

  it('is registered as a Chemistry module with six templates and the rule cards', () => {
    expect(mod.id).toBe('sigFigs')
    expect(mod.subject).toBe('Chemistry')
    expect(mod.title).toBe('Significant figures')
    expect(mod.order).toBe(6)
    expect(mod.templates.map((t) => t.id)).toEqual([...TEMPLATE_IDS])
    expect(mod.ruleCards).toBe(SF_RULES)
    const ids = mod.ruleCards.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of Object.values(SF_RULE_IDS)) expect(ids).toContain(id)
    for (const card of mod.ruleCards) {
      expect(card.title.length).toBeGreaterThan(0)
      expect(card.body.length).toBeGreaterThan(20)
      expect(card.example?.length ?? 0).toBeGreaterThan(0)
    }
    for (const t of mod.templates) {
      expect(t.version).toBe(1)
      expect(t.description.length).toBeGreaterThan(0)
      for (const k of t.knobs) expect(['sciNotation', 'exactNumbers']).toContain(k.key)
    }
  })

  it('answer-only progress: one stage, no next step', () => {
    const p = generateProblem('sigFigs', 'sf.count', 42)
    expect(mod.progress(p, null, false)).toEqual({ stage: 0, total: 1, label: 'give the answer', anchorIndex: -1, path: 'none' })
    expect(mod.nextStep(p, null, false)).toBeNull()
    expect(mod.solved).toBeUndefined()
  })

  it('rule-card examples and the anchor cases of the brief hold in the engine', () => {
    const counts: [string, number][] = [
      ['0.00450', 3], ['1200', 2], ['1200.', 4], ['100.0', 4], ['5002', 4], ['0.10050', 5], ['300', 1], ['3.00e8', 3], ['40.', 2], ['0.5', 1],
      ['45.67', 4], ['10.05', 4], ['0.0045', 2], ['1.20 x 10^3', 3],
    ]
    for (const [text, n] of counts) expect(countSigFigs(text), text).toBe(n)
    expect(roundToSigFigs('0.004567', 2).text).toBe('0.0046')
    expect(roundToSigFigs('12345', 2).text).toBe('12000')
    expect(roundToSigFigs('1999', 2).text).toBe('2.0 x 10^3')
    expect(roundToSigFigs('0.99961', 3).text).toBe('1.00')
    const expected = (task: SigFigTask): string => evaluateSigFigTask(task).expected.text
    expect(expected({ kind: 'muldiv', terms: [{ text: '3.20' }, { text: '1.5' }], ops: ['*'] })).toBe('4.8')
    expect(expected({ kind: 'muldiv', terms: [{ text: '12.50' }, { text: '4.1' }], ops: ['/'] })).toBe('3.0')
    expect(expected({ kind: 'addsub', terms: [{ text: '12.11' }, { text: '18.0' }, { text: '1.013' }], ops: ['+', '+'] })).toBe('31.1')
    expect(expected({ kind: 'addsub', terms: [{ text: '5.26' }, { text: '5.21' }], ops: ['-'] })).toBe('0.05')
    expect(expected({ kind: 'muldiv', terms: [{ text: '0.325' }, { text: '12', exact: true, note: 'counted' }], ops: ['*'] })).toBe('3.90')
    expect(expected({ kind: 'mixed', operands: [{ terms: [{ text: '12.11' }, { text: '1.3' }], ops: ['+'] }, { text: '2.0' }], ops: ['/'] })).toBe('6.7')
    expect(expected({ kind: 'convert', text: '1200.', to: 'scientific' })).toBe('1.200 x 10^3')
    expect(expected({ kind: 'convert', text: '0.00450', to: 'scientific' })).toBe('4.50 x 10^-3')
  })
})

describe.each(TEMPLATE_IDS)('sigFigs/%s over 300 seeds', (templateId) => {
  it('generates a well-formed, deterministic instance whose task the engine accepts', () => {
    for (const s of samples(templateId)) {
      const { instance: p, answer: a, seed } = s
      expect(p.id).toBe(`sigFigs/${templateId}@1/${seed.toString(36)}`)
      expect(p.moduleId).toBe('sigFigs')
      expect(p.templateId).toBe(templateId)
      expect(p.skill).toBe(templateId)
      expect(p.genVersion).toBe(1)
      expect(p.kind).toBe('sigFigs')
      expect(p.vars).toEqual([])
      expect(p.start).toBeNull()
      expect(p.canonical).toEqual([])
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc).toEqual({ ti84: [], nspire: [] })
      expect(p.title.length).toBeGreaterThan(0)
      expect(p.instructions.length).toBeGreaterThan(0)
      expect(p.statementText).toBe(a.prompt)
      expect(p.params.fallback).toBe(false)
      expect(p.params.trap).toBe(a.trap)
      // Same seed, same problem.
      expect(generateProblem('sigFigs', templateId, seed)).toEqual(p)
      // The engine has no complaint and there is never a rounding tie (rule 10).
      expect(validateSigFigTask(a.task), p.id).toEqual([])
      expect(s.evaluation.tie).toBe(false)
    }
  })

  it('the canonical answer and every alternate grade correct through the engine', () => {
    for (const s of samples(templateId)) {
      const { answer: a, evaluation, instance } = s
      expect(a.expected).toBe(evaluation.expected.text)
      expect(a.expectedDisplay).toBe(evaluation.expected.display)
      expect(a.alternates).toEqual(evaluation.expected.alternates)
      for (const text of [a.expected, ...a.alternates]) {
        const g = gradeSigFigAnswer(a.task, text)
        expect(g.status, `${instance.id}: ${text} → ${g.message}`).toBe('correct')
      }
      expect(a.reveal).toEqual(evaluation.steps)
      expect(a.reveal.length).toBeGreaterThan(0)
    }
  })

  it('carries what the UI must render: prompt, context, quantities, unit, nudge, rule cards', () => {
    const mod = getModule('sigFigs')
    const cardIds = new Set(mod.ruleCards.map((c) => c.id))
    for (const s of samples(templateId)) {
      const { answer: a, terms, instance } = s
      expect(a.entry).toBe(templateId === 'sf.count' ? 'count' : 'numeral')
      expect(a.prompt.length).toBeGreaterThan(0)
      expect(a.prompt).toBe(buildPrompt(a.task, a.quantities))
      expect(a.context.length).toBeGreaterThan(0)
      expect(typeof a.unit).toBe('string')
      if (templateId === 'sf.count') {
        expect(a.unit).toBe('')
        expect(/^\d+$/.test(a.expected)).toBe(true)
      } else {
        expect(a.unit.length).toBeGreaterThan(0)
      }
      expect(a.quantities.map((q) => q.text)).toEqual(terms.map((t) => t.text))
      a.quantities.forEach((q, i) => {
        expect(q.display).toBe(s.numerals[i]!.display)
        expect(q.exact).toBe(terms[i]!.exact === true)
        if (q.exact) expect(q.note).toBeTruthy()
        expect(q.label.length).toBeGreaterThan(0)
        if (!q.exact) expect(q.unit.length, `${instance.id}: unit of ${q.text}`).toBeGreaterThan(0)
      })
      expect(a.nudge.length).toBeGreaterThan(30)
      expect(a.ruleCards.length).toBeGreaterThan(0)
      expect(a.ruleCards[0]).toBe(a.ruleCard)
      for (const id of a.ruleCards) expect(cardIds.has(id), id).toBe(true)
      // A nudge never gives the answer away.
      if (templateId !== 'sf.count') expect(a.nudge.includes(a.expectedDisplay), `${instance.id}: nudge contains ${a.expectedDisplay}`).toBe(false)
      // Scientific numerals inside a calculation are parenthesised so the × signs cannot be misread.
      if (a.task.kind === 'muldiv' || a.task.kind === 'addsub' || a.task.kind === 'mixed') {
        for (const q of a.quantities) if (isSci(q.text)) expect(a.prompt).toContain(`(${q.display} ${q.unit})`)
      }
    }
  })

  it('every named mistake the engine can expose here grades to its own id', () => {
    for (const s of samples(templateId, {}, 60)) {
      for (const c of sigFigMistakeCandidates(s.task)) {
        const g = gradeSigFigAnswer(s.task, c.text)
        expect(g.status, `${s.instance.id}: ${c.text}`).toBe('wrong')
        expect(g.pattern?.id, `${s.instance.id}: ${c.text}`).toBe(c.id)
        expect(ERROR_PATTERNS[c.id]).toBeDefined()
      }
    }
  })
})

describe('sigFigs traps appear within the first 300 seeds', () => {
  it('sf.count: leading, captive, trailing (with and without a point), trailing point, scientific', () => {
    const list = samples('sf.count')
    const n = (s: Sample) => s.numerals[0]!
    some(list, (s) => hasRole(n(s), 'leading_zero'), 'leading zeros')
    some(list, (s) => hasRole(n(s), 'captive_zero'), 'captive zeros')
    some(list, (s) => hasRole(n(s), 'trailing_zero_decimal') && !n(s).scientific, 'trailing zeros after a decimal point')
    some(list, (s) => hasRole(n(s), 'trailing_zero_placeholder'), 'placeholder trailing zeros')
    some(list, (s) => endsWithPoint(n(s).text), 'a trailing decimal point')
    some(list, (s) => n(s).scientific && n(s).sigFigs >= 3, 'scientific notation with a trailing zero or three figures')
    some(list, (s) => hasRole(n(s), 'leading_zero') && hasRole(n(s), 'captive_zero') && hasRole(n(s), 'trailing_zero_decimal'), 'all three zero kinds at once')
    // Counting a trap numeral the wrong way is diagnosed by name.
    const leading = list.find((s) => hasRole(n(s), 'leading_zero') && !hasRole(n(s), 'trailing_zero_decimal'))!
    expect(gradeSigFigAnswer(leading.task, String(n(leading).digits.length)).pattern?.id).toBe('sf_leading_zeros')
    const placeholder = list.find((s) => hasRole(n(s), 'trailing_zero_placeholder'))!
    expect(gradeSigFigAnswer(placeholder.task, String(n(placeholder).digits.length)).pattern?.id).toBe('sf_placeholder_zeros')
  })

  it('sf.round: leading zeros, placeholders, needs scientific, trailing point, carry, keep a zero, to a place, scientific input', () => {
    const list = samples('sf.round')
    const n = (s: Sample) => s.numerals[0]!
    some(list, (s) => hasRole(n(s), 'leading_zero') && s.task.kind === 'round' && s.task.sigFigs !== undefined, 'leading zeros rounded to figures')
    some(list, (s) => s.evaluation.expected.place > 0 && !isSci(s.answer.expected) && !endsWithPoint(s.answer.expected), 'placeholder zeros in the answer')
    some(list, (s) => isSci(s.answer.expected), 'an answer that needs scientific notation')
    some(list, (s) => endsWithPoint(s.answer.expected), 'an answer that needs a trailing point')
    some(list, (s) => s.evaluation.rounding === 'up' && s.evaluation.expected.value.replace(/[.0]/g, '') === '1', 'a rounding that carries to 1.00')
    some(list, (s) => /\.\d*0$/.test(s.answer.expected), 'a kept significant zero after the point')
    some(list, (s) => s.task.kind === 'round' && s.task.place !== undefined, 'rounding to a named place')
    some(list, (s) => n(s).scientific, 'a numeral given in scientific notation')
    // The classic wrong spellings are diagnosed by name.
    const sci = list.find((s) => isSci(s.answer.expected) && s.evaluation.expected.place > 0)!
    expect(gradeSigFigAnswer(sci.task, sci.evaluation.expected.value).pattern?.id).toBe('sf_ambiguous_zeros')
    const keep = list.find((s) => /\.\d*0$/.test(s.answer.expected) && !isSci(s.answer.expected))!
    expect(gradeSigFigAnswer(keep.task, keep.answer.expected.replace(/0$/, '')).pattern?.id).toBe('sf_dropped_zero')
  })

  it('sf.muldiv: quotient ending in a zero, exact count and conversion, scientific operands, rule 11, leading and placeholder zeros, three factors', () => {
    const list = samples('sf.muldiv')
    some(list, (s) => s.task.kind === 'muldiv' && s.task.ops[0] === '/' && /\.\d*0$/.test(s.answer.expected) && !isSci(s.answer.expected), 'a quotient ending in a significant zero')
    some(list, (s) => s.terms.some((t) => t.exact && t.note === 'counted'), 'an exact counted number')
    some(list, (s) => s.terms.some((t) => t.exact && t.note?.startsWith('defined')), 'an exact defined conversion')
    some(list, (s) => s.numerals.some((n) => n.scientific), 'an operand in scientific notation')
    some(list, (s) => isSci(s.answer.expected) && s.evaluation.expected.place >= 1, 'an answer that needs scientific notation')
    some(list, (s) => endsWithPoint(s.answer.expected), 'an answer that needs a trailing point')
    some(list, (s) => s.numerals.some((n) => hasRole(n, 'leading_zero') && !n.scientific), 'an operand with leading zeros')
    some(list, (s) => s.numerals.some((n, i) => hasRole(n, 'trailing_zero_placeholder') && !s.terms[i]!.exact), 'an operand with placeholder zeros')
    some(list, (s) => s.terms.length === 3, 'three factors')
    // Exact numbers never limit, and the engine says so by name when they are counted anyway.
    for (const s of list.filter((x) => x.terms.some((t) => t.exact))) {
      const exactIndex = s.terms.findIndex((t) => t.exact)
      expect(s.evaluation.limit.termIndices).not.toContain(exactIndex)
      const wrong = sigFigMistakeCandidates(s.task).find((c) => c.id === 'sf_exact_limited')
      expect(wrong, s.instance.id).toBeDefined()
    }
    const quotient = list.find((s) => s.answer.trap === 'quotient-significant-zero')!
    expect(gradeSigFigAnswer(quotient.task, quotient.answer.expected.replace(/0$/, '')).pattern?.id).toBe('sf_dropped_zero')
  })

  it('sf.addsub: subtraction loses figures, placeholder operand, trailing point, kept zero, gained figure, scientific operands', () => {
    const list = samples('sf.addsub')
    const fewest = (s: Sample) => Math.min(...s.numerals.map((n) => n.sigFigs))
    some(list, (s) => s.task.kind === 'addsub' && s.task.ops.includes('-') && s.evaluation.expected.sigFigs < fewest(s), 'a subtraction that loses figures')
    some(list, (s) => s.evaluation.expected.sigFigs === 1 && s.task.kind === 'addsub' && s.task.ops.includes('-'), 'a subtraction down to one figure')
    some(list, (s) => s.evaluation.expected.place >= 1 && s.numerals.some((n) => hasRole(n, 'trailing_zero_placeholder')), 'a placeholder operand setting a coarse place')
    some(list, (s) => endsWithPoint(s.answer.expected), 'a sum that needs a trailing point')
    some(list, (s) => /\.\d*0$/.test(s.answer.expected) && s.evaluation.expected.place === -1, 'a sum ending in a significant zero')
    some(list, (s) => s.evaluation.expected.sigFigs > Math.max(...s.numerals.map((n) => n.sigFigs)), 'a sum that gains a figure')
    some(list, (s) => s.numerals.every((n) => n.scientific), 'operands in scientific notation')
    some(list, (s) => s.terms.length === 3, 'three terms with mixed places')
    // Applying the × ÷ rule to a sum is diagnosed by name whenever it gives a different number.
    let diagnosed = 0
    for (const s of list) {
      const wrong = sigFigMistakeCandidates(s.task).find((c) => c.id === 'sf_muldiv_rule_on_addsub')
      if (wrong) {
        diagnosed++
        expect(gradeSigFigAnswer(s.task, wrong.text).pattern?.id).toBe('sf_muldiv_rule_on_addsub')
      }
    }
    expect(diagnosed).toBeGreaterThan(50)
  })

  it('sf.mixed: the subtraction limits, exact 3 and 100, rounded-early exposure, calorimetry, outer addition, scientific operands', () => {
    const list = samples('sf.mixed')
    some(
      list,
      (s) => s.evaluation.intermediates.length === 1 && s.evaluation.intermediates[0]!.rule === 'addsub' && s.evaluation.limit.termIndices.every((i) => i < 2) && s.task.kind === 'mixed' && s.task.ops[0] === '/',
      'a difference that limits a quotient',
    )
    some(list, (s) => s.terms.some((t) => t.exact && t.text === '3' && t.note === 'counted'), 'an average over three counted trials')
    some(list, (s) => s.terms.some((t) => t.exact && t.text === '100'), 'percent error with an exact 100')
    some(list, (s) => s.answer.trap === 'rounded-early' && sigFigMistakeCandidates(s.task).some((c) => c.id === 'sf_rounded_early'), 'a task that exposes rounding too early')
    some(list, (s) => s.terms.some((t) => t.text === '4.184'), 'calorimetry')
    some(list, (s) => s.task.kind === 'mixed' && s.task.ops[0] === '+', 'a product inside an addition')
    some(list, (s) => s.numerals.some((n) => n.scientific), 'operands in scientific notation')
    // Every mixed task has an intermediate the UI can ask about, with the precision named.
    for (const s of list) {
      expect(s.evaluation.intermediates.length).toBeGreaterThanOrEqual(1)
      for (const im of s.evaluation.intermediates) expect(im.placeName.length).toBeGreaterThan(0)
    }
    for (const s of list.filter((x) => x.answer.trap === 'rounded-early')) {
      const wrong = sigFigMistakeCandidates(s.task).find((c) => c.id === 'sf_rounded_early')!
      expect(gradeSigFigAnswer(s.task, wrong.text).pattern?.id).toBe('sf_rounded_early')
    }
    for (const s of list.filter((x) => x.terms.some((t) => t.exact))) {
      const wrong = sigFigMistakeCandidates(s.task).find((c) => c.id === 'sf_exact_limited')
      expect(wrong, s.instance.id).toBeDefined()
    }
  })

  it('sf.sci: both directions with leading, captive, trailing and placeholder zeros, trailing points, negative powers', () => {
    const list = samples('sf.sci')
    const n = (s: Sample) => s.numerals[0]!
    const to = (s: Sample) => (s.task.kind === 'convert' ? s.task.to : 'none')
    some(list, (s) => to(s) === 'scientific' && hasRole(n(s), 'leading_zero'), 'to scientific from leading zeros')
    some(list, (s) => to(s) === 'scientific' && hasRole(n(s), 'leading_zero') && hasRole(n(s), 'trailing_zero_decimal'), 'to scientific keeping a trailing zero')
    some(list, (s) => to(s) === 'scientific' && hasRole(n(s), 'trailing_zero_placeholder'), 'to scientific dropping placeholders')
    some(list, (s) => to(s) === 'scientific' && endsWithPoint(n(s).text), 'to scientific from a trailing point')
    some(list, (s) => to(s) === 'scientific' && hasRole(n(s), 'captive_zero'), 'to scientific with a captive zero')
    some(list, (s) => to(s) === 'scientific' && hasRole(n(s), 'trailing_zero_decimal') && !hasRole(n(s), 'leading_zero'), 'to scientific from 95.00-style zeros')
    some(list, (s) => to(s) === 'standard' && n(s).exponent < 0 && /0$/.test(s.answer.expected), 'to standard keeping a trailing zero after leading zeros')
    some(list, (s) => to(s) === 'standard' && n(s).exponent > 0 && /0$/.test(s.answer.expected) && !endsWithPoint(s.answer.expected), 'to standard with placeholder zeros')
    some(list, (s) => to(s) === 'standard' && endsWithPoint(s.answer.expected), 'to standard needing a trailing point')
    some(list, (s) => to(s) === 'standard' && /\.\d*0$/.test(s.answer.expected), 'to standard with a decimal trailing zero')
    for (const s of list) {
      expect(s.evaluation.expected.sigFigs).toBe(n(s).sigFigs)
      if (to(s) === 'scientific') expect(isSci(s.answer.expected)).toBe(true)
      else expect(isSci(s.answer.expected)).toBe(false)
    }
    // Changing the figures on the way is diagnosed by name.
    const keep = list.find((s) => to(s) === 'scientific' && hasRole(n(s), 'trailing_zero_decimal'))!
    const dropped = keep.answer.expected.replace(/0 x/, ' x').replace(/\.\s+x/, ' x').replace(/\s+x/, ' x')
    expect(gradeSigFigAnswer(keep.task, dropped).pattern?.id).toBe('sf_sci_changed_figures')
  })
})

describe('sigFigs knobs', () => {
  it('sciNotation forces a scientific numeral into every problem of the templates that honor it', () => {
    for (const id of ['sf.count', 'sf.round', 'sf.muldiv', 'sf.addsub', 'sf.mixed'] as const) {
      for (const s of samples(id, { sciNotation: true }, 60)) {
        expect(s.numerals.some((n) => n.scientific), s.instance.id).toBe(true)
        expect(s.instance.knobs).toEqual({ sciNotation: true })
      }
    }
  })

  it('exactNumbers forces an exact number into every calculation', () => {
    for (const id of ['sf.muldiv', 'sf.mixed'] as const) {
      for (const s of samples(id, { exactNumbers: true }, 60)) {
        expect(s.terms.some((t) => t.exact), s.instance.id).toBe(true)
      }
    }
  })

  it('both knobs together still produce valid problems with both features', () => {
    for (const id of ['sf.muldiv', 'sf.mixed'] as const) {
      for (const s of samples(id, { exactNumbers: true, sciNotation: true }, 40)) {
        expect(s.terms.some((t) => t.exact), s.instance.id).toBe(true)
        expect(s.numerals.some((n) => n.scientific), s.instance.id).toBe(true)
        expect(validateSigFigTask(s.task)).toEqual([])
        expect(gradeSigFigAnswer(s.task, s.answer.expected).status).toBe('correct')
      }
    }
  })

  it('knobs the template does not list are ignored without changing the problem', () => {
    const plain = generateProblem('sigFigs', 'sf.sci', 7)
    const knobbed = generateProblem('sigFigs', 'sf.sci', 7, { fractions: true, steps: 3 })
    expect(knobbed.answer).toEqual(plain.answer)
  })
})

describe('sigFigs prompt builder', () => {
  it('prints each kind of task with units and pretty numerals', () => {
    expect(buildPrompt({ kind: 'count', text: '0.00450' }, [{ text: '0.00450', unit: 'g', label: 'mass' }])).toBe('How many significant figures are in 0.00450 g?')
    expect(buildPrompt({ kind: 'round', text: '1999', sigFigs: 2 }, [{ text: '1999', unit: 'm', label: 'length' }])).toBe('Round 1999 m to 2 significant figures.')
    expect(buildPrompt({ kind: 'round', text: '31.123', place: -1 }, [{ text: '31.123', unit: 'g', label: 'mass' }])).toBe('Round 31.123 g to the nearest tenth (the tenths place).')
    expect(buildPrompt({ kind: 'convert', text: '1.20 x 10^3', to: 'standard' }, [{ text: '1.20 x 10^3', unit: 'mL', label: 'volume' }])).toBe(
      'Write 1.20 × 10³ mL in standard (ordinary decimal) notation.',
    )
    expect(
      buildPrompt({ kind: 'muldiv', terms: [{ text: '12.50' }, { text: '4.1' }], ops: ['/'] }, [
        { text: '12.50', unit: 'g', label: 'mass' },
        { text: '4.1', unit: 'mL', label: 'volume' },
      ]),
    ).toBe('12.50 g ÷ 4.1 mL')
    expect(
      buildPrompt({ kind: 'muldiv', terms: [{ text: '3.00 x 10^8' }, { text: '4.5' }], ops: ['*'] }, [
        { text: '3.00 x 10^8', unit: 'm/s', label: 'speed' },
        { text: '4.5', unit: 's', label: 'time' },
      ]),
    ).toBe('(3.00 × 10⁸ m/s) × 4.5 s')
    expect(
      buildPrompt({ kind: 'mixed', operands: [{ terms: [{ text: '25.26' }, { text: '15.11' }], ops: ['-'] }, { text: '8.2' }], ops: ['/'] }, [
        { text: '25.26', unit: 'g', label: 'full' },
        { text: '15.11', unit: 'g', label: 'empty' },
        { text: '8.2', unit: 'mL', label: 'volume' },
      ]),
    ).toBe('(25.26 g − 15.11 g) ÷ 8.2 mL')
    expect(
      buildPrompt({ kind: 'mixed', operands: [{ terms: [{ text: '1.19' }, { text: '25.0' }], ops: ['*'] }, { text: '45.27' }], ops: ['+'] }, [
        { text: '1.19', unit: 'g/mL', label: 'density' },
        { text: '25.0', unit: 'mL', label: 'volume' },
        { text: '45.27', unit: 'g', label: 'beaker' },
      ]),
    ).toBe('1.19 g/mL × 25.0 mL + 45.27 g')
  })
})
