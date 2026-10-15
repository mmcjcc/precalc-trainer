import { describe, expect, it } from 'vitest'
import { polyDeg, polyEval, rationalRoots } from '@/engine/functions/poly'
import { rat, ratAdd, ratDiv, ratSub, ratToString, setContains } from '@/notation'
import { gradeCritical, gradeSigns, gradeSolution } from './grade'
import { parseInequality, type ScProblem } from './model'

function agree(p: ScProblem) {
  const { num, den, criticals, op, solution } = p.chart
  const numRoots = polyDeg(num) >= 1 ? rationalRoots(num) : { roots: [], mult: [] as number[], rest: num }
  const denRoots = polyDeg(den) >= 1 ? rationalRoots(den) : { roots: [], mult: [] as number[], rest: den }
  expect(polyDeg(numRoots.rest), p.inequality).toBeLessThan(1)
  expect(polyDeg(denRoots.rest), p.inequality).toBeLessThan(1)
  const xs = criticals.map((c) => c.x)
  const tests = xs.length === 0 ? [rat(0)] : [ratSub(xs[0]!, rat(1))]
  for (let i = 0; i < xs.length - 1; i++) tests.push(ratDiv(ratAdd(xs[i]!, xs[i + 1]!), rat(2)))
  if (xs.length > 0) tests.push(ratAdd(xs[xs.length - 1]!, rat(1)))
  for (const x of [...tests, ...xs]) {
    const d = polyEval(den, x)
    const n = polyEval(num, x)
    const inside = d.n === 0 ? false : n.n === 0 ? op === '<=' || op === '>=' : (ratDiv(n, d).n > 0) === (op === '>' || op === '>=')
    expect(setContains(solution, x), `${p.inequality} at ${ratToString(x)}`).toBe(inside)
  }
}

const CASES: [string, string][] = [
  ['(x - 2)^2(x + 1) >= 0', '[-1, inf)'],
  ['(x - 2)^2(x + 1) > 0', '(-1, 2) U (2, inf)'],
  ['(x - 2)^2(x + 1) <= 0', '(-inf, -1] U {2}'],
  ['(x - 2)^2(x + 1) < 0', '(-inf, -1)'],
  ['(x - 2)^2 <= 0', '{2}'],
  ['(x - 2)^2 < 0', 'no solution'],
  ['(x - 2)^2 >= 0', '(-inf, inf)'],
  ['(x - 2)^2 > 0', '(-inf, 2) U (2, inf)'],
  ['-(x - 2)^2 >= 0', '{2}'],
  ['-(x - 2)^2 > 0', 'no solution'],
  ['(x + 3)/(x - 1) <= 0', '[-3, 1)'],
  ['(x + 3)/(x - 1) < 0', '(-3, 1)'],
  ['(x + 3)/(x - 1) >= 0', '(-inf, -3] U (1, inf)'],
  ['2/(x - 1) < 1', '(-inf, 1) U (3, inf)'],
  ['2/(x - 1) <= 1', '(-inf, 1) U [3, inf)'],
  ['(2x - 1)(x + 1) > 0', '(-inf, -1) U (1/2, inf)'],
  ['-(x - 1)(x + 2) > 0', '(-2, 1)'],
  ['(x - 1)^2/(x + 2) >= 0', '(-2, inf)'],
]

describe('hand-worked inequalities', () => {
  it('matches the worked solution and the direct check', () => {
    for (const [text, expected] of CASES) {
      const p = parseInequality(text)
      expect(p.chart.solutionText, text).toBe(expected)
      agree(p)
      expect(gradeSolution(p, expected).verdict, text).toBe('correct')
    }
  })

  it('names each slip by what it produces', () => {
    const square = parseInequality('(x - 2)^2(x + 1) >= 0')
    expect(gradeSolution(square, '(-1, 2) U (2, inf)')).toMatchObject({ verdict: 'mistake', mistake: 'sc_endpoints_wrong' })
    expect(gradeSolution(square, '[-1, 2]')).toMatchObject({ verdict: 'mistake', mistake: 'sc_even_sign_flip' })
    expect(gradeSolution(square, '(-inf, -1] U {2}')).toMatchObject({ verdict: 'mistake', mistake: 'sc_signs_reversed' })
    expect(gradeSolution(square, '(-inf, -1]')).toMatchObject({ verdict: 'mistake', mistake: 'sc_wrong_intervals' })
    expect(gradeSolution(square, '[2, inf)')).toMatchObject({ verdict: 'mistake', mistake: 'sc_critical_missing' })
    expect(gradeSigns(square, '-, +, -')).toMatchObject({ verdict: 'mistake', mistake: 'sc_even_sign_flip' })
    expect(gradeSigns(square, '+, -, -')).toMatchObject({ verdict: 'mistake', mistake: 'sc_signs_reversed' })
    expect(gradeCritical(square, '2')).toMatchObject({ verdict: 'mistake', mistake: 'sc_critical_missing' })
    expect(gradeCritical(square, '2, -1').verdict).toBe('wrong')

    const ratio = parseInequality('(x + 3)/(x - 1) <= 0')
    expect(gradeSolution(ratio, '[-3, 1]')).toMatchObject({ verdict: 'mistake', mistake: 'sc_denominator_included' })
    expect(gradeSolution(ratio, '(-3, 1)')).toMatchObject({ verdict: 'mistake', mistake: 'sc_endpoints_wrong' })
    expect(gradeSolution(ratio, '(-inf, -3]')).toMatchObject({ verdict: 'mistake', mistake: 'sc_multiplied_by_denominator' })
    expect(gradeSolution(ratio, '(-inf, -3] U (1, inf)')).toMatchObject({ verdict: 'mistake', mistake: 'sc_signs_reversed' })

    const moved = parseInequality('2/(x - 1) < 1')
    expect(moved.notOneSideText && moved.notOneSideText.replace(/\s+/g, ' ')).toBe('2 < x - 1')
    expect(gradeSolution(moved, '(3, inf)')).toMatchObject({ verdict: 'mistake', mistake: 'sc_not_one_side' })
    expect(gradeSolution(moved, '(1, 3)')).toMatchObject({ verdict: 'mistake', mistake: 'sc_wrong_intervals' })
    expect(gradeSolution(moved, '(1, 3]')).toMatchObject({ verdict: 'mistake', mistake: 'sc_signs_reversed' })
  })

  it('accepts a right answer written another way, and rejects an unreadable one', () => {
    const square = parseInequality('(x - 2)^2(x + 1) >= 0')
    for (const text of ['[-1,inf)', '[−1, ∞)', '[-1, infinity)']) {
      expect(gradeSolution(square, text).verdict, text).toBe('correct')
    }
    expect(gradeCritical(square, '-2/2, 4/2').verdict).toBe('correct')
    expect(gradeSigns(square, 'negative, pos, +').verdict).toBe('correct')
    expect(gradeSigns(square, '-++').verdict).toBe('correct')
    expect(gradeSigns(square, '').verdict).toBe('invalid')
    expect(gradeSigns(square, '???').verdict).toBe('invalid')
    expect(gradeSolution(square, '').verdict).toBe('invalid')
    expect(gradeSolution(square, '???').verdict).toBe('invalid')

    const point = parseInequality('(x - 2)^2 <= 0')
    expect(gradeSolution(point, '{4/2}').verdict).toBe('correct')
    expect(gradeSolution(point, '{2}').verdict).toBe('correct')

    const none = parseInequality('(x - 2)^2 < 0')
    for (const text of ['no solution', 'No Solution', '{}', '∅', 'empty']) {
      expect(gradeSolution(none, text).verdict, text).toBe('correct')
    }

    const all = parseInequality('(x - 2)^2 >= 0')
    expect(gradeSolution(all, '(-inf,inf)').verdict).toBe('correct')
    expect(gradeSolution(all, 'all real numbers').verdict).toBe('correct')

    const moved = parseInequality('2/(x - 1) < 1')
    expect(gradeSolution(moved, '(-inf,1)U(3,inf)').verdict).toBe('correct')
    expect(gradeSolution(moved, '(−∞, 1) ∪ (3, ∞)').verdict).toBe('correct')

    const half = parseInequality('(2x - 1)(x + 1) > 0')
    expect(gradeSolution(half, '(-inf,-1)U(2/4,inf)').verdict).toBe('correct')
    expect(gradeSolution(half, '(−∞, −1) ∪ (1/2, ∞)').verdict).toBe('correct')

    const ratio = parseInequality('(x + 3)/(x - 1) <= 0')
    expect(gradeSolution(ratio, '[-3,1)').verdict).toBe('correct')
    expect(gradeSolution(ratio, '[−3, 1)').verdict).toBe('correct')
  })
})
