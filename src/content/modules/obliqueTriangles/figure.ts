/**
 * The figures, as GeoFigure specs: a triangle drawn to its true shape, the longest side along the bottom (so the top
 * corner sits over it and every side's label falls outside), the given sides and angles labelled, the side she is
 * asked for labelled by its letter alone, an angle she is asked for marked with an arc and no number. The ambiguous
 * case draws only what is given (angle A, side b, the ray side c lies on) until she has said how many triangles fit.
 */
import type { GeoAngleMark, GeoFigureSpec, GeoPoint, GeoSegment } from '@/shared/types'
import { cosD, sinD } from './solve'

export type V = 'A' | 'B' | 'C'
export const VERTICES: readonly V[] = ['A', 'B', 'C']

/** A triangle: its angles in degrees and its sides, each keyed by the vertex across from it (side a across from A). */
export interface Tri {
  angles: Record<V, number>
  sides: Record<V, number>
}

export const lower = (v: V): 'a' | 'b' | 'c' => v.toLowerCase() as 'a' | 'b' | 'c'

/** The two vertices other than `v`, in letter order. */
export function others(v: V): [V, V] {
  const o = VERTICES.filter((x) => x !== v)
  return [o[0]!, o[1]!]
}

export interface TriangleLabels {
  /** Per side (by the vertex across from it): its label, "a = 10" for a given side, "b" for the side asked. */
  sides: Partial<Record<V, string>>
  /** Per angle: its label ("40°"), or null for an arc with no number (the angle asked). */
  angles: Partial<Record<V, string | null>>
  /** A right angle drawn with its square (the "neither law" problems). */
  right?: V
  /** Drawn mirror-image (the shape is the same). */
  mirror: boolean
  ariaLabel: string
}

/** The corners in drawing units, the longest side on the bottom. */
export function cornersOf(t: Tri, mirror: boolean): Record<V, { x: number; y: number }> {
  const top = VERTICES.reduce((best, v) => (t.sides[v] > t.sides[best] ? v : best), 'A' as V)
  const [p, q] = others(top)
  const len = t.sides[top]
  const tx = t.sides[q] * cosD(t.angles[p])
  const ty = t.sides[q] * sinD(t.angles[p])
  const fx = (x: number) => (mirror ? len - x : x)
  return { [p]: { x: fx(0), y: 0 }, [q]: { x: fx(len), y: 0 }, [top]: { x: fx(tx), y: ty } } as Record<V, { x: number; y: number }>
}

/** The triangle as GeoFigure draws it. */
export function triangleFigure(t: Tri, o: TriangleLabels): GeoFigureSpec {
  const at = cornersOf(t, o.mirror)
  const top = VERTICES.reduce((best, v) => (t.sides[v] > t.sides[best] ? v : best), 'A' as V)
  const points: GeoPoint[] = VERTICES.map((v) => ({ id: v, x: at[v].x, y: at[v].y, label: v, labelSide: v === top ? 'above' : at[v].x < at[top].x ? 'below-left' : 'below-right' }))
  const segments: GeoSegment[] = VERTICES.map((v) => {
    const [p, q] = others(v)
    const label = o.sides[v]
    return { from: p, to: q, ...(label ? { label, labelSide: v === top ? ('below' as const) : ('above' as const) } : {}) }
  })
  const angles: GeoAngleMark[] = []
  for (const v of VERTICES) {
    const [p, q] = others(v)
    if (o.right === v) {
      angles.push({ vertex: v, from: p, to: q, right: true })
      continue
    }
    if (!(v in o.angles)) continue
    const label = o.angles[v]
    angles.push({ vertex: v, from: p, to: q, ...(label ? { label } : {}) })
  }
  return { points, segments, angles, ariaLabel: o.ariaLabel }
}

export interface SsaDrawing {
  A: number
  a: number
  b: number
  aLabel: string
  bLabel: string
  angleLabel: string
}

/** The ambiguous case before she answers: angle A, side b from A to C, and the ray from A that side c lies on. */
export function ssaGivenFigure(s: SsaDrawing, ariaLabel: string): GeoFigureSpec {
  const cx = s.b * cosD(s.A)
  const cy = s.b * sinD(s.A)
  const reach = Math.max(cx + s.a * 1.15, s.b * 1.1, cx + cy * 0.6)
  return {
    points: [
      { id: 'A', x: 0, y: 0, label: 'A', labelSide: 'below-left' },
      { id: 'C', x: cx, y: cy, label: 'C', labelSide: 'above' },
      { id: 'R', x: reach, y: 0, label: '' },
    ],
    segments: [{ from: 'A', to: 'C', label: s.bLabel, labelSide: 'above' }],
    rays: [{ from: 'A', through: 'R' }],
    angles: [{ vertex: 'A', from: 'R', to: 'C', label: s.angleLabel }],
    ariaLabel,
  }
}

/** The ambiguous case once she has answered how many: side a in each place it reaches the ray, or the height it misses. */
export function ssaAnsweredFigure(s: SsaDrawing, ariaLabel: string): GeoFigureSpec {
  const cx = s.b * cosD(s.A)
  const cy = s.b * sinD(s.A)
  const h = cy
  const reach = Math.max(cx + s.a * 1.15, s.b * 1.1, cx + cy * 0.6)
  const base: GeoFigureSpec = ssaGivenFigure(s, ariaLabel)
  const points = [...base.points]
  const segments = [...(base.segments ?? [])]
  const angles = [...(base.angles ?? [])]
  if (s.a < h) {
    points.push({ id: 'F', x: cx, y: 0, label: '' })
    segments.push({ from: 'C', to: 'F', label: 'h', labelSide: 'above', dashed: true })
    angles.push({ vertex: 'F', from: 'R', to: 'C', right: true })
    return { ...base, points, segments, angles }
  }
  const d = Math.sqrt(s.a * s.a - h * h)
  const far = cx + d
  points.push({ id: 'B', x: far, y: 0, label: 'B', labelSide: 'below-right' })
  segments.push({ from: 'C', to: 'B', label: s.aLabel, labelSide: 'above' })
  if (s.a < s.b) {
    points.push({ id: 'B2', x: cx - d, y: 0, label: 'B′', labelSide: 'below' })
    // The second position of the same side, dashed and unlabelled so the two labels never sit on each other.
    segments.push({ from: 'C', to: 'B2', dashed: true })
  }
  return { ...base, points: points.map((p) => (p.id === 'R' ? { ...p, x: Math.max(reach, far * 1.1) } : p)), segments, angles }
}
