/**
 * Honors geometry Unit 7, module geoPythagorean (Jurgensen 8-2 and 8-3): the Pythagorean Theorem and its converse.
 *
 * py.side: a missing leg or hypotenuse in simplest radical form (Pythagorean triples and their multiples among them),
 * alone or inside a rectangle (its diagonal), an isosceles triangle (its altitude), a rhombus (a side from the
 * diagonals) or the coordinate grid (the distance between two points). py.classify: three lengths, acute, right or
 * obtuse, or no triangle at all. py.apply: word problems rounded as asked.
 *
 * The third side and its slips come from the precalculus right-triangle core (`@/engine/trig`: hypotenuseOf, legOf,
 * hypotenuseSlips, legSlips), so the two courses grade the Pythagorean Theorem the same way.
 */
import { hypotenuseOf, hypotenuseSlips, legOf, legSlips } from '@/engine/trig'
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoAngleMark, GeoFigureSpec, GeoPoint, GeoSegment } from '@/shared/types'
import type { GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { pickLetters6 } from './unit6Geom'
import { weighted } from './unit6Ratios'
import {
  EXACT_HINT7,
  approxQ,
  centerOf,
  coreWords,
  choiceStage7,
  exactStage7,
  finish7,
  fromTrig,
  int,
  isWholeQ,
  nearHalf,
  placeAll,
  placeLabels7,
  pointOf,
  qSay,
  rad,
  rootSay,
  roundStage7,
  smallestAngle,
  sqSay,
  sqrtQ,
  squareQ,
  toTrig,
  type LengthUnit7,
  type P2,
  type Places,
  type Stage7,
  type TrapDraft7,
} from './unit7Build'
import { PYTHAGOREAN_RULES, UNIT7_RULE_IDS } from './unit7Rules'

const SIDE_INSTRUCTIONS = 'Give the exact length, in simplest radical form when it is not a whole number. The figure is there before you answer.'
const CLASSIFY_INSTRUCTIONS = 'Decide from the three lengths alone.'
const APPLY_INSTRUCTIONS = 'Round only at the end, as the problem asks. The figure is there before you answer.'

/** Pythagorean triples whose triangles are not too thin to draw and label (smallest angle at least 16°). */
export const TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [12, 35, 37],
  [28, 45, 53],
  [33, 56, 65],
  [48, 55, 73],
  [36, 77, 85],
  [39, 80, 89],
  [65, 72, 97],
]

/** A multiple of a triple with every side at most `max`, or null. */
function tripleDraw(rng: Rng, max: number): [number, number, number] | null {
  const fits = TRIPLES.filter((t) => t[2] <= max)
  const t = rng.pick(fits)
  const most = Math.floor(max / t[2])
  if (most < 1) return null
  const k = rng.int(1, Math.min(most, 6))
  return [t[0] * k, t[1] * k, t[2] * k]
}

/** A radical a side may be given as: k√r with r square-free. */
function radicalSide(rng: Rng): GeoQty {
  const r = rng.pick([2, 3, 5, 6, 7, 10, 11, 13])
  const k = rng.int(1, 4)
  return rad(k, 1, r)
}

const sq = (q: GeoQty) => squareQ(q)[0]

/** The trig core's slips for the third side, as geometry traps. */
function coreSlips(stage: 'x' | 'result', legs: [GeoQty, GeoQty] | null, legAndHyp: [GeoQty, GeoQty] | null): TrapDraft7[] {
  const slips = legs ? hypotenuseSlips(toTrig(legs[0]), toTrig(legs[1])) : legSlips(toTrig(legAndHyp![0]), toTrig(legAndHyp![1]))
  return slips.flatMap((s) => (s.value === 'undefined' ? [] : [{ id: s.id as ErrorPatternId, stage, value: fromTrig(s.value), witness: coreWords(s.witness) }]))
}

/** (k√r)² taken as k·r: the third side that slip gives, when one of the sides is a radical with a number in front. */
function coefficientSlip(stage: 'x' | 'result', given: GeoQty, other: GeoQty, hypAsked: boolean): TrapDraft7 | null {
  if (given.rad === 1 || given.n === 1 || given.d !== 1) return null
  const wrongSq = given.n * given.rad
  const otherSq = sq(other)
  const value = hypAsked ? wrongSq + otherSq : otherSq - wrongSq
  if (value <= 0) return null
  return {
    id: 'geo_coefficient_not_squared',
    stage,
    value: sqrtQ(value),
    witness: `That squares ${qSay(given)} as ${given.n} · ${given.rad} = ${wrongSq}. Square the ${given.n} too: ${sqSay(given)} = ${given.n * given.n} · ${given.rad} = ${given.n * given.n * given.rad}.`,
  }
}

/** The worked line for a missing side. */
function sideReveal(name: string, legs: [GeoQty, GeoQty] | null, legAndHyp: [GeoQty, GeoQty] | null, answer: GeoQty, legNames: [string, string], hypName: string): string {
  const tail = rootSay(answer)
  if (legs) return `By the Pythagorean Theorem, ${name}² = ${legNames[0]}² + ${legNames[1]}² = ${sq(legs[0])} + ${sq(legs[1])} = ${sq(answer)}, so ${name} = ${tail}.`
  const [leg, hyp] = legAndHyp!
  return `By the Pythagorean Theorem, ${name}² = ${hypName}² − ${legNames[0]}² = ${sq(hyp)} − ${sq(leg)} = ${sq(answer)}, so ${name} = ${tail}.`
}

// =================================================================================================================
// py.side
// =================================================================================================================

type SideCase = 'triangle' | 'rectangle' | 'isosceles' | 'rhombus' | 'grid'

/** Two legs and a hypotenuse: a triple's multiple, or whole legs (or a whole leg and hypotenuse) that leave a radical. */
function rightSides(rng: Rng, max: number, allowRadicalGiven: boolean): { a: GeoQty; b: GeoQty; c: GeoQty } | null {
  const roll = rng.next()
  if (roll < 0.42) {
    const t = tripleDraw(rng, max)
    if (!t) return null
    const [a, b, c] = rng.chance(0.5) ? t : [t[1], t[0], t[2]]
    return { a: int(a), b: int(b), c: int(c) }
  }
  if (allowRadicalGiven && roll < 0.58) {
    const a = radicalSide(rng)
    const b = int(rng.int(2, 15))
    const c = sqrtQ(sq(a) + sq(b))
    return { a, b, c }
  }
  if (roll < 0.8) {
    const a = rng.int(2, 16)
    const b = rng.int(2, 16)
    const c = sqrtQ(a * a + b * b)
    if (c.rad === 1) return null
    return { a: int(a), b: int(b), c }
  }
  const c = rng.int(4, 20)
  const a = rng.int(2, c - 1)
  const b = sqrtQ(c * c - a * a)
  if (b.rad === 1) return null
  return { a: int(a), b, c: int(c) }
}

/** Is this length one she can be given (a whole number, or a radical with a small radicand)? */
const givable = (q: GeoQty) => q.d === 1 && (q.rad === 1 || q.rad <= 13)

function sideTriangle(rng: Rng): GeoBuilt | null {
  const s = rightSides(rng, 60, true)
  if (!s) return null
  const asked = rng.chance(0.5) ? 'hyp' : rng.chance(0.5) ? 'a' : 'b'
  return rightTriangleProblem(rng, s, asked)
}

/**
 * Right triangle PQR with the right angle at Q, legs PQ = a and QR = b, hypotenuse PR = c; x is the side asked. The
 * letters, the turn and the mirror come from `rng`.
 */
export function rightTriangleProblem(rng: Rng, s: { a: GeoQty; b: GeoQty; c: GeoQty }, asked: 'hyp' | 'a' | 'b'): GeoBuilt | null {
  const hypAsked = asked === 'hyp'
  const [P, Q, R] = pickLetters6(rng, 3) as [string, string, string]
  // Q is the right angle; PQ = a, QR = b, PR = c.
  const names = { a: `${P}${Q}`, b: `${Q}${R}`, c: `${P}${R}` }
  let answer: GeoQty
  let givenPairs: [string, GeoQty][]
  let traps: TrapDraft7[]
  let reveal: string
  let askedName: string
  if (hypAsked) {
    if (!givable(s.a) || !givable(s.b)) return null
    answer = fromTrig(hypotenuseOf(toTrig(s.a), toTrig(s.b)))
    givenPairs = [
      [names.a, s.a],
      [names.b, s.b],
    ]
    traps = coreSlips('x', [s.a, s.b], null)
    const co = coefficientSlip('x', s.a.rad > 1 ? s.a : s.b, s.a.rad > 1 ? s.b : s.a, true)
    if (co) traps.push(co)
    reveal = sideReveal(names.c, [s.a, s.b], null, answer, [names.a, names.b], names.c)
    askedName = names.c
  } else {
    // A leg from the other leg and the hypotenuse.
    const leg = asked
    const other = leg === 'a' ? s.b : s.a
    if (!givable(other) || !givable(s.c)) return null
    answer = fromTrig(legOf(toTrig(other), toTrig(s.c)))
    givenPairs = [
      [leg === 'a' ? names.b : names.a, other],
      [names.c, s.c],
    ]
    traps = coreSlips('x', null, [other, s.c])
    const co = other.rad > 1 ? coefficientSlip('x', other, s.c, false) : null
    if (co) traps.push(co)
    askedName = leg === 'a' ? names.a : names.b
    reveal = sideReveal(askedName, null, [other, s.c], answer, [leg === 'a' ? names.b : names.a, ''], names.c)
  }
  if (answer.rad > 60) return null
  const labels: Record<string, string> = { [askedName]: 'x' }
  for (const [nm, v] of givenPairs) labels[nm] = qSay(v)
  const [pP, pQ, pR] = placeAll(
    [
      { x: approxQ(s.a), y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: approxQ(s.b) },
    ],
    rng.int(0, 359),
    rng.chance(0.5),
  ) as [P2, P2, P2]
  if (smallestAngle(pP, pQ, pR) < 15) return null
  const center = centerOf([pP, pQ, pR])
  const segments: GeoSegment[] = [
    { from: P, to: Q, label: labels[names.a]! },
    { from: Q, to: R, label: labels[names.b]! },
    { from: P, to: R, label: labels[names.c]! },
  ]
  const aria = `Right triangle ${P}${Q}${R} with the right angle at ${Q}. ${segments.map((sg) => `${sg.from}${sg.to} is labeled ${sg.label}`).join(', ').replace(/, ([^,]*)$/, ', and $1')}.`
  const figure = placeLabels7(
    { ariaLabel: aria, points: [pointOf(P, pP, center), pointOf(Q, pQ, center), pointOf(R, pR, center)], segments, angles: [{ vertex: Q, from: P, to: R, right: true }] },
    [[P, Q, R]],
  )
  if (!figure) return null
  const givenText = givenPairs.map(([nm, v]) => `${nm} = ${qSay(v)}`)
  const prompt = `In right triangle ${P}${Q}${R}, ∠${P}${Q}${R} is a right angle, ${givenText[0]}, and ${givenText[1]}. Find x, the length of ${askedName}.`
  const stage = exactStage7({
    id: 'x',
    label: 'x',
    hint: EXACT_HINT7,
    answer,
    nudge: hypAsked ? `${names.c} is across from the right angle, so it is the hypotenuse.` : `${names.c} is across from the right angle, so it is the hypotenuse, and x is a leg.`,
    ruleCard: UNIT7_RULE_IDS.pythagorean,
    reveal: [reveal],
    traps,
    givens: givenPairs.map(([, v]) => v),
  })
  return sideFinish('triangle', prompt, figure, [stage], givenPairs.map(([, v]) => v), { hyp: hypAsked })
}

function sideRectangle(rng: Rng): GeoBuilt | null {
  const s = rightSides(rng, 60, false)
  if (!s || !isWholeQ(s.a)) return null
  const ratio = approxQ(s.b) / approxQ(s.a)
  if (ratio < 0.36 || ratio > 2.8) return null
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  const diagAsked = rng.chance(0.55)
  const w = s.a
  const h = s.b
  const d = s.c
  const ab = `${A}${B}`
  const bc = `${B}${C}`
  const ac = `${A}${C}`
  let answer: GeoQty
  let traps: TrapDraft7[]
  let prompt: string
  let reveal: string
  const labels: Record<string, string> = {}
  let givens: GeoQty[]
  if (diagAsked) {
    if (!givable(h)) return null
    answer = d
    traps = coreSlips('x', [w, h], null)
    labels[ab] = qSay(w)
    labels[bc] = qSay(h)
    labels[ac] = 'x'
    prompt = `${A}${B}${C}${D} is a rectangle with ${ab} = ${qSay(w)} and ${bc} = ${qSay(h)}. Find x, the length of diagonal ${ac}.`
    reveal = sideReveal(ac, [w, h], null, d, [ab, bc], ac)
    givens = [w, h]
  } else {
    if (!givable(d)) return null
    answer = h
    traps = coreSlips('x', null, [w, d])
    labels[ab] = qSay(w)
    labels[bc] = 'x'
    labels[ac] = qSay(d)
    prompt = `${A}${B}${C}${D} is a rectangle with ${ab} = ${qSay(w)} and diagonal ${ac} = ${qSay(d)}. Find x, the length of ${bc}.`
    reveal = sideReveal(bc, null, [w, d], h, [ab, ''], ac)
    givens = [w, d]
  }
  const W = approxQ(w)
  const H = approxQ(h)
  const pts = placeAll(
    [
      { x: -W / 2, y: -H / 2 },
      { x: W / 2, y: -H / 2 },
      { x: W / 2, y: H / 2 },
      { x: -W / 2, y: H / 2 },
    ],
    rng.int(-40, 40) + (rng.chance(0.3) ? 90 : 0),
    rng.chance(0.5),
  ) as [P2, P2, P2, P2]
  const center = centerOf(pts)
  const segments: GeoSegment[] = [
    { from: A, to: B, label: labels[ab]! },
    { from: B, to: C, label: labels[bc]! },
    { from: C, to: D },
    { from: D, to: A },
    { from: A, to: C, label: labels[ac]! },
  ]
  const aria = `Rectangle ${A}${B}${C}${D} with diagonal ${ac} and a right-angle mark at ${B}. ${ab} is labeled ${labels[ab]}, ${bc} is labeled ${labels[bc]}, and ${ac} is labeled ${labels[ac]}.`
  const figure = placeLabels7(
    {
      ariaLabel: aria,
      points: [A, B, C, D].map((id, i) => pointOf(id, pts[i]!, center)),
      segments,
      angles: [{ vertex: B, from: A, to: C, right: true }],
    },
    [[A, B, C, D]],
  )
  if (!figure) return null
  const stage = exactStage7({
    id: 'x',
    label: 'x',
    hint: EXACT_HINT7,
    answer,
    nudge: `The diagonal ${ac} cuts the rectangle into two right triangles. In triangle ${A}${B}${C}, the right angle is at ${B}.`,
    ruleCard: UNIT7_RULE_IDS.inside,
    reveal: [reveal],
    traps,
    givens,
  })
  return sideFinish('rectangle', prompt, figure, [stage], givens, { diagonal: diagAsked })
}

function sideIsosceles(rng: Rng): GeoBuilt | null {
  // Right triangle ABD: legs BD = m (half the base) and AD = t, hypotenuse AB = s. The base BC is given in the
  // prompt only: a label at its middle would sit as near the foot D of the altitude as the base itself.
  const s3 = rightSides(rng, 40, false)
  if (!s3) return null
  const m = s3.a
  const t = s3.b
  const s = s3.c
  if (!isWholeQ(m)) return null
  const base = int(2 * m.n)
  const kind = rng.pick(['alt', 'leg', 'base'] as const)
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  const ab = `${A}${B}`
  const ac = `${A}${C}`
  const bc = `${B}${C}`
  const ad = `${A}${D}`
  const bd = `${B}${D}`
  let legLabel: string
  let altLabel: string
  let answer: GeoQty
  let traps: TrapDraft7[] = []
  let prompt: string
  let reveal: string
  let givens: GeoQty[]
  let partId: 'x' | 'result' = 'x'
  let partLabel = 'x'
  const halfW = `That uses all of ${bc} as a leg. The altitude ${ad} cuts the base in half, so the right triangle ${A}${B}${D} has the leg ${bd}, half of ${bc}.`
  const rooted = rootSay
  if (kind === 'alt') {
    if (!givable(s)) return null
    answer = t
    traps = coreSlips('x', null, [m, s])
    const whole = sq(s) - sq(base)
    if (whole > 0) traps.push({ id: 'geo_half_not_taken', stage: 'x', value: sqrtQ(whole), witness: halfW })
    legLabel = qSay(s)
    altLabel = 'x'
    prompt = `In isosceles triangle ${A}${B}${C}, ${ab} = ${ac} = ${qSay(s)} and the base ${bc} = ${base.n}. ${ad} is the altitude to the base. Find x, the length of ${ad}.`
    reveal = `The altitude to the base bisects it, so ${bd} = ${m.n}. In right triangle ${A}${B}${D}, ${ad}² = ${ab}² − ${bd}² = ${sq(s)} − ${sq(m)} = ${sq(t)}, so ${ad} = ${rooted(t)}.`
    givens = [s, base]
  } else if (kind === 'leg') {
    if (!givable(t)) return null
    answer = s
    traps = coreSlips('x', [m, t], null)
    traps.push({ id: 'geo_half_not_taken', stage: 'x', value: sqrtQ(sq(t) + sq(base)), witness: halfW })
    legLabel = 'x'
    altLabel = qSay(t)
    prompt = `In isosceles triangle ${A}${B}${C}, ${ab} = ${ac} and the base ${bc} = ${base.n}. The altitude to the base is ${ad} = ${qSay(t)}. Find x, the length of ${ab}.`
    reveal = `The altitude to the base bisects it, so ${bd} = ${m.n}. In right triangle ${A}${B}${D}, ${ab}² = ${bd}² + ${ad}² = ${sq(m)} + ${sq(t)} = ${sq(s)}, so ${ab} = ${rooted(s)}.`
    givens = [base, t]
  } else {
    if (!givable(s) || !givable(t)) return null
    answer = base
    partId = 'result'
    partLabel = bc
    traps.push({
      id: 'geo_half_for_whole',
      stage: 'result',
      value: m,
      witness: `That is ${bd}, one half of the base. The altitude cuts ${bc} into two equal pieces, so ${bc} is twice ${bd}.`,
    })
    const added = sqrtQ(sq(s) + sq(t))
    traps.push({
      id: 'trig_pythag_added',
      stage: 'result',
      value: rad(2 * added.n, added.d, added.rad),
      witness: `That adds the squares of ${qSay(s)} and ${qSay(t)}, but ${ab} is the hypotenuse of right triangle ${A}${B}${D}. Subtract to find the leg ${bd}.`,
    })
    legLabel = qSay(s)
    altLabel = qSay(t)
    prompt = `In isosceles triangle ${A}${B}${C}, ${ab} = ${ac} = ${qSay(s)}. The altitude to the base is ${ad} = ${qSay(t)}. Find the length of the base ${bc}.`
    reveal = `In right triangle ${A}${B}${D}, ${bd}² = ${ab}² − ${ad}² = ${sq(s)} − ${sq(t)} = ${sq(m)}, so ${bd} = ${m.n}. The altitude bisects the base, so ${bc} = 2 · ${m.n} = ${base.n}.`
    givens = [s, t]
  }
  const M = approxQ(m)
  const T = approxQ(t)
  const pts = placeAll(
    [
      { x: 0, y: T * 0.6 },
      { x: -M, y: -T * 0.4 },
      { x: M, y: -T * 0.4 },
      { x: 0, y: -T * 0.4 },
    ],
    rng.int(-35, 35) + (rng.chance(0.25) ? 180 : 0),
    false,
  ) as [P2, P2, P2, P2]
  if (smallestAngle(pts[0], pts[1], pts[2]) < 16) return null
  const center = centerOf([pts[0], pts[1], pts[2]])
  // Both legs carry the same label: the figure says AB = AC the way the prompt does.
  const segments: GeoSegment[] = [
    { from: A, to: B, label: legLabel },
    { from: A, to: C, label: legLabel },
    { from: B, to: C },
    { from: A, to: D, label: altLabel },
  ]
  const aria = `Isosceles triangle ${A}${B}${C} with the altitude ${ad} to the base ${bc}, and a right-angle mark at ${D}. ${ab} and ${ac} are each labeled ${legLabel}, and ${ad} is labeled ${altLabel}.`
  const figure = placeLabels7(
    {
      ariaLabel: aria,
      points: [pointOf(A, pts[0], center), pointOf(B, pts[1], center), pointOf(C, pts[2], center), pointOf(D, pts[3], pts[0])],
      segments,
      angles: [{ vertex: D, from: C, to: A, right: true }],
    },
    [[A, B, C]],
  )
  if (!figure) return null
  const stage = exactStage7({
    id: partId,
    label: partLabel,
    hint: EXACT_HINT7,
    answer,
    nudge: `The altitude to the base of an isosceles triangle bisects the base. Work in right triangle ${A}${B}${D}.`,
    ruleCard: UNIT7_RULE_IDS.inside,
    reveal: [reveal],
    traps,
    givens,
  })
  return sideFinish('isosceles', prompt, figure, [stage], givens, { form: kind })
}

function sideRhombus(rng: Rng): GeoBuilt | null {
  // Right triangle ABE: legs AE = u and BE = v (halves of the diagonals), hypotenuse AB = s.
  const s3 = rightSides(rng, 40, false)
  if (!s3 || !isWholeQ(s3.a) || !isWholeQ(s3.b)) return null
  const u = s3.a
  const v = s3.b
  const s = s3.c
  const ratio = v.n / u.n
  if (ratio < 0.4 || ratio > 2.5) return null
  const kind = rng.chance(0.55) ? 'side' : 'diag'
  const [A, B, C, D, E] = pickLetters6(rng, 5) as [string, string, string, string, string]
  const ab = `${A}${B}`
  const ac = `${A}${C}`
  const bd = `${B}${D}`
  const d1 = int(2 * u.n)
  const d2 = int(2 * v.n)
  let answer: GeoQty
  let traps: TrapDraft7[] = []
  let prompt: string
  let reveal: string
  let label: string
  let partLabel: string
  let givens: GeoQty[]
  if (kind === 'side') {
    answer = s
    traps = coreSlips('x', [u, v], null)
    traps.unshift({
      id: 'geo_half_not_taken',
      stage: 'x',
      value: sqrtQ(sq(d1) + sq(d2)),
      witness: `That uses the whole diagonals as legs. The diagonals of a rhombus bisect each other, so the legs of right triangle ${A}${B}${E} are ${A}${E} and ${B}${E}, half of each diagonal.`,
    })
    label = 'x'
    partLabel = 'x'
    prompt = `The diagonals of rhombus ${A}${B}${C}${D} meet at ${E}, with ${ac} = ${d1.n} and ${bd} = ${d2.n}. Find x, the length of ${ab}.`
    reveal = `The diagonals of a rhombus bisect each other at right angles, so ${A}${E} = ${u.n} and ${B}${E} = ${v.n}. Then ${ab}² = ${sq(u)} + ${sq(v)} = ${sq(s)}, so ${ab} = ${rootSay(s)}.`
    givens = [d1, d2]
  } else {
    if (!givable(s)) return null
    answer = d2
    traps.push({
      id: 'geo_half_for_whole',
      stage: 'result',
      value: v,
      witness: `That is ${B}${E}, half of ${bd}. The diagonals of a rhombus bisect each other, so ${bd} is twice ${B}${E}.`,
    })
    const whole = sq(s) - sq(d1)
    if (whole > 0) {
      const w = sqrtQ(whole)
      traps.push({ id: 'geo_half_not_taken', stage: 'result', value: rad(2 * w.n, w.d, w.rad), witness: `That uses all of ${ac} as a leg. The diagonals bisect each other, so the leg of right triangle ${A}${B}${E} is ${A}${E}, half of ${ac}.` })
    }
    const added = sqrtQ(sq(s) + sq(u))
    traps.push({ id: 'trig_pythag_added', stage: 'result', value: rad(2 * added.n, added.d, added.rad), witness: `That adds the squares, but ${ab} is the hypotenuse of right triangle ${A}${B}${E}. Subtract to find the leg ${B}${E}.` })
    label = qSay(s)
    partLabel = bd
    prompt = `Rhombus ${A}${B}${C}${D} has sides of length ${qSay(s)}, and its diagonals meet at ${E}. The diagonal ${ac} = ${d1.n}. Find ${bd}.`
    reveal = `The diagonals of a rhombus bisect each other at right angles, so ${A}${E} = ${u.n}. In right triangle ${A}${B}${E}, ${B}${E}² = ${sq(s)} − ${sq(u)} = ${sq(v)}, so ${B}${E} = ${v.n} and ${bd} = 2 · ${v.n} = ${d2.n}.`
    givens = [s, d1]
  }
  const U = approxQ(u)
  const V = approxQ(v)
  const pts = placeAll(
    [
      { x: -U, y: 0 },
      { x: 0, y: V },
      { x: U, y: 0 },
      { x: 0, y: -V },
      { x: 0, y: 0 },
    ],
    rng.int(-30, 30),
    rng.chance(0.5),
  ) as [P2, P2, P2, P2, P2]
  const center = pts[4]
  const segments: GeoSegment[] = [
    { from: A, to: B, label },
    { from: B, to: C },
    { from: C, to: D },
    { from: D, to: A },
    { from: A, to: C },
    { from: B, to: D },
  ]
  const aria = `Rhombus ${A}${B}${C}${D} with diagonals ${ac} and ${bd} meeting at ${E}, with a right-angle mark at ${E}. ${ab} is labeled ${label}.`
  const points: GeoPoint[] = [A, B, C, D].map((id, i) => pointOf(id, pts[i]!, center))
  points.push(pointOf(E, pts[4], { x: (pts[1].x + pts[2].x) / 2 + 1e-6, y: (pts[1].y + pts[2].y) / 2 }))
  const figure = placeLabels7({ ariaLabel: aria, points, segments, angles: [{ vertex: E, from: A, to: B, right: true }] }, [[A, B, C, D]])
  if (!figure) return null
  const stage = exactStage7({
    id: kind === 'side' ? 'x' : 'result',
    label: partLabel,
    hint: EXACT_HINT7,
    answer,
    nudge: `The diagonals of a rhombus are perpendicular and bisect each other. Work in right triangle ${A}${B}${E}.`,
    ruleCard: UNIT7_RULE_IDS.inside,
    reveal: [reveal],
    traps,
    givens,
  })
  return sideFinish('rhombus', prompt, figure, [stage], givens, { form: kind })
}

const coord = (n: number) => (n < 0 ? `−${-n}` : `${n}`)

function sideGrid(rng: Rng): GeoBuilt | null {
  const x1 = rng.int(-8, 6)
  const y1 = rng.int(-8, 6)
  const dx = rng.int(1, 12) * (rng.chance(0.5) ? 1 : -1)
  const dy = rng.int(1, 12) * (rng.chance(0.5) ? 1 : -1)
  const x2 = x1 + dx
  const y2 = y1 + dy
  if (Math.abs(x2) > 10 || Math.abs(y2) > 10) return null
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax + ay < 5) return null
  const answer = sqrtQ(ax * ax + ay * ay)
  const [P, Q, R] = pickLetters6(rng, 3) as [string, string, string]
  const traps: TrapDraft7[] = [
    {
      id: 'geo_distance_not_squared',
      stage: 'result',
      value: int(ax + ay),
      witness: `That adds the changes in x and y, ${ax} + ${ay}, which walks the grid. The distance is the hypotenuse: square each change, add, then take the square root.`,
    },
    {
      id: 'geo_distance_no_root',
      stage: 'result',
      value: int(ax * ax + ay * ay),
      witness: `That is ${ax}² + ${ay}², the square of the distance. Take its square root.`,
    },
  ]
  const ptLabel = (id: string, x: number, y: number) => `${id} (${coord(x)}, ${coord(y)})`
  const points: GeoPoint[] = [
    { id: P, x: x1, y: y1, label: ptLabel(P, x1, y1), labelSide: y1 >= y2 ? 'above' : 'below' },
    { id: Q, x: x2, y: y2, label: ptLabel(Q, x2, y2), labelSide: y2 > y1 ? 'above' : 'below' },
    { id: R, x: x2, y: y1, label: '' },
  ]
  const figure: GeoFigureSpec = {
    ariaLabel: `Point ${P} at (${coord(x1)}, ${coord(y1)}) and point ${Q} at (${coord(x2)}, ${coord(y2)}) on a coordinate grid, joined by a segment, with a right triangle whose legs run along the grid lines and a right-angle mark at the corner (${coord(x2)}, ${coord(y1)}).`,
    grid: { xMin: Math.min(x1, x2) - 1, xMax: Math.max(x1, x2) + 1, yMin: Math.min(y1, y2) - 1, yMax: Math.max(y1, y2) + 1 },
    points,
    segments: [
      { from: P, to: R },
      { from: R, to: Q },
      { from: P, to: Q },
    ],
    angles: [{ vertex: R, from: P, to: Q, right: true } satisfies GeoAngleMark],
  }
  const placed = placeLabels7(figure, [])
  if (!placed) return null
  const stage = exactStage7({
    id: 'result',
    label: `${P}${Q}`,
    hint: EXACT_HINT7,
    answer,
    nudge: 'The segment is the hypotenuse of a right triangle whose legs run along the grid. Count the legs, then use the Pythagorean Theorem.',
    ruleCard: UNIT7_RULE_IDS.distance,
    reveal: [`The legs of the right triangle are ${ax} and ${ay}, so ${P}${Q} = √(${ax}² + ${ay}²) = √${ax * ax + ay * ay}${isWholeQ(answer) ? ` = ${answer.n}` : answer.n > 1 ? ` = ${qSay(answer)}` : ''}.`],
    traps,
    givens: [int(Math.abs(x1)), int(Math.abs(y1)), int(Math.abs(x2)), int(Math.abs(y2))].filter((g) => g.n > 0),
  })
  const prompt = `Find the distance between ${P}(${coord(x1)}, ${coord(y1)}) and ${Q}(${coord(x2)}, ${coord(y2)}).`
  return sideFinish('grid', prompt, placed, [stage], [], { dx: ax, dy: ay })
}

function sideFinish(kind: SideCase, prompt: string, figure: GeoFigureSpec, stages: Stage7[], givens: GeoQty[], params: Record<string, string | number | boolean>): GeoBuilt | null {
  return finish7({
    question: 'pythagorean',
    prompt,
    figure,
    stages,
    lengths: givens.filter((g) => isWholeQ(g)).map((g) => g.n),
    title: kind === 'grid' ? 'Distance on the grid' : 'Finding a missing side',
    instructions: SIDE_INSTRUCTIONS,
    params: { case: kind, ...params },
    cards: PYTHAGOREAN_RULES,
    promise: [],
  })
}

/** A seeded order of the slips to promise, so every slip is promised on some seed. */
function withPromise(built: GeoBuilt | null, rng: Rng, ids: ErrorPatternId[]): GeoBuilt | null {
  if (!built) return null
  const order = rng.shuffle(ids)
  const traps = built.answer.stages.flatMap((s) => s.traps.map((t) => ({ ...t, stage: s.id })))
  const hit = order.map((id) => traps.find((t) => t.id === id)).find(Boolean)
  if (!hit) return built
  return { ...built, answer: { ...built.answer, trap: hit.id, trapStage: hit.stage, trapAnswer: hit.text } }
}

export function drawPythSide(seed: number): GeoBuilt {
  const kind = weighted<SideCase>(makeRng(mixSeed(seed, 7300)), [
    ['triangle', 40],
    ['rectangle', 15],
    ['isosceles', 15],
    ['rhombus', 15],
    ['grid', 15],
  ])
  for (let attempt = 0; attempt < 600; attempt++) {
    const rng = makeRng(mixSeed(seed, 7301 + attempt))
    const built =
      kind === 'triangle' ? sideTriangle(rng) : kind === 'rectangle' ? sideRectangle(rng) : kind === 'isosceles' ? sideIsosceles(rng) : kind === 'rhombus' ? sideRhombus(rng) : sideGrid(rng)
    const promised = withPromise(built, rng, ['trig_pythag_added', 'trig_pythag_subtracted', 'trig_side_not_rooted', 'geo_coefficient_not_squared', 'geo_half_not_taken', 'geo_half_for_whole', 'geo_distance_not_squared', 'geo_distance_no_root'])
    if (promised) return promised
  }
  throw new Error(`py.side/${seed}: no ${kind} problem`)
}

// =================================================================================================================
// py.classify
// =================================================================================================================

export type TriClass = 'acute' | 'right' | 'obtuse' | 'none'

export const CLASS_TEXT: Record<TriClass, string> = { acute: 'Acute', right: 'Right', obtuse: 'Obtuse', none: 'Not a triangle' }

/** The class of three lengths, exactly: the Triangle Inequality first, then the longest square against the other two. */
export function classify(sides: readonly GeoQty[], square: (q: GeoQty) => number = sq): TriClass {
  const sorted = [...sides].sort((p, q) => approxQ(p) - approxQ(q))
  const [a, b, c] = sorted as [GeoQty, GeoQty, GeoQty]
  if (approxQ(a) + approxQ(b) <= approxQ(c) + 1e-9) return 'none'
  const lhs = square(c)
  const rhs = square(a) + square(b)
  return lhs === rhs ? 'right' : lhs < rhs ? 'acute' : 'obtuse'
}

function classSides(rng: Rng, want: TriClass): GeoQty[] | null {
  const radicalOne = rng.chance(0.3)
  if (want === 'right') {
    if (rng.chance(0.6)) {
      const t = tripleDraw(rng, 60)
      return t ? t.map(int) : null
    }
    if (rng.chance(0.5)) {
      const a = rng.int(2, 12)
      const b = rng.int(2, 12)
      const c = sqrtQ(a * a + b * b)
      return c.rad === 1 ? null : [int(a), int(b), c]
    }
    const c = rng.int(3, 15)
    const a = rng.int(2, c - 1)
    const b = sqrtQ(c * c - a * a)
    return b.rad === 1 ? null : [int(a), b, int(c)]
  }
  if (want === 'none') {
    const a = rng.int(2, 14)
    const b = rng.int(2, 14)
    const c = a + b + (rng.chance(0.2) ? 0 : rng.int(1, 8))
    if (c > 40) return null
    if (radicalOne && rng.chance(0.5)) {
      // A radical that is still short: √r with r < a², so the two shorter lengths stay short of c.
      const r = rng.pick([2, 3, 5, 6, 7, 10, 11, 13])
      if (r >= a * a) return null
      return [rad(1, 1, r), int(b), int(c + 1)]
    }
    return [int(a), int(b), int(c)]
  }
  const lengths = [rng.int(2, 30), rng.int(2, 30), rng.int(2, 30)].sort((p, q) => p - q) as [number, number, number]
  let sides: GeoQty[] = lengths.map(int)
  if (radicalOne) {
    const k = rng.int(1, 5)
    const r = rng.pick([2, 3, 5, 6, 7])
    const i = rng.int(0, 2)
    sides = sides.map((s, j) => (j === i ? rad(k, 1, r) : s))
  }
  return classify(sides) === want ? sides : null
}

/** Each wrong pick that is exactly a named slip on these lengths, with its sentence. */
function classifyTraps(listed: readonly GeoQty[], answer: TriClass): Partial<Record<TriClass, { id: ErrorPatternId; witness: string }>> {
  const out: Partial<Record<TriClass, { id: ErrorPatternId; witness: string }>> = {}
  const sorted = [...listed].sort((p, q) => approxQ(p) - approxQ(q))
  const [a, b, c] = sorted as [GeoQty, GeoQty, GeoQty]
  const say = qSay
  if (answer === 'none') {
    const exact = Math.abs(approxQ(a) + approxQ(b) - approxQ(c)) < 1e-9
    const w = `The two shorter lengths, ${say(a)} and ${say(b)}, add up to ${exact ? `exactly ${say(c)}` : `less than ${say(c)}`}, so their ends cannot meet. Check the Triangle Inequality before you compare squares.`
    for (const k of ['acute', 'right', 'obtuse'] as const) out[k] = { id: 'geo_triangle_inequality_skipped', witness: w }
    return out
  }
  // (k√r)² taken as k · r for a side with a number in front of its radical.
  const radSide = listed.find((s) => s.rad > 1 && s.n > 1 && s.d === 1)
  if (radSide) {
    const wrong = classify(listed, (s) => (s === radSide ? s.n * s.rad : sq(s)))
    if (wrong !== answer && wrong !== 'none' && !out[wrong]) {
      out[wrong] = {
        id: 'geo_coefficient_not_squared',
        witness: `That squares ${say(radSide)} as ${radSide.n} · ${radSide.rad} = ${radSide.n * radSide.rad}. Square the ${radSide.n} too: ${sqSay(radSide)} = ${radSide.n * radSide.n} · ${radSide.rad} = ${sq(radSide)}.`,
      }
    }
  }
  const last = listed[listed.length - 1]!
  const longestLast = approxQ(last) >= approxQ(c) - 1e-9
  if ((answer === 'right' || answer === 'obtuse') && !longestLast && !out.acute) {
    out.acute = {
      id: 'geo_converse_wrong_side',
      witness: `That compares the square of ${say(last)}, the last length listed, with the other two. The longest length is ${say(c)}: compare ${sqSay(c)} with the sum of the squares of the other two.`,
    }
  }
  const lhs = sq(c)
  const rhs = sq(a) + sq(b)
  const swapped: TriClass | null = answer === 'acute' ? 'obtuse' : answer === 'obtuse' ? 'acute' : null
  if (swapped && !out[swapped]) {
    out[swapped] = {
      id: 'geo_acute_obtuse_swapped',
      witness: `Here ${sqSay(c)} = ${lhs} and ${sqSay(a)} + ${sqSay(b)} = ${rhs}, so the square of the longest side is the ${lhs > rhs ? 'larger' : 'smaller'} one. That pick reads the comparison the other way round.`,
    }
  }
  return out
}

export function classifyProblem(listed: GeoQty[], seed: number, promiseFirst: ErrorPatternId | null): GeoBuilt | null {
  const answer = classify(listed)
  const traps = classifyTraps(listed, answer)
  const sorted = [...listed].sort((p, q) => approxQ(p) - approxQ(q))
  const [a, b, c] = sorted as [GeoQty, GeoQty, GeoQty]
  const say = qSay
  const reveal =
    answer === 'none'
      ? [`The two shorter lengths, ${say(a)} and ${say(b)}, add up to no more than ${say(c)}, so by the Triangle Inequality no triangle has these sides.`]
      : [
          `The two shorter lengths add up to more than ${say(c)}, so the lengths make a triangle. The longest length is ${say(c)}, and ${sqSay(c)} = ${sq(c)} while ${sqSay(a)} + ${sqSay(b)} = ${sq(a)} + ${sq(b)} = ${sq(a) + sq(b)}.`,
          answer === 'right'
            ? `They are equal, so by the converse of the Pythagorean Theorem the triangle is right.`
            : `Since ${sq(c)} ${answer === 'acute' ? '<' : '>'} ${sq(a) + sq(b)}, the triangle is ${answer}.`,
        ]
  const stage = choiceStage7({
    id: 'result',
    label: 'Classification',
    choices: (['acute', 'right', 'obtuse', 'none'] as const).map((k) => ({ id: k, text: CLASS_TEXT[k], ...(traps[k] ? { trap: traps[k]!.id, witness: traps[k]!.witness } : {}) })),
    answerId: answer,
    nudge: 'Check the Triangle Inequality first. Then compare the square of the longest length with the sum of the squares of the other two.',
    ruleCard: UNIT7_RULE_IDS.acuteObtuse,
    reveal,
    seed,
    salt: 7400,
    keepOrder: true,
  })
  const texts = listed.map(say)
  const prompt = `Can segments with lengths ${texts[0]}, ${texts[1]}, and ${texts[2]} form a triangle? If they can, classify the triangle by its angles.`
  return finish7({
    question: 'pythagoreanConverse',
    prompt,
    figure: { points: [], ariaLabel: '' },
    stages: [stage],
    lengths: listed.filter((s) => isWholeQ(s)).map((s) => s.n),
    title: 'Acute, right, or obtuse',
    instructions: CLASSIFY_INSTRUCTIONS,
    params: { case: answer, lengths: texts.join(', ') },
    cards: PYTHAGOREAN_RULES,
    promise: promiseFirst ? [promiseFirst, 'geo_converse_wrong_side', 'geo_triangle_inequality_skipped', 'geo_coefficient_not_squared', 'geo_acute_obtuse_swapped'] : [],
  })
}

export function drawClassify7(seed: number): GeoBuilt {
  const want = (['acute', 'right', 'obtuse', 'none'] as const)[makeRng(mixSeed(seed, 7400)).int(0, 3)]!
  for (let attempt = 0; attempt < 600; attempt++) {
    const rng = makeRng(mixSeed(seed, 7401 + attempt))
    const sides = classSides(rng, want)
    if (!sides) continue
    // The longest length is listed last about a third of the time. A right triangle listed that way leaves no slip to
    // name (only the last length taken as c gives one), so its hypotenuse moves earlier in the list.
    let listed = rng.shuffle(sides)
    if (want === 'right' && Object.keys(classifyTraps(listed, 'right')).length === 0) {
      const longest = listed.reduce((best, s, i) => (approxQ(s) > approxQ(listed[best]!) ? i : best), 0)
      const rest = listed.filter((_, i) => i !== longest)
      listed = rng.chance(0.5) ? [listed[longest]!, ...rest] : [rest[0]!, listed[longest]!, rest[1]!]
    }
    const first = rng.pick<ErrorPatternId>(['geo_converse_wrong_side', 'geo_acute_obtuse_swapped', 'geo_coefficient_not_squared'])
    const built = classifyProblem(listed, seed, first)
    if (built) return built
  }
  throw new Error(`py.classify/${seed}: no ${want} problem`)
}

// =================================================================================================================
// py.apply
// =================================================================================================================

interface UnitWords {
  unit: LengthUnit7
  many: string
  one: string
  /** "a foot", "an inch": for "the nearest tenth of a foot". */
  article: string
}

const UNITS: Record<LengthUnit7, UnitWords> = {
  ft: { unit: 'ft', many: 'feet', one: 'foot', article: 'a foot' },
  in: { unit: 'in', many: 'inches', one: 'inch', article: 'an inch' },
  m: { unit: 'm', many: 'meters', one: 'meter', article: 'a meter' },
  yd: { unit: 'yd', many: 'yards', one: 'yard', article: 'a yard' },
  km: { unit: 'km', many: 'kilometers', one: 'kilometer', article: 'a kilometer' },
  mi: { unit: 'mi', many: 'miles', one: 'mile', article: 'a mile' },
}

function roundingSentence(places: Places, u: UnitWords): string {
  if (places === 0) return `Round to the nearest ${u.one}.`
  return `Round to the nearest ${places === 1 ? 'tenth' : 'hundredth'} of ${u.article}.`
}

type Story = 'ladder' | 'screen' | 'ramp' | 'field' | 'kite' | 'ship'

/** One story: its right triangle (two legs and the hypotenuse, whole numbers where given), what is asked, the words. */
interface StoryDraw {
  story: Story
  unit: UnitWords
  /** Leg along the ground or the width, leg up the wall or the height, and the hypotenuse. */
  legs: [number, number] | null
  leg: number | null
  hyp: number | null
  /** Asked: the hypotenuse, or the first or second leg. */
  asked: 'hyp' | 'leg0' | 'leg1'
  prompt: string
  label: string
  /** The scene's three corners (the right angle at index 1) before mirroring, and the side names for the figure. */
  shape: 'triangle' | 'rectangle'
  dir?: { north: boolean; east: boolean }
}

function storyDraw(rng: Rng): StoryDraw | null {
  const story = weighted<Story>(rng, [
    ['ladder', 20],
    ['screen', 15],
    ['ramp', 15],
    ['field', 15],
    ['kite', 15],
    ['ship', 20],
  ])
  const pick = (lo: number, hi: number) => rng.int(lo, hi)
  if (story === 'ladder') {
    const u = UNITS.ft
    const form = rng.pick(['height', 'length', 'foot'] as const)
    if (form === 'height') {
      const L = pick(10, 40)
      const d = pick(3, Math.max(3, Math.floor(L / 2.6)))
      return { story, unit: u, legs: null, leg: d, hyp: L, asked: 'leg1', prompt: `A ladder ${L} feet long leans against a wall, and its foot is ${d} feet from the base of the wall. How high up the wall does the ladder reach?`, label: 'Height', shape: 'triangle' }
    }
    if (form === 'length') {
      const h = pick(8, 36)
      const d = pick(3, Math.max(3, Math.floor(h / 2.2)))
      return { story, unit: u, legs: [d, h], leg: null, hyp: null, asked: 'hyp', prompt: `The top of a ladder rests against a wall ${h} feet above the ground, and its foot is ${d} feet from the base of the wall. How long is the ladder?`, label: 'Ladder', shape: 'triangle' }
    }
    const L = pick(10, 40)
    const h = pick(Math.ceil(L * 0.72), L - 1)
    return { story, unit: u, legs: null, leg: h, hyp: L, asked: 'leg0', prompt: `A ladder ${L} feet long leans against a wall and reaches ${h} feet up the wall. How far is the foot of the ladder from the base of the wall?`, label: 'Distance', shape: 'triangle' }
  }
  if (story === 'screen') {
    const u = UNITS.in
    if (rng.chance(0.6)) {
      const w = pick(14, 60)
      const t = pick(Math.ceil(w * 0.5), Math.floor(w * 0.8))
      return { story, unit: u, legs: [w, t], leg: null, hyp: null, asked: 'hyp', prompt: `A ${w <= 30 ? 'computer' : 'television'} screen is ${w} inches wide and ${t} inches tall. How long is its diagonal?`, label: 'Diagonal', shape: 'rectangle' }
    }
    const D = pick(15, 70)
    const w = pick(Math.ceil(D * 0.78), Math.floor(D * 0.9))
    return { story, unit: u, legs: null, leg: w, hyp: D, asked: 'leg1', prompt: `A ${D <= 34 ? 'computer' : 'television'} screen has a diagonal of ${D} inches and is ${w} inches wide. How tall is the screen?`, label: 'Height', shape: 'rectangle' }
  }
  if (story === 'ramp') {
    const u = UNITS.ft
    if (rng.chance(0.6)) {
      const r = pick(2, 8)
      const run = pick(Math.ceil(r * 2.2), Math.floor(r * 4))
      return { story, unit: u, legs: [run, r], leg: null, hyp: null, asked: 'hyp', prompt: `A ramp rises ${r} feet over a horizontal distance of ${run} feet. How long is the ramp?`, label: 'Ramp', shape: 'triangle' }
    }
    const r = pick(2, 8)
    const s = pick(Math.ceil(r * 2.4), Math.floor(r * 4.2))
    return { story, unit: u, legs: null, leg: r, hyp: s, asked: 'leg0', prompt: `A ramp ${s} feet long rises ${r} feet. How far does it run along the ground?`, label: 'Run', shape: 'triangle' }
  }
  if (story === 'field') {
    const u = rng.chance(0.6) ? UNITS.m : UNITS.yd
    if (rng.chance(0.65)) {
      const a = pick(40, 150)
      const b = pick(Math.ceil(a * 0.4), Math.floor(a * 0.9))
      return { story, unit: u, legs: [a, b], leg: null, hyp: null, asked: 'hyp', prompt: `A rectangular field is ${a} ${u.many} long and ${b} ${u.many} wide. How long is a straight path from one corner of the field to the opposite corner?`, label: 'Path', shape: 'rectangle' }
    }
    const d = pick(60, 180)
    const a = pick(Math.ceil(d * 0.72), Math.floor(d * 0.9))
    return { story, unit: u, legs: null, leg: a, hyp: d, asked: 'leg1', prompt: `A straight path ${d} ${u.many} long crosses a rectangular field from one corner to the opposite corner. The field is ${a} ${u.many} long. How wide is it?`, label: 'Width', shape: 'rectangle' }
  }
  if (story === 'kite') {
    const u = UNITS.ft
    if (rng.chance(0.6)) {
      const s = pick(60, 200)
      const d = pick(Math.ceil(s * 0.3), Math.floor(s * 0.75))
      return { story, unit: u, legs: null, leg: d, hyp: s, asked: 'leg1', prompt: `A kite string ${s} feet long is staked to the ground and pulled tight. The kite is directly above a point ${d} feet from the stake. How high is the kite?`, label: 'Height', shape: 'triangle' }
    }
    const h = pick(40, 160)
    const d = pick(Math.ceil(h * 0.4), Math.floor(h * 1.6))
    return { story, unit: u, legs: [d, h], leg: null, hyp: null, asked: 'hyp', prompt: `A kite flies ${h} feet above the ground, directly above a point ${d} feet from where its string is staked. How long is the string, pulled tight?`, label: 'String', shape: 'triangle' }
  }
  const u = rng.chance(0.55) ? UNITS.km : UNITS.mi
  const north = rng.chance(0.5)
  const east = rng.chance(0.5)
  const ns = north ? 'north' : 'south'
  const ew = east ? 'east' : 'west'
  if (rng.chance(0.65)) {
    const a = pick(5, 80)
    const b = pick(Math.max(4, Math.ceil(a * 0.35)), Math.min(90, Math.floor(a * 2.8)))
    return { story, unit: u, legs: [b, a], leg: null, hyp: null, asked: 'hyp', prompt: `A ship sails ${a} ${u.many} due ${ns} and then ${b} ${u.many} due ${ew}. How far is the ship from where it started?`, label: 'Distance', shape: 'triangle', dir: { north, east } }
  }
  const D = pick(20, 95)
  const b = pick(Math.ceil(D * 0.35), Math.floor(D * 0.85))
  return { story, unit: u, legs: null, leg: b, hyp: D, asked: 'leg1', prompt: `A ship sails due ${ns}, then ${b} ${u.many} due ${ew}. It is then ${D} ${u.many} from where it started. How far ${ns} did it sail?`, label: `Distance ${ns}`, shape: 'triangle', dir: { north, east } }
}

function applyProblem(rng: Rng, s: StoryDraw, places: Places): GeoBuilt | null {
  // The right triangle: leg0 along the ground (or the width), leg1 up (or the height), hyp across.
  let leg0: GeoQty
  let leg1: GeoQty
  let hyp: GeoQty
  let answer: GeoQty
  let traps: TrapDraft7[]
  if (s.asked === 'hyp') {
    leg0 = int(s.legs![0])
    leg1 = int(s.legs![1])
    hyp = fromTrig(hypotenuseOf(toTrig(leg0), toTrig(leg1)))
    answer = hyp
    traps = coreSlips('result', [leg0, leg1], null)
  } else {
    hyp = int(s.hyp!)
    const known = int(s.leg!)
    if (known.n >= hyp.n) return null
    const other = fromTrig(legOf(toTrig(known), toTrig(hyp)))
    if (s.asked === 'leg0') {
      leg1 = known
      leg0 = other
    } else {
      leg0 = known
      leg1 = other
    }
    answer = other
    traps = coreSlips('result', null, [known, hyp])
  }
  const exactValue = approxQ(answer)
  if (nearHalf(exactValue, places)) return null
  for (const t of traps) if (typeof t.value !== 'number' && nearHalf(approxQ(t.value), places)) return null
  const u = s.unit
  // The figure carries the numbers; the prompt carries the unit (a label as wide as "150 ft" cannot sit beside an
  // upright side without touching it).
  const labelOf = (which: 'leg0' | 'leg1' | 'hyp', q: GeoQty) => (s.asked === which ? '?' : qSay(q))
  const prompt = `${s.prompt} ${roundingSentence(places, u)}`
  const givens = s.asked === 'hyp' ? [leg0, leg1] : [hyp, s.asked === 'leg0' ? leg1 : leg0]
  const names = { hyp: s.story === 'ladder' ? 'the ladder' : s.story === 'ramp' ? 'the ramp' : s.story === 'kite' ? 'the string' : s.story === 'ship' ? 'the distance from the start' : 'the diagonal' }
  const sqStr = (q: GeoQty) => `${sq(q)}`
  const reveal =
    s.asked === 'hyp'
      ? `By the Pythagorean Theorem, ${names.hyp} is √(${sqSay(leg0)} + ${sqSay(leg1)}) = √${sq(leg0) + sq(leg1)}${isWholeQ(answer) ? ` = ${answer.n}` : ` ≈ ${exactValue.toFixed(4)}`}, which rounds to ${roundOf(exactValue, places)} ${u.many}.`
      : `By the Pythagorean Theorem, the missing leg is √(${sqSay(hyp)} − ${sqSay(s.asked === 'leg0' ? leg1 : leg0)}) = √(${sqStr(hyp)} − ${sq(s.asked === 'leg0' ? leg1 : leg0)}) = √${sq(answer)}${isWholeQ(answer) ? ` = ${answer.n}` : ` ≈ ${exactValue.toFixed(4)}`}, which rounds to ${roundOf(exactValue, places)} ${u.many}.`
  const stage = roundStage7({
    id: 'result',
    label: s.label,
    places,
    unit: u.unit,
    exact: answer,
    nudge: s.asked === 'hyp' ? 'Draw the right triangle: the length asked for is across from the right angle, so it is the hypotenuse.' : 'Draw the right triangle: you know the hypotenuse and one leg, and the length asked for is the other leg.',
    ruleCard: UNIT7_RULE_IDS.rounding,
    reveal: [reveal],
    traps,
    givens,
  })
  const figure = storyFigure(rng, s, leg0, leg1, labelOf)
  if (!figure) return null
  return finish7({
    question: 'pythagoreanWords',
    prompt,
    figure,
    stages: [stage],
    lengths: givens.filter((g) => isWholeQ(g)).map((g) => g.n),
    title: 'Pythagorean word problems',
    instructions: APPLY_INSTRUCTIONS,
    params: { case: s.story, asked: s.asked, places, unit: u.unit },
    cards: PYTHAGOREAN_RULES,
    promise: rng.shuffle<ErrorPatternId>(['trig_pythag_added', 'trig_side_not_rooted', 'trig_pythag_subtracted']),
  })
}

const roundOf = (v: number, places: Places) => (Math.floor(v * 10 ** places + 0.5 + 1e-9) / 10 ** places).toFixed(places)

/** The scene: the right triangle (or the rectangle with its diagonal), no letters, each side with its length or "?". */
function storyFigure(rng: Rng, s: StoryDraw, leg0: GeoQty, leg1: GeoQty, labelOf: (which: 'leg0' | 'leg1' | 'hyp', q: GeoQty) => string): GeoFigureSpec | null {
  const W = approxQ(leg0)
  const H = approxQ(leg1)
  const hypQ = sqrtQ(sq(leg0) + sq(leg1))
  // The ship: the right angle is where it turns; the start is below the turn after sailing north, and the end is to
  // the right of the turn after sailing east.
  const mirror = s.dir ? s.dir.east : rng.chance(0.5)
  const down = s.dir ? s.dir.north : false
  const y = down ? -H : H
  const scene: Record<Story, string> = {
    ladder: 'A ladder leaning against a wall: the wall, the ground, and the ladder make a right triangle with the right angle at the base of the wall.',
    screen: 'A rectangular screen with one diagonal drawn.',
    ramp: 'A ramp: the ground, the rise, and the ramp make a right triangle with the right angle under the high end.',
    field: 'A rectangular field with a straight path across it from one corner to the opposite corner.',
    kite: 'A kite on a string staked to the ground: the ground, the height of the kite, and the string make a right triangle with the right angle under the kite.',
    ship: 'A ship’s course: the first leg, the second leg at a right angle to it, and the straight line back to the start.',
  }
  const said = (which: 'leg0' | 'leg1' | 'hyp', q: GeoQty) => {
    const text = labelOf(which, q)
    return text === '?' ? 'marked ?, the length asked for' : `labeled ${text}`
  }
  if (s.shape === 'rectangle') {
    const base = [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: H },
      { x: 0, y: H },
    ]
    const pts = placeAll(base, 0, mirror)
    const ids = ['S1', 'S2', 'S3', 'S4']
    const center = centerOf(pts)
    const points: GeoPoint[] = ids.map((id, i) => ({ ...pointOf(id, pts[i]!, center), label: '' }))
    const segments: GeoSegment[] = [
      { from: 'S1', to: 'S2', label: labelOf('leg0', leg0) },
      { from: 'S2', to: 'S3', label: labelOf('leg1', leg1) },
      { from: 'S3', to: 'S4' },
      { from: 'S4', to: 'S1' },
      { from: 'S1', to: 'S3', label: labelOf('hyp', hypQ) },
    ]
    const aria = `${scene[s.story]} The bottom side is ${said('leg0', leg0)}, the side is ${said('leg1', leg1)}, and the diagonal is ${said('hyp', hypQ)}.`
    return placeLabels7({ ariaLabel: aria, points, segments, angles: [{ vertex: 'S2', from: 'S1', to: 'S3', right: true }] }, [ids])
  }
  // Triangle: S1 at the far end of leg0, S2 the right angle, S3 at the top of leg1.
  const pts = placeAll(
    [
      { x: -W, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y },
    ],
    0,
    mirror,
  ) as [P2, P2, P2]
  if (smallestAngle(pts[0], pts[1], pts[2]) < 13) return null
  const center = centerOf(pts)
  const ids = ['S1', 'S2', 'S3']
  const points: GeoPoint[] = ids.map((id, i) => ({ ...pointOf(id, pts[i]!, center), label: '' }))
  const segments: GeoSegment[] = [
    { from: 'S1', to: 'S2', label: labelOf('leg0', leg0) },
    { from: 'S2', to: 'S3', label: labelOf('leg1', leg1) },
    { from: 'S1', to: 'S3', label: labelOf('hyp', hypQ) },
  ]
  const aria = `${scene[s.story]} The ${s.story === 'ship' ? 'second leg' : 'ground'} is ${said('leg0', leg0)}, the ${s.story === 'ship' ? 'first leg' : 'upright side'} is ${said('leg1', leg1)}, and the slanted side is ${said('hyp', hypQ)}.`
  return placeLabels7({ ariaLabel: aria, points, segments, angles: [{ vertex: 'S2', from: 'S1', to: 'S3', right: true }] }, [ids])
}

export function drawApply(seed: number): GeoBuilt {
  const places = weighted<Places>(makeRng(mixSeed(seed, 7500)), [
    [1, 60],
    [0, 20],
    [2, 20],
  ])
  for (let attempt = 0; attempt < 600; attempt++) {
    const rng = makeRng(mixSeed(seed, 7501 + attempt))
    const s = storyDraw(rng)
    if (!s) continue
    const built = applyProblem(rng, s, places)
    if (built) return built
  }
  throw new Error(`py.apply/${seed}: no problem`)
}

/** For the hand-worked tests. */


/** For the hand-worked tests: a right triangle from chosen sides, the letters and turn from the first salt that passes the gate. */
export function rightTriangleFor(s: { a: GeoQty; b: GeoQty; c: GeoQty }, asked: 'hyp' | 'a' | 'b'): GeoBuilt {
  for (let attempt = 0; attempt < 400; attempt++) {
    const built = rightTriangleProblem(makeRng(mixSeed(1, 9200 + attempt)), s, asked)
    if (built) return built
  }
  throw new Error('no right triangle for those sides')
}
