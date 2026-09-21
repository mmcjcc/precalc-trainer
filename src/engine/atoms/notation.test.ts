import { describe, expect, it } from 'vitest'
import type { AtomGrade, AtomParticle, ErrorPatternId } from '@/shared/types'
import { ELEMENTS, elementByZ } from '../chem/elements'
import { explainNotation, gradeNotation, type NotationEntry, type NotationQuestion } from './notation'
import { chargeText, particleCounts } from './particle'

const q = (particle: AtomParticle): NotationQuestion => ({ kind: 'notation', particle })
const na23plus = q({ symbol: 'Na', z: 11, massNumber: 23, charge: 1 }) // 11 p, 12 n, 10 e
const o18minus2 = q({ symbol: 'O', z: 8, massNumber: 18, charge: -2 }) // 8 p, 10 n, 10 e
const cl37 = q({ symbol: 'Cl', z: 17, massNumber: 37, charge: 0 }) // 17 p, 20 n, 17 e

const e = (symbol: string, massNumber: number | string, atomicNumber: number | string, charge = ''): NotationEntry => ({
  symbol,
  massNumber: String(massNumber),
  atomicNumber: String(atomicNumber),
  charge,
})

function boxPattern(g: AtomGrade, box: string): ErrorPatternId | undefined {
  return g.boxes.find((b) => b.box === box)?.pattern?.id
}

describe('gradeNotation', () => {
  it('the right particle is right, in any charge spelling', () => {
    for (const charge of ['+', '1+', '+1']) expect(gradeNotation(na23plus, e('Na', 23, 11, charge)).status).toBe('correct')
    for (const charge of ['2-', '2−', '-2']) expect(gradeNotation(o18minus2, e('O', 18, 8, charge)).status).toBe('correct')
    for (const charge of ['', '0']) expect(gradeNotation(cl37, e('Cl', 37, 17, charge)).status).toBe('correct')
    expect(gradeNotation(na23plus, e('Na', 23, 11, '+')).message).toBe('Right: ²³₁₁Na⁺, which is sodium-23 with a 1+ charge.')
  })

  it('element chosen by electron count: 11 p, 10 e written as Ne', () => {
    const g = gradeNotation(na23plus, e('Ne', 23, 10, '+'))
    expect(boxPattern(g, 'symbol')).toBe('at_element_from_electrons')
    expect(boxPattern(g, 'atomicNumber')).toBe('at_element_from_electrons')
    expect(g.patterns.map((p) => p.id)).toEqual(['at_element_from_electrons'])
    expect(g.message).toContain('Ne is the element with 10 protons')
  })

  it('mass number = protons + electrons, or the neutrons alone', () => {
    expect(boxPattern(gradeNotation(na23plus, e('Na', 21, 11, '+')), 'massNumber')).toBe('at_mass_protons_electrons')
    expect(boxPattern(gradeNotation(na23plus, e('Na', 12, 11, '+')), 'massNumber')).toBe('at_mass_neutrons_only')
    expect(boxPattern(gradeNotation(cl37, e('Cl', 34, 17)), 'massNumber')).toBe('at_mass_protons_electrons')
    expect(boxPattern(gradeNotation(cl37, e('Cl', 20, 17)), 'massNumber')).toBe('at_mass_neutrons_only')
  })

  it('charge sign flipped: more electrons than protons is NEGATIVE', () => {
    const anion = gradeNotation(o18minus2, e('O', 18, 8, '2+'))
    expect(boxPattern(anion, 'charge')).toBe('at_charge_sign_flipped')
    expect(anion.message).toContain('MORE electrons than protons')
    expect(boxPattern(gradeNotation(na23plus, e('Na', 23, 11, '-')), 'charge')).toBe('at_charge_sign_flipped')
  })

  it('symbol letter case: gentle, names the rule', () => {
    for (const typed of ['NA', 'na', 'nA']) {
      const g = gradeNotation(na23plus, e(typed, 23, 11, '+'))
      expect(g.status).toBe('wrong')
      expect(g.patterns.map((p) => p.id)).toEqual(['at_symbol_case'])
      expect(g.message).toContain('capital letter followed by a lowercase one: Na')
    }
    expect(gradeNotation(o18minus2, e('o', 18, 8, '2-')).message).toContain('one-letter symbol is always a capital: O')
  })

  it('mass number and atomic number swapped', () => {
    const g = gradeNotation(na23plus, e('Na', 11, 23, '+'))
    expect(boxPattern(g, 'massNumber')).toBe('at_swapped_a_z')
    expect(boxPattern(g, 'atomicNumber')).toBe('at_swapped_a_z')
    expect(g.patterns).toHaveLength(1)
  })

  it('anything else gets a plain, specific message and no pattern', () => {
    const g = gradeNotation(na23plus, e('K', 24, 12, '0'))
    expect(g.status).toBe('wrong')
    expect(g.patterns).toEqual([])
    expect(g.boxes.find((b) => b.box === 'symbol')!.message).toContain('K is element 19')
    expect(g.boxes.find((b) => b.box === 'charge')!.message).toContain('do not balance')
    expect(gradeNotation(na23plus, e('Mg', 23, 11, '+')).message).toContain('the number of NEUTRONS here')
    expect(gradeNotation(na23plus, e('Xx', 23, 11, '+')).message).toContain('No element has the symbol “Xx”')
    expect(gradeNotation(na23plus, e('sodium', 23, 11, '+')).message).toContain('Right element!')
    expect(gradeNotation(cl37, e('Cl', 37, 17, '1-')).message).toContain('balance, so the atom is neutral')
    expect(gradeNotation(na23plus, e('Na', 33, 11, '+')).patterns).toEqual([])
  })

  it('an empty or unreadable box is a parse error (the charge may be blank)', () => {
    const g = gradeNotation(na23plus, e('', '', 'x', '2'))
    expect(g.status).toBe('parse_error')
    expect(g.boxes.map((b) => b.box)).toEqual(['symbol', 'massNumber', 'atomicNumber', 'charge'])
    expect(gradeNotation(na23plus, e('Na+', 23, 11)).boxes[0]!.parseError?.position).toBe(2)
  })

  it('over every element and taught charge: the right answer is right and each named mistake fires on its own box', () => {
    for (const el of ELEMENTS) {
      const A = el.z === 1 ? 2 : 2 * el.z + 3
      for (const c of [0, ...el.commonCharges]) {
        if (el.z - c < 1) continue
        const p: AtomParticle = { symbol: el.symbol, z: el.z, massNumber: A, charge: c }
        const qq = q(p)
        const { protons, neutrons, electrons } = particleCounts(p)
        const ch = chargeText(c).replace('−', '-')
        expect(gradeNotation(qq, e(el.symbol, A, el.z, ch)).status).toBe('correct')
        expect(boxPattern(gradeNotation(qq, e(el.symbol.toUpperCase() === el.symbol ? el.symbol.toLowerCase() : el.symbol.toUpperCase(), A, el.z, ch)), 'symbol')).toBe('at_symbol_case')
        if (protons + electrons !== A) expect(boxPattern(gradeNotation(qq, e(el.symbol, protons + electrons, el.z, ch)), 'massNumber')).toBe('at_mass_protons_electrons')
        if (neutrons !== protons + electrons) expect(boxPattern(gradeNotation(qq, e(el.symbol, neutrons, el.z, ch)), 'massNumber')).toBe('at_mass_neutrons_only')
        if (c !== 0) {
          expect(boxPattern(gradeNotation(qq, e(el.symbol, A, el.z, chargeText(-c).replace('−', '-'))), 'charge')).toBe('at_charge_sign_flipped')
          const byElectrons = elementByZ(electrons)
          if (byElectrons) expect(boxPattern(gradeNotation(qq, e(byElectrons.symbol, A, el.z, ch)), 'symbol')).toBe('at_element_from_electrons')
        }
      }
    }
  })
})

describe('explainNotation', () => {
  it('picks the element by protons, adds the nucleus, then the charge', () => {
    expect(explainNotation(na23plus)).toEqual([
      '11 protons: the element with atomic number 11 is sodium, symbol Na. The electrons never pick the element; they only set the charge.',
      'Mass number = protons + neutrons = 11 + 12 = 23. It goes on top; the atomic number, 11, goes underneath.',
      'Charge = protons − electrons = 11 − 10 = +1, written + at the top right.',
      'Put together: ²³₁₁Na⁺.',
    ])
    expect(explainNotation(cl37)[3]).toBe('Put together: ³⁷₁₇Cl, also written chlorine-37.')
  })
})
