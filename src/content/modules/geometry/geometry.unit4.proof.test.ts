/**
 * Each Unit 4 two-column skeleton, with the statement and the reason written here.
 * A second name a textbook uses for the same step has to grade correct.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { gradeGeoStage } from './grade'
import { REASONS, type ReasonId } from './reasons'

const HEAVY = 120_000

const SKELETONS = [
  'sss-three',
  'sas-included',
  'asa-included',
  'aas-nonincluded',
  'hl-right',
  'sss-shared',
  'sas-vertical',
  'asa-parallel',
  'hl-perp',
  'sas-midpoint',
  'asa-bisector',
  'seg-bisector',
  'cpctc-pick',
] as const

interface Row {
  pick: 'reason' | 'statement'
  statement: string
  reason: ReasonId
  accept?: ReasonId[]
}

function proof(seed: number): { skeleton: string; answer: GeometryAnswer } {
  const p = generateProblem('geoTriangleProofs', 'gt.twocolumn', seed)
  if (p.answer.type !== 'geometry') throw new Error('not geometry')
  return { skeleton: String(p.params.skeleton), answer: p.answer }
}

function statementOf(stage: GeometryAnswer['stages'][number]): string {
  if (stage.kind === 'reason') {
    const note = stage.note ?? ''
    if (!note.startsWith('Statement: ')) throw new Error(`no statement on ${stage.id}`)
    return note.slice('Statement: '.length)
  }
  const text = stage.choices?.find((choice) => choice.id === stage.answerText)?.text
  if (!text) throw new Error(`no choice on ${stage.id}`)
  return text
}

function reasonOf(stage: GeometryAnswer['stages'][number]): { id: string; accept: string[] } {
  if (stage.kind === 'reason') return { id: stage.answerText, accept: [...(stage.accept ?? [])] }
  const reveal = stage.reveal[0] ?? ''
  const named = /supported by ([^.]+)\./.exec(reveal)
  if (!named) throw new Error(`no reason in ${reveal}`)
  const id = REASONS.find((reason) => reason.label === named[1])?.id
  if (!id) throw new Error(`unknown reason ${named[1]}`)
  const also = /Many books write (.+) for this step/.exec(reveal)
  const accept = also
    ? also[1]!.split(' or ').map((label) => {
        const hit = REASONS.find((reason) => reason.label === label)
        if (!hit) throw new Error(`unknown twin ${label}`)
        return hit.id
      })
    : []
  return { id, accept }
}

function expectRows(seed: number, skeleton: string, rows: Row[]) {
  const built = proof(seed)
  expect(built.skeleton, `seed ${seed}`).toBe(skeleton)
  expect(built.answer.stages, skeleton).toHaveLength(rows.length)
  rows.forEach((row, index) => {
    const stage = built.answer.stages[index]!
    const where = `${skeleton} row ${index + 1}`
    expect(stage.kind, where).toBe(row.pick === 'statement' ? 'choice' : 'reason')
    expect(statementOf(stage), where).toBe(row.statement)
    expect(reasonOf(stage).id, where).toBe(row.reason)
    expect(reasonOf(stage).accept, where).toEqual(row.accept ?? [])
    expect(stage.reveal[0], where).toContain(row.statement)
    expect(gradeGeoStage(built.answer, stage.id, stage.answerText).verdict, where).toBe('correct')
    for (const alt of row.accept ?? []) {
      expect(gradeGeoStage(built.answer, stage.id, alt).verdict, `${where} ${alt}`).toBe('correct')
    }
  })
}

describe('two-column triangle skeletons, each row written out', () => {
  it('sss-three: three given sides, then SSS, then a pair of corresponding angles', () => {
    expectRows(1, 'sss-three', [
      { pick: 'reason', statement: 'AB ≅ DE', reason: 'given' },
      { pick: 'reason', statement: 'BC ≅ EF', reason: 'given' },
      { pick: 'reason', statement: 'CA ≅ FD', reason: 'given' },
      { pick: 'reason', statement: '△ABC ≅ △DEF', reason: 'post-sss' },
      { pick: 'statement', statement: '∠BAC ≅ ∠EDF', reason: 'thm-cpctc' },
    ])
  })

  it('sas-included: two sides and the angle between them', () => {
    expectRows(2, 'sas-included', [
      { pick: 'reason', statement: 'AB ≅ DE', reason: 'given' },
      { pick: 'reason', statement: '∠ABC ≅ ∠DEF', reason: 'given' },
      { pick: 'reason', statement: 'BC ≅ EF', reason: 'given' },
      { pick: 'reason', statement: '△ABC ≅ △DEF', reason: 'post-sas' },
      { pick: 'statement', statement: 'AC ≅ DF', reason: 'thm-cpctc' },
    ])
  })

  it('asa-included: two angles and the included side', () => {
    expectRows(3, 'asa-included', [
      { pick: 'reason', statement: '∠BAC ≅ ∠EDF', reason: 'given' },
      { pick: 'reason', statement: 'AB ≅ DE', reason: 'given' },
      { pick: 'reason', statement: '∠ABC ≅ ∠DEF', reason: 'given' },
      { pick: 'reason', statement: '△ABC ≅ △DEF', reason: 'post-asa' },
      { pick: 'statement', statement: 'AC ≅ DF', reason: 'thm-cpctc' },
    ])
  })

  it('aas-nonincluded: two angles and a side that is not between them, under either name', () => {
    expectRows(4, 'aas-nonincluded', [
      { pick: 'reason', statement: '∠BAC ≅ ∠EDF', reason: 'given' },
      { pick: 'reason', statement: '∠ABC ≅ ∠DEF', reason: 'given' },
      { pick: 'reason', statement: 'BC ≅ EF', reason: 'given' },
      { pick: 'reason', statement: '△ABC ≅ △DEF', reason: 'thm-aas', accept: ['post-aas'] },
      { pick: 'statement', statement: 'AB ≅ DE', reason: 'thm-cpctc' },
    ])
  })

  it('hl-right: two right angles, the hypotenuse, and one leg, under either name', () => {
    expectRows(5, 'hl-right', [
      { pick: 'reason', statement: '∠ACB is a right angle', reason: 'given' },
      { pick: 'reason', statement: '∠DFE is a right angle', reason: 'given' },
      { pick: 'reason', statement: '△ABC and △DEF are right triangles', reason: 'def-right-triangle' },
      { pick: 'reason', statement: 'AB ≅ DE', reason: 'given' },
      { pick: 'reason', statement: 'BC ≅ EF', reason: 'given' },
      { pick: 'reason', statement: '△ABC ≅ △DEF', reason: 'thm-hl', accept: ['post-hl'] },
      { pick: 'statement', statement: 'AC ≅ DF', reason: 'thm-cpctc' },
    ])
  })

  it('sss-shared: the shared side matches itself', () => {
    expectRows(6, 'sss-shared', [
      { pick: 'reason', statement: 'AB ≅ AD', reason: 'given' },
      { pick: 'reason', statement: 'CB ≅ CD', reason: 'given' },
      { pick: 'reason', statement: 'AC ≅ AC', reason: 'cong-refl' },
      { pick: 'reason', statement: '△ABC ≅ △ADC', reason: 'post-sss' },
      { pick: 'statement', statement: '∠BAC ≅ ∠DAC', reason: 'thm-cpctc' },
    ])
  })

  it('sas-vertical: the included angle is a pair of vertical angles', () => {
    expectRows(7, 'sas-vertical', [
      { pick: 'reason', statement: 'AE ≅ CE', reason: 'given' },
      { pick: 'reason', statement: 'BE ≅ DE', reason: 'given' },
      { pick: 'reason', statement: '∠AEB ≅ ∠CED', reason: 'thm-vertical' },
      { pick: 'reason', statement: '△AEB ≅ △CED', reason: 'post-sas' },
      { pick: 'statement', statement: 'AB ≅ CD', reason: 'thm-cpctc' },
    ])
  })

  it('asa-parallel: alternate interior angles, then the shared diagonal', () => {
    expectRows(8, 'asa-parallel', [
      { pick: 'reason', statement: 'AB ∥ DC', reason: 'given' },
      { pick: 'reason', statement: 'AD ∥ BC', reason: 'given' },
      { pick: 'reason', statement: '∠BAC ≅ ∠DCA', reason: 'thm-alt-int' },
      { pick: 'reason', statement: '∠BCA ≅ ∠DAC', reason: 'thm-alt-int' },
      { pick: 'reason', statement: 'AC ≅ AC', reason: 'cong-refl' },
      { pick: 'reason', statement: '△ABC ≅ △CDA', reason: 'post-asa' },
      { pick: 'statement', statement: 'AB ≅ CD', reason: 'thm-cpctc' },
    ])
  })

  it('hl-perp: perpendicular lines give the right angles, then HL', () => {
    expectRows(9, 'hl-perp', [
      { pick: 'reason', statement: 'AC ⊥ BC', reason: 'given' },
      { pick: 'reason', statement: 'DF ⊥ EF', reason: 'given' },
      { pick: 'statement', statement: '∠ACB is a right angle', reason: 'def-perp' },
      { pick: 'reason', statement: '∠DFE is a right angle', reason: 'def-perp' },
      { pick: 'reason', statement: '△ABC and △DEF are right triangles', reason: 'def-right-triangle' },
      { pick: 'reason', statement: 'AB ≅ DE and AC ≅ DF', reason: 'given' },
      { pick: 'reason', statement: '△ABC ≅ △DEF', reason: 'thm-hl', accept: ['post-hl'] },
    ])
  })

  it('sas-midpoint: the midpoint makes the two halves, which are a side of SAS', () => {
    expectRows(10, 'sas-midpoint', [
      { pick: 'reason', statement: 'M is the midpoint of BC', reason: 'given' },
      { pick: 'reason', statement: 'BM ≅ MC', reason: 'def-midpoint' },
      { pick: 'reason', statement: 'AB ≅ DC', reason: 'given' },
      { pick: 'reason', statement: '∠ABM ≅ ∠DCM', reason: 'given' },
      { pick: 'reason', statement: '△ABM ≅ △DCM', reason: 'post-sas' },
      { pick: 'statement', statement: 'AM ≅ DM', reason: 'thm-cpctc' },
    ])
  })

  it('asa-bisector: the bisector makes the two halves of the angle', () => {
    expectRows(11, 'asa-bisector', [
      { pick: 'reason', statement: 'Ray BM bisects ∠ABC', reason: 'given' },
      { pick: 'reason', statement: '∠ABM ≅ ∠CBM', reason: 'def-ang-bisector' },
      { pick: 'reason', statement: '∠BAM ≅ ∠BCM', reason: 'given' },
      { pick: 'reason', statement: 'AB ≅ CB', reason: 'given' },
      { pick: 'reason', statement: '△ABM ≅ △CBM', reason: 'post-asa' },
      { pick: 'statement', statement: 'AM ≅ CM', reason: 'thm-cpctc' },
    ])
  })

  it('seg-bisector: a bisector makes a midpoint, then vertical angles', () => {
    expectRows(12, 'seg-bisector', [
      { pick: 'reason', statement: 'Line CD bisects AB at M', reason: 'given' },
      { pick: 'reason', statement: 'M is the midpoint of AB', reason: 'def-seg-bisector' },
      { pick: 'reason', statement: 'AM ≅ MB', reason: 'def-midpoint' },
      { pick: 'reason', statement: 'CM ≅ DM', reason: 'given' },
      { pick: 'reason', statement: '∠AMC ≅ ∠BMD', reason: 'thm-vertical' },
      { pick: 'reason', statement: '△AMC ≅ △BMD', reason: 'post-sas' },
      { pick: 'statement', statement: 'AC ≅ BD', reason: 'thm-cpctc' },
    ])
  })

  it('cpctc-pick: she picks the congruence statement, then the reason for a part', () => {
    expectRows(13, 'cpctc-pick', [
      { pick: 'reason', statement: 'AB ≅ DE', reason: 'given' },
      { pick: 'reason', statement: '∠ABC ≅ ∠DEF', reason: 'given' },
      { pick: 'reason', statement: 'BC ≅ EF', reason: 'given' },
      { pick: 'statement', statement: '△ABC ≅ △DEF', reason: 'post-sas' },
      { pick: 'reason', statement: '∠BAC ≅ ∠EDF', reason: 'thm-cpctc' },
    ])
    const built = proof(13)
    const stage = built.answer.stages[3]!
    expect(stage.choices?.find((choice) => choice.id === 'order')?.text).toBe('△ABC ≅ △EFD')
    expect(gradeGeoStage(built.answer, stage.id, 'order')).toMatchObject({ verdict: 'mistake', mistake: 'geo_vertices_out_of_order' })
  })

  it('every skeleton appears once in the first pass, and a missing one fails this list', () => {
    const seen = SKELETONS.map((_, index) => proof(index + 1).skeleton)
    expect(seen).toEqual([...SKELETONS])
  })

  it('a new letter set changes the names and keeps every reason', () => {
    for (let index = 0; index < SKELETONS.length; index++) {
      const base = proof(index + 1)
      const baseText = base.answer.stages.map(statementOf)
      for (const step of [1, 2, 3]) {
        const next = proof(index + 1 + step * SKELETONS.length)
        expect(next.skeleton, `seed ${index + 1 + step * SKELETONS.length}`).toBe(SKELETONS[index])
        expect(next.answer.stages.map((stage) => stage.answerText)).toEqual(base.answer.stages.map((stage) => stage.answerText))
        expect(next.answer.stages.map((stage) => stage.accept ?? [])).toEqual(base.answer.stages.map((stage) => stage.accept ?? []))
        expect(next.answer.stages.map(statementOf)).not.toEqual(baseText)
      }
    }
  }, HEAVY)
})

describe('a textbook name is accepted, and the classic swaps stay named', () => {
  it('AAS and HL take both names, ASA is not AAS, and a shared side is not given', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { skeleton, answer } = proof(seed)
      for (const stage of answer.stages) {
        const why = reasonOf(stage)
        const where = `${skeleton}/${seed} ${why.id}`
        expect(gradeGeoStage(answer, stage.id, stage.answerText).verdict, where).toBe('correct')
        if (why.id === 'thm-aas') {
          expect(why.accept, where).toEqual(['post-aas'])
          expect(gradeGeoStage(answer, stage.id, 'post-aas').verdict, where).toBe('correct')
          expect(gradeGeoStage(answer, stage.id, 'post-asa'), where).toMatchObject({ verdict: 'mistake', mistake: 'geo_asa_aas_swapped' })
        } else if (why.id === 'thm-hl') {
          expect(why.accept, where).toEqual(['post-hl'])
          expect(gradeGeoStage(answer, stage.id, 'post-hl').verdict, where).toBe('correct')
          expect(gradeGeoStage(answer, stage.id, 'post-sas'), where).toMatchObject({ verdict: 'mistake', mistake: 'geo_sas_not_included' })
        } else {
          expect(why.accept, where).toEqual([])
        }
        if (stage.kind === 'reason' && why.id === 'post-asa') {
          expect(gradeGeoStage(answer, stage.id, 'thm-aas'), where).toMatchObject({ verdict: 'mistake', mistake: 'geo_asa_aas_swapped' })
        }
        if (why.id === 'cong-refl') {
          expect(gradeGeoStage(answer, stage.id, 'given'), where).toMatchObject({ verdict: 'mistake', mistake: 'geo_shared_side_missed' })
        }
        // A statement row is not a reason. CPCTC too soon is the pick on the congruence reason itself.
        if (stage.kind === 'reason' && (why.id === 'post-sss' || why.id === 'post-sas' || why.id === 'post-asa')) {
          expect(gradeGeoStage(answer, stage.id, 'thm-cpctc'), where).toMatchObject({ verdict: 'mistake', mistake: 'geo_cpctc_too_soon' })
        }
      }
      const trap = gradeGeoStage(answer, answer.trapStage, answer.trapAnswer)
      expect(trap.verdict === 'mistake' && trap.mistake, `${skeleton}/${seed}`).toBe(answer.trap)
    }
  }, HEAVY)
})
