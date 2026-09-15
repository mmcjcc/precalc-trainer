import { describe, expect, it } from 'vitest'
import {
  bumpStreak,
  currentStreak,
  firstTryRate,
  habits,
  hintRate,
  mastery,
  moduleMastery,
  patternCounts,
  pickWeakSpot,
  propertyAccuracy,
  weakSpotWeights,
} from './selectors'
import { dayKey, isoWeekKey, startOfIsoWeek } from './time'
import { emptyWeeklySkill, type Ev, type Weekly } from './types'

const DAY = 86_400_000
// A fixed "now": Wednesday 2026-09-16 12:00 local.
const NOW = new Date(2026, 8, 16, 12, 0, 0).getTime()

function done(skill: string, at: number, firstTryRate: number, opts: Partial<Extract<Ev, { t: 'problem_done' }>> = {}): Ev {
  return {
    t: 'problem_done',
    at,
    attemptId: `${skill}#${at}`,
    skill,
    moduleId: 'inequalities',
    steps: 5,
    firstTryRate,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 120,
    ...opts,
  }
}

function accepted(skill: string, at: number, firstTry: boolean, property: 'correct' | 'wrong' | 'skipped' | 'off' = 'skipped'): Ev {
  return { t: 'step_accepted', at, attemptId: 'a', skill, stepIdx: 0, firstTry, revealed: false, property }
}

describe('mastery(skill)', () => {
  it('is empty with no completions', () => {
    const m = mastery([], 'ineq.a')
    expect(m.rate).toBeNull()
    expect(m.mastered).toBe(false)
    expect(m.count).toBe(0)
  })

  it('uses only the last 5 problem_done for the skill (rolling window)', () => {
    const events: Ev[] = []
    // six old bad attempts, then five good ones
    for (let i = 0; i < 6; i++) events.push(done('ineq.a', NOW - (20 - i) * DAY, 0.2))
    for (let i = 0; i < 5; i++) events.push(done('ineq.a', NOW - (5 - i) * DAY, 1))
    events.push(done('ineq.b', NOW, 0)) // other skill, ignored
    const m = mastery(events, 'ineq.a')
    expect(m.count).toBe(5)
    expect(m.rate).toBe(1)
    expect(m.mastered).toBe(true)
  })

  it('is not mastered below 0.8, with a revealed step, with a wrong final, or with fewer than 5', () => {
    const base = [0, 1, 2, 3, 4].map((i) => done('s', NOW - i * DAY, 0.9))
    expect(mastery(base, 's').mastered).toBe(true)
    expect(mastery(base.slice(0, 4), 's').mastered).toBe(false)
    expect(mastery([...base.slice(0, 4), done('s', NOW, 0.3)], 's').rate).toBeCloseTo((0.9 * 4 + 0.3) / 5)
    expect(mastery([...base.slice(0, 4), done('s', NOW, 0.3)], 's').mastered).toBe(false)
    expect(mastery([...base.slice(0, 4), done('s', NOW, 1, { revealed: 1 })], 's').mastered).toBe(false)
    expect(mastery([...base.slice(0, 4), done('s', NOW, 1, { finalCorrect: false })], 's').mastered).toBe(false)
  })

  it('excludes timed-mode attempts from the window but still reports lastAt', () => {
    const events = [done('s', NOW - DAY, 0.2, { mode: 'timed' }), done('s', NOW - 2 * DAY, 1)]
    const m = mastery(events, 's')
    expect(m.count).toBe(1)
    expect(m.rate).toBe(1)
    expect(m.lastAt).toBe(NOW - DAY)
  })

  it('moduleMastery averages families with data and flags complete only when all are mastered', () => {
    const good = [0, 1, 2, 3, 4].map((i) => done('a', NOW - i * DAY, 1))
    const mm = moduleMastery([...good, done('b', NOW, 0.5)], ['a', 'b', 'c'])
    expect(mm.rate).toBeCloseTo(0.75)
    expect(mm.masteredCount).toBe(1)
    expect(mm.practicedCount).toBe(2)
    expect(mm.complete).toBe(false)
    expect(moduleMastery(good, ['a']).complete).toBe(true)
    expect(moduleMastery([], []).complete).toBe(false)
  })
})

describe('hintRate / propertyAccuracy include weekly counters', () => {
  const weekly: Weekly = {
    '2026-W20': { s: { ...emptyWeeklySkill(), steps: 10, hints: 2, propAnswered: 4, propCorrect: 3 } },
  }
  const events: Ev[] = [
    accepted('s', NOW, true, 'correct'),
    accepted('s', NOW, false, 'wrong'),
    accepted('s', NOW, true, 'skipped'),
    accepted('other', NOW, true, 'correct'),
    { t: 'hint', at: NOW, attemptId: 'a', skill: 's', stepIdx: 0, rung: 1 },
  ]

  it('hintRate = hints ÷ steps', () => {
    const r = hintRate(events, weekly, 's')
    expect(r.numerator).toBe(3)
    expect(r.denominator).toBe(13)
    expect(r.rate).toBeCloseTo(3 / 13)
    expect(hintRate([], {}, 's').rate).toBeNull()
  })

  it('propertyAccuracy counts only answered chips', () => {
    const r = propertyAccuracy(events, weekly, 's')
    expect(r.numerator).toBe(4)
    expect(r.denominator).toBe(6)
    const all = propertyAccuracy(events, weekly)
    expect(all.numerator).toBe(5)
    expect(all.denominator).toBe(7)
  })
})

describe('patternCounts: this ISO week vs before', () => {
  it('splits at local Monday 00:00 and folds weekly buckets into "before"', () => {
    const weekStart = startOfIsoWeek(NOW)
    const events: Ev[] = [
      { t: 'step_rejected', at: weekStart + 1000, attemptId: 'a', skill: 's', stepIdx: 1, pattern: 'no_sign_flip' },
      { t: 'step_rejected', at: NOW, attemptId: 'a', skill: 's', stepIdx: 2, pattern: 'no_sign_flip' },
      { t: 'step_rejected', at: weekStart - 1000, attemptId: 'a', skill: 's', stepIdx: 1, pattern: 'no_sign_flip' },
      { t: 'final_answer', at: NOW, attemptId: 'a', skill: 's', correct: false, pattern: 'backwards_interval' },
      { t: 'step_rejected', at: NOW, attemptId: 'a', skill: 's', stepIdx: 3 }, // no pattern → ignored
    ]
    const weekly: Weekly = { '2026-W10': { s: { ...emptyWeeklySkill(), patterns: { no_sign_flip: 4 } } } }
    const rows = patternCounts(events, weekly, NOW)
    expect(rows).toEqual([
      { pattern: 'no_sign_flip', thisWeek: 2, before: 5 },
      { pattern: 'backwards_interval', thisWeek: 1, before: 0 },
    ])
  })

  it('isoWeekKey follows ISO 8601 (2026-01-01 is in 2026-W01; 2027-01-01 is in 2026-W53)', () => {
    expect(isoWeekKey(new Date(2026, 0, 1).getTime())).toBe('2026-W01')
    expect(isoWeekKey(new Date(2027, 0, 1).getTime())).toBe('2026-W53')
    expect(isoWeekKey(new Date(2026, 8, 14).getTime())).toBe('2026-W38')
    expect(dayKey(new Date(2026, 8, 14, 23, 59).getTime())).toBe('2026-09-14')
  })
})

describe('habits and streak', () => {
  it('counts done vs abandoned from events + weekly', () => {
    const events: Ev[] = [done('s', NOW, 1), { t: 'problem_abandoned', at: NOW, attemptId: 'x', skill: 's' }]
    const weekly: Weekly = { '2026-W10': { s: { ...emptyWeeklySkill(), done: 3, abandoned: 1 } } }
    expect(habits(events, weekly)).toEqual({ done: 4, abandoned: 2, secs: 120 })
  })

  it('bumpStreak: same day keeps, next day increments, gap resets to 1', () => {
    const s0 = { lastDay: '', count: 0 }
    const s1 = bumpStreak(s0, '2026-09-14')
    expect(s1).toEqual({ lastDay: '2026-09-14', count: 1 })
    expect(bumpStreak(s1, '2026-09-14')).toBe(s1)
    const s2 = bumpStreak(s1, '2026-09-15')
    expect(s2.count).toBe(2)
    expect(bumpStreak(s2, '2026-09-20').count).toBe(1)
  })

  it('currentStreak shows the number while alive (today/yesterday) and 0 after a gap — never a warning', () => {
    expect(currentStreak({ lastDay: dayKey(NOW), count: 4 }, NOW)).toBe(4)
    expect(currentStreak({ lastDay: dayKey(NOW - DAY), count: 4 }, NOW)).toBe(4)
    expect(currentStreak({ lastDay: dayKey(NOW - 2 * DAY), count: 4 }, NOW)).toBe(0)
    expect(currentStreak({ lastDay: '', count: 0 }, NOW)).toBe(0)
  })
})

describe('weak spots', () => {
  it('weights unpracticed 0.6, mastered 0.05, otherwise 1 − rate', () => {
    const good = [0, 1, 2, 3, 4].map((i) => done('m', NOW - i * DAY, 1))
    const w = weakSpotWeights([...good, done('w', NOW, 0.3)], ['m', 'w', 'n'])
    expect(w.map((x) => [x.skill, Number(x.weight.toFixed(2))])).toEqual([
      ['m', 0.05],
      ['w', 0.7],
      ['n', 0.6],
    ])
    expect(pickWeakSpot(w, 0)).toBe('m')
    expect(pickWeakSpot(w, 0.5)).toBe('w')
    expect(pickWeakSpot(w, 0.99)).toBe('n')
    expect(pickWeakSpot([], 0.5)).toBeNull()
  })
})

describe('F10: undone steps do not count in the rates', () => {
  const acc = (at: number, stepIdx: number, firstTry: boolean, property: 'correct' | 'wrong' | 'skipped' = 'skipped'): Ev => ({
    t: 'step_accepted',
    at,
    attemptId: 'att',
    skill: 's',
    stepIdx,
    firstTry,
    revealed: false,
    property,
  })
  const undo = (at: number, stepIdx: number, attemptId = 'att'): Ev => ({ t: 'step_undone', at, attemptId, skill: 's', stepIdx })

  it('cancels each step_accepted against a later step_undone for the same attempt and step', () => {
    const events: Ev[] = [
      acc(1, 0, true, 'wrong'),
      undo(2, 0),
      acc(3, 0, true, 'wrong'),
      undo(4, 0),
      acc(5, 0, true, 'wrong'),
      undo(6, 0),
      acc(7, 0, true, 'correct'),
      { t: 'hint', at: 8, attemptId: 'att', skill: 's', stepIdx: 1, rung: 1 },
    ]
    expect(firstTryRate(events, {}, 's')).toMatchObject({ numerator: 1, denominator: 1 })
    expect(hintRate(events, {}, 's')).toMatchObject({ numerator: 1, denominator: 1 })
    expect(propertyAccuracy(events, {}, 's')).toMatchObject({ numerator: 1, denominator: 1 })
  })

  it('an undo in another attempt or at another index cancels nothing', () => {
    const events: Ev[] = [acc(1, 0, true), undo(2, 0, 'other'), undo(3, 1)]
    expect(firstTryRate(events, {}, 's')).toMatchObject({ numerator: 1, denominator: 1 })
  })
})
