/**
 * Graph specs for Unit 5 (drawn by components/TrigGraph): a wave y = A·f(B(x − C)) + D sampled to its true shape, in
 * runs split at its vertical asymptotes; x ticks at multiples of π/k chosen so the key points fall on ticks (or a plain
 * step when the period has no π); y ticks; dashed asymptotes; labelled points with exact coordinates. The words
 * describe the picture and never name the function, the period or the amplitude.
 */
import type { GraphGuide, GraphMarker, GraphSample, GraphSpec } from '@/shared/types'
import { exactNum, exactSay, isSinusoid, waveAsymptotes, wavePeriod, waveValue, type TrigExact, type Wave } from '@/engine/trig'

export interface WaveGraphOptions {
  /** The x-window. */
  window: [number, number]
  /** The y-window; by default the wave's band and the x-axis, with room above and below. */
  yWindow?: [number, number]
  /** Labelled points (exact coordinates, said with − signs). */
  markers?: GraphMarker[]
  /** Dashed vertical asymptotes (tan, cot, sec, csc). */
  asymptotes?: boolean
  /** The screen-reader name; a matching card's is "Graph A". */
  ariaLabel?: string
}

/** A label "(π/4, −2)" for an exact point. */
export function pointLabel(x: TrigExact, y: TrigExact): string {
  return `(${exactSay(x)}, ${exactSay(y)})`
}

/** A tick step for a span: 4 to 10 ticks. */
export function niceStep(span: number, max = 10): number {
  for (const s of [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100]) if (span / s <= max) return s
  return 200
}

/**
 * x ticks for a period P (exact): multiples of π/k with the quarter period a whole number of ticks when it can be, at
 * most 24 ticks in the window; a plain step when the period has no π.
 */
export function xTicksFor(period: TrigExact, width: number): { xPiOver?: number; xStep?: number } {
  if (period.pi === 1) {
    const quarter = exactNum(period) / 4
    for (const k of [1, 2, 3, 4, 6, 8, 12]) {
      const step = Math.PI / k
      const perQuarter = quarter / step
      if (Math.abs(perQuarter - Math.round(perQuarter)) < 1e-9 && Math.round(perQuarter) >= 1 && width / step <= 24) return { xPiOver: k }
    }
    for (const k of [1, 2, 3, 4, 6, 8, 12]) if (width / (Math.PI / k) <= 24 && width / (Math.PI / k) >= 4) return { xPiOver: k }
    return { xPiOver: 12 }
  }
  const quarter = exactNum(period) / 4
  for (const s of [0.25, 0.5, 1, 2, 3, 5, 10, 15, 30, 50]) {
    const per = quarter / s
    if (Math.abs(per - Math.round(per)) < 1e-9 && Math.round(per) >= 1 && width / s <= 24) return { xStep: s }
  }
  return { xStep: niceStep(width, 20) }
}

/** Points from a to b, dense near both ends (where a branch runs off to an asymptote). */
function spread(a: number, b: number, n: number, clustered: boolean): number[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    return a + (b - a) * (clustered ? (1 - Math.cos(Math.PI * t)) / 2 : t)
  })
}

/** The wave sampled over the window: one run for sin and cos, one per branch for the others. */
export function waveRuns(w: Wave, window: [number, number]): GraphSample[][] {
  const [lo, hi] = window
  if (isSinusoid(w.fn)) return [spread(lo, hi, 360, false).map((x) => ({ x, y: waveValue(w, x) }))]
  const fam = waveAsymptotes(w)!
  const step = exactNum(fam.step)
  const base = exactNum(fam.base)
  const cuts: number[] = []
  for (let k = Math.floor((lo - base) / step); base + k * step <= hi; k++) {
    const x = base + k * step
    if (x > lo && x < hi) cuts.push(x)
  }
  const edges = [lo, ...cuts, hi]
  const runs: GraphSample[][] = []
  const eps = (hi - lo) * 2e-4
  for (let i = 0; i + 1 < edges.length; i++) {
    const a = edges[i]! + (i > 0 ? eps : 0)
    const b = edges[i + 1]! - (i + 1 < edges.length - 1 ? eps : 0)
    if (b <= a) continue
    const n = Math.max(60, Math.round((240 * (b - a)) / (hi - lo)))
    runs.push(spread(a, b, n, true).map((x) => ({ x, y: waveValue(w, x) })))
  }
  return runs
}

/** The asymptotes in the window, as dashed guides. */
export function asymptoteGuides(w: Wave, window: [number, number]): GraphGuide[] {
  const fam = waveAsymptotes(w)
  if (!fam) return []
  const step = exactNum(fam.step)
  const base = exactNum(fam.base)
  const out: GraphGuide[] = []
  for (let k = Math.floor((window[0] - base) / step); base + k * step <= window[1]; k++) {
    const x = base + k * step
    if (x > window[0] && x < window[1]) out.push({ x, label: 'asymptote' })
  }
  return out
}

/** The default y-window: the wave's band (or, for the others, a few heights past its turning points) and the x-axis. */
export function waveYWindow(w: Wave): [number, number] {
  const a = Math.abs(w.A.n / w.A.d)
  const d = w.D.n / w.D.d
  if (isSinusoid(w.fn)) {
    const lo = Math.min(d - a, 0)
    const hi = Math.max(d + a, 0)
    const pad = 0.18 * (hi - lo) + 0.4
    return [lo - pad, hi + pad]
  }
  const reach = Math.max(3 * a, 3)
  return [Math.min(d - reach, -1), Math.max(d + reach, 1)]
}

/** A wave's graph spec. */
export function waveGraph(w: Wave, o: WaveGraphOptions): GraphSpec {
  const window = o.window
  const yWindow = o.yWindow ?? waveYWindow(w)
  const xt = xTicksFor(wavePeriod(w), window[1] - window[0])
  const span = yWindow[1] - yWindow[0]
  const spec: GraphSpec = {
    kind: 'function',
    runs: waveRuns(w, window),
    xDomain: window,
    yDomain: yWindow,
    ticks: { ...xt, yStep: niceStep(span, 10) },
  }
  if (o.markers?.length) spec.markers = o.markers
  if (o.asymptotes) spec.guides = asymptoteGuides(w, window)
  if (o.ariaLabel) spec.ariaLabel = o.ariaLabel
  return spec
}

/** Any function's graph spec (an inverse function, a model): samples of f over the window, plain or π ticks. */
export function plainGraph(f: (x: number) => number, o: { window: [number, number]; yWindow: [number, number]; ticks: GraphSpec['ticks']; markers?: GraphMarker[]; ariaLabel?: string; n?: number }): GraphSpec {
  const [lo, hi] = o.window
  const n = o.n ?? 300
  const samples = Array.from({ length: n + 1 }, (_, i) => {
    const x = lo + ((hi - lo) * i) / n
    return { x, y: f(x) }
  })
  const spec: GraphSpec = { kind: 'function', runs: [samples], xDomain: o.window, yDomain: o.yWindow, ticks: o.ticks }
  if (o.markers?.length) spec.markers = o.markers
  if (o.ariaLabel) spec.ariaLabel = o.ariaLabel
  return spec
}
