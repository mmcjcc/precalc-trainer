import { describe, expect, it } from 'vitest'
import { buildModel } from './model'
import { piecePoints, sampleCurve, type Quality, type Sampled } from './sample'
import { STANDARD_WINDOW, type ViewWindow } from './view'

const W = 400
const H = 400

function curveOf(text: string, mode: 'rad' | 'deg' = 'rad') {
  const m = buildModel([{ id: 'r', text }], mode)
  const c = m.curve(0)
  if (!c) throw new Error(`${text}: ${m.rows[0]!.error?.message}`)
  return c
}

function sample(text: string, window: ViewWindow = STANDARD_WINDOW, quality: Quality = 'full'): Sampled {
  const c = curveOf(text)
  return sampleCurve({ ...c, x0: window.xMin, x1: window.xMax, window, width: W, height: H, quality })
}

/** Every segment [a, b] between two consecutive points of a piece. */
function segments(s: Sampled): [number, number, number, number][] {
  const out: [number, number, number, number][] = []
  for (const piece of s.pieces) {
    const pts = piecePoints(piece)
    for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]])
  }
  return out
}

const crosses = (s: Sampled, x: number) => segments(s).some(([a, , b]) => a < x && b > x)

describe('asymptotes: no line across them', () => {
  it('tan x: none of its asymptotes is crossed, and each piece runs off the window at both ends', () => {
    const s = sample('y = tan(x)')
    const poles = [-5, -3, -1, 1, 3, 5].map((k) => (k * Math.PI) / 2).filter((p) => Math.abs(p) < 10)
    for (const p of poles) expect(crosses(s, p)).toBe(false)
    expect(s.pieces.length).toBe(poles.length + 1)
    // The inner pieces (between two asymptotes) start below the window and end above it.
    for (const piece of s.pieces.slice(1, -1)) {
      const pts = piecePoints(piece)
      expect(pts[0]![1]).toBeLessThan(STANDARD_WINDOW.yMin)
      expect(pts[pts.length - 1]![1]).toBeGreaterThan(STANDARD_WINDOW.yMax)
    }
    expect(s.holes).toEqual([])
  })

  it('tan x in degrees: the asymptotes are at ±90° and ±270°', () => {
    const c = curveOf('y = tan(x)', 'deg')
    const w = { xMin: -360, xMax: 360, yMin: -10, yMax: 10 }
    const s = sampleCurve({ ...c, x0: w.xMin, x1: w.xMax, window: w, width: W, height: H, quality: 'full' })
    for (const p of [-270, -90, 90, 270]) expect(crosses(s, p)).toBe(false)
    expect(s.pieces).toHaveLength(5)
  })

  it('1/x: nothing joins the two branches at 0; the left one goes down, the right one up', () => {
    const s = sample('y = 1/x')
    expect(crosses(s, 0)).toBe(false)
    expect(s.pieces).toHaveLength(2)
    const left = piecePoints(s.pieces[0]!)
    const right = piecePoints(s.pieces[1]!)
    expect(left[left.length - 1]![1]).toBeLessThan(-10)
    expect(right[0]![1]).toBeGreaterThan(10)
    expect(s.holes).toEqual([])
  })

  it('1/(x − 1)² (both sides up) and a slider-moved pole, 1/(x − a)', () => {
    const s = sample('y = 1/(x - 1)^2')
    expect(crosses(s, 1)).toBe(false)
    expect(s.pieces).toHaveLength(2)
    const m = buildModel([{ id: 'r', text: 'y = 1/(x - a)' }])
    m.setParams({ a: 2.5 })
    const c = m.curve(0)!
    const t = sampleCurve({ ...c, x0: -10, x1: 10, window: STANDARD_WINDOW, width: W, height: H, quality: 'full' })
    expect(crosses(t, 2.5)).toBe(false)
  })
})

describe('holes and domains', () => {
  it('(x² − 1)/(x − 1) leaves its hole at (1, 2) open', () => {
    const s = sample('y = (x^2 - 1)/(x - 1)')
    expect(s.holes).toHaveLength(1)
    expect(s.holes[0]!.x).toBe(1)
    expect(s.holes[0]!.y).toBeCloseTo(2, 6)
    expect(crosses(s, 1)).toBe(false)
    expect(s.pieces.flatMap((p) => piecePoints(p)).some(([x]) => x === 1)).toBe(false)
    expect(s.pieces).toHaveLength(2)
  })

  it('√x only where x ≥ 0, starting exactly at (0, 0)', () => {
    const s = sample('y = sqrt(x)')
    const pts = s.pieces.flatMap((p) => piecePoints(p))
    expect(pts.every(([x]) => x >= 0)).toBe(true)
    expect(s.pieces).toHaveLength(1)
    expect(pts[0]).toEqual([0, 0])
  })

  it('ln x only where x > 0, running off the bottom of the window', () => {
    const s = sample('y = ln(x)')
    const pts = s.pieces.flatMap((p) => piecePoints(p))
    expect(pts.every(([x]) => x > 0)).toBe(true)
    expect(pts[0]![1]).toBeLessThan(-10)
  })

  it('√(4 − x²) between −2 and 2, ends included', () => {
    const s = sample('y = sqrt(4 - x^2)')
    expect(s.pieces).toHaveLength(1)
    const pts = piecePoints(s.pieces[0]!)
    expect(pts[0]![0]).toBeCloseTo(-2, 9)
    expect(pts[pts.length - 1]![0]).toBeCloseTo(2, 9)
    expect(pts.every(([x]) => x >= -2 && x <= 2)).toBe(true)
  })

  it('a jump the analysis cannot foresee (floor) is found and not joined', () => {
    const s = sample('y = floor(x)', { xMin: -3, xMax: 3, yMin: -4, yMax: 4 })
    for (const [, ya, , yb] of segments(s)) expect(Math.abs(yb - ya)).toBeLessThan(0.5)
    expect(s.pieces.length).toBeGreaterThanOrEqual(6)
  })
})

describe('leaving the window and coming back', () => {
  it('y = x² − 20 leaves at the top and comes back: one piece, exact where it crosses the edges', () => {
    const s = sample('y = x^2 - 20')
    expect(s.pieces).toHaveLength(1)
    const pts = piecePoints(s.pieces[0]!)
    const inside = pts.filter(([, y]) => y >= -10 && y <= 10)
    expect(inside.some(([x]) => x < -5)).toBe(true)
    expect(inside.some(([x]) => x > 5)).toBe(true)
    for (const [x, y] of inside) expect(y).toBeCloseTo(x * x - 20, 9)
  })

  it('30 sin x goes out at the top and bottom again and again, and stays one piece', () => {
    const s = sample('y = 30sin(x)')
    expect(s.pieces).toHaveLength(1)
  })
})

describe('steep, flat, and every scale', () => {
  it('a very steep line is still drawn through the window', () => {
    const s = sample('y = 1000000x')
    expect(s.pieces).toHaveLength(1)
    const pts = piecePoints(s.pieces[0]!)
    expect(pts.some(([, y]) => y > 5)).toBe(true)
    expect(pts.some(([, y]) => y < -5)).toBe(true)
  })

  it('a very flat line uses few points', () => {
    const s = sample('y = 0.0001x + 3')
    expect(s.pieces).toHaveLength(1)
    expect(piecePoints(s.pieces[0]!).length).toBeLessThanOrEqual(W)
  })

  it('stays within a fraction of a pixel of the curve (sin x, x³ − 3x)', () => {
    for (const text of ['y = sin(3x)', 'y = x^3 - 3x', 'y = e^x']) {
      const c = curveOf(text)
      const s = sampleCurve({ ...c, x0: -10, x1: 10, window: STANDARD_WINDOW, width: W, height: H, quality: 'full' })
      const pxY = H / 20
      for (const [xa, ya, xb, yb] of segments(s)) {
        if (ya > 10 || yb > 10 || ya < -10 || yb < -10) continue
        for (const t of [0.25, 0.5, 0.75]) {
          const x = xa + (xb - xa) * t
          const line = ya + (yb - ya) * t
          expect(Math.abs(line - c.f(x)) * pxY).toBeLessThan(1)
        }
      }
    }
  })

  it('a window a million wide, and one a millionth wide', () => {
    const big = { xMin: -1e6, xMax: 1e6, yMin: -1e12, yMax: 1e12 }
    const s = sample('y = x^2', big)
    expect(s.pieces).toHaveLength(1)
    for (const [x, y] of piecePoints(s.pieces[0]!)) if (y <= 1e12) expect(y).toBeCloseTo(x * x, -3)
    const small = { xMin: 1 - 1e-6, xMax: 1 + 1e-6, yMin: 1 - 3e-6, yMax: 1 + 3e-6 }
    const t = sample('y = x^2', small)
    expect(t.pieces).toHaveLength(1)
    const pts = piecePoints(t.pieces[0]!)
    expect(pts.length).toBeGreaterThan(10)
    for (const [x, y] of pts) expect(Math.abs(y - x * x)).toBeLessThan(1e-12)
  })

  it('fast quality (while dragging) still breaks at asymptotes', () => {
    const s = sample('y = tan(x)', STANDARD_WINDOW, 'fast')
    expect(crosses(s, Math.PI / 2)).toBe(false)
    expect(crosses(s, -Math.PI / 2)).toBe(false)
  })
})

describe('restrictions', () => {
  it('y = 6 {x < 1} stops at 1 with an open dot', () => {
    const s = sample('y = 6 {x < 1}')
    const pts = s.pieces.flatMap((p) => piecePoints(p))
    expect(pts.every(([x]) => x <= 1)).toBe(true)
    expect(s.ends).toEqual([{ x: 1, y: 6, closed: false }])
  })

  it('y = |x + 1| {1 <= x < 3}: a filled dot at (1, 2), an open one at (3, 4)', () => {
    const s = sample('y = |x + 1| {1 <= x < 3}')
    expect(s.pieces).toHaveLength(1)
    expect(s.ends).toEqual([
      { x: 1, y: 2, closed: true },
      { x: 3, y: 4, closed: false },
    ])
  })

  it('y = |x| {x = 5} is one filled dot', () => {
    const s = sample('y = |x| {x = 5}')
    expect(s.pieces).toHaveLength(0)
    expect(s.ends).toEqual([{ x: 5, y: 5, closed: true }])
  })
})
