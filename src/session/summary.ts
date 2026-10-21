/**
 * What a finished set says: each problem (right first time, caught and fixed N mistakes, or skipped) and, with
 * rewards on, the XP the set's attempts earned (their awards from store/rewards.ts: no XP rules of its own), the
 * problem-type rings that moved and the mistakes squashed. Pure.
 */
import { generateProblem, getTemplate, hasModule } from '@/content'
import { isFirstTryRight, slotEvents } from '@/pages/review/session'
import { knobsFromFlags } from '@/problem/url'
import type { ModuleId } from '@/shared/types'
import { skillRing, type SkillRingInfo, type XpAward } from '@/store/rewards'
import { dayKey } from '@/store/time'
import type { Ev } from '@/store/types'
import type { ActiveSet } from './activeSet'

export type SetOutcome =
  /** Skipped: it counts as skipped, not as wrong. */
  | { kind: 'skipped' }
  /** Finished with the answer right, every line right on the first try, nothing shown. */
  | { kind: 'firstTry' }
  /** Finished after the checker caught `mistakes` wrong lines or answers. */
  | { kind: 'fixed'; mistakes: number }
  /** Finished, with a step or the answer shown and no mistake caught. */
  | { kind: 'shown' }
  /** Finished with no mistake caught, with `lines` lines picked from cards (Guided mode). */
  | { kind: 'picked'; lines: number }
  /** Finished, but its record is not in the log any more. */
  | { kind: 'finished' }
  /** Neither finished nor skipped. */
  | { kind: 'open' }

export interface SetLine {
  index: number
  moduleId: string
  templateId: string
  /** The problem's own title, as its screen showed it. */
  title: string
  /** The problem type's title (the one the rings and the mistake cards use). */
  typeTitle: string
  outcome: SetOutcome
}

function typeTitleOf(moduleId: string, templateId: string): string {
  if (!hasModule(moduleId)) return templateId
  try {
    return getTemplate(moduleId as ModuleId, templateId).title
  } catch {
    return templateId
  }
}

function problemTitleOf(set: ActiveSet, index: number, fallback: string): string {
  const p = set.problems[index]!
  if (!hasModule(p.moduleId)) return fallback
  try {
    return generateProblem(p.moduleId as ModuleId, p.templateId, p.seed, knobsFromFlags(p.flags)).title
  } catch {
    return fallback
  }
}

function outcomeOf(set: ActiveSet, index: number, events: readonly Ev[]): SetOutcome {
  const status = set.status[index]
  if (status === 'skipped') return { kind: 'skipped' }
  const slot = slotEvents(events, set.attemptIds[index] ?? null)
  const finished = slot.some((e) => e.t === 'problem_done')
  if (!finished) return status === 'done' ? { kind: 'finished' } : { kind: 'open' }
  if (isFirstTryRight(slot)) return { kind: 'firstTry' }
  const mistakes = slot.filter((e) => e.t === 'step_rejected' || (e.t === 'final_answer' && !e.correct)).length
  if (mistakes > 0) return { kind: 'fixed', mistakes }
  // Picked lines are not "right first time" (Guided mode): she chose them from cards.
  const done = slot.find((e) => e.t === 'problem_done')
  const picked = done?.t === 'problem_done' ? (done.picked ?? 0) : 0
  return picked > 0 ? { kind: 'picked', lines: picked } : { kind: 'shown' }
}

/** Each problem of the set, in the set's order. */
export function summarizeSet(set: ActiveSet, events: readonly Ev[]): SetLine[] {
  return set.problems.map((p, index) => {
    const typeTitle = typeTitleOf(p.moduleId, p.templateId)
    return { index, moduleId: p.moduleId, templateId: p.templateId, title: problemTitleOf(set, index, typeTitle), typeTitle, outcome: outcomeOf(set, index, events) }
  })
}

/** "Right first time", "Caught and fixed 2 mistakes", "Skipped". */
export function outcomeWords(outcome: SetOutcome): string {
  switch (outcome.kind) {
    case 'skipped':
      return 'Skipped'
    case 'firstTry':
      return 'Right first time'
    case 'fixed':
      return outcome.mistakes === 1 ? 'Caught and fixed 1 mistake' : `Caught and fixed ${outcome.mistakes} mistakes`
    case 'shown':
      return 'Finished, with a step shown'
    case 'picked':
      return outcome.lines === 1 ? 'Finished, with a line picked' : `Finished, with ${outcome.lines} lines picked`
    case 'finished':
      return 'Finished'
    case 'open':
      return 'Not finished'
  }
}

export interface SetRing {
  skill: string
  title: string
  before: SkillRingInfo
  after: SkillRingInfo
}

export interface SetRewards {
  /** The sum of the awards of the set's attempts (a problem she skipped keeps what its lines earned). */
  xp: number
  /** The part of `xp` earned today (where today's goal ring sweeps from: today's XP without it). */
  xpToday: number
  /** The problem types whose ring moved with this set: before the set and now. */
  rings: SetRing[]
  /** The mistakes this set squashed: pattern and problem type. */
  squashed: { pattern: string; skill: string }[]
}

/** The set's rewards from the awards of the whole log (`RewardsView.awards`); `today` is the local day ('YYYY-MM-DD'). */
export function setRewards(set: ActiveSet, events: readonly Ev[], awards: readonly XpAward[], today = dayKey(Date.now())): SetRewards {
  const ids = new Set(set.attemptIds.filter((id): id is string => id !== null))
  const mine = awards.filter((a) => a.attemptId !== undefined && ids.has(a.attemptId))
  const xp = mine.reduce((sum, a) => sum + a.xp, 0)
  const xpToday = mine.filter((a) => a.day === today).reduce((sum, a) => sum + a.xp, 0)
  const squashed = mine.filter((a) => a.kind === 'squash').map((a) => ({ pattern: a.pattern ?? '', skill: a.skill }))
  const before = events.filter((e) => !(e.t === 'problem_done' && ids.has(e.attemptId)))
  const rings: SetRing[] = []
  set.problems.forEach((p, i) => {
    if (set.status[i] !== 'done' || rings.some((r) => r.skill === p.templateId)) return
    const was = skillRing(before, p.templateId)
    const now = skillRing(events, p.templateId)
    if (was.level !== now.level || was.fill !== now.fill) rings.push({ skill: p.templateId, title: typeTitleOf(p.moduleId, p.templateId), before: was, after: now })
  })
  return { xp, xpToday, rings, squashed }
}
