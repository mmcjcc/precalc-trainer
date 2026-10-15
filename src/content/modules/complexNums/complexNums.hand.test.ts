import { describe, expect, it } from 'vitest'
import { cx, cxDiv, cxIPower, cxMul, cxSqrt, formatCx } from './arith'
import { gradeModel, type CxModel } from './grade'
import { parseCxAnswer } from './parse'

function arith(z1re: number, z1im: number, z2re: number, z2im: number, op: '+' | '-' | '*', expr: string): CxModel {
  const z1 = cx(z1re, z1im)
  const z2 = cx(z2re, z2im)
  const values = [op === '+' ? cx(z1re + z2re, z1im + z2im) : op === '-' ? cx(z1re - z2re, z1im - z2im) : cxMul(z1, z2)]
  return { kind: 'arith', values, expression: expr, f: '', givenZero: '', op, z1, z2 }
}

describe('hand-worked complex numbers', () => {
  it('matches the worked products, sums and difference', () => {
    const prod = arith(3, -2, 4, 1, '*', '(3 - 2i)(4 + i)')
    expect(formatCx(prod.values[0]!)).toBe('14 - 5i')
    expect(gradeModel(prod, '14 - 5i').verdict).toBe('correct')
    expect(gradeModel(prod, '14-5i').verdict).toBe('correct')
    expect(gradeModel(prod, '10 - 5i')).toMatchObject({ verdict: 'mistake', mistake: 'cx_i_squared_positive' })
    expect(gradeModel(prod, '14')).toMatchObject({ verdict: 'mistake', mistake: 'cx_foil_dropped' })

    const sum = arith(3, -2, 4, 1, '+', '(3 - 2i) + (4 + i)')
    expect(formatCx(sum.values[0]!)).toBe('7 - i')
    expect(gradeModel(sum, '7 - i').verdict).toBe('correct')

    const diff = arith(3, -2, 4, 1, '-', '(3 - 2i) - (4 + i)')
    expect(formatCx(diff.values[0]!)).toBe('-1 - 3i')
    expect(gradeModel(diff, '-1 - 3i').verdict).toBe('correct')
  })

  it('divides by the conjugate: (2 + 3i)/(1 - 2i) = -4/5 + 7/5 i', () => {
    const z1 = cx(2, 3)
    const z2 = cx(1, -2)
    const ans = cxDiv(z1, z2)
    expect(formatCx(ans)).toBe('-4/5 + 7/5 i')
    const p: CxModel = { kind: 'divide', values: [ans], expression: '(2 + 3i)/(1 - 2i)', f: '', givenZero: '', z1, z2 }
    expect(gradeModel(p, '-4/5 + 7/5 i').verdict).toBe('correct')
    expect(gradeModel(p, '(4 - 7i)/(-5)').verdict).toBe('correct')
    expect(gradeModel(p, '(2 + 3i)/(1 - 2i)')).toMatchObject({ verdict: 'invalid' })
    expect(gradeModel(p, '2/5 + 3/5 i')).toMatchObject({ verdict: 'mistake', mistake: 'cx_conjugate_wrong' })
  })

  it('powers of i, including i^23 and i^-5', () => {
    expect(formatCx(cxIPower(23))).toBe('-i')
    expect(formatCx(cxIPower(-5))).toBe('-i')
    expect(formatCx(cxIPower(0))).toBe('1')
    expect(formatCx(cxIPower(1))).toBe('i')
    expect(formatCx(cxIPower(2))).toBe('-1')
    expect(formatCx(cxIPower(4))).toBe('1')
    const p23: CxModel = { kind: 'powers', values: [cxIPower(23)], expression: 'i^23', f: '', givenZero: '', powerKind: 'power', powerN: 23 }
    expect(gradeModel(p23, '-i').verdict).toBe('correct')
    expect(gradeModel(p23, 'i')).toMatchObject({ verdict: 'mistake', mistake: 'cx_power_cycle' })
    const pNeg: CxModel = { kind: 'powers', values: [cxIPower(-5)], expression: 'i^(-5)', f: '', givenZero: '', powerKind: 'power', powerN: -5 }
    expect(gradeModel(pNeg, '-i').verdict).toBe('correct')
    expect(gradeModel(pNeg, 'i')).toMatchObject({ verdict: 'mistake', mistake: 'cx_power_cycle' })
  })

  it('sqrt(-48) = 4i sqrt(3), and sqrt(-4) * sqrt(-9) = -6', () => {
    const s: CxModel = {
      kind: 'powers',
      values: [cxSqrt(cx(-48))],
      expression: 'sqrt(-48)',
      f: '',
      givenZero: '',
      powerKind: 'sqrt',
      radicand: 48,
    }
    expect(formatCx(s.values[0]!)).toBe('4i sqrt(3)')
    expect(gradeModel(s, '4i sqrt(3)').verdict).toBe('correct')
    expect(gradeModel(s, '4 sqrt(3) i').verdict).toBe('correct')
    expect(gradeModel(s, '4isqrt3').verdict).toBe('correct')
    expect(gradeModel(s, '4 sqrt(3)')).toMatchObject({ verdict: 'mistake', mistake: 'cx_sqrt_negative_sign' })
    expect(gradeModel(s, '-4 sqrt(3)')).toMatchObject({ verdict: 'mistake', mistake: 'cx_sqrt_negative_sign' })
    expect(gradeModel(s, 'sqrt(-48)')).toMatchObject({ verdict: 'invalid' })

    const prod = cxMul(cxSqrt(cx(-4)), cxSqrt(cx(-9)))
    expect(formatCx(prod)).toBe('-6')
    const pr: CxModel = {
      kind: 'powers',
      values: [prod],
      expression: 'sqrt(-4) * sqrt(-9)',
      f: '',
      givenZero: '',
      powerKind: 'product',
      radicand: 4,
      radicandB: 9,
    }
    expect(gradeModel(pr, '-6').verdict).toBe('correct')
    expect(gradeModel(pr, '6')).toMatchObject({ verdict: 'mistake', mistake: 'cx_sqrt_product' })
  })

  it('x^2 - 4x + 13 = 0 gives 2 ± 3i', () => {
    const p: CxModel = {
      kind: 'quadratic',
      values: [cx(2, 3), cx(2, -3)],
      expression: 'x^2 - 4x + 13 = 0',
      f: '',
      givenZero: '',
      quadA: 1,
      quadB: -4,
      quadC: 13,
    }
    expect(gradeModel(p, '2 + 3i, 2 - 3i').verdict).toBe('correct')
    expect(gradeModel(p, '2 +- 3i').verdict).toBe('correct')
    expect(gradeModel(p, '2 ± 3i').verdict).toBe('correct')
    expect(gradeModel(p, '2 - 3i, 2 + 3i').verdict).toBe('correct')
    expect(gradeModel(p, '5, -1')).toMatchObject({ verdict: 'mistake', mistake: 'cx_discriminant_sign' })
    expect(gradeModel(p, '4 +- 3i')).toMatchObject({ verdict: 'mistake', mistake: 'cx_half_formula' })
  })

  it('f(x) = x^3 - 5x^2 + 17x - 13 with a zero 2 + 3i', () => {
    const p: CxModel = {
      kind: 'zeros',
      values: [cx(1), cx(2, 3), cx(2, -3)],
      expression: '',
      f: 'x^3 - 5x^2 + 17x - 13',
      givenZero: '2 + 3i',
      given: cx(2, 3),
      reals: [cx(1)],
    }
    expect(gradeModel(p, '1, 2 + 3i, 2 - 3i').verdict).toBe('correct')
    expect(gradeModel(p, '2 - 3i, 1, 2 + 3i').verdict).toBe('correct')
    expect(gradeModel(p, '1, 2 + 3i')).toMatchObject({ verdict: 'mistake', mistake: 'cx_conjugate_missing' })
  })

  it('more exact values: i^8, sqrt(-4), (1+2i)+(3-4i), (1+i)/(1-i)', () => {
    expect(formatCx(cxIPower(8))).toBe('1')
    expect(formatCx(cxSqrt(cx(-4)))).toBe('2i')
    expect(formatCx(cxMul(cx(1, 2), cx(3, -4)))).toBe('11 + 2i')
    const q = cxDiv(cx(1, 1), cx(1, -1))
    expect(formatCx(q)).toBe('i')
    expect(parseCxAnswer('11 + 2i').ok).toBe(true)
  })
})
