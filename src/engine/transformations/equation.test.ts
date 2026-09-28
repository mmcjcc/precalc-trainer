import { describe, expect, it } from 'vitest'
import { equationMistakes, gradeEquation, isSameFunction } from './equation'
import { explicitFormula, makeTransform, PARENT_NAMES } from './spec'
import type { TransformGrade, TransformSpec } from './types'

const verdictOf = (g: TransformGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)

const parabola = makeTransform('square', { a: -2, h: 3, k: 1 }) // -2(x - 3)^2 + 1
const root = makeTransform('sqrt', { a: -1, b: 2, h: 3, k: 1 }) // -sqrt(2(x - 3)) + 1

describe('gradeEquation — equivalent forms are correct', () => {
  it.each([
    [parabola, '-2(x - 3)^2 + 1'],
    [parabola, 'g(x) = -2(x-3)^2+1'],
    [parabola, 'y = 1 - 2(x - 3)^2'],
    [parabola, '-2x^2 + 12x - 17'],
    [parabola, '-2(3 - x)^2 + 1'],
    [parabola, '-2(x^2 - 6x + 9) + 1'],
    [parabola, '1 - 2(x - 3)(x - 3)'],
    [root, '-sqrt(2(x - 3)) + 1'],
    [root, '-sqrt(2x - 6) + 1'],
    [root, '1 - sqrt(2x - 6)'],
    [root, '-sqrt(2)sqrt(x - 3) + 1'],
    [root, '-(2x - 6)^(1/2) + 1'],
    [makeTransform('reciprocal', { a: 3, h: 1, k: 2 }), '(2x + 1)/(x - 1)'],
    [makeTransform('reciprocal', { a: 3, h: 1, k: 2 }), '3/(x - 1) + 2'],
    [makeTransform('reciprocal', { a: '-1/2', h: 3 }), '1/(6 - 2x)'],
    [makeTransform('cbrt', { a: 2, h: 1 }), 'cbrt(8x - 8)'],
    [makeTransform('cbrt', { a: 2, h: 1 }), '2(x - 1)^(1/3)'],
    [makeTransform('cube', { a: -1, h: 3 }), '(-(x - 3))^3'],
    [makeTransform('cube', { a: -1, h: 3 }), '(3 - x)^3'],
    [makeTransform('abs', { a: 2, b: -1, h: 3 }), 'abs(2x - 6)'],
    [makeTransform('abs', { a: 2, b: -1, h: 3 }), '2|3 - x|'],
    [makeTransform('square', { a: '1/2', k: '-3/4' }), '0.5x^2 - 0.75'],
    [makeTransform('sqrt', { b: -1, h: -2 }), 'sqrt(-x - 2)'],
  ])('%#: %s', (spec, answer) => {
    expect(gradeEquation(spec as TransformSpec, answer)).toEqual({ verdict: 'correct', message: `Correct: g(x) = ${explicitFormula(spec as TransformSpec).replace(/-/g, '−')}.` })
    expect(isSameFunction(spec as TransformSpec, answer)).toBe(true)
  })
})

describe('gradeEquation — a formula on a different domain is not g', () => {
  it('sqrt(3 − x) is not sqrt(x − 3)', () => {
    const g = gradeEquation(makeTransform('sqrt', { h: 3 }), 'sqrt(3 - x)')
    expect(g).toEqual({
      verdict: 'wrong',
      message:
        'Your formula is defined at x = −1 (it gives 2), but g(−1) is undefined: the inside x − 3 is −4 there, and the square root of a negative number is undefined. Check each piece: what is inside f, the number in front of f, and the number added after it.',
    })
    expect(verdictOf(gradeEquation(makeTransform('sqrt', { h: 3 }), 'sqrt(abs(x - 3))'))).toBe('wrong')
    // The other way round it is the missing reflection over the y-axis.
    expect(verdictOf(gradeEquation(makeTransform('sqrt', { b: -1, h: 3 }), 'sqrt(x - 3)'))).toBe('missing_reflection')
  })

  it('a hole or a lost half is caught by the exact domain', () => {
    expect(gradeEquation(makeTransform('reciprocal', { h: 1 }), '(x + 1)/(x^2 - 1)')).toEqual({
      verdict: 'wrong',
      message: 'At x = −1, g(−1) = −1/2, but your formula is undefined there. Check each piece: what is inside f, the number in front of f, and the number added after it.',
    })
    expect(verdictOf(gradeEquation(makeTransform('square', { h: 3 }), '(sqrt(x - 3))^4'))).toBe('wrong')
    expect(verdictOf(gradeEquation(makeTransform('abs', { h: 3 }), '(sqrt(x - 3))^2'))).toBe('wrong')
  })

  it('a formula equal only on part of the domain is wrong, with a point', () => {
    expect(gradeEquation(parabola, '(x - 3)^2')).toEqual({
      verdict: 'wrong',
      message: 'At x = 3, g(3) = 1 but your formula gives 0. Check each piece: what is inside f, the number in front of f, and the number added after it.',
    })
  })
})

describe('gradeEquation — each named mistake', () => {
  it('lists the candidates for a parabola and for a square root', () => {
    expect(equationMistakes(parabola)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['h_shift_reversed', '-2(x + 3)^2 + 1', []],
      ['v_shift_reversed', '-2(x - 3)^2 - 1', []],
      ['missing_reflection', '2(x - 3)^2 + 1', ['reflection_wrong_axis']],
      ['v_factor_inverted', '-(1/2)(x - 3)^2 + 1', []],
      ['v_factor_inside', '(-2(x - 3))^2 + 1', []],
      ['v_shift_inside', '-2(x - 2)^2', []],
    ])
    expect(equationMistakes(root)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['h_shift_reversed', '-sqrt(2(x + 3)) + 1', []],
      ['v_shift_reversed', '-sqrt(2(x - 3)) - 1', []],
      ['unfactored_shift', '-sqrt(2x - 3) + 1', []],
      ['unfactored_shift', '-sqrt(2(x - 6)) + 1', []],
      ['missing_reflection', 'sqrt(2(x - 3)) + 1', []],
      ['reflection_wrong_axis', 'sqrt(-2(x - 3)) + 1', ['v_factor_inside']],
      ['h_factor_inverted', '-sqrt((1/2)(x - 3)) + 1', []],
      ['v_shift_inside', '-sqrt(2(x - 5/2))', []],
    ])
  })

  it.each([
    [parabola, '-2(x + 3)^2 + 1', 'h_shift_reversed', 'g shifts right 3, so x − 3 goes inside f: −2(x − 3)^2 + 1. Your formula has x + 3, a shift left 3: its vertex is (−3, 1), not (3, 1).'],
    [parabola, '-2x^2 - 12x - 17', 'h_shift_reversed', null],
    [parabola, '-2(x - 3)^2 - 1', 'v_shift_reversed', 'g shifts up 1, so + 1 goes after f: −2(x − 3)^2 + 1. Your formula has − 1: its vertex is (3, −1), not (3, 1).'],
    [
      parabola,
      '2(x - 3)^2 + 1',
      'missing_reflection',
      'g is reflected over the x-axis, so the minus sign goes in front of f: −2(x − 3)^2 + 1. Your formula is not reflected: at x = 4, g(4) = −1 but your formula gives 3. (For f(x) = x^2 a minus sign inside the parentheses changes nothing: f(−u) = f(u).)',
    ],
    [parabola, '2(-(x - 3))^2 + 1', 'missing_reflection', null],
    [parabola, '-0.5(x - 3)^2 + 1', 'v_factor_inverted', 'Stretch vertically by a factor of 2 multiplies every output by 2: −2(x − 3)^2 + 1. Your formula multiplies by 1/2: at x = 4, g(4) = −1 but your formula gives 1/2.'],
    [parabola, '(-2(x - 3))^2 + 1', 'v_factor_inside', 'The −2 multiplies the OUTPUT of f, so it goes in front: −2(x − 3)^2 + 1. Inside the parentheses it multiplies x instead, a horizontal change: at x = 4, g(4) = −1 but your formula gives 5.'],
    [parabola, '-2(x - 3 + 1)^2', 'v_shift_inside', 'The + 1 is added to the OUTPUT of f, so it goes after f: −2(x − 3)^2 + 1. Inside f it moves the graph sideways instead: at x = 3, g(3) = 1 but your formula gives −2.'],
    [root, '-sqrt(2x - 3) + 1', 'unfactored_shift', 'The shift right 3 applies to x itself: x becomes x − 3, so the inside is 2(x − 3) = 2x − 6: −sqrt(2(x − 3)) + 1. Your inside 2x − 3 factors as 2(x − 3/2), a shift right 3/2.'],
    [root, '-sqrt(2(x - 6)) + 1', 'unfactored_shift', 'Factor 2 out of 2x − 6: 2x − 6 = 2(x − 3), so the shift is right 3: −sqrt(2(x − 3)) + 1. Your formula has 2(x − 6), a shift right 6.'],
    [root, 'sqrt(6 - 2x) + 1', 'reflection_wrong_axis', 'A reflection over the x-axis changes the sign of the OUTPUT, so the minus sign goes in front of f: −sqrt(2(x − 3)) + 1. Your formula puts it on x inside f, which reflects over the y-axis: at x = 5, g(5) = −1, but your formula is undefined there.'],
    [root, 'sqrt(2x - 6) + 1', 'missing_reflection', 'g is reflected over the x-axis, so the minus sign goes in front of f: −sqrt(2(x − 3)) + 1. Your formula is not reflected: at x = 5, g(5) = −1 but your formula gives 3.'],
    [root, '-sqrt((x - 3)/2) + 1', 'h_factor_inverted', 'Compress horizontally by a factor of 1/2 multiplies every x-value by 1/2, so x is replaced by 2x inside f: −sqrt(2(x − 3)) + 1. Your formula has (1/2)x, which would stretch horizontally by a factor of 2 instead.'],
    [root, '-sqrt(2(x - 3) + 1)', 'v_shift_inside', null],
    [root, '-sqrt(2(x + 3)) + 1', 'h_shift_reversed', 'g shifts right 3, so x − 3 goes inside f: −sqrt(2(x − 3)) + 1. Your formula has x + 3, a shift left 3: its start point is (−3, 1), not (3, 1).'],
    [makeTransform('reciprocal', { a: 3, h: 1, k: 2 }), '3/(x + 1) + 2', 'h_shift_reversed', 'g shifts right 1, so x − 1 goes inside f: 3/(x − 1) + 2. Your formula has x + 1, a shift left 1: its vertical asymptote is x = −1, not x = 1.'],
    [makeTransform('reciprocal', { a: 3, h: 1, k: 2 }), '(3 - 2x + 2)/(x - 1)', 'v_shift_reversed', 'g shifts up 2, so + 2 goes after f: 3/(x − 1) + 2. Your formula has − 2: its horizontal asymptote is y = −2, not y = 2.'],
    [makeTransform('sqrt', { b: -1, h: -2 }), 'sqrt(x + 2)', 'missing_reflection', 'g is reflected over the y-axis, so x is multiplied by −1 inside f: sqrt(−(x + 2)). Your formula is not reflected: at x = −1 your formula gives 1, but g(−1) is undefined: the inside −(x + 2) is −1 there, and the square root of a negative number is undefined.'],
    [makeTransform('sqrt', { b: -1, h: -2 }), '-sqrt(x + 2)', 'reflection_wrong_axis', null],
  ])('%#: %s → %s', (spec, answer, kind, witness) => {
    const g = gradeEquation(spec as TransformSpec, answer)
    expect(verdictOf(g), answer).toBe(kind)
    if (witness) expect(g.verdict === 'mistake' && g.witness).toBe(witness)
  })

  it('every candidate grades as its own kind and never on the right answer, all parents', () => {
    for (const parent of PARENT_NAMES) {
      for (const spec of [makeTransform(parent, { a: -2, b: 2, h: 3, k: 1 }), makeTransform(parent, { a: '1/2', b: '-1/3', h: -2, k: -5 })]) {
        for (const form of ['factored', 'unfactored'] as const) {
          expect(gradeEquation(spec, explicitFormula(spec, form)).verdict).toBe('correct')
          const cands = equationMistakes(spec, { form })!
          for (const c of cands) {
            const g = gradeEquation(spec, c.text, { form })
            expect(g, `${parent}: ${c.text}`).toEqual({ verdict: 'mistake', mistake: c.kind, witness: c.witness })
          }
        }
      }
    }
  }, 120_000)

  it('an odd parent written with the minus inside is the same function, not a wrong axis', () => {
    const s = makeTransform('cbrt', { a: -1, h: 2 })
    expect(gradeEquation(s, 'cbrt(-(x - 2))').verdict).toBe('correct')
    expect(equationMistakes(s)!.map((c) => c.kind)).not.toContain('reflection_wrong_axis')
  })
})

describe('gradeEquation — unreadable answers and problems', () => {
  it.each([
    ['', 'Type the formula for g(x) first.', 0],
    ['-2f(x - 3) + 1', "Write g(x) as a formula in x, with f's formula in place of f: f(x) = x^2, so f(x − 3) is (x − 3)^2.", 2],
    ['g(x) = -2(x - 3)^2 + ', 'That side ends too early — something is missing after the last operator.', 18],
    ['y = 3z', 'Unknown letter "z" — this problem uses only x.', 5],
  ])('%j', (answer, message, position) => {
    const g = gradeEquation(parabola, answer)
    expect(g.verdict).toBe('invalid')
    expect(g.verdict === 'invalid' && [g.message, g.position]).toEqual([message, position])
  })

  it('an invalid spec is unsupported', () => {
    expect(gradeEquation({ ...parabola, a: { n: 0, d: 1 } }, 'x^2').verdict).toBe('unsupported')
    expect(equationMistakes({ ...parabola, b: { n: 0, d: 1 } })).toBeNull()
  })
})
