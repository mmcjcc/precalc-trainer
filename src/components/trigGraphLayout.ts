/**
 * The layout of a trig graph (components/TrigGraph draws it, for a GraphSpec with `ticks`): the curve to its true
 * shape, x ticks at multiples of π/k labelled the way a textbook writes them (π/4, π/2, 3π/4, π …) or at a plain step,
 * y ticks, the axes, dashed vertical asymptotes, and every labelled point's label, placed off the curve, off the other
 * labels, off the asymptotes and inside the figure. Pure, so a test can check every label of every generated graph.
 *
 * Sizes are in viewBox units, one unit a pixel when the graph is 340 wide; the figure scales as a whole, so what clears
 * at one width clears at every width (the phone's 375 px screen draws it about 320 wide).
 */
import type { GraphMarker, GraphSample, GraphSpec } from '@/shared/types'
import { segHitsBox, type Box, type Pt, type Seg } from './trigTriangle'

export const TG_W = 340
export const TG_H = 240
const PAD = { l: 40, r: 10, t: 12, b: 26 }
const FONT = 11
const LABEL_FONT = 12

export interface TickLabel {
  text: string
  x: number
  y: number
  box: Box
}

export interface MarkerLayout {
  /** The point. */
  cx: number
  cy: number
  label: string
  /** The label's centre. */
  x: number
  y: number
  box: Box
}

export interface TrigGraphLayout {
  width: number
  height: number
  plot: Box
  curves: Pt[][]
  grid: Seg[]
  axes: Seg[]
  ticks: Seg[]
  xLabels: TickLabel[]
  yLabels: TickLabel[]
  guides: Seg[]
  markers: MarkerLayout[]
  dots: { x: number; y: number; closed: boolean }[]
}

/** Width of a label in units: digits and letters about 0.58 of the font size, π a little wider, punctuation narrower. */
export function textWidth(text: string, size = FONT): number {
  let w = 0
  for (const ch of text) w += /[(),.\s/]/.test(ch) ? 0.34 : ch === 'π' ? 0.62 : ch === '−' ? 0.62 : /√/.test(ch) ? 0.66 : 0.58
  return w * size
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))

/** j·π/k as a textbook writes it: "0", "π", "−π", "2π", "π/4", "−3π/4". */
export function piLabel(j: number, k: number): string {
  if (j === 0) return '0'
  const g = gcd(Math.abs(j), k)
  const n = j / g
  const d = k / g
  const sign = n < 0 ? '−' : ''
  const a = Math.abs(n)
  const top = `${a === 1 ? '' : a}π`
  return d === 1 ? `${sign}${top}` : `${sign}${top}/${d}`
}

/** A plain tick number: "−2", "0.5", "12". */
export function numberLabel(v: number): string {
  const r = Math.round(v * 1e6) / 1e6
  return String(r).replace('-', '−')
}

const boxAround = (cx: number, cy: number, text: string, size: number): Box => {
  const w = textWidth(text, size) / 2 + 2
  const h = size * 0.62 + 1
  return { l: cx - w, r: cx + w, t: cy - h, b: cy + h }
}

const overlaps = (p: Box, q: Box) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b

/** Break a polyline where it leaves the y-window, each piece clipped to it (math coordinates). */
function clipRuns(run: readonly GraphSample[], yLo: number, yHi: number): GraphSample[][] {
  const out: GraphSample[][] = []
  let cur: GraphSample[] = []
  const flush = () => {
    if (cur.length > 1) out.push(cur)
    cur = []
  }
  const inside = (p: GraphSample) => Number.isFinite(p.y) && p.y >= yLo && p.y <= yHi
  const cross = (a: GraphSample, b: GraphSample, y: number): GraphSample => ({ x: a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x), y })
  for (let i = 0; i < run.length; i++) {
    const p = run[i]!
    const prev = run[i - 1]
    if (!Number.isFinite(p.y)) {
      flush()
      continue
    }
    if (inside(p)) {
      if (prev && Number.isFinite(prev.y) && !inside(prev)) cur.push(cross(prev, p, prev.y > yHi ? yHi : yLo))
      cur.push(p)
      continue
    }
    if (prev && Number.isFinite(prev.y) && inside(prev)) cur.push(cross(prev, p, p.y > yHi ? yHi : yLo))
    flush()
  }
  flush()
  return out
}

/** The ticks along one axis, from lo to hi, every `step` (in units of π/k when piOver is set). */
function tickValues(lo: number, hi: number, step: number): number[] {
  const out: number[] = []
  const first = Math.ceil(lo / step - 1e-9)
  for (let j = first; j * step <= hi + 1e-9; j++) out.push(j)
  return out
}

/** Every label of a trig graph, laid out. */
export function trigGraphLayout(spec: GraphSpec, width = TG_W, height = TG_H): TrigGraphLayout {
  const ticks = spec.ticks ?? {}
  const [xLo, xHi] = spec.xDomain ?? [-2 * Math.PI, 2 * Math.PI]
  const [yLo, yHi] = spec.yDomain ?? [-4, 4]
  const plot: Box = { l: PAD.l, r: width - PAD.r, t: PAD.t, b: height - PAD.b }
  const sx = (x: number) => plot.l + ((x - xLo) / (xHi - xLo)) * (plot.r - plot.l)
  const sy = (y: number) => plot.t + ((yHi - y) / (yHi - yLo)) * (plot.b - plot.t)
  const r2 = (v: number) => Math.round(v * 100) / 100

  // The curve.
  const runs = spec.runs?.length ? spec.runs : spec.samples?.length ? [spec.samples] : []
  const curves: Pt[][] = runs.flatMap((run) => clipRuns(run, yLo, yHi)).map((run) => run.map((p) => ({ x: r2(sx(p.x)), y: r2(sy(p.y)) })))

  // Axes.
  const axes: Seg[] = []
  if (yLo <= 0 && 0 <= yHi) axes.push({ a: { x: plot.l, y: sy(0) }, b: { x: plot.r, y: sy(0) } })
  if (xLo <= 0 && 0 <= xHi) axes.push({ a: { x: sx(0), y: plot.t }, b: { x: sx(0), y: plot.b } })

  // x ticks: multiples of π/k, or of a plain step.
  const grid: Seg[] = []
  const tickMarks: Seg[] = []
  const xLabels: TickLabel[] = []
  const xPi = ticks.xPiOver
  const xStep = xPi ? Math.PI / xPi : (ticks.xStep ?? 1)
  const xs = tickValues(xLo, xHi, xStep)
  const xText = (j: number) => (xPi ? piLabel(j, xPi) : numberLabel(j * xStep))
  for (const j of xs) {
    const X = sx(j * xStep)
    grid.push({ a: { x: X, y: plot.t }, b: { x: X, y: plot.b } })
    tickMarks.push({ a: { x: X, y: plot.b }, b: { x: X, y: plot.b + 3 } })
  }
  // Label every m-th tick, the smallest m that keeps neighbours apart; 0 is labelled where it falls.
  const labelY = plot.b + 13
  for (const m of [1, 2, 3, 4, 6, 8, 12]) {
    const chosen = xs.filter((j) => j % m === 0)
    const boxes = chosen.map((j) => boxAround(sx(j * xStep), labelY, xText(j), FONT))
    const clash = boxes.some((b, i) => (i > 0 && b.l < boxes[i - 1]!.r + 3) || b.l < 1 || b.r > width - 1)
    if (!clash || m === 12) {
      chosen.forEach((j, i) => xLabels.push({ text: xText(j), x: r2(sx(j * xStep)), y: labelY, box: boxes[i]! }))
      break
    }
  }

  // y ticks.
  const yLabels: TickLabel[] = []
  const yPi = ticks.yPiOver
  const yStep = yPi ? Math.PI / yPi : (ticks.yStep ?? 1)
  const ys = tickValues(yLo, yHi, yStep)
  const yText = (j: number) => (yPi ? piLabel(j, yPi) : numberLabel(j * yStep))
  for (const j of ys) {
    const Y = sy(j * yStep)
    grid.push({ a: { x: plot.l, y: Y }, b: { x: plot.r, y: Y } })
    tickMarks.push({ a: { x: plot.l - 3, y: Y }, b: { x: plot.l, y: Y } })
  }
  for (const m of [1, 2, 3, 4, 5, 10]) {
    const chosen = ys.filter((j) => j % m === 0)
    const boxes = chosen.map((j) => {
      const t = yText(j)
      const w = textWidth(t, FONT)
      return { text: t, box: { l: plot.l - 6 - w, r: plot.l - 4, t: sy(j * yStep) - FONT * 0.62, b: sy(j * yStep) + FONT * 0.62 } }
    })
    const clash = boxes.some((b, i) => i > 0 && boxes[i - 1]!.box.t < b.box.b + 2)
    if (!clash || m === 10) {
      boxes.forEach((b, i) => yLabels.push({ text: b.text, x: r2(b.box.r), y: r2(sy(chosen[i]! * yStep)), box: b.box }))
      break
    }
  }

  // Asymptotes.
  const guides: Seg[] = []
  for (const g of spec.guides ?? []) {
    if (typeof g.x !== 'number' || g.x < xLo || g.x > xHi) continue
    guides.push({ a: { x: r2(sx(g.x)), y: plot.t }, b: { x: r2(sx(g.x)), y: plot.b } })
  }

  const dots = (spec.dots ?? []).filter((d) => d.x >= xLo && d.x <= xHi && d.y >= yLo && d.y <= yHi).map((d) => ({ x: r2(sx(d.x)), y: r2(sy(d.y)), closed: d.closed }))

  // Labelled points: their labels off the curve, the asymptotes, the axes, the other labels and dots, inside the figure.
  const curveSegs: Seg[] = curves.flatMap((c) => c.slice(1).map((p, i) => ({ a: c[i]!, b: p })))
  const markers: MarkerLayout[] = []
  const pts = (spec.markers ?? []).filter((m) => m.x >= xLo && m.x <= xHi && m.y >= yLo && m.y <= yHi)
  const dotBoxes = pts.map((m) => ({ l: sx(m.x) - 4, r: sx(m.x) + 4, t: sy(m.y) - 4, b: sy(m.y) + 4 }))
  for (const m of pts) markers.push(placeMarker(m, sx, sy, { width, height, curveSegs, guides, axes, xLabels, yLabels, dotBoxes, placed: markers }))

  return { width, height, plot, curves, grid, axes, ticks: tickMarks, xLabels, yLabels, guides, markers, dots }
}

interface Obstacles {
  width: number
  height: number
  curveSegs: Seg[]
  guides: Seg[]
  axes: Seg[]
  xLabels: TickLabel[]
  yLabels: TickLabel[]
  dotBoxes: Box[]
  placed: MarkerLayout[]
}

/** Is this box clear of everything a label must not touch? */
export function labelClear(box: Box, o: Obstacles): boolean {
  if (box.l < 2 || box.t < 2 || box.r > o.width - 2 || box.b > o.height - 2) return false
  if (o.curveSegs.some((s) => segHitsBox(s, box))) return false
  if (o.guides.some((s) => segHitsBox(s, box))) return false
  if (o.axes.some((s) => segHitsBox(s, box))) return false
  if ([...o.xLabels, ...o.yLabels].some((l) => overlaps(l.box, box))) return false
  if (o.dotBoxes.some((d) => overlaps(d, box))) return false
  if (o.placed.some((p) => overlaps(p.box, box))) return false
  return true
}

/**
 * Where a point's label goes: the nearest clear spot (above or below the point, its preferred side first, slid left or
 * right along its row so that it stays over the point; then beside it), or, when nothing is clear, the spot that
 * touches the least: never the curve or another label if any spot avoids them.
 */
function placeMarker(m: GraphMarker, sx: (x: number) => number, sy: (y: number) => number, o: Obstacles): MarkerLayout {
  const cx = sx(m.x)
  const cy = sy(m.y)
  const w = textWidth(m.label, LABEL_FONT) / 2 + 2
  const h = LABEL_FONT * 0.62 + 1
  const prefer = m.labelSide === 'below' ? 1 : -1
  const spots: { x: number; y: number; cost: number }[] = []
  for (const gap of [4, 8, 13, 19, 26, 34, 44]) {
    for (const side of [prefer, -prefer]) {
      const y = cy + side * (h + gap)
      for (const f of [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 0.95, -0.95, 1.3, -1.3]) {
        const x = cx + f * w
        spots.push({ x, y, cost: Math.hypot(x - cx, y - cy) + (side === prefer ? 0 : 6) })
      }
    }
  }
  for (const gap of [6, 12, 20, 30]) {
    for (const side of [1, -1]) {
      for (const dy of [0, -h, h, -2 * h, 2 * h]) {
        const x = cx + side * (w + gap)
        const y = cy + dy
        spots.push({ x, y, cost: Math.hypot(x - cx, y - cy) + 4 })
      }
    }
  }
  spots.sort((p, q) => p.cost - q.cost)
  const at = (s: { x: number; y: number }): MarkerLayout => ({ cx, cy, label: m.label, x: Math.round(s.x * 100) / 100, y: Math.round(s.y * 100) / 100, box: { l: s.x - w, r: s.x + w, t: s.y - h, b: s.y + h } })
  for (const s of spots) {
    const spot = at(s)
    if (labelClear(spot.box, o)) return spot
  }
  // A label may cross an axis line (its white halo breaks the line) when no spot clears the axes too.
  const noAxes = { ...o, axes: [] }
  for (const s of spots) {
    const spot = at(s)
    if (labelClear(spot.box, noAxes)) return spot
  }
  // Nothing is clear: the spot that touches the least, the curve and the other labels counting most.
  const touches = (box: Box) =>
    (box.l < 2 || box.t < 2 || box.r > o.width - 2 || box.b > o.height - 2 ? 1000 : 0) +
    (o.curveSegs.some((s) => segHitsBox(s, box)) ? 300 : 0) +
    (o.placed.some((p) => overlaps(p.box, box)) || o.dotBoxes.some((d) => overlaps(d, box)) ? 300 : 0) +
    (o.guides.some((s) => segHitsBox(s, box)) ? 100 : 0) +
    ([...o.xLabels, ...o.yLabels].some((l) => overlaps(l.box, box)) ? 50 : 0) +
    (o.axes.some((s) => segHitsBox(s, box)) ? 20 : 0)
  let best = at(spots[0]!)
  let bestCost = Infinity
  for (const s of spots) {
    const spot = at(s)
    const c = touches(spot.box) + s.cost / 100
    if (c < bestCost) {
      best = spot
      bestCost = c
    }
  }
  return best
}
