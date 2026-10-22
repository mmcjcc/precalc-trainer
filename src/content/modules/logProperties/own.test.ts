/**
 * "Check my own problem" for the properties of logarithms (docs/progress/own-problem.md).
 *  - Round trip: both templates, 300 seeds: the generated expression typed as her own, with the template's kind
 *    (expand or condense), is the same kind and template with the same finished form; the generated finished form is
 *    a line her checker keeps and calls finished; the generated trap is named the same way.
 *  - Why not: what is outside the module gets its reason.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { buildOwnProblem, partsText, type OwnResult } from '@/content/own'
import { checkLogRewrite, isExpandedLog, isSingleLog } from '@/engine'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)
const LONG = { timeout: 900_000 }

function own(kind: string, text: string): OwnResult {
  return buildOwnProblem('logProperties', kind, text)
}

describe('round trip: both templates, typed back as her own problem', () => {
  for (const template of getModule('logProperties').templates) {
    const kind = template.id === 'lp.expand' ? 'expand' : 'condense'
    it(`${template.id}: same kind, template, finished form and trap over ${SEEDS.length} seeds`, LONG, () => {
      const failures: string[] = []
      for (const seed of SEEDS) {
        const gen = generateProblem('logProperties', template.id, seed)
        const g = gen.answer
        if (g.type !== 'logProperties') throw new Error('not a log expression')
        const r = own(kind, gen.statementText)
        const where = `${gen.id} "${gen.statementText}"`
        if (!r.ok) {
          failures.push(`${where}: ${r.reason.code} ${partsText(r.reason.parts)}`)
          continue
        }
        const mine = r.instance
        const m = mine.answer
        if (m.type !== 'logProperties' || mine.kind !== gen.kind || mine.templateId !== gen.templateId || m.question !== g.question) {
          failures.push(`${where}: ${mine.kind} ${mine.templateId}`)
          continue
        }
        if (m.expr !== g.expr || m.vars.join() !== g.vars.join()) failures.push(`${where}: expr ${m.expr} vars ${m.vars.join()}`)
        const opts = { assumePositive: true, vars: m.vars }
        // The same finished form: equal to the generated one, and the generated one is finished on hers.
        if (!checkLogRewrite(g.answerText, m.answerText, opts).ok) failures.push(`${where}: answer ${m.answerText} vs ${g.answerText}`)
        const genKept = checkLogRewrite(m.expr, g.answerText, opts)
        const finished = m.question === 'expand' ? isExpandedLog(g.answerText, m.vars) : isSingleLog(g.answerText, m.vars)
        if (!genKept.ok || !finished) failures.push(`${where}: generated answer ${g.answerText} kept ${genKept.ok}, finished ${finished}`)
        // The generated trap, named the same way by both checkers (her expression and her context are the same).
        const a = checkLogRewrite(g.expr, g.trapAnswer!, { assumePositive: true, vars: g.vars })
        const b = checkLogRewrite(m.expr, g.trapAnswer!, opts)
        if (a.ok || b.ok || a.pattern?.id !== b.pattern?.id || b.pattern?.id !== g.trap) failures.push(`${where}: trap ${g.trapAnswer}: ${a.pattern?.id}/${b.pattern?.id}`)
        // Her path is her finished form, which her checker keeps.
        if (m.path.join('|') !== m.answerText || mine.canonical[0]?.text !== m.answerText) failures.push(`${where}: path ${m.path.join(' | ')}`)
        if (!checkLogRewrite(m.expr, m.answerText, opts).ok) failures.push(`${where}: own answer refused`)
        if (m.trap !== undefined) failures.push(`${where}: a trap on her own problem`)
        if (mine.own !== gen.statementText) failures.push(`${where}: own ${mine.own}`)
      }
      expect(failures).toEqual([])
    })
  }
})

describe('her own expressions', () => {
  it('expands with the engine, and the rule card is the move it reads', () => {
    const r = own('expand', 'log(x^2 y / n)')
    expect(r.ok && r.instance.answer.type === 'logProperties' && [r.instance.answer.answerText, r.instance.answer.ruleCard]).toEqual(['2log(x) + log(y) - log(n)', 'lp-quotient'])
    const ids = new Set(getModule('logProperties').ruleCards.map((c) => c.id))
    expect(r.ok && ids.has(r.instance.canonical[0]!.ruleCard)).toBe(true)
  })

  it('condenses a sum with a plain number in it, the number as a log of the base', () => {
    const r = own('condense', '3 + log_2(x)')
    expect(r.ok && r.instance.answer.type === 'logProperties' && r.instance.answer.answerText).toBe('log_2(8x)')
  })
})

describe('why not: what is outside the properties of logs gets its reason', () => {
  const cases: [string, string, string, RegExp?][] = [
    ['expand', 'log(x + 2)', 'already_expanded', /sum inside a log does not split/],
    ['expand', 'log(x) + log(y)', 'already_expanded', /pick “Condense/],
    ['condense', 'log(xy)', 'already_single', /pick “Expand/],
    ['condense', 'log(x) + ln(y)', 'cannot_condense', /same base/],
    ['expand', 'log(x) = 2', 'equation', /\[expLogEquations\]/],
    ['expand', 'log_2(8)', 'no_letter', /\[logForms\]/],
    ['expand', 'x^2 y', 'no_log', /no log/],
    ['expand', 'log(ab)', 'letter', /letter a/],
    ['expand', 'log(-5x)', 'unsure'],
    ['expand', 'log(x^2', 'parenthesis', /closing parenthesis/],
    ['condense', 'log(x) +', 'missing', /missing after the \+/],
    ['expand', '', 'empty'],
    ['expand', 'ln(x ln(y))', 'log_in_log', /log inside a log/],
    ['condense', 'log(log(x)) + log(y)', 'log_in_log', /log inside a log/],
  ]
  for (const [kind, text, code, words] of cases) {
    it(`${kind} ${JSON.stringify(text)} → ${code}`, () => {
      const r = own(kind, text)
      expect(r.ok, r.ok ? r.instance.id : '').toBe(false)
      if (r.ok) return
      expect(r.reason.code).toBe(code)
      if (words) expect(partsText(r.reason.parts)).toMatch(words)
      expect(typeof r.reason.parts[0] === 'string' && /^[A-Z]/.test(r.reason.parts[0] as string)).toBe(true)
    })
  }
})
