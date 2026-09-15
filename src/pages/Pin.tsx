import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { sha256hex } from '@/sha256'
import { saveReturnTo, takeReturnTo, useStore } from '@/store'

type Props = {
  /** Lower-case SHA-256 hex of the family PIN. */
  expected: string
}

/**
 * Family PIN gate (UX-19). Asks once per device: success sets `auth.ok` in localStorage.
 * Labelled numeric input with show/hide, error in role="alert", submit on Enter, no lockout.
 * The deep link she opened is kept in sessionStorage (`returnTo`, UX-13) and restored after unlock.
 */
export function PinPage({ expected }: Props) {
  const unlock = useStore((s) => s.unlock)
  const location = useLocation()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = useId()
  const here = `${location.pathname}${location.search}`

  useEffect(() => {
    if (here !== '/') saveReturnTo(here)
  }, [here])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const entered = pin.trim()
    if (!entered) {
      setError('Type the family PIN first.')
      inputRef.current?.focus()
      return
    }
    setBusy(true)
    try {
      const hex = await sha256hex(entered)
      if (hex === expected) {
        const to = takeReturnTo()
        unlock()
        if (to && to !== here) navigate(to, { replace: true })
        return
      }
      setError("That PIN doesn't match. Try again — there's no limit on tries.")
      setPin('')
      inputRef.current?.focus()
    } catch {
      setError('This browser could not check the PIN. Reload the page and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-navy-100 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-navy">Precalc Trainer</h1>
        <p className="mt-1 text-sm text-navy/80">
          Enter the family PIN. This device remembers it, so you only need to do this once.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3" noValidate>
          <label htmlFor={inputId} className="block text-sm font-semibold text-navy">
            Family PIN
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              ref={inputRef}
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="go"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value)
                if (error) setError(null)
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              autoFocus
              className="min-h-12 min-w-0 flex-1 rounded-xl border-2 border-navy-100 px-3 text-lg tracking-widest text-navy focus:border-navy"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? 'Hide PIN' : 'Show PIN'}
              aria-controls={inputId}
              className="min-h-12 min-w-16 rounded-xl border-2 border-navy-100 px-3 text-sm font-semibold text-navy hover:bg-navy-50"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
          {error && (
            <p id={errorId} role="alert" className="text-sm font-semibold text-bad">
              <span aria-hidden>✗ </span>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="min-h-12 w-full rounded-xl bg-navy font-semibold text-white hover:bg-navy-600 disabled:opacity-70"
          >
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default PinPage
