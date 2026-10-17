/**
 * Unit 2 solved again from the wording, over 2000 seeds. A proof that is true for every x, a logic
 * choice that is not the sentence the prompt asked for, or a note that contains the answer fails here.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { GeometryAnswer } from '@/content/types'
import type { ModuleId } from '@/shared/types'
import { containsAnswer, gradeGeoStage, stageDisplay } from './grade'
import { LOGIC_RULES, PROOF_RULES } from './unit2Rules'
import { auditAlgebra, auditLogic, auditReasonLine, auditTwoColumn } from './unit2Check'

const HEAVY = 120_000
const SEEDS = 2000

const LOGIC = [
  ['geoLogic', 'gl.related'],
  ['geoLogic', 'gl.truth'],
  ['geoLogic', 'gl.laws'],
] as const

function problem(module: ModuleId, template: string, seed: number): GeometryAnswer & { skeleton: string } {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error('not geometry')
  return Object.assign(p.answer, { skeleton: String(p.params.skeleton ?? '') })
}

function leaks(answer: GeometryAnswer, cards: readonly { body: string; example?: string }[]): string[] {
  const errors: string[] = []
  for (const stage of answer.stages) {
    const display = stageDisplay(stage)
    const replies = [
      gradeGeoStage(answer, stage.id, ''),
      gradeGeoStage(answer, stage.id, stage.kind === 'reason' ? 'eq-mul' : 'not-a-listed-choice'),
    ]
    if (stage.answerText !== 'eq-mul') {
      for (const grade of replies) {
        const said = grade.verdict === 'mistake' ? grade.witness : grade.message
        if (containsAnswer(said, display)) errors.push(`${stage.id} message contains “${display}”`)
      }
    }
    for (const trap of stage.traps) {
      if (containsAnswer(trap.witness, display)) errors.push(`${stage.id} witness contains “${display}”`)
      const info = ERROR_PATTERNS[trap.id]
      const lesson = `${info.title}\n${info.lesson}\n${info.example}`
      if (containsAnswer(lesson, display)) errors.push(`${stage.id} catalog ${trap.id} contains “${display}”`)
    }
    for (const card of cards) {
      if (containsAnswer(`${card.body}\n${card.example ?? ''}`, display)) errors.push(`${stage.id} rule card contains “${display}”`)
    }
    for (const said of [stage.hint, stage.nudge, stage.note ?? '']) {
      if (containsAnswer(said, display)) errors.push(`${stage.id} shows “${display}” in ${said}`)
    }
  }
  return errors
}

describe('unit 2 logic, solved again from the wording', () => {
  it.each(LOGIC)('%s/%s agrees over 2000 seeds', (module, template) => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const answer = problem(module, template, seed)
      const where = `${template}/${seed}`
      expect(auditLogic(answer.question, answer.prompt, answer), where).toEqual([])
      expect(leaks(answer, LOGIC_RULES), where).toEqual([])
      for (const stage of answer.stages) {
        const hits = (stage.choices ?? []).filter((choice) => choice.id === stage.answerText)
        expect(hits, where).toHaveLength(1)
      }
    }
  }, HEAVY)
})

describe('unit 2 proofs, solved again from the wording', () => {
  it('gp.reason: the sentence picks the reason, over 2000 seeds', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const answer = problem('geoProof', 'gp.reason', seed)
      const statement = answer.prompt.split('\n')[1] ?? ''
      expect(auditReasonLine(statement), `${seed} ${statement}`).toBe(answer.stages[0]!.answerText)
      expect(leaks(answer, PROOF_RULES), `gp.reason/${seed}`).toEqual([])
    }
  }, HEAVY)

  it('gp.algebraic: exactly one solution, over 2000 seeds', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const answer = problem('geoProof', 'gp.algebraic', seed)
      const reasons = answer.stages.map((stage) => stage.answerText)
      expect(auditAlgebra(answer.skeleton, answer.lines ?? [], reasons), `gp.algebraic/${seed}`).toEqual([])
      expect(leaks(answer, PROOF_RULES), `gp.algebraic/${seed}`).toEqual([])
    }
  }, HEAVY)

  it('gp.twocolumn: every skeleton stays valid, over 2000 seeds', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= SEEDS; seed++) {
      const answer = problem('geoProof', 'gp.twocolumn', seed)
      seen.add(answer.skeleton)
      expect(auditTwoColumn(answer.skeleton, answer.prompt, answer), `gp.twocolumn/${seed} ${answer.prompt}`).toEqual([])
      expect(leaks(answer, PROOF_RULES), `gp.twocolumn/${seed}`).toEqual([])
    }
    expect(seen.size).toBe(12)
  }, HEAVY)
})
