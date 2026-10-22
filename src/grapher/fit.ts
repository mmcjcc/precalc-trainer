/**
 * "Zoom to fit": a window that shows the interesting part of every visible curve. Each curve's points of interest
 * (zeros, turns, crossings) are found at widening scales, ±10 up to ±100000, and the widest scale that still has only
 * a handful of them is kept, so y = 500x − 2x² shows both zeros and its top, sin x shows a few waves, and
 * (x − 5000)² is found at all. The x-range holds those points with a margin; the y-range holds the curves' values there
 * (the extreme 2% of samples dropped, so an asymptote does not flatten everything) and every point of interest.
 * Points and vertical lines count too. Pure.
 */
import type { CurveFn } from './model'
import { pointsOfInterest, type Poi } from './poi'
import { clampWindow, STANDARD_WINDOW, type ViewWindow } from './view'

export interface FitInput {
  curves: { index: number; fn: CurveFn }[]
  vlines?: { index: number; x: number }[]
  points?: { x: number; y: number }[]
}

const SCALES = [10, 100, 1000, 10000, 100000]
/** Up to this many points of interest per curve, its scale is "a handful". */
const HANDFUL = 12

function featuresByCurve(input: FitInput): Map<number, Poi[]> {
  const byScale = SCALES.map((s) => pointsOfInterest({ curves: input.curves, vlines: input.vlines, xMin: -s, xMax: s, samples: 800, cap: 40 }))
  const chosen = new Map<number, Poi[]>()
  for (const c of input.curves) {
    const mine = (pois: Poi[]) => pois.filter((p) => p.rows.includes(c.index) && !(p.kinds.length === 1 && p.kinds[0] === 'yint'))
    let pick: Poi[] | null = null
    for (const pois of byScale) {
      const f = mine(pois)
      if (f.length > HANDFUL) {
        // Too many already (a wave): the smallest scale's nearest ones.
        if (pick === null) pick = [...f].sort((a, b) => Math.abs(a.x) - Math.abs(b.x)).slice(0, HANDFUL)
        break
      }
      if (f.length > 0) pick = f
    }
    if (pick === null) {
      // No zeros, turns or crossings anywhere: its y-intercept, if it has one.
      const yint = byScale[0]!.find((p) => p.rows.length === 1 && p.rows[0] === c.index && p.kinds.includes('yint'))
      pick = yint ? [yint] : []
    }
    chosen.set(c.index, pick)
  }
  return chosen
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return Number.NaN
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))
  return sorted[i]!
}

/** A y-range that holds the curves over [x0, x1] and the given heights. */
export function fitY(curves: readonly CurveFn[], x0: number, x1: number, keep: readonly number[] = [], includeZero = false): [number, number] {
  const values: number[] = []
  const n = 400
  for (const fn of curves) {
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n
      if (fn.allow && !fn.allow(x)) continue
      const y = fn.f(x)
      if (Number.isFinite(y)) values.push(y)
    }
  }
  values.sort((a, b) => a - b)
  let lo: number
  let hi: number
  if (values.length === 0) {
    const kept = keep.filter(Number.isFinite)
    lo = kept.length ? Math.min(...kept) : -10
    hi = kept.length ? Math.max(...kept) : 10
  } else {
    const full = values[values.length - 1]! - values[0]!
    const core = quantile(values, 0.98) - quantile(values, 0.02)
    // Spikes (an asymptote) make the full range far wider than the middle 96%: drop the extreme samples.
    const robust = full > 4 * core && core > 0
    lo = robust ? quantile(values, 0.02) : values[0]!
    hi = robust ? quantile(values, 0.98) : values[values.length - 1]!
  }
  for (const y of keep) {
    if (!Number.isFinite(y)) continue
    lo = Math.min(lo, y)
    hi = Math.max(hi, y)
  }
  if (includeZero) {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  if (!(hi - lo > 1e-12 * Math.max(1, Math.abs(hi)))) {
    const c = (lo + hi) / 2
    const half = Math.max(1, Math.abs(c) * 0.5)
    return [c - half, c + half]
  }
  const pad = (hi - lo) * 0.1
  return [lo - pad, hi + pad]
}

export function zoomToFit(input: FitInput): ViewWindow {
  const xs: number[] = []
  const ys: number[] = []
  if (input.curves.length > 0) {
    for (const pois of featuresByCurve(input).values()) {
      for (const p of pois) {
        xs.push(p.x)
        ys.push(p.y)
      }
    }
  }
  for (const v of input.vlines ?? []) xs.push(v.x)
  for (const p of input.points ?? []) {
    xs.push(p.x)
    ys.push(p.y)
  }
  if (input.curves.length === 0 && xs.length === 0) return { ...STANDARD_WINDOW }
  let x0: number
  let x1: number
  if (xs.length === 0) {
    x0 = STANDARD_WINDOW.xMin
    x1 = STANDARD_WINDOW.xMax
  } else {
    const lo = Math.min(...xs)
    const hi = Math.max(...xs)
    if (hi - lo <= 1e-9 * Math.max(1, Math.abs(hi))) {
      const half = Math.max(5, Math.abs(lo) * 0.1)
      x0 = lo - half
      x1 = lo + half
    } else {
      const pad = (hi - lo) * 0.12
      x0 = lo - pad
      x1 = hi + pad
    }
  }
  const [y0, y1] = input.curves.length > 0 ? fitY(input.curves.map((c) => c.fn), x0, x1, ys) : fitY([], x0, x1, ys)
  return clampWindow({ xMin: x0, xMax: x1, yMin: y0, yMax: y1 })
}
