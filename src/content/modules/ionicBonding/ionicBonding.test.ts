import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content'
import type { IbCheck, IonicBondingAnswer } from '@/content/types'
import { ERROR_PATTERNS, ionicPairProblem, valenceElectrons } from '@/engine'
import { answerLeaks, DOTS_ION_POOL, DOTS_NEUTRAL_POOL, RESERVED_FORMULAS, SEA_METALS, TRANSFER_METALS, TRANSFER_NONMETALS, TRANSFER_PAIRS, VALENCE_POOL } from './facts'
import { canonicalIbAnswer, gradeIbStage, IB_MISTAKE_IDS, IB_REUSED_MISTAKE_IDS, trapsForIb } from './grade'
import { DOTS_STAND_TEXT, GAIN_LOSE_TEXT, IB_RULES, PROPS_WRONG, SEA_WRONG } from './rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const TEMPLATES = ['ib.valence', 'ib.dots', 'ib.transfer', 'ib.props', 'mb.sea'] as const

function problem(templateId: string, seed: number) {
  const p = generateProblem('ionicBonding', templateId, seed)
  if (p.answer.type !== 'ionicBonding') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return { p, a: p.answer }
}

function hand(question: IonicBondingAnswer['question'], check: IbCheck, label: string): IonicBondingAnswer {
  const answerText = canonicalIbAnswer(check)
  const traps = trapsForIb(check)
  const choice = check.kind === 'gain-lose' || check.kind === 'dots-stand' || check.kind === 'props' || check.kind === 'sea'
  const texts = choice
    ? [
        ...new Set([
          answerText,
          ...traps.map((trap) => trap.text),
          ...(check.kind === 'gain-lose' ? Object.values(GAIN_LOSE_TEXT) : []),
          ...(check.kind === 'dots-stand' ? Object.values(DOTS_STAND_TEXT) : []),
          ...(check.kind === 'props' ? Object.values(PROPS_WRONG) : []),
          ...(check.kind === 'sea' ? Object.values(SEA_WRONG) : []),
        ]),
      ]
    : []
  return {
    type: 'ionicBonding',
    question,
    prompt: 'Hand worked, not shown to her.',
    stages: [
      {
        id: 'a',
        kind: choice ? 'choice' : 'text',
        label,
        hint: 'Type the answer for this part.',
        answerText,
        ...(choice ? { choices: texts.map((text) => ({ id: text, text })) } : {}),
        nudge: 'Use the table, not a shortcut.',
        ruleCard: 'ib.octet',
        reveal: [`The answer is ${answerText}.`],
        traps,
        check,
      },
    ],
    expectedDisplay: `${label}: ${answerText}`,
    reveal: [`The answer is ${answerText}.`],
    ruleCards: ['ib.octet'],
  }
}

function mistake(answer: IonicBondingAnswer, text: string) {
  const grade = gradeIbStage(answer, 'a', text)
  if (grade.verdict !== 'mistake') throw new Error(`${text} graded ${grade.verdict}`)
  return grade.mistake
}

describe('ionicBonding module registration', () => {
  it('is Chemistry, ordered after the nomenclature modules and before geometry, with five templates', () => {
    const m = getModule('ionicBonding')
    expect(m.subject).toBe('Chemistry')
    expect(m.title).toBe('Ionic and metallic bonding')
    expect(m.order).toBe(8.8)
    expect(m.order).toBeGreaterThan(getModule('molecularAcids').order)
    expect(m.order).toBeLessThan(getModule('geoSegments').order)
    const ids = MODULES.map((mod) => mod.id)
    expect(ids.indexOf('ionicBonding')).toBe(ids.indexOf('molecularAcids') + 1)
    expect(m.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(m.ruleCards.map((card) => card.id)).toEqual(IB_RULES.map((card) => card.id))
    const sample = generateProblem('ionicBonding', 'ib.valence', 1)
    expect(m.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(m.nextStep(sample, null, false)).toBeNull()
  })

  it('has a catalog entry for every minted and reused id', () => {
    for (const id of [...IB_MISTAKE_IDS, ...IB_REUSED_MISTAKE_IDS]) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(0)
      expect(info.example).toContain('✗')
      expect(info.example).toContain('→')
    }
  })
})

describe('the draw pools', () => {
  it('holds exactly the clean single-charge noble-gas elements, H and the messy ones excluded', () => {
    expect(VALENCE_POOL.map((el) => el.symbol)).toEqual(['Li', 'Be', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'P', 'S', 'Cl', 'K', 'Ca', 'Br'])
    expect(DOTS_ION_POOL.map((el) => el.symbol)).toEqual([
      'Li', 'Be', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'P', 'S', 'Cl', 'K', 'Ca', 'Br', 'Rb', 'Sr', 'I', 'Cs', 'Ba',
    ])
    expect(TRANSFER_METALS.map((el) => el.symbol)).toEqual(['Li', 'Be', 'Na', 'Mg', 'Al', 'K', 'Ca', 'Rb', 'Sr', 'Cs', 'Ba'])
    expect(TRANSFER_NONMETALS.map((el) => el.symbol)).toEqual(['N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I'])
    const neutral = DOTS_NEUTRAL_POOL.map((el) => el.symbol)
    expect(neutral).not.toContain('H')
    expect(neutral).not.toContain('He')
    expect(neutral).toContain('Ne')
    expect(neutral).toContain('Kr')
    expect(SEA_METALS).not.toContain('mercury')
  })

  it('every drawable pair is a compound of the nomenclature model, catalog examples reserved', () => {
    expect(TRANSFER_PAIRS.length).toBe(TRANSFER_METALS.length * TRANSFER_NONMETALS.length - RESERVED_FORMULAS.length)
    for (const { metal, nonmetal } of TRANSFER_PAIRS) {
      const cat = `${metal.symbol}^${Math.abs(metal.commonCharges[0]!) === 1 ? '' : Math.abs(metal.commonCharges[0]!)}+`
      const an = `${nonmetal.symbol}^${Math.abs(nonmetal.commonCharges[0]!) === 1 ? '' : Math.abs(nonmetal.commonCharges[0]!)}-`
      expect(ionicPairProblem(cat, an), `${metal.symbol} + ${nonmetal.symbol}`).toBeNull()
      expect(RESERVED_FORMULAS).not.toContain(canonicalIbAnswer({ kind: 'formula', cationZ: metal.z, anionZ: nonmetal.z }))
    }
  })

  it('valence counts agree with the econfig engine for every pooled element', () => {
    for (const el of VALENCE_POOL) {
      const check: IbCheck = { kind: 'valence', z: el.z }
      expect(canonicalIbAnswer(check), el.symbol).toBe(String(valenceElectrons(el.symbol)))
    }
  })
})

describe('hand-worked ionic-bonding answers', () => {
  it('counts, directions, ions, configurations, ratios, formulas and transfers from the tables', () => {
    const sulfur = hand('valence', { kind: 'valence', z: 16 }, 'Valence electrons')
    expect(sulfur.stages[0]!.answerText).toBe('6')
    expect(gradeIbStage(sulfur, 'a', '6 electrons').verdict).toBe('correct')
    expect(gradeIbStage(sulfur, 'a', 'six').verdict).toBe('invalid')

    const bromine = hand('valence', { kind: 'valence', z: 35 }, 'Valence electrons')
    expect(bromine.stages[0]!.answerText).toBe('7')
    expect(mistake(bromine, '17')).toBe('ib_valence_dblock')

    const sodiumWay = hand('valence', { kind: 'gain-lose', z: 11 }, 'Which way')
    expect(sodiumWay.stages[0]!.answerText).toBe(GAIN_LOSE_TEXT.lose)
    expect(mistake(sodiumWay, GAIN_LOSE_TEXT.gain)).toBe('ib_gain_lose')
    const oxygenWay = hand('valence', { kind: 'gain-lose', z: 8 }, 'Which way')
    expect(oxygenWay.stages[0]!.answerText).toBe(GAIN_LOSE_TEXT.gain)
    expect(mistake(oxygenWay, GAIN_LOSE_TEXT.lose)).toBe('ib_gain_lose')

    expect(hand('valence', { kind: 'move-count', z: 13 }, 'Moved').stages[0]!.answerText).toBe('3')
    expect(hand('valence', { kind: 'move-count', z: 7 }, 'Moved').stages[0]!.answerText).toBe('3')

    const magnesium = hand('valence', { kind: 'ion', z: 12 }, 'The ion')
    expect(magnesium.stages[0]!.answerText).toBe('Mg^2+')
    expect(gradeIbStage(magnesium, 'a', 'Mg2+').verdict).toBe('correct')
    expect(gradeIbStage(magnesium, 'a', 'Mg+2').verdict).toBe('correct')
    expect(gradeIbStage(magnesium, 'a', 'Mg²⁺').verdict).toBe('correct')
    expect(gradeIbStage(magnesium, 'a', 'mg2+').verdict).toBe('invalid')
    expect(gradeIbStage(magnesium, 'a', 'Mg').verdict).toBe('invalid')
    expect(gradeIbStage(magnesium, 'a', 'Mg^+').verdict).toBe('wrong')
    expect(mistake(magnesium, 'Mg^2-')).toBe('ib_charge_sign')
    const chloride = hand('valence', { kind: 'ion', z: 17 }, 'The ion')
    expect(chloride.stages[0]!.answerText).toBe('Cl^-')
    expect(mistake(chloride, 'Cl^+')).toBe('ib_charge_sign')

    const sodiumConfig = hand('valence', { kind: 'ion-config', z: 11 }, 'Ion configuration')
    expect(sodiumConfig.stages[0]!.answerText).toBe('[Ne]')
    expect(gradeIbStage(sodiumConfig, 'a', '1s2 2s2 2p6').verdict).toBe('correct')
    expect(mistake(sodiumConfig, '[Ne] 3s1')).toBe('ec_ion_charge_ignored')
    expect(hand('valence', { kind: 'ion-config', z: 19 }, 'Ion configuration').stages[0]!.answerText).toBe('[Ar]')
    expect(hand('valence', { kind: 'ion-config', z: 3 }, 'Ion configuration').stages[0]!.answerText).toBe('[He]')
    const sulfide = hand('valence', { kind: 'ion-config', z: 16 }, 'Ion configuration')
    expect(sulfide.stages[0]!.answerText).toBe('[Ar]')
    expect(mistake(sulfide, '[Ne] 3s2 3p4')).toBe('ec_ion_charge_ignored')

    const sulfurDots = hand('dots', { kind: 'dots', z: 16, charge: 0 }, 'Dots shown')
    expect(sulfurDots.stages[0]!.answerText).toBe('6')
    expect(mistake(sulfurDots, '16')).toBe('ib_dots_all')
    const chlorideDots = hand('dots', { kind: 'dots', z: 17, charge: -1 }, 'Dots shown')
    expect(chlorideDots.stages[0]!.answerText).toBe('8')
    expect(mistake(chlorideDots, '7')).toBe('ib_dots_neutral')
    expect(mistake(chlorideDots, '18')).toBe('ib_dots_all')
    const sodiumDots = hand('dots', { kind: 'dots', z: 11, charge: 1 }, 'Dots shown')
    expect(sodiumDots.stages[0]!.answerText).toBe('0')
    expect(mistake(sodiumDots, '1')).toBe('ib_dots_neutral')
    expect(mistake(sodiumDots, '10')).toBe('ib_dots_all')
    const stand = hand('dots', { kind: 'dots-stand', z: 16, charge: 0 }, 'Stand for')
    expect(stand.stages[0]!.answerText).toBe(DOTS_STAND_TEXT.valence)
    expect(mistake(stand, DOTS_STAND_TEXT.all)).toBe('ib_dots_all')
    expect(gradeIbStage(stand, 'a', DOTS_STAND_TEXT.moved).verdict).toBe('wrong')

    const alO = hand('transfer', { kind: 'ratio', cationZ: 13, anionZ: 8 }, 'Ions per unit')
    expect(alO.stages[0]!.answerText).toBe('2:3')
    expect(gradeIbStage(alO, 'a', '2 : 3').verdict).toBe('correct')
    expect(gradeIbStage(alO, 'a', '2 to 3').verdict).toBe('correct')
    expect(mistake(alO, '3:2')).toBe('nm_crisscross_reversed')
    const mgO = hand('transfer', { kind: 'ratio', cationZ: 12, anionZ: 8 }, 'Ions per unit')
    expect(mgO.stages[0]!.answerText).toBe('1:1')
    expect(mistake(mgO, '2:2')).toBe('nm_not_lowest_ratio')
    expect(mistake(mgO, '4:4')).toBe('nm_not_lowest_ratio')
    const naCl = hand('transfer', { kind: 'ratio', cationZ: 11, anionZ: 17 }, 'Ions per unit')
    expect(naCl.stages[0]!.answerText).toBe('1:1')
    expect(gradeIbStage(naCl, 'a', '2:2').verdict).toBe('wrong')
    const naO = hand('transfer', { kind: 'ratio', cationZ: 11, anionZ: 8 }, 'Ions per unit')
    expect(naO.stages[0]!.answerText).toBe('2:1')

    const mgCl = hand('transfer', { kind: 'formula', cationZ: 12, anionZ: 17 }, 'Formula unit')
    expect(mgCl.stages[0]!.answerText).toBe('MgCl2')
    expect(mistake(mgCl, 'Mg2Cl')).toBe('nm_crisscross_reversed')
    const caO = hand('transfer', { kind: 'formula', cationZ: 20, anionZ: 8 }, 'Formula unit')
    expect(caO.stages[0]!.answerText).toBe('CaO')
    expect(mistake(caO, 'Ca2O2')).toBe('nm_not_lowest_ratio')
    expect(hand('transfer', { kind: 'formula', cationZ: 13, anionZ: 8 }, 'Formula unit').stages[0]!.answerText).toBe('Al2O3')
    expect(hand('transfer', { kind: 'formula', cationZ: 3, anionZ: 7 }, 'Formula unit').stages[0]!.answerText).toBe('Li3N')

    const alOCount = hand('transfer', { kind: 'transfer-count', cationZ: 13, anionZ: 8 }, 'Moved per unit')
    expect(alOCount.stages[0]!.answerText).toBe('6')
    expect(mistake(alOCount, '3')).toBe('ib_transfer_count')
    const mgN = hand('transfer', { kind: 'transfer-count', cationZ: 12, anionZ: 7 }, 'Moved per unit')
    expect(mgN.stages[0]!.answerText).toBe('6')
    expect(mistake(mgN, '2')).toBe('ib_transfer_count')
    const naClCount = hand('transfer', { kind: 'transfer-count', cationZ: 11, anionZ: 17 }, 'Moved per unit')
    expect(naClCount.stages[0]!.answerText).toBe('1')
    expect(naClCount.stages[0]!.traps).toEqual([])

    const melt = hand('props', { kind: 'props', scenario: 'melt' }, 'The reason')
    expect(mistake(melt, PROPS_WRONG.electrons)).toBe('ib_props_electrons')
    expect(mistake(melt, PROPS_WRONG.molecules)).toBe('ib_props_molecules')
    expect(mistake(melt, PROPS_WRONG.weak)).toBe('ib_props_weak')
    const sea = hand('sea', { kind: 'sea', ask: 'conduct' }, 'The reason')
    expect(mistake(sea, SEA_WRONG.fixed)).toBe('mb_fixed_electrons')
    expect(mistake(sea, SEA_WRONG.ionic)).toBe('mb_ionic_confusion')
    expect(gradeIbStage(sea, 'a', '').verdict).toBe('invalid')
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, validates its own answers, and keeps the answer off the page she still acts on',
    () => {
      for (const seed of SEEDS) {
        const { p, a } = problem(templateId, seed)
        expect(generateProblem('ionicBonding', templateId, seed)).toEqual(p)
        expect(p.id).toBe(`ionicBonding/${templateId}@1/${seed.toString(36)}`)
        expect(p.kind).toBe('ionicBonding')
        expect(p.moduleId).toBe('ionicBonding')
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        expect(p.statementText).toBe(a.prompt)
        expect(a.stages.length).toBeGreaterThan(0)
        let trapPossible = false
        for (const stage of a.stages) {
          expect(gradeIbStage(a, stage.id, stage.answerText).verdict).toBe('correct')
          expect(stage.answerText).toBe(canonicalIbAnswer(stage.check))
          for (const alt of stage.accept ?? []) expect(gradeIbStage(a, stage.id, alt).verdict).toBe('correct')
          for (const trap of stage.traps) {
            trapPossible = true
            expect(trap.text).not.toBe(stage.answerText)
            const graded = gradeIbStage(a, stage.id, trap.text)
            expect(graded.verdict).toBe('mistake')
            if (graded.verdict === 'mistake') expect(graded.mistake).toBe(trap.id)
            expect(answerLeaks(trap.witness, stage.answerText)).toBe(false)
          }
          expect(answerLeaks(stage.hint, stage.answerText)).toBe(false)
          expect(answerLeaks(stage.nudge, stage.answerText)).toBe(false)
          expect(answerLeaks(a.prompt, stage.answerText)).toBe(false)
        }
        expect(trapPossible).toBe(true)
        expect(a.trap).toBeTruthy()
        expect(a.trapStage).toBeTruthy()
        expect(a.trapAnswer).toBeTruthy()
        const graded = gradeIbStage(a, a.trapStage!, a.trapAnswer!)
        expect(graded.verdict).toBe('mistake')
        if (graded.verdict === 'mistake') expect(graded.mistake).toBe(a.trap)
      }
    },
    HEAVY,
  )
})

describe('variety and promised traps', () => {
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
    'every minted and reused id is the promised trap on some seed',
    () => {
      const seen = new Set<string>()
      for (const templateId of TEMPLATES) {
        for (const seed of SEEDS) {
          const { a } = problem(templateId, seed)
          if (a.trap) seen.add(a.trap)
        }
      }
      expect([...seen].sort()).toEqual([...IB_MISTAKE_IDS, ...IB_REUSED_MISTAKE_IDS].sort())
    },
    HEAVY,
  )
})
