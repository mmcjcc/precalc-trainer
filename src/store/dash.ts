/**
 * Monster Dash tokens: Blooket-style earn-to-play, by the day. Finishing a practice set with
 * nothing skipped earns one play that same local day (capped); a finished run spends one. Both
 * sides are read straight from the event log (`set_done`, `dash_run`), so there is no counter to
 * drift — and because the economy is daily, the 60-day compaction (which deletes old events) can
 * never change today's tokens. The all-time best score lives in `rewards.dashBest`, not here.
 */
import { dayKey } from './time'
import type { Ev, RewardsState } from './types'

/** The most plays one day's practice can earn. */
export const DASH_DAY_CAP = 5

function onDay(at: number, day: string): boolean {
  return dayKey(at) === day
}

/** Sets that count: finished that day, at least one problem done, nothing skipped (the quests' bar). */
export function dashEarned(events: readonly Ev[], day: string): number {
  let n = 0
  for (const e of events) {
    if (e.t === 'set_done' && e.skipped === 0 && e.done.length > 0 && onDay(e.at, day)) n += 1
  }
  return Math.min(DASH_DAY_CAP, n)
}

export function dashSpent(events: readonly Ev[], day: string): number {
  let n = 0
  for (const e of events) {
    if (e.t === 'dash_run' && onDay(e.at, day)) n += 1
  }
  return n
}

/** Plays she has left today. */
export function dashTokens(events: readonly Ev[], day: string): number {
  return Math.max(0, dashEarned(events, day) - dashSpent(events, day))
}

/** The best score ever: the folded field, plus any run still in the live log that beats it. */
export function dashBestOf(rewards: Pick<RewardsState, 'dashBest'>, events: readonly Ev[]): number {
  let best = rewards.dashBest ?? 0
  for (const e of events) {
    if (e.t === 'dash_run' && e.score > best) best = e.score
  }
  return best
}
