import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { toLatex } from '@/notation/toLatex'
import { Katex } from './Katex'
import { SymbolStrip } from './MathSymbolStrip'
import { insertToken, type StripKey } from './symbolStrip'

export interface InputError {
  message: string
  /** 0-based index into the text. */
  position?: number
  length?: number
}

type Props = {
  value: string
  onChange: (v: string) => void
  onSubmit?: () => void
  placeholder?: string
  /** Visually hidden label. */
  label?: string
  id?: string
  /** Live validation (debounced with the preview). Return null when the text parses. */
  validate?: (text: string) => InputError | null
  /** Error from the verifier after submit; hidden again once the text changes. */
  error?: InputError | null
  submitLabel?: string
  showSubmit?: boolean
  autoFocus?: boolean
  disabled?: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  /** Escape pressed while the field was already empty. */
  onEscape?: () => void
  /** Convert app-syntax text to LaTeX for the preview (defaults to notation toLatex). */
  toTex?: (text: string) => string
  /** Hide the symbol strip (e.g. interval inputs that bring their own). */
  hideStrip?: boolean
  /** Keys for the symbol strip when a problem needs its own set (defaults to the full strip). */
  stripKeys?: readonly StripKey[]
}

const PREVIEW_DEBOUNCE_MS = 70

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/**
 * Math text input with symbol strip, debounced KaTeX preview (reserved height, last good render kept
 * at 50% on parse failure) and a parse-error line with the character position (UX-01/02/18).
 */
export function MathInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  label = 'Next line',
  id,
  validate,
  error,
  submitLabel = 'Check this step',
  showSubmit = true,
  autoFocus,
  disabled,
  inputRef: externalRef,
  onEscape,
  toTex,
  hideStrip,
  stripKeys,
}: Props) {
  const autoId = useId()
  const inputId = id ?? `math-input-${autoId}`
  const errorId = `${inputId}-error`
  const previewId = `${inputId}-preview`
  const innerRef = useRef<HTMLInputElement | null>(null)
  const selRef = useRef({ start: value.length, end: value.length })
  const [pendingCaret, setPendingCaret] = useState<{ pos: number; seq: number } | null>(null)

  const setRefs = useCallback(
    (el: HTMLInputElement | null) => {
      innerRef.current = el
      if (externalRef) externalRef.current = el
    },
    [externalRef],
  )

  const cacheSelection = useCallback(() => {
    const el = innerRef.current
    if (el && el.selectionStart != null) selRef.current = { start: el.selectionStart, end: el.selectionEnd ?? el.selectionStart }
  }, [])

  const insert = useCallback(
    (key: StripKey) => {
      const el = innerRef.current
      let { start, end } = selRef.current
      if (el && document.activeElement === el && el.selectionStart != null) {
        start = el.selectionStart
        end = el.selectionEnd ?? start
      }
      const r = insertToken(value, start, end, key)
      onChange(r.value)
      selRef.current = { start: r.caret, end: r.caret }
      setPendingCaret((p) => ({ pos: r.caret, seq: (p?.seq ?? 0) + 1 }))
    },
    [value, onChange],
  )

  useLayoutEffect(() => {
    if (!pendingCaret) return
    const el = innerRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    try {
      el.setSelectionRange(pendingCaret.pos, pendingCaret.pos)
    } catch {
      /* some input types refuse; harmless */
    }
  }, [pendingCaret])

  // ---- preview ---------------------------------------------------------------
  const debounced = useDebounced(value, PREVIEW_DEBOUNCE_MS)
  const liveError = useMemo(() => (validate && debounced.trim() ? validate(debounced) : null), [validate, debounced])
  const tex = useMemo(() => (debounced.trim() ? (toTex ?? toLatex)(debounced) : ''), [debounced, toTex])
  const lastGood = useRef('')
  if (!liveError && tex) lastGood.current = tex
  if (!debounced.trim()) lastGood.current = ''
  const shownTex = liveError ? lastGood.current : tex

  // Submit errors are for the text they were produced on.
  const [errorFor, setErrorFor] = useState<string | null>(null)
  useEffect(() => {
    setErrorFor(error ? value : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capture the text the error belongs to
  }, [error])
  const submitError = error && errorFor === value ? error : null
  const shownError = submitError ?? liveError
  const caretPos = shownError?.position != null && shownError.position >= 0 ? Math.min(shownError.position, value.length) : null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (disabled) return
    onSubmit?.()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (value) {
        e.preventDefault()
        onChange('')
        selRef.current = { start: 0, end: 0 }
      } else if (onEscape) {
        e.preventDefault()
        onEscape()
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <div id={previewId} aria-label="Preview" className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
        {shownTex ? (
          <span className={liveError ? 'opacity-50' : undefined}>
            <Katex tex={shownTex} />
          </span>
        ) : (
          <span className="text-sm text-navy/50">{value.trim() ? '…' : 'preview appears here'}</span>
        )}
      </div>

      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          ref={setRefs}
          id={inputId}
          type="text"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => {
            onChange(e.target.value)
            cacheSelection()
          }}
          onSelect={cacheSelection}
          onKeyUp={cacheSelection}
          onMouseUp={cacheSelection}
          onTouchEnd={cacheSelection}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? 'Type the next line, like 3x <= 9'}
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={Boolean(shownError)}
          aria-describedby={`${previewId}${shownError ? ` ${errorId}` : ''}`}
          className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
        />
        {showSubmit && (
          <button
            type="submit"
            disabled={disabled}
            className="min-h-12 shrink-0 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50"
          >
            {submitLabel}
          </button>
        )}
      </div>
      {caretPos !== null && (
        <div aria-hidden className="-mt-1 overflow-hidden whitespace-pre pl-[calc(0.75rem+2px)] font-mono text-[max(16px,1rem)] leading-none text-bad">
          {' '.repeat(caretPos)}^
        </div>
      )}
      {shownError && (
        <p id={errorId} role={submitError ? 'alert' : undefined} className={`text-sm ${submitError ? 'font-medium text-bad' : 'text-navy/70'}`}>
          {caretPos !== null ? `Check character ${caretPos + 1}: ` : ''}
          {shownError.message}
        </p>
      )}
      {!hideStrip && <SymbolStrip onInsert={insert} keys={stripKeys} disabled={disabled} />}
    </form>
  )
}
