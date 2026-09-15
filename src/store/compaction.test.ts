import { describe, expect, it } from 'vitest'
import { compact } from './compaction'
import { isoWeekKey } from './time'
import type { Ev } from './types'

const DAY = 86_400_000
const NOW = new Date(2026, 8, 16, 12).getTime()

function ev(at: number, skill: string, patch: Partial<Ev> & { t: Ev['t'] }): Ev {
  return { attemptId: 'a', skill, at, ...patch } as Ev
}

describe('compact(events, weekly, now)', () => {
  it('is a no-op (same references) when nothing is older than 60 days', () => {
    const events: Ev[] = [ev(NOW - 10 * DAY, 's', { t: 'hint', stepIdx: 0, rung: 1 } as Partial<Ev> & { t: 'hint' })]
    const weekly = {}
    const r = compact(events, weekly, NOW)
    expect(r.folded).toBe(0)
    expect(r.events).toBe(events)
    expect(r.weekly).toBe(weekly)
  })

  it('folds old events into weekly[isoWeek][skill] counters and deletes them', () => {
    const old = NOW - 70 * DAY
    const events: Ev[] = [
      ev(old, 's', { t: 'step_accepted', stepIdx: 0, firstTry: true, revealed: false, property: 'correct' } as never),
      ev(old, 's', { t: 'step_accepted', stepIdx: 1, firstTry: false, revealed: true, property: 'wrong' } as never),
      ev(old, 's', { t: 'step_accepted', stepIdx: 2, firstTry: true, revealed: false, property: 'skipped' } as never),
      ev(old, 's', { t: 'step_rejected', stepIdx: 1, pattern: 'no_sign_flip' } as never),
      ev(old, 's', { t: 'final_answer', correct: false, pattern: 'no_sign_flip' } as never),
      ev(old, 's', { t: 'hint', stepIdx: 1, rung: 2 } as never),
      ev(old, 's', { t: 'problem_abandoned' } as never),
      { t: 'drill_answer', at: old, skill: 'drill', correct: true, kind: 'legal' },
      ev(NOW - DAY, 's', { t: 'hint', stepIdx: 0, rung: 1 } as never), // recent → kept
    ]
    const r = compact(events, {}, NOW)
    expect(r.folded).toBe(8)
    expect(r.events).toHaveLength(1)
    expect(r.events[0]!.at).toBe(NOW - DAY)
    const week = isoWeekKey(old)
    expect(r.weekly[week]!.s).toEqual({
      steps: 3,
      firstTry: 2,
      revealed: 1,
      hints: 1,
      propAnswered: 2,
      propCorrect: 1,
      patterns: { no_sign_flip: 2 },
      done: 0,
      abandoned: 1,
      drillAnswered: 0,
      drillCorrect: 0,
    })
    expect(r.weekly[week]!.drill!.drillAnswered).toBe(1)
    expect(r.weekly[week]!.drill!.drillCorrect).toBe(1)
  })

  it('keeps the last 5 normal problem_done per skill even when old, so mastery survives a break', () => {
    const events: Ev[] = []
    for (let i = 0; i < 8; i++) {
      events.push({
        t: 'problem_done',
        at: NOW - (100 - i) * DAY,
        attemptId: `a${i}`,
        skill: 's',
        moduleId: 'inequalities',
        steps: 4,
        firstTryRate: 1,
        hints: 0,
        revealed: 0,
        finalCorrect: true,
        mode: i === 7 ? 'timed' : 'normal',
        secs: 60,
      })
    }
    const r = compact(events, {}, NOW)
    const kept = r.events.filter((e) => e.t === 'problem_done')
    expect(kept).toHaveLength(5)
    expect(kept.every((e) => e.t === 'problem_done' && e.mode === 'normal')).toBe(true)
    expect(kept.map((e) => e.attemptId)).toEqual(['a2', 'a3', 'a4', 'a5', 'a6'])
    expect(r.folded).toBe(3)
    // folded ones still count as done in weekly
    const doneInWeekly = Object.values(r.weekly).reduce((n, w) => n + (w.s?.done ?? 0), 0)
    expect(doneInWeekly).toBe(3)
  })

  it('does not mutate the incoming weekly object', () => {
    const weekly = { '2026-W10': { s: { steps: 1, firstTry: 1, revealed: 0, hints: 0, propAnswered: 0, propCorrect: 0, patterns: {}, done: 0, abandoned: 0, drillAnswered: 0, drillCorrect: 0 } } }
    const snapshot = JSON.stringify(weekly)
    compact([ev(NOW - 90 * DAY, 's', { t: 'hint', stepIdx: 0, rung: 1 } as never)], weekly, NOW)
    expect(JSON.stringify(weekly)).toBe(snapshot)
  })
})

describe('F10: compaction skips undone steps', () => {
  it('does not fold a step_accepted that a later step_undone cancelled', () => {
    const old = NOW - 70 * DAY
    const events: Ev[] = [
      ev(old, 's', { t: 'step_accepted', stepIdx: 0, firstTry: true, revealed: false, property: 'correct' } as never),
      ev(old + 1, 's', { t: 'step_undone', stepIdx: 0 } as never),
      ev(old + 2, 's', { t: 'step_accepted', stepIdx: 0, firstTry: true, revealed: false, property: 'skipped' } as never),
    ]
    const r = compact(events, {}, NOW)
    expect(r.weekly[isoWeekKey(old)]!['s']).toMatchObject({ steps: 1, firstTry: 1, propAnswered: 0, propCorrect: 0 })
    expect(r.events).toHaveLength(0)
  })
})
