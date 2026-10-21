import { useEffect } from 'react'
import { currentSlotOf, loadActiveSet } from '@/session/activeSet'
import { comboOf, comboScope } from '@/session/combo'
import {
  milestoneReached,
  milestonesThrough,
  rewardsOn,
  rewardsViewOf,
  useStore,
  type Ev,
  type StoreState,
  type TodayView,
  type XpAward,
} from '@/store'
import { burstConfetti } from './Confetti'
import { cuesFor } from './cues'
import { showMilestone } from './Milestone'
import { motionAllowed } from './motion'
import { installSoundUnlock, playCue, soundsOn } from './sounds'
import { floatPoint, floatXp } from './XpFloats'

/** Events older than this when they reach the log were not just done here (an import): no sound, no float. */
const FRESH_MS = 10_000
/**
 * What one tap adds can take a few store updates (a check that grades two boxes, a last line and the finish that an
 * effect records right after it): they are one moment, decided this long after the first.
 */
export const MOMENT_MS = 40

/** The events `next` adds to `old`, when it only appends events she just did here; null otherwise (an import, a reset). */
export function freshlyAdded(next: readonly Ev[], old: readonly Ev[], now: number): Ev[] | null {
  if (next === old || next.length <= old.length) return null
  if (old.length > 0 && next[old.length - 1] !== old[old.length - 1]) return null
  const added = next.slice(old.length)
  return added.every((e) => now - e.at <= FRESH_MS) ? added : null
}

/** These events took today's XP to the goal, or to the double goal that mends a missed day (as the goal tick does). */
export function goalReached(before: TodayView, after: TodayView): boolean {
  if (before.day !== after.day) return false
  const reached = (target: number) => before.xp < target && after.xp >= target
  return reached(after.goal) || (after.target > after.goal && reached(after.target)) || (before.target > before.goal && reached(before.target))
}

function awardKey(a: XpAward): string {
  return [a.kind, a.attemptId ?? '', a.stepIdx ?? '', a.part ?? '', a.pattern ?? '', a.at].join('|')
}

/** Awards in `after` that `before` did not have. */
function newAwards(before: readonly XpAward[], after: readonly XpAward[]): XpAward[] {
  const had = new Set(before.map(awardKey))
  return after.filter((a) => !had.has(awardKey(a)))
}

/** The attempts this moment's combo runs over: its problem, after the running set's earlier ones when it is in it. */
function scopeOf(attemptId: string, s: StoreState): string[] {
  const set = loadActiveSet()
  if (!set) return comboScope(attemptId)
  if (set.attemptIds.includes(attemptId)) return comboScope(attemptId, set)
  const live = s.attempt
  if (live && live.id === attemptId && currentSlotOf(set, live) !== null) return comboScope(attemptId, set)
  return comboScope(attemptId)
}

function lastAttemptId(events: readonly Ev[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!
    if (e.t !== 'drill_answer') return e.attemptId
  }
  return null
}

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height' | 'bottom'>

/** An element's box on the screen, with the page's scroll when it was measured. */
interface Spot {
  rect: Rect
  scroll: { x: number; y: number }
}

function spotOf(el: Element | null | undefined): Spot | null {
  if (!el || !el.isConnected) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { rect: { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom }, scroll: { x: window.scrollX, y: window.scrollY } }
}

const LINE_KINDS = new Set<XpAward['kind']>(['line', 'line_fixed', 'line_picked'])
const PART_KINDS = new Set<XpAward['kind']>(['part', 'part_fixed'])

/** "+10" from each line and part these events paid for: a line from its row in the work list, a part from what she checked. */
function floatAwards(awards: readonly XpAward[], actedOn: Spot | null): void {
  let n = 0
  for (const a of awards) {
    if (a.xp <= 0 || !(LINE_KINDS.has(a.kind) || PART_KINDS.has(a.kind))) continue
    let spot: Spot | null = null
    if (LINE_KINDS.has(a.kind) && a.stepIdx !== undefined) {
      const rows = document.querySelectorAll(`[data-kept-step="${a.stepIdx}"]`)
      const row = rows[rows.length - 1]
      spot = spotOf(row?.querySelector('[data-kept-check]') ?? row)
    }
    spot ??= actedOn
    const point = spot ? floatPoint(spot.rect, spot.scroll) : null
    if (!point) continue
    floatXp({ xp: a.xp, x: point.x, y: point.y, delay: n * 160 })
    n += 1
  }
}

/** What she acted on when the moment began (the box she checked, the button she tapped): a part's "+10" rises there. */
function actedOnSpot(lastPointer: { el: Element; at: number } | null): Spot | null {
  if (typeof document === 'undefined') return null
  const active = document.activeElement
  if (active && active !== document.body && active !== document.documentElement) {
    const spot = spotOf(active)
    if (spot) return spot
  }
  if (lastPointer && Date.now() - lastPointer.at < 2000) return spotOf(lastPointer.el)
  return null
}

/**
 * The juice that follows the event log (mount once, in the app shell), the way the vibrate tick does: only for
 * events she just added here, never for an import, a reset or the compaction.
 * - Sounds (Settings "Sounds", rewards on or off): the chime climbing with the combo, the "nope", the arpeggio, and with
 *   rewards on the pop of a squashed mistake and the sparkle of today's goal (cues.ts).
 * - Rewards on: "+10" floating from the line or part that earned it, confetti when today's goal is met, and the first
 *   time the streak reaches 7, 30 or 100 days the milestone banner with confetti and the sparkle, remembered in the
 *   rewards' slice so it never comes again.
 * Motion is left out under reduced motion. The set's results play their own fanfare (components/set/SetSummary.tsx).
 */
export function useJuice(): void {
  useEffect(() => {
    const uninstall = installSoundUnlock(() => soundsOn(useStore.getState().settings))
    let lastPointer: { el: Element; at: number } | null = null
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Element) lastPointer = { el: e.target, at: Date.now() }
    }
    window.addEventListener('pointerdown', onPointer, { capture: true, passive: true })

    let moment: { prev: StoreState; actedOn: Spot | null; timer: ReturnType<typeof setTimeout> } | null = null
    const cancel = () => {
      if (moment) clearTimeout(moment.timer)
      moment = null
    }

    const decide = (prev: StoreState, actedOn: Spot | null) => {
      const s = useStore.getState()
      const now = Date.now()
      const added = freshlyAdded(s.events, prev.events, now)
      if (!added) return
      const sounds = soundsOn(s.settings)
      const rewards = rewardsOn(s.settings)
      if (!sounds && !rewards) return
      const attemptId = lastAttemptId(added)
      const combo = attemptId ? comboOf(s.events, scopeOf(attemptId, s)) : 0
      let reached = false
      let squashed = 0
      let milestone: number | null = null
      let days = 0
      let paid: XpAward[] = []
      if (rewards) {
        const before = rewardsViewOf(prev, now)
        const after = rewardsViewOf(s, now)
        reached = goalReached(before.today, after.today)
        paid = newAwards(before.awards, after.awards)
        squashed = paid.filter((a) => a.kind === 'squash').length
        days = after.streak.days
        milestone = milestoneReached(before.streak.days, days, s.rewards.milestones)
      }
      if (sounds) {
        for (const c of cuesFor({ added, combo, goalReached: reached, squashed, milestone: milestone !== null })) {
          playCue(c.cue, { step: c.step, delay: c.delay })
        }
      }
      if (!rewards) return
      if (motionAllowed()) {
        floatAwards(paid, actedOn)
        // A milestone throws its own, bigger burst.
        if (reached && milestone === null) burstConfetti()
      }
      if (milestone !== null) {
        // Remembered first: the celebration never comes twice, even if the app closes right now.
        s.noteMilestones(milestonesThrough(days))
        showMilestone(milestone)
        burstConfetti({ count: 64 })
      }
    }

    const unsubscribe = useStore.subscribe((s, prev) => {
      if (s.events === prev.events) return
      if (!freshlyAdded(s.events, prev.events, Date.now())) {
        // An import, a reset or the compaction: whatever was being gathered is not hers to celebrate.
        cancel()
        return
      }
      if (moment) return
      const started = { prev, actedOn: actedOnSpot(lastPointer) }
      moment = {
        ...started,
        timer: setTimeout(() => {
          moment = null
          decide(started.prev, started.actedOn)
        }, MOMENT_MS),
      }
    })

    return () => {
      unsubscribe()
      cancel()
      uninstall()
      window.removeEventListener('pointerdown', onPointer, { capture: true })
    }
  }, [])
}
