/**
 * The collection's states from seeded event logs (collection.ts over the rewards' own cards): not seen, caught once,
 * caught three times, squashed, caught again after a squash, and a mistake caught in two problem types.
 */
import { describe, expect, it } from 'vitest'
import { ERROR_PATTERNS } from '@/engine'
import { computeRewards, emptyRewards, type Ev } from '@/store'
import { monsterCollection, monsterEntry, monsterStateWords, tallyLine } from './collection'
import { SPECIES, speciesForEdition } from './species'

const DAY = 86_400_000
const NOW = new Date(2026, 9, 21, 12).getTime()
const at = (daysAgo: number, hour = 9) => NOW - daysAgo * DAY + (hour - 12) * 3_600_000

function rejected(attemptId: string, skill: string, when: number, pattern: string): Ev {
  return { t: 'step_rejected', at: when, attemptId, skill, stepIdx: 0, pattern }
}

function wrongCheck(attemptId: string, skill: string, when: number, pattern: string): Ev {
  return { t: 'final_answer', at: when, attemptId, skill, correct: false, pattern, via: 'text' }
}

function done(attemptId: string, skill: string, when: number): Ev {
  return { t: 'problem_done', at: when, attemptId, skill, moduleId: 'inequalities', steps: 2, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 60 }
}

const cardsOf = (events: Ev[]) => computeRewards(events, emptyRewards(), 60, NOW).cards

describe('a monster’s state', () => {
  it('not seen: no card names it', () => {
    const m = monsterEntry('no_sign_flip', cardsOf([]))
    expect(m).toMatchObject({ status: 'unseen', count: 0, pips: 0, lastAt: null, practiceSkill: null })
    expect(m.title).toBe(ERROR_PATTERNS.no_sign_flip.title)
    expect(monsterStateWords(m)).toBe('Not caught yet')
  })

  it('caught once: on the loose, no pips yet', () => {
    const m = monsterEntry('no_sign_flip', cardsOf([rejected('a', 'ineq.linear', at(2), 'no_sign_flip')]))
    expect(m).toMatchObject({ status: 'caught', count: 1, pips: 0, lastSkill: 'ineq.linear', practiceSkill: 'ineq.linear' })
    expect(monsterStateWords(m)).toBe('Caught once, 0 of 3 clean problems to squash it')
  })

  it('caught three times, in two problem types, with clean problems since', () => {
    const events = [
      rejected('a', 'ineq.linear', at(5), 'no_sign_flip'),
      rejected('a', 'ineq.linear', at(5, 10), 'no_sign_flip'),
      done('a', 'ineq.linear', at(5, 11)),
      done('b', 'ineq.linear', at(4)), // 1 of 3 on ineq.linear (its own attempt never counts)
      done('c', 'ineq.linear', at(3)), // 2 of 3
      wrongCheck('d', 'ineq.compound', at(2), 'no_sign_flip'), // a second card, 0 of 3
    ]
    const m = monsterEntry('no_sign_flip', cardsOf(events))
    expect(m).toMatchObject({ status: 'caught', count: 3, lastSkill: 'ineq.compound' })
    // The pips and Practice follow the card closest to squashed.
    expect(m.pips).toBe(2)
    expect(m.practiceSkill).toBe('ineq.linear')
    expect(monsterStateWords(m)).toBe('Caught 3 times, 2 of 3 clean problems to squash it')
  })

  it('squashed: three clean problems of its type; caught again after that, it is on the loose again', () => {
    const squashed = [rejected('a', 'ineq.linear', at(6), 'flip_on_add'), done('b', 'ineq.linear', at(5)), done('c', 'ineq.linear', at(4)), done('d', 'ineq.linear', at(3))]
    const m = monsterEntry('flip_on_add', cardsOf(squashed))
    expect(m).toMatchObject({ status: 'squashed', count: 1, pips: 3, practiceSkill: 'ineq.linear' })
    expect(monsterStateWords(m)).toBe('Squashed. Caught once')
    const again = monsterEntry('flip_on_add', cardsOf([...squashed, rejected('e', 'ineq.linear', at(1), 'flip_on_add')]))
    expect(again).toMatchObject({ status: 'caught', count: 2, pips: 0 })
  })

  it('squashed in one type but still loose in another: on the loose, and Practice goes to the open one', () => {
    const events = [
      rejected('a', 'ineq.linear', at(6), 'no_sign_flip'),
      done('b', 'ineq.linear', at(5)),
      done('c', 'ineq.linear', at(4)),
      done('d', 'ineq.linear', at(3)),
      rejected('e', 'ineq.fraction', at(2), 'no_sign_flip'),
    ]
    const m = monsterEntry('no_sign_flip', cardsOf(events))
    expect(m).toMatchObject({ status: 'caught', count: 2, pips: 0, practiceSkill: 'ineq.fraction' })
  })
})

describe('the collection', () => {
  it('every species of the edition, every variant in table order; "N squashed · M on the loose"', () => {
    const events = [
      rejected('a', 'ineq.linear', at(6), 'flip_on_add'),
      done('b', 'ineq.linear', at(5)),
      done('c', 'ineq.linear', at(4)),
      done('d', 'ineq.linear', at(3)),
      rejected('e', 'ineq.linear', at(2), 'no_sign_flip'),
      wrongCheck('f', 'nl.read', at(1), 'endpoint_type'),
    ]
    const c = monsterCollection(cardsOf(events), SPECIES)
    expect(c.species.map((s) => s.species.id)).toEqual(SPECIES.map((s) => s.id))
    expect(c.squashed).toBe(1)
    expect(c.onTheLoose).toBe(2)
    expect(tallyLine(c)).toBe('1 squashed · 2 on the loose')
    const sign = c.species.find((s) => s.species.id === 'sign')!
    expect(sign.monsters.map((m) => m.id)).toEqual([...sign.species.variants])
    expect(sign).toMatchObject({ squashed: 1, onTheLoose: 1 })
    expect(c.species.find((s) => s.species.id === 'bracket')).toMatchObject({ squashed: 0, onTheLoose: 1 })
    expect(c.species.filter((s) => s.squashed + s.onTheLoose === 0)).toHaveLength(SPECIES.length - 2)
  })

  it('the store app’s collection has the math species only; a chemistry card has no monster there', () => {
    const events = [wrongCheck('a', 'sf.count', at(1), 'sf_leading_zeros')]
    const store = monsterCollection(cardsOf(events), speciesForEdition(true))
    expect(store.species.every((s) => s.species.subject === 'math')).toBe(true)
    expect(store.onTheLoose).toBe(0)
    const family = monsterCollection(cardsOf(events), speciesForEdition(false))
    expect(family.onTheLoose).toBe(1)
  })
})
