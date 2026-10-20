import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Katex } from '@/components/Katex'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { insertToken, type StripKey } from '@/components/symbolStrip'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { gradeCxStage, CX_KEYS, CX_RULE_FOR, type ComplexNumsAnswer, type CxGrade } from '@/content/modules/complexNums'
import { cxToLatex, listToLatex } from '@/content/modules/complexNums/arith'
import { parseCxAnswer } from '@/content/modules/complexNums/parse'
import { modelOf } from '@/content/modules/complexNums/build'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { type ProgressLine } from '@/problem/stepEngine'
import { verdictFromCx } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyTextBox, savePolyEntries } from './polyUi'
import { recordCxGrades } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: CxGrade
}

const COMPLEX_KEYS: readonly StripKey[] = [
  { label: 'i', insert: 'i', caret: 0, name: 'i' },
  { label: '√', insert: 'sqrt()', caret: -1, name: 'square root' },
  { label: '±', insert: '+-', caret: 0, name: 'plus or minus' },
  { label: '(', insert: '(', caret: 0, name: 'open parenthesis' },
  { label: ')', insert: ')', caret: 0, name: 'close parenthesis' },
  { label: '/', insert: '/', caret: 0, name: 'divide' },
]

function previewTex(text: string): string {
  const parsed = parseCxAnswer(text)
  if (!parsed.ok) return ''
  return listToLatex(parsed.values)
}

function Statement({ answer }: { answer: ComplexNumsAnswer }) {
  if (answer.question === 'zeros') {
    const given = parseCxAnswer(answer.givenZero)
    const givenTex = given.ok ? listToLatex(given.values) : answer.givenZero
    return (
      <div className="space-y-2">
        <div className="overflow-x-auto">
          <Katex tex={`f(x) = ${polyTex(answer.f)}`} display ariaLabel={`f(x) = ${answer.f}`} />
        </div>
        <p className="text-sm text-navy">
          One zero is <Katex tex={givenTex} />.
        </p>
        <p className="text-sm text-navy">{answer.prompt}</p>
      </div>
    )
  }
  const tex = statementTex(answer)
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Katex tex={tex} display ariaLabel={answer.expression} />
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

function polyTex(f: string): string {
  return f.replace(/\^(\d+)/g, '^{$1}').replace(/-/g, '-')
}

function statementTex(answer: ComplexNumsAnswer): string {
  if (answer.question === 'quadratic') return polyTex(answer.expression)
  if (answer.question === 'powers') {
    const pow = answer.expression.match(/^i\^\(?(-?\d+)\)?$/)
    if (pow) return `i^{${pow[1]}}`
    const prod = answer.expression.match(/^sqrt\(-(\d+)\) \* sqrt\(-(\d+)\)$/)
    if (prod) return `\\sqrt{-${prod[1]}}\\cdot\\sqrt{-${prod[2]}}`
    const sq = answer.expression.match(/^sqrt\(-(\d+)\)$/)
    if (sq) return `\\sqrt{-${sq[1]}}`
  }
  const model = modelOf(answer)
  if ((answer.question === 'arith' || answer.question === 'divide') && model.z1 && model.z2) {
    const a = cxToLatex(model.z1)
    const b = cxToLatex(model.z2)
    if (answer.question === 'divide') return `\\dfrac{${a}}{${b}}`
    if (model.op === '*') return `(${a})(${b})`
    if (model.op === '-') return `(${a})-(${b})`
    return `(${a})+(${b})`
  }
  return answer.expression.replace(/sqrt\(([^)]+)\)/g, '\\sqrt{$1}').replace(/\*/g, '\\cdot ')
}

function GradeNote({ grade }: { grade: CxGrade }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.mistake, grade.witness)]} />
  return <SigFigRejection message={grade.message} patterns={[]} />
}

/**
 * Complex numbers. Every problem is answered in one box. Hints are the shared three-rung ladder;
 * her entries are stored on polyEntries and survive a reload.
 */
export function ComplexNumsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'complexNums') return <p className="text-navy">This problem has no complex number to work with — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: ComplexNumsAnswer }) {
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

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  function insert(key: StripKey) {
    const boxKey = CX_KEYS[stage.id]
    const el = boxes.current.get(boxKey)
    const value = entries[boxKey] ?? ''
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = insertToken(value, start, end, key)
    update(boxKey, next.value)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = entries[CX_KEYS[stage.id]] ?? ''
    const grade = gradeCxStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      boxes.current.get(CX_KEYS[stage.id])?.focus({ preventScroll: true })
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordCxGrades(grade)
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
    const firstId = (mistake && CX_RULE_FOR[mistake]) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? 'answer checked' : 'give the answer',
    solved: done,
    offPath: false,
  }

  const boxKey = CX_KEYS[stage.id]
  const preview = previewTex(entries[boxKey] ?? '')

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={shown ? verdictFromCx(shown.grade) : undefined}
      nudgeText="Still here? The box is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = CX_KEYS[s.id]
        return (
          <section key={s.id} aria-labelledby="cx-answer-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
            <h2 id="cx-answer-title" className="font-semibold text-navy">
              Your answer
            </h2>
            {open ? (
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
                  id={`cx-${s.id}`}
                  label="Answer"
                  hint="Standard form a + bi. A pair can be 2 + 3i, 2 - 3i or 2 +- 3i."
                  placeholder=""
                  value={entries[key] ?? ''}
                  disabled={false}
                  invalid={Boolean(invalid)}
                  onChange={(v) => update(key, v)}
                  inputRef={register(key)}
                  keypad={{ keys: COMPLEX_KEYS }}
                />
                {!keypadOn && <SymbolStrip onInsert={insert} keys={COMPLEX_KEYS} disabled={false} />}
                <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  Check the answer
                </button>
                {shown && <GradeNote grade={shown.grade} />}
              </form>
            ) : (
              <PolyTextBox
                id={`cx-${s.id}`}
                label="Answer"
                hint="Standard form a + bi."
                placeholder=""
                value={entries[key] ?? ''}
                disabled
                invalid={false}
                onChange={() => {}}
              />
            )}
          </section>
        )
      })}

      {done && (
        <section aria-labelledby="cx-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="cx-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
