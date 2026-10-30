import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CALC_FOOTER } from '@/content/calc'
import { getModule } from '@/content/registry'
import { randomSeed } from '@/content/rng'
import type { ProblemInstance } from '@/content/types'
import { toLatex } from '@/notation'
import { useEvents, useRewardsOn, useStore, type Attempt } from '@/store'
import { comboOf, comboScope, COMBO_SHOWS_AT } from '@/session/combo'
import { ComboPill } from '@/components/juice/ComboPill'
import { burstConfetti } from '@/components/juice/Confetti'
import type { TutorVerdict } from '@/shared/tutor'
import { problemPath } from '@/problem/url'
import { ownBuilderPath, ownProblemPath } from '@/problem/ownUrl'
import { useReviewChrome } from '@/pages/review/chrome'
import { useSetChrome } from '@/pages/set/chrome'
import { SetDots, SetSkipMenu } from '@/components/set/SetProgress'
import { useIdleNudge } from '@/problem/useIdleNudge'
import { isStepKind, pickModule } from '@/problem/solveStyle'
import { completionWords, type Completion } from '@/problem/useAttempt'
import type { ProgressLine } from '@/problem/stepEngine'
import { useFullScreenPage } from '@/components/appChrome'
import { GraphItButton } from '@/components/grapher/GraphItButton'
import { graphItFromStatement } from '@/grapher/graphIt'
import { BottomSheet } from '@/components/BottomSheet'
import { CalcPanel } from '@/components/CalcPanel'
import { Composer, ComposerExtra } from '@/components/Composer'
import { ComposerStatus, type LineVerdict, type VerdictWhy } from '@/components/ComposerVerdict'
import { GraphPanel, RuleCardsPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { KeymapHelp } from '@/components/KeymapHelp'
import { ScratchPad } from '@/components/scratch/ScratchPad'
import { WorkedExample } from '@/components/WorkedExample'
import { notePress, useKeypadStore } from '@/components/keypadStore'
import { isNativeApp } from '@/components/nativeApp'
import { PageLayout, RailToolbar, type RailPanel } from '@/components/PageLayout'
import { PickLineOffer } from '@/components/LineCards'
import { FinishSheet, useFinish } from '@/components/rewards/Finish'
import { SquashMoment, useSquashedBy } from '@/components/monsters/SquashMoment'
import { StepGuide } from '@/components/StepGuide'
import { StuckProvider, type StuckApi } from '@/components/Stuck'
import { useBreakpoint, useLayout } from '@/components/useBreakpoint'
import { useKeymap } from '@/components/useKeymap'
import { offersExample, recordExampleViewed } from '@/problem/workedExample'
import { TutorAskPanel } from '@/tutor/TutorPanel'
import { dropFinishedThreads, markThreadFinished } from '@/tutor/threadStorage'
import { useTutorStatus } from '@/tutor/useTutorStatus'
import { PhoneHeader } from './PhoneHeader'
import { PinnedProblemStrip, pinnedSummary, useScrolledPast } from './PinnedProblem'
import { revealVerdictAboveKeypad, VERDICT_REVEAL_MS } from './verdictReveal'

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
  /** Text under the graph, inside the reveal gate (key points, which give a point question away). */
  graphFooter?: ReactNode
  /**
   * A composer flow's verdict about her latest line. On a phone the composer shows it right above her input
   * (the work list, where the full card is, sits behind the composer and the keypad there).
   */
  lineVerdict?: LineVerdict | null
  /**
   * Guided mode, while she types a line that has cards: the hints offer "Pick the next line" first (so Stuck? does),
   * and this shows the cards for that one line. Null or absent: not offered (no cards, or she is picking already).
   */
  pickLine?: (() => void) | null
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
  transformations: 'The graph draws f and g, so it shows the transformations. Work them out first, then check.',
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

/** A figure or a graph in the problem card (every figure in the app is an img role: GeoFigure, graphs, number lines). */
function holdsFigure(card: HTMLElement | null): boolean {
  return card?.querySelector('[role="img"], img, canvas') != null
}

/**
 * Shared problem-page chrome: header, progress line, rail [Hints, Graph it, Calculator, Rule
 * cards], the scratch pad, the worked example, the composer, keymap, idle nudge, completion card. The layout
 * (components/PageLayout.tsx) places them; the flow inside never knows the screen size.
 */
export function ProblemFrame({ instance, attempt, flags, templateTitle, progress, hints, composer, completion, keymap, statement, graphCaption, nudgeText, tutorVerdict, graphFooter, lineVerdict, pickLine, children }: Props) {
  const navigate = useNavigate()
  const review = useReviewChrome()
  const set = useSetChrome()
  const bp = useBreakpoint()
  const phone = useLayout() === 'phone'
  useFullScreenPage()
  const mod = getModule(instance.moduleId)
  const tutor = useTutorStatus()
  const [openPanel, setOpenPanel] = useState<string | null>(null)
  const [help, setHelp] = useState(false)
  const [nudge, setNudge] = useState<string | null>(null)
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const setNudged = useStore((s) => s.setNudged)
  const composerOpen = Boolean(composer) && !completion

  useEffect(() => {
    if (!attempt?.id) return
    if (completion) markThreadFinished(attempt.id)
    else dropFinishedThreads(attempt.id)
  }, [attempt?.id, completion])

  const graphIt = useMemo(() => (completion ? null : graphItFromStatement(instance)), [instance, completion])

  // Graph and calculator steps show the answer: student-invoked, open by themselves once finished.
  const [revealed, setRevealed] = useState<{ graph: boolean; calc: boolean }>({ graph: false, calc: false })
  const hasGraph = instance.graph.kind !== 'none'
  const hasCalc = instance.calc.ti84.length > 0 || instance.calc.nspire.length > 0
  const answerPanels: RailPanel[] = [
    {
      id: 'graph',
      title: 'Graph it',
      short: 'Graph',
      content: (
        <RevealGate
          open={Boolean(completion) || instance.kind === 'numberLine' || instance.kind === 'graphFeatures' || instance.kind === 'functionOps' || revealed.graph}
          note={GRAPH_NOTE[instance.kind] ?? GRAPH_NOTE.default!}
          label="Show the graph"
          onReveal={() => setRevealed((r) => ({ ...r, graph: true }))}
        >
          <GraphPanel spec={instance.graph} caption={graphCaption ?? `solution set of ${instance.statementText}`} />
          {graphFooter}
          {graphIt && <GraphItButton request={graphIt} className="mt-2" />}
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
          <CalcPanel
            panels={instance.calc}
            expression={instance.graph.f ?? instance.statementText}
            footer={CALC_FOOTER}
            collapsible={bp === 'mobile'}
            graphIt={graphIt ? <GraphItButton request={graphIt} /> : undefined}
          />
        </RevealGate>
      ),
    },
  ]
  const tutorStatus = tutor.status?.configured ? tutor.status : null
  const offerPick = !completion && pickLine ? pickLine : null
  const takePick = useCallback(() => {
    keypadReturns.current = false
    setOpenPanel(null)
    offerPick?.()
  }, [offerPick])
  const hintsContent = offerPick ? (
    <div className="space-y-3">
      <PickLineOffer onPick={takePick} />
      {hints}
    </div>
  ) : (
    hints
  )
  const rail: RailPanel[] = [
    { id: 'hints', title: 'Hints', content: hintsContent },
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

  // ---- sheets opened from the phone's controls -----------------------------------------------------------------
  const keypadReturns = useRef(false)
  const rememberKeypad = useCallback(() => {
    keypadReturns.current = useKeypadStore.getState().target !== null
  }, [])
  const bringKeypadBack = useCallback(() => {
    if (!keypadReturns.current) return
    keypadReturns.current = false
    notePress()
  }, [])
  const noteExampleViewed = useCallback(() => {
    recordExampleViewed(instance.skill, instance.moduleId)
  }, [instance.skill, instance.moduleId])
  const onOpenPanel = useCallback(
    (id: string | null) => {
      if (id === null) bringKeypadBack()
      if (id === 'example') noteExampleViewed()
      setOpenPanel(id)
    },
    [bringKeypadBack, noteExampleViewed],
  )
  const [sheet, setSheet] = useState<{ kind: 'problem' } | { kind: 'why'; why: VerdictWhy } | null>(null)
  const closeSheet = useCallback(() => {
    bringKeypadBack()
    setSheet(null)
  }, [bringKeypadBack])

  // ---- Stuck? --------------------------------------------------------------------------------------------------
  const stuckPending = useRef(false)
  const [stuckSeq, setStuckSeq] = useState(0)
  const takeStuck = useCallback(() => {
    if (!stuckPending.current) return false
    stuckPending.current = false
    return true
  }, [])
  const stuck = useCallback(() => {
    rememberKeypad()
    stuckPending.current = true
    setStuckSeq((n) => n + 1)
    setOpenPanel('hints')
  }, [rememberKeypad])
  useEffect(() => {
    if (openPanel !== 'hints') stuckPending.current = false
  }, [openPanel])
  const hintsOpen = !completion && Boolean(keymap?.onHint)
  const stuckApi = useMemo<StuckApi>(
    () => ({ onStuck: phone && hintsOpen && !composerOpen ? stuck : null, seq: stuckSeq, take: takeStuck }),
    [phone, hintsOpen, composerOpen, stuck, stuckSeq, takeStuck],
  )

  useKeymap(
    {
      onEscape: () => {
        if (help) setHelp(false)
        else if (openPanel) setOpenPanel(null)
        else keymap?.onEscape?.()
      },
      onHint: () => {
        keymap?.onHint?.()
        if (phone) setOpenPanel('hints')
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

  // ---- the pinned problem (phone) ----------------------------------------------------------------------------
  const cardRef = useRef<HTMLDivElement>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const pinnedOn = phone && !review
  const scrolledPast = useScrolledPast(cardRef, pinnedOn)
  const summary = useMemo(() => pinnedSummary(instance.statementText, instance.vars), [instance])
  const [figure, setFigure] = useState(false)
  useEffect(() => {
    if (scrolledPast) setFigure(holdsFigure(cardRef.current))
  }, [scrolledPast])
  const showProblem = useCallback(() => {
    if (useKeypadStore.getState().target !== null) {
      rememberKeypad()
      setSheet({ kind: 'problem' })
      return
    }
    const card = cardRef.current
    if (!card) return
    if (typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'start', behavior: 'smooth' })
    card.focus({ preventScroll: true })
  }, [rememberKeypad])

  // ---- after a Check on the keypad, the verdict under a part's box comes into view (phone) ----------------------
  const checks = useKeypadStore((s) => s.checks)
  const seenChecks = useRef(checks)
  useEffect(() => {
    if (checks === seenChecks.current) return
    seenChecks.current = checks
    if (!phone) return
    const timer = setTimeout(() => revealVerdictAboveKeypad(stripRef.current), VERDICT_REVEAL_MS)
    return () => clearTimeout(timer)
  }, [checks, phone])

  // ---- completion ------------------------------------------------------------------------------------------------
  const completionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!completion) return
    const card = completionRef.current
    if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [completion])
  const native = isNativeApp()
  const rewardsOn = useRewardsOn()
  const stepGuideSeen = useStore((s) => s.settings.seenStepGuide === true)
  const finishData = useFinish(rewardsOn && completion ? attempt?.id : undefined, instance.skill)
  const squashedHere = useSquashedBy(!rewardsOn && completion ? attempt?.id : undefined)
  const sheetFinish = finishData !== null
  const [sheetClosedFor, setSheetClosedFor] = useState<Completion | null>(null)
  const sheetOpen = sheetFinish && completion !== null && sheetClosedFor !== completion
  const nextRef = useRef<HTMLButtonElement>(null)
  const closeFinish = useCallback(() => {
    setSheetClosedFor(completion)
    setTimeout(() => nextRef.current?.focus({ preventScroll: false }), 0)
  }, [completion])
  useEffect(() => {
    if (completion?.newlyMastered) burstConfetti({ count: 64 })
  }, [completion])

  // ---- the combo pill (rewards on): right lines and parts in a row, carried across a running set -------------
  const events = useEvents()
  const comboIds = set?.attemptIds
  const comboSetIndex = set?.index
  const combo = useMemo(() => {
    if (!rewardsOn || completion || !attempt) return 0
    const scope = comboScope(attempt.id, comboIds && comboSetIndex !== undefined ? { index: comboSetIndex, attemptIds: comboIds } : null)
    return comboOf(events, scope)
  }, [rewardsOn, completion, attempt, comboIds, comboSetIndex, events])
  const comboPill = combo >= COMBO_SHOWS_AT ? <ComboPill count={combo} /> : null

  const own = instance.own !== undefined
  const route = own ? ownProblemPath(instance.moduleId, instance.templateId, instance.own!, flags) : problemPath(instance.moduleId, instance.templateId, instance.seed, flags)

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${route}`
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

  const nextHref = own ? ownBuilderPath(instance.moduleId) : problemPath(instance.moduleId, instance.templateId, randomSeed(), flags)
  const goNext = () => (set ? set.onNext() : review ? review.onNext() : own ? navigate(nextHref, { state: { fresh: true } }) : navigate(nextHref))
  const nextLabel = set ? set.nextLabel : review ? 'Next' : own ? 'Check another' : 'Next problem'
  const ownBadge = own ? (
    <p className="inline-flex min-h-7 items-center rounded-full bg-gold-100 px-3 text-xs font-semibold uppercase tracking-wide text-gold-text" data-own-problem="">
      Your own problem
    </p>
  ) : null
  const skip = set && !completion && set.status[set.index] === 'pending' ? set.onSkip : undefined
  const statementNode = statement ?? <Katex tex={toLatex(instance.statementText)} display />
  const completionTitle = completion ? (completion.summary.finalCorrect ? 'Problem complete' : 'Problem finished') : ''
  const completionLine = completion
    ? `${completion.summary.steps > 0 ? `${completion.summary.steps} steps · ${completion.summary.firstTry} first-try · ` : ''}${completion.summary.hints} ${completion.summary.hints === 1 ? 'hint' : 'hints'}${completion.summary.revealed > 0 ? ` · ${completion.summary.revealed} shown` : ''}${completion.summary.streak > 0 && !finishData ? ` · day streak ${completion.summary.streak}` : ''}`
    : ''
  const spoken = completion ? completionWords(completion.summary, completion.newlyMastered, templateTitle) : null
  const announcement = spoken ? `${spoken.message}. ${spoken.detail}` : ''
  const why = lineVerdict && lineVerdict.tone !== 'info' ? lineVerdict.why : undefined
  const showStepGuide = !completion && isStepKind(instance.kind) && !stepGuideSeen

  // The scratch pad (components/scratch): one per attempt, kept on this device. The phone layout opens it as a sheet
  // from the tools row; the tablet layout as a view of the left pane, beside the tools; the desktop problem layout
  // docks it beside her work column next to Example.
  const scratchKey = attempt?.id ?? null
  const scratch = scratchKey ? <ScratchPad attemptId={scratchKey} size={phone ? 'sheet' : 'pane'} /> : null
  const testMode = useStore((s) => s.settings.testMode)
  const timedRunning = Boolean(review?.timed) || attempt?.mode === 'timed' || testMode
  const canShowExample = !timedRunning && offersExample(instance)
  const example = canShowExample ? <WorkedExample key={instance.id} instance={instance} /> : null
  const tools: RailPanel[] = [
    ...rail,
    ...(phone && scratch ? [{ id: 'scratch', title: 'Scratch pad', short: 'Scratch', content: scratch }] : []),
    ...(phone && example ? [{ id: 'example', title: 'Example — see one like it', short: 'Example', content: example }] : []),
  ]

  const nudgeBanner = nudge && (
    <div role="status" className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-gold-100 px-3 py-2 text-sm text-navy">
      <span>{nudge}</span>
      <button type="button" onClick={() => setNudge(null)} className="min-h-8 shrink-0 rounded px-2 text-navy/70 underline">
        Dismiss
      </button>
    </div>
  )

  const problem = phone ? (
    <>
      <header className="space-y-2">
        <PhoneHeader
          title={instance.title}
          instructions={instance.instructions}
          closeTo={set ? '/' : `/m/${instance.moduleId}`}
          closeLabel={set ? 'Close, back to Home. Your set is kept.' : `Close, back to ${mod.title}`}
          progress={progress}
          set={set ? { index: set.index, total: set.total, status: set.status, onSkip: skip } : undefined}
        />
        {ownBadge}
        <div ref={cardRef} tabIndex={-1} className="problem-card rounded-2xl bg-gold-100 px-4 py-3 text-navy outline-none">
          {statementNode}
        </div>
        {attempt?.mode === 'timed' && <p className="font-mono text-sm text-navy/70">test mode · {elapsed}</p>}
      </header>
      {!composerOpen && (
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Side panels">
            <RailToolbar rail={tools} onOpen={onOpenPanel} />
          </div>
        </div>
      )}
    </>
  ) : (
    <header className="space-y-1">
      {set && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-navy-100 bg-white px-4 py-2" data-set-bar="">
          <SetDots index={set.index} total={set.total} status={set.status} prefix="Your set ·" />
          {skip && <SetSkipMenu index={set.index} total={set.total} onSkip={skip} trigger="text" />}
        </div>
      )}
      <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">
        <Link to={`/m/${instance.moduleId}`} className="hover:underline">
          {mod.title}
        </Link>{' '}
        · {own ? 'Your own problem' : templateTitle}
      </p>
      <h1 className="text-2xl font-semibold text-navy">{instance.title}</h1>
      {ownBadge}
      <p className="text-sm text-navy/80">{instance.instructions}</p>
      <div className="rounded-2xl bg-gold-100 px-4 py-3 text-navy" data-problem-card="">
        {statementNode}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-navy/70" aria-live="polite">
        {progress && (
          <span>
            stage {progress.stage} of {progress.total} · {progress.label}
          </span>
        )}
        {attempt?.mode === 'timed' && <span className="font-mono">test mode · {elapsed}</span>}
        {/* Keyboard shortcuts mean nothing where the pointer is a finger (a phone or a tablet). */}
        <button type="button" onClick={() => setHelp(true)} className="min-h-11 rounded px-2 underline hover:text-navy pointer-coarse:hidden">
          shortcuts (?)
        </button>
      </div>
    </header>
  )

  return (
    <StuckProvider value={stuckApi}>
      {/* On a phone the frame places the panel buttons itself: in the composer, or under the problem (never above it). */}
      <PageLayout
        rail={tools}
        openPanel={openPanel}
        onOpenPanel={onOpenPanel}
        mobileToolbar={phone || composerOpen ? 'none' : 'top'}
        scratch={phone ? undefined : (scratch ?? undefined)}
        example={phone ? undefined : (example ?? undefined)}
        onOpenExample={noteExampleViewed}
        problem={problem}
        composer={
          composerOpen && (
            <Composer
              toolbar={phone ? <RailToolbar rail={tools} onOpen={onOpenPanel} /> : undefined}
              banner={nudgeBanner}
              status={
                <>
                  {comboPill && (
                    <ComposerExtra>
                      <div className="mb-1.5 flex justify-end" data-combo-row="">
                        {comboPill}
                      </div>
                    </ComposerExtra>
                  )}
                  {phone && (
                    <ComposerStatus
                      verdict={lineVerdict ?? null}
                      onWhy={() => {
                        if (!why) return
                        rememberKeypad()
                        setSheet({ kind: 'why', why })
                      }}
                      onStuck={hintsOpen ? stuck : null}
                      nudge={nudge}
                      combo={comboPill ? combo : 0}
                    />
                  )}
                </>
              }
            >
              {composer}
            </Composer>
          )
        }
        after={
          !composer && nudge && !completion ? (
            <div role="status" className="flex items-center justify-between gap-2 rounded-xl bg-gold-100 px-3 py-2 text-sm text-navy">
              <span>{nudge}</span>
              <button type="button" onClick={() => setNudge(null)} className="min-h-8 shrink-0 rounded px-2 text-navy/70 underline">
                Dismiss
              </button>
            </div>
          ) : null
        }
        overlays={
          <>
            {pinnedOn && scrolledPast && <PinnedProblemStrip summary={summary} figure={figure} onShow={showProblem} stripRef={stripRef} />}
            <BottomSheet open={sheet?.kind === 'problem'} onClose={closeSheet} title="The problem">
              <div className="rounded-2xl bg-gold-100 px-4 py-3 text-navy">{statementNode}</div>
            </BottomSheet>
            <BottomSheet open={sheet?.kind === 'why'} onClose={closeSheet} title={sheet?.kind === 'why' ? sheet.why.title : ''}>
              {sheet?.kind === 'why' && sheet.why.body}
            </BottomSheet>
            <KeymapHelp open={help} onClose={() => setHelp(false)} omit={omitHelp.length ? omitHelp : undefined} />
          </>
        }
      >
        {showStepGuide && <StepGuide pick={pickModule(instance.moduleId)} />}

        {children}

        {!composerOpen && comboPill && (
          <div className="combo-dock" data-combo-row="">
            {comboPill}
          </div>
        )}

        {completion && !sheetOpen && (
          <section ref={completionRef} data-completion-card="" className="space-y-3 rounded-2xl border border-ok bg-ok-100 p-4" aria-labelledby="completion-title">
            <h2 id="completion-title" className="font-semibold text-navy">
              <span aria-hidden>✓ </span>
              {completionTitle}
            </h2>
            <p className="text-sm text-navy">
              {sheetFinish && <span className="font-semibold">+{finishData.info.total} XP · </span>}
              {completionLine}
              {completion.newlyMastered && <span className="font-semibold"> · {templateTitle} newly mastered</span>}
            </p>
            {!finishData && completion.summary.picked > 0 && (
              <p className="text-sm text-navy/80" data-picked-note="">
                {completion.summary.picked === 1 ? 'You picked a line from cards' : `You picked ${completion.summary.picked} lines from cards`}, so this
                problem does not count toward mastery. Type every line to count it.
              </p>
            )}
            {!finishData && completion.summary.own && (
              <p className="text-sm text-navy/80" data-own-note="">
                This was your own problem, so it does not count toward mastery.
              </p>
            )}
            {!finishData && <SquashMoment patterns={squashedHere} />}
            {set && !phone && <SetDots index={set.index} total={set.total} status={set.status} prefix="Your set ·" />}
            <div className="flex flex-wrap items-center gap-2">
              <button ref={nextRef} type="button" onClick={goNext} className="btn-chunky min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                {nextLabel}
              </button>
              {sheetFinish && (
                <button
                  type="button"
                  onClick={() => setSheetClosedFor(null)}
                  className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
                >
                  See what you earned
                </button>
              )}
              {!native && (
                <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50">
                  Copy link
                </button>
              )}
              {!set && (
                <Link to={`/m/${instance.moduleId}`} className="min-h-11 rounded-xl px-3 py-2.5 font-semibold text-navy underline">
                  Back to {mod.title}
                </Link>
              )}
              {finishData && (
                <Link to="/" className="min-h-11 rounded-xl px-3 py-2.5 font-semibold text-navy underline">
                  Done for today
                </Link>
              )}
              {!native && (
                <span role="status" className="text-sm text-navy/70">
                  {copied === 'ok' ? 'Link copied' : copied === 'fail' ? 'Could not copy — copy the address bar' : ''}
                </span>
              )}
            </div>
          </section>
        )}
        {completion && sheetFinish && (
          <FinishSheet
            open={sheetOpen}
            onClose={closeFinish}
            title={completionTitle}
            data={finishData}
            templateTitle={templateTitle}
            nextLabel={nextLabel}
            onNext={goNext}
            inSet={Boolean(set)}
          />
        )}
        <p aria-live="polite" aria-atomic="true" className="sr-only" data-completion-announcer="">
          {announcement}
        </p>
      </PageLayout>
    </StuckProvider>
  )
}
