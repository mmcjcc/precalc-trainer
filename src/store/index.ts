/**
 * App store: Zustand + persist, fanned out into `pct.*` localStorage keys (see ./storage.ts).
 *
 * Persisted: meta, settings, auth, attempt (current), events (append-only), weekly, streak.
 * Transient: toasts, hydrated, storageOk.
 *
 * Selectors are pure functions in ./selectors.ts; the hooks at the bottom memoize them.
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import type { ChipId } from '@/shared/types'
import { buildBackup, importBackup, type ImportMode } from './backup'
import { compact } from './compaction'
import {
  bumpStreak,
  currentStreak,
  drillAccuracy,
  firstTryRate,
  habits,
  hintRate,
  mastery,
  moduleMastery,
  patternCounts,
  propertyAccuracy,
} from './selectors'
import { createFanOutStorage, PERSIST_NAME } from './storage'
import { dayKey } from './time'
import {
  DEFAULT_SETTINGS,
  EMPTY_STREAK,
  SCHEMA_VERSION,
  defaultPersisted,
  type Attempt,
  type AttemptFinal,
  type AttemptMode,
  type AttemptStep,
  type Ev,
  type HintRung,
  type PersistedState,
  type PropertyOutcome,
  type Settings,
  type Streak,
  type Weekly,
} from './types'

export * from './types'
export * from './selectors'
export { compact } from './compaction'
export { STORAGE_KEYS, saveReturnTo, takeReturnTo } from './storage'
export { relativeDays, daysAgo, dayKey, isoWeekKey } from './time'
export type { ImportMode } from './backup'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastTone = 'info' | 'ok' | 'bad'
export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  detail?: string
}

export interface StartAttemptInput {
  problemId: string
  moduleId: string
  templateId: string
  skill: string
  seed: string
  difficulty: string
  genVersion: number
  mode?: AttemptMode
  now?: number
}

export interface AcceptStepInput {
  text: string
  latex?: string
  propertyTag?: string
  revealed?: boolean
  /** Hint-ladder / rejection key for this step (default: the step index). */
  hintKey?: number
  now?: number
}

export interface FinishAttemptInput {
  finalCorrect?: boolean
  /** Extra seconds to add on top of attempt.activeSecs. */
  secs?: number
  now?: number
}

export interface ProblemSummary {
  skill: string
  steps: number
  firstTry: number
  hints: number
  revealed: number
  finalCorrect: boolean
  secs: number
  streak: number
  mode: AttemptMode
}

interface Transient {
  hydrated: boolean
  storageOk: boolean
  toasts: ToastItem[]
}

interface Actions {
  // settings / auth
  setSettings: (patch: Partial<Settings>) => void
  unlock: () => void
  lock: () => void
  // attempt lifecycle
  startAttempt: (input: StartAttemptInput) => Attempt
  acceptStep: (input: AcceptStepInput) => AttemptStep | null
  answerProperty: (stepIdx: number, outcome: 'correct' | 'wrong', chip?: ChipId) => void
  /** `key`: the ladder key the rejection counts against (default: the next step index). */
  rejectStep: (pattern?: string, now?: number, key?: number) => void
  undoStep: () => AttemptStep | null
  useHint: (stepIdx: number, rung: 1 | 2 | 3, now?: number) => void
  /** Debounced 500 ms; flushed by acceptStep/finish/abandon. */
  setDraft: (text: string) => void
  flushDraft: () => void
  setFinal: (patch: Partial<AttemptFinal>) => void
  recordFinalAnswer: (input: { correct: boolean; pattern?: string; via?: 'builder' | 'text'; now?: number }) => void
  setNudged: () => void
  setSwapped: (swapped?: boolean) => void
  addActiveSecs: (secs: number) => void
  finishAttempt: (input?: FinishAttemptInput) => ProblemSummary | null
  abandonAttempt: (now?: number) => void
  // drill
  recordDrillAnswer: (skill: string, correct: boolean, kind: 'property' | 'legal', now?: number) => void
  // maintenance
  resetProgress: () => void
  exportJson: () => string
  importJson: (text: string, mode: ImportMode) => { ok: true; added: number } | { ok: false; error: string }
  compactNow: (now?: number) => number
  // transient
  toast: (message: string, opts?: { tone?: ToastTone; detail?: string }) => number
  dismissToast: (id: number) => void
  markHydrated: () => void
  onStorageError: (keys: string[]) => void
}

export type StoreState = PersistedState & Transient & Actions

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DRAFT_DEBOUNCE_MS = 500
let draftTimer: ReturnType<typeof setTimeout> | null = null
let pendingDraft: string | null = null
let toastSeq = 1

function iso(now: number): string {
  return new Date(now).toISOString()
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Fill every slice with defaults so a partially-corrupt storage never crashes the app. */
function mergePersisted(persisted: unknown, current: StoreState): StoreState {
  const p = isPlainObject(persisted) ? (persisted as Partial<PersistedState>) : {}
  const base = defaultPersisted()
  const settings: Settings = { ...DEFAULT_SETTINGS, ...(isPlainObject(p.settings) ? p.settings : {}) }
  if (settings.calculator !== 'ti84' && settings.calculator !== 'nspire') settings.calculator = 'ti84'
  if (settings.askProperty !== 'always' && settings.askProperty !== 'off') settings.askProperty = 'always'
  const events = Array.isArray(p.events) ? (p.events as unknown[]).filter((e): e is Ev => isPlainObject(e) && typeof e.t === 'string' && typeof e.at === 'number') : []
  const weekly: Weekly = isPlainObject(p.weekly) ? (p.weekly as Weekly) : {}
  const streak: Streak = isPlainObject(p.streak) && typeof p.streak.count === 'number' ? (p.streak as Streak) : { ...EMPTY_STREAK }
  const attempt = isPlainObject(p.attempt) && typeof p.attempt.id === 'string' && Array.isArray(p.attempt.steps) ? (p.attempt as Attempt) : null
  return {
    ...current,
    meta: { ...base.meta, ...(isPlainObject(p.meta) ? p.meta : {}), schemaVersion: SCHEMA_VERSION },
    settings,
    auth: { ok: isPlainObject(p.auth) && p.auth.ok === true },
    attempt,
    events,
    weekly,
    streak,
  }
}

function touch(attempt: Attempt, now: number): Attempt {
  return { ...attempt, lastActiveAt: iso(now) }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const fanOut = createFanOutStorage((keys) => {
  // Deferred: the store may not exist yet on the very first write.
  queueMicrotask(() => useStore.getState().onStorageError(keys))
})

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      ...defaultPersisted(),
      hydrated: false,
      storageOk: true,
      toasts: [],

      // --- settings / auth --------------------------------------------------
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      unlock: () => set({ auth: { ok: true } }),
      lock: () => set({ auth: { ok: false } }),

      // --- attempt ----------------------------------------------------------
      startAttempt: (input) => {
        const now = input.now ?? Date.now()
        const prev = get().attempt
        const events = get().events.slice()
        if (prev && (prev.problemId !== input.problemId || prev.difficulty !== input.difficulty)) {
          events.push({ t: 'problem_abandoned', at: now, attemptId: prev.id, skill: prev.skill })
        }
        const attempt: Attempt = {
          id: `${input.problemId}#${now.toString(36)}`,
          problemId: input.problemId,
          moduleId: input.moduleId,
          templateId: input.templateId,
          skill: input.skill,
          seed: input.seed,
          difficulty: input.difficulty,
          genVersion: input.genVersion,
          mode: input.mode ?? (get().settings.testMode ? 'timed' : 'normal'),
          startedAt: iso(now),
          lastActiveAt: iso(now),
          steps: [],
          hintsUsed: {},
          draft: '',
          nudged: false,
          swapped: false,
          currentRejections: 0,
          rejectionsByIdx: {},
          activeSecs: 0,
        }
        pendingDraft = null
        if (draftTimer) clearTimeout(draftTimer)
        set({ attempt, events })
        return attempt
      },

      acceptStep: (input) => {
        const s = get()
        const a = s.attempt
        if (!a) return null
        const now = input.now ?? Date.now()
        if (draftTimer) clearTimeout(draftTimer)
        pendingDraft = null
        const key = String(input.hintKey ?? a.steps.length)
        // Rung 3 ("Show the step") marks the step shown whether or not "Use this line" was clicked.
        const revealed = Boolean(input.revealed) || (a.hintsUsed[key] ?? 0) >= 3
        const tries = a.rejectionsByIdx ? (a.rejectionsByIdx[key] ?? 0) : a.currentRejections
        const step: AttemptStep = {
          idx: a.steps.length,
          text: input.text,
          latex: input.latex,
          accepted: true,
          firstTry: tries === 0 && !revealed,
          revealed,
          property: s.settings.askProperty === 'off' ? 'off' : 'skipped',
          propertyTag: input.propertyTag,
        }
        const ev: Ev = {
          t: 'step_accepted',
          at: now,
          attemptId: a.id,
          skill: a.skill,
          stepIdx: step.idx,
          firstTry: step.firstTry,
          revealed: step.revealed,
          property: step.property,
        }
        set({
          attempt: touch({ ...a, steps: [...a.steps, step], draft: '', currentRejections: 0 }, now),
          events: [...s.events, ev],
        })
        return step
      },

      answerProperty: (stepIdx, outcome, chip) => {
        const s = get()
        const a = s.attempt
        if (!a) return
        const steps = a.steps.map((st) => (st.idx === stepIdx ? { ...st, property: outcome as PropertyOutcome, chip } : st))
        // Patch the matching step_accepted event (same attempt, same step) in place.
        const events = s.events.slice()
        for (let i = events.length - 1; i >= 0; i--) {
          const e = events[i]!
          if (e.t === 'step_accepted' && e.attemptId === a.id && e.stepIdx === stepIdx) {
            events[i] = { ...e, property: outcome }
            break
          }
        }
        set({ attempt: { ...a, steps }, events })
      },

      rejectStep: (pattern, now = Date.now(), key) => {
        const s = get()
        const a = s.attempt
        if (!a) return
        const ev: Ev = { t: 'step_rejected', at: now, attemptId: a.id, skill: a.skill, stepIdx: a.steps.length, pattern }
        const k = String(key ?? a.steps.length)
        const rejectionsByIdx = { ...a.rejectionsByIdx, [k]: (a.rejectionsByIdx?.[k] ?? 0) + 1 }
        set({ attempt: touch({ ...a, currentRejections: a.currentRejections + 1, rejectionsByIdx }, now), events: [...s.events, ev] })
      },

      undoStep: () => {
        const s = get()
        const a = s.attempt
        if (!a || a.steps.length === 0) return null
        const now = Date.now()
        const last = a.steps[a.steps.length - 1]!
        const ev: Ev = { t: 'step_undone', at: now, attemptId: a.id, skill: a.skill, stepIdx: last.idx }
        set({
          attempt: touch({ ...a, steps: a.steps.slice(0, -1), draft: last.text, currentRejections: 0 }, now),
          events: [...s.events, ev],
        })
        return last
      },

      useHint: (stepIdx, rung, now = Date.now()) => {
        const s = get()
        const a = s.attempt
        if (!a) return
        const prev = a.hintsUsed[String(stepIdx)] ?? 0
        const hintsUsed = { ...a.hintsUsed, [String(stepIdx)]: Math.max(prev, rung) as HintRung }
        const ev: Ev = { t: 'hint', at: now, attemptId: a.id, skill: a.skill, stepIdx, rung }
        set({ attempt: touch({ ...a, hintsUsed }, now), events: [...s.events, ev] })
      },

      setDraft: (text) => {
        pendingDraft = text
        if (draftTimer) clearTimeout(draftTimer)
        draftTimer = setTimeout(() => {
          draftTimer = null
          get().flushDraft()
        }, DRAFT_DEBOUNCE_MS)
      },

      flushDraft: () => {
        if (draftTimer) {
          clearTimeout(draftTimer)
          draftTimer = null
        }
        if (pendingDraft === null) return
        const text = pendingDraft
        pendingDraft = null
        const a = get().attempt
        if (!a || a.draft === text) return
        set({ attempt: touch({ ...a, draft: text }, Date.now()) })
      },

      setFinal: (patch) => {
        const a = get().attempt
        if (!a) return
        set({ attempt: { ...a, final: { ...a.final, ...patch } } })
      },

      recordFinalAnswer: ({ correct, pattern, via, now = Date.now() }) => {
        const s = get()
        const a = s.attempt
        if (!a) return
        const ev: Ev = { t: 'final_answer', at: now, attemptId: a.id, skill: a.skill, correct, pattern, via }
        const final: AttemptFinal = {
          ...a.final,
          correct,
          everWrong: Boolean(a.final?.everWrong) || !correct,
          firstCorrect: a.final?.firstCorrect ?? correct,
        }
        set({ attempt: touch({ ...a, final }, now), events: [...s.events, ev] })
      },

      setNudged: () => {
        const a = get().attempt
        if (a && !a.nudged) set({ attempt: { ...a, nudged: true } })
      },

      setSwapped: (swapped = true) => {
        const a = get().attempt
        if (a && a.swapped !== swapped) set({ attempt: { ...a, swapped } })
      },

      addActiveSecs: (secs) => {
        const a = get().attempt
        if (a && secs > 0) set({ attempt: { ...a, activeSecs: a.activeSecs + secs } })
      },

      finishAttempt: (input = {}) => {
        const s = get()
        const a = s.attempt
        if (!a) return null
        const now = input.now ?? Date.now()
        if (draftTimer) clearTimeout(draftTimer)
        pendingDraft = null
        const steps = a.steps.length
        const firstTry = a.steps.filter((st) => st.firstTry).length
        // A rung-3 reveal on an answer-only problem counts as one revealed item (final.revealed).
        const revealed = a.steps.filter((st) => st.revealed).length + (a.final?.revealed ? 1 : 0)
        const hints = s.events.filter((e) => e.t === 'hint' && e.attemptId === a.id).length
        // Decided by the attempt: one wrong final answer / verdict / check anywhere makes it false.
        const finalCorrect = (input.finalCorrect ?? a.final?.correct ?? true) && !a.final?.everWrong
        const secs = Math.round(a.activeSecs + (input.secs ?? 0))
        const ev: Ev = {
          t: 'problem_done',
          at: now,
          attemptId: a.id,
          skill: a.skill,
          moduleId: a.moduleId,
          steps,
          // Answer-only problems: first try = the first final-answer check was right.
          firstTryRate: steps > 0 ? firstTry / steps : a.final?.firstCorrect === true ? 1 : 0,
          hints,
          revealed,
          finalCorrect,
          mode: a.mode,
          secs,
        }
        const streak = a.mode === 'normal' ? bumpStreak(s.streak, dayKey(now)) : s.streak
        set({ attempt: null, events: [...s.events, ev], streak })
        return { skill: a.skill, steps, firstTry, hints, revealed, finalCorrect, secs, streak: currentStreak(streak, now), mode: a.mode }
      },

      abandonAttempt: (now = Date.now()) => {
        const s = get()
        const a = s.attempt
        if (!a) return
        if (draftTimer) clearTimeout(draftTimer)
        pendingDraft = null
        const ev: Ev = { t: 'problem_abandoned', at: now, attemptId: a.id, skill: a.skill }
        set({ attempt: null, events: [...s.events, ev] })
      },

      // --- drill ------------------------------------------------------------
      recordDrillAnswer: (skill, correct, kind, now = Date.now()) => {
        const ev: Ev = { t: 'drill_answer', at: now, skill, correct, kind }
        set((s) => ({ events: [...s.events, ev] }))
      },

      // --- maintenance ------------------------------------------------------
      resetProgress: () => {
        if (draftTimer) clearTimeout(draftTimer)
        pendingDraft = null
        set({ attempt: null, events: [], weekly: {}, streak: { ...EMPTY_STREAK } })
      },

      exportJson: () => {
        const s = get()
        const now = Date.now()
        const json = JSON.stringify(buildBackup(s, now), null, 2)
        set({ meta: { ...s.meta, lastBackupAt: iso(now) } })
        return json
      },

      importJson: (text, mode) => {
        const s = get()
        const r = importBackup(s, text, mode)
        if (!r.ok) return { ok: false, error: r.error }
        set({ events: r.events, weekly: r.weekly, streak: r.streak })
        return { ok: true, added: r.added }
      },

      compactNow: (now = Date.now()) => {
        const s = get()
        const r = compact(s.events, s.weekly, now)
        if (r.folded > 0) set({ events: r.events, weekly: r.weekly })
        return r.folded
      },

      // --- transient --------------------------------------------------------
      toast: (message, opts) => {
        const id = toastSeq++
        set((s) => ({ toasts: [...s.toasts, { id, message, tone: opts?.tone ?? 'info', detail: opts?.detail }] }))
        return id
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      markHydrated: () => set({ hydrated: true }),
      onStorageError: (keys) => {
        const s = get()
        if (!s.storageOk) return
        set({ storageOk: false })
        s.toast('Progress could not be saved on this device.', {
          tone: 'bad',
          detail: `Storage is blocked or full (${keys.join(', ')}). The app keeps working — export a backup from Progress before you close it.`,
        })
      },
    }),
    {
      name: PERSIST_NAME,
      version: SCHEMA_VERSION,
      storage: fanOut,
      partialize: (s): PersistedState => ({
        meta: s.meta,
        settings: s.settings,
        auth: s.auth,
        attempt: s.attempt,
        events: s.events,
        weekly: s.weekly,
        streak: s.streak,
      }),
      merge: (persisted, current) => mergePersisted(persisted, current),
      migrate: (persisted) => persisted as PersistedState, // v1 is the first schema; add steps here.
      onRehydrateStorage: () => (state) => {
        state?.markHydrated()
      },
    },
  ),
)

/** Run once at app start: compaction + hydration flag (safe to call again). */
export function bootStore(now = Date.now()): void {
  const s = useStore.getState()
  if (!s.hydrated) s.markHydrated()
  s.compactNow(now)
}

/** Tests: wipe memory + storage back to defaults. */
export function resetStoreForTests(): void {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = null
  pendingDraft = null
  useStore.persist.clearStorage()
  fanOut.reset()
  useStore.setState({ ...defaultPersisted(), hydrated: true, storageOk: true, toasts: [] })
}

// ---------------------------------------------------------------------------
// Hooks (memoized selector wrappers)
// ---------------------------------------------------------------------------

export const useSettings = (): Settings => useStore((s) => s.settings)
export const useAttempt = (): Attempt | null => useStore((s) => s.attempt)
export const useEvents = (): Ev[] => useStore((s) => s.events)
export const useWeekly = (): Weekly => useStore((s) => s.weekly)
export const useToasts = (): ToastItem[] => useStore((s) => s.toasts)

export function useMastery(skill: string) {
  const events = useEvents()
  return useMemo(() => mastery(events, skill), [events, skill])
}

export function useModuleMastery(skills: string[]) {
  const events = useEvents()
  const key = skills.join(' ')
  return useMemo(() => moduleMastery(events, key ? key.split(' ') : []), [events, key])
}

export function usePatternCounts(now?: number) {
  const { events, weekly } = useStore(useShallow((s) => ({ events: s.events, weekly: s.weekly })))
  return useMemo(() => patternCounts(events, weekly, now ?? Date.now()), [events, weekly, now])
}

export function useHabits() {
  const { events, weekly } = useStore(useShallow((s) => ({ events: s.events, weekly: s.weekly })))
  return useMemo(() => habits(events, weekly), [events, weekly])
}

export function useHintRate(skill?: string) {
  const { events, weekly } = useStore(useShallow((s) => ({ events: s.events, weekly: s.weekly })))
  return useMemo(() => hintRate(events, weekly, skill), [events, weekly, skill])
}

export function useFirstTryRate(skill?: string) {
  const { events, weekly } = useStore(useShallow((s) => ({ events: s.events, weekly: s.weekly })))
  return useMemo(() => firstTryRate(events, weekly, skill), [events, weekly, skill])
}

export function usePropertyAccuracy(skill?: string) {
  const { events, weekly } = useStore(useShallow((s) => ({ events: s.events, weekly: s.weekly })))
  return useMemo(() => propertyAccuracy(events, weekly, skill), [events, weekly, skill])
}

export function useDrillAccuracy(kind?: 'property' | 'legal') {
  const { events, weekly } = useStore(useShallow((s) => ({ events: s.events, weekly: s.weekly })))
  return useMemo(() => drillAccuracy(events, weekly, kind), [events, weekly, kind])
}

export function useStreak(): number {
  const streak = useStore((s) => s.streak)
  return useMemo(() => currentStreak(streak), [streak])
}
