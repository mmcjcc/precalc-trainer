/**
 * One review set on this device: `pct.review.<id>`. The event log still records the problems;
 * this only remembers which attempts belonged to the set, plus where she is in it.
 */
import { getReview, getTemplate, hasModule, randomSeed, resolveReview, SAT_DOMAINS, type SatDomainId } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { useStore } from '@/store'
import type { Ev } from '@/store/types'
import { safeRead, safeRemove, safeWrite } from '@/store/storage'
import { buildReviewSet } from './buildReview'

export interface ReviewProblem {
  topicId: string
  moduleId: string
  templateId: string
  seed: number
}

export type ReviewSlotStatus = 'pending' | 'done' | 'skipped'

export interface ReviewSession {
  version: 1
  reviewId: string
  seed: number
  /** Always `problems.length`. */
  count: number
  timed: boolean
  /** The test-mode setting before the set started; put back when the set ends. */
  testModeBefore?: boolean
  /** Optional elapsed seconds for the set timer. */
  elapsedSecs?: number
  problems: ReviewProblem[]
  /** `problems.length` means the summary. */
  index: number
  attemptIds: (string | null)[]
  status: ReviewSlotStatus[]
}

const STATUSES = new Set<ReviewSlotStatus>(['pending', 'done', 'skipped'])

export const SAT_FULL_MODULE_COUNT = 22
export const SAT_FULL_MODULE_MINUTES = 35

/** Target minutes for a SAT practice set: 35 minutes for 22 problems, scaled proportionally for fewer. */
export function satTimerMinutes(count: number): number {
  return Math.max(1, Math.round((SAT_FULL_MODULE_MINUTES * count) / SAT_FULL_MODULE_COUNT))
}

export function satTimerSeconds(count: number): number {
  return satTimerMinutes(count) * 60
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  if (safe < 60) return `${safe}s`
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`
}

export function reviewStorageKey(reviewId: string): string {
  return `pct.review.${reviewId}`
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isSession(v: unknown): v is ReviewSession {
  if (!isObj(v)) return false
  if (v.version !== 1 || typeof v.reviewId !== 'string' || typeof v.timed !== 'boolean') return false
  if (typeof v.seed !== 'number' || typeof v.count !== 'number' || typeof v.index !== 'number') return false
  if (v.testModeBefore !== undefined && typeof v.testModeBefore !== 'boolean') return false
  if (v.elapsedSecs !== undefined && (typeof v.elapsedSecs !== 'number' || !Number.isFinite(v.elapsedSecs) || v.elapsedSecs < 0)) {
    return false
  }
  if (!Array.isArray(v.problems) || !Array.isArray(v.attemptIds) || !Array.isArray(v.status)) return false
  if (v.problems.length === 0 || v.count !== v.problems.length) return false
  if (v.attemptIds.length !== v.problems.length || v.status.length !== v.problems.length) return false
  if (!Number.isInteger(v.index) || v.index < 0 || v.index > v.problems.length) return false
  for (let i = 0; i < v.problems.length; i++) {
    const p = v.problems[i]
    if (!isObj(p)) return false
    if (typeof p.topicId !== 'string' || typeof p.moduleId !== 'string' || typeof p.templateId !== 'string') return false
    if (typeof p.seed !== 'number' || !Number.isFinite(p.seed)) return false
    const id = v.attemptIds[i]
    if (id !== null && typeof id !== 'string') return false
    const status = v.status[i]
    if (typeof status !== 'string' || !STATUSES.has(status as ReviewSlotStatus)) return false
  }
  return true
}

/** A saved set can outlive a template that was renamed or removed; the problem view would send her home. */
function templatesExist(session: ReviewSession): boolean {
  return session.problems.every((p) => {
    if (!hasModule(p.moduleId)) return false
    try {
      getTemplate(p.moduleId, p.templateId)
      return true
    } catch {
      return false
    }
  })
}

export function loadReview(reviewId: string): ReviewSession | null {
  const raw = safeRead<unknown>(reviewStorageKey(reviewId))
  if (!isSession(raw) || raw.reviewId !== reviewId) return null
  if (!templatesExist(raw)) return null
  return raw
}

export function saveReview(session: ReviewSession): boolean {
  return safeWrite(reviewStorageKey(session.reviewId), session)
}

export function clearReview(reviewId: string): void {
  safeRemove(reviewStorageKey(reviewId))
}

export function createReviewSession(
  reviewId: string,
  opts: { count: number; timed: boolean; testModeBefore?: boolean },
): ReviewSession {
  const seed = randomSeed()
  const built = buildReviewSet(reviewId, { seed, count: opts.count, events: useStore.getState().events })
  return {
    version: 1,
    reviewId,
    seed: built.seed,
    count: built.problems.length,
    timed: opts.timed,
    testModeBefore: opts.testModeBefore,
    elapsedSecs: 0,
    problems: built.problems,
    index: 0,
    attemptIds: built.problems.map(() => null),
    status: built.problems.map(() => 'pending'),
  }
}

export function noteAttempt(session: ReviewSession, index: number, attemptId: string): ReviewSession {
  if (session.attemptIds[index] === attemptId) return session
  const attemptIds = session.attemptIds.slice()
  attemptIds[index] = attemptId
  return { ...session, attemptIds }
}

/** Move to the next slot, recording how this one ended. */
export function advanceReview(session: ReviewSession, outcome: 'done' | 'skipped'): ReviewSession {
  if (session.index >= session.problems.length) return session
  const status = session.status.slice()
  status[session.index] = outcome
  return { ...session, status, index: session.index + 1 }
}

export interface TopicSummaryLine {
  topicId: string
  moduleId: string
  title: string
  finished: number
  firstTryRight: number
  skipped: number
  /** Engine catalog titles, first time each pattern showed up in this topic. */
  mistakes: string[]
  /** A named mistake, a rejection, or a final answer that was not right. */
  practice: boolean
}

function catalogTitle(id: string): string {
  return id in ERROR_PATTERNS ? ERROR_PATTERNS[id as ErrorPatternId].title : id.replace(/_/g, ' ')
}

/** One attempt's events (none without an attempt). The set summary (session/summary.ts) reads them too. */
export function slotEvents(events: readonly Ev[], attemptId: string | null): Ev[] {
  if (!attemptId) return []
  return events.filter((e) => 'attemptId' in e && e.attemptId === attemptId)
}

/** Finished with the answer right, every line right on the first try, nothing revealed, no line picked from cards. */
export function isFirstTryRight(slot: readonly Ev[]): boolean {
  const done = slot.find((e) => e.t === 'problem_done')
  return done?.t === 'problem_done' && done.finalCorrect && done.firstTryRate === 1 && done.revealed === 0 && !done.picked
}

/** Per topic, in the review's own order. Topics that were not in this set are left out. */
export function summarizeReview(session: ReviewSession, events: Ev[]): TopicSummaryLine[] {
  const review = getReview(session.reviewId)
  const topics = review ? resolveReview(review) : []
  const lines: TopicSummaryLine[] = []
  for (const topic of topics) {
    const slots = session.problems
      .map((problem, index) => ({ problem, index }))
      .filter((s) => s.problem.topicId === topic.id)
    if (slots.length === 0) continue
    let finished = 0
    let firstTryRight = 0
    let skipped = 0
    let practice = false
    const seen = new Set<string>()
    const mistakes: string[] = []
    for (const slot of slots) {
      if (session.status[slot.index] === 'skipped') skipped += 1
      const ev = slotEvents(events, session.attemptIds[slot.index] ?? null)
      if (session.status[slot.index] === 'done') {
        finished += 1
        if (isFirstTryRight(ev)) firstTryRight += 1
      }
      for (const e of ev) {
        if (e.t === 'step_rejected' || (e.t === 'final_answer' && !e.correct)) practice = true
        if (e.t === 'problem_done' && !e.finalCorrect) practice = true
        if ((e.t === 'step_rejected' || e.t === 'final_answer') && e.pattern && !seen.has(e.pattern)) {
          seen.add(e.pattern)
          mistakes.push(catalogTitle(e.pattern))
        }
      }
    }
    if (mistakes.length > 0) practice = true
    lines.push({
      topicId: topic.id,
      moduleId: topic.moduleId,
      title: topic.title,
      finished,
      firstTryRight,
      skipped,
      mistakes,
      practice,
    })
  }
  return lines
}

export interface DomainSummaryLine {
  domainId: SatDomainId
  reviewId: string
  title: string
  problems: number
  finished: number
  firstTryRight: number
  /** First-try rate across finished problems in this domain (0 when none finished). */
  firstTryRate: number
  skipped: number
  /** Seconds spent across this domain's problems. */
  secs: number
  mistakes: string[]
}

function slotDomainId(reviewId: string, topicId: string, topicDomainMap: Map<string, SatDomainId>): SatDomainId | null {
  const mapped = topicDomainMap.get(topicId)
  if (mapped) return mapped
  const prefix = topicId.split(':')[0] as SatDomainId
  if (SAT_DOMAINS.some((d) => d.id === prefix)) return prefix
  const byReview = SAT_DOMAINS.find((d) => d.reviewId === reviewId)
  return byReview?.id ?? null
}

/**
 * Per-domain results for a SAT review set, in College Board domain order:
 * problems, first-try rate, and time spent per domain.
 */
export function summarizeSatDomains(session: ReviewSession, events: readonly Ev[]): DomainSummaryLine[] {
  const review = getReview(session.reviewId)
  const topics = review ? resolveReview(review) : []
  const topicDomainMap = new Map<string, SatDomainId>()
  for (const t of topics) {
    if (t.domainId) topicDomainMap.set(t.id, t.domainId)
  }

  const lines: DomainSummaryLine[] = []
  for (const domain of SAT_DOMAINS) {
    const slots = session.problems
      .map((problem, index) => ({ problem, index }))
      .filter((s) => slotDomainId(session.reviewId, s.problem.topicId, topicDomainMap) === domain.id)
    if (slots.length === 0) continue

    let finished = 0
    let firstTryRight = 0
    let skipped = 0
    let secs = 0
    const seen = new Set<string>()
    const mistakes: string[] = []

    for (const slot of slots) {
      if (session.status[slot.index] === 'skipped') skipped += 1
      const ev = slotEvents(events, session.attemptIds[slot.index] ?? null)
      if (session.status[slot.index] === 'done') {
        finished += 1
        if (isFirstTryRight(ev)) firstTryRight += 1
      }
      for (const e of ev) {
        if (e.t === 'problem_done' && Number.isFinite(e.secs)) {
          secs += Math.max(0, e.secs)
        }
        if ((e.t === 'step_rejected' || e.t === 'final_answer') && e.pattern && !seen.has(e.pattern)) {
          seen.add(e.pattern)
          mistakes.push(catalogTitle(e.pattern))
        }
      }
    }

    const firstTryRate = finished > 0 ? firstTryRight / finished : 0
    lines.push({
      domainId: domain.id,
      reviewId: domain.reviewId,
      title: domain.title,
      problems: slots.length,
      finished,
      firstTryRight,
      firstTryRate,
      skipped,
      secs,
      mistakes,
    })
  }
  return lines
}

/**
 * Weakest domain from a SAT practice set: lowest first-try share across the domain's problems,
 * breaking ties by lower finished first-try rate, more missed/skipped problems, and slower average time.
 */
export function weakestSatDomain(lines: readonly DomainSummaryLine[]): DomainSummaryLine | null {
  if (lines.length === 0) return null
  let weakest = lines[0]!
  for (let i = 1; i < lines.length; i++) {
    const cand = lines[i]!
    const wAcc = weakest.firstTryRight / Math.max(1, weakest.problems)
    const cAcc = cand.firstTryRight / Math.max(1, cand.problems)
    if (cAcc < wAcc - 1e-9) {
      weakest = cand
      continue
    }
    if (Math.abs(cAcc - wAcc) <= 1e-9) {
      if (cand.firstTryRate < weakest.firstTryRate - 1e-9) {
        weakest = cand
        continue
      }
      const wMissed = weakest.problems - weakest.firstTryRight
      const cMissed = cand.problems - cand.firstTryRight
      if (cMissed > wMissed) {
        weakest = cand
        continue
      }
      if (cMissed === wMissed) {
        const wAvgTime = weakest.secs / Math.max(1, weakest.finished || weakest.problems)
        const cAvgTime = cand.secs / Math.max(1, cand.finished || cand.problems)
        if (cAvgTime > wAvgTime + 1e-9) {
          weakest = cand
        }
      }
    }
  }
  return weakest
}
