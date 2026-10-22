/**
 * Adaptive sampling of y = f(x) for drawing. The curve is first cut at its possible breaks: the zeros of its critical
 * sub-expressions (compile.ts: denominators, the cosine under a tangent, the insides of logs and square roots) and of
 * her restriction's boundaries. Between two cuts it is sampled every couple of pixels and each piece of chord is
 * split again until it is within a fraction of a pixel of the curve (steep and wiggly stretches get more points,
 * flat ones few; stretches far above or below the window are not refined). At each cut both one-sided limits decide:
 * a curve that is continuous there carries on, a missing point is a hole (an open circle, the line left open), a jump
 * or an asymptote ends the piece, so no line is ever drawn across tan x's asymptotes or across 1/x at 0, and a domain
 * edge (√x at 0) ends the curve exactly there. A jump the analysis could not foresee (floor) is found by bisection: a
 * change that does not shrink as the step does is a break, a steep one that does is still the curve. Pure.
 */
import { zerosAlong, type Fn } from './roots'
import type { ViewWindow } from './view'

export type Quality = 'full' | 'fast'

export interface SampleRequest {
  f: Fn
  /** Critical sub-expressions: where one is zero the curve may break. */
  crit: readonly Fn[]
  /** Her restriction: where the curve exists ({x > 0}). */
  allow?: (x: number) => boolean
  /** The restriction's boundaries (left side minus right side of each condition). */
  allowCrit?: readonly Fn[]
  /** The x range to sample: the window, usually a little wider so lines run off its edges. */
  x0: number
  x1: number
  /** The window and the plane's size in pixels, for the tolerances. */
  window: ViewWindow
  width: number
  height: number
  quality: Quality
}

export interface Sampled {
  /** Continuous pieces, each a flat list x0, y0, x1, y1, … in graph units (far-off values held a few windows away). */
  pieces: number[][]
  /** Holes: open circles where the curve lacks one point. */
  holes: { x: number; y: number }[]
  /** Ends of a restricted piece: filled where the restriction includes the end, open where it does not. */
  ends: { x: number; y: number; closed: boolean }[]
}

const SETTINGS = {
  full: { stepPx: 2, tolPx: 0.3, maxDepth: 10, budget: 24000, critPerPx: 1 },
  fast: { stepPx: 4, tolPx: 1, maxDepth: 5, budget: 6000, critPerPx: 0.5 },
} as const

/** How many cuts a curve may have in view before the extras are left to the jump test (tan x zoomed far out). */
const MAX_CUTS = 3000

export function sampleCurve(req: SampleRequest): Sampled {
  const { window: w, width, height } = req
  const s = SETTINGS[req.quality]
  const out: Sampled = { pieces: [], holes: [], ends: [] }
  if (!(req.x1 > req.x0) || !(width > 0) || !(height > 0)) return out
  const pxX = width / (w.xMax - w.xMin)
  const pxY = height / (w.yMax - w.yMin)
  const ySpan = w.yMax - w.yMin
  const yHi = w.yMax + 4 * ySpan
  const yLo = w.yMin - 4 * ySpan
  const allow = req.allow
  const raw = (x: number): number => (allow && !allow(x) ? Number.NaN : req.f(x))
  const clamp = (y: number) => (y > yHi ? yHi : y < yLo ? yLo : y)
  const val = (x: number): number => {
    const y = raw(x)
    return Number.isNaN(y) ? y : clamp(y)
  }

  // ---- the cuts ----
  const span = req.x1 - req.x0
  const nCrit = Math.max(64, Math.ceil(width * s.critPerPx))
  const cutKind = new Map<number, 'crit' | 'allow'>()
  const collect = (g: Fn, kind: 'crit' | 'allow') => {
    for (const c of zerosAlong(g, req.x0, req.x1, nCrit, MAX_CUTS)) {
      if (c <= req.x0 || c >= req.x1) continue
      if (!cutKind.has(c) || kind === 'allow') cutKind.set(c, kind)
    }
  }
  for (const g of req.crit) collect(g, 'crit')
  for (const g of req.allowCrit ?? []) collect(g, 'allow')
  const cuts: number[] = []
  for (const c of [...cutKind.keys()].sort((a, b) => a - b)) {
    const last = cuts[cuts.length - 1]
    if (last !== undefined && c - last <= span * 1e-12) {
      if (cutKind.get(c) === 'allow') cutKind.set(last, 'allow')
      continue
    }
    cuts.push(c)
    if (cuts.length >= MAX_CUTS) break
  }

  // ---- pieces ----
  let cur: number[] | null = null
  let points = 0
  const add = (x: number, y: number) => {
    if (cur === null) cur = []
    const n = cur.length
    if (n >= 2 && cur[n - 2] === x) return
    cur.push(x, y)
    points++
  }
  const endPiece = () => {
    if (cur !== null && cur.length >= 4) out.pieces.push(cur)
    cur = null
  }
  const lastPoint = (): [number, number] | null => (cur !== null && cur.length >= 2 ? [cur[cur.length - 2]!, cur[cur.length - 1]!] : null)

  /** The defined point nearest the edge between a defined and an undefined sample. */
  function findEdge(xd: number, yd: number, xu: number): [number, number] {
    let a = xd
    let fa = yd
    let b = xu
    for (let k = 0; k < 60; k++) {
      const m = a + (b - a) / 2
      if (m === a || m === b || Math.abs(b - a) * pxX < 1e-4) break
      const fm = val(m)
      if (Number.isNaN(fm)) b = m
      else {
        a = m
        fa = fm
      }
    }
    return [a, fa]
  }

  /** At the finest step the chord is still far from the curve: a jump, or only steep? */
  function closeOrBreak(x0: number, y0: number, x1: number, y1: number) {
    if (Math.abs(y1 - y0) * pxY <= 2) {
      add(x1, y1)
      return
    }
    let a = x0
    let fa = y0
    let b = x1
    let fb = y1
    for (let k = 0; k < 52; k++) {
      const m = a + (b - a) / 2
      if (m === a || m === b) break
      const fm = val(m)
      if (Number.isNaN(fm)) {
        endPiece()
        if (!Number.isNaN(y1)) add(x1, y1)
        return
      }
      if (Math.abs(fm - fa) >= Math.abs(fb - fm)) {
        b = m
        fb = fm
      } else {
        a = m
        fa = fm
      }
      if (Math.abs(fb - fa) * pxY <= 1) {
        add(x1, y1)
        return
      }
    }
    // The change did not shrink with the step: the curve breaks between a and b.
    add(a, fa)
    endPiece()
    add(b, fb)
    add(x1, y1)
  }

  const off = (y: number) => (y > w.yMax ? 1 : y < w.yMin ? -1 : 0)

  function segment(x0: number, y0: number, x1: number, y1: number, depth: number) {
    const n0 = Number.isNaN(y0)
    const n1 = Number.isNaN(y1)
    if (n0 && n1) {
      // A short stretch where it exists, between two samples where it does not: look once in the middle.
      if (depth < 3) {
        const xm = x0 + (x1 - x0) / 2
        const ym = val(xm)
        if (!Number.isNaN(ym)) {
          segment(x0, y0, xm, ym, depth + 1)
          segment(xm, ym, x1, y1, depth + 1)
        }
      }
      return
    }
    if (n0 !== n1) {
      if (n0) {
        const [xe, ye] = findEdge(x1, y1, x0)
        endPiece()
        add(xe, ye)
        segment(xe, ye, x1, y1, depth)
      } else {
        const [xe, ye] = findEdge(x0, y0, x1)
        segment(x0, y0, xe, ye, depth)
        endPiece()
      }
      return
    }
    if (depth >= s.maxDepth || points > s.budget) {
      if (points > s.budget) add(x1, y1)
      else closeOrBreak(x0, y0, x1, y1)
      return
    }
    const xm = x0 + (x1 - x0) / 2
    const ym = val(xm)
    if (Number.isNaN(ym)) {
      segment(x0, y0, xm, ym, depth + 1)
      segment(xm, ym, x1, y1, depth + 1)
      return
    }
    const o = off(y0)
    if (depth >= 2 && o !== 0 && o === off(ym) && o === off(y1)) {
      add(x1, y1)
      return
    }
    const dev = Math.abs(ym - (y0 + y1) / 2) * pxY
    if (dev <= s.tolPx) {
      add(x1, y1)
      return
    }
    segment(x0, y0, xm, ym, depth + 1)
    segment(xm, ym, x1, y1, depth + 1)
  }

  function walk(lo: number, hi: number) {
    if (!(hi > lo)) return
    const n = Math.max(2, Math.ceil(((hi - lo) * pxX) / s.stepPx))
    let xp = lo
    let yp = val(lo)
    if (!Number.isNaN(yp)) add(xp, yp)
    for (let j = 1; j <= n; j++) {
      const x = j === n ? hi : lo + ((hi - lo) * j) / n
      const y = val(x)
      segment(xp, yp, x, y, 0)
      xp = x
      yp = y
    }
  }

  /** One side's limit at a cut: the value approached, or null where it runs away (an asymptote) or is undefined. */
  function limit(c: number, dir: -1 | 1, room: number): number | null {
    const d1 = Math.max(room * 1e-6, Math.abs(c) * 1e-13, 1e-300)
    const d2 = Math.max(room * 1e-8, Math.abs(c) * 4e-15, 1e-300)
    const a = raw(c + dir * d1)
    const b = raw(c + dir * d2)
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    return Math.abs(a - b) * pxY <= 0.5 ? b : null
  }

  const bounds = [req.x0, ...cuts, req.x1]
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]!
    const b = bounds[i + 1]!
    const room = b - a
    const lo = i > 0 ? a + Math.max(room * 1e-9, Math.abs(a) * 4e-16) : a
    const hi = i < bounds.length - 2 ? b - Math.max(room * 1e-9, Math.abs(b) * 4e-16) : b
    walk(lo, hi)
    if (i === bounds.length - 2) break

    // ---- the cut at b ----
    const c = b
    const next = bounds[i + 2]!
    const left = limit(c, -1, room)
    const right = limit(c, 1, next - c)
    const fc = raw(c)
    const close = (u: number, v: number) => Math.abs(u - v) * pxY <= 1
    if (cutKind.get(c) === 'allow') {
      const inLeft = !allow || allow(c - Math.max(room * 1e-9, Math.abs(c) * 4e-16))
      const inRight = !allow || allow(c + Math.max((next - c) * 1e-9, Math.abs(c) * 4e-16))
      const atC = !allow || allow(c)
      // The formula's own value at the end, restriction or not: an open dot sits exactly where the piece is heading.
      const own = req.f(c)
      const endY = (side: number) => (Number.isFinite(own) && close(own, side) ? own : side)
      if (inLeft !== inRight || (!inLeft && !inRight)) {
        if (inLeft && left !== null) {
          const closed = atC && Number.isFinite(fc) && close(fc, left)
          const y = endY(left)
          add(c, clamp(y))
          out.ends.push({ x: c, y, closed })
        }
        endPiece()
        if (inRight && right !== null) {
          const closed = atC && Number.isFinite(fc) && close(fc, right)
          const y = endY(right)
          out.ends.push({ x: c, y, closed })
          add(c, clamp(y))
        }
        if (!inLeft && !inRight && atC && Number.isFinite(fc)) out.ends.push({ x: c, y: fc, closed: true })
        continue
      }
    }
    if (left !== null && right !== null && close(left, right)) {
      if (Number.isFinite(fc) && close(fc, left)) {
        // Continuous through the cut (a radicand that only touches 0, a denominator that is never 0 after all).
        add(c, clamp(fc))
        continue
      }
      if (Number.isNaN(fc)) {
        out.holes.push({ x: c, y: (left + right) / 2 })
        endPiece()
        continue
      }
    }
    // A jump, an asymptote or a domain edge: the piece ends; a defined point at the cut joins the side it belongs to.
    if (Number.isFinite(fc) && left !== null && close(fc, left) && lastPoint() !== null) add(c, clamp(fc))
    endPiece()
    if (Number.isFinite(fc) && right !== null && close(fc, right) && (left === null || !close(fc, left))) add(c, clamp(fc))
  }
  endPiece()
  return out
}

/** The y values of the samples as pixels, for the tests and the hit test: [x, y] pairs. */
export function piecePoints(piece: readonly number[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < piece.length; i += 2) out.push([piece[i]!, piece[i + 1]!])
  return out
}
