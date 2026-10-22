/**
 * Honors geometry Unit 7, module geoRightSimilar (Jurgensen 8-1): the geometric mean, and the right triangle with the
 * altitude to the hypotenuse.
 *
 * rs.mean: the geometric mean of two numbers in simplest radical form, or a number from its geometric mean and the
 * other number. rs.altitude: from two of the six lengths (the segments AD and DB of the hypotenuse, the altitude CD,
 * the legs AC and BC, the hypotenuse AB) find one or two others, exactly; sometimes a length is an expression in x.
 * Every triangle is built from its two hypotenuse segments, whole numbers p = AD and q = DB, so CD = √(pq),
 * AC = √(p(p + q)) and BC = √(q(p + q)) exactly; which lengths are given, which are asked, the letters, the turn and
 * the mirror all come from the seed.
 */
import { makeRng, mixSeed, type Rng } from '@/content/rng'
import type { ErrorPatternId, GeoAngleMark, GeoSegment } from '@/shared/types'
import type { GeoQty } from './answer'
import type { GeoBuilt } from './build'
import { pickLetters6 } from './unit6Geom'
import { weighted } from './unit6Ratios'
import {
  EXACT_HINT7,
  MEAN_HINT7,
  X_HINT7,
  centerOf,
  exactStage7,
  finish7,
  int,
  isWholeQ,
  placeAll,
  placeLabels7,
  pointOf,
  qSay,
  rad,
  rootSay,
  smallestAngle,
  sqSay,
  sqrtQ,
  squareQ,
  type P2,
  type Stage7,
  type TrapDraft7,
} from './unit7Build'
import { RIGHT_SIMILAR_RULES, UNIT7_RULE_IDS } from './unit7Rules'

const MEAN_INSTRUCTIONS = 'Give an exact answer, in simplest radical form when it is not a whole number.'
const ALTITUDE_INSTRUCTIONS = 'Find each part in order, exactly. The figure is there before you answer.'

// =================================================================================================================
// rs.mean
// =================================================================================================================

/** "Find the geometric mean of a and b." */
export function meanProblem(a: number, b: number, promiseFirst: ErrorPatternId | null): GeoBuilt | null {
  if (a === b || a < 2 || b < 2) return null
  const answer = sqrtQ(a * b)
  const traps: TrapDraft7[] = [
    {
      id: 'geo_geometric_as_arithmetic',
      stage: 'result',
      value: rad(a + b, 2, 1),
      witness: `That is (${a} + ${b})/2, the average of ${a} and ${b}. The geometric mean is the positive square root of their product.`,
    },
    {
      id: 'geo_mean_not_rooted',
      stage: 'result',
      value: int(a * b),
      witness: `That is ${a} · ${b}, the product itself. The geometric mean is the positive number whose square is that product.`,
    },
  ]
  const root = isWholeQ(answer) ? `${answer.n}` : `${qSay(answer)}`
  const stage = exactStage7({
    id: 'result',
    label: 'Geometric mean',
    hint: MEAN_HINT7,
    answer,
    nudge: 'The geometric mean of two positive numbers is the positive square root of their product. Multiply, take the square root, and simplify.',
    ruleCard: UNIT7_RULE_IDS.mean,
    reveal: [`The geometric mean is √(${a} · ${b}) = √${a * b} = ${root}.`.replace(`√${a * b} = √${a * b}`, `√${a * b}`)],
    traps,
    givens: [int(a), int(b)],
  })
  return finish7({
    question: 'geometricMean',
    prompt: `Find the geometric mean of ${a} and ${b}.`,
    figure: { points: [], ariaLabel: '' },
    stages: [stage],
    lengths: [a, b],
    title: 'The geometric mean',
    instructions: MEAN_INSTRUCTIONS,
    params: { case: 'mean', a, b },
    cards: RIGHT_SIMILAR_RULES,
    promise: promiseFirst ? [promiseFirst, 'geo_geometric_as_arithmetic', 'geo_mean_not_rooted'] : ['geo_geometric_as_arithmetic'],
  })
}

/** "The geometric mean of a and x is m. Find x." The mean m = √(a·x) is a whole number or a simplest radical. */
export function meanReverseProblem(a: number, x: number, promiseFirst: ErrorPatternId | null): GeoBuilt | null {
  if (a === x || a < 2 || x < 2) return null
  const m = sqrtQ(a * x)
  const mSay = qSay(m)
  // In a fraction a radical with a number in front is written in parentheses: 8/(4√14), not 8/4√14.
  const mFrac = isWholeQ(m) || m.n === 1 ? mSay : `(${mSay})`
  const [m2] = squareQ(m)
  const traps: TrapDraft7[] = [
    {
      id: 'geo_mean_not_rooted',
      stage: 'x',
      value: rad(m.n, m.d * a, m.rad),
      witness: `That makes ${a} · x equal to ${mSay} itself. The geometric mean squared is the product, so ${a} · x = ${sqSay(m)}.`,
    },
  ]
  if (isWholeQ(m) && 2 * m.n - a > 0) {
    traps.push({
      id: 'geo_geometric_as_arithmetic',
      stage: 'x',
      value: int(2 * m.n - a),
      witness: `That makes ${mSay} the average of ${a} and x. The geometric mean is not the average: ${a} · x = ${sqSay(m)}.`,
    })
  }
  if (m.rad > 1 && m.n > 1 && m.d === 1) {
    traps.push({
      id: 'geo_coefficient_not_squared',
      stage: 'x',
      value: rad(m.n * m.rad, a, 1),
      witness: `That squares ${mSay} as ${m.n} · ${m.rad}. Square the ${m.n} too: ${sqSay(m)} = ${m.n * m.n} · ${m.rad}.`,
    })
  }
  const stage = exactStage7({
    id: 'x',
    label: 'x',
    hint: X_HINT7,
    answer: int(x),
    nudge: `The geometric mean is the middle term of a proportion: ${a}/${mFrac} = ${mFrac}/x. Cross-multiply, then solve for x.`,
    ruleCard: UNIT7_RULE_IDS.mean,
    reveal: [`Since ${mSay} is the geometric mean, ${a}/${mFrac} = ${mFrac}/x and ${a}x = ${sqSay(m)} = ${m2}.`, `So x = ${m2}/${a} = ${x}.`],
    traps,
    givens: [int(a), m],
  })
  return finish7({
    question: 'geometricMean',
    prompt: `The geometric mean of ${a} and x is ${mSay}. Find x.`,
    figure: { points: [], ariaLabel: '' },
    stages: [stage],
    lengths: [a],
    title: 'The geometric mean',
    instructions: MEAN_INSTRUCTIONS,
    params: { case: 'reverse', a, x },
    cards: RIGHT_SIMILAR_RULES,
    promise: promiseFirst ? [promiseFirst, 'geo_coefficient_not_squared', 'geo_mean_not_rooted', 'geo_geometric_as_arithmetic'] : ['geo_mean_not_rooted'],
  })
}

function meanForward(rng: Rng): GeoBuilt | null {
  let a: number
  let b: number
  if (rng.chance(0.45)) {
    // A whole-number mean: a and b multiply to a perfect square.
    const r = rng.int(3, 30)
    const divisors: number[] = []
    for (let d = 2; d < r; d++) if ((r * r) % d === 0 && (r * r) / d <= 90) divisors.push(d)
    if (divisors.length === 0) return null
    a = rng.pick(divisors)
    b = (r * r) / a
  } else {
    a = rng.int(2, 30)
    b = rng.int(2, 30)
    const s = sqrtQ(a * b)
    if (s.rad === 1 || s.rad > 70) return null
  }
  if (rng.chance(0.5)) [a, b] = [b, a]
  const first = rng.pick<ErrorPatternId>(['geo_geometric_as_arithmetic', 'geo_mean_not_rooted'])
  return meanProblem(a, b, first)
}

function meanReverse(rng: Rng): GeoBuilt | null {
  const a = rng.int(2, 24)
  const x = rng.int(2, 48)
  const m = sqrtQ(a * x)
  if (m.rad > 30) return null
  const first = rng.pick<ErrorPatternId>(['geo_mean_not_rooted', 'geo_geometric_as_arithmetic', 'geo_coefficient_not_squared'])
  return meanReverseProblem(a, x, first)
}

export function drawGeoMean(seed: number): GeoBuilt {
  const kind = weighted<'mean' | 'reverse'>(makeRng(mixSeed(seed, 7100)), [
    ['mean', 60],
    ['reverse', 40],
  ])
  for (let attempt = 0; attempt < 500; attempt++) {
    const rng = makeRng(mixSeed(seed, 7101 + attempt))
    const built = kind === 'mean' ? meanForward(rng) : meanReverse(rng)
    if (built) return built
  }
  throw new Error(`rs.mean/${seed}: no ${kind} problem`)
}

// =================================================================================================================
// rs.altitude
// =================================================================================================================

/** The six lengths of right triangle ABC (right angle at C) with altitude CD: p = AD, q = DB, c = AB, h = CD, a = AC, b = BC. */
export type Len = 'p' | 'q' | 'c' | 'h' | 'a' | 'b'

export interface AltTriangle {
  p: number
  q: number
}

export function lengthsOf(t: AltTriangle): Record<Len, GeoQty> {
  const c = t.p + t.q
  return { p: int(t.p), q: int(t.q), c: int(c), h: sqrtQ(t.p * t.q), a: sqrtQ(t.p * c), b: sqrtQ(t.q * c) }
}

/** Which two lengths are given (plain cases), or which length is an expression in x. */
export type AltCase = 'pq' | 'ph' | 'pa' | 'pc' | 'ac' | 'hx' | 'px' | 'quad' | 'ax'

/** An expression αx + β. */
export interface Lin7 {
  a: number
  b: number
}

export function linText(e: Lin7): string {
  const head = e.a === 1 ? 'x' : `${e.a}x`
  if (e.b === 0) return head
  return e.b > 0 ? `${head} + ${e.b}` : `${head} − ${-e.b}`
}

export interface AltSpec {
  tri: AltTriangle
  kind: AltCase
  /** Lengths asked, in order (plain cases): one or two of h, a, b, p, q. */
  asked: Len[]
  /** The expression for the length in x (expression cases). */
  expr?: Lin7
  /** x (expression cases). */
  x?: number
  /** A length asked after x (expression cases), or 'value' for the expression's own length first (case px). */
  extra?: Len | null
}

interface Names {
  A: string
  B: string
  C: string
  D: string
}

function segName(n: Names, len: Len): string {
  switch (len) {
    case 'p':
      return `${n.A}${n.D}`
    case 'q':
      return `${n.D}${n.B}`
    case 'c':
      return `${n.A}${n.B}`
    case 'h':
      return `${n.C}${n.D}`
    case 'a':
      return `${n.A}${n.C}`
    case 'b':
      return `${n.B}${n.C}`
  }
}

/** What she is given in each case. */
export function givenOf(kind: AltCase): Len[] {
  switch (kind) {
    case 'pq':
      return ['p', 'q']
    case 'ph':
      return ['p', 'h']
    case 'pa':
      return ['p', 'a']
    case 'pc':
      return ['p', 'c']
    case 'ac':
      return ['a', 'c']
    case 'hx':
      return ['p', 'q', 'h']
    case 'px':
      return ['p', 'q', 'h']
    case 'quad':
      return ['p', 'q', 'h']
    case 'ax':
      return ['p', 'c', 'a']
  }
}

/** The length written in x in an expression case. */
function exprLen(kind: AltCase): Len | null {
  return kind === 'hx' ? 'h' : kind === 'px' ? 'p' : kind === 'quad' ? 'p' : kind === 'ax' ? 'a' : null
}

const ask = (n: Names, len: Len) => segName(n, len)

/** The slips for one asked length, each exactly the number that slip gives on this triangle, with a sentence about it. */
function slipsFor(len: Len, kind: AltCase, L: Record<Len, GeoQty>, n: Names, stage: 'x' | 'result'): TrapDraft7[] {
  const out: TrapDraft7[] = []
  const N = (l: Len) => ask(n, l)
  const p = L.p.n
  const q = L.q.n
  const c = L.c.n
  const push = (id: ErrorPatternId, value: GeoQty | null, witness: string) => {
    if (value && value.n > 0) out.push({ id, stage, value, witness })
  }
  const segmentsKnown = kind === 'pq' || kind === 'pc'
  if (len === 'h') {
    if (kind === 'pa') {
      // Right triangle ACD: AC is across from the right angle at D.
      const [a2n, a2d] = squareQ(L.a)
      push('geo_altitude_leg_mixed', isWholeQ(L.a) ? sqrtQ(L.a.n * p) : null, `That is the geometric mean of ${N('a')} and ${N('p')}, a leg and a segment. The altitude is the geometric mean of the two segments of the hypotenuse.`)
      push('trig_pythag_added', sqrtQ(a2n + p * p * a2d, a2d), `That adds ${sqSay(L.a)} and ${sqSay(L.p)}, but in right triangle ${n.A}${n.C}${n.D} the side across from the right angle at ${n.D} is ${N('a')}. Subtract: ${N('h')}² = ${N('a')}² − ${N('p')}².`)
      push('trig_side_not_rooted', a2d === 1 ? int(a2n - p * p) : null, `That is ${N('a')}² − ${N('p')}², the square of ${N('h')}. Take its square root.`)
      if (L.a.rad > 1 && L.a.n > 1) {
        const wrong = L.a.n * L.a.rad - p * p
        push('geo_coefficient_not_squared', wrong > 0 ? sqrtQ(wrong) : null, `That squares ${qSay(L.a)} as ${L.a.n} · ${L.a.rad}. Square the ${L.a.n} too: ${sqSay(L.a)} = ${L.a.n * L.a.n} · ${L.a.rad}.`)
      }
    } else {
      if (segmentsKnown) push('geo_geometric_as_arithmetic', rad(p + q, 2, 1), `That is the average of ${N('p')} and ${N('q')}. The altitude to the hypotenuse is their geometric mean: the square root of ${N('p')} · ${N('q')}.`)
      push('geo_mean_not_rooted', int(p * q), `That is ${N('p')} · ${N('q')}, which is ${N('h')}². Take its square root.`)
      if (kind === 'ac' && isWholeQ(L.a)) {
        const [pn, pd] = [L.a.n * L.a.n, c]
        push('geo_altitude_leg_mixed', sqrtQ(L.a.n * pn, pd), `That is the geometric mean of ${N('a')} and ${N('p')}, a leg and a segment. The altitude is the geometric mean of the two segments of the hypotenuse.`)
      }
    }
  }
  if (len === 'a' || len === 'b') {
    const near = len === 'a' ? p : q
    const far = len === 'a' ? q : p
    const nearName = len === 'a' ? N('p') : N('q')
    const farName = len === 'a' ? N('q') : N('p')
    if (kind === 'ph' && len === 'a') {
      const [h2n] = squareQ(L.h)
      const diff = Math.abs(h2n - p * p)
      push('trig_side_not_rooted', int(p * p + h2n), `That is ${N('p')}² + ${N('h')}², the square of ${N('a')}. Take its square root.`)
      push('trig_pythag_subtracted', diff > 0 ? sqrtQ(diff) : null, `That subtracts the squares, but ${N('p')} and ${N('h')} are both legs of right triangle ${n.A}${n.C}${n.D}. Add their squares: ${N('a')}² = ${N('p')}² + ${N('h')}².`)
      if (L.h.rad > 1 && L.h.n > 1) push('geo_coefficient_not_squared', sqrtQ(p * p + L.h.n * L.h.rad), `That squares ${qSay(L.h)} as ${L.h.n} · ${L.h.rad}. Square the ${L.h.n} too: ${sqSay(L.h)} = ${L.h.n * L.h.n} · ${L.h.rad}.`)
    }
    if (kind === 'ac' && len === 'b') {
      const [a2n] = squareQ(L.a)
      push('trig_pythag_added', sqrtQ(c * c + a2n), `That adds ${sqSay(L.c)} and ${sqSay(L.a)}, but ${N('c')} is the hypotenuse of right triangle ${n.A}${n.B}${n.C}. Subtract: ${N('b')}² = ${N('c')}² − ${N('a')}².`)
      push('trig_side_not_rooted', int(c * c - a2n), `That is ${N('c')}² − ${N('a')}², the square of ${N('b')}. Take its square root.`)
      if (L.a.rad > 1 && L.a.n > 1) {
        const wrong = c * c - L.a.n * L.a.rad
        push('geo_coefficient_not_squared', wrong > 0 ? sqrtQ(wrong) : null, `That squares ${qSay(L.a)} as ${L.a.n} · ${L.a.rad}. Square the ${L.a.n} too: ${sqSay(L.a)} = ${L.a.n * L.a.n} · ${L.a.rad}.`)
      }
    }
    const legName = N(len)
    push('geo_leg_far_segment', sqrtQ(far * c), `That pairs ${legName} with ${farName}, the segment at the far end of the hypotenuse. ${legName} is the geometric mean of ${N('c')} and ${nearName}, the segment next to it.`)
    push('geo_mean_not_rooted', int(near * c), `That is ${N('c')} · ${nearName}, which is ${legName}². Take its square root.`)
    push('geo_geometric_as_arithmetic', rad(near + c, 2, 1), `That is the average of ${N('c')} and ${nearName}. ${legName} is their geometric mean, the square root of their product.`)
    push('geo_altitude_leg_mixed', sqrtQ(p * q), `That is the geometric mean of ${N('p')} and ${N('q')}, the two segments, which gives the altitude ${N('h')}. A leg is the geometric mean of the whole hypotenuse and the segment next to it.`)
  }
  if (len === 'q' && kind === 'ph') out.push(...segmentFromAltitude('q', L, n, stage))
  if (len === 'q' && kind === 'pa') {
    push('geo_part_equals_whole', int(c), `That is ${N('c')}, the whole hypotenuse: ${N('a')}² = ${N('c')} · ${N('p')} gives ${N('c')}. ${N('q')} is the part of ${N('c')} past ${n.D}.`)
    if (L.a.rad > 1 && L.a.n > 1) {
      const wrongC = rad(L.a.n * L.a.rad, p, 1)
      const wrong = rad(wrongC.n - p * wrongC.d, wrongC.d, 1)
      push('geo_coefficient_not_squared', wrong.n > 0 ? wrong : null, `That squares ${qSay(L.a)} as ${L.a.n} · ${L.a.rad}. Square the ${L.a.n} too: ${sqSay(L.a)} = ${L.a.n * L.a.n} · ${L.a.rad}.`)
    }
  }
  if ((len === 'p' || len === 'q') && kind === 'ac') {
    // AC² = AB · AD, so AD = AC²/AB, and DB is the rest of AB.
    if (len === 'p') {
      push('geo_leg_far_segment', int(q), `That pairs ${N('a')} with ${N('q')}, the segment at the far end of the hypotenuse. ${N('a')} is the geometric mean of ${N('c')} and ${N('p')}, the segment next to it.`)
      if (isWholeQ(L.a)) {
        push('geo_mean_not_rooted', rad(L.a.n, c, 1), `That makes ${N('c')} · ${N('p')} equal to ${N('a')} itself. ${N('a')} is a geometric mean, so ${N('c')} · ${N('p')} = ${N('a')}².`)
        push('geo_geometric_as_arithmetic', 2 * L.a.n - c > 0 ? int(2 * L.a.n - c) : null, `That makes ${N('a')} the average of ${N('c')} and ${N('p')}. ${N('a')} is their geometric mean: ${N('c')} · ${N('p')} = ${N('a')}².`)
      } else {
        push('geo_mean_not_rooted', rad(L.a.n, L.a.d * c, L.a.rad), `That makes ${N('c')} · ${N('p')} equal to ${N('a')} itself. ${N('a')} is a geometric mean, so ${N('c')} · ${N('p')} = ${N('a')}².`)
      }
    } else {
      push('geo_leg_far_segment', int(p), `That pairs ${N('a')} with ${N('q')}, the segment at the far end of the hypotenuse. ${N('a')} goes with ${N('p')}, the segment next to it: ${N('a')}² = ${N('c')} · ${N('p')}. Find ${N('p')} first; ${N('q')} is the rest of the hypotenuse.`)
    }
    if (L.a.rad > 1 && L.a.n > 1) {
      const wrongP = rad(L.a.n * L.a.rad, c, 1)
      const wrong = len === 'p' ? wrongP : rad(c * wrongP.d - wrongP.n, wrongP.d, 1)
      push('geo_coefficient_not_squared', wrong.n > 0 ? wrong : null, `That squares ${qSay(L.a)} as ${L.a.n} · ${L.a.rad}. Square the ${L.a.n} too: ${sqSay(L.a)} = ${L.a.n * L.a.n} · ${L.a.rad}.`)
    }
  }
  return out
}

/** A segment of the hypotenuse from the other segment and the altitude: CD² = AD · DB. */
function segmentFromAltitude(asked: 'p' | 'q', L: Record<Len, GeoQty>, n: Names, stage: 'x' | 'result'): TrapDraft7[] {
  const N = (l: Len) => segName(n, l)
  const k = (asked === 'p' ? L.q : L.p).n
  const out: TrapDraft7[] = [
    {
      id: 'geo_mean_not_rooted',
      stage,
      value: rad(L.h.n, L.h.d * k, L.h.rad),
      witness: `That makes ${N('p')} · ${N('q')} equal to ${N('h')} itself. ${N('h')} is the geometric mean, so ${N('p')} · ${N('q')} = ${N('h')}².`,
    },
  ]
  if (isWholeQ(L.h) && 2 * L.h.n - k > 0) {
    out.push({
      id: 'geo_geometric_as_arithmetic',
      stage,
      value: int(2 * L.h.n - k),
      witness: `That makes ${N('h')} the average of ${N('p')} and ${N('q')}. ${N('h')} is their geometric mean: ${N('p')} · ${N('q')} = ${N('h')}².`,
    })
  }
  if (L.h.rad > 1 && L.h.n > 1 && L.h.d === 1) {
    out.push({
      id: 'geo_coefficient_not_squared',
      stage,
      value: rad(L.h.n * L.h.rad, k, 1),
      witness: `That squares ${qSay(L.h)} as ${L.h.n} · ${L.h.rad}. Square the ${L.h.n} too: ${sqSay(L.h)} = ${L.h.n * L.h.n} · ${L.h.rad}.`,
    })
  }
  return out
}

function nudgeFor(len: Len, kind: AltCase, n: Names): { nudge: string; card: string } {
  if (len === 'h' && kind === 'pa') return { nudge: `Triangle ${n.A}${n.C}${n.D} is a right triangle too, with its right angle at ${n.D}.`, card: UNIT7_RULE_IDS.pythagorean }
  if (len === 'h') return { nudge: 'The altitude to the hypotenuse is the geometric mean of the two segments of the hypotenuse.', card: UNIT7_RULE_IDS.altitudeMean }
  if (len === 'a' && kind === 'ph') return { nudge: `Triangle ${n.A}${n.C}${n.D} is a right triangle with legs ${segName(n, 'p')} and ${segName(n, 'h')}.`, card: UNIT7_RULE_IDS.pythagorean }
  if (len === 'b' && kind === 'ac') return { nudge: `${segName(n, 'c')} is the hypotenuse of right triangle ${n.A}${n.B}${n.C}, and you know one leg.`, card: UNIT7_RULE_IDS.pythagorean }
  if (len === 'a' || len === 'b') return { nudge: 'Each leg is the geometric mean of the whole hypotenuse and the segment of the hypotenuse next to that leg.', card: UNIT7_RULE_IDS.legMean }
  if (kind === 'ph') return { nudge: 'The altitude is the geometric mean of the two segments of the hypotenuse, so its square is their product.', card: UNIT7_RULE_IDS.altitudeMean }
  return { nudge: 'A leg squared is the whole hypotenuse times the segment next to that leg.', card: UNIT7_RULE_IDS.legMean }
}

/** The worked line for one asked length. */
function revealFor(len: Len, kind: AltCase, L: Record<Len, GeoQty>, n: Names): string {
  const N = (l: Len) => segName(n, l)
  const p = L.p.n
  const q = L.q.n
  const c = L.c.n
  const val = qSay(L[len])
  // ", so CD = 6." or ", so AC = √52 = 2√13."
  const root = (v: GeoQty) => `, so ${N(len)} = ${rootSay(v)}.`
  const abLine = kind === 'pq' ? ` (${N('c')} = ${p} + ${q} = ${c})` : ''
  if (len === 'h' && kind === 'pa') {
    const [a2] = squareQ(L.a)
    return `In right triangle ${n.A}${n.C}${n.D}, ${N('h')}² = ${N('a')}² − ${N('p')}² = ${a2} − ${p * p} = ${a2 - p * p}${root(L.h)}`
  }
  if (len === 'h') {
    const pre = kind === 'ac' ? `First ${N('p')} = ${N('a')}²/${N('c')} = ${squareQ(L.a)[0]}/${c} = ${p} and ${N('q')} = ${c} − ${p} = ${q}. ` : kind === 'pc' ? `First ${N('q')} = ${c} − ${p} = ${q}. ` : ''
    return `${pre}By Corollary 1, ${N('h')}² = ${N('p')} · ${N('q')} = ${p} · ${q} = ${p * q}${root(L.h)}`
  }
  if (len === 'a' && kind === 'ph') {
    const [h2] = squareQ(L.h)
    return `In right triangle ${n.A}${n.C}${n.D}, ${N('a')}² = ${N('p')}² + ${N('h')}² = ${p * p} + ${h2} = ${p * p + h2}${root(L.a)}`
  }
  if (len === 'b' && kind === 'ac') {
    const [a2] = squareQ(L.a)
    return `By the Pythagorean Theorem, ${N('b')}² = ${N('c')}² − ${N('a')}² = ${c * c} − ${a2} = ${c * c - a2}${root(L.b)}`
  }
  if (len === 'a' || len === 'b') {
    const near = len === 'a' ? 'p' : 'q'
    const pre =
      kind === 'ph'
        ? `First ${N('q')} = ${N('h')}²/${N('p')} = ${squareQ(L.h)[0]}/${p} = ${q}, so ${N('c')} = ${c}. `
        : kind === 'pa'
          ? `First ${N('c')} = ${N('a')}²/${N('p')} = ${squareQ(L.a)[0]}/${p} = ${c}, so ${N('q')} = ${q}. `
          : kind === 'pc' && len === 'b'
            ? `First ${N('q')} = ${N('c')} − ${N('p')} = ${c} − ${p} = ${q}. `
            : ''
    return `${pre}By Corollary 2, ${N(len)}² = ${N('c')} · ${N(near)}${abLine} = ${c} · ${L[near].n} = ${c * L[near].n}${root(L[len])}`
  }
  if (len === 'q' && kind === 'ph') {
    const [h2] = squareQ(L.h)
    return `By Corollary 1, ${N('h')}² = ${N('p')} · ${N('q')}, so ${h2} = ${p} · ${N('q')} and ${N('q')} = ${val}.`
  }
  if (len === 'q' && kind === 'pa') {
    const [a2] = squareQ(L.a)
    return `By Corollary 2, ${N('a')}² = ${N('c')} · ${N('p')}, so ${a2} = ${N('c')} · ${p} and ${N('c')} = ${c}. Then ${N('q')} = ${c} − ${p} = ${val}.`
  }
  if (len === 'p' && kind === 'ac') {
    const [a2] = squareQ(L.a)
    return `By Corollary 2, ${N('a')}² = ${N('c')} · ${N('p')}, so ${a2} = ${c} · ${N('p')} and ${N('p')} = ${val}.`
  }
  if (len === 'q' && kind === 'ac') {
    const [a2] = squareQ(L.a)
    return `By Corollary 2, ${N('a')}² = ${N('c')} · ${N('p')}, so ${N('p')} = ${a2}/${c} = ${p}. Then ${N('q')} = ${c} − ${p} = ${val}.`
  }
  return `${N(len)} = ${val}.`
}

/** The askable lengths in each plain case (a length given, or found by one subtraction, is not asked). */
export function askable(kind: AltCase): Len[] {
  switch (kind) {
    case 'pq':
      return ['h', 'a', 'b']
    case 'ph':
      return ['q', 'a', 'b']
    case 'pa':
      return ['q', 'h', 'b']
    case 'pc':
      return ['h', 'a', 'b']
    case 'ac':
      return ['p', 'q', 'h', 'b']
    default:
      return []
  }
}

/** The figure: hypotenuse AB with the triangle on its upper side, turned and sometimes mirrored. */
function altFigure(spec: AltSpec, n: Names, labels: Partial<Record<Len, string>>, turn: number, reflect: boolean, aria: string) {
  const { p, q } = spec.tri
  const c = p + q
  const h = Math.sqrt(p * q)
  const [pA, pB, pC, pD] = placeAll(
    [
      { x: -c / 2, y: 0 },
      { x: c / 2, y: 0 },
      { x: -c / 2 + p, y: h },
      { x: -c / 2 + p, y: 0 },
    ],
    turn,
    reflect,
  ) as [P2, P2, P2, P2]
  if (smallestAngle(pA, pB, pC) < 18) return null
  const center = centerOf([pA, pB, pC])
  const seg = (from: string, to: string, len: Len): GeoSegment => ({ from, to, ...(labels[len] ? { label: labels[len] } : {}) })
  const segments: GeoSegment[] = [seg(n.A, n.D, 'p'), seg(n.D, n.B, 'q'), seg(n.A, n.C, 'a'), seg(n.C, n.B, 'b'), seg(n.C, n.D, 'h')]
  const angles: GeoAngleMark[] = [
    { vertex: n.C, from: n.A, to: n.B, right: true },
    { vertex: n.D, from: n.B, to: n.C, right: true },
  ]
  const points = [pointOf(n.A, pA, center), pointOf(n.B, pB, center), pointOf(n.C, pC, center), pointOf(n.D, pD, pC)]
  return placeLabels7({ ariaLabel: aria, points, segments, angles }, [[n.A, n.B, n.C]], new Set([0, 1]))
}

/** Build one altitude problem from its spec; null when it is refused (a crowded figure, a leak, a given answer). */
export function altitudeProblem(spec: AltSpec, rng: Rng): GeoBuilt | null {
  const [A, B, C, D] = pickLetters6(rng, 4) as [string, string, string, string]
  const n: Names = { A, B, C, D }
  const L = lengthsOf(spec.tri)
  const N = (l: Len) => segName(n, l)
  const given = givenOf(spec.kind)
  const eLen = exprLen(spec.kind)
  // The length written in x: in the quadratic case AD is x itself.
  const specExpr: Lin7 | undefined = spec.kind === 'quad' ? { a: 1, b: 0 } : spec.expr
  const stages: Stage7[] = []
  const labels: Partial<Record<Len, string>> = {}
  const givenQ: GeoQty[] = []
  const givenSay: string[] = []
  // The givens, in the order she reads them; AB has no label in the figure (its pieces carry the dimension lines).
  for (const g of given) {
    if (spec.kind === 'quad' && g === 'q') {
      labels.q = linText({ a: 1, b: spec.tri.q - spec.tri.p })
      givenSay.push(`${N('q')} = ${labels.q}`)
      continue
    }
    if (g === eLen && specExpr) {
      labels[g] = linText(specExpr)
      givenSay.push(`${N(g)} = ${labels[g]}`)
      continue
    }
    givenQ.push(L[g])
    givenSay.push(`${N(g)} = ${qSay(L[g])}`)
    if (g !== 'c') labels[g] = qSay(L[g])
  }
  if (spec.kind === 'quad') labels.p = 'x'
  const prompts: string[] = []
  const lengthsOut = given.filter((g) => g !== eLen && !(spec.kind === 'quad' && g === 'q') && isWholeQ(L[g])).map((g) => L[g].n)
  let promise: ErrorPatternId[] = []
  if (!eLen) {
    const letters = ['x', 'y']
    spec.asked.forEach((len, i) => {
      labels[len] = letters[i]!
      const { nudge, card } = nudgeFor(len, spec.kind, n)
      const id = i === 0 ? 'x' : 'result'
      stages.push(
        exactStage7({
          id,
          label: letters[i]!,
          hint: EXACT_HINT7,
          answer: L[len],
          nudge,
          ruleCard: card,
          reveal: [revealFor(len, spec.kind, L, n)],
          traps: slipsFor(len, spec.kind, L, n, id),
          givens: givenQ,
        }),
      )
    })
    prompts.push(spec.asked.length === 1 ? `Find x, the length of ${N(spec.asked[0]!)}.` : `Find x, the length of ${N(spec.asked[0]!)}, and y, the length of ${N(spec.asked[1]!)}.`)
    promise = rng.shuffle<ErrorPatternId>(['geo_leg_far_segment', 'geo_altitude_leg_mixed', 'geo_geometric_as_arithmetic', 'geo_mean_not_rooted', 'geo_coefficient_not_squared', 'trig_pythag_added', 'trig_pythag_subtracted', 'geo_part_equals_whole'])
  } else {
    const x = spec.x!
    const value = spec.kind === 'quad' ? L.p : L[eLen]
    if (!isWholeQ(value)) return null
    const V = value.n
    const e = specExpr!
    if (e.a * x + e.b !== V) throw new Error('the expression does not fit')
    const xTraps: TrapDraft7[] = []
    const fromValue = (target: GeoQty | null, id: ErrorPatternId, witness: string) => {
      if (!target || target.rad !== 1) return
      // e.a · x + e.b = target, so x = (target − e.b)/e.a.
      const num = target.n - e.b * target.d
      const den = target.d * e.a
      if (num <= 0) return
      xTraps.push({ id, stage: 'x', value: rad(num, den, 1), witness })
    }
    const eText = spec.kind === 'quad' ? 'x' : linText(e)
    const eName = N(spec.kind === 'quad' ? 'p' : eLen)
    if (spec.kind === 'hx') {
      xTraps.push({ id: 'geo_answered_x', stage: 'x', value: int(V), witness: `That is the length of ${eName}. The question asks for x: solve ${eText} = ${V}.` })
      fromValue(rad(L.p.n + L.q.n, 2, 1), 'geo_geometric_as_arithmetic', `That makes ${eName} the average of ${N('p')} and ${N('q')}. The altitude is their geometric mean: its square is ${N('p')} · ${N('q')}.`)
      fromValue(int(L.p.n * L.q.n), 'geo_mean_not_rooted', `That sets ${eText} equal to ${N('p')} · ${N('q')}, which is ${eName}². Take the square root first.`)
    } else if (spec.kind === 'px') {
      xTraps.push({ id: 'geo_answered_x', stage: 'x', value: int(V), witness: `That is the length of ${eName}. The question asks for x: solve ${eText} = ${eName}.` })
    } else if (spec.kind === 'quad') {
      const d = L.q.n - L.p.n
      xTraps.push({ id: 'geo_answered_x', stage: 'x', value: int(L.q.n), witness: `That is the length of ${N('q')}, which is x + ${d}. The question asks for x itself.` })
      if (isWholeQ(L.h)) {
        const num = 2 * L.h.n - d
        if (num > 0) xTraps.push({ id: 'geo_geometric_as_arithmetic', stage: 'x', value: rad(num, 2, 1), witness: `That makes ${N('h')} the average of x and x + ${d}. The altitude is their geometric mean: x(x + ${d}) = ${N('h')}².` })
      }
    } else if (spec.kind === 'ax') {
      xTraps.push({ id: 'geo_answered_x', stage: 'x', value: int(V), witness: `That is the length of ${eName}. The question asks for x: solve ${eText} = ${V}.` })
      fromValue(int(L.p.n * L.c.n), 'geo_mean_not_rooted', `That sets ${eText} equal to ${N('c')} · ${N('p')}, which is ${eName}². Take the square root first.`)
      const far = sqrtQ(L.q.n * L.c.n)
      fromValue(far.rad === 1 ? far : null, 'geo_leg_far_segment', `That pairs ${eName} with ${N('q')}, the segment at the far end of the hypotenuse. ${eName} is the geometric mean of ${N('c')} and ${N('p')}, the segment next to it.`)
    }
    const valueLine =
      spec.kind === 'hx'
        ? `By Corollary 1, ${eName}² = ${N('p')} · ${N('q')} = ${L.p.n} · ${L.q.n} = ${L.p.n * L.q.n}, so ${eName} = ${V}.`
        : spec.kind === 'px'
          ? `By Corollary 1, ${N('h')}² = ${N('p')} · ${N('q')}, so ${squareQ(L.h)[0]} = ${N('p')} · ${L.q.n} and ${N('p')} = ${V}.`
          : spec.kind === 'quad'
            ? `By Corollary 1, ${N('h')}² = ${N('p')} · ${N('q')}, so x(x + ${L.q.n - L.p.n}) = ${squareQ(L.h)[0]}, or x² + ${L.q.n - L.p.n}x − ${squareQ(L.h)[0]} = 0.`
            : `By Corollary 2, ${eName}² = ${N('c')} · ${N('p')} = ${L.c.n} · ${L.p.n} = ${L.c.n * L.p.n}, so ${eName} = ${V}.`
    const solveLine =
      spec.kind === 'quad'
        ? `That factors as (x − ${x})(x + ${L.q.n}) = 0, and a length is positive, so x = ${x}.`
        : `Then ${eText} = ${V}, so x = ${x}.`
    const xNudge =
      spec.kind === 'quad'
        ? 'The altitude is the geometric mean of the two segments. Write that as an equation in x and solve it; a length is positive.'
        : 'Find the length that has x in it from a geometric mean, then set its expression equal to that length.'
    const xCard = spec.kind === 'ax' ? UNIT7_RULE_IDS.legMean : UNIT7_RULE_IDS.altitudeMean
    if (spec.kind === 'px') {
      // AD first, then x: the worked line for AD shows its length, which x needs.
      stages.push(
        exactStage7({
          id: 'result',
          label: eName,
          hint: EXACT_HINT7,
          answer: value,
          nudge: 'The altitude is the geometric mean of the two segments of the hypotenuse, so its square is their product.',
          ruleCard: UNIT7_RULE_IDS.altitudeMean,
          reveal: [valueLine],
          traps: segmentFromAltitude('p', L, n, 'result'),
          givens: givenQ,
        }),
      )
      stages.push(exactStage7({ id: 'x', label: 'x', hint: X_HINT7, answer: int(x), nudge: `Set ${eText} equal to the length of ${eName}.`, ruleCard: UNIT7_RULE_IDS.substitute, reveal: [solveLine], traps: xTraps, givens: givenQ }))
      prompts.push(`Find ${eName}, then x.`)
    } else {
      stages.push(exactStage7({ id: 'x', label: 'x', hint: X_HINT7, answer: int(x), nudge: xNudge, ruleCard: xCard, reveal: [valueLine, solveLine], traps: xTraps, givens: givenQ }))
      if (spec.extra) {
        labels[spec.extra] = 'y'
        const { nudge, card } = nudgeFor(spec.extra, spec.kind === 'ax' ? 'pc' : 'pq', n)
        stages.push(
          exactStage7({
            id: 'result',
            label: 'y',
            hint: EXACT_HINT7,
            answer: L[spec.extra],
            nudge,
            ruleCard: card,
            reveal: [revealFor(spec.extra, spec.kind === 'ax' ? 'pc' : 'pq', L, n)],
            traps: slipsFor(spec.extra, spec.kind === 'ax' ? 'pc' : 'pq', L, n, 'result'),
            givens: givenQ,
          }),
        )
        prompts.push(`Find x, then y, the length of ${N(spec.extra)}.`)
      } else prompts.push('Find x.')
    }
    promise = rng.shuffle<ErrorPatternId>(['geo_answered_x', 'geo_geometric_as_arithmetic', 'geo_mean_not_rooted', 'geo_leg_far_segment', 'geo_coefficient_not_squared'])
  }
  const sentenceOf = (items: string[]) => (items.length === 2 ? `${items[0]} and ${items[1]}` : `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`)
  const prompt = `In right triangle ${A}${B}${C}, ∠${A}${C}${B} is a right angle and ${C}${D} is the altitude to the hypotenuse. ${sentenceOf(givenSay)}. ${prompts.join(' ')}`
  const labelWords = (Object.entries(labels) as [Len, string][]).map(([len, text]) => `${N(len)} is labeled ${text}`)
  const aria = `Right triangle ${A}${B}${C} with the right angle at ${C}, and the altitude ${C}${D} to the hypotenuse ${A}${B}, with a right-angle mark at ${D}. ${sentenceOf(labelWords).replace(/^./, (ch) => ch.toUpperCase())}.`
  const turn = rng.int(-22, 100)
  const reflect = rng.chance(0.5)
  const figure = altFigure(spec, n, labels, turn, reflect, aria)
  if (!figure) return null
  return finish7({
    question: 'rightAltitude',
    prompt,
    figure,
    stages,
    lengths: lengthsOut,
    title: 'The altitude to the hypotenuse',
    instructions: ALTITUDE_INSTRUCTIONS,
    params: { case: spec.kind, asked: spec.asked.join(','), p: spec.tri.p, q: spec.tri.q, ...(spec.x !== undefined ? { x: spec.x } : {}), turn, reflect },
    cards: RIGHT_SIMILAR_RULES,
    promise,
  })
}

/** Whole-number segments p and q with p ≠ q, a readable shape, and lengths that stay small. */
function segmentsDraw(rng: Rng, want: 'any' | 'pqSquare' | 'pcSquare'): AltTriangle | null {
  if (want === 'pqSquare') {
    const h = rng.int(3, 18)
    const divs: number[] = []
    for (let d = 2; d < h; d++) if ((h * h) % d === 0) divs.push(d)
    if (divs.length === 0) return null
    const p = rng.pick(divs)
    const q = (h * h) / p
    return rng.chance(0.5) ? { p, q } : { p: q, q: p }
  }
  if (want === 'pcSquare') {
    // p = k·u², c = k·v², so AC = k·u·v.
    const k = rng.int(1, 5)
    const u = rng.int(1, 4)
    const v = rng.int(u + 1, 7)
    const p = k * u * u
    const c = k * v * v
    if (c - p < 2 || p < 2) return null
    return { p, q: c - p }
  }
  return { p: rng.int(2, 22), q: rng.int(2, 22) }
}

function goodTriangle(t: AltTriangle): boolean {
  if (t.p === t.q || t.p < 2 || t.q < 2) return false
  if (Math.max(t.p, t.q) / Math.min(t.p, t.q) > 5) return false
  const L = lengthsOf(t)
  if (L.c.n > 48) return false
  return [L.h, L.a, L.b].every((v) => v.rad <= 60)
}

function altitudeDraw(rng: Rng, kind: AltCase): GeoBuilt | null {
  let tri: AltTriangle | null
  if (kind === 'ph' || kind === 'hx' || kind === 'px' || kind === 'quad') tri = segmentsDraw(rng, rng.chance(kind === 'ph' ? 0.75 : 1) ? 'pqSquare' : 'any')
  else if (kind === 'pa' || kind === 'ax') tri = segmentsDraw(rng, rng.chance(kind === 'pa' ? 0.6 : 1) ? 'pcSquare' : 'any')
  else if (kind === 'ac') tri = segmentsDraw(rng, rng.chance(0.5) ? 'pcSquare' : 'any')
  else tri = segmentsDraw(rng, 'any')
  if (!tri || !goodTriangle(tri)) return null
  if (kind === 'quad' && tri.q <= tri.p) tri = { p: tri.q, q: tri.p }
  if (kind === 'pq' || kind === 'ph' || kind === 'pa' || kind === 'pc' || kind === 'ac') {
    const pool = rng.shuffle(askable(kind))
    const count = rng.chance(0.45) ? 2 : 1
    const asked = pool.slice(0, count)
    return altitudeProblem({ tri, kind, asked }, rng)
  }
  const Lq = lengthsOf(tri)
  const eLen = exprLen(kind)!
  const V = kind === 'quad' ? tri.p : (Lq[eLen].rad === 1 && Lq[eLen].d === 1 ? Lq[eLen].n : null)
  if (V === null) return null
  let expr: Lin7 = { a: 1, b: 0 }
  let x = V
  if (kind !== 'quad') {
    const a = rng.pick([1, 1, 2, 3])
    x = rng.int(2, Math.max(2, Math.floor(V / a) + 4))
    const b = V - a * x
    if (Math.abs(b) > 14 || (a === 1 && b === 0)) return null
    expr = { a, b }
  }
  if (x < 2) return null
  const extraPool: Len[] = kind === 'ax' ? ['b', 'h'] : kind === 'px' ? [] : ['a', 'b']
  const extra = extraPool.length > 0 && rng.chance(0.5) ? rng.pick(extraPool) : null
  return altitudeProblem({ tri, kind, asked: [], expr, x, extra }, rng)
}

export function drawAltitude(seed: number): GeoBuilt {
  const kind = weighted<AltCase>(makeRng(mixSeed(seed, 7200)), [
    ['pq', 24],
    ['ph', 12],
    ['pa', 12],
    ['pc', 10],
    ['ac', 12],
    ['hx', 8],
    ['px', 8],
    ['quad', 7],
    ['ax', 7],
  ])
  for (let attempt = 0; attempt < 800; attempt++) {
    const rng = makeRng(mixSeed(seed, 7201 + attempt))
    const built = altitudeDraw(rng, kind)
    if (built) return built
  }
  throw new Error(`rs.altitude/${seed}: no ${kind} problem`)
}

/** For the hand-worked tests: an altitude problem from a chosen triangle and case, the letters and turn from `salt`. */
export function altitudeFor(spec: AltSpec, salt = 1): GeoBuilt {
  for (let attempt = 0; attempt < 400; attempt++) {
    const built = altitudeProblem(spec, makeRng(mixSeed(salt, 9000 + attempt)))
    if (built) return built
  }
  throw new Error('no altitude problem for that spec')
}
