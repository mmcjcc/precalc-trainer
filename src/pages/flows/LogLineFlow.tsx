import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { KEPT, stepVerdict, type LineVerdict } from '@/components/ComposerVerdict'
import { Katex } from '@/components/Katex'
import { notePress } from '@/components/keypadStore'
import { LineCards, LineEntrySwitch } from '@/components/LineCards'
import { MathInput } from '@/components/MathInput'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { LOG_KEYS } from '@/components/symbolStrip'
import { HintPanel } from '@/components/HintPanel'
import { RejectionCard } from '@/components/RejectionCard'
import { WorkedColumn } from '@/components/WorkedColumn'
import { EE_KEYS } from '@/content/modules/expLogEquations'
import { anyShows, safeExample, safeLesson, safeWitness } from '@/content/modules/explog/text'
import { getModule } from '@/content/registry'
import type { ProblemInstance } from '@/content/types'
import { checkLogRewrite, checkLogStep, gradeLogEquation, patternHit, ERROR_PATTERNS, type LogGrade, type LogStepResult } from '@/engine'
import { expLogStepContext, lineCardsFor, offersLineCards, stepTypeOf } from '@/problem/cardSources'
import type { LineCard } from '@/problem/lineCards'
import { counterexampleLines, hintView, liveParseError, safeLatex, type HintView, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromLog, verdictFromStep } from '@/problem/tutorContext'
import type { Counterexample, PatternHit } from '@/shared/types'
import { typeThisTime, useStore, type LineEntry } from '@/store'
import { NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { recordLogGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Mode = 'properties' | 'equations'

type LineFeedback =
  | { kind: 'blocked'; message: string }
  /** `picked`: the wrong card she picked (Guided mode); absent for a typed line. */
  | { kind: 'rejected'; result: LogStepResult; picked?: string }
  | { kind: 'same' }
  | { kind: 'kept'; caveat: boolean; note: string }

const squash = (text: string) => text.replace(/\s+/g, '')

function answerForms(instance: ProblemInstance): string[] {
  const answer = instance.answer
  if (answer.type === 'logProperties') return [answer.answerText]
  if (answer.type === 'expLogEquations') {
    // Each root on its own as well: a note that names one of two roots gives half the answer away.
    const parts = answer.answerText.split(/\s+or\s+/)
    const roots = parts.length > 1 ? parts.flatMap((part) => [part, part.replace(/^\s*x\s*=\s*/, '')]) : []
    return [...new Set([answer.answerText, ...answer.accept, ...roots])]
  }
  return []
}

/** A retryable note must not contain a form that grades correct for this problem. */
function visibleStep(result: LogStepResult, forms: readonly string[]): LogStepResult {
  let pattern: PatternHit | undefined = result.pattern
  if (pattern) {
    pattern = {
      ...pattern,
      ...(pattern.witness ? { witness: safeWitness(pattern.witness, forms) } : {}),
      example: safeExample(pattern.example, forms),
      lesson: safeLesson(pattern.lesson, forms),
    }
  }
  let counterexample: Counterexample | undefined = result.counterexample
  if (counterexample) {
    const bits = [counterexample.message, counterexample.pointDisplay, ...counterexampleLines(counterexample)]
    if (anyShows(bits, forms)) {
      counterexample = {
        point: {},
        pointDisplay: '',
        oldTruth: counterexample.oldTruth,
        newTruth: counterexample.newTruth,
        message: 'That line does not say the same thing as the one before it.',
      }
    }
  }
  return { ...result, pattern, counterexample }
}

function visibleHint(view: HintView, forms: readonly string[]): HintView {
  const nudge = anyShows([view.nudge], forms) ? 'Use a log rule on this line. The card shows the same rule on different numbers.' : view.nudge
  if (!view.card) return nudge === view.nudge ? view : { ...view, nudge }
  const example = safeExample(view.card.example ?? '', forms)
  const body = anyShows([view.card.body], forms) ? 'Read the rule, then try the line again.' : view.card.body
  if (example === (view.card.example ?? '') && body === view.card.body && nudge === view.nudge) return view
  return { ...view, nudge, card: { ...view.card, body, example } }
}

function blockedMessage(result: LogStepResult, forms: readonly string[]): string {
  const raw = result.message ?? result.parseError?.message ?? 'This line could not be checked.'
  return anyShows([raw], forms) ? 'That line could not be checked as written. Change it and try again.' : raw
}

function isBlocked(result: LogStepResult): boolean {
  return !result.ok && (result.verdict === 'parse_error' || result.verdict === 'undecidable' || result.notExact === true)
}

/**
 * Expand, condense, or solve, one checked line at a time. Equations then take a final answer.
 * The third hint shows the next textbook line and marks it as shown.
 *
 * Guided mode (equations; docs/progress/phone-guided.md): with "Pick" on, each next line is picked from three cards
 * (the path's next line and two of the engine's named slips of her line); a picked card goes through the checker as
 * the same line typed would, so a wrong one shows that mistake's lesson. While she types, the hints (and so Stuck?)
 * first offer the cards for one line. A step type picked right twice is typed the next time; the answer is typed.
 */
function LogWork(props: FlowProps & { mode: Mode }) {
  const answer = props.instance.answer
  if (props.mode === 'properties' && answer.type !== 'logProperties') {
    return <p className="text-navy">This problem has no logarithm to expand or condense — pick another from the module page.</p>
  }
  if (props.mode === 'equations' && answer.type !== 'expLogEquations') {
    return <p className="text-navy">This problem has no equation to solve — pick another from the module page.</p>
  }
  return <Body {...props} />
}

export function LogPropertiesFlow(props: FlowProps) {
  return <LogWork {...props} mode="properties" />
}

export function ExpLogEquationsFlow(props: FlowProps) {
  return <LogWork {...props} mode="equations" />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, mode }: FlowProps & { mode: Mode }) {
  const answer = instance.answer as Extract<ProblemInstance['answer'], { type: 'logProperties' | 'expLogEquations' }>
  const equation = answer.type === 'expLogEquations' ? answer : null
  const done = Boolean(completion)
  const forms = useMemo(() => answerForms(instance), [instance])
  const steps = useMemo(() => attempt?.steps ?? [], [attempt])
  const start = instance.start ?? (answer.type === 'logProperties' ? answer.expr : equation?.equation ?? '')
  const [draft, setDraftState] = useState(() => attempt?.draft ?? '')
  const [feedback, setFeedback] = useState<LineFeedback | null>(null)
  const [box, setBox] = useState(() => attempt?.final?.polyEntries?.[EE_KEYS.answer] ?? '')
  const [boxGrade, setBoxGrade] = useState<LogGrade | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const answerRef = useRef<HTMLInputElement | null>(null)
  const lastRejected = useRef<string | null>(null)
  const lastBox = useRef<string | null>(null)

  const lastText = steps.length ? steps[steps.length - 1]!.text : null
  const previous = lastText ?? start
  const solved = useMemo(() => {
    if (mode !== 'properties' || !lastText) return false
    return getModule(instance.moduleId).solved?.(instance, lastText) ?? false
  }, [mode, lastText, instance])

  const hintKey = steps.length
  const hint = useHintLadder(attempt, done || solved, hintKey)
  const rawView = useMemo(() => hintView(instance, lastText ?? start, false, null, solved), [instance, lastText, start, solved])
  const view = useMemo(() => visibleHint(rawView, forms), [rawView, forms])

  // ---- Guided mode: the next line picked from cards ------------------------------------------------------------
  const offers = equation !== null && offersLineCards(instance)
  const lineEntry: LineEntry = useStore((s) => s.settings.lineEntry) === 'pick' ? 'pick' : 'type'
  const picking = offers && lineEntry === 'pick'
  const live = !done && !solved && attempt !== null
  // The line she is writing (the hint and rejection key) and its cards' state on the attempt.
  const lineKey = steps.length
  const picks = attempt?.picks?.[String(lineKey)]
  // The step type: what the path's next step does ("power_rule+take_log", cardSources.ts stepTypeOf). It keys the
  // two-right-picks rule across problems; logged on every line.
  const nextText = rawView.next?.text ?? null
  const stepType = useMemo(() => (offers && nextText !== null ? stepTypeOf(instance, previous, nextText) : null), [offers, nextText, previous, instance])
  const events = useStore((s) => s.events)
  const mustType = useMemo(() => offers && typeThisTime(events, stepType), [offers, events, stepType])
  const wantCards = offers && live && rawView.next !== null && (picks !== undefined || !mustType)
  const cards = useMemo(() => (wantCards ? lineCardsFor(instance, previous, lineKey) : []), [wantCards, instance, previous, lineKey])
  const cardsLeft = useMemo(() => cards.filter((c) => c.right || !(picks?.wrong ?? []).includes(c.text)), [cards, picks])
  // Cards on the screen: this line's cards were shown (and she did not switch to typing it), or Pick is on.
  const showingCards = cards.length > 0 && (picks ? !picks.typing : picking && !mustType)
  // Once the cards are on the screen the line counts as picked, however she enters it.
  useEffect(() => {
    if (showingCards && !picks) useStore.getState().showCards(lineKey)
  }, [showingCards, picks, lineKey])

  const restoredFor = useRef<string | null>(null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    const fresh = restoredFor.current !== null
    restoredFor.current = attempt.id
    if (fresh) {
      // A new attempt at the same problem starts clean: no verdict or remembered entry from the last one.
      setFeedback(null)
      setBoxGrade(null)
      lastBox.current = null
      lastRejected.current = null
      setDraftState(attempt.draft ?? '')
      setBox(attempt.final?.polyEntries?.[EE_KEYS.answer] ?? '')
      return
    }
    if (attempt.draft) setDraftState(attempt.draft)
    const saved = attempt.final?.polyEntries?.[EE_KEYS.answer]
    if (saved) setBox(saved)
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

  function checkLine(prev: string, next: string): LogStepResult {
    if (answer.type === 'logProperties') return checkLogRewrite(prev, next, { assumePositive: true, vars: answer.vars })
    // The context the cards are confirmed in too (cardSources.ts), so a card is judged as the same line typed.
    return checkLogStep(prev, next, expLogStepContext(instance) ?? { vars: ['x'] })
  }

  const validate = useCallback(
    (t: string) => {
      if (answer.type === 'logProperties') return liveParseError(t, answer.vars, 'expression')
      return liveParseError(t, ['x'], 'relation')
    },
    [answer],
  )

  function acceptLine(text: string, revealed: boolean, via?: 'card') {
    lastRejected.current = null
    const s = useStore.getState()
    s.acceptStep({
      text,
      latex: safeLatex(text),
      revealed: revealed || s.attempt?.final?.revealed === true,
      ...(via ? { via } : {}),
      ...(stepType ? { rule: stepType } : {}),
    })
    setDraftState('')
    s.setDraft('')
    if (!solved && !via) inputRef.current?.focus({ preventScroll: true })
  }

  /** Check a line as her next one: typed (from the box), or a card she picked (`via`). */
  function submitText(typed: string, via?: 'card') {
    if (done || solved || !attempt) return
    const raw = checkLine(previous, typed)
    if (isBlocked(raw)) {
      setFeedback({ kind: 'blocked', message: blockedMessage(raw, forms) })
      if (!via) inputRef.current?.focus({ preventScroll: true })
      return
    }
    const result = visibleStep(raw, forms)
    if (!result.ok) {
      if (via) {
        // A wrong card: its named mistake, logged as a typed slip is, and the card leaves the line.
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
    const text = result.normalized?.text || typed
    const finishedNow = mode === 'properties' && (getModule(instance.moduleId).solved?.(instance, text) ?? false)
    // Same writing, not the same function: factoring is a new line even when the two sides match.
    if (!finishedNow && (squash(text) === squash(previous) || squash(typed) === squash(previous))) {
      setFeedback({ kind: 'same' })
      return
    }
    const caveat = result.caveat === 'extraneous_check'
    acceptLine(text, false, via)
    const note = caveat ? safeWitness(result.pattern?.witness ?? ERROR_PATTERNS.log_check_answers.lesson, forms) : ''
    setFeedback({ kind: 'kept', caveat, note })
    // A line that already is the solution (ln(x) = 3 → x = e^3) goes into the answer box for her to check. Not a
    // picked one: the answer is always typed.
    if (!via && equation && !box.trim() && /^\s*x\s*=/.test(text)) {
      const g = gradeLogEquation(equation.equation, text, { vars: ['x'], ...(equation.places ? { decimal: { places: equation.places } } : {}) })
      if (g.verdict === 'correct') {
        storeBox(text)
        answerRef.current?.focus({ preventScroll: true })
      }
    }
  }

  function useRevealedLine() {
    const text = view.reveal
    if (!text || done || solved || !attempt) return
    const raw = checkLine(previous, text)
    if (!raw.ok) {
      setFeedback({ kind: 'rejected', result: visibleStep(raw, forms) })
      return
    }
    const stored = raw.normalized?.text || text
    acceptLine(stored, true)
    setFeedback({ kind: 'kept', caveat: raw.caveat === 'extraneous_check', note: '' })
  }

  function submitLine() {
    submitText(draft.trim())
  }

  function pickCard(card: LineCard) {
    if (!live) return
    submitText(card.text, 'card')
  }

  /** "Type it yourself instead": this line goes on the keypad (it comes up with the box, as after a key press). */
  const focusBoxNext = useRef(false)
  function typeInstead() {
    focusBoxNext.current = true
    useStore.getState().typeCardLine(true, lineKey)
  }
  useEffect(() => {
    if (!focusBoxNext.current || showingCards) return
    focusBoxNext.current = false
    const box = inputRef.current
    if (!box) return
    // After the box is mounted (autofocus comes before the keypad knows the box): focus that follows a press opens it.
    notePress()
    if (document.activeElement === box) box.blur()
    box.focus({ preventScroll: true })
  }, [showingCards])

  /** Type / Pick, remembered for next time. A line whose cards are out follows the switch. */
  function chooseEntry(next: LineEntry) {
    const s = useStore.getState()
    s.setSettings({ lineEntry: next })
    if (picks) s.typeCardLine(next === 'type', lineKey)
  }

  // While she types, the hints (and so Stuck?) offer the cards for this one line first.
  const pickOffer = !picking && live && cards.length > 0 && !picks ? () => useStore.getState().showCards(lineKey) : null
  // Why a line is typed where she might expect cards.
  let typedNote: string | null = null
  if (offers && live && !showingCards) {
    if (picks) typedNote = 'You saw the cards for this line, so it counts as a picked line.'
    else if (picking && mustType) typedNote = 'You picked this one right twice: type it this time.'
    else if (picking && rawView.next === null) typedNote = 'That was the last line of the path: write the solution in the answer box.'
    else if (picking) typedNote = 'No cards for this line: type it.'
  }

  function storeBox(value: string) {
    setBox(value)
    savePolyEntries({ ...(attempt?.final?.polyEntries ?? {}), [EE_KEYS.answer]: value })
    setBoxGrade((g) => (g && (g.verdict === 'invalid' || g.verdict === 'unsupported') ? null : g))
  }

  function submitAnswer(e: FormEvent) {
    e.preventDefault()
    if (done || !equation || steps.length === 0) return
    const grade = gradeLogEquation(equation.equation, box, {
      vars: ['x'],
      ...(equation.places ? { decimal: { places: equation.places } } : {}),
    })
    setBoxGrade(grade)
    if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') {
      answerRef.current?.focus({ preventScroll: true })
      return
    }
    // One record per attempt and answer: a trailing space or a reload does not count it twice.
    const sig = `${attempt?.id ?? ''} ${squash(box)}`
    if (lastBox.current === sig) {
      if (grade.verdict === 'correct') finish()
      return
    }
    lastBox.current = sig
    recordLogGrade(grade)
    if (grade.verdict !== 'correct') {
      useStore.getState().setFinal({ firstCorrect: false })
      return
    }
    finish()
  }

  const canUndo = !done && !solved && steps.length > 0
  const undo = useCallback(() => {
    if (!canUndo) return
    const last = useStore.getState().undoStep()
    if (!last) return
    lastRejected.current = null
    setFeedback(null)
    setBoxGrade(null)
    setDraftState(last.text)
    useStore.getState().setDraft(last.text)
    inputRef.current?.focus({ preventScroll: true })
  }, [canUndo])

  const info = getModule(instance.moduleId).progress(instance, lastText, false)
  const progress: ProgressLine = {
    stage: done ? info.total : info.stage,
    total: info.total,
    label: done ? (mode === 'properties' ? 'finished form' : 'answer checked') : info.label,
    solved: done,
    offPath: false,
  }
  const lineVerdict = feedback?.kind === 'rejected' ? verdictFromStep(feedback.result, feedback.picked ?? draft) : undefined
  const boxVerdict = boxGrade ? verdictFromLog(boxGrade, box) : undefined
  // The same feedback in the phone composer, one line above her input.
  const composerVerdict = useMemo<LineVerdict | null>(() => {
    if (!feedback) return null
    if (feedback.kind === 'rejected') return stepVerdict(feedback.result)
    if (feedback.kind === 'same') return { tone: 'info', text: 'That is the line above, written again. Change one thing, then check it.' }
    if (feedback.kind === 'blocked') return { tone: 'info', text: feedback.message }
    if (!feedback.caveat) return KEPT
    const note = feedback.note || ERROR_PATTERNS.log_check_answers.lesson
    return {
      tone: 'ok',
      text: 'Kept. Legal, but check your answers in the original.',
      why: { title: 'Legal, but check your answers in the original', body: <p className="text-sm text-navy">{note}</p> },
    }
  }, [feedback])
  const answerOpen = equation !== null && steps.length > 0
  const shownBox = boxGrade

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={boxVerdict ?? lineVerdict}
      lineVerdict={composerVerdict}
      nudgeText={
        showingCards
          ? 'Still here? Pick the next line from the cards. The hint button is right there.'
          : equation
            ? 'Still here? Write the next line, then the solution in the answer box. The hint button is right there.'
            : 'Still here? Type the next line of your work below. The hint button is right there.'
      }
      keymap={{ onHint: hint.advance, onUndo: undo }}
      pickLine={pickOffer}
      statement={
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <Katex tex={safeLatex(start)} display ariaLabel={start} />
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
          showingCards ? (
            <LineCards key={lineKey} cards={cardsLeft} onPick={pickCard} onType={typeInstead} />
          ) : (
            <>
              {typedNote && (
                <p className="mb-2 text-sm text-navy/80" data-typed-note="">
                  {typedNote}
                </p>
              )}
              <MathInput
                value={draft}
                onChange={setDraft}
                onSubmit={submitLine}
                validate={validate}
                inputRef={inputRef}
                autoFocus
                label="Next line"
                submitLabel="Check this line"
                placeholder="next line of your work"
                stripKeys={LOG_KEYS}
                toTex={safeLatex}
              />
              {picks?.typing && cards.length > 0 && (
                <button
                  type="button"
                  onClick={() => useStore.getState().typeCardLine(false, lineKey)}
                  className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-navy underline hover:bg-navy-50"
                >
                  Back to the cards
                </button>
              )}
            </>
          )
        ) : undefined
      }
    >
      <section aria-labelledby="log-work-title" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-3">
        <h2 id="log-work-title" className="font-semibold text-navy">
          Your work
        </h2>
        {offers && !done && <LineEntrySwitch value={lineEntry} onChange={chooseEntry} />}
        <p className="text-xs text-navy/70">
          {mode === 'properties'
            ? 'One line at a time. A line is kept when it is still equal to the original, and the variables stay positive.'
            : 'One line at a time. A line is kept when it has the same solutions, inside the original equation.'}
        </p>
        <WorkedColumn start={start} steps={steps} onUndo={undo} canUndo={canUndo} />
        {feedback?.kind === 'same' && <NotAnAttemptNotice messages={['That is the line above, written again. Change one thing, then check the new line.']} />}
        {feedback?.kind === 'blocked' && <NotAnAttemptNotice messages={[feedback.message]} />}
        {feedback?.kind === 'rejected' && feedback.picked && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-navy" data-picked-line="">
            <span>You picked</span>
            <Katex tex={safeLatex(feedback.picked)} ariaLabel={feedback.picked} />
          </p>
        )}
        {feedback?.kind === 'rejected' && <RejectionCard result={feedback.result} />}
        {feedback?.kind === 'kept' && !feedback.caveat && !done && (
          <p role="status" className="text-sm text-navy">
            <span aria-hidden>✓ </span>
            Kept. That line still says the same thing.
          </p>
        )}
        {feedback?.kind === 'kept' && feedback.caveat && (
          <div role="status" className="rounded-xl border border-navy-100 bg-navy-50 px-3 py-2 text-sm text-navy">
            <p className="font-semibold">Legal, but check your answers in the original.</p>
            <p className="mt-1">{feedback.note || ERROR_PATTERNS.log_check_answers.lesson}</p>
          </div>
        )}
      </section>

      {equation && (
        <section aria-labelledby="ee-answer-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
          <h2 id="ee-answer-title" className="font-semibold text-navy">
            Your answer
          </h2>
          <p className="text-xs text-navy/70">
            {answerOpen ? 'The lines above are your work. The solution goes here.' : 'The answer box opens after a line of work is kept.'}
          </p>
          {done ? (
            <PolyTextBox id="ee-answer" label="Answer" hint={equation.formatHint} placeholder="" value={box} disabled invalid={false} onChange={() => {}} />
          ) : (
            <form onSubmit={submitAnswer} noValidate className="space-y-4">
              <PolyTextBox
                id="ee-answer"
                label="Answer"
                hint={equation.formatHint}
                placeholder=""
                value={box}
                disabled={!answerOpen}
                invalid={shownBox?.verdict === 'invalid' || shownBox?.verdict === 'unsupported'}
                onChange={storeBox}
                inputRef={answerRef}
                keypad={{ keys: LOG_KEYS }}
              />
              <button
                type="submit"
                disabled={!answerOpen}
                className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50"
              >
                Check the answer
              </button>
              {shownBox && <AnswerNote grade={shownBox} forms={forms} />}
            </form>
          )}
        </section>
      )}

      {done && (
        <section aria-labelledby="log-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="log-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          {equation ? <SigFigExplanation steps={equation.reveal} /> : <SigFigExplanation steps={answer.reveal} />}
        </section>
      )}
    </ProblemFrame>
  )
}

function AnswerNote({ grade, forms }: { grade: LogGrade; forms: readonly string[] }) {
  if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    const witness = safeWitness(grade.witness, forms)
    const hit = patternHit(grade.mistake, witness)
    return (
      <SigFigRejection
        message={witness}
        patterns={[{ ...hit, example: safeExample(hit.example, forms), lesson: safeLesson(hit.lesson, forms) }]}
      />
    )
  }
  const message = anyShows([grade.message], forms) ? 'That is not the solution of the original equation.' : grade.message
  return <SigFigRejection message={message} patterns={[]} />
}
