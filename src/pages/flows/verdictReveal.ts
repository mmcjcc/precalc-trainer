/**
 * After a Check on the math keypad in a parts flow (a box in a part's card, not the composer), bring the verdict
 * under the part's box into the band of screen above the keypad. The keypad itself scrolls the box and its card
 * into view, but when a card with a long lesson does not fit it keeps only the box, which can leave the verdict
 * behind the keypad. This runs after the keypad's own scroll and works from where the page is at that moment:
 * the box and the whole verdict (with the Stuck? chip) when they fit; else the box at the top of the band and as
 * much of the verdict as fits under it. The band starts under the pinned problem strip.
 */
import { useKeypadStore } from '@/components/keypadStore'

const MARGIN = 8
/** After the keypad's own scroll has started (it waits 60 ms for the page to answer). */
export const VERDICT_REVEAL_MS = 140

export function revealVerdictAboveKeypad(strip: HTMLElement | null): void {
  const s = useKeypadStore.getState()
  const target = s.target
  if (!target || s.height <= 0 || (s.modes[target.id] ?? 'keypad') !== 'keypad') return
  const el = target.el
  // The composer shows its own verdict line; this is for the parts flows' boxes.
  if (!el.isConnected || el.closest('[data-keypad-dock]')) return
  const scope = el.closest('section') ?? el.closest('form')
  if (!scope) return
  // The verdict cards (alert or status) after the box, and the Stuck? chip under a wrong one.
  const notes = Array.from(scope.querySelectorAll<HTMLElement>('[role="alert"], [role="status"], [data-stuck-chip]')).filter(
    (n) => (el.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  )
  const last = notes[notes.length - 1]
  if (!last) return
  const vv = window.visualViewport
  const viewTop = vv?.offsetTop ?? 0
  const viewHeight = vv?.height ?? window.innerHeight
  const stripBottom = strip?.isConnected ? strip.getBoundingClientRect().bottom : viewTop
  const band = { top: Math.max(viewTop, stripBottom) + MARGIN, bottom: viewTop + viewHeight - s.height - MARGIN }
  if (band.bottom - band.top < 48) return
  const box = el.getBoundingClientRect()
  const whole = { top: box.top, bottom: Math.max(box.bottom, last.getBoundingClientRect().bottom) }
  let delta = 0
  if (whole.bottom - whole.top <= band.bottom - band.top) {
    if (whole.bottom > band.bottom) delta = whole.bottom - band.bottom
    if (whole.top - delta < band.top) delta = whole.top - band.top
  } else {
    delta = box.top - band.top
  }
  delta = Math.round(delta)
  if (delta !== 0) window.scrollBy({ top: delta, behavior: 'smooth' })
}
