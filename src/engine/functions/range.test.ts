import { describe, expect, it } from 'vitest'
import { parseInterval, ratToString, setsEqual, setToInterval } from '@/notation'
import type { SolutionSet } from '@/shared/types'
import { gradeRange, rangeMistakes, rangeOf } from './range'

function set(text: string): SolutionSet {
  const p = parseInterval(text)
  if (!p.ok) throw new Error(`bad interval in test: ${text}`)
  return p.set
}

describe('rangeOf — exact ranges for the Unit 1 families', () => {
  it.each([
    ['3', 'constant', '{3}'],
    ['2x - 5', 'linear', '(-inf, inf)'],
    ['-x/3 + 1', 'linear', '(-inf, inf)'],
    ['x^2 - 4x + 1', 'quadratic', '[-3, inf)'],
    ['-2x^2 + 4x + 3', 'quadratic', '(-inf, 5]'],
    ['2(x - 1)^2 + 3', 'quadratic', '[3, inf)'],
    ['(1/2)x^2 - x', 'quadratic', '[-1/2, inf)'],
    ['-(x + 2)^2', 'quadratic', '(-inf, 0]'],
    ['x^3 - 2x', 'odd_polynomial', '(-inf, inf)'],
    ['sqrt(x - 3)', 'even_root', '[0, inf)'],
    ['-2sqrt(x + 1) + 5', 'even_root', '(-inf, 5]'],
    ['3sqrt(2x - 4) - 1', 'even_root', '[-1, inf)'],
    ['sqrt(-x) + 2', 'even_root', '[2, inf)'],
    ['5 - sqrt(x)/2', 'even_root', '(-inf, 5]'],
    ['nthRoot(x, 4) + 1', 'even_root', '[1, inf)'],
    ['abs(x - 2) + 1', 'absolute_value', '[1, inf)'],
    ['-abs(2x + 1) + 4', 'absolute_value', '(-inf, 4]'],
    ['|x| - 3', 'absolute_value', '[-3, inf)'],
    ['cbrt(x - 1) + 2', 'odd_root', '(-inf, inf)'],
    ['-2cbrt(x)', 'odd_root', '(-inf, inf)'],
    ['3/(x - 2) + 1', 'reciprocal', '(-inf, 1) U (1, inf)'],
    ['1/x', 'reciprocal', '(-inf, 0) U (0, inf)'],
    ['(2x + 1)/(x - 3)', 'reciprocal', '(-inf, 2) U (2, inf)'],
    ['-4/(x + 1) - 2', 'reciprocal', '(-inf, -2) U (-2, inf)'],
    ['2/(3x - 1)', 'reciprocal', '(-inf, 0) U (0, inf)'],
  ])('%s → %s %s', (f, family, interval) => {
    const r = rangeOf(f)
    expect(r, f).not.toBeNull()
    expect(r!.family).toBe(family)
    expect(setToInterval(r!.set)).toBe(setToInterval(set(interval)))
    expect(setsEqual(r!.set, set(interval))).toBe(true)
  })

  it('returns null outside the families', () => {
    for (const f of ['x^4', '1/(x^2 - 1)', 'sqrt(x^2 - 4)', 'sqrt(x) + abs(x)', '(x^2 - 1)/(x - 1)', '1/(1/x)', 'x^(3/2)', 'sqrt(x) * x', 'log(x)']) {
      expect(rangeOf(f), f).toBeNull()
    }
  })

  it('reports the family numbers exactly', () => {
    const q = rangeOf('-2x^2 + 4x + 3')!
    expect([q.params.a, q.params.h, q.params.k].map((r) => ratToString(r!))).toEqual(['-2', '1', '5'])
    const s = rangeOf('-2sqrt(x + 1) + 5')!
    expect([s.params.a, s.params.h, s.params.k].map((r) => ratToString(r!))).toEqual(['-2', '-1', '5'])
    const m = rangeOf('(2x + 1)/(x - 3)')!
    expect([m.params.a, m.params.h, m.params.k].map((r) => ratToString(r!))).toEqual(['7', '3', '2'])
    expect(m.builder).toBe('{y | y != 2}')
    expect(rangeOf('x^2 - 4x + 1')!.builder).toBe('{y | y >= -3}')
  })

  it('explains from the vertex, the reflection and the asymptote', () => {
    expect(rangeOf('-2x^2 + 4x + 3')!.explanation).toEqual([
      'f(x) = −2x^2 + 4x + 3 is a quadratic with a = −2 < 0, so the parabola opens down and its vertex is the highest point.',
      'Vertex: x = −b/(2a) = −4/(2·(−2)) = 1, and f(1) = 5.',
      'So every output is ≤ 5, and each of those values is reached.',
      'Range: (−∞, 5].',
    ])
    expect(rangeOf('-2sqrt(x + 1) + 5')!.explanation).toEqual([
      'A square root is never negative: sqrt(x + 1) ≥ 0, and it is 0 at x = −1, then grows without bound.',
      'Multiplying by −2 (negative) flips it: −2·sqrt(x + 1) ≤ 0.',
      'Adding 5 shifts every output: f(x) ≤ 5, and every such value is reached.',
      'Range: (−∞, 5].',
    ])
    expect(rangeOf('(2x + 1)/(x - 3)')!.explanation).toEqual([
      'Write f in the form a/(x − h) + k: f(x) = 2 + 7/(x − 3).',
      '7/(x − 3) is never 0 (its numerator 7 is not 0), and it takes every other real value.',
      'So f(x) takes every value except 2: y = 2 is the horizontal asymptote.',
      'Range: (−∞, 2) ∪ (2, ∞).',
    ])
  })
})

describe('range mistakes', () => {
  it.each([
    ['-2sqrt(x + 1) + 5', '[5, inf)', 'range_reflection_ignored'],
    ['-abs(x) + 4', '[4, inf)', 'range_reflection_ignored'],
    ['-2x^2 + 4x + 3', '[5, inf)', 'range_reflection_ignored'],
    ['-2sqrt(x + 1) + 5', '[-1, inf)', 'range_gave_domain'],
    ['sqrt(x - 3)', '[3, inf)', 'range_gave_domain'],
    ['3/(x - 2) + 1', '(-inf, 2) U (2, inf)', 'range_gave_domain'],
    ['3/(x - 2) + 1', '(-inf, inf)', 'range_included_asymptote'],
  ])('%s answered %s → %s', (f, answer, kind) => {
    const g = gradeRange(f, answer)
    expect(g.verdict, JSON.stringify(g)).toBe('mistake')
    if (g.verdict === 'mistake') expect(g.mistake).toBe(kind)
    expect(gradeRange(f, rangeOf(f)!.set).verdict).toBe('correct')
  })

  it('writes witnesses about her numbers', () => {
    const w = (f: string, a: string) => {
      const g = gradeRange(f, a)
      return g.verdict === 'mistake' ? g.witness : `(${g.verdict})`
    }
    expect(w('-2sqrt(x + 1) + 5', '[5, inf)')).toBe(
      'The coefficient −2 in front flips the graph upside down: −2·sqrt(x + 1) ≤ 0, so f(x) ≤ 5. Your answer includes y = 6, but no output is above 5.',
    )
    expect(w('3/(x - 2) + 1', '(-inf, inf)')).toBe(
      'y = 1 is the horizontal asymptote: 3/(x − 2) is never 0 (its numerator is 3), so f(x) never equals 1. Your answer includes 1; the range is (−∞, 1) ∪ (1, ∞).',
    )
    expect(w('sqrt(x - 3)', '[3, inf)')).toBe(
      '[3, ∞) is the domain: the inputs x. The range is the set of outputs y = f(x). y = 0 is an output (f(3) = 0), but your answer leaves it out.',
    )
  })

  it('gives a plain message otherwise, and reads y answers', () => {
    expect(gradeRange('sqrt(x - 3)', '(0, inf)')).toEqual({
      verdict: 'wrong',
      message: 'y = 0 is an output, f(3) = 0, but your answer leaves it out.',
    })
    expect(gradeRange('3/(x - 2) + 1', '{y | y != 1}').verdict).toBe('correct')
    expect(gradeRange('3/(x - 2) + 1', 'y != 1').verdict).toBe('correct')
    expect(gradeRange('x^2', 'y >= 0').verdict).toBe('correct')
    expect(gradeRange('x^4', '[0, inf)').verdict).toBe('unsupported')
  })

  it('never lists a candidate equal to the range', () => {
    for (const f of ['x^2 - 4x + 1', '-2sqrt(x + 1) + 5', '3/(x - 2) + 1', 'cbrt(x)', '2x + 1', 'abs(x)']) {
      const target = rangeOf(f)!.set
      for (const c of rangeMistakes(f)!) expect(setsEqual(c.set, target), `${f} ${c.kind}`).toBe(false)
    }
  })
})
