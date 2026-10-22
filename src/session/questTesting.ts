/**
 * Test helpers for the daily quests (session/quests.ts): seeded logs that make a day's quests doable or done. Not part of
 * the app bundle: only tests import this file.
 */
import { computeRewards } from '@/store/rewards'
import { emptyRewards, type DailyGoal, type Ev, type RewardsState } from '@/store/types'
import { dayStart, type QuestInput, type QuestSpec } from './quests'

/** The problem type the helpers work in (precalculus Unit 1). */
export const QS = 'ineq.linear'

/** At `minutes` past `hour` on a day ('YYYY-MM-DD'). */
export function dayTime(day: string, hour: number, minutes = 0): number {
  return dayStart(day) + hour * 3_600_000 + minutes * 60_000
}

export function line(attemptId: string, stepIdx: number, at: number, opts: { skill?: string; firstTry?: boolean; own?: boolean; via?: 'card' } = {}): Ev {
  return {
    t: 'step_accepted',
    at,
    attemptId,
    skill: opts.skill ?? QS,
    stepIdx,
    firstTry: opts.firstTry ?? true,
    revealed: false,
    property: 'skipped',
    ...(opts.via ? { via: opts.via } : {}),
    ...(opts.own ? { own: true as const } : {}),
  }
}

export function finished(attemptId: string, at: number, opts: Partial<Extract<Ev, { t: 'problem_done' }>> = {}): Ev {
  return {
    t: 'problem_done',
    at,
    attemptId,
    skill: QS,
    moduleId: 'inequalities',
    steps: 4,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 60,
    ...opts,
  }
}

/** A named mistake in the helpers' type: its card is open until three clean problems squash it. */
export function mistake(attemptId: string, at: number, skill = QS): Ev {
  return { t: 'step_rejected', at, attemptId, skill, stepIdx: 0, pattern: 'no_sign_flip' }
}

/** A problem with `lines` lines right on the first try, then finished. */
export function cleanProblem(attemptId: string, at: number, lines = 4, opts: { skill?: string; own?: boolean; moduleId?: string } = {}): Ev[] {
  const out: Ev[] = []
  for (let i = 0; i < lines; i++) out.push(line(attemptId, i, at + i * 1000, { skill: opts.skill, own: opts.own }))
  out.push(finished(attemptId, at + lines * 1000, { steps: lines, skill: opts.skill ?? QS, ...(opts.moduleId ? { moduleId: opts.moduleId } : {}), ...(opts.own ? { own: true } : {}) }))
  return out
}

/** The day before `day`: a mistake in the helpers' type, so a monster is on the loose when `day` begins. */
export function openCardBefore(day: string): Ev[] {
  return [mistake('c0', dayStart(day) - 3 * 3_600_000)]
}

/**
 * A day that does every quest it could have: a clean set of three problems of the helpers' type (no hints, all right
 * first time, squashing the card from `openCardBefore`), a problem of the path's stop, and a problem of her own.
 */
export function busyDay(day: string, specs: readonly QuestSpec[], setId = 'set-busy'): Ev[] {
  const out: Ev[] = []
  const ids = ['q1', 'q2', 'q3']
  ids.forEach((id, i) => out.push(...cleanProblem(`${id}-${day}`, dayTime(day, 9, i * 10))))
  out.push({ t: 'set_done', at: dayTime(day, 9, 40), setId, done: ids.map((id) => `${id}-${day}`), skipped: 0 })
  const path = specs.find((s) => s.kind === 'pathStop')?.skill
  if (path) out.push(...cleanProblem(`path-${day}`, dayTime(day, 10), 1, { skill: path }))
  out.push(...cleanProblem(`own-${day}`, dayTime(day, 11), 1, { own: true }))
  return out
}

/** The quests' input for a log (awards from the rewards, as the app reads them). */
export function questInput(events: readonly Ev[], goal: DailyGoal = 60, opts: { courseId?: string; rewards?: RewardsState } = {}): QuestInput {
  const rewards = opts.rewards ?? emptyRewards()
  return { events, rewards, awards: computeRewards(events, rewards, goal).awards, goal, courseId: opts.courseId ?? 'precalc' }
}
