// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { resetStoreForTests, useStore } from '@/store'
import { gradeFinalAnswer, type FinalAnswerTarget } from '@/problem/inequality'
import { gradeAxisOfSymmetry, gradeVertex, checkSquareLine } from '@/engine'
import { recordPolyGrades, recordSetAnswer } from './record'

const target: FinalAnswerTarget = {
  set: { kind: 'set', intervals: [] } as unknown as FinalAnswerTarget['set'],
  requireInterval: true,
  requireSetBuilder: true,
}

function startAttempt() {
  useStore.getState().startAttempt({
    problemId: 'numberLine/nl.read@1/b',
    moduleId: 'numberLine',
    templateId: 'nl.read',
    skill: 'nl.read',
    seed: 'b',
    difficulty: '',
    genVersion: 1,
  })
}

describe('recordSetAnswer (F11)', () => {
  beforeEach(() => {
    resetStoreForTests()
    startAttempt()
  })

  it.each([
    ['[5, 2]', 'backwards_interval'],
    ['(-inf, 2] (5, inf)', 'dropped_union'],
    ['[-inf, 2)', 'infinity_bracket'],
  ])('logs a named notation slip caught at parse time: %s → %s', (text, id) => {
    const grade = gradeFinalAnswer(text, '', target)
    expect(grade.interval.status).toBe('parse')
    expect(grade.interval.pattern?.id).toBe(id)
    recordSetAnswer(grade, { interval: text, set: '' })
    const finals = useStore.getState().events.filter((e) => e.t === 'final_answer')
    expect(finals).toHaveLength(1)
    expect(finals[0]).toMatchObject({ correct: false, pattern: id, via: 'text' })
  })

  it('leaves a pattern-less syntax error unlogged', () => {
    const grade = gradeFinalAnswer('(((', '', target)
    expect(grade.interval.status).toBe('parse')
    expect(grade.interval.pattern).toBeUndefined()
    recordSetAnswer(grade, { interval: '(((', set: '' })
    expect(useStore.getState().events.filter((e) => e.t === 'final_answer')).toHaveLength(0)
  })
})

describe('recordPolyGrades', () => {
  const F = '2x^2 - 12x + 13' // 2(x − 3)^2 − 5
  const finals = () => useStore.getState().events.filter((e) => e.t === 'final_answer')

  beforeEach(() => {
    resetStoreForTests()
    startAttempt()
  })

  it('logs one correct record when every part of the check is right', () => {
    recordPolyGrades([gradeVertex(F, '(3, -5)'), gradeAxisOfSymmetry(F, 'x = 3')])
    expect(finals()).toHaveLength(1)
    expect(finals()[0]).toMatchObject({ correct: true, via: 'text' })
    expect(useStore.getState().attempt?.final).toMatchObject({ correct: true, firstCorrect: true })
  })

  it('logs one wrong record per part that is not right, with the poly_ id of a named mistake', () => {
    // vertex: sign slip (named). axis: right. A second axis: a plain wrong number.
    recordPolyGrades([gradeVertex(F, '(-3, -5)'), gradeAxisOfSymmetry(F, 'x = 3'), gradeAxisOfSymmetry(F, '7')])
    expect(finals()).toHaveLength(2)
    expect(finals()[0]).toMatchObject({ correct: false, pattern: 'poly_cs_h_sign', via: 'text' })
    expect(finals()[1]).toMatchObject({ correct: false, via: 'text' })
    expect((finals()[1] as { pattern?: string }).pattern).toBeUndefined()
    expect(useStore.getState().attempt?.final).toMatchObject({ everWrong: true, firstCorrect: false })
  })

  it('takes the line-by-line grade as well', () => {
    recordPolyGrades([checkSquareLine(F, '2(x - 3)^2 + 4')])
    expect(finals()).toMatchObject([{ correct: false, pattern: 'poly_cs_constant_not_scaled' }])
  })

  it('records nothing when any part is unreadable, not in the form asked for, or unsupported, or when there are no parts', () => {
    recordPolyGrades([])
    recordPolyGrades([gradeVertex(F, '(-3, -5)'), gradeAxisOfSymmetry(F, 'y = 3')])
    recordPolyGrades([gradeVertex(F, '')])
    recordPolyGrades([{ verdict: 'invalid', reason: 'not_in_form', message: 'That is equal to f(x), but it is not vertex form yet.' }])
    recordPolyGrades([gradeVertex(F, '(3, -5)'), { verdict: 'unsupported', message: 'outside the model' }])
    expect(finals()).toHaveLength(0)
    expect(useStore.getState().attempt?.final).toBeUndefined()
  })
})
