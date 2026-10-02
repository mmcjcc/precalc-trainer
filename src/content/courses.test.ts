import { describe, expect, it } from 'vitest'
import { getReview } from './reviews'
import { hasModule, MODULES } from './registry'
import { COURSES, courseOfModule, courseOfSkill, getCourse, modulesInUnit, unitsWithModules } from './courses'

import './modules'

describe('course registry', () => {
  it('puts every registered module in exactly one unit of exactly one course', () => {
    const seen = new Map<string, string>()
    for (const course of COURSES) {
      for (const unit of course.units) {
        for (const id of unit.moduleIds) {
          expect(seen.has(id)).toBe(false)
          expect(hasModule(id)).toBe(true)
          seen.set(id, `${course.id}/${unit.id}`)
        }
      }
    }
    expect([...seen.keys()].sort()).toEqual(MODULES.map((m) => m.id).sort())
    for (const mod of MODULES) {
      const hit = courseOfModule(mod.id)
      expect(hit).not.toBeNull()
      expect(`${hit!.course.id}/${hit!.unit.id}`).toBe(seen.get(mod.id))
      for (const template of mod.templates) {
        const bySkill = courseOfSkill(template.id)
        expect(bySkill?.course.id).toBe(hit!.course.id)
        expect(bySkill?.unit.id).toBe(hit!.unit.id)
      }
    }
    expect(courseOfModule('not-a-module')).toBeNull()
    expect(courseOfSkill('not-a-skill')).toBeNull()
  })

  it('uses unique ids, and every review id is a real review', () => {
    const courseIds = COURSES.map((c) => c.id)
    expect(new Set(courseIds).size).toBe(courseIds.length)
    const unitIds = COURSES.flatMap((c) => c.units.map((u) => u.id))
    expect(new Set(unitIds).size).toBe(unitIds.length)
    for (const course of COURSES) {
      expect(getCourse(course.id)).toBe(course)
      for (const unit of course.units) {
        if (unit.reviewId) expect(getReview(unit.reviewId)).toBeTruthy()
      }
    }
    expect(getCourse('geometry')).toBeUndefined()
  })

  it('sorts a unit by module order and skips units that have no modules', () => {
    const precalc = getCourse('precalc')
    const chemistry = getCourse('chemistry')
    expect(precalc).toBeTruthy()
    expect(chemistry).toBeTruthy()
    expect(modulesInUnit(precalc!.units[0]!).map((m) => m.id)).toEqual([
      'numberLine',
      'graphFeatures',
      'domainRange',
      'composition',
      'transformations',
      'piecewiseRate',
      'inequalities',
      'evenOdd',
      'inverses',
      'propertiesDrill',
      'diffQuotient',
    ])
    expect(modulesInUnit(precalc!.units[1]!).map((m) => m.id)).toEqual(['quadratics', 'polyDivision', 'polyZeros'])
    expect(unitsWithModules(precalc!).map((u) => u.id)).toEqual(['unit1', 'unit2'])
    expect(precalc!.units.map((u) => u.id)).toEqual(['unit1', 'unit2'])
    expect(unitsWithModules(chemistry!).map((u) => u.id)).toEqual(['ch3', 'ch4', 'ch5'])
    expect(chemistry!.units.map((u) => [u.id, u.moduleIds])).toEqual([
      ['ch3', ['sigFigs']],
      ['ch4', ['atoms']],
      ['ch5', ['electrons']],
    ])
    expect(precalc!.units[0]!.reviewId).toBe('unit1')
    expect(precalc!.units[1]!.reviewId).toBeUndefined()
  })
})
