/**
 * Honors geometry Unit 8, module geoCircleAngles (Jurgensen 9-5 to 9-7): an inscribed angle, an angle inside the
 * circle, and an angle outside the circle. Arcs are drawn where their measures put them.
 */
import type { Rng } from '@/content/rng'
import type { ErrorPatternId, GeoFigureSpec } from '@/shared/types'
import type { GeoBuilt } from './build'
import { pickLetters6 } from './unit6Geom'
import {
  angleDeg,
  dist,
  finish8,
  generate8,
  int,
  lastRefuse,
  lineCross,
  modeOf,
  numStage,
  offAxis,
  pack,
  pointOf,
  polar,
  rotatePromise,
  spin,
  strictlyBetween,
  type P2,
  type Trap8,
} from './unit8Build'
import { ANGLE_RULES_8, UNIT8_RULE_IDS } from './unit8Rules'

const DEG_INST = 'Give a whole number of degrees. The figure is there before you answer.'
const R = 5
const O0: P2 = { x: 0, y: 0 }

const WHOLE = 'That gives the whole intercepted arc. An inscribed angle is half of that arc.'
const HALVED = 'That gives the angle again. The intercepted arc is twice the inscribed angle.'
const SWAPPED = 'That uses the rule for the other place. Inside the circle the arcs are added; outside, they are subtracted.'
const STRAIGHT = 'That subtracts the given angle from a straight angle. The angle on the circle is a right angle, so the other two add to a right angle.'
const EQUAL_OPP = 'That sets the opposite angle equal to the given one. Opposite angles of an inscribed quadrilateral are supplementary.'

function onRim(p: P2, radius = R): boolean {
  return Math.abs(dist(p, O0) - radius) < 1e-9
}

function apart(pts: P2[]): boolean {
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) if (dist(pts[i]!, pts[j]!) < 1.05) return false
  }
  return true
}

function ship(o: {
  prompt: string
  figure: GeoFigureSpec
  label: string
  answer: number
  nudge: string
  rule: string
  reveal: string[]
  traps: Trap8[]
  givens: number[]
  title: string
  mode: string
  promise: ErrorPatternId[]
  ask?: string
}): GeoBuilt | null {
  if (!(o.answer > 0) || o.answer === 47) return null
  const stage = numStage({
    id: 'a',
    label: o.label,
    answer: int(o.answer),
    deg: true,
    nudge: o.nudge,
    ruleCard: o.rule,
    reveal: o.reveal,
    traps: o.traps,
    givens: o.givens.map((n) => int(n)),
  })
  if (stage.traps.length === 0) return null
  const have = new Set(stage.traps.map((t) => t.id))
  if (!o.promise.some((id) => have.has(id))) return null
  const outside = o.mode === 'secants' || o.mode === 'secantTangent' || o.mode === 'tangents'
  return finish8({
    question: questionFor(o.mode),
    prompt: o.prompt,
    figure: o.figure,
    stages: [stage],
    lengths: [],
    title: o.title,
    instructions: DEG_INST,
    params: { mode: o.mode, ...(o.ask ? { ask: o.ask } : {}), ...(outside ? { case: o.mode } : {}) },
    cards: ANGLE_RULES_8,
    promise: o.promise,
  })
}

function questionFor(mode: string): 'inscribed' | 'insideAngle' | 'outsideAngle' {
  if (mode === 'cross' || mode === 'tangentChord') return 'insideAngle'
  if (mode === 'secants' || mode === 'secantTangent' || mode === 'tangents') return 'outsideAngle'
  return 'inscribed'
}

// --- inscribed ----------------------------------------------------------------------------------------------

function inscribedAngle(rng: Rng, askArc: boolean): GeoBuilt | null {
  const arc = rng.int(20, 80) * 2
  const angle = arc / 2
  if (arc === 47 || angle === 47) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 2, ['A', 'O', 'T'])
  if (rest.length < 2) return null
  const [B, C] = rest as [string, string]
  const A = polar(R, turn)
  const Cp = polar(R, turn + arc)
  const Bp = polar(R, turn + arc / 2 + 180)
  if (!onRim(A) || !onRim(Cp) || !onRim(Bp) || !apart([A, Cp, Bp])) return null
  if (Math.abs(angleDeg(Bp, A, Cp) - angle) > 0.15) return null
  const figure = pack({
    ariaLabel: `Circle O with inscribed angle A${B}${C}. Points A, ${B}, and ${C} lie on the circle.`,
    points: [pointOf('O', O0, A, 'O'), pointOf('A', A, O0, 'A'), pointOf(B, Bp, O0, B), pointOf(C, Cp, O0, C)],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: 'A', to: B },
      { from: B, to: C },
      { from: C, to: 'A' },
    ],
  })
  if (!figure) return null
  const who = `A${B}${C}`
  const prompt = askArc
    ? `Inscribed angle ${who} intercepts arc A${C} and measures ${angle} degrees. Find the measure of arc A${C}.`
    : `Inscribed angle ${who} intercepts arc A${C}, which measures ${arc} degrees. Find the measure of angle ${who}.`
  const answer = askArc ? arc : angle
  const traps: Trap8[] = askArc
    ? [{ id: 'geo_arc_not_doubled', value: int(angle), witness: HALVED }]
    : [{ id: 'geo_inscribed_not_halved', value: int(arc), witness: WHOLE }]
  return ship({
    prompt,
    figure,
    label: askArc ? `Arc A${C}` : `Angle ${who}`,
    answer,
    nudge: 'An inscribed angle is half the arc it intercepts, so the arc is twice the angle.',
    rule: UNIT8_RULE_IDS.inscribed,
    reveal: askArc
      ? [`The arc is twice the inscribed angle, so arc A${C} measures ${2} × ${angle} = ${arc} degrees.`]
      : [`An inscribed angle is half its intercepted arc, so angle ${who} measures half of ${arc}, which is ${angle} degrees.`],
    traps,
    givens: askArc ? [angle] : [arc],
    title: askArc ? 'Arc of an inscribed angle' : 'Inscribed angle',
    mode: askArc ? 'arc' : 'angle',
    promise: rotatePromise(traps.map((t) => t.id), rng),
  })
}

function semicircleAngle(rng: Rng): GeoBuilt | null {
  const alpha = rng.int(20, 70)
  if (alpha === 45 || alpha === 47 || 90 - alpha === 47) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 2, ['A', 'O', 'T'])
  if (rest.length < 2) return null
  const [B, C] = rest as [string, string]
  const A = polar(R, turn)
  const Bp = polar(R, turn + 180)
  const Cp = polar(R, turn + 180 - 2 * alpha)
  if (!onRim(A) || !onRim(Bp) || !onRim(Cp) || !apart([A, Bp, Cp, O0])) return null
  const atA = angleDeg(A, Bp, Cp)
  const atB = angleDeg(Bp, A, Cp)
  const atC = angleDeg(Cp, A, Bp)
  if (Math.abs(atA - alpha) > 0.15 || Math.abs(atC - 90) > 0.15 || Math.abs(atB - (90 - alpha)) > 0.15) return null
  const figure = pack({
    ariaLabel: `Circle O with diameter A${B} and point ${C} on the circle. No right angle is marked.`,
    points: [pointOf('O', O0, A, 'O'), pointOf('A', A, O0, 'A'), pointOf(B, Bp, O0, B), pointOf(C, Cp, O0, C)],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: 'A', to: B },
      { from: 'A', to: C },
      { from: B, to: C },
    ],
  })
  if (!figure) return null
  const answer = 90 - alpha
  return ship({
    prompt: `A${B} is a diameter of circle O, and ${C} is on the circle, so triangle A${B}${C} is inscribed in a semicircle. Angle ${B}A${C} measures ${alpha} degrees. Find the measure of angle A${B}${C}.`,
    figure,
    label: `Angle A${B}${C}`,
    answer,
    nudge: 'An angle inscribed in a semicircle is a right angle. The other two angles of the triangle add to a right angle.',
    rule: UNIT8_RULE_IDS.inscribed,
    reveal: [`The angle at ${C} is a right angle, so angle A${B}${C} measures 90 − ${alpha} = ${answer} degrees.`],
    traps: [{ id: 'geo_semicircle_right_missed', value: int(180 - alpha), witness: STRAIGHT }],
    givens: [alpha],
    title: 'Angle in a semicircle',
    mode: 'semi',
    promise: ['geo_semicircle_right_missed'],
  })
}

function cyclicQuad(rng: Rng): GeoBuilt | null {
  const g = rng.int(40, 140)
  if (g === 90 || g === 47 || 180 - g === 47) return null
  const turn = offAxis(rng)
  const rest = pickLetters6(rng, 3, ['A', 'O', 'T'])
  if (rest.length < 3) return null
  const [D, C, B] = rest as [string, string, string]
  const A = polar(R, turn)
  const Dp = polar(R, turn + g)
  const Cp = polar(R, turn + 2 * g)
  const Bp = polar(R, turn + g + 180)
  const pts = [A, Dp, Cp, Bp]
  if (pts.some((p) => !onRim(p)) || !apart(pts)) return null
  const atB = angleDeg(Bp, A, Cp)
  const atD = angleDeg(Dp, A, Cp)
  if (Math.abs(atB - g) > 0.2 || Math.abs(atD - (180 - g)) > 0.2) return null
  const figure = pack({
    ariaLabel: `Quadrilateral A${D}${C}${B} inscribed in circle O.`,
    points: [pointOf('O', O0, A, 'O'), pointOf('A', A, O0, 'A'), pointOf(D, Dp, O0, D), pointOf(C, Cp, O0, C), pointOf(B, Bp, O0, B)],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: 'A', to: D },
      { from: D, to: C },
      { from: C, to: B },
      { from: B, to: 'A' },
    ],
  })
  if (!figure) return null
  const answer = 180 - g
  return ship({
    prompt: `Quadrilateral A${D}${C}${B} is inscribed in circle O. Angle A${B}${C} measures ${g} degrees. Find the measure of angle A${D}${C}.`,
    figure,
    label: `Angle A${D}${C}`,
    answer,
    nudge: 'Opposite angles of a quadrilateral inscribed in a circle are supplementary.',
    rule: UNIT8_RULE_IDS.inscribed,
    reveal: [`Opposite angles of an inscribed quadrilateral are supplementary, so angle A${D}${C} measures 180 − ${g} = ${answer} degrees.`],
    traps: [{ id: 'geo_cyclic_not_supplementary', value: int(g), witness: EQUAL_OPP }],
    givens: [g],
    title: 'Inscribed quadrilateral',
    mode: 'cyclic',
    promise: ['geo_cyclic_not_supplementary'],
  })
}

// --- inside the circle --------------------------------------------------------------------------------------

function insideCross(rng: Rng, askArc: boolean): GeoBuilt | null {
  const arc1 = rng.int(16, 60) * 2
  const arc2 = rng.int(16, 60) * 2
  if (arc1 + arc2 > 180 || arc1 + arc2 < 80 || arc1 === arc2) return null
  const gap = rng.int(36, 70)
  if (arc1 + gap + arc2 > 320) return null
  const half = (arc1 + arc2) / 2
  const diff = Math.abs(arc1 - arc2) / 2
  if (diff === 0 || diff === arc1 || diff === arc2 || diff === half || half === arc1 || half === arc2) return null
  const turn = offAxis(rng)
  const W = polar(R, turn)
  const X = polar(R, turn + arc1)
  const Y = polar(R, turn + arc1 + gap)
  const Z = polar(R, turn + arc1 + gap + arc2)
  const P = lineCross(W, Y, X, Z)
  if (!P || !strictlyBetween(P, W, Y) || !strictlyBetween(P, X, Z)) return null
  const dO = dist(P, O0)
  if (dO < 0.45 || dO > R - 0.45) return null
  if (Math.abs(angleDeg(P, W, X) - half) > 0.15) return null
  if (![W, X, Y, Z].every((p) => onRim(p)) || !apart([W, X, Y, Z, P])) return null
  const rest = pickLetters6(rng, 4, ['A', 'O', 'T'])
  if (rest.length < 4) return null
  const [Xid, Yid, Zid, E] = rest as [string, string, string, string]
  const figure = pack({
    ariaLabel: `Circle O with chords A${Yid} and ${Xid}${Zid} crossing at ${E} inside the circle.`,
    points: [
      pointOf('O', O0, W, 'O'),
      pointOf('A', W, O0, 'A'),
      pointOf(Xid, X, O0, Xid),
      pointOf(Yid, Y, O0, Yid),
      pointOf(Zid, Z, O0, Zid),
      pointOf(E, P, O0, E),
    ],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: 'A', to: Yid },
      { from: Xid, to: Zid },
    ],
  })
  if (!figure) return null
  const wrongArc = askArc ? arc1 + 2 * half : diff
  const answer = askArc ? arc2 : half
  if (wrongArc === answer || wrongArc <= 0) return null
  const prompt = askArc
    ? `Chords A${Yid} and ${Xid}${Zid} cross at point ${E} inside circle O. Angle A${E}${Xid} measures ${half} degrees, and arc A${Xid} measures ${arc1} degrees. Find the measure of arc ${Yid}${Zid}.`
    : `Chords A${Yid} and ${Xid}${Zid} cross at point ${E} inside circle O. Arc A${Xid} measures ${arc1} degrees and arc ${Yid}${Zid} measures ${arc2} degrees. Find the measure of angle A${E}${Xid}.`
  const traps: Trap8[] = [{ id: 'geo_half_sum_difference_swapped', value: int(wrongArc), witness: SWAPPED }]
  return ship({
    prompt,
    figure,
    label: askArc ? `Arc ${Yid}${Zid}` : `Angle A${E}${Xid}`,
    answer,
    nudge: 'Two chords crossing inside a circle make an angle of half the sum of the intercepted arcs.',
    rule: UNIT8_RULE_IDS.inside,
    reveal: askArc
      ? [`The angle is half the sum of the arcs, so arc ${Yid}${Zid} measures ${2} × ${half} − ${arc1} = ${arc2} degrees.`]
      : [`The angle is half the sum of the intercepted arcs, so angle A${E}${Xid} measures half of ${arc1} + ${arc2}, which is ${half} degrees.`],
    traps,
    givens: askArc ? [half, arc1] : [arc1, arc2],
    title: 'Angle of two chords',
    mode: 'cross',
    ask: askArc ? 'arc' : 'angle',
    promise: rotatePromise(['geo_half_sum_difference_swapped'], rng),
  })
}

function tangentChord(rng: Rng, askArc: boolean): GeoBuilt | null {
  const arc = rng.int(20, 75) * 2
  const angle = arc / 2
  if (angle === 47 || arc === 47) return null
  const turn = offAxis(rng)
  const T = polar(R, turn)
  const dir = { x: -T.y / R, y: T.x / R }
  const P = { x: T.x + dir.x * 3.2, y: T.y + dir.y * 3.2 }
  let chord = polar(R, turn + arc)
  let got = angleDeg(T, P, chord)
  if (Math.abs(got - angle) > 0.15) {
    chord = polar(R, turn - arc)
    got = angleDeg(T, P, chord)
  }
  if (Math.abs(got - angle) > 0.15) return null
  if (Math.abs(angleDeg(T, O0, P) - 90) > 0.05) return null
  if (!onRim(T) || !onRim(chord) || dist(T, chord) < 1.2 || dist(P, O0) < R + 0.8) return null
  const A = pickLetters6(rng, 1, ['T', 'O', 'A', 'P'])[0]
  if (!A) return null
  const figure = pack({
    ariaLabel: `A tangent at the point of tangency T and chord T${A}. A right angle is marked where the radius meets the tangent.`,
    points: [pointOf('O', O0, T, 'O'), pointOf('T', T, O0, 'T'), pointOf(A, chord, O0, A), pointOf('P', P, T, 'P')],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: 'O', to: 'T' },
      { from: 'P', to: 'T' },
      { from: 'T', to: A },
    ],
    angles: [{ vertex: 'T', from: 'O', to: 'P', right: true }],
  })
  if (!figure) return null
  // P is a fixed id. Keep it off the letter A. The outside point is only there to draw the tangent.
  const prompt = askArc
    ? `A tangent and a chord meet at the point of tangency T. The tangent meets radius OT at a right angle, and the angle formed by the tangent and chord T${A} measures ${angle} degrees. Find the measure of intercepted arc T${A}.`
    : `A tangent and chord T${A} meet at the point of tangency T. The tangent meets radius OT at a right angle. Intercepted arc T${A} measures ${arc} degrees. Find the measure of the angle formed by the tangent and the chord.`
  const traps: Trap8[] = askArc
    ? [{ id: 'geo_arc_not_doubled', value: int(angle), witness: HALVED }]
    : [{ id: 'geo_inscribed_not_halved', value: int(arc), witness: WHOLE }]
  return ship({
    prompt,
    figure,
    label: askArc ? `Arc T${A}` : `Angle at T`,
    answer: askArc ? arc : angle,
    nudge: 'A tangent and a chord meeting at the point of tangency make an angle of half the intercepted arc.',
    rule: UNIT8_RULE_IDS.inside,
    reveal: askArc
      ? [`The arc is twice that angle, so intercepted arc T${A} measures ${arc} degrees.`]
      : [`The angle is half the intercepted arc, so it measures half of ${arc}, which is ${angle} degrees.`],
    traps,
    givens: askArc ? [angle] : [arc],
    title: 'Tangent and chord',
    mode: 'tangentChord',
    ask: askArc ? 'arc' : 'angle',
    promise: rotatePromise(traps.map((t) => t.id), rng),
  })
}

// --- outside the circle -------------------------------------------------------------------------------------

interface OutsidePic {
  pts: Record<string, P2>
  angle: number
  near: number
  far: number
}

function twoSecantPic(near: number, far: number, turn: number): OutsidePic | null {
  const A0 = polar(R, -near / 2)
  const C0 = polar(R, near / 2)
  const B0 = polar(R, 180 - far / 2)
  const D0 = polar(R, 180 + far / 2)
  const P0 = lineCross(A0, D0, C0, B0)
  if (!P0) return null
  const delta = (Math.atan2(A0.y, A0.x) * 180) / Math.PI
  const spinBy = turn - delta
  const S = (p: P2) => spin(p, O0, spinBy)
  const A = S(A0)
  const C = S(C0)
  const B = S(B0)
  const D = S(D0)
  const P = S(P0)
  if (![A, C, B, D].every((p) => onRim(p))) return null
  if (!strictlyBetween(A, P, D) || !strictlyBetween(C, P, B)) return null
  if (dist(P, O0) < R + 0.6) return null
  const ang = angleDeg(P, A, C)
  if (Math.abs(ang - (far - near) / 2) > 0.2) return null
  if (!apart([A, C, B, D])) return null
  return { pts: { A, C, B, D, P }, angle: (far - near) / 2, near, far }
}

function secantTangentPic(near: number, far: number, turn: number): OutsidePic | null {
  const T0 = polar(R, 0)
  const dir = { x: -T0.y / R, y: T0.x / R }
  const pairs: readonly (readonly [number, number])[] = [
    [1, -1],
    [-1, 1],
  ]
  for (const [sign, bSign] of pairs) {
    const A0 = polar(R, sign * near)
    const B0 = polar(R, bSign * far)
    const P0 = lineCross(A0, B0, T0, { x: T0.x + dir.x, y: T0.y + dir.y })
    if (!P0) continue
    const spinBy = turn - (Math.atan2(T0.y, T0.x) * 180) / Math.PI
    const S = (p: P2) => spin(p, O0, spinBy)
    const T = S(T0)
    const A = S(A0)
    const B = S(B0)
    const P = S(P0)
    if (!onRim(T) || !onRim(A) || !onRim(B)) continue
    if (dist(P, O0) < R + 0.55) continue
    if (!strictlyBetween(A, P, B)) continue
    if (Math.abs(angleDeg(T, O0, P) - 90) > 0.08) continue
    const ang = angleDeg(P, T, A)
    if (Math.abs(ang - (far - near) / 2) > 0.2) continue
    if (!apart([T, A, B])) continue
    return { pts: { T, A, B, P }, angle: (far - near) / 2, near, far }
  }
  return null
}

function twoTangentPic(near: number, turn: number): OutsidePic | null {
  const T1 = polar(R, turn)
  const T2 = polar(R, turn + near)
  const far = R / Math.cos(((near / 2) * Math.PI) / 180)
  if (!(far > R + 0.5)) return null
  const P = polar(far, turn + near / 2)
  if (Math.abs(angleDeg(T1, O0, P) - 90) > 0.08) return null
  if (Math.abs(angleDeg(T2, O0, P) - 90) > 0.08) return null
  const ang = angleDeg(P, T1, T2)
  const want = 180 - near
  if (Math.abs(ang - want) > 0.2) return null
  if (dist(T1, T2) < 1.15) return null
  return { pts: { T: T1, B: T2, P }, angle: want, near, far: 360 - near }
}

function arcPair(rng: Rng): { near: number; far: number } | null {
  // The far arc is more than twice the near arc, so the sum-formula arc (far − 2·near) is a real positive trap.
  const near = rng.int(12, 22) * 2
  const minExtra = near + 8
  const maxExtra = Math.min(120, 168 - near)
  if (minExtra > maxExtra) return null
  const choices: number[] = []
  for (let extra = minExtra; extra <= maxExtra; extra += 2) choices.push(extra)
  const extra = choices[rng.int(0, choices.length - 1)]!
  const far = near + extra
  const angle = extra / 2
  const swapped = (far + near) / 2
  const wrongArc = far - 2 * near
  if (far + near > 300) return null
  if ([angle, swapped, wrongArc].some((n) => n === near || n === far || n === 47 || n <= 0)) return null
  if (angle === swapped || wrongArc === angle || wrongArc === swapped) return null
  return { near, far }
}

function outsideSecants(rng: Rng, askArc: boolean): GeoBuilt | null {
  const pair = arcPair(rng)
  if (!pair) return null
  const pic = twoSecantPic(pair.near, pair.far, offAxis(rng))
  if (!pic) return null
  const rest = pickLetters6(rng, 4, ['A', 'O', 'T'])
  if (rest.length < 4) return null
  const [C, B, D, P] = rest as [string, string, string, string]
  const figure = pack({
    ariaLabel: `Two secants from point ${P} meet circle O.`,
    points: [
      pointOf('O', O0, pic.pts.A!, 'O'),
      pointOf('A', pic.pts.A!, O0, 'A'),
      pointOf(C, pic.pts.C!, O0, C),
      pointOf(B, pic.pts.B!, O0, B),
      pointOf(D, pic.pts.D!, O0, D),
      pointOf(P, pic.pts.P!, O0, P),
    ],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: P, to: D },
      { from: P, to: B },
    ],
  })
  if (!figure) return null
  const angle = pic.angle
  const swapped = (pair.far + pair.near) / 2
  const prompt = askArc
    ? `Two secants from point ${P} meet circle O. One passes through A and ${D}, and the other through ${C} and ${B}. Angle A${P}${C} measures ${angle} degrees, and near arc A${C} measures ${pair.near} degrees. Find the measure of far arc ${D}${B}.`
    : `Two secants from point ${P} meet circle O. One passes through A and ${D}, and the other through ${C} and ${B}. Near arc A${C} measures ${pair.near} degrees and far arc ${D}${B} measures ${pair.far} degrees. Find the measure of angle A${P}${C}.`
  const answer = askArc ? pair.far : angle
  // Sum instead of difference: the angle would be half the sum, so the far arc would be twice the angle minus the near arc.
  const wrong = askArc ? 2 * angle - pair.near : swapped
  if (wrong === answer || wrong <= 0 || wrong === pair.near || wrong === angle) return null
  return ship({
    prompt,
    figure,
    label: askArc ? `Arc ${D}${B}` : `Angle A${P}${C}`,
    answer,
    nudge: 'Two secants from a point outside the circle make an angle of half the difference of the intercepted arcs.',
    rule: UNIT8_RULE_IDS.outside,
    reveal: askArc
      ? [`The angle is half the difference of the arcs, so the far arc measures ${pair.near} + 2 × ${angle} = ${pair.far} degrees.`]
      : [`The angle is half the difference of the arcs, so angle A${P}${C} measures half of ${pair.far} − ${pair.near}, which is ${angle} degrees.`],
    traps: [{ id: 'geo_half_sum_difference_swapped', value: int(wrong), witness: SWAPPED }],
    givens: askArc ? [angle, pair.near] : [pair.near, pair.far],
    title: 'Two secants',
    mode: 'secants',
    ask: askArc ? 'arc' : 'angle',
    promise: ['geo_half_sum_difference_swapped'],
  })
}

function outsideSecantTangent(rng: Rng, askArc: boolean): GeoBuilt | null {
  const pair = arcPair(rng)
  if (!pair) return null
  const pic = secantTangentPic(pair.near, pair.far, offAxis(rng))
  if (!pic) return null
  const rest = pickLetters6(rng, 3, ['T', 'O', 'A'])
  if (rest.length < 3) return null
  const [A, B, P] = rest as [string, string, string]
  const figure = pack({
    ariaLabel: `A tangent and a secant from point ${P}. The tangent touches the circle at T, and a right angle is marked there.`,
    points: [
      pointOf('O', O0, pic.pts.T!, 'O'),
      pointOf('T', pic.pts.T!, O0, 'T'),
      pointOf(A, pic.pts.A!, O0, A),
      pointOf(B, pic.pts.B!, O0, B),
      pointOf(P, pic.pts.P!, O0, P),
    ],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: P, to: 'T' },
      { from: P, to: B },
      { from: 'O', to: 'T' },
    ],
    angles: [{ vertex: 'T', from: 'O', to: P, right: true }],
  })
  if (!figure) return null
  const angle = pic.angle
  const swapped = (pair.far + pair.near) / 2
  const prompt = askArc
    ? `A secant and a tangent are drawn from point ${P}. The tangent touches circle O at T, and the secant passes through ${A} and ${B}. Angle T${P}${A} measures ${angle} degrees, and the near arc from T to ${A} measures ${pair.near} degrees. Find the measure of far arc T${B}.`
    : `A secant and a tangent are drawn from point ${P}. The tangent touches circle O at T, and the secant passes through ${A} and ${B}. The near intercepted arc from T to ${A} measures ${pair.near} degrees and far arc T${B} measures ${pair.far} degrees. Find the measure of angle T${P}${A}.`
  const answer = askArc ? pair.far : angle
  const wrong = askArc ? 2 * angle - pair.near : swapped
  if (wrong === answer || wrong <= 0 || wrong === pair.near || wrong === angle) return null
  return ship({
    prompt,
    figure,
    label: askArc ? `Arc T${B}` : `Angle T${P}${A}`,
    answer,
    nudge: 'A secant and a tangent from a point outside the circle make an angle of half the difference of the intercepted arcs.',
    rule: UNIT8_RULE_IDS.outside,
    reveal: askArc
      ? [`The angle is half the difference, so the far arc measures ${pair.near} + 2 × ${angle} = ${pair.far} degrees.`]
      : [`The angle is half the difference of the arcs, so it measures half of ${pair.far} − ${pair.near}, which is ${angle} degrees.`],
    traps: [{ id: 'geo_half_sum_difference_swapped', value: int(wrong), witness: SWAPPED }],
    givens: askArc ? [angle, pair.near] : [pair.near, pair.far],
    title: 'Secant and tangent',
    mode: 'secantTangent',
    ask: askArc ? 'arc' : 'angle',
    promise: ['geo_half_sum_difference_swapped'],
  })
}

function outsideTangents(rng: Rng): GeoBuilt | null {
  const askArc = rng.chance(0.4)
  const near = rng.int(40, 150)
  const angle = 180 - near
  if (near === 90 || near === 47 || angle === 47 || angle === near || angle === 180) return null
  const pic = twoTangentPic(near, offAxis(rng))
  if (!pic) return null
  const rest = pickLetters6(rng, 2, ['T', 'O', 'A'])
  if (rest.length < 2) return null
  const [B, P] = rest as [string, string]
  const figure = pack({
    ariaLabel: `Two tangents from point ${P} touch the circle at T and ${B}. Right angles are marked at the points of tangency.`,
    points: [pointOf('O', O0, pic.pts.T!, 'O'), pointOf('T', pic.pts.T!, O0, 'T'), pointOf(B, pic.pts.B!, O0, B), pointOf(P, pic.pts.P!, O0, P)],
    circles: [{ center: 'O', r: R }],
    segments: [
      { from: P, to: 'T' },
      { from: P, to: B },
      { from: 'O', to: 'T' },
      { from: 'O', to: B },
    ],
    angles: [
      { vertex: 'T', from: 'O', to: P, right: true },
      { vertex: B, from: 'O', to: P, right: true },
    ],
  })
  if (!figure) return null
  if (Math.abs(pic.angle - angle) > 0.2) return null
  // Half the sum of the two arcs is a straight angle, which the prompt does not print.
  const prompt = askArc
    ? `Two tangents from point ${P} touch circle O at T and at ${B}. Angle T${P}${B} measures ${angle} degrees, and the two intercepted arcs make one full turn. Find the measure of minor arc T${B}.`
    : `Two tangents from point ${P} touch circle O at T and at ${B}. Minor arc T${B} measures ${near} degrees, and the two intercepted arcs make one full turn. Find the measure of angle T${P}${B}.`
  return ship({
    prompt,
    figure,
    label: askArc ? `Arc T${B}` : `Angle T${P}${B}`,
    answer: askArc ? near : angle,
    nudge: 'Two tangents from a point outside the circle make an angle of half the difference of the intercepted arcs, and those two arcs make one full turn.',
    rule: UNIT8_RULE_IDS.outside,
    reveal: [
      askArc
        ? `The angle is a straight angle minus the minor arc, so minor arc T${B} measures ${near} degrees.`
        : `The far arc is a full turn minus ${near}, so the angle is half of that difference, which is ${angle} degrees.`,
    ],
    traps: [{ id: 'geo_half_sum_difference_swapped', value: int(180), witness: SWAPPED }],
    givens: [askArc ? angle : near],
    title: 'Two tangents',
    mode: 'tangents',
    ask: askArc ? 'arc' : 'angle',
    promise: ['geo_half_sum_difference_swapped'],
  })
}

function drawInscribedOne(rng: Rng, mode: string): GeoBuilt | null {
  if (mode === 'angle') return inscribedAngle(rng, false)
  if (mode === 'arc') return inscribedAngle(rng, true)
  if (mode === 'semi') return semicircleAngle(rng)
  return cyclicQuad(rng)
}

function drawInsideOne(rng: Rng, mode: string): GeoBuilt | null {
  const askArc = rng.chance(0.45)
  if (mode === 'tangentChord') return tangentChord(rng, askArc)
  return insideCross(rng, askArc)
}

function drawOutsideOne(rng: Rng, mode: string): GeoBuilt | null {
  const askArc = rng.chance(0.4)
  if (mode === 'secants') return outsideSecants(rng, askArc)
  if (mode === 'secantTangent') return outsideSecantTangent(rng, askArc)
  return outsideTangents(rng)
}

export function drawInscribed(seed: number): GeoBuilt {
  const mode = modeOf(seed, 31, ['angle', 'arc', 'semi', 'cyclic'] as const)
  return generate8(seed, 33, (rng) => drawInscribedOne(rng, mode))
}

export function drawInside(seed: number): GeoBuilt {
  const mode = modeOf(seed, 41, ['cross', 'tangentChord'] as const)
  return generate8(seed, 43, (rng) => drawInsideOne(rng, mode))
}

export function drawOutside(seed: number): GeoBuilt {
  const mode = modeOf(seed, 51, ['secants', 'secantTangent', 'tangents'] as const)
  return generate8(seed, 53, (rng) => drawOutsideOne(rng, mode))
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

export function handInscribed86(): GeoBuilt {
  return until((turn) => {
    const arc = 86
    const angle = 43
    const A = polar(R, turn)
    const C = polar(R, turn + arc)
    const B = polar(R, turn + arc / 2 + 180)
    if (Math.abs(angleDeg(B, A, C) - angle) > 0.15) return null
    const figure = pack({
      ariaLabel: 'Circle O with inscribed angle ABC. Points A, B, and C lie on the circle.',
      points: [pointOf('O', O0, A, 'O'), pointOf('A', A, O0, 'A'), pointOf('B', B, O0, 'B'), pointOf('C', C, O0, 'C')],
      circles: [{ center: 'O', r: R }],
      segments: [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
      ],
    })
    if (!figure) return null
    return ship({
      prompt: 'Inscribed angle ABC intercepts arc AC, which measures 86 degrees. Find the measure of angle ABC.',
      figure,
      label: 'Angle ABC',
      answer: angle,
      nudge: 'An inscribed angle is half the arc it intercepts, so the arc is twice the angle.',
      rule: UNIT8_RULE_IDS.inscribed,
      reveal: ['An inscribed angle is half its intercepted arc, so angle ABC measures half of 86, which is 43 degrees.'],
      traps: [{ id: 'geo_inscribed_not_halved', value: int(arc), witness: WHOLE }],
      givens: [arc],
      title: 'Inscribed angle',
      mode: 'angle',
      promise: ['geo_inscribed_not_halved'],
    })
  })
}

export function handInside90(): GeoBuilt {
  return until((turn) => {
    const arc1 = 70
    const arc2 = 110
    const gap = 50
    const W = polar(R, turn)
    const X = polar(R, turn + arc1)
    const Y = polar(R, turn + arc1 + gap)
    const Z = polar(R, turn + arc1 + gap + arc2)
    const P = lineCross(W, Y, X, Z)
    if (!P || Math.abs(angleDeg(P, W, X) - 90) > 0.2) return null
    if (!strictlyBetween(P, W, Y) || !strictlyBetween(P, X, Z)) return null
    const figure = pack({
      ariaLabel: 'Circle O with chords AY and XZ crossing at E inside the circle.',
      points: [
        pointOf('O', O0, W, 'O'),
        pointOf('A', W, O0, 'A'),
        pointOf('X', X, O0, 'X'),
        pointOf('Y', Y, O0, 'Y'),
        pointOf('Z', Z, O0, 'Z'),
        pointOf('E', P, O0, 'E'),
      ],
      circles: [{ center: 'O', r: R }],
      segments: [
        { from: 'A', to: 'Y' },
        { from: 'X', to: 'Z' },
      ],
    })
    if (!figure) return null
    return ship({
      prompt: 'Chords AY and XZ cross at point E inside circle O. Arc AX measures 70 degrees and arc YZ measures 110 degrees. Find the measure of angle AEX.',
      figure,
      label: 'Angle AEX',
      answer: 90,
      nudge: 'Two chords crossing inside a circle make an angle of half the sum of the intercepted arcs.',
      rule: UNIT8_RULE_IDS.inside,
      reveal: ['The angle is half the sum of the intercepted arcs, so angle AEX measures half of 70 + 110, which is 90 degrees.'],
      traps: [{ id: 'geo_half_sum_difference_swapped', value: int(20), witness: SWAPPED }],
      givens: [70, 110],
      title: 'Angle of two chords',
      mode: 'cross',
      ask: 'angle',
      promise: ['geo_half_sum_difference_swapped'],
    })
  })
}

export function handTwoTangentAngle(): GeoBuilt {
  return until((turn) => {
    const pic = twoTangentPic(110, turn)
    if (!pic || pic.angle !== 70) return null
    const figure = pack({
      ariaLabel: 'Two tangents from point P touch the circle at T and B. Right angles are marked at the points of tangency.',
      points: [pointOf('O', O0, pic.pts.T!, 'O'), pointOf('T', pic.pts.T!, O0, 'T'), pointOf('B', pic.pts.B!, O0, 'B'), pointOf('P', pic.pts.P!, O0, 'P')],
      circles: [{ center: 'O', r: R }],
      segments: [
        { from: 'P', to: 'T' },
        { from: 'P', to: 'B' },
        { from: 'O', to: 'T' },
        { from: 'O', to: 'B' },
      ],
      angles: [
        { vertex: 'T', from: 'O', to: 'P', right: true },
        { vertex: 'B', from: 'O', to: 'P', right: true },
      ],
    })
    if (!figure) return null
    return ship({
      prompt: 'Two tangents from point P touch circle O at T and at B. Minor arc TB measures 110 degrees, and the two intercepted arcs make one full turn. Find the measure of angle TPB.',
      figure,
      label: 'Angle TPB',
      answer: 70,
      nudge: 'Two tangents from a point outside the circle make an angle of half the difference of the intercepted arcs, and those two arcs make one full turn.',
      rule: UNIT8_RULE_IDS.outside,
      reveal: ['The far arc is a full turn minus 110, so the angle is half of that difference, which is 70 degrees.'],
      traps: [{ id: 'geo_half_sum_difference_swapped', value: int(180), witness: SWAPPED }],
      givens: [110],
      title: 'Two tangents',
      mode: 'tangents',
      ask: 'angle',
      promise: ['geo_half_sum_difference_swapped'],
    })
  })
}

export function handCyclic(): GeoBuilt {
  return until((turn) => {
    const g = 70
    const A = polar(R, turn)
    const D = polar(R, turn + g)
    const C = polar(R, turn + 2 * g)
    const B = polar(R, turn + g + 180)
    if (Math.abs(angleDeg(B, A, C) - g) > 0.2 || Math.abs(angleDeg(D, A, C) - 110) > 0.2) return null
    const figure = pack({
      ariaLabel: 'Quadrilateral ADCB inscribed in circle O.',
      points: [pointOf('O', O0, A, 'O'), pointOf('A', A, O0, 'A'), pointOf('D', D, O0, 'D'), pointOf('C', C, O0, 'C'), pointOf('B', B, O0, 'B')],
      circles: [{ center: 'O', r: R }],
      segments: [
        { from: 'A', to: 'D' },
        { from: 'D', to: 'C' },
        { from: 'C', to: 'B' },
        { from: 'B', to: 'A' },
      ],
    })
    if (!figure) return null
    return ship({
      prompt: 'Quadrilateral ADCB is inscribed in circle O. Angle ABC measures 70 degrees. Find the measure of angle ADC.',
      figure,
      label: 'Angle ADC',
      answer: 110,
      nudge: 'Opposite angles of a quadrilateral inscribed in a circle are supplementary.',
      rule: UNIT8_RULE_IDS.inscribed,
      reveal: ['Opposite angles of an inscribed quadrilateral are supplementary, so angle ADC measures 180 − 70 = 110 degrees.'],
      traps: [{ id: 'geo_cyclic_not_supplementary', value: int(70), witness: EQUAL_OPP }],
      givens: [70],
      title: 'Inscribed quadrilateral',
      mode: 'cyclic',
      promise: ['geo_cyclic_not_supplementary'],
    })
  })
}

export function handSemicircleAngle(): GeoBuilt {
  return until((turn) => {
    const alpha = 35
    const A = polar(R, turn)
    const B = polar(R, turn + 180)
    const C = polar(R, turn + 180 - 2 * alpha)
    if (Math.abs(angleDeg(A, B, C) - alpha) > 0.15 || Math.abs(angleDeg(B, A, C) - 55) > 0.15) return null
    if (Math.abs(angleDeg(C, A, B) - 90) > 0.15) return null
    const figure = pack({
      ariaLabel: 'Circle O with diameter AB and point C on the circle. No right angle is marked.',
      points: [pointOf('O', O0, A, 'O'), pointOf('A', A, O0, 'A'), pointOf('B', B, O0, 'B'), pointOf('C', C, O0, 'C')],
      circles: [{ center: 'O', r: R }],
      segments: [
        { from: 'A', to: 'B' },
        { from: 'A', to: 'C' },
        { from: 'B', to: 'C' },
      ],
    })
    if (!figure) return null
    return ship({
      prompt: 'AB is a diameter of circle O, and C is on the circle, so triangle ABC is inscribed in a semicircle. Angle BAC measures 35 degrees. Find the measure of angle ABC.',
      figure,
      label: 'Angle ABC',
      answer: 55,
      nudge: 'An angle inscribed in a semicircle is a right angle. The other two angles of the triangle add to a right angle.',
      rule: UNIT8_RULE_IDS.inscribed,
      reveal: ['The angle at C is a right angle, so angle ABC measures 90 − 35 = 55 degrees.'],
      traps: [{ id: 'geo_semicircle_right_missed', value: int(145), witness: STRAIGHT }],
      givens: [35],
      title: 'Angle in a semicircle',
      mode: 'semi',
      promise: ['geo_semicircle_right_missed'],
    })
  })
}
