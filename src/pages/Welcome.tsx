import { useState } from 'react'
import { COURSES, unitsWithModules, type CourseDef } from '@/content'
import { useStore } from '@/store'

/** The classes with problems, in Home's order. */
function readyCourses(): CourseDef[] {
  return COURSES.filter((course) => unitsWithModules(course).length > 0)
}

/** "Functions and their graphs, polynomial and rational functions, ...": what a class covers, from its units. */
export function courseBlurb(course: CourseDef): string {
  const titles = unitsWithModules(course).map((u, i) => (i === 0 ? u.title : u.title.charAt(0).toLowerCase() + u.title.slice(1)))
  return titles.join(', ')
}

/**
 * The store app's first screen for someone new (no class chosen, nothing done yet): which class, then which unit her
 * class is on. It saves the choice the way Home's class and unit buttons do (settings.courseId, unitByCourse), so
 * Home opens on it and a first set comes from that unit. Home can change both any time.
 */
export function Welcome() {
  const setSettings = useStore((s) => s.setSettings)
  const [course, setCourse] = useState<CourseDef | null>(null)
  const courses = readyCourses()

  function choose(unitId: string) {
    if (!course) return
    const current = useStore.getState().settings
    setSettings({ courseId: course.id, unitByCourse: { ...current.unitByCourse, [course.id]: unitId } })
  }

  if (!course) {
    return (
      <section aria-labelledby="welcome-title" className="mx-auto max-w-md space-y-5">
        <header className="space-y-2">
          <h1 id="welcome-title" className="text-2xl font-semibold text-navy">
            Welcome to Math Trainer
          </h1>
          <p className="text-navy/80">
            Practice that checks every line you write and names the mistake the moment it happens. Which class are you
            practicing for?
          </p>
        </header>
        <ul className="space-y-3">
          {courses.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setCourse(c)}
                className="flex min-h-16 w-full flex-col items-start gap-1 rounded-2xl border-2 border-navy-100 bg-white px-4 py-3 text-left hover:border-navy hover:bg-navy-50"
              >
                <span className="text-lg font-semibold text-navy">{c.title}</span>
                <span className="text-sm text-navy/80">{courseBlurb(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const units = unitsWithModules(course)
  return (
    <section aria-labelledby="welcome-unit-title" className="mx-auto max-w-md space-y-5">
      <header className="space-y-2">
        <button type="button" onClick={() => setCourse(null)} className="-ml-1 inline-flex min-h-11 items-center px-1 font-semibold text-navy">
          <span aria-hidden>←&nbsp;</span>Back
        </button>
        <h1 id="welcome-unit-title" className="text-2xl font-semibold text-navy">
          Which unit is your class on?
        </h1>
        <p className="text-navy/80">{course.title}. Your first set of problems comes from it, and you can change it any time on Home.</p>
      </header>
      <ul className="space-y-2">
        {units.map((u) => (
          <li key={u.id}>
            <button
              type="button"
              onClick={() => choose(u.id)}
              aria-label={`${u.label}: ${u.title}`}
              className="flex min-h-14 w-full items-center gap-2 rounded-2xl border-2 border-navy-100 bg-white px-4 py-2 text-left font-semibold text-navy hover:border-navy hover:bg-navy-50"
            >
              <span className="shrink-0">{u.label}</span>
              <span aria-hidden className="text-navy/40">
                ·
              </span>
              <span className="font-medium">{u.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {units[0] && (
        <button type="button" onClick={() => choose(units[0]!.id)} className="inline-flex min-h-11 items-center font-semibold text-navy underline">
          Not sure? Start at the beginning
        </button>
      )}
    </section>
  )
}
