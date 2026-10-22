import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { GraphModel } from '@/grapher/model'
import type { Poi } from '@/grapher/poi'
import type { Quality } from '@/grapher/sample'
import { blendWindows, panBy, pinchWindow, sameWindow, xToPx, yToPx, zoomAt, ZOOM_STEP, type Px, type ViewWindow } from '@/grapher/view'
import { buildScene, drawScene, hitTest, type Hit, type RowLook, type Scene } from './draw'

interface Props {
  model: GraphModel
  looks: readonly RowLook[]
  /** Changes whenever the drawing changes but the model object does not (a slider moved, DEGREE). */
  stamp: string
  window: ViewWindow
  onWindow: (w: ViewWindow) => void
  pois: readonly Poi[]
  marker: { x: number; y: number; color: string; text: string } | null
  onTap: (hit: Hit | null) => void
  /** The plane's name and the id of its text description. */
  label: string
  describedBy: string
  onFit: () => void
  onStandard: () => void
  /** Zooms glide (motion allowed); under reduced motion they jump. */
  animate: boolean
}

const TAP_SLOP_PX = 6
const ANIMATE_MS = 220

const raf = (cb: () => void): number => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number))
const caf = (id: number) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id))

function ZoomIcon({ kind }: { kind: 'in' | 'out' | 'fit' | 'home' }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (kind) {
    case 'in':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'out':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      )
    case 'fit':
      return (
        <svg {...common}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          <path d="M8 15c2-6 6-6 8 0" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h14V9.5" />
        </svg>
      )
  }
}

const CONTROL = 'flex h-11 w-11 items-center justify-center rounded-xl border border-navy-100 bg-white/95 text-navy shadow-sm hover:bg-navy-50 active:bg-gold'

/**
 * The plane: a canvas the size of its box (sharp on a phone's dense screen), drawn again on the next frame whenever
 * the graph or the window changes. Drag to pan, pinch (or the wheel, or a trackpad's pinch) to zoom about the fingers;
 * while a finger moves the curves are sampled more coarsely, and drawn finely again when it lifts, when the window is
 * saved. A tap finds a point of interest, one of her points or a curve (to trace). The +, −, Zoom to fit and standard
 * window buttons sit on the plane's corner; they glide unless motion is reduced.
 */
export function Plane(props: Props) {
  const { stamp, window: committed, animate } = props
  const surfaceRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const latest = useRef(props)
  latest.current = props
  const size = useRef({ w: 0, h: 0, dpr: 1 })
  const view = useRef<ViewWindow>(committed)
  const frame = useRef<number | null>(null)
  const quality = useRef<Quality>('full')
  const scene = useRef<Scene | null>(null)
  const pointers = useRef(new Map<number, Px>())
  const gesture = useRef<{ kind: 'pan' | 'pinch'; start: ViewWindow; from: Map<number, Px>; moved: boolean; at: number } | null>(null)
  const anim = useRef<number | null>(null)
  const wheelCommit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const draw = useCallback(() => {
    frame.current = null
    const canvas = canvasRef.current
    const { w, h, dpr } = size.current
    if (!canvas || w <= 0 || h <= 0) return
    const p = latest.current
    const s = buildScene(p.model, p.looks, view.current, w, h, quality.current)
    const colorOf = new Map(p.looks.map((l, i) => [i, l.color]))
    s.pois = p.pois.map((poi) => ({ poi, color: colorOf.get(poi.rows[0]!) ?? '#000' }))
    s.marker = p.marker ? { x: p.marker.x, y: p.marker.y, color: p.marker.color } : null
    scene.current = s
    const ctx = canvas.getContext('2d')
    if (ctx) drawScene(ctx, s, dpr)
    // The picked point's label follows it, kept inside the plane.
    const label = labelRef.current
    if (label) {
      if (p.marker) {
        const px = xToPx(view.current, w, p.marker.x)
        const py = yToPx(view.current, h, p.marker.y)
        const inside = px >= -2 && px <= w + 2 && py >= -2 && py <= h + 2
        label.style.display = inside ? 'block' : 'none'
        const lw = label.offsetWidth || 120
        const lh = label.offsetHeight || 30
        const left = Math.max(4, Math.min(w - lw - 4, px - lw / 2))
        const top = py - lh - 12 < 4 ? py + 12 : py - lh - 12
        label.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.min(h - lh - 4, top))}px)`
      } else label.style.display = 'none'
    }
  }, [])

  const schedule = useCallback(
    (q: Quality) => {
      quality.current = q
      if (frame.current === null) frame.current = raf(draw)
    },
    [draw],
  )

  // ---- size ----
  useLayoutEffect(() => {
    const surface = surfaceRef.current
    const canvas = canvasRef.current
    if (!surface || !canvas) return
    const measure = () => {
      const r = surface.getBoundingClientRect()
      // jsdom (tests) measures 0: draw at a nominal size so the drawing can be checked.
      const w = r.width > 0 ? r.width : 400
      const h = r.height > 0 ? r.height : 300
      const dpr = Math.min(3, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1))
      if (w === size.current.w && h === size.current.h && dpr === size.current.dpr) return
      size.current = { w, h, dpr }
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      schedule('full')
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(surface)
    return () => ro.disconnect()
  }, [schedule])

  // ---- what to draw changed ----
  useEffect(() => schedule('full'), [stamp, props.model, props.pois, props.marker, props.looks, schedule])

  useEffect(
    () => () => {
      if (frame.current !== null) caf(frame.current)
      if (anim.current !== null) caf(anim.current)
      clearTimeout(wheelCommit.current)
    },
    [],
  )

  const commit = useCallback(() => {
    latest.current.onWindow(view.current)
    schedule('full')
  }, [schedule])

  /** Move the view to `target`, gliding where motion is allowed; `save` commits it when it gets there. */
  const glideTo = useCallback(
    (target: ViewWindow, save: boolean) => {
      if (anim.current !== null) caf(anim.current)
      anim.current = null
      const arrive = () => {
        view.current = target
        if (save) commit()
        else schedule('full')
      }
      if (!animate) {
        arrive()
        return
      }
      const from = view.current
      const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const t0 = now()
      const step = () => {
        const t = Math.min(1, (now() - t0) / ANIMATE_MS)
        view.current = blendWindows(from, target, 1 - (1 - t) ** 3)
        if (t < 1) {
          anim.current = raf(step)
          schedule('fast')
        } else {
          anim.current = null
          arrive()
        }
      }
      anim.current = raf(step)
    },
    [animate, commit, schedule],
  )

  // A window from the page (Zoom to fit, the standard window, a problem's window, a reload) glides in too; the one the
  // plane just saved itself is already in view.
  useEffect(() => {
    if (gesture.current) return
    if (!sameWindow(view.current, committed, 1e-9)) glideTo(committed, false)
  }, [committed, glideTo])

  const zoomBy = (factor: number) => {
    const { w, h } = size.current
    glideTo(zoomAt(view.current, factor, w || 400, h || 300), true)
  }

  // ---- the wheel (and a trackpad's pinch) zooms about the pointer ----
  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // The wheel takes over from a zoom that is still gliding.
      if (anim.current !== null) {
        caf(anim.current)
        anim.current = null
      }
      const r = surface.getBoundingClientRect()
      const { w, h } = size.current
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      view.current = zoomAt(view.current, Math.exp(-dy * 0.0015), w, h, { x: e.clientX - r.left, y: e.clientY - r.top })
      schedule('fast')
      clearTimeout(wheelCommit.current)
      wheelCommit.current = setTimeout(commit, 220)
    }
    surface.addEventListener('wheel', onWheel, { passive: false })
    return () => surface.removeEventListener('wheel', onWheel)
  }, [commit, schedule])

  // ---- fingers and the mouse ----
  const local = (e: ReactPointerEvent): Px => {
    const r = surfaceRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const startGesture = () => {
    const pts = pointers.current
    if (pts.size === 0) {
      gesture.current = null
      return
    }
    gesture.current = { kind: pts.size >= 2 ? 'pinch' : 'pan', start: view.current, from: new Map(pts), moved: false, at: Date.now() }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button > 0) return
    if (anim.current !== null) {
      caf(anim.current)
      anim.current = null
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* not every pointer can be captured */
    }
    pointers.current.set(e.pointerId, local(e))
    const wasPan = gesture.current?.kind === 'pan' && gesture.current.moved
    startGesture()
    if (wasPan && gesture.current) gesture.current.moved = true
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, local(e))
    const g = gesture.current
    if (!g) return
    const { w, h } = size.current
    if (g.kind === 'pinch') {
      const ids = [...g.from.keys()].filter((id) => pointers.current.has(id)).slice(0, 2)
      if (ids.length < 2) return
      const [a, b] = ids as [number, number]
      view.current = pinchWindow(g.start, g.from.get(a)!, g.from.get(b)!, pointers.current.get(a)!, pointers.current.get(b)!, w, h)
      g.moved = true
      schedule('fast')
      return
    }
    const [id] = [...g.from.keys()]
    const from = g.from.get(id!)
    const now = pointers.current.get(id!)
    if (!from || !now) return
    const dx = now.x - from.x
    const dy = now.y - from.y
    if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP_PX) return
    g.moved = true
    view.current = panBy(g.start, dx, dy, w, h)
    schedule('fast')
  }

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return
    const g = gesture.current
    const point = pointers.current.get(e.pointerId)!
    pointers.current.delete(e.pointerId)
    if (g && !g.moved && g.kind === 'pan' && !cancelled && pointers.current.size === 0 && Date.now() - g.at < 700) {
      gesture.current = null
      const s = scene.current
      latest.current.onTap(s ? hitTest(s, point.x, point.y) : null)
      return
    }
    if (pointers.current.size > 0) {
      // A pinch with one finger lifted carries on as a drag from where the graph is now.
      startGesture()
      if (gesture.current) gesture.current.moved = true
      return
    }
    gesture.current = null
    if (g?.moved) commit()
  }

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-navy-100 bg-white">
      <div
        ref={surfaceRef}
        role="img"
        aria-label={props.label}
        aria-describedby={props.describedBy}
        data-graph-plane=""
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
      >
        <canvas ref={canvasRef} aria-hidden className="block h-full w-full" />
        <div
          ref={labelRef}
          aria-hidden
          data-graph-marker=""
          className="pointer-events-none absolute left-0 top-0 hidden whitespace-nowrap rounded-lg bg-navy px-2 py-1 font-mono text-sm font-semibold text-white shadow-md"
        >
          {props.marker?.text}
        </div>
      </div>
      <div className="absolute right-2 top-2 flex flex-col gap-1.5" role="group" aria-label="Zoom">
        <button type="button" className={CONTROL} aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
          <ZoomIcon kind="in" />
        </button>
        <button type="button" className={CONTROL} aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
          <ZoomIcon kind="out" />
        </button>
        <button type="button" className={CONTROL} aria-label="Zoom to fit" onClick={props.onFit}>
          <ZoomIcon kind="fit" />
        </button>
        <button type="button" className={CONTROL} aria-label="Standard window" onClick={props.onStandard}>
          <ZoomIcon kind="home" />
        </button>
      </div>
    </div>
  )
}
