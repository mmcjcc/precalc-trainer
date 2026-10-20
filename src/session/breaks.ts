/**
 * The break at the end of a set: the one place the store app may show a full-screen ad.
 *
 * Google Play allows a full-screen ad at the end of a level or a section, never right after a button that starts
 * something. A set (three problems, pages/SetPage.tsx) is that section: when she taps "See results" on its last
 * problem, the set runner calls `setEndBreak` exactly once, with `go` showing her results. Nothing else calls it:
 * not "Next in set", not "Another set", not "Start a set".
 *
 * This repo shows no ads. By default `go` runs at once. The store app registers its announced interstitial ("A short
 * ad, then your results") with `registerSetEndBreak`, and calls `go` when the ad closes, fails or is skipped.
 */

export interface SetEndInfo {
  /** The set ran in test mode (timed problems). */
  timed: boolean
}

/** A registered break: show what it shows, then call `go` (once) to show her results. */
export type SetEndBreak = (go: () => void, info: SetEndInfo) => void

let registered: SetEndBreak | null = null

/**
 * Register the break that runs between the last problem of a set and its results (the store app's interstitial).
 * A second registration replaces the first. Returns a function that removes it again.
 */
export function registerSetEndBreak(fn: SetEndBreak): () => void {
  registered = fn
  return () => {
    if (registered === fn) registered = null
  }
}

/**
 * The end of a set: run the registered break, or `go` at once when none is registered. `go` runs at most once, and
 * still runs when the registered break throws (her results never depend on an ad).
 */
export function setEndBreak(go: () => void, info: SetEndInfo): void {
  let gone = false
  const once = () => {
    if (gone) return
    gone = true
    go()
  }
  const fn = registered
  if (!fn) {
    once()
    return
  }
  try {
    fn(once, info)
  } catch {
    once()
  }
}
