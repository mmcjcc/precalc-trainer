import { useMemo, useRef, useState } from 'react'
import type { TutorVerdict } from '@/shared/tutor'
import { getModule } from '@/content/registry'
import type { AnswerSpec, RuleCard } from '@/content/types'
import {
  checkDecomposition,
  gradeCompositeDomain,
  gradeCompositeValue,
  gradeComposition,
  parseValueAnswer,
  type FunctionGrade,
} from '@/engine'
import { FUNCTION_KEYS } from '@/components/symbolStrip'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromDecomposition, verdictFromFunction } from '@/problem/tutorContext'
import type { ErrorPatternId } from '@/shared/types'
import { COMP_RULE_IDS } from '@/content/modules/composition/rules'
import { ProblemFrame } from './ProblemFrame'
import { FnGradeView, FnHintLadder, functionPattern, saveFnEntries, SetAnswerField, useFnHint } from './fnUi'
import { recordDecomposition, recordFunctionGrade } from './record'
import type { FlowProps } from './types'

type CompositionAnswer = Extract<AnswerSpec, { type: 'composition' }>

const CARD_FOR: Partial<Record<ErrorPatternId, string>> = {
  fn_compose_no_parens: COMP_RULE_IDS.parens,
  fn_compose_partial_sub: COMP_RULE_IDS.parens,
  fn_compose_product: COMP_RULE_IDS.order,
  fn_compose_reversed: COMP_RULE_IDS.order,
  fn_compose_sum: COMP_RULE_IDS.order,
  fn_value_product: COMP_RULE_IDS.order,
  fn_value_reversed: COMP_RULE_IDS.order,
  fn_composite_domain_simplified: COMP_RULE_IDS.domain,
  fn_composite_domain_inner_only: COMP_RULE_IDS.domain,
}

function valueTex(text: string): string {
  const parsed = parseValueAnswer(text)
  if (!parsed.ok) return ''
  if (parsed.undefined) return '\\text{undefined}'
  return safeLatex(parsed.text)
}

/**
 * Composition: a formula, a value, the domain of f ∘ g, or a decomposition. The engine accepts any
 * equivalent formula and any valid non-trivial pair. The graph stays behind the reveal gate.
 */
export function CompositionFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'composition') return <p className="text-navy">This problem has no functions to work with — pick another from the module page.</p>
  return <CompositionBody {...props} answer={answer} />
}

function CompositionBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: CompositionAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const saved = attempt?.final?.fnEntries
  const [text, setText] = useState(saved?.answer ?? '')
  const [outer, setOuter] = useState(saved?.f ?? '')
  const [inner, setInner] = useState(saved?.g ?? '')
  const [grade, setGrade] = useState<FunctionGrade | null>(null)
  const [decomposeMsg, setDecomposeMsg] = useState<{ ok: boolean; message: string; recorded: boolean } | null>(null)
  const [decomposeVerdict, setDecomposeVerdict] = useState<TutorVerdict | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useFnHint(attempt, done)

  function remember(next: Record<string, string>) {
    saveFnEntries({ answer: text, f: outer, g: inner, ...next })
  }

  function submitFormula() {
    if (done) return
    const g = gradeComposition(answer.f, answer.g, text)
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    remember({ answer: text })
    recordFunctionGrade(g)
    if (g.verdict === 'correct') finish()
  }

  function submitValue() {
    if (done || answer.a === undefined) return
    const g = gradeCompositeValue(answer.f, answer.g, answer.a, text)
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    remember({ answer: text })
    recordFunctionGrade(g)
    if (g.verdict === 'correct') finish()
  }

  function submitDomain() {
    if (done) return
    const g = gradeCompositeDomain(answer.f, answer.g, text)
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    remember({ answer: text })
    recordFunctionGrade(g)
    if (g.verdict === 'correct') finish()
  }

  function submitDecompose() {
    if (done || !answer.h) return
    const result = checkDecomposition(answer.h, outer, inner)
    const key = `${outer.trim()}\n${inner.trim()}`
    setDecomposeVerdict(verdictFromDecomposition(result))
    if (!result.ok && (result.reason === 'parse_f' || result.reason === 'parse_g' || result.reason === 'unsupported')) {
      setDecomposeMsg({ ok: false, message: result.message, recorded: false })
      return
    }
    setDecomposeMsg({ ok: result.ok, message: result.message, recorded: true })
    if (lastChecked.current === key) return
    lastChecked.current = key
    remember({ f: outer, g: inner })
    recordDecomposition(result)
    if (result.ok) finish()
  }

  const pattern = grade?.verdict === 'mistake' ? functionPattern(grade.mistake, grade.witness) : null
  const tutorVerdict = (grade ? verdictFromFunction(grade) : null) ?? decomposeVerdict
  const cardId = (pattern && CARD_FOR[pattern.id]) || answer.ruleCard
  const card: RuleCard | null = cardsById.get(cardId) ?? null

  const label =
    answer.question === 'expr' ? 'write (f ∘ g)(x)' : answer.question === 'value' ? 'evaluate (f ∘ g)(a)' : answer.question === 'domain' ? 'find the domain' : 'decompose h'
  const progress: ProgressLine = { stage: done ? 1 : 0, total: 1, label: done ? 'answer checked' : label, solved: done, offPath: false }

  const statement = answer.question === 'decompose' ? (
    <Katex tex={`h(x) = ${safeLatex(answer.h ?? '')}`} display />
  ) : (
    <div className="space-y-1">
      <Katex tex={`f(x) = ${safeLatex(answer.f)}`} display />
      <Katex tex={`g(x) = ${safeLatex(answer.g)}`} display />
      {answer.question === 'value' && answer.a !== undefined && <Katex tex={`(f \\circ g)(${answer.a})`} display />}
      {answer.question === 'expr' && <Katex tex="(f \circ g)(x)" display />}
      {answer.question === 'domain' && <Katex tex="(f \circ g)(x)" display />}
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
      graphCaption={`graph of ${instance.graph.f ?? answer.f}`}
      statement={statement}
      hints={<FnHintLadder rung={hint.rung} nudge={answer.nudge} card={card} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
      keymap={{ onHint: hint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="comp-answer-title">
        <h2 id="comp-answer-title" className="font-semibold text-navy">
          {answer.question === 'expr' && 'Formula'}
          {answer.question === 'value' && 'Value'}
          {answer.question === 'domain' && 'Domain of f ∘ g'}
          {answer.question === 'decompose' && 'f and g'}
        </h2>

        {answer.question === 'expr' && (
          <MathInput
            value={text}
            onChange={(v) => {
              setText(v)
              remember({ answer: v })
            }}
            onSubmit={submitFormula}
            label="Composite formula"
            placeholder="(x - 3)^2 + 1"
            submitLabel="Check"
            stripKeys={FUNCTION_KEYS}
            disabled={done}
            toTex={(t) => safeLatex(t)}
          />
        )}

        {answer.question === 'value' && (
          <MathInput
            value={text}
            onChange={(v) => {
              setText(v)
              remember({ answer: v })
            }}
            onSubmit={submitValue}
            label="Value of (f o g)(a)"
            placeholder="11, -1/2, 2sqrt(3), or undefined"
            submitLabel="Check"
            stripKeys={FUNCTION_KEYS}
            disabled={done}
            toTex={valueTex}
          />
        )}

        {answer.question === 'domain' && (
          <SetAnswerField
            value={text}
            onChange={(v) => {
              setText(v)
              remember({ answer: v })
            }}
            onSubmit={submitDomain}
            label="Domain of f o g"
            variable="x"
            disabled={done}
            placeholder="[0, inf)"
          />
        )}

        {answer.question === 'decompose' && (
          <div className="space-y-3">
            <MathInput
              value={outer}
              onChange={(v) => {
                setOuter(v)
                remember({ f: v })
              }}
              onSubmit={submitDecompose}
              label="Outer function f"
              placeholder="x^2"
              submitLabel="Check"
              stripKeys={FUNCTION_KEYS}
              disabled={done}
              showSubmit={false}
            />
            <MathInput
              value={inner}
              onChange={(v) => {
                setInner(v)
                remember({ g: v })
              }}
              onSubmit={submitDecompose}
              label="Inner function g"
              placeholder="2x + 1"
              submitLabel="Check"
              stripKeys={FUNCTION_KEYS}
              disabled={done}
              showSubmit={false}
            />
            {!done && (
              <button type="button" onClick={submitDecompose} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                Check
              </button>
            )}
            {decomposeMsg && !decomposeMsg.ok && decomposeMsg.recorded && <SigFigRejection message={decomposeMsg.message} patterns={[]} />}
            {decomposeMsg && !decomposeMsg.ok && !decomposeMsg.recorded && (
              <p role="alert" className="text-sm font-medium text-bad">
                {decomposeMsg.message}
              </p>
            )}
            {decomposeMsg?.ok && <SigFigCorrect message={decomposeMsg.message} />}
          </div>
        )}

        {answer.question !== 'decompose' && <FnGradeView grade={grade} />}
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
    </ProblemFrame>
  )
}
