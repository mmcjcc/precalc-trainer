// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { questCount } from '@/session/quests'
import { setRewards } from '@/session/summary'
import type { ActiveSet } from '@/session/activeSet'
import { buildBackup } from './backup'
import { inMasteryWindow } from './compaction'
import { STORAGE_KEYS, resetStoreForTests, useStore } from './index'
import { STUDY_XP_CAP, XP, computeRewards, skillRings } from './rewards'
import { mastery } from './selectors'
import { dayKey } from './time'
import { emptyRewards, type Ev } from './types'
import { blankCardsNote, STUDY_LIMITS, type StudySet } from './studySets'

const T0 = new Date(2026, 10, 4, 12).getTime()

function must<T extends { ok: true }>(result: T | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error)
  return result
}

function done(at: number): Ev {
  return {
    t: 'problem_done',
    at,
    attemptId: 'p1',
    skill: 'ineq.linear',
    moduleId: 'inequalities',
    steps: 1,
    firstTryRate: 1,
    hints: 1,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 10,
  }
}

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
})

describe('study sets in the store', () => {
  it('creates, renames, edits and deletes, and the slice survives a reload', async () => {
    const created = must(
      useStore.getState().createStudySet({
        title: '  Spanish  ',
        cards: [
          { term: '  hola ', definition: ' hello ' },
          { term: ' ', definition: 'gone' },
        ],
        now: 50,
      }),
    )
    expect(created.dropped).toBe(1)
    expect(created.set).toMatchObject({ title: 'Spanish', source: 'made', createdAt: 50, updatedAt: 50 })
    expect(created.set.cards).toEqual([{ id: created.set.cards[0]!.id, term: 'hola', definition: 'hello' }])
    const raw = localStorage.getItem(STORAGE_KEYS.studySets)!
    expect(JSON.parse(raw)).toEqual([created.set])

    resetStoreForTests()
    localStorage.setItem(STORAGE_KEYS.studySets, raw)
    await useStore.persist.rehydrate()
    expect(useStore.getState().studySets).toEqual([created.set])

    const id = created.set.id
    const renamed = must(useStore.getState().renameStudySet(id, ' French ', 60))
    expect(renamed.set.title).toBe('French')
    expect(renamed.set.updatedAt).toBe(60)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.studySets)! )[0].title).toBe('French')

    const saved = must(
      useStore.getState().saveStudySet(id, {
        title: 'French',
        cards: [
          { id: renamed.set.cards[0]!.id, term: 'bonjour', definition: 'hello' },
          { term: '', definition: '' },
        ],
        now: 70,
      }),
    )
    expect(saved.dropped).toBe(1)
    expect(saved.set.cards.map((card) => card.term)).toEqual(['bonjour'])
    expect(saved.set.cards[0]!.id).toBe(renamed.set.cards[0]!.id)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.studySets)!)[0].cards[0].term).toBe('bonjour')

    useStore.getState().deleteStudySet(id)
    expect(useStore.getState().studySets).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.studySets)!)).toEqual([])
  })

  it('drops blank cards and says so; a failed write leaves the sets alone', () => {
    expect(blankCardsNote(1)).toBe('1 blank card removed')
    expect(blankCardsNote(2)).toBe('2 blank cards removed')
    const created = must(
      useStore.getState().createStudySet({
        title: 'Notes',
        cards: [
          { term: 'keep', definition: 'this' },
          { term: '   ', definition: 'blank' },
          { term: 'also', definition: '  ' },
        ],
        now: 1,
      }),
    )
    expect(created.dropped).toBe(2)
    expect(blankCardsNote(created.dropped)).toBe('2 blank cards removed')
    expect(created.set.cards).toHaveLength(1)

    const empty = useStore.getState().createStudySet({ title: '   ', now: 2 })
    expect(empty).toEqual({ ok: false, error: 'Give the set a title.' })
    const longTitle = useStore.getState().renameStudySet(created.set.id, 't'.repeat(STUDY_LIMITS.maxTitle + 1), 3)
    expect(longTitle).toEqual({ ok: false, error: `A title can be at most ${STUDY_LIMITS.maxTitle} characters.` })
    expect(useStore.getState().studySets[0]!.title).toBe('Notes')

    const longField = useStore.getState().saveStudySet(created.set.id, {
      title: 'Notes',
      cards: [{ term: 'x'.repeat(STUDY_LIMITS.maxField + 1), definition: 'y' }],
      now: 4,
    })
    expect(longField).toEqual({ ok: false, error: `A term or a definition can be at most ${STUDY_LIMITS.maxField} characters.` })
    const tooMany = useStore.getState().saveStudySet(created.set.id, {
      title: 'Notes',
      cards: Array.from({ length: STUDY_LIMITS.maxCards + 1 }, (_, i) => ({ term: `t${i}`, definition: `d${i}` })),
      now: 5,
    })
    expect(tooMany).toEqual({ ok: false, error: `A set can have at most ${STUDY_LIMITS.maxCards} cards.` })
    expect(useStore.getState().studySets).toEqual([created.set])
    expect(useStore.getState().renameStudySet('missing', 'Nope').ok).toBe(false)
  })

  it('stops at 100 sets', () => {
    for (let i = 0; i < STUDY_LIMITS.maxSets; i++) {
      expect(useStore.getState().createStudySet({ title: `Set ${i}`, now: i + 1 }).ok).toBe(true)
    }
    const extra = useStore.getState().createStudySet({ title: 'One more', now: 10_000 })
    expect(extra).toEqual({ ok: false, error: `You can keep up to ${STUDY_LIMITS.maxSets} study sets. Delete one to add another.` })
    expect(useStore.getState().studySets).toHaveLength(STUDY_LIMITS.maxSets)
  })

  it('stores a best match time only when it is faster, and persists it', () => {
    const created = must(useStore.getState().createStudySet({ title: 'Cells', cards: [{ term: 'cell', definition: 'unit' }], now: 1 }))
    useStore.getState().recordStudyMatch(created.set.id, 5000, 10)
    expect(useStore.getState().studySets[0]).toMatchObject({ bestMatchMs: 5000, updatedAt: 10 })
    useStore.getState().recordStudyMatch(created.set.id, 8000, 20)
    useStore.getState().recordStudyMatch(created.set.id, Number.NaN, 21)
    expect(useStore.getState().studySets[0]).toMatchObject({ bestMatchMs: 5000, updatedAt: 10 })
    useStore.getState().recordStudyMatch(created.set.id, 1000, 30)
    expect(useStore.getState().studySets[0]).toMatchObject({ bestMatchMs: 1000, updatedAt: 30 })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.studySets)!)[0].bestMatchMs).toBe(1000)
  })

  it('a backup round-trip carries the sets; merge keeps the newer updatedAt; an old file does not wipe them', () => {
    const older: StudySet = {
      id: 'a',
      title: 'Older',
      cards: [{ id: 'c', term: 't', definition: 'd' }],
      createdAt: 1,
      updatedAt: 10,
      source: 'made',
    }
    const newer: StudySet = { ...older, title: 'Newer', updatedAt: 40 }
    const extra: StudySet = { id: 'b', title: 'Extra', cards: [], createdAt: 2, updatedAt: 3, source: 'imported' }
    useStore.setState({ studySets: [older] })
    const json = useStore.getState().exportJson()
    expect(JSON.parse(json).studySets).toEqual([older])
    resetStoreForTests()
    expect(useStore.getState().importJson(json, 'replace').ok).toBe(true)
    expect(useStore.getState().studySets).toEqual([older])

    const state = () => ({ settings: useStore.getState().settings, events: [], weekly: {}, streak: useStore.getState().streak })
    useStore.setState({ studySets: [older] })
    const incoming = JSON.stringify(buildBackup({ ...state(), studySets: [newer, extra] }))
    expect(useStore.getState().importJson(incoming, 'merge').ok).toBe(true)
    expect(useStore.getState().studySets).toEqual([newer, extra])

    useStore.setState({ studySets: [newer] })
    const stale = JSON.stringify(buildBackup({ ...state(), studySets: [older] }))
    expect(useStore.getState().importJson(stale, 'merge').ok).toBe(true)
    expect(useStore.getState().studySets).toEqual([newer])

    const old = JSON.parse(json) as Record<string, unknown>
    delete old.studySets
    useStore.setState({ studySets: [newer] })
    expect(useStore.getState().importJson(JSON.stringify(old), 'replace').ok).toBe(true)
    expect(useStore.getState().studySets).toEqual([newer])
  })
})

describe('study XP', () => {
  const learned = (cardId: string, at: number): Ev => ({ t: 'study_learned', setId: 's', cardId, at })
  const round = (at: number): Ev => ({ t: 'study_round', setId: 's', mode: 'flash', at })

  it('pays 1 for a card and 5 for a round, and counts them toward the goal and the streak', () => {
    expect(XP.studyLearned).toBe(1)
    expect(XP.studyRound).toBe(5)
    expect(STUDY_XP_CAP).toBe(30)
    const under: Ev[] = [...Array.from({ length: 5 }, (_, i) => round(T0 + i)), ...Array.from({ length: 4 }, (_, i) => learned(`c${i}`, T0 + 10 + i))]
    const short = computeRewards(under, emptyRewards(), 30, T0)
    expect(short.today.xp).toBe(29)
    expect(short.today.met).toBe(false)
    expect(short.streak.days).toBe(0)

    const met = computeRewards([...under, learned('c9', T0 + 20)], emptyRewards(), 30, T0)
    expect(met.today.xp).toBe(30)
    expect(met.today.met).toBe(true)
    expect(met.streak.days).toBe(1)
  })

  it('clips study XP at 30 for the day and still pays a finished problem on top', () => {
    const events: Ev[] = [
      ...Array.from({ length: 5 }, (_, i) => round(T0 + i)),
      ...Array.from({ length: 3 }, (_, i) => learned(`c${i}`, T0 + 10 + i)),
      round(T0 + 20),
      learned('c9', T0 + 21),
      done(T0 + 22),
    ]
    const view = computeRewards(events, emptyRewards(), 30, T0)
    expect(view.awards.filter((award) => award.kind === 'study').map((award) => award.xp)).toEqual([5, 5, 5, 5, 5, 1, 1, 1, 2])
    expect(view.awards.filter((award) => award.kind === 'finish').map((award) => award.xp)).toEqual([XP.finish])
    expect(view.awards.some((award) => award.kind === 'no_hints')).toBe(false)
    expect(view.today.xp).toBe(STUDY_XP_CAP + XP.finish)
    const next = round(T0 + 86_400_000)
    const later = computeRewards([...events, next], emptyRewards(), 30, T0 + 86_400_000)
    expect(later.awards.filter((award) => award.kind === 'study').at(-1)?.xp).toBe(XP.studyRound)
  })

  it('does not move mastery, a ring, a problem set or a quest', () => {
    const study: Ev[] = [learned('c', T0), round(T0 + 1)]
    expect(study.every((event) => !inMasteryWindow(event))).toBe(true)
    expect(mastery(study, 'ineq.linear')).toMatchObject({ count: 0, mastered: false })
    expect(skillRings(study).size).toBe(0)
    const awards = computeRewards(study, emptyRewards(), 60, T0).awards
    expect(awards.reduce((sum, award) => sum + award.xp, 0)).toBe(XP.studyLearned + XP.studyRound)
    const day = dayKey(T0)
    const input = { events: study, awards }
    expect(questCount({ kind: 'xp', target: 30 }, day, input)).toBe(0)
    expect(questCount({ kind: 'problems', target: 1 }, day, input)).toBe(0)
    expect(questCount({ kind: 'firstTry', target: 1 }, day, input)).toBe(0)
    expect(questCount({ kind: 'squash', target: 1 }, day, input)).toBe(0)
    expect(questCount({ kind: 'unmastered', target: 1 }, day, input)).toBe(0)
    expect(questCount({ kind: 'pathStop', target: 1, skill: 'ineq.linear' }, day, input)).toBe(0)
    expect(questCount({ kind: 'own', target: 1 }, day, input)).toBe(0)

    const mixed = [...study, done(T0 + 2)]
    const mixedAwards = computeRewards(mixed, emptyRewards(), 60, T0).awards
    const mixedInput = { events: mixed, awards: mixedAwards }
    expect(questCount({ kind: 'xp', target: 30 }, day, mixedInput)).toBe(XP.finish)
    expect(questCount({ kind: 'problems', target: 1 }, day, mixedInput)).toBe(1)
    const set: ActiveSet = {
      version: 1,
      id: 'set1',
      courseId: 'precalc',
      startedAt: T0,
      timed: false,
      problems: [{ moduleId: 'inequalities', templateId: 'ineq.linear', seed: 1, flags: '', pick: 'unit' }],
      index: 1,
      attemptIds: ['p1'],
      status: ['done'],
    }
    expect(setRewards(set, mixed, mixedAwards, day).xp).toBe(XP.finish)
    expect(setRewards(set, study, awards, day)).toMatchObject({ xp: 0, rings: [], squashed: [] })
  })
})
