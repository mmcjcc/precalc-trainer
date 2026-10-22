/**
 * "Check my own problem" for completing the square (docs/progress/own-problem.md).
 *  - Round trip: the cs.form template, 300 seeds: the generated quadratic typed as her own is the same kind, template
 *    and question, with the same vertex form, vertex, axis and extremum; the generated right answer is right on hers,
 *    and the generated trap (a slipped vertex form) is named the same way by both.
 *  - The vertex question (cs.vertex) is not hers to type: it is listed in the progress log.
 *  - Why not: what is outside the module gets its reason.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { buildOwnProblem, partsText, type OwnResult } from '@/content/own'
import { checkSquareLine, gradeVertexForm, squareMistakes } from '@/engine'

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13)
const LONG = { timeout: 900_000 }

function own(text: string): OwnResult {
  return buildOwnProblem('quadratics', 'form', text)
}

describe('round trip: cs.form, typed back as her own problem', () => {
  it(`same kind, template, vertex form and trap over ${SEEDS.length} seeds (both knob settings)`, LONG, () => {
    const failures: string[] = []
    for (const seed of SEEDS) {
      for (const knobs of [{}, { fractions: true }]) {
        const gen = generateProblem('quadratics', 'cs.form', seed, knobs)
        const g = gen.answer
        if (g.type !== 'quadratics') throw new Error('not a quadratic')
        const r = own(gen.statementText)
        const where = `${gen.id}${knobs.fractions ? ' (fractions)' : ''} "${gen.statementText}"`
        if (!r.ok) {
          failures.push(`${where}: ${r.reason.code} ${partsText(r.reason.parts)}`)
          continue
        }
        const mine = r.instance
        const m = mine.answer
        if (m.type !== 'quadratics' || mine.kind !== gen.kind || mine.templateId !== gen.templateId || m.question !== g.question) {
          failures.push(`${where}: ${mine.kind} ${mine.templateId}`)
          continue
        }
        for (const key of ['f', 'vertexForm', 'vertexText', 'axisText', 'opens', 'extremumKind', 'extremumText', 'expectedDisplay', 'nudge'] as const) {
          if (m[key] !== g[key]) failures.push(`${where}: ${key} ${m[key]} vs ${g[key]}`)
        }
        if (JSON.stringify(m.path) !== JSON.stringify(g.path) || JSON.stringify(m.reveal) !== JSON.stringify(g.reveal)) failures.push(`${where}: path or reveal`)
        // The generated right answer is right on hers; every line of the engine's path is still f.
        if (gradeVertexForm(m.f, g.vertexForm).verdict !== 'correct') failures.push(`${where}: right answer`)
        for (const line of g.path) if (checkSquareLine(m.f, line.text).verdict !== 'correct') failures.push(`${where}: path line ${line.text}`)
        // The generated trap: the slipped form it promises, named the same way on both.
        const slip = (squareMistakes(g.f) ?? []).find((c) => c.kind === g.trap)
        if (!slip) failures.push(`${where}: no candidate for the trap ${g.trap}`)
        else {
          const a = checkSquareLine(g.f, slip.text)
          const b = checkSquareLine(m.f, slip.text)
          if (a.verdict !== 'mistake' || b.verdict !== 'mistake' || a.mistake !== b.mistake) failures.push(`${where}: trap ${slip.text} ${a.verdict}/${b.verdict}`)
        }
        // Her own trap is a slip the engine lists for her quadratic.
        if (!(squareMistakes(m.f) ?? []).some((c) => c.kind === m.trap)) failures.push(`${where}: own trap ${m.trap}`)
        if (mine.own !== gen.statementText) failures.push(`${where}: own ${mine.own}`)
      }
    }
    expect(failures).toEqual([])
  })
})

describe('her own quadratics', () => {
  it('in any polynomial form: f is shown multiplied out, as the template shows it', () => {
    const r = own('x(2x - 12) + 13')
    expect(r.ok && r.instance.answer.type === 'quadratics' && [r.instance.answer.f, r.instance.answer.vertexForm]).toEqual(['2x^2 - 12x + 13', '2(x - 3)^2 - 5'])
    const f = own('f(x) = 0.5x^2 + 3x - 1')
    expect(f.ok && f.instance.answer.type === 'quadratics' && f.instance.answer.vertexForm).toBe('(1/2)(x + 3)^2 - 11/2')
  })
})

describe('why not: what is outside completing the square gets its reason', () => {
  const cases: [string, string, RegExp?][] = [
    ['x^2 + 4', 'already_vertex', /vertex form already/],
    ['2(x - 3)^2 - 5', 'already_vertex', /vertex form already/],
    ['x^3 + x', 'higher_degree', /\[polyZeros\]/],
    ['2x + 1', 'linear', /no x\^\{2\} term/],
    ['x^2 - 5x + 6 = 0', 'equation', /This is an equation.*\[polyZeros\]/],
    ['sqrt(x) + x^2', 'not_polynomial', /not a quadratic polynomial/],
    ['1/x + x^2', 'not_polynomial'],
    ['7', 'no_variable', /no x in it/],
    ['x^2 + 2xy', 'letter', /letter y/],
    ['x^2 +', 'missing', /missing after the \+/],
    ['x^2 + 123456x', 'number_too_big', /123456/],
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
