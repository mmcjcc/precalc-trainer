// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { circleFigure, pointFigure, sectorFigure } from '@/content/modules/trig/figure'
import { anglePath, polar, TrigFigure } from './TrigFigure'

const el = (container: HTMLElement, name: string) => container.querySelector(`[data-trig="${name}"]`)
const num = (e: Element | null, attr: string) => Number(e?.getAttribute(attr))

describe('the unit circle with an angle in standard position', () => {
  it('draws the terminal side to the point at the angle, and says what it shows in words', () => {
    const { container } = render(<TrigFigure spec={circleFigure(150, '150°')} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toMatch(/angle of 150° in standard position/)
    const end = polar(150, 104)
    const side = el(container, 'terminal')!
    expect(num(side, 'x2')).toBeCloseTo(end.x, 1)
    expect(num(side, 'y2')).toBeCloseTo(end.y, 1)
    // 150° is up and to the left of the centre (SVG y points down).
    expect(num(side, 'x2')).toBeLessThan(160)
    expect(num(side, 'y2')).toBeLessThan(160)
    expect(el(container, 'angle-label')?.textContent).toBe('150°')
    expect(el(container, 'angle-arc')?.getAttribute('data-direction')).toBe('counterclockwise')
    expect(container.innerHTML).not.toMatch(/NaN/)
  })

  it('a negative angle turns clockwise, and an angle past a turn is a spiral', () => {
    const neg = render(<TrigFigure spec={circleFigure(-120, '−120°')} />)
    expect(el(neg.container, 'angle-arc')?.getAttribute('data-direction')).toBe('clockwise')
    expect(num(el(neg.container, 'terminal'), 'y2')).toBeGreaterThan(160)
    neg.unmount()
    const big = render(<TrigFigure spec={circleFigure(-510, '−510°')} />)
    expect(el(big.container, 'spiral')).not.toBeNull()
    expect(el(big.container, 'spiral')?.getAttribute('data-direction')).toBe('clockwise')
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/more than one full turn/)
  })

  it('the spiral widens with each turn and ends at the angle', () => {
    const p = anglePath(750, 22, 9)
    expect(p.spiral).toBe(true)
    const end = polar(750, 22 + (9 * 750) / 360)
    expect(p.end.x).toBeCloseTo(end.x, 6)
    expect(p.end.y).toBeCloseTo(end.y, 6)
    expect(anglePath(300, 22, 9).spiral).toBe(false)
  })

  it('the reference angle is not drawn until the flow allows it', () => {
    const spec = circleFigure(210, '7π/6', { deg: 30, label: 'π/6' })
    const before = render(<TrigFigure spec={spec} />)
    expect(el(before.container, 'reference')).toBeNull()
    expect([...before.container.querySelectorAll('text')].map((t) => t.textContent)).not.toContain('π/6')
    before.unmount()
    const after = render(<TrigFigure spec={spec} showReference />)
    expect(el(after.container, 'reference')).not.toBeNull()
    expect(el(after.container, 'reference-label')?.textContent).toBe('π/6')
  })
})

describe('a point on the terminal side', () => {
  it('plots the point with its label, the terminal side through it, r as a letter, and no length', () => {
    const { container } = render(<TrigFigure spec={pointFigure(-3, 4, '(−3, 4)')} />)
    expect(el(container, 'point-label')?.textContent).toBe('(−3, 4)')
    expect(el(container, 'r-label')?.textContent).toBe('r')
    const dot = el(container, 'point')!
    expect(num(dot, 'cx')).toBeLessThan(160)
    expect(num(dot, 'cy')).toBeLessThan(160)
    expect(el(container, 'drop')).not.toBeNull()
    expect(container.textContent).not.toMatch(/\b5\b/)
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/point \(−3, 4\)/)
  })
})

describe('a circle with a central angle', () => {
  it('marks the arc in bold, or shades the sector, and labels the radius and the angle', () => {
    const arc = render(<TrigFigure spec={sectorFigure(40, '40°', '24 in', 'arc')} />)
    expect(el(arc.container, 'sector-fill')).toBeNull()
    expect(el(arc.container, 'radius-label')?.textContent).toBe('24 in')
    expect(el(arc.container, 'angle-label')?.textContent).toBe('40°')
    arc.unmount()
    const area = render(<TrigFigure spec={sectorFigure(240, '4π/3', '9 cm', 'area')} />)
    const fill = el(area.container, 'sector-fill')!
    // More than half the circle: the large-arc flag is set.
    expect(fill.getAttribute('d')).toMatch(/A104,104 0 1 0/)
    expect(area.container.innerHTML).not.toMatch(/NaN/)
  })
})
