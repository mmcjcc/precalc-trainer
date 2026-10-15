/**
 * Figure specs for Unit 1. Drawn to the problem's true sizes. Labels are the given
 * expressions, never the solved answer. Later units can add their own specs the same way.
 */
import type { GeoFigureSpec, GeoPoint } from '@/shared/types'
import { angleLabel, formatLin, showPt, type Lin } from './expr'

function pt(id: string, x: number, y: number, label?: string, labelSide?: GeoPoint['labelSide']): GeoPoint {
  return { id, x, y, ...(label ? { label } : {}), ...(labelSide ? { labelSide } : {}) }
}

/** A, B, C collinear, B between A and C. Lengths are the true sizes. */
export function segmentFigure(opts: {
  ab: number
  ac: number
  abLabel?: string
  bcLabel?: string
  acLabel?: string
  ticks?: boolean
  aria: string
}): GeoFigureSpec {
  const { ab, ac } = opts
  return {
    ariaLabel: opts.aria,
    points: [
      pt('A', 0, 0, 'A', 'below'),
      pt('B', ab, 0, 'B', 'below'),
      pt('C', ac, 0, 'C', 'below'),
    ],
    segments: [
      { from: 'A', to: 'B', ...(opts.abLabel ? { label: opts.abLabel } : {}), ...(opts.ticks ? { ticks: 1 as const } : {}), labelSide: 'above' },
      { from: 'B', to: 'C', ...(opts.bcLabel ? { label: opts.bcLabel } : {}), ...(opts.ticks ? { ticks: 1 as const } : {}), labelSide: 'above' },
      ...(opts.acLabel ? [{ from: 'A', to: 'C', label: opts.acLabel, labelSide: 'below' as const }] : []),
    ],
  }
}

/**
 * Angle ABC with D in the interior. `toD` and `toC` are degrees from ray BA.
 * The picture uses those true measures. Labels are the given expressions.
 */
export function angleFan(opts: {
  toD: number
  toC: number
  abd?: string
  dbc?: string
  abc?: string
  /** Matching arcs on the two halves (a bisector). */
  congruent?: boolean
  aria: string
}): GeoFigureSpec {
  const a = polar(0)
  const d = polar(opts.toD)
  const c = polar(opts.toC)
  const mark = opts.congruent ? (1 as const) : undefined
  return {
    ariaLabel: opts.aria,
    points: [
      pt('B', 0, 0, 'B', 'below'),
      pt('A', a.x, a.y, 'A', 'right'),
      pt('D', d.x, d.y, 'D', 'above'),
      pt('C', c.x, c.y, 'C', 'above-left'),
    ],
    rays: [
      { from: 'B', through: 'A' },
      { from: 'B', through: 'D' },
      { from: 'B', through: 'C' },
    ],
    angles: [
      { vertex: 'B', from: 'A', to: 'D', ...(opts.abd ? { label: opts.abd } : {}), ...(mark ? { marks: mark } : {}), radius: 22 },
      { vertex: 'B', from: 'D', to: 'C', ...(opts.dbc ? { label: opts.dbc } : {}), ...(mark ? { marks: mark } : {}), radius: 22 },
      { vertex: 'B', from: 'A', to: 'C', ...(opts.abc ? { label: opts.abc } : {}), radius: 40 },
    ],
  }
}

function polar(deg: number, r = 5): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180
  return { x: round1(r * Math.cos(rad)), y: round1(r * Math.sin(rad)) }
}

function round1(n: number): number {
  return Math.round(n * 1000) / 1000
}

/** Two given points on a grid. The answer point is not drawn. */
export function gridFigure(opts: {
  points: { id: string; x: number; y: number }[]
  segments?: { from: string; to: string }[]
  aria: string
}): GeoFigureSpec {
  const xs = opts.points.map((p) => p.x)
  const ys = opts.points.map((p) => p.y)
  const xMin = Math.min(...xs) - 1
  const xMax = Math.max(...xs) + 1
  const yMin = Math.min(...ys) - 1
  const yMax = Math.max(...ys) + 1
  return {
    ariaLabel: opts.aria,
    grid: { xMin, xMax, yMin, yMax },
    points: opts.points.map((p) => pt(p.id, p.x, p.y, `${p.id} ${showPt(p.x, p.y)}`, p.y >= 0 ? 'above' : 'below')),
    segments: opts.segments ?? [],
  }
}

/** Vertical angles: two lines through the origin. `deg` is the true measure of ∠1. */
export function verticalFigure(deg: number, label1: string, label2: string): GeoFigureSpec {
  const tip = polar(deg, 4)
  return {
    ariaLabel: `Two lines intersect at O. The vertical angles are marked 1 and 2: angle 1 measures ${label1} and angle 2 measures ${label2}.`,
    points: [
      pt('O', 0, 0, 'O', 'below-right'),
      pt('E', 4, 0),
      pt('W', -4, 0),
      pt('P', tip.x, tip.y),
      pt('Q', -tip.x, -tip.y),
    ],
    lines: [
      { through: ['W', 'E'] },
      { through: ['Q', 'P'] },
    ],
    angles: [
      { vertex: 'O', from: 'E', to: 'P', label: '1', marks: 1, radius: 26 },
      { vertex: 'O', from: 'W', to: 'Q', label: '2', marks: 1, radius: 26 },
    ],
  }
}

/** A linear pair on a straight line. `deg` is the true measure of ∠1, from the positive side. */
export function linearFigure(deg: number, label1: string, label2: string): GeoFigureSpec {
  const tip = polar(deg, 4)
  return {
    ariaLabel: `Angles 1 and 2 form a linear pair on a straight line. Angle 1 measures ${label1} and angle 2 measures ${label2}.`,
    points: [
      pt('B', 0, 0, 'B', 'below'),
      pt('C', 4, 0, 'C', 'right'),
      pt('A', -4, 0, 'A', 'left'),
      pt('D', tip.x, tip.y, 'D', 'above'),
    ],
    lines: [{ through: ['A', 'C'] }],
    rays: [{ from: 'B', through: 'D' }],
    angles: [
      { vertex: 'B', from: 'C', to: 'D', label: '1', radius: 26 },
      { vertex: 'B', from: 'D', to: 'A', label: '2', radius: 26 },
    ],
  }
}

/** Complementary: two angles that together make a right angle. The square marks the 90°. */
export function complementaryFigure(deg: number, label1: string, label2: string): GeoFigureSpec {
  const mid = polar(deg, 4)
  const top = polar(90, 4)
  return {
    ariaLabel: `Angles 1 and 2 are adjacent and together form a right angle, marked with a square. Angle 1 measures ${label1} and angle 2 measures ${label2}.`,
    points: [
      pt('B', 0, 0, 'B', 'below-left'),
      pt('A', 4, 0, 'A', 'right'),
      pt('D', mid.x, mid.y, 'D', 'above'),
      pt('C', top.x, top.y, 'C', 'above'),
    ],
    rays: [
      { from: 'B', through: 'A' },
      { from: 'B', through: 'D' },
      { from: 'B', through: 'C' },
    ],
    angles: [
      { vertex: 'B', from: 'A', to: 'C', right: true },
      { vertex: 'B', from: 'A', to: 'D', label: '1', radius: 28 },
      { vertex: 'B', from: 'D', to: 'C', label: '2', radius: 28 },
    ],
  }
}

/** Supplementary, stated in words: two separate angles, not drawn as a straight line. */
export function separateAngles(label1: string, label2: string, deg1: number, deg2: number): GeoFigureSpec {
  const a1 = polar(deg1, 3)
  const a2 = polar(deg2, 3)
  return {
    ariaLabel: `Two separate angles, marked 1 and 2. Angle 1 measures ${label1} and angle 2 measures ${label2}.`,
    points: [
      pt('B', 0, 0, 'B', 'below'),
      pt('A', 3, 0, 'A', 'right'),
      pt('C', a1.x, a1.y, 'C', 'above'),
      pt('E', 8, 0, 'E', 'below'),
      pt('D', 11, 0, 'D', 'right'),
      pt('F', 8 + a2.x, a2.y, 'F', 'above'),
    ],
    rays: [
      { from: 'B', through: 'A' },
      { from: 'B', through: 'C' },
      { from: 'E', through: 'D' },
      { from: 'E', through: 'F' },
    ],
    angles: [
      { vertex: 'B', from: 'A', to: 'C', label: '1', radius: 22 },
      { vertex: 'E', from: 'D', to: 'F', label: '2', radius: 22 },
    ],
  }
}

/** A word-problem angle with no measure marked. The drawn size is not the answer. */
export function plainAngle(): GeoFigureSpec {
  const c = polar(38, 4)
  return {
    ariaLabel: 'An angle with no measure marked.',
    points: [
      pt('B', 0, 0, 'B', 'below'),
      pt('A', 4, 0, 'A', 'right'),
      pt('C', c.x, c.y, 'C', 'above'),
    ],
    rays: [
      { from: 'B', through: 'A' },
      { from: 'B', through: 'C' },
    ],
    angles: [{ vertex: 'B', from: 'A', to: 'C', radius: 22 }],
  }
}

export function linLabel(e: Lin): string {
  return formatLin(e)
}

export function measureLabel(e: Lin): string {
  return angleLabel(e)
}
