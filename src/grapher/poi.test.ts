import { describe, expect, it } from 'vitest'
import { formatPoint } from './format'
import { buildModel, visibleCurves } from './model'
import { kindWords, pointsOfInterest, type Poi } from './poi'

function poisOf(texts: string[], xMin = -10, xMax = 10, mode: 'rad' | 'deg' = 'rad'): Poi[] {
  const m = buildModel(
    texts.map((text, i) => ({ id: `r${i}`, text })),
    mode,
  )
  const vlines = m.rows.flatMap((r) => {
    const d = m.draw(r.index)
    return d && d.kind === 'vline' ? [{ index: r.index, x: d.x }] : []
  })
  return pointsOfInterest({ curves: visibleCurves(m).map((c) => ({ index: c.index, fn: c.fn })), vlines, xMin, xMax })
}

const of = (pois: Poi[], kind: Poi['kinds'][number]) => pois.filter((p) => p.kinds.includes(kind))

describe('points of interest', () => {
  it('x² − 4: zeros at −2 and 2, a minimum at (0, −4), which is also its y-intercept', () => {
    const pois = poisOf(['y = x^2 - 4'])
    expect(of(pois, 'zero').map((p) => [p.x, p.y])).toEqual([
      [-2, 0],
      [2, 0],
    ])
    const min = of(pois, 'min')
    expect(min).toHaveLength(1)
    expect([min[0]!.x, min[0]!.y]).toEqual([0, -4])
    expect(min[0]!.kinds).toEqual(['yint', 'min'])
    expect(of(pois, 'max')).toHaveLength(0)
  })

  it('sin x in radians: its maxima are at π/2 + 2kπ, height 1', () => {
    const maxima = of(poisOf(['y = sin(x)'], -10, 10), 'max')
    const expected = [-3, 1, 5].map((k) => (k * Math.PI) / 2)
    expect(maxima.map((p) => p.x)).toHaveLength(3)
    maxima.forEach((p, i) => {
      expect(Math.abs(p.x - expected[i]!)).toBeLessThan(1e-6)
      expect(p.y).toBeCloseTo(1, 12)
    })
    // And its zeros at kπ, exactly 0 at 0.
    const zeros = of(poisOf(['y = sin(x)']), 'zero')
    expect(zeros.map((p) => p.x / Math.PI).map(Math.round)).toEqual([-3, -2, -1, 0, 1, 2, 3])
    expect(zeros.find((p) => Math.abs(p.x) < 1e-9)!.x).toBe(0)
  })

  it('sin x in degrees: the maximum is at (90, 1)', () => {
    const maxima = of(poisOf(['y = sin(x)'], -360, 360, 'deg'), 'max')
    expect(maxima.map((p) => [p.x, p.y])).toEqual([
      [-270, 1],
      [90, 1],
    ])
  })

  it('y = 500x − 2x² has its maximum at exactly (125, 31250)', () => {
    const pois = poisOf(['y = 500x - 2x^2'], -25, 275)
    const max = of(pois, 'max')
    expect(max).toHaveLength(1)
    expect(max[0]!.x).toBe(125)
    expect(max[0]!.y).toBe(31250)
    expect(formatPoint(max[0]!.x, max[0]!.y)).toBe('(125, 31250)')
    expect(of(pois, 'zero').map((p) => p.x)).toEqual([0, 250])
  })

  it('A(x) = 500x − 2x² written as her function, the same maximum', () => {
    const max = of(poisOf(['A(x) = 500x - 2x^2'], 0, 260), 'max')
    expect(max.map((p) => formatPoint(p.x, p.y))).toEqual(['(125, 31250)'])
  })

  it('y = x and y = x² cross at (0, 0) and (1, 1)', () => {
    const cross = of(poisOf(['y = x', 'y = x^2']), 'intersection')
    expect(cross.map((p) => [p.x, p.y])).toEqual([
      [0, 0],
      [1, 1],
    ])
    expect(cross.every((p) => p.rows.join() === '0,1')).toBe(true)
  })

  it('a touching crossing (y = x² and y = 2x − 1 at (1, 1)) and a touching zero ((x − 3)²)', () => {
    expect(of(poisOf(['y = x^2', 'y = 2x - 1']), 'intersection').map((p) => [p.x, p.y])).toEqual([[1, 1]])
    const p = poisOf(['y = (x - 3)^2'])
    const zero = of(p, 'zero')
    expect(zero.map((q) => q.x)).toEqual([3])
    expect(zero[0]!.kinds).toEqual(['zero', 'min'])
  })

  it('a sign change across an asymptote is not a zero: 1/x has none, tan x only at kπ', () => {
    expect(of(poisOf(['y = 1/x']), 'zero')).toEqual([])
    const tanZeros = of(poisOf(['y = tan(x)']), 'zero')
    for (const z of tanZeros) expect(Math.abs(z.x / Math.PI - Math.round(z.x / Math.PI))).toBeLessThan(1e-9)
    expect(tanZeros).toHaveLength(7)
  })

  it('the y-intercept, a vertical line crossing a curve, and simple fractions kept exact', () => {
    const pois = poisOf(['y = 3x - 1', 'x = 2'])
    expect(of(pois, 'yint').map((p) => [p.x, p.y])).toEqual([[0, -1]])
    expect(of(pois, 'zero').map((p) => formatPoint(p.x, p.y))).toEqual(['(1/3, 0)'])
    expect(of(pois, 'intersection').map((p) => [p.x, p.y])).toEqual([[2, 5]])
  })

  it('a constant, and the same curve twice, do not fill the plane with points', () => {
    expect(of(poisOf(['y = 0']), 'zero')).toEqual([])
    expect(of(poisOf(['y = 3']), 'max')).toEqual([])
    expect(of(poisOf(['y = x^2', 'y = x^2']), 'intersection')).toEqual([])
  })

  it('a hidden row has none', () => {
    const m = buildModel([{ id: 'a', text: 'y = x^2 - 4', hidden: true }])
    expect(visibleCurves(m)).toEqual([])
  })

  it('restricted pieces keep their points to their piece', () => {
    const pois = poisOf(['y = x^2 - 4 {x > 0}'])
    expect(of(pois, 'zero').map((p) => p.x)).toEqual([2])
    expect(of(pois, 'min')).toEqual([])
  })

  it('names what a point is', () => {
    expect(kindWords({ x: 0, y: 0, kinds: ['zero', 'yint'], rows: [0] })).toBe('zero · y-intercept')
    expect(kindWords({ x: 0, y: 0, kinds: ['max'], rows: [0] })).toBe('maximum')
  })
})
