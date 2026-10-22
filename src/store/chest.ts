/**
 * The daily chest (docs/progress/phone-quests.md): when her three daily quests are done (session/quests.ts), a chest
 * appears; she taps it open and gets one reward. Opening it is an event in the log (`chest_opened`), so backups, an
 * import and the compaction keep it, and the reward it recorded is the reward: a reload never rerolls it.
 *
 * The reward is drawn from the chest's day (a hash, the same every time for the same day) and what she has when she
 * opens it:
 * - bonus XP, most days: 15 to 50 in fives, counted on the day she opens it, in the day's XP and the goal like any XP;
 * - an extra rest day for the streak, about one chest in five, at most once a week (Monday to Sunday) and only while
 *   she holds fewer rest days than the streak allows (store/rewards.ts `MAX_REST_DAYS`); it is banked the day she opens
 *   it and used like the weekly one;
 * - a colour theme she does not own yet (store/themes.ts), rarely (about one chest in twelve), until she owns them all.
 * When the day's draw is a reward she cannot have (a rest day while she holds the most, or a theme once she owns them
 * all), it is bonus XP instead. Nothing here can be bought, and nothing comes from an ad. Pure.
 */
import { EARNED_THEMES, isThemeId } from './themes'
import { dayKey, startOfIsoWeek } from './time'
import type { ChestReward, Ev, ThemeId } from './types'

export const CHEST_XP_MIN = 15
export const CHEST_XP_MAX = 50
export const CHEST_XP_STEP = 5
/** Out of 100 chest days: a theme (while one is left to win). */
export const THEME_CHANCE = 8
/** Out of 100 chest days: a rest day (where one is allowed), after the theme's share. */
export const REST_CHANCE = 20

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** A 32-bit hash of a string (FNV-1a, then a final mix so nearby days land far apart). Deterministic. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** A chest's reward as stored, or null when it is not one this app gives (a hand-edited backup). */
export function normalizeChestReward(raw: unknown): ChestReward | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (r.kind === 'xp') {
    const xp = r.xp
    if (typeof xp !== 'number' || !Number.isInteger(xp) || xp < CHEST_XP_MIN || xp > CHEST_XP_MAX) return null
    return { kind: 'xp', xp }
  }
  if (r.kind === 'rest') return { kind: 'rest' }
  if (r.kind === 'theme' && isThemeId(r.theme) && EARNED_THEMES.includes(r.theme)) return { kind: 'theme', theme: r.theme }
  return null
}

export interface ChestOpening {
  /** The chest's day ('YYYY-MM-DD'). */
  day: string
  /** When she opened it (epoch ms). */
  at: number
  reward: ChestReward
  /** The event's index in the log. */
  index: number
}

/**
 * Every chest she opened, by its day: the first opening of each day in the log (two devices that each opened the same
 * day's chest before a merge count once). Malformed records are skipped.
 */
export function chestOpenings(events: readonly Ev[]): Map<string, ChestOpening> {
  const out = new Map<string, ChestOpening>()
  events.forEach((e, index) => {
    if (e.t !== 'chest_opened' || typeof e.day !== 'string' || !DAY_RE.test(e.day) || out.has(e.day)) return
    const reward = normalizeChestReward(e.reward)
    if (!reward) return
    out.set(e.day, { day: e.day, at: e.at, reward, index })
  })
  return out
}

/** The indices of the chest events that count (the first valid opening of each day). */
export function countedChestIndices(events: readonly Ev[]): Set<number> {
  return new Set([...chestOpenings(events).values()].map((o) => o.index))
}

/** The themes her chests gave her, in the order Settings lists them. Navy is not among them: it is always hers. */
export function ownedThemes(events: readonly Ev[]): ThemeId[] {
  const won = new Set<ThemeId>()
  for (const o of chestOpenings(events).values()) if (o.reward.kind === 'theme') won.add(o.reward.theme)
  return EARNED_THEMES.filter((t) => won.has(t))
}

/** Rest days from chests, by the day she opened them (that is the day each is banked). */
export function chestRestByDay(events: readonly Ev[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const o of chestOpenings(events).values()) {
    if (o.reward.kind !== 'rest') continue
    const day = dayKey(o.at)
    out.set(day, (out.get(day) ?? 0) + 1)
  }
  return out
}

/** A chest gave her a rest day this week (Monday to Sunday, the week of `now`): the next one waits for next week. */
export function restChestThisWeek(events: readonly Ev[], now: number): boolean {
  const monday = startOfIsoWeek(now)
  for (const o of chestOpenings(events).values()) if (o.reward.kind === 'rest' && o.at >= monday && o.at <= now) return true
  return false
}

export interface ChestDrawContext {
  /** The themes she owns already. */
  owned: readonly ThemeId[]
  /** A rest day is allowed now: fewer saved than the streak allows, none from a chest this week, a streak begun. */
  restEligible: boolean
}

/** The chest's roll for its day (0 to 99): the same every time for the same day. */
export function chestRoll(day: string): number {
  return hashString(`chest|${day}`) % 100
}

/** The reward a chest of this day gives, with what she has now (see the top of this file). Deterministic. */
export function drawChestReward(day: string, ctx: ChestDrawContext): ChestReward {
  const roll = chestRoll(day)
  const left = EARNED_THEMES.filter((t) => !ctx.owned.includes(t))
  if (roll < THEME_CHANCE) {
    if (left.length > 0) return { kind: 'theme', theme: left[hashString(`chest-theme|${day}`) % left.length]! }
  } else if (roll < THEME_CHANCE + REST_CHANCE && ctx.restEligible) {
    return { kind: 'rest' }
  }
  const steps = (CHEST_XP_MAX - CHEST_XP_MIN) / CHEST_XP_STEP + 1
  return { kind: 'xp', xp: CHEST_XP_MIN + CHEST_XP_STEP * (hashString(`chest-xp|${day}`) % steps) }
}
