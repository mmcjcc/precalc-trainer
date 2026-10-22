/**
 * "Check my own problem" in the store (docs/progress/own-problem.md): her own problem's events are marked `own`, the
 * way Guided mode marks a picked line. They count for XP, the daily goal and the streak, and a named mistake makes its
 * card (its monster is caught); they never count for mastery, the rings, or squashing a card, and an own problem is not
 * a review of its type. The backup and the compaction keep the mark.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { buildBackup, importBackup } from './backup'
import { firstCatches } from './catches'
import { compact, inMasteryWindow, MASTERY_WINDOW } from './compaction'
import { useStore, resetStoreForTests } from './index'
import { computeRewards, skillRings, XP } from './rewards'
import { isOwnEvent, mastery, withoutOwn } from './selectors'
import { emptyRewards, type Ev } from './types'

const DAY = 86_400_000
const T0 = new Date(2026, 9, 1, 12).getTime()
const SKILL = 'ineq.linear'

type Done = Extract<Ev, { t: 'problem_done' }>

function done(at: number, attemptId: string, extra: Partial<Done> = {}): Done {
  return {
    t: 'problem_done',
    at,
    attemptId,
    skill: SKILL,
    moduleId: 'inequalities',
    steps: 2,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 30,
    ...extra,
  }
}

function line(at: number, attemptId: string, stepIdx: number, own = false): Ev {
  return { t: 'step_accepted', at, attemptId, skill: SKILL, stepIdx, firstTry: true, revealed: false, property: 'skipped', ...(own ? { own: true as const } : {}) }
}

const store = () => useStore.getState()

function startOwn(now: number) {
  store().startAttempt({
    problemId: 'own:inequalities/ineq.linear@1/2x + 1 > 7',
    moduleId: 'inequalities',
    templateId: SKILL,
    skill: SKILL,
    seed: '',
    difficulty: '',
    genVersion: 1,
    own: '2x + 1 > 7',
    now,
  })
}

beforeEach(() => resetStoreForTests())

describe('the store marks every event of her own problem', () => {
  it('lines, slips, hints, undo, checks and the finish all carry own; the summary says so', () => {
    startOwn(T0)
    expect(store().attempt).toMatchObject({ own: '2x + 1 > 7', seed: '' })
    store().rejectStep('no_sign_flip', T0 + 1)
    store().useHint(0, 1, T0 + 2)
    store().acceptStep({ text: '2x > 6', now: T0 + 3 })
    store().undoStep()
    store().acceptStep({ text: '2x > 6', now: T0 + 4 })
    store().recordFinalAnswer({ correct: false, pattern: 'endpoint_bracket', part: 'Interval notation', now: T0 + 5 })
    store().recordFinalAnswer({ correct: true, part: 'Interval notation', now: T0 + 6 })
    const summary = store().finishAttempt({ now: T0 + 7 })
    expect(summary?.own).toBe(true)
    const events = store().events
    expect(events.map((e) => e.t)).toEqual(['step_rejected', 'hint', 'step_accepted', 'step_undone', 'step_accepted', 'final_answer', 'final_answer', 'problem_done'])
    expect(events.every(isOwnEvent)).toBe(true)
  })

  it('leaving her problem for another marks the abandon own; a generated problem’s events carry nothing new', () => {
    startOwn(T0)
    store().acceptStep({ text: '2x > 6', now: T0 + 1 })
    store().startAttempt({ problemId: 'inequalities/ineq.linear@1/9', moduleId: 'inequalities', templateId: SKILL, skill: SKILL, seed: '9', difficulty: '', genVersion: 1, now: T0 + 2 })
    store().acceptStep({ text: 'x > 3', now: T0 + 3 })
    const summary = store().finishAttempt({ now: T0 + 4 })
    expect(summary?.own).toBe(false)
    const [first, abandoned, ...generated] = store().events
    expect(isOwnEvent(first!)).toBe(true)
    expect(abandoned).toMatchObject({ t: 'problem_abandoned', own: true })
    expect(generated.every((e) => !('own' in e))).toBe(true)
    expect(store().attempt).toBeNull()
  })
})

describe('what her own problem counts for', () => {
  it('never the mastery window or the rings', () => {
    const own = Array.from({ length: MASTERY_WINDOW + 1 }, (_, i) => done(T0 + i, `o${i}`, { own: true }))
    expect(own.every((e) => !inMasteryWindow(e))).toBe(true)
    expect(mastery(own, SKILL)).toMatchObject({ count: 0, mastered: false, rate: null })
    expect(skillRings(own).has(SKILL)).toBe(false)
    // Mixed in with generated ones, only those count.
    const gen = Array.from({ length: 2 }, (_, i) => done(T0 + 100 + i, `g${i}`))
    expect(mastery([...own, ...gen], SKILL).count).toBe(2)
    expect(skillRings([...own, ...gen]).get(SKILL)?.count).toBe(2)
  })

  it('its lines and its finish pay XP, as a generated problem’s do; never the +100 for a mastery', () => {
    const events: Ev[] = [line(T0, 'o', 0, true), line(T0 + 1, 'o', 1, true), done(T0 + 2, 'o', { own: true })]
    const view = computeRewards(events, emptyRewards(), 60, T0 + 3)
    expect(view.awards.map((a) => [a.kind, a.xp])).toEqual([
      ['line', XP.firstTry],
      ['line', XP.firstTry],
      ['finish', XP.finish],
      ['no_hints', XP.noHints],
    ])
    expect(view.today.xp).toBe(2 * XP.firstTry + XP.finish + XP.noHints)
    // That meets a daily goal of 30, and today starts a streak.
    const met = computeRewards(events, emptyRewards(), 30, T0 + 3)
    expect([met.today.met, met.streak.days]).toEqual([true, 1])
    // Five clean own problems in a row: no mastery award.
    const five = Array.from({ length: 5 }, (_, i) => done(T0 + 10 + i, `m${i}`, { own: true }))
    expect(computeRewards(five, emptyRewards(), 60, T0 + 20).awards.some((a) => a.kind === 'mastered')).toBe(false)
  })

  it('a named mistake makes its card (the monster is caught), and three own problems never squash it', () => {
    const slip: Ev = { t: 'step_rejected', at: T0, attemptId: 'o0', skill: SKILL, stepIdx: 0, pattern: 'no_sign_flip', own: true }
    expect(firstCatches([slip], { events: [], rewards: emptyRewards() })).toEqual(['no_sign_flip'])
    const ownAfter = [1, 2, 3].map((i) => done(T0 + i * DAY, `o${i}`, { own: true }))
    const card = computeRewards([slip, done(T0 + 1, 'o0', { own: true }), ...ownAfter], emptyRewards(), 60, T0 + 4 * DAY).cards[0]!
    expect(card).toMatchObject({ pattern: 'no_sign_flip', skill: SKILL, clean: 0, squashed: false })
    // Three generated problems of the type do squash it.
    const genAfter = [1, 2, 3].map((i) => done(T0 + i * DAY, `g${i}`))
    const view = computeRewards([slip, done(T0 + 1, 'o0', { own: true }), ...genAfter], emptyRewards(), 60, T0 + 4 * DAY)
    expect(view.cards[0]).toMatchObject({ clean: 3, squashed: true })
    expect(view.awards.some((a) => a.kind === 'squash')).toBe(true)
  })

  it('is not a review of a mastered type: the type still pays in full two weeks after its last generated problem', () => {
    const mastered = Array.from({ length: 5 }, (_, i) => done(T0 + i, `g${i}`))
    const ownLater = done(T0 + 10 * DAY, 'o', { own: true })
    const genLine = line(T0 + 15 * DAY, 'g9', 0)
    const view = computeRewards([...mastered, ownLater, genLine], emptyRewards(), 60, T0 + 15 * DAY)
    const award = view.awards.find((a) => a.attemptId === 'g9')!
    expect(award.half).toBeUndefined()
    expect(award.xp).toBe(XP.firstTry)
  })

  it('withoutOwn leaves only the generated problems’ events (sets, the path and the review read that)', () => {
    const events: Ev[] = [line(T0, 'o', 0, true), line(T0 + 1, 'g', 0), { t: 'drill_answer', at: T0 + 2, skill: 'drill', correct: true, kind: 'legal' }]
    expect(withoutOwn(events).map((e) => e.at)).toEqual([T0 + 1, T0 + 2])
    const plain: Ev[] = [line(T0, 'g', 0)]
    expect(withoutOwn(plain)).toBe(plain)
  })
})

describe('the compaction and the backup keep the mark', () => {
  it('the compaction keeps the last five generated finishes, never an own one in their place, and keeps own on what it keeps', () => {
    const now = T0 + 100 * DAY
    const old = T0
    const events: Ev[] = [
      ...Array.from({ length: 5 }, (_, i) => done(old + i, `g${i}`)),
      done(old + 10, 'o-old', { own: true }),
      line(now - DAY, 'o-new', 0, true),
      done(now - DAY + 1, 'o-new', { own: true }),
    ]
    const r = compact(events, {}, now)
    const kept = r.events
    // The five generated finishes stay for the mastery window; the old own one is folded.
    expect(kept.filter((e) => e.t === 'problem_done' && !isOwnEvent(e))).toHaveLength(5)
    expect(kept.some((e) => 'attemptId' in e && e.attemptId === 'o-old')).toBe(false)
    expect(r.folded).toBe(1)
    // The recent own events stay, marked.
    expect(kept.filter((e) => 'attemptId' in e && e.attemptId === 'o-new').every(isOwnEvent)).toBe(true)
  })

  it('own events survive export and import, replace and merge', () => {
    const events: Ev[] = [
      { t: 'step_rejected', at: 10, attemptId: 'own:a#1', skill: SKILL, stepIdx: 0, pattern: 'no_sign_flip', own: true },
      line(11, 'own:a#1', 0, true),
      { t: 'final_answer', at: 12, attemptId: 'own:a#1', skill: SKILL, correct: true, part: 'Interval notation', own: true },
      done(13, 'own:a#1', { own: true }),
      { t: 'problem_abandoned', at: 14, attemptId: 'own:b#2', skill: SKILL, own: true },
    ]
    const file = JSON.stringify(buildBackup({ settings: store().settings, events, weekly: {}, streak: { lastDay: '', count: 0 } }))
    const replaced = importBackup({ events: [], weekly: {}, streak: { lastDay: '', count: 0 } }, file, 'replace')
    if (!replaced.ok) throw new Error(replaced.error)
    expect(replaced.events).toEqual(events)
    const merged = importBackup({ events: events.slice(0, 2), weekly: {}, streak: { lastDay: '', count: 0 } }, file, 'merge')
    if (!merged.ok) throw new Error(merged.error)
    expect(merged.added).toBe(3)
    expect(merged.events).toEqual(events)
    // Through the store: the import keeps them marked.
    expect(store().importJson(file, 'replace')).toEqual({ ok: true, added: 5 })
    expect(store().events.every(isOwnEvent)).toBe(true)
  })
})
