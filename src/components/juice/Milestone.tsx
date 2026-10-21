import { useEffect, useState } from 'react'
import { channel } from './channel'
import { Flame } from './Flame'

/**
 * The one-time celebration of a streak milestone (7, 30, 100 days; store/milestones.ts): a banner at the top of the
 * screen with a big flame, while the confetti and the sparkle go off (useJuice.ts decides when, once per milestone).
 * It goes by itself after a while, or with its close button. The live region is always on the page, so the words are
 * announced when they arrive.
 */

const milestones = channel<number>()

/** Show the banner for a streak of `days` (useJuice.ts; nothing happens where no banner is mounted). */
export function showMilestone(days: number): void {
  milestones.emit(days)
}

export function milestoneWords(days: number): { title: string; line: string } {
  const title = `${days}-day streak!`
  if (days >= 100) return { title, line: 'A hundred days of goals met. That is amazing.' }
  if (days >= 30) return { title, line: 'A whole month of goals met. That is a real habit.' }
  return { title, line: 'A whole week of goals met. Keep it going!' }
}

const SHOW_MS = 9000

/** Mount once (the app shell). */
export function MilestoneBanner() {
  const [days, setDays] = useState<number | null>(null)
  useEffect(() => milestones.on(setDays), [])
  useEffect(() => {
    if (days === null) return
    const t = setTimeout(() => setDays(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [days])
  const words = days === null ? null : milestoneWords(days)
  return (
    <div role="status" aria-live="polite" className="milestone-host pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4">
      {words && (
        <section
          aria-label={words.title}
          data-milestone={days}
          className="milestone-banner pointer-events-auto mt-3 flex w-full max-w-md items-center gap-3 rounded-2xl border-2 border-gold bg-white p-3 shadow-lg"
        >
          <Flame px={48} />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-navy">{words.title}</p>
            <p className="text-sm text-navy">{words.line}</p>
          </div>
          <button
            type="button"
            onClick={() => setDays(null)}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-navy hover:bg-navy-100"
          >
            <span aria-hidden className="text-xl">
              ×
            </span>
          </button>
        </section>
      )}
    </div>
  )
}
