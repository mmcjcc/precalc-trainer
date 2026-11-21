/**
 * The last module of Unit 9 solved again from what she reads. Each prompt is parsed with the grammar written at the
 * top of unit9Ratios.ts (and nothing else of the generator), every answer is decided with plain arithmetic in
 * rationals, and the stored answers must match. The figure has to be the configuration the words describe, drawn to
 * its true proportions: the stated lengths on their own segments, points on the lines and circles they belong to,
 * similar figures truly similar, a parallel truly parallel, an inscribed figure truly inscribed, and the shaded
 * region the one the question is about. Nothing she has to work out is labeled.
 *
 * This file imports no generator helper. `params` is not consulted.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoPoint } from '@/shared/types'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const OPENERS = ['Use the figure. ', 'Study the figure. ', 'Look at the figure. ']
const U = String.raw`(cm|m|in|ft)`

// --- exact arithmetic: a sum of rationals times √m, with or without π -----------------------------------------------

type Rat = [bigint, bigint]

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a
  let y = b < 0n ? -b : b
  while (y) [x, y] = [y, x % y]
  return x || 1n
}

function rat(n: bigint | number, d: bigint | number = 1n): Rat {
  let N = BigInt(n)
  let D = BigInt(d)
  if (D === 0n) throw new Error('zero denominator')
  if (D < 0n) {
    N = -N
    D = -D
  }
  const g = gcd(N, D)
  return [N / g, D / g]
}

const add = (a: Rat, b: Rat) => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1])
const sub = (a: Rat, b: Rat) => add(a, rat(-b[0], b[1]))
const mul = (a: Rat, b: Rat) => rat(a[0] * b[0], a[1] * b[1])
const div = (a: Rat, b: Rat) => rat(a[0] * b[1], a[1] * b[0])
const isZero = (a: Rat) => a[0] === 0n

/** Terms keyed by "π√m" or "√m" (m square-free; √1 is a plain rational). */
type Val = Map<string, Rat>

function term(c: Rat, m: number, pi: boolean): Val {
  let k = 1
  let r = m
  for (let f = 2; f * f <= r; f++) {
    while (r % (f * f) === 0) {
      r /= f * f
      k *= f
    }
  }
  return new Map([[`${pi ? 'π' : ''}√${r}`, mul(c, rat(k))]])
}

function plus(...vs: Val[]): Val {
  const out: Val = new Map()
  for (const v of vs) for (const [k, c] of v) out.set(k, add(out.get(k) ?? rat(0), c))
  for (const [k, c] of [...out]) if (isZero(c)) out.delete(k)
  return out
}

function scale(v: Val, c: Rat): Val {
  return new Map([...v].map(([k, x]) => [k, mul(x, c)]))
}

function sameVal(a: Val, b: Val): boolean {
  if (a.size !== b.size) return false
  for (const [k, c] of a) {
    const o = b.get(k)
    if (!o || o[0] !== c[0] || o[1] !== c[1]) return false
  }
  return true
}

const show = (v: Val) => [...v].map(([k, c]) => `${c[0]}/${c[1]}${k}`).join(' + ')

function readTerm(text: string): Val {
  const t = text.trim()
  let m = /^\((\d*)(π?)(?:√(\d+))?\)\/(\d+)$/.exec(t)
  if (m) return term(rat(m[1] ? Number(m[1]) : 1, Number(m[4])), m[3] ? Number(m[3]) : 1, m[2] === 'π')
  m = /^(\d*)(π?)(?:√(\d+))?(?:\/(\d+))?$/.exec(t)
  if (m && (m[1] || m[2] || m[3])) return term(rat(m[1] ? Number(m[1]) : 1, m[4] ? Number(m[4]) : 1), m[3] ? Number(m[3]) : 1, m[2] === 'π')
  throw new Error(`unreadable term “${text}”`)
}

function readVal(text: string): Val {
  const parts = text.trim().split(/ (?=[-+] )/)
  const vs = parts.map((p, i) => {
    if (i === 0) return readTerm(p)
    const sign = p.startsWith('-') ? rat(-1) : rat(1)
    return scale(readTerm(p.slice(2)), sign)
  })
  return plus(...vs)
}

const R = (c: Rat): Val => term(c, 1, false)
const num = (r: Rat) => Number(r[0]) / Number(r[1])
const whole = (s: string) => rat(Number(s))

// --- the figure ---------------------------------------------------------------------------------------------------

function pt(a: GeometryAnswer, id: string): GeoPoint {
  const p = a.figure.points.find((q) => q.id === id)
  if (!p) throw new Error(`no point ${id}`)
  return p
}

const dist = (a: GeometryAnswer, p: string, q: string) => Math.hypot(pt(a, p).x - pt(a, q).x, pt(a, p).y - pt(a, q).y)

function near(x: number, y: number, what: string, tol = 1e-6) {
  if (Math.abs(x - y) > tol * Math.max(1, Math.abs(y))) throw new Error(`${what}: drawn ${x}, stated ${y}`)
}

function segLabel(a: GeometryAnswer, from: string, to: string): string | null {
  const s = (a.figure.segments ?? []).find((x) => (x.from === from && x.to === to) || (x.from === to && x.to === from))
  if (!s) throw new Error(`no segment ${from}${to}`)
  return s.label?.trim() ?? null
}

/** The labeled segments, as "XY=label", sorted. */
function labels(a: GeometryAnswer): string[] {
  return (a.figure.segments ?? [])
    .filter((s) => s.label?.trim())
    .map((s) => `${[s.from, s.to].sort().join('')}=${s.label!.trim()}`)
    .sort()
}

function requireLabels(a: GeometryAnswer, want: Record<string, string>) {
  const got = labels(a)
  const expected = Object.entries(want)
    .map(([k, v]) => `${k.split('').sort().join('')}=${v}`)
    .sort()
  if (JSON.stringify(got) !== JSON.stringify(expected)) throw new Error(`labels ${got.join(', ')}, expected ${expected.join(', ')}`)
}

/** p lies on segment qr (to 1e-6 of its length). */
function onSegment(a: GeometryAnswer, p: string, q: string, r: string) {
  const d = dist(a, q, p) + dist(a, p, r) - dist(a, q, r)
  if (Math.abs(d) > 1e-6 * dist(a, q, r)) throw new Error(`${p} is not on ${q}${r}`)
}

// --- the prompt ---------------------------------------------------------------------------------------------------

function strip(prompt: string): string {
  for (const opener of OPENERS) if (prompt.startsWith(opener)) return prompt.slice(opener.length)
  return prompt
}

/** The ask spells inches out ("in square inches"); read it back as in². */
function unspell(text: string): string {
  return text.replace(/ in square inches/g, ' in in²').replace(/ in inches/g, ' in in')
}

function check(a: GeometryAnswer, want: Val[]) {
  if (a.stages.length !== want.length) throw new Error(`${a.stages.length} parts, computed ${want.length}`)
  a.stages.forEach((s, i) => {
    const got = readVal(s.answerText)
    if (!sameVal(got, want[i]!)) throw new Error(`${s.label}: stored ${s.answerText} (${show(got)}), computed ${show(want[i]!)}`)
  })
}

function requireRatioParts(a: GeometryAnswer, ratio: boolean) {
  for (const s of a.stages) if (Boolean(s.ratio) !== ratio) throw new Error(`${s.label} ${ratio ? 'does not read' : 'reads'} a ratio`)
}

// --- ra.shared ----------------------------------------------------------------------------------------------------

function solveShared(a: GeometryAnswer) {
  const body = unspell(strip(a.prompt))
  const m = new RegExp(String.raw`^In triangle ABC, point D is on side BC, and segment AD is drawn\. BD is (\d+) ${U} and DC is (\d+) ${U}\. (.+)$`).exec(body)
  if (!m) throw new Error(`unreadable prompt: ${a.prompt}`)
  const bd = whole(m[1]!)
  const dc = whole(m[3]!)
  if (m[2] !== m[4]) throw new Error('two units')
  const u = m[2]!
  const bc = add(bd, dc)
  const base: Record<string, Rat> = { ABD: bd, ADC: dc, ABC: bc }
  const ask = m[5]!
  let want: Val
  let ratio = false
  let f: RegExpExecArray | null
  if ((f = /^Find the ratio of the area of triangle (ABD|ADC) to the area of triangle (ABD|ADC|ABC)\.$/.exec(ask))) {
    if (f[1] === f[2]) throw new Error('the same triangle twice')
    want = R(div(base[f[1]!]!, base[f[2]!]!))
    ratio = true
  } else if ((f = new RegExp(String.raw`^The area of triangle (ABD|ADC) is (\d+) ${U}²\. Find the area of triangle (ABD|ADC) in ${U}²\.$`).exec(ask))) {
    if (f[1] === f[4] || f[3] !== u || f[5] !== u) throw new Error(`bad ask ${ask}`)
    want = R(div(mul(whole(f[2]!), base[f[4]!]!), base[f[1]!]!))
  } else if ((f = new RegExp(String.raw`^The area of triangle ABC is (\d+) ${U}²\. Find the area of triangle (ABD|ADC) in ${U}²\.$`).exec(ask))) {
    if (f[2] !== u || f[4] !== u) throw new Error(`bad units ${ask}`)
    want = R(div(mul(whole(f[1]!), base[f[3]!]!), bc))
  } else throw new Error(`unreadable ask “${ask}”`)
  check(a, [want])
  requireRatioParts(a, ratio)
  // The figure: D on BC at the stated lengths, AD drawn, no height and nothing else labeled.
  onSegment(a, 'D', 'B', 'C')
  near(dist(a, 'B', 'D'), num(bd), 'BD')
  near(dist(a, 'D', 'C'), num(dc), 'DC')
  requireLabels(a, { BD: m[1]!, DC: m[3]! })
  for (const s of ['AB', 'AC', 'AD']) segLabel(a, s[0]!, s[1]!)
  const ids = (a.figure.segments ?? []).map((s) => [s.from, s.to].sort().join('')).sort()
  if (JSON.stringify(ids) !== JSON.stringify(['AB', 'AC', 'AD', 'BD', 'CD'])) throw new Error(`segments ${ids.join(', ')}: a height or something else is drawn`)
  if ((a.figure.angles ?? []).length) throw new Error('an angle is marked')
  if ((a.figure.regions ?? []).length) throw new Error('a region is shaded')
  const A = pt(a, 'A')
  const B = pt(a, 'B')
  const C = pt(a, 'C')
  if (Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) < 1e-6) throw new Error('A is on line BC')
}

// --- ra.similar ---------------------------------------------------------------------------------------------------

/** The polygon through these letters, in order. */
function poly(a: GeometryAnswer, ids: string): GeoPoint[] {
  return ids.split('').map((id) => pt(a, id))
}

/** Second is the first scaled by `k` (corresponding vertices in letter order): every side and every diagonal. */
function requireSimilar(a: GeometryAnswer, first: string, second: string, k: number) {
  const p = poly(a, first)
  const q = poly(a, second)
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) {
      const d1 = Math.hypot(p[i]!.x - p[j]!.x, p[i]!.y - p[j]!.y)
      const d2 = Math.hypot(q[i]!.x - q[j]!.x, q[i]!.y - q[j]!.y)
      near(d2 / d1, k, `${second[i]}${second[j]} over ${first[i]}${first[j]}`)
    }
  }
  // Same orientation (a reflection would still be similar, but the letters must go round the same way).
  const turn = (v: GeoPoint[]) => v.reduce((s, c, i) => s + c.x * v[(i + 1) % v.length]!.y - v[(i + 1) % v.length]!.x * c.y, 0)
  if (Math.sign(turn(p)) !== Math.sign(turn(q))) throw new Error('the letters go round the two figures in opposite directions')
}

function solveSimilar(a: GeometryAnswer) {
  const body = unspell(strip(a.prompt))
  if (body.startsWith('In triangle ABC, point D is on side AB')) return solveParallel(a, body)
  const m = /^(Triangle|Quadrilateral) (ABC|ABCD) is similar to (?:triangle|quadrilateral) (DEF|EFGH)\. (.+)$/.exec(body)
  if (!m) throw new Error(`unreadable prompt: ${a.prompt}`)
  const shape = m[1]!.toLowerCase()
  const F = m[2]!
  const S = m[3]!
  if (F.length !== S.length || (shape === 'triangle') !== (F.length === 3)) throw new Error('the shapes do not match')
  const rest = m[4]!
  let f: RegExpExecArray | null
  const sides = new RegExp(String.raw`^Sides ([A-H]{2}) and ([A-H]{2}) correspond\. \1 is (\d+) ${U} and \2 is (\d+) ${U}\. (.+)$`).exec(rest)
  if (sides) {
    const [, X1, X2, l1, u1, l2, u2, ask] = sides
    if (u1 !== u2) throw new Error('two units')
    // Corresponding: the same places in the two names.
    const i = F.indexOf(X1![0]!)
    if (F.indexOf(X1![1]!) !== (i + 1) % F.length || S[i] !== X2![0] || S[(i + 1) % S.length] !== X2![1]) throw new Error(`${X1} and ${X2} do not correspond`)
    const k = div(whole(l2!), whole(l1!))
    requireLabels(a, { [X1!]: l1!, [X2!]: l2! })
    near(dist(a, X1![0]!, X1![1]!), Number(l1), X1!)
    near(dist(a, X2![0]!, X2![1]!), Number(l2), X2!)
    requireSimilar(a, F, S, num(k))
    const scaleF = div(whole(l1!), whole(l2!))
    if (ask === `Find the ratio of the perimeter of ${shape} ${F} to the perimeter of ${shape} ${S}, and the ratio of the area of ${shape} ${F} to the area of ${shape} ${S}.`) {
      check(a, [R(scaleF), R(mul(scaleF, scaleF))])
      requireRatioParts(a, true)
      return
    }
    if ((f = new RegExp(String.raw`^The area of ${shape} (${F}|${S}) is (\d+) ${U}²\. Find the area of ${shape} (${F}|${S}) in ${U}²\.$`).exec(ask!))) {
      if (f[1] === f[4] || f[3] !== u1 || f[5] !== u1) throw new Error(`bad ask ${ask}`)
      // Area of the other = known area times (its side over the known side) squared.
      const ratio = f[1] === F ? div(whole(l2!), whole(l1!)) : div(whole(l1!), whole(l2!))
      check(a, [R(mul(whole(f[2]!), mul(ratio, ratio)))])
      requireRatioParts(a, false)
      return
    }
    throw new Error(`unreadable ask “${ask}”`)
  }
  f = new RegExp(String.raw`^The area of ${shape} ${F} is (\d+) ${U}² and the area of ${shape} ${S} is (\d+) ${U}²\. Find the scale factor of ${shape} ${F} to ${shape} ${S}\.$`).exec(rest)
  if (!f) throw new Error(`unreadable facts “${rest}”`)
  if (f[2] !== f[4]) throw new Error('two units')
  const ratio = div(whole(f[1]!), whole(f[3]!))
  const root = (x: bigint) => {
    const r = BigInt(Math.round(Math.sqrt(Number(x))))
    if (r * r !== x) throw new Error('the ratio of the areas is not a ratio of squares')
    return r
  }
  const kf = rat(root(ratio[0]), root(ratio[1]))
  check(a, [R(kf)])
  requireRatioParts(a, true)
  // No lengths are given, so none are labeled; the two figures are still similar at that scale factor.
  if (labels(a).length) throw new Error(`labels ${labels(a).join(', ')} where no length is given`)
  requireSimilar(a, F, S, 1 / num(kf))
}

function solveParallel(a: GeometryAnswer, body: string) {
  const m = new RegExp(
    String.raw`^In triangle ABC, point D is on side AB and point E is on side AC, and segment DE is parallel to side BC\. AD is (\d+) ${U} and DB is (\d+) ${U}\. Find the ratio of the area of triangle ADE to the area of triangle ABC, and the ratio of the area of triangle ADE to the area of trapezoid DBCE\.$`,
  ).exec(body)
  if (!m) throw new Error(`unreadable prompt: ${a.prompt}`)
  if (m[2] !== m[4]) throw new Error('two units')
  const ad = whole(m[1]!)
  const ab = add(ad, whole(m[3]!))
  const k = div(ad, ab)
  const small = mul(k, k)
  check(a, [R(small), R(div(small, sub(rat(1), small)))])
  requireRatioParts(a, true)
  requireLabels(a, { AD: m[1]!, DB: m[3]! })
  onSegment(a, 'D', 'A', 'B')
  onSegment(a, 'E', 'A', 'C')
  near(dist(a, 'A', 'D'), num(ad), 'AD')
  near(dist(a, 'A', 'B'), num(ab), 'AB')
  near(dist(a, 'A', 'E') / dist(a, 'A', 'C'), num(k), 'AE over AC')
  const D = pt(a, 'D')
  const E = pt(a, 'E')
  const B = pt(a, 'B')
  const C = pt(a, 'C')
  const cross = (E.x - D.x) * (C.y - B.y) - (E.y - D.y) * (C.x - B.x)
  if (Math.abs(cross) > 1e-6 * dist(a, 'D', 'E') * dist(a, 'B', 'C')) throw new Error('DE is not parallel to BC')
  segLabel(a, 'D', 'E')
  if ((a.figure.angles ?? []).length || (a.figure.regions ?? []).length) throw new Error('something is marked that is not given')
}

// --- ra.shaded ----------------------------------------------------------------------------------------------------

const PIv = (c: Rat): Val => term(c, 1, true)
const R3 = (c: Rat): Val => term(c, 3, false)

/** Every labeled segment is drawn as long as its number says. */
function labelsTrue(a: GeometryAnswer) {
  for (const s of a.figure.segments ?? []) {
    if (!s.label?.trim()) continue
    near(dist(a, s.from, s.to), Number(s.label.trim()), `${s.from}${s.to} labeled ${s.label.trim()}`)
  }
}

function circleAt(a: GeometryAnswer, r: number): string {
  const c = (a.figure.circles ?? []).find((x) => Math.abs(x.r - r) < 1e-9 * Math.max(1, r))
  if (!c) throw new Error(`no circle of radius ${r} (drawn: ${(a.figure.circles ?? []).map((x) => x.r).join(', ')})`)
  return c.center
}

/** A regular polygon through these letters with every vertex on circle O of radius r. */
function requireInscribed(a: GeometryAnswer, ids: string, r: number) {
  const O = pt(a, 'O')
  for (const id of ids) {
    const p = pt(a, id)
    if (Math.abs(Math.hypot(p.x - O.x, p.y - O.y) - r) > 1e-9 * Math.max(1, r)) throw new Error(`${id} is not on the circle`)
  }
  const side = dist(a, ids[0]!, ids[1]!)
  for (let i = 0; i < ids.length; i++) near(dist(a, ids[i]!, ids[(i + 1) % ids.length]!), side, `side ${ids[i]}${ids[(i + 1) % ids.length]}`)
  near(side, 2 * r * Math.sin(Math.PI / ids.length), 'the side of a regular polygon in that circle')
  for (let i = 0; i < ids.length; i++) segLabel(a, ids[i]!, ids[(i + 1) % ids.length]!)
}

/** The rectangle through these letters is l by w with right angles. */
function requireRect(a: GeometryAnswer, ids: string, l: number, w: number) {
  near(dist(a, ids[0]!, ids[1]!), l, `${ids[0]}${ids[1]}`)
  near(dist(a, ids[1]!, ids[2]!), w, `${ids[1]}${ids[2]}`)
  near(dist(a, ids[2]!, ids[3]!), l, `${ids[2]}${ids[3]}`)
  near(dist(a, ids[3]!, ids[0]!), w, `${ids[3]}${ids[0]}`)
  near(dist(a, ids[0]!, ids[2]!), Math.hypot(l, w), `diagonal ${ids[0]}${ids[2]}`)
  for (let i = 0; i < 4; i++) segLabel(a, ids[i]!, ids[(i + 1) % 4]!)
}

type Loop = NonNullable<GeometryAnswer['figure']['regions']>[number]

/** The one shaded region is the compound of exactly these loops (circles by radius, polygons by letters). */
function requireLoops(a: GeometryAnswer, want: string[]) {
  const regions = a.figure.regions ?? []
  if (regions.length !== 1 || regions[0]!.kind !== 'compound') throw new Error('not one compound region')
  const g = regions[0] as Extract<Loop, { kind: 'compound' }>
  const got = g.loops.map((l) => (l.shape === 'circle' ? `circle ${l.center} ${l.r}` : l.shape === 'polygon' ? `polygon ${l.points.join('')}` : `${l.shape}`)).sort()
  if (JSON.stringify(got) !== JSON.stringify([...want].sort())) throw new Error(`shaded loops ${got.join('; ')}, expected ${want.join('; ')}`)
}

function solveShaded(a: GeometryAnswer) {
  const body = unspell(strip(a.prompt))
  const m = new RegExp(String.raw`^(.+?) The shaded region is (.+?)\. (Find .+)$`).exec(body)
  if (!m) throw new Error(`unreadable prompt: ${a.prompt}`)
  const [, facts, region, ask] = m
  let outer: Val
  let inner: Val
  let outerName: string
  let innerName: string
  let wantRegion: string
  let u: string
  let f: RegExpExecArray | null
  if ((f = new RegExp(String.raw`^A circle with center O is inscribed in square ABCD\. Each side of the square is (\d+) ${U}\.$`).exec(facts!))) {
    const s = whole(f[1]!)
    u = f[2]!
    const r = div(s, rat(2))
    outer = R(mul(s, s))
    inner = PIv(mul(r, r))
    ;[outerName, innerName, wantRegion] = ['square ABCD', 'circle O', 'the part of the square outside the circle']
    requireRect(a, 'ABCD', num(s), num(s))
    // Inscribed: the circle's center is the square's center and its radius half the side, so it touches every side.
    const c = circleAt(a, num(r))
    const O = pt(a, c)
    const A = pt(a, 'A')
    const C = pt(a, 'C')
    near(Math.hypot(O.x - (A.x + C.x) / 2, O.y - (A.y + C.y) / 2), 0, 'the circle is centered in the square')
    requireLoops(a, ['polygon ABCD', `circle O ${num(r)}`])
    requireLabels(a, { AB: f[1]! })
  } else if ((f = new RegExp(String.raw`^(Square ABCD|Regular hexagon ABCDEF|Equilateral triangle ABC) is inscribed in circle O\. The radius of the circle is (\d+) ${U}\.$`).exec(facts!))) {
    const r = whole(f[2]!)
    u = f[3]!
    const r2 = mul(r, r)
    outer = PIv(r2)
    const ids = f[1]!.split(' ').pop()!
    if (ids === 'ABCD') inner = R(div(mul(mul(rat(2), r), mul(rat(2), r)), rat(2)))
    else if (ids === 'ABCDEF') inner = R3(mul(rat(6, 4), r2))
    else inner = R3(mul(rat(3, 4), r2))
    const noun = ids === 'ABCD' ? 'square' : ids === 'ABCDEF' ? 'hexagon' : 'triangle'
    ;[outerName, innerName, wantRegion] = ['circle O', `${noun} ${ids}`, `the part of the circle outside the ${noun}`]
    circleAt(a, num(r))
    requireInscribed(a, ids, num(r))
    requireLoops(a, [`circle O ${num(r)}`, `polygon ${ids}`])
    // Only the radius may be labeled, never the polygon's side.
    for (const l of labels(a)) if (l !== `AO=${f[2]}`) throw new Error(`label ${l}`)
  } else if ((f = new RegExp(String.raw`^Two circles have the same center O\. The radius OA of the larger circle is (\d+) ${U}, and the radius OB of the smaller circle is (\d+) ${U}\.$`).exec(facts!))) {
    const big = whole(f[1]!)
    const small = whole(f[3]!)
    if (f[2] !== f[4]) throw new Error('two units')
    u = f[2]!
    if (num(small) >= num(big)) throw new Error('the smaller circle is not smaller')
    outer = PIv(mul(big, big))
    inner = PIv(mul(small, small))
    ;[outerName, innerName, wantRegion] = ['the larger circle', 'the smaller circle', 'the ring between the two circles']
    if (circleAt(a, num(big)) !== 'O' || circleAt(a, num(small)) !== 'O') throw new Error('the circles do not share center O')
    near(dist(a, 'O', 'A'), num(big), 'OA')
    near(dist(a, 'O', 'B'), num(small), 'OB')
    requireLoops(a, [`circle O ${num(big)}`, `circle O ${num(small)}`])
    requireLabels(a, { OA: f[1]!, OB: f[3]! })
  } else if ((f = new RegExp(String.raw`^In rectangle PQRS, PQ is (\d+) ${U} and QR is (\d+) ${U}\. A circle with center O and radius (\d+) ${U} lies inside the rectangle\.$`).exec(facts!))) {
    const l = whole(f[1]!)
    const w = whole(f[3]!)
    const r = whole(f[5]!)
    if (f[2] !== f[4] || f[4] !== f[6]) throw new Error('two units')
    u = f[2]!
    outer = R(mul(l, w))
    inner = PIv(mul(r, r))
    ;[outerName, innerName, wantRegion] = ['rectangle PQRS', 'circle O', 'the part of the rectangle outside the circle']
    requireRect(a, 'PQRS', num(l), num(w))
    if (circleAt(a, num(r)) !== 'O') throw new Error('the circle is not centered at O')
    // Inside and not touching: O is farther than r from every side.
    const sides = ['PQ', 'QR', 'RS', 'SP']
    for (const s of sides) {
      const p = pt(a, s[0]!)
      const q = pt(a, s[1]!)
      const O = pt(a, 'O')
      const d = Math.abs((q.x - p.x) * (p.y - O.y) - (p.x - O.x) * (q.y - p.y)) / Math.hypot(q.x - p.x, q.y - p.y)
      if (d <= num(r) + 1e-6) throw new Error(`the circle reaches side ${s}`)
    }
    requireLoops(a, ['polygon PQRS', `circle O ${num(r)}`])
    const want = { PQ: f[1]!, QR: f[3]! } as Record<string, string>
    const radius = (a.figure.segments ?? []).find((s) => s.from === 'O' || s.to === 'O')
    if (!radius) throw new Error('no radius drawn')
    want[`${radius.from}${radius.to}`] = f[5]!
    requireLabels(a, want)
  } else throw new Error(`unreadable facts “${facts}”`)
  if (region !== wantRegion) throw new Error(`the shaded region is “${region}”, the figure is ${wantRegion}`)
  labelsTrue(a)
  const shaded = plus(outer, scale(inner, rat(-1)))
  const allPi = outerName === 'the larger circle'
  if (ask === `Find the area of the shaded region in ${u}², in terms of π.`) check(a, [shaded])
  else if (ask === `Find the area of ${outerName}, the area of ${innerName}, and the area of the shaded region, each in ${u}². ${allPi ? 'Write each answer in terms of π.' : 'Write each answer in terms of π where π appears.'}`) check(a, [outer, inner, shaded])
  else throw new Error(`unreadable ask “${ask}”`)
  requireRatioParts(a, false)
  const last = a.stages[a.stages.length - 1]!
  if (Boolean(last.sum) !== (shaded.size > 1)) throw new Error('the shaded part does not read a sum')
}

// --- ra.chance ----------------------------------------------------------------------------------------------------

function solveChance(a: GeometryAnswer) {
  const body = unspell(strip(a.prompt))
  let f: RegExpExecArray | null
  let want: Val
  let pi = false
  if ((f = new RegExp(String.raw`^Points A, B, C and D lie on segment AD in that order\. AB is (\d+) ${U}, BC is (\d+) ${U} and CD is (\d+) ${U}\. Find the probability that a point picked at random on segment AD is on segment (AB|BC|CD|AC|BD)\. Give the probability as a fraction\.$`).exec(body))) {
    if (f[2] !== f[4] || f[4] !== f[6]) throw new Error('two units')
    const at: Record<string, Rat> = { A: rat(0), B: whole(f[1]!) }
    at.C = add(at.B!, whole(f[3]!))
    at.D = add(at.C!, whole(f[5]!))
    const piece = f[7]!
    want = R(div(sub(at[piece[1]!]!, at[piece[0]!]!), at.D!))
    for (const [p, q, r] of [['B', 'A', 'C'], ['C', 'B', 'D']] as const) onSegment(a, p, q, r)
    near(dist(a, 'A', 'B'), Number(f[1]), 'AB')
    near(dist(a, 'B', 'C'), Number(f[3]), 'BC')
    near(dist(a, 'C', 'D'), Number(f[5]), 'CD')
    near(dist(a, 'A', 'D'), num(at.D!), 'AD')
    requireLabels(a, { AB: f[1]!, BC: f[3]!, CD: f[5]! })
    if ((a.figure.regions ?? []).length) throw new Error('a region is shaded on a segment')
  } else if ((f = new RegExp(String.raw`^Two circles have the same center O\. The radius OA of the larger circle is (\d+) ${U}, and the radius OB of the smaller circle is (\d+) ${U}\. Find the probability that a point picked at random inside the larger circle is (inside the smaller circle|in the ring between the two circles), the shaded region\. Give the probability as a fraction\.$`).exec(body))) {
    if (f[2] !== f[4]) throw new Error('two units')
    const big = whole(f[1]!)
    const small = whole(f[3]!)
    if (num(small) >= num(big)) throw new Error('the smaller circle is not smaller')
    const inner = div(mul(small, small), mul(big, big))
    const inside = f[5] === 'inside the smaller circle'
    want = R(inside ? inner : sub(rat(1), inner))
    if (circleAt(a, num(big)) !== 'O' || circleAt(a, num(small)) !== 'O') throw new Error('the circles do not share center O')
    near(dist(a, 'O', 'A'), num(big), 'OA')
    near(dist(a, 'O', 'B'), num(small), 'OB')
    requireLabels(a, { OA: f[1]!, OB: f[3]! })
    requireLoops(a, inside ? [`circle O ${num(small)}`] : [`circle O ${num(big)}`, `circle O ${num(small)}`])
  } else if ((f = new RegExp(String.raw`^In rectangle PQRS, PQ is (\d+) ${U} and QR is (\d+) ${U}\. A circle with center O and radius (\d+) ${U} lies inside the rectangle\. Find the probability that a point picked at random inside the rectangle is (inside|outside) the circle, the shaded region\. Give the probability as a fraction, in terms of π\.$`).exec(body))) {
    if (f[2] !== f[4] || f[4] !== f[6]) throw new Error('two units')
    const l = whole(f[1]!)
    const w = whole(f[3]!)
    const r = whole(f[5]!)
    const inside = PIv(div(mul(r, r), mul(l, w)))
    want = f[7] === 'inside' ? inside : plus(R(rat(1)), scale(inside, rat(-1)))
    pi = true
    requireRect(a, 'PQRS', num(l), num(w))
    if (circleAt(a, num(r)) !== 'O') throw new Error('the circle is not centered at O')
    const O = pt(a, 'O')
    for (const s of ['PQ', 'QR', 'RS', 'SP']) {
      const p = pt(a, s[0]!)
      const q = pt(a, s[1]!)
      const d = Math.abs((q.x - p.x) * (p.y - O.y) - (p.x - O.x) * (q.y - p.y)) / Math.hypot(q.x - p.x, q.y - p.y)
      if (d <= num(r) + 1e-6) throw new Error(`the circle reaches side ${s}`)
    }
    requireLoops(a, f[7] === 'inside' ? [`circle O ${num(r)}`] : ['polygon PQRS', `circle O ${num(r)}`])
    labelsTrue(a)
  } else if ((f = new RegExp(String.raw`^In rectangle PQRS, PQ is (\d+) ${U} and QR is (\d+) ${U}\. The shaded rectangle EFGH lies inside it, and EF is (\d+) ${U} and FG is (\d+) ${U}\. Find the probability that a point picked at random inside rectangle PQRS is inside rectangle EFGH\. Give the probability as a fraction\.$`).exec(body))) {
    const l = whole(f[1]!)
    const w = whole(f[3]!)
    const e = whole(f[5]!)
    const g = whole(f[7]!)
    want = R(div(mul(e, g), mul(l, w)))
    requireRect(a, 'PQRS', num(l), num(w))
    requireRect(a, 'EFGH', num(e), num(g))
    // EFGH lies inside PQRS.
    const P = pt(a, 'P')
    const Q = pt(a, 'Q')
    const S = pt(a, 'S')
    for (const id of 'EFGH') {
      const p = pt(a, id)
      const x = ((p.x - P.x) * (Q.x - P.x) + (p.y - P.y) * (Q.y - P.y)) / num(l)
      const y = ((p.x - P.x) * (S.x - P.x) + (p.y - P.y) * (S.y - P.y)) / num(w)
      if (!(x > 0 && x < num(l) && y > 0 && y < num(w))) throw new Error(`${id} is not inside the rectangle`)
    }
    requireLabels(a, { PQ: f[1]!, QR: f[3]!, EF: f[5]!, FG: f[7]! })
    requireLoops(a, ['polygon EFGH'])
  } else if ((f = new RegExp(String.raw`^In rectangle PQRS, RS is (\d+) ${U} and QR is (\d+) ${U}\. Point E is on side PQ, PE is (\d+) ${U}, and triangle PES is shaded\. Find the probability that a point picked at random inside rectangle PQRS is inside triangle PES\. Give the probability as a fraction\.$`).exec(body))) {
    const l = whole(f[1]!)
    const w = whole(f[3]!)
    const b = whole(f[5]!)
    // A right triangle at the corner P: half of PE times PS, over the rectangle.
    want = R(div(mul(rat(1, 2), mul(b, w)), mul(l, w)))
    near(dist(a, 'P', 'Q'), num(l), 'PQ')
    near(dist(a, 'R', 'S'), num(l), 'RS')
    near(dist(a, 'Q', 'R'), num(w), 'QR')
    near(dist(a, 'S', 'P'), num(w), 'SP')
    near(dist(a, 'P', 'R'), Math.hypot(num(l), num(w)), 'diagonal PR')
    onSegment(a, 'E', 'P', 'Q')
    near(dist(a, 'P', 'E'), num(b), 'PE')
    segLabel(a, 'E', 'S')
    requireLabels(a, { PE: f[5]!, QR: f[3]!, RS: f[1]! })
    requireLoops(a, ['polygon PES'])
  } else throw new Error(`unreadable prompt: ${a.prompt}`)
  check(a, [want])
  requireRatioParts(a, false)
  if (pi !== a.stages[0]!.answerText.includes('π')) throw new Error('π in the answer does not match the prompt')
  for (const s of a.stages) if (s.lowest) throw new Error('a probability asks for lowest terms')
}

const SOLVERS: Record<string, (a: GeometryAnswer) => void> = { 'ra.shared': solveShared, 'ra.similar': solveSimilar, 'ra.shaded': solveShaded, 'ra.chance': solveChance }

describe('unit 9 area ratios solved again from the wording', () => {
  describe.each(Object.keys(SOLVERS))('%s', (template) => {
    it(
      'decides every answer from the given numbers and requires a real configuration',
      () => {
        const bad: string[] = []
        for (const seed of SEEDS) {
          const p = generateProblem('geoAreaRatios', template, seed)
          if (p.answer.type !== 'geometry') throw new Error('not geometry')
          const a = p.answer
          if (/\[object|undefined|NaN/.test(`${a.prompt}\n${a.figure.ariaLabel}`)) bad.push(`${template}/${seed}: broken text`)
          try {
            SOLVERS[template]!(a)
          } catch (e) {
            bad.push(`${template}/${seed}: ${e instanceof Error ? e.message : String(e)}\n${a.prompt}`)
            if (bad.length >= 6) break
          }
        }
        expect(bad.join('\n---\n')).toBe('')
      },
      HEAVY,
    )
  })
})

