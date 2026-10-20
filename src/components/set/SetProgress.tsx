import { useCallback, useState } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import type { SetSlotStatus } from '@/session/activeSet'

type DotState = 'done' | 'skipped' | 'current' | 'todo'

/** Shape and size differ, not only color: a check for done, a dashed ring for skipped, a big gold dot for hers now. */
const DOT: Record<DotState, string> = {
  done: 'flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-bold leading-none text-white',
  current: 'h-5 w-5 rounded-full border-2 border-navy bg-gold',
  skipped: 'h-4 w-4 rounded-full border-2 border-dashed border-navy/60 bg-white',
  todo: 'h-4 w-4 rounded-full border-2 border-navy/30 bg-white',
}

/**
 * The set's progress: one dot per problem (done, skipped, hers now, to do) and "2 of 3". Screen readers hear
 * "Problem 2 of 3 in your set" once. The problem screen places it: the phone's compact header, the completion area on
 * a wide screen.
 */
export function SetDots({ index, total, status, prefix }: { index: number; total: number; status: readonly SetSlotStatus[]; prefix?: string }) {
  const position = Math.min(index, total - 1) + 1
  return (
    <div className="flex min-w-0 items-center gap-2" data-set-progress="">
      <span className="sr-only">
        Problem {position} of {total} in your set
      </span>
      <span aria-hidden className="flex shrink-0 items-center gap-1.5">
        {status.map((s, i) => {
          const state: DotState = s === 'done' ? 'done' : s === 'skipped' ? 'skipped' : i === index ? 'current' : 'todo'
          return (
            <span key={i} data-set-dot={state} className={DOT[state]}>
              {state === 'done' ? '✓' : null}
            </span>
          )
        })}
      </span>
      <span aria-hidden className="truncate text-sm font-semibold text-navy">
        {prefix ? `${prefix} ` : ''}
        {position} of {total}
      </span>
    </div>
  )
}

/**
 * Skipping the problem she is on, asked in a small sheet: a ⋯ button in the phone's header, a text button on a wide
 * screen. A skipped problem counts as skipped, not as wrong.
 */
export function SetSkipMenu({
  index,
  total,
  onSkip,
  trigger,
}: {
  index: number
  total: number
  onSkip: () => void
  trigger: 'icon' | 'text'
}) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const last = index >= total - 1
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={trigger === 'icon' ? 'Set options' : undefined}
        className={
          trigger === 'icon'
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-navy hover:bg-navy-50'
            : 'min-h-11 shrink-0 rounded-xl border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50'
        }
      >
        {trigger === 'icon' ? (
          <span aria-hidden className="text-2xl leading-none">
            ⋯
          </span>
        ) : (
          'Skip this problem…'
        )}
      </button>
      <BottomSheet open={open} onClose={close} title={`Your set · problem ${index + 1} of ${total}`}>
        <div className="space-y-3 text-navy">
          <p>
            Skip this problem? It counts as skipped, not as wrong.{' '}
            {last ? 'It is the last one, so your results come next.' : 'The set goes on to the next one.'}
          </p>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={close} className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
              Keep going
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onSkip()
              }}
              className="min-h-12 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
            >
              Skip this problem
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
