import { useId } from 'react'
import { Link } from 'react-router-dom'
import type { SetSlotStatus } from '@/session/activeSet'
import { SetDots } from './SetProgress'

/** "3 problems, about 5 minutes": a clean problem takes her one to two minutes. */
export function setLengthWords(count: number): string {
  const minutes = Math.max(2, Math.round((count * 5) / 3))
  return `${count} ${count === 1 ? 'problem' : 'problems'}, about ${minutes} minutes`
}

/**
 * Home's main action: one big "Start a set" with how long a set is under it. It builds a set from the class selected
 * on Home (pages/set/startSet.ts). It takes the width it is given; the page decides how wide that is.
 */
export function StartSetButton({ count, onStart }: { count: number; onStart: () => void }) {
  const lineId = useId()
  return (
    <div className="space-y-1.5" data-start-set="">
      <button
        type="button"
        onClick={onStart}
        aria-describedby={lineId}
        data-primary-action=""
        className="btn-chunky flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy px-4 text-lg font-semibold text-white hover:bg-navy-600"
      >
        Start a set <span aria-hidden>→</span>
      </button>
      <p id={lineId} className="text-center text-sm text-navy/80">
        {setLengthWords(count)}
      </p>
    </div>
  )
}

/**
 * "Resume your set · 2 of 3": the set she left, with its dots. `primary` gives its link the filled style; a phone's
 * Home keeps that for "Start a set" alone.
 */
export function ResumeSetCard({
  position,
  total,
  status,
  primary,
}: {
  /** The problem she will see, 1-based. */
  position: number
  total: number
  status: readonly SetSlotStatus[]
  primary: boolean
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-gold bg-gold-100 p-4" data-resume-set="">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Pick up where you left off</p>
      <h2 id={titleId} className="mt-1 text-lg font-semibold text-navy">
        Your set
      </h2>
      <div className="mt-1">
        <SetDots index={position - 1} total={total} status={status} />
      </div>
      <Link
        to="/set"
        className={`mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-4 font-semibold ${
          primary ? 'bg-navy text-white hover:bg-navy-600' : 'border border-navy-100 bg-white text-navy hover:bg-navy-50'
        }`}
      >
        Resume your set · {position} of {total} <span aria-hidden>→</span>
      </Link>
    </section>
  )
}
