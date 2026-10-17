// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GeoFigureSpec } from '@/shared/types'
import { GeoFigure } from './GeoFigure'

const spec: GeoFigureSpec = {
  ariaLabel: 'Segment AB labeled 2x + 3 with one tick, a line through A and B, a ray, angle marks, a right angle, and a grid.',
  grid: { xMin: -2, xMax: 4, yMin: -1, yMax: 3 },
  points: [
    { id: 'A', x: 0, y: 0, label: 'A', labelSide: 'below' },
    { id: 'B', x: 3, y: 0, label: 'B', labelSide: 'below' },
    { id: 'C', x: 3, y: 2, label: 'C', labelSide: 'above' },
    { id: 'D', x: 0, y: 2, label: 'D', labelSide: 'above' },
    { id: 'E', x: -1, y: 1 },
  ],
  segments: [{ from: 'A', to: 'B', label: '2x + 3', ticks: 2, labelSide: 'above' }],
  lines: [{ through: ['A', 'B'] }],
  rays: [{ from: 'B', through: 'C' }],
  angles: [
    { vertex: 'B', from: 'A', to: 'C', label: '(3x + 5)°', marks: 2, radius: 28 },
    { vertex: 'A', from: 'B', to: 'D', label: '1' },
    { vertex: 'C', from: 'B', to: 'D', right: true },
  ],
}

describe('GeoFigure', () => {
  it('draws each element kind, describes itself, and stays inside the container', () => {
    const { container } = render(<GeoFigure spec={spec} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('role')).toBe('img')
    expect(svg?.getAttribute('aria-label')).toBe(spec.ariaLabel)
    expect(svg?.getAttribute('width')).toBe('100%')
    expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 360 /)
    const wrap = svg?.parentElement
    expect(wrap?.className).toContain('w-full')
    expect(wrap?.className).toContain('max-w-full')
    expect(wrap?.className ?? '').not.toMatch(/min-w/)
    expect(container.querySelectorAll('[data-geo="point"]')).toHaveLength(4)
    expect(container.querySelector('[data-geo="segment"]')).toBeTruthy()
    expect(container.querySelector('[data-geo="seg-label"]')?.textContent).toBe('2x + 3')
    expect(container.querySelector('[data-geo="ticks"]')?.getAttribute('data-count')).toBe('2')
    expect(container.querySelector('[data-geo="line"]')).toBeTruthy()
    expect(container.querySelector('[data-geo="ray"]')).toBeTruthy()
    expect(container.querySelector('[data-geo="grid"]')).toBeTruthy()
    expect(container.querySelector('[data-geo="right"]')).toBeTruthy()
    const angles = [...container.querySelectorAll('[data-geo="angle"]')]
    expect(angles).toHaveLength(2)
    const marked = angles.find((el) => el.getAttribute('data-marks') === '2')
    const plain = angles.find((el) => el.getAttribute('data-marks') === null)
    expect(marked).toBeTruthy()
    expect(plain).toBeTruthy()
    expect(container.textContent).toContain('(3x + 5)°')
    expect(container.textContent).toContain('1')
    expect(container.innerHTML).not.toMatch(/#[0-9A-Fa-f]{3,8}/)
    const marker = container.querySelector('marker')
    expect(marker?.id ?? '').not.toContain(':')
    expect(marker?.id ?? '').toMatch(/^geo-arrow-/)
    const line = container.querySelector('[data-geo="line"]')
    expect(line?.getAttribute('marker-start')).toContain(marker?.id)
    expect(line?.getAttribute('marker-end')).toContain(marker?.id)
    const ray = container.querySelector('[data-geo="ray"]')
    expect(ray?.hasAttribute('marker-start')).toBe(false)
    expect(ray?.getAttribute('marker-end')).toContain(marker?.id)
  })

  it('draws matching arrow marks on a pair of lines, separate from the endpoint arrowheads', () => {
    const marked: GeoFigureSpec = {
      ariaLabel: 'Two parallel lines with one arrow mark each.',
      points: [
        { id: 'A', x: 0, y: 0 },
        { id: 'B', x: 4, y: 0 },
        { id: 'C', x: 0, y: 2 },
        { id: 'D', x: 4, y: 2 },
      ],
      lines: [
        { through: ['A', 'B'], arrows: 1 },
        { through: ['C', 'D'], arrows: 1 },
      ],
    }
    const { container } = render(<GeoFigure spec={marked} />)
    const marks = [...container.querySelectorAll('[data-geo="parallel"]')]
    expect(marks).toHaveLength(2)
    expect(marks[0]?.getAttribute('data-count')).toBe('1')
    expect(container.querySelectorAll('[data-geo="line"]')).toHaveLength(2)
  })
})
