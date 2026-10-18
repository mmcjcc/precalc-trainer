import { describe, expect, it } from 'vitest'
import { ratToString } from '@/notation/rational'
import { parseExpression } from '../parse'
import { exactEquals, exactIsRational, exactRational, exactToNumber, tryExact, type ExactValue } from './exact'

function ex(text: string): ExactValue | 'undef' | null {
  const p = parseExpression(text, ['x'])
  if (!p.ok) throw new Error(`${text}: ${p.error.message}`)
  return tryExact(p.node)
}

function rational(text: string): string | null {
  const v = ex(text)
  if (!v || v === 'undef') return null
  const r = exactRational(v)
  return r ? ratToString(r) : null
}

describe('exact values of constant log and exponential expressions', () => {
  it.each([
    ['log_2(8)', '3'],
    ['log(0.001)', '-3'],
    ['log(1000)', '3'],
    ['ln(e^5)', '5'],
    ['e^(ln(7))', '7'],
    ['10^(log(7))', '7'],
    ['log_4(8)', '3/2'],
    ['log_8(4)', '2/3'],
    ['log_9(27)', '3/2'],
    ['log_(1/2)(8)', '-3'],
    ['log_3(1/9)', '-2'],
    ['log_5(sqrt(5))', '1/2'],
    ['log_2(cbrt(4))', '2/3'],
    ['log_6(4) + log_6(9)', '2'],
    ['log_3(54) - log_3(2)', '3'],
    ['2log_5(10) - log_5(4)', '2'],
    ['log_2(3) * log_3(8)', '3'],
    ['e^(2ln(3))', '9'],
    ['8^(log_2(3))', '27'],
    ['8^(2/3)', '4'],
    ['ln(1/e)', '-1'],
    ['ln(sqrt(e))', '1/2'],
    ['log_7(1)', '0'],
    ['log_7(7)', '1'],
    ['1.5', '3/2'],
    ['(-8)^(1/3)', '-2'],
  ])('%s = %s exactly', (text, value) => {
    expect(rational(text)).toBe(value)
    const v = ex(text) as ExactValue
    expect(exactIsRational(v)).toBe(true)
  })

  it('log₂ 7 is irrational (7^q = 2^p has no solution) and every way of writing it is equal', () => {
    const a = ex('log_2(7)') as ExactValue
    expect(exactIsRational(a)).toBe(false)
    for (const t of ['ln(7)/ln(2)', 'log(7)/log(2)', 'log_4(49)', '2log_4(7)']) expect(exactEquals(a, ex(t) as ExactValue), t).toBe(true)
    expect(exactEquals(a, ex('log(2)/log(7)') as ExactValue)).toBe(false)
    expect(exactEquals(a, ex('log(7/2)') as ExactValue)).toBe(false)
    expect(exactToNumber(a)).toBeCloseTo(Math.log(7) / Math.log(2), 14)
  })

  it('solutions of exponential equations compare exactly: log 5 / (2 log 3) = ln 5 / ln 9 = log₉ 5', () => {
    const a = ex('log(5)/(2log(3))') as ExactValue
    expect(exactEquals(a, ex('ln(5)/ln(9)') as ExactValue)).toBe(true)
    expect(exactEquals(a, ex('log_9(5)') as ExactValue)).toBe(true)
    expect(exactEquals(ex('log_2(7) - 1') as ExactValue, ex('log_2(3.5)') as ExactValue)).toBe(true)
    expect(exactEquals(ex('ln(2)/(ln(3) - ln(2))') as ExactValue, ex('log_(3/2)(2)') as ExactValue)).toBe(true)
  })

  it('radicals and powers of e are power products', () => {
    expect(exactIsRational(ex('sqrt(2)') as ExactValue)).toBe(false)
    expect(exactEquals(ex('sqrt(8)') as ExactValue, ex('2sqrt(2)') as ExactValue)).toBe(true)
    expect(exactEquals(ex('e^2 * e^3') as ExactValue, ex('e^5') as ExactValue)).toBe(true)
    expect(exactEquals(ex('(e^2)^3') as ExactValue, ex('e^6') as ExactValue)).toBe(true)
    expect(exactToNumber(ex('e^2') as ExactValue)).toBeCloseTo(Math.E ** 2, 12)
  })

  it('undefined where the evaluator is undefined', () => {
    for (const t of ['log(-1)', 'log(0)', 'ln(-5)', 'log_1(5)', 'log(8, -2)', '1/0', 'sqrt(-4)']) expect(ex(t), t).toBe('undef')
  })

  it('outside the model: null (callers fall back to floats)', () => {
    for (const t of ['pi', 'sqrt(2) + 1', 'ln(ln(5))', 'log(2) * log(3)', 'log(2) + sqrt(3)']) expect(ex(t), t).toBeNull()
  })
})
