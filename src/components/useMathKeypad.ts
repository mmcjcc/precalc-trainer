/**
 * How a math box opts into the math keypad. The box keeps its own value, onChange, preview, parser and
 * Check; the keypad only types into it. On a touch screen (a coarse pointer) with the "Math keypad"
 * setting on, the box gets inputMode="none" (so focusing it shows the keypad, not the phone's
 * keyboard) and tells the keypad, while it has focus, which keys it takes. Everywhere else nothing
 * changes: same inputMode, same symbol strip.
 *
 *   const kp = useMathKeypad({ keys: LOG_KEYS, disabled })
 *   <input ref={kp.ref} inputMode={kp.inputMode} onFocus={kp.onFocus} onBlur={kp.onBlur} onClick={kp.onClick} … />
 *   {!kp.on && <SymbolStrip … />}
 *
 * (`MathTextInput` does exactly this for any `<input>`; `MathInput` does it for itself.)
 */
import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { useStore } from '@/store'
import { pressedRecently, useKeypadStore, type InputMode } from './keypadStore'
import type { StripKey } from './symbolStrip'

const COARSE = '(pointer: coarse)'

function coarseQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(COARSE)
}

function subscribeCoarse(onChange: () => void): () => void {
  const mq = coarseQuery()
  if (!mq) return () => {}
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }
  mq.addListener?.(onChange)
  return () => mq.removeListener?.(onChange)
}

/** The primary pointer is a finger (a phone or a tablet), not a mouse or a trackpad. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, () => coarseQuery()?.matches === true, () => false)
}

/** The "Math keypad" setting: absent means on (it only ever applies to a touch screen). */
export function useMathKeypadSetting(): boolean {
  return useStore((s) => s.settings.mathKeypad !== false)
}

/** Math boxes use the keypad here: a touch screen, the setting on, and a keypad mounted to type with. */
export function useMathKeypadOn(): boolean {
  const coarse = useCoarsePointer()
  const setting = useMathKeypadSetting()
  const mounted = useKeypadStore((s) => s.hosts > 0)
  return coarse && setting && mounted
}

export interface MathKeypadOptions {
  /** The box's strip keys: its letters and its context row. */
  keys?: readonly StripKey[]
  /** The box's letters when they are not the strip's (a range answer is written in y). */
  vars?: readonly string[]
  /** The box's inputMode on the phone's own keyboard (default 'text'). */
  inputMode?: InputMode
  disabled?: boolean
  /** false: an ordinary box that never uses the keypad. */
  enabled?: boolean
}

export interface MathKeypadBinding {
  /** The keypad replaces the phone keyboard and the symbol strip for this box. */
  on: boolean
  ref: (el: HTMLInputElement | null) => void
  inputMode: InputMode
  onFocus: () => void
  onBlur: () => void
  /** A tap on the box opens the keypad (also when the box already had focus). */
  onClick: () => void
}

const NO_KEYS: readonly StripKey[] = []

export function useMathKeypad({ keys = NO_KEYS, vars, inputMode = 'text', disabled = false, enabled = true }: MathKeypadOptions = {}): MathKeypadBinding {
  const id = useId()
  const on = useMathKeypadOn() && enabled
  const live = on && !disabled
  const mode = useKeypadStore((s) => s.modes[id] ?? 'keypad')
  const elRef = useRef<HTMLInputElement | null>(null)
  const spec = useRef({ keys, vars, inputMode, live })
  spec.current = { keys, vars, inputMode, live }

  const activate = useCallback(() => {
    const el = elRef.current
    const s = spec.current
    if (!el || !s.live) return
    useKeypadStore.getState().activate({ id, el, keys: s.keys, vars: s.vars, inputMode: s.inputMode })
  }, [id])

  const ref = useCallback((el: HTMLInputElement | null) => {
    elRef.current = el
  }, [])

  // Focus opens the keypad when it carries on from the keypad: it is already open (focus moving from
  // box to box) or a key was just pressed (Check, then the next part's box). Focus the page gives on
  // its own, like autofocus on load, leaves the caret in the box and waits for a tap, as the phone's
  // keyboard does.
  const onFocus = useCallback(() => {
    if (useKeypadStore.getState().target !== null || pressedRecently()) activate()
  }, [activate])

  const onBlur = useCallback(() => {
    // Focus may be on its way to another math box (which takes the keypad over) or, with a screen
    // reader, onto a key of the keypad itself. Decide once it has landed.
    setTimeout(() => {
      const store = useKeypadStore.getState()
      if (store.target?.id !== id) return
      const active = document.activeElement
      if (active && active === elRef.current) return
      if (active instanceof Element && active.closest('[data-math-keypad]')) return
      store.deactivate(id)
    }, 0)
  }, [id])

  // Keep the keypad's target current while this box has it: the keys of a new part; the keypad closes
  // when the box is disabled or the setting is switched off.
  const signature = `${keys.map((k) => k.insert).join('\u0001')}|${(vars ?? []).join(',')}|${inputMode}`
  useEffect(() => {
    const store = useKeypadStore.getState()
    if (!live) {
      store.deactivate(id)
      return
    }
    if (store.target?.id === id) activate()
  }, [live, signature, activate, id])

  useEffect(() => () => useKeypadStore.getState().forget(id), [id])

  return { on, ref, inputMode: live && mode === 'keypad' ? 'none' : inputMode, onFocus, onBlur, onClick: activate }
}
