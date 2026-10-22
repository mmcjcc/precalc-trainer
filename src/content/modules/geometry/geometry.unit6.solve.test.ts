/**
 * Honors geometry Unit 6, solved again from the wording and the figure. Nothing here calls a Unit 6 generator's solver,
 * slip list or gate: each problem is read the way she reads it (the prompt's words and numbers, the figure's points,
 * labels, arcs, squares and arrows), solved with this file's own parser and algebra, and compared with the stored
 * answers. Every equation must have exactly one solution that makes every length positive; triangles must satisfy the
 * triangle inequality and angle sums of 180; every mark must be true of the drawing; and a which-test answer must be
 * the one test the given marks prove (or none), never two.
 *
 * GEO6_SEEDS sets the number of seeds per template (600 by default).
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoAngleMark, GeoFigureSpec, GeoPoint, ModuleId } from '@/shared/types'

const N = Number(process.env.GEO6_SEEDS ?? 600)
const HEAVY = 120_000

function problem(module: ModuleId, template: string, seed: number): { a: GeometryAnswer; params: Record<string, unknown> } {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return { a: p.answer, params: p.params }
}

// --- numbers and expressions, read independently -----------------------------------------------------------------

/** A value she might type: "5", "15/2", "-3", "12.5", "4√7", "√13". */
function valueOf(text: string): number {
  const t = text.trim().replace(/−/g, '-')
  let m = /^(-?\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[1]) / Number(m[2])
  m = /^(\d*)√(\d+)$/.exec(t)
  if (m) return (m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2]))
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  throw new Error(`cannot read the value “${text}”`)
}

/** a·x + b. */
interface L {
  a: number
  b: number
}

/** "x", "3x", "2x + 5", "x − 4", "12", "(x + 3)" as a·x + b. */
function lin(text: string): L {
  const t = text.trim().replace(/−/g, '-').replace(/^\((.*)\)$/, '$1').replace(/\s+/g, '')
  const m = /^([-+]?\d*)x([-+]\d+)?$/.exec(t)
  if (m) {
    const c = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
    return { a: c, b: m[2] ? Number(m[2]) : 0 }
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return { a: 0, b: Number(t) }
  throw new Error(`cannot read the expression “${text}”`)
}

const at = (e: L, x: number) => e.a * x + e.b

/** Polynomial coefficients [c0, c1, c2] of the product of two linear expressions. */
function mul(e: L, f: L): [number, number, number] {
  return [e.b * f.b, e.a * f.b + e.b * f.a, e.a * f.a]
}

/** Every real root of c0 + c1·x + c2·x² = 0 (an identity has no single root and fails the caller's count). */
function roots([c0, c1, c2]: [number, number, number]): number[] {
  const eps = 1e-12
  if (Math.abs(c2) < eps) {
    if (Math.abs(c1) < eps) return Math.abs(c0) < eps ? [NaN, NaN] : []
    return [-c0 / c1]
  }
  const d = c1 * c1 - 4 * c2 * c0
  if (d < -eps) return []
  if (Math.abs(d) <= eps) return [-c1 / (2 * c2)]
  const s = Math.sqrt(d)
  return [(-c1 - s) / (2 * c2), (-c1 + s) / (2 * c2)]
}

/** Solve p/q = r/s (each linear in x): the x values that make every given expression positive. */
function solveProportion(p: L, q: L, r: L, s: L, mustBePositive: L[]): number[] {
  const left = mul(p, s)
  const right = mul(r, q)
  const poly: [number, number, number] = [left[0] - right[0], left[1] - right[1], left[2] - right[2]]
  return roots(poly).filter((x) => Number.isFinite(x) && mustBePositive.every((e) => at(e, x) > 1e-9) && Math.abs(at(q, x)) > 1e-9 && Math.abs(at(s, x)) > 1e-9)
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-7 * Math.max(1, Math.abs(a), Math.abs(b))

// --- the figure, read independently -------------------------------------------------------------------------------

interface Fig {
  spec: GeoFigureSpec
  pt: (id: string) => { x: number; y: number }
  label: (a: string, b: string) => string | null
}

function figOf(spec: GeoFigureSpec): Fig {
  const byId = new Map(spec.points.map((p: GeoPoint) => [p.id, p]))
  return {
    spec,
    pt: (id) => {
      const p = byId.get(id)
      if (!p) throw new Error(`no point ${id}`)
      return { x: p.x, y: p.y }
    },
    label: (a, b) => {
      const s = (spec.segments ?? []).find((g) => (g.from === a && g.to === b) || (g.from === b && g.to === a))
      return s?.label ? s.label.trim() : null
    },
  }
}

const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y)

function angleAt(v: { x: number; y: number }, p: { x: number; y: number }, q: { x: number; y: number }): number {
  const a1 = Math.atan2(p.y - v.y, p.x - v.x)
  const a2 = Math.atan2(q.y - v.y, q.x - v.x)
  let d = Math.abs(a1 - a2)
  if (d > Math.PI) d = 2 * Math.PI - d
  return (d * 180) / Math.PI
}

function collinear(f: Fig, ids: string[]): boolean {
  const [a, b, ...rest] = ids.map(f.pt)
  return rest.every((c) => Math.abs((b!.x - a!.x) * (c.y - a!.y) - (b!.y - a!.y) * (c.x - a!.x)) < 1e-3 * dist(a!, b!) * Math.max(1, dist(a!, c)))
}

/** The length of segment ab from labels: its own label, or the labels of the pieces it is split into. */
function lengthOf(f: Fig, a: string, b: string): L | null {
  const own = f.label(a, b)
  if (own) return lin(own)
  // A piece point between a and b, both pieces labeled.
  for (const p of f.spec.points) {
    if (p.id === a || p.id === b) continue
    const x = f.label(a, p.id)
    const y = f.label(p.id, b)
    if (!x || !y) continue
    if (!collinear(f, [a, b, p.id])) continue
    const P = f.pt(p.id)
    const A = f.pt(a)
    const B = f.pt(b)
    if (Math.abs(dist(A, P) + dist(P, B) - dist(A, B)) > 1e-3 * dist(A, B)) continue
    const l1 = lin(x)
    const l2 = lin(y)
    return { a: l1.a + l2.a, b: l1.b + l2.b }
  }
  return null
}

/** One common scale for every labeled length: label value / drawn length is the same (to-scale figures). */
function oneScale(f: Fig, x: number, pairs: [string, string, L][]): boolean {
  const ratios = pairs.map(([a, b, e]) => at(e, x) / dist(f.pt(a), f.pt(b)))
  return ratios.every((r) => Math.abs(r - ratios[0]!) <= 0.004 * ratios[0]!)
}

/** Every labeled segment of the figure with its expression. */
function labeled(f: Fig): [string, string, L][] {
  return (f.spec.segments ?? []).filter((s) => s.label).map((s) => [s.from, s.to, lin(s.label!)] as [string, string, L])
}

// --- congruent angles from the given marks -----------------------------------------------------------------------

type Tri = [string, string, string]
interface AngleRef {
  vertex: string
  rays: [string, string]
}

const unit = (p: { x: number; y: number }, q: { x: number; y: number }) => {
  const d = dist(p, q) || 1
  return { x: (q.x - p.x) / d, y: (q.y - p.y) / d }
}
const sameDir = (u: { x: number; y: number }, w: { x: number; y: number }) => u.x * w.x + u.y * w.y > 0.9999

/** Is the ray from v through p the ray from v through q (same direction)? */
function sameRay(f: Fig, v: string, p: string, q: string): boolean {
  return sameDir(unit(f.pt(v), f.pt(p)), unit(f.pt(v), f.pt(q)))
}

/** The angle of triangle t at its vertex v. */
function triAngle(t: Tri, v: string): AngleRef {
  const others = t.filter((u) => u !== v) as [string, string]
  return { vertex: v, rays: others }
}

/** Does the mark's angle (vertex, from, to) name this angle of the triangle (its rays the triangle's sides at v)? */
function markIsAngle(f: Fig, mark: GeoAngleMark, ang: AngleRef): boolean {
  if (mark.vertex !== ang.vertex) return false
  const [r1, r2] = ang.rays
  if ((sameRay(f, ang.vertex, mark.from, r1) && sameRay(f, ang.vertex, mark.to, r2)) || (sameRay(f, ang.vertex, mark.from, r2) && sameRay(f, ang.vertex, mark.to, r1))) return true
  // A right-angle square marks both lines perpendicular, so every angle they make at the vertex is right.
  if (!mark.right) return false
  const sameLine = (v: string, p: string, q: string) => {
    const u = unit(f.pt(v), f.pt(p))
    const w = unit(f.pt(v), f.pt(q))
    return Math.abs(u.x * w.x + u.y * w.y) > 0.9999
  }
  const v = ang.vertex
  return (sameLine(v, mark.from, r1) && sameLine(v, mark.to, r2)) || (sameLine(v, mark.from, r2) && sameLine(v, mark.to, r1))
}

/** Lines given as parallel: the figure's arrows (same count) and "XY ∥ ZW" in the words. */
function parallelGroups(f: Fig, words: string): [string, string][][] {
  const groups = new Map<number, [string, string][]>()
  for (const line of f.spec.lines ?? []) {
    if (!line.arrows) continue
    groups.set(line.arrows, [...(groups.get(line.arrows) ?? []), line.through])
  }
  const out = [...groups.values()]
  for (const m of words.matchAll(/\b([A-Z])([A-Z]) ∥ ([A-Z])([A-Z])\b/g)) out.push([[m[1]!, m[2]!], [m[3]!, m[4]!]])
  for (const m of words.matchAll(/sun’s rays ([A-Z])([A-Z]) and ([A-Z])([A-Z]) are parallel/g)) out.push([[m[1]!, m[2]!], [m[3]!, m[4]!]])
  return out
}

/** Are the two rays known to be parallel (on one line, or on two lines given as parallel), and pointing the same way? */
function knownParallelSameWay(f: Fig, groups: [string, string][][], v1: string, p1: string, v2: string, p2: string): boolean {
  const u = unit(f.pt(v1), f.pt(p1))
  const w = unit(f.pt(v2), f.pt(p2))
  if (!sameDir(u, w)) return false
  if (collinear(f, [v1, p1, v2]) && collinear(f, [v1, p1, p2])) return true
  const onLine = (a: string, b: string, line: [string, string]) => collinear(f, [line[0], line[1], a]) && collinear(f, [line[0], line[1], b])
  return groups.some((g) => g.some((l1) => onLine(v1, p1, l1)) && g.some((l2) => onLine(v2, p2, l2)))
}

/** Is this angle pair given congruent by the marks, the words, a shared vertex, vertical angles, or parallel lines? */
function givenCongruent(f: Fig, words: string, groups: [string, string][][], a1: AngleRef, a2: AngleRef): boolean {
  const marks = f.spec.angles ?? []
  // The same angle (a shared angle), or vertical angles at one vertex.
  if (a1.vertex === a2.vertex) {
    const [p, q] = a1.rays
    const [r, s] = a2.rays
    const v = a1.vertex
    if ((sameRay(f, v, p, r) && sameRay(f, v, q, s)) || (sameRay(f, v, p, s) && sameRay(f, v, q, r))) return true
    const opposite = (x: string, y: string) => unit(f.pt(v), f.pt(x)).x * unit(f.pt(v), f.pt(y)).x + unit(f.pt(v), f.pt(x)).y * unit(f.pt(v), f.pt(y)).y < -0.9999
    if ((opposite(p, r) && opposite(q, s)) || (opposite(p, s) && opposite(q, r))) return true
  }
  // Arcs with the same count, or two right-angle squares.
  const m1 = marks.filter((m) => markIsAngle(f, m, a1))
  const m2 = marks.filter((m) => markIsAngle(f, m, a2))
  for (const x of m1) {
    for (const y of m2) {
      if (x.right && y.right) return true
      if (!x.right && !y.right && x.arc !== false && y.arc !== false && !x.label && !y.label && (x.marks ?? 1) === (y.marks ?? 1)) return true
      if (x.label && y.label && x.arc === false && y.arc === false && x.label === y.label) return true
    }
  }
  // "∠ADE ≅ ∠ACB" in the words.
  for (const m of words.matchAll(/∠([A-Z])([A-Z])([A-Z]) ≅ ∠([A-Z])([A-Z])([A-Z])/g)) {
    const w1: AngleRef = { vertex: m[2]!, rays: [m[1]!, m[3]!] }
    const w2: AngleRef = { vertex: m[5]!, rays: [m[4]!, m[6]!] }
    const same = (x: AngleRef, y: AngleRef) =>
      x.vertex === y.vertex && ((sameRay(f, x.vertex, x.rays[0], y.rays[0]) && sameRay(f, x.vertex, x.rays[1], y.rays[1])) || (sameRay(f, x.vertex, x.rays[0], y.rays[1]) && sameRay(f, x.vertex, x.rays[1], y.rays[0])))
    if ((same(w1, a1) && same(w2, a2)) || (same(w1, a2) && same(w2, a1))) return true
  }
  // "∠ACB is a right angle" with a square elsewhere, or two squares, already counted; parallel lines next.
  const [p1, q1] = a1.rays
  const [p2, q2] = a2.rays
  const par = (x1: string, x2: string) => knownParallelSameWay(f, groups, a1.vertex, x1, a2.vertex, x2)
  if ((par(p1, p2) && par(q1, q2)) || (par(p1, q2) && par(q1, p2))) return true
  return false
}

/** Angle measures given as numbers on the figure, with each triangle's third angle from the angle sum. */
function givenMeasures(f: Fig, t: Tri): Map<string, number> {
  const out = new Map<string, number>()
  for (const v of t) {
    const m = (f.spec.angles ?? []).find((g) => g.label && g.arc === false && markIsAngle(f, g, triAngle(t, v)))
    if (m && /^\d+°$/.test(m.label!)) out.set(v, Number(m.label!.replace('°', '')))
  }
  if (out.size === 2) {
    const missing = t.find((v) => !out.has(v))!
    out.set(missing, 180 - [...out.values()].reduce((s, g) => s + g, 0))
  }
  return out
}

const permsOf = (t: Tri): Tri[] => [
  [t[0], t[1], t[2]],
  [t[0], t[2], t[1]],
  [t[1], t[0], t[2]],
  [t[1], t[2], t[0]],
  [t[2], t[0], t[1]],
  [t[2], t[1], t[0]],
]

/**
 * For each correspondence of t2 to t1, the vertex pairs given congruent: directly by the marks, the words, a shared
 * vertex, vertical angles or parallel lines, and through any other triangle of the figure (`via`): two triangles with
 * two congruent pairs have their third pair congruent too (the angle sum), and congruence carries over.
 */
function congruentPairs(f: Fig, words: string, t1: Tri, t2: Tri, via: Tri[] = []): { map: Tri; pairs: number[] }[] {
  const groups = parallelGroups(f, words)
  const tris = [t1, t2, ...via]
  const key = (ti: number, v: string) => `${ti}:${v}`
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    let r = k
    while (parent.get(r) !== undefined && parent.get(r) !== r) r = parent.get(r)!
    return r
  }
  const union = (a: string, b: string): boolean => {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return false
    parent.set(ra, rb)
    return true
  }
  const measures = tris.map((t) => givenMeasures(f, t))
  for (let a = 0; a < tris.length; a++) {
    for (let b = a + 1; b < tris.length; b++) {
      for (const u of tris[a]!) {
        for (const v of tris[b]!) {
          const mu = measures[a]!.get(u)
          const mv = measures[b]!.get(v)
          if ((mu !== undefined && mv !== undefined && Math.abs(mu - mv) < 1e-9) || givenCongruent(f, words, groups, triAngle(tris[a]!, u), triAngle(tris[b]!, v))) union(key(a, u), key(b, v))
        }
      }
    }
  }
  // Two congruent pairs give the third.
  for (let changed = true; changed; ) {
    changed = false
    for (let a = 0; a < tris.length; a++) {
      for (let b = 0; b < tris.length; b++) {
        if (a === b) continue
        for (const map of permsOf(tris[b]!)) {
          const same = [0, 1, 2].filter((i) => find(key(a, tris[a]![i]!)) === find(key(b, map[i]!)))
          if (same.length === 2) {
            const i = [0, 1, 2].find((j) => !same.includes(j))!
            if (union(key(a, tris[a]![i]!), key(b, map[i]!))) changed = true
          }
        }
      }
    }
  }
  return permsOf(t2).map((map) => ({ map, pairs: [0, 1, 2].filter((i) => find(key(0, t1[i]!)) === find(key(1, map[i]!))) }))
}

/** Which tests the given marks prove: AA, SSS, SAS (over every correspondence). */
function provedTests(f: Fig, words: string, t1: Tri, t2: Tri): Set<string> {
  const out = new Set<string>()
  for (const { map, pairs } of congruentPairs(f, words, t1, t2)) {
    if (pairs.length >= 2) out.add('AA')
    const side = (t: Tri, i: number) => lengthOf(f, t[i]!, t[(i + 1) % 3]!)
    const s1 = [0, 1, 2].map((i) => side(t1, i))
    const s2 = [0, 1, 2].map((i) => side(map, i))
    // Numbers only: a which-test figure has no x.
    const known = [0, 1, 2].filter((i) => s1[i] && s2[i] && s1[i]!.a === 0 && s2[i]!.a === 0)
    const ratio = (i: number) => s1[i]!.b / s2[i]!.b
    if (known.length === 3 && close(ratio(0), ratio(1)) && close(ratio(1), ratio(2))) out.add('SSS')
    for (const i of pairs) {
      // The angle at vertex i sits between side i - 1 and side i.
      const a = (i + 2) % 3
      const b = i
      if (known.includes(a) && known.includes(b) && close(ratio(a), ratio(b))) out.add('SAS')
    }
  }
  return out
}

/** Every mark is true of the drawing: arcs of one count on equal angles, squares on right angles, arrows on parallels. */
function marksAreTrue(f: Fig): string[] {
  const out: string[] = []
  const marks = f.spec.angles ?? []
  const measure = (m: GeoAngleMark) => angleAt(f.pt(m.vertex), f.pt(m.from), f.pt(m.to))
  for (const m of marks) {
    if (m.right && Math.abs(measure(m) - 90) > 0.3) out.push(`square at ${m.vertex} on ${measure(m).toFixed(2)}°`)
    if (m.label && /^\d+°$/.test(m.label) && Math.abs(measure(m) - Number(m.label.replace('°', ''))) > 0.3) out.push(`angle ${m.vertex} labeled ${m.label} is ${measure(m).toFixed(2)}°`)
  }
  const arcs = marks.filter((m) => !m.right && m.arc !== false && !m.label)
  for (let i = 0; i < arcs.length; i++) {
    for (let j = i + 1; j < arcs.length; j++) {
      if ((arcs[i]!.marks ?? 1) !== (arcs[j]!.marks ?? 1)) continue
      if (Math.abs(measure(arcs[i]!) - measure(arcs[j]!)) > 0.3) out.push(`arcs at ${arcs[i]!.vertex} and ${arcs[j]!.vertex} differ`)
    }
  }
  const lines = (f.spec.lines ?? []).filter((l) => l.arrows)
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i]!.arrows !== lines[j]!.arrows) continue
      const u = unit(f.pt(lines[i]!.through[0]), f.pt(lines[i]!.through[1]))
      const w = unit(f.pt(lines[j]!.through[0]), f.pt(lines[j]!.through[1]))
      if (Math.abs(u.x * w.y - u.y * w.x) > 1e-3) out.push(`arrows on lines that are not parallel`)
    }
  }
  return out
}

// =================================================================================================================

describe('gr.proportion, solved again from the words', () => {
  it(
    'every proportion has one solution, the stored one; the geometric mean, the ratio, and the true equation agree',
    () => {
      const seen = new Set<string>()
      for (let seed = 1; seed <= N; seed++) {
        const { a } = problem('geoRatios', 'gr.proportion', seed)
        const where = `gr.proportion/${seed}: ${a.prompt}`
        const stage = a.stages[0]!
        let m = /^(?:Solve the proportion (.+) for x\.|Solve for x: (.+)\.)$/.exec(a.prompt)
        if (m) {
          seen.add('proportion')
          const eq = (m[1] ?? m[2])!
          const [left, right] = eq.split(' = ')
          // Split a side at its top-level "/": "(x + 3)/8", "12/x".
          const frac = (side: string): [L, L] => {
            let depth = 0
            for (let i = 0; i < side.length; i++) {
              const c = side[i]
              if (c === '(') depth++
              else if (c === ')') depth--
              else if (c === '/' && depth === 0) return [lin(side.slice(0, i)), lin(side.slice(i + 1))]
            }
            throw new Error(`no fraction in ${side}`)
          }
          const [p, q] = frac(left!)
          const [r, s] = frac(right!)
          const xs = solveProportion(p, q, r, s, [p, q, r, s])
          expect(xs, where).toHaveLength(1)
          expect(close(xs[0]!, valueOf(stage.answerText)), `${where} = ${stage.answerText}`).toBe(true)
          continue
        }
        m = /^Find the geometric mean of (\d+) and (\d+)\.$/.exec(a.prompt) ?? /^Solve (\d+)\/x = x\/(\d+) for the positive value of x\.$/.exec(a.prompt)
        if (m) {
          seen.add('mean')
          const mean = Math.sqrt(Number(m[1]) * Number(m[2]))
          expect(close(mean, valueOf(stage.answerText)), where).toBe(true)
          expect(Number(m[1]), where).not.toBe(Number(m[2]))
          continue
        }
        m = /^If (\d+)([a-z]) = (\d+)([a-z]), find the ratio of ([a-z]) to ([a-z])\.$/.exec(a.prompt)
        if (m) {
          seen.add('product')
          // p·A = q·B: A/B = q/p.
          const [p, A, q, B, top] = [Number(m[1]), m[2], Number(m[3]), m[4], m[5]]
          const aOverB = q / p
          const want = top === A ? aOverB : 1 / aOverB
          expect(B, where).not.toBe(A)
          expect(close(want, valueOf(stage.answerText)), where).toBe(true)
          continue
        }
        m = /^If ([a-z])\/(\d+) = ([a-z])\/(\d+), find the ratio of ([a-z]) to ([a-z])\.$/.exec(a.prompt)
        if (m) {
          seen.add('quotient')
          // A/p = B/q: A/B = p/q.
          const [A, p, , q, top] = [m[1], Number(m[2]), m[3], Number(m[4]), m[5]]
          const want = top === A ? p / q : q / p
          expect(close(want, valueOf(stage.answerText)), where).toBe(true)
          continue
        }
        m = /^If ([a-z])\/([a-z]) = ([a-z])\/([a-z]), which equation must also be true\?$/.exec(a.prompt)
        expect(m, where).not.toBeNull()
        seen.add('property')
        const [A, B, C, D] = [m![1]!, m![2]!, m![3]!, m![4]!]
        const holds = (text: string) => {
          // Several proportions a/b = c/d: c = k·d and a = k·b.
          for (const [k, b, d] of [
            [0.75, 3, 5],
            [2.5, -2, 7],
            [-1.4, 4, -3],
            [5, 1.5, 11],
            [0.2, 13, 2],
          ]) {
            const vals: Record<string, number> = { [A]: k! * b!, [B]: b!, [C]: k! * d!, [D]: d! }
            const [l, r] = text.split(' = ').map((side) => evalLetters(side, vals))
            if (!Number.isFinite(l!) || !Number.isFinite(r!)) continue
            if (Math.abs(l! - r!) > 1e-9 * Math.max(1, Math.abs(l!), Math.abs(r!))) return false
          }
          return true
        }
        const right = stage.choices!.filter((c) => holds(c.text))
        expect(right.map((c) => c.id), where).toEqual([stage.answerText])
      }
      expect([...seen].sort()).toEqual(['mean', 'product', 'property', 'proportion', 'quotient'])
    },
    HEAVY,
  )
})

/** "(a + b)/b", "ad", "a/c", "(a − b)/b", "(a + c)/(b + d)", "a + d" with letters, juxtaposition, + − / and parentheses. */
function evalLetters(text: string, vals: Record<string, number>): number {
  const s = text.replace(/−/g, '-').replace(/\s+/g, '')
  let i = 0
  const expr = (): number => {
    let v = term()
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++]
      const w = term()
      v = op === '+' ? v + w : v - w
    }
    return v
  }
  const term = (): number => {
    let v = factor()
    for (;;) {
      if (s[i] === '/') {
        i++
        v /= factor()
      } else if (s[i] === '(' || /[a-z0-9]/.test(s[i] ?? '')) v *= factor()
      else return v
    }
  }
  const factor = (): number => {
    const c = s[i]
    if (c === '(') {
      i++
      const v = expr()
      i++
      return v
    }
    if (/\d/.test(c ?? '')) {
      let j = i
      while (/\d/.test(s[j] ?? '')) j++
      const v = Number(s.slice(i, j))
      i = j
      return v
    }
    i++
    if (!(c! in vals)) throw new Error(`unknown letter ${c} in ${text}`)
    return vals[c!]!
  }
  return expr()
}

describe('gr.polygons, solved again from the statement and the figure', () => {
  it(
    'the scale factor, x, and the asked side, perimeter or angle follow from the letters; the figure is to scale',
    () => {
      for (let seed = 1; seed <= N; seed++) {
        const { a } = problem('geoRatios', 'gr.polygons', seed)
        const where = `gr.polygons/${seed}: ${a.prompt}`
        const m = /^In the figure, △?([A-Z]{3,4}) ~ △?([A-Z]{3,4})\. Find the scale factor of △?([A-Z]{3,4}) to △?([A-Z]{3,4}), then x, then (.+)\.$/.exec(a.prompt)
        expect(m, where).not.toBeNull()
        const first = [...m![1]!]
        const second = [...m![2]!]
        const n = first.length
        const f = figOf(a.figure)
        const side = (ids: string[], i: number): string | null => f.label(ids[i]!, ids[(i + 1) % n]!)
        // The scale factor of the first to the second, from a pair of corresponding sides that both have numbers.
        const pairs = [...Array(n).keys()].filter((i) => side(first, i) && side(second, i) && lin(side(first, i)!).a === 0 && lin(side(second, i)!).a === 0)
        expect(pairs.length, where).toBeGreaterThanOrEqual(1)
        const k = lin(side(first, pairs[0]!)!).b / lin(side(second, pairs[0]!)!).b
        for (const i of pairs) expect(close(lin(side(first, i)!).b / lin(side(second, i)!).b, k), where).toBe(true)
        const forward = m![3] === m![1]
        expect(close(valueOf(a.stages[0]!.answerText), forward ? k : 1 / k), `${where} scale factor`).toBe(true)
        // x: from a side in x, or an angle in x.
        const xSide = [...Array(n).keys()].find((i) => side(second, i) && lin(side(second, i)!).a !== 0)
        let x: number
        const angleMarks = a.figure.angles ?? []
        if (xSide !== undefined) {
          const e = lin(side(second, xSide)!)
          const partner = side(first, xSide)
          expect(partner, where).not.toBeNull()
          const xs = roots([e.b - lin(partner!).b / k, e.a, 0]).filter((v) => at(e, v) > 0)
          expect(xs, where).toHaveLength(1)
          x = xs[0]!
        } else {
          const xMark = angleMarks.find((g) => g.label && /x/.test(g.label))
          expect(xMark, where).toBeDefined()
          const vi = second.indexOf(xMark!.vertex)
          const measures1 = givenMeasures(f, first as Tri)
          expect(measures1.size, where).toBe(3)
          expect([...measures1.values()].reduce((s, g) => s + g, 0), `${where} angle sum`).toBeCloseTo(180, 9)
          const e = lin(xMark!.label!.replace('°', ''))
          const xs = roots([e.b - measures1.get(first[vi]!)!, e.a, 0])
          expect(xs, where).toHaveLength(1)
          x = xs[0]!
        }
        expect(close(x, valueOf(a.stages[1]!.answerText)), `${where} x`).toBe(true)
        // The third part.
        const what = m![5]!
        const third = valueOf(a.stages[2]!.answerText)
        if (what.startsWith('the perimeter of')) {
          const per1 = [...Array(n).keys()].reduce((s, i) => s + lin(side(first, i)!).b, 0)
          expect(close(third, per1 / k), `${where} perimeter`).toBe(true)
        } else if (what.startsWith('m∠')) {
          const v = what.slice(2)
          const measures1 = givenMeasures(f, first as Tri)
          expect(close(third, measures1.get(first[second.indexOf(v)]!)!), `${where} angle`).toBe(true)
        } else {
          const i = [...Array(n).keys()].find((j) => `${second[j]}${second[(j + 1) % n]}` === what)
          expect(i, where).toBeDefined()
          expect(close(third, at(lin(side(second, i!)!), x)), `${where} side`).toBe(true)
          expect(close(third, lin(side(first, i!)!).b / k), `${where} side by the scale factor`).toBe(true)
        }
        // Real polygons, drawn similar in this correspondence and at one scale.
        const p1 = first.map(f.pt)
        const p2 = second.map(f.pt)
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n
          const l = (i + n - 1) % n
          expect(Math.abs(angleAt(p1[i]!, p1[j]!, p1[l]!) - angleAt(p2[i]!, p2[j]!, p2[l]!)), `${where} angle ${first[i]}`).toBeLessThan(0.05)
          expect(Math.abs(dist(p1[i]!, p1[j]!) / dist(p2[i]!, p2[j]!) - k), `${where} drawn ratio`).toBeLessThan(0.01 * k)
        }
        const all = labeled(f)
        expect(oneScale(f, x, all), `${where} one scale`).toBe(true)
        expect(marksAreTrue(f), where).toEqual([])
        if (n === 3) {
          const s = [0, 1, 2].map((i) => dist(p1[i]!, p1[(i + 1) % 3]!))
          expect(s[0]! + s[1]! > s[2]! && s[1]! + s[2]! > s[0]! && s[0]! + s[2]! > s[1]!, where).toBe(true)
        }
      }
    },
    HEAVY,
  )
})

describe('gt.prove, decided again from the given marks', () => {
  it(
    'the answer is the one test the marks prove, or not enough information; never two; and every mark is true',
    () => {
      const seen = new Map<string, number>()
      for (let seed = 1; seed <= N; seed++) {
        const { a } = problem('geoSimilarTriangles', 'gt.prove', seed)
        const where = `gt.prove/${seed}: ${a.figure.ariaLabel}`
        const m = /triangles ([A-Z]{3}) and ([A-Z]{3}) are similar\?$/.exec(a.prompt)
        expect(m, where).not.toBeNull()
        const f = figOf(a.figure)
        const t1 = [...m![1]!] as Tri
        const t2 = [...m![2]!] as Tri
        const proved = provedTests(f, a.prompt, t1, t2)
        expect(proved.size, `${where} proves ${[...proved].join(', ')}`).toBeLessThanOrEqual(1)
        const answer = proved.size === 0 ? 'none' : [...proved][0]!
        expect(a.stages[0]!.answerText, where).toBe(answer)
        seen.set(answer, (seen.get(answer) ?? 0) + 1)
        expect(marksAreTrue(f), where).toEqual([])
        // Numbers are lengths at one scale.
        const all = labeled(f)
        if (all.length) expect(oneScale(f, 0, all), `${where} one scale`).toBe(true)
        // Each triangle is a real triangle.
        for (const t of [t1, t2]) {
          const s = [0, 1, 2].map((i) => dist(f.pt(t[i]!), f.pt(t[(i + 1) % 3]!)))
          expect(s[0]! + s[1]! > s[2]! + 1e-6 && s[1]! + s[2]! > s[0]! + 1e-6 && s[0]! + s[2]! > s[1]! + 1e-6, where).toBe(true)
        }
      }
      for (const id of ['AA', 'SSS', 'SAS', 'none']) expect(seen.get(id) ?? 0, id).toBeGreaterThan(N * 0.12)
    },
    HEAVY,
  )
})

describe('gt.solve, solved again from the marks, the words and the figure', () => {
  it(
    'the true statement is the only one the given angles allow, and x is the one positive solution',
    () => {
      for (let seed = 1; seed <= N; seed++) {
        const { a } = problem('geoSimilarTriangles', 'gt.solve', seed)
        const where = `gt.solve/${seed}: ${a.prompt}`
        const f = figOf(a.figure)
        const statement = a.stages[0]!
        const texts = statement.choices!.map((c) => c.text)
        const first = [...texts[0]!.split(' ~ ')[0]!.replace('△', '')] as Tri
        const secondLetters = [...texts[0]!.split(' ~ ')[1]!.replace('△', '')].sort().join('')
        for (const t of texts) expect([...t.split(' ~ ')[1]!.replace('△', '')].sort().join(''), where).toBe(secondLetters)
        // The words: "∠ACB is a right angle" counts as a square at C.
        const words = a.prompt
        const big = /^In right triangle ([A-Z]{3}),/.exec(words)
        const pairsBy = congruentPairs(f, words, first, [...secondLetters] as Tri, big ? [[...big[1]!] as Tri] : [])
        const forced = pairsBy.filter((p) => p.pairs.length >= 2)
        expect(forced.length, `${where} correspondences`).toBe(1)
        const map = forced[0]!.map
        const rightText = `△${first.join('')} ~ △${map.join('')}`
        const right = statement.choices!.filter((c) => c.text === rightText)
        expect(right.map((c) => c.id), where).toEqual([statement.answerText])
        // x from two pairs of corresponding sides, lengths from the labels (pieces add up).
        const sides = (t: Tri) => [0, 1, 2].map((i) => lengthOf(f, t[i]!, t[(i + 1) % 3]!))
        const s1 = sides(first)
        const s2 = sides(map)
        const usable = [0, 1, 2].filter((i) => s1[i] && s2[i])
        expect(usable.length, where).toBeGreaterThanOrEqual(2)
        // Solve with the first two usable pairs; every pair must agree at that x.
        const [i, j] = usable as [number, number]
        const exprs = usable.flatMap((u) => [s1[u]!, s2[u]!])
        const xs = solveProportion(s1[i]!, s2[i]!, s1[j]!, s2[j]!, exprs)
        expect(xs.length, `${where} solutions ${xs.join(', ')}`).toBe(1)
        const x = xs[0]!
        for (const u of usable) expect(close(at(s1[u]!, x) / at(s2[u]!, x), at(s1[i]!, x) / at(s2[i]!, x)), where).toBe(true)
        expect(close(x, valueOf(a.stages[1]!.answerText)), `${where} x = ${a.stages[1]!.answerText}`).toBe(true)
        // To scale, with true marks.
        expect(oneScale(f, x, labeled(f)), `${where} one scale`).toBe(true)
        expect(marksAreTrue(f), where).toEqual([])
        // The numbers in the words are the numbers on the figure.
        for (const [p, q, e] of labeled(f)) {
          if (e.a !== 0) continue
          if (!a.prompt.includes(`${p}${q} = ${e.b}`) && !a.prompt.includes(`${q}${p} = ${e.b}`)) {
            // Stories give the numbers in words: they must still be in the sentence.
            expect(new RegExp(`\\b${e.b}\\b`).test(a.prompt), `${where} ${p}${q} = ${e.b} not in the words`).toBe(true)
          }
        }
      }
    },
    HEAVY,
  )
})

describe('gp.splitter and gp.bisector, solved again from the words', () => {
  it(
    'a parallel segment, its converse, a parallel through a midpoint, a bisector and three parallels: one solution each',
    () => {
      const seen = new Set<string>()
      const pieces = (prompt: string, names: string[]): Record<string, L> => {
        const out: Record<string, L> = {}
        for (const nm of names) {
          const m = new RegExp(`\\b${nm} = ([^,.]+?)(?:,| and |\\.)`).exec(prompt)
          if (!m) throw new Error(`no ${nm} in ${prompt}`)
          out[nm] = lin(m[1]!)
        }
        return out
      }
      for (const [module, template] of [
        ['geoProportionalParts', 'gp.splitter'],
        ['geoProportionalParts', 'gp.bisector'],
      ] as const) {
        for (let seed = 1; seed <= N; seed++) {
          const { a, params } = problem(module, template, seed)
          const where = `${template}/${seed}: ${a.prompt}`
          const f = figOf(a.figure)
          let m = /^In triangle ([A-Z])([A-Z])([A-Z]), ([A-Z]) is on \1\2, ([A-Z]) is on \1\3, and \4\5 ∥ \2\3\. /.exec(a.prompt)
          let x: number | null = null
          let values: Record<string, L> = {}
          if (m) {
            seen.add('splitter')
            const [A, B, C, D, E] = [m[1]!, m[2]!, m[3]!, m[4]!, m[5]!]
            values = pieces(a.prompt, [`${A}${D}`, `${D}${B}`, `${A}${E}`, `${E}${C}`])
            const [p, q, r, s] = [values[`${A}${D}`]!, values[`${D}${B}`]!, values[`${A}${E}`]!, values[`${E}${C}`]!]
            const xs = solveProportion(p, q, r, s, [p, q, r, s])
            expect(xs, where).toHaveLength(1)
            x = xs[0]!
            // The drawing: D and E where the lengths say, and DE parallel to BC.
            const u = unit(f.pt(D), f.pt(E))
            const w = unit(f.pt(B), f.pt(C))
            expect(Math.abs(u.x * w.y - u.y * w.x), `${where} DE ∥ BC as drawn`).toBeLessThan(1e-3)
            expect(oneScale(f, x, labeled(f)), `${where} one scale`).toBe(true)
          }
          m = /^In triangle ([A-Z])([A-Z])([A-Z]), ([A-Z]) is on \1\2 and ([A-Z]) is on \1\3, with \1\4 = (\d+), \4\2 = (\d+), \1\5 = (\d+), and \5\3 = (\d+)\. The figure is not drawn to scale\. Is \4\5 parallel to \2\3\?$/.exec(a.prompt)
          if (m) {
            seen.add('converse')
            const [ad, db, ae, ec] = [Number(m[6]), Number(m[7]), Number(m[8]), Number(m[9])]
            expect(a.stages[0]!.answerText, where).toBe(ad * ec === db * ae ? 'yes' : 'no')
            expect(params.toScale, where).toBe(false)
            continue
          }
          m = /^In triangle ([A-Z])([A-Z])([A-Z]), ([A-Z]) is the midpoint of \1\2, ([A-Z]) is on \1\3, and \4\5 ∥ \2\3\. /.exec(a.prompt)
          if (m) {
            seen.add('midpoint')
            const [A, B, C, D, E] = [m[1]!, m[2]!, m[3]!, m[4]!, m[5]!]
            // The ticks say D is the midpoint; E is then the midpoint of AC, and DE is half of BC.
            const ticks = (a.figure.segments ?? []).filter((s) => s.ticks === 1).map((s) => `${s.from}${s.to}`).sort()
            expect(ticks, where).toEqual([`${A}${D}`, `${D}${B}`].sort())
            const halves = new RegExp(`${A}${E} = ([^.]+?) and ${E}${C} = ([^.]+?)\\.`).exec(a.prompt)
            const segs = new RegExp(`${D}${E} = ([^.]+?) and ${B}${C} = ([^.]+?)\\.`).exec(a.prompt)
            if (halves) {
              const e1 = lin(halves[1]!)
              const e2 = lin(halves[2]!)
              values = { [`${A}${E}`]: e1, [`${E}${C}`]: e2, [`${A}${C}`]: { a: e1.a + e2.a, b: e1.b + e2.b } }
              const xs = roots([e1.b - e2.b, e1.a - e2.a, 0]).filter((v) => at(e1, v) > 0 && at(e2, v) > 0)
              expect(xs, where).toHaveLength(1)
              x = xs[0]!
            } else {
              expect(segs, where).not.toBeNull()
              const e1 = lin(segs![1]!)
              const e2 = lin(segs![2]!)
              values = { [`${D}${E}`]: e1, [`${B}${C}`]: e2 }
              const xs = roots([2 * e1.b - e2.b, 2 * e1.a - e2.a, 0]).filter((v) => at(e1, v) > 0 && at(e2, v) > 0)
              expect(xs, where).toHaveLength(1)
              x = xs[0]!
            }
            const mid = (p: string, q: string) => ({ x: (f.pt(p).x + f.pt(q).x) / 2, y: (f.pt(p).y + f.pt(q).y) / 2 })
            expect(dist(f.pt(D), mid(A, B)), `${where} D drawn at the midpoint`).toBeLessThan(1e-2)
            expect(dist(f.pt(E), mid(A, C)), `${where} E drawn at the midpoint`).toBeLessThan(1e-2)
            expect(oneScale(f, x, labeled(f)), `${where} one scale`).toBe(true)
          }
          m = /^In triangle ([A-Z])([A-Z])([A-Z]), \1([A-Z]) bisects ∠\2\1\3, with \4 on \2\3\. /.exec(a.prompt)
          if (m) {
            seen.add('bisector')
            const [A, B, C, D] = [m[1]!, m[2]!, m[3]!, m[4]!]
            values = pieces(a.prompt, [`${A}${B}`, `${A}${C}`, `${B}${D}`, `${D}${C}`])
            const [ab, ac, bd, dc] = [values[`${A}${B}`]!, values[`${A}${C}`]!, values[`${B}${D}`]!, values[`${D}${C}`]!]
            // BD/DC = AB/AC.
            const xs = solveProportion(bd, dc, ab, ac, [ab, ac, bd, dc])
            expect(xs, where).toHaveLength(1)
            x = xs[0]!
            // A real triangle, and the drawn segment bisects the drawn angle (the arcs are true).
            const [AB, AC, BC] = [at(ab, x), at(ac, x), at(bd, x) + at(dc, x)]
            expect(AB + AC > BC && AB + BC > AC && AC + BC > AB, where).toBe(true)
            expect(Math.abs(angleAt(f.pt(A), f.pt(B), f.pt(D)) - angleAt(f.pt(A), f.pt(D), f.pt(C))), `${where} bisects`).toBeLessThan(0.05)
            expect(oneScale(f, x, labeled(f)), `${where} one scale`).toBe(true)
          }
          m = /^Three parallel lines cut one transversal at ([A-Z]), ([A-Z]), and ([A-Z]) and another at ([A-Z]), ([A-Z]), and ([A-Z])\. /.exec(a.prompt)
          if (m) {
            seen.add('parallels')
            const [P, Q, Rr, S, T, U] = [m[1]!, m[2]!, m[3]!, m[4]!, m[5]!, m[6]!]
            values = pieces(a.prompt, [`${P}${Q}`, `${Q}${Rr}`, `${S}${T}`, `${T}${U}`])
            const [pq, qr, st, tu] = [values[`${P}${Q}`]!, values[`${Q}${Rr}`]!, values[`${S}${T}`]!, values[`${T}${U}`]!]
            const xs = solveProportion(pq, qr, st, tu, [pq, qr, st, tu])
            expect(xs, where).toHaveLength(1)
            x = xs[0]!
            // Each transversal's pieces are drawn in the ratio of their numbers, and the arrows are on true parallels.
            expect(Math.abs(dist(f.pt(P), f.pt(Q)) / dist(f.pt(Q), f.pt(Rr)) - at(pq, x) / at(qr, x)), where).toBeLessThan(0.01)
            expect(Math.abs(dist(f.pt(S), f.pt(T)) / dist(f.pt(T), f.pt(U)) - at(st, x) / at(tu, x)), where).toBeLessThan(0.01)
            expect(a.prompt, where).toContain('not drawn to scale')
          }
          expect(x, `${where}: not read`).not.toBeNull()
          expect(close(x!, valueOf(a.stages[0]!.answerText)), `${where} x`).toBe(true)
          for (const [name, e] of Object.entries(values)) expect(at(e, x!), `${where} ${name}`).toBeGreaterThan(0)
          expect(marksAreTrue(f), where).toEqual([])
          if (a.stages[1]) {
            const asked = a.stages[1].label
            const e = values[asked] ?? values[[...asked].reverse().join('')]
            expect(e, `${where} asked ${asked}`).toBeDefined()
            expect(close(at(e!, x!), valueOf(a.stages[1].answerText)), `${where} ${asked}`).toBe(true)
          }
        }
      }
      expect([...seen].sort()).toEqual(['bisector', 'converse', 'midpoint', 'parallels', 'splitter'])
    },
    HEAVY,
  )
})
