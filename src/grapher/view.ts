/**
 * The plane's window and the arithmetic of moving it: pixel ↔ graph coordinates, a drag (pan), a zoom about a point
 * (the + and − buttons zoom about the centre, a wheel or a pinch about the fingers), the standard window, nice tick
 * steps and the grid. A window is the TI-84's: Xmin, Xmax, Ymin, Ymax; the plane stretches it to its own size. Pure.
 */

export interface ViewWindow {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface Px {
  x: number
  y: number
}

/** The TI-84's ZStandard: −10 to 10 on both axes. */
export const STANDARD_WINDOW: Readonly<ViewWindow> = Object.freeze({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 })

/** How far she can zoom: a window never narrower than this (relative to where it is) nor wider than MAX_SPAN. */
export const MIN_RELATIVE_SPAN = 1e-9
export const MIN_SPAN = 1e-7
export const MAX_SPAN = 1e12
/** A window's centre stays within this distance of the origin. */
export const MAX_CENTER = 1e12

/** The + and − buttons: twice as close, or twice as far. */
export const ZOOM_STEP = 2

export function isValidWindow(w: unknown): w is ViewWindow {
  if (typeof w !== 'object' || w === null) return false
  const r = w as Record<string, unknown>
  const nums = [r.xMin, r.xMax, r.yMin, r.yMax]
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return false
  return (r.xMax as number) > (r.xMin as number) && (r.yMax as number) > (r.yMin as number)
}

function clampAxis(lo: number, hi: number): [number, number] {
  let center = (lo + hi) / 2
  let span = hi - lo
  if (!Number.isFinite(center)) center = 0
  if (!Number.isFinite(span) || span <= 0) span = 20
  center = Math.max(-MAX_CENTER, Math.min(MAX_CENTER, center))
  const minSpan = Math.max(MIN_SPAN, Math.abs(center) * MIN_RELATIVE_SPAN)
  span = Math.max(minSpan, Math.min(MAX_SPAN, span))
  return [center - span / 2, center + span / 2]
}

/** A window inside the zoom limits (finite, not too narrow, not too wide); one that already is comes back as it is. */
export function clampWindow(w: ViewWindow): ViewWindow {
  const [xMin, xMax] = clampAxis(w.xMin, w.xMax)
  const [yMin, yMax] = clampAxis(w.yMin, w.yMax)
  if (xMin === w.xMin && xMax === w.xMax && yMin === w.yMin && yMax === w.yMax) return w
  return { xMin, xMax, yMin, yMax }
}

export function xToPx(w: ViewWindow, width: number, x: number): number {
  return ((x - w.xMin) / (w.xMax - w.xMin)) * width
}

export function yToPx(w: ViewWindow, height: number, y: number): number {
  return ((w.yMax - y) / (w.yMax - w.yMin)) * height
}

export function pxToX(w: ViewWindow, width: number, px: number): number {
  return w.xMin + (px / width) * (w.xMax - w.xMin)
}

export function pxToY(w: ViewWindow, height: number, py: number): number {
  return w.yMax - (py / height) * (w.yMax - w.yMin)
}

/** The window after a drag of (dx, dy) pixels: the graph follows the finger. */
export function panBy(w: ViewWindow, dxPx: number, dyPx: number, width: number, height: number): ViewWindow {
  const dx = (dxPx / width) * (w.xMax - w.xMin)
  const dy = (dyPx / height) * (w.yMax - w.yMin)
  return clampWindow({ xMin: w.xMin - dx, xMax: w.xMax - dx, yMin: w.yMin + dy, yMax: w.yMax + dy })
}

/**
 * Zoom by `factor` (2 is twice as close, 0.5 twice as far) keeping the graph point under the pixel (px, py) where it
 * is: the fingers of a pinch, the mouse of a wheel. Without a point, about the centre.
 */
export function zoomAt(w: ViewWindow, factor: number, width: number, height: number, at?: Px): ViewWindow {
  if (!(factor > 0) || !Number.isFinite(factor)) return w
  const fx = at ? pxToX(w, width, at.x) : (w.xMin + w.xMax) / 2
  const fy = at ? pxToY(w, height, at.y) : (w.yMin + w.yMax) / 2
  return clampWindow({
    xMin: fx - (fx - w.xMin) / factor,
    xMax: fx + (w.xMax - fx) / factor,
    yMin: fy - (fy - w.yMin) / factor,
    yMax: fy + (w.yMax - fy) / factor,
  })
}

/**
 * A two-finger pinch, from the window when the fingers came down (`start`, fingers at a0 and b0) to where they are
 * now (a1, b1): the graph point under the fingers' midpoint stays under it, and the scale follows the distance
 * between them (the same on both axes). Measured from the start each time, so it never drifts.
 */
export function pinchWindow(start: ViewWindow, a0: Px, b0: Px, a1: Px, b1: Px, width: number, height: number): ViewWindow {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y)
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y)
  const factor = d0 > 4 && d1 > 4 ? d1 / d0 : 1
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 }
  const m1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 }
  const zoomed = zoomAt(start, factor, width, height, m0)
  return panBy(zoomed, m1.x - m0.x, m1.y - m0.y, width, height)
}

/** The same window, its centre moved to (x, y). */
export function centerOn(w: ViewWindow, x: number, y: number): ViewWindow {
  const hx = (w.xMax - w.xMin) / 2
  const hy = (w.yMax - w.yMin) / 2
  return clampWindow({ xMin: x - hx, xMax: x + hx, yMin: y - hy, yMax: y + hy })
}

/** Linear blend of two windows (an animated zoom; t from 0 to 1). */
export function blendWindows(a: ViewWindow, b: ViewWindow, t: number): ViewWindow {
  const s = Math.max(0, Math.min(1, t))
  return {
    xMin: a.xMin + (b.xMin - a.xMin) * s,
    xMax: a.xMax + (b.xMax - a.xMax) * s,
    yMin: a.yMin + (b.yMin - a.yMin) * s,
    yMax: a.yMax + (b.yMax - a.yMax) * s,
  }
}

export function sameWindow(a: ViewWindow, b: ViewWindow, relTol = 1e-12): boolean {
  const tx = relTol * (a.xMax - a.xMin)
  const ty = relTol * (a.yMax - a.yMin)
  return Math.abs(a.xMin - b.xMin) <= tx && Math.abs(a.xMax - b.xMax) <= tx && Math.abs(a.yMin - b.yMin) <= ty && Math.abs(a.yMax - b.yMax) <= ty
}

/**
 * A tick step of 1, 2 or 5 times a power of ten that puts ticks at least `minGapPx` apart along an axis `lengthPx`
 * long showing `span` units.
 */
export function tickStep(span: number, lengthPx: number, minGapPx: number): number {
  if (!(span > 0) || !(lengthPx > 0)) return 1
  const raw = (span * minGapPx) / lengthPx
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 5, 10]) {
    if (m * p >= raw * (1 - 1e-12)) return m * p
  }
  return 10 * p
}

/** The grid's finer lines between ticks: a step of 1 splits in 5, 2 in 4, 5 in 5. */
export function minorStep(step: number): number {
  const m = Math.round(step / 10 ** Math.floor(Math.log10(step) + 1e-12))
  return m === 2 ? step / 4 : step / 5
}

/** Multiples of `step` from `min` to `max` (at most `limit` of them), each rounded to the step's grid. */
export function ticksIn(min: number, max: number, step: number, limit = 400): number[] {
  if (!(step > 0) || !(max > min)) return []
  const first = Math.ceil(min / step - 1e-9)
  const last = Math.floor(max / step + 1e-9)
  if (last - first > limit) return []
  const out: number[] = []
  for (let k = first; k <= last; k++) out.push(k * step)
  return out
}
