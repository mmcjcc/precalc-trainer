/**
 * ot.area: the area from two sides and the angle between them (½ab sin C), or from three sides by Heron's formula.
 * The plan (the seed alone) picks which; the draw picks the numbers.
 */
import type { Rng } from '@/content/rng'
import { LogSkip, roundPlaces } from '../explog/text'
import { m } from '../trig/text'
import { heronCalc, sasAreaCalc } from './calc'
import { decimalPart, shown, type Drafted, type Slip } from './common'
import { anglesRecord, sasTriangle, type SasInput } from './cosines'
import { VERTICES, lower, others, triangleFigure, type V } from './figure'
import { OT_RULE_IDS } from './rules'
import { deg, givenList, shapeOf } from './sines'
import { heronArea, lengthText, roundTo, sinD, cosD } from './solve'
import { OT_AREA_HINT, OT_WRONG_AREA } from './words'

const ASK = `What is the area of triangle ${m('ABC')}, to the nearest tenth?`

/** Area from two sides and the angle between them. */
export function sasAreaProblem(o: SasInput): Drafted {
  const [P, Q] = others(o.at)
  const [p, q] = [lower(P), lower(Q)]
  const [x, y] = [lengthText(o.x), lengthText(o.y)]
  const value = 0.5 * o.x * o.y * sinD(o.C)
  const slips: Slip[] = [
    { id: 'ot_area_half_dropped', value: o.x * o.y * sinD(o.C), witness: (her) => `${her} is ${x} · ${y} · sin ${o.C}°, with no ½: that is the parallelogram, twice the triangle.` },
    { id: 'ot_area_cosine', value: 0.5 * o.x * o.y * cosD(o.C), witness: (her) => `${her} uses cos ${o.C}°. The height comes from the sine, so the area uses sin.` },
    { id: 'trig_radian_mode', value: 0.5 * o.x * o.y * Math.sin(o.C), witness: (her) => `${her} is what the calculator gives in RADIAN mode: it read ${o.C} as radians.` },
  ]
  const answerText = roundPlaces(value, 1)
  const { part, early } = decimalPart({
    id: 'area',
    label: 'Area',
    ask: ASK,
    nudge: `${m(o.at)} is the angle between the two sides you know, so the area is ${m(`\\frac{1}{2} ${p}${q} \\sin ${o.at}`)}. Work it out in DEGREE mode.`,
    ruleCard: OT_RULE_IDS.areaSas,
    reveal: [`${m(`\\text{area} = \\frac{1}{2} \\cdot ${x} \\cdot ${y} \\sin ${deg(o.C)} \\approx ${shown(value)}`)}, about ${m(answerText)} square units.`],
    value,
    degrees: false,
    slips,
    early: [0.5 * o.x * o.y * roundTo(sinD(o.C), 2), 0.5 * o.x * o.y * roundTo(sinD(o.C), 3)],
    wrongNote: OT_WRONG_AREA,
    formatHint: OT_AREA_HINT,
  })
  const tri = sasTriangle(o)
  const ariaLabel = `Triangle ABC drawn to its true shape. Side ${p} is labelled ${x}, side ${q} is labelled ${y}, and the angle between them, ${o.at}, is marked ${o.C}°.`
  const spec = triangleFigure(tri, { sides: { [P]: `${p} = ${x}`, [Q]: `${q} = ${y}` }, angles: { [o.at]: `${o.C}°` }, mirror: o.mirror, ariaLabel })
  return {
    question: 'area',
    prompt: `In triangle ${m('ABC')}, ${givenList({ [o.at]: o.C }, { [P]: o.x, [Q]: o.y })}. Find the area of the triangle to the nearest tenth.`,
    oblique: { before: spec },
    ariaLabel,
    stages: [part],
    early: { area: early },
    promisable: part.traps,
    calc: sasAreaCalc({ a: x, b: y, C: o.C, value }),
    calcExpr: `0.5*${x}*${y}*sin(${o.C}°)`,
    ruleCards: [OT_RULE_IDS.areaSas, OT_RULE_IDS.heron],
    givens: [o.C, o.x, o.y],
    rounded: [value],
    shapes: [shapeOf(tri)],
  }
}

export interface HeronInput {
  sides: Record<V, number>
  mirror: boolean
}

/** Area from three sides by Heron's formula. */
export function heronProblem(o: HeronInput): Drafted {
  const s3 = VERTICES.map((v) => o.sides[v]) as [number, number, number]
  const [a, b, c] = s3.map(lengthText) as [string, string, string]
  const P = s3[0] + s3[1] + s3[2]
  const s = P / 2
  const value = heronArea(...s3)
  const product = s * (s - s3[0]) * (s - s3[1]) * (s - s3[2])
  const slips: Slip[] = [
    { id: 'ot_heron_perimeter', value: Math.sqrt(P * (P - s3[0]) * (P - s3[1]) * (P - s3[2])), witness: (her) => `${her} uses the whole perimeter, ${lengthText(P)}, where s belongs. s is half of it.` },
    { id: 'ot_square_root_skipped', value: product, witness: (her) => `${her} is s(s − a)(s − b)(s − c) itself. The area is its square root.` },
  ]
  const answerText = roundPlaces(value, 1)
  const sText = lengthText(s)
  const { part, early } = decimalPart({
    id: 'area',
    label: 'Area',
    ask: ASK,
    nudge: `Three sides and no angle: Heron’s formula. First ${m('s = \\frac{a + b + c}{2}')}, half the perimeter, then the area is ${m('\\sqrt{s(s - a)(s - b)(s - c)}')}.`,
    ruleCard: OT_RULE_IDS.heron,
    reveal: [
      `${m(`s = \\frac{${a} + ${b} + ${c}}{2} = ${sText}`)}.`,
      `${m(`\\text{area} = \\sqrt{${sText}(${sText} - ${a})(${sText} - ${b})(${sText} - ${c})} = \\sqrt{${shown(product)}} \\approx ${shown(value)}`)}, about ${m(answerText)} square units.`,
    ],
    value,
    degrees: false,
    slips,
    early: [],
    wrongNote: OT_WRONG_AREA,
    formatHint: OT_AREA_HINT,
  })
  const tri = { sides: o.sides, angles: anglesRecord(o.sides) }
  const ariaLabel = `Triangle ABC drawn to its true shape. Side a is labelled ${a}, side b ${b} and side c ${c}. No angle is marked.`
  const spec = triangleFigure(tri, { sides: Object.fromEntries(VERTICES.map((v) => [v, `${lower(v)} = ${lengthText(o.sides[v])}`])), angles: {}, mirror: o.mirror, ariaLabel })
  return {
    question: 'area',
    prompt: `Triangle ${m('ABC')} has sides ${givenList({}, o.sides)}. Find its area to the nearest tenth.`,
    oblique: { before: spec },
    ariaLabel,
    stages: [part],
    early: { area: early },
    promisable: part.traps,
    calc: heronCalc({ a, b, c, s, value }),
    calcExpr: `sqrt(${sText}*(${sText}-${a})*(${sText}-${b})*(${sText}-${c}))`,
    ruleCards: [OT_RULE_IDS.heron, OT_RULE_IDS.areaSas],
    givens: s3,
    rounded: [value],
    shapes: [shapeOf(tri)],
  }
}

export function drawSasArea(rng: Rng): SasInput {
  const at = rng.pick(VERTICES)
  const C = rng.intExcept(20, 155, [60, 90])
  const x = rng.int(4, 30)
  const y = rng.intExcept(4, 30, [x])
  return { at, C, x, y, mirror: rng.chance(0.5) }
}

export function drawHeron(rng: Rng): HeronInput {
  const a = rng.int(4, 30)
  const b = rng.int(4, 30)
  const lo = Math.abs(a - b) + 2
  const hi = a + b - 2
  if (lo > hi) throw new LogSkip('no third side')
  const c = rng.int(lo, Math.min(hi, 35))
  const order = rng.shuffle([a, b, c])
  if (new Set(order).size < 2) throw new LogSkip('equilateral')
  return { sides: { A: order[0]!, B: order[1]!, C: order[2]! }, mirror: rng.chance(0.5) }
}
