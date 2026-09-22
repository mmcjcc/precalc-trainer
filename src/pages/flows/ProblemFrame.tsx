import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CALC_FOOTER } from '@/content/calc'
import { getModule } from '@/content/registry'
import { randomSeed } from '@/content/rng'
import type { ProblemInstance } from '@/content/types'
import { toLatex } from '@/notation'
import { useStore, type Attempt } from '@/store'
import type { TutorVerdict } from '@/shared/tutor'
import { problemPath } from '@/problem/url'
import { useIdleNudge } from '@/problem/useIdleNudge'
import type { Completion } from '@/problem/useAttempt'
import type { ProgressLine } from '@/problem/stepEngine'
import { CalcPanel } from '@/components/CalcPanel'
import { Composer } from '@/components/Composer'
import { GraphPanel, RuleCardsPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { KeymapHelp } from '@/components/KeymapHelp'
import { PageLayout, RailToolbar, type RailPanel } from '@/components/PageLayout'
import { useBreakpoint } from '@/components/useBreakpoint'
import { useKeymap } from '@/components/useKeymap'
import { TutorAskPanel } from '@/tutor/TutorPanel'
import { dropFinishedThreads, markThreadFinished } from '@/tutor/threadStorage'
import { useTutorStatus } from '@/tutor/useTutorStatus'

export interface FrameKeymap {
  onHint?: () => void
  onUndo?: () => void
  onDigit?: (n: number) => void
  chipsActive?: boolean
  /** Escape with nothing else open (chip prompt skip, etc.). */
  onEscape?: () => void
}

type Props = {
  instance: ProblemInstance
  attempt: Attempt | null
  flags: string
  templateTitle: string
  progress?: ProgressLine | null
  /** Hints panel content. */
  hints: ReactNode
  /** Step input (mobile: sticky composer). */
  composer?: ReactNode
  completion: Completion | null
  keymap?: FrameKeymap
  /** Replaces the rendered statement in the gold box (number line: the picture IS the question). */
  statement?: ReactNode
  /** Accessible caption for the rail graph (defaults to the statement text). */
  graphCaption?: string
  /**
   * Idle-nudge text for the current phase (verdict, check-it, …). Default: steps to go and the hint
   * button, or — once `progress.solved` — the final-answer card (hints are closed then).
   */
  nudgeText?: string
  /** The checker's latest verdict, when the flow is showing one. */
  tutorVerdict?: TutorVerdict | null
  children: ReactNode
}

/** Idle nudge on the final-answer card: the hint button is disabled there, so do not point at it. */
export const FINAL_ANSWER_NUDGE = 'Still here? Write the solution set both ways below.'

const GRAPH_NOTE: Record<string, string> = {
  inequality: 'The graph shades the solution set, so it shows the answer. Solve first, then use it to check.',
  inverse: 'The graph draws f and its mirror across y = x, so it shows the answer. Work it out first, then check.',
  evenOdd: 'The graph shows the symmetry, so it gives the verdict away. Write your evidence first, then check.',
  diffQuotient: 'The graph draws a secant line and works out its slope, so it gives numbers away. Simplify first, then check.',
  domainRange: 'The graph of f shows where it exists and which heights it reaches, so it gives the answer away. Work it out first, then check.',
  composition: 'The graph draws the function, so it can give the answer away. Work it out first, then check.',
  default: 'The graph shows the answer. Try the problem first, then use it to check.',
}

/** Hides spoiler content behind a button until the student asks for it. */
function RevealGate({ open, note, label, onReveal, children }: { open: boolean; note: string; label: string; onReveal: () => void; children: ReactNode }) {
  if (open) return <>{children}</>
  return (
    <div className="space-y-2">
      <p className="text-sm text-navy/70">{note}</p>
      <button
        type="button"
        onClick={onReveal}
        className="min-h-11 rounded-lg border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50"
      >
        {label}
      </button>
    </div>
  )
}

function useElapsed(startedAt: string | undefined, running: boolean): string {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])
  if (!startedAt) return '0:00'
  const secs = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}

/**
 * Shared problem-page chrome: header, progress line, rail [Hints, Graph it, Calculator, Rule
 * cards], mobile composer, keymap, idle nudge, completion card.
 */
export function ProblemFrame({ instance, attempt, flags, templateTitle, progress, hints, composer, completion, keymap, statement, graphCaption, nudgeText, tutorVerdict, children }: Props) {
  const navigate = useNavigate()
  const bp = useBreakpoint()
  const mod = getModule(instance.moduleId)
  const tutor = useTutorStatus()
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const [nudge, setNudge] = useState<string | null>(null)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const setNudged = useStore((s) => s.setNudged)

  useEffect(() => {
    if (!attempt?.id) return
    if (completion) markThreadFinished(attempt.id)
    else dropFinishedThreads(attempt.id)
  }, [attempt?.id, completion])

  // Graph and calculator steps show the answer: student-invoked, open by themselves once finished.
  const [revealed, setRevealed] = useState<{ graph: boolean; calc: boolean }>({ graph: false, calc: false })
  // A panel with nothing in it is left out entirely: no rail section, no toolbar button, no reveal
  // gate, no shortcut, no cheat-sheet row. Significant figures have neither; the difference quotient
  // has a graph but no calculator steps.
  const hasGraph = instance.graph.kind !== 'none'
  const hasCalc = instance.calc.ti84.length > 0 || instance.calc.nspire.length > 0
  const answerPanels: RailPanel[] = [
    {
      id: 'graph',
      title: 'Graph it',
      short: 'Graph',
      content: (
        <RevealGate
          open={Boolean(completion) || instance.kind === 'numberLine' || instance.kind === 'graphFeatures' || revealed.graph}
          note={GRAPH_NOTE[instance.kind] ?? GRAPH_NOTE.default!}
          label="Show the graph"
          onReveal={() => setRevealed((r) => ({ ...r, graph: true }))}
        >
          <GraphPanel spec={instance.graph} caption={graphCaption ?? `solution set of ${instance.statementText}`} />
        </RevealGate>
      ),
    },
    {
      id: 'calc',
      title: 'Calculator',
      short: 'Calc',
      content: (
        <RevealGate
          open={Boolean(completion) || revealed.calc}
          note="These steps check the answer on your calculator, so they give it away. Open them when you are ready to check your work."
          label="Show calculator steps"
          onReveal={() => setRevealed((r) => ({ ...r, calc: true }))}
        >
          <CalcPanel panels={instance.calc} expression={instance.graph.f ?? instance.statementText} footer={CALC_FOOTER} collapsible={bp === 'mobile'} />
        </RevealGate>
      ),
    },
  ]
  const tutorStatus = tutor.status?.configured ? tutor.status : null
  const rail: RailPanel[] = [
    { id: 'hints', title: 'Hints', content: hints },
    ...answerPanels.filter((p) => (p.id === 'graph' ? hasGraph : hasCalc)),
    { id: 'rules', title: 'Rule cards', short: 'Rules', content: <RuleCardsPanel cards={mod.ruleCards} /> },
    ...(tutorStatus
      ? [
          {
            id: 'ask',
            title: 'Ask',
            content: (
              <TutorAskPanel
                instance={instance}
                attempt={attempt}
                verdict={tutorVerdict}
                finished={Boolean(completion)}
                status={tutorStatus}
              />
            ),
          },
        ]
      : []),
  ]
  const omitHelp = [...(hasGraph ? [] : (['graph'] as const)), ...(hasCalc ? [] : (['calc'] as const))]

  const toggle = useCallback((id: string) => setOpenPanel((cur) => (cur === id ? null : id)), [])

  useKeymap(
    {
      onEscape: () => {
        if (help) setHelp(false)
        else if (openPanel) setOpenPanel(null)
        else keymap?.onEscape?.()
      },
      onHint: () => {
        keymap?.onHint?.()
        if (bp !== 'desktop') setOpenPanel('hints')
      },
      onGraph: hasGraph ? () => toggle('graph') : undefined,
      onCalc: hasCalc ? () => toggle('calc') : undefined,
      onUndo: keymap?.onUndo,
      onDigit: keymap?.onDigit,
      onHelp: () => setHelp((h) => !h),
    },
    { chipsActive: Boolean(keymap?.chipsActive), enabled: !completion },
  )

  const stepsToGo = progress ? Math.max(0, progress.total - progress.stage) : null
  // Nudge only: the attempt's active seconds are counted by the Problem page (useActiveClock).
  useIdleNudge({
    active: Boolean(attempt) && !attempt?.nudged && !completion,
    onNudge: () => {
      const n = stepsToGo
      setNudge(
        nudgeText ??
          (progress?.solved
            ? FINAL_ANSWER_NUDGE
            : n === null
              ? 'Still here? The hint button is right there.'
              : `Still here? ${n} ${n === 1 ? 'step' : 'steps'} to go — the hint button is right there.`),
      )
      setNudged()
    },
  })

  const elapsed = useElapsed(attempt?.startedAt, Boolean(attempt) && !completion)

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${problemPath(instance.moduleId, instance.templateId, instance.seed, flags)}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${instance.title}: ${instance.statementText}`, url })
        setCopied('ok')
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }

  const nextHref = problemPath(instance.moduleId, instance.templateId, randomSeed(), flags)

  return (
    <PageLayout rail={rail} openPanel={openPanel} onOpenPanel={setOpenPanel} mobileToolbar={composer && !completion ? 'none' : 'top'}>
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">
            <Link to={`/m/${instance.moduleId}`} className="hover:underline">
              {mod.title}
            </Link>{' '}
            · {templateTitle}
          </p>
          <h1 className="text-2xl font-semibold text-navy">{instance.title}</h1>
          <p className="text-sm text-navy/80">{instance.instructions}</p>
          <div className="rounded-2xl bg-gold-100 px-4 py-3 text-navy">
            {statement ?? <Katex tex={toLatex(instance.statementText)} display />}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy/70" aria-live="polite">
            {progress && (
              <span>
                stage {progress.stage} of {progress.total} · {progress.label}
              </span>
            )}
            {attempt?.mode === 'timed' && <span className="font-mono">test mode · {elapsed}</span>}
            <button type="button" onClick={() => setHelp(true)} className="min-h-11 rounded px-2 underline hover:text-navy">
              shortcuts (?)
            </button>
          </div>
        </header>

        {children}

        {completion && (
          <section className="space-y-3 rounded-2xl border border-ok bg-ok-100 p-4" aria-labelledby="completion-title">
            <h2 id="completion-title" className="font-semibold text-navy">
              <span aria-hidden>✓ </span>
              {completion.summary.finalCorrect ? 'Problem complete' : 'Problem finished'}
            </h2>
            <p className="text-sm text-navy">
              {completion.summary.steps > 0 && `${completion.summary.steps} steps · ${completion.summary.firstTry} first-try · `}{completion.summary.hints} {completion.summary.hints === 1 ? 'hint' : 'hints'}
              {completion.summary.revealed > 0 && ` · ${completion.summary.revealed} shown`}
              {completion.summary.streak > 0 && ` · day streak ${completion.summary.streak}`}
              {completion.newlyMastered && <span className="font-semibold"> · {templateTitle} newly mastered</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => navigate(nextHref)} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                Next problem
              </button>
              <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50">
                Copy link
              </button>
              <Link to={`/m/${instance.moduleId}`} className="min-h-11 rounded-xl px-3 py-2.5 font-semibold text-navy underline">
                Back to {mod.title}
              </Link>
              <span role="status" className="text-sm text-navy/70">
                {copied === 'ok' ? 'Link copied' : copied === 'fail' ? 'Could not copy — copy the address bar' : ''}
              </span>
            </div>
          </section>
        )}

        {composer && !completion && (
          <Composer
            toolbar={bp === 'mobile' ? <RailToolbar rail={rail} onOpen={setOpenPanel} /> : undefined}
            banner={
              nudge && (
                <div role="status" className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-gold-100 px-3 py-2 text-sm text-navy">
                  <span>{nudge}</span>
                  <button type="button" onClick={() => setNudge(null)} className="min-h-8 rounded px-2 text-navy/70 underline">
                    Dismiss
                  </button>
                </div>
              )
            }
          >
            {composer}
          </Composer>
        )}
        {!composer && nudge && !completion && (
          <div role="status" className="flex items-center justify-between gap-2 rounded-xl bg-gold-100 px-3 py-2 text-sm text-navy">
            <span>{nudge}</span>
            <button type="button" onClick={() => setNudge(null)} className="min-h-8 rounded px-2 text-navy/70 underline">
              Dismiss
            </button>
          </div>
        )}
      </div>
      <KeymapHelp open={help} onClose={() => setHelp(false)} omit={omitHelp.length ? omitHelp : undefined} />
    </PageLayout>
  )
}
