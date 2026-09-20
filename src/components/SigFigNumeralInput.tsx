import { useId, useMemo, type FormEvent, type RefObject } from 'react'
import { composeSigFigText, parseSigFigNumeral } from '@/engine'

export interface SigFigEntryError {
  message: string
  /** 0-based index into the COMPOSED text (`composeSigFigText(coefficient, power)`). */
  position?: number
}

type Props = {
  coefficient: string
  power: string
  onChange: (next: { coefficient: string; power: string }) => void
  onSubmit: () => void
  /** Printed beside the boxes ('' = none; '%' prints without a space). */
  unit: string
  disabled?: boolean
  submitLabel?: string
  autoFocus?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  /** Parse error from the grader after a check; cleared by the caller once the text changes. */
  error?: SigFigEntryError | null
}

/** Toggle a leading minus (ASCII or Unicode) on a typed box. */
export function toggleSign(text: string): string {
  const t = text.trimStart()
  if (t.startsWith('-') || t.startsWith('−')) return t.slice(1)
  if (t.startsWith('+')) return `-${t.slice(1)}`
  return `-${t}`
}

function figuresLabel(n: number): string {
  if (n === 0) return 'no significant figures'
  return n === 1 ? '1 significant figure' : `${n} significant figures`
}

/**
 * Where the composed-text position falls: in the coefficient box, in the power box, or in the
 * joining " x 10^" (then the power box is the one to look at).
 */
export function locateError(position: number | undefined, coefficient: string): { box: 'coefficient' | 'power'; at?: number } {
  const coefLen = coefficient.trimEnd().length
  if (position === undefined) return { box: 'coefficient' }
  if (position < coefLen) return { box: 'coefficient', at: position + 1 }
  const join = ' x 10^'.length
  if (position >= coefLen + join) return { box: 'power', at: position - coefLen - join + 1 }
  return { box: 'power' }
}

/**
 * Two-box numeral entry for significant-figure answers: a coefficient box and an optional power-of-ten
 * box, joined with the engine's `composeSigFigText`, so a power of ten never needs a caret or a
 * letter key on a phone. Both boxes are type="text" (type="number" drops the zeros that carry the
 * meaning) and keep exactly what she typed. Under them a live line says how the app reads the
 * entry — "reads as 1.20 × 10³ — 3 significant figures" — because that reading is the lesson.
 */
export function SigFigNumeralInput({ coefficient, power, onChange, onSubmit, unit, disabled = false, submitLabel = 'Check answer', autoFocus = false, inputRef, error }: Props) {
  const id = useId()
  const composed = composeSigFigText(coefficient, power)
  const preview = useMemo(() => {
    if (coefficient.trim() === '' && power.trim() === '') return null
    const parsed = parseSigFigNumeral(composed)
    if (parsed.ok) {
      const n = parsed.numeral
      return { ok: true as const, text: `reads as ${n.display} — ${figuresLabel(n.sigFigs)}` }
    }
    const where = locateError(parsed.error.position, coefficient)
    const at = where.at !== undefined ? ` (${where.box === 'power' ? 'power of ten, ' : ''}character ${where.at})` : where.box === 'power' ? ' (power of ten)' : ''
    return { ok: false as const, text: `not readable yet${at}: ${parsed.error.message}` }
  }, [coefficient, power, composed])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!disabled) onSubmit()
  }

  const errorWhere = error ? locateError(error.position, coefficient) : null
  const errorText = error
    ? `${errorWhere?.at !== undefined ? `Check ${errorWhere.box === 'power' ? 'the power of ten, ' : ''}character ${errorWhere.at}: ` : ''}${error.message}`
    : null

  const box =
    'min-h-12 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(18px,1.125rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50'

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <div>
          <label htmlFor={`${id}-coef`} className="block text-sm font-semibold text-navy">
            Your answer
          </label>
          <input
            ref={inputRef}
            id={`${id}-coef`}
            type="text"
            value={coefficient}
            disabled={disabled}
            onChange={(e) => onChange({ coefficient: e.target.value, power })}
            inputMode="decimal"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            autoFocus={autoFocus}
            placeholder="3.0"
            aria-invalid={error ? true : undefined}
            aria-describedby={errorText ? `${id}-preview ${id}-error` : `${id}-preview`}
            className={`${box} w-40`}
          />
        </div>
        <div className="flex items-end gap-1">
          <span className="pb-3 text-lg text-navy" aria-hidden>
            × 10
          </span>
          <div>
            <label htmlFor={`${id}-power`} className="block text-sm font-semibold text-navy">
              Power of ten
            </label>
            <input
              id={`${id}-power`}
              type="text"
              value={power}
              disabled={disabled}
              onChange={(e) => onChange({ coefficient, power: e.target.value })}
              inputMode="numeric"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder="none"
              aria-describedby={`${id}-power-help`}
              className={`${box} w-24`}
            />
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange({ coefficient, power: toggleSign(power) })}
            aria-label="Flip the sign of the power of ten"
            className="mb-0.5 min-h-11 min-w-11 rounded-lg border border-navy-100 bg-white px-2 text-lg font-semibold text-navy hover:bg-navy-50 disabled:opacity-50"
          >
            ±
          </button>
        </div>
        {unit && (
          <span className="pb-3 text-lg font-semibold text-navy">{unit}</span>
        )}
      </div>
      <p id={`${id}-power-help`} className="sr-only">
        Leave the power of ten empty for an ordinary decimal. The ± button makes the power negative.
      </p>
      <p id={`${id}-preview`} className={`min-h-5 text-sm ${preview ? (preview.ok ? 'text-navy' : 'text-navy/70') : 'text-navy/50'}`}>
        {preview ? preview.text : 'Type the number as you would write it on the test; add a power of ten only when you need one.'}
      </p>
      {errorText && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-bad">
          {errorText}
        </p>
      )}
      <button type="submit" disabled={disabled} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
        {submitLabel}
      </button>
    </form>
  )
}
