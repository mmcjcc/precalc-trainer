import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content'
import type { CbCheck, CovalentBondingAnswer } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import {
  answerLeaks,
  BOIL_PAIRS,
  CB_RESERVED_FORMULAS,
  CATCH_FORMULAS,
  CONTRAST_SALTS,
  DRAW_POOL,
  EN_PAIRS,
  FORCE_POOLS,
  MOLECULES,
  NONPOLAR_MOLECULES,
  POLAR_MOLECULES,
  POLARITY_EXCLUDED,
} from './facts'
import { canonicalCbAnswer, CB_MISTAKE_IDS, drawableFormulas, gradeCbStage, trapsForCb } from './grade'
import { BAND_TEXT, BEND_PULL, BEND_RIGHT, BEND_VANISH, BOND_TYPE_TEXT, CB_RULES, DUET_FILLER, DUET_OCTET, DUET_RIGHT, FORCE_TEXT, ORDER_TEXT, POLAR_TEXT, SHAPE_CHOICES } from './rules'
import { boilRight, boilSame, boilWrongs } from './sentences'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const TEMPLATES = ['cb.electrons', 'cb.dots', 'cb.shape', 'cb.polarity', 'cb.forces'] as const

function problem(templateId: string, seed: number) {
  const p = generateProblem('covalentBonding', templateId, seed)
  if (p.answer.type !== 'covalentBonding') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return { p, a: p.answer }
}

/** A one-part problem built straight from a check, for hand-worked grading. */
function hand(question: CovalentBondingAnswer['question'], check: CbCheck, label: string): CovalentBondingAnswer {
  const answerText = canonicalCbAnswer(check)
  const traps = trapsForCb(check)
  const choiceSets: Partial<Record<CbCheck['kind'], string[]>> = {
    'bond-type': Object.values(BOND_TYPE_TEXT),
    'bond-order': Object.values(ORDER_TEXT),
    'duet-why': [DUET_RIGHT, DUET_OCTET, DUET_FILLER].map((list) => list[(check as { variant?: number }).variant ?? 0]!),
    shape: [...SHAPE_CHOICES],
    'bend-why': [BEND_RIGHT, BEND_PULL, BEND_VANISH].map((list) => list[(check as { variant?: number }).variant ?? 0]!),
    'bond-class': Object.values(BAND_TEXT),
    'molecule-polar': Object.values(POLAR_TEXT),
    force: Object.values(FORCE_TEXT),
    boil: check.kind === 'boil' ? [boilRight(check.a, check.b), ...(boilSame(check.a, check.b) ? [boilSame(check.a, check.b)!] : []), ...boilWrongs(check.a, check.b)] : [],
  }
  const texts = choiceSets[check.kind]
  const choice = texts !== undefined && texts.length > 0
  const options = choice ? [...new Set([answerText, ...traps.map((trap) => trap.text), ...texts!])] : []
  return {
    type: 'covalentBonding',
    question,
    prompt: 'Hand worked, not shown to her.',
    stages: [
      {
        id: 'a',
        kind: choice ? 'choice' : 'text',
        label,
        hint: 'Type the answer for this part.',
        answerText,
        ...(choice ? { choices: options.map((text) => ({ id: text, text })) } : {}),
        nudge: 'Use the table, not a shortcut.',
        ruleCard: 'cb.bond',
        reveal: [`This part is worked by hand.`],
        traps,
        check,
      },
    ],
    expectedDisplay: `${label}: ${answerText}`,
    reveal: [`This part is worked by hand.`],
    ruleCards: ['cb.bond'],
  }
}

function mistake(answer: CovalentBondingAnswer, text: string) {
  const grade = gradeCbStage(answer, 'a', text)
  if (grade.verdict !== 'mistake') throw new Error(`${text} graded ${grade.verdict}`)
  return grade.mistake
}

/**
 * The shared leak rule plus the complete-listing rule: a surface that shows EVERY option of a
 * closed set (the five shapes, the five angles, the three bands...) singles out none.
 */
function leakFree(stage: CovalentBondingAnswer['stages'][number], surface: string, answer: string): boolean {
  if (!answerLeaks(surface, answer)) return true
  const options = stage.kind === 'choice' ? (stage.choices ?? []).map((c) => c.text) : stage.check.kind === 'angle' ? ['180', '120', '109.5', '107', '104.5'] : []
  return options.length >= 2 && options.every((option) => answerLeaks(surface, option))
}

describe('covalentBonding module registration', () => {
  it('is Chemistry, ordered after ionic bonding and before geometry, with five templates', () => {
    const m = getModule('covalentBonding')
    expect(m.subject).toBe('Chemistry')
    expect(m.title).toBe('Covalent bonding')
    expect(m.order).toBe(8.9)
    expect(m.order).toBeGreaterThan(getModule('ionicBonding').order)
    expect(m.order).toBeLessThan(getModule('geoSegments').order)
    const ids = MODULES.map((mod) => mod.id)
    expect(ids.indexOf('covalentBonding')).toBe(ids.indexOf('ionicBonding') + 1)
    expect(m.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(m.ruleCards.map((card) => card.id)).toEqual(CB_RULES.map((card) => card.id))
    expect(CB_RULES.map((card) => card.id)).toEqual(['cb.bond', 'cb.octet', 'cb.multiple', 'cb.vsepr', 'cb.bands', 'cb.polar', 'cb.forces'])
    const sample = generateProblem('covalentBonding', 'cb.electrons', 1)
    expect(m.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(m.nextStep(sample, null, false)).toBeNull()
  })

  it('has a catalog entry for every cb_ id', () => {
    for (const id of CB_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(0)
      expect(info.example).toContain('✗')
      expect(info.example).toContain('→')
    }
  })
})

describe('the molecule table, pinned row by row', () => {
  // Every field restated by hand from a drawn Lewis structure, NOT read back from facts.ts:
  // [formula, name, central or '', total valence electrons, shared pairs in the molecule,
  //  lone pairs on the central atom (-1 for a diatomic), bond order, unshared pairs in the
  //  molecule, shape ('' for a diatomic), angle ('' for a diatomic), bonds polar?, molecule
  //  polar?, force ('' for the three near-cutoff molecules excluded from force draws)]
  const ROWS: [string, string, string, number, number, number, number, number, string, string, boolean, boolean, string][] = [
    ['H2', 'hydrogen', '', 2, 1, -1, 1, 0, '', '', false, false, 'dispersion'],
    ['N2', 'nitrogen', '', 10, 3, -1, 3, 2, '', '', false, false, 'dispersion'],
    ['O2', 'oxygen', '', 12, 2, -1, 2, 4, '', '', false, false, 'dispersion'],
    ['F2', 'fluorine', '', 14, 1, -1, 1, 6, '', '', false, false, 'dispersion'],
    ['Cl2', 'chlorine', '', 14, 1, -1, 1, 6, '', '', false, false, 'dispersion'],
    ['Br2', 'bromine', '', 14, 1, -1, 1, 6, '', '', false, false, 'dispersion'],
    ['I2', 'iodine', '', 14, 1, -1, 1, 6, '', '', false, false, 'dispersion'],
    ['HF', 'hydrogen fluoride', '', 8, 1, -1, 1, 3, '', '', true, true, 'hbond'],
    ['HCl', 'hydrogen chloride', '', 8, 1, -1, 1, 3, '', '', true, true, 'dipole'],
    ['HBr', 'hydrogen bromide', '', 8, 1, -1, 1, 3, '', '', true, true, 'dipole'],
    ['CO', 'carbon monoxide', '', 10, 3, -1, 3, 2, '', '', true, true, 'dipole'],
    ['CO2', 'carbon dioxide', 'C', 16, 4, 0, 2, 4, 'Linear', '180', true, false, 'dispersion'],
    ['CS2', 'carbon disulfide', 'C', 16, 4, 0, 2, 4, 'Linear', '180', false, false, 'dispersion'],
    ['H2O', 'water', 'O', 8, 2, 2, 1, 2, 'Bent', '104.5', true, true, 'hbond'],
    ['H2S', 'hydrogen sulfide', 'S', 8, 2, 2, 1, 2, 'Bent', '104.5', false, false, ''],
    ['OF2', 'oxygen difluoride', 'O', 20, 2, 2, 1, 8, 'Bent', '104.5', true, true, 'dipole'],
    ['Cl2O', 'dichlorine monoxide', 'O', 20, 2, 2, 1, 8, 'Bent', '104.5', false, false, ''],
    ['NH3', 'ammonia', 'N', 8, 3, 1, 1, 1, 'Trigonal pyramidal', '107', true, true, 'hbond'],
    ['PH3', 'phosphine', 'P', 8, 3, 1, 1, 1, 'Trigonal pyramidal', '107', false, false, ''],
    ['PCl3', 'phosphorus trichloride', 'P', 26, 3, 1, 1, 10, 'Trigonal pyramidal', '107', true, true, 'dipole'],
    ['NCl3', 'nitrogen trichloride', 'N', 26, 3, 1, 1, 10, 'Trigonal pyramidal', '107', false, false, ''],
    ['CH4', 'methane', 'C', 8, 4, 0, 1, 0, 'Tetrahedral', '109.5', false, false, 'dispersion'],
    ['SiH4', 'silane', 'Si', 8, 4, 0, 1, 0, 'Tetrahedral', '109.5', false, false, 'dispersion'],
    ['CCl4', 'carbon tetrachloride', 'C', 32, 4, 0, 1, 12, 'Tetrahedral', '109.5', true, false, 'dispersion'],
    ['SiCl4', 'silicon tetrachloride', 'Si', 32, 4, 0, 1, 12, 'Tetrahedral', '109.5', true, false, 'dispersion'],
  ]

  it('holds exactly these 25 molecules, octet breakers excluded', () => {
    expect(MOLECULES.map((m) => m.formula)).toEqual(ROWS.map((row) => row[0]))
    for (const breaker of ['BF3', 'BeCl2', 'SF6', 'PCl5', 'NO', 'O3', 'C6H6']) {
      expect(MOLECULES.some((m) => m.formula === breaker)).toBe(false)
    }
  })

  it('every row matches the hand check, field by field', () => {
    for (const [formula, name, central, valence, shared, lonePairs, order, unshared, shape, angle, bondPolar, molPolar, force] of ROWS) {
      const m = MOLECULES.find((item) => item.formula === formula)!
      expect(m.name, formula).toBe(name)
      expect(m.central ?? '', formula).toBe(central)
      expect(m.bondOrder, formula).toBe(order)
      expect(canonicalCbAnswer({ kind: 'total-valence', formula }), formula).toBe(String(valence))
      expect(canonicalCbAnswer({ kind: 'shared-pairs', formula }), formula).toBe(String(shared))
      expect(canonicalCbAnswer({ kind: 'unshared-pairs', formula }), formula).toBe(String(unshared))
      if (central) {
        expect(canonicalCbAnswer({ kind: 'bonding-pairs', formula }), formula).toBe(String(shared))
        expect(canonicalCbAnswer({ kind: 'lone-pairs', formula }), formula).toBe(String(lonePairs))
        const bonded = m.atoms.reduce((sum, a) => sum + a.count, 0)
        expect(canonicalCbAnswer({ kind: 'shape', bonded, lone: lonePairs }), formula).toBe(shape)
        expect(canonicalCbAnswer({ kind: 'angle', bonded, lone: lonePairs }), formula).toBe(angle)
      } else {
        expect(canonicalCbAnswer({ kind: 'bond-order', formula }), formula).toBe({ 1: 'Single', 2: 'Double', 3: 'Triple' }[order])
        expect(canonicalCbAnswer({ kind: 'bond-electrons', formula }), formula).toBe(String(2 * order))
      }
      expect(canonicalCbAnswer({ kind: 'molecule-polar', formula }), formula).toBe(molPolar ? 'Polar' : 'Nonpolar')
      const pools = Object.entries(FORCE_POOLS).find(([, pool]) => pool.some((item) => item.formula === formula))?.[0] ?? ''
      expect(pools, formula).toBe(CB_RESERVED_FORMULAS.includes(formula) ? '' : force)
      // The bond-polarity column drives the polar-molecule rule; checked through the module's own reader.
      const bandRelevant = m.central ? [m.central, m.atoms[0]!.symbol] : m.atoms.length === 2 ? [m.atoms[0]!.symbol, m.atoms[1]!.symbol] : null
      if (bandRelevant && bandRelevant[0] !== bandRelevant[1]) {
        const diff = Number(canonicalCbAnswer({ kind: 'en-diff', a: bandRelevant[0]!, b: bandRelevant[1]! }))
        expect(diff >= 0.4, `${formula} bond polarity`).toBe(bondPolar)
      } else {
        expect(bondPolar, formula).toBe(false)
      }
    }
  })

  it('pins the brief’s own anchor rows', () => {
    expect(canonicalCbAnswer({ kind: 'total-valence', formula: 'H2O' })).toBe('8')
    expect(canonicalCbAnswer({ kind: 'bonding-pairs', formula: 'H2O' })).toBe('2')
    expect(canonicalCbAnswer({ kind: 'lone-pairs', formula: 'H2O' })).toBe('2')
    expect(canonicalCbAnswer({ kind: 'shape', bonded: 2, lone: 2 })).toBe('Bent')
    expect(canonicalCbAnswer({ kind: 'angle', bonded: 2, lone: 2 })).toBe('104.5')
    expect(canonicalCbAnswer({ kind: 'molecule-polar', formula: 'H2O' })).toBe('Polar')
    expect(canonicalCbAnswer({ kind: 'shape', bonded: 2, lone: 0 })).toBe('Linear')
    expect(canonicalCbAnswer({ kind: 'angle', bonded: 2, lone: 0 })).toBe('180')
    expect(canonicalCbAnswer({ kind: 'molecule-polar', formula: 'CO2' })).toBe('Nonpolar')
    expect(canonicalCbAnswer({ kind: 'bond-order', formula: 'N2' })).toBe('Triple')
    expect(canonicalCbAnswer({ kind: 'bond-electrons', formula: 'N2' })).toBe('6')
    expect(canonicalCbAnswer({ kind: 'shape', bonded: 3, lone: 1 })).toBe('Trigonal pyramidal')
    expect(canonicalCbAnswer({ kind: 'angle', bonded: 3, lone: 1 })).toBe('107')
    expect(canonicalCbAnswer({ kind: 'molecule-polar', formula: 'NH3' })).toBe('Polar')
    expect(canonicalCbAnswer({ kind: 'shape', bonded: 4, lone: 0 })).toBe('Tetrahedral')
    expect(canonicalCbAnswer({ kind: 'angle', bonded: 4, lone: 0 })).toBe('109.5')
    expect(canonicalCbAnswer({ kind: 'molecule-polar', formula: 'CH4' })).toBe('Nonpolar')
    expect(canonicalCbAnswer({ kind: 'en-diff', a: 'H', b: 'Cl' })).toBe('0.96')
    expect(canonicalCbAnswer({ kind: 'bond-class', a: 'H', b: 'Cl' })).toBe('Polar covalent')
    expect(canonicalCbAnswer({ kind: 'en-diff', a: 'C', b: 'H' })).toBe('0.35')
    expect(canonicalCbAnswer({ kind: 'bond-class', a: 'C', b: 'H' })).toBe('Nonpolar covalent')
    expect(canonicalCbAnswer({ kind: 'en-diff', a: 'Na', b: 'Cl' })).toBe('2.23')
    expect(canonicalCbAnswer({ kind: 'bond-class', a: 'Na', b: 'Cl' })).toBe('Ionic')
  })
})

describe('the electronegativity pairs, pinned', () => {
  // Hand-computed from Allred's values (trends.ts header): difference to the hundredth, then band.
  const PAIRS: [string, string, string, string][] = [
    ['C', 'H', '0.35', 'Nonpolar covalent'],
    ['N', 'Cl', '0.12', 'Nonpolar covalent'],
    ['C', 'S', '0.03', 'Nonpolar covalent'],
    ['C', 'I', '0.11', 'Nonpolar covalent'],
    ['O', 'Cl', '0.28', 'Nonpolar covalent'],
    ['Br', 'Cl', '0.20', 'Nonpolar covalent'],
    ['I', 'Br', '0.30', 'Nonpolar covalent'],
    ['H', 'Cl', '0.96', 'Polar covalent'],
    ['H', 'O', '1.24', 'Polar covalent'],
    ['H', 'N', '0.84', 'Polar covalent'],
    ['C', 'O', '0.89', 'Polar covalent'],
    ['C', 'Cl', '0.61', 'Polar covalent'],
    ['C', 'F', '1.43', 'Polar covalent'],
    ['Si', 'Cl', '1.26', 'Polar covalent'],
    ['P', 'Cl', '0.97', 'Polar covalent'],
    ['S', 'O', '0.86', 'Polar covalent'],
    ['H', 'I', '0.46', 'Polar covalent'],
    ['O', 'F', '0.54', 'Polar covalent'],
    ['Si', 'O', '1.54', 'Polar covalent'],
    ['Na', 'Cl', '2.23', 'Ionic'],
    ['K', 'Cl', '2.34', 'Ionic'],
    ['Li', 'F', '3.00', 'Ionic'],
    ['Na', 'F', '3.05', 'Ionic'],
    ['Mg', 'O', '2.13', 'Ionic'],
    ['Ca', 'Cl', '2.16', 'Ionic'],
    ['Li', 'Cl', '2.18', 'Ionic'],
    ['K', 'Br', '2.14', 'Ionic'],
    ['Ca', 'F', '2.98', 'Ionic'],
    ['Mg', 'Cl', '1.85', 'Ionic'],
    ['Na', 'Br', '2.03', 'Ionic'],
    ['K', 'O', '2.62', 'Ionic'],
  ]

  it('every drawable pair matches the hand check, and none sits on a cutoff', () => {
    expect(EN_PAIRS.map(([a, b]) => `${a}-${b}`)).toEqual(PAIRS.map(([a, b]) => `${a}-${b}`))
    for (const [a, b, diff, band] of PAIRS) {
      expect(canonicalCbAnswer({ kind: 'en-diff', a, b }), `${a}-${b}`).toBe(diff)
      expect(canonicalCbAnswer({ kind: 'en-diff', a: b, b: a }), `${b}-${a}`).toBe(diff)
      expect(canonicalCbAnswer({ kind: 'bond-class', a, b }), `${a}-${b}`).toBe(band)
      expect(Number(diff)).not.toBe(0.4)
      expect(Number(diff)).not.toBe(1.7)
    }
    // No pair spells a reserved molecule.
    for (const [a, b] of EN_PAIRS) {
      const key = [a, b].sort().join('-')
      expect(['Br-H', 'H-P', 'H-Si']).not.toContain(key)
    }
  })
})

describe('the draw pools, pinned', () => {
  it('reserved molecules are table rows that no pool contains', () => {
    expect(CB_RESERVED_FORMULAS).toEqual(['PH3', 'SiH4', 'HBr'])
    expect(drawableFormulas()).toHaveLength(22)
    for (const formula of CB_RESERVED_FORMULAS) {
      expect(MOLECULES.some((m) => m.formula === formula)).toBe(true)
      expect(DRAW_POOL.some((m) => m.formula === formula)).toBe(false)
    }
  })

  it('polarity and force pools hold exactly the molecules the taught rule decides cleanly', () => {
    expect(POLAR_MOLECULES.map((m) => m.formula).sort()).toEqual(['CO', 'H2O', 'HCl', 'HF', 'NH3', 'OF2', 'PCl3'])
    expect(NONPOLAR_MOLECULES.map((m) => m.formula).sort()).toEqual(['Br2', 'CH4', 'Cl2', 'F2', 'H2', 'I2', 'N2', 'O2', 'SiCl4'])
    expect(CATCH_FORMULAS).toEqual(['CO2', 'CS2', 'CCl4'])
    expect(POLARITY_EXCLUDED).toEqual(['H2S', 'NCl3', 'Cl2O'])
    expect(FORCE_POOLS.hbond.map((m) => m.formula).sort()).toEqual(['H2O', 'HF', 'NH3'])
    expect(FORCE_POOLS.dipole.map((m) => m.formula).sort()).toEqual(['CO', 'HCl', 'OF2', 'PCl3'])
    expect(FORCE_POOLS.dispersion.map((m) => m.formula).sort()).toEqual(['Br2', 'CCl4', 'CH4', 'CO2', 'CS2', 'Cl2', 'F2', 'H2', 'I2', 'N2', 'O2', 'SiCl4'])
    expect(CONTRAST_SALTS.map((s) => s.formula)).toEqual(['NaCl', 'KBr', 'CaO', 'MgCl2', 'LiF'])
    expect(BOIL_PAIRS.map((pair) => pair.higher)).toEqual(['H2O', 'HF', 'CO', 'Cl2', 'Br2', 'I2', 'Br2', 'I2', 'I2'])
  })
})

describe('hand-worked covalent-bonding answers', () => {
  it('counts, choices and traps from drawn structures', () => {
    const shared = hand('electrons', { kind: 'bond-type', subject: 'molecule', formula: 'H2O' }, 'The electrons')
    expect(shared.stages[0]!.answerText).toBe(BOND_TYPE_TEXT.shared)
    expect(mistake(shared, BOND_TYPE_TEXT.transferred)).toBe('cb_transfer_share')
    const salt = hand('electrons', { kind: 'bond-type', subject: 'salt', formula: 'NaCl' }, 'The electrons')
    expect(salt.stages[0]!.answerText).toBe(BOND_TYPE_TEXT.transferred)
    expect(mistake(salt, BOND_TYPE_TEXT.shared)).toBe('cb_transfer_share')

    const water = hand('electrons', { kind: 'total-valence', formula: 'H2O' }, 'Valence electrons')
    expect(water.stages[0]!.answerText).toBe('8')
    expect(gradeCbStage(water, 'a', '8 electrons').verdict).toBe('correct')
    expect(gradeCbStage(water, 'a', 'eight').verdict).toBe('invalid')
    expect(hand('electrons', { kind: 'total-valence', formula: 'CCl4' }, 'V').stages[0]!.answerText).toBe('32')

    const ammonia = hand('electrons', { kind: 'bonding-pairs', formula: 'NH3' }, 'Bonding pairs')
    expect(ammonia.stages[0]!.answerText).toBe('3')
    expect(mistake(ammonia, '1')).toBe('cb_pairs_swapped')
    expect(mistake(ammonia, '6')).toBe('cb_pairs_for_electrons')
    const ammoniaLone = hand('electrons', { kind: 'lone-pairs', formula: 'NH3' }, 'Lone pairs')
    expect(ammoniaLone.stages[0]!.answerText).toBe('1')
    expect(mistake(ammoniaLone, '3')).toBe('cb_pairs_swapped')
    // Equal counts leave no swapped slip to name: 2 bonding, 2 lone on water.
    const waterBp = hand('electrons', { kind: 'bonding-pairs', formula: 'H2O' }, 'Bonding pairs')
    expect(waterBp.stages[0]!.answerText).toBe('2')
    expect(waterBp.stages[0]!.traps.map((t) => t.id)).toEqual(['cb_pairs_for_electrons'])

    const nitrogen = hand('electrons', { kind: 'bond-order', formula: 'N2' }, 'The bond')
    expect(nitrogen.stages[0]!.answerText).toBe('Triple')
    expect(gradeCbStage(nitrogen, 'a', 'Double').verdict).toBe('wrong')
    const nitrogenElectrons = hand('electrons', { kind: 'bond-electrons', formula: 'N2' }, 'Electrons in that bond')
    expect(nitrogenElectrons.stages[0]!.answerText).toBe('6')
    expect(mistake(nitrogenElectrons, '3')).toBe('cb_pairs_for_electrons')
    const oxygenElectrons = hand('electrons', { kind: 'bond-electrons', formula: 'O2' }, 'E')
    expect(oxygenElectrons.stages[0]!.answerText).toBe('4')
    expect(mistake(oxygenElectrons, '2')).toBe('cb_pairs_for_electrons')

    const ccl4 = hand('dots', { kind: 'shared-pairs', formula: 'CCl4' }, 'Shared pairs')
    expect(ccl4.stages[0]!.answerText).toBe('4')
    expect(mistake(ccl4, '12')).toBe('cb_pairs_swapped')
    const ccl4Unshared = hand('dots', { kind: 'unshared-pairs', formula: 'CCl4' }, 'Unshared pairs')
    expect(ccl4Unshared.stages[0]!.answerText).toBe('12')
    expect(mistake(ccl4Unshared, '4')).toBe('cb_pairs_swapped')

    const hInMethane = hand('dots', { kind: 'atom-dots', formula: 'CH4', atom: 'H' }, 'Dots around H')
    expect(hInMethane.stages[0]!.answerText).toBe('2')
    expect(mistake(hInMethane, '8')).toBe('cb_h_octet')
    expect(hand('dots', { kind: 'atom-dots', formula: 'CH4', atom: 'C' }, 'Dots around C').stages[0]!.answerText).toBe('8')
    expect(hand('dots', { kind: 'atom-dots', formula: 'CO2', atom: 'O' }, 'Dots around O').stages[0]!.answerText).toBe('8')
    const duet = hand('dots', { kind: 'duet-why', variant: 0 }, 'Why hydrogen stops short')
    expect(duet.stages[0]!.answerText).toBe(DUET_RIGHT[0])
    expect(mistake(duet, DUET_OCTET[0]!)).toBe('cb_h_octet')
    expect(gradeCbStage(duet, 'a', DUET_FILLER[0]!).verdict).toBe('wrong')

    const pyramid = hand('shape', { kind: 'shape', bonded: 3, lone: 1 }, 'The shape')
    expect(pyramid.stages[0]!.answerText).toBe('Trigonal pyramidal')
    expect(mistake(pyramid, 'Tetrahedral')).toBe('cb_electron_groups_shape')
    const bent = hand('shape', { kind: 'shape', bonded: 2, lone: 2 }, 'The shape')
    expect(bent.stages[0]!.answerText).toBe('Bent')
    expect(mistake(bent, 'Tetrahedral')).toBe('cb_electron_groups_shape')
    expect(mistake(bent, 'Trigonal planar')).toBe('cb_electron_groups_shape')
    expect(gradeCbStage(bent, 'a', 'Linear').verdict).toBe('wrong')
    expect(hand('shape', { kind: 'shape', bonded: 3, lone: 0 }, 'S').stages[0]!.answerText).toBe('Trigonal planar')

    const pyramidAngle = hand('shape', { kind: 'angle', bonded: 3, lone: 1 }, 'The bond angle')
    expect(pyramidAngle.stages[0]!.answerText).toBe('107')
    expect(gradeCbStage(pyramidAngle, 'a', '107°').verdict).toBe('correct')
    expect(mistake(pyramidAngle, '120')).toBe('cb_angle_wrong_shape')
    expect(mistake(pyramidAngle, '109.5')).toBe('cb_angle_wrong_shape')
    const bentAngle = hand('shape', { kind: 'angle', bonded: 2, lone: 2 }, 'The bond angle')
    expect(bentAngle.stages[0]!.answerText).toBe('104.5')
    expect(gradeCbStage(bentAngle, 'a', '104.50 degrees').verdict).toBe('correct')
    expect(mistake(bentAngle, '109.5')).toBe('cb_angle_wrong_shape')
    expect(gradeCbStage(bentAngle, 'a', 'wide').verdict).toBe('invalid')

    const hcl = hand('polarity', { kind: 'en-diff', a: 'H', b: 'Cl' }, 'The difference')
    expect(hcl.stages[0]!.answerText).toBe('0.96')
    expect(gradeCbStage(hcl, 'a', '.96').verdict).toBe('correct')
    expect(gradeCbStage(hcl, 'a', '0.960').verdict).toBe('correct')
    expect(mistake(hcl, '-0.96')).toBe('cb_en_negative')
    expect(gradeCbStage(hcl, 'a', '0.69').verdict).toBe('wrong')

    const ch = hand('polarity', { kind: 'bond-class', a: 'C', b: 'H' }, 'The band')
    expect(ch.stages[0]!.answerText).toBe('Nonpolar covalent')
    expect(mistake(ch, 'Ionic')).toBe('cb_bands_flipped')
    const nacl = hand('polarity', { kind: 'bond-class', a: 'Na', b: 'Cl' }, 'The band')
    expect(nacl.stages[0]!.answerText).toBe('Ionic')
    expect(mistake(nacl, 'Nonpolar covalent')).toBe('cb_bands_flipped')
    const hclBand = hand('polarity', { kind: 'bond-class', a: 'H', b: 'Cl' }, 'The band')
    expect(hclBand.stages[0]!.answerText).toBe('Polar covalent')
    expect(gradeCbStage(hclBand, 'a', 'Ionic').verdict).toBe('wrong')
    expect(gradeCbStage(hclBand, 'a', 'Nonpolar covalent').verdict).toBe('wrong')

    const co2 = hand('polarity', { kind: 'molecule-polar', formula: 'CO2' }, 'The molecule')
    expect(co2.stages[0]!.answerText).toBe('Nonpolar')
    expect(mistake(co2, 'Polar')).toBe('cb_polar_because_bonds')
    const ccl4Polar = hand('polarity', { kind: 'molecule-polar', formula: 'CCl4' }, 'The molecule')
    expect(mistake(ccl4Polar, 'Polar')).toBe('cb_polar_because_bonds')
    const sicl4 = hand('polarity', { kind: 'molecule-polar', formula: 'SiCl4' }, 'The molecule')
    expect(mistake(sicl4, 'Polar')).toBe('cb_polar_because_bonds')
    // CS2's bonds pull almost equally, so 'Polar' is plain wrong there, not the named slip.
    const cs2 = hand('polarity', { kind: 'molecule-polar', formula: 'CS2' }, 'The molecule')
    expect(cs2.stages[0]!.answerText).toBe('Nonpolar')
    expect(gradeCbStage(cs2, 'a', 'Polar').verdict).toBe('wrong')
    const waterPolar = hand('polarity', { kind: 'molecule-polar', formula: 'H2O' }, 'The molecule')
    expect(waterPolar.stages[0]!.answerText).toBe('Polar')
    expect(gradeCbStage(waterPolar, 'a', 'Nonpolar').verdict).toBe('wrong')

    const methane = hand('forces', { kind: 'force', formula: 'CH4' }, 'The force')
    expect(methane.stages[0]!.answerText).toBe(FORCE_TEXT.dispersion)
    expect(mistake(methane, FORCE_TEXT.hbond)).toBe('cb_hbond_any_h')
    const hydrogen = hand('forces', { kind: 'force', formula: 'H2' }, 'The force')
    expect(mistake(hydrogen, FORCE_TEXT.hbond)).toBe('cb_hbond_any_h')
    const hclForce = hand('forces', { kind: 'force', formula: 'HCl' }, 'The force')
    expect(hclForce.stages[0]!.answerText).toBe(FORCE_TEXT.dipole)
    expect(mistake(hclForce, FORCE_TEXT.hbond)).toBe('cb_hbond_any_h')
    const waterForce = hand('forces', { kind: 'force', formula: 'H2O' }, 'The force')
    expect(waterForce.stages[0]!.answerText).toBe(FORCE_TEXT.hbond)
    const n2Force = hand('forces', { kind: 'force', formula: 'N2' }, 'The force')
    expect(n2Force.stages[0]!.answerText).toBe(FORCE_TEXT.dispersion)
    expect(gradeCbStage(n2Force, 'a', FORCE_TEXT.hbond).verdict).toBe('wrong')
    expect(n2Force.stages[0]!.traps).toEqual([])

    const boil = hand('forces', { kind: 'boil', a: 'H2O', b: 'H2S' }, 'Which boils higher')
    expect(boil.stages[0]!.answerText).toBe(boilRight('H2O', 'H2S'))
    expect(mistake(boil, boilSame('H2O', 'H2S')!)).toBe('cb_hbond_any_h')
    const sizeBoil = hand('forces', { kind: 'boil', a: 'F2', b: 'Br2' }, 'Which boils higher')
    expect(sizeBoil.stages[0]!.answerText).toContain('Br')
    expect(sizeBoil.stages[0]!.traps).toEqual([])
    const dipoleBoil = hand('forces', { kind: 'boil', a: 'N2', b: 'CO' }, 'Which boils higher')
    expect(dipoleBoil.stages[0]!.answerText).toBe(boilRight('N2', 'CO'))
    expect(gradeCbStage(dipoleBoil, 'a', '').verdict).toBe('invalid')
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, validates its own answers, and keeps the answer off the page she still acts on',
    () => {
      for (const seed of SEEDS) {
        const { p, a } = problem(templateId, seed)
        expect(generateProblem('covalentBonding', templateId, seed)).toEqual(p)
        expect(p.id).toBe(`covalentBonding/${templateId}@1/${seed.toString(36)}`)
        expect(p.kind).toBe('covalentBonding')
        expect(p.moduleId).toBe('covalentBonding')
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        expect(p.statementText).toBe(a.prompt)
        expect(a.stages.length).toBeGreaterThan(0)
        let trapPossible = false
        for (const stage of a.stages) {
          expect(gradeCbStage(a, stage.id, stage.answerText).verdict).toBe('correct')
          expect(stage.answerText).toBe(canonicalCbAnswer(stage.check))
          for (const alt of stage.accept ?? []) expect(gradeCbStage(a, stage.id, alt).verdict).toBe('correct')
          for (const trap of stage.traps) {
            trapPossible = true
            expect(trap.text).not.toBe(stage.answerText)
            const graded = gradeCbStage(a, stage.id, trap.text)
            expect(graded.verdict).toBe('mistake')
            if (graded.verdict === 'mistake') expect(graded.mistake).toBe(trap.id)
            expect(leakFree(stage, trap.witness, stage.answerText)).toBe(true)
          }
          expect(leakFree(stage, stage.hint, stage.answerText)).toBe(true)
          expect(leakFree(stage, stage.nudge, stage.answerText)).toBe(true)
          expect(leakFree(stage, a.prompt, stage.answerText)).toBe(true)
          if (stage.kind === 'choice') {
            expect(stage.choices!.map((c) => c.id)).toContain(stage.answerText)
          }
        }
        if (trapPossible) {
          expect(a.trap).toBeTruthy()
          expect(a.trapStage).toBeTruthy()
          expect(a.trapAnswer).toBeTruthy()
          const graded = gradeCbStage(a, a.trapStage!, a.trapAnswer!)
          expect(graded.verdict).toBe('mistake')
          if (graded.verdict === 'mistake') expect(graded.mistake).toBe(a.trap)
        } else {
          expect(a.trap).toBeUndefined()
        }
      }
    },
    HEAVY,
  )
})

describe('variety, coverage and distributions', () => {
  it(
    'each template shows at least 40 distinct statements over seeds 1..60',
    () => {
      for (const templateId of TEMPLATES) {
        const statements = new Set<string>()
        for (let seed = 1; seed <= 60; seed++) statements.add(problem(templateId, seed).a.prompt)
        expect(statements.size, templateId).toBeGreaterThanOrEqual(40)
      }
    },
    HEAVY,
  )

  it(
    'every cb_ id is the promised trap on some seed, and every promise is one of the stage’s traps',
    () => {
      const seen = new Set<string>()
      for (const templateId of TEMPLATES) {
        for (const seed of SEEDS) {
          const { a } = problem(templateId, seed)
          if (!a.trap) continue
          seen.add(a.trap)
          const stage = a.stages.find((item) => item.id === a.trapStage)!
          expect(stage.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer)).toBe(true)
        }
      }
      expect([...seen].sort()).toEqual([...CB_MISTAKE_IDS].sort())
    },
    HEAVY,
  )

  it(
    'every drawable molecule appears somewhere over 300 seeds, and no reserved molecule ever does',
    () => {
      const seenFormulas = new Set<string>()
      for (const templateId of TEMPLATES) {
        for (const seed of SEEDS) {
          const { a } = problem(templateId, seed)
          for (const word of ['PH₃', 'phosphine', 'SiH₄', 'silane', 'HBr', 'hydrogen bromide']) {
            expect(a.prompt.includes(word), `${templateId}/${seed} draws ${word}`).toBe(false)
          }
          for (const stage of a.stages) {
            const check = stage.check
            if (check.kind === 'bond-type') {
              if (check.subject === 'molecule') seenFormulas.add(check.formula)
            } else if (check.kind === 'boil') {
              seenFormulas.add(check.a)
              seenFormulas.add(check.b)
            } else if ('formula' in check) {
              seenFormulas.add(check.formula)
            }
          }
        }
      }
      for (const formula of CB_RESERVED_FORMULAS) expect(seenFormulas.has(formula), formula).toBe(false)
      for (const formula of drawableFormulas()) expect(seenFormulas.has(formula), formula).toBe(true)
    },
    HEAVY,
  )

  it(
    'the catch molecules are 25-45% of the polarity molecule part, and no correct choice passes 60%',
    () => {
      const byKind = new Map<string, Map<string, number>>()
      let catches = 0
      let molParts = 0
      for (const templateId of TEMPLATES) {
        for (const seed of SEEDS) {
          const { a } = problem(templateId, seed)
          for (const stage of a.stages) {
            if (stage.kind !== 'choice') continue
            const kind = stage.check.kind
            const tally = byKind.get(`${templateId} ${kind}`) ?? new Map<string, number>()
            tally.set(stage.answerText, (tally.get(stage.answerText) ?? 0) + 1)
            byKind.set(`${templateId} ${kind}`, tally)
            if (stage.check.kind === 'molecule-polar') {
              molParts++
              if (CATCH_FORMULAS.includes(stage.check.formula)) catches++
            }
          }
        }
      }
      expect(catches / molParts).toBeGreaterThanOrEqual(0.25)
      expect(catches / molParts).toBeLessThanOrEqual(0.45)
      for (const [where, tally] of byKind) {
        const total = [...tally.values()].reduce((x, y) => x + y, 0)
        for (const [text, count] of tally) {
          expect(count / total, `${where}: ${text}`).toBeLessThanOrEqual(0.6)
        }
      }
    },
    HEAVY,
  )
})
