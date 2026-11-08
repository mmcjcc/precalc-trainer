/**
 * Honors geometry Unit 8, module geoCircleMeasures (Jurgensen 9-4, 9-7, plus the circle equation the SAT asks):
 * products of chord parts, secants, and a tangent with a secant, then the equation of a circle.
 * Lengths are the seed's own numbers. Equation figures sit on the coordinate plane and are not spun:
 * the equation would not match a turned circle. A rim point still moves around the circle.
 */
import type { Rng } from '@/content/rng'
import type { ErrorPatternId, GeoFigureSpec } from '@/shared/types'
import type { GeoBuilt } from './build'
import { formatQty, type GeoQty } from './answer'
import { pickLetters6 } from './unit6Geom'
import { rootSay } from './unit7Build'
import {
  add,
  aimDelta,
  angleDeg,
  circleEq,
  circleSpec,
  cmWord,
  dist,
  finish8,
  generalEq,
  generate8,
  int,
  lastRefuse,
  lineCross,
  modeOf,
  numStage,
  offAxis,
  pack,
  packLoose,
  pickStage,
  pointOf,
  pointStage,
  polar,
  rad,
  rotatePromise,
  showPt,
  spin,
  sqrtQ,
  strictlyBetween,
  sub,
  type P2,
  type Trap8,
} from './unit8Build'
import { MEASURE_RULES, UNIT8_RULE_IDS } from './unit8Rules'

const LEN_INST = 'Give the exact length, in simplest radical form when it is not a whole number. The figure is there before you answer.'
const TWO_INST = 'The center is a point, like (8, 13), and the radius is a length. The figure is there before you answer.'
const PICK_INST = 'Pick one. The figure is there before you answer.'

const CROSSED = 'That multiplies a part of one chord by a part of the other. Each chord multiplies its own parts.'
const NOT_WHOLE = 'That multiplies the outside part by the inside part. The product uses the whole secant.'
const NOT_SQUARED = 'That leaves the square off the tangent. The square of the tangent equals the outside part times the whole secant.'
const NO_ROOT = 'That stops before the square root. The theorem gives the square of the tangent.'
const SIGNS = 'That reads both signs the other way. In standard form the center is (h, k), not the opposite point.'
const UNSQUARED = 'That reads the right side as the radius. The right side is the radius squared.'
const DIAMETER = 'That is the diameter. The radius reaches only to the circle.'
const SIGN_EQ = 'That flips both signs of the center. Standard form already subtracts h and k.'
const BARE_EQ = 'That leaves the radius unsquared. The right side is the radius squared.'
const DIAM_EQ = 'That squares the diameter. The right side is the square of the radius.'
const REGION_DIAM = 'That compares the point with the diameter. The comparison uses the radius.'
const REGION_SQ = 'That compares the point with the square of the radius. The comparison uses the radius.'
const REGION_SIGN = 'That measures from the opposite center. The signs in standard form are already the subtraction.'

const COORDS = [1, 2, 3, 4, 5, 6] as const
const THETAS = [40, 55, 70, 85, 100, 115, 130, 145, 160, 200, 215, 235, 255, 280, 305, 330]

function rot90(p: P2): P2 {
  return { x: -p.y, y: p.x }
}

function exposes(text: string, n: number): boolean {
  return new RegExp(`(?:^|[^0-9])${n}(?![0-9])`).test(text)
}

function ratio(num: number, den: number): GeoQty | null {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0 || num === 0) return null
  const q = rad(Math.abs(num), Math.abs(den), 1)
  if (q.n <= 0) return null
  return q
}

function qtyText(q: GeoQty): string {
  return formatQty(q)
}

function different(q: GeoQty, other: GeoQty): boolean {
  return qtyText(q) !== qtyText(other)
}

/** A circle through four points, from the perpendicular bisectors of AB and CD. */
function circleThrough(a: P2, b: P2, c: P2, d: P2): { O: P2; r: number } | null {
  const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const m2 = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 }
  const O = lineCross(m1, add(m1, rot90(sub(b, a))), m2, add(m2, rot90(sub(d, c))))
  if (!O) return null
  const r = dist(O, a)
  if (!(r > 0.4) || r > 80) return null
  for (const p of [b, c, d]) if (Math.abs(dist(O, p) - r) > 1e-6) return null
  return { O, r }
}

function apart(pts: P2[], gap: number): boolean {
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) if (dist(pts[i]!, pts[j]!) < gap) return false
  }
  return true
}

function turnAbout(p: P2, O: P2, turn: number): number {
  return aimDelta(p, O, turn)
}

function moved<T extends Record<string, P2>>(pts: T, O: P2, delta: number): T {
  const out = {} as T
  for (const key of Object.keys(pts) as (keyof T)[]) out[key] = spin(pts[key], O, delta) as T[keyof T]
  return out
}

// --- crossing chords ----------------------------------------------------------------------------------------

interface ChordPic {
  A: P2
  B: P2
  C: P2
  D: P2
  E: P2
  O: P2
  r: number
}

function chordPic(ae: number, eb: number, ce: number, ed: number, theta: number, turn: number): ChordPic | null {
  const rads = (theta * Math.PI) / 180
  const c = Math.cos(rads)
  const s = Math.sin(rads)
  if (Math.abs(s) < 0.28) return null
  const E0 = { x: 0, y: 0 }
  const A0 = { x: -ae, y: 0 }
  const B0 = { x: eb, y: 0 }
  const C0 = { x: ce * c, y: ce * s }
  const D0 = { x: -ed * c, y: -ed * s }
  const got = circleThrough(A0, B0, C0, D0)
  if (!got) return null
  if (dist(got.O, E0) > got.r - 0.35) return null
  if (!strictlyBetween(E0, A0, B0) || !strictlyBetween(E0, C0, D0)) return null
  if (!apart([A0, B0, C0, D0, E0, got.O], 0.85)) return null
  const delta = turnAbout(A0, got.O, turn)
  const O = got.O
  const pts = moved({ A: A0, B: B0, C: C0, D: D0, E: E0 }, O, delta)
  const center = spin(O, O, delta)
  if (Math.abs(dist(center, pts.A) - got.r) > 1e-6) return null
  if (Math.abs(dist(pts.A, pts.E) * dist(pts.E, pts.B) - dist(pts.C, pts.E) * dist(pts.E, pts.D)) > 1e-6) return null
  return { ...pts, O: center, r: got.r }
}

function chordProblem(rng: Rng): GeoBuilt | null {
  const ae = rng.int(2, 12)
  const eb = rng.int(2, 12)
  const ce = rng.int(2, 12)
  if (ae * eb % ce !== 0) return null
  const ed = (ae * eb) / ce
  if (ed < 2 || ed > 24 || ed === 47) return null
  const parts = [ae, eb, ce, ed]
  const hidden = rng.int(0, 3)
  const answer = parts[hidden]!
  const shown = parts.filter((_, i) => i !== hidden)
  if (shown.includes(answer) || shown.includes(47)) return null
  const names = ['ae', 'eb', 'ce', 'ed'] as const
  // The crossed product pairs a part of one chord with a part of the other.
  const crosses: GeoQty[] = []
  if (hidden === 3) {
    const q1 = ratio(ae * ce, eb)
    const q2 = ratio(eb * ce, ae)
    if (q1) crosses.push(q1)
    if (q2) crosses.push(q2)
  } else if (hidden === 2) {
    const q1 = ratio(ae * ed, eb)
    const q2 = ratio(eb * ed, ae)
    if (q1) crosses.push(q1)
    if (q2) crosses.push(q2)
  } else if (hidden === 1) {
    const q1 = ratio(ae * ce, ed)
    const q2 = ratio(ae * ed, ce)
    if (q1) crosses.push(q1)
    if (q2) crosses.push(q2)
  } else {
    const q1 = ratio(eb * ce, ed)
    const q2 = ratio(eb * ed, ce)
    if (q1) crosses.push(q1)
    if (q2) crosses.push(q2)
  }
  const ansQ = int(answer)
  const traps: Trap8[] = []
  const seen = new Set<string>()
  for (const q of crosses) {
    const text = qtyText(q)
    if (!different(q, ansQ) || seen.has(text)) continue
    if (shown.some((n) => qtyText(int(n)) === text)) continue
    seen.add(text)
    traps.push({ id: 'geo_chord_parts_crossed', value: q, witness: CROSSED })
  }
  if (traps.length === 0) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 4, ['A', 'O', 'T'])
  if (rest.length < 4) return null
  const [B, C, D, E] = rest as [string, string, string, string]
  let pic: ChordPic | null = null
  for (const theta of rng.shuffle(THETAS)) {
    pic = chordPic(ae, eb, ce, ed, theta, turn)
    if (pic) break
  }
  if (!pic) return null
  const figure = pack({
    ariaLabel: `Circle O with chords A${B} and ${C}${D} crossing at ${E} inside the circle.`,
    points: [
      pointOf('O', pic.O, pic.A, 'O'),
      pointOf('A', pic.A, pic.O, 'A'),
      pointOf(B, pic.B, pic.O, B),
      pointOf(C, pic.C, pic.O, C),
      pointOf(D, pic.D, pic.O, D),
      pointOf(E, pic.E, pic.O, E),
    ],
    circles: [{ center: 'O', r: pic.r }],
    segments: [
      { from: 'A', to: B },
      { from: C, to: D },
    ],
  })
  if (!figure) return null
  const unit = cmWord(rng)
  const labelOf = [`A${E}`, `${E}${B}`, `${C}${E}`, `${E}${D}`]
  const bits = [
    `A${E} is ${ae}${unit}`,
    `${E}${B} is ${eb}${unit}`,
    `${C}${E} is ${ce}${unit}`,
    `${E}${D} is ${ed}${unit}`,
  ]
  const told = bits.filter((_, i) => i !== hidden)
  const prompt = `Chords A${B} and ${C}${D} cross at ${E} inside circle O. ${told[0]}, ${told[1]}, and ${told[2]}. Find the length of ${labelOf[hidden]}.`
  const stage = numStage({
    id: 'a',
    label: labelOf[hidden]!,
    answer: ansQ,
    nudge: 'When two chords cross inside a circle, the product of the parts of one chord equals the product of the parts of the other.',
    ruleCard: UNIT8_RULE_IDS.chordParts,
    reveal: [`The products of the parts are equal, so ${labelOf[hidden]} is ${answer}.`],
    traps,
    givens: shown.map((n) => int(n)),
  })
  if (!stage.traps.some((t) => t.id === 'geo_chord_parts_crossed')) return null
  return finish8({
    question: 'segmentLengths',
    prompt,
    figure,
    stages: [stage],
    lengths: parts.filter((n) => n !== answer),
    title: 'Crossing chords',
    instructions: LEN_INST,
    params: { mode: 'chords', ask: names[hidden]! },
    cards: MEASURE_RULES,
    promise: rotatePromise(['geo_chord_parts_crossed'], rng),
  })
}

// --- two secants --------------------------------------------------------------------------------------------

interface SecantPic {
  P: P2
  A: P2
  B: P2
  C: P2
  D: P2
  O: P2
  r: number
}

function secantPic(o1: number, w1: number, o2: number, w2: number, theta: number, turn: number): SecantPic | null {
  const rads = (theta * Math.PI) / 180
  const c = Math.cos(rads)
  const s = Math.sin(rads)
  if (Math.abs(s) < 0.3 || Math.abs(c) > 0.98) return null
  const P0 = { x: 0, y: 0 }
  const A0 = { x: o1, y: 0 }
  const B0 = { x: w1, y: 0 }
  const C0 = { x: o2 * c, y: o2 * s }
  const D0 = { x: w2 * c, y: w2 * s }
  const got = circleThrough(A0, B0, C0, D0)
  if (!got) return null
  if (dist(got.O, P0) < got.r + 0.45) return null
  if (!strictlyBetween(A0, P0, B0) || !strictlyBetween(C0, P0, D0)) return null
  if (!apart([A0, B0, C0, D0, P0], 0.8)) return null
  const delta = turnAbout(A0, got.O, turn)
  const pts = moved({ P: P0, A: A0, B: B0, C: C0, D: D0 }, got.O, delta)
  const O = spin(got.O, got.O, delta)
  for (const p of [pts.A, pts.B, pts.C, pts.D]) if (Math.abs(dist(O, p) - got.r) > 1e-6) return null
  if (Math.abs(dist(pts.P, pts.A) * dist(pts.P, pts.B) - dist(pts.P, pts.C) * dist(pts.P, pts.D)) > 1e-4) return null
  return { ...pts, O, r: got.r }
}

function secantProblem(rng: Rng): GeoBuilt | null {
  const o1 = rng.int(2, 8)
  const inside1 = rng.int(2, 12)
  const w1 = o1 + inside1
  const o2 = rng.int(2, 8)
  const prod = o1 * w1
  if (prod % o2 !== 0) return null
  const w2 = prod / o2
  const inside2 = w2 - o2
  if (inside2 < 2 || inside2 > 28 || w2 > 36 || w2 === 47 || inside2 === 47) return null
  const askInside = rng.chance(0.5)
  const answer = askInside ? inside2 : w2
  const shown = [o1, w1, o2]
  if (shown.includes(answer)) return null
  const wrong = ratio(o1 * inside1, o2)
  if (!wrong) return null
  const ansQ = int(answer)
  if (!different(wrong, ansQ)) return null
  if (shown.some((n) => qtyText(int(n)) === qtyText(wrong))) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 4, ['A', 'O', 'T'])
  if (rest.length < 4) return null
  const [B, C, D, P] = rest as [string, string, string, string]
  let pic: SecantPic | null = null
  for (const theta of rng.shuffle(THETAS)) {
    pic = secantPic(o1, w1, o2, w2, theta, turn)
    if (pic) break
  }
  if (!pic) return null
  const figure = pack({
    ariaLabel: `Two secants from point ${P} meet circle O.`,
    points: [
      pointOf('O', pic.O, pic.A, 'O'),
      pointOf('A', pic.A, pic.O, 'A'),
      pointOf(B, pic.B, pic.O, B),
      pointOf(C, pic.C, pic.O, C),
      pointOf(D, pic.D, pic.O, D),
      pointOf(P, pic.P, pic.O, P),
    ],
    circles: [{ center: 'O', r: pic.r }],
    segments: [
      { from: P, to: B },
      { from: P, to: D },
    ],
  })
  if (!figure) return null
  const unit = cmWord(rng)
  const asked = askInside ? `${C}${D}` : `${P}${D}`
  const prompt = askInside
    ? `Two secants are drawn from point ${P}. One meets circle O at A and ${B}. The outside part ${P}A is ${o1}${unit} and the whole secant ${P}${B} is ${w1}${unit}. The other meets the circle at ${C} and ${D}, and the outside part ${P}${C} is ${o2}${unit}. Find the length of the inside part ${C}${D}.`
    : `Two secants are drawn from point ${P}. One meets circle O at A and ${B}. The outside part ${P}A is ${o1}${unit} and the whole secant ${P}${B} is ${w1}${unit}. The other meets the circle at ${C} and ${D}, and the outside part ${P}${C} is ${o2}${unit}. Find the length of the whole secant ${P}${D}.`
  const stage = numStage({
    id: 'a',
    label: asked,
    answer: ansQ,
    nudge: 'Two secants from the same outside point have equal products: the outside part times the whole secant, on each one.',
    ruleCard: UNIT8_RULE_IDS.secants,
    reveal: [
      askInside
        ? `${P}A × ${P}${B} = ${P}${C} × ${P}${D}, so the whole second secant is ${w2} and the inside part ${C}${D} is ${inside2}.`
        : `${P}A × ${P}${B} = ${P}${C} × ${P}${D}, so ${P}${D} is ${w2}.`,
    ],
    traps: [{ id: 'geo_secant_part_not_whole', value: wrong, witness: NOT_WHOLE }],
    givens: shown.map((n) => int(n)),
  })
  if (!stage.traps.some((t) => t.id === 'geo_secant_part_not_whole')) return null
  return finish8({
    question: 'segmentLengths',
    prompt,
    figure,
    stages: [stage],
    lengths: [...shown, answer],
    title: 'Two secants',
    instructions: LEN_INST,
    params: { mode: 'secants', ask: askInside ? 'inside' : 'whole' },
    cards: MEASURE_RULES,
    promise: ['geo_secant_part_not_whole'],
  })
}

// --- tangent and secant -------------------------------------------------------------------------------------

interface TanPic {
  T: P2
  A: P2
  B: P2
  P: P2
  O: P2
  r: number
}

function tanPic(outside: number, whole: number, theta: number, turn: number): TanPic | null {
  const tlen = Math.sqrt(outside * whole)
  const rads = (theta * Math.PI) / 180
  const c = Math.cos(rads)
  const s = Math.sin(rads)
  if (Math.abs(s) < 0.35) return null
  const P0 = { x: 0, y: 0 }
  const T0 = { x: tlen, y: 0 }
  const A0 = { x: outside * c, y: outside * s }
  const B0 = { x: whole * c, y: whole * s }
  const k = (outside + whole - 2 * tlen * c) / (2 * s)
  if (!(Math.abs(k) > 0.9)) return null
  const O0 = { x: tlen, y: k }
  const radius = Math.abs(k)
  if (radius > 40) return null
  for (const p of [T0, A0, B0]) if (Math.abs(dist(O0, p) - radius) > 1e-6) return null
  if (Math.abs(angleDeg(T0, O0, P0) - 90) > 1e-3) return null
  if (dist(O0, P0) < radius + 0.45) return null
  if (!strictlyBetween(A0, P0, B0)) return null
  if (!apart([T0, A0, B0, P0, O0], 0.75)) return null
  const delta = turnAbout(T0, O0, turn)
  const pts = moved({ T: T0, A: A0, B: B0, P: P0 }, O0, delta)
  const O = spin(O0, O0, delta)
  if (Math.abs(angleDeg(pts.T, O, pts.P) - 90) > 1e-3) return null
  return { ...pts, O, r: radius }
}

function tangentSecant(rng: Rng): GeoBuilt | null {
  const outside = rng.int(2, 9)
  const inside = rng.int(2, 12)
  const whole = outside + inside
  const prod = outside * whole
  if (prod === 47 || prod > 200) return null
  const radical = !Number.isInteger(Math.sqrt(prod))
  const askPart = rng.chance(0.28)
  // The inside part is asked only when the tangent is a whole number the prompt can state.
  if (askPart && radical) return null
  if (!askPart && rng.chance(0.55) === radical) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 3, ['T', 'O', 'A', 'P'])
  if (rest.length < 3) return null
  const [A, B, P] = rest as [string, string, string]
  let pic: TanPic | null = null
  for (const theta of rng.shuffle(THETAS)) {
    pic = tanPic(outside, whole, theta, turn)
    if (pic) break
  }
  if (!pic) return null
  const figure = pack({
    ariaLabel: `A tangent and a secant from point ${P}. The tangent touches the circle at T, and a right angle is marked there.`,
    points: [
      pointOf('O', pic.O, pic.T, 'O'),
      pointOf('T', pic.T, pic.O, 'T'),
      pointOf(A, pic.A, pic.O, A),
      pointOf(B, pic.B, pic.O, B),
      pointOf(P, pic.P, pic.O, P),
    ],
    circles: [{ center: 'O', r: pic.r }],
    segments: [
      { from: P, to: 'T' },
      { from: P, to: B },
      { from: 'O', to: 'T' },
    ],
    angles: [{ vertex: 'T', from: 'O', to: P, right: true }],
  })
  if (!figure) return null
  const unit = cmWord(rng)
  const tangent = sqrtQ(prod)
  const unsquared = ratio(whole, outside)
  const traps: Trap8[] = []
  if (!askPart) {
    // tangent × outside = whole, so she answers whole / outside and never squares the tangent.
    if (unsquared && different(unsquared, tangent) && qtyText(unsquared) !== String(outside) && qtyText(unsquared) !== String(whole)) {
      traps.push({ id: 'geo_tangent_not_squared', value: unsquared, witness: NOT_SQUARED })
    }
    // She stops at the product and skips the square root. A different number from the ratio, so it can be its own slip.
    const squared = int(prod)
    if (different(squared, tangent) && prod !== outside && prod !== whole) traps.push({ id: 'trig_side_not_rooted', value: squared, witness: NO_ROOT })
  } else {
    if (tangent.rad !== 1) return null
    const t = tangent.n / tangent.d
    // tangent × outside = whole, then the inside is that product minus the outside part.
    const wrongInside = outside * (t - 1)
    if (wrongInside > 0 && wrongInside !== inside && wrongInside !== outside && wrongInside !== t) {
      traps.push({ id: 'geo_tangent_not_squared', value: int(wrongInside), witness: NOT_SQUARED })
    }
  }
  if (traps.length === 0) return null
  const prompt = askPart
    ? `A tangent and a secant are drawn from point ${P}. The tangent ${P}T is ${qtyText(tangent)}${unit} and meets the radius at a right angle at T. The secant meets circle O at ${A} and ${B}, and the outside part ${P}${A} is ${outside}${unit}. Find the length of the inside part ${A}${B}.`
    : `A tangent and a secant are drawn from point ${P}. The tangent touches circle O at T and meets the radius at a right angle there. The secant meets the circle at ${A} and ${B}. The outside part ${P}${A} is ${outside}${unit} and the whole secant ${P}${B} is ${whole}${unit}. Find the length of tangent ${P}T.`
  if (askPart && exposes(prompt, inside)) return null
  if (!askPart && (exposes(prompt, tangent.rad === 1 ? tangent.n / tangent.d : -1) || shownAnswer(prompt, tangent))) return null
  const answer = askPart ? int(inside) : tangent
  const stage = numStage({
    id: 'a',
    label: askPart ? `${A}${B}` : `${P}T`,
    answer,
    nudge: 'When a tangent and a secant are drawn from the same outside point, the square of the tangent equals the outside part times the whole secant.',
    ruleCard: UNIT8_RULE_IDS.tangentSecant,
    reveal: [
      askPart
        ? `${P}T² = ${P}${A} × ${P}${B}. The whole secant is ${whole}, so the inside part ${A}${B} is ${inside}.`
        : `${P}T² = ${P}${A} × ${P}${B} = ${prod}. ${P}T = ${rootSay(tangent)}.`,
    ],
    traps,
    givens: (askPart ? [outside, tangent.n / tangent.d] : [outside, whole]).filter((n) => Number.isInteger(n) && n > 0).map((n) => int(n)),
  })
  if (stage.traps.length === 0) return null
  const promised = stage.traps.map((t) => t.id)
  return finish8({
    question: 'segmentLengths',
    prompt,
    figure,
    stages: [stage],
    lengths: [outside, whole, inside].filter((n) => Number.isInteger(n)),
    title: 'Tangent and secant',
    instructions: LEN_INST,
    params: { mode: 'tangent', ask: askPart ? 'inside' : 'tangent' },
    cards: MEASURE_RULES,
    promise: rotatePromise(promised, rng),
  })
}

function shownAnswer(prompt: string, q: GeoQty): boolean {
  return prompt.includes(qtyText(q))
}

function drawLengthsOne(rng: Rng, mode: string): GeoBuilt | null {
  if (mode === 'chords') return chordProblem(rng)
  if (mode === 'secants') return secantProblem(rng)
  return tangentSecant(rng)
}

export function drawLengths(seed: number): GeoBuilt {
  const mode = modeOf(seed, 61, ['chords', 'secants', 'tangent'] as const)
  return generate8(seed, 63, (rng) => drawLengthsOne(rng, mode))
}

// --- the equation -------------------------------------------------------------------------------------------

function pickCenter(rng: Rng): { h: number; k: number } {
  return { h: rng.sign() * rng.pick(COORDS), k: rng.sign() * rng.pick(COORDS) }
}

function equationFigure(h: number, k: number, r: number, turn: number, extra: { id: string; at: P2 }[], aria: string): GeoFigureSpec | null {
  const center = { x: h, y: k }
  const spec = circleSpec({
    center,
    r,
    turn,
    extra: extra.map((p) => pointOf(p.id, p.at, center, p.id)),
    segments: extra.length ? extra.map((p) => ({ from: 'O', to: p.id })) : undefined,
    grid: true,
    aria,
  })
  return packLoose(spec)
}

function radiusStage(r: number, rule: string, reveal: string, shown: string): ReturnType<typeof numStage> | null {
  if (exposes(shown, r)) return null
  const traps: Trap8[] = [
    { id: 'geo_radius_unsquared', value: int(r * r), witness: UNSQUARED },
    { id: 'geo_diameter_for_radius', value: int(2 * r), witness: DIAMETER },
  ]
  const stage = numStage({
    id: 'b',
    label: 'Radius',
    answer: int(r),
    nudge: 'The right side of the standard form is the radius squared, so the radius is the square root of that number.',
    ruleCard: rule,
    reveal: [reveal],
    traps,
    givens: [],
  })
  if (!stage.traps.some((t) => t.id === 'geo_radius_unsquared')) return null
  return stage
}

function centerStage(h: number, k: number, rule: string, reveal: string): ReturnType<typeof pointStage> | null {
  if (exposes(reveal, 0)) return null
  const stage = pointStage({
    id: 'a',
    label: 'Center',
    x: int(h),
    y: int(k),
    nudge: 'In standard form, (x − h) and (y − k) put the center at (h, k). The signs in front of h and k are already the subtraction.',
    ruleCard: rule,
    reveal: [reveal],
    traps: [{ id: 'geo_center_signs_flipped', x: int(-h), y: int(-k), witness: SIGNS }],
  })
  if (stage.traps.length === 0) return null
  return stage
}

function readEquation(rng: Rng): GeoBuilt | null {
  const { h, k } = pickCenter(rng)
  const r = rng.int(2, 8)
  if (r === Math.abs(h) || r === Math.abs(k) || r * r === Math.abs(h) || r * r === Math.abs(k)) return null
  const eq = circleEq(h, k, r * r)
  if (exposes(eq, r)) return null
  const turn = offAxis(rng)
  const figure = equationFigure(h, k, r, turn, [], 'Circle O on the coordinate plane, with point A on the circle.')
  if (!figure) return null
  const centerReveal = `In standard form the center is ${showPt(h, k)}.`
  if (exposes(centerReveal, r)) return null
  const center = centerStage(h, k, UNIT8_RULE_IDS.equation, centerReveal)
  const radius = radiusStage(r, UNIT8_RULE_IDS.equation, `The right side is ${r * r}, so the radius is ${r}.`, `${eq}\n${centerReveal}`)
  if (!center || !radius) return null
  return finish8({
    question: 'circleEquation',
    prompt: `The standard form of the equation of circle O is ${eq}. Find the center, then the radius.`,
    figure,
    stages: [center, radius],
    lengths: [r],
    title: 'Center and radius',
    instructions: TWO_INST,
    params: { mode: 'read' },
    cards: MEASURE_RULES,
    promise: rotatePromise(['geo_center_signs_flipped', 'geo_radius_unsquared', 'geo_diameter_for_radius'], rng),
  })
}

function onRim(h: number, k: number, r: number, turn: number): P2 {
  let best = { x: h + r, y: k }
  let bestD = -1
  const A = polar(r, turn)
  for (const at of [
    { x: h + r, y: k },
    { x: h - r, y: k },
    { x: h, y: k + r },
    { x: h, y: k - r },
  ]) {
    const d = dist(at, { x: h + A.x, y: k + A.y })
    if (d > bestD) {
      best = at
      bestD = d
    }
  }
  return best
}

function writeEquation(rng: Rng): GeoBuilt | null {
  const { h, k } = pickCenter(rng)
  const r = rng.int(2, 8)
  if (r === 1 || r * r === r || 4 * r * r === r) return null
  const fromPoint = rng.chance(0.5)
  const turn = offAxis(rng)
  const at = onRim(h, k, r, turn)
  const letter = pickLetters6(rng, 1, ['A', 'O', 'T'])[0]
  if (!letter) return null
  const right = circleEq(h, k, r * r)
  const signs = circleEq(-h, -k, r * r)
  const bare = circleEq(h, k, r)
  const diam = circleEq(h, k, 4 * r * r)
  const texts = [right, signs, bare, diam]
  if (new Set(texts).size !== 4) return null
  const figure = equationFigure(
    h,
    k,
    r,
    turn,
    fromPoint ? [{ id: letter, at }] : [],
    fromPoint ? `Circle O on the coordinate plane, with point ${letter} on the circle and point A also on the circle.` : 'Circle O on the coordinate plane, with point A on the circle.',
  )
  if (!figure) return null
  const prompt = fromPoint
    ? `Point ${letter} is ${showPt(at.x, at.y)}, and it lies on circle O. The center is ${showPt(h, k)}. Write the standard form of the equation of the circle.`
    : `Write the standard form of the equation of a circle with center ${showPt(h, k)} and radius ${r}.`
  if (texts.some((text) => prompt.toLowerCase().includes(text.toLowerCase()))) return null
  const stage = pickStage({
    id: 'a',
    label: 'Equation',
    choices: [
      { id: 'right', text: right },
      { id: 'signs', text: signs, trap: 'geo_center_signs_flipped', witness: SIGN_EQ },
      { id: 'bare', text: bare, trap: 'geo_radius_unsquared', witness: BARE_EQ },
      { id: 'diameter', text: diam, trap: 'geo_diameter_for_radius', witness: DIAM_EQ },
    ],
    answerId: 'right',
    nudge: 'Standard form puts the center in (x − h) and (y − k), and the radius squared on the right.',
    ruleCard: UNIT8_RULE_IDS.equation,
    reveal: [`The center is ${showPt(h, k)} and the radius is ${r}, so the equation is ${right}.`],
    seed: rng.int(1, 1_000_000_000),
    salt: 9,
  })
  return finish8({
    question: 'circleEquation',
    prompt,
    figure,
    stages: [stage],
    lengths: [r],
    title: 'Equation of a circle',
    instructions: PICK_INST,
    params: { mode: 'write', ask: fromPoint ? 'point' : 'radius' },
    cards: MEASURE_RULES,
    promise: rotatePromise(['geo_center_signs_flipped', 'geo_radius_unsquared', 'geo_diameter_for_radius'], rng),
  })
}

type Region = 'on' | 'in' | 'out'

function regionOf(d2: number, limit2: number): Region {
  if (d2 === limit2) return 'on'
  return d2 < limit2 ? 'in' : 'out'
}

function regionProblem(rng: Rng): GeoBuilt | null {
  const { h, k } = pickCenter(rng)
  const r = rng.int(2, 8)
  const turn = offAxis(rng)
  const letter = pickLetters6(rng, 1, ['A', 'O', 'T'])[0]
  if (!letter) return null
  const spots: { at: P2; kind: Region }[] = [
    { at: onRim(h, k, r, turn), kind: 'on' },
    { at: { x: h + 1, y: k }, kind: 'in' },
    { at: { x: h + r + 1, y: k }, kind: 'out' },
  ]
  const spot = rng.pick(spots)
  const dx = spot.at.x - h
  const dy = spot.at.y - k
  const d2 = dx * dx + dy * dy
  const correct = regionOf(d2, r * r)
  if (correct !== spot.kind) return null
  const flipped = regionOf((spot.at.x + h) ** 2 + (spot.at.y + k) ** 2, r * r)
  const byDiameter = regionOf(d2, 4 * r * r)
  const bySquare = regionOf(d2, r * r * r * r)
  const trapFor = (kind: Region): { id: ErrorPatternId; witness: string } | null => {
    if (kind === correct) return null
    if (byDiameter === kind) return { id: 'geo_diameter_for_radius', witness: REGION_DIAM }
    if (bySquare === kind) return { id: 'geo_radius_unsquared', witness: REGION_SQ }
    if (flipped === kind) return { id: 'geo_center_signs_flipped', witness: REGION_SIGN }
    return null
  }
  const sentences: Record<Region, string> = {
    on: `Point ${letter} is on the circle.`,
    in: `Point ${letter} is in the interior.`,
    out: `Point ${letter} is in the exterior.`,
  }
  const choices = (['on', 'in', 'out'] as const).map((kind) => {
    const trap = trapFor(kind)
    return trap
      ? { id: kind, text: sentences[kind], trap: trap.id, witness: trap.witness }
      : { id: kind, text: sentences[kind] }
  })
  if (!choices.some((c) => c.trap)) return null
  if (new Set(choices.map((c) => c.text)).size !== 3) return null
  const eq = circleEq(h, k, r * r)
  const prompt = `The standard form of the equation of circle O is ${eq}. Point ${letter} is ${showPt(spot.at.x, spot.at.y)}. Decide where point ${letter} is.`
  if (choices.some((c) => prompt.toLowerCase().includes(c.text.toLowerCase()))) return null
  const figure = equationFigure(h, k, r, turn, [{ id: letter, at: spot.at }], `Circle O on the coordinate plane and point ${letter}. Point A is also on the circle.`)
  if (!figure) return null
  const stage = pickStage({
    id: 'a',
    label: `Point ${letter}`,
    choices,
    answerId: correct,
    nudge: 'Compare the distance from the center to the point with the radius. Equal means on the circle, closer means the interior, and farther means the exterior.',
    ruleCard: UNIT8_RULE_IDS.region,
    reveal: [`The distance from the center to ${letter}, compared with the radius, puts the point ${correct === 'on' ? 'on the circle' : correct === 'in' ? 'in the interior' : 'in the exterior'}.`],
    seed: rng.int(1, 1_000_000_000),
    salt: 11,
  })
  const ids = stage.traps.map((t) => t.id)
  return finish8({
    question: 'circleEquation',
    prompt,
    figure,
    stages: [stage],
    lengths: [r],
    title: 'Where is the point',
    instructions: PICK_INST,
    params: { mode: 'region', ask: correct },
    cards: MEASURE_RULES,
    promise: rotatePromise(ids, rng),
  })
}

function completeEquation(rng: Rng): GeoBuilt | null {
  const { h, k } = pickCenter(rng)
  const r = rng.int(2, 8)
  const d = -2 * h
  const e = -2 * k
  const f = h * h + k * k - r * r
  if (d % 2 !== 0 || e % 2 !== 0) return null
  const eq = generalEq(d, e, f)
  if (exposes(eq, r) || exposes(eq, Math.abs(h)) || exposes(eq, Math.abs(k))) return null
  const turn = offAxis(rng)
  const figure = equationFigure(h, k, r, turn, [], 'Circle O on the coordinate plane, with point A on the circle.')
  if (!figure) return null
  const centerReveal = `Half of each linear coefficient, with the sign changed, is a coordinate of the center. The center is ${showPt(h, k)}.`
  if (exposes(centerReveal, r)) return null
  const center = centerStage(h, k, UNIT8_RULE_IDS.general, centerReveal)
  const radius = radiusStage(
    r,
    UNIT8_RULE_IDS.general,
    `After the square is completed, the right side is ${r * r}, so the radius is ${r}.`,
    `${eq}\n${centerReveal}`,
  )
  if (!center || !radius) return null
  return finish8({
    question: 'circleEquation',
    prompt: `The equation ${eq} is a circle. Find the center, then the radius.`,
    figure,
    stages: [center, radius],
    lengths: [r],
    title: 'Completing the square',
    instructions: TWO_INST,
    params: { mode: 'complete' },
    cards: MEASURE_RULES,
    promise: rotatePromise(['geo_center_signs_flipped', 'geo_radius_unsquared', 'geo_diameter_for_radius'], rng),
  })
}

function drawEquationOne(rng: Rng, mode: string): GeoBuilt | null {
  if (mode === 'read') return readEquation(rng)
  if (mode === 'write') return writeEquation(rng)
  if (mode === 'region') return regionProblem(rng)
  return completeEquation(rng)
}

export function drawEquation(seed: number): GeoBuilt {
  const mode = modeOf(seed, 71, ['read', 'write', 'region', 'complete'] as const)
  return generate8(seed, 73, (rng) => drawEquationOne(rng, mode))
}

// --- hands --------------------------------------------------------------------------------------------------

function until(make: (turn: number) => GeoBuilt | null): GeoBuilt {
  const turns = [20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320, 350, 25, 65, 100, 160]
  for (const turn of turns) {
    const built = make(turn)
    if (built) return built
  }
  throw new Error(lastRefuse || 'hand figure did not pack')
}

export function handChordParts(): GeoBuilt {
  return until((turn) => {
    const pic = chordPic(3, 8, 4, 6, 70, turn)
    if (!pic) return null
    const figure = pack({
      ariaLabel: 'Circle O with chords AB and CD crossing at E inside the circle.',
      points: [
        pointOf('O', pic.O, pic.A, 'O'),
        pointOf('A', pic.A, pic.O, 'A'),
        pointOf('B', pic.B, pic.O, 'B'),
        pointOf('C', pic.C, pic.O, 'C'),
        pointOf('D', pic.D, pic.O, 'D'),
        pointOf('E', pic.E, pic.O, 'E'),
      ],
      circles: [{ center: 'O', r: pic.r }],
      segments: [
        { from: 'A', to: 'B' },
        { from: 'C', to: 'D' },
      ],
    })
    if (!figure) return null
    const wrong = ratio(3 * 4, 8)
    if (!wrong) return null
    const stage = numStage({
      id: 'a',
      label: 'ED',
      answer: int(6),
      nudge: 'When two chords cross inside a circle, the product of the parts of one chord equals the product of the parts of the other.',
      ruleCard: UNIT8_RULE_IDS.chordParts,
      reveal: ['The products of the parts are equal, so 3 × 8 = 4 × ED and ED is 6.'],
      traps: [{ id: 'geo_chord_parts_crossed', value: wrong, witness: CROSSED }],
      givens: [int(3), int(8), int(4)],
    })
    return finish8({
      question: 'segmentLengths',
      prompt: 'Chords AB and CD cross at E inside circle O. AE is 3, EB is 8, and CE is 4. Find the length of ED.',
      figure,
      stages: [stage],
      lengths: [3, 8, 4],
      title: 'Crossing chords',
      instructions: LEN_INST,
      params: { mode: 'chords', ask: 'ed' },
      cards: MEASURE_RULES,
      promise: ['geo_chord_parts_crossed'],
    })
  })
}

export function handSecants(): GeoBuilt {
  return until((turn) => {
    const pic = secantPic(4, 9, 3, 12, 70, turn)
    if (!pic) return null
    const figure = pack({
      ariaLabel: 'Two secants from point P meet circle O.',
      points: [
        pointOf('O', pic.O, pic.A, 'O'),
        pointOf('A', pic.A, pic.O, 'A'),
        pointOf('B', pic.B, pic.O, 'B'),
        pointOf('C', pic.C, pic.O, 'C'),
        pointOf('D', pic.D, pic.O, 'D'),
        pointOf('P', pic.P, pic.O, 'P'),
      ],
      circles: [{ center: 'O', r: pic.r }],
      segments: [
        { from: 'P', to: 'B' },
        { from: 'P', to: 'D' },
      ],
    })
    if (!figure) return null
    const stage = numStage({
      id: 'a',
      label: 'PD',
      answer: int(12),
      nudge: 'Two secants from the same outside point have equal products: the outside part times the whole secant, on each one.',
      ruleCard: UNIT8_RULE_IDS.secants,
      reveal: ['PA × PB = PC × PD, so 4 × 9 = 3 × PD and PD is 12.'],
      traps: [{ id: 'geo_secant_part_not_whole', value: ratio(4 * 5, 3)!, witness: NOT_WHOLE }],
      givens: [int(4), int(9), int(3)],
    })
    return finish8({
      question: 'segmentLengths',
      prompt: 'Two secants are drawn from point P. One meets circle O at A and B. The outside part PA is 4 and the whole secant PB is 9. The other meets the circle at C and D, and the outside part PC is 3. Find the length of the whole secant PD.',
      figure,
      stages: [stage],
      lengths: [4, 9, 3, 12],
      title: 'Two secants',
      instructions: LEN_INST,
      params: { mode: 'secants', ask: 'whole' },
      cards: MEASURE_RULES,
      promise: ['geo_secant_part_not_whole'],
    })
  })
}

export function handTangentSecant(): GeoBuilt {
  return until((turn) => {
    const pic = tanPic(4, 7, 70, turn)
    if (!pic) return null
    const figure = pack({
      ariaLabel: 'A tangent and a secant from point P. The tangent touches the circle at T, and a right angle is marked there.',
      points: [
        pointOf('O', pic.O, pic.T, 'O'),
        pointOf('T', pic.T, pic.O, 'T'),
        pointOf('A', pic.A, pic.O, 'A'),
        pointOf('B', pic.B, pic.O, 'B'),
        pointOf('P', pic.P, pic.O, 'P'),
      ],
      circles: [{ center: 'O', r: pic.r }],
      segments: [
        { from: 'P', to: 'T' },
        { from: 'P', to: 'B' },
        { from: 'O', to: 'T' },
      ],
      angles: [{ vertex: 'T', from: 'O', to: 'P', right: true }],
    })
    if (!figure) return null
    const tangent = sqrtQ(28)
    const stage = numStage({
      id: 'a',
      label: 'PT',
      answer: tangent,
      nudge: 'When a tangent and a secant are drawn from the same outside point, the square of the tangent equals the outside part times the whole secant.',
      ruleCard: UNIT8_RULE_IDS.tangentSecant,
      reveal: [`PT² = PA × PB = 28. PT = ${rootSay(tangent)}.`],
      traps: [
        { id: 'geo_tangent_not_squared', value: ratio(7, 4)!, witness: NOT_SQUARED },
        { id: 'trig_side_not_rooted', value: int(28), witness: NO_ROOT },
      ],
      givens: [int(4), int(7)],
    })
    return finish8({
      question: 'segmentLengths',
      prompt: 'A tangent and a secant are drawn from point P. The tangent touches circle O at T and meets the radius at a right angle there. The secant meets the circle at A and B. The outside part PA is 4 and the whole secant PB is 7. Find the length of tangent PT.',
      figure,
      stages: [stage],
      lengths: [4, 7],
      title: 'Tangent and secant',
      instructions: LEN_INST,
      params: { mode: 'tangent', ask: 'tangent' },
      cards: MEASURE_RULES,
      promise: ['geo_tangent_not_squared', 'trig_side_not_rooted'],
    })
  })
}

export function handCircleRead(): GeoBuilt {
  const eq = circleEq(3, -2, 25)
  const figure = equationFigure(3, -2, 5, 40, [], 'Circle O on the coordinate plane, with point A on the circle.')
  if (!figure) throw new Error(lastRefuse || 'read figure')
  const center = centerStage(3, -2, UNIT8_RULE_IDS.equation, `In standard form the center is ${showPt(3, -2)}.`)
  const radius = radiusStage(5, UNIT8_RULE_IDS.equation, 'The right side is 25, so the radius is 5.', `${eq}\n${showPt(3, -2)}`)
  if (!center || !radius) throw new Error(lastRefuse || 'read stages')
  const built = finish8({
    question: 'circleEquation',
    prompt: `The standard form of the equation of circle O is ${eq}. Find the center, then the radius.`,
    figure,
    stages: [center, radius],
    lengths: [5],
    title: 'Center and radius',
    instructions: TWO_INST,
    params: { mode: 'read' },
    cards: MEASURE_RULES,
    promise: ['geo_center_signs_flipped', 'geo_radius_unsquared'],
  })
  if (!built) throw new Error(lastRefuse || 'read')
  return built
}

export function handCircleGeneral(): GeoBuilt {
  const eq = generalEq(-6, 4, -12)
  const figure = equationFigure(3, -2, 5, 40, [], 'Circle O on the coordinate plane, with point A on the circle.')
  if (!figure) throw new Error(lastRefuse || 'general figure')
  const center = centerStage(3, -2, UNIT8_RULE_IDS.general, `Half of each linear coefficient, with the sign changed, is a coordinate of the center. The center is ${showPt(3, -2)}.`)
  const radius = radiusStage(5, UNIT8_RULE_IDS.general, 'After the square is completed, the right side is 25, so the radius is 5.', `${eq}\n${showPt(3, -2)}`)
  if (!center || !radius) throw new Error(lastRefuse || 'general stages')
  const built = finish8({
    question: 'circleEquation',
    prompt: `The equation ${eq} is a circle. Find the center, then the radius.`,
    figure,
    stages: [center, radius],
    lengths: [5],
    title: 'Completing the square',
    instructions: TWO_INST,
    params: { mode: 'complete' },
    cards: MEASURE_RULES,
    promise: ['geo_center_signs_flipped', 'geo_radius_unsquared'],
  })
  if (!built) throw new Error(lastRefuse || 'general')
  return built
}
