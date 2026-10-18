import { describe, expect, it } from 'vitest'
import {
  acceptedFormulas,
  acceptedNameKeys,
  acidCompounds,
  balancedCounts,
  binaryAcidName,
  compoundClass,
  compoundFormula,
  compoundName,
  hydrogenCompounds,
  ionicCompound,
  ionicCompounds,
  ionPairProblem,
  molecularCompound,
  molecularCompounds,
  molecularPairs,
  molecularProblem,
  oxyacidName,
  systematicName,
} from './compounds'
import { ionByFormula, ionByName } from './ions'
import { compoundOfFormula, compoundOfName, readCompoundFormula, readCompoundName } from './read'
import { cationChargeOf, classOfFormula, formulaOfName, ionicFormula, nameOfFormula, nomenclatureProblem, romanNumeralOf, ionicPairProblem } from './index'

const ion = (t: string) => ionByFormula(t) ?? ionByName(t)!

describe('charge balance', () => {
  it('finds the lowest whole-number ratio', () => {
    expect(balancedCounts(3, -2)).toEqual([2, 3])
    expect(balancedCounts(2, -2)).toEqual([1, 1])
    expect(balancedCounts(4, -2)).toEqual([1, 2])
    expect(balancedCounts(1, -3)).toEqual([3, 1])
  })

  it.each([
    ['Fe3+', 'SO4 2-', 'Fe2(SO4)3'],
    ['Al3+', 'O2-', 'Al2O3'],
    ['Pb4+', 'O2-', 'PbO2'],
    ['Ca2+', 'NO3-', 'Ca(NO3)2'],
    ['NH4+', 'PO4 3-', '(NH4)3PO4'],
    ['NH4+', 'SO4 2-', '(NH4)2SO4'],
    ['Hg2 2+', 'Cl-', 'Hg2Cl2'],
    ['Hg2 2+', 'PO4 3-', '(Hg2)3(PO4)2'],
    ['Na+', 'O2 2-', 'Na2O2'],
    ['Ba2+', 'O2 2-', 'BaO2'],
    ['Mg2+', 'O2-', 'MgO'],
    ['Ca2+', 'CO3 2-', 'CaCO3'],
    ['Zn2+', 'N3-', 'Zn3N2'],
    ['Na+', 'C2H3O2-', 'NaCH3COO'],
  ])('%s and %s make %s', (a, b, f) => {
    expect(compoundFormula(ionicCompound(ion(a), ion(b)))).toBe(f)
    expect(ionicFormula(a, b)).toBe(f)
  })

  it('keeps peroxide and hydride with groups 1 and 2, and hydronium out of compounds', () => {
    expect(ionPairProblem(ion('Fe2+'), ion('O2 2-'))).toMatch(/groups 1 and 2/)
    expect(ionPairProblem(ion('NH4+'), ion('H-'))).toMatch(/groups 1 and 2/)
    expect(ionPairProblem(ion('Na+'), ion('H-'))).toBeNull()
    expect(ionPairProblem(ion('H3O+'), ion('Cl-'))).toMatch(/Hydronium/)
    expect(() => ionicCompound(ion('Cl-'), ion('Na+'))).toThrow(RangeError)
    expect(ionicPairProblem('Fe3+', 'sulfate')).toBeNull()
    expect(ionicPairProblem('Xx3+', 'sulfate')).toMatch(/not an ion/)
  })
})

describe('names and formulas', () => {
  it.each([
    ['FeCl3', 'iron(III) chloride'],
    ['Fe2O3', 'iron(III) oxide'],
    ['FeO', 'iron(II) oxide'],
    ['Cu2O', 'copper(I) oxide'],
    ['PbO2', 'lead(IV) oxide'],
    ['Hg2Cl2', 'mercury(I) chloride'],
    ['HgCl2', 'mercury(II) chloride'],
    ['NiCl2', 'nickel(II) chloride'],
    ['AgNO3', 'silver nitrate'],
    ['ZnO', 'zinc oxide'],
    ['NH4NO3', 'ammonium nitrate'],
    ['K2O2', 'potassium peroxide'],
    ['CaH2', 'calcium hydride'],
    ['NaHS', 'sodium hydrogen sulfide'],
    ['CO', 'carbon monoxide'],
    ['N2O4', 'dinitrogen tetroxide'],
    ['P4O10', 'tetraphosphorus decoxide'],
    ['CI4', 'carbon tetraiodide'],
    ['As4O6', 'tetraarsenic hexoxide'],
    ['H2O', 'water'],
    ['NH3', 'ammonia'],
    ['CH4', 'methane'],
    ['SiH4', 'silicon tetrahydride'],
    ['HCl', 'hydrogen chloride'],
    ['H2S', 'hydrogen sulfide'],
    ['HCN', 'hydrogen cyanide'],
    ['HCl(aq)', 'hydrochloric acid'],
    ['HI(aq)', 'hydroiodic acid'],
    ['HCN(aq)', 'hydrocyanic acid'],
    ['H2SO4', 'sulfuric acid'],
    ['H2SO4(aq)', 'sulfuric acid'],
    ['H3PO3', 'phosphorous acid'],
    ['HClO4', 'perchloric acid'],
    ['HIO', 'hypoiodous acid'],
    ['HMnO4', 'permanganic acid'],
    ['H2C2O4', 'oxalic acid'],
    ['HSCN', 'thiocyanic acid'],
    ['CH3COOH', 'acetic acid'],
    ['HC2H3O2', 'acetic acid'],
    ['CuSO4·5H2O', 'copper(II) sulfate pentahydrate'],
    ['LiCl·H2O', 'lithium chloride monohydrate'],
    ['Ba(OH)2·8H2O', 'barium hydroxide octahydrate'],
  ])('%s is %s', (f, n) => {
    expect(nameOfFormula(f)).toBe(n)
  })

  it('names HCl as an acid when the problem says it is in water', () => {
    expect(nameOfFormula('HCl', { inWater: true })).toBe('hydrochloric acid')
    expect(nameOfFormula('H2S', { inWater: true })).toBe('hydrosulfuric acid')
  })

  it.each([
    ['iron(III) sulfate', 'Fe2(SO4)3'],
    ['Iron (III) Sulphate', 'Fe2(SO4)3'],
    ['ammonium phosphate', '(NH4)3PO4'],
    ['mercury(I) nitrate', 'Hg2(NO3)2'],
    ['dimercury chloride', 'Hg2Cl2'],
    ['nickel chloride', 'NiCl2'],
    ['sodium bicarbonate', 'NaHCO3'],
    ['aluminium sulphate', 'Al2(SO4)3'],
    ['dinitrogen pentaoxide', 'N2O5'],
    ['carbon monooxide', 'CO'],
    ['hydrochloric acid', 'HCl(aq)'],
    ['hydrosulfuric acid', 'H2S(aq)'],
    ['phosphoric acid', 'H3PO4'],
    ['acetic acid', 'CH3COOH'],
    ['copper(II) sulfate pentahydrate', 'CuSO4·5H2O'],
    ['sodium carbonate decahydrate', 'Na2CO3·10H2O'],
    ['water', 'H2O'],
    ['dihydrogen monoxide', 'H2O'],
    ['hydrogen chloride', 'HCl'],
    ['tetraboron decahydride', 'B4H10'],
  ])('%s is %s', (n, f) => {
    expect(formulaOfName(n)).toBe(f)
  })

  it('accepts every way of writing the right formula and name', () => {
    const acetate = ionicCompound(ion('Ca2+'), ion('CH3COO-'))
    expect(acceptedFormulas(acetate)).toEqual(['Ca(CH3COO)2', 'Ca(C2H3O2)2', 'Ca(CH3CO2)2'])
    const acetic = compoundOfFormula('CH3COOH')!
    expect(acceptedFormulas(acetic)).toEqual(expect.arrayContaining(['HCH3COO', 'HC2H3O2', 'CH3COOH', 'CH3CO2H']))
    expect(acceptedNameKeys(ionicCompound(ion('Ni2+'), ion('Cl-')))).toEqual(['nickel(ii) chloride', 'nickel chloride'])
    expect(acceptedNameKeys(compoundOfFormula('H2O')!)).toEqual(['water', 'dihydrogen monoxide'])
    expect(acceptedNameKeys(compoundOfFormula('H2S')!)).toEqual(
      expect.arrayContaining(['hydrogen sulfide', 'hydrogen monosulfide', 'dihydrogen sulfide', 'dihydrogen monosulfide']),
    )
    expect(systematicName(compoundOfFormula('NH3')!)).toBe('nitrogen trihydride')
    expect(systematicName(compoundOfFormula('NO')!)).toBeNull()
  })

  it('builds acid names from the anion', () => {
    expect(oxyacidName('sulfate')).toBe('sulfuric acid')
    expect(oxyacidName('sulfite')).toBe('sulfurous acid')
    expect(oxyacidName('phosphate')).toBe('phosphoric acid')
    expect(oxyacidName('hypochlorite')).toBe('hypochlorous acid')
    expect(oxyacidName('acetate')).toBe('acetic acid')
    expect(binaryAcidName(ion('Br-'))).toBe('hydrobromic acid')
    expect(() => binaryAcidName(ion('O2-'))).toThrow(RangeError)
  })
})

describe('classes and the Roman numeral from charge balance', () => {
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
    expect(compoundClass(compoundOfFormula(f)!)).toBe(k)
  })

  it.each([
    ['FeCl3', 'III', 3],
    ['Fe2O3', 'III', 3],
    ['FeO', 'II', 2],
    ['Cu2O', 'I', 1],
    ['CuO', 'II', 2],
    ['PbO2', 'IV', 4],
    ['SnO2', 'IV', 4],
    ['Hg2Cl2', 'I', 2],
    ['HgCl2', 'II', 2],
    ['NiCl2', 'II', 2],
    ['Fe2(SO4)3', 'III', 3],
    ['CoCl2·6H2O', 'II', 2],
  ])('%s carries (%s)', (f, r, q) => {
    expect(romanNumeralOf(f)).toBe(r)
    expect(cationChargeOf(f)).toBe(q)
  })

  it('gives no numeral to a fixed-charge cation and throws for a formula that is not ionic', () => {
    expect(romanNumeralOf('NaCl')).toBeNull()
    expect(romanNumeralOf('Ag2S')).toBeNull()
    expect(() => romanNumeralOf('CO2')).toThrow(RangeError)
    expect(() => cationChargeOf('H2SO4')).toThrow(RangeError)
  })
})

describe('the edges of the model', () => {
  it.each([
    ['MnO2', /would need Mn⁴⁺.*2\+ and 3\+/],
    ['V2O5', /Vanadium has no ion taught/],
    ['PdO', /Palladium has no ion taught/],
    ['Cd(NO3)2', /Cadmium has no ion taught/],
    ['FeCl4', /would need Fe⁴⁺/],
    ['Mg2O2', /lowest whole-number ratio/],
    ['NaCl2', /would need Na²⁺/],
    ['CaNO32', /outside the model/],
    ['C6H12O6', /outside the model/],
    ['O2', /outside the model/],
    ['FeO2', /would need Fe⁴⁺/],
    ['H2O2', /outside the model/],
    ['OCl2', /outside the model/],
    ['H2Se', /outside the model/],
    ['Ca(Cl)2', /parentheses/],
    ['Na(NO3)', /parentheses/],
    ['NH4H', /outside the model/],
    ['H3OCl', /outside the model/],
    ['CuSO4·11H2O', /1 to 10/],
    ['N11O2', /could not be read|outside the model/],
  ])('%s is outside the model, with a reason', (f, why) => {
    const r = readCompoundFormula(f)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(why)
    expect(nomenclatureProblem(f, 'name')).toMatch(why)
    expect(() => nameOfFormula(f)).toThrow(RangeError)
  })

  it('reads names only inside the model', () => {
    expect(readCompoundName('iron(IV) chloride').ok).toBe(false)
    expect(readCompoundName('vanadium(V) oxide').ok).toBe(false)
    expect(readCompoundName('sodium unobtainate').ok).toBe(false)
    expect(readCompoundName('copper(II) sulfate dodecahydrate').ok).toBe(false)
    expect(compoundOfName('ferric chloride')).toBeNull()
    expect(nomenclatureProblem('iron(III) sulfate', 'formula')).toBeNull()
    expect(nomenclatureProblem('SO4 2-', 'ion_name')).toBeNull()
    expect(nomenclatureProblem('SO4', 'ion_name')).toMatch(/charge/)
    expect(nomenclatureProblem('sulfate', 'ion_formula')).toBeNull()
    expect(nomenclatureProblem('NH4Cl', 'classify')).toBeNull()
  })

  it('molecular compounds follow the written order and the prefixes', () => {
    expect(molecularProblem('O', 1, 'C', 2)).toMatch(/written before/)
    expect(molecularProblem('C', 11, 'O', 2)).toMatch(/deca/)
    expect(molecularProblem('Na', 1, 'Cl', 1)).toMatch(/two of these elements/)
    expect(() => molecularCompound('H', 1, 'Cl', 1)).toThrow(RangeError)
    expect(molecularCompound('H', 2, 'O', 1).kind).toBe('molecular')
  })
})

describe('the lists', () => {
  it('builds every cation with every anion, every acid and every molecular pair', () => {
    const ionic = ionicCompounds()
    expect(ionic.length).toBeGreaterThan(1400)
    expect(new Set(ionic.map(compoundFormula)).size).toBe(ionic.length)
    expect(new Set(ionic.map(compoundName)).size).toBe(ionic.length)
    expect(acidCompounds().map(compoundName)).toEqual(
      expect.arrayContaining(['hydrofluoric acid', 'hydrochloric acid', 'hydrobromic acid', 'hydroiodic acid', 'hydrosulfuric acid', 'hydrocyanic acid', 'sulfuric acid', 'nitrous acid', 'acetic acid', 'periodic acid']),
    )
    expect(acidCompounds().some((a) => /hydrogen/.test(a.anion.name))).toBe(false)
    expect(hydrogenCompounds().map(compoundFormula).sort()).toEqual(['H2S', 'HBr', 'HCN', 'HCl', 'HF', 'HI'])
    expect(molecularPairs()).toHaveLength(97)
    expect(molecularCompounds()).toHaveLength(9701)
  })
})
