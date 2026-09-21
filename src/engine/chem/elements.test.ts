import { describe, expect, it } from 'vitest'
import { ELEMENTS, NATURAL_ISOTOPES, NOTABLE_ISOTOPES, elementBySymbol, elementByZ } from './elements'

/**
 * Independent check of the periodic-table data. The reference values below were written separately
 * from elements.ts (IUPAC conventional atomic weights, NIST isotopic compositions), so a slip in the
 * data file shows up here instead of in a student's answer key.
 */

const num = (s: string) => Number(s)

const WEIGHTS: Record<string, number> = {
  H: 1.008, He: 4.0026, Li: 6.94, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Na: 22.99,
  Mg: 24.305, Al: 26.982, Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, K: 39.098, Ca: 40.078,
  Fe: 55.845, Cu: 63.546, Zn: 65.38, Br: 79.904, Ag: 107.87, I: 126.9, Au: 196.97, Pb: 207.2,
  U: 238.03,
}

describe('ELEMENTS', () => {
  it('lists Z = 1..92 in order with unique symbols', () => {
    expect(ELEMENTS).toHaveLength(92)
    ELEMENTS.forEach((e, i) => expect(e.z).toBe(i + 1))
    expect(new Set(ELEMENTS.map((e) => e.symbol)).size).toBe(92)
    for (const e of ELEMENTS) {
      expect(e.name).toBe(e.name.toLowerCase())
      expect(e.symbol).toMatch(/^[A-Z][a-z]?$/)
      expect(e.atomicWeight).toMatch(/^\d+(\.\d+)?$/)
    }
  })

  it.each(Object.entries(WEIGHTS))('%s has the IUPAC conventional atomic weight', (symbol, weight) => {
    const e = elementBySymbol(symbol)
    expect(e).toBeDefined()
    expect(Math.abs(num(e!.atomicWeight) - weight)).toBeLessThanOrEqual(0.01)
  })

  it('places elements in the right period and group', () => {
    const at = (s: string) => elementBySymbol(s)!
    expect([at('Na').period, at('Na').group]).toEqual([3, 1])
    expect([at('Mg').group, at('Al').group, at('C').group, at('N').group]).toEqual([2, 13, 14, 15])
    expect([at('O').group, at('Cl').group, at('Ar').group]).toEqual([16, 17, 18])
    expect([at('Fe').period, at('Fe').group, at('Cu').group, at('Zn').group]).toEqual([4, 8, 11, 12])
    expect([at('Hf').period, at('Hf').group]).toEqual([6, 4])
    for (const e of ELEMENTS) {
      const fBlock = (e.z >= 57 && e.z <= 71) || (e.z >= 89 && e.z <= 103)
      expect(e.group === null).toBe(fBlock)
    }
  })

  it('flags exactly the elements with no stable isotope as radioactive', () => {
    for (const e of ELEMENTS) expect(e.radioactive).toBe(e.z === 43 || e.z === 61 || e.z >= 84)
  })

  it('teaches the standard ion charges', () => {
    const q = (s: string) => elementBySymbol(s)!.commonCharges
    expect(q('Na')).toEqual([1])
    expect(q('Mg')).toEqual([2])
    expect(q('Al')).toEqual([3])
    expect(q('O')).toEqual([-2])
    expect(q('N')).toEqual([-3])
    expect(q('Cl')).toEqual([-1])
    expect(q('Fe')).toEqual([3, 2])
    expect(q('Cu')).toEqual([2, 1])
    expect(q('Ne')).toEqual([])
    for (const s of ['Li', 'Na', 'K', 'Rb', 'Cs']) expect(q(s)).toEqual([1])
    for (const s of ['Be', 'Mg', 'Ca', 'Sr', 'Ba']) expect(q(s)).toEqual([2])
    for (const s of ['F', 'Cl', 'Br', 'I']) expect(q(s)).toEqual([-1])
  })

  it('looks elements up by symbol (case-sensitive) and by Z', () => {
    expect(elementBySymbol('Cl')?.z).toBe(17)
    expect(elementBySymbol('CL')).toBeUndefined()
    expect(elementByZ(26)?.symbol).toBe('Fe')
    expect(elementByZ(0)).toBeUndefined()
    expect(elementByZ(93)).toBeUndefined()
  })
})

describe('NATURAL_ISOTOPES', () => {
  const MASS_NUMBERS: Record<string, number[]> = {
    H: [1, 2], Li: [6, 7], B: [10, 11], C: [12, 13], N: [14, 15], O: [16, 17, 18], Mg: [24, 25, 26],
    Si: [28, 29, 30], Cl: [35, 37], K: [39, 40, 41], Cu: [63, 65], Ga: [69, 71], Br: [79, 81],
    Rb: [85, 87], Ag: [107, 109],
  }

  it('covers exactly the planned elements with the right isotopes', () => {
    expect(Object.keys(NATURAL_ISOTOPES).sort()).toEqual(Object.keys(MASS_NUMBERS).sort())
    for (const [symbol, masses] of Object.entries(MASS_NUMBERS)) {
      expect(NATURAL_ISOTOPES[symbol]!.map((i) => i.massNumber)).toEqual(masses)
    }
  })

  it.each(Object.keys(MASS_NUMBERS))('%s: abundances sum to 100 and average to the atomic weight', (symbol) => {
    const set = NATURAL_ISOTOPES[symbol]!
    const total = set.reduce((sum, i) => sum + num(i.abundance), 0)
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(0.02)
    const average = set.reduce((sum, i) => sum + (num(i.mass) * num(i.abundance)) / 100, 0)
    expect(Math.abs(average - num(elementBySymbol(symbol)!.atomicWeight))).toBeLessThanOrEqual(0.01)
    for (const i of set) {
      expect(i.mass).toMatch(/^\d+\.\d{3,6}$/)
      expect(Math.abs(num(i.mass) - i.massNumber)).toBeLessThan(0.1)
    }
  })

  it('matches familiar textbook abundances', () => {
    const pct = (s: string, a: number) => num(NATURAL_ISOTOPES[s]!.find((i) => i.massNumber === a)!.abundance)
    expect(pct('Cl', 35)).toBeCloseTo(75.77, 0)
    expect(pct('Cu', 63)).toBeCloseTo(69.15, 0)
    expect(pct('B', 11)).toBeCloseTo(80.1, 0)
    expect(pct('Br', 79)).toBeCloseTo(50.69, 0)
    expect(pct('Li', 7)).toBeCloseTo(92.41, 0)
  })
})

describe('NOTABLE_ISOTOPES', () => {
  it('includes the isotopes students meet by name, each on a real element', () => {
    const names = NOTABLE_ISOTOPES.map((i) => `${i.symbol}-${i.massNumber}`)
    for (const n of ['H-2', 'H-3', 'C-12', 'C-14', 'I-131', 'U-235', 'U-238']) expect(names).toContain(n)
    for (const i of NOTABLE_ISOTOPES) {
      const e = elementBySymbol(i.symbol)
      expect(e).toBeDefined()
      expect(i.massNumber).toBeGreaterThanOrEqual(e!.z)
      expect(i.note.length).toBeGreaterThan(5)
    }
  })
})
