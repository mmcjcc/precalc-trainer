/**
 * When two of her equations say the same thing. The fencing (or sales, or number) equation is linear in x and y: two
 * linear equations are equivalent when one is a nonzero multiple of the other, so 2x + y = 500, 500 = 2x + y,
 * y = 500 − 2x and 4x + 2y = 1000 are one equation. An equation with the quantity's letter in it (A = xy, A = 3xy,
 * A = x(500 − 2x)) is solved for that letter and compared by its values at points inside the problem's domain.
 */
import type { OptDomain } from './types'
import { residual, type OptEquation } from './read'

export type Point = { x: number; y: number }

/**
 * Points spread over the domain, the same every time: a low-discrepancy sequence (the plastic-number "R2"
 * sequence), kept off the edges.
 */
export function domainPoints(domain: OptDomain, count = 9): Point[] {
  const g = 1.324717957244746
  const a1 = 1 / g
  const a2 = 1 / (g * g)
  const out: Point[] = []
  for (let i = 1; i <= count; i++) {
    const fx = 0.04 + 0.92 * ((0.5 + a1 * i) % 1)
    const fy = 0.04 + 0.92 * ((0.5 + a2 * i) % 1)
    out.push({ x: domain.x[0] + fx * (domain.x[1] - domain.x[0]), y: domain.y[0] + fy * (domain.y[1] - domain.y[0]) })
  }
  return out
}

const near = (a: number, b: number, scale: number, rel = 1e-8) => Math.abs(a - b) <= rel * Math.max(1, scale)

/** Does the equation use this letter (as the parser keeps it)? Checked by evaluation, not by its spelling. */
export function usesLetter(eq: OptEquation, letter: string, points: readonly Point[]): boolean {
  for (const p of points) {
    const base = { x: p.x, y: p.y, [eq.key]: 1.7 }
    const r0 = residual(eq, base)
    const r1 = residual(eq, { ...base, [letter]: (base as Record<string, number>)[letter]! + 3.1 })
    if (r0 === 'undef' || r1 === 'undef') continue
    if (!near(r0, r1, Math.max(Math.abs(r0), Math.abs(r1)), 1e-10)) return true
  }
  return false
}

/** a·x + b·y + c = 0, the equation moved to one side. */
export interface LinearForm {
  a: number
  b: number
  c: number
}

/**
 * The equation as a·x + b·y + c = 0 when it is linear in x and y over the points (and has no quantity letter in it);
 * null otherwise.
 */
export function linearForm(eq: OptEquation, points: readonly Point[]): LinearForm | null {
  if (usesLetter(eq, eq.key, points)) return null
  const p0 = points[0]
  if (!p0) return null
  const at = (x: number, y: number) => residual(eq, { x, y, [eq.key]: 0 })
  const r0 = at(p0.x, p0.y)
  const rx = at(p0.x + 1, p0.y)
  const ry = at(p0.x, p0.y + 1)
  if (r0 === 'undef' || rx === 'undef' || ry === 'undef') return null
  const a = rx - r0
  const b = ry - r0
  const c = r0 - a * p0.x - b * p0.y
  for (const p of points) {
    const r = at(p.x, p.y)
    if (r === 'undef') return null
    const lin = a * p.x + b * p.y + c
    if (!near(r, lin, Math.max(Math.abs(r), Math.abs(a * p.x), Math.abs(b * p.y), Math.abs(c)), 1e-9)) return null
  }
  return { a, b, c }
}

/** Two linear equations are the same equation when one is a nonzero multiple of the other. */
export function sameLinear(p: LinearForm, q: LinearForm): boolean {
  const qs = [q.a, q.b, q.c]
  const ps = [p.a, p.b, p.c]
  const big = Math.max(...qs.map(Math.abs))
  const pbig = Math.max(...ps.map(Math.abs))
  if (big === 0 || pbig === 0) return false
  // The ratio from q's largest coefficient; every coefficient has to follow it.
  const i = qs.findIndex((v) => Math.abs(v) === big)
  const k = ps[i]! / qs[i]!
  if (k === 0 || !Number.isFinite(k)) return false
  return ps.every((v, j) => near(v, k * qs[j]!, pbig, 1e-9))
}

/** Neither x nor y: 0 = 0 (true everywhere) or 0 = 5 (true nowhere). */
export function degenerate(p: LinearForm): 'identity' | 'contradiction' | null {
  const scale = Math.max(1, Math.abs(p.a), Math.abs(p.b), Math.abs(p.c))
  if (Math.abs(p.a) > 1e-9 * scale || Math.abs(p.b) > 1e-9 * scale) return null
  return Math.abs(p.c) <= 1e-9 * scale ? 'identity' : 'contradiction'
}

/**
 * The equation solved for one of its letters (the quantity, or x, or y) at a point: the letter appears linearly, so
 * the equation is α·letter + β = 0 there. Null where it is undefined, the letter cancels, or it is not linear.
 */
export function solvedAt(eq: OptEquation, letter: string, scope: Record<string, number>): number | null {
  const r = (v: number) => residual(eq, { ...scope, [letter]: v })
  const r0 = r(0)
  const r1 = r(1)
  const r2 = r(-2.5)
  if (r0 === 'undef' || r1 === 'undef' || r2 === 'undef') return null
  const alpha = r1 - r0
  const scale = Math.max(Math.abs(r0), Math.abs(r1), Math.abs(r2))
  if (Math.abs(alpha) <= 1e-12 * Math.max(1, scale)) return null
  if (!near(r2, r0 - 2.5 * alpha, scale, 1e-9)) return null
  return -r0 / alpha
}

export type SolvedProblem = 'absent' | 'not_solvable'

/**
 * The equation solved for `letter` as a function of x and y (the other letters at the point), or why it cannot be:
 * the letter is not in it, or it does not appear linearly (or cancels) at most points.
 */
export function solvedFor(eq: OptEquation, letter: string, points: readonly Point[]): ((p: Point) => number | null) | SolvedProblem {
  if (!usesLetter(eq, letter, points)) return 'absent'
  let solved = 0
  for (const p of points) if (solvedAt(eq, letter, { x: p.x, y: p.y, [eq.key]: 1.7 }) !== null) solved++
  if (solved < Math.ceil(points.length / 2)) return 'not_solvable'
  return (p) => solvedAt(eq, letter, { x: p.x, y: p.y, [eq.key]: 1.7 })
}

/** Two functions agree at every point where both are defined, and both are defined at most of the points. */
export function sameValues(f: (p: Point) => number | null, g: (p: Point) => number | null, points: readonly Point[]): boolean {
  let compared = 0
  for (const p of points) {
    const a = f(p)
    const b = g(p)
    if (a === null && b === null) continue
    if (a === null || b === null) return false
    if (!near(a, b, Math.max(Math.abs(a), Math.abs(b)), 1e-8)) return false
    compared++
  }
  return compared >= Math.ceil(points.length / 2)
}

/** Which of x and y a function of the point really depends on. */
export function dependence(f: (p: Point) => number | null, points: readonly Point[]): { x: boolean; y: boolean } {
  let x = false
  let y = false
  for (const p of points) {
    const v = f(p)
    if (v === null) continue
    const vx = f({ x: p.x * 1.37 + 0.71, y: p.y })
    const vy = f({ x: p.x, y: p.y * 1.37 + 0.71 })
    if (vx !== null && !near(v, vx, Math.max(Math.abs(v), Math.abs(vx)), 1e-10)) x = true
    if (vy !== null && !near(v, vy, Math.max(Math.abs(v), Math.abs(vy)), 1e-10)) y = true
  }
  return { x, y }
}

/**
 * Two equations without the quantity's letter say the same thing: as linear equations (a nonzero multiple), or, for
 * a curve such as xy = 500, by solving each for y (or x) and comparing the values.
 */
export function sameCurve(her: OptEquation, other: OptEquation, points: readonly Point[]): boolean {
  if (usesLetter(her, her.key, points) || usesLetter(other, other.key, points)) return false
  const lh = linearForm(her, points)
  const lo = linearForm(other, points)
  if (lh && lo) return sameLinear(lh, lo)
  if (lh || lo) return false
  for (const letter of ['y', 'x'] as const) {
    const f = solvedFor(her, letter, points)
    const g = solvedFor(other, letter, points)
    if (typeof f === 'function' && typeof g === 'function') return sameValues(f, g, points)
  }
  return false
}

/** Two equations with the quantity's letter give it the same value everywhere in the domain. */
export function sameQuantity(her: OptEquation, other: OptEquation, points: readonly Point[]): boolean {
  const f = solvedFor(her, her.key, points)
  const g = solvedFor(other, other.key, points)
  if (typeof f !== 'function' || typeof g !== 'function') return false
  return sameValues(f, g, points)
}
