/**
 * Drawing the plane on a canvas: the light grid, the axes and their nice tick labels, shading, curves (dashed for a
 * strict inequality's edge), vertical lines, points, holes (open circles), a restricted piece's ends (filled or open),
 * the points of interest as small dots, and the point she picked. A canvas rather than SVG: a drag redraws everything
 * on every frame, and on a mid-range phone a canvas does that with time to spare. `buildScene` samples the rows for
 * one window; `hitTest` finds what a tap landed on. Colours come from the palette and the rows' colours.
 */
import type { GraphModel, DrawItem } from '@/grapher/model'
import type { Poi } from '@/grapher/poi'
import { sampleCurve, type Quality, type Sampled } from '@/grapher/sample'
import { minorStep, tickStep, ticksIn, xToPx, yToPx, pxToX, type ViewWindow } from '@/grapher/view'
import { tickLabel } from '@/grapher/format'
import { PALETTE } from '@/shared/types'

export interface SceneItem {
  rowIndex: number
  rowId: string
  color: string
  item: DrawItem
  sampled?: Sampled
}

export interface Scene {
  window: ViewWindow
  width: number
  height: number
  items: SceneItem[]
  pois: { poi: Poi; color: string }[]
  /** The picked point: a point of interest, a traced spot, one of her points. */
  marker: { x: number; y: number; color: string } | null
}

export interface RowLook {
  id: string
  color: string
}

/** The rows of the model as they draw in this window (sampled at the plane's size). */
export function buildScene(model: GraphModel, looks: readonly RowLook[], w: ViewWindow, width: number, height: number, quality: Quality): Scene {
  const items: SceneItem[] = []
  const margin = (w.xMax - w.xMin) * 0.02
  for (const row of model.rows) {
    const item = model.draw(row.index)
    if (!item) continue
    const look = looks[row.index]
    const base = { rowIndex: row.index, rowId: row.id, color: look?.color ?? PALETTE.navy, item }
    if (item.kind === 'curve' || item.kind === 'region') {
      const sampled = sampleCurve({ f: item.f, crit: item.crit, allow: item.allow, allowCrit: item.allowCrit, x0: w.xMin - margin, x1: w.xMax + margin, window: w, width, height, quality })
      items.push({ ...base, sampled })
    } else items.push(base)
  }
  return { window: w, width, height, items, pois: [], marker: null }
}

const GRID_MINOR = 'rgba(47, 60, 126, 0.06)'
const GRID_MAJOR = 'rgba(47, 60, 126, 0.15)'
const AXIS = 'rgba(47, 60, 126, 0.75)'
const LABEL = 'rgba(26, 31, 54, 0.78)'
const FONT = '12px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'

/** Keep pixel coordinates within reach of the canvas (a far-off value would make a huge path). */
function clampPx(v: number, size: number): number {
  return v < -10 * size ? -10 * size : v > 11 * size ? 11 * size : v
}

function tracePiece(ctx: CanvasRenderingContext2D, piece: readonly number[], w: ViewWindow, width: number, height: number) {
  for (let i = 0; i + 1 < piece.length; i += 2) {
    const px = xToPx(w, width, piece[i]!)
    const py = clampPx(yToPx(w, height, piece[i + 1]!), height)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, s: Scene) {
  const { window: w, width, height } = s
  const xStep = tickStep(w.xMax - w.xMin, width, Math.max(56, width / 9))
  const yStep = tickStep(w.yMax - w.yMin, height, 44)
  const minX = minorStep(xStep)
  const minY = minorStep(yStep)
  ctx.lineWidth = 1
  const vLines = (step: number, color: string) => {
    const xs = ticksIn(w.xMin, w.xMax, step, 600)
    if (xs.length === 0) return
    ctx.strokeStyle = color
    ctx.beginPath()
    for (const x of xs) {
      const px = Math.round(xToPx(w, width, x)) + 0.5
      ctx.moveTo(px, 0)
      ctx.lineTo(px, height)
    }
    ctx.stroke()
  }
  const hLines = (step: number, color: string) => {
    const ys = ticksIn(w.yMin, w.yMax, step, 600)
    if (ys.length === 0) return
    ctx.strokeStyle = color
    ctx.beginPath()
    for (const y of ys) {
      const py = Math.round(yToPx(w, height, y)) + 0.5
      ctx.moveTo(0, py)
      ctx.lineTo(width, py)
    }
    ctx.stroke()
  }
  if ((minX / (w.xMax - w.xMin)) * width >= 9) vLines(minX, GRID_MINOR)
  if ((minY / (w.yMax - w.yMin)) * height >= 9) hLines(minY, GRID_MINOR)
  vLines(xStep, GRID_MAJOR)
  hLines(yStep, GRID_MAJOR)

  // The axes, where they are in view.
  const ax = xToPx(w, width, 0)
  const ay = yToPx(w, height, 0)
  ctx.strokeStyle = AXIS
  ctx.lineWidth = 1.5
  ctx.beginPath()
  if (ax >= 0 && ax <= width) {
    ctx.moveTo(Math.round(ax) + 0.5, 0)
    ctx.lineTo(Math.round(ax) + 0.5, height)
  }
  if (ay >= 0 && ay <= height) {
    ctx.moveTo(0, Math.round(ay) + 0.5)
    ctx.lineTo(width, Math.round(ay) + 0.5)
  }
  ctx.stroke()

  // Tick labels: by the axis, or along the edge it is beyond, with a white halo so curves do not hide them.
  ctx.font = FONT
  ctx.lineWidth = 3
  ctx.strokeStyle = '#fff'
  ctx.fillStyle = LABEL
  const labelY = Math.max(14, Math.min(height - 4, ay + 15))
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  for (const x of ticksIn(w.xMin, w.xMax, xStep, 200)) {
    if (Math.abs(x) < xStep * 1e-6) continue
    const px = xToPx(w, width, x)
    if (px < 14 || px > width - 14) continue
    const text = tickLabel(x, xStep)
    ctx.strokeText(text, px, labelY)
    ctx.fillText(text, px, labelY)
  }
  const leftEdge = ax < 30
  const rightEdge = ax > width - 4
  ctx.textAlign = leftEdge ? 'left' : 'right'
  ctx.textBaseline = 'middle'
  const labelX = leftEdge ? 4 : rightEdge ? width - 4 : ax - 6
  for (const y of ticksIn(w.yMin, w.yMax, yStep, 200)) {
    if (Math.abs(y) < yStep * 1e-6) continue
    const py = yToPx(w, height, y)
    if (py < 10 || py > height - 10) continue
    const text = tickLabel(y, yStep)
    ctx.strokeText(text, labelX, py)
    ctx.fillText(text, labelX, py)
  }
  if (ax >= 0 && ax <= width && ay >= 0 && ay <= height) {
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.strokeText('0', ax - 5, ay + 15)
    ctx.fillText('0', ax - 5, ay + 15)
  }
}

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function dot(ctx: CanvasRenderingContext2D, px: number, py: number, r: number, fill: string, ring: string, ringWidth: number) {
  ctx.beginPath()
  ctx.arc(px, py, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = ringWidth
  ctx.strokeStyle = ring
  ctx.stroke()
}

export function drawScene(ctx: CanvasRenderingContext2D, s: Scene, dpr: number): void {
  const { window: w, width, height } = s
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  drawGrid(ctx, s)

  // Shading first, under every line.
  for (const it of s.items) {
    const item = it.item
    if (item.kind === 'region' && it.sampled) {
      const edge = item.below ? height + 2 : -2
      ctx.fillStyle = withAlpha(it.color, 0.16)
      for (const piece of it.sampled.pieces) {
        ctx.beginPath()
        tracePiece(ctx, piece, w, width, height)
        ctx.lineTo(xToPx(w, width, piece[piece.length - 2]!), edge)
        ctx.lineTo(xToPx(w, width, piece[0]!), edge)
        ctx.closePath()
        ctx.fill()
      }
    } else if (item.kind === 'xregion') {
      const px = xToPx(w, width, item.x)
      ctx.fillStyle = withAlpha(it.color, 0.16)
      if (item.left) ctx.fillRect(0, 0, Math.max(0, Math.min(width, px)), height)
      else ctx.fillRect(Math.max(0, px), 0, width - Math.max(0, px), height)
    }
  }

  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const it of s.items) {
    const item = it.item
    ctx.strokeStyle = it.color
    ctx.lineWidth = 2.5
    if ((item.kind === 'curve' || item.kind === 'region') && it.sampled) {
      ctx.setLineDash(item.kind === 'region' && item.strict ? [7, 6] : [])
      ctx.beginPath()
      for (const piece of it.sampled.pieces) tracePiece(ctx, piece, w, width, height)
      ctx.stroke()
      ctx.setLineDash([])
    } else if (item.kind === 'vline' || item.kind === 'xregion') {
      const px = Math.round(xToPx(w, width, item.x)) + 0.5
      ctx.setLineDash(item.kind === 'xregion' && item.strict ? [7, 6] : [])
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, height)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  for (const it of s.items) {
    const item = it.item
    if (item.kind === 'points') {
      for (const p of item.points) dot(ctx, xToPx(w, width, p.x), yToPx(w, height, p.y), 5, it.color, '#fff', 2)
    }
    if (it.sampled) {
      for (const h of it.sampled.holes) dot(ctx, xToPx(w, width, h.x), yToPx(w, height, h.y), 4.5, '#fff', it.color, 2.25)
      for (const e of it.sampled.ends) {
        if (e.closed) dot(ctx, xToPx(w, width, e.x), yToPx(w, height, e.y), 4.5, it.color, '#fff', 1.5)
        else dot(ctx, xToPx(w, width, e.x), yToPx(w, height, e.y), 4.5, '#fff', it.color, 2.25)
      }
    }
  }

  for (const { poi } of s.pois) dot(ctx, xToPx(w, width, poi.x), yToPx(w, height, poi.y), 3.75, PALETTE.gray, '#fff', 1.5)
  if (s.marker) dot(ctx, xToPx(w, width, s.marker.x), yToPx(w, height, s.marker.y), 6.5, s.marker.color, '#fff', 2.5)
}

export type Hit =
  | { kind: 'poi'; poi: Poi }
  | { kind: 'point'; rowId: string; x: number; y: number }
  | { kind: 'trace'; rowId: string; x: number }

/** What a tap at (px, py) landed on: a point of interest, one of her points, a curve (to trace), or nothing. */
export function hitTest(s: Scene, px: number, py: number): Hit | null {
  const { window: w, width, height } = s
  let best: { d: number; hit: Hit } | null = null
  const consider = (d: number, hit: Hit) => {
    if (!best || d < best.d) best = { d, hit }
  }
  for (const { poi } of s.pois) {
    const d = Math.hypot(xToPx(w, width, poi.x) - px, yToPx(w, height, poi.y) - py)
    if (d <= 22) consider(d - 8, { kind: 'poi', poi })
  }
  for (const it of s.items) {
    if (it.item.kind === 'points') {
      for (const p of it.item.points) {
        const d = Math.hypot(xToPx(w, width, p.x) - px, yToPx(w, height, p.y) - py)
        if (d <= 20) consider(d - 6, { kind: 'point', rowId: it.rowId, x: p.x, y: p.y })
      }
    }
    if (!it.sampled) continue
    for (const piece of it.sampled.pieces) {
      for (let i = 0; i + 3 < piece.length; i += 2) {
        const ax = xToPx(w, width, piece[i]!)
        const ay = clampPx(yToPx(w, height, piece[i + 1]!), height)
        const bx = xToPx(w, width, piece[i + 2]!)
        const by = clampPx(yToPx(w, height, piece[i + 3]!), height)
        if (Math.max(ax, bx) < px - 18 || Math.min(ax, bx) > px + 18) continue
        const dx = bx - ax
        const dy = by - ay
        const len2 = dx * dx + dy * dy
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
        const cx = ax + t * dx
        const cy = ay + t * dy
        const d = Math.hypot(cx - px, cy - py)
        if (d <= 18) consider(d, { kind: 'trace', rowId: it.rowId, x: pxToX(w, width, cx) })
      }
    }
  }
  return (best as { d: number; hit: Hit } | null)?.hit ?? null
}
