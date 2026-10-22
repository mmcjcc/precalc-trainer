/**
 * One value and the quadrant (uc.given), against Math: for each of the six functions, each quadrant where its value
 * has that sign, and values from Pythagorean triples and from pairs that leave a radical, the point lies in that
 * quadrant, gives the value back, and every other function at it is what Math says at θ = atan2(y, x).
 */
import { describe, expect, it } from 'vitest'
import type { Quadrant } from './angle'
import { exactNum, exactText, type TrigExact } from './exact'
import { givenCoordinateSlips, givenPoint, givenRSlips, givenValue, givenValueSlips, quadrantsWithSign, signIn } from './given'
import { q, type Q } from './rational'
import { valueEq, valueText, type TrigFn } from './values'

const FNS: TrigFn[] = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']

function math(fn: TrigFn, t: number): number {
  switch (fn) {
    case 'sin':
      return Math.sin(t)
    case 'cos':
      return Math.cos(t)
    case 'tan':
      return Math.tan(t)
    case 'csc':
      return 1 / Math.sin(t)
    case 'sec':
      return 1 / Math.cos(t)
    case 'cot':
      return 1 / Math.tan(t)
  }
}

/** Sizes of a given value, written by hand: less than one for sin and cos, more for csc and sec, any for tan and cot. */
const SIZES: Record<TrigFn, Q[]> = {
  sin: [q(5, 13), q(3, 5), q(2, 3), q(1, 4), q(8, 17)],
  cos: [q(4, 5), q(12, 13), q(1, 3), q(2, 7), q(15, 17)],
  tan: [q(3, 4), q(5, 12), q(2), q(3, 2), q(7, 24)],
  csc: [q(13, 5), q(5, 3), q(3, 2), q(4), q(17, 8)],
  sec: [q(5, 4), q(13, 12), q(3), q(7, 2), q(25, 7)],
  cot: [q(4, 3), q(12, 5), q(1, 2), q(2, 3), q(24, 7)],
}

describe('the point for one value and a quadrant, against Math', () => {
  it('every function, every quadrant with the value’s sign, every size', () => {
    for (const fn of FNS) {
      for (const size of SIZES[fn]) {
        for (const sign of [1, -1] as const) {
          const value: Q = { n: sign * size.n, d: size.d }
          const quadrants = quadrantsWithSign(fn, sign)
          expect(quadrants).toHaveLength(2)
          for (const qd of quadrants) {
            const p = givenPoint(fn, value, qd)
            const x = exactNum(p.x)
            const y = exactNum(p.y)
            const r = exactNum(p.r)
            expect(Math.hypot(x, y), `${fn} = ${value.n}/${value.d} in Q${qd}: r`).toBeCloseTo(r, 12)
            // In the quadrant asked.
            const where: Quadrant = x > 0 ? (y > 0 ? 1 : 4) : y > 0 ? 2 : 3
            expect(where).toBe(qd)
            // The value back, and every function at θ.
            const t = Math.atan2(y, x)
            expect(math(fn, t)).toBeCloseTo(value.n / value.d, 12)
            for (const g of FNS) {
              const v = givenValue(g, p)
              if (v === 'undefined') throw new Error('no axis here')
              expect(exactNum(v), `${g} at Q${qd}`).toBeCloseTo(math(g, t), 10)
              expect(Math.sign(exactNum(v))).toBe(signIn(g, qd))
            }
          }
        }
      }
    }
  })

  it('a value with the other sign for the quadrant is refused', () => {
    expect(() => givenPoint('sin', q(5, 13), 3)).toThrow()
    expect(() => givenPoint('tan', q(-3, 4), 1)).toThrow()
  })
})

describe('the brief’s case and the slips', () => {
  it('sin θ = 5/13 with cos θ < 0: Quadrant II, x = −12, cos θ = −12/13, tan θ = −5/12', () => {
    const p = givenPoint('sin', q(5, 13), 2)
    expect([exactText(p.x), exactText(p.y), exactText(p.r), p.missing]).toEqual(['-12', '5', '13', 'x'])
    expect(valueText(givenValue('cos', p))).toBe('-12/13')
    expect(valueText(givenValue('tan', p))).toBe('-5/12')
    expect(valueText(givenValue('sec', p))).toBe('-13/12')
    const slips = givenCoordinateSlips(p, 2).map((s) => `${s.id}=${exactText(s.value as TrigExact)}`)
    expect(slips).toEqual(['trig_coordinate_sign=12', 'trig_pythag_added=-√194', 'trig_side_not_rooted=-144'])
    const cos = givenValueSlips('cos', p, 2).map((s) => `${s.id}=${exactText(s.value as TrigExact)}`)
    expect(cos).toEqual(['trig_sign_quadrant=12/13', 'trig_r_left_out=-12', 'trig_sin_cos_swapped=5/13'])
  })

  it('sin θ = 2/3 in Quadrant II leaves a radical: x = −√5, tan θ = −2√5/5', () => {
    const p = givenPoint('sin', q(2, 3), 2)
    expect(exactText(p.x)).toBe('-√5')
    expect(valueText(givenValue('tan', p))).toBe('-2√5/5')
    expect(valueText(givenValue('cot', p))).toBe('-√5/2')
  })

  it('tan θ = −3/4 in Quadrant II: r = 5; the slips are 25 and −5', () => {
    const p = givenPoint('tan', q(-3, 4), 2)
    expect([exactText(p.x), exactText(p.y), exactText(p.r), p.missing]).toEqual(['-4', '3', '5', 'r'])
    expect(givenRSlips(p).map((s) => `${s.id}=${exactText(s.value as TrigExact)}`)).toEqual(['trig_r_not_rooted=25', 'trig_r_negative=-5'])
    expect(valueText(givenValue('cos', p))).toBe('-4/5')
  })

  it('no slip is the answer', () => {
    for (const fn of FNS) {
      for (const size of SIZES[fn]) {
        for (const qd of quadrantsWithSign(fn, 1)) {
          const p = givenPoint(fn, size, qd)
          if (p.missing !== 'r') for (const s of givenCoordinateSlips(p, qd)) expect(valueEq(s.value, p[p.missing])).toBe(false)
          else for (const s of givenRSlips(p)) expect(valueEq(s.value, p.r)).toBe(false)
          for (const g of FNS) for (const s of givenValueSlips(g, p, qd)) expect(valueEq(s.value, givenValue(g, p)), `${g}: ${s.id}`).toBe(false)
        }
      }
    }
  })
})
