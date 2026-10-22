import { describe, expect, it } from 'vitest'
import { q } from '../trig/rational'
import { finalRoute, gradeOptEquation, gradeOptNumber, type OptEquationSpec, type OptNumberSpec } from './grade'

const domain = { x: [0, 250], y: [0, 500] } as const

describe('gradeOptEquation: the secondary equation', () => {
  const spec: OptEquationSpec = { part: 'constraint', quantity: 'A', target: '2x + y = 500', domain }
  const traps = [
    { id: 'opt_wall_fenced' as const, equation: '2x + 2y = 500', witness: 'fenced' },
    { id: 'opt_wall_wrong_side' as const, equation: 'x + 2y = 500', witness: 'swapped' },
    { id: 'opt_primary_secondary_swapped' as const, equation: 'A = xy', witness: 'primary' },
    { id: 'opt_area_as_fence' as const, equation: 'xy = 500', witness: 'area' },
  ]

  it('every equivalent form is right', () => {
    for (const t of ['2x + y = 500', '500 = 2x + y', 'y = 500 - 2x', 'y = 500 − 2x', 'x = (500 - y)/2', '4x + 2y = 1000', '(500 - y)/x = 2', 'y/(500 - 2x) = 1']) {
      expect(gradeOptEquation(spec, t, traps).verdict, t).toBe('correct')
    }
  })

  it('each slip is named by its own id', () => {
    expect(gradeOptEquation(spec, '2(x + y) = 500', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_wall_fenced', witness: 'fenced' })
    expect(gradeOptEquation(spec, 'y = (500 - x)/2', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_wall_wrong_side' })
    expect(gradeOptEquation(spec, 'A = x*y', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_primary_secondary_swapped' })
    expect(gradeOptEquation(spec, 'y = 500/x', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_area_as_fence' })
  })

  it('other equations are wrong; an equation with A, or one true everywhere, is a note', () => {
    expect(gradeOptEquation(spec, '2x + y = 400', traps).verdict).toBe('wrong')
    expect(gradeOptEquation(spec, 'A = 2x + y', traps).verdict).toBe('invalid')
    expect(gradeOptEquation(spec, 'x + y = y + x', traps).verdict).toBe('invalid')
    expect(gradeOptEquation(spec, '2x + y', traps).verdict).toBe('invalid')
    expect(gradeOptEquation(spec, '???', traps).verdict).toBe('invalid')
  })
})

describe('gradeOptEquation: the primary equation', () => {
  const spec: OptEquationSpec = { part: 'primary', quantity: 'A', target: 'A = 3xy', domain: { x: [0, 100], y: [0, 400 / 6] } }
  const traps = [
    { id: 'opt_area_one_pen' as const, equation: 'A = xy', witness: 'one' },
    { id: 'opt_area_wrong_count' as const, equation: 'A = 2xy', witness: 'two' },
    { id: 'opt_primary_secondary_swapped' as const, equation: '4x + 6y = 400', witness: 'secondary' },
  ]

  it('A = 3xy in any form is right; her A = 2xy for three pens is named', () => {
    for (const t of ['A = 3xy', '3xy = A', 'A = 3*x*y', 'A/3 = xy', 'A = x*3y']) expect(gradeOptEquation(spec, t, traps).verdict, t).toBe('correct')
    expect(gradeOptEquation(spec, 'A = 2xy', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_area_wrong_count' })
    expect(gradeOptEquation(spec, 'A = xy', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_area_one_pen' })
    expect(gradeOptEquation(spec, '2x + 3y = 200', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_primary_secondary_swapped' })
  })

  it('no A, or one variable only, is a note; another A is wrong', () => {
    expect(gradeOptEquation(spec, 'xy = 3', traps).verdict).toBe('invalid')
    expect(gradeOptEquation(spec, 'A = 200x - 2x^2', traps).verdict).toBe('invalid')
    expect(gradeOptEquation(spec, 'A = 4xy', traps).verdict).toBe('wrong')
  })
})

describe('gradeOptEquation: the final equation, in x or in y', () => {
  const spec: OptEquationSpec = { part: 'final', quantity: 'A', target: 'A = 500x - 2x^2', targetY: 'A = y(500 - y)/2', domain }
  const traps = [
    { id: 'opt_term_dropped' as const, equation: 'A = -2x^2', witness: 'dropped' },
    { id: 'opt_opens_wrong_way' as const, equation: 'A = 2x^2 - 500x', witness: 'opens up' },
    { id: 'opt_term_dropped' as const, equation: 'A = -y^2/2', witness: 'dropped in y' },
  ]

  it('every form in x is right, and so is the final equation in y; the route says which', () => {
    for (const t of ['A = x(500 - 2x)', 'A = 500x - 2x^2', 'A = -2(x - 125)^2 + 31250', 'A(x) = 2x(250 - x)']) {
      expect(gradeOptEquation(spec, t, traps), t).toMatchObject({ verdict: 'correct', route: 'x' })
    }
    expect(gradeOptEquation(spec, 'A = y(500 - y)/2', traps)).toMatchObject({ verdict: 'correct', route: 'y' })
    expect(gradeOptEquation(spec, 'A = 250y - y^2/2', traps)).toMatchObject({ verdict: 'correct', route: 'y' })
    expect(finalRoute('A = y(500 - y)/2', 'A', domain)).toBe('y')
    expect(finalRoute('A = 500x - 2x^2', 'A', domain)).toBe('x')
    expect(finalRoute('A = xy', 'A', domain)).toBeNull()
  })

  it('a slip is named only in its own variable', () => {
    expect(gradeOptEquation(spec, 'A = -2x^2', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_term_dropped', witness: 'dropped' })
    expect(gradeOptEquation(spec, 'A = -y^2/2', traps)).toMatchObject({ verdict: 'mistake', witness: 'dropped in y' })
    expect(gradeOptEquation(spec, 'A = 2x^2 - 500x', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_opens_wrong_way' })
    expect(gradeOptEquation(spec, 'A = x(500 - x)', traps).verdict).toBe('wrong')
  })

  it('two variables, no A, or a number is a note', () => {
    expect(gradeOptEquation(spec, 'A = xy', traps).verdict).toBe('invalid')
    expect(gradeOptEquation(spec, '500x - 2x^2 = 0', traps).verdict).toBe('invalid')
    expect(gradeOptEquation(spec, 'A = 31250', traps).verdict).toBe('invalid')
  })
})

describe('gradeOptNumber', () => {
  const x: OptNumberSpec = { value: q(125), places: null, dim: 'length', name: 'x', units: { lengthUnit: 'ft' }, what: 'x', areaWords: 'square feet', lengthWords: 'feet' }
  const traps = [
    { id: 'opt_vertex_ab_swapped' as const, value: q(1, 500), witness: 'ab' },
    { id: 'opt_vertex_sign' as const, value: q(-125), witness: 'sign' },
    { id: 'opt_vertex_no_two' as const, value: q(250), witness: 'two' },
    { id: 'opt_max_as_dimension' as const, value: q(31250), witness: 'area' },
  ]

  it('the value in any exact form, with or without its unit or its name, is right', () => {
    for (const t of ['125', 'x = 125', '125 ft', 'x = 125 feet', '125.0', '250/2', '-500/(2(-2))', '−500/(2·(−2))']) expect(gradeOptNumber(x, t, traps).verdict, t).toBe('correct')
  })

  it('her vertex slip −(−2)/(2·500) is a and b swapped; the others by value', () => {
    expect(gradeOptNumber(x, '-(-2)/(2*500)', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_vertex_ab_swapped' })
    expect(gradeOptNumber(x, '0.002', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_vertex_ab_swapped' })
    expect(gradeOptNumber(x, '-125', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_vertex_sign' })
    expect(gradeOptNumber(x, '250 ft', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_vertex_no_two' })
    expect(gradeOptNumber(x, '31,250', traps)).toMatchObject({ verdict: 'mistake', mistake: 'opt_max_as_dimension' })
    expect(gradeOptNumber(x, '120', traps).verdict).toBe('wrong')
  })

  it('the wrong kind of unit, another letter, or a calculator estimate is a note', () => {
    expect(gradeOptNumber(x, '125 ft^2', traps).verdict).toBe('invalid')
    expect(gradeOptNumber(x, 'y = 125', traps).verdict).toBe('invalid')
    expect(gradeOptNumber(x, '124.99998', traps).verdict).toBe('invalid')
    expect(gradeOptNumber(x, '$125', traps).verdict).toBe('invalid')
  })

  it('an area needs its square unit; a length unit on it is a note', () => {
    const area: OptNumberSpec = { value: q(31250), places: null, dim: 'area', unitRequired: true, name: 'A', units: { lengthUnit: 'ft' }, what: 'the largest area', areaWords: 'square feet', lengthWords: 'feet' }
    for (const t of ['31250 ft^2', '31,250 square feet', 'A = 31250 sq ft', '31250 ft²']) expect(gradeOptNumber(area, t, []).verdict, t).toBe('correct')
    expect(gradeOptNumber(area, '31250', []).verdict).toBe('invalid')
    expect(gradeOptNumber(area, '31250 ft', []).verdict).toBe('invalid')
    expect(gradeOptNumber(area, '125 ft^2', [{ id: 'opt_x_as_max', value: q(125), witness: 'x' }])).toMatchObject({ verdict: 'mistake', mistake: 'opt_x_as_max' })
  })

  it('exact answers: a fraction or a mixed number is right, a rounded decimal is a note', () => {
    const y: OptNumberSpec = { value: q(100, 3), places: null, dim: 'length', name: 'y', units: { lengthUnit: 'ft' }, what: 'y' }
    for (const t of ['100/3', '33 1/3', '33⅓', '33 1/3 ft', '(400 - 200)/6']) expect(gradeOptNumber(y, t, []).verdict, t).toBe('correct')
    for (const t of ['33.33', '33.3', '33.333']) expect(gradeOptNumber(y, t, []).verdict, t).toBe('invalid')
    expect(gradeOptNumber(y, '33', []).verdict).toBe('wrong')
  })

  it('rounding asked: every correct rounding is right, more places too; fewer places is a note', () => {
    const y: OptNumberSpec = { value: q(100, 3), places: 2, dim: 'length', name: 'y', units: { lengthUnit: 'ft' }, what: 'y' }
    for (const t of ['33.33', '33.333', '33.3333 ft', '100/3', '33 1/3']) expect(gradeOptNumber(y, t, []).verdict, t).toBe('correct')
    expect(gradeOptNumber(y, '33.3', []).verdict).toBe('invalid')
    expect(gradeOptNumber(y, '33.34', []).verdict).toBe('wrong')
    const trap = [{ id: 'opt_other_from_primary' as const, value: q(100), witness: 'n·y' }]
    expect(gradeOptNumber(y, '100', trap)).toMatchObject({ verdict: 'mistake', mistake: 'opt_other_from_primary' })
  })

  it('money: a $ in front or dollars after; plain numbers take no unit', () => {
    const price: OptNumberSpec = { value: q(23, 2), places: null, dim: 'money', name: 'x', units: { money: true }, what: 'the price' }
    for (const t of ['11.50', '$11.50', '11.5', '11.50 dollars', 'x = $11.50']) expect(gradeOptNumber(price, t, []).verdict, t).toBe('correct')
    const plain: OptNumberSpec = { value: q(-8), places: null, dim: 'none', name: 'y', units: {}, what: 'y' }
    expect(gradeOptNumber(plain, '-8', []).verdict).toBe('correct')
    expect(gradeOptNumber(plain, '$-8', []).verdict).toBe('invalid')
  })
})
