/**
 * The reader's Unit 9 additions: a multiple of π (6π, (3π)/2, 6π√2) and, only where a part allows it, a sum of
 * unlike terms (4π − 8). A quantity with no π is read, stored and written exactly as before.
 */
import { describe, expect, it } from 'vitest'
import { approxValue, formatQty, formatValue, geoQty, geoSum, readGeoAnswer, sameGeoValue, sameQty } from './answer'

function qty(raw: string) {
  const read = readGeoAnswer(raw)
  expect(read.ok, raw).toBe(true)
  if (!read.ok) throw new Error(`${raw}: not a quantity`)
  const value = read.value
  if (value.kind !== 'qty') throw new Error(`${raw}: not a quantity`)
  return { ...read, value }
}

describe('readGeoAnswer with π', () => {
  it('reads a multiple of π in every spelling, and writes it the way she types it', () => {
    const six = geoQty(6, 1, 1, true)
    for (const raw of ['6π', '6pi', '6 pi', '6 π', '6*pi', '6·π', 'pi*6', 'C = 6π', '6PI']) {
      const read = qty(raw)
      expect(sameQty(read.value.q, six), raw).toBe(true)
      expect(read.simplest, raw).toBe(true)
    }
    expect(formatQty(six)).toBe('6π')
    expect(formatQty(geoQty(1, 1, 1, true))).toBe('π')
    expect(formatQty(geoQty(3, 2, 1, true))).toBe('(3π)/2')
    expect(formatQty(geoQty(1, 2, 1, true))).toBe('π/2')
    expect(formatQty(geoQty(-3, 2, 1, true))).toBe('-(3π)/2')
    expect(formatQty(geoQty(6, 1, 2, true))).toBe('6π√2')
    expect(formatQty(geoQty(1, 3, 3, true))).toBe('π√3/3')
  })

  it('6π is not 6, and a quantity with no π is stored as before', () => {
    expect(sameQty(geoQty(6, 1, 1, true), geoQty(6, 1, 1))).toBe(false)
    expect(geoQty(6, 1, 1)).toEqual({ n: 6, d: 1, rad: 1 })
    expect(qty('6').value.q).toEqual({ n: 6, d: 1, rad: 1 })
    expect(qty('3√5').value.q).toEqual({ n: 3, d: 1, rad: 5 })
    expect(geoQty(0, 1, 1, true)).toEqual({ n: 0, d: 1, rad: 1 })
  })

  it('reads fractions and radicals times π, and every written form reads back as itself', () => {
    const half = geoQty(3, 2, 1, true)
    for (const raw of ['3π/2', '(3π)/2', '3/2π', '1.5π', '3pi/2']) {
      const read = qty(raw)
      expect(sameQty(read.value.q, half), raw).toBe(true)
      expect(read.simplest, raw).toBe(true)
    }
    expect(qty('1.5π').decimal).toBe(true)
    const root = geoQty(6, 1, 2, true)
    for (const raw of ['6π√2', '6√2π', '6sqrt(2)pi', '6pisqrt(2)', '6 pi sqrt 2']) {
      const read = qty(raw)
      expect(sameQty(read.value.q, root), raw).toBe(true)
      expect(read.simplest, raw).toBe(true)
    }
    const written = [geoQty(6, 1, 1, true), geoQty(1, 1, 1, true), geoQty(3, 2, 1, true), geoQty(1, 2, 1, true), geoQty(6, 1, 2, true), geoQty(1, 3, 3, true), geoQty(25, 4, 1, true)]
    for (const q of written) {
      const read = qty(formatQty(q))
      expect(sameQty(read.value.q, q), formatQty(q)).toBe(true)
      expect(read.simplest, formatQty(q)).toBe(true)
    }
  })

  it('flags an equal value that is not simplest, and names π in the note', () => {
    const unreduced = qty('6π/4')
    expect(sameQty(unreduced.value.q, geoQty(3, 2, 1, true))).toBe(true)
    expect(unreduced.simplest).toBe(false)
    expect(unreduced.note).toBe('6π/4 is not simplest form. Reduce the number in front of π.')
    const like = qty('2π + 4π')
    expect(sameQty(like.value.q, geoQty(6, 1, 1, true))).toBe(true)
    expect(like.simplest).toBe(false)
    expect(like.note).toMatch(/single term/)
    const perfect = qty('√4π')
    expect(sameQty(perfect.value.q, geoQty(2, 1, 1, true))).toBe(true)
    expect(perfect.simplest).toBe(false)
  })

  it('refuses π squared, π in the denominator, a root of π, and letters that are not π', () => {
    for (const raw of ['ππ', 'pi*pi', '5/π', '10/(2π)', '√π', 'sqrt(pi)', 'pie', '2πr', 'π^2', 'p']) {
      const read = readGeoAnswer(raw)
      expect(read.ok, raw).toBe(false)
      if (!read.ok) expect(read.message.length, raw).toBeGreaterThan(0)
    }
    // π over π is a plain number again.
    expect(sameQty(qty('6π/π').value.q, geoQty(6, 1, 1))).toBe(true)
  })
})

describe('readGeoAnswer with a sum (the segment of a circle)', () => {
  const sum = (raw: string) => readGeoAnswer(raw, { sum: true })
  const seg = geoSum([geoQty(4, 1, 1, true), geoQty(-8, 1, 1)])

  it('reads 4π − 8 in any order, factored, and named', () => {
    expect(seg.kind).toBe('sum')
    for (const raw of ['4π - 8', '4π − 8', '4pi-8', '-8 + 4π', '4(π - 2)', '(π - 2)4', 'A = 4π - 8', '4π + -8']) {
      const read = sum(raw)
      expect(read.ok, raw).toBe(true)
      if (!read.ok) continue
      expect(sameGeoValue(read.value, seg), raw).toBe(true)
      expect(read.simplest, raw).toBe(true)
    }
    expect(sameGeoValue(seg, geoSum([geoQty(-8, 1, 1), geoQty(4, 1, 1, true)]))).toBe(true)
    expect(sameGeoValue(seg, geoSum([geoQty(4, 1, 1, true), geoQty(8, 1, 1)]))).toBe(false)
    expect(approxValue(seg)).toBeCloseTo(4 * Math.PI - 8, 9)
  })

  it('writes what is added first, and every written sum reads back as itself', () => {
    const cases: [ReturnType<typeof geoSum>, string][] = [
      [seg, '4π - 8'],
      [geoSum([geoQty(16, 1, 1), geoQty(-4, 1, 1, true)]), '16 - 4π'],
      [geoSum([geoQty(6, 1, 1, true), geoQty(-9, 1, 3)]), '6π - 9√3'],
      [geoSum([geoQty(24, 1, 1, true), geoQty(9, 1, 3)]), '24π + 9√3'],
      [geoSum([geoQty(4, 1, 2), geoQty(8, 1, 1)]), '8 + 4√2'],
      [geoSum([geoQty(25, 4, 1, true), geoQty(-25, 2, 1)]), '(25π)/4 - 25/2'],
      [geoSum([geoQty(3, 1, 1, true), geoQty(-9, 4, 3)]), '3π - (9√3)/4'],
    ]
    for (const [value, text] of cases) {
      expect(formatValue(value)).toBe(text)
      const read = sum(text)
      expect(read.ok && sameGeoValue(read.value, value), text).toBe(true)
      expect(read.ok && read.simplest, text).toBe(true)
    }
  })

  it('combines like terms, and one term left is a plain quantity', () => {
    expect(sameGeoValue(geoSum([geoQty(2, 1, 1, true), geoQty(2, 1, 1, true), geoQty(-8, 1, 1)]), seg)).toBe(true)
    expect(geoSum([geoQty(4, 1, 1, true), geoQty(-8, 1, 1), geoQty(8, 1, 1)])).toEqual({ kind: 'qty', q: geoQty(4, 1, 1, true) })
    const uncombined = sum('2π + 2π - 8')
    expect(uncombined.ok && sameGeoValue(uncombined.value, seg)).toBe(true)
    expect(uncombined.ok && uncombined.simplest).toBe(false)
    if (uncombined.ok) expect(uncombined.note).toMatch(/Combine the like terms/)
    const unreduced = sum('8π/2 - 8')
    expect(unreduced.ok && sameGeoValue(unreduced.value, seg)).toBe(true)
    expect(unreduced.ok && unreduced.simplest).toBe(false)
    const single = sum('4π')
    expect(single.ok && single.value.kind).toBe('qty')
    expect(single.ok && single.simplest).toBe(true)
  })

  it('is refused where the part does not allow one, in a point, and under a root or a fraction bar', () => {
    for (const raw of ['4π - 8', '2 + √3', '(1 + √2, 3)']) {
      const read = readGeoAnswer(raw)
      expect(read.ok, raw).toBe(false)
      if (!read.ok) expect(read.message, raw).toMatch(/single number/)
    }
    expect(sum('(1 + √2, 3)').ok).toBe(false)
    expect(sum('√(2 + π)').ok).toBe(false)
    expect(sum('8/(π - 2)').ok).toBe(false)
  })
})
