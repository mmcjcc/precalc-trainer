import { describe, expect, it } from 'vitest'
import { buildModel } from './model'
import { parseRows, type RowShape } from './parse'
import { planTex } from './preview'

const one = (text: string) => parseRows([text]).rows[0]!
const kind = (text: string): RowShape['kind'] => one(text).shape.kind
const errorOf = (text: string) => {
  const s = one(text).shape
  return s.kind === 'error' ? s.error : null
}

describe('every kind of row', () => {
  it.each([
    ['y = 2x + 1', 'curve'],
    ['Y=x^2', 'curve'],
    ['2x + 1 = y', 'curve'],
    ['x^2 - 4', 'curve'],
    ['sin(x)', 'curve'],
    ['5', 'curve'],
    ['f(x) = x^2', 'define'],
    ['A(x) = 500x - 2x^2', 'define'],
    ['x = 3', 'vline'],
    ['-2 = x', 'vline'],
    ['x = a', 'vline'],
    ['(3, 4)', 'points'],
    ['(1, 2), (3, 4), (-1, 0.5)', 'points'],
    ['y < x^2', 'region'],
    ['y >= 2x - 1', 'region'],
    ['x^2 > y', 'region'],
    ['x <= 2', 'xregion'],
    ['3 > x', 'xregion'],
    ['2x + 3y = 6', 'implicit'],
    ['2x + 3y < 6', 'implicit'],
    ['a = 2', 'constant'],
    ['y = x^2 {x > 0}', 'curve'],
    ['y = 6 {1 <= x < 3}', 'curve'],
    ['', 'empty'],
    ['   ', 'empty'],
  ] as const)('%s is a %s row', (text, k) => {
    expect(kind(text)).toBe(k)
  })

  it('a space between letters is times, so a sin(x) is a·sin x, not the arcsine; ln x still reads as ln(x)', () => {
    const m = buildModel([
      { id: 'a', text: 'y = a sin(x)' },
      { id: 'b', text: 'y = a cos(b x)' },
      { id: 'c', text: 'y = ln x' },
      { id: 'd', text: 'y = asin(x)' },
    ])
    expect(m.sliders).toEqual(['a', 'b'])
    m.setParams({ a: 3, b: 2 })
    expect(m.curve(0)!.f(Math.PI / 2)).toBeCloseTo(3, 12)
    expect(m.curve(1)!.f(0)).toBe(3)
    expect(m.curve(2)!.f(Math.E)).toBeCloseTo(1, 12)
    expect(m.curve(3)!.f(1)).toBeCloseTo(Math.PI / 2, 12)
  })

  it('a bare expression and y = … mean the same curve', () => {
    const m = buildModel([
      { id: 'a', text: 'x^2 - 4' },
      { id: 'b', text: 'y = x^2 - 4' },
    ])
    const f = m.curve(0)!.f
    const g = m.curve(1)!.f
    for (const x of [-3, 0, 1.5, 7]) expect(f(x)).toBe(g(x))
  })

  it('reads the app’s syntax: implicit multiplication, |x|, √, π, logs, e', () => {
    const m = buildModel([
      { id: 'a', text: 'y = 2x(x - 1)' },
      { id: 'b', text: 'y = |x - 1|' },
      { id: 'c', text: 'y = √(x + 4)' },
      { id: 'd', text: 'y = πx' },
      { id: 'e', text: 'y = log_2(x)' },
      { id: 'f', text: 'y = ln x + 1' },
      { id: 'g', text: 'y = e^x' },
      { id: 'h', text: 'y = x²' },
      { id: 'i', text: 'y = log(100x)' },
    ])
    expect(m.curve(0)!.f(3)).toBe(12)
    expect(m.curve(1)!.f(-2)).toBe(3)
    expect(m.curve(2)!.f(5)).toBe(3)
    expect(m.curve(3)!.f(2)).toBeCloseTo(2 * Math.PI, 12)
    expect(m.curve(4)!.f(8)).toBe(3)
    expect(m.curve(5)!.f(Math.E)).toBeCloseTo(2, 12)
    expect(m.curve(6)!.f(1)).toBeCloseTo(Math.E, 12)
    expect(m.curve(7)!.f(-3)).toBe(9)
    expect(m.curve(8)!.f(10)).toBeCloseTo(3, 12)
  })
})

describe('her functions', () => {
  it('f(x) = … is graphed and can be used in a later row: g(x) = f(x − 2)', () => {
    const m = buildModel([
      { id: 'a', text: 'f(x) = x^2' },
      { id: 'b', text: 'g(x) = f(x - 2) + 1' },
      { id: 'c', text: 'y = 2f(x)' },
      { id: 'd', text: 'y = f(x)^2' },
      { id: 'e', text: 'y = f(g(x))' },
    ])
    expect(m.rows.map((r) => r.error)).toEqual([null, null, null, null, null])
    expect(m.curve(0)!.f(3)).toBe(9)
    expect(m.curve(1)!.f(5)).toBe(10)
    expect(m.curve(2)!.f(3)).toBe(18)
    expect(m.curve(3)!.f(3)).toBe(81)
    expect(m.curve(4)!.f(2)).toBe(1)
    expect(m.sliders).toEqual([])
  })

  it('can be defined after the row that uses it, and keeps a capital name', () => {
    const p = parseRows(['y = A(x) - 1', 'A(x) = 500x - 2x^2'])
    expect(p.rows[0]!.shape.kind).toBe('curve')
    expect(p.functions.get('a')?.display).toBe('A')
    const m = buildModel([
      { id: 'a', text: 'y = A(x) - 1' },
      { id: 'b', text: 'A(x) = 500x - 2x^2' },
    ])
    expect(m.curve(0)!.f(125)).toBe(31249)
  })

  it('a(x − h)^2 + k is a product with sliders, not a call', () => {
    const p = parseRows(['y = a(x - h)^2 + k'])
    expect(p.sliders).toEqual(['a', 'h', 'k'])
    const m = buildModel([{ id: 'a', text: 'y = a(x - h)^2 + k' }])
    m.setParams({ a: 2, h: 3, k: -1 })
    expect(m.curve(0)!.f(5)).toBe(7)
  })

  it('names a function defined twice, one defined in terms of itself, a circle, and a name used as a number', () => {
    expect(parseRows(['f(x) = x', 'f(x) = 2x']).rows[1]!.shape).toMatchObject({ kind: 'error', error: { message: expect.stringMatching(/already defined in row 1/) } })
    expect(parseRows(['f(x) = f(x) + 1']).rows[0]!.shape).toMatchObject({ kind: 'error', error: { message: expect.stringMatching(/in terms of itself/) } })
    const circle = parseRows(['f(x) = g(x) + 1', 'g(x) = f(x) - 1', 'y = f(x)'])
    expect(circle.rows.map((r) => r.shape.kind)).toEqual(['error', 'error', 'error'])
    expect(parseRows(['f(x) = x^2', 'y = f + 1']).rows[1]!.shape).toMatchObject({ kind: 'error', error: { message: expect.stringMatching(/f is a function: write f\(x\)/) } })
  })

  it('a function in another letter, and a restriction on the definition, are explained', () => {
    expect(errorOf('f(t) = t^2')?.message).toMatch(/Write f in x/)
    expect(errorOf('f(x) = x^2 {x > 0}')?.message).toMatch(/Put the restriction on a row that graphs f/)
  })
})

describe('what a row cannot be, in a sentence', () => {
  it.each([
    ['y = 2x +', /ends too early/],
    ['y = (x + 1', /closing \) is missing/],
    ['y = x = 2', /One = sign per row/],
    ['y < x < 3', /One comparison per row/],
    ['y != x', /≠ is not graphed/],
    ['x^2 = 4', /There is no y here/],
    ['2 = 3', /no x or y/],
    ['x = y^2', /vertical line/],
    ['x = x + 1', /x is on both sides/],
    ['y = y + 1', /y is on both sides/],
    ['2y + x', /y in it but no = sign/],
    ['(3, x)', /coordinates are numbers/],
    ['(1, 2, 3)', /two coordinates/],
    ['y = x^2 {y > 0}', /condition on x only/],
    ['y = x^2 {}', /braces are empty/],
    ['y = {x > 0} x', /at the end of the row/],
    ['a = 2x', /one value/],
    ['y = = 3', /./],
    ['y =', /right side is empty/],
  ] as const)('%s', (text, re) => {
    const e = errorOf(text)
    expect(e).not.toBeNull()
    expect(e!.message).toMatch(re)
  })

  it('points at the place it could not read', () => {
    const e = errorOf('y = 2x + * 3')
    expect(e?.position).toBeGreaterThanOrEqual(8)
    expect(e?.position).toBeLessThanOrEqual(10)
  })

  it('a curve that is not linear in y is explained when it is compiled', () => {
    const m = buildModel([{ id: 'a', text: 'x^2 + y^2 = 25' }])
    expect(m.draw(0)).toBeNull()
    expect(m.rows[0]!.error?.message).toMatch(/Solve for y first/)
  })

  it('a function the grapher does not know', () => {
    const m = buildModel([{ id: 'a', text: 'y = x ? 1 : 2' }])
    expect(m.rows[0]!.error?.message).toMatch(/cannot draw/)
  })
})

describe('sliders', () => {
  it('every letter that is not x, y or e gets one, in the order it appears, across rows', () => {
    const p = parseRows(['y = m x + b', 'y = a(x - h)^2 + k', 'y = sin(c x)', 'y = e^x'])
    expect(p.sliders).toEqual(['m', 'b', 'a', 'h', 'k', 'c'])
  })

  it('a = 2 gives a its value and no slider; a letter only in a restriction or a point gets one', () => {
    const p = parseRows(['a = 2', 'y = a x', 'y = x {x < t}', '(p, 1)'])
    expect(p.sliders).toEqual(['t', 'p'])
    expect([...p.constants.keys()]).toEqual(['a'])
    const m = buildModel([
      { id: 'a', text: 'a = 2' },
      { id: 'b', text: 'b = a + 1' },
      { id: 'c', text: 'y = b x' },
    ])
    expect(m.constantValue('b')).toBe(3)
    expect(m.curve(2)!.f(2)).toBe(6)
  })

  it('a letter with no value yet is 1', () => {
    const m = buildModel([{ id: 'a', text: 'y = kx' }])
    expect(m.curve(0)!.f(3)).toBe(3)
    m.setParams({ k: -2 })
    expect(m.curve(0)!.f(3)).toBe(-6)
  })
})

describe('the shapes', () => {
  it('a vertical line, shading, points', () => {
    const m = buildModel([
      { id: 'a', text: 'x = 3' },
      { id: 'b', text: 'x <= -2' },
      { id: 'c', text: '(1, 2), (a, -1)' },
      { id: 'd', text: 'y < 2x + 1' },
      { id: 'e', text: 'x^2 >= y' },
    ])
    m.setParams({ a: 4 })
    expect(m.draw(0)).toEqual({ kind: 'vline', x: 3 })
    expect(m.draw(1)).toEqual({ kind: 'xregion', x: -2, left: true, strict: false })
    expect(m.draw(2)).toEqual({ kind: 'points', points: [{ x: 1, y: 2 }, { x: 4, y: -1 }] })
    expect(m.draw(3)).toMatchObject({ kind: 'region', below: true, strict: true })
    expect(m.draw(4)).toMatchObject({ kind: 'region', below: true, strict: false })
  })

  it('2x + 3y = 6 is solved for y; 2x − 3y < 6 turns the shading over; xy = 1 is y = 1/x', () => {
    const m = buildModel([
      { id: 'a', text: '2x + 3y = 6' },
      { id: 'b', text: '2x - 3y < 6' },
      { id: 'c', text: 'xy = 1' },
    ])
    expect(m.curve(0)!.f(3)).toBeCloseTo(0, 12)
    expect(m.curve(0)!.f(0)).toBeCloseTo(2, 12)
    expect(m.draw(1)).toMatchObject({ kind: 'region', below: false, strict: true })
    expect(m.curve(1)!.f(0)).toBeCloseTo(-2, 12)
    expect(m.curve(2)!.f(4)).toBeCloseTo(0.25, 12)
    expect(Number.isNaN(m.curve(2)!.f(0))).toBe(true)
  })

  it('a hidden row draws nothing but still defines its function', () => {
    const m = buildModel([
      { id: 'a', text: 'f(x) = x + 1', hidden: true },
      { id: 'b', text: 'y = f(x) * 2' },
    ])
    expect(m.draw(0)).toBeNull()
    expect(m.curve(1)!.f(1)).toBe(4)
  })
})

describe('the preview', () => {
  const tex = (rows: string[], i = 0) => {
    const p = parseRows(rows)
    const names = new Map([...p.functions.values()].map((f) => [f.index, f.display]))
    return planTex(p.rows[i]!.tex, names)
  }

  it('draws each kind', () => {
    expect(tex(['y = x^2'])).toBe('y = x^{2}')
    expect(tex(['x^2 - 4'])).toBe('x^{2}-4')
    expect(tex(['y <= 2x + 1'])).toBe('y \\le 2x+1')
    expect(tex(['x = 3'])).toBe('x = 3')
    expect(tex(['(3, 4)'])).toBe('\\left(3,\\ 4\\right)')
    expect(tex(['y = x {x > 0}'])).toBe('y = x\\quad\\left\\{ x > 0 \\right\\}')
    expect(tex(['y = pi x'])).toContain('\\pi x')
  })

  it('writes her calls as calls, nested too, and keeps the name’s capital', () => {
    expect(tex(['f(x) = x^2', 'g(x) = f(x - 2) + 1'], 1)).toBe('g(x) = f\\left(x-2\\right)+1')
    expect(tex(['f(x) = x^2', 'g(x) = 2x', 'y = f(g(x))^2'], 2)).toBe('y = \\left(f\\left(g\\left(x\\right)\\right)\\right)^{2}')
    expect(tex(['A(x) = 500x - 2x^2'])).toBe('A(x) = 500x-2x^{2}')
  })
})
