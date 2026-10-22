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

/**
 * One value and the quadrant (uc.given): axes with the point on the terminal side, the drop and r, drawn only once the
 * part `waitFor` is answered. Until then the axes with the quadrants numbered, since the point would show the quadrant
 * that part asks her to work out; the words describe that first picture.
 */
export function givenFigure(x: number, y: number, label: string, waitFor: string, waitWords: string): TrigFigureSpec {
  const deg = (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360
  return {
    kind: 'point',
    deg,
    label: 'θ',
    point: { x, y, label },
    waitFor,
    ariaLabel: `Axes with the four quadrants numbered I to IV. The point on the terminal side of θ is drawn once you have found ${waitWords}.`,
  }
}

/** Every angle in one turn (uc.solve): the unit circle and its axes; the answer angles are drawn once she is done. */
export function solveFigure(degs: number[], labels: string[]): TrigFigureSpec {
  return {
    kind: 'solve',
    deg: 0,
    label: '',
    solve: { degs, labels },
    ariaLabel: 'The unit circle and its axes. The angles are drawn once you have found them.',
  }
}
