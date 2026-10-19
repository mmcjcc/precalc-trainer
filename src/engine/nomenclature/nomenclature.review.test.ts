/**
 * Reviewer's anchor test for the nomenclature core (written by the reviewer, not the core's author): formula ↔
 * name pairs typed by hand from a standard first-year chemistry course, pushed through the public API both
 * ways, plus the classic slips and the spellings a textbook accepts.
 */
import { describe, expect, it } from 'vitest'
import { formulaOfName, gradeClassify, gradeFormulaFromName, gradeIonicFormula, gradeNameFromFormula, ionicFormula, nameOfFormula, romanNumeralOf } from '@/engine'

const named = (g: { verdict: string; mistake?: string }) => (g.verdict === 'mistake' ? g.mistake : g.verdict)

const IONIC: [string, string][] = [
  ['NaCl', 'sodium chloride'],
  ['MgBr2', 'magnesium bromide'],
  ['Al2O3', 'aluminum oxide'],
  ['K2S', 'potassium sulfide'],
  ['CaF2', 'calcium fluoride'],
  ['Li3N', 'lithium nitride'],
  ['Na3P', 'sodium phosphide'],
  ['FeCl3', 'iron(III) chloride'],
  ['FeCl2', 'iron(II) chloride'],
  ['Fe2O3', 'iron(III) oxide'],
  ['FeO', 'iron(II) oxide'],
  ['CuCl', 'copper(I) chloride'],
  ['CuO', 'copper(II) oxide'],
  ['Cu2O', 'copper(I) oxide'],
  ['PbO2', 'lead(IV) oxide'],
  ['PbCl2', 'lead(II) chloride'],
  ['SnF4', 'tin(IV) fluoride'],
  ['SnCl2', 'tin(II) chloride'],
  ['Hg2Cl2', 'mercury(I) chloride'],
  ['HgO', 'mercury(II) oxide'],
  ['CrCl3', 'chromium(III) chloride'],
  ['MnO', 'manganese(II) oxide'],
  ['CoCl2', 'cobalt(II) chloride'],
  ['AgNO3', 'silver nitrate'],
  ['ZnSO4', 'zinc sulfate'],
  ['NH4Cl', 'ammonium chloride'],
  ['(NH4)2SO4', 'ammonium sulfate'],
  ['(NH4)3PO4', 'ammonium phosphate'],
  ['Ca(NO3)2', 'calcium nitrate'],
  ['Mg(OH)2', 'magnesium hydroxide'],
  ['NaOH', 'sodium hydroxide'],
  ['KMnO4', 'potassium permanganate'],
  ['K2Cr2O7', 'potassium dichromate'],
  ['Na2CO3', 'sodium carbonate'],
  ['NaHCO3', 'sodium hydrogen carbonate'],
  ['CaCO3', 'calcium carbonate'],
  ['Al2(SO4)3', 'aluminum sulfate'],
  ['Fe2(SO4)3', 'iron(III) sulfate'],
  ['Cu(NO3)2', 'copper(II) nitrate'],
  ['NaClO', 'sodium hypochlorite'],
  ['KClO3', 'potassium chlorate'],
  ['NaClO4', 'sodium perchlorate'],
  ['NaClO2', 'sodium chlorite'],
  ['Na2SO3', 'sodium sulfite'],
  ['Ba3(PO4)2', 'barium phosphate'],
  ['KCN', 'potassium cyanide'],
  ['NaC2H3O2', 'sodium acetate'],
  ['Na2O2', 'sodium peroxide'],
  ['NaH', 'sodium hydride'],
  ['Fe(OH)3', 'iron(III) hydroxide'],
]

const MOLECULAR: [string, string][] = [
  ['CO', 'carbon monoxide'],
  ['CO2', 'carbon dioxide'],
  ['N2O', 'dinitrogen monoxide'],
  ['NO', 'nitrogen monoxide'],
  ['NO2', 'nitrogen dioxide'],
  ['N2O5', 'dinitrogen pentoxide'],
  ['SO2', 'sulfur dioxide'],
  ['SO3', 'sulfur trioxide'],
  ['PCl3', 'phosphorus trichloride'],
  ['PCl5', 'phosphorus pentachloride'],
  ['CCl4', 'carbon tetrachloride'],
  ['SF6', 'sulfur hexafluoride'],
  ['BF3', 'boron trifluoride'],
  ['SiO2', 'silicon dioxide'],
  ['ICl', 'iodine monochloride'],
  ['Cl2O7', 'dichlorine heptoxide'],
  ['P4O10', 'tetraphosphorus decoxide'],
]

const ACIDS: [string, string][] = [
  ['HCl(aq)', 'hydrochloric acid'],
  ['HBr(aq)', 'hydrobromic acid'],
  ['HF(aq)', 'hydrofluoric acid'],
  ['H2S(aq)', 'hydrosulfuric acid'],
  ['HCN(aq)', 'hydrocyanic acid'],
  ['HNO3', 'nitric acid'],
  ['HNO2', 'nitrous acid'],
  ['H2SO4', 'sulfuric acid'],
  ['H2SO3', 'sulfurous acid'],
  ['H3PO4', 'phosphoric acid'],
  ['H2CO3', 'carbonic acid'],
  ['HClO4', 'perchloric acid'],
  ['HClO3', 'chloric acid'],
  ['HClO2', 'chlorous acid'],
  ['HClO', 'hypochlorous acid'],
  ['HC2H3O2', 'acetic acid'],
]

const HYDRATES: [string, string][] = [
  ['CuSO4·5H2O', 'copper(II) sulfate pentahydrate'],
  ['MgSO4·7H2O', 'magnesium sulfate heptahydrate'],
  ['CaCl2·2H2O', 'calcium chloride dihydrate'],
  ['Na2CO3·10H2O', 'sodium carbonate decahydrate'],
]

describe('textbook pairs, both ways', () => {
  for (const [label, pairs] of [
    ['ionic', IONIC],
    ['molecular', MOLECULAR],
    ['acids', ACIDS],
    ['hydrates', HYDRATES],
  ] as const) {
    it(`${label}: the formula names correctly, and the name gives the formula back`, () => {
      for (const [formula, name] of pairs) {
        expect(named(gradeNameFromFormula(formula, name)), `${formula} → ${name}`).toBe('correct')
        expect(named(gradeFormulaFromName(name, formula)), `${name} → ${formula}`).toBe('correct')
      }
    })
  }
  it('the getters agree', () => {
    expect(nameOfFormula('Fe2O3')).toBe('iron(III) oxide')
    expect(nameOfFormula('Ca(NO3)2')).toBe('calcium nitrate')
    expect(formulaOfName('aluminum sulfate')).toBe('Al2(SO4)3')
    expect(formulaOfName('dinitrogen pentoxide')).toBe('N2O5')
    expect(ionicFormula('Al3+', 'O2-')).toBe('Al2O3')
    expect(ionicFormula('Ca2+', 'PO4 3-')).toBe('Ca3(PO4)2')
    expect(ionicFormula('NH4+', 'SO4 2-')).toBe('(NH4)2SO4')
    expect(ionicFormula('Mg2+', 'O2-')).toBe('MgO')
    expect(ionicFormula('Fe3+', 'OH-')).toBe('Fe(OH)3')
    for (const [f, r] of [['FeCl3', 'III'], ['Cu2O', 'I'], ['PbO2', 'IV'], ['Hg2Cl2', 'I'], ['SnCl2', 'II']] as const) {
      expect(romanNumeralOf(f), f).toBe(r)
    }
  })
})

describe('spellings a textbook accepts are never wrong', () => {
  it('case, spacing, British spellings, elision, bicarbonate', () => {
    expect(named(gradeNameFromFormula('FeCl3', 'Iron (III) Chloride'))).toBe('correct')
    expect(named(gradeNameFromFormula('Al2O3', 'aluminium oxide'))).toBe('correct')
    expect(named(gradeNameFromFormula('N2O4', 'dinitrogen tetroxide'))).toBe('correct')
    expect(named(gradeNameFromFormula('N2O4', 'dinitrogen tetraoxide'))).toBe('correct')
    expect(named(gradeNameFromFormula('CO', 'carbon monooxide'))).toBe('correct')
    expect(named(gradeNameFromFormula('NaHCO3', 'sodium bicarbonate'))).toBe('correct')
    expect(named(gradeNameFromFormula('N2O5', 'dinitrogen pentaoxide'))).toBe('correct')
    expect(named(gradeFormulaFromName('iron(III) sulfate', 'Fe₂(SO₄)₃'))).toBe('correct')
  })
  it('case matters in a formula: it is invalid, never silently fixed', () => {
    expect(gradeFormulaFromName('sodium chloride', 'NACL').verdict).toBe('invalid')
    expect(gradeFormulaFromName('sodium chloride', 'nacl').verdict).toBe('invalid')
    expect(gradeFormulaFromName('cobalt(II) chloride', 'COCl2').verdict).toBe('invalid')
  })
})

describe('the classic slips are named', () => {
  it('formulas', () => {
    expect(named(gradeFormulaFromName('magnesium chloride', 'MgCl'))).toBe('nm_charges_unbalanced')
    expect(named(gradeFormulaFromName('sodium chloride', 'NaCl2'))).toBe('nm_charges_unbalanced')
    expect(named(gradeFormulaFromName('magnesium oxide', 'Mg2O2'))).toBe('nm_not_lowest_ratio')
    expect(named(gradeFormulaFromName('calcium nitrate', 'CaNO32'))).toBe('nm_parentheses_missing')
    expect(named(gradeFormulaFromName('iron(III) chloride', 'Fe3Cl'))).toBe('nm_numeral_as_subscript')
    expect(named(gradeFormulaFromName('sodium nitrate', 'NaNO2'))).toBe('nm_polyatomic_formula_wrong')
    expect(named(gradeIonicFormula('Pb4+', 'O2-', 'Pb2O4'))).toBe('nm_not_lowest_ratio')
  })
  it('names', () => {
    expect(named(gradeNameFromFormula('MgCl2', 'magnesium dichloride'))).toBe('nm_prefix_on_ionic')
    expect(named(gradeNameFromFormula('N2O5', 'nitrogen oxide'))).toBe('nm_prefix_missing')
    expect(named(gradeNameFromFormula('FeCl3', 'iron chloride'))).toBe('nm_numeral_missing')
    expect(named(gradeNameFromFormula('FeCl3', 'iron(II) chloride'))).toBe('nm_numeral_wrong')
    expect(named(gradeNameFromFormula('NaCl', 'sodium(I) chloride'))).toBe('nm_numeral_on_fixed')
    expect(named(gradeNameFromFormula('Na2SO4', 'sodium sulfide'))).toBe('nm_ide_for_polyatomic')
    expect(named(gradeNameFromFormula('Na2SO4', 'sodium sulfite'))).toBe('nm_ate_ite_swapped')
    expect(named(gradeNameFromFormula('NaCl', 'sodium chlorine'))).toBe('nm_element_name_for_anion')
    expect(named(gradeNameFromFormula('CO2', 'monocarbon dioxide'))).toBe('nm_mono_on_first')
    expect(named(gradeNameFromFormula('H2SO4', 'hydrosulfuric acid'))).toBe('nm_hydro_on_oxyacid')
    expect(named(gradeNameFromFormula('HCl(aq)', 'chloric acid'))).toBe('nm_hydro_missing')
    expect(named(gradeNameFromFormula('H2SO4', 'sulfurous acid'))).toBe('nm_ic_ous_swapped')
    expect(named(gradeNameFromFormula('NaCl', 'chloride sodium'))).toBe('nm_anion_first')
  })
  it('a wrong answer is never correct, and a witness never prints the answer', () => {
    for (const [formula, wrongName] of [['FeCl3', 'iron(II) chloride'], ['Na2SO4', 'sodium sulfite'], ['N2O5', 'nitrogen oxide']] as const) {
      const g = gradeNameFromFormula(formula, wrongName)
      expect(g.verdict).not.toBe('correct')
      const right = nameOfFormula(formula)!
      if (g.verdict === 'mistake') expect(g.witness.toLowerCase(), formula).not.toContain(right.toLowerCase())
    }
  })
  it('classifying', () => {
    expect(named(gradeClassify('NaCl', 'ionic'))).toBe('correct')
    expect(named(gradeClassify('CO2', 'molecular'))).toBe('correct')
    expect(named(gradeClassify('NH4Cl', 'molecular'))).toBe('nm_class_ammonium_molecular')
    expect(named(gradeClassify('CuSO4·5H2O', 'hydrate'))).toBe('correct')
    expect(named(gradeClassify('HNO3', 'acid'))).toBe('correct')
  })
})

describe('explanations found in the content review', () => {
  it('hydride is not explained as a group 1 metal', async () => {
    const { explainIon, explainFormulaFromName } = await import('@/engine')
    const ion = explainIon('H^-').steps.join(' ')
    expect(ion).not.toMatch(/group 1 metal/)
    expect(ion).toMatch(/gained one electron/)
    expect(explainFormulaFromName('sodium hydride').steps.join(' ')).not.toMatch(/Hydride is H⁻, as every group 1 metal is/)
  })
})
