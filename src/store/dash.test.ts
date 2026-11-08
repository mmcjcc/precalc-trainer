/** Monster Dash tokens: finished sets earn the day's plays, runs spend them, the best score sticks. */
import { beforeEach, describe, expect, it } from 'vitest'
import { DASH_DAY_CAP, dashBestOf, dashEarned, dashSpent, dashTokens } from './dash'
import { mergeRewards, normalizeRewards } from './rewards'
import { emptyRewards, resetStoreForTests, useStore, type Ev } from './index'

const at = (d: number, h: number) => new Date(2026, 10, d, h).getTime()
const DAY = '2026-11-10'

function setDone(when: number, done = 3, skipped = 0): Ev {
  return { t: 'set_done', at: when, setId: `set-${when}`, done: Array.from({ length: done }, (_, i) => `a${i}`), skipped }
}

function run(when: number, score: number): Ev {
  return { t: 'dash_run', at: when, runner: 'sign_flip', score }
}

describe('the day economy', () => {
  it('a finished set with nothing skipped earns a play that day, up to the cap', () => {
    const events: Ev[] = [setDone(at(10, 9)), setDone(at(10, 10)), setDone(at(10, 11), 0), setDone(at(10, 12), 3, 1), setDone(at(9, 18))]
    // Two qualify today: one had nothing done, one skipped a problem, one was yesterday.
    expect(dashEarned(events, DAY)).toBe(2)
    expect(dashTokens(events, DAY)).toBe(2)
    const many = Array.from({ length: 9 }, (_, i) => setDone(at(10, 8) + i * 1000))
    expect(dashEarned(many, DAY)).toBe(DASH_DAY_CAP)
  })

  it('runs spend the day down to zero and never below; yesterday does not carry over', () => {
    const events: Ev[] = [setDone(at(9, 18)), setDone(at(10, 9)), run(at(10, 10), 120), run(at(10, 11), 80)]
    expect(dashSpent(events, DAY)).toBe(2)
    expect(dashTokens(events, DAY)).toBe(0)
    // Days are sealed off from each other: the 9th keeps its own set's play; the 10th's runs never touch it.
    expect(dashTokens(events, '2026-11-09')).toBe(1)
    expect(dashSpent(events, '2026-11-09')).toBe(0)
  })

  it('the best score reads the folded field and any live run above it', () => {
    expect(dashBestOf({ dashBest: 200 }, [run(at(10, 10), 150)])).toBe(200)
    expect(dashBestOf({ dashBest: 200 }, [run(at(10, 10), 260)])).toBe(260)
    expect(dashBestOf({}, [])).toBe(0)
  })

  it('merging and normalizing the rewards slice keeps the best', () => {
    const a = { ...emptyRewards(), dashBest: 120 }
    const b = { ...emptyRewards(), dashBest: 340 }
    expect(mergeRewards(a, b).dashBest).toBe(340)
    expect(mergeRewards(a, emptyRewards()).dashBest).toBe(120)
    expect(normalizeRewards({ ...emptyRewards(), dashBest: 77 }).dashBest).toBe(77)
    expect(normalizeRewards({ ...emptyRewards(), dashBest: 'high' }).dashBest).toBeUndefined()
  })
})

describe('the store action', () => {
  beforeEach(() => {
    resetStoreForTests()
  })

  it('records a run while a play is left, keeps the best, and refuses at zero', () => {
    const now = at(10, 9)
    useStore.setState({ events: [setDone(now)] })
    expect(useStore.getState().noteDashRun({ runner: 'sign_flip', score: 140, now: now + 1000 })).toBe(true)
    expect(useStore.getState().rewards.dashBest).toBe(140)
    // The one play is spent; a second run today is refused and logs nothing.
    expect(useStore.getState().noteDashRun({ runner: 'sign_flip', score: 300, now: now + 2000 })).toBe(false)
    const runs = useStore.getState().events.filter((e) => e.t === 'dash_run')
    expect(runs).toHaveLength(1)
    expect(useStore.getState().rewards.dashBest).toBe(140)
  })

  it('a lower later run never lowers the best', () => {
    const now = at(10, 9)
    useStore.setState({ events: [setDone(now), setDone(now + 1)] })
    expect(useStore.getState().noteDashRun({ runner: 'sign_flip', score: 90, now: now + 1000 })).toBe(true)
    expect(useStore.getState().noteDashRun({ runner: 'sign_flip', score: 40, now: now + 2000 })).toBe(true)
    expect(useStore.getState().rewards.dashBest).toBe(90)
  })
})
