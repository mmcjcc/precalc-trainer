/**
 * Daily quests (docs/progress/phone-quests.md): three small goals a day, built on what the checker sees, and a chest
 * when all three are done (store/chest.ts). Pure: the same log, rewards slice, goal and day give the same quests and the
 * same progress, so they survive a reload, a backup and an import.
 *
 * WHICH QUESTS. Each local day picks three from the pool below, by a seeded draw from the day itself, among the ones she
 * can do that day judged by her state when the day began (the log before its midnight): her class (the class of her
 * latest problem before the day, else the class chosen on Home), her open mistake cards, her rings, her path. What she
 * does during the day never changes the day's quests. No two come from the same group (two set quests, or two "focus"
 * quests, on one day would ask the same thing twice). The sizes follow her daily goal (30, 60 or 100 XP).
 *
 * | Quest                                              | Group  | Offered when                                     |
 * |----------------------------------------------------|--------|--------------------------------------------------|
 * | Earn N XP (N = the goal)                           | volume | always                                           |
 * | Finish N problems (2, 3, 4)                        | volume | always                                           |
 * | Get N lines or parts right first try (5, 8, 12)    | skill  | always                                           |
 * | Finish a set with no hints                         | set    | her class has problem types                      |
 * | A perfect set (every problem right first time)     | set    | ... and the goal is 60 or 100                    |
 * | Squash a monster                                   | focus  | an open mistake card she can practise (goal 30:  |
 * |                                                    |        | one that is at most 2 clean problems away)       |
 * | Finish N problems in types you have not mastered   | focus  | her class has a type she has not mastered (1,1,2) |
 * | Practice the next stop on your path                | focus  | her path has a "You are here" stop               |
 * | Check a problem from your homework                 | own    | one school day a week (Mon to Thu, fixed by the  |
 * |                                                    |        | week), when her class has "Check my own problem" |
 *
 * WHAT COUNTS (progress is read from the log of that day; nothing is stored):
 * - XP: the day's XP from her work (`RewardsView.awards`), not a chest's bonus;
 * - lines or parts right first try: the rewards' own awards (a line or part right on the first try, a card picked
 *   right on the first pick); an undone line paid nothing and counts nothing;
 * - problems: every finished problem (`problem_done`), her own included;
 * - a set: a `set_done` with nothing skipped: no hint in any of its problems, or every problem "Right first time" (the
 *   set results' own rule, `isFirstTryRight`);
 * - a squash: the rewards' squash awards (her own problem never squashes);
 * - not mastered / the path: a finished generated problem (never her own: they never count for mastery or the path) of
 *   a type not mastered when the day began / of the stop's type;
 * - her homework: a finished problem of her own ("Check my own problem").
 * Her own problems count where their XP counts: XP, lines and parts, problems; never a squash, mastery or path quest.
 * Nothing here ever asks for a mistake, a timed problem or anything paid.
 */
import { COURSES, allTemplates, mulberry32, unitsWithModules, type CourseDef } from '@/content'
import { OWN_MODULES } from '@/content/own'
import { includesSubject } from '@/edition'
import { isFirstTryRight, slotEvents } from '@/pages/review/session'
import { chestOpenings, hashString } from '@/store/chest'
import { addDays, computeRewards, skillRings, SQUASH_AFTER, type XpAward } from '@/store/rewards'
import { dayKey, isoWeekKey } from '@/store/time'
import type { DailyGoal, Ev, RewardsState } from '@/store/types'
import { classTypes, pickSetTypes } from './buildSet'

export type QuestKind = 'xp' | 'problems' | 'firstTry' | 'noHintSet' | 'perfectSet' | 'squash' | 'unmastered' | 'pathStop' | 'own'

type QuestGroup = 'volume' | 'skill' | 'set' | 'focus' | 'own'

/** One of the day's quests: what it asks and how many. */
export interface QuestSpec {
  kind: QuestKind
  /** How many it asks for. */
  target: number
  /** The path quest: the stop's problem type (template id). */
  skill?: string
}

/** A quest with the day's progress. */
export interface Quest extends QuestSpec {
  /** Progress so far, never past the target. */
  count: number
  done: boolean
}

export interface QuestDay {
  /** 'YYYY-MM-DD' (local). */
  day: string
  /** Three quests, in a fixed order of kinds. */
  quests: Quest[]
  /** How many are done (0 to 3). */
  done: number
  /** All three: the day's chest. */
  allDone: boolean
}

/** What the quests are read from. */
export interface QuestInput {
  events: readonly Ev[]
  /** The rewards slice (mistake cards and masteries folded from compacted events count too). */
  rewards: RewardsState
  /** Every XP award of the log (`RewardsView.awards`). */
  awards: readonly XpAward[]
  goal: DailyGoal
  /** Home's class (Settings): where a student with no problem before the day starts. */
  courseId?: string
  /** Home's unit in each class (Settings): where her path starts when she has no problem in the class. */
  unitByCourse?: Record<string, string>
}

export const QUESTS_PER_DAY = 3

const POOL: readonly { kind: QuestKind; group: QuestGroup; weight: number }[] = [
  { kind: 'xp', group: 'volume', weight: 2 },
  { kind: 'problems', group: 'volume', weight: 2 },
  { kind: 'firstTry', group: 'skill', weight: 3 },
  { kind: 'noHintSet', group: 'set', weight: 2 },
  { kind: 'perfectSet', group: 'set', weight: 1 },
  { kind: 'squash', group: 'focus', weight: 3 },
  { kind: 'unmastered', group: 'focus', weight: 2 },
  { kind: 'pathStop', group: 'focus', weight: 2 },
]

/** The order the day's three are shown in. */
const KIND_ORDER: readonly QuestKind[] = ['own', 'xp', 'problems', 'firstTry', 'noHintSet', 'perfectSet', 'squash', 'unmastered', 'pathStop']

/** Sizes by daily goal (30, 60, 100 XP: about 1, 1 or 2, 2 or 3 problems). */
const SIZES: Readonly<Record<'problems' | 'firstTry' | 'unmastered', Readonly<Record<DailyGoal, number>>>> = {
  problems: { 30: 2, 60: 3, 100: 4 },
  firstTry: { 30: 5, 60: 8, 100: 12 },
  unmastered: { 30: 1, 60: 1, 100: 2 },
}

/** The size of a quest of this kind under this goal. */
export function questTarget(kind: QuestKind, goal: DailyGoal): number {
  if (kind === 'xp') return goal
  if (kind === 'problems' || kind === 'firstTry' || kind === 'unmastered') return SIZES[kind][goal]
  return 1
}

// ---------------------------------------------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------------------------------------------

/** Local midnight at the start of a day ('YYYY-MM-DD'). */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1).getTime()
}

/** Monday 0 ... Sunday 6. */
function weekdayOf(day: string): number {
  return (new Date(dayStart(day)).getDay() + 6) % 7
}

/** The school day (Monday 0 to Thursday 3) of this day's week on which "Check a problem from your homework" comes. */
export function ownQuestWeekday(day: string): number {
  return hashString(`own|${isoWeekKey(dayStart(day))}`) % 4
}

// ---------------------------------------------------------------------------------------------------------------
// Her class and what she can practise
// ---------------------------------------------------------------------------------------------------------------

let practicable: { size: number; skills: Set<string> } | null = null

/** A registered problem type of a module this app includes (the store app leaves chemistry out). */
export function canPractise(skill: string): boolean {
  const n = allTemplates().length
  if (!practicable || practicable.size !== n) {
    const skills = new Set<string>()
    for (const { module, template } of allTemplates()) if (includesSubject(module.subject)) skills.add(template.id)
    practicable = { size: n, skills }
  }
  return practicable.skills.has(skill)
}

function questCourses(): CourseDef[] {
  return COURSES.filter((c) => classTypes(c).some((t) => canPractise(t.templateId)))
}

/** Her class for the day: the class of her latest problem before it, else the one chosen on Home, else the first. */
export function questCourse(before: readonly Ev[], courseId?: string): CourseDef | null {
  const courses = questCourses()
  // A class whose units have no modules of their own (SAT Math Prep) shares problem types with other math classes:
  // when she has it selected on Home, keep that selection rather than attributing shared types back to Precalculus/Geometry.
  const selected = courseId ? courses.find((c) => c.id === courseId) : undefined
  if (selected && unitsWithModules(selected).length === 0) return selected

  const ofSkill = new Map<string, string>()
  for (const c of courses) {
    if (unitsWithModules(c).length === 0) continue
    for (const t of classTypes(c)) if (!ofSkill.has(t.templateId)) ofSkill.set(t.templateId, c.id)
  }
  for (let i = before.length - 1; i >= 0; i--) {
    const e = before[i]!
    if (!('attemptId' in e)) continue
    const id = ofSkill.get(e.skill)
    if (id) return courses.find((c) => c.id === id) ?? null
  }
  return selected ?? courses[0] ?? null
}

/** The unit Home shows for a class with nothing chosen: its last unit with problems (Home's own default). */
function homeUnit(course: CourseDef, unitByCourse?: Record<string, string>): string | null {
  const saved = unitByCourse?.[course.id]
  if (saved && course.units.some((u) => u.id === saved)) return saved
  const ready = unitsWithModules(course)
  return ready[ready.length - 1]?.id ?? course.units[0]?.id ?? null
}

// ---------------------------------------------------------------------------------------------------------------
// The day's pick
// ---------------------------------------------------------------------------------------------------------------

interface QuestPlan {
  day: string
  specs: QuestSpec[]
  /** Types mastered when the day began. */
  mastered: ReadonlySet<string>
}

interface PlanCacheEntry {
  key: string
  prefixLength: number
  prefixLast: Ev | undefined
  cards: RewardsState['cards']
  mastered: RewardsState['mastered']
  plan: QuestPlan
}

/** The last few plans (today's, yesterday's, the same day's "before" for a finish): the pick reads the whole log. */
const planCache: PlanCacheEntry[] = []
const PLAN_CACHE_SIZE = 6

/** Forget the cached picks (tests that mock the edition or the clock). */
export function resetQuestCacheForTests(): void {
  planCache.length = 0
  practicable = null
}

function eligibleKinds(day: string, before: readonly Ev[], input: QuestInput): { kinds: Set<QuestKind>; skill: string | null; mastered: Set<string>; own: boolean } {
  const start = dayStart(day)
  const kinds = new Set<QuestKind>(['xp', 'problems', 'firstTry'])
  const course = questCourse(before, input.courseId)
  // Her own problems never count for mastery (`inMasteryWindow`): the rings leave them out already.
  const rings = skillRings(before)
  const mastered = new Set<string>()
  for (const [skill, ring] of rings) if (ring.level === 'mastered') mastered.add(skill)
  let skill: string | null = null
  let own = false
  if (course) {
    const types = classTypes(course).filter((t) => canPractise(t.templateId))
    if (types.length > 0) {
      kinds.add('noHintSet')
      if (input.goal >= 60) kinds.add('perfectSet')
    }
    if (types.some((t) => !mastered.has(t.templateId))) kinds.add('unmastered')
    // The path's "You are here" when the day began: only offered when the class has a unit path of its own.
    if (unitsWithModules(course).length > 0) {
      const first = pickSetTypes({ types, events: before, rewards: input.rewards, now: start, startUnit: homeUnit(course, input.unitByCourse) }).types[0]
      if (first) {
        skill = first.templateId
        kinds.add('pathStop')
      }
    }
    // Her homework, one school day a week, where her class takes her own problem.
    const modules = new Set(types.map((t) => t.moduleId))
    own = weekdayOf(day) === ownQuestWeekday(day) && OWN_MODULES.some((m) => modules.has(m))
  }
  // A monster to squash: an open card when the day began, of a type she can practise. A goal of 30 (about one problem)
  // only asks it of a card at most two clean problems from squashed.
  const cards = computeRewards(before, input.rewards, input.goal, start).cards.filter((c) => !c.squashed)
  if (cards.some((c) => canPractise(c.skill) && (input.goal > 30 || SQUASH_AFTER - c.clean <= 2))) kinds.add('squash')
  return { kinds, skill, mastered, own }
}

function drawPlan(day: string, before: readonly Ev[], input: QuestInput): QuestPlan {
  const { kinds, skill, mastered, own } = eligibleKinds(day, before, input)
  const rnd = mulberry32(hashString(`quests|${day}`))
  const picked: { kind: QuestKind; group: QuestGroup }[] = []
  if (own) picked.push({ kind: 'own', group: 'own' })
  let pool = POOL.filter((p) => kinds.has(p.kind))
  while (picked.length < QUESTS_PER_DAY && pool.length > 0) {
    const used = new Set(picked.map((p) => p.group))
    const fresh = pool.filter((p) => !used.has(p.group))
    const from = fresh.length > 0 ? fresh : pool
    const total = from.reduce((s, p) => s + p.weight, 0)
    let r = rnd() * total
    let choice = from[from.length - 1]!
    for (const p of from) {
      r -= p.weight
      if (r < 0) {
        choice = p
        break
      }
    }
    picked.push(choice)
    pool = pool.filter((p) => p !== choice)
  }
  const specs = picked
    .map((p): QuestSpec => ({ kind: p.kind, target: questTarget(p.kind, input.goal), ...(p.kind === 'pathStop' && skill ? { skill } : {}) }))
    .sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind))
  return { day, specs, mastered }
}

/** The day's three quests: deterministic from the day and her state when it began. */
function planFor(day: string, input: QuestInput): QuestPlan {
  const start = dayStart(day)
  const before = input.events.filter((e) => e.at < start)
  const key = [day, input.goal, input.courseId ?? '', JSON.stringify(input.unitByCourse ?? {})].join('|')
  const last = before[before.length - 1]
  const hit = planCache.find(
    (c) => c.key === key && c.prefixLength === before.length && c.prefixLast === last && c.cards === input.rewards.cards && c.mastered === input.rewards.mastered,
  )
  if (hit) return hit.plan
  const plan = drawPlan(day, before, input)
  planCache.unshift({ key, prefixLength: before.length, prefixLast: last, cards: input.rewards.cards, mastered: input.rewards.mastered, plan })
  planCache.length = Math.min(planCache.length, PLAN_CACHE_SIZE)
  return plan
}

/** The day's three quests (what they ask), in their order. */
export function questSpecs(day: string, input: QuestInput): QuestSpec[] {
  return planFor(day, input).specs
}

// ---------------------------------------------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------------------------------------------

const FIRST_TRY_KINDS = new Set<XpAward['kind']>(['line', 'part', 'line_picked'])

function isOwn(e: Ev): boolean {
  return 'own' in e && e.own === true
}

/** How far a quest has come on its day (not capped). `mastered`: the types mastered when the day began. */
export function questCount(spec: QuestSpec, day: string, input: Pick<QuestInput, 'events' | 'awards'>, mastered: ReadonlySet<string> = new Set()): number {
  const dayAwards = () => input.awards.filter((a) => a.day === day)
  const dayEvents = () => input.events.filter((e) => dayKey(e.at) === day)
  const finished = () => dayEvents().filter((e): e is Extract<Ev, { t: 'problem_done' }> => e.t === 'problem_done')
  const sets = () => dayEvents().filter((e): e is Extract<Ev, { t: 'set_done' }> => e.t === 'set_done' && e.skipped === 0 && e.done.length > 0)
  switch (spec.kind) {
    case 'xp':
      return dayAwards()
        .filter((a) => a.kind !== 'chest')
        .reduce((s, a) => s + a.xp, 0)
    case 'firstTry':
      return dayAwards().filter((a) => FIRST_TRY_KINDS.has(a.kind)).length
    case 'problems':
      return finished().length
    case 'noHintSet':
      return sets().filter((s) => !input.events.some((e) => e.t === 'hint' && s.done.includes(e.attemptId))).length
    case 'perfectSet':
      return sets().filter((s) => s.done.every((id) => isFirstTryRight(slotEvents(input.events, id)))).length
    case 'squash':
      return dayAwards().filter((a) => a.kind === 'squash').length
    case 'unmastered':
      return finished().filter((e) => !isOwn(e) && !mastered.has(e.skill)).length
    case 'pathStop':
      return finished().filter((e) => !isOwn(e) && e.skill === spec.skill).length
    case 'own':
      return finished().filter(isOwn).length
  }
}

function readDay(plan: QuestPlan, input: Pick<QuestInput, 'events' | 'awards'>): QuestDay {
  const quests = plan.specs.map((spec): Quest => {
    const n = questCount(spec, plan.day, input, plan.mastered)
    return { ...spec, count: Math.min(n, spec.target), done: n >= spec.target }
  })
  const done = quests.filter((q) => q.done).length
  return { day: plan.day, quests, done, allDone: quests.length > 0 && done === quests.length }
}

/** The day's quests and how far each has come. */
export function questDay(day: string, input: QuestInput): QuestDay {
  return readDay(planFor(day, input), input)
}

/**
 * The same day's quests read without some of her work (the problem or the set she just finished: its attempts' events
 * and awards, and the set's end): how far they were before it. The day's three stay the day's three.
 */
export function questDayWithout(day: string, input: QuestInput, attemptIds: ReadonlySet<string>, setId?: string): QuestDay {
  const plan = planFor(day, input)
  const events = input.events.filter((e) => !('attemptId' in e && attemptIds.has(e.attemptId)) && !(e.t === 'set_done' && e.setId === setId))
  const awards = input.awards.filter((a) => a.attemptId === undefined || !attemptIds.has(a.attemptId))
  return readDay(plan, { events, awards })
}

/** A quest that moved between two readings of the same day: how far it was, and where it is now. */
export interface QuestMove {
  quest: Quest
  before: number
  /** Done now, not before. */
  newlyDone: boolean
}

/** The quests `after` moved past `before` (the same day, read without and with what she just did). */
export function questMoves(before: QuestDay, after: QuestDay): QuestMove[] {
  if (before.day !== after.day) return []
  const out: QuestMove[] = []
  after.quests.forEach((q, i) => {
    const was = before.quests[i]
    if (!was || was.kind !== q.kind) return
    if (q.count > was.count || (q.done && !was.done)) out.push({ quest: q, before: was.count, newlyDone: q.done && !was.done })
  })
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// The chest
// ---------------------------------------------------------------------------------------------------------------

/** A chest she can open: today's, or yesterday's (it waits one day). */
export interface ChestSpot {
  day: string
  when: 'today' | 'yesterday'
}

/**
 * The chests she can open now: a day whose three quests are all done and whose chest she has not opened, today's, and
 * yesterday's on the day after (then it is gone). One chest a day at most.
 */
export function openableChests(input: QuestInput, now: number): ChestSpot[] {
  const today = dayKey(now)
  const yesterday = addDays(today, -1)
  const opened = chestOpenings(input.events)
  const out: ChestSpot[] = []
  if (!opened.has(yesterday) && questDay(yesterday, input).allDone) out.push({ day: yesterday, when: 'yesterday' })
  if (!opened.has(today) && questDay(today, input).allDone) out.push({ day: today, when: 'today' })
  return out
}

// ---------------------------------------------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------------------------------------------

/** The problem type's title, for the path quest. */
export function typeTitle(skill: string): string {
  return allTemplates().find((x) => x.template.id === skill)?.template.title ?? skill
}

/** What a quest asks, in her words ("Finish 3 problems"). */
export function questTitle(spec: QuestSpec): string {
  const n = spec.target
  switch (spec.kind) {
    case 'xp':
      return `Earn ${n} XP`
    case 'problems':
      return n === 1 ? 'Finish a problem' : `Finish ${n} problems`
    case 'firstTry':
      return `Get ${n} lines or parts right first try`
    case 'noHintSet':
      return 'Finish a set with no hints'
    case 'perfectSet':
      return 'A perfect set: every problem right first time'
    case 'squash':
      return 'Squash a monster'
    case 'unmastered':
      return n === 1 ? 'Finish a problem in a type you have not mastered' : `Finish ${n} problems in types you have not mastered`
    case 'pathStop':
      return 'Practice the next stop on your path'
    case 'own':
      return 'Check a problem from your homework'
  }
}

/** A second line where the quest names something (the path's stop). */
export function questDetail(spec: QuestSpec): string | null {
  return spec.kind === 'pathStop' && spec.skill ? typeTitle(spec.skill) : null
}

/** "6 of 8" (XP: "40 of 60 XP"). */
export function questProgressWords(q: Quest): string {
  return q.kind === 'xp' ? `${q.count} of ${q.target} XP` : `${q.count} of ${q.target}`
}
