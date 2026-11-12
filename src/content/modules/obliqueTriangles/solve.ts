/**
 * The arithmetic of oblique triangles, in plain floating point (no exact work: every answer is rounded): the laws of
 * sines and cosines, the ambiguous case, the two area formulas, and the checks every drawn triangle passes. Angles
 * are in degrees throughout; `inRadians` versions are what a calculator left in RADIAN mode shows.
 */
import { roundPlaces } from '../explog/text'

export const RAD = Math.PI / 180

export const sinD = (deg: number): number => Math.sin(deg * RAD)
export const cosD = (deg: number): number => Math.cos(deg * RAD)
/** sin⁻¹ and cos⁻¹ in degrees (NaN outside [−1, 1]). */
export const asinD = (x: number): number => Math.asin(x) / RAD
export const acosD = (x: number): number => Math.acos(x) / RAD

/** The law of sines: the side across from `askedAngle`, from a side and the angle across from it. */
export function sinesSide(known: number, knownAngle: number, askedAngle: number): number {
  return (known * sinD(askedAngle)) / sinD(knownAngle)
}

/** The law of cosines: the side across from the included angle `C` between sides `a` and `b`. */
export function cosinesSide(a: number, b: number, C: number): number {
  return Math.sqrt(a * a + b * b - 2 * a * b * cosD(C))
}

/** cos of the angle across from side `c`, from three sides. */
export function cosOfAngle(a: number, b: number, c: number): number {
  return (a * a + b * b - c * c) / (2 * a * b)
}

/** The angle across from side `c`, in degrees, from three sides. */
export function angleFromSides(a: number, b: number, c: number): number {
  return acosD(cosOfAngle(a, b, c))
}

/** ½ab sin C. */
export function sasArea(a: number, b: number, C: number): number {
  return 0.5 * a * b * sinD(C)
}

/** Heron's formula with s = (a + b + c)/2. */
export function heronArea(a: number, b: number, c: number): number {
  const s = (a + b + c) / 2
  return Math.sqrt(s * (s - a) * (s - b) * (s - c))
}

/** Sine to `places` decimal places, as it would be written down mid-problem. */
export function roundTo(v: number, places: number): number {
  return Number(roundPlaces(v, places))
}

/** True when `value` sits within `margin` of a rounding boundary at `places` (redraw such problems). */
export function nearBoundary(value: number, places: number, margin = 0.02): boolean {
  const scale = 10 ** places
  const x = Math.abs(value) * scale
  const f = x - Math.floor(x)
  return Math.abs(f - 0.5) / scale < margin
}

export type SsaCount = 'none' | 'one' | 'two'

/** The ambiguous case, A acute: compare a with the height h = b sin A and with b. */
export function ssaCount(A: number, a: number, b: number): SsaCount {
  const h = b * sinD(A)
  if (a < h) return 'none'
  if (a < b) return 'two'
  return 'one'
}

/** The three angles of a triangle with these sides, in degrees (across from a, b, c). */
export function anglesOf(a: number, b: number, c: number): [number, number, number] {
  return [angleFromSides(b, c, a), angleFromSides(a, c, b), angleFromSides(a, b, c)]
}

/** Every angle from 15° up and none a right angle (or within `rightMargin` of one); the sum is 180°. */
export function anglesOk(angles: readonly number[], rightMargin = 3): boolean {
  if (Math.abs(angles.reduce((s, x) => s + x, 0) - 180) > 1e-6) return false
  return angles.every((x) => x >= 15 && Math.abs(x - 90) >= rightMargin)
}

/** The triangle inequality with a margin: the longest side at most 90% of the other two together. */
export function sidesOk(a: number, b: number, c: number): boolean {
  const [x, y, z] = [a, b, c].sort((p, q) => p - q) as [number, number, number]
  return z <= 0.9 * (x + y)
}

/** A given length as typed: a whole number or one decimal ("12", "8.5"). */
export function lengthText(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}
