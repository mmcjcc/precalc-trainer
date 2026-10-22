/**
 * The daily chest in the store: opening it is an event (`openChest`), its bonus XP counts in the day's XP and the goal,
 * its rest day is banked and used by the streak like the weekly one (never past the cap), and backups (replace and
 * merge), the compaction and the settings keep what it gave.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup, importBackup, normalizeSettings, settingsAfterImport } from './backup'
import { chestOpenings, drawChestReward, ownedThemes } from './chest'
import { compact } from './compaction'
import { resetStoreForTests, rewardsViewOf, useStore } from './index'
import { MAX_REST_DAYS, chestRestEligible, computeRewards, settleDays, xpAwards } from './rewards'
import { SIXTY_DAYS_MS, dayKey } from './time'
import { DEFAULT_SETTINGS, emptyRewards, type ChestReward, type Ev } from './types'

const S = 'ineq.linear'
// Monday 2026-09-07 to Sunday 2026-09-13.
const on = (day: number, hour = 10) => new Date(2026, 8, day, hour).getTime()

function done(attemptId: string, at: number): Ev {
  return { t: 'problem_done', at, attemptId, skill: S, moduleId: 'inequalities', steps: 0, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'timed', secs: 60 }
}

/** The goal (60 XP) met on a day: two timed problems of 30 XP each (+20 finished, +10 no hints). */
function met(day: number): Ev[] {
  return [done(`a${day}`, on(day, 9)), done(`b${day}`, on(day, 10))]
}

function chest(day: string, at: number, reward: ChestReward): Ev {
  return { t: 'chest_opened', at, day, reward }
}

beforeEach(() => {
  resetStoreForTests()
})

describe('opening a chest', () => {
  it('logs one chest_opened with the day’s draw; a second tap, or a day that is neither today nor yesterday, opens nothing', () => {
    const now = on(9, 18)
    useStore.setState({ events: [...met(7), ...met(8), ...met(9)] })
    const s = useStore.getState()
    const ctx = { owned: ownedThemes(s.events), restEligible: chestRestEligible(rewardsViewOf(s, now), s.events, now) }
    const expected = drawChestReward('2026-09-09', ctx)
    const got = s.openChest('2026-09-09', now)
    expect(got).toEqual(expected)
    const ev = useStore.getState().events.at(-1)!
    expect(ev).toEqual({ t: 'chest_opened', at: now, day: '2026-09-09', reward: expected })
    expect(useStore.getState().openChest('2026-09-09', now + 1000)).toBeNull()
    expect(useStore.getState().openChest('2026-09-07', now)).toBeNull()
    expect(useStore.getState().events.filter((e) => e.t === 'chest_opened')).toHaveLength(1)
    // Yesterday's chest opens the next day.
    expect(useStore.getState().openChest('2026-09-08', now)).not.toBeNull()
  })

  it('the same state and day give the same reward: a reload never rerolls it', () => {
    const now = on(9, 18)
    const rewards: ChestReward[] = []
    for (let i = 0; i < 3; i++) {
      resetStoreForTests()
      useStore.setState({ events: [...met(7), ...met(9)] })
      rewards.push(useStore.getState().openChest('2026-09-09', now)!)
    }
    expect(rewards[1]).toEqual(rewards[0])
    expect(rewards[2]).toEqual(rewards[0])
  })

  it('logs a set’s end once (the daily quests read it)', () => {
    const s = useStore.getState()
    s.noteSetDone({ setId: 'set-1', done: ['a', 'b'], skipped: 1, now: on(9) })
    s.noteSetDone({ setId: 'set-1', done: ['a', 'b'], skipped: 1, now: on(9) })
    expect(useStore.getState().events).toEqual([{ t: 'set_done', at: on(9), setId: 'set-1', done: ['a', 'b'], skipped: 1 }])
  })
})

describe('bonus XP', () => {
  it('counts in the day’s XP and the goal like any XP, on the day she opens the chest', () => {
    const events: Ev[] = [done('a', on(9, 9)), chest('2026-09-08', on(9, 12), { kind: 'xp', xp: 35 })]
    const view = computeRewards(events, emptyRewards(), 60, on(9, 18))
    expect(view.today.xp).toBe(65)
    expect(view.today.met).toBe(true)
    expect(view.awards.at(-1)).toMatchObject({ kind: 'chest', xp: 35, day: '2026-09-09', skill: '' })
    // Settled, the day keeps it.
    expect(settleDays(emptyRewards(), events, 60, on(10)).days['2026-09-09']).toBe(1)
  })

  it('a chest opened twice for the same day (two devices merged) pays once, the first one', () => {
    const events: Ev[] = [chest('2026-09-09', on(9, 12), { kind: 'xp', xp: 20 }), chest('2026-09-09', on(9, 13), { kind: 'xp', xp: 50 })]
    expect(xpAwards(events, emptyRewards()).map((a) => a.xp)).toEqual([20])
  })
})

describe('the extra rest day', () => {
  it('is banked the day she opens it and used by the streak like a banked one', () => {
    // Monday met (the first day banks one), Tuesday met, Wednesday and Thursday missed, Friday met; now Saturday.
    const base = [...met(7), ...met(8), ...met(11)]
    const without = computeRewards(base, emptyRewards(), 60, on(12, 9))
    // Wednesday took the bank's one; Thursday had none left, and Friday was no double goal: the streak broke.
    expect(without.streak.days).toBe(1)
    const withChest = computeRewards([...base, chest('2026-09-08', on(8, 19), { kind: 'rest' })], emptyRewards(), 60, on(12, 9))
    expect(withChest.streak.days).toBe(3)
    expect(withChest.streak.week.map((d) => d.state).slice(0, 5)).toEqual(['met', 'met', 'rest', 'rest', 'met'])
    expect(withChest.streak.restDays).toBe(0)
  })

  it('never takes the bank past the most the streak allows, and is not offered while she holds the most', () => {
    // Monday is the first day (one banked); two chests' rest days that day (merged devices) only fill it to the cap.
    const events = [...met(7), chest('2026-09-06', on(7, 19), { kind: 'rest' }), chest('2026-09-07', on(7, 20), { kind: 'rest' })]
    const view = computeRewards(events, emptyRewards(), 60, on(7, 21))
    expect(view.streak.restDays).toBe(MAX_REST_DAYS)
    expect(chestRestEligible(view, events, on(7, 21))).toBe(false)
    // Fewer than the most, and none from a chest this week: allowed. Never before she has met her goal once.
    const one = [...met(7)]
    expect(chestRestEligible(computeRewards(one, emptyRewards(), 60, on(7, 21)), one, on(7, 21))).toBe(true)
    expect(chestRestEligible(computeRewards([], emptyRewards(), 60, on(7, 21)), [], on(7, 21))).toBe(false)
    // At most once a week: one chest rest day this week, and the next waits for Monday.
    const twice = [...met(7), ...met(8), chest('2026-09-08', on(8, 19), { kind: 'rest' }), ...met(9), ...met(10)]
    const thursday = computeRewards(twice, emptyRewards(), 60, on(10, 20))
    expect(chestRestEligible({ streak: { ...thursday.streak, restDays: 0 } }, twice, on(10, 20))).toBe(false)
  })
})

describe('kept by backups, the compaction and the settings', () => {
  it('export and import (replace, merge) keep the chest; a day opened on both devices counts once', () => {
    const mine: Ev[] = [...met(9), chest('2026-09-09', on(9, 12), { kind: 'theme', theme: 'plum' })]
    const file = JSON.stringify(buildBackup({ settings: { ...DEFAULT_SETTINGS, theme: 'plum' }, events: mine, weekly: {}, streak: { lastDay: '', count: 0 }, rewards: emptyRewards() }))
    const replaced = importBackup({ events: [], weekly: {}, streak: { lastDay: '', count: 0 } }, file, 'replace')
    if (!replaced.ok) throw new Error(replaced.error)
    expect(replaced.events.filter((e) => e.t === 'chest_opened')).toHaveLength(1)
    expect(ownedThemes(replaced.events)).toEqual(['plum'])
    expect(replaced.settings.theme).toBe('plum')

    // The other device opened the same day's chest later (another reward): merged, both records stay, the first counts.
    const theirs: Ev[] = [...met(9), chest('2026-09-09', on(9, 15), { kind: 'xp', xp: 40 })]
    const merged = importBackup({ events: theirs, weekly: {}, streak: { lastDay: '', count: 0 }, rewards: emptyRewards() }, file, 'merge')
    if (!merged.ok) throw new Error(merged.error)
    expect(merged.events.filter((e) => e.t === 'chest_opened')).toHaveLength(2)
    expect(chestOpenings(merged.events).get('2026-09-09')!.reward).toEqual({ kind: 'theme', theme: 'plum' })
    expect(xpAwards(merged.events, emptyRewards()).some((a) => a.kind === 'chest')).toBe(false)
  })

  it('the store’s own export, import and compaction: the chest she opened stays opened, with what it gave', () => {
    const now = on(9, 18)
    useStore.setState({ events: [...met(7), ...met(9)] })
    const reward = useStore.getState().openChest('2026-09-09', now)!
    const file = useStore.getState().exportJson()
    resetStoreForTests()
    expect(useStore.getState().importJson(file, 'replace')).toMatchObject({ ok: true })
    expect(chestOpenings(useStore.getState().events).get('2026-09-09')?.reward).toEqual(reward)
    // Merged into itself: nothing new, still one chest.
    expect(useStore.getState().importJson(file, 'merge')).toMatchObject({ ok: true, added: 0 })
    expect(useStore.getState().events.filter((e) => e.t === 'chest_opened')).toHaveLength(1)
    // A hundred days on, the compaction folds the problems and keeps the chest.
    useStore.getState().compactNow(now + 100 * 86_400_000)
    expect(useStore.getState().events.map((e) => e.t)).toEqual(['chest_opened'])
    expect(useStore.getState().openChest('2026-09-09', now)).toBeNull()
  })

  it('the compaction keeps a chest’s opening however old, and drops a set’s end with no counter of its own', () => {
    const now = on(9, 12) + 100 * 86_400_000
    const events: Ev[] = [
      { t: 'step_accepted', at: on(7), attemptId: 'x', skill: S, stepIdx: 0, firstTry: true, revealed: false, property: 'skipped' },
      { t: 'set_done', at: on(7), setId: 'set-old', done: ['x'], skipped: 0 },
      chest('2026-09-07', on(7, 20), { kind: 'rest' }),
    ]
    const r = compact(events, {}, now, SIXTY_DAYS_MS)
    expect(r.events.map((e) => e.t)).toEqual(['chest_opened'])
    expect(r.folded).toBe(2)
    for (const skills of Object.values(r.weekly)) expect(Object.keys(skills)).toEqual([S])
    // Nothing old but a chest: nothing to do.
    expect(compact(r.events, r.weekly, now + 86_400_000).folded).toBe(0)
    expect(dayKey(now)).not.toBe('2026-09-07')
  })

  it('the theme setting: a known theme is kept, anything else dropped; replace takes the file’s, merge keeps this device’s', () => {
    expect(normalizeSettings({ theme: 'ocean' }).theme).toBe('ocean')
    expect(normalizeSettings({ theme: 'forest' }).theme).toBeUndefined()
    const here = { ...DEFAULT_SETTINGS, theme: 'ocean' as const }
    const file = { ...DEFAULT_SETTINGS, theme: 'cocoa' as const }
    expect(settingsAfterImport(here, file, 'replace').theme).toBe('cocoa')
    expect(settingsAfterImport(here, file, 'merge').theme).toBe('ocean')
  })
})
