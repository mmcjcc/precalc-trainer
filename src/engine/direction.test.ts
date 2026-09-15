import { describe, expect, it } from 'vitest'
import { verifyStep } from '@/engine'

// Which way the symbol points is the single most important check in the app (SPEC). Each case is
// a realistic line; the lesson must name the actual mistake, not just "wrong way".
const CASES: [string, string, string][] = [
  ['-14 <= -14x', 'x >= 1', 'no_sign_flip'],
  ['-14 <= -14x', '1 <= x', 'no_sign_flip'],
  ['-14 <= -14x', 'x <= 1', 'ok'],
  ['-14 <= -14x', '1 >= x', 'ok'],
  ['3x + 12 < 9', 'x > -1', 'flip_on_positive'],
  ['3x + 12 < 9', 'x < -1', 'ok'],
  ['3x + 12 < 9', '-1 > x', 'ok'],
  ['2x < 6', 'x > 3', 'flip_on_positive'],
  ['12 > 3x', 'x > 4', 'flip_on_positive'],
  ['-2x + 4 > 10', 'x > -3', 'no_sign_flip'],
  ['-2x + 4 > 10', 'x < -3', 'ok'],
  ['x + 2 < 5', 'x > 3', 'flip_on_add'],
  ['2x + 1 < x + 5', 'x > 4', 'flip_on_add'],
  ['3 < x', 'x < 3', 'swap_sides_no_reverse'],
  ['-5x + 6 <= 3', 'x <= 3/5', 'no_sign_flip'],
  ['-5x + 6 <= 3', 'x >= 3/5', 'ok'],
]

describe('inequality direction diagnoses', () => {
  for (const [prev, next, want] of CASES) {
    it(`${prev}  ->  ${next}: ${want}`, () => {
      const r = verifyStep(prev, next, { vars: ['x'], seed: 7 })
      if (want === 'ok') {
        expect(r.ok, r.pattern?.id).toBe(true)
      } else {
        expect(r.ok).toBe(false)
        expect(r.pattern?.id).toBe(want)
      }
    })
  }
})
