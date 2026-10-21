import { describe, expect, it } from 'vitest'
import { allTemplates, generateProblem } from '@/content'
import { offersLineCards } from './cardSources'
import { PICK_MODULES, STEP_KINDS, STEP_MODULES } from './solveStyle'

describe('which problem types are solved step by step', () => {
  it('the declared modules match every template: a step module has only step kinds, and every step kind is in one', { timeout: 120_000 }, () => {
    const stepModulesSeen = new Set<string>()
    const pickModulesSeen = new Set<string>()
    for (const { module, template } of allTemplates()) {
      const p = generateProblem(module.id, template.id, 1)
      const where = `${module.id}/${template.id} (${p.kind})`
      expect(STEP_KINDS.has(p.kind), where).toBe(STEP_MODULES.has(module.id))
      if (STEP_KINDS.has(p.kind)) stepModulesSeen.add(module.id)
      if (offersLineCards(p)) pickModulesSeen.add(module.id)
    }
    expect([...stepModulesSeen].sort()).toEqual([...STEP_MODULES].sort())
    expect([...pickModulesSeen].sort()).toEqual([...PICK_MODULES].sort())
  })
})
