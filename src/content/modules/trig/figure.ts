/**
 * Figure specs for the trig problems (drawn by components/TrigFigure). The words describe the picture and never an
 * answer: no quadrant, no coordinates of the point on the unit circle, no length.
 */
import type { TrigFigureSpec } from '@/content/types'

function turning(deg: number): string {
  const dir = deg < 0 ? 'clockwise' : 'counterclockwise'
  return Math.abs(deg) > 360 ? `${dir}, more than one full turn` : dir
}

/** The unit circle with the angle in standard position (and, for the flow to show later, its reference angle). */
export function circleFigure(deg: number, label: string, reference?: { deg: number; label: string }): TrigFigureSpec {
  return {
    kind: 'circle',
    deg,
    label,
    ...(reference ? { reference } : {}),
    ariaLabel:
      deg === 0
        ? `The unit circle with an angle of ${label} in standard position.`
        : `The unit circle with an angle of ${label} in standard position: it starts on the positive x-axis and turns ${turning(deg)}.`,
  }
}

/** Axes with a point (x, y) and the terminal side of θ through it (0° ≤ θ < 360°). */
export function pointFigure(x: number, y: number, label: string): TrigFigureSpec {
  const deg = (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360
  return {
    kind: 'point',
    deg,
    label: 'θ',
    point: { x, y, label },
    ariaLabel: `Axes with the point ${label} and the terminal side of the angle θ, drawn from the origin through the point.`,
  }
}

/** A circle with a central angle: the arc in bold, or the sector shaded. */
export function sectorFigure(deg: number, label: string, radiusLabel: string, shade: 'arc' | 'area'): TrigFigureSpec {
  return {
    kind: 'sector',
    deg,
    label,
    sector: { radiusLabel, shade },
    ariaLabel: `A circle of radius ${radiusLabel} with a central angle of ${label}; ${shade === 'arc' ? 'the arc it cuts off is drawn in bold' : 'the sector it cuts off is shaded'}.`,
  }
}
