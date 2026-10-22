import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getModule, hasModule } from '@/content'
import { OWN_PLACES, buildOwnProblem, ownConstructor, ownFlags, type OwnConstructor, type OwnKind, type OwnPart, type OwnResult } from '@/content/own'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { loadOwnDraft, ownKeysFor, saveOwnDraft } from '@/problem/ownDraft'
import { ownProblemPath } from '@/problem/ownUrl'
import { liveParseError, safeLatex } from '@/problem/stepEngine'
import type { VarName } from '@/shared/types'

/** How the builder was opened: "Check another" starts empty; a link to a problem it could not open brings its text. */
export interface OwnBuilderState {
  fresh?: boolean
  text?: string
  kind?: string
  /** The decimal places that link asked for (exponential and log equations). */
  places?: number
  /** Check the text at once (a route whose problem could not be opened: say why). */
  check?: boolean
}

interface Draft {
  kind: string
  text: string
  /** Round the answer to this many decimal places (a module that offers it); absent: the exact answer. */
  places?: number
}

/** A reason or a question, with its formulas in KaTeX and another module as a link to its page. */
export function OwnText({ parts }: { parts: readonly OwnPart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === 'string') return <span key={i}>{part}</span>
        if ('tex' in part) return <Katex key={i} tex={part.tex} />
        if (!hasModule(part.module)) return <span key={i}>another module</span>
        return (
          <Link key={i} to={`/m/${part.module}`} className="font-semibold text-navy underline">
            {getModule(part.module).title}
          </Link>
        )
      })}
    </>
  )
}

/**
 * "Check my own problem" (route `/own/:moduleId`): she picks the kind of problem when the module has more than one
 * (and, for exponential and log equations, the exact answer or one rounded to 1 to 4 decimal places), types hers on
 * the module's own keypad (the keyboard on a computer) with a live KaTeX preview, and "Check it" says either what she
 * will be asked, with Start, or why not in one plain sentence. Start opens her problem on its own route
 * (`/own/<module>/<template>/<statement>`, `?d=r3` for three decimal places). The builder keeps her text and choices
 * on this device, so Back finds them.
 */
export function OwnBuilderPage() {
  const { moduleId } = useParams()
  if (!moduleId || !hasModule(moduleId)) return <Navigate to="/" replace />
  const c = ownConstructor(moduleId)
  if (!c) return <Navigate to={`/m/${moduleId}`} replace />
  return <Builder key={moduleId} c={c} />
}

function validatorFor(kind: OwnKind): (text: string) => ReturnType<typeof liveParseError> {
  const vars = [...kind.vars] as VarName[]
  return (text: string) => {
    if (kind.input === 'expression') return liveParseError(text, vars, 'expression')
    const asRelation = liveParseError(text, vars, 'relation')
    if (!asRelation || kind.input === 'relation') return asRelation
    // Either: a function written f(x) = …, or the expression alone.
    return liveParseError(text, vars, 'expression') ? asRelation : null
  }
}

function placesLabel(places: number | undefined): string {
  return places === undefined ? 'Exact answer' : `Round to ${places} decimal place${places === 1 ? '' : 's'}`
}

/** A choice among chips (the kinds, the answer's places): a radio group whose labels are the chips. */
function ChipChoice<T>({ legend, name, options, value, label, onPick, data }: {
  legend: string
  name: string
  options: readonly T[]
  value: T
  label: (option: T) => string
  onPick: (option: T) => void
  data?: string
}) {
  return (
    <fieldset className="min-w-0" {...(data ? { [data]: '' } : {})}>
      <legend className="text-sm font-semibold text-navy">{legend}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((option, i) => {
          const checked = option === value
          return (
            <label
              key={i}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold ${
                checked ? 'border-navy bg-navy text-white' : 'border-navy-100 bg-white text-navy hover:bg-navy-50'
              }`}
            >
              <input type="radio" name={name} value={i} checked={checked} onChange={() => onPick(option)} className="sr-only" />
              {checked && <span aria-hidden>✓</span>}
              {label(option)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

const PLACE_CHOICES: readonly (number | undefined)[] = [undefined, ...OWN_PLACES]

function Builder({ c }: { c: OwnConstructor }) {
  const navigate = useNavigate()
  const location = useLocation()
  const mod = getModule(c.moduleId)
  const opened = (location.state ?? null) as OwnBuilderState | null
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = loadOwnDraft(c.moduleId)
    const known = (k: string | undefined) => (k && c.kinds.some((kind) => kind.id === k) ? k : undefined)
    const kind = known(opened?.kind) ?? known(saved?.kind) ?? c.kinds[0]!.id
    // The decimal places are her last choice ("Check another" keeps it); a link brings its own.
    const savedPlaces = c.rounding && saved?.places !== undefined ? { places: saved.places } : {}
    if (opened?.fresh) return { kind, text: '', ...savedPlaces }
    if (opened?.text !== undefined) return { kind, text: opened.text, ...(c.rounding && opened.places !== undefined ? { places: opened.places } : {}) }
    return { kind, text: saved?.text ?? '', ...savedPlaces }
  })
  const kind = c.kinds.find((k) => k.id === draft.kind) ?? c.kinds[0]!
  const [result, setResult] = useState<{ text: string; kind: string; places: number | undefined; r: OwnResult } | null>(null)
  const verdictRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const kindName = useId()
  const placesName = useId()

  useEffect(() => {
    saveOwnDraft(c.moduleId, draft)
  }, [c.moduleId, draft])

  const check = useCallback(
    (text = draft.text, kindId = draft.kind, places = draft.places) => {
      const r = buildOwnProblem(c.moduleId, kindId, text, places !== undefined ? { places } : {})
      setResult({ text, kind: kindId, places, r })
      setTimeout(() => {
        const el = verdictRef.current
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 0)
    },
    [c.moduleId, draft.text, draft.kind, draft.places],
  )

  // A problem link that could not be opened comes here with its text: say why at once.
  const checkedOnOpen = useRef(false)
  useEffect(() => {
    if (checkedOnOpen.current || !opened?.check) return
    checkedOnOpen.current = true
    check()
  }, [opened, check])

  // The verdict is for the text, kind and places it was given on; a change puts it away.
  const current = result && result.text === draft.text && result.kind === draft.kind && result.places === draft.places ? result.r : null
  const validate = useMemo(() => validatorFor(kind), [kind])

  function start() {
    if (!current?.ok) return
    const p = current.instance
    navigate(ownProblemPath(c.moduleId, p.templateId, p.own ?? draft.text, ownFlags({ places: draft.places })))
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to={`/m/${c.moduleId}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-navy hover:underline">
        <span aria-hidden>←</span> {mod.title}
      </Link>
      <header className="space-y-2">
        <p className="text-sm font-semibold tracking-wide text-coral-700">{mod.title}</p>
        <h1 id={titleId} className="text-3xl font-semibold text-navy">
          Check my own problem
        </h1>
        <p className="text-navy/80">
          Type a problem from your homework or a quiz. I check every line you write, name a mistake when there is one,
          and give hints, as I do for the problems I make.
        </p>
      </header>

      {c.kinds.length > 1 && (
        <ChipChoice
          legend="What kind of problem is it?"
          name={kindName}
          options={c.kinds.map((k) => k.id)}
          value={kind.id}
          label={(id) => c.kinds.find((k) => k.id === id)?.label ?? id}
          onPick={(id) => setDraft((d) => ({ ...d, kind: id }))}
        />
      )}

      {c.rounding && (
        <ChipChoice
          legend="The answer"
          name={placesName}
          options={PLACE_CHOICES}
          value={draft.places}
          label={placesLabel}
          onPick={(places) =>
            setDraft((d) => {
              const next: Draft = { kind: d.kind, text: d.text }
              return places === undefined ? next : { ...next, places }
            })
          }
          data="data-own-places"
        />
      )}

      <section aria-labelledby={`${titleId}-box`} className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4">
        <h2 id={`${titleId}-box`} className="font-semibold text-navy">
          {c.kinds.length > 1 ? `${kind.label}: your problem` : `${kind.label}: type yours`}
        </h2>
        <MathInput
          value={draft.text}
          onChange={(text) => setDraft((d) => ({ ...d, text }))}
          onSubmit={() => check()}
          validate={validate}
          label="Your problem"
          submitLabel="Check it"
          placeholder={`like ${kind.example}`}
          stripKeys={ownKeysFor(c.moduleId)}
          toTex={safeLatex}
          autoFocus
        />
      </section>

      <div ref={verdictRef} aria-live="polite">
        {current?.ok && (
          <section className="space-y-3 rounded-2xl border border-ok bg-ok-100 p-4 text-navy" data-own-verdict="ok">
            <h2 className="font-semibold">
              <span aria-hidden>✓ </span>I can check this one
            </h2>
            <div className="overflow-x-auto rounded-xl bg-gold-100 px-3 py-2">
              <Katex tex={safeLatex(current.instance.statementText)} display />
            </div>
            <p>
              <OwnText parts={current.asks} />
            </p>
            <button type="button" onClick={start} className="btn-chunky min-h-12 rounded-xl bg-navy px-5 font-semibold text-white hover:bg-navy-600">
              Start
            </button>
          </section>
        )}
        {current && !current.ok && (
          <section className="space-y-2 rounded-2xl border border-gold bg-gold-100 p-4 text-navy" data-own-verdict="no" data-reason={current.reason.code}>
            <h2 className="font-semibold">I can’t check this one here</h2>
            <p>
              <OwnText parts={current.reason.parts} />
            </p>
          </section>
        )}
      </div>
    </div>
  )
}

export default OwnBuilderPage
