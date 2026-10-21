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

/** Daily goal in XP (Settings): about 1, 1 or 2, or 2 or 3 problems (a clean problem pays 40 to 70). */
export type DailyGoal = 30 | 60 | 100

export interface Settings {
  calculator: CalcId
  askProperty: AskProperty
  testMode: boolean
  seenA2HS: boolean
  /**
   * Class last chosen on Home. Absent on devices that saved settings before classes existed;
   * Home then picks from the event log.
   */
  courseId?: string
  /** Unit last chosen in each class, keyed by course id. Absent until she picks one. */
  unitByCourse?: Record<string, string>
  /**
   * "Math keypad": on a touch screen, math answers open the app's math keypad instead of the phone's
   * keyboard. Absent means on; it never applies where the pointer is a mouse.
   */
  mathKeypad?: boolean
  /**
   * "Rewards (XP, daily goal, streak)". Absent means the edition's default: on in the store app, off in the family
   * web app. Off: no XP, goal, streak or mistake cards anywhere (the day streak stays as it was). Belongs to the
   * device, like the keypad: an import never changes it.
   */
  rewards?: boolean
  /** Daily goal in XP. Absent means 60. */
  dailyGoal?: DailyGoal
  /** "Vibrate": a light tick on a right line or part and when the goal is met (rewards on only). Absent means on. */
  vibrate?: boolean
  /**
   * "Sounds": a chime on a right line or part (it climbs with the combo), a soft note for a slip, a short tune at a
   * finish (components/juice/sounds.ts). Absent means the edition's default: on in the store app, off in the family web
   * app. Works with rewards on or off. Belongs to the device, like Vibrate: an import never changes it.
   */
  sounds?: boolean
  /**
   * Guided mode, on problem types that offer cards (exponential and log equations): 'pick' is "Pick: choose each
   * next line from three (counts less)". Absent means 'type'. Belongs to the device, like the keypad: an import never
   * changes it.
   */
  lineEntry?: LineEntry
}

/** How she writes each line where the problem offers cards: on the keypad, or picked from three cards. */
export type LineEntry = 'type' | 'pick'

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
  /** Guided mode: kept after its cards were shown (picked, or typed with the right card in view). */
  via?: 'card'
}

/** Guided mode: one line whose cards were shown (`Attempt.picks`). */
export interface LinePicks {
  /** Wrong cards she picked, by their text: they stay off the cards for the rest of the line. */
  wrong: string[]
  /** "Type it yourself instead": this line is on the keypad. */
  typing?: boolean
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
  /**
   * Rung 3 showed the answer before it was given (answer-only problems). Counted like a revealed
   * step: it blocks mastery for this attempt.
   */
  revealed?: boolean
  /** Significant figures: the coefficient box exactly as typed (restored after a reload). */
  sfText?: string
  /** Significant figures: the power-of-ten box exactly as typed. */
  sfPower?: string
  /** Significant figures, count tasks: `SigFigChar.index` of every digit she marked significant. */
  sfTaps?: number[]
  /** Significant figures, mixed tasks: the intermediate-precision box as typed. */
  sfIntermediate?: string
  /** Significant figures, mixed tasks: how many intermediate questions have been answered right. */
  sfIntermediateDone?: number
  /**
   * Atomic structure: every answer box exactly as typed, keyed by box (protons, neutrons, electrons,
   * symbol, massNumber, atomicNumber, charge, abundance1, abundance2; avgmass uses sfText / sfPower).
   */
  atEntries?: Record<string, string>
  /**
   * Reading a graph: the six boxes exactly as typed (increasing, decreasing, globalMax, globalMin,
   * localMax, localMin). Restored after a reload.
   */
  gfEntries?: Record<string, string>
  /**
   * Domain, range, composition, transformations, piecewise, and rate: the answer box(es) exactly as
   * typed. `answer` is the set, formula, point, value, or a readable summary of the step cards;
   * `steps` is the step-card builder as JSON. A decomposition uses `f` and `g`. Restored after a reload.
   */
  fnEntries?: Record<string, string>
  /**
   * Electrons and light, spectrum ordering: the ids she has tapped, in tap order. Restored after a
   * reload. Light calculations reuse sfText / sfPower.
   */
  ltOrder?: string[]
  /**
   * Electron configurations: the configuration, element, valence count, or unpaired count exactly as
   * typed. Restored after a reload.
   */
  ecText?: string
  /** Electron configurations: her orbital diagram in the engine's text form (`ud u u`). */
  ecDiagram?: string
  /**
   * Polynomials (precalculus Unit 2): every answer box exactly as typed, keyed by box (completing the
   * square: vertex, axis, opens, extremumKind, extremumValue). Restored after a reload. The lines of a
   * line-by-line problem are the attempt's `steps`, and the line being typed is its `draft`.
   */
  polyEntries?: Record<string, string>
  /**
   * Polynomials, problems answered in several parts (synthetic division: top row, table, quotient and
   * remainder): how many parts have been checked right. Restored after a reload.
   */
  polyStage?: number
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
  /**
   * Guided mode, per line (keyed like `hintsUsed`, by step index): the cards were shown for that line. A line kept
   * after its cards were shown counts as picked however she entered it, as a line kept after "Show the step" counts
   * as shown. Not cleared by undo. Absent on attempts from before Guided mode.
   */
  picks?: Record<string, LinePicks>
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
      /** Guided mode: the line was picked from cards (or typed after its cards were shown). Absent: typed. */
      via?: 'card'
      /**
       * The step type, where a flow offers cards: what the path's step does, as the engine reads the move
       * ("power_rule+take_log"). Two right picks of one type since she last typed one make her type the next
       * (store/selectors.ts `typeThisTime`).
       */
      rule?: string
    })
  | (EvBase & {
      t: 'step_rejected'
      attemptId: string
      skill: string
      stepIdx: number
      pattern?: string
      /** Guided mode: a wrong card she picked (the pattern is its named mistake). */
      via?: 'card'
    })
  | (EvBase & { t: 'hint'; attemptId: string; skill: string; stepIdx: number; rung: 1 | 2 | 3 })
  | (EvBase & { t: 'step_undone'; attemptId: string; skill: string; stepIdx: number })
  | (EvBase & {
      t: 'final_answer'
      attemptId: string
      skill: string
      correct: boolean
      pattern?: string
      via?: 'builder' | 'text'
      /**
       * Which box of a check that grades several boxes each time (the inequality's "Interval" and "Set-builder"), so
       * the rewards pay a box once. Absent: one check is one part (the parts flows check one part at a time).
       */
      part?: string
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
      /**
       * Guided mode: how many of its lines were picked from cards. Any: the problem stays out of the mastery window
       * and the rings, as a timed one does (its XP and its mistake cards still count). Absent: none.
       */
      picked?: number
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
// pct.rewards (what the 60-day compaction would take from the rewards; see store/rewards.ts)
// ---------------------------------------------------------------------------

/** A day she met her daily goal: 1 the goal, 2 twice the goal (which mends the day before). */
export type DayMark = 1 | 2

/** A named mistake in one problem type, as of `RewardsState.foldedThrough`. */
export interface MistakeCardState {
  /** Catalog pattern id. */
  pattern: string
  /** Problem type (skill) it was made in. */
  skill: string
  /** Times she made it. */
  count: number
  firstAt: number
  lastAt: number
  /** Attempt of the latest time: finishing that attempt never counts as a clean problem. */
  lastAttempt: string
  /** Finished problems of this type since the latest time, without this mistake (three squash it). */
  clean: number
  /** When it was first squashed: the +50 XP is paid once. */
  squashedAt?: number
}

export interface RewardsState {
  /** Local days ('YYYY-MM-DD') she met her goal. Never lowered: raising the goal does not undo a day. */
  days: Record<string, DayMark>
  /** Days up to and including this one are settled: `days` alone says how they went. '' = none yet. */
  settledThrough: string
  /** Events before this time (epoch ms) are folded into `cards` and `mastered` (the compaction deletes them). */
  foldedThrough: number
  /** Mistake cards folded from compacted events, by `${pattern}|${skill}`. */
  cards: Record<string, MistakeCardState>
  /** Problem types first mastered before `foldedThrough`: when (the +100 XP is paid once). */
  mastered: Record<string, number>
  /**
   * Streak milestones (7, 30, 100 days) already celebrated, so each celebration happens once (store/milestones.ts).
   * Absent: none yet (a slice or a backup from before the celebrations).
   */
  milestones?: number[]
}

export function emptyRewards(): RewardsState {
  return { days: {}, settledThrough: '', foldedThrough: 0, cards: {}, mastered: {} }
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
  rewards: RewardsState
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
    rewards: emptyRewards(),
  }
}
