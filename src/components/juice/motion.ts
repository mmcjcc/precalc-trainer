import { useSyncExternalStore } from 'react'

const REDUCE = '(prefers-reduced-motion: reduce)'

/**
 * Motion is allowed: the device does not ask for reduced motion. Where the preference cannot be read (no matchMedia,
 * as in a test's jsdom) nothing moves, so the juice never animates where nobody can say it may.
 */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return !window.matchMedia(REDUCE).matches
  } catch {
    return false
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  try {
    const mq = window.matchMedia(REDUCE)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  } catch {
    return () => {}
  }
}

/** `motionAllowed()`, following the device's setting while the page is open. */
export function useMotionAllowed(): boolean {
  return useSyncExternalStore(subscribe, motionAllowed, () => false)
}
