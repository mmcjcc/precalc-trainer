import { describe, expect, it } from 'vitest'
import { econfigAtoms, econfigIons, FILLING_ORDER, speciesText, subshellName } from './model'
import {
  diagramProblem,
  gradeOrbitalDiagram,
  gradeUnpairedElectrons,
  hundDiagram,
  lastSubshell,
  orbitalDiagram,
  orbitalDiagramDisplay,
  orbitalDiagramLatex,
  orbitalDiagramMistakes,
  orbitalDiagramText,
  parseOrbitalDiagram,
  unpairedElectrons,
  unpairedInDiagram,
  unpairedMistakes,
} from './orbital'
import type { EconfigGrade, OrbitalBox } from './types'

const kind = (g: EconfigGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)
const said = (g: EconfigGrade) => (g.verdict === 'mistake' ? g.witness : g.message)

function boxesOf(text: string): OrbitalBox[] {
  const p = parseOrbitalDiagram(text)
  if (!p.ok) throw new Error(p.error.message)
  return p.value
}

describe('hundDiagram and the renderers', () => {
  it('fills one up arrow per box first, then the down arrows', () => {
    expect(orbitalDiagramText(hundDiagram(0, 'p'))).toBe('- - -')
    expect(orbitalDiagramText(hundDiagram(1, 'p'))).toBe('u - -')
    expect(orbitalDiagramText(hundDiagram(2, 'p'))).toBe('u u -')
    expect(orbitalDiagramText(hundDiagram(3, 'p'))).toBe('u u u')
    expect(orbitalDiagramText(hundDiagram(4, 'p'))).toBe('ud u u')
    expect(orbitalDiagramText(hundDiagram(5, 'p'))).toBe('ud ud u')
    expect(orbitalDiagramText(hundDiagram(6, 'p'))).toBe('ud ud ud')
    expect(orbitalDiagramText(hundDiagram(1, 's'))).toBe('u')
    expect(orbitalDiagramText(hundDiagram(2, 's'))).toBe('ud')
    expect(orbitalDiagramText(hundDiagram(5, 'd'))).toBe('u u u u u')
    expect(orbitalDiagramText(hundDiagram(6, 'd'))).toBe('ud u u u u')
    expect(orbitalDiagramText(hundDiagram(9, 'd'))).toBe('ud ud ud ud u')
    expect(orbitalDiagramText(hundDiagram(10, 'd'))).toBe('ud ud ud ud ud')
    expect(() => hundDiagram(7, 'p')).toThrow(RangeError)
  })

  it('counts the unpaired electrons of a subshell: n up to half full, then 2·boxes − n', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => unpairedInDiagram(hundDiagram(n, 'p')))).toEqual([0, 1, 2, 3, 2, 1, 0])
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => unpairedInDiagram(hundDiagram(n, 'd')))).toEqual([0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0])
    expect([0, 1, 2].map((n) => unpairedInDiagram(hundDiagram(n, 's')))).toEqual([0, 1, 0])
  })

  it('renders display text and LaTeX', () => {
    expect(orbitalDiagramDisplay(hundDiagram(4, 'p'))).toBe('[↑↓] [↑ ] [↑ ]')
    expect(orbitalDiagramDisplay(hundDiagram(1, 'p'))).toBe('[↑ ] [  ] [  ]')
    expect(orbitalDiagramDisplay([['up', 'up'], ['down']])).toBe('[↑↑] [↓ ]')
    expect(orbitalDiagramLatex(hundDiagram(4, 'p'))).toBe('\\boxed{\\uparrow\\downarrow}\\,\\boxed{\\uparrow\\phantom{\\downarrow}}\\,\\boxed{\\uparrow\\phantom{\\downarrow}}')
    expect(orbitalDiagramLatex([[], ['down']])).toBe('\\boxed{\\phantom{\\uparrow\\downarrow}}\\,\\boxed{\\phantom{\\uparrow}\\downarrow}')
  })
})

describe('parseOrbitalDiagram', () => {
  it('reads the compact form and round-trips it', () => {
    expect(boxesOf('ud u u')).toEqual([['up', 'down'], ['up'], ['up']])
    expect(boxesOf('UD U -')).toEqual([['up', 'down'], ['up'], []])
    expect(boxesOf('↑↓ ↑ ↑')).toEqual([['up', 'down'], ['up'], ['up']])
    expect(boxesOf('ud,u,_')).toEqual([['up', 'down'], ['up'], []])
    expect(boxesOf('du | uu | 0')).toEqual([['down', 'up'], ['up', 'up'], []])
    for (let n = 0; n <= 10; n++) expect(boxesOf(orbitalDiagramText(hundDiagram(n, 'd')))).toEqual(hundDiagram(n, 'd'))
  })

  it('reads bracketed boxes, including the display text', () => {
    expect(boxesOf('[ud] [u] []')).toEqual([['up', 'down'], ['up'], []])
    expect(boxesOf('[↑↓][↑][ ]')).toEqual([['up', 'down'], ['up'], []])
    for (let n = 0; n <= 6; n++) expect(boxesOf(orbitalDiagramDisplay(hundDiagram(n, 'p')))).toEqual(hundDiagram(n, 'p'))
  })

  it('errors carry a position', () => {
    const err = (text: string) => {
      const p = parseOrbitalDiagram(text)
      if (p.ok) throw new Error('expected an error')
      return p.error
    }
    expect(err('')).toMatchObject({ position: 0 })
    expect(err('ud x u')).toMatchObject({ position: 3, length: 1 })
    expect(err('ud u2')).toMatchObject({ position: 4, length: 1 })
    expect(err('[ud] u')).toMatchObject({ position: 5, length: 1 })
    expect(err('[ud')).toMatchObject({ position: 0, length: 1 })
    expect(err('[ux]')).toMatchObject({ position: 2, length: 1 })
  })
})

describe('orbitalDiagram: the right diagram of a species', () => {
  it('defaults to the last subshell in filling order', () => {
    expect(orbitalDiagram('Fe')).toEqual({
      subshell: { n: 3, l: 'd' },
      name: '3d',
      electrons: 6,
      orbitals: 5,
      boxes: [['up', 'down'], ['up'], ['up'], ['up'], ['up']],
      unpaired: 4,
      text: 'ud u u u u',
    })
    expect(lastSubshell('O')).toEqual({ n: 2, l: 'p' })
    expect(lastSubshell('K')).toEqual({ n: 4, l: 's' })
    expect(lastSubshell('Cr')).toEqual({ n: 3, l: 'd' })
    expect(lastSubshell('Fe3+')).toEqual({ n: 3, l: 'd' })
    expect(lastSubshell('Br')).toEqual({ n: 4, l: 'p' })
    expect(orbitalDiagram('N')).toMatchObject({ name: '2p', electrons: 3, text: 'u u u', unpaired: 3 })
    expect(orbitalDiagram('Fe3+')).toMatchObject({ name: '3d', electrons: 5, text: 'u u u u u', unpaired: 5 })
  })

  it('takes a named subshell, occupied or not', () => {
    expect(orbitalDiagram('O', '2p')).toMatchObject({ electrons: 4, text: 'ud u u', unpaired: 2 })
    expect(orbitalDiagram('Cr', '4s')).toMatchObject({ electrons: 1, orbitals: 1, text: 'u', unpaired: 1 })
    expect(orbitalDiagram('Cr', { n: 3, l: 'd' })).toMatchObject({ electrons: 5, text: 'u u u u u' })
    expect(orbitalDiagram('Cu', '3d')).toMatchObject({ electrons: 10, unpaired: 0 })
    expect(orbitalDiagram('Fe2+', '4s')).toMatchObject({ electrons: 0, text: '-', unpaired: 0 })
    expect(orbitalDiagram('O', '3D')).toMatchObject({ name: '3d', electrons: 0, text: '- - - - -' })
  })

  it('refuses a subshell outside 1s to 4p and a species outside the model', () => {
    expect(diagramProblem('O', '5s')).toBe('5s is outside the model: the subshells are 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p.')
    expect(diagramProblem('O', '2d')).toMatch(/outside the model/)
    expect(diagramProblem('Rb')).toMatch(/outside the model/)
    expect(() => orbitalDiagram('O', '5s')).toThrow(RangeError)
    expect(() => orbitalDiagram('Rb')).toThrow(RangeError)
  })
})

describe('gradeOrbitalDiagram: a p subshell', () => {
  it('correct, from boxes or from text', () => {
    expect(gradeOrbitalDiagram('O', [['up', 'down'], ['up'], ['up']])).toEqual({ verdict: 'correct', message: 'Correct: 2p of O is [↑↓] [↑ ] [↑ ], with 2 unpaired electrons.' })
    expect(gradeOrbitalDiagram('O', 'ud u u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('O', 'du u u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('N', 'u u u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('Ne', 'ud ud ud')).toEqual({ verdict: 'correct', message: 'Correct: 2p of Ne is [↑↓] [↑↓] [↑↓], with no unpaired electrons.' })
  })

  it('which boxes hold the single electrons is not graded, nor up versus down for all of them', () => {
    expect(gradeOrbitalDiagram('C', 'u - u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('O', 'u ud u').verdict).toBe('correct')
    expect(said(gradeOrbitalDiagram('N', 'd d d'))).toBe('Correct: 2p of N is [↓ ] [↓ ] [↓ ], with 3 unpaired electrons. By convention the single arrows are drawn pointing up.')
  })

  it("hund_broken: a pair while a box is empty", () => {
    expect(gradeOrbitalDiagram('O', 'ud ud -')).toEqual({
      verdict: 'mistake',
      mistake: 'hund_broken',
      witness: "Box 1 holds a pair while box 3 is still empty. Hund's rule: the orbitals of a subshell have the same energy, so each one gets ONE electron before any of them gets a second.",
    })
    expect(said(gradeOrbitalDiagram('C', '- ud -'))).toContain('Box 2 holds a pair while 2 boxes are still empty')
    expect(kind(gradeOrbitalDiagram('N', 'ud u -'))).toBe('hund_broken')
  })

  it('hund_broken: single electrons with different spins', () => {
    expect(gradeOrbitalDiagram('N', 'u d u')).toEqual({
      verdict: 'mistake',
      mistake: 'hund_broken',
      witness: "Your single electrons point in different directions (2 up, 1 down). Hund's rule: the unpaired electrons of a subshell all have the same spin, so the single arrows all point the same way.",
    })
    expect(kind(gradeOrbitalDiagram('O', 'ud u d'))).toBe('hund_broken')
    expect(kind(gradeOrbitalDiagram('C', 'u d -'))).toBe('hund_broken')
  })

  it('pauli_broken: two arrows the same way, or more than two', () => {
    expect(gradeOrbitalDiagram('O', 'uu u u')).toEqual({
      verdict: 'mistake',
      mistake: 'pauli_broken',
      witness: 'Box 1 holds two arrows pointing up. Two electrons in the same orbital must have opposite spins, one up and one down (the Pauli exclusion principle).',
    })
    expect(said(gradeOrbitalDiagram('O', 'u dd u'))).toContain('Box 2 holds two arrows pointing down')
    expect(gradeOrbitalDiagram('O', 'udu u -')).toEqual({
      verdict: 'mistake',
      mistake: 'pauli_broken',
      witness: 'Box 1 holds 3 arrows. An orbital holds at most 2 electrons, and those two must have opposite spins (the Pauli exclusion principle).',
    })
    expect(kind(gradeOrbitalDiagram('C', 'uu - -'))).toBe('pauli_broken')
  })

  it('plain wrong: the number of arrows, the number of boxes', () => {
    expect(gradeOrbitalDiagram('O', 'ud u -')).toEqual({
      verdict: 'wrong',
      message: 'Your diagram has 3 arrows, but the 2p subshell of O holds 4 electrons. Draw one arrow for each electron.',
    })
    expect(gradeOrbitalDiagram('O', 'ud ud')).toEqual({ verdict: 'wrong', message: 'A p subshell has 3 orbitals, so its diagram has 3 boxes. Yours has 2.' })
  })
})

describe('gradeOrbitalDiagram: a d subshell', () => {
  it('correct diagrams', () => {
    expect(gradeOrbitalDiagram('Fe', 'ud u u u u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('Cr', 'u u u u u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('Cu', 'ud ud ud ud ud').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('Fe3+', 'u u u u u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('Fe2+', 'ud u u u u').verdict).toBe('correct')
    expect(gradeOrbitalDiagram('Ni', 'ud ud ud u u', { subshell: '3d' }).verdict).toBe('correct')
    expect(gradeOrbitalDiagram('Sc', '- - u - -').verdict).toBe('correct')
  })

  it('Hund and Pauli mistakes', () => {
    expect(said(gradeOrbitalDiagram('Fe', 'ud ud ud - -'))).toContain('Box 1 holds a pair while 2 boxes are still empty')
    expect(kind(gradeOrbitalDiagram('Fe3+', 'ud ud u - -'))).toBe('hund_broken')
    expect(kind(gradeOrbitalDiagram('Co', 'ud ud ud u -'))).toBe('hund_broken')
    expect(kind(gradeOrbitalDiagram('Mn', 'u u d u u'))).toBe('hund_broken')
    expect(kind(gradeOrbitalDiagram('Fe', 'uu u u u u'))).toBe('pauli_broken')
    expect(kind(gradeOrbitalDiagram('Ti', 'uu - - - -'))).toBe('pauli_broken')
  })

  it('the diagram of the ion, not of the atom', () => {
    expect(gradeOrbitalDiagram('Fe3+', 'ud u u u u')).toEqual({
      verdict: 'wrong',
      message: 'Your diagram has 6 arrows, but the 3d subshell of Fe³⁺ holds 5 electrons. Draw one arrow for each electron.',
    })
    expect(gradeOrbitalDiagram('Fe2+', '-', { subshell: '4s' })).toEqual({ verdict: 'correct', message: 'Correct: 4s of Fe²⁺ is [  ], with no unpaired electrons.' })
    expect(gradeOrbitalDiagram('Fe2+', 'ud', { subshell: '4s' }).verdict).toBe('wrong')
  })
})

describe('gradeOrbitalDiagram: an s subshell, input and scope', () => {
  it('one box', () => {
    expect(gradeOrbitalDiagram('K', 'u').verdict).toBe('correct')
    expect(said(gradeOrbitalDiagram('K', 'd'))).toContain('By convention the single arrows are drawn pointing up.')
    expect(gradeOrbitalDiagram('Ca', 'ud').verdict).toBe('correct')
    expect(kind(gradeOrbitalDiagram('Ca', 'uu'))).toBe('pauli_broken')
    expect(gradeOrbitalDiagram('K', 'ud').verdict).toBe('wrong')
    expect(gradeOrbitalDiagram('Cr', 'u', { subshell: '4s' }).verdict).toBe('correct')
    expect(gradeOrbitalDiagram('K', 'u - -')).toEqual({ verdict: 'wrong', message: 'An s subshell has 1 orbital, so its diagram has 1 box. Yours has 3.' })
  })

  it('unreadable diagrams are invalid; problems outside the model are unsupported', () => {
    expect(gradeOrbitalDiagram('O', 'ud x u')).toMatchObject({ verdict: 'invalid', position: 3, length: 1 })
    expect(gradeOrbitalDiagram('O', '').verdict).toBe('invalid')
    expect(gradeOrbitalDiagram('O', [['sideways']] as unknown as OrbitalBox[]).verdict).toBe('invalid')
    expect(gradeOrbitalDiagram('O', 'ud u u', { subshell: '5s' }).verdict).toBe('unsupported')
    expect(gradeOrbitalDiagram('Rb', 'u').verdict).toBe('unsupported')
  })
})

describe('orbitalDiagramMistakes', () => {
  const pairs = (species: string, subshell?: string) => orbitalDiagramMistakes(species, subshell)!.map((c) => [c.kind, c.text])

  it('draws the pair-first diagram and a same-spin pair', () => {
    expect(pairs('O')).toEqual([
      ['hund_broken', 'ud ud -'],
      ['pauli_broken', 'uu u u'],
    ])
    expect(pairs('N')).toEqual([
      ['hund_broken', 'ud u -'],
      ['pauli_broken', 'uu u -'],
    ])
    expect(pairs('Fe')).toEqual([
      ['hund_broken', 'ud ud ud - -'],
      ['pauli_broken', 'uu u u u u'],
    ])
    expect(pairs('Ca')).toEqual([['pauli_broken', 'uu']])
  })

  it('lists nothing where the slip cannot show', () => {
    expect(pairs('B')).toEqual([])
    expect(pairs('K')).toEqual([])
    expect(pairs('F')).toEqual([['pauli_broken', 'uu uu u']])
    expect(orbitalDiagramMistakes('O', '5s')).toBeNull()
  })

  it('every candidate of every subshell of every species grades as its own kind', () => {
    for (const sp of [...econfigAtoms(), ...econfigIons()])
      for (const s of FILLING_ORDER) {
        const name = subshellName(s)
        const right = orbitalDiagram(sp, name)
        expect(gradeOrbitalDiagram(sp, right.boxes, { subshell: name }).verdict, `${speciesText(sp)} ${name}`).toBe('correct')
        expect(gradeOrbitalDiagram(sp, right.text, { subshell: name }).verdict).toBe('correct')
        for (const c of orbitalDiagramMistakes(sp, name)!) {
          expect(c.text, `${speciesText(sp)} ${name}`).not.toBe(right.text)
          const g = gradeOrbitalDiagram(sp, c.boxes, { subshell: name })
          expect(kind(g), `${speciesText(sp)} ${name} ${c.text}`).toBe(c.kind)
          expect(said(g)).toBe(c.witness)
        }
      }
  })
})

/** Typed by hand: unpaired electrons of each neutral atom, H to Kr. */
const UNPAIRED_ATOMS: readonly [string, number][] = [
  ['H', 1], ['He', 0], ['Li', 1], ['Be', 0], ['B', 1], ['C', 2], ['N', 3], ['O', 2], ['F', 1], ['Ne', 0],
  ['Na', 1], ['Mg', 0], ['Al', 1], ['Si', 2], ['P', 3], ['S', 2], ['Cl', 1], ['Ar', 0],
  ['K', 1], ['Ca', 0], ['Sc', 1], ['Ti', 2], ['V', 3], ['Cr', 6], ['Mn', 5], ['Fe', 4], ['Co', 3], ['Ni', 2], ['Cu', 1], ['Zn', 0],
  ['Ga', 1], ['Ge', 2], ['As', 3], ['Se', 2], ['Br', 1], ['Kr', 0],
]

/** Typed by hand: the transition-metal ions (every main-group ion has 0). */
const UNPAIRED_IONS: readonly [string, number][] = [
  ['Cr3+', 3], ['Cr2+', 4], ['Mn2+', 5], ['Mn3+', 4], ['Fe3+', 5], ['Fe2+', 4], ['Co2+', 3], ['Co3+', 4], ['Ni2+', 2], ['Cu2+', 1], ['Cu+', 0], ['Zn2+', 0],
]

describe('unpairedElectrons', () => {
  it.each(UNPAIRED_ATOMS)('%s has %i', (symbol, n) => {
    expect(unpairedElectrons(symbol)).toBe(n)
    expect(gradeUnpairedElectrons(symbol, String(n)).verdict).toBe('correct')
  })

  it.each(UNPAIRED_IONS)('%s has %i', (ion, n) => {
    expect(unpairedElectrons(ion)).toBe(n)
    expect(gradeUnpairedElectrons(ion, String(n)).verdict).toBe('correct')
  })

  it('every main-group ion has none', () => {
    expect(UNPAIRED_ATOMS).toHaveLength(36)
    const listed = new Set(UNPAIRED_IONS.map(([ion]) => ion))
    for (const sp of econfigIons()) if (!listed.has(speciesText(sp))) expect(unpairedElectrons(sp), speciesText(sp)).toBe(0)
    expect(() => unpairedElectrons('Rb')).toThrow(RangeError)
  })
})

describe('gradeUnpairedElectrons', () => {
  it('correct, with where they are', () => {
    expect(gradeUnpairedElectrons('N', '3')).toEqual({ verdict: 'correct', message: 'Correct: N has 3 unpaired electrons (2p [↑ ] [↑ ] [↑ ]).' })
    expect(gradeUnpairedElectrons('Cr', '6')).toEqual({ verdict: 'correct', message: 'Correct: Cr has 6 unpaired electrons (4s [↑ ], 3d [↑ ] [↑ ] [↑ ] [↑ ] [↑ ]).' })
    expect(gradeUnpairedElectrons('Ne', '0')).toEqual({ verdict: 'correct', message: 'Correct: every occupied subshell of Ne is full, so every electron is paired.' })
    expect(gradeUnpairedElectrons('H', '1').verdict).toBe('correct')
  })

  it('unpaired_from_wrong_diagram: counted from a pair-first diagram', () => {
    expect(gradeUnpairedElectrons('N', '1')).toEqual({
      verdict: 'mistake',
      mistake: 'unpaired_from_wrong_diagram',
      witness:
        "1 is the count from a diagram that pairs electrons up first (2p³ drawn as [↑↓] [↑ ] [  ]). Hund's rule: every orbital of a subshell gets one electron before any orbital gets a second, so more of them stay unpaired.",
    })
    expect(kind(gradeUnpairedElectrons('O', '0'))).toBe('unpaired_from_wrong_diagram')
    expect(kind(gradeUnpairedElectrons('Fe', '0'))).toBe('unpaired_from_wrong_diagram')
    expect(kind(gradeUnpairedElectrons('Fe3+', '1'))).toBe('unpaired_from_wrong_diagram')
  })

  it('unpaired_from_wrong_diagram: counted correctly from HER wrong diagram', () => {
    const g = gradeUnpairedElectrons('O', '0', { diagram: 'ud ud -' })
    expect(g).toEqual({
      verdict: 'mistake',
      mistake: 'unpaired_from_wrong_diagram',
      witness:
        "0 is what your 2p diagram shows, so the counting is fine: the diagram is what needs fixing. Box 1 holds a pair while box 3 is still empty. Hund's rule: the orbitals of a subshell have the same energy, so each one gets ONE electron before any of them gets a second.",
    })
    const short = gradeUnpairedElectrons('O', '1', { diagram: [['up', 'down'], ['up'], []] })
    expect(kind(short)).toBe('unpaired_from_wrong_diagram')
    expect(said(short)).toContain('Your diagram has 3 arrows, but the 2p subshell of O holds 4 electrons')
    const d = gradeUnpairedElectrons('Fe', '2', { diagram: 'ud ud u u -', subshell: '3d' })
    expect(kind(d)).toBe('unpaired_from_wrong_diagram')
  })

  it('her diagram does not change a right count, or a count that does not come from it', () => {
    expect(gradeUnpairedElectrons('O', '2', { diagram: 'ud ud -' }).verdict).toBe('correct')
    expect(gradeUnpairedElectrons('O', '3', { diagram: 'ud ud -' }).verdict).toBe('wrong')
    expect(kind(gradeUnpairedElectrons('O', '0', { diagram: 'ud u u' }))).toBe('unpaired_from_wrong_diagram')
    expect(gradeUnpairedElectrons('O', '4', { diagram: 'ud u u' }).verdict).toBe('wrong')
  })

  it('exception_missed: chromium counted as 4s2 3d4', () => {
    expect(gradeUnpairedElectrons('Cr', '4')).toEqual({
      verdict: 'mistake',
      mistake: 'exception_missed',
      witness:
        '4 is the count for 4s² 3d⁴, the plain filling order. Cr is one of the two exceptions: one electron moves from 4s to 3d, so count the unpaired electrons in both 4s and 3d again.',
    })
    expect(gradeUnpairedElectrons('Cu', '1').verdict).toBe('correct')
  })

  it('ion_charge_ignored and ion_removed_from_3d', () => {
    expect(gradeUnpairedElectrons('Fe3+', '4')).toEqual({
      verdict: 'mistake',
      mistake: 'ion_charge_ignored',
      witness: "4 is the count for the neutral atom. Fe³⁺ has lost 3 electrons: work out the ion's configuration first, then count.",
    })
    const g = gradeUnpairedElectrons('Fe3+', '3')
    expect(kind(g)).toBe('ion_removed_from_3d')
    expect(said(g)).toContain('3 is the count if the electrons are taken out of 3d while 4s stays full')
    expect(kind(gradeUnpairedElectrons('Cl-', '1'))).toBe('ion_charge_ignored')
  })

  it('plain messages', () => {
    expect(gradeUnpairedElectrons('O', '4')).toEqual({
      verdict: 'wrong',
      message: '4 is the number of electrons in 2p. Some of them share an orbital: an unpaired electron is one that is alone in its box. Draw the boxes and count only the single arrows.',
    })
    expect(gradeUnpairedElectrons('Ne', '2')).toEqual({
      verdict: 'wrong',
      message: 'Every occupied subshell of Ne is full. In a full subshell each orbital holds a pair, so no electron is left alone.',
    })
    expect(gradeUnpairedElectrons('Cr', '5')).toEqual({ verdict: 'wrong', message: '5 counts 3d alone. 4s¹ is not full either, so its unpaired electron counts too.' })
    expect(said(gradeUnpairedElectrons('Cr', '1'))).toBe('1 counts 4s alone. 3d⁵ is not full either, so its unpaired electrons count too.')
    expect(said(gradeUnpairedElectrons('Cr', '3'))).toContain('only 4s and 3d can have any. Draw their boxes')
    expect(said(gradeUnpairedElectrons('O', '5'))).toContain('only 2p can have any. Draw its boxes')
  })

  it('invalid and unsupported', () => {
    expect(gradeUnpairedElectrons('O', '')).toEqual({ verdict: 'invalid', message: 'Type the number of unpaired electrons.', position: 0 })
    expect(gradeUnpairedElectrons('O', 'two').verdict).toBe('invalid')
    expect(gradeUnpairedElectrons('Rb', '1').verdict).toBe('unsupported')
    expect(gradeUnpairedElectrons('O', '2', { diagram: 'ud u u', subshell: '5s' }).verdict).toBe('unsupported')
  })
})

describe('unpairedMistakes', () => {
  const pairs = (species: string) => unpairedMistakes(species)!.map((c) => [c.kind, c.text])

  it('lists the count each slip gives, only where it differs', () => {
    expect(pairs('Fe3+')).toEqual([
      ['unpaired_from_wrong_diagram', '1'],
      ['ion_charge_ignored', '4'],
      ['ion_removed_from_3d', '3'],
    ])
    expect(pairs('Cr')).toEqual([
      ['unpaired_from_wrong_diagram', '2'],
      ['exception_missed', '4'],
    ])
    expect(pairs('N')).toEqual([['unpaired_from_wrong_diagram', '1']])
    expect(pairs('Fe')).toEqual([['unpaired_from_wrong_diagram', '0']])
    expect(pairs('Cu2+')).toEqual([['ion_removed_from_3d', '3']])
    expect(pairs('Ne')).toEqual([])
    expect(pairs('Cu')).toEqual([])
    expect(unpairedMistakes('Rb')).toBeNull()
  })

  it('every candidate of every species differs from the right count and grades as its own kind', () => {
    for (const sp of [...econfigAtoms(), ...econfigIons()])
      for (const c of unpairedMistakes(sp)!) {
        expect(c.value, speciesText(sp)).not.toBe(unpairedElectrons(sp))
        const g = gradeUnpairedElectrons(sp, c.text)
        expect(kind(g), `${speciesText(sp)} ${c.text}`).toBe(c.kind)
        expect(said(g)).toBe(c.witness)
      }
  })
})
