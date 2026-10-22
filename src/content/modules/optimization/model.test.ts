/**
 * The model's exact mathematics against hand-worked values: the final equation in each letter, the solution, and
 * what each slip turns the final equation into.
 */
import { describe, expect, it } from 'vitest'
import { q, qText, type Quadratic } from '@/engine/optim'
import { binomialSlips, droppedTerms, finalEquation, finalQuadratic, lineEquation, partialDivisions, partnerExpr, primaryEquation, solve, substituted, type OptModel } from './model'

const show = (p: Quadratic) => [qText(p.a), qText(p.b), qText(p.c)]

const pigpen: OptModel = { line: { a: q(2), b: q(1), c: q(500) }, objective: { kind: 'product', k: q(1) }, quantity: 'A' }
const threePens: OptModel = { line: { a: q(4), b: q(6), c: q(400) }, objective: { kind: 'product', k: q(3) }, quantity: 'A' }
const squares: OptModel = { line: { a: q(1), b: q(1), c: q(40) }, objective: { kind: 'squares' }, quantity: 'S' }

describe('the final equation and its vertex, exactly', () => {
  it('the pigpen: A = 500x − 2x² in x, A = 250y − y²/2 in y; x = 125, y = 250, A = 31250', () => {
    expect(show(finalQuadratic(pigpen, 'x'))).toEqual(['-2', '500', '0'])
    expect(show(finalQuadratic(pigpen, 'y'))).toEqual(['-1/2', '250', '0'])
    const s = solve(pigpen)
    expect([qText(s.x), qText(s.y), qText(s.value), s.opens]).toEqual(['125', '250', '31250', 'down'])
    expect(lineEquation(pigpen.line).text).toBe('2x + y = 500')
    expect(primaryEquation(pigpen).text).toBe('A = xy')
    expect(finalEquation('A', finalQuadratic(pigpen, 'x'), 'x').text).toBe('A = 500x - 2x^2')
    expect(substituted(pigpen, 'x').text).toBe('A = x(500 - 2x)')
  })

  it('three pens, 400 ft: A = 200x − 2x²; x = 50, y = 100/3, A = 5000', () => {
    expect(show(finalQuadratic(threePens, 'x'))).toEqual(['-2', '200', '0'])
    const s = solve(threePens)
    expect([qText(s.x), qText(s.y), qText(s.value)]).toEqual(['50', '100/3', '5000'])
    expect(partnerExpr(threePens.line, 'x').text).toBe('(400 - 4x)/6')
    expect(primaryEquation(threePens).text).toBe('A = 3xy')
  })

  it('a sum of 40, the smallest sum of squares: S = 2x² − 80x + 1600, x = y = 20, S = 800', () => {
    expect(show(finalQuadratic(squares, 'x'))).toEqual(['2', '-80', '1600'])
    const s = solve(squares)
    expect([qText(s.x), qText(s.y), qText(s.value), s.opens]).toEqual(['20', '20', '800', 'up'])
  })
})

describe('what the slips turn the final equation into', () => {
  it('a lost term: −2x² or 500x for the pigpen', () => {
    expect(droppedTerms(finalQuadratic(pigpen, 'x')).map((t) => [t.which, ...show(t.p)])).toEqual([
      ['linear', '-2', '0', '0'],
      ['square', '0', '500', '0'],
    ])
  })

  it('the secondary solved with not every term divided by 6 (three pens)', () => {
    expect(partialDivisions(threePens.line, 'x').map((d) => [d.how, qText(d.slope), qText(d.intercept)])).toEqual([
      ['number', '-4', '200/3'],
      ['term', '-2/3', '400'],
      ['none', '-4', '400'],
    ])
    // A coefficient of 1 has nothing to divide.
    expect(partialDivisions(pigpen.line, 'x')).toEqual([])
  })

  it('(40 − x)² as two terms: 1600 + x² or 1600 − x²', () => {
    expect(binomialSlips(squares.line, 'x').map(show)).toEqual([
      ['2', '0', '1600'],
      ['0', '0', '1600'],
    ])
  })
})
