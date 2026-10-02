import { describe, expect, it } from 'vitest'
import { econfigAtoms, econfigIons, speciesText } from './model'
import { explainValence, gradeValenceElectrons, valenceElectrons, valenceMistakes, valenceProblem } from './valence'

/** Typed by hand from the group number: group 1 → 1, group 2 → 2, groups 13 to 18 → 3 to 8, helium → 2. */
const VALENCE: readonly [string, number][] = [
  ['H', 1],
  ['He', 2],
  ['Li', 1],
  ['Be', 2],
  ['B', 3],
  ['C', 4],
  ['N', 5],
  ['O', 6],
  ['F', 7],
  ['Ne', 8],
  ['Na', 1],
  ['Mg', 2],
  ['Al', 3],
  ['Si', 4],
  ['P', 5],
  ['S', 6],
  ['Cl', 7],
  ['Ar', 8],
  ['K', 1],
  ['Ca', 2],
  ['Ga', 3],
  ['Ge', 4],
  ['As', 5],
  ['Se', 6],
  ['Br', 7],
  ['Kr', 8],
]

const TRANSITION = ['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn']

describe('valenceElectrons', () => {
  it.each(VALENCE)('%s has %i', (symbol, n) => {
    expect(valenceElectrons(symbol)).toBe(n)
    expect(gradeValenceElectrons(symbol, String(n)).verdict).toBe('correct')
  })

  it('covers every element: 26 main-group atoms and 10 transition metals', () => {
    expect(VALENCE.length + TRANSITION.length).toBe(36)
    const main = econfigAtoms().filter((sp) => valenceElectrons(sp) !== null).map(speciesText)
    expect(main).toEqual(VALENCE.map(([s]) => s))
  })

  it('transition metals, ions and species outside the model are out of scope', () => {
    for (const s of TRANSITION) expect(valenceElectrons(s), s).toBeNull()
    for (const sp of econfigIons()) expect(valenceElectrons(sp), speciesText(sp)).toBeNull()
    expect(valenceElectrons('Rb')).toBeNull()
    expect(valenceProblem('Cl')).toBeNull()
    expect(valenceProblem('Fe')).toBe(
      'Iron is a transition metal, and transition metals are out of scope for this question: their 4s and 3d electrons can both take part in bonding, so valence electrons are only asked for main-group elements (groups 1, 2 and 13 to 18).',
    )
    expect(valenceProblem('Cl-')).toBe('Valence electrons are asked about neutral atoms only, and Cl⁻ is an ion.')
  })
})

describe('gradeValenceElectrons', () => {
  it('correct', () => {
    expect(gradeValenceElectrons('Cl', '7')).toEqual({ verdict: 'correct', message: "Correct: chlorine's outermost shell is n = 3 (3s² 3p⁵), which holds 7 valence electrons." })
    expect(gradeValenceElectrons('Ga', ' 3 ').verdict).toBe('correct')
    expect(gradeValenceElectrons('Na', '1')).toEqual({ verdict: 'correct', message: "Correct: sodium's outermost shell is n = 3 (3s¹), which holds 1 valence electron." })
  })

  it('valence_total_electrons: every electron of the atom', () => {
    expect(gradeValenceElectrons('Cl', '17')).toEqual({
      verdict: 'mistake',
      mistake: 'valence_total_electrons',
      witness:
        "17 is ALL of chlorine's electrons (its atomic number). Valence electrons are only the ones in the outermost shell, n = 3: the 10 electrons in the inner shells do not count.",
    })
    const li = gradeValenceElectrons('Li', '3')
    expect(li.verdict === 'mistake' && li.witness).toContain('the 2 electrons in the inner shell do not count')
    expect(gradeValenceElectrons('Ga', '31').verdict).toBe('mistake')
  })

  it('valence_last_subshell: the last subshell only', () => {
    expect(gradeValenceElectrons('Cl', '5')).toEqual({
      verdict: 'mistake',
      mistake: 'valence_last_subshell',
      witness: '5 is the number of electrons in 3p alone. The outermost shell is the whole of n = 3, so the 2 electrons in 3s count too.',
    })
    const o = gradeValenceElectrons('O', '4')
    expect(o.verdict === 'mistake' && o.mistake).toBe('valence_last_subshell')
    const ga = gradeValenceElectrons('Ga', '1')
    expect(ga.verdict === 'mistake' && ga.mistake).toBe('valence_last_subshell')
    expect(ga.verdict === 'mistake' && ga.witness).toContain('the 2 electrons in 4s count too')
  })

  it('the named mistakes never fire where they give the right number', () => {
    expect(gradeValenceElectrons('H', '1').verdict).toBe('correct')
    expect(gradeValenceElectrons('He', '2').verdict).toBe('correct')
    expect(gradeValenceElectrons('Na', '1').verdict).toBe('correct')
    expect(gradeValenceElectrons('Mg', '2').verdict).toBe('correct')
  })

  it('plain messages: the 3d electrons counted, the group number, anything else', () => {
    expect(gradeValenceElectrons('Ga', '13')).toEqual({
      verdict: 'wrong',
      message: '13 counts the ten 3d electrons. 3d is in shell 3, an inner shell here: valence electrons are only the ones in the outermost shell, n = 4.',
    })
    expect(gradeValenceElectrons('Br', '17').verdict).toBe('wrong')
    const b = gradeValenceElectrons('B', '13')
    expect(b.verdict === 'wrong' && b.message).toContain("13 is boron's group number")
    const other = gradeValenceElectrons('Cl', '2')
    expect(other).toEqual({
      verdict: 'wrong',
      message: 'Valence electrons are the electrons in the outermost occupied shell. For chlorine that is shell n = 3: count every electron in it, in all of its subshells. Your answer was 2.',
    })
  })

  it('a transition metal is unsupported, and says so plainly', () => {
    const g = gradeValenceElectrons('Fe', '2')
    expect(g.verdict).toBe('unsupported')
    expect(g.verdict === 'unsupported' && g.message).toContain('transition metals are out of scope for this question')
    expect(gradeValenceElectrons('Cl-', '8').verdict).toBe('unsupported')
    expect(gradeValenceElectrons('Rb', '1').verdict).toBe('unsupported')
  })

  it('unreadable answers are invalid', () => {
    expect(gradeValenceElectrons('Cl', '')).toEqual({ verdict: 'invalid', message: 'Type the number of valence electrons.', position: 0 })
    expect(gradeValenceElectrons('Cl', ' seven')).toEqual({ verdict: 'invalid', message: 'Type a whole number, like 5.', position: 1, length: 1 })
    expect(gradeValenceElectrons('Cl', '-7').verdict).toBe('invalid')
    expect(gradeValenceElectrons('Cl', '7.0').verdict).toBe('invalid')
  })
})

describe('valenceMistakes', () => {
  it('lists what each slip gives, only where it differs from the right answer', () => {
    expect(valenceMistakes('Cl')!.map((c) => [c.kind, c.text])).toEqual([
      ['valence_total_electrons', '17'],
      ['valence_last_subshell', '5'],
    ])
    expect(valenceMistakes('Na')!.map((c) => [c.kind, c.text])).toEqual([['valence_total_electrons', '11']])
    expect(valenceMistakes('Ga')!.map((c) => [c.kind, c.text])).toEqual([
      ['valence_total_electrons', '31'],
      ['valence_last_subshell', '1'],
    ])
    expect(valenceMistakes('H')).toEqual([])
    expect(valenceMistakes('He')).toEqual([])
    expect(valenceMistakes('Fe')).toBeNull()
  })

  it('every candidate of every main-group atom differs from the right answer and grades as its own kind', () => {
    for (const [symbol, n] of VALENCE)
      for (const c of valenceMistakes(symbol)!) {
        expect(c.value, symbol).not.toBe(n)
        const g = gradeValenceElectrons(symbol, c.text)
        expect(g.verdict === 'mistake' && g.mistake, `${symbol} ${c.text}`).toBe(c.kind)
        expect(g.verdict === 'mistake' && g.witness).toBe(c.witness)
      }
  })
})

describe('explainValence', () => {
  it('walks from the configuration to the count', () => {
    expect(explainValence('Ga')).toEqual([
      "Gallium's configuration is 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d¹⁰ 4p¹.",
      'Valence electrons are the electrons in the outermost occupied shell, the highest shell number. Here that is n = 4: 4s² 4p¹.',
      'The ten 3d electrons are in shell 3, an inner shell, so they are not valence electrons.',
      '2 + 1 = 3: gallium has 3 valence electrons.',
    ])
    expect(explainValence('K')).toEqual([
      "Potassium's configuration is 1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹.",
      'Valence electrons are the electrons in the outermost occupied shell, the highest shell number. Here that is n = 4: 4s¹.',
      'Potassium has 1 valence electron.',
    ])
    expect(() => explainValence('Fe')).toThrow(RangeError)
  })
})
