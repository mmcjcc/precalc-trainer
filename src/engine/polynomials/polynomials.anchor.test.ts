/**
 * Anchors worked by hand, separately from the core and its own tests: the answers a precalculus
 * text prints for Unit 2. If the core drifts, these fail without help from its own tables.
 */
import { describe, expect, it } from 'vitest'
import {
  analyzeFactored,
  checkSquareLine,
  completeSquare,
  gradeBottomRow,
  gradeCoefficientRow,
  gradeRationalZeros,
  gradeRemainder,
  gradeRootCandidates,
  gradeZeros,
  gradeEndBehavior,
  gradePolynomialFromZeros,
  gradeVertexForm,
  polynomialFromZeros,
  rationalRootCandidates,
  syntheticDivision,
} from '@/engine'
import { ratToString } from '@/notation/rational'

describe('completing the square', () => {
  it.each([
    ['x^2 - 6x + 13', '(x - 3)^2 + 4', '(3, 4)', 'up'],
    ['2x^2 - 12x + 13', '2(x - 3)^2 - 5', '(3, -5)', 'up'],
    ['-x^2 - 6x + 13', '-(x + 3)^2 + 22', '(-3, 22)', 'down'],
    ['x^2 + 8x + 7', '(x + 4)^2 - 9', '(-4, -9)', 'up'],
    ['-2x^2 + 4x + 1', '-2(x - 1)^2 + 3', '(1, 3)', 'down'],
    ['3x^2 + 5x', '3(x + 5/6)^2 - 25/12', '(-5/6, -25/12)', 'up'],
  ])('%s is %s', (f, vertexForm, vertex, opens) => {
    const m = completeSquare(f)!
    expect(m.vertexForm).toBe(vertexForm)
    expect(m.vertexText).toBe(vertex)
    expect(m.opens).toBe(opens)
    expect(gradeVertexForm(f, vertexForm).verdict).toBe('correct')
  })

  it('names the constant that was not scaled by a', () => {
    // 2(x^2 - 6x + 9) adds 18, not 9: 13 - 9 = 4 is the slip.
    const g = gradeVertexForm('2x^2 - 12x + 13', '2(x - 3)^2 + 4')
    expect(g.verdict === 'mistake' && g.mistake).toBe('cs_constant_not_scaled')
  })
})

describe('synthetic division', () => {
  it.each([
    ['x^3 - 6x^2 + 11x - 6', 1, ['1', '-5', '6', '0'], 'x^2 - 5x + 6', true],
    ['x^4 - 16', -2, ['1', '-2', '4', '-8', '0'], 'x^3 - 2x^2 + 4x - 8', true],
    ['3x^3 + 4x^2 - 5x + 2', -2, ['3', '-2', '-1', '4'], '3x^2 - 2x - 1', false],
    ['2x^3 - 3x^2 - 5', 2, ['2', '1', '2', '-1'], '2x^2 + x + 2', false],
  ])('%s by c = %i', (f, c, bottom, quotient, isFactor) => {
    const t = syntheticDivision(f, c)!
    expect(t.rows.bottom).toEqual(bottom)
    expect(t.quotientText).toBe(quotient)
    expect(t.isFactor).toBe(isFactor)
    expect(gradeBottomRow(f, c, bottom).verdict).toBe('correct')
  })

  it('names the missing placeholder in x^4 - 16', () => {
    // The row 1, -16 with -2 in the box: 1, -18.
    const g = gradeBottomRow('x^4 - 16', -2, '1, -18')
    expect(g.verdict === 'mistake' && g.mistake).toBe('sd_missing_placeholder')
  })
})

describe('zeros, multiplicity and end behavior', () => {
  it('reads -2(x + 1)^2(x - 3)(x - 1/2)^3', () => {
    const a = analyzeFactored('-2(x + 1)^2(x - 3)(x - 1/2)^3')!
    expect(a.degree).toBe(6)
    expect(ratToString(a.leadingCoefficient)).toBe('-2')
    expect(a.zeros.map((z) => [z.text, z.mult, z.behavior])).toEqual([
      ['-1', 2, 'touches'],
      ['1/2', 3, 'crosses'],
      ['3', 1, 'crosses'],
    ])
    // Even degree, negative leading coefficient: both ends fall.
    expect(a.end).toEqual({ left: 'down', right: 'down' })
    // f(0) = -2 · 1 · (-3) · (-1/8)
    expect(ratToString(a.yIntercept)).toBe('-3/4')
  })

  it.each([
    ['(x - 2)(x + 5)^2', 'down', 'up'],
    ['-3x(x - 4)^2', 'up', 'down'],
    ['(x + 1)^2(x - 1)^2', 'up', 'up'],
    ['-(x - 1)^3(x + 2)', 'down', 'down'],
  ])('ends of %s', (f, left, right) => {
    expect(analyzeFactored(f)!.end).toEqual({ left, right })
    expect(gradeEndBehavior(f, { left, right }).verdict).toBe('correct')
  })

  it('builds the polynomial through a point', () => {
    // a(x - 1)(x + 2)^2 with f(0) = 8: -4a = 8, so a = -2.
    const spec = { zeros: [{ zero: 1 }, { zero: -2, mult: 2 }], point: { x: 0, y: 8 } }
    const built = polynomialFromZeros(spec)!
    expect(ratToString(built.a)).toBe('-2')
    expect(built.degree).toBe(3)
    expect(gradePolynomialFromZeros(spec, '-2(x - 1)(x + 2)^2').verdict).toBe('correct')
    // (x - 1)(x^2 + 4x + 4) = x^3 + 3x^2 - 4, times -2.
    expect(gradePolynomialFromZeros(spec, '-2x^3 - 6x^2 + 8').verdict).toBe('correct')
    expect(gradePolynomialFromZeros(spec, '(x - 1)(x + 2)^2').verdict).not.toBe('correct')
  })
})

describe('rational root candidates', () => {
  it('lists and tests the candidates of 3x^3 + x^2 - 12x - 4', () => {
    // (3x + 1)(x - 2)(x + 2)
    const f = '3x^3 + x^2 - 12x - 4'
    const m = rationalRootCandidates(f)!
    expect(m.p).toEqual([1, 2, 4])
    expect(m.q).toEqual([1, 3])
    expect(m.candidates).toHaveLength(12)
    expect(m.zeros.map(ratToString)).toEqual(['-2', '-1/3', '2'])
    expect(gradeRootCandidates(f, '+-1, +-2, +-4, +-1/3, +-2/3, +-4/3').verdict).toBe('correct')
    expect(gradeRationalZeros(f, '2, -2, -1/3').verdict).toBe('correct')
    const inverted = gradeRootCandidates(f, '+-1, +-3, +-1/2, +-3/2, +-1/4, +-3/4')
    expect(inverted.verdict === 'mistake' && inverted.mistake).toBe('rrt_inverted')
  })
})

describe('slips found while the screens were built', () => {
  it('reads "none" with a space after it as a remainder of 0', () => {
    // x^3 - 7x + 6 = (x - 1)(x - 2)(x + 3)
    expect(gradeRemainder('x^3 - 7x + 6', -3, 'none ').verdict).toBe('correct')
    expect(gradeRemainder('x^3 - 7x + 6', -3, ' no remainder').verdict).toBe('correct')
    expect(gradeRemainder('x^3 - 7x + 6', -3, 'snone').verdict).toBe('invalid')
  })

  it('reads a row typed with semicolons', () => {
    expect(gradeCoefficientRow('2x^3 - 3x^2 - 5', '2; -3; 0; -5').verdict).toBe('correct')
    const short = gradeCoefficientRow('2x^3 - 3x^2 - 5', '2; -3; -5')
    expect(short.verdict === 'mistake' && short.mistake).toBe('sd_missing_placeholder')
  })

  it('takes vertex form with y on either side as finished', () => {
    for (const line of ['y = 2(x - 3)^2 - 5', '2(x - 3)^2 - 5 = y', '2(x - 3)^2 - 5 = f(x)']) {
      const g = checkSquareLine('2x^2 - 12x + 13', line)
      expect(g.verdict === 'correct' && g.done, line).toBe(true)
    }
    const g = checkSquareLine('2x^2 - 12x + 13', '2(x^2 - 6x) + 13 = y')
    expect(g.verdict === 'correct' && g.done).toBe(false)
  })

  it('words the last step the way the line above it reads when a is negative', () => {
    // -(x^2 + 6x + 9) + 9 + 13
    const reasons = completeSquare('-x^2 - 6x + 13')!.path.map((l) => l.reason)
    expect(reasons[reasons.length - 1]).toBe('Combine the constants: 9 + 13 = 22.')
    const up = completeSquare('2x^2 - 12x + 13')!.path.map((l) => l.reason)
    expect(up[up.length - 1]).toBe('Combine the constants: 13 − 18 = −5.')
  })

  it('never puts example numbers in an empty-answer notice', () => {
    const notices = [
      gradeRootCandidates('2x^3 - 5x^2 - 4x + 3', ''),
      gradeRationalZeros('2x^3 - 5x^2 - 4x + 3', ''),
      gradeZeros('-2(x + 1)^2(x - 3)', [{ zero: '' }]),
      gradeCoefficientRow('2x^3 - 3x^2 - 5', ''),
    ]
    for (const g of notices) {
      expect(g.verdict).toBe('invalid')
      expect(g.verdict === 'invalid' && g.message).not.toMatch(/\d/)
    }
  })
})
