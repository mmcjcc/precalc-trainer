/**
 * Every problem each template can build (each pool item in each direction it is asked), not only the seeds a test
 * happens to run, passes the generator's own check; the reserved compounds and ions are never asked; and the
 * hydrates are the real ones a first-year course names (known values typed by hand).
 */
import { describe, expect, it } from 'vitest'
import { makeRng } from '@/content'
import { compoundFormula, compoundName, compoundOfFormula, nameOfFormula } from '@/engine'
import { assertNomenclature } from './check'
import { everyProblem, nmAnswer, NM_TEMPLATES } from './generate'
import { CATALOG_EXAMPLE_COMPOUNDS, classifyPool, poolHydrates, poolIonicCompounds, poolIons, poolMolecular } from './pools'

const HEAVY = 120_000

describe.each(NM_TEMPLATES)('every problem $templateId can build', ({ templateId, question }) => {
  it(
    'passes the generator’s own check',
    () => {
      const all = everyProblem(question)
      expect(all.length).toBeGreaterThan(60)
      for (const drawn of all) assertNomenclature(`${templateId} ${drawn.problem}`, nmAnswer(question, drawn, makeRng(1)))
    },
    HEAVY,
  )
})

describe('the pools', () => {
  it('never ask about the catalog’s example compounds, hydrides, or the ions reserved for this module’s own examples', () => {
    const ionic = poolIonicCompounds().map((p) => compoundFormula(p.compound))
    for (const f of CATALOG_EXAMPLE_COMPOUNDS) expect(ionic, f).not.toContain(f)
    for (const f of ionic) expect(f, f).not.toMatch(/^(?:Rb|Cs|Be|Au|Fr|Ra)/)
    expect(poolIonicCompounds().some((p) => p.compound.anion.text === 'H^-')).toBe(false)
    expect(ionic).not.toContain('NH4I')
    const ions = poolIons().map((w) => w.item.text)
    for (const t of ['Rb^+', 'Cs^+', 'Be^2+', 'Au^+', 'Au^3+', 'BrO3^-', 'SiO3^2-', 'H3O^+']) expect(ions, t).not.toContain(t)
    expect(ions).toContain('SO4^2-')
    expect(ions).toContain('Hg2^2+')
    const molecular = poolMolecular().map((w) => w.item)
    for (const f of ['As2O5', 'S2Cl2', 'H2O', 'NH3', 'CH4']) expect(molecular, f).not.toContain(f)
    expect(poolHydrates().map((w) => w.item)).not.toContain('Na2CO3·10H2O')
    expect(classifyPool().map((w) => w.item.formula)).not.toContain('NH4I')
  })

  it('weights the textbook’s common ions above the rare ones', () => {
    const weight = (text: string) => poolIons().find((w) => w.item.text === text)!.weight
    expect(weight('Na^+')).toBeGreaterThan(weight('Sr^2+'))
    expect(weight('SO4^2-')).toBeGreaterThan(weight('C2O4^2-'))
    expect(weight('Fe^3+')).toBeGreaterThan(weight('Mn^3+'))
  })

  it('has real hydrates, named as a textbook names them', () => {
    const known: [string, string][] = [
      ['CuSO4·5H2O', 'copper(II) sulfate pentahydrate'],
      ['MgSO4·7H2O', 'magnesium sulfate heptahydrate'],
      ['BaCl2·2H2O', 'barium chloride dihydrate'],
      ['CoCl2·6H2O', 'cobalt(II) chloride hexahydrate'],
      ['Na2SO4·10H2O', 'sodium sulfate decahydrate'],
      ['CaSO4·2H2O', 'calcium sulfate dihydrate'],
      ['FeSO4·7H2O', 'iron(II) sulfate heptahydrate'],
      ['Hg2(NO3)2·2H2O', 'mercury(I) nitrate dihydrate'],
      ['SnCl4·5H2O', 'tin(IV) chloride pentahydrate'],
      ['Fe(NO3)3·9H2O', 'iron(III) nitrate nonahydrate'],
      ['LiCl·H2O', 'lithium chloride monohydrate'],
      ['NaC2H3O2·3H2O', 'sodium acetate trihydrate'],
    ]
    const pool = poolHydrates().map((w) => w.item)
    for (const [formula, name] of known) {
      expect(pool, formula).toContain(formula)
      expect(nameOfFormula(formula), formula).toBe(name)
    }
    for (const formula of pool) {
      const c = compoundOfFormula(formula)
      expect(c?.kind, formula).toBe('hydrate')
      if (c?.kind === 'hydrate') expect(compoundName(c)).toBe(nameOfFormula(formula))
    }
  })
})
