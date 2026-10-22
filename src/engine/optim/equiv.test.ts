/**
 * The equivalence checks against hand-made pairs: linear equations that are nonzero multiples of each other (and ones
 * that are not), equations solved for the quantity and compared by value in the domain, and curves such as xy = 500.
 */
import { describe, expect, it } from 'vitest'
import { degenerate, dependence, domainPoints, linearForm, sameCurve, sameLinear, sameQuantity, solvedFor } from './equiv'
import { readOptEquation, type OptEquation } from './read'

const wall = { x: [0, 250], y: [0, 500] } as const
const pts = domainPoints(wall, 11)

function eq(text: string, quantity = 'A'): OptEquation {
  const r = readOptEquation(text, quantity)
  if (!r.ok) throw new Error(`${text}: ${r.message}`)
  return r
}

describe('domain points', () => {
  it('are inside the domain, off its edges, all different and the same every time', () => {
    const again = domainPoints(wall, 11)
    expect(again).toEqual(pts)
    for (const p of pts) {
      expect(p.x).toBeGreaterThan(0)
      expect(p.x).toBeLessThan(250)
      expect(p.y).toBeGreaterThan(0)
      expect(p.y).toBeLessThan(500)
    }
    expect(new Set(pts.map((p) => p.x)).size).toBe(pts.length)
  })
})

describe('linear equations: the same when one is a nonzero multiple of the other', () => {
  const same = ['500 = 2x + y', 'y = 500 - 2x', '2x + y - 500 = 0', '4x + 2y = 1000', '-2x - y = -500', 'x = (500 - y)/2', 'y/2 + x = 250', '2(x + y) - y = 500']
  const different = ['2x + 2y = 500', 'x + 2y = 500', '2x + y = 400', 'y = 500 - x', 'x = 125', '2x - y = 500']

  it.each(same)('2x + y = 500 is %s', (text) => {
    const a = linearForm(eq('2x + y = 500'), pts)!
    const b = linearForm(eq(text), pts)
    expect(b).not.toBeNull()
    expect(sameLinear(b!, a)).toBe(true)
    expect(sameCurve(eq(text), eq('2x + y = 500'), pts)).toBe(true)
  })

  it.each(different)('2x + y = 500 is not %s', (text) => {
    expect(sameCurve(eq(text), eq('2x + y = 500'), pts)).toBe(false)
  })

  it('the three-pen fencing: 4x + 6y = 400 is y = (400 − 4x)/6 and 2x + 3y = 200, not 3x + 6y = 400 or 4x + 3y = 400', () => {
    const target = eq('4x + 6y = 400')
    for (const t of ['y = (400 - 4x)/6', '2x + 3y = 200', '400 = 4x + 6y', 'y = 200/3 - 2x/3']) expect(sameCurve(eq(t), target, pts), t).toBe(true)
    for (const t of ['3x + 6y = 400', '4x + 3y = 400', 'y = 400 - 4x/6', 'y = 400/6 - 4x']) expect(sameCurve(eq(t), target, pts), t).toBe(false)
  })

  it('an equation with no x and no y is true everywhere or nowhere', () => {
    expect(degenerate(linearForm(eq('x + y = y + x'), pts)!)).toBe('identity')
    expect(degenerate(linearForm(eq('x + y = x + y + 5'), pts)!)).toBe('contradiction')
    expect(degenerate(linearForm(eq('2x + y = 500'), pts)!)).toBeNull()
  })

  it('a curve is not linear, and is compared by solving for y', () => {
    expect(linearForm(eq('xy = 500'), pts)).toBeNull()
    expect(sameCurve(eq('y = 500/x'), eq('xy = 500'), pts)).toBe(true)
    expect(sameCurve(eq('y = 500/x'), eq('2x + y = 500'), pts)).toBe(false)
    expect(sameCurve(eq('xy = 600'), eq('xy = 500'), pts)).toBe(false)
  })

  it('an equation with the quantity in it is not a linear equation in x and y', () => {
    expect(linearForm(eq('A = 2x + y'), pts)).toBeNull()
    expect(sameCurve(eq('A = 2x + y'), eq('2x + y = 500'), pts)).toBe(false)
  })
})

describe('equations with the quantity: solved for it and compared by value', () => {
  it('the primary: A = xy in any form; A = 3xy, A = x + y and A = 2x + y are other equations', () => {
    const target = eq('A = xy')
    for (const t of ['xy = A', 'A = yx', 'A/x = y', '2A = 2xy', 'A - xy = 0', 'A = x*y']) expect(sameQuantity(eq(t), target, pts), t).toBe(true)
    for (const t of ['A = 3xy', 'A = x + y', 'A = 2x + y', 'A = 2xy', 'A = x^2 y']) expect(sameQuantity(eq(t), target, pts), t).toBe(false)
  })

  it('the final: A = x(500 − 2x) in every form, the vertex form too; slips differ', () => {
    const target = eq('A = x(500 - 2x)')
    for (const t of ['A = 500x - 2x^2', 'A = -2x^2 + 500x', 'A = 2x(250 - x)', 'A = -2(x - 125)^2 + 31250', 'x(500 - 2x) = A', '(A + 2x^2)/x = 500']) {
      expect(sameQuantity(eq(t), target, pts), t).toBe(true)
    }
    for (const t of ['A = -2x^2', 'A = 500x', 'A = x(500 - x)', 'A = 2x^2 - 500x', 'A = x(250 - x)']) expect(sameQuantity(eq(t), target, pts), t).toBe(false)
  })

  it('her three-pen slip: A = −4x²/3 is not A = 200x − 2x², and not A = (400x − 4x²)/3 either', () => {
    const pens = { x: [0, 100], y: [0, 400 / 6] } as const
    const p = domainPoints(pens, 11)
    const target = eq('A = 3x(400 - 4x)/6')
    expect(sameQuantity(eq('A = 200x - 2x^2'), target, p)).toBe(true)
    expect(sameQuantity(eq('A = -4x^2/3'), target, p)).toBe(false)
    expect(sameQuantity(eq('A = -4x^2/3'), eq('A = (400x - 4x^2)/3'), p)).toBe(false)
    expect(sameQuantity(eq('A = (400x - 4x^2)/3'), eq('A = 2x(400 - 4x)/6'), p)).toBe(true)
  })

  it('a quantity that cancels, or that is not there, cannot be solved for', () => {
    // A letter that cancels is not there: checked by value, not by spelling.
    expect(solvedFor(eq('A - A = xy'), 'a', pts)).toBe('absent')
    expect(solvedFor(eq('2x + y = 500'), 'a', pts)).toBe('absent')
    expect(typeof solvedFor(eq('A^2 = xy'), 'a', pts)).toBe('string')
  })

  it('dependence: the final equation depends on one letter, the primary on both', () => {
    const fin = solvedFor(eq('A = x(500 - 2x)'), 'a', pts)
    const pri = solvedFor(eq('A = xy'), 'a', pts)
    const inY = solvedFor(eq('A = y(500 - y)/2'), 'a', pts)
    if (typeof fin !== 'function' || typeof pri !== 'function' || typeof inY !== 'function') throw new Error('unsolved')
    expect(dependence(fin, pts)).toEqual({ x: true, y: false })
    expect(dependence(pri, pts)).toEqual({ x: true, y: true })
    expect(dependence(inY, pts)).toEqual({ x: false, y: true })
  })

  it('revenue and numbers: other letters, the same checks', () => {
    const rev = { x: [0, 23], y: [0, 460] } as const
    const p = domainPoints(rev, 11)
    expect(sameQuantity(eq('R = x(300 - 20(x - 8))', 'R'), eq('R = 460x - 20x^2', 'R'), p)).toBe(true)
    expect(sameQuantity(eq('R = x(300 + 20(x - 8))', 'R'), eq('R = 460x - 20x^2', 'R'), p)).toBe(false)
    const nums = { x: [-40, 80], y: [-40, 80] } as const
    const q = domainPoints(nums, 11)
    expect(sameQuantity(eq('S = x^2 + (40 - x)^2', 'S'), eq('S = 2x^2 - 80x + 1600', 'S'), q)).toBe(true)
    expect(sameQuantity(eq('S = x^2 + 1600 - x^2', 'S'), eq('S = 2x^2 - 80x + 1600', 'S'), q)).toBe(false)
  })
})
