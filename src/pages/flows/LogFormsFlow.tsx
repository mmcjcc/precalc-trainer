import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Katex } from '@/components/Katex'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { insertToken, LOG_KEYS, type StripKey } from '@/components/symbolStrip'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { LF_KEYS, lfRuleFor, type LogFormsAnswer } from '@/content/modules/logForms'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { numberForms, safeExample, safeLesson, safeWitness } from '@/content/modules/explog/text'
import { gradeConvertForm, gradeLogValue, patternHit, type LogGrade } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromLog } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { recordLogGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  grade: LogGrade
}

function formsOf(answer: LogFormsAnswer): string[] {
  return answer.question === 'value' ? numberForms(answer.answerText) : [answer.answerText]
}

function gradeBox(answer: LogFormsAnswer, text: string): LogGrade {
  if (answer.question === 'convert') return gradeConvertForm(answer.problem, text, ['x'])
  return gradeLogValue(answer.problem, text, answer.places ? { decimal: { places: answer.places } } : {})
}

function GradeNote({ grade, forms }: { grade: LogGrade; forms: readonly string[] }) {
  if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    const witness = safeWitness(grade.witness, forms)
    const hit = patternHit(grade.mistake, witness)
    const example = safeExample(hit.example, forms)
    const lesson = safeLesson(hit.lesson, forms)
    return <SigFigRejection message={witness} patterns={[{ ...hit, example, lesson }]} />
  }
  const message = safeWitness(grade.message, forms)
  return <SigFigRejection message={message === grade.message ? grade.message : message} patterns={[]} />
}

/**
 * Logarithms and exponential form. One box: an exact value, the other form, or a rounded
 * change-of-base value. Hints are the shared three-rung ladder; her entry survives a reload.
 */
export function LogFormsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'logForms') return <p className="text-navy">This problem has no logarithm to work with — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: LogFormsAnswer }) {
  const done = Boolean(completion)
  const forms = useMemo(() => formsOf(answer), [answer])
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const lastChecked = useRef<string | null>(null)
  const box = useRef<HTMLInputElement | null>(null)
  const hint = useHintLadder(attempt, done)
  const stage = answer.stages[0]!
  const keypadOn = useMathKeypadOn()

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    setEntries({ ...attempt.final?.polyEntries })
  }, [attempt])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && (f.grade.verdict === 'invalid' || f.grade.verdict === 'unsupported') ? null : f))
  }

  function insert(key: StripKey) {
    const el = box.current
    const value = entries[LF_KEYS.answer] ?? ''
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = insertToken(value, start, end, key)
    store({ ...entries, [LF_KEYS.answer]: next.value })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = entries[LF_KEYS.answer] ?? ''
    const grade = gradeBox(answer, text)
    setFeedback({ grade })
    if (grade.verdict === 'invalid' || grade.verdict === 'unsupported') {
      box.current?.focus({ preventScroll: true })
      return
    }
    if (lastChecked.current === text) return
    lastChecked.current = text
    recordLogGrade(grade)
    if (grade.verdict !== 'correct') {
      useStore.getState().setFinal({ firstCorrect: false })
      return
    }
    finish()
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    check()
  }

  const shown = feedback?.grade ?? null
  const invalid = shown?.verdict === 'invalid' || shown?.verdict === 'unsupported'
  const mistake = shown?.verdict === 'mistake' ? shown.mistake : null
  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = (mistake && lfRuleFor(mistake)) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'answer checked' : 'give the answer',
    solved: done,
    offPath: false,
  }
  const typed = entries[LF_KEYS.answer] ?? ''
  const preview = typed.trim() ? safeLatex(typed) : ''
  const register = useCallback((el: HTMLInputElement | null) => {
    box.current = el
  }, [])

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={shown ? verdictFromLog(shown, typed) : undefined}
      nudgeText="Still here? The box is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={
        <div className="space-y-2">
          <div className="overflow-x-auto">
            <Katex tex={safeLatex(answer.problem)} display ariaLabel={answer.problem} />
          </div>
          <p className="text-sm text-navy">{answer.prompt}</p>
        </div>
      }
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      <section aria-labelledby="lf-answer-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
        <h2 id="lf-answer-title" className="font-semibold text-navy">
          Your answer
        </h2>
        {done ? (
          <PolyTextBox id="lf-answer" label="Answer" hint={answer.formatHint} placeholder="" value={typed} disabled invalid={false} onChange={() => {}} />
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            {preview ? (
              <div aria-label="Preview" className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-navy">
                <Katex tex={preview} />
              </div>
            ) : (
              <div aria-label="Preview" className="flex min-h-10 items-center rounded-lg bg-navy-50 px-3 py-1.5 text-sm text-navy/50">
                preview appears here
              </div>
            )}
            <PolyTextBox
              id="lf-answer"
              label="Answer"
              hint={answer.formatHint}
              placeholder=""
              value={typed}
              disabled={false}
              invalid={Boolean(invalid)}
              onChange={(v) => store({ ...entries, [LF_KEYS.answer]: v })}
              inputRef={register}
              keypad={{ keys: LOG_KEYS }}
            />
            {!keypadOn && <SymbolStrip onInsert={insert} keys={LOG_KEYS} disabled={false} />}
            <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
              Check the answer
            </button>
            {shown && <GradeNote grade={shown} forms={forms} />}
          </form>
        )}
      </section>

      {done && (
        <section aria-labelledby="lf-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="lf-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
