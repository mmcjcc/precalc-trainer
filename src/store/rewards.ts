/**
 * Rewards: XP, the daily goal, the streak with rest days, the mistake collection and the problem-type rings
 * (docs/progress/phone-rewards.md). Pure.
 *
 * XP is a function of the event log and `RewardsState` (pct.rewards), the small slice that keeps what the 60-day
 * compaction would take away: the days she met her goal, and the mistake cards and first masteries of the events it
 * deletes. A backup carries both, so a restore recomputes everything, and nothing is counted twice.
 *
 * XP:
 * - a line or a part right on the first try +10 (not revealed); fixed after a named mistake on it +5; revealed 0;
 * - a finished problem +20, and +10 more with no hints and nothing revealed;
 * - a right drill answer +2;
 * - a mistake squashed +50 (once per card), a problem type newly mastered +100 (once per type);
 * - a mastered type pays half (rounded up) until it is due for review again: two weeks after its last problem.
 * Hints never cost anything except the no-hints bonus.
 * Guided mode: a line picked from the cards (`via: 'card'`) pays +4 instead when the first card she picked for it was
 * the right one, and nothing after a wrong pick; a problem with a picked line stays out of the mastery window and the
 * rings, as a timed one does (`inMasteryWindow`).
 *
 * Lines are `step_accepted` events (with the step's own first-try and revealed flags; an undone line pays nothing).
 * Parts are right `final_answer` events: the wrong checks since the attempt's last right one are the mistakes on it
 * (the parts flows check one part at a time), and a rung-3 hint since then revealed it. A check that grades several
 * boxes each time logs `part` (the inequality's interval and set-builder), so each box pays once.
 */
import { STORE } from '@/edition'
import { MASTERY_WINDOW, cancelledSteps, inMasteryWindow } from './compaction'
import { mergeMilestones, normalizeMilestones } from './milestones'
import { MASTERY_THRESHOLD, windowMastered, type MasteryEntry } from './selectors'
import { dayKey, daysBetweenKeys, startOfIsoWeek } from './time'
import { emptyRewards, type DailyGoal, type DayMark, type Ev, type MistakeCardState, type RewardsState, type Settings } from './types'

const DAY_MS = 86_400_000

export const XP = {
  firstTry: 10,
  /** Guided mode: a line picked from the cards, the right card on the first pick. */
  picked: 4,
  fixed: 5,
  finish: 20,
  noHints: 10,
  drill: 2,
  squash: 50,
  mastered: 100,
} as const

export const DAILY_GOALS: readonly DailyGoal[] = [30, 60, 100]
export const DEFAULT_DAILY_GOAL: DailyGoal = 60
/** Finished problems of the same type, each without the mistake, that squash it. */
export const SQUASH_AFTER = 3
/** A mastered type is due for review (full XP again) two weeks after its last problem. */
export const REVIEW_AFTER_MS = 14 * DAY_MS
/** One rest day more each week, at most this many saved. */
export const MAX_REST_DAYS = 2
/** Whole days away with no work at all that make coming back a comeback. */
export const COMEBACK_DAYS = 3

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** The rewards switch: absent means the edition's default (on in the store app, off in the family web app). */
export function rewardsOn(settings: Pick<Settings, 'rewards'>, store: boolean = STORE): boolean {
  return settings.rewards ?? store
}

export function dailyGoalOf(settings: Pick<Settings, 'dailyGoal'>): DailyGoal {
  return settings.dailyGoal ?? DEFAULT_DAILY_GOAL
}

/** The vibrate switch (it only matters with rewards on): absent means on. */
export function vibrateOn(settings: Pick<Settings, 'vibrate'>): boolean {
  return settings.vibrate !== false
}

export function isDailyGoal(v: unknown): v is DailyGoal {
  return v === 30 || v === 60 || v === 100
}

// ---------------------------------------------------------------------------
// XP awards
// ---------------------------------------------------------------------------

export type AwardKind =
  /** A line right on the first try. */
  | 'line'
  /** A line fixed after a named mistake on it. */
  | 'line_fixed'
  /** A line picked from the cards (Guided mode), the right card on the first pick. */
  | 'line_picked'
  /** A part right on the first try. */
  | 'part'
  /** A part fixed after a named mistake on it. */
  | 'part_fixed'
  /** A finished problem. */
  | 'finish'
  /** A finished problem with no hints and nothing revealed. */
  | 'no_hints'
  /** A mistake squashed. */
  | 'squash'
  /** A problem type newly mastered. */
  | 'mastered'
  /** A right drill answer. */
  | 'drill'

export interface XpAward {
  kind: AwardKind
  xp: number
  at: number
  /** Local day ('YYYY-MM-DD'). */
  day: string
  skill: string
  attemptId?: string
  /** Lines: the step index. */
  stepIdx?: number
  /** Parts: the box the flow named (`final_answer.part`), when it named one. */
  part?: string
  /** Paid at half: the type was mastered and is not due for review yet. */
  half?: true
  /** Squash: the mistake's pattern id. */
  pattern?: string
}

export function cardKey(pattern: string, skill: string): string {
  return `${pattern}|${skill}`
}

interface BoxTrack {
  wrong: boolean
  named: boolean
  done: boolean
}

interface AttemptTrack {
  /** Step indices with a named rejection so far. */
  namedAt: Set<number>
  /** A named rejection since the last accepted line (the even/odd columns share step indices). */
  namedSinceLine: boolean
  /** Step indices with a wrong card picked (Guided mode): a picked line there pays nothing. */
  pickedWrongAt: Set<number>
  /** The part being worked on: a wrong check and a named mistake since the last right one. */
  part: { wrong: boolean; named: boolean }
  /** Boxes a check grades every time (`final_answer.part`). */
  boxes: Map<string, BoxTrack>
  /** A wrong check that names no box (the interval and set-builder disagreeing): it counts against every open box. */
  anyWrong: boolean
  anyNamed: boolean
  /** A rung-3 hint ("show the step", "explain the answer") not yet followed by a line or a right part. */
  revealPending: boolean
}

interface SkillTrack {
  /** The last MASTERY_WINDOW normal-mode finishes, most recent first (the order `mastery()` sums in). */
  window: MasteryEntry[]
  /** The last finished problem of this type, any mode. */
  lastDoneAt: number | null
  everMastered: boolean
}

interface RunResult {
  awards: XpAward[]
  cards: Map<string, MistakeCardState>
  /** Problem type → when it was first mastered. */
  mastered: Map<string, number>
}

/**
 * Walk the log once. Events in [from, to) pay XP and move the mistake cards; every finished problem before `to`
 * moves the mastery windows (the compaction keeps the last five per type, so the window before a live event is there).
 * `start` holds the cards and first masteries folded from before `from`.
 */
function run(events: readonly Ev[], start: Pick<RewardsState, 'cards' | 'mastered'>, from: number, to: number): RunResult {
  const cancelled = cancelledSteps(events)
  const cards = new Map<string, MistakeCardState>()
  for (const [key, card] of Object.entries(start.cards)) cards.set(key, { ...card })
  const mastered = new Map<string, number>(Object.entries(start.mastered))
  const skills = new Map<string, SkillTrack>()
  const attempts = new Map<string, AttemptTrack>()
  const awards: XpAward[] = []

  function skillOf(skill: string): SkillTrack {
    let t = skills.get(skill)
    if (!t) {
      t = { window: [], lastDoneAt: null, everMastered: mastered.has(skill) }
      skills.set(skill, t)
    }
    return t
  }

  function attemptOf(id: string): AttemptTrack {
    let t = attempts.get(id)
    if (!t) {
      t = {
        namedAt: new Set(),
        namedSinceLine: false,
        pickedWrongAt: new Set(),
        part: { wrong: false, named: false },
        boxes: new Map(),
        anyWrong: false,
        anyNamed: false,
        revealPending: false,
      }
      attempts.set(id, t)
    }
    return t
  }

  /** A mastered type pays half until two weeks have passed since its last problem. */
  function halfAt(skill: string, at: number): boolean {
    const t = skills.get(skill)
    return t !== undefined && t.lastDoneAt !== null && at - t.lastDoneAt < REVIEW_AFTER_MS && windowMastered(t.window)
  }

  function pay(kind: AwardKind, base: number, e: { at: number; skill: string }, extra: Partial<XpAward>, half = false): void {
    awards.push({
      kind,
      xp: half ? Math.ceil(base / 2) : base,
      at: e.at,
      day: dayKey(e.at),
      skill: e.skill,
      ...extra,
      ...(half ? { half: true as const } : {}),
    })
  }

  function caught(pattern: string, skill: string, at: number, attemptId: string): void {
    const key = cardKey(pattern, skill)
    const card = cards.get(key)
    if (card) {
      card.count += 1
      card.lastAt = at
      card.lastAttempt = attemptId
      card.clean = 0
    } else {
      cards.set(key, { pattern, skill, count: 1, firstAt: at, lastAt: at, lastAttempt: attemptId, clean: 0 })
    }
  }

  function finished(e: Extract<Ev, { t: 'problem_done' }>, live: boolean): void {
    const t = skillOf(e.skill)
    if (live) {
      const half = halfAt(e.skill, e.at)
      pay('finish', XP.finish, e, { attemptId: e.attemptId }, half)
      if (e.hints === 0 && e.revealed === 0) pay('no_hints', XP.noHints, e, { attemptId: e.attemptId }, half)
      for (const card of cards.values()) {
        if (card.skill !== e.skill || card.clean >= SQUASH_AFTER || card.lastAttempt === e.attemptId) continue
        card.clean += 1
        if (card.clean >= SQUASH_AFTER && card.squashedAt === undefined) {
          card.squashedAt = e.at
          pay('squash', XP.squash, e, { attemptId: e.attemptId, pattern: card.pattern })
        }
      }
    }
    if (inMasteryWindow(e)) {
      const before = windowMastered(t.window)
      t.window.unshift({ firstTryRate: e.firstTryRate, revealed: e.revealed, finalCorrect: e.finalCorrect })
      if (t.window.length > MASTERY_WINDOW) t.window.pop()
      if (windowMastered(t.window) && !t.everMastered) {
        if (live && !before) pay('mastered', XP.mastered, e, { attemptId: e.attemptId })
        t.everMastered = true
        if (!mastered.has(e.skill)) mastered.set(e.skill, e.at)
      }
    }
    t.lastDoneAt = e.at
    attempts.delete(e.attemptId)
  }

  events.forEach((e, i) => {
    if (e.at >= to) return
    const live = e.at >= from
    if (e.t === 'problem_done') {
      finished(e, live)
      return
    }
    if (!live) return
    switch (e.t) {
      case 'step_rejected': {
        if (e.via === 'card') attemptOf(e.attemptId).pickedWrongAt.add(e.stepIdx)
        if (!e.pattern) break
        const t = attemptOf(e.attemptId)
        t.namedAt.add(e.stepIdx)
        t.namedSinceLine = true
        caught(e.pattern, e.skill, e.at, e.attemptId)
        break
      }
      case 'hint':
        if (e.rung === 3) attemptOf(e.attemptId).revealPending = true
        break
      case 'step_accepted': {
        const t = attemptOf(e.attemptId)
        const named = t.namedAt.has(e.stepIdx) || t.namedSinceLine
        t.namedSinceLine = false
        t.revealPending = false
        if (cancelled.has(i) || e.revealed) break
        const extra = { attemptId: e.attemptId, stepIdx: e.stepIdx }
        if (e.via === 'card') {
          // Picked: +4 when the first card she picked for this line was the right one, nothing after a wrong pick.
          if (!t.pickedWrongAt.has(e.stepIdx)) pay('line_picked', XP.picked, e, extra, halfAt(e.skill, e.at))
          break
        }
        if (e.firstTry) pay('line', XP.firstTry, e, extra, halfAt(e.skill, e.at))
        else if (named) pay('line_fixed', XP.fixed, e, extra, halfAt(e.skill, e.at))
        break
      }
      case 'final_answer': {
        const t = attemptOf(e.attemptId)
        if (!e.correct) {
          if (e.pattern) caught(e.pattern, e.skill, e.at, e.attemptId)
          if (e.part !== undefined) {
            const box = boxOf(t, e.part)
            box.wrong = true
            if (e.pattern) box.named = true
          } else {
            t.part.wrong = true
            t.anyWrong = true
            if (e.pattern) {
              t.part.named = true
              t.anyNamed = true
            }
          }
          break
        }
        const revealed = t.revealPending
        t.revealPending = false
        let wrong: boolean
        let named: boolean
        if (e.part !== undefined) {
          const box = boxOf(t, e.part)
          if (box.done) break // the same box right again on a later check
          box.done = true
          wrong = box.wrong || t.anyWrong
          named = box.named || t.anyNamed
        } else {
          wrong = t.part.wrong
          named = t.part.named
          t.part = { wrong: false, named: false }
        }
        if (revealed) break
        const extra = { attemptId: e.attemptId, ...(e.part !== undefined ? { part: e.part } : {}) }
        if (!wrong) pay('part', XP.firstTry, e, extra, halfAt(e.skill, e.at))
        else if (named) pay('part_fixed', XP.fixed, e, extra, halfAt(e.skill, e.at))
        break
      }
      case 'problem_abandoned':
        attempts.delete(e.attemptId)
        break
      case 'drill_answer':
        if (e.correct) pay('drill', XP.drill, e, {})
        break
      case 'step_undone':
        break
    }
  })
  return { awards, cards, mastered }
}

function boxOf(t: AttemptTrack, part: string): BoxTrack {
  let box = t.boxes.get(part)
  if (!box) {
    box = { wrong: false, named: false, done: false }
    t.boxes.set(part, box)
  }
  return box
}

/** Every award in the log after the folded part (in log order). */
export function xpAwards(events: readonly Ev[], rewards: RewardsState): XpAward[] {
  return run(events, rewards, rewards.foldedThrough, Number.POSITIVE_INFINITY).awards
}

function sumByDay(awards: readonly XpAward[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const a of awards) out.set(a.day, (out.get(a.day) ?? 0) + a.xp)
  return out
}

// ---------------------------------------------------------------------------
// Days, goal and streak
// ---------------------------------------------------------------------------

/** 0 the goal not met, 1 met, 2 twice the goal. */
export function levelOf(xp: number, goal: number): 0 | DayMark {
  return xp >= 2 * goal ? 2 : xp >= goal ? 1 : 0
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1)
}

/** The day `n` days after `day` ('YYYY-MM-DD', local). */
export function addDays(day: string, n: number): string {
  const d = parseDay(day)
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime())
}

function isMonday(day: string): boolean {
  return parseDay(day).getDay() === 1
}

/** How a day went: a settled day by the record alone, a later one by the record or its XP in the log. */
function dayLevel(rewards: RewardsState, dayXp: ReadonlyMap<string, number>, goal: number): (day: string) => 0 | DayMark {
  return (day) => {
    const mark = rewards.days[day] ?? 0
    if (rewards.settledThrough && day <= rewards.settledThrough) return mark
    const live = levelOf(dayXp.get(day) ?? 0, goal)
    return live > mark ? live : mark
  }
}

export type WeekDayState =
  /** She met her goal. */
  | 'met'
  /** A rest day from the bank kept the streak. */
  | 'rest'
  /** Missed, and mended by a double goal the next day. */
  | 'repaired'
  /** Not met (and nothing kept a streak). */
  | 'off'
  /** Today, not met yet. */
  | 'today'
  | 'future'

export interface StreakView {
  /** Days she met her goal in the current streak (today counts once it is met). 0 = no streak. */
  days: number
  /** Rest days saved (0 to 2): one more each week, used by themselves for a missed day. */
  restDays: number
  /** Yesterday was missed with no rest day left: twice the goal today keeps the streak. */
  repairToday: boolean
  /** Today's double goal mended yesterday. */
  repairedToday: boolean
  /** Days this week (Monday to today) on which she met her goal. */
  weekMet: number
  /** Monday to Sunday of this week. */
  week: { day: string; state: WeekDayState }[]
}

function streakOf(level: (day: string) => 0 | DayMark, first: string | null, today: string, now: number): StreakView {
  const states = new Map<string, WeekDayState>()
  let days = 0
  let bank = 0
  let pending: string | null = null
  let repairedToday = false
  if (first !== null && first <= today) {
    for (let d = first; d <= today; d = addDays(d, 1)) {
      if (d === first || isMonday(d)) bank = Math.min(MAX_REST_DAYS, bank + 1)
      const lv = level(d)
      const isToday = d === today
      if (pending !== null) {
        if (lv >= 2) {
          states.set(pending, 'repaired')
          states.set(d, 'met')
          pending = null
          days += 1
          if (isToday) repairedToday = true
        } else if (isToday) {
          // Today is not over: a double goal can still mend yesterday.
          states.set(d, lv >= 1 ? 'met' : 'today')
        } else {
          pending = null
          days = lv >= 1 ? 1 : 0
          states.set(d, lv >= 1 ? 'met' : 'off')
        }
        continue
      }
      if (lv >= 1) {
        days += 1
        states.set(d, 'met')
      } else if (isToday) {
        states.set(d, 'today')
      } else if (days > 0 && bank > 0) {
        bank -= 1
        states.set(d, 'rest')
      } else if (days > 0) {
        pending = d
        states.set(d, 'off')
      } else {
        states.set(d, 'off')
      }
    }
  }
  const monday = dayKey(startOfIsoWeek(now))
  const week: StreakView['week'] = []
  let weekMet = 0
  for (let i = 0; i < 7; i++) {
    const day = addDays(monday, i)
    if (day > today) {
      week.push({ day, state: 'future' })
      continue
    }
    if (level(day) >= 1) weekMet += 1
    week.push({ day, state: states.get(day) ?? (day === today ? 'today' : 'off') })
  }
  return { days, restDays: bank, repairToday: pending !== null, repairedToday, weekMet, week }
}

/** The first day she ever met her goal, from the record and the log. */
function firstMetDay(rewards: RewardsState, dayXp: ReadonlyMap<string, number>, level: (day: string) => 0 | DayMark): string | null {
  let first: string | null = null
  for (const day of [...Object.keys(rewards.days), ...dayXp.keys()]) {
    if (level(day) >= 1 && (first === null || day < first)) first = day
  }
  return first
}

export interface TodayView {
  day: string
  xp: number
  goal: number
  /** What today's ring counts to: the goal, or twice the goal while a missed day waits to be mended. */
  target: number
  met: boolean
  doubleMet: boolean
}

// ---------------------------------------------------------------------------
// Mistake cards
// ---------------------------------------------------------------------------

export interface MistakeCard extends MistakeCardState {
  key: string
  /** Squashed now: three clean finished problems of its type since she last made it. */
  squashed: boolean
}

function sortCards(cards: MistakeCard[]): MistakeCard[] {
  return cards.sort((a, b) => {
    if (a.squashed !== b.squashed) return a.squashed ? 1 : -1
    if (a.squashed) return (b.squashedAt ?? b.lastAt) - (a.squashedAt ?? a.lastAt) || a.key.localeCompare(b.key)
    return b.clean - a.clean || b.lastAt - a.lastAt || a.key.localeCompare(b.key)
  })
}

/** Her top open cards: closest to squashed first, then the most recent. */
export function openCards(cards: readonly MistakeCard[], n = 3): MistakeCard[] {
  return cards.filter((c) => !c.squashed).slice(0, n)
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

export interface RewardsView {
  goal: DailyGoal
  /** Every award after the folded part, in log order. */
  awards: XpAward[]
  /** XP per local day. */
  dayXp: ReadonlyMap<string, number>
  today: TodayView
  streak: StreakView
  /** Every mistake card: open ones first (closest to squashed, then most recent), then the squashed ones. */
  cards: MistakeCard[]
}

export function computeRewards(events: readonly Ev[], rewards: RewardsState, goal: DailyGoal, now = Date.now()): RewardsView {
  const r = run(events, rewards, rewards.foldedThrough, Number.POSITIVE_INFINITY)
  const dayXp = sumByDay(r.awards)
  const today = dayKey(now)
  const level = dayLevel(rewards, dayXp, goal)
  const streak = streakOf(level, firstMetDay(rewards, dayXp, level), today, now)
  const xp = dayXp.get(today) ?? 0
  const todayLevel = level(today)
  const cards: MistakeCard[] = [...r.cards.entries()].map(([key, c]) => ({ ...c, key, squashed: c.clean >= SQUASH_AFTER }))
  return {
    goal,
    awards: r.awards,
    dayXp,
    today: {
      day: today,
      xp,
      goal,
      target: streak.repairToday ? 2 * goal : goal,
      met: todayLevel >= 1,
      doubleMet: todayLevel >= 2,
    },
    streak,
    cards: sortCards(cards),
  }
}

// ---------------------------------------------------------------------------
// Keeping the slice (settle, fold, merge, normalize)
// ---------------------------------------------------------------------------

/**
 * Record the days in the log that met `goal` (the goal in effect), and settle every day before today: from then on
 * the record alone says how they went. Today stays live; its level so far is kept as a floor. Run before the goal
 * changes (raising it never undoes a day), before the compaction deletes events, and after an import.
 */
export function settleDays(rewards: RewardsState, events: readonly Ev[], goal: number, now = Date.now()): RewardsState {
  const today = dayKey(now)
  const yesterday = addDays(today, -1)
  const dayXp = sumByDay(xpAwards(events, rewards))
  let days: Record<string, DayMark> | null = null
  for (const [day, xp] of dayXp) {
    if (day > today || (rewards.settledThrough && day <= rewards.settledThrough)) continue
    const lv = levelOf(xp, goal)
    if (lv > (rewards.days[day] ?? 0)) {
      days ??= { ...rewards.days }
      days[day] = lv as DayMark
    }
  }
  const settledThrough = rewards.settledThrough > yesterday ? rewards.settledThrough : yesterday
  if (!days && settledThrough === rewards.settledThrough) return rewards
  return { ...rewards, days: days ?? rewards.days, settledThrough }
}

/**
 * Fold the events before `cutoff` (the ones the 60-day compaction is about to delete) into the cards and the first
 * masteries. Settle the days first (`settleDays`): the folded events stop paying XP.
 */
export function foldRewards(rewards: RewardsState, events: readonly Ev[], cutoff: number): RewardsState {
  if (cutoff <= rewards.foldedThrough) return rewards
  const r = run(events, rewards, rewards.foldedThrough, cutoff)
  return { ...rewards, foldedThrough: cutoff, cards: Object.fromEntries(r.cards), mastered: Object.fromEntries(r.mastered) }
}

function minDefined(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b
  if (b === undefined) return a
  return Math.min(a, b)
}

/**
 * Merge another device's slice into this one (a merge import). A day met on either device counts; the settled and
 * folded marks go back to the earlier of the two, so the merged log is read again from there (then settle). A card
 * known to both keeps the later state, the larger count and the first squash; a type keeps its first mastery.
 */
export function mergeRewards(a: RewardsState, b: RewardsState): RewardsState {
  const days: Record<string, DayMark> = { ...a.days }
  for (const [day, mark] of Object.entries(b.days)) if (mark > (days[day] ?? 0)) days[day] = mark
  const settledThrough = !a.settledThrough || !b.settledThrough ? '' : a.settledThrough < b.settledThrough ? a.settledThrough : b.settledThrough
  const cards: Record<string, MistakeCardState> = {}
  for (const [key, card] of Object.entries(a.cards)) cards[key] = { ...card }
  for (const [key, card] of Object.entries(b.cards)) {
    const mine = cards[key]
    if (!mine) {
      cards[key] = { ...card }
      continue
    }
    const later = card.lastAt > mine.lastAt ? card : mine
    const merged: MistakeCardState = { ...later, count: Math.max(mine.count, card.count), firstAt: Math.min(mine.firstAt, card.firstAt) }
    const squashedAt = minDefined(mine.squashedAt, card.squashedAt)
    if (squashedAt === undefined) delete merged.squashedAt
    else merged.squashedAt = squashedAt
    cards[key] = merged
  }
  const mastered: Record<string, number> = { ...a.mastered }
  for (const [skill, at] of Object.entries(b.mastered)) if (mastered[skill] === undefined || at < mastered[skill]!) mastered[skill] = at
  const merged: RewardsState = { days, settledThrough, foldedThrough: Math.min(a.foldedThrough, b.foldedThrough), cards, mastered }
  // A streak milestone celebrated on either device is not celebrated again.
  const milestones = mergeMilestones(a.milestones, b.milestones)
  if (milestones.length > 0) merged.milestones = milestones
  return merged
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function finite(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function normalizeCard(raw: unknown): MistakeCardState | null {
  if (!isRecord(raw)) return null
  const { pattern, skill, count, firstAt, lastAt, lastAttempt, clean, squashedAt } = raw
  if (typeof pattern !== 'string' || !pattern || typeof skill !== 'string' || !skill) return null
  if (!finite(count) || count < 1 || !finite(firstAt) || !finite(lastAt) || !finite(clean) || clean < 0) return null
  const card: MistakeCardState = {
    pattern,
    skill,
    count: Math.round(count),
    firstAt,
    lastAt,
    lastAttempt: typeof lastAttempt === 'string' ? lastAttempt : '',
    clean: Math.min(SQUASH_AFTER, Math.round(clean)),
  }
  if (finite(squashedAt)) card.squashedAt = squashedAt
  return card
}

/** The slice from storage or a backup: anything unreadable is dropped (an old backup has none: empty). */
export function normalizeRewards(raw: unknown): RewardsState {
  const out = emptyRewards()
  if (!isRecord(raw)) return out
  if (isRecord(raw.days)) {
    for (const [day, mark] of Object.entries(raw.days)) if (DAY_RE.test(day) && (mark === 1 || mark === 2)) out.days[day] = mark
  }
  if (typeof raw.settledThrough === 'string' && DAY_RE.test(raw.settledThrough)) out.settledThrough = raw.settledThrough
  if (finite(raw.foldedThrough) && raw.foldedThrough > 0) out.foldedThrough = raw.foldedThrough
  if (isRecord(raw.cards)) {
    for (const value of Object.values(raw.cards)) {
      const card = normalizeCard(value)
      if (card) out.cards[cardKey(card.pattern, card.skill)] = card
    }
  }
  if (isRecord(raw.mastered)) {
    for (const [skill, at] of Object.entries(raw.mastered)) if (skill && finite(at)) out.mastered[skill] = at
  }
  const milestones = normalizeMilestones(raw.milestones)
  if (milestones) out.milestones = milestones
  return out
}

// ---------------------------------------------------------------------------
// Problem-type rings
// ---------------------------------------------------------------------------

export type RingLevel = 'new' | 'practiced' | 'solid' | 'mastered'

export interface SkillRingInfo {
  level: RingLevel
  /** 0 to 1: a fifth for each of the last five problems that went well; full once mastered. */
  fill: number
  /** Of the last five finished problems (normal mode), how many went well: 80% of lines first try, nothing shown, the answer right. */
  strong: number
  /** Finished problems in the window (0 to 5). */
  count: number
}

function ringOf(window: readonly MasteryEntry[]): SkillRingInfo {
  const count = window.length
  if (count === 0) return { level: 'new', fill: 0, strong: 0, count: 0 }
  const strong = window.filter((e) => e.firstTryRate >= MASTERY_THRESHOLD && e.revealed === 0 && e.finalCorrect).length
  if (windowMastered(window)) return { level: 'mastered', fill: 1, strong, count }
  return { level: strong >= 3 ? 'solid' : 'practiced', fill: strong / MASTERY_WINDOW, strong, count }
}

/**
 * A ring per problem type from the last-five mastery rule: New (none finished), Practiced, Solid (three of the last
 * five went well), Mastered (the rule in selectors.ts).
 */
export function skillRings(events: readonly Ev[]): Map<string, SkillRingInfo> {
  const windows = new Map<string, MasteryEntry[]>()
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!
    if (!inMasteryWindow(e)) continue
    let w = windows.get(e.skill)
    if (!w) {
      w = []
      windows.set(e.skill, w)
    }
    if (w.length < MASTERY_WINDOW) w.push(e)
  }
  const out = new Map<string, SkillRingInfo>()
  for (const [skill, w] of windows) out.set(skill, ringOf(w))
  return out
}

export function skillRing(events: readonly Ev[], skill: string): SkillRingInfo {
  return skillRings(events).get(skill) ?? ringOf([])
}

// ---------------------------------------------------------------------------
// A finished problem
// ---------------------------------------------------------------------------

export interface FinishInfo {
  /** This attempt's awards, in order. */
  awards: XpAward[]
  total: number
  /** Some of it was paid at half (a mastered type, not due for review yet). */
  half: boolean
  /** This problem took today's XP to the goal. */
  goalMet: boolean
  /** ...to twice the goal, which mended yesterday. */
  repaired: boolean
  /** The type is newly mastered (+100). */
  mastered: boolean
  /** Pattern ids of the mistakes this problem squashed. */
  squashed: string[]
  /** Her first finished problem today after three or more days away. */
  comeback: boolean
  /** Some of its lines were picked from cards (Guided mode): it does not move the type's ring. */
  picked: boolean
}

/** What one finished attempt earned and what it set off. */
export function finishInfo(view: RewardsView, events: readonly Ev[], rewards: RewardsState, attemptId: string): FinishInfo {
  const awards = view.awards.filter((a) => a.attemptId === attemptId)
  const total = awards.reduce((s, a) => s + a.xp, 0)
  const gainedToday = awards.filter((a) => a.day === view.today.day).reduce((s, a) => s + a.xp, 0)
  const before = view.today.xp - gainedToday
  const goal = view.goal
  const done = events.find((e) => e.t === 'problem_done' && e.attemptId === attemptId)
  let comeback = false
  if (done && dayKey(done.at) === view.today.day) {
    const firstToday = !events.some((e) => e.t === 'problem_done' && e !== done && e.at <= done.at && dayKey(e.at) === view.today.day)
    if (firstToday) {
      let last: string | null = null
      for (const e of events) {
        const day = dayKey(e.at)
        if (day < view.today.day && (last === null || day > last)) last = day
      }
      for (const day of Object.keys(rewards.days)) if (day < view.today.day && (last === null || day > last)) last = day
      comeback = last !== null && daysBetweenKeys(last, view.today.day) - 1 >= COMEBACK_DAYS
    }
  }
  return {
    awards,
    total,
    half: awards.some((a) => a.half),
    goalMet: before < goal && view.today.xp >= goal,
    repaired: view.streak.repairedToday && before < 2 * goal && view.today.xp >= 2 * goal,
    mastered: awards.some((a) => a.kind === 'mastered'),
    squashed: awards.filter((a) => a.kind === 'squash').map((a) => a.pattern ?? ''),
    comeback,
    picked: done?.t === 'problem_done' && (done.picked ?? 0) > 0,
  }
}
