/**
 * Exact angles. An angle is its measure in degrees (a rational) and the unit it is written in; a radian measure is
 * a rational multiple of π, deg/180 of it. Everything here is exact: the quadrant (or the axis) of any angle,
 * negative ones and ones past a full turn included, the coterminal angle in [0°, 360°) or [0, 2π), and the
 * reference angle.
 */
import { exactPi, exactQ, exactSay, exactTex, exactText, type TrigExact } from './exact'
import { q, qAdd, qCmp, qDiv, qEq, qFloor, qMul, qNeg, qNum, qSub, qText, type Q } from './rational'

export type AngleUnit = 'deg' | 'rad'

/** An exact angle: its size in degrees (negative turns clockwise) and the unit it is written in. */
export interface TrigAngle {
  deg: Q
  unit: AngleUnit
}

export type Quadrant = 1 | 2 | 3 | 4
export type Axis = 'posX' | 'posY' | 'negX' | 'negY'
export type Place = { kind: 'quadrant'; quadrant: Quadrant } | { kind: 'axis'; axis: Axis }

export const FULL_TURN: Q = q(360)
export const HALF_TURN: Q = q(180)
export const QUARTER_TURN: Q = q(90)

export function angle(deg: Q | number, unit: AngleUnit): TrigAngle {
  return { deg: typeof deg === 'number' ? q(deg) : deg, unit }
}

/** k·π radians in degrees: 180k. */
export function degFromPiMultiple(k: Q): Q {
  return qMul(k, HALF_TURN)
}

/** Degrees as a multiple of π: deg/180. */
export function piMultipleFromDeg(deg: Q): Q {
  return qDiv(deg, HALF_TURN)
}

/** The radian measure of an angle given in degrees, exactly: (deg/180)·π. */
export function radiansOf(deg: Q): TrigExact {
  return exactPi(piMultipleFromDeg(deg))
}

/** The measure in the angle's own unit: degrees as a number, radians as a multiple of π. */
export function measureOf(a: TrigAngle): TrigExact {
  return a.unit === 'deg' ? exactQ(a.deg) : radiansOf(a.deg)
}

/** Degrees as she would type them: "150", "-210", "22.5" (a fraction when it does not end). */
export function degText(deg: Q): string {
  if (deg.d === 1) return String(deg.n)
  let d = deg.d
  while (d % 2 === 0) d /= 2
  while (d % 5 === 0) d /= 5
  if (d === 1) return String(Number((qNum(deg)).toFixed(10)))
  return qText(deg)
}

/** As she would type it: "150" for degrees (the ° is optional), "5π/6" for radians. */
export function angleText(a: TrigAngle): string {
  return a.unit === 'deg' ? degText(a.deg) : exactText(radiansOf(a.deg))
}

/** For a sentence: "150°", "−210°", "5π/6", "−11π/4". */
export function angleSay(a: TrigAngle): string {
  if (a.unit === 'deg') return `${degText(a.deg).replace(/-/g, '−')}°`
  return exactSay(radiansOf(a.deg))
}

/** KaTeX: "150^{\circ}", "-\frac{11\pi}{4}". */
export function angleTex(a: TrigAngle): string {
  if (a.unit === 'deg') return `${degText(a.deg)}^{\\circ}`
  return exactTex(radiansOf(a.deg))
}

/** The number of full turns added to bring the angle into [0°, 360°): negative when turns are taken away. */
export function turnsTo(deg: Q): number {
  return 0 - qFloor(qDiv(deg, FULL_TURN))
}

/** The coterminal angle in [0°, 360°). */
export function coterminalDeg(deg: Q): Q {
  return qAdd(deg, qMul(q(turnsTo(deg)), FULL_TURN))
}

export function placeOf(deg: Q): Place {
  const c = coterminalDeg(deg)
  if (c.n === 0) return { kind: 'axis', axis: 'posX' }
  const vs90 = qCmp(c, QUARTER_TURN)
  if (vs90 < 0) return { kind: 'quadrant', quadrant: 1 }
  if (vs90 === 0) return { kind: 'axis', axis: 'posY' }
  const vs180 = qCmp(c, HALF_TURN)
  if (vs180 < 0) return { kind: 'quadrant', quadrant: 2 }
  if (vs180 === 0) return { kind: 'axis', axis: 'negX' }
  const vs270 = qCmp(c, q(270))
  if (vs270 < 0) return { kind: 'quadrant', quadrant: 3 }
  if (vs270 === 0) return { kind: 'axis', axis: 'negY' }
  return { kind: 'quadrant', quadrant: 4 }
}

export function samePlace(a: Place, b: Place): boolean {
  return a.kind === 'quadrant' ? b.kind === 'quadrant' && a.quadrant === b.quadrant : b.kind === 'axis' && a.axis === b.axis
}

const ROMAN: Record<Quadrant, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }
const AXIS_WORDS: Record<Axis, string> = { posX: 'the positive x-axis', posY: 'the positive y-axis', negX: 'the negative x-axis', negY: 'the negative y-axis' }

export function quadrantName(qd: Quadrant): string {
  return `Quadrant ${ROMAN[qd]}`
}

/** "Quadrant II", "the negative y-axis". */
export function placeWords(p: Place): string {
  return p.kind === 'quadrant' ? quadrantName(p.quadrant) : AXIS_WORDS[p.axis]
}

/** The acute angle between the terminal side and the x-axis, in degrees; null on an axis. */
export function referenceDeg(deg: Q): Q | null {
  const p = placeOf(deg)
  if (p.kind === 'axis') return null
  const c = coterminalDeg(deg)
  switch (p.quadrant) {
    case 1:
      return c
    case 2:
      return qSub(HALF_TURN, c)
    case 3:
      return qSub(c, HALF_TURN)
    case 4:
      return qSub(FULL_TURN, c)
  }
}

/**
 * The half-turn slip: steps of 180° (π) toward [0°, 360°), stopping at the first angle inside. Null for an angle
 * already inside. It equals the coterminal angle when an even number of half turns was needed.
 */
export function halfTurnSlipDeg(deg: Q): Q | null {
  if (qCmp(deg, q(0)) >= 0 && qCmp(deg, FULL_TURN) < 0) return null
  let v = deg
  const step = qCmp(deg, q(0)) < 0 ? HALF_TURN : qNeg(HALF_TURN)
  for (let i = 0; i < 1000; i++) {
    v = qAdd(v, step)
    if (qCmp(v, q(0)) >= 0 && qCmp(v, FULL_TURN) < 0) return v
  }
  return null
}

/** One full turn short of the coterminal angle, still outside [0°, 360°); null when that is the angle itself. */
export function oneTurnShortDeg(deg: Q): Q | null {
  const c = coterminalDeg(deg)
  const t = turnsTo(deg)
  if (t === 0) return null
  const short = t > 0 ? qSub(c, FULL_TURN) : qAdd(c, FULL_TURN)
  return qEq(short, deg) ? null : short
}

/** A negative angle turned counterclockwise instead: the coterminal angle of its size. Null for θ ≥ 0. */
export function negativeDirectionDeg(deg: Q): Q | null {
  if (deg.n >= 0) return null
  return coterminalDeg(qNeg(deg))
}

/** True when the angle is a whole multiple of 30° or of 45° (where the six exact values are known). */
export function isSpecialDeg(deg: Q): boolean {
  if (deg.d !== 1) return false
  return deg.n % 30 === 0 || deg.n % 45 === 0
}
