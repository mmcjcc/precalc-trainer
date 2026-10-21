/** Export/import of progress as JSON (she uses a phone AND a desktop). Pure. */
import { isDailyGoal, mergeRewards, normalizeRewards } from './rewards'
import {
  DEFAULT_SETTINGS,
  EMPTY_STREAK,
  SCHEMA_VERSION,
  emptyRewards,
  type Ev,
  type PersistedState,
  type RewardsState,
  type Settings,
  type Streak,
  type Weekly,
  type WeeklySkill,
} from './types'

/** Written on every new export. */
export const BACKUP_APP_ID = 'math-science-trainer'
/** Accepted on import so a file saved under the old name still loads. */
export const LEGACY_BACKUP_APP_ID = 'precalc-trainer'

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  settings: Settings
  events: Ev[]
  weekly: Weekly
  streak: Streak
  /** The rewards' slice (days met, folded mistake cards and masteries). Absent in a file from before the rewards. */
  rewards: RewardsState
}

export function buildBackup(
  state: Pick<PersistedState, 'settings' | 'events' | 'weekly' | 'streak'> & { rewards?: RewardsState },
  now = Date.now(),
): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    settings: state.settings,
    events: state.events,
    weekly: state.weekly,
    streak: state.streak,
    rewards: state.rewards ?? emptyRewards(),
  }
}

export type ImportMode = 'merge' | 'replace'

export type ImportResult =
  | { ok: true; events: Ev[]; weekly: Weekly; streak: Streak; rewards: RewardsState; settings: Settings; added: number }
  | { ok: false; error: string }

/**
 * Settings from storage or a backup. Unknown or missing fields fall back to defaults.
 * `courseId` and `unitByCourse` are optional: a save from before classes existed loads without them.
 */
export function normalizeSettings(raw: unknown): Settings {
  const src = isRecord(raw) ? raw : {}
  const settings: Settings = { ...DEFAULT_SETTINGS }
  if (src.calculator === 'ti84' || src.calculator === 'nspire') settings.calculator = src.calculator
  if (src.askProperty === 'always' || src.askProperty === 'off') settings.askProperty = src.askProperty
  if (typeof src.testMode === 'boolean') settings.testMode = src.testMode
  if (typeof src.seenA2HS === 'boolean') settings.seenA2HS = src.seenA2HS
  if (typeof src.courseId === 'string' && src.courseId.length > 0) settings.courseId = src.courseId
  if (typeof src.mathKeypad === 'boolean') settings.mathKeypad = src.mathKeypad
  if (typeof src.rewards === 'boolean') settings.rewards = src.rewards
  if (isDailyGoal(src.dailyGoal)) settings.dailyGoal = src.dailyGoal
  if (typeof src.vibrate === 'boolean') settings.vibrate = src.vibrate
  if (typeof src.sounds === 'boolean') settings.sounds = src.sounds
  if (src.lineEntry === 'type' || src.lineEntry === 'pick') settings.lineEntry = src.lineEntry
  if (typeof src.seenStepGuide === 'boolean') settings.seenStepGuide = src.seenStepGuide
  if (isRecord(src.unitByCourse)) {
    const unitByCourse: Record<string, string> = {}
    for (const [key, value] of Object.entries(src.unitByCourse)) {
      if (key.length > 0 && typeof value === 'string' && value.length > 0) unitByCourse[key] = value
    }
    if (Object.keys(unitByCourse).length > 0) settings.unitByCourse = unitByCourse
  }
  return settings
}

/** Settings that belong to the device: an import keeps this device's value (or its absence, the default). */
const DEVICE_SETTINGS = ['mathKeypad', 'rewards', 'vibrate', 'sounds', 'lineEntry'] as const

/**
 * Settings after an import. Merge adds another device's work to this one, so this device keeps its
 * own settings and only takes a class or unit choice it does not have yet. Replace takes the file's
 * settings (the daily goal among them), except the ones that belong to the device or the moment: test mode
 * (imported silently, it would keep later practice out of the mastery bars), whether the add-to-home-screen
 * card was seen here, the math keypad (a phone's choice, which a backup from a computer must not undo), the
 * rewards, vibrate and sounds switches (the store app and the family web app start with rewards and sounds on and
 * off), and Guided mode's Type / Pick choice (picking is a phone's way to write lines).
 */
export function settingsAfterImport(current: Settings, imported: Settings, mode: ImportMode): Settings {
  if (mode === 'replace') {
    const next: Settings = { ...imported, testMode: current.testMode, seenA2HS: current.seenA2HS }
    if (current.seenStepGuide === undefined) delete next.seenStepGuide
    else next.seenStepGuide = current.seenStepGuide
    const keep = <K extends (typeof DEVICE_SETTINGS)[number]>(key: K) => {
      delete next[key]
      const mine = current[key]
      if (mine !== undefined) next[key] = mine
    }
    for (const key of DEVICE_SETTINGS) keep(key)
    return next
  }
  const next: Settings = { ...current }
  const courseId = current.courseId ?? imported.courseId
  if (courseId) next.courseId = courseId
  const unitByCourse = { ...imported.unitByCourse, ...current.unitByCourse }
  if (Object.keys(unitByCourse).length > 0) next.unitByCourse = unitByCourse
  return next
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isEvent(v: unknown): v is Ev {
  return isRecord(v) && typeof v.t === 'string' && typeof v.at === 'number'
}

function eventKey(e: Ev): string {
  // Stable key: sorted fields. Two events identical in every field are the same event.
  const rec = e as unknown as Record<string, unknown>
  return Object.keys(rec)
    .sort()
    .map((k) => `${k}=${JSON.stringify(rec[k])}`)
    .join('|')
}

function mergeWeeklySkill(a: WeeklySkill, b: WeeklySkill): WeeklySkill {
  // Without provenance, per-field max is the safe merge (never double-counts a re-imported backup).
  const patterns: Record<string, number> = { ...a.patterns }
  for (const [k, v] of Object.entries(b.patterns)) patterns[k] = Math.max(patterns[k] ?? 0, v)
  return {
    steps: Math.max(a.steps, b.steps),
    firstTry: Math.max(a.firstTry, b.firstTry),
    revealed: Math.max(a.revealed, b.revealed),
    hints: Math.max(a.hints, b.hints),
    propAnswered: Math.max(a.propAnswered, b.propAnswered),
    propCorrect: Math.max(a.propCorrect, b.propCorrect),
    patterns,
    done: Math.max(a.done, b.done),
    abandoned: Math.max(a.abandoned, b.abandoned),
    drillAnswered: Math.max(a.drillAnswered ?? 0, b.drillAnswered ?? 0),
    drillCorrect: Math.max(a.drillCorrect ?? 0, b.drillCorrect ?? 0),
  }
}

export function mergeWeekly(a: Weekly, b: Weekly): Weekly {
  const out: Weekly = {}
  for (const [week, skills] of Object.entries(a)) out[week] = { ...skills }
  for (const [week, skills] of Object.entries(b)) {
    const target = (out[week] ??= {})
    for (const [skill, w] of Object.entries(skills)) target[skill] = target[skill] ? mergeWeeklySkill(target[skill], w) : w
  }
  return out
}

export function parseBackup(text: string): { ok: true; backup: BackupFile } | { ok: false; error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That is not valid JSON. Paste the whole export, from { to }.' }
  }
  if (!isRecord(raw) || (raw.app !== BACKUP_APP_ID && raw.app !== LEGACY_BACKUP_APP_ID)) {
    return { ok: false, error: `That file is not a Math & Science Trainer export (missing "app": "${BACKUP_APP_ID}").` }
  }
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `That export is from a newer version (schema ${raw.schemaVersion}); update this app first.` }
  }
  const events = Array.isArray(raw.events) ? raw.events.filter(isEvent) : []
  const weekly = isRecord(raw.weekly) ? (raw.weekly as Weekly) : {}
  const streak =
    isRecord(raw.streak) && typeof raw.streak.count === 'number' && typeof raw.streak.lastDay === 'string'
      ? { lastDay: raw.streak.lastDay, count: raw.streak.count }
      : { ...EMPTY_STREAK }
  return {
    ok: true,
    backup: {
      app: BACKUP_APP_ID,
      schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      settings: normalizeSettings(raw.settings),
      events,
      weekly,
      streak,
      rewards: normalizeRewards(raw.rewards),
    },
  }
}

/**
 * The progress after an import. Replace takes the file's; merge adds the file's events this device does not have,
 * and merges the weekly counters, the streak and the rewards' slice (the caller settles the rewards' days again
 * over the merged log).
 */
export function importBackup(
  current: Pick<PersistedState, 'events' | 'weekly' | 'streak'> & { rewards?: RewardsState },
  text: string,
  mode: ImportMode,
): ImportResult {
  const parsed = parseBackup(text)
  if (!parsed.ok) return parsed
  const b = parsed.backup
  if (mode === 'replace') {
    return {
      ok: true,
      events: b.events.slice().sort((x, y) => x.at - y.at),
      weekly: b.weekly,
      streak: b.streak,
      rewards: b.rewards,
      settings: b.settings,
      added: b.events.length,
    }
  }
  const seen = new Set(current.events.map(eventKey))
  let added = 0
  const events = current.events.slice()
  for (const e of b.events) {
    const k = eventKey(e)
    if (seen.has(k)) continue
    seen.add(k)
    events.push(e)
    added += 1
  }
  events.sort((x, y) => x.at - y.at)
  const streak = b.streak.lastDay > current.streak.lastDay ? b.streak : current.streak
  const rewards = mergeRewards(current.rewards ?? emptyRewards(), b.rewards)
  return { ok: true, events, weekly: mergeWeekly(current.weekly, b.weekly), streak, rewards, settings: b.settings, added }
}
