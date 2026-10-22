/**
 * "Check my own problem" for exponential and logarithmic equations (docs/progress/own-problem.md).
 *  - Round trip: every template, 300 seeds: the generated equation typed as her own is the same kind and template,
 *    its answer is the engine's (the same solutions, the same extraneous roots), the generated right answer is right
 *    on hers, and the generated trap is named the same way (her equation is the generated one, graded by the same
 *    grader).
 *  - Her path: every hinted line is one the flow's checker keeps, ending with the solution.
 *  - Why not: what is outside the module gets its reason.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { buildOwnProblem, partsText, type OwnResult } from '@/content/own'
import type { ProblemInstance } from '@/content/types'
import { analyzeLogEquation, checkLogStep, gradeLogEquation, parseSolutionAnswer } from '@/engine'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)
const LONG = { timeout: 900_000 }

function own(text: string): OwnResult {
  return buildOwnProblem('expLogEquations', 'solve', text)
}

function ok(text: string): ProblemInstance {
  const r = own(text)
  if (!r.ok) throw new Error(`${text}: ${r.reason.code} ${partsText(r.reason.parts)}`)
  return r.instance
}

const values = (answer: string): number[] => {
  const p = parseSolutionAnswer(answer, 'x')
  return p.ok ? p.values.map((v) => v.value).sort((a, b) => a - b) : []
}

describe('round trip: every exponential and log template, typed back as her own problem', () => {
  for (const template of getModule('expLogEquations').templates) {
    it(`${template.id}: same kind, template, answer and trap over ${SEEDS.length} seeds`, LONG, () => {
      const failures: string[] = []
      const trapsSeen = new Map<string, string>()
      for (const seed of SEEDS) {
        const gen = generateProblem('expLogEquations', template.id, seed)
        const g = gen.answer
        if (g.type !== 'expLogEquations') throw new Error('not an equation')
        const r = own(gen.statementText)
        const where = `${gen.id} "${gen.statementText}"`
        if (!r.ok) {
          failures.push(`${where}: ${r.reason.code} ${partsText(r.reason.parts)}`)
          continue
        }
        const mine = r.instance
        const m = mine.answer
        if (m.type !== 'expLogEquations' || mine.kind !== gen.kind || mine.templateId !== gen.templateId || m.question !== g.question) {
          failures.push(`${where}: ${mine.kind} ${mine.templateId} ${m.type === 'expLogEquations' ? m.question : ''}`)
          continue
        }
        if (m.equation !== g.equation) failures.push(`${where}: equation ${m.equation}`)
        // The same solutions (the generated answer may be rounded: then to its places).
        const a = analyzeLogEquation(g.equation)!
        const right = a.solutions.map((s) => s.value)
        const mineValues = values(m.answerText)
        const tol = g.places ? 0.5 * 10 ** -g.places + 1e-12 : 1e-9
        const genValues = values(g.answerText)
        if (mineValues.length !== right.length || mineValues.some((v, i) => Math.abs(v - right[i]!) > 1e-9 * Math.max(1, Math.abs(v)))) {
          failures.push(`${where}: answer ${m.answerText}`)
        }
        if (genValues.length !== mineValues.length || genValues.some((v, i) => Math.abs(v - mineValues[i]!) > tol * Math.max(1, Math.abs(v)))) {
          failures.push(`${where}: generated ${g.answerText} vs ${m.answerText}`)
        }
        // Her answer is right on hers; the generated right answer is right on hers, as the problem asks for it.
        if (gradeLogEquation(m.equation, m.answerText).verdict !== 'correct') failures.push(`${where}: own answer not right`)
        for (const form of g.accept) {
          const verdict = gradeLogEquation(m.equation, form, g.places ? { decimal: { places: g.places } } : {}).verdict
          if (verdict !== 'correct') failures.push(`${where}: generated form ${form} is ${verdict}`)
        }
        // The same extraneous roots: her trap is the engine's, when it names one.
        if (a.extraneous.length) {
          if (m.trap !== 'log_extraneous_kept' || !m.trapAnswer || values(m.trapAnswer).length !== a.candidates.length) failures.push(`${where}: trap ${m.trap} ${m.trapAnswer}`)
        } else if (m.trap !== undefined) failures.push(`${where}: a trap with no extraneous root: ${m.trap}`)
        // The generated trap, graded the same way: the equation is the same, and so is the grader.
        if (!trapsSeen.has(g.equation)) {
          const tg = gradeLogEquation(m.equation, g.trapAnswer!, g.places ? { decimal: { places: g.places } } : {})
          trapsSeen.set(g.equation, tg.verdict === 'mistake' ? tg.mistake : tg.verdict)
          if (tg.verdict !== 'mistake' || (tg.mistake !== g.trap && !(g.trap && ['log_change_base_inverted', 'log_convert_swapped'].includes(g.trap) && ['log_change_base_inverted', 'log_convert_swapped'].includes(tg.mistake)))) {
            failures.push(`${where}: trap ${g.trapAnswer} graded ${tg.verdict === 'mistake' ? tg.mistake : tg.verdict}, promised ${g.trap}`)
          }
        }
        // Her path ends with her answer, and every line is one the flow's checker keeps.
        const ctx = { original: m.equation, vars: ['x' as const], seed: mine.seed }
        let prev = m.equation
        for (const line of m.path) {
          const res = checkLogStep(prev, line, ctx)
          if (!res.ok) failures.push(`${where}: ${prev} → ${line} refused (${res.verdict})`)
          prev = res.normalized?.text ?? line
        }
        if (m.path[m.path.length - 1] !== m.answerText) failures.push(`${where}: path ends ${m.path[m.path.length - 1]}`)
        if (mine.canonical.map((s) => s.text).join('|') !== m.path.join('|')) failures.push(`${where}: canonical and path differ`)
        if (mine.own !== gen.statementText) failures.push(`${where}: own ${mine.own}`)
      }
      expect(failures).toEqual([])
    })
  }
})

describe('her own equations', () => {
  it('a log equation with an extraneous root: the engine’s lines, its trap, and the domain rule card', () => {
    const p = ok('log(x) + log(x - 3) = 1')
    expect(p.templateId).toBe('ee.logarithmic')
    const a = p.answer
    if (a.type !== 'expLogEquations') throw new Error('not an equation')
    expect(a.answerText).toBe('x = 5')
    expect(a.path).toEqual(['x(x - 3) = 10', 'x = -2 or x = 5', 'x = 5'])
    expect(a.trap).toBe('log_extraneous_kept')
    expect(a.ruleCard).toBe('ee-domain')
    const kept = gradeLogEquation(a.equation, a.trapAnswer!)
    expect(kept.verdict === 'mistake' && kept.mistake).toBe('log_extraneous_kept')
  })

  it('a quadratic in disguise: the engine’s u written back in x', () => {
    const p = ok('e^(2x) - 5e^x + 6 = 0')
    expect(p.templateId).toBe('ee.quadratic')
    expect(p.canonical.map((s) => s.text)).toEqual(['e^x = 2 or e^x = 3', 'x = ln(2) or x = ln(3)'])
    expect(p.canonical[0]!.ruleCard).toBe('ee-quadratic')
  })

  it('an exact answer the engine writes only as a decimal is written from its own log-free line', () => {
    const p = ok('ln(x + 3) = 2')
    const a = p.answer
    expect(a.type === 'expLogEquations' && a.answerText).toBe('x = e^2 - 3')
    expect(a.type === 'expLogEquations' && a.accept).toEqual(['x = e^2 - 3', 'e^2 - 3'])
  })

  it('the hint rule cards are the module’s own', () => {
    const ids = new Set(getModule('expLogEquations').ruleCards.map((c) => c.id))
    for (const text of ['2^x = 7', '3e^(2x) + 1 = 13', 'log_3(x^2 - 8x) = 2', 'log(x) + log(x - 3) = 1', '4^x - 3 * 2^x - 4 = 0']) {
      for (const s of ok(text).canonical) expect(ids.has(s.ruleCard), `${text}: ${s.ruleCard}`).toBe(true)
    }
  })
})

describe('why not: what is outside exponential and log equations gets its reason', () => {
  const cases: [string, string, RegExp?][] = [
    ['2^x = 3x', 'mixed_exponent', /both in an exponent and outside it/],
    ['log(x) = x - 2', 'mixed_log', /both inside a log and outside it/],
    ['2^x = log(x)', 'exp_and_log', /in an exponent and inside a log/],
    ['2^x = -3', 'no_solution', /no solution/],
    ['ln(x) = ln(-2)', 'undefined_number', /no value: .*is undefined/],
    ['log(-5) = x', 'undefined_number', /no value/],
    ['x^2 - 5x + 6 = 0', 'polynomial', /Zeros of polynomials are in \[polyZeros\]/],
    ['1/x = 3', 'rational', /\[rationalFns\]/],
    ['2x + 1 = 7', 'no_exp_log', /no x in an exponent or inside a log/],
    ['log(x) > 2', 'inequality', /This is an inequality/],
    ['2^x = 3^y', 'letter', /letter y/],
    ['2^x = 7 or 3^x = 2', 'several', /one equation/],
    ['2^x', 'no_relation', /no = sign/],
    ['2^x = ', 'missing', /missing after the =/],
    ['sqrt(2^x) = 4', 'function', /square root/],
    ['2^(x^2) = 16', 'power_in_power', /power inside a power/],
    ['10^x = 10^20', 'big_power', /power 20/],
    ['5 = 5', 'no_variable', /no x in it/],
    ['ln(ln(x)) = 1', 'log_in_log', /log inside a log/],
  ]
  for (const [text, code, words] of cases) {
    it(`${JSON.stringify(text)} → ${code}`, () => {
      const r = own(text)
      expect(r.ok, r.ok ? r.instance.id : '').toBe(false)
      if (r.ok) return
      expect(r.reason.code).toBe(code)
      if (words) expect(partsText(r.reason.parts)).toMatch(words)
      expect(typeof r.reason.parts[0] === 'string' && /^[A-Z]/.test(r.reason.parts[0] as string)).toBe(true)
    })
  }
})
