import { describe, expect, it } from 'vitest'
import { getModule, getTemplate, hasModule } from '@/content'
import {
  domainTemplateIds,
  domainTypeRefs,
  getSatDomain,
  SAT_DOMAINS,
  SAT_SKILLS,
  satCoverage,
  satCoverageSummary,
  skillsInDomain,
  skillStatus,
  skillTemplateIds,
} from './skills'
import type { Ev } from '@/store/types'

describe('SAT skill map', () => {
  it('defines the four College Board domains with their test shares', () => {
    expect(SAT_DOMAINS.map((d) => [d.title, d.share])).toEqual([
      ['Algebra', 0.35],
      ['Advanced Math', 0.35],
      ['Problem-Solving and Data Analysis', 0.15],
      ['Geometry and Trigonometry', 0.15],
    ])
    const sum = SAT_DOMAINS.reduce((acc, d) => acc + d.share, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('every skill has a valid domain and every listed module and template exists in the registry', () => {
    expect(SAT_SKILLS.length).toBe(19)
    const seenSkillIds = new Set<string>()
    for (const skill of SAT_SKILLS) {
      expect(seenSkillIds.has(skill.id)).toBe(false)
      seenSkillIds.add(skill.id)
      expect(getSatDomain(skill.domainId)).toBeDefined()
      for (const ref of skill.types) {
        expect(hasModule(ref.moduleId)).toBe(true)
        const mod = getModule(ref.moduleId)
        expect(mod.subject).not.toBe('Chemistry')
        expect(ref.templateIds.length).toBeGreaterThan(0)
        for (const templateId of ref.templateIds) {
          const tpl = getTemplate(ref.moduleId, templateId)
          expect(tpl.id).toBe(templateId)
        }
      }
    }
  })

  it('keeps skills and their mapped modules and templates in curriculum order', () => {
    // Skills are grouped by domain in SAT_DOMAINS order.
    const domainOrder = SAT_DOMAINS.map((d) => d.id)
    let lastDomainIndex = 0
    for (const skill of SAT_SKILLS) {
      const idx = domainOrder.indexOf(skill.domainId)
      expect(idx).toBeGreaterThanOrEqual(lastDomainIndex)
      lastDomainIndex = idx

      // Within each skill, modules are in ModuleDef.order ascending, with no duplicate module entries.
      const orders = skill.types.map((ref) => getModule(ref.moduleId).order)
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i - 1]!)
      }

      // Within each module entry, templateIds follow the module's own template order.
      for (const ref of skill.types) {
        const mod = getModule(ref.moduleId)
        const indices = ref.templateIds.map((id) => mod.templates.findIndex((t) => t.id === id))
        for (let i = 1; i < indices.length; i++) {
          expect(indices[i]!).toBeGreaterThan(indices[i - 1]!)
        }
      }
    }

    // Domain-level deduplicated type refs are also in ModuleDef.order ascending.
    for (const domain of SAT_DOMAINS) {
      const refs = domainTypeRefs(domain.id)
      expect(refs.length).toBeGreaterThan(0)
      const orders = refs.map((ref) => getModule(ref.moduleId).order)
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]!).toBeGreaterThan(orders[i - 1]!)
      }
    }
  })

  it('counts coverage per domain and overall honestly', () => {
    const cov = satCoverage()
    expect(cov.total).toBe(19)
    expect(cov.covered).toBe(9)
    expect(cov.byDomain).toEqual({
      algebra: { covered: 2, total: 5 },
      'advanced-math': { covered: 3, total: 3 },
      'data-analysis': { covered: 1, total: 7 },
      'geometry-trig': { covered: 3, total: 4 },
    })
    expect(satCoverageSummary()).toBe('9 of 19 skills so far; more are coming')

    for (const domain of SAT_DOMAINS) {
      expect(skillsInDomain(domain.id).length).toBe(cov.byDomain[domain.id].total)
      expect(domainTemplateIds(domain.id).length).toBeGreaterThan(0)
    }
  })

  it('marks each skill Practiced, Not yet, or Coming from her event log', () => {
    const comingSkill = SAT_SKILLS.find((s) => s.id === 'alg.linear-eq-1v')!
    const mappedSkill = SAT_SKILLS.find((s) => s.id === 'alg.linear-inequalities')!
    expect(skillTemplateIds(comingSkill)).toEqual([])
    expect(skillTemplateIds(mappedSkill)).toContain('ineq.linear')

    expect(skillStatus(comingSkill, [])).toBe('coming')
    expect(skillStatus(mappedSkill, [])).toBe('not-yet')

    const ownOnly: Ev[] = [
      {
        t: 'problem_done',
        at: 1_000,
        attemptId: 'a1',
        moduleId: 'inequalities',
        skill: 'ineq.linear',
        steps: 1,
        hints: 0,
        mode: 'normal',
        finalCorrect: true,
        firstTryRate: 1,
        secs: 10,
        revealed: 0,
        own: true,
      },
    ]
    expect(skillStatus(mappedSkill, ownOnly)).toBe('not-yet')

    const finished: Ev[] = [
      {
        t: 'problem_done',
        at: 2_000,
        attemptId: 'a2',
        moduleId: 'inequalities',
        skill: 'ineq.linear',
        steps: 1,
        hints: 0,
        mode: 'normal',
        finalCorrect: true,
        firstTryRate: 1,
        secs: 15,
        revealed: 0,
      },
    ]
    expect(skillStatus(mappedSkill, finished)).toBe('practiced')
    expect(skillStatus(comingSkill, finished)).toBe('coming')
  })
})
