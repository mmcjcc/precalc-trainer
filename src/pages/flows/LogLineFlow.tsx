import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Katex } from '@/components/Katex'
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
import { counterexampleLines, hintView, liveParseError, safeLatex, type HintView, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromLog, verdictFromStep } from '@/problem/tutorContext'
import type { Counterexample, PatternHit } from '@/shared/types'
import { useStore } from '@/store'
import { NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { recordLogGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Mode = 'properties' | 'equations'

type LineFeedback =
  | { kind: 'blocked'; message: string }
  | { kind: 'rejected'; result: LogStepResult }
  | { kind: 'same' }
  | { kind: 'kept'; caveat: boolean; note: string }

const squash = (text: string) => text.replace(/\s+/g, '')

function answerForms(instance: ProblemInstance): string[] {
  const answer = instance.answer
  if (answer.type === 'logProperties') return [answer.answerText]
  if (answer.type === 'expLogEquations') return [answer.answerText, ...answer.accept]
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

  const restoredFor = useRef<string | null>(null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
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
    return checkLogStep(prev, next, {
      original: answer.equation,
      vars: ['x'],
      seed: instance.seed,
      ...(answer.places ? { decimal: { places: answer.places } } : {}),
    })
  }

  const validate = useCallback(
    (t: string) => {
      if (answer.type === 'logProperties') return liveParseError(t, answer.vars, 'expression')
      return liveParseError(t, ['x'], 'relation')
    },
    [answer],
  )

  function acceptLine(text: string, revealed: boolean) {
    lastRejected.current = null
    const s = useStore.getState()
    s.acceptStep({ text, latex: safeLatex(text), revealed: revealed || s.attempt?.final?.revealed === true })
    setDraftState('')
    s.setDraft('')
    if (!solved) inputRef.current?.focus({ preventScroll: true })
  }

  function submitLine() {
    if (done || solved || !attempt) return
    const typed = draft.trim()
    const raw = checkLine(previous, typed)
    if (isBlocked(raw)) {
      setFeedback({ kind: 'blocked', message: blockedMessage(raw, forms) })
      inputRef.current?.focus({ preventScroll: true })
      return
    }
    const result = visibleStep(raw, forms)
    if (!result.ok) {
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
    acceptLine(text, false)
    const note = caveat ? safeWitness(result.pattern?.witness ?? ERROR_PATTERNS.log_check_answers.lesson, forms) : ''
    setFeedback({ kind: 'kept', caveat, note })
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
    if (lastBox.current === box) return
    lastBox.current = box
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
    setDraftState(last.text)
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
  const lineVerdict = feedback?.kind === 'rejected' ? verdictFromStep(feedback.result, draft) : undefined
  const boxVerdict = boxGrade ? verdictFromLog(boxGrade, box) : undefined
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
      nudgeText={equation ? 'Still here? Write the next line, then the solution in the answer box. The hint button is right there.' : 'Still here? Type the next line of your work below. The hint button is right there.'}
      keymap={{ onHint: hint.advance, onUndo: undo }}
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
        ) : undefined
      }
    >
      <section aria-labelledby="log-work-title" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-3">
        <h2 id="log-work-title" className="font-semibold text-navy">
          Your work
        </h2>
        <p className="text-xs text-navy/70">
          {mode === 'properties'
            ? 'One line at a time. A line is kept when it is still equal to the original, and the variables stay positive.'
            : 'One line at a time. A line is kept when it has the same solutions, inside the original equation.'}
        </p>
        <WorkedColumn start={start} steps={steps} onUndo={undo} canUndo={canUndo} />
        {feedback?.kind === 'same' && <NotAnAttemptNotice messages={['That is the line above, written again. Change one thing, then check the new line.']} />}
        {feedback?.kind === 'blocked' && <NotAnAttemptNotice messages={[feedback.message]} />}
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
              />
              <button
                type="submit"
                disabled={!answerOpen}
                className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50"
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
