import { describe, expect, it } from 'vitest'
import { q, qText } from '../trig/rational'
import { vertexOf, vertexSlipValues } from './vertex'

describe('the vertex of the final equation, exactly', () => {
  it('the worksheet’s pigpen: A = 500x − 2x² peaks at x = 125, A = 31250; her slips give 1/500, −125 and 250', () => {
    const p = { a: q(-2), b: q(500), c: q(0) }
    const v = vertexOf(p)
    expect([qText(v.t), qText(v.value), v.opens]).toEqual(['125', '31250', 'down'])
    expect(vertexSlipValues(p).map((s) => [s.id, qText(s.value)])).toEqual([
      ['opt_vertex_ab_swapped', '1/500'],
      ['opt_vertex_sign', '-125'],
      ['opt_vertex_no_two', '250'],
    ])
  })

  it('three pens with 400 ft: A = 200x − 2x² peaks at x = 50, A = 5000', () => {
    const v = vertexOf({ a: q(-2), b: q(200), c: q(0) })
    expect([qText(v.t), qText(v.value)]).toEqual(['50', '5000'])
  })

  it('a minimum: S = 2x² − 80x + 1600 is lowest at x = 20, S = 800, and opens up', () => {
    const v = vertexOf({ a: q(2), b: q(-80), c: q(1600) })
    expect([qText(v.t), qText(v.value), v.opens]).toEqual(['20', '800', 'up'])
  })

  it('a fraction: A = (1200x − 12x²)/6 written with fractions still peaks at 50', () => {
    const v = vertexOf({ a: q(-12, 6), b: q(1200, 6), c: q(0) })
    expect(qText(v.t)).toBe('50')
  })
})
