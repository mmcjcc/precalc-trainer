import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content'
import type { AnswerSpec, ElectronsLightQuestion, ElectronsOrderQuestion, ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS, evaluateSigFigTask, gradeSigFigAnswer, parseSigFigNumeral, validateSigFigTask } from '@/engine'
import type { ErrorPatternId, SigFigTask } from '@/shared/types'
import { ECONFIG_TEMPLATE_IDS } from './econfig'
import { gradeLightAnswer, gradeSpectrumOrder, lightMistakeAnswers, LT_MISTAKE_IDS, roundEvaluation } from './grade'
import { EC_RULES } from './rules'

const TEMPLATES = ['light.freq', 'light.wavelength', 'light.energy', 'light.spectrum'] as const
const CALC = ['light.freq', 'light.wavelength', 'light.energy'] as const
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 60_000

type ElectronsAnswer = Extract<AnswerSpec, { type: 'electrons' }>

const cache = new Map<string, ProblemInstance>()

function gen(templateId: string, seed: number): { p: ProblemInstance; a: ElectronsAnswer } {
  const key = `${templateId}:${seed}`
  let p = cache.get(key)
  if (!p) {
    p = generateProblem('electrons', templateId, seed)
    cache.set(key, p)
  }
  if (p.answer.type !== 'electrons') throw new Error('expected an electrons answer')
  return { p, a: p.answer }
}

function lightOf(a: ElectronsAnswer): ElectronsLightQuestion {
  if (a.question.kind !== 'light') throw new Error('expected a light question')
  return a.question
}

function orderOf(a: ElectronsAnswer): ElectronsOrderQuestion {
  if (a.question.kind !== 'order') throw new Error('expected an ordering question')
  return a.question
}

function samples(templateId: string) {
  return SEEDS.map((seed) => gen(templateId, seed))
}

describe('electrons module registration', () => {
  it('is Chemistry, titled Electrons and light, ordered right after atomic structure', () => {
    const m = getModule('electrons')
    expect(m.subject).toBe('Chemistry')
    expect(m.title).toBe('Electrons and light')
    expect(m.blurb.toLowerCase()).toContain('configuration')
    const ids = MODULES.map((x) => x.id)
    expect(ids.indexOf('electrons')).toBe(ids.indexOf('atoms') + 1)
    expect(m.templates.map((t) => t.id)).toEqual([...TEMPLATES, ...ECONFIG_TEMPLATE_IDS])
    expect(m.progress(generateProblem('electrons', 'light.freq', 1), null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(m.nextStep(generateProblem('electrons', 'light.freq', 1), null, false)).toBeNull()
  })

  it('has the chapter rule cards, and says Hz is s^-1 once', () => {
    const cards = getModule('electrons').ruleCards
    const titles = cards.map((c) => c.title)
    for (const title of [
      'c = λν',
      'Wavelength and frequency move in opposite directions',
      'Convert nanometers to meters first',
      'Energy of one photon',
      'Higher frequency means higher energy',
      'The order of the spectrum',
      'The constants count toward significant figures',
    ]) {
      expect(titles).toContain(title)
    }
    for (const card of EC_RULES) expect(titles).toContain(card.title)
    const hz = cards.filter((c) => c.body.includes('Hz, which is s⁻¹') || (c.example ?? '').includes('Hz, which is s⁻¹'))
    expect(hz).toHaveLength(1)
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  const cardIds = new Set(getModule('electrons').ruleCards.map((c) => c.id))

  it('is deterministic, never a tie, and its canonical answer grades correct', () => {
    for (const seed of SEEDS) {
      const { p, a } = gen(templateId, seed)
      expect(generateProblem('electrons', templateId, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`electrons/${templateId}@1/${seed.toString(36)}`)
      expect(p.moduleId).toBe('electrons')
      expect(p.kind).toBe('electrons')
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.calc).toEqual({ ti84: [], nspire: [] })
      expect(p.statementText).toBe(a.prompt)
      expect(p.params.fallback).toBe(false)
      expect(a.ruleCards[0]).toBe(a.ruleCard)
      for (const id of a.ruleCards) expect(cardIds.has(id), id).toBe(true)
      expect(a.reveal.length).toBeGreaterThan(1)
      expect(a.nudge.length).toBeGreaterThan(20)

      if (a.question.kind === 'order') {
        const q = a.question
        expect(q.items.length).toBeGreaterThanOrEqual(3)
        expect(q.items.length).toBeLessThanOrEqual(5)
        expect(q.order).toHaveLength(q.items.length)
        expect(new Set(q.order).size).toBe(q.order.length)
        expect(gradeSpectrumOrder(q, q.order).status).toBe('correct')
        expect(gradeSpectrumOrder(q, [...q.order].reverse()).pattern?.id).toBe('lt_order_reversed')
        const swapped = [...q.order]
        const tmp = swapped[0]!
        swapped[0] = swapped[1]!
        swapped[1] = tmp
        expect(gradeSpectrumOrder(q, swapped).pattern?.id).not.toBe('lt_order_reversed')
        continue
      }

      const q = lightOf(a)
      expect(validateSigFigTask(q.task)).toEqual([])
      const ev = evaluateSigFigTask(q.task)
      expect(ev.tie).toBe(false)
      expect(gradeLightAnswer(q, q.expected).status, p.id).toBe('correct')
      for (const alt of q.alternates) expect(gradeLightAnswer(q, alt).status, alt).toBe('correct')
      // The prefix rounding agrees with the engine, so an lt_ match is not a float guess.
      const rounded = roundEvaluation(ev, ev.expected.sigFigs)
      expect(rounded?.value, p.id).toBe(ev.expected.value)
      // A nudge never carries the answer numeral.
      const needle = q.expectedDisplay.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(a.nudge).not.toMatch(new RegExp(needle))
    }
  }, HEAVY)
})

describe('deliberate variety across the first 300 seeds', () => {
  const all = CALC.flatMap((id) => samples(id))

  function some(label: string, pred: (a: ElectronsAnswer) => boolean) {
    expect(all.some(({ a }) => pred(a)), label).toBe(true)
  }

  it('includes two-figure nm, a trailing point, metres, scientific answers, and an answer in nm', () => {
    some('two-figure nm like 620', (a) => {
      if (a.question.kind !== 'light' || !a.question.wavelengthInNm || !a.question.wavelengthText) return false
      const n = parseSigFigNumeral(a.question.wavelengthText)
      return n.ok && n.numeral.sigFigs === 2 && a.question.given.unit === 'nm'
    })
    some('620 nm orange light (the book example)', (a) => a.context.includes('Orange light') && a.context.includes('620 nm'))
    some('trailing point 700. nm', (a) => a.question.kind === 'light' && a.question.wavelengthText === '700.')
    some('sodium 589.0 nm', (a) => a.context.includes('Sodium street lamps') && a.context.includes('589.0 nm'))
    some('wavelength already in m', (a) => a.question.kind === 'light' && a.question.formula === 'freq' && !a.question.wavelengthInNm)
    some('wavelength in m in scientific notation', (a) => {
      if (a.question.kind !== 'light' || a.question.wavelengthInNm || !a.question.wavelengthText) return false
      return a.question.wavelengthText.includes('x 10^') || a.question.wavelengthText.includes('e')
    })
    some('answer needs scientific notation', (a) => a.question.kind === 'light' && a.question.expected.includes('x 10^'))
    some('answer asked in nm', (a) => a.question.kind === 'light' && a.question.answerInNm && a.question.unit === 'nm')
    const spectrum = samples('light.spectrum').map(({ a }) => orderOf(a))
    expect(spectrum.some((q) => q.family === 'spectrum')).toBe(true)
    expect(spectrum.some((q) => q.family === 'colours')).toBe(true)
    for (const quantity of ['wavelength', 'frequency', 'energy'] as const) {
      expect(spectrum.some((q) => q.quantity === quantity), quantity).toBe(true)
    }
  })
})

describe('book worked answers', () => {
  function findLight(pred: (q: ElectronsLightQuestion) => boolean): ElectronsLightQuestion {
    for (const id of CALC) {
      for (const seed of SEEDS) {
        const { a } = gen(id, seed)
        if (a.question.kind === 'light' && pred(a.question)) return a.question
      }
    }
    throw new Error('missing book problem')
  }

  it('620 nm → 4.8 × 10^14 Hz, and 4.84 × 10^14 is a figures slip, not an lt_ mistake', () => {
    const q = findLight((x) => x.formula === 'freq' && x.wavelengthText === '620')
    expect(q.task).toEqual({
      kind: 'muldiv',
      terms: [{ text: '3.00e8' }, { text: '620' }, { text: '1e-9', exact: true, note: 'defined: 1 nm = 10^-9 m' }],
      ops: ['/', '/'],
    } satisfies SigFigTask)
    expect(gradeLightAnswer(q, '4.8e14').status).toBe('correct')
    expect(gradeLightAnswer(q, '4.8 x 10^14').status).toBe('correct')
    const extra = gradeLightAnswer(q, '4.84e14')
    const sf = gradeSigFigAnswer(q.task, '4.84e14')
    expect(extra.status).toBe('wrong')
    expect(extra.pattern?.id ?? 'plain').not.toMatch(/^lt_/)
    expect(extra.pattern?.id).toBe(sf.pattern?.id)
    expect(extra.message).toBe(sf.message)
    expect(gradeLightAnswer(q, '4.8e5').pattern?.id).toBe('lt_no_conversion')
  })

  it('5.75 × 10^14 Hz → 3.81 × 10^-19 J, and dividing h by ν is lt_energy_divided', () => {
    const q = findLight((x) => x.formula === 'energy-freq' && x.frequencyText === '5.75e14')
    expect(q.task).toEqual({ kind: 'muldiv', terms: [{ text: '6.626e-34' }, { text: '5.75e14' }], ops: ['*'] })
    expect(gradeLightAnswer(q, '3.81e-19').status).toBe('correct')
    expect(gradeLightAnswer(q, '1.15e-48').pattern?.id).toBe('lt_energy_divided')
  })

  it('700. nm → 2.84 × 10^-19 J', () => {
    const q = findLight((x) => x.formula === 'energy-wave' && x.wavelengthText === '700.')
    expect(q.task).toEqual({
      kind: 'muldiv',
      terms: [
        { text: '6.626e-34' },
        { text: '3.00e8' },
        { text: '700.' },
        { text: '1e-9', exact: true, note: 'defined: 1 nm = 10^-9 m' },
      ],
      ops: ['*', '/', '/'],
    })
    expect(gradeLightAnswer(q, '2.84e-19').status).toBe('correct')
  })

  it('4.50 × 10^14 Hz → 6.67 × 10^-7 m, or 667 nm', () => {
    const metres = findLight((x) => x.formula === 'wavelength' && x.frequencyText === '4.50e14' && !x.answerInNm)
    const nm = findLight((x) => x.formula === 'wavelength' && x.frequencyText === '4.50e14' && x.answerInNm)
    expect(gradeLightAnswer(metres, '6.67e-7').status).toBe('correct')
    expect(gradeLightAnswer(nm, '667').status).toBe('correct')
    expect(nm.task.kind === 'muldiv' && nm.task.terms.some((term) => term.text === '1e-9' && term.exact === true)).toBe(true)
    expect(gradeLightAnswer(nm, '6.67e-7').pattern?.id).toBe('lt_wrong_unit')
    expect(gradeLightAnswer(metres, '667').pattern?.id).toBe('lt_wrong_unit')
  })
})

describe('lt_ mistakes', () => {
  const lights = CALC.flatMap((id) => samples(id).map(({ a }) => lightOf(a)))

  it('each trap appears within the first 300 seeds, fires on that wrong answer, and never on the right one', () => {
    for (const id of LT_MISTAKE_IDS) {
      if (id === 'lt_order_reversed') {
        const hit = samples('light.spectrum').some(({ a }) => {
          const q = orderOf(a)
          const wrong = gradeSpectrumOrder(q, [...q.order].reverse())
          const right = gradeSpectrumOrder(q, q.order)
          return wrong.pattern?.id === id && right.status === 'correct' && right.pattern === undefined
        })
        expect(hit, id).toBe(true)
        continue
      }
      const host = lights.find((q) => lightMistakeAnswers(q, id).length > 0)
      expect(host, id).toBeTruthy()
      if (!host) continue
      expect(gradeLightAnswer(host, host.expected).status).toBe('correct')
      expect(gradeLightAnswer(host, host.expected).pattern).toBeUndefined()
      for (const text of lightMistakeAnswers(host, id)) {
        const grade = gradeLightAnswer(host, text)
        expect(grade.status, `${id} ${text}`).toBe('wrong')
        expect(grade.pattern?.id, text).toBe(id)
        expect(grade.pattern?.witness?.length).toBeGreaterThan(10)
        expect(grade.message).toBe(grade.pattern?.witness)
      }
    }
  }, HEAVY)

  it('the right value kept to too many figures gets the sig-fig grader, not an lt_ id', () => {
    let seen = 0
    for (const q of lights) {
      const ev = evaluateSigFigTask(q.task)
      const more = roundEvaluation(ev, ev.expected.sigFigs + 1)
      if (!more || more.text === q.expected || more.alternates.includes(q.expected)) continue
      const grade = gradeLightAnswer(q, more.text)
      const sf = gradeSigFigAnswer(q.task, more.text)
      expect(grade.pattern?.id ?? 'plain', `${q.formula} ${more.text}`).not.toMatch(/^lt_/)
      expect(grade.status).toBe(sf.status)
      expect(grade.pattern?.id).toBe(sf.pattern?.id)
      expect(grade.message).toBe(sf.message)
      seen++
      if (seen >= 25) break
    }
    expect(seen).toBeGreaterThan(0)
  }, HEAVY)
})

describe('lt_ catalog', () => {
  it('has a warm title, lesson and wrong → right example for every id', () => {
    for (const id of LT_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length).toBeGreaterThan(8)
      expect(info.lesson.length).toBeGreaterThan(40)
      expect(info.example).toMatch(/→/)
    }
    const ids = (Object.keys(ERROR_PATTERNS) as ErrorPatternId[]).filter((id) => id.startsWith('lt_'))
    expect(ids).toEqual([...LT_MISTAKE_IDS])
  })
})
