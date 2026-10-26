import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { A2HSCard } from '@/components/A2HSCard'
import { includesSubject, STORE } from '@/edition'
import { UnitPath } from '@/components/path/UnitPath'
import { TodayCard } from '@/components/rewards/TodayCard'
import { ResumeSetCard, StartSetButton } from '@/components/set/TodaySet'
import { useBreakpoint } from '@/components/useBreakpoint'
import {
  COURSES,
  courseOfModule,
  courseOfSkill,
  DEFAULT_SAT_REVIEW_COUNT,
  getModule,
  getReview,
  getSatDomainByUnit,
  getTemplate,
  hasModule,
  modulesInUnit,
  randomSeed,
  SAT_DOMAIN_REVIEW_COUNT,
  SAT_DOMAINS,
  SAT_PRACTICE_REVIEW_ID,
  SAT_REVIEW_COUNTS,
  satCoverageSummary,
  skillsInDomain,
  skillStatus,
  unitsWithModules,
  type CourseDef,
  type ModuleDef,
  type SatDomainDef,
  type SatReviewCount,
  type SatSkillStatus,
  type TemplateDef,
  type UnitDef,
} from '@/content'
import {
  createReviewSession,
  loadReview,
  SAT_FULL_MODULE_COUNT,
  SAT_FULL_MODULE_MINUTES,
  satTimerMinutes,
  saveReview,
} from '@/pages/review/session'
import { startSet } from '@/pages/set/startSet'
import { attemptResolves } from '@/problem/attemptResolves'
import { attemptPath } from '@/problem/ownUrl'
import { stepByStepModule } from '@/problem/solveStyle'
import { defaultKnobs, flagsFromKnobs, problemPath } from '@/problem/url'
import { loadActiveSet, resumePosition, resumeSet, sameSetProblem, setFinished, type ActiveSet } from '@/session/activeSet'
import { classTypes, setSizeFor } from '@/session/buildSet'
import {
  mastery,
  pickWeakSpot,
  relativeDays,
  useAttempt,
  useDrillAccuracy,
  useEvents,
  useRewardsOn,
  useSettings,
  useStore,
  weakSpotWeights,
  type Attempt,
  type Ev,
} from '@/store'
import { useTutorStatus } from '@/tutor/useTutorStatus'
import { Welcome } from './Welcome'

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/**
 * An action's look: filled (primary) or outlined. A phone's Home has one primary action, "Start a set"; there every
 * other action is outlined. A wide screen keeps its filled buttons.
 */
function actionLook(primary: boolean): string {
  return primary ? 'bg-navy text-white hover:bg-navy-600' : 'border border-navy-100 bg-white text-navy hover:bg-navy-50'
}

/** A fresh seed with the template's default difficulty. */
function randomProblemPath(moduleId: string, template: TemplateDef): string {
  return problemPath(moduleId, template.id, randomSeed(), flagsFromKnobs(defaultKnobs(template.knobs)))
}

function templateTitle(moduleId: string, templateId: string): string {
  if (!hasModule(moduleId)) return templateId
  try {
    return getTemplate(moduleId, templateId).title
  } catch {
    return templateId
  }
}

/** Courses that have something to practise in the active edition. A course with no problem types stays hidden. */
function visibleCourses(): CourseDef[] {
  return COURSES.filter((course) => {
    const units = unitsWithModules(course)
    if (units.length > 0) {
      return units.some((unit) => modulesInUnit(unit).some((m) => includesSubject(m.subject)))
    }
    return classTypes(course).length > 0
  })
}

/** Last unit that already has modules — where a first visit to this class lands (or the first unit when units own no modules). */
function defaultUnit(course: CourseDef): UnitDef {
  const ready = unitsWithModules(course)
  return ready[ready.length - 1] ?? course.units[0]!
}

function eventCourseId(event: Ev): string | null {
  if (event.t === 'problem_done') {
    const byModule = courseOfModule(event.moduleId)
    if (byModule) return byModule.course.id
  }
  return 'skill' in event ? (courseOfSkill(event.skill)?.course.id ?? null) : null
}

/** Class of the latest event that belongs to a registered module, if there is one. */
function courseFromEvents(events: Ev[], courses: CourseDef[]): CourseDef | null {
  let bestAt = Number.NEGATIVE_INFINITY
  let bestIndex = -1
  let bestId: string | null = null
  for (let index = 0; index < events.length; index++) {
    const event = events[index]!
    const id = eventCourseId(event)
    if (!id) continue
    if (bestId === null || event.at > bestAt || (event.at === bestAt && index > bestIndex)) {
      bestAt = event.at
      bestIndex = index
      bestId = id
    }
  }
  if (!bestId) return null
  return courses.find((course) => course.id === bestId) ?? null
}

function resolveSelection(input: {
  routeCourseId?: string
  routeUnitId?: string
  courseId?: string
  unitByCourse?: Record<string, string>
  events: Ev[]
}): { course: CourseDef; unit: UnitDef } | null {
  const courses = visibleCourses()
  if (courses.length === 0) return null
  const routeCourse = input.routeCourseId ? courses.find((c) => c.id === input.routeCourseId) : undefined
  const savedCourse = input.courseId ? courses.find((c) => c.id === input.courseId) : undefined
  const course = routeCourse ?? savedCourse ?? courseFromEvents(input.events, courses) ?? courses[0]!
  const routeUnit = routeCourse && input.routeUnitId ? course.units.find((u) => u.id === input.routeUnitId) : undefined
  const savedUnitId = input.unitByCourse?.[course.id]
  const savedUnit = savedUnitId ? course.units.find((u) => u.id === savedUnitId) : undefined
  // A deep link's unit wins. An unknown unit id is ignored and the saved (or default) unit is used.
  const unit = routeUnit ?? savedUnit ?? defaultUnit(course)
  return { course, unit }
}

function courseTemplates(course: CourseDef): { module: ModuleDef; template: TemplateDef }[] {
  const out: { module: ModuleDef; template: TemplateDef }[] = []
  if (unitsWithModules(course).length > 0) {
    for (const unit of course.units) {
      for (const module of modulesInUnit(unit)) {
        if (!includesSubject(module.subject)) continue
        for (const template of module.templates) out.push({ module, template })
      }
    }
    return out
  }
  for (const ct of classTypes(course)) {
    if (!hasModule(ct.moduleId)) continue
    const module = getModule(ct.moduleId)
    if (!includesSubject(module.subject)) continue
    const template = module.templates.find((t) => t.id === ct.templateId)
    if (template) out.push({ module, template })
  }
  return out
}

function ContinueCard({ attempt, primary }: { attempt: Attempt; primary: boolean }) {
  const k = attempt.steps.length
  // Her own problem reopens on its own route (`/own/...`), named as hers.
  const href = attemptPath(attempt)
  const last = Date.parse(attempt.lastActiveAt)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-gold bg-gold-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Pick up where you left off</p>
      <h2 id={titleId} className="mt-1 text-lg font-semibold text-navy">
        {attempt.own !== undefined ? `Your own problem · ${templateTitle(attempt.moduleId, attempt.templateId)}` : templateTitle(attempt.moduleId, attempt.templateId)}
      </h2>
      <p className="mt-1 text-sm text-navy/80">
        {k === 0 ? 'Not started yet' : `${k} ${k === 1 ? 'step' : 'steps'} done`}
        {Number.isFinite(last) ? ` · ${k === 0 ? 'opened' : 'last worked on'} ${relativeDays(last)}` : ''}
      </p>
      <Link to={href} className={`mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-4 font-semibold ${actionLook(primary)}`}>
        Continue <span aria-hidden>→</span>
      </Link>
    </section>
  )
}

/** Hidden unless the tutor is configured, the same rule as the Ask tab on a problem. */
function AskAnythingCard() {
  const tutor = useTutorStatus()
  if (!tutor.status?.configured) return null
  return (
    <Link to="/ask" className="block rounded-2xl border border-navy-100 bg-white p-4 hover:border-navy">
      <span className="font-semibold text-navy">Ask about any problem: type a problem from your homework</span>
    </Link>
  )
}

function WeakSpots({ course, primary }: { course: CourseDef; primary: boolean }) {
  const events = useEvents()
  const navigate = useNavigate()
  const entries = useMemo(() => courseTemplates(course), [course])
  const titleId = useId()
  const weakest = useMemo(() => {
    let best: { title: string; rate: number } | null = null
    for (const { template } of entries) {
      const info = mastery(events, template.id)
      // A type she gets right every time is not a weak spot, mastered or not.
      if (info.rate === null || info.mastered || info.rate >= 1) continue
      if (!best || info.rate < best.rate) best = { title: template.title, rate: info.rate }
    }
    return best
  }, [entries, events])

  if (entries.length === 0) return null

  function go() {
    const weights = weakSpotWeights(
      events,
      entries.map((e) => e.template.id),
    )
    const skill = pickWeakSpot(weights, Math.random())
    const entry = entries.find((e) => e.template.id === skill) ?? entries[0]!
    navigate(randomProblemPath(entry.module.id, entry.template))
  }

  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-navy-100 bg-navy-50 p-4">
      <h2 id={titleId} className="text-lg font-semibold text-navy">
        Practice weak spots
      </h2>
      <p className="mt-1 text-sm text-navy/80">
        {weakest
          ? `Picks a problem type at random from ${course.title}, leaning toward the ones that trip you up. Right now that's ${weakest.title} (${percent(weakest.rate)} first-try lately).`
          : `Picks a problem type at random from ${course.title}, leaning toward the ones that trip you up. Types you haven't tried yet get a fair share too.`}
      </p>
      <button type="button" onClick={go} className={`mt-3 min-h-11 rounded-xl px-4 font-semibold ${actionLook(primary)}`}>
        Practice weak spots
      </button>
    </section>
  )
}

function DrillSummary() {
  const acc = useDrillAccuracy()
  if (acc.denominator === 0 || acc.rate === null) {
    return <span className="block text-sm text-navy/80">Not started — ten quick “legal or illegal?” calls at a time.</span>
  }
  return (
    <span className="block text-sm text-navy">
      Drill so far:{' '}
      <strong>
        {acc.numerator} of {acc.denominator} right
      </strong>{' '}
      ({percent(acc.rate)})
    </span>
  )
}

function ReviewCard({ reviewId, unitLabel, primary }: { reviewId: string; unitLabel: string; primary: boolean }) {
  const review = getReview(reviewId)
  const session = useMemo(() => (review ? loadReview(review.id) : null), [review])
  const titleId = useId()
  if (!review) return null
  const inProgress = session != null && session.index < session.problems.length
  const finished = session != null && session.index >= session.problems.length
  const label = inProgress
    ? `Continue — problem ${session.index + 1} of ${session.problems.length}`
    : finished
      ? 'See the last set'
      : 'Start the review'
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-coral bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">For the {unitLabel} test</p>
      <h2 id={titleId} className="mt-1 text-lg font-semibold text-navy">
        {review.title}
      </h2>
      <p className="mt-1 text-sm text-navy/80">
        One mixed set from the unit. Every topic that fits comes up, then extra problems lean toward the ones that have
        been giving you trouble.
      </p>
      <Link to={`/review/${review.id}`} className={`mt-3 inline-flex min-h-11 items-center rounded-xl px-4 font-semibold ${actionLook(primary)}`}>
        {label} <span aria-hidden>→</span>
      </Link>
    </section>
  )
}

const SKILL_STATUS_LABEL: Record<SatSkillStatus, string> = {
  practiced: 'Practiced',
  'not-yet': 'Not yet',
  coming: 'Coming',
}

const SKILL_STATUS_STYLE: Record<SatSkillStatus, string> = {
  practiced: 'bg-ok-100 text-ok font-semibold',
  'not-yet': 'bg-navy-50 text-navy font-semibold',
  coming: 'bg-navy-50 text-navy/60 font-medium',
}

function SatPracticeSetCard({ primary }: { primary: boolean }) {
  const navigate = useNavigate()
  const settings = useSettings()
  const saved = useMemo(() => loadReview(SAT_PRACTICE_REVIEW_ID), [])
  const [count, setCount] = useState<SatReviewCount>(DEFAULT_SAT_REVIEW_COUNT)
  const [timed, setTimed] = useState<boolean>(settings.testMode)
  const titleId = useId()
  const timedLabelId = useId()
  const timedDescId = useId()
  const targetMins = satTimerMinutes(count)
  const inProgress = saved != null && saved.index < saved.problems.length

  function startMixedSet() {
    const testModeBefore = useStore.getState().settings.testMode
    useStore.getState().setSettings({ testMode: timed })
    const session = createReviewSession(SAT_PRACTICE_REVIEW_ID, { count, timed, testModeBefore })
    saveReview(session)
    navigate(`/review/${SAT_PRACTICE_REVIEW_ID}`)
  }

  return (
    <section aria-labelledby={titleId} data-sat-practice-set="" className="space-y-4 rounded-2xl border border-coral bg-white p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">Mixed practice</p>
        <h2 id={titleId} className="mt-1 text-xl font-semibold text-navy">
          SAT practice set
        </h2>
        <p className="mt-1 text-sm text-navy/80">
          8, 12 or 22 problems drawn from all four domains weighted like the test (35% Algebra, 35% Advanced Math, 15%
          Problem-Solving and Data Analysis, 15% Geometry and Trigonometry, with at least one problem from each domain).
        </p>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-navy">How many problems</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SAT_REVIEW_COUNTS.map((n) => {
            const checked = count === n
            return (
              <label
                key={n}
                className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl px-4 text-base font-semibold ${
                  checked ? 'bg-navy text-white' : 'border border-navy-100 bg-white text-navy hover:bg-navy-50'
                }`}
              >
                <input
                  type="radio"
                  name="sat-practice-count"
                  value={n}
                  checked={checked}
                  onChange={() => setCount(n)}
                  className="sr-only"
                />
                {n}
              </label>
            )
          })}
        </div>
      </fieldset>

      <div className="flex items-start justify-between gap-4 border-t border-navy-100 pt-3">
        <div className="min-w-0">
          <p id={timedLabelId} className="font-semibold text-navy">
            Optional timer
          </p>
          <p id={timedDescId} className="mt-0.5 text-sm text-navy/80">
            {targetMins} minutes for {count} problems
            {count < SAT_FULL_MODULE_COUNT
              ? `, scaled from the test's ${SAT_FULL_MODULE_MINUTES} minutes for ${SAT_FULL_MODULE_COUNT}`
              : ', as on the test'}
            . The timer only shows the time; it never stops you.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={timed}
          aria-labelledby={timedLabelId}
          aria-describedby={timedDescId}
          onClick={() => setTimed((v) => !v)}
          className={`min-h-11 min-w-20 shrink-0 rounded-full px-3 text-sm font-semibold ${
            timed ? 'bg-navy text-white hover:bg-navy-600' : 'border-2 border-navy-100 bg-white text-navy hover:bg-navy-50'
          }`}
        >
          {timed ? (
            <>
              <span aria-hidden>✓ </span>On
            </>
          ) : (
            'Off'
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startMixedSet}
          className={`min-h-11 rounded-xl px-4 font-semibold ${actionLook(primary)}`}
        >
          Start SAT practice set
        </button>
        {inProgress && (
          <Link
            to={`/review/${SAT_PRACTICE_REVIEW_ID}`}
            className="inline-flex min-h-11 items-center rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
          >
            Continue — problem {saved.index + 1} of {saved.problems.length}
          </Link>
        )}
      </div>
    </section>
  )
}

function SatDomainCard({
  domain,
  events,
  selected,
  primary,
}: {
  domain: SatDomainDef
  events: readonly Ev[]
  selected: boolean
  primary: boolean
}) {
  const navigate = useNavigate()
  const titleId = useId()
  const skills = useMemo(() => skillsInDomain(domain.id), [domain.id])

  function startDomainPractice() {
    const session = createReviewSession(domain.reviewId, {
      count: SAT_DOMAIN_REVIEW_COUNT,
      timed: false,
      testModeBefore: useStore.getState().settings.testMode,
    })
    saveReview(session)
    navigate(`/review/${domain.reviewId}`)
  }

  return (
    <section
      aria-labelledby={titleId}
      data-sat-domain={domain.id}
      data-selected-domain={selected ? 'true' : undefined}
      className={`space-y-3 rounded-2xl border bg-white p-4 ${selected ? 'border-navy' : 'border-navy-100'}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={titleId} className="text-lg font-semibold text-navy">
          {domain.title}
        </h2>
        <span className="text-sm font-semibold text-coral-700">{domain.shareLabel} of the test</span>
      </div>

      <ul aria-label={`${domain.title} skills`} className="divide-y divide-navy-100">
        {skills.map((skill) => {
          const status = skillStatus(skill, events)
          return (
            <li
              key={skill.id}
              data-sat-skill={skill.id}
              data-skill-status={status}
              className="flex items-center justify-between gap-3 py-2 text-sm"
            >
              <span className="text-navy">{skill.title}</span>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${SKILL_STATUS_STYLE[status]}`}>
                {SKILL_STATUS_LABEL[status]}
              </span>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={startDomainPractice}
        className={`min-h-11 rounded-xl px-4 font-semibold ${actionLook(primary)}`}
      >
        Practice {domain.title}
      </button>
    </section>
  )
}

function SatPrepSection({ selectedUnitId, primary }: { selectedUnitId: string; primary: boolean }) {
  const events = useEvents()
  const headerId = useId()
  const coverageLine = useMemo(() => satCoverageSummary(), [])

  // A container: when the class column is wide enough (a desktop window), the About and practice-set cards sit
  // side by side and the four domain cards go two by two; on a phone or a tablet everything stays one column.
  return (
    <div className="@container space-y-4" data-sat-home="">
      <div className="grid gap-4 @4xl:grid-cols-2">
        <section aria-labelledby={headerId} className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id={headerId} className="text-lg font-semibold text-navy">
            About the SAT Math section
          </h2>
          <p className="text-sm text-navy/80">
            The digital SAT&apos;s math section is 44 questions in 70 minutes, in two adaptive modules of 22 questions
            and 35 minutes each, with a Desmos calculator and a reference sheet throughout. About three quarters of the
            questions are multiple choice and a quarter are typed answers. They cover four content domains: Algebra
            (about 35%), Advanced Math (about 35%), Problem-Solving and Data Analysis (about 15%), and Geometry and
            Trigonometry (about 15%).
          </p>
          <p className="text-sm font-semibold text-navy" data-sat-coverage="">
            {coverageLine}.
          </p>
        </section>

        <SatPracticeSetCard primary={primary} />
      </div>

      <div className="grid gap-4 @4xl:grid-cols-2" data-sat-domains="">
        {SAT_DOMAINS.map((domain) => (
          <SatDomainCard
            key={domain.id}
            domain={domain}
            events={events}
            selected={domain.unitId === selectedUnitId}
            primary={primary}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * "Modules in this unit", under the path: a compact list of links to each module page, where the rule cards, every
 * type with its difficulty, and the mastery explanation stay. The properties drill (no problem types, so no stretch of
 * the path) is here too, with how the drill is going.
 */
function UnitModules({ modules }: { modules: ModuleDef[] }) {
  const titleId = useId()
  const drillId = useId()
  return (
    <section aria-labelledby={titleId} className="space-y-2" data-unit-modules="">
      <h2 id={titleId} className="text-lg font-semibold text-navy">
        Modules in this unit
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {modules.map((m) => {
          const drill = m.id === 'propertiesDrill'
          return (
            <li key={m.id}>
              <Link
                to={`/m/${m.id}`}
                aria-label={m.title}
                aria-describedby={drill ? drillId : undefined}
                className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-navy-100 bg-white px-4 py-2 text-navy hover:bg-navy-50"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{m.title}</span>
                  {drill && (
                    <span id={drillId} className="block">
                      <DrillSummary />
                    </span>
                  )}
                </span>
                <span aria-hidden className="shrink-0 text-lg">
                  ›
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Home, or for someone new to the store app (no class chosen, nothing done yet) the first-run picker: which class,
 * then which unit (pages/Welcome.tsx). A /c/... link chooses the class itself, so it never shows the picker.
 */
export function Home() {
  const { courseId: routeCourseId } = useParams()
  const firstRun = useStore((s) => STORE && s.settings.courseId === undefined && s.events.length === 0 && s.attempt === null)
  return firstRun && !routeCourseId ? <Welcome /> : <HomeScreen />
}

function HomeScreen() {
  const attempt = useAttempt()
  const events = useEvents()
  const settings = useSettings()
  const setSettings = useStore((s) => s.setSettings)
  const rewards = useRewardsOn()
  const navigate = useNavigate()
  const { courseId: routeCourseId, unitId: routeUnitId } = useParams()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  // On a phone Home is a Today screen: a short title, one primary action ("Start a set"), Resume, then the lists.
  const phone = useBreakpoint() === 'mobile'
  // The set she left (read once per visit: the set page is where it changes).
  const [activeSet] = useState<ActiveSet | null>(() => {
    const set = loadActiveSet()
    return set && !setFinished(set) ? set : null
  })

  const remember = useCallback(
    (courseId: string, unitId: string) => {
      const current = useStore.getState().settings
      if (current.courseId === courseId && current.unitByCourse?.[courseId] === unitId) return
      setSettings({
        courseId,
        unitByCourse: { ...current.unitByCourse, [courseId]: unitId },
      })
    },
    [setSettings],
  )

  // A real /c/:courseId link is remembered. An unknown id is ignored (Home falls back, no error page).
  useEffect(() => {
    if (!routeCourseId || !visibleCourses().some((c) => c.id === routeCourseId)) return
    const current = useStore.getState().settings
    const sel = resolveSelection({
      routeCourseId,
      routeUnitId,
      courseId: current.courseId,
      unitByCourse: current.unitByCourse,
      events: useStore.getState().events,
    })
    if (!sel || sel.course.id !== routeCourseId) return
    remember(sel.course.id, sel.unit.id)
  }, [routeCourseId, routeUnitId, remember])

  const selection = resolveSelection({
    routeCourseId,
    routeUnitId,
    courseId: settings.courseId,
    unitByCourse: settings.unitByCourse,
    events,
  })

  // The unit chips scroll sideways on a phone: bring the selected one into view (the row only, never the page).
  const unitRow = useRef<HTMLDivElement>(null)
  const shownUnit = selection?.unit.id
  useEffect(() => {
    const row = unitRow.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return
    const r = row.getBoundingClientRect()
    const c = chip.getBoundingClientRect()
    row.scrollLeft += c.left - r.left - (r.width - c.width) / 2
  }, [shownUnit])

  if (!selection) {
    return <p className="text-navy">No classes are ready yet.</p>
  }
  const { course, unit } = selection
  const courses = visibleCourses()
  const modules = modulesInUnit(unit)
  const isSat = course.id === 'sat'
  const reviewId = !isSat && unit.reviewId && getReview(unit.reviewId) ? unit.reviewId : undefined

  function selectCourse(id: string) {
    const next = courses.find((c) => c.id === id)
    if (!next) return
    const saved = useStore.getState().settings.unitByCourse?.[id]
    const nextUnit = next.units.find((u) => u.id === saved) ?? defaultUnit(next)
    remember(next.id, nextUnit.id)
    if (routeCourseId !== undefined && (routeCourseId !== next.id || routeUnitId !== nextUnit.id)) {
      navigate(`/c/${next.id}/${nextUnit.id}`, { replace: true })
    }
  }

  function selectUnit(unitId: string) {
    remember(course.id, unitId)
    if (routeCourseId !== undefined && (routeCourseId !== course.id || routeUnitId !== unitId)) {
      navigate(`/c/${course.id}/${unitId}`, { replace: true })
    }
  }

  function onTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = courses.findIndex((c) => c.id === course.id)
    if (index < 0) return
    let next = index
    if (event.key === 'ArrowRight') next = Math.min(courses.length - 1, index + 1)
    else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = courses.length - 1
    else return
    event.preventDefault()
    const id = courses[next]!.id
    if (id !== course.id) selectCourse(id)
    tabRefs.current[id]?.focus()
  }

  const setCount = setSizeFor(course)
  /** "Start a set": three problems for her from the selected class. It starts something, so no break here. */
  // One problem solved line by line: the unit's first step-by-step module (else the class's), a random type of it.
  const stepModule =
    modulesInUnit(unit).find((m) => stepByStepModule(m.id) && m.templates.length > 0) ??
    course.units.flatMap((u) => modulesInUnit(u)).find((m) => stepByStepModule(m.id) && m.templates.length > 0) ??
    (() => {
      const hit = classTypes(course).find((t) => t.steps && hasModule(t.moduleId))
      return hit && hasModule(hit.moduleId) ? getModule(hit.moduleId) : undefined
    })()

  function solveStepByStep() {
    if (!stepModule) return
    const template = stepModule.templates[Math.floor(Math.random() * stepModule.templates.length)]!
    navigate(randomProblemPath(stepModule.id, template))
  }

  function startASet() {
    // With no history in this class, the set comes from the unit Home shows (the first-run picker's choice).
    if (startSet(course, unit.id)) navigate('/set')
  }
  // The unfinished problem has a card of its own unless it is the set problem she is on ("Resume your set" is that).
  const attemptInSet = Boolean(
    activeSet && attempt && activeSet.status[activeSet.index] === 'pending' && sameSetProblem(attempt, activeSet.problems[activeSet.index]!),
  )
  const resumed = activeSet ? resumeSet(activeSet) : null

  // The tablet layout: two columns, today's part (the Today card, Start a set, Resume) beside the class's part (its
  // units, the path, the modules), in the same order as the phone's one column.
  const today = (
    <>
      <header className="space-y-2">
        <h1 className={`${phone ? 'text-2xl' : 'text-3xl'} font-semibold text-navy`}>{STORE ? 'Math Trainer' : 'Math & Science Trainer'}</h1>
        {!phone && (
          <p className="max-w-2xl text-navy/80">
            {STORE
              ? 'Practice that checks your work as you go. Every line is checked against the one before it, and a mistake gets named the moment it happens.'
              : 'Practice that checks your work as you go. In math, every line is checked against the one before it; in science, every answer is checked with its units and figures. A mistake gets named the moment it happens.'}
          </p>
        )}
      </header>

      {rewards && <TodayCard />}
      {setCount > 0 && (
        <div className={phone ? 'space-y-1' : 'max-w-sm space-y-1'}>
          <StartSetButton count={setCount} onStart={startASet} />
          {stepModule && (
            <button
              type="button"
              onClick={solveStepByStep}
              data-step-link=""
              className="inline-flex min-h-11 w-full items-center justify-center font-semibold text-navy underline"
            >
              Or solve one problem step by step
            </button>
          )}
        </div>
      )}
      {activeSet && resumed && (
        <ResumeSetCard position={resumePosition(activeSet)} total={activeSet.problems.length} status={resumed.status} primary={!phone} />
      )}
      {/* A saved attempt this build cannot open (a retired module or template) is not offered (attemptResolves.ts). */}
      {attempt && !attemptInSet && attemptResolves(attempt) && <ContinueCard attempt={attempt} primary={!phone} />}
      {/* An installed phone app has no "add to home screen" step. */}
      {!STORE && <A2HSCard quiet={phone} />}
    </>
  )
  const classPart = (
    <>
      {/* A container: on a narrow column (a phone, a tablet) the class and unit rows scroll sideways; on a wide
          desktop column they wrap instead (review 2026-10-26: the SAT domain pills scrolled while half the window
          sat empty). */}
      <div className="@container space-y-3">
        <div
          role="tablist"
          aria-label="Classes"
          onKeyDown={onTabKey}
          className="flex flex-nowrap gap-2 overflow-x-auto py-1 @4xl:flex-wrap @4xl:overflow-x-visible"
        >
          {courses.map((c) => {
            const selected = c.id === course.id
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                ref={(node) => {
                  tabRefs.current[c.id] = node
                }}
                onClick={() => selectCourse(c.id)}
                className={`min-h-11 min-w-11 shrink-0 whitespace-nowrap rounded-xl px-4 text-sm font-semibold ${
                  selected ? 'bg-navy text-white' : 'border border-navy-100 bg-white text-navy hover:bg-navy-50'
                }`}
              >
                {c.title}
              </button>
            )
          })}
        </div>

        <AskAnythingCard />

        <WeakSpots course={course} primary={!phone} />

        <div
          ref={unitRow}
          role="group"
          aria-label={`${course.title} units`}
          className="flex flex-nowrap gap-2 overflow-x-auto py-1 @4xl:flex-wrap @4xl:overflow-x-visible"
        >
          {course.units.map((u) => {
            const pressed = u.id === unit.id
            const empty = modulesInUnit(u).length === 0 && !getSatDomainByUnit(u.id)
            return (
              <button
                key={u.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => selectUnit(u.id)}
                className={`inline-flex min-h-11 min-w-11 shrink-0 items-center whitespace-nowrap rounded-xl px-4 text-sm font-semibold ${
                  pressed ? 'bg-navy text-white' : 'border border-navy-100 bg-white text-navy hover:bg-navy-50'
                }`}
              >
                {u.label} · {u.title}
                {empty && (
                  <span className={`ml-2 text-xs font-semibold uppercase tracking-wide ${pressed ? 'text-white/80' : 'text-navy/60'}`}>
                    Coming soon
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {reviewId && <ReviewCard reviewId={reviewId} unitLabel={unit.label} primary={!phone} />}

      {isSat ? (
        <SatPrepSection selectedUnitId={unit.id} primary={!phone} />
      ) : modules.length > 0 ? (
        <>
          {/* The unit as a road she walks (components/path), then the module pages. Keyed: the path decides on mount
              which of this unit's stops levelled up since she last saw them. */}
          <UnitPath key={`${course.id}/${unit.id}`} course={course} unit={unit} phone={phone} onShowUnit={selectUnit} />
          <UnitModules modules={modules} />
        </>
      ) : (
        <p className="rounded-2xl border border-navy-100 bg-white p-4 text-navy/80">
          Nothing to practise here yet: this unit is being built.
        </p>
      )}

      <Link to="/sandbox" className="block rounded-2xl border border-dashed border-navy-100 p-4 hover:border-navy">
        <span className="block text-xs font-semibold uppercase tracking-wide text-coral-700">Sandbox</span>
        <span className="mt-1 block font-semibold text-navy">Try any two lines</span>
        <span className="mt-1 block text-sm text-navy/80">
          Type an old line and a new one and see exactly what the checker says about the move.
        </span>
      </Link>
    </>
  )
  return phone ? (
    <div className="mx-auto max-w-4xl space-y-4" data-columns={1}>
      {today}
      {classPart}
    </div>
  ) : (
    <div className="mx-auto grid max-w-[88rem] grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start gap-8" data-columns={2}>
      <div className="space-y-6" data-home-column="today">
        {today}
      </div>
      <div className="space-y-6" data-home-column="class">
        {classPart}
      </div>
    </div>
  )
}

export default Home
