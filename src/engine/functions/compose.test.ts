import { describe, expect, it } from 'vitest'
import { parseInterval, setsEqual, setToInterval } from '@/notation'
import type { SolutionSet } from '@/shared/types'
import {
  checkDecomposition,
  compositeAtText,
  compositeDomain,
  compositeDomainMistakes,
  compositeValue,
  compositeValueMistakes,
  compositionMistakes,
  composeText,
  gradeComposition,
  gradeCompositeDomain,
  gradeCompositeValue,
} from './compose'
import { domainOf } from './domain'

function set(text: string): SolutionSet {
  const p = parseInterval(text)
  if (!p.ok) throw new Error(`bad interval in test: ${text}`)
  return p.set
}

describe('composeText — g substituted in parentheses, then simplified', () => {
  it.each([
    ['x^2 + 1', 'x - 3', '(x - 3)^2 + 1', 'x^2 - 6x + 10'],
    ['2x + 1', 'x - 3', '2(x - 3) + 1', '2x - 5'],
    ['sqrt(x)', 'x^2 + 1', 'sqrt(x^2 + 1)', 'sqrt(x^2 + 1)'],
    ['x^2', 'sqrt(x)', '(sqrt(x))^2', 'x'],
    ['1/(x - 2)', 'sqrt(x)', '1/(sqrt(x) - 2)', '1/(sqrt(x) - 2)'],
    ['1/x', '1/x', '1/(1/x)', 'x'],
    ['2x + 1', '1/x', '2(1/x) + 1', '(x + 2)/x'],
    ['abs(x)', 'x - 4', 'abs(x - 4)', 'abs(x - 4)'],
    ['x^2 - 4', 'sqrt(x + 4)', '(sqrt(x + 4))^2 - 4', 'x'],
    ['3x - x^2', '2x', '3(2x) - (2x)^2', '-4x^2 + 6x'],
    ['1/(x + 1)', 'x - 1', '1/((x - 1) + 1)', '1/x'],
  ])('f = %s, g = %s', (f, g, unsimplified, simplified) => {
    expect(composeText(f, g)).toEqual({ unsimplified, simplified })
  })
})

describe('compositeDomain — {x in dom g : g(x) in dom f}', () => {
  it.each([
    ['x^2', 'sqrt(x)', '[0, inf)'],
    ['1/(x - 2)', 'sqrt(x)', '[0, 4) U (4, inf)'],
    ['sqrt(x)', 'x - 3', '[3, inf)'],
    ['sqrt(x)', '1/x', '(0, inf)'],
    ['1/x', 'x^2 - 4', '(-inf, -2) U (-2, 2) U (2, inf)'],
    ['sqrt(x - 1)', 'x^2', '(-inf, -1] U [1, inf)'],
    ['1/(x + 1)', '1/x', '(-inf, -1) U (-1, 0) U (0, inf)'],
    ['sqrt(4 - x)', 'x^2', '[-2, 2]'],
    ['x^2 - 4', 'sqrt(x + 4)', '[-4, inf)'],
    ['2x + 1', 'x - 3', '(-inf, inf)'],
    ['1/x', '1/x', '(-inf, 0) U (0, inf)'],
    ['sqrt(x)', 'abs(x) - 2', '(-inf, -2] U [2, inf)'],
    ['1/(x - 1)', 'cbrt(x)', '(-inf, 1) U (1, inf)'],
  ])('f = %s, g = %s → %s', (f, g, interval) => {
    const d = compositeDomain(f, g)
    expect(d).not.toBeNull()
    expect(setToInterval(d!.set)).toBe(setToInterval(set(interval)))
    // Independent path: the restriction walk of the unsimplified formula f(g(x)).
    const viaFormula = domainOf(composeText(f, g)!.unsimplified)
    expect(viaFormula && setsEqual(viaFormula.set, d!.set)).toBe(true)
  })

  it('catches the trap: the simplified formula hides g’s restriction', () => {
    const d = compositeDomain('x^2', 'sqrt(x)')!
    expect(d.simplified).toBe('x')
    expect(setToInterval(d.simplifiedDomain!)).toBe('(-inf, inf)')
    expect(setToInterval(d.set)).toBe('[0, inf)')
    expect(d.hidesRestriction).toBe(true)
    expect(d.explanation).toEqual([
      'First, x must be in the domain of g(x) = sqrt(x): [0, ∞) (x ≥ 0).',
      'f(x) = x^2 accepts every real number, so every output of g is allowed.',
      'Domain of f∘g: [0, ∞) (x ≥ 0).',
      'Careful: the simplified formula x on its own would allow (−∞, ∞), but g(x) has to be defined first, so the domain stays [0, ∞).',
    ])
    const g = gradeCompositeDomain('x^2', 'sqrt(x)', '(-inf, inf)')
    expect(g.verdict).toBe('mistake')
    if (g.verdict === 'mistake') {
      expect(g.mistake).toBe('composite_domain_simplified')
      expect(g.witness).toBe(
        'That is the domain of the simplified formula x alone, but simplifying can hide a restriction. x = −1 is in your answer, but g(−1) is undefined (the radicand x is −1 there, which is negative), so f(g(−1)) is undefined too. The domain of f∘g is every x in the domain of g whose output g(x) is in the domain of f.',
      )
    }
    expect(gradeCompositeDomain('x^2', 'sqrt(x)', '[0, inf)').verdict).toBe('correct')
    expect(gradeCompositeDomain('x^2', 'sqrt(x)', '{x | x >= 0}').verdict).toBe('correct')
  })

  it('explains each restriction of f with g(x) in place of x', () => {
    expect(compositeDomain('1/(x - 2)', 'sqrt(x)')!.explanation).toEqual([
      'First, x must be in the domain of g(x) = sqrt(x): [0, ∞) (x ≥ 0).',
      'f(x) = 1/(x − 2) needs x − 2 ≠ 0. With g(x) in place of x that is sqrt(x) − 2 ≠ 0, which holds for x ≥ 0 and x ≠ 4.',
      'Domain of f∘g: [0, 4) ∪ (4, ∞) (x ≥ 0 and x ≠ 4).',
    ])
  })

  it('names the inner-domain-only mistake and falls back to a plain message', () => {
    const g = gradeCompositeDomain('1/(x - 2)', 'sqrt(x)', '[0, inf)')
    expect(g.verdict).toBe('mistake')
    if (g.verdict === 'mistake') {
      expect(g.mistake).toBe('composite_domain_inner_only')
      expect(g.witness).toBe(
        'You kept only the domain of g. Its output g(x) also has to be an allowed input for f: at x = 4, g(4) = 2, and f(2) is undefined (the denominator x − 2 is 0 at x = 2).',
      )
    }
    const h = gradeCompositeDomain('1/(x - 2)', 'sqrt(x)', '(-inf, 2) U (2, inf)')
    expect(h).toEqual({ verdict: 'wrong', message: 'Your answer includes x = −1, but g(−1) is undefined (the radicand x is −1 there, which is negative), so f(g(−1)) is undefined too.' })
    for (const [f, gg] of [['x^2', 'sqrt(x)'], ['1/(x - 2)', 'sqrt(x)'], ['2x', 'x + 1']] as const) {
      const T = compositeDomain(f, gg)!.set
      for (const c of compositeDomainMistakes(f, gg)!) expect(setsEqual(c.set, T)).toBe(false)
    }
  })
})

describe('gradeComposition — f(g(x)) as a formula', () => {
  const f = 'x^2 + 1'
  const g = 'x - 3'
  it('accepts the unsimplified line, the simplified one and labelled forms', () => {
    for (const a of ['(x - 3)^2 + 1', 'x^2 - 6x + 10', 'f(g(x)) = x^2 - 6x + 10', '(f o g)(x) = (x-3)(x-3) + 1', '10 - 6x + x^2']) {
      expect(gradeComposition(f, g, a).verdict, a).toBe('correct')
    }
    // Simplified forms are judged on the composite's domain: (sqrt(x))^2 → x.
    expect(gradeComposition('x^2', 'sqrt(x)', 'x').verdict).toBe('correct')
    expect(gradeComposition('1/x', '1/x', 'x').verdict).toBe('correct')
  })

  it.each([
    ['(x^2 + 1)(x - 3)', 'compose_product'],
    ['x^3 - 3x^2 + x - 3', 'compose_product'],
    ['(x^2 + 1) - 3', 'compose_reversed'],
    ['x^2 - 2', 'compose_reversed'],
    ['x^2 + x - 2', 'compose_sum'],
    ['x - 3^2 + 1', 'compose_no_parens'],
    ['x - 8', 'compose_no_parens'],
    ['x^2 + 1', 'compose_partial_sub'],
  ])('%s → %s', (answer, kind) => {
    const r = gradeComposition(f, g, answer)
    expect(r.verdict, JSON.stringify(r)).toBe('mistake')
    if (r.verdict === 'mistake') expect(r.mistake).toBe(kind)
  })

  it('only some x’s replaced', () => {
    const r = gradeComposition('x^2 + 2x', 'x + 1', '(x + 1)^2 + 2x')
    expect(r.verdict).toBe('mistake')
    if (r.verdict === 'mistake') expect(r.mistake).toBe('compose_partial_sub')
    expect(gradeComposition('x^2 + 2x', 'x + 1', '(x + 1)^2 + 2(x + 1)').verdict).toBe('correct')
  })

  it('writes the witness at a friendly point', () => {
    const r = gradeComposition(f, g, '(x^2 + 1)(x - 3)')
    expect(r.verdict === 'mistake' && r.witness).toBe(
      'Your answer is f(x)·g(x) = (x^2 + 1)(x − 3): you multiplied the two formulas. f(g(x)) puts g(x) inside f: replace every x in f with (x − 3) to get (x − 3)^2 + 1. At x = 1: f(g(1)) = f(−2) = 5, but f(1)·g(1) = 2·(−2) = −4.',
    )
    const n = gradeComposition(f, g, 'x - 3^2 + 1')
    expect(n.verdict === 'mistake' && n.witness).toBe(
      "Put g(x) in parentheses when you substitute: x → (x − 3) turns x^2 + 1 into (x − 3)^2 + 1. Without them it reads x − 3^2 + 1, and f's exponents and coefficients reach only part of x − 3. At x = 1: f(g(1)) = f(−2) = 5, but x − 3^2 + 1 gives −7.",
    )
    const w = gradeComposition(f, g, 'x^2 + 7')
    expect(w).toEqual({ verdict: 'wrong', message: 'At x = 1: f(g(1)) = f(−2) = 5, but your expression gives 8. Replace every x in f with (x − 3).' })
    expect(gradeComposition(f, g, '(x - 3^2').verdict).toBe('invalid')
  })

  it('rejects an equal-looking formula that is undefined somewhere in the domain', () => {
    expect(gradeComposition(f, g, '(x^2 - 6x + 10)(x - 1)/(x - 1)')).toEqual({
      verdict: 'wrong',
      message: 'At x = 1, f(g(1)) = 5, but your expression is undefined there.',
    })
    expect(compositeAtText(f, g, 1)).toBe('f(g(1)) = f(−2) = 5')
    expect(compositeAtText('x', 'sqrt(x)', -1)).toBe('f(g(−1)) is undefined: g(−1) is undefined')
  })

  it('never lists a candidate equal to f(g(x))', () => {
    // f = sqrt(x): no parentheses changes nothing, so that candidate is dropped.
    const kinds = compositionMistakes('sqrt(x)', 'x - 3')!.map((c) => c.kind)
    expect(kinds).not.toContain('compose_no_parens')
    expect(kinds).toContain('compose_product')
  })
})

describe('compositeValue — (f o g)(a) exactly', () => {
  it('works from the inside out', () => {
    const v = compositeValue('2x + 5', 'x^2 - 1', 2)!
    expect(v.defined).toBe(true)
    if (v.defined) {
      expect(v.value.text).toBe('11')
      expect(v.steps).toEqual(['g(2) = 2^2 − 1 = 3.', 'f(3) = 2(3) + 5 = 11.', '(f∘g)(2) = 11.'])
    }
    const r = compositeValue('sqrt(x)', 'x + 1', '1')!
    expect(r.defined && r.value.text).toBe('sqrt(2)')
    const q = compositeValue('1/x', 'x^2 + 1', -2)!
    expect(q.defined && q.value.text).toBe('1/5')
  })

  it('says undefined when a is outside the composite domain, and why', () => {
    const outer = compositeValue('sqrt(x)', 'x - 5', 1)!
    expect(outer.defined).toBe(false)
    if (!outer.defined) {
      expect(outer.reason).toBe('outer')
      expect(outer.steps).toEqual([
        'g(1) = 1 − 5 = −4.',
        'f(−4) = sqrt(−4) is undefined: the radicand x is −4 at x = −4, which is negative.',
        'So (f∘g)(1) is undefined: g(1) = −4 is not in the domain of f.',
      ])
    }
    const inner = compositeValue('x + 1', 'sqrt(x)', -4)!
    expect(inner.defined === false && inner.reason).toBe('inner')
  })

  it('grades exact values, undefined, and the two named mistakes', () => {
    const [f, g] = ['2x + 5', 'x^2 - 1']
    expect(gradeCompositeValue(f, g, 2, '11').verdict).toBe('correct')
    expect(gradeCompositeValue(f, g, 2, '22/2').verdict).toBe('correct')
    const p = gradeCompositeValue(f, g, 2, '27')
    expect(p).toEqual({
      verdict: 'mistake',
      mistake: 'value_product',
      witness: 'You multiplied f(2)·g(2) = 9·3 = 27. (f∘g)(2) means f(g(2)): first g(2) = 3, then f(3) = 11.',
    })
    const r = gradeCompositeValue(f, g, 2, '80')
    expect(r).toEqual({
      verdict: 'mistake',
      mistake: 'value_reversed',
      witness: 'You found g(f(2)) = g(9) = 80: that is (g∘f)(2). For (f∘g)(2) work from the inside out: first g(2) = 3, then f(3) = 11.',
    })
    expect(gradeCompositeValue(f, g, 2, '12').verdict).toBe('wrong')
    expect(gradeCompositeValue(f, g, 2, 'undefined').verdict).toBe('wrong')
    expect(gradeCompositeValue(f, g, 2, '2x').verdict).toBe('invalid')
  })

  it('accepts "undefined" when it is, and still names a product slip', () => {
    for (const a of ['undefined', 'DNE', 'none']) expect(gradeCompositeValue('sqrt(x)', 'x - 5', 1, a).verdict, a).toBe('correct')
    const p = gradeCompositeValue('sqrt(x)', 'x - 5', 1, '-4')
    expect(p.verdict === 'mistake' && p.mistake).toBe('value_product')
    expect(gradeCompositeValue('sqrt(x)', 'x - 5', 1, '2').verdict).toBe('wrong')
  })

  it('compares radicals exactly and flags rounded decimals', () => {
    expect(gradeCompositeValue('sqrt(x)', 'x + 1', 1, 'sqrt(2)').verdict).toBe('correct')
    expect(gradeCompositeValue('sqrt(x)', 'x + 1', 1, 'sqrt(8)/2').verdict).toBe('correct')
    expect(gradeCompositeValue('sqrt(x)', 'x + 1', 1, '2^(1/2)').verdict).toBe('correct')
    const d = gradeCompositeValue('sqrt(x)', 'x + 1', 1, '1.414')
    expect(d).toEqual({ verdict: 'wrong', message: '1.414 is a rounded decimal. Give the exact value: (f∘g)(1) = sqrt(2).' })
    expect(gradeCompositeValue('1/x', 'x + 1', 1, '0.5').verdict).toBe('correct')
    expect(gradeCompositeValue('1/x', 'x + 1', 1, '0.4999999999').verdict).toBe('wrong')
  })

  it('drops value candidates equal to the answer', () => {
    // f(x) = x, g(x) = x + 1 at a = 0: f(0)·g(0) = 0 ≠ 1, g(f(0)) = 1 = answer → dropped.
    const kinds = compositeValueMistakes('x', 'x + 1', 0)!.map((c) => c.kind)
    expect(kinds).toEqual(['value_product'])
  })
})

describe('checkDecomposition', () => {
  it('accepts two different valid decompositions', () => {
    expect(checkDecomposition('1/(x - 3)^2', '1/x^2', 'x - 3').ok).toBe(true)
    expect(checkDecomposition('1/(x - 3)^2', '1/x', '(x - 3)^2').ok).toBe(true)
    expect(checkDecomposition('abs(x - 4) + 2', 'x + 2', 'abs(x - 4)').ok).toBe(true)
    expect(checkDecomposition('abs(x - 4) + 2', 'abs(x) + 2', 'x - 4').ok).toBe(true)
    expect(checkDecomposition('(2x + 1)^3', 'x^3', '2x + 1').ok).toBe(true)
    expect(checkDecomposition('sqrt(x^2 + 1)', 'sqrt(x)', 'x^2 + 1').ok).toBe(true)
  })

  it('rejects a trivial decomposition', () => {
    const f = checkDecomposition('(2x + 1)^3', 'x', '(2x + 1)^3')
    expect(f.ok === false && f.reason).toBe('trivial_f')
    const g = checkDecomposition('(2x + 1)^3', '(2x + 1)^3', 'x')
    expect(g.ok === false && g.reason).toBe('trivial_g')
  })

  it('rejects a wrong pair with a counterexample, and a domain mismatch', () => {
    const r = checkDecomposition('(2x + 1)^3', 'x^3', '2x')
    expect(r).toEqual({
      ok: false,
      reason: 'not_equal',
      message: 'f(g(x)) = (2x)^3 is not h(x): at x = 1, h(1) = 27, but f(g(1)) = f(2) = 8.',
    })
    const d = checkDecomposition('x^3', 'x^6', 'sqrt(x)')
    expect(d.ok === false && d.reason).toBe('domain')
    const p = checkDecomposition('(2x + 1)^3', 'x^3', '2x +')
    expect(p.ok === false && p.reason).toBe('parse_g')
  })
})
