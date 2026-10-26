/**
 * The unit path on Home (docs/progress/phone-path.md): the selected unit as a road of its problem types in course
 * order, grouped by module, each stop with its ring (the rewards' last-five levels), "You are here" on the type the
 * next set starts with, and where each stop sits on the road. Pure: no React, no storage.
 *
 * Nothing on the path is ever locked: her class's order is not ours to enforce. A stop's state is a label.
 */
import { getModule, hasModule, modulesInUnit, unitsWithModules, type CourseDef, type UnitDef } from '@/content'
import { pickModule, stepByStepModule } from '@/problem/solveStyle'
import { classTypes, pickSetTypes } from '@/session/buildSet'
import { MASTERY_WINDOW } from '@/store/compaction'
import type { RingLevel, SkillRingInfo } from '@/store/rewards'
import type { Ev, RewardsState } from '@/store/types'

/** One stop on the path: a problem type (template) of the unit. */
export interface PathStop {
  /** The template id, which is also the problem type's skill. */
  templateId: string
  moduleId: string
  title: string
  moduleTitle: string
  /** The type's default difficulty (`d=` in the problem URL), as the module page's Start and the set builder use it. */
  flags: string
  ring: SkillRingInfo
  /** Position on the path, from 0. */
  index: number
}

/** A module's stretch of the road: its signpost and its stops. */
export interface PathModule {
  moduleId: string
  title: string
  /** Solved step by step, one checked line at a time: the signpost carries the step-by-step mark. */
  steps: boolean
  /** Step by step with Pick (choosing each line from cards). */
  pick: boolean
  stops: PathStop[]
}

const NEW_RING: SkillRingInfo = { level: 'new', fill: 0, strong: 0, count: 0 }

/**
 * The unit's stops, module by module, in course order: the set builder's own list of the class's types
 * (`classTypes`, so the path and "Start a set" always know the same types), kept to this unit. A unit whose own
 * `moduleIds` are empty (such as SAT Math Prep's domain units) or a module with no problem types (the properties
 * drill) has no stretch of road.
 */
export function unitPath(course: CourseDef, unit: UnitDef, rings: ReadonlyMap<string, SkillRingInfo>): PathModule[] {
  if (modulesInUnit(unit).length === 0) return []
  const out: PathModule[] = []
  let index = 0
  for (const t of classTypes(course)) {
    if (t.unitId !== unit.id || !hasModule(t.moduleId)) continue
    const module = getModule(t.moduleId)
    const template = module.templates.find((x) => x.id === t.templateId)
    if (!template) continue
    let group = out[out.length - 1]
    if (!group || group.moduleId !== module.id) {
      group = { moduleId: module.id, title: module.title, steps: stepByStepModule(module.id), pick: pickModule(module.id), stops: [] }
      out.push(group)
    }
    group.stops.push({
      templateId: template.id,
      moduleId: module.id,
      title: template.title,
      moduleTitle: module.title,
      flags: t.flags,
      ring: rings.get(template.id) ?? NEW_RING,
      index: index++,
    })
  }
  return out
}

export function pathStops(modules: readonly PathModule[]): PathStop[] {
  return modules.flatMap((m) => m.stops)
}

/** Where "Start a set" would start: the set builder's first type, and its unit. */
export interface SetStart {
  templateId: string
  moduleId: string
  unitId: string
}

/**
 * The type the next set starts with, by the set builder itself (`pickSetTypes`, with what Home's "Start a set" passes
 * it: the class, the log, the rewards slice, now, and the unit Home shows), so the path and the set never disagree.
 * Null when the class has no unit path (`unitsWithModules(course).length === 0`) or no problem types.
 */
export function setStart(course: CourseDef, events: readonly Ev[], rewards: RewardsState, now: number, startUnit: string | null): SetStart | null {
  if (unitsWithModules(course).length === 0) return null
  const first = pickSetTypes({ types: classTypes(course), events, rewards, now, startUnit }).types[0]
  return first ? { templateId: first.templateId, moduleId: first.moduleId, unitId: first.unitId } : null
}

/** Solid or better (Solid, Mastered): what the unit header and the finish flag count. */
export function isSolid(level: RingLevel): boolean {
  return level === 'solid' || level === 'mastered'
}

/** "4 of 12 types solid" (one type: "0 of 1 type solid"). */
export function solidLine(stops: readonly PathStop[]): string {
  const solid = stops.filter((s) => isSolid(s.ring.level)).length
  return `${solid} of ${stops.length} ${stops.length === 1 ? 'type' : 'types'} solid`
}

/** A stop's state in a few words: "new", "practiced, 2 of 5", "solid, 4 of 5", "mastered" (the rings' counts). */
export function stateWords(ring: SkillRingInfo): string {
  if (ring.level === 'new') return 'new'
  if (ring.level === 'mastered') return 'mastered'
  return `${ring.level}, ${ring.strong} of ${MASTERY_WINDOW}`
}

/**
 * A stop's accessible name: the type, its state, its module, and "You are here" first where the next set starts:
 * "Exponential equations: practiced, 2 of 5. In Exponential and logarithmic equations."
 */
export function stopName(stop: PathStop, here: boolean): string {
  const name = `${stop.title}: ${stateWords(stop.ring)}. In ${stop.moduleTitle}.`
  return here ? `You are here. ${name}` : name
}

/** The road's lanes, left to right, as it winds: centre, right, far right, right, centre, left, far left, left. */
const LANES = [0, 1, 2, 1, 0, -1, -2, -1] as const

/** Which lane a stop sits in (-2 far left to 2 far right). */
export function laneOf(index: number): number {
  return LANES[((index % LANES.length) + LANES.length) % LANES.length]!
}

/** The side of its node a stop's title goes on: away from the edge it leans to (at the centre, away from the next stop). */
export function captionSide(index: number): 'left' | 'right' {
  const lane = laneOf(index)
  if (lane !== 0) return lane > 0 ? 'left' : 'right'
  return laneOf(index + 1) > 0 ? 'left' : 'right'
}

/** The road from one point to the next: an S-curve leaving and arriving straight down (an SVG path). */
export function roadCurve(x0: number, y0: number, x1: number, y1: number): string {
  const ym = (y0 + y1) / 2
  return `M ${x0} ${y0} C ${x0} ${ym} ${x1} ${ym} ${x1} ${y1}`
}
