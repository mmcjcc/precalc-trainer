import { describe, expect, it } from 'vitest'
import { parseExpression } from '@/engine'
import { evalNode } from '@/engine/math'
import { compileExpression, makeEnv, CompileError, type Env } from './compile'
import { buildModel } from './model'

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('')

function compiled(text: string) {
  const p = parseExpression(text, LETTERS)
  if (!p.ok) throw new Error(p.error.message)
  const c = compileExpression(p.node, { params: new Map(), functions: new Map(), allowY: false })
  const env: Env = makeEnv(0)
  return {
    node: p.node,
    at: (x: number) => {
      env.x = x
      return c.run(env)
    },
    crit: c.crit.map((g) => (x: number) => {
      env.x = x
      return g(env)
    }),
  }
}

describe('the grapher evaluates exactly what the engine evaluates', () => {
  const EXPRESSIONS = [
    'x^2 - 4',
    '500x - 2x^2',
    '(x^2 - 1)/(x - 1)',
    '1/x',
    'sqrt(x)',
    'sqrt(4 - x^2)',
    'cbrt(x)',
    'x^(1/3)',
    'x^(2/3)',
    'nthRoot(x, 5)',
    'abs(x - 2) + 1',
    'ln(x)',
    'log(x)',
    'log_2(x + 3)',
    'log(x, 1/2)',
    'e^x',
    '2^(x - 1)',
    '(1/2)^x',
    'sin(x)',
    'cos(2x) + 1',
    'tan(x)',
    'asin(x / 2)',
    'acos(x)',
    'atan(x)',
    'x^-2',
    '(x + 2)^-1',
    'x^0.5',
    '(-x)^0.5',
    'floor(x)',
    'round(x / 3)',
    'sign(x)',
    'min(x, 2)',
    'max(x^2, 1)',
    'exp(-x^2)',
    'x^x',
    'pi x',
    '-x^2',
    '-(x - 1)^3 / 4',
    '3!',
    'x % 3',
  ]
  const XS = [-7.5, -4, -2, -1, -0.5, -1e-3, 0, 1e-3, 0.5, 1, 1.5, 2, 3, 4, 6.25, 10, 123.4]

  it.each(EXPRESSIONS)('%s', (text) => {
    const c = compiled(text)
    for (const x of XS) {
      const want = evalNode(c.node, { x })
      const got = c.at(x)
      if (want === 'undef') {
        // The engine's undefined is NaN here; an overflow the engine also calls undefined is ±∞ here (off the chart).
        expect(Number.isNaN(got) || !Number.isFinite(got)).toBe(true)
      } else {
        expect(Number.isFinite(got)).toBe(true)
        expect(Math.abs(got - want)).toBeLessThanOrEqual(1e-12 * Math.max(1, Math.abs(want)))
      }
    }
  })
})

describe('meaning', () => {
  it('undefined is NaN: √ of a negative, a log of 0, 0 to a negative power, division by 0', () => {
    expect(Number.isNaN(compiled('sqrt(x)').at(-1))).toBe(true)
    expect(Number.isNaN(compiled('ln(x)').at(0))).toBe(true)
    expect(Number.isNaN(compiled('x^-1').at(0))).toBe(true)
    expect(Number.isNaN(compiled('1/x').at(0))).toBe(true)
  })

  it('an odd root of a negative is negative, an even one undefined', () => {
    expect(compiled('cbrt(x)').at(-8)).toBe(-2)
    expect(compiled('x^(1/3)').at(-27)).toBeCloseTo(-3, 12)
    expect(Number.isNaN(compiled('nthRoot(x, 4)').at(-16))).toBe(true)
  })

  it('an overflow is off the chart (±∞), not undefined', () => {
    expect(compiled('e^x').at(1000)).toBe(Infinity)
    expect(compiled('-x^200').at(1e10)).toBe(-Infinity)
  })

  it('things the grapher cannot draw are a sentence', () => {
    const p = parseExpression('[1, 2]', LETTERS)
    if (!p.ok) throw new Error('expected a parse')
    expect(() => compileExpression(p.node, { params: new Map(), functions: new Map(), allowY: false })).toThrow(CompileError)
  })
})

describe('degree mode', () => {
  it('sin, cos and tan take degrees, exact at whole right angles; the inverses give degrees', () => {
    const m = buildModel([
      { id: 'a', text: 'y = sin(x)' },
      { id: 'b', text: 'y = cos(x)' },
      { id: 'c', text: 'y = tan(x)' },
      { id: 'd', text: 'y = asin(x)' },
    ])
    m.setMode('deg')
    const sin = m.curve(0)!.f
    const cos = m.curve(1)!.f
    const tan = m.curve(2)!.f
    const asin = m.curve(3)!.f
    expect(sin(30)).toBeCloseTo(0.5, 14)
    expect(sin(90)).toBe(1)
    expect(sin(180)).toBe(0)
    expect(sin(-270)).toBe(1)
    expect(cos(90)).toBe(0)
    expect(cos(60)).toBeCloseTo(0.5, 14)
    expect(tan(45)).toBeCloseTo(1, 14)
    expect(Number.isNaN(tan(90))).toBe(true)
    expect(tan(180)).toBe(0)
    expect(asin(1)).toBeCloseTo(90, 12)
    m.setMode('rad')
    expect(sin(Math.PI / 2)).toBe(1)
    expect(asin(1)).toBeCloseTo(Math.PI / 2, 14)
  })
})

describe('critical sub-expressions: where a curve may break', () => {
  const zerosOf = (text: string) => compiled(text).crit
  it('a denominator, the cosine under a tangent, the inside of a log or a square root, an arcsine’s ±1', () => {
    expect(zerosOf('1/(x - 2)')[0]!(2)).toBe(0)
    expect(zerosOf('tan(x)')[0]!(Math.PI / 2)).toBeCloseTo(0, 15)
    expect(zerosOf('ln(x + 1)')[0]!(-1)).toBe(0)
    expect(zerosOf('sqrt(3 - x)')[0]!(3)).toBe(0)
    const asin = zerosOf('asin(x)')
    expect(asin.map((g) => g(1))).toContain(0)
    expect(asin.map((g) => g(-1))).toContain(0)
  })
  it('a polynomial has none; a whole-number power adds none', () => {
    expect(zerosOf('x^3 - 2x + 1')).toHaveLength(0)
    expect(zerosOf('(x - 1)^2')).toHaveLength(0)
  })
  it('a call carries its function’s breaks through the argument: f(x) = 1/x, then f(x − 2) breaks at 2', () => {
    const m = buildModel([
      { id: 'a', text: 'f(x) = 1/x' },
      { id: 'b', text: 'y = f(x - 2)' },
    ])
    const c = m.curve(1)!
    expect(c.crit.map((g) => g(2))).toContain(0)
  })
})
