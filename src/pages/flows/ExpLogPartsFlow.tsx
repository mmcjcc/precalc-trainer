import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { insertToken, LOG_KEYS, SET_ANSWER_KEYS, type StripKey } from '@/components/symbolStrip'
import { gradeEgPart, type ExpLogGraphsAnswer } from '@/content/modules/expLogGraphs'
import { gradeEmPart, type ExpModelsAnswer } from '@/content/modules/expModels'
import type { PartGrade } from '@/content/modules/explog/parts'
import { getModule } from '@/content/registry'
import type { ExpLogPart, RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromExpLogPart } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { recordExpLogPartGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>
type Answer = ExpLogGraphsAnswer | ExpModelsAnswer

interface Feedback {
  stage: number
  grade: PartGrade
}

const squash = (s: string) => s.replace(/\s+/g, '')

/** What the status line says she is doing, part by part. */
const DOING: Record<string, string> = {
  domain: 'give the domain',
  range: 'give the range',
  asymptote: 'give the asymptote',
  intercept: 'give the intercept',
  behavior: 'say whether it rises or falls',
  match: 'pick the match',
  inverse: 'write the inverse',
  answer: 'give the answer',
  k: 'find k exactly',
  kRounded: 'round k',
  follow: 'answer the last question',
}

function GradeNote({ grade }: { grade: PartGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  return <SigFigRejection message={grade.message} patterns={[]} />
}

function keysFor(part: ExpLogPart): readonly StripKey[] | null {
  if (part.kind === 'interval') return SET_ANSWER_KEYS
  if (part.kind === 'formula' || part.kind === 'exact' || part.kind === 'point') return LOG_KEYS
  return null
}

function StageCard({ index, total, part, passed, children }: { index: number; total: number; part: ExpLogPart; passed: boolean; children: ReactNode }) {
  const titleId = `el-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      <h2 id={titleId} className="font-semibold text-navy">
        {total > 1 ? `Part ${index + 1} of ${total}: ${part.label}` : part.label}
      </h2>
      <p className="text-sm text-navy">{part.ask}</p>
      {children}
      {passed && (
        <p role="status" className="text-sm font-semibold text-navy">
          <span aria-hidden>✓ </span>
          Right.
        </p>
      )}
    </section>
  )
}

/** The function, and for a matching problem the four candidates: the graphs are part of the question. */
function GraphsStatement({ answer }: { answer: ExpLogGraphsAnswer }) {
  const equation = (
    <div className="overflow-x-auto">
      <Katex tex={answer.tex} display ariaLabel={`${answer.fnName}(x) = ${answer.f}`} />
    </div>
  )
  if (answer.question === 'match' && answer.matchMode === 'equation') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-navy">{answer.prompt}</p>
        <GraphPanel spec={answer.graph} />
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="The four equations">
          {(answer.candidates ?? []).map((c) => (
            <li key={c.letter} className="flex items-center gap-2 rounded-xl border border-navy-100 bg-white px-3 py-2 text-navy">
              <span className="font-semibold">{c.letter}</span>
              <Katex tex={c.tex} ariaLabel={`${c.letter}: ${answer.fnName}(x) = ${c.f}`} />
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if (answer.question === 'match') {
    return (
      <div className="space-y-3">
        {equation}
        <p className="text-sm text-navy">{answer.prompt}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(answer.candidates ?? []).map((c) => (
            <figure key={c.letter} className="space-y-1 rounded-xl border border-navy-100 bg-white p-2">
              <figcaption className="text-sm font-semibold text-navy">Graph {c.letter}</figcaption>
              <GraphPanel spec={c.graph} />
            </figure>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {equation}
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

function ModelsStatement({ answer }: { answer: ExpModelsAnswer }) {
  return (
    <div className="space-y-2">
      <p className="text-navy">{answer.prompt}</p>
      {answer.modelTex && (
        <div className="overflow-x-auto" aria-label="The model">
          <Katex tex={answer.modelTex} display ariaLabel={answer.modelTex} />
        </div>
      )}
    </div>
  )
}

/** Graphs of exponentials and logs: the features part by part, a matching pick, or an inverse. */
export function ExpLogGraphsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'expLogGraphs') return <p className="text-navy">This problem has no exponential or log graph to work with — pick another from the module page.</p>
  const finishedGraph =
    answer.question === 'match' || answer.graph.kind !== 'function' ? null : (
      <section className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="el-graph-title">
        <h2 id="el-graph-title" className="font-semibold text-navy">
          {answer.question === 'inverse' ? 'The graphs of f and f⁻¹' : `The graph of ${answer.fnName}`}
        </h2>
        <p className="text-sm text-navy">
          {answer.question === 'inverse' ? 'f⁻¹ is the mirror image of f across the line y = x.' : 'The dashed line is the asymptote, and the dot is the intercept.'}
        </p>
        <GraphPanel spec={answer.graph} />
      </section>
    )
  return <PartsBody {...props} answer={answer} statement={<GraphsStatement answer={answer} />} grade={(id, text) => gradeEgPart(answer, id, text)} finished={finishedGraph} />
}

/** Growth and decay word problems: each number in its own box, rounded the way the problem asks. */
export function ExpModelsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'expModels') return <p className="text-navy">This problem has no growth or decay model to work with — pick another from the module page.</p>
  return <PartsBody {...props} answer={answer} statement={<ModelsStatement answer={answer} />} grade={(id, text) => gradeEmPart(answer, id, text)} finished={null} />
}

/**
 * One part at a time: a later part is not on the page until the one before it is right. Each part has its
 * own three-rung hint ladder; her boxes and the part she is on survive a reload. The same answer checked
 * twice (or with a trailing space) is one record.
 */
function PartsBody({
  instance,
  attempt,
  flags,
  templateTitle,
  completion,
  finish,
  answer,
  statement,
  grade,
  finished,
}: FlowProps & { answer: Answer; statement: ReactNode; grade: (stageId: string, text: string) => PartGrade; finished: ReactNode }) {
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
    lastChecked.current = null
    setFeedback(null)
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
    focusBox(stages[passed]!.id)
  }, [passed, stages, focusBox])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  function insert(key: string, strip: StripKey) {
    const el = boxes.current.get(key)
    const value = entries[key] ?? ''
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = insertToken(value, start, end, strip)
    update(key, next.value)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = entries[stage.id] ?? ''
    const g = grade(stage.id, text)
    setFeedback({ stage: passed, grade: g })
    if (g.verdict === 'invalid') {
      focusBox(stage.id)
      return
    }
    const sig = `${attempt?.id ?? ''} ${passed} ${squash(text)}`
    if (lastChecked.current === sig) return
    lastChecked.current = sig
    recordExpLogPartGrade(g)
    const s = useStore.getState()
    if (g.verdict !== 'correct') {
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
  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? (stages.length > 1 ? 'all parts checked' : 'answer checked') : (DOING[stage.id] ?? 'give the answer'),
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
      tutorVerdict={shown ? verdictFromExpLogPart(shown.grade, entries[stage.id] ?? '') : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={statement}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const value = entries[s.id] ?? ''
        const keys = keysFor(s)
        const preview = open && (s.kind === 'formula' || s.kind === 'exact') && value.trim() ? safeLatex(value) : ''
        return (
          <StageCard key={s.id} index={i} total={stages.length} part={s} passed={!open && stages.length > 1}>
            {s.kind === 'choice' ? (
              open ? (
                <form onSubmit={submit} noValidate className="space-y-4">
                  <PolyChoice legend={s.label} name={`el-${s.id}`} options={s.choices ?? []} value={value} disabled={false} onChange={(v) => update(s.id, v)} firstRef={register(s.id)} />
                  <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                    Check
                  </button>
                  {shown && <GradeNote grade={shown.grade} />}
                </form>
              ) : (
                <PolyChoice legend={s.label} name={`el-${s.id}`} options={s.choices ?? []} value={value} disabled onChange={() => {}} />
              )
            ) : open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {preview && (
                  <div aria-label="Preview" className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
                    <Katex tex={preview} />
                  </div>
                )}
                <PolyTextBox id={`el-${s.id}`} label={s.label} hint={s.formatHint} placeholder="" value={value} disabled={false} invalid={Boolean(invalid)} onChange={(v) => update(s.id, v)} inputRef={register(s.id)} />
                {keys && <SymbolStrip onInsert={(k) => insert(s.id, k)} keys={keys} disabled={false} />}
                <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  Check
                </button>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : (
              <PolyTextBox id={`el-${s.id}`} label={s.label} hint={s.formatHint} placeholder="" value={value} disabled invalid={false} onChange={() => {}} />
            )}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="el-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="el-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
      {done && finished}
    </ProblemFrame>
  )
}
