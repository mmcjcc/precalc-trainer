import { describe, expect, it } from 'vitest'
import type { StepContext, StepResult } from '@/shared/types'
import { verifyStep } from './step'
import { verifyRewrite } from './expressions'
import { isOneToOne } from './oneToOne'
import { checkParitySeeded } from './parity'

const CTX: StepContext = { vars: ['x', 'y', 'n'], seed: 7 }
const INV: StepContext = { ...CTX, allowSwap: true }

function step(prev: string, next: string, ctx: StepContext = CTX): StepResult {
  return verifyStep(prev, next, ctx)
}

function expectOk(r: StepResult, label: string) {
  expect(r.ok, `${label}\n${JSON.stringify(r, null, 1)}`).toBe(true)
}

describe('engine-design §9 — expected verdicts', () => {
  it('1: -14 <= -14x → x >= 1 is NO_SIGN_FLIP with counterexample x = 0', () => {
    const r = step('-14 <= -14x', 'x >= 1')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('not_equivalent')
    expect(r.pattern?.id).toBe('no_sign_flip')
    expect(r.counterexample?.point.x).toBe(0)
    expect(r.counterexample?.oldTruth).toBe(true)
    expect(r.counterexample?.newTruth).toBe(false)
  })

  it('2: -14 <= -14x → x <= 1 is a divide-by-negative flip', () => {
    const r = step('-14 <= -14x', 'x <= 1')
    expectOk(r, '2')
    expect(r.verdict).toBe('equivalent')
    expect(r.detected?.tag).toBe('mul_div_neg_flip')
    expect(r.acceptableChips).toContain('mul_div')
  })

  it('3: -14 <= -14x → 1 >= x is equivalent', () => {
    const r = step('-14 <= -14x', '1 >= x')
    expectOk(r, '3')
    expect(r.detected?.chip).toBe('mul_div')
    expect(r.detected?.detail).toMatch(/−14/)
  })

  it('4: minus teleport is caught', () => {
    const r = step('y = 1/(-x+2)', 'y = -1/(x+2)')
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('minus_teleport')
    expect(r.counterexample).toBeTruthy()
  })

  it('5: y = 1/(-x+2) → y = -1/(x-2) is a rewrite', () => {
    const r = step('y = 1/(-x+2)', 'y = -1/(x-2)')
    expectOk(r, '5')
    expect(r.acceptableChips).toContain('rewrite_fraction')
  })

  it('6: x^2 = 9 → x = 3 loses −3 (DROPPED_PM)', () => {
    const r = step('x^2 = 9', 'x = 3')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('lost_subset')
    expect(r.pattern?.id).toBe('dropped_pm')
    expect(r.counterexample?.point.x).toBe(-3)
  })

  it('7: x^2 = 9 → x = ±3 / x = 3 or x = -3 keeps both roots', () => {
    for (const next of ['x = +-3', 'x = ±3', 'x = 3 or x = -3']) {
      const r = step('x^2 = 9', next)
      expectOk(r, `7: ${next}`)
      expect(r.detected?.tag).toBe('root_both_pm')
      expect(r.acceptableChips).toEqual(['root_both'])
    }
  })

  it('8: sqrt(x) = -2 → x = 4 is rejected as extraneous (√4 = 2 ≠ −2)', () => {
    const r = step('sqrt(x) = -2', 'x = 4')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('extraneous_superset')
    expect(r.counterexample?.point.x).toBe(4)
    expect(r.counterexample?.message).toMatch(/x = 4/)
  })

  it('9: swap x and y only with allowSwap', () => {
    const swapped = step('y = (x+1)^3', 'x = (y+1)^3', INV)
    expectOk(swapped, '9 inverse')
    expect(swapped.verdict).toBe('equivalent_by_rename')
    expect(swapped.swapped).toBe(true)
    expect(swapped.detected?.chip).toBe('swap_xy')

    const plain = step('y = (x+1)^3', 'x = (y+1)^3')
    expect(plain.ok).toBe(false)
    expect(plain.verdict).toBe('not_equivalent')
    expect(plain.counterexample).toBeTruthy()
    const ce = plain.counterexample!
    expect(Number.isInteger(ce.point.x)).toBe(true)
    expect(Number.isInteger(ce.point.y)).toBe(true)
  })

  it('10: renaming only one letter is SWAP_MISNAME', () => {
    for (const ctx of [INV, CTX]) {
      const r = step('y = (x+1)^3', 'x = (x+1)^3', ctx)
      expect(r.ok).toBe(false)
      expect(r.pattern?.id).toBe('swap_misname')
    }
  })

  it('11: cube root of both sides (cbrt and ^(1/3))', () => {
    for (const next of ['cbrt(x) = y + 1', 'x^(1/3) = y + 1']) {
      const r = step('x = (y+1)^3', next, INV)
      expectOk(r, `11: ${next}`)
      expect(r.detected?.tag).toBe('cube_root_both')
    }
  })

  it('12: constant folded into the radical', () => {
    const r = step('cbrt(7x+3) - 1 = y', 'cbrt(7x+2) = y')
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('const_into_radical')
  })

  it('13: partial distribution in two variables', () => {
    const r = step('x(y+2) = 5', 'xy + 2 = 5')
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('partial_distribute')
    expect(r.counterexample?.message).toMatch(/needs y/)
  })

  it('14: full distribution is a rewrite (distribute, exact)', () => {
    const r = step('x(y+2) = 5', 'xy + 2x = 5')
    expectOk(r, '14')
    expect(r.detected?.chip).toBe('distribute')
    expect(r.acceptableChips).toEqual(['distribute'])
  })

  it('15: multiply both sides by 5/3', () => {
    const r = step('(3/5)y = x - 2', 'y = (5/3)(x-2)')
    expectOk(r, '15')
    expect(r.detected?.chip).toBe('mul_div')
  })

  it('16: reciprocal applied to one term only', () => {
    const r = step('(3/5)y = x - 2', 'y = (5/3)x - 2')
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('reciprocal_coeff')
  })

  it('17: x < 3 → x <= 3 differs at x = 3', () => {
    const r = step('x < 3', 'x <= 3')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('not_equivalent')
    expect(r.counterexample?.point.x).toBe(3)
  })

  it('18: chained inequality', () => {
    expectOk(step('-3 < 2x+1 <= 5', '-2 < x <= 2'), '18a')
    const bad = step('-3 < 2x+1 <= 5', '-2 <= x <= 2')
    expect(bad.ok).toBe(false)
    expect(bad.counterexample?.point.x).toBe(-2)
  })

  it('19: 2x + 1 <= 7 → x <= 3', () => {
    const r = step('2x + 1 <= 7', 'x <= 3')
    expectOk(r, '19')
  })

  it('20: non-constant multiplier on an inequality', () => {
    const r = step('1/x < 2', '1 < 2x')
    expect(r.ok).toBe(false)
    expect(r.pattern?.id).toBe('nonconstant_multiplier_inequality')
    expect(r.counterexample?.point.x).toBe(-1)
  })

  it('21: clearing a denominator that hides a pole is accepted with the extraneous caveat', () => {
    const r = step('x/(x-2) = 2/(x-2)', 'x = 2')
    expectOk(r, '21')
    expect(r.verdict).toBe('extraneous_superset')
    expect(r.caveat).toBe('extraneous_check')
    expect(r.pattern?.id).toBe('squaring_caveat')
  })

  it('22: 1/(x-2) = 0 → x = 2: the pole is not a root', () => {
    const r = step('1/(x-2) = 0', 'x = 2')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('extraneous_superset')
    expect(r.counterexample?.point.x).toBe(2)
    expect(r.counterexample?.oldTruth).toBe('undef')
  })

  it('23: inverse of sqrt(x+7): swap, square with restriction, isolate', () => {
    const s1 = step('y = sqrt(x+7)', 'x = sqrt(y+7)', INV)
    expectOk(s1, '23 swap')
    expect(s1.swapped).toBe(true)
    const s2 = step('x = sqrt(y+7)', 'x^2 = y + 7', CTX)
    expectOk(s2, '23 square')
    expect(s2.verdict).toBe('extraneous_superset')
    expect(s2.caveat).toBe('extraneous_check')
    expect(s2.restriction).toBe('x >= 0')
    expect(s2.detected?.tag).toBe('square_both')
    const s3 = step('x^2 = y + 7', 'y = x^2 - 7', CTX)
    expectOk(s3, '23 isolate')
    expect(s3.acceptableChips).toContain('add_sub')
  })

  it('24: y = x^2 → x = y^2 → y = sqrt(x) loses the negative branch', () => {
    const s1 = step('y = x^2', 'x = y^2', INV)
    expectOk(s1, '24 swap')
    const s2 = step('x = y^2', 'y = sqrt(x)', CTX)
    expect(s2.ok).toBe(false)
    expect(s2.verdict).toBe('lost_subset')
    expect(s2.pattern?.id).toBe('dropped_pm')
    expect(s2.counterexample).toBeTruthy()
    expect(s2.counterexample!.point.y!).toBeLessThan(0)
  })

  it('25: expanding a cube is equivalent at large samples', () => {
    const r = step('(x+1)^3 = 7y+3', 'x^3+3x^2+3x+1 = 7y+3')
    expectOk(r, '25')
    expect(r.detected?.chip).toBe('distribute')
  })

  it('26: clearing a denominator in two variables', () => {
    const r = step('3/(x+2) = y', '3 = y(x+2)')
    expectOk(r, '26')
    expect(r.verdict).toBe('equivalent')
    expect(r.detected?.tag).toBe('clear_denominator')
  })

  it('27: tangential root', () => {
    expectOk(step('(x-3)^2 <= 0', 'x = 3'), '27')
  })

  it('28: x + 1 = 5 → x + 1 = 7 is not equivalent', () => {
    const r = step('x + 1 = 5', 'x + 1 = 7')
    expect(r.ok).toBe(false)
    expect(r.counterexample).toBeTruthy()
  })

  it('29: abs(x) = 3 → x = 3 loses −3', () => {
    const r = step('abs(x) = 3', 'x = 3')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('lost_subset')
    expect(r.pattern?.id).toBe('dropped_pm')
    expect(r.counterexample?.point.x).toBe(-3)
  })

  it('30: sqrt(x) >= 0 → x >= 0 does not throw and is equivalent', () => {
    const r = step('sqrt(x) >= 0', 'x >= 0')
    expectOk(r, '30')
  })
})

describe('inverse paths', () => {
  it('Möbius: every line of the solve-for-y path is accepted', () => {
    const path = [
      'x = (2y+1)/(y+3)',
      'x(y+3) = 2y+1',
      'xy + 3x = 2y + 1',
      'xy - 2y = 1 - 3x',
      'y(x-2) = 1 - 3x',
      'y = (1-3x)/(x-2)',
    ]
    for (let i = 1; i < path.length; i++) {
      const r = step(path[i - 1]!, path[i]!, CTX)
      expectOk(r, `mobius ${i}: ${path[i - 1]} → ${path[i]}`)
    }
  })

  it('rational: x - 1 = 3/(y-2) → (y-2)(x-1) = 3 → y - 2 = 3/(x-1)', () => {
    const a = step('x - 1 = 3/(y-2)', '(y-2)(x-1) = 3', CTX)
    expectOk(a, 'rational 1')
    const b = step('(y-2)(x-1) = 3', 'y - 2 = 3/(x-1)', CTX)
    expectOk(b, 'rational 2')
  })
})

describe('context and result details', () => {
  it('reports parse errors with a position', () => {
    const r = step('x + 1 = 5', 'x + 1 = (5')
    expect(r.ok).toBe(false)
    expect(r.verdict).toBe('parse_error')
    expect(typeof r.parseError?.position).toBe('number')
  })

  it('rejects letters the problem does not own', () => {
    const r = step('x + 1 = 5', 'z = 4', { vars: ['x'], seed: 1 })
    expect(r.verdict).toBe('parse_error')
    expect(r.parseError?.message).toMatch(/Unknown letter "z"/)
  })

  it('flags the sign traps by name', () => {
    expect(step('3x < 6', 'x > 2').pattern?.id).toBe('flip_on_positive')
    expect(step('x + 2 < 5', 'x > 3').pattern?.id).toBe('flip_on_add')
    expect(step('3 < x', 'x < 3').pattern?.id).toBe('swap_sides_no_reverse')
    expect(step('x^2 = 3x', 'x = 3').pattern?.id).toBe('divide_by_variable')
  })

  it('returns the normalized text and the exact chip for both-sides moves', () => {
    const r = step('3x - 2 <= 7', '3x <= 9')
    expectOk(r, 'add')
    expect(r.detected?.tag).toBe('add_both')
    expect(r.detected?.constant).toBe(2)
    expect(r.acceptableChips).toEqual(['add_sub'])
    expect(r.normalized?.text).toBe('3*x <= 9')
  })

  it('anchors chips on the canonical path when the pair matches', () => {
    const canonical = ['5x <= 15', 'x <= 3']
    const r = step('5x <= 15', 'x <= 3', { ...CTX, canonical })
    expectOk(r, 'anchor')
    expect(r.detected?.chip).toBe('mul_div')
    expect(r.acceptableChips[0]).toBe('mul_div')
  })

  it('never accepts an undecidable line', () => {
    const r = step('sqrt(-x^2-1) = 0', 'sqrt(-x^2-2) = 0')
    expect(r.ok).toBe(false)
  })
})

describe('expression mode, parity and one-to-one', () => {
  it('verifyRewrite accepts an expansion and rejects a wrong power', () => {
    const ok = verifyRewrite('(-x)^3 - 2(-x)', '-x^3 + 2x', CTX)
    expect(ok.ok).toBe(true)
    const bad = verifyRewrite('(-x)^2 + 1', '-x^2 + 1', CTX)
    expect(bad.ok).toBe(false)
    expect(bad.pattern?.id).toBe('neg_power_sign')
    expect(bad.counterexample).toBeTruthy()
  })

  it('checkParitySeeded matches the contract shape', () => {
    const r = checkParitySeeded('x^3 - 2x', 3)
    expect(r.verdict).toBe('odd')
    expect(r.reason).toBe('values')
    expect(r.table[0]).toHaveProperty('fNegK')
  })

  it('isOneToOne finds a witness pair for x^2 and none for cbrt(x+1)', () => {
    const sq = isOneToOne('x^2')
    expect(sq.oneToOne).toBe(false)
    expect(sq.witness).toEqual({ a: -1, b: 1, y: 1 })
    expect(isOneToOne('cbrt(x+1)').oneToOne).toBe(true)
    expect(isOneToOne('(2x+1)/(x+3)').oneToOne).toBe(true)
    expect(isOneToOne('x^2 - 4x').oneToOne).toBe(false)
  })
})
