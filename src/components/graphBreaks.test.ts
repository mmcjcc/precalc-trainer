import { describe, expect, it } from 'vitest'
import { evalExpr } from '@/engine'
import { splitDomain, spansWithValues } from './graphBreaks'

describe('splitDomain', () => {
  it('leaves a window alone when nothing breaks it', () => {
    expect(splitDomain(-8, 8)).toEqual([[-8, 8]])
    expect(splitDomain(-8, 8, [])).toEqual([[-8, 8]])
    expect(splitDomain(-8, 8, [-8, 8, 20])).toEqual([[-8, 8]])
  })

  it('cuts 1/x at x = 0 so the branches are separate spans', () => {
    expect(splitDomain(-8, 8, [0])).toEqual([
      [-8, 0],
      [0, 8],
    ])
  })

  it('cuts f and g at different asymptotes, and ignores duplicates', () => {
    expect(splitDomain(-10, 10, [0, 3, 3])).toEqual([
      [-10, 0],
      [0, 3],
      [3, 10],
    ])
  })
})

describe('spansWithValues', () => {
  const at = (expr: string) => (x: number) => {
    const v = evalExpr(expr, { x })
    return v === 'undef' ? Number.NaN : v
  }

  // The finished eg.inverse graph said "Could not draw this graph here": the span left of x = −6 had
  // nothing to draw, and function-plot threw.
  it('drops the span left of a log’s asymptote', () => {
    const spans = splitDomain(-12, 12, [-6])
    expect(spansWithValues(spans, at('log_3(x + 6) + 4'), 240)).toEqual([[-6, 12]])
  })

  it('keeps both branches of 1/x, and a curve that is undefined in only part of its span', () => {
    expect(spansWithValues(splitDomain(-8, 8, [0]), at('1/x'), 240)).toEqual([
      [-8, 0],
      [0, 8],
    ])
    expect(spansWithValues([[-8, 8]], at('sqrt(x - 5)'), 240)).toEqual([[-8, 8]])
    expect(spansWithValues([[-12, 12]], at('log_2(x - 20)'), 240)).toEqual([])
  })
})
