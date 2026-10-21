import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Katex } from '@/components/Katex'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { SigFigCorrect, SigFigRejection } from '@/components/SigFigFeedback'
import { RuleCardView } from '@/components/HintPanel'
import { useStuckRequest } from '@/components/Stuck'
import { TrigFigure } from '@/components/TrigFigure'
import { KEYPAD_SETS } from '@/components/keypadKeys'
import { insertToken, type StripKey } from '@/components/symbolStrip'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { gradeAmPart } from '@/content/modules/angleMeasure'
import { gradeUcPart } from '@/content/modules/unitCircle'
import type { TrigPartGrade } from '@/content/modules/trig/parts'
import { pieces } from '@/content/modules/trig/text'
import { getModule } from '@/content/registry'
import type { RuleCard, TrigAnswer, TrigPart } from '@/content/types'
import { patternHit } from '@/engine'
import { readTrigAnswer } from '@/engine/trig'
import type { ProgressLine } from '@/problem/stepEngine'
import { verdictFromTrigPart } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { NotAnAttemptNotice, useHintLadder, type LadderRung } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { recordTrigPartGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: TrigPartGrade
}

const squash = (s: string) => s.replace(/\s+/g, '')

/** What the status line says she is doing, part by part. */
const DOING: Record<string, string> = {
  answer: 'give the answer',
  quadrant: 'say where it lies',
  reference: 'find the reference angle',
  r: 'find r',
  sin: 'find sin θ',
  cos: 'find cos θ',
  tan: 'find tan θ',
  csc: 'find csc θ',
  sec: 'find sec θ',
  cot: 'find cot θ',
}

/** The keys for these answers: π, √, °, the word for no value, and the six functions. */
const TRIG_KEYS: readonly StripKey[] = KEYPAD_SETS.trig

/** A math string: words, with every formula and angle between dollar signs drawn by KaTeX. */
export function TexText({ text }: { text: string }) {
  return (
    <>
      {pieces(text).map((p, i) => (p.tex ? <Katex key={i} tex={p.text} /> : <span key={i}>{p.text}</span>))}
    </>
  )
}

function GradeNote({ grade }: { grade: TrigPartGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  return <SigFigRejection message={grade.message} patterns={[]} />
}

const HINT_LABEL: Record<LadderRung, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

/**
 * The hint ladder of a part (the shared one, with the nudge and the worked lines drawn with KaTeX): the nudge, the
 * rule card (related cards folded under it), then the worked lines, which mark the answer as shown.
 */
function TrigHintLadder({ rung, nudge, card, related, explanation, onAdvance, disabled }: { rung: LadderRung; nudge: string; card: RuleCard | null; related: RuleCard[]; explanation: readonly string[]; onAdvance: () => void; disabled: boolean }) {
  const exhausted = rung === 3
  useStuckRequest(rung, onAdvance, disabled || exhausted)
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">
        Hints never appear on their own.<span className="pointer-coarse:hidden"> Ctrl+Shift+H steps through them.</span>
      </p>
      <button type="button" onClick={onAdvance} disabled={disabled || exhausted} className="min-h-11 w-full rounded-xl bg-gold px-3 font-semibold text-navy hover:bg-gold/80 disabled:opacity-50">
        {HINT_LABEL[rung]}
        {rung === 2 && <span className="ml-1 text-xs font-normal text-gold-text">(marks the answer as shown)</span>}
      </button>
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">
            <TexText text={nudge} />
          </p>
        </div>
      )}
      {rung >= 2 && card && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">Rule</p>
          <RuleCardView card={card} />
          {related.length > 0 && (
            <details className="mt-2 rounded-xl border border-navy-100 bg-white p-2">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-navy">
                Related {related.length === 1 ? 'rule' : 'rules'} ({related.length})
              </summary>
              <div className="mt-2 space-y-2">
                {related.map((c) => (
                  <RuleCardView key={c.id} card={c} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {rung >= 3 && <WorkedLines lines={explanation} title="Worked explanation" />}
    </div>
  )
}

/** The worked lines, one per row, formulas in KaTeX. */
function WorkedLines({ lines, title }: { lines: readonly string[]; title: string }) {
  if (lines.length === 0) return null
  return (
    <section className="rounded-2xl border border-navy-100 bg-navy-50 p-3 text-navy" aria-label={title}>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">{title}</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
        {lines.map((s, i) => (
          <li key={i} data-worked-line="">
            <TexText text={s} />
          </li>
        ))}
      </ol>
    </section>
  )
}

function StageCard({ index, total, part, passed, children }: { index: number; total: number; part: TrigPart; passed: boolean; children: ReactNode }) {
  const titleId = `tr-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      {/* A plain-text heading: KaTeX inside a heading breaks its accessible name. */}
      <h2 id={titleId} className="font-semibold text-navy">
        {total > 1 ? `Part ${index + 1} of ${total}: ${part.label}` : part.label}
      </h2>
      <p className="text-sm text-navy">
        <TexText text={part.ask} />
      </p>
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

/** "Reads as" preview of what she typed, from the trig reader (√, π, ° drawn). */
function previewTex(part: TrigPart, value: string): string {
  if (!value.trim() || part.kind === 'choice') return ''
  const units = part.check.kind === 'value' || part.check.kind === 'decimal' ? part.check.units : undefined
  const r = readTrigAnswer(value, units ? { units } : {})
  if (!r.ok) return ''
  return r.tex
}

function TrigStatement({ answer, showReference }: { answer: TrigAnswer; showReference: boolean }) {
  return (
    <div className="space-y-2">
      <p className="text-navy">
        <TexText text={answer.prompt} />
      </p>
      <TrigFigure spec={answer.figure} showReference={showReference} />
    </div>
  )
}

/** Angles and radian measure: conversions, coterminal angles, the quadrant and reference angle, arcs and sectors. */
export function AngleMeasureFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'angleMeasure') return <p className="text-navy">This problem has no angle to work with — pick another from the module page.</p>
  return <TrigPartsBody {...props} answer={answer} grade={(id, text) => gradeAmPart(answer, id, text)} />
}

/** The unit circle: exact values at special angles, and the ratios of a point on the terminal side. */
export function UnitCircleFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'unitCircle') return <p className="text-navy">This problem has no unit-circle question to work with — pick another from the module page.</p>
  return <TrigPartsBody {...props} answer={answer} grade={(id, text) => gradeUcPart(answer, id, text)} />
}

/**
 * One part at a time: a later part is not on the page until the one before it is right. Each part has its own
 * three-rung hint ladder; her boxes and the part she is on survive a reload. The same answer checked twice (or with a
 * trailing space) is one record. The figure's reference angle appears once she has answered it, or finished.
 */
function TrigPartsBody({ instance, attempt, flags, templateTitle, completion, finish, answer, grade }: FlowProps & { answer: TrigAnswer; grade: (stageId: string, text: string) => TrigPartGrade }) {
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
  const keypadOn = useMathKeypadOn()

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
    recordTrigPartGrade(g)
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

  // The reference angle is drawn once she has answered its part, or once the problem is done.
  const referenceIndex = stages.findIndex((s) => s.id === 'reference')
  const showReference = done || (referenceIndex >= 0 && passed > referenceIndex)

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
      tutorVerdict={shown ? verdictFromTrigPart(shown.grade, entries[stage.id] ?? '') : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<TrigStatement answer={answer} showReference={showReference} />}
      hints={<TrigHintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const value = entries[s.id] ?? ''
        const preview = open ? previewTex(s, value) : ''
        return (
          <StageCard key={s.id} index={i} total={stages.length} part={s} passed={!open && stages.length > 1}>
            {s.kind === 'choice' ? (
              open ? (
                <form onSubmit={submit} noValidate className="space-y-4">
                  <PolyChoice legend={s.label} name={`tr-${s.id}`} options={s.choices ?? []} value={value} disabled={false} onChange={(v) => update(s.id, v)} firstRef={register(s.id)} />
                  <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                    Check
                  </button>
                  {shown && <GradeNote grade={shown.grade} />}
                </form>
              ) : (
                <PolyChoice legend={s.label} name={`tr-${s.id}`} options={s.choices ?? []} value={value} disabled onChange={() => {}} />
              )
            ) : open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {preview && (
                  <div aria-label="Preview" className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
                    <Katex tex={preview} />
                  </div>
                )}
                <PolyTextBox
                  id={`tr-${s.id}`}
                  label={s.label}
                  hint={s.formatHint}
                  placeholder=""
                  value={value}
                  disabled={false}
                  invalid={Boolean(invalid)}
                  onChange={(v) => update(s.id, v)}
                  inputRef={register(s.id)}
                  keypad={{ keys: TRIG_KEYS }}
                />
                {!keypadOn && <SymbolStrip onInsert={(k) => insert(s.id, k)} keys={TRIG_KEYS} disabled={false} />}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  Check
                </button>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : (
              <PolyTextBox id={`tr-${s.id}`} label={s.label} hint={s.formatHint} placeholder="" value={value} disabled invalid={false} onChange={() => {}} />
            )}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="tr-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="tr-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <WorkedLines lines={answer.reveal} title="How it works out" />
        </section>
      )}
    </ProblemFrame>
  )
}
