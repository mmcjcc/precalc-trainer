/**
 * Honors geometry Unit 4. Every seed grades its own answers, keeps the promised trap as a real
 * candidate, and leaves the answer out of anything she can read before she finishes.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { ModuleId } from '@/shared/types'
import type { GeometryAnswer } from '@/content/types'
import { GEO_UNIT4_MISTAKE_IDS, containsAnswer, exampleShowsAnswer, gradeGeoStage, stageDisplay } from './grade'
import { CONGRUENCE_RULES, ISOSCELES_RULES, TRIANGLE_PROOF_RULES } from './unit4Rules'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000
const RESERVED = ['4', '6', '11', '15', '17', '19', '23', '24', '26', '29', '37', '41', '53', '60', '64', '90', '165', '180']

const TEMPLATES: { module: ModuleId; template: string; cards: { id: string; title: string; body: string; example?: string }[] }[] = [
  { module: 'geoCongruence', template: 'gc.parts', cards: CONGRUENCE_RULES },
  { module: 'geoCongruence', template: 'gc.which', cards: CONGRUENCE_RULES },
  { module: 'geoCongruence', template: 'gc.solve', cards: CONGRUENCE_RULES },
  { module: 'geoIsosceles', template: 'gi.solve', cards: ISOSCELES_RULES },
  { module: 'geoTriangleProofs', template: 'gt.twocolumn', cards: TRIANGLE_PROOF_RULES },
]

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

function choiceText(stage: GeometryAnswer['stages'][number], id: string): string {
  return stage.choices?.find((choice) => choice.id === id)?.text ?? ''
}

describe('geometry unit 4 registration', () => {
  it('puts the three modules in Unit 4 order, after the polygon module', () => {
    const congruence = getModule('geoCongruence')
    const isosceles = getModule('geoIsosceles')
    const proofs = getModule('geoTriangleProofs')
    expect(congruence.title).toBe('Congruent triangles')
    expect(isosceles.title).toBe('Isosceles and equilateral triangles')
    expect(proofs.title).toBe('Proving triangles congruent')
    expect(congruence.order).toBe(15)
    expect(isosceles.order).toBe(16)
    expect(proofs.order).toBe(17)
    expect(congruence.order).toBeGreaterThan(getModule('geoPolygonAngles').order)
    expect(congruence.templates.map((t) => t.id)).toEqual(['gc.parts', 'gc.which', 'gc.solve'])
    expect(isosceles.templates.map((t) => t.id)).toEqual(['gi.solve'])
    expect(proofs.templates.map((t) => t.id)).toEqual(['gt.twocolumn'])
    const sample = generateProblem('geoCongruence', 'gc.parts', 1)
    expect(sample.kind).toBe('geometry')
    expect(congruence.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(congruence.nextStep(sample, null, false)).toBeNull()
    expect(isosceles.nextStep(sample, null, false)).toBeNull()
    expect(proofs.nextStep(sample, null, false)).toBeNull()
  })

  it('seed 1 of each template shows the trap named for that problem', () => {
    expect(answerOf('geoCongruence', 'gc.parts', 1).trap).toBe('geo_vertices_out_of_order')
    expect(answerOf('geoCongruence', 'gc.which', 1).trap).toBe('geo_ssa_as_congruence')
    expect(answerOf('geoCongruence', 'gc.solve', 1).trap).toBe('geo_vertices_out_of_order')
    expect(answerOf('geoIsosceles', 'gi.solve', 1).trap).toBe('geo_base_angles_wrong_vertex')
    expect(answerOf('geoTriangleProofs', 'gt.twocolumn', 1).trap).toBe('geo_cpctc_too_soon')
  })
})

describe.each(TEMPLATES)('$module/$template over 300 seeds', ({ module, template, cards }) => {
  const cardIds = new Set(cards.map((card) => card.id))

  it('is deterministic, validates its answers, and keeps the trap as a real candidate', () => {
    for (const seed of SEEDS) {
      const p = generateProblem(module, template, seed)
      expect(generateProblem(module, template, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`${module}/${template}@1/${seed.toString(36)}`)
      expect(p.kind).toBe('geometry')
      expect(p.answer.type).toBe('geometry')
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const a = p.answer
      expect(a.stages.length).toBeGreaterThan(0)
      expect(a.figure.ariaLabel.length).toBeGreaterThan(0)
      for (const n of a.angles) expect(n > 0 && n < 180, `${p.id} angle ${n}`).toBe(true)
      for (const n of a.lengths) expect(n > 0, `${p.id} length ${n}`).toBe(true)
      const before = [a.prompt, a.figure.ariaLabel]
      for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
      for (const ang of a.figure.angles ?? []) if (ang.label) before.push(ang.label)
      const blob = before.join('\n')
      for (const stage of a.stages) {
        expect(cardIds.has(stage.ruleCard), stage.ruleCard).toBe(true)
        expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${p.id} ${stage.id}`).toBe('correct')
        for (const alt of stage.accept ?? []) {
          expect(gradeGeoStage(a, stage.id, alt).verdict, `${p.id} accept ${alt}`).toBe('correct')
        }
        const display = stageDisplay(stage)
        expect(containsAnswer(blob, display), `${p.id} shows “${display}”`).toBe(false)
        expect(RESERVED.includes(display), `${p.id} reserved ${display}`).toBe(false)
        expect(RESERVED.includes(stage.answerText), `${p.id} reserved ${stage.answerText}`).toBe(false)
        for (const line of stage.reveal) expect(blob.includes(line), `${p.id} reveal`).toBe(false)
        const garbage = stage.kind === 'choice' ? '' : '???'
        expect(gradeGeoStage(a, stage.id, garbage).verdict, `${p.id} garbage`).toBe('invalid')
      }
      const promised = a.stages.find((stage) => stage.id === a.trapStage)
      expect(promised?.traps.some((trap) => trap.id === a.trap && trap.text === a.trapAnswer), `${p.id} ${a.trap}`).toBe(true)
      const trapGrade = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(trapGrade.verdict, `${p.id} ${a.trapAnswer}`).toBe('mistake')
      if (trapGrade.verdict === 'mistake') expect(trapGrade.mistake).toBe(a.trap)
      if (template === 'gc.solve') expect(a.trapStage).toBe('x')
      if (template === 'gi.solve' && a.trap === 'geo_base_angles_wrong_vertex') expect(a.trapStage).toBe('x')
      if (a.trap === 'geo_equilateral_angle_for_side') expect(a.trapStage).toBe('result')
    }
  }, HEAVY)
})

describe('geometry unit 4 trap coverage', () => {
  it('every new geo_ id is a real candidate on some seed', () => {
    const seen = new Set<string>()
    for (const { module, template } of TEMPLATES) {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
      }
    }
    for (const id of GEO_UNIT4_MISTAKE_IDS) {
      expect(seen.has(id), id).toBe(true)
      expect(ERROR_PATTERNS[id].lesson.length, id).toBeGreaterThan(40)
      expect(ERROR_PATTERNS[id].example, id).toContain('✗')
    }
  }, HEAVY)

  it('rule cards and catalog examples use the reserved story, not a generated answer, over 2000 seeds', () => {
    const clashes: string[] = []
    for (const { module, template, cards } of TEMPLATES) {
      for (let seed = 1; seed <= 2000; seed++) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) {
          const display = stageDisplay(stage)
          for (const trap of stage.traps) {
            const info = ERROR_PATTERNS[trap.id]
            const blob = `${info.title}\n${info.lesson}\n${info.example}`
            if (containsAnswer(blob, display) || exampleShowsAnswer(info.example, display)) {
              clashes.push(`${template}/${seed} ${display}: ${trap.id}`)
            }
          }
          for (const card of cards) {
            const blob = `${card.title}\n${card.body}\n${card.example ?? ''}`
            const result = (card.example ?? '').split(/=|→/).pop()?.trim() ?? ''
            if (containsAnswer(blob, display) || (result && exampleShowsAnswer(result, display))) {
              clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
            }
          }
        }
      }
    }
    expect(clashes.slice(0, 8)).toEqual([])
  }, HEAVY)
})

describe('hand-worked unit 4', () => {
  it('parts: ∠A corresponds to ∠D, and the next letter is the order trap', () => {
    const a = answerOf('geoCongruence', 'gc.parts', 1)
    const stage = a.stages[0]!
    expect(a.prompt).toBe('△ABC ≅ △DEF. Which angle matches ∠A?')
    expect(choiceText(stage, 'right')).toBe('∠D')
    expect(a.trap).toBe('geo_vertices_out_of_order')
    expect(choiceText(stage, a.trapAnswer)).toBe('∠E')
    expect(a.figure.segments?.some((seg) => seg.ticks)).toBe(false)
    expect(a.figure.angles ?? []).toEqual([])
    expect(gradeGeoStage(a, 'a', 'order')).toMatchObject({ verdict: 'mistake', mistake: 'geo_vertices_out_of_order' })
  })

  it('parts: the tick marks support △ABC ≅ △DEF, not the cycled order', () => {
    const a = answerOf('geoCongruence', 'gc.parts', 2)
    const stage = a.stages[0]!
    expect(a.prompt).toContain('Which statement names the triangles in the same order?')
    expect(choiceText(stage, 'right')).toBe('△ABC ≅ △DEF')
    expect(choiceText(stage, 'order')).toBe('△ABC ≅ △EFD')
    expect(a.figure.ariaLabel).toContain('AB-DE tick 1')
    expect(a.figure.ariaLabel).toContain('BC-EF tick 2')
    expect(a.figure.ariaLabel).toContain('CA-FD tick 3')
    expect(a.figure.segments?.filter((seg) => seg.ticks).length).toBe(6)
    expect(gradeGeoStage(a, 'a', 'order')).toMatchObject({ verdict: 'mistake', mistake: 'geo_vertices_out_of_order' })
  })

  it('parts: side AB corresponds to DE, and EF is the order trap', () => {
    const a = answerOf('geoCongruence', 'gc.parts', 3)
    const stage = a.stages[0]!
    expect(a.prompt).toBe('△ABC ≅ △DEF. Which side matches AB?')
    expect(choiceText(stage, 'right')).toBe('DE')
    expect(choiceText(stage, 'order')).toBe('EF')
    expect(gradeGeoStage(a, 'a', 'right').verdict).toBe('correct')
  })

  it('parts: the next letter set still lines up the first vertices', () => {
    const a = answerOf('geoCongruence', 'gc.parts', 5)
    const stage = a.stages[0]!
    expect(a.prompt).toBe('△PQR ≅ △STU. Which angle matches ∠P?')
    expect(choiceText(stage, 'right')).toBe('∠S')
    expect(choiceText(stage, 'order')).toBe('∠T')
  })

  it('which: three pairs of sides are SSS, and SSA is the trap', () => {
    const a = answerOf('geoCongruence', 'gc.which', 1)
    expect(a.stages[0]!.answerText).toBe('SSS')
    expect(a.trapAnswer).toBe('SSA')
    expect(a.trap).toBe('geo_ssa_as_congruence')
    expect(a.figure.ariaLabel).toContain('AB-DE tick 1')
    expect(a.figure.ariaLabel).toContain('BC-EF tick 2')
    expect(a.figure.ariaLabel).toContain('CA-FD tick 3')
    expect(a.figure.ariaLabel).toContain('Angle pairs: none')
    expect(gradeGeoStage(a, 'a', 'SSA')).toMatchObject({ verdict: 'mistake', mistake: 'geo_ssa_as_congruence' })
    expect(gradeGeoStage(a, 'a', 'none').verdict).toBe('wrong')
  })

  it('which: two sides and the angle between them are SAS', () => {
    const a = answerOf('geoCongruence', 'gc.which', 2)
    expect(a.stages[0]!.answerText).toBe('SAS')
    expect(a.figure.ariaLabel).toContain('B-E arc 1')
    expect(a.figure.ariaLabel).not.toContain('A-D arc')
    expect(a.trap).toBe('geo_ssa_as_congruence')
  })

  it('which: two angles and the side between them are ASA, and AAS is the swap', () => {
    const a = answerOf('geoCongruence', 'gc.which', 3)
    expect(a.stages[0]!.answerText).toBe('ASA')
    expect(a.trapAnswer).toBe('AAS')
    expect(a.trap).toBe('geo_asa_aas_swapped')
    expect(a.figure.ariaLabel).toContain('AB-DE tick 1')
    expect(a.figure.ariaLabel).toContain('A-D arc 1')
    expect(a.figure.ariaLabel).toContain('B-E arc 2')
  })

  it('which: two angles and a side that is not between them are AAS', () => {
    const a = answerOf('geoCongruence', 'gc.which', 4)
    expect(a.stages[0]!.answerText).toBe('AAS')
    expect(a.trapAnswer).toBe('ASA')
    expect(a.figure.ariaLabel).toContain('BC-EF tick 1')
    expect(a.figure.ariaLabel).not.toContain('AB-DE')
  })

  it('which: a right angle, the hypotenuse, and one leg are HL, and SAS is the trap', () => {
    const a = answerOf('geoCongruence', 'gc.which', 5)
    expect(a.stages[0]!.answerText).toBe('HL')
    expect(a.trap).toBe('geo_sas_not_included')
    expect(a.trapAnswer).toBe('SAS')
    expect(a.figure.ariaLabel).toContain('Right angles: C; F')
    expect(a.figure.ariaLabel).toContain('Angle pairs: none')
    expect(a.figure.angles?.filter((mark) => mark.right).map((mark) => mark.vertex).sort()).toEqual(['C', 'F'])
  })

  it('which: two sides and the angle that is not between them are not enough', () => {
    const a = answerOf('geoCongruence', 'gc.which', 6)
    expect(a.stages[0]!.answerText).toBe('none')
    expect(choiceText(a.stages[0]!, 'none')).toBe('Not enough information')
    expect(a.trap).toBe('geo_ssa_as_congruence')
    expect(a.trapAnswer).toBe('SSA')
    expect(a.figure.ariaLabel).toContain('A-D arc 1')
    expect(a.figure.ariaLabel).not.toContain('B-E arc')
    expect(gradeGeoStage(a, 'a', 'SSA')).toMatchObject({ verdict: 'mistake', mistake: 'geo_ssa_as_congruence' })
  })

  it('which: three angles are not enough, even on triangles of different sizes', () => {
    const a = answerOf('geoCongruence', 'gc.which', 7)
    expect(a.stages[0]!.answerText).toBe('none')
    expect(a.trap).toBe('geo_aaa_as_congruence')
    expect(a.trapAnswer).toBe('AAA')
    expect(a.figure.ariaLabel).toContain('Side pairs: none')
    expect(a.figure.ariaLabel).toContain('A-D arc 1')
    expect(a.figure.ariaLabel).toContain('C-F arc 3')
    expect(a.figure.segments?.some((seg) => seg.ticks)).toBe(false)
  })

  it('which: a shared side plus two pairs of ticks is SSS, and the shared side is not ticked', () => {
    const a = answerOf('geoCongruence', 'gc.which', 8)
    expect(a.stages[0]!.answerText).toBe('SSS')
    expect(a.figure.ariaLabel).toContain('Triangles ABC and ADC')
    expect(a.figure.ariaLabel).toContain('Shared sides: AC')
    expect(a.figure.ariaLabel).toContain('Angle pairs: none')
    const shared = a.figure.segments?.find((seg) => seg.from === 'A' && seg.to === 'C')
    expect(shared?.ticks).toBeUndefined()
  })

  it('which: vertical angles at a crossing are the included pair, and they are not drawn as arcs', () => {
    const a = answerOf('geoCongruence', 'gc.which', 9)
    expect(a.stages[0]!.answerText).toBe('SAS')
    expect(a.figure.ariaLabel).toContain('Triangles AEB and CED')
    expect(a.figure.ariaLabel).toContain('Vertical angles: AEB-CED')
    expect(a.figure.ariaLabel).toContain('Angle pairs: none')
    expect(a.figure.angles ?? []).toEqual([])
  })

  it('which: alternate interior angles and the included diagonal are ASA, with no arcs', () => {
    const a = answerOf('geoCongruence', 'gc.which', 10)
    expect(a.stages[0]!.answerText).toBe('ASA')
    expect(a.trap).toBe('geo_asa_aas_swapped')
    expect(a.figure.ariaLabel).toContain('Triangles ABC and CDA')
    expect(a.figure.ariaLabel).toContain('Alternate interior angles:')
    expect(a.figure.ariaLabel).toContain('Angle pairs: none')
    expect(a.figure.lines?.filter((line) => line.arrows).length).toBe(4)
    expect(a.figure.angles ?? []).toEqual([])
  })

  it('solve: corresponding angles (2x + 20) and (4x + 4) give x = 8 and m∠A = 36, not 42', () => {
    const a = answerOf('geoCongruence', 'gc.solve', 1)
    expect(a.prompt).toBe('△ABC ≅ △DEF. m∠A = 2x + 20, m∠D = 4x + 4, and m∠E = x + 62. Find x, then m∠A.')
    expect(a.stages.map((stage) => stage.answerText)).toEqual(['8', '36'])
    expect(a.trapStage).toBe('x')
    expect(a.trapAnswer).toBe('42')
    expect(a.angles).toEqual([36, 70, 74])
    expect(gradeGeoStage(a, 'x', '42')).toMatchObject({ verdict: 'mistake', mistake: 'geo_vertices_out_of_order' })
    expect(gradeGeoStage(a, 'result', '36°').verdict).toBe('correct')
  })

  it('solve: corresponding sides (2x + 9) and (4x − 7) give x = 8 and AB = 25, not 13', () => {
    const a = answerOf('geoCongruence', 'gc.solve', 5)
    expect(a.prompt).toBe('△ABC ≅ △DEF. AB = 2x + 9, DE = 4x − 7, and EF = x + 22. Find x, then AB.')
    expect(a.stages.map((stage) => stage.answerText)).toEqual(['8', '25'])
    expect(a.trapAnswer).toBe('13')
    expect(a.lengths).toEqual([25, 18, 20])
    expect(gradeGeoStage(a, 'result', '25°').verdict).toBe('invalid')
  })

  it('isosceles: base angles 5x and (7x − 16) give x = 8 and 40°, not the vertex set equal to a base', () => {
    const a = answerOf('geoIsosceles', 'gi.solve', 1)
    expect(a.prompt).toBe('AB and AC match. m∠A = 17x − 36, m∠B = 5x, and m∠C = 7x − 16. Find x, then m∠B.')
    expect(a.stages.map((stage) => stage.answerText)).toEqual(['8', '40'])
    expect(a.trapAnswer).toBe('3')
    expect(a.trap).toBe('geo_base_angles_wrong_vertex')
    expect(a.angles).toEqual([100, 40, 40])
    expect(a.figure.segments?.filter((seg) => seg.ticks === 1).map((seg) => `${seg.from}${seg.to}`).sort()).toEqual(['AB', 'AC'])
  })

  it('converse: sides across from the matching angles give x = 8 and AB = 34, not 2', () => {
    const a = answerOf('geoIsosceles', 'gi.solve', 2)
    expect(a.prompt).toBe('∠B and ∠C match. AB = 4x + 2, AC = 6x − 14, and BC = 3x + 4. Find x, then AB.')
    expect(a.stages.map((stage) => stage.answerText)).toEqual(['8', '34'])
    expect(a.trapAnswer).toBe('2')
    expect(a.lengths).toEqual([34, 34, 28])
    expect(a.figure.segments?.some((seg) => seg.ticks)).toBe(false)
    expect(a.figure.angles?.map((mark) => mark.vertex).sort()).toEqual(['B', 'C'])
  })

  it('equilateral: the three sides meet at x = 8 and the side is 22, while 60 is the angle', () => {
    const a = answerOf('geoIsosceles', 'gi.solve', 3)
    expect(a.prompt).toBe('AB, BC, and AC all match. AB = 2x + 6, BC = 3x − 2, and AC = 4x − 10. Find x, then AB.')
    expect(a.stages.map((stage) => stage.answerText)).toEqual(['8', '22'])
    expect(a.trap).toBe('geo_equilateral_angle_for_side')
    expect(a.trapStage).toBe('result')
    expect(a.trapAnswer).toBe('60')
    expect(a.angles).toEqual([60, 60, 60])
    expect(gradeGeoStage(a, 'x', '60').verdict).toBe('wrong')
    expect(gradeGeoStage(a, 'result', '60')).toMatchObject({ verdict: 'mistake', mistake: 'geo_equilateral_angle_for_side' })
  })

  it('proof: the SSS row is too soon for corresponding parts, and a shared side is not given', () => {
    const first = generateProblem('geoTriangleProofs', 'gt.twocolumn', 1)
    expect(first.params.skeleton).toBe('sss-three')
    if (first.answer.type !== 'geometry') throw new Error('not geometry')
    expect(first.answer.trap).toBe('geo_cpctc_too_soon')
    expect(first.answer.trapAnswer).toBe('thm-cpctc')
    expect(first.answer.trapStage).toBe('d')
    expect(gradeGeoStage(first.answer, 'd', 'thm-cpctc')).toMatchObject({ verdict: 'mistake', mistake: 'geo_cpctc_too_soon' })
    expect(gradeGeoStage(first.answer, 'd', 'post-sss').verdict).toBe('correct')

    const shared = generateProblem('geoTriangleProofs', 'gt.twocolumn', 6)
    expect(shared.params.skeleton).toBe('sss-shared')
    if (shared.answer.type !== 'geometry') throw new Error('not geometry')
    expect(shared.answer.trap).toBe('geo_shared_side_missed')
    expect(shared.answer.trapAnswer).toBe('given')
    expect(shared.answer.trapStage).toBe('c')
    expect(gradeGeoStage(shared.answer, 'c', 'given')).toMatchObject({ verdict: 'mistake', mistake: 'geo_shared_side_missed' })
    expect(gradeGeoStage(shared.answer, 'c', 'cong-refl').verdict).toBe('correct')
  })
})
