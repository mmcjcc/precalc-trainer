import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getModule, hasModule } from '@/content'
import { buildOwnProblem, ownConstructor, type OwnConstructor, type OwnKind, type OwnPart, type OwnResult } from '@/content/own'
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
  /** Check the text at once (a route whose problem could not be opened: say why). */
  check?: boolean
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
 * "Check my own problem" (route `/own/:moduleId`): she picks the kind of problem when the module has more than one,
 * types hers on the module's own keypad (the keyboard on a computer) with a live KaTeX preview, and "Check it" says
 * either what she will be asked, with Start, or why not in one plain sentence. Start opens her problem on its own
 * route (`/own/<module>/<template>/<statement>`). The box keeps her text on this device, so Back finds it.
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

function Builder({ c }: { c: OwnConstructor }) {
  const navigate = useNavigate()
  const location = useLocation()
  const mod = getModule(c.moduleId)
  const opened = (location.state ?? null) as OwnBuilderState | null
  const [draft, setDraft] = useState(() => {
    const saved = loadOwnDraft(c.moduleId)
    const known = (k: string | undefined) => (k && c.kinds.some((kind) => kind.id === k) ? k : undefined)
    const kind = known(opened?.kind) ?? known(saved?.kind) ?? c.kinds[0]!.id
    if (opened?.fresh) return { kind, text: '' }
    if (opened?.text !== undefined) return { kind, text: opened.text }
    return { kind, text: saved?.text ?? '' }
  })
  const kind = c.kinds.find((k) => k.id === draft.kind) ?? c.kinds[0]!
  const [result, setResult] = useState<{ text: string; kind: string; r: OwnResult } | null>(null)
  const verdictRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const kindName = useId()

  useEffect(() => {
    saveOwnDraft(c.moduleId, draft)
  }, [c.moduleId, draft])

  const check = useCallback(
    (text = draft.text, kindId = draft.kind) => {
      const r = buildOwnProblem(c.moduleId, kindId, text)
      setResult({ text, kind: kindId, r })
      setTimeout(() => {
        const el = verdictRef.current
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }, 0)
    },
    [c.moduleId, draft.text, draft.kind],
  )

  // A problem link that could not be opened comes here with its text: say why at once.
  const checkedOnOpen = useRef(false)
  useEffect(() => {
    if (checkedOnOpen.current || !opened?.check) return
    checkedOnOpen.current = true
    check()
  }, [opened, check])

  // The verdict is for the text and kind it was given on; a change puts it away.
  const current = result && result.text === draft.text && result.kind === draft.kind ? result.r : null
  const validate = useMemo(() => validatorFor(kind), [kind])

  function start() {
    if (!current?.ok) return
    const p = current.instance
    navigate(ownProblemPath(c.moduleId, p.templateId, p.own ?? draft.text))
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
        <fieldset className="min-w-0">
          <legend className="text-sm font-semibold text-navy">What kind of problem is it?</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {c.kinds.map((k) => {
              const checked = k.id === kind.id
              return (
                <label
                  key={k.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold ${
                    checked ? 'border-navy bg-navy text-white' : 'border-navy-100 bg-white text-navy hover:bg-navy-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={kindName}
                    value={k.id}
                    checked={checked}
                    onChange={() => setDraft((d) => ({ ...d, kind: k.id }))}
                    className="sr-only"
                  />
                  {checked && <span aria-hidden>✓</span>}
                  {k.label}
                </label>
              )
            })}
          </div>
        </fieldset>
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
            <button
              ref={startRef}
              type="button"
              onClick={start}
              className="btn-chunky min-h-12 rounded-xl bg-navy px-5 font-semibold text-white hover:bg-navy-600"
            >
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
