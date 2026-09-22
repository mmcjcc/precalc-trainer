/**
 * The monitoring log: every question and answer, and every flag, as one JSON object per line in
 * TUTOR_LOG_DIR/tutor-YYYY-MM.jsonl (one file per month, months by TUTOR_TIMEZONE). On Azure the
 * directory is an Azure Files share, so the log survives restarts and the parent can download it.
 * Without a directory everything stays in memory (and the status endpoint says so).
 *
 * Records never contain an API key, request headers, or a provider's error body: a failed answer
 * carries a short error code only.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  TutorAnswerStatus,
  TutorFlag,
  TutorFlagReason,
  TutorLogItem,
  TutorProviderName,
} from '../../src/shared/tutor.ts'

export interface AskRecord {
  type: 'ask'
  v: 1
  id: string
  at: string
  /** Local day (TUTOR_TIMEZONE) the question was answered on: the daily limit counts by it. */
  day: string
  user: string
  problemId: string
  attemptId?: string
  moduleId: string
  kind: string
  question: string
  answer: string
  status: TutorAnswerStatus
  counted: boolean
  finished: boolean
  revealed: boolean
  verdict?: string
  mistake?: string
  provider: TutorProviderName
  model: string
  ms: number
  truncated?: boolean
  /** Short code for a failure ("rate_limited", "http_503", "network"...). Never an error body. */
  error?: string
}

export interface FlagRecord {
  type: 'flag'
  v: 1
  at: string
  day: string
  /** Log id of the answer being flagged. */
  id: string
  by: string
  reason: TutorFlagReason
  note?: string
}

export type LogRecord = AskRecord | FlagRecord

/** "2026-09-21" for `date` in `timeZone`. */
export function localDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function monthFile(day: string): string {
  return `tutor-${day.slice(0, 7)}.jsonl`
}

function previousMonth(day: string): string {
  const y = Number(day.slice(0, 4))
  const m = Number(day.slice(5, 7))
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  return `${py}-${String(pm).padStart(2, '0')}-01`
}

function isRecord(x: unknown): x is LogRecord {
  if (typeof x !== 'object' || x === null) return false
  const r = x as { type?: unknown; id?: unknown; day?: unknown }
  return (r.type === 'ask' || r.type === 'flag') && typeof r.id === 'string' && typeof r.day === 'string'
}

export interface TutorLogOptions {
  dir: string | null
  timeZone: string
  now?: () => Date
  /** Ask records kept in memory (newest win). */
  maxItems?: number
  /** Called with a short code when a write fails (the answer itself still goes out). */
  onWriteError?: (code: string) => void
}

export class TutorLog {
  readonly logging: 'file' | 'memory'
  private readonly dir: string | null
  private readonly timeZone: string
  private readonly now: () => Date
  private readonly maxItems: number
  private readonly onWriteError: (code: string) => void
  private asks: AskRecord[] = []
  private flags = new Map<string, TutorFlag[]>()
  private writing: Promise<void> = Promise.resolve()
  /** Unparseable lines skipped while loading (a torn write at a crash). */
  skippedLines = 0

  constructor(opts: TutorLogOptions) {
    this.dir = opts.dir
    this.logging = opts.dir ? 'file' : 'memory'
    this.timeZone = opts.timeZone
    this.now = opts.now ?? (() => new Date())
    this.maxItems = opts.maxItems ?? 2000
    this.onWriteError = opts.onWriteError ?? (() => {})
  }

  today(): string {
    return localDay(this.now(), this.timeZone)
  }

  /**
   * Creates the directory, proves it is writable (a real append, which also works on an SMB mount
   * where access() can be optimistic), then loads this month and last month. Throws when the
   * directory can't be written: the caller exits, because a tutor that can't keep its log is off.
   */
  async init(): Promise<void> {
    if (!this.dir) return
    await mkdir(this.dir, { recursive: true })
    const today = this.today()
    await appendFile(join(this.dir, monthFile(today)), '', { mode: 0o640 })
    for (const day of [previousMonth(today), today]) {
      let text: string
      try {
        text = await readFile(join(this.dir, monthFile(day)), 'utf8')
      } catch {
        continue // last month may not exist
      }
      for (const line of text.split('\n')) {
        if (!line.trim()) continue
        let parsed: unknown
        try {
          parsed = JSON.parse(line)
        } catch {
          this.skippedLines++
          continue
        }
        if (isRecord(parsed)) this.remember(parsed)
        else this.skippedLines++
      }
    }
  }

  private remember(r: LogRecord): void {
    if (r.type === 'ask') {
      this.asks.push(r)
      if (this.asks.length > this.maxItems) {
        const dropped = this.asks.splice(0, this.asks.length - this.maxItems)
        for (const d of dropped) this.flags.delete(d.id)
      }
    } else if (this.asks.some((a) => a.id === r.id)) {
      const list = this.flags.get(r.id) ?? []
      list.push({ at: r.at, by: r.by, reason: r.reason, ...(r.note ? { note: r.note } : {}) })
      this.flags.set(r.id, list)
    }
  }

  /** Keeps the record in memory and appends it to this month's file (writes are serialized). */
  append(r: LogRecord): Promise<void> {
    this.remember(r)
    if (!this.dir) return Promise.resolve()
    const file = join(this.dir, monthFile(r.day))
    const line = JSON.stringify(r) + '\n'
    this.writing = this.writing
      .then(() => appendFile(file, line, { mode: 0o640 }))
      .catch((err: unknown) => {
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : 'write_failed'
        this.onWriteError(code)
      })
    return this.writing
  }

  find(id: string): AskRecord | undefined {
    for (let i = this.asks.length - 1; i >= 0; i--) if (this.asks[i].id === id) return this.asks[i]
    return undefined
  }

  /** Counted questions per user on `day` (seeds the daily limit after a restart). */
  countsFor(day: string): Map<string, number> {
    const out = new Map<string, number>()
    for (const a of this.asks) if (a.counted && a.day === day) out.set(a.user, (out.get(a.user) ?? 0) + 1)
    return out
  }

  /**
   * Her last `limit` answered questions on this attempt (or, without an attempt id, on this problem
   * today), oldest first. The server replays them so a follow-up question has its thread.
   */
  history(user: string, problemId: string, attemptId: string | undefined, limit: number): AskRecord[] {
    const today = this.today()
    const out: AskRecord[] = []
    for (let i = this.asks.length - 1; i >= 0 && out.length < limit; i--) {
      const a = this.asks[i]
      if (a.user !== user || a.status !== 'ok' || !a.answer || a.problemId !== problemId) continue
      if (attemptId ? a.attemptId !== attemptId : a.day !== today) continue
      out.push(a)
    }
    return out.reverse()
  }

  /** Newest first, with flags attached. */
  recent(limit: number): TutorLogItem[] {
    const out: TutorLogItem[] = []
    for (let i = this.asks.length - 1; i >= 0 && out.length < limit; i--) {
      const a = this.asks[i]
      out.push({
        id: a.id,
        at: a.at,
        user: a.user,
        problemId: a.problemId,
        moduleId: a.moduleId,
        question: a.question,
        answer: a.answer,
        status: a.status,
        counted: a.counted,
        finished: a.finished,
        revealed: a.revealed,
        provider: a.provider,
        model: a.model,
        ...(a.verdict ? { verdict: a.verdict } : {}),
        ...(a.mistake ? { mistake: a.mistake } : {}),
        flags: this.flags.get(a.id) ?? [],
      })
    }
    return out
  }

  /** Resolves when every queued write has finished (tests, shutdown). */
  flush(): Promise<void> {
    return this.writing
  }
}
