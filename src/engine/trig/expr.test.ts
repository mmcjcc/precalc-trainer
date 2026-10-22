/**
 * The Unit 5 expression reader: the ways a textbook and a TI-84 write a trig function, every one read to the same
 * function; what is not read, with a message; exact values at the special points; and equality as functions (exact at
 * the key points, and over two periods), with the equal forms and the near misses of y = 3 sin(2x − π/2) + 1 by hand.
 */
import { describe, expect, it } from 'vitest'
import { exactText, tx, type TrigExact } from './exact'
import { evalExprExact, evalExprNum, nearlySameFunction, readExpr, readFunctionAnswer, sameFunction, spreadSamples, type ExprNode } from './expr'
import { q } from './rational'

const node = (t: string, vars: string[] = ['x']): ExprNode => {
  const r = readExpr(t, { vars })
  if (!r.ok) throw new Error(`${t}: ${r.message}`)
  return r.node
}
const at = (t: string, x: number) => evalExprNum(node(t), { x })
const piX = (n: number, d = 1): TrigExact => tx(q(n, d), 1, 1)

describe('reading', () => {
  it.each([
    ['3sin(2x - pi/2) + 1', 0.7, 3 * Math.sin(1.4 - Math.PI / 2) + 1],
    ['3 sin 2x + 1', 0.7, 3 * Math.sin(1.4) + 1],
    ['-3cos(2(x - π/4)) + 1', 0.7, -3 * Math.cos(2 * (0.7 - Math.PI / 4)) + 1],
    ['(1/2)cos(x/2)', 0.7, 0.5 * Math.cos(0.35)],
    ['1/2x', 0.7, 0.35],
    ['sin x cos x', 0.7, Math.sin(0.7) * Math.cos(0.7)],
    ['sin(x)cos(x)', 0.7, Math.sin(0.7) * Math.cos(0.7)],
    ['sec(x) + csc(x) + cot(x)', 0.7, 1 / Math.cos(0.7) + 1 / Math.sin(0.7) + Math.cos(0.7) / Math.sin(0.7)],
    ['2tan(πx/4)', 0.7, 2 * Math.tan((Math.PI * 0.7) / 4)],
    ['arcsin(x) + asin(x) + sin⁻¹(x) + sin^-1(x) + sin^(-1)(x)', 0.3, 5 * Math.asin(0.3)],
    ['arccos x', 0.3, Math.acos(0.3)],
    ['√(1 − x²)', 0.6, 0.8],
    ['sqrt(1-x^2)', 0.6, 0.8],
    ['(1 - x^2)^(1/2)', 0.6, 0.8],
    ['x/√(1+x^2)', 0.75, 0.6],
    ['−3 × sin(2x) ÷ 2', 0.7, (-3 * Math.sin(1.4)) / 2],
  ])('%s', (text, x, want) => {
    expect(at(text, x)).toBeCloseTo(want, 12)
  })

  it.each([
    ['sin(30°)', /radians/],
    ['3sin(2y)', /letter “y”/],
    ['sin', /input right after it/],
    ['sin(2x', /partner/],
    ['3 4x', /operation between the two numbers/],
    ['e^x', /no e/],
    ['sin^2(x)', /power of a trig function/],
    ['|x|', /abs/],
    ['', /first/],
  ])('%s is not read', (text, message) => {
    const r = readExpr(text, { vars: ['x'] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(message)
  })

  it('a name on either side, or none where allowed; the variable alone or another name is a message', () => {
    for (const t of ['y = 2sin(x)', 'f(x) = 2sin(x)', '2sin(x) = y', 'y=2sin x']) expect(readFunctionAnswer(t, { variable: 'x', allowBare: false }).ok, t).toBe(true)
    for (const t of ['h(t) = 30 - 25cos(πt/2)', 'h = 30 - 25cos(pi t/2)', 'T(t) = 4 + cos(t)']) expect(readFunctionAnswer(t, { variable: 't', allowBare: false }).ok, t).toBe(true)
    expect(readFunctionAnswer('2sin(x)', { variable: 'x', allowBare: true }).ok).toBe(true)
    expect(readFunctionAnswer('2sin(x)', { variable: 'x', allowBare: false }).ok).toBe(false)
    expect(readFunctionAnswer('x = 2sin(y)', { variable: 'x', allowBare: false }).ok).toBe(false)
    expect(readFunctionAnswer('y = 5', { variable: 'x', allowBare: false })).toMatchObject({ ok: false, message: expect.stringMatching(/no x/) })
    expect(readFunctionAnswer('y = 2sin(t)', { variable: 'x', allowBare: false }).ok).toBe(false)
  })

  it('previews every function’s input in parentheses', () => {
    const r = readExpr('3 sin 2x + 1', { vars: ['x'] })
    expect(r.ok && r.tex).toBe('3 \\sin\\left(2 x\\right) + 1')
  })
})

describe('exact values at the special points', () => {
  it('sin, cos and tan at multiples of π/6 and π/4; undefined where the bottom is zero', () => {
    const v = (t: string, x: TrigExact) => {
      const r = evalExprExact(node(t), { x })
      return r.k === 'exact' ? exactText(r.v) : r.k
    }
    expect(v('3sin(2x - pi/2) + 1', piX(1, 4))).toBe('1')
    expect(v('3sin(2x - pi/2) + 1', piX(1, 2))).toBe('4')
    expect(v('3sin(2x - pi/2) + 1', piX(1))).toBe('-2')
    expect(v('2cos(x) + 1', piX(1, 6))).toBe('unknown')
    expect(v('2cos(x)', piX(1, 6))).toBe('√3')
    expect(v('tan(x)', piX(1, 2))).toBe('undef')
    expect(v('sec(x)', piX(1, 3))).toBe('2')
    expect(v('arcsin(x)', tx(q(-1, 2)))).toBe('-π/6')
    expect(v('arccos(x)', tx(q(2)))).toBe('undef')
    expect(v('sqrt(1 - x^2)', tx(q(1, 2)))).toBe('√3/2')
    expect(v('sin(x)', tx(q(1)))).toBe('unknown')
  })
})

describe('the same function', () => {
  const answer = node('3sin(2x - pi/2) + 1')
  const period = Math.PI
  const check = {
    variable: 'x',
    exactAt: [0, 1, 2, 3, 4].map((i) => piX(1 + i, 4)),
    samples: spreadSamples(0, 2 * period, 40),
  }
  it.each([
    '3sin(2(x - π/4)) + 1',
    '-3cos(2x) + 1',
    '3cos(2(x - π/2)) + 1',
    '3cos(2x - π) + 1',
    '-3sin(2(x + π/4)) + 1',
    '3sin(2x + 3π/2) + 1',
    '1 + 3sin(2x - pi/2)',
    '3 sin(2x - 5π/2) + 1',
  ])('y = 3 sin(2x − π/2) + 1 is %s', (form) => {
    expect(sameFunction(answer, node(form), check)).toBe(true)
  })
  it.each([
    '3sin(2x - π/4) + 1',
    '3sin(2x + π/2) + 1',
    '6sin(2x - π/2) + 1',
    '3sin(4x - π/2) + 1',
    '3sin(πx - π/2) + 1',
    '-3sin(2x - π/2) + 1',
    '3sin(2x - π/2) - 1',
    '3sin(2x - π/2)',
  ])('y = 3 sin(2x − π/2) + 1 is not %s', (form) => {
    expect(sameFunction(answer, node(form), check)).toBe(false)
  })
  it('a decimal in place of π is close but not the same', () => {
    const near = node('3sin(2x - 1.5708) + 1')
    expect(sameFunction(answer, near, check)).toBe(false)
    expect(nearlySameFunction(near, answer, check.samples, 'x')).toBe(true)
  })
  it('on a domain: cos(arcsin x) is √(1 − x²), and not −√(1 − x²) or √(1 + x²)', () => {
    const c = { variable: 'x', exactAt: [tx(q(0)), tx(q(1, 2)), tx(q(-1, 2)), tx(q(1))], samples: spreadSamples(-1, 1, 30) }
    expect(sameFunction(node('cos(arcsin(x))'), node('√(1 − x²)'), c)).toBe(true)
    expect(sameFunction(node('cos(arcsin(x))'), node('sqrt((1-x)(1+x))'), c)).toBe(true)
    expect(sameFunction(node('cos(arcsin(x))'), node('-√(1 − x²)'), c)).toBe(false)
    expect(sameFunction(node('cos(arcsin(x))'), node('√(1 + x²)'), c)).toBe(false)
    expect(sameFunction(node('tan(arcsin(x))'), node('x/√(1 − x²)'), { ...c, exactAt: [tx(q(0)), tx(q(1, 2))], samples: spreadSamples(-0.99, 0.99, 30) })).toBe(true)
    expect(sameFunction(node('tan(arcsin(x))'), node('x√(1 − x²)/(1 − x²)'), { ...c, exactAt: [tx(q(0)), tx(q(1, 2))], samples: spreadSamples(-0.99, 0.99, 30) })).toBe(true)
  })
})
