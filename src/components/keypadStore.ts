/**
 * Which math box the keypad is typing into. One keypad serves the whole app: a box registers itself
 * here while it has focus, and the keypad (mounted once, in the app shell) reads the target and edits
 * that box. Neither the keypad nor this store knows which page the box is on.
 */
import type { HTMLAttributes } from 'react'
import { create } from 'zustand'
import type { StripKey } from './symbolStrip'

export type InputMode = NonNullable<HTMLAttributes<HTMLInputElement>['inputMode']>

/** 'keypad': the math keypad. 'abc': this box is on the phone's own keyboard, for words. */
export type KeypadMode = 'keypad' | 'abc'

export interface KeypadTarget {
  /** Stable per box (React useId). */
  id: string
  el: HTMLInputElement
  /** The box's strip keys (the context row and its letters). */
  keys: readonly StripKey[]
  /** The box's letters when they differ from its strip's. */
  vars?: readonly string[]
  /** The box's inputMode on the phone's keyboard ('text', 'numeric', …). */
  inputMode: InputMode
  /**
   * What the Check key says and is called in this box, when the box checks nothing (a grapher row: "Next"). It still
   * does what Enter does. Absent: "✓ Check".
   */
  enter?: KeypadEnter
}

export interface KeypadEnter {
  label: string
  name: string
}

interface KeypadState {
  /** Mounted keypads. A box only hands over to the keypad when one is there to type with. */
  hosts: number
  target: KeypadTarget | null
  /** Per box id; absent means the keypad. Forgotten when the box unmounts. */
  modes: Record<string, KeypadMode>
  /** Height of the open keypad in px (0 when closed). */
  height: number
  /** Bumped by each Check, so the keypad can bring her message into view once the page answers. */
  checks: number
  /**
   * Where the keypad docks instead of covering the bottom of the screen: the problem screen's right pane in the tablet
   * layout gives its slot here while it is mounted (components/PageLayout.tsx). Null: fixed at the bottom.
   */
  dock: HTMLElement | null
  addHost: () => () => void
  activate: (target: KeypadTarget) => void
  deactivate: (id: string) => void
  setMode: (id: string, mode: KeypadMode) => void
  forget: (id: string) => void
  setHeight: (height: number) => void
  checked: () => void
  /** A layout gives its slot (an element) or takes it back (null, only when it is still the one it gave). */
  setDock: (dock: HTMLElement | null, from?: HTMLElement) => void
}

function sameTarget(a: KeypadTarget | null, b: KeypadTarget): boolean {
  return (
    a !== null &&
    a.id === b.id &&
    a.el === b.el &&
    a.inputMode === b.inputMode &&
    a.keys === b.keys &&
    (a.vars ?? []).join() === (b.vars ?? []).join() &&
    a.enter?.label === b.enter?.label &&
    a.enter?.name === b.enter?.name
  )
}

export const useKeypadStore = create<KeypadState>()((set, get) => ({
  hosts: 0,
  target: null,
  modes: {},
  height: 0,
  checks: 0,
  dock: null,
  addHost: () => {
    set((s) => ({ hosts: s.hosts + 1 }))
    return () => set((s) => ({ hosts: Math.max(0, s.hosts - 1) }))
  },
  activate: (target) => {
    if (sameTarget(get().target, target)) return
    set({ target })
  },
  deactivate: (id) => {
    if (get().target?.id === id) set({ target: null })
  },
  setMode: (id, mode) =>
    set((s) => {
      const modes = { ...s.modes }
      if (mode === 'keypad') delete modes[id]
      else modes[id] = mode
      return { modes }
    }),
  forget: (id) =>
    set((s) => {
      if (!(id in s.modes) && s.target?.id !== id) return s
      const modes = { ...s.modes }
      delete modes[id]
      return { modes, target: s.target?.id === id ? null : s.target }
    }),
  setHeight: (height) => {
    if (get().height !== height) set({ height })
  },
  checked: () => set((s) => ({ checks: s.checks + 1 })),
  setDock: (dock, from) => {
    if (dock === null && from !== undefined && get().dock !== from) return
    if (get().dock !== dock) set({ dock })
  },
}))

/**
 * When a keypad key was last pressed. Focus that follows a press (Check moves her to the next part's
 * box) keeps the keypad open; focus the page gives on its own (autofocus on load) waits for a tap, as
 * the phone's keyboard does.
 */
let lastPress = Number.NEGATIVE_INFINITY
const PRESS_CARRIES_MS = 1500

export function notePress(now = Date.now()): void {
  lastPress = now
}

export function pressedRecently(now = Date.now()): boolean {
  return now - lastPress < PRESS_CARRIES_MS
}

/** Tests: back to no keypad, no target. */
export function resetKeypadForTests(): void {
  lastPress = Number.NEGATIVE_INFINITY
  useKeypadStore.setState({ hosts: 0, target: null, modes: {}, height: 0, checks: 0, dock: null })
}
