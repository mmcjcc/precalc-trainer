import { useEffect, useRef } from 'react'

/**
 * Desktop keymap (docs/research/ux-mobile-progress.md UX-07):
 *   Enter submit · Esc clear/close · Ctrl+Shift+H hint rung · Ctrl+Shift+G graph ·
 *   Ctrl+Shift+C calculator · Ctrl+Z undo last accepted step · 1–9/0 pick chip while the chip
 *   group is active and focus is not in a text field · ? cheat-sheet.
 * Enter inside the math input is handled by its <form>; this hook covers everything else.
 */
export type KeyAction =
  | { kind: 'submit' }
  | { kind: 'escape' }
  | { kind: 'hint' }
  | { kind: 'graph' }
  | { kind: 'calc' }
  | { kind: 'undo' }
  | { kind: 'digit'; n: number }
  | { kind: 'help' }

export interface KeymapHandlers {
  onSubmit?: () => void
  onEscape?: () => void
  onHint?: () => void
  onGraph?: () => void
  onCalc?: () => void
  onUndo?: () => void
  /** 1–9 and 0 (n = 0..9) — fires only while `chipsActive` and focus is not in a text field. */
  onDigit?: (n: number) => void
  onHelp?: () => void
}

export interface KeymapOptions {
  /** Digits select chips only while the chip group is showing. */
  chipsActive?: boolean
  enabled?: boolean
}

export interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

export interface KeyTarget {
  /** Focus is in a text field (input/textarea/contenteditable). */
  inField: boolean
  /** That field is empty (Ctrl+Z then means "undo last step", not "undo typing"). */
  fieldEmpty: boolean
}

/** Pure key → action mapping so it can be unit-tested. Returns null when the key is not ours. */
export function matchKey(e: KeyLike, target: KeyTarget, opts: KeymapOptions = {}): KeyAction | null {
  const mod = e.ctrlKey || e.metaKey
  const key = e.key
  if (mod && e.shiftKey && !e.altKey) {
    const k = key.toLowerCase()
    if (k === 'h') return { kind: 'hint' }
    if (k === 'g') return { kind: 'graph' }
    if (k === 'c') return { kind: 'calc' }
    return null
  }
  if (mod && !e.shiftKey && !e.altKey && key.toLowerCase() === 'z') {
    // Inside a non-empty field the browser's own text undo wins.
    if (target.inField && !target.fieldEmpty) return null
    return { kind: 'undo' }
  }
  if (mod || e.altKey) return null
  if (key === 'Escape') return { kind: 'escape' }
  if (key === 'Enter' && !target.inField) return { kind: 'submit' }
  // Never inside a text field, even an empty one: the next line often starts with a digit (3x < 21),
  // and typing it skips the chip question. From the chips themselves (or the page) digits pick.
  if (opts.chipsActive && /^[0-9]$/.test(key) && !target.inField) {
    return { kind: 'digit', n: Number(key) }
  }
  if (key === '?' && !target.inField) return { kind: 'help' }
  return null
}

export function describeTarget(el: Element | null): KeyTarget {
  if (!el) return { inField: false, fieldEmpty: true }
  if (el instanceof HTMLInputElement) {
    const textual = !el.type || ['text', 'search', 'password', 'email', 'url', 'tel', 'number'].includes(el.type)
    return { inField: textual, fieldEmpty: el.value.length === 0 }
  }
  if (el instanceof HTMLTextAreaElement) return { inField: true, fieldEmpty: el.value.length === 0 }
  if (el instanceof HTMLElement && el.isContentEditable) return { inField: true, fieldEmpty: (el.textContent ?? '').length === 0 }
  return { inField: false, fieldEmpty: true }
}

/**
 * Attach the keymap to `window`. Handlers are read through a ref so callers can pass fresh closures
 * every render without re-subscribing.
 */
export function useKeymap(handlers: KeymapHandlers, opts: KeymapOptions = {}): void {
  const ref = useRef(handlers)
  ref.current = handlers
  const { chipsActive = false, enabled = true } = opts
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return
      const action = matchKey(e, describeTarget(document.activeElement), { chipsActive })
      if (!action) return
      const h = ref.current
      let handled = false
      switch (action.kind) {
        case 'submit':
          handled = Boolean(h.onSubmit)
          h.onSubmit?.()
          break
        case 'escape':
          handled = Boolean(h.onEscape)
          h.onEscape?.()
          break
        case 'hint':
          handled = Boolean(h.onHint)
          h.onHint?.()
          break
        case 'graph':
          handled = Boolean(h.onGraph)
          h.onGraph?.()
          break
        case 'calc':
          handled = Boolean(h.onCalc)
          h.onCalc?.()
          break
        case 'undo':
          handled = Boolean(h.onUndo)
          h.onUndo?.()
          break
        case 'digit':
          handled = Boolean(h.onDigit)
          h.onDigit?.(action.n)
          break
        case 'help':
          handled = Boolean(h.onHelp)
          h.onHelp?.()
          break
      }
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chipsActive, enabled])
}

/** Cheat-sheet rows for the `?` overlay. */
export const KEYMAP_HELP: { keys: string[]; does: string }[] = [
  { keys: ['Enter'], does: 'Check this step' },
  { keys: ['Esc'], does: 'Clear the input, or close the open panel' },
  { keys: ['Ctrl', 'Shift', 'H'], does: 'Next hint rung' },
  { keys: ['Ctrl', 'Shift', 'G'], does: 'Graph panel' },
  { keys: ['Ctrl', 'Shift', 'C'], does: 'Calculator panel' },
  { keys: ['Ctrl', 'Z'], does: 'Undo the last accepted step (when the input is empty)' },
  { keys: ['1–9', '0'], does: 'Pick a property chip (focus on the chips, not the input)' },
  { keys: ['Tab'], does: 'Skip the chip question' },
  { keys: ['?'], does: 'This cheat-sheet' },
]
