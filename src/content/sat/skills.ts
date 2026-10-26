/**
 * Phase 1 SAT Math skill map: the four College Board content domains and their 19 skills,
 * mapped strictly to the registered problem types (module id + template ids) that practice
 * what each skill tests. Skills without a matching problem type yet have `types: []` ("Coming").
 */
import { includesSubject } from '@/edition'
import type { ModuleId } from '@/shared/types'
import type { Ev } from '@/store/types'
import { getModule, hasModule } from '../registry'

export type SatDomainId = 'algebra' | 'advanced-math' | 'data-analysis' | 'geometry-trig'

export interface SatDomainDef {
  id: SatDomainId
  /** Matching unit id on the `sat` course in `src/content/courses.ts`. */
  unitId: string
  /** Review id for the 8-problem domain practice set. */
  reviewId: string
  /** Official College Board domain name. */
  title: string
  /** Share of the SAT Math section (sums to 1). */
  share: number
  /** Human-readable share label shown on the domain card and header. */
  shareLabel: string
}

export interface SatTypeRef {
  moduleId: ModuleId
  templateIds: readonly string[]
}

export interface SatSkillDef {
  id: string
  domainId: SatDomainId
  /** Official College Board skill name. */
  title: string
  /** Mapped problem types in curriculum (`ModuleDef.order`) order, or empty when coming later. */
  types: readonly SatTypeRef[]
}

export type SatSkillStatus = 'practiced' | 'not-yet' | 'coming'

export const SAT_DOMAINS: readonly SatDomainDef[] = [
  {
    id: 'algebra',
    unitId: 'sat-algebra',
    reviewId: 'sat-algebra',
    title: 'Algebra',
    share: 0.35,
    shareLabel: 'About 35%',
  },
  {
    id: 'advanced-math',
    unitId: 'sat-advanced-math',
    reviewId: 'sat-advanced-math',
    title: 'Advanced Math',
    share: 0.35,
    shareLabel: 'About 35%',
  },
  {
    id: 'data-analysis',
    unitId: 'sat-data-analysis',
    reviewId: 'sat-data-analysis',
    title: 'Problem-Solving and Data Analysis',
    share: 0.15,
    shareLabel: 'About 15%',
  },
  {
    id: 'geometry-trig',
    unitId: 'sat-geometry-trig',
    reviewId: 'sat-geometry-trig',
    title: 'Geometry and Trigonometry',
    share: 0.15,
    shareLabel: 'About 15%',
  },
]

/**
 * The College Board skills of the digital SAT Math section and the app's problem types that practise them. Review
 * 2026-10-23: only what the SAT tests counts. Precalculus-only types are left out even where they touch a skill: logs
 * and log models, inverse functions, the difference quotient, even and odd functions, sign charts, the rational root
 * theorem, synthetic division, inverse trig and proofs. A skill no type covers is "Coming".
 */
export const SAT_SKILLS: readonly SatSkillDef[] = [
  // Algebra (~35%)
  {
    id: 'alg.linear-eq-1v',
    domainId: 'algebra',
    title: 'Linear equations in one variable',
    types: [],
  },
  {
    id: 'alg.linear-functions',
    domainId: 'algebra',
    title: 'Linear functions',
    // Slopes of parallel and perpendicular lines, equations of lines.
    types: [
      { moduleId: 'geoParallel', templateIds: ['gl3.slopes'] },
    ],
  },
  {
    id: 'alg.linear-eq-2v',
    domainId: 'algebra',
    title: 'Linear equations in two variables',
    types: [
      { moduleId: 'geoParallel', templateIds: ['gl3.slopes'] },
    ],
  },
  {
    id: 'alg.systems-linear',
    domainId: 'algebra',
    title: 'Systems of two linear equations in two variables',
    types: [],
  },
  {
    id: 'alg.linear-inequalities',
    domainId: 'algebra',
    title: 'Linear inequalities in one or two variables',
    types: [
      { moduleId: 'inequalities', templateIds: ['ineq.linear', 'ineq.distribute', 'ineq.fraction', 'ineq.compound'] },
    ],
  },

  // Advanced Math (~35%)
  {
    id: 'adv.equivalent-expressions',
    domainId: 'advanced-math',
    title: 'Equivalent expressions',
    types: [
      { moduleId: 'composition', templateIds: ['comp.expr'] },
      { moduleId: 'quadratics', templateIds: ['cs.form'] },
    ],
  },
  {
    id: 'adv.nonlinear-equations',
    domainId: 'advanced-math',
    title: 'Nonlinear equations in one variable and systems of equations in two variables',
    types: [
      { moduleId: 'polyZeros', templateIds: ['pz.zeros'] },
      { moduleId: 'rationalFns', templateIds: ['rf.equation'] },
    ],
  },
  {
    id: 'adv.nonlinear-functions',
    domainId: 'advanced-math',
    title: 'Nonlinear functions (quadratic, exponential, polynomial, rational, radical, absolute value)',
    types: [
      { moduleId: 'graphFeatures', templateIds: ['gf.features'] },
      { moduleId: 'composition', templateIds: ['comp.value'] },
      { moduleId: 'functionOps', templateIds: ['ops.table', 'ops.graph', 'ops.formula'] },
      { moduleId: 'transformations', templateIds: ['tr.describe', 'tr.point', 'tr.equation'] },
      { moduleId: 'quadratics', templateIds: ['cs.vertex'] },
      { moduleId: 'optimization', templateIds: ['opt.wall', 'opt.pens', 'opt.numbers', 'opt.revenue'] },
    ],
  },

  // Problem-Solving and Data Analysis (~15%)
  {
    id: 'psda.ratios-rates',
    domainId: 'data-analysis',
    title: 'Ratios, rates, proportional relationships and units',
    types: [
      { moduleId: 'geoRatios', templateIds: ['gr.proportion'] },
    ],
  },
  {
    id: 'psda.percentages',
    domainId: 'data-analysis',
    title: 'Percentages',
    types: [],
  },
  {
    id: 'psda.one-var-data',
    domainId: 'data-analysis',
    title: 'One-variable data (distributions, center and spread)',
    types: [],
  },
  {
    id: 'psda.two-var-data',
    domainId: 'data-analysis',
    title: 'Two-variable data (models and scatterplots)',
    types: [],
  },
  {
    id: 'psda.probability',
    domainId: 'data-analysis',
    title: 'Probability and conditional probability',
    types: [],
  },
  {
    id: 'psda.inference',
    domainId: 'data-analysis',
    title: 'Inference from sample statistics and margin of error',
    types: [],
  },
  {
    id: 'psda.claims',
    domainId: 'data-analysis',
    title: 'Evaluating statistical claims (observational studies and experiments)',
    types: [],
  },

  // Geometry and Trigonometry (~15%)
  {
    id: 'geo.area-volume',
    domainId: 'geometry-trig',
    title: 'Area and volume',
    types: [],
  },
  {
    id: 'geo.lines-angles-triangles',
    domainId: 'geometry-trig',
    title: 'Lines, angles and triangles',
    types: [
      { moduleId: 'geoSegments', templateIds: ['gs.addition', 'gs.midpoint', 'gs.coord'] },
      { moduleId: 'geoAngles', templateIds: ['ga.addition', 'ga.bisector', 'ga.pairs', 'ga.words'] },
      { moduleId: 'geoParallel', templateIds: ['gl3.pairs', 'gl3.solve'] },
      { moduleId: 'geoPolygonAngles', templateIds: ['gpa.triangle', 'gpa.polygon'] },
      { moduleId: 'geoCongruence', templateIds: ['gc.solve'] },
      { moduleId: 'geoIsosceles', templateIds: ['gi.solve'] },
      { moduleId: 'geoRatios', templateIds: ['gr.polygons'] },
      { moduleId: 'geoSimilarTriangles', templateIds: ['gt.solve'] },
      { moduleId: 'geoProportionalParts', templateIds: ['gp.splitter', 'gp.bisector'] },
    ],
  },
  {
    id: 'geo.right-triangles-trig',
    domainId: 'geometry-trig',
    title: 'Right triangles and trigonometry',
    types: [
      { moduleId: 'rightTriangle', templateIds: ['rt.ratios', 'rt.special', 'rt.side', 'rt.angle'] },
      { moduleId: 'unitCircle', templateIds: ['uc.exact'] },
      { moduleId: 'geoRightSimilar', templateIds: ['rs.altitude'] },
      { moduleId: 'geoPythagorean', templateIds: ['py.side', 'py.classify', 'py.apply'] },
      { moduleId: 'geoSpecialRight', templateIds: ['sp.special'] },
    ],
  },
  {
    id: 'geo.circles',
    domainId: 'geometry-trig',
    title: 'Circles',
    // Radians and arc length; circle equations and sector area are still to come.
    types: [
      { moduleId: 'angleMeasure', templateIds: ['am.convert', 'am.arc'] },
    ],
  },
]

export function getSatDomain(id: string): SatDomainDef | undefined {
  return SAT_DOMAINS.find((d) => d.id === id)
}

export function getSatDomainByUnit(unitId: string): SatDomainDef | undefined {
  return SAT_DOMAINS.find((d) => d.unitId === unitId)
}

export function getSatDomainByReview(reviewId: string): SatDomainDef | undefined {
  return SAT_DOMAINS.find((d) => d.reviewId === reviewId)
}

export function skillsInDomain(domainId: SatDomainId): SatSkillDef[] {
  return SAT_SKILLS.filter((s) => s.domainId === domainId)
}

/** Mapped template ids for one skill, filtered to registered modules included in the active edition. */
export function skillTemplateIds(skill: SatSkillDef): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const ref of skill.types) {
    if (!hasModule(ref.moduleId)) continue
    const mod = getModule(ref.moduleId)
    if (!includesSubject(mod.subject)) continue
    const valid = new Set(mod.templates.map((t) => t.id))
    for (const id of ref.templateIds) {
      if (valid.has(id) && !seen.has(id)) {
        seen.add(id)
        out.push(id)
      }
    }
  }
  return out
}

/**
 * Deduplicated `(moduleId, templateIds)` refs across all skills in a domain,
 * sorted by curriculum order (`ModuleDef.order`) with templates in module order.
 */
export function domainTypeRefs(domainId: SatDomainId): SatTypeRef[] {
  const byModule = new Map<ModuleId, Set<string>>()
  for (const skill of skillsInDomain(domainId)) {
    for (const ref of skill.types) {
      if (!hasModule(ref.moduleId)) continue
      const mod = getModule(ref.moduleId)
      if (!includesSubject(mod.subject)) continue
      let set = byModule.get(ref.moduleId)
      if (!set) {
        set = new Set<string>()
        byModule.set(ref.moduleId, set)
      }
      for (const id of ref.templateIds) set.add(id)
    }
  }
  const modules = [...byModule.keys()].map((id) => getModule(id))
  modules.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  const out: SatTypeRef[] = []
  for (const mod of modules) {
    const wanted = byModule.get(mod.id)!
    const templateIds = mod.templates.map((t) => t.id).filter((id) => wanted.has(id))
    if (templateIds.length > 0) out.push({ moduleId: mod.id, templateIds })
  }
  return out
}

export function domainTemplateIds(domainId: SatDomainId): string[] {
  const out: string[] = []
  for (const ref of domainTypeRefs(domainId)) {
    for (const id of ref.templateIds) out.push(id)
  }
  return out
}

/**
 * Skill status on the domain card:
 * - `'coming'` when no problem type covers the skill yet
 * - `'practiced'` when she has finished (`problem_done`) at least one problem of a mapped type
 * - `'not-yet'` when mapped types exist, but she hasn't finished one yet
 */
export function skillStatus(skill: SatSkillDef, events: readonly Ev[]): SatSkillStatus {
  const ids = skillTemplateIds(skill)
  if (ids.length === 0) return 'coming'
  const wanted = new Set(ids)
  const practiced = events.some(
    (e) => e.t === 'problem_done' && !('own' in e && e.own) && wanted.has(e.skill),
  )
  return practiced ? 'practiced' : 'not-yet'
}

export interface SatCoverage {
  covered: number
  total: number
  byDomain: Record<SatDomainId, { covered: number; total: number }>
}

export function satCoverage(): SatCoverage {
  const byDomain: Record<SatDomainId, { covered: number; total: number }> = {
    algebra: { covered: 0, total: 0 },
    'advanced-math': { covered: 0, total: 0 },
    'data-analysis': { covered: 0, total: 0 },
    'geometry-trig': { covered: 0, total: 0 },
  }
  let covered = 0
  for (const skill of SAT_SKILLS) {
    const bucket = byDomain[skill.domainId]
    bucket.total += 1
    if (skillTemplateIds(skill).length > 0) {
      bucket.covered += 1
      covered += 1
    }
  }
  return { covered, total: SAT_SKILLS.length, byDomain }
}

export function satCoverageSummary(): string {
  const { covered, total } = satCoverage()
  return `${covered} of ${total} skills so far; more are coming`
}
