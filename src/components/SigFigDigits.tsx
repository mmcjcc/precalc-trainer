import { useMemo } from 'react'
import { parseSigFigNumeral, sigFigPlaceName } from '@/engine'
import type { SigFigChar, SigFigTapGrade } from '@/shared/types'

type Props = {
  /** The numeral, engine-parseable (the task's text). */
  text: string
  /** Printed after the digits. */
  unit?: string
  /** `SigFigChar.index` of every digit she marked significant. */
  selected: readonly number[]
  onToggle: (index: number) => void
  /** Per-digit verdicts after a check; cleared by the caller when she changes a tap. */
  feedback?: SigFigTapGrade | null
  disabled?: boolean
}

/** Accessible name of a digit button: "digit 7, hundredths place". */
export function digitName(c: SigFigChar): string {
  return c.place === undefined ? `digit ${c.ch}` : `digit ${c.ch}, ${sigFigPlaceName(c.place)} place`
}

/**
 * The numeral as a row of large tappable digits (44 px targets, aria-pressed, keyboard operable).
 * A tap marks the digit significant; a live line counts the marks. After a check, every digit
 * shows ✓ or ✗ and each wrong one gets its rule named under the row. A power of ten is shown but
 * not tappable: it never adds figures.
 */
export function SigFigDigits({ text, unit = '', selected, onToggle, feedback = null, disabled = false }: Props) {
  const numeral = useMemo(() => {
    const p = parseSigFigNumeral(text)
    return p.ok ? p.numeral : null
  }, [text])
  if (!numeral) return <p className="text-sm text-bad">This numeral could not be read: {text}</p>

  const firstExp = numeral.chars.findIndex((c) => c.role === 'exponent')
  const shown = firstExp >= 0 ? numeral.chars.slice(0, firstExp) : numeral.chars
  const expDisplay = firstExp >= 0 ? numeral.display.slice(numeral.display.indexOf('×')) : ''
  const verdict = new Map(feedback ? feedback.digits.map((d) => [d.index, d]) : [])
  const wrong = feedback ? feedback.digits.filter((d) => !d.ok) : []
  const n = selected.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Digits of the measurement: press each one that is significant">
        {shown.map((c) => {
          if (!c.digit) {
            return (
              <span key={c.index} className="px-0.5 font-mono text-3xl text-navy">
                {c.ch}
              </span>
            )
          }
          const pressed = selected.includes(c.index)
          const v = verdict.get(c.index)
          const tone = v
            ? v.ok
              ? 'border-ok'
              : 'border-bad'
            : 'border-navy-100'
          const fill = pressed ? 'bg-navy text-white' : 'bg-white text-navy hover:bg-navy-50'
          return (
            <span key={c.index} className="flex flex-col items-center">
              <button
                type="button"
                aria-pressed={pressed}
                aria-label={digitName(c)}
                disabled={disabled}
                onClick={() => onToggle(c.index)}
                className={`min-h-12 min-w-11 rounded-xl border-2 px-2 font-mono text-3xl leading-none disabled:opacity-60 ${tone} ${fill}`}
              >
                {c.ch}
              </button>
              <span className={`mt-0.5 h-4 text-xs font-semibold ${v ? (v.ok ? 'text-ok' : 'text-bad') : 'text-transparent'}`} aria-hidden>
                {v ? (v.ok ? '✓' : '✗') : '·'}
              </span>
            </span>
          )
        })}
        {expDisplay && (
          <span className="ml-1 self-start pt-2 font-mono text-2xl text-navy/80">{expDisplay}</span>
        )}
        {unit && (
          <span className="ml-1 self-start pt-2 text-2xl font-semibold text-navy">{unit}</span>
        )}
      </div>
      <p aria-live="polite" className="text-sm text-navy">
        You marked <strong>{n}</strong> {n === 1 ? 'digit' : 'digits'} as significant.
        {numeral.scientific && ' The power of ten is not a digit of the measurement, so it cannot be marked.'}
      </p>
      {feedback && wrong.length > 0 && (
        <ul className="space-y-1 text-sm text-navy" aria-label="Digits to look at again">
          {wrong.map((d) => {
            const c = numeral.chars[d.index]
            const where = c?.place !== undefined ? ` in the ${sigFigPlaceName(c.place)} place` : ''
            return (
              <li key={d.index}>
                <span aria-hidden className="text-bad">
                  ✗{' '}
                </span>
                <span className="font-semibold">
                  The {d.ch}
                  {where}
                </span>{' '}
                {d.selected ? 'is not significant' : 'is significant'}: {d.rule}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
