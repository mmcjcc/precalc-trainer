import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { ProblemInstance } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import {
  CX_KEYS,
  CX_MISTAKE_IDS,
  CX_RULE_FOR,
  CX_RULES,
  canonicalEntries,
  gradeCxStage,
  trapsFor,
  type ComplexNumsAnswer,
  type CxMistakeId,
  modelOf,
} from '@/content/modules/complexNums'

const SEEDS = 300
const LOOP_TIMEOUT = 120_000

const TEMPLATES = [
  ['cx.arith', 'arith'],
  ['cx.divide', 'divide'],
  ['cx.powers', 'powers'],
  ['cx.quadratic', 'quadratic'],
  ['cx.zeros', 'zeros'],
] as const

const METHOD_WORDS = /FOIL|conjugate of the|discriminant|cycle of|remainder|trap|i² as/i

const seenTraps = new Set<string>()

function answerOf(p: ProblemInstance): ComplexNumsAnswer {
  if (p.answer.type !== 'complexNums') throw new Error(`${p.id}: not complexNums`)
  return p.answer
}

function assertHidden(p: ProblemInstance, a: ComplexNumsAnswer) {
  const visible = [p.title, p.instructions, a.prompt].join('\n')
  expect(visible, p.id).not.toMatch(METHOD_WORDS)
  for (const line of a.reveal) {
    if (line.length > 24) expect(visible.includes(line), `${p.id} shows a worked line`).toBe(false)
  }
  if (a.expectedDisplay.length > 2) expect(a.prompt.includes(a.expectedDisplay), p.id).toBe(false)
  for (const stage of a.stages) {
    expect(stage.nudge.length, p.id).toBeGreaterThan(40)
    expect(stage.reveal.length, p.id).toBeGreaterThan(0)
  }
}

describe('complexNums module', () => {
  it('is registered after sign charts, with five templates and a catalog card for every slip', () => {
    const mod = getModule('complexNums')
    expect(mod.title).toBe('Complex numbers')
    expect(mod.templates.map((t) => t.id)).toEqual(['cx.arith', 'cx.divide', 'cx.powers', 'cx.quadratic', 'cx.zeros'])
    expect(mod.order).toBeGreaterThan(getModule('signCharts').order)
    expect(mod.order).toBeLessThan(getModule('sigFigs').order)
    expect(mod.ruleCards).toBe(CX_RULES)
    expect(new Set(CX_RULES.map((c) => c.id)).size).toBe(CX_RULES.length)
    for (const id of CX_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.title.length, id).toBeGreaterThan(0)
      expect(info.lesson.length, id).toBeGreaterThan(40)
      expect(info.example, id).toMatch(/✗/)
      expect(info.example, id).toMatch(/→/)
      expect(CX_RULE_FOR[id], id).toBeTruthy()
    }
    const sample = generateProblem('complexNums', 'cx.arith', 1)
    expect(mod.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1, anchorIndex: -1, path: 'none' })
    expect(mod.nextStep(sample, null, false)).toBeNull()
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId, question) => {
  it(
    'is deterministic, grades its own answers, hides them, and promises a real trap',
    () => {
      const traps = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem('complexNums', templateId, seed)
        expect(generateProblem('complexNums', templateId, seed), p.id).toEqual(p)
        const a = answerOf(p)
        expect(p.kind).toBe('complexNums')
        expect(p.moduleId).toBe('complexNums')
        expect(p.skill).toBe(templateId)
        expect(a.question).toBe(question)
        expect(p.canonical).toEqual([])
        expect(p.start).toBeNull()
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        expect(p.params.trap).toBe(a.trap)
        expect(a.ruleCard).toBe(CX_RULE_FOR[a.trap as CxMistakeId])
        expect(a.prompt.length, p.id).toBeGreaterThan(0)

        const entries = canonicalEntries(a)
        for (const stage of a.stages) {
          expect(gradeCxStage(a, stage.id, entries[CX_KEYS[stage.id]] ?? '').verdict, `${p.id} ${stage.id}`).toBe('correct')
        }
        const trap = gradeCxStage(a, a.trapStage, a.trapAnswer)
        expect(trap, `${p.id} ${a.trap}`).toMatchObject({ verdict: 'mistake', mistake: a.trap })
        expect(entries[CX_KEYS[a.trapStage]], p.id).not.toBe(a.trapAnswer)
        const live = trapsFor(modelOf(a))
        expect(
          live.some((t) => t.id === a.trap && t.text === a.trapAnswer),
          `${p.id} ${a.trap} ${a.trapAnswer}`,
        ).toBe(true)
        assertHidden(p, a)
        traps.add(a.trap)
        seenTraps.add(a.trap)
      }
      expect(traps.size, `${templateId} traps ${[...traps].join(',')}`).toBeGreaterThan(0)
    },
    LOOP_TIMEOUT,
  )
})

describe('complex number slips', () => {
  it('every named trap id except not-simplified is the promised trap of some seed', () => {
    const trapIds = CX_MISTAKE_IDS.filter((id) => id !== 'cx_not_simplified')
    for (const id of trapIds) {
      expect(seenTraps.has(id), `missing trap ${id}; have ${[...seenTraps].join(',')}`).toBe(true)
    }
  })
})
