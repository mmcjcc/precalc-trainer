import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { PT_KEYS, PT_RULE_FOR, exampleShowsAnswer, gradePtStage, type PtGrade } from '@/content/modules/periodic'
import type { PeriodicAnswer } from '@/content/types'
import type { RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { type ProgressLine } from '@/problem/stepEngine'
import { verdictFromPt } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { getModule } from '@/content/registry'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { recordPtGrades } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: PtGrade
}

function Statement({ answer }: { answer: PeriodicAnswer }) {
  return <p className="whitespace-pre-line text-sm text-navy">{answer.prompt}</p>
}

function pickedText(stage: PeriodicAnswer['stages'][number], id: string): string {
  if (stage.kind === 'choice') return stage.choices?.find((choice) => choice.id === id)?.text ?? id
  return id
}

function GradeNote({ grade, stage }: { grade: PtGrade; stage: PeriodicAnswer['stages'][number] }) {
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

/**
 * Chapter 6. Parts are checked one at a time. Hints are the shared three-rung ladder; her
 * entries survive a reload. A wrong answer names the slip and never states the right one.
 */
export function PeriodicFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'periodic') return <p className="text-navy">This problem has no periodic-table question — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: PeriodicAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
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
    focusBox(PT_KEYS[stages[passed]!.id])
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
    const text = entries[PT_KEYS[stage.id]] ?? ''
    const grade = gradePtStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusBox(PT_KEYS[stage.id])
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordPtGrades(grade)
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
    const firstId = (mistake && PT_RULE_FOR[mistake]) || stage.ruleCard
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
      tutorVerdict={shown ? verdictFromPt(shown.grade) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = PT_KEYS[s.id]
        const titleId = `pt-part-${i}`
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
                    name={`pt-choice-${s.id}`}
                    options={(s.choices ?? []).map((choice) => ({ value: choice.id, label: choice.text }))}
                    value={entries[key] ?? ''}
                    disabled={false}
                    onChange={(v) => update(key, v)}
                    firstRef={register(key)}
                  />
                ) : (
                  <PolyTextBox
                    id={`pt-${s.id}`}
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
                  <p id={`pt-${s.id}-hint`} className="text-xs text-navy/70">
                    {s.hint}
                  </p>
                )}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {`Check ${s.label}`}
                </button>
                {shown && <GradeNote grade={shown.grade} stage={stage} />}
              </form>
            ) : s.kind === 'choice' ? (
              <>
                <p className="text-sm font-semibold text-navy">{pickedText(s, entries[key] ?? '')}</p>
                {stages.length > 1 && (
                  <p role="status" className="text-sm font-semibold text-navy">
                    <span aria-hidden>✓ </span>
                    Correct.
                  </p>
                )}
              </>
            ) : (
              <>
                <PolyTextBox
                  id={`pt-${s.id}`}
                  label={s.label}
                  hint={s.hint}
                  placeholder=""
                  value={entries[key] ?? ''}
                  disabled
                  invalid={false}
                  onChange={() => {}}
                />
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
        <section aria-labelledby="pt-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="pt-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
