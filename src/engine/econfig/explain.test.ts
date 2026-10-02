import { describe, expect, it } from 'vitest'
import { explainConfiguration, explainIdentify, explainOrbitalDiagram, explainUnpaired } from './explain'
import { econfigAtoms, econfigIons, speciesDisplay, speciesText } from './model'
import { configurationDisplay } from './text'

const ORDER = 'Fill the subshells from the lowest energy up (the aufbau principle), in this order: 1s 2s 2p 3s 3p 4s 3d 4p. An s subshell holds 2 electrons, a p subshell 6 and a d subshell 10.'

describe('explainConfiguration', () => {
  it('a neutral atom: the count, the order, where each electron goes', () => {
    expect(explainConfiguration('Fe', { form: 'shorthand' })).toEqual([
      'Iron (Fe) has atomic number 26, so a neutral atom has 26 electrons.',
      ORDER,
      'Where each electron goes: 1s takes 2 (2 so far), 2s takes 2 (4), 2p takes 6 (10), 3s takes 2 (12), 3p takes 6 (18), 4s takes 2 (20) and 3d takes the last 6 (26).',
      '4s fills before 3d because 4s is slightly lower in energy.',
      'Fe: 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶. Written by shell number it is 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ 4s²; both orders are accepted.',
      'Shorthand: the noble gas before iron is argon (18 electrons), so [Ar] stands for 1s² 2s² 2p⁶ 3s² 3p⁶. Fe is [Ar] 4s² 3d⁶.',
    ])
  })

  it('small atoms', () => {
    expect(explainConfiguration('H')).toEqual(['Hydrogen (H) has atomic number 1, so a neutral atom has 1 electron.', ORDER, 'The one electron goes into 1s.', 'H: 1s¹.'])
    expect(explainConfiguration('He', { form: 'shorthand' })).toEqual([
      'Helium (He) has atomic number 2, so a neutral atom has 2 electrons.',
      ORDER,
      'The 2 electrons go into 1s.',
      'He: 1s².',
      'No noble gas comes before helium, so there is nothing to abbreviate: the shorthand is the same as the full configuration.',
    ])
    expect(explainConfiguration('N')).toEqual([
      'Nitrogen (N) has atomic number 7, so a neutral atom has 7 electrons.',
      ORDER,
      'Where each electron goes: 1s takes 2 (2 so far), 2s takes 2 (4) and 2p takes the last 3 (7).',
      'N: 1s² 2s² 2p³.',
    ])
  })

  it('the exceptions: why a half-filled or filled d subshell wins', () => {
    const cr = explainConfiguration('Cr')
    expect(cr[4]).toBe(
      'That order alone would give 4s² 3d⁴. Chromium is an exception: a half-filled d subshell (3d⁵) is extra stable, so one electron moves from 4s to 3d, giving 4s¹ 3d⁵.',
    )
    expect(cr[5]).toBe('Cr: 1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹ 3d⁵. Written by shell number it is 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s¹; both orders are accepted.')
    const cu = explainConfiguration('Cu')
    expect(cu[4]).toBe(
      'That order alone would give 4s² 3d⁹. Copper is an exception: a completely filled d subshell (3d¹⁰) is extra stable, so one electron moves from 4s to 3d, giving 4s¹ 3d¹⁰.',
    )
    expect(explainConfiguration('Fe').some((line) => line.includes('exception'))).toBe(false)
  })

  it('a transition-metal cation: which electrons leave first', () => {
    expect(explainConfiguration('Fe3+', { form: 'shorthand' }).slice(4)).toEqual([
      'Neutral iron: 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶.',
      'Fe³⁺ has a 3+ charge: the atom has lost 3 electrons, leaving 26 − 3 = 23.',
      'Electrons leave the outermost shell first, the one with the highest shell number: 2 from 4s, then 1 from 3d.',
      'That is why a transition metal loses its 4s electrons before any 3d electron, even though 4s filled first.',
      'Fe³⁺: 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵.',
      'Shorthand: argon has 18 electrons, no more than Fe³⁺ has, so [Ar] stands for 1s² 2s² 2p⁶ 3s² 3p⁶. Fe³⁺ is [Ar] 3d⁵.',
    ])
    expect(explainConfiguration('Cu+')).toContain('Electrons leave the outermost shell first, the one with the highest shell number: 1 from 4s.')
  })

  it('main-group ions: a noble-gas configuration', () => {
    expect(explainConfiguration('Cl-')).toEqual([
      'Chlorine (Cl) has atomic number 17, so a neutral atom has 17 electrons.',
      ORDER,
      'Where each electron goes: 1s takes 2 (2 so far), 2s takes 2 (4), 2p takes 6 (10), 3s takes 2 (12) and 3p takes the last 5 (17).',
      'Neutral chlorine: 1s² 2s² 2p⁶ 3s² 3p⁵.',
      'Cl⁻ has a 1− charge: the atom has gained 1 electron, making 17 + 1 = 18.',
      'The extra electron goes into the next open subshell: 1 into 3p.',
      'Cl⁻: 1s² 2s² 2p⁶ 3s² 3p⁶. That is the same configuration as argon: a main-group ion ends up with a noble-gas configuration.',
    ])
    const al = explainConfiguration('Al3+', { form: 'shorthand' })
    expect(al).toContain('Electrons leave the outermost shell first, the one with the highest shell number: 1 from 3p, then 2 from 3s.')
    expect(al[al.length - 1]).toBe('Shorthand: neon has 10 electrons, no more than Al³⁺ has, so [Ne] stands for 1s² 2s² 2p⁶. Al³⁺ is [Ne].')
    expect(al.some((line) => line.includes('transition metal'))).toBe(false)
  })

  it('every species: the lines end with its configuration, and nothing is undefined', () => {
    for (const sp of [...econfigAtoms(), ...econfigIons()]) {
      const full = explainConfiguration(sp)
      const short = explainConfiguration(sp, { form: 'shorthand' })
      const label = speciesDisplay(sp)
      expect(full[full.length - 1], speciesText(sp)).toContain(`${label}: ${configurationDisplay(sp)}.`)
      expect(short.length).toBe(full.length + 1)
      if (sp.z - sp.charge > 2) expect(short[short.length - 1], speciesText(sp)).toContain(`${label} is ${configurationDisplay(sp, { form: 'shorthand' })}.`)
      for (const line of short) {
        expect(line).not.toMatch(/undefined|NaN|null/)
        expect(line).toMatch(/[.]$/)
      }
    }
  })

  it('throws for a species outside the model', () => {
    expect(() => explainConfiguration('Rb')).toThrow(RangeError)
  })
})

describe('explainOrbitalDiagram', () => {
  it('a p subshell with a pair', () => {
    expect(explainOrbitalDiagram('O')).toEqual([
      'O is [He] 2s² 2p⁴: its 2p subshell holds 4 electrons.',
      'A p subshell has 3 orbitals, drawn as 3 boxes. A box holds at most 2 electrons, and two in the same box have opposite spins, one arrow up and one down (the Pauli exclusion principle).',
      "Hund's rule: every box of the subshell gets one electron, all with the same spin, before any box gets a second. The first 3 go one per box, pointing up; the 1 left over joins the first box as a pair, pointing down.",
      '2p: [↑↓] [↑ ] [↑ ]. Unpaired electrons in 2p: 2.',
    ])
  })

  it('a d subshell, an s subshell, an empty subshell', () => {
    expect(explainOrbitalDiagram('Fe3+')).toEqual([
      'Fe³⁺ is [Ar] 3d⁵: its 3d subshell holds 5 electrons.',
      'A d subshell has 5 orbitals, drawn as 5 boxes. A box holds at most 2 electrons, and two in the same box have opposite spins, one arrow up and one down (the Pauli exclusion principle).',
      "Hund's rule: every box of the subshell gets one electron, all with the same spin, before any box gets a second. The 5 electrons go into 5 separate boxes, pointing up.",
      '3d: [↑ ] [↑ ] [↑ ] [↑ ] [↑ ]. Unpaired electrons in 3d: 5.',
    ])
    expect(explainOrbitalDiagram('Ni')[2]).toContain('The first 5 go one per box, pointing up; the 3 left over join the first boxes as pairs, pointing down.')
    expect(explainOrbitalDiagram('K')).toEqual([
      'K is [Ar] 4s¹: its 4s subshell holds 1 electron.',
      'An s subshell has 1 orbital, drawn as 1 box. A box holds at most 2 electrons, and two in the same box have opposite spins, one arrow up and one down (the Pauli exclusion principle).',
      'The one electron sits alone in the box, drawn as an up arrow.',
      '4s: [↑ ]. Unpaired electrons in 4s: 1.',
    ])
    expect(explainOrbitalDiagram('Fe2+', '4s')[2]).toBe('4s is empty in Fe²⁺, so every box stays empty.')
    expect(explainOrbitalDiagram('B')[2]).toContain('The 1 electron goes into one box, pointing up.')
  })
})

describe('explainUnpaired', () => {
  it('counts subshell by subshell', () => {
    expect(explainUnpaired('Fe3+')).toEqual([
      'Fe³⁺ is [Ar] 3d⁵.',
      'A full subshell holds only pairs, so it has no unpaired electrons.',
      "3d⁵ is not full. By Hund's rule its boxes are [↑ ] [↑ ] [↑ ] [↑ ] [↑ ]: 5 unpaired electrons.",
      'Fe³⁺ has 5 unpaired electrons.',
    ])
    expect(explainUnpaired('Cr').slice(2)).toEqual([
      "4s¹ is not full. By Hund's rule its boxes are [↑ ]: 1 unpaired electron.",
      "3d⁵ is not full. By Hund's rule its boxes are [↑ ] [↑ ] [↑ ] [↑ ] [↑ ]: 5 unpaired electrons.",
      'Cr has 6 unpaired electrons in all (1 + 5).',
    ])
    expect(explainUnpaired('Ne')).toEqual(['Ne is [He] 2s² 2p⁶.', 'A full subshell holds only pairs, so it has no unpaired electrons.', 'Every occupied subshell of Ne is full, so it has 0 unpaired electrons.'])
  })
})

describe('explainIdentify', () => {
  it('a neutral atom', () => {
    expect(explainIdentify('Fe')).toEqual([
      'Add the electrons (the superscripts): 2 + 2 + 6 + 2 + 6 + 2 + 6 = 26.',
      'A neutral atom has as many protons as electrons, so the atomic number is 26: iron, Fe.',
    ])
    expect(explainIdentify('H')[0]).toBe('The configuration shows 1 electron.')
  })

  it('an ion, from the shorthand', () => {
    expect(explainIdentify('Fe3+', { form: 'shorthand' })).toEqual([
      'Add the electrons (the brackets stand for a whole noble gas): 18 for [Ar] + 5 = 23.',
      'The charge is 3+: the ion has 3 fewer electrons than protons, so it has 23 + 3 = 26 protons.',
      'Atomic number 26 is iron, so the ion is Fe³⁺.',
    ])
    expect(explainIdentify('Cl-')[1]).toBe('The charge is 1−: the ion has 1 more electron than protons, so it has 18 − 1 = 17 protons.')
  })
})
