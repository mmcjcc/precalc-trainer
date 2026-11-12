/**
 * Chapter 10, the mole: the substance table pinned against hand-worked values, the graders walked
 * by hand (every named slip from a typed value), and the four templates swept over 300 seeds each.
 * Every expected number below was worked by hand from the hundredths-rounded atomic masses and is
 * RESTATED here, never imported.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { getCourse, modulesInUnit } from '@/content/courses'
import type { MoCheck, MoleAnswer, MoStage } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import { equalsExampleNumber, gradeMoStage, MO_MISTAKE_IDS, modelFor, canonicalMoAnswer } from './grade'
import { gradeModel } from './numeric'
import { MO_RULE_FOR } from './rules'
import { atomicMassText, countsOf, DRAWABLE, formulaText, MO_RESERVED, MO_RESERVED_WORDS, molarMassText, SUBSTANCES, substanceOf } from './facts'

const HEAVY = 120_000
const SEEDS = 300
const TEMPLATES = ['mo.particles', 'mo.molarMass', 'mo.mass', 'mo.gas'] as const

function answerOf(templateId: string, seed: number): MoleAnswer {
  const p = generateProblem('moles', templateId, seed)
  if (p.answer.type !== 'mole') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return p.answer
}

/** One part built by hand around a check, graded the way the screen grades it. */
function part(check: MoCheck, kind: MoStage['kind'] = 'number'): MoleAnswer {
  const stage: MoStage = {
    id: 'a',
    kind,
    label: 'part',
    hint: '',
    answerText: canonicalMoAnswer(check),
    nudge: '',
    ruleCard: 'mo.roadMap',
    reveal: [],
    traps: [],
    check,
  }
  return { type: 'mole', question: 'mass', prompt: '', stages: [stage], expectedDisplay: '', reveal: [], ruleCards: [] }
}

function grade(check: MoCheck, typed: string) {
  return gradeMoStage(part(check), 'a', typed)
}

function verdictOf(check: MoCheck, typed: string): string {
  const g = grade(check, typed)
  return g.verdict === 'mistake' ? g.mistake : g.verdict
}

describe('registration', () => {
  it('registers both modules under chapter 10 with the mole kind and every card', () => {
    const chem = getCourse('chemistry')!
    const ch10 = chem.units.find((u) => u.id === 'ch10')!
    expect([ch10.label, ch10.title]).toEqual(['Chapter 10', 'The mole'])
    expect(modulesInUnit(ch10).map((m) => m.id)).toEqual(['moles', 'chemFormulas'])
    const mod = getModule('moles')
    expect(mod.subject).toBe('Chemistry')
    expect(mod.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(mod.ruleCards.map((c) => c.id)).toEqual(['mo.counting', 'mo.particle', 'mo.molarMass', 'mo.roadMap', 'cf.percent', 'cf.hydrate', 'cf.empirical', 'cf.molecular'])
    expect(generateProblem('moles', 'mo.particles', 1).kind).toBe('mole')
  })

  it('every mo_ id is in the catalog and is answered by exactly one card', () => {
    expect(MO_MISTAKE_IDS).toHaveLength(19)
    for (const id of MO_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length, id).toBeGreaterThan(5)
      expect(info.lesson.length, id).toBeGreaterThan(40)
      expect(info.example, id).toContain('✗ →')
      expect(MO_RULE_FOR[id], id).toBeTruthy()
    }
  })
})

describe('the substance table', () => {
  it('has forty rows whose formula text is derived from the pieces', () => {
    expect(SUBSTANCES).toHaveLength(40)
    expect(new Set(SUBSTANCES.map((s) => s.key)).size).toBe(40)
    for (const s of SUBSTANCES) expect(formulaText(s), s.key).toBe(s.key)
    expect(MO_RESERVED).toEqual(['Br2', 'Ca(OH)2', 'BaCl2·2H2O'])
    expect(DRAWABLE).toHaveLength(37)
  })

  it('rounds each printed atomic weight to the hundredths (restated)', () => {
    const want: Record<string, string> = {
      H: '1.01', He: '4.00', C: '12.01', N: '14.01', O: '16.00', F: '19.00', Na: '22.99', Mg: '24.31', Al: '26.98',
      P: '30.97', S: '32.06', Cl: '35.45', K: '39.10', Ca: '40.08', Fe: '55.85', Cu: '63.55', Br: '79.90', I: '126.90', Ba: '137.33',
    }
    for (const [symbol, text] of Object.entries(want)) expect(atomicMassText(symbol), symbol).toBe(text)
  })

  it('pins every molar mass, worked by hand from those masses', () => {
    const want: Record<string, string> = {
      C: '12.01', Fe: '55.85', Al: '26.98', Mg: '24.31', He: '4.00',
      H2: '2.02', N2: '28.02', O2: '32.00', F2: '38.00', Cl2: '70.90', Br2: '159.80', I2: '253.80',
      H2O: '18.02', CO2: '44.01', CO: '28.01', NH3: '17.04', CH4: '16.05', C2H6: '30.08', C3H8: '44.11',
      C6H12O6: '180.18', C12H22O11: '342.34', H2O2: '34.02', SO2: '64.06', C6H6: '78.12', C10H8: '128.18', C8H18: '114.26',
      NaCl: '58.44', CaCO3: '100.09', MgO: '40.31', Al2O3: '101.96', 'Ca(OH)2': '74.10', '(NH4)2SO4': '132.16', Fe2O3: '159.70',
      KNO3: '101.11', Na2CO3: '105.99', 'Mg3(PO4)2': '262.87',
      'CuSO4·5H2O': '249.71', 'MgSO4·7H2O': '246.51', 'Na2CO3·10H2O': '286.19', 'BaCl2·2H2O': '244.27',
    }
    expect(Object.keys(want).sort()).toEqual(SUBSTANCES.map((s) => s.key).sort())
    for (const s of SUBSTANCES) expect(molarMassText(s), s.key).toBe(want[s.key])
  })

  it('counts hydrate water into H and O and multiplies groups', () => {
    expect(countsOf(substanceOf('CuSO4·5H2O'))).toEqual([
      { symbol: 'Cu', n: 1 },
      { symbol: 'S', n: 1 },
      { symbol: 'O', n: 9 },
      { symbol: 'H', n: 10 },
    ])
    expect(countsOf(substanceOf('(NH4)2SO4'))).toEqual([
      { symbol: 'N', n: 2 },
      { symbol: 'H', n: 8 },
      { symbol: 'S', n: 1 },
      { symbol: 'O', n: 4 },
    ])
  })
})

describe('hand-worked conversions (restated)', () => {
  const cases: [string, MoCheck, string][] = [
    ['2.50 mol H2O is 1.51 × 10^24 molecules', { kind: 'convert', formula: 'H2O', from: 'mol', to: 'particles', given: '2.50' }, '1.51 x 10^24'],
    ['2.50 mol H2O holds 3.01 × 10^24 H atoms', { kind: 'convert', formula: 'H2O', from: 'mol', to: 'atoms', given: '2.50', atom: 'H' }, '3.01 x 10^24'],
    ['36.04 g H2O is 2.000 mol', { kind: 'convert', formula: 'H2O', from: 'g', to: 'mol', given: '36.04' }, '2.000'],
    ['11.2 L O2 at STP is 0.500 mol', { kind: 'convert', formula: 'O2', from: 'L', to: 'mol', given: '11.2' }, '0.500'],
    ['11.2 L O2 at STP is 16.0 g', { kind: 'convert', formula: 'O2', from: 'L', to: 'g', given: '11.2' }, '16.0'],
    ['0.250 mol CO2 is 11.0 g', { kind: 'convert', formula: 'CO2', from: 'mol', to: 'g', given: '0.250' }, '11.0'],
    ['10.0 g NaCl is 0.171 mol', { kind: 'convert', formula: 'NaCl', from: 'g', to: 'mol', given: '10.0' }, '0.171'],
    ['3.01 × 10^23 molecules is 0.500 mol', { kind: 'convert', formula: 'CO2', from: 'particles', to: 'mol', given: '3.01 x 10^23' }, '0.500'],
    ['5.00 g H2O is 1.67 × 10^23 molecules', { kind: 'convert', formula: 'H2O', from: 'g', to: 'particles', given: '5.00' }, '1.67 x 10^23'],
    ['44.8 L CH4 at STP is 2.00 mol', { kind: 'convert', formula: 'CH4', from: 'L', to: 'mol', given: '44.8' }, '2.00'],
    ['2.00 mol N2 at STP fills 44.8 L', { kind: 'convert', formula: 'N2', from: 'mol', to: 'L', given: '2.00' }, '44.8'],
    ['4.00 g He is 1.00 mol', { kind: 'convert', formula: 'He', from: 'g', to: 'mol', given: '4.00' }, '1.00'],
    ['0.500 mol CaCO3 is 50.0 g', { kind: 'convert', formula: 'CaCO3', from: 'mol', to: 'g', given: '0.500' }, '50.0'],
    ['1.204 × 10^24 O atoms is 0.9997 mol CO2', { kind: 'convert', formula: 'CO2', from: 'atoms', to: 'mol', given: '1.204 x 10^24', atom: 'O' }, '0.9997'],
    ['25.0 g NaCl is 2.58 × 10^23 formula units', { kind: 'convert', formula: 'NaCl', from: 'g', to: 'particles', given: '25.0' }, '2.58 x 10^23'],
    ['1.50 × 10^24 molecules of CH4 weigh 40.0 g', { kind: 'convert', formula: 'CH4', from: 'particles', to: 'g', given: '1.50 x 10^24' }, '40.0'],
    ['88.0 g CO2 fills 44.8 L at STP', { kind: 'convert', formula: 'CO2', from: 'g', to: 'L', given: '88.0' }, '44.8'],
    ['water is 11.21% H', { kind: 'percent', formula: 'H2O', element: 'H', place: -2 }, '11.21'],
    ['water is 88.79% O', { kind: 'percent', formula: 'H2O', element: 'O', place: -2 }, '88.79'],
    ['CO2 is 27.3% C', { kind: 'percent', formula: 'CO2', element: 'C', place: -1 }, '27.3'],
    ['NH3 is 82.22% N', { kind: 'percent', formula: 'NH3', element: 'N', place: -2 }, '82.22'],
    ['CuSO4·5H2O is 36.08% water', { kind: 'percent-water', formula: 'CuSO4·5H2O', place: -2 }, '36.08'],
    ['MgSO4·7H2O is 51.2% water', { kind: 'percent-water', formula: 'MgSO4·7H2O', place: -1 }, '51.2'],
    ['2.50 g Fe with 1.07 g O is 70.0% Fe', { kind: 'percent-sample', parts: [{ symbol: 'Fe', grams: '2.50' }, { symbol: 'O', grams: '1.07' }], element: 'Fe' }, '70.0'],
    ['40.0 g C is 3.33 mol C', { kind: 'element-moles', symbol: 'C', grams: '40.0' }, '3.33'],
  ]
  for (const [name, check, want] of cases) {
    it(name, () => {
      expect(canonicalMoAnswer(check)).toBe(want)
      expect(grade(check, want).verdict).toBe('correct')
    })
  }

  it('formulas: CH2O, then C6H12O6; Fe2O3; C3H8 from its percents', () => {
    const glucose = [
      { symbol: 'C', amount: '40.0' },
      { symbol: 'H', amount: '6.7' },
      { symbol: 'O', amount: '53.3' },
    ]
    expect(canonicalMoAnswer({ kind: 'empirical', data: glucose, basis: 'percent' })).toBe('C=1;H=2;O=1')
    const ch2o = [
      { symbol: 'C', n: 1 },
      { symbol: 'H', n: 2 },
      { symbol: 'O', n: 1 },
    ]
    expect(canonicalMoAnswer({ kind: 'formula-mass', counts: ch2o })).toBe('30.03')
    expect(canonicalMoAnswer({ kind: 'multiplier', counts: ch2o, molarMass: '180.18' })).toBe('6')
    expect(canonicalMoAnswer({ kind: 'molecular', counts: ch2o, molarMass: '180.18' })).toBe('C=6;H=12;O=6')
    const rust = [
      { symbol: 'Fe', amount: '2.50' },
      { symbol: 'O', amount: '1.07' },
    ]
    expect(canonicalMoAnswer({ kind: 'empirical', data: rust, basis: 'mass' })).toBe('Fe=2;O=3')
    const propane = [
      { symbol: 'C', amount: '81.7' },
      { symbol: 'H', amount: '18.3' },
    ]
    expect(canonicalMoAnswer({ kind: 'empirical', data: propane, basis: 'percent' })).toBe('C=3;H=8')
  })
})

describe('hand-worked named mistakes (each from a typed value)', () => {
  const water: MoCheck = { kind: 'convert', formula: 'H2O', from: 'mol', to: 'particles', given: '2.50' }
  it('Avogadro: divided where she should multiply, and the reverse', () => {
    expect(verdictOf(water, '4.15 x 10^-24')).toBe('mo_avogadro_inverted')
    expect(verdictOf({ kind: 'convert', formula: 'CO2', from: 'particles', to: 'mol', given: '3.01 x 10^23' }, '1.81 x 10^47')).toBe('mo_avogadro_inverted')
  })
  it('atoms asked, molecules given; stopped at moles', () => {
    expect(verdictOf({ kind: 'convert', formula: 'H2O', from: 'mol', to: 'atoms', given: '2.50', atom: 'H' }, '1.51 x 10^24')).toBe('mo_molecules_for_atoms')
    expect(verdictOf({ kind: 'convert', formula: 'H2O', from: 'g', to: 'particles', given: '5.00' }, '0.277')).toBe('mo_stopped_at_moles')
    expect(verdictOf({ kind: 'convert', formula: 'O2', from: 'L', to: 'g', given: '11.2' }, '0.500')).toBe('mo_stopped_at_moles')
  })
  it('molar mass inverted, atomic mass for the compound, one O for O2, the hydrate water', () => {
    // 36.04 × 18.02 = 649.4408 → 649.4
    expect(verdictOf({ kind: 'convert', formula: 'H2O', from: 'g', to: 'mol', given: '36.04' }, '649.4')).toBe('mo_molar_mass_inverted')
    // 10.0 ÷ 22.99 = 0.43497 → 0.435 (sodium alone)
    expect(verdictOf({ kind: 'convert', formula: 'NaCl', from: 'g', to: 'mol', given: '10.0' }, '0.435')).toBe('mo_atomic_mass_for_molar')
    // 2.00 mol O2 weighed as 16.00: 32.0
    expect(verdictOf({ kind: 'convert', formula: 'O2', from: 'mol', to: 'g', given: '2.00' }, '32.0')).toBe('mo_diatomic_single')
    // 1.00 mol CuSO4·5H2O without water: 159.61 → 160.
    expect(verdictOf({ kind: 'convert', formula: 'CuSO4·5H2O', from: 'mol', to: 'g', given: '1.00' }, '160.')).toBe('mo_hydrate_water_left_out')
  })
  it('molar masses: subscripts, parentheses, pairs, waters; ±0.02 accepted', () => {
    const mm = (formula: string): MoCheck => ({ kind: 'molar-mass', formula })
    expect(verdictOf(mm('H2O'), '18.02')).toBe('correct')
    expect(verdictOf(mm('H2O'), '18.01')).toBe('correct')
    expect(verdictOf(mm('H2O'), '18.04')).toBe('correct')
    expect(verdictOf(mm('H2O'), '18.05')).toBe('wrong')
    expect(verdictOf(mm('H2O'), '18.0')).toBe('wrong')
    expect(grade(mm('H2O'), '18.0').message).toContain('hundredths')
    expect(verdictOf(mm('H2O'), '17.01')).toBe('mo_subscripts_ignored')
    expect(verdictOf(mm('O2'), '16.00')).toBe('mo_diatomic_single')
    // (NH4)2SO4 with only the N doubled: 28.02 + 4.04 + 32.06 + 64.00 = 128.12
    expect(verdictOf(mm('(NH4)2SO4'), '128.12')).toBe('mo_paren_first_only')
    expect(verdictOf(mm('CuSO4·5H2O'), '159.61')).toBe('mo_hydrate_water_left_out')
    expect(verdictOf(mm('CuSO4·5H2O'), '177.63')).toBe('mo_hydrate_water_once')
    // Sucrose with the unrounded weights: 342.30, not 342.34 — a plain pointer to the rounding rule.
    expect(verdictOf(mm('C12H22O11'), '342.30')).toBe('wrong')
    expect(grade(mm('C12H22O11'), '342.30').message).toContain('rounds each atomic mass')
    expect(verdictOf(mm('H2O'), 'eighteen')).toBe('invalid')
  })
  it('22.4 inverted; percent by count and from one atom; part over part', () => {
    // 11.2 × 22.4 = 250.88 → 251
    expect(verdictOf({ kind: 'convert', formula: 'O2', from: 'L', to: 'mol', given: '11.2' }, '251')).toBe('mo_molar_volume_inverted')
    expect(verdictOf({ kind: 'percent', formula: 'H2O', element: 'H', place: -1 }, '66.7')).toBe('mo_percent_by_count')
    expect(verdictOf({ kind: 'percent', formula: 'H2O', element: 'H', place: -1 }, '5.6')).toBe('mo_percent_one_atom')
    // 2.50 ÷ 1.07 × 100 = 233.6 → 234
    expect(verdictOf({ kind: 'percent-sample', parts: [{ symbol: 'Fe', grams: '2.50' }, { symbol: 'O', grams: '1.07' }], element: 'Fe' }, '234')).toBe('mo_percent_part_over_part')
  })
  it('empirical and molecular slips', () => {
    const glucose: MoCheck = {
      kind: 'empirical',
      data: [
        { symbol: 'C', amount: '40.0' },
        { symbol: 'H', amount: '6.7' },
        { symbol: 'O', amount: '53.3' },
      ],
      basis: 'percent',
    }
    expect(verdictOf(glucose, 'C=6;H=1;O=8')).toBe('mo_mass_ratio_as_mole_ratio')
    expect(verdictOf(glucose, 'C=2;H=4;O=2')).toBe('wrong')
    expect(verdictOf(glucose, 'C=1;H=;O=1')).toBe('invalid')
    const rust: MoCheck = {
      kind: 'empirical',
      data: [
        { symbol: 'Fe', amount: '2.50' },
        { symbol: 'O', amount: '1.07' },
      ],
      basis: 'mass',
    }
    expect(verdictOf(rust, 'Fe=1;O=1')).toBe('mo_ratio_rounded')
    expect(verdictOf(rust, 'Fe=1;O=2')).toBe('mo_ratio_rounded')
    const ch2o = [
      { symbol: 'C', n: 1 },
      { symbol: 'H', n: 2 },
      { symbol: 'O', n: 1 },
    ]
    expect(verdictOf({ kind: 'molecular', counts: ch2o, molarMass: '180.18' }, 'C=1;H=2;O=1')).toBe('mo_empirical_as_molecular')
    expect(verdictOf({ kind: 'molecular', counts: ch2o, molarMass: '180.18' }, 'C=6;H=6;O=6')).toBe('mo_empirical_as_molecular')
  })
  it('right value with the wrong figures gets the sig-fig engine’s own id or note, never a mo_ id', () => {
    const g1 = grade({ kind: 'convert', formula: 'H2O', from: 'g', to: 'mol', given: '36.04' }, '2')
    expect(g1.verdict).toBe('mistake')
    if (g1.verdict === 'mistake') expect(g1.mistake.startsWith('sf_')).toBe(true)
    const g2 = grade(water, '1.5055 x 10^24')
    expect(g2.verdict === 'mistake' ? g2.mistake.startsWith('sf_') : g2.verdict === 'wrong').toBe(true)
    const g3 = grade(water, '15.1 x 10^23')
    expect(g3.verdict).toBe('correct')
    if (g3.verdict === 'correct') expect(g3.note).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// The 300-seed sweeps
// ---------------------------------------------------------------------------

const CACHE = new Map<string, MoleAnswer[]>()
function sweep(templateId: string): MoleAnswer[] {
  if (!CACHE.has(templateId)) CACHE.set(templateId, Array.from({ length: SEEDS }, (_, i) => answerOf(templateId, i + 1)))
  return CACHE.get(templateId)!
}

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, re-grades its own answers, and every trap grades to exactly its id',
    () => {
      const answers = sweep(templateId)
      for (let i = 0; i < SEEDS; i += 37) expect(JSON.stringify(answerOf(templateId, i + 1))).toBe(JSON.stringify(answers[i]))
      for (const a of answers) {
        expect(JSON.parse(JSON.stringify(a))).toEqual(a)
        for (const stage of a.stages) {
          const model = modelFor(stage.check)
          expect(gradeModel(model, stage, stage.answerText).verdict).toBe('correct')
          for (const trap of stage.traps) {
            const g = gradeModel(model, stage, trap.text)
            expect(g.verdict === 'mistake' && g.mistake).toBe(trap.id)
          }
          expect(equalsExampleNumber(stage)).toBe(false)
        }
        if (a.trap) {
          const g = gradeMoStage(a, a.trapStage!, a.trapAnswer!)
          expect(g.verdict === 'mistake' && g.mistake).toBe(a.trap)
        }
        for (const word of MO_RESERVED_WORDS) expect(a.prompt.includes(word)).toBe(false)
      }
    },
    HEAVY,
  )

  it(
    'varies: at least 45 distinct statements over seeds 1..60',
    () => {
      const statements = new Set(sweep(templateId).slice(0, 60).map((a) => a.prompt))
      expect(statements.size).toBeGreaterThanOrEqual(45)
    },
    HEAVY,
  )

  it(
    'no correct choice is more than 60% of any choice part',
    () => {
      const tallies = new Map<string, Map<string, number>>()
      for (const a of sweep(templateId)) {
        for (const stage of a.stages) {
          if (stage.kind !== 'choice') continue
          const key = `${stage.check.kind}`
          const t = tallies.get(key) ?? new Map<string, number>()
          t.set(stage.answerText, (t.get(stage.answerText) ?? 0) + 1)
          tallies.set(key, t)
        }
      }
      for (const [key, t] of tallies) {
        const total = [...t.values()].reduce((s, n) => s + n, 0)
        for (const [choice, n] of t) expect(n / total, `${key} ${choice}`).toBeLessThanOrEqual(0.6)
      }
    },
    HEAVY,
  )

  it(
    'each direction of each conversion factor is 30-70% of its uses',
    () => {
      // factor → [multiplies, divides]
      const uses = new Map<string, [number, number]>()
      const bump = (factor: string, multiply: boolean) => {
        const u = uses.get(factor) ?? [0, 0]
        u[multiply ? 0 : 1]++
        uses.set(factor, u)
      }
      for (const a of sweep(templateId)) {
        for (const stage of a.stages) {
          const c = stage.check
          if (c.kind !== 'convert') continue
          const route = `${c.from}>${c.to}`
          if (['mol>particles', 'mol>atoms', 'g>particles'].includes(route)) bump('avogadro', true)
          if (['particles>mol', 'atoms>mol', 'particles>g'].includes(route)) bump('avogadro', false)
          if (['mol>g', 'particles>g', 'L>g'].includes(route)) bump('molar mass', true)
          if (['g>mol', 'g>particles', 'g>L'].includes(route)) bump('molar mass', false)
          if (['mol>L', 'g>L'].includes(route)) bump('molar volume', true)
          if (['L>mol', 'L>g'].includes(route)) bump('molar volume', false)
        }
      }
      // mo.molarMass converts nothing; every other moles template does.
      expect(uses.size > 0).toBe(templateId !== 'mo.molarMass')
      for (const [factor, [mul, div]] of uses) {
        const share = mul / (mul + div)
        expect(share, `${factor} multiplies ${mul} of ${mul + div}`).toBeGreaterThanOrEqual(0.3)
        expect(share, `${factor} multiplies ${mul} of ${mul + div}`).toBeLessThanOrEqual(0.7)
      }
    },
    HEAVY,
  )
})

describe('coverage across the moles templates', () => {
  it(
    'promises a trap on most seeds, and the reserved substances are never drawn',
    () => {
      for (const templateId of TEMPLATES) {
        const answers = sweep(templateId)
        const promised = answers.filter((a) => a.trap).length
        expect(promised / SEEDS, templateId).toBeGreaterThan(0.9)
        for (const a of answers) for (const stage of a.stages) if ('formula' in stage.check) expect(MO_RESERVED).not.toContain(stage.check.formula)
      }
    },
    HEAVY,
  )

  it(
    'promises every moles slip somewhere',
    () => {
      const promised = new Set(TEMPLATES.flatMap((t) => sweep(t).map((a) => a.trap)).filter(Boolean))
      for (const id of [
        'mo_particle_kind',
        'mo_avogadro_inverted',
        'mo_molecules_for_atoms',
        'mo_stopped_at_moles',
        'mo_molar_mass_inverted',
        'mo_atomic_mass_for_molar',
        'mo_subscripts_ignored',
        'mo_paren_first_only',
        'mo_diatomic_single',
        'mo_hydrate_water_left_out',
        'mo_hydrate_water_once',
        'mo_molar_volume_inverted',
        'mo_stp_misapplied',
      ]) {
        expect(promised.has(id as never), id).toBe(true)
      }
    },
    HEAVY,
  )
})
