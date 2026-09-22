/**
 * This attempt's tutor thread, in localStorage. A finished attempt's thread is dropped once a
 * new attempt starts. Every read and write goes through the app's try/catch adapter.
 */
import { safeRead, safeRemove, safeWrite } from '@/store/storage'

const PREFIX = 'pct.tutor.'

export interface StoredTurn {
  question: string
  answer: string
  /** Log id from the done event. Absent on an error reply. */
  id?: string
  error?: boolean
  flagged?: boolean
  truncated?: boolean
}

export interface StoredThread {
  turns: StoredTurn[]
  /** The completion card was shown. The next attempt may delete this thread. */
  finished?: boolean
}

export function tutorStorageKey(attemptId: string): string {
  return PREFIX + attemptId
}

function isTurn(value: unknown): value is StoredTurn {
  if (!value || typeof value !== 'object') return false
  const turn = value as StoredTurn
  return typeof turn.question === 'string' && typeof turn.answer === 'string'
}

export function loadThread(attemptId: string): StoredThread {
  const stored = safeRead<StoredThread>(tutorStorageKey(attemptId))
  if (!stored || !Array.isArray(stored.turns)) return { turns: [] }
  return { turns: stored.turns.filter(isTurn), finished: stored.finished === true }
}

export function saveThread(attemptId: string, thread: StoredThread): void {
  safeWrite(tutorStorageKey(attemptId), thread)
}

/** Mark an existing thread finished. No thread yet: nothing to keep. */
export function markThreadFinished(attemptId: string): void {
  const key = tutorStorageKey(attemptId)
  const stored = safeRead<StoredThread>(key)
  if (!stored || stored.finished) return
  safeWrite(key, { turns: Array.isArray(stored.turns) ? stored.turns.filter(isTurn) : [], finished: true })
}

/** Drop finished threads that belong to some other attempt. */
export function dropFinishedThreads(keepId: string): void {
  try {
    if (typeof window === 'undefined') return
    const storage = window.localStorage
    const keep = tutorStorageKey(keepId)
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && key.startsWith(PREFIX) && key !== keep) keys.push(key)
    }
    for (const key of keys) {
      const stored = safeRead<StoredThread>(key)
      if (stored?.finished) safeRemove(key)
    }
  } catch {
    /* Private mode or a thrown length access: the in-memory thread still works. */
  }
}
