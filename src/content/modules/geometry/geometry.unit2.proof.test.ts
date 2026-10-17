/**
 * Each two-column skeleton, read again from its own wording. The expected reason on every row is
 * written here, not copied out of the generator's trap table.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import type { GeometryAnswer } from '@/content/types'
import { auditAlgebra, auditReasonLine, auditTwoColumn } from './unit2Check'

const HEAVY = 120_000

const SKELETONS = [
  'midpoint-algebra',
  'seg-overlap',
  'linear-supp',
  'vertical-prove',
  'vertical-apply',
  'cong-supplements',
  'cong-complements',
  'right-angles',
  'angle-bisector',
  'segment-bisector',
  'transitive-segments',
  'perpendicular',
] as const

function proof(seed: number): { skeleton: string; prompt: string; answer: GeometryAnswer } {
  const p = generateProblem('geoProof', 'gp.twocolumn', seed)
  if (p.answer.type !== 'geometry') throw new Error('not geometry')
  return { skeleton: String(p.params.skeleton), prompt: p.answer.prompt, answer: p.answer }
}

describe('two-column skeletons, each reason justified by hand', () => {
  it.each(SKELETONS)('%s holds for several salts and letter sets', (skeleton) => {
    const index = SKELETONS.indexOf(skeleton)
    for (const step of [0, 1, 2, 3, 5, 8]) {
      const seed = index + 1 + step * SKELETONS.length
      const built = proof(seed)
      expect(built.skeleton, `seed ${seed}`).toBe(skeleton)
      expect(auditTwoColumn(built.skeleton, built.prompt, built.answer), `${skeleton}/${seed} ${built.prompt}`).toEqual([])
    }
  })

  it('every skeleton appears, and none of them is true for every x', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= SKELETONS.length; seed++) {
      const built = proof(seed)
      seen.add(built.skeleton)
      expect(auditTwoColumn(built.skeleton, built.prompt, built.answer), built.prompt).toEqual([])
    }
    expect([...seen]).toEqual([...SKELETONS])
  }, HEAVY)
})

describe('algebraic proofs, solved again from the lines', () => {
  it('each line follows from the line before it, and x is unique', () => {
    for (let seed = 1; seed <= 90; seed++) {
      const p = generateProblem('geoProof', 'gp.algebraic', seed)
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const reasons = p.answer.stages.map((stage) => stage.answerText)
      expect(auditAlgebra(String(p.params.skeleton), p.answer.lines ?? [], reasons), `${p.params.skeleton}/${seed}`).toEqual([])
    }
  }, HEAVY)
})

describe('a single proof line names its own reason', () => {
  it('the sentence, not the seed, decides the reason', () => {
    for (let seed = 1; seed <= 90; seed++) {
      const p = generateProblem('geoProof', 'gp.reason', seed)
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const statement = p.answer.prompt.split('\n')[1] ?? ''
      expect(auditReasonLine(statement), statement).toBe(p.answer.stages[0]!.answerText)
    }
  }, HEAVY)
})
