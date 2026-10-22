/**
 * "Check my own problem" for exponential and logarithmic equations (docs/progress/own-problem.md).
 *  - Round trip: every template, 300 seeds: the generated equation typed as her own, with the same answer form (exact,
 *    or rounded to the generated problem's places), is the same kind and template; its answer is the engine's (the same
 *    solutions, the same extraneous roots); a rounded one says and takes what the rounded template does (places, prompt,
 *    format hint, answer text, accept list); the generated right answer is right on hers, and the generated trap is
 *    named the same way (her equation is the generated one, graded by the same grader).
 *  - Her path: every hinted line is one the flow's checker keeps (with her places), ending with the solution.
 *  - Rounding: 3^x = 20 to three places takes 2.727 and treats 2.73 as the module does; equations the engine solves
 *    only as decimals are hers once rounded.
 *  - Why not: what is outside the module gets its reason.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { buildOwnProblem, ownProblemId, partsText, type OwnResult } from '@/content/own'
import type { ProblemInstance } from '@/content/types'
import { analyzeLogEquation, checkLogStep, gradeLogEquation, parseSolutionAnswer } from '@/engine'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)
const LONG = { timeout: 900_000 }

function own(text: string, places?: number): OwnResult {
  return buildOwnProblem('expLogEquations', 'solve', text, places ? { places } : {})
}

function ok(text: string, places?: number): ProblemInstance {
  const r = own(text, places)
  if (!r.ok) throw new Error(`${text}: ${r.reason.code} ${partsText(r.reason.parts)}`)
  return r.instance
}

const values = (answer: string): number[] => {
  const p = parseSolutionAnswer(answer, 'x')
  return p.ok ? p.values.map((v) => v.value).sort((a, b) => a - b) : []
}

describe('round trip: every exponential and log template, typed back as her own problem', () => {
  for (const template of getModule('expLogEquations').templates) {
    it(`${template.id}: same kind, template, answer and trap over ${SEEDS.length} seeds (rounded ones rounded)`, LONG, () => {
      const failures: string[] = []
      const trapsSeen = new Map<string, string>()
      let rounded = 0
      for (const seed of SEEDS) {
        const gen = generateProblem('expLogEquations', template.id, seed)
        const g = gen.answer
        if (g.type !== 'expLogEquations') throw new Error('not an equation')
        // She picks what her homework asks for: the generated problem's places, or the exact answer.
        const r = own(gen.statementText, g.places)
        const where = `${gen.id} "${gen.statementText}"${g.places ? ` to ${g.places} places` : ''}`
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
        const decimal = g.places ? { decimal: { places: g.places } } : {}
        const a = analyzeLogEquation(g.equation)!
        const right = a.solutions.map((s) => s.value)
        if (g.places) {
          rounded++
          // Rounded: what the rounded template says and takes, word for word.
          for (const key of ['places', 'prompt', 'formatHint', 'answerText', 'expectedDisplay'] as const) {
            if (m[key] !== g[key]) failures.push(`${where}: ${key} ${String(m[key])} vs ${String(g[key])}`)
          }
          if (JSON.stringify(m.accept) !== JSON.stringify(g.accept)) failures.push(`${where}: accept ${m.accept.join(' ; ')} vs ${g.accept.join(' ; ')}`)
        } else {
          // Exact: the same solutions.
          const mineValues = values(m.answerText)
          const genValues = values(g.answerText)
          if (mineValues.length !== right.length || mineValues.some((v, i) => Math.abs(v - right[i]!) > 1e-9 * Math.max(1, Math.abs(v)))) {
            failures.push(`${where}: answer ${m.answerText}`)
          }
          if (genValues.length !== mineValues.length || genValues.some((v, i) => Math.abs(v - mineValues[i]!) > 1e-9 * Math.max(1, Math.abs(v)))) {
            failures.push(`${where}: generated ${g.answerText} vs ${m.answerText}`)
          }
          if (m.places !== undefined || m.prompt !== g.prompt) failures.push(`${where}: prompt ${m.prompt}`)
        }
        // Her answer is right on hers; the generated right answer is right on hers, as the problem asks for it.
        if (gradeLogEquation(m.equation, m.answerText, decimal).verdict !== 'correct') failures.push(`${where}: own answer not right`)
        for (const form of g.accept) {
          const verdict = gradeLogEquation(m.equation, form, decimal).verdict
          if (verdict !== 'correct') failures.push(`${where}: generated form ${form} is ${verdict}`)
        }
        // The same extraneous roots: her trap is the engine's, when it names one.
        if (a.extraneous.length) {
          if (m.trap !== 'log_extraneous_kept' || !m.trapAnswer || values(m.trapAnswer).length !== a.candidates.length) failures.push(`${where}: trap ${m.trap} ${m.trapAnswer}`)
        } else if (m.trap !== undefined) failures.push(`${where}: a trap with no extraneous root: ${m.trap}`)
        // The generated trap, graded the same way: the equation is the same, and so is the grader.
        const trapKey = `${g.places ?? ''}|${g.equation}`
        if (!trapsSeen.has(trapKey)) {
          const tg = gradeLogEquation(m.equation, g.trapAnswer!, decimal)
          trapsSeen.set(trapKey, tg.verdict === 'mistake' ? tg.mistake : tg.verdict)
          if (tg.verdict !== 'mistake' || (tg.mistake !== g.trap && !(g.trap && ['log_change_base_inverted', 'log_convert_swapped'].includes(g.trap) && ['log_change_base_inverted', 'log_convert_swapped'].includes(tg.mistake)))) {
            failures.push(`${where}: trap ${g.trapAnswer} graded ${tg.verdict === 'mistake' ? tg.mistake : tg.verdict}, promised ${g.trap}`)
          }
        }
        // Her path: every line one the flow's checker keeps (with her places, as the flow calls it), ending with the
        // solution: her exact answer, or on a rounded problem the solution as a line (exact where the engine has it).
        const ctx = { original: m.equation, vars: ['x' as const], seed: mine.seed, ...decimal }
        let prev = m.equation
        for (const line of m.path) {
          const res = checkLogStep(prev, line, ctx)
          if (!res.ok) failures.push(`${where}: ${prev} → ${line} refused (${res.verdict})`)
          prev = res.normalized?.text ?? line
        }
        const last = m.path[m.path.length - 1]!
        if (g.places) {
          const lastValues = values(last)
          if (lastValues.length !== right.length || lastValues.some((v, i) => Math.abs(v - right[i]!) > 0.5 * 10 ** -g.places! + 1e-9)) failures.push(`${where}: path ends ${last}`)
        } else if (last !== m.answerText) failures.push(`${where}: path ends ${last}`)
        if (mine.canonical.map((s) => s.text).join('|') !== m.path.join('|')) failures.push(`${where}: canonical and path differ`)
        if (mine.own !== gen.statementText) failures.push(`${where}: own ${mine.own}`)
        // Its id holds the places: the exact and the rounded problem never share saved lines.
        if (mine.id !== ownProblemId('expLogEquations', gen.templateId, gen.statementText, g.places ? `r${g.places}` : '')) failures.push(`${where}: id ${mine.id}`)
      }
      expect(failures).toEqual([])
      if (template.id === 'ee.exponential') expect(rounded).toBeGreaterThan(SEEDS.length / 10)
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

describe('her answer rounded, as her homework asks', () => {
  /** What the flow does with her answer box (LogLineFlow: gradeLogEquation with the problem's places). */
  const box = (p: ProblemInstance, typed: string) => {
    const a = p.answer
    if (a.type !== 'expLogEquations') throw new Error('not an equation')
    return gradeLogEquation(a.equation, typed, { vars: ['x'], ...(a.places ? { decimal: { places: a.places } } : {}) })
  }

  it('3^x = 20 to three places: 2.727 is right, and 2.73 is "rounded too far", as on a rounded template problem', () => {
    const p = ok('3^x = 20', 3)
    const a = p.answer
    if (a.type !== 'expLogEquations') throw new Error('not an equation')
    expect([a.places, a.prompt, a.answerText, a.accept, a.formatHint]).toEqual([3, 'Solve. Round to three decimal places.', '2.727', ['2.727'], 'List every solution. You may write x = the number, or just the number.'])
    expect(box(p, '2.727').verdict).toBe('correct')
    expect(box(p, 'x = 2.727').verdict).toBe('correct')
    const short = box(p, '2.73')
    expect(short).toMatchObject({ verdict: 'invalid', reason: 'not_rounded' })
    // The module's own rounded problem (3^x = 13 to three places, seed 25: x = 2.3347…) says the same to a two-place
    // answer.
    const gen = generateProblem('expLogEquations', 'ee.exponential', 25)
    expect(gen.answer.type === 'expLogEquations' && [gen.answer.equation, gen.answer.places]).toEqual(['3^x = 13', 3])
    expect(box(gen, '2.33')).toMatchObject({ verdict: 'invalid', reason: 'not_rounded', message: 'message' in short ? short.message : '' })
    // The exact answer is not what a rounded problem asks for; on the exact problem it is the answer.
    expect(box(p, 'log(20)/log(3)').verdict).toBe('invalid')
    expect(box(ok('3^x = 20'), 'log(20)/log(3)').verdict).toBe('correct')
    // Her lines on the way: the exact solution line is kept, and so is the rounded one on a rounded problem.
    expect(a.path).toEqual(['x = log(20)/log(3)'])
    expect(checkLogStep('3^x = 20', 'x = 2.727', { original: '3^x = 20', vars: ['x'], seed: p.seed, decimal: { places: 3 } }).ok).toBe(true)
  })

  it('ln(x) + ln(x - 2) = 1, which the engine solves only as a decimal: hers once rounded, x ≈ 2.928', () => {
    const exact = own('ln(x) + ln(x - 2) = 1')
    expect(!exact.ok && exact.reason.code).toBe('not_exact')
    expect(!exact.ok && partsText(exact.reason.parts)).toMatch(/If it asks you to round, pick how many decimal places, and I can check it\./)
    const p = ok('ln(x) + ln(x - 2) = 1', 3)
    const a = p.answer
    if (a.type !== 'expLogEquations') throw new Error('not an equation')
    expect([p.templateId, a.answerText, a.places]).toEqual(['ee.logarithmic', '2.928', 3])
    expect(a.prompt).toBe('Solve. Round to three decimal places. Check every answer in the original equation.')
    expect(box(p, '2.928').verdict).toBe('correct')
    expect(box(p, '2.93')).toMatchObject({ verdict: 'invalid', reason: 'not_rounded' })
    // Keeping −0.928, outside the logs' domain, is the slip this one is known for.
    expect(a.trap).toBe('log_extraneous_kept')
    expect(box(p, a.trapAnswer!)).toMatchObject({ verdict: 'mistake', mistake: 'log_extraneous_kept' })
    expect(a.path[a.path.length - 1]).toBe('x = 2.928')
  })

  it('ln(x + 1) - ln(x) = 1 to three places: x ≈ 0.582, with e written as e in the hint lines', () => {
    const p = ok('ln(x + 1) - ln(x) = 1', 3)
    const a = p.answer
    if (a.type !== 'expLogEquations') throw new Error('not an equation')
    expect(a.answerText).toBe('0.582')
    expect(a.path.every((line) => !line.includes('e^1'))).toBe(true)
    expect(box(p, '0.582').verdict).toBe('correct')
  })

  it('one place and four: the words follow the number', () => {
    expect(ok('ln(x) = 2', 1).answer).toMatchObject({ places: 1, prompt: 'Solve. Round to one decimal place. Check every answer in the original equation.', answerText: '7.4' })
    expect(ok('5^x = 3^(x + 1)', 4).answer).toMatchObject({ places: 4, prompt: 'Solve. Round to four decimal places.', answerText: '2.1507' })
  })

  it('several solutions rounded: the rounded templates have one, so it says to pick the exact answer', () => {
    const r = own('e^(2x) - 5e^x + 6 = 0', 3)
    expect(!r.ok && r.reason.code).toBe('round_several')
    expect(!r.ok && partsText(r.reason.parts)).toMatch(/two solutions.*pick “Exact answer” to check it exactly\./)
    expect(own('e^(2x) - 5e^x + 6 = 0').ok).toBe(true)
  })

  it('the exact and the rounded problem are two problems: their ids differ, and the tutor’s server takes each', () => {
    const ids = [ok('3^x = 20').id, ok('3^x = 20', 2).id, ok('3^x = 20', 3).id]
    expect(new Set(ids).size).toBe(3)
    expect(ids[2]).toBe(ownProblemId('expLogEquations', 'ee.exponential', '3^x = 20', 'r3'))
    for (const id of ids) expect(/^[A-Za-z0-9_.:@/#?=&+-]{1,200}$/.test(`${id}#${Date.now().toString(36)}`)).toBe(true)
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
    ['2^x = 3^y', 'letter', /^This has two letters, x and y, and here the equation is in x alone\.$/],
    ['3^t = 20', 'letter', /^This uses the letter t, and here the equation is in x alone; type it with x in place of t, and I can check it\.$/],
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
