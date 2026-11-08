/**
 * Honors geometry Unit 8, module geoTangentChords (Jurgensen 9-1 to 9-3): a tangent and the radius, two tangents
 * from one point, central angles and arcs, and chords. Every length and arc is the seed's own number, and the
 * figure is turned so the marked rim point is not always on top.
 */
import type { Rng } from '@/content/rng'
import type { ErrorPatternId, GeoFigureSpec } from '@/shared/types'
import type { GeoBuilt } from './build'
import { fitExpr, fitTwo, type Lin } from './expr'
import { pickLetters6 } from './unit6Geom'
import { rootSay } from './unit7Build'
import {
  aimDelta,
  angleDeg,
  cmWord,
  dist,
  finish8,
  formatLin,
  generate8,
  int,
  lastRefuse,
  modeOf,
  numStage,
  offAxis,
  pack,
  pickStage,
  pointOf,
  polar,
  rotatePromise,
  spin,
  sqrtQ,
  type GeoQty,
  type P2,
  type Trap8,
} from './unit8Build'
import { TANGENT_RULES, UNIT8_RULE_IDS } from './unit8Rules'

const LEN_INST = 'Give the exact length, in simplest radical form when it is not a whole number. The figure is there before you answer.'
const DEG_INST = 'Give a whole number of degrees. The figure is there before you answer.'
const PICK_INST = 'Pick one. The figure is there before you answer.'

const ADDED = 'That adds the squares. One of those sides is the hypotenuse, so the squares are subtracted.'
const SUBBED = 'That subtracts the squares. Both of those sides are legs, so the squares are added.'
const NOROOT = 'That stops before the square root. The theorem gives the square of the missing side.'
const HALF_LEG = 'That uses the whole chord as a leg. The right triangle has half the chord.'
const HALF_WHOLE = 'That is the whole chord. The right triangle has half of it as a leg.'
const ANS_X = 'That is the value of x. The length is what the expression equals after you substitute.'
const ARC_X = 'That is the value of x. The arc measure is what the expression equals.'
const RIGHT_AT = 'That puts the right angle at the wrong vertex. The segment is a tangent only when the right angle is at the point of tangency.'
const NEIGHBOR = 'That copies a neighboring side. The sums of the opposite sides are the ones that are equal.'
const TWO_SIDES = 'That adds two neighboring sides. The perimeter is twice the sum of one pair of opposite sides.'
const OTHER_ARC = 'That is the other arc. The major arc is the long way around the circle.'
const QUARTER = 'That is a quarter of a full turn. A diameter cuts off a semicircle.'
const SUM_ARC = 'That adds the arcs that were given. The missing arc is a full turn minus that sum.'

const O0: P2 = { x: 0, y: 0 }

/** Triples whose smallest angle is at least about 20 degrees, so a labeled triangle still fits. */
const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [5, 12, 13],
  [6, 8, 10],
  [8, 15, 17],
  [9, 12, 15],
  [7, 24, 25],
  [20, 21, 29],
  [12, 16, 20],
  [12, 35, 37],
  [15, 20, 25],
  [15, 36, 39],
  [18, 24, 30],
  [21, 28, 35],
  [10, 24, 26],
  [9, 40, 41],
  [16, 30, 34],
  [28, 45, 53],
  [33, 56, 65],
  [36, 77, 85],
  [48, 55, 73],
  [65, 72, 97],
]

function safeSqrt(n: number): GeoQty | null {
  if (!Number.isInteger(n) || n <= 0) return null
  return sqrtQ(n)
}

function pushSqrt(traps: Trap8[], id: ErrorPatternId, n: number, witness: string): void {
  const q = safeSqrt(n)
  if (q) traps.push({ id, value: q, witness })
}

function legTraps(known: number, hyp: number): Trap8[] {
  const traps: Trap8[] = []
  pushSqrt(traps, 'trig_pythag_added', known * known + hyp * hyp, ADDED)
  const under = hyp * hyp - known * known
  if (under > 0) traps.push({ id: 'trig_side_not_rooted', value: int(under), witness: NOROOT })
  return traps
}

function hypTraps(a: number, b: number): Trap8[] {
  const traps: Trap8[] = []
  const diff = Math.abs(a * a - b * b)
  if (diff > 0) pushSqrt(traps, 'trig_pythag_subtracted', diff, SUBBED)
  traps.push({ id: 'trig_side_not_rooted', value: int(a * a + b * b), witness: NOROOT })
  return traps
}

function rot90(p: P2): P2 {
  return { x: -p.y, y: p.x }
}

function wholeGivens(answer: GeoQty, ...ns: number[]): GeoQty[] {
  const out: GeoQty[] = []
  for (const n of ns) {
    if (!Number.isInteger(n) || n <= 0) continue
    const g = int(n)
    if (g.n === answer.n && g.d === answer.d && g.rad === answer.rad) continue
    out.push(g)
  }
  return out
}

function smallestAngle(a: number, b: number, c: number): number {
  const ang = (opp: number, left: number, right: number) => {
    const cos = (left * left + right * right - opp * opp) / (2 * left * right)
    return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI
  }
  return Math.min(ang(a, b, c), ang(b, a, c), ang(c, a, b))
}

function exprsOk(e1: Lin, e2: Lin, L: number, x: number): boolean {
  if (L === 4 || L === 33 || L === 47 || x === 4 || x === 33 || x === 47 || L === x || x <= 1) return false
  const nums = [e1.a, Math.abs(e1.b), e2.a, Math.abs(e2.b)]
  if (nums.includes(L) || nums.includes(x)) return false
  return e1.a !== 0 && e2.a !== 0 && e1.a !== e2.a
}

/** A degree expression must not print the measure, and "1 degrees" is not English. */
function degreeOk(e: Lin, L: number, x: number): boolean {
  if (!exprsOk(e, { a: e.a + 1, b: 0 }, L, x)) return false
  if (Math.abs(e.b) === 1) return false
  return true
}

function exprFor(L: number, x: number, rng: Rng): Lin | null {
  for (let k = 0; k < 8; k++) {
    try {
      const e = fitExpr(L, x, rng.int(0, 40) + k * 3)
      if (degreeOk(e, L, x)) return e
    } catch {
      /* try another coefficient */
    }
  }
  return null
}

function exprPair(L: number, x: number, rng: Rng, degrees: boolean): [Lin, Lin] | null {
  for (let k = 0; k < 6; k++) {
    try {
      const pair = fitTwo(L, L, x, rng.int(0, 50) + k * 3)
      const ok = degrees ? degreeOk(pair[0], L, x) && degreeOk(pair[1], L, x) : exprsOk(pair[0], pair[1], L, x)
      if (ok) return pair
    } catch {
      /* try another pair */
    }
  }
  return null
}

// --- one tangent --------------------------------------------------------------------------------------------

function tangentFigure(r: number, tangent: number, turn: number, pLetter: string, mark: boolean): GeoFigureSpec | null {
  const T = polar(r, turn)
  const dir = rot90(T)
  const span = Math.hypot(dir.x, dir.y) || 1
  const P = { x: T.x + (dir.x / span) * tangent, y: T.y + (dir.y / span) * tangent }
  if (Math.abs(dist(O0, P) - Math.hypot(r, tangent)) > 1e-6) return null
  if (Math.abs(angleDeg(T, O0, P) - 90) > 1e-4) return null
  if (angleDeg(O0, T, P) < 18 || angleDeg(P, T, O0) < 18) return null
  return pack({
    ariaLabel: mark
      ? `A circle with center O, point of tangency T, and outside point ${pLetter}. A right angle is marked at T.`
      : `A circle with center O, point T on the circle, and point ${pLetter}. No right angle is marked.`,
    points: [pointOf('O', O0, T, 'O'), pointOf('T', T, O0, 'T'), pointOf(pLetter, P, T, pLetter)],
    circles: [{ center: 'O', r }],
    segments: [
      { from: 'O', to: 'T' },
      { from: 'T', to: pLetter },
      { from: 'O', to: pLetter },
    ],
    ...(mark ? { angles: [{ vertex: 'T', from: 'O', to: pLetter, right: true as const }] } : {}),
  })
}

interface LengthSpec {
  radius: number
  tangent: number
  hyp: number
  ask: 'tan' | 'rad' | 'hyp'
  cm: string
  turn: number
  pLetter: string
  promise: ErrorPatternId[]
}

function tangentLength(s: LengthSpec): GeoBuilt | null {
  const figure = tangentFigure(s.radius, s.tangent, s.turn, s.pLetter, true)
  if (!figure) return null
  const p = s.pLetter
  const unit = s.cm
  let answer: GeoQty
  let traps: Trap8[]
  let known: string
  let label: string
  let reveal: string
  if (s.ask === 'tan') {
    answer = sqrtQ(s.hyp * s.hyp - s.radius * s.radius)
    traps = legTraps(s.radius, s.hyp)
    known = `OT is ${s.radius}${unit} and O${p} is ${s.hyp}${unit}`
    label = `${p}T`
    reveal = `The tangent meets the radius at a right angle, so ${p}T² = O${p}² − OT² = ${s.hyp}² − ${s.radius}². ${p}T = ${rootSay(answer)}.`
  } else if (s.ask === 'rad') {
    answer = sqrtQ(s.hyp * s.hyp - s.tangent * s.tangent)
    traps = legTraps(s.tangent, s.hyp)
    known = `${p}T is ${s.tangent}${unit} and O${p} is ${s.hyp}${unit}`
    label = 'OT'
    reveal = `The right angle is at the point of tangency, so OT² = O${p}² − ${p}T² = ${s.hyp}² − ${s.tangent}². OT = ${rootSay(answer)}.`
  } else {
    answer = sqrtQ(s.radius * s.radius + s.tangent * s.tangent)
    traps = hypTraps(s.radius, s.tangent)
    known = `OT is ${s.radius}${unit} and ${p}T is ${s.tangent}${unit}`
    label = `O${p}`
    reveal = `The right angle is at T, so O${p}² = OT² + ${p}T² = ${s.radius}² + ${s.tangent}². O${p} = ${rootSay(answer)}.`
  }
  const prompt = `Circle O has a tangent at the point of tangency T, and ${p} is outside the circle. ${known}. The tangent meets the radius at a right angle. Find the length of ${label}.`
  const stage = numStage({
    id: 'a',
    label,
    answer,
    nudge: 'The tangent meets the radius at a right angle, so those three lengths are a right triangle.',
    ruleCard: UNIT8_RULE_IDS.tangent,
    reveal: [reveal],
    traps,
    givens: wholeGivens(answer, s.radius, s.tangent, s.hyp),
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'tangent',
    prompt,
    figure,
    stages: [stage],
    lengths: [s.radius, s.tangent, s.hyp],
    title: 'Tangent segment',
    instructions: LEN_INST,
    params: { mode: 'length', ask: s.ask },
    cards: TANGENT_RULES,
    promise: s.promise.length ? s.promise : stage.traps.map((t) => t.id),
  })
}

function radicalLength(rng: Rng): GeoBuilt | null {
  const turn = offAxis(rng)
  const cm = cmWord(rng)
  const ask = rng.pick(['tan', 'rad', 'hyp'] as const)
  const pLetter = pickLetters6(rng, 1, ['T', 'O', 'A'])[0]
  if (!pLetter) return null
  const a = rng.int(3, 14)
  const b = rng.int(a + 1, a + 11)
  const promise = rotatePromise(ask === 'hyp' ? ['trig_pythag_subtracted', 'trig_side_not_rooted'] : ['trig_pythag_added', 'trig_side_not_rooted'], rng)
  if (ask === 'hyp') {
    const c2 = a * a + b * b
    if (Number.isInteger(Math.sqrt(c2))) return null
    return tangentLength({ radius: a, tangent: b, hyp: Math.sqrt(c2), ask, cm, turn, pLetter, promise })
  }
  const under = b * b - a * a
  if (under <= 0 || Number.isInteger(Math.sqrt(under))) return null
  if (ask === 'tan') return tangentLength({ radius: a, tangent: Math.sqrt(under), hyp: b, ask, cm, turn, pLetter, promise })
  return tangentLength({ radius: Math.sqrt(under), tangent: a, hyp: b, ask, cm, turn, pLetter, promise })
}

function tripleLength(rng: Rng): GeoBuilt | null {
  const t = rng.pick(TRIPLES)
  const legs = rng.chance(0.5) ? [t[0], t[1]] : [t[1], t[0]]
  const ask = rng.pick(['tan', 'rad', 'hyp'] as const)
  if (smallestAngle(legs[0], legs[1], t[2]) < 18) return null
  const pLetter = pickLetters6(rng, 1, ['T', 'O', 'A'])[0]
  if (!pLetter) return null
  return tangentLength({
    radius: legs[0],
    tangent: legs[1],
    hyp: t[2],
    ask,
    cm: cmWord(rng),
    turn: offAxis(rng),
    pLetter,
    promise: rotatePromise(ask === 'hyp' ? ['trig_pythag_subtracted', 'trig_side_not_rooted'] : ['trig_pythag_added', 'trig_side_not_rooted'], rng),
  })
}

function drawLength(rng: Rng): GeoBuilt | null {
  return rng.chance(0.5) ? tripleLength(rng) : radicalLength(rng)
}

// --- converse: the right angle is not marked, even when the segment is a tangent ---------------------------

function converseFigure(ot: number, pt: number, op: number, turn: number, yes: boolean, pLetter: string): GeoFigureSpec | null {
  const T = polar(ot, turn)
  let P: P2
  if (yes) {
    const dir = rot90(T)
    const span = Math.hypot(dir.x, dir.y) || 1
    P = { x: T.x + (dir.x / span) * pt, y: T.y + (dir.y / span) * pt }
  } else {
    // Right angle at the center: OT and OP are the legs, so P is outside the circle.
    P = polar(op, turn + 90)
  }
  if (Math.abs(dist(O0, T) - ot) > 1e-6) return null
  if (Math.abs(dist(O0, P) - op) > 1e-4) return null
  if (Math.abs(dist(T, P) - pt) > 1e-4) return null
  if (smallestAngle(ot, pt, op) < 18) return null
  if (yes && Math.abs(angleDeg(T, O0, P) - 90) > 1e-3) return null
  if (!yes && Math.abs(angleDeg(O0, T, P) - 90) > 1e-3) return null
  if (!yes && Math.abs(angleDeg(T, O0, P) - 90) < 2) return null
  return pack({
    ariaLabel: `A circle with center O, point T on the circle, and point ${pLetter}. No right angle is marked.`,
    points: [pointOf('O', O0, T, 'O'), pointOf('T', T, O0, 'T'), pointOf(pLetter, P, O0, pLetter)],
    circles: [{ center: 'O', r: ot }],
    segments: [
      { from: 'O', to: 'T' },
      { from: 'T', to: pLetter },
      { from: 'O', to: pLetter },
    ],
  })
}

function converse(rng: Rng): GeoBuilt | null {
  const t = rng.pick(TRIPLES)
  const yes = rng.chance(0.5)
  const pLetter = pickLetters6(rng, 1, ['T', 'O', 'A'])[0]
  if (!pLetter) return null
  let ot: number
  let pt: number
  let op: number
  if (yes) {
    const legs = rng.chance(0.5) ? [t[0], t[1]] : [t[1], t[0]]
    ot = legs[0]
    pt = legs[1]
    op = t[2]
  } else {
    ot = t[0]
    op = t[1]
    pt = t[2]
    if (!(op > ot)) return null
  }
  const figure = converseFigure(ot, pt, op, offAxis(rng), yes, pLetter)
  if (!figure) return null
  const unit = cmWord(rng)
  const prompt = `Point T is on circle O, and point ${pLetter} is not the center. OT is ${ot}${unit}, ${pLetter}T is ${pt}${unit}, and O${pLetter} is ${op}${unit}. Decide whether ${pLetter}T is a tangent of the circle.`
  const yesText = 'Yes. The right angle is at the point of tangency.'
  const noText = 'No. The right angle is not at the point of tangency.'
  const wrongYes = 'Yes. The right angle is at the center, so the segment is a tangent.'
  const choices = yes
    ? [
        { id: 'yes', text: yesText },
        { id: 'wrong', text: wrongYes, trap: 'geo_tangent_right_vertex' as const, witness: RIGHT_AT },
      ]
    : [
        { id: 'no', text: noText },
        { id: 'wrong', text: wrongYes, trap: 'geo_tangent_right_vertex' as const, witness: RIGHT_AT },
      ]
  const stage = pickStage({
    id: 'a',
    label: `Segment ${pLetter}T`,
    choices,
    answerId: yes ? 'yes' : 'no',
    nudge: 'Check where the right angle would have to be. A tangent is perpendicular to the radius at the point of tangency.',
    ruleCard: UNIT8_RULE_IDS.tangent,
    reveal: [
      yes
        ? `OT² + ${pLetter}T² = O${pLetter}², so the right angle is at T, the point of tangency. ${pLetter}T is a tangent.`
        : `The right angle of these three lengths is at the center, not at T. ${pLetter}T is not a tangent.`,
    ],
    seed: rng.int(1, 1_000_000_000),
    salt: 3,
  })
  return finish8({
    question: 'tangent',
    prompt,
    figure,
    stages: [stage],
    lengths: [ot, pt, op],
    title: 'Is it a tangent',
    instructions: PICK_INST,
    params: { mode: 'converse', ask: yes ? 'yes' : 'no' },
    cards: TANGENT_RULES,
    promise: ['geo_tangent_right_vertex'],
  })
}

// --- two tangent segments -----------------------------------------------------------------------------------

function twoTangents(rng: Rng): GeoBuilt | null {
  const L = rng.int(6, 28)
  const x = rng.int(2, 9)
  const pair = exprPair(L, x, rng, false)
  if (!pair) return null
  const [e1, e2] = pair
  const turn = offAxis(rng)
  const N = rng.int(55, 120)
  const r = 5
  const T = polar(r, turn)
  const B = polar(r, turn + N)
  const far = r / Math.cos(((N / 2) * Math.PI) / 180)
  const P = polar(far, turn + N / 2)
  if (!(far > r + 0.4)) return null
  const [b, p] = pickLetters6(rng, 2, ['T', 'O', 'A'])
  if (!b || !p) return null
  if (Math.abs(angleDeg(T, O0, P) - 90) > 1e-3) return null
  const figure = pack({
    ariaLabel: `Two tangent segments from point ${p} touch the circle at T and ${b}. Right angles are marked at the points of tangency.`,
    points: [pointOf('O', O0, T, 'O'), pointOf('T', T, O0, 'T'), pointOf(b, B, O0, b), pointOf(p, P, O0, p)],
    circles: [{ center: 'O', r }],
    segments: [
      { from: 'O', to: 'T' },
      { from: 'O', to: b },
      { from: p, to: 'T' },
      { from: p, to: b },
    ],
    angles: [
      { vertex: 'T', from: 'O', to: p, right: true },
      { vertex: b, from: 'O', to: p, right: true },
    ],
  })
  if (!figure) return null
  const prompt = `Two tangent segments from point ${p} touch circle O at T and at ${b}. ${p}T is ${formatLin(e1)} and ${p}${b} is ${formatLin(e2)}. Find the length of each tangent segment.`
  const stage = numStage({
    id: 'a',
    label: `${p}T`,
    answer: int(L),
    nudge: 'Two tangent segments from the same outside point are congruent, so the two expressions are equal.',
    ruleCard: UNIT8_RULE_IDS.twoTangents,
    reveal: [`The tangent segments are congruent, so ${formatLin(e1)} = ${formatLin(e2)}. Each one has length ${L}.`],
    traps: [{ id: 'geo_answered_x', value: int(x), witness: ANS_X }],
    givens: [],
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'tangent',
    prompt,
    figure,
    stages: [stage],
    lengths: [L],
    title: 'Two tangents',
    instructions: LEN_INST,
    params: { mode: 'two' },
    cards: TANGENT_RULES,
    promise: rotatePromise(['geo_answered_x'], rng),
  })
}

function perimeter(rng: Rng): GeoBuilt | null {
  const side = rng.int(5, 18)
  const r = side / 2
  const turn = offAxis(rng)
  const T = polar(r, turn)
  const verts = [45, 135, 225, 315].map((a) => polar(r * Math.SQRT2, turn + a))
  const letters = pickLetters6(rng, 4, ['T', 'O', 'A'])
  if (letters.length < 4) return null
  const [A, B, C, D] = letters as [string, string, string, string]
  for (let i = 0; i < 4; i++) {
    if (Math.abs(dist(verts[i]!, verts[(i + 1) % 4]!) - side) > 1e-4) return null
  }
  const figure = pack({
    ariaLabel: `Quadrilateral ${A}${B}${C}${D} drawn around circle O. Each side is tangent to the circle.`,
    points: [pointOf('O', O0, T, 'O'), pointOf('T', T, O0, 'T'), ...letters.map((id, i) => pointOf(id, verts[i]!, O0, id))],
    circles: [{ center: 'O', r }],
    segments: [
      { from: A, to: B },
      { from: B, to: C },
      { from: C, to: D },
      { from: D, to: A },
    ],
  })
  if (!figure) return null
  const unit = cmWord(rng)
  const peri = 4 * side
  const prompt = `Quadrilateral ${A}${B}${C}${D} is drawn around circle O, so each side is tangent to the circle. ${A}${B} is ${side}${unit}, ${B}${C} is ${side}${unit}, and ${C}${D} is ${side}${unit}. Find the perimeter of ${A}${B}${C}${D}.`
  const stage = numStage({
    id: 'a',
    label: `Perimeter of ${A}${B}${C}${D}`,
    answer: int(peri),
    nudge: 'Opposite sides of a quadrilateral drawn around a circle have equal sums. The perimeter is twice either sum.',
    ruleCard: UNIT8_RULE_IDS.twoTangents,
    reveal: [`The fourth side equals ${A}${B}, so the opposite sums are equal and the perimeter is twice ${A}${B} + ${C}${D}, which is ${peri}.`],
    traps: [
      { id: 'geo_circumscribed_adjacent', value: int(side), witness: NEIGHBOR },
      { id: 'geo_circumscribed_adjacent', value: int(2 * side), witness: TWO_SIDES },
    ],
    givens: [int(side)],
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'tangent',
    prompt,
    figure,
    stages: [stage],
    lengths: [side, peri],
    title: 'Perimeter around a circle',
    instructions: LEN_INST,
    params: { mode: 'perimeter' },
    cards: TANGENT_RULES,
    promise: rotatePromise(['geo_circumscribed_adjacent'], rng),
  })
}

export function drawTangent(seed: number): GeoBuilt {
  const mode = modeOf(seed, 1, ['length', 'converse', 'two', 'perimeter'] as const)
  return generate8(seed, 3, (rng) => {
    if (mode === 'length') return drawLength(rng)
    if (mode === 'converse') return converse(rng)
    if (mode === 'two') return twoTangents(rng)
    return perimeter(rng)
  })
}

// --- arcs ---------------------------------------------------------------------------------------------------

function arcFigure(turns: number[], letters: string[], aria: string): GeoFigureSpec | null {
  const r = 5
  const pts = turns.map((t) => polar(r, t))
  if (pts.some((p, i) => pts.some((q, j) => i !== j && dist(p, q) < 1.15))) return null
  if (new Set(letters).size !== letters.length) return null
  return pack({
    ariaLabel: aria,
    points: [pointOf('O', O0, pts[0]!, 'O'), ...pts.map((p, i) => pointOf(letters[i]!, p, O0, letters[i]!))],
    circles: [{ center: 'O', r }],
    segments: pts.map((_, i) => ({ from: 'O', to: letters[i]! })),
  })
}

function centralProblem(rng: Rng, reverse: boolean): GeoBuilt | null {
  const L = rng.int(24, 150)
  const x = rng.int(2, 12)
  if (L === 180 || 360 - L === L) return null
  const e = exprFor(L, x, rng)
  if (!e) return null
  const turn = offAxis(rng)
  const B = pickLetters6(rng, 1, ['A', 'O', 'T'])[0]
  if (!B) return null
  const figure = arcFigure([turn, turn + L], ['A', B], `Circle O with central angle A O ${B}. Point A and point ${B} lie on the circle.`)
  if (!figure) return null
  const expr = formatLin(e)
  const prompt = reverse
    ? `O is the center of the circle. Minor arc A${B} measures ${expr} degrees, where x is ${x}. Find the measure of central angle AO${B}.`
    : `O is the center of the circle. Angle AO${B} is a central angle of ${expr} degrees, where x is ${x}. Find the measure of minor arc A${B}.`
  const stage = numStage({
    id: 'a',
    label: reverse ? `Angle AO${B}` : `Arc A${B}`,
    answer: int(L),
    deg: true,
    nudge: 'A central angle and its minor arc have the same measure. The major arc is the rest of the circle.',
    ruleCard: UNIT8_RULE_IDS.arcs,
    reveal: [
      reverse
        ? `A central angle has the same measure as its minor arc. With x equal to ${x}, the expression equals ${L}, so angle AO${B} measures ${L} degrees.`
        : `A minor arc has the same measure as its central angle. With x equal to ${x}, the expression equals ${L}, so arc A${B} measures ${L} degrees.`,
    ],
    traps: [{ id: 'geo_major_minor_swapped', value: int(360 - L), witness: OTHER_ARC }],
    givens: [],
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'circleArcs',
    prompt,
    figure,
    stages: [stage],
    lengths: [],
    title: reverse ? 'Central angle' : 'Minor arc',
    instructions: DEG_INST,
    params: { mode: reverse ? 'reverse' : 'central' },
    cards: TANGENT_RULES,
    promise: rotatePromise(['geo_major_minor_swapped'], rng),
  })
}

function semicircle(rng: Rng): GeoBuilt | null {
  const turn = offAxis(rng)
  const B = pickLetters6(rng, 1, ['A', 'O', 'T'])[0]
  if (!B) return null
  const figure = arcFigure([turn, turn + 180], ['A', B], `Circle O with diameter A${B}.`)
  if (!figure) return null
  const prompt = `A${B} is a diameter of circle O. Find the measure of semicircle A${B}.`
  const stage = numStage({
    id: 'a',
    label: `Semicircle A${B}`,
    answer: int(180),
    deg: true,
    nudge: 'A diameter cuts the circle into two semicircles. Each one is half of a full turn.',
    ruleCard: UNIT8_RULE_IDS.arcs,
    reveal: [`A diameter divides the circle into two semicircles, so semicircle A${B} measures 180 degrees.`],
    traps: [{ id: 'geo_semicircle_as_quarter', value: int(90), witness: QUARTER }],
    givens: [],
  })
  return finish8({
    question: 'circleArcs',
    prompt,
    figure,
    stages: [stage],
    lengths: [],
    title: 'Semicircle',
    instructions: DEG_INST,
    params: { mode: 'semi' },
    cards: TANGENT_RULES,
    promise: ['geo_semicircle_as_quarter'],
  })
}

function arcSum(rng: Rng): GeoBuilt | null {
  const a = rng.int(40, 110)
  const b = rng.int(40, 110)
  const c = rng.int(40, 100)
  const d = 360 - a - b - c
  if (d < 40 || d > 160 || d === a || d === b || d === c || d === 47 || d === 180) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 3, ['A', 'O', 'T'])
  if (rest.length < 3) return null
  const [B, C, D] = rest as [string, string, string]
  const figure = arcFigure([turn, turn + a, turn + a + b, turn + a + b + c], ['A', B, C, D], `Circle O with points A, ${B}, ${C}, and ${D} in order around the circle.`)
  if (!figure) return null
  const prompt = `O is the center of the circle. Arc A${B} measures ${a} degrees, arc ${B}${C} measures ${b} degrees, and arc ${C}${D} measures ${c} degrees. Arcs A${B}, ${B}${C}, ${C}${D}, and ${D}A go all the way around the circle. Find the measure of arc ${D}A.`
  const stage = numStage({
    id: 'a',
    label: `Arc ${D}A`,
    answer: int(d),
    deg: true,
    nudge: 'Adjacent arcs around a circle add up to one full turn. Subtract the arcs you were given.',
    ruleCard: UNIT8_RULE_IDS.arcs,
    reveal: [`The arcs around the circle add to a full turn, so arc ${D}A measures 360 − ${a} − ${b} − ${c} = ${d} degrees.`],
    traps: [{ id: 'geo_arcs_not_from_full', value: int(a + b + c), witness: SUM_ARC }],
    givens: [int(a), int(b), int(c)],
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'circleArcs',
    prompt,
    figure,
    stages: [stage],
    lengths: [],
    title: 'Arcs around the circle',
    instructions: DEG_INST,
    params: { mode: 'sum' },
    cards: TANGENT_RULES,
    promise: ['geo_arcs_not_from_full'],
  })
}

function majorArc(rng: Rng, named: boolean): GeoBuilt | null {
  const n = rng.int(30, 140)
  const major = 360 - n
  if (n === 47 || major === 47 || major === n) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 2, ['A', 'O', 'T'])
  if (rest.length < 2) return null
  const [B, C] = rest as [string, string]
  const cTurn = turn + n + (360 - n) / 2
  const figure = arcFigure([turn, turn + n, cTurn], ['A', B, C], `Circle O with minor arc A${B} and point ${C} on the major arc.`)
  if (!figure) return null
  if (named) {
    const prompt = `O is the center of the circle. Minor arc A${B} measures ${n} degrees, and point ${C} lies on the long way around from A to ${B}. Which name is the major arc?`
    const stage = pickStage({
      id: 'a',
      label: 'Major arc',
      choices: [
        { id: 'major', text: `Arc A${C}${B}, the long way around` },
        { id: 'minor', text: `Arc A${B}, the short way around`, trap: 'geo_major_minor_swapped', witness: OTHER_ARC },
      ],
      answerId: 'major',
      nudge: 'The major arc is the long way around, so its name uses three letters.',
      ruleCard: UNIT8_RULE_IDS.arcs,
      reveal: [`Point ${C} is on the major arc, so the major arc from A to ${B} is named A${C}${B}.`],
      seed: rng.int(1, 1_000_000_000),
      salt: 5,
    })
    return finish8({
      question: 'circleArcs',
      prompt,
      figure,
      stages: [stage],
      lengths: [],
      title: 'Name the major arc',
      instructions: PICK_INST,
      params: { mode: 'name' },
      cards: TANGENT_RULES,
      promise: ['geo_major_minor_swapped'],
    })
  }
  const prompt = `O is the center of the circle. Minor arc A${B} measures ${n} degrees. Point ${C} is on the major arc. Find the measure of major arc A${C}${B}.`
  const stage = numStage({
    id: 'a',
    label: `Major arc A${C}${B}`,
    answer: int(major),
    deg: true,
    nudge: 'The major arc and the minor arc together make one full turn.',
    ruleCard: UNIT8_RULE_IDS.arcs,
    reveal: [`The major arc is a full turn minus the minor arc, so major arc A${C}${B} measures ${major} degrees.`],
    traps: [{ id: 'geo_major_minor_swapped', value: int(n), witness: OTHER_ARC }],
    givens: [int(n)],
  })
  return finish8({
    question: 'circleArcs',
    prompt,
    figure,
    stages: [stage],
    lengths: [],
    title: 'Major arc',
    instructions: DEG_INST,
    params: { mode: 'major' },
    cards: TANGENT_RULES,
    promise: ['geo_major_minor_swapped'],
  })
}

function congruentArcs(rng: Rng): GeoBuilt | null {
  const L = rng.int(36, 140)
  const x = rng.int(2, 11)
  const pair = exprPair(L, x, rng, true)
  if (!pair) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 3, ['A', 'O', 'T'])
  if (rest.length < 3) return null
  const [B, C, D] = rest as [string, string, string]
  // True central angles, with a gap so the four points stay apart (at 140 the gap is 40 degrees).
  const figure = arcFigure([turn, turn + L, turn + 180, turn + 180 + L], ['A', B, C, D], `Circle O with equal minor arcs A${B} and ${C}${D}.`)
  if (!figure) return null
  const prompt = `In circle O, minor arc A${B} and minor arc ${C}${D} have the same measure. Arc A${B} measures ${formatLin(pair[0])} degrees and arc ${C}${D} measures ${formatLin(pair[1])} degrees. Find the measure of arc A${B}.`
  const stage = numStage({
    id: 'a',
    label: `Arc A${B}`,
    answer: int(L),
    deg: true,
    nudge: 'Equal arcs have the same measure, so the two expressions are equal.',
    ruleCard: UNIT8_RULE_IDS.arcs,
    reveal: [`The arcs have the same measure, so ${formatLin(pair[0])} = ${formatLin(pair[1])}. Arc A${B} measures ${L} degrees.`],
    traps: [{ id: 'geo_answered_x', value: int(x), witness: ARC_X }],
    givens: [],
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'circleArcs',
    prompt,
    figure,
    stages: [stage],
    lengths: [],
    title: 'Equal arcs',
    instructions: DEG_INST,
    params: { mode: 'expr' },
    cards: TANGENT_RULES,
    promise: ['geo_answered_x'],
  })
}

export function drawArcs(seed: number): GeoBuilt {
  const mode = modeOf(seed, 11, ['central', 'reverse', 'semi', 'sum', 'major', 'name', 'expr'] as const)
  return generate8(seed, 13, (rng) => {
    if (mode === 'central') return centralProblem(rng, false)
    if (mode === 'reverse') return centralProblem(rng, true)
    if (mode === 'semi') return semicircle(rng)
    if (mode === 'sum') return arcSum(rng)
    if (mode === 'major') return majorArc(rng, false)
    if (mode === 'name') return majorArc(rng, true)
    return congruentArcs(rng)
  })
}

// --- chords -------------------------------------------------------------------------------------------------

function chordGeometry(r: number, half: number, distance: number, turn: number): { a: P2; b: P2; mid: P2 } | null {
  if (!(r > half && r > distance && half > 0 && distance > 0)) return null
  const mid0 = polar(distance, turn)
  const dir = polar(1, turn + 90)
  const a0 = { x: mid0.x + dir.x * half, y: mid0.y + dir.y * half }
  const b0 = { x: mid0.x - dir.x * half, y: mid0.y - dir.y * half }
  const delta = aimDelta(a0, O0, turn)
  const a = spin(a0, O0, delta)
  const b = spin(b0, O0, delta)
  const mid = spin(mid0, O0, delta)
  if (Math.abs(dist(O0, a) - r) > 1e-6 || Math.abs(dist(O0, b) - r) > 1e-6) return null
  if (Math.abs(angleDeg(mid, O0, a) - 90) > 1e-3) return null
  if (dist(a, b) < r * 0.35 || dist(mid, O0) < r * 0.22) return null
  return { a, b, mid }
}

function chordFigure(r: number, half: number, distance: number, turn: number, letters: [string, string, string]): GeoFigureSpec | null {
  const [A, B, M] = letters
  if (new Set(letters).size !== 3 || letters.includes('O')) return null
  const g = chordGeometry(r, half, distance, turn)
  if (!g) return null
  return pack({
    ariaLabel: `Circle O with chord ${A}${B}. The radius through ${M} is perpendicular to the chord, and a right angle is marked at ${M}.`,
    points: [pointOf('O', O0, g.a, 'O'), pointOf(M, g.mid, g.a, M), pointOf(A, g.a, O0, A), pointOf(B, g.b, O0, B)],
    circles: [{ center: 'O', r }],
    segments: [
      { from: 'O', to: A },
      { from: 'O', to: M },
      { from: A, to: B },
    ],
    angles: [{ vertex: M, from: 'O', to: A, right: true }],
  })
}

function chordPerp(rng: Rng): GeoBuilt | null {
  const t = rng.pick(TRIPLES)
  const pair = rng.chance(0.5) ? [t[0], t[1]] : [t[1], t[0]]
  const half = pair[0]
  const distance = pair[1]
  const radius = t[2]
  if (half < radius * 0.25 || distance < radius * 0.25) return null
  const ask = rng.pick(['half', 'dist', 'radius'] as const)
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 2, ['A', 'O', 'T'])
  if (rest.length < 2) return null
  const letters: [string, string, string] = ['A', rest[0]!, rest[1]!]
  const [A, B, M] = letters
  const figure = chordFigure(radius, half, distance, turn, letters)
  if (!figure) return null
  const unit = cmWord(rng)
  const traps: Trap8[] = []
  let answer: GeoQty
  let prompt: string
  let reveal: string
  let label: string
  const givens: GeoQty[] = []
  if (ask === 'radius') {
    answer = int(radius)
    label = `Radius O${A}`
    prompt = `In circle O, a radius is perpendicular to chord ${A}${B} and meets the chord at its midpoint ${M}. ${A}${M} is ${half}${unit} and O${M} is ${distance}${unit}. Find the length of the radius O${A}.`
    reveal = `The right triangle has legs ${A}${M} and O${M}, so O${A}² = ${half}² + ${distance}² and O${A} = ${radius}.`
    pushSqrt(traps, 'geo_half_not_taken', (2 * half) * (2 * half) + distance * distance, HALF_LEG)
    pushSqrt(traps, 'trig_pythag_subtracted', Math.abs(half * half - distance * distance), SUBBED)
    traps.push({ id: 'trig_side_not_rooted', value: int(half * half + distance * distance), witness: NOROOT })
    givens.push(int(half), int(distance))
  } else if (ask === 'dist') {
    answer = int(distance)
    label = `O${M}`
    prompt = `In circle O, a radius is perpendicular to chord ${A}${B} and meets the chord at its midpoint ${M}. The radius O${A} is ${radius}${unit} and chord ${A}${B} is ${2 * half}${unit}. Find the distance from O to the chord.`
    reveal = `The radius bisects the chord, so ${A}${M} = ${half}. Then O${M}² = ${radius}² − ${half}² and O${M} = ${distance}.`
    pushSqrt(traps, 'trig_pythag_added', radius * radius + half * half, ADDED)
    traps.push({ id: 'trig_side_not_rooted', value: int(radius * radius - half * half), witness: NOROOT })
    const whole = radius * radius - (2 * half) * (2 * half)
    pushSqrt(traps, 'geo_half_not_taken', whole, HALF_LEG)
    givens.push(int(radius), int(2 * half))
  } else {
    answer = int(half)
    label = `${A}${M}`
    prompt = `In circle O, a radius is perpendicular to chord ${A}${B} and meets the chord at its midpoint ${M}. The radius O${A} is ${radius}${unit} and O${M} is ${distance}${unit}. Find the length of ${A}${M}.`
    reveal = `${A}${M}² = ${radius}² − ${distance}², so ${A}${M} = ${half}. The whole chord is twice that.`
    traps.push({ id: 'geo_half_not_taken', value: int(2 * half), witness: HALF_WHOLE })
    pushSqrt(traps, 'trig_pythag_added', radius * radius + distance * distance, ADDED)
    traps.push({ id: 'trig_side_not_rooted', value: int(radius * radius - distance * distance), witness: NOROOT })
    givens.push(int(radius), int(distance))
  }
  const stage = numStage({
    id: 'a',
    label,
    answer,
    nudge: 'A radius perpendicular to a chord bisects the chord. The right triangle uses half the chord, not the whole chord.',
    ruleCard: UNIT8_RULE_IDS.chords,
    reveal: [reveal],
    traps,
    givens,
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'chords',
    prompt,
    figure,
    stages: [stage],
    lengths: [half, distance, radius, 2 * half],
    title: 'Chord and radius',
    instructions: LEN_INST,
    params: { mode: 'perp', ask },
    cards: TANGENT_RULES,
    promise: rotatePromise(stage.traps.map((tr) => tr.id), rng),
  })
}

function congruentChords(rng: Rng): GeoBuilt | null {
  const L = rng.int(6, 24)
  const x = rng.int(2, 9)
  const pair = exprPair(L, x, rng, false)
  if (!pair) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 3, ['A', 'O', 'T'])
  if (rest.length < 3) return null
  const [B, C, D] = rest as [string, string, string]
  // A 3-4-5 right triangle scaled so the chord really is L.
  const k = L / 6
  const g1 = chordGeometry(5 * k, 3 * k, 4 * k, turn)
  const g2 = chordGeometry(5 * k, 3 * k, 4 * k, turn + 130)
  if (!g1 || !g2) return null
  if (Math.abs(dist(g1.a, g1.b) - L) > 1e-6) return null
  const figure = pack({
    ariaLabel: `Circle O with equal chords A${B} and ${C}${D}.`,
    points: [
      pointOf('O', O0, g1.a, 'O'),
      pointOf('A', g1.a, O0, 'A'),
      pointOf(B, g1.b, O0, B),
      pointOf(C, g2.a, O0, C),
      pointOf(D, g2.b, O0, D),
    ],
    circles: [{ center: 'O', r: 5 * k }],
    segments: [
      { from: 'A', to: B },
      { from: C, to: D },
    ],
  })
  if (!figure) return null
  const prompt = `In circle O, chord A${B} and chord ${C}${D} have the same length. A${B} is ${formatLin(pair[0])} and ${C}${D} is ${formatLin(pair[1])}. Find the length of A${B}.`
  const stage = numStage({
    id: 'a',
    label: `A${B}`,
    answer: int(L),
    nudge: 'Equal chords have the same length, so the two expressions are equal.',
    ruleCard: UNIT8_RULE_IDS.chords,
    reveal: [`The chords have the same length, so ${formatLin(pair[0])} = ${formatLin(pair[1])}. A${B} has length ${L}.`],
    traps: [{ id: 'geo_answered_x', value: int(x), witness: ANS_X }],
    givens: [],
  })
  if (stage.traps.length === 0) return null
  return finish8({
    question: 'chords',
    prompt,
    figure,
    stages: [stage],
    lengths: [L],
    title: 'Equal chords',
    instructions: LEN_INST,
    params: { mode: 'congruent' },
    cards: TANGENT_RULES,
    promise: ['geo_answered_x'],
  })
}

export function drawChords(seed: number): GeoBuilt {
  const mode = modeOf(seed, 21, ['perp', 'congruent'] as const)
  return generate8(seed, 23, (rng) => (mode === 'perp' ? chordPerp(rng) : congruentChords(rng)))
}

// --- hands --------------------------------------------------------------------------------------------------

function until(tries: number, make: (turn: number) => GeoBuilt | null): GeoBuilt {
  const turns = [20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320, 350, 15, 75, 35, 65]
  for (let i = 0; i < tries; i++) {
    const built = make(turns[i % turns.length]!)
    if (built) return built
  }
  throw new Error(lastRefuse || 'hand figure did not pack')
}

export function handTangentRadical(): GeoBuilt {
  return until(16, (turn) =>
    tangentLength({
      radius: 6,
      tangent: Math.sqrt(28),
      hyp: 8,
      ask: 'tan',
      cm: ' cm',
      turn,
      pLetter: 'P',
      promise: ['trig_pythag_added', 'trig_side_not_rooted'],
    }),
  )
}

export function handTangentHypotenuse(): GeoBuilt {
  return until(16, (turn) =>
    tangentLength({
      radius: 5,
      tangent: 12,
      hyp: 13,
      ask: 'hyp',
      cm: ' cm',
      turn,
      pLetter: 'P',
      promise: ['trig_pythag_subtracted', 'trig_side_not_rooted'],
    }),
  )
}

export function handConverseYes(): GeoBuilt {
  return until(16, (turn) => {
    const figure = converseFigure(6, 8, 10, turn, true, 'P')
    if (!figure) return null
    const stage = pickStage({
      id: 'a',
      label: 'Segment PT',
      choices: [
        { id: 'yes', text: 'Yes. The right angle is at the point of tangency.' },
        { id: 'wrong', text: 'Yes. The right angle is at the center, so the segment is a tangent.', trap: 'geo_tangent_right_vertex', witness: RIGHT_AT },
      ],
      answerId: 'yes',
      nudge: 'Check where the right angle would have to be. A tangent is perpendicular to the radius at the point of tangency.',
      ruleCard: UNIT8_RULE_IDS.tangent,
      reveal: ['OT² + PT² = OP², so the right angle is at T, the point of tangency. PT is a tangent.'],
      seed: 11,
      salt: 3,
    })
    return finish8({
      question: 'tangent',
      prompt: 'Point T is on circle O, and point P is not the center. OT is 6 cm, PT is 8 cm, and OP is 10 cm. Decide whether PT is a tangent of the circle.',
      figure,
      stages: [stage],
      lengths: [6, 8, 10],
      title: 'Is it a tangent',
      instructions: PICK_INST,
      params: { mode: 'converse', ask: 'yes' },
      cards: TANGENT_RULES,
      promise: ['geo_tangent_right_vertex'],
    })
  })
}

export function handConverseNo(): GeoBuilt {
  return until(16, (turn) => {
    const figure = converseFigure(5, 13, 12, turn, false, 'P')
    if (!figure) return null
    const stage = pickStage({
      id: 'a',
      label: 'Segment PT',
      choices: [
        { id: 'no', text: 'No. The right angle is not at the point of tangency.' },
        { id: 'wrong', text: 'Yes. The right angle is at the center, so the segment is a tangent.', trap: 'geo_tangent_right_vertex', witness: RIGHT_AT },
      ],
      answerId: 'no',
      nudge: 'Check where the right angle would have to be. A tangent is perpendicular to the radius at the point of tangency.',
      ruleCard: UNIT8_RULE_IDS.tangent,
      reveal: ['The right angle of these three lengths is at the center, not at T. PT is not a tangent.'],
      seed: 13,
      salt: 3,
    })
    return finish8({
      question: 'tangent',
      prompt: 'Point T is on circle O, and point P is not the center. OT is 5 cm, PT is 13 cm, and OP is 12 cm. Decide whether PT is a tangent of the circle.',
      figure,
      stages: [stage],
      lengths: [5, 13, 12],
      title: 'Is it a tangent',
      instructions: PICK_INST,
      params: { mode: 'converse', ask: 'no' },
      cards: TANGENT_RULES,
      promise: ['geo_tangent_right_vertex'],
    })
  })
}

export function handChordDistance(): GeoBuilt {
  return until(16, (turn) => {
    const figure = chordFigure(10, 8, 6, turn, ['A', 'B', 'M'])
    if (!figure) return null
    const stage = numStage({
      id: 'a',
      label: 'OM',
      answer: int(6),
      nudge: 'A radius perpendicular to a chord bisects the chord. The right triangle uses half the chord, not the whole chord.',
      ruleCard: UNIT8_RULE_IDS.chords,
      reveal: ['The radius bisects the chord, so AM = 8. Then OM² = 10² − 8² and OM = 6.'],
      traps: [
        { id: 'trig_pythag_added', value: sqrtQ(100 + 64), witness: ADDED },
        { id: 'trig_side_not_rooted', value: int(36), witness: NOROOT },
      ],
      givens: [int(10), int(16)],
    })
    return finish8({
      question: 'chords',
      prompt: 'In circle O, a radius is perpendicular to chord AB and meets the chord at its midpoint M. The radius OA is 10 and chord AB is 16. Find the distance from O to the chord.',
      figure,
      stages: [stage],
      lengths: [8, 6, 10, 16],
      title: 'Chord and radius',
      instructions: LEN_INST,
      params: { mode: 'perp', ask: 'dist' },
      cards: TANGENT_RULES,
      promise: ['trig_side_not_rooted', 'trig_pythag_added'],
    })
  })
}
