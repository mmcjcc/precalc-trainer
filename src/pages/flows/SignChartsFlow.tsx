import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { gradeScStage, SC_KEYS, SC_RULE_FOR, type ScGrade, type SignChartsAnswer } from '@/content/modules/signCharts'
import { math } from '@/content/modules/signCharts/model'
import type { SignChartsStageId } from '@/content/types'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromSc } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { recordScGrades } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>
type SignMark = '' | '+' | '-'

interface Feedback {
  stage: number
  grade: ScGrade
}

const STAGE_TITLE: Record<SignChartsStageId, string> = {
  critical: 'Critical numbers',
  signs: 'Signs',
  solution: 'Solution set',
}

const STAGE_LABEL: Record<SignChartsStageId, string> = {
  critical: 'give the critical numbers',
  signs: 'give the sign on each interval',
  solution: 'give the solution set',
}

const CHECK_LABEL: Record<SignChartsStageId, string> = {
  critical: 'Check the critical numbers',
  signs: 'Check the signs',
  solution: 'Check the solution',
}

const PASSED_NOTE: Record<SignChartsStageId, string> = {
  critical: 'The critical numbers are right.',
  signs: 'The signs are right.',
  solution: 'The solution set is right.',
}

const BOX_HINT: Record<Exclude<SignChartsStageId, 'signs'>, string> = {
  critical: 'Numbers from least to greatest, separated by commas. Type none if there are none.',
  solution: 'Interval notation, with U between the pieces. Type no solution if there is none.',
}

function Statement({ answer }: { answer: SignChartsAnswer }) {
  const tex = safeLatex(answer.inequality)
  const label = math(answer.inequality)
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        {tex ? (
          <Katex tex={tex} display ariaLabel={label} />
        ) : (
          <p className="font-mono text-lg text-navy">{label}</p>
        )}
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

/** The expression, with the solution marked. Rendered only once the problem is finished. */
function FinishedGraph({ answer }: { answer: SignChartsAnswer }) {
  if (answer.graph.kind !== 'function' || !answer.graph.f) return null
  const asymptotes = (answer.graph.guides?.length ?? 0) > 0
  const holes = (answer.graph.dots ?? []).some((d) => !d.closed)
  return (
    <section className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="sc-graph-title">
      <h2 id="sc-graph-title" className="font-semibold text-navy">
        The graph
      </h2>
      <p className="text-sm text-navy">
        Gold marks the solution on the x-axis.
        {asymptotes ? ' Dashed lines are where the expression is undefined.' : ''}
        {holes ? ' An open dot is a hole.' : ''}
      </p>
      <GraphPanel spec={answer.graph} caption={`graph of ${math(answer.graph.f)}`} />
    </section>
  )
}

function StageCard({ index, total, id, passed, children }: { index: number; total: number; id: SignChartsStageId; passed: boolean; children: ReactNode }) {
  const titleId = `sc-part-${index}`
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

function GradeNote({ grade }: { grade: ScGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  return <SigFigRejection message={grade.message} patterns={[]} />
}

function readSignRow(text: string | undefined, count: number): SignMark[] {
  const raw = (text ?? '').replace(/[−–—]/g, '-')
  const tokens = raw.includes(',') ? raw.split(',').map((part) => part.trim()) : raw.trim() ? raw.trim().split(/\s+/) : []
  return Array.from({ length: count }, (_, i) => {
    const token = (tokens[i] ?? '').trim()
    if (token === '+') return '+'
    if (token === '-') return '-'
    return ''
  })
}

function writeSignRow(signs: readonly SignMark[]): string {
  return signs.join(',')
}

/** First choice is +, then + and − trade places. */
function toggled(s: SignMark): SignMark {
  return s === '+' ? '-' : '+'
}

function SignRow({
  intervals,
  value,
  disabled,
  onChange,
  firstRef,
}: {
  intervals: readonly string[]
  value: string
  disabled: boolean
  onChange: (next: string) => void
  firstRef?: (el: HTMLButtonElement | null) => void
}) {
  const signs = readSignRow(value, intervals.length)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function write(index: number, sign: SignMark) {
    if (disabled) return
    onChange(writeSignRow(signs.map((s, i) => (i === index ? sign : s))))
  }

  function onKey(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const to = e.key === 'ArrowRight' ? Math.min(intervals.length - 1, index + 1) : Math.max(0, index - 1)
      refs.current[to]?.focus()
      return
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      write(index, '+')
      return
    }
    if (e.key === '-' || e.key === '−' || e.key === '–') {
      e.preventDefault()
      write(index, '-')
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      write(index, toggled(signs[index] ?? ''))
    }
  }

  return (
    <div role="group" aria-label="Signs on each interval" className="flex flex-wrap gap-3">
      {intervals.map((interval, i) => {
        const sign = signs[i] ?? ''
        const word = sign === '+' ? 'positive' : sign === '-' ? 'negative' : 'not chosen'
        return (
          <div key={interval} className="flex flex-col items-center gap-1">
            <button
              type="button"
              ref={(el) => {
                refs.current[i] = el
                if (i === 0) firstRef?.(el)
              }}
              style={{ width: 44, height: 44 }}
              className={`h-11 w-11 rounded-xl border-2 text-lg font-semibold text-navy ${sign ? 'border-navy bg-gold-100' : 'border-navy-100 bg-white'} ${disabled ? 'opacity-60' : 'hover:border-navy'}`}
              aria-label={`Sign on ${math(interval)}: ${word}`}
              disabled={disabled}
              onClick={() => write(i, toggled(sign))}
              onKeyDown={(e) => onKey(e, i)}
            >
              {sign === '+' ? '+' : sign === '-' ? '−' : '·'}
            </button>
            <span className="max-w-24 text-center text-xs text-navy/70">{math(interval)}</span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Polynomial and rational inequalities. One part at a time:
 *  - sc.poly and sc.rational: the solution set;
 *  - sc.chart: critical numbers, then the sign on each interval, then the solution set.
 * The graph is drawn only after she finishes.
 */
export function SignChartsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'signCharts') return <p className="text-navy">This problem has no inequality to solve — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: SignChartsAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const lastChecked = useRef<string | null>(null)
  const boxes = useRef(new Map<string, HTMLInputElement>())
  const signFirst = useRef<HTMLButtonElement>(null)
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
    if (stages[passed]!.id === 'signs') signFirst.current?.focus()
    else focusBox(SC_KEYS[stages[passed]!.id])
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
    const text = entries[SC_KEYS[stage.id]] ?? ''
    const grade = gradeScStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      if (stage.id === 'signs') signFirst.current?.focus()
      else focusBox(SC_KEYS[stage.id])
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordScGrades(grade)
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
    const firstId = (mistake && SC_RULE_FOR[mistake]) || stage.ruleCard
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
      tutorVerdict={shown ? verdictFromSc(shown.grade) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = SC_KEYS[s.id]
        return (
          <StageCard key={s.id} index={i} total={stages.length} id={s.id} passed={!open && stages.length > 1}>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {s.id === 'signs' ? (
                  <SignRow
                    intervals={answer.intervals}
                    value={entries[key] ?? ''}
                    disabled={false}
                    onChange={(v) => update(key, v)}
                    firstRef={(el) => {
                      signFirst.current = el
                    }}
                  />
                ) : (
                  <PolyTextBox
                    id={`sc-${s.id}`}
                    label={STAGE_TITLE[s.id]}
                    hint={BOX_HINT[s.id]}
                    placeholder=""
                    value={entries[key] ?? ''}
                    disabled={false}
                    invalid={Boolean(invalid)}
                    onChange={(v) => update(key, v)}
                    inputRef={register(key)}
                  />
                )}
                <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {CHECK_LABEL[s.id]}
                </button>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : s.id === 'signs' ? (
              <SignRow intervals={answer.intervals} value={entries[key] ?? ''} disabled onChange={() => {}} />
            ) : (
              <PolyTextBox
                id={`sc-${s.id}`}
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
        <section aria-labelledby="sc-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="sc-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
      {done && <FinishedGraph answer={answer} />}
    </ProblemFrame>
  )
}
