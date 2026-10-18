// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import type { GeoFigureSpec, ModuleId } from '@/shared/types'
import { GeoFigure, geoFigureLayout, type GeoLabelBox, type Stroke } from './GeoFigure'

const HEAVY = 120_000

function figureOf(module: ModuleId, template: string, seed: number): GeoFigureSpec {
  return (generateProblem(module, template, seed).answer as GeometryAnswer).figure
}

/** Does the stroke pass through the box grown by `margin` on every side? Clipped against each edge. */
function crosses([x1, y1, x2, y2]: Stroke, box: { l: number; t: number; r: number; b: number }, margin: number): boolean {
  const l = box.l - margin
  const r = box.r + margin
  const t = box.t - margin
  const b = box.b + margin
  let lo = 0
  let hi = 1
  const dx = x2 - x1
  const dy = y2 - y1
  for (const [p, q] of [
    [-dx, x1 - l],
    [dx, r - x1],
    [-dy, y1 - t],
    [dy, b - y1],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false
    } else if (p < 0) lo = Math.max(lo, q / p)
    else hi = Math.min(hi, q / p)
    if (lo > hi) return false
  }
  return true
}

const apart = (p: GeoLabelBox, q: GeoLabelBox) => p.r <= q.l || q.r <= p.l || p.b <= q.t || q.b <= p.t

/** Every drawn label inside the figure, clear of every stroke by 1 px, and clear of every other label and dot. */
function layoutProblems(spec: GeoFigureSpec): string[] {
  const { width, height, strokes, dots, labels, leaders } = geoFigureLayout(spec)
  const out: string[] = []
  // A leader line may touch only its own label.
  for (const leader of leaders) {
    for (const label of labels) {
      if (label.text !== leader.text && crosses(leader.stroke, label, 0)) out.push(`the leader to ${leader.text} crosses ${label.kind} ${label.text}`)
    }
  }
  for (const label of labels) {
    if (label.l < 0 || label.t < 0 || label.r > width || label.b > height) out.push(`${label.kind} ${label.text} leaves the figure`)
    if (strokes.some((s) => crosses(s, label, 1))) out.push(`${label.kind} ${label.text} sits on a line`)
    if (label.kind !== 'point' && dots.some((d) => !apart(label, { ...d, kind: 'point', text: '•' }))) out.push(`${label.kind} ${label.text} covers a dot`)
  }
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      if (!apart(labels[i]!, labels[j]!)) out.push(`${labels[i]!.kind} ${labels[i]!.text} covers ${labels[j]!.kind} ${labels[j]!.text}`)
    }
  }
  return out
}

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
    // Arcs are the default: two for the double mark, one for the plain angle.
    expect(marked?.querySelectorAll('[data-geo="arc"]')).toHaveLength(2)
    expect(plain?.querySelectorAll('[data-geo="arc"]')).toHaveLength(1)
    expect(container.querySelector('[data-arc="none"]')).toBeNull()
    expect(container.querySelector('[data-geo="line-label"]')).toBeNull()
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

  it('draws an angle with arc: false as its number only, and names a line near one end', () => {
    const named: GeoFigureSpec = {
      ariaLabel: 'Line m cut by line t at P, with angle 1 marked by its number.',
      points: [
        { id: 'A', x: -3, y: 0 },
        { id: 'B', x: 3, y: 0 },
        { id: 'P', x: 0, y: 0 },
        { id: 'U', x: -1, y: 2 },
        { id: 'D', x: 1, y: -2 },
      ],
      lines: [
        { through: ['A', 'B'], label: 'm' },
        { through: ['U', 'D'], label: 't' },
      ],
      angles: [{ vertex: 'P', from: 'A', to: 'U', label: '1', arc: false }],
    }
    const { container } = render(<GeoFigure spec={named} />)
    const angle = container.querySelector('[data-geo="angle"]')
    expect(angle?.getAttribute('data-arc')).toBe('none')
    expect(angle?.querySelectorAll('path')).toHaveLength(0)
    expect(angle?.querySelector('[data-geo="leader"]')).toBeNull()
    expect(angle?.textContent).toBe('1')
    const names = [...container.querySelectorAll('[data-geo="line-label"]')]
    expect(names.map((el) => el.textContent)).toEqual(['m', 't'])
    for (const el of names) expect(el.getAttribute('font-style')).toBe('italic')
    expect(layoutProblems(named)).toEqual([])
    // m is named near its right end, above the line; t near its upper end.
    const { labels, height } = geoFigureLayout(named)
    const m = labels.find((l) => l.text === 'm')!
    const t = labels.find((l) => l.text === 't')!
    expect(m.l).toBeGreaterThan(260)
    expect(m.b).toBeLessThan(height / 2)
    expect(t.b).toBeLessThan(height / 3)
  })
})

describe('Unit 3 transversal figures', () => {
  const TRANSVERSAL = ['gl3.pairs', 'gl3.solve', 'gl3.converse'] as const

  it('number the eight angles without arcs and name lines m, n, and t', () => {
    for (const template of TRANSVERSAL) {
      for (const seed of [1, 2, 3, 4, 8]) {
        const spec = figureOf('geoParallel', template, seed)
        const { container, unmount } = render(<GeoFigure spec={spec} />)
        const where = `${template}/${seed}`
        const angles = [...container.querySelectorAll('[data-geo="angle"]')]
        expect(angles, where).toHaveLength(8)
        expect(angles.map((el) => el.textContent), where).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
        for (const el of angles) {
          expect(el.getAttribute('data-arc'), where).toBe('none')
          expect(el.querySelectorAll('path'), where).toHaveLength(0)
        }
        expect(container.querySelector('[data-geo="arc"]'), where).toBeNull()
        expect(container.querySelector('[data-geo="leader"]'), where).toBeNull()
        const names = [...container.querySelectorAll('[data-geo="line-label"]')].map((el) => el.textContent)
        expect(names, where).toEqual(['m', 'n', 't'])
        const svg = container.querySelector('svg')!
        expect(svg.getAttribute('aria-label'), where).toMatch(/line m \(the upper line\) and line n \(the lower line\)/i)
        expect(svg.getAttribute('aria-label'), where).toContain('transversal t')
        // The viewBox scales with the container, so at 375 px every label inside it stays on screen.
        expect(svg.getAttribute('width')).toBe('100%')
        expect(svg.getAttribute('viewBox')).toMatch(/^0 0 360 /)
        unmount()
      }
    }
  }, HEAVY)

  it('keep every number and line name off the lines, off each other, and inside the figure, over 2000 seeds', () => {
    const problems: string[] = []
    for (const template of TRANSVERSAL) {
      for (let seed = 1; seed <= 2000; seed++) {
        const spec = figureOf('geoParallel', template, seed)
        for (const p of layoutProblems(spec)) problems.push(`${template}/${seed}: ${p}`)
        const lines = geoFigureLayout(spec).labels.filter((l) => l.kind === 'line')
        if (lines.length !== 3) problems.push(`${template}/${seed}: ${lines.length} line names`)
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
  }, HEAVY)

  // gpa.triangle used to fail here (seeds 28, 90, 118, 168, 258): B's long label had no room inside its
  // narrow angle and fell back onto side BC. A label with no room inside now goes just outside the angle.
  it('the slope, triangle and polygon figures keep their labels apart too', () => {
    const problems: string[] = []
    for (const [module, template] of [
      ['geoParallel', 'gl3.slopes'],
      ['geoPolygonAngles', 'gpa.triangle'],
      ['geoPolygonAngles', 'gpa.polygon'],
    ] as const) {
      for (let seed = 1; seed <= 300; seed++) {
        for (const p of layoutProblems(figureOf(module, template, seed))) problems.push(`${template}/${seed}: ${p}`)
      }
    }
    expect(problems.slice(0, 10)).toEqual([])
  }, HEAVY)
})
