/**
 * Honors geometry Unit 9, module geoAreaRatios (Jurgensen 11-7 Ratios of Areas, 11-8 Geometric Probability, and the
 * shaded regions of 11-5 and 11-6). Every answer is exact: a ratio, a fraction, a whole number, a simplest radical, a
 * multiple of π, or two unlike terms.
 *
 * Prompt grammar (the solve test reads this and no generator helper). A prompt is an optional opener with no digit
 * (one of the OPENERS lists below, the same four for every template), then the facts, then the ask. N is a whole
 * number, U one of cm, m, in, ft, and U² that unit squared. In an ask, U is written "inches" and U² "square inches"
 * when U is in. T and S are the two small triangles ABD and ADC, in either order.
 *
 * OPENERS: "" | "Use the figure. " | "Study the figure. " | "Look at the figure. "
 *
 * ra.shared: "In triangle ABC, point D is on side BC, and segment AD is drawn. BD is N U and DC is N U." then one of
 *   "Find the ratio of the area of triangle T to the area of triangle S." |
 *   "Find the ratio of the area of triangle T to the area of triangle ABC." |
 *   "The area of triangle T is N U². Find the area of triangle S in U²." |
 *   "The area of triangle ABC is N U². Find the area of triangle T in U²."
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { GeometryStageId } from '@/content/types'
import type { ErrorPatternId, GeoFigureSpec, GeoPoint, GeoRegionSpec, GeoSegment } from '@/shared/types'
import { formatValue, readGeoAnswer, sameGeoValue, type GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { RATIO_HINT6 } from './unit6Build'
import { modeOf } from './unit8Build'
import { PI_HINT9, SUM_HINT9 } from './unit9Circles'
import { EXACT_HINT9, askSq } from './unit9Polygons'
import { RATIO_RULES, RATIO_RULE_IDS } from './unit9RatioRules'
import { exactStage7, finish7, gcdN, int, placeAll, placeLabels7, pointOf, qSay, rad, radPi, setDebug7, smallestAngle, type P2, type Stage7, type TrapDraft7 } from './unit7Build'

const INSTRUCTIONS = 'Give each answer exactly: a ratio, a fraction, or a number, in terms of π where it has π. The box takes the number only. The figure is there before you answer.'

export const OPENERS = ['', 'Use the figure. ', 'Study the figure. ', 'Look at the figure. '] as const

const UNITS = ['cm', 'm', 'in', 'ft'] as const
type Unit = (typeof UNITS)[number]

/** The line under a probability box: the same for every probability part, and never a part's own answer. */
export const PROB_HINT9 = 'A fraction, like 43/97. With π: (43π)/97.'

/**
 * The example values of every format hint this module shows. No part may have one of them as its answer (9/7 is a
 * scale factor two similar figures can have, so those seeds redraw).
 */
export const RESERVED9B = ['9/7', '43', '43/2', '3√11', '43π', '(43π)/2', '43π - 7', '43π - 7√11', '43/97', '(43π)/97'] as const

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

/** At least 120 attempts per seed; each attempt draws from its own stream of the seed. */
function generate(seed: number, salt: number, make: (rng: Rng) => GeoBuilt | null): GeoBuilt {
  for (let n = 0; n < 160; n++) {
    const rng = makeRng(mixSeed(seed, salt + n * 97))
    const built = make(rng)
    if (built) return built
  }
  throw new Error(`unit 9 ratios seed ${seed} salt ${salt}: ${lastWhy}`)
}

// --- exact quantities -------------------------------------------------------------------------------------------

/** n/d in lowest terms. */
const fr = (n: number, d: number): GeoQty => rad(n, d, 1)
const sq = (u: Unit) => `${u}²`

// --- scene ------------------------------------------------------------------------------------------------------

export interface Pose {
  turn: number
  reflect: boolean
}

export interface Scene {
  unit: Unit
  opener: string
  pose: Pose
}

function scene(rng: Rng, turn: readonly [number, number]): Scene {
  return { unit: rng.pick(UNITS), opener: rng.pick(OPENERS), pose: { turn: rng.int(turn[0], turn[1]), reflect: rng.chance(0.5) } }
}

/** Points placed by the pose, keyed by id. */
function posed(local: Record<string, P2>, pose: Pose): Map<string, P2> {
  const ids = Object.keys(local)
  const placed = placeAll(
    ids.map((id) => local[id]!),
    pose.turn,
    pose.reflect,
  )
  return new Map(ids.map((id, i) => [id, placed[i]!]))
}

/** A labeled point whose letter sits away from `from`; coordinates unrounded, so a vertex stays on its circle. */
function exactPoint(id: string, p: P2, from: P2, label: string = id): GeoPoint {
  return { ...pointOf(id, p, from, label), x: p.x, y: p.y }
}

function centroid(pts: readonly P2[]): P2 {
  return { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length }
}

// --- parts ------------------------------------------------------------------------------------------------------

type PartKind = 'ratio' | 'num' | 'pi' | 'sum' | 'prob'

const HINT: Record<PartKind, string> = { ratio: RATIO_HINT6, num: EXACT_HINT9, pi: PI_HINT9, sum: SUM_HINT9, prob: PROB_HINT9 }

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
}

function part(p: PartDraft, givens: readonly GeoQty[]): Stage7 {
  const stage = exactStage7({ id: p.id, label: p.label, hint: HINT[p.kind], answer: p.answer, nudge: p.nudge, ruleCard: p.card, reveal: [p.reveal], traps: p.traps, givens })
  // A ratio reads "4:25", "4 to 25" and "4/25" alike (Unit 6's rule, an unreduced ratio included).
  if (p.kind === 'ratio') return { ...stage, ratio: true }
  // A one-term answer whose slip is a sum (one minus the right probability) reads sums, so that slip can be named.
  if (!stage.sum && stage.traps.some((t) => /\s[-+]\s/.test(t.text))) return { ...stage, sum: true }
  return stage
}

function same(a: string, b: string): boolean {
  const ra = readGeoAnswer(a, { sum: true })
  const rb = readGeoAnswer(b, { sum: true })
  return ra.ok && rb.ok && sameGeoValue(ra.value, rb.value)
}

/**
 * Pick the promised slip and run the shared gate (unit9Circles' rule). Every part keeps at least one slip. A slip may
 * equal an earlier part's answer, and is kept as a candidate when it equals a later part's answer, but it is never the
 * promised one then, and never when it copies a number the problem gives. No answer is a format hint's example.
 */
function deliver(
  question: 'areaRatio' | 'shadedRegion' | 'geoProbability',
  title: string,
  prompt: string,
  figure: GeoFigureSpec | null,
  stages: Stage7[],
  givens: readonly GeoQty[],
  params: Record<string, string | number | boolean>,
  rng: Rng,
): GeoBuilt | null {
  if (!figure) return fail('labels')
  if (stages.some((s) => s.traps.length === 0)) return fail('a part has no slip')
  for (const s of stages) if (RESERVED9B.some((r) => same(r, s.answerText))) return fail(`answer ${s.answerText} is a hint's example`)
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
  const lengths = givens.filter((g) => g.rad === 1 && g.d === 1 && !g.pi && g.n > 0).map((g) => g.n)
  return runFinish({
    question,
    prompt,
    figure,
    stages,
    lengths,
    title,
    instructions: INSTRUCTIONS,
    params,
    cards: RATIO_RULES,
    promise: [pick.id],
    promiseStage: pick.stage,
  })
}

// --- figures ----------------------------------------------------------------------------------------------------

interface FigureDraw {
  /** Local coordinates, in the problem's own units, before the pose. */
  local: Record<string, P2>
  /** Ids drawn without a letter or a dot (the far end of a radius). */
  bare?: readonly string[]
  segments: GeoSegment[]
  circles?: { center: string; r: number }[]
  regions?: GeoRegionSpec[]
  /** Closed outlines whose labeled sides take their label outside. */
  outlines: readonly (readonly string[])[]
  /** Each letter is set away from this point (by id), or from the middle of the outline the point is on. */
  away?: (id: string, at: Map<string, P2>) => P2
  pose: Pose
  aria: string
}

function drawFigure(o: FigureDraw): GeoFigureSpec | null {
  const at = posed(o.local, o.pose)
  const all = [...at.values()]
  const middle = centroid(all)
  const bare = new Set(o.bare ?? [])
  const points: GeoPoint[] = [...at.entries()].map(([id, p]) => {
    const from = o.away ? o.away(id, at) : middle
    return bare.has(id) ? { ...exactPoint(id, p, from), label: '' } : exactPoint(id, p, from)
  })
  const spec: GeoFigureSpec = {
    ariaLabel: o.aria,
    points,
    segments: o.segments,
    ...(o.circles?.length ? { circles: o.circles } : {}),
    ...(o.regions?.length ? { regions: o.regions } : {}),
  }
  const placed = placeLabels7(spec, o.outlines)
  return placed
}

/** The letter of a vertex goes away from the middle of its own outline. */
function awayFromOutline(outlines: readonly (readonly string[])[]): (id: string, at: Map<string, P2>) => P2 {
  return (id, at) => {
    const own = outlines.find((ids) => ids.includes(id)) ?? [...at.keys()]
    return centroid(own.map((k) => at.get(k)!))
  }
}

// =================================================================================================================
// ra.shared — triangles that share a height
// =================================================================================================================

export type SharedAsk = 'parts' | 'whole' | 'fromPart' | 'fromWhole'
const SHARED_ASKS: readonly SharedAsk[] = ['parts', 'whole', 'fromPart', 'fromWhole']

export interface SharedSpec {
  ask: SharedAsk
  bd: number
  dc: number
  /** The small triangle named first. */
  first: 'ABD' | 'ADC'
  /** The multiplier that makes the given area and the answer whole numbers or halves. */
  s: number
  half: boolean
  /** Where A sits, as fractions of BC: across from B, and up. */
  apex: P2
}

function buildShared(spec: SharedSpec, sc: Scene, rng: Rng): GeoBuilt | null {
  const { ask, bd, dc, first } = spec
  if (bd === dc) return fail('equal pieces')
  const u = sc.unit
  const bc = bd + dc
  const F = first
  const S = first === 'ABD' ? 'ADC' : 'ABD'
  const [b1, b2] = first === 'ABD' ? [bd, dc] : [dc, bd]
  const n1 = first === 'ABD' ? 'BD' : 'DC'
  const n2 = first === 'ABD' ? 'DC' : 'BD'
  const card = RATIO_RULE_IDS.sameHeight
  const givens: GeoQty[] = [int(bd), int(dc)]
  const facts = `In triangle ABC, point D is on side BC, and segment AD is drawn. BD is ${bd} ${u} and DC is ${dc} ${u}.`
  const sameHeight = `Triangles ${F} and ${S} have the same height, from A to line BC, so their areas are in the ratio of their bases`
  const W = {
    squared: 'That squares the ratio of the bases. These two triangles share a height but are not similar, so their areas keep the ratio of the bases itself.',
    reversedParts: `That is the ratio of the area of triangle ${S} to the area of triangle ${F}, the other way round. The question puts triangle ${F} first.`,
    reversedWhole: `That is the ratio of the area of triangle ABC to the area of triangle ${F}, the other way round. The question puts triangle ${F} first.`,
    wholeForPart: `That compares triangle ${F} with the whole triangle ABC. The question compares it with the other piece, triangle ${S}.`,
    partForWhole: `That compares triangle ${F} with the other piece, triangle ${S}. The question compares it with the whole triangle ABC, both pieces together.`,
    reversedArea: 'That uses the ratio of the bases upside down. The triangle with the longer base has the larger area.',
    squaredArea: 'That squares the ratio of the bases. Triangles with the same height have areas in the ratio of the bases themselves.',
    wholeArea: 'That is the area of the whole triangle ABC, both pieces together. The question asks for the other piece alone.',
    partOfWhole: `That uses the ratio of triangle ${F} to the other piece. The area given is of the whole triangle ABC, so compare ${n1} with all of BC.`,
  }
  let askText: string
  let stage: Stage7
  if (ask === 'parts') {
    const ans = fr(b1, b2)
    if (ans.d === 1) return fail('a whole-number ratio')
    askText = `Find the ratio of the area of triangle ${F} to the area of triangle ${S}.`
    stage = part(
      {
        id: 'a',
        label: 'Ratio of the areas',
        kind: 'ratio',
        answer: ans,
        card,
        nudge: `Both triangles have the same height from A. What is left to compare is their bases, ${n1} and ${n2}.`,
        reveal: `${sameHeight}: ${b1} to ${b2}, which is ${qSay(ans)}.`,
        traps: [trap('geo_area_ratio_squared', 'a', fr(b1 * b1, b2 * b2), W.squared), trap('geo_area_ratio_reversed', 'a', fr(b2, b1), W.reversedParts), trap('geo_part_to_part_for_whole', 'a', fr(b1, bc), W.wholeForPart)],
      },
      givens,
    )
  } else if (ask === 'whole') {
    const ans = fr(b1, bc)
    askText = `Find the ratio of the area of triangle ${F} to the area of triangle ABC.`
    stage = part(
      {
        id: 'a',
        label: 'Ratio of the areas',
        kind: 'ratio',
        answer: ans,
        card,
        nudge: `Triangle ${F} and triangle ABC have the same height from A. Compare their bases, ${n1} and the whole of BC.`,
        reveal: `Triangle ${F} and triangle ABC have the same height, from A to line BC, so their areas are in the ratio of their bases: ${b1} to ${bc}, which is ${qSay(ans)}.`,
        traps: [trap('geo_part_to_part_for_whole', 'a', fr(b1, b2), W.partForWhole), trap('geo_area_ratio_squared', 'a', fr(b1 * b1, bc * bc), W.squared), trap('geo_area_ratio_reversed', 'a', fr(bc, b1), W.reversedWhole)],
      },
      givens,
    )
  } else if (ask === 'fromPart') {
    const g = gcdN(b1, b2)
    const x = spec.half ? (spec.s * (b1 / g)) / 2 : spec.s * (b1 / g)
    if (!Number.isInteger(x) || x > 240) return fail('given area')
    const ans = fr(x * b2, b1)
    givens.push(int(x))
    askText = `The area of triangle ${F} is ${x} ${sq(u)}. Find the area of triangle ${S} in ${askSq(u)}.`
    stage = part(
      {
        id: 'a',
        label: `Area of triangle ${S}`,
        kind: 'num',
        answer: ans,
        card,
        nudge: `The two triangles have the same height from A, so their areas are in the ratio of ${n1} to ${n2}. Set up that proportion with the area you know.`,
        reveal: `${sameHeight}. So the area of triangle ${S} is ${x} times ${b2} out of ${b1}, which is ${qSay(ans)}.`,
        traps: [trap('geo_area_ratio_reversed', 'a', fr(x * b1, b2), W.reversedArea), trap('geo_area_ratio_squared', 'a', fr(x * b2 * b2, b1 * b1), W.squaredArea), trap('geo_part_to_part_for_whole', 'a', fr(x * bc, b1), W.wholeArea)],
      },
      givens,
    )
  } else {
    const g = gcdN(b1, bc)
    const w = spec.half ? (spec.s * (bc / g)) / 2 : spec.s * (bc / g)
    if (!Number.isInteger(w) || w > 240) return fail('given area')
    const ans = fr(w * b1, bc)
    givens.push(int(w))
    askText = `The area of triangle ABC is ${w} ${sq(u)}. Find the area of triangle ${F} in ${askSq(u)}.`
    stage = part(
      {
        id: 'a',
        label: `Area of triangle ${F}`,
        kind: 'num',
        answer: ans,
        card,
        nudge: `Triangle ${F} and triangle ABC have the same height from A, so their areas are in the ratio of ${n1} to all of BC.`,
        reveal: `Triangle ${F} and triangle ABC have the same height, so the area of triangle ${F} is ${b1} out of ${bc} of ${w}, which is ${qSay(ans)}.`,
        traps: [trap('geo_part_to_part_for_whole', 'a', fr(w * b1, b2), W.partOfWhole), trap('geo_area_ratio_squared', 'a', fr(w * b1 * b1, bc * bc), W.squaredArea)],
      },
      givens,
    )
  }
  // The figure: BC drawn to the stated lengths, D at BD from B, A where the seed puts it. No height is drawn.
  const A = { x: spec.apex.x * bc, y: spec.apex.y * bc }
  const B = { x: 0, y: 0 }
  const C = { x: bc, y: 0 }
  const D = { x: bd, y: 0 }
  if (smallestAngle(A, B, C) < 24 || smallestAngle(A, B, D) < 14 || smallestAngle(A, D, C) < 14) return fail('a thin triangle')
  const figure = drawFigure({
    local: { A, B, C, D },
    segments: [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D', label: String(bd) },
      { from: 'D', to: 'C', label: String(dc) },
      { from: 'A', to: 'D' },
    ],
    outlines: [['A', 'B', 'C']],
    pose: sc.pose,
    aria: 'Triangle ABC with point D on side BC and segment AD drawn. BD and DC are labeled.',
  })
  const prompt = `${sc.opener}${facts} ${askText}`
  return deliver('areaRatio', 'Triangles that share a height', prompt, figure, [stage], givens, { ask, first, half: spec.half }, rng)
}

function pickShared(rng: Rng, ask: SharedAsk, first: 'ABD' | 'ADC'): SharedSpec {
  const bd = rng.int(2, 12)
  const dc = rng.int(2, 12)
  return { ask, bd, dc, first, s: rng.int(2, 12), half: rng.chance(0.3), apex: { x: -0.15 + rng.next() * 1.3, y: 0.45 + rng.next() * 0.5 } }
}

export function drawShared(seed: number): GeoBuilt {
  const ask = modeOf(seed, 71, SHARED_ASKS)
  const first = modeOf(seed, 72, ['ABD', 'ADC'] as const)
  return generate(seed, 73, (rng) => buildShared(pickShared(rng, ask, first), scene(rng, [-40, 40]), rng))
}

// =================================================================================================================
// ra.similar — areas of similar figures
// =================================================================================================================

export type SimilarVariant = 'pair' | 'areas' | 'other' | 'parallel'
const SIMILAR_VARIANTS: readonly SimilarVariant[] = ['pair', 'areas', 'other', 'parallel']

export interface SimilarSpec {
  variant: SimilarVariant
  /** Triangles or quadrilaterals ('parallel' is always one triangle). */
  n: 3 | 4
  /** The scale factor of the first figure to the second, a to b in lowest terms. */
  a: number
  b: number
  /** The labeled corresponding sides are a·k and b·k. */
  k: number
  /** 'areas': the areas are a²·m and b²·m. 'other': the known area is (its side's factor)²·m. */
  m: number
  /** 'other': the area of the first figure is given (else the second's). */
  knownFirst: boolean
  /** 'parallel': AD and DB. */
  ad: number
  db: number
}

const rotate = (pts: readonly P2[], deg: number): P2[] => {
  const t = (deg * Math.PI) / 180
  return pts.map((p) => ({ x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t) }))
}
const scaled = (pts: readonly P2[], f: number): P2[] => pts.map((p) => ({ x: p.x * f, y: p.y * f }))
const shifted = (pts: readonly P2[], dx: number, dy: number): P2[] => pts.map((p) => ({ x: p.x + dx, y: p.y + dy }))

function box(pts: readonly P2[]) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

function angleAt(v: P2, p: P2, q: P2): number {
  const ux = p.x - v.x
  const uy = p.y - v.y
  const wx = q.x - v.x
  const wy = q.y - v.y
  return (Math.acos(Math.max(-1, Math.min(1, (ux * wx + uy * wy) / (Math.hypot(ux, uy) * Math.hypot(wx, wy))))) * 180) / Math.PI
}

/** A readable scalene triangle or convex quadrilateral, counterclockwise, with side `j` of length one. */
function baseShape(rng: Rng, n: 3 | 4, j: number): P2[] | null {
  let pts: P2[]
  if (n === 3) {
    const a0 = rng.int(38, 85)
    const a1 = rng.int(38, 85)
    const a2 = 180 - a0 - a1
    if (a2 < 35 || Math.abs(a0 - a1) < 6 || Math.abs(a1 - a2) < 6 || Math.abs(a0 - a2) < 6) return null
    const L = Math.sin((a1 * Math.PI) / 180) / Math.sin((a2 * Math.PI) / 180)
    pts = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: L * Math.cos((a0 * Math.PI) / 180), y: L * Math.sin((a0 * Math.PI) / 180) },
    ]
  } else {
    pts = [0, 1, 2, 3].map((i) => {
      const t = ((45 + 90 * i + rng.int(-22, 22)) * Math.PI) / 180
      const r = 0.75 + rng.next() * 0.5
      return { x: r * Math.cos(t), y: r * Math.sin(t) }
    })
    for (let i = 0; i < 4; i++) {
      const ang = angleAt(pts[i]!, pts[(i + 1) % 4]!, pts[(i + 3) % 4]!)
      if (ang < 55 || ang > 130) return null
    }
  }
  const len = Math.hypot(pts[(j + 1) % n]!.x - pts[j]!.x, pts[(j + 1) % n]!.y - pts[j]!.y)
  return scaled(pts, 1 / len)
}

const sideName = (ids: readonly string[], i: number) => `${ids[i]!}${ids[(i + 1) % ids.length]!}`

function polygonSegments(ids: readonly string[], labeled: number | null, label: string): GeoSegment[] {
  return ids.map((id, i) => (i === labeled ? { from: id, to: ids[(i + 1) % ids.length]!, label } : { from: id, to: ids[(i + 1) % ids.length]! }))
}

/** Two similar figures side by side, the second the first scaled by b/a and turned a little. */
function drawPair(spec: SimilarSpec, j: number, labeled: boolean, sc: Scene, rng: Rng, aria: string): GeoFigureSpec | null {
  const { n, a, b, k } = spec
  const shape = baseShape(rng, n, j)
  if (!shape) return null
  const ids1 = n === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']
  const ids2 = n === 3 ? ['D', 'E', 'F'] : ['E', 'F', 'G', 'H']
  const t1 = rng.int(-15, 15)
  const p1 = rotate(scaled(shape, a * k), t1)
  let p2 = rotate(scaled(shape, b * k), t1 + rng.int(-35, 35))
  const b1 = box(p1)
  const b2 = box(p2)
  const gap = 0.3 * Math.max(b1.maxX - b1.minX, b2.maxX - b2.minX)
  const firstLeft = rng.chance(0.5)
  const dy = (b1.minY + b1.maxY) / 2 - (b2.minY + b2.maxY) / 2
  p2 = firstLeft ? shifted(p2, b1.maxX + gap - b2.minX, dy) : shifted(p2, b1.minX - gap - b2.maxX, dy)
  const local: Record<string, P2> = {}
  ids1.forEach((id, i) => (local[id] = p1[i]!))
  ids2.forEach((id, i) => (local[id] = p2[i]!))
  const outlines = [ids1, ids2]
  return drawFigure({
    local,
    segments: [...polygonSegments(ids1, labeled ? j : null, String(a * k)), ...polygonSegments(ids2, labeled ? j : null, String(b * k))],
    outlines,
    away: awayFromOutline(outlines),
    pose: sc.pose,
    aria,
  })
}

function buildSimilar(spec: SimilarSpec, sc: Scene, rng: Rng): GeoBuilt | null {
  const { variant, a, b, k, m } = spec
  const u = sc.unit
  if (variant === 'parallel') return buildParallel(spec, sc, rng)
  if (a === b || gcdN(a, b) !== 1) return fail('not a scale factor in lowest terms')
  const n = spec.n
  const shape = n === 3 ? 'triangle' : 'quadrilateral'
  const Shape = n === 3 ? 'Triangle' : 'Quadrilateral'
  const ids1 = n === 3 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D']
  const ids2 = n === 3 ? ['D', 'E', 'F'] : ['E', 'F', 'G', 'H']
  const F = ids1.join('')
  const S = ids2.join('')
  const j = rng.int(0, n - 1)
  const X1 = sideName(ids1, j)
  const X2 = sideName(ids2, j)
  const card = RATIO_RULE_IDS.similar
  const similar = `${Shape} ${F} is similar to ${shape} ${S}.`
  const sides = `Sides ${X1} and ${X2} correspond. ${X1} is ${a * k} ${u} and ${X2} is ${b * k} ${u}.`
  let prompt: string
  let stages: Stage7[]
  let givens: GeoQty[]
  let labeled = true
  let aria = `Two similar ${shape}s, ${shape} ${F} and ${shape} ${S}, side by side. Sides ${X1} and ${X2} are labeled.`
  const scaleWork = `The scale factor of ${shape} ${F} to ${shape} ${S} is ${X1} to ${X2}, ${a * k} to ${b * k}, which is ${qSay(fr(a, b))}`
  if (variant === 'pair') {
    givens = [int(a * k), int(b * k)]
    prompt = `${sc.opener}${similar} ${sides} Find the ratio of the perimeter of ${shape} ${F} to the perimeter of ${shape} ${S}, and the ratio of the area of ${shape} ${F} to the area of ${shape} ${S}.`
    stages = [
      part(
        {
          id: 'a',
          label: 'Ratio of the perimeters',
          kind: 'ratio',
          answer: fr(a, b),
          card,
          nudge: `Find the scale factor of ${shape} ${F} to ${shape} ${S} from the two labeled sides. Perimeters of similar figures keep that ratio.`,
          reveal: `${scaleWork}. The perimeters of similar figures are in the ratio of the scale factor itself: ${qSay(fr(a, b))}.`,
          traps: [
            trap('geo_perimeter_ratio_squared', 'a', fr(a * a, b * b), 'That squares the scale factor, which is what the areas do. The perimeters are lengths, so they keep the scale factor itself.'),
            trap('geo_area_ratio_reversed', 'a', fr(b, a), `That is the ratio of the perimeter of ${shape} ${S} to the perimeter of ${shape} ${F}, the other way round. The question puts ${shape} ${F} first.`),
          ],
        },
        givens,
      ),
      part(
        {
          id: 'b',
          label: 'Ratio of the areas',
          kind: 'ratio',
          answer: fr(a * a, b * b),
          card,
          nudge: `The areas of similar figures are in the ratio of the squares of the scale factor.`,
          reveal: `The scale factor is ${a} to ${b}, so the ratio of the areas is ${a}² to ${b}², which is ${qSay(fr(a * a, b * b))}.`,
          traps: [
            trap('geo_area_ratio_not_squared', 'b', fr(a, b), 'That is the scale factor itself, the ratio of the sides and the perimeters. An area grows by the scale factor twice, so square it.'),
            trap('geo_area_ratio_reversed', 'b', fr(b * b, a * a), `That is the ratio of the area of ${shape} ${S} to the area of ${shape} ${F}, the other way round. The question puts ${shape} ${F} first.`),
          ],
        },
        givens,
      ),
    ]
  } else if (variant === 'areas') {
    labeled = false
    const A1 = a * a * m
    const A2 = b * b * m
    givens = [int(A1), int(A2)]
    aria = `Two similar ${shape}s, ${shape} ${F} and ${shape} ${S}, side by side, with no lengths labeled.`
    prompt = `${sc.opener}${similar} The area of ${shape} ${F} is ${A1} ${sq(u)} and the area of ${shape} ${S} is ${A2} ${sq(u)}. Find the scale factor of ${shape} ${F} to ${shape} ${S}.`
    stages = [
      part(
        {
          id: 'a',
          label: 'Scale factor',
          kind: 'ratio',
          answer: fr(a, b),
          card,
          nudge: 'Write the ratio of the areas in lowest terms first. The areas of similar figures are in the ratio of the squares of the scale factor, so undo the square.',
          reveal: `The ratio of the areas is ${A1} to ${A2}${m === 1 ? '' : `, which is ${a * a} to ${b * b}`}. Its square roots give the scale factor, ${a} to ${b}, which is ${qSay(fr(a, b))}.`,
          traps: [
            trap('geo_scale_from_areas_not_rooted', 'a', fr(a * a, b * b), 'That is the ratio of the areas. The areas grow with the square of the scale factor, so take the square root of each part of that ratio.'),
            trap('geo_scale_factor_inverted', 'a', fr(b, a), `That is the scale factor of ${shape} ${S} to ${shape} ${F}. The scale factor of ${shape} ${F} to ${shape} ${S} puts ${shape} ${F} on top.`),
          ],
        },
        givens,
      ),
    ]
  } else {
    const [known, other] = spec.knownFirst ? [a, b] : [b, a]
    const [K, O] = spec.knownFirst ? [F, S] : [S, F]
    const area = known * known * m
    if (area > 300 || other * other * m > 400) return fail('areas too large')
    const ans = int(other * other * m)
    givens = [int(a * k), int(b * k), int(area)]
    prompt = `${sc.opener}${similar} ${sides} The area of ${shape} ${K} is ${area} ${sq(u)}. Find the area of ${shape} ${O} in ${askSq(u)}.`
    stages = [
      part(
        {
          id: 'a',
          label: `Area of ${shape} ${O}`,
          kind: 'num',
          answer: ans,
          card,
          nudge: `Find the scale factor from the labeled sides. The areas are in the ratio of its square.`,
          reveal: `The scale factor of ${shape} ${K} to ${shape} ${O} is ${known} to ${other}, so their areas are in the ratio ${known}² to ${other}². The area of ${shape} ${O} is ${area} times ${other * other} out of ${known * known}, which is ${qSay(ans)}.`,
          traps: [
            trap('geo_area_ratio_not_squared', 'a', fr(area * other, known), 'That scales the area by the scale factor itself. An area grows by the scale factor twice, once across and once up, so use its square.'),
            trap('geo_area_ratio_reversed', 'a', fr(area * known * known, other * other), 'That uses the ratio of the areas upside down. The larger figure has the larger area.'),
          ],
        },
        givens,
      ),
    ]
  }
  const figure = drawPair(spec, j, labeled, sc, rng, aria)
  return deliver('areaRatio', 'Areas of similar figures', prompt, figure, stages, givens, { variant, n }, rng)
}

function buildParallel(spec: SimilarSpec, sc: Scene, rng: Rng): GeoBuilt | null {
  const u = sc.unit
  const m = spec.ad
  const n = spec.db
  const ab = m + n
  const card = RATIO_RULE_IDS.similar
  const givens = [int(m), int(n)]
  const small = m * m
  const big = ab * ab
  const trapezoid = big - small
  const prompt = `${sc.opener}In triangle ABC, point D is on side AB and point E is on side AC, and segment DE is parallel to side BC. AD is ${m} ${u} and DB is ${n} ${u}. Find the ratio of the area of triangle ADE to the area of triangle ABC, and the ratio of the area of triangle ADE to the area of trapezoid DBCE.`
  const partA = part(
    {
      id: 'a',
      label: 'Ratio ADE to ABC',
      kind: 'ratio',
      answer: fr(small, big),
      card,
      nudge: 'DE is parallel to BC, so triangle ADE is similar to triangle ABC. Their scale factor compares AD with the whole side AB.',
      reveal: `Triangle ADE is similar to triangle ABC, because DE is parallel to BC. The scale factor is AD to AB, ${m} to ${ab}, so the ratio of the areas is ${m}² to ${ab}², which is ${qSay(fr(small, big))}.`,
      traps: [
        trap('geo_part_over_whole', 'a', fr(small, n * n), 'That uses AD to DB as the scale factor. The two similar triangles are ADE and ABC, so the corresponding sides are AD and the whole of AB.'),
        trap('geo_area_ratio_not_squared', 'a', fr(m, ab), 'That is the scale factor of the two triangles, the ratio of their sides. The areas are in the ratio of its square.'),
        trap('geo_part_to_part_for_whole', 'a', fr(small, trapezoid), 'That compares triangle ADE with the trapezoid, the rest of the triangle. The question compares it with the whole triangle ABC.'),
        trap('geo_area_ratio_reversed', 'a', fr(big, small), 'That is the ratio of the area of triangle ABC to the area of triangle ADE, the other way round. The question puts triangle ADE first.'),
      ],
    },
    givens,
  )
  const partB = part(
    {
      id: 'b',
      label: 'Ratio ADE to DBCE',
      kind: 'ratio',
      answer: fr(small, trapezoid),
      card: RATIO_RULE_IDS.partWhole,
      nudge: 'The trapezoid is what is left of triangle ABC when triangle ADE is taken away. Use the ratio of the two triangles to find how much is left.',
      reveal: `If triangle ADE has ${small} equal parts of area, triangle ABC has ${big}, so the trapezoid has ${big} − ${small} = ${trapezoid} of them. The ratio is ${small} to ${trapezoid}, which is ${qSay(fr(small, trapezoid))}.`,
      traps: [
        trap('geo_part_to_part_for_whole', 'b', fr(small, big), 'That compares triangle ADE with the whole triangle ABC. The trapezoid is only the part of ABC outside triangle ADE.'),
        trap('geo_area_ratio_not_squared', 'b', fr(m, n), 'That compares the lengths AD and DB. Areas of similar figures go by the square of the scale factor, and the trapezoid is not similar to anything here.'),
        ...(n > m ? [trap('geo_part_over_whole', 'b', fr(small, n * n - small), 'That uses AD to DB as the scale factor of the two triangles. The scale factor of triangle ADE to triangle ABC is AD to the whole of AB.')] : []),
        trap('geo_area_ratio_reversed', 'b', fr(trapezoid, small), 'That is the ratio of the area of the trapezoid to the area of triangle ADE, the other way round. The question puts triangle ADE first.'),
      ],
    },
    givens,
  )
  // The figure: AB drawn at AD + DB, D and E cutting AB and AC in the same ratio, so DE is parallel to BC.
  const beta = rng.int(48, 80)
  const c = ab * (0.8 + rng.next() * 0.6)
  const A = { x: ab * Math.cos((beta * Math.PI) / 180), y: ab * Math.sin((beta * Math.PI) / 180) }
  const B = { x: 0, y: 0 }
  const C = { x: c, y: 0 }
  if (smallestAngle(A, B, C) < 32) return fail('a thin triangle')
  const t = m / ab
  const D = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t }
  const E = { x: A.x + (C.x - A.x) * t, y: A.y + (C.y - A.y) * t }
  const figure = drawFigure({
    local: { A, B, C, D, E },
    segments: [
      { from: 'A', to: 'D', label: String(m) },
      { from: 'D', to: 'B', label: String(n) },
      { from: 'A', to: 'E' },
      { from: 'E', to: 'C' },
      { from: 'B', to: 'C' },
      { from: 'D', to: 'E' },
    ],
    outlines: [['A', 'B', 'C']],
    pose: sc.pose,
    aria: 'Triangle ABC with point D on side AB, point E on side AC, and segment DE drawn across the triangle. AD and DB are labeled.',
  })
  return deliver('areaRatio', 'Areas of similar figures', prompt, figure, [partA, partB], givens, { variant: 'parallel', n: 3 }, rng)
}

function pickSimilar(rng: Rng, variant: SimilarVariant): SimilarSpec | null {
  const a = rng.int(2, 9)
  const b = rng.int(2, 9)
  if (a === b || gcdN(a, b) !== 1 || Math.max(a, b) > 3 * Math.min(a, b)) return null
  let ad = rng.int(1, 8)
  const db = rng.int(1, 8)
  // AD equal to DB (one quarter and one third every time) stays a small share.
  if (ad === db && !rng.chance(0.3)) ad = ((ad + rng.int(0, 6)) % 8) + 1
  return { variant, n: rng.chance(0.5) ? 3 : 4, a, b, k: rng.int(1, 3), m: rng.int(1, 3), knownFirst: rng.chance(0.5), ad, db }
}

export function drawSimilar(seed: number): GeoBuilt {
  const variant = modeOf(seed, 81, SIMILAR_VARIANTS)
  return generate(seed, 83, (rng) => {
    const spec = pickSimilar(rng, variant)
    if (!spec) return fail('no scale factor')
    if (variant === 'other') spec.m = rng.int(1, 6)
    if (spec.a * spec.k > 30 || spec.b * spec.k > 30) return fail('sides too long')
    return buildSimilar(spec, scene(rng, variant === 'parallel' ? [-25, 25] : [-10, 10]), rng)
  })
}

// =================================================================================================================
// ra.shaded — areas of shaded regions
// =================================================================================================================

export type ShadedShape = 'squareCircle' | 'circleSquare' | 'ring' | 'pond' | 'circleHexagon' | 'circleTriangle'
const SHADED_SHAPES: readonly ShadedShape[] = ['squareCircle', 'circleSquare', 'ring', 'pond', 'circleHexagon', 'circleTriangle']

export interface ShadedSpec {
  shape: ShadedShape
  /** Three parts (outer, inner, shaded) or the shaded area alone. */
  three: boolean
  /** The side of the square (squareCircle), else the radius of the circle (the smaller one for a ring). */
  s: number
  /** ring: the larger radius. */
  big: number
  /** pond: the rectangle, and the circle's center inside it. */
  l: number
  w: number
  cx: number
  cy: number
  /** The direction the drawn radius points, in degrees before the pose (ring: the smaller circle's radius). */
  dir: number
}

const piOf = (n: number, d = 1) => radPi(n, d, 1)
const neg = (q: GeoQty): GeoQty => ({ ...q, n: -q.n })

const WS = {
  circForArea: 'That doubles the radius instead of squaring it, which is the circumference. The area is π times the square of the radius.',
  diamArea: 'That squares the diameter. The area of a circle squares the radius, half of the diameter.',
  sideAsRadius: 'That uses the side of the square as the radius. The circle touches all four sides, so the side is its diameter, and the radius is half of it.',
  notSquared: 'That multiplies π by the radius without squaring it. The area is π times the square of the radius.',
  piOff: 'That number is missing its π. The area of a circle is a number times π.',
  perimeter: 'That adds the sides, which is the distance around the figure. The area is the space inside it.',
  halfRect: 'That takes half of the product. A square or a rectangle has area length times width, with no half.',
  sideFromRadius: 'That uses the radius as the side of the square. The radius reaches a corner, so the diagonal of the square is a diameter.',
  squareNotHalved: 'That squares the diagonal without taking half. A square’s area is half the product of its diagonals, which are both diameters.',
  squareWrongWay: 'That multiplies the diagonal by the square root of two to get the side. Going down from the diagonal to a side, divide by the square root of two.',
  hexApothem: 'That uses the radius as the apothem. The apothem goes to the middle of a side, and it is shorter than the radius.',
  hexNotHalved: 'That leaves out the half: the area of a regular polygon is half the apothem times the perimeter.',
  hexShortLeg: 'That uses half the radius as the apothem, which is the short leg of the thirty-sixty-ninety triangle. The apothem is the long leg.',
  hexSwapped: 'That divides the radius by the square root of three and doubles it for the apothem: the two factors are swapped. The apothem is half the radius times the square root of three.',
  triSide: 'That uses the radius as the side of the triangle. The radius reaches a vertex from the center, and the side is the radius times the square root of three.',
  triNotHalved: 'That leaves out the half: the area of a triangle is half the base times the height.',
  triShortLeg: 'That uses half a side as the height. The height of an equilateral triangle is half a side times the square root of three.',
  notSubtracted: 'That is the area of the whole outer figure. The shaded region is what is left when the inside figure is taken out.',
  added: 'That adds the two areas. The inside figure is cut out of the outer one, so subtract its area.',
  ringNotSquared: 'That leaves the radii unsquared. Each circle’s area is π times the square of its own radius.',
  ringPiOff: 'That number is missing its π. The ring’s area is a number times π.',
  ringDiameter: 'That uses each radius as a diameter would be used: four times too big. Square the radii themselves.',
  shadedNotSquared: 'That takes away π times the radius, unsquared. The circle’s area is π times the square of the radius.',
  shadedCirc: 'That takes away the circumference. The circle’s area is π times the square of the radius.',
  shadedDiam: 'That takes away a circle twice as wide. Square the radius, not the diameter.',
  shadedSide: 'That takes away a figure whose side is the radius. The side of the inscribed figure comes from the radius, but it is not the radius.',
  shadedHexApothem: 'That takes away a hexagon whose apothem is the radius. The apothem is shorter than the radius.',
  shadedShortLeg: 'That takes away a figure whose height came from the wrong leg of the thirty-sixty-ninety triangle.',
  shadedNotHalved: 'That takes away the inscribed figure’s area without its half.',
} as const

function circleTraps(id: GeometryStageId, rho: number, inSquare: boolean): TrapDraft7[] {
  return [
    trap('geo_circumference_for_area', id, piOf(2 * rho), WS.circForArea),
    trap('geo_circle_diameter_as_radius', id, piOf(4 * rho * rho), inSquare ? WS.sideAsRadius : WS.diamArea),
    trap('geo_circle_radius_not_squared', id, piOf(rho), WS.notSquared),
    trap('geo_pi_left_off', id, int(rho * rho), WS.piOff),
  ]
}

interface ShadedPlan {
  facts: string
  region: string
  outerName: string
  innerName: string
  outer: (id: GeometryStageId) => PartDraft
  inner: (id: GeometryStageId) => PartDraft
  shaded: (id: GeometryStageId) => PartDraft
  givens: GeoQty[]
  draw: Omit<FigureDraw, 'pose'>
}

function shadedPlan(spec: ShadedSpec, u: Unit): ShadedPlan | null {
  const card = RATIO_RULE_IDS
  const shadedPart = (outer: GeoQty, inner: GeoQty, extra: TrapDraft7[], outerWords: string, innerWords: string) => (id: GeometryStageId): PartDraft => {
    const answer = [outer, neg(inner)]
    return {
      id,
      label: 'Shaded area',
      kind: 'sum',
      answer,
      card: card.shaded,
      nudge: `The shaded region is ${outerWords} with ${innerWords} cut out. Subtract the inside area from the outer area.`,
      reveal: `The shaded area is the area of ${outerWords} minus the area of ${innerWords}: ${qSay(outer)} − ${qSay(inner)}. The two terms are not alike, so that is the answer as it stands.`,
      traps: [trap('geo_region_not_subtracted', id, outer, WS.notSubtracted), trap('geo_region_added', id, [outer, inner], WS.added), ...extra.map((t) => ({ ...t, stage: id }))],
    }
  }
  const circlePart = (rho: number, inSquare: boolean, label: string, reveal: string) => (id: GeometryStageId): PartDraft => ({
    id,
    label,
    kind: 'pi',
    answer: piOf(rho * rho),
    card: card.circle,
    nudge: inSquare ? 'The circle touches all four sides of the square, so its diameter is a side. Find the radius, square it, then multiply by π.' : 'Square the radius, then multiply by π.',
    reveal,
    traps: circleTraps(id, rho, inSquare),
  })
  const { shape } = spec
  if (shape === 'squareCircle') {
    const s = spec.s
    if (s % 2 !== 0) return fail('odd side')
    const h = s / 2
    const sqArea = int(s * s)
    const circ = piOf(h * h)
    return {
      facts: `A circle with center O is inscribed in square ABCD. Each side of the square is ${s} ${u}.`,
      region: 'the part of the square outside the circle',
      outerName: 'square ABCD',
      innerName: 'circle O',
      outer: (id) => ({
        id,
        label: 'Area of the square',
        kind: 'num',
        answer: sqArea,
        card: card.rect,
        nudge: 'A square is a rectangle whose length and width are both the side.',
        reveal: `The area of the square is the side times itself: ${s} · ${s} = ${s * s}.`,
        traps: [trap('geo_perimeter_for_area', id, int(4 * s), WS.perimeter), trap('geo_half_applied', id, fr(s * s, 2), WS.halfRect)],
      }),
      inner: circlePart(h, true, 'Area of the circle', `The circle touches all four sides, so its diameter is the side, ${s}, and its radius is ${h}. Its area is π · ${h}² = ${qSay(circ)}.`),
      shaded: shadedPart(
        sqArea,
        circ,
        [trap('geo_circle_radius_not_squared', 'a', [sqArea, piOf(-h)], WS.shadedNotSquared), trap('geo_circumference_for_area', 'a', [sqArea, piOf(-s)], WS.shadedCirc), trap('geo_circle_diameter_as_radius', 'a', [sqArea, piOf(-s * s)], WS.shadedDiam)],
        'the square',
        'the circle',
      ),
      givens: [int(s)],
      draw: {
        local: { O: { x: 0, y: 0 }, A: { x: -h, y: -h }, B: { x: h, y: -h }, C: { x: h, y: h }, D: { x: -h, y: h } },
        segments: [{ from: 'A', to: 'B', label: String(s) }, { from: 'B', to: 'C' }, { from: 'C', to: 'D' }, { from: 'D', to: 'A' }],
        circles: [{ center: 'O', r: h }],
        regions: [{ kind: 'compound', loops: [{ shape: 'polygon', points: ['A', 'B', 'C', 'D'] }, { shape: 'circle', center: 'O', r: h }] }],
        outlines: [['A', 'B', 'C', 'D']],
        aria: 'Square ABCD with a circle with center O inside it that touches all four sides. One side of the square is labeled. The part of the square outside the circle is shaded.',
      },
    }
  }
  if (shape === 'ring') {
    const R = spec.big
    const r = spec.s
    if (!(r >= 2 && r < R)) return fail('radii')
    const outer = piOf(R * R)
    const inner = piOf(r * r)
    const ringArea = piOf(R * R - r * r)
    const t = (spec.dir * Math.PI) / 180
    return {
      facts: `Two circles have the same center O. The radius OA of the larger circle is ${R} ${u}, and the radius OB of the smaller circle is ${r} ${u}.`,
      region: 'the ring between the two circles',
      outerName: 'the larger circle',
      innerName: 'the smaller circle',
      outer: circlePart(R, false, 'Area of the larger circle', `The larger circle has radius ${R}, so its area is π · ${R}² = ${qSay(outer)}.`),
      inner: circlePart(r, false, 'Area of the smaller circle', `The smaller circle has radius ${r}, so its area is π · ${r}² = ${qSay(inner)}.`),
      shaded: (id) => ({
        id,
        label: 'Shaded area',
        kind: 'pi',
        answer: ringArea,
        card: card.shaded,
        nudge: 'The ring is the larger circle with the smaller circle cut out. Subtract the smaller area from the larger one.',
        reveal: `The ring is the larger circle minus the smaller one: ${qSay(outer)} − ${qSay(inner)} = ${qSay(ringArea)}.`,
        traps: [
          trap('geo_region_not_subtracted', id, outer, WS.notSubtracted),
          trap('geo_region_added', id, piOf(R * R + r * r), WS.added),
          trap('geo_circle_radius_not_squared', id, piOf(R - r), WS.ringNotSquared),
          trap('geo_pi_left_off', id, int(R * R - r * r), WS.ringPiOff),
          trap('geo_circle_diameter_as_radius', id, piOf(4 * (R * R - r * r)), WS.ringDiameter),
        ],
      }),
      givens: [int(R), int(r)],
      draw: {
        local: { O: { x: 0, y: 0 }, A: { x: R, y: 0 }, B: { x: r * Math.cos(t), y: r * Math.sin(t) } },
        segments: [
          { from: 'O', to: 'A', label: String(R) },
          { from: 'O', to: 'B', label: String(r) },
        ],
        circles: [
          { center: 'O', r: R },
          { center: 'O', r },
        ],
        regions: [{ kind: 'compound', loops: [{ shape: 'circle', center: 'O', r: R }, { shape: 'circle', center: 'O', r }] }],
        outlines: [],
        away: (id, at) => (id === 'O' ? { x: at.get('O')!.x - (at.get('A')!.x + at.get('B')!.x) / 2 + at.get('O')!.x, y: at.get('O')!.y - (at.get('A')!.y + at.get('B')!.y) / 2 + at.get('O')!.y } : at.get('O')!),
        aria: 'Two circles with the same center O, with radius OA of the larger circle and radius OB of the smaller circle drawn and labeled. The ring between the two circles is shaded.',
      },
    }
  }
  if (shape === 'pond') {
    const { l, w, cx, cy } = spec
    const r = spec.s
    if (l === w || cx - r < 1 || cy - r < 1 || l - cx - r < 1 || w - cy - r < 1) return fail('the circle touches a side')
    const rect = int(l * w)
    const circ = piOf(r * r)
    const t = (spec.dir * Math.PI) / 180
    return {
      facts: `In rectangle PQRS, PQ is ${l} ${u} and QR is ${w} ${u}. A circle with center O and radius ${r} ${u} lies inside the rectangle.`,
      region: 'the part of the rectangle outside the circle',
      outerName: 'rectangle PQRS',
      innerName: 'circle O',
      outer: (id) => ({
        id,
        label: 'Area of the rectangle',
        kind: 'num',
        answer: rect,
        card: card.rect,
        nudge: 'The area of a rectangle is its length times its width.',
        reveal: `The area of the rectangle is ${l} · ${w} = ${l * w}.`,
        traps: [trap('geo_perimeter_for_area', id, int(2 * (l + w)), WS.perimeter), trap('geo_half_applied', id, fr(l * w, 2), WS.halfRect)],
      }),
      inner: circlePart(r, false, 'Area of the circle', `The circle has radius ${r}, so its area is π · ${r}² = ${qSay(circ)}.`),
      shaded: shadedPart(
        rect,
        circ,
        [trap('geo_circle_radius_not_squared', 'a', [rect, piOf(-r)], WS.shadedNotSquared), trap('geo_circumference_for_area', 'a', [rect, piOf(-2 * r)], WS.shadedCirc), trap('geo_circle_diameter_as_radius', 'a', [rect, piOf(-4 * r * r)], WS.shadedDiam)],
        'the rectangle',
        'the circle',
      ),
      givens: [int(l), int(w), int(r)],
      draw: {
        local: { P: { x: 0, y: 0 }, Q: { x: l, y: 0 }, R: { x: l, y: w }, S: { x: 0, y: w }, O: { x: cx, y: cy }, T: { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) } },
        bare: ['T'],
        segments: [{ from: 'P', to: 'Q', label: String(l) }, { from: 'Q', to: 'R', label: String(w) }, { from: 'R', to: 'S' }, { from: 'S', to: 'P' }, { from: 'O', to: 'T', label: String(r) }],
        circles: [{ center: 'O', r }],
        regions: [{ kind: 'compound', loops: [{ shape: 'polygon', points: ['P', 'Q', 'R', 'S'] }, { shape: 'circle', center: 'O', r }] }],
        outlines: [['P', 'Q', 'R', 'S']],
        away: (id, at) => (id === 'O' ? { x: 2 * at.get('O')!.x - at.get('T')!.x, y: 2 * at.get('O')!.y - at.get('T')!.y } : centroid(['P', 'Q', 'R', 'S'].map((k) => at.get(k)!))),
        aria: 'Rectangle PQRS with a circle with center O inside it, not touching the sides. Two sides of the rectangle and a radius of the circle are labeled. The part of the rectangle outside the circle is shaded.',
      },
    }
  }
  // A polygon inscribed in circle O: the circle is the outer figure.
  const r = spec.s
  const circ = piOf(r * r)
  const outer = circlePart(r, false, 'Area of the circle', `The circle has radius ${r}, so its area is π · ${r}² = ${qSay(circ)}.`)
  const ring = (n: number, start: number, ids: string[]): Record<string, P2> => {
    const out: Record<string, P2> = { O: { x: 0, y: 0 } }
    ids.forEach((id, i) => {
      const t = ((start + (360 / n) * i) * Math.PI) / 180
      out[id] = { x: r * Math.cos(t), y: r * Math.sin(t) }
    })
    return out
  }
  const sides = (ids: string[], labelR: boolean): GeoSegment[] => [...ids.map((id, i) => ({ from: id, to: ids[(i + 1) % ids.length]! })), labelR ? { from: 'O', to: ids[0]!, label: String(r) } : { from: 'O', to: ids[0]! }]
  const inscribed = (ids: string[], n: number, start: number, aria: string, labelR = true): Omit<FigureDraw, 'pose'> => ({
    local: ring(n, start, ids),
    segments: sides(ids, labelR),
    circles: [{ center: 'O', r }],
    regions: [{ kind: 'compound', loops: [{ shape: 'circle', center: 'O', r }, { shape: 'polygon', points: ids }] }],
    outlines: [ids],
    away: (id, at) => (id === 'O' ? { x: 2 * at.get('O')!.x - at.get(ids[0]!)!.x, y: 2 * at.get('O')!.y - at.get(ids[0]!)!.y } : at.get('O')!),
    aria,
  })
  if (shape === 'circleSquare') {
    const sqArea = int(2 * r * r)
    const ids = ['A', 'B', 'C', 'D']
    return {
      facts: `Square ABCD is inscribed in circle O. The radius of the circle is ${r} ${u}.`,
      region: 'the part of the circle outside the square',
      outerName: 'circle O',
      innerName: 'square ABCD',
      outer,
      inner: (id) => ({
        id,
        label: 'Area of the square',
        kind: 'num',
        answer: sqArea,
        card: card.inscribed,
        nudge: 'The radius reaches a corner of the square, so each diagonal of the square is a diameter. A square’s area is half the product of its diagonals.',
        reveal: `Each diagonal of the square is a diameter, ${2 * r}. The area of a square is half the product of its diagonals: half of ${2 * r} · ${2 * r}, which is ${2 * r * r}.`,
        traps: [trap('geo_inscribed_side_from_radius', id, int(r * r), WS.sideFromRadius), trap('geo_area_not_halved', id, int(4 * r * r), WS.squareNotHalved), trap('trig_special_wrong_way', id, int(8 * r * r), WS.squareWrongWay)],
      }),
      shaded: shadedPart(circ, sqArea, [trap('geo_inscribed_side_from_radius', 'a', [circ, int(-r * r)], WS.shadedSide)], 'the circle', 'the square'),
      givens: [int(r)],
      draw: inscribed(ids, 4, 45, 'Square ABCD inside circle O with all four corners on the circle, and radius OA drawn and labeled. The part of the circle outside the square is shaded.'),
    }
  }
  if (shape === 'circleHexagon') {
    if (r % 2 !== 0) return fail('odd radius')
    const hex = rad(3 * r * r, 2, 3)
    const ids = ['A', 'B', 'C', 'D', 'E', 'F']
    return {
      facts: `Regular hexagon ABCDEF is inscribed in circle O. The radius of the circle is ${r} ${u}.`,
      region: 'the part of the circle outside the hexagon',
      outerName: 'circle O',
      innerName: 'hexagon ABCDEF',
      outer,
      inner: (id) => ({
        id,
        label: 'Area of the hexagon',
        kind: 'num',
        answer: hex,
        card: card.regular,
        nudge: 'The radii to the six vertices cut the hexagon into six equilateral triangles, so each side equals the radius. The apothem is the height of one of those triangles.',
        reveal: `Each side of the hexagon is the radius, ${r}, so the perimeter is ${6 * r}. The apothem is half the radius times the square root of three, ${qSay(rad(r, 2, 3))}. The area is half the apothem times the perimeter, which is ${qSay(hex)}.`,
        traps: [
          trap('geo_apothem_for_radius', id, int(3 * r * r), WS.hexApothem),
          trap('geo_area_not_halved', id, rad(3 * r * r, 1, 3), WS.hexNotHalved),
          trap('trig_special_legs_swapped', id, fr(3 * r * r, 2), WS.hexShortLeg),
          trap('trig_special_root3_two_swapped', id, rad(2 * r * r, 1, 3), WS.hexSwapped),
        ],
      }),
      shaded: shadedPart(circ, hex, [trap('geo_apothem_for_radius', 'a', [circ, int(-3 * r * r)], WS.shadedHexApothem), trap('trig_special_legs_swapped', 'a', [circ, fr(-3 * r * r, 2)], WS.shadedShortLeg)], 'the circle', 'the hexagon'),
      givens: [int(r)],
      draw: inscribed(ids, 6, 0, 'Regular hexagon ABCDEF inside circle O with all six vertices on the circle, and radius OA drawn and labeled. The part of the circle outside the hexagon is shaded.'),
    }
  }
  if (r % 2 !== 0) return fail('odd radius')
  const tri = rad(3 * r * r, 4, 3)
  const ids = ['A', 'B', 'C']
  return {
    facts: `Equilateral triangle ABC is inscribed in circle O. The radius of the circle is ${r} ${u}.`,
    region: 'the part of the circle outside the triangle',
    outerName: 'circle O',
    innerName: 'triangle ABC',
    outer,
    inner: (id) => ({
      id,
      label: 'Area of the triangle',
      kind: 'num',
      answer: tri,
      card: card.inscribed,
      nudge: 'The radius reaches a vertex. The side of the triangle is the radius times the square root of three, and its height is one and a half radii.',
      reveal: `The side of the triangle is ${qSay(rad(r, 1, 3))} and its height is ${qSay(fr(3 * r, 2))}, so its area is half the base times the height, which is ${qSay(tri)}.`,
      traps: [trap('geo_inscribed_side_from_radius', id, rad(r * r, 4, 3), WS.triSide), trap('geo_area_not_halved', id, rad(3 * r * r, 2, 3), WS.triNotHalved), trap('trig_special_legs_swapped', id, fr(3 * r * r, 4), WS.triShortLeg)],
    }),
    shaded: shadedPart(
      circ,
      tri,
      [trap('geo_inscribed_side_from_radius', 'a', [circ, rad(-r * r, 4, 3)], WS.shadedSide), trap('geo_area_not_halved', 'a', [circ, rad(-3 * r * r, 2, 3)], WS.shadedNotHalved), trap('trig_special_legs_swapped', 'a', [circ, fr(-3 * r * r, 4)], WS.shadedShortLeg)],
      'the circle',
      'the triangle',
    ),
    givens: [int(r)],
    // The radius is not labeled on the figure: inside the triangle a label on OA always sits as near a side as its own
    // segment (the sides meet OA at thirty degrees). The prompt states it.
    draw: inscribed(ids, 3, 90, 'Equilateral triangle ABC inside circle O with all three vertices on the circle, and radius OA drawn. The part of the circle outside the triangle is shaded.', false),
  }
}

function buildShaded(spec: ShadedSpec, sc: Scene, rng: Rng): GeoBuilt | null {
  const u = sc.unit
  const plan = shadedPlan(spec, u)
  if (!plan) return null
  const drafts = spec.three ? [plan.outer('a'), plan.inner('b'), plan.shaded('c')] : [plan.shaded('a')]
  const stages = drafts.map((d) => part(d, plan.givens))
  const allPi = spec.shape === 'ring'
  const ask = spec.three
    ? `Find the area of ${plan.outerName}, the area of ${plan.innerName}, and the area of the shaded region, each in ${askSq(u)}. ${allPi ? 'Write each answer in terms of π.' : 'Write each answer in terms of π where π appears.'}`
    : `Find the area of the shaded region in ${askSq(u)}, in terms of π.`
  const prompt = `${sc.opener}${plan.facts} The shaded region is ${plan.region}. ${ask}`
  const figure = drawFigure({ ...plan.draw, pose: sc.pose })
  return deliver('shadedRegion', 'Areas of shaded regions', prompt, figure, stages, plan.givens, { shape: spec.shape, three: spec.three }, rng)
}

function pickShaded(rng: Rng, shape: ShadedShape, three: boolean): ShadedSpec {
  const base = { shape, three, s: 0, big: 0, l: 0, w: 0, cx: 0, cy: 0, dir: rng.int(0, 359) }
  if (shape === 'squareCircle') return { ...base, s: 2 * rng.int(2, 10) }
  if (shape === 'circleSquare') return { ...base, s: rng.int(3, 14) }
  if (shape === 'circleHexagon') return { ...base, s: 2 * rng.int(2, 7) }
  if (shape === 'circleTriangle') return { ...base, s: 2 * rng.int(2, 8) }
  if (shape === 'ring') {
    const big = rng.int(3, 12)
    return { ...base, big, s: rng.int(2, big - 1), dir: rng.int(110, 250) }
  }
  const l = rng.int(8, 18)
  const w = rng.int(6, 16)
  const r = rng.int(2, Math.max(2, Math.floor((Math.min(l, w) - 2) / 2)))
  const cx = rng.int(2 * (r + 1), 2 * (l - r - 1)) / 2
  const cy = rng.int(2 * (r + 1), 2 * (w - r - 1)) / 2
  return { ...base, l, w, s: r, cx, cy }
}

export function drawShaded(seed: number): GeoBuilt {
  const shape = modeOf(seed, 102, SHADED_SHAPES)
  const three = modeOf(seed, 92, ['three', 'three', 'three', 'one', 'one'] as const) === 'three'
  return generate(seed, 93, (rng) => buildShaded(pickShaded(rng, shape, three), scene(rng, shape === 'pond' ? [-20, 20] : [0, 359]), rng))
}

// =================================================================================================================
// ra.chance — geometric probability
// =================================================================================================================

export type ChanceVariant = 'segment' | 'target' | 'pond' | 'rectangles'
const CHANCE_VARIANTS: readonly ChanceVariant[] = ['segment', 'target', 'pond', 'rectangles']
export type Piece = 'AB' | 'BC' | 'CD' | 'AC' | 'BD'
const PIECES: readonly Piece[] = ['BC', 'AB', 'CD', 'AC', 'BD']

export interface ChanceSpec {
  variant: ChanceVariant
  /** segment: AB, BC, CD and the piece asked. */
  ab: number
  bc: number
  cd: number
  piece: Piece
  /** target: the radii; pond: r is the circle's radius. */
  big: number
  r: number
  /** target: inside the smaller circle (else the ring); pond: inside the circle (else outside it); rectangles: a shaded rectangle (else a triangle). */
  inner: boolean
  /** pond and rectangles: the big rectangle. */
  l: number
  w: number
  /** pond: the circle's center; rectangles: the corner E of the inner rectangle. */
  cx: number
  cy: number
  /** rectangles: the inner rectangle's sides, or (triangle) the base PE. */
  a: number
  b: number
  dir: number
}

const WC = {
  rest: 'That compares the piece with the rest of the figure. A probability compares the piece with the whole, the piece and the rest together.',
  complement: 'That is the probability of landing in the other part, the rest. The question asks for the chance of landing in the part it names.',
  reversed: 'That puts the whole over the piece, upside down. A probability is the piece over the whole, so it is never more than one.',
  notSquared: 'That compares the radii instead of the areas. A point is picked from a region, so compare the areas, which go by the squares of the radii.',
  diameter: 'That squares the diameter for the circle’s area. The area of a circle squares the radius.',
  radiusNotSquared: 'That uses π times the radius, unsquared, for the circle’s area. The area is π times the square of the radius.',
  piOff: 'That leaves out the π of the circle’s area. The circle’s area is a number times π, and so is this probability.',
  halfApplied: 'That takes half of the shaded rectangle’s area. A rectangle’s area is length times width, with no half.',
  notHalved: 'That leaves the half off the triangle’s area. The area of a triangle is half the base times the height.',
}

function buildChance(spec: ChanceSpec, sc: Scene, rng: Rng): GeoBuilt | null {
  const u = sc.unit
  const card = RATIO_RULE_IDS
  const close = 'Give the probability as a fraction.'
  let facts: string
  let ask: string
  let answer: GeoQty | readonly GeoQty[]
  let traps: TrapDraft7[]
  let givens: GeoQty[]
  let ruleCard: string = card.chanceArea
  let nudge: string
  let reveal: string
  let draw: Omit<FigureDraw, 'pose'>
  if (spec.variant === 'segment') {
    const { ab, bc, cd, piece } = spec
    const T = ab + bc + cd
    if (Math.min(ab, bc, cd) * 6 < T) return fail('a piece too short to label')
    const len = { AB: ab, BC: bc, CD: cd, AC: ab + bc, BD: bc + cd }[piece]
    givens = [int(ab), int(bc), int(cd)]
    facts = `Points A, B, C and D lie on segment AD in that order. AB is ${ab} ${u}, BC is ${bc} ${u} and CD is ${cd} ${u}.`
    ask = `Find the probability that a point picked at random on segment AD is on segment ${piece}. ${close}`
    answer = fr(len, T)
    ruleCard = card.chanceLength
    nudge = `Compare the length of segment ${piece} with the length of the whole segment AD.`
    reveal = `Segment AD is ${ab} + ${bc} + ${cd} = ${T} long and segment ${piece} is ${len} long, so the probability is ${len} out of ${T}, which is ${qSay(fr(len, T))}.`
    traps = [trap('geo_part_to_part_for_whole', 'a', fr(len, T - len), WC.rest), trap('geo_probability_complement', 'a', fr(T - len, T), WC.complement), trap('geo_area_ratio_reversed', 'a', fr(T, len), WC.reversed)]
    draw = {
      local: { A: { x: 0, y: 0 }, B: { x: ab, y: 0 }, C: { x: ab + bc, y: 0 }, D: { x: T, y: 0 } },
      segments: [
        { from: 'A', to: 'B', label: String(ab) },
        { from: 'B', to: 'C', label: String(bc) },
        { from: 'C', to: 'D', label: String(cd) },
      ],
      outlines: [],
      away: (id, at) => {
        const p = at.get(id)!
        const A = at.get('A')!
        const D = at.get('D')!
        // Every letter goes to the same side of the line.
        return { x: p.x + (D.y - A.y), y: p.y - (D.x - A.x) }
      },
      aria: 'Segment AD with points B and C on it, in the order A, B, C, D. AB, BC and CD are labeled.',
    }
  } else if (spec.variant === 'target') {
    const R = spec.big
    const r = spec.r
    if (!(r >= 1 && r < R)) return fail('radii')
    const R2 = R * R
    const r2 = r * r
    givens = [int(R), int(r)]
    facts = `Two circles have the same center O. The radius OA of the larger circle is ${R} ${u}, and the radius OB of the smaller circle is ${r} ${u}.`
    const t = (spec.dir * Math.PI) / 180
    if (spec.inner) {
      ask = `Find the probability that a point picked at random inside the larger circle is inside the smaller circle, the shaded region. ${close}`
      answer = fr(r2, R2)
      nudge = 'Compare the area of the smaller circle with the area of the larger circle.'
      reveal = `The smaller circle has area ${qSay(piOf(r2))} and the larger ${qSay(piOf(R2))}, so the probability is ${qSay(piOf(r2))} out of ${qSay(piOf(R2))}, which is ${qSay(fr(r2, R2))}.`
      traps = [trap('geo_area_ratio_not_squared', 'a', fr(r, R), WC.notSquared), trap('geo_probability_complement', 'a', fr(R2 - r2, R2), WC.complement), trap('geo_part_to_part_for_whole', 'a', fr(r2, R2 - r2), WC.rest)]
    } else {
      ask = `Find the probability that a point picked at random inside the larger circle is in the ring between the two circles, the shaded region. ${close}`
      answer = fr(R2 - r2, R2)
      ruleCard = card.chanceRest
      nudge = 'The ring is the larger circle with the smaller one taken out. Compare its area with the area of the larger circle.'
      reveal = `The ring has area ${qSay(piOf(R2))} − ${qSay(piOf(r2))} = ${qSay(piOf(R2 - r2))}, and the larger circle ${qSay(piOf(R2))}, so the probability is ${qSay(fr(R2 - r2, R2))}.`
      traps = [trap('geo_area_ratio_not_squared', 'a', fr(R - r, R), WC.notSquared), trap('geo_probability_complement', 'a', fr(r2, R2), WC.complement), trap('geo_part_to_part_for_whole', 'a', fr(R2 - r2, r2), WC.rest)]
    }
    draw = {
      local: { O: { x: 0, y: 0 }, A: { x: R, y: 0 }, B: { x: r * Math.cos(t), y: r * Math.sin(t) } },
      segments: [
        { from: 'O', to: 'A', label: String(R) },
        { from: 'O', to: 'B', label: String(r) },
      ],
      circles: [
        { center: 'O', r: R },
        { center: 'O', r },
      ],
      regions: [{ kind: 'compound', loops: spec.inner ? [{ shape: 'circle', center: 'O', r }] : [{ shape: 'circle', center: 'O', r: R }, { shape: 'circle', center: 'O', r }] }],
      outlines: [],
      away: (id, at) => (id === 'O' ? { x: 2 * at.get('O')!.x - (at.get('A')!.x + at.get('B')!.x) / 2, y: 2 * at.get('O')!.y - (at.get('A')!.y + at.get('B')!.y) / 2 } : at.get('O')!),
      aria: spec.inner
        ? 'Two circles with the same center O, with radius OA of the larger circle and radius OB of the smaller circle drawn and labeled. The smaller circle is shaded.'
        : 'Two circles with the same center O, with radius OA of the larger circle and radius OB of the smaller circle drawn and labeled. The ring between the two circles is shaded.',
    }
  } else if (spec.variant === 'pond') {
    const { l, w, cx, cy, r } = spec
    if (l === w || cx - r < 1 || cy - r < 1 || l - cx - r < 1 || w - cy - r < 1) return fail('the circle touches a side')
    const lw = l * w
    givens = [int(l), int(w), int(r)]
    facts = `In rectangle PQRS, PQ is ${l} ${u} and QR is ${w} ${u}. A circle with center O and radius ${r} ${u} lies inside the rectangle.`
    const inside = piOf(r * r, lw)
    if (spec.inner) {
      ask = `Find the probability that a point picked at random inside the rectangle is inside the circle, the shaded region. Give the probability as a fraction, in terms of π.`
      answer = inside
      nudge = 'Compare the area of the circle with the area of the rectangle.'
      reveal = `The circle has area ${qSay(piOf(r * r))} and the rectangle ${lw}, so the probability is ${qSay(piOf(r * r))} out of ${lw}, which is ${qSay(inside)}.`
      traps = [
        trap('geo_probability_complement', 'a', [int(1), neg(inside)], WC.complement),
        trap('geo_circle_diameter_as_radius', 'a', piOf(4 * r * r, lw), WC.diameter),
        trap('geo_circle_radius_not_squared', 'a', piOf(r, lw), WC.radiusNotSquared),
        trap('geo_pi_left_off', 'a', fr(r * r, lw), WC.piOff),
      ]
    } else {
      ask = `Find the probability that a point picked at random inside the rectangle is outside the circle, the shaded region. Give the probability as a fraction, in terms of π.`
      answer = [int(1), neg(inside)]
      ruleCard = card.chanceRest
      nudge = 'Find the probability of landing inside the circle first. Landing outside it is everything else.'
      reveal = `The probability of landing inside the circle is ${qSay(piOf(r * r))} out of ${lw}, which is ${qSay(inside)}, so the probability of landing outside it is one minus that: 1 − ${qSay(inside)}.`
      traps = [
        trap('geo_probability_complement', 'a', inside, WC.complement),
        trap('geo_circle_diameter_as_radius', 'a', [int(1), piOf(-4 * r * r, lw)], WC.diameter),
        trap('geo_circle_radius_not_squared', 'a', [int(1), piOf(-r, lw)], WC.radiusNotSquared),
      ]
    }
    const t = (spec.dir * Math.PI) / 180
    draw = {
      local: { P: { x: 0, y: 0 }, Q: { x: l, y: 0 }, R: { x: l, y: w }, S: { x: 0, y: w }, O: { x: cx, y: cy }, T: { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) } },
      bare: ['T'],
      segments: [{ from: 'P', to: 'Q', label: String(l) }, { from: 'Q', to: 'R', label: String(w) }, { from: 'R', to: 'S' }, { from: 'S', to: 'P' }, { from: 'O', to: 'T', label: String(r) }],
      circles: [{ center: 'O', r }],
      regions: [{ kind: 'compound', loops: spec.inner ? [{ shape: 'circle', center: 'O', r }] : [{ shape: 'polygon', points: ['P', 'Q', 'R', 'S'] }, { shape: 'circle', center: 'O', r }] }],
      outlines: [['P', 'Q', 'R', 'S']],
      away: (id, at) => (id === 'O' ? { x: 2 * at.get('O')!.x - at.get('T')!.x, y: 2 * at.get('O')!.y - at.get('T')!.y } : centroid(['P', 'Q', 'R', 'S'].map((k) => at.get(k)!))),
      aria: spec.inner
        ? 'Rectangle PQRS with a circle with center O inside it, not touching the sides. Two sides of the rectangle and a radius of the circle are labeled. The circle is shaded.'
        : 'Rectangle PQRS with a circle with center O inside it, not touching the sides. Two sides of the rectangle and a radius of the circle are labeled. The part of the rectangle outside the circle is shaded.',
    }
  } else if (spec.inner) {
    const { l, w, cx, cy, a, b } = spec
    if (cx < 2 || cy < 2 || l - cx - a < 2 || w - cy - b < 2) return fail('the inner rectangle is too near a side')
    const LW = l * w
    const ab = a * b
    givens = [int(l), int(w), int(a), int(b)]
    facts = `In rectangle PQRS, PQ is ${l} ${u} and QR is ${w} ${u}. The shaded rectangle EFGH lies inside it, and EF is ${a} ${u} and FG is ${b} ${u}.`
    ask = `Find the probability that a point picked at random inside rectangle PQRS is inside rectangle EFGH. ${close}`
    answer = fr(ab, LW)
    nudge = 'Compare the area of the shaded rectangle with the area of the whole rectangle.'
    reveal = `Rectangle EFGH has area ${a} · ${b} = ${ab} and rectangle PQRS has area ${l} · ${w} = ${LW}, so the probability is ${ab} out of ${LW}, which is ${qSay(fr(ab, LW))}.`
    traps = [trap('geo_probability_complement', 'a', fr(LW - ab, LW), WC.complement), trap('geo_part_to_part_for_whole', 'a', fr(ab, LW - ab), WC.rest), trap('geo_half_applied', 'a', fr(ab, 2 * LW), WC.halfApplied)]
    draw = {
      local: { P: { x: 0, y: 0 }, Q: { x: l, y: 0 }, R: { x: l, y: w }, S: { x: 0, y: w }, E: { x: cx, y: cy }, F: { x: cx + a, y: cy }, G: { x: cx + a, y: cy + b }, H: { x: cx, y: cy + b } },
      segments: [
        { from: 'P', to: 'Q', label: String(l) },
        { from: 'Q', to: 'R', label: String(w) },
        { from: 'R', to: 'S' },
        { from: 'S', to: 'P' },
        { from: 'E', to: 'F', label: String(a) },
        { from: 'F', to: 'G', label: String(b) },
        { from: 'G', to: 'H' },
        { from: 'H', to: 'E' },
      ],
      regions: [{ kind: 'compound', loops: [{ shape: 'polygon', points: ['E', 'F', 'G', 'H'] }] }],
      outlines: [['P', 'Q', 'R', 'S']],
      away: awayFromOutline([
        ['P', 'Q', 'R', 'S'],
        ['E', 'F', 'G', 'H'],
      ]),
      aria: 'Rectangle PQRS with a smaller rectangle EFGH inside it. PQ, QR, EF and FG are labeled. Rectangle EFGH is shaded.',
    }
  } else {
    const { l, w } = spec
    const b = spec.a
    if (b < 2 || l - b < 2) return fail('the base')
    givens = [int(l), int(w), int(b)]
    facts = `In rectangle PQRS, RS is ${l} ${u} and QR is ${w} ${u}. Point E is on side PQ, PE is ${b} ${u}, and triangle PES is shaded.`
    ask = `Find the probability that a point picked at random inside rectangle PQRS is inside triangle PES. ${close}`
    const LW = l * w
    answer = fr(b * w, 2 * LW)
    nudge = 'Triangle PES has a right angle at P, so its legs PE and PS are its base and height. Compare its area with the area of the rectangle.'
    reveal = `Triangle PES has base ${b} and height ${w}, so its area is half of ${b} · ${w}, which is ${qSay(fr(b * w, 2))}. The rectangle's area is ${l} · ${w} = ${LW}. The probability is ${qSay(fr(b * w, 2))} out of ${LW}, which is ${qSay(fr(b * w, 2 * LW))}.`
    traps = [trap('geo_area_not_halved', 'a', fr(b, l), WC.notHalved), trap('geo_probability_complement', 'a', fr(2 * l - b, 2 * l), WC.complement), trap('geo_part_to_part_for_whole', 'a', fr(b, 2 * l - b), WC.rest)]
    draw = {
      local: { P: { x: 0, y: 0 }, E: { x: b, y: 0 }, Q: { x: l, y: 0 }, R: { x: l, y: w }, S: { x: 0, y: w } },
      segments: [
        { from: 'P', to: 'E', label: String(b) },
        { from: 'E', to: 'Q' },
        { from: 'Q', to: 'R', label: String(w) },
        { from: 'R', to: 'S', label: String(l) },
        { from: 'S', to: 'P' },
        { from: 'E', to: 'S' },
      ],
      regions: [{ kind: 'compound', loops: [{ shape: 'polygon', points: ['P', 'E', 'S'] }] }],
      outlines: [['P', 'Q', 'R', 'S']],
      aria: 'Rectangle PQRS with point E on side PQ and segment ES drawn. PE, QR and RS are labeled. Triangle PES is shaded.',
    }
  }
  const stage = part({ id: 'a', label: 'Probability', kind: 'prob', answer, card: ruleCard, nudge, reveal, traps }, givens)
  const prompt = `${sc.opener}${facts} ${ask}`
  const figure = drawFigure({ ...draw, pose: sc.pose })
  return deliver('geoProbability', 'Geometric probability', prompt, figure, [stage], givens, { variant: spec.variant, inner: spec.inner, piece: spec.variant === 'segment' ? spec.piece : '' }, rng)
}

function pickChance(rng: Rng, variant: ChanceVariant, inner: boolean, piece: Piece): ChanceSpec {
  const base: ChanceSpec = { variant, ab: 0, bc: 0, cd: 0, piece, big: 0, r: 0, inner, l: 0, w: 0, cx: 0, cy: 0, a: 0, b: 0, dir: rng.int(110, 250) }
  if (variant === 'segment') return { ...base, ab: rng.int(1, 9), bc: rng.int(1, 9), cd: rng.int(1, 9) }
  if (variant === 'target') {
    const big = rng.int(3, 12)
    return { ...base, big, r: rng.int(1, big - 1) }
  }
  const l = rng.int(8, 18)
  const w = rng.int(6, 15)
  if (variant === 'pond') {
    const r = rng.int(1, Math.max(1, Math.floor((Math.min(l, w) - 2) / 2)))
    return { ...base, l, w, r, cx: rng.int(2 * (r + 1), 2 * (l - r - 1)) / 2, cy: rng.int(2 * (r + 1), 2 * (w - r - 1)) / 2, dir: rng.int(0, 359) }
  }
  if (inner) {
    const a = rng.int(2, l - 4)
    const b = rng.int(2, w - 4)
    return { ...base, l, w, a, b, cx: rng.int(2, l - a - 2), cy: rng.int(2, w - b - 2) }
  }
  return { ...base, l, w, a: rng.int(2, l - 2) }
}

export function drawChance(seed: number): GeoBuilt {
  const variant = modeOf(seed, 111, CHANCE_VARIANTS)
  const inner = modeOf(seed, 112, ['in', 'out'] as const) === 'in'
  const piece = modeOf(seed, 113, PIECES)
  return generate(seed, 114, (rng) => buildChance(pickChance(rng, variant, inner, piece), scene(rng, variant === 'segment' ? [-25, 25] : variant === 'target' ? [0, 359] : [-20, 20]), rng))
}

// =================================================================================================================
// hand-worked problems
// =================================================================================================================

/** Try poses and figure shapes (cm, no opener) until one passes the gate. */
function search(draw: (sc: Scene, rng: Rng) => GeoBuilt | null): GeoBuilt {
  for (let k = 1; k <= 400; k++) {
    const rng = makeRng(mixSeed(k, 991))
    const sc: Scene = { unit: 'cm', opener: '', pose: { turn: (k * 37) % 81 - 40, reflect: k % 2 === 0 } }
    const built = draw(sc, rng)
    if (built) return built
  }
  throw new Error(`hand figure: ${lastWhy}`)
}

/** A hand-worked ra.shared problem: the apex and the pose are searched, the numbers are as given. */
export function handShared(s: Omit<SharedSpec, 'apex'>): GeoBuilt {
  return search((sc, rng) => buildShared({ ...s, apex: { x: 0.1 + rng.next() * 0.8, y: 0.5 + rng.next() * 0.4 } }, sc, rng))
}


/** A hand-worked ra.similar problem: the shapes and the pose are searched, the numbers are as given. */
export function handSimilar(s: SimilarSpec): GeoBuilt {
  return search((sc, rng) => buildSimilar(s, { ...sc, pose: { turn: sc.pose.turn % 11, reflect: sc.pose.reflect } }, rng))
}

/** A hand-worked ra.shaded problem: the pose is searched, the numbers are as given. */
export function handShaded(s: ShadedSpec): GeoBuilt {
  return search((sc, rng) => buildShaded(s, { ...sc, pose: { turn: (sc.pose.turn + 360) % 360, reflect: sc.pose.reflect } }, rng))
}

/** A hand-worked ra.chance problem: the pose is searched, the numbers are as given. */
export function handChance(s: ChanceSpec): GeoBuilt {
  return search((sc, rng) => buildChance(s, { ...sc, pose: { turn: sc.pose.turn % 21, reflect: sc.pose.reflect } }, rng))
}
