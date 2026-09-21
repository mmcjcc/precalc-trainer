import { describe, expect, it } from 'vitest'
import type { AtomGrade } from '@/shared/types'
import { abundanceIssues, explainAbundance, gradeAbundance, parsePercentText, solveAbundance, type AbundanceQuestion } from './abundance'

/** Chlorine with the average computed from the NIST table (35.4530728 u, given to the thousandths). */
const chlorine: AbundanceQuestion = {
  kind: 'abundance',
  element: 'chlorine',
  symbol: 'Cl',
  fictional: false,
  isotopes: [
    { label: 'chlorine-35', massNumber: 35, mass: '34.969' },
    { label: 'chlorine-37', massNumber: 37, mass: '36.966' },
  ],
  average: '35.453',
  place: -2,
}

/** Copper, average 63.546 u (the periodic-table value): 69.15% and 30.85%, as in the NIST table. */
const copper: AbundanceQuestion = {
  kind: 'abundance',
  element: 'copper',
  symbol: 'Cu',
  fictional: false,
  isotopes: [
    { label: 'copper-63', massNumber: 63, mass: '62.929598' },
    { label: 'copper-65', massNumber: 65, mass: '64.927790' },
  ],
  average: '63.546',
  place: -2,
}

const ids = (g: AtomGrade) => g.boxes.map((b) => b.pattern?.id ?? null)

describe('solveAbundance', () => {
  it('solves x·m1 + (1 − x)·m2 = average exactly and rounds to the asked place', () => {
    expect(solveAbundance(chlorine).answer).toEqual(['75.76', '24.24'])
    expect(solveAbundance(copper).answer).toEqual(['69.15', '30.85'])
    expect(abundanceIssues(chlorine)).toEqual([])
    expect(abundanceIssues({ ...chlorine, average: '37.100' })).toContain('the average is not between the two masses')
  })

  it('reads a typed percent with or without the % sign', () => {
    expect(parsePercentText('75.76%', 'x')).toMatchObject({ ok: true, value: { written: -2, text: '75.76' } })
    expect(parsePercentText(' 75.76 % ', 'x').ok).toBe(true)
    expect(parsePercentText('-5', 'x').ok).toBe(false)
    expect(parsePercentText('7,5', 'x')).toMatchObject({ ok: false, error: { position: 1 } })
    expect(parsePercentText('', 'chlorine-35')).toMatchObject({ ok: false, error: { message: 'Type the percent abundance of chlorine-35.' } })
  })
})

describe('gradeAbundance', () => {
  it('the right pair is right; a finer spelling that rounds right gets a note', () => {
    const g = gradeAbundance(chlorine, ['75.76', '24.24'])
    expect(g.status).toBe('correct')
    expect(g.patterns).toEqual([])
    expect(g.message).toBe('Right: chlorine-35 75.76% and chlorine-37 24.24%.')
    expect(gradeAbundance(chlorine, ['75.76%', '24.24 %']).status).toBe('correct')
    const finer = gradeAbundance(chlorine, ['75.764', '24.236'])
    expect(finer.status).toBe('correct')
    expect(finer.note).toContain('nearest hundredth of a percent')
  })

  it('assumed 50/50', () => {
    const g = gradeAbundance(copper, ['50', '50'])
    expect(g.status).toBe('wrong')
    expect(ids(g)).toEqual(['at_assumed_even_split', 'at_assumed_even_split'])
    expect(g.patterns).toHaveLength(1)
    expect(g.message).toContain('63.546 u is closer to 62.929598 u, so there is more copper-63 than copper-65')
  })

  it('the abundances swapped between the isotopes', () => {
    const g = gradeAbundance(chlorine, ['24.24', '75.76'])
    expect(ids(g)).toEqual(['at_abundance_swapped', 'at_abundance_swapped'])
    expect(g.message).toContain('right two numbers in the wrong rows')
    expect(ids(gradeAbundance(copper, ['30.85', '69.15']))).toEqual(['at_abundance_swapped', 'at_abundance_swapped'])
  })

  it('percents that do not total 100', () => {
    const g = gradeAbundance(copper, ['69.15', '31.85'])
    expect(g.status).toBe('wrong')
    expect(ids(g)).toEqual([null, 'at_abundance_sum'])
    expect(g.boxes[0]!.status).toBe('correct')
    expect(g.message).toBe('69.15% + 31.85% = 101.00%, but the two isotopes make up all of copper: the percents must total exactly 100%.')
    expect(ids(gradeAbundance(chlorine, ['70', '20']))).toEqual(['at_abundance_sum', 'at_abundance_sum'])
  })

  it('never names a mistake on the right answer, and anything else gets a plain, specific message', () => {
    const fractions = gradeAbundance(chlorine, ['0.7576', '0.2424'])
    expect(fractions.patterns).toEqual([])
    expect(fractions.message).toContain('fractions of 1')
    const check = gradeAbundance(chlorine, ['60', '40'])
    expect(check.patterns).toEqual([])
    expect(check.message).toBe('With 60% and 40%, the average would be 35.768 u, not 35.453 u.')
    const coarse = gradeAbundance(chlorine, ['75.8', '24.2'])
    expect(coarse.status).toBe('wrong')
    expect(coarse.patterns).toEqual([])
    expect(coarse.boxes[0]!.message).toContain('Right as far as it goes')
    // Close but wrong: the check shows enough digits to differ from the given average.
    const close = gradeAbundance(copper, ['69.14', '30.86'])
    expect(close.patterns).toEqual([])
    expect(close.message).toBe('With 69.14% and 30.86%, the average would be 63.5462 u, not 63.546 u.')
  })

  it('an empty box is a parse error and nothing is graded', () => {
    const g = gradeAbundance(chlorine, ['', '24.24'])
    expect(g.status).toBe('parse_error')
    expect(g.boxes.map((b) => b.box)).toEqual(['abundance1'])
  })
})

describe('explainAbundance', () => {
  it('sets up x and 1 − x, solves exactly, and checks against the nearer isotope', () => {
    expect(explainAbundance(chlorine)).toEqual([
      'Let x be the fraction of chlorine-35. The rest, 1 − x, is chlorine-37, because the two isotopes make up all of chlorine.',
      'Weighted average: x × 34.969 + (1 − x) × 36.966 = 35.453.',
      'Collect the x terms: 36.966 + (34.969 − 36.966)x = 35.453, so −1.997x = −1.513.',
      'x = −1.513 ÷ (−1.997) = 0.7576364546…',
      'As a percent (× 100) to the nearest hundredth of a percent: chlorine-35 is 75.76%, and chlorine-37 is 100% − 75.76% = 24.24%.',
      'Check: the average 35.453 u is closer to 34.969 u, and chlorine-35 does have the bigger share.',
    ])
  })
})
