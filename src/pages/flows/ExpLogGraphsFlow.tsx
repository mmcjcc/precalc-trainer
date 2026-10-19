import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import {
  EG_KEYS,
  EG_RULE_FOR,
  gradeExpLogGraphsStage,
  type EgGrade,
} from '@/content/modules/expLogGraphs'
import { getModule } from '@/content/registry'
import type { ExpLogGraphsAnswer, ExpLogGraphsStageId, RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromEg } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { ProblemFrame } from './ProblemFrame'
import { recordEgGrades } from './record'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: EgGrade
}

const STAGE_LABEL: Record<ExpLogGraphsStageId, string> = {
  domain: 'give the domain',
  range: 'give the range',
  asymptote: 'give the asymptote',
  intercept: 'give the intercept',
  behavior: 'give the behavior',
  match: 'choose the matching option',
  inverse: 'give the inverse function',
}

const CHECK_LABEL: Record<ExpLogGraphsStageId, string> = {
  domain: 'Check the domain',
  range: 'Check the range',
  asymptote: 'Check the asymptote',
  intercept: 'Check the intercept',
  behavior: 'Check the behavior',
  match: 'Check your choice',
  inverse: 'Check the inverse',
}

const PASSED_NOTE: Record<ExpLogGraphsStageId, string> = {
  domain: 'The domain is right.',
  range: 'The range is right.',
  asymptote: 'The asymptote is right.',
  intercept: 'The intercept is right.',
  behavior: 'The behavior is right.',
  match: 'That match is right.',
  inverse: 'The inverse function is right.',
}

function Statement({ answer }: { answer: ExpLogGraphsAnswer }) {
  if (answer.question === 'match' && answer.matchMode === 'equation') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-navy">{answer.prompt}</p>
        <div className="rounded-xl border border-navy-100 bg-white p-3">
          <GraphPanel spec={answer.graph} caption="Target graph" />
        </div>
        {answer.candidates && (
          <div className="grid gap-2 sm:grid-cols-2">
            {answer.candidates.map((cand) => (
              <div
                key={cand.id}
                className="flex items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/40 px-3 py-2 text-sm text-navy"
              >
                <span className="font-bold">{cand.id}:</span>
                <Katex tex={safeLatex(cand.equation)} ariaLabel={cand.equation} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <Katex tex={safeLatex(answer.equation)} display ariaLabel={answer.equation} />
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
      {answer.question === 'match' && answer.matchMode === 'graph' && answer.candidates && (
        <div className="grid gap-4 sm:grid-cols-2">
          {answer.candidates.map((cand) => (
            <div key={cand.id} className="space-y-1 rounded-xl border border-navy-100 bg-white p-3">
              <p className="text-sm font-semibold text-navy">Graph {cand.id}</p>
              <GraphPanel spec={cand.graph} caption={`Candidate ${cand.id}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FinishedGraph({ answer }: { answer: ExpLogGraphsAnswer }) {
  if (answer.question === 'match') return null
  if (answer.graph.kind !== 'function' || !answer.graph.f) return null
  return (
    <section className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="eg-graph-title">
      <h2 id="eg-graph-title" className="font-semibold text-navy">
        {answer.question === 'inverse' ? 'The graph of the function and its inverse' : `The graph of ${answer.fnName}`}
      </h2>
      <p className="text-sm text-navy">
        {answer.question === 'inverse'
          ? 'The function and its inverse are reflections of each other across the line y = x.'
          : 'The dashed line is the asymptote, and the dot marks the intercept.'}
      </p>
      <GraphPanel spec={answer.graph} caption={`graph of ${answer.equation}`} />
    </section>
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
  id: ExpLogGraphsStageId
  passed: boolean
  children: ReactNode
}) {
  const titleId = `eg-part-${index}`
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

function GradeNote({ grade }: { grade: EgGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  }
  return <SigFigRejection message={grade.message} patterns={[]} />
}

export function ExpLogGraphsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'expLogGraphs') {
    return <p className="text-navy">This problem has no exponential or logarithmic graph to work with.</p>
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
}: FlowProps & { answer: ExpLogGraphsAnswer }) {
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
    focusBox(EG_KEYS[stages[passed]!.id])
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
    const text = entries[EG_KEYS[stage.id]] ?? ''
    const grade = gradeExpLogGraphsStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusBox(EG_KEYS[stage.id])
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordEgGrades(grade)
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
    const firstId = (mistake && EG_RULE_FOR[mistake]) || stage.ruleCard
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
      tutorVerdict={shown ? verdictFromEg(shown.grade) : undefined}
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
        const key = EG_KEYS[s.id]
        const currentVal = entries[key] ?? ''
        return (
          <StageCard key={s.id} index={i} total={stages.length} label={s.label} id={s.id} passed={!open && stages.length > 1}>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {s.choices && s.choices.length > 0 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={s.label}>
                    {s.choices.map((choice) => {
                      const active = currentVal.trim().toLowerCase() === choice.id.toLowerCase()
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => update(key, choice.id)}
                          aria-pressed={active}
                          className={`min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-semibold text-navy ${
                            active ? 'border-navy bg-gold-100' : 'border-navy-100 bg-white hover:border-navy'
                          }`}
                        >
                          {choice.label}
                        </button>
                      )
                    })}
                  </div>
                )}
                <PolyTextBox
                  id={`eg-${s.id}`}
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
                id={`eg-${s.id}`}
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
        <section aria-labelledby="eg-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="eg-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
      {done && <FinishedGraph answer={answer} />}
    </ProblemFrame>
  )
}
