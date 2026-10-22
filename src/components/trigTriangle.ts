/**
 * The layout of a right-triangle figure (components/TrigFigure draws it): where the corners go, how each side is drawn
 * (a plain side, a ladder, a dashed line of sight, a shadow), the scene around it (a wall, a ramp, a kite, a tree and
 * the sun, a lighthouse and a boat, the ground or the sea), the right-angle mark, each marked angle's arc, dimension
 * lines for a length along part of the scene, and every label. Pure, so tests can check that no label sits on a line,
 * on a filled shape, on another label, or off the figure.
 *
 * Labels are placed in a fixed order, the ones a part reveals last, so a label that appears once she has answered a
 * part never moves the others.
 */
import type { TrigScene, TrigTriangleSpec } from '@/content/types'

export interface Pt {
  x: number
  y: number
}
export interface Seg {
  a: Pt
  b: Pt
}
export interface Box {
  l: number
  t: number
  r: number
  b: number
}

export type SideStyle = 'solid' | 'dashed' | 'ladder' | 'string' | 'shadow'

export interface LayoutLabel {
  text: string
  x: number
  y: number
  box: Box
  kind: 'side' | 'dimension' | 'angle'
  /** "A-B" for a side, the corner for an angle. */
  key: string
}

export interface LayoutDimension {
  key: string
  /** The line in two pieces around its label. */
  line: [Pt, Pt][]
  ticks: [Pt, Pt][]
  ext: [Pt, Pt][]
}

export interface SceneShape {
  kind: 'rect' | 'polygon' | 'circle' | 'line' | 'polyline'
  /** data-trig for tests: "scene-wall", "scene-boat" … */
  name: string
  points?: Pt[]
  c?: Pt
  r?: number
  fill: 'none' | 'wall' | 'ground' | 'ramp' | 'kite' | 'crown' | 'trunk' | 'tower' | 'boat' | 'sun' | 'water' | 'light'
  stroke: boolean
  width?: number
  dashed?: boolean
}

export interface TriangleLayout {
  width: number
  height: number
  P: Record<string, Pt>
  sides: { from: string; to: string; style: SideStyle; a: Pt; b: Pt }[]
  rightMark: Pt[]
  arcs: { key: string; d: string }[]
  horizontal: [Pt, Pt] | null
  equalTicks: [Pt, Pt][]
  dims: LayoutDimension[]
  scene: SceneShape[]
  labels: LayoutLabel[]
  /** Every line drawn, for the label placement and the tests. */
  strokes: Seg[]
  /** Every filled shape, as a box. */
  obstacles: Box[]
}

export const TRI_VW = 320
const MAX_H = 300

const MARGIN: Record<TrigScene, { l: number; r: number; t: number; b: number }> = {
  plain: { l: 62, r: 62, t: 30, b: 36 },
  ladder: { l: 34, r: 84, t: 36, b: 60 },
  ramp: { l: 34, r: 66, t: 46, b: 60 },
  kite: { l: 34, r: 66, t: 48, b: 60 },
  tree: { l: 34, r: 84, t: 36, b: 60 },
  lighthouse: { l: 88, r: 44, t: 46, b: 60 },
}

const STYLE: Record<TrigScene, { base: SideStyle; vertical: SideStyle; hyp: SideStyle }> = {
  plain: { base: 'solid', vertical: 'solid', hyp: 'solid' },
  ladder: { base: 'solid', vertical: 'solid', hyp: 'ladder' },
  ramp: { base: 'solid', vertical: 'solid', hyp: 'solid' },
  kite: { base: 'solid', vertical: 'dashed', hyp: 'string' },
  tree: { base: 'shadow', vertical: 'dashed', hyp: 'dashed' },
  lighthouse: { base: 'solid', vertical: 'solid', hyp: 'dashed' },
}

const add = (p: Pt, q: Pt): Pt => ({ x: p.x + q.x, y: p.y + q.y })
const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y })
const mul = (p: Pt, k: number): Pt => ({ x: p.x * k, y: p.y * k })
const len = (p: Pt) => Math.hypot(p.x, p.y)
const unit = (p: Pt): Pt => mul(p, 1 / (len(p) || 1))
const r2 = (v: number) => Number(v.toFixed(2))

/** Half a label's width and height in SVG units: 14-unit semibold text is about 8 units a character. */
export function labelHalf(text: string): { w: number; h: number } {
  return { w: text.length * 4 + 3, h: 9 }
}

function boxAt(c: Pt, text: string): Box {
  const { w, h } = labelHalf(text)
  return { l: c.x - w, t: c.y - h, r: c.x + w, b: c.y + h }
}

const overlaps = (p: Box, q: Box) => p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b

/** Does a segment pass through a box? (Liang–Barsky clipping.) */
export function segHitsBox(s: Seg, b: Box): boolean {
  let t0 = 0
  let t1 = 1
  const dx = s.b.x - s.a.x
  const dy = s.b.y - s.a.y
  const edges: [number, number][] = [
    [-dx, s.a.x - b.l],
    [dx, b.r - s.a.x],
    [-dy, s.a.y - b.t],
    [dy, b.b - s.a.y],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    const t = q / p
    if (p < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

const polySegs = (pts: Pt[], closed: boolean): Seg[] => {
  const out: Seg[] = []
  for (let i = 0; i + 1 < pts.length; i++) out.push({ a: pts[i]!, b: pts[i + 1]! })
  if (closed && pts.length > 2) out.push({ a: pts.at(-1)!, b: pts[0]! })
  return out
}

const bboxOf = (pts: Pt[]): Box => ({ l: Math.min(...pts.map((p) => p.x)), t: Math.min(...pts.map((p) => p.y)), r: Math.max(...pts.map((p) => p.x)), b: Math.max(...pts.map((p) => p.y)) })

/**
 * The layout of a triangle figure. `visible(after)` says whether a label that waits for a part is drawn yet (labels
 * with no `after` always are).
 */
export function triangleLayout(spec: TrigTriangleSpec, visible: (after: string | undefined) => boolean = (a) => !a): TriangleLayout {
  const m = MARGIN[spec.scene]
  const xs = spec.corners.map((c) => c.x)
  const ys = spec.corners.map((c) => c.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const bw = Math.max(maxX - minX, 1e-6)
  const bh = Math.max(maxY - minY, 1e-6)
  const s = Math.min((TRI_VW - m.l - m.r) / bw, (MAX_H - m.t - m.b) / bh)
  const x0 = m.l + (TRI_VW - m.l - m.r - bw * s) / 2
  const height = Math.round(m.t + m.b + bh * s)
  const P: Record<string, Pt> = {}
  for (const c of spec.corners) P[c.id] = { x: r2(x0 + (c.x - minX) * s), y: r2(m.t + (maxY - c.y) * s) }

  const right = spec.right
  const top = spec.corners.reduce((a, b) => (b.y > a.y ? b : a)).id
  const low = spec.corners.find((c) => c.id !== right && c.id !== top)!.id
  const style = STYLE[spec.scene]
  const sides: TriangleLayout['sides'] = [
    { from: low, to: right, style: style.base, a: P[low]!, b: P[right]! },
    { from: right, to: top, style: style.vertical, a: P[right]!, b: P[top]! },
    { from: low, to: top, style: style.hyp, a: P[low]!, b: P[top]! },
  ]
  const strokes: Seg[] = []
  const obstacles: Box[] = []
  const scene: SceneShape[] = []
  const shape = (sh: SceneShape, obstacle: boolean) => {
    scene.push(sh)
    if (sh.stroke) {
      if (sh.kind === 'line' || sh.kind === 'polyline') strokes.push(...polySegs(sh.points!, false))
      if (sh.kind === 'rect' || sh.kind === 'polygon') strokes.push(...polySegs(sh.points!, true))
      if (sh.kind === 'circle') {
        const pts = Array.from({ length: 16 }, (_, i) => add(sh.c!, { x: sh.r! * Math.cos((i * Math.PI) / 8), y: sh.r! * Math.sin((i * Math.PI) / 8) }))
        strokes.push(...polySegs(pts, true))
      }
    }
    if (obstacle) {
      if (sh.kind === 'circle') obstacles.push({ l: sh.c!.x - sh.r!, t: sh.c!.y - sh.r!, r: sh.c!.x + sh.r!, b: sh.c!.y + sh.r! })
      else obstacles.push(bboxOf(sh.points!))
    }
  }
  const rect = (l: number, t: number, w: number, h: number): Pt[] => [
    { x: l, y: t },
    { x: l + w, y: t },
    { x: l + w, y: t + h },
    { x: l, y: t + h },
  ]

  // The scene.
  const gy = P[right]!.y
  const allX = Object.values(P).map((p) => p.x)
  if (spec.scene !== 'plain') {
    let gl = Math.min(...allX) - 18
    let gr = Math.max(...allX) + 18
    if (spec.scene === 'ladder' || spec.scene === 'tree') gr = Math.max(gr, P[right]!.x + 40)
    if (spec.scene === 'lighthouse') {
      gl = P[right]!.x - 40
      shape({ kind: 'rect', name: 'scene-ground', points: rect(gl, gy, P[right]!.x - gl, 7), fill: 'ground', stroke: false }, true)
      shape({ kind: 'line', name: 'scene-ground-line', points: [{ x: gl, y: gy }, P[right]!], fill: 'none', stroke: true, width: 2 }, false)
      // The sea: a gentle wave from the base of the lighthouse past the boat.
      const wave: Pt[] = []
      for (let x = P[right]!.x; x <= gr + 0.01; x += 6) wave.push({ x: r2(x), y: r2(gy + 1.5 * Math.sin((x - P[right]!.x) / 4)) })
      shape({ kind: 'polyline', name: 'scene-water', points: wave, fill: 'none', stroke: true, width: 1.5 }, false)
      shape({ kind: 'rect', name: 'scene-sea', points: rect(P[right]!.x, gy + 2, gr - P[right]!.x, 6), fill: 'water', stroke: false }, true)
    } else {
      shape({ kind: 'rect', name: 'scene-ground', points: rect(gl, gy, gr - gl, 7), fill: 'ground', stroke: false }, true)
      shape({ kind: 'line', name: 'scene-ground-line', points: [{ x: gl, y: gy }, { x: gr, y: gy }], fill: 'none', stroke: true, width: 2 }, false)
    }
  }
  const T = P[top]!
  const R = P[right]!
  const L = P[low]!
  if (spec.scene === 'ladder') {
    shape({ kind: 'rect', name: 'scene-wall', points: rect(R.x, T.y - 22, 12, gy - (T.y - 22)), fill: 'wall', stroke: true, width: 1.5 }, true)
  }
  if (spec.scene === 'ramp') {
    shape({ kind: 'polygon', name: 'scene-ramp', points: [L, R, T], fill: 'ramp', stroke: false }, false)
  }
  if (spec.scene === 'kite') {
    const k: Pt[] = [T, { x: T.x + 9, y: T.y - 13 }, { x: T.x, y: T.y - 27 }, { x: T.x - 9, y: T.y - 13 }]
    shape({ kind: 'polygon', name: 'scene-kite', points: k, fill: 'kite', stroke: true, width: 1.5 }, true)
    shape({ kind: 'line', name: 'scene-kite-spar', points: [k[1]!, k[3]!], fill: 'none', stroke: true, width: 1 }, false)
  }
  if (spec.scene === 'tree') {
    shape({ kind: 'rect', name: 'scene-trunk', points: rect(R.x - 3, T.y + 28, 6, gy - (T.y + 28)), fill: 'trunk', stroke: false }, true)
    shape({ kind: 'circle', name: 'scene-crown', c: { x: R.x, y: T.y + 15 }, r: 15, fill: 'crown', stroke: false }, true)
    // The sun, up along the ray beyond the treetop, where there is room.
    const u = unit(sub(T, L))
    const sun = add(T, mul(u, 34))
    if (sun.x < TRI_VW - 18 && sun.y > 16) {
      shape({ kind: 'circle', name: 'scene-sun', c: sun, r: 8, fill: 'sun', stroke: true, width: 1.5 }, true)
    }
  }
  if (spec.scene === 'lighthouse') {
    const tower: Pt[] = [
      { x: R.x - 20, y: gy },
      { x: R.x, y: gy },
      T,
      { x: R.x - 13, y: T.y },
    ]
    shape({ kind: 'polygon', name: 'scene-tower', points: tower, fill: 'tower', stroke: true, width: 1.5 }, true)
    shape({ kind: 'rect', name: 'scene-light', points: rect(R.x - 11, T.y + 4, 8, 6), fill: 'light', stroke: false }, false)
    const boat: Pt[] = [
      { x: L.x - 14, y: L.y - 7 },
      { x: L.x + 14, y: L.y - 7 },
      { x: L.x + 9, y: L.y },
      { x: L.x - 9, y: L.y },
    ]
    shape({ kind: 'polygon', name: 'scene-boat', points: boat, fill: 'boat', stroke: true, width: 1.5 }, true)
    shape({ kind: 'rect', name: 'scene-cabin', points: rect(L.x - 5, L.y - 13, 10, 6), fill: 'boat', stroke: true, width: 1 }, true)
  }

  // The triangle's sides.
  for (const side of sides) {
    if (side.style === 'ladder') {
      const n = unit({ x: -(side.b.y - side.a.y), y: side.b.x - side.a.x })
      const a1 = add(side.a, mul(n, 3.5))
      const b1 = add(side.b, mul(n, 3.5))
      const a2 = add(side.a, mul(n, -3.5))
      const b2 = add(side.b, mul(n, -3.5))
      shape({ kind: 'line', name: 'scene-ladder', points: [a1, b1], fill: 'none', stroke: true, width: 2 }, false)
      shape({ kind: 'line', name: 'scene-ladder', points: [a2, b2], fill: 'none', stroke: true, width: 2 }, false)
      const n0 = Math.floor(len(sub(side.b, side.a)) / 13)
      for (let i = 1; i < n0; i++) {
        const t = i / n0
        shape({ kind: 'line', name: 'scene-ladder-rung', points: [add(a1, mul(sub(b1, a1), t)), add(a2, mul(sub(b2, a2), t))], fill: 'none', stroke: true, width: 1.5 }, false)
      }
    } else if (side.style === 'shadow') {
      const sh = rect(Math.min(side.a.x, side.b.x), gy - 4, Math.abs(side.b.x - side.a.x), 4)
      shape({ kind: 'rect', name: 'scene-shadow', points: sh, fill: 'trunk', stroke: false }, true)
    } else {
      strokes.push({ a: side.a, b: side.b })
    }
  }

  // The right angle.
  const others = (id: string) => spec.corners.filter((c) => c.id !== id).map((c) => P[c.id]!)
  const [o1, o2] = others(right) as [Pt, Pt]
  const d1 = unit(sub(o1, R))
  const d2 = unit(sub(o2, R))
  const rightMark = [add(R, mul(d1, 11)), add(add(R, mul(d1, 11)), mul(d2, 11)), add(R, mul(d2, 11))]
  strokes.push(...polySegs(rightMark, false))

  // Equal legs.
  const equalTicks: [Pt, Pt][] = []
  if (spec.equalLegs) {
    for (const other of [L, T]) {
      const mid = mul(add(R, other), 0.5)
      const n = unit({ x: -(other.y - R.y), y: other.x - R.x })
      const tk: [Pt, Pt] = [add(mid, mul(n, 6)), add(mid, mul(n, -6))]
      equalTicks.push(tk)
      strokes.push({ a: tk[0], b: tk[1] })
    }
  }

  // The marked angles' arcs (labels later).
  const arcs: TriangleLayout['arcs'] = []
  let horizontal: [Pt, Pt] | null = null
  const angleDirs: { key: string; at: string; V: Pt; u1: Pt; u2: Pt; ra: number; label: string }[] = []
  for (const a of spec.angles) {
    const V = P[a.at]!
    let u1: Pt
    let u2: Pt
    let ra = 22
    if (a.fromHorizontal) {
      const far = spec.corners.find((c) => c.id !== a.at && c.id !== right)!
      u2 = unit(sub(P[far.id]!, V))
      u1 = { x: Math.sign(u2.x) || 1, y: 0 }
      const reach = Math.min(Math.max(70, 0.8 * Math.abs(P[far.id]!.x - V.x)), TRI_VW - 10 - V.x)
      horizontal = [V, { x: r2(V.x + u1.x * reach), y: V.y }]
      strokes.push({ a: horizontal[0], b: horizontal[1] })
      ra = 32
    } else {
      const [p1, p2] = others(a.at) as [Pt, Pt]
      u1 = unit(sub(p1, V))
      u2 = unit(sub(p2, V))
    }
    const a1 = Math.atan2(u1.y, u1.x)
    let delta = Math.atan2(u2.y, u2.x) - a1
    while (delta <= -Math.PI) delta += 2 * Math.PI
    while (delta > Math.PI) delta -= 2 * Math.PI
    const start = add(V, mul(u1, ra))
    const end = add(V, mul(u2, ra))
    arcs.push({ key: a.at, d: `M${r2(start.x)},${r2(start.y)} A${ra},${ra} 0 0 ${delta > 0 ? 1 : 0} ${r2(end.x)},${r2(end.y)}` })
    const pts: Pt[] = []
    for (let i = 0; i <= 10; i++) pts.push(add(V, mul({ x: Math.cos(a1 + (delta * i) / 10), y: Math.sin(a1 + (delta * i) / 10) }, ra)))
    strokes.push(...polySegs(pts, false))
    angleDirs.push({ key: a.at, at: a.at, V, u1, u2, ra, label: a.label })
  }

  // Dimension lines (their labels sit in their own gap).
  const dims: LayoutDimension[] = []
  const labels: LayoutLabel[] = []
  const inside = (b: Box) => b.l >= 2 && b.r <= TRI_VW - 2 && b.t >= 2 && b.b <= height - 2
  const clear = (b: Box) => inside(b) && !strokes.some((sg) => segHitsBox(sg, b)) && !obstacles.some((o) => overlaps(o, b)) && !labels.some((l) => overlaps(l.box, b))
  const thirdOf = (from: string, to: string) => P[spec.corners.find((c) => c.id !== from && c.id !== to)!.id]!
  const order = [...spec.sides].sort((a, b) => Number(Boolean(a.after)) - Number(Boolean(b.after)))
  const shown = order.filter((sd) => visible(sd.after))

  for (const sd of shown.filter((x) => x.dimension)) {
    const A = P[sd.from]!
    const B = P[sd.to]!
    const third = thirdOf(sd.from, sd.to)
    const horizontalSide = Math.abs(A.y - B.y) < 1
    const { w, h } = labelHalf(sd.label)
    let n: Pt
    let D: number
    if (horizontalSide) {
      // Below the ground band.
      n = { x: 0, y: 1 }
      D = 26
    } else {
      // Beside the wall, the tree's crown or the tower, far enough that the label in its gap clears them.
      n = { x: Math.sign(A.x - third.x) || 1, y: 0 }
      const prop = spec.scene === 'ladder' ? 12 : spec.scene === 'tree' ? 15 : spec.scene === 'lighthouse' ? 20 : 0
      D = prop + w + 5
    }
    const a2 = add(A, mul(n, D))
    const b2 = add(B, mul(n, D))
    const mid = mul(add(a2, b2), 0.5)
    const t = unit(sub(b2, a2))
    const gap = (horizontalSide ? w : h) + 4
    const line: [Pt, Pt][] = [
      [a2, sub(mid, mul(t, gap))],
      [add(mid, mul(t, gap)), b2],
    ]
    const ticks: [Pt, Pt][] = [
      [sub(a2, mul(n, 5)), add(a2, mul(n, 5))],
      [sub(b2, mul(n, 5)), add(b2, mul(n, 5))],
    ]
    const ext: [Pt, Pt][] = [
      [add(A, mul(n, 3)), add(a2, mul(n, 3))],
      [add(B, mul(n, 3)), add(b2, mul(n, 3))],
    ]
    for (const [p, q] of [...line, ...ticks, ...ext]) strokes.push({ a: p, b: q })
    dims.push({ key: `${sd.from}-${sd.to}`, line, ticks, ext })
    labels.push({ text: sd.label, x: r2(mid.x), y: r2(mid.y), box: boxAt(mid, sd.label), kind: 'dimension', key: `${sd.from}-${sd.to}` })
  }

  for (const a of angleDirs) {
    const u = unit(add(a.u1, a.u2))
    const { w, h } = labelHalf(a.label)
    const ext = w * Math.abs(u.x) + h * Math.abs(u.y)
    let best: Pt | null = null
    for (let r = a.ra + ext + 6; r <= a.ra + ext + 90 && !best; r += 3) {
      const c = add(a.V, mul(u, r))
      if (clear(boxAt(c, a.label))) best = c
    }
    const c = best ?? add(a.V, mul(u, a.ra + ext + 6))
    labels.push({ text: a.label, x: r2(c.x), y: r2(c.y), box: boxAt(c, a.label), kind: 'angle', key: a.at })
  }

  for (const sd of shown.filter((x) => !x.dimension)) {
    const A = P[sd.from]!
    const B = P[sd.to]!
    const third = thirdOf(sd.from, sd.to)
    let n = unit({ x: -(B.y - A.y), y: B.x - A.x })
    const midAB = mul(add(A, B), 0.5)
    if ((third.x - midAB.x) * n.x + (third.y - midAB.y) * n.y > 0) n = mul(n, -1)
    const { w, h } = labelHalf(sd.label)
    const ext = w * Math.abs(n.x) + h * Math.abs(n.y)
    const thick = STYLE[spec.scene].hyp === 'ladder' && sd.from === low && sd.to === top ? 4 : 0
    let best: Pt | null = null
    for (const t of [0.5, 0.4, 0.6, 0.32, 0.68]) {
      for (let d = ext + 7 + thick; d <= ext + 50 && !best; d += 3) {
        const c = add(add(A, mul(sub(B, A), t)), mul(n, d))
        if (clear(boxAt(c, sd.label))) best = c
      }
      if (best) break
    }
    const c = best ?? add(midAB, mul(n, ext + 7 + thick))
    labels.push({ text: sd.label, x: r2(c.x), y: r2(c.y), box: boxAt(c, sd.label), kind: 'side', key: `${sd.from}-${sd.to}` })
  }

  return { width: TRI_VW, height, P, sides, rightMark, arcs, horizontal, equalTicks, dims, scene, labels, strokes, obstacles }
}
