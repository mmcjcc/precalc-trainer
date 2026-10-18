import { describe, expect, it } from 'vitest'
import { generateProblem, getModule, MODULES } from '@/content'
import type { PeriodicAnswer, PtCheck } from '@/content/types'
import { elementByZ } from '@/engine/chem/elements'
import { TRENDS } from '@/engine/chem/trends'
import { ERROR_PATTERNS } from '@/engine'
import { answerLeaks, IONIZATION_EXCEPTION_PAIRS } from './facts'
import { canonicalAnswer, gradePtStage, PT_MISTAKE_IDS, trapsFor } from './grade'
import { PT_RULES, WHY_TEXT } from './rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const TEMPLATES = ['pt.locate', 'pt.valence', 'pt.trends', 'pt.ions', 'pt.why'] as const

const FAMOUS_IE: Record<number, number> = {
  1: 1312.0,
  2: 2372.3,
  3: 520.2,
  4: 899.5,
  5: 800.6,
  6: 1086.5,
  7: 1402.3,
  8: 1313.9,
  9: 1681.0,
  10: 2080.7,
  11: 495.8,
  12: 737.7,
  13: 577.5,
  14: 786.5,
  15: 1011.8,
  16: 999.6,
  17: 1251.2,
  18: 1520.6,
  19: 418.8,
  20: 589.8,
}

function problem(templateId: string, seed: number) {
  const p = generateProblem('periodic', templateId, seed)
  if (p.answer.type !== 'periodic') throw new Error(`${templateId}/${seed} is ${p.answer.type}`)
  return { p, a: p.answer }
}

function hand(question: PeriodicAnswer['question'], check: PtCheck, label: string): PeriodicAnswer {
  const answerText = canonicalAnswer(check)
  const traps = trapsFor(check)
  const choice = check.kind === 'class' || check.kind === 'family' || check.kind === 'larger' || check.kind === 'why'
  const texts = choice ? [...new Set([answerText, ...traps.map((trap) => trap.text), ...(check.kind === 'why' ? Object.values(WHY_TEXT) : [])])] : []
  return {
    type: 'periodic',
    question,
    prompt: 'Hand worked, not shown to her.',
    stages: [
      {
        id: 'a',
        kind: choice ? 'choice' : 'text',
        label,
        hint: 'Type the answer for this part.',
        answerText,
        ...(check.kind === 'group' && answerText === 'none' ? { accept: ['no group', 'no column', 'ungrouped'] } : {}),
        ...(choice ? { choices: texts.map((text) => ({ id: text, text })) } : {}),
        nudge: 'Use the table, not a shortcut.',
        ruleCard: 'pt.row',
        reveal: [`The answer is ${answerText}.`],
        traps,
        check,
      },
    ],
    expectedDisplay: `${label}: ${answerText}`,
    reveal: [`The answer is ${answerText}.`],
    ruleCards: ['pt.row'],
  }
}

function mistake(answer: PeriodicAnswer, text: string) {
  const grade = gradePtStage(answer, 'a', text)
  if (grade.verdict !== 'mistake') throw new Error(`${text} graded ${grade.verdict}`)
  return grade.mistake
}

describe('periodic module registration', () => {
  it('is Chemistry, ordered after electrons and before geometry, with five templates', () => {
    const m = getModule('periodic')
    expect(m.subject).toBe('Chemistry')
    expect(m.title).toBe('The periodic table')
    expect(m.order).toBe(8.5)
    expect(m.order).toBeGreaterThan(getModule('electrons').order)
    expect(m.order).toBeLessThan(getModule('geoSegments').order)
    const ids = MODULES.map((mod) => mod.id)
    expect(ids.indexOf('periodic')).toBe(ids.indexOf('electrons') + 1)
    expect(m.templates.map((t) => t.id)).toEqual([...TEMPLATES])
    expect(m.ruleCards.map((card) => card.id)).toEqual(PT_RULES.map((card) => card.id))
    const sample = generateProblem('periodic', 'pt.locate', 1)
    expect(m.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(m.nextStep(sample, null, false)).toBeNull()
  })

  it('has a catalog entry for every pt_ id', () => {
    for (const id of PT_MISTAKE_IDS) {
      const info = ERROR_PATTERNS[id]
      expect(info.id).toBe(id)
      expect(info.title.length).toBeGreaterThan(0)
      expect(info.lesson.length).toBeGreaterThan(0)
      expect(info.example).toContain('✗')
      expect(info.example).toContain('→')
    }
  })
})

describe('trend table', () => {
  it('is complete for Z 1-56, with the cited main-group values', () => {
    expect(TRENDS.map((row) => row.z)).toEqual(Array.from({ length: 56 }, (_, i) => i + 1))
    for (const row of TRENDS) {
      expect(row.radiusPm).toBeGreaterThan(0)
      expect(row.ionizationKjMol).toBeGreaterThan(0)
      expect(row.electronegativity).toBeGreaterThan(0)
      expect(Number.isFinite(row.radiusPm)).toBe(true)
      expect(Number.isFinite(row.ionizationKjMol)).toBe(true)
      expect(Number.isFinite(row.electronegativity)).toBe(true)
    }
    for (const [z, kj] of Object.entries(FAMOUS_IE)) {
      expect(TRENDS[Number(z) - 1]!.ionizationKjMol).toBe(kj)
    }
    expect(TRENDS[10]!.radiusPm).toBe(166)
    expect(TRENDS[11]!.radiusPm).toBe(141)
    expect(TRENDS[16]!.radiusPm).toBe(102)
    expect(TRENDS[3]!.radiusPm).toBe(96)
    expect(TRENDS[4]!.radiusPm).toBe(84)
    expect(TRENDS[5]!.radiusPm).toBe(76)
    expect(TRENDS[15]!.radiusPm).toBe(105)
    expect(TRENDS[7]!.radiusPm).toBe(66)
    expect(TRENDS[8]!.radiusPm).toBe(57)
    expect(TRENDS[24]!.radiusPm).toBe(139)
    expect(TRENDS[25]!.radiusPm).toBe(132)
    expect(TRENDS[26]!.radiusPm).toBe(126)
    expect(TRENDS[8]!.electronegativity).toBe(3.98)
    expect(TRENDS[0]!.electronegativity).toBe(2.2)
    expect(TRENDS[1]!.electronegativity).toBe(4.16)
    expect(TRENDS[9]!.electronegativity).toBe(4.79)
    expect(TRENDS[17]!.electronegativity).toBe(3.24)
  })
})

describe('hand-worked periodic answers', () => {
  it('ranks, counts valence electrons, and compares ion sizes from the tables', () => {
    const radius = hand('trends', { kind: 'rank', property: 'radius', direction: 'increasing', zs: [11, 12, 17] }, 'Order')
    expect(radius.stages[0]!.answerText).toBe('Cl, Mg, Na')
    expect(gradePtStage(radius, 'a', 'Cl, Mg, Na').verdict).toBe('correct')
    expect(gradePtStage(radius, 'a', 'cl, mg, na').verdict).toBe('correct')
    expect(gradePtStage(radius, 'a', 'Na < Mg < Cl').verdict).toBe('mistake')
    expect(mistake(radius, 'Na, Mg, Cl')).toBe('pt_radius_like_ionization')
    expect(mistake(radius, 'Na < Mg < Cl')).toBe('pt_radius_like_ionization')

    const bend = hand('trends', { kind: 'rank', property: 'radius', direction: 'increasing', zs: [4, 5, 6] }, 'Order')
    expect(bend.stages[0]!.answerText).toBe('C, B, Be')
    expect(mistake(bend, 'Be, B, C')).toBe('pt_trend_reversed')
    expect(mistake(bend, 'B, Be, C')).toBe('pt_radius_like_ionization')
    expect(hand('trends', { kind: 'rank', property: 'ionization', direction: 'increasing', zs: [4, 5, 6] }, 'Order').stages[0]!.answerText).toBe('B, Be, C')

    const sulfur = hand('valence', { kind: 'valence', z: 16 }, 'Valence electrons')
    expect(sulfur.stages[0]!.answerText).toBe('6')
    expect(gradePtStage(sulfur, 'a', '6 electrons').verdict).toBe('correct')
    expect(mistake(sulfur, '16')).toBe('pt_group_number_valence')
    expect(mistake(sulfur, '3')).toBe('pt_valence_is_period')

    const chlorine = hand('valence', { kind: 'valence', z: 17 }, 'Valence electrons')
    expect(chlorine.stages[0]!.answerText).toBe('7')
    expect(mistake(chlorine, '17')).toBe('pt_group_number_valence')

    const sodium = hand('valence', { kind: 'valence', z: 11 }, 'Valence electrons')
    expect(sodium.stages[0]!.answerText).toBe('1')
    expect(mistake(sodium, '11')).toBe('pt_valence_is_atomic_number')
    expect(mistake(sodium, '3')).toBe('pt_valence_is_period')

    expect(hand('valence', { kind: 'valence-group', group: 1 }, 'Valence electrons').stages[0]!.answerText).toBe('1')
    expect(hand('valence', { kind: 'valence-group', group: 16 }, 'Valence electrons').stages[0]!.answerText).toBe('6')
    const nobles = hand('valence', { kind: 'valence-group', group: 18 }, 'Valence electrons')
    expect(nobles.stages[0]!.answerText).toBe('8')
    expect(mistake(nobles, '18')).toBe('pt_group_number_valence')

    const helium = hand('valence', { kind: 'valence', z: 2 }, 'Valence electrons')
    expect(helium.stages[0]!.answerText).toBe('2')
    expect(mistake(helium, '8')).toBe('pt_helium_octet')

    const config = '1s2 2s2 2p6 3s2 3p4'
    expect(hand('valence', { kind: 'config-valence', config }, 'Valence electrons').stages[0]!.answerText).toBe('6')
    expect(hand('valence', { kind: 'config-block', config }, 'Block').stages[0]!.answerText).toBe('p')
    const row = hand('valence', { kind: 'config-period', config }, 'Period')
    expect(row.stages[0]!.answerText).toBe('3')
    expect(mistake(row, '6')).toBe('pt_period_as_valence')

    const anion = hand('ions', { kind: 'larger', z: 17, charge: -1 }, 'Larger one')
    expect(anion.stages[0]!.answerText).toBe('Cl-')
    expect(mistake(anion, 'Cl')).toBe('pt_anion_smaller')
    const cation = hand('ions', { kind: 'larger', z: 11, charge: 1 }, 'Larger one')
    expect(cation.stages[0]!.answerText).toBe('Na')
    expect(mistake(cation, 'Na+')).toBe('pt_cation_larger')

    const iso = hand('ions', { kind: 'iso', direction: 'increasing', ions: [{ z: 8, charge: -2 }, { z: 9, charge: -1 }, { z: 11, charge: 1 }, { z: 12, charge: 2 }] }, 'Order')
    expect(iso.stages[0]!.answerText).toBe('Mg2+, Na+, F-, O2-')
    expect(mistake(iso, 'O2-, F-, Na+, Mg2+')).toBe('pt_isoelectronic_electron_count')
    expect(hand('ions', { kind: 'iso', direction: 'decreasing', ions: [{ z: 8, charge: -2 }, { z: 9, charge: -1 }, { z: 11, charge: 1 }, { z: 12, charge: 2 }] }, 'Order').stages[0]!.answerText).toBe('O2-, F-, Na+, Mg2+')

    expect(mistake(hand('locate', { kind: 'class', z: 1 }, 'Class'), 'metal')).toBe('pt_hydrogen_metal')
    expect(hand('locate', { kind: 'block', z: 2 }, 'Block').stages[0]!.answerText).toBe('s')
    expect(mistake(hand('locate', { kind: 'block', z: 2 }, 'Block'), 'p')).toBe('pt_helium_p_block')
    expect(hand('locate', { kind: 'block', z: 57 }, 'Block').stages[0]!.answerText).toBe('f')
    expect(mistake(hand('locate', { kind: 'block', z: 57 }, 'Block'), 'd')).toBe('pt_f_as_d_block')
    const ungrouped = hand('locate', { kind: 'group', z: 57 }, 'Group')
    expect(ungrouped.stages[0]!.answerText).toBe('none')
    expect(gradePtStage(ungrouped, 'a', 'no group').verdict).toBe('correct')
    expect(gradePtStage(ungrouped, 'a', 'no column').verdict).toBe('correct')

    expect(mistake(hand('locate', { kind: 'family', z: 11 }, 'Family'), 'alkaline earth metals')).toBe('pt_alkali_called_alkaline')
    expect(mistake(hand('locate', { kind: 'family', z: 12 }, 'Family'), 'alkali metals')).toBe('pt_alkaline_called_alkali')
    expect(mistake(hand('locate', { kind: 'class', z: 14 }, 'Class'), 'metal')).toBe('pt_metalloid_called_metal')
    expect(mistake(hand('locate', { kind: 'class', z: 13 }, 'Class'), 'metalloid')).toBe('pt_metal_called_metalloid')

    const across = hand('why', { kind: 'why', reason: 'protons' }, 'Reason')
    expect(across.stages[0]!.answerText).toBe('More protons pull on the same shell')
    expect(mistake(across, WHY_TEXT.shells)).toBe('pt_why_shells_across_period')
    expect(mistake(across, WHY_TEXT.shielding)).toBe('pt_why_shielding_same_shell')
    expect(mistake(hand('why', { kind: 'why', reason: 'shells' }, 'Reason'), WHY_TEXT.protons)).toBe('pt_why_protons_down_group')
    expect(mistake(hand('why', { kind: 'why', reason: 'shielding' }, 'Reason'), WHY_TEXT.protons)).toBe('pt_why_protons_down_group')

    expect(gradePtStage(sulfur, 'a', '???').verdict).toBe('invalid')
    expect(gradePtStage(radius, 'a', 'Na, Mg').verdict).toBe('invalid')
    expect(gradePtStage(anion, 'a', '').verdict).toBe('invalid')
  })
})

describe.each(TEMPLATES)('%s over 300 seeds', (templateId) => {
  it(
    'is deterministic, validates its own answers, and keeps the answer off the page she still acts on',
    () => {
      for (const seed of SEEDS) {
        const { p, a } = problem(templateId, seed)
        expect(generateProblem('periodic', templateId, seed)).toEqual(p)
        expect(p.id).toBe(`periodic/${templateId}@1/${seed.toString(36)}`)
        expect(p.kind).toBe('periodic')
        expect(p.moduleId).toBe('periodic')
        expect(p.graph).toEqual({ kind: 'none' })
        expect(p.calc).toEqual({ ti84: [], nspire: [] })
        expect(p.statementText).toBe(a.prompt)
        expect(a.stages.length).toBeGreaterThan(0)
        let trapPossible = false
        for (const stage of a.stages) {
          expect(gradePtStage(a, stage.id, stage.answerText).verdict).toBe('correct')
          expect(stage.answerText).toBe(canonicalAnswer(stage.check))
          for (const alt of stage.accept ?? []) expect(gradePtStage(a, stage.id, alt).verdict).toBe('correct')
          for (const trap of stage.traps) {
            trapPossible = true
            expect(trap.text).not.toBe(stage.answerText)
            const graded = gradePtStage(a, stage.id, trap.text)
            expect(graded.verdict).toBe('mistake')
            if (graded.verdict === 'mistake') expect(graded.mistake).toBe(trap.id)
            expect(answerLeaks(trap.witness, stage.answerText)).toBe(false)
          }
          expect(answerLeaks(stage.hint, stage.answerText)).toBe(false)
          expect(answerLeaks(stage.nudge, stage.answerText)).toBe(false)
          if (!a.prompt.startsWith('Which is larger')) expect(answerLeaks(a.prompt, stage.answerText)).toBe(false)
          if (stage.check.kind === 'rank' && stage.check.property !== 'metallic') {
            const ranked = stage.check.zs.map((z) => elementByZ(z)!)
            if (stage.check.property !== 'ionization') {
              for (const el of ranked) expect(el.group).not.toBe(18)
            } else {
              const symbols = ranked.map((el) => el.symbol)
              for (const [left, right] of IONIZATION_EXCEPTION_PAIRS) {
                expect(symbols.includes(left) && symbols.includes(right)).toBe(false)
              }
            }
          }
        }
        if (trapPossible) {
          expect(a.trap).toBeTruthy()
          expect(a.trapStage).toBeTruthy()
          expect(a.trapAnswer).toBeTruthy()
          const graded = gradePtStage(a, a.trapStage!, a.trapAnswer!)
          expect(graded.verdict).toBe('mistake')
          if (graded.verdict === 'mistake') expect(graded.mistake).toBe(a.trap)
        }
        if (templateId === 'pt.trends' || (templateId === 'pt.ions' && a.prompt.startsWith('These ions'))) {
          const shown = a.prompt.split(': ').pop()!.replace(/\.$/, '')
          expect(shown).not.toBe(a.stages[0]!.answerText)
          for (const trap of a.stages[0]!.traps) expect(shown).not.toBe(trap.text)
        }
      }
    },
    HEAVY,
  )
})

describe('promised traps', () => {
  it(
    'every pt_ id is the promised trap on some seed',
    () => {
      const seen = new Set<string>()
      const scopes = { period: 0, group: 0, diagonal: 0 }
      const directions = { increasing: 0, decreasing: 0 }
      const sizes = { 3: 0, 4: 0 }
      for (const templateId of TEMPLATES) {
        for (const seed of SEEDS) {
          const { p, a } = problem(templateId, seed)
          if (a.trap) seen.add(a.trap)
          if (templateId !== 'pt.trends') continue
          const scope = String(p.params.scope) as keyof typeof scopes
          const direction = String(p.params.direction) as keyof typeof directions
          const size = Number(p.params.size) as 3 | 4
          scopes[scope] += 1
          directions[direction] += 1
          sizes[size] += 1
        }
      }
      expect([...seen].sort()).toEqual([...PT_MISTAKE_IDS].sort())
      for (const count of Object.values(scopes)) expect(count).toBeGreaterThan(70)
      for (const count of Object.values(directions)) expect(count).toBeGreaterThan(80)
      expect(sizes[3]).toBeGreaterThan(20)
      expect(sizes[4]).toBeGreaterThan(20)
    },
    HEAVY,
  )
})
