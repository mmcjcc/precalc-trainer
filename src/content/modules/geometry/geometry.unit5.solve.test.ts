/**
 * Independent re-solve of Honors Geometry Unit 5. Nothing here imports a Unit 5 generator or helper: each problem
 * is solved again from its prompt and from the marks its figure actually draws. Lengths and angles are tied by the
 * theorems of the shape (a parallelogram's opposite sides and angles, its diagonals bisecting each other, a
 * rectangle's congruent diagonals, a rhombus's perpendicular diagonals, the midsegment and median theorems, an
 * isosceles trapezoid's base angles and diagonals, a kite's angles), and a small linear solver must find exactly
 * one x. "Not enough information" must be the answer exactly when no listed test applies, and then a concrete
 * quadrilateral that is not a parallelogram must carry every mark. Every named slip is recomputed from its
 * definition, and the figure must be a real convex quadrilateral that agrees with what is given.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec, ModuleId } from '@/shared/types'
import { gradeGeoStage } from './grade'

const SEEDS = Number(process.env.GEO_SEEDS ?? 2000)
const HEAVY = 120_000

// --- exact rationals and linear expressions in x -----------------------------------------------------------

type Q = { n: bigint; d: bigint }
const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b))
function q(n: bigint | number, d: bigint | number = 1n): Q {
  let N = BigInt(n)
  let D = BigInt(d)
  if (D === 0n) throw new Error('zero denominator')
  if (D < 0n) [N, D] = [-N, -D]
  const g = gcd(N, D) || 1n
  return { n: N / g, d: D / g }
}
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d)
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d)
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d)
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n)
const isZero = (a: Q) => a.n === 0n
const same = (a: Q, b: Q) => a.n === b.n && a.d === b.d
const text = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`)
const num = (a: Q) => Number(a.n) / Number(a.d)

interface Lin {
  a: Q
  b: Q
}
const lc = (c: number | Q): Lin => ({ a: q(0), b: typeof c === 'number' ? q(c) : c })
const ladd = (u: Lin, v: Lin): Lin => ({ a: add(u.a, v.a), b: add(u.b, v.b) })
const lsub = (u: Lin, v: Lin): Lin => ({ a: sub(u.a, v.a), b: sub(u.b, v.b) })
const lscale = (k: Q, u: Lin): Lin => ({ a: mul(k, u.a), b: mul(k, u.b) })
const at = (u: Lin, x: Q) => add(mul(u.a, x), u.b)

/** "3x + 5", "x − 7", "3x", "12": what the prompt prints. */
function parseLin(raw: string): Lin {
  const s = raw.replace(/−/g, '-').replace(/[()°\s]/g, '')
  const m = /^([+-]?\d*)x([+-]\d+)?$/.exec(s)
  if (m) {
    const c = m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1])
    return { a: q(c), b: q(Number(m[2] ?? 0)) }
  }
  if (/^[+-]?\d+$/.test(s)) return lc(Number(s))
  throw new Error(`not linear: ${raw}`)
}

/** The one x with left = right, or null when they never meet or always do. */
function meet(left: Lin, right: Lin): Q | null {
  const d = sub(left.a, right.a)
  return isZero(d) ? null : div(sub(right.b, left.b), d)
}

// --- a small solver: named quantities tied by the shape's theorems ----------------------------------------

type Rel =
  | { k: 'eq'; a: string; b: string }
  | { k: 'sum'; terms: string[]; total: number }
  | { k: 'twice'; whole: string; half: string }
  | { k: 'split'; whole: string; parts: string[] }

function solveSystem(given: Map<string, Lin>, rels: Rel[]): { x: Q; known: Map<string, Lin> } {
  const known = new Map(given)
  const eqs: [Lin, Lin][] = []
  const used = new Set<number>()
  let changed = true
  while (changed) {
    changed = false
    rels.forEach((rel, i) => {
      if (used.has(i)) return
      if (rel.k === 'eq') {
        const A = known.get(rel.a)
        const B = known.get(rel.b)
        if (A && B) {
          eqs.push([A, B])
          used.add(i)
        } else if (A) known.set(rel.b, A)
        else if (B) known.set(rel.a, B)
        else return
        changed = true
        used.add(i)
        return
      }
      if (rel.k === 'twice') {
        const W = known.get(rel.whole)
        const H = known.get(rel.half)
        if (W && H) eqs.push([W, lscale(q(2), H)])
        else if (H) known.set(rel.whole, lscale(q(2), H))
        else if (W) known.set(rel.half, lscale(q(1, 2), W))
        else return
        changed = true
        used.add(i)
        return
      }
      // sum: terms add to total; split: parts add to whole (a sum with a variable total).
      const terms = rel.k === 'sum' ? rel.terms : rel.parts
      const totalKnown = rel.k === 'sum' ? lc(rel.total) : known.get(rel.whole)
      const missing = terms.filter((t) => !known.has(t))
      if (rel.k === 'split' && !totalKnown) {
        if (missing.length === 0) {
          known.set(rel.whole, terms.reduce((s, t) => ladd(s, known.get(t)!), lc(0)))
          changed = true
          used.add(i)
        }
        return
      }
      const have = terms.filter((t) => known.has(t)).reduce((s, t) => ladd(s, known.get(t)!), lc(0))
      if (missing.length === 0) {
        eqs.push([have, totalKnown!])
        changed = true
        used.add(i)
      } else if (missing.length === 1) {
        known.set(missing[0]!, lsub(totalKnown!, have))
        changed = true
        used.add(i)
      }
    })
  }
  let x: Q | null = null
  for (const [l, r] of eqs) {
    const d = lsub(l, r)
    if (isZero(d.a)) {
      if (!isZero(d.b)) throw new Error('the givens contradict each other')
      continue
    }
    const v = div(q(-d.b.n, d.b.d), d.a)
    if (x && !same(x, v)) throw new Error(`two different values of x: ${text(x)} and ${text(v)}`)
    x = v
  }
  if (!x) throw new Error('x is not determined')
  return { x, known }
}

// --- reading the prompt and the figure ------------------------------------------------------------------------

function load(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

/** Givens such as "PQ = 3x + 5" and "m∠PQT = (2x + 4)°", from the sentences before "Find". */
function givens(prompt: string): Map<string, Lin> {
  const body = prompt.split('Find x')[0]!
  const out = new Map<string, Lin>()
  for (const m of body.matchAll(/m∠([A-Z]{1,3}) = \(?([0-9x+−\- ]+?)\)?°/g)) out.set(`∠${m[1]}`, parseLin(m[2]!))
  for (const m of body.matchAll(/(?<![∠A-Za-z])([A-Z]{2}) = ([0-9x+−\- ]+?)(?=,|\.| and |$)/g)) out.set(m[1]!, parseLin(m[2]!))
  return out
}

function asked(prompt: string): string {
  const m = /Find x, then (m∠[A-Z]{1,3}|[A-Z]{2})\.$/.exec(prompt)
  if (!m) throw new Error(`no asked part: ${prompt}`)
  return m[1]!.startsWith('m∠') ? `∠${m[1]!.slice(2)}` : m[1]!
}

type P = { x: number; y: number }
function pointOf(fig: GeoFigureSpec, id: string): P {
  const p = fig.points.find((pt) => pt.id === id)
  if (!p) throw new Error(`no point ${id}`)
  return p
}
const vsub = (a: P, b: P): P => ({ x: a.x - b.x, y: a.y - b.y })
const cross = (a: P, b: P) => a.x * b.y - a.y * b.x
const dot = (a: P, b: P) => a.x * b.x + a.y * b.y
const len = (a: P) => Math.hypot(a.x, a.y)
function angleDeg(v: P, a: P, b: P): number {
  const u = vsub(a, v)
  const w = vsub(b, v)
  return (Math.acos(Math.max(-1, Math.min(1, dot(u, w) / (len(u) * len(w))))) * 180) / Math.PI
}

/** A real quadrilateral: strictly convex, every angle well away from 0 and 180, angle sum 360. */
function realQuad(c: P[]): string | null {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const t = cross(vsub(c[(i + 1) % 4]!, c[i]!), vsub(c[(i + 2) % 4]!, c[(i + 1) % 4]!))
    if (Math.abs(t) < 1e-6) return 'three vertices in a line'
    if (sign === 0) sign = Math.sign(t)
    else if (Math.sign(t) !== sign) return 'not convex, or the outline crosses itself'
  }
  const angles = [0, 1, 2, 3].map((i) => angleDeg(c[i]!, c[(i + 3) % 4]!, c[(i + 1) % 4]!))
  if (angles.some((g) => g < 20 || g > 160)) return `an angle of ${angles.map((g) => g.toFixed(0)).join(', ')}`
  if (Math.abs(angles.reduce((s, g) => s + g, 0) - 360) > 0.01) return 'angles do not add to 360'
  return null
}

/** Vertex letters in order from "parallelogram PQRS", "quadrilateral PQRS", and the like. */
function quadName(prompt: string, word: string): string[] {
  const m = new RegExp(`${word} ([A-Z]{4})\\b`).exec(prompt)
  if (!m) throw new Error(`no ${word} in: ${prompt}`)
  return m[1]!.split('')
}

/** The crossing point of the diagonals named in "meet at T". */
function crossingName(prompt: string): string | null {
  return /meet at ([A-Z])\b/.exec(prompt)?.[1] ?? null
}

interface Check {
  where: string
  problems: string[]
}
function fail(c: Check, msg: string): void {
  c.problems.push(`${c.where}: ${msg}`)
}

/** The stage answers must be what the re-solve found, and every promised slip must grade as itself. */
function checkAnswers(c: Check, a: GeometryAnswer, x: Q | null, result: Q | null): void {
  for (const stage of a.stages) {
    const g = gradeGeoStage(a, stage.id, stage.answerText)
    if (g.verdict !== 'correct') fail(c, `${stage.id} answer ${stage.answerText} grades ${g.verdict}`)
  }
  const xs = a.stages.find((s) => s.id === 'x')
  if (x && xs && xs.answerText !== text(x)) fail(c, `x is ${text(x)}, the problem says ${xs.answerText}`)
  const rs = a.stages.find((s) => s.id === 'result')
  if (result && rs && rs.answerText !== text(result)) fail(c, `the measure is ${text(result)}, the problem says ${rs.answerText}`)
  const t = gradeGeoStage(a, a.trapStage, a.trapAnswer)
  if (t.verdict !== 'mistake' || t.mistake !== a.trap) fail(c, `promised ${a.trap} grades ${t.verdict}`)
}

/** Each trap's value must be one this slip really produces here. */
function checkSlips(c: Check, a: GeometryAnswer, slips: Map<string, Set<string>>): void {
  for (const stage of a.stages) {
    for (const trap of stage.traps) {
      const key = `${stage.id}:${trap.id}`
      const allowed = slips.get(key)
      if (!allowed) fail(c, `${key} is named, but no such slip exists on this problem`)
      else if (!allowed.has(trap.text)) fail(c, `${key} is ${trap.text}; the slip gives ${[...allowed].join(' or ')}`)
    }
  }
}

function slip(map: Map<string, Set<string>>, key: string, v: Q | null): void {
  if (!v) return
  const set = map.get(key) ?? new Set<string>()
  set.add(text(v))
  map.set(key, set)
}

// --- gq.props: the parallelogram ------------------------------------------------------------------------------

/** Name a part of quadrilateral `v` (letters in order) with crossing `T`: side i, angle i, half i, or diagonal 0 or 1. */
function partOf(v: string[], T: string | null, name: string): string {
  const k = (ch: string) => v.indexOf(ch)
  if (name.startsWith('∠')) {
    const body = name.slice(1)
    if (body.length === 1) return `a${k(body)}`
    const [p, m, r] = body.split('') as [string, string, string]
    if (m === T) return `apex${[k(p), k(r)].sort().join('')}`
    const others = [k(p), k(r)]
    if (p === T || r === T) {
      const nb = p === T ? k(r) : k(p)
      return `part${k(m)}-${nb}`
    }
    if (others.every((o) => o >= 0)) return `a${k(m)}`
    throw new Error(`angle ${name}`)
  }
  const [p, r] = name.split('') as [string, string]
  if (p === T || r === T) return `h${k(p === T ? r : p)}`
  const i = k(p)
  const j = k(r)
  if ((i + 1) % 4 === j) return `s${i}`
  if ((j + 1) % 4 === i) return `s${j}`
  return `d${Math.min(i, j) % 2}`
}

function pgramRels(): Rel[] {
  const rels: Rel[] = []
  for (let i = 0; i < 2; i++) {
    rels.push({ k: 'eq', a: `s${i}`, b: `s${i + 2}` }, { k: 'eq', a: `a${i}`, b: `a${i + 2}` }, { k: 'eq', a: `h${i}`, b: `h${i + 2}` }, { k: 'twice', whole: `d${i}`, half: `h${i}` })
  }
  for (let i = 0; i < 4; i++) rels.push({ k: 'sum', terms: [`a${i}`, `a${(i + 1) % 4}`], total: 180 })
  return rels
}

function solveProps(a: GeometryAnswer, c: Check): void {
  const v = quadName(a.prompt, 'parallelogram')
  const T = crossingName(a.prompt)
  const given = new Map<string, Lin>()
  for (const [name, e] of givens(a.prompt)) given.set(partOf(v, T, name), e)
  const ask = partOf(v, T, asked(a.prompt))
  const { x, known } = solveSystem(given, pgramRels())
  const value = known.get(ask)
  if (!value) return fail(c, `cannot find ${ask}`)
  const result = at(value, x)
  checkAnswers(c, a, x, result)
  // A real parallelogram: every given positive, the angles between 0 and 180 adding to 360.
  for (const [k, e] of given) if (num(at(e, x)) <= 0) fail(c, `${k} is not positive at x = ${text(x)}`)
  const angles = [0, 1, 2, 3].map((i) => known.get(`a${i}`))
  if (angles.every(Boolean)) {
    const vals = angles.map((e) => num(at(e!, x)))
    if (vals.some((g) => g <= 0 || g >= 180) || Math.abs(vals.reduce((s, g) => s + g, 0) - 360) > 1e-9) fail(c, `angles ${vals.join(', ')}`)
    for (let i = 0; i < 4; i++) if (Math.abs(vals[i]! + vals[(i + 1) % 4]! - 180) > 1e-9) fail(c, 'consecutive angles are not supplementary')
  }
  // The drawing is a parallelogram that agrees with the given measures.
  const corners = v.map((id) => pointOf(a.figure, id))
  const bad = realQuad(corners)
  if (bad) fail(c, `figure: ${bad}`)
  for (let i = 0; i < 2; i++) {
    const s1 = vsub(corners[i + 1]!, corners[i]!)
    const s2 = vsub(corners[(i + 3) % 4]!, corners[i + 2]!)
    if (Math.abs(cross(s1, s2)) / (len(s1) * len(s2)) > 0.01) fail(c, 'figure: opposite sides are not parallel')
  }
  for (const [k, e] of given) {
    if (k.startsWith('a')) {
      const i = Number(k.slice(1))
      const drawn = angleDeg(corners[i]!, corners[(i + 3) % 4]!, corners[(i + 1) % 4]!)
      if (Math.abs(drawn - num(at(e, x))) > 1.5) fail(c, `figure: angle ${v[i]} is drawn ${drawn.toFixed(1)}, given ${text(at(e, x))}`)
    }
  }
  if (T) {
    const t = pointOf(a.figure, T)
    const h = [0, 1, 2, 3].map((i) => len(vsub(corners[i]!, t)))
    if (Math.abs(h[0]! - h[2]!) > 0.05 * h[0]! || Math.abs(h[1]! - h[3]!) > 0.05 * h[1]!) fail(c, 'figure: the crossing is not the midpoint of each diagonal')
    const k0 = known.get('h0')
    const k1 = known.get('h1')
    if (k0 && k1) {
      const want = num(at(k0, x)) / num(at(k1, x))
      if (Math.abs(h[0]! / h[1]! - want) > 0.03 * want) fail(c, 'figure: the half-diagonals are not drawn to the given lengths')
    }
  }
  // Every named slip, recomputed from what that slip does with these givens.
  const slips = new Map<string, Set<string>>()
  const g = [...given.entries()]
  for (let i = 0; i < g.length; i++) {
    for (let j = i + 1; j < g.length; j++) {
      const [ka, ea] = g[i]!
      const [kb, eb] = g[j]!
      const ia = Number(ka.slice(1))
      const ib = Number(kb.slice(1))
      if (ka[0] === 's' && kb[0] === 's' && (ia + ib) % 2 === 1) slip(slips, 'x:geo_parallelogram_as_rhombus', meet(ea, eb))
      if (ka[0] === 'a' && kb[0] === 'a') {
        if ((ia + ib) % 2 === 0) slip(slips, 'x:geo_opposite_angles_supplementary', meet(ladd(ea, eb), lc(180)))
        else slip(slips, 'x:geo_consecutive_angles_equal', meet(ea, eb))
      }
      if (ka[0] === 'h' && kb[0] === 'h' && (ia + ib) % 2 === 1) slip(slips, 'x:geo_diagonals_assumed_congruent', meet(ea, eb))
      const halfWhole = (kh: string, kd: string) => kh[0] === 'h' && kd[0] === 'd' && Number(kh.slice(1)) % 2 === Number(kd.slice(1))
      if (halfWhole(ka, kb)) slip(slips, 'x:geo_diagonal_half_as_whole', meet(ea, eb))
      if (halfWhole(kb, ka)) slip(slips, 'x:geo_diagonal_half_as_whole', meet(eb, ea))
    }
  }
  slip(slips, 'result:geo_answered_x', x)
  const ai = Number(ask.slice(1))
  if (ask[0] === 's') for (const nb of [(ai + 1) % 4, (ai + 3) % 4]) slip(slips, 'result:geo_parallelogram_as_rhombus', known.has(`s${nb}`) ? at(known.get(`s${nb}`)!, x) : null)
  if (ask[0] === 'a') for (const nb of [(ai + 1) % 4, (ai + 3) % 4]) slip(slips, 'result:geo_consecutive_angles_equal', known.has(`a${nb}`) ? at(known.get(`a${nb}`)!, x) : null)
  if (ask[0] === 'd') slip(slips, 'result:geo_diagonal_half_as_whole', at(known.get(`h${ai}`)!, x))
  if (ask[0] === 'h') slip(slips, 'result:geo_diagonal_half_as_whole', at(known.get(`d${ai % 2}`)!, x))
  checkSlips(c, a, slips)
}

// --- gq.prove: which test the marks give, and a counterexample when none does ---------------------------------

type ProveFact = { par: [number, number][]; cong: [number, number][]; ang: [number, number][]; half: [number, number][]; T: boolean }

/** The facts the figure marks: pairs of sides with matching arrows or ticks, angles with matching arcs, halves with matching ticks. */
function markedFacts(fig: GeoFigureSpec, v: string[]): ProveFact {
  const sideIndex = (a: string, b: string) => {
    const i = v.indexOf(a)
    const j = v.indexOf(b)
    if (i < 0 || j < 0) return -1
    if ((i + 1) % 4 === j) return i
    if ((j + 1) % 4 === i) return j
    return -1
  }
  const pairsBy = <T,>(items: { key: T; n: number }[]): [T, T][] => {
    const out: [T, T][] = []
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (items[i]!.n === items[j]!.n) out.push([items[i]!.key, items[j]!.key])
    return out
  }
  const arrows = (fig.lines ?? []).filter((l) => l.arrows).map((l) => ({ key: sideIndex(l.through[0], l.through[1]), n: l.arrows! }))
  const ticksSide: { key: number; n: number }[] = []
  const ticksHalf: { key: number; n: number }[] = []
  const T = fig.points.find((p) => !v.includes(p.id))?.id ?? null
  for (const s of fig.segments ?? []) {
    if (!s.ticks) continue
    const i = sideIndex(s.from, s.to)
    if (i >= 0) ticksSide.push({ key: i, n: s.ticks })
    else if (T && (s.from === T || s.to === T)) ticksHalf.push({ key: v.indexOf(s.from === T ? s.to : s.from), n: s.ticks })
    else throw new Error(`tick on ${s.from}${s.to}`)
  }
  const arcs = (fig.angles ?? []).filter((g) => g.marks && !g.right && !g.label).map((g) => ({ key: v.indexOf(g.vertex), n: g.marks! }))
  return { par: pairsBy(arrows), cong: pairsBy(ticksSide), ang: pairsBy(arcs), half: pairsBy(ticksHalf), T: Boolean(T) }
}

const hasPair = (pairs: [number, number][], i: number, j: number) => pairs.some(([a, b]) => (a === i && b === j) || (a === j && b === i))

/** Which of the five ways the marks give, directly. */
function directTests(f: ProveFact): string[] {
  const out: string[] = []
  if (hasPair(f.par, 0, 2) && hasPair(f.par, 1, 3)) out.push('parallel')
  if (hasPair(f.cong, 0, 2) && hasPair(f.cong, 1, 3)) out.push('sides')
  if ((hasPair(f.par, 0, 2) && hasPair(f.cong, 0, 2)) || (hasPair(f.par, 1, 3) && hasPair(f.cong, 1, 3))) out.push('onePair')
  if (hasPair(f.ang, 0, 2) && hasPair(f.ang, 1, 3)) out.push('angles')
  if (hasPair(f.half, 0, 2) && hasPair(f.half, 1, 3)) out.push('diagonals')
  return out
}

/** Does this concrete quadrilateral (corners in order) carry every marked fact? */
function carries(c: P[], f: ProveFact): boolean {
  const side = (i: number) => vsub(c[(i + 1) % 4]!, c[i]!)
  const eps = 1e-9
  for (const [i, j] of f.par) if (Math.abs(cross(side(i), side(j))) > eps * len(side(i)) * len(side(j))) return false
  for (const [i, j] of f.cong) if (Math.abs(len(side(i)) - len(side(j))) > 1e-9) return false
  for (const [i, j] of f.ang) {
    const g = (k: number) => angleDeg(c[k]!, c[(k + 3) % 4]!, c[(k + 1) % 4]!)
    if (Math.abs(g(i) - g(j)) > 1e-7) return false
  }
  if (f.half.length) {
    const r = vsub(c[2]!, c[0]!)
    const s = vsub(c[3]!, c[1]!)
    const t = cross(vsub(c[1]!, c[0]!), s) / cross(r, s)
    const X = { x: c[0]!.x + t * r.x, y: c[0]!.y + t * r.y }
    for (const [i, j] of f.half) if (Math.abs(len(vsub(c[i]!, X)) - len(vsub(c[j]!, X))) > 1e-9) return false
  }
  return true
}

function isPgram(c: P[]): boolean {
  const side = (i: number) => vsub(c[(i + 1) % 4]!, c[i]!)
  return [0, 1].every((i) => Math.abs(cross(side(i), side(i + 2))) < 1e-9 * len(side(i)) * len(side(i + 2)))
}

/** Shapes that are not parallelograms, each read with its letters starting at any corner and going either way. */
const NOT_PGRAMS: P[][] = [
  [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 7, y: 4 }, { x: 3, y: 4 }],
  [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 6, y: 4 }, { x: 1, y: 4 }],
  [{ x: 0, y: 0 }, { x: 3, y: -3 }, { x: 10, y: 0 }, { x: 3, y: 3 }],
  [{ x: 0, y: 0 }, { x: 9, y: 0 }, { x: 8, y: 5 }, { x: 2, y: 3 }],
]
function counterexample(f: ProveFact): boolean {
  for (const shape of NOT_PGRAMS) {
    for (let start = 0; start < 4; start++) {
      for (const dir of [1, -1]) {
        const c = [0, 1, 2, 3].map((k) => shape[(((start + dir * k) % 4) + 4) % 4]!)
        if (!isPgram(c) && carries(c, f)) return true
      }
    }
  }
  return false
}

/** Every mark the figure draws, one item each, with segment names in a fixed letter order. */
function drawnMarks(fig: GeoFigureSpec): string[] {
  const key = (a: string, b: string) => [a, b].sort().join('')
  const out: string[] = []
  for (const l of fig.lines ?? []) if (l.arrows) out.push(`arrow${l.arrows}:${key(l.through[0], l.through[1])}`)
  for (const s of fig.segments ?? []) if (s.ticks) out.push(`tick${s.ticks}:${key(s.from, s.to)}`)
  for (const g of fig.angles ?? []) {
    if (g.right) out.push(`right:${g.vertex}`)
    else if (g.marks && !g.label) out.push(`arc${g.marks}:${g.vertex}`)
  }
  return out.sort()
}

/** The same items, read from the words a screen reader says. */
function describedMarks(aria: string, v: string[], T: string | null): string[] {
  const key = (a: string, b: string) => [a, b].sort().join('')
  const out: string[] = []
  for (const m of aria.matchAll(/Sides ([A-Z])([A-Z]) and ([A-Z])([A-Z]) have (\d) (arrow|tick)s? each/g)) {
    out.push(`${m[6]}${m[5]}:${key(m[1]!, m[2]!)}`, `${m[6]}${m[5]}:${key(m[3]!, m[4]!)}`)
  }
  for (const m of aria.matchAll(/All four sides have (\d) ticks?/g)) for (let i = 0; i < 4; i++) out.push(`tick${m[1]}:${key(v[i]!, v[(i + 1) % 4]!)}`)
  for (const m of aria.matchAll(/Angles ([A-Z]) and ([A-Z]) have (\d) arcs? each/g)) out.push(`arc${m[3]}:${m[1]}`, `arc${m[3]}:${m[2]}`)
  if (/All four angles are marked as right angles/.test(aria)) for (const id of v) out.push(`right:${id}`)
  for (const m of aria.matchAll(/Angle ([A-Z]) is marked as a right angle/g)) out.push(`right:${m[1]}`)
  for (const m of aria.matchAll(/Segments ([A-Z])([A-Z]) and ([A-Z])([A-Z]) have (\d) ticks? each/g)) {
    out.push(`tick${m[5]}:${key(m[1]!, m[2]!)}`, `tick${m[5]}:${key(m[3]!, m[4]!)}`)
  }
  for (const m of aria.matchAll(/All four segments from ([A-Z]) to a vertex have (\d) ticks?/g)) for (const id of v) out.push(`tick${m[2]}:${key(id, m[1]!)}`)
  if (T && new RegExp(`The diagonals are marked perpendicular at ${T}`).test(aria)) out.push(`right:${T}`)
  return out.sort()
}

/** The figure draws exactly the marks its description gives, and the description gives exactly the marks drawn. */
function marksAgree(c: Check, a: GeometryAnswer, v: string[]): void {
  const T = a.figure.points.find((p) => !v.includes(p.id))?.id ?? null
  const drawn = drawnMarks(a.figure)
  const said = describedMarks(a.figure.ariaLabel, v, T)
  if (drawn.join(' ') !== said.join(' ')) fail(c, `the figure draws [${drawn.join(' ')}] but its description says [${said.join(' ')}]`)
}

function solveProve(a: GeometryAnswer, c: Check): void {
  const v = quadName(a.prompt, 'quadrilateral')
  marksAgree(c, a, v)
  const f = markedFacts(a.figure, v)
  const direct = directTests(f)
  const stage = a.stages[0]!
  const want = direct.length === 1 ? direct[0]! : direct.length === 0 ? 'none' : 'two tests'
  if (want === 'two tests') return fail(c, `the marks give ${direct.join(' and ')}`)
  if (stage.answerText !== want) fail(c, `the marks give ${want}; the answer is ${stage.answerText}`)
  if (want === 'none' && !counterexample(f)) fail(c, 'no quadrilateral that is not a parallelogram carries these marks, so they may prove it')
  // The drawing carries every mark it shows.
  const corners = v.map((id) => pointOf(a.figure, id))
  const bad = realQuad(corners)
  if (bad) fail(c, `figure: ${bad}`)
  const side = (i: number) => vsub(corners[(i + 1) % 4]!, corners[i]!)
  for (const [i, j] of f.par) if (Math.abs(cross(side(i), side(j))) / (len(side(i)) * len(side(j))) > 0.01) fail(c, `figure: sides ${i} and ${j} are marked parallel but are not`)
  for (const [i, j] of f.cong) if (Math.abs(len(side(i)) - len(side(j))) > 0.02 * len(side(i))) fail(c, `figure: sides ${i} and ${j} are marked congruent but are not`)
  for (const [i, j] of f.ang) {
    const g = (k: number) => angleDeg(corners[k]!, corners[(k + 3) % 4]!, corners[(k + 1) % 4]!)
    if (Math.abs(g(i) - g(j)) > 1) fail(c, `figure: angles ${i} and ${j} are marked congruent but are not`)
  }
  // Named slips: each pick that is named must be that slip on these marks.
  for (const trap of stage.traps) {
    const pick = trap.text
    const ok =
      trap.id === 'geo_parallelogram_test_missed'
        ? pick === 'none' && direct.length === 1
        : trap.id === 'geo_parallel_congruent_mixed'
          ? pick === 'onePair' && ((hasPair(f.par, 0, 2) && hasPair(f.cong, 1, 3)) || (hasPair(f.par, 1, 3) && hasPair(f.cong, 0, 2)))
          : trap.id === 'geo_one_pair_half_test'
            ? ['onePair', 'sides', 'parallel'].includes(pick) && f.par.length + f.cong.length === 1 && f.ang.length === 0 && f.half.length === 0
            : trap.id === 'geo_consecutive_marks_as_opposite'
              ? pick === 'angles' && f.ang.length > 0 && f.ang.every(([i, j]) => (i + j) % 2 === 1)
              : trap.id === 'geo_one_diagonal_bisected'
                ? pick === 'diagonals' && f.half.length === 1
                : false
    if (!ok) fail(c, `${trap.id} on ${pick} is not that slip on these marks`)
  }
  checkAnswers(c, a, null, null)
}

// --- gq.coords: slopes, lengths, and midpoints from the prompt's vertices ---------------------------------------

function vertices(prompt: string): { ids: string[]; pts: P[] } {
  const ids: string[] = []
  const pts: P[] = []
  for (const m of prompt.matchAll(/([A-Z])\((−?\d+), (−?\d+)\)/g)) {
    ids.push(m[1]!)
    pts.push({ x: Number(m[2]!.replace('−', '-')), y: Number(m[3]!.replace('−', '-')) })
  }
  if (ids.length !== 4) throw new Error(`vertices: ${prompt}`)
  return { ids, pts }
}

function slopeQ(a: P, b: P): Q | null {
  return b.x === a.x ? null : q(b.y - a.y, b.x - a.x)
}

/** √n in simplest radical form, written as the reader writes it: "3√5", "√29", "7". */
function radical(n: number): string {
  let k = 1
  let r = n
  for (let f = 2; f * f <= r; f++) {
    while (r % (f * f) === 0) {
      r /= f * f
      k *= f
    }
  }
  return r === 1 ? `${k}` : k === 1 ? `√${r}` : `${k}√${r}`
}

function pointText(xq: Q, yq: Q): string {
  return `(${text(xq)}, ${text(yq)})`
}

function solveCoords(a: GeometryAnswer, c: Check): void {
  const { ids, pts } = vertices(a.prompt)
  const name = ids.join('')
  const at4 = (id: string) => pts[ids.indexOf(id)]!
  for (const id of ids) {
    const drawn = pointOf(a.figure, id)
    const want = at4(id)
    if (drawn.x !== want.x || drawn.y !== want.y) fail(c, `figure: ${id} is drawn at (${drawn.x}, ${drawn.y})`)
  }
  const bad = realQuad(pts)
  if (bad) fail(c, `figure: ${bad}`)
  const slopes = new Map<string, Q | null>()
  const lens = new Map<string, number>()
  const slips = new Map<string, Set<string>>()
  for (const stage of a.stages) {
    const slopeM = /^Slope of ([A-Z])([A-Z])$/.exec(stage.label)
    const lenM = /^([A-Z])([A-Z])$/.exec(stage.label)
    const midM = /^Midpoint of ([A-Z])([A-Z])$/.exec(stage.label)
    if (slopeM) {
      const [p, r] = [at4(slopeM[1]!), at4(slopeM[2]!)]
      const s = slopeQ(p, r)
      slopes.set(`${slopeM[1]}${slopeM[2]}`, s)
      if (!s || stage.answerText !== text(s)) fail(c, `slope of ${slopeM[1]}${slopeM[2]} is ${s ? text(s) : 'undefined'}, the answer is ${stage.answerText}`)
      if (s && s.d === 1n) fail(c, `slope ${text(s)} is a whole number and could be read off a coordinate`)
      if (r.y !== p.y) slip(slips, `${stage.id}:geo_slope_inverted`, q(r.x - p.x, r.y - p.y))
    } else if (lenM) {
      const [p, r] = [at4(lenM[1]!), at4(lenM[2]!)]
      const sq = (r.x - p.x) ** 2 + (r.y - p.y) ** 2
      lens.set(`${lenM[1]}${lenM[2]}`, sq)
      if (stage.answerText !== radical(sq)) fail(c, `${lenM[0]} is ${radical(sq)}, the answer is ${stage.answerText}`)
      if (!radical(sq).includes('√')) fail(c, `${lenM[0]} is a whole number and could be read off a coordinate`)
      slip(slips, `${stage.id}:geo_distance_no_root`, q(sq))
      slip(slips, `${stage.id}:geo_distance_not_squared`, q(Math.abs(r.x - p.x) + Math.abs(r.y - p.y)))
    } else if (midM) {
      const [p, r] = [at4(midM[1]!), at4(midM[2]!)]
      const want = pointText(q(p.x + r.x, 2), q(p.y + r.y, 2))
      if (stage.answerText !== want) fail(c, `midpoint of ${midM[1]}${midM[2]} is ${want}, the answer is ${stage.answerText}`)
      const key = `${stage.id}:geo_midpoint_subtracted`
      const set = slips.get(key) ?? new Set<string>()
      set.add(pointText(q(r.x - p.x, 2), q(r.y - p.y, 2)))
      slips.set(key, set)
    }
  }
  // What the values show, decided from the values alone.
  const final = a.stages[a.stages.length - 1]!
  const chosen = final.choices?.find((ch) => ch.id === final.answerText)?.text ?? ''
  const side = (i: number) => `${ids[i]}${ids[(i + 1) % 4]}`
  const parallelPair = (i: number) => {
    const s1 = slopes.get(side(i))
    const s2 = slopes.get(side(i + 2))
    return s1 !== undefined && s2 !== undefined && s1 && s2 && same(s1, s2)
  }
  const congPair = (i: number) => lens.has(side(i)) && lens.get(side(i)) === lens.get(side(i + 2))
  let want = ''
  if (slopes.size === 4) {
    const n = [0, 1].filter(parallelPair).length
    want = n === 2 ? `Both pairs of opposite sides are parallel, so ${name} is a parallelogram.` : n === 1 ? `Only one pair of opposite sides is parallel, so ${name} is not a parallelogram.` : `Neither pair of opposite sides is parallel, so ${name} is not a parallelogram.`
  } else if (lens.size === 4) {
    const n = [0, 1].filter(congPair).length
    want = n === 2 ? `Both pairs of opposite sides are congruent, so ${name} is a parallelogram.` : n === 1 ? `Only one pair of opposite sides is congruent, so ${name} is not a parallelogram.` : `Neither pair of opposite sides is congruent, so ${name} is not a parallelogram.`
  } else if (slopes.size === 2 && lens.size === 2) {
    // One pair has equal slopes and the other pair equal lengths: that is not one of the five ways.
    const pPair = [0, 1].find(parallelPair)
    const cPair = [0, 1].find(congPair)
    if (pPair === undefined || cPair === undefined || pPair === cPair) fail(c, 'the four values are not one pair parallel and the other congruent')
    want = `These values do not prove that ${name} is a parallelogram.`
    if (isPgram(pts)) fail(c, 'the figure is a parallelogram after all')
  } else {
    const m1 = a.stages[0]!.answerText
    const m2 = a.stages[1]!.answerText
    want = m1 === m2 ? `The diagonals have the same midpoint, so they bisect each other and ${name} is a parallelogram.` : `The diagonals have different midpoints, so they do not bisect each other and ${name} is not a parallelogram.`
  }
  if (chosen !== want) fail(c, `the values show “${want}”, the answer is “${chosen}”`)
  for (const ch of final.choices ?? []) {
    if (!ch.trap) continue
    const okTrap =
      (ch.trap === 'geo_one_pair_half_test' && /^One pair of opposite sides is (parallel|congruent), so .* is a parallelogram\.$/.test(ch.text)) ||
      (ch.trap === 'geo_parallel_congruent_mixed' && /^One pair of opposite sides is parallel and the other pair is congruent/.test(ch.text) && slopes.size === 2)
    if (!okTrap) fail(c, `${ch.trap} on “${ch.text}” is not that slip`)
    slip(slips, `${final.id}:${ch.trap}`, null)
    const key = `${final.id}:${ch.trap}`
    const set = slips.get(key) ?? new Set<string>()
    set.add(ch.id)
    slips.set(key, set)
  }
  checkSlips(c, a, slips)
  checkAnswers(c, a, null, null)
}

// --- gs.props: rectangles, rhombuses, and squares -------------------------------------------------------------

/**
 * Quantities: h0..h3 (half-diagonals from each vertex), d0 and d1 (the diagonals), part i-j (the angle at vertex i
 * between the side to vertex j and the diagonal), a0..a3 (the corners), apex ij (the angle at the crossing over side ij).
 */
function specialRels(shape: string): Rel[] {
  const rels: Rel[] = []
  const nb = (i: number, d: number) => (((i + d) % 4) + 4) % 4
  for (let i = 0; i < 2; i++) rels.push({ k: 'eq', a: `h${i}`, b: `h${i + 2}` }, { k: 'twice', whole: `d${i}`, half: `h${i}` }, { k: 'eq', a: `a${i}`, b: `a${i + 2}` })
  for (let i = 0; i < 4; i++) {
    rels.push({ k: 'split', whole: `a${i}`, parts: [`part${i}-${nb(i, 1)}`, `part${i}-${nb(i, -1)}`] })
    rels.push({ k: 'sum', terms: [`a${i}`, `a${nb(i, 1)}`], total: 180 })
    const apex = `apex${[i, nb(i, 1)].sort().join('')}`
    rels.push({ k: 'sum', terms: [`part${i}-${nb(i, 1)}`, `part${nb(i, 1)}-${i}`, apex], total: 180 })
  }
  const rect = shape === 'rectangle' || shape === 'square'
  const rhombus = shape === 'rhombus' || shape === 'square'
  if (rect) {
    rels.push({ k: 'eq', a: 'h0', b: 'h1' }, { k: 'eq', a: 'd0', b: 'd1' })
    for (let i = 0; i < 4; i++) {
      rels.push({ k: 'sum', terms: [`a${i}`], total: 90 })
      // The crossing is the same distance from both ends of a side, so the triangle there is isosceles.
      rels.push({ k: 'eq', a: `part${i}-${nb(i, 1)}`, b: `part${nb(i, 1)}-${i}` })
    }
  }
  if (rhombus) {
    for (let i = 0; i < 4; i++) {
      rels.push({ k: 'eq', a: `part${i}-${nb(i, 1)}`, b: `part${i}-${nb(i, -1)}` })
      rels.push({ k: 'sum', terms: [`apex${[i, nb(i, 1)].sort().join('')}`], total: 90 })
    }
  }
  return rels
}

function solveSpecial(a: GeometryAnswer, c: Check): void {
  const m = /^In (rectangle|rhombus|square) ([A-Z]{4}), the diagonals meet at ([A-Z])/.exec(a.prompt) ?? /^([A-Z]{4}) is a (rectangle|rhombus|square), and its diagonals meet at ([A-Z])/.exec(a.prompt)
  if (!m) return fail(c, `cannot read the shape: ${a.prompt}`)
  const [shape, nameText, T] = /^In/.test(a.prompt) ? [m[1]!, m[2]!, m[3]!] : [m[2]!, m[1]!, m[3]!]
  const v = nameText.split('')
  const given = new Map<string, Lin>()
  for (const [name, e] of givens(a.prompt)) given.set(partOf(v, T, name), e)
  const askText = /Find x\.$/.test(a.prompt) ? null : asked(a.prompt)
  const { x, known } = solveSystem(given, specialRels(shape))
  const ask = askText ? partOf(v, T, askText) : null
  const result = ask ? known.get(ask) : null
  if (ask && !result) return fail(c, `cannot find ${ask}`)
  checkAnswers(c, a, x, result ? at(result, x) : null)
  for (const [k, e] of given) {
    const val = num(at(e, x))
    if (val <= 0 || (k.startsWith('part') && val >= 90)) fail(c, `${k} = ${val} is not a real measure`)
  }
  // The drawing is that shape, and the labeled angles are drawn to their values.
  const corners = v.map((id) => pointOf(a.figure, id))
  const bad = realQuad(corners)
  if (bad) fail(c, `figure: ${bad}`)
  const sides = [0, 1, 2, 3].map((i) => len(vsub(corners[(i + 1) % 4]!, corners[i]!)))
  const right = [0, 1, 2, 3].every((i) => Math.abs(angleDeg(corners[i]!, corners[(i + 3) % 4]!, corners[(i + 1) % 4]!) - 90) < 0.5)
  const equal = Math.max(...sides) - Math.min(...sides) < 0.02 * Math.max(...sides)
  if ((shape !== 'rhombus') !== right) fail(c, `figure: a ${shape} drawn ${right ? 'with' : 'without'} right angles`)
  if ((shape !== 'rectangle') !== equal) fail(c, `figure: a ${shape} drawn ${equal ? 'with' : 'without'} four equal sides`)
  for (const g of a.figure.angles ?? []) {
    if (!g.label) continue
    const label = /\(([^)]+)\)°/.exec(g.label)?.[1] ?? g.label.replace('°', '')
    const drawn = angleDeg(pointOf(a.figure, g.vertex), pointOf(a.figure, g.from), pointOf(a.figure, g.to))
    if (Math.abs(drawn - num(at(parseLin(label), x))) > 1.5) fail(c, `figure: ∠${g.from}${g.vertex}${g.to} drawn ${drawn.toFixed(1)}`)
  }
  // Slips: the other shape's diagonal fact, a half for a whole, the whole corner.
  const slips = new Map<string, Set<string>>()
  const other = shape === 'rectangle' ? 'rhombus' : shape === 'rhombus' ? 'rectangle' : null
  if (other) {
    // Solve again as if the shape were the other one: every x that system gives is the swapped-property slip.
    try {
      const swapped = solveSystem(given, specialRels(other))
      slip(slips, 'x:geo_rect_rhombus_swapped', swapped.x)
    } catch {
      // The other shape's facts may not pin x; then halves of different diagonals set equal is the slip.
    }
    const g = [...given.entries()]
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      const [ka, ea] = g[i]!
      const [kb, eb] = g[j]!
      if (ka[0] === 'h' && kb[0] === 'h' && (Number(ka.slice(1)) + Number(kb.slice(1))) % 2 === 1) slip(slips, 'x:geo_rect_rhombus_swapped', meet(ea, eb))
    }
  }
  const g = [...given.entries()]
  for (let i = 0; i < g.length; i++) for (let j = 0; j < g.length; j++) {
    const [ka, ea] = g[i]!
    const [kb, eb] = g[j]!
    if (ka[0] === 'h' && kb[0] === 'd' && Number(ka.slice(1)) % 2 === Number(kb.slice(1))) slip(slips, 'x:geo_diagonal_half_as_whole', meet(ea, eb))
    if (shape === 'rectangle' && ka[0] === 'h' && kb[0] === 'd') slip(slips, 'x:geo_diagonal_half_as_whole', meet(ea, eb))
  }
  for (const [k, e] of given) if (k.startsWith('part') && shape === 'square') slip(slips, 'x:geo_half_for_whole', meet(e, lc(90)))
  slip(slips, 'result:geo_answered_x', x)
  if (ask?.[0] === 'd') slip(slips, 'result:geo_diagonal_half_as_whole', at(known.get(`h${Number(ask.slice(1))}`)!, x))
  if (ask?.[0] === 'h') slip(slips, 'result:geo_diagonal_half_as_whole', at(known.get(`d${Number(ask.slice(1)) % 2}`)!, x))
  if (ask?.[0] === 'a') {
    const i = Number(ask.slice(1))
    for (const nb of [(i + 1) % 4, (i + 3) % 4]) {
      const part = known.get(`part${i}-${nb}`)
      if (part) slip(slips, 'result:geo_half_for_whole', at(part, x))
    }
  }
  checkSlips(c, a, slips)
}

// --- gz.midseg and gz.isosceles ---------------------------------------------------------------------------------

function solveMidseg(a: GeometryAnswer, c: Check): void {
  const given = givens(a.prompt)
  const ask = asked(a.prompt)
  const rels: Rel[] = []
  let base: string[] = []
  let midseg = ''
  const tri = /^In triangle ([A-Z])([A-Z])([A-Z]), ([A-Z]) is the midpoint of ([A-Z]{2}) and ([A-Z]) is the midpoint of ([A-Z]{2})/.exec(a.prompt)
  const trap = /^([A-Z]{4}) is a trapezoid with bases ([A-Z]{2}) and ([A-Z]{2})\. ([A-Z]) is the midpoint of leg ([A-Z]{2}) and ([A-Z]) is the midpoint of leg ([A-Z]{2})/.exec(a.prompt)
  if (tri) {
    const [, A, B, C, M, AB, N, AC] = tri as unknown as string[]
    if (AB !== `${A}${B}` || AC !== `${A}${C}`) fail(c, 'the midpoints are not on two sides from one vertex')
    midseg = `${M}${N}`
    base = [`${B}${C}`]
    rels.push({ k: 'twice', whole: base[0]!, half: midseg })
    // The figure: M and N are the midpoints, and MN is parallel to BC.
    const [pA, pB, pC, pM, pN] = [A!, B!, C!, M!, N!].map((id) => pointOf(a.figure, id))
    if (len(vsub(pM!, { x: (pA!.x + pB!.x) / 2, y: (pA!.y + pB!.y) / 2 })) > 0.02 || len(vsub(pN!, { x: (pA!.x + pC!.x) / 2, y: (pA!.y + pC!.y) / 2 })) > 0.02) fail(c, 'figure: M or N is not a midpoint')
    if (Math.abs(cross(vsub(pN!, pM!), vsub(pC!, pB!))) > 0.01 * len(vsub(pN!, pM!)) * len(vsub(pC!, pB!))) fail(c, 'figure: the midsegment is not parallel to the base')
  } else if (trap) {
    const [, name, PQ, SR, M, legM, N, legN] = trap as unknown as string[]
    midseg = `${M}${N}`
    base = [PQ!, SR!]
    rels.push({ k: 'split', whole: `2·${midseg}`, parts: base }, { k: 'twice', whole: `2·${midseg}`, half: midseg })
    const pts = name!.split('').map((id) => pointOf(a.figure, id))
    const bad = realQuad(pts)
    if (bad) fail(c, `figure: ${bad}`)
    const s0 = vsub(pts[1]!, pts[0]!)
    const s2 = vsub(pts[2]!, pts[3]!)
    if (Math.abs(cross(s0, s2)) > 0.01 * len(s0) * len(s2)) fail(c, 'figure: the bases are not parallel')
    for (const [mid, leg] of [
      [M!, legM!],
      [N!, legN!],
    ] as const) {
      const [p, r] = [pointOf(a.figure, leg[0]!), pointOf(a.figure, leg[1]!)]
      if (len(vsub(pointOf(a.figure, mid), { x: (p.x + r.x) / 2, y: (p.y + r.y) / 2 })) > 0.02) fail(c, `figure: ${mid} is not the midpoint of ${leg}`)
    }
  } else return fail(c, `cannot read: ${a.prompt}`)
  const { x, known } = solveSystem(given, rels)
  const result = known.get(ask)
  if (!result) return fail(c, `cannot find ${ask}`)
  checkAnswers(c, a, x, at(result, x))
  for (const [k, e] of known) if (num(at(e, x)) <= 0) fail(c, `${k} is not positive`)
  if (trap) {
    // Drawn to scale: the bases in the ratio given.
    const [PQ, SR] = base as [string, string]
    const ratio = num(at(known.get(PQ)!, x)) / num(at(known.get(SR)!, x))
    const drawn = len(vsub(pointOf(a.figure, PQ[1]!), pointOf(a.figure, PQ[0]!))) / len(vsub(pointOf(a.figure, SR[1]!), pointOf(a.figure, SR[0]!)))
    if (Math.abs(drawn - ratio) > 0.03 * ratio) fail(c, `figure: bases drawn ${drawn.toFixed(2)} to 1, given ${ratio.toFixed(2)} to 1`)
  }
  const slips = new Map<string, Set<string>>()
  const g = (name: string) => given.get(name)
  if (tri) {
    const [mn, bc] = [g(midseg), g(base[0]!)]
    if (mn && bc) slip(slips, 'x:geo_midsegment_doubled', meet(mn, lscale(q(2), bc)))
    if (ask === midseg) slip(slips, 'result:geo_midsegment_doubled', at(known.get(base[0]!)!, x))
  } else {
    const [mn, b1, b2] = [g(midseg), g(base[0]!), g(base[1]!)]
    if (mn && b1 && b2) {
      slip(slips, 'x:geo_median_not_halved', meet(mn, ladd(b1, b2)))
      slip(slips, 'x:geo_median_as_base', meet(mn, b1))
      slip(slips, 'x:geo_median_as_base', meet(mn, b2))
    }
  }
  slip(slips, 'result:geo_answered_x', x)
  checkSlips(c, a, slips)
}

function solveIsosceles(a: GeometryAnswer, c: Check): void {
  const given = givens(a.prompt)
  const ask = asked(a.prompt)
  const rels: Rel[] = []
  const slips = new Map<string, Set<string>>()
  const iso = /^(?:In isosceles trapezoid ([A-Z]{4}) with bases ([A-Z]{2}) and ([A-Z]{2}),|([A-Z]{4}) is an isosceles trapezoid with bases ([A-Z]{2}) and ([A-Z]{2})\.)/.exec(a.prompt)
  const kite = /^In kite ([A-Z]{4}), ([A-Z])([A-Z]) ≅ ([A-Z])([A-Z]), ([A-Z])([A-Z]) ≅ ([A-Z])([A-Z]),/.exec(a.prompt)
  let x: Q
  let known: Map<string, Lin>
  if (iso) {
    const name = (iso[1] ?? iso[4])!
    const b1 = (iso[2] ?? iso[5])!
    const b2 = (iso[3] ?? iso[6])!
    const v = name.split('')
    // Angles at the same base are congruent; two angles along a leg add to 180.
    const [p, q1] = b1.split('') as [string, string]
    const [s, r] = b2.split('') as [string, string]
    rels.push({ k: 'eq', a: `∠${p}`, b: `∠${q1}` }, { k: 'eq', a: `∠${s}`, b: `∠${r}` })
    for (let i = 0; i < 4; i++) {
      const u = v[i]!
      const w = v[(i + 1) % 4]!
      const sameBase = (b1.includes(u) && b1.includes(w)) || (b2.includes(u) && b2.includes(w))
      if (!sameBase) rels.push({ k: 'sum', terms: [`∠${u}`, `∠${w}`], total: 180 })
    }
    // Diagonals are congruent, and each is the sum of its pieces.
    const T = crossingName(a.prompt)
    const d1 = `${v[0]}${v[2]}`
    const d2 = `${v[1]}${v[3]}`
    rels.push({ k: 'eq', a: d1, b: d2 })
    if (T) {
      rels.push({ k: 'split', whole: d1, parts: [`${v[0]}${T}`, `${T}${v[2]}`] }, { k: 'split', whole: d2, parts: [`${v[1]}${T}`, `${T}${v[3]}`] })
      for (const [k1, k2] of [
        [`${v[1]}${T}`, `${T}${v[3]}`],
        [`${v[0]}${T}`, `${T}${v[2]}`],
      ] as const) {
        const e1 = given.get(k1)
        const e2 = given.get(k2)
        if (e1 && e2) slip(slips, 'x:geo_trapezoid_as_parallelogram', meet(e1, e2))
      }
    }
    ;({ x, known } = solveSystem(given, rels))
    // Parallelogram rules on these angles: base angles supplementary, opposite angles congruent.
    const ga = [...given.entries()].filter(([k]) => k.startsWith('∠'))
    if (ga.length === 2) {
      const [[k1, e1], [k2, e2]] = ga as [[string, Lin], [string, Lin]]
      const sameBase = (b1.includes(k1[1]!) && b1.includes(k2[1]!)) || (b2.includes(k1[1]!) && b2.includes(k2[1]!))
      const opposite = Math.abs(v.indexOf(k1[1]!) - v.indexOf(k2[1]!)) === 2
      if (sameBase) slip(slips, 'x:geo_trapezoid_as_parallelogram', meet(ladd(e1, e2), lc(180)))
      if (opposite) slip(slips, 'x:geo_trapezoid_as_parallelogram', meet(e1, e2))
    }
    const pts = v.map((id) => pointOf(a.figure, id))
    const bad = realQuad(pts)
    if (bad) fail(c, `figure: ${bad}`)
    const s0 = vsub(pts[1]!, pts[0]!)
    const s2 = vsub(pts[2]!, pts[3]!)
    if (Math.abs(cross(s0, s2)) > 0.01 * len(s0) * len(s2)) fail(c, 'figure: the bases are not parallel')
    if (Math.abs(len(vsub(pts[2]!, pts[1]!)) - len(vsub(pts[0]!, pts[3]!))) > 0.02 * len(vsub(pts[2]!, pts[1]!))) fail(c, 'figure: the legs are not congruent')
  } else if (kite) {
    const [, name, a1, b1, a2, b2, c1, d1, c2, d2] = kite as unknown as string[]
    const v = name!.split('')
    // The vertex shared by each congruent pair is an end of the axis; the congruent angles are at the other two.
    if (a1 !== a2 || c1 !== c2) return fail(c, 'the congruent pairs do not share a vertex')
    const ends = [a1!, c1!]
    const others = v.filter((ch) => !ends.includes(ch))
    if (new Set([b1, b2, d1, d2]).size !== 2 || !others.every((o) => [b1, b2].includes(o))) fail(c, 'the congruent sides do not make a kite')
    rels.push({ k: 'eq', a: `∠${others[0]}`, b: `∠${others[1]}` }, { k: 'sum', terms: v.map((ch) => `∠${ch}`), total: 360 })
    ;({ x, known } = solveSystem(given, rels))
    const ge = given.get(`∠${ends[0]}`)
    const gf = given.get(`∠${ends[1]}`)
    if (ge && gf) slip(slips, 'x:geo_kite_angles_wrong_pair', meet(ge, gf))
    // Asked for one axis end with the other given: taking them equal.
    for (const [e1, e2] of [
      [ends[0]!, ends[1]!],
      [ends[1]!, ends[0]!],
    ]) {
      if (ask === `∠${e1}` && known.has(`∠${e2}`)) slip(slips, 'result:geo_kite_angles_wrong_pair', at(known.get(`∠${e2}`)!, x))
    }
    const pts = v.map((id) => pointOf(a.figure, id))
    const bad = realQuad(pts)
    if (bad) fail(c, `figure: ${bad}`)
    const d = (p: string, r: string) => len(vsub(pointOf(a.figure, p), pointOf(a.figure, r)))
    if (Math.abs(d(a1!, b1!) - d(a2!, b2!)) > 0.02 * d(a1!, b1!) || Math.abs(d(c1!, d1!) - d(c2!, d2!)) > 0.02 * d(c1!, d1!)) fail(c, 'figure: the kite sides are not drawn congruent')
    if (Math.abs(d(a1!, b1!) - d(c1!, d1!)) < 0.05 * d(a1!, b1!)) fail(c, 'figure: the kite is drawn as a rhombus')
  } else return fail(c, `cannot read: ${a.prompt}`)
  const result = known.get(ask)
  if (!result) return fail(c, `cannot find ${ask}`)
  checkAnswers(c, a, x, at(result, x))
  // Real angles that add to 360 and are drawn to their values.
  const angles = [...known.entries()].filter(([k]) => k.startsWith('∠'))
  for (const [k, e] of angles) {
    const val = num(at(e, x))
    if (val <= 0 || val >= 180) fail(c, `${k} = ${val}`)
    const id = k.slice(1)
    const pt = a.figure.points.findIndex((p) => p.id === id)
    if (pt < 0) continue
  }
  for (const g of a.figure.angles ?? []) {
    if (!g.label) continue
    const label = /\(([^)]+)\)°/.exec(g.label)?.[1] ?? g.label.replace('°', '')
    const drawn = angleDeg(pointOf(a.figure, g.vertex), pointOf(a.figure, g.from), pointOf(a.figure, g.to))
    if (Math.abs(drawn - num(at(parseLin(label), x))) > 1.5) fail(c, `figure: angle ${g.vertex} drawn ${drawn.toFixed(1)}`)
  }
  for (const [k, e] of given) if (!k.startsWith('∠') && num(at(e, x)) <= 0) fail(c, `${k} is not positive`)
  slip(slips, 'result:geo_answered_x', x)
  checkSlips(c, a, slips)
}

// --- gs.classify ------------------------------------------------------------------------------------------------

type Name = 'parallelogram' | 'rectangle' | 'rhombus' | 'square' | 'trapezoid' | 'isoTrapezoid' | 'kite' | 'quadrilateral'

/** The most specific name the facts force, read from the sentence. */
function nameFromFacts(facts: string): Name {
  const has = (re: RegExp) => re.test(facts)
  if (has(/is a parallelogram whose diagonals are congruent and perpendicular/)) return 'square'
  if (has(/All four sides of [A-Z]{4} are congruent, and ∠[A-Z] is a right angle/)) return 'square'
  if (has(/is a rectangle with ([A-Z])([A-Z]) ≅ \2[A-Z]\./)) return 'square'
  if (has(/is a rhombus with congruent diagonals/)) return 'square'
  if (has(/is a parallelogram with congruent diagonals/) || has(/diagonals of [A-Z]{4} bisect each other and are congruent/)) return 'rectangle'
  if (has(/is a parallelogram with a right angle/) || has(/All four angles of [A-Z]{4} are right angles/)) return 'rectangle'
  if (has(/is a parallelogram with perpendicular diagonals/) || has(/diagonals of [A-Z]{4} bisect each other and are perpendicular/)) return 'rhombus'
  if (has(/All four sides of [A-Z]{4} are congruent\./) || has(/is a parallelogram with ([A-Z])([A-Z]) ≅ \2[A-Z]\./) || has(/is a parallelogram, and diagonal [A-Z]{2} bisects/)) return 'rhombus'
  if (has(/Both pairs of opposite (sides|angles) of [A-Z]{4} are congruent/) || has(/diagonals of [A-Z]{4} bisect each other\./)) return 'parallelogram'
  if (has(/In [A-Z]{4}, ([A-Z]{2}) ∥ ([A-Z]{2}) and \1 ≅ \2\./)) return 'parallelogram'
  if (has(/, ([A-Z]{2}) ∥ ([A-Z]{2}), ([A-Z]{2}) ≅ ([A-Z]{2}), and \1 is longer than \2/)) return 'isoTrapezoid'
  if (has(/is a trapezoid with bases .* and (∠[A-Z] ≅ ∠[A-Z]|its diagonals are congruent)/)) return 'isoTrapezoid'
  if (has(/∥ .*(but .* is not parallel to|is longer than)/)) return 'trapezoid'
  if (has(/([A-Z]{2}) = ([A-Z]{2}) = \d+ and ([A-Z]{2}) = ([A-Z]{2}) = \d+/) || has(/≅ .*, .* ≅ .*, and .* is shorter than/)) return 'kite'
  if (has(/The diagonals of [A-Z]{4} are (perpendicular|congruent)\./) || has(/^In [A-Z]{4}, [A-Z]{2} ≅ [A-Z]{2}\.$/)) return 'quadrilateral'
  throw new Error(`facts not read: ${facts}`)
}

/** The most specific name the marks on the figure force. */
function nameFromMarks(fig: GeoFigureSpec, v: string[]): Name {
  const T = fig.points.find((p) => !v.includes(p.id))?.id ?? null
  const sideTicks = new Map<number, number>()
  const halfTicks = new Map<number, number>()
  for (const s of fig.segments ?? []) {
    if (!s.ticks) continue
    const i = v.indexOf(s.from)
    const j = v.indexOf(s.to)
    if (i >= 0 && j >= 0) sideTicks.set((i + 1) % 4 === j ? i : j, s.ticks)
    else halfTicks.set(v.indexOf(s.from === T ? s.to : s.from), s.ticks)
  }
  const arcs = new Map<number, number>()
  const rights: number[] = []
  let rightAtT = false
  for (const g of fig.angles ?? []) {
    if (g.vertex === T && g.right) rightAtT = true
    else if (g.right) rights.push(v.indexOf(g.vertex))
    else if (g.marks) arcs.set(v.indexOf(g.vertex), g.marks)
  }
  const eq = (m: Map<number, number>, i: number, j: number) => m.has(i) && m.get(i) === m.get(j)
  const allFour = (m: Map<number, number>) => m.size === 4 && new Set(m.values()).size === 1
  const bisect = eq(halfTicks, 0, 2) && eq(halfTicks, 1, 3)
  const pgram = (eq(sideTicks, 0, 2) && eq(sideTicks, 1, 3)) || (eq(arcs, 0, 2) && eq(arcs, 1, 3)) || bisect || rights.length === 4
  const fourSides = allFour(sideTicks)
  const congDiag = allFour(halfTicks)
  const isRect = rights.length === 4 || (congDiag && bisect) || (fourSides && rights.length >= 1)
  const isRhombus = fourSides || (bisect && rightAtT)
  if (isRect && isRhombus) return 'square'
  if (isRect) return 'rectangle'
  if (isRhombus) return 'rhombus'
  if (pgram) return 'parallelogram'
  return 'quadrilateral'
}

/** The most specific name of four lattice points, from exact slopes and lengths. */
function nameFromCoords(pts: P[]): Name {
  const s = [0, 1, 2, 3].map((i) => vsub(pts[(i + 1) % 4]!, pts[i]!))
  const l2 = s.map((u) => u.x * u.x + u.y * u.y)
  const par = (i: number) => cross(s[i]!, s[i + 2]!) === 0
  if (par(0) && par(1)) {
    const right = dot(s[0]!, s[1]!) === 0
    const eqSides = l2[0] === l2[1]
    return right && eqSides ? 'square' : right ? 'rectangle' : eqSides ? 'rhombus' : 'parallelogram'
  }
  if (par(0) || par(1)) {
    const legs = par(0) ? [1, 3] : [0, 2]
    return l2[legs[0]!] === l2[legs[1]!] ? 'isoTrapezoid' : 'trapezoid'
  }
  for (const k of [0, 1]) if (l2[k] === l2[k + 1] && l2[(k + 2) % 4] === l2[(k + 3) % 4]) return 'kite'
  return 'quadrilateral'
}

const GENERAL: Record<Name, Name[]> = {
  parallelogram: ['quadrilateral'],
  rectangle: ['parallelogram', 'quadrilateral'],
  rhombus: ['parallelogram', 'quadrilateral'],
  square: ['rectangle', 'rhombus', 'parallelogram', 'quadrilateral'],
  trapezoid: ['quadrilateral'],
  isoTrapezoid: ['trapezoid', 'quadrilateral'],
  kite: ['quadrilateral'],
  quadrilateral: [],
}

function solveClassify(a: GeometryAnswer, c: Check): void {
  const facts = a.prompt.replace(/ (What is the most specific name for [A-Z]{4}\?|Must [A-Z]{4} be a rectangle\? Must it be a rhombus\?)$/, '')
  const nameM = /\b([A-Z]{4})\b/.exec(a.prompt)
  if (!nameM) return fail(c, 'no name')
  const v = nameM[1]!.split('')
  let name: Name
  if (/^The marks show/.test(facts)) {
    marksAgree(c, a, v)
    name = nameFromMarks(a.figure, v)
  }
  else if (/has vertices/.test(facts)) name = nameFromCoords(vertices(a.prompt).pts)
  else name = nameFromFacts(facts)
  if (a.figure.points.length > 0) {
    const bad = realQuad(v.map((id) => pointOf(a.figure, id)))
    if (bad) fail(c, `figure: ${bad}`)
  }
  if (a.stages.length === 1) {
    const stage = a.stages[0]!
    if (stage.answerText !== name) fail(c, `the facts make ${name}; the answer is ${stage.answerText}`)
    for (const trap of stage.traps) {
      const pick = trap.text as Name
      const ok =
        trap.id === 'geo_not_most_specific'
          ? GENERAL[name].includes(pick)
          : trap.id === 'geo_converse_property'
            ? name === 'quadrilateral' && ['rhombus', 'kite', 'square', 'rectangle', 'isoTrapezoid'].includes(pick)
            : trap.id === 'geo_one_pair_half_test'
              ? pick === 'parallelogram' && (name === 'quadrilateral' || name === 'trapezoid')
              : false
      if (!ok) fail(c, `${trap.id} on ${pick} is not that slip for a ${name}`)
    }
    // A true name is never graded wrong: each more general name is the not-most-specific slip.
    for (const general of GENERAL[name]) {
      const g = gradeGeoStage(a, 'a', general)
      if (g.verdict !== 'mistake' || g.mistake !== 'geo_not_most_specific') fail(c, `${general} is true of a ${name} but grades ${g.verdict}`)
    }
  } else {
    if (!['rectangle', 'rhombus', 'square'].includes(name)) fail(c, `a must question about a ${name}`)
    const isRect = name === 'rectangle' || name === 'square'
    const isRhombus = name === 'rhombus' || name === 'square'
    const [rs, rh] = a.stages as [GeometryAnswer['stages'][number], GeometryAnswer['stages'][number]]
    if (rs.answerText !== (isRect ? 'yes' : 'no')) fail(c, `must it be a rectangle: ${isRect}, answer ${rs.answerText}`)
    if (rh.answerText !== (isRhombus ? 'yes' : 'no')) fail(c, `must it be a rhombus: ${isRhombus}, answer ${rh.answerText}`)
    for (const stage of a.stages) {
      for (const trap of stage.traps) {
        const ok =
          trap.id === 'geo_square_not_rectangle'
            ? name === 'square' && trap.text === 'no'
            : trap.id === 'geo_rect_rhombus_swapped'
              ? trap.text === 'yes' && ((stage.label === 'Rhombus?' && name === 'rectangle') || (stage.label === 'Rectangle?' && name === 'rhombus'))
              : false
        if (!ok) fail(c, `${trap.id} on ${stage.label} ${trap.text} is not that slip for a ${name}`)
      }
    }
  }
  checkAnswers(c, a, null, null)
}

/** The drawing carries every mark it shows: segments with the same ticks are equal, unlabeled arcs with the same count are equal angles, and a right-angle square sits on a 90° angle. */
function marksDrawnTrue(c: Check, fig: GeoFigureSpec): void {
  const groups = new Map<string, { name: string; value: number }[]>()
  const add = (key: string, name: string, value: number) => groups.set(key, [...(groups.get(key) ?? []), { name, value }])
  for (const s of fig.segments ?? []) if (s.ticks) add(`tick${s.ticks}`, `${s.from}${s.to}`, len(vsub(pointOf(fig, s.to), pointOf(fig, s.from))))
  for (const g of fig.angles ?? []) {
    const deg = angleDeg(pointOf(fig, g.vertex), pointOf(fig, g.from), pointOf(fig, g.to))
    if (g.right) {
      if (Math.abs(deg - 90) > 0.5) fail(c, `figure: ∠${g.from}${g.vertex}${g.to} has a right-angle mark but measures ${deg.toFixed(1)}`)
    } else if (g.marks && !g.label) add(`arc${g.marks}`, `∠${g.vertex}`, deg)
  }
  for (const [key, items] of groups) {
    const values = items.map((i) => i.value)
    const hi = Math.max(...values)
    const lo = Math.min(...values)
    const tol = key.startsWith('tick') ? 0.02 * hi : 1
    if (hi - lo > tol) fail(c, `figure: ${items.map((i) => i.name).join(', ')} share the mark ${key} but are drawn ${values.map((v) => v.toFixed(2)).join(', ')}`)
  }
}

// --- the sweep ---------------------------------------------------------------------------------------------------

const CASES: [ModuleId, string, (a: GeometryAnswer, c: Check) => void][] = [
  ['geoParallelograms', 'gq.props', solveProps],
  ['geoParallelograms', 'gq.prove', solveProve],
  ['geoParallelograms', 'gq.coords', solveCoords],
  ['geoSpecialQuads', 'gs.props', solveSpecial],
  ['geoSpecialQuads', 'gs.classify', solveClassify],
  ['geoTrapezoids', 'gz.midseg', solveMidseg],
  ['geoTrapezoids', 'gz.isosceles', solveIsosceles],
]

describe.each(CASES)('unit 5 re-solve: %s/%s', (module, template, solve) => {
  it(
    `solves every seed again from its wording and its marks (${SEEDS} seeds)`,
    () => {
      const problems: string[] = []
      for (let seed = 1; seed <= SEEDS; seed++) {
        const c: Check = { where: `${template}/${seed}`, problems }
        try {
          const a = load(module, template, seed)
          solve(a, c)
          if (a.figure.points.length > 0) marksDrawnTrue(c, a.figure)
        } catch (e) {
          problems.push(`${template}/${seed}: ${(e as Error).message}`)
        }
      }
      expect(problems.slice(0, 10)).toEqual([])
    },
    HEAVY,
  )
})

describe('the re-solver itself', () => {
  it('finds x in a parallelogram, and refuses a pair of givens that holds for every x', () => {
    const rels = pgramRels()
    const one = solveSystem(new Map([['a0', parseLin('3x + 10')], ['a2', parseLin('5x − 30')]]), rels)
    expect(text(one.x)).toBe('20')
    expect(text(at(one.known.get('a1')!, one.x))).toBe('110')
    expect(() => solveSystem(new Map([['s0', parseLin('2x + 4')], ['s2', parseLin('2x + 4')]]), rels)).toThrow(/not determined/)
    expect(() => solveSystem(new Map([['s0', parseLin('2x + 4')], ['s1', parseLin('3x')]]), rels)).toThrow(/not determined/)
  })

  it('a quadrilateral with one pair of parallel sides and the other pair congruent need not be a parallelogram', () => {
    const marks: ProveFact = { par: [[0, 2]], cong: [[1, 3]], ang: [], half: [], T: false }
    expect(directTests(marks)).toEqual([])
    expect(counterexample(marks)).toBe(true)
    // One pair both parallel and congruent is a test, and no counterexample exists for it.
    const onePair: ProveFact = { par: [[0, 2]], cong: [[0, 2]], ang: [], half: [], T: false }
    expect(directTests(onePair)).toEqual(['onePair'])
    expect(counterexample(onePair)).toBe(false)
    // Congruent consecutive angles, both pairs: an isosceles trapezoid.
    expect(counterexample({ par: [], cong: [], ang: [[0, 1], [2, 3]], half: [], T: false })).toBe(true)
    // One diagonal cut in half: a kite.
    expect(counterexample({ par: [], cong: [], ang: [], half: [[1, 3]], T: true })).toBe(true)
  })

  it('notices a mark the drawing does not carry', () => {
    const fig: GeoFigureSpec = {
      ariaLabel: 'test',
      points: [
        { id: 'P', x: 0, y: 0 },
        { id: 'Q', x: 4, y: 0 },
        { id: 'R', x: 5, y: 3 },
        { id: 'S', x: 1, y: 3 },
      ],
      segments: [
        { from: 'P', to: 'Q', ticks: 1 },
        { from: 'Q', to: 'R', ticks: 1 },
      ],
      angles: [{ vertex: 'P', from: 'Q', to: 'S', right: true }],
    }
    const c: Check = { where: 'test', problems: [] }
    marksDrawnTrue(c, fig)
    expect(c.problems.some((p) => /right-angle mark/.test(p))).toBe(true)
    expect(c.problems.some((p) => /share the mark tick1/.test(p))).toBe(true)
  })

  it('names lattice quadrilaterals exactly', () => {
    expect(nameFromCoords([{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: 1, y: 3 }, { x: -1, y: 2 }])).toBe('square')
    expect(nameFromCoords([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 2 }, { x: 0, y: 2 }])).toBe('rectangle')
    expect(nameFromCoords([{ x: 0, y: 0 }, { x: 3, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 3 }])).toBe('rhombus')
    expect(nameFromCoords([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 4, y: 2 }, { x: 2, y: 2 }])).toBe('isoTrapezoid')
    expect(nameFromCoords([{ x: 0, y: 0 }, { x: 2, y: -2 }, { x: 6, y: 0 }, { x: 2, y: 2 }])).toBe('kite')
  })
})
