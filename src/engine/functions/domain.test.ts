import { describe, expect, it } from 'vitest'
import { parseInterval, setsEqual, setToInterval } from '@/notation'
import type { SolutionSet } from '@/shared/types'
import { domainMistakes, domainOf, gradeDomain } from './domain'
import { parseSetAnswer } from './answer'

function set(text: string): SolutionSet {
  const p = parseInterval(text)
  if (!p.ok) throw new Error(`bad interval in test: ${text}`)
  return p.set
}

function expectDomain(f: string, interval: string) {
  const d = domainOf(f)
  expect(d, f).not.toBeNull()
  expect(setToInterval(d!.set), f).toBe(setToInterval(set(interval)))
  expect(setsEqual(d!.set, set(interval)), f).toBe(true)
}

describe('domainOf — exact sets for every supported family', () => {
  it.each([
    // polynomials
    ['x^2 - 3x + 1', '(-inf, inf)'],
    ['5', '(-inf, inf)'],
    ['(2x - 1)^3', '(-inf, inf)'],
    // rational: linear and factorable denominators, irreducible ones
    ['1/(x - 3)', '(-inf, 3) U (3, inf)'],
    ['f(x) = 1/(x - 3)', '(-inf, 3) U (3, inf)'],
    ['(x + 1)/(x^2 - 9)', '(-inf, -3) U (-3, 3) U (3, inf)'],
    ['1/(2x^2 - x - 1)', '(-inf, -1/2) U (-1/2, 1) U (1, inf)'],
    ['3x/(x^2 - 5x + 6)', '(-inf, 2) U (2, 3) U (3, inf)'],
    ['1/(x^2 + 4)', '(-inf, inf)'],
    ['1/(x^3 - x)', '(-inf, -1) U (-1, 0) U (0, 1) U (1, inf)'],
    ['x/(x - 2) - 3/(x + 1)', '(-inf, -1) U (-1, 2) U (2, inf)'],
    ['(x - 1)^(-2)', '(-inf, 1) U (1, inf)'],
    ['1/(4 - 2x)', '(-inf, 2) U (2, inf)'],
    // even roots of linear and factorable quadratic radicands
    ['sqrt(x - 2)', '[2, inf)'],
    ['sqrt(-2x + 6)', '(-inf, 3]'],
    ['sqrt(2x - 1)', '[1/2, inf)'],
    ['sqrt(-x)', '(-inf, 0]'],
    ['x^(1/2)', '[0, inf)'],
    ['nthRoot(x + 1, 4)', '[-1, inf)'],
    ['(x + 1)^(1/4)', '[-1, inf)'],
    ['sqrt(x^2 - 4)', '(-inf, -2] U [2, inf)'],
    ['sqrt(9 - x^2)', '[-3, 3]'],
    ['sqrt((x - 1)(x + 3))', '(-inf, -3] U [1, inf)'],
    ['sqrt(x^2 + 1)', '(-inf, inf)'],
    ['sqrt(x^2 - 2x + 1)', '(-inf, inf)'],
    ['sqrt(1/(x - 1))', '(1, inf)'],
    // an even root in a denominator
    ['1/sqrt(x - 1)', '(1, inf)'],
    ['2/sqrt(4 - x)', '(-inf, 4)'],
    ['1/sqrt(9 - x^2)', '(-3, 3)'],
    ['(x + 1)/((x - 2)sqrt(x))', '(0, 2) U (2, inf)'],
    // odd roots: no restriction
    ['cbrt(x - 2)', '(-inf, inf)'],
    ['x^(1/3)', '(-inf, inf)'],
    ['1/cbrt(x - 2)', '(-inf, 2) U (2, inf)'],
    ['cbrt(x + 1)/(x - 2)', '(-inf, 2) U (2, inf)'],
    // sums, differences, products, quotients
    ['sqrt(x + 2)/(x - 3)', '[-2, 3) U (3, inf)'],
    ['sqrt(x) + 1/(x - 4)', '[0, 4) U (4, inf)'],
    ['sqrt(x - 1)/sqrt(5 - x)', '[1, 5)'],
    ['sqrt(x) * sqrt(4 - x)', '[0, 4]'],
    ['sqrt(x - 3)/(x^2 - 16)', '[3, 4) U (4, inf)'],
    ['abs(x - 2)', '(-inf, inf)'],
    ['1/abs(x - 2)', '(-inf, 2) U (2, inf)'],
    ['1/(sqrt(x) - 2)', '[0, 4) U (4, inf)'],
    ['1/(sqrt(x) + 1)', '[0, inf)'],
  ])('%s → %s', (f, interval) => expectDomain(f, interval))

  it('returns null rather than guess outside the supported shapes', () => {
    expect(domainOf('1/(x^2 - 2)')).toBeNull() // irrational boundary points
    expect(domainOf('sqrt(x^2 - 3)')).toBeNull()
    expect(domainOf('log(x)')).toBeNull()
    expect(domainOf('1/(x^3 - 2)')).toBeNull()
    expect(domainOf('1/(x')).toBeNull() // does not parse
  })

  it('lists the restrictions, the solved conditions and the odd roots', () => {
    const d = domainOf('sqrt(x + 2)/(x - 3)')!
    expect(d.restrictions.map((r) => [r.kind, r.condition, r.solved])).toEqual([
      ['even_root', 'x + 2 >= 0', 'x >= -2'],
      ['denominator', 'x - 3 != 0', 'x != 3'],
    ])
    expect(d.interval).toBe('[-2, 3) U (3, inf)')
    expect(d.builder).toBe('{x | x >= -2 and x != 3}')
    const r = domainOf('1/sqrt(x - 1)')!
    expect(r.restrictions.map((x) => [x.kind, x.condition, x.root])).toEqual([['even_root_denominator', 'x - 1 > 0', 'sqrt(x - 1)']])
    const c = domainOf('cbrt(x - 2)')!
    expect(c.restrictions).toEqual([])
    expect(c.oddRoots).toEqual([{ expr: 'x - 2', index: 3, root: 'cbrt(x - 2)' }])
  })

  it('explains in order, with the flip when dividing by a negative', () => {
    const d = domainOf('sqrt(-2x + 6)')!
    expect(d.explanation[0]).toBe('The square root sqrt(−2x + 6) needs a radicand ≥ 0: −2x + 6 ≥ 0 → −2x ≥ −6 → x ≤ 3 (dividing by −2, a negative number, flips ≥ to ≤).')
    expect(d.explanation[d.explanation.length - 1]).toBe('Domain: (−∞, 3], that is, x ≤ 3.')
    const q = domainOf('(x + 1)/(x^2 - 9)')!
    expect(q.explanation).toEqual([
      'The denominator x^2 − 9 cannot be 0: x^2 − 9 = (x + 3)(x − 3) is 0 at x = −3 and x = 3, so x ≠ −3 and x ≠ 3.',
      'Domain: (−∞, −3) ∪ (−3, 3) ∪ (3, ∞), that is, all real numbers except −3 and 3.',
    ])
    const p = domainOf('x^2 + 1')!
    expect(p.explanation[0]).toContain('every real number is allowed')
    const c = domainOf('cbrt(x - 2)')!
    expect(c.explanation[0]).toContain('adds no restriction')
    const r = domainOf('1/sqrt(x - 1)')!
    expect(r.explanation[0]).toBe('sqrt(x − 1) is in a denominator, so it must be strictly positive (a square root of 0 would divide by 0): x − 1 > 0 → x > 1.')
  })
})

describe('domain mistakes — each fires on a realistic wrong answer, never on the right one', () => {
  const cases: [string, string, string][] = [
    ['1/(x - 3)', '(-inf, inf)', 'domain_forgot_denominator'],
    ['sqrt(x + 2)/(x - 3)', '[-2, inf)', 'domain_forgot_denominator'],
    ['sqrt(x - 2)', '(2, inf)', 'domain_root_strict'],
    ['sqrt(x^2 - 4)', '(-inf, -2) U (2, inf)', 'domain_root_strict'],
    ['1/sqrt(x - 1)', '[1, inf)', 'domain_root_denominator_zero'],
    ['cbrt(x - 2)', '[2, inf)', 'domain_odd_root_restricted'],
    ['1/cbrt(x - 2)', '(2, inf)', 'domain_odd_root_restricted'],
    ['sqrt(-2x + 6)', '[3, inf)', 'domain_no_flip'],
    ['1/sqrt(4 - 2x)', '(2, inf)', 'domain_no_flip'],
    ['sqrt(x - 2)', '[0, inf)', 'domain_gave_range'],
    ['1/(x - 3)', '(-inf, 0) U (0, inf)', 'domain_gave_range'],
    ['1/(x - 3)', '[3, inf)', 'domain_denominator_nonneg'],
    ['1/(x - 3)', '(3, inf)', 'domain_denominator_nonneg'],
  ]
  it.each(cases)('%s answered %s → %s', (f, answer, kind) => {
    const g = gradeDomain(f, answer)
    expect(g.verdict, JSON.stringify(g)).toBe('mistake')
    if (g.verdict === 'mistake') expect(g.mistake).toBe(kind)
    const right = gradeDomain(f, domainOf(f)!.set)
    expect(right.verdict).toBe('correct')
  })

  it('writes the witness about her numbers', () => {
    const w = (f: string, a: string) => {
      const g = gradeDomain(f, a)
      return g.verdict === 'mistake' ? g.witness : `(${g.verdict})`
    }
    expect(w('1/(x - 3)', '(-inf, inf)')).toBe(
      'Your answer includes x = 3, but the denominator x − 3 is 0 there, so f(3) is undefined. A denominator can never be 0: x − 3 ≠ 0 gives x ≠ 3.',
    )
    expect(w('sqrt(x - 2)', '(2, inf)')).toBe(
      'Your answer leaves out x = 2, but f(2) = 0 is defined: the square root of 0 is 0. The radicand only has to be ≥ 0, so x − 2 ≥ 0 keeps its endpoint (x = 2 belongs in the domain; use a bracket).',
    )
    expect(w('sqrt(-2x + 6)', '[3, inf)')).toBe(
      'From −2x + 6 ≥ 0: −2x ≥ −6; dividing by −2, a negative number, flips the inequality, so x ≤ 3. Your answer points the other way: at x = 4 the radicand −2x + 6 is −2, which is negative.',
    )
    expect(w('1/sqrt(x - 1)', '[1, inf)')).toBe(
      'Your answer includes x = 1, but there the denominator sqrt(x − 1) is the square root of 0, which is 0, so f(1) divides by 0. A root in a denominator must be strictly positive: x − 1 > 0, not ≥ 0.',
    )
    expect(w('cbrt(x - 2)', '[2, inf)')).toBe(
      'Your answer leaves out x = 1, but f(1) = −1 is defined. cbrt(x − 2) is a cube root: the cube root of a negative number is a real number (cbrt(−8) = −2). Only even roots, like square roots, need a radicand ≥ 0.',
    )
    expect(w('1/(x - 3)', '[3, inf)')).toBe(
      'A denominator only has to be nonzero, not ≥ 0. At x = 2, x − 3 = −1 and f(2) = −1 is defined, but your answer leaves it out. Solve x − 3 ≠ 0 instead: x ≠ 3.',
    )
    expect(w('sqrt(x - 2)', '[0, inf)')).toBe(
      '[0, ∞) is the range of f: its outputs. The domain is the set of inputs x that f accepts. x = 0 is in your answer, but the radicand x − 2 is −2 there, which is negative, so f(0) is undefined.',
    )
  })

  it('gives a plain specific message when no named mistake fits', () => {
    const g = gradeDomain('sqrt(x - 2)', '[5, inf)')
    expect(g).toEqual({ verdict: 'wrong', message: 'x = 2 is in the domain: f(2) = 0, but your answer leaves it out.' })
    const h = gradeDomain('1/(x - 3)', '(-inf, 2) U (2, inf)')
    expect(h.verdict).toBe('wrong')
    if (h.verdict === 'wrong') expect(h.message).toContain('x = 2 is in the domain: f(2) = −1')
  })

  it('reads every textbook answer form', () => {
    for (const a of ['(-inf, 3) U (3, inf)', '{x | x != 3}', 'x != 3', 'all real numbers except 3', 'x < 3 or x > 3', '{x | x ≠ 3}']) {
      expect(gradeDomain('1/(x - 3)', a).verdict, a).toBe('correct')
    }
    for (const a of ['[-2, 3) U (3, inf)', '{x | x >= -2, x != 3}', '{x | x >= -2 and x != 3}']) {
      expect(gradeDomain('sqrt(x + 2)/(x - 3)', a).verdict, a).toBe('correct')
    }
    expect(gradeDomain('1/(x - 3)', '(-inf, 3').verdict).toBe('invalid')
    const bad = parseSetAnswer('{x | x != 3 or x > 5}')
    expect(bad.ok).toBe(false)
  })

  it('never lists a candidate equal to the domain, and never two equal candidates', () => {
    for (const f of ['1/(x - 3)', 'sqrt(x - 2)', 'sqrt(x + 2)/(x - 3)', 'cbrt(x - 2)', '1/sqrt(4 - 2x)', 'x^2 + 1', 'sqrt(1/(x - 1))']) {
      const target = domainOf(f)!.set
      const cands = domainMistakes(f)!
      for (const c of cands) expect(setsEqual(c.set, target), `${f} ${c.kind}`).toBe(false)
      for (let i = 0; i < cands.length; i++) for (let j = i + 1; j < cands.length; j++) expect(setsEqual(cands[i]!.set, cands[j]!.set)).toBe(false)
    }
  })
})
