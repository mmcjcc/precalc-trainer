/**
 * The combo (docs/progress/phone-juice.md): right lines and parts in a row on the first try, counted over this
 * problem and, in a running set, the set's problems before it. Pure: a function of the event log.
 *
 * - A line counts when it is right on the first try (`step_accepted.firstTry`): typed, or a card picked right on the
 *   first pick (Guided mode). A line kept after a slip on it adds nothing (the slip already reset the combo).
 * - A part counts when it is right with no wrong check since the last right one (the rewards' own rule for a part:
 *   store/rewards.ts); a box a check grades every time (`final_answer.part`) counts once.
 * - A slip resets it quietly: a rejected line (typed or a wrong card) or a wrong check.
 * - A revealed line ("Show the step") or a part answered after a rung-3 hint does not count, and it breaks the row.
 * - An undone line does not count (its undo takes it back); hints below rung 3, a skipped problem and a finished one
 *   change nothing.
 */
import { cancelledSteps } from '@/store/compaction'
import type { Ev } from '@/store/types'

/** The combo pill shows from this many in a row (with rewards on). */
export const COMBO_SHOWS_AT = 3
/** The pill grows at these. */
export const COMBO_GROWS_AT: readonly number[] = [5, 10]
/** The chime climbs one step per right answer in a row, up to this many steps. */
export const CHIME_STEPS = 8

interface PartTrack {
  /** A wrong check on the part being worked on (the parts flows check one part at a time). */
  wrong: boolean
  /** Boxes a check grades every time: a wrong check on each, and whether it was counted right already. */
  boxes: Map<string, { wrong: boolean; done: boolean }>
  /** A wrong check that names no box counts against every box still open. */
  anyWrong: boolean
  /** A rung-3 hint not yet followed by a line or a right part. */
  revealPending: boolean
}

/** Right lines and parts in a row on the first try, over the attempts in `scope`. */
export function comboOf(events: readonly Ev[], scope: readonly string[]): number {
  if (scope.length === 0) return 0
  const ids = new Set(scope)
  const cancelled = cancelledSteps(events)
  const tracks = new Map<string, PartTrack>()
  const trackOf = (id: string): PartTrack => {
    let t = tracks.get(id)
    if (!t) {
      t = { wrong: false, boxes: new Map(), anyWrong: false, revealPending: false }
      tracks.set(id, t)
    }
    return t
  }
  let combo = 0
  events.forEach((e, i) => {
    if (e.t === 'drill_answer' || !ids.has(e.attemptId)) return
    switch (e.t) {
      case 'step_accepted': {
        trackOf(e.attemptId).revealPending = false
        if (cancelled.has(i)) return
        if (e.revealed) combo = 0
        else if (e.firstTry) combo += 1
        return
      }
      case 'step_rejected':
        combo = 0
        return
      case 'hint':
        if (e.rung === 3) trackOf(e.attemptId).revealPending = true
        return
      case 'final_answer': {
        const t = trackOf(e.attemptId)
        if (!e.correct) {
          combo = 0
          if (e.part !== undefined) boxOf(t, e.part).wrong = true
          else {
            t.wrong = true
            t.anyWrong = true
          }
          return
        }
        const revealed = t.revealPending
        t.revealPending = false
        let wrong: boolean
        if (e.part !== undefined) {
          const box = boxOf(t, e.part)
          if (box.done) return // the same box right again on a later check
          box.done = true
          wrong = box.wrong || t.anyWrong
        } else {
          wrong = t.wrong
          t.wrong = false
        }
        if (revealed) combo = 0
        else if (!wrong) combo += 1
        return
      }
      case 'problem_done':
      case 'problem_abandoned':
        tracks.delete(e.attemptId)
        return
      case 'step_undone':
        return
    }
  })
  return combo
}

function boxOf(t: PartTrack, part: string): { wrong: boolean; done: boolean } {
  let box = t.boxes.get(part)
  if (!box) {
    box = { wrong: false, done: false }
    t.boxes.set(part, box)
  }
  return box
}

/**
 * The attempts a combo runs over: this problem's, after the earlier problems of the running set it belongs to. Pass
 * `set` only when the attempt is one of the set's problems (the set's current one when its slot is not noted yet).
 */
export function comboScope(attemptId: string | null | undefined, set?: { index: number; attemptIds: readonly (string | null)[] } | null): string[] {
  if (!attemptId) return []
  if (!set) return [attemptId]
  const slot = set.attemptIds.indexOf(attemptId)
  const upTo = slot >= 0 ? slot : set.index
  const before = set.attemptIds.slice(0, upTo).filter((id): id is string => id !== null && id !== attemptId)
  return [...before, attemptId]
}

/** The pill's size: 0 hidden (under 3), 1 from 3, 2 from 5, 3 from 10. */
export function comboTier(combo: number): 0 | 1 | 2 | 3 {
  if (combo < COMBO_SHOWS_AT) return 0
  if (combo < COMBO_GROWS_AT[0]!) return 1
  if (combo < COMBO_GROWS_AT[1]!) return 2
  return 3
}

/** The chime's step (0 to 7) for a right answer that made the combo `combo`: one step up per answer in a row. */
export function chimeStep(combo: number): number {
  return Math.min(Math.max(combo, 1), CHIME_STEPS) - 1
}
