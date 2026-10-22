import { useId, useMemo, useState } from 'react'
import { CardColumns } from '@/components/CardColumns'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { MasteryBar } from '@/components/MasteryBar'
import {
  courseOfModule,
  getModule,
  hasModule,
  randomSeed,
  type DifficultyKnobs,
  type KnobDef,
  type ModuleDef,
  type TemplateDef,
} from '@/content'
import { defaultKnobs, flagsFromKnobs, problemPath } from '@/problem/url'
import { hasOwnProblems } from '@/content/own'
import { ownBuilderPath } from '@/problem/ownUrl'
import { useMastery, useModuleMastery } from '@/store'
import { StepBadge } from '@/components/StepBadge'
import { pickModule, stepByStepModule } from '@/problem/solveStyle'

const STEP_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
  { value: 1, label: 'Shortest' },
  { value: 2, label: 'Longer' },
  { value: 3, label: 'Longest' },
]

function KnobControl({
  def,
  knobs,
  onChange,
}: {
  def: KnobDef
  knobs: DifficultyKnobs
  onChange: (next: DifficultyKnobs) => void
}) {
  const name = useId()
  const key = def.key
  if (key === 'steps') {
    const current = knobs.steps ?? 1
    return (
      <fieldset className="min-w-0">
        <legend className="text-sm text-navy">{def.label}</legend>
        <div className="mt-1 inline-flex flex-wrap rounded-xl border border-navy-100 bg-white p-0.5">
          {STEP_OPTIONS.map((o) => {
            const checked = current === o.value
            return (
              <label
                key={o.value}
                className={`flex min-h-11 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold ${
                  checked ? 'bg-navy text-white' : 'text-navy hover:bg-navy-50'
                }`}
              >
                <input
                  type="radio"
                  name={name}
                  value={o.value}
                  checked={checked}
                  onChange={() => onChange({ ...knobs, steps: o.value })}
                  className="sr-only"
                />
                {checked && <span aria-hidden>✓</span>}
                {o.label}
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-navy">
      <input
        type="checkbox"
        checked={knobs[key] === true}
        onChange={(e) => {
          const next: DifficultyKnobs = { ...knobs }
          next[key] = e.target.checked
          onChange(next)
        }}
        className="h-5 w-5 accent-navy"
      />
      <span>{def.label}</span>
    </label>
  )
}

function TemplateCard({ module, template }: { module: ModuleDef; template: TemplateDef }) {
  const info = useMastery(template.id)
  const navigate = useNavigate()
  const [knobs, setKnobs] = useState<DifficultyKnobs>(() => defaultKnobs(template.knobs))
  const titleId = useId()

  function start() {
    navigate(problemPath(module.id, template.id, randomSeed(), flagsFromKnobs(knobs)))
  }

  return (
    <article aria-labelledby={titleId} className="flex flex-col rounded-2xl border border-navy-100 bg-white p-4">
      <h2 id={titleId} className="text-lg font-semibold text-navy">
        {template.title}
      </h2>
      <p className="mt-1 text-sm text-navy/80">{template.description}</p>
      <div className="mt-3">
        <MasteryBar
          label="Mastery"
          rate={info.rate}
          mastered={info.mastered}
          count={info.count}
          window={info.window}
          lastAt={info.lastAt}
        />
      </div>
      {template.knobs.length > 0 && (
        <div className="mt-3 rounded-xl bg-navy-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/80">Difficulty</p>
          {template.knobs.map((def) => (
            <KnobControl key={def.key} def={def} knobs={knobs} onChange={setKnobs} />
          ))}
        </div>
      )}
      <div className="mt-auto pt-4">
        <button
          type="button"
          onClick={start}
          aria-describedby={titleId}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
        >
          Start <span aria-hidden>→</span>
        </button>
      </div>
    </article>
  )
}

/** "Check my own problem": she types one from her homework, and the module checks it line by line (pages/OwnBuilder.tsx). */
function OwnProblemCard({ moduleId }: { moduleId: ModuleDef['id'] }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-gold bg-gold-100 p-4" data-own-card="">
      <h2 id={titleId} className="text-lg font-semibold text-navy">
        Check my own problem
      </h2>
      <p className="mt-1 text-sm text-navy/80">
        Type a problem from your homework. Every line you write is checked, with hints and named mistakes, the same as here.
      </p>
      <Link
        to={ownBuilderPath(moduleId)}
        aria-describedby={titleId}
        className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
      >
        Type my problem <span aria-hidden>→</span>
      </Link>
    </section>
  )
}

function ModuleView({ module }: { module: ModuleDef }) {
  const skills = useMemo(() => module.templates.map((t) => t.id), [module])
  const mm = useModuleMastery(skills)
  const isDrill = module.id === 'propertiesDrill'
  const placed = courseOfModule(module.id)
  const backTo = placed ? `/c/${placed.course.id}/${placed.unit.id}` : '/'
  const eyebrow = placed ? `${placed.course.short} · ${placed.unit.label}` : module.subject ? `${module.subject} module` : 'Module'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to={backTo} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-navy hover:underline">
        <span aria-hidden>←</span> Back
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-coral-700">{eyebrow}</p>
        <h1 className="text-3xl font-semibold text-navy">{module.title}</h1>
        {stepByStepModule(module.id) && <StepBadge pick={pickModule(module.id)} />}
        <p className="max-w-2xl text-navy/80">{module.blurb}</p>
        {!isDrill && mm.total > 0 && (
          <p className="text-sm text-navy">
            {mm.complete ? (
              <>
                <span aria-hidden className="text-ok">
                  ✓{' '}
                </span>
                Module complete — every type mastered. Everything stays open for review.
              </>
            ) : (
              `${mm.masteredCount} of ${mm.total} types mastered so far.`
            )}
          </p>
        )}
      </header>

      {isDrill ? (
        <section className="rounded-2xl border border-navy-100 bg-white p-4">
          <h2 className="text-lg font-semibold text-navy">Properties drill</h2>
          <p className="mt-1 text-sm text-navy/80">
            Ten quick calls at a time: is this step legal, and which property makes it legal? Every wrong call shows the
            rule that decides it.
          </p>
          <Link
            to="/drill"
            className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
          >
            Start the drill <span aria-hidden>→</span>
          </Link>
        </section>
      ) : (
        <>
          {hasOwnProblems(module.id) && (
            // One line near the top for her homework problem; the card at the bottom says more.
            <p data-own-link="">
              <Link to={ownBuilderPath(module.id)} className="inline-flex min-h-11 items-center gap-1 font-semibold text-navy underline underline-offset-2 hover:text-navy-600">
                Check a problem from your homework <span aria-hidden>→</span>
              </Link>
            </p>
          )}
          <p className="max-w-2xl text-sm text-navy/80">
            A type counts as mastered when your last 5 finished problems average at least 80% first-try steps, with no
            revealed steps and every final answer right. It&apos;s a label, never a lock.
          </p>
          {/* One column on a phone, two in the tablet layout (components/CardColumns.tsx). */}
          <CardColumns>
            {module.templates.map((t) => (
              <TemplateCard key={t.id} module={module} template={t} />
            ))}
          </CardColumns>
          {hasOwnProblems(module.id) && <OwnProblemCard moduleId={module.id} />}
        </>
      )}

      {module.ruleCards.length > 0 && (
        <details className="rounded-2xl border border-navy-100 bg-white p-4">
          <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-navy">
            Rule cards for this module ({module.ruleCards.length})
          </summary>
          <ul className="mt-2 space-y-3">
            {module.ruleCards.map((card) => (
              <li key={card.id} className="rounded-xl bg-navy-50 p-3">
                <p className="font-semibold text-navy">{card.title}</p>
                <p className="mt-1 text-sm text-navy">{card.body}</p>
                {card.example && <p className="mt-1 font-mono text-sm text-navy/80">{card.example}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function ModulePage() {
  const { moduleId } = useParams()
  if (!moduleId || !hasModule(moduleId)) return <Navigate to="/" replace />
  return <ModuleView module={getModule(moduleId)} />
}

export default ModulePage
