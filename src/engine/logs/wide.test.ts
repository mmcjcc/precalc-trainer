import { describe, expect, it } from 'vitest'
import { parseExpression, parseStatement } from '../parse'
import type { Statement } from '../types'
import { compareWide, domainOf, domainSamples, inDomain, positivePart, solutionsWide } from './wide'

function stmt(text: string): Statement {
  const p = parseStatement(text, ['x'])
  if (!p.ok) throw new Error(`${text}: ${p.error.message}`)
  return p.statement
}

function dom(text: string) {
  const p = parseExpression(text, ['x'])
  if (!p.ok) throw new Error(text)
  return domainOf([p.node], 'x')
}

function intervals(text: string): [number, number][] {
  return dom(text).intervals.map((iv) => [iv.lo, iv.hi])
}

const INF = Number.POSITIVE_INFINITY

describe('domains as open intervals', () => {
  it.each([
    ['log(x - 3)', [[3, INF]]],
    ['log(x) + log(x - 3)', [[3, INF]]],
    ['log(x(x - 3))', [[-INF, 0], [3, INF]]],
    ['ln(x^2)', [[-INF, 0], [0, INF]]],
    ['ln(5 - x) - ln(x + 2)', [[-2, 5]]],
    ['log_2(x + 1) + 3', [[-1, INF]]],
    ['log(log(x))', [[1, INF]]],
    ['2^x + e^(-x)', [[-INF, INF]]],
    ['3e^(2x) + 1', [[-INF, INF]]],
  ] as [string, [number, number][]][])('%s', (text, expected) => {
    const got = intervals(text)
    expect(got.length).toBe(expected.length)
    got.forEach(([lo, hi], i) => {
      expect(lo).toBeCloseTo(expected[i]![0], 9)
      expect(hi).toBeCloseTo(expected[i]![1], 9)
    })
  })

  it('an exponential that overflows far out is not given a domain edge there', () => {
    expect(intervals('2^x')).toEqual([[-INF, INF]])
  })

  it('samples are inside the domain', () => {
    const d = dom('log(x - 3) + log(20 - x)')
    const pts = domainSamples(d, 7)
    expect(pts.length).toBeGreaterThanOrEqual(10)
    for (const t of pts) expect(t > 3 && t < 20, String(t)).toBe(true)
  })

  it('positivePart cuts a domain to x > 0', () => {
    const d = positivePart(dom('ln(x^2)'))
    expect(inDomain(d, -1)).toBe(false)
    expect(inDomain(d, 2)).toBe(true)
  })
})

describe('solutions on the wide grid', () => {
  it.each([
    ['log(x - 3) = -2', [3.01]],
    ['log(x) = -3', [0.001]],
    ['0.5^(x/5730) = 0.3', [(5730 * Math.log(0.3)) / Math.log(0.5)]],
    ['1.01^x = 2', [Math.log(2) / Math.log(1.01)]],
    ['x^2 = 2', [-Math.SQRT2, Math.SQRT2]],
    ['(x - 3)^2 = 0', [3]],
    ['2^(x + 1) = 3^x', [Math.log(2) / (Math.log(3) - Math.log(2))]],
    ['e^x = 0', []],
    ['1/(x - 2) = 0', []],
    ['log(x) + log(x - 3) = 1', [5]],
    ['ln(x^2) = 4', [-(Math.E ** 2), Math.E ** 2]],
    ['5000(1 + 0.04/12)^(12x) = 10000', [Math.log(2) / (12 * Math.log(1 + 0.04 / 12))]],
  ] as [string, number[]][])('%s', (text, expected) => {
    const got = solutionsWide(stmt(text), 'x')
    expect(got.length, JSON.stringify(got)).toBe(expected.length)
    got.forEach((t, i) => expect(Math.abs(t - expected[i]!)).toBeLessThan(1e-7 * Math.max(1, Math.abs(expected[i]!))))
  })
})

describe('compareWide', () => {
  it('finds where two lines disagree, with undefined kept apart from false', () => {
    const c = compareWide(stmt('log(x) < 2'), stmt('x < 100'), 'x')
    expect(c.mismatches.length).toBeGreaterThan(0)
    expect(c.mismatches.every((m) => m.old !== true && m.new === true)).toBe(true)
    expect(c.mismatches.some((m) => m.old === 'undef')).toBe(true)
  })

  it('agrees on equivalent lines', () => {
    expect(compareWide(stmt('log(x) < 2'), stmt('0 < x < 100'), 'x').mismatches).toEqual([])
    expect(compareWide(stmt('2^x = 7'), stmt('x log(2) = log(7)'), 'x').mismatches).toEqual([])
  })

  it('a scope (the original’s domain) limits which points count', () => {
    const inside = (t: number) => t > 3
    const c = compareWide(stmt('log(x) + log(x - 3) = 1'), stmt('log(x(x - 3)) = 1'), 'x', { inScope: inside })
    expect(c.mismatches).toEqual([])
    expect(c.newTrue.some((t) => Math.abs(t + 2) < 1e-9)).toBe(true)
  })
})
