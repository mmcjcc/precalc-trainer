import { useEffect, useLayoutEffect, useMemo, useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { useVisualViewportOffset } from './Composer'
import { pressBackspace, pressInsert, pressMove, revealAboveKeypad, submitLikeEnter } from './keypadDom'
import { notePress, useKeypadStore, type KeypadMode, type KeypadTarget } from './keypadStore'
import { GRID_KEYS, allKeys, keypadLayout } from './keypadKeys'
import type { StripKey } from './symbolStrip'

/** A tap on a key must never take focus from the box: that would close the keypad (and the caret). */
const keepFocus = {
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
}

/**
 * Hand the box between the keypad and the phone's keyboard. A focused box keeps the keyboard it
 * opened with, so it is focused again once its inputmode has changed: the phone keyboard opens for
 * abc and closes for the keypad. The caret stays where it was.
 */
function switchMode(target: KeypadTarget, mode: KeypadMode) {
  const el = target.el
  const start = el.selectionStart
  const end = el.selectionEnd
  useKeypadStore.getState().setMode(target.id, mode)
  el.setAttribute('inputmode', mode === 'keypad' ? 'none' : target.inputMode)
  el.blur()
  el.focus({ preventScroll: true })
  if (start !== null) {
    try {
      el.setSelectionRange(start, end ?? start)
    } catch {
      /* harmless */
    }
  }
}

const KEY = 'kp-key flex items-center justify-center rounded-lg border text-navy active:border-gold active:bg-gold'
const TONE = {
  digit: 'border-navy-100 bg-white px-1 font-mono text-xl',
  op: 'border-navy-100 bg-navy-100 px-1 font-mono text-lg',
  letter: 'border-navy-100 bg-white px-1 font-mono text-xl italic',
  context: 'border-navy-100 bg-white px-2.5 font-mono text-base',
  control: 'border-navy-100 bg-navy-100 px-1 text-sm font-semibold',
  check: 'border-navy bg-navy px-2 text-base font-semibold text-white active:text-navy',
} as const

const REPEAT_AFTER_MS = 450
const REPEAT_EVERY_MS = 70

function Key({
  name,
  area,
  tone,
  onPress,
  repeat = false,
  children,
}: {
  name: string
  area?: string
  tone: keyof typeof TONE
  onPress: () => void
  /** Held down, the key repeats (delete). */
  repeat?: boolean
  children: ReactNode
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const repeated = useRef(false)
  const stop = () => clearTimeout(timer.current)
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={name}
      onPointerDown={(e) => {
        e.preventDefault()
        if (!repeat) return
        stop()
        repeated.current = false
        const tick = () => {
          repeated.current = true
          onPress()
          timer.current = setTimeout(tick, REPEAT_EVERY_MS)
        }
        timer.current = setTimeout(tick, REPEAT_AFTER_MS)
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onMouseDown={keepFocus.onMouseDown}
      onClick={() => {
        notePress()
        // The click that ends a held, repeating key has already been counted.
        if (repeated.current) {
          repeated.current = false
          return
        }
        onPress()
      }}
      style={area ? { gridArea: area } : undefined}
      className={`${KEY} ${TONE[tone]}`}
    >
      {children}
    </button>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICON = {
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  hide: 'M6 9l6 6 6-6',
  backspace: 'M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM17 9l-6 6M11 9l6 6',
}

/** Grid cells in reading order; GRID_KEYS fill the ones they name. */
const CELLS = ['var', 'pow', 'd7', 'd8', 'd9', 'div', 'lp', 'rp', 'd4', 'd5', 'd6', 'mul', 'comma', 'sq', 'd1', 'd2', 'd3', 'sub', 'abc', 'hide', 'd0', 'dot', 'eq', 'add', 'left', 'right', 'del', 'check'] as const
const GRID_BY_AREA = new Map(GRID_KEYS.map((k) => [k.area, k]))

function KeypadPanel({ target }: { target: KeypadTarget }) {
  const panel = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => keypadLayout(target.keys, target.vars), [target.keys, target.vars])
  const keys = useMemo(() => allKeys(layout), [layout])
  const el = target.el
  useMeasuredHeight(panel)

  /** Run a key, then give focus back to the box if a screen reader's tap moved it onto the key. */
  function edit(fn: () => void) {
    return () => {
      fn()
      if (el.isConnected && document.activeElement !== el && panel.current?.contains(document.activeElement)) el.focus({ preventScroll: true })
    }
  }

  const insert = (k: StripKey) => edit(() => pressInsert(el, k))

  function cell(area: (typeof CELLS)[number]): ReactNode {
    const grid = GRID_BY_AREA.get(area)
    if (grid) {
      return (
        <Key key={area} name={grid.name} area={area} tone={grid.tone} onPress={insert(grid)}>
          {grid.label}
        </Key>
      )
    }
    switch (area) {
      case 'var':
        return (
          <Key key={area} name={layout.primary.name} area={area} tone="letter" onPress={insert(layout.primary)}>
            {layout.primary.label}
          </Key>
        )
      case 'abc':
        return (
          <Key key={area} name="abc keyboard" area={area} tone="control" onPress={() => switchMode(target, 'abc')}>
            abc
          </Key>
        )
      case 'hide':
        return (
          <Key
            key={area}
            name="hide keypad"
            area={area}
            tone="control"
            onPress={() => {
              el.blur()
              useKeypadStore.getState().deactivate(target.id)
            }}
          >
            <Icon d={ICON.hide} />
          </Key>
        )
      case 'left':
        return (
          <Key key={area} name="left" area={area} tone="control" onPress={edit(() => pressMove(el, -1))}>
            <Icon d={ICON.left} />
          </Key>
        )
      case 'right':
        return (
          <Key key={area} name="right" area={area} tone="control" onPress={edit(() => pressMove(el, 1))}>
            <Icon d={ICON.right} />
          </Key>
        )
      case 'del':
        return (
          <Key key={area} name="delete" area={area} tone="control" repeat onPress={edit(() => pressBackspace(el, keys))}>
            <Icon d={ICON.backspace} />
          </Key>
        )
      case 'check':
        return (
          <Key
            key={area}
            name="check"
            area={area}
            tone="check"
            onPress={() => {
              submitLikeEnter(el)
              useKeypadStore.getState().checked()
            }}
          >
            <span aria-hidden className="mr-1">
              ✓
            </span>
            Check
          </Key>
        )
      default:
        return null
    }
  }

  return (
    <div ref={panel} data-math-keypad="" role="group" aria-label="Math keypad" className="math-keypad">
      <div className="kp-inner">
        {layout.context.length > 0 && (
          <div className="kp-context">
            {layout.context.map((k) => (
              <Key key={k.insert + k.label} name={k.name} tone={/^[a-z]$/i.test(k.insert) ? 'letter' : 'context'} onPress={insert(k)}>
                {k.label}
              </Key>
            ))}
          </div>
        )}
        <div className="kp-grid">{CELLS.map(cell)}</div>
      </div>
    </div>
  )
}

/**
 * While a box is on the phone's keyboard (abc): a slim bar right above that keyboard whose 123 key
 * brings the keypad back. It keeps its own room (`--keypad-h`) like the keypad, so the composer and the
 * box stay above it, and once the keyboard has opened (the visual viewport shrinks) the box is brought
 * back into view above the bar.
 */
function AbcBar({ target }: { target: KeypadTarget }) {
  const bar = useRef<HTMLDivElement>(null)
  const offset = useVisualViewportOffset(true)
  useMeasuredHeight(bar)
  const el = target.el

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const onResize = () => {
      clearTimeout(timer)
      timer = setTimeout(() => revealAboveKeypad(el, useKeypadStore.getState().height, 'open'), 80)
    }
    vv.addEventListener('resize', onResize)
    return () => {
      clearTimeout(timer)
      vv.removeEventListener('resize', onResize)
    }
  }, [el])

  return (
    <div ref={bar} data-math-keypad="" className="kp-abc-bar" style={offset ? { transform: `translateY(${offset}px)` } : undefined}>
      <div className="mx-auto flex max-w-xl items-center justify-end">
        <button
          type="button"
          tabIndex={-1}
          aria-label="show math keypad"
          {...keepFocus}
          onClick={() => {
            notePress()
            switchMode(target, 'keypad')
          }}
          className="kp-key flex min-w-16 items-center justify-center rounded-lg border-2 border-navy bg-white px-3 font-mono text-lg font-semibold text-navy active:bg-gold"
        >
          123
        </button>
      </div>
    </div>
  )
}

/** Report an element's height to the store (the room the page keeps for it); 0 once it is gone. */
function useMeasuredHeight(ref: RefObject<HTMLDivElement | null>) {
  const setHeight = useKeypadStore((s) => s.setHeight)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const measure = () => setHeight(Math.round(node.getBoundingClientRect().height))
    measure()
    if (typeof ResizeObserver === 'undefined') return () => setHeight(0)
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => {
      observer.disconnect()
      setHeight(0)
    }
  }, [ref, setHeight])
}

/**
 * The math keypad: one fixed panel at the bottom of the screen, for whichever math box has focus.
 * Mount it once (the app shell). It does not know which page it is on: a box tells it, through
 * `useMathKeypad`, that it has focus and which keys it takes. While it is open the page keeps room
 * for it at the bottom (`--keypad-h`), so the composer, the box and her messages stay above it.
 */
export function MathKeypad() {
  const target = useKeypadStore((s) => s.target)
  const mode = useKeypadStore((s) => (s.target ? (s.modes[s.target.id] ?? 'keypad') : 'keypad'))
  const height = useKeypadStore((s) => s.height)
  const checks = useKeypadStore((s) => s.checks)
  const shown = target !== null
  const open = shown && mode === 'keypad'
  const targetEl = target?.el ?? null

  useEffect(() => useKeypadStore.getState().addHost(), [])

  // The keypad (or the abc bar) keeps its room at the bottom of the page.
  useLayoutEffect(() => {
    if (!shown || height <= 0) return
    const root = document.documentElement
    root.style.setProperty('--keypad-h', `${height}px`)
    return () => {
      root.style.removeProperty('--keypad-h')
    }
  }, [shown, height])

  // The focused box scrolls into view above the keypad.
  useLayoutEffect(() => {
    if (open && targetEl && height > 0) revealAboveKeypad(targetEl, height, 'open')
  }, [open, targetEl, height])

  // After a Check, once the page has answered, bring the message about her answer into view.
  const seenChecks = useRef(checks)
  useEffect(() => {
    if (checks === seenChecks.current) return
    seenChecks.current = checks
    const timer = setTimeout(() => {
      const s = useKeypadStore.getState()
      if (s.target && (s.modes[s.target.id] ?? 'keypad') === 'keypad') revealAboveKeypad(s.target.el, s.height, 'check')
    }, 60)
    return () => clearTimeout(timer)
  }, [checks])

  if (!target) return null
  return open ? <KeypadPanel target={target} /> : <AbcBar target={target} />
}
