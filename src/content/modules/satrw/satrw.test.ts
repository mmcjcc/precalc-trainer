import { describe, expect, it } from 'vitest'
import { generateProblem, getCourse, getModule, unitsWithModules } from '@/content'
import type { SatRwAnswer } from '@/content/types'
import { ERROR_PATTERNS } from '@/engine'
import type { ModuleId } from '@/shared/types'
import { gradeSatRwChoice, SATRW_MISTAKE_IDS } from './index'

const TEMPLATES: readonly { moduleId: ModuleId; templateId: string }[] = [
  { moduleId: 'rwBoundaries' as ModuleId, templateId: 'rb.join' },
  { moduleId: 'rwBoundaries' as ModuleId, templateId: 'rb.inside' },
  { moduleId: 'rwFormSense' as ModuleId, templateId: 'rf.agree' },
  { moduleId: 'rwFormSense' as ModuleId, templateId: 'rf.pronoun' },
  { moduleId: 'rwTransitions' as ModuleId, templateId: 'rt.pick' },
]

function expectCleanText(text: string, context: string): void {
  expect(text.trim().length, `${context}: non-empty`).toBeGreaterThan(0)
  expect(text, `${context}: no placeholder braces`).not.toMatch(/[{}]/)
  expect(text, `${context}: no double spaces`).not.toMatch(/ {2,}/)
  expect(text, `${context}: no stray periods`).not.toMatch(/\.\.| \./)
}

describe('SAT Reading & Writing modules (rwBoundaries, rwFormSense, rwTransitions)', () => {
  describe('300-seed sweep per template', () => {
    for (const { moduleId, templateId } of TEMPLATES) {
      it(`${moduleId}/${templateId}: deterministic, 1 correct option, 4 distinct options, clean prose, named mistakes & nudges across 300 seeds`, () => {
        const mod = getModule(moduleId)
        const ruleIds = new Set(mod.ruleCards.map((c) => c.id))
        const mistakeSet = new Set<string>(SATRW_MISTAKE_IDS)

        for (let seed = 1; seed <= 300; seed++) {
          const inst1 = generateProblem(moduleId, templateId, seed)
          const inst2 = generateProblem(moduleId, templateId, seed)
          expect(inst1, `seed ${seed} deterministic`).toEqual(inst2)

          expect(inst1.kind).toBe('satrw')
          expect(inst1.answer.type).toBe('satrw')
          const answer = inst1.answer as SatRwAnswer

          expectCleanText(inst1.statementText, `${templateId}@${seed} statementText`)
          expectCleanText(answer.prompt, `${templateId}@${seed} prompt`)
          expectCleanText(answer.nudge, `${templateId}@${seed} nudge`)
          expectCleanText(answer.correctMessage, `${templateId}@${seed} correctMessage`)

          expect(ruleIds.has(answer.ruleCard), `${templateId}@${seed} ruleCard in module`).toBe(true)
          expect(answer.reveal.length, `${templateId}@${seed} reveal non-empty`).toBeGreaterThanOrEqual(2)
          for (const [idx, line] of answer.reveal.entries()) {
            expectCleanText(line, `${templateId}@${seed} reveal[${idx}]`)
          }

          expect(answer.options).toHaveLength(4)
          expect(answer.options.map((o) => o.id)).toEqual(['A', 'B', 'C', 'D'])

          const optionTexts = answer.options.map((o) => o.text)
          expect(new Set(optionTexts).size, `${templateId}@${seed} four distinct options`).toBe(4)

          let correctCount = 0
          const wrongMistakes: string[] = []

          for (const opt of answer.options) {
            expectCleanText(opt.text, `${templateId}@${seed} option ${opt.id} text`)
            const byId = gradeSatRwChoice(answer, opt.id)
            const byText = gradeSatRwChoice(answer, opt.text)
            expect(byId).toEqual(byText)

            if (byId.verdict === 'correct') {
              correctCount++
              expect(opt.id).toBe(answer.correctId)
              expect(opt.text).toBe(answer.correctText)
              expect(opt.mistake).toBeUndefined()
            } else {
              expect(byId.verdict).toBe('mistake')
              expect(opt.mistake, `${templateId}@${seed} option ${opt.id} mistake id`).toBeTruthy()
              expect(mistakeSet.has(opt.mistake!), `${templateId}@${seed} option ${opt.id} mistake ${opt.mistake} in SATRW_MISTAKE_IDS`).toBe(true)
              expect(opt.mistake! in ERROR_PATTERNS, `${templateId}@${seed} option ${opt.id} mistake in ERROR_PATTERNS`).toBe(true)
              expect(opt.nudge, `${templateId}@${seed} option ${opt.id} nudge`).toBeTruthy()
              expectCleanText(opt.nudge!, `${templateId}@${seed} option ${opt.id} nudge`)
              wrongMistakes.push(opt.mistake!)
            }
          }

          expect(correctCount, `${templateId}@${seed} exactly one correct option`).toBe(1)

          if (templateId === 'rt.pick') {
            // In rt.pick, the three wrong options must come from three distinct wrong relation families
            expect(new Set(wrongMistakes).size, `rt.pick@${seed} distinct wrong transition families`).toBe(3)
          }
        }
      })
    }
  })

  describe('distinctness over seeds 1..60', () => {
    for (const { moduleId, templateId } of TEMPLATES) {
      it(`${moduleId}/${templateId}: generates at least 40 distinct statements over seeds 1..60`, () => {
        const statements = new Set<string>()
        for (let seed = 1; seed <= 60; seed++) {
          const inst = generateProblem(moduleId, templateId, seed)
          statements.add(inst.statementText)
        }
        expect(statements.size).toBeGreaterThanOrEqual(40)
      })
    }
  })

  describe('satrw course units', () => {
    it('registers four domains in order and lists only the two non-empty domains via unitsWithModules', () => {
      const satrw = getCourse('satrw')
      expect(satrw).toBeDefined()
      expect(satrw!.title).toBe('SAT Reading & Writing')
      expect(satrw!.short).toBe('SAT R&W')
      expect(satrw!.units.map((u) => u.id)).toEqual([
        'satrw-info',
        'satrw-craft',
        'satrw-expression',
        'satrw-conventions',
      ])
      for (const u of satrw!.units) {
        expect(u.reviewId).toBeUndefined()
      }
      const nonEmpty = unitsWithModules(satrw!)
      expect(nonEmpty.map((u) => u.id)).toEqual(['satrw-expression', 'satrw-conventions'])
    })
  })
})
