/**
 * localStorage adapter: one `pct.*` key per persisted slice, every read/write in try/catch.
 * The in-memory store keeps working when storage is unavailable (private mode, quota).
 */
import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { SCHEMA_VERSION, type PersistedSlice, type PersistedState } from './types'

export const STORAGE_KEYS: Record<PersistedSlice, string> = {
  meta: 'pct.meta',
  settings: 'pct.settings',
  auth: 'pct.auth',
  attempt: 'pct.attempt.current',
  events: 'pct.events',
  weekly: 'pct.weekly',
  streak: 'pct.streak',
}

export const SLICES = Object.keys(STORAGE_KEYS) as PersistedSlice[]

/** The name the persist middleware is registered under (not itself a storage key). */
export const PERSIST_NAME = 'pct'

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null
    const s = window.localStorage
    // Touching a property proves access is allowed (Safari private mode throws on use).
    void s.length
    return s
  } catch {
    return null
  }
}

export function safeRead<T>(key: string): T | undefined {
  try {
    const raw = getStorage()?.getItem(key)
    if (raw == null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function safeWrite(key: string, value: unknown): boolean {
  try {
    const s = getStorage()
    if (!s) return false
    s.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function safeRemove(key: string): boolean {
  try {
    const s = getStorage()
    if (!s) return false
    s.removeItem(key)
    return true
  } catch {
    return false
  }
}

export type StorageErrorHandler = (failedKeys: string[]) => void

/**
 * Fan-out PersistStorage: the persist middleware hands us the whole persisted object; we write only
 * the slices whose reference changed since the last write (immutable updates mean unchanged slices
 * keep their identity), so typing a draft never re-serializes the event log.
 */
export function createFanOutStorage(onError?: StorageErrorHandler): PersistStorage<PersistedState> & {
  /** Forget the write cache (tests / import). */
  reset: () => void
} {
  let lastWritten: Partial<Record<PersistedSlice, unknown>> = {}
  return {
    getItem: (): StorageValue<PersistedState> | null => {
      const partial: Partial<PersistedState> = {}
      let any = false
      for (const slice of SLICES) {
        const v = safeRead<unknown>(STORAGE_KEYS[slice])
        if (v !== undefined) {
          any = true
          // Slices are validated/merged by the store's `merge`; cast here is the storage boundary.
          ;(partial as Record<string, unknown>)[slice] = v
        }
      }
      if (!any) return null
      const version = (partial.meta as { schemaVersion?: number } | undefined)?.schemaVersion ?? SCHEMA_VERSION
      lastWritten = { ...partial }
      return { state: partial as PersistedState, version }
    },
    setItem: (_name, value): void => {
      const failed: string[] = []
      const state = value.state
      for (const slice of SLICES) {
        const v = state[slice]
        if (v === lastWritten[slice]) continue
        const ok = v === undefined || v === null ? safeRemove(STORAGE_KEYS[slice]) : safeWrite(STORAGE_KEYS[slice], v)
        if (ok) lastWritten[slice] = v
        else failed.push(STORAGE_KEYS[slice])
      }
      if (failed.length && onError) onError(failed)
    },
    removeItem: (): void => {
      for (const slice of SLICES) safeRemove(STORAGE_KEYS[slice])
      lastWritten = {}
    },
    reset: () => {
      lastWritten = {}
    },
  }
}

/** sessionStorage `returnTo` for the PIN gate (never in localStorage, never in URLs). */
const RETURN_TO_KEY = 'pct.returnTo'
export function saveReturnTo(path: string): void {
  try {
    window.sessionStorage.setItem(RETURN_TO_KEY, path)
  } catch {
    /* ignore */
  }
}
export function takeReturnTo(): string | null {
  try {
    const v = window.sessionStorage.getItem(RETURN_TO_KEY)
    window.sessionStorage.removeItem(RETURN_TO_KEY)
    return v
  } catch {
    return null
  }
}
