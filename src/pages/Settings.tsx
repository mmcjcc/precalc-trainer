import { useCallback, useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { A2HSCard } from '@/components/A2HSCard'
import { BottomSheet } from '@/components/BottomSheet'
import { isIosSafari, isStandalone } from '@/components/useBreakpoint'
import { CALC_LABEL, type CalcId } from '@/shared/types'
import { useSettings, useStore } from '@/store'

const CALC_IDS = Object.keys(CALC_LABEL) as CalcId[]

function Switch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p id={`${id}-label`} className="font-semibold text-navy">
          {label}
        </p>
        <p id={`${id}-desc`} className="mt-0.5 text-sm text-navy/80">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-desc`}
        onClick={() => onChange(!checked)}
        className={`min-h-11 min-w-20 shrink-0 rounded-full px-3 text-sm font-semibold ${
          checked ? 'bg-navy text-white hover:bg-navy-600' : 'border-2 border-navy-100 bg-white text-navy hover:bg-navy-50'
        }`}
      >
        {checked ? (
          <>
            <span aria-hidden>✓ </span>On
          </>
        ) : (
          'Off'
        )}
      </button>
    </div>
  )
}

/** Set by the container (docker/20-config.sh) when the site runs behind Container Apps sign-in. Same-site paths only. */
function configuredSignOutUrl(): string {
  const url = typeof window === 'undefined' ? '' : (window.__PRECALC_CONFIG__?.signOutUrl ?? '')
  return /^\/(?!\/)/.test(url) ? url : ''
}

export function SettingsPage() {
  const signOutUrl = configuredSignOutUrl()
  const settings = useSettings()
  const setSettings = useStore((s) => s.setSettings)
  const resetProgress = useStore((s) => s.resetProgress)
  const toast = useStore((s) => s.toast)
  const storageOk = useStore((s) => s.storageOk)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const closeConfirm = useCallback(() => setConfirmOpen(false), [])
  const calcName = useId()
  const showA2HS = isIosSafari() && !isStandalone()

  function confirmReset() {
    resetProgress()
    setConfirmOpen(false)
    toast('Progress reset.', { tone: 'info', detail: 'Fresh start — every mastery bar is back to “not started”.' })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-navy">Settings</h1>
      </header>

      <section aria-labelledby="settings-calc" className="rounded-2xl border border-navy-100 bg-white p-4">
        <h2 id="settings-calc" className="font-semibold text-navy">
          Calculator
        </h2>
        <p className="mt-0.5 text-sm text-navy/80">Calculator steps on every problem use the keys of this model.</p>
        <fieldset className="mt-3">
          <legend className="sr-only">Calculator model</legend>
          <div className="inline-flex flex-wrap rounded-xl border border-navy-100 bg-white p-0.5">
            {CALC_IDS.map((id) => {
              const checked = settings.calculator === id
              return (
                <label
                  key={id}
                  className={`flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold ${
                    checked ? 'bg-navy text-white' : 'text-navy hover:bg-navy-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={calcName}
                    value={id}
                    checked={checked}
                    onChange={() => setSettings({ calculator: id })}
                    className="sr-only"
                  />
                  {checked && <span aria-hidden>✓</span>}
                  {CALC_LABEL[id]}
                </label>
              )
            })}
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="settings-practice" className="rounded-2xl border border-navy-100 bg-white px-4 py-2">
        <h2 id="settings-practice" className="pt-2 font-semibold text-navy">
          Practice
        </h2>
        <div className="divide-y divide-navy-100">
          <Switch
            label="Ask which property after each step"
            description="After a step is accepted, pick the property that justified it. Skipping is always fine and never counts against you."
            checked={settings.askProperty === 'always'}
            onChange={(on) => setSettings({ askProperty: on ? 'always' : 'off' })}
          />
          <Switch
            label="Test mode"
            description="Adds a timer you can pause to problems you start. Timed problems are kept out of your mastery bars, and nothing ever locks or submits on its own."
            checked={settings.testMode}
            onChange={(on) => setSettings({ testMode: on })}
          />
        </div>
      </section>

      <section aria-labelledby="settings-device" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
        <h2 id="settings-device" className="font-semibold text-navy">
          Your progress lives on this device
        </h2>
        <p className="text-sm text-navy/80">
          Mastery, error patterns and your streak are saved in this browser only — nothing is sent to a server. Using a
          phone and a computer? Export a backup on one and import it on the other from the{' '}
          <Link to="/progress" className="font-semibold text-navy underline">
            Progress page
          </Link>
          .
        </p>
        {!storageOk && (
          <p role="alert" className="text-sm font-semibold text-bad">
            <span aria-hidden>✗ </span>
            This browser is blocking saves right now, so progress disappears when you close it. Export a backup before you
            go.
          </p>
        )}
        {showA2HS && <A2HSCard force />}
      </section>

      {signOutUrl && (
        <section aria-labelledby="settings-account" className="rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="settings-account" className="font-semibold text-navy">
            Signed in
          </h2>
          <p className="mt-0.5 text-sm text-navy/80">
            Signing out keeps your progress on this device. On a shared computer, sign out of Google too, or the next
            person to open the site gets in as you.
          </p>
          <a
            href={signOutUrl}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl border-2 border-navy-100 bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50"
          >
            Sign out
          </a>
        </section>
      )}

      <section aria-labelledby="settings-reset" className="rounded-2xl border border-navy-100 bg-white p-4">
        <h2 id="settings-reset" className="font-semibold text-navy">
          Reset progress
        </h2>
        <p className="mt-0.5 text-sm text-navy/80">
          Clears mastery, error patterns, streak, drill scores and any unfinished problem on this device. Your settings
          stay.
        </p>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          aria-haspopup="dialog"
          className="mt-3 min-h-11 rounded-xl border-2 border-bad bg-white px-4 text-sm font-semibold text-bad hover:bg-navy-50"
        >
          Reset progress…
        </button>
      </section>

      <BottomSheet open={confirmOpen} onClose={closeConfirm} title="Reset all progress?">
        <p className="text-navy">
          This wipes every mastery bar, error pattern, streak and drill score on this device. It can&apos;t be undone — if
          you might want them back, export a backup from Progress first.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={confirmReset}
            className="min-h-11 rounded-xl bg-bad px-4 font-semibold text-white hover:opacity-90"
          >
            Yes, reset everything
          </button>
          <button
            type="button"
            onClick={closeConfirm}
            className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
          >
            Keep my progress
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

export default SettingsPage
