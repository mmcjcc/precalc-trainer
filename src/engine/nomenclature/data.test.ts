import { describe, expect, it } from 'vitest'
import { elementBySymbol } from '../chem/elements'
import { BINARY_ACID_ROOTS, CLASSICAL_NAMES, COMMON_HYDRATES, COMMON_MOLECULAR_FORMULAS, GREEK_PREFIXES, IDE_NAMES, MOLECULAR_ELEMENTS, POLYATOMIC_IONS } from './data'
import { simpleParts } from './formula'
import {
  ateItePartner,
  compoundCations,
  hydrogenSiblings,
  ideSlipIon,
  ideSlipName,
  ionByFormula,
  ionByName,
  ionDisplay,
  ionLatex,
  nmAnions,
  nmCations,
  nmIons,
  NUMERAL_METALS,
  perHypoVariants,
  resolveIon,
} from './ions'
import { compoundOfFormula } from './read'

describe('the polyatomic ion table', () => {
  it('has unique names and formulas, simple formulas and nonzero charges', () => {
    expect(new Set(POLYATOMIC_IONS.map((r) => r.name)).size).toBe(POLYATOMIC_IONS.length)
    expect(new Set(POLYATOMIC_IONS.map((r) => r.formula)).size).toBe(POLYATOMIC_IONS.length)
    for (const r of POLYATOMIC_IONS) {
      expect(r.charge, r.name).not.toBe(0)
      expect(r.name, r.name).toBe(r.name.toLowerCase().replace('(i)', '(I)'))
      for (const f of [r.formula, ...r.otherFormulas]) for (const p of simpleParts(f)) expect(elementBySymbol(p.symbol), `${r.name} ${f}`).toBeDefined()
    }
  })

  it('contains every ion the brief asks for, with these charges', () => {
    const want: Record<string, [string, number]> = {
      ammonium: ['NH4', 1],
      hydronium: ['H3O', 1],
      hydroxide: ['OH', -1],
      nitrate: ['NO3', -1],
      nitrite: ['NO2', -1],
      sulfate: ['SO4', -2],
      sulfite: ['SO3', -2],
      'hydrogen sulfate': ['HSO4', -1],
      phosphate: ['PO4', -3],
      'hydrogen phosphate': ['HPO4', -2],
      'dihydrogen phosphate': ['H2PO4', -1],
      carbonate: ['CO3', -2],
      'hydrogen carbonate': ['HCO3', -1],
      acetate: ['CH3COO', -1],
      chlorate: ['ClO3', -1],
      perchlorate: ['ClO4', -1],
      chlorite: ['ClO2', -1],
      hypochlorite: ['ClO', -1],
      bromate: ['BrO3', -1],
      perbromate: ['BrO4', -1],
      bromite: ['BrO2', -1],
      hypobromite: ['BrO', -1],
      iodate: ['IO3', -1],
      periodate: ['IO4', -1],
      iodite: ['IO2', -1],
      hypoiodite: ['IO', -1],
      permanganate: ['MnO4', -1],
      chromate: ['CrO4', -2],
      dichromate: ['Cr2O7', -2],
      cyanide: ['CN', -1],
      peroxide: ['O2', -2],
      oxalate: ['C2O4', -2],
      thiocyanate: ['SCN', -1],
      'mercury(I)': ['Hg2', 2],
    }
    for (const [name, [formula, charge]] of Object.entries(want)) {
      const row = POLYATOMIC_IONS.find((r) => r.name === name)
      expect(row, name).toBeDefined()
      expect([row!.formula, row!.charge], name).toEqual([formula, charge])
    }
    expect(POLYATOMIC_IONS.find((r) => r.name === 'acetate')!.otherFormulas).toContain('C2H3O2')
    expect(POLYATOMIC_IONS.find((r) => r.name === 'hydrogen carbonate')!.otherNames).toContain('bicarbonate')
  })

  it('marks exactly the additions to the CK-12 table', () => {
    const added = POLYATOMIC_IONS.filter((r) => !r.inTextbook).map((r) => r.name).sort()
    expect(added).toEqual(['bromite', 'hydrogen sulfite', 'hydronium', 'hypobromite', 'hypoiodite', 'iodate', 'iodite', 'perbromate', 'periodate', 'thiocyanate'])
    expect(POLYATOMIC_IONS.some((r) => r.name === 'arsenate')).toBe(false)
  })

  it('has the other tables in order', () => {
    expect(GREEK_PREFIXES).toEqual(['mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'])
    expect(MOLECULAR_ELEMENTS.indexOf('C')).toBeLessThan(MOLECULAR_ELEMENTS.indexOf('P'))
    // CK-12's own order (lesson 7.11) is a subsequence of the list.
    const ck12 = ['C', 'P', 'N', 'H', 'S', 'I', 'Br', 'Cl', 'O', 'F'].map((s) => MOLECULAR_ELEMENTS.indexOf(s))
    expect([...ck12].sort((a, b) => a - b)).toEqual(ck12)
    expect(IDE_NAMES.O).toBe('oxide')
    expect(Object.keys(BINARY_ACID_ROOTS).sort()).toEqual(['Br^-', 'CN^-', 'Cl^-', 'F^-', 'I^-', 'S^2-'])
    expect(CLASSICAL_NAMES.ferric).toBe('iron(III)')
  })

  it('lists only compounds of the model as the common molecular compounds and hydrates', () => {
    for (const f of COMMON_MOLECULAR_FORMULAS) expect(compoundOfFormula(f), f).not.toBeNull()
    for (const f of COMMON_HYDRATES) expect(compoundOfFormula(f)?.kind, f).toBe('hydrate')
  })
})

describe('the ions of the model', () => {
  it('takes the monatomic ions from commonCharges, mercury(I) as Hg2 2+, and no H+', () => {
    const texts = nmIons().map((i) => i.text)
    for (const t of ['Na^+', 'Mg^2+', 'Al^3+', 'Fe^3+', 'Fe^2+', 'Cu^+', 'Cu^2+', 'Pb^4+', 'Sn^2+', 'Hg^2+', 'Hg2^2+', 'Ag^+', 'Zn^2+', 'Ni^2+', 'Au^3+'])
      expect(texts, t).toContain(t)
    for (const t of ['H^+', 'Hg^+', 'Cd^2+', 'V^5+']) expect(texts, t).not.toContain(t)
    for (const t of ['H^-', 'N^3-', 'O^2-', 'F^-', 'P^3-', 'S^2-', 'Cl^-', 'Br^-', 'I^-']) expect(texts, t).toContain(t)
    expect(new Set(texts).size).toBe(texts.length)
    expect(nmCations().every((i) => i.charge > 0)).toBe(true)
    expect(nmAnions().every((i) => i.charge < 0)).toBe(true)
    expect(compoundCations().some((i) => i.formula === 'H3O')).toBe(false)
  })

  it('gives a Roman numeral to the metals with more than one charge, and to nickel', () => {
    expect([...NUMERAL_METALS].sort()).toEqual(['Au', 'Co', 'Cr', 'Cu', 'Fe', 'Hg', 'Mn', 'Pb', 'Sn'])
    expect(ionByFormula('Fe3+')!.name).toBe('iron(III)')
    expect(ionByFormula('Cu+')!.name).toBe('copper(I)')
    expect(ionByFormula('Pb4+')!.name).toBe('lead(IV)')
    expect(ionByFormula('Hg2 2+')!.name).toBe('mercury(I)')
    expect(ionByFormula('Hg2+')!.name).toBe('mercury(II)')
    const ni = ionByFormula('Ni2+')!
    expect([ni.name, ni.numeralOptional, ni.otherNames]).toEqual(['nickel(II)', true, ['nickel']])
    for (const s of ['Na+', 'Ag+', 'Zn2+', 'Al3+', 'Ca2+', 'NH4+']) expect(ionByFormula(s)!.numeral, s).toBeNull()
  })

  it('finds ions by formula (every way of writing the charge) and by name', () => {
    for (const t of ['SO4 2-', 'SO4^2-', 'SO42-', 'SO₄²⁻', 'SO4^(2-)', 'SO4-2']) expect(ionByFormula(t)?.name, t).toBe('sulfate')
    for (const t of ['Fe3+', 'Fe^3+', 'Fe 3+', 'Fe+3', 'Fe³⁺']) expect(ionByFormula(t)?.name, t).toBe('iron(III)')
    for (const t of ['C2H3O2-', 'CH3COO-', 'CH3CO2-']) expect(ionByFormula(t)?.name, t).toBe('acetate')
    expect(ionByFormula('NO3-')?.name).toBe('nitrate')
    expect(ionByFormula('NH4+')?.name).toBe('ammonium')
    expect(ionByFormula('O2-')?.name).toBe('oxide')
    expect(ionByFormula('O2 2-')?.name).toBe('peroxide')
    expect(ionByFormula('Mg++')?.name).toBe('magnesium')
    expect(ionByFormula('Xx+')).toBeNull()
    expect(ionByName('Bicarbonate')?.formula).toBe('HCO3')
    expect(ionByName('sulphate ion')?.formula).toBe('SO4')
    expect(ionByName('dimercury')?.formula).toBe('Hg2')
    expect(ionByName('iron (III)')?.text).toBe('Fe^3+')
    expect(resolveIon('iron(II)')?.text).toBe('Fe^2+')
    expect(resolveIon('unobtainium')).toBeNull()
  })

  it('prints ions as display text and LaTeX', () => {
    expect(ionDisplay(ionByName('sulfate')!)).toBe('SO₄²⁻')
    expect(ionDisplay(ionByName('iron(III)')!)).toBe('Fe³⁺')
    expect(ionDisplay(ionByName('chloride')!)).toBe('Cl⁻')
    expect(ionLatex(ionByName('sulfate')!)).toBe('\\mathrm{SO_4^{2-}}')
    expect(ionLatex(ionByName('mercury(I)')!)).toBe('\\mathrm{Hg_2^{2+}}')
  })

  it('relates the ions the slips swap', () => {
    const n = (name: string) => ionByName(name)!
    expect(ateItePartner(n('nitrate'))?.name).toBe('nitrite')
    expect(ateItePartner(n('sulfite'))?.name).toBe('sulfate')
    expect(ateItePartner(n('hydrogen sulfate'))?.name).toBe('hydrogen sulfite')
    expect(ateItePartner(n('carbonate'))).toBeNull()
    expect(ateItePartner(n('perchlorate'))).toBeNull()
    expect(perHypoVariants(n('perchlorate')).map((i) => i.name)).toEqual(['chlorate'])
    expect(perHypoVariants(n('chlorate')).map((i) => i.name)).toEqual(['perchlorate'])
    expect(perHypoVariants(n('chlorite')).map((i) => i.name)).toEqual(['hypochlorite'])
    expect(perHypoVariants(n('hypoiodite')).map((i) => i.name)).toEqual(['iodite'])
    expect(perHypoVariants(n('permanganate'))).toEqual([])
    expect(hydrogenSiblings(n('phosphate')).map((i) => i.name)).toEqual(['hydrogen phosphate', 'dihydrogen phosphate'])
    expect(hydrogenSiblings(n('hydrogen carbonate')).map((i) => i.name)).toEqual(['carbonate'])
    expect(ideSlipName(n('sulfate'))).toBe('sulfide')
    expect(ideSlipName(n('hydrogen sulfate'))).toBe('hydrogen sulfide')
    expect(ideSlipName(n('carbonate'))).toBe('carbide')
    expect(ideSlipName(n('perchlorate'))).toBe('chloride')
    expect(ideSlipName(n('acetate'))).toBeNull()
    expect(ideSlipName(n('chromate'))).toBeNull()
    expect(ideSlipIon(n('nitrate'))?.text).toBe('N^3-')
    expect(ideSlipIon(n('carbonate'))).toBeNull()
  })
})
