import { useCallback, useEffect, useId, useMemo, useRef, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { A2HSCard } from '@/components/A2HSCard'
import { MasteryBar } from '@/components/MasteryBar'
import {
  COURSES,
  courseOfModule,
  courseOfSkill,
  getReview,
  getTemplate,
  hasModule,
  modulesInUnit,
  randomSeed,
  unitsWithModules,
  type CourseDef,
  type ModuleDef,
  type TemplateDef,
  type UnitDef,
} from '@/content'
import { loadReview } from '@/pages/review/session'
import { defaultKnobs, flagsFromKnobs, problemPath } from '@/problem/url'
import {
  mastery,
  pickWeakSpot,
  relativeDays,
  useAttempt,
  useDrillAccuracy,
  useEvents,
  useModuleMastery,
  useSettings,
  useStore,
  weakSpotWeights,
  type Attempt,
  type Ev,
} from '@/store'
import { useTutorStatus } from '@/tutor/useTutorStatus'

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`
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

/** Courses that have something to practise. An empty course (geometry, later) stays hidden. */
function visibleCourses(): CourseDef[] {
  return COURSES.filter((course) => unitsWithModules(course).length > 0)
}

/** Last unit that already has modules — where a first visit to this class lands. */
function defaultUnit(course: CourseDef): UnitDef {
  const ready = unitsWithModules(course)
  return ready[ready.length - 1] ?? course.units[0]!
}

function eventCourseId(event: Ev): string | null {
  if (event.t === 'problem_done') {
    const byModule = courseOfModule(event.moduleId)
    if (byModule) return byModule.course.id
  }
  return courseOfSkill(event.skill)?.course.id ?? null
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
  for (const unit of course.units) {
    for (const module of modulesInUnit(unit)) {
      for (const template of module.templates) out.push({ module, template })
    }
  }
  return out
}

function ContinueCard({ attempt }: { attempt: Attempt }) {
  const k = attempt.steps.length
  const href = problemPath(attempt.moduleId, attempt.templateId, attempt.seed, attempt.difficulty)
  const last = Date.parse(attempt.lastActiveAt)
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-gold bg-gold-100 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-text">Pick up where you left off</p>
      <h2 id={titleId} className="mt-1 text-lg font-semibold text-navy">
        {templateTitle(attempt.moduleId, attempt.templateId)}
      </h2>
      <p className="mt-1 text-sm text-navy/80">
        {k === 0 ? 'No steps yet — the problem is waiting for your first line' : `${k} ${k === 1 ? 'step' : 'steps'} done`}
        {Number.isFinite(last) ? ` · last worked on ${relativeDays(last)}` : ''}
      </p>
      <Link
        to={href}
        className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
      >
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

function WeakSpots({ course }: { course: CourseDef }) {
  const events = useEvents()
  const navigate = useNavigate()
  const entries = useMemo(() => courseTemplates(course), [course])
  const titleId = useId()
  const weakest = useMemo(() => {
    let best: { title: string; rate: number } | null = null
    for (const { template } of entries) {
      const info = mastery(events, template.id)
      if (info.rate === null || info.mastered) continue
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
      <button
        type="button"
        onClick={go}
        className="mt-3 min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
      >
        Practice weak spots
      </button>
    </section>
  )
}

function DrillSummary() {
  const acc = useDrillAccuracy()
  if (acc.denominator === 0 || acc.rate === null) {
    return <p className="text-sm text-navy/80">Not started — ten quick “legal or illegal?” calls at a time.</p>
  }
  return (
    <p className="text-sm text-navy">
      Drill so far:{' '}
      <strong>
        {acc.numerator} of {acc.denominator} right
      </strong>{' '}
      ({percent(acc.rate)})
    </p>
  )
}

function ReviewCard({ reviewId, unitLabel }: { reviewId: string; unitLabel: string }) {
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
      <Link
        to={`/review/${review.id}`}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
      >
        {label} <span aria-hidden>→</span>
      </Link>
    </section>
  )
}

function ModuleCard({ module }: { module: ModuleDef }) {
  const navigate = useNavigate()
  const skills = useMemo(() => module.templates.map((t) => t.id), [module])
  const m = useModuleMastery(skills)
  const titleId = useId()
  const isDrill = module.id === 'propertiesDrill'
  const first = module.templates[0]

  function random() {
    if (isDrill) navigate('/drill')
    else if (first) navigate(randomProblemPath(module.id, first))
    else navigate(`/m/${module.id}`)
  }

  const status = m.complete
    ? 'complete — every type mastered'
    : m.rate === null
      ? 'not started'
      : `${percent(m.rate)} first-try · ${m.masteredCount} of ${m.total} types mastered`

  return (
    <article aria-labelledby={titleId} className="flex flex-col rounded-2xl border border-navy-100 bg-white p-4">
      <h3 id={titleId} className="text-lg font-semibold text-navy">
        {module.title}
      </h3>
      <p className="mt-1 text-sm text-navy/80">{module.blurb}</p>
      <div className="mt-3">
        {isDrill ? (
          <DrillSummary />
        ) : (
          <MasteryBar label="Mastery" rate={m.rate} mastered={m.complete} status={status} valueText={status} lastAt={m.lastAt} />
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <button
          type="button"
          onClick={random}
          aria-describedby={titleId}
          className="min-h-11 rounded-xl bg-navy px-4 text-sm font-semibold text-white hover:bg-navy-600"
        >
          Random problem
        </button>
        <Link
          to={`/m/${module.id}`}
          aria-describedby={titleId}
          className="inline-flex min-h-11 items-center rounded-xl border border-navy-100 bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50"
        >
          Choose a type
        </Link>
      </div>
    </article>
  )
}

export function Home() {
  const attempt = useAttempt()
  const events = useEvents()
  const settings = useSettings()
  const setSettings = useStore((s) => s.setSettings)
  const navigate = useNavigate()
  const { courseId: routeCourseId, unitId: routeUnitId } = useParams()
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

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

  if (!selection) {
    return <p className="text-navy">No classes are ready yet.</p>
  }
  const { course, unit } = selection
  const courses = visibleCourses()
  const modules = modulesInUnit(unit)
  const reviewId = unit.reviewId && getReview(unit.reviewId) ? unit.reviewId : undefined

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-navy">Math & Science Trainer</h1>
        <p className="max-w-2xl text-navy/80">
          Practice that checks your work as you go. In math, every line is checked against the one before it; in
          science, every answer is checked with its units and figures. A mistake gets named the moment it happens.
        </p>
      </header>

      <A2HSCard />
      {attempt && <ContinueCard attempt={attempt} />}

      <div className="space-y-3">
        <div
          role="tablist"
          aria-label="Classes"
          onKeyDown={onTabKey}
          className="flex flex-nowrap gap-2 overflow-x-auto py-1"
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

        <WeakSpots course={course} />

        <div role="group" aria-label={`${course.title} units`} className="flex flex-nowrap gap-2 overflow-x-auto py-1">
          {course.units.map((u) => {
            const pressed = u.id === unit.id
            const empty = modulesInUnit(u).length === 0
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

      {reviewId && <ReviewCard reviewId={reviewId} unitLabel={unit.label} />}

      {modules.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {modules.map((m) => (
            <ModuleCard key={m.id} module={m} />
          ))}
        </div>
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
    </div>
  )
}

export default Home
