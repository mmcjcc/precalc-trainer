// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { resetStoreForTests, useStore } from '@/store'
import { gradeFinalAnswer, type FinalAnswerTarget } from '@/problem/inequality'
import { recordSetAnswer } from './record'

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
