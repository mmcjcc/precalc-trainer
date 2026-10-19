/**
 * Where GeoFigure (src/components/GeoFigure.tsx) puts every mark and label, computed the same way, so a Unit 5
 * generator can refuse a figure whose labels would sit on a line or on each other. The content layer may not
 * import the component, so this copies its arithmetic: the scale, the point letters, the angle labels, the
 * segment labels ("above": 14 px off the segment; "below": a dimension line 34 px off), ticks, right-angle
 * squares, and the arrow marks on parallel lines. `GeoFigure.unit5.test.tsx` checks that this copy agrees with
 * the component's own `geoFigureLayout` and with the rendered segment labels.
 */
import type { GeoAngleMark, GeoFigureSpec, GeoPoint, GeoSegment } from '@/shared/types'

export const VW = 360
const PAD = 48
const NUMBER_R = 14

export type Box = { l: number; t: number; r: number; b: number }
export type Stroke = [number, number, number, number]
type Side = NonNullable<GeoPoint['labelSide']>

export interface PlacedLabel extends Box {
  kind: 'point' | 'angle' | 'segment'
  text: string
}

export interface FigureLayout {
  width: number
  height: number
  sx: (x: number) => number
  sy: (y: number) => number
  /** Lines, rays, and segments as drawn. */
  strokes: Stroke[]
  /** Dimension lines and their end ticks, drawn for "below" segment labels. */
  dimStrokes: Stroke[]
  /** Leader lines from an arc to an angle label that had to move out. */
  leaders: { text: string; stroke: Stroke }[]
  dots: Box[]
  labels: PlacedLabel[]
  /** Tick marks, right-angle squares, and arrow marks: small shapes a label should not cover. */
  marks: { kind: 'tick' | 'right' | 'arrow'; box: Box }[]
}

const overlaps = (p: Box, q: Box) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b

export function textBox(x: number, y: number, text: string, size: number, anchor: 'start' | 'middle' | 'end' = 'middle'): Box {
  const w = text.length * size * 0.56 + 4
  const l = anchor === 'middle' ? x - w / 2 : anchor === 'start' ? x : x - w
  return { l, t: y - size * 0.62, r: l + w, b: y + size * 0.62 }
}

const POINT_SHIFT: Record<Side, [number, number, 'start' | 'middle' | 'end']> = {
  above: [0, -12, 'middle'],
  below: [0, 16, 'middle'],
  left: [-10, 0, 'end'],
  right: [10, 0, 'start'],
  'above-left': [-8, -10, 'end'],
  'above-right': [8, -10, 'start'],
  'below-left': [-8, 14, 'end'],
  'below-right': [8, 14, 'start'],
}
const SIDES: readonly Side[] = ['above', 'below', 'right', 'left', 'above-right', 'above-left', 'below-right', 'below-left']

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y) || 1
  return { x: x / len, y: y / len }
}

export function layoutOf(spec: GeoFigureSpec): { sx: (x: number) => number; sy: (y: number) => number; h: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const take = (x: number, y: number) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  if (spec.grid) {
    take(spec.grid.xMin, spec.grid.yMin)
    take(spec.grid.xMax, spec.grid.yMax)
  } else {
    for (const p of spec.points) take(p.x, p.y)
  }
  if (!Number.isFinite(minX)) {
    minX = 0
    maxX = 1
    minY = 0
    maxY = 1
  }
  if (maxX - minX < 0.5) {
    minX -= 1
    maxX += 1
  }
  const flat = !spec.grid && maxY - minY < 1e-9
  if (maxY - minY < 0.5) {
    minY -= 1
    maxY += 1
  }
  const spanX = maxX - minX
  const spanY = maxY - minY
  const innerW = VW - 2 * PAD
  const innerH = flat ? 70 : Math.max(140, Math.min(260, innerW * (spanY / spanX)))
  const h = innerH + 2 * PAD
  const scale = Math.min(innerW / spanX, innerH / spanY)
  const usedW = spanX * scale
  const usedH = spanY * scale
  const ox = (VW - usedW) / 2
  const oy = (h - usedH) / 2
  return { h, sx: (x) => ox + (x - minX) * scale, sy: (y) => oy + (maxY - y) * scale }
}

function clipSeg(x1: number, y1: number, x2: number, y2: number, xmin: number, ymin: number, xmax: number, ymax: number): number[] | null {
  const code = (x: number, y: number) => (x < xmin ? 1 : 0) | (x > xmax ? 2 : 0) | (y < ymin ? 4 : 0) | (y > ymax ? 8 : 0)
  let c1 = code(x1, y1)
  let c2 = code(x2, y2)
  for (let i = 0; i < 12; i++) {
    if ((c1 | c2) === 0) return [x1, y1, x2, y2]
    if (c1 & c2) return null
    const c = c1 || c2
    let x = 0
    let y = 0
    if (c & 8) {
      if (y2 === y1) return null
      x = x1 + ((x2 - x1) * (ymax - y1)) / (y2 - y1)
      y = ymax
    } else if (c & 4) {
      if (y2 === y1) return null
      x = x1 + ((x2 - x1) * (ymin - y1)) / (y2 - y1)
      y = ymin
    } else if (c & 2) {
      if (x2 === x1) return null
      y = y1 + ((y2 - y1) * (xmax - x1)) / (x2 - x1)
      x = xmax
    } else {
      if (x2 === x1) return null
      y = y1 + ((y2 - y1) * (xmin - x1)) / (x2 - x1)
      x = xmin
    }
    if (c === c1) {
      x1 = x
      y1 = y
      c1 = code(x1, y1)
    } else {
      x2 = x
      y2 = y
      c2 = code(x2, y2)
    }
  }
  return null
}

function clipExtended(x1: number, y1: number, x2: number, y2: number, left: number, top: number, right: number, bottom: number): number[] | null {
  const u = unit(x2 - x1, y2 - y1)
  return clipSeg(x1 - u.x * 800, y1 - u.y * 800, x2 + u.x * 800, y2 + u.y * 800, left, top, right, bottom)
}

function clipRay(x1: number, y1: number, x2: number, y2: number, left: number, top: number, right: number, bottom: number): number[] | null {
  const u = unit(x2 - x1, y2 - y1)
  return clipSeg(x1, y1, x1 + u.x * 800, y1 + u.y * 800, left, top, right, bottom)
}

/** Liang–Barsky with GeoFigure's 2 px margin. */
export function segmentHitsBox([x1, y1, x2, y2]: Stroke, box: Box, margin = 2): boolean {
  const l = box.l - margin
  const r = box.r + margin
  const t = box.t - margin
  const b = box.b + margin
  const dx = x2 - x1
  const dy = y2 - y1
  let lo = 0
  let hi = 1
  for (const [p, q] of [
    [-dx, x1 - l],
    [dx, r - x1],
    [-dy, y1 - t],
    [dy, b - y1],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const u = q / p
    if (p < 0) lo = Math.max(lo, u)
    else hi = Math.min(hi, u)
    if (lo > hi) return false
  }
  return true
}

type At = (id: string) => { x: number; y: number }

function drawnStrokes(spec: GeoFigureSpec, at: At, h: number): Stroke[] {
  const out: Stroke[] = []
  for (const line of spec.lines ?? []) {
    const a = at(line.through[0])
    const b = at(line.through[1])
    const d = clipExtended(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
    if (d) out.push([d[0]!, d[1]!, d[2]!, d[3]!])
  }
  for (const ray of spec.rays ?? []) {
    const a = at(ray.from)
    const b = at(ray.through)
    const d = clipRay(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
    if (d) out.push([d[0]!, d[1]!, d[2]!, d[3]!])
  }
  for (const seg of spec.segments ?? []) {
    const a = at(seg.from)
    const b = at(seg.to)
    out.push([a.x, a.y, b.x, b.y])
  }
  return out
}

function pointLabelBox(p: GeoPoint, side: Side, sx: (x: number) => number, sy: (y: number) => number): Box {
  const [dx, dy, anchor] = POINT_SHIFT[side]
  return textBox(sx(p.x) + dx, sy(p.y) + dy, p.label ?? p.id, 14, anchor)
}

function placePointLabels(spec: GeoFigureSpec, at: At, sx: (x: number) => number, sy: (y: number) => number, h: number): Map<string, Side> {
  const strokes = drawnStrokes(spec, at, h)
  const dots: Box[] = spec.points.map((p) => ({ l: sx(p.x) - 6, t: sy(p.y) - 6, r: sx(p.x) + 6, b: sy(p.y) + 6 }))
  const taken: Box[] = []
  const sides = new Map<string, Side>()
  for (const p of spec.points) {
    if (!p.label) continue
    const preferred = p.labelSide ?? 'above'
    const own = dots[spec.points.indexOf(p)]!
    const clear = (box: Box) =>
      box.l >= 2 &&
      box.r <= VW - 2 &&
      box.t >= 2 &&
      box.b <= h - 2 &&
      !strokes.some((s) => segmentHitsBox(s, box)) &&
      !taken.some((t) => overlaps(t, box)) &&
      !dots.some((d) => d !== own && overlaps(d, box))
    const side = [preferred, ...SIDES.filter((s) => s !== preferred)].find((s) => clear(pointLabelBox(p, s, sx, sy))) ?? preferred
    sides.set(p.id, side)
    taken.push(pointLabelBox(p, side, sx, sy))
  }
  return sides
}

function angleShape(angle: GeoAngleMark, at: At) {
  const v = at(angle.vertex)
  const a = at(angle.from)
  const b = at(angle.to)
  const angA = Math.atan2(a.y - v.y, a.x - v.x)
  const angB = Math.atan2(b.y - v.y, b.x - v.x)
  let delta = angB - angA
  while (delta <= -Math.PI) delta += 2 * Math.PI
  while (delta > Math.PI) delta -= 2 * Math.PI
  const arc = angle.arc !== false
  const count = angle.marks ?? 1
  const base = angle.radius ?? 22
  const outer = base + (count - 1) * 7
  return { v, a, b, angA, delta, count, base, outer, arc, bis: angA + delta / 2, labelR: arc ? outer + 16 : NUMBER_R }
}

function inside(o: ReturnType<typeof angleShape>, g: ReturnType<typeof angleShape>): boolean {
  const within = (dir: number) => {
    let d = (dir - g.angA) * Math.sign(g.delta || 1)
    while (d < -1e-9) d += 2 * Math.PI
    while (d > 2 * Math.PI) d -= 2 * Math.PI
    return d <= Math.abs(g.delta) + 1e-9
  }
  return Math.abs(o.delta) < Math.abs(g.delta) - 1e-9 && within(o.angA) && within(o.angA + o.delta)
}

function clampAngle(dir: number, angA: number, delta: number): number {
  let d = (dir - angA) * Math.sign(delta || 1)
  while (d < -Math.PI) d += 2 * Math.PI
  while (d > Math.PI) d -= 2 * Math.PI
  const span = Math.abs(delta)
  const clamped = Math.min(Math.max(d, 0), span)
  return angA + clamped * Math.sign(delta || 1)
}

interface LabelPlace {
  x: number
  y: number
  leader?: Stroke
}

function placeAngleLabels(spec: GeoFigureSpec, at: At, h: number, taken: Box[], strokes: Stroke[]): (LabelPlace | null)[] {
  const shapes = (spec.angles ?? []).map((angle) => angleShape(angle, at))
  return (spec.angles ?? []).map((angle, i) => {
    if (!angle.label || angle.right) return null
    const g = shapes[i]!
    const clear = (box: Box) =>
      box.l >= 2 && box.r <= VW - 2 && box.t >= 2 && box.b <= h - 2 && !taken.some((t) => overlaps(t, box)) && !strokes.some((s) => segmentHitsBox(s, box))
    const at_ = (dir: number, r: number) => ({ x: g.v.x + Math.cos(dir) * r, y: g.v.y + Math.sin(dir) * r })
    const sign = g.delta < 0 ? -1 : 1
    const whole = shapes.some((o, j) => j !== i && o.v.x === g.v.x && o.v.y === g.v.y && inside(o, g))
    const candidates: { dir: number; r: number }[] = []
    if (whole) {
      for (const past of [g.angA + g.delta, g.angA]) {
        const away = past === g.angA ? -sign : sign
        for (const deg of [10, 16, 24]) for (let r = g.outer + 10; r <= g.outer + 90; r += 8) candidates.push({ dir: past + (away * (deg * Math.PI)) / 180, r })
      }
    }
    const step = g.arc ? 6 : 2
    const outside = (from: number, to: number) => {
      for (const past of [g.angA + g.delta, g.angA]) {
        const away = past === g.angA ? -sign : sign
        for (const deg of [12, 20, 30, 45]) for (let r = g.outer + from; r <= g.outer + to; r += 8) candidates.push({ dir: past + (away * (deg * Math.PI)) / 180, r })
      }
    }
    if (g.arc && !whole) {
      for (let r = g.labelR; r <= g.labelR + 48; r += step) candidates.push({ dir: g.bis, r })
      outside(8, 64)
      for (let r = g.labelR + 48 + step; r <= g.labelR + 200; r += step) candidates.push({ dir: g.bis, r })
      outside(72, 110)
    } else {
      for (let r = g.labelR; r <= g.labelR + 200; r += step) candidates.push({ dir: g.bis, r })
    }
    for (const c of candidates) {
      const { x, y } = at_(c.dir, c.r)
      const box = textBox(x, y, angle.label, 13)
      if (!clear(box)) continue
      if (c.dir === g.bis && (c.r === g.labelR || !g.arc)) {
        taken.push(box)
        return { x, y }
      }
      const onArc = at_(clampAngle(c.dir, g.angA, g.delta), g.arc ? g.outer + 2 : NUMBER_R)
      const near = { x: Math.min(Math.max(onArc.x, box.l), box.r), y: Math.min(Math.max(onArc.y, box.t), box.b) }
      const leader: Stroke = [onArc.x, onArc.y, near.x, near.y]
      if (taken.some((t) => segmentHitsBox(leader, t))) continue
      taken.push(box)
      strokes.push(leader)
      return { x, y, leader }
    }
    const { x, y } = at_(g.bis, g.labelR)
    taken.push(textBox(x, y, angle.label, 13))
    return { x, y }
  })
}

function parallelMarkBoxes(spec: GeoFigureSpec, at: At, h: number): Box[] {
  const out: Box[] = []
  for (const line of spec.lines ?? []) {
    if (!line.arrows) continue
    const a = at(line.through[0])
    const b = at(line.through[1])
    const d = clipExtended(a.x, a.y, b.x, b.y, 8, 8, VW - 8, h - 8)
    if (!d) continue
    const [x1, y1, x2, y2] = d as [number, number, number, number]
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    for (const t of line.arrows === 1 ? [0.32] : [0.32, 0.32 + 12 / len]) {
      const cx = x1 + (x2 - x1) * t
      const cy = y1 + (y2 - y1) * t
      out.push({ l: cx - 9, t: cy - 9, r: cx + 9, b: cy + 9 })
    }
  }
  return out
}

/** GeoFigure's sideNormal: "above" is up the screen (left, for a nearly vertical segment). */
function sideNormal(x1: number, y1: number, x2: number, y2: number, side: 'above' | 'below'): [number, number] {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  let nx = -(y2 - y1) / len
  let ny = (x2 - x1) / len
  if (ny > 0 || (Math.abs(ny) < 0.25 && nx > 0)) {
    nx = -nx
    ny = -ny
  }
  return side === 'below' ? [-nx, -ny] : [nx, ny]
}

/** The box of a segment's label, plus the dimension line GeoFigure draws for a "below" label. */
export function segLabelShape(seg: GeoSegment, a: { x: number; y: number }, b: { x: number; y: number }): { box: Box; dim: Stroke[] } | null {
  if (!seg.label) return null
  const side = seg.labelSide ?? 'above'
  if (side === 'above') {
    const [nx, ny] = sideNormal(a.x, a.y, b.x, b.y, 'above')
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    return { box: textBox(mx + nx * 14, my + ny * 14, seg.label, 13), dim: [] }
  }
  const [nx, ny] = sideNormal(a.x, a.y, b.x, b.y, 'below')
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const off = 34
  const ax = a.x + nx * off
  const ay = a.y + ny * off
  const bx = b.x + nx * off
  const by = b.y + ny * off
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const gap = Math.min(len / 2 - 4, seg.label.length * 3.8 + 6)
  return {
    box: textBox(mx, my, seg.label, 13),
    dim: [
      [ax, ay, mx - ux * gap, my - uy * gap],
      [mx + ux * gap, my + uy * gap, bx, by],
      [ax - nx * 6, ay - ny * 6, ax + nx * 6, ay + ny * 6],
      [bx - nx * 6, by - ny * 6, bx + nx * 6, by + ny * 6],
    ],
  }
}

function tickBoxes(a: { x: number; y: number }, b: { x: number; y: number }, count: number): Box[] {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const nx = -(b.y - a.y) / len
  const ny = (b.x - a.x) / len
  const ux = (b.x - a.x) / len
  const uy = (b.y - a.y) / len
  const gap = 5
  const start = -((count - 1) * gap) / 2
  const out: Box[] = []
  for (let i = 0; i < count; i++) {
    const cx = mx + ux * (start + i * gap)
    const cy = my + uy * (start + i * gap)
    const xs = [cx - nx * 7, cx + nx * 7]
    const ys = [cy - ny * 7, cy + ny * 7]
    out.push({ l: Math.min(...xs) - 1, t: Math.min(...ys) - 1, r: Math.max(...xs) + 1, b: Math.max(...ys) + 1 })
  }
  return out
}

function rightBox(v: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): Box {
  const size = 14
  const ua = unit(a.x - v.x, a.y - v.y)
  const ub = unit(b.x - v.x, b.y - v.y)
  const xs = [v.x, v.x + ua.x * size, v.x + ub.x * size, v.x + (ua.x + ub.x) * size]
  const ys = [v.y, v.y + ua.y * size, v.y + ub.y * size, v.y + (ua.y + ub.y) * size]
  return { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) }
}

/** Everything GeoFigure draws that a label could collide with, in SVG units (360 wide). */
export function figureLayout(spec: GeoFigureSpec): FigureLayout {
  const { sx, sy, h } = layoutOf(spec)
  const at: At = (id) => {
    const p = spec.points.find((point) => point.id === id)
    if (!p) throw new Error(`figure: no point ${id}`)
    return { x: sx(p.x), y: sy(p.y) }
  }
  const pointSides = placePointLabels(spec, at, sx, sy, h)
  const taken: Box[] = []
  for (const p of spec.points) {
    taken.push({ l: sx(p.x) - 6, t: sy(p.y) - 6, r: sx(p.x) + 6, b: sy(p.y) + 6 })
    if (!p.label) continue
    taken.push(pointLabelBox(p, pointSides.get(p.id) ?? p.labelSide ?? 'above', sx, sy))
  }
  const arrows = parallelMarkBoxes(spec, at, h)
  taken.push(...arrows)
  const strokes = drawnStrokes(spec, at, h)
  const avoid = [...strokes]
  const anglePlaces = placeAngleLabels(spec, at, h, taken, avoid)
  const labels: PlacedLabel[] = []
  const dots: Box[] = []
  for (const p of spec.points) {
    if (!p.label) continue
    dots.push({ l: sx(p.x) - 4, t: sy(p.y) - 4, r: sx(p.x) + 4, b: sy(p.y) + 4 })
    labels.push({ kind: 'point', text: p.label, ...pointLabelBox(p, pointSides.get(p.id) ?? p.labelSide ?? 'above', sx, sy) })
  }
  const leaders: { text: string; stroke: Stroke }[] = []
  ;(spec.angles ?? []).forEach((angle, i) => {
    const place = anglePlaces[i]
    if (angle.label && place) labels.push({ kind: 'angle', text: angle.label, ...textBox(place.x, place.y, angle.label, 13) })
    if (angle.label && place?.leader) leaders.push({ text: angle.label, stroke: place.leader })
  })
  const dimStrokes: Stroke[] = []
  const marks: FigureLayout['marks'] = []
  for (const seg of spec.segments ?? []) {
    const a = at(seg.from)
    const b = at(seg.to)
    const shape = segLabelShape(seg, a, b)
    if (shape && seg.label) {
      labels.push({ kind: 'segment', text: seg.label, ...shape.box })
      dimStrokes.push(...shape.dim)
    }
    if (seg.ticks) for (const box of tickBoxes(a, b, seg.ticks)) marks.push({ kind: 'tick', box })
  }
  for (const angle of spec.angles ?? []) {
    if (angle.right) marks.push({ kind: 'right', box: rightBox(at(angle.vertex), at(angle.from), at(angle.to)) })
  }
  for (const box of arrows) marks.push({ kind: 'arrow', box })
  return { width: VW, height: h, sx, sy, strokes, dimStrokes, leaders, dots, labels, marks }
}

const apart = (p: Box, q: Box) => p.r <= q.l || q.r <= p.l || p.b <= q.t || q.b <= p.t

/**
 * What would make the figure hard to read at 375 px: a label outside the figure, on a line (its own segment
 * included), on another label, on a dot, or on a tick, a right-angle square, or an arrow mark; a dimension line
 * or a leader through a label; a line name (Unit 5 never names lines).
 */
export function figureIssues(spec: GeoFigureSpec): string[] {
  const out: string[] = []
  if ((spec.lines ?? []).some((line) => line.label)) out.push('a line has a name')
  const lay = figureLayout(spec)
  const { width, height, strokes, dimStrokes, dots, labels, marks, leaders } = lay
  for (const label of labels) {
    const name = `${label.kind} ${label.text}`
    if (label.l < 0 || label.t < 0 || label.r > width || label.b > height) out.push(`${name} leaves the figure`)
    if (strokes.some((s) => segmentHitsBox(s, label, 1))) out.push(`${name} sits on a line`)
    if (dimStrokes.some((s) => segmentHitsBox(s, label, 1))) out.push(`${name} sits on a dimension line`)
    if (label.kind !== 'point' && dots.some((d) => !apart(label, d))) out.push(`${name} covers a dot`)
    for (const mark of marks) if (!apart(label, mark.box)) out.push(`${name} covers a ${mark.kind} mark`)
    for (const leader of leaders) if (leader.text !== label.text && segmentHitsBox(leader.stroke, label, 0)) out.push(`the leader to ${leader.text} crosses ${name}`)
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (!apart(labels[i]!, labels[j]!)) out.push(`${labels[i]!.kind} ${labels[i]!.text} covers ${labels[j]!.kind} ${labels[j]!.text}`)
    }
  }
  return out
}
