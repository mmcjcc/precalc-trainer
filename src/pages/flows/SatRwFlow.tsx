import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { gradeSatRwChoice, type SatRwGrade } from '@/content/modules/satrw'
import { getModule } from '@/content/registry'
import type { ProblemInstance, RuleCard, SatRwAnswer } from '@/content/types'
import { patternHit } from '@/engine'
import type { ProgressLine } from '@/problem/stepEngine'
import type { TutorVerdict } from '@/shared/tutor'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { savePolyEntries } from './polyUi'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

function Statement({ instance, answer }: { instance: ProblemInstance; answer: SatRwAnswer }) {
  return (
    <div className="space-y-2 text-navy">
      <p className="text-base leading-relaxed">{instance.statementText}</p>
      <p className="text-sm font-semibold text-navy/90">{answer.prompt}</p>
    </div>
  )
}

function GradeNote({ grade }: { grade: SatRwGrade }) {
  if (grade.verdict === 'invalid') {
    return <NotAnAttemptNotice messages={[grade.message]} />
  }
  if (grade.verdict === 'correct') {
    return <SigFigCorrect message={grade.message} />
  }
  const hit = patternHit(grade.mistake, grade.witness)
  return <SigFigRejection message={grade.witness} patterns={[hit]} />
}

function verdictFromSatRw(grade: SatRwGrade): TutorVerdict | null {
  if (grade.verdict === 'invalid') return null
  if (grade.verdict === 'correct') {
    return { status: 'correct', message: grade.message }
  }
  const hit = patternHit(grade.mistake, grade.witness)
  return {
    status: 'wrong',
    message: grade.message,
    mistake: {
      id: hit.id,
      title: hit.title,
      lesson: hit.lesson,
      witness: grade.witness,
    },
  }
}

export function SatRwFlow({ instance, attempt, flags, templateTitle, completion, finish }: FlowProps) {
  const answer = instance.answer as SatRwAnswer
  const done = Boolean(completion)

  const [entries, setEntries] = useState<Record<string, string>>(() => ({ ...attempt?.final?.polyEntries }))
  const [grade, setGrade] = useState<SatRwGrade | null>(null)
  const lastChecked = useRef<string | null>(null)
  const firstRef = useRef<HTMLInputElement>(null)
  const hint = useHintLadder(attempt, done, 0)

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    setEntries({ ...attempt.final?.polyEntries })
  }, [attempt])

  const choice = entries.choice ?? ''
  const checkedWrong = entries.checkedWrong ?? null
  const activeGrade: SatRwGrade | null =
    grade ??
    (checkedWrong && checkedWrong === choice ? gradeSatRwChoice(answer, checkedWrong) : null)

  function onSelectChoice(next: string) {
    const nextEntries: Record<string, string> = { choice: next }
    setEntries(nextEntries)
    savePolyEntries(nextEntries)
    setGrade((prev) => (prev && prev.verdict === 'invalid' ? null : null))
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const g = gradeSatRwChoice(answer, choice)
    setGrade(g)
    if (g.verdict === 'invalid') {
      firstRef.current?.focus({ preventScroll: true })
      return
    }
    if (lastChecked.current === g.optionId) return
    lastChecked.current = g.optionId

    const s = useStore.getState()
    if (g.verdict === 'correct') {
      s.recordFinalAnswer({ correct: true, via: 'text' })
      savePolyEntries({ choice: g.optionId })
      s.setFinal({ polyStage: 1 })
      finish()
      return
    }

    s.recordFinalAnswer({ correct: false, pattern: g.mistake, via: 'text' })
    s.setFinal({ firstCorrect: false })
    const savedWrong = { choice: g.optionId, checkedWrong: g.optionId }
    setEntries(savedWrong)
    savePolyEntries(savedWrong)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    check()
  }

  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = answer.ruleCard
    const others = answer.ruleCards
      .filter((id) => id !== firstId)
      .map((id) => byId.get(id))
      .filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer])

  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'answer checked' : 'choose the best option',
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
      tutorVerdict={activeGrade ? verdictFromSatRw(activeGrade) : undefined}
      nudgeText="Still here? Pick one of the four choices and press Check answer, or open Hints."
      keymap={{ onHint: hint.advance }}
      statement={<Statement instance={instance} answer={answer} />}
      hints={
        <HintLadder
          rung={hint.rung}
          nudge={answer.nudge}
          card={card}
          related={related}
          explanation={answer.reveal}
          onAdvance={hint.advance}
          disabled={done}
        />
      }
    >
      <section aria-labelledby="satrw-choice-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
        <h2 id="satrw-choice-title" className="font-semibold text-navy">
          Choose one option
        </h2>
        <form onSubmit={submit} noValidate className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-navy">{answer.prompt}</legend>
            <div className="mt-2 space-y-2">
              {answer.options.map((opt, idx) => {
                const selected = choice === opt.id
                return (
                  <label
                    key={opt.id}
                    className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-navy ${
                      selected ? 'border-navy bg-gold-100' : 'border-navy-100 bg-white'
                    } ${done ? 'opacity-60' : 'hover:border-navy'}`}
                  >
                    <input
                      ref={idx === 0 ? firstRef : undefined}
                      type="radio"
                      name="satrw-choice"
                      value={opt.id}
                      checked={selected}
                      disabled={done}
                      onChange={() => onSelectChoice(opt.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-navy"
                    />
                    <span className="text-sm leading-snug">
                      <span className="mr-1.5 font-semibold">{opt.id}.</span>
                      <span>{opt.text}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {!done && (
            <button
              type="submit"
              className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
            >
              Check answer
            </button>
          )}

          {activeGrade && <GradeNote grade={activeGrade} />}
        </form>
      </section>

      {done && (
        <section aria-labelledby="satrw-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="satrw-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
