import { describe, expect, it } from 'vitest'
import {
  classifyMistakes,
  formulaFromNameMistakes,
  gradeClassify,
  gradeFormulaFromName,
  gradeIonFormula,
  gradeIonicFormula,
  gradeIonName,
  ionFormulaMistakes,
  ionicFormulaMistakes,
  ionNameMistakes,
} from './grade'
import type { NmGrade } from './types'

const verdict = (g: NmGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)
const formula = (n: string, her: string) => verdict(gradeFormulaFromName(n, her))

describe('gradeFormulaFromName: right answers', () => {
  it.each([
    ['iron(III) sulfate', 'Fe2(SO4)3'],
    ['iron(III) sulfate', 'Fe₂(SO₄)₃'],
    ['iron(III) sulfate', 'Fe2 (SO4) 3'],
    ['calcium acetate', 'Ca(CH3COO)2'],
    ['calcium acetate', 'Ca(C2H3O2)2'],
    ['acetic acid', 'CH3COOH'],
    ['acetic acid', 'HC2H3O2'],
    ['hydrochloric acid', 'HCl'],
    ['hydrochloric acid', 'HCl(aq)'],
    ['sulfuric acid', 'H2SO4(aq)'],
    ['copper(II) sulfate pentahydrate', 'CuSO4·5H2O'],
    ['copper(II) sulfate pentahydrate', 'CuSO4*5H2O'],
    ['copper(II) sulfate pentahydrate', 'CuSO4.5H2O'],
    ['mercury(I) chloride', 'Hg2Cl2'],
    ['potassium peroxide', 'K2O2'],
    ['sodium chloride', 'NaCl(s)'],
    ['water', 'H2O'],
    ['tetraphosphorus decoxide', 'P4O10'],
  ])('%s: %s', (n, f) => {
    expect(formula(n, f)).toBe('correct')
  })
})

describe('gradeFormulaFromName: named mistakes', () => {
  it.each([
    ['sodium chloride', 'NaCl2', 'nm_charges_unbalanced'],
    ['calcium chloride', 'CaCl', 'nm_charges_unbalanced'],
    ['calcium chloride', 'Ca2Cl3', 'nm_charges_unbalanced'],
    ['sulfuric acid', 'HSO4', 'nm_charges_unbalanced'],
    ['hydrochloric acid', 'H2Cl', 'nm_charges_unbalanced'],
    ['magnesium oxide', 'Mg2O2', 'nm_not_lowest_ratio'],
    ['lead(IV) oxide', 'Pb2O4', 'nm_not_lowest_ratio'],
    ['sodium chloride', 'Na2Cl2', 'nm_not_lowest_ratio'],
    ['calcium nitrate', 'Ca2(NO3)4', 'nm_not_lowest_ratio'],
    ['calcium nitrate', 'CaNO32', 'nm_parentheses_missing'],
    ['calcium nitrate', 'CaNO3 2', 'nm_parentheses_missing'],
    ['calcium nitrate', 'CaN2O6', 'nm_parentheses_missing'],
    ['ammonium sulfate', 'NH42SO4', 'nm_parentheses_missing'],
    ['iron(III) sulfate', 'Fe2SO43', 'nm_parentheses_missing'],
    ['aluminum oxide', 'Al3O2', 'nm_crisscross_reversed'],
    ['calcium chloride', 'Ca2Cl', 'nm_crisscross_reversed'],
    ['iron(III) chloride', 'Fe3Cl', 'nm_numeral_as_subscript'],
    ['lead(IV) oxide', 'Pb4O', 'nm_numeral_as_subscript'],
    ['iron(III) chloride', 'FeCl2', 'nm_numeral_wrong'],
    ['copper(I) oxide', 'CuO', 'nm_numeral_wrong'],
    ['mercury(I) chloride', 'HgCl2', 'nm_numeral_wrong'],
    ['mercury(I) chloride', 'HgCl', 'nm_unit_ion_reduced'],
    ['mercury(I) nitrate', 'HgNO3', 'nm_unit_ion_reduced'],
    ['potassium peroxide', 'KO', 'nm_unit_ion_reduced'],
    ['sodium nitrate', 'NaNO2', 'nm_polyatomic_formula_wrong'],
    ['sodium sulfate', 'Na2SO3', 'nm_polyatomic_formula_wrong'],
    ['calcium carbonate', 'CaCO2', 'nm_polyatomic_formula_wrong'],
    ['sodium perchlorate', 'NaClO3', 'nm_polyatomic_formula_wrong'],
    ['calcium nitrate', 'Ca(NO4)2', 'nm_polyatomic_formula_wrong'],
    ['ammonium chloride', 'NH3Cl', 'nm_polyatomic_formula_wrong'],
    ['sulfuric acid', 'H2SO3', 'nm_polyatomic_formula_wrong'],
    ['perchloric acid', 'HClO3', 'nm_polyatomic_formula_wrong'],
    ['sodium sulfate', 'Na2S', 'nm_ide_for_polyatomic'],
    ['calcium nitrate', 'Ca3N2', 'nm_ide_for_polyatomic'],
    ['sodium hydrogen carbonate', 'Na2CO3', 'nm_hydrogen_prefix_wrong'],
    ['sodium carbonate', 'NaHCO3', 'nm_hydrogen_prefix_wrong'],
    ['sodium chloride', 'ClNa', 'nm_anion_first'],
    ['calcium nitrate', '(NO3)2Ca', 'nm_anion_first'],
    ['sulfuric acid', 'SO4H2', 'nm_anion_first'],
    ['carbon dioxide', 'O2C', 'nm_anion_first'],
    ['hydrochloric acid', 'HClO3', 'nm_hydro_on_oxyacid'],
    ['chloric acid', 'HCl', 'nm_hydro_missing'],
    ['sulfuric acid', 'H2S', 'nm_hydro_missing'],
    ['dinitrogen pentoxide', 'NO', 'nm_prefix_missing'],
    ['dinitrogen pentoxide', 'N2O', 'nm_prefix_missing'],
    ['dinitrogen pentoxide', 'NO5', 'nm_prefix_missing'],
    ['disulfur dichloride', 'SCl', 'nm_molecular_reduced'],
    ['dinitrogen tetroxide', 'NO2', 'nm_molecular_reduced'],
    ['copper(II) sulfate pentahydrate', 'CuSO4·4H2O', 'nm_hydrate_count_wrong'],
    ['copper(II) sulfate pentahydrate', 'CuSO4·2H2O', 'nm_hydrate_count_wrong'],
    ['copper(II) sulfate pentahydrate', 'CuSO4', 'nm_hydrate_count_wrong'],
    ['copper(II) sulfate pentahydrate', 'Cu2(SO4)2·5H2O', 'nm_not_lowest_ratio'],
  ])('%s written %s → %s', (n, f, id) => {
    expect(formula(n, f)).toBe(id)
  })

  it('writes the witness about her formula without printing the answer', () => {
    const w = (n: string, f: string) => {
      const g = gradeFormulaFromName(n, f)
      return g.verdict === 'mistake' ? g.witness : ''
    }
    expect(w('sodium chloride', 'NaCl2')).toBe('In your formula, one Na⁺ gives 1+ and two Cl⁻ give 2−: the total is 1−, not zero. A compound has no overall charge.')
    expect(w('magnesium oxide', 'Mg2O2')).toMatch(/divided by 2/)
    expect(w('calcium nitrate', 'CaNO32')).toMatch(/counts only its last atom, O/)
    expect(w('iron(III) chloride', 'Fe3Cl')).toMatch(/turns the \(III\) into a subscript/)
    expect(w('aluminum oxide', 'Al3O2')).toMatch(/three Al³⁺ make 9\+ and two O²⁻ make 4−/)
    expect(w('sodium nitrate', 'NaNO2')).toMatch(/^NO₂ is nitrite, not nitrate/)
    for (const [n, f, right] of [
      ['sodium chloride', 'NaCl2', 'NaCl.'],
      ['calcium nitrate', 'CaNO32', 'Ca(NO₃)₂'],
      ['iron(III) chloride', 'Fe3Cl', 'FeCl₃'],
      ['sodium nitrate', 'NaNO2', 'NaNO₃'],
    ])
      expect(w(n!, f!)).not.toContain(right)
  })
})

describe('gradeFormulaFromName: wrong, invalid, unsupported', () => {
  it('names the compound she did write, when it is one', () => {
    const g = gradeFormulaFromName('sodium chloride', 'KCl')
    expect(g).toEqual({ verdict: 'wrong', message: 'Your formula is not sodium chloride. KCl is potassium chloride. Find each ion’s formula and charge, then balance the charges.' })
    expect(formula('dinitrogen pentoxide', 'N3O2')).toBe('wrong')
  })

  it('does not count case, a name, charges, extra parentheses or a formula with a 1 as an attempt', () => {
    expect(gradeFormulaFromName('cobalt(II) chloride', 'COCl2')).toMatchObject({ verdict: 'invalid', reason: 'case', position: 1 })
    expect(gradeFormulaFromName('cobalt(II) chloride', 'CoCL2')).toMatchObject({ verdict: 'invalid', reason: 'case' })
    expect(gradeFormulaFromName('sodium chloride', 'nacl')).toMatchObject({ verdict: 'invalid', reason: 'case', position: 0 })
    expect(gradeFormulaFromName('sodium chloride', 'sodium chloride')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeFormulaFromName('sodium chloride', 'Na+Cl-')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeFormulaFromName('calcium chloride', 'Ca(Cl)2')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeFormulaFromName('sodium nitrate', 'Na(NO3)')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeFormulaFromName('sodium chloride', 'Na1Cl1')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeFormulaFromName('iron(III) chloride', 'Fe(III)Cl3')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeFormulaFromName('hydrochloric acid', 'HCl(g)')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
  })

  it('returns unsupported outside the model', () => {
    expect(gradeFormulaFromName('vanadium(V) oxide', 'V2O5').verdict).toBe('unsupported')
    expect(gradeFormulaFromName('ferric chloride', 'FeCl3').verdict).toBe('unsupported')
    expect(formulaFromNameMistakes('iron(IV) chloride')).toBeNull()
  })

  it('lists what each slip produces', () => {
    const list = (n: string) => formulaFromNameMistakes(n)!.map((c) => [c.id, c.text, c.shadows])
    expect(list('calcium nitrate')).toEqual([
      ['nm_anion_first', '(NO3)2Ca', []],
      ['nm_parentheses_missing', 'CaNO32', []],
      ['nm_ide_for_polyatomic', 'Ca3N2', []],
      ['nm_polyatomic_formula_wrong', 'Ca(NO2)2', []],
      ['nm_crisscross_reversed', 'Ca2NO3', []],
      ['nm_not_lowest_ratio', 'Ca2(NO3)4', []],
      ['nm_charges_unbalanced', 'CaNO3', []],
    ])
    expect(list('iron(III) chloride')).toEqual([
      ['nm_anion_first', 'Cl3Fe', []],
      ['nm_numeral_as_subscript', 'Fe3Cl', ['nm_crisscross_reversed']],
      ['nm_numeral_wrong', 'FeCl2', []],
      ['nm_not_lowest_ratio', 'Fe2Cl6', []],
      ['nm_charges_unbalanced', 'FeCl', []],
    ])
    expect(list('mercury(I) chloride').map((c) => c[0])).toContain('nm_unit_ion_reduced')
    expect(list('copper(I) oxide')).toContainEqual(['nm_numeral_wrong', 'CuO', ['nm_charges_unbalanced']])
  })
})

describe('gradeIonicFormula (from two ions)', () => {
  it('grades the formula of a cation and an anion', () => {
    expect(verdict(gradeIonicFormula('Fe3+', 'SO4 2-', 'Fe2(SO4)3'))).toBe('correct')
    expect(gradeIonicFormula('Fe3+', 'SO4 2-', 'Fe2(SO4)3')).toEqual({ verdict: 'correct', message: 'Correct: Fe³⁺ and SO₄²⁻ make Fe₂(SO₄)₃.' })
    expect(verdict(gradeIonicFormula('Al3+', 'O2-', 'Al3O2'))).toBe('nm_crisscross_reversed')
    expect(verdict(gradeIonicFormula('Fe3+', 'Cl-', 'Fe3Cl'))).toBe('nm_crisscross_reversed')
    expect(verdict(gradeIonicFormula('Pb4+', 'O2-', 'Pb2O4'))).toBe('nm_not_lowest_ratio')
    expect(verdict(gradeIonicFormula('NH4+', 'PO4 3-', 'NH43PO4'))).toBe('nm_parentheses_missing')
    expect(verdict(gradeIonicFormula('iron(III)', 'sulfate', 'Fe2(SO4)3'))).toBe('correct')
    expect(gradeIonicFormula('Fe4+', 'O2-', 'FeO2').verdict).toBe('unsupported')
    expect(gradeIonicFormula('Fe2+', 'O2 2-', 'FeO2').verdict).toBe('unsupported')
  })

  it('lists the slips, without the ones that need a name', () => {
    expect(ionicFormulaMistakes('Al3+', 'O2-')!.map((c) => [c.id, c.text])).toEqual([
      ['nm_anion_first', 'O3Al2'],
      ['nm_crisscross_reversed', 'Al3O2'],
      ['nm_not_lowest_ratio', 'Al4O6'],
      ['nm_charges_unbalanced', 'AlO'],
    ])
    expect(ionicFormulaMistakes('Fe3+', 'Xx-')).toBeNull()
  })
})

describe('single ions', () => {
  it('grades the name of an ion', () => {
    const n = (ion: string, her: string) => verdict(gradeIonName(ion, her))
    expect(n('SO4 2-', 'sulfate')).toBe('correct')
    expect(n('SO4 2-', 'Sulphate ion')).toBe('correct')
    expect(n('HCO3-', 'bicarbonate')).toBe('correct')
    expect(n('Fe3+', 'iron(III)')).toBe('correct')
    expect(n('Fe3+', 'iron (III) ion')).toBe('correct')
    expect(n('Na+', 'sodium ion')).toBe('correct')
    expect(n('Hg2 2+', 'dimercury')).toBe('correct')
    expect(n('Ni2+', 'nickel')).toBe('correct')
    expect(n('SO4 2-', 'sulfite')).toBe('nm_ate_ite_swapped')
    expect(n('SO4 2-', 'sulfide')).toBe('nm_ide_for_polyatomic')
    expect(n('ClO-', 'chlorite')).toBe('nm_per_hypo_wrong')
    expect(n('HPO4 2-', 'phosphate')).toBe('nm_hydrogen_prefix_wrong')
    expect(n('Cl-', 'chlorine')).toBe('nm_element_name_for_anion')
    expect(n('Fe3+', 'iron')).toBe('nm_numeral_missing')
    expect(n('Fe3+', 'iron(II)')).toBe('nm_numeral_wrong')
    expect(n('Hg2 2+', 'mercury(II)')).toBe('nm_numeral_wrong')
    expect(n('Na+', 'sodium(I)')).toBe('nm_numeral_on_fixed')
    expect(n('O2 2-', 'oxide')).toBe('nm_unit_ion_reduced')
    expect(n('SO4 2-', 'nitrate')).toBe('wrong')
    expect(gradeIonName('SO4 2-', 'SO4 2-')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeIonName('SO4', 'sulfate').verdict).toBe('unsupported')
    expect(ionNameMistakes('ClO3-')!.map((c) => [c.id, c.text])).toEqual([
      ['nm_ide_for_polyatomic', 'chloride'],
      ['nm_ate_ite_swapped', 'chlorite'],
      ['nm_per_hypo_wrong', 'perchlorate'],
    ])
  })

  it('grades the formula of an ion', () => {
    const f = (ion: string, her: string) => verdict(gradeIonFormula(ion, her))
    for (const t of ['SO4 2-', 'SO4^2-', 'SO42-', 'SO₄²⁻', 'SO4-2']) expect(f('sulfate', t), t).toBe('correct')
    expect(f('iron(III)', 'Fe3+')).toBe('correct')
    expect(f('ammonium', 'NH4+')).toBe('correct')
    expect(f('acetate', 'C2H3O2-')).toBe('correct')
    expect(f('mercury(I)', 'Hg2 2+')).toBe('correct')
    expect(f('nitrate', 'NO2-')).toBe('nm_polyatomic_formula_wrong')
    expect(f('sulfate', 'SO3 2-')).toBe('nm_polyatomic_formula_wrong')
    expect(f('sulfate', 'SO5 2-')).toBe('nm_polyatomic_formula_wrong')
    expect(f('sulfate', 'SO4-')).toBe('nm_ion_charge_wrong')
    expect(f('phosphate', 'PO4 2-')).toBe('nm_ion_charge_wrong')
    expect(f('iron(III)', 'Fe2+')).toBe('nm_ion_charge_wrong')
    expect(f('ammonium', 'NH4-')).toBe('nm_ion_charge_wrong')
    expect(f('sulfate', 'S2-')).toBe('nm_ide_for_polyatomic')
    expect(f('dihydrogen phosphate', 'HPO4 2-')).toBe('nm_hydrogen_prefix_wrong')
    expect(f('mercury(I)', 'Hg+')).toBe('nm_unit_ion_reduced')
    expect(f('peroxide', 'O2-')).toBe('nm_unit_ion_reduced')
    expect(f('sulfate', 'NO3-')).toBe('wrong')
    expect(gradeIonFormula('sulfate', 'SO4')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeIonFormula('sulfate', 'so4 2-')).toMatchObject({ verdict: 'invalid', reason: 'case' })
    expect(gradeIonFormula('sulfate', 'sulfate')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeIonFormula('unobtainium', 'X+').verdict).toBe('unsupported')
    expect(ionFormulaMistakes('sulfate')!.map((c) => [c.id, c.text])).toEqual([
      ['nm_ide_for_polyatomic', 'S^2-'],
      ['nm_hydrogen_prefix_wrong', 'HSO4^-'],
      ['nm_polyatomic_formula_wrong', 'SO3^2-'],
      ['nm_ion_charge_wrong', 'SO4^-'],
    ])
  })
})

describe('gradeClassify', () => {
  it('grades her pick', () => {
    const c = (f: string, pick: string) => verdict(gradeClassify(f, pick))
    expect(c('NaCl', 'ionic')).toBe('correct')
    expect(c('NaCl', 'Ionic compound')).toBe('correct')
    expect(c('CO2', 'covalent')).toBe('correct')
    expect(c('HCl(aq)', 'acid')).toBe('correct')
    expect(c('HCl', 'molecular')).toBe('correct')
    expect(c('HCl', 'acid')).toBe('correct')
    expect(c('CuSO4·5H2O', 'hydrate')).toBe('correct')
    expect(c('NH4Cl', 'molecular')).toBe('nm_class_ammonium_molecular')
    expect(c('CuSO4·5H2O', 'ionic')).toBe('nm_class_hydrate_ignored')
    expect(c('HCl(aq)', 'molecular')).toBe('nm_class_acid_ignored')
    expect(c('H2SO4', 'ionic')).toBe('nm_class_acid_ignored')
    expect(c('NaCl', 'molecular')).toBe('wrong')
    expect(c('CO2', 'ionic')).toBe('wrong')
    expect(gradeClassify('NaCl', 'salt')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeClassify('MnO2', 'ionic').verdict).toBe('unsupported')
    const g = gradeClassify('NaCl', 'molecular')
    expect(g.verdict === 'wrong' && g.message).not.toMatch(/NaCl is an ionic/)
  })

  it('lists the named class slips', () => {
    expect(classifyMistakes('NH4NO3')!.map((c) => [c.id, c.text])).toEqual([['nm_class_ammonium_molecular', 'molecular']])
    expect(classifyMistakes('H2SO4')!.map((c) => [c.id, c.text])).toEqual([['nm_class_acid_ignored', 'molecular']])
    expect(classifyMistakes('MgSO4·7H2O')!.map((c) => [c.id, c.text])).toEqual([['nm_class_hydrate_ignored', 'ionic']])
    expect(classifyMistakes('NaCl')).toEqual([])
  })
})
