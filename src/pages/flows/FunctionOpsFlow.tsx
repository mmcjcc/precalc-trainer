import { useEffect, useMemo, useRef, useState } from 'react'
import { FUNCTION_KEYS } from '@/components/symbolStrip'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { dataFromAnswer } from '@/content/modules/functionOps/generate'
import { gradeFunctionOps, showNum, type OpsGrade } from '@/content/modules/functionOps/ops'
import { OPS_RULE_FOR } from '@/content/modules/functionOps/rules'
import { getModule } from '@/content/registry'
import type { AnswerSpec, RuleCard } from '@/content/types'
import { parseValueAnswer, patternHit } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromOps } from '@/problem/tutorContext'
import { ProblemFrame } from './ProblemFrame'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { saveFnEntries } from './fnUi'
import { recordOpsGrade } from './record'
import type { FlowProps } from './types'

type FunctionOpsAnswer = Extract<AnswerSpec, { type: 'functionOps' }>

function valueTex(text: string): string {
  const parsed = parseValueAnswer(text)
  if (!parsed.ok) return ''
  if (parsed.undefined) return '\\text{undefined}'
  return safeLatex(parsed.text)
}

/**
 * Operations with functions. One answer: a number or "undefined" from a table or from two graphs, or a
 * formula. The graphs are the problem, so they are on screen before she answers. Her box is stored on
 * the attempt and restored after a reload.
 */
export function FunctionOpsFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'functionOps') return <p className="text-navy">This problem has no functions to work with — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: FunctionOpsAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const [text, setText] = useState(attempt?.final?.fnEntries?.answer ?? '')
  const [grade, setGrade] = useState<OpsGrade | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useHintLadder(attempt, done)

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    setText(attempt.final?.fnEntries?.answer ?? '')
  }, [attempt])

  function submit() {
    if (done) return
    const g = gradeFunctionOps(dataFromAnswer(answer), text)
    setGrade(g)
    if (g.verdict === 'invalid') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    saveFnEntries({ answer: text })
    recordOpsGrade(g)
    if (g.verdict === 'correct') finish()
  }

  const pattern = grade?.verdict === 'mistake' ? patternHit(grade.mistake, grade.witness) : null
  const cardId = (grade?.verdict === 'mistake' ? OPS_RULE_FOR[grade.mistake] : null) || answer.ruleCard
  const card: RuleCard | null = cardsById.get(cardId) ?? null
  const related = answer.ruleCards.filter((id) => id !== cardId).map((id) => cardsById.get(id)).filter((c): c is RuleCard => Boolean(c))
  const label = answer.question === 'formula' ? 'write the formula' : 'give the value'
  const progress: ProgressLine = { stage: done ? 1 : 0, total: 1, label: done ? 'answer checked' : label, solved: done, offPath: false }

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={grade ? verdictFromOps(grade) : undefined}
      graphCaption="graphs of f and g"
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={answer.nudge} card={card} related={related} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
      keymap={{ onHint: hint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="ops-answer-title">
        <h2 id="ops-answer-title" className="font-semibold text-navy">
          Your answer
        </h2>
        <MathInput
          value={text}
          onChange={(v) => {
            setText(v)
            saveFnEntries({ answer: v })
          }}
          onSubmit={submit}
          label={answer.question === 'formula' ? 'Formula' : 'Value'}
          placeholder={answer.question === 'formula' ? 'a formula in x' : 'a number, or undefined'}
          submitLabel="Check"
          stripKeys={FUNCTION_KEYS}
          disabled={done}
          toTex={answer.question === 'formula' ? (t) => safeLatex(t) : valueTex}
        />
        {grade?.verdict === 'invalid' && <NotAnAttemptNotice messages={[grade.message]} />}
        {grade?.verdict === 'correct' && <SigFigCorrect message={grade.message} />}
        {grade?.verdict === 'mistake' && pattern && <SigFigRejection message={grade.witness} patterns={[pattern]} />}
        {grade?.verdict === 'wrong' && <SigFigRejection message={grade.message} patterns={[]} />}
        {done && <SigFigExplanation steps={answer.reveal} title="Worked explanation" />}
      </section>
    </ProblemFrame>
  )
}

function Statement({ answer }: { answer: FunctionOpsAnswer }) {
  if (answer.question === 'table' && answer.xs && answer.fv && answer.gv) {
    return (
      <div className="overflow-x-auto">
        <table className="border-collapse text-center text-sm text-navy">
          <caption className="mb-2 text-left text-sm font-semibold text-navy">Values of f and g</caption>
          <thead>
            <tr>
              <th scope="col" className="border border-navy-100 bg-navy-50 px-2 py-1 font-semibold">
                x
              </th>
              {answer.xs.map((x) => (
                <th key={x} scope="col" className="border border-navy-100 bg-navy-50 px-2 py-1 font-semibold">
                  {showNum(x)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="border border-navy-100 px-2 py-1 font-semibold">
                f(x)
              </th>
              {answer.fv.map((y, i) => (
                <td key={answer.xs![i]} className="border border-navy-100 px-2 py-1 font-mono">
                  {showNum(y)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className="border border-navy-100 px-2 py-1 font-semibold">
                g(x)
              </th>
              {answer.gv.map((y, i) => (
                <td key={answer.xs![i]} className="border border-navy-100 px-2 py-1 font-mono">
                  {showNum(y)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    )
  }
  if (answer.question === 'graph') {
    return (
      <div className="space-y-1">
        <GraphPanel spec={graphOf(answer)} caption="graphs of f and g" />
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <Katex tex={`f(x) = ${safeLatex(answer.f ?? '')}`} display ariaLabel={`f of x = ${answer.f ?? ''}`} />
      <Katex tex={`g(x) = ${safeLatex(answer.g ?? '')}`} display ariaLabel={`g of x = ${answer.g ?? ''}`} />
    </div>
  )
}

function graphOf(answer: FunctionOpsAnswer) {
  return {
    kind: 'function' as const,
    samples: (answer.fPts ?? []).map((p) => ({ x: p.x, y: p.y })),
    gSamples: (answer.gPts ?? []).map((p) => ({ x: p.x, y: p.y })),
    endLabel: 'f',
    gEndLabel: 'g',
    xDomain: [-5, 5] as [number, number],
    yDomain: [-6, 6] as [number, number],
  }
}
