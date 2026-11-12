import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { GeoFigure } from '@/components/GeoFigure'
import { Katex } from '@/components/Katex'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { SigFigCorrect, SigFigRejection } from '@/components/SigFigFeedback'
import { RuleCardView } from '@/components/HintPanel'
import { useStuckRequest } from '@/components/Stuck'
import { KEYPAD_SETS } from '@/components/keypadKeys'
import { insertToken, type StripKey } from '@/components/symbolStrip'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { gradeOtPart } from '@/content/modules/obliqueTriangles'
import type { TrigPartGrade } from '@/content/modules/trig/parts'
import { getModule } from '@/content/registry'
import type { ObliqueAnswer, RuleCard, TrigPart } from '@/content/types'
import { patternHit } from '@/engine'
import { readTrigAnswer } from '@/engine/trig'
import type { ProgressLine } from '@/problem/stepEngine'
import { verdictFromTrigPart } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { NotAnAttemptNotice, useHintLadder, type LadderRung } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { recordTrigPartGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import { TexText } from './TrigFlow'
import type { FlowProps } from './types'

/**
 * Oblique triangles (precalculus Unit 7): the parts flow of the trig units (TrigFlow), with the triangle drawn by
 * GeoFigure. One part at a time; three hint rungs per part (the nudge, the rule card, the worked lines, which mark the
 * answer as shown); her boxes and the part she is on survive a reload; the same answer checked twice is one record.
 * In the ambiguous case the number of parts would tell how many triangles fit, so until she has answered that part
 * the headings and the status line do not count them, and the figure draws side a only after it.
 */

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: TrigPartGrade
}

const squash = (s: string) => s.replace(/\s+/g, '')

/** What the status line says she is doing, part by part. */
const DOING: Record<string, string> = {
  third: 'find the third angle',
  side: 'find the side',
  count: 'say how many triangles',
  B: 'find B',
  B1: 'find the acute B',
  B2: 'find the obtuse B',
  angle: 'find the angle',
  area: 'find the area',
  law: 'pick the law',
}

/** π, √, ° and the trig keys, as on the right-triangle screens (the degree sign is the one she needs). */
const KEYS: readonly StripKey[] = KEYPAD_SETS.trig

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

function HintLadderView({ rung, nudge, card, related, explanation, onAdvance, disabled }: { rung: LadderRung; nudge: string; card: RuleCard | null; related: RuleCard[]; explanation: readonly string[]; onAdvance: () => void; disabled: boolean }) {
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

/** The part's heading: "Part 2 of 3: Side b", or "Part 1: …" while the number of parts would give an answer away. */
export function partHeading(index: number, total: number | null, label: string): string {
  if (total === null) return `Part ${index + 1}: ${label}`
  return total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label
}

function StageCard({ index, heading, part, passed, children }: { index: number; heading: string; part: TrigPart; passed: boolean; children: ReactNode }) {
  const titleId = `ot-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      {/* A plain-text heading: KaTeX inside a heading breaks its accessible name. */}
      <h2 id={titleId} className="font-semibold text-navy">
        {heading}
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

/** "Reads as" preview of what she typed (the degree sign drawn). */
function previewTex(part: TrigPart, value: string): string {
  if (!value.trim() || part.kind === 'choice') return ''
  const r = readTrigAnswer(value)
  return r.ok ? r.tex : ''
}

/** Oblique triangles: the law of sines, the ambiguous case, the law of cosines, area, and which law starts. */
export function ObliqueFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'obliqueTriangles') return <p className="text-navy">This problem has no triangle to work with — pick another from the module page.</p>
  return <ObliqueBody {...props} answer={answer} />
}

function ObliqueBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: ObliqueAnswer }) {
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

  function update(key: string, value: string) {
    const next = { ...entries, [key]: value }
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
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
    const g = gradeOtPart(answer, stage.id, text)
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

  // The ambiguous case: how many parts there are is the answer to the first, so nothing counts them before it.
  const countHidden = answer.question === 'ambiguous' && !done && passed === 0
  const total = countHidden ? null : stages.length
  const after = answer.oblique.after
  const answeredIds = (done ? stages : stages.slice(0, passed)).map((s) => s.id)
  const figure = after && answeredIds.includes(after.stage) ? after.spec : answer.oblique.before

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: countHidden ? 1 : stages.length,
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
      statement={
        <div className="space-y-2">
          <p className="text-navy">
            <TexText text={answer.prompt} />
          </p>
          <div data-ot="figure" className="mx-auto max-w-md">
            <GeoFigure spec={figure} />
          </div>
        </div>
      }
      hints={<HintLadderView rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const value = entries[s.id] ?? ''
        const preview = open ? previewTex(s, value) : ''
        return (
          <StageCard key={s.id} index={i} heading={partHeading(i, total, s.label)} part={s} passed={!open && stages.length > 1}>
            {s.kind === 'choice' ? (
              open ? (
                <form onSubmit={submit} noValidate className="space-y-4">
                  <PolyChoice legend={s.label} name={`ot-${s.id}`} options={s.choices ?? []} value={value} disabled={false} onChange={(v) => update(s.id, v)} firstRef={register(s.id)} />
                  <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                    Check
                  </button>
                  {shown && <GradeNote grade={shown.grade} />}
                </form>
              ) : (
                <PolyChoice legend={s.label} name={`ot-${s.id}`} options={s.choices ?? []} value={value} disabled onChange={() => {}} />
              )
            ) : open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {preview && (
                  <div aria-label="Preview" className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
                    <Katex tex={preview} />
                  </div>
                )}
                <PolyTextBox
                  id={`ot-${s.id}`}
                  label={s.label}
                  hint={s.formatHint}
                  placeholder=""
                  value={value}
                  disabled={false}
                  invalid={Boolean(invalid)}
                  onChange={(v) => update(s.id, v)}
                  inputRef={register(s.id)}
                  keypad={{ keys: KEYS }}
                />
                {!keypadOn && <SymbolStrip onInsert={(k) => insert(s.id, k)} keys={KEYS} disabled={false} />}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  Check
                </button>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : (
              <PolyTextBox id={`ot-${s.id}`} label={s.label} hint={s.formatHint} placeholder="" value={value} disabled invalid={false} onChange={() => {}} />
            )}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="ot-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="ot-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <WorkedLines lines={answer.reveal} title="How it works out" />
        </section>
      )}
    </ProblemFrame>
  )
}
