import { describe, expect, it } from 'vitest'
import { verifyStep } from './verify'
import { HOMEWORK } from '../content/fixtures/homework'

describe('verifyStep — legal moves', () => {
  it('accepts dividing an inequality by a negative with a flip', () => {
    const r = verifyStep('-14 <= -14x', '1 >= x')
    expect(r.ok).toBe(true)
  })

  it('accepts the swapped form x <= 1', () => {
    const r = verifyStep('-14 <= -14x', 'x <= 1')
    expect(r.ok).toBe(true)
  })

  it('accepts adding to both sides', () => {
    const r = verifyStep('3x - 2 <= 7', '3x <= 9')
    expect(r.ok).toBe(true)
  })

  it('accepts swap x and y', () => {
    const r = verifyStep('y = cbrt(x+1)', 'x = cbrt(y+1)')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.kind).toBe('swapVars')
  })

  it('accepts a full distribution', () => {
    const r = verifyStep('x(y+2) = 0', 'xy + 2x = 0')
    expect(r.ok).toBe(true)
  })
})

describe('verifyStep — illegal moves', () => {
  it('rejects no-sign-flip and names the pattern', () => {
    const r = verifyStep('-14 <= -14x', 'x >= 1')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.pattern?.id).toBe('no_sign_flip')
    expect(r.counterexample).toBeTruthy()
  })

  it('rejects minus-teleport', () => {
    const r = verifyStep('y = 1/(-x+2)', 'y = -1/(x+2)')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.pattern?.id).toBe('minus_teleport')
  })

  it('rejects partial distribution', () => {
    const r = verifyStep('x(y+2) = 0', 'xy + 2 = 0')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.pattern?.id).toBe('partial_distribute')
  })

  it('rejects folding a constant into a cube root', () => {
    const r = verifyStep('y = cbrt(7x+3)-1', 'y = cbrt(7x+2)')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.pattern?.id).toBe('const_into_radical')
  })

  it('does not treat every pair of equations as equivalent', () => {
    const r = verifyStep('x = 2', 'x = 5')
    expect(r.ok).toBe(false)
  })
})

describe('homework fixtures', () => {
  it('matches the expected pattern (or accepts legal steps)', () => {
    for (const row of HOMEWORK) {
      const r = verifyStep(row.old, row.new)
      if (row.expectedPattern == null) {
        expect(r.ok, row.id).toBe(true)
      } else {
        expect(r.ok, row.id).toBe(false)
        if (!r.ok) expect(r.pattern?.id, row.id).toBe(row.expectedPattern)
      }
    }
  })
})
