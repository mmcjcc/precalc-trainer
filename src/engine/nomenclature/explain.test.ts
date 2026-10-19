import { describe, expect, it } from 'vitest'
import { explainClassify, explainFormulaFromName, explainIon, explainIonicFormula, explainNameFromFormula } from './explain'

describe('explanations', () => {
  it('names a formula step by step: ions, balance, numeral, name pieces', () => {
    expect(explainNameFromFormula('Fe2(SO4)3')).toEqual({
      steps: [
        'Fe₂(SO₄)₃ is an ionic compound: the metal ion Fe³⁺ and the polyatomic anion SO₄²⁻, sulfate.',
        'Three sulfate ions carry 3 × (2−) = 6−. Two iron ions balance that, so each is 6+ ÷ 2 = 3+: Fe³⁺.',
        'Iron forms more than one ion (Fe²⁺ and Fe³⁺), so the name gives this one’s charge as a Roman numeral: iron(III).',
        'A polyatomic ion keeps its name from the table: SO₄²⁻ is sulfate.',
        'Name the cation first, then the anion, with no prefixes: iron(III) sulfate.',
      ],
      answer: 'iron(III) sulfate',
      formulaLatex: '\\mathrm{Fe_2(SO_4)_3}',
    })
    expect(explainNameFromFormula('CaCl2').steps[1]).toBe('Calcium is Ca²⁺, as every group 2 metal is, and chloride is Cl⁻: 1 × (2+) and 2 × (1−) add up to zero.')
    expect(explainNameFromFormula('CaCl2').steps[3]).toBe('The anion takes the -ide ending: chlorine becomes chloride.')
    expect(explainNameFromFormula('Hg2Cl2').steps).toContain('Mercury(I) is the ion Hg₂²⁺: two mercury atoms that stay together. The numeral is the charge of each mercury atom, 1+.')
    expect(explainNameFromFormula('NiCl2').steps[2]).toMatch(/Plain nickel is accepted too/)
  })

  it('names molecular compounds, acids and hydrates', () => {
    expect(explainNameFromFormula('N2O5').steps).toEqual([
      'N₂O₅ is a binary molecular compound: two nonmetals, nitrogen and oxygen, sharing electrons. Its name counts the atoms with Greek prefixes.',
      'Two nitrogen atoms: di-, so dinitrogen.',
      'Five oxygen atoms: penta- and the ending -ide, so pentoxide (the final a of penta- is dropped before oxide).',
      'Name: dinitrogen pentoxide.',
    ])
    expect(explainNameFromFormula('CO').steps[1]).toBe('One carbon atom: no prefix, because the first element never takes mono-.')
    expect(explainNameFromFormula('H2O').steps.at(-1)).toBe('By the rules it is dihydrogen monoxide; it is known as water.')
    expect(explainNameFromFormula('HCl(aq)').steps.at(-1)).toBe('Chloride ends in -ide, so the acid is hydro- + the root + -ic acid: hydrochloric acid.')
    expect(explainNameFromFormula('H2SO4').steps).toContain('For sulfur the root is sulfur-, the longer form.')
    expect(explainNameFromFormula('HNO2').steps[2]).toBe('Nitrite ends in -ite, so the acid ends in -ous, with no hydro-: nitrous acid.')
    expect(explainNameFromFormula('HCl').steps[1]).toBe('Dissolved in water, written HCl(aq), it is an acid: hydrochloric acid.')
    const h = explainNameFromFormula('CuSO4·5H2O')
    expect(h.steps[0]).toBe('CuSO₄·5H₂O is a hydrate: the ionic compound CuSO₄ with 5 water molecules in its crystals.')
    expect(h.steps.at(-2)).toBe('·5H₂O: five water molecules, so pentahydrate.')
    expect([h.answer, h.formulaLatex]).toEqual(['copper(II) sulfate pentahydrate', '\\mathrm{CuSO_4\\cdot 5H_2O}'])
  })

  it('writes a formula from a name, with the criss-cross and the parentheses', () => {
    expect(explainFormulaFromName('calcium nitrate')).toEqual({
      steps: [
        'Calcium nitrate is an ionic compound: the cation calcium and the anion nitrate.',
        'Calcium is Ca²⁺, as every group 2 metal is.',
        'Nitrate is the polyatomic ion NO₃⁻ (from the table).',
        'Balance the charges with the lowest whole numbers: 1 × (2+) = 2+ and 2 × (1−) = 2−, which add up to zero.',
        'There are two nitrate ions, so NO₃ goes in parentheses with the 2 outside.',
        'Formula: Ca(NO₃)₂.',
      ],
      answer: 'Ca(NO₃)₂',
      formulaLatex: '\\mathrm{Ca(NO_3)_2}',
    })
    const lead = explainFormulaFromName('lead(IV) oxide').steps
    expect(lead[1]).toBe('The (IV) in lead(IV) is the charge of one lead ion: Pb⁴⁺.')
    expect(lead).toContain('(The criss-cross gives Pb₂O₄; divide both by 2 for the lowest ratio.)')
    expect(explainFormulaFromName('mercury(I) chloride').steps).toContain('Hg₂²⁺ stays whole: the 2 in it belongs to the ion and is never divided out.')
    expect(explainFormulaFromName('dinitrogen pentoxide').steps.at(-1)).toBe('A molecular formula is never reduced. Formula: N₂O₅.')
    expect(explainFormulaFromName('sulfuric acid').steps[0]).toMatch(/^Sulfuric acid has no hydro-: an oxyacid, from the -ate ion sulfate, SO₄²⁻/)
    expect(explainFormulaFromName('hydrochloric acid').answer).toBe('HCl(aq)')
    expect(explainFormulaFromName('sodium carbonate decahydrate').steps.at(-2)).toBe('Decahydrate: ten water molecules, written after a dot.')
  })

  it('explains the formula of two ions, a single ion and a class', () => {
    expect(explainIonicFormula('Al3+', 'O2-')).toEqual({
      steps: [
        'The cation is Al³⁺ and the anion is O²⁻.',
        'Balance the charges with the lowest whole numbers: 2 × (3+) = 6+ and 3 × (2−) = 6−, which add up to zero.',
        'Cation first, then anion: Al₂O₃.',
      ],
      answer: 'Al₂O₃',
      formulaLatex: '\\mathrm{Al_2O_3}',
    })
    expect(explainIon('SO4 2-').steps[1]).toBe('Its name comes from the polyatomic ion table: sulfate.')
    expect(explainIon('Fe3+').steps[1]).toBe('Iron forms more than one ion, so the name carries the charge as a Roman numeral: iron(III).')
    expect(explainIon('Cl-').steps).toEqual(['Cl⁻ is chlorine that has gained one electron: a 1− anion.', 'A one-atom anion takes the ending -ide: chloride.'])
    expect(explainClassify('NH4Cl')).toMatchObject({ answer: 'ionic' })
    expect(explainClassify('NH4Cl').steps.at(-1)).toBe('A metal ion or NH₄⁺ with an anion? Yes: NH₄⁺ and Cl⁻, so it is ionic.')
    expect(explainClassify('HCl(aq)').answer).toBe('an acid')
    expect(explainClassify('CuSO4·5H2O').steps).toEqual(['Water after a dot? Yes: CuSO₄·5H₂O is a hydrate.'])
  })

  it('throws RangeError outside the model (a template bug)', () => {
    expect(() => explainNameFromFormula('MnO2')).toThrow(RangeError)
    expect(() => explainFormulaFromName('ferric chloride')).toThrow(RangeError)
    expect(() => explainIonicFormula('Fe2+', 'O2 2-')).toThrow(RangeError)
    expect(() => explainIon('Xx+')).toThrow(RangeError)
  })
})
