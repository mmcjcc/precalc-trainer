import { describe, expect, it } from 'vitest'
import { ratToString } from '@/notation/rational'
import {
  analyzeFactored,
  endBehaviorMistakes,
  endBehaviorOf,
  expandFactored,
  factoredFormText,
  gradeCrossTouch,
  gradeEndBehavior,
  gradePolynomialFromZeros,
  gradeYIntercept,
  gradeZeros,
  makeFactored,
  parseFactored,
  polynomialFromZeros,
  polynomialFromZerosMistakes,
  yInterceptMistakes,
  zeroMistakes,
} from './zeros'
import type { FactoredPoly, PolyGrade } from './types'

/** −2(x + 1)^2(x − 3)(x − 1/2)^3: zeros −1 (2), 1/2 (3), 3 (1); degree 6; both ends down; f(0) = −3/4. */
const P = '-2(x + 1)^2(x - 3)(x - 1/2)^3'
/** 3(2x − 1)(x + 4)^2: zeros 1/2 (1), −4 (2); degree 3; leading coefficient 6; f(0) = −48. */
const R = '3(2x - 1)(x + 4)^2'

function mistakeOf(g: PolyGrade): string | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

function shape(fp: FactoredPoly | null) {
  return fp && { lead: ratToString(fp.lead), factors: fp.factors.map((f) => `${ratToString(f.coef)}x${f.constant.n < 0 ? '' : '+'}${ratToString(f.constant)}^${f.mult}`) }
}

describe('makeFactored / parseFactored / factoredFormText', () => {
  it('builds and prints the sample', () => {
    const fp = makeFactored(-2, [{ zero: -1, mult: 2 }, { zero: 3 }, { zero: '1/2', mult: 3 }])
    expect(factoredFormText(fp)).toBe('-2(x + 1)^2(x - 3)(x - 1/2)^3')
    expect(shape(parseFactored(P))).toEqual(shape(fp))
    expect(shape(parseFactored('-2(x + 1)^2 (x - 3)(x - 1/2)^3'))).toEqual(shape(fp))
    expect(shape(parseFactored('f(x) = -2(x+1)^2(x-3)(x-1/2)^3'))).toEqual(shape(fp))
  })

  it('prints every kind of factor', () => {
    expect(factoredFormText(makeFactored(1, [{ zero: 0, mult: 2 }, { coef: 2, constant: -1 }]))).toBe('x^2(2x - 1)')
    expect(factoredFormText(makeFactored('1/2', [{ zero: -4 }, { coef: -1, constant: 3, mult: 3 }]))).toBe('(1/2)(x + 4)(-x + 3)^3')
    expect(factoredFormText(makeFactored(-1, [{ zero: 0 }, { zero: 2 }]))).toBe('-x(x - 2)')
    expect(factoredFormText(makeFactored(3, [{ coef: '1/2', constant: 2 }]))).toBe('3((1/2)x + 2)')
    // The printed text always reads back as the same polynomial.
    for (const t of ['x^2(2x - 1)', '(1/2)(x + 4)(-x + 3)^3', '-x(x - 2)', '3((1/2)x + 2)', P, R]) expect(factoredFormText(parseFactored(t)!), t).toBe(t)
  })

  it('reads products written in other ways', () => {
    expect(shape(parseFactored('(x + 1)(x + 1)(x - 2)'))).toEqual({ lead: '1', factors: ['1x+1^2', '1x-2^1'] })
    expect(shape(parseFactored('x^2(2x - 1)(3 - x)^3'))).toEqual({ lead: '1', factors: ['1x+0^2', '2x-1^1', '-1x+3^3'] })
    expect(shape(parseFactored('2(x - 1)/3'))).toEqual({ lead: '2/3', factors: ['1x-1^1'] })
    expect(shape(parseFactored('-(x - 1)^2'))).toEqual({ lead: '-1', factors: ['1x-1^2'] })
    expect(shape(parseFactored('(2(x - 1))^2'))).toEqual({ lead: '4', factors: ['1x-1^2'] })
    expect(shape(parseFactored('(-(x - 1))^3'))).toEqual({ lead: '-1', factors: ['1x-1^3'] })
    expect(shape(parseFactored('2x + 4'))).toEqual({ lead: '1', factors: ['2x+4^1'] })
  })

  it('rejects what is not a product of linear factors', () => {
    for (const t of ['x^2 - 4', '(x^2 + 1)(x - 2)', '5', '(x - 1)/(x + 2)', 'sqrt(x)(x - 1)', '(x - 1)^x', '(x - 1)^(1/2)', '0(x - 1)', '(x - 1', '']) expect(parseFactored(t), t).toBeNull()
    expect(analyzeFactored('x^2 - 4')).toBeNull()
    expect(gradeZeros('x^2 - 4', '2, -2').verdict).toBe('unsupported')
  })

  it('makeFactored throws on a template bug', () => {
    expect(() => makeFactored(0, [{ zero: 1 }])).toThrow(RangeError)
    expect(() => makeFactored(1, [])).toThrow(RangeError)
    expect(() => makeFactored(1, [{ zero: 1, mult: 0 }])).toThrow(RangeError)
    expect(() => makeFactored(1, [{ coef: 0, constant: 1 }])).toThrow(RangeError)
    expect(() => makeFactored(1, [{ zero: 'one' }])).toThrow(RangeError)
  })
})

describe('analyzeFactored', () => {
  it('the sample', () => {
    const a = analyzeFactored(P)!
    expect(a.text).toBe(P)
    expect(a.zeros.map((z) => [z.text, z.mult, z.behavior, z.factor])).toEqual([
      ['-1', 2, 'touches', '(x + 1)^2'],
      ['1/2', 3, 'crosses', '(x - 1/2)^3'],
      ['3', 1, 'crosses', '(x - 3)'],
    ])
    expect(a.degree).toBe(6)
    expect(ratToString(a.leadingCoefficient)).toBe('-2')
    expect(a.end).toEqual({ left: 'down', right: 'down' })
    expect(a.endText).toBe('As x → −∞, f(x) → −∞; as x → ∞, f(x) → −∞.')
    expect(ratToString(a.yIntercept)).toBe('-3/4')
    expect(a.expandedText).toBe(expandFactored(P))
    expect(a.explanation).toEqual([
      '(x + 1)^2: x + 1 = 0 when x = −1. The exponent is 2, so the multiplicity is 2 (even): the graph touches the x-axis and turns back there.',
      '(x − 1/2)^3: x − 1/2 = 0 when x = 1/2. The exponent is 3, so the multiplicity is 3 (odd): the graph crosses the x-axis there.',
      '(x − 3): x − 3 = 0 when x = 3. The exponent is 1, so the multiplicity is 1 (odd): the graph crosses the x-axis there.',
      'Degree: add the exponents, 2 + 1 + 3 = 6 (even).',
      'Leading coefficient: −2, the number in front (every factor starts with x).',
      'Even degree: both ends go the same way. Negative leading coefficient: the right end goes down, and so does the left. As x → −∞, f(x) → −∞; as x → ∞, f(x) → −∞.',
      'y-intercept: f(0) = −2(0 + 1)^2(0 − 3)(0 − 1/2)^3 = −3/4.',
    ])
  })

  it('hand-checked: degree, leading coefficient, ends, y-intercept', () => {
    const cases: [string, number, string, string, string, string][] = [
      [R, 3, '6', 'down', 'up', '-48'],
      ['x^2(2x - 1)(3 - x)^3', 6, '-2', 'down', 'down', '0'],
      ['(x - 2)^2(x + 1)', 3, '1', 'down', 'up', '4'],
      ['-(x - 1)(x + 2)(x - 4)', 3, '-1', 'up', 'down', '-8'],
      ['(x + 3)^2(x - 1)^2', 4, '1', 'up', 'up', '9'],
      ['-(1/2)x(x - 4)^3', 4, '-1/2', 'down', 'down', '0'],
      ['(x - 5)', 1, '1', 'down', 'up', '-5'],
    ]
    for (const [f, degree, lead, left, right, y] of cases) {
      const a = analyzeFactored(f)!
      expect([a.degree, ratToString(a.leadingCoefficient), a.end.left, a.end.right, ratToString(a.yIntercept)], f).toEqual([degree, lead, left, right, y])
    }
    expect(expandFactored('(x - 2)^2(x + 1)')).toBe('x^3 - 3x^2 + 4')
    expect(expandFactored(R)).toBe('6x^3 + 45x^2 + 72x - 48')
  })

  it('non-monic factors: the zero is solved, the leading coefficient is multiplied', () => {
    const a = analyzeFactored(R)!
    expect(a.zeros.map((z) => [z.text, z.mult, z.behavior, z.factor])).toEqual([
      ['-4', 2, 'touches', '(x + 4)^2'],
      ['1/2', 1, 'crosses', '(2x - 1)'],
    ])
    expect(a.explanation[1]).toBe('(2x − 1): 2x − 1 = 0 gives 2x = 1, so x = 1/2. The exponent is 1, so the multiplicity is 1 (odd): the graph crosses the x-axis there.')
    expect(a.explanation[3]).toBe('Leading coefficient: multiply the number in front by the x-coefficient of each factor, raised to its exponent: 3·2 = 6.')
    expect(analyzeFactored('x^2(2x - 1)(3 - x)^3')!.explanation[0]).toBe(
      'x^2: it is 0 when x = 0. The exponent is 2, so the multiplicity is 2 (even): the graph touches the x-axis and turns back there.',
    )
    expect(analyzeFactored('x^2(2x - 1)(3 - x)^3')!.explanation[2]).toBe(
      '(−x + 3)^3: −x + 3 = 0 gives −x = −3, so x = 3. The exponent is 3, so the multiplicity is 3 (odd): the graph crosses the x-axis there.',
    )
    expect(analyzeFactored('x^2(2x - 1)(3 - x)^3')!.explanation[4]).toBe(
      'Leading coefficient: multiply the number in front by the x-coefficient of each factor, raised to its exponent: 1·2·(−1)^3 = −2.',
    )
  })

  it('two factors with the same zero are one zero', () => {
    const a = analyzeFactored('(x - 1)(2x - 2)')!
    expect(a.zeros.map((z) => [z.text, z.mult, z.behavior])).toEqual([['1', 2, 'touches']])
  })

  it('endBehaviorOf', () => {
    expect(endBehaviorOf(2, 1)).toEqual({ left: 'up', right: 'up' })
    expect(endBehaviorOf(2, -3)).toEqual({ left: 'down', right: 'down' })
    expect(endBehaviorOf(3, '1/2')).toEqual({ left: 'down', right: 'up' })
    expect(endBehaviorOf(5, -1)).toEqual({ left: 'up', right: 'down' })
    expect(() => endBehaviorOf(0, 1)).toThrow(RangeError)
    expect(() => endBehaviorOf(2, 0)).toThrow(RangeError)
  })
})

describe('gradeZeros', () => {
  const rows = (...r: [string, number | string][]) => r.map(([zero, mult]) => ({ zero, mult }))

  it('zeros only, as a set, in any order and spelling', () => {
    for (const a of ['-1, 3, 1/2', '1/2, -1, 3', '{-1, 3, 0.5}', 'x = -1, x = 3, x = 1/2', '−1, 3, 1/2, 3']) {
      expect(gradeZeros(P, a), a).toMatchObject({ verdict: 'correct', message: 'Correct: the zeros are −1, 1/2 and 3.' })
    }
    expect(gradeZeros(P, [{ zero: '3' }, { zero: '-1' }, { zero: '1/2' }]).verdict).toBe('correct')
  })

  it('with multiplicities', () => {
    expect(gradeZeros(P, rows(['-1', 2], ['3', 1], ['1/2', '3']))).toMatchObject({
      verdict: 'correct',
      message: 'Correct: x = −1 (multiplicity 2), x = 1/2 (multiplicity 3) and x = 3 (multiplicity 1).',
    })
  })

  it('the sign of a zero read backwards', () => {
    expect(gradeZeros(P, '1, 3, 1/2')).toMatchObject({
      verdict: 'mistake',
      mistake: 'zero_sign_reversed',
      witness: '(x + 1) is 0 when x + 1 = 0, so x = −1, not 1: the zero has the opposite sign to the number in the factor.',
    })
    const all = gradeZeros(P, '1, -3, -1/2')
    expect(all.verdict === 'mistake' && all.mistake).toBe('zero_sign_reversed')
    expect(all.verdict === 'mistake' && all.witness).toBe(
      '(x + 1) is 0 when x + 1 = 0, so x = −1, not 1: the zero has the opposite sign to the number in the factor. The same goes for (x − 3) (x = 3, not −3) and (x − 1/2) (x = 1/2, not −1/2).',
    )
    // Still named when the multiplicities are given, right or wrong.
    expect(mistakeOf(gradeZeros(P, rows(['1', 2], ['3', 1], ['1/2', 3])))).toBe('zero_sign_reversed')
  })

  it('a zero from (2x − 1) given as 1, −1, 2 or −1/2', () => {
    expect(gradeZeros(R, '1, -4')).toMatchObject({
      verdict: 'mistake',
      mistake: 'zero_nonmonic_factor',
      witness: 'Set the factor equal to 0 and solve: 2x − 1 = 0, 2x = 1, x = 1/2. Your 1 ignores the 2 in front of x.',
    })
    expect(mistakeOf(gradeZeros(R, '-1, -4'))).toBe('zero_nonmonic_factor')
    expect(gradeZeros(R, '2, -4')).toMatchObject({ mistake: 'zero_nonmonic_factor', witness: 'Set the factor equal to 0 and solve: 2x − 1 = 0, 2x = 1, x = 1/2. Your 2 divides the wrong way round.' })
    expect(gradeZeros(R, '-1/2, -4')).toMatchObject({ mistake: 'zero_sign_reversed', witness: 'Set the factor equal to 0 and solve: 2x − 1 = 0, 2x = 1, x = 1/2. Your −1/2 has the sign backwards.' })
    expect(zeroMistakes(R)!.map((c) => [c.kind, c.factor, c.text, c.shadows])).toEqual([
      ['zero_sign_reversed', '(2x - 1)', '-1/2', []],
      ['zero_nonmonic_factor', '(2x - 1)', '1', []],
      ['zero_nonmonic_factor', '(2x - 1)', '-1', []],
      ['zero_nonmonic_factor', '(2x - 1)', '2', []],
      ['zero_sign_reversed', '(x + 4)^2', '4', []],
    ])
  })

  it('a misreading that lands on another zero of f is not listed (it cannot be seen)', () => {
    // (x − 1)(x + 1): flipping either sign gives the other zero.
    expect(zeroMistakes('(x - 1)(x + 1)')).toEqual([])
    expect(gradeZeros('(x - 1)(x + 1)', '1, -1').verdict).toBe('correct')
    // x has no sign to flip.
    expect(zeroMistakes('x(x - 2)')!.map((c) => c.text)).toEqual(['-2'])
  })

  it('multiplicity ignored, or attached to the wrong zero', () => {
    expect(gradeZeros(P, rows(['-1', 1], ['3', 1], ['1/2', 1]))).toMatchObject({
      verdict: 'mistake',
      mistake: 'multiplicity_ignored',
      witness: 'The multiplicity of a zero is the exponent on its factor: (x + 1)^2 gives x = −1 multiplicity 2, not 1.',
    })
    expect(mistakeOf(gradeZeros(P, rows(['-1', 2], ['3', 1], ['1/2', 1])))).toBe('multiplicity_ignored')
    expect(gradeZeros(P, rows(['-1', 3], ['3', 1], ['1/2', 2]))).toMatchObject({
      verdict: 'mistake',
      mistake: 'multiplicity_wrong_zero',
      witness:
        'Each exponent belongs to the zero of its own factor: (x + 1)^2 gives x = −1 multiplicity 2, (x − 1/2)^3 gives x = 1/2 multiplicity 3 and (x − 3) gives x = 3 multiplicity 1. You gave x = −1 multiplicity 3, the exponent of a different factor.',
    })
    expect(gradeZeros(P, rows(['-1', 2], ['3', 2], ['1/2', 3]))).toMatchObject({
      verdict: 'wrong',
      message: 'Your zeros are right. The multiplicity of x = 3 is the exponent on its factor (x − 3): 1, not 2.',
    })
  })

  it('missing and extra zeros get plain, exact sentences', () => {
    expect(gradeZeros(P, '-1, 3')).toMatchObject({ verdict: 'wrong', message: 'You are missing the zero that comes from the factor (x − 1/2)^3.' })
    expect(gradeZeros(P, '-1, 3, 1/2, 5')).toMatchObject({ verdict: 'wrong', message: 'x = 5 is not a zero: f(5) = −13122, not 0.' })
    expect(gradeZeros(P, '-1, 3, 2')).toMatchObject({ verdict: 'wrong', message: 'x = 2 is not a zero: f(2) = 243/4, not 0. You are missing the zero that comes from the factor (x − 1/2)^3.' })
    expect(gradeZeros(P, '3')).toMatchObject({ verdict: 'wrong', message: 'You are missing 2 zeros: every factor gives one (set (x + 1) and (x − 1/2) equal to 0).' })
    // The leading coefficient is not a zero.
    expect(gradeZeros(P, '-2, -1, 3, 1/2')).toMatchObject({ verdict: 'wrong' })
  })

  it('unreadable answers are invalid', () => {
    expect(gradeZeros(P, '')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeZeros(P, '-1, three')).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(gradeZeros(P, rows(['-1', 2], ['3', ''], ['1/2', 3]))).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(gradeZeros(P, rows(['-1', 2], ['3', 1.5], ['1/2', 3]))).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(gradeZeros(P, rows(['-1', 1], ['-1', 1], ['3', 1], ['1/2', 3]))).toMatchObject({ verdict: 'invalid', index: 1, message: 'You listed −1 twice: give each zero once, with its multiplicity.' })
    expect(gradeZeros(P, [{ zero: '-1', mult: 2 }, { zero: '', mult: 1 }])).toMatchObject({ verdict: 'invalid', index: 1 })
  })

  it('rows of the table left completely blank are skipped', () => {
    expect(gradeZeros(P, [{ zero: '-1', mult: 2 }, { zero: '', mult: '' }, { zero: '3', mult: 1 }, { zero: '1/2', mult: 3 }, { zero: '' }]).verdict).toBe('correct')
    expect(gradeZeros(P, [{ zero: '-1' }, { zero: '' }, { zero: '3' }, { zero: '1/2' }]).verdict).toBe('correct')
    expect(gradeZeros(P, [{ zero: '' }, { zero: '', mult: '' }])).toMatchObject({ verdict: 'invalid', message: 'Type the zeros first, like -1, 3, 1/2.' })
  })
})

describe('gradeCrossTouch', () => {
  it('even multiplicity touches, odd crosses', () => {
    const g = gradeCrossTouch(P, ['touches', 'crosses', 'crosses'])
    expect(g).toMatchObject({ verdict: 'correct', message: 'Correct: touches at x = −1 (multiplicity 2), crosses at x = 1/2 (multiplicity 3) and crosses at x = 3 (multiplicity 1).' })
    expect(g.checks!.every((c) => c.ok)).toBe(true)
    expect(gradeCrossTouch(P, ['Touch', 'cross', 'Crosses']).verdict).toBe('correct')
    expect(gradeCrossTouch(P, ['bounces', 'crosses', 'crosses']).verdict).toBe('correct')
  })

  it('a swapped choice is named, zero by zero', () => {
    const g = gradeCrossTouch(P, ['crosses', 'touches', 'touches'])
    expect(g).toMatchObject({
      verdict: 'mistake',
      mistake: 'cross_touch_swapped',
      witness:
        '(x + 1)^2 gives x = −1 multiplicity 2, which is even. An even power never changes sign, so the graph touches the x-axis at x = −1 and turns back; it does not cross. The same rule decides x = 1/2 and x = 3: even multiplicity touches, odd multiplicity crosses.',
    })
    expect(g.checks!.map((c) => c.ok)).toEqual([false, false, false])
    const one = gradeCrossTouch(P, ['touches', 'touches', 'crosses'])
    expect(one).toMatchObject({
      verdict: 'mistake',
      mistake: 'cross_touch_swapped',
      witness: '(x − 1/2)^3 gives x = 1/2 multiplicity 3, which is odd. An odd power changes sign, so the graph crosses the x-axis at x = 1/2; it does not turn back.',
    })
    expect(one.checks!.map((c) => [ratToString(c.zero), c.expected, c.chosen, c.ok])).toEqual([
      ['-1', 'touches', 'touches', true],
      ['1/2', 'crosses', 'touches', false],
      ['3', 'crosses', 'crosses', true],
    ])
  })

  it('needs one readable choice per zero', () => {
    expect(gradeCrossTouch(P, ['touches', 'crosses'])).toMatchObject({ verdict: 'invalid', message: 'Choose crosses or touches for each of the 3 zeros.' })
    expect(gradeCrossTouch(P, ['touches', '', 'crosses'])).toMatchObject({ verdict: 'invalid', index: 1 })
  })
})

describe('gradeEndBehavior', () => {
  it('correct, in words or symbols, factored or standard form', () => {
    expect(gradeEndBehavior(P, { left: 'down', right: 'down' })).toMatchObject({
      verdict: 'correct',
      message: 'Correct: degree 6 (even) with a negative leading coefficient (−2). As x → −∞, f(x) → −∞; as x → ∞, f(x) → −∞.',
    })
    expect(gradeEndBehavior(P, { left: '-inf', right: '−∞' }).verdict).toBe('correct')
    expect(gradeEndBehavior('-x^3 + 4x', { left: 'inf', right: '-inf' }).verdict).toBe('correct')
    expect(gradeEndBehavior('-x^3 + 4x', { left: '∞', right: 'falls' }).verdict).toBe('correct')
    expect(gradeEndBehavior([2, 0, -1, 0, 5], { left: 'up', right: 'up' }).verdict).toBe('correct')
    expect(gradeEndBehavior(makeFactored(3, [{ coef: 2, constant: -1 }, { zero: -4, mult: 2 }]), { left: 'down', right: 'up' }).verdict).toBe('correct')
    const g = gradeEndBehavior('-x^3 + 4x', { left: 'up', right: 'down' })
    expect(g.verdict === 'correct' && g.explanation).toEqual([
      'The leading term of −x^3 + 4x decides the ends: degree 3 (odd), leading coefficient −1.',
      'Odd degree: the ends go opposite ways. Negative leading coefficient: the right end goes down, so the left end goes up. As x → −∞, f(x) → ∞; as x → ∞, f(x) → −∞.',
    ])
  })

  it('the sign of the leading coefficient ignored', () => {
    expect(gradeEndBehavior(P, { left: 'up', right: 'up' })).toMatchObject({
      verdict: 'mistake',
      mistake: 'end_sign_ignored',
      witness:
        'The degree 6 (even) says the two ends go the same way; the SIGN of the leading coefficient says which way. Here it is −2, negative, so the right end goes down and so does the left. Your answer is what a positive leading coefficient gives.',
    })
    expect(mistakeOf(gradeEndBehavior('-x^3 + 4x', { left: 'down', right: 'up' }))).toBe('end_sign_ignored')
  })

  it('even and odd swapped', () => {
    expect(gradeEndBehavior(P, { left: 'up', right: 'down' })).toMatchObject({
      verdict: 'mistake',
      mistake: 'end_parity_swapped',
      witness:
        'The degree is 6 (add the exponents: 2 + 1 + 3 = 6), which is even: both ends go the same way. Your answer sends the ends opposite ways, the pattern of an odd degree. Count the exponents, not the number of factors (3).',
    })
    expect(gradeEndBehavior('-x^3 + 4x', { left: 'down', right: 'down' })).toMatchObject({
      mistake: 'end_parity_swapped',
      witness: 'The degree is 3, which is odd: the ends go opposite ways. Your answer sends both ends the same way, the pattern of an even degree.',
    })
    expect(mistakeOf(gradeEndBehavior('x^4 - 1', { left: 'down', right: 'up' }))).toBe('end_parity_swapped')
  })

  it('candidates: a positive leading coefficient has no sign to ignore', () => {
    expect(endBehaviorMistakes(P)!.map((c) => [c.kind, c.end.left, c.end.right])).toEqual([
      ['end_sign_ignored', 'up', 'up'],
      ['end_parity_swapped', 'up', 'down'],
    ])
    expect(endBehaviorMistakes('x^4 - 1')!.map((c) => [c.kind, c.end.left, c.end.right])).toEqual([['end_parity_swapped', 'down', 'up']])
    // The remaining wrong answer is plain.
    expect(gradeEndBehavior(P, { left: 'down', right: 'up' })).toMatchObject({
      verdict: 'wrong',
      message: 'This polynomial has degree 6 (even) with a negative leading coefficient (−2). Even degree: both ends go the same way. Negative leading coefficient: the right end goes down.',
    })
    expect(gradeEndBehavior('x^4 - 1', { left: 'down', right: 'down' }).verdict).toBe('wrong')
  })

  it('invalid and unsupported', () => {
    expect(gradeEndBehavior(P, { left: 'sideways', right: 'up' })).toMatchObject({ verdict: 'invalid', index: 0 })
    expect(gradeEndBehavior(P, { left: 'up', right: '' })).toMatchObject({ verdict: 'invalid', index: 1 })
    expect(gradeEndBehavior('7', { left: 'up', right: 'up' }).verdict).toBe('unsupported')
    expect(gradeEndBehavior('sqrt(x)', { left: 'up', right: 'up' }).verdict).toBe('unsupported')
  })
})

describe('gradeYIntercept', () => {
  it('a number or the point (0, y)', () => {
    expect(gradeYIntercept(P, '-3/4')).toMatchObject({ verdict: 'correct', message: 'Correct: f(0) = −2(0 + 1)^2(0 − 3)(0 − 1/2)^3 = −3/4, so the y-intercept is (0, −3/4).' })
    expect(gradeYIntercept(P, '(0, -0.75)').verdict).toBe('correct')
    expect(gradeYIntercept(R, '-48').verdict).toBe('correct')
  })
  it('names the slips', () => {
    expect(gradeYIntercept(P, '3/8')).toMatchObject({
      verdict: 'mistake',
      mistake: 'lead_coefficient_omitted',
      witness: 'The −2 in front multiplies everything: f(0) = −2(0 + 1)^2(0 − 3)(0 − 1/2)^3 = −3/4. Your 3/8 is the product of the factors at x = 0 without it.',
    })
    expect(gradeYIntercept(P, '-3')).toMatchObject({ verdict: 'mistake', mistake: 'multiplicity_ignored' })
    expect(yInterceptMistakes(P)!.map((c) => [c.kind, c.text])).toEqual([
      ['lead_coefficient_omitted', '3/8'],
      ['multiplicity_ignored', '-3'],
    ])
    expect(yInterceptMistakes('(x - 2)(x + 1)')).toEqual([])
  })
  it('wrong and invalid', () => {
    expect(gradeYIntercept(P, '1')).toMatchObject({ verdict: 'wrong', message: 'Put x = 0 into every factor: f(0) = −2(0 + 1)^2(0 − 3)(0 − 1/2)^3 = −3/4. Your answer, 1, is not −3/4.' })
    expect(gradeYIntercept(P, '(3, 0)')).toMatchObject({ verdict: 'wrong', message: 'The y-intercept is where the graph meets the y-axis, so its x-coordinate is 0: the point (0, f(0)).' })
    expect(gradeYIntercept(P, 'y')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('polynomialFromZeros', () => {
  /** Zeros −1 (multiplicity 2) and 3, through (0, 6): f(x) = −2(x + 1)^2(x − 3). */
  const spec = { zeros: [{ zero: -1, mult: 2 }, { zero: 3 }], point: { x: 0, y: 6 } }

  it('the model', () => {
    const b = polynomialFromZeros(spec)!
    expect(ratToString(b.a)).toBe('-2')
    expect(b.text).toBe('-2(x + 1)^2(x - 3)')
    expect(b.expandedText).toBe('-2x^3 + 2x^2 + 10x + 6')
    expect(b.degree).toBe(3)
    expect(b.explanation).toEqual([
      'Each zero gives a factor: x = −1 (multiplicity 2) gives (x + 1)^2 and x = 3 gives (x − 3).',
      'Least degree means nothing else: f(x) = a(x + 1)^2(x − 3), degree 3.',
      'Use the point (0, 6): 6 = a·(0 + 1)^2(0 − 3) = −3a, so a = 6/(−3) = −2.',
      'f(x) = −2(x + 1)^2(x − 3).',
    ])
    const half = polynomialFromZeros({ zeros: [{ zero: '1/2' }, { zero: -2 }], point: { x: 1, y: 6 } })!
    expect(half.text).toBe('4(x - 1/2)(x + 2)')
    expect(half.explanation[2]).toBe('Use the point (1, 6): 6 = a·(1 − 1/2)(1 + 2) = (3/2)a, so a = 6/(3/2) = 4.')
    expect(polynomialFromZeros({ zeros: [{ zero: 2 }, { zero: -2 }] })!.text).toBe('(x - 2)(x + 2)')
  })

  it('is null for a spec that has no answer', () => {
    expect(polynomialFromZeros({ zeros: [] })).toBeNull()
    expect(polynomialFromZeros({ zeros: [{ zero: 1 }, { zero: 1 }] })).toBeNull()
    expect(polynomialFromZeros({ zeros: [{ zero: 1, mult: 0 }] })).toBeNull()
    expect(polynomialFromZeros({ zeros: [{ zero: 1 }], point: { x: 1, y: 3 } })).toBeNull()
    expect(polynomialFromZeros({ zeros: [{ zero: 1 }], point: { x: 2, y: 0 } })).toBeNull()
    expect(gradePolynomialFromZeros({ zeros: [] }, 'x').verdict).toBe('unsupported')
  })

  it('any equivalent formula is right', () => {
    for (const a of ['-2(x + 1)^2(x - 3)', '-2x^3 + 2x^2 + 10x + 6', 'f(x) = -2(x+1)(x+1)(x-3)', '2(x + 1)^2(3 - x)', '(x + 1)^2(6 - 2x)']) {
      expect(gradePolynomialFromZeros(spec, a).verdict, a).toBe('correct')
    }
    const half = { zeros: [{ zero: '1/2' }, { zero: -2 }], point: { x: 1, y: 6 } }
    expect(gradePolynomialFromZeros(half, '2(2x - 1)(x + 2)').verdict).toBe('correct')
    expect(gradePolynomialFromZeros(half, '4(x - 1/2)(x + 2)').verdict).toBe('correct')
  })

  it('without a point any nonzero multiple is right', () => {
    const s = { zeros: [{ zero: 2 }, { zero: -2, mult: 2 }] }
    for (const a of ['(x - 2)(x + 2)^2', '3(x - 2)(x + 2)^2', '-(x - 2)(x + 2)^2', 'x^3 + 2x^2 - 4x - 8']) expect(gradePolynomialFromZeros(s, a).verdict, a).toBe('correct')
    expect(mistakeOf(gradePolynomialFromZeros(s, '(x + 2)(x - 2)^2'))).toBe('zero_sign_reversed')
    expect(polynomialFromZerosMistakes(s)!.some((c) => c.kind === 'lead_coefficient_omitted')).toBe(false)
  })

  it('the leading coefficient left out, or left as 1', () => {
    expect(gradePolynomialFromZeros(spec, '(x + 1)^2(x - 3)')).toMatchObject({
      verdict: 'mistake',
      mistake: 'lead_coefficient_omitted',
      witness:
        'Your formula has the right zeros and multiplicities, but it does not go through (0, 6): at x = 0 it gives −3. Put a in front, f(x) = a(x + 1)^2(x − 3), and use the point: 6 = −3a, so a = −2.',
    })
    expect(mistakeOf(gradePolynomialFromZeros(spec, 'x^3 - x^2 - 5x - 3'))).toBe('lead_coefficient_omitted')
    const half = { zeros: [{ zero: '1/2' }, { zero: -2 }], point: { x: 1, y: 6 } }
    expect(mistakeOf(gradePolynomialFromZeros(half, '(2x - 1)(x + 2)'))).toBe('lead_coefficient_omitted')
    expect(mistakeOf(gradePolynomialFromZeros(half, '(x - 1/2)(x + 2)'))).toBe('lead_coefficient_omitted')
    // A wrong number in front that is not "left out" is plain.
    expect(gradePolynomialFromZeros(spec, '2(x + 1)^2(x - 3)')).toMatchObject({
      verdict: 'wrong',
      message: 'Your zeros and multiplicities are right. Now check the number in front with the point (0, 6): at x = 0 your formula gives −6, but it must give 6.',
    })
  })

  it('signs and multiplicities, whatever number is in front', () => {
    expect(gradePolynomialFromZeros(spec, '-2(x - 1)^2(x + 3)')).toMatchObject({
      verdict: 'mistake',
      mistake: 'zero_sign_reversed',
      witness: 'A zero at x = −1 needs the factor (x + 1), which is 0 when x = −1. Your formula has (x − 1), which is 0 at x = 1.',
    })
    expect(mistakeOf(gradePolynomialFromZeros(spec, '2(x - 1)^2(x + 3)'))).toBe('zero_sign_reversed')
    expect(gradePolynomialFromZeros(spec, '-2(x + 1)^2(x + 3)')).toMatchObject({
      mistake: 'zero_sign_reversed',
      witness: 'A zero at x = 3 needs the factor (x − 3), which is 0 when x = 3. Your formula has (x + 3), which is 0 at x = −3.',
    })
    expect(gradePolynomialFromZeros(spec, '-2(x + 1)(x - 3)')).toMatchObject({
      mistake: 'multiplicity_ignored',
      witness: 'x = −1 has multiplicity 2, so its factor carries that exponent: (x + 1)^2. Your formula uses (x + 1) only once.',
    })
    expect(gradePolynomialFromZeros(spec, '(x + 1)(x - 3)^2')).toMatchObject({
      mistake: 'multiplicity_wrong_zero',
      witness: 'The multiplicity 2 belongs to x = −1: its factor is (x + 1)^2. Your formula has (x + 1) instead.',
    })
    expect(polynomialFromZerosMistakes(spec)!.map((c) => [c.kind, c.text])).toEqual([
      ['lead_coefficient_omitted', '(x + 1)^2(x - 3)'],
      ['zero_sign_reversed', '2(x - 1)^2(x + 3)'],
      ['multiplicity_ignored', '-2(x + 1)(x - 3)'],
      ['multiplicity_wrong_zero', '(2/3)(x + 1)(x - 3)^2'],
    ])
  })

  it('other wrong formulas: the degree, then a zero that is not a zero', () => {
    expect(gradePolynomialFromZeros(spec, '-2(x + 1)^2(x - 3)(x - 5)')).toMatchObject({
      verdict: 'wrong',
      message: 'Your formula has degree 4. The least degree is the sum of the multiplicities, 2 + 1 = 3: one factor (x − zero) for each zero, raised to its multiplicity, and nothing else.',
    })
    expect(gradePolynomialFromZeros(spec, '-2(x + 1)^2(x - 4)')).toMatchObject({ verdict: 'wrong', message: 'x = 3 must be a zero, but your formula gives 32 there, not 0. It needs the factor (x − 3).' })
    expect(gradePolynomialFromZeros(spec, '-2(x + 1)^2/(x - 3)')).toMatchObject({ verdict: 'invalid' })
    expect(gradePolynomialFromZeros(spec, '')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('zeros mistakes never fire on the right answer', () => {
  it('right answers grade correct and every candidate grades as its own kind', () => {
    for (const f of [P, R, 'x^2(2x - 1)(3 - x)^3', '(x - 2)^2(x + 1)', '-(x - 1)(x + 2)(x - 4)', '(x + 3)^2(x - 1)^2', '-(1/2)x(x - 4)^3', '(3x + 2)(x - 5)^2']) {
      const a = analyzeFactored(f)!
      expect(gradeZeros(f, a.zeros.map((z) => z.text).join(', ')).verdict, f).toBe('correct')
      expect(gradeZeros(f, a.zeros.map((z) => ({ zero: z.text, mult: z.mult }))).verdict, f).toBe('correct')
      expect(gradeCrossTouch(f, a.zeros.map((z) => z.behavior)).verdict, f).toBe('correct')
      expect(gradeEndBehavior(f, a.end).verdict, f).toBe('correct')
      expect(gradeYIntercept(f, ratToString(a.yIntercept)).verdict, f).toBe('correct')
      for (const c of zeroMistakes(f)!) {
        // Her list with this one factor misread.
        const list = a.zeros.map((z) => (ratToString(z.zero) === ratToString(c.zero) ? c.text : z.text)).join(', ')
        expect(mistakeOf(gradeZeros(f, list)), `${f}: ${list}`).toBe(c.kind)
      }
      for (const c of endBehaviorMistakes(f)!) {
        expect(c.end).not.toEqual(a.end)
        expect(mistakeOf(gradeEndBehavior(f, c.end)), f).toBe(c.kind)
      }
      for (const c of yInterceptMistakes(f)!) expect(mistakeOf(gradeYIntercept(f, c.text)), `${f}: ${c.text}`).toBe(c.kind)
    }
  })
})

describe('numbers too large for exact arithmetic', () => {
  it('are reported as unreadable, never thrown', () => {
    const tooLarge = { verdict: 'invalid', reason: 'unreadable', message: 'A number in that answer is too large to check exactly. Look for a typing slip.' }
    expect(gradeZeros(P, '-1, 3, 99999999999')).toMatchObject(tooLarge)
    expect(['invalid', 'wrong']).toContain(gradeYIntercept(P, '9007199254740993').verdict)
    const spec = { zeros: [{ zero: -1, mult: 2 }, { zero: 3 }], point: { x: 0, y: 6 } }
    expect(['invalid', 'wrong']).toContain(gradePolynomialFromZeros(spec, '9007199254740991(x + 1)^2(x - 3)^3').verdict)
    expect(['invalid', 'wrong']).toContain(gradePolynomialFromZeros(spec, '(x + 1)^40').verdict)
  })
})
