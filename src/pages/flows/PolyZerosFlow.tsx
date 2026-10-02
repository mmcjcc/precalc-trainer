import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { SigFigExplanation } from '@/components/SigFigFeedback'
import { FUNCTION_KEYS } from '@/components/symbolStrip'
import { polyShow } from '@/content/modules/polynomials/patterns'
import {
  PZ_FIRST_KEY,
  PZ_KEYS,
  PZ_MAX_ROWS,
  gradeZerosStage,
  pmShow,
  pzRuleIdFor,
  removeZeroRow,
  zeroRowCount,
  type PolyZerosAnswer,
  type PolyZerosStageId,
} from '@/content/modules/polyZeros'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { liveParseError, safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromPoly } from '@/problem/tutorContext'
import type { VarName } from '@/shared/types'
import { useStore } from '@/store'
import { ProblemFrame } from './ProblemFrame'
import { HintLadder, PolyChoice, PolyGradeList, PolyTextBox, polyAllCorrect, polyBlocked, savePolyEntries, useHintLadder, type PolyPart } from './polyUi'
import { recordPolyGrades } from './record'
import type { FlowProps } from './types'

type Entries = Record<string, string>

/** The last check: which part it was for, its graded parts, and the box flagged when it was not an attempt. */
interface Feedback {
  stage: number
  parts: PolyPart[]
  flag: string | null
}

const STAGE_TITLE: Record<PolyZerosStageId, string> = {
  zeros: 'Zeros and multiplicities',
  cross: 'At each zero',
  end: 'The two ends',
  formula: 'Your formula',
  candidates: 'Possible rational zeros',
  rational: 'The zeros among them',
}

const STAGE_LABEL: Record<PolyZerosStageId, string> = {
  zeros: 'list the zeros with their multiplicities',
  cross: 'say what the graph does at each zero',
  end: 'choose where each end goes',
  formula: 'write the formula',
  candidates: 'list the possible rational zeros',
  rational: 'give the rational zeros',
}

const CHECK_LABEL: Record<PolyZerosStageId, string> = {
  zeros: 'Check the zeros',
  cross: 'Check the choices',
  end: 'Check the ends',
  formula: 'Check the formula',
  candidates: 'Check the list',
  rational: 'Check the zeros',
}

/**
 * Said once a part is right when another part follows, in place of the engine's sentence. The engine's own
 * sentences are shown after the last part, with the whole explanation.
 */
const PASSED_NOTE: Record<PolyZerosStageId, string> = {
  zeros: 'The zeros and their multiplicities are right.',
  cross: 'Every choice is right.',
  end: 'Both ends are right.',
  formula: 'The formula is right.',
  candidates: 'The list is complete, with nothing extra.',
  rational: 'Those are the rational zeros.',
}

/** A formula may be typed as an expression in x, or with "f(x) =" or "y =" in front. */
const FORMULA_VARS: VarName[] = ['x', 'y']

const SMALL_BOX =
  'min-h-12 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50'

function Statement({ answer }: { answer: PolyZerosAnswer }) {
  if (answer.form === 'hidden') {
    // pz.build: the zeros and the point ARE the statement; f is the answer.
    return (
      <div className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-navy">Zeros of f</p>
          <ul className="mt-1 space-y-0.5 text-navy">
            {answer.zeros.map((z) => (
              <li key={z.text}>
                x = {polyShow(z.text)}, multiplicity {z.mult}
              </li>
            ))}
          </ul>
        </div>
        {answer.point && (
          <p className="text-navy">
            <span className="font-semibold">Point on the graph:</span> ({polyShow(answer.point.x)}, {polyShow(answer.point.y)})
          </p>
        )}
        <p className="text-sm text-navy">{answer.prompt}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Katex tex={`f(x) = ${safeLatex(answer.f)}`} display ariaLabel={`f(x) = ${polyShow(answer.f)}`} />
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

/** "touches the x-axis at x = −1 and crosses it at x = 3", from the engine's zeros. */
function atTheZeros(answer: PolyZerosAnswer): string {
  const at = (behavior: 'crosses' | 'touches') => answer.zeros.filter((z) => z.behavior === behavior).map((z) => `x = ${polyShow(z.text)}`)
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]!}`)
  const parts: string[] = []
  if (at('crosses').length) parts.push(`crosses the x-axis at ${list(at('crosses'))}`)
  if (at('touches').length) parts.push(`touches it and turns back at ${list(at('touches'))}`)
  return parts.join(', and ')
}

/** The graph of f. Rendered only once the problem is finished: it shows the answer. */
function FinishedGraph({ answer }: { answer: PolyZerosAnswer }) {
  if (answer.graph.kind === 'none') return null
  const end = answer.end
  return (
    <section className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="pz-graph-title">
      <h2 id="pz-graph-title" className="font-semibold text-navy">
        The graph of f
      </h2>
      <p className="text-sm text-navy">
        {answer.question === 'zeros' && `The graph ${atTheZeros(answer)}. `}
        {end && `At the far left it goes ${end.left}; at the far right it goes ${end.right}.`}
      </p>
      <GraphPanel spec={answer.graph} caption={`graph of f(x) = ${polyShow(answer.f)}`} />
    </section>
  )
}

function StageCard({ index, total, id, passed, children }: { index: number; total: number; id: PolyZerosStageId; passed: boolean; children: ReactNode }) {
  const titleId = `pz-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      <h2 id={titleId} className="font-semibold text-navy">
        {total > 1 ? `Part ${index + 1} of ${total}: ${STAGE_TITLE[id]}` : STAGE_TITLE[id]}
      </h2>
      {children}
      {passed && (
        <p role="status" className="text-sm font-semibold text-navy">
          <span aria-hidden>✓ </span>
          {PASSED_NOTE[id]}
        </p>
      )}
    </section>
  )
}

/**
 * Zeros and end behavior. Every problem is answered in parts, one Check each, and a later part is not on
 * the page until the one before is right:
 *  - pz.zeros: a row for each zero with its multiplicity, then crosses or touches at each zero;
 *  - pz.end: the left end and the right end, up or down;
 *  - pz.build: a formula from given zeros and a point;
 *  - pz.rational: every possible rational zero, then the ones that are zeros.
 * Each part has its own hint ladder. The graph of f is drawn only after she finishes.
 */
export function PolyZerosFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'polyZeros') return <p className="text-navy">This problem has no polynomial to work with — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: PolyZerosAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  /** How many parts have been checked right: the index of the part that is open. */
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const lastChecked = useRef<string | null>(null)
  const cells = useRef(new Map<string, HTMLInputElement>())
  const formulaRef = useRef<HTMLInputElement | null>(null)
  const stage = stages[passed]!
  // One ladder per part, so a hint opened for the zeros does not open by itself on the next part.
  const hint = useHintLadder(attempt, done, passed)

  // Restore her boxes when the attempt arrives after the first render (resume after a reload).
  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    setEntries({ ...attempt.final?.polyEntries })
    setPassed(Math.min(attempt.final?.polyStage ?? 0, last))
  }, [attempt, last])

  const register = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      if (el) cells.current.set(key, el)
      else cells.current.delete(key)
    },
    [],
  )

  const focusBox = useCallback((key: string) => {
    const el = key === PZ_KEYS.formula ? formulaRef.current : cells.current.get(key)
    el?.focus({ preventScroll: true })
  }, [])

  // When a part opens, focus goes to its first box (the Check button she pressed is gone).
  const opened = useRef(passed)
  useEffect(() => {
    if (opened.current === passed) return
    opened.current = passed
    focusBox(PZ_FIRST_KEY[stages[passed]!.id])
  }, [passed, stages, focusBox])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    // An unreadable box was not an attempt: its notice goes as soon as she edits.
    setFeedback((f) => (f && polyBlocked(f.parts.map((p) => p.grade)) ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  const rowCount = zeroRowCount(entries)

  // A row added or removed changes which boxes exist: the focus moves once the new rows are on the page.
  const pendingFocus = useRef<string | null>(null)
  useEffect(() => {
    if (!pendingFocus.current) return
    const key = pendingFocus.current
    pendingFocus.current = null
    focusBox(key)
  })

  function addRow() {
    if (rowCount >= PZ_MAX_ROWS) return
    store({ ...entries, [PZ_KEYS.rows]: String(rowCount + 1) })
    pendingFocus.current = PZ_KEYS.zero(rowCount)
  }

  function removeRow(i: number) {
    store(removeZeroRow(entries, i))
    pendingFocus.current = PZ_KEYS.zero(Math.max(0, Math.min(i, rowCount - 2)))
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const { parts, focus } = gradeZerosStage(answer, stage.id, entries)
    const grades = parts.map((p) => p.grade)
    setFeedback({ stage: passed, parts, flag: focus })
    if (polyBlocked(grades)) {
      // Not an attempt: nothing is recorded, and the box that needs her goes into focus.
      if (focus) focusBox(focus)
      return
    }
    // The same answers checked again are not a second try.
    const key = `${passed} ${JSON.stringify(entries)}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordPolyGrades(grades)
    const s = useStore.getState()
    if (!polyAllCorrect(grades)) {
      // First try means every part right the first time, not only the first part.
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
  const flag = shown && polyBlocked(shown.parts.map((p) => p.grade)) ? shown.flag : null
  const named = shown?.parts.find((p) => p.grade.verdict === 'mistake')?.grade
  const mistake = named && named.verdict === 'mistake' ? named.mistake : null

  // The module's rule card for the slip just named, else this part's own card; the rest fold under it.
  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = (mistake && pzRuleIdFor(mistake)) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const validateFormula = useCallback((t: string) => {
    const asExpression = liveParseError(t, FORMULA_VARS, 'expression')
    if (!asExpression) return null
    return liveParseError(t, FORMULA_VARS, 'relation') ? asExpression : null
  }, [])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? (stages.length > 1 ? 'all parts checked' : 'answer checked') : STAGE_LABEL[stage.id],
    solved: done,
    offPath: false,
  }

  function inputs(id: PolyZerosStageId, locked: boolean): ReactNode {
    const text = (key: string) => entries[key] ?? ''
    switch (id) {
      case 'zeros':
        return (
          <div role="group" aria-label="Zeros of f" className="space-y-3">
            {Array.from({ length: rowCount }, (_, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="block text-sm font-semibold text-navy">
                  Zero {i + 1}
                  <span className="mt-1 flex items-center gap-1 font-normal">
                    <span aria-hidden className="font-mono">
                      x =
                    </span>
                    <input
                      ref={register(PZ_KEYS.zero(i))}
                      type="text"
                      aria-label={`Zero ${i + 1}`}
                      value={text(PZ_KEYS.zero(i))}
                      disabled={locked}
                      onChange={(e) => update(PZ_KEYS.zero(i), e.target.value)}
                      inputMode="text"
                      autoCapitalize="off"
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                      enterKeyHint="next"
                      aria-invalid={flag === PZ_KEYS.zero(i) ? true : undefined}
                      className={`${SMALL_BOX} w-24`}
                    />
                  </span>
                </label>
                <label className="block text-sm font-semibold text-navy">
                  Multiplicity
                  <input
                    ref={register(PZ_KEYS.mult(i))}
                    type="text"
                    aria-label={`Multiplicity of zero ${i + 1}`}
                    value={text(PZ_KEYS.mult(i))}
                    disabled={locked}
                    onChange={(e) => update(PZ_KEYS.mult(i), e.target.value)}
                    inputMode="numeric"
                    autoComplete="off"
                    enterKeyHint="next"
                    aria-invalid={flag === PZ_KEYS.mult(i) ? true : undefined}
                    className={`${SMALL_BOX} mt-1 block w-20`}
                  />
                </label>
                {!locked && rowCount > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    aria-label={`Remove zero ${i + 1}`}
                    className="min-h-12 min-w-11 rounded-xl border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {!locked && (
              <button
                type="button"
                onClick={addRow}
                disabled={rowCount >= PZ_MAX_ROWS}
                className="min-h-11 rounded-xl border-2 border-dashed border-navy-100 bg-white px-4 font-semibold text-navy hover:border-navy disabled:opacity-50"
              >
                Add another zero
              </button>
            )}
            <p className="text-xs text-navy/70">One row for each zero. Exact numbers: a fraction stays a fraction.</p>
          </div>
        )
      case 'cross':
        return (
          <>
            {answer.zeros.map((z, i) => (
              <PolyChoice
                key={z.text}
                legend={`At x = ${polyShow(z.text)}, the graph`}
                name={`pz-cross-${i}`}
                options={[
                  { value: 'crosses', label: 'crosses the x-axis' },
                  { value: 'touches', label: 'touches the x-axis and turns back' },
                ]}
                value={text(PZ_KEYS.cross(i))}
                disabled={locked}
                onChange={(v) => update(PZ_KEYS.cross(i), v)}
                firstRef={register(PZ_KEYS.cross(i))}
              />
            ))}
          </>
        )
      case 'end':
        return (
          <>
            <PolyChoice
              legend="At the far left (x → −∞), f(x) goes"
              name="pz-left"
              options={[
                { value: 'up', label: 'up (f(x) → ∞)' },
                { value: 'down', label: 'down (f(x) → −∞)' },
              ]}
              value={text(PZ_KEYS.left)}
              disabled={locked}
              onChange={(v) => update(PZ_KEYS.left, v)}
              firstRef={register(PZ_KEYS.left)}
            />
            <PolyChoice
              legend="At the far right (x → ∞), f(x) goes"
              name="pz-right"
              options={[
                { value: 'up', label: 'up (f(x) → ∞)' },
                { value: 'down', label: 'down (f(x) → −∞)' },
              ]}
              value={text(PZ_KEYS.right)}
              disabled={locked}
              onChange={(v) => update(PZ_KEYS.right, v)}
              firstRef={register(PZ_KEYS.right)}
            />
          </>
        )
      case 'formula':
        return (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-navy">f(x) =</p>
            <MathInput
              value={text(PZ_KEYS.formula)}
              onChange={(v) => update(PZ_KEYS.formula, v)}
              onSubmit={check}
              validate={validateFormula}
              inputRef={formulaRef}
              label="Formula for f(x)"
              placeholder="your formula"
              submitLabel={CHECK_LABEL.formula}
              showSubmit={!locked}
              stripKeys={FUNCTION_KEYS}
              disabled={locked}
              toTex={safeLatex}
            />
          </div>
        )
      case 'candidates': {
        const typed = text(PZ_KEYS.candidates)
        return (
          <div>
            <PolyTextBox
              id="pz-candidates"
              label="Possible rational zeros"
              hint="Numbers with commas between them. Type ± as +-."
              placeholder=""
              value={typed}
              disabled={locked}
              invalid={flag === PZ_KEYS.candidates}
              onChange={(v) => update(PZ_KEYS.candidates, v)}
              inputRef={register(PZ_KEYS.candidates)}
            />
            {typed.trim() && (
              <p className="mt-1 break-words text-sm text-navy">
                <span className="text-navy/70">Reads as: </span>
                {pmShow(typed)}
              </p>
            )}
          </div>
        )
      }
      case 'rational':
        return (
          <PolyTextBox
            id="pz-rational"
            label="Rational zeros of f"
            hint="The candidates that really are zeros, with commas between them. Type none if there are none."
            placeholder=""
            value={text(PZ_KEYS.rational)}
            disabled={locked}
            invalid={flag === PZ_KEYS.rational}
            onChange={(v) => update(PZ_KEYS.rational, v)}
            inputRef={register(PZ_KEYS.rational)}
          />
        )
    }
  }

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={shown ? verdictFromPoly(shown.parts.map((p) => p.grade)) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        // Parts she has not reached stay out of the page: their boxes would say how the problem goes on.
        if (i > passed) return null
        const open = i === passed && !done
        return (
          <StageCard key={s.id} index={i} total={stages.length} id={s.id} passed={!open && stages.length > 1}>
            {!open ? (
              <div className="space-y-4">{inputs(s.id, true)}</div>
            ) : s.id === 'formula' ? (
              // The math input brings its own form and Check button.
              inputs(s.id, false)
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4">
                {inputs(s.id, false)}
                <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {CHECK_LABEL[s.id]}
                </button>
              </form>
            )}
            {open && shown && <PolyGradeList parts={shown.parts} />}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="pz-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="pz-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          {answer.form === 'hidden' && (
            <div className="overflow-x-auto text-navy">
              <Katex tex={`f(x) = ${safeLatex(answer.f)}`} display ariaLabel={`f(x) = ${polyShow(answer.f)}`} />
            </div>
          )}
          {shown && <PolyGradeList parts={shown.parts} />}
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
      {done && <FinishedGraph answer={answer} />}
    </ProblemFrame>
  )
}
