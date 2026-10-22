/** The daily chest's reward (store/chest.ts): drawn from the day, the same every time; what she has decides what can come. */
import { describe, expect, it } from 'vitest'
import {
  CHEST_XP_MAX,
  CHEST_XP_MIN,
  REST_CHANCE,
  THEME_CHANCE,
  chestOpenings,
  chestRestByDay,
  chestRoll,
  drawChestReward,
  hashString,
  normalizeChestReward,
  ownedThemes,
  restChestThisWeek,
} from './chest'
import { addDays } from './rewards'
import { EARNED_THEMES } from './themes'
import type { ChestReward, Ev } from './types'

const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime()

function opened(day: string, when: number, reward: ChestReward): Ev {
  return { t: 'chest_opened', at: when, day, reward }
}

/** Ten years of days from 2026-01-01. */
const DAYS = Array.from({ length: 3650 }, (_, i) => addDays('2026-01-01', i))

describe('the draw', () => {
  it('is the same every time for the same day and the same state', () => {
    for (const day of DAYS.slice(0, 200)) {
      const ctx = { owned: [], restEligible: true }
      expect(drawChestReward(day, ctx)).toEqual(drawChestReward(day, ctx))
    }
    expect(hashString('chest|2026-10-22')).toBe(hashString('chest|2026-10-22'))
    expect(hashString('chest|2026-10-22')).not.toBe(hashString('chest|2026-10-23'))
  })

  it('is mostly bonus XP (15 to 50, in fives), a rest day about one day in five, a theme about one in twelve', () => {
    const counts = { xp: 0, rest: 0, theme: 0 }
    const xps = new Set<number>()
    for (const day of DAYS) {
      const r = drawChestReward(day, { owned: [], restEligible: true })
      counts[r.kind] += 1
      if (r.kind === 'xp') {
        expect(r.xp).toBeGreaterThanOrEqual(CHEST_XP_MIN)
        expect(r.xp).toBeLessThanOrEqual(CHEST_XP_MAX)
        expect(r.xp % 5).toBe(0)
        xps.add(r.xp)
      }
    }
    expect(xps.size).toBe(8)
    expect(counts.xp / DAYS.length).toBeGreaterThan(0.65)
    expect(Math.abs(counts.rest / DAYS.length - REST_CHANCE / 100)).toBeLessThan(0.03)
    expect(Math.abs(counts.theme / DAYS.length - THEME_CHANCE / 100)).toBeLessThan(0.02)
  })

  it('gives a theme she does not own yet, and XP once she owns them all', () => {
    const themeDays = DAYS.filter((d) => chestRoll(d) < THEME_CHANCE)
    expect(themeDays.length).toBeGreaterThan(100)
    for (const day of themeDays.slice(0, 50)) {
      const r = drawChestReward(day, { owned: ['ocean', 'plum'], restEligible: true })
      expect(r).toEqual({ kind: 'theme', theme: 'cocoa' })
      const all = drawChestReward(day, { owned: [...EARNED_THEMES], restEligible: true })
      expect(all.kind).toBe('xp')
    }
    // Every theme can come.
    const seen = new Set(themeDays.map((d) => drawChestReward(d, { owned: [], restEligible: false })).map((r) => (r.kind === 'theme' ? r.theme : '')))
    for (const t of EARNED_THEMES) expect(seen.has(t)).toBe(true)
  })

  it('gives a rest day only where one is allowed; otherwise XP', () => {
    const restDays = DAYS.filter((d) => chestRoll(d) >= THEME_CHANCE && chestRoll(d) < THEME_CHANCE + REST_CHANCE)
    for (const day of restDays.slice(0, 50)) {
      expect(drawChestReward(day, { owned: [], restEligible: true })).toEqual({ kind: 'rest' })
      expect(drawChestReward(day, { owned: [], restEligible: false }).kind).toBe('xp')
    }
  })
})

describe('what the log says', () => {
  it('counts the first opening of each day once (two devices merged), and skips records this app never writes', () => {
    const events: Ev[] = [
      opened('2026-10-20', at(2026, 10, 20), { kind: 'xp', xp: 25 }),
      opened('2026-10-20', at(2026, 10, 20, 11), { kind: 'xp', xp: 50 }),
      opened('2026-10-21', at(2026, 10, 21), { kind: 'xp', xp: 9999 }),
      opened('nonsense', at(2026, 10, 21), { kind: 'rest' }),
      opened('2026-10-21', at(2026, 10, 21, 12), { kind: 'rest' }),
    ]
    const o = chestOpenings(events)
    expect([...o.keys()]).toEqual(['2026-10-20', '2026-10-21'])
    expect(o.get('2026-10-20')!.reward).toEqual({ kind: 'xp', xp: 25 })
    expect(o.get('2026-10-21')!.reward).toEqual({ kind: 'rest' })
    expect(normalizeChestReward({ kind: 'theme', theme: 'navy' })).toBeNull()
    expect(normalizeChestReward({ kind: 'theme', theme: 'plum' })).toEqual({ kind: 'theme', theme: 'plum' })
    expect(normalizeChestReward({ kind: 'xp', xp: 22.5 })).toBeNull()
    expect(normalizeChestReward(null)).toBeNull()
  })

  it('a theme is hers once a chest gave it (in Settings order); a rest day is banked the day she opened the chest', () => {
    const events: Ev[] = [
      opened('2026-10-19', at(2026, 10, 19), { kind: 'theme', theme: 'cocoa' }),
      // Yesterday's chest, opened the next day: its rest day is banked on the day she opened it.
      opened('2026-10-20', at(2026, 10, 21, 8), { kind: 'rest' }),
      opened('2026-10-21', at(2026, 10, 21, 20), { kind: 'theme', theme: 'ocean' }),
    ]
    expect(ownedThemes(events)).toEqual(['ocean', 'cocoa'])
    expect([...chestRestByDay(events)]).toEqual([['2026-10-21', 1]])
    // Wednesday 2026-10-21: this week (from Monday the 19th) already had one; next Monday it is allowed again.
    expect(restChestThisWeek(events, at(2026, 10, 22))).toBe(true)
    expect(restChestThisWeek(events, at(2026, 10, 26))).toBe(false)
  })
})
