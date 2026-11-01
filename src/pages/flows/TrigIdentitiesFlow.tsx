import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { KEPT, patternVerdict, type LineVerdict } from '@/components/ComposerVerdict'
import { HintPanel, RuleCardView } from '@/components/HintPanel'
import { Katex } from '@/components/Katex'
import { GuidedStep } from '@/components/LineCards'
import { MathInput } from '@/components/MathInput'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { useStuckRequest } from '@/components/Stuck'
import { WorkedColumn } from '@/components/WorkedColumn'
import { keysWith, letterKey } from '@/components/keypadKeys'
import { insertToken, type StripKey } from '@/components/symbolStrip'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { pieces } from '@/content/modules/trig/text'
import type { TrigPartGrade } from '@/content/modules/trig/parts'
import { gradeTiPart } from '@/content/modules/trigIdentities'
import { getModule } from '@/content/registry'
import type { RuleCard, TrigIdentitiesAnswer, TrigPart } from '@/content/types'
import { patternHit } from '@/engine'
import {
  readTrigIdentityExpr,
  sameTrigExpr,
  trigIdentityNodeToLatex,
  trigIdentityToLatex,
  verifyTrigStep,
  type TrigStepResult,
} from '@/engine/trig'
import { trigIdentitiesStepContext } from '@/problem/cardSources'
import type { LineCard } from '@/problem/lineCards'
import { hintView, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromTrigPart, verdictFromTrigStep } from '@/problem/tutorContext'
import { useGuidedCards } from '@/problem/useGuidedCards'
import { useStore } from '@/store'
import { ProblemFrame } from './ProblemFrame'
import { NotAnAttemptNotice, useHintLadder, type LadderRung } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { recordTrigPartGrade } from './record'
import type { FlowProps } from './types'

const squash = (s: string) => s.replace(/\s+/g, '')

const EXPRESS_KEYS: readonly StripKey[] = [
  { label: 'θ', insert: 'θ', caret: 0, name: 'theta' },
  ...keysWith(['√']),
  { label: '²', insert: '²', caret: 0, name: 'squared' },
  { label: 'sin', insert: 'sin(θ)', caret: 0, name: 'sine of theta' },
  { label: 'cos', insert: 'cos(θ)', caret: 0, name: 'cosine of theta' },
  { label: 'tan', insert: 'tan(θ)', caret: 0, name: 'tangent of theta' },
  { label: 'csc', insert: 'csc(θ)', caret: 0, name: 'cosecant of theta' },
  { label: 'sec', insert: 'sec(θ)', caret: 0, name: 'secant of theta' },
  { label: 'cot', insert: 'cot(θ)', caret: 0, name: 'cotangent of theta' },
]

const STEP_KEYS: readonly StripKey[] = [
  letterKey('x'),
  { label: '²', insert: '²', caret: 0, name: 'squared' },
  ...keysWith(['√']),
  { label: 'sin', insert: 'sin(x)', caret: 0, name: 'sine of x' },
  { label: 'cos', insert: 'cos(x)', caret: 0, name: 'cosine of x' },
  { label: 'tan', insert: 'tan(x)', caret: 0, name: 'tangent of x' },
  { label: 'csc', insert: 'csc(x)', caret: 0, name: 'cosecant of x' },
  { label: 'sec', insert: 'sec(x)', caret: 0, name: 'secant of x' },
  { label: 'cot', insert: 'cot(x)', caret: 0, name: 'cotangent of x' },
]

function TexText({ text }: { text: string }) {
  return (
    <>
      {pieces(text).map((p, i) => (p.tex ? <Katex key={i} tex={p.text} /> : <span key={i}>{p.text}</span>))}
    </>
  )
}

function GradeNote({ grade }: { grade: TrigPartGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  }
  return <SigFigRejection message={grade.message} patterns={[]} />
}

const HINT_LABEL: Record<LadderRung, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

function ExpressHintLadder({
  rung,
  nudge,
  card,
  related,
  explanation,
  onAdvance,
  disabled,
}: {
  rung: LadderRung
  nudge: string
  card: RuleCard | null
  related: RuleCard[]
  explanation: readonly string[]
  onAdvance: () => void
  disabled: boolean
}) {
  const exhausted = rung === 3
  useStuckRequest(rung, onAdvance, disabled || exhausted)
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">
        Hints never appear on their own.<span className="pointer-coarse:hidden"> Ctrl+Shift+H steps through them.</span>
      </p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || exhausted}
        className="min-h-11 w-full rounded-xl bg-gold px-3 font-semibold text-navy hover:bg-gold/80 disabled:opacity-50"
      >
        {HINT_LABEL[rung]}
        {rung === 2 && <span className="ml-1 text-xs font-normal text-gold-text">(marks the answer as shown)</span>}
      </button>
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">
            <TexText text={nudge} />
          </p>
        </div>
      )}
      {rung >= 2 && card && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">Rule</p>
          <RuleCardView card={card} />
          {related.length > 0 && (
            <details className="mt-2 rounded-xl border border-navy-100 bg-white p-2">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-navy">
                Related {related.length === 1 ? 'rule' : 'rules'} ({related.length})
              </summary>
              <div className="mt-2 space-y-2">
                {related.map((c) => (
                  <RuleCardView key={c.id} card={c} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {rung >= 3 && <WorkedLines lines={explanation} title="Worked explanation" />}
    </div>
  )
}

function WorkedLines({ lines, title }: { lines: readonly string[]; title: string }) {
  if (lines.length === 0) return null
  return (
    <section className="rounded-2xl border border-navy-100 bg-navy-50 p-3 text-navy" aria-label={title}>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">{title}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
        {lines.map((s, i) => (
          <li key={i} data-worked-line="">
            <TexText text={s} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function StageCard({
  index,
  total,
  part,
  passed,
  children,
}: {
  index: number
  total: number
  part: TrigPart
  passed: boolean
  children: ReactNode
}) {
  const titleId = `ti-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      <h2 id={titleId} className="font-semibold text-navy">
        {total > 1 ? `Part ${index + 1} of ${total}: ${part.label}` : part.label}
      </h2>
      <p className="text-sm text-navy">
        <TexText text={part.ask} />
      </p>
      {children}
      {passed && (
        <p role="status" className="text-sm font-semibold text-navy">
          <span aria-hidden>✓ </span>
          Right.
        </p>
      )}
    </section>
  )
}

function expressPreviewTex(value: string): string {
  if (!value.trim()) return ''
  const r = readTrigIdentityExpr(value, { variable: 'θ' })
  if (!r.ok) return ''
  return trigIdentityNodeToLatex(r.node)
}

export function TrigIdentitiesFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'trigIdentities') {
    return <p className="text-navy">This problem has no trig identity to work with — pick another from the module page.</p>
  }
  if (answer.question === 'express') {
    return <ExpressBody {...props} answer={answer} />
  }
  return <StepBody {...props} answer={answer} />
}

// ---------------------------------------------------------------------------
// 1. ti.express (PARTS)
// ---------------------------------------------------------------------------

function ExpressBody({
  instance,
  attempt,
  flags,
  templateTitle,
  completion,
  finish,
  answer,
}: FlowProps & { answer: TrigIdentitiesAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Record<string, string>>(() => ({ ...attempt?.final?.polyEntries }))
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<{ stage: number; grade: TrigPartGrade } | null>(null)
  const lastChecked = useRef<string | null>(null)
  const boxes = useRef(new Map<string, HTMLInputElement>())
  const stage = stages[passed]!
  const hint = useHintLadder(attempt, done, passed)
  const keypadOn = useMathKeypadOn()

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    lastChecked.current = null
    setFeedback(null)
    setEntries({ ...attempt.final?.polyEntries })
    setPassed(Math.min(attempt.final?.polyStage ?? 0, last))
  }, [attempt, last])

  const register = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      if (el) boxes.current.set(key, el)
      else boxes.current.delete(key)
    },
    [],
  )

  const focusBox = useCallback((key: string) => {
    boxes.current.get(key)?.focus({ preventScroll: true })
  }, [])

  const opened = useRef(passed)
  useEffect(() => {
    if (opened.current === passed) return
    opened.current = passed
    focusBox(stages[passed]!.id)
  }, [passed, stages, focusBox])

  function store(next: Record<string, string>) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  function insert(key: string, strip: StripKey) {
    const el = boxes.current.get(key)
    const value = entries[key] ?? ''
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = insertToken(value, start, end, strip)
    update(key, next.value)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = entries[stage.id] ?? ''
    const g = gradeTiPart(answer, stage.id, text)
    setFeedback({ stage: passed, grade: g })
    if (g.verdict === 'invalid') {
      focusBox(stage.id)
      return
    }
    const sig = `${attempt?.id ?? ''} ${passed} ${squash(text)}`
    if (lastChecked.current === sig) return
    lastChecked.current = sig
    recordTrigPartGrade(g)
    const s = useStore.getState()
    if (g.verdict !== 'correct') {
      s.setFinal({ firstCorrect: false })
      return
    }
    if (passed === last) {
      finish()
      return
    }
    s.setFinal({ polyStage: passed + 1 })
    setPassed(passed + 1)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    check()
  }

  const shown = feedback && feedback.stage === passed ? feedback : null
  const invalid = shown?.grade.verdict === 'invalid'
  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = stage.ruleCard
    const others = answer.ruleCards
      .filter((id) => id !== firstId)
      .map((id) => byId.get(id))
      .filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? 'all parts checked' : stage.label,
    solved: done,
    offPath: false,
  }

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={shown ? verdictFromTrigPart(shown.grade, entries[stage.id] ?? '') : undefined}
      nudgeText="Still here? The open part is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={
        <div className="space-y-2">
          <p className="text-navy">
            <TexText text={answer.prompt} />
          </p>
        </div>
      }
      hints={
        <ExpressHintLadder
          rung={hint.rung}
          nudge={stage.nudge}
          card={card}
          related={related}
          explanation={stage.reveal}
          onAdvance={hint.advance}
          disabled={done}
        />
      }
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const value = entries[s.id] ?? ''
        const preview = open && s.kind !== 'choice' ? expressPreviewTex(value) : ''
        return (
          <StageCard key={s.id} index={i} total={stages.length} part={s} passed={!open && stages.length > 1}>
            {s.kind === 'choice' ? (
              open ? (
                <form onSubmit={submit} noValidate className="space-y-4">
                  <PolyChoice
                    legend={s.label}
                    name={`ti-${s.id}`}
                    options={s.choices ?? []}
                    value={value}
                    disabled={false}
                    onChange={(v) => update(s.id, v)}
                    firstRef={register(s.id)}
                  />
                  <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                    Check
                  </button>
                  {shown && <GradeNote grade={shown.grade} />}
                </form>
              ) : (
                <PolyChoice legend={s.label} name={`ti-${s.id}`} options={s.choices ?? []} value={value} disabled onChange={() => {}} />
              )
            ) : open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {preview && (
                  <div aria-label="Preview" className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
                    <Katex tex={preview} />
                  </div>
                )}
                <PolyTextBox
                  id={`ti-${s.id}`}
                  label={s.label}
                  hint={s.formatHint}
                  placeholder=""
                  value={value}
                  disabled={false}
                  invalid={Boolean(invalid)}
                  onChange={(v) => update(s.id, v)}
                  inputRef={register(s.id)}
                  keypad={{ keys: EXPRESS_KEYS }}
                />
                {!keypadOn && <SymbolStrip onInsert={(k) => insert(s.id, k)} keys={EXPRESS_KEYS} disabled={false} />}
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                    Check
                  </button>
                </div>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : (
              <PolyTextBox id={`ti-${s.id}`} label={s.label} hint={s.formatHint} placeholder="" value={value} disabled invalid={false} onChange={() => {}} />
            )}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="ti-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="ti-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <WorkedLines lines={answer.reveal} title="How it works out" />
        </section>
      )}
    </ProblemFrame>
  )
}

// ---------------------------------------------------------------------------
// 2 & 3. ti.simplify and ti.verify (STEP BY STEP)
// ---------------------------------------------------------------------------

type StepFeedback =
  | { kind: 'blocked'; message: string }
  | { kind: 'rejected'; result: TrigStepResult; picked?: string }
  | { kind: 'same' }
  | { kind: 'kept'; message: string }

function StepBody({
  instance,
  attempt,
  flags,
  templateTitle,
  completion,
  finish,
  answer,
}: FlowProps & { answer: TrigIdentitiesAnswer }) {
  const done = Boolean(completion)
  const steps = useMemo(() => attempt?.steps ?? [], [attempt])
  const start = instance.start ?? answer.expr
  const [draft, setDraftState] = useState(() => attempt?.draft ?? '')
  const [feedback, setFeedback] = useState<StepFeedback | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const lastRejected = useRef<string | null>(null)

  const lastText = steps.length ? steps[steps.length - 1]!.text : null
  const previous = lastText ?? start
  const solved = useMemo(() => {
    if (!lastText) return false
    return getModule(instance.moduleId).solved?.(instance, lastText) ?? false
  }, [lastText, instance])

  const hintKey = steps.length
  const hint = useHintLadder(attempt, done || solved, hintKey)
  const view = useMemo(() => hintView(instance, lastText ?? start, false, null, solved), [instance, lastText, start, solved])

  const live = !done && !solved && attempt !== null
  const nextText = view.next?.text ?? null
  const guided = useGuidedCards({ instance, attempt, previous, live, nextText })
  const { offers, showingCards, cards, cardsLeft, lineKey, stepType, pickOffer, typedNote } = guided
  const picks = attempt?.picks?.[String(lineKey)]

  const restoredFor = useRef<string | null>(null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    const fresh = restoredFor.current !== null
    restoredFor.current = attempt.id
    if (fresh) {
      setFeedback(null)
      lastRejected.current = null
      setDraftState(attempt.draft ?? '')
      return
    }
    if (attempt.draft) setDraftState(attempt.draft)
  }, [attempt])
  useEffect(() => () => useStore.getState().flushDraft(), [])

  const finishing = useRef(false)
  useEffect(() => {
    if (!solved || done || !attempt || finishing.current) return
    finishing.current = true
    finish()
  }, [solved, done, attempt, finish])
  useEffect(() => {
    if (!solved) finishing.current = false
  }, [solved])

  const setDraft = useCallback((v: string) => {
    setDraftState(v)
    setFeedback((f) => (f && (f.kind === 'blocked' || f.kind === 'same') ? null : f))
    useStore.getState().setDraft(v)
  }, [])

  function checkLine(prev: string, next: string): TrigStepResult {
    const ctx = trigIdentitiesStepContext(instance) ?? {
      kind: answer.question === 'verify' ? 'verify' : 'simplify',
      variable: 'x',
      start,
      ...(answer.target ? { target: answer.target } : {}),
      seed: instance.seed,
    }
    return verifyTrigStep(prev, next, ctx)
  }

  const validate = useCallback((t: string) => {
    if (!t.trim()) return null
    const r = readTrigIdentityExpr(t, { variable: 'x' })
    return r.ok ? null : { message: r.message }
  }, [])

  function acceptLine(text: string, revealed: boolean, via?: 'card') {
    lastRejected.current = null
    const s = useStore.getState()
    s.acceptStep({
      text,
      latex: trigIdentityToLatex(text, 'x'),
      revealed: revealed || s.attempt?.final?.revealed === true,
      ...(via ? { via } : {}),
      ...(stepType ? { rule: stepType } : {}),
    })
    setDraftState('')
    s.setDraft('')
    if (!solved && !via) inputRef.current?.focus({ preventScroll: true })
  }

  function submitText(typed: string, via?: 'card') {
    if (done || solved || !attempt) return
    const result = checkLine(previous, typed)
    if (!result.ok && result.verdict === 'parse_error') {
      setFeedback({ kind: 'blocked', message: result.message })
      if (!via) inputRef.current?.focus({ preventScroll: true })
      return
    }
    if (!result.ok) {
      if (via) {
        useStore.getState().rejectCard({ pattern: result.pattern?.id, text: typed, key: lineKey })
        setFeedback({ kind: 'rejected', result, picked: typed })
        return
      }
      const sig = `${attempt.id} ${steps.length} ${squash(typed)}`
      if (lastRejected.current !== sig) {
        lastRejected.current = sig
        useStore.getState().rejectStep(result.pattern?.id)
      }
      setFeedback({ kind: 'rejected', result })
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
      return
    }
    const text = result.normalizedText || typed
    const finishedNow = result.done || (getModule(instance.moduleId).solved?.(instance, text) ?? false)
    if (!finishedNow && (sameTrigExpr(text, previous, 'x') || squash(text) === squash(previous))) {
      setFeedback({ kind: 'same' })
      return
    }
    acceptLine(text, false, via)
    setFeedback({ kind: 'kept', message: result.message })
  }

  function useRevealedLine() {
    const text = view.reveal
    if (!text || done || solved || !attempt) return
    const raw = checkLine(previous, text)
    if (!raw.ok) {
      setFeedback({ kind: 'rejected', result: raw })
      return
    }
    const stored = raw.normalizedText || text
    acceptLine(stored, true)
    setFeedback({ kind: 'kept', message: raw.message })
  }

  function submitLine() {
    submitText(draft.trim())
  }

  function pickCard(card: LineCard) {
    if (!live) return
    submitText(card.text, 'card')
  }

  const canUndo = !done && !solved && steps.length > 0
  const undo = useCallback(() => {
    if (!canUndo) return
    const last = useStore.getState().undoStep()
    if (!last) return
    lastRejected.current = null
    setFeedback(null)
    setDraftState(last.text)
    useStore.getState().setDraft(last.text)
    inputRef.current?.focus({ preventScroll: true })
  }, [canUndo])

  const info = getModule(instance.moduleId).progress(instance, lastText, false)
  const progress: ProgressLine = {
    stage: done ? info.total : info.stage,
    total: info.total,
    label: done ? (answer.question === 'verify' ? 'identity verified' : 'simplified') : info.label,
    solved: done,
    offPath: info.path === 'none',
  }

  const lineVerdict = feedback?.kind === 'rejected' ? verdictFromTrigStep(feedback.result, feedback.picked ?? draft) : undefined
  const composerVerdict = useMemo<LineVerdict | null>(() => {
    if (!feedback) return null
    if (feedback.kind === 'rejected') {
      return patternVerdict(feedback.result.pattern ?? null, feedback.result.message)
    }
    if (feedback.kind === 'same') {
      return { tone: 'info', text: 'That is the line above, written again. Change one thing, then check it.' }
    }
    if (feedback.kind === 'blocked') {
      return { tone: 'info', text: feedback.message }
    }
    return KEPT
  }, [feedback])

  const statementLatex =
    answer.question === 'verify'
      ? `${trigIdentityToLatex(start, 'x')} = ${trigIdentityToLatex(answer.answerText, 'x')}`
      : trigIdentityToLatex(start, 'x')

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={lineVerdict}
      lineVerdict={composerVerdict}
      nudgeText={
        showingCards
          ? 'Still here? Pick the next line from the cards. The hint button is right there.'
          : 'Still here? Type the next line of your work below. The hint button is right there.'
      }
      keymap={{ onHint: hint.advance, onUndo: undo }}
      pickLine={pickOffer}
      statement={
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <Katex tex={statementLatex} display ariaLabel={instance.statementText} />
          </div>
          <p className="text-sm text-navy">{answer.prompt}</p>
        </div>
      }
      hints={
        <HintPanel
          rung={hint.rung}
          view={view}
          onAdvance={hint.advance}
          onUseLine={useRevealedLine}
          disabled={done || solved}
        />
      }
      composer={
        !done && !solved ? (
          <GuidedStep
            offers={offers}
            guidedOn={guided.guidedOn}
            onGuideChange={guided.chooseGuide}
            showingCards={showingCards}
            lineKey={lineKey}
            cards={cardsLeft}
            onPick={pickCard}
            onType={guided.typeInstead}
            showBack={Boolean(picks?.typing && cards.length > 0)}
            onBack={guided.backToCards}
            typedNote={typedNote}
            inputRef={inputRef}
          >
            <MathInput
              value={draft}
              onChange={setDraft}
              onSubmit={submitLine}
              validate={validate}
              inputRef={inputRef}
              autoFocus
              label="Next line"
              submitLabel="Check this line"
              placeholder={`Step ${steps.length + 1}: your next line`}
              stripKeys={STEP_KEYS}
              toTex={(t) => trigIdentityToLatex(t, 'x')}
            />
          </GuidedStep>
        ) : undefined
      }
    >
      <section aria-labelledby="ti-work-title" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-3">
        <h2 id="ti-work-title" className="font-semibold text-navy">
          Your work
        </h2>
        <p className="text-xs text-navy/70">
          {answer.question === 'verify'
            ? 'Start with the left side and transform it one step at a time until your line matches the right side.'
            : 'Rewrite the expression one step at a time until it simplifies to a single trig function or a constant.'}
        </p>
        <WorkedColumn start={start} steps={steps} onUndo={undo} canUndo={canUndo} />
        {feedback?.kind === 'same' && (
          <NotAnAttemptNotice messages={['That is the line above, written again. Change one thing, then check the new line.']} />
        )}
        {feedback?.kind === 'blocked' && <NotAnAttemptNotice messages={[feedback.message]} />}
        {feedback?.kind === 'rejected' && feedback.picked && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-navy" data-picked-line="">
            <span>You picked</span>
            <Katex tex={trigIdentityToLatex(feedback.picked, 'x')} ariaLabel={feedback.picked} />
          </p>
        )}
        {feedback?.kind === 'rejected' && (
          <SigFigRejection
            message={feedback.result.message}
            patterns={feedback.result.pattern ? [feedback.result.pattern] : []}
          />
        )}
        {feedback?.kind === 'kept' && !done && (
          <p role="status" className="text-sm text-navy">
            <span aria-hidden>✓ </span>
            Kept. {feedback.message}
          </p>
        )}
      </section>

      {done && (
        <section aria-labelledby="ti-step-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="ti-step-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
