import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { gradeRfStage, RF_KEYS, RF_RULE_FOR, type RationalFnsAnswer, type RfGrade, type RfStageId } from '@/content/modules/rationalFns'
import { math } from '@/content/modules/rationalFns/model'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromRf } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { recordRfGrades } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: RfGrade
}

const STAGE_TITLE: Record<RfStageId, string> = {
  domain: 'Domain',
  va: 'Vertical asymptotes',
  holes: 'Holes',
  asymptote: 'Horizontal or slant asymptote',
  xint: 'x-intercepts',
  yint: 'y-intercept',
  solution: 'Solution set',
}

const STAGE_LABEL: Record<RfStageId, string> = {
  domain: 'give the domain',
  va: 'give the vertical asymptotes',
  holes: 'give the holes',
  asymptote: 'give the horizontal or slant asymptote',
  xint: 'give the x-intercepts',
  yint: 'give the y-intercept',
  solution: 'give the solution set',
}

const CHECK_LABEL: Record<RfStageId, string> = {
  domain: 'Check the domain',
  va: 'Check the vertical asymptotes',
  holes: 'Check the holes',
  asymptote: 'Check the asymptote',
  xint: 'Check the x-intercepts',
  yint: 'Check the y-intercept',
  solution: 'Check the solution',
}

const PASSED_NOTE: Record<RfStageId, string> = {
  domain: 'The domain is right.',
  va: 'The vertical asymptotes are right.',
  holes: 'The holes are right.',
  asymptote: 'The asymptote is right.',
  xint: 'The x-intercepts are right.',
  yint: 'The y-intercept is right.',
  solution: 'The solution set is right.',
}

const BOX_HINT: Record<RfStageId, string> = {
  domain: 'Interval notation, with U between the pieces.',
  va: 'Equations like x = a number, separated by commas. Type none if there are none.',
  holes: 'Points, separated by commas. Type none if there are none.',
  asymptote: 'An equation y = …. Type none if there is none.',
  xint: 'Points on the x-axis, separated by commas. Type none if there are none.',
  yint: 'One point. Type none if there is none.',
  solution: 'A set, or the numbers separated by commas. Type no solution if there is none.',
}

function Statement({ answer }: { answer: RationalFnsAnswer }) {
  if (answer.question === 'equation') {
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto">
          <Katex tex={safeLatex(answer.equation)} display ariaLabel={math(answer.equation)} />
        </div>
        <p className="text-sm text-navy">{answer.prompt}</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Katex tex={`f(x) = ${safeLatex(answer.f)}`} display ariaLabel={`f(x) = ${math(answer.f)}`} />
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

/** The graph of f, or of the two sides. Rendered only once the problem is finished: it shows the answer. */
function FinishedGraph({ answer }: { answer: RationalFnsAnswer }) {
  if (answer.graph.kind !== 'function' || !answer.graph.f) return null
  const caption = answer.question === 'equation' ? `graph of ${math(answer.equation)}` : `graph of f(x) = ${math(answer.f)}`
  return (
    <section className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="rf-graph-title">
      <h2 id="rf-graph-title" className="font-semibold text-navy">
        The graph of f
      </h2>
      <p className="text-sm text-navy">
        {answer.question === 'equation'
          ? 'The two sides, with a dashed line where a denominator is 0.'
          : 'Dashed lines are the asymptotes. An open dot is a hole.'}
      </p>
      <GraphPanel spec={answer.graph} caption={caption} />
    </section>
  )
}

function StageCard({ index, total, id, passed, children }: { index: number; total: number; id: RfStageId; passed: boolean; children: ReactNode }) {
  const titleId = `rf-part-${index}`
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

function GradeNote({ grade }: { grade: RfGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  return <SigFigRejection message={grade.message} patterns={[]} />
}

/**
 * Rational functions. Every problem is answered in parts, one Check each, and a later part is not on
 * the page until the one before is right:
 *  - rf.features: domain, vertical asymptotes, holes, horizontal or slant asymptote, x-intercepts, y-intercept;
 *  - rf.asymptote: the horizontal or slant asymptote only;
 *  - rf.equation: the solution set.
 * Each part has its own hint ladder. The graph is drawn only after she finishes.
 */
export function RationalFnsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'rationalFns') return <p className="text-navy">This problem has no rational function to work with — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: RationalFnsAnswer }) {
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
    focusBox(RF_KEYS[stages[passed]!.id])
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
    const text = entries[RF_KEYS[stage.id]] ?? ''
    const grade = gradeRfStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusBox(RF_KEYS[stage.id])
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordRfGrades(grade)
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
    const firstId = (mistake && RF_RULE_FOR[mistake]) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
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
      tutorVerdict={shown ? verdictFromRf(shown.grade) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = RF_KEYS[s.id]
        return (
          <StageCard key={s.id} index={i} total={stages.length} id={s.id} passed={!open && stages.length > 1}>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                <PolyTextBox
                  id={`rf-${s.id}`}
                  label={STAGE_TITLE[s.id]}
                  hint={BOX_HINT[s.id]}
                  placeholder=""
                  value={entries[key] ?? ''}
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
                id={`rf-${s.id}`}
                label={STAGE_TITLE[s.id]}
                hint={BOX_HINT[s.id]}
                placeholder=""
                value={entries[key] ?? ''}
                disabled
                invalid={false}
                onChange={() => {}}
              />
            )}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="rf-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="rf-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
      {done && <FinishedGraph answer={answer} />}
    </ProblemFrame>
  )
}
