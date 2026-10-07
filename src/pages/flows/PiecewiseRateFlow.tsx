import { useMemo, useRef, useState } from 'react'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { getModule } from '@/content/registry'
import { PW_RULE_IDS } from '@/content/modules/piecewiseRate/rules'
import { transformPattern } from '@/content/modules/transformations/patterns'
import type { AnswerSpec, RuleCard } from '@/content/types'
import { gradeAverageRate, gradePiecewiseValue, toRational, type PiecewisePiece, type TransformGrade } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromTransform } from '@/problem/tutorContext'
import type { ErrorPatternId } from '@/shared/types'
import { PiecewiseMore } from './PiecewiseMore'
import { ProblemFrame } from './ProblemFrame'
import { FnHintLadder, saveFnEntries, useFnHint } from './fnUi'
import { recordTransformGrade } from './record'
import type { FlowProps } from './types'

type PiecewiseAnswer = Extract<AnswerSpec, { type: 'piecewiseRate' }>

const CARD_FOR: Partial<Record<ErrorPatternId, string>> = {
  pw_piecewise_boundary: PW_RULE_IDS.boundary,
  pw_piecewise_wrong_piece: PW_RULE_IDS.boundary,
  pw_piecewise_value_where_undefined: PW_RULE_IDS.boundary,
  pw_piecewise_undefined_where_defined: PW_RULE_IDS.boundary,
  rate_sign_flipped: PW_RULE_IDS.rate,
  rate_no_division: PW_RULE_IDS.rate,
  rate_inverted: PW_RULE_IDS.rate,
  rate_divided_by_b: PW_RULE_IDS.rate,
}

function piecesOf(answer: PiecewiseAnswer): PiecewisePiece[] {
  return (answer.pieces ?? []).map((p) => ({
    formula: p.formula,
    interval: {
      lo: p.lo === '-inf' ? '-inf' : (toRational(p.lo) ?? { n: 0, d: 1 }),
      hi: p.hi === 'inf' ? 'inf' : (toRational(p.hi) ?? { n: 0, d: 1 }),
      loClosed: p.loClosed,
      hiClosed: p.hiClosed,
    },
  }))
}

function casesTex(answer: PiecewiseAnswer): string {
  const rows = (answer.pieces ?? []).map((p) => `${safeLatex(p.formula)} & ${safeLatex(p.condition)}`).join(' \\\\ ')
  return `f(x)=\\begin{cases} ${rows} \\end{cases}`
}

/**
 * Piecewise evaluation or an average rate of change. Answer-only, no graph and no calculator:
 * either picture would give the number away.
 */
export function PiecewiseRateFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'piecewiseRate') return <p className="text-navy">This problem has no function to work with — pick another from the module page.</p>
  if (answer.question === 'graph' || answer.question === 'domain' || answer.question === 'continuous' || answer.question === 'write') {
    return <PiecewiseMore {...props} answer={answer} />
  }
  return <PiecewiseBody {...props} answer={answer} />
}

function PiecewiseBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: PiecewiseAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const [text, setText] = useState(attempt?.final?.fnEntries?.answer ?? '')
  const [grade, setGrade] = useState<TransformGrade | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useFnHint(attempt, done)

  function submit() {
    if (done) return
    const g =
      answer.question === 'evaluate'
        ? gradePiecewiseValue(piecesOf(answer), answer.x ?? '', text)
        : gradeAverageRate(answer.f ?? '', answer.a ?? '', answer.b ?? '', text)
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    saveFnEntries({ answer: text })
    recordTransformGrade(g)
    if (g.verdict === 'correct') finish()
  }

  const pattern = grade?.verdict === 'mistake' ? transformPattern(grade.mistake, grade.witness) : null
  const tutorVerdict = grade ? verdictFromTransform(grade) : undefined
  const cardId = (pattern && CARD_FOR[pattern.id]) || answer.ruleCard
  const card: RuleCard | null = cardsById.get(cardId) ?? null
  const label = answer.question === 'evaluate' ? 'evaluate f' : 'find the average rate'
  const progress: ProgressLine = { stage: done ? 1 : 0, total: 1, label: done ? 'answer checked' : label, solved: done, offPath: false }

  const statement =
    answer.question === 'evaluate' ? (
      <div className="space-y-2">
        <Katex tex={casesTex(answer)} display />
        <p className="text-sm text-navy">Find f({answer.x}). If no piece includes that x, type undefined.</p>
      </div>
    ) : (
      <div className="space-y-1">
        <Katex tex={`f(x) = ${safeLatex(answer.f ?? '')}`} display />
        <Katex tex={`\\text{on } [${safeLatex(answer.a ?? '')},\\ ${safeLatex(answer.b ?? '')}]`} display />
      </div>
    )

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={tutorVerdict}
      statement={statement}
      hints={<FnHintLadder rung={hint.rung} nudge={answer.nudge} card={card} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
      keymap={{ onHint: hint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="pw-answer-title">
        <h2 id="pw-answer-title" className="font-semibold text-navy">
          {answer.question === 'evaluate' ? 'Value' : 'The rate'}
        </h2>
        <ValueField
          value={text}
          disabled={done}
          label={answer.question === 'evaluate' ? 'Value of f(x)' : 'Average rate of change'}
          placeholder={answer.question === 'evaluate' ? '5 or undefined' : '5 or -1/3'}
          onChange={(v) => {
            setText(v)
            saveFnEntries({ answer: v })
          }}
          onSubmit={submit}
        />
        <GradeView grade={grade} />
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
    </ProblemFrame>
  )
}

function GradeView({ grade }: { grade: TransformGrade | null }) {
  if (!grade) return null
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[transformPattern(grade.mistake, grade.witness)]} />
  if (grade.verdict === 'wrong') return <SigFigRejection message={grade.message} patterns={[]} />
  return (
    <p role="alert" className="text-sm font-medium text-bad">
      {grade.message}
    </p>
  )
}

function ValueField({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  label: string
  placeholder: string
  disabled: boolean
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!disabled) onSubmit()
      }}
      className="space-y-2"
      noValidate
    >
      <label htmlFor="pw-value" className="block text-sm font-semibold text-navy">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id="pw-value"
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
        />
        <button type="submit" disabled={disabled} className="min-h-12 shrink-0 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
          Check
        </button>
      </div>
    </form>
  )
}
