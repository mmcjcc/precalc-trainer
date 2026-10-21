/**
 * Angles and radian measure (precalculus Unit 4), drawn from the seed: the angle, its unit, the turns past one
 * revolution, the radius and the context. Every answer and every slip comes from the trig core (engine/trig) for the
 * problem drawn, and every problem passes `assertTrigProblem` before it is shown.
 */
import { problemId } from '@/content/registry'
import type { Rng } from '@/content/rng'
import type { AngleMeasureAnswer, DifficultyKnobs, ProblemInstance, TemplateDef, TrigFigureSpec, TrigPart, TrigPartTrap } from '@/content/types'
import {
  angleSay,
  angleTex,
  arcAnswer,
  arcSlips,
  conversionAnswer,
  conversionDecimalAnswer,
  conversionDecimalSlips,
  conversionSlips,
  coterminalDeg,
  coterminalSlips,
  degText,
  exactAscii,
  exactNum,
  exactSay,
  exactTex,
  exactText,
  gcd,
  measureOf,
  placeOf,
  placeSlips,
  placeWords,
  placesPhrase,
  q,
  qAdd,
  qDiv,
  qMul,
  qNum,
  qSub,
  qText,
  radiansOf,
  referenceDeg,
  referenceSlips,
  turnsTo,
  type AngleUnit,
  type ArcProblem,
  type ArcWhat,
  type Place,
  type Q,
  type TrigDecimalSlip,
  type TrigSlip,
} from '@/engine/trig'
import type { CalcPanels } from '@/shared/types'
import { LogSkip, roundPlaces } from '../explog/text'
import { arcCalc, conversionCalc, sameEndCalc } from '../trig/calc'
import { circleFigure, sectorFigure } from '../trig/figure'
import { assertTrigProblem } from '../trig/parts'
import { m, minus, plain, trigSearch } from '../trig/text'
import { AM_RULES, AM_RULE_IDS } from './rules'

export const AM_MODULE_ID = 'angleMeasure' as const
const VERSION = 1

export const DEG_HINT = 'Degrees: a number, with or without the ° sign.'
export const RAD_HINT = 'Radians: an exact multiple of π, such as kπ/n. Type pi or use the π key.'
export const DECIMAL_HINT = 'A decimal, rounded the way the problem asks.'
export const ARC_EXACT_HINT = 'Exact, in terms of π: type pi or use the π key. A unit after it is fine.'
export const ARC_DECIMAL_HINT = 'A decimal, rounded the way the problem asks. A unit after it is fine.'
export const CHOICE_HINT = 'Pick one.'
export const AM_HINTS = [DEG_HINT, RAD_HINT, DECIMAL_HINT, ARC_EXACT_HINT, ARC_DECIMAL_HINT, CHOICE_HINT]

export const AM_INSTRUCTIONS: Record<AngleMeasureAnswer['question'], string> = {
  convert: 'Convert the angle. Give the exact answer, or round it the way the problem asks.',
  coterminal: 'Find the coterminal angle in the range given.',
  reference: 'Say where the terminal side lies, then find the reference angle.',
  arc: 'Give the answer the way the problem asks: exact in terms of π, or rounded.',
}
const AXIS_INSTRUCTIONS = 'Say where the terminal side lies.'

const TITLES: Record<AngleMeasureAnswer['question'], string> = {
  convert: 'Degrees and radians',
  coterminal: 'Coterminal angles',
  reference: 'Quadrant and reference angle',
  arc: 'Arc length and sector area',
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

const deg$ = (d: Q) => m(angleTex({ deg: d, unit: 'deg' }))
const ang$ = (d: Q, unit: AngleUnit) => m(angleTex({ deg: d, unit }))

/** A rational as KaTeX: "\frac{5}{6}", "-\frac{7}{4}", "3". */
function qTex(v: Q): string {
  if (v.d === 1) return String(v.n)
  return `${v.n < 0 ? '-' : ''}\\frac{${Math.abs(v.n)}}{${v.d}}`
}

/** A part whose answer is an exact angle in `unit`. Slips are typed the way she would type them. */
function anglePart(o: {
  id: string
  label: string
  ask: string
  unit: AngleUnit
  deg: Q
  nudge: string
  ruleCard: string
  reveal: string[]
  wrongNote: string
  slips: TrigSlip[]
}): TrigPart {
  const exact = measureOf({ deg: o.deg, unit: o.unit })
  const answerText = o.unit === 'deg' ? degText(o.deg) : exactText(exact)
  const forms = o.unit === 'deg' ? [`${answerText}°`, minus(answerText)] : [exactAscii(exact), exactSay(exact)]
  return {
    id: o.id,
    kind: 'angle',
    label: o.label,
    ask: o.ask,
    formatHint: o.unit === 'deg' ? DEG_HINT : RAD_HINT,
    nudge: o.nudge,
    ruleCard: o.ruleCard,
    reveal: o.reveal,
    answerText,
    forms,
    check: { kind: 'angle', unit: o.unit, deg: qText(o.deg) },
    wrongNote: o.wrongNote,
    traps: o.slips.map((s) => ({ id: s.id, text: s.value === 'undefined' ? 'undefined' : exactText(s.value), witness: s.witness })),
  }
}

/** A slip's value as she would type it at the rounding asked (more places when that rounding shows only zeros). */
function trapText(value: number, places: number): string {
  const r = roundPlaces(value, places)
  if (Number(r) !== 0) return r
  return String(Number(value.toPrecision(3)))
}

/** Slips of a rounded answer that stand apart from it, and from each other, at the rounding asked. */
function decimalTraps(answer: number, places: number, slips: readonly TrigDecimalSlip[]): TrigPartTrap[] {
  const taken = new Set([roundPlaces(answer, places)])
  const out: TrigPartTrap[] = []
  for (const s of slips) {
    if (!Number.isFinite(s.value) || Math.abs(s.value) >= 1e7) continue
    const r = roundPlaces(s.value, places)
    if (taken.has(r)) continue
    taken.add(r)
    out.push({ id: s.id, text: trapText(s.value, places), value: s.value, witness: s.witness })
  }
  return out
}

const PLACE_CHOICES = [
  { value: 'Q1', label: 'Quadrant I' },
  { value: 'Q2', label: 'Quadrant II' },
  { value: 'Q3', label: 'Quadrant III' },
  { value: 'Q4', label: 'Quadrant IV' },
  { value: 'axis', label: 'On an axis' },
]

function placeValue(p: Place): string {
  return p.kind === 'axis' ? 'axis' : `Q${p.quadrant}`
}

interface Drafted {
  question: AngleMeasureAnswer['question']
  prompt: string
  instructions: string
  figure: TrigFigureSpec
  stages: TrigPart[]
  /** The slips the problem may promise: the ones she could type (not 27000/π). */
  promisable: TrigPartTrap[]
  calc: CalcPanels
  /** What "Copy expression" offers under the calculator steps. */
  calcExpr: string
  ruleCards: string[]
}

// ---------------------------------------------------------------------------
// am.convert
// ---------------------------------------------------------------------------

/**
 * Draw until `ok`: a redraw from the same generator, so the seed still decides everything and a rare value does not
 * skip the whole problem (a skip would tilt the mix of problem types toward the draws that never fail).
 */
function until<T>(draw: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 200; i++) {
    const v = draw()
    if (ok(v)) return v
  }
  throw new LogSkip('no value found')
}

/** An exact angle in degrees from the seed: mostly a multiple of 15°, sometimes 18°, 20°, 36°, 40°, 72° … */
function drawExactDegrees(rng: Rng): Q {
  if (rng.chance(0.7)) {
    const k = rng.intExcept(-48, 48, [0, 12, -12, 24, -24])
    return q(15 * k)
  }
  const d = until(
    () => {
      const step = rng.pick([10, 12, 18, 20, 24, 36, 40, 72] as const)
      return step * rng.int(1, Math.max(1, Math.floor(400 / step)))
    },
    (v) => v % 15 !== 0,
  )
  return q(rng.chance(0.3) ? -d : d)
}

/** An exact radian measure kπ from the seed, as degrees: denominators 2, 3, 4, 6, 12, or 5, 9, 10, 18. */
function drawExactRadians(rng: Rng): Q {
  const den = rng.chance(0.7) ? rng.pick([2, 3, 4, 6, 6, 12] as const) : rng.pick([5, 9, 10, 18] as const)
  // In lowest terms, a whole number of degrees, and not a half or a full turn (those are on the rule card).
  const num = until(
    () => rng.intExcept(-4 * den, 4 * den, [0]),
    (n) => gcd(n, den) === 1 && (180 * n) % den === 0 && ![180, 360].includes(Math.abs((180 * n) / den)),
  )
  return qMul(q(num, den), q(180))
}

/** The exact conversion problem for these numbers (exported for the hand-worked tests). */
export function convertProblem(o: { deg: Q; to: AngleUnit }): Drafted {
  const { deg, to } = o
  const from: AngleUnit = to === 'rad' ? 'deg' : 'rad'
  const given = ang$(deg, from)
  const answer = conversionAnswer(deg, to)
  const k = qDiv(deg, q(180))
  const slips = conversionSlips(deg, to)
  const reveal =
    to === 'rad'
      ? [
          `${m(`${angleTex({ deg, unit: 'deg' })} \\cdot \\frac{\\pi}{180^{\\circ}} = \\frac{${deg.n}\\pi}{180}`)}.`,
          `Simplify the fraction: ${m(`\\frac{${deg.n}}{180} = ${qTex(k)}`)}, so ${deg$(deg)} is ${m(exactTex(answer))} radians.`,
        ]
      : [
          `${m(`${angleTex({ deg, unit: 'rad' })} \\cdot \\frac{180^{\\circ}}{\\pi} = ${qTex(k)} \\cdot 180^{\\circ}`)}: the ${m('\\pi')} cancels.`,
          `${m(`${qTex(k)} \\cdot 180^{\\circ} = ${angleTex({ deg, unit: 'deg' })}`)}.`,
        ]
  const part = anglePart({
    id: 'answer',
    label: to === 'rad' ? 'In radians' : 'In degrees',
    ask: to === 'rad' ? `What is ${given} in radians? Give the exact answer, a number times ${m('\\pi')}.` : `What is ${given} in degrees?`,
    unit: to,
    deg,
    nudge: to === 'rad' ? `Multiply the degrees by ${m('\\frac{\\pi}{180}')} and simplify the fraction in front of ${m('\\pi')}.` : `Multiply by ${m('\\frac{180}{\\pi}')}: the ${m('\\pi')} cancels.`,
    ruleCard: AM_RULE_IDS.radians,
    reveal,
    wrongNote: to === 'rad' ? 'That is not this angle in radians. Multiply by π/180 and simplify the fraction.' : 'That is not this angle in degrees. Multiply by 180/π.',
    slips,
  })
  const prompt = to === 'rad' ? `Convert ${given} to radians. Give the exact answer in terms of ${m('\\pi')}.` : `Convert ${given} radians to degrees.`
  const figureLabel = angleSay({ deg, unit: from })
  return {
    question: 'convert',
    prompt,
    instructions: AM_INSTRUCTIONS.convert,
    figure: circleFigure(qNum(deg), figureLabel),
    stages: [part],
    // 27000/π and π²/216 are real slips, named when typed, but nobody types them by accident: not promised.
    promisable: part.traps.filter((t) => t.id === 'trig_pi_dropped' || t.id === 'trig_pi_kept'),
    calc: conversionCalc(from === 'deg' ? degText(deg) : exactText(radiansOf(deg)), from, exactNum(to === 'rad' ? radiansOf(deg) : answer), true),
    calcExpr: from === 'deg' ? `${degText(deg)}°` : exactText(radiansOf(deg)),
    ruleCards: [AM_RULE_IDS.radians],
  }
}

/** The rounded conversion problem: degrees (a whole number) to radians, or a plain number of radians to degrees. */
export function convertDecimalProblem(o: { given: number; from: AngleUnit; places: number }): Drafted {
  const { given, from, places } = o
  const to: AngleUnit = from === 'deg' ? 'rad' : 'deg'
  const value = conversionDecimalAnswer(given, from)
  const answerText = roundPlaces(value, places)
  const givenText = String(given)
  const slips = conversionDecimalSlips(given, from, givenText)
  const traps = decimalTraps(value, places, slips)
  const givenTex = from === 'deg' ? `${givenText}^{\\circ}` : givenText
  const roundWords = to === 'deg' ? `to ${placesPhrase(places)} of a degree` : `to ${placesPhrase(places)}`
  const exactLine =
    from === 'deg'
      ? `${m(`${givenTex} \\cdot \\frac{\\pi}{180^{\\circ}} = ${exactTex(radiansOf(q(given)))} \\approx ${value.toFixed(places + 2)}`)}.`
      : `${m(`${givenTex} \\cdot \\frac{180^{\\circ}}{\\pi} = \\frac{${Number((180 * given).toFixed(6))}^{\\circ}}{\\pi} \\approx ${value.toFixed(places + 2)}^{\\circ}`)}.`
  const part: TrigPart = {
    id: 'answer',
    kind: 'decimal',
    label: to === 'rad' ? 'In radians' : 'In degrees',
    ask: `What is ${m(givenTex)}${from === 'rad' ? ' radians' : ''} in ${to === 'rad' ? 'radians' : 'degrees'}, rounded ${roundWords}?`,
    formatHint: DECIMAL_HINT,
    nudge: from === 'deg' ? `Multiply by ${m('\\frac{\\pi}{180}')} on the calculator, then round.` : `Multiply by ${m('\\frac{180}{\\pi}')} on the calculator, then round.`,
    ruleCard: AM_RULE_IDS.radians,
    reveal: [exactLine, `Rounded ${roundWords}: ${m(`${answerText}${to === 'deg' ? '^{\\circ}' : ''}`)}${to === 'rad' ? ' radians' : ''}.`],
    answerText,
    forms: to === 'deg' ? [`${answerText}°`, `${answerText} degrees`, minus(answerText)] : [`${answerText} radians`, minus(answerText)],
    check: { kind: 'decimal', value, places, unit: to },
    wrongNote: from === 'deg' ? 'That does not match. Multiply by π/180, then round.' : 'That does not match. Multiply by 180/π, then round.',
    traps,
  }
  const prompt = from === 'deg' ? `Convert ${m(givenTex)} to radians. Round ${roundWords}.` : `Convert ${m(givenTex)} radians to degrees. Round ${roundWords}.`
  const deg = from === 'deg' ? given : (given * 180) / Math.PI
  return {
    question: 'convert',
    prompt,
    instructions: AM_INSTRUCTIONS.convert,
    // A plain number of radians is labelled with its unit: "2.5" alone on a circle could be read as degrees.
    figure: circleFigure(deg, from === 'deg' ? `${minus(givenText)}°` : `${minus(givenText)} rad`),
    stages: [part],
    promisable: traps,
    calc: conversionCalc(givenText, from, value, false),
    calcExpr: from === 'deg' ? `${givenText}°` : `${givenText}r`,
    ruleCards: [AM_RULE_IDS.radians],
  }
}

function drawConvert(rng: Rng): Drafted {
  const toRad = rng.chance(0.5)
  if (rng.chance(0.25)) {
    if (toRad) {
      const d = until(
        () => rng.intExcept(-400, 400, [0, 180, -180, 360, -360]),
        (v) => Math.abs(v) >= 5,
      )
      return convertDecimalProblem({ given: d, from: 'deg', places: rng.pick([2, 2, 3] as const) })
    }
    const r = until(
      () => rng.intExcept(-60, 60, [0]) / 10,
      (v) => Math.abs(v) >= 0.3,
    )
    return convertDecimalProblem({ given: r, from: 'rad', places: rng.pick([1, 1, 2] as const) })
  }
  return toRad ? convertProblem({ deg: drawExactDegrees(rng), to: 'rad' }) : convertProblem({ deg: drawExactRadians(rng), to: 'deg' })
}

// ---------------------------------------------------------------------------
// am.coterminal
// ---------------------------------------------------------------------------

/** The steps from θ to [0°, 360°): one full turn at a time. */
function turnSteps(deg: Q, unit: AngleUnit): string[] {
  const t = turnsTo(deg)
  const turn = unit === 'deg' ? '360^{\\circ}' : '2\\pi'
  const range = unit === 'deg' ? '[0^{\\circ}, 360^{\\circ})' : '[0, 2\\pi)'
  const lines: string[] = []
  const say = (d: Q) => angleTex({ deg: d, unit })
  if (t === 0) return [`${ang$(deg, unit)} is already in ${m(range)}.`]
  lines.push(t > 0 ? `${ang$(deg, unit)} is negative, so add ${m(turn)} until the angle is in ${m(range)}.` : `${ang$(deg, unit)} is more than one full turn, so subtract ${m(turn)} until the angle is in ${m(range)}.`)
  let v = deg
  for (let i = 0; i < Math.abs(t); i++) {
    const next = qAdd(v, q(t > 0 ? 360 : -360))
    const still = i < Math.abs(t) - 1
    lines.push(`${m(`${say(v)} ${t > 0 ? '+' : '-'} ${turn} = ${say(next)}`)}${still ? (t > 0 ? ', still negative' : ', still past a full turn') : ''}.`)
    v = next
  }
  return lines
}

/** The coterminal problem for this angle (exported for the hand-worked tests). */
export function coterminalProblem(o: { deg: Q; unit: AngleUnit }): Drafted {
  const { deg, unit } = o
  const c = coterminalDeg(deg)
  const range = unit === 'deg' ? '[0^{\\circ}, 360^{\\circ})' : '[0, 2\\pi)'
  const given = ang$(deg, unit)
  const part = anglePart({
    id: 'answer',
    label: 'Coterminal angle',
    ask: `Which angle in ${m(range)} is coterminal with ${given}?`,
    unit,
    deg: c,
    nudge: `Add or subtract full turns, ${unit === 'deg' ? m('360^{\\circ}') : m('2\\pi')} each, until the angle is in ${m(range)}.`,
    ruleCard: AM_RULE_IDS.coterminal,
    reveal: [...turnSteps(deg, unit), `So ${ang$(c, unit)} is coterminal with ${given}.`],
    wrongNote: 'That is not coterminal with the given angle in the range asked. Add or subtract whole turns.',
    slips: coterminalSlips(deg, unit),
  })
  return {
    question: 'coterminal',
    prompt: `Find the angle in ${m(range)} that is coterminal with ${given}.`,
    instructions: AM_INSTRUCTIONS.coterminal,
    figure: circleFigure(qNum(deg), angleSay({ deg, unit })),
    stages: [part],
    promisable: part.traps,
    calc: sameEndCalc(unit === 'deg' ? degText(deg) : exactText(radiansOf(deg)), unit, 'coterminal'),
    calcExpr: unit === 'deg' ? `${degText(deg)}°` : exactText(radiansOf(deg)),
    ruleCards: [AM_RULE_IDS.coterminal, AM_RULE_IDS.quadrant],
  }
}

/** An angle in one turn, not on an axis: degrees a multiple of 5, radians kπ/2, kπ/3, kπ/4, kπ/6 or kπ/12. */
function drawOffAxis(rng: Rng, unit: AngleUnit): Q {
  if (unit === 'deg') return q(5 * rng.intExcept(1, 71, [18, 36, 54]))
  const den = rng.pick([3, 4, 6, 6, 12] as const)
  const num = until(
    () => rng.int(1, 2 * den - 1),
    (n) => gcd(n, den) === 1 && (180 * n) % den === 0 && ((180 * n) / den) % 90 !== 0,
  )
  return qMul(q(num, den), q(180))
}

function drawCoterminal(rng: Rng): Drafted {
  const unit: AngleUnit = rng.chance(0.55) ? 'deg' : 'rad'
  const c = drawOffAxis(rng, unit)
  // Past a full turn either way, at most three turns: θ > 360° (one or two turns added) or θ < −360° (two or three
  // taken away). A slip is promised wherever one is possible; 650° (one turn, and two half turns land on the answer
  // as well) has none in degrees.
  const deg = rng.chance(0.5) ? qSub(c, q(360 * rng.pick([2, 2, 3] as const))) : qAdd(c, q(360 * rng.pick([1, 1, 2] as const)))
  return coterminalProblem({ deg, unit })
}

// ---------------------------------------------------------------------------
// am.reference
// ---------------------------------------------------------------------------

function referenceRule(quadrant: 1 | 2 | 3 | 4, c: Q, ref: Q, unit: AngleUnit): string {
  const t = (d: Q) => angleTex({ deg: d, unit })
  const half = unit === 'deg' ? '180^{\\circ}' : '\\pi'
  const full = unit === 'deg' ? '360^{\\circ}' : '2\\pi'
  switch (quadrant) {
    case 1:
      return `In Quadrant I the angle is its own reference angle: ${m(t(ref))}.`
    case 2:
      return `In Quadrant II the reference angle is ${m(`${half} - \\theta`)}: ${m(`${half} - ${t(c)} = ${t(ref)}`)}.`
    case 3:
      return `In Quadrant III the reference angle is ${m(`\\theta - ${half}`)}: ${m(`${t(c)} - ${half} = ${t(ref)}`)}.`
    case 4:
      return `In Quadrant IV the reference angle is ${m(`${full} - \\theta`)}: ${m(`${full} - ${t(c)} = ${t(ref)}`)}.`
  }
}

/** The quadrant and reference-angle problem for this angle (exported for the hand-worked tests). */
export function referenceProblem(o: { deg: Q; unit: AngleUnit }): Drafted {
  const { deg, unit } = o
  const place = placeOf(deg)
  const c = coterminalDeg(deg)
  const given = ang$(deg, unit)
  const toOneTurn = turnsTo(deg) === 0 ? [] : [`${m(`${angleTex({ deg, unit })} ${turnsTo(deg) > 0 ? '+' : '-'} ${Math.abs(turnsTo(deg)) === 1 ? '' : `${Math.abs(turnsTo(deg))} \\cdot `}${unit === 'deg' ? '360^{\\circ}' : '2\\pi'} = ${angleTex({ deg: c, unit })}`)}: the same terminal side.`]
  const where = `${ang$(c, unit)} ${place.kind === 'axis' ? `lies on ${placeWords(place)}, so it is in no quadrant` : `is in ${placeWords(place)}`}.`
  const placeSlipList = placeSlips(deg, unit)
  const quadrantPart: TrigPart = {
    id: 'quadrant',
    kind: 'choice',
    label: 'Where the terminal side lies',
    ask: `Where does the terminal side of ${given} lie?`,
    formatHint: CHOICE_HINT,
    choices: PLACE_CHOICES,
    nudge: 'Find the coterminal angle in one turn, then see which quarter of the circle it is in. A negative angle turns clockwise.',
    ruleCard: AM_RULE_IDS.quadrant,
    reveal: [...toOneTurn, where],
    answerText: placeValue(place),
    forms: [],
    check: { kind: 'choice' },
    wrongNote: 'Not there. Find the coterminal angle in one turn first, then the quarter of the circle it is in.',
    // On an axis every axis is the same choice, so a slip from one axis to another is no slip here.
    traps: placeSlipList.filter((s) => placeValue(s.place) !== placeValue(place)).map((s) => ({ id: s.id, text: placeValue(s.place), witness: s.witness })),
  }
  const stages: TrigPart[] = [quadrantPart]
  const ref = referenceDeg(deg)
  if (ref && place.kind === 'quadrant') {
    stages.push(
      anglePart({
        id: 'reference',
        label: 'Reference angle',
        ask: `What is the reference angle of ${given}${unit === 'rad' ? ', in radians' : ''}?`,
        unit,
        deg: ref,
        nudge: 'Measure from the terminal side to the nearest part of the x-axis. The answer is acute and positive.',
        ruleCard: AM_RULE_IDS.reference,
        reveal: [referenceRule(place.quadrant, c, ref, unit)],
        wrongNote: 'That is not the reference angle. Use the coterminal angle in one turn and measure to the nearest part of the x-axis.',
        slips: referenceSlips(deg, unit),
      }),
    )
  }
  const quadrantal = place.kind === 'axis'
  const figure = circleFigure(qNum(deg), angleSay({ deg, unit }), ref ? { deg: qNum(ref), label: angleSay({ deg: ref, unit }) } : undefined)
  return {
    question: 'reference',
    prompt: quadrantal ? `The angle ${given} is in standard position. Where does its terminal side lie?` : `The angle ${given} is in standard position. Where does its terminal side lie, and what is its reference angle?`,
    instructions: quadrantal ? AXIS_INSTRUCTIONS : AM_INSTRUCTIONS.reference,
    figure,
    stages,
    promisable: stages.flatMap((s) => s.traps).filter((t) => t.id !== 'trig_pi_dropped'),
    calc: sameEndCalc(unit === 'deg' ? degText(deg) : exactText(radiansOf(deg)), unit, 'reference'),
    calcExpr: unit === 'deg' ? `${degText(deg)}°` : exactText(radiansOf(deg)),
    ruleCards: [AM_RULE_IDS.quadrant, AM_RULE_IDS.reference, AM_RULE_IDS.coterminal],
  }
}

function drawReference(rng: Rng): Drafted {
  const unit: AngleUnit = rng.chance(0.55) ? 'deg' : 'rad'
  const quadrantal = rng.chance(0.04)
  const c = quadrantal ? q(90 * rng.int(1, 3)) : drawOffAxis(rng, unit)
  const turns = rng.pick([-2, -1, -1, 0, 0, 0, 1, 1, 2] as const)
  const deg = qAdd(c, q(360 * turns))
  if (deg.n === 0) throw new LogSkip('zero')
  return referenceProblem({ deg, unit })
}

// ---------------------------------------------------------------------------
// am.arc
// ---------------------------------------------------------------------------

interface UnitDef {
  abbr: string
  words: string[]
  area: string[]
  /** "of an inch", "of a centimeter" */
  piece: string
  name: string
}

const UNITS: Record<'in' | 'cm' | 'ft' | 'm', UnitDef> = {
  in: { abbr: 'in', words: ['in', 'inches', 'inch'], area: ['in²', 'in^2', 'square inches', 'sq in', 'sq. in.'], piece: 'an inch', name: 'inches' },
  cm: { abbr: 'cm', words: ['cm', 'centimeters', 'centimetres', 'centimeter'], area: ['cm²', 'cm^2', 'square centimeters', 'sq cm'], piece: 'a centimeter', name: 'centimeters' },
  ft: { abbr: 'ft', words: ['ft', 'feet', 'foot'], area: ['ft²', 'ft^2', 'square feet', 'sq ft', 'sq. ft.'], piece: 'a foot', name: 'feet' },
  m: { abbr: 'm', words: ['m', 'meters', 'metres', 'meter'], area: ['m²', 'm^2', 'square meters', 'sq m'], piece: 'a meter', name: 'meters' },
}

type ArcContext = 'plain' | 'pendulum' | 'clock' | 'wheel' | 'sprinkler' | 'pizza'

/** The arc or sector problem for these numbers (exported for the hand-worked tests). */
export function arcProblem(o: { r: number; theta: ArcProblem['theta']; what: ArcWhat; unit: keyof typeof UNITS; context: ArcContext; places: number | null }): Drafted {
  const { r, theta, what, context, places } = o
  const u = UNITS[o.unit]
  const p: ArcProblem = { r, theta, what }
  const exact = arcAnswer(p)
  const value = exactNum(exact)
  const radTex = theta.kind === 'plain' ? String(qNum(theta.rad)) : exactTex(radiansOf(theta.deg))
  const thetaTex = theta.kind === 'deg' ? angleTex({ deg: theta.deg, unit: 'deg' }) : theta.kind === 'rad' ? exactTex(radiansOf(theta.deg)) : String(qNum(theta.rad))
  const thetaSay = theta.kind === 'deg' ? angleSay({ deg: theta.deg, unit: 'deg' }) : theta.kind === 'rad' ? exactSay(radiansOf(theta.deg)) : `${qNum(theta.rad)} rad`
  const thetaWords = `${m(thetaTex)}${theta.kind === 'deg' ? '' : ' radians'}`
  const areaUnit = `${u.abbr}²`
  const shownUnit = what === 'arc' ? u.name : `square ${u.name}`
  const unitWords = what === 'arc' ? u.words : u.area
  const exactWanted = places === null
  const roundWords = places === null ? '' : `Round to ${placesPhrase(places)}${places === 0 ? '' : ` of ${what === 'arc' ? u.piece : `a square ${u.piece.replace(/^an? /, '')}`}`}.`
  const ending = exactWanted ? `Give the exact answer in terms of ${m('\\pi')}.` : roundWords
  const text: Record<ArcContext, string> = {
    plain: what === 'arc' ? `A circle has a radius of ${r} ${u.name}. Find the length of the arc cut off by a central angle of ${thetaWords}.` : `A circle has a radius of ${r} ${u.name}. Find the area of the sector with a central angle of ${thetaWords}.`,
    pendulum: `A pendulum ${r} ${u.name} long swings through an angle of ${thetaWords}. How far does the tip of the pendulum travel?`,
    clock: `The minute hand of a clock is ${r} ${u.name} long. How far does its tip travel while the hand turns through ${thetaWords}?`,
    wheel: `A bicycle wheel has a radius of ${r} ${u.name}. How far does a point on its rim travel when the wheel turns through ${thetaWords}?`,
    sprinkler: `A lawn sprinkler sprays water ${r} ${u.name} out and turns back and forth through ${thetaWords}. What area of lawn does it water?`,
    pizza: `A round pizza has a radius of ${r} ${u.name}. One slice has a central angle of ${thetaWords}. What is the area of the top of that slice?`,
  }
  const prompt = `${text[context]} ${ending}`
  const answerTex = exactTex(exact)
  const reveal: string[] = []
  if (theta.kind === 'deg') reveal.push(`Change the angle to radians: ${m(`${thetaTex} \\cdot \\frac{\\pi}{180^{\\circ}} = ${radTex}`)}.`)
  reveal.push(
    what === 'arc'
      ? `${m(`s = r\\theta = ${r} \\cdot ${radTex} = ${answerTex}`)} ${u.name}.`
      : `${m(`A = \\frac{1}{2} r^{2} \\theta = \\frac{1}{2} \\cdot ${r}^{2} \\cdot ${radTex} = ${answerTex}`)} square ${u.name}.`,
  )
  const slips = arcSlips(p)
  let part: TrigPart
  if (exactWanted) {
    if (exact.pi !== 1) throw new LogSkip('an exact answer here is not in terms of π')
    const answerText = exactText(exact)
    part = {
      id: 'answer',
      kind: 'value',
      label: what === 'arc' ? 'Arc length' : 'Sector area',
      ask: what === 'arc' ? `How long is the arc? Give the exact answer in terms of ${m('\\pi')}.` : `What is the area of the sector? Give the exact answer in terms of ${m('\\pi')}.`,
      formatHint: ARC_EXACT_HINT,
      nudge: what === 'arc' ? `Use ${m('s = r\\theta')} with ${m('\\theta')} in radians.` : `Use ${m('A = \\frac{1}{2} r^{2} \\theta')} with ${m('\\theta')} in radians.`,
      ruleCard: AM_RULE_IDS.arc,
      reveal,
      answerText,
      forms: [exactAscii(exact), exactSay(exact), `${answerText} ${what === 'arc' ? u.abbr : areaUnit}`],
      check: { kind: 'value', value: answerText, units: unitWords },
      wrongNote: 'That does not match. Check the formula, the radius, and the angle in radians.',
      traps: slips.map((s) => ({ id: s.id, text: s.value === 'undefined' ? 'undefined' : exactText(s.value), witness: s.witness })),
    }
  } else {
    const answerText = roundPlaces(value, places)
    reveal.push(`${m(`${answerTex} \\approx ${value.toFixed(places + 2)}`)}, so about ${m(answerText)} ${shownUnit}.`)
    const traps = decimalTraps(
      value,
      places,
      slips.map((s) => ({ id: s.id, value: s.value === 'undefined' ? Number.NaN : exactNum(s.value), witness: s.witness })),
    )
    part = {
      id: 'answer',
      kind: 'decimal',
      label: what === 'arc' ? 'Arc length' : 'Sector area',
      ask: what === 'arc' ? `How long is the arc? ${roundWords}` : `What is the area of the sector? ${roundWords}`,
      formatHint: ARC_DECIMAL_HINT,
      nudge: what === 'arc' ? `Use ${m('s = r\\theta')} with ${m('\\theta')} in radians, then round.` : `Use ${m('A = \\frac{1}{2} r^{2} \\theta')} with ${m('\\theta')} in radians, then round.`,
      ruleCard: AM_RULE_IDS.arc,
      reveal,
      answerText,
      forms: [`${answerText} ${what === 'arc' ? u.abbr : areaUnit}`],
      check: { kind: 'decimal', value, places, units: unitWords },
      wrongNote: 'That does not match. Check the formula, the radius, and the angle in radians.',
      traps,
    }
  }
  const tiTheta = theta.kind === 'deg' ? `${degText(theta.deg)} × π ÷ 180` : theta.kind === 'rad' ? exactText(radiansOf(theta.deg)).replace('/', ' ÷ ') : String(qNum(theta.rad))
  const nsTheta = theta.kind === 'deg' ? `${degText(theta.deg)}·π/180` : theta.kind === 'rad' ? exactText(radiansOf(theta.deg)) : String(qNum(theta.rad))
  const tiExpr = what === 'arc' ? `${r} × ${tiTheta}` : `0.5 × ${r} x² × ${tiTheta}`
  const nsExpr = what === 'arc' ? `${r}·${nsTheta}` : `0.5·${r}²·${nsTheta}`
  return {
    question: 'arc',
    prompt,
    instructions: AM_INSTRUCTIONS.arc,
    figure: sectorFigure(theta.kind === 'plain' ? (qNum(theta.rad) * 180) / Math.PI : qNum(theta.deg), thetaSay, `${r} ${u.abbr}`, what),
    stages: [part],
    promisable: part.traps.filter((t) => t.id !== 'trig_conversion_inverted'),
    calc: arcCalc(tiExpr, nsExpr, value, what),
    calcExpr: nsExpr,
    ruleCards: [AM_RULE_IDS.arc, AM_RULE_IDS.radians],
  }
}

function drawArc(rng: Rng): Drafted {
  const what: ArcWhat = rng.chance(0.55) ? 'arc' : 'area'
  const context: ArcContext = rng.chance(0.4) ? 'plain' : what === 'arc' ? rng.pick(['pendulum', 'clock', 'wheel'] as const) : rng.pick(['sprinkler', 'pizza'] as const)
  const unit: keyof typeof UNITS = context === 'pendulum' || context === 'clock' || context === 'wheel' ? rng.pick(['in', 'cm'] as const) : context === 'sprinkler' ? 'ft' : context === 'pizza' ? 'in' : rng.pick(['in', 'cm', 'ft', 'm'] as const)
  // Sizes a real pendulum, clock hand, bicycle wheel, sprinkler or pizza has.
  const r =
    context === 'pendulum'
      ? rng.int(8, 48)
      : context === 'clock'
        ? rng.int(4, 18)
        : context === 'wheel'
          ? unit === 'in' ? rng.int(10, 16) : rng.int(25, 40)
          : context === 'sprinkler'
            ? rng.int(6, 40)
            : context === 'pizza'
              ? rng.int(5, 9)
              : rng.int(2, 30)
  let theta: ArcProblem['theta']
  const roll = rng.int(0, 99)
  if (context === 'plain' && roll < 12) theta = { kind: 'plain', rad: q(rng.int(3, 50), 10) }
  else if (roll < 60 || context === 'pendulum' || context === 'sprinkler' || context === 'pizza') {
    const [lo, hi] = context === 'pendulum' ? [2, 12] : context === 'pizza' ? [4, 18] : context === 'sprinkler' ? [9, 54] : [2, 66]
    theta = { kind: 'deg', deg: q(5 * rng.int(lo, hi)) }
  } else {
    const den = rng.pick([2, 3, 4, 5, 6, 9, 12] as const)
    // In lowest terms (every denominator here gives a whole number of degrees).
    const num = until(
      () => rng.int(1, 2 * den - 1),
      (n) => gcd(n, den) === 1 && (180 * n) % den === 0,
    )
    theta = { kind: 'rad', deg: qMul(q(num, den), q(180)) }
  }
  const exact = theta.kind !== 'plain' && rng.chance(0.5)
  const places = exact ? null : what === 'area' && r >= 20 ? rng.pick([0, 1] as const) : rng.pick([1, 1, 2] as const)
  return arcProblem({ r, theta, what, unit, context, places })
}

// ---------------------------------------------------------------------------
// Assembling and checking
// ---------------------------------------------------------------------------

function finish(d: Drafted, rng: Rng): AngleMeasureAnswer {
  const chosen = d.promisable.length ? rng.pick(d.promisable) : null
  const stage = chosen ? d.stages.find((s) => s.traps.includes(chosen)) : undefined
  const answer: AngleMeasureAnswer = {
    type: 'angleMeasure',
    question: d.question,
    prompt: d.prompt,
    figure: d.figure,
    stages: d.stages,
    expectedDisplay: d.stages.map((s) => `${s.label}: ${s.kind === 'choice' ? (s.choices?.find((c) => c.value === s.answerText)?.label ?? s.answerText) : minus(s.answerText)}`).join('; '),
    nudge: d.stages[0]!.nudge,
    ruleCard: d.stages[0]!.ruleCard,
    ruleCards: d.ruleCards,
    reveal: d.stages.flatMap((s) => s.reveal),
    ...(chosen && stage ? { trap: chosen.id, trapStage: stage.id, trapAnswer: chosen.text } : {}),
  }
  // A problem whose draw allows a slip has to promise one.
  if (!chosen && d.stages.some((s) => s.traps.length > 0)) throw new LogSkip('no slip she could type')
  assertTrigProblem(answer, d.instructions, AM_RULES, AM_HINTS)
  return answer
}

function generate(templateId: string, salt: number, draw: (rng: Rng) => Drafted) {
  return (seed: number, knobs: DifficultyKnobs = {}): ProblemInstance => {
    let drafted: Drafted | null = null
    const answer = trigSearch(seed, salt, 96, (rng) => {
      drafted = draw(rng)
      return finish(drafted, rng)
    })
    const d = drafted as unknown as Drafted
    return {
      id: problemId(AM_MODULE_ID, templateId, VERSION, seed),
      moduleId: AM_MODULE_ID,
      templateId,
      skill: templateId,
      genVersion: VERSION,
      seed: seed >>> 0,
      knobs,
      kind: 'angleMeasure',
      title: TITLES[answer.question],
      instructions: d.instructions,
      statementText: plain(answer.prompt),
      vars: [],
      start: null,
      canonical: [],
      answer,
      graph: { kind: 'none', f: d.calcExpr },
      calc: d.calc,
      params: {
        question: answer.question,
        trap: answer.trap ?? '',
        trapStage: answer.trapStage ?? '',
        answer: answer.stages.map((s) => s.answerText).join(' | '),
      },
    }
  }
}

export const convertTemplate: TemplateDef = {
  id: 'am.convert',
  title: 'Degrees and radians',
  description: 'Degrees to radians and back, exactly (in terms of π) or rounded, negative angles and angles past a turn included.',
  version: VERSION,
  knobs: [],
  generate: generate('am.convert', 61, drawConvert),
}

export const coterminalTemplate: TemplateDef = {
  id: 'am.coterminal',
  title: 'Coterminal angles',
  description: 'The coterminal angle in [0°, 360°) or [0, 2π) for an angle past a turn either way.',
  version: VERSION,
  knobs: [],
  generate: generate('am.coterminal', 62, drawCoterminal),
}

export const referenceTemplate: TemplateDef = {
  id: 'am.reference',
  title: 'Quadrant and reference angle',
  description: 'Where the terminal side lies (a quadrant or an axis), then the reference angle, in degrees or radians.',
  version: VERSION,
  knobs: [],
  generate: generate('am.reference', 63, drawReference),
}

export const arcTemplate: TemplateDef = {
  id: 'am.arc',
  title: 'Arc length and sector area',
  description: 'Arc length s = rθ or sector area A = ½r²θ, the angle in degrees or radians, exact or rounded; word problems.',
  version: VERSION,
  knobs: [],
  generate: generate('am.arc', 64, drawArc),
}

export const AM_TEMPLATES = [convertTemplate, coterminalTemplate, referenceTemplate, arcTemplate] as const

