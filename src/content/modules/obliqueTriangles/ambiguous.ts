/**
 * ot.ambiguous: SSA with angle A acute, sides a (across from A) and b. How many triangles fit (none, one, two), from
 * the height h = b sin A against a and a against b; then B, or both B's when two fit (the acute one, then the obtuse
 * one). The seed picks the outcome first, a third each; the right-angle case (a = h) is never drawn, and a sits
 * clear of h and of b. The prompt and the first part read the same for all three outcomes, and the flow does not
 * count the parts until she has answered how many.
 */
import type { Rng } from '@/content/rng'
import type { TrigPart } from '@/content/types'
import { LogSkip, roundPlaces } from '../explog/text'
import { m } from '../trig/text'
import { ambiguousCalc } from './calc'
import { choicePart, decimalPart, shown, type Drafted, type Shape, type Slip } from './common'
import { ssaAnsweredFigure, ssaGivenFigure } from './figure'
import { OT_RULE_IDS } from './rules'
import { deg } from './sines'
import { asinD, lengthText, roundTo, sinD, ssaCount, type SsaCount } from './solve'
import { OT_ANGLE_HINT, OT_WRONG_ANGLE } from './words'

export interface AmbiguousInput {
  A: number
  a: number
  b: number
}

export const COUNT_CHOICES = [
  { value: 'none', label: 'No triangle' },
  { value: 'one', label: 'Exactly one triangle' },
  { value: 'two', label: 'Two triangles' },
]

/** The count part, shared with nothing else: the comparison and its slips. */
function countPart(o: AmbiguousInput, count: SsaCount, h: number): TrigPart {
  const a = lengthText(o.a)
  const b = lengthText(o.b)
  const verdict: Record<SsaCount, string> = {
    none: `${m(`a = ${a}`)} is shorter than ${m('h')}, so side ${m('a')} cannot reach the base: no triangle fits.`,
    two: `${m(`a = ${a}`)} is longer than ${m('h')} but shorter than ${m(`b = ${b}`)}, so side ${m('a')} reaches the base in two places: two triangles fit.`,
    one: `${m(`a = ${a}`)} is longer than ${m(`b = ${b}`)}, so side ${m('a')} reaches the base in only one place: one triangle fits.`,
  }
  return choicePart({
    id: 'count',
    label: 'How many triangles',
    ask: 'How many triangles fit these measurements?',
    nudge: `Work out the height ${m('h = b \\sin A')} from ${m('C')} down to the base. Compare ${m('a')} with ${m('h')}, then with ${m('b')}.`,
    ruleCard: OT_RULE_IDS.ambiguous,
    reveal: [`${m(`h = ${b} \\sin ${deg(o.A)} \\approx ${shown(h)}`)}.`, verdict[count]],
    choices: COUNT_CHOICES,
    answer: count,
    traps:
      count === 'two'
        ? [{ value: 'one', id: 'ot_ssa_second_missed', witness: 'One triangle is the one with the acute B the calculator gives. Compare a with the height h = b sin A and with b: when a falls between them, side a can swing to a second place.' }]
        : count === 'one'
          ? [{ value: 'two', id: 'ot_ssa_two_claimed', witness: 'Two triangles need a to be longer than the height h and shorter than b. Check a against b as well as against h.' }]
          : [{ value: 'two', id: 'ot_ssa_two_claimed', witness: 'Two triangles need a to be longer than the height h = b sin A. Work h out and compare it with a.' }],
    wrongNote: 'Not quite. Work out h = b sin A, then compare a with h and with b.',
  })
}

/** The problem for these numbers (exported for the hand-worked tests). */
export function ambiguousProblem(o: AmbiguousInput): Drafted {
  const count = ssaCount(o.A, o.a, o.b)
  const h = o.b * sinD(o.A)
  const a = lengthText(o.a)
  const b = lengthText(o.b)
  const ratio = (o.b * sinD(o.A)) / o.a
  const B1 = asinD(ratio)
  const stages: TrigPart[] = [countPart(o, count, h)]
  const early: Record<string, number[]> = {}
  const rounded: number[] = []
  const shapes: Shape[] = []
  const lawLine = `By the law of sines, ${m(`\\sin B = \\frac{b \\sin A}{a} = \\frac{${b} \\sin ${deg(o.A)}}{${a}} \\approx ${shown(ratio)}`)}.`
  const sinNudge = `By the law of sines, ${m('\\sin B = \\frac{b \\sin A}{a}')}. Then ${m('B')} is ${m('\\sin^{-1}')} of that, in DEGREE mode.`
  const acuteSlips: Slip[] = [
    { id: 'trig_radian_mode', value: Math.asin((o.b * Math.sin(o.A)) / o.a), witness: (her) => `${her} is what the calculator gives in RADIAN mode: it read ${o.A} as radians and gave the angle back in radians.` },
    { id: 'ot_sines_wrong_pair', value: asinD((o.a * sinD(o.A)) / o.b), witness: (her) => `${her}° comes from sin B = ${a} sin ${o.A}° / ${b}: side a went with angle B. Each side goes with the angle across from it.` },
  ]
  const acuteEarly = [asinD(roundTo(ratio, 2)), asinD(roundTo(ratio, 3)), asinD((o.b * roundTo(sinD(o.A), 2)) / o.a)]
  if (count !== 'none') {
    const one = count === 'one'
    const r1 = roundPlaces(B1, 1)
    const acute = decimalPart({
      id: one ? 'B' : 'B1',
      label: one ? 'Angle B' : 'Angle B, acute',
      ask: one ? `What is ${m('B')}, to the nearest tenth of a degree?` : `In the triangle where ${m('B')} is acute, what is ${m('B')}, to the nearest tenth of a degree?`,
      nudge: sinNudge,
      ruleCard: OT_RULE_IDS.sines,
      reveal: [lawLine, `${m(`B = \\sin^{-1}(${shown(ratio)}) \\approx ${shown(B1)}^{\\circ}`)}, about ${m(deg(Number(r1)))}.${one ? ` The obtuse angle with this sine would leave less than nothing for ${m('C')} once ${m(`A = ${deg(o.A)}`)} is added, so there is only this one.` : ''}`],
      value: B1,
      degrees: true,
      slips: acuteSlips,
      early: acuteEarly,
      wrongNote: OT_WRONG_ANGLE,
      formatHint: OT_ANGLE_HINT,
    })
    stages.push(acute.part)
    early[acute.part.id] = acute.early
    rounded.push(B1)
    const C1 = 180 - o.A - B1
    shapes.push({ angles: [o.A, B1, C1], sides: [o.a, o.b, (o.a * sinD(C1)) / sinD(o.A)] })
    if (!one) {
      const B2 = 180 - B1
      const obtuse = decimalPart({
        id: 'B2',
        label: 'Angle B, obtuse',
        ask: `In the triangle where ${m('B')} is obtuse, what is ${m('B')}, to the nearest tenth of a degree?`,
        nudge: `The obtuse angle has the same sine as the acute one, and ${m('\\sin^{-1}')} only gives the acute one: subtract it from ${m('180^{\\circ}')}.`,
        ruleCard: OT_RULE_IDS.supplement,
        reveal: [`${m(`B = 180^{\\circ} - ${shown(B1)}^{\\circ} \\approx ${shown(B2)}^{\\circ}`)}, about ${m(deg(Number(roundPlaces(B2, 1))))}. It leaves ${m(`C = 180^{\\circ} - ${deg(o.A)} - B`)}, still a real angle, so this second triangle fits too.`],
        value: B2,
        degrees: true,
        slips: [
          { id: 'ot_sine_acute_taken', value: B1, witness: (her) => `${her}° is the acute angle sin⁻¹ gives. In this triangle B is obtuse, so it is 180° minus the calculator’s angle.` },
          { id: 'trig_radian_mode', value: 180 - Math.asin((o.b * Math.sin(o.A)) / o.a), witness: (her) => `${her} is 180 minus what the calculator gives in RADIAN mode: it read ${o.A} as radians.` },
        ],
        early: acuteEarly.map((e) => 180 - e),
        wrongNote: OT_WRONG_ANGLE,
        formatHint: OT_ANGLE_HINT,
      })
      stages.push(obtuse.part)
      early.B2 = obtuse.early
      rounded.push(B2)
      const C2 = 180 - o.A - B2
      shapes.push({ angles: [o.A, B2, C2], sides: [o.a, o.b, (o.a * sinD(C2)) / sinD(o.A)] })
    }
  }

  const drawing = { A: o.A, a: o.a, b: o.b, aLabel: `a = ${a}`, bLabel: `b = ${b}`, angleLabel: `${o.A}°` }
  const ariaLabel = `Angle A, marked ${o.A}°, opens between side b, labelled ${b}, and a ray along the base where side c lies. Side a, ${a} long, starts at C; it is not drawn, because where it can reach the ray is the question.`
  const afterAria: Record<SsaCount, string> = {
    none: `${ariaLabel.replace(/; it is not drawn.*$/, '.')} The height h from C to the ray is dashed, with its right angle: side a is too short to reach the ray.`,
    one: `${ariaLabel.replace(/; it is not drawn.*$/, '.')} Side a is drawn from C to the one place it meets the ray, B.`,
    two: `${ariaLabel.replace(/; it is not drawn.*$/, '.')} Side a is drawn from C to the two places it meets the ray: B, and B′ nearer to A, dashed.`,
  }
  const prompt = `In triangle ${m('ABC')}, ${m(`A = ${deg(o.A)}`)}, ${m(`a = ${a}`)} and ${m(`b = ${b}`)}. Decide how many triangles fit these measurements, then find angle ${m('B')} in each one, to the nearest tenth of a degree.`
  return {
    question: 'ambiguous',
    prompt,
    oblique: { before: ssaGivenFigure(drawing, ariaLabel), after: { stage: 'count', spec: ssaAnsweredFigure(drawing, afterAria[count]) } },
    ariaLabel,
    stages,
    early,
    promisable: stages.flatMap((s) => s.traps),
    calc: ambiguousCalc({ A: o.A, a, b, h, B: count === 'none' ? null : B1, obtuse: count === 'two' }),
    calcExpr: `${b}*sin(${o.A}°)`,
    ruleCards: [OT_RULE_IDS.ambiguous, OT_RULE_IDS.sines, OT_RULE_IDS.supplement],
    givens: [o.A, o.a, o.b],
    rounded,
    shapes,
  }
}

/** A length near `target`, whole or one decimal, as a given. */
function near(rng: Rng, lo: number, hi: number): number {
  const tenths = rng.int(Math.ceil(lo * 10), Math.floor(hi * 10))
  if (tenths % 10 === 0 || rng.chance(0.4)) return Math.max(1, Math.round(tenths / 10))
  return tenths / 10
}

/** The outcome comes from the plan (the seed alone), the numbers from the draw. */
export function drawAmbiguous(rng: Rng, count: SsaCount): AmbiguousInput {
  const A = rng.int(20, 70)
  const b = rng.int(8, 30)
  const h = b * sinD(A)
  const a = count === 'none' ? near(rng, Math.max(2, h * 0.5), h * 0.9) : count === 'two' ? near(rng, h * 1.08, b * 0.92) : near(rng, b * 1.1, b * 1.8)
  // Rounding a to a given length can move it: the outcome must still be the plan's, clear of h and of b.
  if (ssaCount(A, a, b) !== count || Math.abs(a - h) < 0.05 * h || Math.abs(a - b) < 0.05 * b) throw new LogSkip('the drawn a moved the outcome')
  return { A, b, a }
}
