/**
 * Reviewer's independent check of honors geometry Unit 5 (written by the reviewer, not the builder). Nothing here
 * calls the unit's own solvers or grading:
 * - numeric problems: every given expression, at the stored x, must equal what the drawn figure measures (the
 *   figures are to scale), the asked part must equal the figure's measure, and the figure must really be the shape,
 *   midpoints and crossing point the sentence claims;
 * - coordinates: slopes, lengths and midpoints recomputed exactly from the vertices in the sentence, and the
 *   conclusion decided by counting;
 * - "which test proves it": decided from the drawn marks with the five theorems, and every mark must be true of
 *   the drawing;
 * - most specific name: classified from the coordinates or the marks with Jurgensen's exclusive definitions, and
 *   the worded facts checked against the reviewer's own table of the fact patterns.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { ModuleId } from '@/shared/types'

const SEEDS = Number(process.env.GEO5_SEEDS ?? 300)
const HEAVY = 120000

type Pt = { id: string; x: number; y: number }
type Fig = {
  points: Pt[]
  segments?: { from: string; to: string; ticks?: number; label?: string }[]
  lines?: { through: [string, string]; arrows?: number }[]
  angles?: { vertex: string; from: string; to: string; label?: string; marks?: number; right?: boolean }[]
  grid?: unknown
  ariaLabel: string
}
type Choice = { id: string; text: string }
type Stage = { id: string; kind: string; label: string; answerText: string; choices?: Choice[] }
type A = { question: string; prompt: string; figure?: Fig; stages: Stage[] }

const answer = (module: string, template: string, seed: number) =>
  generateProblem(module as ModuleId, template, seed).answer as unknown as A

function sweep(module: string, template: string, check: (where: string, a: A) => string[]) {
  const bad: string[] = []
  for (let seed = 1; seed <= SEEDS; seed++) {
    const where = `${template}/${seed.toString(36)}`
    try {
      bad.push(...check(where, answer(module, template, seed)))
    } catch (e) {
      bad.push(`${where}: ${(e as Error).message}`)
    }
  }
  expect(bad.slice(0, 12), `${bad.length} problems`).toEqual([])
}

// ---------------------------------------------------------------------------------------------- numbers

const MINUS = /−/g

/** "12", "-3/2", "31/2", "√29", "2√13", "-5√2" → a number. */
function num(text: string): number {
  const t = text.replace(MINUS, '-').replace(/\s+/g, '')
  let m = /^(-?)(\d*)√(\d+)$/.exec(t)
  if (m) return (m[1] ? -1 : 1) * (m[2] ? Number(m[2]) : 1) * Math.sqrt(Number(m[3]))
  m = /^(-?\d+)\/(\d+)$/.exec(t)
  if (m) return Number(m[1]) / Number(m[2])
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  throw new Error(`not a number: ${text}`)
}

/** A linear expression in x as the problems print it: "4x − 38", "(5x + 73)°", "(3x)°", "x + 44", "94". */
function linear(expr: string): (x: number) => number {
  const t = expr.replace(/[°()\s]/g, '').replace(MINUS, '-')
  const terms = t.match(/[+-]?[^+-]+/g)
  if (!terms) throw new Error(`unreadable expression ${expr}`)
  let a = 0
  let b = 0
  for (const term of terms) {
    if (term.endsWith('x')) {
      const c = term.slice(0, -1)
      a += c === '' || c === '+' ? 1 : c === '-' ? -1 : Number(c)
    } else b += Number(term)
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error(`unreadable expression ${expr}`)
  return (x) => a * x + b
}

// ---------------------------------------------------------------------------------------------- geometry

const pt = (f: Fig, id: string): Pt => {
  const p = f.points.find((q) => q.id === id)
  if (!p) throw new Error(`no point ${id} in the figure`)
  return p
}
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const angleAt = (v: Pt, a: Pt, b: Pt) => {
  const ux = a.x - v.x
  const uy = a.y - v.y
  const wx = b.x - v.x
  const wy = b.y - v.y
  const c = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}
/** Sine of the angle between two directions: 0 when parallel. */
const skew = (a: Pt, b: Pt, c: Pt, d: Pt) => {
  const ux = b.x - a.x
  const uy = b.y - a.y
  const wx = d.x - c.x
  const wy = d.y - c.y
  return Math.abs(ux * wy - uy * wx) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))
}
const close = (a: number, b: number, rel = 0.006) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b))

/** The quadrilateral (or triangle) the sentence is about, in vertex order. */
function polygonName(prompt: string): string {
  const m =
    /(?:isosceles trapezoid|parallelogram|rhombus|rectangle|square|trapezoid|kite|quadrilateral|triangle) ([A-Z]{3,4})\b/.exec(prompt) ??
    /\b([A-Z]{4}) is (?:an isosceles trapezoid|a parallelogram|a rhombus|a rectangle|a square|a trapezoid)/.exec(prompt)
  if (!m) throw new Error(`no polygon named in "${prompt}"`)
  return m[1]!
}

/** The measure of a named length ("YE") or angle ("m∠Q" interior to the polygon, "m∠PSE" at S). */
function measure(f: Fig, poly: string, name: string): number {
  if (name.startsWith('m∠')) {
    const n = name.slice(2)
    if (n.length === 3) return angleAt(pt(f, n[1]!), pt(f, n[0]!), pt(f, n[2]!))
    const i = poly.indexOf(n)
    if (n.length !== 1 || i < 0) throw new Error(`angle ${name} is not a vertex of ${poly}`)
    const k = poly.length
    return angleAt(pt(f, n), pt(f, poly[(i + k - 1) % k]!), pt(f, poly[(i + 1) % k]!))
  }
  if (name.length !== 2) throw new Error(`unknown quantity ${name}`)
  return dist(pt(f, name[0]!), pt(f, name[1]!))
}

/** Is the drawn polygon the shape the sentence calls it? Returns what is wrong, if anything. */
function shapeProblems(f: Fig, poly: string, kind: string): string[] {
  const p = [...poly].map((c) => pt(f, c))
  if (p.length !== 4) return []
  const [a, b, c, d] = p as [Pt, Pt, Pt, Pt]
  const par1 = skew(a, b, d, c) < 0.004
  const par2 = skew(b, c, a, d) < 0.004
  const s = [dist(a, b), dist(b, c), dist(c, d), dist(d, a)]
  const right = Math.abs(angleAt(a, b, d) - 90) < 0.5
  const out: string[] = []
  const need = (ok: boolean, what: string) => {
    if (!ok) out.push(`${poly} is drawn but is not ${what}`)
  }
  if (kind === 'parallelogram' || kind === 'rectangle' || kind === 'rhombus' || kind === 'square') need(par1 && par2, 'a parallelogram')
  if (kind === 'rectangle' || kind === 'square') need(right, 'right-angled')
  if (kind === 'rhombus' || kind === 'square') need(close(s[0]!, s[1]!), 'equilateral')
  if (kind === 'trapezoid' || kind === 'isosceles trapezoid') need(par1 !== par2, 'a trapezoid with exactly one parallel pair')
  if (kind === 'isosceles trapezoid') need(par1 ? close(s[1]!, s[3]!) : close(s[0]!, s[2]!), 'isosceles')
  if (kind === 'kite') {
    const kite = (close(s[0]!, s[1]!) && close(s[2]!, s[3]!)) || (close(s[1]!, s[2]!) && close(s[3]!, s[0]!))
    need(kite && !close(s[0]!, s[2]!), 'a kite')
  }
  return out
}

// ---------------------------------------------------------------------------------------------- numeric templates

const KIND = /(isosceles trapezoid|parallelogram|rhombus|rectangle|square|trapezoid|kite|triangle)/

function numericCheck(where: string, a: A): string[] {
  const f = a.figure
  if (!f) return [`${where}: no figure`]
  const s = a.prompt
  const poly = polygonName(s)
  const kind = KIND.exec(s)?.[1] ?? ''
  const bad: string[] = shapeProblems(f, poly, kind).map((m) => `${where}: ${m}`)
  const xStage = a.stages.find((t) => t.id === 'x')
  if (!xStage) return [...bad, `${where}: no x stage`]
  const x = num(xStage.answerText)
  // Every "NAME = expression" in the sentence, at the stored x, against the figure.
  const given: { name: string; expr: string }[] = []
  for (const m of s.matchAll(/m∠([A-Z]{1,3}) = (\([^)]*\)°|[\d.]+°)/g)) given.push({ name: `m∠${m[1]}`, expr: m[2]! })
  for (const m of s.matchAll(/(?<![∠A-Z])([A-Z]{2}) = ([^,.]+?)(?=, and |, | and |\.)/g)) given.push({ name: m[1]!, expr: m[2]! })
  if (given.length < 1) bad.push(`${where}: no given quantity read from "${s}"`)
  // An isosceles trapezoid's diagonals are congruent; these figures are not to scale, so solve it here: the whole
  // diagonal equals the sum of the two pieces of the other one, and either diagonal is that length.
  const iso = /isosceles trapezoid with bases [A-Z]{2} and [A-Z]{2}\. Its diagonals meet at ([A-Z])\. ([A-Z]{2}) = (.+?), ([A-Z]{2}) = (.+?), and ([A-Z]{2}) = (.+?)\. Find x, then ([A-Z]{2})\.$/.exec(s)
  if (iso) {
    const [, e, d1, e1, p1, ep1, p2, ep2, askedDiag] = iso as unknown as string[]
    const other = `${p1![0]}${p2![1]}`
    const okPieces = p1![1] === e && p2![0] === e && new Set([...d1!, ...other]).size === 4 && [...poly].every((c) => (d1! + other).includes(c))
    if (!okPieces) bad.push(`${where}: ${p1} and ${p2} are not the two pieces of the other diagonal`)
    const whole = linear(e1!)(x)
    const sum = linear(ep1!)(x) + linear(ep2!)(x)
    if (!close(whole, sum, 1e-9)) bad.push(`${where}: ${d1} = ${whole} but ${p1} + ${p2} = ${sum} at x = ${x}`)
    for (const v of [whole, linear(ep1!)(x), linear(ep2!)(x)]) if (v <= 0) bad.push(`${where}: a length is ${v} at x = ${x}`)
    const result = a.stages.find((t) => t.id === 'result')
    const isDiag = askedDiag === d1 || [...askedDiag!].sort().join('') === [...other].sort().join('')
    if (!result || !isDiag || !close(num(result.answerText), whole, 1e-9)) bad.push(`${where}: ${askedDiag} stored ${result?.answerText}, the diagonals are ${whole}`)
    return bad
  }
  let scale: number | null = null
  for (const g of given) {
    const v = linear(g.expr)(x)
    const mv = measure(f, poly, g.name)
    if (v <= 0) bad.push(`${where}: ${g.name} = ${g.expr} is ${v} at x = ${x}`)
    if (g.name.startsWith('m∠')) {
      if (Math.abs(v - mv) > 0.6) bad.push(`${where}: ${g.name} = ${g.expr} = ${v} at x = ${x}, the figure has ${mv.toFixed(2)}°`)
    } else {
      scale ??= v / mv
      if (!close(v / mv, scale, 0.01)) bad.push(`${where}: ${g.name} = ${v} does not fit the figure's scale`)
    }
  }
  // The asked part, measured on the figure.
  const asked = /then (m∠[A-Z]{1,3}|[A-Z]{2})\.$/.exec(s)?.[1]
  const result = a.stages.find((t) => t.id === 'result')
  if (asked && result) {
    const mv = measure(f, poly, asked)
    const want = asked.startsWith('m∠') ? mv : mv * (scale ?? 1)
    const got = num(result.answerText)
    if (Math.abs(got - want) > (asked.startsWith('m∠') ? 0.6 : Math.max(0.15, 0.006 * want)))
      bad.push(`${where}: ${asked} stored ${got}, the figure gives ${want.toFixed(2)}`)
  } else if (asked || result) bad.push(`${where}: asked "${asked}" but result stage ${result ? 'present' : 'missing'}`)
  // Midpoints and the crossing point the sentence names.
  for (const m of s.matchAll(/([A-Z]) is the midpoint of (?:leg )?([A-Z])([A-Z])/g)) {
    const mid = { id: '', x: (pt(f, m[2]!).x + pt(f, m[3]!).x) / 2, y: (pt(f, m[2]!).y + pt(f, m[3]!).y) / 2 }
    if (dist(pt(f, m[1]!), mid) > 0.08) bad.push(`${where}: ${m[1]} is not drawn at the midpoint of ${m[2]}${m[3]}`)
  }
  const meet = /diagonals (?:of [a-z ]*[A-Z]{4} )?meet at ([A-Z])/.exec(s)
  if (meet && poly.length === 4) {
    const e = pt(f, meet[1]!)
    const [p0, p1, p2, p3] = [...poly].map((c) => pt(f, c)) as [Pt, Pt, Pt, Pt]
    if (skew(p0, e, e, p2) > 0.004 || skew(p1, e, e, p3) > 0.004) bad.push(`${where}: ${meet[1]} is not on both diagonals`)
  }
  return bad
}

// ---------------------------------------------------------------------------------------------- coordinates

type Q = { x: number; y: number }
function vertices(prompt: string): Map<string, Q> {
  const v = new Map<string, Q>()
  for (const m of prompt.matchAll(/([A-Z])\((−?\d+), (−?\d+)\)/g))
    v.set(m[1]!, { x: Number(m[2]!.replace(MINUS, '-')), y: Number(m[3]!.replace(MINUS, '-')) })
  return v
}
const frac = (p: number, q: number) => p / q
/** Exact slope as [dy, dx] (dx may be 0). */
const slope = (a: Q, b: Q): [number, number] => [b.y - a.y, b.x - a.x]
const sameSlope = (u: [number, number], w: [number, number]) => u[0] * w[1] === u[1] * w[0]
const len2 = (a: Q, b: Q) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

function coordsCheck(where: string, a: A): string[] {
  const v = vertices(a.prompt)
  const poly = /Quadrilateral ([A-Z]{4})/.exec(a.prompt)?.[1]
  if (!poly || v.size !== 4) return [`${where}: could not read the quadrilateral from "${a.prompt}"`]
  const P = (c: string) => v.get(c)!
  const bad: string[] = []
  const [A1, B1, C1, D1] = [...poly] as [string, string, string, string]
  const parallel = [sameSlope(slope(P(A1), P(B1)), slope(P(C1), P(D1))), sameSlope(slope(P(B1), P(C1)), slope(P(D1), P(A1)))]
  const congruent = [len2(P(A1), P(B1)) === len2(P(C1), P(D1)), len2(P(B1), P(C1)) === len2(P(D1), P(A1))]
  for (const st of a.stages) {
    let m = /^Slope of ([A-Z])([A-Z])$/.exec(st.label)
    if (m) {
      const [dy, dx] = slope(P(m[1]!), P(m[2]!))
      if (dx === 0 || !close(num(st.answerText), frac(dy, dx), 1e-9)) bad.push(`${where}: slope of ${m[1]}${m[2]} stored ${st.answerText}, is ${dy}/${dx}`)
      continue
    }
    m = /^([A-Z])([A-Z])$/.exec(st.label)
    if (m) {
      const want = len2(P(m[1]!), P(m[2]!))
      if (!close(num(st.answerText) ** 2, want, 1e-9)) bad.push(`${where}: ${m[1]}${m[2]} stored ${st.answerText}, is √${want}`)
      continue
    }
    m = /^Midpoint of ([A-Z])([A-Z])$/.exec(st.label)
    if (m) {
      const mm = /^\((.+), (.+)\)$/.exec(st.answerText)
      const p = P(m[1]!)
      const q = P(m[2]!)
      if (!mm || !close(num(mm[1]!), (p.x + q.x) / 2, 1e-9) || !close(num(mm[2]!), (p.y + q.y) / 2, 1e-9))
        bad.push(`${where}: midpoint of ${m[1]}${m[2]} stored ${st.answerText}`)
      continue
    }
    if (st.kind !== 'choice') {
      bad.push(`${where}: unknown stage "${st.label}"`)
      continue
    }
    // The conclusion, decided by counting what the asked values show.
    let want: string
    if (st.label === 'What the slopes show') want = ['neither', 'onlyOne', 'both'][parallel.filter(Boolean).length]!
    else if (st.label === 'What the lengths show') want = ['neither', 'onlyOne', 'both'][congruent.filter(Boolean).length]!
    else if (st.label === 'What the midpoints show') {
      const mid = (p: Q, q: Q) => [p.x + q.x, p.y + q.y]
      const m1 = mid(P(A1), P(C1))
      const m2 = mid(P(B1), P(D1))
      want = m1[0] === m2[0] && m1[1] === m2[1] ? 'same' : 'different'
    } else if (st.label === 'What the four values show') want = 'notProved' // one pair's slopes and the other pair's lengths never prove it
    else {
      bad.push(`${where}: unknown conclusion "${st.label}"`)
      continue
    }
    if (st.answerText !== want) bad.push(`${where}: "${st.label}" stored ${st.answerText}, the values give ${want}`)
  }
  return bad
}

// ---------------------------------------------------------------------------------------------- marks

type Facts = {
  parallelPairs: number // opposite pairs marked parallel
  congruentPairs: number // opposite pairs marked congruent
  onePairBoth: boolean // one opposite pair marked both parallel and congruent
  oppositeAnglePairs: number
  diagonalsBisect: boolean
  diagonalsCongruent: boolean
  diagonalsPerpendicular: boolean
  allSidesCongruent: boolean
  consecutiveCongruent: boolean
  rightVertices: number
  dishonest: string[]
}

/** What the marks on a quadrilateral figure say, and whether each mark is true of the drawing. */
function readMarks(f: Fig, poly: string): Facts {
  const v = [...poly]
  const side = (i: number) => [v[i % 4]!, v[(i + 1) % 4]!] as const
  const key = (p: string, q: string) => [p, q].sort().join('')
  const ticks = new Map<string, number>()
  for (const s of f.segments ?? []) if (s.ticks) ticks.set(key(s.from, s.to), s.ticks)
  const arrows = new Map<string, number>()
  for (const l of f.lines ?? []) if (l.arrows) arrows.set(key(l.through[0], l.through[1]), l.arrows)
  const dishonest: string[] = []
  const P = (c: string) => pt(f, c)
  const opp: [number, number][] = [
    [0, 2],
    [1, 3],
  ]
  let parallelPairs = 0
  let congruentPairs = 0
  let onePairBoth = false
  for (const [i, j] of opp) {
    const [a, b] = side(i)
    const [c, d] = side(j)
    const ar1 = arrows.get(key(a, b))
    const ar2 = arrows.get(key(c, d))
    const t1 = ticks.get(key(a, b))
    const t2 = ticks.get(key(c, d))
    const par = ar1 !== undefined && ar1 === ar2
    const con = t1 !== undefined && t1 === t2
    if (par) {
      parallelPairs++
      if (skew(P(a), P(b), P(c), P(d)) > 0.004) dishonest.push(`${a}${b} and ${c}${d} are marked parallel but are not drawn so`)
    }
    if (con) {
      congruentPairs++
      if (!close(dist(P(a), P(b)), dist(P(c), P(d)))) dishonest.push(`${a}${b} and ${c}${d} are marked congruent but are not drawn so`)
    }
    if (par && con) onePairBoth = true
  }
  const sideTicks = [0, 1, 2, 3].map((i) => ticks.get(key(...side(i))))
  const allSidesCongruent = sideTicks.every((t) => t !== undefined && t === sideTicks[0])
  const consecutiveCongruent = [0, 1, 2, 3].some((i) => sideTicks[i] !== undefined && sideTicks[i] === sideTicks[(i + 1) % 4])
  // Angle arcs and right angles at the vertices.
  const arc = new Map<string, number>()
  let rightVertices = 0
  let diagonalsPerpendicular = false
  for (const g of f.angles ?? []) {
    if (g.right) {
      if (v.includes(g.vertex)) rightVertices++
      else diagonalsPerpendicular = true
      if (Math.abs(angleAt(P(g.vertex), P(g.from), P(g.to)) - 90) > 0.5) dishonest.push(`the right angle at ${g.vertex} is not drawn square`)
    } else if (g.marks && v.includes(g.vertex)) arc.set(g.vertex, g.marks)
  }
  let oppositeAnglePairs = 0
  for (const [i, j] of [
    [0, 2],
    [1, 3],
  ] as const) {
    const m1 = arc.get(v[i]!)
    const m2 = arc.get(v[j]!)
    if (m1 !== undefined && m1 === m2) {
      oppositeAnglePairs++
      const k = (n: number) => angleAt(P(v[n]!), P(v[(n + 3) % 4]!), P(v[(n + 1) % 4]!))
      if (Math.abs(k(i) - k(j)) > 0.5) dishonest.push(`angles ${v[i]} and ${v[j]} are marked congruent but are not drawn so`)
    }
  }
  // Diagonal halves: segments from a vertex to the crossing point.
  const center = f.points.find((p) => !v.includes(p.id))
  let diagonalsBisect = false
  let diagonalsCongruent = false
  if (center) {
    const half = (c: string) => ticks.get(key(c, center.id))
    const h = v.map(half)
    const bis1 = h[0] !== undefined && h[0] === h[2]
    const bis2 = h[1] !== undefined && h[1] === h[3]
    diagonalsBisect = bis1 && bis2
    diagonalsCongruent = diagonalsBisect && h[0] === h[1]
    for (const [i, j] of [
      [0, 2],
      [1, 3],
      [0, 1],
    ] as const) {
      if (h[i] !== undefined && h[i] === h[j] && !close(dist(P(v[i]!), center), dist(P(v[j]!), center)))
        dishonest.push(`${v[i]}${center.id} and ${v[j]}${center.id} are marked congruent but are not drawn so`)
    }
  }
  return {
    parallelPairs,
    congruentPairs,
    onePairBoth,
    oppositeAnglePairs,
    diagonalsBisect,
    diagonalsCongruent,
    diagonalsPerpendicular,
    allSidesCongruent,
    consecutiveCongruent,
    rightVertices,
    dishonest,
  }
}

function proveCheck(where: string, a: A): string[] {
  const f = a.figure
  if (!f) return [`${where}: no figure`]
  const poly = /quadrilateral ([A-Z]{4})/.exec(a.prompt)?.[1]
  if (!poly) return [`${where}: no quadrilateral in "${a.prompt}"`]
  const m = readMarks(f, poly)
  const holds = [
    m.parallelPairs === 2 && 'parallel',
    m.congruentPairs === 2 && 'sides',
    m.onePairBoth && 'onePair',
    m.oppositeAnglePairs === 2 && 'angles',
    m.diagonalsBisect && 'diagonals',
  ].filter(Boolean) as string[]
  const bad = m.dishonest.map((d) => `${where}: ${d}`)
  const want = holds.length === 0 ? 'none' : holds.length === 1 ? holds[0]! : `ambiguous(${holds.join(',')})`
  const got = a.stages[0]!.answerText
  if (got !== want) bad.push(`${where}: stored ${got}, the marks give ${want}`)
  return bad
}

// ---------------------------------------------------------------------------------------------- most specific name

type Name = 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'isoTrapezoid' | 'trapezoid' | 'kite' | 'quadrilateral'

/** Exact classification from integer vertices, exclusive definitions (Jurgensen). */
function classifyCoords(p: Q[]): Name | 'not convex' {
  const [a, b, c, d] = p as [Q, Q, Q, Q]
  const crosses = [0, 1, 2, 3].map((i) => {
    const u = p[i]!
    const w = p[(i + 1) % 4]!
    const z = p[(i + 2) % 4]!
    return (w.x - u.x) * (z.y - w.y) - (w.y - u.y) * (z.x - w.x)
  })
  if (!(crosses.every((k) => k > 0) || crosses.every((k) => k < 0))) return 'not convex'
  const par1 = sameSlope(slope(a, b), slope(d, c))
  const par2 = sameSlope(slope(b, c), slope(a, d))
  const s = [len2(a, b), len2(b, c), len2(c, d), len2(d, a)]
  const right = (b.x - a.x) * (d.x - a.x) + (b.y - a.y) * (d.y - a.y) === 0
  if (par1 && par2) {
    const rhombus = s[0] === s[1]
    if (rhombus && right) return 'square'
    if (right) return 'rectangle'
    if (rhombus) return 'rhombus'
    return 'parallelogram'
  }
  if (par1 || par2) return (par1 ? s[1] === s[3] : s[0] === s[2]) ? 'isoTrapezoid' : 'trapezoid'
  const kite = (s[0] === s[1] && s[2] === s[3]) || (s[1] === s[2] && s[3] === s[0])
  return kite ? 'kite' : 'quadrilateral'
}

function classifyMarks(m: Facts): Name {
  const parallelogram =
    m.parallelPairs === 2 || m.congruentPairs === 2 || m.onePairBoth || m.oppositeAnglePairs === 2 || m.diagonalsBisect || m.allSidesCongruent || m.rightVertices === 4
  const rhombus = m.allSidesCongruent || (parallelogram && (m.diagonalsPerpendicular || m.consecutiveCongruent))
  const rectangle = m.rightVertices === 4 || (parallelogram && (m.rightVertices > 0 || m.diagonalsCongruent))
  if (rhombus && rectangle) return 'square'
  if (rectangle) return 'rectangle'
  if (rhombus) return 'rhombus'
  if (parallelogram) return 'parallelogram'
  return 'quadrilateral'
}

/**
 * The worded facts, as patterns (letters → N, numbers → #), with the name each one forces. Worked out by the
 * reviewer from the theorems; a pattern not in this table fails the test so it gets read before it ships.
 */
const FACTS: Record<string, Name> = {
  'All four sides of N are congruent, and ∠N is a right angle.': 'square',
  'All four sides of N are congruent.': 'rhombus',
  'The diagonals of N bisect each other and are congruent.': 'rectangle',
  'N is a parallelogram with congruent diagonals.': 'rectangle',
  'In N, N ∥ N, and N is longer than N.': 'trapezoid',
  'N is a parallelogram whose diagonals are congruent and perpendicular.': 'square',
  'In N, N ∥ N, but N is not parallel to N.': 'trapezoid',
  'In N, N ≅ N, N ≅ N, and N is shorter than N.': 'kite',
  'N is a parallelogram with perpendicular diagonals.': 'rhombus',
  'N is a trapezoid with bases N and N, and its diagonals are congruent.': 'isoTrapezoid',
  'In N, N ≅ N.': 'quadrilateral',
  'N is a rectangle with N ≅ N.': 'square',
  'In N, N = N = # and N = N = #.': 'kite',
  'In N, N ∥ N, N ≅ N, and N is longer than N.': 'isoTrapezoid',
  'The diagonals of N are congruent.': 'quadrilateral',
  'N is a rhombus with congruent diagonals.': 'square',
  'N is a parallelogram, and diagonal N bisects ∠N and ∠N.': 'rhombus',
  'The diagonals of N bisect each other.': 'parallelogram',
  'N is a parallelogram with a right angle at N.': 'rectangle',
  'All four angles of N are right angles.': 'rectangle',
  'The diagonals of N are perpendicular.': 'quadrilateral',
  'In N, N ∥ N and N ≅ N.': 'parallelogram',
  'Both pairs of opposite angles of N are congruent.': 'parallelogram',
  'N is a parallelogram with N ≅ N.': 'rhombus',
  'N is a trapezoid with bases N and N, and ∠N ≅ ∠N.': 'isoTrapezoid',
  'The diagonals of N bisect each other and are perpendicular.': 'rhombus',
  'Both pairs of opposite sides of N are congruent.': 'parallelogram',
}

const pattern = (s: string) => s.replace(/\b[A-Z]{1,4}\b/g, 'N').replace(/−?\d+/g, '#')

/** The structure the patterns above hide: which named sides and angles are adjacent or opposite. */
function factStructure(where: string, facts: string, poly: string): string[] {
  const v = [...poly]
  const adjacent = (s: string, t: string) => {
    const shared = [...s].filter((c) => t.includes(c))
    return shared.length === 1
  }
  const isSide = (s: string) => {
    const i = v.indexOf(s[0]!)
    const j = v.indexOf(s[1]!)
    return i >= 0 && j >= 0 && (Math.abs(i - j) === 1 || Math.abs(i - j) === 3)
  }
  const bad: string[] = []
  const p = pattern(facts)
  const sides = [...facts.matchAll(/\b([A-Z]{2})\b/g)].map((m) => m[1]!).filter((s) => s !== poly)
  for (const s of sides) if (!isSide(s) && !/diagonal/.test(facts)) bad.push(`${where}: ${s} is not a side of ${poly}`)
  const pairs = (re: RegExp) => [...facts.matchAll(re)].map((m) => [m[1]!, m[2]!] as const)
  if (p === 'In N, N ≅ N, N ≅ N, and N is shorter than N.' || p === 'In N, N = N = # and N = N = #.') {
    const eq = p.startsWith('In N, N ≅') ? pairs(/([A-Z]{2}) ≅ ([A-Z]{2})/g) : pairs(/([A-Z]{2}) = ([A-Z]{2}) =/g)
    if (eq.length !== 2 || !eq.every(([s, t]) => adjacent(s, t))) bad.push(`${where}: a kite needs two pairs of adjacent congruent sides: ${facts}`)
  }
  if (p === 'N is a rectangle with N ≅ N.' || p === 'N is a parallelogram with N ≅ N.') {
    const [[s, t]] = pairs(/([A-Z]{2}) ≅ ([A-Z]{2})/g) as unknown as [[string, string]]
    if (!adjacent(s, t)) bad.push(`${where}: ${s} and ${t} are not consecutive sides`)
  }
  if (p === 'In N, N ≅ N.') {
    const [[s, t]] = pairs(/([A-Z]{2}) ≅ ([A-Z]{2})/g) as unknown as [[string, string]]
    if (adjacent(s, t)) bad.push(`${where}: ${s} and ${t} are consecutive, which is not "nothing more"`)
  }
  if (/∥/.test(facts)) {
    const [[s, t]] = pairs(/([A-Z]{2}) ∥ ([A-Z]{2})/g) as unknown as [[string, string]]
    if (adjacent(s, t)) bad.push(`${where}: ${s} ∥ ${t} names consecutive sides`)
  }
  if (p === 'N is a trapezoid with bases N and N, and ∠N ≅ ∠N.') {
    const m = /bases ([A-Z]{2}) and ([A-Z]{2}), and ∠([A-Z]) ≅ ∠([A-Z])/.exec(facts)
    if (!m || !(m[1]!.includes(m[3]!) && m[1]!.includes(m[4]!)) && !(m[2]!.includes(m[3]!) && m[2]!.includes(m[4]!)))
      bad.push(`${where}: the congruent angles are not the base angles of one base: ${facts}`)
  }
  if (p === 'N is a parallelogram, and diagonal N bisects ∠N and ∠N.') {
    const m = /diagonal ([A-Z])([A-Z]) bisects ∠([A-Z]) and ∠([A-Z])/.exec(facts)
    if (!m || m[1] !== m[3] || m[2] !== m[4]) bad.push(`${where}: the diagonal does not bisect its own end angles: ${facts}`)
  }
  return bad
}

function classifyCheck(where: string, a: A): string[] {
  const s = a.prompt
  const bad: string[] = []
  let want: Name | 'not convex'
  const poly = /about ([A-Z]{4})\./.exec(s)?.[1] ?? /^([A-Z]{4}) has vertices/.exec(s)?.[1] ?? /([A-Z]{4})/.exec(s)?.[1]
  if (!poly) return [`${where}: no quadrilateral in "${s}"`]
  if (/has vertices/.test(s)) {
    const v = vertices(s)
    want = classifyCoords([...poly].map((c) => v.get(c)!))
  } else if (/^The marks show/.test(s)) {
    if (!a.figure) return [`${where}: marks without a figure`]
    const m = readMarks(a.figure, poly)
    bad.push(...m.dishonest.map((d) => `${where}: ${d}`))
    want = classifyMarks(m)
  } else {
    const facts = s.replace(/ (What is the most specific name|Must) .*$/, '')
    const p = pattern(facts)
    const named = FACTS[p]
    if (!named) return [`${where}: a fact pattern the reviewer has not checked: "${p}" (${facts})`]
    bad.push(...factStructure(where, facts, poly))
    want = named
  }
  if (want === 'not convex') return [...bad, `${where}: the quadrilateral is not convex`]
  for (const st of a.stages) {
    if (st.label === 'Most specific name') {
      if (st.answerText !== want) bad.push(`${where}: stored ${st.answerText}, the given facts make it ${want}`)
    } else if (st.label === 'Rectangle?' || st.label === 'Rhombus?') {
      const yes = st.label === 'Rectangle?' ? want === 'square' || want === 'rectangle' : want === 'square' || want === 'rhombus'
      if (st.answerText !== (yes ? 'yes' : 'no')) bad.push(`${where}: "${st.label}" stored ${st.answerText}, the facts make it ${want}`)
    } else bad.push(`${where}: unknown stage "${st.label}"`)
  }
  return bad
}

// ---------------------------------------------------------------------------------------------- the sweeps

describe('Unit 5 solved again by the reviewer', () => {
  it.each([
    ['geoParallelograms', 'gq.props'],
    ['geoSpecialQuads', 'gs.props'],
    ['geoTrapezoids', 'gz.midseg'],
    ['geoTrapezoids', 'gz.isosceles'],
  ])('%s %s: the stored x fits every given expression on the to-scale figure, and the asked part is what the figure measures', (m, t) => {
    sweep(m, t, numericCheck)
  }, HEAVY)

  it('gq.coords: slopes, lengths and midpoints recomputed exactly, and the conclusion counted', () => {
    sweep('geoParallelograms', 'gq.coords', coordsCheck)
  }, HEAVY)

  it('gq.prove: the answer is the one test the marks satisfy (or none), and every mark is true of the drawing', () => {
    sweep('geoParallelograms', 'gq.prove', proveCheck)
  }, HEAVY)

  it('gs.classify: the most specific name and the must-it-be answers from the coordinates, the marks or the facts', () => {
    sweep('geoSpecialQuads', 'gs.classify', classifyCheck)
  }, HEAVY)
})
