/**
 * Shared geometry for honors Unit 6 (similarity). Every figure is built exactly: a triangle from its three sides, from
 * two sides and the angle between them, or from its angles; a quadrilateral from four sides and a diagonal; a similar
 * copy by a scale factor, turned and sometimes mirrored. Letters come from the seed. Nothing here knows about a
 * problem's answer; the templates decide what to label.
 */
import type { Rng } from '@/content/rng'
import type { GeoPoint } from '@/shared/types'
import { POOL5, centroid, deg, dist, interiorAngles, rad, type XY } from './unit5Geom'

export type { XY }
export { centroid, deg, dist, interiorAngles, rad }

/** Capitals with no I, O, J, K, L, M, N, or X (J to N name the rule cards' and the catalog's examples). */
export const POOL6 = POOL5

/** `n` different letters from the pool, none of `used`, in a seeded order. */
export function pickLetters6(rng: Rng, n: number, used: readonly string[] = []): string[] {
  const pool = POOL6.split('').filter((ch) => !used.includes(ch))
  const out: string[] = []
  for (let i = 0; i < n; i++) out.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]!)
  return out
}

/** `n` letters in a row from the pool (EFGH, TSRQ), forward or backward from a seeded start, none of `used`. */
export function runLetters6(rng: Rng, n: number, used: readonly string[] = []): string[] | null {
  const pool = POOL6.split('').filter((ch) => !used.includes(ch))
  if (pool.length < n) return null
  const start = rng.int(0, pool.length - 1)
  const dir = rng.chance(0.5) ? 1 : -1
  const out: string[] = []
  for (let k = 0; k < n; k++) out.push(pool[(((start + dir * k) % pool.length) + pool.length) % pool.length]!)
  return out
}

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) [x, y] = [y, x % y]
  return x || 1
}

/** Angle at v between the rays to p and q, in degrees (0 to 180). */
export function angleAt(v: XY, p: XY, q: XY): number {
  const ux = p.x - v.x
  const uy = p.y - v.y
  const wx = q.x - v.x
  const wy = q.y - v.y
  const c = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))
  return deg(Math.acos(Math.max(-1, Math.min(1, c))))
}

/** The three angles of a triangle, at its first, second and third vertex. */
export function triAngles(t: readonly [XY, XY, XY]): [number, number, number] {
  return [angleAt(t[0], t[1], t[2]), angleAt(t[1], t[0], t[2]), angleAt(t[2], t[0], t[1])]
}

/** Signed area, positive when the vertices run counterclockwise. */
export function signedArea(pts: readonly XY[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    s += a.x * b.y - b.x * a.y
  }
  return s / 2
}

/**
 * A triangle from its sides: `ab` from the first vertex to the second, `bc`, and `ca`. The first vertex at the origin,
 * the second along the x-axis, the third above it. Null when the sides do not make a triangle.
 */
export function triFromSides(ab: number, bc: number, ca: number): [XY, XY, XY] | null {
  if (ab <= 0 || bc <= 0 || ca <= 0) return null
  if (ab + bc <= ca || bc + ca <= ab || ca + ab <= bc) return null
  const cosA = (ab * ab + ca * ca - bc * bc) / (2 * ab * ca)
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA))
  return [
    { x: 0, y: 0 },
    { x: ab, y: 0 },
    { x: ca * cosA, y: ca * sinA },
  ]
}

/** A triangle with `ab` and `ac` around the angle `theta` (degrees) at the first vertex. */
export function triFromSas(ab: number, ac: number, theta: number): [XY, XY, XY] {
  const t = rad(theta)
  return [
    { x: 0, y: 0 },
    { x: ab, y: 0 },
    { x: ac * Math.cos(t), y: ac * Math.sin(t) },
  ]
}

/** A triangle with the given angles at its first two vertices and `ab` between them. */
export function triFromAngles(a0: number, a1: number, ab: number): [XY, XY, XY] {
  const a2 = 180 - a0 - a1
  const ac = (ab * Math.sin(rad(a1))) / Math.sin(rad(a2))
  return [
    { x: 0, y: 0 },
    { x: ab, y: 0 },
    { x: ac * Math.cos(rad(a0)), y: ac * Math.sin(rad(a0)) },
  ]
}

/**
 * A convex quadrilateral from its sides in order (s0 = V0V1, s1 = V1V2, s2 = V2V3, s3 = V3V0) and the diagonal V0V2,
 * with the two triangles on opposite sides of that diagonal. Null when either triangle fails or the result is not
 * convex.
 */
export function quadFromSides(s: readonly [number, number, number, number], d: number): [XY, XY, XY, XY] | null {
  const t1 = triFromSides(d, s[1], s[0]) // V0, V2, V1 with V0V2 = d, V2V1 = s1, V1V0 = s0
  const t2 = triFromSides(d, s[2], s[3]) // V0, V2, V3 with V2V3 = s2, V3V0 = s3
  if (!t1 || !t2) return null
  const v0 = t1[0]
  const v2 = t1[1]
  const v1 = { x: t1[2].x, y: -t1[2].y }
  const v3 = t2[2]
  const quad: [XY, XY, XY, XY] = [v0, v1, v2, v3]
  return convex(quad) ? quad : null
}

/** Strictly convex: every turn the same way. */
export function convex(pts: readonly XY[]): boolean {
  let sign = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const c = pts[(i + 2) % pts.length]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-9) return false
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/** Every angle between `min` and 180 − `min`, and no side shorter than `minSide` of the longest. */
export function readable(pts: readonly XY[], min = 28, minSide = 0.3): boolean {
  if (!convex(pts)) return false
  const angles = pts.length === 3 ? triAngles(pts as [XY, XY, XY]) : interiorAngles(pts)
  if (angles.some((g) => g < min || g > 180 - min)) return false
  const sides = pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]!))
  return Math.min(...sides) >= minSide * Math.max(...sides)
}

/** Mirror across the vertical line through the centroid when `reflect`, then turn by `turnDeg` about the centroid. */
export function turned(pts: readonly XY[], turnDeg: number, reflect: boolean): XY[] {
  const c = centroid(pts)
  const t = rad(turnDeg)
  return pts.map((p) => {
    const x = reflect ? 2 * c.x - p.x : p.x
    const dx = x - c.x
    const dy = p.y - c.y
    return { x: c.x + dx * Math.cos(t) - dy * Math.sin(t), y: c.y + dx * Math.sin(t) + dy * Math.cos(t) }
  })
}

export function scaled(pts: readonly XY[], k: number): XY[] {
  return pts.map((p) => ({ x: p.x * k, y: p.y * k }))
}

export function shifted(pts: readonly XY[], dx: number, dy: number): XY[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

export function bounds(pts: readonly XY[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    maxX: Math.max(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxY: Math.max(...pts.map((p) => p.y)),
  }
}

/** `right` moved so it starts `gap` to the right of `left` and the two share a vertical middle. */
export function besideRight(left: readonly XY[], right: readonly XY[], gap: number): XY[] {
  const l = bounds(left)
  const r = bounds(right)
  return shifted(right, l.maxX + gap - r.minX, (l.minY + l.maxY) / 2 - (r.minY + r.maxY) / 2)
}

/** The point a fraction `t` of the way from a to b. */
export function along(a: XY, b: XY, t: number): XY {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Smallest difference between two directions, in degrees (0 to 180). */
export function angleGap(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

/** Direction from the centroid of `pts` to `p`, in degrees. */
export function heading(pts: readonly XY[], p: XY): number {
  const c = centroid(pts)
  return deg(Math.atan2(p.y - c.y, p.x - c.x))
}

/** Direction from the centroid of a polygon to the middle of its side i (vertex i to vertex i + 1). */
export function sideHeading(pts: readonly XY[], i: number): number {
  const a = pts[i]!
  const b = pts[(i + 1) % pts.length]!
  return heading(pts, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
}

/**
 * Where a student who matches by the picture would look: for each side (or vertex) of `second`, the side (or vertex)
 * of `first` drawn in the same direction from its middle, and how clear that choice is (the gap to the next best).
 */
export function matchByPosition(first: readonly XY[], second: readonly XY[], kind: 'side' | 'vertex'): { index: number; margin: number }[] {
  const dir = (pts: readonly XY[], i: number) => (kind === 'side' ? sideHeading(pts, i) : heading(pts, pts[i]!))
  return second.map((_, j) => {
    const target = dir(second, j)
    const gaps = first.map((__, i) => ({ i, gap: angleGap(dir(first, i), target) })).sort((p, q) => p.gap - q.gap)
    return { index: gaps[0]!.i, margin: gaps[1]!.gap - gaps[0]!.gap }
  })
}

const r2 = (n: number) => Math.round(n * 1000) / 1000

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

/** Labeled points, each letter set away from the middle of `around`. GeoFigure moves a letter off any line it hits. */
export function points6(ids: readonly string[], pts: readonly XY[], around: readonly XY[]): GeoPoint[] {
  const c = centroid(around)
  return ids.map((id, i) => {
    const p = pts[i]!
    return { id, x: r2(p.x), y: r2(p.y), label: id, labelSide: outward(p.x - c.x, p.y - c.y) }
  })
}

/** A point's letter set on a given side (a point on a side of a triangle, labeled away from the inside). */
export function pointAt(id: string, p: XY, side: NonNullable<GeoPoint['labelSide']>): GeoPoint {
  return { id, x: r2(p.x), y: r2(p.y), label: id, labelSide: side }
}

/** The label side for a point on segment ab, away from `inside` (a point of the figure on the other side). */
export function awayFrom(p: XY, inside: XY): NonNullable<GeoPoint['labelSide']> {
  return outward(p.x - inside.x, p.y - inside.y)
}

/** Points rounded the way the figure stores them, so every check measures what is drawn. */
export function asDrawn(p: XY): XY {
  return { x: r2(p.x), y: r2(p.y) }
}

/** Every permutation of [0, 1, 2]. */
export const PERMS3: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
]

/** True when the triangles have equal angles in this vertex order (within `tol` degrees). */
export function sameAngles(t: readonly [XY, XY, XY], u: readonly [XY, XY, XY], tol = 0.05): boolean {
  const a = triAngles(t)
  const b = triAngles(u)
  return a.every((g, i) => Math.abs(g - b[i]!) <= tol)
}
