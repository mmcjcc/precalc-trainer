/** Export/import of progress as JSON (she uses a phone AND a desktop). Pure. */
import { EMPTY_STREAK, SCHEMA_VERSION, type Ev, type PersistedState, type Settings, type Streak, type Weekly, type WeeklySkill } from './types'

export interface BackupFile {
  app: 'precalc-trainer'
  schemaVersion: number
  exportedAt: string
  settings: Settings
  events: Ev[]
  weekly: Weekly
  streak: Streak
}

export function buildBackup(state: Pick<PersistedState, 'settings' | 'events' | 'weekly' | 'streak'>, now = Date.now()): BackupFile {
  return {
    app: 'precalc-trainer',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date(now).toISOString(),
    settings: state.settings,
    events: state.events,
    weekly: state.weekly,
    streak: state.streak,
  }
}

export type ImportMode = 'merge' | 'replace'

export type ImportResult =
  | { ok: true; events: Ev[]; weekly: Weekly; streak: Streak; settings?: Settings; added: number }
  | { ok: false; error: string }

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
  if (!isRecord(raw) || raw.app !== 'precalc-trainer') {
    return { ok: false, error: 'That file is not a Precalc Trainer export (missing "app": "precalc-trainer").' }
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
  const settings = isRecord(raw.settings) ? (raw.settings as unknown as Settings) : undefined
  return {
    ok: true,
    backup: {
      app: 'precalc-trainer',
      schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 1,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
      settings: settings ?? ({} as Settings),
      events,
      weekly,
      streak,
    },
  }
}

export function importBackup(
  current: Pick<PersistedState, 'events' | 'weekly' | 'streak'>,
  text: string,
  mode: ImportMode,
): ImportResult {
  const parsed = parseBackup(text)
  if (!parsed.ok) return parsed
  const b = parsed.backup
  if (mode === 'replace') {
    return { ok: true, events: b.events.slice().sort((x, y) => x.at - y.at), weekly: b.weekly, streak: b.streak, added: b.events.length }
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
  return { ok: true, events, weekly: mergeWeekly(current.weekly, b.weekly), streak, added }
}
