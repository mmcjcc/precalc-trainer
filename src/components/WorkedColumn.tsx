import type { ReactNode } from 'react'
import { toLatex } from '@/notation'
import { CHIP_LABEL } from '@/shared/types'
import type { AttemptStep } from '@/store'
import { Katex } from './Katex'

type Props = {
  /** First line placed in the column (null for answer-only kinds). */
  start: string | null
  steps: AttemptStep[]
  onUndo?: () => void
  canUndo?: boolean
  /** Rendered under the last accepted step (chip prompt / chip note). */
  afterLast?: ReactNode
  /** Row label for the start line. */
  startLabel?: string
}

function tex(text: string): string {
  try {
    return toLatex(text)
  } catch {
    return ''
  }
}

/**
 * The worked column: numbered accepted lines with ✓ + the word, a "revealed" tag for rung-3 lines,
 * the property she named, and Undo on the last row only (UX-15).
 */
export function WorkedColumn({ start, steps, onUndo, canUndo = false, afterLast, startLabel = 'start' }: Props) {
  return (
    <ol className="space-y-2" aria-label="Worked steps">
      {start !== null && (
        <li className="flex items-start gap-3 rounded-xl border border-navy-100 bg-navy-50 px-3 py-2">
          <span className="mt-1 w-6 shrink-0 text-xs font-semibold uppercase tracking-wide text-navy/50">{startLabel}</span>
          <div className="min-w-0 flex-1 overflow-x-auto text-navy">
            <Katex tex={tex(start)} />
          </div>
        </li>
      )}
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <li key={`${s.idx}-${s.text}`} className="rounded-xl border border-navy-100 bg-white px-3 py-2">
            <div className="flex items-start gap-3">
              <span className="mt-1 w-6 shrink-0 text-sm text-navy/50">{i + 1}</span>
              <div className="min-w-0 flex-1 overflow-x-auto text-navy">
                <Katex tex={s.latex || tex(s.text)} />
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {s.revealed && <span className="rounded-full bg-gold-100 px-2 py-0.5 text-gold-text">revealed</span>}
                  {s.chip && (
                    <span className={`rounded-full px-2 py-0.5 ${s.property === 'correct' ? 'bg-ok-100 text-ok' : 'bg-navy-100 text-navy'}`}>
                      {s.property === 'correct' ? '✓ ' : ''}
                      {CHIP_LABEL[s.chip]}
                    </span>
                  )}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-ok">
                <span aria-hidden>✓</span>
                <span className="sr-only">accepted</span>
              </span>
              {last && canUndo && onUndo && (
                <button
                  type="button"
                  onClick={onUndo}
                  className="min-h-11 shrink-0 rounded-lg border border-navy-100 px-2 text-xs font-semibold text-navy hover:bg-navy-50"
                  aria-label={`Undo step ${i + 1}`}
                >
                  Undo
                </button>
              )}
            </div>
            {last && afterLast && <div className="mt-2">{afterLast}</div>}
          </li>
        )
      })}
    </ol>
  )
}
