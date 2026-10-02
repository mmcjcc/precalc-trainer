/**
 * Anchors typed separately from the core and its own tables: the facts a chemistry text prints
 * (CK-12 ch. 5). If the model drifts, these fail without help from the core's own tests.
 */
import { describe, expect, it } from 'vitest'
import {
  configurationText,
  econfigAtoms,
  electronConfiguration,
  gradeShorthandConfiguration,
  speciesText,
  unpairedElectrons,
  valenceElectrons,
} from '@/engine'

const SYMBOLS =
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr'.split(' ')

/** Unpaired electrons of the neutral atoms, Z = 1 to 36. */
const UNPAIRED = [1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 6, 5, 4, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0]

/** Valence electrons by group, main-group atoms only. */
const VALENCE: Record<string, number> = {
  H: 1, He: 2, Li: 1, Be: 2, B: 3, C: 4, N: 5, O: 6, F: 7, Ne: 8,
  Na: 1, Mg: 2, Al: 3, Si: 4, P: 5, S: 6, Cl: 7, Ar: 8,
  K: 1, Ca: 2, Ga: 3, Ge: 4, As: 5, Se: 6, Br: 7, Kr: 8,
}

const SHORTHAND: Record<string, string> = {
  Li: '[He] 2s1', C: '[He] 2s2 2p2', Ne: '[He] 2s2 2p6', Na: '[Ne] 3s1', Cl: '[Ne] 3s2 3p5', Ar: '[Ne] 3s2 3p6',
  K: '[Ar] 4s1', Ca: '[Ar] 4s2', Sc: '[Ar] 4s2 3d1', V: '[Ar] 4s2 3d3', Cr: '[Ar] 4s1 3d5', Mn: '[Ar] 4s2 3d5',
  Fe: '[Ar] 4s2 3d6', Ni: '[Ar] 4s2 3d8', Cu: '[Ar] 4s1 3d10', Zn: '[Ar] 4s2 3d10', Ga: '[Ar] 4s2 3d10 4p1',
  Br: '[Ar] 4s2 3d10 4p5', Kr: '[Ar] 4s2 3d10 4p6',
  'Na+': '[Ne]', 'Mg2+': '[Ne]', 'Al3+': '[Ne]', 'N3-': '[Ne]', 'O2-': '[Ne]', 'F-': '[Ne]',
  'P3-': '[Ar]', 'S2-': '[Ar]', 'Cl-': '[Ar]', 'K+': '[Ar]', 'Ca2+': '[Ar]', 'Br-': '[Kr]',
  'Cr2+': '[Ar] 3d4', 'Cr3+': '[Ar] 3d3', 'Mn2+': '[Ar] 3d5', 'Mn3+': '[Ar] 3d4', 'Fe2+': '[Ar] 3d6',
  'Fe3+': '[Ar] 3d5', 'Co2+': '[Ar] 3d7', 'Co3+': '[Ar] 3d6', 'Ni2+': '[Ar] 3d8', 'Cu+': '[Ar] 3d10',
  'Cu2+': '[Ar] 3d9', 'Zn2+': '[Ar] 3d10',
}

const ION_UNPAIRED: Record<string, number> = {
  'Fe2+': 4, 'Fe3+': 5, 'Mn2+': 5, 'Cr3+': 3, 'Co2+': 3, 'Ni2+': 2, 'Cu2+': 1, 'Cu+': 0, 'Zn2+': 0, 'O2-': 0,
}

describe('electron configuration anchors', () => {
  it('lists hydrogen to krypton in order, each with Z electrons', () => {
    const atoms = econfigAtoms()
    expect(atoms.map((a) => speciesText(a))).toEqual(SYMBOLS)
    atoms.forEach((a, i) => {
      const total = electronConfiguration(a).reduce((s, t) => s + t.count, 0)
      expect(total, SYMBOLS[i]).toBe(i + 1)
    })
  })

  it('writes the full configuration of krypton in filling order', () => {
    expect(configurationText('Kr')).toBe('1s2 2s2 2p6 3s2 3p6 4s2 3d10 4p6')
    expect(configurationText('Fe', { order: 'shell' })).toBe('1s2 2s2 2p6 3s2 3p6 3d6 4s2')
  })

  it.each(Object.entries(SHORTHAND))('%s is %s', (species, text) => {
    expect(configurationText(species, { form: 'shorthand' })).toBe(text)
    expect(gradeShorthandConfiguration(species, text).verdict).toBe('correct')
  })

  it('counts the unpaired electrons of every atom', () => {
    expect(SYMBOLS.map((s) => unpairedElectrons(s))).toEqual(UNPAIRED)
  })

  it.each(Object.entries(ION_UNPAIRED))('%s has %i unpaired electrons', (species, n) => {
    expect(unpairedElectrons(species)).toBe(n)
  })

  it('reads valence electrons off the group, and declines transition metals', () => {
    for (const s of SYMBOLS) expect(valenceElectrons(s), s).toBe(VALENCE[s] ?? null)
  })
})
