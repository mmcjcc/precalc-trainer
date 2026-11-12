import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { SigFigNumeralInput } from '@/components/SigFigNumeralInput'
import { displayAnswer, enteredText, gradeMoStage, MO_KEYS, MO_RULE_FOR, stageLeaks, type MoGrade } from '@/content/modules/moles'
import type { MoleAnswer, MoStage, RuleCard } from '@/content/types'
import { ERROR_PATTERNS, patternHit } from '@/engine'
import { type ProgressLine } from '@/problem/stepEngine'
import type { TutorVerdict } from '@/shared/tutor'
import { useStore } from '@/store'
import { getModule } from '@/content/registry'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

/** The tutor's view of one check (the shape ch9's verdictFromCb builds; tutorContext re-clips it). */
export function verdictFromMo(grade: MoGrade): TutorVerdict {
  if (grade.verdict === 'correct') return { status: 'correct', message: grade.message }
  if (grade.verdict === 'wrong') return { status: 'wrong', message: grade.message }
  if (grade.verdict === 'invalid') return { status: 'parse_error', message: grade.message }
  const info = ERROR_PATTERNS[grade.mistake]
  return {
    status: 'wrong',
    message: grade.witness,
    mistake: { id: grade.mistake, title: info.title, lesson: info.lesson, witness: grade.witness },
  }
}

/** Log one check. A named mistake is stored under its catalog id. Unreadable input is not an attempt. */
function recordMoGrade(grade: MoGrade): void {
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

function GradeNote({ grade, stage }: { grade: MoGrade; stage: MoStage }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} note={grade.note} />
  if (grade.verdict === 'mistake') {
    const hit = patternHit(grade.mistake, grade.witness)
    // A wrong → right example that would show this part's answer is blanked.
    const shown = stageLeaks(stage, hit.example) ? { ...hit, example: '' } : hit
    return <SigFigRejection message={grade.witness} patterns={[shown]} />
  }
  return <SigFigRejection message={grade.message} patterns={[]} />
}

function partTitle(index: number, total: number, label: string): string {
  return total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label
}

/**
 * Chapter 10 (the mole; percent composition and formulas): parts one at a time, modeled on
 * CovalentBondingFlow. Choices are buttons; measured numbers use the sig-fig flow's input with
 * its power-of-ten box and live "reads as" preview; formulas are a whole number beside each
 * symbol. Hints are the shared three-rung ladder; entries survive a reload. A wrong answer names
 * the slip and never states the right one.
 */
export function MoleFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type === 'mole') return <Body {...props} answer={answer} />
  return <p className="text-navy">This problem has no mole question — pick another from the module page.</p>
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: MoleAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<{ stage: number; grade: MoGrade } | null>(null)
  const lastChecked = useRef<string | null>(null)
  const boxes = useRef(new Map<string, HTMLInputElement>())
  const numberBox = useRef<HTMLInputElement | null>(null)
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

  const focusStage = useCallback((s: MoStage) => {
    const key = MO_KEYS[s.id]
    const el = s.kind === 'number' ? numberBox.current : s.kind === 'counts' ? boxes.current.get(`${key}.${s.symbols?.[0] ?? ''}`) : boxes.current.get(key)
    el?.focus({ preventScroll: true })
  }, [])

  const opened = useRef(passed)
  useEffect(() => {
    if (opened.current === passed) return
    opened.current = passed
    focusStage(stages[passed]!)
  }, [passed, stages, focusStage])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
  }

  function update(patch: Entries) {
    store({ ...entries, ...patch })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = enteredText(stage, entries)
    const grade = gradeMoStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusStage(stage)
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordMoGrade(grade)
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
    const firstId = (mistake && MO_RULE_FOR[mistake]) || stage.ruleCard
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

  function openPart(s: MoStage) {
    const key = MO_KEYS[s.id]
    const checkLabel = `Check ${s.label}`
    if (s.kind === 'number') {
      return (
        <>
          <SigFigNumeralInput
            coefficient={entries[key] ?? ''}
            power={entries[`${key}^`] ?? ''}
            onChange={({ coefficient, power }) => update({ [key]: coefficient, [`${key}^`]: power })}
            onSubmit={check}
            unit={s.unit ?? ''}
            submitLabel={checkLabel}
            inputRef={numberBox}
          />
          <p className="text-xs text-navy/70">{s.hint}</p>
        </>
      )
    }
    return (
      <form onSubmit={submit} noValidate className="space-y-4">
        {s.kind === 'choice' && (
          <>
            <PolyChoice
              legend={s.label}
              name={`mo-choice-${s.id}`}
              options={(s.choices ?? []).map((choice) => ({ value: choice.id, label: choice.text }))}
              value={entries[key] ?? ''}
              disabled={false}
              onChange={(v) => update({ [key]: v })}
              firstRef={register(key)}
            />
            <p className="text-xs text-navy/70">{s.hint}</p>
          </>
        )}
        {s.kind === 'whole' && (
          <PolyTextBox
            id={`mo-${s.id}`}
            label={s.label}
            hint={s.hint}
            placeholder=""
            value={entries[key] ?? ''}
            disabled={false}
            invalid={Boolean(invalid)}
            onChange={(v) => update({ [key]: v })}
            inputRef={register(key)}
          />
        )}
        {s.kind === 'counts' && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-navy">{s.label}</legend>
            <div className="flex flex-wrap items-end gap-3">
              {(s.symbols ?? []).map((symbol) => {
                const boxKey = `${key}.${symbol}`
                return (
                  <label key={symbol} className="flex items-end gap-1">
                    <span className="pb-2 text-lg font-semibold text-navy">{symbol}</span>
                    <input
                      ref={register(boxKey)}
                      type="text"
                      inputMode="numeric"
                      aria-label={`${s.label}: ${symbol}`}
                      value={entries[boxKey] ?? ''}
                      onChange={(e) => update({ [boxKey]: e.target.value })}
                      aria-invalid={invalid ? true : undefined}
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                      className="min-h-12 w-16 rounded-xl border-2 border-navy-100 bg-white px-2 py-2 text-center font-mono text-[max(18px,1.125rem)] text-ink outline-none focus:border-navy"
                    />
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-navy/70">{s.hint}</p>
          </fieldset>
        )}
        <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
          {checkLabel}
        </button>
      </form>
    )
  }

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={shown ? verdictFromMo(shown.grade) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<p className="whitespace-pre-line text-sm text-navy">{answer.prompt}</p>}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const titleId = `mo-part-${i}`
        return (
          <section key={s.id} aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
            <h2 id={titleId} className="font-semibold text-navy">
              {partTitle(i, stages.length, s.label)}
            </h2>
            {open ? (
              <div className="space-y-4">
                {openPart(s)}
                {shown && <GradeNote grade={shown.grade} stage={stage} />}
              </div>
            ) : (
              <>
                <p className="font-mono text-sm font-semibold text-navy" data-mo-entry={s.id}>
                  {displayAnswer(s, enteredText(s, entries))}
                </p>
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
        <section aria-labelledby="mo-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="mo-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
