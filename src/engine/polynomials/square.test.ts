import { describe, expect, it } from 'vitest'
import { ratToString } from '@/notation/rational'
import { verifyRewrite } from '../expressions'
import { polyEquals, polyOf } from '../functions/poly'
import { parseExpression } from '../parse'
import {
  axisMistakes,
  checkSquareLine,
  completeSquare,
  gradeAxisOfSymmetry,
  gradeVertex,
  gradeVertexForm,
  isVertexForm,
  squareMistakes,
  vertexMistakes,
} from './square'
import type { PolyGrade, SquareLineGrade } from './types'

const F = '2x^2 - 12x + 13'

function poly(text: string) {
  const p = parseExpression(text, ['x'])
  if (!p.ok) throw new Error(`does not parse: ${text}`)
  const out = polyOf(p.node)
  if (!out) throw new Error(`not a polynomial: ${text}`)
  return out
}

function mistakeOf(g: PolyGrade | SquareLineGrade): string | null {
  return g.verdict === 'mistake' ? g.mistake : null
}

describe('completeSquare — the model', () => {
  it('f(x) = 2x^2 − 12x + 13 → 2(x − 3)^2 − 5', () => {
    const m = completeSquare(F)!
    expect(m.f).toBe('2x^2 - 12x + 13')
    expect([m.a, m.b, m.c, m.h, m.k, m.half, m.square].map(ratToString)).toEqual(['2', '-12', '13', '3', '-5', '-3', '9'])
    expect(m.vertexForm).toBe('2(x - 3)^2 - 5')
    expect(m.vertexText).toBe('(3, -5)')
    expect(m.axisText).toBe('x = 3')
    expect(m.opens).toBe('up')
    expect(m.extremum.kind).toBe('minimum')
    expect(ratToString(m.extremum.value)).toBe('-5')
    expect(m.path.map((l) => [l.step, l.text])).toEqual([
      ['start', '2x^2 - 12x + 13'],
      ['factor', '2(x^2 - 6x) + 13'],
      ['add_subtract', '2(x^2 - 6x + 9 - 9) + 13'],
      ['square', '2((x - 3)^2 - 9) + 13'],
      ['distribute', '2(x - 3)^2 - 18 + 13'],
      ['combine', '2(x - 3)^2 - 5'],
    ])
    expect(m.explanation).toEqual([
      'Factor 2 out of the x-terms only: 2x^2 − 12x = 2(x^2 − 6x). The constant 13 stays outside.',
      'Half of −6 is −3, and (−3)^2 = 9. Add 9 inside the parentheses to make a perfect square, and subtract it again so the value does not change.',
      'x^2 − 6x + 9 is a perfect square: (x − 3)^2.',
      'Multiply the 2 back through: 2·(−9) = −18.',
      'Combine the constants: 13 − 18 = −5.',
      'Vertex form: f(x) = 2(x − 3)^2 − 5.',
      'The vertex is (h, k) = (3, −5) and the axis of symmetry is x = 3. (The sign inside the square is opposite to h.)',
      'a = 2 is positive, so the parabola opens up and −5 is the minimum value.',
    ])
  })

  it('hand-checked vertex forms', () => {
    const cases: [string, string, string, string][] = [
      ['x^2 - 6x + 13', '(x - 3)^2 + 4', '(3, 4)', 'x = 3'],
      ['-x^2 - 6x + 13', '-(x + 3)^2 + 22', '(-3, 22)', 'x = -3'],
      ['(1/2)x^2 - 6x + 13', '(1/2)(x - 6)^2 - 5', '(6, -5)', 'x = 6'],
      ['x^2 + 3x + 1', '(x + 3/2)^2 - 5/4', '(-3/2, -5/4)', 'x = -3/2'],
      ['3x^2 + 5x', '3(x + 5/6)^2 - 25/12', '(-5/6, -25/12)', 'x = -5/6'],
      ['-3x^2 + 2x - 1/2', '-3(x - 1/3)^2 - 1/6', '(1/3, -1/6)', 'x = 1/3'],
      ['x^2 + 4', 'x^2 + 4', '(0, 4)', 'x = 0'],
      ['x^2 + 8x + 16', '(x + 4)^2', '(-4, 0)', 'x = -4'],
      ['f(x) = 4x^2 - 8x', '4(x - 1)^2 - 4', '(1, -4)', 'x = 1'],
      ['(x - 1)(x - 5)', '(x - 3)^2 - 4', '(3, -4)', 'x = 3'],
    ]
    for (const [f, form, vertex, axis] of cases) {
      const m = completeSquare(f)!
      expect([m.vertexForm, m.vertexText, m.axisText], f).toEqual([form, vertex, axis])
    }
    expect(completeSquare([2, -12, 13])!.vertexForm).toBe('2(x - 3)^2 - 5')
    expect(completeSquare(['1/2', -6, 13])!.vertexForm).toBe('(1/2)(x - 6)^2 - 5')
  })

  it('path shapes: a = 1 has no factor or distribute line; a = −1; c = 0; b = 0', () => {
    expect(completeSquare('x^2 - 6x + 13')!.path.map((l) => l.text)).toEqual(['x^2 - 6x + 13', 'x^2 - 6x + 9 - 9 + 13', '(x - 3)^2 - 9 + 13', '(x - 3)^2 + 4'])
    expect(completeSquare('-x^2 - 6x + 13')!.path.map((l) => l.text)).toEqual([
      '-x^2 - 6x + 13',
      '-(x^2 + 6x) + 13',
      '-(x^2 + 6x + 9 - 9) + 13',
      '-((x + 3)^2 - 9) + 13',
      '-(x + 3)^2 + 9 + 13',
      '-(x + 3)^2 + 22',
    ])
    expect(completeSquare('3x^2 + 5x')!.path.map((l) => l.step)).toEqual(['start', 'factor', 'add_subtract', 'square', 'distribute'])
    expect(completeSquare('x^2 + 4')!.path.map((l) => l.text)).toEqual(['x^2 + 4'])
    expect(completeSquare('x^2 + 4')!.explanation[0]).toBe('f(x) = x^2 + 4 is already in vertex form (there is no x term), with h = 0.')
  })

  it('every line of the path equals f exactly, and the step checker accepts each consecutive pair', () => {
    for (const f of [F, 'x^2 - 6x + 13', '-x^2 - 6x + 13', '(1/2)x^2 - 6x + 13', 'x^2 + 3x + 1', '3x^2 + 5x', '-3x^2 + 2x - 1/2', '-2x^2 + 7x', 'x^2 - x - 1']) {
      const m = completeSquare(f)!
      const target = poly(m.f)
      for (const line of m.path) expect(polyEquals(poly(line.text), target), `${f}: ${line.text}`).toBe(true)
      for (let i = 1; i < m.path.length; i++) {
        const r = verifyRewrite(m.path[i - 1]!.text, m.path[i]!.text, { vars: ['x'], seed: 7 })
        expect(r.ok, `${f}: ${m.path[i - 1]!.text} → ${m.path[i]!.text}`).toBe(true)
      }
      expect(isVertexForm(m.path[m.path.length - 1]!.text), m.vertexForm).toBe(true)
      for (const line of m.path.slice(0, -1)) expect(isVertexForm(line.text), line.text).toBe(false)
    }
  })

  it('is null outside the model', () => {
    for (const f of ['x^3 - 1', '3x + 1', '5', 'sqrt(x)', '1/x', 'x^2 +', '']) expect(completeSquare(f), f).toBeNull()
    expect(gradeVertexForm('x^3 - 1', 'x^3 - 1').verdict).toBe('unsupported')
    expect(gradeVertex('3x + 1', '(0, 1)').verdict).toBe('unsupported')
    expect(checkSquareLine('1/x', '1/x').verdict).toBe('unsupported')
  })
})

describe('isVertexForm', () => {
  it('accepts a(x − h)^2 + k in its written variants', () => {
    for (const t of ['2(x - 3)^2 - 5', '-5 + 2(x - 3)^2', '(x + 1)^2', 'x^2 + 4', '-(x + 3)^2 + 22', '(1/2)(x - 6)^2 - 5', '(x - 6)^2/2 - 5', '2*(x-3)^2-5', 'y = 2(x - 3)^2 - 5', '(x + 3/2)^2 - 5/4', '-3x^2', '2(x - 3)^2 - 10/2']) {
      expect(isVertexForm(t), t).toBe(true)
    }
  })
  it('rejects everything else', () => {
    for (const t of ['2x^2 - 12x + 13', '2(x - 3)^2 - 18 + 13', '2((x - 3)^2 - 9) + 13', '(2x - 6)^2/2 - 5', '2(x - 3)(x - 3) - 5', '2(3 - x)^2 - 5', '(x - 3)^2 + x', '2(x - 3)^3 - 5', '5', '2(x - 3)^2 - ']) {
      expect(isVertexForm(t), t).toBe(false)
    }
  })
})

describe('gradeVertexForm', () => {
  it('accepts any vertex form of f', () => {
    for (const a of ['2(x - 3)^2 - 5', '-5 + 2(x - 3)^2', 'f(x) = 2(x-3)^2-5', 'y = 2*(x - 3)^2 - 5', '2(x − 3)^2 − 5', '2(x - 3)^2 + -5']) {
      const g = gradeVertexForm(F, a)
      expect(g.verdict, a).toBe('correct')
      if (g.verdict === 'correct') {
        expect(g.message).toBe('Correct: f(x) = 2(x − 3)^2 − 5.')
        expect(g.explanation.length).toBe(8)
      }
    }
    expect(gradeVertexForm('x^2 + 3x + 1', '(x + 1.5)^2 - 1.25').verdict).toBe('correct')
    expect(gradeVertexForm('x^2 + 4', 'x^2 + 4').verdict).toBe('correct')
  })

  it('a formula equal to f that is not vertex form is not an attempt', () => {
    for (const a of ['2x^2 - 12x + 13', '2(x^2 - 6x) + 13', '2(x - 3)^2 - 18 + 13', '(2x - 6)^2/2 - 5']) {
      const g = gradeVertexForm(F, a)
      expect(g.verdict === 'invalid' && g.reason, a).toBe('not_in_form')
    }
  })

  it('names each slip (sample f = 2x^2 − 12x + 13)', () => {
    const cases: [string, string][] = [
      ['2(x + 3)^2 - 5', 'cs_h_sign'],
      ['2(x - 3)^2 + 13', 'cs_unbalanced'],
      ['2(x - 3)^2 + 31', 'cs_unbalanced'],
      ['2(x - 3)^2 + 4', 'cs_constant_not_scaled'],
      ['2(x - 6)^2 - 23', 'cs_no_factor_a'],
      ['2(x - 6)^2 - 59', 'cs_no_factor_a'],
      ['(x - 6)^2 - 23', 'cs_no_factor_a'],
      ['2(x - 3)^2 - 23', 'cs_half_or_square'],
      ['2(x - 6)^2 - 5', 'cs_half_or_square'],
    ]
    for (const [a, kind] of cases) expect(mistakeOf(gradeVertexForm(F, a)), a).toBe(kind)
    expect(squareMistakes(F)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['cs_h_sign', '2(x + 3)^2 - 5', []],
      ['cs_unbalanced', '2(x - 3)^2 + 13', []],
      ['cs_unbalanced', '2(x - 3)^2 + 31', []],
      ['cs_constant_not_scaled', '2(x - 3)^2 + 4', []],
      ['cs_no_factor_a', '2(x - 6)^2 - 23', []],
      ['cs_no_factor_a', '2(x - 6)^2 - 59', ['cs_half_or_square']],
      ['cs_no_factor_a', '(x - 6)^2 - 23', []],
      ['cs_half_or_square', '2(x - 3)^2 - 23', []],
      ['cs_half_or_square', '2(x - 6)^2 - 5', []],
    ])
  })

  it('witness sentences are about her numbers', () => {
    const w = (a: string) => {
      const g = gradeVertexForm(F, a)
      return g.verdict === 'mistake' ? g.witness : g.verdict
    }
    expect(w('2(x - 3)^2 + 13')).toBe(
      'Adding 9 inside the parentheses makes the perfect square (x − 3)^2, but it also changes the value: inside 2( ) it is worth 2·9 = 18. Take that away again: the constant is 13 − 18 = −5, not 13.',
    )
    expect(w('2(x - 3)^2 + 4')).toBe(
      'The 9 you added sits inside 2( ), so it is worth 2·9 = 18. Taking it out of the parentheses changes the constant by 18, not by 9: 13 − 18 = −5, not 13 − 9 = 4.',
    )
    expect(w('2(x - 6)^2 - 23')).toBe(
      'Factor 2 out of the x-terms BEFORE halving: 2x^2 − 12x = 2(x^2 − 6x), and half of −6 is −3. You halved −12 instead (−6), which leads to 2(x − 6)^2 − 23. The vertex form is 2(x − 3)^2 − 5.',
    )
    expect(w('2(x - 3)^2 - 23')).toBe('Halve first, then square: half of −6 is −3, and (−3)^2 = 9. You used (−6)^2/2 = 18, which gives the constant −23 instead of −5.')
    expect(w('2(x + 3)^2 - 5')).toBe(
      'x^2 − 6x + 9 = (x − 3)^2: the sign inside the square is the sign of the x-term (half of −6 is −3). (x + 3)^2 multiplies out to x^2 + 6x + 9, which has the wrong middle term.',
    )
    // a = 1: no parentheses to speak of.
    const g = gradeVertexForm('x^2 - 6x + 13', '(x - 3)^2 + 13')
    expect(g.verdict === 'mistake' && g.witness).toBe('Adding 9 makes the perfect square (x − 3)^2, but it also changes the value. Take it away again: the constant is 13 − 9 = 4, not 13.')
    // a < 0: the value added is negative.
    const n = gradeVertexForm('-x^2 - 6x + 13', '-(x + 3)^2 + 13')
    expect(n.verdict === 'mistake' && n.witness).toBe(
      'Adding 9 inside the parentheses makes the perfect square (x + 3)^2, but it also changes the value: inside −( ) it is worth (−1)·9 = −9. Take that away again: the constant is 13 − (−9) = 22, not 13.',
    )
  })

  it('other wrong answers get the exact comparison', () => {
    const g = gradeVertexForm(F, '2(x - 3)^2 - 7')
    expect(g).toMatchObject({
      verdict: 'wrong',
      message:
        'Multiply your answer back out: it gives 2x^2 − 12x + 11, but f(x) = 2x^2 − 12x + 13. The x^2 and x terms match, so the square is right. Multiplied out, the constants differ (yours is 11, f has 13): k = 13 − 18 = −5.',
    })
    expect(gradeVertexForm(F, '3(x - 3)^2 - 5')).toMatchObject({ verdict: 'wrong' })
    const x = gradeVertexForm(F, '2(x - 2)^2 - 5')
    expect(x.verdict === 'wrong' && x.message).toContain('The x terms differ (yours has −8, f has −12): the number inside the square is half of −6, which is −3.')
    const d = gradeVertexForm(F, '2(x - 3)^3 - 5')
    expect(d.verdict === 'wrong' && d.message).toContain('Yours has degree 3; f(x) has degree 2.')
  })

  it('unreadable answers are invalid, with a position', () => {
    expect(gradeVertexForm(F, '')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeVertexForm(F, '2(x - 3^2 - 5')).toMatchObject({ verdict: 'invalid', reason: 'unreadable', position: 10 })
    expect(gradeVertexForm(F, '2(t - 3)^2 - 5')).toMatchObject({ verdict: 'invalid', position: 2 })
    expect(gradeVertexForm(F, '2/(x - 3)^2 - 5')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeVertexForm(F, 'y =')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('gradeVertex', () => {
  it('reads the point exactly', () => {
    for (const a of ['(3, -5)', '3, -5', '( 3 , −5 )', '(6/2, -10/2)', '(3.0, -5)']) expect(gradeVertex(F, a).verdict, a).toBe('correct')
    expect(gradeVertex('x^2 + 3x + 1', '(-1.5, -1.25)').verdict).toBe('correct')
    expect(gradeVertex('x^2 + 3x + 1', '(-3/2, -5/4)').verdict).toBe('correct')
  })

  it('names the slips', () => {
    const cases: [string, string][] = [
      ['(-3, -5)', 'cs_h_sign'],
      ['(-5, 3)', 'cs_vertex_swapped'],
      ['(3, 13)', 'cs_unbalanced'],
      ['(3, 4)', 'cs_constant_not_scaled'],
      ['(6, -23)', 'cs_no_factor_a'],
      ['(3, -23)', 'cs_half_or_square'],
      ['(6, -5)', 'cs_half_or_square'],
    ]
    for (const [a, kind] of cases) expect(mistakeOf(gradeVertex(F, a)), a).toBe(kind)
    const g = gradeVertex(F, '(-3, -5)')
    expect(g.verdict === 'mistake' && g.witness).toBe(
      'In a(x − h)^2 + k the sign inside the square is opposite to h: 2(x − 3)^2 − 5 has the square (x − 3)^2, which is 0 at x = 3. So h = 3 and the vertex is (3, −5), not (−3, −5).',
    )
    const s = gradeVertex(F, '(-5, 3)')
    expect(s.verdict === 'mistake' && s.witness).toBe(
      'The vertex is (h, k): x-coordinate first. h = 3 comes from the square (x − 3)^2 and k = −5 is the constant added after it, so the vertex is (3, −5); (−5, 3) has them the other way round.',
    )
    expect(vertexMistakes(F)!.slice(0, 2).map((c) => [c.kind, c.text])).toEqual([
      ['cs_h_sign', '(-3, -5)'],
      ['cs_vertex_swapped', '(-5, 3)'],
    ])
  })

  it('a vertex on the line y = x or the y-axis drops the candidates that would equal the right answer', () => {
    // x^2 - 4x + 6 = (x - 2)^2 + 2: (k, h) is the vertex itself.
    expect(vertexMistakes('x^2 - 4x + 6')!.some((c) => c.kind === 'cs_vertex_swapped')).toBe(false)
    expect(gradeVertex('x^2 - 4x + 6', '(2, 2)').verdict).toBe('correct')
    // x^2 + 4: h = 0, so there is no sign to flip.
    expect(vertexMistakes('x^2 + 4')!.some((c) => c.kind === 'cs_h_sign')).toBe(false)
  })

  it('plain messages say which coordinate is right', () => {
    expect(gradeVertex(F, '(3, 1)')).toMatchObject({ verdict: 'wrong', message: 'Your x-coordinate 3 is right. The y-coordinate is the value of f there: f(3) = −5 (the k of 2(x − 3)^2 − 5).' })
    expect(gradeVertex(F, '(2, -5)')).toMatchObject({ verdict: 'wrong', message: 'Your y-coordinate −5 is right. The x-coordinate is h = −b/(2a) = 12/4 = 3.' })
    expect(gradeVertex(F, '(1, 1)')).toMatchObject({ verdict: 'wrong' })
    expect(gradeVertex(F, '(sqrt(2), -5)')).toMatchObject({ verdict: 'wrong' })
  })

  it('unreadable points are invalid', () => {
    expect(gradeVertex(F, '(3; -5)')).toMatchObject({ verdict: 'invalid', position: 2 })
    expect(gradeVertex(F, '3')).toMatchObject({ verdict: 'invalid' })
    expect(gradeVertex(F, '(3, -5, 1)')).toMatchObject({ verdict: 'invalid' })
    expect(gradeVertex(F, '(x, -5)')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('gradeAxisOfSymmetry', () => {
  it('accepts x = h in any spelling', () => {
    for (const a of ['x = 3', '3', 'x=3', 'x = 6/2', 'X = 3']) expect(gradeAxisOfSymmetry(F, a).verdict, a).toBe('correct')
    expect(gradeAxisOfSymmetry('x^2 + 3x + 1', 'x = -1.5').verdict).toBe('correct')
  })
  it('names the slips', () => {
    expect(mistakeOf(gradeAxisOfSymmetry(F, 'x = -3'))).toBe('cs_h_sign')
    expect(mistakeOf(gradeAxisOfSymmetry(F, '6'))).toBe('cs_no_factor_a')
    expect(axisMistakes(F)!.map((c) => [c.kind, c.text, c.shadows])).toEqual([
      ['cs_h_sign', '-3', []],
      ['cs_no_factor_a', '6', ['cs_half_or_square']],
    ])
    // 3x^2 - 12x + 1: −b/2 = 6, −b/a = 4, the axis is x = 2.
    expect(axisMistakes('3x^2 - 12x + 1')!.map((c) => [c.kind, c.text])).toEqual([
      ['cs_h_sign', '-2'],
      ['cs_no_factor_a', '6'],
      ['cs_half_or_square', '4'],
    ])
    const g = gradeAxisOfSymmetry('3x^2 - 12x + 1', 'x = 4')
    expect(g.verdict === 'mistake' && g.witness).toBe('Do not forget the 2 in 2a: x = −b/(2a) = 12/6 = 2. Your 4 is −b/a.')
  })
  it('a horizontal line is not an attempt; k gets its own sentence', () => {
    expect(gradeAxisOfSymmetry(F, 'y = 3')).toMatchObject({ verdict: 'invalid', position: 0 })
    const g = gradeAxisOfSymmetry(F, '-5')
    expect(g.verdict === 'wrong' && g.message).toBe('−5 is k, the y-coordinate of the vertex. The axis of symmetry is the vertical line through the vertex, x = h: x = −b/(2a) = 12/4 = 3.')
    expect(gradeAxisOfSymmetry(F, 'x = ')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('checkSquareLine', () => {
  it('every legal line is equal to f; the last one is done', () => {
    const lines = ['2(x^2 - 6x) + 13', '2(x^2 - 6x + 9 - 9) + 13', '2((x - 3)^2 - 9) + 13', '2(x - 3)^2 - 18 + 13', '2x^2 - 12x + 36 - 36 + 13', '13 + 2x(x - 6)']
    for (const l of lines) expect(checkSquareLine(F, l)).toMatchObject({ verdict: 'correct', done: false, message: 'This line is still equal to f(x).' })
    expect(checkSquareLine(F, '2(x - 3)^2 - 5')).toMatchObject({ verdict: 'correct', done: true, message: 'This is vertex form: f(x) = 2(x − 3)^2 − 5.' })
  })

  it('names the slip in a line that is no longer equal to f', () => {
    const cases: [string, string][] = [
      ['2(x^2 - 6x + 9) + 13', 'cs_unbalanced'],
      ['2(x - 3)^2 + 13', 'cs_unbalanced'],
      ['2(x^2 - 6x + 9) + 13 + 18', 'cs_unbalanced'],
      ['2(x - 3)^2 - 9 + 13', 'cs_constant_not_scaled'],
      ['2(x^2 - 12x) + 13', 'cs_no_factor_a'],
      ['2(x^2 - 12x + 36) - 36 + 13', 'cs_no_factor_a'],
      ['(x - 6)^2 - 36 + 13', 'cs_no_factor_a'],
      ['2((x + 3)^2 - 9) + 13', 'cs_h_sign'],
      ['2(x - 3)^2 - 36 + 13', 'cs_half_or_square'],
      ['2((x - 6)^2 - 9) + 13', 'cs_half_or_square'],
    ]
    for (const [l, kind] of cases) expect(mistakeOf(checkSquareLine(F, l)), l).toBe(kind)
    const g = checkSquareLine(F, '2(x^2 - 12x) + 13')
    expect(g.verdict === 'mistake' && g.witness).toBe(
      'Factoring 2 out of the x-terms divides BOTH of them by 2: 2x^2 − 12x = 2(x^2 − 6x), not 2(x^2 − 12x). Then half of −6 is −3, so the square is (x − 3)^2 and the vertex form is 2(x − 3)^2 − 5.',
    )
  })

  it('an unnamed wrong line gets an exact counterexample', () => {
    const g = checkSquareLine(F, '2(x^2 - 6x) + 12')
    expect(g.verdict === 'wrong' && g.message).toBe(
      'This line is not equal to f(x) any more: it multiplies out to 2x^2 − 12x + 12, but f(x) = 2x^2 − 12x + 13 (at x = 0 the line gives 12 and f gives 13). The x^2 and x terms match, so the square is right. Multiplied out, the constants differ (yours is 12, f has 13): k = 13 − 18 = −5.',
    )
    const z = checkSquareLine(F, '2(x^2 - 5x) + 13')
    expect(z.verdict === 'wrong' && z.message).toContain('(at x = 1 the line gives 5 and f gives 3)')
  })

  it('unreadable or non-polynomial lines are invalid', () => {
    expect(checkSquareLine(F, '2(x^2 - 6x + 13')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(checkSquareLine(F, '2x^2 - 12x + 13/x')).toMatchObject({ verdict: 'invalid' })
    expect(checkSquareLine(F, '2x^2 - 12x = 13')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('square mistakes never fire on the right answer', () => {
  it('candidates differ from the right answer and from each other', () => {
    for (const f of [F, 'x^2 - 6x + 13', '-x^2 - 6x + 13', '(1/2)x^2 - 6x + 13', 'x^2 + 3x + 1', '3x^2 + 5x', '-3x^2 + 2x - 1/2', 'x^2 + 4', 'x^2 - 4x + 6', '4x^2 + 4x + 1']) {
      const m = completeSquare(f)!
      const forms = squareMistakes(f)!
      const seen = new Set<string>()
      for (const c of forms) {
        expect(c.text, f).not.toBe(m.vertexForm)
        expect(seen.has(c.text), `${f}: ${c.text}`).toBe(false)
        seen.add(c.text)
        const g = gradeVertexForm(f, c.text)
        expect(mistakeOf(g), `${f}: ${c.text}`).toBe(c.kind)
        expect(mistakeOf(checkSquareLine(f, c.text)), `${f}: line ${c.text}`).toBe(c.kind)
      }
      for (const c of vertexMistakes(f)!) {
        expect(c.text).not.toBe(m.vertexText)
        expect(mistakeOf(gradeVertex(f, c.text)), `${f}: ${c.text}`).toBe(c.kind)
      }
      for (const c of axisMistakes(f)!) expect(mistakeOf(gradeAxisOfSymmetry(f, c.text)), `${f}: ${c.text}`).toBe(c.kind)
      expect(gradeVertexForm(f, m.vertexForm).verdict, f).toBe('correct')
      expect(gradeVertex(f, m.vertexText).verdict, f).toBe('correct')
      expect(gradeAxisOfSymmetry(f, m.axisText).verdict, f).toBe('correct')
    }
  })
})

describe('checkSquareLine — equation lines (the constant moved to the side of y)', () => {
  it('a line with y is solved for y exactly', () => {
    for (const l of ['y - 13 = 2(x^2 - 6x)', 'y - 13 + 18 = 2(x^2 - 6x + 9)', 'y + 5 = 2(x - 3)^2', '2(x - 3)^2 = y + 5', '(y - 13)/2 = x^2 - 6x', '(y - 13)/2 + 9 = (x - 3)^2']) {
      expect(checkSquareLine(F, l), l).toMatchObject({ verdict: 'correct', done: false })
    }
    expect(checkSquareLine(F, 'y = 2(x - 3)^2 - 5')).toMatchObject({ verdict: 'correct', done: true })
    expect(checkSquareLine(F, 'f(x) = 2(x^2 - 6x) + 13')).toMatchObject({ verdict: 'correct', done: false })
  })

  it('the same slips are named on equation lines', () => {
    const cases: [string, string][] = [
      ['y - 13 = 2(x^2 - 6x + 9)', 'cs_unbalanced'],
      ['y - 13 + 9 = 2(x^2 - 6x + 9)', 'cs_constant_not_scaled'],
      ['y - 13 + 9 = 2(x - 3)^2', 'cs_constant_not_scaled'],
      ['y - 13 = 2(x^2 - 12x)', 'cs_no_factor_a'],
      ['y - 13 + 18 = 2(x + 3)^2', 'cs_h_sign'],
      ['y - 13 + 36 = 2(x - 3)^2', 'cs_half_or_square'],
      ['y - 13 - 18 = 2(x - 3)^2', 'cs_unbalanced'],
    ]
    for (const [l, kind] of cases) expect(mistakeOf(checkSquareLine(F, l)), l).toBe(kind)
  })

  it('an unnamed wrong equation line says what y it describes', () => {
    const g = checkSquareLine(F, 'y - 12 = 2(x^2 - 6x)')
    expect(g.verdict === 'wrong' && g.message).toContain('solved for y it says y = 2x^2 − 12x + 12, but f(x) = 2x^2 − 12x + 13 (at x = 0 the line gives 12 and f gives 13)')
  })

  it('lines that cannot be read as a function of x are invalid', () => {
    expect(checkSquareLine(F, '2x^2 - 12x + 13 = 2(x^2 - 6x) + 13')).toMatchObject({ verdict: 'invalid', message: 'Write one expression per line, or an equation with y in it (like y - 13 = 2(x^2 - 6x)).' })
    expect(checkSquareLine(F, 'y^2 = 2x^2 - 12x + 13')).toMatchObject({ verdict: 'invalid', message: 'Keep y to the first power and by itself (no x multiplying it), so the line can be solved for y.' })
    expect(checkSquareLine(F, 'xy = 2x^2 - 12x + 13')).toMatchObject({ verdict: 'invalid' })
    expect(checkSquareLine(F, 'y - 13 = 2(x^2 - 6x) = 5')).toMatchObject({ verdict: 'invalid', message: 'Write one equation per line: one = sign.' })
    expect(checkSquareLine(F, 'y - 13 = 2(x^2 - 6x')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(checkSquareLine(F, 'y - 13 = 2/x')).toMatchObject({ verdict: 'invalid' })
    expect(checkSquareLine(F, 'y - y = 2x^2 - 12x + 13')).toMatchObject({ verdict: 'invalid' })
  })
})

describe('numbers too large for exact arithmetic', () => {
  it('are reported, never thrown', () => {
    expect(['invalid', 'wrong']).toContain(gradeVertexForm(F, '9007199254740991(x - 9007199254740991)^2 - 5').verdict)
    expect(['invalid', 'wrong']).toContain(checkSquareLine(F, '9007199254740991x^2 - 9007199254740991x').verdict)
    expect(['invalid', 'wrong']).toContain(checkSquareLine(F, '9007199254740991y = 9007199254740991x^2').verdict)
    expect(['invalid', 'wrong']).toContain(gradeVertex(F, '(99999999999999999999, 1)').verdict)
  })
})
