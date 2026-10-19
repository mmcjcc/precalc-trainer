import { describe, expect, it } from 'vitest'
import { gradeNameFromFormula, nameFromFormulaMistakes } from './grade'
import type { NmGrade } from './types'

const verdict = (g: NmGrade) => (g.verdict === 'mistake' ? g.mistake : g.verdict)
const name = (formula: string, her: string, inWater = false) => verdict(gradeNameFromFormula(formula, her, { inWater }))

describe('gradeNameFromFormula: right answers', () => {
  it.each([
    ['FeCl3', 'iron(III) chloride'],
    ['FeCl3', 'iron (III) chloride'],
    ['FeCl3', 'Iron(III) Chloride'],
    ['FeCl3', 'iron(iii)chloride'],
    ['Al2(SO4)3', 'aluminium sulphate'],
    ['NaHCO3', 'sodium bicarbonate'],
    ['NaHCO3', 'sodium hydrogen carbonate'],
    ['NiCl2', 'nickel(II) chloride'],
    ['NiCl2', 'nickel chloride'],
    ['Hg2Cl2', 'mercury(I) chloride'],
    ['Hg2Cl2', 'dimercury(I) chloride'],
    ['NaCH3COO', 'sodium ethanoate'],
    ['CO', 'carbon monoxide'],
    ['CO', 'carbon monooxide'],
    ['N2O5', 'dinitrogen pentaoxide'],
    ['N2O5', 'di-nitrogen penta-oxide'],
    ['CI4', 'carbon tetriodide'],
    ['H2O', 'water'],
    ['H2O', 'dihydrogen monoxide'],
    ['NH3', 'nitrogen trihydride'],
    ['HCl', 'hydrogen chloride'],
    ['HCl', 'hydrochloric acid'],
    ['HCl(aq)', 'hydrochloric acid'],
    ['HI(aq)', 'hydriodic acid'],
    ['H2SO4', 'sulphuric acid'],
    ['CuSO4·5H2O', 'copper(II) sulfate pentahydrate'],
    ['CuSO4·5H2O', 'copper (II) sulphate penta-hydrate'],
  ])('%s: %s', (f, n) => {
    expect(name(f, n)).toBe('correct')
  })

  it('says why an accepted alternative is right', () => {
    const g = gradeNameFromFormula('NiCl2', 'nickel chloride')
    expect(g.verdict === 'correct' && g.message).toMatch(/textbook writes nickel\(II\) chloride/)
    const h = gradeNameFromFormula('HCl', 'hydrochloric acid')
    expect(h.verdict === 'correct' && h.message).toMatch(/dissolved in water.*hydrogen chloride/)
    const w = gradeNameFromFormula('H2O', 'dihydrogen monoxide')
    expect(w.verdict === 'correct' && w.message).toMatch(/better known as water/)
  })
})

describe('gradeNameFromFormula: named mistakes', () => {
  it.each([
    // ionic
    ['NaCl', 'chloride sodium', 'nm_anion_first'],
    ['MgCl2', 'magnesium dichloride', 'nm_prefix_on_ionic'],
    ['FeCl3', 'iron trichloride', 'nm_prefix_on_ionic'],
    ['Ca(NO3)2', 'calcium dinitrate', 'nm_prefix_on_ionic'],
    ['Na2O', 'disodium monoxide', 'nm_prefix_on_ionic'],
    ['FeCl3', 'iron chloride', 'nm_numeral_missing'],
    ['CuO', 'copper oxide', 'nm_numeral_missing'],
    ['FeCl3', 'iron(II) chloride', 'nm_numeral_wrong'],
    ['FeCl2', 'iron(I) chloride', 'nm_numeral_wrong'],
    ['Fe2O3', 'iron(II) oxide', 'nm_numeral_wrong'],
    ['PbO2', 'lead(II) oxide', 'nm_numeral_wrong'],
    ['Hg2Cl2', 'mercury(II) chloride', 'nm_numeral_wrong'],
    ['NiCl2', 'nickel(III) chloride', 'nm_numeral_wrong'],
    ['NaCl', 'sodium(I) chloride', 'nm_numeral_on_fixed'],
    ['ZnCl2', 'zinc(II) chloride', 'nm_numeral_on_fixed'],
    ['AgNO3', 'silver(I) nitrate', 'nm_numeral_on_fixed'],
    ['NH4Cl', 'ammonium(I) chloride', 'nm_numeral_on_fixed'],
    ['NaCl', 'sodium chlorine', 'nm_element_name_for_anion'],
    ['MgO', 'magnesium oxygen', 'nm_element_name_for_anion'],
    ['Na2SO4', 'sodium sulfide', 'nm_ide_for_polyatomic'],
    ['KClO3', 'potassium chloride', 'nm_ide_for_polyatomic'],
    ['Na2SO4', 'sodium sulfite', 'nm_ate_ite_swapped'],
    ['NaNO2', 'sodium nitrate', 'nm_ate_ite_swapped'],
    ['NaClO4', 'sodium chlorate', 'nm_per_hypo_wrong'],
    ['NaClO', 'sodium chlorite', 'nm_per_hypo_wrong'],
    ['NaHCO3', 'sodium carbonate', 'nm_hydrogen_prefix_wrong'],
    ['KH2PO4', 'potassium hydrogen phosphate', 'nm_hydrogen_prefix_wrong'],
    ['K2O2', 'potassium oxide', 'nm_unit_ion_reduced'],
    // molecular
    ['N2O5', 'nitrogen oxide', 'nm_prefix_missing'],
    ['N2O5', 'nitrogen pentoxide', 'nm_prefix_missing'],
    ['N2O5', 'dinitrogen oxide', 'nm_prefix_missing'],
    ['CO', 'carbon oxide', 'nm_prefix_missing'],
    ['CO', 'monocarbon monoxide', 'nm_mono_on_first'],
    ['NO2', 'mononitrogen dioxide', 'nm_mono_on_first'],
    ['S2Cl2', 'sulfur monochloride', 'nm_molecular_reduced'],
    ['N2O4', 'nitrogen dioxide', 'nm_molecular_reduced'],
    ['NO2', 'nitrogen dioxygen', 'nm_element_name_for_anion'],
    ['N2O5', 'nitrogen(V) oxide', 'nm_stock_on_molecular'],
    ['CO2', 'carbon(IV) oxide', 'nm_stock_on_molecular'],
    // acids
    ['H2SO4', 'hydrosulfuric acid', 'nm_hydro_on_oxyacid'],
    ['HClO3', 'hydrochloric acid', 'nm_hydro_on_oxyacid'],
    ['HCl(aq)', 'chloric acid', 'nm_hydro_missing'],
    ['H2S(aq)', 'sulfuric acid', 'nm_hydro_missing'],
    ['H2SO4', 'sulfurous acid', 'nm_ic_ous_swapped'],
    ['HNO2', 'nitric acid', 'nm_ic_ous_swapped'],
    ['H2SO4', 'sulfic acid', 'nm_acid_root'],
    ['H3PO4', 'phosphic acid', 'nm_acid_root'],
    ['H2S(aq)', 'hydrosulfic acid', 'nm_acid_root'],
    ['HCl(aq)', 'hydrogen chloride', 'nm_acid_named_as_salt'],
    ['H2SO4', 'hydrogen sulfate', 'nm_acid_named_as_salt'],
    ['H2SO4', 'dihydrogen sulfate', 'nm_acid_named_as_salt'],
    ['H2SO4', 'sulfate acid', 'nm_acid_anion_ending'],
    ['HCl(aq)', 'hydrochloride acid', 'nm_acid_anion_ending'],
    ['HClO4', 'chloric acid', 'nm_per_hypo_wrong'],
    ['HClO', 'chlorous acid', 'nm_per_hypo_wrong'],
    ['HCl', 'chloric acid', 'nm_hydro_missing'],
    // hydrates
    ['CuSO4·5H2O', 'copper(II) sulfate tetrahydrate', 'nm_hydrate_count_wrong'],
    ['CuSO4·5H2O', 'copper(II) sulfate hydrate', 'nm_hydrate_count_wrong'],
    ['CuSO4·5H2O', 'copper(II) sulfate', 'nm_hydrate_count_wrong'],
    ['CuSO4·5H2O', 'copper sulfate pentahydrate', 'nm_numeral_missing'],
    ['CuSO4·5H2O', 'copper(II) sulfite pentahydrate', 'nm_ate_ite_swapped'],
  ])('%s named %s → %s', (f, n, id) => {
    expect(name(f, n)).toBe(id)
  })

  it('names HCl in water as an acid only when the problem says so', () => {
    expect(name('HCl', 'hydrogen chloride', true)).toBe('nm_acid_named_as_salt')
    expect(name('HCl', 'hydrochloric acid', true)).toBe('correct')
  })

  it('writes the witness about her answer, with the reason', () => {
    const w = (f: string, n: string) => {
      const g = gradeNameFromFormula(f, n)
      return g.verdict === 'mistake' ? g.witness : ''
    }
    expect(w('FeCl3', 'iron(II) chloride')).toBe('(II) is the other charge iron can have. In FeCl₃, three chloride ions carry 3− in all, balanced by one iron ion.')
    expect(w('Fe2O3', 'iron(II) oxide')).toMatch(/^\(II\) matches the subscript of Fe in Fe₂O₃, but a subscript counts ions; it is not the charge/)
    expect(w('PbO2', 'lead(II) oxide')).toMatch(/^\(II\) is the subscript of oxide, not the charge of lead/)
    expect(w('FeCl2', 'iron(I) chloride')).toMatch(/single Fe in FeCl₂/)
    expect(w('FeCl3', 'iron chloride')).toMatch(/Iron forms more than one ion \(Fe²⁺ and Fe³⁺\)/)
    expect(w('MgCl2', 'magnesium dichloride')).toMatch(/Greek prefixes \(di-\)/)
    expect(w('FeCl3', 'iron trichloride')).toMatch(/For iron, the charge goes in a Roman numeral instead/)
    expect(w('N2O5', 'nitrogen pentoxide')).toMatch(/leaves out the prefix on nitrogen/)
    expect(w('S2Cl2', 'sulfur monochloride')).toMatch(/name of SCl, the formula reduced/)
    expect(w('CuSO4·5H2O', 'copper(II) sulfate tetrahydrate')).toMatch(/^Tetrahydrate means 4 water molecules/)
    // The witness is about her answer and never prints the finished name.
    for (const [f, n, right] of [
      ['FeCl3', 'iron(II) chloride', 'iron(III) chloride'],
      ['Na2SO4', 'sodium sulfite', 'sodium sulfate'],
      ['HCl(aq)', 'chloric acid', 'hydrochloric acid'],
      ['N2O5', 'nitrogen oxide', 'dinitrogen pentoxide'],
      ['H2SO4', 'sulfurous acid', 'sulfuric acid'],
    ])
      expect(w(f!, n!).toLowerCase()).not.toContain(right)
  })
})

describe('gradeNameFromFormula: wrong, invalid, unsupported', () => {
  it('says something specific without giving the answer', () => {
    const g = gradeNameFromFormula('NaCl', 'potassium chloride')
    expect(g).toEqual({ verdict: 'wrong', message: 'The anion part is right, but the cation is not the one in NaCl.' })
    const h = gradeNameFromFormula('NaCl', 'sodium bromide')
    expect(h.verdict === 'wrong' && h.message).toMatch(/cation part is right/)
    expect(name('N2O5', 'dinitrogen tetroxide')).toBe('wrong')
    expect(name('H2SO4', 'nitric acid')).toBe('wrong')
  })

  it('does not count a right name that is incomplete or misspelled (its message would give the answer away)', () => {
    expect(gradeNameFromFormula('H2SO4', 'sulfuric')).toEqual({ verdict: 'invalid', reason: 'not_in_form', message: 'An acid’s name ends with the word acid.' })
    const p = gradeNameFromFormula('PCl5', 'phosphorous pentachloride')
    expect(p.verdict === 'invalid' && p.message).toMatch(/spelled phosphorus/)
    expect(name('H3PO3', 'phosphorous acid')).toBe('correct')
    const f = gradeNameFromFormula('NaF', 'sodium flouride')
    expect(f.verdict === 'invalid' && f.message).toMatch(/f-l-u-o/)
    // A misspelling on top of a slip is still graded as wrong.
    expect(name('PCl5', 'phosphorous trichloride')).toBe('wrong')
  })

  it('accepts the one-word IUPAC spellings of the hydrogen ions', () => {
    expect(name('NaHCO3', 'sodium hydrogencarbonate')).toBe('correct')
    expect(name('KH2PO4', 'potassium dihydrogenphosphate')).toBe('correct')
    expect(name('NaHSO4', 'sodium hydrogensulphate')).toBe('correct')
  })

  it('does not count a formula, an Arabic numeral, a classical name or an unreadable name as an attempt', () => {
    expect(gradeNameFromFormula('FeCl3', 'FeCl3')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form', position: 0 })
    expect(gradeNameFromFormula('FeCl3', 'iron(3) chloride')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form', position: 5 })
    expect(gradeNameFromFormula('FeCl3', 'iron III chloride')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeNameFromFormula('FeCl3', 'ferric chloride')).toMatchObject({ verdict: 'invalid', reason: 'not_in_form' })
    expect(gradeNameFromFormula('FeCl3', '')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
    expect(gradeNameFromFormula('FeCl3', 'iron(III) chloride!')).toMatchObject({ verdict: 'invalid', reason: 'unreadable' })
  })

  it('returns unsupported for a problem outside the model and never throws', () => {
    expect(gradeNameFromFormula('MnO2', 'manganese(IV) oxide').verdict).toBe('unsupported')
    expect(gradeNameFromFormula('V2O5', 'vanadium(V) oxide').verdict).toBe('unsupported')
    expect(gradeNameFromFormula('fecl3', 'iron(III) chloride').verdict).toBe('unsupported')
    expect(gradeNameFromFormula('', 'x').verdict).toBe('unsupported')
    expect(nameFromFormulaMistakes('MnO2')).toBeNull()
  })
})

describe('nameFromFormulaMistakes', () => {
  const list = (f: string) => nameFromFormulaMistakes(f)!.map((c) => [c.id, c.text])

  it('lists what each slip produces for the compound', () => {
    expect(list('FeCl3')).toEqual([
      ['nm_anion_first', 'chloride iron(III)'],
      ['nm_prefix_on_ionic', 'iron(III) trichloride'],
      ['nm_numeral_missing', 'iron chloride'],
      ['nm_numeral_wrong', 'iron(II) chloride'],
      ['nm_element_name_for_anion', 'iron(III) chlorine'],
    ])
    expect(list('Na2SO4').map((c) => c[0])).toEqual(['nm_anion_first', 'nm_prefix_on_ionic', 'nm_numeral_on_fixed', 'nm_ide_for_polyatomic', 'nm_ate_ite_swapped', 'nm_hydrogen_prefix_wrong'])
    expect(list('N2O5')).toEqual([
      ['nm_prefix_missing', 'nitrogen pentoxide'],
      ['nm_element_name_for_anion', 'dinitrogen pentoxygen'],
      ['nm_stock_on_molecular', 'nitrogen(V) oxide'],
    ])
    expect(list('H2SO4')).toEqual([
      ['nm_acid_named_as_salt', 'hydrogen sulfate'],
      ['nm_hydro_on_oxyacid', 'hydrosulfuric acid'],
      ['nm_ic_ous_swapped', 'sulfurous acid'],
      ['nm_acid_root', 'sulfic acid'],
      ['nm_acid_anion_ending', 'sulfate acid'],
    ])
    expect(list('HCl(aq)').map((c) => c[0])).toEqual(['nm_acid_named_as_salt', 'nm_hydro_missing', 'nm_acid_anion_ending'])
    expect(list('CuSO4·5H2O')[0]).toEqual(['nm_hydrate_count_wrong', 'copper(II) sulfate tetrahydrate'])
  })

  it('keeps candidates that grade as their own id and differ from the answer', () => {
    for (const f of ['FeCl3', 'Na2SO4', 'N2O5', 'H2SO4', 'HCl(aq)', 'CuSO4·5H2O', 'Hg2Cl2', 'K2O2', 'NiCl2', 'CO', 'NH4NO3'])
      for (const c of nameFromFormulaMistakes(f)!) {
        const g = gradeNameFromFormula(f, c.text)
        expect(g.verdict === 'mistake' && g.mistake, `${f}: ${c.text}`).toBe(c.id)
        expect(g.verdict === 'mistake' && g.witness).toBe(c.witness)
      }
  })
})
