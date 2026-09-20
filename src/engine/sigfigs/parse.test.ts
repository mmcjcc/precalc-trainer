import { describe, expect, it } from 'vitest'
import type { SigFigNumeral } from '@/shared/types'
import { countSigFigs, parseSigFigNumeral } from './parse'
import { composeSigFigText, prettySigFig } from './text'

function ok(text: string): SigFigNumeral {
  const r = parseSigFigNumeral(text)
  if (!r.ok) throw new Error(`expected "${text}" to parse: ${r.error.message}`)
  return r.numeral
}

function err(text: string): { message: string; position: number; length?: number } {
  const r = parseSigFigNumeral(text)
  if (r.ok) throw new Error(`expected "${text}" to be refused`)
  return r.error
}

describe('counting significant figures: anchor cases', () => {
  const cases: [string, number][] = [
    ['0.00450', 3],
    ['1200', 2],
    ['1200.', 4],
    ['100.0', 4],
    ['5002', 4],
    ['0.10050', 5],
    ['300', 1],
    ['3.00e8', 3],
    ['40.', 2],
    ['0.5', 1],
    ['.5', 1],
    ['007', 1],
    ['1.20 x 10^3', 3],
    ['6.022e23', 4],
    ['-0.00450', 3],
    ['+12.0', 3],
    ['10', 1],
    ['10.', 2],
    ['1e-9', 1],
    ['1.000000e12', 7],
  ]
  it.each(cases)('%s has %i', (text, n) => {
    expect(ok(text).sigFigs).toBe(n)
    expect(countSigFigs(text)).toBe(n)
  })
})

describe('roles for every character', () => {
  it('0.00450: leading zeros, nonzero digits, measured trailing zero', () => {
    const n = ok('0.00450')
    expect(n.chars.map((c) => c.role)).toEqual([
      'leading_zero',
      'decimal_point',
      'leading_zero',
      'leading_zero',
      'nonzero',
      'nonzero',
      'trailing_zero_decimal',
    ])
    expect(n.chars.map((c) => c.significant)).toEqual([false, false, false, false, true, true, true])
    expect(n.chars.map((c) => c.index)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(n.chars.filter((c) => c.digit).map((c) => c.place)).toEqual([0, -1, -2, -3, -4, -5])
    expect(n.sigDigits).toBe('450')
    expect(n.firstSigPlace).toBe(-3)
    expect(n.lastSigPlace).toBe(-5)
    expect(n.value).toBe('0.0045')
    expect(n.chars.every((c) => c.rule.length > 10)).toBe(true)
  })

  it('1200 vs 1200.: placeholders become measured zeros when the point is written', () => {
    const a = ok('1200')
    expect(a.chars.map((c) => c.role)).toEqual(['nonzero', 'nonzero', 'trailing_zero_placeholder', 'trailing_zero_placeholder'])
    expect(a.lastSigPlace).toBe(2)
    expect(a.firstSigPlace).toBe(3)
    const b = ok('1200.')
    expect(b.chars.map((c) => c.role)).toEqual(['nonzero', 'nonzero', 'trailing_zero_decimal', 'trailing_zero_decimal', 'decimal_point'])
    expect(b.lastSigPlace).toBe(0)
    expect(b.chars[4].rule).toMatch(/at the end/)
    expect(a.value).toBe('1200')
    expect(b.value).toBe('1200')
  })

  it('5002 and 0.10050: captive zeros', () => {
    expect(ok('5002').chars.map((c) => c.role)).toEqual(['nonzero', 'captive_zero', 'captive_zero', 'nonzero'])
    expect(ok('0.10050').chars.filter((c) => c.digit).map((c) => c.role)).toEqual([
      'leading_zero',
      'nonzero',
      'captive_zero',
      'captive_zero',
      'nonzero',
      'trailing_zero_decimal',
    ])
  })

  it('sign and power of ten are never significant and never tappable', () => {
    const n = ok('-1.20 x 10^3')
    expect(n.chars[0]).toMatchObject({ ch: '-', role: 'sign', significant: false, digit: false })
    const exponentChars = n.chars.filter((c) => c.role === 'exponent')
    expect(exponentChars.map((c) => c.ch).join('')).toBe(' x 10^3')
    expect(exponentChars.every((c) => !c.significant && !c.digit)).toBe(true)
    expect(n.chars.length).toBe(n.text.length)
    expect(n.negative).toBe(true)
    expect(n.scientific).toBe(true)
    expect(n.normalized).toBe(true)
    expect(n.exponent).toBe(3)
    expect(n.firstSigPlace).toBe(3)
    expect(n.lastSigPlace).toBe(1)
    expect(n.value).toBe('-1200')
    expect(n.display).toBe('−1.20 × 10³')
  })
})

describe('powers of ten: every accepted spelling', () => {
  const spellings = [
    '1.20e3',
    '1.20E3',
    '1.20e+3',
    '1.20x10^3',
    '1.20 x 10^3',
    '1.20 X 10 ^ 3',
    '1.20×10^3',
    '1.20 × 10^3',
    '1.20*10^3',
    '1.20 * 10^(3)',
    '1.20 × 10³',
    '1.20x10+3',
    '  1.20e3  ',
  ]
  it.each(spellings)('%s', (text) => {
    const n = ok(text)
    expect(n.value).toBe('1200')
    expect(n.sigFigs).toBe(3)
    expect(n.exponent).toBe(3)
  })

  const negatives = ['4.5e-4', '4.5E−4', '4.5 x 10^-4', '4.5×10^−4', '4.5 × 10⁻⁴', '4.5x10-4', '4.5 * 10^(-4)', '4.5e–4']
  it.each(negatives)('%s', (text) => {
    const n = ok(text)
    expect(n.value).toBe('0.00045')
    expect(n.exponent).toBe(-4)
    expect(n.lastSigPlace).toBe(-5)
  })

  it('knows when a coefficient is not normalized', () => {
    expect(ok('12.0e2').normalized).toBe(false)
    expect(ok('0.12e4').normalized).toBe(false)
    expect(ok('1.20e3').normalized).toBe(true)
    expect(ok('5e3').normalized).toBe(true)
    expect(ok('1200').normalized).toBe(false)
    // Rules 1-4 on the coefficient: no decimal point, so the zero is a placeholder.
    expect(ok('10 x 10^2').sigFigs).toBe(1)
  })
})

describe('negative numbers and zero', () => {
  it('Unicode minus signs', () => {
    expect(ok('−2.50').value).toBe('-2.5')
    expect(ok('–2.50').negative).toBe(true)
    expect(ok('—2.50').negative).toBe(true)
    expect(ok('4.5e—4').value).toBe('0.00045')
    expect(ok('−2.50').sigFigs).toBe(3)
  })

  it('zero has no significant figures but remembers its written precision', () => {
    for (const [text, place] of [['0', 0], ['0.0', -1], ['0.00', -2], ['000', 0], ['0.', 0], ['-0.00', -2]] as const) {
      const n = ok(text)
      expect(n.isZero).toBe(true)
      expect(n.sigFigs).toBe(0)
      expect(n.negative).toBe(false)
      expect(n.lastSigPlace).toBe(place)
      expect(n.firstSigPlace).toBe(place)
      expect(n.chars.filter((c) => c.digit).every((c) => c.role === 'leading_zero' && !c.significant)).toBe(true)
      expect(n.value).toBe('0')
    }
  })
})

describe('range 1e-9 to 1e12', () => {
  it('keeps exact values as text', () => {
    expect(ok('0.000000001').value).toBe('0.000000001')
    expect(ok('0.000000001').firstSigPlace).toBe(-9)
    expect(ok('1e-9').value).toBe('0.000000001')
    expect(ok('1000000000000').value).toBe('1000000000000')
    expect(ok('1000000000000').firstSigPlace).toBe(12)
    expect(ok('1e12').value).toBe('1000000000000')
    expect(ok('9.99e11').lastSigPlace).toBe(9)
    expect(ok('0.1').value).toBe('0.1')
    expect(ok('2.50').value).toBe('2.5')
    expect(ok('2.50').digits).toBe('250')
    expect(ok('2.50').fractionDigits).toBe(2)
  })
})

describe('parse errors are friendly and positioned', () => {
  it('empty', () => {
    expect(err('')).toMatchObject({ position: 0 })
    expect(err('   ').message).toMatch(/number first/i)
  })
  it('thousands separator', () => {
    const e = err('12,000')
    expect(e.position).toBe(2)
    expect(e.message).toMatch(/comma/i)
  })
  it('units', () => {
    const e = err('3.0 g')
    expect(e.position).toBe(4)
    expect(e.message).toMatch(/units/i)
    expect(err('4.5 mL').length).toBe(2)
    expect(err('  12cm').position).toBe(4)
  })
  it('two decimal points', () => {
    const e = err('1.2.3')
    expect(e.position).toBe(3)
    expect(e.message).toMatch(/one decimal point/i)
  })
  it('space inside the number', () => {
    const e = err('12 000')
    expect(e.position).toBe(2)
    expect(e.message).toMatch(/space/i)
  })
  it('unfinished or malformed power of ten', () => {
    expect(err('1.2e').message).toMatch(/power of ten/i)
    expect(err('1.2e').position).toBe(3)
    expect(err('1.2e-').message).toMatch(/power of ten/i)
    expect(err('1.2 x 10^').message).toMatch(/power of ten/i)
    expect(err('1.2 x 10').message).toMatch(/power of ten/i)
    expect(err('1.2 x 5').message).toMatch(/10/)
    expect(err('1.2e2.5')).toMatchObject({ position: 5 })
    expect(err('1.2e2.5').message).toMatch(/whole number/i)
    expect(err('1.2 x 10^(3').message).toMatch(/parenthesis/i)
    expect(err('1e400').message).toMatch(/power of ten/i)
  })
  it('refuses bare digits after the 10 so "2.5 x 100" is never read as a power', () => {
    const e = err('2.5 x 100')
    expect(e.position).toBe(8)
    expect(e.message).toMatch(/\^/)
  })
  it('fractions, stray signs, words, junk', () => {
    expect(err('1/2')).toMatchObject({ position: 1 })
    expect(err('1/2').message).toMatch(/fraction/i)
    expect(err('5-3').message).toMatch(/sign/i)
    expect(err('abc').message).toMatch(/number itself/i)
    expect(err('-').message).toMatch(/digit/i)
    expect(err('.').message).toMatch(/digit/i)
    expect(err('3.0!').position).toBe(3)
    expect(err('^3').message).toMatch(/power of ten/i)
    expect(err('5 eggs').message).toMatch(/units|words/i)
    expect(err('1'.repeat(31)).message).toMatch(/digits/i)
  })
})

describe('text helpers', () => {
  it('composeSigFigText joins a coefficient box and a power box', () => {
    expect(composeSigFigText('2.0', '3')).toBe('2.0 x 10^3')
    expect(composeSigFigText('2.0', ' -3 ')).toBe('2.0 x 10^-3')
    expect(composeSigFigText('2.0', '')).toBe('2.0')
    expect(ok(composeSigFigText('2.0', '−3')).value).toBe('0.002')
  })
  it('prettySigFig', () => {
    expect(prettySigFig('1.20e3')).toBe('1.20 × 10³')
    expect(prettySigFig('4.5 x 10^-4')).toBe('4.5 × 10⁻⁴')
    expect(prettySigFig('-0.5')).toBe('−0.5')
    expect(prettySigFig('12,000')).toBe('12,000')
  })
})

describe('fuzz fixes: the digit limit counts significant digits, not placeholders', () => {
  it('accepts a 31-digit numeral with one significant figure', () => {
    const n = ok('0.000000000000000000000000000001')
    expect(n.sigFigs).toBe(1)
    expect(n.lastSigPlace).toBe(-30)
    expect(ok('4' + '0'.repeat(30)).sigFigs).toBe(1)
    expect(ok('120000000000000000000000000000000').sigFigs).toBe(2)
    expect(ok('0'.repeat(40)).isZero).toBe(true)
  })
  it('still refuses more than 30 significant digits, pointing at the 31st', () => {
    const e = err('0.0' + '1'.repeat(31))
    expect(e.message).toMatch(/more digits than any measurement/i)
    expect(e.position).toBe(33)
    expect(err('1.' + '0'.repeat(30)).message).toMatch(/more digits/i)
    expect(ok('1.' + '0'.repeat(29)).sigFigs).toBe(30)
  })
})
