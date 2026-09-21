import { describe, expect, it } from 'vitest'
import type { AtomGrade, AtomParticle, ErrorPatternId } from '@/shared/types'
import { ELEMENTS } from '../chem/elements'
import { percentToDecimalText as percentToDecimalTextForTest } from './exact'
import {
  chargeText,
  formulaText,
  nuclearSymbolLatex,
  nuclearSymbolText,
  parseChargeText,
  parseSymbolText,
  parseWholeNumber,
  particleCounts,
  particleFromCounts,
} from './particle'
import { explainParticles, gradeParticles, type ParticlesQuestion } from './particles'

const q = (particle: AtomParticle, shown: ParticlesQuestion['shown'] = 'symbol'): ParticlesQuestion => ({ kind: 'particles', particle, shown })
const cl37minus = q({ symbol: 'Cl', z: 17, massNumber: 37, charge: -1 })
const na23plus = q({ symbol: 'Na', z: 11, massNumber: 23, charge: 1 })
const s32 = q({ symbol: 'S', z: 16, massNumber: 32, charge: -2 }, 'ion')
const cl35 = q({ symbol: 'Cl', z: 17, massNumber: 35, charge: 0 }, 'hyphen')

const entry = (protons: number | string, neutrons: number | string, electrons: number | string) => ({
  protons: String(protons),
  neutrons: String(neutrons),
  electrons: String(electrons),
})

function boxPattern(g: AtomGrade, box: string): ErrorPatternId | undefined {
  return g.boxes.find((b) => b.box === box)?.pattern?.id
}

describe('particle helpers', () => {
  it('counts protons, neutrons and electrons', () => {
    expect(particleCounts(cl37minus.particle)).toEqual({ protons: 17, neutrons: 20, electrons: 18 })
    expect(particleCounts(na23plus.particle)).toEqual({ protons: 11, neutrons: 12, electrons: 10 })
    expect(particleFromCounts({ protons: 11, neutrons: 12, electrons: 10 })).toEqual({ symbol: 'Na', z: 11, massNumber: 23, charge: 1 })
  })

  it('writes charges and nuclear symbols the way chemists do', () => {
    expect([chargeText(0), chargeText(1), chargeText(-1), chargeText(2), chargeText(-3)]).toEqual(['', '+', '−', '2+', '3−'])
    expect(nuclearSymbolLatex(cl37minus.particle)).toBe('{}^{37}_{17}\\mathrm{Cl}^{-}')
    expect(nuclearSymbolLatex({ symbol: 'Mg', z: 12, massNumber: 24, charge: 2 })).toBe('{}^{24}_{12}\\mathrm{Mg}^{2+}')
    expect(nuclearSymbolLatex({ symbol: 'C', z: 6, massNumber: 14, charge: 0 })).toBe('{}^{14}_{6}\\mathrm{C}')
    expect(nuclearSymbolText(cl37minus.particle)).toBe('³⁷₁₇Cl⁻')
    expect(formulaText({ symbol: 'S', charge: -2 })).toBe('S²⁻')
  })

  it('reads a typed charge in every common spelling, and blank as neutral', () => {
    const ok = (t: string) => {
      const r = parseChargeText(t)
      return r.ok ? r.value : null
    }
    expect([ok('2-'), ok('2−'), ok('-2'), ok('+'), ok('-'), ok('−'), ok('3+'), ok('+1'), ok('1+'), ok(''), ok('0'), ok(' 2 - ')]).toEqual([
      -2, -2, -2, 1, -1, -1, 3, 1, 1, 0, 0, -2,
    ])
    expect(parseChargeText('2').ok).toBe(false)
    expect(parseChargeText('+-').ok).toBe(false)
    expect(parseChargeText('2x').ok).toBe(false)
  })

  it('reads whole numbers and symbols, refusing with a position', () => {
    expect(parseWholeNumber(' 20 ', 'empty')).toEqual({ ok: true, value: 20 })
    expect(parseWholeNumber('', 'Type the number of protons.')).toMatchObject({ ok: false, error: { message: 'Type the number of protons.' } })
    expect(parseWholeNumber('1.5', 'x')).toMatchObject({ ok: false, error: { position: 1 } })
    expect(parseWholeNumber('-3', 'x')).toMatchObject({ ok: false, error: { position: 0 } })
    const cl = parseSymbolText('cl')
    expect(cl.ok && cl.value.loose?.symbol).toBe('Cl')
    expect(cl.ok && cl.value.exact).toBeUndefined()
    const name = parseSymbolText('Sodium')
    expect(name.ok && name.value.byName?.symbol).toBe('Na')
    expect(parseSymbolText('Na+').ok).toBe(false)
  })

  it('turns a percent into a decimal without losing written digits', () => {
    expect(['75.76', '10.00', '7.59', '0.0115', '100', '99.9885'].map(percentToDecimalTextForTest)).toEqual([
      '0.7576',
      '0.1000',
      '0.0759',
      '0.000115',
      '1.00',
      '0.999885',
    ])
  })
})

describe('gradeParticles: named mistakes', () => {
  it('the right counts are right, with no pattern', () => {
    const g = gradeParticles(cl37minus, entry(17, 20, 18))
    expect(g.status).toBe('correct')
    expect(g.patterns).toEqual([])
    expect(g.message).toContain('17 protons, 20 neutrons and 18 electrons')
  })

  it('neutrons typed as the mass number: forgot to subtract Z', () => {
    const g = gradeParticles(cl37minus, entry(17, 37, 18))
    expect(g.status).toBe('wrong')
    expect(boxPattern(g, 'neutrons')).toBe('at_neutrons_as_mass_number')
    expect(g.boxes.find((b) => b.box === 'neutrons')!.message).toContain('37 is the mass number')
    expect(g.boxes.filter((b) => b.status === 'correct').map((b) => b.box)).toEqual(['protons', 'electrons'])
  })

  it('protons read from the mass number: swapped A and Z', () => {
    const g = gradeParticles(cl37minus, entry(37, 20, 18))
    expect(boxPattern(g, 'protons')).toBe('at_swapped_a_z')
    const hy = gradeParticles(cl35, entry(35, 18, 17))
    expect(boxPattern(hy, 'protons')).toBe('at_swapped_a_z')
    expect(hy.message).toContain('chlorine-35')
  })

  it('electrons equal to Z for an ion: ignored the charge', () => {
    expect(boxPattern(gradeParticles(cl37minus, entry(17, 20, 17)), 'electrons')).toBe('at_electrons_ignored_charge')
    expect(boxPattern(gradeParticles(na23plus, entry(11, 12, 11)), 'electrons')).toBe('at_electrons_ignored_charge')
    expect(boxPattern(gradeParticles(s32, entry(16, 16, 16)), 'electrons')).toBe('at_electrons_ignored_charge')
  })

  it('electrons with the charge sign flipped', () => {
    const cation = gradeParticles(na23plus, entry(11, 12, 12))
    expect(boxPattern(cation, 'electrons')).toBe('at_charge_sign_flipped')
    expect(cation.message).toContain('lost electrons')
    const anion = gradeParticles(s32, entry(16, 16, 14))
    expect(boxPattern(anion, 'electrons')).toBe('at_charge_sign_flipped')
    expect(anion.message).toContain('gained electrons')
  })

  it('protons changed for an ion: only electrons change', () => {
    const g = gradeParticles(na23plus, entry(10, 13, 10))
    expect(boxPattern(g, 'protons')).toBe('at_protons_changed_for_ion')
    // The neutrons follow from her proton count: a plain follow-through message, no second pattern.
    const n = g.boxes.find((b) => b.box === 'neutrons')!
    expect(n.pattern).toBeUndefined()
    expect(n.message).toContain('fits your proton count')
    expect(boxPattern(gradeParticles(s32, entry(18, 14, 18)), 'protons')).toBe('at_protons_changed_for_ion')
  })

  it('collects every distinct pattern, headline from the first', () => {
    const g = gradeParticles(cl37minus, entry(37, 37, 17))
    expect(g.patterns.map((p) => p.id)).toEqual(['at_swapped_a_z', 'at_neutrons_as_mass_number', 'at_electrons_ignored_charge'])
    expect(g.message).toBe(g.patterns[0]!.witness)
  })

  it('a wrong count that matches no named mistake gets a plain, specific message and no pattern', () => {
    const g = gradeParticles(cl37minus, entry(15, 22, 19))
    expect(g.status).toBe('wrong')
    expect(g.patterns).toEqual([])
    for (const b of g.boxes) {
      expect(b.status).toBe('wrong')
      expect(b.pattern).toBeUndefined()
      expect(b.message.length).toBeGreaterThan(10)
    }
    expect(g.boxes[0]!.message).toContain('atomic number')
    expect(gradeParticles(cl35, entry(17, 18, 16)).boxes[2]!.message).toContain('neutral atom')
  })

  it('an empty or unreadable box is a parse error: nothing else is graded', () => {
    const g = gradeParticles(cl37minus, entry(37, '', 'x'))
    expect(g.status).toBe('parse_error')
    expect(g.patterns).toEqual([])
    expect(g.boxes.map((b) => b.box)).toEqual(['neutrons', 'electrons'])
    expect(g.boxes[1]!.parseError?.position).toBe(0)
  })
})

describe('gradeParticles: every allowed particle', () => {
  // Every element Z 1..30 with its first stable-looking mass number (2Z or 2Z+1 is enough to exercise the arithmetic)
  // and each of its taught charges.
  const particles: AtomParticle[] = []
  for (const el of ELEMENTS.slice(0, 56)) {
    const A = el.z === 1 ? 1 : 2 * el.z + (el.z % 3)
    particles.push({ symbol: el.symbol, z: el.z, massNumber: A, charge: 0 })
    for (const c of el.commonCharges) if (el.z - c >= 0) particles.push({ symbol: el.symbol, z: el.z, massNumber: A, charge: c })
  }

  it('the right answer is always right, and each named mistake fires exactly when its number differs from the right one', () => {
    for (const particle of particles) {
      for (const shown of ['symbol', 'hyphen', 'ion'] as const) {
        const qq = q(particle, shown)
        const { protons: P, neutrons: N, electrons: E } = particleCounts(particle)
        const right = gradeParticles(qq, entry(P, N, E))
        expect(right.status, JSON.stringify(particle)).toBe('correct')
        expect(right.patterns).toEqual([])
        const A = particle.massNumber
        const c = particle.charge
        if (A !== N) expect(boxPattern(gradeParticles(qq, entry(P, A, E)), 'neutrons')).toBe('at_neutrons_as_mass_number')
        if (A !== P) expect(boxPattern(gradeParticles(qq, entry(A, N, E)), 'protons')).toBe('at_swapped_a_z')
        if (c !== 0) {
          expect(boxPattern(gradeParticles(qq, entry(P, N, P)), 'electrons')).toBe('at_electrons_ignored_charge')
          if (P + c >= 0) expect(boxPattern(gradeParticles(qq, entry(P, N, P + c)), 'electrons')).toBe('at_charge_sign_flipped')
          if (P - c !== A && P - c >= 0) expect(boxPattern(gradeParticles(qq, entry(P - c, N, E)), 'protons')).toBe('at_protons_changed_for_ion')
        }
      }
    }
  })
})

describe('explainParticles', () => {
  it('walks through Z, A − Z and Z − charge with her particle', () => {
    expect(explainParticles(cl37minus)).toEqual([
      'The atomic number is the lower number, 17, so chlorine has 17 protons. Every chlorine atom and ion has exactly 17.',
      'The mass number is the top number, 37. It counts protons and neutrons together, so neutrons = 37 − 17 = 20.',
      'Electrons = protons − charge = 17 − (−1) = 18. A 1− charge means 1 extra electron.',
    ])
    expect(explainParticles(na23plus)[2]).toBe('Electrons = protons − charge = 11 − 1 = 10. A 1+ charge means 1 electron lost.')
    expect(explainParticles(cl35)[0]).toContain('Chlorine is element 17 on the periodic table')
  })
})
