/**
 * Building a set. "Start a set" on Home picks three problem types from the class she has selected there, and the set
 * runner (pages/SetPage.tsx) gives her one problem of each type, one after another. Pure: the same class, event log,
 * rewards slice, time and seed give the same set.
 *
 * The types, in this order, never the same type twice:
 * (a) the type of her top open mistake card (closest to squashed: `openCards` in store/rewards.ts), if any;
 * (b) a mastered type that is due for review (two weeks or more since its last problem: `REVIEW_AFTER_MS`, the rule
 *     that pays it in full again), the one waiting longest, if any;
 * (c) the unit she is working in (the unit of her most recent problem in this class; with no history, the class's
 *     first unit with problems): its types that are not mastered yet, Practiced and Solid before New. The Practiced
 *     and Solid ones go least recently practiced first, so set after set goes round her types (spaced practice) instead
 *     of giving her the same three, or the last set's, again; the New ones go in the unit's order (Home's module
 *     order, then each module's own order);
 * (d) still short: the next unit, the same way (then the units after it, then the ones before it);
 * still short (nearly every type of the class mastered): mastered types, the working unit's first.
 * A mastered type that is not due never comes back through (c) or (d): (b) is how mastered types come back.
 * Each problem is at its type's default difficulty, with a fresh seed.
 */
import { modulesInUnit, type CourseDef } from '@/content'
import { mixSeed } from '@/content/rng'
import { defaultKnobs, flagsFromKnobs } from '@/problem/url'
import { computeRewards, DEFAULT_DAILY_GOAL, openCards, REVIEW_AFTER_MS, skillRings, type RingLevel } from '@/store/rewards'
import type { Ev, RewardsState } from '@/store/types'

/** Problems in a set. */
export const SET_SIZE = 3

/** Which rule put a type in the set: (a) mistake, (b) review, (c) unit, (d) next, or the mastered fallback (extra). */
export type SetPick = 'mistake' | 'review' | 'unit' | 'next' | 'extra'

export const SET_PICKS: readonly SetPick[] = ['mistake', 'review', 'unit', 'next', 'extra']

/** A problem type of a class, in the class's order: unit, then Home's module order, then the module's templates. */
export interface ClassType {
  unitId: string
  moduleId: string
  /** The template id, which is also the problem type's skill. */
  templateId: string
  /** The type's default difficulty, written as the problem URL writes it (`d=`). */
  flags: string
}

export interface PickedType extends ClassType {
  pick: SetPick
}

/** Every problem type of the class (a module without templates, the properties drill, has none). */
export function classTypes(course: CourseDef): ClassType[] {
  const out: ClassType[] = []
  const seen = new Set<string>()
  for (const unit of course.units) {
    for (const module of modulesInUnit(unit)) {
      for (const template of module.templates) {
        if (seen.has(template.id)) continue
        seen.add(template.id)
        out.push({ unitId: unit.id, moduleId: module.id, templateId: template.id, flags: flagsFromKnobs(defaultKnobs(template.knobs)) })
      }
    }
  }
  return out
}

/** How many problems a set from this class has: three, or fewer when the class has fewer types. */
export function setSizeFor(course: CourseDef): number {
  return Math.min(SET_SIZE, classTypes(course).length)
}

/**
 * The unit of her most recent problem in this class: the latest event that names an attempt (a line, a check, a
 * hint, a finished or a left problem) of one of the class's types. With none, the class's first unit with problems.
 */
export function workingUnit(types: readonly ClassType[], events: readonly Ev[]): string | null {
  const unitOf = new Map(types.map((t) => [t.templateId, t.unitId]))
  let unit: string | null = null
  let at = Number.NEGATIVE_INFINITY
  for (const e of events) {
    if (!('attemptId' in e)) continue
    const u = unitOf.get(e.skill)
    // Ties go to the later event in the log.
    if (u !== undefined && e.at >= at) {
      unit = u
      at = e.at
    }
  }
  return unit ?? types[0]?.unitId ?? null
}

/** The units of the class in the order (c) and (d) visit them: the working unit, the ones after it, then the ones before. */
function unitTour(types: readonly ClassType[], first: string | null): string[] {
  const units: string[] = []
  for (const t of types) if (!units.includes(t.unitId)) units.push(t.unitId)
  const i = first === null ? -1 : units.indexOf(first)
  return i < 0 ? units : [...units.slice(i), ...units.slice(0, i)]
}

/** When each type's last problem was finished (any mode: a timed problem is a problem too, as in the rewards). */
function lastFinished(events: readonly Ev[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const e of events) {
    if (e.t === 'problem_done' && e.at > (out.get(e.skill) ?? Number.NEGATIVE_INFINITY)) out.set(e.skill, e.at)
  }
  return out
}

export interface PickInput {
  /** The class's types, in the class's order (`classTypes`). */
  types: readonly ClassType[]
  events: readonly Ev[]
  /** The rewards slice: mistake cards folded from compacted events count too. */
  rewards: RewardsState
  now: number
  /** Default `SET_SIZE`. */
  size?: number
}

export interface PickResult {
  types: PickedType[]
  /** The unit she is working in (rule c); null when the class has no types. */
  unitId: string | null
}

/** The set's problem types by the rules at the top of this file. Pure. */
export function pickSetTypes(input: PickInput): PickResult {
  const { types, events, rewards, now } = input
  const size = Math.max(1, Math.floor(input.size ?? SET_SIZE))
  const byId = new Map(types.map((t) => [t.templateId, t]))
  const rings = skillRings(events)
  const level = (skill: string): RingLevel => rings.get(skill)?.level ?? 'new'
  const picked: PickedType[] = []
  const free = (t: ClassType) => !picked.some((p) => p.templateId === t.templateId)
  const take = (t: ClassType | undefined, pick: SetPick) => {
    if (t && picked.length < size && free(t)) picked.push({ ...t, pick })
  }

  // (a) Her top open mistake card in this class: closest to squashed, then the most recent.
  const cards = computeRewards(events, rewards, DEFAULT_DAILY_GOAL, now).cards.filter((c) => byId.has(c.skill))
  const top = openCards(cards, 1)[0]
  if (top) take(byId.get(top.skill), 'mistake')

  // (b) A mastered type due for review: the one whose last problem is the oldest (ties: the class's order).
  const last = lastFinished(events)
  const due = types
    .filter((t) => free(t) && level(t.templateId) === 'mastered')
    .flatMap((t) => {
      const at = last.get(t.templateId)
      return at !== undefined && now - at >= REVIEW_AFTER_MS ? [{ t, at }] : []
    })
    .sort((x, y) => x.at - y.at)
  take(due[0]?.t, 'review')

  // (c) The working unit, then (d) the next units: types not mastered yet. Practiced and Solid first, the one she
  // practiced longest ago first (ties: the unit's order), then New ones in the unit's order.
  const unitId = workingUnit(types, events)
  const tour = unitTour(types, unitId)
  tour.forEach((unit, i) => {
    const open = types.filter((t) => t.unitId === unit && free(t) && level(t.templateId) !== 'mastered')
    const started = open
      .filter((t) => level(t.templateId) !== 'new')
      .map((t, order) => ({ t, order, at: last.get(t.templateId) ?? Number.NEGATIVE_INFINITY }))
      .sort((x, y) => x.at - y.at || x.order - y.order)
      .map((x) => x.t)
    const fresh = open.filter((t) => level(t.templateId) === 'new')
    for (const t of [...started, ...fresh]) take(t, i === 0 ? 'unit' : 'next')
  })

  // Still short: the class is nearly all mastered. Mastered types, the working unit's first.
  for (const unit of tour) for (const t of types) if (t.unitId === unit) take(t, 'extra')

  return { types: picked, unitId }
}

/** One problem of a set. */
export interface SetProblem {
  moduleId: string
  templateId: string
  /** A fresh seed for this problem. */
  seed: number
  /** The type's default difficulty (`d=` in the problem URL; '' for every type today). */
  flags: string
  pick: SetPick
}

export interface BuiltSet {
  courseId: string
  /** The unit she is working in (rule c). */
  unitId: string | null
  problems: SetProblem[]
}

export interface BuildSetInput {
  /** The class selected on Home. */
  course: CourseDef
  events: readonly Ev[]
  rewards: RewardsState
  now: number
  /** Seeds each problem (`mixSeed(seed, position)`): a fresh random seed gives fresh problems. */
  seed: number
  size?: number
}

/** A set of problems for her from this class. Pure. */
export function buildSet(input: BuildSetInput): BuiltSet {
  const { types, unitId } = pickSetTypes({
    types: classTypes(input.course),
    events: input.events,
    rewards: input.rewards,
    now: input.now,
    size: input.size,
  })
  const seed = input.seed >>> 0 || 1
  return {
    courseId: input.course.id,
    unitId,
    problems: types.map((t, i) => ({ moduleId: t.moduleId, templateId: t.templateId, seed: mixSeed(seed, i + 1), flags: t.flags, pick: t.pick })),
  }
}
