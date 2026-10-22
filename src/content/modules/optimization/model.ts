/**
 * The mathematics of one optimization problem, exactly: the condition a·x + b·y = c, the objective (k·xy, or
 * x² + y²), the final equation in x or in y, its vertex, the other variable, and the extreme value; and what each
 * named slip turns them into (another condition, another objective, another final equation, another number). The
 * templates choose the numbers and the words; nothing here depends on the story.
 */
import { evalQuadratic, q, qAdd, qDiv, qEq, qMul, qNeg, qSub, vertexOf, type Q, type Quadratic } from '@/engine/optim'
import { linText, quadStandard, quadText, sumOf, times } from './text'

/** a·x + b·y = c. */
export interface Line {
  a: Q
  b: Q
  c: Q
}

/** What is made largest or smallest: k pens' area (or a price times a count, or a product), or x² + y². */
export type Objective = { kind: 'product'; k: Q } | { kind: 'squares' }

export type Route = 'x' | 'y'

export interface OptModel {
  line: Line
  objective: Objective
  /** 'A', 'P', 'R' or 'S'. */
  quantity: string
}

export const other = (r: Route): Route => (r === 'x' ? 'y' : 'x')

/** The coefficient of a letter in the condition. */
export function coef(line: Line, v: Route): Q {
  return v === 'x' ? line.a : line.b
}

/** The condition solved for `v`'s partner: route x gives y = (c − a·x)/b. */
export function partnerAt(line: Line, route: Route, t: Q): Q {
  const own = coef(line, route)
  const theirs = coef(line, other(route))
  return qDiv(qSub(line.c, qMul(own, t)), theirs)
}

/** The final equation's quadratic in the route's letter. */
export function finalQuadratic(model: OptModel, route: Route): Quadratic {
  const { line, objective } = model
  const own = coef(line, route)
  const theirs = coef(line, other(route))
  if (objective.kind === 'product') {
    // q = k·t·(c − own·t)/theirs
    const f = qDiv(objective.k, theirs)
    return { a: qNeg(qMul(f, own)), b: qMul(f, line.c), c: q(0) }
  }
  // q = t² + ((c − own·t)/theirs)²
  const t2 = qMul(theirs, theirs)
  return { a: qAdd(q(1), qDiv(qMul(own, own), t2)), b: qNeg(qDiv(qMul(q(2), qMul(own, line.c)), t2)), c: qDiv(qMul(line.c, line.c), t2) }
}

/** The solution: where the extreme is in each letter, and its value. */
export interface Solution {
  x: Q
  y: Q
  value: Q
  opens: 'up' | 'down'
}

export function solve(model: OptModel): Solution {
  const vx = vertexOf(finalQuadratic(model, 'x'))
  const vy = vertexOf(finalQuadratic(model, 'y'))
  const y = partnerAt(model.line, 'x', vx.t)
  if (!qEq(y, vy.t) || !qEq(vx.value, vy.value)) throw new Error('the two routes disagree')
  return { x: vx.t, y, value: vx.value, opens: vx.opens }
}

/** Where a fence problem's sides live: each one from nothing to all the fence it could take. */
export function fenceDomain(line: Line): { x: [number, number]; y: [number, number] } {
  const top = (v: Q) => (line.c.n / line.c.d) / (v.n / v.d)
  return { x: [0, top(line.a)], y: [0, top(line.b)] }
}

/** The objective's value at a point (for the re-checks). */
export function objectiveAt(model: OptModel, x: Q, y: Q): Q {
  const o = model.objective
  return o.kind === 'product' ? qMul(o.k, qMul(x, y)) : qAdd(qMul(x, x), qMul(y, y))
}

// ---------------------------------------------------------------------------
// Equations as text
// ---------------------------------------------------------------------------

export interface MathText {
  /** App syntax, as she would type it. */
  text: string
  /** KaTeX. */
  tex: string
}

const Q1 = q(1)

/** "2x + y = 500". */
export function lineEquation(line: Line): MathText {
  const l = linText(line.a, line.b)
  const c = sumOf([{ c: line.c, v: '', p: 0 }])
  return { text: `${l.text} = ${c.text}`, tex: `${l.tex} = ${c.tex}` }
}

/** The condition solved for the route's partner: "500 - 2x", "(400 - 4x)/6". */
export function partnerExpr(line: Line, route: Route): MathText {
  const own = coef(line, route)
  const theirs = coef(line, other(route))
  const top = sumOf([
    { c: line.c, v: '', p: 0 },
    { c: qNeg(own), v: route, p: 1 },
  ])
  if (qEq(theirs, Q1)) return top
  if (qEq(theirs, qNeg(Q1))) {
    const flipped = sumOf([
      { c: own, v: route, p: 1 },
      { c: qNeg(line.c), v: '', p: 0 },
    ])
    return flipped
  }
  return { text: `(${top.text})/${theirs.n < 0 ? `(${theirs.n})` : theirs.n}`, tex: `\\frac{${top.tex}}{${theirs.n}}` }
}

/** The objective's right side: "xy", "3xy", "x^2 + y^2". */
export function objectiveExpr(o: Objective): MathText {
  if (o.kind === 'squares') return { text: 'x^2 + y^2', tex: 'x^{2} + y^{2}' }
  const k = o.k
  if (qEq(k, Q1)) return { text: 'xy', tex: 'xy' }
  return { text: `${k.d === 1 ? k.n : `(${k.n}/${k.d})`}xy`, tex: `${k.d === 1 ? k.n : `\\frac{${k.n}}{${k.d}}`}xy` }
}

/** "A = 3xy". */
export function primaryEquation(model: OptModel, o: Objective = model.objective): MathText {
  const e = objectiveExpr(o)
  return { text: `${model.quantity} = ${e.text}`, tex: `${model.quantity} = ${e.tex}` }
}

/** "A = 500x - 2x^2" from a quadratic. */
export function finalEquation(quantity: string, p: Quadratic, route: Route): MathText {
  const e = quadText(p, route)
  return { text: `${quantity} = ${e.text}`, tex: `${quantity} = ${e.tex}` }
}

/** The final equation with the partner put in, before multiplying out: "A = 3x((400 - 4x)/6)", "S = x^2 + (40 - x)^2". */
export function substituted(model: OptModel, route: Route, partner: MathText = partnerExpr(model.line, route)): MathText {
  const Qn = model.quantity
  const o = model.objective
  if (o.kind === 'squares') {
    return { text: `${Qn} = ${route}^2 + (${partner.text})^2`, tex: `${Qn} = ${route}^{2} + \\left(${partner.tex}\\right)^{2}` }
  }
  const k = o.k
  const kText = qEq(k, Q1) ? '' : k.d === 1 ? String(k.n) : `(${k.n}/${k.d})`
  const kTex = qEq(k, Q1) ? '' : k.d === 1 ? String(k.n) : `\\frac{${k.n}}{${k.d}}`
  return { text: `${Qn} = ${kText}${route}(${partner.text})`, tex: `${Qn} = ${kTex}${route}\\left(${partner.tex}\\right)` }
}

/** Every typed spelling of the final equation the leak checks look for: multiplied out both ways, and substituted. */
export function finalForms(model: OptModel, route: Route, partner?: MathText): string[] {
  const p = finalQuadratic(model, route)
  const Qn = model.quantity
  const sub = substituted(model, route, partner)
  return [...new Set([`${Qn} = ${quadText(p, route).text}`, `${Qn} = ${quadStandard(p, route).text}`, sub.text])]
}

// ---------------------------------------------------------------------------
// Slips
// ---------------------------------------------------------------------------

/** A final equation with one term lost: each kind of term the right one has. */
export function droppedTerms(p: Quadratic): { which: 'square' | 'linear' | 'constant'; p: Quadratic }[] {
  const out: { which: 'square' | 'linear' | 'constant'; p: Quadratic }[] = []
  if (p.b.n !== 0) out.push({ which: 'linear', p: { a: p.a, b: q(0), c: p.c } })
  if (p.a.n !== 0 && p.b.n !== 0) out.push({ which: 'square', p: { a: q(0), b: p.b, c: p.c } })
  if (p.c.n !== 0) out.push({ which: 'constant', p: { a: p.a, b: p.b, c: q(0) } })
  return out
}

/** The negative of a quadratic: a sign lost while solving the condition (the parabola opens the other way). */
export function negated(p: Quadratic): Quadratic {
  return { a: qNeg(p.a), b: qNeg(p.b), c: qNeg(p.c) }
}

/**
 * Solving the condition for the partner with not every term divided by its coefficient d (d not ±1): only the
 * number divided, only the letter's term divided, or nothing divided. Returns the partner as a·t + b in each case.
 */
export function partialDivisions(line: Line, route: Route): { how: 'number' | 'term' | 'none'; slope: Q; intercept: Q }[] {
  const own = coef(line, route)
  const d = coef(line, other(route))
  if (qEq(d, Q1) || qEq(d, qNeg(Q1))) return []
  return [
    { how: 'number', slope: qNeg(own), intercept: qDiv(line.c, d) },
    { how: 'term', slope: qNeg(qDiv(own, d)), intercept: line.c },
    { how: 'none', slope: qNeg(own), intercept: line.c },
  ]
}

/** The final quadratic when the partner is slope·t + intercept (product objective with factor k, or squares). */
export function finalWithPartner(o: Objective, slope: Q, intercept: Q): Quadratic {
  if (o.kind === 'product') return { a: qMul(o.k, slope), b: qMul(o.k, intercept), c: q(0) }
  // t² + (slope·t + intercept)²
  return { a: qAdd(q(1), qMul(slope, slope)), b: qMul(q(2), qMul(slope, intercept)), c: qMul(intercept, intercept) }
}

/** Squaring the partner wrongly (squares objective): (u + v·t)² as u² + v²t² (middle lost) or u² − v²t². */
export function binomialSlips(line: Line, route: Route): Quadratic[] {
  const own = coef(line, route)
  const d = coef(line, other(route))
  const slope = qNeg(qDiv(own, d))
  const intercept = qDiv(line.c, d)
  const s2 = qMul(slope, slope)
  const i2 = qMul(intercept, intercept)
  return [
    { a: qAdd(q(1), s2), b: q(0), c: i2 },
    { a: qSub(q(1), s2), b: q(0), c: i2 },
  ]
}

/** The quadratic's value at t (re-exported for the builders). */
export { evalQuadratic }

/** The partner's value from another condition at the route's t (a slip carried into part 5); null where it has none. */
export function partnerFrom(line: Line, route: Route, t: Q): Q | null {
  const theirs = coef(line, other(route))
  if (theirs.n === 0) return null
  return partnerAt(line, route, t)
}

/** k·(e): the objective's factor in front of an expression (re-exported helper). */
export { times }
