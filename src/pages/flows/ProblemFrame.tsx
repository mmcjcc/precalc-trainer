import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CALC_FOOTER } from '@/content/calc'
import { getModule } from '@/content/registry'
import { randomSeed } from '@/content/rng'
import type { ProblemInstance } from '@/content/types'
import { toLatex } from '@/notation'
import { useRewardsOn, useStore, type Attempt } from '@/store'
import type { TutorVerdict } from '@/shared/tutor'
import { problemPath } from '@/problem/url'
import { useReviewChrome } from '@/pages/review/chrome'
import { useSetChrome } from '@/pages/set/chrome'
import { SetDots, SetSkipMenu } from '@/components/set/SetProgress'
import { useIdleNudge } from '@/problem/useIdleNudge'
import { isStepKind, pickModule } from '@/problem/solveStyle'
import { completionWords, type Completion } from '@/problem/useAttempt'
import type { ProgressLine } from '@/problem/stepEngine'
import { useFullScreenPage } from '@/components/appChrome'
import { BottomSheet } from '@/components/BottomSheet'
import { CalcPanel } from '@/components/CalcPanel'
import { Composer } from '@/components/Composer'
import { ComposerStatus, type LineVerdict, type VerdictWhy } from '@/components/ComposerVerdict'
import { GraphPanel, RuleCardsPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { KeymapHelp } from '@/components/KeymapHelp'
import { notePress, useKeypadStore } from '@/components/keypadStore'
import { isNativeApp } from '@/components/nativeApp'
import { PageLayout, RailToolbar, type RailPanel } from '@/components/PageLayout'
import { PickLineOffer } from '@/components/LineCards'
import { FinishRewards, FinishSheet, useFinish } from '@/components/rewards/Finish'
import { StepGuide } from '@/components/StepGuide'
import { StuckProvider, type StuckApi } from '@/components/Stuck'
import { useBreakpoint } from '@/components/useBreakpoint'
import { useKeymap } from '@/components/useKeymap'
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
 * cards], mobile composer, keymap, idle nudge, completion card. On a phone (below 768 px, where the composer is
 * sticky and the rail is a row of sheets) the header is one compact row, the problem stays pinned at the top once
 * its card scrolls away, the composer shows the verdict about her line, and "Stuck?" opens the next hint. A phone
 * shows a problem full screen: no tab bar, no top navigation (the app shell decides; see components/appChrome.ts).
 * In a set (pages/SetPage.tsx) the set's progress is in the phone's header and in the completion area on a wide
 * screen, and the main button stays in the set: "Next in set", then "See results".
 */
export function ProblemFrame({ instance, attempt, flags, templateTitle, progress, hints, composer, completion, keymap, statement, graphCaption, nudgeText, tutorVerdict, graphFooter, lineVerdict, pickLine, children }: Props) {
  const navigate = useNavigate()
  const review = useReviewChrome()
  const set = useSetChrome()
  const bp = useBreakpoint()
  const phone = bp === 'mobile'
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
          open={Boolean(completion) || instance.kind === 'numberLine' || instance.kind === 'graphFeatures' || instance.kind === 'functionOps' || revealed.graph}
          note={GRAPH_NOTE[instance.kind] ?? GRAPH_NOTE.default!}
          label="Show the graph"
          onReveal={() => setRevealed((r) => ({ ...r, graph: true }))}
        >
          <GraphPanel spec={instance.graph} caption={graphCaption ?? `solution set of ${instance.statementText}`} />
          {graphFooter}
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
  // Guided mode: "Pick the next line" comes first in the hints. Taking it closes the sheet (the keypad stays down:
  // the cards take the box's place) and shows the cards for this line.
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
  // The chip, Why? and the pinned strip leave focus in her box. A sheet closes the keypad while it is up; when the
  // sheet closes, focus goes back to the box and the keypad comes back with it (as after a key press).
  const keypadReturns = useRef(false)
  const rememberKeypad = useCallback(() => {
    keypadReturns.current = useKeypadStore.getState().target !== null
  }, [])
  const bringKeypadBack = useCallback(() => {
    if (!keypadReturns.current) return
    keypadReturns.current = false
    notePress()
  }, [])
  const onOpenPanel = useCallback(
    (id: string | null) => {
      if (id === null) bringKeypadBack()
      setOpenPanel(id)
    },
    [bringKeypadBack],
  )
  // The Why? sheet keeps the lesson it opened with until she closes it (an undo can change her line under it).
  const [sheet, setSheet] = useState<{ kind: 'problem' } | { kind: 'why'; why: VerdictWhy } | null>(null)
  const closeSheet = useCallback(() => {
    bringKeypadBack()
    setSheet(null)
  }, [bringKeypadBack])

  // ---- Stuck? --------------------------------------------------------------------------------------------------
  // Opens the hint sheet; the ladder in it takes the request as a press of its button (nudge and rule only).
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
  // A request no ladder took (one that does not take requests) must not fire the next time the sheet opens.
  useEffect(() => {
    if (openPanel !== 'hints') stuckPending.current = false
  }, [openPanel])
  // Hints are open while the flow takes a hint (Ctrl+Shift+H): not once the problem is done, nor on the inequality's
  // final-answer card, where the ladder is closed.
  const hintsOpen = !completion && Boolean(keymap?.onHint)
  const stuckApi = useMemo<StuckApi>(
    // Under a wrong verdict only where there is no composer: the composer carries its own chip.
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

  // ---- the pinned problem (phone) ----------------------------------------------------------------------------
  // The review set keeps its own sticky bar at the top of the screen, so it has no strip.
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
      // The keypad is up: her place stays put and the card opens over it.
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
  // The card is what says the problem is done (there is no toast while it is on the page), so it comes into view.
  const completionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!completion) return
    const card = completionRef.current
    if (card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [completion])
  const native = isNativeApp()
  // Rewards on: a phone gets the finish sheet in the card's place (closing it leaves a small card); a wide screen
  // shows the same rewards inside the card. Rewards off: the card as it was.
  const rewardsOn = useRewardsOn()
  const stepGuideSeen = useStore((s) => s.settings.seenStepGuide === true)
  const finishData = useFinish(rewardsOn && completion ? attempt?.id : undefined, instance.skill)
  const phoneFinish = phone && finishData !== null
  const [sheetClosedFor, setSheetClosedFor] = useState<Completion | null>(null)
  const sheetOpen = phoneFinish && completion !== null && sheetClosedFor !== completion
  const nextRef = useRef<HTMLButtonElement>(null)
  const closeFinish = useCallback(() => {
    setSheetClosedFor(completion)
    // The sheet hands focus back to the box she was in, which is done now: the card's Next button takes it.
    setTimeout(() => nextRef.current?.focus({ preventScroll: false }), 0)
  }, [completion])

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
  const goNext = () => (set ? set.onNext() : review ? review.onNext() : navigate(nextHref))
  const nextLabel = set ? set.nextLabel : review ? 'Next' : 'Next problem'
  // A set's slot she can still skip: the problem she is on, not finished yet.
  const skip = set && !completion && set.status[set.index] === 'pending' ? set.onSkip : undefined
  const statementNode = statement ?? <Katex tex={toLatex(instance.statementText)} display />
  const completionTitle = completion ? (completion.summary.finalCorrect ? 'Problem complete' : 'Problem finished') : ''
  // With rewards on the streak is the goal streak (Home and the sheet show it), so the old day streak is left out.
  const completionLine = completion
    ? `${completion.summary.steps > 0 ? `${completion.summary.steps} steps · ${completion.summary.firstTry} first-try · ` : ''}${completion.summary.hints} ${completion.summary.hints === 1 ? 'hint' : 'hints'}${completion.summary.revealed > 0 ? ` · ${completion.summary.revealed} shown` : ''}${completion.summary.streak > 0 && !finishData ? ` · day streak ${completion.summary.streak}` : ''}`
    : ''
  const spoken = completion ? completionWords(completion.summary, completion.newlyMastered, templateTitle) : null
  const announcement = spoken ? `${spoken.message}. ${spoken.detail}` : ''
  const why = lineVerdict && lineVerdict.tone !== 'info' ? lineVerdict.why : undefined
  const showStepGuide = !completion && isStepKind(instance.kind) && !stepGuideSeen

  return (
    <StuckProvider value={stuckApi}>
      {/* On a phone the frame places the panel buttons itself: in the composer, or under the problem (never above it). */}
      <PageLayout rail={rail} openPanel={openPanel} onOpenPanel={onOpenPanel} mobileToolbar={phone || composerOpen ? 'none' : 'top'}>
        <div className="space-y-4">
          {phone ? (
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
                <div ref={cardRef} tabIndex={-1} className="problem-card rounded-2xl bg-gold-100 px-4 py-3 text-navy outline-none">
                  {statementNode}
                </div>
                {attempt?.mode === 'timed' && <p className="font-mono text-sm text-navy/70">test mode · {elapsed}</p>}
              </header>
              {!composerOpen && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Side panels">
                  <RailToolbar rail={rail} onOpen={setOpenPanel} />
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
                · {templateTitle}
              </p>
              <h1 className="text-2xl font-semibold text-navy">{instance.title}</h1>
              <p className="text-sm text-navy/80">{instance.instructions}</p>
              <div className="rounded-2xl bg-gold-100 px-4 py-3 text-navy">{statementNode}</div>
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
          )}

          {/* A step-by-step problem opens with how it works, until she closes the guide once. */}
          {showStepGuide && <StepGuide pick={pickModule(instance.moduleId)} />}

          {children}

          {completion && !sheetOpen && (
            <section ref={completionRef} data-completion-card="" className="space-y-3 rounded-2xl border border-ok bg-ok-100 p-4" aria-labelledby="completion-title">
              <h2 id="completion-title" className="font-semibold text-navy">
                <span aria-hidden>✓ </span>
                {completionTitle}
              </h2>
              <p className="text-sm text-navy">
                {phoneFinish && <span className="font-semibold">+{finishData.info.total} XP · </span>}
                {completionLine}
                {completion.newlyMastered && <span className="font-semibold"> · {templateTitle} newly mastered</span>}
              </p>
              {/* With rewards on, the rewards say it beside the ring. */}
              {!finishData && completion.summary.picked > 0 && (
                <p className="text-sm text-navy/80" data-picked-note="">
                  {completion.summary.picked === 1 ? 'You picked a line from cards' : `You picked ${completion.summary.picked} lines from cards`}, so this
                  problem does not count toward mastery. Type every line to count it.
                </p>
              )}
              {finishData && !phone && <FinishRewards data={finishData} templateTitle={templateTitle} />}
              {/* A wide screen shows the set's progress here; a phone has it in its header. */}
              {set && !phone && <SetDots index={set.index} total={set.total} status={set.status} prefix="Your set ·" />}
              <div className="flex flex-wrap items-center gap-2">
                <button ref={nextRef} type="button" onClick={goNext} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {nextLabel}
                </button>
                {phoneFinish && (
                  <button
                    type="button"
                    onClick={() => setSheetClosedFor(null)}
                    className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
                  >
                    See what you earned
                  </button>
                )}
                {/* Inside the phone app a link to one of its pages opens nowhere else, so it is not offered there. */}
                {!native && (
                  <button type="button" onClick={() => void copyLink()} className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50">
                    Copy link
                  </button>
                )}
                {/* In a set the way on is the set's button; leaving for the module page would leave the set. */}
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
          {completion && phoneFinish && (
            <FinishSheet
              open={sheetOpen}
              onClose={closeFinish}
              title={completionTitle}
              data={finishData}
              templateTitle={templateTitle}
              nextLabel={nextLabel}
              onNext={goNext}
            />
          )}
          {/* Says "Problem complete" to a screen reader in the toast's words, as the toast did before the card took its
              place. A plain live region (no status role), always on the page so the words are announced when they arrive. */}
          <p aria-live="polite" aria-atomic="true" className="sr-only" data-completion-announcer="">
            {announcement}
          </p>

          {composerOpen && (
            <Composer
              toolbar={phone ? <RailToolbar rail={rail} onOpen={setOpenPanel} /> : undefined}
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
              status={
                phone ? (
                  <ComposerStatus
                    verdict={lineVerdict ?? null}
                    onWhy={() => {
                      if (!why) return
                      rememberKeypad()
                      setSheet({ kind: 'why', why })
                    }}
                    onStuck={hintsOpen ? stuck : null}
                  />
                ) : undefined
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
        {pinnedOn && scrolledPast && <PinnedProblemStrip summary={summary} figure={figure} onShow={showProblem} stripRef={stripRef} />}
        <BottomSheet open={sheet?.kind === 'problem'} onClose={closeSheet} title="The problem">
          <div className="rounded-2xl bg-gold-100 px-4 py-3 text-navy">{statementNode}</div>
        </BottomSheet>
        <BottomSheet open={sheet?.kind === 'why'} onClose={closeSheet} title={sheet?.kind === 'why' ? sheet.why.title : ''}>
          {sheet?.kind === 'why' && sheet.why.body}
        </BottomSheet>
        <KeymapHelp open={help} onClose={() => setHelp(false)} omit={omitHelp.length ? omitHelp : undefined} />
      </PageLayout>
    </StuckProvider>
  )
}
