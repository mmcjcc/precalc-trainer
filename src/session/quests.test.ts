/**
 * The daily quests (session/quests.ts): three a day, deterministic from the day and her state when it began, always
 * doable, sized to the goal; progress read from the log for every kind (her own problems where their XP counts, undone
 * lines never); the chest only when all three are done, once a day, yesterday's for one more day.
 */
import { describe, expect, it } from 'vitest'
import { getCourse } from '@/content'
import { computeRewards } from '@/store/rewards'
import { emptyRewards, type DailyGoal, type Ev } from '@/store/types'
import { addDays } from '@/store/rewards'
import { dayKey, isoWeekKey } from '@/store/time'
import { classTypes } from './buildSet'
import {
  QUESTS_PER_DAY,
  canPractise,
  dayStart,
  openableChests,
  questCount,
  questDay,
  questDayWithout,
  questMoves,
  questSpecs,
  questTarget,
  questTitle,
  type QuestKind,
  type QuestSpec,
} from './quests'
import { QS, busyDay, cleanProblem, dayTime, finished, line, mistake, openCardBefore, questInput } from './questTesting'

const GROUP: Record<QuestKind, string> = {
  xp: 'volume',
  problems: 'volume',
  firstTry: 'skill',
  noHintSet: 'set',
  perfectSet: 'set',
  squash: 'focus',
  unmastered: 'focus',
  pathStop: 'focus',
  own: 'own',
}
const GOALS: DailyGoal[] = [30, 60, 100]
const START = '2026-09-07' // a Monday
const year = (n = 364) => Array.from({ length: n }, (_, i) => addDays(START, i))
const weekday = (day: string) => (new Date(dayStart(day)).getDay() + 6) % 7
const SWEEP = 600_000

/** Her log when the day begins: nothing; or a few finished problems; or a monster on the loose. */
function states(day: string): Record<string, Ev[]> {
  const before = dayStart(day)
  return {
    fresh: [],
    practised: [...cleanProblem('p1', before - 86_400_000, 2), ...cleanProblem('p2', before - 86_400_000 + 600_000, 2)],
    monster: [...openCardBefore(day)],
  }
}

describe('the day’s quests', () => {
  it('are three, from three groups, sized to the goal, the same every time; a squash only with a monster on the loose', { timeout: SWEEP }, () => {
    const seen = new Set<QuestKind>()
    for (const day of year()) {
      for (const [name, events] of Object.entries(states(day))) {
        for (const goal of GOALS) {
          const input = questInput(events, goal)
          const specs = questSpecs(day, input)
          expect(specs).toHaveLength(QUESTS_PER_DAY)
          expect(new Set(specs.map((s) => GROUP[s.kind])).size).toBe(QUESTS_PER_DAY)
          for (const s of specs) {
            seen.add(s.kind)
            expect(s.target).toBe(questTarget(s.kind, goal))
            if (s.kind === 'pathStop') expect(canPractise(s.skill!)).toBe(true)
            if (s.kind === 'squash') expect(name).toBe('monster')
            if (s.kind === 'perfectSet') expect(goal).toBeGreaterThan(30)
            if (s.kind === 'own') expect(weekday(day)).toBeLessThan(4)
          }
          // Deterministic: asked again (a reload, another screen), the same three.
          expect(questSpecs(day, questInput([...events], goal))).toEqual(specs)
        }
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(GROUP).sort())
  })

  it('sizes follow the goal: 30, 60 or 100 XP', () => {
    expect([30, 60, 100].map((g) => questTarget('xp', g as DailyGoal))).toEqual([30, 60, 100])
    expect([30, 60, 100].map((g) => questTarget('problems', g as DailyGoal))).toEqual([2, 3, 4])
    expect([30, 60, 100].map((g) => questTarget('firstTry', g as DailyGoal))).toEqual([5, 8, 12])
    expect([30, 60, 100].map((g) => questTarget('unmastered', g as DailyGoal))).toEqual([1, 1, 2])
    expect(questTarget('squash', 100)).toBe(1)
    expect(questTitle({ kind: 'problems', target: 3 })).toBe('Finish 3 problems')
    expect(questTitle({ kind: 'noHintSet', target: 1 })).toBe('Finish a set with no hints')
  })

  it('what she does during the day never changes the day’s quests', () => {
    for (const day of year(30)) {
      const before = states(day).monster
      const specs = questSpecs(day, questInput(before))
      const after = [...before, ...busyDay(day, specs)]
      expect(questSpecs(day, questInput(after))).toEqual(specs)
    }
  })

  it('the homework quest comes on one school day a week, only where her class takes her own problem', { timeout: SWEEP }, () => {
    const weeks = new Map<string, number>()
    for (const day of year()) {
      const own = questSpecs(day, questInput([])).some((s) => s.kind === 'own')
      if (own) weeks.set(isoWeekKey(dayStart(day)), (weeks.get(isoWeekKey(dayStart(day))) ?? 0) + 1)
      // Geometry has no "Check my own problem".
      expect(questSpecs(day, questInput([], 60, { courseId: 'geometry' })).some((s) => s.kind === 'own')).toBe(false)
    }
    expect(weeks.size).toBe(52)
    expect([...weeks.values()].every((n) => n === 1)).toBe(true)
  })

  it('a goal of 30 asks for a squash only when a monster is two clean problems or fewer from squashed', { timeout: SWEEP }, () => {
    let far = 0
    let near = 0
    for (const day of year(120)) {
      const card = openCardBefore(day)
      far += questSpecs(day, questInput(card, 30)).filter((s) => s.kind === 'squash').length
      const oneClean = [...card, ...cleanProblem('k1', dayStart(day) - 3_600_000, 1)]
      near += questSpecs(day, questInput(oneClean, 30)).filter((s) => s.kind === 'squash').length
    }
    expect(far).toBe(0)
    expect(near).toBeGreaterThan(0)
  })

  it('her class is the class of her latest problem before the day (else Home’s); the path stop is one of its types', () => {
    const day = '2026-10-21'
    const geo = classTypes(getCourse('geometry')!)[0]!
    const events = cleanProblem('g1', dayStart(day) - 3_600_000, 1, { skill: geo.templateId, moduleId: geo.moduleId })
    for (let i = 0; i < 30; i++) {
      const d = addDays(day, i)
      const path = questSpecs(d, questInput(events, 60, { courseId: 'precalc' })).find((s) => s.kind === 'pathStop')
      if (path) expect(classTypes(getCourse('geometry')!).some((t) => t.templateId === path.skill)).toBe(true)
    }
  })

  it('never offers "Practice the next stop on your path" for SAT Math Prep (whose units have no path of their own)', () => {
    for (const day of year(90)) {
      for (const events of Object.values(states(day))) {
        for (const goal of GOALS) {
          const specs = questSpecs(day, questInput(events, goal, { courseId: 'sat' }))
          expect(specs).toHaveLength(QUESTS_PER_DAY)
          expect(specs.some((s) => s.kind === 'pathStop')).toBe(false)
          expect(specs.map((s) => questTitle(s))).not.toContain('Practice the next stop on your path')
        }
      }
    }
  })
})

describe('progress, from the log', () => {
  const day = '2026-10-21'
  const t = (h: number, m = 0) => dayTime(day, h, m)
  const count = (spec: QuestSpec, events: Ev[], mastered: string[] = []) =>
    questCount(spec, day, { events, awards: computeRewards(events, emptyRewards(), 60).awards }, new Set(mastered))

  it('XP: the day’s XP from her work, her own problems included, a chest’s bonus not', () => {
    const events: Ev[] = [
      ...cleanProblem('a', t(9), 2), // +20 lines, +20 finished, +10 no hints
      ...cleanProblem('b', t(10), 1, { own: true }), // +40
      finished('old', dayTime('2026-10-20', 9)), // yesterday's
      { t: 'chest_opened', at: t(11), day: '2026-10-20', reward: { kind: 'xp', xp: 40 } },
    ]
    expect(count({ kind: 'xp', target: 60 }, events)).toBe(90)
  })

  it('lines or parts right first try: lines, parts and cards picked right count; an undone line, a fixed one, a shown one do not', () => {
    const events: Ev[] = [
      line('a', 0, t(9)),
      line('a', 1, t(9, 1)),
      { t: 'step_undone', at: t(9, 2), attemptId: 'a', skill: QS, stepIdx: 1 },
      line('a', 1, t(9, 3), { firstTry: false }), // kept again after the undo: not first try
      { t: 'step_rejected', at: t(9, 4), attemptId: 'a', skill: QS, stepIdx: 2, pattern: 'no_sign_flip' },
      line('a', 2, t(9, 5), { firstTry: false }), // fixed after a mistake
      { t: 'step_accepted', at: t(9, 6), attemptId: 'a', skill: QS, stepIdx: 3, firstTry: false, revealed: true, property: 'skipped' },
      line('a', 4, t(9, 7), { via: 'card' }), // picked right on the first pick
      { t: 'final_answer', at: t(9, 8), attemptId: 'a', skill: QS, correct: true, via: 'text' }, // a part
      line('own', 0, t(10), { own: true }),
    ]
    expect(count({ kind: 'firstTry', target: 8 }, events)).toBe(4)
  })

  it('problems: every finished problem, her own and a timed one included', () => {
    const events = [finished('a', t(9)), finished('b', t(10), { own: true }), finished('c', t(11), { mode: 'timed' }), finished('y', dayTime('2026-10-20', 9))]
    expect(count({ kind: 'problems', target: 3 }, events)).toBe(3)
  })

  it('a set with no hints, and a perfect set: nothing skipped, read from the set’s end', () => {
    const set = (id: string, done: string[], skipped = 0): Ev => ({ t: 'set_done', at: t(12), setId: id, done, skipped })
    const clean = [...cleanProblem('s1', t(9), 2), ...cleanProblem('s2', t(9, 10), 2), ...cleanProblem('s3', t(9, 20), 2)]
    expect(count({ kind: 'noHintSet', target: 1 }, [...clean, set('A', ['s1', 's2', 's3'])])).toBe(1)
    expect(count({ kind: 'perfectSet', target: 1 }, [...clean, set('A', ['s1', 's2', 's3'])])).toBe(1)
    // A hint in one of its problems: no "no hints" set; still right first time.
    const hinted: Ev[] = [...clean, { t: 'hint', at: t(9, 1), attemptId: 's2', skill: QS, stepIdx: 0, rung: 1 }, set('A', ['s1', 's2', 's3'])]
    expect(count({ kind: 'noHintSet', target: 1 }, hinted)).toBe(0)
    expect(count({ kind: 'perfectSet', target: 1 }, hinted)).toBe(1)
    // A slip in one: not perfect.
    const slipped = [
      ...cleanProblem('s1', t(9), 2),
      mistake('s2', t(9, 9)),
      line('s2', 0, t(9, 10), { firstTry: false }),
      line('s2', 1, t(9, 11)),
      finished('s2', t(9, 12), { steps: 2, firstTryRate: 0.5 }),
      ...cleanProblem('s3', t(9, 20), 2),
    ]
    expect(count({ kind: 'perfectSet', target: 1 }, [...slipped, set('A', ['s1', 's2', 's3'])])).toBe(0)
    // A skipped problem: the set counts for neither.
    expect(count({ kind: 'noHintSet', target: 1 }, [...clean, set('A', ['s1', 's2'], 1)])).toBe(0)
    expect(count({ kind: 'perfectSet', target: 1 }, [...clean, set('A', ['s1', 's2'], 1)])).toBe(0)
  })

  it('a squash: the rewards’ own; her own problems never squash', () => {
    const card = [mistake('c0', dayTime('2026-10-20', 9))]
    const three = [...cleanProblem('k1', t(9), 1), ...cleanProblem('k2', t(10), 1), ...cleanProblem('k3', t(11), 1)]
    expect(count({ kind: 'squash', target: 1 }, [...card, ...three])).toBe(1)
    const own = [...cleanProblem('k1', t(9), 1, { own: true }), ...cleanProblem('k2', t(10), 1, { own: true }), ...cleanProblem('k3', t(11), 1, { own: true })]
    expect(count({ kind: 'squash', target: 1 }, [...card, ...own])).toBe(0)
  })

  it('a type not mastered, the path’s stop: generated problems only, never her own', () => {
    const events = [finished('a', t(9)), finished('b', t(10), { own: true }), finished('c', t(11), { skill: 'nl.read' })]
    expect(count({ kind: 'unmastered', target: 1 }, events)).toBe(2)
    expect(count({ kind: 'unmastered', target: 1 }, events, [QS])).toBe(1)
    expect(count({ kind: 'pathStop', target: 1, skill: QS }, events)).toBe(1)
    expect(count({ kind: 'pathStop', target: 1, skill: 'nl.read' }, events)).toBe(1)
    expect(count({ kind: 'pathStop', target: 1, skill: 'ee.exponential' }, events)).toBe(0)
  })

  it('her homework: a finished problem of her own', () => {
    expect(count({ kind: 'own', target: 1 }, [finished('a', t(9)), finished('b', t(10), { own: true })])).toBe(1)
    expect(count({ kind: 'own', target: 1 }, [finished('a', t(9))])).toBe(0)
  })
})

describe('the chest', () => {
  it('appears only when all three are done, once a day; yesterday’s waits one day, then it is gone', () => {
    const day = '2026-10-21'
    const before = openCardBefore(day)
    const specs = questSpecs(day, questInput(before))
    const now = dayTime(day, 18)
    expect(openableChests(questInput(before), now)).toEqual([])
    const all = [...before, ...busyDay(day, specs)]
    const full = questDay(day, questInput(all))
    expect(full.allDone).toBe(true)
    expect(openableChests(questInput(all), now)).toEqual([{ day, when: 'today' }])
    // Opened: gone for the day.
    const openedToday: Ev[] = [...all, { t: 'chest_opened', at: now, day, reward: { kind: 'xp', xp: 15 } }]
    expect(openableChests(questInput(openedToday), now + 1000)).toEqual([])
    // Not opened: tomorrow it waits as yesterday's, the day after it is gone.
    const tomorrow = dayTime(addDays(day, 1), 9)
    expect(openableChests(questInput(all), tomorrow)).toEqual([{ day, when: 'yesterday' }])
    expect(openableChests(questInput(all), dayTime(addDays(day, 2), 9))).toEqual([])
    expect(dayKey(tomorrow)).toBe('2026-10-22')
  })

  it('two of three done is no chest', () => {
    // A day with the homework quest: everything but her own problem done.
    const day = year(7).find((d) => questSpecs(d, questInput(openCardBefore(d))).some((q) => q.kind === 'own'))!
    const before = openCardBefore(day)
    const specs = questSpecs(day, questInput(before))
    const noHomework = [...before, ...busyDay(day, specs)].filter((e) => !('own' in e && e.own))
    const read = questDay(day, questInput(noHomework))
    expect(read.done).toBe(2)
    expect(read.allDone).toBe(false)
    expect(read.quests.find((q) => q.kind === 'own')!.done).toBe(false)
    expect(openableChests(questInput(noHomework), dayTime(day, 18))).toEqual([])
  })

  it('what a problem moved: read without it, then with it', () => {
    const day = '2026-10-21'
    const before = openCardBefore(day)
    const specs = questSpecs(day, questInput(before))
    const all = [...before, ...busyDay(day, specs)]
    const input = questInput(all)
    const without = questDayWithout(day, input, new Set(['q1-2026-10-21', 'q2-2026-10-21', 'q3-2026-10-21']), 'set-busy')
    const moves = questMoves(without, questDay(day, input))
    expect(moves.length).toBeGreaterThan(0)
    for (const m of moves) expect(m.quest.count).toBeGreaterThan(m.before)
    expect(questMoves(questDay(day, input), questDay(day, input))).toEqual([])
  })
})
