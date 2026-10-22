/**
 * Points of interest on the visible curves, computed numerically in the visible window: zeros (a sign change refined
 * by bisection; a touching zero such as (x − 1)² by minimizing |f|), local maxima and minima (Brent's method between
 * the samples around a turn), the y-intercept, and the intersections of every two visible curves (the zeros of their
 * difference, and of a curve with a vertical line). Every curve is sampled once on one grid across the window, so two
 * curves' crossings come from samples already taken; only the refinements evaluate again. A step of the grid that
 * holds one of a curve's breaks (an asymptote, a hole, a domain edge, a restriction's end) is never read as a zero or a
 * turn. Every x is snapped to the integer or simple fraction it is when the function agrees (so y = 500x − 2x² has its
 * maximum at exactly (125, 31250)); a sign change across an asymptote is not a zero, and a curve that is the same as
 * another (or lies along the axis) does not fill the plane with dots. Pure.
 */
import type { CurveFn } from './model'
import { bisect, maximize, minimize, snapExtremum, snapZero, zerosAlong, type Fn } from './roots'

export type PoiKind = 'zero' | 'max' | 'min' | 'yint' | 'intersection'

export interface Poi {
  x: number
  y: number
  kinds: PoiKind[]
  /** The row(s) it belongs to: one, or the two that cross. */
  rows: number[]
}

export interface PoiInput {
  curves: { index: number; fn: CurveFn }[]
  vlines?: { index: number; x: number }[]
  xMin: number
  xMax: number
  /** Samples across the window (more find more close-together turns). */
  samples?: number
  /** Most points of one kind kept for one curve (or one pair), the ones nearest the window's middle. */
  cap?: number
}

export const KIND_WORDS: Record<PoiKind, string> = {
  zero: 'zero',
  max: 'maximum',
  min: 'minimum',
  yint: 'y-intercept',
  intersection: 'intersection',
}

interface Prepared {
  index: number
  f: Fn
  ok: (x: number) => boolean
  /** The curve on the shared grid. */
  ys: number[]
  /** broken[i]: a break of this curve lies between grid points i and i + 1. */
  broken: boolean[]
}

const zeroTol = (x: number) => 1e-9 * Math.max(1, Math.abs(x))
const extremumTol = (x: number) => 2e-7 * Math.max(1, Math.abs(x))

function prepare(index: number, fn: CurveFn, xs: readonly number[]): Prepared {
  const allow = fn.allow
  const ok = allow ? (x: number) => allow(x) : () => true
  const f: Fn = (x) => (ok(x) ? fn.f(x) : Number.NaN)
  const n = xs.length - 1
  const xMin = xs[0]!
  const xMax = xs[n]!
  const ys = xs.map(f)
  const broken = new Array<boolean>(n).fill(false)
  const step = (xMax - xMin) / n
  for (const g of [...fn.crit, ...(fn.allowCrit ?? [])]) {
    for (const c of zerosAlong(g, xMin, xMax, n, 400)) {
      // The grid steps the break touches: the one it falls in, and both around it when it falls on a grid point.
      const at = (c - xMin) / step
      const i = Math.floor(at)
      if (i >= 0 && i < n) broken[i] = true
      if (Math.abs(at - Math.round(at)) < 1e-9) {
        const k = Math.round(at)
        if (k - 1 >= 0 && k - 1 < n) broken[k - 1] = true
        if (k >= 0 && k < n) broken[k] = true
      }
    }
  }
  return { index, f, ok, ys, broken }
}

/** How near the window's middle comes first when a curve has more points than the cap. */
function nearest<T extends { x: number }>(list: T[], mid: number, cap: number): T[] {
  if (list.length <= cap) return list
  return [...list].sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid)).slice(0, cap).sort((a, b) => a.x - b.x)
}

/**
 * The zeros of g (sampled as vs on xs, broken where a step holds a break): isolated exact zeros, sign changes refined
 * by bisection (not across a break, and |g| must be tiny there, which an asymptote's sign change is not), and
 * touching zeros where |g| dips to almost nothing between two steps.
 */
function zerosOn(g: Fn, xs: readonly number[], vs: readonly number[], broken: readonly boolean[], cap: number): number[] {
  const n = xs.length - 1
  const out: number[] = []
  const push = (x: number) => {
    if (out.length > 0 && Math.abs(x - out[out.length - 1]!) <= 1e-12 * Math.max(1, Math.abs(x))) return
    out.push(x)
  }
  for (let i = 0; i <= n && out.length < cap * 4; i++) {
    const v = vs[i]!
    if (v === 0) {
      // A zero on a grid point is a point, and so are two side by side (zeros at 0 and 250, a step of 250 apart); three
      // or more in a row are a stretch along the axis, not points.
      const before = i > 0 && !broken[i - 1] ? vs[i - 1] : undefined
      const after = i < n && !broken[i] ? vs[i + 1] : undefined
      const before2 = i > 1 && !broken[i - 2] && before === 0 ? vs[i - 2] : undefined
      const after2 = i < n - 1 && !broken[i + 1] && after === 0 ? vs[i + 2] : undefined
      if (!(before === 0 && after === 0) && before2 !== 0 && after2 !== 0) push(xs[i]!)
      continue
    }
    if (i === n || broken[i]) continue
    const v1 = vs[i + 1]!
    if (!Number.isFinite(v) || !Number.isFinite(v1) || v1 === 0) continue
    if (Math.sign(v) !== Math.sign(v1)) {
      const x = bisect(g, xs[i]!, v, xs[i + 1]!, v1)
      if (Math.abs(g(x)) <= 1e-7 * Math.max(Math.abs(v), Math.abs(v1))) push(x)
      continue
    }
    if (i === 0 || broken[i - 1]) continue
    const v0 = vs[i - 1]!
    if (!Number.isFinite(v0) || Math.sign(v0) !== Math.sign(v)) continue
    const a = Math.abs(v)
    if (a <= Math.abs(v0) && a <= Math.abs(v1) && a < 0.2 * Math.max(Math.abs(v0), Math.abs(v1))) {
      const x = minimize((t) => Math.abs(g(t)), xs[i - 1]!, xs[i + 1]!, 1e-12)
      if (Math.abs(g(x)) <= 1e-9 * Math.max(Math.abs(v0), Math.abs(v1))) push(x)
    }
  }
  return out
}

/** Zeros, maxima and minima of one curve. */
function ofCurve(c: Prepared, xs: readonly number[], cap: number): Poi[] {
  const n = xs.length - 1
  const ys = c.ys
  const finite = ys.filter(Number.isFinite)
  if (finite.length < 2) return []
  let yMin = Infinity
  let yMax = -Infinity
  for (const y of finite) {
    if (y < yMin) yMin = y
    if (y > yMax) yMax = y
  }
  // A constant: no turns, and if it is 0 it lies along the axis, not at points.
  if (yMax - yMin <= 1e-12 * Math.max(1, Math.abs(yMax))) return []
  const scale = Math.max(Math.abs(yMin), Math.abs(yMax), 1e-300)
  const zeros: Poi[] = zerosOn(c.f, xs, ys, c.broken, cap).map((x) => ({ x: snapZero(c.f, x, zeroTol(x)), y: 0, kinds: ['zero'], rows: [c.index] }))
  const turns: Poi[] = []
  for (let i = 1; i < n; i++) {
    if (c.broken[i - 1] || c.broken[i]) continue
    const y0 = ys[i - 1]!
    const y = ys[i]!
    const y1 = ys[i + 1]!
    if (!Number.isFinite(y0) || !Number.isFinite(y) || !Number.isFinite(y1)) continue
    for (const sign of [1, -1] as const) {
      if (!(sign * (y - y0) > 0)) continue
      let end = i + 1
      if (y === y1) {
        // One tie at the top (samples either side of a turn): the step after it must come down.
        const y2 = ys[i + 2]
        if (y2 === undefined || c.broken[i + 1] || !Number.isFinite(y2) || !(sign * (y1 - y2) > 0)) continue
        end = i + 2
      } else if (!(sign * (y - y1) > 0)) continue
      const raw = sign > 0 ? maximize(c.f, xs[i - 1]!, xs[end]!) : minimize(c.f, xs[i - 1]!, xs[end]!)
      const x = snapExtremum(c.f, raw, extremumTol(raw), sign)
      const fx = c.f(x)
      if (!Number.isFinite(fx) || sign * fx < sign * ys[i - 1]! || sign * fx < sign * ys[end]!) continue
      const touching = Math.abs(fx) <= 1e-9 * scale
      turns.push({ x, y: touching ? 0 : fx, kinds: touching ? ['zero', sign > 0 ? 'max' : 'min'] : [sign > 0 ? 'max' : 'min'], rows: [c.index] })
    }
  }
  const mid = (xs[0]! + xs[n]!) / 2
  return [...nearest(zeros, mid, cap), ...nearest(turns, mid, cap)]
}

/** Where two curves cross (or touch), from the samples both already have. */
function ofPair(a: Prepared, b: Prepared, xs: readonly number[], cap: number): Poi[] {
  const n = xs.length - 1
  const hs = xs.map((_, i) => {
    const ya = a.ys[i]!
    const yb = b.ys[i]!
    return Number.isFinite(ya) && Number.isFinite(yb) ? ya - yb : Number.NaN
  })
  const both = hs.filter(Number.isFinite)
  // The same curve twice crosses itself everywhere: no points for it.
  if (both.length > 0 && both.filter((h) => h === 0).length > both.length / 2) return []
  const broken = a.broken.map((v, i) => v || b.broken[i]!)
  const h: Fn = (x) => a.f(x) - b.f(x)
  const found: Poi[] = []
  for (const x of zerosOn(h, xs, hs, broken, cap)) {
    const sx = snapZero(h, x, zeroTol(x))
    const y = a.f(sx)
    if (!Number.isFinite(y) || !Number.isFinite(b.f(sx))) continue
    found.push({ x: sx, y, kinds: ['intersection'], rows: [a.index, b.index] })
  }
  return nearest(found, (xs[0]! + xs[n]!) / 2, cap)
}

const sameSpot = (p: Poi, q: Poi) => Math.abs(p.x - q.x) <= 1e-9 * Math.max(1, Math.abs(p.x)) && Math.abs(p.y - q.y) <= 1e-9 * Math.max(1, Math.abs(p.y))

/** Points of interest of the visible curves in [xMin, xMax], merged where two describe one spot of one row. */
export function pointsOfInterest(input: PoiInput): Poi[] {
  const { xMin, xMax } = input
  if (!(xMax > xMin)) return []
  const n = input.samples ?? 600
  const cap = input.cap ?? 30
  const xs: number[] = []
  for (let i = 0; i <= n; i++) xs.push(i === n ? xMax : xMin + ((xMax - xMin) * i) / n)
  const prepared = input.curves.map((c) => prepare(c.index, c.fn, xs))
  const all: Poi[] = []
  for (const c of prepared) {
    all.push(...ofCurve(c, xs, cap))
    if (xMin <= 0 && xMax >= 0 && c.ok(0)) {
      const y = c.f(0)
      if (Number.isFinite(y)) all.push({ x: 0, y, kinds: ['yint'], rows: [c.index] })
    }
  }
  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) all.push(...ofPair(prepared[i]!, prepared[j]!, xs, cap))
  }
  for (const v of input.vlines ?? []) {
    if (v.x < xMin || v.x > xMax) continue
    for (const c of prepared) {
      if (!c.ok(v.x)) continue
      const y = c.f(v.x)
      if (Number.isFinite(y)) all.push({ x: v.x, y, kinds: ['intersection'], rows: [c.index, v.index].sort((p, q) => p - q) })
    }
  }
  // One dot per spot and set of rows; its kinds together ("zero · y-intercept").
  const merged: Poi[] = []
  for (const p of all) {
    const same = merged.find((q) => q.rows.join() === p.rows.join() && sameSpot(p, q))
    if (same) {
      for (const k of p.kinds) if (!same.kinds.includes(k)) same.kinds.push(k)
      if (p.y === 0) same.y = 0
    } else merged.push({ ...p, kinds: [...p.kinds], rows: [...p.rows] })
  }
  const order: PoiKind[] = ['zero', 'yint', 'max', 'min', 'intersection']
  for (const p of merged) p.kinds.sort((a, b) => order.indexOf(a) - order.indexOf(b))
  return merged.sort((p, q) => p.rows[0]! - q.rows[0]! || (p.rows[1] ?? -1) - (q.rows[1] ?? -1) || p.x - q.x)
}

/** "maximum", "zero · y-intercept". */
export function kindWords(p: Poi): string {
  return p.kinds.map((k) => KIND_WORDS[k]).join(' · ')
}
