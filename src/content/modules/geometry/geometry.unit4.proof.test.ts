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
  statement: RegExp
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

const SIDE = /^[A-Z]{2} ≅ [A-Z]{2}$/
const ANG = /^∠[A-Z]{3} ≅ ∠[A-Z]{3}$/
const CONG = /^△[A-Z]{3} ≅ △[A-Z]{3}$/
const RIGHT = /^∠[A-Z]{3} is a right angle$/
const BOTH = /^△[A-Z]{3} and △[A-Z]{3} are right triangles$/
const PARA = /^[A-Z]{2} ∥ [A-Z]{2}$/
const PERP = /^[A-Z]{2} ⊥ [A-Z]{2}$/
const MID = /^M is the midpoint of [A-Z]{2}$/
const RAY = /^Ray [A-Z]M bisects ∠[A-Z]{3}$/
const LINE = /^Line [A-Z]{2} bisects [A-Z]{2} at M$/

/** Sorted vertex pairs. Two writings of one correspondence share a key. */
function congKey(text: string): string | null {
  const m = /△([A-Z]{3}) ≅ △([A-Z]{3})/.exec(text)
  if (!m) return null
  return [...m[1]!]
    .map((ch, i) => `${ch}${m[2]![i]!}`)
    .sort()
    .join('-')
}

function undirected(name: string): string {
  const [a, b] = [name[0]!, name[1]!]
  return a < b ? `${a}${b}` : `${b}${a}`
}

function triSides(tri: string): Set<string> {
  const sides = new Set<string>()
  for (let i = 0; i < 3; i++) sides.add(undirected(`${tri[i]!}${tri[(i + 1) % 3]!}`))
  return sides
}

function expectRows(seed: number, skeleton: string, rows: Row[]) {
  const built = proof(seed)
  expect(built.skeleton, `seed ${seed}`).toBe(skeleton)
  expect(built.answer.stages, skeleton).toHaveLength(rows.length)
  expect(built.answer.prompt, skeleton).toMatch(/^Given: .+\. Prove: .+\.$/)
  const proved = /\. Prove: (.+)\.$/.exec(built.answer.prompt)?.[1]
  const given = /^Given: (.+)\. Prove: /.exec(built.answer.prompt)?.[1] ?? ''
  let proveHits = 0
  rows.forEach((row, index) => {
    const stage = built.answer.stages[index]!
    const where = `${skeleton} row ${index + 1}`
    const text = statementOf(stage)
    expect(stage.kind, where).toBe(row.pick === 'statement' ? 'choice' : 'reason')
    expect(text, where).toMatch(row.statement)
    expect(reasonOf(stage).id, where).toBe(row.reason)
    expect(reasonOf(stage).accept, where).toEqual(row.accept ?? [])
    expect(stage.reveal[0], where).toContain(text)
    expect(gradeGeoStage(built.answer, stage.id, stage.answerText).verdict, where).toBe('correct')
    for (const alt of row.accept ?? []) {
      expect(gradeGeoStage(built.answer, stage.id, alt).verdict, `${where} ${alt}`).toBe('correct')
    }
    if (text.includes(' and ') && !text.endsWith('are right triangles')) throw new Error(`${where} states two facts`)
    if (row.reason === 'given') expect(given.includes(text), where).toBe(true)
    if (text === proved) {
      proveHits += 1
      expect(stage.kind, where).toBe('reason')
    }
  })
  expect(proveHits, `${skeleton} prove line`).toBe(1)
}

describe('two-column triangle skeletons, each row written out', () => {
  it('sss-three: three given sides, then SSS, then a pair of corresponding angles', () => {
    expectRows(1, 'sss-three', [
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'post-sss' },
      { pick: 'reason', statement: ANG, reason: 'thm-cpctc' },
    ])
  })

  it('sas-included: two sides and the angle between them', () => {
    expectRows(2, 'sas-included', [
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'post-sas' },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('asa-included: two angles and the included side', () => {
    expectRows(3, 'asa-included', [
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'post-asa' },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('aas-nonincluded: two angles and a side that is not between them, under either name', () => {
    expectRows(4, 'aas-nonincluded', [
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'thm-aas', accept: ['post-aas'] },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('hl-right: two right angles, the hypotenuse, and one leg, under either name', () => {
    expectRows(5, 'hl-right', [
      { pick: 'reason', statement: RIGHT, reason: 'given' },
      { pick: 'reason', statement: RIGHT, reason: 'given' },
      { pick: 'reason', statement: BOTH, reason: 'def-right-triangle' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'thm-hl', accept: ['post-hl'] },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('sss-shared: the shared side is congruent to itself', () => {
    expectRows(6, 'sss-shared', [
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'cong-refl' },
      { pick: 'reason', statement: CONG, reason: 'post-sss' },
      { pick: 'reason', statement: ANG, reason: 'thm-cpctc' },
    ])
  })

  it('sas-vertical: the included angle is a pair of vertical angles', () => {
    expectRows(7, 'sas-vertical', [
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'thm-vertical' },
      { pick: 'reason', statement: CONG, reason: 'post-sas' },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('asa-parallel: alternate interior angles, then the shared diagonal', () => {
    expectRows(8, 'asa-parallel', [
      { pick: 'reason', statement: PARA, reason: 'given' },
      { pick: 'reason', statement: PARA, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'thm-alt-int' },
      { pick: 'reason', statement: ANG, reason: 'thm-alt-int' },
      { pick: 'reason', statement: SIDE, reason: 'cong-refl' },
      { pick: 'reason', statement: CONG, reason: 'post-asa' },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('hl-perp: perpendicular lines give the right angles, then HL', () => {
    expectRows(9, 'hl-perp', [
      { pick: 'reason', statement: PERP, reason: 'given' },
      { pick: 'reason', statement: PERP, reason: 'given' },
      { pick: 'statement', statement: RIGHT, reason: 'def-perp' },
      { pick: 'reason', statement: RIGHT, reason: 'def-perp' },
      { pick: 'reason', statement: BOTH, reason: 'def-right-triangle' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'thm-hl', accept: ['post-hl'] },
    ])
  })

  it('sas-midpoint: the midpoint makes the two halves, which are a side of SAS', () => {
    expectRows(10, 'sas-midpoint', [
      { pick: 'reason', statement: MID, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'def-midpoint' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'post-sas' },
      { pick: 'statement', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('asa-bisector: the bisector makes the two halves of the angle', () => {
    expectRows(11, 'asa-bisector', [
      { pick: 'reason', statement: RAY, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'def-ang-bisector' },
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: CONG, reason: 'post-asa' },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('seg-bisector: a bisector makes a midpoint, then vertical angles', () => {
    expectRows(12, 'seg-bisector', [
      { pick: 'reason', statement: LINE, reason: 'given' },
      { pick: 'reason', statement: MID, reason: 'def-seg-bisector' },
      { pick: 'reason', statement: SIDE, reason: 'def-midpoint' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'thm-vertical' },
      { pick: 'reason', statement: CONG, reason: 'post-sas' },
      { pick: 'reason', statement: SIDE, reason: 'thm-cpctc' },
    ])
  })

  it('cpctc-pick: she picks the congruence statement, then the reason for a part', () => {
    expectRows(13, 'cpctc-pick', [
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'reason', statement: ANG, reason: 'given' },
      { pick: 'reason', statement: SIDE, reason: 'given' },
      { pick: 'statement', statement: CONG, reason: 'post-sas' },
      { pick: 'reason', statement: ANG, reason: 'thm-cpctc' },
    ])
  })

  it('a congruence written in another order of the same correspondence is not a distractor', () => {
    for (let step = 0; step < 20; step++) {
      const seed = 13 + step * SKELETONS.length
      const built = proof(seed)
      const stage = built.answer.stages[3]!
      const right = statementOf(stage)
      const key = congKey(right)
      expect(key, `seed ${seed}`).toBeTruthy()
      const same = (stage.choices ?? []).filter((choice) => congKey(choice.text) === key)
      expect(same, `seed ${seed}`).toHaveLength(1)
      expect(same[0]!.text).toBe(right)
      const order = stage.choices?.find((choice) => choice.id === 'order')
      expect(congKey(order?.text ?? ''), `seed ${seed}`).not.toBe(key)
      expect(order?.trap).toBe('geo_vertices_out_of_order')
      expect(gradeGeoStage(built.answer, stage.id, 'order')).toMatchObject({
        verdict: 'mistake',
        mistake: 'geo_vertices_out_of_order',
      })
    }
  })

  it('the midpoint CPCTC trap pairs two real sides, and a side that is not a side of either triangle is plain wrong', () => {
    for (let step = 0; step < 20; step++) {
      const seed = 10 + step * SKELETONS.length
      const built = proof(seed)
      const stage = built.answer.stages[5]!
      const right = statementOf(stage)
      const names = /^Triangles ([A-Z]{3}) and ([A-Z]{3})\./.exec(built.answer.figure.ariaLabel)
      expect(names, `seed ${seed}`).toBeTruthy()
      const sides = new Set<string>([...triSides(names![1]!), ...triSides(names![2]!)])
      const order = stage.choices?.find((choice) => choice.id === 'order')
      const halves = /^([A-Z]{2}) ≅ ([A-Z]{2})$/.exec(order?.text ?? '')
      expect(halves, `seed ${seed} ${order?.text}`).toBeTruthy()
      expect(sides.has(undirected(halves![1]!)) && sides.has(undirected(halves![2]!)), order?.text).toBe(true)
      expect(order?.text).not.toBe(right)
      expect(order?.trap).toBe('geo_vertices_out_of_order')
      expect(gradeGeoStage(built.answer, stage.id, 'order')).toMatchObject({
        verdict: 'mistake',
        mistake: 'geo_vertices_out_of_order',
      })
      for (const choice of stage.choices ?? []) {
        const parts = /^([A-Z]{2}) ≅ ([A-Z]{2})$/.exec(choice.text)
        if (!parts) continue
        if (!sides.has(undirected(parts[1]!)) || !sides.has(undirected(parts[2]!))) {
          expect(choice.trap, `${seed} ${choice.text}`).toBeUndefined()
        }
      }
    }
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
          // One pair of sides is not "the angle is not between the two sides."
          expect(gradeGeoStage(answer, stage.id, 'post-sas').verdict, where).toBe('wrong')
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
