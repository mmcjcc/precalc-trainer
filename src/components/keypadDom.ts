/**
 * The keypad's hands: it edits the focused box the way typing does. The new text goes in through the
 * input's native value setter and an `input` event, so the box's own onChange runs exactly as for a
 * key on the phone's keyboard (React's controlled input sees an ordinary change); then the caret is
 * put where the strip would put it.
 */
import { deleteBackward, insertKey, moveCaret, revealDelta, type Span } from './keypadKeys'
import type { StripKey } from './symbolStrip'

function selection(el: HTMLInputElement): [number, number] {
  const len = el.value.length
  const start = el.selectionStart ?? len
  return [start, el.selectionEnd ?? start]
}

function setCaret(el: HTMLInputElement, caret: number): void {
  try {
    el.setSelectionRange(caret, caret)
  } catch {
    /* some input types refuse a selection; harmless */
  }
}

/** Replace the box's text as typing would, caret at `caret`. */
export function typeInto(el: HTMLInputElement, value: string, caret: number): void {
  if (value !== el.value) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set
    if (setter) setter.call(el, value)
    else el.value = value
    setCaret(el, caret)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  setCaret(el, caret)
}

export function pressInsert(el: HTMLInputElement, key: StripKey): void {
  const [start, end] = selection(el)
  const r = insertKey(el.value, start, end, key)
  typeInto(el, r.value, r.caret)
}

export function pressBackspace(el: HTMLInputElement, keys: readonly StripKey[]): void {
  const [start, end] = selection(el)
  const r = deleteBackward(el.value, start, end, keys)
  typeInto(el, r.value, r.caret)
}

export function pressMove(el: HTMLInputElement, dir: -1 | 1): void {
  const [start, end] = selection(el)
  setCaret(el, moveCaret(el.value, start, end, dir))
}

const IMPLICIT_SUBMIT_BLOCKERS = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'date', 'month', 'week', 'time', 'datetime-local', 'number'])

function isSubmitButton(e: Element): e is HTMLButtonElement | HTMLInputElement {
  if (e instanceof HTMLButtonElement) return e.type === 'submit'
  return e instanceof HTMLInputElement && (e.type === 'submit' || e.type === 'image')
}

/**
 * Check does what Enter does in the box: the keydown goes to the box (its own handlers may take it),
 * then the browser's implicit submission: click the form's default button unless it is disabled, or
 * submit a form whose only text field is this one.
 */
export function submitLikeEnter(el: HTMLInputElement): void {
  const keydown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })
  if (!el.dispatchEvent(keydown)) return
  const form = el.form
  if (!form) return
  const fields = Array.from(form.elements)
  const button = fields.find(isSubmitButton)
  if (button) {
    if (!button.disabled) button.click()
    return
  }
  const blockers = fields.filter((f) => f instanceof HTMLInputElement && IMPLICIT_SUBMIT_BLOCKERS.has(f.type))
  if (blockers.length > 1) return
  form.requestSubmit()
}

function span(el: Element): Span {
  const r = el.getBoundingClientRect()
  return { top: r.top, bottom: r.bottom }
}

const MARGIN = 8

/** Scroll an element (a pane) by `delta` px; jsdom and old browsers have no Element.scrollBy. */
function scrollElementBy(el: HTMLElement, delta: number): void {
  if (typeof el.scrollBy === 'function') el.scrollBy({ top: delta, behavior: 'smooth' })
  else el.scrollTop += delta
}

/**
 * The problem screen's work area that scrolls on its own (the tablet layout's right pane: `data-pane-scroll` inside a
 * `data-pane`), when the box is in that layout. The keypad docks under that pane, so the band is the area's own box.
 */
function paneScroller(el: Element): HTMLElement | null {
  return el.closest('[data-pane]')?.querySelector<HTMLElement>('[data-pane-scroll]') ?? null
}

function revealInPane(el: HTMLInputElement, scroller: HTMLElement, reason: 'open' | 'check'): void {
  if (!scroller.contains(el)) {
    // The box is in the composer docked under the work: after a Check her newest line and its message, at the end of the
    // work, come into view.
    if (reason === 'check' && el.closest('[data-keypad-scroll="end"]')) scrollElementBy(scroller, scroller.scrollHeight)
    return
  }
  const region = el.closest('[data-keypad-region]') ?? el.closest('section') ?? el.closest('form') ?? el
  const block = el.closest('form') ?? el
  const box = scroller.getBoundingClientRect()
  const band = { top: box.top + MARGIN, bottom: box.bottom - MARGIN }
  if (band.bottom - band.top < 48) return
  const delta = revealDelta(span(el), span(region.contains(block) ? block : el), span(region), band)
  if (delta !== 0) scrollElementBy(scroller, delta)
}

/**
 * After a Check in the phone's composer: her newest line of work (the last `data-work-line`, WorkedColumn's rows) ends
 * right above the composer, which sits on the keypad. So the line she is writing, her last lines over it and the problem
 * strip at the top are what the screen shows; the work-list card under her line (the full lesson) waits behind the
 * composer, whose own line names the mistake, with Why? for the lesson. Without a line of work the page goes to its end.
 */
/** The room between her last line and the composer's top edge (px): a small phone needs every pixel. */
export const LINE_GAP = 4

function revealLastLines(el: HTMLInputElement, keypadHeight: number): void {
  const lines = document.querySelectorAll<HTMLElement>('[data-work-line]')
  const last = lines[lines.length - 1]
  const composer = el.closest<HTMLElement>('[data-keypad-region]')
  if (!last || !composer) {
    const end = document.documentElement.scrollHeight - window.innerHeight
    if (end > window.scrollY + 1) window.scrollTo({ top: end, behavior: 'smooth' })
    return
  }
  const vv = window.visualViewport
  const viewTop = vv?.offsetTop ?? 0
  const viewHeight = vv?.height ?? window.innerHeight
  const bandBottom = viewTop + viewHeight - keypadHeight - composer.getBoundingClientRect().height - LINE_GAP
  const delta = Math.round(last.getBoundingClientRect().bottom - bandBottom)
  if (delta !== 0) window.scrollBy({ top: delta, behavior: 'smooth' })
}

/**
 * Bring the box, its preview and the message about her answer into the band above the keypad. The
 * region is the part's card (`section`), or a container marked `data-keypad-region` (the composer).
 * After a Check, a box in a container marked `data-keypad-scroll="end"` (the line-by-line composer)
 * scrolls her newest line of work to just above the composer (revealLastLines). A bar docked on top
 * of the keypad (`data-keypad-dock`: the phone composer) takes its height off the band for every other
 * box, such as the answer box under the work. In the tablet layout's two panes the keypad is docked
 * under the work and the work's own area scrolls instead of the page.
 */
export function revealAboveKeypad(el: HTMLInputElement, keypadHeight: number, reason: 'open' | 'check'): void {
  if (!el.isConnected) return
  const scroller = paneScroller(el)
  if (scroller) {
    revealInPane(el, scroller, reason)
    return
  }
  if (keypadHeight <= 0) return
  if (reason === 'check' && el.closest('[data-keypad-scroll="end"]')) {
    revealLastLines(el, keypadHeight)
    return
  }
  const region = el.closest('[data-keypad-region]') ?? el.closest('section') ?? el.closest('form') ?? el
  const block = el.closest('form') ?? el
  // The part of the page on screen: the visual viewport (above the phone keyboard, when it is open).
  const vv = window.visualViewport
  const viewTop = vv?.offsetTop ?? 0
  const viewHeight = vv?.height ?? window.innerHeight
  const band = { top: viewTop + MARGIN, bottom: viewTop + viewHeight - keypadHeight - MARGIN }
  const dock = document.querySelector('[data-keypad-dock]')
  if (dock && !dock.contains(el)) band.bottom -= dock.getBoundingClientRect().height
  if (band.bottom - band.top < 48) return
  const delta = revealDelta(span(el), span(region.contains(block) ? block : el), span(region), band)
  if (delta !== 0) window.scrollBy({ top: delta, behavior: 'smooth' })
}
