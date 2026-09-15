/**
 * Store shapes. Mirrors the localStorage schema in docs/research/ux-mobile-progress.md
 * ("localStorage schema (key prefix pct.)"). Types only.
 */
import type { CalcId, ChipId } from '@/shared/types'

export const SCHEMA_VERSION = 1

// ---------------------------------------------------------------------------
// pct.meta / pct.settings / pct.auth
// ---------------------------------------------------------------------------

export interface Meta {
  schemaVersion: number
  /** ISO timestamp of first run on this device. */
  createdAt: string
  /** ISO timestamp of the last export from this device. */
  lastBackupAt?: string
}

export type AskProperty = 'always' | 'off'

export interface Settings {
  calculator: CalcId
  askProperty: AskProperty
  testMode: boolean
  seenA2HS: boolean
}

export interface Auth {
  ok: boolean
}

// ---------------------------------------------------------------------------
// pct.attempt.current
// ---------------------------------------------------------------------------

export type PropertyOutcome = 'correct' | 'wrong' | 'skipped' | 'off'
export type AttemptMode = 'normal' | 'timed'
export type HintRung = 0 | 1 | 2 | 3

export interface AttemptStep {
  idx: number
  /** Normalized app-syntax text of the accepted line. */
  text: string
  latex?: string
  accepted: true
  firstTry: boolean
  /** Rung-3 "show the step" produced this line. */
  revealed: boolean
  property: PropertyOutcome
  /** Detected PropertyTag (or chip id) for the move — what the chip prompt grades against. */
  propertyTag?: string
  /** Chip she picked, when she answered. */
  chip?: ChipId
}

export interface AttemptFinal {
  interval?: string
  set?: string
  oneToOne?: 'yes' | 'no'
  reason?: string
  parity?: string
  correct?: boolean
  /** Sticky: some final answer / verdict / check for this attempt was recorded wrong (blocks finalCorrect). */
  everWrong?: boolean
  /** Result of the first final-answer record (answer-only problems base their first-try rate on it). */
  firstCorrect?: boolean
}

export interface Attempt {
  /** Unique per attempt: `${problemId}#${startedAt base36}`. */
  id: string
  /** Problem id (`${moduleId}/${templateId}@${genVersion}/${seed36}`), shared by re-attempts. */
  problemId: string
  moduleId: string
  templateId: string
  /** Progress skill key (= templateId for registry problems). */
  skill: string
  /** Seed in base36. */
  seed: string
  /** Difficulty flag string as it appears in the URL (`d=`). */
  difficulty: string
  genVersion: number
  mode: AttemptMode
  startedAt: string
  lastActiveAt: string
  steps: AttemptStep[]
  /** Highest hint rung used per step index (JSON keys are strings). */
  hintsUsed: Record<string, HintRung>
  draft: string
  nudged: boolean
  /** Inverses: the x↔y swap has happened. */
  swapped: boolean
  /** Rejections since the last accepted step (drives the "two tries" hint highlight). */
  currentRejections: number
  /**
   * Rejections per ladder key (step index; even/odd slots use their own key range). Not cleared by
   * undo, so firstTry = no rejections at that key and not revealed. Optional: attempts stored before
   * this field existed fall back to currentRejections.
   */
  rejectionsByIdx?: Record<string, number>
  /** Foreground seconds spent (maintained by the workspace's idle clock). */
  activeSecs: number
  final?: AttemptFinal
}

// ---------------------------------------------------------------------------
// pct.events (append-only)
// ---------------------------------------------------------------------------

interface EvBase {
  /** Epoch ms. */
  at: number
}

export type Ev =
  | (EvBase & {
      t: 'step_accepted'
      attemptId: string
      skill: string
      stepIdx: number
      firstTry: boolean
      revealed: boolean
      property: PropertyOutcome
    })
  | (EvBase & { t: 'step_rejected'; attemptId: string; skill: string; stepIdx: number; pattern?: string })
  | (EvBase & { t: 'hint'; attemptId: string; skill: string; stepIdx: number; rung: 1 | 2 | 3 })
  | (EvBase & { t: 'step_undone'; attemptId: string; skill: string; stepIdx: number })
  | (EvBase & {
      t: 'final_answer'
      attemptId: string
      skill: string
      correct: boolean
      pattern?: string
      via?: 'builder' | 'text'
    })
  | (EvBase & {
      t: 'problem_done'
      attemptId: string
      skill: string
      moduleId: string
      steps: number
      firstTryRate: number
      hints: number
      /** Number of revealed (rung-3) steps — mastery requires 0. */
      revealed: number
      /** Final answer(s) correct — mastery requires true on all 5. */
      finalCorrect: boolean
      mode: AttemptMode
      secs: number
    })
  | (EvBase & { t: 'problem_abandoned'; attemptId: string; skill: string })
  | (EvBase & { t: 'drill_answer'; skill: string; correct: boolean; kind: 'property' | 'legal' })

export type EvType = Ev['t']

// ---------------------------------------------------------------------------
// pct.weekly (compaction target)
// ---------------------------------------------------------------------------

export interface WeeklySkill {
  steps: number
  firstTry: number
  revealed: number
  hints: number
  propAnswered: number
  propCorrect: number
  patterns: Record<string, number>
  done: number
  abandoned: number
  drillAnswered: number
  drillCorrect: number
}

/** weekly[isoWeek][skill] */
export type Weekly = Record<string, Record<string, WeeklySkill>>

// ---------------------------------------------------------------------------
// pct.streak
// ---------------------------------------------------------------------------

export interface Streak {
  /** 'YYYY-MM-DD' (local) of the last day with a completed problem; '' when none. */
  lastDay: string
  count: number
}

// ---------------------------------------------------------------------------
// Everything that is persisted
// ---------------------------------------------------------------------------

export interface PersistedState {
  meta: Meta
  settings: Settings
  auth: Auth
  attempt: Attempt | null
  events: Ev[]
  weekly: Weekly
  streak: Streak
}

export type PersistedSlice = keyof PersistedState

export const DEFAULT_SETTINGS: Settings = {
  calculator: 'ti84',
  askProperty: 'always',
  testMode: false,
  seenA2HS: false,
}

export const EMPTY_STREAK: Streak = { lastDay: '', count: 0 }

export function emptyWeeklySkill(): WeeklySkill {
  return {
    steps: 0,
    firstTry: 0,
    revealed: 0,
    hints: 0,
    propAnswered: 0,
    propCorrect: 0,
    patterns: {},
    done: 0,
    abandoned: 0,
    drillAnswered: 0,
    drillCorrect: 0,
  }
}

export function defaultPersisted(now = Date.now()): PersistedState {
  return {
    meta: { schemaVersion: SCHEMA_VERSION, createdAt: new Date(now).toISOString() },
    settings: { ...DEFAULT_SETTINGS },
    auth: { ok: false },
    attempt: null,
    events: [],
    weekly: {},
    streak: { ...EMPTY_STREAK },
  }
}
