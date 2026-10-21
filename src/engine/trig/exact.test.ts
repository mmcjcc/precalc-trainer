import { describe, expect, it } from 'vitest'
import { exactAdd, exactAscii, exactDiv, exactEq, exactInt, exactInv, exactMul, exactNum, exactPow, exactSay, exactSqrt, exactTex, exactText, tx } from './exact'
import { q } from './rational'

describe('exact values c·√m·πᵏ', () => {
  it('normal form: square factors out of the radical, fractions in lowest terms', () => {
    expect(exactText(tx(q(1, 2), 12))).toBe('√3')
    expect(exactText(tx(q(3, 6), 8))).toBe('√2')
    expect(exactText(tx(q(0), 5))).toBe('0')
    expect(exactEq(tx(q(2, 4), 3), tx(q(1, 2), 3))).toBe(true)
  })

  it('a quotient by a radical is rationalized', () => {
    expect(exactText(exactInv(tx(q(1), 2)))).toBe('√2/2')
    expect(exactText(exactDiv(exactInt(3), tx(q(1), 13)))).toBe('3√13/13')
    expect(exactText(exactDiv(exactInt(2), tx(q(1), 3)))).toBe('2√3/3')
    expect(exactText(exactDiv(tx(q(1), 13), exactInt(-2)))).toBe('-√13/2')
  })

  it('π powers, products and like terms', () => {
    const pi = tx(q(1), 1, 1)
    expect(exactText(exactMul(exactInt(5), exactDiv(pi, exactInt(6))))).toBe('5π/6')
    expect(exactText(exactDiv(exactInt(27000), pi))).toBe('27000/π')
    expect(exactText(exactMul(tx(q(1, 216), 1, 1), pi))).toBe('π^2/216')
    expect(exactSay(exactMul(tx(q(-1, 216), 1, 1), pi))).toBe('−π²/216')
    expect(exactText(exactAdd(tx(q(2), 1, 1), tx(q(-1, 6), 1, 1))!)).toBe('11π/6')
    expect(exactAdd(exactInt(1), tx(q(1), 3))).toBeNull()
    expect(exactText(exactPow(tx(q(1), 3), 2))).toBe('3')
    expect(exactText(exactDiv(exactInt(5), exactMul(exactInt(6), pi)))).toBe('5/(6π)')
  })

  it('square roots of rationals', () => {
    expect(exactText(exactSqrt(exactInt(13))!)).toBe('√13')
    expect(exactText(exactSqrt(exactInt(20))!)).toBe('2√5')
    expect(exactText(exactSqrt(tx(q(3, 4)))!)).toBe('√3/2')
    expect(exactSqrt(exactInt(-4))).toBeNull()
    expect(exactSqrt(tx(q(1), 2))).toBeNull()
  })

  it('three spellings and KaTeX', () => {
    const v = tx(q(-2, 3), 3)
    expect(exactText(v)).toBe('-2√3/3')
    expect(exactAscii(v)).toBe('-2sqrt(3)/3')
    expect(exactSay(v)).toBe('−2√3/3')
    expect(exactTex(v)).toBe('-\\frac{2\\sqrt{3}}{3}')
    expect(exactTex(tx(q(5, 6), 1, 1))).toBe('\\frac{5\\pi}{6}')
    expect(exactTex(tx(q(1), 1, 1))).toBe('\\pi')
    expect(exactTex(exactInt(-1))).toBe('-1')
    expect(exactNum(tx(q(1, 2), 3))).toBeCloseTo(Math.sqrt(3) / 2, 15)
  })
})
