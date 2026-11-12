import { describe, expect, it } from 'vitest'
import { checkFactored, factorOverIntegers, readProduct, sameFactorization } from './factor'

/** The engine's complete factorization, as text. */
const full = (f: string) => factorOverIntegers(f)!.text

describe('factorOverIntegers: the complete factorization over the integers', () => {
  // Each multiplied out by hand first (written beside each line), then pinned.
  const pins: [string, string][] = [
    // (x − 2)(x^2 + 2x + 4) = x^3 + 2x^2 + 4x − 2x^2 − 4x − 8 = x^3 − 8
    ['x^3 - 8', '(x - 2)(x^2 + 2x + 4)'],
    // (x + 3)(x^2 − 3x + 9) = x^3 − 3x^2 + 9x + 3x^2 − 9x + 27 = x^3 + 27
    ['x^3 + 27', '(x + 3)(x^2 - 3x + 9)'],
    // (2x + 3)(4x^2 − 6x + 9) = 8x^3 − 12x^2 + 18x + 12x^2 − 18x + 27 = 8x^3 + 27
    ['8x^3 + 27', '(2x + 3)(4x^2 - 6x + 9)'],
    // (3x − 1)(9x^2 + 3x + 1) = 27x^3 + 9x^2 + 3x − 9x^2 − 3x − 1 = 27x^3 − 1
    ['27x^3 - 1', '(3x - 1)(9x^2 + 3x + 1)'],
    // 2(x + 3)(x^2 − 3x + 9) = 2(x^3 + 27) = 2x^3 + 54
    ['2x^3 + 54', '2(x + 3)(x^2 - 3x + 9)'],
    // x(x − 2)(x^2 + 2x + 4) = x(x^3 − 8) = x^4 − 8x
    ['x^4 - 8x', 'x(x - 2)(x^2 + 2x + 4)'],
    // (x − 2)(x + 2)(x^2 + 4) = (x^2 − 4)(x^2 + 4) = x^4 − 16
    ['x^4 - 16', '(x - 2)(x + 2)(x^2 + 4)'],
    // (2x + 3)(3x − 1) = 6x^2 − 2x + 9x − 3 = 6x^2 + 7x − 3
    ['6x^2 + 7x - 3', '(2x + 3)(3x - 1)'],
    // (x − 2)(x − 3)(x + 3) = (x − 2)(x^2 − 9) = x^3 − 2x^2 − 9x + 18
    ['x^3 - 2x^2 - 9x + 18', '(x - 2)(x - 3)(x + 3)'],
    // 3x(x − 2)(x + 2) = 3x(x^2 − 4) = 3x^3 − 12x
    ['3x^3 - 12x', '3x(x - 2)(x + 2)'],
    // 2(x − 2)(x^2 + 2x + 4) = 2(x^3 − 8) = 2x^3 − 16
    ['2x^3 - 16', '2(x - 2)(x^2 + 2x + 4)'],
    // (x − 1)(x + 1)(x − 2)(x + 2) = (x^2 − 1)(x^2 − 4) = x^4 − 5x^2 + 4
    ['x^4 - 5x^2 + 4', '(x - 1)(x + 1)(x - 2)(x + 2)'],
    // (x + 7)(x − 7) = x^2 − 49
    ['x^2 - 49', '(x + 7)(x - 7)'],
    // (3x + 5)(3x − 5) = 9x^2 − 25
    ['9x^2 - 25', '(3x + 5)(3x - 5)'],
    // (x + 5)^2 = x^2 + 10x + 25
    ['x^2 + 10x + 25', '(x + 5)^2'],
    // (2x − 3)^2 = 4x^2 − 12x + 9
    ['4x^2 - 12x + 9', '(2x - 3)^2'],
    // (x + 3)(x^2 + 4) = x^3 + 4x + 3x^2 + 12
    ['x^3 + 3x^2 + 4x + 12', '(x + 3)(x^2 + 4)'],
    // 6x^2(2x + 3) = 12x^3 + 18x^2
    ['12x^3 + 18x^2', '6x^2(2x + 3)'],
  ]
  for (const [f, product] of pins) {
    it(`${f} = ${product}`, () => {
      const got = factorOverIntegers(f)
      expect(got).not.toBeNull()
      expect(sameFactorization(got!.text, product), `${got!.text} vs ${product}`).toBe(true)
      expect(checkFactored(f, product)?.status).toBe('complete')
    })
  }

  it('prints the unit, x first, then by degree with linear factors by their zero', () => {
    expect(full('x^4 - 16')).toBe('(x + 2)(x - 2)(x^2 + 4)')
    expect(full('2x^3 + 54')).toBe('2(x + 3)(x^2 - 3x + 9)')
    expect(full('x^4 - 8x')).toBe('x(x - 2)(x^2 + 2x + 4)')
    expect(full('x^2 + 10x + 25')).toBe('(x + 5)^2')
    expect(full('-x^2 + 9')).toBe('-(x + 3)(x - 3)')
    expect(full('12x^3 + 18x^2')).toBe('6x^2(2x + 3)')
  })

  it('a sum of two squares is prime over the integers; a constant or a non-integer polynomial is outside', () => {
    expect(factorOverIntegers('x^2 + 49')!.prime).toBe(true)
    expect(factorOverIntegers('4x^2 + 9')!.prime).toBe(true)
    expect(factorOverIntegers('x^2 - 49')!.prime).toBe(false)
    expect(factorOverIntegers('2x^2 + 8')!.prime).toBe(false)
    expect(factorOverIntegers('7')).toBeNull()
    expect(factorOverIntegers('x^2 + x/2')).toBeNull()
  })
})

describe('readProduct: her answer, factor by factor', () => {
  it('splits implicit and written products, powers, minus signs and numbers in front', () => {
    const r = readProduct('-2x^2(x - 3)^2(2 - x)')
    if (!r.ok) throw new Error('expected a reading')
    expect(r.constant).toEqual({ n: -2, d: 1 })
    expect(r.leaves.map((l) => [l.text, l.mult])).toEqual([
      ['x', 2],
      ['x - 3', 2],
      ['-x + 2', 1],
    ])
    expect(r.isProduct).toBe(true)
  })

  it('the polynomial typed back is not a product; a number times one factor is', () => {
    const typed = readProduct('x^3 - 8')
    expect(typed.ok && typed.isProduct).toBe(false)
    const minus = readProduct('-(x^2 - 9)')
    expect(minus.ok && minus.isProduct).toBe(false)
    const gcf = readProduct('3(2x + 3)')
    expect(gcf.ok && gcf.isProduct).toBe(true)
  })

  it('unreadable text and non-polynomials are told apart', () => {
    const bad = readProduct('(x - 2')
    expect(bad.ok).toBe(false)
    expect('error' in bad).toBe(true)
    const root = readProduct('(x - sqrt(2))(x + sqrt(2))')
    expect(root.ok).toBe(false)
    expect('notPolynomial' in root).toBe(true)
  })
})

describe('checkFactored: right, unfinished, typed back or different', () => {
  it('accepts any order and either sign of a factor', () => {
    expect(checkFactored('x^3 - 8', '(x^2 + 2x + 4)(x - 2)')?.status).toBe('complete')
    expect(checkFactored('x^3 - 2x^2 - 9x + 18', '(2 - x)(3 - x)(x + 3)')?.status).toBe('complete')
    expect(checkFactored('x^3 - 2x^2 - 9x + 18', '(2 - x)(3 - x)(-x - 3)')?.status).toBe('not_equal')
    expect(checkFactored('x^3 - 2x^2 - 9x + 18', '-(2 - x)(x - 3)(x + 3)')?.status).toBe('complete')
    expect(checkFactored('x^4 - 16', '(x^2 + 4)(x + 2)(x - 2)')?.status).toBe('complete')
  })

  it('a right product with a factor that still factors is incomplete, and says which factor', () => {
    const early = checkFactored('x^4 - 16', '(x^2 + 4)(x^2 - 4)')
    expect(early?.status).toBe('incomplete')
    if (early?.status === 'incomplete') {
      expect(early.reason).toBe('splits')
      expect(early.leaf.text).toBe('x^2 - 4')
    }
    const inside = checkFactored('2x^3 + 54', '(2x + 6)(x^2 - 3x + 9)')
    expect(inside?.status).toBe('incomplete')
    if (inside?.status === 'incomplete') {
      expect(inside.reason).toBe('common_factor')
      expect(inside.leaf.text).toBe('2x + 6')
    }
    const xInside = checkFactored('12x^3 + 18x^2', '6x(2x^2 + 3x)')
    expect(xInside?.status === 'incomplete' && xInside.reason).toBe('common_factor')
    const grouping = checkFactored('x^3 - 2x^2 - 9x + 18', '(x - 2)(x^2 - 9)')
    expect(grouping?.status === 'incomplete' && grouping.leaf.text).toBe('x^2 - 9')
  })

  it('the polynomial typed back, a different product, a fraction inside and unreadable text', () => {
    expect(checkFactored('x^3 - 8', 'x^3 - 8')?.status).toBe('not_product')
    expect(checkFactored('x^3 - 8', '-8 + x^3')?.status).toBe('not_product')
    expect(checkFactored('x^3 - 8', '(x - 2)(x^2 - 2x + 4)')?.status).toBe('not_equal')
    expect(checkFactored('4x^2 - 1', '4(x - 1/2)(x + 1/2)')?.status).toBe('not_integer')
    expect(checkFactored('x^3 - 8', '(x - 2)(x^2 + ')?.status).toBe('unreadable')
    expect(checkFactored('x^3 - 8', '')?.status).toBe('unreadable')
  })
})
