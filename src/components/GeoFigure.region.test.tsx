// @vitest-environment jsdom
/** Unit 9's shaded sector and segment: the path, its place under the circle, and no change to a figure without one. */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GeoFigureSpec } from '@/shared/types'
import { GeoFigure, regionPath } from './GeoFigure'

const circle: GeoFigureSpec = {
  ariaLabel: 'A circle with center O and radii OA and OB. The sector between them is shaded.',
  points: [
    { id: 'O', x: 0, y: 0, label: 'O' },
    { id: 'A', x: 5, y: 0, label: 'A' },
    { id: 'B', x: 0, y: 5, label: 'B' },
  ],
  circles: [{ center: 'O', r: 5 }],
  segments: [
    { from: 'O', to: 'A' },
    { from: 'O', to: 'B' },
  ],
  regions: [{ kind: 'sector', center: 'O', from: 'A', to: 'B' }],
}

/** A screen: x to the right, y down, ten pixels to a unit. */
const at = (id: string) => {
  const p = circle.points.find((pt) => pt.id === id)!
  return { x: 100 + p.x * 10, y: 100 - p.y * 10 }
}

describe('GeoFigure shaded regions', () => {
  it('a sector runs from the center out, along the arc counterclockwise, and back', () => {
    expect(regionPath(circle, { kind: 'sector', center: 'O', from: 'A', to: 'B' }, at)).toBe('M 100 100 L 150 100 A 50 50 0 0 0 100 50 Z')
    // From B round to A the same way is the other three quarters: the large arc.
    expect(regionPath(circle, { kind: 'sector', center: 'O', from: 'B', to: 'A' }, at)).toBe('M 100 100 L 100 50 A 50 50 0 1 0 150 100 Z')
  })

  it('a segment is the arc closed by its chord, and a missing point draws nothing', () => {
    expect(regionPath(circle, { kind: 'segment', center: 'O', from: 'A', to: 'B' }, at)).toBe('M 150 100 A 50 50 0 0 0 100 50 Z')
    expect(regionPath(circle, { kind: 'segment', center: 'O', from: 'A', to: 'Z' }, at)).toBeNull()
    expect(regionPath(circle, { kind: 'segment', center: 'O', from: 'A', to: 'A' }, at)).toBeNull()
  })

  it('is drawn under the circle, and a figure with no region draws none', () => {
    const { container } = render(<GeoFigure spec={circle} />)
    const region = container.querySelector('[data-geo="region"]')
    expect(region?.getAttribute('data-kind')).toBe('sector')
    expect(region?.getAttribute('d')).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ A [\d.]+ [\d.]+ 0 0 0 [\d.]+ [\d.]+ Z$/)
    const drawn = [...container.querySelectorAll('[data-geo]')].map((el) => el.getAttribute('data-geo'))
    expect(drawn.indexOf('region')).toBeLessThan(drawn.indexOf('circle'))
    const plain = render(<GeoFigure spec={{ ...circle, regions: undefined }} />)
    expect(plain.container.querySelector('[data-geo="region"]')).toBeNull()
  })
})

describe('GeoFigure compound regions', () => {
  // A square of side 10 around a circle of radius 5: the circle touches every side.
  const boxed: GeoFigureSpec = {
    ariaLabel: 'A square with a circle inside it that touches all four sides. The part of the square outside the circle is shaded.',
    points: [
      { id: 'O', x: 0, y: 0, label: 'O' },
      { id: 'P', x: -5, y: -5, label: 'P' },
      { id: 'Q', x: 5, y: -5, label: 'Q' },
      { id: 'R', x: 5, y: 5, label: 'R' },
      { id: 'S', x: -5, y: 5, label: 'S' },
    ],
    circles: [{ center: 'O', r: 5 }],
    segments: [
      { from: 'P', to: 'Q' },
      { from: 'Q', to: 'R' },
      { from: 'R', to: 'S' },
      { from: 'S', to: 'P' },
    ],
    regions: [
      {
        kind: 'compound',
        loops: [
          { shape: 'polygon', points: ['P', 'Q', 'R', 'S'] },
          { shape: 'circle', center: 'O', r: 5 },
        ],
      },
    ],
  }
  const where = (id: string) => {
    const p = boxed.points.find((pt) => pt.id === id)!
    return { x: 100 + p.x * 10, y: 100 - p.y * 10 }
  }

  it('a polygon and a circle are two closed loops in one path, the circle as two half turns', () => {
    const d = regionPath(boxed, boxed.regions![0]!, where, 10)
    expect(d).toBe('M 50 150 L 150 150 L 150 50 L 50 50 Z M 50 100 A 50 50 0 1 0 150 100 A 50 50 0 1 0 50 100 Z')
  })

  it('a ring is two circles, and a sector or a segment can be a loop', () => {
    const ring = regionPath(boxed, { kind: 'compound', loops: [{ shape: 'circle', center: 'O', r: 5 }, { shape: 'circle', center: 'O', r: 2 }] }, where, 10)
    expect(ring).toBe('M 50 100 A 50 50 0 1 0 150 100 A 50 50 0 1 0 50 100 Z M 80 100 A 20 20 0 1 0 120 100 A 20 20 0 1 0 80 100 Z')
    // Q to S is half the turn about O, counterclockwise through R.
    const quarter = regionPath(boxed, { kind: 'compound', loops: [{ shape: 'segment', center: 'O', from: 'Q', to: 'S' }] }, where, 10)
    expect(quarter).toMatch(/^M 150 150 A [\d.]+ [\d.]+ 0 0 0 50 50 Z$/)
  })

  it('draws nothing for a loop that is not a closed outline', () => {
    expect(regionPath(boxed, { kind: 'compound', loops: [] }, where, 10)).toBeNull()
    expect(regionPath(boxed, { kind: 'compound', loops: [{ shape: 'polygon', points: ['P', 'Q'] }] }, where, 10)).toBeNull()
    expect(regionPath(boxed, { kind: 'compound', loops: [{ shape: 'polygon', points: ['P', 'Q', 'Z'] }] }, where, 10)).toBeNull()
    expect(regionPath(boxed, { kind: 'compound', loops: [{ shape: 'circle', center: 'O', r: 0 }] }, where, 10)).toBeNull()
    expect(regionPath(boxed, { kind: 'compound', loops: [{ shape: 'polygon', points: ['P', 'Q', 'R', 'S'] }, { shape: 'circle', center: 'Z', r: 5 }] }, where, 10)).toBeNull()
  })

  it('is filled even-odd, so the circle is a hole in the square, and its radius matches the drawn circle', () => {
    const { container } = render(<GeoFigure spec={boxed} />)
    const region = container.querySelector('[data-geo="region"]')!
    expect(region.getAttribute('data-kind')).toBe('compound')
    expect(region.getAttribute('fill-rule')).toBe('evenodd')
    const drawn = Number(container.querySelector('[data-geo="circle"]')!.getAttribute('r'))
    const hole = / A ([\d.]+) [\d.]+ 0 1 0 /.exec(region.getAttribute('d')!)
    expect(Number(hole![1])).toBeCloseTo(drawn, 1)
  })
})
