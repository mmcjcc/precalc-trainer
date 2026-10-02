import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { SigFigExplanation } from '@/components/SigFigFeedback'
import { FUNCTION_KEYS } from '@/components/symbolStrip'
import { WorkedColumn } from '@/components/WorkedColumn'
import { POLY_PATTERN, polyShow } from '@/content/modules/polynomials/patterns'
import { csRuleIdFor, gradeExtremum, gradeOpens, type QuadraticsAnswer } from '@/content/modules/quadratics'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { checkSquareLine, gradeAxisOfSymmetry, gradeVertex, normalizeInput, type PolyGrade, type SquareLineGrade } from '@/engine'
import { liveParseError, safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromPoly } from '@/problem/tutorContext'
import type { ModuleId, VarName } from '@/shared/types'
import { useStore } from '@/store'
import { ProblemFrame } from './ProblemFrame'
import { HintLadder, NotAnAttemptNotice, PolyChoice as Choice, PolyGradeCard, PolyGradeList, PolyTextBox as TextBox, polyAllCorrect, polyBlocked, savePolyEntries, useHintLadder, type AnyPolyGrade, type PolyPart } from './polyUi'
import { recordPolyGrades } from './record'
import type { FlowProps } from './types'

type BodyProps = FlowProps & { answer: QuadraticsAnswer }

/** A line may be an expression in x, or an equation with y (or f(x)) on one side. */
const LINE_VARS: VarName[] = ['x', 'y']

const squash = (text: string) => text.replace(/\s+/g, '')

/** The module's rule card for the slip just named, else the problem's own first card; the rest fold under it. */
function useRuleCards(moduleId: ModuleId, answer: QuadraticsAnswer, mistake: string | null): { card: RuleCard | null; related: RuleCard[] } {
  const mod = getModule(moduleId)
  return useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = (mistake && csRuleIdFor(mistake)) || answer.ruleCard
    const card = byId.get(firstId) ?? null
    const related = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card, related }
  }, [mod, answer, mistake])
}

function Statement({ answer }: { answer: QuadraticsAnswer }) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Katex tex={`f(x) = ${safeLatex(answer.f)}`} display ariaLabel={`f(x) = ${polyShow(answer.f)}`} />
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

/** The parabola with its vertex marked. Rendered only once the problem is finished. */
function FinishedGraph({ answer }: { answer: QuadraticsAnswer }) {
  return (
    <section className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="qd-graph-title">
      <h2 id="qd-graph-title" className="font-semibold text-navy">
        The graph of f
      </h2>
      <p className="text-sm text-navy">
        The vertex {polyShow(answer.vertexText)} is the turning point, and the axis of symmetry {polyShow(answer.axisText)} runs straight through it.
      </p>
      <GraphPanel spec={answer.graph} caption={`graph of f(x) = ${polyShow(answer.f)}`} />
    </section>
  )
}

/**
 * Completing the square. `cs.form` is worked line by line: every line she types is checked against f with
 * the engine's `checkSquareLine`, legal lines pile up in the worked column, and a line in vertex form
 * finishes the problem. `cs.vertex` is four answers checked together. The graph appears only afterwards.
 */
export function QuadraticsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'quadratics') return <p className="text-navy">This problem has no quadratic to work with — pick another from the module page.</p>
  return answer.question === 'form' ? <FormBody {...props} answer={answer} /> : <VertexBody {...props} answer={answer} />
}

// ---------------------------------------------------------------------------
// cs.form: line by line
// ---------------------------------------------------------------------------

type LineFeedback = { kind: 'grade'; grade: SquareLineGrade; text: string } | { kind: 'same'; text: string }

function FormBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: BodyProps) {
  const done = Boolean(completion)
  const steps = useMemo(() => attempt?.steps ?? [], [attempt])
  const [draft, setDraftState] = useState(() => attempt?.draft ?? '')
  const [feedback, setFeedback] = useState<LineFeedback | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  /** The last rejected submission: checking it again unchanged is not a new try. */
  const lastRejected = useRef<string | null>(null)
  const hint = useHintLadder(attempt, done)

  // Restore the line she was typing once per attempt (resume after a reload), and keep it on unmount.
  const restoredFor = useRef<string | null>(null)
  useEffect(() => {
    if (attempt && restoredFor.current !== attempt.id) {
      restoredFor.current = attempt.id
      if (attempt.draft) setDraftState(attempt.draft)
    }
  }, [attempt])
  useEffect(() => () => useStore.getState().flushDraft(), [])

  // Finished when her last kept line is vertex form. Closed in an effect, after the line is on screen, so the
  // finished attempt that stays on the page includes it (and a reload between the two still finishes).
  const lastText = steps.length ? steps[steps.length - 1]!.text : null
  const solved = useMemo(() => {
    if (lastText === null) return false
    const g = checkSquareLine(answer.f, lastText)
    return g.verdict === 'correct' && g.done
  }, [answer.f, lastText])
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
    setFeedback((f) => (f && (f.kind === 'same' || f.grade.verdict === 'invalid' || f.grade.verdict === 'unsupported') ? null : f))
    useStore.getState().setDraft(v)
  }, [])

  const validate = useCallback((t: string) => {
    const asExpression = liveParseError(t, LINE_VARS, 'expression')
    if (!asExpression) return null
    return liveParseError(t, LINE_VARS, 'relation') ? asExpression : null
  }, [])

  function submit() {
    if (done || solved || !attempt) return
    const typed = draft.trim()
    const grade = checkSquareLine(answer.f, typed)
    if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') {
      // Unreadable: not an attempt. Nothing is recorded.
      setFeedback({ kind: 'grade', grade, text: typed })
      inputRef.current?.focus({ preventScroll: true })
      return
    }
    const s = useStore.getState()
    if (grade.verdict !== 'correct') {
      const sig = `${attempt.id} ${steps.length} ${squash(typed)}`
      if (lastRejected.current !== sig) {
        lastRejected.current = sig
        s.rejectStep(grade.verdict === 'mistake' ? POLY_PATTERN[grade.mistake] : undefined)
      }
      setFeedback({ kind: 'grade', grade, text: typed })
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
      return
    }
    const text = normalizeInput(typed)
    const previous = steps.length ? steps[steps.length - 1]!.text : answer.f
    if (!grade.done && squash(text) === squash(previous)) {
      // The line above, typed again: legal, but not a step.
      setFeedback({ kind: 'same', text: typed })
      return
    }
    lastRejected.current = null
    // Once the worked explanation has been opened, every later line was written with the answer in view.
    s.acceptStep({ text, latex: safeLatex(text), revealed: s.attempt?.final?.revealed === true })
    setFeedback({ kind: 'grade', grade, text: typed })
    setDraftState('')
    if (!grade.done) inputRef.current?.focus({ preventScroll: true })
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

  const grade = feedback?.kind === 'grade' ? feedback.grade : null
  const mistake = grade?.verdict === 'mistake' ? grade.mistake : null
  const { card, related } = useRuleCards(instance.moduleId, answer, mistake)
  const total = Math.max(1, answer.path.length - 1)
  const progress: ProgressLine = {
    stage: done ? total : Math.min(steps.length, total - 1),
    total,
    label: done ? 'vertex form reached' : steps.length === 0 ? 'write your first line' : `${steps.length} ${steps.length === 1 ? 'line' : 'lines'} accepted`,
    solved: done,
    offPath: false,
  }
  const finalStep = done ? (steps[steps.length - 1] ?? null) : null

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={grade ? verdictFromPoly([grade], feedback?.text) : undefined}
      nudgeText="Still here? Type the next line of your work below. The hint button is right there."
      keymap={{ onHint: hint.advance, onUndo: undo }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={answer.nudge} card={card} related={related} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
      composer={
        <MathInput
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          validate={validate}
          inputRef={inputRef}
          autoFocus
          label="Next line"
          submitLabel="Check this line"
          placeholder="next line of your work"
          stripKeys={FUNCTION_KEYS}
          toTex={safeLatex}
        />
      }
    >
      <section aria-labelledby="qd-work-title" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-3">
        <h2 id="qd-work-title" className="font-semibold text-navy">
          Your work
        </h2>
        <p className="text-xs text-navy/70">One line at a time. A line is kept when it is still equal to f(x).</p>
        <WorkedColumn start={answer.f} steps={steps} onUndo={undo} canUndo={canUndo} startLabel="f(x)" />
        {feedback?.kind === 'same' && <NotAnAttemptNotice messages={['That is the line above, written again. Change one thing, then check the new line.']} />}
        {grade && (grade.verdict === 'invalid' || grade.verdict === 'unsupported' || grade.verdict === 'mistake' || grade.verdict === 'wrong') && <PolyGradeCard grade={grade} />}
        {grade?.verdict === 'correct' && !grade.done && !done && (
          <p role="status" className="text-sm text-navy">
            <span aria-hidden>✓ </span>
            {grade.message} Keep going until it reads a(x − h)^2 + k.
          </p>
        )}
      </section>

      {done && finalStep && (
        <section aria-labelledby="qd-answer-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="qd-answer-title" className="font-semibold text-navy">
            Vertex form
          </h2>
          <div className="overflow-x-auto text-navy">
            <Katex tex={`f(x) = ${safeLatex(answer.vertexForm)}`} display ariaLabel={`f(x) = ${polyShow(answer.vertexForm)}`} />
          </div>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
      {done && <FinishedGraph answer={answer} />}
    </ProblemFrame>
  )
}

// ---------------------------------------------------------------------------
// cs.vertex: four answers, one check
// ---------------------------------------------------------------------------

interface VertexEntries {
  vertex: string
  axis: string
  opens: string
  extremumKind: string
  extremumValue: string
}

const EMPTY: VertexEntries = { vertex: '', axis: '', opens: '', extremumKind: '', extremumValue: '' }

const PART_LABELS = ['Vertex', 'Axis of symmetry', 'Direction', 'Minimum or maximum value'] as const

function loadEntries(saved: Record<string, string> | undefined): VertexEntries {
  if (!saved) return EMPTY
  return {
    vertex: saved.vertex ?? '',
    axis: saved.axis ?? '',
    opens: saved.opens ?? '',
    extremumKind: saved.extremumKind ?? '',
    extremumValue: saved.extremumValue ?? '',
  }
}

function gradeEntries(f: string, e: VertexEntries): PolyGrade[] {
  return [gradeVertex(f, e.vertex), gradeAxisOfSymmetry(f, e.axis), gradeOpens(f, e.opens), gradeExtremum(f, e.extremumKind, e.extremumValue, { vertex: e.vertex })]
}

function VertexBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: BodyProps) {
  const done = Boolean(completion)
  const [entries, setEntries] = useState<VertexEntries>(() => loadEntries(attempt?.final?.polyEntries))
  const [grades, setGrades] = useState<AnyPolyGrade[] | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useHintLadder(attempt, done)

  function update(patch: Partial<VertexEntries>) {
    const next = { ...entries, ...patch }
    setEntries(next)
    // An unreadable box was not an attempt: its notice goes as soon as she edits.
    setGrades((g) => (g && polyBlocked(g) ? null : g))
    savePolyEntries({ ...next })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (done) return
    savePolyEntries({ ...entries })
    const next = gradeEntries(answer.f, entries)
    setGrades(next)
    if (polyBlocked(next)) return
    const key = JSON.stringify(entries)
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordPolyGrades(next)
    if (polyAllCorrect(next)) finish()
  }

  const mistake = grades?.find((g) => g.verdict === 'mistake')
  const { card, related } = useRuleCards(instance.moduleId, answer, mistake && mistake.verdict === 'mistake' ? mistake.mistake : null)
  const parts: PolyPart[] = grades ? grades.map((grade, i) => ({ label: PART_LABELS[i], grade })) : []
  const invalid = (i: number) => grades?.[i]?.verdict === 'invalid'
  const progress: ProgressLine = { stage: done ? 1 : 0, total: 1, label: done ? 'answers checked' : 'give the four answers', solved: done, offPath: false }
  const kindWord = entries.extremumKind === 'maximum' ? 'Maximum' : entries.extremumKind === 'minimum' ? 'Minimum' : 'Minimum or maximum'

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={grades ? verdictFromPoly(grades) : undefined}
      nudgeText="Still here? The four answers go in the boxes below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={answer.nudge} card={card} related={related} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="qd-answers-title">
        <h2 id="qd-answers-title" className="font-semibold text-navy">
          Your answers
        </h2>
        <form onSubmit={submit} noValidate className="space-y-4">
          <TextBox id="qd-vertex" label="Vertex" hint="A point: two numbers in parentheses, with a comma between them." placeholder="(h, k)" value={entries.vertex} disabled={done} invalid={invalid(0)} onChange={(v) => update({ vertex: v })} />
          <TextBox id="qd-axis" label="Axis of symmetry" hint="An equation: x = a number." placeholder="x = " value={entries.axis} disabled={done} invalid={invalid(1)} onChange={(v) => update({ axis: v })} />
          <Choice
            legend="The parabola opens"
            name="qd-opens"
            options={[
              { value: 'up', label: 'up' },
              { value: 'down', label: 'down' },
            ]}
            value={entries.opens}
            disabled={done}
            onChange={(v) => update({ opens: v })}
          />
          <Choice
            legend="At its vertex, f has a"
            name="qd-extremum"
            options={[
              { value: 'minimum', label: 'minimum' },
              { value: 'maximum', label: 'maximum' },
            ]}
            value={entries.extremumKind}
            disabled={done}
            onChange={(v) => update({ extremumKind: v })}
          />
          <TextBox id="qd-value" label={`${kindWord} value`} hint="One exact number. A fraction stays a fraction." placeholder="" value={entries.extremumValue} disabled={done} invalid={invalid(3)} onChange={(v) => update({ extremumValue: v })} />
          {!done && (
            <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
              Check answers
            </button>
          )}
        </form>
        <PolyGradeList parts={parts} />
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
      {done && <FinishedGraph answer={answer} />}
    </ProblemFrame>
  )
}
