/**
 * Figure pieces shared by the Unit 5 templates: the sides of a quadrilateral as segments, side names, and
 * the placement of segment labels. GeoFigure puts an "above" label 14 px off its segment and a "below" label
 * on a dimension line 34 px off, so a label on a slanted side can touch its own side. A label is kept only
 * where it is clear of every line and label (checked with the same arithmetic GeoFigure uses), and a
 * dimension line only outside the outline. A figure whose labels cannot all be placed is refused.
 */
import type { GeoFigureSpec, GeoSegment } from '@/shared/types'
import { figureIssues, layoutOf, segLabelShape } from './unit5Layout'

export type Ids = [string, string, string, string]

/** Side i of a quadrilateral named in order: PQ, QR, RS, SP. */
export function sideOf(ids: readonly string[], i: number): [string, string] {
  const n = ids.length
  return [ids[((i % n) + n) % n]!, ids[(((i + 1) % n) + n) % n]!]
}

export function sideName(ids: readonly string[], i: number): string {
  const [a, b] = sideOf(ids, i)
  return `${a}${b}`
}

/** Vertex i, wrapping. */
export function vtx(ids: readonly string[], i: number): string {
  const n = ids.length
  return ids[((i % n) + n) % n]!
}

export function seg(from: string, to: string, extra: Partial<GeoSegment> = {}): GeoSegment {
  return { from, to, ...extra }
}

function insidePolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/**
 * Give every labeled segment a side ("above" first, then "below") so the whole figure is clear. A "below"
 * label is a dimension line, kept only when it lies outside the outline. Null when no choice is clear.
 */
export function placeSegLabels(spec: GeoFigureSpec, outline: readonly string[]): GeoFigureSpec | null {
  const segs = spec.segments ?? []
  const labeled = segs.map((s, i) => (s.label ? i : -1)).filter((i) => i >= 0)
  if (labeled.length === 0) return figureIssues(spec).length === 0 ? spec : null
  const { sx, sy } = layoutOf(spec)
  const poly = outline.map((id) => {
    const p = spec.points.find((q) => q.id === id)!
    return { x: sx(p.x), y: sy(p.y) }
  })
  const at = (id: string) => {
    const p = spec.points.find((q) => q.id === id)!
    return { x: sx(p.x), y: sy(p.y) }
  }
  for (let mask = 0; mask < 1 << labeled.length; mask++) {
    const next = segs.map((s) => ({ ...s }))
    let ok = true
    labeled.forEach((index, bit) => {
      const side = mask & (1 << bit) ? 'below' : 'above'
      next[index]!.labelSide = side
      if (side === 'below') {
        const shape = segLabelShape(next[index]!, at(next[index]!.from), at(next[index]!.to))
        if (!shape) return
        const c = { x: (shape.box.l + shape.box.r) / 2, y: (shape.box.t + shape.box.b) / 2 }
        if (insidePolygon(c, poly)) ok = false
      }
    })
    if (!ok) continue
    const candidate: GeoFigureSpec = { ...spec, segments: next }
    if (figureIssues(candidate).length === 0) return candidate
  }
  return null
}
