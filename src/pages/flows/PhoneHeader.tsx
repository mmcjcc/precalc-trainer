import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProgressLine } from '@/problem/stepEngine'
import type { SetSlotStatus } from '@/session/activeSet'
import { SetDots, SetSkipMenu } from '@/components/set/SetProgress'

/** Words that carry no meaning of their own in an instruction ("Find the …", "Write it in …"). */
const FILLER = new Set(
  'a an the of to in on at for and or but nor so as by with from into onto it its this that these those then than each every all any your you yours be is are was were do does did can may must should will one find give write type solve answer show work out'.split(' '),
)

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean)
}

/** "parts" and "part", "graphs" and "graph" are the same word here. */
const stem = (w: string) => (w.length > 3 ? w.replace(/(?:es|s)$/, '') : w)

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[^\s a-z])/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * The instructions without what the title already says: a sentence stays when it has a word the title does not
 * ("from the table", "in interval notation"); one that only repeats the title ("Find (g − f)(x).") goes. Empty when
 * nothing is left.
 */
export function extraInstructions(title: string, instructions: string): string {
  const known = new Set(words(title).map(stem))
  return sentences(instructions)
    .filter((s) => words(s).some((w) => !FILLER.has(w) && !known.has(stem(w))))
    .join(' ')
}

/** More dots than this read as noise on a phone: the count is written out instead. */
const MAX_DOTS = 10

/**
 * Progress as dots: one per step or part, done (filled), current (gold, ringed), to do (hollow); shape and size
 * differ, not only color. Screen readers hear the same words as the wide layout's progress line.
 */
export function ProgressDots({ progress }: { progress: ProgressLine }) {
  const total = Math.max(0, progress.total)
  const done = Math.min(Math.max(0, progress.stage), total)
  const spoken = `stage ${progress.stage} of ${progress.total} · ${progress.label}`
  return (
    <div className="flex shrink-0 items-center gap-1" aria-live="polite">
      <span className="sr-only">{spoken}</span>
      {total > 0 && total <= MAX_DOTS &&
        Array.from({ length: total }, (_, i) => {
          const state = i < done ? 'done' : i === done ? 'current' : 'todo'
          return (
            <span
              key={i}
              aria-hidden
              data-dot={state}
              className={
                state === 'done'
                  ? 'h-2.5 w-2.5 rounded-full bg-navy'
                  : state === 'current'
                    ? 'h-3.5 w-3.5 rounded-full border-2 border-navy bg-gold'
                    : 'h-2.5 w-2.5 rounded-full border-2 border-navy/30 bg-white'
              }
            />
          )
        })}
      {total > MAX_DOTS && (
        <span aria-hidden className="text-xs font-semibold text-navy/70">
          {done}/{total}
        </span>
      )}
    </div>
  )
}

/** A set's row in the phone header: its progress, and the ⋯ menu that skips the problem. */
export interface PhoneHeaderSet {
  /** The slot she is on (0-based). */
  index: number
  total: number
  status: readonly SetSlotStatus[]
  /** Skip the problem she is on; absent once it is finished. */
  onSkip?: () => void
}

/**
 * The phone's problem header: one row with a close button (back to the module page), the title on one line, and
 * the progress dots; then the instructions as one short line, only when they add to the title (a tap shows all
 * of them). In a set, a row above it carries the close button, the set's dots ("2 of 3") and the ⋯ menu (Skip).
 */
export function PhoneHeader({
  title,
  instructions,
  closeTo,
  closeLabel,
  progress,
  set,
}: {
  title: string
  instructions: string
  closeTo: string
  closeLabel: string
  progress?: ProgressLine | null
  set?: PhoneHeaderSet
}) {
  const [open, setOpen] = useState(false)
  const extra = extraInstructions(title, instructions)
  const close = (
    <Link
      to={closeTo}
      aria-label={closeLabel}
      className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-navy hover:bg-navy-50"
    >
      <span aria-hidden className="text-2xl leading-none">
        ×
      </span>
    </Link>
  )
  return (
    <div className="space-y-1">
      {set && (
        <div className="flex items-center gap-2" data-set-header="">
          {close}
          <div className="min-w-0 flex-1">
            <SetDots index={set.index} total={set.total} status={set.status} />
          </div>
          {set.onSkip && <SetSkipMenu index={set.index} total={set.total} onSkip={set.onSkip} trigger="icon" />}
        </div>
      )}
      <div className="flex items-center gap-2">
        {!set && close}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-navy">{title}</h1>
        {progress && <ProgressDots progress={progress} />}
      </div>
      {extra && (
        // Visually one line; a tap unfolds it. Screen readers always get the whole text (the clamp is CSS only).
        <p onClick={() => setOpen((o) => !o)} className={`cursor-pointer text-sm text-navy/80 ${open ? '' : 'truncate'}`} data-instructions="">
          {extra}
        </p>
      )}
    </div>
  )
}
