/**
 * Classes and units. Home, the module page and Progress group by this file, not by
 * `ModuleDef.subject` (that field stays; other code still reads it).
 *
 * Adding a class — geometry, when it is ready — is adding one entry to `COURSES`.
 * A course with no registered module in any unit is not shown anywhere.
 * A unit with no modules is still listed in the unit switcher, marked "coming soon",
 * until its `moduleIds` are filled in. Every module id here is one registered in
 * `src/content/modules`, and each module belongs to exactly one unit.
 *
 * Home shows a unit's modules in `ModuleDef.order`, not in the order written below.
 */
import type { ModuleDef } from './types'
import { getModule, hasModule, MODULES } from './registry'

export interface UnitDef {
  id: string
  /** Short name on the switcher, e.g. "Unit 1" or "Chapter 5". */
  label: string
  /** Rest of the switcher line, e.g. "Functions and their graphs". */
  title: string
  moduleIds: string[]
  /** Mixed review to offer on this unit's Home section, if one is registered. */
  reviewId?: string
}

export interface CourseDef {
  id: string
  /** Class name, e.g. "Honors Precalculus". */
  title: string
  /** Compact name, e.g. the module-page eyebrow. */
  short: string
  units: UnitDef[]
}

/**
 * sigFigs never names a chapter in its module comments (atoms says ch. 4, electrons
 * says ch. 5, both matching the units below). Chapter 3 / Measurements is the
 * curriculum place for significant figures.
 */
export const COURSES: readonly CourseDef[] = [
  {
    id: 'precalc',
    title: 'Honors Precalculus',
    short: 'Precalculus',
    units: [
      {
        id: 'unit1',
        label: 'Unit 1',
        title: 'Functions and their graphs',
        reviewId: 'unit1',
        moduleIds: [
          'numberLine',
          'graphFeatures',
          'domainRange',
          'composition',
          'functionOps',
          'transformations',
          'piecewiseRate',
          'inequalities',
          'evenOdd',
          'inverses',
          'propertiesDrill',
          'diffQuotient',
        ],
      },
      {
        id: 'unit2',
        label: 'Unit 2',
        title: 'Polynomial and rational functions',
        moduleIds: ['quadratics', 'polyDivision', 'polyZeros'],
      },
    ],
  },
  {
    id: 'chemistry',
    title: 'Chemistry',
    short: 'Chemistry',
    units: [
      {
        id: 'ch3',
        label: 'Chapter 3',
        title: 'Measurements',
        moduleIds: ['sigFigs'],
      },
      {
        id: 'ch4',
        label: 'Chapter 4',
        title: 'Atomic structure',
        moduleIds: ['atoms'],
      },
      {
        id: 'ch5',
        label: 'Chapter 5',
        title: 'Electrons in atoms',
        moduleIds: ['electrons'],
      },
    ],
  },
]

export function getCourse(id: string): CourseDef | undefined {
  return COURSES.find((course) => course.id === id)
}

/** The class and unit that list this module, or null when none does. */
export function courseOfModule(moduleId: string): { course: CourseDef; unit: UnitDef } | null {
  for (const course of COURSES) {
    for (const unit of course.units) {
      if (unit.moduleIds.includes(moduleId)) return { course, unit }
    }
  }
  return null
}

/**
 * The class and unit that own this problem-type id (a template id). A skill that is
 * not a registered template — a drill family, a retired id — returns null.
 */
export function courseOfSkill(skill: string): { course: CourseDef; unit: UnitDef } | null {
  for (const mod of MODULES) {
    if (mod.templates.some((template) => template.id === skill)) return courseOfModule(mod.id)
  }
  return null
}

/** Units that currently have at least one registered module, in registry order. */
export function unitsWithModules(course: CourseDef): UnitDef[] {
  return course.units.filter((unit) => unit.moduleIds.some((id) => hasModule(id)))
}

/** Registered modules in a unit, sorted by `ModuleDef.order` (Home's order). */
export function modulesInUnit(unit: UnitDef): ModuleDef[] {
  const mods: ModuleDef[] = []
  for (const id of unit.moduleIds) {
    if (hasModule(id)) mods.push(getModule(id))
  }
  mods.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return mods
}
