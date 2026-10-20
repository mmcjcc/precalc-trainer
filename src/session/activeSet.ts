/**
 * The active set on this device: one at a time, in `pct.set`. Versioned and checked on read like the unit review's
 * session (pages/review/session.ts): anything unreadable, an older version, or a set naming a problem type that no
 * longer exists is ignored. The event log still records every problem; this only remembers which attempts belong
 * to the set and where she is in it. Pure, apart from the three storage calls.
 *
 * A slot is pending (her problem now), done (finished) or skipped. `index` is the slot she is on; it stays on a
 * finished slot until she taps "Next in set", and on the last slot until she taps "See results" (the set's one
 * break, session/breaks.ts), which makes it `problems.length`: the results.
 */
import { getTemplate, hasModule } from '@/content'
import { seedToBase36 } from '@/content/rng'
import type { ModuleId } from '@/shared/types'
import { safeRead, safeRemove, safeWrite } from '@/store/storage'
import type { Attempt } from '@/store/types'
import { SET_PICKS, type BuiltSet, type SetProblem } from './buildSet'

export type SetSlotStatus = 'pending' | 'done' | 'skipped'

export interface ActiveSet {
  version: 1
  /** Unique per set. */
  id: string
  /** The class it was built from ("Another set" builds from it again). */
  courseId: string
  startedAt: number
  /** Test mode was on when the set started (what the break at the end is told). */
  timed: boolean
  problems: SetProblem[]
  /** The slot she is on; `problems.length` once she has seen the results. */
  index: number
  /** Each slot's attempt, once she has opened its problem. */
  attemptIds: (string | null)[]
  status: SetSlotStatus[]
}

export const SET_STORAGE_KEY = 'pct.set'

/** More than this is not a set this app built. */
const MAX_PROBLEMS = 20
const STATUSES = new Set<SetSlotStatus>(['pending', 'done', 'skipped'])
const FLAGS_RE = /^[fnse123]*$/

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isProblem(v: unknown): v is SetProblem {
  if (!isObj(v)) return false
  if (typeof v.moduleId !== 'string' || typeof v.templateId !== 'string') return false
  if (typeof v.seed !== 'number' || !Number.isInteger(v.seed) || v.seed < 0 || v.seed > 0xffffffff) return false
  if (typeof v.flags !== 'string' || !FLAGS_RE.test(v.flags)) return false
  return typeof v.pick === 'string' && (SET_PICKS as readonly string[]).includes(v.pick)
}

function isActiveSet(v: unknown): v is ActiveSet {
  if (!isObj(v)) return false
  if (v.version !== 1 || typeof v.id !== 'string' || typeof v.courseId !== 'string') return false
  if (typeof v.startedAt !== 'number' || !Number.isFinite(v.startedAt) || typeof v.timed !== 'boolean') return false
  if (!Array.isArray(v.problems) || !Array.isArray(v.attemptIds) || !Array.isArray(v.status)) return false
  const n = v.problems.length
  if (n === 0 || n > MAX_PROBLEMS || v.attemptIds.length !== n || v.status.length !== n) return false
  if (typeof v.index !== 'number' || !Number.isInteger(v.index) || v.index < 0 || v.index > n) return false
  for (let i = 0; i < n; i++) {
    if (!isProblem(v.problems[i])) return false
    const id = v.attemptIds[i]
    if (id !== null && typeof id !== 'string') return false
    const status = v.status[i]
    if (typeof status !== 'string' || !STATUSES.has(status as SetSlotStatus)) return false
  }
  // Every slot before the one she is on is settled.
  for (let i = 0; i < Math.min(v.index, n); i++) if (v.status[i] === 'pending') return false
  return true
}

/** A stored set can outlive a problem type that was renamed or removed: the problem would send her home. */
function typesExist(set: ActiveSet): boolean {
  return set.problems.every((p) => {
    if (!hasModule(p.moduleId)) return false
    try {
      getTemplate(p.moduleId as ModuleId, p.templateId)
      return true
    } catch {
      return false
    }
  })
}

/** The set this device could not save (storage blocked or full): it keeps going while the app is open. */
let unsaved: ActiveSet | null = null

/** The active set, or null: none, unreadable, an older version, or a problem type that no longer exists. */
export function loadActiveSet(): ActiveSet | null {
  const raw = safeRead<unknown>(SET_STORAGE_KEY)
  if (raw === undefined && unsaved) return unsaved
  if (!isActiveSet(raw) || !typesExist(raw)) return null
  return raw
}

/** False when this device could not save it: then it lives in memory until the app closes. */
export function saveActiveSet(set: ActiveSet): boolean {
  const ok = safeWrite(SET_STORAGE_KEY, set)
  unsaved = ok ? null : set
  return ok
}

export function clearActiveSet(): void {
  unsaved = null
  safeRemove(SET_STORAGE_KEY)
}

/** A new set from what `buildSet` picked, on its first problem. */
export function newActiveSet(built: BuiltSet, opts: { now: number; timed: boolean }): ActiveSet {
  return {
    version: 1,
    id: `set-${opts.now.toString(36)}`,
    courseId: built.courseId,
    startedAt: opts.now,
    timed: opts.timed,
    problems: built.problems.map((p) => ({ ...p })),
    index: 0,
    attemptIds: built.problems.map(() => null),
    status: built.problems.map(() => 'pending'),
  }
}

/** She has seen the results (or the set is past its last problem). */
export function setFinished(set: ActiveSet): boolean {
  return set.index >= set.problems.length
}

/** The attempt is this problem: same type, same seed, same difficulty. */
export function sameSetProblem(attempt: Pick<Attempt, 'moduleId' | 'templateId' | 'seed' | 'difficulty'>, problem: SetProblem): boolean {
  return (
    attempt.moduleId === problem.moduleId &&
    attempt.templateId === problem.templateId &&
    attempt.seed === seedToBase36(problem.seed) &&
    attempt.difficulty === problem.flags
  )
}

/** The slot she is on, when the attempt is its problem and the slot is still hers to work on. */
export function currentSlotOf(set: ActiveSet, attempt: Pick<Attempt, 'moduleId' | 'templateId' | 'seed' | 'difficulty'>): number | null {
  const i = set.index
  if (i >= set.problems.length || set.status[i] !== 'pending') return null
  return sameSetProblem(attempt, set.problems[i]!) ? i : null
}

export function noteSetAttempt(set: ActiveSet, index: number, attemptId: string): ActiveSet {
  if (set.attemptIds[index] === attemptId) return set
  const attemptIds = set.attemptIds.slice()
  attemptIds[index] = attemptId
  return { ...set, attemptIds }
}

/** The slot's problem is finished. */
export function markSlotDone(set: ActiveSet, index: number): ActiveSet {
  if (set.status[index] !== 'pending') return set
  const status = set.status.slice()
  status[index] = 'done'
  return { ...set, status }
}

/** "Next in set": the slot she is on is finished, on to the next one. Never past the last (that is the results). */
export function nextInSet(set: ActiveSet): ActiveSet {
  if (set.index >= set.problems.length - 1) return set
  const done = markSlotDone(set, set.index)
  return { ...done, index: set.index + 1 }
}

/** Skip the problem she is on: it counts as skipped, not as wrong. On to the next one, unless it was the last. */
export function skipInSet(set: ActiveSet): ActiveSet {
  const i = set.index
  if (i >= set.problems.length || set.status[i] !== 'pending') return set
  const status = set.status.slice()
  status[i] = 'skipped'
  return { ...set, status, index: i < set.problems.length - 1 ? i + 1 : i }
}

/** The last slot is settled (finished or skipped): "See results" is what is left. */
export function readyForResults(set: ActiveSet): boolean {
  const last = set.problems.length - 1
  return set.index === last && set.status[last] !== 'pending'
}

/** "See results", after the break: the results. Only once the last slot is settled. */
export function showSetResults(set: ActiveSet): ActiveSet {
  return readyForResults(set) ? { ...set, index: set.problems.length } : set
}

/**
 * Opening the set again (Resume on Home, a reload): a slot she finished but did not leave with "Next in set" is
 * behind her, so she starts on the next one. The last slot stays: its "See results" is hers to tap.
 */
export function resumeSet(set: ActiveSet): ActiveSet {
  return set.index < set.problems.length - 1 && set.status[set.index] === 'done' ? { ...set, index: set.index + 1 } : set
}

/** "2 of 3": the problem she will see when she opens the set (1-based). */
export function resumePosition(set: ActiveSet): number {
  return Math.min(resumeSet(set).index, set.problems.length - 1) + 1
}
