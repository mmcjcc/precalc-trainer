import { describe, expect, it } from 'vitest'
import type { Ev } from '@/store/types'
import { chimeStep, comboOf, comboScope, comboTier } from './combo'

const SKILL = 'explog.equations'
let clock = 1_000_000

function at(): number {
  clock += 1000
  return clock
}

/** A line kept: typed (default) or picked from the cards, right on the first try unless said otherwise. */
function line(attemptId: string, stepIdx: number, opts: { firstTry?: boolean; revealed?: boolean; card?: boolean } = {}): Ev {
  return {
    t: 'step_accepted',
    at: at(),
    attemptId,
    skill: SKILL,
    stepIdx,
    firstTry: opts.firstTry ?? true,
    revealed: opts.revealed ?? false,
    property: 'skipped',
    ...(opts.card ? { via: 'card' as const } : {}),
  }
}

function slip(attemptId: string, stepIdx: number, card = false): Ev {
  return { t: 'step_rejected', at: at(), attemptId, skill: SKILL, stepIdx, pattern: 'log_of_sum', ...(card ? { via: 'card' as const } : {}) }
}

function check(attemptId: string, correct: boolean, part?: string): Ev {
  return { t: 'final_answer', at: at(), attemptId, skill: SKILL, correct, via: 'text', ...(part !== undefined ? { part } : {}) }
}

function hint(attemptId: string, stepIdx: number, rung: 1 | 2 | 3): Ev {
  return { t: 'hint', at: at(), attemptId, skill: SKILL, stepIdx, rung }
}

function undo(attemptId: string, stepIdx: number): Ev {
  return { t: 'step_undone', at: at(), attemptId, skill: SKILL, stepIdx }
}

function done(attemptId: string): Ev {
  return { t: 'problem_done', at: at(), attemptId, skill: SKILL, moduleId: 'explog', steps: 2, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 60 }
}

describe('comboOf', () => {
  it('counts typed lines and cards picked right on the first pick alike', () => {
    expect(comboOf([line('a', 0), line('a', 1, { card: true }), line('a', 2)], ['a'])).toBe(3)
  })

  it('counts parts right on the first check, and a box a check grades every time once', () => {
    expect(comboOf([check('a', true), check('a', true), check('a', true)], ['a'])).toBe(3)
    // The inequality's answer: both boxes right on the first check, then the same check again.
    const both = [check('a', true, 'Interval notation'), check('a', true, 'Set-builder notation')]
    expect(comboOf(both, ['a'])).toBe(2)
    expect(comboOf([...both, check('a', true, 'Interval notation'), check('a', true, 'Set-builder notation')], ['a'])).toBe(2)
  })

  it('a slip resets it quietly, and the line fixed after it adds nothing', () => {
    const log = [line('a', 0), line('a', 1), slip('a', 2)]
    expect(comboOf(log, ['a'])).toBe(0)
    const fixed = [...log, line('a', 2, { firstTry: false })]
    expect(comboOf(fixed, ['a'])).toBe(0)
    expect(comboOf([...fixed, line('a', 3)], ['a'])).toBe(1)
  })

  it('a wrong check resets it, the part fixed after it adds nothing, the next part right first counts', () => {
    const log = [check('a', true), check('a', false), check('a', true)]
    expect(comboOf(log, ['a'])).toBe(0)
    expect(comboOf([...log, check('a', true)], ['a'])).toBe(1)
    // A box wrong once is not right first try when it comes right later.
    const boxes = [check('a', true, 'Interval notation'), check('a', false, 'Set-builder notation'), check('a', true, 'Set-builder notation')]
    expect(comboOf(boxes, ['a'])).toBe(0)
  })

  it('a wrong card resets it; the right card picked after it adds nothing', () => {
    const log = [line('a', 0), line('a', 1), slip('a', 2, true), line('a', 2, { card: true, firstTry: false })]
    expect(comboOf(log, ['a'])).toBe(0)
    expect(comboOf([...log, line('a', 3, { card: true })], ['a'])).toBe(1)
  })

  it('a revealed line does not count and breaks the row; so does a part answered after the answer was shown', () => {
    const log = [line('a', 0), line('a', 1), hint('a', 2, 3), line('a', 2, { revealed: true, firstTry: false })]
    expect(comboOf(log, ['a'])).toBe(0)
    expect(comboOf([...log, line('a', 3)], ['a'])).toBe(1)
    expect(comboOf([check('a', true), check('a', true), hint('a', 2, 3), check('a', true)], ['a'])).toBe(0)
  })

  it('a nudge or a rule card (hints 1 and 2) does not break it', () => {
    expect(comboOf([line('a', 0), hint('a', 1, 1), hint('a', 1, 2), line('a', 1), check('a', true)], ['a'])).toBe(3)
  })

  it('an undone line does not count; kept again, it does', () => {
    const log = [line('a', 0), line('a', 1), undo('a', 1)]
    expect(comboOf(log, ['a'])).toBe(1)
    expect(comboOf([...log, line('a', 1)], ['a'])).toBe(2)
  })

  it('carries across a running set, skipped problems included, and ignores attempts outside it', () => {
    const log = [
      line('p1', 0),
      line('p1', 1),
      check('p1', true),
      done('p1'),
      // Another problem, outside the set: its slip is not hers in this set.
      slip('other', 0),
      // The set's second problem, skipped after one right line.
      line('p2', 0),
      { t: 'problem_abandoned', at: at(), attemptId: 'p2', skill: SKILL } satisfies Ev,
      line('p3', 0),
    ]
    expect(comboOf(log, ['p1', 'p2', 'p3'])).toBe(5)
    // Outside a set, it is this problem's alone.
    expect(comboOf(log, ['p3'])).toBe(1)
    expect(comboOf(log, [])).toBe(0)
  })

  it('a drill answer is neither a line nor a part', () => {
    const drill: Ev = { t: 'drill_answer', at: at(), skill: 'drill', correct: false, kind: 'legal' }
    expect(comboOf([line('a', 0), drill, line('a', 1)], ['a'])).toBe(2)
  })
})

describe('comboScope', () => {
  const set = { index: 2, attemptIds: ['p1', null, null] }

  it('a problem alone outside a set', () => {
    expect(comboScope('x')).toEqual(['x'])
    expect(comboScope(null)).toEqual([])
  })

  it('the set’s earlier problems, then this one (noted on its slot or not yet)', () => {
    expect(comboScope('p3', set)).toEqual(['p1', 'p3'])
    expect(comboScope('p2', { index: 1, attemptIds: ['p1', 'p2', null] })).toEqual(['p1', 'p2'])
    expect(comboScope('p1', { index: 1, attemptIds: ['p1', 'p2', null] })).toEqual(['p1'])
  })
})

describe('the pill and the chime', () => {
  it('the pill shows from 3 and grows at 5 and 10', () => {
    expect([0, 2, 3, 4, 5, 9, 10, 25].map(comboTier)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('the chime climbs one step per right answer in a row, capped after eight', () => {
    expect([0, 1, 2, 3, 8, 9, 30].map(chimeStep)).toEqual([0, 0, 1, 2, 7, 7, 7])
  })
})
