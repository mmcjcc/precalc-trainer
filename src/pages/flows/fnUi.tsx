import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { describeSetText, parseSetAnswer, patternHit, type FunctionGrade, type FunctionMistakeKind } from '@/engine'
import { FN_PATTERN } from '@/content/modules/domainRange/patterns'
import type { RuleCard } from '@/content/types'
import { RuleCardView } from '@/components/HintPanel'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { SET_ANSWER_KEYS, insertToken, type StripKey } from '@/components/symbolStrip'
import { useStore, type Attempt } from '@/store'
import type { PatternHit } from '@/shared/types'

/** Hint-ladder key (attempt.hintsUsed): one ladder per problem. */
export const FN_HINT_KEY = 0

const HINT_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

/**
 * Three rungs: nudge, rule card, the engine's explanation. Rung 3 shows the answer, so it is flagged
 * on the attempt and no longer counts as a first try.
 */
export function useFnHint(attempt: Attempt | null, disabled: boolean): { rung: 0 | 1 | 2 | 3; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(FN_HINT_KEY)] ?? 0) as 0 | 1 | 2 | 3
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(FN_HINT_KEY)] ?? 0
    if (cur >= 3) return
    const next = (cur + 1) as 1 | 2 | 3
    s.useHint(FN_HINT_KEY, next)
    if (next === 3) s.setFinal({ revealed: true, firstCorrect: false })
  }, [disabled])
  return { rung, advance }
}

export function FnHintLadder({
  rung,
  nudge,
  card,
  explanation,
  onAdvance,
  disabled,
}: {
  rung: 0 | 1 | 2 | 3
  nudge: string
  card: RuleCard | null
  explanation: string[]
  onAdvance: () => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">Hints never appear on their own. Ctrl+Shift+H steps through them.</p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || rung === 3}
        className="min-h-11 w-full rounded-xl bg-gold px-3 font-semibold text-navy hover:bg-gold/80 disabled:opacity-50"
      >
        {HINT_LABEL[rung]}
        {rung === 2 && <span className="ml-1 text-xs font-normal text-gold-text">(marks the answer as shown)</span>}
      </button>
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">{nudge}</p>
        </div>
      )}
      {rung >= 2 && card && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">Rule</p>
          <RuleCardView card={card} />
        </div>
      )}
      {rung >= 3 && <SigFigExplanation steps={explanation} title="Worked explanation" />}
    </div>
  )
}

/** The catalog lesson for a named function mistake, with her witness attached. */
export function functionPattern(kind: FunctionMistakeKind, witness: string): PatternHit {
  return patternHit(FN_PATTERN[kind], witness)
}

/** Named mistake, plain wrong sentence, or an unreadable-input note. */
export function FnGradeView({ grade }: { grade: FunctionGrade | null }): ReactNode {
  if (!grade) return null
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[functionPattern(grade.mistake, grade.witness)]} />
  if (grade.verdict === 'wrong') return <SigFigRejection message={grade.message} patterns={[]} />
  return (
    <p role="alert" className="text-sm font-medium text-bad">
      {grade.message}
    </p>
  )
}

/**
 * Interval, set-builder, or "all real numbers except …". The line under the box is what
 * `parseSetAnswer` understood — the same idea as the significant-figures "reads as" preview.
 */
export function SetAnswerField({
  value,
  onChange,
  onSubmit,
  label,
  variable,
  disabled,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  label: string
  /** 'x' for a domain, 'y' for a range. */
  variable: 'x' | 'y'
  disabled?: boolean
  placeholder?: string
}) {
  const autoId = useId()
  const inputId = `set-${autoId}`
  const previewId = `${inputId}-preview`
  const ref = useRef<HTMLInputElement>(null)
  const sel = useRef({ start: value.length, end: value.length })
  const [pending, setPending] = useState<{ pos: number; seq: number } | null>(null)

  function cache() {
    const el = ref.current
    if (!el) return
    sel.current = { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length }
  }

  useLayoutEffect(() => {
    if (!pending || !ref.current) return
    ref.current.focus({ preventScroll: true })
    try {
      ref.current.setSelectionRange(pending.pos, pending.pos)
    } catch {
      /* some input types refuse; harmless */
    }
  }, [pending])

  const reading = useMemo(() => {
    const t = value.trim()
    if (!t) return null
    const parsed = parseSetAnswer(t)
    if (!parsed.ok) return { ok: false as const }
    return { ok: true as const, text: describeSetText(parsed.set, variable) }
  }, [value, variable])

  function insert(key: StripKey) {
    const next = insertToken(value, sel.current.start, sel.current.end, key)
    onChange(next.value)
    setPending({ pos: next.caret, seq: pending ? pending.seq + 1 : 1 })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!disabled) onSubmit()
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <label htmlFor={inputId} className="block text-sm font-semibold text-navy">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={ref}
          id={inputId}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onSelect={cache}
          onKeyUp={cache}
          onMouseUp={cache}
          onTouchEnd={cache}
          placeholder={placeholder ?? '[-2, 3) U (3, inf)'}
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-describedby={previewId}
          className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
        />
        <button type="submit" disabled={disabled} className="min-h-12 shrink-0 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
          Check
        </button>
      </div>
      <p id={previewId} className={`min-h-5 text-sm ${reading?.ok ? 'text-navy' : 'text-navy/70'}`}>
        {reading ? (reading.ok ? `reads as ${reading.text}` : 'not readable yet') : 'Interval notation, set-builder, or “all real numbers except 3”.'}
      </p>
      <SymbolStrip onInsert={insert} keys={SET_ANSWER_KEYS} disabled={disabled} />
    </form>
  )
}

export function saveFnEntries(entries: Record<string, string>) {
  useStore.getState().setFinal({ fnEntries: entries })
}
