import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import {
  EM_KEYS,
  EM_RULE_FOR,
  gradeExpModelsStage,
  type EmGrade,
} from '@/content/modules/expModels'
import { getModule } from '@/content/registry'
import type { ExpModelsAnswer, ExpModelsStageId, RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromEm } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { ProblemFrame } from './ProblemFrame'
import { recordEmGrades } from './record'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: EmGrade
}

const STAGE_LABEL: Record<ExpModelsStageId, string> = {
  answer: 'give the answer',
  exact_k: 'give the exact growth rate k',
  rounded_k: 'round k to 4 decimal places',
  followup: 'use the model to answer',
}

const CHECK_LABEL: Record<ExpModelsStageId, string> = {
  answer: 'Check answer',
  exact_k: 'Check exact k',
  rounded_k: 'Check rounded k',
  followup: 'Check prediction',
}

const PASSED_NOTE: Record<ExpModelsStageId, string> = {
  answer: 'That is right.',
  exact_k: 'The exact growth rate k is right.',
  rounded_k: 'The rounded growth rate k is right.',
  followup: 'The model calculation is right.',
}

function Statement({ answer }: { answer: ExpModelsAnswer }) {
  return (
    <div className="space-y-3">
      <p className="text-base leading-relaxed text-navy">{answer.prompt}</p>
      <div className="inline-block rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-1.5 text-sm text-navy">
        <Katex tex={safeLatex(answer.formulaDisplay)} ariaLabel={answer.formulaDisplay} />
      </div>
    </div>
  )
}

function StageCard({
  index,
  total,
  label,
  id,
  passed,
  children,
}: {
  index: number
  total: number
  label: string
  id: ExpModelsStageId
  passed: boolean
  children: ReactNode
}) {
  const titleId = `em-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      <h2 id={titleId} className="font-semibold text-navy">
        {total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label}
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

function GradeNote({ grade }: { grade: EmGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  }
  return <SigFigRejection message={grade.message} patterns={[]} />
}

export function ExpModelsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'expModels') {
    return <p className="text-navy">This problem has no exponential model to work with.</p>
  }
  return <Body {...props} answer={answer} />
}

function Body({
  instance,
  attempt,
  flags,
  templateTitle,
  completion,
  finish,
  answer,
}: FlowProps & { answer: ExpModelsAnswer }) {
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
    focusBox(EM_KEYS[stages[passed]!.id])
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
    const text = entries[EM_KEYS[stage.id]] ?? ''
    const grade = gradeExpModelsStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusBox(EM_KEYS[stage.id])
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordEmGrades(grade)
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
    const firstId = (mistake && EM_RULE_FOR[mistake]) || stage.ruleCard
    const others = answer.ruleCards
      .filter((id) => id !== firstId)
      .map((id) => byId.get(id))
      .filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? (stages.length > 1 ? 'all parts checked' : 'answer checked') : STAGE_LABEL[stage.id],
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
      tutorVerdict={shown ? verdictFromEm(shown.grade) : undefined}
      nudgeText="Still here? The open part below is ready for your answer, or press Hint for a nudge."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={
        <HintLadder
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
        const key = EM_KEYS[s.id]
        const currentVal = entries[key] ?? ''
        return (
          <StageCard key={s.id} index={i} total={stages.length} label={s.label} id={s.id} passed={!open && stages.length > 1}>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                <PolyTextBox
                  id={`em-${s.id}`}
                  label={s.label}
                  hint={s.formatHint}
                  placeholder={s.placeholder}
                  value={currentVal}
                  disabled={false}
                  invalid={Boolean(invalid)}
                  onChange={(v) => update(key, v)}
                  inputRef={register(key)}
                />
                <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {CHECK_LABEL[s.id]}
                </button>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : (
              <PolyTextBox
                id={`em-${s.id}`}
                label={s.label}
                hint={s.formatHint}
                placeholder={s.placeholder}
                value={currentVal}
                disabled
                invalid={false}
                onChange={() => {}}
              />
            )}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="em-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="em-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
