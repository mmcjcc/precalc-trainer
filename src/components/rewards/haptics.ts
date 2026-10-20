import { useEffect } from 'react'
import { rewardsOn, rewardsViewOf, useStore, vibrateOn, type Ev } from '@/store'

/** A light tick on a right line or part. */
export const TICK_MS = 10
/** Meeting the goal: two light ticks. */
export const GOAL_TICK: readonly number[] = [10, 70, 10]

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Vibrate where the device can; skip it silently where it cannot (iPhone Safari has no vibrate). */
export function vibrate(pattern: number | readonly number[]): void {
  if (!canVibrate()) return
  try {
    navigator.vibrate(typeof pattern === 'number' ? pattern : [...pattern])
  } catch {
    /* a blocked vibrate is not an error */
  }
}

function rightLineOrPart(e: Ev): boolean {
  return (e.t === 'step_accepted' && !e.revealed) || (e.t === 'final_answer' && e.correct)
}

/** Events older than this when they reach the log were not just done here (an import): no tick. */
const FRESH_MS = 10_000

/**
 * The rewards' haptics (mount once): a 10 ms tick when a line or a part is right, and a goal tick when today's XP
 * reaches the goal (or the double goal that mends a missed day). Only with rewards on and "Vibrate" on; only for
 * events she just added (an import or a reset is not a tick).
 */
export function useRewardTicks(): void {
  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        const next = s.events
        const old = prev.events
        if (next === old || next.length <= old.length) return
        if (old.length > 0 && next[old.length - 1] !== old[old.length - 1]) return
        if (!rewardsOn(s.settings) || !vibrateOn(s.settings) || !canVibrate()) return
        const now = Date.now()
        const added = next.slice(old.length)
        if (added.some((e) => now - e.at > FRESH_MS)) return
        const before = rewardsViewOf(prev, now).today
        const after = rewardsViewOf(s, now).today
        const reached = (target: number) => before.xp < target && after.xp >= target
        if (reached(after.goal) || (after.target > after.goal && reached(after.target)) || (before.target > before.goal && reached(before.target))) {
          vibrate(GOAL_TICK)
          return
        }
        if (added.some(rightLineOrPart)) vibrate(TICK_MS)
      }),
    [],
  )
}
