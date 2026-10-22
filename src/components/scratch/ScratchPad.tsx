import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { addStroke, canRedo, canUndo, clearPad, extendStroke, INKS, padOf, redoPad, startStroke, undoPad, UNITS, type Ink, type PadState, type Stroke, type Tool } from './ink'
import { drawPad, INK_COLOR, type PadContext } from './draw'
import { loadPad, readPaper, savePad, writePaper } from './scratchStorage'

/**
 * The pads open in this page session, by attempt: closing the phone's sheet (or switching the pane to its tools) and
 * opening it again keeps the strokes and the undo history; a reload reads the strokes back from the device.
 */
const sessions = new Map<string, PadState>()
/** The tool last used, for the next time a pad opens. */
let lastTool: { tool: Tool; ink: Ink } = { tool: 'pen', ink: 'navy' }

/** Tests: forget the open pads, as a reload does (what is stored on the device stays). */
export function forgetScratchSessions(): void {
  sessions.clear()
  lastTool = { tool: 'pen', ink: 'navy' }
}

function openPad(attemptId: string): PadState {
  return sessions.get(attemptId) ?? padOf(loadPad(attemptId) ?? [])
}

const INK_NAME: Record<Ink, string> = { navy: 'navy', red: 'red', green: 'green' }

/** A stroke being drawn: the pointer drawing it and what kind of pointer it is. */
interface Live {
  id: number
  type: string
  stroke: Stroke
}

function Icon({ d, fill = false }: { d: string; fill?: boolean }) {
  return (
    <svg aria-hidden focusable="false" width="22" height="22" viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICON = {
  highlighter: 'M9 11l-5 5v4h4l5-5M9 11l6-6 4 4-6 6M9 11l4 4M14 20h6',
  eraser: 'M7 20h13M4.6 15.4l9.8-9.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L11 19H8.2a2 2 0 0 1-1.4-.6l-2.2-2.2a2 2 0 0 1 0-2.8zM9 11l5 5',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  clear: 'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  paper: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16',
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  popup,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  /** The button opens a question (Clear). */
  popup?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      aria-haspopup={popup ? 'dialog' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-navy disabled:opacity-40 ${
        pressed ? 'border-navy bg-navy-100' : 'border-navy-100 bg-white hover:bg-navy-50'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * The scratch pad (docs/progress/app-tablet.md): a drawing surface for a finger or a stylus beside the problem, for her
 * own working. Pens in three inks, a highlighter, an eraser, undo and redo, clear (it asks first), graph paper that can be
 * turned off. One pad per problem attempt, kept on this device (components/scratch/scratchStorage.ts): a reload or Back
 * and return brings it back. With a stylus in use the hand resting on the screen does not draw (palm rejection by
 * pointer type); a stylus's pressure thickens the pen. The app never reads it: the canvas is a picture named as her own
 * drawing area, and every tool is a named button. The layout decides where it opens (a sheet on a phone, a view of the
 * left pane on a tablet); `size` only sets how tall the drawing area is.
 */
export function ScratchPad({ attemptId, size }: { attemptId: string; size: 'sheet' | 'pane' }) {
  const id = useId()
  const [pad, setPad] = useState<PadState>(() => openPad(attemptId))
  const [padFor, setPadFor] = useState(attemptId)
  if (padFor !== attemptId) {
    // Another attempt (the next problem in the same place): its own pad.
    setPadFor(attemptId)
    setPad(openPad(attemptId))
  }
  const [tool, setToolState] = useState<Tool>(lastTool.tool)
  const [ink, setInkState] = useState<Ink>(lastTool.ink)
  const [paper, setPaperState] = useState(readPaper)
  const [asking, setAsking] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef(pad)
  padRef.current = pad
  const sizeRef = useRef({ width: 1, height: 1 })
  const live = useRef<Live | null>(null)
  /** A stylus has drawn on this pad since it opened: from then on a touch is the hand, not a finger drawing. */
  const penSeen = useRef(false)
  const keepRef = useRef<HTMLButtonElement>(null)
  const clearRef = useRef<HTMLButtonElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const choose = (nextTool: Tool, nextInk: Ink = ink) => {
    setToolState(nextTool)
    setInkState(nextInk)
    lastTool = { tool: nextTool, ink: nextInk }
  }

  const change = useCallback(
    (next: PadState) => {
      const before = padRef.current
      padRef.current = next
      sessions.set(attemptId, next)
      setPad(next)
      if (next.strokes !== before.strokes) savePad(attemptId, next.strokes)
    },
    [attemptId],
  )

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d') as PadContext | null
    if (!ctx) return
    const { width, height } = sizeRef.current
    drawPad(ctx, padRef.current.strokes, width / UNITS, width, height, live.current?.stroke)
  }, [])

  // The canvas matches its box (in device pixels, for sharp lines) and redraws when the box changes.
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fit = () => {
      const r = canvas.getBoundingClientRect()
      const width = Math.max(1, Math.round(r.width))
      const height = Math.max(1, Math.round(r.height))
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      sizeRef.current = { width, height }
      const ctx = canvas.getContext('2d') as (PadContext & { setTransform?: (a: number, b: number, c: number, d: number, e: number, f: number) => void }) | null
      ctx?.setTransform?.(dpr, 0, 0, dpr, 0, 0)
      redraw()
    }
    fit()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null
    observer?.observe(canvas)
    window.addEventListener('resize', fit)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [redraw])

  useEffect(() => {
    redraw()
  }, [pad, redraw])

  useEffect(() => {
    if (asking) keepRef.current?.focus()
  }, [asking])

  /** A pointer's place in pad units. */
  const toPad = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect()
    const w = r.width || sizeRef.current.width || 1
    return { x: ((e.clientX - r.left) / w) * UNITS, y: ((e.clientY - r.top) / w) * UNITS }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      penSeen.current = true
      // A palm that touched down before the stylus does not leave a mark.
      if (live.current && live.current.type !== 'pen') live.current = null
    } else if (e.pointerType === 'touch' && (penSeen.current || live.current?.type === 'pen')) {
      return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // One stroke at a time: a second finger does nothing.
    if (live.current) return
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* harmless: the stroke still follows the pointer over the canvas */
    }
    const { x, y } = toPad(e)
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : undefined
    live.current = { id: e.pointerId, type: e.pointerType, stroke: startStroke(tool, ink, x, y, pressure) }
    redraw()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const l = live.current
    if (!l || e.pointerId !== l.id) return
    const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }
    const events = native.getCoalescedEvents?.() ?? []
    const points = events.length > 0 ? events : [native]
    let moved = false
    for (const p of points) {
      const { x, y } = toPad(p)
      if (extendStroke(l.stroke, x, y, l.stroke.p ? p.pressure : undefined)) moved = true
    }
    if (moved) redraw()
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const l = live.current
    if (!l || e.pointerId !== l.id) return
    live.current = null
    change(addStroke(padRef.current, l.stroke))
  }

  const onPointerCancel = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (live.current?.id !== e.pointerId) return
    live.current = null
    redraw()
  }

  const togglePaper = () => {
    const next = !paper
    setPaperState(next)
    writePaper(next)
  }

  const answer = (clear: boolean) => {
    setAsking(false)
    if (clear) change(clearPad(padRef.current))
    // Back to the button that asked; once the pad is empty that one is off, so to Undo (which can bring it back).
    setTimeout(() => (clear ? toolbarRef.current?.querySelector<HTMLButtonElement>('[aria-label="Undo"]') : clearRef.current)?.focus(), 0)
  }

  const empty = pad.strokes.length === 0
  return (
    <div className="space-y-2" data-scratch-pad="" data-scratch-for={attemptId}>
      <div ref={toolbarRef} role="toolbar" aria-label="Scratch pad tools" className="flex flex-wrap items-center gap-1.5">
        {INKS.map((k) => (
          <ToolButton key={k} label={`Pen, ${INK_NAME[k]}`} pressed={tool === 'pen' && ink === k} onClick={() => choose('pen', k)}>
            <span aria-hidden className="block h-5 w-5 rounded-full" style={{ background: INK_COLOR[k] }} />
          </ToolButton>
        ))}
        <ToolButton label="Highlighter" pressed={tool === 'highlighter'} onClick={() => choose('highlighter')}>
          <Icon d={ICON.highlighter} />
        </ToolButton>
        <ToolButton label="Eraser" pressed={tool === 'eraser'} onClick={() => choose('eraser')}>
          <Icon d={ICON.eraser} />
        </ToolButton>
        <span aria-hidden className="mx-0.5 h-7 w-px bg-navy-100" />
        <ToolButton label="Undo" disabled={!canUndo(pad)} onClick={() => change(undoPad(padRef.current))}>
          <Icon d={ICON.undo} />
        </ToolButton>
        <ToolButton label="Redo" disabled={!canRedo(pad)} onClick={() => change(redoPad(padRef.current))}>
          <Icon d={ICON.redo} />
        </ToolButton>
        <button
          ref={clearRef}
          type="button"
          aria-label="Clear the pad"
          title="Clear the pad"
          aria-haspopup="dialog"
          disabled={empty}
          onClick={() => setAsking(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-navy-100 bg-white text-navy hover:bg-navy-50 disabled:opacity-40"
        >
          <Icon d={ICON.clear} />
        </button>
        <ToolButton label="Graph paper" pressed={paper} onClick={togglePaper}>
          <Icon d={ICON.paper} />
        </ToolButton>
      </div>
      <p className="text-xs text-navy/70" id={`${id}-note`}>
        For your own working. Nothing on the pad is read or checked.
      </p>
      <div className={`relative overflow-hidden rounded-xl border border-navy-100 ${paper ? 'scratch-paper' : 'bg-white'} ${size === 'sheet' ? 'h-[52dvh]' : 'h-[min(68dvh,44rem)]'}`} data-paper={paper ? '' : undefined}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Scratch pad: a drawing area for your own working. The app does not read or check what you draw here."
          className="scratch-surface absolute inset-0 h-full w-full"
          data-scratch-canvas=""
          data-strokes={pad.strokes.length}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onLostPointerCapture={onPointerCancel}
        />
        {asking && (
          <div
            role="alertdialog"
            aria-labelledby={`${id}-clear-title`}
            aria-describedby={`${id}-clear-body`}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                answer(false)
              }
            }}
            className="absolute inset-x-3 top-3 space-y-2 rounded-2xl border border-navy-100 bg-white p-3 shadow-lg"
          >
            <p id={`${id}-clear-title`} className="font-semibold text-navy">
              Clear the scratch pad?
            </p>
            <p id={`${id}-clear-body`} className="text-sm text-navy/80">
              Everything on it goes. Undo brings it back while the pad is open.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => answer(true)} className="min-h-11 rounded-xl bg-bad px-4 font-semibold text-white hover:opacity-90">
                Clear it
              </button>
              <button
                ref={keepRef}
                type="button"
                onClick={() => answer(false)}
                className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
