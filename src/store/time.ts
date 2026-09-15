/** Local-time calendar helpers (ISO weeks, day keys). Pure. */

const DAY_MS = 86_400_000

function localMidnight(ms: number): Date {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Monday-based weekday index: Mon = 0 … Sun = 6. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

/** 'YYYY-Www' ISO week key for a local timestamp. */
export function isoWeekKey(ms: number): string {
  const d = localMidnight(ms)
  // ISO week number = week containing this date's Thursday.
  const thursday = new Date(d)
  thursday.setDate(d.getDate() - mondayIndex(d) + 3)
  const isoYear = thursday.getFullYear()
  const jan4 = new Date(isoYear, 0, 4)
  const firstThursday = new Date(jan4)
  firstThursday.setDate(jan4.getDate() - mondayIndex(jan4) + 3)
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}

/** Epoch ms of local Monday 00:00 of the ISO week containing `ms`. */
export function startOfIsoWeek(ms: number): number {
  const d = localMidnight(ms)
  d.setDate(d.getDate() - mondayIndex(d))
  return d.getTime()
}

/** 'YYYY-MM-DD' in local time. */
export function dayKey(ms: number): string {
  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole local days from dayKey `a` to dayKey `b` (b − a). */
export function daysBetweenKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = new Date(ay ?? 0, (am ?? 1) - 1, ad ?? 1)
  const db = new Date(by ?? 0, (bm ?? 1) - 1, bd ?? 1)
  return Math.round((db.getTime() - da.getTime()) / DAY_MS)
}

/** Whole local days between two timestamps (later − earlier, floored at 0). */
export function daysAgo(ms: number, now = Date.now()): number {
  return Math.max(0, daysBetweenKeys(dayKey(ms), dayKey(now)))
}

/** "today" / "yesterday" / "3 days ago" / "2 weeks ago" / "5 months ago". */
export function relativeDays(ms: number, now = Date.now()): string {
  const n = daysAgo(ms, now)
  if (n === 0) return 'today'
  if (n === 1) return 'yesterday'
  if (n < 14) return `${n} days ago`
  if (n < 60) return `${Math.round(n / 7)} weeks ago`
  return `${Math.round(n / 30)} months ago`
}

export const SIXTY_DAYS_MS = 60 * DAY_MS
