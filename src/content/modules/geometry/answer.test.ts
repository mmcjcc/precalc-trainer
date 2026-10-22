import { describe, expect, it } from 'vitest'
import { formatQty, geoQty, readGeoAnswer, sameGeoValue, sameQty } from './answer'

function qty(raw: string) {
  const read = readGeoAnswer(raw)
  expect(read.ok, raw).toBe(true)
  if (!read.ok) throw new Error(`${raw}: not a quantity`)
  const value = read.value
  if (value.kind !== 'qty') throw new Error(`${raw}: not a quantity`)
  return { ...read, value }
}

describe('readGeoAnswer', () => {
  it('reads integers, fractions, decimals, and x =', () => {
    expect(sameQty(qty('7').value.q, geoQty(7, 1, 1))).toBe(true)
    expect(qty('7').simplest).toBe(true)
    expect(sameQty(qty('7/2').value.q, geoQty(7, 2, 1))).toBe(true)
    expect(sameQty(qty('0.5').value.q, geoQty(1, 2, 1))).toBe(true)
    expect(sameQty(qty('6/2').value.q, geoQty(3, 1, 1))).toBe(true)
    expect(qty('6/2').simplest).toBe(true)
    expect(sameQty(qty('x = 7').value.q, geoQty(7, 1, 1))).toBe(true)
    expect(sameQty(qty('x=7').value.q, geoQty(7, 1, 1))).toBe(true)
    expect(sameQty(qty('−3').value.q, geoQty(-3, 1, 1))).toBe(true)
  })

  it('reads degrees with or without a symbol', () => {
    for (const raw of ['50', '50°', '50 deg', '50 degrees', '50 degree']) {
      expect(sameQty(qty(raw).value.q, geoQty(50, 1, 1)), raw).toBe(true)
      expect(qty(raw).simplest, raw).toBe(true)
    }
  })

  it('reads simplest radicals in every spelling', () => {
    const five = geoQty(3, 1, 5)
    for (const raw of ['3√5', '3sqrt(5)', '3 sqrt 5', '3sqrt5']) {
      const read = qty(raw)
      expect(sameQty(read.value.q, five), raw).toBe(true)
      expect(read.simplest, raw).toBe(true)
      expect(formatQty(read.value.q)).toBe('3√5')
    }
    const half = geoQty(3, 2, 5)
    for (const raw of ['(3√5)/2', '3√5/2', '3sqrt(5)/2']) {
      const read = qty(raw)
      expect(sameQty(read.value.q, half), raw).toBe(true)
      expect(read.simplest, raw).toBe(true)
    }
    expect(formatQty(geoQty(1, 2, 5))).toBe('√5/2')
    expect(formatQty(geoQty(3, 2, 5))).toBe('(3√5)/2')
  })

  it('reads points', () => {
    const read = readGeoAnswer('(2, -3)')
    expect(read.ok).toBe(true)
    if (!read.ok || read.value.kind !== 'point') throw new Error('point')
    expect(sameQty(read.value.x, geoQty(2, 1, 1))).toBe(true)
    expect(sameQty(read.value.y, geoQty(-3, 1, 1))).toBe(true)
    expect(read.simplest).toBe(true)
    const tight = readGeoAnswer('(2,-3)')
    expect(tight.ok && read.ok && sameGeoValue(tight.ok ? tight.value : read.value, read.value)).toBe(true)
  })

  it('reads none and undefined only when the question allows them', () => {
    expect(readGeoAnswer('none', { allowNone: true })).toMatchObject({ ok: true, value: { kind: 'none' } })
    expect(readGeoAnswer('undefined', { allowUndefined: true })).toMatchObject({ ok: true, value: { kind: 'undefined' } })
    const banned = readGeoAnswer('none')
    expect(banned.ok).toBe(false)
    if (!banned.ok) expect(banned.message.length).toBeGreaterThan(0)
    const other = readGeoAnswer('undefined')
    expect(other.ok).toBe(false)
    if (!other.ok) expect(other.message.length).toBeGreaterThan(0)
  })

  it('refuses nonsense with a message', () => {
    for (const raw of ['', '   ', 'abc', 'hello', 'x + 1', 'sqrt(-4)', '1/0', '(2,)', '(2, 3, 4)']) {
      const read = readGeoAnswer(raw)
      expect(read.ok, raw).toBe(false)
      if (!read.ok) expect(read.message.length, raw).toBeGreaterThan(0)
    }
  })

  it('flags an equal value that is not simplest radical form', () => {
    const root45 = qty('√45')
    expect(sameQty(root45.value.q, geoQty(3, 1, 5))).toBe(true)
    expect(root45.simplest).toBe(false)
    expect(root45.note).toMatch(/simplest|square/i)

    const rationalized = qty('6/√2')
    expect(sameQty(rationalized.value.q, geoQty(3, 1, 2))).toBe(true)
    expect(rationalized.simplest).toBe(false)
    expect(rationalized.note).toMatch(/denominator/i)

    const perfect = qty('√9')
    expect(sameQty(perfect.value.q, geoQty(3, 1, 1))).toBe(true)
    expect(perfect.simplest).toBe(false)
    expect(perfect.note).toMatch(/perfect|number/i)

    const twenty = qty('√20')
    expect(sameQty(twenty.value.q, geoQty(2, 1, 5))).toBe(true)
    expect(twenty.simplest).toBe(false)
  })
})

describe('readGeoAnswer with ratios (a scale factor)', () => {
  const ratio = (raw: string) => readGeoAnswer(raw, { ratio: true })
  it('reads 2:3, 2 : 3, 2 to 3, and k = 2:3 as the number 2/3, and 4:6 as the same ratio', () => {
    for (const raw of ['2/3', '2:3', '2 : 3', '2 to 3', 'k = 2:3', '4:6', '2∶3']) {
      const read = ratio(raw)
      expect(read.ok, raw).toBe(true)
      if (!read.ok || read.value.kind !== 'qty') continue
      expect(sameQty(read.value.q, geoQty(2, 3, 1)), raw).toBe(true)
    }
    const whole = ratio('3:1')
    expect(whole.ok && whole.value.kind === 'qty' && sameQty(whole.value.q, geoQty(3, 1, 1))).toBe(true)
  })

  it('reads a colon only when the part is a ratio, and refuses two colons', () => {
    expect(readGeoAnswer('2:3').ok).toBe(false)
    expect(ratio('2:3:4').ok).toBe(false)
    expect(ratio('2:').ok).toBe(false)
    expect(ratio('x:3').ok).toBe(false)
  })
})
