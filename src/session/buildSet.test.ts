import { describe, expect, it } from 'vitest'
import { generateProblem, getCourse, getTemplate, modulesInUnit } from '@/content'
import { defaultKnobs, flagsFromKnobs } from '@/problem/url'
import type { ModuleId } from '@/shared/types'
import { emptyRewards, type Ev, type MistakeCardState, type RewardsState } from '@/store/types'
import { buildSet, classTypes, pickSetTypes, SET_SIZE, setSizeFor, workingUnit, type ClassType } from './buildSet'

const DAY = 86_400_000
const HOUR = 3_600_000
const NOW = new Date(2026, 9, 20, 12).getTime()

function type(unitId: string, templateId: string): ClassType {
  return { unitId, moduleId: `mod.${unitId}`, templateId, flags: '' }
}

/** A made-up class: unit 1 has a1-a4, unit 2 b1-b3, unit 3 c1-c2, in that order. */
const TYPES: ClassType[] = [
  type('u1', 'a1'),
  type('u1', 'a2'),
  type('u1', 'a3'),
  type('u1', 'a4'),
  type('u2', 'b1'),
  type('u2', 'b2'),
  type('u2', 'b3'),
  type('u3', 'c1'),
  type('u3', 'c2'),
]

let seq = 0

function done(skill: string, at: number, opts: Partial<Extract<Ev, { t: 'problem_done' }>> = {}): Ev {
  seq += 1
  return {
    t: 'problem_done',
    at,
    attemptId: `${skill}#${seq}`,
    skill,
    moduleId: 'm',
    steps: 2,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 60,
    ...opts,
  }
}

/** Five problems that went well, the last one at `lastAt`: Mastered. */
function mastered(skill: string, lastAt: number): Ev[] {
  return [4, 3, 2, 1, 0].map((h) => done(skill, lastAt - h * HOUR))
}

/** Three problems that went well: Solid. */
function solid(skill: string, lastAt: number): Ev[] {
  return [2, 1, 0].map((h) => done(skill, lastAt - h * HOUR))
}

/** One problem that did not go well: Practiced. */
function practiced(skill: string, at: number): Ev {
  return done(skill, at, { firstTryRate: 0.5 })
}

function rejected(skill: string, at: number, pattern: string, attemptId = `r-${skill}-${at}`): Ev {
  return { t: 'step_rejected', at, attemptId, skill, stepIdx: 0, pattern }
}

function pick(events: Ev[], opts: { rewards?: RewardsState; types?: ClassType[]; size?: number } = {}) {
  return pickSetTypes({ types: opts.types ?? TYPES, events, rewards: opts.rewards ?? emptyRewards(), now: NOW, size: opts.size })
}

const ids = (r: ReturnType<typeof pick>) => r.types.map((t) => t.templateId)
const picks = (r: ReturnType<typeof pick>) => r.types.map((t) => t.pick)

describe('pickSetTypes: the rules in order', () => {
  it('an empty history: the class’s first unit, its first three types', () => {
    const r = pick([])
    expect(ids(r)).toEqual(['a1', 'a2', 'a3'])
    expect(picks(r)).toEqual(['unit', 'unit', 'unit'])
    expect(r.unitId).toBe('u1')
    expect(SET_SIZE).toBe(3)
  })

  it('(a) first, the type of her top open mistake card: the one closest to squashed', () => {
    const events = [
      rejected('a3', NOW - 5 * DAY, 'no_sign_flip', 'x'),
      done('a3', NOW - 4 * DAY), // a clean problem since: 1 of 3
      rejected('b1', NOW - 2 * DAY, 'flip_on_add', 'y'), // newer, but 0 of 3
    ]
    const r = pick(events)
    expect(ids(r)).toEqual(['a3', 'b1', 'b2'])
    expect(picks(r)).toEqual(['mistake', 'unit', 'unit'])
    // The working unit is the one of her latest problem (b1's mistake): unit 2.
    expect(r.unitId).toBe('u2')
  })

  it('(a) counts the cards the compaction folded into the rewards slice, never a squashed one or another class’s', () => {
    const card = (pattern: string, skill: string, clean: number, extra: Partial<MistakeCardState> = {}): MistakeCardState => ({
      pattern,
      skill,
      count: 1,
      firstAt: NOW - 90 * DAY,
      lastAt: NOW - 80 * DAY,
      lastAttempt: 'old',
      clean,
      ...extra,
    })
    const rewards: RewardsState = {
      ...emptyRewards(),
      foldedThrough: NOW - 61 * DAY,
      cards: {
        'endpoint_type|c2': card('endpoint_type', 'c2', 1),
        'no_sign_flip|c1': card('no_sign_flip', 'c1', 3, { squashedAt: NOW - 70 * DAY }),
        'dropped_union|zz': card('dropped_union', 'zz', 2),
      },
    }
    const r = pick([], { rewards })
    expect(ids(r)).toEqual(['c2', 'a1', 'a2'])
    expect(picks(r)).toEqual(['mistake', 'unit', 'unit'])
  })

  it('(b) next, a mastered type due for review (two weeks since its last problem): the one waiting longest', () => {
    const events = [...mastered('a1', NOW - 20 * DAY), ...mastered('a2', NOW - 15 * DAY), ...mastered('b1', NOW - 13 * DAY)]
    const r = pick(events)
    // a1 has waited longest; b1 is not due yet, so it does not come back at all.
    expect(ids(r)).toEqual(['a1', 'b2', 'b3'])
    expect(picks(r)).toEqual(['review', 'unit', 'unit'])
    expect(r.unitId).toBe('u2')
  })

  it('(c) the working unit: types not mastered yet, Practiced and Solid (least recently practiced first) before New', () => {
    const events = [practiced('a2', NOW - 3 * DAY), ...solid('a4', NOW - 2 * DAY), ...mastered('a3', NOW - DAY)]
    const r = pick(events)
    expect(ids(r)).toEqual(['a2', 'a4', 'a1'])
    expect(picks(r)).toEqual(['unit', 'unit', 'unit'])
  })

  it('(c) goes round her Practiced and Solid types, least recently practiced first, so a set never repeats the last one', () => {
    // a1 was practiced most recently, a4 longest ago.
    const events = [practiced('a4', NOW - 4 * DAY), practiced('a2', NOW - 3 * DAY), practiced('a3', NOW - 2 * DAY), practiced('a1', NOW - DAY)]
    const first = pick(events)
    expect(ids(first)).toEqual(['a4', 'a2', 'a3'])
    // She does that set: the next one starts with a1, then the set she just did, oldest first.
    const after = [...events, practiced('a4', NOW - 3 * HOUR), practiced('a2', NOW - 2 * HOUR), practiced('a3', NOW - HOUR)]
    expect(ids(pick(after))).toEqual(['a1', 'a4', 'a2'])
  })

  it('(c) the working unit is the unit of her most recent problem in this class (any line, check or finish)', () => {
    const base = [done('b1', NOW - 5 * DAY), done('a1', NOW - 3 * DAY)]
    expect(workingUnit(TYPES, base)).toBe('u1')
    // Another class's problem and a drill answer are not problems of this class.
    const elsewhere: Ev[] = [
      ...base,
      done('zz', NOW - DAY),
      { t: 'drill_answer', at: NOW - HOUR, skill: 'b2', correct: true, kind: 'legal' },
    ]
    expect(workingUnit(TYPES, elsewhere)).toBe('u1')
    // A line of a unit-2 problem she has not finished yet is her most recent problem.
    const line: Ev = { t: 'step_accepted', at: NOW - 2 * DAY, attemptId: 'open', skill: 'b3', stepIdx: 0, firstTry: true, revealed: false, property: 'skipped' }
    const r = pick([...elsewhere, line])
    expect(r.unitId).toBe('u2')
    expect(ids(r)).toEqual(['b1', 'b2', 'b3'])
    expect(workingUnit(TYPES, [])).toBe('u1')
  })

  it('(c) with no history in the class: the unit Home shows (startUnit), when it is one of the class’s', () => {
    expect(workingUnit(TYPES, [], 'u2')).toBe('u2')
    expect(ids(pickSetTypes({ types: TYPES, events: [], rewards: emptyRewards(), now: NOW, startUnit: 'u2' }))).toEqual(['b1', 'b2', 'b3'])
    // A unit of another class, or none: the class's first unit.
    expect(workingUnit(TYPES, [], 'zz')).toBe('u1')
    expect(workingUnit(TYPES, [], null)).toBe('u1')
    // Her own history wins over it.
    expect(workingUnit(TYPES, [done('c1', NOW - DAY)], 'u2')).toBe('u3')
  })

  it('(d) still short: the next unit, the same way', () => {
    const events = [...mastered('b1', NOW - 2 * DAY), ...mastered('b2', NOW - DAY)]
    const r = pick(events)
    expect(r.unitId).toBe('u2')
    expect(ids(r)).toEqual(['b3', 'c1', 'c2'])
    expect(picks(r)).toEqual(['unit', 'next', 'next'])
  })

  it('(d) past the last unit it goes round to the first', () => {
    const events = [...mastered('c1', NOW - 2 * DAY), ...mastered('c2', NOW - DAY)]
    const r = pick(events)
    expect(r.unitId).toBe('u3')
    expect(ids(r)).toEqual(['a1', 'a2', 'a3'])
    expect(picks(r)).toEqual(['next', 'next', 'next'])
  })

  it('never the same type twice: a type picked by one rule is not picked by another', () => {
    // a1 is mastered, due, and has an open mistake card: the card picks it; the review takes the next due type.
    const events = [...mastered('a1', NOW - 20 * DAY), rejected('a1', NOW - 19 * DAY, 'no_sign_flip'), ...mastered('a2', NOW - 16 * DAY)]
    const r = pick(events)
    expect(ids(r)).toEqual(['a1', 'a2', 'a3'])
    expect(picks(r)).toEqual(['mistake', 'review', 'unit'])
    // A New type with a mistake card is not picked again by its unit.
    const fresh = pick([rejected('a1', NOW - DAY, 'no_sign_flip')])
    expect(ids(fresh)).toEqual(['a1', 'a2', 'a3'])
    expect(new Set(ids(fresh)).size).toBe(3)
  })

  it('a class that is all mastered and not due: mastered types, the working unit’s first', () => {
    const three = [type('u1', 'a1'), type('u1', 'a2'), type('u2', 'b1')]
    const events = [...mastered('a1', NOW - 3 * DAY), ...mastered('a2', NOW - 2 * DAY), ...mastered('b1', NOW - DAY)]
    const r = pick(events, { types: three })
    expect(ids(r)).toEqual(['b1', 'a1', 'a2'])
    expect(picks(r)).toEqual(['extra', 'extra', 'extra'])
  })

  it('a class with fewer types makes a shorter set; no class, no set', () => {
    expect(ids(pick([], { types: [type('u1', 'a1'), type('u1', 'a2')] }))).toEqual(['a1', 'a2'])
    expect(ids(pick([], { size: 2 }))).toEqual(['a1', 'a2'])
    const none = pick([], { types: [] })
    expect(none.types).toEqual([])
    expect(none.unitId).toBeNull()
  })
})

describe('buildSet on a real class', () => {
  const precalc = getCourse('precalc')!
  const chemistry = getCourse('chemistry')!
  const unit1Types = modulesInUnit(precalc.units[0]!).flatMap((m) => m.templates.map((t) => t.id))

  it('an empty history: three problems from the first unit, in Home’s order, at the default difficulty, with fresh seeds', () => {
    const set = buildSet({ course: precalc, events: [], rewards: emptyRewards(), now: NOW, seed: 42 })
    expect(set.courseId).toBe('precalc')
    expect(set.unitId).toBe('unit1')
    expect(set.problems.map((p) => p.templateId)).toEqual(unit1Types.slice(0, 3))
    expect(new Set(set.problems.map((p) => p.seed)).size).toBe(3)
    for (const p of set.problems) {
      const template = getTemplate(p.moduleId as ModuleId, p.templateId)
      expect(p.flags).toBe(flagsFromKnobs(defaultKnobs(template.knobs)))
      expect(generateProblem(p.moduleId as ModuleId, p.templateId, p.seed, {}).templateId).toBe(p.templateId)
    }
    // The same input gives the same set; another seed gives other problems of the same types.
    expect(buildSet({ course: precalc, events: [], rewards: emptyRewards(), now: NOW, seed: 42 })).toEqual(set)
    const other = buildSet({ course: precalc, events: [], rewards: emptyRewards(), now: NOW, seed: 43 })
    expect(other.problems.map((p) => p.templateId)).toEqual(unit1Types.slice(0, 3))
    expect(other.problems.map((p) => p.seed)).not.toEqual(set.problems.map((p) => p.seed))
  })

  it('stays in the class she selected: precalculus history does not leak into a chemistry set', () => {
    const events = [done('ineq.linear', NOW - DAY, { moduleId: 'inequalities' }), rejected('ineq.linear', NOW - DAY, 'no_sign_flip')]
    const set = buildSet({ course: chemistry, events, rewards: emptyRewards(), now: NOW, seed: 7 })
    const chemTypes = new Set(classTypes(chemistry).map((t) => t.templateId))
    expect(set.problems).toHaveLength(3)
    for (const p of set.problems) expect(chemTypes.has(p.templateId)).toBe(true)
    expect(set.unitId).toBe('ch3')
  })

  it('the properties drill (no problem types) is never in a set; every class has a full set', () => {
    expect(classTypes(precalc).some((t) => t.moduleId === 'propertiesDrill')).toBe(false)
    expect(setSizeFor(precalc)).toBe(3)
    expect(setSizeFor(chemistry)).toBe(3)
    expect(setSizeFor(getCourse('geometry')!)).toBe(3)
  })
})
