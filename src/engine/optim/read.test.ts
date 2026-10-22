import { describe, expect, it } from 'vitest'
import { qText } from '../trig/rational'
import { displayNode, readOptEquation, readOptNumber, residual, unitSpellings } from './read'

describe('readOptEquation: her equation in x, y and the quantity’s letter', () => {
  it('reads the three kinds of equation, with the letters she used', () => {
    const c = readOptEquation('2x + y = 500', 'A')
    expect(c.ok && c.letters).toEqual(['x', 'y'])
    const p = readOptEquation('A = 3xy', 'A')
    expect(p.ok && p.letters).toEqual(['x', 'y', 'A'])
    const f = readOptEquation('A = x(500 - 2x)', 'A')
    expect(f.ok && f.letters).toEqual(['x', 'A'])
    if (!f.ok) throw new Error('unread')
    expect(residual(f, { x: 125, a: 31250 })).toBe(0)
  })

  it('a lower-case letter is the same letter, A(x) = … is A = …, and ² is a square', () => {
    const lower = readOptEquation('a = x*y', 'A')
    expect(lower.ok && lower.letters).toEqual(['x', 'y', 'A'])
    const fn = readOptEquation('A(x) = 500x − 2x²', 'A')
    if (!fn.ok) throw new Error(fn.message)
    expect(residual(fn, { x: 10, a: 4800 })).toBe(0)
    const right = readOptEquation('x(400 - 4x)/2 = A(x)', 'A')
    if (!right.ok) throw new Error(right.message)
    expect(residual(right, { x: 50, a: 5000 })).toBe(0)
    const revenue = readOptEquation('R(x) = x(460 - 20x)', 'R')
    expect(revenue.ok).toBe(true)
    // x(y) on the right is a product, not a name.
    const product = readOptEquation('A = x(y)', 'A')
    if (!product.ok) throw new Error(product.message)
    expect(residual(product, { x: 3, y: 4, a: 12 })).toBe(0)
  })

  it('what is not one equation in these letters is a note that says what to fix', () => {
    const cases: [string, string][] = [
      ['', 'empty'],
      ['500x - 2x^2', 'no_equals'],
      ['A = xy = x(500 - 2x)', 'chain'],
      ['2x + y <= 500', 'inequality'],
      ['A = lw', 'letters'],
      ['f(x) = 500x - 2x^2', 'name'],
      ['Y1 = 500x - 2x^2', 'name'],
      ['A = (500 - 2x', 'parse'],
    ]
    for (const [typed, reason] of cases) {
      const r = readOptEquation(typed, 'A')
      expect(r.ok, typed).toBe(false)
      if (!r.ok) expect(r.reason, typed).toBe(reason)
    }
    const letters = readOptEquation('A = lw', 'A')
    if (!letters.ok) expect(letters.message).toContain('x, y and A')
  })

  it('shows the quantity upper case again', () => {
    const r = readOptEquation('A = xy', 'A')
    if (!r.ok) throw new Error('unread')
    expect(displayNode(r.lhs, 'A').toString()).toBe('A')
  })
})

describe('readOptNumber: her number, exactly where she typed an exact one', () => {
  const ft = { lengthUnit: 'ft' as const }
  const read = (t: string, units = {}) => {
    const r = readOptNumber(t, units)
    if (!r.ok) throw new Error(`${t}: ${r.message}`)
    return r
  }

  it('whole numbers, decimals, fractions, mixed numbers and arithmetic', () => {
    expect(qText(read('125').exact!)).toBe('125')
    expect(read('125').places).toBe(0)
    expect(qText(read('33.33').exact!)).toBe('3333/100')
    expect(read('33.33').places).toBe(2)
    expect(qText(read('100/3').exact!)).toBe('100/3')
    expect(read('100/3').places).toBeNull()
    expect(qText(read('33 1/3').exact!)).toBe('100/3')
    expect(qText(read('33⅓').exact!)).toBe('100/3')
    expect(qText(read('-8').exact!)).toBe('-8')
    expect(qText(read('−500/(2(−2))').exact!)).toBe('125')
    expect(qText(read('-(-2)/(2*500)').exact!)).toBe('1/500')
    expect(qText(read('31,250').exact!)).toBe('31250')
    expect(qText(read('2.5^2').exact!)).toBe('25/4')
    expect(read('sqrt(2)').exact).toBeNull()
  })

  it('a name in front, a unit after, money', () => {
    const x = read('x = 125 ft', ft)
    expect([x.name, x.unit, qText(x.exact!)]).toEqual(['x', 'length', '125'])
    for (const t of ['31250 ft^2', '31250 ft²', '31,250 sq ft', '31250 square feet', '31250 sq. ft.', '31250 feet squared', 'A = 31250 ft2']) {
      expect(read(t, ft).unit, t).toBe('area')
    }
    const m = read('62.5 m', { lengthUnit: 'm' })
    expect(m.unit).toBe('length')
    expect(read('7812.5 m^2', { lengthUnit: 'm' }).unit).toBe('area')
    const cash = read('$2,645.50', { money: true })
    expect([cash.unit, qText(cash.exact!)]).toEqual(['money', '5291/2'])
    expect(read('11.50 dollars').unit).toBe('money')
    expect(read('230 tickets', { count: ['tickets', 'ticket'] }).unit).toBe('count')
    expect(read('about 33.3 ft', ft).places).toBe(1)
  })

  it('a formula, an unknown unit, or nothing is a note', () => {
    expect(readOptNumber('x(500 - 2x)', ft)).toMatchObject({ ok: false, reason: 'letters' })
    expect(readOptNumber('125 inches', ft)).toMatchObject({ ok: false, reason: 'unit' })
    expect(readOptNumber('', ft)).toMatchObject({ ok: false, reason: 'empty' })
    expect(readOptNumber('ft', ft)).toMatchObject({ ok: false, reason: 'empty' })
    expect(readOptNumber('1/0', ft)).toMatchObject({ ok: false })
  })

  it('the KaTeX preview of a plain number keeps its commas and unit', () => {
    expect(read('31250 ft^2', ft).tex).toBe('31{,}250\\ \\text{ft}^{2}')
    expect(read('33 1/3 ft', ft).tex).toBe('33\\tfrac{1}{3}\\ \\text{ft}')
  })

  it('every area spelling is longer than the plain unit, so the square is read first', () => {
    const spellings = unitSpellings('ft')
    const firstLength = spellings.findIndex((s) => s.kind === 'length')
    expect(spellings.slice(firstLength).some((s) => s.kind === 'area' && s.text.length > spellings[firstLength]!.text.length)).toBe(false)
  })
})
