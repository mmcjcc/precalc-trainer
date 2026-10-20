import { describe, expect, it } from 'vitest'
import { isFirstTryRight } from '@/pages/review/session'
import type { Ev } from '@/store/types'
import type { ActiveSet } from './activeSet'
import { outcomeWords, summarizeSet } from './summary'

const S = 'ee.exponential'

function done(attemptId: string, opts: Partial<Extract<Ev, { t: 'problem_done' }>> = {}): Ev {
  return { t: 'problem_done', at: 10, attemptId, skill: S, moduleId: 'expLogEquations', steps: 2, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 60, ...opts }
}

describe('a set’s results with Guided mode', () => {
  it('a problem with picked lines is not "Right first time": it says how many lines were picked; a wrong pick is a caught mistake', () => {
    const set: ActiveSet = {
      version: 1,
      id: 'set1',
      courseId: 'precalc',
      startedAt: 0,
      timed: false,
      problems: ['a', 'b', 'c', 'd'].map((_, i) => ({ moduleId: 'expLogEquations', templateId: S, seed: i + 1, flags: '', pick: 'unit' as const })),
      index: 4,
      attemptIds: ['a', 'b', 'c', 'd'],
      status: ['done', 'done', 'done', 'done'],
    }
    const events: Ev[] = [
      done('a'),
      done('b', { picked: 2 }),
      done('c', { picked: 1 }),
      { t: 'step_rejected', at: 5, attemptId: 'd', skill: S, stepIdx: 0, pattern: 'log_one_side', via: 'card' },
      done('d', { picked: 1, firstTryRate: 0.5 }),
    ]
    const outcomes = summarizeSet(set, events).map((l) => outcomeWords(l.outcome))
    expect(outcomes).toEqual(['Right first time', 'Finished, with 2 lines picked', 'Finished, with a line picked', 'Caught and fixed 1 mistake'])
    // The unit review's "right first time" reads the same.
    expect(isFirstTryRight([done('a')])).toBe(true)
    expect(isFirstTryRight([done('b', { picked: 2 })])).toBe(false)
  })
})
