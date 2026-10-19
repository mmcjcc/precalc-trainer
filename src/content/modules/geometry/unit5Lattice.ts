/**
 * Quadrilaterals with whole-number vertices for the Unit 5 coordinate problems. Each shape is built around the
 * origin and then slid to a random place on the grid (every vertex within 7 of the origin), so a vertex never
 * sits off the drawn grid. Slopes and lengths are exact.
 */
import type { Rng } from '@/content/rng'
import { formatQty, simplifyRadical } from './answer'
import { RESERVED_TEXT } from './unit5Build'

export const LIMIT = 7

export interface V {
  x: number
  y: number
}

export const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y })
export const scale = (k: number, a: V): V => ({ x: k * a.x, y: k * a.y })
export const minus = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y })
export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))

/** A slope she can find that is a fraction, not a whole number, and not one of the hint examples. */
export function slopeOk(v: V): boolean {
  if (v.x === 0 || v.y === 0) return false
  if (v.y % v.x === 0) return false
  return !RESERVED_TEXT.has(slopeText(v))
}

/** A length she can find that is an irrational radical, and not a hint or catalog example. */
export function lenOk(v: V): boolean {
  const sq = v.x * v.x + v.y * v.y
  const root = Math.round(Math.sqrt(sq))
  if (root * root === sq) return false
  return !RESERVED_TEXT.has(lenText(v))
}

export function slopeText(v: V): string {
  const g = gcd(v.y, v.x) || 1
  let n = v.y / g
  let d = v.x / g
  if (d < 0) {
    n = -n
    d = -d
  }
  return d === 1 ? String(n) : `${n}/${d}`
}

export function lenText(v: V): string {
  return formatQty(simplifyRadical(1, 1, v.x * v.x + v.y * v.y))
}

export function vec(rng: Rng, lo = -6, hi = 6): V {
  return { x: rng.int(lo, hi), y: rng.int(lo, hi) }
}

export function angleBetween(a: V, b: V): number {
  const cos = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y))
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
}

/** Slide a shape built around the origin to a random place where every vertex fits on the grid. */
export function onGrid(rng: Rng, rel: V[]): V[] | null {
  const xs = rel.map((p) => p.x)
  const ys = rel.map((p) => p.y)
  const lo = { x: -LIMIT - Math.min(...xs), y: -LIMIT - Math.min(...ys) }
  const hi = { x: LIMIT - Math.max(...xs), y: LIMIT - Math.max(...ys) }
  if (lo.x > hi.x || lo.y > hi.y) return null
  const shift = { x: rng.int(lo.x, hi.x), y: rng.int(lo.y, hi.y) }
  return rel.map((p) => add(p, shift))
}

/** A parallelogram P, P + u, P + u + v, P + v, with no right angle and no two consecutive sides equal. */
export function latticePgram(rng: Rng, ok: (v: V) => boolean): V[] | null {
  const u = vec(rng)
  const v = vec(rng)
  if (!ok(u) || !ok(v)) return null
  const ang = angleBetween(u, v)
  if (ang < 35 || ang > 145 || Math.abs(ang - 90) < 8) return null
  const ratio = Math.hypot(u.x, u.y) / Math.hypot(v.x, v.y)
  if (ratio < 0.45 || ratio > 2.2 || Math.abs(ratio - 1) < 0.12) return null
  const O = { x: 0, y: 0 }
  return onGrid(rng, [O, u, add(u, v), v])
}

/** A trapezoid: PQ ∥ SR with different lengths, legs not parallel and not equal. */
export function latticeTrap(rng: Rng): V[] | null {
  const d = vec(rng, -3, 3)
  if (gcd(d.x, d.y) !== 1 || !slopeOk(d)) return null
  const k = rng.int(1, 3)
  const j = rng.intExcept(1, 3, [k])
  const w = vec(rng)
  const legQR = add(w, scale(j - k, d))
  if (!slopeOk(w) || !slopeOk(legQR)) return null
  if (w.x * w.x + w.y * w.y === legQR.x * legQR.x + legQR.y * legQR.y) return null
  const O = { x: 0, y: 0 }
  return onGrid(rng, [O, scale(k, d), add(w, scale(j, d)), w])
}

/**
 * An isosceles trapezoid on the lattice: bases along d = (p, q), symmetric about the line through the origin
 * along n = (−q, p). P = −a·d, Q = a·d, R = s·n + b·d, S = s·n − b·d.
 */
export function latticeIsoTrap(rng: Rng): V[] | null {
  const d = vec(rng, -3, 3)
  if (gcd(d.x, d.y) !== 1 || d.x === 0 || d.y === 0) return null
  const n = { x: -d.y, y: d.x }
  const a = rng.int(1, 3)
  const b = rng.intExcept(1, 3, [a])
  const s = rng.pick([-2, -1, 1, 2])
  const P = scale(-a, d)
  const Q = scale(a, d)
  const R = add(scale(s, n), scale(b, d))
  const S = minus(scale(s, n), scale(b, d))
  return onGrid(rng, [P, Q, R, S])
}

/** Any convex quadrilateral whose diagonals do not share a midpoint. */
export function latticeQuad(rng: Rng): V[] | null {
  const pts = [vec(rng, -LIMIT, LIMIT), vec(rng, -LIMIT, LIMIT), vec(rng, -LIMIT, LIMIT), vec(rng, -LIMIT, LIMIT)]
  const m1 = add(pts[0]!, pts[2]!)
  const m2 = add(pts[1]!, pts[3]!)
  if (m1.x === m2.x && m1.y === m2.y) return null
  return pts
}
