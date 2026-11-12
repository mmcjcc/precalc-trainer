import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { TutorLogItem, TutorUsageDay } from '@/shared/tutor'
import { fetchTutorLog } from '@/tutor/api'
import { useTutorStatus } from '@/tutor/useTutorStatus'

const PARENT_ONLY = 'This page is for a parent.'

function formatWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function count(n: number): string {
  return n.toLocaleString('en-US')
}

/** Most days shown in the token table; the log itself holds this month and last. */
const DAYS_SHOWN = 14

/**
 * What the AI provider counted, by day and model: the number its bill is made of. Shown to the parent
 * so the cost of the tutor is known from real use before it is offered more widely.
 */
function TokenDays({ days }: { days: readonly TutorUsageDay[] }) {
  if (days.length === 0) return null
  const shown = days.slice(0, DAYS_SHOWN)
  return (
    <section aria-labelledby="tokens-heading" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4">
      <h2 id="tokens-heading" className="font-semibold text-navy">
        Tokens by day
      </h2>
      <p className="text-sm text-navy/70">
        What the AI provider counted, which is what it bills by. Input is everything sent to it; output is everything it wrote, its thinking included.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-navy">
          <thead>
            <tr className="border-b border-navy-100">
              <th scope="col" className="py-1 pr-3 font-semibold">
                Day
              </th>
              <th scope="col" className="py-1 pr-3 font-semibold">
                Model
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-semibold">
                Answers
              </th>
              <th scope="col" className="py-1 pr-3 text-right font-semibold">
                Input
              </th>
              <th scope="col" className="py-1 text-right font-semibold">
                Output
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => (
              <tr key={`${d.day} ${d.model}`} className="border-b border-navy-100 last:border-0">
                <td className="py-1 pr-3 font-mono">{d.day}</td>
                <td className="py-1 pr-3">{d.model}</td>
                <td className="py-1 pr-3 text-right">{count(d.answers)}</td>
                <td className="py-1 pr-3 text-right">{count(d.input)}</td>
                <td className="py-1 text-right">{count(d.output)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LogCard({ item }: { item: TutorLogItem }) {
  return (
    <article className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4">
      <p className="text-sm text-navy/70">
        <time dateTime={item.at}>{formatWhen(item.at)}</time>
        {item.status !== 'ok' && <span className="ml-2 font-semibold text-navy">· {item.status}</span>}
      </p>
      {item.kind === 'freeform' ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-navy">{item.className ?? 'Homework'}</p>
          {item.fullSolution && <p className="text-sm font-semibold text-navy">Full solution</p>}
          <p className="whitespace-pre-wrap text-sm text-navy">
            <span className="font-semibold">Problem: </span>
            {item.problemText}
          </p>
        </div>
      ) : (
        <p className="text-sm font-semibold text-navy">
          {item.moduleId} · <span className="font-mono font-normal">{item.problemId}</span>
        </p>
      )}
      <p className="whitespace-pre-wrap text-sm text-navy">
        <span className="font-semibold">Question: </span>
        {item.question}
      </p>
      <p className="whitespace-pre-wrap text-sm text-navy">
        <span className="font-semibold">Answer: </span>
        {item.answer || '—'}
      </p>
      {item.usage && (
        <p className="text-xs text-navy/60" data-tokens="">
          {count(item.usage.input)} tokens in · {count(item.usage.output)} out
          {item.usage.thinking ? ` (${count(item.usage.thinking)} of them thinking)` : ''} · {item.model}
        </p>
      )}
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
  const [days, setDays] = useState<TutorUsageDay[]>([])
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
      setDays(result.days)
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
      {(phase === 'ready' || phase === 'empty') && <TokenDays days={days} />}
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
