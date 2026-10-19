import { describe, expect, it } from 'vitest'
import { atomCounts, flatAtoms, readFormula, readIon, sequenceKey, simpleParts } from './formula'

const text = (t: string) => {
  const r = readFormula(t)
  return r.ok ? r.value.text : `ERR ${r.error.reason} @${r.error.position}`
}

describe('readFormula: compounds', () => {
  it.each([
    ['Fe2(SO4)3', 'Fe2(SO4)3'],
    ['NH4Cl', 'NH4Cl'],
    ['Ca(OH)2', 'Ca(OH)2'],
    ['N2O5', 'N2O5'],
    ['H2SO4', 'H2SO4'],
    ['HCl(aq)', 'HCl(aq)'],
    ['HCl (aq)', 'HCl(aq)'],
    ['HCl(AQ)', 'HCl(aq)'],
    ['NaCl(s)', 'NaCl(s)'],
    ['CuSO4·5H2O', 'CuSO4·5H2O'],
    ['CuSO4*5H2O', 'CuSO4·5H2O'],
    ['CuSO4.5H2O', 'CuSO4·5H2O'],
    ['CuSO4 • 5 H2O', 'CuSO4·5H2O'],
    ['LiCl·H2O', 'LiCl·H2O'],
    ['Fe₂O₃', 'Fe2O3'],
    ['CuSO₄·5H₂O', 'CuSO4·5H2O'],
    ['Fe 2 O 3', 'Fe2O3'],
    [' NaCl ', 'NaCl'],
    ['CaNO3 2', 'CaNO32'],
    ['(NH4)2SO4', '(NH4)2SO4'],
    ['P4O10', 'P4O10'],
    ['CH3COOH', 'CH3COOH'],
    ['Co', 'Co'],
    ['CO', 'CO'],
  ])('%s reads as %s', (input, out) => {
    expect(text(input)).toBe(out)
  })

  it('keeps her structure and positions', () => {
    const r = readFormula('Ca(NO3)2')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.parts).toHaveLength(2)
    const g = r.value.parts[1]!
    expect(g.type).toBe('group')
    if (g.type === 'group') {
      expect([g.count, g.position, g.length]).toEqual([2, 2, 6])
      expect(g.parts.map((p) => (p.type === 'element' ? `${p.symbol}${p.count}` : '?'))).toEqual(['N1', 'O3'])
    }
    expect(readFormula('CuSO4·5H2O').ok && readFormula('CuSO4·5H2O')).toMatchObject({ value: { waters: 5, state: null } })
  })

  it('says why, with a position, and never fixes the case', () => {
    const err = (t: string) => {
      const r = readFormula(t)
      return r.ok ? null : r.error
    }
    expect(err('NACL')).toMatchObject({ reason: 'case', position: 1 })
    expect(err('NACL')!.message).toMatch(/NA reads as N and A/)
    expect(err('nacl')).toMatchObject({ reason: 'case', position: 0 })
    expect(err('NaCL')).toMatchObject({ reason: 'case', position: 3 })
    expect(err('MgCL2')).toMatchObject({ reason: 'case', position: 3 })
    expect(err('Fe2o3')).toMatchObject({ reason: 'case', position: 3 })
    expect(err('CuSO4·5h2o')).toMatchObject({ reason: 'case' })
    expect(err('Xy2')).toMatchObject({ reason: 'unreadable', position: 0, length: 2 })
    expect(err('Q')).toMatchObject({ reason: 'unreadable', position: 0 })
    expect(err('2NaCl')).toMatchObject({ reason: 'not_in_form', position: 0 })
    expect(err('Na1Cl1')).toMatchObject({ reason: 'not_in_form', position: 2 })
    expect(err('Ca(NO3)1')).toMatchObject({ reason: 'not_in_form' })
    expect(err('CuSO4·1H2O')).toMatchObject({ reason: 'not_in_form' })
    expect(err('NaCl0')).toMatchObject({ reason: 'unreadable', position: 4 })
    expect(err('Fe(III)Cl3')).toMatchObject({ reason: 'not_in_form', position: 2, length: 5 })
    expect(err('Na+Cl-')).toMatchObject({ reason: 'not_in_form', position: 2 })
    expect(err('NaCl^-')).toMatchObject({ reason: 'not_in_form' })
    expect(err('Ca(NO3')!.reason).toBe('unreadable')
    expect(err('CaNO3)2')).toMatchObject({ reason: 'unreadable', position: 5 })
    expect(err('Ca[NO3]2')).toMatchObject({ reason: 'unreadable', position: 2 })
    expect(err('Ca()2')!.reason).toBe('unreadable')
    expect(err('CuSO4·5H2')!.reason).toBe('unreadable')
    expect(err('NaCl(x)')).not.toBeNull()
    expect(err('')!.message).toMatch(/Type the formula/)
    expect(err('sodium chloride')!.reason).toBe('case')
  })
})

describe('readIon', () => {
  const ions = (t: string) => {
    const r = readIon(t)
    return r.ok ? r.value.map((x) => x.text) : [`ERR ${r.error.reason}`]
  }
  it.each([
    ['SO4 2-', ['SO4^2-']],
    ['SO4^2-', ['SO4^2-']],
    ['SO4^(2-)', ['SO4^2-']],
    ['SO4^{2-}', ['SO4^2-']],
    ['SO4-2', ['SO4^2-']],
    ['SO₄²⁻', ['SO4^2-']],
    ['SO₄2-', ['SO4^2-']],
    ['SO42-', ['SO4^2-', 'SO42^-']],
    ['Fe3+', ['Fe^3+', 'Fe3^+']],
    ['Fe^3+', ['Fe^3+']],
    ['Fe 3+', ['Fe^3+']],
    ['Fe+3', ['Fe^3+']],
    ['Fe³⁺', ['Fe^3+']],
    ['Cl-', ['Cl^-']],
    ['Cl−', ['Cl^-']],
    ['OH-', ['OH^-']],
    ['NO3-', ['NO^3-', 'NO3^-']],
    ['NH4+', ['NH^4+', 'NH4^+']],
    ['Mg++', ['Mg^2+']],
    ['O--', ['O^2-']],
    ['Hg2 2+', ['Hg2^2+']],
    ['Hg22+', ['Hg2^2+', 'Hg22^+']],
    ['SO4', ['SO4']],
  ])('%s reads as %j', (input, out) => {
    expect(ions(input)).toEqual(out)
  })

  it('rejects what is not an ion, with a reason', () => {
    expect(ions('Fe3+2-')[0]).toMatch(/^ERR/)
    expect(ions('Fe+-')[0]).toMatch(/^ERR/)
    expect(ions('fe3+')).toEqual(['ERR case'])
    expect(ions('Fe0+')[0]).toMatch(/^ERR/)
    expect(ions('³⁺')[0]).toMatch(/^ERR/)
  })
})

describe('formula helpers', () => {
  it('flattens, counts and keys a formula', () => {
    const r = readFormula('Ca(NO3)2')
    if (!r.ok) throw new Error('unreadable')
    expect(flatAtoms(r.value.parts)).toEqual([
      ['Ca', 1],
      ['N', 2],
      ['O', 6],
    ])
    expect([...atomCounts(r.value.parts)]).toEqual([
      ['Ca', 1],
      ['N', 2],
      ['O', 6],
    ])
    expect(sequenceKey(simpleParts('CH3COO'))).toBe('C1H3C1O1O1')
    expect(() => simpleParts('Ca(OH)2')).toThrow(RangeError)
  })
})
