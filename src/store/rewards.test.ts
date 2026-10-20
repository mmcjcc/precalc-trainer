import { describe, expect, it } from 'vitest'
import { compact } from './compaction'
import {
  computeRewards,
  dailyGoalOf,
  finishInfo,
  foldRewards,
  mergeRewards,
  normalizeRewards,
  openCards,
  rewardsOn,
  settleDays,
  skillRing,
  vibrateOn,
  xpAwards,
  type XpAward,
} from './rewards'
import { SIXTY_DAYS_MS, dayKey } from './time'
import { emptyRewards, type Ev, type RewardsState } from './types'

// Calendar: Tuesday 2026-09-01; Mondays are Aug 31, Sep 7, 14, 21. "Today" is Wednesday Sep 16.
/** Local time `offset` days from Wednesday 2026-09-16, at `hour`. */
const dayAt = (offset: number, hour = 10, minute = 0) => new Date(2026, 8, 16 + offset, hour, minute).getTime()
const NOW = dayAt(0, 18)
const S = 'ineq.linear'

type Done = Extract<Ev, { t: 'problem_done' }>

function accepted(attemptId: string, stepIdx: number, at: number, opts: { firstTry?: boolean; revealed?: boolean; skill?: string } = {}): Ev {
  return {
    t: 'step_accepted',
    at,
    attemptId,
    skill: opts.skill ?? S,
    stepIdx,
    firstTry: opts.firstTry ?? true,
    revealed: opts.revealed ?? false,
    property: 'skipped',
  }
}

function rejected(attemptId: string, stepIdx: number, at: number, pattern?: string, skill = S): Ev {
  return { t: 'step_rejected', at, attemptId, skill, stepIdx, ...(pattern ? { pattern } : {}) }
}

function final(attemptId: string, at: number, correct: boolean, opts: { pattern?: string; part?: string; skill?: string } = {}): Ev {
  return {
    t: 'final_answer',
    at,
    attemptId,
    skill: opts.skill ?? S,
    correct,
    via: 'text',
    ...(opts.pattern ? { pattern: opts.pattern } : {}),
    ...(opts.part ? { part: opts.part } : {}),
  }
}

function hint(attemptId: string, stepIdx: number, at: number, rung: 1 | 2 | 3): Ev {
  return { t: 'hint', at, attemptId, skill: S, stepIdx, rung }
}

function done(attemptId: string, at: number, opts: Partial<Done> = {}): Ev {
  return {
    t: 'problem_done',
    at,
    attemptId,
    skill: S,
    moduleId: 'inequalities',
    steps: 3,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 90,
    ...opts,
  }
}

let seq = 0
/** `n` timed finishes of 30 XP each (finish + no hints). Timed problems never touch mastery, so nothing is halved. */
function work(at: number, n: number): Ev[] {
  return Array.from({ length: n }, (_, i) => {
    seq += 1
    return done(`w${seq}`, at + i * 60_000, { skill: 'warmup', mode: 'timed', steps: 0 })
  })
}

const kinds = (awards: readonly XpAward[]) => awards.map((a) => [a.kind, a.xp])
const awardsOf = (events: Ev[], rewards: RewardsState = emptyRewards()) => xpAwards(events, rewards)

describe('XP from the event log', () => {
  it('a line right on the first try +10, fixed after a named mistake +5, after an unnamed one 0, revealed 0', () => {
    const t = dayAt(0)
    const events: Ev[] = [
      accepted('a', 0, t),
      rejected('a', 1, t + 1, 'no_sign_flip'),
      accepted('a', 1, t + 2, { firstTry: false }),
      rejected('a', 2, t + 3),
      accepted('a', 2, t + 4, { firstTry: false }),
      hint('a', 3, t + 5, 1),
      hint('a', 3, t + 6, 2),
      hint('a', 3, t + 7, 3),
      accepted('a', 3, t + 8, { firstTry: false, revealed: true }),
      done('a', t + 9, { hints: 3, revealed: 1 }),
    ]
    expect(kinds(awardsOf(events))).toEqual([
      ['line', 10],
      ['line_fixed', 5],
      ['finish', 20],
    ])
  })

  it('a finished problem +20, and +10 more with no hints and nothing revealed; hints cost nothing else', () => {
    const t = dayAt(0)
    const events: Ev[] = [
      hint('a', 0, t, 1),
      hint('a', 0, t + 1, 2),
      accepted('a', 0, t + 2),
      done('a', t + 3, { hints: 2 }),
      accepted('b', 0, t + 4),
      done('b', t + 5),
      done('c', t + 6, { revealed: 1 }),
    ]
    expect(kinds(awardsOf(events))).toEqual([
      ['line', 10],
      ['finish', 20],
      ['line', 10],
      ['finish', 20],
      ['no_hints', 10],
      ['finish', 20],
    ])
  })

  it('parts: right on the first check +10, fixed after a named mistake +5, after a plain wrong one 0, revealed 0', () => {
    const t = dayAt(0)
    const events: Ev[] = [
      final('p', t, true),
      final('p', t + 1, false, { pattern: 'geo_isosceles_base' }),
      final('p', t + 2, false),
      final('p', t + 3, true),
      final('p', t + 4, false),
      final('p', t + 5, true),
      hint('p', 3, t + 6, 1),
      hint('p', 3, t + 7, 2),
      hint('p', 3, t + 8, 3),
      final('p', t + 9, true),
      final('p', t + 10, true),
      done('p', t + 11, { hints: 3, revealed: 1, steps: 0 }),
    ]
    const awards = awardsOf(events)
    expect(kinds(awards)).toEqual([
      ['part', 10],
      ['part_fixed', 5],
      ['part', 10], // the part after the revealed one is her own again
      ['finish', 20],
    ])
  })

  it('a check that grades two boxes every time pays each box once', () => {
    const t = dayAt(0)
    const I = 'Interval notation'
    const B = 'Set-builder notation'
    const events: Ev[] = [
      // Check 1: the interval right, the set-builder wrong with a named slip (wrong ones are logged first).
      final('q', t, false, { pattern: 'endpoint_type', part: B }),
      final('q', t, true, { part: I }),
      // Check 2: both right; the interval is graded (and logged) again.
      final('q', t + 1, true, { part: I }),
      final('q', t + 1, true, { part: B }),
      done('q', t + 2, { steps: 0 }),
    ]
    expect(awardsOf(events).map((a) => [a.kind, a.xp, a.part])).toEqual([
      ['part', 10, I],
      ['part_fixed', 5, B],
      ['finish', 20, undefined],
      ['no_hints', 10, undefined],
    ])
    // The two boxes disagreeing names neither: it is a named mistake on both.
    const mismatch: Ev[] = [
      final('r', t, false, { pattern: 'set_interval_mismatch' }),
      final('r', t + 1, true, { part: I }),
      final('r', t + 1, true, { part: B }),
    ]
    expect(kinds(awardsOf(mismatch))).toEqual([
      ['part_fixed', 5],
      ['part_fixed', 5],
    ])
  })

  it('a right drill answer +2, a wrong one nothing', () => {
    const t = dayAt(0)
    const events: Ev[] = [
      { t: 'drill_answer', at: t, skill: 'powers-roots', correct: true, kind: 'legal' },
      { t: 'drill_answer', at: t + 1, skill: 'powers-roots', correct: false, kind: 'property' },
      { t: 'drill_answer', at: t + 2, skill: 'powers-roots', correct: true, kind: 'property' },
    ]
    expect(kinds(awardsOf(events))).toEqual([
      ['drill', 2],
      ['drill', 2],
    ])
  })

  it('an undone line pays nothing, so undo and redo cannot farm XP', () => {
    const t = dayAt(0)
    const events: Ev[] = [
      accepted('a', 0, t),
      { t: 'step_undone', at: t + 1, attemptId: 'a', skill: S, stepIdx: 0 },
      accepted('a', 0, t + 2),
      { t: 'step_undone', at: t + 3, attemptId: 'a', skill: S, stepIdx: 0 },
      rejected('a', 0, t + 4, 'no_sign_flip'),
      accepted('a', 0, t + 5, { firstTry: false }),
    ]
    const awards = awardsOf(events)
    expect(kinds(awards)).toEqual([['line_fixed', 5]])
    expect(awards[0]!.at).toBe(t + 5)
  })

  it('a newly mastered type +100, then half XP until it is due for review two weeks after its last problem', () => {
    const events: Ev[] = []
    for (let i = 0; i < 5; i++) events.push(accepted(`m${i}`, 0, dayAt(-30 + i)), done(`m${i}`, dayAt(-30 + i, 11)))
    const first = awardsOf(events)
    expect(first.filter((a) => a.kind === 'mastered').map((a) => [a.attemptId, a.xp])).toEqual([['m4', 100]])
    expect(first.some((a) => a.half)).toBe(false)

    // Three days later: mastered and not due, so half (rounded up: a fixed line pays 3).
    events.push(
      accepted('h', 0, dayAt(-23)),
      rejected('h', 1, dayAt(-23, 10, 1), 'no_sign_flip'),
      accepted('h', 1, dayAt(-23, 10, 2), { firstTry: false }),
      done('h', dayAt(-23, 11)),
    )
    // Fifteen days after that: due for review, full XP; the day after, half again.
    events.push(accepted('f', 0, dayAt(-8)), done('f', dayAt(-8, 11)), accepted('g', 0, dayAt(-7)), done('g', dayAt(-7, 11)))
    const by = (id: string) => awardsOf(events).filter((a) => a.attemptId === id).map((a) => [a.kind, a.xp, a.half ?? false])
    expect(by('h')).toEqual([
      ['line', 5, true],
      ['line_fixed', 3, true],
      ['finish', 10, true],
      ['no_hints', 5, true],
    ])
    expect(by('f')).toEqual([
      ['line', 10, false],
      ['finish', 20, false],
      ['no_hints', 10, false],
    ])
    expect(by('g')).toEqual([
      ['line', 5, true],
      ['finish', 10, true],
      ['no_hints', 5, true],
    ])
  })

  it('+100 once per type: losing mastery and winning it back pays nothing more', () => {
    const events: Ev[] = []
    for (let i = 0; i < 5; i++) events.push(done(`m${i}`, dayAt(-20 + i)))
    events.push(done('slip', dayAt(-14), { revealed: 1 }))
    for (let i = 0; i < 5; i++) events.push(done(`n${i}`, dayAt(-13 + i)))
    expect(awardsOf(events).filter((a) => a.kind === 'mastered')).toHaveLength(1)
    // A type the slice already lists as mastered (before the compaction) pays nothing either.
    const fresh: Ev[] = []
    for (let i = 0; i < 5; i++) fresh.push(done(`k${i}`, dayAt(-5 + i)))
    expect(awardsOf(fresh, { ...emptyRewards(), mastered: { [S]: dayAt(-90) } }).filter((a) => a.kind === 'mastered')).toHaveLength(0)
  })
})

describe('the mistake collection', () => {
  it('a named mistake is caught; three later finished problems of its type without it squash it (+50 once)', () => {
    const P = 'no_sign_flip'
    const t = (n: number) => dayAt(-20 + n)
    const events: Ev[] = [
      rejected('a1', 0, t(0), P),
      accepted('a1', 0, t(0) + 1, { firstTry: false }),
      done('a1', t(0) + 2, { firstTryRate: 0 }), // its own attempt never counts
      done('a2', t(1), { firstTryRate: 0.5 }), // 1 of 3
      rejected('a3', 0, t(2), 'flip_on_add'), // a different mistake: still clean for P
      done('a3', t(2) + 1, { firstTryRate: 0.5 }), // 2 of 3
      done('other', t(2) + 2, { skill: 'ineq.compound' }), // another type does not count
    ]
    let view = computeRewards(events, emptyRewards(), 60, NOW)
    const card = () => view.cards.find((c) => c.pattern === P)!
    expect(card()).toMatchObject({ skill: S, count: 1, clean: 2, squashed: false })
    expect(view.cards.find((c) => c.pattern === 'flip_on_add')).toMatchObject({ clean: 0, squashed: false })

    // She makes it again: back to 0 of 3, twice now.
    events.push(rejected('a4', 0, t(3), P), done('a4', t(3) + 1, { firstTryRate: 0.5 }))
    view = computeRewards(events, emptyRewards(), 60, NOW)
    expect(card()).toMatchObject({ count: 2, clean: 0, squashed: false })

    events.push(done('a5', t(4), { firstTryRate: 0.5 }), done('a6', t(5), { firstTryRate: 0.5 }), done('a7', t(6), { firstTryRate: 0.5 }))
    view = computeRewards(events, emptyRewards(), 60, NOW)
    expect(card()).toMatchObject({ count: 2, clean: 3, squashed: true, squashedAt: t(6) })
    const squashes = () => view.awards.filter((a) => a.kind === 'squash' && a.pattern === P)
    expect(squashes().map((a) => [a.attemptId, a.xp])).toEqual([['a7', 50]])

    // Made again after it was squashed: open again; squashing it again pays nothing.
    events.push(rejected('a8', 0, t(7), P), done('a8', t(7) + 1, { firstTryRate: 0.5 }))
    view = computeRewards(events, emptyRewards(), 60, NOW)
    expect(card()).toMatchObject({ count: 3, clean: 0, squashed: false })
    events.push(done('a9', t(8), { firstTryRate: 0.5 }), done('a10', t(9), { firstTryRate: 0.5 }), done('a11', t(10), { firstTryRate: 0.5 }))
    view = computeRewards(events, emptyRewards(), 60, NOW)
    expect(card()).toMatchObject({ squashed: true, squashedAt: t(6) })
    expect(squashes()).toHaveLength(1)
  })

  it('a wrong part with a named mistake makes a card too; her top three open cards come closest-to-squashed first', () => {
    const events: Ev[] = [
      final('a', dayAt(-5), false, { pattern: 'geo_isosceles_base', skill: 'geo.iso' }),
      rejected('b', 0, dayAt(-4), 'no_sign_flip'),
      rejected('c', 0, dayAt(-3), 'flip_on_add'),
      rejected('d', 0, dayAt(-2), 'dropped_union', 'ineq.any'),
      done('e', dayAt(-1), { firstTryRate: 0.5 }), // one clean finish of ineq.linear for its two cards
    ]
    const view = computeRewards(events, emptyRewards(), 60, NOW)
    expect(view.cards).toHaveLength(4)
    expect(openCards(view.cards).map((c) => [c.pattern, c.clean])).toEqual([
      ['flip_on_add', 1],
      ['no_sign_flip', 1],
      ['dropped_union', 0],
    ])
  })
})

describe('the daily goal and the streak', () => {
  it('today’s XP against a goal of 30, 60 or 100', () => {
    const events = work(dayAt(0), 2) // 60 XP
    expect(computeRewards(events, emptyRewards(), 30, NOW).today).toMatchObject({ xp: 60, target: 30, met: true, doubleMet: true })
    expect(computeRewards(events, emptyRewards(), 60, NOW).today).toMatchObject({ xp: 60, target: 60, met: true, doubleMet: false })
    expect(computeRewards(events, emptyRewards(), 100, NOW).today).toMatchObject({ xp: 60, target: 100, met: false })
    expect(dailyGoalOf({})).toBe(60)
  })

  it('a missed day takes a rest day; a missed day with none left is mended by a double goal the next day, across a week boundary', () => {
    const events = [
      ...work(dayAt(-9), 2), // Mon Sep 7: met (first day: one rest day banked)
      ...work(dayAt(-8), 2), // Tue: met
      // Wed Sep 9: missed → the rest day
      ...work(dayAt(-6), 2), // Thu: met
      ...work(dayAt(-5), 2), // Fri: met
      // Sat Sep 12: missed, no rest day left → waits for a double goal
      ...work(dayAt(-3), 4), // Sun Sep 13: double goal → Saturday mended
      ...work(dayAt(-2), 2), // Mon Sep 14: a new week, one rest day banked; met
      // Tue Sep 15: missed → the rest day
      ...work(dayAt(0), 2), // Wed Sep 16 (today): met
    ]
    const { streak, today } = computeRewards(events, emptyRewards(), 60, NOW)
    expect(streak.days).toBe(7) // Sep 7, 8, 10, 11, 13, 14, 16
    expect(streak.restDays).toBe(0)
    expect(streak.repairToday).toBe(false)
    expect(today.met).toBe(true)
    expect(streak.weekMet).toBe(2)
    expect(streak.week.map((d) => d.state)).toEqual(['met', 'rest', 'met', 'future', 'future', 'future', 'future'])
    const lastWeek = computeRewards(events, emptyRewards(), 60, dayAt(-3, 20)).streak
    expect(lastWeek.week.map((d) => d.state)).toEqual(['met', 'met', 'rest', 'met', 'met', 'repaired', 'met'])
    expect(lastWeek.weekMet).toBe(5) // "5 of 7 this week"
  })

  it('a missed day not mended (only the goal, not twice it) ends the streak; the next day starts a new one', () => {
    const events = [
      ...work(dayAt(-6), 2), // Thu Sep 10: met (rest day banked)
      // Fri: missed → rest day
      ...work(dayAt(-4), 2), // Sat: met
      // Sun Sep 13: missed, nothing left
      ...work(dayAt(-2), 2), // Mon Sep 14: the goal but not twice it → the old streak ends; a new one starts
      ...work(dayAt(-1), 2), // Tue: met
    ]
    const { streak } = computeRewards(events, emptyRewards(), 60, NOW)
    expect(streak.days).toBe(2)
    expect(streak.restDays).toBe(1) // Monday banked one for the new week
    expect(streak.repairToday).toBe(false)
  })

  it('yesterday missed with no rest day: today’s ring counts to twice the goal; reaching it keeps the streak', () => {
    const events = [
      ...work(dayAt(-6), 2), // Thu Sep 10: met (first day: one rest day banked)
      // Fri: missed → the rest day
      ...work(dayAt(-4), 2), // Sat: met
      // Sun Sep 13: missed, nothing left → waits
      ...work(dayAt(-2), 4), // Mon Sep 14: a rest day banked for the new week; twice the goal mends Sunday
      // Tue Sep 15: missed → Monday's rest day
    ]
    let view = computeRewards(events, emptyRewards(), 60, NOW)
    // Today (Wed) has nothing yet, and nothing is missed until it is over.
    expect(view.streak).toMatchObject({ days: 3, restDays: 0, repairToday: false })
    expect(view.today).toMatchObject({ xp: 0, target: 60, met: false })

    // Thursday, with Wednesday missed and no rest day left: the ring counts to 120.
    const thursday = dayAt(1, 9)
    view = computeRewards(events, emptyRewards(), 60, thursday)
    expect(view.streak).toMatchObject({ days: 3, repairToday: true })
    expect(view.today).toMatchObject({ xp: 0, target: 120 })
    // The goal alone keeps nothing yet...
    view = computeRewards([...events, ...work(dayAt(1, 8), 2)], emptyRewards(), 60, thursday)
    expect(view.streak).toMatchObject({ days: 3, repairToday: true })
    expect(view.today).toMatchObject({ xp: 60, target: 120, met: true, doubleMet: false })
    // ...twice the goal mends Wednesday and counts Thursday.
    view = computeRewards([...events, ...work(dayAt(1, 8), 4)], emptyRewards(), 60, thursday)
    expect(view.streak).toMatchObject({ days: 4, repairToday: false, repairedToday: true })
    expect(view.today).toMatchObject({ xp: 120, target: 60, met: true, doubleMet: true })
    expect(view.streak.week.map((d) => d.state)).toEqual(['met', 'rest', 'repaired', 'met', 'future', 'future', 'future'])
  })

  it('rest days: one more each week, never more than two saved', () => {
    const events: Ev[] = []
    for (let d = -16; d <= -2; d++) events.push(...work(dayAt(d), 2)) // Mon Aug 31 to Mon Sep 14, every day
    // Banked on Aug 31, Sep 7 and Sep 14: capped at 2. Tue Sep 15 missed → one used.
    const { streak } = computeRewards(events, emptyRewards(), 60, NOW)
    expect(streak).toMatchObject({ days: 15, restDays: 1, repairToday: false })
  })

  it('raising the goal does not undo a day that met the old one; today follows the new goal', () => {
    const events = [...work(dayAt(-2), 1), ...work(dayAt(-1), 1), ...work(dayAt(0), 1)] // 30 XP a day
    const settled = settleDays(emptyRewards(), events, 30, NOW)
    expect(settled.settledThrough).toBe(dayKey(dayAt(-1)))
    expect(settled.days).toEqual({ [dayKey(dayAt(-2))]: 1, [dayKey(dayAt(-1))]: 1, [dayKey(dayAt(0))]: 1 })
    const view = computeRewards(events, settled, 100, NOW)
    expect(view.streak.days).toBe(3) // today's 30 XP met the old goal before it changed: kept as a floor
    expect(view.today).toMatchObject({ xp: 30, target: 100, met: true })
    // Without the settle, the new goal reads every day again.
    expect(computeRewards(events, emptyRewards(), 100, NOW).streak.days).toBe(0)
  })

  it('a long streak, its rest days and a mended day survive the 60-day compaction', () => {
    // From Friday Jul 3 to today, every day met but three, all over 60 days ago: Jul 8 and 9 take the two rest days,
    // Jul 10 waits, and twice the goal on Jul 11 mends it.
    const events: Ev[] = []
    for (let d = -75; d <= 0; d++) {
      if (d >= -70 && d <= -68) continue
      events.push(...work(dayAt(d), d === -67 ? 4 : 2))
    }
    const before = computeRewards(events, emptyRewards(), 60, NOW)
    expect(before.streak).toMatchObject({ days: 73, restDays: 2, repairToday: false })

    // What the store's compactNow does: settle the days, fold the old events, then delete them.
    let rewards = settleDays(emptyRewards(), events, 60, NOW)
    rewards = foldRewards(rewards, events, NOW - SIXTY_DAYS_MS)
    const compacted = compact(events, {}, NOW)
    expect(compacted.folded).toBeGreaterThan(0)
    expect(compacted.events.length).toBeLessThan(events.length)

    const after = computeRewards(compacted.events, rewards, 60, NOW)
    expect(after.streak).toEqual(before.streak)
    expect(after.today).toEqual(before.today)
    // The compacted log alone would have forgotten the first two weeks.
    expect(computeRewards(compacted.events, emptyRewards(), 60, NOW).streak.days).toBeLessThan(before.streak.days)
  })
})

describe('the compaction keeps the cards and the first masteries', () => {
  it('a card keeps its count and its progress; the kept old finishes do not count twice', () => {
    const P = 'no_sign_flip'
    const events: Ev[] = [
      rejected('a1', 0, dayAt(-70), P),
      done('a1', dayAt(-70, 11), { firstTryRate: 0.5 }),
      rejected('a2', 0, dayAt(-69), P),
      done('a2', dayAt(-69, 11), { firstTryRate: 0.5 }),
      done('a3', dayAt(-68), { firstTryRate: 0.5 }), // 1 of 3
      done('a4', dayAt(-67), { firstTryRate: 0.5 }), // 2 of 3
    ]
    let rewards = settleDays(emptyRewards(), events, 60, NOW)
    rewards = foldRewards(rewards, events, NOW - SIXTY_DAYS_MS)
    const compacted = compact(events, {}, NOW)
    // The rejections are gone; the four finishes stay (the last five per type are always kept).
    expect(compacted.events.map((e) => e.t)).toEqual(['problem_done', 'problem_done', 'problem_done', 'problem_done'])
    let view = computeRewards(compacted.events, rewards, 60, NOW)
    expect(view.cards).toMatchObject([{ pattern: P, count: 2, clean: 2, squashed: false }])
    expect(view.awards).toEqual([]) // the folded part pays nothing again

    const later = [...compacted.events, done('a5', dayAt(0), { firstTryRate: 0.5 })]
    view = computeRewards(later, rewards, 60, NOW)
    expect(view.cards).toMatchObject([{ pattern: P, count: 2, clean: 3, squashed: true }])
    expect(view.awards.filter((a) => a.kind === 'squash').map((a) => a.xp)).toEqual([50])
  })

  it('a type mastered before the compaction, lost, and won back after it pays the +100 only once', () => {
    const events: Ev[] = []
    for (let i = 0; i < 5; i++) events.push(done(`m${i}`, dayAt(-80 + i)))
    events.push(done('slip', dayAt(-75), { revealed: 1 }))
    let rewards = settleDays(emptyRewards(), events, 60, NOW)
    rewards = foldRewards(rewards, events, NOW - SIXTY_DAYS_MS)
    expect(Object.keys(rewards.mastered)).toEqual([S])
    const compacted = compact(events, {}, NOW)
    const back = [...compacted.events]
    for (let i = 0; i < 5; i++) back.push(done(`n${i}`, dayAt(-4 + i)))
    expect(computeRewards(back, rewards, 60, NOW).awards.filter((a) => a.kind === 'mastered')).toEqual([])
    // Without the slice the compacted log would pay it again.
    expect(computeRewards(back, emptyRewards(), 60, NOW).awards.filter((a) => a.kind === 'mastered')).toHaveLength(1)
  })
})

describe('merging and reading the slice', () => {
  it('merge: a day met on either device counts; settling and folding go back to the earlier mark; cards keep the later state', () => {
    const a: RewardsState = {
      days: { '2026-09-10': 1, '2026-09-11': 1 },
      settledThrough: '2026-09-15',
      foldedThrough: 2000,
      cards: { 'p|s': { pattern: 'p', skill: 's', count: 2, firstAt: 10, lastAt: 50, lastAttempt: 'x', clean: 1 } },
      mastered: { s: 500 },
    }
    const b: RewardsState = {
      days: { '2026-09-11': 2, '2026-09-12': 1 },
      settledThrough: '2026-09-12',
      foldedThrough: 1000,
      cards: {
        'p|s': { pattern: 'p', skill: 's', count: 3, firstAt: 5, lastAt: 40, lastAttempt: 'y', clean: 3, squashedAt: 45 },
        'q|s': { pattern: 'q', skill: 's', count: 1, firstAt: 7, lastAt: 7, lastAttempt: 'z', clean: 0 },
      },
      mastered: { s: 400, t: 900 },
    }
    const m = mergeRewards(a, b)
    expect(m.days).toEqual({ '2026-09-10': 1, '2026-09-11': 2, '2026-09-12': 1 })
    expect(m.settledThrough).toBe('2026-09-12')
    expect(m.foldedThrough).toBe(1000)
    expect(m.cards['p|s']).toEqual({ pattern: 'p', skill: 's', count: 3, firstAt: 5, lastAt: 50, lastAttempt: 'x', clean: 1, squashedAt: 45 })
    expect(m.cards['q|s']).toMatchObject({ count: 1 })
    expect(m.mastered).toEqual({ s: 400, t: 900 })
    expect(mergeRewards(a, emptyRewards()).settledThrough).toBe('')
  })

  it('normalize drops anything unreadable; an old backup has no slice at all', () => {
    expect(normalizeRewards(undefined)).toEqual(emptyRewards())
    const raw = {
      days: { '2026-09-10': 1, '2026-09-11': 3, nope: 1 },
      settledThrough: 'yesterday',
      foldedThrough: -5,
      cards: { x: { pattern: 'p', skill: 's', count: 2, firstAt: 1, lastAt: 2, lastAttempt: 'a', clean: 9 }, y: { pattern: 7 } },
      mastered: { s: 5, t: 'soon' },
    }
    expect(normalizeRewards(raw)).toEqual({
      days: { '2026-09-10': 1 },
      settledThrough: '',
      foldedThrough: 0,
      cards: { 'p|s': { pattern: 'p', skill: 's', count: 2, firstAt: 1, lastAt: 2, lastAttempt: 'a', clean: 3 } },
      mastered: { s: 5 },
    })
  })

  it('the switches: rewards follow the edition until she sets them; vibrate is on unless switched off', () => {
    expect(rewardsOn({}, true)).toBe(true)
    expect(rewardsOn({}, false)).toBe(false)
    expect(rewardsOn({ rewards: false }, true)).toBe(false)
    expect(rewardsOn({ rewards: true }, false)).toBe(true)
    expect(vibrateOn({})).toBe(true)
    expect(vibrateOn({ vibrate: false })).toBe(false)
  })
})

describe('the problem-type rings', () => {
  it('New, Practiced, Solid and Mastered from the last five finished problems', () => {
    expect(skillRing([], S)).toEqual({ level: 'new', fill: 0, strong: 0, count: 0 })
    const events: Ev[] = [done('a', dayAt(-9), { firstTryRate: 0.5 }), done('b', dayAt(-8))]
    expect(skillRing(events, S)).toMatchObject({ level: 'practiced', strong: 1, fill: 0.2 })
    events.push(done('c', dayAt(-7)), done('d', dayAt(-6), { mode: 'timed' }), done('e', dayAt(-5)))
    expect(skillRing(events, S)).toMatchObject({ level: 'solid', strong: 3, count: 4, fill: 0.6 })
    events.push(done('f', dayAt(-4)), done('g', dayAt(-3)))
    // The last five: b, c, e, f, g (the timed one never counts): all went well → mastered.
    expect(skillRing(events, S)).toMatchObject({ level: 'mastered', fill: 1, strong: 5 })
    events.push(done('h', dayAt(-2), { finalCorrect: false }))
    expect(skillRing(events, S)).toMatchObject({ level: 'solid', strong: 4, fill: 0.8 })
  })
})

describe('a finished problem', () => {
  it('what it earned, the goal it met, what it squashed, and a comeback after three days away', () => {
    const events: Ev[] = [
      ...work(dayAt(-5), 1), // last seen Friday Sep 11; away Sat, Sun, Mon, Tue (4 days)
      rejected('x', 0, dayAt(-5, 11), 'no_sign_flip'),
      done('x', dayAt(-5, 12), { firstTryRate: 0.5, hints: 1 }),
      done('y1', dayAt(-5, 13), { firstTryRate: 0.5, hints: 1 }),
      done('y2', dayAt(-5, 14), { firstTryRate: 0.5, hints: 1 }),
      ...work(dayAt(0, 9), 1), // 30 XP this morning
      rejected('z', 0, dayAt(0, 17), 'flip_on_add'),
      accepted('z', 0, dayAt(0, 17, 1), { firstTry: false }),
      accepted('z', 1, dayAt(0, 17, 2)),
      done('z', dayAt(0, 17, 3)), // squashes no_sign_flip (y1, y2, z)
    ]
    const view = computeRewards(events, emptyRewards(), 60, NOW)
    const info = finishInfo(view, events, emptyRewards(), 'z')
    expect(info.awards.map((a) => [a.kind, a.xp])).toEqual([
      ['line_fixed', 5],
      ['line', 10],
      ['finish', 20],
      ['no_hints', 10],
      ['squash', 50],
    ])
    expect(info).toMatchObject({ total: 95, goalMet: true, mastered: false, squashed: ['no_sign_flip'], half: false })
    // The morning's warm-up was a timed problem, so this is not her first finish today: no comeback.
    expect(info.comeback).toBe(false)
    const noWarmup = events.filter((e) => !(e.t === 'problem_done' && e.mode === 'timed' && dayKey(e.at) === dayKey(NOW)))
    const v2 = computeRewards(noWarmup, emptyRewards(), 60, NOW)
    expect(finishInfo(v2, noWarmup, emptyRewards(), 'z')).toMatchObject({ comeback: true, goalMet: true })
    // Two days away (Mon, Tue) is not a comeback.
    const shifted = noWarmup.map((e) => (dayKey(e.at) === dayKey(dayAt(-5)) ? { ...e, at: e.at + 2 * 86_400_000 } : e))
    const v3 = computeRewards(shifted, emptyRewards(), 60, NOW)
    expect(finishInfo(v3, shifted, emptyRewards(), 'z').comeback).toBe(false)
  })
})

describe('Guided mode: lines picked from cards', () => {
  /** A line kept after its cards were shown. */
  const picked = (attemptId: string, stepIdx: number, at: number, opts: { firstTry?: boolean; revealed?: boolean } = {}): Ev => ({
    ...(accepted(attemptId, stepIdx, at, opts) as Extract<Ev, { t: 'step_accepted' }>),
    via: 'card',
  })
  /** A wrong card picked: its named mistake. */
  const wrongPick = (attemptId: string, stepIdx: number, at: number, pattern: string): Ev => ({
    ...(rejected(attemptId, stepIdx, at, pattern) as Extract<Ev, { t: 'step_rejected' }>),
    via: 'card',
  })

  it('a line picked right on the first pick +4 instead of +10; picked after a wrong pick 0; typed lines and the finish as before', () => {
    const t = dayAt(0)
    const events: Ev[] = [
      picked('g', 0, t),
      wrongPick('g', 1, t + 1, 'log_one_side'),
      picked('g', 1, t + 2, { firstTry: false }),
      accepted('g', 2, t + 3),
      // A typed mistake, then the cards: the first card she picked was the right one.
      rejected('g', 3, t + 4, 'log_sum_split'),
      picked('g', 3, t + 5, { firstTry: false }),
      // Typed after a wrong pick: a typed line fixed after a named mistake, as before.
      wrongPick('g', 4, t + 6, 'log_power_as_power'),
      accepted('g', 4, t + 7, { firstTry: false }),
      done('g', t + 8, { steps: 5, picked: 3 }),
    ]
    expect(kinds(awardsOf(events))).toEqual([
      ['line_picked', 4],
      ['line', 10],
      ['line_picked', 4],
      ['line_fixed', 5],
      ['finish', 20],
      ['no_hints', 10],
    ])
    // The wrong picks are named mistakes: they make mistake cards like typed ones.
    const cards = computeRewards(events, emptyRewards(), 60, NOW).cards.map((c) => [c.pattern, c.count])
    expect(cards).toEqual(expect.arrayContaining([['log_one_side', 1], ['log_sum_split', 1], ['log_power_as_power', 1]]))
  })

  it('a picked line that was shown by the hint, or undone, pays nothing; one of a mastered type pays half (+2)', () => {
    const t = dayAt(0)
    expect(
      kinds(
        awardsOf([
          hint('r', 0, t, 3),
          picked('r', 0, t + 1, { firstTry: false, revealed: true }),
          picked('u', 0, t + 2),
          { t: 'step_undone', at: t + 3, attemptId: 'u', skill: S, stepIdx: 0 },
        ]),
      ),
    ).toEqual([])
    const events: Ev[] = []
    for (let i = 0; i < 5; i++) events.push(accepted(`m${i}`, 0, dayAt(-10 + i)), done(`m${i}`, dayAt(-10 + i, 11)))
    events.push(picked('p', 0, dayAt(-2)))
    expect(awardsOf(events).filter((a) => a.attemptId === 'p').map((a) => [a.kind, a.xp, a.half])).toEqual([['line_picked', 2, true]])
  })

  it('a problem with a picked line stays out of the mastery window and the rings, as a timed one does; its XP and squashes count', () => {
    const normal = (id: string, day: number): Ev[] => [accepted(id, 0, dayAt(day)), done(id, dayAt(day, 11))]
    const events: Ev[] = [
      rejected('x', 0, dayAt(-9), 'no_sign_flip'),
      accepted('x', 0, dayAt(-9, 10, 1), { firstTry: false }),
      done('x', dayAt(-9, 11)),
      ...normal('n0', -8),
      picked('p', 0, dayAt(-7)),
      done('p', dayAt(-7, 11), { steps: 1, picked: 1 }),
      ...normal('n1', -6),
      ...normal('n2', -5),
    ]
    // Four normal problems and a picked one: not mastered, and the ring counts four.
    expect(skillRing(events, S)).toMatchObject({ level: 'solid', count: 4, strong: 4 })
    let awards = awardsOf(events)
    expect(awards.filter((a) => a.kind === 'mastered')).toEqual([])
    expect(awards.filter((a) => a.attemptId === 'p').map((a) => [a.kind, a.xp])).toEqual([
      ['line_picked', 4],
      ['finish', 20],
      ['no_hints', 10],
    ])
    // The picked problem is one of the three clean finishes (n0, p, n1) that squash the mistake.
    expect(awards.filter((a) => a.kind === 'squash').map((a) => a.attemptId)).toEqual(['n1'])
    // A fifth normal problem masters the type: the window skipped the picked one.
    events.push(...normal('n3', -1))
    awards = awardsOf(events)
    expect(awards.filter((a) => a.kind === 'mastered').map((a) => a.attemptId)).toEqual(['n3'])
    expect(skillRing(events, S)).toMatchObject({ level: 'mastered', count: 5 })
    // The finish sheet knows a problem was picked (its ring did not move).
    const view = computeRewards(events, emptyRewards(), 60, NOW)
    expect(finishInfo(view, events, emptyRewards(), 'p').picked).toBe(true)
    expect(finishInfo(view, events, emptyRewards(), 'n3').picked).toBe(false)
  })
})
