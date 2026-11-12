/**
 * Honors geometry Unit 9, module geoCircleArea (Jurgensen 11-5 and 11-6): the circumference and the area of a circle,
 * arc length, the area of a sector, and the area of a segment of a circle. Every answer is exact, in terms of π.
 *
 * Prompt grammar (the solve test reads this and no generator helper). A prompt is an optional opener with no digit
 * (one of OPENERS below), then the facts, then the ask. N is a whole number, Q a number as the answer box writes it
 * (7, 3√2, 49/4), P a multiple of π as the answer box writes it (18π, (27π)/2, 6π√2), U one of cm, m, in, ft, and
 * U² that unit squared. In the ask, U is written "inches" and U² "square inches" when U is in.
 *
 * ca.circle, one fact sentence:
 *   "Circle O has a radius of Q U." | "Circle O has a diameter of N U." | "The circumference of circle O is P U." |
 *   "The area of circle O is P U²."
 * then "Find the W in U and the W in U." with W one of circumference, area, radius (an area is asked in U²), then
 *   "Write both answers in terms of π." | "Write the area in terms of π." | "Write the circumference in terms of π."
 *
 * ca.sector, one fact sentence "In circle O, F, and F." with F one of
 *   "central angle AOB measures N°" | "the radius is N U" | "the arc length of minor arc AB is P U" |
 *   "the area of sector AOB is P U²"
 * then one ask:
 *   "Find the arc length of minor arc AB in U, in terms of π." |
 *   "Find the arc length of major arc ACB in U, in terms of π." |
 *   "Find the area of sector AOB in U², in terms of π." |
 *   "Find the area of the shaded major sector, bounded by radii OA and OB and major arc ACB, in U², in terms of π." |
 *   "Find the arc length of minor arc AB in U and the area of sector AOB in U², in terms of π." |
 *   "Find x, the measure of central angle AOB, in degrees." | "Find the radius in U."
 *
 * ca.segment: "In circle O, central angle AOB measures N°, and the radius is N U. Chord AB is drawn. The shaded region
 * is a segment of the circle: the region between chord AB and minor arc AB. Find the area of sector AOB, the area of
 * triangle AOB, and the area of the shaded segment, each in U². Write each area in terms of π where π appears."
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryAnswer, GeometryStageId } from '@/content/types'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoPoint, GeoRegionSpec, GeoSegment } from '@/shared/types'
import { formatValue, readGeoAnswer, sameGeoValue, type GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { stageDisplay } from './grade'
import { CIRCLE_RULES, CIRCLE_RULE_IDS } from './unit9CircleRules'
import { modeOf } from './unit8Build'
import { EXACT_HINT9, askSq, askUnit } from './unit9Polygons'
import { exactStage7, finish7, gcdN, int, placeAll, placeLabels7, pointOf, qSay, rad, radPi, setDebug7, sqrtQ, type P2, type Stage7, type TrapDraft7 } from './unit7Build'

const INSTRUCTIONS = 'Give each answer exactly, in terms of π where it has π. The box takes the number only. The figure is there before you answer.'

export const OPENERS = [
  '',
  'A round table top is drawn here. ',
  'The figure shows a circular garden. ',
  'A circular window is drawn here. ',
  'A round rug has this outline. ',
  'A clock face is drawn here. ',
] as const

const UNITS = ['cm', 'm', 'in', 'ft'] as const
type Unit = (typeof UNITS)[number]

/** The line under a box: the same for every part of the same kind, and never a part's own answer. */
export const PI_HINT9 = 'A number times π, like 43π or (43π)/2.'
export const DEG_HINT9 = 'A number of degrees, like 43 or 43°.'
export const SUM_HINT9 = 'Two terms, like 43π - 7 or 43π - 7√11.'

/** Central angles of ca.sector. */
export const SECTOR_ANGLES = [30, 36, 40, 45, 60, 72, 80, 90, 100, 108, 120, 135, 144, 150, 160] as const
export const SEGMENT_ANGLES = [60, 90, 120] as const

const W = {
  areaForCirc: 'That is π times the square of the radius, the space inside the circle. The circumference is the distance around: π times the diameter.',
  circForArea: 'That doubles the radius instead of squaring it, which is the distance around the circle. The area is π times the square of the radius.',
  diamCirc: 'That puts the diameter where the radius belongs, so the circle is counted twice as wide. The circumference is two times π times the radius, or π times the diameter.',
  diamArea: 'That squares the diameter. The area squares the radius, which is half of the diameter.',
  diamAsked: 'That is the diameter, all the way across. The radius is half of it.',
  radiusCirc: 'That is π times the radius. The circumference is π times the diameter, and the diameter is twice the radius.',
  notSquared: 'That multiplies π by the radius without squaring it. The area is π times the square of the radius.',
  piOff: 'That number is missing its π. The answer is a number times π, so keep the π.',
  notRooted: 'That is the square of the radius. Take the square root to get the radius itself.',
  wholeCirc: 'That is the whole circumference. The arc is only the central angle’s fraction of the circle.',
  wholeArea: 'That is the area of the whole circle. The sector is only the central angle’s fraction of it.',
  sectorForArc: 'That is the area of the sector. The arc length is a fraction of the circumference, not of the area.',
  arcForSector: 'That is the arc length. The sector’s area is a fraction of the area of the circle, not of the circumference.',
  measure: 'That is the arc’s measure in degrees. The arc length is a distance, a fraction of the circumference.',
  diamArc: 'That uses the diameter in place of the radius, so the arc comes out twice as long.',
  diamSector: 'That squares the diameter in place of the radius, so the sector comes out four times too big.',
  notSquaredSector: 'That leaves the radius unsquared. The sector is a fraction of π times the square of the radius.',
  majorForMinorArc: 'That is the major arc, the long way around. This question is about the minor arc.',
  minorForMajorArc: 'That is the minor arc, the short way around. This question is about the major arc.',
  majorForMinorSector: 'That is the major sector, the rest of the circle. This question is about the smaller sector.',
  minorForMajorSector: 'That is the smaller sector. This question is about the shaded major sector, the rest of the circle.',
  angleSwappedArc: 'That uses the sector’s area formula. An arc length is a fraction of the circumference.',
  angleSwappedSector: 'That uses the arc length formula. The sector’s area is a fraction of the area of the circle.',
  angleDiamArc: 'That uses the diameter in place of the radius. The circumference is two times π times the radius.',
  angleDiamSector: 'That squares the diameter in place of the radius. The area of the circle squares the radius.',
  angleNotSquared: 'That leaves the radius unsquared in the area of the circle.',
  radiusSwapped: 'That uses the sector’s area formula. An arc length is a fraction of the circumference, two times π times the radius.',
  radiusWhole: 'That treats the arc as the whole circumference. The arc is only the central angle’s fraction of it.',
  notHalved: 'That leaves out the half, so the triangle’s area comes out twice as big.',
  eqShort: 'That uses half the radius as the height, which is the short leg of the thirty-sixty-ninety triangle. The height is the long leg, across from the sixty-degree angle.',
  eqSwapped: 'That divides the radius by the square root of three and doubles it for the height: the two factors are swapped. The height is half the radius times the square root of three.',
  obtuseLong: 'That uses the long leg of the thirty-sixty-ninety triangle as the height. The height from O to the chord is the short leg, half the radius.',
  obtuseWrongWay: 'That doubles the radius for the height, which makes a leg longer than the hypotenuse. The height from O to the chord is half the radius.',
  obtuseSwapped: 'That divides the radius by the square root of three for the height: the factors are swapped. The height from O to the chord is half the radius.',
  segmentWhole: 'That is the area of the whole sector. The segment is the sector with triangle AOB taken away.',
  segmentAdded: 'That adds the triangle to the sector. The segment is what is left when the triangle is taken away.',
  segmentDouble: 'That takes away twice the triangle. The triangle’s area is half the base times the height.',
  segmentCircle: 'That starts from the area of the whole circle. Start from the sector, the central angle’s fraction of the circle.',
} as const

let lastWhy = 'no draw'

function fail(why: string): null {
  lastWhy = why
  return null
}

/** Why the last draw was refused (for tuning and for the hand builders). */
export function lastRefusal(): string {
  return lastWhy
}

function runFinish(o: Parameters<typeof finish7>[0]): GeoBuilt | null {
  if (CAPTURE) {
    CAPTURE(o)
    return null
  }
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
  for (let n = 0; n < 120; n++) {
    const rng = makeRng(mixSeed(seed, salt + n * 97))
    const built = make(rng)
    if (built) return built
  }
  throw new Error(`unit 9 circles seed ${seed} salt ${salt}: ${lastWhy}`)
}

// --- exact quantities, π kept -----------------------------------------------------------------------------------

/** q times num/den, π and radical kept (unit9Polygons' helpers drop π). */
function scale(q: GeoQty, num: number, den = 1): GeoQty {
  return q.pi ? radPi(q.n * num, q.d * den, q.rad) : rad(q.n * num, q.d * den, q.rad)
}

/** The same number without its π. */
function noPi(q: GeoQty): GeoQty {
  return rad(q.n, q.d, q.rad)
}

const piOf = (n: number, d = 1) => radPi(n, d, 1)
const neg = (q: GeoQty): GeoQty => ({ ...q, n: -q.n })
const sq = (u: Unit) => `${u}²`

/** "60°" for a figure or a prompt. */
const deg = (n: number) => `${n}°`

// --- scene ------------------------------------------------------------------------------------------------------

export interface Pose {
  turn: number
  reflect: boolean
}

interface Scene {
  unit: Unit
  opener: string
  pose: Pose
}

function scene(rng: Rng): Scene {
  return { unit: rng.pick(UNITS), opener: rng.pick(OPENERS), pose: { turn: rng.int(0, 359), reflect: rng.chance(0.5) } }
}

// --- figures ----------------------------------------------------------------------------------------------------

interface Rim {
  id: string
  /** Degrees counterclockwise from the first radius, before the figure is turned. */
  at: number
}

interface CircleDraw {
  /** The drawn radius, in the figure's own units: the problem's true radius. */
  r: number
  rims: Rim[]
  segments: GeoSegment[]
  /** The central angle AOB, marked with this label. */
  angleLabel?: string
  /** Which region is shaded, between A and B. */
  shade?: 'minor sector' | 'major sector' | 'minor segment'
  pose: Pose
  aria: string
}

function circleFigure(o: CircleDraw): GeoFigureSpec | null {
  const local: P2[] = [{ x: 0, y: 0 }, ...o.rims.map((rim) => ({ x: o.r * Math.cos((rim.at * Math.PI) / 180), y: o.r * Math.sin((rim.at * Math.PI) / 180) }))]
  const placed = placeAll(local, o.pose.turn, o.pose.reflect)
  const at = new Map<string, P2>([['O', placed[0]!], ...o.rims.map((rim, i) => [rim.id, placed[i + 1]!] as [string, P2])])
  const O = placed[0]!
  // The center's letter goes away from the drawn radii: opposite their average direction.
  const rimPts = o.rims.map((rim) => at.get(rim.id)!)
  let away = rimPts.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 })
  if (Math.hypot(away.x, away.y) < 1e-6 * o.r) away = { x: -rimPts[0]!.y, y: rimPts[0]!.x }
  // Coordinates are kept unrounded (pointOf rounds to six places), so A and B sit on the circle exactly.
  const exact = (id: string, p: P2, from: P2): GeoPoint => ({ ...pointOf(id, p, from), x: p.x, y: p.y })
  const centerPoint = exact('O', O, away)
  const points: GeoPoint[] = [centerPoint, ...o.rims.map((rim) => exact(rim.id, at.get(rim.id)!, O))]
  const angles: GeoAngleMark[] = o.angleLabel ? [{ vertex: 'O', from: 'A', to: 'B', label: o.angleLabel }] : []
  const regions: GeoRegionSpec[] = []
  if (o.shade) {
    const A = at.get('A')!
    const B = at.get('B')!
    // The counterclockwise turn from A to B (as the figure is seen) is the minor one when the cross product is positive.
    const minorFromA = A.x * B.y - A.y * B.x > 0
    const minor = minorFromA ? { from: 'A', to: 'B' } : { from: 'B', to: 'A' }
    const major = { from: minor.to, to: minor.from }
    if (o.shade === 'minor sector') regions.push({ kind: 'sector', center: 'O', ...minor })
    else if (o.shade === 'major sector') regions.push({ kind: 'sector', center: 'O', ...major })
    else regions.push({ kind: 'segment', center: 'O', ...minor })
  }
  const spec: GeoFigureSpec = {
    ariaLabel: o.aria,
    points,
    circles: [{ center: 'O', r: o.r }],
    segments: o.segments,
    ...(angles.length ? { angles } : {}),
    ...(regions.length ? { regions } : {}),
  }
  return placeLabels7(spec, [])
}

// --- parts ------------------------------------------------------------------------------------------------------

type PartKind = 'pi' | 'len' | 'deg' | 'sum'

const HINT: Record<PartKind, string> = { pi: PI_HINT9, len: EXACT_HINT9, deg: DEG_HINT9, sum: SUM_HINT9 }

function trap(id: ErrorPatternId, stage: GeometryStageId, value: GeoQty | readonly GeoQty[], witness: string): TrapDraft7 {
  return { id, stage, value, witness }
}

interface PartDraft {
  id: GeometryStageId
  label: string
  kind: PartKind
  answer: GeoQty | readonly GeoQty[]
  card: string
  nudge: string
  reveal: string
  traps: TrapDraft7[]
  /** Slips whose wrong number IS the copy of a given (the arc's degrees given as its length). */
  copies?: TrapDraft7[]
}

function part(p: PartDraft, givens: readonly GeoQty[]): Stage7 {
  const base = { id: p.id, label: p.label, hint: HINT[p.kind], answer: p.answer, nudge: p.nudge, ruleCard: p.card, reveal: [p.reveal] }
  const main = exactStage7({ ...base, traps: p.traps, givens })
  const copies = p.copies?.length ? exactStage7({ ...base, traps: p.copies, givens: [] }).traps : []
  const traps = [...main.traps]
  for (const t of copies) if (!traps.some((x) => same(x.text, t.text))) traps.push(t)
  return p.kind === 'deg' ? { ...main, traps, unit: 'deg' } : { ...main, traps }
}

function same(a: string, b: string): boolean {
  const ra = readGeoAnswer(a, { sum: true })
  const rb = readGeoAnswer(b, { sum: true })
  return ra.ok && rb.ok && sameGeoValue(ra.value, rb.value)
}

/**
 * Pick the promised slip and run the shared gate. Every part keeps at least one slip. A slip may equal an earlier
 * part's answer (the sector's area given for the segment is that slip), and is kept as a candidate when it equals a
 * later part's answer, but it is never the promised one then, and never when it copies a number the problem gives.
 */
function deliver(
  question: 'circleArea' | 'arcSector' | 'circleSegment',
  title: string,
  prompt: string,
  figure: GeoFigureSpec | null,
  stages: Stage7[],
  givens: readonly GeoQty[],
  lengths: number[],
  params: Record<string, string | number | boolean>,
  rng: Rng,
): GeoBuilt | null {
  if (!figure) return fail('labels')
  if (stages.some((s) => s.traps.length === 0)) return fail('a part has no slip')
  const givenTexts = givens.map((g) => formatValue({ kind: 'qty', q: g }))
  const eligible: { id: ErrorPatternId; stage: GeometryStageId }[] = []
  stages.forEach((s, i) => {
    const later = stages.slice(i + 1).map((x) => x.answerText)
    for (const t of s.traps) {
      if (givenTexts.some((g) => same(g, t.text))) continue
      if (later.some((a) => same(a, t.text))) continue
      eligible.push({ id: t.id, stage: s.id })
    }
  })
  if (eligible.length === 0) return fail('no slip to promise')
  const pick = eligible[rng.int(0, eligible.length - 1)]!
  return runFinish({
    question,
    prompt,
    figure,
    stages,
    lengths: lengths.filter((n) => Number.isInteger(n) && n > 0),
    title,
    instructions: INSTRUCTIONS,
    params,
    cards: CIRCLE_RULES,
    promise: [pick.id],
    promiseStage: pick.stage,
  })
}

/** For a hand-worked problem the gate refuses only because its answer is exactly π (the prompt says "in terms of π"). */
function assemble(question: GeometryAnswer['question'], title: string, prompt: string, figure: GeoFigureSpec, stages: Stage7[], params: Record<string, string | number | boolean>): GeoBuilt {
  const promised = stages[0]!.traps[0]!
  return {
    title,
    instructions: INSTRUCTIONS,
    params: { ...params, trap: promised.id, trapStage: stages[0]!.id },
    answer: {
      type: 'geometry',
      question,
      prompt,
      figure,
      stages,
      lengths: [],
      angles: [],
      expectedDisplay: stages.map((s) => `${s.label}: ${stageDisplay(s)}`).join(' · '),
      reveal: stages.flatMap((s) => s.reveal),
      ruleCards: [...new Set(stages.map((s) => s.ruleCard))],
      trap: promised.id,
      trapStage: stages[0]!.id,
      trapAnswer: promised.text,
    },
  }
}

// --- ca.circle --------------------------------------------------------------------------------------------------

export type CircleVariant = 'radius' | 'diameter' | 'circumference' | 'area'
const CIRCLE_VARIANTS: readonly CircleVariant[] = ['radius', 'diameter', 'circumference', 'area']

/** The radius as n/d times √m. */
export interface RadiusSpec {
  n: number
  d: number
  m: number
}

function pickRadius(rng: Rng, variant: CircleVariant): RadiusSpec {
  if (variant === 'radius' && rng.chance(0.15)) return { n: rng.int(2, 5), d: 1, m: rng.pick([2, 3, 5] as const) }
  if (variant === 'diameter' && rng.chance(0.25)) return { n: rng.pick([5, 7, 9, 11, 13, 15, 17] as const), d: 2, m: 1 }
  return { n: rng.int(3, variant === 'circumference' || variant === 'area' ? 24 : 18), d: 1, m: 1 }
}

function buildCircle(variant: CircleVariant, rs: RadiusSpec, sc: Scene, rng: Rng): GeoBuilt | null {
  const u = sc.unit
  const r = rad(rs.n, rs.d, rs.m)
  const D = scale(r, 2)
  const C = radPi(2 * rs.n, rs.d, rs.m)
  const A = scale(piOf(rs.n * rs.n * rs.m, rs.d * rs.d), 1)
  const rLen = (rs.n / rs.d) * Math.sqrt(rs.m)
  const card = CIRCLE_RULE_IDS
  const circPart = (id: GeometryStageId, reveal: string, givens: GeoQty[]): Stage7 =>
    part(
      {
        id,
        label: 'Circumference',
        kind: 'pi',
        answer: C,
        card: card.circumference,
        nudge: 'The circumference is π times the diameter, or two times π times the radius.',
        reveal,
        traps: [
          trap('geo_area_for_circumference', id, A, W.areaForCirc),
          trap('geo_circle_diameter_as_radius', id, scale(C, 2), W.diamCirc),
          trap('geo_circle_radius_as_diameter', id, scale(C, 1, 2), W.radiusCirc),
          trap('geo_pi_left_off', id, noPi(C), W.piOff),
        ],
      },
      givens,
    )
  const areaPart = (id: GeometryStageId, reveal: string, givens: GeoQty[]): Stage7 =>
    part(
      {
        id,
        label: 'Area',
        kind: 'pi',
        answer: A,
        card: card.area,
        nudge: 'Square the radius, then multiply by π.',
        reveal,
        traps: [
          trap('geo_circumference_for_area', id, C, W.circForArea),
          trap('geo_circle_diameter_as_radius', id, scale(A, 4), W.diamArea),
          trap('geo_circle_radius_not_squared', id, scale(C, 1, 2), W.notSquared),
          trap('geo_pi_left_off', id, noPi(A), W.piOff),
        ],
      },
      givens,
    )
  let facts: string
  let stages: Stage7[]
  let given: GeoQty
  let label: string
  let aria: string
  if (variant === 'radius') {
    given = r
    facts = `Circle O has a radius of ${qSay(r)} ${u}.`
    stages = [
      circPart('a', `The circumference is two times π times the radius: 2 · π · ${qSay(r)} = ${qSay(C)}.`, [r]),
      areaPart('b', `The area is π times the square of the radius: π · (${qSay(r)})² = ${qSay(A)}.`, [r]),
    ]
    label = qSay(r)
    aria = 'Circle O with its center and a radius drawn and labeled.'
  } else if (variant === 'diameter') {
    given = D
    facts = `Circle O has a diameter of ${qSay(D)} ${u}.`
    stages = [
      circPart('a', `The circumference is π times the diameter: π · ${qSay(D)} = ${qSay(C)}.`, [D]),
      areaPart('b', `The radius is half the diameter, ${qSay(r)}, and the area is π times its square: π · (${qSay(r)})² = ${qSay(A)}.`, [D]),
    ]
    label = qSay(D)
    aria = 'Circle O with its center and a diameter drawn and labeled.'
  } else if (variant === 'circumference') {
    given = C
    facts = `The circumference of circle O is ${qSay(C)} ${u}.`
    const radiusPart = part(
      {
        id: 'a',
        label: 'Radius',
        kind: 'len',
        answer: r,
        card: card.radius,
        nudge: 'The circumference is π times the diameter. Divide by π to get the diameter, then take half of it.',
        reveal: `Dividing the circumference by π gives the diameter, ${qSay(D)}, and the radius is half of that: ${qSay(r)}.`,
        traps: [trap('geo_circle_diameter_as_radius', 'a', D, W.diamAsked)],
      },
      [C],
    )
    stages = [radiusPart, areaPart('b', `The area is π times the square of the radius: π · (${qSay(r)})² = ${qSay(A)}.`, [C])]
    label = 'r'
    aria = 'Circle O with its center and a radius r drawn.'
  } else {
    given = A
    facts = `The area of circle O is ${qSay(A)} ${sq(u)}.`
    const radiusPart = part(
      {
        id: 'a',
        label: 'Radius',
        kind: 'len',
        answer: r,
        card: card.radius,
        nudge: 'The area is π times the square of the radius. Divide by π, then take the square root.',
        reveal: `Dividing the area by π gives the square of the radius, ${qSay(noPi(A))}, and its square root is ${qSay(r)}.`,
        traps: [trap('trig_side_not_rooted', 'a', noPi(A), W.notRooted), trap('geo_circle_diameter_as_radius', 'a', D, W.diamAsked)],
      },
      [A],
    )
    stages = [radiusPart, circPart('b', `The circumference is two times π times the radius: 2 · π · ${qSay(r)} = ${qSay(C)}.`, [A])]
    label = 'r'
    aria = 'Circle O with its center and a radius r drawn.'
  }
  const [wa, wb] = stages.map((s) => s.label.toLowerCase()) as [string, string]
  const unitOf = (w: string) => (w === 'area' ? askSq(u) : askUnit(u))
  const piWords = wa !== 'radius' ? 'both answers' : `the ${wb}`
  const prompt = `${sc.opener}${facts} Find the ${wa} in ${unitOf(wa)} and the ${wb} in ${unitOf(wb)}. Write ${piWords} in terms of π.`
  const diameter = variant === 'diameter'
  const figure = circleFigure({
    r: rLen,
    rims: diameter ? [{ id: 'A', at: 0 }, { id: 'B', at: 180 }] : [{ id: 'A', at: 0 }],
    segments: diameter ? [{ from: 'A', to: 'B', label }] : [{ from: 'O', to: 'A', label }],
    pose: sc.pose,
    aria,
  })
  const lengths = given.rad === 1 && given.d === 1 && !given.pi ? [given.n] : []
  return deliver('circleArea', 'Circumference and area of a circle', prompt, figure, stages, [given], lengths, { variant, radical: rs.m > 1, odd: rs.d === 2 }, rng)
}

export function drawCircle(seed: number): GeoBuilt {
  const variant = modeOf(seed, 41, CIRCLE_VARIANTS)
  return generate(seed, 43, (rng) => {
    const rs = pickRadius(rng, variant)
    return buildCircle(variant, rs, scene(rng), rng)
  })
}

// --- ca.sector --------------------------------------------------------------------------------------------------

export type SectorAsk = 'arc' | 'sector' | 'both' | 'angle' | 'radius'
const SECTOR_ASKS: readonly SectorAsk[] = ['arc', 'sector', 'both', 'angle', 'radius']

/** n/d reduced, with d at most `maxD`. */
function simple(n: number, d: number, maxD: number): boolean {
  return d / gcdN(n, d) <= maxD
}

/** A radius whose arc length and sector area are whole numbers or simple fractions times π. */
function pickSectorRadius(rng: Rng, theta: number): number | null {
  for (let k = 0; k < 40; k++) {
    const r = rng.int(3, 24)
    if (!simple(theta * r, 180, 4) || !simple(theta * r * r, 360, 4)) continue
    if ((theta * r * r) / 360 > 250) continue
    return r
  }
  return null
}

export interface SectorSpec {
  ask: SectorAsk
  theta: number
  r: number
  /** The major arc or sector ('arc' and 'sector' asks). */
  major: boolean
  /** For 'angle': the arc length is given, or the sector's area. */
  from: 'arc' | 'sector'
}

function buildSector(s: SectorSpec, sc: Scene, rng: Rng): GeoBuilt | null {
  const { theta, r, ask } = s
  const u = sc.unit
  const major = s.major && (ask === 'arc' || ask === 'sector')
  const card = CIRCLE_RULE_IDS
  const arc = piOf(theta * r, 180)
  const sector = piOf(theta * r * r, 360)
  const majorArc = piOf((360 - theta) * r, 180)
  const majorSector = piOf((360 - theta) * r * r, 360)
  const whole = piOf(2 * r)
  const disk = piOf(r * r)
  const R = int(r)
  const T = int(theta)
  const angleGiven = `central angle AOB measures ${deg(theta)}`
  const radiusGiven = `the radius is ${r} ${u}`
  const arcGiven = `the arc length of minor arc AB is ${qSay(arc)} ${u}`
  const sectorGiven = `the area of sector AOB is ${qSay(sector)} ${sq(u)}`

  const arcPart = (id: GeometryStageId, isMajor: boolean, givens: GeoQty[]): Stage7 => {
    const ans = isMajor ? majorArc : arc
    const fraction = isMajor ? `${360 - theta} out of 360` : `${theta} out of 360`
    const measure = isMajor ? 360 - theta : theta
    const measureTrap = trap('geo_arc_measure_for_length', id, int(measure), W.measure)
    return part(
      {
        id,
        label: 'Arc length',
        kind: 'pi',
        answer: ans,
        card: card.arc,
        nudge: isMajor ? 'The major arc is the rest of the circle: the full turn minus the central angle, out of the full turn, times the circumference.' : 'Take the central angle out of the full turn, times the circumference.',
        reveal: `The arc is ${fraction} of the circumference, which is two times π times ${r}, so the arc length is ${qSay(ans)}.`,
        traps: [
          trap('geo_sector_fraction_left_off', id, whole, W.wholeCirc),
          trap('geo_arc_sector_swapped', id, isMajor ? majorSector : sector, W.sectorForArc),
          trap('geo_major_minor_swapped', id, isMajor ? arc : majorArc, isMajor ? W.minorForMajorArc : W.majorForMinorArc),
          trap('geo_pi_left_off', id, noPi(ans), W.piOff),
          trap('geo_circle_diameter_as_radius', id, scale(ans, 2), W.diamArc),
          ...(isMajor ? [measureTrap] : []),
        ],
        copies: isMajor ? [] : [measureTrap],
      },
      givens,
    )
  }
  const sectorPart = (id: GeometryStageId, isMajor: boolean, givens: GeoQty[]): Stage7 => {
    const ans = isMajor ? majorSector : sector
    const fraction = isMajor ? `${360 - theta} out of 360` : `${theta} out of 360`
    return part(
      {
        id,
        label: 'Sector area',
        kind: 'pi',
        answer: ans,
        card: card.sector,
        nudge: isMajor ? 'The major sector is the rest of the circle: the full turn minus the central angle, out of the full turn, times the area of the circle.' : 'Take the central angle out of the full turn, times the area of the circle.',
        reveal: `The sector is ${fraction} of the circle, whose area is π times the square of ${r}, so the sector’s area is ${qSay(ans)}.`,
        traps: [
          trap('geo_sector_fraction_left_off', id, disk, W.wholeArea),
          trap('geo_arc_sector_swapped', id, isMajor ? majorArc : arc, W.arcForSector),
          trap('geo_major_minor_swapped', id, isMajor ? sector : majorSector, isMajor ? W.minorForMajorSector : W.majorForMinorSector),
          trap('geo_pi_left_off', id, noPi(ans), W.piOff),
          trap('geo_circle_diameter_as_radius', id, scale(ans, 4), W.diamSector),
          trap('geo_circle_radius_not_squared', id, piOf((isMajor ? 360 - theta : theta) * r, 360), W.notSquaredSector),
        ],
      },
      givens,
    )
  }

  let facts: string
  let askText: string
  let stages: Stage7[]
  let givens: GeoQty[]
  let angleLabel = deg(theta)
  let radiusLabel = String(r)
  let aria = 'Circle O with radii OA and OB, the central angle AOB marked, and sector AOB shaded.'
  if (ask === 'arc' || ask === 'sector' || ask === 'both') {
    givens = [T, R]
    facts = `In circle O, ${angleGiven}, and ${radiusGiven}.`
    if (ask === 'arc') {
      stages = [arcPart('a', major, givens)]
      askText = major ? `Find the arc length of major arc ACB in ${askUnit(u)}, in terms of π.` : `Find the arc length of minor arc AB in ${askUnit(u)}, in terms of π.`
    } else if (ask === 'sector') {
      stages = [sectorPart('a', major, givens)]
      askText = major
        ? `Find the area of the shaded major sector, bounded by radii OA and OB and major arc ACB, in ${askSq(u)}, in terms of π.`
        : `Find the area of sector AOB in ${askSq(u)}, in terms of π.`
    } else {
      stages = [arcPart('a', false, givens), sectorPart('b', false, givens)]
      askText = `Find the arc length of minor arc AB in ${askUnit(u)} and the area of sector AOB in ${askSq(u)}, in terms of π.`
    }
    if (major) aria = 'Circle O with radii OA and OB, the central angle AOB marked, point C on the major arc, and the major sector shaded.'
  } else if (ask === 'angle') {
    angleLabel = 'x°'
    const fromArc = s.from === 'arc'
    const known = fromArc ? arc : sector
    givens = [R, known]
    facts = `In circle O, ${radiusGiven}, and ${fromArc ? arcGiven : sectorGiven}.`
    askText = 'Find x, the measure of central angle AOB, in degrees.'
    // A slip's angle, as an exact number of degrees: what that wrong formula solves to.
    const kn = known.n
    const kd = known.d
    const traps = fromArc
      ? [
          // The arc length read as a sector's area: known = x r² / 360.
          trap('geo_arc_sector_swapped', 'a', rad(360 * kn, kd * r * r, 1), W.angleSwappedArc),
          // The diameter in place of the radius: known = x (2r) / 180.
          trap('geo_circle_diameter_as_radius', 'a', rad(theta, 2, 1), W.angleDiamArc),
        ]
      : [
          // The sector's area read as an arc length: known = x r / 180.
          trap('geo_arc_sector_swapped', 'a', rad(180 * kn, kd * r, 1), W.angleSwappedSector),
          // The radius not squared: known = x r / 360.
          trap('geo_circle_radius_not_squared', 'a', rad(360 * kn, kd * r, 1), W.angleNotSquared),
          // The diameter squared: known = x (2r)² / 360.
          trap('geo_circle_diameter_as_radius', 'a', rad(theta, 4, 1), W.angleDiamSector),
        ]
    const whole = fromArc ? `the circumference, ${qSay(piOf(2 * r))}` : `the area of the circle, ${qSay(disk)}`
    stages = [
      part(
        {
          id: 'a',
          label: 'Central angle',
          kind: 'deg',
          answer: T,
          card: card.measure,
          nudge: fromArc ? 'Find what fraction of the circumference the arc is. The central angle is that fraction of the full turn.' : 'Find what fraction of the area of the circle the sector is. The central angle is that fraction of the full turn.',
          reveal: `The ${fromArc ? 'arc' : 'sector'} is ${qSay(known)} out of ${whole}, and that fraction of the full turn of 360 degrees is ${theta} degrees.`,
          traps,
        },
        givens,
      ),
    ]
    aria = 'Circle O with radii OA and OB, the central angle AOB marked with a letter, and sector AOB shaded.'
  } else {
    radiusLabel = 'r'
    givens = [T, arc]
    facts = `In circle O, ${angleGiven}, and ${arcGiven}.`
    askText = `Find the radius in ${askUnit(u)}.`
    stages = [
      part(
        {
          id: 'a',
          label: 'Radius',
          kind: 'len',
          answer: R,
          card: card.arc,
          nudge: 'The arc length is the central angle out of the full turn, times two times π times the radius. Solve that for the radius.',
          reveal: `The arc is ${theta} out of 360 of the circumference, so the circumference is ${qSay(whole)}. That is two times π times the radius, so the radius is ${r}.`,
          traps: [
            trap('geo_circle_diameter_as_radius', 'a', int(2 * r), W.diamAsked),
            trap('geo_arc_sector_swapped', 'a', sqrtQ(2 * r), W.radiusSwapped),
            trap('geo_sector_fraction_left_off', 'a', rad(arc.n, 2 * arc.d, 1), W.radiusWhole),
          ],
        },
        givens,
      ),
    ]
  }
  const rims: Rim[] = [
    { id: 'A', at: 0 },
    { id: 'B', at: theta },
  ]
  if (major) rims.push({ id: 'C', at: theta + (360 - theta) / 2 })
  const figure = circleFigure({
    r,
    rims,
    segments: [
      { from: 'O', to: 'A', label: radiusLabel },
      { from: 'O', to: 'B' },
    ],
    angleLabel,
    shade: major ? 'major sector' : 'minor sector',
    pose: sc.pose,
    aria,
  })
  const prompt = `${sc.opener}${facts} ${askText}`
  return deliver('arcSector', 'Arc length and area of a sector', prompt, figure, stages, givens, [r, theta], { ask, theta, major, from: ask === 'angle' ? s.from : '' }, rng)
}

export function drawSector(seed: number): GeoBuilt {
  const ask = modeOf(seed, 51, SECTOR_ASKS)
  const major = modeOf(seed, 52, ['minor', 'minor', 'minor', 'minor', 'major'] as const) === 'major'
  const from = modeOf(seed, 53, ['arc', 'sector'] as const)
  // The angle stays with the seed through a redraw, so the mix of angles does not drift. 90 is never an answer
  // (it is reserved), so an ask for the angle draws from the others.
  const angles = (ask === 'angle' ? SECTOR_ANGLES.filter((t) => t !== 90) : SECTOR_ANGLES).map(String)
  const theta = Number(modeOf(seed, 54, angles))
  return generate(seed, 55, (rng) => {
    const r = pickSectorRadius(rng, theta)
    if (r === null) return fail('no radius')
    return buildSector({ ask, theta, r, major, from }, scene(rng), rng)
  })
}

// --- ca.segment -------------------------------------------------------------------------------------------------

function buildSegment(theta: 60 | 90 | 120, r: number, sc: Scene, rng: Rng): GeoBuilt | null {
  const u = sc.unit
  const card = CIRCLE_RULE_IDS
  const sector = piOf(theta * r * r, 360)
  const arc = piOf(theta * r, 180)
  const disk = piOf(r * r)
  const T = theta === 90 ? rad(r * r, 2, 1) : rad(r * r, 4, 3)
  const givens = [int(theta), int(r)]
  const sectorPart = part(
    {
      id: 'a',
      label: 'Sector area',
      kind: 'pi',
      answer: sector,
      card: card.sector,
      nudge: 'Take the central angle out of the full turn, times the area of the circle.',
      reveal: `The sector is ${theta} out of 360 of the circle, whose area is ${qSay(disk)}, so the sector’s area is ${qSay(sector)}.`,
      traps: [
        trap('geo_sector_fraction_left_off', 'a', disk, W.wholeArea),
        trap('geo_arc_sector_swapped', 'a', arc, W.arcForSector),
        trap('geo_circle_radius_not_squared', 'a', piOf(theta * r, 360), W.notSquaredSector),
        trap('geo_pi_left_off', 'a', noPi(sector), W.piOff),
      ],
    },
    givens,
  )
  let triTraps: TrapDraft7[]
  let triNudge: string
  let triReveal: string
  if (theta === 90) {
    triTraps = [trap('geo_area_not_halved', 'b', scale(T, 2), W.notHalved)]
    triNudge = 'The two radii are perpendicular, so they are the base and the height of a right triangle.'
    triReveal = `The radii are the legs of a right triangle, so its area is half of ${r} times ${r}, which is ${qSay(T)}.`
  } else if (theta === 60) {
    triTraps = [
      trap('geo_area_not_halved', 'b', scale(T, 2), W.notHalved),
      trap('trig_special_legs_swapped', 'b', rad(r * r, 4, 1), W.eqShort),
      trap('trig_special_root3_two_swapped', 'b', rad(r * r, 3, 3), W.eqSwapped),
    ]
    triNudge = 'The triangle is equilateral. Its height is half a side times the square root of three.'
    triReveal = `Triangle AOB is equilateral with side ${r}, so its height is ${qSay(rad(r, 2, 3))} and its area is half of ${r} times that height, which is ${qSay(T)}.`
  } else {
    triTraps = [
      trap('geo_area_not_halved', 'b', scale(T, 2), W.notHalved),
      trap('trig_special_legs_swapped', 'b', rad(3 * r * r, 4, 1), W.obtuseLong),
      trap('trig_special_wrong_way', 'b', rad(r * r, 1, 3), W.obtuseWrongWay),
      trap('trig_special_root3_two_swapped', 'b', rad(r * r, 2, 1), W.obtuseSwapped),
    ]
    triNudge = 'The height from O to chord AB cuts the triangle into two thirty-sixty-ninety triangles. The height is half the radius, and chord AB is the radius times the square root of three.'
    triReveal = `The height from O to chord AB is half the radius, ${qSay(rad(r, 2, 1))}, and chord AB is ${qSay(rad(r, 1, 3))}, so the area is half the base times the height, which is ${qSay(T)}.`
  }
  const triPart = part({ id: 'b', label: 'Triangle area', kind: 'len', answer: T, card: card.segment, nudge: triNudge, reveal: triReveal, traps: triTraps }, givens)
  const segTerms = [sector, neg(T)]
  const segPart = part(
    {
      id: 'c',
      label: 'Segment area',
      kind: 'sum',
      answer: segTerms,
      card: card.segment,
      nudge: 'The segment is the sector with the triangle taken away. Subtract the triangle’s area from the sector’s area.',
      reveal: `The segment is the sector minus the triangle: ${qSay(sector)} − ${qSay(T)}. The two terms are not alike, so that is the answer as it stands.`,
      traps: [
        trap('geo_segment_triangle_not_subtracted', 'c', sector, W.segmentWhole),
        trap('geo_segment_triangle_added', 'c', [sector, T], W.segmentAdded),
        trap('geo_area_not_halved', 'c', [sector, neg(scale(T, 2))], W.segmentDouble),
        trap('geo_sector_fraction_left_off', 'c', [disk, neg(T)], W.segmentCircle),
      ],
    },
    givens,
  )
  const prompt = `${sc.opener}In circle O, central angle AOB measures ${deg(theta)}, and the radius is ${r} ${u}. Chord AB is drawn. The shaded region is a segment of the circle: the region between chord AB and minor arc AB. Find the area of sector AOB, the area of triangle AOB, and the area of the shaded segment, each in ${askSq(u)}. Write each area in terms of π where π appears.`
  const figure = circleFigure({
    r,
    rims: [
      { id: 'A', at: 0 },
      { id: 'B', at: theta },
    ],
    segments: [
      { from: 'O', to: 'A', label: String(r) },
      { from: 'O', to: 'B' },
      { from: 'A', to: 'B' },
    ],
    angleLabel: deg(theta),
    shade: 'minor segment',
    pose: sc.pose,
    aria: 'Circle O with radii OA and OB, chord AB, the central angle AOB marked, and the segment between chord AB and minor arc AB shaded.',
  })
  return deliver('circleSegment', 'Area of a segment of a circle', prompt, figure, [sectorPart, triPart, segPart], givens, [r, theta], { theta }, rng)
}

export function drawSegment(seed: number): GeoBuilt {
  const theta = Number(modeOf(seed, 61, ['60', '90', '120'] as const)) as (typeof SEGMENT_ANGLES)[number]
  return generate(seed, 63, (rng) => buildSegment(theta, 2 * rng.int(2, 9), scene(rng), rng))
}

// --- hand-worked problems ---------------------------------------------------------------------------------------

/** Try every turn of the figure (cm, no opener). If the gate refuses only because an answer is exactly π, build it ungated. */
function search(draw: (sc: Scene, rng: Rng) => GeoBuilt | null): GeoBuilt {
  for (let turn = 0; turn < 360; turn += 10) {
    for (const reflect of [false, true]) {
      const built = draw({ unit: 'cm', opener: '', pose: { turn, reflect } }, makeRng(1))
      if (built) return built
    }
  }
  throw new Error(`hand figure: ${lastWhy}`)
}

export function handCircle(variant: CircleVariant, rs: RadiusSpec): GeoBuilt {
  return search((sc, rng) => buildCircle(variant, rs, sc, rng))
}

export function handSector(s: SectorSpec): GeoBuilt {
  try {
    return search((sc, rng) => buildSector(s, sc, rng))
  } catch (e) {
    if (!lastWhy.includes('“π” is on screen')) throw e
  }
  // The textbook's 45° arc of radius 4 is exactly π, which "in terms of π" in the prompt already prints. Seeds never
  // ship it; the hand test still checks the arithmetic and the slips, so it is assembled without the shared gate.
  for (let turn = 0; turn < 360; turn += 10) {
    let held: Parameters<typeof finish7>[0] | null = null
    CAPTURE = (o) => {
      held = o
    }
    try {
      buildSector(s, { unit: 'cm', opener: '', pose: { turn, reflect: false } }, makeRng(1))
    } finally {
      CAPTURE = null
    }
    const got = held as Parameters<typeof finish7>[0] | null
    if (got) return assemble(got.question, got.title, got.prompt, got.figure, got.stages, got.params)
  }
  throw new Error(`hand figure: ${lastWhy}`)
}

/** Set only while the ungated hand builder runs: it receives the finished parts, and the gate does not run. */
let CAPTURE: ((o: Parameters<typeof finish7>[0]) => void) | null = null

export function handSegment(theta: 60 | 90 | 120, r: number): GeoBuilt {
  return search((sc, rng) => buildSegment(theta, r, sc, rng))
}
