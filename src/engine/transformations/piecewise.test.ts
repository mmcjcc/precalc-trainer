import { describe, expect, it } from 'vitest'
import { rat, ratToString } from '@/notation/rational'
import type { Piece } from '@/shared/types'
import { evaluatePiecewise, gradePiecewiseValue, pieceConditionText, piecewiseProblem } from './piecewise'
import type { PiecewisePiece, TransformGrade } from './types'

/** Interval shorthand: iv('-inf', 2, false, false) is (−∞, 2). */
function iv(lo: number | string, hi: number | string, loClosed: boolean, hiClosed: boolean): Piece {
  const end = (v: number | string): Piece['lo'] => (v === '-inf' || v === 'inf' ? v : typeof v === 'number' ? rat(v) : rat(Number(v.split('/')[0]), Number(v.split('/')[1] ?? 1)))
  return { lo: end(lo), hi: end(hi), loClosed, hiClosed }
}

// f(x) = x^2 for x < 2; 2x + 1 for 2 <= x < 5; |x − 8| for x > 5 (undefined at 5).
const F: PiecewisePiece[] = [
  { formula: 'x^2', interval: iv('-inf', 2, false, false) },
  { formula: '2x + 1', interval: iv(2, 5, true, false) },
  { formula: 'abs(x - 8)', interval: iv(5, 'inf', false, false) },
]

// The boundary on the other side: g(x) = x^2 for x <= 2; 2x + 1 for x > 2.
const G: PiecewisePiece[] = [
  { formula: 'x^2', interval: iv('-inf', 2, false, true) },
  { formula: '2x + 1', interval: iv(2, 'inf', false, false) },
]

const verdictOf = (g: TransformGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)

describe('pieceConditionText', () => {
  it.each([
    [iv('-inf', 2, false, false), 'x < 2'],
    [iv('-inf', '-1/2', false, true), 'x <= -1/2'],
    [iv(3, 'inf', true, false), 'x >= 3'],
    [iv(3, 'inf', false, false), 'x > 3'],
    [iv(-1, 3, true, false), '-1 <= x < 3'],
    [iv(4, 4, true, true), 'x = 4'],
    [iv('-inf', 'inf', false, false), 'x in R'],
  ])('%j → %s', (p, text) => {
    expect(pieceConditionText(p)).toBe(text)
  })
})

describe('evaluatePiecewise', () => {
  it('picks the piece whose interval contains x, on both sides of each boundary', () => {
    const at = (x: number | string) => {
      const v = evaluatePiecewise(F, x)
      return v && (v.defined ? `${v.pieceIndex}:${v.text}` : 'undefined')
    }
    expect([at(-3), at(1.9), at(2), at('9/4'), at(4.5), at(5), at('5.5'), at(8), at(100)]).toEqual([
      '0:9',
      '0:361/100',
      '1:5',
      '1:11/2',
      '1:10',
      'undefined',
      '2:5/2',
      '2:0',
      '2:92',
    ])
    expect(evaluatePiecewise(G, 2)).toMatchObject({ defined: true, pieceIndex: 0, text: '4', condition: 'x <= 2', substitution: '2^2' })
    expect(evaluatePiecewise(G, 2.5)).toMatchObject({ defined: true, pieceIndex: 1, text: '6' })
  })

  it('explains the choice', () => {
    expect(evaluatePiecewise(F, 2)).toEqual({
      defined: true,
      pieceIndex: 1,
      value: rat(5),
      text: '5',
      condition: '2 <= x < 5',
      substitution: '2(2) + 1',
      steps: ['x = 2 satisfies 2 ≤ x < 5, so use 2x + 1.', 'f(2) = 2(2) + 1 = 5.'],
    })
    expect(evaluatePiecewise(F, 5)).toEqual({
      defined: false,
      steps: ['No piece includes x = 5: the pieces are for x < 2, 2 ≤ x < 5 and x > 5.', 'So f(5) is undefined.'],
    })
  })

  it('returns null for invalid pieces, unreadable x, or a non-rational value', () => {
    expect(evaluatePiecewise([{ formula: 'x^2', interval: iv(0, 3, true, true) }, { formula: 'x', interval: iv(3, 5, true, false) }], 1)).toBeNull()
    expect(piecewiseProblem([{ formula: 'x^2', interval: iv(0, 3, true, true) }, { formula: 'x', interval: iv(3, 5, true, false) }])).toBe('pieces 1 and 2 overlap')
    expect(piecewiseProblem([{ formula: 'x^', interval: iv(0, 3, true, true) }])).toMatch(/^piece 1: "x\^" does not parse/)
    expect(piecewiseProblem([{ formula: 'x', interval: iv(3, 3, false, true) }])).toBe('piece 1: its interval is empty')
    expect(piecewiseProblem([])).toBe('a piecewise function needs at least one piece')
    expect(evaluatePiecewise(F, 'two')).toBeNull()
    expect(evaluatePiecewise([{ formula: 'sqrt(x)', interval: iv(0, 'inf', true, false) }], 2)).toBeNull()
    expect(evaluatePiecewise([{ formula: 'sqrt(x)', interval: iv(0, 'inf', true, false) }], 4)).toMatchObject({ defined: true, text: '2' })
  })
})

describe('gradePiecewiseValue', () => {
  it('accepts the exact value in any form, and "undefined" where no piece applies', () => {
    for (const a of ['5', '10/2', '5.0', '2(2) + 1']) expect(gradePiecewiseValue(F, 2, a)).toEqual({ verdict: 'correct', message: 'Correct: x = 2 satisfies 2 ≤ x < 5, so use 2x + 1. f(2) = 2(2) + 1 = 5.' })
    for (const a of ['undefined', 'DNE', 'none']) {
      expect(gradePiecewiseValue(F, 5, a)).toEqual({ verdict: 'correct', message: 'Correct: no piece includes x = 5: the pieces are for x < 2, 2 ≤ x < 5 and x > 5. So f(5) is undefined.' })
    }
  })

  it('piecewise_boundary: the boundary belongs to the other side (≥ on the right piece)', () => {
    expect(gradePiecewiseValue(F, 2, '4')).toEqual({
      verdict: 'mistake',
      mistake: 'piecewise_boundary',
      witness: 'At x = 2 two pieces meet: x < 2 leaves 2 out (< does not include the endpoint), and 2 ≤ x < 5 includes it. So f(2) = 2(2) + 1 = 5. Your answer, 4, comes from x^2, the piece that leaves 2 out.',
    })
  })

  it('piecewise_boundary: the boundary belongs to the left piece (≤), she used the right one', () => {
    expect(gradePiecewiseValue(G, 2, '5')).toEqual({
      verdict: 'mistake',
      mistake: 'piecewise_boundary',
      witness: 'At x = 2 two pieces meet: x > 2 leaves 2 out (> does not include the endpoint), and x ≤ 2 includes it. So f(2) = 2^2 = 4. Your answer, 5, comes from 2x + 1, the piece that leaves 2 out.',
    })
    // Just off the boundary, on either side, the right piece is plain.
    expect(verdictOf(gradePiecewiseValue(G, 2.5, '6'))).toBe('correct')
    expect(verdictOf(gradePiecewiseValue(G, 1.5, '9/4'))).toBe('correct')
    expect(verdictOf(gradePiecewiseValue(G, 1.5, '4'))).toBe('piecewise_wrong_piece')
  })

  it('piecewise_wrong_piece: a formula whose interval does not contain x', () => {
    expect(gradePiecewiseValue(F, 3, '9')).toEqual({
      verdict: 'mistake',
      mistake: 'piecewise_wrong_piece',
      witness: 'x = 3 is not in x < 2, so x^2 does not apply there. 3 satisfies 2 ≤ x < 5: f(3) = 2(3) + 1 = 7. Your answer, 9, comes from x^2.',
    })
    expect(verdictOf(gradePiecewiseValue(F, 7, '15'))).toBe('piecewise_wrong_piece')
  })

  it('piecewise_value_where_undefined: a value at a point no piece includes', () => {
    expect(gradePiecewiseValue(F, 5, '11')).toEqual({
      verdict: 'mistake',
      mistake: 'piecewise_value_where_undefined',
      witness:
        'No piece includes x = 5: the pieces are for x < 2, 2 ≤ x < 5 and x > 5. So f(5) is undefined. 2x + 1 would give 11 at x = 5, but 2 ≤ x < 5 leaves 5 out (< does not include the endpoint).',
    })
    expect(gradePiecewiseValue(F, 5, '3')).toMatchObject({ mistake: 'piecewise_value_where_undefined' })
    expect(gradePiecewiseValue(F, 5, '0')).toEqual({
      verdict: 'mistake',
      mistake: 'piecewise_value_where_undefined',
      witness: 'No piece includes x = 5: the pieces are for x < 2, 2 ≤ x < 5 and x > 5. So f(5) is undefined.',
    })
  })

  it('piecewise_undefined_where_defined: "undefined" where a piece applies', () => {
    expect(gradePiecewiseValue(F, 1, 'DNE')).toEqual({
      verdict: 'mistake',
      mistake: 'piecewise_undefined_where_defined',
      witness: 'x = 1 is in the piece for x < 2, so f(1) is defined: f(1) = 1^2 = 1.',
    })
  })

  it('a plain wrong value, an unreadable answer, and an invalid function', () => {
    expect(gradePiecewiseValue(F, 7, '2')).toEqual({ verdict: 'wrong', message: 'x = 7 satisfies x > 5, so use abs(x − 8): f(7) = abs(7 − 8) = 1, not 2.' })
    expect(gradePiecewiseValue(F, 2, '5x')).toMatchObject({ verdict: 'invalid' })
    expect(gradePiecewiseValue(F, 2, '1/0')).toMatchObject({ verdict: 'invalid' })
    expect(gradePiecewiseValue([{ formula: 'x', interval: iv(0, 2, true, true) }, { formula: '1', interval: iv(2, 3, true, true) }], 2, '2').verdict).toBe('unsupported')
  })

  it('never names a mistake on the right answer, at and around every boundary', () => {
    for (const pieces of [F, G]) {
      for (const x of [-2, 1.5, 2, 2.5, 4.99, 5, 5.01, 8]) {
        const v = evaluatePiecewise(pieces, x)!
        const right = v.defined ? ratToString(v.value) : 'undefined'
        expect(gradePiecewiseValue(pieces, x, right).verdict).toBe('correct')
      }
    }
  })
})
