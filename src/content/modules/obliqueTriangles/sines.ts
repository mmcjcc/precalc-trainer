/**
 * ot.sines: two angles and a side (AAS, the side across from a given angle; ASA, the side between them). The third
 * angle first, typed, then a side by the law of sines, to the nearest tenth. The side asked always differs from the
 * one given; on ASA, and on AAS when the side asked is across from the third angle, the third angle is in the formula.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart } from '@/content/types'
import { roundPlaces } from '../explog/text'
import { m } from '../trig/text'
import { sinesCalc } from './calc'
import { decimalPart, shown, type Drafted, type Shape, type Slip } from './common'
import { VERTICES, lower, triangleFigure, type Tri, type V } from './figure'
import { OT_RULE_IDS } from './rules'
import { lengthText, roundTo, sinD, sinesSide } from './solve'
import { OT_SIDE_HINT, OT_THIRD_HINT, OT_WRONG_SIDE } from './words'

export interface SinesInput {
  kind: 'AAS' | 'ASA'
  /** The two given angles, in degrees, by vertex. */
  given: Partial<Record<V, number>>
  /** The side given, by the vertex across from it. */
  known: V
  knownLen: number
  /** The side asked, by the vertex across from it. */
  asked: V
  mirror: boolean
}

/** The angle written as she reads it. */
export const deg = (x: number): string => `${x}^{\\circ}`

/** "A = 40°, B = 60° and a = 10", in letter order, angles first. */
export function givenList(angles: Partial<Record<V, number>>, sides: Partial<Record<V, number>>): string {
  const items = [
    ...VERTICES.filter((v) => angles[v] !== undefined).map((v) => m(`${v} = ${deg(angles[v]!)}`)),
    ...VERTICES.filter((v) => sides[v] !== undefined).map((v) => m(`${lower(v)} = ${lengthText(sides[v]!)}`)),
  ]
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join('')
}

/** The whole triangle from two angles and a side. */
export function sinesTriangle(o: SinesInput): Tri & { third: V } {
  const third = VERTICES.find((v) => o.given[v] === undefined)!
  const angles = { ...o.given } as Record<V, number>
  angles[third] = 180 - VERTICES.filter((v) => v !== third).reduce((s, v) => s + angles[v], 0)
  const sides = {} as Record<V, number>
  for (const v of VERTICES) sides[v] = v === o.known ? o.knownLen : sinesSide(o.knownLen, angles[o.known], angles[v])
  return { angles, sides, third }
}

/** The side part (law of sines), shared with ot.choose. `thirdFirst` adds the third angle's line to its worked lines. */
export function sinesSidePart(o: SinesInput, thirdFirst: boolean): { part: TrigPart; early: number[]; value: number; tri: Tri & { third: V } } {
  const t = sinesTriangle(o)
  const { angles, third } = t
  const kn = lengthText(o.knownLen)
  const lc = lower(o.asked)
  const kl = lower(o.known)
  const Aa = angles[o.asked]
  const Ak = angles[o.known]
  const value = t.sides[o.asked]
  const givens = VERTICES.filter((v) => v !== third)
  const other = (not: V) => givens.find((v) => v !== not)!

  const slips: Slip[] = [
    {
      id: 'trig_radian_mode',
      value: (o.knownLen * Math.sin(Aa)) / Math.sin(Ak),
      witness: (her) => `${her} is what the calculator gives in RADIAN mode: it read ${Aa} and ${Ak} as radians, not degrees.`,
    },
    {
      id: 'ot_sines_wrong_pair',
      value: (o.knownLen * sinD(Ak)) / sinD(Aa),
      witness: (her) => `${her} is ${kn} · sin ${Ak}° / sin ${Aa}°: the side you know went over the sine of the angle you want, so the pairs are crossed.`,
    },
  ]
  if (o.known === third) {
    const g = other(o.asked)
    slips.push({
      id: 'ot_third_angle_skipped',
      value: (o.knownLen * sinD(Aa)) / sinD(angles[g]),
      witness: (her) => `${her} uses the ${angles[g]}° angle where the third angle, ${third}, belongs: ${third} is the angle across from ${kl}, so find it first.`,
    })
  } else if (o.asked === third) {
    const g = other(o.known)
    slips.push({
      id: 'ot_third_angle_skipped',
      value: (o.knownLen * sinD(angles[g])) / sinD(Ak),
      witness: (her) => `${her} uses the ${angles[g]}° angle where the third angle, ${third}, belongs: ${third} is the angle across from ${lc}, so find it first.`,
    })
  }

  const early = [
    (o.knownLen * roundTo(sinD(Aa), 2)) / roundTo(sinD(Ak), 2),
    (o.knownLen * roundTo(sinD(Aa), 3)) / roundTo(sinD(Ak), 3),
    roundTo(o.knownLen / sinD(Ak), 1) * sinD(Aa),
  ]
  const answerText = roundPlaces(value, 1)
  const reveal: string[] = []
  if (thirdFirst) reveal.push(`First the third angle: ${m(`${third} = 180^{\\circ} - ${deg(angles[givens[0]!])} - ${deg(angles[givens[1]!])} = ${deg(angles[third])}`)}.`)
  reveal.push(`Pair each side with the angle across from it: ${m(`\\frac{${lc}}{\\sin ${deg(Aa)}} = \\frac{${kn}}{\\sin ${deg(Ak)}}`)}.`)
  reveal.push(`${m(`${lc} = \\frac{${kn} \\sin ${deg(Aa)}}{\\sin ${deg(Ak)}} \\approx ${shown(value)}`)}, so ${m(lc)} is about ${m(answerText)}.`)

  const { part, early: kept } = decimalPart({
    id: 'side',
    label: `Side ${lc}`,
    ask: `What is ${m(lc)}, to the nearest tenth?`,
    nudge: `Pair each side with the angle across from it: ${m('\\frac{a}{\\sin A} = \\frac{b}{\\sin B} = \\frac{c}{\\sin C}')}. Start from the pair you know completely, and use the angle across from ${m(lc)}. Work in DEGREE mode.`,
    ruleCard: OT_RULE_IDS.sines,
    reveal,
    value,
    degrees: false,
    slips,
    early,
    wrongNote: OT_WRONG_SIDE,
    formatHint: OT_SIDE_HINT,
  })
  return { part, early: kept, value, tri: t }
}

/** The figure of a triangle from two angles and a side: the givens, the asked side's letter, the third angle's arc. */
export function sinesFigure(o: SinesInput, t: Tri & { third: V }, extra = '') {
  const kn = lengthText(o.knownLen)
  const givens = VERTICES.filter((v) => v !== t.third)
  const ariaLabel = `Triangle ABC drawn to its true shape.${extra} Angle ${givens[0]} is marked ${t.angles[givens[0]!]}° and angle ${givens[1]} is marked ${t.angles[givens[1]!]}°; angle ${t.third} has an arc and no number. Side ${lower(o.known)} is labelled ${kn}, and side ${lower(o.asked)} is labelled with its letter only.`
  const spec = triangleFigure(t, {
    sides: { [o.known]: `${lower(o.known)} = ${kn}`, [o.asked]: lower(o.asked) },
    angles: { [givens[0]!]: `${t.angles[givens[0]!]}°`, [givens[1]!]: `${t.angles[givens[1]!]}°`, [t.third]: null },
    mirror: o.mirror,
    ariaLabel,
  })
  return { spec, ariaLabel }
}

/** The problem for these numbers (exported for the hand-worked tests). */
export function sinesProblem(o: SinesInput): Drafted {
  const { part: side, early, value, tri } = sinesSidePart(o, false)
  const { angles, third } = tri
  const givens = VERTICES.filter((v) => v !== third)
  const tv = angles[third]
  const thirdPart: TrigPart = {
    id: 'third',
    kind: 'angle',
    label: `Angle ${third}`,
    ask: `What is ${m(third)}, the third angle?`,
    formatHint: OT_THIRD_HINT,
    nudge: `The three angles of a triangle add to ${m('180^{\\circ}')}. Subtract the two you know.`,
    ruleCard: OT_RULE_IDS.third,
    reveal: [`${m(`${third} = 180^{\\circ} - ${deg(angles[givens[0]!])} - ${deg(angles[givens[1]!])} = ${deg(tv)}`)}.`],
    answerText: String(tv),
    forms: [`${tv}°`],
    check: { kind: 'angle', unit: 'deg', deg: String(tv) },
    wrongNote: 'That is not the third angle. The three angles of a triangle add to 180°.',
    traps: [],
  }
  const sides = { [o.known]: o.knownLen } as Partial<Record<V, number>>
  const between = o.kind === 'ASA' ? ', with the side between those two angles' : ''
  const prompt = `In triangle ${m('ABC')}, ${givenList(o.given, sides)}${between}. Find the third angle, ${m(third)}, then side ${m(lower(o.asked))} to the nearest tenth.`
  const { spec, ariaLabel } = sinesFigure(o, tri)
  return {
    question: 'sines',
    prompt,
    oblique: { before: spec },
    ariaLabel,
    stages: [thirdPart, side],
    early: { side: early },
    promisable: side.traps,
    calc: sinesCalc({ g1: angles[givens[0]!], g2: angles[givens[1]!], known: lengthText(o.knownLen), knownAngle: angles[o.known], askedAngle: angles[o.asked], value }),
    calcExpr: `${lengthText(o.knownLen)}*sin(${angles[o.asked]}°)/sin(${angles[o.known]}°)`,
    ruleCards: [OT_RULE_IDS.third, OT_RULE_IDS.sines],
    givens: [...givens.map((v) => angles[v]), o.knownLen],
    rounded: [value],
    shapes: [shapeOf(tri)],
  }
}

/** A triangle for the checks. */
export function shapeOf(t: Tri, right = false): Shape {
  return { angles: VERTICES.map((v) => t.angles[v]), sides: VERTICES.map((v) => t.sides[v]), ...(right ? { right } : {}) }
}

/** A given length: a whole number most of the time, sometimes one decimal (never a whole number written with .0). */
export function drawLength(rng: Rng, lo: number, hi: number): number {
  if (rng.chance(0.2)) {
    const tenths = rng.int(lo * 10, hi * 10)
    return tenths % 10 === 0 ? tenths / 10 + 0.5 : tenths / 10
  }
  return rng.int(lo, hi)
}

export function drawSines(rng: Rng, as?: 'AAS' | 'ASA'): SinesInput {
  const coin = rng.chance(0.5)
  const kind = as ?? (coin ? 'AAS' : 'ASA')
  const [G0, G1, T] = rng.shuffle(VERTICES) as [V, V, V]
  const g0 = rng.int(20, 120)
  const g1 = rng.int(20, 160 - g0)
  const given = { [G0]: g0, [G1]: g1 } as Partial<Record<V, number>>
  const known: V = kind === 'ASA' ? T : rng.pick([G0, G1])
  const asked: V = kind === 'ASA' ? rng.pick([G0, G1]) : rng.chance(0.65) ? T : known === G0 ? G1 : G0
  return { kind, given, known, knownLen: drawLength(rng, 5, 40), asked, mirror: rng.chance(0.5) }
}
