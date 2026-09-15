import { useSettings, useStore } from '@/store'
import { isIosSafari, isStandalone } from './useBreakpoint'

/**
 * One-time "Add to Home Screen" card for iOS Safari (UX-10): Safari deletes localStorage after
 * 7 days without a visit unless the app is installed. Shown once; dismiss sets settings.seenA2HS.
 */
export function A2HSCard({ force = false }: { force?: boolean }) {
  const settings = useSettings()
  const setSettings = useStore((s) => s.setSettings)
  const show = force || (isIosSafari() && !isStandalone() && !settings.seenA2HS)
  if (!show) return null
  return (
    <section className="rounded-2xl border border-gold bg-gold-100 p-4" aria-labelledby="a2hs-title">
      <h2 id="a2hs-title" className="font-semibold text-navy">
        Add this to your Home Screen to keep your progress
      </h2>
      <p className="mt-1 text-sm text-navy/80">
        Safari clears saved data for websites you have not opened in 7 days. An app on the Home Screen is exempt, so
        your mastery bars and streak survive a week off.
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-navy">
        <li>
          Tap the Share button <span aria-hidden>(the square with an arrow)</span> at the bottom of Safari.
        </li>
        <li>Scroll and tap “Add to Home Screen”, then “Add”.</li>
        <li>Open Precalc from the Home Screen from now on.</li>
      </ol>
      {!force && (
        <button
          type="button"
          onClick={() => setSettings({ seenA2HS: true })}
          className="mt-3 min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-600"
        >
          Got it
        </button>
      )}
    </section>
  )
}
