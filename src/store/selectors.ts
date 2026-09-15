/**
 * Derived views over the event log + weekly counters. Pure functions; hooks in ./index.ts wrap
 * them with useMemo. Definitions: docs/research/ux-mobile-progress.md "Derived selectors".
 */
import { MASTERY_WINDOW, cancelledSteps } from './compaction'
import { dayKey, daysBetweenKeys, startOfIsoWeek } from './time'
import type { Ev, Streak, Weekly, WeeklySkill } from './types'

export interface MasteryInfo {
  /** Mean first-try step rate over the window (0..1) or null when never completed. */
  rate: number | null
  /** Window full (5), rate ≥ 0.8, no revealed steps, every final answer right. */
  mastered: boolean
  /** Completed attempts in the window (0..5). */
  count: number
  /** Epoch ms of the most recent event for this skill (any type), or null. */
  lastAt: number | null
  window: number
}

export const MASTERY_THRESHOLD = 0.8

function skillBuckets(weekly: Weekly, skill?: string): WeeklySkill[] {
  const out: WeeklySkill[] = []
  for (const skills of Object.values(weekly)) {
    for (const [k, w] of Object.entries(skills)) if (!skill || k === skill) out.push(w)
  }
  return out
}

export function mastery(events: Ev[], skill: string): MasteryInfo {
  const done: Extract<Ev, { t: 'problem_done' }>[] = []
  let lastAt: number | null = null
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i]!
    if (!('skill' in e) || e.skill !== skill) continue
    if (lastAt === null || e.at > lastAt) lastAt = e.at
    if (e.t === 'problem_done' && e.mode === 'normal' && done.length < MASTERY_WINDOW) done.push(e)
  }
  if (done.length === 0) return { rate: null, mastered: false, count: 0, lastAt, window: MASTERY_WINDOW }
  const rate = done.reduce((s, e) => s + e.firstTryRate, 0) / done.length
  const mastered =
    done.length >= MASTERY_WINDOW &&
    rate >= MASTERY_THRESHOLD &&
    done.every((e) => e.revealed === 0 && e.finalCorrect)
  return { rate, mastered, count: done.length, lastAt, window: MASTERY_WINDOW }
}

export interface ModuleMastery {
  /** Mean of family rates that have data, or null. */
  rate: number | null
  masteredCount: number
  practicedCount: number
  total: number
  /** Every family mastered (never a lock — a state). */
  complete: boolean
  lastAt: number | null
}

export function moduleMastery(events: Ev[], skills: string[]): ModuleMastery {
  const infos = skills.map((s) => mastery(events, s))
  const withData = infos.filter((m) => m.rate !== null)
  const rate = withData.length ? withData.reduce((s, m) => s + (m.rate ?? 0), 0) / withData.length : null
  const lastAt = infos.reduce<number | null>((acc, m) => (m.lastAt !== null && (acc === null || m.lastAt > acc) ? m.lastAt : acc), null)
  const masteredCount = infos.filter((m) => m.mastered).length
  return {
    rate,
    masteredCount,
    practicedCount: withData.length,
    total: skills.length,
    complete: skills.length > 0 && masteredCount === skills.length,
    lastAt,
  }
}

export interface RatioInfo {
  numerator: number
  denominator: number
  /** null when the denominator is 0. */
  rate: number | null
}

function ratio(numerator: number, denominator: number): RatioInfo {
  return { numerator, denominator, rate: denominator > 0 ? numerator / denominator : null }
}

/** hints ÷ accepted steps (events + weekly), optionally for one skill. */
export function hintRate(events: Ev[], weekly: Weekly, skill?: string): RatioInfo {
  let hints = 0
  let steps = 0
  const cancelled = cancelledSteps(events)
  events.forEach((e, i) => {
    if (skill && 'skill' in e && e.skill !== skill) return
    if (e.t === 'hint') hints += 1
    else if (e.t === 'step_accepted' && !cancelled.has(i)) steps += 1
  })
  for (const w of skillBuckets(weekly, skill)) {
    hints += w.hints
    steps += w.steps
  }
  return ratio(hints, steps)
}

/** first-try accepted steps ÷ accepted steps. */
export function firstTryRate(events: Ev[], weekly: Weekly, skill?: string): RatioInfo {
  let first = 0
  let steps = 0
  const cancelled = cancelledSteps(events)
  events.forEach((e, i) => {
    if (e.t !== 'step_accepted' || (skill && e.skill !== skill) || cancelled.has(i)) return
    steps += 1
    if (e.firstTry) first += 1
  })
  for (const w of skillBuckets(weekly, skill)) {
    first += w.firstTry
    steps += w.steps
  }
  return ratio(first, steps)
}

/** property chips answered correctly ÷ answered (skipped/off never count). */
export function propertyAccuracy(events: Ev[], weekly: Weekly, skill?: string): RatioInfo {
  let correct = 0
  let answered = 0
  const cancelled = cancelledSteps(events)
  events.forEach((e, i) => {
    if (e.t !== 'step_accepted' || (skill && e.skill !== skill) || cancelled.has(i)) return
    if (e.property === 'correct' || e.property === 'wrong') answered += 1
    if (e.property === 'correct') correct += 1
  })
  for (const w of skillBuckets(weekly, skill)) {
    correct += w.propCorrect
    answered += w.propAnswered
  }
  return ratio(correct, answered)
}

/** Drill accuracy (which-property + legal-or-illegal), optionally by kind. */
export function drillAccuracy(events: Ev[], weekly: Weekly, kind?: 'property' | 'legal'): RatioInfo {
  let correct = 0
  let answered = 0
  for (const e of events) {
    if (e.t !== 'drill_answer' || (kind && e.kind !== kind)) continue
    answered += 1
    if (e.correct) correct += 1
  }
  if (!kind) {
    for (const w of skillBuckets(weekly)) {
      correct += w.drillCorrect
      answered += w.drillAnswered
    }
  }
  return ratio(correct, answered)
}

export interface PatternCount {
  pattern: string
  thisWeek: number
  before: number
}

/**
 * Error-pattern counts from `step_rejected` / `final_answer` events with a `pattern`, split into the
 * current ISO week vs everything before (events + all weekly buckets). Sorted by thisWeek desc,
 * then before desc.
 */
export function patternCounts(events: Ev[], weekly: Weekly, now = Date.now()): PatternCount[] {
  const weekStart = startOfIsoWeek(now)
  const map = new Map<string, PatternCount>()
  const get = (p: string): PatternCount => {
    let c = map.get(p)
    if (!c) {
      c = { pattern: p, thisWeek: 0, before: 0 }
      map.set(p, c)
    }
    return c
  }
  for (const e of events) {
    if ((e.t !== 'step_rejected' && e.t !== 'final_answer') || !e.pattern) continue
    const c = get(e.pattern)
    if (e.at >= weekStart) c.thisWeek += 1
    else c.before += 1
  }
  for (const w of skillBuckets(weekly)) {
    for (const [p, n] of Object.entries(w.patterns)) get(p).before += n
  }
  return [...map.values()].sort((a, b) => b.thisWeek - a.thisWeek || b.before - a.before || a.pattern.localeCompare(b.pattern))
}

export interface Habits {
  done: number
  abandoned: number
  /** Total foreground seconds across completed problems (events only). */
  secs: number
}

export function habits(events: Ev[], weekly: Weekly): Habits {
  let done = 0
  let abandoned = 0
  let secs = 0
  for (const e of events) {
    if (e.t === 'problem_done') {
      done += 1
      secs += e.secs
    } else if (e.t === 'problem_abandoned') abandoned += 1
  }
  for (const w of skillBuckets(weekly)) {
    done += w.done
    abandoned += w.abandoned
  }
  return { done, abandoned, secs }
}

/** Skills that appear anywhere in events or weekly (for the progress table). */
export function knownSkills(events: Ev[], weekly: Weekly): string[] {
  const set = new Set<string>()
  for (const e of events) if ('skill' in e) set.add(e.skill)
  for (const skills of Object.values(weekly)) for (const k of Object.keys(skills)) set.add(k)
  return [...set].sort()
}

// ---------------------------------------------------------------------------
// Streak (a number, never a warning)
// ---------------------------------------------------------------------------

/** New streak after completing a problem on `today` ('YYYY-MM-DD'). */
export function bumpStreak(streak: Streak, today: string): Streak {
  if (streak.lastDay === today) return streak
  if (streak.lastDay && daysBetweenKeys(streak.lastDay, today) === 1) return { lastDay: today, count: streak.count + 1 }
  return { lastDay: today, count: 1 }
}

/** Streak as shown: still alive if the last completed day is today or yesterday, else 0. */
export function currentStreak(streak: Streak, now = Date.now()): number {
  if (!streak.lastDay) return 0
  const gap = daysBetweenKeys(streak.lastDay, dayKey(now))
  return gap <= 1 ? streak.count : 0
}

// ---------------------------------------------------------------------------
// Weak-spot sampling
// ---------------------------------------------------------------------------

export interface WeightedSkill {
  skill: string
  weight: number
  info: MasteryInfo
}

/** Weight = 1 − rate (never below 0.05); never-practiced families get 0.6; mastered ones 0.05. */
export function weakSpotWeights(events: Ev[], skills: string[]): WeightedSkill[] {
  return skills.map((skill) => {
    const info = mastery(events, skill)
    let weight: number
    if (info.rate === null) weight = 0.6
    else if (info.mastered) weight = 0.05
    else weight = Math.max(0.05, 1 - info.rate)
    return { skill, weight, info }
  })
}

/** Pick one skill by weight using a unit random `u` in [0,1). */
export function pickWeakSpot(weights: WeightedSkill[], u: number): string | null {
  const total = weights.reduce((s, w) => s + w.weight, 0)
  if (total <= 0) return null
  let r = Math.min(Math.max(u, 0), 0.999999) * total
  for (const w of weights) {
    r -= w.weight
    if (r < 0) return w.skill
  }
  return weights[weights.length - 1]?.skill ?? null
}
