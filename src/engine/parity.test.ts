import { describe, expect, it } from 'vitest'
import { checkParity } from './parity'

describe('checkParity', () => {
  it('classifies even / odd / neither polynomials', () => {
    expect(checkParity('3x^4 - 2x^2 + 5').verdict).toBe('even')
    expect(checkParity('x^3 - 4x').verdict).toBe('odd')
    expect(checkParity('x^3 + x^2').verdict).toBe('neither')
  })

  it('flags an asymmetric domain as neither', () => {
    const r = checkParity('sqrt(x)')
    expect(r.verdict).toBe('neither')
    expect(r.reason).toBe('domain_asymmetric')
    expect(checkParity('1/(x+2)').verdict).toBe('neither')
  })

  it('handles roots and abs', () => {
    expect(checkParity('cbrt(x)').verdict).toBe('odd')
    expect(checkParity('abs(x)').verdict).toBe('even')
    expect(checkParity('x*abs(x)').verdict).toBe('odd')
    expect(checkParity('abs(x)+x').verdict).toBe('neither')
  })
})
