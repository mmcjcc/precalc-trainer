/**
 * Unit 8 solved again from what she reads. Each prompt is parsed here, and the answer is decided with plain
 * arithmetic (half an arc, half a sum, half a difference, a product, a distance). The figure has to be that same
 * configuration: arcs positive and summing to a full turn, triangle inequalities, tangents actually perpendicular,
 * products consistent, and every rim point on the circle.
 *
 * Drawn coordinates are stored to six decimals (`pointOf`), so a point that was on the circle before packing can
 * sit about a millionth off. The on-circle check is 1e-5, which is tighter than that rounding and is as tight as
 * the stored points can pass. The circle's own radius, when the prompt states it, is checked to 1e-9.
 *
 * This file imports no generator helper. `params.mode` is not consulted.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoPoint, ModuleId } from '@/shared/types'

const N = 300
const SEEDS = Array.from({ length: N }, (_, i) => i + 1)
const HEAVY = 120_000
const MINUS = '\u2212'
/** Stored points are rounded to 1e-6, so 1e-9 cannot pass. 1e-5 still rejects a point that missed the circle. */
const ON = 1e-5
const LEN = 0.02
const ANG = 0.4
const CM = '(?: cm)?'

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed}`)
  return p.answer
}

function pt(a: GeometryAnswer, id: string): GeoPoint {
  const p = a.figure.points.find((q) => q.id === id)
  if (!p) throw new Error(`no point ${id}`)
  return p
}

function dist(a: GeometryAnswer, i: string, j: string): number {
  const p = pt(a, i)
  const q = pt(a, j)
  return Math.hypot(p.x - q.x, p.y - q.y)
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

function near(got: number, want: number, tol: number, what: string) {
  if (Math.abs(got - want) > tol) throw new Error(`${what}: got ${got}, want ${want} (tol ${tol})`)
}

function circleR(a: GeometryAnswer): number {
  const c = a.figure.circles?.[0]
  if (!c || c.center !== 'O') throw new Error('no circle centered at O')
  return c.r
}

function onRim(a: GeometryAnswer, id: string) {
  near(dist(a, 'O', id), circleR(a), ON, `${id} on the circle`)
}

function outside(a: GeometryAnswer, id: string) {
  if (!(dist(a, 'O', id) > circleR(a) + 0.05)) throw new Error(`${id} is not outside the circle`)
}

function inside(a: GeometryAnswer, id: string) {
  if (!(dist(a, 'O', id) < circleR(a) - 0.15)) throw new Error(`${id} is not inside the circle`)
}

function between(a: GeometryAnswer, mid: string, i: string, j: string) {
  near(dist(a, i, mid) + dist(a, mid, j), dist(a, i, j), 0.05, `${mid} between ${i}${j}`)
  if (dist(a, i, mid) < 0.2 || dist(a, mid, j) < 0.2) throw new Error(`${mid} is not strictly between ${i} and ${j}`)
}

/** Positive central gaps around the circle, summing to 360°. */
function fullTurn(a: GeometryAnswer, ids: string[]) {
  const o = pt(a, 'O')
  const degs = ids
    .map((id) => {
      const p = pt(a, id)
      let d = (Math.atan2(p.y - o.y, p.x - o.x) * 180) / Math.PI
      if (d < 0) d += 360
      return d
    })
    .sort((p, q) => p - q)
  let sum = 0
  for (let i = 0; i < degs.length; i++) {
    const gap = (degs[(i + 1) % degs.length]! - degs[i]! + 360) % 360
    if (gap <= 0.4) throw new Error(`a central gap is ${gap}`)
    sum += gap
  }
  near(sum, 360, 0.3, 'arcs around the circle')
}

function ccw(a: GeometryAnswer, from: string, to: string): number {
  const o = pt(a, 'O')
  const A = pt(a, from)
  const B = pt(a, to)
  let d = ((Math.atan2(B.y - o.y, B.x - o.x) - Math.atan2(A.y - o.y, A.x - o.x)) * 180) / Math.PI
  if (d < 0) d += 360
  return d
}

function minor(a: GeometryAnswer, from: string, to: string): number {
  const d = ccw(a, from, to)
  return Math.min(d, 360 - d)
}

function triangle(x: number, y: number, z: number) {
  if (!(x > 0 && y > 0 && z > 0 && x + y > z && x + z > y && y + z > x)) throw new Error(`not a triangle: ${x}, ${y}, ${z}`)
}

function rightMarked(a: GeometryAnswer, vertex: string) {
  const marks = (a.figure.angles ?? []).filter((g) => g.right && g.vertex === vertex)
  if (marks.length === 0) throw new Error(`no right angle marked at ${vertex}`)
  for (const g of marks) near(ang(a, g.vertex, g.from, g.to), 90, ANG, `right angle at ${vertex}`)
}

function noRight(a: GeometryAnswer) {
  if ((a.figure.angles ?? []).some((g) => g.right)) throw new Error('a right angle is marked')
}

function stage(a: GeometryAnswer, id: string) {
  const s = a.stages.find((x) => x.id === id)
  if (!s) throw new Error(`no stage ${id}`)
  return s
}

function expectText(a: GeometryAnswer, id: string, text: string) {
  const got = stage(a, id).answerText
  if (got !== text) throw new Error(`stage ${id}: got ${got}, want ${text}`)
}

function expectChoice(a: GeometryAnswer, choiceId: string) {
  const s = stage(a, 'a')
  if (s.kind !== 'choice') throw new Error(`stage is ${s.kind}`)
  if (s.answerText !== choiceId) throw new Error(`choice got ${s.answerText}, want ${choiceId}`)
  const texts = s.choices?.map((c) => c.text) ?? []
  if (new Set(texts).size !== texts.length) throw new Error(`choices repeat: ${texts.join(' | ')}`)
}

function whole(n: number): string {
  if (!Number.isInteger(n) || n <= 0) throw new Error(`not a positive integer: ${n}`)
  return String(n)
}

/** Simplest radical of a positive integer, or the integer when the radicand is a perfect square. */
function radicalText(under: number): string {
  if (!Number.isInteger(under) || under <= 0) throw new Error(`bad radicand ${under}`)
  let coeff = 1
  let r = under
  for (let f = 2; f * f <= r; ) {
    const sq = f * f
    if (r % sq === 0) {
      r /= sq
      coeff *= f
    } else f += f === 2 ? 1 : 2
  }
  if (r === 1) return String(coeff)
  return coeff === 1 ? `√${r}` : `${coeff}√${r}`
}

function parseLin(expr: string): { a: number; b: number } {
  const t = expr.trim().replace(new RegExp(MINUS, 'g'), '-').replace(/\s+/g, '')
  const m = /^(-?\d*)x(?:([+-])(\d+))?$/.exec(t)
  if (!m) throw new Error(`not a linear expression: ${expr}`)
  const coeff = m[1] === '' ? 1 : m[1] === '-' ? -1 : Number(m[1])
  const b = m[2] ? (m[2] === '-' ? -Number(m[3]) : Number(m[3])) : 0
  return { a: coeff, b }
}

function evalLin(expr: string, x: number): number {
  const e = parseLin(expr)
  return e.a * x + e.b
}

function solvePair(left: string, right: string): number {
  const L = parseLin(left)
  const R = parseLin(right)
  if (L.a === R.a) throw new Error(`expressions have the same slope: ${left} = ${right}`)
  const x = (R.b - L.b) / (L.a - R.a)
  const xr = Math.round(x)
  if (Math.abs(x - xr) > 1e-6) throw new Error(`x is not an integer from ${left} = ${right}`)
  const v = L.a * xr + L.b
  if (v !== R.a * xr + R.b || !Number.isInteger(v) || v <= 0) throw new Error(`common value ${v} from ${left} = ${right}`)
  return v
}

function parsePt(text: string): { x: number; y: number } {
  const t = text.replace(new RegExp(MINUS, 'g'), '-')
  const m = /^\(?(-?\d+), (-?\d+)\)?$/.exec(t)
  if (!m) throw new Error(`not a point: ${text}`)
  return { x: Number(m[1]), y: Number(m[2]) }
}

function pointAnswer(h: number, k: number): string {
  return `(${h}, ${k})`
}

function sqTerm(v: string, c: number): string {
  if (c === 0) return `${v}²`
  if (c > 0) return `(${v} ${MINUS} ${c})²`
  return `(${v} + ${-c})²`
}

function circleEq(h: number, k: number, right: number): string {
  return `${sqTerm('x', h)} + ${sqTerm('y', k)} = ${right}`
}

function termCenter(v: 'x' | 'y', term: string): number {
  const plain = term.replace(new RegExp(MINUS, 'g'), '-')
  if (plain === `${v}²`) return 0
  const m = new RegExp(`^\\(${v} ([+-]) (\\d+)\\)²$`).exec(plain)
  if (!m) throw new Error(`not a squared term: ${term}`)
  const n = Number(m[2])
  return m[1] === '-' ? n : -n
}

function parseStandard(eq: string): { h: number; k: number; right: number } {
  const m = /^(x²|\(x [+−] \d+\)²) \+ (y²|\(y [+−] \d+\)²) = (\d+)$/.exec(eq.trim())
  if (!m) throw new Error(`not standard form: ${eq}`)
  return { h: termCenter('x', m[1]!), k: termCenter('y', m[2]!), right: Number(m[3]) }
}

function parseGeneral(eq: string): { d: number; e: number; f: number } {
  const t = eq.replace(new RegExp(MINUS, 'g'), '-')
  const m = /^x² \+ y²(.*?) = 0$/.exec(t)
  if (!m) throw new Error(`not general form: ${eq}`)
  let rest = m[1]!
  let d = 0
  let e = 0
  let f = 0
  while (rest.length > 0) {
    const part = /^ ([+-]) (\d*)(x|y)?/.exec(rest)
    if (!part) throw new Error(`leftover “${rest}” in ${eq}`)
    const sign = part[1] === '-' ? -1 : 1
    const mag = part[2] ? Number(part[2]) : 1
    const n = sign * mag
    if (part[3] === 'x') d = n
    else if (part[3] === 'y') e = n
    else f = n
    rest = rest.slice(part[0].length)
  }
  return { d, e, f }
}

function intSqrt(n: number): number {
  const r = Math.round(Math.sqrt(n))
  if (r * r !== n || r <= 0) throw new Error(`${n} is not a positive perfect square`)
  return r
}

function showsNumber(text: string, n: number): boolean {
  return new RegExp(`(?:^|[^0-9])${n}(?![0-9])`).test(text)
}

function equationPicture(a: GeometryAnswer, h: number, k: number, r: number) {
  if (r > 8) throw new Error(`drawn radius ${r} is over 8`)
  near(circleR(a), r, 1e-9, 'circle radius')
  near(pt(a, 'O').x, h, 1e-9, 'center x')
  near(pt(a, 'O').y, k, 1e-9, 'center y')
  onRim(a, 'A')
  for (const p of a.figure.points) if (/\d/.test(p.label ?? '')) throw new Error(`label ${p.label} has a digit`)
}

function miss(prompt: string): never {
  throw new Error(`no pattern matched:\n${prompt}`)
}

function num(text: string): number {
  return Number(text)
}

// --- tangents, arcs, chords ---------------------------------------------------------------------------------

function solveTangent(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = new RegExp(
    `^Circle O has a tangent at the point of tangency T, and ([A-Z]) is outside the circle\\. (.+)\\. The tangent meets the radius at a right angle\\. Find the length of ([A-Z]{2})\\.$`,
  ).exec(p)
  if (m) {
    const who = m[1]!
    const known = m[2]!
    const label = m[3]!
    const tan = new RegExp(`^OT is (\\d+)${CM} and O${who} is (\\d+)${CM}$`).exec(known)
    const rad = new RegExp(`^${who}T is (\\d+)${CM} and O${who} is (\\d+)${CM}$`).exec(known)
    const hyp = new RegExp(`^OT is (\\d+)${CM} and ${who}T is (\\d+)${CM}$`).exec(known)
    let radius: number
    let tangent: number
    let hypotenuse: number
    let under: number
    if (tan) {
      radius = num(tan[1]!)
      hypotenuse = num(tan[2]!)
      under = hypotenuse * hypotenuse - radius * radius
      tangent = Math.sqrt(under)
      if (label !== `${who}T`) throw new Error(`label ${label}`)
    } else if (rad) {
      tangent = num(rad[1]!)
      hypotenuse = num(rad[2]!)
      under = hypotenuse * hypotenuse - tangent * tangent
      radius = Math.sqrt(under)
      if (label !== 'OT') throw new Error(`label ${label}`)
    } else if (hyp) {
      radius = num(hyp[1]!)
      tangent = num(hyp[2]!)
      under = radius * radius + tangent * tangent
      hypotenuse = Math.sqrt(under)
      if (label !== `O${who}`) throw new Error(`label ${label}`)
    } else throw new Error(`unknown lengths: ${known}`)
    triangle(radius, tangent, hypotenuse)
    near(circleR(a), radius, 1e-9, 'radius')
    onRim(a, 'T')
    outside(a, who)
    near(dist(a, 'T', who), tangent, LEN, 'tangent segment')
    near(dist(a, 'O', who), hypotenuse, LEN, 'distance to the center')
    near(ang(a, 'T', 'O', who), 90, ANG, 'tangent perpendicular to the radius')
    rightMarked(a, 'T')
    expectText(a, 'a', radicalText(under))
    return
  }
  m = new RegExp(
    `^Point T is on circle O, and point ([A-Z]) is not the center\\. OT is (\\d+)${CM}, \\1T is (\\d+)${CM}, and O\\1 is (\\d+)${CM}\\. Decide whether \\1T is a tangent of the circle\\.$`,
  ).exec(p)
  if (m) {
    const who = m[1]!
    const ot = num(m[2]!)
    const pt = num(m[3]!)
    const op = num(m[4]!)
    triangle(ot, pt, op)
    const yes = ot * ot + pt * pt === op * op
    near(circleR(a), ot, 1e-9, 'OT is the radius')
    onRim(a, 'T')
    outside(a, who)
    near(dist(a, 'T', who), pt, LEN, 'PT')
    near(dist(a, 'O', who), op, LEN, 'OP')
    noRight(a)
    if (yes) near(ang(a, 'T', 'O', who), 90, ANG, 'right angle at the point of tangency')
    else near(ang(a, 'O', 'T', who), 90, ANG, 'right angle at the center')
    expectChoice(a, yes ? 'yes' : 'no')
    const text = stage(a, 'a').choices!.find((c) => c.id === stage(a, 'a').answerText)!.text
    if (!text.startsWith(yes ? 'Yes.' : 'No.')) throw new Error(text)
    return
  }
  m = /^Two tangent segments from point ([A-Z]) touch circle O at T and at ([A-Z])\. \1T is (.+) and \1\2 is (.+)\. Find the length of each tangent segment\.$/.exec(p)
  if (m) {
    const who = m[1]!
    const b = m[2]!
    const length = solvePair(m[3]!, m[4]!)
    onRim(a, 'T')
    onRim(a, b)
    outside(a, who)
    fullTurn(a, ['T', b])
    near(dist(a, who, 'T'), dist(a, who, b), LEN, 'the two tangent segments')
    near(ang(a, 'T', 'O', who), 90, ANG, 'tangent at T')
    near(ang(a, b, 'O', who), 90, ANG, 'tangent at the other point')
    rightMarked(a, 'T')
    rightMarked(a, b)
    expectText(a, 'a', whole(length))
    return
  }
  m = new RegExp(
    `^Quadrilateral ([A-Z])([A-Z])([A-Z])([A-Z]) is drawn around circle O, so each side is tangent to the circle\\. \\1\\2 is (\\d+)${CM}, \\2\\3 is \\5${CM}, and \\3\\4 is \\5${CM}\\. Find the perimeter of \\1\\2\\3\\4\\.$`,
  ).exec(p)
  if (m) {
    const [A, B, C, D] = [m[1]!, m[2]!, m[3]!, m[4]!]
    const side = num(m[5]!)
    const peri = 4 * side
    near(circleR(a), side / 2, 1e-9, 'inradius')
    onRim(a, 'T')
    for (const id of [A, B, C, D]) outside(a, id)
    for (const [i, j] of [
      [A, B],
      [B, C],
      [C, D],
      [D, A],
    ] as const) {
      near(dist(a, i, j), side, LEN, `side ${i}${j}`)
      const foot = sideDistance(a, i, j)
      near(foot, side / 2, LEN, `tangent side ${i}${j}`)
    }
    expectText(a, 'a', whole(peri))
    return
  }
  miss(p)
}

function sideDistance(a: GeometryAnswer, i: string, j: string): number {
  const o = pt(a, 'O')
  const p = pt(a, i)
  const q = pt(a, j)
  const dx = q.x - p.x
  const dy = q.y - p.y
  return Math.abs((o.x - p.x) * dy - (o.y - p.y) * dx) / Math.hypot(dx, dy)
}

function solveArcs(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = /^O is the center of the circle\. Minor arc A([A-Z]) measures (.+?) degrees, where x is (\d+)\. Find the measure of central angle AO\1\.$/.exec(p)
  if (m) return central(a, m[1]!, evalLin(m[2]!, num(m[3]!)))
  m = /^O is the center of the circle\. Angle AO([A-Z]) is a central angle of (.+?) degrees, where x is (\d+)\. Find the measure of minor arc A\1\.$/.exec(p)
  if (m) return central(a, m[1]!, evalLin(m[2]!, num(m[3]!)))
  m = /^A([A-Z]) is a diameter of circle O\. Find the measure of semicircle A\1\.$/.exec(p)
  if (m) {
    const B = m[1]!
    onRim(a, 'A')
    onRim(a, B)
    fullTurn(a, ['A', B])
    near(ccw(a, 'A', B), 180, ANG, 'diameter')
    near(dist(a, 'A', B), 2 * circleR(a), ON, 'diameter length')
    expectText(a, 'a', '180')
    return
  }
  m = /^O is the center of the circle\. Arc A([A-Z]) measures (\d+) degrees, arc \1([A-Z]) measures (\d+) degrees, and arc \3([A-Z]) measures (\d+) degrees\. Arcs A\1, \1\3, \3\5, and \5A go all the way around the circle\. Find the measure of arc \5A\.$/.exec(p)
  if (m) {
    const [B, C, D] = [m[1]!, m[3]!, m[5]!]
    const arcs = [num(m[2]!), num(m[4]!), num(m[6]!)]
    const rest = 360 - arcs[0]! - arcs[1]! - arcs[2]!
    if (arcs.some((n) => n <= 0) || rest <= 0) throw new Error(`arcs ${arcs.join(', ')} leave ${rest}`)
    for (const id of ['A', B, C, D]) onRim(a, id)
    fullTurn(a, ['A', B, C, D])
    near(ccw(a, 'A', B), arcs[0]!, ANG, 'arc AB')
    near(ccw(a, B, C), arcs[1]!, ANG, 'arc BC')
    near(ccw(a, C, D), arcs[2]!, ANG, 'arc CD')
    near(ccw(a, D, 'A'), rest, ANG, 'arc DA')
    expectText(a, 'a', whole(rest))
    return
  }
  m = /^O is the center of the circle\. Minor arc A([A-Z]) measures (\d+) degrees, and point ([A-Z]) lies on the long way around from A to \1\. Which name is the major arc\?$/.exec(p)
  if (m) {
    const [B, C] = [m[1]!, m[3]!]
    const n = num(m[2]!)
    majorPicture(a, B, C, n)
    expectChoice(a, 'major')
    const text = stage(a, 'a').choices!.find((c) => c.id === 'major')!.text
    if (!text.includes(`A${C}${B}`) || !text.includes('long way')) throw new Error(text)
    return
  }
  m = /^O is the center of the circle\. Minor arc A([A-Z]) measures (\d+) degrees\. Point ([A-Z]) is on the major arc\. Find the measure of major arc A\3\1\.$/.exec(p)
  if (m) {
    const [B, C] = [m[1]!, m[3]!]
    const n = num(m[2]!)
    majorPicture(a, B, C, n)
    expectText(a, 'a', whole(360 - n))
    return
  }
  m = /^In circle O, minor arc A([A-Z]) and minor arc ([A-Z])([A-Z]) have the same measure\. Arc A\1 measures (.+?) degrees and arc \2\3 measures (.+?) degrees\. Find the measure of arc A\1\.$/.exec(p)
  if (m) {
    const [B, C, D] = [m[1]!, m[2]!, m[3]!]
    const measure = solvePair(m[4]!, m[5]!)
    if (measure >= 180) throw new Error(`minor arc ${measure}`)
    for (const id of ['A', B, C, D]) onRim(a, id)
    fullTurn(a, ['A', B, C, D])
    near(minor(a, 'A', B), measure, ANG, 'arc AB')
    near(minor(a, C, D), measure, ANG, 'arc CD')
    expectText(a, 'a', whole(measure))
    return
  }
  miss(p)
}

function central(a: GeometryAnswer, B: string, measure: number) {
  if (!Number.isInteger(measure) || measure <= 0 || measure >= 180) throw new Error(`minor arc ${measure}`)
  onRim(a, 'A')
  onRim(a, B)
  fullTurn(a, ['A', B])
  near(ccw(a, 'A', B), measure, ANG, 'central angle')
  near(minor(a, 'A', B), measure, ANG, 'minor arc')
  expectText(a, 'a', whole(measure))
}

function majorPicture(a: GeometryAnswer, B: string, C: string, n: number) {
  if (n <= 0 || n >= 180) throw new Error(`minor ${n}`)
  for (const id of ['A', B, C]) onRim(a, id)
  fullTurn(a, ['A', B, C])
  near(minor(a, 'A', B), n, ANG, 'minor arc')
  const long = Math.max(ccw(a, 'A', B), ccw(a, B, 'A'))
  near(long, 360 - n, ANG, 'major arc')
  // From B the long way back to A passes through C, so C is on the major arc, not the minor one.
  near(ccw(a, B, C) + ccw(a, C, 'A'), 360 - n, ANG, 'C on the major arc')
}

function solveChords(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = new RegExp(
    `^In circle O, a radius is perpendicular to chord ([A-Z])([A-Z]) and meets the chord at its midpoint ([A-Z])\\. \\1\\3 is (\\d+)${CM} and O\\3 is (\\d+)${CM}\\. Find the length of the radius O\\1\\.$`,
  ).exec(p)
  if (m) {
    const [A, B, M] = [m[1]!, m[2]!, m[3]!]
    const half = num(m[4]!)
    const distance = num(m[5]!)
    const radius = intSqrt(half * half + distance * distance)
    chordPicture(a, A, B, M, radius, half, distance)
    rightMarked(a, M)
    expectText(a, 'a', whole(radius))
    return
  }
  m = new RegExp(
    `^In circle O, a radius is perpendicular to chord ([A-Z])([A-Z]) and meets the chord at its midpoint ([A-Z])\\. The radius O\\1 is (\\d+)${CM} and chord \\1\\2 is (\\d+)${CM}\\. Find the distance from O to the chord\\.$`,
  ).exec(p)
  if (m) {
    const [A, B, M] = [m[1]!, m[2]!, m[3]!]
    const radius = num(m[4]!)
    const chord = num(m[5]!)
    if (chord % 2 !== 0) throw new Error(`chord ${chord} is odd`)
    const half = chord / 2
    const under = radius * radius - half * half
    const distance = Math.sqrt(under)
    chordPicture(a, A, B, M, radius, half, distance)
    rightMarked(a, M)
    expectText(a, 'a', radicalText(under))
    return
  }
  m = new RegExp(
    `^In circle O, a radius is perpendicular to chord ([A-Z])([A-Z]) and meets the chord at its midpoint ([A-Z])\\. The radius O\\1 is (\\d+)${CM} and O\\3 is (\\d+)${CM}\\. Find the length of \\1\\3\\.$`,
  ).exec(p)
  if (m) {
    const [A, B, M] = [m[1]!, m[2]!, m[3]!]
    const radius = num(m[4]!)
    const distance = num(m[5]!)
    const under = radius * radius - distance * distance
    const half = Math.sqrt(under)
    chordPicture(a, A, B, M, radius, half, distance)
    rightMarked(a, M)
    expectText(a, 'a', radicalText(under))
    return
  }
  m = /^In circle O, chord A([A-Z]) and chord ([A-Z])([A-Z]) have the same length\. A\1 is (.+?) and \2\3 is (.+?)\. Find the length of A\1\.$/.exec(p)
  if (m) {
    const [B, C, D] = [m[1]!, m[2]!, m[3]!]
    const length = solvePair(m[4]!, m[5]!)
    for (const id of ['A', B, C, D]) onRim(a, id)
    fullTurn(a, ['A', B, C, D])
    near(dist(a, 'A', B), length, LEN, 'chord AB')
    near(dist(a, C, D), length, LEN, 'chord CD')
    expectText(a, 'a', whole(length))
    return
  }
  miss(p)
}

function chordPicture(a: GeometryAnswer, A: string, B: string, M: string, radius: number, half: number, distance: number) {
  triangle(half, distance, radius)
  near(circleR(a), radius, 1e-9, 'radius')
  onRim(a, A)
  onRim(a, B)
  inside(a, M)
  between(a, M, A, B)
  near(dist(a, A, M), half, LEN, 'half chord')
  near(dist(a, B, M), half, LEN, 'other half')
  near(dist(a, 'O', M), distance, LEN, 'distance to the chord')
  near(ang(a, M, 'O', A), 90, ANG, 'radius perpendicular to the chord')
}

// --- angles -------------------------------------------------------------------------------------------------

function solveInscribed(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = /^Inscribed angle ([A-Z])([A-Z])([A-Z]) intercepts arc \1\3, which measures (\d+) degrees\. Find the measure of angle \1\2\3\.$/.exec(p)
  if (m) {
    const [A, B, C] = [m[1]!, m[2]!, m[3]!]
    const arc = num(m[4]!)
    inscribedPicture(a, A, B, C, arc, arc / 2)
    expectText(a, 'a', whole(arc / 2))
    return
  }
  m = /^Inscribed angle ([A-Z])([A-Z])([A-Z]) intercepts arc \1\3 and measures (\d+) degrees\. Find the measure of arc \1\3\.$/.exec(p)
  if (m) {
    const [A, B, C] = [m[1]!, m[2]!, m[3]!]
    const angle = num(m[4]!)
    inscribedPicture(a, A, B, C, angle * 2, angle)
    expectText(a, 'a', whole(angle * 2))
    return
  }
  m = /^A([A-Z]) is a diameter of circle O, and ([A-Z]) is on the circle, so triangle A\1\2 is inscribed in a semicircle\. Angle \1A\2 measures (\d+) degrees\. Find the measure of angle A\1\2\.$/.exec(p)
  if (m) {
    const [B, C] = [m[1]!, m[2]!]
    const alpha = num(m[3]!)
    const answer = 90 - alpha
    for (const id of ['A', B, C]) onRim(a, id)
    fullTurn(a, ['A', B, C])
    near(ccw(a, 'A', B) === 180 ? 180 : ccw(a, B, 'A'), 180, ANG, 'diameter')
    near(dist(a, 'A', B), 2 * circleR(a), ON, 'diameter length')
    near(ang(a, C, 'A', B), 90, ANG, 'angle in a semicircle')
    near(ang(a, 'A', B, C), alpha, ANG, 'given angle')
    near(ang(a, B, 'A', C), answer, ANG, 'third angle')
    noRight(a)
    triangle(dist(a, 'A', B), dist(a, B, C), dist(a, C, 'A'))
    expectText(a, 'a', whole(answer))
    return
  }
  m = /^Quadrilateral A([A-Z])([A-Z])([A-Z]) is inscribed in circle O\. Angle A\3\2 measures (\d+) degrees\. Find the measure of angle A\1\2\.$/.exec(p)
  if (m) {
    const [D, C, B] = [m[1]!, m[2]!, m[3]!]
    const g = num(m[4]!)
    const answer = 180 - g
    for (const id of ['A', D, C, B]) onRim(a, id)
    fullTurn(a, ['A', D, C, B])
    near(ang(a, B, 'A', C), g, ANG, 'given opposite angle')
    near(ang(a, D, 'A', C), answer, ANG, 'other opposite angle')
    near(ang(a, B, 'A', C) + ang(a, D, 'A', C), 180, ANG, 'opposite angles')
    expectText(a, 'a', whole(answer))
    return
  }
  miss(p)
}

function inscribedPicture(a: GeometryAnswer, A: string, B: string, C: string, arc: number, angle: number) {
  if (arc <= 0 || arc >= 180 || angle * 2 !== arc) throw new Error(`arc ${arc} angle ${angle}`)
  for (const id of [A, B, C]) onRim(a, id)
  fullTurn(a, [A, B, C])
  near(minor(a, A, C), arc, ANG, 'intercepted arc')
  near(ang(a, B, A, C), angle, ANG, 'inscribed angle')
}

function solveInside(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = /^Chords A([A-Z]) and ([A-Z])([A-Z]) cross at point ([A-Z]) inside circle O\. Arc A\2 measures (\d+) degrees and arc \1\3 measures (\d+) degrees\. Find the measure of angle A\4\2\.$/.exec(p)
  if (m) {
    const [Y, X, Z, E] = [m[1]!, m[2]!, m[3]!, m[4]!]
    const arc1 = num(m[5]!)
    const arc2 = num(m[6]!)
    const angle = (arc1 + arc2) / 2
    crossPicture(a, Y, X, Z, E, arc1, arc2, angle)
    expectText(a, 'a', whole(angle))
    return
  }
  m = /^Chords A([A-Z]) and ([A-Z])([A-Z]) cross at point ([A-Z]) inside circle O\. Angle A\4\2 measures (\d+) degrees, and arc A\2 measures (\d+) degrees\. Find the measure of arc \1\3\.$/.exec(p)
  if (m) {
    const [Y, X, Z, E] = [m[1]!, m[2]!, m[3]!, m[4]!]
    const angle = num(m[5]!)
    const arc1 = num(m[6]!)
    const arc2 = 2 * angle - arc1
    crossPicture(a, Y, X, Z, E, arc1, arc2, angle)
    expectText(a, 'a', whole(arc2))
    return
  }
  m = /^A tangent and chord T([A-Z]) meet at the point of tangency T\. The tangent meets radius OT at a right angle\. Intercepted arc T\1 measures (\d+) degrees\. Find the measure of the angle formed by the tangent and the chord\.$/.exec(p)
  if (m) {
    const A = m[1]!
    const arc = num(m[2]!)
    tangentChordPicture(a, A, arc, arc / 2)
    expectText(a, 'a', whole(arc / 2))
    return
  }
  m = /^A tangent and a chord meet at the point of tangency T\. The tangent meets radius OT at a right angle, and the angle formed by the tangent and chord T([A-Z]) measures (\d+) degrees\. Find the measure of intercepted arc T\1\.$/.exec(p)
  if (m) {
    const A = m[1]!
    const angle = num(m[2]!)
    tangentChordPicture(a, A, angle * 2, angle)
    expectText(a, 'a', whole(angle * 2))
    return
  }
  miss(p)
}

function crossPicture(a: GeometryAnswer, Y: string, X: string, Z: string, E: string, arc1: number, arc2: number, angle: number) {
  if (arc1 <= 0 || arc2 <= 0 || arc1 + arc2 >= 360 || angle * 2 !== arc1 + arc2) throw new Error(`arcs ${arc1}, ${arc2}`)
  for (const id of ['A', X, Y, Z]) onRim(a, id)
  fullTurn(a, ['A', X, Y, Z])
  near(ccw(a, 'A', X), arc1, ANG, 'arc AX')
  near(ccw(a, Y, Z), arc2, ANG, 'arc YZ')
  inside(a, E)
  between(a, E, 'A', Y)
  between(a, E, X, Z)
  near(ang(a, E, 'A', X), angle, ANG, 'angle inside the circle')
}

function tangentChordPicture(a: GeometryAnswer, A: string, arc: number, angle: number) {
  if (arc <= 0 || arc >= 180 || angle * 2 !== arc) throw new Error(`arc ${arc}`)
  onRim(a, 'T')
  onRim(a, A)
  fullTurn(a, ['T', A])
  outside(a, 'P')
  near(minor(a, 'T', A), arc, ANG, 'intercepted arc')
  near(ang(a, 'T', 'O', 'P'), 90, ANG, 'radius perpendicular to the tangent')
  near(ang(a, 'T', 'P', A), angle, ANG, 'tangent-chord angle')
  rightMarked(a, 'T')
}

function solveOutside(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = /^Two secants from point ([A-Z]) meet circle O\. One passes through A and ([A-Z]), and the other through ([A-Z]) and ([A-Z])\. Near arc A\3 measures (\d+) degrees and far arc \2\4 measures (\d+) degrees\. Find the measure of angle A\1\3\.$/.exec(p)
  if (m) {
    const [P, D, C, B] = [m[1]!, m[2]!, m[3]!, m[4]!]
    const nearArc = num(m[5]!)
    const farArc = num(m[6]!)
    const angle = (farArc - nearArc) / 2
    secantPicture(a, P, D, C, B, nearArc, farArc, angle)
    expectText(a, 'a', whole(angle))
    return
  }
  m = /^Two secants from point ([A-Z]) meet circle O\. One passes through A and ([A-Z]), and the other through ([A-Z]) and ([A-Z])\. Angle A\1\3 measures (\d+) degrees, and near arc A\3 measures (\d+) degrees\. Find the measure of far arc \2\4\.$/.exec(p)
  if (m) {
    const [P, D, C, B] = [m[1]!, m[2]!, m[3]!, m[4]!]
    const angle = num(m[5]!)
    const nearArc = num(m[6]!)
    const farArc = nearArc + 2 * angle
    secantPicture(a, P, D, C, B, nearArc, farArc, angle)
    expectText(a, 'a', whole(farArc))
    return
  }
  m = /^A secant and a tangent are drawn from point ([A-Z])\. The tangent touches circle O at T, and the secant passes through ([A-Z]) and ([A-Z])\. The near intercepted arc from T to \2 measures (\d+) degrees and far arc T\3 measures (\d+) degrees\. Find the measure of angle T\1\2\.$/.exec(p)
  if (m) {
    const [P, A, B] = [m[1]!, m[2]!, m[3]!]
    const nearArc = num(m[4]!)
    const farArc = num(m[5]!)
    const angle = (farArc - nearArc) / 2
    secantTangentPicture(a, P, A, B, nearArc, farArc, angle)
    expectText(a, 'a', whole(angle))
    return
  }
  m = /^A secant and a tangent are drawn from point ([A-Z])\. The tangent touches circle O at T, and the secant passes through ([A-Z]) and ([A-Z])\. Angle T\1\2 measures (\d+) degrees, and the near arc from T to \2 measures (\d+) degrees\. Find the measure of far arc T\3\.$/.exec(p)
  if (m) {
    const [P, A, B] = [m[1]!, m[2]!, m[3]!]
    const angle = num(m[4]!)
    const nearArc = num(m[5]!)
    const farArc = nearArc + 2 * angle
    secantTangentPicture(a, P, A, B, nearArc, farArc, angle)
    expectText(a, 'a', whole(farArc))
    return
  }
  m = /^Two tangents from point ([A-Z]) touch circle O at T and at ([A-Z])\. Minor arc T\2 measures (\d+) degrees, and the two intercepted arcs make one full turn\. Find the measure of angle T\1\2\.$/.exec(p)
  if (m) {
    const [P, B] = [m[1]!, m[2]!]
    const nearArc = num(m[3]!)
    const angle = 180 - nearArc
    twoTangentPicture(a, P, B, nearArc, angle)
    expectText(a, 'a', whole(angle))
    return
  }
  m = /^Two tangents from point ([A-Z]) touch circle O at T and at ([A-Z])\. Angle T\1\2 measures (\d+) degrees, and the two intercepted arcs make one full turn\. Find the measure of minor arc T\2\.$/.exec(p)
  if (m) {
    const [P, B] = [m[1]!, m[2]!]
    const angle = num(m[3]!)
    const nearArc = 180 - angle
    twoTangentPicture(a, P, B, nearArc, angle)
    expectText(a, 'a', whole(nearArc))
    return
  }
  miss(p)
}

function secantPicture(a: GeometryAnswer, P: string, D: string, C: string, B: string, nearArc: number, farArc: number, angle: number) {
  if (nearArc <= 0 || farArc <= 0 || farArc <= nearArc || nearArc + farArc >= 360 || angle * 2 !== farArc - nearArc) {
    throw new Error(`arcs ${nearArc}, ${farArc}`)
  }
  for (const id of ['A', C, B, D]) onRim(a, id)
  fullTurn(a, ['A', C, B, D])
  outside(a, P)
  between(a, 'A', P, D)
  between(a, C, P, B)
  near(minor(a, 'A', C), nearArc, ANG, 'near arc')
  near(minor(a, D, B), farArc, ANG, 'far arc')
  near(ang(a, P, 'A', C), angle, ANG, 'outside angle')
}

function secantTangentPicture(a: GeometryAnswer, P: string, A: string, B: string, nearArc: number, farArc: number, angle: number) {
  if (nearArc <= 0 || farArc <= 0 || farArc <= nearArc || nearArc + farArc >= 360 || angle * 2 !== farArc - nearArc) {
    throw new Error(`arcs ${nearArc}, ${farArc}`)
  }
  for (const id of ['T', A, B]) onRim(a, id)
  fullTurn(a, ['T', A, B])
  outside(a, P)
  between(a, A, P, B)
  near(minor(a, 'T', A), nearArc, ANG, 'near arc')
  near(minor(a, 'T', B), farArc, ANG, 'far arc')
  near(ang(a, 'T', 'O', P), 90, ANG, 'tangent perpendicular to the radius')
  near(ang(a, P, 'T', A), angle, ANG, 'outside angle')
  rightMarked(a, 'T')
}

function twoTangentPicture(a: GeometryAnswer, P: string, B: string, nearArc: number, angle: number) {
  const farArc = 360 - nearArc
  if (nearArc <= 0 || farArc <= 0 || nearArc + farArc !== 360 || angle !== 180 - nearArc) throw new Error(`near ${nearArc}`)
  onRim(a, 'T')
  onRim(a, B)
  fullTurn(a, ['T', B])
  outside(a, P)
  near(minor(a, 'T', B), Math.min(nearArc, farArc), ANG, 'minor arc between the points of tangency')
  near(ang(a, 'T', 'O', P), 90, ANG, 'tangent at T')
  near(ang(a, B, 'O', P), 90, ANG, 'tangent at the other point')
  near(ang(a, P, 'T', B), angle, ANG, 'angle of two tangents')
  rightMarked(a, 'T')
  rightMarked(a, B)
}

// --- lengths and equations ----------------------------------------------------------------------------------

function solveLengths(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = /^Chords A([A-Z]) and ([A-Z])([A-Z]) cross at ([A-Z]) inside circle O\. (.+), (.+), and (.+)\. Find the length of ([A-Z]{2})\.$/.exec(p)
  if (m) {
    const [B, C, D, E] = [m[1]!, m[2]!, m[3]!, m[4]!]
    const asked = m[8]!
    const known = new Map<string, number>()
    for (const bit of [m[5]!, m[6]!, m[7]!]) {
      const part = new RegExp(`^([A-Z]{2}) is (\\d+)${CM}$`).exec(bit)
      if (!part) throw new Error(`not a chord part: ${bit}`)
      known.set(part[1]!, num(part[2]!))
    }
    const names = [`A${E}`, `${E}${B}`, `${C}${E}`, `${E}${D}`]
    if (known.size !== 3 || !names.includes(asked) || known.has(asked)) throw new Error(`parts ${[...known.keys()].join(', ')} asked ${asked}`)
    const val = (name: string) => (name === asked ? undefined : known.get(name))
    const ae = val(names[0]!)
    const eb = val(names[1]!)
    const ce = val(names[2]!)
    const ed = val(names[3]!)
    const answer = chordPart(ae, eb, ce, ed)
    known.set(asked, answer)
    for (const id of ['A', B, C, D]) onRim(a, id)
    fullTurn(a, ['A', B, C, D])
    inside(a, E)
    between(a, E, 'A', B)
    between(a, E, C, D)
    near(dist(a, 'A', E), known.get(names[0]!)!, LEN, names[0]!)
    near(dist(a, E, B), known.get(names[1]!)!, LEN, names[1]!)
    near(dist(a, C, E), known.get(names[2]!)!, LEN, names[2]!)
    near(dist(a, E, D), known.get(names[3]!)!, LEN, names[3]!)
    const left = known.get(names[0]!)! * known.get(names[1]!)!
    const right = known.get(names[2]!)! * known.get(names[3]!)!
    if (left !== right) throw new Error(`products ${left} and ${right}`)
    expectText(a, 'a', whole(answer))
    return
  }
  m = new RegExp(
    `^Two secants are drawn from point ([A-Z])\\. One meets circle O at A and ([A-Z])\\. The outside part \\1A is (\\d+)${CM} and the whole secant \\1\\2 is (\\d+)${CM}\\. The other meets the circle at ([A-Z]) and ([A-Z]), and the outside part \\1\\5 is (\\d+)${CM}\\. Find the length of the inside part \\5\\6\\.$`,
  ).exec(p)
  if (m) return secantLengths(a, m, true)
  m = new RegExp(
    `^Two secants are drawn from point ([A-Z])\\. One meets circle O at A and ([A-Z])\\. The outside part \\1A is (\\d+)${CM} and the whole secant \\1\\2 is (\\d+)${CM}\\. The other meets the circle at ([A-Z]) and ([A-Z]), and the outside part \\1\\5 is (\\d+)${CM}\\. Find the length of the whole secant \\1\\6\\.$`,
  ).exec(p)
  if (m) return secantLengths(a, m, false)
  m = new RegExp(
    `^A tangent and a secant are drawn from point ([A-Z])\\. The tangent touches circle O at T and meets the radius at a right angle there\\. The secant meets the circle at ([A-Z]) and ([A-Z])\\. The outside part \\1\\2 is (\\d+)${CM} and the whole secant \\1\\3 is (\\d+)${CM}\\. Find the length of tangent \\1T\\.$`,
  ).exec(p)
  if (m) {
    const [P, A, B] = [m[1]!, m[2]!, m[3]!]
    const outsidePart = num(m[4]!)
    const whole = num(m[5]!)
    const under = outsidePart * whole
    tangentSecantPicture(a, P, A, B, Math.sqrt(under), outsidePart, whole)
    expectText(a, 'a', radicalText(under))
    return
  }
  m = new RegExp(
    `^A tangent and a secant are drawn from point ([A-Z])\\. The tangent \\1T is (\\d+)${CM} and meets the radius at a right angle at T\\. The secant meets circle O at ([A-Z]) and ([A-Z]), and the outside part \\1\\3 is (\\d+)${CM}\\. Find the length of the inside part \\3\\4\\.$`,
  ).exec(p)
  if (m) {
    const P = m[1]!
    const tangent = num(m[2]!)
    const A = m[3]!
    const B = m[4]!
    const outsidePart = num(m[5]!)
    if ((tangent * tangent) % outsidePart !== 0) throw new Error('the whole secant is not a whole number')
    const wholeSecant = (tangent * tangent) / outsidePart
    const insidePart = wholeSecant - outsidePart
    if (insidePart <= 0) throw new Error(`inside ${insidePart}`)
    tangentSecantPicture(a, P, A, B, tangent, outsidePart, wholeSecant)
    expectText(a, 'a', whole(insidePart))
    return
  }
  miss(p)
}

function chordPart(ae?: number, eb?: number, ce?: number, ed?: number): number {
  const known = [ae, eb, ce, ed].filter((n) => n !== undefined).length
  if (known !== 3) throw new Error('need three chord parts')
  let answer: number
  if (ae === undefined) answer = (ce! * ed!) / eb!
  else if (eb === undefined) answer = (ce! * ed!) / ae
  else if (ce === undefined) answer = (ae * eb) / ed!
  else answer = (ae * eb) / ce!
  if (!Number.isInteger(answer) || answer <= 0) throw new Error(`chord part ${answer}`)
  return answer
}

function secantLengths(a: GeometryAnswer, m: RegExpExecArray, askInside: boolean) {
  // Groups: 1 P, 2 B, 3 outside1, 4 whole1, 5 C, 6 D, 7 outside2.
  const P = m[1]!
  const B = m[2]!
  const outside1 = num(m[3]!)
  const whole1 = num(m[4]!)
  const Cid = m[5]!
  const Did = m[6]!
  const outside2 = num(m[7]!)
  if ((outside1 * whole1) % outside2 !== 0) throw new Error('product does not divide')
  const whole2 = (outside1 * whole1) / outside2
  const inside2 = whole2 - outside2
  if (inside2 <= 0) throw new Error(`inside ${inside2}`)
  for (const id of ['A', B, Cid, Did]) onRim(a, id)
  fullTurn(a, ['A', B, Cid, Did])
  outside(a, P)
  between(a, 'A', P, B)
  between(a, Cid, P, Did)
  near(dist(a, P, 'A'), outside1, LEN, 'PA')
  near(dist(a, P, B), whole1, LEN, 'PB')
  near(dist(a, P, Cid), outside2, LEN, 'PC')
  near(dist(a, P, Did), whole2, LEN, 'PD')
  if (outside1 * whole1 !== outside2 * whole2) throw new Error('secant products differ')
  expectText(a, 'a', whole(askInside ? inside2 : whole2))
}

function tangentSecantPicture(a: GeometryAnswer, P: string, A: string, B: string, tangent: number, outsidePart: number, whole: number) {
  if (outsidePart <= 0 || whole <= outsidePart) throw new Error(`secant ${outsidePart}, ${whole}`)
  for (const id of ['T', A, B]) onRim(a, id)
  fullTurn(a, ['T', A, B])
  outside(a, P)
  between(a, A, P, B)
  near(dist(a, P, 'T'), tangent, LEN, 'tangent')
  near(dist(a, P, A), outsidePart, LEN, 'outside part')
  near(dist(a, P, B), whole, LEN, 'whole secant')
  near(dist(a, P, 'T') ** 2, dist(a, P, A) * dist(a, P, B), 0.05, 'tangent-secant product')
  near(ang(a, 'T', 'O', P), 90, ANG, 'tangent perpendicular to the radius')
  rightMarked(a, 'T')
}

function solveEquation(a: GeometryAnswer) {
  const p = a.prompt
  let m: RegExpExecArray | null
  m = /^Point ([A-Z]) is \((.+?)\), and it lies on circle O\. The center is \((.+?)\)\. Write the standard form of the equation of the circle\.$/.exec(p)
  if (m) {
    const letter = m[1]!
    const spot = parsePt(m[2]!)
    const center = parsePt(m[3]!)
    const dx = spot.x - center.x
    const dy = spot.y - center.y
    const right = dx * dx + dy * dy
    const r = intSqrt(right)
    const correct = circleEq(center.x, center.y, right)
    equationChoices(a, correct, circleEq(-center.x, -center.y, right), circleEq(center.x, center.y, r), circleEq(center.x, center.y, 4 * right))
    equationPicture(a, center.x, center.y, r)
    onRim(a, letter)
    near(pt(a, letter).x, spot.x, 1e-6, 'point x')
    near(pt(a, letter).y, spot.y, 1e-6, 'point y')
    return
  }
  m = /^Write the standard form of the equation of a circle with center \((.+?)\) and radius (\d+)\.$/.exec(p)
  if (m) {
    const center = parsePt(m[1]!)
    const r = num(m[2]!)
    const correct = circleEq(center.x, center.y, r * r)
    equationChoices(a, correct, circleEq(-center.x, -center.y, r * r), circleEq(center.x, center.y, r), circleEq(center.x, center.y, 4 * r * r))
    equationPicture(a, center.x, center.y, r)
    return
  }
  m = /^The standard form of the equation of circle O is (.+)\. Point ([A-Z]) is \((.+?)\)\. Decide where point \2 is\.$/.exec(p)
  if (m) {
    const eq = parseStandard(m[1]!)
    const letter = m[2]!
    const spot = parsePt(m[3]!)
    const r = intSqrt(eq.right)
    const d2 = (spot.x - eq.h) ** 2 + (spot.y - eq.k) ** 2
    const kind = d2 === eq.right ? 'on' : d2 < eq.right ? 'in' : 'out'
    const sentences: Record<string, string> = {
      on: `Point ${letter} is on the circle.`,
      in: `Point ${letter} is in the interior.`,
      out: `Point ${letter} is in the exterior.`,
    }
    expectChoice(a, kind)
    const chosen = stage(a, 'a').choices!.find((c) => c.id === kind)
    if (chosen?.text !== sentences[kind]) throw new Error(chosen?.text ?? 'missing choice')
    equationPicture(a, eq.h, eq.k, r)
    near(pt(a, letter).x, spot.x, 1e-6, 'tested point x')
    near(pt(a, letter).y, spot.y, 1e-6, 'tested point y')
    const drawn = dist(a, 'O', letter)
    if (kind === 'on') near(drawn, r, ON, 'point on the circle')
    else if (kind === 'in') {
      if (!(drawn < r - 0.4)) throw new Error('point is not inside')
    } else if (!(drawn > r + 0.4)) throw new Error('point is not outside')
    return
  }
  m = /^The standard form of the equation of circle O is (.+)\. Find the center, then the radius\.$/.exec(p)
  if (m) {
    const eq = parseStandard(m[1]!)
    const r = intSqrt(eq.right)
    equationPicture(a, eq.h, eq.k, r)
    expectText(a, 'a', pointAnswer(eq.h, eq.k))
    expectText(a, 'b', whole(r))
    if (showsNumber(stage(a, 'a').reveal.join('\n'), r)) throw new Error('the center worked line shows the radius')
    return
  }
  m = /^The equation (.+) is a circle\. Find the center, then the radius\.$/.exec(p)
  if (m) {
    const g = parseGeneral(m[1]!)
    if (g.d % 2 !== 0 || g.e % 2 !== 0) throw new Error(`coefficients ${g.d}, ${g.e} are not even`)
    const h = -g.d / 2
    const k = -g.e / 2
    if (!Number.isInteger(h) || !Number.isInteger(k)) throw new Error(`center ${h}, ${k}`)
    const right = h * h + k * k - g.f
    const r = intSqrt(right)
    equationPicture(a, h, k, r)
    expectText(a, 'a', pointAnswer(h, k))
    expectText(a, 'b', whole(r))
    if (showsNumber(stage(a, 'a').reveal.join('\n'), r)) throw new Error('the center worked line shows the radius')
    return
  }
  miss(p)
}

function equationChoices(a: GeometryAnswer, right: string, signs: string, bare: string, diameter: string) {
  const texts = stage(a, 'a').choices?.map((c) => c.text) ?? []
  if (texts.length !== 4 || new Set(texts).size !== 4) throw new Error(`choices: ${texts.join(' | ')}`)
  const want = [right, signs, bare, diameter]
  if (new Set(want).size !== 4) throw new Error(`distractors collide: ${want.join(' | ')}`)
  for (const text of want) if (!texts.includes(text)) throw new Error(`missing ${text}`)
  const correct = stage(a, 'a').choices!.find((c) => c.text === right)
  if (!correct || stage(a, 'a').answerText !== correct.id) throw new Error('the right equation is not the answer')
}

const TEMPLATES: readonly [ModuleId, string, (a: GeometryAnswer) => void][] = [
  ['geoTangentChords', 'tc.tangent', solveTangent],
  ['geoTangentChords', 'tc.arcs', solveArcs],
  ['geoTangentChords', 'tc.chords', solveChords],
  ['geoCircleAngles', 'ia.inscribed', solveInscribed],
  ['geoCircleAngles', 'ia.inside', solveInside],
  ['geoCircleAngles', 'ia.outside', solveOutside],
  ['geoCircleMeasures', 'cm.lengths', solveLengths],
  ['geoCircleMeasures', 'cm.equation', solveEquation],
]

describe('unit 8 solved again from the wording', () => {
  describe.each(TEMPLATES)('%s / %s', (module, template, solve) => {
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
        expect(bad).toEqual([])
      },
      HEAVY,
    )
  })
})
