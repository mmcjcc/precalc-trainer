import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { coefficientText, exampleShowsAnswer, gradeRxStage, RX_KEYS, RX_RULE_FOR, slotKey, type RxGrade } from '@/content/modules/reactions'
import type { ReactionsAnswer, RuleCard, RxStageId } from '@/content/types'
import { patternHit } from '@/engine'
import { type ProgressLine } from '@/problem/stepEngine'
import { verdictFromRx } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { getModule } from '@/content/registry'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

type Stage = ReactionsAnswer['stages'][number]

/**
 * Log one reactions check. A named mistake is stored under its catalog id. Unreadable input is
 * not an attempt: nothing is logged.
 */
function recordRxGrade(grade: RxGrade): void {
  if (grade.verdict === 'invalid') return
  const s = useStore.getState()
  if (grade.verdict === 'correct') {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  if (grade.verdict === 'mistake') {
    s.recordFinalAnswer({ correct: false, pattern: grade.mistake, via: 'text' })
    return
  }
  s.recordFinalAnswer({ correct: false, via: 'text' })
}

function pickedText(stage: Stage, id: string): string {
  return stage.choices?.find((choice) => choice.id === id)?.text ?? id
}

function GradeNote({ grade, stage }: { grade: RxGrade; stage: Stage }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    const hit = patternHit(grade.mistake, grade.witness)
    const answers = [stage.answerText, ...(stage.accept ?? [])]
    const shown = answers.some((answer) => exampleShowsAnswer(hit.example, answer)) ? { ...hit, example: '' } : hit
    return <SigFigRejection message={grade.witness} patterns={[shown]} />
  }
  return <SigFigRejection message={grade.message} patterns={[]} />
}

function partTitle(index: number, total: number, label: string): string {
  return total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label
}

/** The text the grader reads for a part: one box, or the coefficient boxes joined. */
function partText(stage: Stage, entries: Entries): string {
  return stage.kind === 'coefficients' ? coefficientText(stage, entries) : (entries[RX_KEYS[stage.id]] ?? '')
}

/** The first box of a part, for focus. */
function firstKey(stage: Stage): string {
  return stage.kind === 'coefficients' ? slotKey(stage.id, 0) : RX_KEYS[stage.id]
}

/** One whole-number box in front of each species, reactants, an arrow, then products. */
function CoefficientBoxes({
  stage,
  entries,
  disabled,
  invalid,
  onChange,
  register,
}: {
  stage: Stage
  entries: Entries
  disabled: boolean
  invalid: boolean
  onChange: (key: string, value: string) => void
  register?: (key: string) => (el: HTMLInputElement | null) => void
}) {
  const slots = stage.slots ?? []
  const split = stage.reactantCount ?? 0
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold text-navy">{stage.label}</legend>
      {/* Written the way an equation is: each box sits in front of its formula. The box keeps its full
          label for screen readers; on screen the formula beside it says which species it belongs to. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3" data-rx-equation>
        {slots.map((slot, i) => {
          const key = slotKey(stage.id, i)
          return (
            <div key={key} className="flex items-center gap-2">
              {i === split && <span aria-hidden className="text-lg text-navy">→</span>}
              {i > 0 && i !== split && <span aria-hidden className="text-lg text-navy">+</span>}
              <div className="w-14 [&_label]:sr-only">
                <PolyTextBox
                  id={`rx-${stage.id}-${i}`}
                  label={`Coefficient for ${slot}`}
                  hint=""
                  placeholder=""
                  value={entries[key] ?? ''}
                  disabled={disabled}
                  invalid={invalid}
                  onChange={(v) => onChange(key, v)}
                  inputRef={register?.(key)}
                />
              </div>
              <span aria-hidden className="font-semibold text-navy">
                {slot}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-navy/70">{stage.hint}</p>
    </fieldset>
  )
}

/**
 * Parts one at a time, for chemical reactions (chapter 11), modeled on CovalentBondingFlow.
 * Hints are the shared three-rung ladder; entries survive a reload.
 * A wrong answer names the slip and never states the right one.
 */
export function ReactionsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type === 'reactions') return <Body {...props} answer={answer} />
  return <p className="text-navy">This problem has no reactions question — pick another from the module page.</p>
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: ReactionsAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<{ stage: number; grade: RxGrade } | null>(null)
  const lastChecked = useRef<string | null>(null)
  const boxes = useRef(new Map<string, HTMLInputElement>())
  const stage = stages[passed]!
  const hint = useHintLadder(attempt, done, passed)

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
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
    focusBox(firstKey(stages[passed]!))
  }, [passed, stages, focusBox])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = partText(stage, entries)
    const grade = gradeRxStage(answer, stage.id as RxStageId, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusBox(firstKey(stage))
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordRxGrade(grade)
    const s = useStore.getState()
    if (grade.verdict !== 'correct') {
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
  const mistake = shown?.grade.verdict === 'mistake' ? shown.grade.mistake : null

  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = (mistake && RX_RULE_FOR[mistake]) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? (stages.length > 1 ? 'all parts checked' : 'answer checked') : `find ${stage.label}`,
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
      tutorVerdict={shown ? (verdictFromRx(shown.grade) ?? undefined) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<p className="whitespace-pre-line text-sm text-navy">{answer.prompt}</p>}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = RX_KEYS[s.id]
        const titleId = `rx-part-${i}`
        return (
          <section key={s.id} aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
            <h2 id={titleId} className="font-semibold text-navy">
              {partTitle(i, stages.length, s.label)}
            </h2>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {s.kind === 'choice' ? (
                  <PolyChoice
                    legend={s.label}
                    name={`rx-choice-${s.id}`}
                    options={(s.choices ?? []).map((choice) => ({ value: choice.id, label: choice.text }))}
                    value={entries[key] ?? ''}
                    disabled={false}
                    onChange={(v) => update(key, v)}
                    firstRef={register(key)}
                  />
                ) : s.kind === 'coefficients' ? (
                  <CoefficientBoxes stage={s} entries={entries} disabled={false} invalid={Boolean(invalid)} onChange={update} register={register} />
                ) : (
                  <PolyTextBox
                    id={`rx-${s.id}`}
                    label={s.label}
                    hint={s.hint}
                    placeholder=""
                    value={entries[key] ?? ''}
                    disabled={false}
                    invalid={Boolean(invalid)}
                    onChange={(v) => update(key, v)}
                    inputRef={register(key)}
                  />
                )}
                {s.kind === 'choice' && (
                  <p id={`rx-${s.id}-hint`} className="text-xs text-navy/70">
                    {s.hint}
                  </p>
                )}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {`Check ${s.label}`}
                </button>
                {shown && <GradeNote grade={shown.grade} stage={stage} />}
              </form>
            ) : (
              <>
                {s.kind === 'choice' ? (
                  <p className="text-sm font-semibold text-navy">{pickedText(s, entries[key] ?? '')}</p>
                ) : s.kind === 'coefficients' ? (
                  <CoefficientBoxes stage={s} entries={entries} disabled invalid={false} onChange={() => {}} />
                ) : (
                  <PolyTextBox id={`rx-${s.id}`} label={s.label} hint={s.hint} placeholder="" value={entries[key] ?? ''} disabled invalid={false} onChange={() => {}} />
                )}
                {stages.length > 1 && (
                  <p role="status" className="text-sm font-semibold text-navy">
                    <span aria-hidden>✓ </span>
                    Correct.
                  </p>
                )}
              </>
            )}
          </section>
        )
      })}

      {done && (
        <section aria-labelledby="rx-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="rx-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
