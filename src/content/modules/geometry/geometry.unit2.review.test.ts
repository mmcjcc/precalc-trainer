/** Fixes from the review of Honors Geometry Unit 2's logic half (2026-10-17). */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { LAW_CHAINS, STATEMENT_BANK, biconditionalOf, ifThen, sceneFigure, statementOf } from './bank'

const entry = (id: string) => STATEMENT_BANK.find((item) => item.id === id)!
const problem = (template: string, seed: number) => generateProblem('geoLogic' as never, template, seed).answer as GeometryAnswer

describe('the statement bank, after review', () => {
  it('the bisector statement says "divides", so its converse is really true', () => {
    const bisector = entry('bisector-congruent')
    expect(statementOf(bisector, 'converse')).toBe('If ray BD divides angle ABC into two congruent angles, then ray BD bisects angle ABC.')
    expect(bisector.converse).toBe(true)
  })

  it('names the subject once and then says "they" or "it", as a textbook does', () => {
    expect(statementOf(entry('vertical-congruent'), 'converse')).toBe('If two angles are congruent, then they are vertical angles.')
    expect(statementOf(entry('vertical-congruent'), 'contrapositive')).toBe('If two angles are not congruent, then they are not vertical angles.')
    expect(statementOf(entry('acute-not-obtuse'), 'converse')).toBe('If an angle is not obtuse, then it is acute.')
    expect(statementOf(entry('complementary-sum'), 'conditional')).toBe('If two angles are complementary, then their measures add to 90 degrees.')
    expect(statementOf(entry('complementary-sum'), 'converse')).toBe('If the measures of two angles add to 90 degrees, then the angles are complementary.')
    expect(statementOf(entry('right-angles-congruent'), 'inverse')).toBe('If two angles are not both right angles, then they are not congruent.')
    expect(statementOf(entry('complementary-acute'), 'converse')).toBe('If two angles are both acute, then they are complementary.')
    expect(biconditionalOf(entry('vertical-congruent'))).toBe('Two angles are vertical angles if and only if they are congruent.')
    // Statements without a shared subject are unchanged.
    expect(statementOf(entry('midpoint-equal-parts'), 'converse')).toBe('If AM equals MB, then M is the midpoint of AB.')
  })

  it('no sentence names its subject a second time', () => {
    for (const item of STATEMENT_BANK) {
      for (const form of ['conditional', 'converse', 'inverse', 'contrapositive'] as const) {
        expect(statementOf(item, form), `${item.id} ${form}`).not.toMatch(/, then (the two|two|an) (angles?|lines|segments)\b/)
      }
    }
  })

  it('statements about two angles show two angles; "between" shows B between A and C; the bisector bisects', () => {
    for (const item of STATEMENT_BANK.filter((row) => row.scene === 'twoAngles')) {
      expect(sceneFigure(item.scene, 'x').angles, item.id).toHaveLength(2)
    }
    const line = sceneFigure('collinear', 'x').points
    const x = (id: string) => line.find((p) => p.id === id)!.x
    expect(x('A') < x('B') && x('B') < x('C')).toBe(true)
    const ray = sceneFigure('ray', 'x').points
    const at = (id: string) => ray.find((p) => p.id === id)!
    const dir = (id: string) => (Math.atan2(at(id).y - at('B').y, at(id).x - at('B').x) * 180) / Math.PI
    expect(Math.abs(dir('A') - dir('D') - (dir('D') - dir('C')))).toBeLessThan(1)
  })
})

describe('laws of logic, after review', () => {
  it('two if-thens that share an ending: nothing follows, and the tempting chain is plainly false', () => {
    const falseChains: Record<string, string> = {
      'vertical-chain': 'If two angles are vertical angles, then they are right angles.',
      'linear-chain': 'If two angles form a linear pair, then they are right angles.',
      'midpoint-chain': 'If M is the midpoint of AB, then AM and MB are each 5 units long.',
      'bisector-chain': 'If ray BD bisects angle ABC, then angle ABD and angle DBC are both right angles.',
      'saturday-chain': 'If it is Saturday, then it is Sunday.',
      'rain-chain': 'If it is raining, then the sprinkler is on.',
    }
    for (const chain of LAW_CHAINS) expect(ifThen(chain.p, chain.alt), chain.id).toBe(falseChains[chain.id])
    for (let seed = 1; seed <= 60; seed++) {
      const a = problem('gl.laws', seed)
      if (!/share an ending/.test(a.stages[0]!.reveal.join(' '))) continue
      const trap = a.stages[0]!.choices!.find((choice) => choice.trap)!
      expect(Object.values(falseChains), `gl.laws/${seed}`).toContain(trap.text)
      expect(a.stages[0]!.answerText, `gl.laws/${seed}`).toBe('none')
    }
  })

  it('a detachment premise states the fact about angle 1 and angle 2', () => {
    const a = problem('gl.laws', 5)
    expect(a.prompt).toContain('Premise 2: Angle 1 and angle 2 are vertical angles.')
  })
})

describe('related conditionals, after review', () => {
  it('the parts are named Converse, Inverse and Contrapositive', () => {
    const a = problem('gl.related', 1)
    expect(a.stages.map((stage) => stage.label)).toEqual(['Converse', 'Inverse', 'Contrapositive'])
  })
})
