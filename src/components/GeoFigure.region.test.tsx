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
