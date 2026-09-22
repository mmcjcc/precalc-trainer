import { useMemo, useRef, useState } from 'react'
import { Katex } from '@/components/Katex'
import { SigFigExplanation } from '@/components/SigFigFeedback'
import { getModule } from '@/content/registry'
import { DR_RULE_IDS } from '@/content/modules/domainRange/rules'
import type { AnswerSpec, RuleCard } from '@/content/types'
import { gradeDomain, gradeRange, type FunctionGrade } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromFunction } from '@/problem/tutorContext'
import type { ErrorPatternId } from '@/shared/types'
import { ProblemFrame } from './ProblemFrame'
import { FnGradeView, FnHintLadder, functionPattern, saveFnEntries, SetAnswerField, useFnHint } from './fnUi'
import { recordFunctionGrade } from './record'
import type { FlowProps } from './types'

type DomainRangeAnswer = Extract<AnswerSpec, { type: 'domainRange' }>

/** Rung 2 card once a named mistake is on the table. */
const CARD_FOR: Partial<Record<ErrorPatternId, string>> = {
  fn_domain_forgot_denominator: DR_RULE_IDS.denominator,
  fn_domain_denominator_nonneg: DR_RULE_IDS.denominator,
  fn_domain_root_strict: DR_RULE_IDS.evenRoot,
  fn_domain_root_denominator_zero: DR_RULE_IDS.rootDenom,
  fn_domain_no_flip: DR_RULE_IDS.flip,
  fn_domain_odd_root_restricted: DR_RULE_IDS.anyInput,
  fn_domain_gave_range: DR_RULE_IDS.outputs,
  fn_range_gave_domain: DR_RULE_IDS.outputs,
  fn_range_reflection_ignored: DR_RULE_IDS.outputs,
  fn_range_included_asymptote: DR_RULE_IDS.asymptote,
}

/**
 * Domain or range from a formula. She types a set; the engine names the mistake or accepts any
 * equivalent description. The graph of f stays behind the reveal gate.
 */
export function DomainRangeFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'domainRange') return <p className="text-navy">This problem has no function to work with — pick another from the module page.</p>
  return <DomainRangeBody {...props} answer={answer} />
}

function DomainRangeBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: DomainRangeAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const [text, setText] = useState(attempt?.final?.fnEntries?.answer ?? '')
  const [grade, setGrade] = useState<FunctionGrade | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useFnHint(attempt, done)
  const variable = answer.question === 'range' ? 'y' : 'x'

  function submit() {
    if (done) return
    const g = answer.question === 'domain' ? gradeDomain(answer.f, text) : gradeRange(answer.f, text)
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') return
    const key = text.trim()
    if (lastChecked.current === key) return
    lastChecked.current = key
    saveFnEntries({ answer: text })
    recordFunctionGrade(g)
    if (g.verdict === 'correct') finish()
  }

  const pattern = grade?.verdict === 'mistake' ? functionPattern(grade.mistake, grade.witness) : null
  const tutorVerdict = grade ? verdictFromFunction(grade) : undefined
  const cardId = (pattern && CARD_FOR[pattern.id]) || answer.ruleCard
  const card: RuleCard | null = cardsById.get(cardId) ?? null

  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'answer checked' : answer.question === 'domain' ? 'find the domain' : 'find the range',
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
      tutorVerdict={tutorVerdict}
      graphCaption={`graph of f(x) = ${answer.f}`}
      statement={
        <Katex tex={`f(x) = ${safeLatex(answer.f)}`} display />
      }
      hints={<FnHintLadder rung={hint.rung} nudge={answer.nudge} card={card} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
      keymap={{ onHint: hint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="dr-answer-title">
        <h2 id="dr-answer-title" className="font-semibold text-navy">
          Write the set
        </h2>
        <SetAnswerField
          value={text}
          onChange={(v) => {
            setText(v)
            saveFnEntries({ answer: v })
          }}
          onSubmit={submit}
          label={answer.question === 'domain' ? 'Domain' : 'Range'}
          variable={variable}
          disabled={done}
          placeholder={answer.question === 'domain' ? '[-2, 3) U (3, inf)' : '(-inf, 5]'}
        />
        <FnGradeView grade={grade} />
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
    </ProblemFrame>
  )
}
