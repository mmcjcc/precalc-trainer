/**
 * Honors geometry Unit 9, module geoPolygonArea (Jurgensen chapter 11, first half): areas of polygons.
 * Circle areas are not in this module: a quantity cannot carry π.
 *
 * Prompt grammar (the solve test reads this and no generator helper): an optional opener with no digit,
 * then "The <name> has <facts>." or "The area of the <name> is <A> <unit>², and it has <facts>.",
 * then "Find the <what> in <unit>." or "Find the <what> in <unit> and the area in <unit>²."
 * Facts use "a base of", "a height of", "a slanted side of", "bases of", "diagonals of", "a diagonal of",
 * "one angle of N degrees", "a shorter leg of", "a hypotenuse of", "legs of", "a leg of", "a side of",
 * "a radius of", "an apothem of", "a leg of". Openers are OPENERS below.
 */
import { specialSide, specialSlips, type SpecialRole, type SpecialTriangle } from '@/engine/trig'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { AREA_RULES, UNIT9_RULE_IDS } from './unit9Rules'
import { modeOf, rotatePromise } from './unit8Build'
import {
  centerOf,
  coreWords,
  exactStage7,
  finish7,
  fromTrig,
  int,
  placeAll,
  placeLabels7,
  qSay,
  rad,
  setDebug7,
  shows7,
  smallestAngle,
  toTrig,
  type P2,
  type Stage7,
  type TrapDraft7,
} from './unit7Build'

const INSTRUCTIONS = 'Give each answer exactly. The box takes the number only. The figure is there before you answer.'

const OPENERS = [
  '',
  'A patio is drawn here. ',
  'The figure shows a garden bed. ',
  'A window has this outline. ',
  'A tile is cut in this shape. ',
  'A sign has this outline. ',
] as const

const UNITS = ['cm', 'm', 'in', 'ft'] as const
type Unit = (typeof UNITS)[number]

const SHAPES = ['rectangle', 'parallelogram', 'triangle', 'trapezoid', 'rhombus'] as const
type Shape = (typeof SHAPES)[number]

const BASIC_ASK: Record<Shape, readonly ('area' | 'base' | 'height' | 'diagonal')[]> = {
  rectangle: ['area', 'base', 'height'],
  parallelogram: ['area', 'base', 'height'],
  triangle: ['area', 'base', 'height'],
  trapezoid: ['area', 'height'],
  rhombus: ['area', 'diagonal'],
}

const SPECIAL = ['isoTri', 'rightHyp', 'rightLeg', 'equilateral', 'isoTrap', 'para30', 'para45', 'tri30', 'tri45'] as const
type Special = (typeof SPECIAL)[number]

const REGULAR = ['given', 'hexSide', 'hexRadius', 'sqSide', 'sqRadius', 'eqSide', 'eqRadius'] as const
type Regular = (typeof REGULAR)[number]

const REG_NAME: Record<number, string> = {
  5: 'regular pentagon',
  6: 'regular hexagon',
  8: 'regular octagon',
  10: 'regular decagon',
  12: 'regular dodecagon',
}

const W = {
  slant: 'That uses the slanted side as the height. The height is the perpendicular distance.',
  notHalved: 'That leaves out the half, so the area is twice as big.',
  halfApplied: 'That takes half of the product. This area is the whole product.',
  bases: 'That multiplies the two bases. Add the bases first.',
  peri: 'That is the distance around the figure. The question asks for the area.',
  areaPeri: 'That is the space inside the figure. The question asks for the perimeter.',
  apothem: 'That is the radius, out to a vertex. The apothem stops at a side.',
  added: 'That adds the squares. This side is a leg, so subtract.',
  subtracted: 'That subtracts the squares. This side is the hypotenuse, so add.',
  notRoot: 'That stops before taking the square root.',
  halfLen: 'That uses the whole length inside the right triangle. The right triangle has half of it as a leg.',
  halfDiag: 'That is half of the diagonal. The whole diagonal is twice that half.',
} as const

let lastWhy = 'no draw'

function fail(why: string): null {
  lastWhy = why
  return null
}

function runFinish(o: Parameters<typeof finish7>[0]): GeoBuilt | null {
  let why = ''
  setDebug7((w) => {
    why = w
  })
  try {
    const built = finish7(o)
    if (!built && why) lastWhy = why
    return built
  } finally {
    setDebug7(null)
  }
}

function generate(seed: number, salt: number, make: (rng: Rng) => GeoBuilt | null): GeoBuilt {
  for (let n = 0; n < 96; n++) {
    const rng = makeRng(mixSeed(seed, salt + n * 97))
    const built = make(rng)
    if (built) return built
  }
  throw new Error(`unit 9 seed ${seed} salt ${salt}: ${lastWhy}`)
}

const sq = (u: Unit) => `${u}²`
/** Units as the ask sentence names them: "in in" reads as a typo, so inches are spelled out there. */
export const askUnit = (u: Unit) => (u === 'in' ? 'inches' : u)
export const askSq = (u: Unit) => (u === 'in' ? 'square inches' : sq(u))
/**
 * One format hint for every number box of the unit, the same whatever the answer is: areas of triangles
 * and heights of equilateral triangles are often halves, so the hint says a fraction is welcome.
 */
export const EXACT_HINT9 = 'A whole number, a fraction or a simplest radical, like 43, 43/2 or 3√11.'
const numText = (n: number) => (Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toFixed(1))

function qNum(n: number): GeoQty {
  const doubled = Math.round(n * 2)
  if (Math.abs(n * 2 - doubled) > 1e-6) throw new Error(`not a half: ${n}`)
  return rad(doubled, 2, 1)
}

const qmul = (a: GeoQty, b: GeoQty) => rad(a.n * b.n, a.d * b.d, a.rad * b.rad)
const qmulN = (a: GeoQty, k: number) => rad(a.n * k, a.d, a.rad)
const qdivN = (a: GeoQty, k: number) => rad(a.n, a.d * k, a.rad)
const sqrtInt = (n: number) => rad(1, 1, n)

function say(opener: string, sentence: string, ask: string): string {
  return `${opener}${sentence} ${ask}`
}

function has(name: string, facts: string): string {
  return `The ${name} has ${facts}.`
}

function hasArea(name: string, area: string, u: Unit, facts: string): string {
  return `The area of the ${name} is ${area} ${sq(u)}, and it has ${facts}.`
}

function askOne(what: string, u: Unit): string {
  return what === 'area' ? `Find the area in ${askSq(u)}.` : `Find the ${what} in ${askUnit(u)}.`
}

function askBoth(what: string, u: Unit): string {
  return `Find the ${what} in ${askUnit(u)} and the area in ${askSq(u)}.`
}

interface Raw {
  id: string
  p: P2
  /** Undefined shows the id. Empty string hides the letter. */
  label?: string
}

function vertex(id: string, p: P2, center: P2, label?: string): GeoPoint {
  const dx = p.x - center.x
  const dy = p.y - center.y
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  let labelSide: NonNullable<GeoPoint['labelSide']>
  if (ay >= ax * 1.3) labelSide = dy >= 0 ? 'above' : 'below'
  else if (ax >= ay * 1.3) labelSide = dx >= 0 ? 'right' : 'left'
  else if (dx >= 0) labelSide = dy >= 0 ? 'above-right' : 'below-right'
  else labelSide = dy >= 0 ? 'above-left' : 'below-left'
  return { id, x: p.x, y: p.y, label: label === undefined ? id : label, labelSide }
}

function seg(from: string, to: string, label?: string, dashed?: boolean): GeoSegment {
  return { from, to, ...(label ? { label } : {}), ...(dashed ? { dashed: true } : {}) }
}

function rightAt(vertexId: string, from: string, to: string): GeoAngleMark {
  return { vertex: vertexId, from, to, right: true }
}

interface Pose {
  turn: number
  reflect: boolean
}

function corner(prev: P2, v: P2, next: P2): number {
  const ux = prev.x - v.x
  const uy = prev.y - v.y
  const wx = next.x - v.x
  const wy = next.y - v.y
  const c = (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

function fatRing(pts: P2[]): boolean {
  if (pts.length < 3) return false
  for (let i = 0; i < pts.length; i++) {
    const ang = corner(pts[(i + pts.length - 1) % pts.length]!, pts[i]!, pts[(i + 1) % pts.length]!)
    if (ang < 20 || ang > 160) return false
  }
  let min = Infinity
  let max = 0
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(pts[(i + 1) % pts.length]!.x - pts[i]!.x, pts[(i + 1) % pts.length]!.y - pts[i]!.y)
    min = Math.min(min, d)
    max = Math.max(max, d)
  }
  return min >= 2.5 && min >= max * 0.22
}

function pack(raw: Raw[], segments: GeoSegment[], angles: GeoAngleMark[], outline: string[], pose: Pose, aria: string): GeoFigureSpec | null {
  const placed = placeAll(
    raw.map((r) => r.p),
    pose.turn,
    pose.reflect,
  )
  const at = new Map(raw.map((r, i) => [r.id, placed[i]!]))
  const ring = outline.map((id) => at.get(id)!)
  if (!fatRing(ring)) return null
  const center = centerOf(ring)
  const points = raw.map((r, i) => vertex(r.id, placed[i]!, center, r.label))
  return placeLabels7({ ariaLabel: aria, points, segments, angles }, [outline])
}

function poseOf(rng: Rng): Pose {
  return { turn: rng.int(0, 35) * 10, reflect: rng.chance(0.5) }
}

function scene(rng: Rng): { unit: Unit; opener: string; pose: Pose } {
  return { unit: rng.pick(UNITS), opener: rng.pick(OPENERS), pose: poseOf(rng) }
}

function trap(id: ErrorPatternId, stage: 'a' | 'b', value: GeoQty, witness: string): TrapDraft7 {
  return { id, stage, value, witness }
}

function stage(
  id: 'a' | 'b',
  label: string,
  answer: GeoQty,
  card: string,
  nudge: string,
  reveal: string,
  traps: TrapDraft7[],
  givens: GeoQty[],
): Stage7 {
  return exactStage7({ id, label, hint: EXACT_HINT9, answer, nudge, ruleCard: card, reveal: [reveal], traps, givens })
}

function scrub(stages: Stage7[]): Stage7[] | null {
  const answers = stages.map((s) => s.answerText)
  const next = stages.map((s) => ({
    ...s,
    traps: s.traps.filter((t) => answers.every((a) => t.text !== a && !shows7(t.witness, a))),
  }))
  if (next.every((s) => s.traps.length === 0)) return null
  return next
}

function deliver(
  question: 'polygonArea' | 'specialArea' | 'regularArea',
  title: string,
  prompt: string,
  figure: GeoFigureSpec | null,
  stages: Stage7[],
  lengths: number[],
  params: Record<string, string | number | boolean>,
  rng: Rng,
): GeoBuilt | null {
  if (!figure) return fail('labels')
  const clean = scrub(stages)
  if (!clean) return fail('traps')
  const ban = new Set(clean.map((s) => s.answerText))
  return runFinish({
    question,
    prompt,
    figure,
    stages: clean,
    lengths: lengths.filter((n) => Number.isInteger(n) && n > 0 && !ban.has(String(n))),
    title,
    instructions: INSTRUCTIONS,
    params,
    cards: AREA_RULES,
    promise: rotatePromise(
      clean.flatMap((s) => s.traps.map((t) => t.id)),
      rng,
    ),
  })
}

function sideOf(tri: SpecialTriangle, from: SpecialRole, value: GeoQty, to: SpecialRole): GeoQty {
  return fromTrig(specialSide(tri, from, toTrig(value), to))
}

function specialTraps(tri: SpecialTriangle, from: SpecialRole, value: GeoQty, to: SpecialRole, stageId: 'a' | 'b'): TrapDraft7[] {
  return specialSlips(tri, from, toTrig(value), to).flatMap((s) =>
    s.value === 'undefined' ? [] : [{ id: s.id as ErrorPatternId, stage: stageId, value: fromTrig(s.value), witness: coreWords(s.witness) }],
  )
}

interface Triple {
  a: number
  b: number
  c: number
}

function pyth(rng: Rng, maxC: number): Triple | null {
  const m = rng.int(2, 9)
  const n = rng.int(1, m - 1)
  const a0 = m * m - n * n
  const b0 = 2 * m * n
  const c0 = m * m + n * n
  if (a0 < 2 || b0 < 2) return null
  const kMax = Math.floor(maxC / c0)
  if (kMax < 1) return null
  const k = rng.int(1, Math.min(kMax, 3))
  const a = a0 * k
  const b = b0 * k
  const c = c0 * k
  return rng.chance(0.5) ? { a: b, b: a, c } : { a, b, c }
}

function legSlips(leg: number, other: number, stageId: 'a' | 'b'): TrapDraft7[] {
  const out: TrapDraft7[] = [
    trap('trig_pythag_added', stageId, sqrtInt(leg * leg + other * other), W.added),
    trap('trig_side_not_rooted', stageId, int(Math.abs(leg * leg - other * other)), W.notRoot),
  ]
  if (leg > other) out.push(trap('trig_pythag_subtracted', stageId, sqrtInt(leg * leg - other * other), W.subtracted))
  return out
}

function hypSlips(a: number, b: number, stageId: 'a' | 'b'): TrapDraft7[] {
  const out: TrapDraft7[] = [trap('trig_side_not_rooted', stageId, int(a * a + b * b), W.notRoot)]
  if (a !== b) out.push(trap('trig_pythag_subtracted', stageId, sqrtInt(Math.abs(a * a - b * b)), W.subtracted))
  return out
}

// --- basic ---------------------------------------------------------------------------------------------------

const CARD = UNIT9_RULE_IDS

function basic(rng: Rng, shape: Shape, ask: 'area' | 'base' | 'height' | 'diagonal'): GeoBuilt | null {
  const scene0 = scene(rng)
  if (shape === 'rectangle') return rectangle(rng, ask, scene0)
  if (shape === 'parallelogram') return parallelogram(rng, ask, scene0)
  if (shape === 'triangle') return triangle(rng, ask, scene0)
  if (shape === 'trapezoid') return trapezoid(rng, ask, scene0)
  return ask === 'diagonal' || rng.chance(0.45) ? kiteOrRhombus(rng, ask, scene0, true) : kiteOrRhombus(rng, ask, scene0, false)
}

interface Scene {
  unit: Unit
  opener: string
  pose: Pose
}

function rectangle(rng: Rng, ask: 'area' | 'base' | 'height' | 'diagonal', sc: Scene): GeoBuilt | null {
  if (ask === 'diagonal') return null
  const b = rng.int(6, 24)
  const h = rng.int(4, 18)
  if (b === h || Math.abs(b - h) < 2) return null
  if (smallestAngle({ x: b, y: 0 }, { x: 0, y: h }, { x: 0, y: 0 }) < 22) return null
  const area = b * h
  const peri = 2 * (b + h)
  const u = sc.unit
  const baseLabel = ask === 'base' ? '?' : numText(b)
  const heightLabel = ask === 'height' ? '?' : numText(h)
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: b, y: 0 } },
      { id: 'C', p: { x: b, y: h } },
      { id: 'D', p: { x: 0, y: h } },
    ],
    [seg('A', 'B', baseLabel), seg('B', 'C'), seg('C', 'D'), seg('D', 'A', heightLabel)],
    [rightAt('A', 'B', 'D')],
    ['A', 'B', 'C', 'D'],
    sc.pose,
    'A rectangle with its base and its height labeled.',
  )
  const half = qdivN(int(area), 2)
  if (ask === 'area') {
    const answer = int(area)
    const traps = [trap('geo_half_applied', 'a', half, W.halfApplied), trap('geo_perimeter_for_area', 'a', int(peri), W.peri)]
    const st = stage('a', 'Area', answer, CARD.rect, 'Multiply the base by the perpendicular height.', `The area is the base times the height, which gives ${qSay(answer)}.`, traps, [int(b), int(h)])
    const prompt = say(sc.opener, has('rectangle', `a base of ${b} ${u} and a height of ${h} ${u}`), askOne('area', u))
    return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [b, h], { shape: 'rectangle', ask }, rng)
  }
  const known = ask === 'base' ? h : b
  const answer = ask === 'base' ? int(b) : int(h)
  const traps = [trap('geo_half_applied', 'a', qdivN(answer, 2), W.halfApplied)]
  const facts = ask === 'base' ? `a height of ${h} ${u}` : `a base of ${b} ${u}`
  const st = stage('a', ask === 'base' ? 'Base' : 'Height', answer, CARD.rect, 'Divide the area by the side you have.', `The area is the base times the height, so the missing side is ${qSay(answer)}.`, traps, [int(area), int(known)])
  const prompt = say(sc.opener, hasArea('rectangle', String(area), u, facts), askOne(ask, u))
  return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [area, known], { shape: 'rectangle', ask }, rng)
}

function parallelogram(rng: Rng, ask: 'area' | 'base' | 'height' | 'diagonal', sc: Scene): GeoBuilt | null {
  if (ask === 'diagonal') return null
  const t = pyth(rng, 20)
  if (!t) return null
  const o = Math.min(t.a, t.b)
  const h = Math.max(t.a, t.b)
  const s = t.c
  if (h / o < 0.45 || h / o > 2.4 || o < 3 || h < 4) return null
  const extra = rng.int(4, 12)
  const b = o + extra
  const area = b * h
  const u = sc.unit
  const raw: Raw[] = [
    { id: 'A', p: { x: 0, y: 0 } },
    { id: 'B', p: { x: b, y: 0 } },
    { id: 'C', p: { x: b + o, y: h } },
    { id: 'D', p: { x: o, y: h } },
    { id: 'H', p: { x: o, y: 0 }, label: '' },
  ]
  const baseLabel = ask === 'base' ? '?' : numText(b)
  const heightLabel = ask === 'height' ? '?' : numText(h)
  const figure = pack(
    raw,
    [seg('A', 'B'), seg('B', 'C'), seg('C', 'D', baseLabel), seg('D', 'A', numText(s)), seg('D', 'H', heightLabel, true)],
    [rightAt('H', 'B', 'D')],
    ['A', 'B', 'C', 'D'],
    sc.pose,
    'A parallelogram with a base, a slanted side, and the perpendicular height.',
  )
  const peri = 2 * (b + s)
  if (ask === 'area') {
    const answer = int(area)
    const traps = [
      trap('geo_slant_as_height', 'a', int(b * s), W.slant),
      trap('geo_half_applied', 'a', qdivN(answer, 2), W.halfApplied),
      trap('geo_perimeter_for_area', 'a', int(peri), W.peri),
    ]
    const st = stage('a', 'Area', answer, CARD.rect, 'Multiply the base by the perpendicular height, not by the slanted side.', `The area is the base times the perpendicular height, which gives ${qSay(answer)}.`, traps, [int(b), int(h), int(s)])
    const prompt = say(sc.opener, has('parallelogram', `a base of ${b} ${u}, a height of ${h} ${u}, and a slanted side of ${s} ${u}`), askOne('area', u))
    return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [b, h, s], { shape: 'parallelogram', ask }, rng)
  }
  if (ask === 'height') {
    const answer = int(h)
    // The slant is on the figure, but using it as the height is the named slip, so it is not passed as a given.
    const traps = [trap('geo_slant_as_height', 'a', int(s), W.slant), trap('geo_half_applied', 'a', qdivN(answer, 2), W.halfApplied)]
    const st = stage('a', 'Height', answer, CARD.height, 'Divide the area by the base. The slanted side is not the height.', `The area is the base times the perpendicular height, so the height is ${qSay(answer)}.`, traps, [int(area), int(b)])
    const prompt = say(sc.opener, hasArea('parallelogram', String(area), u, `a base of ${b} ${u} and a slanted side of ${s} ${u}`), askOne('height', u))
    return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [area, b, s], { shape: 'parallelogram', ask }, rng)
  }
  const answer = int(b)
  const traps = [trap('geo_half_applied', 'a', qdivN(answer, 2), W.halfApplied), trap('geo_slant_as_height', 'a', qdivN(int(area), s), W.slant)]
  const st = stage('a', 'Base', answer, CARD.rect, 'Divide the area by the perpendicular height.', `The area is the base times the perpendicular height, so the base is ${qSay(answer)}.`, traps, [int(area), int(h), int(s)])
  const prompt = say(sc.opener, hasArea('parallelogram', String(area), u, `a height of ${h} ${u} and a slanted side of ${s} ${u}`), askOne('base', u))
  return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [area, h, s], { shape: 'parallelogram', ask }, rng)
}

function triangle(rng: Rng, ask: 'area' | 'base' | 'height' | 'diagonal', sc: Scene): GeoBuilt | null {
  if (ask === 'diagonal') return null
  const b = rng.int(6, 22)
  const h = rng.int(4, 16)
  if (smallestAngle({ x: b, y: 0 }, { x: 0, y: h }, { x: 0, y: 0 }) < 22) return null
  const s2 = b * b + h * h
  const root = Math.round(Math.sqrt(s2))
  const sQty = root * root === s2 ? int(root) : sqrtInt(s2)
  const sText = qSay(sQty)
  const areaQty = qdivN(int(b * h), 2)
  const u = sc.unit
  const baseLabel = ask === 'base' ? '?' : numText(b)
  const heightLabel = ask === 'height' ? '?' : numText(h)
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: b, y: 0 } },
      { id: 'C', p: { x: 0, y: h } },
    ],
    [seg('A', 'B', baseLabel), seg('A', 'C', heightLabel), seg('B', 'C', sText)],
    [rightAt('A', 'B', 'C')],
    ['A', 'B', 'C'],
    sc.pose,
    'A triangle with a base, a perpendicular height, and a slanted side.',
  )
  const slantArea = qdivN(qmul(int(b), sQty), 2)
  const full = int(b * h)
  if (ask === 'area') {
    const traps = [trap('geo_area_not_halved', 'a', full, W.notHalved), trap('geo_slant_as_height', 'a', slantArea, W.slant)]
    const st = stage('a', 'Area', areaQty, CARD.triangle, 'Take half the base times the perpendicular height, not the slanted side.', `The area is half the base times the perpendicular height, which gives ${qSay(areaQty)}.`, traps, [int(b), int(h), sQty])
    const prompt = say(sc.opener, has('triangle', `a base of ${b} ${u}, a height of ${h} ${u}, and a slanted side of ${sText} ${u}`), askOne('area', u))
    return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [b, h], { shape: 'triangle', ask }, rng)
  }
  if (ask === 'height') {
    const answer = int(h)
    // The slanted side is drawn, and answering with it is the named slip, so it is not passed as a given.
    const traps = [trap('geo_slant_as_height', 'a', sQty, W.slant)]
    const st = stage('a', 'Height', answer, CARD.height, 'The height is perpendicular to the base. Double the area and divide by the base.', `Twice the area divided by the base is the height, which gives ${qSay(answer)}.`, traps, [areaQty, int(b)])
    const prompt = say(sc.opener, hasArea('triangle', qSay(areaQty), u, `a base of ${b} ${u} and a slanted side of ${sText} ${u}`), askOne('height', u))
    return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [b], { shape: 'triangle', ask }, rng)
  }
  const answer = int(b)
  const fromSlant = invertSlantBase(areaQty, sQty)
  const st = stage('a', 'Base', answer, CARD.triangle, 'Double the area and divide by the perpendicular height.', `Twice the area divided by the height is the base, which gives ${qSay(answer)}.`, [trap('geo_slant_as_height', 'a', fromSlant, W.slant)], [areaQty, int(h)])
  const prompt = say(sc.opener, hasArea('triangle', qSay(areaQty), u, `a height of ${h} ${u} and a slanted side of ${sText} ${u}`), askOne('base', u))
  return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [h], { shape: 'triangle', ask }, rng)
}

/** 2A/s, the base she gets by using the slanted side as the height. */
function invertSlantBase(area: GeoQty, slant: GeoQty): GeoQty {
  // area = n/d * √rad, slant similar. 2*area/slant.
  const two = qmulN(area, 2)
  return rad(two.n * slant.d, two.d * slant.n, two.rad * slant.rad)
}

function trapezoid(rng: Rng, ask: 'area' | 'base' | 'height' | 'diagonal', sc: Scene): GeoBuilt | null {
  if (ask === 'base' || ask === 'diagonal') return null
  const b1 = rng.int(4, 14)
  const drop = rng.int(3, 10)
  const b2 = b1 + drop
  const h = rng.int(4, 14)
  if ((h * (b1 + b2)) % 2 !== 0) return null
  if (h / b2 < 0.35 || h / b2 > 2.2) return null
  const area = (h * (b1 + b2)) / 2
  const u = sc.unit
  const heightLabel = ask === 'height' ? '?' : numText(h)
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: b2, y: 0 } },
      { id: 'C', p: { x: b1, y: h } },
      { id: 'D', p: { x: 0, y: h } },
    ],
    [seg('A', 'B', numText(b2)), seg('B', 'C'), seg('C', 'D', numText(b1)), seg('D', 'A', heightLabel)],
    [rightAt('A', 'B', 'D'), rightAt('D', 'A', 'C')],
    ['A', 'B', 'C', 'D'],
    sc.pose,
    'A trapezoid with the two bases and the height labeled.',
  )
  const sum = b1 + b2
  if (ask === 'area') {
    const answer = int(area)
    const traps = [trap('geo_area_not_halved', 'a', int(h * sum), W.notHalved), trap('geo_bases_multiplied', 'a', qdivN(int(h * b1 * b2), 2), W.bases)]
    const st = stage('a', 'Area', answer, CARD.trapezoid, 'Add the two bases, multiply by the height, and take half.', `The area is half the height times the sum of the bases, which gives ${qSay(answer)}.`, traps, [int(b1), int(b2), int(h)])
    const prompt = say(sc.opener, has('trapezoid', `bases of ${b1} ${u} and ${b2} ${u} and a height of ${h} ${u}`), askOne('area', u))
    return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [b1, b2, h], { shape: 'trapezoid', ask }, rng)
  }
  const answer = int(h)
  const multiplied = qdivN(int(2 * area), b1 * b2)
  const traps = [trap('geo_bases_multiplied', 'a', multiplied, W.bases)]
  const st = stage('a', 'Height', answer, CARD.trapezoid, 'Add the bases, then divide twice the area by that sum.', `Twice the area divided by the sum of the bases is the height, which gives ${qSay(answer)}.`, traps, [int(area), int(b1), int(b2)])
  const prompt = say(sc.opener, hasArea('trapezoid', String(area), u, `bases of ${b1} ${u} and ${b2} ${u}`), askOne('height', u))
  return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [area, b1, b2], { shape: 'trapezoid', ask }, rng)
}

/**
 * The diagonals cross at right angles, so a length written at either midpoint sits on the other diagonal.
 * Each length is a parallel copy outside the shape, the same length as its diagonal. The diagonals themselves stay drawn.
 */
function kiteFigure(p: number, q: number, r: number, d1Label: string, d2Label: string, pose: Pose, aria: string): GeoFigureSpec | null {
  const gap = Math.max(p + q, 2 * r) * 0.55
  const raw: Raw[] = [
    { id: 'A', p: { x: -p, y: 0 } },
    { id: 'C', p: { x: q, y: 0 } },
    { id: 'B', p: { x: 0, y: r } },
    { id: 'D', p: { x: 0, y: -r } },
    { id: 'O', p: { x: 0, y: 0 }, label: '' },
    { id: 'E', p: { x: -p, y: r + gap }, label: '' },
    { id: 'F', p: { x: q, y: r + gap }, label: '' },
    { id: 'G', p: { x: q + gap, y: r }, label: '' },
    { id: 'J', p: { x: q + gap, y: -r }, label: '' },
  ]
  return pack(
    raw,
    [seg('A', 'C'), seg('B', 'D'), seg('A', 'B'), seg('B', 'C'), seg('C', 'D'), seg('D', 'A'), seg('E', 'F', d1Label), seg('G', 'J', d2Label)],
    [rightAt('O', 'A', 'B')],
    ['A', 'B', 'C', 'D'],
    pose,
    aria,
  )
}

function kiteOrRhombus(rng: Rng, ask: 'area' | 'base' | 'height' | 'diagonal', sc: Scene, kite: boolean): GeoBuilt | null {
  let p: number
  let q: number
  let r: number
  if (kite) {
    p = rng.int(3, 12)
    q = rng.int(3, 12)
    if (Math.abs(p - q) < 2) return null
    r = rng.int(3, 12)
  } else {
    p = rng.int(4, 16)
    q = p
    r = rng.int(4, 16)
    if (p / r < 0.45 || p / r > 2.2) return null
  }
  const d1 = p + q
  const d2 = 2 * r
  if (d1 === d2) return null
  const area = (d1 * d2) / 2
  const u = sc.unit
  const name = kite ? 'kite' : 'rhombus'
  const side2 = p * p + r * r
  const sideRoot = Math.round(Math.sqrt(side2))
  const side = !kite && sideRoot * sideRoot === side2 ? sideRoot : 0
  if (ask === 'diagonal') {
    const answer = int(d2)
    const figure = kiteFigure(p, q, r, numText(d1), '?', sc.pose, `A ${name} with its diagonals drawn.`)
    const traps = [trap('geo_diagonal_half_as_whole', 'a', qdivN(answer, 2), W.halfDiag)]
    const st = stage('a', 'Diagonal', answer, CARD.diagonals, 'The area is half the product of the diagonals. Double the area and divide by the diagonal you have.', `Twice the area divided by the given diagonal is the other diagonal, which gives ${qSay(answer)}.`, traps, [int(area), int(d1)])
    const prompt = say(sc.opener, hasArea(name, String(area), u, `a diagonal of ${d1} ${u}`), askOne('diagonal', u))
    return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [area, d1], { shape: 'rhombus', ask, kite }, rng)
  }
  const figure = kiteFigure(p, q, r, numText(d1), numText(d2), sc.pose, `A ${name} with both diagonals labeled.`)
  const answer = int(area)
  const traps = [trap('geo_area_not_halved', 'a', int(d1 * d2), W.notHalved)]
  if (side > 0) traps.push(trap('geo_perimeter_for_area', 'a', int(4 * side), W.peri))
  const st = stage('a', 'Area', answer, CARD.diagonals, 'Take half the product of the diagonals.', `The area is half the product of the diagonals, which gives ${qSay(answer)}.`, traps, [int(d1), int(d2)])
  const prompt = say(sc.opener, has(name, `diagonals of ${d1} ${u} and ${d2} ${u}`), askOne('area', u))
  return deliver('polygonArea', 'Areas of polygons', prompt, figure, [st], [d1, d2], { shape: 'rhombus', ask: 'area', kite }, rng)
}

// --- special -------------------------------------------------------------------------------------------------

function special(rng: Rng, kind: Special): GeoBuilt | null {
  const sc = scene(rng)
  if (kind === 'isoTri') return isoTri(rng, sc)
  if (kind === 'rightHyp') return rightHyp(rng, sc)
  if (kind === 'rightLeg') return rightLeg(rng, sc)
  if (kind === 'equilateral') return equilateral(rng, sc)
  if (kind === 'isoTrap') return isoTrap(rng, sc)
  if (kind === 'para30') return paraSpecial(rng, sc, '30')
  if (kind === 'para45') return paraSpecial(rng, sc, '45')
  if (kind === 'tri30') return tri30(rng, sc)
  return tri45(rng, sc)
}

function isoTri(rng: Rng, sc: Scene): GeoBuilt | null {
  const t = pyth(rng, 26)
  if (!t) return null
  const m = Math.min(t.a, t.b)
  const h = Math.max(t.a, t.b)
  const c = t.c
  if (m < 3 || h < 4 || h / m < 0.45 || h / m > 2.6) return null
  const b = 2 * m
  if (smallestAngle({ x: 0, y: 0 }, { x: b, y: 0 }, { x: m, y: h }) < 22) return null
  const u = sc.unit
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: b, y: 0 } },
      { id: 'C', p: { x: m, y: h } },
      { id: 'H', p: { x: m, y: 0 }, label: '' },
    ],
    [seg('A', 'B'), seg('A', 'C', numText(c)), seg('B', 'C'), seg('C', 'H', '?', true)],
    [rightAt('H', 'A', 'C')],
    ['A', 'B', 'C'],
    sc.pose,
    'An isosceles triangle with a leg labeled and the height drawn to the base.',
  )
  const height = int(h)
  const area = int((b * h) / 2)
  const heightTraps = [
    ...legSlips(c, m, 'a').filter((item) => item.id !== 'trig_pythag_subtracted'),
    trap('trig_pythag_added', 'a', sqrtInt(c * c + m * m), W.added),
    trap('trig_side_not_rooted', 'a', int(c * c - m * m), W.notRoot),
  ]
  if (c > b) heightTraps.push(trap('geo_half_not_taken', 'a', sqrtInt(c * c - b * b), W.halfLen))
  const a = stage('a', 'Height', height, CARD.height, 'The height is a leg of the right triangle. Use half the base, then subtract the squares.', `The height comes from the right triangle under a leg, which gives ${qSay(height)}.`, heightTraps, [int(c), int(b)])
  const areaTraps = [trap('geo_area_not_halved', 'b', int(b * h), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(int(b * c), 2), W.slant)]
  const bStage = stage('b', 'Area', area, CARD.triangle, 'Take half the base times the height you found.', `The area is half the base times that height, which gives ${qSay(area)}.`, areaTraps, [int(b), int(c)])
  const prompt = say(sc.opener, has('isosceles triangle', `legs of ${c} ${u} and a base of ${b} ${u}`), askBoth('height', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [a, bStage], [c, b], { shape: 'isoTri', ask: 'height' }, rng)
}

function rightHyp(rng: Rng, sc: Scene): GeoBuilt | null {
  const t = pyth(rng, 30)
  if (!t) return null
  const a = t.a
  const b = t.b
  const c = t.c
  if (smallestAngle({ x: a, y: 0 }, { x: 0, y: b }, { x: 0, y: 0 }) < 22) return null
  const u = sc.unit
  const figure = pack(
    [
      { id: 'A', p: { x: a, y: 0 } },
      { id: 'B', p: { x: 0, y: b } },
      { id: 'C', p: { x: 0, y: 0 } },
    ],
    [seg('C', 'A', numText(a)), seg('C', 'B', numText(b)), seg('A', 'B', '?')],
    [rightAt('C', 'A', 'B')],
    ['A', 'B', 'C'],
    sc.pose,
    'A right triangle with both legs labeled.',
  )
  const hyp = int(c)
  const area = qdivN(int(a * b), 2)
  const aStage = stage('a', 'Hypotenuse', hyp, CARD.height, 'Add the squares of the legs and take the square root.', `The hypotenuse comes from adding the squares of the legs, which gives ${qSay(hyp)}.`, hypSlips(a, b, 'a'), [int(a), int(b)])
  const areaTraps = [trap('geo_area_not_halved', 'b', int(a * b), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(int(a * c), 2), W.slant)]
  const bStage = stage('b', 'Area', area, CARD.triangle, 'Take half the product of the legs.', `The area is half the product of the legs, which gives ${qSay(area)}.`, areaTraps, [int(a), int(b)])
  const prompt = say(sc.opener, has('right triangle', `legs of ${a} ${u} and ${b} ${u}`), askBoth('hypotenuse', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [aStage, bStage], [a, b], { shape: 'rightHyp', ask: 'hyp' }, rng)
}

function rightLeg(rng: Rng, sc: Scene): GeoBuilt | null {
  const t = pyth(rng, 30)
  if (!t) return null
  const leg = t.a
  const other = t.b
  const c = t.c
  if (smallestAngle({ x: leg, y: 0 }, { x: 0, y: other }, { x: 0, y: 0 }) < 22) return null
  const u = sc.unit
  const figure = pack(
    [
      { id: 'A', p: { x: leg, y: 0 } },
      { id: 'B', p: { x: 0, y: other } },
      { id: 'C', p: { x: 0, y: 0 } },
    ],
    [seg('C', 'A', numText(leg)), seg('C', 'B', '?'), seg('A', 'B', numText(c))],
    [rightAt('C', 'A', 'B')],
    ['A', 'B', 'C'],
    sc.pose,
    'A right triangle with one leg and the hypotenuse labeled.',
  )
  const answer = int(other)
  const area = qdivN(int(leg * other), 2)
  const slips = [trap('trig_pythag_added', 'a', sqrtInt(c * c + leg * leg), W.added), trap('trig_side_not_rooted', 'a', int(c * c - leg * leg), W.notRoot)]
  const aStage = stage('a', 'Leg', answer, CARD.height, 'Subtract the square of the leg from the square of the hypotenuse and take the square root.', `The missing leg comes from subtracting the squares, which gives ${qSay(answer)}.`, slips, [int(leg), int(c)])
  const bStage = stage('b', 'Area', area, CARD.triangle, 'Take half the product of the legs.', `The area is half the product of the legs, which gives ${qSay(area)}.`, [trap('geo_area_not_halved', 'b', int(leg * other), W.notHalved)], [int(leg), int(c)])
  const prompt = say(sc.opener, has('right triangle', `a leg of ${leg} ${u} and a hypotenuse of ${c} ${u}`), askBoth('leg', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [aStage, bStage], [leg, c], { shape: 'rightLeg', ask: 'leg' }, rng)
}

function equilateral(rng: Rng, sc: Scene): GeoBuilt | null {
  const s = rng.int(4, 18)
  const height = sideOf('30', 'hyp', int(s), 'long')
  if (qSay(height) === '2√3') return null
  const area = qdivN(qmul(int(s), height), 2)
  const u = sc.unit
  const y = (s * Math.sqrt(3)) / 2
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: s, y: 0 } },
      { id: 'C', p: { x: s / 2, y } },
      { id: 'H', p: { x: s / 2, y: 0 }, label: '' },
    ],
    [seg('A', 'B'), seg('B', 'C', numText(s)), seg('C', 'A'), seg('C', 'H', '?', true)],
    [rightAt('H', 'A', 'C')],
    ['A', 'B', 'C'],
    sc.pose,
    'An equilateral triangle with one side labeled and the height drawn.',
  )
  const heightTraps = [...specialTraps('30', 'hyp', int(s), 'long', 'a'), trap('geo_half_not_taken', 'a', qmul(int(s), rad(1, 1, 3)), W.halfLen)]
  const aStage = stage('a', 'Height', height, CARD.special, 'The height is the long leg of a thirty-sixty-ninety triangle whose hypotenuse is the side.', `The height is half the side times the square root of three, which gives ${qSay(height)}.`, heightTraps, [int(s)])
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(int(s), height), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(int(s * s), 2), W.slant)]
  const bStage = stage('b', 'Area', area, CARD.equilateral, 'Square the side, multiply by the square root of three, and divide by four.', `The area is the square of the side, times the square root of three, divided by four, which gives ${qSay(area)}.`, areaTraps, [int(s)])
  const prompt = say(sc.opener, has('equilateral triangle', `a side of ${s} ${u}`), askBoth('height', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [aStage, bStage], [s], { shape: 'equilateral', ask: 'height' }, rng)
}

function isoTrap(rng: Rng, sc: Scene): GeoBuilt | null {
  const t = pyth(rng, 26)
  if (!t) return null
  const m = Math.min(t.a, t.b)
  const h = Math.max(t.a, t.b)
  const c = t.c
  if (m < 3 || h < 4 || h / m < 0.4 || h / m > 2.6) return null
  const b1 = rng.int(4, 14)
  const b2 = b1 + 2 * m
  if (h / b2 < 0.28 || h / b2 > 1.8) return null
  const u = sc.unit
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: b2, y: 0 } },
      { id: 'C', p: { x: b1 + m, y: h } },
      { id: 'D', p: { x: m, y: h } },
      { id: 'H', p: { x: m, y: 0 }, label: '' },
    ],
    [seg('A', 'B', numText(b2)), seg('B', 'C'), seg('C', 'D', numText(b1)), seg('D', 'A', numText(c)), seg('D', 'H', '?', true)],
    [rightAt('H', 'A', 'D')],
    ['A', 'B', 'C', 'D'],
    sc.pose,
    'An isosceles trapezoid with the bases and a leg labeled, and the height drawn.',
  )
  const height = int(h)
  const area = int((h * (b1 + b2)) / 2)
  const heightTraps = [trap('trig_pythag_added', 'a', sqrtInt(c * c + m * m), W.added), trap('trig_side_not_rooted', 'a', int(c * c - m * m), W.notRoot)]
  if (c > b2 - b1) heightTraps.push(trap('geo_half_not_taken', 'a', sqrtInt(c * c - (b2 - b1) * (b2 - b1)), W.halfLen))
  const aStage = stage('a', 'Height', height, CARD.height, 'Half the difference of the bases is a leg of the right triangle. Subtract the squares.', `The height comes from the right triangle under a leg, which gives ${qSay(height)}.`, heightTraps, [int(b1), int(b2), int(c)])
  const areaTraps = [trap('geo_area_not_halved', 'b', int(h * (b1 + b2)), W.notHalved), trap('geo_bases_multiplied', 'b', qdivN(int(h * b1 * b2), 2), W.bases)]
  const bStage = stage('b', 'Area', area, CARD.trapezoid, 'Add the bases, multiply by the height, and take half.', `The area is half the height times the sum of the bases, which gives ${qSay(area)}.`, areaTraps, [int(b1), int(b2), int(c)])
  const prompt = say(sc.opener, has('isosceles trapezoid', `bases of ${b1} ${u} and ${b2} ${u} and a leg of ${c} ${u}`), askBoth('height', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [aStage, bStage], [b1, b2, c], { shape: 'isoTrap', ask: 'height' }, rng)
}

function paraSpecial(rng: Rng, sc: Scene, which: '30' | '45'): GeoBuilt | null {
  const s = rng.int(which === '30' ? 3 : 3, 12) * 2
  const slant = int(s)
  const height = which === '30' ? sideOf('30', 'hyp', slant, 'short') : sideOf('45', 'hyp', slant, 'leg')
  const over = which === '30' ? (s * Math.sqrt(3)) / 2 : (s * Math.sqrt(2)) / 2
  const h = which === '30' ? s / 2 : (s * Math.sqrt(2)) / 2
  const extra = rng.int(4, 12)
  const b = Math.ceil(over + extra)
  if (h / b < 0.22 || h / b > 1.6) return null
  const u = sc.unit
  const area = qmul(int(b), height)
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: b, y: 0 } },
      { id: 'C', p: { x: b + over, y: h } },
      { id: 'D', p: { x: over, y: h } },
      { id: 'H', p: { x: over, y: 0 }, label: '' },
    ],
    [seg('A', 'B'), seg('B', 'C'), seg('C', 'D', numText(b)), seg('D', 'A', numText(s)), seg('D', 'H', '?', true)],
    [rightAt('H', 'B', 'D')],
    ['A', 'B', 'C', 'D'],
    sc.pose,
    'A parallelogram with a base, a slanted side, and the perpendicular height.',
  )
  const from: SpecialRole = 'hyp'
  const to: SpecialRole = which === '30' ? 'short' : 'leg'
  const tri: SpecialTriangle = which === '30' ? '30' : '45'
  const heightTraps = [...specialTraps(tri, from, slant, to, 'a'), trap('geo_slant_as_height', 'a', slant, W.slant)]
  // The slant is drawn. Answering the height with it is the named slip, so the slant is not a given of this part.
  const aStage = stage('a', 'Height', height, CARD.special, 'Use the special right triangle on the slanted side to find the perpendicular height.', `The height comes from the special right triangle, which gives ${qSay(height)}.`, heightTraps, [int(b), int(Number(which))])
  const areaTraps = [trap('geo_slant_as_height', 'b', int(b * s), W.slant), trap('geo_half_applied', 'b', qdivN(area, 2), W.halfApplied)]
  const bStage = stage('b', 'Area', area, CARD.rect, 'Multiply the base by the perpendicular height.', `The area is the base times that height, which gives ${qSay(area)}.`, areaTraps, [int(b), int(s)])
  const prompt = say(sc.opener, has('parallelogram', `one angle of ${which} degrees, a base of ${b} ${u}, and a slanted side of ${s} ${u}`), askBoth('height', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [aStage, bStage], [b, s, Number(which)], { shape: which === '30' ? 'para30' : 'para45', ask: 'height' }, rng)
}

function tri30(rng: Rng, sc: Scene): GeoBuilt | null {
  const a = rng.int(4, 16)
  const short = int(a)
  const height = sideOf('30', 'short', short, 'long')
  const hyp = sideOf('30', 'short', short, 'hyp')
  const area = qdivN(qmul(short, height), 2)
  const u = sc.unit
  const long = a * Math.sqrt(3)
  const figure = pack(
    [
      { id: 'C', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: 0, y: a } },
      { id: 'A', p: { x: long, y: 0 } },
    ],
    [seg('B', 'C', numText(a)), seg('C', 'A', '?'), seg('A', 'B')],
    [rightAt('C', 'B', 'A')],
    ['A', 'B', 'C'],
    sc.pose,
    'A right triangle with the shorter leg labeled.',
  )
  const heightTraps = specialTraps('30', 'short', short, 'long', 'a')
  const aStage = stage('a', 'Height', height, CARD.special, 'The height is the longer leg, the short leg times the square root of three.', `The longer leg is the short leg times the square root of three, which gives ${qSay(height)}.`, heightTraps, [short, int(30)])
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(short, height), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(qmul(short, hyp), 2), W.slant)]
  const bStage = stage('b', 'Area', area, CARD.triangle, 'Take half the shorter leg times the height.', `The area is half the shorter leg times that height, which gives ${qSay(area)}.`, areaTraps, [short])
  const prompt = say(sc.opener, has('right triangle', `one angle of 30 degrees and a shorter leg of ${a} ${u}`), askBoth('height', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [aStage, bStage], [a, 30], { shape: 'tri30', ask: 'height' }, rng)
}

function tri45(rng: Rng, sc: Scene): GeoBuilt | null {
  const h = rng.int(3, 12) * 2
  const hyp = int(h)
  const leg = sideOf('45', 'hyp', hyp, 'leg')
  const area = qdivN(qmul(leg, leg), 2)
  const y = (h * Math.sqrt(2)) / 2
  const u = sc.unit
  const figure = pack(
    [
      { id: 'C', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: 0, y } },
      { id: 'A', p: { x: y, y: 0 } },
    ],
    [seg('B', 'C', '?'), seg('C', 'A'), seg('A', 'B', numText(h))],
    [rightAt('C', 'B', 'A')],
    ['A', 'B', 'C'],
    sc.pose,
    'An isosceles right triangle with the hypotenuse labeled.',
  )
  const heightTraps = specialTraps('45', 'hyp', hyp, 'leg', 'a')
  const aStage = stage('a', 'Height', leg, CARD.special, 'Each leg is the hypotenuse divided by the square root of two.', `A leg is the hypotenuse divided by the square root of two, which gives ${qSay(leg)}.`, heightTraps, [hyp, int(45)])
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(leg, leg), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(qmul(leg, hyp), 2), W.slant)]
  const bStage = stage('b', 'Area', area, CARD.triangle, 'Take half the product of the equal legs.', `The area is half the product of the legs, which gives ${qSay(area)}.`, areaTraps, [hyp])
  const prompt = say(sc.opener, has('right triangle', `one angle of 45 degrees and a hypotenuse of ${h} ${u}`), askBoth('height', u))
  return deliver('specialArea', 'Find the height, then the area', prompt, figure, [aStage, bStage], [h, 45], { shape: 'tri45', ask: 'height' }, rng)
}

// --- regular ------------------------------------------------------------------------------------------------

function regular(rng: Rng, kind: Regular, givenAsk: 'area' | 'perimeter'): GeoBuilt | null {
  const sc = scene(rng)
  if (kind === 'given') return givenRegular(rng, sc, givenAsk)
  if (kind === 'hexSide') return hexLike(rng, sc, 'side')
  if (kind === 'hexRadius') return hexLike(rng, sc, 'radius')
  if (kind === 'sqSide') return squareSide(rng, sc)
  if (kind === 'sqRadius') return squareRadius(rng, sc)
  if (kind === 'eqSide') return eqSide(rng, sc)
  return eqRadius(rng, sc)
}

function givenRegular(rng: Rng, sc: Scene, ask: 'area' | 'perimeter'): GeoBuilt | null {
  const n = rng.pick([5, 6, 8, 10, 12] as const)
  const side = rng.chance(0.25) && ask === 'area' ? rng.int(4, 12) + 0.5 : rng.int(4, 14)
  const trueAp = side / 2 / Math.tan(Math.PI / n)
  const rawChoices = [Math.round(trueAp), Math.round(trueAp * 2) / 2]
  const choices: number[] = []
  const peri = n * side
  for (const stated of rawChoices) {
    if (stated < 2 || Math.abs(stated - trueAp) > 0.5 + 1e-9) continue
    if (Math.abs(stated - side) < 1e-6) continue
    const area = (stated * peri) / 2
    if (Math.abs(area - Math.round(area)) > 1e-6) continue
    const areaN = Math.round(area)
    if (areaN <= 1 || areaN === 43) continue
    if (Math.abs(areaN - side) < 1e-6 || Math.abs(areaN - stated) < 1e-6 || areaN === n) continue
    if (Math.abs(peri - areaN) < 1e-6) continue
    if (ask === 'perimeter' && Math.abs(peri - Math.round(peri)) > 1e-6) continue
    choices.push(stated)
  }
  if (choices.length === 0) return null
  const stated = rng.pick(choices)
  const areaN = Math.round((stated * peri) / 2)
  const built = regularFigure(n, side, sc.pose, numText(side), numText(stated), false)
  if (!built) return null
  const u = sc.unit
  const name = REG_NAME[n]!
  const facts = `an apothem of ${numText(stated)} ${u} and a side of ${numText(side)} ${u}`
  const givens = [qNum(stated), qNum(side)]
  if (ask === 'perimeter') {
    const answer = qNum(peri)
    const area = int(areaN)
    const st = stage('a', 'Perimeter', answer, CARD.regular, 'The perimeter is the number of sides times one side.', `The perimeter is the number of sides times one side, which gives ${qSay(answer)}.`, [trap('geo_area_for_perimeter', 'a', area, W.areaPeri)], givens)
    const prompt = say(sc.opener, has(name, facts), askOne('perimeter', u))
    return deliver('regularArea', 'Area of a regular polygon', prompt, built, [st], [stated, side].filter((n0) => Number.isInteger(n0)), { shape: name, ask }, rng)
  }
  const answer = int(areaN)
  const doubled = int(areaN * 2)
  const traps = [trap('geo_area_not_halved', 'a', doubled, W.notHalved)]
  if (Math.abs(peri - Math.round(peri)) < 1e-6) traps.push(trap('geo_perimeter_for_area', 'a', int(Math.round(peri)), W.peri))
  const st = stage('a', 'Area', answer, CARD.regular, 'Take half the apothem times the perimeter.', `The area is half the apothem times the perimeter, which gives ${qSay(answer)}.`, traps, givens)
  const prompt = say(sc.opener, has(name, facts), askOne('area', u))
  return deliver('regularArea', 'Area of a regular polygon', prompt, built, [st], [stated, side].filter((n0) => Number.isInteger(n0)), { shape: name, ask }, rng)
}

function regularFigure(n: number, side: number, pose: Pose, sideLabel: string, apothemLabel: string, radiusLabel: string | false): GeoFigureSpec | null {
  const R = side / 2 / Math.sin(Math.PI / n)
  const raw: Raw[] = [{ id: 'O', p: { x: 0, y: 0 }, label: '' }]
  for (let i = 0; i < n; i++) {
    const ang = Math.PI / n + (2 * Math.PI * i) / n
    raw.push({ id: `P${i}`, p: { x: R * Math.cos(ang), y: R * Math.sin(ang) }, label: '' })
  }
  const p0 = raw[1]!.p
  const p1 = raw[2]!.p
  raw.push({ id: 'M', p: { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }, label: '' })
  const labeledSide = Math.floor(n / 2)
  const segments: GeoSegment[] = []
  for (let i = 0; i < n; i++) segments.push(seg(`P${i}`, `P${(i + 1) % n}`, i === labeledSide ? sideLabel : undefined))
  segments.push(seg('O', 'M', apothemLabel, true))
  if (radiusLabel) segments.push(seg('O', 'P0', radiusLabel))
  return pack(raw, segments, [rightAt('M', 'P0', 'O')], Array.from({ length: n }, (_, i) => `P${i}`), pose, 'A regular polygon with a side and the apothem drawn from the center.')
}

function hexLike(rng: Rng, sc: Scene, given: 'side' | 'radius'): GeoBuilt | null {
  const s = rng.int(4, 16)
  const radius = int(s)
  const apothem = sideOf('30', 'hyp', radius, 'long')
  if (qSay(apothem) === '2√3') return null
  const area = qdivN(qmul(apothem, int(6 * s)), 2)
  const u = sc.unit
  const figure = regularFigure(6, s, sc.pose, given === 'side' ? numText(s) : '', '?', given === 'radius' ? numText(s) : false)
  const apTraps = [trap('geo_apothem_for_radius', 'a', radius, W.apothem), ...specialTraps('30', 'hyp', radius, 'long', 'a'), trap('geo_half_not_taken', 'a', qmul(radius, rad(1, 1, 3)), W.halfLen)]
  const aStage = stage('a', 'Apothem', apothem, CARD.special, 'The apothem is the long leg of the thirty-sixty-ninety triangle from the center.', `The apothem is half the side times the square root of three, which gives ${qSay(apothem)}.`, apTraps, [])
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(apothem, int(6 * s)), W.notHalved), trap('geo_perimeter_for_area', 'b', int(6 * s), W.peri)]
  const bStage = stage('b', 'Area', area, CARD.regular, 'Take half the apothem times the perimeter.', `The area is half the apothem times the perimeter, which gives ${qSay(area)}.`, areaTraps, [radius])
  const facts = given === 'side' ? `a side of ${s} ${u}` : `a radius of ${s} ${u}`
  const prompt = say(sc.opener, has('regular hexagon', facts), askBoth('apothem', u))
  return deliver('regularArea', 'Area of a regular polygon', prompt, figure, [aStage, bStage], [s], { shape: 'regular hexagon', ask: 'apothem' }, rng)
}

function squareSide(rng: Rng, sc: Scene): GeoBuilt | null {
  const s = rng.int(4, 16)
  const side = int(s)
  const apothem = qdivN(side, 2)
  const radius = qdivN(qmul(side, rad(1, 1, 2)), 2)
  const area = int(s * s)
  const u = sc.unit
  const figure = regularFigure(4, s, sc.pose, numText(s), '?', false)
  const apTraps = [trap('geo_apothem_for_radius', 'a', radius, W.apothem), trap('geo_half_not_taken', 'a', side, W.halfLen), ...specialTraps('45', 'hyp', side, 'leg', 'a')]
  const aStage = stage('a', 'Apothem', apothem, CARD.regular, 'The apothem of a square is half a side, shorter than the radius.', `The apothem is half the side, which gives ${qSay(apothem)}.`, apTraps, [])
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(apothem, int(4 * s)), W.notHalved), trap('geo_perimeter_for_area', 'b', int(4 * s), W.peri)]
  const bStage = stage('b', 'Area', area, CARD.rect, 'The area of a square is the side times itself.', `The area is the side times itself, which gives ${qSay(area)}.`, areaTraps, [side])
  const prompt = say(sc.opener, has('square', `a side of ${s} ${u}`), askBoth('apothem', u))
  return deliver('regularArea', 'Area of a regular polygon', prompt, figure, [aStage, bStage], [s], { shape: 'square', ask: 'apothem' }, rng)
}

function squareRadius(rng: Rng, sc: Scene): GeoBuilt | null {
  const r = rng.int(4, 14)
  const radius = int(r)
  const apothem = sideOf('45', 'hyp', radius, 'leg')
  const side = qmulN(apothem, 2)
  const area = qmul(side, side)
  const u = sc.unit
  const figure = regularFigure(4, r * Math.sqrt(2), sc.pose, '', '?', numText(r))
  const apTraps = [trap('geo_apothem_for_radius', 'a', radius, W.apothem), ...specialTraps('45', 'hyp', radius, 'leg', 'a')]
  const aStage = stage('a', 'Apothem', apothem, CARD.special, 'The apothem is a leg of the forty-five-forty-five-ninety triangle whose hypotenuse is the radius.', `The apothem is the radius divided by the square root of two, which gives ${qSay(apothem)}.`, apTraps, [])
  const peri = qmulN(side, 4)
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(apothem, peri), W.notHalved), trap('geo_perimeter_for_area', 'b', peri, W.peri)]
  const bStage = stage('b', 'Area', area, CARD.regular, 'Take half the apothem times the perimeter.', `The area is half the apothem times the perimeter, which gives ${qSay(area)}.`, areaTraps, [radius])
  const prompt = say(sc.opener, has('square', `a radius of ${r} ${u}`), askBoth('apothem', u))
  return deliver('regularArea', 'Area of a regular polygon', prompt, figure, [aStage, bStage], [r], { shape: 'square', ask: 'apothem' }, rng)
}

function eqSide(rng: Rng, sc: Scene): GeoBuilt | null {
  const s = rng.int(4, 16)
  if (s === 6) return null
  const side = int(s)
  const height = sideOf('30', 'hyp', side, 'long')
  const apothem = qdivN(height, 3)
  if (qSay(apothem) === '2√3') return null
  const radius = qmulN(apothem, 2)
  const area = qdivN(qmul(side, height), 2)
  const u = sc.unit
  const figure = regularFigure(3, s, sc.pose, numText(s), '?', false)
  const apTraps = [trap('geo_apothem_for_radius', 'a', radius, W.apothem), trap('geo_half_not_taken', 'a', qdivN(side, 2), W.halfLen), ...specialTraps('30', 'hyp', side, 'short', 'a')]
  const aStage = stage('a', 'Apothem', apothem, CARD.equilateral, 'The apothem is a third of the height, and shorter than the radius.', `The apothem is a third of the height, which gives ${qSay(apothem)}.`, apTraps, [])
  const peri = int(3 * s)
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(apothem, peri), W.notHalved), trap('geo_perimeter_for_area', 'b', peri, W.peri)]
  const bStage = stage('b', 'Area', area, CARD.equilateral, 'Square the side, multiply by the square root of three, and divide by four.', `The area is the square of the side, times the square root of three, divided by four, which gives ${qSay(area)}.`, areaTraps, [side])
  const prompt = say(sc.opener, has('equilateral triangle', `a side of ${s} ${u}`), askBoth('apothem', u))
  return deliver('regularArea', 'Area of a regular polygon', prompt, figure, [aStage, bStage], [s], { shape: 'equilateral triangle', ask: 'apothem' }, rng)
}

function eqRadius(rng: Rng, sc: Scene): GeoBuilt | null {
  const r = rng.int(4, 14)
  const radius = int(r)
  const apothem = qdivN(radius, 2)
  const side = qmul(radius, rad(1, 1, 3))
  const area = qdivN(qmul(qmul(int(3), qmul(radius, radius)), rad(1, 1, 3)), 4)
  const u = sc.unit
  const sideLen = r * Math.sqrt(3)
  const figure = regularFigure(3, sideLen, sc.pose, '', '?', numText(r))
  const apTraps = [trap('geo_apothem_for_radius', 'a', radius, W.apothem), ...specialTraps('30', 'hyp', radius, 'short', 'a')]
  const aStage = stage('a', 'Apothem', apothem, CARD.special, 'The apothem is the short leg of the thirty-sixty-ninety triangle, half the radius.', `The apothem is half the radius, which gives ${qSay(apothem)}.`, apTraps, [])
  const peri = qmulN(side, 3)
  const areaTraps = [trap('geo_area_not_halved', 'b', qmul(apothem, peri), W.notHalved)]
  const bStage = stage('b', 'Area', area, CARD.regular, 'Take half the apothem times the perimeter.', `The area is half the apothem times the perimeter, which gives ${qSay(area)}.`, areaTraps, [radius])
  const prompt = say(sc.opener, has('equilateral triangle', `a radius of ${r} ${u}`), askBoth('apothem', u))
  return deliver('regularArea', 'Area of a regular polygon', prompt, figure, [aStage, bStage], [r], { shape: 'equilateral triangle', ask: 'apothem' }, rng)
}

// --- public templates ----------------------------------------------------------------------------------------

export function drawBasic(seed: number): GeoBuilt {
  const shape = modeOf(seed, 11, SHAPES)
  const ask = modeOf(seed, 12, BASIC_ASK[shape])
  return generate(seed, 13, (rng) => basic(rng, shape, ask))
}

export function drawSpecial(seed: number): GeoBuilt {
  const kind = modeOf(seed, 21, SPECIAL)
  return generate(seed, 23, (rng) => special(rng, kind))
}

export function drawRegular(seed: number): GeoBuilt {
  const kind = modeOf(seed, 31, REGULAR)
  const givenAsk = modeOf(seed, 32, ['area', 'perimeter'] as const)
  return generate(seed, 33, (rng) => regular(rng, kind, givenAsk))
}

function search(draw: (pose: Pose, rng: Rng) => GeoBuilt | null): GeoBuilt {
  for (let turn = 0; turn < 360; turn += 10) {
    for (const reflect of [false, true]) {
      const built = draw({ turn, reflect }, makeRng(1))
      if (built) return built
    }
  }
  throw new Error(`hand figure: ${lastWhy}`)
}

export function handTriangle106(): GeoBuilt {
  return search((pose, rng) => {
    const b = 10
    const h = 6
    const sQty = sqrtInt(b * b + h * h)
    const areaQty = int(30)
    const figure = pack(
      [
        { id: 'A', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: b, y: 0 } },
        { id: 'C', p: { x: 0, y: h } },
      ],
      [seg('A', 'B', '10'), seg('A', 'C', '6'), seg('B', 'C', qSay(sQty))],
      [rightAt('A', 'B', 'C')],
      ['A', 'B', 'C'],
      pose,
      'A triangle with a base, a perpendicular height, and a slanted side.',
    )
    const st = stage('a', 'Area', areaQty, CARD.triangle, 'Take half the base times the perpendicular height, not the slanted side.', `The area is half the base times the perpendicular height, which gives ${qSay(areaQty)}.`, [trap('geo_area_not_halved', 'a', int(60), W.notHalved), trap('geo_slant_as_height', 'a', qdivN(qmul(int(b), sQty), 2), W.slant)], [int(10), int(6), sQty])
    return deliver('polygonArea', 'Areas of polygons', say('', has('triangle', `a base of 10 cm, a height of 6 cm, and a slanted side of ${qSay(sQty)} cm`), askOne('area', 'cm')), figure, [st], [10, 6], { shape: 'triangle', ask: 'area' }, rng)
  })
}

export function handTrapezoid6104(): GeoBuilt {
  return search((pose, rng) => {
    const figure = pack(
      [
        { id: 'A', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 10, y: 0 } },
        { id: 'C', p: { x: 6, y: 4 } },
        { id: 'D', p: { x: 0, y: 4 } },
      ],
      [seg('A', 'B', '10'), seg('B', 'C'), seg('C', 'D', '6'), seg('D', 'A', '4')],
      [rightAt('A', 'B', 'D'), rightAt('D', 'A', 'C')],
      ['A', 'B', 'C', 'D'],
      pose,
      'A trapezoid with the two bases and the height labeled.',
    )
    const st = stage('a', 'Area', int(32), CARD.trapezoid, 'Add the two bases, multiply by the height, and take half.', 'The area is half the height times the sum of the bases, which gives 32.', [trap('geo_area_not_halved', 'a', int(64), W.notHalved), trap('geo_bases_multiplied', 'a', int(120), W.bases)], [int(6), int(10), int(4)])
    return deliver('polygonArea', 'Areas of polygons', say('', has('trapezoid', 'bases of 6 cm and 10 cm and a height of 4 cm'), askOne('area', 'cm')), figure, [st], [6, 10, 4], { shape: 'trapezoid', ask: 'area' }, rng)
  })
}

export function handRhombus1024(): GeoBuilt {
  return search((pose, rng) => {
    const figure = kiteFigure(5, 5, 12, '10', '24', pose, 'A rhombus with both diagonals labeled.')
    const st = stage('a', 'Area', int(120), CARD.diagonals, 'Take half the product of the diagonals.', 'The area is half the product of the diagonals, which gives 120.', [trap('geo_area_not_halved', 'a', int(240), W.notHalved), trap('geo_perimeter_for_area', 'a', int(52), W.peri)], [int(10), int(24)])
    return deliver('polygonArea', 'Areas of polygons', say('', has('rhombus', 'diagonals of 10 cm and 24 cm'), askOne('area', 'cm')), figure, [st], [10, 24], { shape: 'rhombus', ask: 'area', kite: false }, rng)
  })
}

export function handEquilateral6(): GeoBuilt {
  return search((pose, rng) => equilateralFixed(pose, rng, 6))
}

function equilateralFixed(pose: Pose, rng: Rng, s: number): GeoBuilt | null {
  const height = sideOf('30', 'hyp', int(s), 'long')
  const area = qdivN(qmul(int(s), height), 2)
  const y = (s * Math.sqrt(3)) / 2
  const figure = pack(
    [
      { id: 'A', p: { x: 0, y: 0 } },
      { id: 'B', p: { x: s, y: 0 } },
      { id: 'C', p: { x: s / 2, y } },
      { id: 'H', p: { x: s / 2, y: 0 }, label: '' },
    ],
    [seg('A', 'B'), seg('B', 'C', numText(s)), seg('C', 'A'), seg('C', 'H', '?', true)],
    [rightAt('H', 'A', 'C')],
    ['A', 'B', 'C'],
    pose,
    'An equilateral triangle with one side labeled and the height drawn.',
  )
  const aStage = stage('a', 'Height', height, CARD.special, 'The height is the long leg of a thirty-sixty-ninety triangle whose hypotenuse is the side.', `The height is half the side times the square root of three, which gives ${qSay(height)}.`, [...specialTraps('30', 'hyp', int(s), 'long', 'a'), trap('geo_half_not_taken', 'a', qmul(int(s), rad(1, 1, 3)), W.halfLen)], [int(s)])
  const bStage = stage('b', 'Area', area, CARD.equilateral, 'Square the side, multiply by the square root of three, and divide by four.', `The area is the square of the side, times the square root of three, divided by four, which gives ${qSay(area)}.`, [trap('geo_area_not_halved', 'b', qmul(int(s), height), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(int(s * s), 2), W.slant)], [int(s)])
  return deliver('specialArea', 'Find the height, then the area', say('', has('equilateral triangle', `a side of ${s} cm`), askBoth('height', 'cm')), figure, [aStage, bStage], [s], { shape: 'equilateral', ask: 'height' }, rng)
}

export function handIso13(): GeoBuilt {
  return search((pose, rng) => {
    const figure = pack(
      [
        { id: 'A', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 10, y: 0 } },
        { id: 'C', p: { x: 5, y: 12 } },
        { id: 'H', p: { x: 5, y: 0 }, label: '' },
      ],
      [seg('A', 'B'), seg('A', 'C', '13'), seg('B', 'C'), seg('C', 'H', '?', true)],
      [rightAt('H', 'A', 'C')],
      ['A', 'B', 'C'],
      pose,
      'An isosceles triangle with a leg labeled and the height drawn to the base.',
    )
    const aStage = stage('a', 'Height', int(12), CARD.height, 'The height is a leg of the right triangle. Use half the base, then subtract the squares.', 'The height comes from the right triangle under a leg, which gives 12.', [trap('trig_pythag_added', 'a', sqrtInt(194), W.added), trap('trig_side_not_rooted', 'a', int(144), W.notRoot), trap('geo_half_not_taken', 'a', sqrtInt(69), W.halfLen)], [int(13), int(10)])
    const bStage = stage('b', 'Area', int(60), CARD.triangle, 'Take half the base times the height you found.', 'The area is half the base times that height, which gives 60.', [trap('geo_area_not_halved', 'b', int(120), W.notHalved), trap('geo_slant_as_height', 'b', int(65), W.slant)], [int(10), int(13)])
    return deliver('specialArea', 'Find the height, then the area', say('', has('isosceles triangle', 'legs of 13 cm and a base of 10 cm'), askBoth('height', 'cm')), figure, [aStage, bStage], [13, 10], { shape: 'isoTri', ask: 'height' }, rng)
  })
}

/**
 * Side 4 is the textbook example (apothem 2√3, area 24√3). The shared number hint uses 2√3 as its example, so the
 * screen gate will not ship this problem; the hand test still checks the arithmetic and the slips.
 */
export function handHex4(): GeoBuilt {
  const s = 4
  const radius = int(s)
  const apothem = sideOf('30', 'hyp', radius, 'long')
  const area = qdivN(qmul(apothem, int(24)), 2)
  const aStage = stage('a', 'Apothem', apothem, CARD.special, 'The apothem is the long leg of the thirty-sixty-ninety triangle from the center.', `The apothem is half the side times the square root of three, which gives ${qSay(apothem)}.`, [trap('geo_apothem_for_radius', 'a', radius, W.apothem), ...specialTraps('30', 'hyp', radius, 'long', 'a'), trap('geo_half_not_taken', 'a', qmul(radius, rad(1, 1, 3)), W.halfLen)], [])
  const bStage = stage('b', 'Area', area, CARD.regular, 'Take half the apothem times the perimeter.', `The area is half the apothem times the perimeter, which gives ${qSay(area)}.`, [trap('geo_area_not_halved', 'b', qmul(apothem, int(24)), W.notHalved), trap('geo_perimeter_for_area', 'b', int(24), W.peri)], [radius])
  const prompt = say('', has('regular hexagon', 'a side of 4 cm'), askBoth('apothem', 'cm'))
  const title = 'Area of a regular polygon'
  for (let turn = 0; turn < 360; turn += 10) {
    for (const reflect of [false, true]) {
      const figure = regularFigure(6, s, { turn, reflect }, '4', '?', false)
      const built = deliver('regularArea', title, prompt, figure, [aStage, bStage], [4], { shape: 'regular hexagon', ask: 'apothem' }, makeRng(1))
      if (built) return built
      if (figure && lastWhy.includes('2√3')) {
        const promised = aStage.traps[0]!
        return {
          title,
          instructions: INSTRUCTIONS,
          params: { shape: 'regular hexagon', ask: 'apothem', trap: promised.id, trapStage: 'a' },
          answer: {
            type: 'geometry',
            question: 'regularArea',
            prompt,
            figure,
            stages: [aStage, bStage],
            lengths: [4],
            angles: [],
            expectedDisplay: `Apothem: ${aStage.answerText} · Area: ${bStage.answerText}`,
            reveal: [...aStage.reveal, ...bStage.reveal],
            ruleCards: [aStage.ruleCard, bStage.ruleCard],
            trap: promised.id,
            trapStage: 'a',
            trapAnswer: promised.text,
          },
        }
      }
    }
  }
  throw new Error(`hand figure: ${lastWhy}`)
}

export function handOctagon65(): GeoBuilt {
  return search((pose, rng) => {
    const figure = regularFigure(8, 5, pose, '5', '6', false)
    const st = stage('a', 'Area', int(120), CARD.regular, 'Take half the apothem times the perimeter.', 'The area is half the apothem times the perimeter, which gives 120.', [trap('geo_area_not_halved', 'a', int(240), W.notHalved), trap('geo_perimeter_for_area', 'a', int(40), W.peri)], [qNum(6), qNum(5)])
    return deliver('regularArea', 'Area of a regular polygon', say('', has('regular octagon', 'an apothem of 6 cm and a side of 5 cm'), askOne('area', 'cm')), figure, [st], [6, 5], { shape: 'regular octagon', ask: 'area' }, rng)
  })
}

export function handRectangle85(): GeoBuilt {
  return search((pose, rng) => {
    const figure = pack(
      [
        { id: 'A', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 8, y: 0 } },
        { id: 'C', p: { x: 8, y: 5 } },
        { id: 'D', p: { x: 0, y: 5 } },
      ],
      [seg('A', 'B', '8'), seg('B', 'C'), seg('C', 'D'), seg('D', 'A', '5')],
      [rightAt('A', 'B', 'D')],
      ['A', 'B', 'C', 'D'],
      pose,
      'A rectangle with its base and its height labeled.',
    )
    const st = stage('a', 'Area', int(40), CARD.rect, 'Multiply the base by the perpendicular height.', 'The area is the base times the height, which gives 40.', [trap('geo_half_applied', 'a', int(20), W.halfApplied), trap('geo_perimeter_for_area', 'a', int(26), W.peri)], [int(8), int(5)])
    return deliver('polygonArea', 'Areas of polygons', say('', has('rectangle', 'a base of 8 cm and a height of 5 cm'), askOne('area', 'cm')), figure, [st], [8, 5], { shape: 'rectangle', ask: 'area' }, rng)
  })
}

export function handPara14810(): GeoBuilt {
  return search((pose, rng) => {
    const figure = pack(
      [
        { id: 'A', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 14, y: 0 } },
        { id: 'C', p: { x: 20, y: 8 } },
        { id: 'D', p: { x: 6, y: 8 } },
        { id: 'H', p: { x: 6, y: 0 }, label: '' },
      ],
      [seg('A', 'B'), seg('B', 'C'), seg('C', 'D', '14'), seg('D', 'A', '10'), seg('D', 'H', '8', true)],
      [rightAt('H', 'B', 'D')],
      ['A', 'B', 'C', 'D'],
      pose,
      'A parallelogram with a base, a slanted side, and the perpendicular height.',
    )
    const st = stage('a', 'Area', int(112), CARD.rect, 'Multiply the base by the perpendicular height, not by the slanted side.', 'The area is the base times the perpendicular height, which gives 112.', [trap('geo_slant_as_height', 'a', int(140), W.slant), trap('geo_half_applied', 'a', int(56), W.halfApplied)], [int(14), int(8), int(10)])
    return deliver('polygonArea', 'Areas of polygons', say('', has('parallelogram', 'a base of 14 cm, a height of 8 cm, and a slanted side of 10 cm'), askOne('area', 'cm')), figure, [st], [14, 8, 10], { shape: 'parallelogram', ask: 'area' }, rng)
  })
}

export function handKite98(): GeoBuilt {
  return search((pose, rng) => {
    const figure = kiteFigure(3, 6, 4, '9', '8', pose, 'A kite with both diagonals labeled.')
    const st = stage('a', 'Area', int(36), CARD.diagonals, 'Take half the product of the diagonals.', 'The area is half the product of the diagonals, which gives 36.', [trap('geo_area_not_halved', 'a', int(72), W.notHalved)], [int(9), int(8)])
    return deliver('polygonArea', 'Areas of polygons', say('', has('kite', 'diagonals of 9 cm and 8 cm'), askOne('area', 'cm')), figure, [st], [9, 8], { shape: 'rhombus', ask: 'area', kite: true }, rng)
  })
}

export function handRight512(): GeoBuilt {
  return search((pose, rng) => {
    const figure = pack(
      [
        { id: 'A', p: { x: 5, y: 0 } },
        { id: 'B', p: { x: 0, y: 12 } },
        { id: 'C', p: { x: 0, y: 0 } },
      ],
      [seg('C', 'A', '5'), seg('C', 'B', '12'), seg('A', 'B', '?')],
      [rightAt('C', 'A', 'B')],
      ['A', 'B', 'C'],
      pose,
      'A right triangle with both legs labeled.',
    )
    const aStage = stage('a', 'Hypotenuse', int(13), CARD.height, 'Add the squares of the legs and take the square root.', 'The hypotenuse comes from adding the squares of the legs, which gives 13.', hypSlips(5, 12, 'a'), [int(5), int(12)])
    const bStage = stage('b', 'Area', int(30), CARD.triangle, 'Take half the product of the legs.', 'The area is half the product of the legs, which gives 30.', [trap('geo_area_not_halved', 'b', int(60), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(int(5 * 13), 2), W.slant)], [int(5), int(12)])
    return deliver('specialArea', 'Find the height, then the area', say('', has('right triangle', 'legs of 5 cm and 12 cm'), askBoth('hypotenuse', 'cm')), figure, [aStage, bStage], [5, 12], { shape: 'rightHyp', ask: 'hyp' }, rng)
  })
}

export function handTri30(): GeoBuilt {
  return search((pose, rng) => {
    const a = 6
    const height = sideOf('30', 'short', int(a), 'long')
    const hyp = sideOf('30', 'short', int(a), 'hyp')
    const area = qdivN(qmul(int(a), height), 2)
    const long = a * Math.sqrt(3)
    const figure = pack(
      [
        { id: 'C', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 0, y: a } },
        { id: 'A', p: { x: long, y: 0 } },
      ],
      [seg('B', 'C', '6'), seg('C', 'A', '?'), seg('A', 'B')],
      [rightAt('C', 'B', 'A')],
      ['A', 'B', 'C'],
      pose,
      'A right triangle with the shorter leg labeled.',
    )
    const aStage = stage('a', 'Height', height, CARD.special, 'The height is the longer leg, the short leg times the square root of three.', `The longer leg is the short leg times the square root of three, which gives ${qSay(height)}.`, specialTraps('30', 'short', int(a), 'long', 'a'), [int(6), int(30)])
    const bStage = stage('b', 'Area', area, CARD.triangle, 'Take half the shorter leg times the height.', `The area is half the shorter leg times that height, which gives ${qSay(area)}.`, [trap('geo_area_not_halved', 'b', qmul(int(a), height), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(qmul(int(a), hyp), 2), W.slant)], [int(6)])
    return deliver('specialArea', 'Find the height, then the area', say('', has('right triangle', 'one angle of 30 degrees and a shorter leg of 6 cm'), askBoth('height', 'cm')), figure, [aStage, bStage], [6, 30], { shape: 'tri30', ask: 'height' }, rng)
  })
}

export function handTri45(): GeoBuilt {
  return search((pose, rng) => {
    const h = 10
    const leg = sideOf('45', 'hyp', int(h), 'leg')
    const area = qdivN(qmul(leg, leg), 2)
    const y = (h * Math.sqrt(2)) / 2
    const figure = pack(
      [
        { id: 'C', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 0, y } },
        { id: 'A', p: { x: y, y: 0 } },
      ],
      [seg('B', 'C', '?'), seg('C', 'A'), seg('A', 'B', '10')],
      [rightAt('C', 'B', 'A')],
      ['A', 'B', 'C'],
      pose,
      'An isosceles right triangle with the hypotenuse labeled.',
    )
    const aStage = stage('a', 'Height', leg, CARD.special, 'Each leg is the hypotenuse divided by the square root of two.', `A leg is the hypotenuse divided by the square root of two, which gives ${qSay(leg)}.`, specialTraps('45', 'hyp', int(h), 'leg', 'a'), [int(10), int(45)])
    const bStage = stage('b', 'Area', area, CARD.triangle, 'Take half the product of the equal legs.', `The area is half the product of the legs, which gives ${qSay(area)}.`, [trap('geo_area_not_halved', 'b', qmul(leg, leg), W.notHalved), trap('geo_slant_as_height', 'b', qdivN(qmul(leg, int(h)), 2), W.slant)], [int(10)])
    return deliver('specialArea', 'Find the height, then the area', say('', has('right triangle', 'one angle of 45 degrees and a hypotenuse of 10 cm'), askBoth('height', 'cm')), figure, [aStage, bStage], [10, 45], { shape: 'tri45', ask: 'height' }, rng)
  })
}

export function handIsoTrap(): GeoBuilt {
  return search((pose, rng) => {
    const figure = pack(
      [
        { id: 'A', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 16, y: 0 } },
        { id: 'C', p: { x: 11, y: 12 } },
        { id: 'D', p: { x: 5, y: 12 } },
        { id: 'H', p: { x: 5, y: 0 }, label: '' },
      ],
      [seg('A', 'B', '16'), seg('B', 'C'), seg('C', 'D', '6'), seg('D', 'A', '13'), seg('D', 'H', '?', true)],
      [rightAt('H', 'A', 'D')],
      ['A', 'B', 'C', 'D'],
      pose,
      'An isosceles trapezoid with the bases and a leg labeled, and the height drawn.',
    )
    const aStage = stage('a', 'Height', int(12), CARD.height, 'Half the difference of the bases is a leg of the right triangle. Subtract the squares.', 'The height comes from the right triangle under a leg, which gives 12.', [trap('trig_pythag_added', 'a', sqrtInt(194), W.added), trap('trig_side_not_rooted', 'a', int(144), W.notRoot), trap('geo_half_not_taken', 'a', sqrtInt(69), W.halfLen)], [int(6), int(16), int(13)])
    const bStage = stage('b', 'Area', int(132), CARD.trapezoid, 'Add the bases, multiply by the height, and take half.', 'The area is half the height times the sum of the bases, which gives 132.', [trap('geo_area_not_halved', 'b', int(264), W.notHalved), trap('geo_bases_multiplied', 'b', int(576), W.bases)], [int(6), int(16), int(13)])
    return deliver('specialArea', 'Find the height, then the area', say('', has('isosceles trapezoid', 'bases of 6 cm and 16 cm and a leg of 13 cm'), askBoth('height', 'cm')), figure, [aStage, bStage], [6, 16, 13], { shape: 'isoTrap', ask: 'height' }, rng)
  })
}

export function handSquareR6(): GeoBuilt {
  return search((pose, rng) => {
    const r = 6
    const radius = int(r)
    const apothem = sideOf('45', 'hyp', radius, 'leg')
    const side = qmulN(apothem, 2)
    const area = qmul(side, side)
    const figure = regularFigure(4, r * Math.sqrt(2), pose, '', '?', '6')
    const aStage = stage('a', 'Apothem', apothem, CARD.special, 'The apothem is a leg of the forty-five-forty-five-ninety triangle whose hypotenuse is the radius.', `The apothem is the radius divided by the square root of two, which gives ${qSay(apothem)}.`, [trap('geo_apothem_for_radius', 'a', radius, W.apothem), ...specialTraps('45', 'hyp', radius, 'leg', 'a')], [])
    const peri = qmulN(side, 4)
    const bStage = stage('b', 'Area', area, CARD.regular, 'Take half the apothem times the perimeter.', `The area is half the apothem times the perimeter, which gives ${qSay(area)}.`, [trap('geo_area_not_halved', 'b', qmul(apothem, peri), W.notHalved), trap('geo_perimeter_for_area', 'b', peri, W.peri)], [radius])
    return deliver('regularArea', 'Area of a regular polygon', say('', has('square', 'a radius of 6 cm'), askBoth('apothem', 'cm')), figure, [aStage, bStage], [6], { shape: 'square', ask: 'apothem' }, rng)
  })
}

export function handRectMissing(): GeoBuilt {
  return search((pose, rng) => {
    const figure = pack(
      [
        { id: 'A', p: { x: 0, y: 0 } },
        { id: 'B', p: { x: 8, y: 0 } },
        { id: 'C', p: { x: 8, y: 6 } },
        { id: 'D', p: { x: 0, y: 6 } },
      ],
      [seg('A', 'B', '?'), seg('B', 'C'), seg('C', 'D'), seg('D', 'A', '6')],
      [rightAt('A', 'B', 'D')],
      ['A', 'B', 'C', 'D'],
      pose,
      'A rectangle with its base and its height labeled.',
    )
    const st = stage('a', 'Base', int(8), CARD.rect, 'Divide the area by the side you have.', 'The area is the base times the height, so the missing side is 8.', [trap('geo_half_applied', 'a', int(4), W.halfApplied)], [int(48), int(6)])
    return deliver('polygonArea', 'Areas of polygons', say('', hasArea('rectangle', '48', 'cm', 'a height of 6 cm'), askOne('base', 'cm')), figure, [st], [48, 6], { shape: 'rectangle', ask: 'base' }, rng)
  })
}
