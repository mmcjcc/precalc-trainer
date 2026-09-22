import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TutorLogItem } from '@/shared/tutor'
import { fetchTutorLog } from '@/tutor/api'
import { useTutorStatus } from '@/tutor/useTutorStatus'

const PARENT_ONLY = 'This page is for a parent.'

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function LogCard({ item }: { item: TutorLogItem }) {
  return (
    <article className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4">
      <p className="text-sm text-navy/70">
        <time dateTime={item.at}>{formatWhen(item.at)}</time>
        {item.status !== 'ok' && <span className="ml-2 font-semibold text-navy">· {item.status}</span>}
      </p>
      <p className="text-sm font-semibold text-navy">
        {item.moduleId} · <span className="font-mono font-normal">{item.problemId}</span>
      </p>
      <p className="whitespace-pre-wrap text-sm text-navy">
        <span className="font-semibold">Question: </span>
        {item.question}
      </p>
      <p className="whitespace-pre-wrap text-sm text-navy">
        <span className="font-semibold">Answer: </span>
        {item.answer || '—'}
      </p>
      {item.flags.length > 0 && (
        <ul className="space-y-1 text-sm text-navy">
          {item.flags.map((flag, index) => (
            <li key={`${flag.at}-${index}`} className="rounded-xl bg-gold-100 px-3 py-2">
              <span className="font-semibold">Flag ({flag.reason})</span>
              {flag.note ? `: ${flag.note}` : ''}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

/** Parent-only list of tutor questions. Anyone else sees a one-line refusal. */
export function TutorLogPage() {
  const tutor = useTutorStatus()
  const status = tutor.status
  const [phase, setPhase] = useState<'wait' | 'ready' | 'empty' | 'down'>('wait')
  const [items, setItems] = useState<TutorLogItem[]>([])
  const [memory, setMemory] = useState(false)

  useEffect(() => {
    if (!status?.isParent) return
    const ac = new AbortController()
    let live = true
    void fetchTutorLog(ac.signal).then((result) => {
      if (!live) return
      if (!result.ok) {
        setPhase('down')
        return
      }
      setItems(result.items)
      setMemory(result.logging === 'memory')
      setPhase(result.items.length === 0 ? 'empty' : 'ready')
    })
    return () => {
      live = false
      ac.abort()
    }
  }, [status])

  if (!tutor.ready) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-navy">Tutor log</h1>
        <p role="status" className="mt-3 text-navy/70">
          Loading…
        </p>
      </div>
    )
  }
  if (!status?.isParent) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-navy">Tutor log</h1>
        <p className="mt-3 text-navy">{PARENT_ONLY}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold text-navy">Tutor log</h1>
        <p className="text-sm text-navy/80">Newest first. Flagged answers are marked for you to look over.</p>
        {memory && <p className="text-sm text-navy/70">This log is cleared when the tutor restarts.</p>}
      </header>
      {phase === 'wait' && (
        <p role="status" className="text-navy/70">
          Loading…
        </p>
      )}
      {phase === 'down' && <p className="text-navy">The tutor log isn't available right now.</p>}
      {phase === 'empty' && <p className="text-navy">No tutor questions yet.</p>}
      {phase === 'ready' && (
        <div className="space-y-3">
          {items.map((item) => (
            <LogCard key={item.id} item={item} />
          ))}
        </div>
      )}
      <Link to="/settings" className="inline-flex min-h-11 items-center font-semibold text-navy underline">
        Back to Settings
      </Link>
    </div>
  )
}
