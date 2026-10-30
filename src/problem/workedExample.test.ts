import { beforeEach, describe, expect, it } from 'vitest'
import { generateProblem, MODULES } from '@/content'
import type { ModuleId } from '@/shared/types'
import {
  buildWorkedExample,
  COVERED_PARTS_TEMPLATES,
  COVERED_STEP_TEMPLATES,
  offersExample,
  recordExampleViewed,
} from '@/problem/workedExample'
import { defaultPersisted, useStore } from '@/store'

function findModuleForTemplate(templateId: string): ModuleId {
  for (const mod of MODULES) {
    if (mod.templates.some((t) => t.id === templateId)) return mod.id
  }
  throw new Error(`No module found for template ${templateId}`)
}

describe('workedExample coverage and honesty rules', () => {
  beforeEach(() => {
    useStore.setState(defaultPersisted(1_700_000_000_000))
  })

  describe('line-by-line templates walk nextStep to completion and pass the module checker', () => {
    for (const templateId of COVERED_STEP_TEMPLATES) {
      it(`${templateId}: walks to completion and checks every line across 25 seeds`, () => {
        const moduleId = findModuleForTemplate(templateId)
        for (let seed = 1; seed <= 25; seed++) {
          const instance = generateProblem(moduleId, templateId, seed * 97 + 13)
          expect(offersExample(instance)).toBe(true)
          const ex = buildWorkedExample(instance)
          expect(ex).not.toBeNull()
          if (!ex || ex.kind !== 'steps') throw new Error(`Expected steps example for ${templateId}`)
          expect(ex.sibling.seed).not.toBe(instance.seed)
          expect(ex.sibling.statementText.trim()).not.toBe(instance.statementText.trim())
          expect(ex.everyLineChecked).toBe(true)
          expect(ex.lines.length).toBeGreaterThanOrEqual(1)
          for (const line of ex.lines) {
            expect(line.checked).toBe(true)
            expect(line.text.trim().length).toBeGreaterThan(0)
            expect(line.nudge.trim().length).toBeGreaterThan(0)
          }
        }
      })
    }
  })

  describe('parts / answer templates render each part with an answer and reason across seeds', () => {
    for (const templateId of COVERED_PARTS_TEMPLATES) {
      it(`${templateId}: builds sibling example with distinct statement and complete parts across 12 seeds`, () => {
        const moduleId = findModuleForTemplate(templateId)
        for (let seed = 1; seed <= 12; seed++) {
          const instance = generateProblem(moduleId, templateId, seed * 131 + 7)
          expect(offersExample(instance)).toBe(true)
          const ex = buildWorkedExample(instance)
          expect(ex).not.toBeNull()
          if (!ex || ex.kind !== 'parts') throw new Error(`Expected parts example for ${templateId}`)
          expect(ex.sibling.seed).not.toBe(instance.seed)
          expect(ex.sibling.statementText.trim()).not.toBe(instance.statementText.trim())
          expect(ex.parts.length).toBeGreaterThanOrEqual(1)
          for (const part of ex.parts) {
            expect(part.label.trim().length).toBeGreaterThan(0)
            expect(part.answer.trim().length).toBeGreaterThan(0)
            expect(part.why.trim().length).toBeGreaterThan(0)
          }
        }
      })
    }
  })

  it('steps to the next candidate seed when a candidate produces the same statementText', () => {
    const base = generateProblem('inequalities', 'ineq.linear', 42)
    const firstEx = buildWorkedExample(base, 1)
    expect(firstEx).not.toBeNull()
    const colliding = {
      ...base,
      statementText: firstEx!.sibling.statementText,
    }
    const steppedEx = buildWorkedExample(colliding, 1)
    expect(steppedEx).not.toBeNull()
    expect(steppedEx!.sibling.statementText.trim()).not.toBe(colliding.statementText.trim())
    expect(steppedEx!.sibling.seed).not.toBe(colliding.seed)
  })

  it('excludes uncovered templates and own-problem instances', () => {
    const uncovered: [ModuleId, string][] = [
      ['quadratics', 'cs.form'],
      ['evenOdd', 'evenOdd.poly'],
      ['evenOdd', 'evenOdd.special'],
      ['inverses', 'inv.quadratic-not'],
      ['expLogGraphs', 'eg.match'],
      ['piecewiseRate', 'pw.domain'],
      ['graphFeatures', 'gf.read'],
    ]
    for (const [moduleId, templateId] of uncovered) {
      const inst = generateProblem(moduleId, templateId, 17)
      expect(offersExample(inst)).toBe(false)
      expect(buildWorkedExample(inst)).toBeNull()
    }

    const ownInst = {
      ...generateProblem('inequalities', 'ineq.linear', 17),
      own: '2x + 3 < 9',
    }
    expect(offersExample(ownInst)).toBe(false)
    expect(buildWorkedExample(ownInst)).toBeNull()
  })

  it('logs example_viewed without touching the active attempt first-try or revealed state', () => {
    const inst = generateProblem('inequalities', 'ineq.linear', 99)
    useStore.getState().startAttempt({
      problemId: inst.id,
      moduleId: inst.moduleId,
      templateId: inst.templateId,
      skill: inst.skill,
      seed: inst.seed.toString(36),
      difficulty: '',
      genVersion: inst.genVersion,
      mode: 'normal',
    })
    useStore.getState().acceptStep({
      text: '2x < 6',
      propertyTag: 'sub_both',
    })

    recordExampleViewed(inst.skill, inst.moduleId, 1_700_000_005_000)

    const state = useStore.getState()
    const exEvents = state.events.filter((e) => e.t === 'example_viewed')
    expect(exEvents).toEqual([
      {
        t: 'example_viewed',
        skill: 'ineq.linear',
        moduleId: 'inequalities',
        at: 1_700_000_005_000,
      },
    ])
    expect(state.attempt?.steps[0]?.firstTry).toBe(true)
    expect(state.attempt?.steps[0]?.revealed).toBe(false)
    expect(state.attempt?.hintsUsed).toEqual({})
    expect(state.attempt?.final?.revealed).toBeUndefined()
  })
})
