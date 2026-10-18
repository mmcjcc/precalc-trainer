/**
 * Every exponential and log template, over 300 seeds: built from the seed, deterministic,
 * graded by the engine, and carrying a trap the engine names for this problem.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import type { ProblemInstance } from '@/content/types'
import {
  analyzeLogEquation,
  checkLogRewrite,
  checkLogStep,
  convertMistakes,
  gradeConvertForm,
  gradeLogEquation,
  gradeLogValue,
  isExpandedLog,
  isSingleLog,
  logEquationMistakes,
  logValueMistakes,
  type LogGrade,
  type LogMistakeCandidate,
} from '@/engine'
import { anyShows, catalogExample, numberForms, staticTexts } from './explog/text'
import { EE_RULES } from './expLogEquations/rules'
import { LF_RULES } from './logForms/rules'
import { LP_RULES } from './logProperties/rules'

const SEEDS = 300
const LOOP_TIMEOUT = 120_000
// Solving an exponential equation is the slow grader. Beside the rest of the suite it crosses two minutes.
const EQUATION_TIMEOUT = 240_000

function formsOf(p: ProblemInstance): string[] {
  const a = p.answer
  if (a.type === 'logForms') return a.question === 'value' ? numberForms(a.answerText) : [a.answerText, a.answerText.replace(/\s+/g, '')]
  if (a.type === 'logProperties') return [a.answerText]
  if (a.type === 'expLogEquations') return [a.answerText, ...a.accept]
  return []
}

function shownBefore(p: ProblemInstance): string[] {
  const a = p.answer
  if (a.type === 'logForms') return staticTexts(LF_RULES, a.formatHint, a.nudge)
  if (a.type === 'logProperties') return staticTexts(LP_RULES, a.formatHint, a.nudge)
  if (a.type === 'expLogEquations') return staticTexts(EE_RULES, a.formatHint, a.nudge)
  return []
}

function assertHidden(p: ProblemInstance): void {
  const forms = formsOf(p)
  const leaks = shownBefore(p).filter((text) => anyShows([text], forms))
  expect(leaks, `${p.id} shows an answer before she answers`).toEqual([])
  const trap = 'trap' in p.answer && p.answer.trap ? p.answer.trap : ''
  expect(anyShows([catalogExample(trap)], forms), `${p.id} catalog example of ${trap}`).toBe(false)
  // The worked solution stays off the prompt. Rung 3 is the only place it appears, and it marks the line shown.
  const prompt = 'prompt' in p.answer && p.answer.prompt ? p.answer.prompt : ''
  expect(anyShows([p.instructions, prompt], forms), p.id).toBe(false)
}

function gradeMatches(g: LogGrade, cand: LogMistakeCandidate): boolean {
  return g.verdict === 'mistake' && (g.mistake === cand.id || cand.shadows.includes(g.mistake))
}

function tally(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

describe('explog modules', () => {
  it('registers the three units after complex numbers, each with its templates', () => {
    const forms = getModule('logForms')
    const props = getModule('logProperties')
    const eqs = getModule('expLogEquations')
    expect(forms.templates.map((t) => t.id)).toEqual(['lf.value', 'lf.convert', 'lf.decimal'])
    expect(props.templates.map((t) => t.id)).toEqual(['lp.expand', 'lp.condense'])
    expect(eqs.templates.map((t) => t.id)).toEqual(['ee.exponential', 'ee.logarithmic', 'ee.quadratic'])
    expect(forms.order).toBeGreaterThan(getModule('complexNums').order)
    expect(props.order).toBeGreaterThan(forms.order)
    expect(eqs.order).toBeGreaterThan(props.order)
    expect(forms.ruleCards).toBe(LF_RULES)
    expect(props.ruleCards).toBe(LP_RULES)
    expect(eqs.ruleCards).toBe(EE_RULES)
  })
})

describe.each([
  ['logForms', 'lf.value'],
  ['logForms', 'lf.convert'],
  ['logForms', 'lf.decimal'],
] as const)('%s/%s over 300 seeds', (moduleId, templateId) => {
  it(
    'is deterministic, grades its own answer, hides it, and promises a real trap',
    () => {
      const statements = new Map<string, number>()
      const answers = new Map<string, number>()
      const traps = new Set<string>()
      let first: ProblemInstance | null = null
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        if (seed === 1) first = p
        expect(generateProblem(moduleId, templateId, seed), p.id).toEqual(p)
        if (p.answer.type !== 'logForms') throw new Error(p.id)
        const a = p.answer
        expect(p.kind).toBe('logForms')
        expect(p.statementText).toBe(a.problem)
        expect(a.trap.startsWith('log_'), p.id).toBe(true)
        const opts = a.places ? { decimal: { places: a.places } } : {}
        const right = gradeLogValue(a.problem, a.answerText, opts)
        if (a.question === 'convert') {
          expect(gradeConvertForm(a.problem, a.answerText, ['x']).verdict, p.id).toBe('correct')
        } else {
          expect(right.verdict, `${p.id} ${a.problem} = ${a.answerText}`).toBe('correct')
          if (a.question === 'value') {
            for (const form of numberForms(a.answerText)) expect(gradeLogValue(a.problem, form).verdict, form).toBe('correct')
          }
        }
        const slips = a.question === 'convert' ? [] : logValueMistakes(a.problem, opts)
        if (a.question === 'convert') {
          const cand = convertMistakes(a.problem).find((c) => c.id === a.trap && c.text === a.trapAnswer)
          expect(cand, `${p.id} ${a.trap}`).toBeTruthy()
          const g = gradeConvertForm(a.problem, a.trapAnswer, ['x'])
          expect(gradeMatches(g, cand!), p.id).toBe(true)
        } else {
          const cand = slips.find((c) => c.id === a.trap && c.text === a.trapAnswer)
          expect(cand, `${p.id} ${a.trap} ${a.trapAnswer}`).toBeTruthy()
          const g = gradeLogValue(a.problem, a.trapAnswer, opts)
          expect(gradeMatches(g, cand!), `${p.id} ${a.trap} graded ${g.verdict === 'mistake' ? g.mistake : g.verdict}`).toBe(true)
        }
        assertHidden(p)
        tally(statements, p.statementText)
        tally(answers, a.answerText)
        traps.add(a.trap)
      }
      expect(first?.seed).toBe(1)
      expect(statements.size, templateId).toBeGreaterThanOrEqual(25)
      expect(Math.max(...answers.values()), templateId).toBeLessThanOrEqual(30)
      expect(traps.size).toBeGreaterThan(0)
    },
    LOOP_TIMEOUT,
  )
})

describe.each([
  ['logProperties', 'lp.expand'],
  ['logProperties', 'lp.condense'],
] as const)('%s/%s over 300 seeds', (moduleId, templateId) => {
  it(
    'is deterministic, finishes equal to the start, hides the line, and promises a real slip',
    () => {
      const statements = new Map<string, number>()
      const answers = new Map<string, number>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        expect(generateProblem(moduleId, templateId, seed), p.id).toEqual(p)
        if (p.answer.type !== 'logProperties') throw new Error(p.id)
        const a = p.answer
        const opts = { assumePositive: true as const, vars: a.vars }
        expect(p.start).toBe(a.expr)
        expect(p.instructions).toMatch(/positive/i)
        const finished = checkLogRewrite(a.expr, a.answerText, opts)
        expect(finished.ok, `${p.id} ${a.expr} → ${a.answerText}`).toBe(true)
        expect(a.question === 'expand' ? isExpandedLog(a.answerText, a.vars) : isSingleLog(a.answerText, a.vars), p.id).toBe(true)
        let prev = a.expr
        for (const step of a.path) {
          const r = checkLogRewrite(prev, step, opts)
          expect(r.ok, `${p.id} ${prev} → ${step}`).toBe(true)
          prev = step
        }
        const slip = checkLogRewrite(a.expr, a.trapAnswer, opts)
        expect(slip.ok, p.id).toBe(false)
        expect(slip.pattern?.id, `${p.id} ${a.trapAnswer}`).toBe(a.trap)
        expect(getModule(moduleId).solved?.(p, a.answerText), p.id).toBe(true)
        expect(getModule(moduleId).solved?.(p, a.expr), p.id).toBe(false)
        assertHidden(p)
        tally(statements, p.statementText)
        tally(answers, a.answerText)
      }
      expect(statements.size, templateId).toBeGreaterThanOrEqual(25)
      expect(Math.max(...answers.values()), templateId).toBeLessThanOrEqual(30)
    },
    LOOP_TIMEOUT,
  )
})

describe.each([
  ['expLogEquations', 'ee.exponential', 'exponential'],
  ['expLogEquations', 'ee.logarithmic', 'logarithmic'],
  ['expLogEquations', 'ee.quadratic', 'exponential'],
] as const)('%s/%s over 300 seeds', (moduleId, templateId, kind) => {
  it(
    'is deterministic, solves to the promised kind, hides the solution, and promises a real trap',
    () => {
      const statements = new Map<string, number>()
      const answers = new Map<string, number>()
      const seen = new Set<string>()
      for (let seed = 1; seed <= SEEDS; seed++) {
        const p = generateProblem(moduleId, templateId, seed)
        expect(generateProblem(moduleId, templateId, seed), p.id).toEqual(p)
        if (p.answer.type !== 'expLogEquations') throw new Error(p.id)
        const a = p.answer
        expect(p.start).toBe(a.equation)
        expect(p.statementText).toBe(a.equation)
        expect(a.question).toBe(templateId === 'ee.quadratic' ? 'quadratic' : kind === 'logarithmic' ? 'logarithmic' : 'exponential')
        expect(a.path.length, p.id).toBeGreaterThan(0)
        expect(a.accept, p.id).toContain(a.answerText)
        const key = `${a.places ?? ''}|${a.equation}|${a.answerText}|${a.trap}|${a.trapAnswer}`
        if (!seen.has(key)) {
          seen.add(key)
          const analyzed = analyzeLogEquation(a.equation)
          expect(analyzed?.kind, a.equation).toBe(kind)
          const opts = a.places ? { decimal: { places: a.places } } : {}
          expect(gradeLogEquation(a.equation, a.answerText, opts).verdict, `${a.equation} = ${a.answerText}`).toBe('correct')
          for (const form of a.accept) expect(gradeLogEquation(a.equation, form, opts).verdict, form).toBe('correct')
          let prev = a.equation
          for (const step of a.path) {
            const r = checkLogStep(prev, step, { original: a.equation, vars: ['x'], seed: p.seed, ...opts })
            expect(r.ok, `${a.equation}: ${prev} → ${step} (${r.verdict})`).toBe(true)
            prev = r.normalized?.text ?? step
          }
          const g = gradeLogEquation(a.equation, a.trapAnswer, opts)
          expect(g.verdict, a.equation).toBe('mistake')
          if (g.verdict === 'mistake' && g.mistake !== a.trap) {
            const cand = logEquationMistakes(a.equation).find((c) => c.id === a.trap && c.text === a.trapAnswer)
            expect(cand?.shadows ?? [], `${a.trap} graded ${g.mistake}`).toContain(g.mistake)
          } else if (g.verdict === 'mistake') {
            expect(g.mistake).toBe(a.trap)
          }
        }
        assertHidden(p)
        tally(statements, p.statementText)
        tally(answers, a.answerText)
      }
      expect(statements.size, templateId).toBeGreaterThanOrEqual(25)
      expect(Math.max(...answers.values()), `${templateId} ${[...answers.entries()].sort((p, q) => q[1] - p[1]).slice(0, 5)}`).toBeLessThanOrEqual(30)
    },
    EQUATION_TIMEOUT,
  )
})
