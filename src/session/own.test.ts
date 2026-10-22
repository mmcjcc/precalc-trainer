/**
 * "Check my own problem" never steers what she practises next (docs/progress/own-problem.md): the set builder (and so
 * the path's "You are here", which is a set's first type) and the unit review's weak-skill picks leave her own
 * problems' events out. Her own problem's difficulty is unknown.
 */
import { describe, expect, it } from 'vitest'
import { reviewTemplateWeights } from '@/pages/review/buildReview'
import { emptyRewards, type Ev } from '@/store/types'
import { pickSetTypes, workingUnit, type ClassType } from './buildSet'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 20, 12).getTime()

const TYPES: ClassType[] = [
  { unitId: 'u1', moduleId: 'm1', templateId: 'a1', flags: '' },
  { unitId: 'u1', moduleId: 'm1', templateId: 'a2', flags: '' },
  { unitId: 'u2', moduleId: 'm2', templateId: 'b1', flags: '' },
  { unitId: 'u2', moduleId: 'm2', templateId: 'b2', flags: '' },
  { unitId: 'u2', moduleId: 'm2', templateId: 'b3', flags: '' },
]

function slip(skill: string, at: number, own: boolean): Ev {
  return { t: 'step_rejected', at, attemptId: `${skill}#${at}`, skill, stepIdx: 0, pattern: 'no_sign_flip', ...(own ? { own: true as const } : {}) }
}

function done(skill: string, at: number, own: boolean): Ev {
  return {
    t: 'problem_done',
    at,
    attemptId: `${skill}#${at}`,
    skill,
    moduleId: 'm',
    steps: 2,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 60,
    ...(own ? { own: true as const } : {}),
  }
}

describe('her own problems never steer a set or the path', () => {
  it('an open mistake card from her own problem is not rule (a); the same mistake in a generated problem is', () => {
    const base = pickSetTypes({ types: TYPES, events: [], rewards: emptyRewards(), now: NOW })
    const own = pickSetTypes({ types: TYPES, events: [slip('b3', NOW - DAY, true)], rewards: emptyRewards(), now: NOW })
    expect(own.types).toEqual(base.types)
    const generated = pickSetTypes({ types: TYPES, events: [slip('b3', NOW - DAY, false)], rewards: emptyRewards(), now: NOW })
    expect(generated.types[0]).toMatchObject({ templateId: 'b3', pick: 'mistake' })
  })

  it('her own problem in another unit does not move the unit she is working in', () => {
    const events = [done('b1', NOW - 2 * DAY, false), done('a1', NOW - DAY, true)]
    const r = pickSetTypes({ types: TYPES, events, rewards: emptyRewards(), now: NOW })
    expect(r.unitId).toBe('u2')
    // workingUnit alone reads what it is given; pickSetTypes gives it the log without her own problems.
    expect(workingUnit(TYPES, events)).toBe('u1')
  })
})

describe('her own problems never steer the unit review', () => {
  it('her own slips add no weight to a type', () => {
    const plain = reviewTemplateWeights([], ['a1', 'a2'])
    const own = reviewTemplateWeights([slip('a1', NOW, true), slip('a1', NOW + 1, true)], ['a1', 'a2'])
    expect(own).toEqual(plain)
    const generated = reviewTemplateWeights([slip('a1', NOW, false)], ['a1', 'a2'])
    expect(generated.get('a1')!).toBeGreaterThan(plain.get('a1')!)
  })
})
