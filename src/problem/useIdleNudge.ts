import { useCallback, useEffect, useRef } from 'react'

export interface IdleNudgeOptions {
  /** Count only while true (attempt in progress, not finished, not yet nudged). */
  active: boolean
  /** Fired once when `minutes` of visible-foreground time pass without input. */
  onNudge: () => void
  minutes?: number
}

const TICK_MS = 1000

/**
 * Idle nudge (UX-14): 4 minutes of foreground time with no key/pointer/input events. The clock
 * pauses while `document.hidden` (she is in the calculator app) and never fires twice per mount.
 * Nudge only — the attempt's active seconds are counted by useActiveClock, which keeps running
 * after the nudge has fired.
 */
export function useIdleNudge({ active, onNudge, minutes = 4 }: IdleNudgeOptions): void {
  const nudgeRef = useRef(onNudge)
  nudgeRef.current = onNudge

  useEffect(() => {
    if (!active) return
    let idleMs = 0
    let fired = false
    const reset = () => {
      idleMs = 0
    }
    const events: (keyof WindowEventMap)[] = ['keydown', 'pointerdown', 'input', 'touchstart']
    for (const ev of events) window.addEventListener(ev, reset, { passive: true })
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      idleMs += TICK_MS
      if (!fired && idleMs >= minutes * 60_000) {
        fired = true
        nudgeRef.current()
      }
    }, TICK_MS)
    return () => {
      clearInterval(timer)
      for (const ev of events) window.removeEventListener(ev, reset)
    }
  }, [active, minutes])
}

/**
 * Thinking time without a touch still counts, up to this long; after that the screen is just on. A phone
 * left open on a problem had shown "about 1195 min of focused work" for two problems.
 */
export const IDLE_CAP_MS = 3 * 60_000

/**
 * Active-seconds clock: counts visible-foreground seconds while `active` (an attempt is open and not
 * finished) and within IDLE_CAP_MS of her last key, tap or input, and reports them every `every`
 * seconds. Returns `take()`, which hands back the seconds not yet reported and zeroes them — pass them
 * to finishAttempt before it clears the attempt, so the last partial chunk is not lost.
 */
export function useActiveClock(active: boolean, onSecs: (secs: number) => void, every = 15): () => number {
  const onRef = useRef(onSecs)
  onRef.current = onSecs
  const pending = useRef(0)

  useEffect(() => {
    if (!active) return
    let sinceInput = 0
    const touched = () => {
      sinceInput = 0
    }
    const events: (keyof WindowEventMap)[] = ['keydown', 'pointerdown', 'input', 'touchstart']
    for (const ev of events) window.addEventListener(ev, touched, { passive: true })
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      sinceInput += TICK_MS
      if (sinceInput > IDLE_CAP_MS) return
      pending.current += TICK_MS / 1000
      if (pending.current >= every) {
        const n = pending.current
        pending.current = 0
        onRef.current(n)
      }
    }, TICK_MS)
    return () => {
      clearInterval(timer)
      for (const ev of events) window.removeEventListener(ev, touched)
      const n = pending.current
      pending.current = 0
      if (n > 0) onRef.current(n)
    }
  }, [active, every])

  return useCallback(() => {
    const n = pending.current
    pending.current = 0
    return n
  }, [])
}
