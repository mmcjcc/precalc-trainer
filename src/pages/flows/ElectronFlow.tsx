import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getModule } from '@/content/registry'
import type { AnswerSpec, ElectronsLightQuestion, LightConstantInfo, RuleCard, SigFigQuantity } from '@/content/types'
import { gradeLightAnswer, gradeSpectrumOrder, type OrderGrade } from '@/content/modules/electrons/grade'
import { composeSigFigText } from '@/engine'
import type { PatternHit, SigFigGrade } from '@/shared/types'
import { useStore, type Attempt, type AttemptFinal } from '@/store'
import type { ProgressLine } from '@/problem/stepEngine'
import { verdictFromOrder, verdictFromSigFig } from '@/problem/tutorContext'
import { RuleCardView } from '@/components/HintPanel'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { SigFigNumeralInput } from '@/components/SigFigNumeralInput'
import { useBreakpoint } from '@/components/useBreakpoint'
import { EconfigBody } from './EconfigPanel'
import { ProblemFrame } from './ProblemFrame'
import { recordOrderGrade, recordSigFigGrade } from './record'
import type { FlowProps } from './types'

type ElectronsAnswer = Extract<AnswerSpec, { type: 'electrons' }>

const FINAL_HINT = 0
const SAVE_DEBOUNCE_MS = 300

/**
 * Three-rung hint ladder: nudge, rule card, explanation. Rung 3 shows the answer, so it is flagged
 * on the attempt the same way every other flow flags a reveal.
 */
function useLightHint(attempt: Attempt | null, disabled: boolean): { rung: 0 | 1 | 2 | 3; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(FINAL_HINT)] ?? 0) as 0 | 1 | 2 | 3
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(FINAL_HINT)] ?? 0
    if (cur >= 3) return
    const next = (cur + 1) as 1 | 2 | 3
    s.useHint(FINAL_HINT, next)
    if (next === 3) s.setFinal({ revealed: true, firstCorrect: false })
  }, [disabled])
  return { rung, advance }
}

const HINT_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

function LightHintPanel({ rung, nudge, card, related, explanation, onAdvance, disabled }: { rung: 0 | 1 | 2 | 3; nudge: string; card: RuleCard | null; related: RuleCard[]; explanation: string[]; onAdvance: () => void; disabled: boolean }) {
  const exhausted = rung === 3
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">Hints never appear on their own. Ctrl+Shift+H steps through them.</p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || exhausted}
        className="min-h-11 w-full rounded-xl bg-gold px-3 font-semibold text-navy hover:bg-gold/80 disabled:opacity-50"
      >
        {HINT_LABEL[rung]}
        {rung === 2 && <span className="ml-1 text-xs font-normal text-gold-text">(marks the answer as shown)</span>}
      </button>
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">{nudge}</p>
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
      {rung >= 3 && <SigFigExplanation steps={explanation} title="Worked explanation" />}
    </div>
  )
}

function ConstantsCard({ constants }: { constants: LightConstantInfo[] }) {
  return (
    <aside aria-label="Constants" className="rounded-xl border border-navy-100 bg-white/80 p-3 text-sm text-navy">
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Constants</p>
      <ul className="mt-1 space-y-1">
        {constants.map((c) => (
          <li key={c.symbol}>
            <span className="font-mono font-semibold">
              {c.symbol} = {c.display}
              {c.unit ? ` ${c.unit}` : ''}
            </span>
            <span className="text-navy/70"> · {c.figures}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-navy/70">Use the ones this question needs. Measured constants count toward significant figures; an exact conversion does not.</p>
    </aside>
  )
}

function GivenValue({ given }: { given: SigFigQuantity }) {
  return (
    <p className="text-navy" role="group" aria-label="Given">
      <span className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">{given.display}</span>{' '}
      <span className="text-xl font-semibold">{given.unit}</span>
      <span className="mt-1 block text-sm font-normal text-navy/70">{given.label}</span>
    </p>
  )
}

/**
 * Electrons and light. Calculations reuse the sig-fig numeral input; ordering is a tap sequence
 * with an undo. Electron configurations (aufbau, diagrams, shorthand, valence, ions) are another
 * question kind on this same flow.
 */
export function ElectronFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'electrons') return <p className="text-navy">This problem has nothing to work with — pick another from the module page.</p>
  if (answer.question.kind === 'econfig') return <EconfigBody {...props} answer={answer} />
  return <ElectronBody {...props} answer={answer} />
}

function ElectronBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: ElectronsAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const bp = useBreakpoint()
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const light = answer.question.kind === 'light' ? answer.question : null
  const order = answer.question.kind === 'order' ? answer.question : null

  const [coef, setCoef] = useState(attempt?.final?.sfText ?? '')
  const [power, setPower] = useState(attempt?.final?.sfPower ?? '')
  const [tapped, setTapped] = useState<string[]>(attempt?.final?.ltOrder ?? [])
  const [grade, setGrade] = useState<SigFigGrade | null>(null)
  const [orderGrade, setOrderGrade] = useState<OrderGrade | null>(null)
  const [lastPattern, setLastPattern] = useState<PatternHit | null>(null)
  const lastChecked = useRef<string | null>(null)

  const pending = useRef<Partial<AttemptFinal> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushSave = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (!pending.current) return
    const patch = pending.current
    pending.current = null
    useStore.getState().setFinal(patch)
  }, [])
  const save = useCallback(
    (patch: Partial<AttemptFinal>) => {
      pending.current = { ...pending.current, ...patch }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS)
    },
    [flushSave],
  )
  useEffect(() => flushSave, [flushSave])

  const hint = useLightHint(attempt, done)
  const patternCard: RuleCard | null = lastPattern ? { id: lastPattern.id, title: lastPattern.title, body: lastPattern.lesson, example: lastPattern.example } : null
  const related = answer.ruleCards
    .slice(patternCard ? 0 : 1)
    .map((id) => cardsById.get(id))
    .filter((c): c is RuleCard => c !== undefined && c.title !== patternCard?.title)

  function submitNumeral() {
    if (done || !light) return
    flushSave()
    useStore.getState().setFinal({ sfText: coef, sfPower: power })
    const text = composeSigFigText(coef, power)
    const g = gradeLightAnswer(light, text)
    setGrade(g)
    if (g.status === 'wrong') setLastPattern(g.pattern ?? null)
    if (lastChecked.current === text) return
    lastChecked.current = text
    recordSigFigGrade(g)
    if (g.status === 'correct') finish()
  }

  function tapItem(id: string) {
    if (done || !order || tapped.includes(id)) return
    const next = [...tapped, id]
    setTapped(next)
    setOrderGrade(null)
    useStore.getState().setFinal({ ltOrder: next })
  }

  function undoTap() {
    if (done || tapped.length === 0) return
    const next = tapped.slice(0, -1)
    setTapped(next)
    setOrderGrade(null)
    useStore.getState().setFinal({ ltOrder: next })
  }

  function submitOrder() {
    if (done || !order) return
    const g = gradeSpectrumOrder(order, tapped)
    setOrderGrade(g)
    if (g.status === 'wrong') setLastPattern(g.pattern ?? null)
    if (g.status === 'incomplete') return
    const key = `order:${tapped.join(',')}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordOrderGrade(g)
    if (g.status === 'correct') finish()
  }

  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'answer checked' : order ? 'tap them in order' : 'give the answer',
    solved: done,
    offPath: false,
  }
  const tutorVerdict = orderGrade && orderGrade.status !== 'incomplete' ? verdictFromOrder(orderGrade) : grade ? verdictFromSigFig(grade) : undefined
  const labels = new Map(order?.items.map((item) => [item.id, item.label]) ?? [])

  let entry: ReactNode
  if (light) {
    entry = (
      <>
        <h2 id="el-answer-title" className="font-semibold text-navy">
          Final answer
        </h2>
        <SigFigNumeralInput
          coefficient={coef}
          power={power}
          onChange={({ coefficient, power: p }) => {
            setCoef(coefficient)
            setPower(p)
            if (grade?.status === 'parse_error') setGrade(null)
            save({ sfText: coefficient, sfPower: p })
          }}
          onSubmit={submitNumeral}
          unit={light.unit}
          disabled={done}
          autoFocus={bp === 'desktop' && !done}
          error={grade?.status === 'parse_error' ? grade.parseError : null}
        />
        {grade?.status === 'wrong' && <SigFigRejection message={grade.message} patterns={grade.pattern ? [grade.pattern] : []} />}
        {grade?.status === 'correct' && <SigFigCorrect message={grade.message} note={grade.note} />}
      </>
    )
  } else if (order) {
    const remaining = order.items.filter((item) => !tapped.includes(item.id))
    entry = (
      <>
        <h2 id="el-answer-title" className="font-semibold text-navy">
          Tap in order
        </h2>
        <p className="text-sm text-navy/70">Tap them from first to last. Undo removes the last tap. Each target is a button, so the keyboard reaches it.</p>
        <ol aria-label="Your order" className="space-y-1 text-sm text-navy">
          {tapped.length === 0 && <li className="text-navy/60">Nothing tapped yet.</li>}
          {tapped.map((id, i) => (
            <li key={id}>
              <span className="font-semibold">{i + 1}.</span> {labels.get(id) ?? id}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Items still to place">
          {remaining.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={done}
              onClick={() => tapItem(item.id)}
              className="min-h-11 min-w-11 rounded-xl border-2 border-navy-100 bg-white px-3 font-semibold text-navy hover:border-navy disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={undoTap} disabled={done || tapped.length === 0} className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50 disabled:opacity-50">
            Undo
          </button>
          {!done && (
            <button type="button" onClick={submitOrder} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
              Check order
            </button>
          )}
        </div>
        {orderGrade && orderGrade.status !== 'correct' && <SigFigRejection message={orderGrade.message} patterns={orderGrade.pattern ? [orderGrade.pattern] : []} />}
        {orderGrade?.status === 'correct' && <SigFigCorrect message={orderGrade.message} />}
      </>
    )
  } else {
    entry = null
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
      nudgeText={order ? 'Still here? Tap the items in order — the hint button is right there.' : 'Still here? Type your answer in the box below — the hint button is right there.'}
      keymap={{ onHint: hint.advance, onUndo: order ? undoTap : undefined }}
      statement={<LightStatement answer={answer} light={light} />}
      hints={
        <LightHintPanel
          rung={hint.rung}
          nudge={answer.nudge}
          card={patternCard ?? cardsById.get(answer.ruleCard) ?? null}
          related={related}
          explanation={answer.reveal}
          onAdvance={hint.advance}
          disabled={done}
        />
      }
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="el-answer-title">
        {entry}
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
    </ProblemFrame>
  )
}

function LightStatement({ answer, light }: { answer: ElectronsAnswer; light: ElectronsLightQuestion | null }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/80">{answer.context}</p>
      <p className="text-xl font-semibold text-navy sm:text-2xl">{answer.prompt}</p>
      {light && <GivenValue given={light.given} />}
      {light && <ConstantsCard constants={light.constants} />}
    </div>
  )
}
