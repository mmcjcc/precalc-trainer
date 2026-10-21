/**
 * What each named slip gives for THIS problem, with a sentence about her answer. Every builder returns the slips in
 * detection order with the ones equal to the right answer left out; when two slips give the same answer, the
 * earlier names it. Sentences are display text (− for minus) and never state the right answer.
 */
import {
  HALF_TURN,
  angleSay,
  coterminalDeg,
  halfTurnSlipDeg,
  measureOf,
  negativeDirectionDeg,
  oneTurnShortDeg,
  piMultipleFromDeg,
  placeOf,
  placeWords,
  radiansOf,
  referenceDeg,
  samePlace,
  type AngleUnit,
  type Place,
  type TrigAngle,
} from './angle'
import { exactDiv, exactInt, exactMul, exactNeg, exactNum, exactQ, exactSay, isZero, tx, type TrigExact } from './exact'
import { q, qAbs, qSub, type Q } from './rational'
import type { TrigMistakeId } from './types'
import { pointR, pointValue, ratioOf, trigValue, unitPoint, valueEq, type TrigFn, type TrigValue } from './values'

export interface TrigSlip {
  id: TrigMistakeId
  /** What the slip gives: an exact value (an angle in the unit asked), or 'undefined'. */
  value: TrigValue
  witness: string
}

/** A rounded problem's slip: the number the slip gives before rounding. */
export interface TrigDecimalSlip {
  id: TrigMistakeId
  value: number
  witness: string
}

/** A quadrant slip: where the slip puts the terminal side. */
export interface TrigPlaceSlip {
  id: TrigMistakeId
  place: Place
  witness: string
}

/** Leave out a slip equal to the answer, and a later slip equal to an earlier one. */
function distinct(answer: TrigValue, slips: readonly (TrigSlip | null)[]): TrigSlip[] {
  const out: TrigSlip[] = []
  for (const s of slips) {
    if (!s || valueEq(s.value, answer)) continue
    if (out.some((o) => valueEq(o.value, s.value))) continue
    out.push(s)
  }
  return out
}

const at = (deg: Q, unit: AngleUnit): TrigAngle => ({ deg, unit })
const turn = (unit: AngleUnit) => (unit === 'deg' ? '360°' : '2π')
const half = (unit: AngleUnit) => (unit === 'deg' ? '180°' : 'π')
const range = (unit: AngleUnit) => (unit === 'deg' ? '[0°, 360°)' : '[0, 2π)')
const PI = tx(q(1), 1, 1)

// ---------------------------------------------------------------------------
// Converting between degrees and radians
// ---------------------------------------------------------------------------

/** The exact answer of a conversion: radians as a multiple of π, or degrees. */
export function conversionAnswer(deg: Q, to: AngleUnit): TrigExact {
  return to === 'rad' ? radiansOf(deg) : exactQ(deg)
}

/** Slips converting an exact angle (given in the other unit) to `to`. */
export function conversionSlips(deg: Q, to: AngleUnit): TrigSlip[] {
  const answer = conversionAnswer(deg, to)
  if (to === 'rad') {
    const given = angleSay(at(deg, 'deg'))
    return distinct(answer, [
      {
        id: 'trig_conversion_inverted',
        value: exactDiv(exactMul(exactQ(deg), exactInt(180)), PI),
        witness: `Your answer multiplies ${given} by 180/π, so it grows instead of shrinking. From degrees to radians the factor is π/180, with π on top.`,
      },
      {
        id: 'trig_pi_dropped',
        value: exactQ(piMultipleFromDeg(deg)),
        witness: `Your answer has no π in it. Multiplying ${given} by π/180 leaves a π in the radian measure.`,
      },
    ])
  }
  const given = angleSay(at(deg, 'rad'))
  return distinct(answer, [
    {
      id: 'trig_pi_kept',
      value: exactMul(exactQ(deg), PI),
      witness: `Your answer still has π in it. Multiplying ${given} by 180/π cancels its π, so a measure in degrees has no π.`,
    },
    {
      id: 'trig_conversion_inverted',
      value: exactMul(radiansOf(deg), exactDiv(PI, exactInt(180))),
      witness: `Your answer multiplies ${given} by π/180. From radians to degrees the factor is 180/π, so the π cancels.`,
    },
  ])
}

/** A conversion to be rounded: the number she is given (degrees or decimal radians) and its unit. */
export function conversionDecimalAnswer(given: number, from: AngleUnit): number {
  return from === 'deg' ? (given * Math.PI) / 180 : (given * 180) / Math.PI
}

export function conversionDecimalSlips(given: number, from: AngleUnit, givenText: string): TrigDecimalSlip[] {
  const g = givenText.replace(/-/g, '−')
  if (from === 'deg') {
    return [
      { id: 'trig_conversion_inverted', value: (given * 180) / Math.PI, witness: `Your answer multiplies ${g}° by 180/π, so it grows instead of shrinking. From degrees to radians the factor is π/180.` },
      { id: 'trig_pi_dropped', value: given / 180, witness: `Your answer divides ${g} by 180 but leaves out π. The factor is π/180: multiply by π too.` },
    ]
  }
  return [
    { id: 'trig_conversion_inverted', value: (given * Math.PI) / 180, witness: `Your answer multiplies ${g} by π/180. From radians to degrees the factor is 180/π.` },
    { id: 'trig_pi_dropped', value: given * 180, witness: `Your answer multiplies ${g} by 180 but never divides by π. The factor is 180/π.` },
  ]
}

// ---------------------------------------------------------------------------
// Coterminal angles and where the terminal side lies
// ---------------------------------------------------------------------------

export function coterminalAnswer(deg: Q, unit: AngleUnit): TrigExact {
  return measureOf(at(coterminalDeg(deg), unit))
}

export function coterminalSlips(deg: Q, unit: AngleUnit): TrigSlip[] {
  const answer = coterminalAnswer(deg, unit)
  const given = angleSay(at(deg, unit))
  const halfTurn = halfTurnSlipDeg(deg)
  const short = oneTurnShortDeg(deg)
  const negative = negativeDirectionDeg(deg)
  return distinct(answer, [
    halfTurn && {
      id: 'trig_coterminal_half_turn',
      value: measureOf(at(halfTurn, unit)),
      witness: `Your angle comes from steps of ${half(unit)}, half a turn each, so it ends on the opposite side of the circle. Coterminal angles differ by whole turns of ${turn(unit)}.`,
    },
    short && {
      id: 'trig_coterminal_short',
      value: measureOf(at(short, unit)),
      witness: `Your angle is a whole number of turns from ${given}, but it is still outside ${range(unit)}. One more full turn brings it in.`,
    },
    negative && {
      id: 'trig_negative_direction',
      value: measureOf(at(negative, unit)),
      witness: `That is where ${angleSay(at(qAbs(deg), unit))} ends, turning counterclockwise. ${given} is negative, so it turns clockwise: add whole turns to it.`,
    },
    unit === 'rad'
      ? {
          id: 'trig_pi_dropped',
          value: exactQ(piMultipleFromDeg(coterminalDeg(deg))),
          witness: 'Your answer has no π. In radians this angle is a number times π.',
        }
      : null,
  ])
}

/** Where the terminal side lies. */
export function placeAnswer(deg: Q): Place {
  return placeOf(deg)
}

export function placeSlips(deg: Q, unit: AngleUnit): TrigPlaceSlip[] {
  const answer = placeOf(deg)
  const negative = negativeDirectionDeg(deg)
  const halfTurn = halfTurnSlipDeg(deg)
  const raw: (TrigPlaceSlip | null)[] = [
    negative && {
      id: 'trig_negative_direction',
      place: placeOf(negative),
      witness: `That is where ${angleSay(at(qAbs(deg), unit))} ends, turning counterclockwise. A negative angle turns clockwise from the positive x-axis.`,
    },
    halfTurn && {
      id: 'trig_coterminal_half_turn',
      place: placeOf(halfTurn),
      witness: `That comes from steps of ${half(unit)}, which land on the opposite side of the circle. Whole turns of ${turn(unit)} show where it really ends.`,
    },
  ]
  const out: TrigPlaceSlip[] = []
  for (const s of raw) {
    if (!s || samePlace(s.place, answer) || out.some((o) => samePlace(o.place, s.place))) continue
    out.push(s)
  }
  return out
}

// ---------------------------------------------------------------------------
// Reference angles
// ---------------------------------------------------------------------------

/** The reference angle in the angle's own unit; null on an axis. */
export function referenceAnswer(deg: Q, unit: AngleUnit): TrigExact | null {
  const ref = referenceDeg(deg)
  return ref ? measureOf(at(ref, unit)) : null
}

export function referenceSlips(deg: Q, unit: AngleUnit): TrigSlip[] {
  const ref = referenceDeg(deg)
  const place = placeOf(deg)
  if (!ref || place.kind !== 'quadrant') return []
  const answer = measureOf(at(ref, unit))
  const c = coterminalDeg(deg)
  const say = (d: Q) => angleSay(at(d, unit))
  // Her negative angle is the answer with a minus sign, so the sentence does not quote it.
  const negativeWay = (d: Q): TrigSlip => ({
    id: 'trig_reference_wrong_way',
    value: measureOf(at(d, unit)),
    witness: 'Your angle is negative: the subtraction went the wrong way round. A reference angle is the positive, acute angle to the x-axis.',
  })
  const wrongWay: TrigSlip[] = []
  if (place.quadrant === 2) wrongWay.push(negativeWay(qSub(c, HALF_TURN)))
  if (place.quadrant === 3) wrongWay.push(negativeWay(qSub(HALF_TURN, c)))
  if (place.quadrant === 4) {
    wrongWay.push(negativeWay(qSub(HALF_TURN, c)))
    const q3Rule = qSub(c, HALF_TURN)
    wrongWay.push({
      id: 'trig_reference_wrong_way',
      value: measureOf(at(q3Rule, unit)),
      witness: `${say(q3Rule)} is measured to the negative x-axis, the Quadrant III way. In Quadrant IV the terminal side is nearest the positive x-axis, so measure to ${turn(unit)}.`,
    })
  }
  const fromY = qSub(q(90), ref)
  return distinct(answer, [
    {
      id: 'trig_reference_from_y_axis',
      value: measureOf(at(fromY, unit)),
      witness: `${say(fromY)} is measured to the y-axis. The reference angle is measured to the x-axis: it is the other acute angle of the triangle.`,
    },
    ...wrongWay,
    place.quadrant === 1
      ? null
      : {
          id: 'trig_reference_is_coterminal',
          value: measureOf(at(c, unit)),
          witness: `${say(c)} is where the terminal side is. The reference angle is the acute angle between that side and the x-axis.`,
        },
    unit === 'rad'
      ? {
          id: 'trig_pi_dropped',
          value: exactQ(piMultipleFromDeg(ref)),
          witness: 'Your answer has no π. In radians the reference angle is a number times π.',
        }
      : null,
  ])
}

// ---------------------------------------------------------------------------
// The six functions at a special angle
// ---------------------------------------------------------------------------

const POSITIVE_WORD = (v: TrigExact) => (exactNum(v) > 0 ? 'positive' : 'negative')

/** The exact value of fn at a multiple of 30° or 45°; null at any other angle. */
export function valueAnswer(fn: TrigFn, deg: Q): TrigValue | null {
  return trigValue(fn, deg)
}

export function valueSlips(fn: TrigFn, deg: Q, unit: AngleUnit): TrigSlip[] {
  const v = trigValue(fn, deg)
  const p = unitPoint(deg)
  if (!v || !p) return []
  const A = angleSay(at(deg, unit))
  const place = placeOf(deg)
  const where = place.kind === 'quadrant' ? `ends in ${placeWords(place)}` : `ends on ${placeWords(place)}`
  const ratio = (f: TrigFn) => ratioOf(f, p.x, p.y, exactInt(1))
  const xBottom = fn === 'tan' || fn === 'sec'
  const slips: (TrigSlip | null)[] = []
  if (v === 'undefined') {
    slips.push({
      id: 'trig_zero_for_undefined',
      value: exactInt(0),
      witness: xBottom
        ? `At ${A} the point is on the y-axis, so its x-coordinate is zero, and ${fn} has x on the bottom. Dividing by zero gives no number at all.`
        : `At ${A} the point is on the x-axis, so its y-coordinate is zero, and ${fn} has y on the bottom. Dividing by zero gives no number at all.`,
    })
  } else if (isZero(v)) {
    slips.push({
      id: 'trig_undefined_for_zero',
      value: 'undefined',
      witness: `At ${A} the zero is on top of the ratio for ${fn}, not underneath. Zero divided by a number that is not zero is a number.`,
    })
  } else {
    slips.push({
      id: 'trig_sign_quadrant',
      value: exactNeg(v),
      witness: `Your answer has the right size but the wrong sign. ${A} ${where}, where ${fn} is ${POSITIVE_WORD(v)}.`,
    })
  }
  switch (fn) {
    case 'sin':
      slips.push({ id: 'trig_sin_cos_swapped', value: ratio('cos'), witness: `That is cos(${A}), the x-coordinate of the point on the unit circle. sin(${A}) is the y-coordinate.` })
      break
    case 'cos':
      slips.push({ id: 'trig_sin_cos_swapped', value: ratio('sin'), witness: `That is sin(${A}), the y-coordinate of the point on the unit circle. cos(${A}) is the x-coordinate.` })
      break
    case 'tan':
      slips.push({ id: 'trig_tan_inverted', value: ratio('cot'), witness: `That is x/y, which is cot(${A}). tan is y/x: the y-coordinate over the x-coordinate.` })
      break
    case 'cot':
      slips.push({ id: 'trig_tan_inverted', value: ratio('tan'), witness: `That is y/x, which is tan(${A}). cot is x/y: the x-coordinate over the y-coordinate.` })
      break
    case 'csc':
      slips.push({ id: 'trig_reciprocal_missing', value: ratio('sin'), witness: `That is sin(${A}). csc is its reciprocal: one over sin.` })
      slips.push({ id: 'trig_reciprocal_mixed', value: ratio('sec'), witness: `That is one over cos(${A}), which is sec. csc goes with sin: one over sin.` })
      break
    case 'sec':
      slips.push({ id: 'trig_reciprocal_missing', value: ratio('cos'), witness: `That is cos(${A}). sec is its reciprocal: one over cos.` })
      slips.push({ id: 'trig_reciprocal_mixed', value: ratio('csc'), witness: `That is one over sin(${A}), which is csc. sec goes with cos: one over cos.` })
      break
  }
  const negative = negativeDirectionDeg(deg)
  if (negative) {
    const turned = trigValue(fn, negative)
    if (turned) {
      slips.push({
        id: 'trig_negative_direction',
        value: turned,
        witness: `That is ${fn}(${angleSay(at(qAbs(deg), unit))}), turned counterclockwise. ${A} is negative, so it turns clockwise.`,
      })
    }
  }
  return distinct(v, slips)
}

// ---------------------------------------------------------------------------
// A point (x, y) on the terminal side
// ---------------------------------------------------------------------------

export function rAnswer(x: number, y: number): TrigExact {
  return pointR(x, y)
}

export function rSlips(x: number, y: number): TrigSlip[] {
  const r = pointR(x, y)
  const sum = x * x + y * y
  return distinct(r, [
    {
      id: 'trig_r_not_rooted',
      value: exactInt(sum),
      witness: `${sum} is x² + y², which is r², the square of the distance. r is the square root of x² + y².`,
    },
  ])
}

export function pointAnswer(fn: TrigFn, x: number, y: number): TrigValue {
  return pointValue(fn, x, y)
}

export function pointSlips(fn: TrigFn, x: number, y: number): TrigSlip[] {
  const v = pointValue(fn, x, y)
  const X = exactInt(x)
  const Y = exactInt(y)
  const R = pointR(x, y)
  const one = exactInt(1)
  const ratio = (f: TrigFn) => ratioOf(f, X, Y, R)
  const slips: (TrigSlip | null)[] = []
  if (v !== 'undefined' && !isZero(v)) {
    slips.push({
      id: 'trig_sign_quadrant',
      value: exactNeg(v),
      witness: `Your answer has the right size but the wrong sign. Keep the signs of x and y: the point is in ${placeWords(placeOfPoint(x, y))}, where ${fn} θ is ${POSITIVE_WORD(v)}.`,
    })
  }
  const leftOut = 'Your answer leaves out r. This point is not on the unit circle, so divide by its distance from the origin, r.'
  switch (fn) {
    case 'sin':
      slips.push({ id: 'trig_r_left_out', value: Y, witness: `${leftOut} sin θ = y/r.` })
      slips.push({ id: 'trig_sin_cos_swapped', value: ratio('cos'), witness: 'That is x/r, which is cos θ. sin θ uses the y-coordinate: y/r.' })
      break
    case 'cos':
      slips.push({ id: 'trig_r_left_out', value: X, witness: `${leftOut} cos θ = x/r.` })
      slips.push({ id: 'trig_sin_cos_swapped', value: ratio('sin'), witness: 'That is y/r, which is sin θ. cos θ uses the x-coordinate: x/r.' })
      break
    case 'tan':
      slips.push({ id: 'trig_tan_inverted', value: ratio('cot'), witness: 'That is x/y, which is cot θ. tan θ is y/x: the y-coordinate over the x-coordinate.' })
      break
    case 'cot':
      slips.push({ id: 'trig_tan_inverted', value: ratio('tan'), witness: 'That is y/x, which is tan θ. cot θ is x/y: the x-coordinate over the y-coordinate.' })
      break
    case 'csc':
      slips.push({ id: 'trig_reciprocal_missing', value: ratio('sin'), witness: 'That is y/r, which is sin θ. csc θ is its reciprocal, r/y.' })
      slips.push({ id: 'trig_reciprocal_mixed', value: ratio('sec'), witness: 'That is r/x, which is sec θ. csc θ goes with sin θ: r over y.' })
      slips.push({ id: 'trig_r_left_out', value: y === 0 ? 'undefined' : exactDiv(one, Y), witness: `${leftOut} csc θ = r/y.` })
      break
    case 'sec':
      slips.push({ id: 'trig_reciprocal_missing', value: ratio('cos'), witness: 'That is x/r, which is cos θ. sec θ is its reciprocal, r/x.' })
      slips.push({ id: 'trig_reciprocal_mixed', value: ratio('csc'), witness: 'That is r/y, which is csc θ. sec θ goes with cos θ: r over x.' })
      slips.push({ id: 'trig_r_left_out', value: x === 0 ? 'undefined' : exactDiv(one, X), witness: `${leftOut} sec θ = r/x.` })
      break
  }
  return distinct(v, slips)
}

/** The quadrant of a point off the axes. */
export function placeOfPoint(x: number, y: number): Place {
  if (x === 0 || y === 0) {
    if (x === 0 && y === 0) throw new Error('the origin has no direction')
    return { kind: 'axis', axis: x === 0 ? (y > 0 ? 'posY' : 'negY') : x > 0 ? 'posX' : 'negX' }
  }
  return { kind: 'quadrant', quadrant: x > 0 ? (y > 0 ? 1 : 4) : y > 0 ? 2 : 3 }
}

// ---------------------------------------------------------------------------
// Arc length and sector area
// ---------------------------------------------------------------------------

export type ArcWhat = 'arc' | 'area'

/** θ given in degrees (exact), or in radians as an exact multiple of π, or as a plain number of radians. */
export type ArcTheta = { kind: 'deg'; deg: Q } | { kind: 'rad'; deg: Q } | { kind: 'plain'; rad: Q }

export interface ArcProblem {
  r: number
  theta: ArcTheta
  what: ArcWhat
}

function thetaRadians(t: ArcTheta): TrigExact {
  return t.kind === 'plain' ? exactQ(t.rad) : radiansOf(t.deg)
}

function arcOf(what: ArcWhat, r: number, theta: TrigExact): TrigExact {
  const R = exactInt(r)
  return what === 'arc' ? exactMul(R, theta) : exactMul(exactQ(q(r * r, 2)), theta)
}

export function arcAnswer(p: ArcProblem): TrigExact {
  return arcOf(p.what, p.r, thetaRadians(p.theta))
}

export function arcSlips(p: ArcProblem): TrigSlip[] {
  const answer = arcAnswer(p)
  const theta = thetaRadians(p.theta)
  const formula = p.what === 'arc' ? 's = rθ' : 'A = ½r²θ'
  const out: (TrigSlip | null)[] = []
  if (p.theta.kind === 'deg') {
    const D = angleSay(at(p.theta.deg, 'deg'))
    out.push({
      id: 'trig_arc_degrees',
      value: arcOf(p.what, p.r, exactQ(p.theta.deg)),
      witness: `Your answer uses ${D} as if it were in radians. ${formula} needs θ in radians, so change ${D} first.`,
    })
    out.push({
      id: 'trig_conversion_inverted',
      value: arcOf(p.what, p.r, exactDiv(exactMul(exactQ(p.theta.deg), exactInt(180)), PI)),
      witness: `Your answer changes ${D} to radians with 180/π. From degrees to radians the factor is π/180.`,
    })
  }
  if (p.what === 'area') {
    out.push({ id: 'trig_sector_no_half', value: exactMul(exactInt(p.r * p.r), theta), witness: 'Your answer is r²θ, twice the sector. The area of a sector is half of r²θ.' })
    out.push({ id: 'trig_sector_r_not_squared', value: exactMul(exactQ(q(p.r, 2)), theta), witness: 'Your answer uses r where the formula has r². The area of a sector is ½r²θ.' })
    out.push({ id: 'trig_arc_sector_swapped', value: arcOf('arc', p.r, theta), witness: 'That is rθ, the length of the arc. The area of the sector is A = ½r²θ.' })
  } else {
    out.push({ id: 'trig_arc_sector_swapped', value: arcOf('area', p.r, theta), witness: 'That is ½r²θ, the area of the sector. The length of the arc is s = rθ.' })
  }
  if (answer.pi === 1) {
    out.push({
      id: 'trig_pi_dropped',
      value: { ...answer, pi: 0 },
      witness: `Your answer has no π. The angle in radians is a number times π, so the ${p.what === 'arc' ? 'arc length' : 'area'} has a π in it too.`,
    })
  }
  return distinct(answer, out)
}

/** The rounded value of an exact answer or slip. */
export function approxOf(v: TrigExact): number {
  return exactNum(v)
}

/** For a sentence: an exact value with the minus sign. */
export function saySlipValue(v: TrigValue): string {
  return v === 'undefined' ? 'undefined' : exactSay(v)
}

