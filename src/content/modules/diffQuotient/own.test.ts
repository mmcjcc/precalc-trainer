/**
 * "Check my own problem" for the difference quotient (docs/progress/own-problem.md).
 *  - Round trip: the line, quadratic and fraction templates, 300 seeds: the generated f typed as her own is the same
 *    kind and template with the same f(x + h), simplified answer and restrictions; every generated line is kept by her
 *    graders and the generated answer finishes hers; the f(x) + h slip is named the same way on both. Her own path is
 *    kept by the graders line by line.
 *  - The square root template is not taken back (the brief's forms are the polynomial and k/(ax + b) ones): its
 *    statement gets the square-root reason.
 *  - Why not: what is outside the module gets its reason.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { buildOwnProblem, partsText, type OwnResult } from '@/content/own'
import type { ProblemInstance } from '@/content/types'
import { exprEquivalent, substituteX } from '@/engine'
import { dqStart, dqSolved, gradeDqStep, gradeFxh } from './grade'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)
const LONG = { timeout: 900_000 }

function own(text: string): OwnResult {
  return buildOwnProblem('diffQuotient', 'dq', text)
}

function ok(text: string): ProblemInstance {
  const r = own(text)
  if (!r.ok) throw new Error(`${text}: ${r.reason.code} ${partsText(r.reason.parts)}`)
  return r.instance
}

/** Walk a path the way the flow does: f(x + h) first, then each line from the one before. Returns what refused, or null. */
function walk(p: ProblemInstance, lines: readonly string[]): string | null {
  const [fxh, ...rest] = lines
  if (!fxh || !gradeFxh(p, fxh).ok) return `f(x + h) line ${fxh}`
  let prev = dqStart(p, fxh)
  for (const line of rest) {
    const r = gradeDqStep(p, prev, line)
    if (!r.ok) return `${prev} → ${line}: ${r.verdict} ${r.pattern?.id ?? ''}`
    prev = line
  }
  return dqSolved(p, prev) ? null : `not finished at ${prev}`
}

describe('round trip: the difference-quotient templates, typed back as her own problem', () => {
  for (const templateId of ['dq.linear', 'dq.quadratic', 'dq.rational']) {
    it(`${templateId}: same kind, template, answer, restrictions and slip over ${SEEDS.length} seeds`, LONG, () => {
      const failures: string[] = []
      for (const seed of SEEDS) {
        const gen = generateProblem('diffQuotient', templateId, seed)
        const g = gen.answer
        if (g.type !== 'diffQuotient') throw new Error('not a difference quotient')
        const r = own(gen.statementText)
        const where = `${gen.id} "${gen.statementText}"`
        if (!r.ok) {
          failures.push(`${where}: ${r.reason.code} ${partsText(r.reason.parts)}`)
          continue
        }
        const mine = r.instance
        const m = mine.answer
        if (m.type !== 'diffQuotient' || mine.kind !== gen.kind || mine.templateId !== gen.templateId) {
          failures.push(`${where}: ${mine.kind} ${mine.templateId}`)
          continue
        }
        if (m.f !== g.f || m.fxh !== g.fxh) failures.push(`${where}: f ${m.f} fxh ${m.fxh}`)
        if (!exprEquivalent(m.simplified, g.simplified, ['x', 'h'], seed).equivalent) failures.push(`${where}: simplified ${m.simplified} vs ${g.simplified}`)
        if (m.restrictions.join('|') !== g.restrictions.join('|')) failures.push(`${where}: restrictions ${m.restrictions.join(', ')}`)
        if (mine.statementText !== gen.statementText || mine.vars.join() !== gen.vars.join()) failures.push(`${where}: statement`)
        // The generated lines are kept by her graders, and the generated answer finishes hers.
        const genBad = walk(mine, gen.canonical.map((s) => s.text))
        if (genBad) failures.push(`${where}: generated path on hers: ${genBad}`)
        // Her own path, line by line.
        const myBad = walk(mine, mine.canonical.map((s) => s.text))
        if (myBad) failures.push(`${where}: her path: ${myBad}`)
        // The f(x) + h slip, named the same way on both (for x + b that IS f(x + h): then f(x) + f(h)).
        const plusH = `${g.f} + h`
        const [slip, id] = gradeFxh(gen, plusH).ok ? [`${g.f} + ${substituteX(g.f, 'h')}`, 'dq_fx_plus_fh'] : [plusH, 'dq_fx_plus_h']
        const a = gradeFxh(gen, slip)
        const b = gradeFxh(mine, slip)
        if (a.ok || b.ok || a.pattern?.id !== b.pattern?.id || b.pattern?.id !== id) failures.push(`${where}: slip ${slip} ${a.pattern?.id}/${b.pattern?.id}`)
        if (mine.own !== gen.statementText.replace(/^f\(x\) = /, 'y = ') && mine.own !== gen.statementText) failures.push(`${where}: own ${mine.own}`)
      }
      expect(failures).toEqual([])
    })
  }

  it('dq.radical is not taken back: the square-root reason', () => {
    for (const seed of SEEDS.slice(0, 20)) {
      const gen = generateProblem('diffQuotient', 'dq.radical', seed)
      const r = own(gen.statementText)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason.code).toBe('square_root')
    }
  })
})

describe('her own functions', () => {
  it('a number over ax + b with a leading number below: her numbers, the path kept by the graders', () => {
    const p = ok('f(x) = 3/(2x + 1)')
    expect(p.templateId).toBe('dq.rational')
    expect(p.answer.type === 'diffQuotient' && [p.answer.f, p.answer.simplified, p.answer.restrictions]).toEqual([
      '3/(2x + 1)',
      '-6/((2x + 1)(2x + 2h + 1))',
      ['h != 0', 'x != -1/2', 'x + h != -1/2'],
    ])
    expect(walk(p, p.canonical.map((s) => s.text))).toBeNull()
  })

  it('the quadratic of the template’s worked example, and its rule cards are the module’s own', () => {
    const p = ok('f(x) = 3x^2 + 2x - 1')
    expect(p.answer.type === 'diffQuotient' && p.answer.simplified).toBe('6x + 3h + 2')
    expect(p.canonical.map((s) => s.ruleCard).every((id) => ['fxh', 'square-binomial', 'distribute', 'minus-parens', 'combine-like', 'factor-h', 'common-denominator'].includes(id))).toBe(true)
  })
})

describe('why not: what is outside the difference quotient gets its reason', () => {
  const cases: [string, string, RegExp?][] = [
    ['sqrt(x + 1)', 'square_root', /square root/],
    ['x^3 + 1', 'higher_degree', /x\^\{3\}/],
    ['(1/2)x^2', 'fractions', /whole numbers/],
    ['2^x', 'not_form', /not one of the forms/],
    ['1/x^2', 'not_form', /not one of the forms/],
    ['3/x + 2', 'not_form', /not one of the forms/],
    ['7', 'constant', /no x in it/],
    ['100x + 1', 'number_too_big', /up to 50/],
    ['f(x) = 3x^2 + h', 'letter', /^This has two letters, x and h, and here f is written in x alone\.$/],
    ['f(t) = 3t^2 + 1', 'letter', /letter t, .*; type it with x in place of t, and I can check it\.$/],
    ['g(x) = 3x^2 + 1', 'letter', /calls the function g, .*; type it as f\(x\) = 3x\^\{2\}\+1, and I can check it\.$/],
    ['3x^2 + 2x - 1 = 0', 'not_function', /Type the function/],
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
