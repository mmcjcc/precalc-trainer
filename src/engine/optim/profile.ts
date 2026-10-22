/**
 * An equation's profile at the problem's points, worked out once and compared many times: whether the quantity's
 * letter is in it, its value solved for that letter at each point (and at a few points moved in x and in y, which
 * says which letters it depends on), or, without the quantity, its linear form a·x + b·y + c (or, for a curve, y
 * solved at each point). Two equations are the same when their profiles agree; the problem's own equations (the
 * right one and every slip's) are profiled once per problem, so checking her line against twenty slips costs twenty
 * array comparisons instead of twenty sets of evaluations.
 */
import { domainPoints, linearForm, sameLinear, solvedAt, usesLetter, type LinearForm, type Point } from './equiv'
import { residual, type OptEquation } from './read'
import type { OptDomain, OptVar } from './types'

export interface EquationProfile {
  hasQuantity: boolean
  /** Solved for the quantity at each point; null where it is undefined or cannot be solved there. */
  values: (number | null)[] | null
  /** The letters the solved quantity depends on: one of them (a final equation), both, or neither. */
  route: OptVar | 'both' | 'none' | null
  /** a·x + b·y + c = 0, when it has no quantity and is linear in x and y. */
  linear: LinearForm | null
  /** A curve without the quantity (xy = 500): one letter solved at each point. */
  curve: { letter: 'x' | 'y'; values: (number | null)[] } | null
}

/** Nine points spread over the domain: more than a quadratic in two letters needs to be pinned down. */
export function profilePoints(domain: OptDomain): Point[] {
  return domainPoints(domain, 9)
}

const near = (a: number, b: number) => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a), Math.abs(b))
const nearTight = (a: number, b: number) => Math.abs(a - b) <= 1e-10 * Math.max(1, Math.abs(a), Math.abs(b))

/**
 * The letter solved at each point from two evaluations (the equation is α·letter + β there), with the linearity in
 * that letter checked by a third at the first few points; null everywhere when it is not linear in it.
 */
function solvedAll(eq: OptEquation, letter: string, pts: readonly Point[]): (number | null)[] {
  const out: (number | null)[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    const scope = { x: p.x, y: p.y, [eq.key]: 1.7 }
    if (i < 3) {
      out.push(solvedAt(eq, letter, scope))
      continue
    }
    const r0 = residual(eq, { ...scope, [letter]: 0 })
    const r1 = residual(eq, { ...scope, [letter]: 1 })
    if (r0 === 'undef' || r1 === 'undef') {
      out.push(null)
      continue
    }
    const alpha = r1 - r0
    out.push(Math.abs(alpha) <= 1e-12 * Math.max(1, Math.abs(r0), Math.abs(r1)) ? null : -r0 / alpha)
  }
  // Not linear in the letter at the checked points: nothing can be solved.
  if (out.slice(0, 3).every((v) => v === null) && pts.length > 3) return out.map(() => null)
  return out
}

const moved = (pts: readonly Point[], v: 'x' | 'y') => pts.map((p) => (v === 'x' ? { x: p.x * 1.37 + 0.71, y: p.y } : { x: p.x, y: p.y * 1.37 + 0.71 }))

function differs(a: (number | null)[], b: (number | null)[]): boolean {
  return a.some((v, i) => v !== null && b[i] !== null && b[i] !== undefined && !nearTight(v, b[i]!))
}

export function profileOf(eq: OptEquation, pts: readonly Point[]): EquationProfile {
  const hasQuantity = usesLetter(eq, eq.key, pts)
  if (hasQuantity) {
    const values = solvedAll(eq, eq.key, pts)
    const solved = values.filter((v) => v !== null).length
    if (solved < Math.ceil(pts.length / 2)) return { hasQuantity, values: null, route: null, linear: null, curve: null }
    // Which letters it depends on, from four points moved in x and four moved in y.
    const few = pts.slice(0, 4)
    const base = values.slice(0, 4)
    const dx = differs(base, solvedAll(eq, eq.key, moved(few, 'x')))
    const dy = differs(base, solvedAll(eq, eq.key, moved(few, 'y')))
    const route = dx && dy ? 'both' : dx ? 'x' : dy ? 'y' : 'none'
    return { hasQuantity, values, route, linear: null, curve: null }
  }
  // Linear or not, it is also solved for y (or x) at the points, so a line and the same line written as a curve
  // ((500 − y)/x = 2 for 2x + y = 500) still compare.
  const linear = linearForm(eq, pts)
  for (const letter of ['y', 'x'] as const) {
    const values = solvedAll(eq, letter, pts)
    if (values.filter((v) => v !== null).length >= Math.ceil(pts.length / 2)) return { hasQuantity, values: null, route: null, linear, curve: { letter, values } }
  }
  return { hasQuantity, values: null, route: null, linear, curve: null }
}

/** Value lists agree where both are defined, and both are defined at most points. */
function sameList(a: (number | null)[], b: (number | null)[]): boolean {
  let compared = 0
  for (let i = 0; i < a.length; i++) {
    const u = a[i]
    const v = b[i]
    if ((u === null || u === undefined) && (v === null || v === undefined)) continue
    if (u === null || u === undefined || v === null || v === undefined) return false
    if (!near(u, v)) return false
    compared++
  }
  return compared >= Math.ceil(a.length / 2)
}

/** Two equations say the same thing: the same quantity everywhere, the same line, or the same curve. */
export function sameProfile(a: EquationProfile, b: EquationProfile): boolean {
  if (a.hasQuantity !== b.hasQuantity) return false
  if (a.hasQuantity) return a.values !== null && b.values !== null && sameList(a.values, b.values)
  if (a.linear && b.linear) return sameLinear(a.linear, b.linear)
  if (a.curve && b.curve && a.curve.letter === b.curve.letter) return sameList(a.curve.values, b.curve.values)
  return false
}
