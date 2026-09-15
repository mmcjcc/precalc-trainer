import { useId, useState, type FormEvent } from 'react'
import { toLatex } from '@/notation'
import type { OneToOneReason, Parity, ParityReason } from '@/content/types'
import {
  gradeCheckIt,
  gradeOneToOne,
  gradeTwin,
  ONE_TO_ONE_REASONS,
  twinEvidence,
  type CheckItGrade,
  type InverseAnswer,
  type OneToOneGrade,
  type TwinGrade,
} from '@/problem/inverse'
import { gradeParity, PARITY_REASONS, parityTable, type ParityAnswer, type ParityGrade } from '@/problem/evenOdd'
import type { CheckValue } from '@/content/types'
import { Katex } from './Katex'

function VerdictButton({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 flex-1 rounded-xl px-3 font-semibold disabled:opacity-50 ${active ? 'bg-navy text-white' : 'bg-navy-100 text-navy hover:bg-navy-50'}`}
    >
      {children}
    </button>
  )
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p role={ok ? 'status' : 'alert'} className={`rounded-xl px-3 py-2 text-sm ${ok ? 'bg-ok-100 text-ok' : 'bg-bad-100 text-navy'}`}>
      <span aria-hidden>{ok ? '✓ ' : '✗ '}</span>
      {text}
    </p>
  )
}

// ---------------------------------------------------------------------------
// One-to-one verdict (inverse flow, first card)
// ---------------------------------------------------------------------------

type OneToOneProps = {
  answer: InverseAnswer
  f: string
  seed?: number
  done?: boolean
  onResult: (grade: OneToOneGrade, verdict: 'yes' | 'no', reason: OneToOneReason | null) => void
}

export function OneToOneCard({ answer, f, seed, done = false, onResult }: OneToOneProps) {
  const id = useId()
  const [verdict, setVerdict] = useState<'yes' | 'no' | null>(null)
  const [reason, setReason] = useState<OneToOneReason | null>(null)
  const [grade, setGrade] = useState<OneToOneGrade | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (done || !verdict) return
    const g = gradeOneToOne(answer, f, verdict, reason, seed)
    setGrade(g)
    onResult(g, verdict, reason)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="font-semibold text-navy">
        Is f one-to-one?
      </h2>
      <p className="text-sm text-navy/70">Horizontal line test: does any horizontal line cross the graph twice?</p>
      <div className="flex gap-2" role="group" aria-label="One-to-one verdict">
        <VerdictButton active={verdict === 'yes'} disabled={done} onClick={() => { setVerdict('yes'); setGrade(null) }}>
          Yes, one-to-one
        </VerdictButton>
        <VerdictButton active={verdict === 'no'} disabled={done} onClick={() => { setVerdict('no'); setGrade(null) }}>
          No
        </VerdictButton>
      </div>
      {verdict === 'no' && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-navy">Why not?</legend>
          {ONE_TO_ONE_REASONS.map((r) => (
            <label key={r.id} className="flex min-h-10 cursor-pointer items-start gap-2 text-sm text-navy">
              <input type="radio" name={`${id}-reason`} value={r.id} checked={reason === r.id} disabled={done} onChange={() => { setReason(r.id); setGrade(null) }} className="mt-1" />
              <span>{r.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={done || !verdict} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
          Check
        </button>
      </div>
      {grade && <Message ok={grade.correct} text={grade.message} />}
      {done && !grade && <Message ok text="Verdict recorded." />}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Check it (inverse flow, last card)
// ---------------------------------------------------------------------------

type CheckItProps = {
  check: CheckValue
  f: string
  inverse: string
  done?: boolean
  onResult: (grade: CheckItGrade) => void
}

export function CheckItCard({ check, f, inverse, done = false, onResult }: CheckItProps) {
  const id = useId()
  const [fk, setFk] = useState('')
  const [back, setBack] = useState('')
  const [grade, setGrade] = useState<CheckItGrade | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (done) return
    const g = gradeCheckIt(fk, back, check)
    setGrade(g)
    onResult(g)
  }

  const field = (label: string, value: string, set: (v: string) => void, status: CheckItGrade['fk'] | null, key: string) => (
    <div className="space-y-1">
      <label htmlFor={`${id}-${key}`} className="block text-sm font-semibold text-navy">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        type="text"
        inputMode="numeric"
        value={value}
        disabled={done}
        onChange={(e) => {
          set(e.target.value)
          setGrade(null)
        }}
        autoComplete="off"
        aria-invalid={status ? status.status === 'wrong' || status.status === 'parse' : undefined}
        className="min-h-12 w-full rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
      />
      {status && status.message && (
        <p role={status.status === 'ok' ? 'status' : 'alert'} className={`text-sm ${status.status === 'ok' ? 'text-ok' : 'font-medium text-bad'}`}>
          {status.message}
        </p>
      )}
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="font-semibold text-navy">
        Check it with k = {check.k}
      </h2>
      <p className="text-sm text-navy/80">
        You found <Katex tex={`f^{-1}(x) = ${toLatex(inverse)}`} />. An inverse undoes f, so f⁻¹(f({check.k})) must give {check.k} back. First compute f({check.k}) from{' '}
        <Katex tex={`f(x) = ${toLatex(f)}`} />, then feed that number into f⁻¹.
      </p>
      {field(`f(${check.k}) =`, fk, setFk, grade?.fk ?? null, 'fk')}
      {field(`f⁻¹(f(${check.k})) =`, back, setBack, grade?.back ?? null, 'back')}
      <button type="submit" disabled={done} className="min-h-11 rounded-xl bg-coral px-4 font-semibold text-navy hover:bg-coral/80 disabled:opacity-50">
        Check both
      </button>
      {done && <Message ok text={`f⁻¹(f(${check.k})) = ${check.k}. The inverse undoes f — done.`} />}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Twin evidence (inverse flow, not one-to-one)
// ---------------------------------------------------------------------------

type TwinProps = {
  check: CheckValue
  done?: boolean
  onResult: (grade: TwinGrade) => void
}

function NumberField({
  id,
  label,
  value,
  onChange,
  status,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  status: CheckItGrade['fk'] | null
  disabled: boolean
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        aria-invalid={status ? status.status === 'wrong' || status.status === 'parse' : undefined}
        className="min-h-12 w-full rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
      />
      {status && status.message && (
        <p role={status.status === 'ok' ? 'status' : 'alert'} className={`text-sm ${status.status === 'ok' ? 'text-ok' : 'font-medium text-bad'}`}>
          {status.status !== 'ok' && <span aria-hidden>✗ </span>}
          {status.message}
        </p>
      )}
    </div>
  )
}

/**
 * "Show me two inputs with the same output": f(k) = ? and f(twin) = ?, both graded against f(k).
 * Once both land, the card states the evidence: f(k) = f(twin), so no inverse can undo f.
 */
export function TwinCard({ check, done = false, onResult }: TwinProps) {
  const id = useId()
  const [fk, setFk] = useState('')
  const [twin, setTwin] = useState('')
  const [grade, setGrade] = useState<TwinGrade | null>(null)
  const evidence = twinEvidence(check)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (done) return
    const g = gradeTwin(fk, twin, check)
    setGrade(g)
    onResult(g)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="font-semibold text-navy">
        Back it up: two inputs, one output
      </h2>
      <p className="text-sm text-navy/80">
        {check.twin !== undefined
          ? `Compute f(${check.k}) and f(${check.twin}). If two different inputs land on the same output, no inverse can send that output back to just one x.`
          : `Compute f(${check.k}).`}
      </p>
      <NumberField
        id={`${id}-fk`}
        label={`f(${check.k}) =`}
        value={fk}
        disabled={done}
        status={grade?.fk ?? null}
        onChange={(v) => {
          setFk(v)
          setGrade(null)
        }}
      />
      {check.twin !== undefined && (
        <NumberField
          id={`${id}-twin`}
          label={`f(${check.twin}) =`}
          value={twin}
          disabled={done}
          status={grade?.twin ?? null}
          onChange={(v) => {
            setTwin(v)
            setGrade(null)
          }}
        />
      )}
      <button type="submit" disabled={done} className="min-h-11 rounded-xl bg-coral px-4 font-semibold text-navy hover:bg-coral/80 disabled:opacity-50">
        Check both
      </button>
      {done && evidence && (
        <Message
          ok
          text={`${evidence}. Two different inputs share the output ${check.fk}, so f is not one-to-one — a horizontal line at y = ${check.fk} crosses the graph twice.`}
        />
      )}
    </form>
  )
}

// ---------------------------------------------------------------------------
// Parity verdict (even/odd flow)
// ---------------------------------------------------------------------------

type ParityProps = {
  answer: ParityAnswer
  enabled: boolean
  done?: boolean
  onResult: (grade: ParityGrade, verdict: Parity, reason: ParityReason | null) => void
}

function show(v: number | 'undef'): string {
  return v === 'undef' ? 'undefined' : String(Number.isInteger(v) ? v : Number(v.toFixed(3)))
}

export function ParityVerdictCard({ answer, enabled, done = false, onResult }: ParityProps) {
  const id = useId()
  const [verdict, setVerdict] = useState<Parity | null>(null)
  const [reason, setReason] = useState<ParityReason | null>(null)
  const [grade, setGrade] = useState<ParityGrade | null>(null)
  const rows = parityTable(answer)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (done || !verdict) return
    const g = gradeParity(answer, verdict, reason)
    setGrade(g)
    onResult(g, verdict, reason)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="font-semibold text-navy">
        Verdict
      </h2>
      {!enabled && <p className="text-sm text-navy/70">Write one line for f(−x) and one for −f(x) first — the verdict comes from comparing them.</p>}
      <div className="flex gap-2" role="group" aria-label="Even, odd, or neither">
        {(['even', 'odd', 'neither'] as const).map((v) => (
          <VerdictButton key={v} active={verdict === v} disabled={!enabled || done} onClick={() => { setVerdict(v); setGrade(null) }}>
            {v}
          </VerdictButton>
        ))}
      </div>
      {verdict === 'neither' && (
        <fieldset className="space-y-1">
          <legend className="text-sm font-semibold text-navy">Why neither?</legend>
          {PARITY_REASONS.map((r) => (
            <label key={r.id} className="flex min-h-10 cursor-pointer items-start gap-2 text-sm text-navy">
              <input type="radio" name={`${id}-reason`} value={r.id} checked={reason === r.id} disabled={done} onChange={() => { setReason(r.id); setGrade(null) }} className="mt-1" />
              <span>{r.label}</span>
            </label>
          ))}
        </fieldset>
      )}
      <button type="submit" disabled={!enabled || done || !verdict} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
        Check verdict
      </button>
      {grade && <Message ok={grade.correct} text={grade.message} />}
      {(grade || done) && (
        <div className="overflow-x-auto text-sm">
          <table className="w-full text-left">
            <caption className="mb-1 text-left text-xs font-semibold uppercase tracking-wide text-navy/60">Plug-in check at ±{answer.k}</caption>
            <thead>
              <tr className="text-navy/60">
                <th className="pr-3 font-semibold">k</th>
                <th className="pr-3 font-semibold">f(k)</th>
                <th className="pr-3 font-semibold">f(−k)</th>
                <th className="font-semibold">−f(k)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k} className="text-navy">
                  <td className="pr-3 font-mono">{r.k}</td>
                  <td className="pr-3 font-mono">{show(r.fk)}</td>
                  <td className="pr-3 font-mono">{show(r.fNegK)}</td>
                  <td className="font-mono">{show(r.negFk)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  )
}
