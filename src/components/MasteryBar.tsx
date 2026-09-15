import { relativeDays } from '@/store/time'

type Props = {
  /** 0..1 or null when never practiced. */
  rate: number | null
  mastered?: boolean
  /** Completed attempts in the rolling window (shown as "3 of 5"). */
  count?: number
  window?: number
  label: string
  lastAt?: number | null
  compact?: boolean
  /** Override the status words (e.g. module cards: "72% first-try · 1 of 4 types mastered"). */
  status?: string
  /** Override the progressbar's aria-valuetext. */
  valueText?: string
}

/**
 * Mastery bar: rolling last-5 first-try rate. Three signals, never color alone:
 * the bar, the number, and the word ("mastered" / "3 of 5 done").
 */
export function MasteryBar({
  rate,
  mastered = false,
  count = 0,
  window = 5,
  label,
  lastAt,
  compact = false,
  status,
  valueText,
}: Props) {
  const pct = rate === null ? 0 : Math.round(rate * 100)
  const words =
    status ??
    (mastered ? 'mastered' : rate === null ? 'not started' : count < window ? `${pct}% · ${count} of ${window} done` : `${pct}%`)
  const fill = mastered ? 'bg-ok' : 'bg-navy'
  const aria =
    valueText ??
    (rate === null ? 'not started' : `${pct}% first-try over the last ${count} of ${window} problems${mastered ? ', mastered' : ''}`)
  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="font-medium text-navy">{label}</span>
        <span className="flex items-center gap-1 text-navy/80">
          {mastered && (
            <span aria-hidden className="text-ok">
              ✓
            </span>
          )}
          <span>{words}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rate === null ? undefined : pct}
        aria-valuetext={aria}
        className="h-2 w-full overflow-hidden rounded-full bg-navy-100"
      >
        <div className={`h-full rounded-full ${fill} transition-[width]`} style={{ width: `${pct}%` }} />
      </div>
      {!compact && lastAt != null && <p className="text-xs text-navy/70">last practiced {relativeDays(lastAt)}</p>}
    </div>
  )
}
