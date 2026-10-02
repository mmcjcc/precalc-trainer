/**
 * The model against tables typed out BY HAND from the rule (filling order 1s 2s 2p 3s 3p 4s 3d 4p; chromium
 * and copper move one electron from 4s to 3d; a cation loses its highest-shell electrons first, so 4s before
 * 3d; an anion fills the next open subshell). The generator derives every configuration; these tables do not
 * come from it, so a slip in the generator cannot agree with itself.
 */
import { describe, expect, it } from 'vitest'
import { ELEMENTS, elementBySymbol } from '../chem/elements'
import {
  aufbau,
  ECONFIG_MAX_Z,
  econfigAtoms,
  econfigIons,
  econfigSpecies,
  electronConfiguration,
  electronCount,
  EXCEPTION_ELEMENTS,
  FILLING_ORDER,
  neutralConfiguration,
  NOBLE_GAS_CORES,
  nobleGasShorthand,
  resolveSpecies,
  sameConfiguration,
  shellOrder,
  speciesDisplay,
  speciesLatex,
  speciesProblem,
  speciesText,
  subshellName,
  totalElectrons,
} from './model'
import { econfigProblem } from './index'
import { configurationDisplay, configurationLatex, configurationText, termsText } from './text'

/** [symbol, full configuration in filling order, noble-gas shorthand]. Typed by hand, one row per element. */
const NEUTRAL: readonly [string, string, string][] = [
  ['H', '1s1', '1s1'],
  ['He', '1s2', '1s2'],
  ['Li', '1s2 2s1', '[He] 2s1'],
  ['Be', '1s2 2s2', '[He] 2s2'],
  ['B', '1s2 2s2 2p1', '[He] 2s2 2p1'],
  ['C', '1s2 2s2 2p2', '[He] 2s2 2p2'],
  ['N', '1s2 2s2 2p3', '[He] 2s2 2p3'],
  ['O', '1s2 2s2 2p4', '[He] 2s2 2p4'],
  ['F', '1s2 2s2 2p5', '[He] 2s2 2p5'],
  ['Ne', '1s2 2s2 2p6', '[He] 2s2 2p6'],
  ['Na', '1s2 2s2 2p6 3s1', '[Ne] 3s1'],
  ['Mg', '1s2 2s2 2p6 3s2', '[Ne] 3s2'],
  ['Al', '1s2 2s2 2p6 3s2 3p1', '[Ne] 3s2 3p1'],
  ['Si', '1s2 2s2 2p6 3s2 3p2', '[Ne] 3s2 3p2'],
  ['P', '1s2 2s2 2p6 3s2 3p3', '[Ne] 3s2 3p3'],
  ['S', '1s2 2s2 2p6 3s2 3p4', '[Ne] 3s2 3p4'],
  ['Cl', '1s2 2s2 2p6 3s2 3p5', '[Ne] 3s2 3p5'],
  ['Ar', '1s2 2s2 2p6 3s2 3p6', '[Ne] 3s2 3p6'],
  ['K', '1s2 2s2 2p6 3s2 3p6 4s1', '[Ar] 4s1'],
  ['Ca', '1s2 2s2 2p6 3s2 3p6 4s2', '[Ar] 4s2'],
  ['Sc', '1s2 2s2 2p6 3s2 3p6 4s2 3d1', '[Ar] 4s2 3d1'],
  ['Ti', '1s2 2s2 2p6 3s2 3p6 4s2 3d2', '[Ar] 4s2 3d2'],
  ['V', '1s2 2s2 2p6 3s2 3p6 4s2 3d3', '[Ar] 4s2 3d3'],
  ['Cr', '1s2 2s2 2p6 3s2 3p6 4s1 3d5', '[Ar] 4s1 3d5'],
  ['Mn', '1s2 2s2 2p6 3s2 3p6 4s2 3d5', '[Ar] 4s2 3d5'],
  ['Fe', '1s2 2s2 2p6 3s2 3p6 4s2 3d6', '[Ar] 4s2 3d6'],
  ['Co', '1s2 2s2 2p6 3s2 3p6 4s2 3d7', '[Ar] 4s2 3d7'],
  ['Ni', '1s2 2s2 2p6 3s2 3p6 4s2 3d8', '[Ar] 4s2 3d8'],
  ['Cu', '1s2 2s2 2p6 3s2 3p6 4s1 3d10', '[Ar] 4s1 3d10'],
  ['Zn', '1s2 2s2 2p6 3s2 3p6 4s2 3d10', '[Ar] 4s2 3d10'],
  ['Ga', '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p1', '[Ar] 4s2 3d10 4p1'],
  ['Ge', '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p2', '[Ar] 4s2 3d10 4p2'],
  ['As', '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p3', '[Ar] 4s2 3d10 4p3'],
  ['Se', '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p4', '[Ar] 4s2 3d10 4p4'],
  ['Br', '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p5', '[Ar] 4s2 3d10 4p5'],
  ['Kr', '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6', '[Ar] 4s2 3d10 4p6'],
]

/** [ion, full configuration, shorthand]. Typed by hand: every charge in commonCharges for Z ≤ 36, except H+. */
const IONS: readonly [string, string, string][] = [
  ['H-', '1s2', '[He]'],
  ['Li+', '1s2', '[He]'],
  ['Be2+', '1s2', '[He]'],
  ['N3-', '1s2 2s2 2p6', '[Ne]'],
  ['O2-', '1s2 2s2 2p6', '[Ne]'],
  ['F-', '1s2 2s2 2p6', '[Ne]'],
  ['Na+', '1s2 2s2 2p6', '[Ne]'],
  ['Mg2+', '1s2 2s2 2p6', '[Ne]'],
  ['Al3+', '1s2 2s2 2p6', '[Ne]'],
  ['P3-', '1s2 2s2 2p6 3s2 3p6', '[Ar]'],
  ['S2-', '1s2 2s2 2p6 3s2 3p6', '[Ar]'],
  ['Cl-', '1s2 2s2 2p6 3s2 3p6', '[Ar]'],
  ['K+', '1s2 2s2 2p6 3s2 3p6', '[Ar]'],
  ['Ca2+', '1s2 2s2 2p6 3s2 3p6', '[Ar]'],
  ['Cr3+', '1s2 2s2 2p6 3s2 3p6 3d3', '[Ar] 3d3'],
  ['Cr2+', '1s2 2s2 2p6 3s2 3p6 3d4', '[Ar] 3d4'],
  ['Mn2+', '1s2 2s2 2p6 3s2 3p6 3d5', '[Ar] 3d5'],
  ['Mn3+', '1s2 2s2 2p6 3s2 3p6 3d4', '[Ar] 3d4'],
  ['Fe3+', '1s2 2s2 2p6 3s2 3p6 3d5', '[Ar] 3d5'],
  ['Fe2+', '1s2 2s2 2p6 3s2 3p6 3d6', '[Ar] 3d6'],
  ['Co2+', '1s2 2s2 2p6 3s2 3p6 3d7', '[Ar] 3d7'],
  ['Co3+', '1s2 2s2 2p6 3s2 3p6 3d6', '[Ar] 3d6'],
  ['Ni2+', '1s2 2s2 2p6 3s2 3p6 3d8', '[Ar] 3d8'],
  ['Cu2+', '1s2 2s2 2p6 3s2 3p6 3d9', '[Ar] 3d9'],
  ['Cu+', '1s2 2s2 2p6 3s2 3p6 3d10', '[Ar] 3d10'],
  ['Zn2+', '1s2 2s2 2p6 3s2 3p6 3d10', '[Ar] 3d10'],
  ['Br-', '1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6', '[Kr]'],
]

describe('neutral atoms: all 36 against the hand-typed table', () => {
  it('has one row per element, in order of atomic number', () => {
    expect(NEUTRAL).toHaveLength(36)
    NEUTRAL.forEach(([symbol], i) => expect(elementBySymbol(symbol)?.z, symbol).toBe(i + 1))
  })

  it.each(NEUTRAL)('%s is %s (shorthand %s)', (symbol, full, shorthand) => {
    expect(configurationText(symbol)).toBe(full)
    expect(configurationText(symbol, { form: 'shorthand' })).toBe(shorthand)
    expect(termsText(electronConfiguration(symbol))).toBe(full)
  })

  it('every configuration holds exactly Z electrons', () => {
    for (const [symbol] of NEUTRAL) {
      const z = elementBySymbol(symbol)!.z
      expect(totalElectrons(electronConfiguration(symbol)), symbol).toBe(z)
      expect(electronCount(symbol)).toBe(z)
    }
  })

  it('the exceptions in this range are exactly chromium and copper', () => {
    const differs = econfigAtoms().filter((sp) => !sameConfiguration(neutralConfiguration(sp.z), aufbau(sp.z)))
    expect(differs.map((sp) => speciesText(sp))).toEqual(['Cr', 'Cu'])
    expect(EXCEPTION_ELEMENTS).toEqual([24, 29])
    expect(configurationText('Cr', { form: 'shorthand' })).toBe('[Ar] 4s1 3d5')
    expect(configurationText('Cu', { form: 'shorthand' })).toBe('[Ar] 4s1 3d10')
  })
})

describe('ions: every taught charge against the hand-typed table', () => {
  it('the table lists exactly the ions the model covers', () => {
    const expected: string[] = []
    for (const el of ELEMENTS) if (el.z <= 36) for (const c of el.commonCharges) if (!(el.symbol === 'H' && c === 1)) expected.push(speciesText({ z: el.z, charge: c }))
    expect(econfigIons().map(speciesText)).toEqual(expected)
    expect([...IONS.map(([ion]) => ion)].sort()).toEqual([...expected].sort())
    expect(IONS).toHaveLength(27)
  })

  it.each(IONS)('%s is %s (shorthand %s)', (ion, full, shorthand) => {
    expect(speciesProblem(ion)).toBeNull()
    expect(configurationText(ion)).toBe(full)
    expect(configurationText(ion, { form: 'shorthand' })).toBe(shorthand)
  })

  it('a transition-metal cation loses 4s before 3d', () => {
    expect(configurationText('Fe2+', { form: 'shorthand' })).toBe('[Ar] 3d6')
    expect(configurationText('Fe3+', { form: 'shorthand' })).toBe('[Ar] 3d5')
    expect(configurationText('Cu+', { form: 'shorthand' })).toBe('[Ar] 3d10')
    expect(configurationText('Zn2+', { form: 'shorthand' })).toBe('[Ar] 3d10')
    for (const sp of econfigIons()) if (sp.z >= 21 && sp.z <= 30) expect(electronConfiguration(sp).some((t) => subshellName(t) === '4s'), speciesText(sp)).toBe(false)
  })

  it('every ion holds Z minus the charge', () => {
    for (const sp of econfigIons()) expect(totalElectrons(electronConfiguration(sp)), speciesText(sp)).toBe(sp.z - sp.charge)
  })
})

describe('orders and renderers', () => {
  it('filling order and shell order', () => {
    expect(configurationText('Fe')).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d6')
    expect(configurationText('Fe', { order: 'shell' })).toBe('1s2 2s2 2p6 3s2 3p6 3d6 4s2')
    expect(configurationText('Fe', { form: 'shorthand', order: 'shell' })).toBe('[Ar] 3d6 4s2')
    expect(configurationText('Br', { order: 'shell' })).toBe('1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p5')
    expect(termsText(shellOrder(electronConfiguration('Cu')))).toBe('1s2 2s2 2p6 3s2 3p6 3d10 4s1')
    expect(termsText(electronConfiguration('Cu', 'shell'))).toBe('1s2 2s2 2p6 3s2 3p6 3d10 4s1')
    expect(FILLING_ORDER.map(subshellName).join(' ')).toBe('1s 2s 2p 3s 3p 4s 3d 4p')
  })

  it('display text and LaTeX', () => {
    expect(configurationDisplay('Fe')).toBe('1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶')
    expect(configurationDisplay('Cu', { form: 'shorthand' })).toBe('[Ar] 4s¹ 3d¹⁰')
    expect(configurationDisplay('Na+', { form: 'shorthand' })).toBe('[Ne]')
    expect(configurationLatex('Fe', { form: 'shorthand' })).toBe('\\mathrm{[Ar]\\,4s^{2}\\,3d^{6}}')
    expect(configurationLatex('Zn', { form: 'shorthand' })).toBe('\\mathrm{[Ar]\\,4s^{2}\\,3d^{10}}')
    expect(configurationLatex('C')).toBe('\\mathrm{1s^{2}\\,2s^{2}\\,2p^{2}}')
    expect(configurationLatex('Cl-', { form: 'shorthand' })).toBe('\\mathrm{[Ar]}')
  })

  it('the shorthand as data', () => {
    expect(nobleGasShorthand('Fe')).toEqual({ core: { symbol: 'Ar', z: 18 }, rest: [{ n: 4, l: 's', count: 2 }, { n: 3, l: 'd', count: 6 }] })
    expect(nobleGasShorthand('Fe', 'shell').rest.map(subshellName)).toEqual(['3d', '4s'])
    expect(nobleGasShorthand('He')).toEqual({ core: null, rest: [{ n: 1, l: 's', count: 2 }] })
    expect(nobleGasShorthand('Ar').core?.symbol).toBe('Ne')
    expect(nobleGasShorthand('Br-')).toEqual({ core: { symbol: 'Kr', z: 36 }, rest: [] })
    expect(NOBLE_GAS_CORES).toEqual([{ symbol: 'He', z: 2 }, { symbol: 'Ne', z: 10 }, { symbol: 'Ar', z: 18 }, { symbol: 'Kr', z: 36 }])
  })
})

describe('species', () => {
  it('reads text and parts', () => {
    expect(resolveSpecies('Fe')).toEqual({ z: 26, charge: 0 })
    expect(resolveSpecies('Fe3+')).toEqual({ z: 26, charge: 3 })
    expect(resolveSpecies('Fe 3+')).toEqual({ z: 26, charge: 3 })
    expect(resolveSpecies('Fe^3+')).toEqual({ z: 26, charge: 3 })
    expect(resolveSpecies('Fe+3')).toEqual({ z: 26, charge: 3 })
    expect(resolveSpecies('Fe³⁺')).toEqual({ z: 26, charge: 3 })
    expect(resolveSpecies('Cl-')).toEqual({ z: 17, charge: -1 })
    expect(resolveSpecies('Cl−')).toEqual({ z: 17, charge: -1 })
    expect(resolveSpecies('O2-')).toEqual({ z: 8, charge: -2 })
    expect(resolveSpecies('Na+')).toEqual({ z: 11, charge: 1 })
    expect(resolveSpecies({ symbol: 'S', charge: -2 })).toEqual({ z: 16, charge: -2 })
    expect(resolveSpecies({ z: 8 })).toEqual({ z: 8, charge: 0 })
    expect(resolveSpecies('Xx')).toBeNull()
    expect(resolveSpecies('iron')).toBeNull()
    expect(econfigSpecies('Fe', 3)).toEqual({ z: 26, charge: 3 })
    expect(econfigSpecies('Cl-')).toEqual({ z: 17, charge: -1 })
  })

  it('writes labels', () => {
    expect(speciesText({ z: 26, charge: 3 })).toBe('Fe3+')
    expect(speciesText({ z: 17, charge: -1 })).toBe('Cl-')
    expect(speciesText({ z: 11, charge: 0 })).toBe('Na')
    expect(speciesDisplay({ z: 26, charge: 3 })).toBe('Fe³⁺')
    expect(speciesDisplay({ z: 8, charge: -2 })).toBe('O²⁻')
    expect(speciesDisplay({ z: 11, charge: 1 })).toBe('Na⁺')
    expect(speciesLatex({ z: 26, charge: 3 })).toBe('\\mathrm{Fe}^{3+}')
    expect(speciesLatex({ z: 17, charge: -1 })).toBe('\\mathrm{Cl}^{-}')
    expect(speciesLatex({ z: 6, charge: 0 })).toBe('\\mathrm{C}')
    for (const sp of [...econfigAtoms(), ...econfigIons()]) expect(resolveSpecies(speciesText(sp))).toEqual(sp)
    for (const sp of [...econfigAtoms(), ...econfigIons()]) expect(resolveSpecies(speciesDisplay(sp))).toEqual(sp)
  })

  it('says why a species is outside the model', () => {
    expect(speciesProblem('Fe')).toBeNull()
    expect(speciesProblem('Kr')).toBeNull()
    expect(speciesProblem('Rb')).toBe('Element 37 (rubidium) is outside the model: hydrogen (1) to krypton (36) only.')
    expect(speciesProblem('Ag+')).toMatch(/outside the model/)
    expect(speciesProblem('Fe4+')).toBe('Fe⁴⁺ is outside the model: the taught charges of iron are 3+ and 2+.')
    expect(speciesProblem('Na2+')).toBe('Na²⁺ is outside the model: the taught charge of sodium is 1+.')
    expect(speciesProblem('Ar+')).toBe('Ar⁺ is outside the model: argon has no simple ion taught at this level.')
    expect(speciesProblem('C4-')).toMatch(/no simple ion/)
    expect(speciesProblem('H+')).toBe('H⁺ has no electrons, so there is no configuration to write.')
    expect(speciesProblem('H-')).toBeNull()
    expect(speciesProblem('Zz')).toBe('Could not read the species "Zz".')
    expect(speciesProblem({ z: 0 })).toMatch(/outside the model/)
    expect(speciesProblem({ z: 2.5 })).toMatch(/Could not read/)
    expect(() => electronConfiguration('Rb')).toThrow(RangeError)
    expect(() => configurationText('Fe4+')).toThrow(RangeError)
    expect(() => econfigSpecies('Fe', 4)).toThrow(RangeError)
  })

  it('lists the atoms and ions of the model', () => {
    expect(econfigAtoms()).toHaveLength(36)
    expect(ECONFIG_MAX_Z).toBe(36)
    expect(econfigAtoms().every((sp) => sp.charge === 0 && speciesProblem(sp) === null)).toBe(true)
    expect(econfigIons()).toHaveLength(27)
    expect(econfigIons().every((sp) => sp.charge !== 0 && speciesProblem(sp) === null)).toBe(true)
  })
})

describe('econfigProblem: the validator for the content stage', () => {
  it('checks the species alone when no question is given', () => {
    expect(econfigProblem('Fe3+')).toBeNull()
    expect(econfigProblem('Fe4+')).toMatch(/outside the model/)
    expect(econfigProblem('Rb')).toMatch(/outside the model/)
    expect(econfigProblem('H+')).toMatch(/no electrons/)
  })

  it('valence: main-group neutral atoms only', () => {
    expect(econfigProblem('Cl', 'valence')).toBeNull()
    expect(econfigProblem('Fe', 'valence')).toMatch(/transition metal.*out of scope/)
    expect(econfigProblem('Zn', 'valence')).toMatch(/transition metal/)
    expect(econfigProblem('Cl-', 'valence')).toMatch(/neutral atoms only/)
  })

  it('shorthand: hydrogen and helium have none', () => {
    expect(econfigProblem('H', 'shorthand')).toBe('No noble gas comes before hydrogen, so it has no shorthand to write.')
    expect(econfigProblem('He', 'shorthand')).toMatch(/helium/)
    expect(econfigProblem('Li', 'shorthand')).toBeNull()
    expect(econfigProblem('Na+', 'shorthand')).toBeNull()
  })

  it('diagram: the subshell must be one of 1s to 4p', () => {
    expect(econfigProblem('O', 'diagram')).toBeNull()
    expect(econfigProblem('O', 'diagram', '2p')).toBeNull()
    expect(econfigProblem('O', 'diagram', '3d')).toBeNull()
    expect(econfigProblem('O', 'diagram', '5s')).toMatch(/outside the model/)
    expect(econfigProblem('O', 'diagram', 'xx')).toMatch(/Could not read/)
  })

  it('every listed species passes for the questions that take any species', () => {
    for (const sp of [...econfigAtoms(), ...econfigIons()])
      for (const q of ['full', 'identify', 'diagram', 'unpaired'] as const) expect(econfigProblem(sp, q), `${speciesText(sp)} ${q}`).toBeNull()
  })
})
