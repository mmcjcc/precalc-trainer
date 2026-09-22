/**
 * Decimal-quarter printing for graph-features answers. Coordinates are multiples of 1/4, which are
 * exact in binary, so the strings round-trip through the interval parser ("7.25" → 29/4).
 */
import type { Endpoint, SolutionSet } from '@/shared/types'
import { normalizeSet, ratToNumber } from '@/notation'

export interface XY {
  x: number
  y: number
}

const EPS = 1e-9

export function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= EPS
}

export function isQuarter(v: number): boolean {
  return Math.abs(v * 4 - Math.round(v * 4)) <= EPS
}

/** "7.25", "-2.5", "0", "-0.25". Not a fraction: that is how the worksheet writes a point. */
export function formatQuarter(v: number): string {
  const n = Math.round(v * 4)
  if (Math.abs(v * 4 - n) > 1e-6) {
    const t = Number(v.toFixed(6))
    return Object.is(t, -0) ? '0' : String(t)
  }
  const sign = n < 0 ? '-' : ''
  const a = Math.abs(n)
  const whole = Math.floor(a / 4)
  const rem = a % 4
  const frac = ['', '.25', '.5', '.75'][rem]!
  if (whole === 0 && rem === 0) return '0'
  if (whole === 0) return `${sign}0${frac}`
  return `${sign}${whole}${frac}`
}

export function formatPoint(p: XY): string {
  return `(${formatQuarter(p.x)}, ${formatQuarter(p.y)})`
}

/** Left to right, joined the way a list of points is written. Empty → "none". */
export function joinPoints(points: readonly XY[]): string {
  if (points.length === 0) return 'none'
  return points.map(formatPoint).join(' and ')
}

function formatEndpoint(e: Endpoint): string {
  if (e === 'inf') return 'inf'
  if (e === '-inf') return '-inf'
  return formatQuarter(ratToNumber(e))
}

/** "(-2.5, 2) U (7.25, inf)". Open/closed flags are preserved; our answers are open at every turn. */
export function formatInterval(set: SolutionSet): string {
  const n = normalizeSet(set)
  if (n.pieces.length === 0 && n.points.length === 0) return '{}'
  const parts = n.pieces.map((p) => `${p.loClosed ? '[' : '('}${formatEndpoint(p.lo)}, ${formatEndpoint(p.hi)}${p.hiClosed ? ']' : ')'}`)
  if (n.points.length > 0) parts.push(`{${n.points.map((p) => formatQuarter(ratToNumber(p))).join(', ')}}`)
  return parts.join(' U ')
}
