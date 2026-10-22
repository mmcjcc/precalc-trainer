import { describe, expect, it } from 'vitest'
import { formatNumber, formatPoint, plainNumber, scientific, speakable, tickLabel } from './format'
import { zoomToFit } from './fit'
import { buildModel, visibleCurves } from './model'
import { tableRows, tableX } from './table'
import {
  clampWindow,
  minorStep,
  panBy,
  pinchWindow,
  pxToX,
  pxToY,
  STANDARD_WINDOW,
  ticksIn,
  tickStep,
  xToPx,
  yToPx,
  zoomAt,
  type ViewWindow,
} from './view'

const W = 400
const H = 300

describe('zoom and pan', () => {
  it('pixel and graph coordinates map both ways', () => {
    const w = STANDARD_WINDOW
    expect(xToPx(w, W, 0)).toBe(200)
    expect(yToPx(w, H, 10)).toBe(0)
    expect(yToPx(w, H, -10)).toBe(300)
    expect(pxToX(w, W, 300)).toBe(5)
    expect(pxToY(w, H, 75)).toBe(5)
  })

  it('a drag moves the graph with the finger', () => {
    const w = panBy(STANDARD_WINDOW, 100, -30, W, H)
    // 100 px right is 5 units: the graph moves right, so the window shows 5 units further left. 30 px up is 2 units:
    // the graph moves up, so the window shows 2 units further down.
    expect(w.xMin).toBeCloseTo(-15, 12)
    expect(w.xMax).toBeCloseTo(5, 12)
    expect(w.yMin).toBeCloseTo(-12, 12)
    expect(w.yMax).toBeCloseTo(8, 12)
  })

  it('+ and − zoom about the centre by 2; a wheel or pinch keeps the point under the fingers still', () => {
    const inn = zoomAt(STANDARD_WINDOW, 2, W, H)
    expect(inn).toEqual({ xMin: -5, xMax: 5, yMin: -5, yMax: 5 })
    const out = zoomAt(STANDARD_WINDOW, 0.5, W, H)
    expect(out).toEqual({ xMin: -20, xMax: 20, yMin: -20, yMax: 20 })
    const at = { x: 300, y: 75 }
    const before = [pxToX(STANDARD_WINDOW, W, at.x), pxToY(STANDARD_WINDOW, H, at.y)]
    const z = zoomAt(STANDARD_WINDOW, 3, W, H, at)
    expect(pxToX(z, W, at.x)).toBeCloseTo(before[0]!, 12)
    expect(pxToY(z, H, at.y)).toBeCloseTo(before[1]!, 12)
    expect(z.xMax - z.xMin).toBeCloseTo(20 / 3, 12)
  })

  it('a pinch: fingers twice as far apart is twice as close, and the graph follows their middle', () => {
    const a0 = { x: 150, y: 150 }
    const b0 = { x: 250, y: 150 }
    const a1 = { x: 110, y: 160 }
    const b1 = { x: 310, y: 160 }
    const w = pinchWindow(STANDARD_WINDOW, a0, b0, a1, b1, W, H)
    expect(w.xMax - w.xMin).toBeCloseTo(10, 12)
    expect(w.yMax - w.yMin).toBeCloseTo(10, 12)
    // The graph point that was under the first midpoint (200, 150) is under the new one (210, 160).
    expect(pxToX(w, W, 210)).toBeCloseTo(pxToX(STANDARD_WINDOW, W, 200), 12)
    expect(pxToY(w, H, 160)).toBeCloseTo(pxToY(STANDARD_WINDOW, H, 150), 12)
  })

  it('stays within the zoom limits', () => {
    const tiny = clampWindow({ xMin: 1, xMax: 1 + 1e-15, yMin: 0, yMax: 1 })
    expect(tiny.xMax - tiny.xMin).toBeGreaterThanOrEqual(1e-7 * (1 - 1e-6))
    const huge = clampWindow({ xMin: -1e20, xMax: 1e20, yMin: -1, yMax: 1 })
    expect(huge.xMax - huge.xMin).toBeLessThanOrEqual(1e12)
    let w: ViewWindow = STANDARD_WINDOW
    for (let i = 0; i < 200; i++) w = zoomAt(w, 2, W, H)
    expect(Number.isFinite(w.xMin) && w.xMax > w.xMin).toBe(true)
  })

  it('nice ticks: 1, 2 or 5 times a power of ten, far enough apart', () => {
    expect(tickStep(20, 400, 60)).toBe(5)
    expect(tickStep(20, 800, 60)).toBe(2)
    expect(tickStep(300, 400, 60)).toBe(50)
    expect(tickStep(35000, 300, 44)).toBe(10000)
    expect(tickStep(2e-6, 400, 60)).toBeCloseTo(5e-7, 20)
    expect(minorStep(5)).toBe(1)
    expect(minorStep(2)).toBe(0.5)
    expect(minorStep(10)).toBe(2)
    expect(ticksIn(-10, 10, 5)).toEqual([-10, -5, 0, 5, 10])
    expect(ticksIn(0.1, 0.35, 0.1).map((t) => Number(t.toFixed(10)))).toEqual([0.1, 0.2, 0.3])
  })
})

describe('Zoom to fit', () => {
  const fit = (texts: string[]) => {
    const m = buildModel(texts.map((text, i) => ({ id: `r${i}`, text })))
    const points = m.rows.flatMap((r) => {
      const d = m.draw(r.index)
      return d && d.kind === 'points' ? d.points : []
    })
    const vlines = m.rows.flatMap((r) => {
      const d = m.draw(r.index)
      return d && d.kind === 'vline' ? [{ index: r.index, x: d.x }] : []
    })
    return zoomToFit({ curves: visibleCurves(m).map((c) => ({ index: c.index, fn: c.fn })), vlines, points })
  }
  const contains = (w: ViewWindow, x: number, y: number) => x > w.xMin && x < w.xMax && y > w.yMin && y < w.yMax

  it('500x − 2x²: both zeros and the top, not much more', () => {
    const w = fit(['y = 500x - 2x^2'])
    expect(contains(w, 0, 0)).toBe(true)
    expect(contains(w, 250, 0)).toBe(true)
    expect(contains(w, 125, 31250)).toBe(true)
    expect(w.xMax - w.xMin).toBeLessThan(500)
    expect(w.yMax - w.yMin).toBeLessThan(80000)
  })

  it('x² − 4 and two crossing curves', () => {
    const w = fit(['y = x^2 - 4'])
    for (const [x, y] of [
      [-2, 0],
      [2, 0],
      [0, -4],
    ] as const)
      expect(contains(w, x, y)).toBe(true)
    expect(w.xMax - w.xMin).toBeLessThan(12)
    const v = fit(['y = x', 'y = x^2'])
    expect(contains(v, 0, 0) && contains(v, 1, 1)).toBe(true)
  })

  it('a wave shows a few waves; a curve far away is found', () => {
    const s = fit(['y = sin(x)'])
    expect(s.xMax - s.xMin).toBeGreaterThan(6)
    expect(s.xMax - s.xMin).toBeLessThan(40)
    expect(s.yMin).toBeLessThan(-1)
    expect(s.yMax).toBeGreaterThan(1)
    const far = fit(['y = (x - 5000)^2 + 3'])
    expect(contains(far, 5000, 3)).toBe(true)
  })

  it('an asymptote does not flatten the window; points and a line count', () => {
    const w = fit(['y = 1/(x - 2) + 1'])
    expect(w.yMax - w.yMin).toBeLessThan(200)
    const p = fit(['(30, 40), (35, -5)', 'x = 32'])
    expect(contains(p, 30, 40) && contains(p, 35, -5)).toBe(true)
  })

  it('nothing to fit is the standard window', () => {
    expect(fit([''])).toEqual(STANDARD_WINDOW)
  })
})

describe('numbers', () => {
  it('exact for integers and simple fractions, rounded to what fits otherwise', () => {
    expect(formatNumber(31250)).toBe('31250')
    expect(formatNumber(-2)).toBe('−2')
    expect(formatNumber(0.5)).toBe('0.5')
    expect(formatNumber(1 / 3)).toBe('1/3')
    expect(formatNumber(-5 / 6)).toBe('−5/6')
    expect(formatNumber(0.125)).toBe('0.125')
    expect(formatNumber(Math.SQRT2)).toBe('1.4142')
    expect(formatNumber(Math.PI / 2)).toBe('1.5708')
    expect(formatNumber(1234.5678)).toBe('1234.6')
    expect(formatNumber(2.00004)).toBe('2.0')
    expect(formatNumber(0.00123456)).toBe('0.001235')
    expect(formatNumber(31249.999999999996)).toBe('31250')
    expect(formatNumber(1.5e7 + 0.3)).toBe('1.5 × 10⁷')
    expect(formatNumber(Number.NaN)).toBe('undefined')
    expect(formatPoint(125, 31250)).toBe('(125, 31250)')
    expect(scientific(-0.000012)).toBe('−1.2 × 10⁻⁵')
  })

  it('tick labels have the decimals the step needs', () => {
    expect(tickLabel(5, 5)).toBe('5')
    expect(tickLabel(-2.5, 0.5)).toBe('−2.5')
    expect(tickLabel(0.15, 0.05)).toBe('0.15')
    expect(tickLabel(1e-15, 1)).toBe('0')
    expect(tickLabel(2e6, 1e6)).toBe('2 × 10⁶')
  })

  it('a row read aloud: x², ≤, the true minus, √ and π, other powers left as they are', () => {
    expect(speakable('y = x^2 - 4')).toBe('y = x² − 4')
    expect(speakable('y <= 2x^3 + x^(2) - x^23 + x^(2x)')).toBe('y ≤ 2x³ + x² − x^23 + x^(2x)')
    expect(speakable('f(x) = sqrt(x) + pi*x')).toBe('f(x) = √(x) + π·x')
  })

  it('plain numbers for her text, without float noise', () => {
    expect(plainNumber(0.1 + 0.2)).toBe('0.3')
    expect(plainNumber(-3)).toBe('-3')
    expect(plainNumber(2.5)).toBe('2.5')
  })
})

describe('the table', () => {
  it('x from the start in steps, y from the row, undefined where it is not defined', () => {
    const m = buildModel([{ id: 'a', text: 'y = 1/x' }])
    const rows = tableRows(m.curve(0)!, -2, 1, 5)
    expect(rows.map((r) => r.x)).toEqual([-2, -1, 0, 1, 2])
    expect(rows.map((r) => (Number.isNaN(r.y) ? 'undefined' : r.y))).toEqual([-0.5, -1, 'undefined', 1, 0.5])
  })

  it('steps of 0.1 come out as 0.1, 0.2, 0.3', () => {
    expect([0, 1, 2, 3].map((i) => tableX(0, 0.1, i))).toEqual([0, 0.1, 0.2, 0.3])
  })

  it('a restricted row is undefined outside its restriction; sliders and degrees count', () => {
    const m = buildModel([{ id: 'a', text: 'y = x^2 {x >= 0}' }])
    expect(tableRows(m.curve(0)!, -1, 1, 3).map((r) => (Number.isNaN(r.y) ? 'u' : r.y))).toEqual(['u', 0, 1])
    const s = buildModel([{ id: 'a', text: 'y = a sin(x)' }], 'deg')
    s.setParams({ a: 2 })
    expect(tableRows(s.curve(0)!, 0, 90, 3).map((r) => r.y)).toEqual([0, 2, 0])
  })
})
