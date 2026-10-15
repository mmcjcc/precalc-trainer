/** Inputs from the review of Honors Geometry Unit 1 (Gemini and the reviewer, 2026-10-15). */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { gradeGeoStage } from './grade'

const problem = (module: string, template: string, seed: number) =>
  generateProblem(module as never, template, seed).answer as GeometryAnswer
const verdict = (a: GeometryAnswer, stage: 'x' | 'result', text: string) => gradeGeoStage(a, stage, text).verdict
const said = (a: GeometryAnswer, stage: 'x' | 'result', text: string) => {
  const g = gradeGeoStage(a, stage, text)
  return g.verdict === 'mistake' ? g.witness : g.message
}

describe('geometry answers, after review', () => {
  // B is between A and C, AB = 2x + 3, BC = 5x − 4, AC = 41: x = 6, AB = 15.
  const segment = problem('geoSegments', 'gs.addition', 1)
  // Distance from (0, 0) to (3, 6): 3√5.
  const distance = problem('geoSegments', 'gs.coord', 42)
  // Midpoint of (2, 4) and (8, 10): (5, 7).
  const midpoint = problem('geoSegments', 'gs.coord', 1)
  // Complementary, m∠1 = 4x + 2 and m∠2 = 5x + 34: x = 6, m∠1 = 26.
  const pair = problem('geoAngles', 'ga.pairs', 1)
  // 12 more than twice its complement: 64.
  const words = problem('geoAngles', 'ga.words', 1)

  it('the problems are the ones these cases were written for', () => {
    expect(segment.stages.map((s) => s.answerText)).toEqual(['6', '15'])
    expect(distance.stages[0]!.answerText).toBe('3√5')
    expect(midpoint.stages[0]!.answerText).toBe('(5, 7)')
    expect(pair.stages.map((s) => s.answerText)).toEqual(['6', '26'])
    expect(words.stages[0]!.answerText).toBe('64')
  })

  it('reads a unicode minus and a named value', () => {
    expect(verdict(segment, 'x', 'x = 6')).toBe('correct')
    expect(verdict(segment, 'result', 'AB = 15')).toBe('correct')
    expect(verdict(pair, 'result', 'm∠1 = 26')).toBe('correct')
    expect(verdict(words, 'result', 'a = 64')).toBe('correct')
    expect(verdict(segment, 'x', '−6')).toBe('wrong')
    // An equation is not a name: "2x = 12" is not read as 12.
    expect(verdict(segment, 'x', '2x = 12')).toBe('invalid')
  })

  it('a degree sign belongs on an angle measure only', () => {
    expect(verdict(pair, 'result', '26°')).toBe('correct')
    expect(verdict(words, 'result', '64 degrees')).toBe('correct')
    expect(verdict(segment, 'result', '15°')).toBe('invalid')
    expect(said(segment, 'result', '15°')).toMatch(/not an angle measure/)
    expect(verdict(pair, 'x', '6°')).toBe('invalid')
  })

  it('a point without parentheses, or in the wrong part, is a note, not a wrong answer', () => {
    expect(verdict(midpoint, 'result', '(5, 7)')).toBe('correct')
    expect(verdict(midpoint, 'result', '5, 7')).toBe('invalid')
    expect(said(midpoint, 'result', '5, 7')).toMatch(/parentheses/)
    expect(verdict(midpoint, 'result', '5')).toBe('invalid')
    expect(verdict(segment, 'result', '(15, 0)')).toBe('invalid')
    expect(verdict(midpoint, 'result', '(7, 5)')).toBe('wrong')
  })

  it('a product of radicals is not simplest form', () => {
    expect(verdict(distance, 'result', '3√5')).toBe('correct')
    expect(verdict(distance, 'result', '3 sqrt(5)')).toBe('correct')
    expect(verdict(distance, 'result', 'sqrt(5) * sqrt(9)')).toBe('invalid')
    expect(verdict(distance, 'result', '√3√15')).toBe('invalid')
  })

  it('a calculator decimal for an exact answer asks for the exact value without giving it', () => {
    for (const typed of ['6.708', '6.71', '6.7082']) {
      expect(verdict(distance, 'result', typed), typed).toBe('invalid')
      expect(said(distance, 'result', typed), typed).toMatch(/exact value, in simplest radical form/)
      expect(said(distance, 'result', typed), typed).not.toMatch(/3√5|3 sqrt/)
    }
    // Far from the answer, a decimal is just wrong.
    expect(verdict(distance, 'result', '4.5')).toBe('wrong')
    // An exact decimal is an exact value.
    expect(verdict(segment, 'result', '15.0')).toBe('correct')
  })

  it('the simplest-form note says what to fix, not the simplified value', () => {
    const note = said(distance, 'result', 'sqrt(45)')
    expect(verdict(distance, 'result', 'sqrt(45)')).toBe('invalid')
    expect(note).toMatch(/perfect-square factor/)
    expect(note).not.toMatch(/3√5/)
  })

  it('a format example under the box is never this part’s answer', () => {
    // x = 7 here, so the example is not 7.
    const seven = problem('geoSegments', 'gs.addition', 2)
    expect(seven.stages[0]!.answerText).toBe('7')
    expect(seven.stages[0]!.hint).not.toMatch(/\b7\b/)
    expect(distance.stages[0]!.hint).not.toMatch(/3√5/)
  })

  it('the whole is never twice the piece for every x (midpoint and bisector)', () => {
    for (const [module, template] of [
      ['geoSegments', 'gs.midpoint'],
      ['geoAngles', 'ga.bisector'],
    ] as const) {
      // Seed 4 used to be "AM = x + 20 and AB = 2x + 40", true for every x.
      const a = problem(module, template, 4)
      expect(a.prompt, `${template}/4`).not.toMatch(/= x \+ 20 and .* = 2x \+ 40/)
    }
  })
})

describe('a catalog example that shows the answer is recognized', () => {
  it('on either side of the arrow, as a whole number or point only', async () => {
    const { exampleShowsAnswer } = await import('./grade')
    expect(exampleShowsAnswer('x = 19 ✗ → x = 6', '6')).toBe(true)
    expect(exampleShowsAnswer('6 ✗ → 15', '6')).toBe(true)
    expect(exampleShowsAnswer('6 ✗ → 15', '15')).toBe(true)
    expect(exampleShowsAnswer('25 ✗ → 5', '5')).toBe(true)
    expect(exampleShowsAnswer('(2, 3) ✗ → (4, 7)', '(4, 7)')).toBe(true)
    expect(exampleShowsAnswer('x = 19 ✗ → x = 6', '7')).toBe(false)
    expect(exampleShowsAnswer('6 ✗ → 15', '5')).toBe(false)
    expect(exampleShowsAnswer('x = 20 ✗ → x = 12', '-12')).toBe(false)
    expect(exampleShowsAnswer('x = 7/3 ✗ → x = 6', '3')).toBe(false)
    expect(exampleShowsAnswer('(2, 3) ✗ → (4, 7)', '(5, 7)')).toBe(false)
  })
})

describe('examples on the cards never coincide with a generated answer', () => {
  it('no mistake example and no rule-card result contains the part’s answer, over 2000 seeds', async () => {
    const { exampleShowsAnswer } = await import('./grade')
    const { ERROR_PATTERNS } = await import('@/engine')
    const { SEGMENT_RULES, ANGLE_RULES } = await import('./rules')
    const templates = [
      ['geoSegments', 'gs.addition', SEGMENT_RULES],
      ['geoSegments', 'gs.midpoint', SEGMENT_RULES],
      ['geoSegments', 'gs.coord', SEGMENT_RULES],
      ['geoAngles', 'ga.addition', ANGLE_RULES],
      ['geoAngles', 'ga.bisector', ANGLE_RULES],
      ['geoAngles', 'ga.pairs', ANGLE_RULES],
      ['geoAngles', 'ga.words', ANGLE_RULES],
    ] as const
    const clashes: string[] = []
    for (const [module, template, rules] of templates) {
      // What each card's example works out to: the text after its last "=" or "→".
      const results = rules.map((r) => ({ id: r.id, result: (r.example ?? '').split(/=|→/).pop()!.trim() }))
      // Like with like: a point on a card is no hint for a number, and the reverse.
      const sameKind = (text: string, answer: string) => text.includes('(') === answer.startsWith('(')
      for (let seed = 1; seed <= 2000; seed++) {
        const a = problem(module, template, seed)
        for (const s of a.stages) {
          for (const trap of s.traps) {
            const example = ERROR_PATTERNS[trap.id].example
            if (sameKind(example, s.answerText) && exampleShowsAnswer(example, s.answerText)) clashes.push(`${template}/${seed} ${s.id}=${s.answerText}: ${trap.id} "${example}"`)
          }
          for (const r of results) {
            if (sameKind(r.result, s.answerText) && exampleShowsAnswer(r.result, s.answerText)) clashes.push(`${template}/${seed} ${s.id}=${s.answerText}: rule ${r.id} "${r.result}"`)
          }
        }
      }
    }
    expect(clashes.slice(0, 10)).toEqual([])
  }, 120000)
})
