/**
 * Exact values of the six trig functions: at every multiple of 30° and 45° (from the point on the unit circle,
 * built from the two special right triangles and the signs of the quadrant), and from a point (x, y) with whole
 * coordinates on the terminal side, with r = √(x² + y²). A ratio with zero on the bottom is 'undefined'.
 */
import { isSpecialDeg, placeOf, referenceDeg } from './angle'
import { EXACT_ONE, EXACT_ZERO, exactAscii, exactDiv, exactEq, exactInt, exactNeg, exactSay, exactSqrt, exactTex, exactText, isZero, tx, type TrigExact } from './exact'
import { q, qNum, type Q } from './rational'

export type TrigFn = 'sin' | 'cos' | 'tan' | 'csc' | 'sec' | 'cot'
export const TRIG_FNS: readonly TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']

/** An exact value, or 'undefined' where the ratio has zero on the bottom. */
export type TrigValue = TrigExact | 'undefined'

const HALF = tx(q(1, 2))
const ROOT2_HALF = tx(q(1, 2), 2)
const ROOT3_HALF = tx(q(1, 2), 3)

/** (cos, sin) of an acute special angle: the 30°-60°-90° and 45°-45°-90° triangles with hypotenuse 1. */
function acutePoint(ref: number): { x: TrigExact; y: TrigExact } | null {
  if (ref === 30) return { x: ROOT3_HALF, y: HALF }
  if (ref === 45) return { x: ROOT2_HALF, y: ROOT2_HALF }
  if (ref === 60) return { x: HALF, y: ROOT3_HALF }
  return null
}

/** The point (cos θ, sin θ) on the unit circle, for a multiple of 30° or 45°; null for any other angle. */
export function unitPoint(deg: Q): { x: TrigExact; y: TrigExact } | null {
  if (!isSpecialDeg(deg)) return null
  const place = placeOf(deg)
  if (place.kind === 'axis') {
    const one = EXACT_ONE
    const zero = EXACT_ZERO
    switch (place.axis) {
      case 'posX':
        return { x: one, y: zero }
      case 'posY':
        return { x: zero, y: one }
      case 'negX':
        return { x: exactNeg(one), y: zero }
      case 'negY':
        return { x: zero, y: exactNeg(one) }
    }
  }
  const ref = referenceDeg(deg)
  const acute = ref ? acutePoint(qNum(ref)) : null
  if (!acute) return null
  const sx = place.quadrant === 1 || place.quadrant === 4 ? 1 : -1
  const sy = place.quadrant === 1 || place.quadrant === 2 ? 1 : -1
  return { x: sx > 0 ? acute.x : exactNeg(acute.x), y: sy > 0 ? acute.y : exactNeg(acute.y) }
}

function over(top: TrigExact, bottom: TrigExact): TrigValue {
  return isZero(bottom) ? 'undefined' : exactDiv(top, bottom)
}

/** One of the six ratios of a point (x, y) at distance r: sin = y/r, cos = x/r, tan = y/x, and their reciprocals. */
export function ratioOf(fn: TrigFn, x: TrigExact, y: TrigExact, r: TrigExact): TrigValue {
  switch (fn) {
    case 'sin':
      return over(y, r)
    case 'cos':
      return over(x, r)
    case 'tan':
      return over(y, x)
    case 'csc':
      return over(r, y)
    case 'sec':
      return over(r, x)
    case 'cot':
      return over(x, y)
  }
}

/** fn(θ) exactly at a multiple of 30° or 45°; null at any other angle. */
export function trigValue(fn: TrigFn, deg: Q): TrigValue | null {
  const p = unitPoint(deg)
  if (!p) return null
  return ratioOf(fn, p.x, p.y, EXACT_ONE)
}

/** r = √(x² + y²) for whole x and y, exactly (5, √13, 2√5). */
export function pointR(x: number, y: number): TrigExact {
  const r = exactSqrt(exactInt(x * x + y * y))
  if (!r) throw new Error('no distance')
  return r
}

/** fn(θ) for θ in standard position with (x, y) on its terminal side. */
export function pointValue(fn: TrigFn, x: number, y: number): TrigValue {
  return ratioOf(fn, exactInt(x), exactInt(y), pointR(x, y))
}

export function valueEq(a: TrigValue, b: TrigValue): boolean {
  if (a === 'undefined' || b === 'undefined') return a === b
  return exactEq(a, b)
}

export function valueNeg(v: TrigValue): TrigValue {
  return v === 'undefined' ? v : exactNeg(v)
}

/** As she would type it: "√3/2", "-1", "undefined". */
export function valueText(v: TrigValue): string {
  return v === 'undefined' ? 'undefined' : exactText(v)
}

export function valueAscii(v: TrigValue): string {
  return v === 'undefined' ? 'undefined' : exactAscii(v)
}

/** For a sentence: "−√3/2", "undefined". */
export function valueSay(v: TrigValue): string {
  return v === 'undefined' ? 'undefined' : exactSay(v)
}

export function valueTex(v: TrigValue): string {
  return v === 'undefined' ? '\\text{undefined}' : exactTex(v)
}

/** sin ↔ csc, cos ↔ sec, tan ↔ cot. */
export function reciprocalFn(fn: TrigFn): TrigFn {
  const pairs: Record<TrigFn, TrigFn> = { sin: 'csc', csc: 'sin', cos: 'sec', sec: 'cos', tan: 'cot', cot: 'tan' }
  return pairs[fn]
}

/** KaTeX command for the function name. */
export function fnTex(fn: TrigFn): string {
  return `\\${fn}`
}
