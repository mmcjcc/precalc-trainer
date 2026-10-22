/** The unit path's pure model: the stops in course order, their states and names, "You are here", the road. */
import { describe, expect, it } from 'vitest'
import { COURSES, getCourse, modulesInUnit } from '@/content'
import { pickModule, stepByStepModule } from '@/problem/solveStyle'
import { buildSet } from '@/session/buildSet'
import { skillRings, type SkillRingInfo } from '@/store/rewards'
import { emptyRewards, type Ev, type MistakeCardState } from '@/store/types'
import { captionSide, laneOf, pathStops, roadCurve, setStart, solidLine, stateWords, stopName, unitPath } from './pathModel'

const DAY = 86_400_000
const HOUR = 3_600_000
const NOW = new Date(2026, 9, 21, 12).getTime()
const NO_RINGS = new Map<string, SkillRingInfo>()

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

/** `n` problems of a type that went well, the last at `lastAt`. */
function good(skill: string, n: number, lastAt: number): Ev[] {
  return Array.from({ length: n }, (_, i) => done(skill, lastAt - (n - 1 - i) * HOUR))
}

const precalc = getCourse('precalc')!
const unit1 = precalc.units[0]!
const unit3 = precalc.units[2]!

describe('the stops', () => {
  it('every unit of every class: its problem types in course order, module by module, numbered along the road', () => {
    for (const course of COURSES) {
      for (const unit of course.units) {
        const modules = unitPath(course, unit, NO_RINGS)
        const withTypes = modulesInUnit(unit).filter((m) => m.templates.length > 0)
        expect(modules.map((m) => m.moduleId)).toEqual(withTypes.map((m) => m.id))
        expect(pathStops(modules).map((s) => s.templateId)).toEqual(withTypes.flatMap((m) => m.templates.map((t) => t.id)))
        pathStops(modules).forEach((s, i) => expect(s.index).toBe(i))
        for (const m of modules) {
          expect(m.steps).toBe(stepByStepModule(m.moduleId))
          expect(m.pick).toBe(pickModule(m.moduleId))
          for (const s of m.stops) {
            expect(s.moduleTitle).toBe(m.title)
            expect(s.ring.level).toBe('new')
          }
        }
      }
    }
  })

  it('a module with no problem types (the properties drill) has no stretch of road', () => {
    const ids = unitPath(precalc, unit1, NO_RINGS).map((m) => m.moduleId)
    expect(modulesInUnit(unit1).map((m) => m.id)).toContain('propertiesDrill')
    expect(ids).not.toContain('propertiesDrill')
    expect(ids[0]).toBe('numberLine')
    expect(ids.at(-1)).toBe('diffQuotient')
  })

  it('each stop carries its ring from the log: new, practiced with a count, solid, mastered', () => {
    const events = [
      ...good('lf.convert', 2, NOW - DAY),
      done('lf.decimal', NOW - 2 * DAY, { firstTryRate: 0.5 }),
      ...good('lp.expand', 3, NOW - DAY),
      ...good('lp.condense', 5, NOW - DAY),
    ]
    const stops = pathStops(unitPath(precalc, unit3, skillRings(events)))
    const by = (id: string) => stops.find((s) => s.templateId === id)!
    expect(by('lf.value').ring.level).toBe('new')
    expect(stateWords(by('lf.value').ring)).toBe('new')
    expect(stateWords(by('lf.convert').ring)).toBe('practiced, 2 of 5')
    expect(stateWords(by('lf.decimal').ring)).toBe('practiced, 0 of 5')
    expect(stateWords(by('lp.expand').ring)).toBe('solid, 3 of 5')
    expect(stateWords(by('lp.condense').ring)).toBe('mastered')
    expect(solidLine(stops)).toBe(`2 of ${stops.length} types solid`)
  })

  it('names a stop by its type, its state, its module, and “You are here” first where the next set starts', () => {
    const events = good('ee.exponential', 2, NOW - DAY)
    const stop = pathStops(unitPath(precalc, unit3, skillRings(events))).find((s) => s.templateId === 'ee.exponential')!
    expect(stopName(stop, false)).toBe('Exponential equations: practiced, 2 of 5. In Exponential and logarithmic equations.')
    expect(stopName(stop, true)).toBe('You are here. Exponential equations: practiced, 2 of 5. In Exponential and logarithmic equations.')
  })

  it('“N of M types solid”, one type in the singular', () => {
    const one = pathStops(unitPath(precalc, unit1, NO_RINGS)).slice(0, 1)
    expect(solidLine(one)).toBe('0 of 1 type solid')
  })
})

describe('You are here: the set builder’s first type', () => {
  function firstOfSet(events: Ev[], startUnit: string, rewards = emptyRewards()) {
    return buildSet({ course: precalc, events, rewards, now: NOW, seed: 5, startUnit }).problems[0]!.templateId
  }

  it('matches the set for a new student, a student in Unit 3, a mistake to squash and a type due for review', () => {
    const logs: Ev[][] = [
      [],
      [...good('lf.value', 2, NOW - DAY), ...good('lf.convert', 1, NOW - 2 * DAY)],
      [
        ...good('lf.value', 1, NOW - DAY),
        { t: 'step_rejected', at: NOW - 3 * DAY, attemptId: 'x', skill: 'ineq.linear', stepIdx: 0, pattern: 'no_sign_flip' },
      ],
      [...good('dr.domain', 5, NOW - 20 * DAY), ...good('lf.value', 1, NOW - DAY)],
    ]
    // What each log's set starts with: the unit Home shows (new student), her working unit, the mistake, the review.
    expect(logs.map((events) => setStart(precalc, events, emptyRewards(), NOW, 'unit2')!.templateId)).toEqual([
      'cs.form',
      'lf.convert',
      'ineq.linear',
      'dr.domain',
    ])
    for (const events of logs) {
      for (const unit of precalc.units) {
        const start = setStart(precalc, events, emptyRewards(), NOW, unit.id)!
        expect(start.templateId).toBe(firstOfSet(events, unit.id))
        const owner = precalc.units.find((u) => pathStops(unitPath(precalc, u, NO_RINGS)).some((s) => s.templateId === start.templateId))!
        expect(start.unitId).toBe(owner.id)
      }
    }
  })

  it('a folded mistake card in the rewards slice counts too', () => {
    const card: MistakeCardState = {
      pattern: 'no_sign_flip',
      skill: 'ineq.linear',
      count: 2,
      firstAt: NOW - 75 * DAY,
      lastAt: NOW - 70 * DAY,
      lastAttempt: 'old',
      clean: 1,
    }
    const rewards = { ...emptyRewards(), foldedThrough: NOW - 61 * DAY, cards: { 'no_sign_flip|ineq.linear': card } }
    const events = good('lf.value', 1, NOW - DAY)
    expect(setStart(precalc, events, rewards, NOW, 'unit3')!.templateId).toBe('ineq.linear')
    expect(firstOfSet(events, 'unit3', rewards)).toBe('ineq.linear')
  })

  it('a class with no problem types has no start', () => {
    expect(setStart({ id: 'none', title: 'None', short: 'None', units: [] }, [], emptyRewards(), NOW, null)).toBeNull()
  })
})

describe('the road', () => {
  it('winds centre, right, far right, right, centre, left, far left, left, and again', () => {
    expect(Array.from({ length: 10 }, (_, i) => laneOf(i))).toEqual([0, 1, 2, 1, 0, -1, -2, -1, 0, 1])
  })

  it('puts a title on the side away from the edge its stop leans to', () => {
    expect(Array.from({ length: 8 }, (_, i) => captionSide(i))).toEqual(['left', 'left', 'left', 'left', 'right', 'right', 'right', 'right'])
  })

  it('draws an S-curve that leaves and arrives straight down', () => {
    expect(roadCurve(10, 0, 50, 40)).toBe('M 10 0 C 10 20 50 20 50 40')
  })
})
