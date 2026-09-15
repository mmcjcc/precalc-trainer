import { useId, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { A2HSCard } from '@/components/A2HSCard'
import { MasteryBar } from '@/components/MasteryBar'
import { allTemplates, getTemplate, hasModule, MODULES, randomSeed, type ModuleDef, type TemplateDef } from '@/content'
import { defaultKnobs, flagsFromKnobs, problemPath } from '@/problem/url'
import {
  mastery,
  pickWeakSpot,
  relativeDays,
  useAttempt,
  useDrillAccuracy,
  useEvents,
  useModuleMastery,
  weakSpotWeights,
  type Attempt,
} from '@/store'

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

function WeakSpots() {
  const events = useEvents()
  const navigate = useNavigate()
  const entries = useMemo(() => allTemplates(), [])
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
          ? `Picks a problem type at random, leaning toward the ones that trip you up. Right now that's ${weakest.title} (${percent(weakest.rate)} first-try lately).`
          : "Picks a problem type at random, leaning toward the ones that trip you up. Types you haven't tried yet get a fair share too."}
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
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-coral-700">Unit 1</p>
        <h1 className="text-3xl font-semibold text-navy">Precalc Trainer</h1>
        <p className="max-w-2xl text-navy/80">
          Type every line of work. Each new line is checked against the one before it: a legal move gets its property
          named, and an illegal shortcut gets caught the moment it happens.
        </p>
      </header>

      <A2HSCard />
      {attempt && <ContinueCard attempt={attempt} />}
      <WeakSpots />

      <section aria-labelledby="home-modules" className="space-y-3">
        <h2 id="home-modules" className="text-lg font-semibold text-navy">
          Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <ModuleCard key={m.id} module={m} />
          ))}
        </div>
      </section>

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
