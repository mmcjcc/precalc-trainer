/**
 * Shared geometry for honors Unit 5 (quadrilaterals). Letters and shapes come from the seed, and every figure
 * is turned and sometimes mirrored, so where a vertex sits never gives the answer. Every quadrilateral is
 * checked to be a real convex figure (no three vertices in a line, no crossing outline) before it is drawn.
 */
import type { Rng } from '@/content/rng'
import type { GeoPoint } from '@/shared/types'

/**
 * Capitals that are not I, O, J, K, L, M, N, or X. J, K, L, M, and N name the figures in the rule cards and the
 * catalog examples, so a problem never shares a letter with an example.
 */
export const POOL5 = 'ABCDEFGHPQRSTUVWYZ'

export interface XY {
  x: number
  y: number
}

/** Four letters in a row from the pool, read forward or backward from a seeded start: ABCD, TSRQ, YZAB. */
export function quadLetters(rng: Rng): [string, string, string, string] {
  const start = rng.int(0, POOL5.length - 1)
  const dir = rng.chance(0.5) ? 1 : -1
  const at = (k: number) => POOL5[(((start + dir * k) % POOL5.length) + POOL5.length) % POOL5.length]!
  return [at(0), at(1), at(2), at(3)]
}

/** One or more letters the figure does not already use, for a crossing point or a midpoint. */
export function extraLetters(rng: Rng, used: readonly string[], n: number): string[] {
  const pool = POOL5.split('').filter((ch) => !used.includes(ch))
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!)
  return out
}

export const rad = (deg: number) => (deg * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

export function centroid(pts: readonly XY[]): XY {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
}

/** Mirror about the vertical line through the centroid when `reflect`, then turn by `rotDeg` about the centroid. */
export function turn(pts: readonly XY[], rotDeg: number, reflect: boolean): XY[] {
  const c = centroid(pts)
  const t = rad(rotDeg)
  return pts.map((p) => {
    const x = reflect ? 2 * c.x - p.x : p.x
    const dx = x - c.x
    const dy = p.y - c.y
    return { x: c.x + dx * Math.cos(t) - dy * Math.sin(t), y: c.y + dx * Math.sin(t) + dy * Math.cos(t) }
  })
}

function outward(dx: number, dy: number): NonNullable<GeoPoint['labelSide']> {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ay >= ax * 1.3) return dy >= 0 ? 'above' : 'below'
  if (ax >= ay * 1.3) return dx >= 0 ? 'right' : 'left'
  if (dx >= 0 && dy >= 0) return 'above-right'
  if (dx < 0 && dy >= 0) return 'above-left'
  if (dx >= 0) return 'below-right'
  return 'below-left'
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Points for the figure, labeled away from the middle of `around` (the outline's vertices). A point inside the
 * outline, such as the crossing of the diagonals, starts on its right; GeoFigure moves it off any line.
 */
export function labeled(ids: readonly string[], pts: readonly XY[], around: readonly XY[], insideIds: readonly string[] = []): GeoPoint[] {
  const c = centroid(around)
  return ids.map((id, i) => {
    const p = pts[i]!
    const side = insideIds.includes(id) ? 'right' : outward(p.x - c.x, p.y - c.y)
    return { id, x: r2(p.x), y: r2(p.y), label: id, labelSide: side }
  })
}

/** Corners in order: P at the origin, PQ along the x-axis, the angle at P is `alpha`. */
export function parallelogramAt(a: number, b: number, alpha: number): XY[] {
  const t = rad(alpha)
  const s = { x: b * Math.cos(t), y: b * Math.sin(t) }
  return [{ x: 0, y: 0 }, { x: a, y: 0 }, { x: a + s.x, y: s.y }, s]
}

/** A parallelogram from its diagonals: they cross at the origin at angle `phi`, with halves p (PT = TR) and q (QT = TS). */
export function parallelogramFromDiagonals(p: number, q: number, phi: number): XY[] {
  const t = rad(phi)
  const u = { x: Math.cos(t), y: Math.sin(t) }
  return [
    { x: -p, y: 0 },
    { x: -q * u.x, y: -q * u.y },
    { x: p, y: 0 },
    { x: q * u.x, y: q * u.y },
  ]
}

/** Bases PQ (bottom, from the origin) and SR (top, starting `shift` along); height `h`. */
export function trapezoidAt(bottom: number, top: number, h: number, shift: number): XY[] {
  return [{ x: 0, y: 0 }, { x: bottom, y: 0 }, { x: shift + top, y: h }, { x: shift, y: h }]
}

export function isoTrapezoidAt(bottom: number, top: number, h: number): XY[] {
  return trapezoidAt(bottom, top, h, (bottom - top) / 2)
}

/** Kite with PQ = PS and RQ = RS: P and R on the axis, Q and S mirror images, crossing the axis at distance `p` from P. */
export function kiteAt(axis: number, p: number, w: number): XY[] {
  return [{ x: 0, y: 0 }, { x: p, y: -w }, { x: axis, y: 0 }, { x: p, y: w }]
}

export function dist(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Interior angle at each vertex of a polygon in order, in degrees. */
export function interiorAngles(pts: readonly XY[]): number[] {
  const n = pts.length
  return pts.map((v, i) => {
    const a = pts[(i + n - 1) % n]!
    const b = pts[(i + 1) % n]!
    const u = { x: a.x - v.x, y: a.y - v.y }
    const w = { x: b.x - v.x, y: b.y - v.y }
    const cos = (u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y))
    return deg(Math.acos(Math.max(-1, Math.min(1, cos))))
  })
}

/**
 * A real, readable quadrilateral: strictly convex (every turn the same way, so the outline cannot cross itself
 * and no three vertices are in a line), every angle between `minAngle` and 180 − `minAngle`, and no side shorter
 * than `minSide` of the longest.
 */
export function goodQuad(pts: readonly XY[], minAngle = 25, minSide = 0.22): boolean {
  if (pts.length !== 4) return false
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % 4]!
    const c = pts[(i + 2) % 4]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    const scale = dist(a, b) * dist(b, c)
    if (Math.abs(cross) < 1e-6 * Math.max(1, scale)) return false
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  const angles = interiorAngles(pts)
  if (angles.some((g) => g < minAngle || g > 180 - minAngle)) return false
  if (Math.abs(angles.reduce((s, g) => s + g, 0) - 360) > 1e-6) return false
  const sides = [0, 1, 2, 3].map((i) => dist(pts[i]!, pts[(i + 1) % 4]!))
  return Math.min(...sides) >= minSide * Math.max(...sides)
}

/** A triangle that is not thin: every angle between `minAngle` and 180 − `minAngle`. */
export function goodTriangle(pts: readonly XY[], minAngle = 28): boolean {
  if (pts.length !== 3) return false
  const [a, b, c] = pts as [XY, XY, XY]
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  if (Math.abs(cross) < 1e-6) return false
  return interiorAngles(pts).every((g) => g >= minAngle && g <= 180 - minAngle)
}

/** Where segment ab crosses segment cd, or null when they do not cross inside both. */
export function crossing(a: XY, b: XY, c: XY, d: XY): XY | null {
  const r = { x: b.x - a.x, y: b.y - a.y }
  const s = { x: d.x - c.x, y: d.y - c.y }
  const den = r.x * s.y - r.y * s.x
  if (Math.abs(den) < 1e-12) return null
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null
  return { x: a.x + t * r.x, y: a.y + t * r.y }
}

/** A turn for the figure: small tilts both ways, sometimes upside down. */
export function tilt(rng: Rng, spread: number, flip = true): number {
  const base = flip && rng.chance(0.5) ? 180 : 0
  return base + rng.int(-spread, spread)
}
