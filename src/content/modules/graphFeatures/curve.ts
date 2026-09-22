/**
 * The drawn curve: cubic Hermite pieces with zero slopes at every turning point, and a quadratic
 * tail past each outer turn.
 *
 * On [x0, x1] with p'(x0) = p'(x1) = 0,
 *   p(x) = y0 (1 - 3t^2 + 2t^3) + y1 (3t^2 - 2t^3),  t = (x - x0) / (x1 - x0).
 * Then p'(x) = 6t(1 - t) (y1 - y0) / (x1 - x0), which is zero only at the ends and has the sign of
 * y1 - y0 in between, so the piece is strictly monotone when the heights differ.
 * The tail p(x) = y + s c (x - xTurn)^2, s = +1 at a min and -1 at a max, matches value and slope
 * at the turn and leaves the window with no extra turning point.
 */
import type { GraphFeaturesTurn } from '@/content/types'
import type { GraphMarker, GraphSample } from '@/shared/types'
import { formatQuarter } from './format'

export type Turn = GraphFeaturesTurn

export interface CurveModel {
  turns: Turn[]
  /** Positive quadratic coefficient of both tails. */
  tail: number
  xDomain: [number, number]
  yDomain: [number, number]
  /** Unclipped samples, including every turning point, so the polyline passes through them. */
  samples: GraphSample[]
  markers: GraphMarker[]
}

/** y at x. Exact at each turning point (the Hermite / quadratic endpoint). */
export function valueAt(turns: readonly Turn[], tail: number, x: number): number {
  const first = turns[0]!
  const last = turns[turns.length - 1]!
  if (x <= first.x) return first.y + tailSign(first) * tail * (x - first.x) ** 2
  if (x >= last.x) return last.y + tailSign(last) * tail * (x - last.x) ** 2
  for (let i = 0; i < turns.length - 1; i++) {
    const a = turns[i]!
    const b = turns[i + 1]!
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x)
      const t2 = t * t
      const t3 = t2 * t
      return a.y * (1 - 3 * t2 + 2 * t3) + b.y * (3 * t2 - 2 * t3)
    }
  }
  return last.y
}

/** Analytic slope. Exactly 0 at each turning point; strictly the monotone sign elsewhere. */
export function slopeAt(turns: readonly Turn[], tail: number, x: number): number {
  for (const p of turns) if (x === p.x) return 0
  const first = turns[0]!
  const last = turns[turns.length - 1]!
  if (x < first.x) return tailSign(first) * 2 * tail * (x - first.x)
  if (x > last.x) return tailSign(last) * 2 * tail * (x - last.x)
  for (let i = 0; i < turns.length - 1; i++) {
    const a = turns[i]!
    const b = turns[i + 1]!
    if (x < b.x) {
      const dx = b.x - a.x
      const t = (x - a.x) / dx
      return (6 * t * (1 - t) * (b.y - a.y)) / dx
    }
  }
  return 0
}

function tailSign(p: Turn): 1 | -1 {
  return p.kind === 'min' ? 1 : -1
}

function sampleCurve(turns: readonly Turn[], tail: number, xLo: number, xHi: number): GraphSample[] {
  const n = 360
  const xs: number[] = []
  for (let i = 0; i <= n; i++) xs.push(xLo + ((xHi - xLo) * i) / n)
  for (const t of turns) xs.push(t.x)
  xs.sort((a, b) => a - b)
  const out: GraphSample[] = []
  for (const x of xs) {
    const prev = out[out.length - 1]
    if (prev && prev.x === x) continue
    out.push({ x, y: valueAt(turns, tail, x) })
  }
  return out
}

/**
 * Window with every turn strictly inside, and a tail coefficient large enough that both ends are
 * outside the y-window (the curve runs off the graph in the right direction).
 */
export function buildCurve(turnsIn: readonly Turn[]): CurveModel {
  const turns = [...turnsIn].sort((a, b) => a.x - b.x)
  const xs = turns.map((t) => t.x)
  const ys = turns.map((t) => t.y)
  const xPad = 3
  const yPad = 2.75
  let xLo = Math.min(...xs) - xPad
  let xHi = Math.max(...xs) + xPad
  let yLo = Math.min(...ys) - yPad
  let yHi = Math.max(...ys) + yPad
  const minSpan = 10
  if (xHi - xLo < minSpan) {
    const mid = (xHi + xLo) / 2
    xLo = mid - minSpan / 2
    xHi = mid + minSpan / 2
  }
  if (yHi - yLo < minSpan) {
    const mid = (yHi + yLo) / 2
    yLo = mid - minSpan / 2
    yHi = mid + minSpan / 2
  }
  const first = turns[0]!
  const last = turns[turns.length - 1]!
  // y = p.y + s c d^2 should land `over` past the window at the x-edge.
  const need = (p: Turn, edge: number): number => {
    const d = Math.abs(p.x - edge)
    const over = 0.6
    const target = tailSign(p) > 0 ? yHi + over - p.y : p.y - (yLo - over)
    return target / (d * d)
  }
  const tail = Math.max(need(first, xLo), need(last, xHi), 0.05)
  const markers: GraphMarker[] = turns.map((t) => ({
    x: t.x,
    y: t.y,
    label: `(${formatQuarter(t.x)}, ${formatQuarter(t.y)})`,
    labelSide: t.kind === 'max' ? 'above' : 'below',
  }))
  return {
    turns,
    tail,
    xDomain: [xLo, xHi],
    yDomain: [yLo, yHi],
    samples: sampleCurve(turns, tail, xLo, xHi),
    markers,
  }
}
