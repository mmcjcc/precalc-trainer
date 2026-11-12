/**
 * ot.choose: from what is given (said in the prompt and drawn), which law starts the solution: the law of sines
 * (AAS, ASA, SSA with one triangle), the law of cosines (SAS, SSS), or neither, because one angle is a right angle.
 * Then the first unknown that start gives, rounded to the tenth. The plan (the seed alone) picks the answer, about
 * two in five each for the laws and one in five for the right triangle; the draw picks the case and the numbers.
 */
import type { Rng } from '@/content/rng'
import type { ErrorPatternId } from '@/shared/types'
import type { TrigPart } from '@/content/types'
import { LogSkip, roundPlaces } from '../explog/text'
import { m } from '../trig/text'
import { ambiguousProblem, drawAmbiguous } from './ambiguous'
import { rightCalc, sasCalc, sinesCalc, sssCalc, ambiguousCalc } from './calc'
import { choicePart, decimalPart, shown, type Drafted, type Slip } from './common'
import { drawSas, drawSss, sasFigure, sasPart, sssFigure, sssPart } from './cosines'
import { VERTICES, lower, others, triangleFigure, type V } from './figure'
import { OT_RULE_IDS } from './rules'
import { deg, drawLength, drawSines, givenList, shapeOf, sinesFigure, sinesSidePart, type SinesInput } from './sines'
import { anglesRecord } from './cosines'
import { cosD, lengthText, sinD, ssaCount } from './solve'
import { OT_SIDE_HINT, OT_WRONG_SIDE } from './words'

export type Law = 'sines' | 'cosines' | 'neither'
export type ChooseCase = 'AAS' | 'ASA' | 'SSA' | 'SAS' | 'SSS' | 'legs' | 'leg' | 'ratio'

export const LAW_CHOICES = [
  { value: 'sines', label: 'The law of sines' },
  { value: 'cosines', label: 'The law of cosines' },
  { value: 'neither', label: 'Neither law: it is a right triangle' },
]

const WHY: Record<ChooseCase, string> = {
  AAS: 'Two angles and a side across from one of them are known: an angle and its side make a pair, so the law of sines starts.',
  ASA: 'Two angles and the side between them are known: the third angle is across from that side, so once it is found the law of sines starts.',
  SSA: 'Two sides and an angle across from one of them are known: that angle and its side make a pair, so the law of sines starts.',
  SAS: 'Two sides and the angle between them are known, and no angle is paired with its side: the law of cosines starts.',
  SSS: 'Three sides and no angle are known: the law of cosines starts.',
  legs: 'The right angle is marked, so neither law is needed: the Pythagorean theorem gives the third side.',
  leg: 'The right angle is marked, so neither law is needed: the Pythagorean theorem gives the third side.',
  ratio: 'The right angle is marked, so neither law is needed: SOH CAH TOA gives the side.',
}

const LAW_OF: Record<ChooseCase, Law> = { AAS: 'sines', ASA: 'sines', SSA: 'sines', SAS: 'cosines', SSS: 'cosines', legs: 'neither', leg: 'neither', ratio: 'neither' }

function lawTraps(c: ChooseCase): { value: string; id: ErrorPatternId; witness: string }[] {
  const law = LAW_OF[c]
  const noRight = { value: 'neither', id: 'ot_right_assumed' as const, witness: 'No angle here is a right angle, so SOH CAH TOA and the Pythagorean theorem do not apply.' }
  if (law === 'sines') return [{ value: 'cosines', id: 'ot_cosines_for_pair', witness: c === 'ASA' ? 'Two angles give the third, and the third is across from the side you know: that pair starts the law of sines. The law of cosines needs two sides.' : 'An angle and the side across from it are both known, so the law of sines goes straight to the next part. The law of cosines needs two sides and the angle between them, or three sides.' }, noRight]
  if (law === 'cosines') return [{ value: 'sines', id: 'ot_sines_no_pair', witness: 'No angle is known together with the side across from it, so the law of sines has nothing to start from.' }, noRight]
  const missed = 'The right angle is marked: the Pythagorean theorem or SOH CAH TOA does it in one step, with no law needed.'
  return [
    { value: 'sines', id: 'ot_right_missed', witness: missed },
    { value: 'cosines', id: 'ot_right_missed', witness: missed },
  ]
}

interface RightInput {
  kind: 'legs' | 'leg' | 'ratio'
  /** The right angle's vertex. */
  right: V
  /** legs: the two legs; leg: a leg (by the vertex across from it) and the hypotenuse; ratio: an acute angle and the hypotenuse. */
  x: number
  y: number
  /** leg: the vertex across from the known leg; ratio: the vertex of the known acute angle. */
  at: V
  /** ratio: the side asked is across from `at` (sin) or next to it (cos). */
  fn: 'sin' | 'cos'
  mirror: boolean
}

function rightProblemParts(o: RightInput) {
  const [P, Q] = others(o.right)
  const hyp = lower(o.right)
  const angles = {} as Record<V, number>
  const sides = {} as Record<V, number>
  let value: number
  let asked: V
  let slips: Slip[]
  let reveal: string[]
  let nudge: string
  let given: { angles: Partial<Record<V, number>>; sides: Partial<Record<V, number>> }
  let calc
  if (o.kind === 'legs') {
    sides[P] = o.x
    sides[Q] = o.y
    sides[o.right] = Math.hypot(o.x, o.y)
    asked = o.right
    value = sides[o.right]
    const [x, y] = [lengthText(o.x), lengthText(o.y)]
    slips = [
      { id: 'trig_side_not_rooted', value: o.x * o.x + o.y * o.y, witness: (her) => `${her} is ${x}² + ${y}², the square of the hypotenuse. Take the square root.` },
      { id: 'trig_pythag_subtracted', value: Math.sqrt(Math.abs(o.x * o.x - o.y * o.y)), witness: (her) => `${her} subtracts the squares. Both sides you know are legs, so the hypotenuse adds them.` },
    ]
    nudge = `The two sides you know are the legs, so the side across from the right angle is ${m(`\\sqrt{${lower(P)}^2 + ${lower(Q)}^2}`)}.`
    reveal = [`${m(`${hyp} = \\sqrt{${x}^2 + ${y}^2} \\approx ${shown(value)}`)}, so ${m(hyp)} is about ${m(roundPlaces(value, 1))}.`]
    given = { angles: { [o.right]: 90 }, sides: { [P]: o.x, [Q]: o.y } }
    calc = rightCalc({ kind: 'legs', x, y, value })
  } else if (o.kind === 'leg') {
    const known = o.at
    const other = known === P ? Q : P
    sides[known] = o.x
    sides[o.right] = o.y
    sides[other] = Math.sqrt(o.y * o.y - o.x * o.x)
    asked = other
    value = sides[other]
    const [x, h] = [lengthText(o.x), lengthText(o.y)]
    slips = [
      { id: 'trig_side_not_rooted', value: o.y * o.y - o.x * o.x, witness: (her) => `${her} is ${h}² − ${x}², the square of the leg. Take the square root.` },
      { id: 'trig_pythag_added', value: Math.hypot(o.x, o.y), witness: (her) => `${her} adds the squares, which makes the leg longer than the hypotenuse. Subtract the leg’s square from the hypotenuse’s.` },
    ]
    nudge = `${m(hyp)} is across from the right angle, the hypotenuse. The missing leg is ${m(`\\sqrt{${hyp}^2 - ${lower(known)}^2}`)}.`
    reveal = [`${m(`${lower(other)} = \\sqrt{${h}^2 - ${x}^2} \\approx ${shown(value)}`)}, so ${m(lower(other))} is about ${m(roundPlaces(value, 1))}.`]
    given = { angles: { [o.right]: 90 }, sides: { [known]: o.x, [o.right]: o.y } }
    calc = rightCalc({ kind: 'leg', x: h, y: x, value })
  } else {
    const acute = o.at
    const other = acute === P ? Q : P
    angles[acute] = o.x
    angles[other] = 90 - o.x
    sides[o.right] = o.y
    sides[acute] = o.y * sinD(o.x)
    sides[other] = o.y * cosD(o.x)
    asked = o.fn === 'sin' ? acute : other
    value = sides[asked]
    const h = lengthText(o.y)
    const swapped = o.fn === 'sin' ? o.y * cosD(o.x) : o.y * sinD(o.x)
    slips = [
      { id: 'trig_opposite_adjacent_swapped', value: swapped, witness: (her) => `${her} uses ${o.fn === 'sin' ? 'cos' : 'sin'} ${o.x}°. From the ${o.x}° angle, ${lower(asked)} is the ${o.fn === 'sin' ? 'opposite side' : 'adjacent side'}, so it is the hypotenuse times ${o.fn} ${o.x}°.` },
      { id: 'trig_radian_mode', value: o.y * (o.fn === 'sin' ? Math.sin(o.x) : Math.cos(o.x)), witness: (her) => `${her} is what the calculator gives in RADIAN mode: it read ${o.x} as radians.` },
    ]
    nudge = `From the ${m(deg(o.x))} angle, name ${m(lower(asked))}: opposite or adjacent. The hypotenuse is ${m(hyp)}, so use sin or cos, in DEGREE mode.`
    reveal = [`From ${m(acute)}, side ${m(lower(asked))} is ${o.fn === 'sin' ? 'opposite' : 'adjacent'}: ${m(`${lower(asked)} = ${h} \\${o.fn} ${deg(o.x)} \\approx ${shown(value)}`)}, about ${m(roundPlaces(value, 1))}.`]
    given = { angles: { [o.right]: 90, [acute]: o.x }, sides: { [o.right]: o.y } }
    calc = rightCalc({ kind: 'ratio', fn: o.fn, hyp: h, angle: o.x, value })
  }
  if (o.kind !== 'ratio') {
    const all = anglesRecord(sides)
    for (const v of VERTICES) angles[v] = all[v]
  }
  angles[o.right] = 90
  return { angles, sides, value, asked, slips, reveal, nudge, given, calc }
}

export type ChooseInput = { case: 'AAS' | 'ASA'; sines: SinesInput } | { case: 'SSA'; A: number; a: number; b: number } | { case: 'SAS'; sas: ReturnType<typeof drawSas> } | { case: 'SSS'; sss: ReturnType<typeof drawSss> } | { case: 'legs' | 'leg' | 'ratio'; right: RightInput }

/** The problem for these numbers (exported for the hand-worked tests). */
export function chooseProblem(o: ChooseInput): Drafted {
  let second: TrigPart
  let early: number[]
  let prompt: string
  let figure
  let ariaLabel: string
  let calc
  let calcExpr: string
  let givens: number[]
  let value: number
  let shapes
  const also = ' The question is which law starts the solution.'
  if (o.case === 'AAS' || o.case === 'ASA') {
    const r = sinesSidePart(o.sines, true)
    second = r.part
    early = r.early
    value = r.value
    const f = sinesFigure(o.sines, r.tri, also)
    figure = f.spec
    ariaLabel = f.ariaLabel
    const between = o.case === 'ASA' ? ', with the side between those two angles' : ''
    prompt = `In triangle ${m('ABC')}, ${givenList(o.sines.given, { [o.sines.known]: o.sines.knownLen })}${between}. Which law starts the solution? Then find side ${m(lower(o.sines.asked))} to the nearest tenth.`
    const g = VERTICES.filter((v) => v !== r.tri.third)
    calc = sinesCalc({ g1: r.tri.angles[g[0]!], g2: r.tri.angles[g[1]!], known: lengthText(o.sines.knownLen), knownAngle: r.tri.angles[o.sines.known], askedAngle: r.tri.angles[o.sines.asked], value })
    calcExpr = `${lengthText(o.sines.knownLen)}*sin(${r.tri.angles[o.sines.asked]}°)/sin(${r.tri.angles[o.sines.known]}°)`
    givens = [...g.map((v) => r.tri.angles[v]), o.sines.knownLen]
    shapes = [shapeOf(r.tri)]
  } else if (o.case === 'SSA') {
    const d = ambiguousProblem({ A: o.A, a: o.a, b: o.b })
    if (ssaCount(o.A, o.a, o.b) !== 'one') throw new LogSkip('the choose problems use SSA with one triangle only')
    second = d.stages[1]!
    early = d.early[second.id] ?? []
    value = (second.check as { value: number }).value
    const C = 180 - o.A - value
    const tri = { angles: { A: o.A, B: value, C }, sides: { A: o.a, B: o.b, C: (o.a * sinD(C)) / sinD(o.A) } }
    ariaLabel = `Triangle ABC drawn to its true shape.${also} Angle A is marked ${o.A}°; angle B has an arc and no number. Side a is labelled ${lengthText(o.a)} and side b is labelled ${lengthText(o.b)}.`
    figure = triangleFigure(tri, { sides: { A: `a = ${lengthText(o.a)}`, B: `b = ${lengthText(o.b)}` }, angles: { A: `${o.A}°`, B: null }, mirror: false, ariaLabel })
    prompt = `In triangle ${m('ABC')}, ${m(`A = ${deg(o.A)}`)}, ${m(`a = ${lengthText(o.a)}`)} and ${m(`b = ${lengthText(o.b)}`)}. Which law starts the solution? Then find angle ${m('B')} to the nearest tenth of a degree.`
    calc = ambiguousCalc({ A: o.A, a: lengthText(o.a), b: lengthText(o.b), h: o.b * sinD(o.A), B: value, obtuse: false })
    calcExpr = `asin(${lengthText(o.b)}*sin(${o.A}°)/${lengthText(o.a)})`
    givens = [o.A, o.a, o.b]
    shapes = d.shapes
  } else if (o.case === 'SAS') {
    const r = sasPart(o.sas)
    second = r.part
    early = r.early
    value = r.value
    const f = sasFigure(o.sas, r.tri, also)
    figure = f.spec
    ariaLabel = f.ariaLabel
    const [P, Q] = others(o.sas.at)
    prompt = `In triangle ${m('ABC')}, ${givenList({ [o.sas.at]: o.sas.C }, { [P]: o.sas.x, [Q]: o.sas.y })}. Which law starts the solution? Then find side ${m(lower(o.sas.at))} to the nearest tenth.`
    calc = sasCalc({ a: lengthText(o.sas.x), b: lengthText(o.sas.y), C: o.sas.C, value })
    calcExpr = `sqrt(${o.sas.x}^2+${o.sas.y}^2-2*${o.sas.x}*${o.sas.y}*cos(${o.sas.C}°))`
    givens = [o.sas.C, o.sas.x, o.sas.y]
    shapes = [shapeOf(r.tri)]
  } else if (o.case === 'SSS') {
    const r = sssPart(o.sss)
    second = r.part
    early = r.early
    value = r.value
    const f = sssFigure(o.sss, r.tri, also)
    figure = f.spec
    ariaLabel = f.ariaLabel
    const what = o.sss.largest ? 'its largest angle' : `angle ${m(o.sss.asked)}`
    prompt = `Triangle ${m('ABC')} has sides ${givenList({}, o.sss.sides)}. Which law starts the solution? Then find ${what} to the nearest tenth of a degree.`
    const [P, Q] = others(o.sss.asked)
    calc = sssCalc({ a: lengthText(o.sss.sides[P]), b: lengthText(o.sss.sides[Q]), c: lengthText(o.sss.sides[o.sss.asked]), value })
    calcExpr = `acos((${o.sss.sides[P]}^2+${o.sss.sides[Q]}^2-${o.sss.sides[o.sss.asked]}^2)/(2*${o.sss.sides[P]}*${o.sss.sides[Q]}))`
    givens = VERTICES.map((v) => o.sss.sides[v])
    shapes = [shapeOf(r.tri)]
  } else {
    if (!('right' in o)) throw new Error('not a right-triangle case')
    const r = rightProblemParts(o.right)
    value = r.value
    const lc = lower(r.asked)
    const made = decimalPart({
      id: 'side',
      label: `Side ${lc}`,
      ask: `What is ${m(lc)}, to the nearest tenth?`,
      nudge: r.nudge,
      ruleCard: OT_RULE_IDS.which,
      reveal: r.reveal,
      value,
      degrees: false,
      slips: r.slips,
      early: [],
      wrongNote: OT_WRONG_SIDE,
      formatHint: OT_SIDE_HINT,
    })
    second = made.part
    early = made.early
    const sideLabels: Partial<Record<V, string>> = { [r.asked]: lc }
    for (const v of VERTICES) if (r.given.sides[v] !== undefined) sideLabels[v] = `${lower(v)} = ${lengthText(r.given.sides[v]!)}`
    const angleLabels: Partial<Record<V, string | null>> = {}
    for (const v of VERTICES) if (v !== o.right.right && r.given.angles[v] !== undefined) angleLabels[v] = `${r.given.angles[v]}°`
    const sayAngle = VERTICES.filter((v) => v !== o.right.right && r.given.angles[v] !== undefined).map((v) => ` Angle ${v} is marked ${r.given.angles[v]}°.`).join('')
    const saySides = VERTICES.filter((v) => r.given.sides[v] !== undefined).map((v) => `side ${lower(v)} is labelled ${lengthText(r.given.sides[v]!)}`).join(' and ')
    ariaLabel = `Triangle ABC drawn to its true shape, with a right angle marked at ${o.right.right}.${also}${sayAngle} ${saySides.charAt(0).toUpperCase()}${saySides.slice(1)}; side ${lc} is labelled with its letter only.`
    figure = triangleFigure({ angles: r.angles, sides: r.sides }, { sides: sideLabels, angles: angleLabels, right: o.right.right, mirror: o.right.mirror, ariaLabel })
    prompt = `In triangle ${m('ABC')}, ${givenList(r.given.angles, r.given.sides)}. Which law starts the solution? Then find side ${m(lc)} to the nearest tenth.`
    calc = r.calc
    const [x, y] = [lengthText(o.right.x), lengthText(o.right.y)]
    calcExpr = o.case === 'ratio' ? `${y}*${o.right.fn}(${x}°)` : o.case === 'legs' ? `sqrt(${x}^2+${y}^2)` : `sqrt(${y}^2-${x}^2)`
    givens = [...Object.values(r.given.angles), ...Object.values(r.given.sides)] as number[]
    shapes = [{ ...shapeOf({ angles: r.angles, sides: r.sides }), right: true }]
  }
  const law = LAW_OF[o.case]
  const lawPart = choicePart({
    id: 'law',
    label: 'Which law',
    ask: 'Which law starts the solution?',
    nudge: 'Look at what is known. Is an angle known together with the side across from it? Two sides and the angle between them, or all three sides? A right angle?',
    ruleCard: OT_RULE_IDS.which,
    reveal: [WHY[o.case]],
    choices: LAW_CHOICES,
    answer: law,
    traps: lawTraps(o.case),
    wrongNote: 'Not that one. Check which sides and angles are known, and how they sit.',
  })
  return {
    question: 'choose',
    prompt,
    oblique: { before: figure },
    ariaLabel,
    stages: [lawPart, second],
    early: { [second.id]: early },
    promisable: [...lawPart.traps, ...second.traps],
    calc,
    calcExpr,
    ruleCards: second.ruleCard === OT_RULE_IDS.which ? [OT_RULE_IDS.which] : [OT_RULE_IDS.which, second.ruleCard],
    givens,
    rounded: [value],
    shapes,
  }
}

/** The case for the plan's law, then its numbers. */
export function drawChoose(rng: Rng, law: Law): ChooseInput {
  if (law === 'sines') {
    const c = rng.pick(['AAS', 'ASA', 'SSA'] as const)
    if (c === 'SSA') return { case: 'SSA', ...drawAmbiguous(rng, 'one') }
    return { case: c, sines: drawSines(rng, c) }
  }
  if (law === 'cosines') {
    if (rng.chance(0.5)) return { case: 'SAS', sas: drawSas(rng, rng.chance(0.35)) }
    return { case: 'SSS', sss: drawSss(rng, { largest: rng.chance(0.6), obtuse: rng.chance(0.4) }) }
  }
  const kind = rng.pick(['legs', 'leg', 'ratio'] as const)
  const right = rng.pick(VERTICES)
  const [P, Q] = others(right)
  const at = rng.pick([P, Q])
  if (kind === 'legs') return { case: 'legs', right: { kind, right, x: rng.int(4, 30), y: rng.int(4, 30), at, fn: 'sin', mirror: rng.chance(0.5) } }
  if (kind === 'leg') {
    const x = rng.int(4, 26)
    return { case: 'leg', right: { kind, right, x, y: rng.int(x + 3, Math.round(x * 3.5) + 3), at, fn: 'sin', mirror: rng.chance(0.5) } }
  }
  return { case: 'ratio', right: { kind, right, x: rng.intExcept(18, 72, [30, 45, 60]), y: drawLength(rng, 6, 40), at, fn: rng.chance(0.5) ? 'sin' : 'cos', mirror: rng.chance(0.5) } }
}
