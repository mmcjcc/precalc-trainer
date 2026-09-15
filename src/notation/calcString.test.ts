import { describe, expect, it } from 'vitest'
import { assertNoFractionalPow, toNspire, toTi84 } from './calcString'

const CASES: { expr: string; indep?: string }[] = [
  { expr: 'cbrt(7x+3)-1' },
  { expr: 'x(y+2)' },
  { expr: '1/(-x+2)' },
  { expr: '3x-5' },
  { expr: 'sqrt((x+7)/4)' },
  { expr: 'x^(1/3)' },
  { expr: '(x+1)^(1/3) - 2' },
]

describe('calculator serializers', () => {
  it('never emits ^(1/3) or ^(1/2)', () => {
    for (const c of CASES) {
      const a = toTi84(c.expr, c.indep)
      const b = toNspire(c.expr, c.indep)
      assertNoFractionalPow(a)
      assertNoFractionalPow(b)
      expect(a).not.toMatch(/\^\s*\(?\s*1\s*\//)
      expect(b).not.toMatch(/\^\s*\(?\s*1\s*\//)
      expect(b).not.toContain('cbrt')
    }
  })

  it('still rejects a fractional power if one ever appears', () => {
    expect(() => assertNoFractionalPow('X^(1/3)')).toThrow()
    expect(() => assertNoFractionalPow('x^(1/2)')).toThrow()
    expect(() => assertNoFractionalPow('x^2+1/3')).not.toThrow()
  })

  it('uses ³√ on TI-84 and root(u,3) on Nspire', () => {
    expect(toTi84('cbrt(7x+3)-1')).toBe('³√(7X+3)-1')
    expect(toNspire('cbrt(7x+3)-1')).toBe('root(7*x+3,3)-1')
    expect(toNspire('x^(1/3)')).toBe('root(x,3)')
  })

  it('inserts * before ( on Nspire', () => {
    expect(toNspire('x(y+2)')).toBe('x*(y+2)')
    expect(toTi84('x(y+2)')).toBe('X(Y+2)')
  })
})

describe('parenthesis policy', () => {
  it('Nspire wraps a / or ^ operand only when it is not a single number, symbol or call', () => {
    expect(toNspire('(1/4)x')).toBe('1/4*x')
    expect(toNspire('(5/4)y - 4', 'y')).toBe('5/4*x-4')
    expect(toNspire('(4/3)(x - 6)')).toBe('4/3*(x-6)')
    expect(toNspire('1/x + 6')).toBe('1/x+6')
    expect(toNspire('(x-3)/-3')).toBe('(x-3)/(-3)')
    expect(toNspire('(6 - 2x)/(x - 1)')).toBe('(6-2*x)/(x-1)')
    expect(toNspire('2/(3x)')).toBe('2/(3*x)')
    expect(toNspire('abs(x-2)/3')).toBe('abs(x-2)/3')
    expect(toNspire('x^2 + 9')).toBe('x^2+9')
    expect(toNspire('x^(-2)')).toBe('x^(-2)')
  })

  it('Nspire peels nested parentheses without losing the ones precedence needs', () => {
    expect(toNspire('((x - 2)^3 - 10)/3')).toBe('((x-2)^3-10)/3')
    expect(toNspire('(3x+1)-(x+5)')).toBe('3*x+1-(x+5)')
    expect(toNspire('(x)-(-8)')).toBe('x-(-8)')
    expect(toNspire('-(x+1)')).toBe('-(x+1)')
    expect(toNspire('-(x - 3)^2 + 4')).toBe('-(x-3)^2+4')
    expect(toNspire('(-2)^2')).toBe('(-2)^2')
    expect(toNspire('-1/(x + 6) + 3')).toBe('-1/(x+6)+3')
    expect(toNspire('(2(x + 5))-(12)')).toBe('2*(x+5)-12')
  })

  it('TI-84 follows the same policy, keeping parens around a quotient used as a factor', () => {
    expect(toTi84('(3/4)x + 6')).toBe('(3/4)X+6')
    expect(toTi84('1/x + 6')).toBe('1/X+6')
    expect(toTi84('(x-3)/-3')).toBe('(X-3)/((-)3)')
    expect(toTi84('5x^3 - 3x')).toBe('5X^3-3X')
    expect(toTi84('-(x - 3)^2 + 4')).toBe('(-)(X-3)^2+4')
    expect(toTi84('((x - 2)^3 - 10)/3')).toBe('((X-2)^3-10)/3')
    expect(toTi84('x*2')).toBe('X*2')
  })

  it('never prints a lone number or letter in parentheses around / or ^', () => {
    const lone = /\((?:\d+|[A-Za-z])\)[/^]|[/^]\((?:\d+|[A-Za-z])\)/
    for (const e of ['(3/4)x + 6', '1/x + 6', 'x^2 + 9', '5x^3 - 3x', '((x - 2)^3 - 10)/3', '(1/4)x', 'x/2']) {
      expect(toTi84(e), e).not.toMatch(lone)
      expect(toNspire(e), e).not.toMatch(lone)
    }
  })
})
