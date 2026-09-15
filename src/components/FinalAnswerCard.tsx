import { useId, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react'
import { parseSetBuilder, setToLatex } from '@/notation'
import { gradeFinalAnswer, previewInterval, type FieldResult, type FinalAnswerGrade, type FinalAnswerTarget } from '@/problem/inequality'
import { Katex } from './Katex'
import { NumberLineSet } from './NumberLineSet'

type Props = {
  target: FinalAnswerTarget
  /** Restore typed answers (attempt.final). */
  initial?: { interval?: string; set?: string }
  onGrade: (grade: FinalAnswerGrade, texts: { interval: string; set: string }) => void
  done?: boolean
  variable?: string
  inputRef?: RefObject<HTMLInputElement | null>
}

const INTERVAL_TOKENS = ['(', ')', '[', ']', ',', 'inf', '-inf', 'U', '{', '}']
const BUILDER_TOKENS = ['{x |', '}', '<', '<=', '>', '>=', 'or', '=']

function StatusLine({ r, id }: { r: FieldResult; id: string }) {
  if (r.status === 'empty' || !r.message) return null
  const bad = r.status !== 'ok'
  return (
    <p id={id} role={bad ? 'alert' : 'status'} className={`text-sm ${bad ? 'font-medium text-bad' : 'text-ok'}`}>
      {r.status === 'parse' && r.error?.position != null ? `Check character ${r.error.position + 1}: ` : ''}
      {r.message}
    </p>
  )
}

function insertAtCaret(el: HTMLInputElement | null, value: string, token: string, setValue: (v: string) => void) {
  const start = el?.selectionStart ?? value.length
  const end = el?.selectionEnd ?? value.length
  const next = value.slice(0, start) + token + value.slice(end)
  setValue(next)
  requestAnimationFrame(() => {
    if (!el) return
    el.focus({ preventScroll: true })
    try {
      el.setSelectionRange(start + token.length, start + token.length)
    } catch {
      /* ignore */
    }
  })
}

/**
 * Final answer for inequality / number-line problems: interval + set-builder inputs, a live number
 * line of the typed interval, a preview of each parsed set, and per-field coaching (UX-20).
 */
export function FinalAnswerCard({ target, initial, onGrade, done = false, variable = 'x', inputRef }: Props) {
  const id = useId()
  const [interval, setInterval] = useState(initial?.interval ?? '')
  const [builder, setBuilder] = useState(initial?.set ?? '')
  const [grade, setGrade] = useState<FinalAnswerGrade | null>(null)
  const localRef = useRef<HTMLInputElement | null>(null)
  const builderRef = useRef<HTMLInputElement | null>(null)
  const intervalEl = inputRef ?? localRef

  const preview = useMemo(() => previewInterval(interval), [interval])
  const builderPreview = useMemo(() => {
    const t = builder.trim()
    if (!t) return null
    const p = parseSetBuilder(t)
    return p.ok ? p.set : null
  }, [builder])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (done) return
    const g = gradeFinalAnswer(interval, builder, target)
    setGrade(g)
    onGrade(g, { interval, set: builder })
  }

  const intervalStatus = grade?.interval ?? null
  const builderStatus = grade?.setBuilder ?? null

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby={`${id}-title`}>
      <div>
        <h2 id={`${id}-title`} className="font-semibold text-navy">
          Final answer
        </h2>
        <p className="text-sm text-navy/70">
          Write the solution set {target.requireInterval && target.requireSetBuilder ? 'both ways' : 'in the form asked'}. Both must describe the same numbers.
        </p>
      </div>

      {target.requireInterval && (
        <div className="space-y-2">
          <label htmlFor={`${id}-interval`} className="block text-sm font-semibold text-navy">
            Interval notation
          </label>
          <div className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
            {preview ? <Katex tex={setToLatex(preview, 'interval')} /> : <span className="text-sm text-navy/50">{interval.trim() ? '…' : 'like (-inf, -2] U (5, inf)'}</span>}
          </div>
          <input
            ref={intervalEl}
            id={`${id}-interval`}
            type="text"
            value={interval}
            disabled={done}
            onChange={(e) => {
              setInterval(e.target.value)
              setGrade(null)
            }}
            placeholder="(-inf, -2] U (5, inf)"
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={intervalStatus ? intervalStatus.status !== 'ok' && intervalStatus.status !== 'empty' : undefined}
            aria-describedby={`${id}-interval-status`}
            className="min-h-12 w-full rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Interval symbols">
            {INTERVAL_TOKENS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={done}
                onClick={() => insertAtCaret(intervalEl.current, interval, t, (v) => { setInterval(v); setGrade(null) })}
                className="min-h-10 min-w-10 rounded-lg border border-navy-100 bg-white px-2 font-mono text-sm text-navy hover:bg-navy-50"
              >
                {t === 'U' ? '∪' : t === 'inf' ? '∞' : t === '-inf' ? '−∞' : t}
              </button>
            ))}
          </div>
          {intervalStatus && <StatusLine r={intervalStatus} id={`${id}-interval-status`} />}
          <div aria-live="off">
            {preview ? (
              <NumberLineSet set={preview} caption="your interval as typed" />
            ) : (
              <p className="text-xs text-navy/50">The number line of your interval appears here as you type.</p>
            )}
          </div>
        </div>
      )}

      {target.requireSetBuilder && (
        <div className="space-y-2">
          <label htmlFor={`${id}-builder`} className="block text-sm font-semibold text-navy">
            Set-builder notation
          </label>
          <div className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
            {builderPreview ? <Katex tex={setToLatex(builderPreview, 'builder')} /> : <span className="text-sm text-navy/50">{builder.trim() ? '…' : `like {${variable} | ${variable} <= -2 or ${variable} > 5}`}</span>}
          </div>
          <input
            ref={builderRef}
            id={`${id}-builder`}
            type="text"
            value={builder}
            disabled={done}
            onChange={(e) => {
              setBuilder(e.target.value)
              setGrade(null)
            }}
            placeholder={`{${variable} | ${variable} <= -2 or ${variable} > 5}`}
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-invalid={builderStatus ? builderStatus.status !== 'ok' && builderStatus.status !== 'empty' : undefined}
            aria-describedby={`${id}-builder-status`}
            className="min-h-12 w-full rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Set-builder symbols">
            {BUILDER_TOKENS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={done}
                onClick={() => insertAtCaret(builderRef.current, builder, t.replace(/x/g, variable), (v) => { setBuilder(v); setGrade(null) })}
                className="min-h-10 min-w-10 rounded-lg border border-navy-100 bg-white px-2 font-mono text-sm text-navy hover:bg-navy-50"
              >
                {t === '<=' ? '≤' : t === '>=' ? '≥' : t.replace(/x/g, variable)}
              </button>
            ))}
          </div>
          {builderStatus && <StatusLine r={builderStatus} id={`${id}-builder-status`} />}
        </div>
      )}

      {grade?.mismatch && (
        <p className="rounded-xl bg-bad-100 px-3 py-2 text-sm text-navy" role="alert">
          <span className="font-semibold">{grade.mismatch.title}. </span>
          {grade.mismatch.lesson}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={done} className="min-h-12 rounded-xl bg-coral px-4 font-semibold text-navy hover:bg-coral/80 disabled:opacity-50">
          Check answer
        </button>
        {done && (
          <span className="font-semibold text-ok">
            <span aria-hidden>✓ </span>Both notations match the solution set.
          </span>
        )}
      </div>
    </form>
  )
}
