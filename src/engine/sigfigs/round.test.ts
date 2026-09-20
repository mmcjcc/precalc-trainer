import { describe, expect, it } from 'vitest'
import { rat, ratFirstPlace, ratToDisplay, roundRatToPlace, roundRatToSigFigs, scientificText, standardText } from './decimal'
import { sigFigPlaceName } from './format'
import { roundToPlace, roundToSigFigs } from './round'

describe('roundToSigFigs: anchor cases', () => {
  it('0.004567 to 2 → 0.0046', () => {
    const r = roundToSigFigs('0.004567', 2)
    expect(r.text).toBe('0.0046')
    expect(r.sigFigs).toBe(2)
    expect(r.place).toBe(-4)
    expect(r.direction).toBe('up')
    expect(r.firstDropped).toBe(6)
    expect(r.tie).toBe(false)
    expect(r.truncatedText).toBe('0.0045')
  })
  it('12345 to 2 → 12000 (1.2 x 10^4 also right)', () => {
    const r = roundToSigFigs('12345', 2)
    expect(r.text).toBe('12000')
    expect(r.alternates).toEqual(['1.2 x 10^4'])
    expect(r.value).toBe('12000')
    expect(r.place).toBe(3)
    expect(r.direction).toBe('down')
  })
  it('1999 to 2 → 2.0 x 10^3, because "2000" reads as one figure', () => {
    const r = roundToSigFigs('1999', 2)
    expect(r.text).toBe('2.0 x 10^3')
    expect(r.display).toBe('2.0 × 10³')
    expect(r.alternates).toEqual([])
    expect(r.value).toBe('2000')
    expect(r.sigFigs).toBe(2)
    expect(r.place).toBe(2)
  })
  it('0.99961 to 3 → 1.00 (the carry keeps three figures)', () => {
    const r = roundToSigFigs('0.99961', 3)
    expect(r.text).toBe('1.00')
    expect(r.sigFigs).toBe(3)
    expect(r.place).toBe(-2)
  })
  it('a whole number whose last significant digit is a zero in the ones place gets a trailing point', () => {
    const r = roundToSigFigs('1999.7', 4)
    expect(r.text).toBe('2000.')
    expect(r.alternates).toEqual(['2.000 x 10^3'])
  })
  it('9.96 to 2 → 10. (not 10.0)', () => {
    const r = roundToSigFigs('9.96', 2)
    expect(r.text).toBe('10.')
    expect(r.sigFigs).toBe(2)
    expect(r.place).toBe(0)
  })
  it('negative numbers round on the magnitude', () => {
    expect(roundToSigFigs('-2.56', 2).text).toBe('-2.6')
    expect(roundToSigFigs('-2.54', 2).text).toBe('-2.5')
    expect(roundToSigFigs('-1999', 2).text).toBe('-2.0 x 10^3')
    expect(roundToSigFigs('−0.004567', 2).display).toBe('−0.0046')
  })
  it('padding is allowed: 12 to 4 figures is 12.00', () => {
    const r = roundToSigFigs('12', 4)
    expect(r.text).toBe('12.00')
    expect(r.direction).toBe('exact')
  })
  it('very large and very small values switch to scientific notation first', () => {
    expect(roundToSigFigs('602214076000000000000000', 4).text).toBe('6.022 x 10^23')
    expect(roundToSigFigs('0.000000001234', 2).text).toBe('1.2 x 10^-9')
    expect(roundToSigFigs('0.000000001234', 2).alternates).toEqual(['0.0000000012'])
    expect(roundToSigFigs('123456789012', 3).text).toBe('1.23 x 10^11')
    expect(roundToSigFigs('123456789012', 3).alternates).toEqual(['123000000000'])
    expect(roundToSigFigs('1.5e-9', 1).text).toBe('2 x 10^-9')
  })
  it('throws on zero, bad n and unreadable text', () => {
    expect(() => roundToSigFigs('0.00', 2)).toThrow()
    expect(() => roundToSigFigs('1.5', 0)).toThrow()
    expect(() => roundToSigFigs('1,5', 1)).toThrow()
  })
})

describe('ties are reported exactly', () => {
  it('a discarded part of exactly one half is a tie, rounded half-up', () => {
    const r = roundToSigFigs('2.5', 1)
    expect(r.tie).toBe(true)
    expect(r.text).toBe('3')
    expect(roundToSigFigs('0.125', 2).tie).toBe(true)
    expect(roundToSigFigs('0.125', 2).text).toBe('0.13')
    expect(roundToSigFigs('-2.5', 1).text).toBe('-3')
    expect(roundToPlace('12.50', 0).tie).toBe(true)
    expect(roundToSigFigs('2.50', 1).tie).toBe(true)
  })
  it('anything past the 5 is not a tie', () => {
    expect(roundToSigFigs('2.5000001', 1).tie).toBe(false)
    expect(roundToSigFigs('2.51', 1).tie).toBe(false)
    expect(roundToSigFigs('2.49999', 1).tie).toBe(false)
    expect(roundToSigFigs('2.49999', 1).text).toBe('2')
    expect(roundToSigFigs('2', 1).tie).toBe(false)
  })
  it('floats would get these wrong; digit strings do not', () => {
    // 1.005 is below 1.005 as a double, so float rounding gives 1.00.
    expect(roundToPlace('1.005', -2).tie).toBe(true)
    expect(roundToPlace('1.005', -2).text).toBe('1.01')
    expect(roundToPlace('1.0051', -2).text).toBe('1.01')
    expect(roundToPlace('8.345', -2).text).toBe('8.35')
  })
  it('detects ties in quotients exactly', () => {
    // 1/8 = 0.125
    expect(roundRatToSigFigs(rat(1n, 8n), 2).tie).toBe(true)
    // 1/3 never ties
    expect(roundRatToSigFigs(rat(1n, 3n), 5).tie).toBe(false)
    expect(roundRatToSigFigs(rat(2n, 3n), 3)).toMatchObject({ m: 667n, place: -3, direction: 'up', firstDropped: 6 })
  })
})

describe('roundToPlace', () => {
  it('31.123 to the tenths → 31.1', () => {
    const r = roundToPlace('31.123', -1)
    expect(r.text).toBe('31.1')
    expect(r.sigFigs).toBe(3)
    expect(r.firstDropped).toBe(2)
  })
  it('can round to zero, keeping the place', () => {
    const r = roundToPlace('0.004', -2)
    expect(r.text).toBe('0.00')
    expect(r.sigFigs).toBe(0)
    expect(r.value).toBe('0')
  })
  it('tens and hundreds', () => {
    expect(roundToPlace('1234', 2).text).toBe('1200')
    expect(roundToPlace('1960', 2).text).toBe('2.0 x 10^3')
    expect(roundToPlace('1234', 1).text).toBe('1230')
    expect(roundToPlace('1204', 1).text).toBe('1.20 x 10^3')
  })
})

describe('decimal helpers', () => {
  it('ratFirstPlace', () => {
    expect(ratFirstPlace(rat(1n, 3n))).toBe(-1)
    expect(ratFirstPlace(rat(999n, 1n))).toBe(2)
    expect(ratFirstPlace(rat(1000n, 1n))).toBe(3)
    expect(ratFirstPlace(rat(1n, 1000n))).toBe(-3)
    expect(ratFirstPlace(rat(-25n, 2n))).toBe(1)
    expect(ratFirstPlace(rat(99n, 100n))).toBe(-1)
    expect(ratFirstPlace(rat(100n, 99n))).toBe(0)
  })
  it('ratToDisplay', () => {
    expect(ratToDisplay(rat(1250n, 410n))).toEqual({ text: '3.04878048780…', terminates: false })
    expect(ratToDisplay(rat(48n, 10n))).toEqual({ text: '4.8', terminates: true })
    expect(ratToDisplay(rat(-1n, 8n))).toEqual({ text: '-0.125', terminates: true })
  })
  it('standardText / scientificText', () => {
    expect(standardText(20n, 2)).toBeNull()
    expect(standardText(12n, 3)).toBe('12000')
    expect(standardText(2000n, 0)).toBe('2000.')
    expect(standardText(30n, -1)).toBe('3.0')
    expect(standardText(5n, -2)).toBe('0.05')
    expect(standardText(0n, -2)).toBe('0.00')
    expect(scientificText(20n, 2)).toBe('2.0 x 10^3')
    expect(scientificText(-5n, -2)).toBe('-5 x 10^-2')
    expect(roundRatToPlace(rat(5n, 100n), -2).m).toBe(5n)
  })
  it('place names', () => {
    expect(sigFigPlaceName(0)).toBe('ones')
    expect(sigFigPlaceName(-1)).toBe('tenths')
    expect(sigFigPlaceName(-3)).toBe('thousandths')
    expect(sigFigPlaceName(2)).toBe('hundreds')
    expect(sigFigPlaceName(12)).toBe('10¹²')
    expect(sigFigPlaceName(-9)).toBe('10⁻⁹')
  })
})
