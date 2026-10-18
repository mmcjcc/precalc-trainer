/**
 * Anchors typed by hand, separately from the core and its tables: formula ⟷ name pairs a first-year text prints
 * (CK-12 Chemistry - Intermediate ch. 7, its lesson examples and review questions, plus the usual oxides,
 * acids and hydrates). Each pair is pushed through '@/engine' both ways: the name of the formula, the formula of
 * the name, and both graders saying correct. If the model drifts, these fail without help from its own tests.
 */
import { describe, expect, it } from 'vitest'
import {
  classOfFormula,
  formulaOfName,
  gradeFormulaFromName,
  gradeIonFormula,
  gradeIonicFormula,
  gradeIonName,
  gradeNameFromFormula,
  ionicFormula,
  nameOfFormula,
  romanNumeralOf,
} from '@/engine'

const PAIRS: [formula: string, name: string][] = [
  // binary ionic (CK-12 7.7, 7.8 and their review questions)
  ['NaBr', 'sodium bromide'],
  ['MgCl2', 'magnesium chloride'],
  ['LiI', 'lithium iodide'],
  ['CaO', 'calcium oxide'],
  ['CuBr2', 'copper(II) bromide'],
  ['FeO', 'iron(II) oxide'],
  ['KF', 'potassium fluoride'],
  ['Na3N', 'sodium nitride'],
  ['Ca3P2', 'calcium phosphide'],
  ['AlN', 'aluminum nitride'],
  ['Li2O', 'lithium oxide'],
  ['Al2O3', 'aluminum oxide'],
  ['PbO2', 'lead(IV) oxide'],
  ['CsF', 'cesium fluoride'],
  ['CaS', 'calcium sulfide'],
  ['AlCl3', 'aluminum chloride'],
  ['Zn3N2', 'zinc nitride'],
  ['Fe2O3', 'iron(III) oxide'],
  ['NiS', 'nickel(II) sulfide'],
  ['AuCl', 'gold(I) chloride'],
  ['SnI4', 'tin(IV) iodide'],
  ['Ag2S', 'silver sulfide'],
  ['Cu2O', 'copper(I) oxide'],
  ['CuO', 'copper(II) oxide'],
  ['SnO2', 'tin(IV) oxide'],
  ['FeCl3', 'iron(III) chloride'],
  ['Hg2Cl2', 'mercury(I) chloride'],
  ['HgO', 'mercury(II) oxide'],
  ['K2O2', 'potassium peroxide'],
  ['BaCl2', 'barium chloride'],
  ['NaH', 'sodium hydride'],
  ['CoCl2', 'cobalt(II) chloride'],
  ['CrCl3', 'chromium(III) chloride'],
  ['MnO', 'manganese(II) oxide'],
  ['PbCl2', 'lead(II) chloride'],
  // ternary ionic (CK-12 7.9, 7.10 and their review questions)
  ['NaNO3', 'sodium nitrate'],
  ['NH4Cl', 'ammonium chloride'],
  ['Fe(OH)3', 'iron(III) hydroxide'],
  ['Ca(NO3)2', 'calcium nitrate'],
  ['CaCO3', 'calcium carbonate'],
  ['Hg(NO3)2', 'mercury(II) nitrate'],
  ['(NH4)3PO4', 'ammonium phosphate'],
  ['CaSiO3', 'calcium silicate'],
  ['PbCrO4', 'lead(II) chromate'],
  ['KClO3', 'potassium chlorate'],
  ['Rb2SO4', 'rubidium sulfate'],
  ['NaCN', 'sodium cyanide'],
  ['Fe2(SO4)3', 'iron(III) sulfate'],
  ['NaHCO3', 'sodium hydrogen carbonate'],
  ['KMnO4', 'potassium permanganate'],
  ['K2Cr2O7', 'potassium dichromate'],
  ['(NH4)2SO4', 'ammonium sulfate'],
  ['Ca3(PO4)2', 'calcium phosphate'],
  ['NaClO', 'sodium hypochlorite'],
  ['Mg(ClO4)2', 'magnesium perchlorate'],
  ['KH2PO4', 'potassium dihydrogen phosphate'],
  ['Na2HPO4', 'sodium hydrogen phosphate'],
  ['Ca(CH3COO)2', 'calcium acetate'],
  ['Na2C2O4', 'sodium oxalate'],
  ['KSCN', 'potassium thiocyanate'],
  ['Cu(NO2)2', 'copper(II) nitrite'],
  ['Al2(SO3)3', 'aluminum sulfite'],
  ['NaIO3', 'sodium iodate'],
  ['KBrO4', 'potassium perbromate'],
  ['Hg2SO4', 'mercury(I) sulfate'],
  // bases (CK-12 7.13)
  ['NaOH', 'sodium hydroxide'],
  ['Ca(OH)2', 'calcium hydroxide'],
  ['NH4OH', 'ammonium hydroxide'],
  ['LiOH', 'lithium hydroxide'],
  ['Mg(OH)2', 'magnesium hydroxide'],
  ['Ni(OH)2', 'nickel(II) hydroxide'],
  ['Al(OH)3', 'aluminum hydroxide'],
  ['AgOH', 'silver hydroxide'],
  // binary molecular (CK-12 7.11)
  ['NO', 'nitrogen monoxide'],
  ['N2O', 'dinitrogen monoxide'],
  ['S2Cl2', 'disulfur dichloride'],
  ['Cl2O7', 'dichlorine heptoxide'],
  ['NO2', 'nitrogen dioxide'],
  ['ClF3', 'chlorine trifluoride'],
  ['As2O5', 'diarsenic pentoxide'],
  ['B4H10', 'tetraboron decahydride'],
  ['N2O5', 'dinitrogen pentoxide'],
  ['CO', 'carbon monoxide'],
  ['CO2', 'carbon dioxide'],
  ['CCl4', 'carbon tetrachloride'],
  ['PCl5', 'phosphorus pentachloride'],
  ['SF6', 'sulfur hexafluoride'],
  ['N2O4', 'dinitrogen tetroxide'],
  ['P4O10', 'tetraphosphorus decoxide'],
  ['SO3', 'sulfur trioxide'],
  ['OF2', 'oxygen difluoride'],
  ['H2O', 'water'],
  ['NH3', 'ammonia'],
  ['HCl', 'hydrogen chloride'],
  // acids (CK-12 7.12)
  ['H2SO4', 'sulfuric acid'],
  ['HCN(aq)', 'hydrocyanic acid'],
  ['HCl(aq)', 'hydrochloric acid'],
  ['H3PO4', 'phosphoric acid'],
  ['HBr(aq)', 'hydrobromic acid'],
  ['HClO4', 'perchloric acid'],
  ['HNO2', 'nitrous acid'],
  ['HNO3', 'nitric acid'],
  ['H2SO3', 'sulfurous acid'],
  ['HClO', 'hypochlorous acid'],
  ['H2S(aq)', 'hydrosulfuric acid'],
  ['H2CO3', 'carbonic acid'],
  ['HF(aq)', 'hydrofluoric acid'],
  ['HClO3', 'chloric acid'],
  ['HClO2', 'chlorous acid'],
  ['CH3COOH', 'acetic acid'],
  // hydrates
  ['CuSO4·5H2O', 'copper(II) sulfate pentahydrate'],
  ['Na2CO3·10H2O', 'sodium carbonate decahydrate'],
  ['MgSO4·7H2O', 'magnesium sulfate heptahydrate'],
  ['CaCl2·2H2O', 'calcium chloride dihydrate'],
  ['CoCl2·6H2O', 'cobalt(II) chloride hexahydrate'],
  ['BaCl2·2H2O', 'barium chloride dihydrate'],
]

describe('hand-worked formula ⟷ name pairs', () => {
  it('has well over 60 of them', () => {
    expect(PAIRS.length).toBeGreaterThan(100)
  })

  it.each(PAIRS)('%s is %s', (formula, name) => {
    expect(nameOfFormula(formula)).toBe(name)
    expect(formulaOfName(name)).toBe(formula)
    expect(gradeNameFromFormula(formula, name).verdict).toBe('correct')
    expect(gradeFormulaFromName(name, formula).verdict).toBe('correct')
  })
})

describe('hand-worked ion pairs, numerals and classes', () => {
  it.each([
    ['Fe3+', 'SO4 2-', 'Fe2(SO4)3'],
    ['Al3+', 'O2-', 'Al2O3'],
    ['Ca2+', 'NO3-', 'Ca(NO3)2'],
    ['NH4+', 'PO4 3-', '(NH4)3PO4'],
    ['Pb4+', 'O2-', 'PbO2'],
    ['Hg2 2+', 'Cl-', 'Hg2Cl2'],
    ['Na+', 'O2 2-', 'Na2O2'],
    ['Mg2+', 'O2-', 'MgO'],
    ['Cs+', 'F-', 'CsF'],
    ['Zn2+', 'N3-', 'Zn3N2'],
    ['Sn4+', 'I-', 'SnI4'],
    ['Au+', 'Cl-', 'AuCl'],
    ['Ni2+', 'S2-', 'NiS'],
    ['Fe3+', 'O2-', 'Fe2O3'],
  ])('%s and %s make %s', (a, b, f) => {
    expect(ionicFormula(a, b)).toBe(f)
    expect(gradeIonicFormula(a, b, f).verdict).toBe('correct')
  })

  it.each([
    ['FeCl3', 'III'],
    ['Fe2O3', 'III'],
    ['FeO', 'II'],
    ['Cu2O', 'I'],
    ['CuO', 'II'],
    ['PbO2', 'IV'],
    ['SnO2', 'IV'],
    ['Hg2Cl2', 'I'],
    ['CoCl2', 'II'],
  ])('%s needs (%s)', (f, r) => {
    expect(romanNumeralOf(f)).toBe(r)
  })

  it.each([
    ['NaCl', 'ionic'],
    ['NH4NO3', 'ionic'],
    ['NaOH', 'ionic'],
    ['CO2', 'molecular'],
    ['NH3', 'molecular'],
    ['HCl', 'molecular'],
    ['HCl(aq)', 'acid'],
    ['H2SO4', 'acid'],
    ['CuSO4·5H2O', 'hydrate'],
  ])('%s is %s', (f, k) => {
    expect(classOfFormula(f)).toBe(k)
  })
})

describe('single ions (CK-12 7.3, 7.6 and 7.9 review questions)', () => {
  it.each([
    ['PO3 3-', 'phosphite'],
    ['SiO3 2-', 'silicate'],
    ['OH-', 'hydroxide'],
    ['MnO4-', 'permanganate'],
    ['NH4+', 'ammonium'],
    ['CO3 2-', 'carbonate'],
    ['SO4 2-', 'sulfate'],
    ['PO4 3-', 'phosphate'],
    ['Sn4+', 'tin(IV)'],
    ['Fe3+', 'iron(III)'],
    ['Co2+', 'cobalt(II)'],
    ['Pb4+', 'lead(IV)'],
    ['Ba2+', 'barium'],
    ['Cs+', 'cesium'],
    ['F-', 'fluoride'],
    ['N3-', 'nitride'],
    ['Hg2 2+', 'mercury(I)'],
  ])('%s is %s', (ion, name) => {
    expect(gradeIonName(ion, name).verdict).toBe('correct')
    expect(gradeIonFormula(name, ion).verdict).toBe('correct')
  })

  it('names the CK-12 acids asked about without (aq) when the problem says they are acids', () => {
    expect(nameOfFormula('HCN', { inWater: true })).toBe('hydrocyanic acid')
    expect(nameOfFormula('HCl', { inWater: true })).toBe('hydrochloric acid')
    expect(gradeFormulaFromName('hydrobromic acid', 'HBr').verdict).toBe('correct')
  })
})

describe("the brief's own mistakes", () => {
  const v = (g: ReturnType<typeof gradeNameFromFormula>) => (g.verdict === 'mistake' ? g.mistake : g.verdict)
  it.each([
    ['sodium chloride', 'NaCl2', 'nm_charges_unbalanced'],
    ['magnesium oxide', 'Mg2O2', 'nm_not_lowest_ratio'],
    ['calcium nitrate', 'CaNO32', 'nm_parentheses_missing'],
    ['calcium nitrate', 'CaNO3 2', 'nm_parentheses_missing'],
    ['iron(III) chloride', 'Fe3Cl', 'nm_numeral_as_subscript'],
    ['sodium chloride', 'ClNa', 'nm_anion_first'],
    ['lead(IV) oxide', 'Pb2O4', 'nm_not_lowest_ratio'],
    ['aluminum oxide', 'Al3O2', 'nm_crisscross_reversed'],
  ])('%s written %s is %s', (n, f, id) => {
    expect(v(gradeFormulaFromName(n, f))).toBe(id)
  })
  it.each([
    ['MgCl2', 'magnesium dichloride', 'nm_prefix_on_ionic'],
    ['N2O5', 'nitrogen oxide', 'nm_prefix_missing'],
    ['CO', 'monocarbon monoxide', 'nm_mono_on_first'],
    ['FeCl3', 'iron chloride', 'nm_numeral_missing'],
    ['FeCl2', 'iron(I) chloride', 'nm_numeral_wrong'],
    ['FeCl3', 'iron(II) chloride', 'nm_numeral_wrong'],
    ['NaCl', 'sodium(I) chloride', 'nm_numeral_on_fixed'],
    ['Na2SO4', 'sodium sulfide', 'nm_ide_for_polyatomic'],
    ['Na2SO4', 'sodium sulfite', 'nm_ate_ite_swapped'],
    ['NaCl', 'sodium chlorine', 'nm_element_name_for_anion'],
    ['NaCl', 'chloride sodium', 'nm_anion_first'],
    ['H2SO4', 'hydrosulfuric acid', 'nm_hydro_on_oxyacid'],
    ['HCl(aq)', 'chloric acid', 'nm_hydro_missing'],
    ['H2SO4', 'sulfurous acid', 'nm_ic_ous_swapped'],
    ['HClO', 'perchloric acid', 'wrong'],
    ['CuSO4·5H2O', 'copper(II) sulfate trihydrate', 'nm_hydrate_count_wrong'],
  ])('%s named %s is %s', (f, n, id) => {
    expect(v(gradeNameFromFormula(f, n))).toBe(id)
  })
})
