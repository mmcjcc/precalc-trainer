import { describe, expect, it } from 'vitest'
import { gradeIdentifySpecies, identifyMistakes, speciesOfConfiguration } from './identify'
import { econfigAtoms, econfigIons, speciesText } from './model'
import { configurationText } from './text'

describe('gradeIdentifySpecies: a neutral atom', () => {
  it('accepts the symbol in any case, or the name', () => {
    expect(gradeIdentifySpecies('Fe', 'Fe')).toEqual({ verdict: 'correct', message: 'Correct: 26 electrons in a neutral atom means atomic number 26, which is iron (Fe).' })
    expect(gradeIdentifySpecies('Fe', 'fe').verdict).toBe('correct')
    expect(gradeIdentifySpecies('Fe', 'iron').verdict).toBe('correct')
    expect(gradeIdentifySpecies('Al', 'aluminium').verdict).toBe('correct')
  })

  it('a wrong element gets a sentence with both electron counts', () => {
    expect(gradeIdentifySpecies('Fe', 'Co')).toEqual({
      verdict: 'wrong',
      message: 'Cobalt (Co) has 27 electrons as a neutral atom. The configuration shows 26 electrons (add the superscripts), and a neutral atom has as many protons as electrons.',
    })
  })

  it('counting only what follows the brackets', () => {
    expect(gradeIdentifySpecies('Fe', 'O', { form: 'shorthand' })).toEqual({
      verdict: 'wrong',
      message: 'Oxygen has 8 electrons: that counts only the electrons written after the brackets. [Ar] stands for 18 more, the whole configuration of argon.',
    })
    expect(gradeIdentifySpecies('Fe', 'Co', { form: 'shorthand' }).verdict).toBe('wrong')
  })

  it('a charge on a neutral atom', () => {
    const g = gradeIdentifySpecies('Fe', 'Fe2+')
    expect(g.verdict).toBe('wrong')
    expect(g.verdict === 'wrong' && g.message).toContain('Right element')
  })
})

describe('gradeIdentifySpecies: an ion (the question gives the charge)', () => {
  it('accepts the element with or without the charge', () => {
    expect(gradeIdentifySpecies('Fe2+', 'Fe')).toEqual({ verdict: 'correct', message: 'Correct: 24 electrons and a 2+ charge mean 26 protons, which is iron: Fe²⁺.' })
    expect(gradeIdentifySpecies('Fe2+', 'Fe2+').verdict).toBe('correct')
    expect(gradeIdentifySpecies('Fe2+', 'Fe 2+').verdict).toBe('correct')
    expect(gradeIdentifySpecies('Cl-', 'chlorine').verdict).toBe('correct')
    expect(gradeIdentifySpecies('Cl-', 'Cl⁻').verdict).toBe('correct')
  })

  it('ion_charge_ignored: the element with as many protons as the ion has electrons', () => {
    expect(gradeIdentifySpecies('Fe2+', 'Cr')).toEqual({
      verdict: 'mistake',
      mistake: 'ion_charge_ignored',
      witness:
        'Cr (chromium) has 24 electrons as a NEUTRAL atom, which matches the configuration. But this is an ion with a 2+ charge: it has lost 2 electrons, so the atom it came from has 24 + 2 = 26 electrons, and 26 protons.',
    })
    const g = gradeIdentifySpecies('Cl-', 'Ar')
    expect(g.verdict === 'mistake' && g.mistake).toBe('ion_charge_ignored')
    expect(g.verdict === 'mistake' && g.witness).toContain('it has gained 1 electron, so the atom it came from has 18 − 1 = 17 electrons')
  })

  it('ion_wrong_direction: the charge applied the wrong way', () => {
    expect(gradeIdentifySpecies('Fe2+', 'Ti')).toEqual({
      verdict: 'mistake',
      mistake: 'ion_wrong_direction',
      witness:
        'Ti (titanium) has 22 protons, which is 24 − 2: the charge went the wrong way. A 2+ ion has LOST 2 electrons, so the neutral atom has MORE electrons than the ion: 24 + 2.',
    })
    const g = gradeIdentifySpecies('Cl-', 'K')
    expect(g.verdict === 'mistake' && g.mistake).toBe('ion_wrong_direction')
  })

  it('the right element with the wrong charge is a plain message', () => {
    expect(gradeIdentifySpecies('Fe2+', 'Fe3+')).toEqual({ verdict: 'wrong', message: 'Right element. Check the charge: it is protons − electrons, 26 − 24.' })
    const flipped = gradeIdentifySpecies('Fe2+', 'Fe2-')
    expect(flipped.verdict === 'wrong' && flipped.message).toContain('fewer electrons than protons makes it positive')
    const missing = gradeIdentifySpecies('Fe2+', 'Fe', { requireCharge: true })
    expect(missing.verdict === 'wrong' && missing.message).toContain('Write its charge too')
  })

  it('reads well for one proton', () => {
    expect(gradeIdentifySpecies('H-', 'H')).toEqual({ verdict: 'correct', message: 'Correct: 2 electrons and a 1− charge mean 1 proton, which is hydrogen: H⁻.' })
    const he = gradeIdentifySpecies('H-', 'He')
    expect(he.verdict === 'mistake' && he.witness).toContain('so the atom it came from has 2 − 1 = 1 electron, and 1 proton.')
  })

  it('any other element is a plain message', () => {
    const g = gradeIdentifySpecies('Fe2+', 'Mn')
    expect(g).toEqual({
      verdict: 'wrong',
      message: 'Manganese (Mn) has 25 protons. The configuration shows 24 electrons (add the superscripts), and the 2+ charge means the ion has 2 fewer electrons than protons.',
    })
  })
})

describe('gradeIdentifySpecies: input and scope', () => {
  it('unreadable answers are invalid with a position', () => {
    expect(gradeIdentifySpecies('Fe', '')).toEqual({ verdict: 'invalid', message: 'Type the element’s symbol or name, like Fe or iron.', position: 0 })
    expect(gradeIdentifySpecies('Fe', 'Zz')).toEqual({ verdict: 'invalid', message: 'No element has the symbol “Zz”.', position: 0, length: 2 })
  })

  it('a species outside the model is unsupported', () => {
    expect(gradeIdentifySpecies('Rb', 'Rb').verdict).toBe('unsupported')
  })
})

describe('identifyMistakes', () => {
  it('lists the element each slip names', () => {
    expect(identifyMistakes('Fe2+')!.map((c) => [c.kind, c.text])).toEqual([
      ['ion_charge_ignored', 'Cr'],
      ['ion_wrong_direction', 'Ti'],
    ])
    expect(identifyMistakes('Cl-')!.map((c) => [c.kind, c.text])).toEqual([
      ['ion_charge_ignored', 'Ar'],
      ['ion_wrong_direction', 'K'],
    ])
    expect(identifyMistakes('Fe')).toEqual([])
    expect(identifyMistakes('Rb')).toBeNull()
  })

  it('every candidate of every ion grades as its own kind and is not the right element', () => {
    for (const sp of econfigIons())
      for (const c of identifyMistakes(sp)!) {
        const g = gradeIdentifySpecies(sp, c.text)
        expect(g.verdict === 'mistake' && g.mistake, `${speciesText(sp)} ${c.text}`).toBe(c.kind)
        expect(c.text).not.toBe(speciesText({ z: sp.z, charge: 0 }))
      }
  })
})

describe('speciesOfConfiguration', () => {
  it('reads whose configuration a text is', () => {
    expect(speciesOfConfiguration('[Ar] 3d5', 3)).toEqual({ electrons: 23, z: 26, charge: 3, symbol: 'Fe', groundState: true })
    expect(speciesOfConfiguration('1s2 2s2 2p6')).toEqual({ electrons: 10, z: 10, charge: 0, symbol: 'Ne', groundState: true })
    expect(speciesOfConfiguration('1s2 2s2 2p6', 1)).toMatchObject({ z: 11, symbol: 'Na', groundState: true })
    expect(speciesOfConfiguration('[Ar] 4s1 3d5')).toMatchObject({ z: 24, symbol: 'Cr', groundState: true })
    expect(speciesOfConfiguration('[Ar] 4s2 3d4')).toMatchObject({ z: 24, symbol: 'Cr', groundState: false })
    expect(speciesOfConfiguration('1s2 2p1')).toMatchObject({ z: 3, symbol: 'Li', groundState: false })
  })

  it('is null for text that is not a possible configuration', () => {
    expect(speciesOfConfiguration('2d1')).toBeNull()
    expect(speciesOfConfiguration('1s3')).toBeNull()
    expect(speciesOfConfiguration('[Ca] 3d2')).toBeNull()
    expect(speciesOfConfiguration('[Ar] 3p6 4s1')).toBeNull()
    expect(speciesOfConfiguration('nonsense')).toBeNull()
  })

  it('every species of the model reads back from its own text, in both forms', () => {
    for (const sp of [...econfigAtoms(), ...econfigIons()])
      for (const form of ['full', 'shorthand'] as const)
        expect(speciesOfConfiguration(configurationText(sp, { form }), sp.charge), `${speciesText(sp)} ${form}`).toMatchObject({ z: sp.z, charge: sp.charge, groundState: true })
  })
})
