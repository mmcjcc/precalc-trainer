/**
 * Honors geometry Unit 2. Every seed grades its own answers, keeps the promised trap as a real
 * candidate, and leaves the answer out of anything she can read before she finishes.
 */
import { describe, expect, it } from 'vitest'
import { generateProblem, getModule } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import type { ModuleId } from '@/shared/types'
import { GEO_UNIT2_MISTAKE_IDS, containsAnswer, exampleShowsAnswer, gradeGeoStage, stageDisplay } from './grade'
import { auditBank } from './bank'
import { LOGIC_RULES, PROOF_RULES } from './unit2Rules'
import type { GeometryAnswer } from './build'

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
const HEAVY = 120_000

const TEMPLATES: { module: ModuleId; template: string }[] = [
  { module: 'geoLogic', template: 'gl.related' },
  { module: 'geoLogic', template: 'gl.truth' },
  { module: 'geoLogic', template: 'gl.laws' },
  { module: 'geoProof', template: 'gp.reason' },
  { module: 'geoProof', template: 'gp.algebraic' },
  { module: 'geoProof', template: 'gp.twocolumn' },
]

function answerOf(module: ModuleId, template: string, seed: number): GeometryAnswer {
  const p = generateProblem(module, template, seed)
  if (p.answer.type !== 'geometry') throw new Error(`${template}/${seed} is ${p.answer.type}`)
  return p.answer
}

describe('geometry unit 2 registration', () => {
  it('puts both modules after the Unit 1 modules', () => {
    const logic = getModule('geoLogic')
    const proof = getModule('geoProof')
    expect(logic.subject).toBe('Geometry')
    expect(proof.subject).toBe('Geometry')
    expect(logic.title).toBe('Conditionals and logic')
    expect(proof.title).toBe('Properties and proofs')
    expect(logic.order).toBe(11)
    expect(proof.order).toBe(12)
    expect(logic.order).toBeGreaterThan(getModule('geoAngles').order)
    expect(logic.templates.map((t) => t.id)).toEqual(['gl.related', 'gl.truth', 'gl.laws'])
    expect(proof.templates.map((t) => t.id)).toEqual(['gp.reason', 'gp.algebraic', 'gp.twocolumn'])
    const sample = generateProblem('geoLogic', 'gl.related', 1)
    expect(logic.progress(sample, null, false)).toMatchObject({ stage: 0, total: 1 })
    expect(logic.nextStep(sample, null, false)).toBeNull()
    expect(proof.nextStep(sample, null, false)).toBeNull()
  })

  it('the statement bank is internally consistent', () => {
    expect(auditBank()).toEqual([])
  })

  it('seed 1 of each template shows the trap named in the progress log', () => {
    const trap = (module: ModuleId, template: string) => answerOf(module, template, 1).trap
    expect(trap('geoLogic', 'gl.related')).toBe('geo_converse_inverse_swapped')
    expect(trap('geoLogic', 'gl.truth')).toBe('geo_false_converse')
    expect(trap('geoLogic', 'gl.laws')).toBe('geo_affirm_conclusion')
    expect(trap('geoProof', 'gp.reason')).toBe('geo_reflexive_for_symmetric')
    expect(trap('geoProof', 'gp.algebraic')).toBe('geo_reflexive_for_symmetric')
    expect(trap('geoProof', 'gp.twocolumn')).toBe('geo_addition_for_midpoint')
  })
})

describe.each(TEMPLATES)('$module/$template over 300 seeds', ({ module, template }) => {
  const cards = new Set(getModule(module).ruleCards.map((c) => c.id))

  it('is deterministic, validates its answers, and keeps the trap as a real candidate', () => {
    for (const seed of SEEDS) {
      const p = generateProblem(module, template, seed)
      expect(generateProblem(module, template, seed)).toEqual(p)
      expect(() => JSON.stringify(p)).not.toThrow()
      expect(p.id).toBe(`${module}/${template}@1/${seed.toString(36)}`)
      expect(p.kind).toBe('geometry')
      expect(p.graph).toEqual({ kind: 'none' })
      expect(p.statementText).toBe(p.answer.type === 'geometry' ? p.answer.prompt : '')
      if (p.answer.type !== 'geometry') throw new Error('not geometry')
      const a = p.answer
      expect(a.stages.length).toBeGreaterThan(0)
      expect(a.stages.length).toBeLessThanOrEqual(8)
      for (const id of a.ruleCards) expect(cards.has(id), id).toBe(true)
      const before = [a.prompt, a.figure.ariaLabel, ...(a.lines ?? [])]
      for (const stage of a.stages) before.push(stage.hint, stage.nudge, stage.note ?? '')
      const blob = before.join('\n')
      for (const stage of a.stages) {
        expect(cards.has(stage.ruleCard), stage.ruleCard).toBe(true)
        expect(gradeGeoStage(a, stage.id, stage.answerText).verdict, `${p.id} ${stage.id}`).toBe('correct')
        const display = stageDisplay(stage)
        expect(containsAnswer(blob, display), `${p.id} shows “${display}”`).toBe(false)
        expect(display).not.toBe('x = 4')
        expect(display).not.toMatch(/\bJK\b|\bLM\b|angle 8/)
        for (const line of stage.reveal) expect(a.prompt.includes(line), line).toBe(false)
        if (stage.kind === 'choice') {
          const correct = (stage.choices ?? []).filter((choice) => choice.id === stage.answerText)
          expect(correct).toHaveLength(1)
        }
      }
      for (const label of a.figure.angles ?? []) expect(label.label).not.toBe('8')
      const promised = a.stages.find((s) => s.id === a.trapStage)
      expect(promised?.traps.some((t) => t.id === a.trap && t.text === a.trapAnswer), `${p.id} ${a.trap}`).toBe(true)
      const trapGrade = gradeGeoStage(a, a.trapStage, a.trapAnswer)
      expect(trapGrade.verdict, `${p.id} ${a.trapAnswer}`).toBe('mistake')
      if (trapGrade.verdict === 'mistake') expect(trapGrade.mistake).toBe(a.trap)
      // A pick that is not the trap is a plain wrong answer, with no named lesson.
      const plain = gradeGeoStage(a, a.stages[0]!.id, a.stages[0]!.kind === 'reason' ? 'eq-mul' : 'not-a-listed-choice')
      if (a.stages[0]!.answerText !== 'eq-mul') {
        expect(['wrong', 'invalid']).toContain(plain.verdict)
      }
    }
  }, HEAVY)
})

describe('geometry unit 2 trap coverage', () => {
  it('every new geo_ id is a real candidate on some seed', () => {
    const seen = new Set<string>()
    for (const { module, template } of TEMPLATES) {
      for (const seed of SEEDS) {
        const a = answerOf(module, template, seed)
        for (const stage of a.stages) for (const trap of stage.traps) seen.add(trap.id)
      }
    }
    for (const id of GEO_UNIT2_MISTAKE_IDS) expect(seen.has(id), id).toBe(true)
    for (const id of GEO_UNIT2_MISTAKE_IDS) {
      expect(ERROR_PATTERNS[id].example).toContain('✗')
      expect(ERROR_PATTERNS[id].lesson.length).toBeGreaterThan(0)
    }
  }, HEAVY)

  it('rule cards and catalog examples use the reserved story, not a generated answer, over 2000 seeds', () => {
    const rules = [...LOGIC_RULES, ...PROOF_RULES]
    const clashes: string[] = []
    for (const { module, template } of TEMPLATES) {
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
          for (const card of rules) {
            const blob = `${card.title}\n${card.body}\n${card.example ?? ''}`
            if (containsAnswer(blob, display)) clashes.push(`${template}/${seed} ${display}: rule ${card.id}`)
          }
        }
      }
    }
    expect(clashes.slice(0, 8)).toEqual([])
  }, HEAVY)
})
