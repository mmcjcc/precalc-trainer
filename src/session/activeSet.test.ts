// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { getCourse } from '@/content'
import { emptyRewards } from '@/store/types'
import {
  clearActiveSet,
  currentSlotOf,
  loadActiveSet,
  markSlotDone,
  newActiveSet,
  nextInSet,
  noteSetAttempt,
  readyForResults,
  resumePosition,
  resumeSet,
  sameSetProblem,
  saveActiveSet,
  SET_STORAGE_KEY,
  setFinished,
  showSetResults,
  skipInSet,
  type ActiveSet,
} from './activeSet'
import { buildSet } from './buildSet'

const NOW = new Date(2026, 9, 20, 12).getTime()

function fresh(): ActiveSet {
  const built = buildSet({ course: getCourse('precalc')!, events: [], rewards: emptyRewards(), now: NOW, seed: 99 })
  return newActiveSet(built, { now: NOW, timed: false })
}

/** The attempt fields that say which problem it is, for slot `i`. */
function attemptFor(set: ActiveSet, i: number) {
  const p = set.problems[i]!
  return { moduleId: p.moduleId, templateId: p.templateId, seed: p.seed.toString(36), difficulty: p.flags }
}

beforeEach(() => {
  localStorage.clear()
})

describe('the set session', () => {
  it('starts on its first problem with every slot open', () => {
    const set = fresh()
    expect(set.version).toBe(1)
    expect(set.courseId).toBe('precalc')
    expect(set.index).toBe(0)
    expect(set.status).toEqual(['pending', 'pending', 'pending'])
    expect(set.attemptIds).toEqual([null, null, null])
    expect(set.timed).toBe(false)
    expect(setFinished(set)).toBe(false)
  })

  it('knows its problem’s attempt: same type, seed and difficulty, and only the slot she is on', () => {
    const set = fresh()
    expect(sameSetProblem(attemptFor(set, 0), set.problems[0]!)).toBe(true)
    expect(sameSetProblem({ ...attemptFor(set, 0), difficulty: 'n' }, set.problems[0]!)).toBe(false)
    expect(currentSlotOf(set, attemptFor(set, 0))).toBe(0)
    expect(currentSlotOf(set, attemptFor(set, 1))).toBeNull()
    expect(currentSlotOf(markSlotDone(set, 0), attemptFor(set, 0))).toBeNull()
  })

  it('next: a finished problem, then the next one; never past the last', () => {
    let set = noteSetAttempt(fresh(), 0, 'att-0')
    expect(noteSetAttempt(set, 0, 'att-0')).toBe(set)
    set = markSlotDone(set, 0)
    expect(set.status[0]).toBe('done')
    expect(set.index).toBe(0) // she taps Next in set herself
    set = nextInSet(set)
    expect(set.index).toBe(1)
    set = nextInSet(set)
    expect(set.index).toBe(2)
    expect(set.status).toEqual(['done', 'done', 'pending'])
    expect(nextInSet(set)).toBe(set)
    expect(readyForResults(set)).toBe(false)
    expect(showSetResults(set)).toBe(set)
    set = markSlotDone(set, 2)
    expect(readyForResults(set)).toBe(true)
    set = showSetResults(set)
    expect(set.index).toBe(3)
    expect(setFinished(set)).toBe(true)
  })

  it('skip: it counts as skipped and moves on; the last one stays for See results', () => {
    let set = skipInSet(fresh())
    expect(set.status).toEqual(['skipped', 'pending', 'pending'])
    expect(set.index).toBe(1)
    set = nextInSet(markSlotDone(set, 1))
    set = skipInSet(set)
    expect(set.status).toEqual(['skipped', 'done', 'skipped'])
    expect(set.index).toBe(2)
    expect(readyForResults(set)).toBe(true)
    // A finished problem cannot be skipped.
    const finished = markSlotDone(fresh(), 0)
    expect(skipInSet(finished)).toBe(finished)
  })

  it('leave and resume: the set is kept; a finished problem she did not leave with Next is behind her', () => {
    const set = noteSetAttempt(fresh(), 0, 'att-0')
    expect(saveActiveSet(set)).toBe(true)
    expect(loadActiveSet()).toEqual(set)
    expect(resumePosition(set)).toBe(1)
    const finishedFirst = markSlotDone(set, 0)
    expect(resumeSet(finishedFirst).index).toBe(1)
    expect(resumePosition(finishedFirst)).toBe(2)
    // The last slot stays where it is: "See results" is hers to tap.
    const lastDone = markSlotDone({ ...finishedFirst, index: 2, status: ['done', 'done', 'pending'] }, 2)
    expect(resumeSet(lastDone)).toBe(lastDone)
    expect(resumePosition(lastDone)).toBe(3)
    clearActiveSet()
    expect(loadActiveSet()).toBeNull()
  })
})

describe('the stored set is checked on read', () => {
  function stored(value: unknown) {
    localStorage.setItem(SET_STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value))
    return loadActiveSet()
  }

  it('ignores unreadable text, an older or newer version, and the wrong shapes', () => {
    const good = fresh()
    expect(stored(good)).toEqual(good)
    expect(stored('{not json')).toBeNull()
    expect(stored({ ...good, version: 0 })).toBeNull()
    expect(stored({ ...good, version: 2 })).toBeNull()
    expect(stored({ ...good, problems: [] , attemptIds: [], status: [] })).toBeNull()
    expect(stored({ ...good, index: 4 })).toBeNull()
    expect(stored({ ...good, index: -1 })).toBeNull()
    expect(stored({ ...good, index: 2 })).toBeNull() // slots before hers are still open
    expect(stored({ ...good, status: ['done', 'wrong', 'pending'] })).toBeNull()
    expect(stored({ ...good, attemptIds: [null, 7, null] })).toBeNull()
    expect(stored({ ...good, attemptIds: [null, null] })).toBeNull()
    expect(stored({ ...good, problems: good.problems.map((p, i) => (i === 1 ? { ...p, seed: -5 } : p)) })).toBeNull()
    expect(stored({ ...good, problems: good.problems.map((p, i) => (i === 1 ? { ...p, flags: 'zz' } : p)) })).toBeNull()
    expect(stored({ ...good, problems: good.problems.map((p, i) => (i === 1 ? { ...p, pick: 'random' } : p)) })).toBeNull()
    expect(stored({ ...good, timed: 'no' })).toBeNull()
    expect(stored([good])).toBeNull()
    expect(stored(null)).toBeNull()
  })

  it('ignores a set naming a problem type that no longer exists', () => {
    const good = fresh()
    expect(stored({ ...good, problems: good.problems.map((p, i) => (i === 2 ? { ...p, templateId: 'gone.template' } : p)) })).toBeNull()
    expect(stored({ ...good, problems: good.problems.map((p, i) => (i === 0 ? { ...p, moduleId: 'goneModule' } : p)) })).toBeNull()
  })
})
