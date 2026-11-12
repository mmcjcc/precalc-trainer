/**
 * Unit 9 solved again from what she reads. Each prompt is parsed here, and the answer is decided with plain
 * arithmetic from the given numbers. The figure has to be that same configuration: positive lengths, the
 * triangle inequality, a height that matches the drawn sides, right angles only where they are marked, and a
 * labeled length matching its segment (a stated apothem may be the nearest half, within 0.5 of the true one).
 *
 * This file imports no generator helper. `params` is not consulted.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoPoint, GeoSegment, ModuleId } from '@/shared/types'

const N = 300
const SEEDS = Array.from({ length: N }, (_, i) => i + 1)
const HEAVY = 120_000
const TOL = 1e-9
const ATOM = String.raw`(?:\d+(?:\.\d+)?(?:√\d+)?|√\d+)`
const Q = String.raw`(?:\(${ATOM}\)\/\d+|${ATOM}\/\d+|${ATOM})`
const U = String.raw`(?:cm|m|in|ft)`
const OPENERS = [
  'A patio is drawn here. ',
  'The figure shows a garden bed. ',
  'A window has this outline. ',
  'A tile is cut in this shape. ',
  'A sign has this outline. ',
]

type Ask = { what: string; alsoArea: boolean; unit: string }

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return p.answer
}

function qty(text: string): number {
  const t = text.trim().replace(/\s/g, '').replace(/−/g, '-')
  let m = /^\((\d+)√(\d+)\)\/(\d+)$/.exec(t)
  if (m) return (Number(m[1]) * Math.sqrt(Number(m[2]))) / Number(m[3])
  m = /^(\d+)√(\d+)\/(\d+)$/.exec(t)
  if (m) return (Number(m[1]) * Math.sqrt(Number(m[2]))) / Number(m[3])
  m = /^√(\d+)\/(\d+)$/.exec(t)
  if (m) return Math.sqrt(Number(m[1])) / Number(m[2])
  m = /^(\d+)√(\d+)$/.exec(t)
  if (m) return Number(m[1]) * Math.sqrt(Number(m[2]))
  m = /^√(\d+)$/.exec(t)
  if (m) return Math.sqrt(Number(m[1]))
  m = /^(\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[1]) / Number(m[2])
  m = /^(\d+(?:\.\d+)?)$/.exec(t)
  if (m) return Number(m[1])
  throw new Error(`unreadable quantity “${text}”`)
}

function near(got: number, want: number, tol: number, what: string) {
  if (!(Math.abs(got - want) <= tol)) throw new Error(`${what}: got ${got}, want ${want}`)
}

function pt(a: GeometryAnswer, id: string): GeoPoint {
  const p = a.figure.points.find((q) => q.id === id)
  if (!p) throw new Error(`no point ${id}`)
  return p
}

function dist(p: GeoPoint, q: GeoPoint): number {
  return Math.hypot(p.x - q.x, p.y - q.y)
}

function segLen(a: GeometryAnswer, s: GeoSegment): number {
  return dist(pt(a, s.from), pt(a, s.to))
}

function ang(a: GeometryAnswer, v: string, f: string, t: string): number {
  const V = pt(a, v)
  const F = pt(a, f)
  const T = pt(a, t)
  const ux = F.x - V.x
  const uy = F.y - V.y
  const wx = T.x - V.x
  const wy = T.y - V.y
  const c = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

function strip(prompt: string): string {
  for (const opener of OPENERS) if (prompt.startsWith(opener)) return prompt.slice(opener.length)
  return prompt
}

function parseAsk(written: string): Ask {
  // The ask spells inches out ("in inches", "in square inches"), because "in in" reads as a typo.
  const ask = written.replace(/ in square inches/g, ' in in²').replace(/ in inches/g, ' in in')
  const both =new RegExp(String.raw`^Find the (height|hypotenuse|apothem|leg) in (${U}) and the area in \2²\.$`).exec(ask)
  if (both) return { what: both[1]!, alsoArea: true, unit: both[2]! }
  const one = new RegExp(String.raw`^Find the (area|perimeter|base|height|diagonal) in (${U})(²)?\.$`).exec(ask)
  if (!one) throw new Error(`unreadable ask “${ask}”`)
  if (one[1] === 'area' && one[3] !== '²') throw new Error('area is not in square units')
  if (one[1] !== 'area' && one[3]) throw new Error('a length was asked in square units')
  return { what: one[1]!, alsoArea: false, unit: one[2]! }
}

function field(facts: string, name: string): number | null {
  const m = new RegExp(String.raw`${name} (${Q}) ${U}`).exec(facts)
  return m ? qty(m[1]!) : null
}

function pair(facts: string, name: string): [number, number] | null {
  const m = new RegExp(String.raw`${name} (${Q}) ${U} and (?:a )?(${Q}) ${U}`).exec(facts)
  return m ? [qty(m[1]!), qty(m[2]!)] : null
}

interface Job {
  values: number[]
  /** Degrees the polygon itself must show, when the prompt states an angle. */
  angle?: number
  shape: string
  /** Parallel pairs expected among opposite hull edges. */
  parallel?: number
  rightCorners?: boolean
  equalSides?: boolean
  kite?: boolean
  n?: number
  /** Stated apothem, checked against the drawn one within 0.5. */
  statedAp?: number
  side?: number
  base?: number
  legs?: number
  diagonals?: [number, number]
}

function jobOf(name: string, facts: string, givenArea: number | null, ask: Ask): Job {
  const angle = /one angle of (30|45) degrees/.exec(facts)
  const deg = angle ? Number(angle[1]) : undefined
  const values = (...xs: number[]) => {
    if (xs.some((n) => !Number.isFinite(n) || n <= 0)) throw new Error(`non-positive result from “${facts}”`)
    return xs
  }
  if (name === 'rectangle') {
    const b = field(facts, 'a base of')
    const h = field(facts, 'a height of')
    if (ask.what === 'area' && b !== null && h !== null) return { values: values(b * h), shape: 'rectangle', parallel: 2, rightCorners: true }
    if (givenArea === null || (b === null && h === null)) throw new Error('rectangle')
    if (ask.what === 'base' && h !== null) return { values: values(givenArea / h), shape: 'rectangle', parallel: 2, rightCorners: true }
    if (ask.what === 'height' && b !== null) return { values: values(givenArea / b), shape: 'rectangle', parallel: 2, rightCorners: true }
  }
  if (name === 'parallelogram' && deg) {
    const b = field(facts, 'a base of')
    const s = field(facts, 'a slanted side of')
    if (b === null || s === null) throw new Error('angled parallelogram')
    const height = deg === 30 ? s / 2 : (s * Math.sqrt(2)) / 2
    return { values: values(height, b * height), shape: 'parallelogram', parallel: 2, angle: deg }
  }
  if (name === 'parallelogram') {
    const b = field(facts, 'a base of')
    const h = field(facts, 'a height of')
    const s = field(facts, 'a slanted side of')
    if (ask.what === 'area' && b !== null && h !== null) return { values: values(b * h), shape: 'parallelogram', parallel: 2 }
    if (givenArea === null) throw new Error('parallelogram area missing')
    if (ask.what === 'height' && b !== null) return { values: values(givenArea / b), shape: 'parallelogram', parallel: 2 }
    if (ask.what === 'base' && h !== null) return { values: values(givenArea / h), shape: 'parallelogram', parallel: 2 }
    void s
  }
  if (name === 'triangle') {
    const b = field(facts, 'a base of')
    const h = field(facts, 'a height of')
    if (ask.what === 'area' && b !== null && h !== null) return { values: values((b * h) / 2), shape: 'triangle' }
    if (givenArea === null) throw new Error('triangle area missing')
    if (ask.what === 'height' && b !== null) return { values: values((2 * givenArea) / b), shape: 'triangle' }
    if (ask.what === 'base' && h !== null) return { values: values((2 * givenArea) / h), shape: 'triangle' }
  }
  if (name === 'trapezoid') {
    const bases = pair(facts, 'bases of')
    const h = field(facts, 'a height of')
    if (!bases) throw new Error('trapezoid bases')
    if (ask.what === 'area' && h !== null) return { values: values((h * (bases[0] + bases[1])) / 2), shape: 'trapezoid', parallel: 1 }
    if (givenArea === null) throw new Error('trapezoid area missing')
    return { values: values((2 * givenArea) / (bases[0] + bases[1])), shape: 'trapezoid', parallel: 1 }
  }
  if (name === 'rhombus' || name === 'kite') {
    const both = pair(facts, 'diagonals of')
    if (both && ask.what === 'area') return { values: values((both[0] * both[1]) / 2), shape: name, kite: true, diagonals: both }
    const one = field(facts, 'a diagonal of')
    if (one === null || givenArea === null) throw new Error(name)
    const other = (2 * givenArea) / one
    return { values: values(other), shape: name, kite: true, diagonals: [one, other] }
  }
  if (name === 'isosceles triangle') {
    const legs = field(facts, 'legs of')
    const base = field(facts, 'a base of')
    if (legs === null || base === null) throw new Error('isosceles triangle')
    const height = Math.sqrt(legs * legs - (base / 2) * (base / 2))
    return { values: values(height, (base * height) / 2), shape: 'iso', base, legs }
  }
  if (name === 'right triangle' && deg === 30) {
    const a = field(facts, 'a shorter leg of')
    if (a === null) throw new Error('30-60-90')
    const height = a * Math.sqrt(3)
    return { values: values(height, (a * height) / 2), shape: 'right', angle: 30 }
  }
  if (name === 'right triangle' && deg === 45) {
    const h = field(facts, 'a hypotenuse of')
    if (h === null) throw new Error('45-45-90')
    const leg = (h * Math.sqrt(2)) / 2
    return { values: values(leg, (leg * leg) / 2), shape: 'right', angle: 45, equalSides: false }
  }
  if (name === 'right triangle' && ask.what === 'hypotenuse') {
    const legs = pair(facts, 'legs of')
    if (!legs) throw new Error('right hypotenuse')
    return { values: values(Math.sqrt(legs[0] * legs[0] + legs[1] * legs[1]), (legs[0] * legs[1]) / 2), shape: 'right' }
  }
  if (name === 'right triangle' && ask.what === 'leg') {
    const leg = field(facts, 'a leg of')
    const hyp = field(facts, 'a hypotenuse of')
    if (leg === null || hyp === null) throw new Error('right leg')
    const other = Math.sqrt(hyp * hyp - leg * leg)
    return { values: values(other, (leg * other) / 2), shape: 'right' }
  }
  if (name === 'equilateral triangle' && ask.what === 'height') {
    const s = field(facts, 'a side of')
    if (s === null) throw new Error('equilateral height')
    const height = (s * Math.sqrt(3)) / 2
    return { values: values(height, (s * s * Math.sqrt(3)) / 4), shape: 'equilateral', side: s }
  }
  if (name === 'isosceles trapezoid') {
    const bases = pair(facts, 'bases of')
    const leg = field(facts, 'a leg of')
    if (!bases || leg === null) throw new Error('isosceles trapezoid')
    const m = Math.abs(bases[1] - bases[0]) / 2
    const height = Math.sqrt(leg * leg - m * m)
    return { values: values(height, (height * (bases[0] + bases[1])) / 2), shape: 'trapezoid', parallel: 1 }
  }
  if (name === 'square' && ask.what === 'apothem') {
    const s = field(facts, 'a side of')
    const r = field(facts, 'a radius of')
    if (s !== null) return { values: values(s / 2, s * s), shape: 'regular', n: 4, side: s }
    if (r !== null) {
      const ap = (r * Math.sqrt(2)) / 2
      return { values: values(ap, 2 * r * r), shape: 'regular', n: 4, side: r * Math.sqrt(2) }
    }
  }
  if (name === 'equilateral triangle' && ask.what === 'apothem') {
    const s = field(facts, 'a side of')
    const r = field(facts, 'a radius of')
    if (s !== null) return { values: values((s * Math.sqrt(3)) / 6, (s * s * Math.sqrt(3)) / 4), shape: 'regular', n: 3, side: s }
    if (r !== null) return { values: values(r / 2, (3 * r * r * Math.sqrt(3)) / 4), shape: 'regular', n: 3, side: r * Math.sqrt(3) }
  }
  if (name === 'regular hexagon' && ask.what === 'apothem') {
    const s = field(facts, 'a side of') ?? field(facts, 'a radius of')
    if (s === null) throw new Error('hexagon')
    const ap = (s * Math.sqrt(3)) / 2
    return { values: values(ap, (ap * 6 * s) / 2), shape: 'regular', n: 6, side: s }
  }
  const regular = /^regular (pentagon|hexagon|octagon|decagon|dodecagon)$/.exec(name)
  if (regular) {
    const sides: Record<string, number> = { pentagon: 5, hexagon: 6, octagon: 8, decagon: 10, dodecagon: 12 }
    const n = sides[regular[1]!]!
    const ap = field(facts, 'an apothem of')
    const side = field(facts, 'a side of')
    if (ap === null || side === null) throw new Error(name)
    if (ask.what === 'perimeter') return { values: values(n * side), shape: 'regular', n, statedAp: ap, side }
    return { values: values((ap * n * side) / 2), shape: 'regular', n, statedAp: ap, side }
  }
  throw new Error(`no reading of “${name}” / “${facts}” / ${ask.what}`)
}

function hull(a: GeometryAnswer): GeoPoint[] {
  const regular = a.figure.points.filter((p) => /^P\d+$/.test(p.id))
  if (regular.length >= 3) return regular.sort((p, q) => Number(p.id.slice(1)) - Number(q.id.slice(1)))
  const letters = a.figure.points.filter((p) => /^[A-D]$/.test(p.id))
  const c = centroid(letters)
  return [...letters].sort((p, q) => Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(q.y - c.y, q.x - c.x))
}

function centroid(pts: readonly GeoPoint[]): GeoPoint {
  return {
    id: '',
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}

function interior(pts: GeoPoint[], i: number): number {
  const n = pts.length
  const v = pts[i]!
  const prev = pts[(i + n - 1) % n]!
  const next = pts[(i + 1) % n]!
  const ux = prev.x - v.x
  const uy = prev.y - v.y
  const wx = next.x - v.x
  const wy = next.y - v.y
  const c = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

function oppositeParallel(pts: GeoPoint[]): number {
  const n = pts.length
  let count = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 2) % n
    if (j <= i) continue
    const a = pts[i]!
    const b = pts[(i + 1) % n]!
    const c = pts[j]!
    const d = pts[(j + 1) % n]!
    const ux = b.x - a.x
    const uy = b.y - a.y
    const vx = d.x - c.x
    const vy = d.y - c.y
    const cross = Math.abs(ux * vy - uy * vx)
    if (cross <= 1e-6 * Math.hypot(ux, uy) * Math.hypot(vx, vy)) count += 1
  }
  return count
}

function onSegment(p: GeoPoint, a: GeoPoint, b: GeoPoint): boolean {
  const ab = dist(a, b)
  return Math.abs(dist(a, p) + dist(p, b) - ab) <= 1e-6 && dist(a, p) > 1e-6 && dist(p, b) > 1e-6
}

function requireFigure(a: GeometryAnswer, job: Job) {
  const pts = hull(a)
  if (pts.length < 3) throw new Error('fewer than 3 corners')
  let sign = 0
  for (let i = 0; i < pts.length; i++) {
    const a0 = pts[i]!
    const b0 = pts[(i + 1) % pts.length]!
    const c0 = pts[(i + 2) % pts.length]!
    const cross = (b0.x - a0.x) * (c0.y - b0.y) - (b0.y - a0.y) * (c0.x - b0.x)
    if (Math.abs(cross) < 1e-8) throw new Error('a flat corner')
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) throw new Error('the outline is not convex')
    if (dist(a0, b0) < 2) throw new Error(`a side shorter than 2 (${dist(a0, b0)})`)
  }
  if (pts.length === 3) {
    const ab = dist(pts[0]!, pts[1]!)
    const bc = dist(pts[1]!, pts[2]!)
    const ca = dist(pts[2]!, pts[0]!)
    if (ab + bc <= ca + TOL || bc + ca <= ab + TOL || ca + ab <= bc + TOL) throw new Error('triangle inequality')
  }
  for (const mark of a.figure.angles ?? []) {
    if (!mark.right) throw new Error(`angle at ${mark.vertex} is marked but not as a right angle`)
    near(ang(a, mark.vertex, mark.from, mark.to), 90, 1e-4, `right angle at ${mark.vertex}`)
  }
  if (job.rightCorners || job.shape === 'triangle' || job.shape === 'right') {
    if (!(a.figure.angles ?? []).some((mark) => mark.right)) throw new Error('the right angle is not marked')
  }
  if (job.rightCorners) {
    for (let i = 0; i < pts.length; i++) near(interior(pts, i), 90, 1e-4, `rectangle corner ${i}`)
  }
  if (job.parallel !== undefined && pts.length === 4) {
    const got = oppositeParallel(pts)
    if (got !== job.parallel) throw new Error(`${got} pairs of opposite sides are parallel, want ${job.parallel}`)
  }
  if (job.angle) {
    const angles = pts.map((_, i) => interior(pts, i))
    if (!angles.some((g) => Math.abs(g - job.angle!) < 0.05)) throw new Error(`no interior angle of ${job.angle} (got ${angles.map((g) => g.toFixed(2)).join(', ')})`)
  }
  if (job.equalSides || job.shape === 'equilateral') {
    const lengths = pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]!))
    for (const len of lengths) near(len, lengths[0]!, TOL, 'equal sides')
    if (job.side !== undefined) near(lengths[0]!, job.side, TOL, 'equilateral side')
  }
  if (job.shape === 'iso' && job.base !== undefined && job.legs !== undefined) {
    const dashed = (a.figure.segments ?? []).find((s) => s.dashed)
    if (!dashed) throw new Error('the height is not dashed')
    const foot = [pt(a, dashed.from), pt(a, dashed.to)].find((p) =>
      (a.figure.segments ?? []).some((s) => !s.dashed && s !== dashed && onSegment(p, pt(a, s.from), pt(a, s.to))),
    )
    if (!foot) throw new Error('the height does not meet a side')
    const base = (a.figure.segments ?? []).find((s) => !s.dashed && onSegment(foot, pt(a, s.from), pt(a, s.to)))
    if (!base) throw new Error('no base under the height')
    near(segLen(a, base), job.base, TOL, 'unlabeled base')
    const legs = (a.figure.segments ?? []).filter((s) => !s.dashed && s !== base && pts.some((p) => p.id === s.from) && pts.some((p) => p.id === s.to))
    if (legs.length < 2) throw new Error('the two legs are not drawn')
    for (const leg of legs.slice(0, 2)) near(segLen(a, leg), job.legs, TOL, 'leg')
  }
  if (job.kite && job.diagonals) {
    const ac = (a.figure.segments ?? []).find((s) => (s.from === 'A' && s.to === 'C') || (s.from === 'C' && s.to === 'A'))
    const bd = (a.figure.segments ?? []).find((s) => (s.from === 'B' && s.to === 'D') || (s.from === 'D' && s.to === 'B'))
    if (!ac || !bd) throw new Error('the diagonals are not drawn')
    const ux = pt(a, ac.to).x - pt(a, ac.from).x
    const uy = pt(a, ac.to).y - pt(a, ac.from).y
    const vx = pt(a, bd.to).x - pt(a, bd.from).x
    const vy = pt(a, bd.to).y - pt(a, bd.from).y
    const cos = Math.abs(ux * vx + uy * vy) / (Math.hypot(ux, uy) * Math.hypot(vx, vy))
    if (cos > 1e-6) throw new Error('the diagonals are not perpendicular')
    const drawn = [segLen(a, ac), segLen(a, bd)].sort((p, q) => p - q)
    const want = [...job.diagonals].sort((p, q) => p - q)
    near(drawn[0]!, want[0]!, TOL, 'shorter diagonal')
    near(drawn[1]!, want[1]!, TOL, 'longer diagonal')
  }
  if (job.shape === 'regular' && job.n) {
    if (pts.length !== job.n) throw new Error(`${pts.length} vertices, want ${job.n}`)
    const c = centroid(pts)
    const radii = pts.map((p) => dist(p, c))
    for (const r of radii) near(r, radii[0]!, 1e-6, 'distance from the center')
    const sides = pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]!))
    for (const s of sides) near(s, sides[0]!, 1e-6, 'regular side')
    if (job.side !== undefined) near(sides[0]!, job.side, TOL, 'stated side')
    if (job.statedAp !== undefined) {
      const trueAp = sides[0]! / (2 * Math.tan(Math.PI / job.n))
      if (Math.abs(job.statedAp - trueAp) > 0.5 + 1e-6) throw new Error(`stated apothem ${job.statedAp} is ${Math.abs(job.statedAp - trueAp)} from the true one`)
    }
  }
  const first = job.values[0]!
  for (const seg of a.figure.segments ?? []) {
    if (!seg.label) continue
    const len = segLen(a, seg)
    const text = seg.label.trim()
    if (text === '?') {
      near(len, first, TOL, `“?” on ${seg.from}${seg.to}`)
      continue
    }
    const labeled = qty(text)
    if (Math.abs(len - labeled) <= TOL) continue
    const dashedAp = seg.dashed && Math.abs(len - labeled) <= 0.5 + 1e-6 && meetsMidpoint(a, seg)
    if (!dashedAp) throw new Error(`label ${seg.label} on ${seg.from}${seg.to} has length ${len}`)
  }
  for (const seg of a.figure.segments ?? []) {
    if (!seg.dashed) continue
    if (!meetsMidpoint(a, seg) && !meetsSide(a, seg)) throw new Error(`dashed ${seg.from}${seg.to} does not meet a side`)
    if (!perpendicularToHost(a, seg)) throw new Error(`dashed ${seg.from}${seg.to} is not perpendicular to the side it meets`)
  }
  const given = [...a.prompt.matchAll(new RegExp(Q, 'g'))].map((m) => qty(m[0]))
  for (const value of job.values) {
    if (given.some((g) => Math.abs(g - value) <= 1e-6)) throw new Error(`the answer ${value} is a number the problem gives`)
  }
}

function hostSide(a: GeometryAnswer, seg: GeoSegment): GeoSegment | null {
  for (const end of [seg.from, seg.to]) {
    const p = pt(a, end)
    for (const other of a.figure.segments ?? []) {
      if (other === seg || other.dashed) continue
      if (onSegment(p, pt(a, other.from), pt(a, other.to))) return other
    }
  }
  return null
}

function meetsSide(a: GeometryAnswer, seg: GeoSegment): boolean {
  return hostSide(a, seg) !== null
}

function meetsMidpoint(a: GeometryAnswer, seg: GeoSegment): boolean {
  const host = hostSide(a, seg)
  if (!host) return false
  const mid = { id: '', x: (pt(a, host.from).x + pt(a, host.to).x) / 2, y: (pt(a, host.from).y + pt(a, host.to).y) / 2 }
  const end = [pt(a, seg.from), pt(a, seg.to)].find((p) => onSegment(p, pt(a, host.from), pt(a, host.to)))
  return !!end && dist(end, mid) <= 1e-6
}

function perpendicularToHost(a: GeometryAnswer, seg: GeoSegment): boolean {
  const host = hostSide(a, seg)
  if (!host) return false
  const ux = pt(a, host.to).x - pt(a, host.from).x
  const uy = pt(a, host.to).y - pt(a, host.from).y
  const vx = pt(a, seg.to).x - pt(a, seg.from).x
  const vy = pt(a, seg.to).y - pt(a, seg.from).y
  return Math.abs(ux * vx + uy * vy) <= 1e-6 * Math.hypot(ux, uy) * Math.hypot(vx, vy)
}

function solve(a: GeometryAnswer) {
  if (/\[object|undefined/.test(`${a.prompt}\n${a.figure.ariaLabel}`)) throw new Error('broken text')
  const body = strip(a.prompt)
  const lead = new RegExp(String.raw`^The area of the (.+?) is (${Q}) (${U})², and it has (.+)\. (Find the .+)$`).exec(body)
  const plain = new RegExp(String.raw`^The (.+?) has (.+)\. (Find the .+)$`).exec(body)
  if (!lead && !plain) throw new Error(`unreadable prompt: ${a.prompt}`)
  const name = (lead ?? plain)![1]!
  const facts = lead ? lead[4]! : plain![2]!
  const ask = parseAsk(lead ? lead[5]! : plain![3]!)
  const givenArea = lead ? qty(lead[2]!) : null
  if (lead && lead[3] !== ask.unit) throw new Error('the area unit and the asked unit disagree')
  const job = jobOf(name, facts, givenArea, ask)
  if (ask.alsoArea && job.values.length !== 2) throw new Error(`expected two answers, computed ${job.values.length}`)
  if (!ask.alsoArea && job.values.length !== 1) throw new Error(`expected one answer, computed ${job.values.length}`)
  if (a.stages.length !== job.values.length) throw new Error(`${a.stages.length} parts, computed ${job.values.length}`)
  for (let i = 0; i < job.values.length; i++) {
    near(qty(a.stages[i]!.answerText), job.values[i]!, 1e-6, a.stages[i]!.label)
  }
  requireFigure(a, job)
}

const TEMPLATES: readonly [ModuleId, string][] = [
  ['geoPolygonArea', 'ar.basic'],
  ['geoPolygonArea', 'ar.special'],
  ['geoPolygonArea', 'ar.regular'],
]

describe('unit 9 solved again from the wording', () => {
  describe.each(TEMPLATES)('%s / %s', (module, template) => {
    it(
      'decides every answer from the given numbers and requires a real configuration',
      () => {
        const bad: string[] = []
        for (const seed of SEEDS) {
          const a = answerOf(module, template, seed)
          try {
            solve(a)
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            bad.push(`${template}/${seed}: ${msg}\n${a.prompt}`)
            if (bad.length >= 6) break
          }
        }
        expect(bad.join('\n---\n')).toBe('')
      },
      HEAVY,
    )
  })
})
