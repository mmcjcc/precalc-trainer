/**
 * "Check my own problem" for linear inequalities (docs/progress/own-problem.md).
 *  - Round trip: every template, 300 seeds: the generated statement typed as her own problem is the same kind and
 *    template, has the same exact answer, its right answer is right on both, every line of the generated path is a
 *    line both checkers keep, and the template's trap (dividing by a negative without flipping) is named the same way.
 *  - Her real quiz (src/problem/quiz1.regression.test.ts): −13x − 20 ≥ −3(2x − 5) typed as her own, her lines replayed.
 *  - Why not: what is outside the module gets its reason.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { buildOwnProblem, ownProblemFromRoute, ownProblemId, partsText, type OwnResult } from '@/content/own'
import type { ProblemInstance } from '@/content/types'
import { verifyStep } from '@/engine'
import { compareAnswerSet, crossCheck, parseInterval, parseSetBuilder, setsEqual } from '@/notation'
import type { SolutionSet, StepContext } from '@/shared/types'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)
const LONG = { timeout: 600_000 }

function own(text: string): OwnResult {
  return buildOwnProblem('inequalities', 'solve', text)
}

function ok(text: string): ProblemInstance {
  const r = own(text)
  if (!r.ok) throw new Error(`${text}: ${r.reason.code} ${partsText(r.reason.parts)}`)
  return r.instance
}

/** The checker's context, as the flow builds it (problem/stepEngine.ts buildStepContext). */
function ctxOf(p: ProblemInstance): StepContext {
  return {
    vars: p.vars,
    seed: p.seed,
    allowSwap: false,
    checkValue: p.check?.k,
    canonical: [...p.canonical, ...(p.canonicalAlt ?? [])].map((s) => s.text),
    moduleId: p.moduleId,
  }
}

/** Her answer boxes as the flow grades them (problem/inequality.ts gradeFinalAnswer, from the notation layer). */
function gradeFinalAnswer(interval: string, builder: string, target: { set: SolutionSet }): { done: boolean } {
  const i = parseInterval(interval)
  const b = parseSetBuilder(builder)
  if (!i.ok || !b.ok || !crossCheck(i.set, b.set).agree) return { done: false }
  return { done: compareAnswerSet(i.set, target.set).equal && compareAnswerSet(b.set, target.set).equal }
}

const UNFLIP: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }

/** The line with every inequality symbol turned back (the slip of dividing by a negative and not flipping). */
function unflipped(line: string): string {
  return line.replace(/<=|>=|<|>/g, (op) => UNFLIP[op]!)
}

describe('round trip: every inequality template, typed back as her own problem', () => {
  for (const template of getModule('inequalities').templates) {
    it(`${template.id}: same kind, template, answer, path and trap over ${SEEDS.length} seeds`, LONG, () => {
      const failures: string[] = []
      for (const seed of SEEDS) {
        const gen = generateProblem('inequalities', template.id, seed)
        const r = own(gen.statementText)
        if (!r.ok) {
          failures.push(`${gen.id} "${gen.statementText}": ${r.reason.code} ${partsText(r.reason.parts)}`)
          continue
        }
        const mine = r.instance
        const where = `${gen.id} "${gen.statementText}"`
        if (mine.kind !== gen.kind) failures.push(`${where}: kind ${mine.kind}`)
        if (mine.templateId !== gen.templateId) failures.push(`${where}: template ${mine.templateId}`)
        if (mine.vars.join() !== gen.vars.join()) failures.push(`${where}: vars ${mine.vars.join()}`)
        if (mine.answer.type !== 'set' || gen.answer.type !== 'set') {
          failures.push(`${where}: not a set answer`)
          continue
        }
        if (!setsEqual(mine.answer.set, gen.answer.set)) failures.push(`${where}: set ${mine.answer.interval} vs ${gen.answer.interval}`)
        if (mine.answer.interval !== gen.answer.interval || mine.answer.setBuilder !== gen.answer.setBuilder) {
          failures.push(`${where}: printed ${mine.answer.interval} ${mine.answer.setBuilder}`)
        }
        // The generated problem's right answer is right on hers.
        const target = { set: mine.answer.set, requireInterval: true, requireSetBuilder: true }
        if (!gradeFinalAnswer(gen.answer.interval, gen.answer.setBuilder, target).done) failures.push(`${where}: right answer not right`)
        // Every generated line is kept by both checkers; the trap is named the same way on both.
        const genCtx = ctxOf(gen)
        const myCtx = ctxOf(mine)
        let prev = gen.start!
        for (const s of gen.canonical) {
          const a = verifyStep(prev, s.text, genCtx)
          const b = verifyStep(prev, s.text, myCtx)
          if (!a.ok || !b.ok) failures.push(`${where}: ${prev} → ${s.text} kept ${a.ok}/${b.ok}`)
          if (s.tag === 'mul_div_neg_flip') {
            const slip = unflipped(s.text)
            const sa = verifyStep(prev, slip, genCtx)
            const sb = verifyStep(prev, slip, myCtx)
            if (sa.ok || sb.ok || sa.pattern?.id !== sb.pattern?.id || sb.pattern?.id !== 'no_sign_flip') {
              failures.push(`${where}: trap ${prev} → ${slip}: ${sa.pattern?.id}/${sb.pattern?.id}`)
            }
          }
          prev = s.text
        }
        // Her own path ends where the generated one does.
        const myLast = mine.canonical[mine.canonical.length - 1]?.text ?? mine.start!
        const genLast = gen.canonical[gen.canonical.length - 1]!.text
        if (!verifyStep(myLast, genLast, myCtx).ok) failures.push(`${where}: own path ends at ${myLast}, not ${genLast}`)
        // Her own problem is marked hers, and its id is built from the statement.
        if (mine.own !== gen.statementText || mine.id !== ownProblemId('inequalities', gen.templateId, gen.statementText)) {
          failures.push(`${where}: own ${mine.own} id ${mine.id}`)
        }
      }
      expect(failures).toEqual([])
    })
  }
})

describe('her own problem: Precalculus Quiz 1, question 2', () => {
  // As she wrote it, with the keypad's signs.
  const quiz = '−13x − 20 ≥ −3(2x − 5)'

  it('is checked as a linear inequality to distribute, with the answer x ≤ −5', () => {
    const p = ok(quiz)
    expect(p.kind).toBe('inequality')
    expect(p.templateId).toBe('ineq.distribute')
    expect(p.statementText).toBe('-13x - 20 >= -3(2x - 5)')
    expect(p.answer.type === 'set' && p.answer.interval).toBe('(-inf, -5]')
    expect(p.canonical.map((s) => s.text)).toEqual(['-13x - 20 >= -6x + 15', '-7x - 20 >= 15', '-7x >= 35', 'x <= -5'])
  })

  it('names dividing by −7 without flipping, as the quiz regression does, and keeps the rest of her lines', () => {
    const p = ok(quiz)
    const ctx = ctxOf(p)
    expect(verifyStep(p.start!, '-13x - 20 >= -6x + 15', ctx).ok).toBe(true)
    expect(verifyStep('-13x - 20 >= -6x + 15', '-7x - 20 >= 15', ctx).ok).toBe(true)
    expect(verifyStep('-7x - 20 >= 15', '-7x >= 35', ctx).ok).toBe(true)
    const slip = verifyStep('-7x >= 35', 'x >= -5', ctx)
    const regression = verifyStep('-7x >= 35', 'x >= -5', { vars: ['x'], seed: 1 })
    expect(slip.ok).toBe(false)
    expect(slip.pattern?.id).toBe('no_sign_flip')
    expect(slip.pattern?.id).toBe(regression.pattern?.id)
    expect(verifyStep('-7x >= 35', 'x <= -5', ctx).ok).toBe(true)
    const target = p.answer.type === 'set' ? { set: p.answer.set, requireInterval: true, requireSetBuilder: true } : null
    expect(gradeFinalAnswer('(-inf, -5]', '{x | x <= -5}', target!).done).toBe(true)
  })

  it('is the same problem with the keypad’s signs or typed ones, extra spaces or not, and its route rebuilds it', () => {
    const a = ok(quiz)
    const b = ok('  -13x  - 20 >= -3(2x - 5) ')
    expect(b.id).toBe(a.id)
    expect(b.seed).toBe(a.seed)
    const back = ownProblemFromRoute('inequalities', a.templateId, a.own)
    expect(back.ok && back.instance.id).toBe(a.id)
  })
})

describe('what she is asked, and the path she is hinted', () => {
  it('a chain, an "or" and a fraction coefficient', () => {
    const chain = ok('2 < 3x + 5 <= 11')
    expect(chain.templateId).toBe('ineq.compound')
    expect(chain.canonical.map((s) => s.text)).toEqual(['-3 < 3x <= 6', '-1 < x <= 2'])
    const flip = ok('-3 < -3x <= 6')
    expect(flip.canonical.map((s) => [s.text, s.tag])).toEqual([
      ['1 > x >= -2', 'mul_div_neg_flip'],
      ['-2 <= x < 1', 'swap_sides'],
    ])
    const or = ok('2x + 1 < 3 or x - 4 > 5')
    expect(or.answer.type === 'set' && or.answer.interval).toBe('(-inf, 1) U (9, inf)')
    expect(or.canonical.map((s) => s.text)).toEqual(['2x < 2 or x > 9', 'x < 1 or x > 9'])
    const and = ok('x + 1 > 2 and x < 5')
    expect(and.answer.type === 'set' && and.answer.interval).toBe('(1, 5)')
    const frac = ok('(3/5)y + 2 <= 8')
    expect(frac.templateId).toBe('ineq.fraction')
    expect(frac.vars).toEqual(['y'])
    expect(frac.canonical.at(-1)).toMatchObject({ text: 'y <= 10', tag: 'reciprocal_multiply', ruleCard: 'reciprocal' })
    const r = own('(3/5)y + 2 <= 8')
    expect(r.ok && partsText(r.asks)).toBe('Solve for y; give the answer in interval and set notation.')
  })

  it('every hinted line uses the module’s own rule cards', () => {
    const ids = new Set(getModule('inequalities').ruleCards.map((c) => c.id))
    for (const text of ['-13x - 20 >= -3(2x - 5)', '2 < 3x + 5 <= 11', '-3 < -3x <= 6', '0.5x + 1.25 > 3', '7 - 2x >= 3x + 22', '2x + 1 < 3 or -x - 4 > 5']) {
      for (const s of ok(text).canonical) expect(ids.has(s.ruleCard), `${text}: ${s.ruleCard}`).toBe(true)
    }
  })

  it('a line already solved has no path: the answer boxes open at once', () => {
    expect(ok('x > 3').canonical).toEqual([])
    expect(ok('1 < x < 5').canonical).toEqual([])
  })
})

describe('why not: what is outside linear inequalities gets its reason', () => {
  const cases: [string, string, RegExp?][] = [
    ['x^2 - 4 > 0', 'polynomial', /Polynomial inequalities are in \[signCharts\]/],
    ['x(x - 3) < 4', 'polynomial', /multiplies x by x/],
    ['1/(x - 2) >= 3', 'rational', /Rational inequalities are in \[signCharts\]/],
    ['3x + 2y > 5', 'two_variables', /two letters, x and y/],
    ['2^x > 4 + x', 'exponent', /in an exponent/],
    ['abs(2x - 1) < 5', 'absolute_value', /absolute value/],
    ['sqrt(x) > 2', 'function', /square root/],
    ['2x + 1 < 2x + 3', 'identity', /always true, so the solution set is all real numbers/],
    ['2x + 1 > 2x + 3', 'contradiction', /never true, so there is no solution/],
    ['3x + 1 = 7', 'equation', /This is an equation/],
    ['3x + 1 <', 'missing', /missing after the </],
    ['3x +', 'missing', /missing after the \+/],
    ['2 < 3 < 4', 'no_variable', /no letter/],
    ['100x > 9000', 'far_answer', /farther from 0 than 50/],
    ['x > pi', 'irrational', /answer boxes here take whole numbers, fractions and decimals/],
    ['2t + 1 > 5', 'letter', /^This uses the letter t, .*; type it with x in place of t, and I can check it\.$/],
    ['2a + 3b > 5', 'letter', /^This has two letters, a and b, and here I check inequalities in one letter/],
    ['x < 1 < x + 2', 'chain_outer', /outer parts are numbers/],
    ['1 < x < 2 < 3', 'too_many', /more than two inequalities/],
    ['x > 2 or 3 < 5', 'part_without_variable', /One part comes down to/],
    ['9^9^9 > x', 'power_in_power', /power inside a power/],
    ['x^20 > 1', 'big_power', /power 20/],
    ['x + 1 > ' + '1+'.repeat(60) + '1', 'too_long', /120 characters/],
    ['((((((((x)))))))) > 1', 'too_deep', /parentheses inside parentheses/],
    ['x > 123456', 'number_too_big', /123456/],
    ['[x + 1] > 2', 'bracket', /Square brackets/],
    ['x +- 2 > 1', 'plus_minus', /±/],
    ['', 'empty', /Type your problem/],
    ['x # 2 > 1', 'character', /character here I can’t read: #/],
    ['1/0 < x', 'undefined_number', /no value/],
    ['log(-5) < x', 'undefined_number', /no value/],
    ['x > 1.23456', 'decimals', /decimal places/],
    ['2x + 3', 'no_relation', /no inequality sign/],
  ]
  for (const [text, code, words] of cases) {
    it(`${JSON.stringify(text.length > 40 ? `${text.slice(0, 40)}…` : text)} → ${code}`, () => {
      const r = own(text)
      expect(r.ok, r.ok ? r.instance.id : '').toBe(false)
      if (r.ok) return
      expect(r.reason.code).toBe(code)
      const sentence = partsText(r.reason.parts)
      if (words) expect(sentence).toMatch(words)
      // Never a sentence that starts with a symbol.
      expect(typeof r.reason.parts[0] === 'string' && /^[A-Z]/.test(r.reason.parts[0] as string)).toBe(true)
    })
  }
})
