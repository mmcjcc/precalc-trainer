import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Katex } from '@/components/Katex'
import { FUNCTION_KEYS } from '@/components/symbolStrip'
import { MathInput } from '@/components/MathInput'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { getModule } from '@/content/registry'
import { TR_RULE_IDS } from '@/content/modules/transformations/rules'
import { transformPattern } from '@/content/modules/transformations/patterns'
import type { AnswerSpec, RuleCard } from '@/content/types'
import {
  gradeDescription,
  gradeEquation,
  gradeMappedPoint,
  keyFeatures,
  makeTransform,
  parsePointAnswer,
  type DescriptionGrade,
  type ExactPoint,
  type StepCheck,
  type TransformGrade,
  type TransformSpec,
} from '@/engine'
import { ratToString, type Rational } from '@/notation'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromTransform } from '@/problem/tutorContext'
import type { ErrorPatternId } from '@/shared/types'
import { ProblemFrame } from './ProblemFrame'
import { FnHintLadder, saveFnEntries, useFnHint } from './fnUi'
import { recordTransformGrade } from './record'
import type { FlowProps } from './types'

type TransformAnswer = Extract<AnswerSpec, { type: 'transformations' }>
type AnyGrade = TransformGrade | DescriptionGrade

type UiStep =
  | { kind: 'shift'; direction: 'left' | 'right' | 'up' | 'down'; amount: string }
  | { kind: 'scale'; axis: 'horizontal' | 'vertical'; word: 'stretch' | 'compress'; factor: string }
  | { kind: 'reflect'; axis: 'x' | 'y' }

const CARD_FOR: Partial<Record<ErrorPatternId, string>> = {
  tr_h_shift_reversed: TR_RULE_IDS.shift,
  tr_v_shift_reversed: TR_RULE_IDS.shift,
  tr_v_shift_inside: TR_RULE_IDS.shift,
  tr_missing_step: TR_RULE_IDS.shift,
  tr_extra_step: TR_RULE_IDS.shift,
  tr_h_factor_inverted: TR_RULE_IDS.hScale,
  tr_v_factor_inverted: TR_RULE_IDS.vScale,
  tr_v_factor_inside: TR_RULE_IDS.vScale,
  tr_reflection_wrong_axis: TR_RULE_IDS.reflect,
  tr_missing_reflection: TR_RULE_IDS.reflect,
  tr_unfactored_shift: TR_RULE_IDS.factor,
  tr_h_order: TR_RULE_IDS.point,
  tr_v_order: TR_RULE_IDS.point,
  tr_factors_swapped: TR_RULE_IDS.point,
}

function showMinus(text: string): string {
  return text.replace(/-/g, '−')
}

function fmt(r: Rational): string {
  return showMinus(ratToString(r))
}

function fmtPt(p: ExactPoint): string {
  return `(${fmt(p.x)}, ${fmt(p.y)})`
}

function matchingClose(s: string, open: number): number {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    if (s[i] === '(') depth++
    else if (s[i] === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** f(2x − 6) is not an expression the formula renderer accepts, so the f( ) is wrapped by hand. */
function fNotationTex(notation: string): string {
  const i = notation.indexOf('f(')
  if (i < 0) return safeLatex(notation)
  const close = matchingClose(notation, i + 1)
  if (close < 0) return safeLatex(notation)
  const coef = notation.slice(0, i)
  const inside = notation.slice(i + 2, close)
  const tail = notation.slice(close + 1).trim()
  const coefTex = coef === '' ? '' : coef === '-' ? '-' : safeLatex(coef)
  const tailTex = tail ? safeLatex(`0 ${tail}`).replace(/^0/, '') : ''
  return `${coefTex}f\\left(${safeLatex(inside)}\\right)${tailTex}`
}

function isUiStep(v: unknown): v is UiStep {
  if (!v || typeof v !== 'object') return false
  const s = v as UiStep
  if (s.kind === 'reflect') return s.axis === 'x' || s.axis === 'y'
  if (s.kind === 'shift') return (s.direction === 'left' || s.direction === 'right' || s.direction === 'up' || s.direction === 'down') && typeof s.amount === 'string'
  if (s.kind === 'scale') {
    return (s.axis === 'horizontal' || s.axis === 'vertical') && (s.word === 'stretch' || s.word === 'compress') && typeof s.factor === 'string'
  }
  return false
}

function loadSteps(raw: string | undefined): UiStep[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    return v.filter(isUiStep)
  } catch {
    return []
  }
}

function summary(steps: UiStep[]): string {
  return steps
    .map((s) => {
      if (s.kind === 'reflect') return `reflect over the ${s.axis}-axis`
      if (s.kind === 'shift') return `shift ${s.direction} ${s.amount}`.trim()
      return `${s.word} ${s.axis}ly by ${s.factor}`.trim()
    })
    .join('; ')
}

function pointReading(text: string): string {
  const t = text.trim()
  if (!t) return 'Type a point like (4, −2).'
  const parsed = parsePointAnswer(t)
  if (!parsed.ok) return 'not readable yet'
  if (parsed.x === null || parsed.y === null) return 'reads as a number that is not an exact fraction'
  return `reads as (${fmt(parsed.x)}, ${fmt(parsed.y)})`
}

function GradeBlock({ grade }: { grade: AnyGrade | null }) {
  if (!grade) return null
  let card: ReactNode = null
  if (grade.verdict === 'correct') card = <SigFigCorrect message={grade.message} />
  else if (grade.verdict === 'mistake') card = <SigFigRejection message={grade.witness} patterns={[transformPattern(grade.mistake, grade.witness)]} />
  else if (grade.verdict === 'wrong') card = <SigFigRejection message={grade.message} patterns={[]} />
  else card = <p role="alert" className="text-sm font-medium text-bad">{grade.message}</p>
  const checks = 'checks' in grade ? grade.checks : null
  return (
    <div className="space-y-3">
      {card}
      {checks && checks.length > 0 && <StepChecks checks={checks} />}
    </div>
  )
}

const CHECK_WORD = { correct: 'Correct', wrong: 'Wrong', missing: 'Missing', extra: 'Extra' } as const

function StepChecks({ checks }: { checks: StepCheck[] }) {
  return (
    <ul aria-label="Step checks" className="space-y-1 text-sm text-navy">
      {checks.map((c, i) => (
        <li key={i} className={c.status === 'correct' ? 'text-ok' : 'text-bad'}>
          <span aria-hidden>{c.status === 'correct' ? '✓ ' : '✗ '}</span>
          <span className="font-semibold">{CHECK_WORD[c.status]}. </span>
          {c.message}
        </li>
      ))}
    </ul>
  )
}

function KeyPoints({ spec }: { spec: TransformSpec }) {
  const features = keyFeatures(spec)
  return (
    <div className="mt-3 space-y-2 text-sm text-navy">
      <p className="font-semibold">Key points of f, and where they land on g</p>
      {features.asymptotes && (
        <p>
          Asymptotes of g: x = {fmt(features.asymptotes.vertical)}, y = {fmt(features.asymptotes.horizontal)}. The two branches are not joined across the vertical asymptote.
        </p>
      )}
      <ul className="list-disc space-y-1 pl-5">
        {features.points.map((p, i) => (
          <li key={i}>
            {fmtPt(p.parent)} on f → {fmtPt(p.image)} on g
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Transformations: a set of step cards, a mapped point, or an explicit formula. The graph of f (gray)
 * and g (coral) stays behind the reveal gate, with the key points listed under it.
 */
export function TransformationFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'transformations') return <p className="text-navy">This problem has no transformation to work with — pick another from the module page.</p>
  return <TransformationBody {...props} answer={answer} />
}

function TransformationBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: TransformAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const spec = useMemo(() => makeTransform(answer.parent, { a: answer.a, b: answer.b, h: answer.h, k: answer.k }), [answer])
  const saved = attempt?.final?.fnEntries
  const [steps, setSteps] = useState<UiStep[]>(() => loadSteps(saved?.steps))
  const [text, setText] = useState(saved?.answer ?? '')
  const [grade, setGrade] = useState<AnyGrade | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useFnHint(attempt, done)

  function persistSteps(next: UiStep[]) {
    saveFnEntries({ steps: JSON.stringify(next), answer: summary(next) })
  }

  function persistText(next: string) {
    saveFnEntries({ answer: next })
  }

  function submitSteps() {
    if (done) return
    const g = gradeDescription(spec, steps, { form: answer.form })
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = JSON.stringify(steps)
    if (lastChecked.current === key) return
    lastChecked.current = key
    persistSteps(steps)
    recordTransformGrade(g)
    if (g.verdict === 'correct') finish()
  }

  function submitPoint() {
    if (done || !answer.sourcePoint) return
    const g = gradeMappedPoint(spec, pointLike(answer.sourcePoint), text, { form: answer.form })
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    persistText(text)
    recordTransformGrade(g)
    if (g.verdict === 'correct') finish()
  }

  function submitEquation() {
    if (done) return
    const g = gradeEquation(spec, text, { form: answer.form })
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    persistText(text)
    recordTransformGrade(g)
    if (g.verdict === 'correct') finish()
  }

  const pattern = grade?.verdict === 'mistake' ? transformPattern(grade.mistake, grade.witness) : null
  const tutorVerdict = grade ? verdictFromTransform(grade) : undefined
  const cardId = (pattern && CARD_FOR[pattern.id]) || answer.ruleCard
  const card: RuleCard | null = cardsById.get(cardId) ?? null
  const label = answer.question === 'describe' ? 'list the transformations' : answer.question === 'point' ? 'map the point' : 'write g(x)'
  const progress: ProgressLine = { stage: done ? 1 : 0, total: 1, label: done ? 'answer checked' : label, solved: done, offPath: false }
  const invalidIndex = grade?.verdict === 'invalid' && 'index' in grade ? grade.index : -1

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={tutorVerdict}
      graphCaption={`graphs of f(x) = ${answer.parentFormula} and g`}
      graphFooter={<KeyPoints spec={spec} />}
      statement={<Statement answer={answer} />}
      hints={<FnHintLadder rung={hint.rung} nudge={answer.nudge} card={card} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
      keymap={{ onHint: hint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="tr-answer-title">
        <h2 id="tr-answer-title" className="font-semibold text-navy">
          {answer.question === 'describe' && 'Transformations'}
          {answer.question === 'point' && 'Your answer'}
          {answer.question === 'equation' && 'Formula for g'}
        </h2>
        {answer.question === 'describe' && (
          <StepBuilder
            steps={steps}
            disabled={done}
            invalidIndex={invalidIndex}
            onChange={(next) => {
              setSteps(next)
              persistSteps(next)
            }}
            onSubmit={submitSteps}
          />
        )}
        {answer.question === 'point' && (
          <PointField
            value={text}
            disabled={done}
            onChange={(v) => {
              setText(v)
              persistText(v)
            }}
            onSubmit={submitPoint}
          />
        )}
        {answer.question === 'equation' && (
          <MathInput
            value={text}
            onChange={(v) => {
              setText(v)
              persistText(v)
            }}
            onSubmit={submitEquation}
            label="Formula for g(x)"
            placeholder="(x - 3)^2 + 1"
            submitLabel="Check"
            stripKeys={FUNCTION_KEYS}
            disabled={done}
            toTex={(t) => safeLatex(t)}
          />
        )}
        <GradeBlock grade={grade} />
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
    </ProblemFrame>
  )
}

function pointLike(text: string): { x: string; y: string } {
  const parsed = parsePointAnswer(text)
  if (!parsed.ok || parsed.x === null || parsed.y === null) return { x: text, y: text }
  return { x: ratToString(parsed.x), y: ratToString(parsed.y) }
}

function Statement({ answer }: { answer: TransformAnswer }) {
  return (
    <div className="space-y-2">
      <Katex tex={`f(x) = ${safeLatex(answer.parentFormula)}`} display />
      {answer.question !== 'equation' && answer.notation && <Katex tex={`g(x) = ${fNotationTex(answer.notation)}`} display />}
      {answer.question === 'point' && answer.sourcePoint && (
        <p className="text-sm text-navy">
          {showMinus(answer.sourcePoint)} is on the graph of f. What point is on the graph of g?
        </p>
      )}
      {answer.question === 'equation' && (
        <div className="text-sm text-navy">
          <p>g is the {answer.parentWords} function after these transformations. Order in the list is the usual order; any order is accepted.</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {answer.sentences.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {answer.question === 'describe' && <p className="text-sm text-navy">f is the {answer.parentWords} function. List every transformation from f to g.</p>}
    </div>
  )
}

function StepBuilder({
  steps,
  disabled,
  invalidIndex,
  onChange,
  onSubmit,
}: {
  steps: UiStep[]
  disabled: boolean
  invalidIndex: number
  onChange: (steps: UiStep[]) => void
  onSubmit: () => void
}) {
  function update(i: number, step: UiStep) {
    onChange(steps.map((s, j) => (j === i ? step : s)))
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!disabled) onSubmit()
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className={`rounded-xl border p-3 ${invalidIndex === i ? 'border-bad bg-bad-100' : 'border-navy-100 bg-navy-50'}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-navy">Step {i + 1}</p>
              <button type="button" disabled={disabled} onClick={() => onChange(steps.filter((_, j) => j !== i))} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-coral-700 hover:bg-white disabled:opacity-50">
                Remove step {i + 1}
              </button>
            </div>
            <StepFields step={step} index={i} disabled={disabled} onChange={(next) => update(i, next)} />
          </li>
        ))}
      </ul>
      {steps.length === 0 && <p className="text-sm text-navy/70">No steps yet. Add each transformation g applies to f.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => onChange([...steps, { kind: 'shift', direction: 'right', amount: '' }])} className="min-h-11 rounded-xl border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50 disabled:opacity-50">
          Add a shift
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange([...steps, { kind: 'scale', axis: 'horizontal', word: 'stretch', factor: '' }])} className="min-h-11 rounded-xl border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50 disabled:opacity-50">
          Add a stretch or compress
        </button>
        <button type="button" disabled={disabled} onClick={() => onChange([...steps, { kind: 'reflect', axis: 'x' }])} className="min-h-11 rounded-xl border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50 disabled:opacity-50">
          Add a reflection
        </button>
      </div>
      <button type="submit" disabled={disabled} className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
        Check
      </button>
    </form>
  )
}

function StepFields({ step, index, disabled, onChange }: { step: UiStep; index: number; disabled: boolean; onChange: (step: UiStep) => void }) {
  const n = index + 1
  const select = 'min-h-11 rounded-lg border-2 border-navy-100 bg-white px-2 text-navy disabled:bg-navy-50'
  const input = 'min-h-11 w-24 rounded-lg border-2 border-navy-100 bg-white px-2 font-mono text-[max(16px,1rem)] text-ink disabled:bg-navy-50'
  if (step.kind === 'shift') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-navy">shift</span>
        <select aria-label={`Direction for step ${n}`} className={select} disabled={disabled} value={step.direction} onChange={(e) => onChange({ ...step, direction: e.target.value as 'left' | 'right' | 'up' | 'down' })}>
          <option value="left">left</option>
          <option value="right">right</option>
          <option value="up">up</option>
          <option value="down">down</option>
        </select>
        <span className="text-sm text-navy">by</span>
        <input aria-label={`Amount for step ${n}`} className={input} disabled={disabled} value={step.amount} inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="3" onChange={(e) => onChange({ ...step, amount: e.target.value })} />
      </div>
    )
  }
  if (step.kind === 'scale') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Word for step ${n}`} className={select} disabled={disabled} value={step.word} onChange={(e) => onChange({ ...step, word: e.target.value === 'compress' ? 'compress' : 'stretch' })}>
          <option value="stretch">stretch</option>
          <option value="compress">compress</option>
        </select>
        <select aria-label={`Scale axis for step ${n}`} className={select} disabled={disabled} value={step.axis} onChange={(e) => onChange({ ...step, axis: e.target.value === 'vertical' ? 'vertical' : 'horizontal' })}>
          <option value="horizontal">horizontally</option>
          <option value="vertical">vertically</option>
        </select>
        <span className="text-sm text-navy">by</span>
        <input aria-label={`Factor for step ${n}`} className={input} disabled={disabled} value={step.factor} inputMode="text" autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="2" onChange={(e) => onChange({ ...step, factor: e.target.value })} />
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-navy">reflect over the</span>
      <select aria-label={`Reflection axis for step ${n}`} className={select} disabled={disabled} value={step.axis} onChange={(e) => onChange({ ...step, axis: e.target.value === 'y' ? 'y' : 'x' })}>
        <option value="x">x-axis</option>
        <option value="y">y-axis</option>
      </select>
    </div>
  )
}

function PointField({ value, onChange, onSubmit, disabled }: { value: string; onChange: (v: string) => void; onSubmit: () => void; disabled: boolean }) {
  const reading = pointReading(value)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!disabled) onSubmit()
  }
  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <label htmlFor="tr-point" className="block text-sm font-semibold text-navy">
        Point on g
      </label>
      <div className="flex gap-2">
        <input
          id="tr-point"
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder="(5, -31)"
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-describedby="tr-point-preview"
          className="min-h-12 w-full min-w-0 flex-1 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
        />
        <button type="submit" disabled={disabled} className="min-h-12 shrink-0 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
          Check
        </button>
      </div>
      <p id="tr-point-preview" className={`min-h-5 text-sm ${reading.startsWith('reads as ') ? 'text-navy' : 'text-navy/70'}`}>
        {reading}
      </p>
    </form>
  )
}
