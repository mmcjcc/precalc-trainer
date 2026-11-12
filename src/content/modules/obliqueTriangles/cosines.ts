/**
 * ot.cosines: SAS, the third side; SSS, a requested angle (most often the largest, which is obtuse in more than half
 * of those). The plan (the seed alone) decides SAS or SSS, whether the largest angle is asked and whether it is
 * obtuse; the draw picks the numbers.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart } from '@/content/types'
import { LogSkip, roundPlaces } from '../explog/text'
import { m } from '../trig/text'
import { sasCalc, sssCalc } from './calc'
import { decimalPart, shown, type Drafted, type Slip } from './common'
import { VERTICES, lower, others, triangleFigure, type Tri, type V } from './figure'
import { OT_RULE_IDS } from './rules'
import { deg, givenList, shapeOf } from './sines'
import { acosD, anglesOf, cosD, cosOfAngle, cosinesSide, lengthText, roundTo, sinD } from './solve'
import { OT_ANGLE_HINT, OT_SIDE_HINT, OT_WRONG_ANGLE, OT_WRONG_SIDE } from './words'

export interface SasInput {
  /** The vertex of the angle between the two sides she knows. */
  at: V
  C: number
  /** The two sides she knows, by the vertex across from each, in letter order (the other two vertices). */
  x: number
  y: number
  mirror: boolean
}

export interface SssInput {
  sides: Record<V, number>
  asked: V
  /** Asked as "the largest angle" (it is across from the longest side). */
  largest: boolean
  mirror: boolean
}

/** The whole triangle from SAS. */
export function sasTriangle(o: SasInput): Tri {
  const [p, q] = others(o.at)
  const sides = { [p]: o.x, [q]: o.y, [o.at]: cosinesSide(o.x, o.y, o.C) } as Record<V, number>
  return { sides, angles: anglesRecord(sides) }
}

export function anglesRecord(sides: Record<V, number>): Record<V, number> {
  const [A, B, C] = anglesOf(sides.A, sides.B, sides.C)
  return { A, B, C }
}

/** The third side by the law of cosines (shared with ot.choose). */
export function sasPart(o: SasInput): { part: TrigPart; early: number[]; value: number; tri: Tri } {
  const [P, Q] = others(o.at)
  const p = lower(P)
  const q = lower(Q)
  const c = lower(o.at)
  const x = lengthText(o.x)
  const y = lengthText(o.y)
  const sq = o.x * o.x + o.y * o.y
  const term = 2 * o.x * o.y * cosD(o.C)
  const value = Math.sqrt(sq - term)
  const slips: Slip[] = [
    { id: 'ot_cosines_term_dropped', value: Math.sqrt(sq), witness: (her) => `${her} is √(${x}² + ${y}²): the −2${p}${q} cos ${o.at} term is missing, and without it the formula only works for a right angle.` },
    { id: 'ot_square_root_skipped', value: sq - term, witness: (her) => `${her} is ${c}², the square of the side. Take the square root last.` },
  ]
  if (o.C > 90) slips.push({ id: 'ot_cos_sign_obtuse', value: Math.sqrt(sq + term), witness: (her) => `${her} subtracts the term as if cos ${o.C}° were positive. Past a right angle the cosine is negative, so the term adds and ${c} is the longest side.` })
  else slips.push({ id: 'ot_cosines_order', value: Math.sqrt((sq - 2 * o.x * o.y) * cosD(o.C)), witness: (her) => `${her} is what (${x}² + ${y}² − 2·${x}·${y}) · cos ${o.C}° gives: the subtraction happened before the multiplication.` })
  slips.push({ id: 'trig_radian_mode', value: Math.sqrt(sq - 2 * o.x * o.y * Math.cos(o.C)), witness: (her) => `${her} is what the calculator gives in RADIAN mode: it read ${o.C} as radians.` })
  const early = [Math.sqrt(sq - 2 * o.x * o.y * roundTo(cosD(o.C), 2)), Math.sqrt(sq - 2 * o.x * o.y * roundTo(cosD(o.C), 3)), Math.sqrt(Math.round(sq - term)), Math.sqrt(roundTo(sq - term, 1)), Math.sqrt(sq - roundTo(term, 0))]
  const answerText = roundPlaces(value, 1)
  const { part, early: kept } = decimalPart({
    id: 'side',
    label: `Side ${c}`,
    ask: `What is ${m(c)}, the side across from ${m(o.at)}, to the nearest tenth?`,
    nudge: `${m(o.at)} is the angle between the two sides you know, so use the law of cosines: ${m(`${c}^2 = ${p}^2 + ${q}^2 - 2${p}${q} \\cos ${o.at}`)}. Multiply before you subtract, and take the square root at the end.`,
    ruleCard: OT_RULE_IDS.cosines,
    reveal: [
      `${m(`${c}^2 = ${x}^2 + ${y}^2 - 2 \\cdot ${x} \\cdot ${y} \\cos ${deg(o.C)} \\approx ${shown(sq - term)}`)}.`,
      `${m(`${c} = \\sqrt{${shown(sq - term)}} \\approx ${shown(value)}`)}, so ${m(c)} is about ${m(answerText)}.`,
    ],
    value,
    degrees: false,
    slips,
    early,
    wrongNote: OT_WRONG_SIDE,
    formatHint: OT_SIDE_HINT,
  })
  return { part, early: kept, value, tri: sasTriangle(o) }
}

export function sasFigure(o: SasInput, tri: Tri, extra = '') {
  const [P, Q] = others(o.at)
  const x = lengthText(o.x)
  const y = lengthText(o.y)
  const ariaLabel = `Triangle ABC drawn to its true shape.${extra} Side ${lower(P)} is labelled ${x}, side ${lower(Q)} is labelled ${y}, and the angle between them, ${o.at}, is marked ${o.C}°. Side ${lower(o.at)} is labelled with its letter only.`
  const spec = triangleFigure(tri, { sides: { [P]: `${lower(P)} = ${x}`, [Q]: `${lower(Q)} = ${y}`, [o.at]: lower(o.at) }, angles: { [o.at]: `${o.C}°` }, mirror: o.mirror, ariaLabel })
  return { spec, ariaLabel }
}

/** The SAS problem for these numbers (exported for the hand-worked tests). */
export function sasProblem(o: SasInput): Drafted {
  const { part, early, value, tri } = sasPart(o)
  const [P, Q] = others(o.at)
  const prompt = `In triangle ${m('ABC')}, ${givenList({ [o.at]: o.C }, { [P]: o.x, [Q]: o.y })}. Find side ${m(lower(o.at))} to the nearest tenth.`
  const { spec, ariaLabel } = sasFigure(o, tri)
  return {
    question: 'cosines',
    prompt,
    oblique: { before: spec },
    ariaLabel,
    stages: [part],
    early: { side: early },
    promisable: part.traps,
    calc: sasCalc({ a: lengthText(o.x), b: lengthText(o.y), C: o.C, value }),
    calcExpr: `sqrt(${lengthText(o.x)}^2+${lengthText(o.y)}^2-2*${lengthText(o.x)}*${lengthText(o.y)}*cos(${o.C}°))`,
    ruleCards: [OT_RULE_IDS.cosines],
    givens: [o.C, o.x, o.y],
    rounded: [value],
    shapes: [shapeOf(tri)],
  }
}

/** An angle from three sides (shared with ot.choose). */
export function sssPart(o: SssInput): { part: TrigPart; early: number[]; value: number; tri: Tri } {
  const X = o.asked
  const [P, Q] = others(X)
  const s = o.sides
  const [p, q, x] = [lower(P), lower(Q), lower(X)]
  const [ps, qs, xs] = [lengthText(s[P]), lengthText(s[Q]), lengthText(s[X])]
  const cos = cosOfAngle(s[P], s[Q], s[X])
  const value = acosD(cos)
  const angles = anglesRecord(s)
  const slips: Slip[] = [{ id: 'trig_radian_mode', value: Math.acos(cos), witness: (her) => `${her} is the angle in radians: the calculator was in RADIAN mode.` }]
  if (value > 90) slips.push({ id: 'ot_cos_sign_obtuse', value: acosD(Math.abs(cos)), witness: (her) => `${her}° is acute, so the minus sign of the cosine was lost. (${ps}² + ${qs}² − ${xs}²) is negative here, which makes ${X} obtuse.` })
  for (const Y of [P, Q]) slips.push({ id: 'ot_cosines_wrong_side', value: angles[Y], witness: (her) => `${her}° is the angle across from ${lower(Y)}, not from ${x}: the side across from ${X} is the one subtracted.` })
  const early = [acosD(roundTo(cos, 2)), acosD(roundTo(cos, 3))]
  const answerText = roundPlaces(value, 1)
  const name = o.largest ? 'The largest angle' : `Angle ${X}`
  const { part, early: kept } = decimalPart({
    id: 'angle',
    label: name,
    ask: o.largest ? 'What is the largest angle of the triangle, to the nearest tenth of a degree?' : `What is ${m(X)}, to the nearest tenth of a degree?`,
    nudge: o.largest
      ? `The largest angle is across from the longest side. Solve the law of cosines for that angle, ${m('\\cos C = \\frac{a^2 + b^2 - c^2}{2ab}')} with ${m('c')} the longest side, then use ${m('\\cos^{-1}')} in DEGREE mode.`
      : `Solve the law of cosines for the angle: ${m(`\\cos ${X} = \\frac{${p}^2 + ${q}^2 - ${x}^2}{2${p}${q}}`)}, with ${m(x)} the side across from ${m(X)}. Then use ${m('\\cos^{-1}')} in DEGREE mode.`,
    ruleCard: OT_RULE_IDS.cosAngle,
    reveal: [
      ...(o.largest ? [`The longest side is ${m(`${x} = ${xs}`)}, so the largest angle is ${m(X)}, across from it.`] : []),
      `${m(`\\cos ${X} = \\frac{${ps}^2 + ${qs}^2 - ${xs}^2}{2 \\cdot ${ps} \\cdot ${qs}} \\approx ${shown(cos)}`)}${cos < 0 ? ', negative, so the angle is obtuse' : ''}.`,
      `${m(`${X} = \\cos^{-1}(${shown(cos)}) \\approx ${shown(value)}^{\\circ}`)}, about ${m(deg(Number(answerText)))}.`,
    ],
    value,
    degrees: true,
    slips,
    early,
    wrongNote: OT_WRONG_ANGLE,
    formatHint: OT_ANGLE_HINT,
  })
  return { part, early: kept, value, tri: { sides: s, angles } }
}

export function sssFigure(o: SssInput, tri: Tri, extra = '') {
  const s = o.sides
  const marked = o.largest ? 'The angle across from the longest side is marked with an arc and no number.' : `Angle ${o.asked} is marked with an arc and no number.`
  const ariaLabel = `Triangle ABC drawn to its true shape.${extra} Side a is labelled ${lengthText(s.A)}, side b ${lengthText(s.B)} and side c ${lengthText(s.C)}. ${marked}`
  const spec = triangleFigure(tri, { sides: Object.fromEntries(VERTICES.map((v) => [v, `${lower(v)} = ${lengthText(s[v])}`])), angles: { [o.asked]: null }, mirror: o.mirror, ariaLabel })
  return { spec, ariaLabel }
}

/** The SSS problem for these numbers (exported for the hand-worked tests). */
export function sssProblem(o: SssInput): Drafted {
  const { part, early, value, tri } = sssPart(o)
  const what = o.largest ? 'its largest angle' : `angle ${m(o.asked)}`
  const prompt = `Triangle ${m('ABC')} has sides ${givenList({}, o.sides)}. Find ${what} to the nearest tenth of a degree.`
  const { spec, ariaLabel } = sssFigure(o, tri)
  const [P, Q] = others(o.asked)
  return {
    question: 'cosines',
    prompt,
    oblique: { before: spec },
    ariaLabel,
    stages: [part],
    early: { angle: early },
    promisable: part.traps,
    calc: sssCalc({ a: lengthText(o.sides[P]), b: lengthText(o.sides[Q]), c: lengthText(o.sides[o.asked]), value }),
    calcExpr: `acos((${lengthText(o.sides[P])}^2+${lengthText(o.sides[Q])}^2-${lengthText(o.sides[o.asked])}^2)/(2*${lengthText(o.sides[P])}*${lengthText(o.sides[Q])}))`,
    ruleCards: [OT_RULE_IDS.cosAngle, OT_RULE_IDS.cosines],
    givens: VERTICES.map((v) => o.sides[v]),
    rounded: [value],
    shapes: [shapeOf(tri)],
  }
}

export function drawSas(rng: Rng, obtuse: boolean): SasInput {
  const at = rng.pick(VERTICES)
  const C = obtuse ? rng.int(95, 150) : rng.intExcept(25, 85, [60])
  const x = rng.int(4, 30)
  const y = rng.intExcept(4, 30, [x])
  return { at, C, x, y, mirror: rng.chance(0.5) }
}

/** Three whole sides from a planned shape: the largest angle obtuse or acute, its value drawn first. */
export function drawSss(rng: Rng, o: { largest: boolean; obtuse: boolean }): SssInput {
  const big = o.obtuse ? rng.int(96, 145) : rng.int(66, 84)
  // The other two share 180° − big, each from 18° up and each a few degrees under the largest.
  const rest = 180 - big
  const lo = Math.max(18, rest - big + 4)
  const hi = Math.min(big - 4, rest - 18)
  if (lo > hi) throw new LogSkip('no room for the other two angles')
  const second = rng.int(lo, hi)
  const order = rng.shuffle(VERTICES)
  const want = { [order[0]!]: big, [order[1]!]: second, [order[2]!]: 180 - big - second } as Record<V, number>
  const longest = rng.int(12, 30)
  const k = longest / sinD(big)
  const sides = Object.fromEntries(VERTICES.map((v) => [v, Math.max(3, Math.round(k * sinD(want[v])))])) as Record<V, number>
  const angles = anglesRecord(sides)
  const top = VERTICES.reduce((b, v) => (angles[v] > angles[b] ? v : b), 'A' as V)
  if (new Set(VERTICES.map((v) => sides[v])).size < 3) throw new LogSkip('two sides equal: the largest angle would not be one angle')
  if ((angles[top] > 90) !== o.obtuse) throw new LogSkip('rounding the sides changed the shape')
  const asked = o.largest ? top : rng.pick(VERTICES.filter((v) => v !== top))
  return { sides, asked, largest: o.largest, mirror: rng.chance(0.5) }
}
