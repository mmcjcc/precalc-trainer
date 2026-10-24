import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { OrbitalFigure } from '@/components/OrbitalFigure'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { PT_KEYS, PT_RULE_FOR, exampleShowsAnswer as ptLeaks, gradePtStage, type PtGrade } from '@/content/modules/periodic'
import { QN_KEYS, QN_RULE_FOR, exampleShowsAnswer as qnLeaks, gradeQnStage, type QnGrade } from '@/content/modules/quantumNumbers'
import type { OrbitalId, PeriodicAnswer, PtStageId, QnStageId, QuantumAnswer, RuleCard } from '@/content/types'
import type { ErrorPatternId } from '@/shared/types'
import { patternHit } from '@/engine'
import { type ProgressLine } from '@/problem/stepEngine'
import { verdictFromPt, verdictFromQn } from '@/problem/tutorContext'
import type { TutorVerdict } from '@/shared/tutor'
import { useStore } from '@/store'
import { getModule } from '@/content/registry'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { recordPtGrades, recordQnGrades } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

type FlowGrade =
  | { verdict: 'correct'; message: string }
  | { verdict: 'wrong'; message: string }
  | { verdict: 'invalid'; message: string }
  | { verdict: 'mistake'; mistake: ErrorPatternId; witness: string; message: string }

interface PartsStage {
  id: string
  kind: 'text' | 'choice'
  label: string
  hint: string
  answerText: string
  accept?: string[]
  choices?: { id: string; text: string }[]
  nudge: string
  ruleCard: string
  reveal: string[]
}

interface PartsAnswer {
  prompt: string
  figure?: { orbital: OrbitalId }
  stages: PartsStage[]
  reveal: string[]
  ruleCards: string[]
}

interface Adapter<G extends FlowGrade> {
  prefix: string
  key: (id: string) => string
  grade: (stageId: string, text: string) => G
  ruleFor: Partial<Record<ErrorPatternId, string>>
  verdict: (grade: G) => TutorVerdict | null
  record: (grade: G) => void
  leaks: (example: string, answer: string) => boolean
}

interface Feedback<G extends FlowGrade> {
  stage: number
  grade: G
}

function Statement({ answer }: { answer: PartsAnswer }) {
  return (
    <div className="space-y-3">
      {answer.figure ? <OrbitalFigure orbital={answer.figure.orbital} /> : null}
      <p className="whitespace-pre-line text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

function pickedText(stage: PartsStage, id: string): string {
  if (stage.kind === 'choice') return stage.choices?.find((choice) => choice.id === id)?.text ?? id
  return id
}

function GradeNote<G extends FlowGrade>({ grade, stage, leaks }: { grade: G; stage: PartsStage; leaks: Adapter<G>['leaks'] }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    const hit = patternHit(grade.mistake, grade.witness)
    const answers = [stage.answerText, ...(stage.accept ?? [])]
    const shown = answers.some((answer) => leaks(hit.example, answer)) ? { ...hit, example: '' } : hit
    return <SigFigRejection message={grade.witness} patterns={[shown]} />
  }
  return <SigFigRejection message={grade.message} patterns={[]} />
}

function partTitle(index: number, total: number, label: string): string {
  return total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label
}

function periodicAdapter(answer: PeriodicAnswer): Adapter<PtGrade> {
  return {
    prefix: 'pt',
    key: (id) => PT_KEYS[id as PtStageId],
    grade: (stageId, text) => gradePtStage(answer, stageId as PtStageId, text),
    ruleFor: PT_RULE_FOR,
    verdict: verdictFromPt,
    record: recordPtGrades,
    leaks: ptLeaks,
  }
}

function quantumAdapter(answer: QuantumAnswer): Adapter<QnGrade> {
  return {
    prefix: 'qn',
    key: (id) => QN_KEYS[id as QnStageId],
    grade: (stageId, text) => gradeQnStage(answer, stageId as QnStageId, text),
    ruleFor: QN_RULE_FOR,
    verdict: verdictFromQn,
    record: recordQnGrades,
    leaks: qnLeaks,
  }
}

/**
 * Parts one at a time, for the periodic table and for quantum numbers.
 * Hints are the shared three-rung ladder; entries survive a reload.
 * A wrong answer names the slip and never states the right one.
 */
export function PeriodicFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type === 'periodic') return <Body {...props} answer={answer} adapter={periodicAdapter(answer)} />
  if (answer.type === 'quantum') return <Body {...props} answer={answer} adapter={quantumAdapter(answer)} />
  return <p className="text-navy">This problem has no periodic-table question — pick another from the module page.</p>
}

function Body<G extends FlowGrade>({ instance, attempt, flags, templateTitle, completion, finish, answer, adapter }: FlowProps & { answer: PartsAnswer; adapter: Adapter<G> }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback<G> | null>(null)
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
    focusBox(adapter.key(stages[passed]!.id))
  }, [passed, stages, focusBox, adapter])

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
    const text = entries[adapter.key(stage.id)] ?? ''
    const grade = adapter.grade(stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusBox(adapter.key(stage.id))
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    adapter.record(grade)
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
    const firstId = (mistake && adapter.ruleFor[mistake]) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake, adapter])

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
      tutorVerdict={shown ? adapter.verdict(shown.grade) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = adapter.key(s.id)
        const titleId = `${adapter.prefix}-part-${i}`
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
                    name={`${adapter.prefix}-choice-${s.id}`}
                    options={(s.choices ?? []).map((choice) => ({ value: choice.id, label: choice.text }))}
                    value={entries[key] ?? ''}
                    disabled={false}
                    onChange={(v) => update(key, v)}
                    firstRef={register(key)}
                  />
                ) : (
                  <PolyTextBox
                    id={`${adapter.prefix}-${s.id}`}
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
                  <p id={`${adapter.prefix}-${s.id}-hint`} className="text-xs text-navy/70">
                    {s.hint}
                  </p>
                )}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {`Check ${s.label}`}
                </button>
                {shown && <GradeNote grade={shown.grade} stage={stage} leaks={adapter.leaks} />}
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
                  id={`${adapter.prefix}-${s.id}`}
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
        <section aria-labelledby={`${adapter.prefix}-worked-title`} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id={`${adapter.prefix}-worked-title`} className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
