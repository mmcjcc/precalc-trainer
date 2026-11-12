/**
 * The circle half of Unit 9 solved again from what she reads. Each prompt is parsed with the grammar written at the
 * top of unit9Circles.ts (and nothing else of the generator), every answer is decided with plain arithmetic in
 * rationals, and the stored answers must match. The figure has to be that configuration: A and B (and C) on the
 * circle to 1e-9, the drawn central angle equal to the stated one to 1e-6, the stated radius or diameter on its own
 * segment, the asked length never labeled, and the shaded region the one the question is about.
 *
 * This file imports no generator helper. `params` is not consulted.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoPoint } from '@/shared/types'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const OPENERS = ['A round table top is drawn here. ', 'The figure shows a circular garden. ', 'A circular window is drawn here. ', 'A round rug has this outline. ', 'A clock face is drawn here. ']
const U = String.raw`(cm|m|in|ft)`
/** A number as the answer box writes it: 7, 49/4, 3√2, (3√2)/2. */
const NUM = String.raw`(\(\d+√\d+\)\/\d+|\d+√\d+|\d+\/\d+|\d+)`
/** A multiple of π: 18π, π/2, (27π)/2, 6π√2. */
const PI = String.raw`(\(\d*π(?:√\d+)?\)\/\d+|\d*π(?:√\d+)?(?:\/\d+)?)`

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
const mul = (a: Rat, b: Rat) => rat(a[0] * b[0], a[1] * b[1])
const div = (a: Rat, b: Rat) => rat(a[0] * b[1], a[1] * b[0])
const isZero = (a: Rat) => a[0] === 0n

/** Terms keyed by "π√m" or "√m" (m square-free; √1 is a plain rational). */
type Val = Map<string, Rat>

function term(c: Rat, m: number, pi: boolean): Val {
  // pull squares out of m
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

/** One term as the box writes it. */
function readTerm(text: string): Val {
  const t = text.trim()
  let m = /^\((\d*)(π?)(?:√(\d+))?\)\/(\d+)$/.exec(t)
  if (m) return term(rat(m[1] ? Number(m[1]) : 1, Number(m[4])), m[3] ? Number(m[3]) : 1, m[2] === 'π')
  m = /^(\d*)(π?)(?:√(\d+))?(?:\/(\d+))?$/.exec(t)
  if (m && (m[1] || m[2] || m[3])) return term(rat(m[1] ? Number(m[1]) : 1, m[4] ? Number(m[4]) : 1), m[3] ? Number(m[3]) : 1, m[2] === 'π')
  throw new Error(`unreadable term “${text}”`)
}

/** A stored answer: one term, or terms joined by " - " and " + ". */
function readVal(text: string): Val {
  const parts = text.trim().split(/ (?=[-+] )/)
  const vs = parts.map((p, i) => {
    if (i === 0) return readTerm(p)
    const sign = p.startsWith('-') ? rat(-1) : rat(1)
    return scale(readTerm(p.slice(2)), sign)
  })
  return plus(...vs)
}

/** A given that is a plain rational (no √, no π). */
function rational(text: string): Rat {
  const v = readTerm(text)
  if (v.size !== 1 || !v.has('√1')) throw new Error(`not a rational: ${text}`)
  return v.get('√1')!
}

/** A given multiple of π with no √: its rational coefficient. */
function piCoeff(text: string): Rat {
  const v = readTerm(text)
  if (v.size !== 1 || !v.has('π√1')) throw new Error(`not a rational multiple of π: ${text}`)
  return v.get('π√1')!
}

const PIv = (c: Rat): Val => term(c, 1, true)
const R = (c: Rat): Val => term(c, 1, false)
const num = (r: Rat) => Number(r[0]) / Number(r[1])

/** The square root of a rational that is a perfect square. */
function sqrtRat(r: Rat): Rat {
  const n = BigInt(Math.round(Math.sqrt(Number(r[0]))))
  const d = BigInt(Math.round(Math.sqrt(Number(r[1]))))
  if (n * n !== r[0] || d * d !== r[1]) throw new Error('area is not π times a square')
  return rat(n, d)
}

// --- the figure ---------------------------------------------------------------------------------------------------

function pt(a: GeometryAnswer, id: string): GeoPoint {
  const p = a.figure.points.find((q) => q.id === id)
  if (!p) throw new Error(`no point ${id}`)
  return p
}

function circleOf(a: GeometryAnswer): { o: GeoPoint; r: number } {
  const c = a.figure.circles?.[0]
  if (!c || a.figure.circles!.length !== 1) throw new Error('not one circle')
  return { o: pt(a, c.center), r: c.r }
}

function onCircle(a: GeometryAnswer, id: string) {
  const { o, r } = circleOf(a)
  const p = pt(a, id)
  if (Math.abs(Math.hypot(p.x - o.x, p.y - o.y) - r) > 1e-9 * Math.max(1, r)) throw new Error(`${id} is not on the circle`)
}

/** Counterclockwise sweep, as the figure is seen (y up), from `from` to `to` about O, in degrees. */
function sweep(a: GeometryAnswer, from: string, to: string): number {
  const o = pt(a, 'O')
  const f = pt(a, from)
  const t = pt(a, to)
  let d = ((Math.atan2(t.y - o.y, t.x - o.x) - Math.atan2(f.y - o.y, f.x - o.x)) * 180) / Math.PI
  while (d < 0) d += 360
  while (d >= 360) d -= 360
  return d
}

function drawnAngle(a: GeometryAnswer): number {
  const s = sweep(a, 'A', 'B')
  return Math.min(s, 360 - s)
}

function segLabel(a: GeometryAnswer, from: string, to: string): string | null {
  const s = (a.figure.segments ?? []).find((x) => (x.from === from && x.to === to) || (x.from === to && x.to === from))
  if (!s) throw new Error(`no segment ${from}${to}`)
  return s.label?.trim() ?? null
}

/** The drawn radius in the figure's units agrees with the stated one (the figure is drawn to scale). */
function scaleMatches(a: GeometryAnswer, radius: number) {
  const { r } = circleOf(a)
  if (Math.abs(r - radius) > 1e-6 * radius) throw new Error(`the circle is drawn with radius ${r}, the problem says ${radius}`)
}

function requireShade(a: GeometryAnswer, kind: 'sector' | 'segment', degrees: number) {
  const regions = a.figure.regions ?? []
  if (regions.length !== 1) throw new Error(`${regions.length} shaded regions`)
  const g = regions[0]!
  if (g.kind !== kind || g.center !== 'O') throw new Error(`shaded ${g.kind}, asked about a ${kind}`)
  if (!['A', 'B'].includes(g.from) || !['A', 'B'].includes(g.to) || g.from === g.to) throw new Error('the region is not between A and B')
  const s = sweep(a, g.from, g.to)
  if (Math.abs(s - degrees) > 1e-6) throw new Error(`the shaded region sweeps ${s}°, the question is about ${degrees}°`)
}

function requireAngleMark(a: GeometryAnswer, label: string, degrees: number) {
  const marks = a.figure.angles ?? []
  if (marks.length !== 1) throw new Error(`${marks.length} angle marks`)
  const m = marks[0]!
  if (m.vertex !== 'O' || ![m.from, m.to].includes('A') || ![m.from, m.to].includes('B')) throw new Error('the mark is not angle AOB')
  if (m.label !== label) throw new Error(`the angle is marked “${m.label}”, expected “${label}”`)
  if (Math.abs(drawnAngle(a) - degrees) > 1e-6) throw new Error(`angle AOB is drawn ${drawnAngle(a)}°, stated ${degrees}°`)
}

// --- the prompt ---------------------------------------------------------------------------------------------------

function strip(prompt: string): string {
  for (const opener of OPENERS) if (prompt.startsWith(opener)) return prompt.slice(opener.length)
  return prompt
}

/** The ask spells inches out ("in inches", "in square inches"); read them back as in and in². */
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

function solveCircle(a: GeometryAnswer) {
  const body = unspell(strip(a.prompt))
  const m = new RegExp(String.raw`^(.+?\.) Find the (circumference|area|radius) in ${U}(²?) and the (circumference|area|radius) in ${U}(²?)\. Write (both answers|the area|the circumference) in terms of π\.$`).exec(body)
  if (!m) throw new Error(`unreadable prompt: ${a.prompt}`)
  const [, facts, w1, u1, sq1, w2, u2, sq2, piWords] = m
  // radius as c·√k
  let c: Rat
  let k = 1
  let unit: string
  let label: string
  let given: string
  let f = new RegExp(String.raw`^Circle O has a radius of ${NUM} ${U}\.$`).exec(facts!)
  if (f) {
    const v = readTerm(f[1]!)
    const [key, coeff] = [...v][0]!
    k = Number(key.slice(1))
    c = coeff
    unit = f[2]!
    label = 'radius'
    given = f[1]!
  } else if ((f = new RegExp(String.raw`^Circle O has a diameter of (\d+) ${U}\.$`).exec(facts!))) {
    c = div(rational(f[1]!), rat(2))
    unit = f[2]!
    label = 'diameter'
    given = f[1]!
  } else if ((f = new RegExp(String.raw`^The circumference of circle O is ${PI} ${U}\.$`).exec(facts!))) {
    c = div(piCoeff(f[1]!), rat(2))
    unit = f[2]!
    label = 'r'
    given = f[1]!
  } else if ((f = new RegExp(String.raw`^The area of circle O is ${PI} ${U}²\.$`).exec(facts!))) {
    c = sqrtRat(piCoeff(f[1]!))
    unit = f[2]!
    label = 'r'
    given = f[1]!
  } else throw new Error(`unreadable facts: ${facts}`)
  if (u1 !== unit || u2 !== unit) throw new Error('the ask and the facts use different units')
  const circumference = term(mul(c, rat(2)), k, true)
  const area = term(mul(mul(c, c), rat(k)), 1, true)
  const radius = term(c, k, false)
  const valueOf = (w: string, squared: string) => {
    if ((w === 'area') !== (squared === '²')) throw new Error(`${w} asked in the wrong units`)
    return w === 'area' ? area : w === 'circumference' ? circumference : radius
  }
  const want = [valueOf(w1!, sq1!), valueOf(w2!, sq2!)]
  if (w1 === w2) throw new Error('the same thing asked twice')
  const piAsked = [w1, w2].filter((w) => w !== 'radius')
  if (piWords !== (piAsked.length === 2 ? 'both answers' : `the ${piAsked[0]}`)) throw new Error(`“${piWords}” does not match the parts asked`)
  check(a, want)
  // The figure: the stated radius or diameter labeled with its number, else a radius labeled r.
  const radiusLen = num(c) * Math.sqrt(k)
  scaleMatches(a, radiusLen)
  onCircle(a, 'A')
  if (label === 'diameter') {
    onCircle(a, 'B')
    const o = pt(a, 'O')
    const A = pt(a, 'A')
    const B = pt(a, 'B')
    if (Math.hypot((A.x + B.x) / 2 - o.x, (A.y + B.y) / 2 - o.y) > 1e-9 * radiusLen) throw new Error('AB is not a diameter')
    if (segLabel(a, 'A', 'B') !== given) throw new Error(`the diameter is labeled “${segLabel(a, 'A', 'B')}”`)
  } else {
    const lab = segLabel(a, 'O', 'A')
    if (lab !== (label === 'radius' ? given : 'r')) throw new Error(`the radius is labeled “${lab}”`)
  }
  if ((a.figure.regions ?? []).length !== 0) throw new Error('a circle problem shades a region')
}

function solveSector(a: GeometryAnswer) {
  const body = unspell(strip(a.prompt))
  const m = /^In circle O, (.+?), and (.+?)\. (Find .+)$/.exec(body)
  if (!m) throw new Error(`unreadable prompt: ${a.prompt}`)
  const facts = [m[1]!, m[2]!]
  let theta: Rat | null = null
  let r: Rat | null = null
  let L: Rat | null = null
  let S: Rat | null = null
  let unit: string | null = null
  const unitIs = (u: string) => {
    if (unit && unit !== u) throw new Error('two units')
    unit = u
  }
  for (const fact of facts) {
    let f = /^central angle AOB measures (\d+)°$/.exec(fact)
    if (f) {
      theta = rational(f[1]!)
      continue
    }
    if ((f = new RegExp(String.raw`^the radius is (\d+) ${U}$`).exec(fact))) {
      r = rational(f[1]!)
      unitIs(f[2]!)
      continue
    }
    if ((f = new RegExp(String.raw`^the arc length of minor arc AB is ${PI} ${U}$`).exec(fact))) {
      L = piCoeff(f[1]!)
      unitIs(f[2]!)
      continue
    }
    if ((f = new RegExp(String.raw`^the area of sector AOB is ${PI} ${U}²$`).exec(fact))) {
      S = piCoeff(f[1]!)
      unitIs(f[2]!)
      continue
    }
    throw new Error(`unreadable fact “${fact}”`)
  }
  // The missing one of angle and radius, from the arc length or the sector.
  if (theta && !r && L) r = div(mul(rat(180), L), theta)
  if (r && !theta && L) theta = div(mul(rat(180), L), r)
  if (r && !theta && S) theta = div(mul(rat(360), S), mul(r, r))
  if (!theta || !r || !unit) throw new Error('not enough facts')
  const full = rat(360)
  const minorArc = div(mul(theta, r), rat(180))
  const majorArc = div(mul(add(full, rat(-theta[0], theta[1])), r), rat(180))
  const minorSector = div(mul(theta, mul(r, r)), full)
  const majorSector = div(mul(add(full, rat(-theta[0], theta[1])), mul(r, r)), full)
  const ask = m[3]!
  const u = unit as string
  const asks: Record<string, () => { want: Val[]; shade: 'minor' | 'major'; angleLabel: 'x' | 'deg'; radiusLabel: 'r' | 'num'; c?: boolean }> = {
    [`Find the arc length of minor arc AB in ${u}, in terms of π.`]: () => ({ want: [PIv(minorArc)], shade: 'minor', angleLabel: 'deg', radiusLabel: 'num' }),
    [`Find the arc length of major arc ACB in ${u}, in terms of π.`]: () => ({ want: [PIv(majorArc)], shade: 'major', angleLabel: 'deg', radiusLabel: 'num', c: true }),
    [`Find the area of sector AOB in ${u}², in terms of π.`]: () => ({ want: [PIv(minorSector)], shade: 'minor', angleLabel: 'deg', radiusLabel: 'num' }),
    [`Find the area of the shaded major sector, bounded by radii OA and OB and major arc ACB, in ${u}², in terms of π.`]: () => ({ want: [PIv(majorSector)], shade: 'major', angleLabel: 'deg', radiusLabel: 'num', c: true }),
    [`Find the arc length of minor arc AB in ${u} and the area of sector AOB in ${u}², in terms of π.`]: () => ({ want: [PIv(minorArc), PIv(minorSector)], shade: 'minor', angleLabel: 'deg', radiusLabel: 'num' }),
    ['Find x, the measure of central angle AOB, in degrees.']: () => ({ want: [R(theta!)], shade: 'minor', angleLabel: 'x', radiusLabel: 'num' }),
    [`Find the radius in ${u}.`]: () => ({ want: [R(r!)], shade: 'minor', angleLabel: 'deg', radiusLabel: 'r' }),
  }
  const job = asks[ask]
  if (!job) throw new Error(`unreadable ask “${ask}”`)
  const { want, shade, angleLabel, radiusLabel, c } = job()
  // Givens: an asked quantity must not be stated; the angle ask states no angle, the radius ask no radius.
  if (angleLabel === 'x' && facts.some((x) => x.startsWith('central angle'))) throw new Error('the asked angle is stated')
  if (radiusLabel === 'r' && facts.some((x) => x.startsWith('the radius'))) throw new Error('the asked radius is stated')
  check(a, want)
  if (want.length === 1 && angleLabel === 'x' && a.stages[0]!.unit !== 'deg') throw new Error('the angle part is not in degrees')
  const deg = num(theta)
  scaleMatches(a, num(r))
  onCircle(a, 'A')
  onCircle(a, 'B')
  requireAngleMark(a, angleLabel === 'x' ? 'x°' : `${theta[0]}°`, deg)
  const lab = segLabel(a, 'O', 'A')
  if (lab !== (radiusLabel === 'r' ? 'r' : String(r[0]))) throw new Error(`OA is labeled “${lab}”`)
  segLabel(a, 'O', 'B')
  requireShade(a, 'sector', shade === 'minor' ? deg : 360 - deg)
  if (c) {
    onCircle(a, 'C')
    const g = a.figure.regions![0]!
    const toC = sweep(a, g.from, 'C')
    if (!(toC > 1e-6 && toC < 360 - deg - 1e-6)) throw new Error('C is not on the major arc')
  } else if (a.figure.points.some((p) => p.id === 'C')) throw new Error('a point C with no major arc asked')
}

function solveSegment(a: GeometryAnswer) {
  const body = unspell(strip(a.prompt))
  const m = new RegExp(
    String.raw`^In circle O, central angle AOB measures (\d+)°, and the radius is (\d+) ${U}\. Chord AB is drawn\. The shaded region is a segment of the circle: the region between chord AB and minor arc AB\. Find the area of sector AOB, the area of triangle AOB, and the area of the shaded segment, each in ${U}²\. Write each area in terms of π where π appears\.$`,
  ).exec(body)
  if (!m) throw new Error(`unreadable prompt: ${a.prompt}`)
  const theta = rational(m[1]!)
  const r = rational(m[2]!)
  if (m[3] !== m[4]) throw new Error('two units')
  const deg = num(theta)
  const sector = PIv(div(mul(theta, mul(r, r)), rat(360)))
  // Half the product of two sides and the sine of the angle between them: sin 90° = 1, sin 60° = sin 120° = √3/2.
  const half = mul(rat(1, 2), mul(r, r))
  let triangle: Val
  if (deg === 90) triangle = R(half)
  else if (deg === 60 || deg === 120) triangle = term(mul(half, rat(1, 2)), 3, false)
  else throw new Error(`no exact sine for ${deg}°`)
  const segment = plus(sector, scale(triangle, rat(-1)))
  check(a, [sector, triangle, segment])
  if (!a.stages[2]!.sum) throw new Error('the segment part does not read a sum')
  scaleMatches(a, num(r))
  onCircle(a, 'A')
  onCircle(a, 'B')
  requireAngleMark(a, `${theta[0]}°`, deg)
  if (segLabel(a, 'O', 'A') !== String(r[0])) throw new Error('OA is not labeled with the radius')
  segLabel(a, 'O', 'B')
  segLabel(a, 'A', 'B')
  requireShade(a, 'segment', deg)
}

const SOLVERS: Record<string, (a: GeometryAnswer) => void> = { 'ca.circle': solveCircle, 'ca.sector': solveSector, 'ca.segment': solveSegment }

describe('unit 9 circles solved again from the wording', () => {
  describe.each(['ca.circle', 'ca.sector', 'ca.segment'])('%s', (template) => {
    it(
      'decides every answer from the given numbers and requires a real configuration',
      () => {
        const bad: string[] = []
        for (const seed of SEEDS) {
          const p = generateProblem('geoCircleArea', template, seed)
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
