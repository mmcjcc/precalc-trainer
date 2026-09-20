import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { getModule } from '@/content/registry'
import type { AnswerSpec, RuleCard } from '@/content/types'
import { composeSigFigText, evaluateSigFigTask, gradeSigFigAnswer, gradeSigFigIntermediate, gradeSigFigTaps } from '@/engine'
import type { PatternHit, SigFigGrade, SigFigIntermediate, SigFigTapGrade } from '@/shared/types'
import { useStore, type Attempt, type AttemptFinal } from '@/store'
import type { ProgressLine } from '@/problem/stepEngine'
import { RuleCardView } from '@/components/HintPanel'
import { SigFigDigits } from '@/components/SigFigDigits'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { SigFigNumeralInput } from '@/components/SigFigNumeralInput'
import { useBreakpoint } from '@/components/useBreakpoint'
import { ProblemFrame } from './ProblemFrame'
import { recordSigFigGrade, recordSigFigTaps } from './record'
import type { FlowProps } from './types'

type SigFigAnswer = Extract<AnswerSpec, { type: 'sigFigs' }>

/** Hint-ladder keys (attempt.hintsUsed): the final answer, then one per intermediate question. */
const FINAL_HINT = 0
const INTERMEDIATE_HINT = 100
const SAVE_DEBOUNCE_MS = 300

function figures(n: number): string {
  return n === 1 ? '1 significant figure' : `${n} significant figures`
}

/**
 * Three-rung keyed hint ladder for an answer-only problem: nudge, rule card, explanation. Rung 3
 * shows the answer, so it is flagged on the attempt (`final.revealed`) and the answer no longer
 * counts as a first try — the same accounting a revealed step gets.
 */
function useSigFigHint(attempt: Attempt | null, key: number, disabled: boolean): { rung: 0 | 1 | 2 | 3; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(key)] ?? 0) as 0 | 1 | 2 | 3
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(key)] ?? 0
    if (cur >= 3) return
    const next = (cur + 1) as 1 | 2 | 3
    s.useHint(key, next)
    if (next === 3) s.setFinal({ revealed: true, firstCorrect: false })
  }, [disabled, key])
  return { rung, advance }
}

interface HintContent {
  nudge: string
  card: RuleCard | null
  related: RuleCard[]
  explanation: string[]
}

const HINT_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

function SigFigHintPanel({ rung, content, onAdvance, disabled }: { rung: 0 | 1 | 2 | 3; content: HintContent; onAdvance: () => void; disabled: boolean }) {
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
          <p className="mt-1">{content.nudge}</p>
        </div>
      )}
      {rung >= 2 && content.card && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">Rule</p>
          <RuleCardView card={content.card} />
          {content.related.length > 0 && (
            <details className="mt-2 rounded-xl border border-navy-100 bg-white p-2">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-navy">
                Related {content.related.length === 1 ? 'rule' : 'rules'} ({content.related.length})
              </summary>
              <div className="mt-2 space-y-2">
                {content.related.map((c) => (
                  <RuleCardView key={c.id} card={c} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {rung >= 3 && <SigFigExplanation steps={content.explanation} title="What limits the answer" />}
    </div>
  )
}

function intermediateNudge(inter: SigFigIntermediate): string {
  const rule =
    inter.rule === 'addsub'
      ? 'adds or subtracts, so find the least precise place among its numbers; the result is good to that place, and the figures it carries are the digits down to there'
      : 'multiplies or divides, so it carries the fewest significant figures of its numbers'
  return `Only the part in parentheses for now: ${inter.expression}. It ${rule}. Do not round it in the calculator — this count is just a note for the end.`
}

function intermediateExplanation(inter: SigFigIntermediate): string[] {
  return [
    inter.limit.text,
    `Rounded there it would read ${inter.roundedDisplay}, which is ${figures(inter.sigFigs)}. Keep every digit (${inter.unrounded}) in the calculator for the next step.`,
  ]
}

/**
 * Significant-figures flow (chemistry): the statement card carries the context sentence and the
 * numbers; she answers by tapping the significant digits (count tasks) or by typing a numeral with
 * an optional power of ten. Mixed tasks first ask how precise the part in parentheses is. Every
 * graded answer is recorded (named mistakes reach the Progress page); hints go nudge → rule card →
 * explanation; after a right answer the full worked explanation appears. No graph, no calculator.
 */
export function SigFigFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'sigFigs') return <p className="text-navy">This problem has no measurement to work with — pick another from the module page.</p>
  return <SigFigBody {...props} answer={answer} />
}

function SigFigBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: SigFigAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const bp = useBreakpoint()
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const intermediates = useMemo<SigFigIntermediate[]>(() => {
    if (answer.task.kind !== 'mixed') return []
    try {
      return evaluateSigFigTask(answer.task).intermediates
    } catch {
      return []
    }
  }, [answer.task])
  const interDone = Math.min(attempt?.final?.sfIntermediateDone ?? 0, intermediates.length)
  const inter: SigFigIntermediate | null = interDone < intermediates.length ? intermediates[interDone]! : null
  const countText = answer.task.kind === 'count' ? answer.task.text : (answer.quantities[0]?.text ?? '')
  const tapMode = answer.entry === 'count'

  // --- entry state (restored from the attempt after a reload) -----------------
  const [coef, setCoef] = useState(attempt?.final?.sfText ?? '')
  const [power, setPower] = useState(attempt?.final?.sfPower ?? '')
  const [taps, setTaps] = useState<number[]>(attempt?.final?.sfTaps ?? [])
  const [interText, setInterText] = useState(attempt?.final?.sfIntermediate ?? '')
  const [grade, setGrade] = useState<SigFigGrade | null>(null)
  const [tapGrade, setTapGrade] = useState<SigFigTapGrade | null>(null)
  const [interGrade, setInterGrade] = useState<SigFigGrade | null>(null)
  const [interError, setInterError] = useState<string | null>(null)
  const [lastPattern, setLastPattern] = useState<PatternHit | null>(null)
  // Re-checking the same entry is not a second try (no second record).
  const lastChecked = useRef<string | null>(null)

  // Typed boxes are saved to the attempt a moment after she stops typing, and on leaving the page.
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

  // --- hints ------------------------------------------------------------------
  const finalHint = useSigFigHint(attempt, FINAL_HINT, done || inter !== null)
  const interHint = useSigFigHint(attempt, INTERMEDIATE_HINT + interDone, done || inter === null)
  const patternCard: RuleCard | null = lastPattern ? { id: lastPattern.id, title: lastPattern.title, body: lastPattern.lesson, example: lastPattern.example } : null
  const hintContent: HintContent = inter
    ? {
        nudge: intermediateNudge(inter),
        card: patternCard ?? cardsById.get(inter.rule === 'addsub' ? 'sf-addsub' : 'sf-muldiv') ?? null,
        related: [cardsById.get('sf-mixed')].filter((c): c is RuleCard => c !== undefined),
        explanation: intermediateExplanation(inter),
      }
    : {
        nudge: answer.nudge,
        card: patternCard ?? cardsById.get(answer.ruleCard) ?? null,
        related: answer.ruleCards.slice(1).map((id) => cardsById.get(id)).filter((c): c is RuleCard => c !== undefined),
        explanation: answer.reveal,
      }
  const activeHint = inter ? interHint : finalHint

  // --- grading ------------------------------------------------------------------
  function submitNumeral() {
    if (done) return
    flushSave()
    useStore.getState().setFinal({ sfText: coef, sfPower: power })
    const text = composeSigFigText(coef, power)
    const g = gradeSigFigAnswer(answer.task, text)
    setGrade(g)
    if (g.status === 'wrong') setLastPattern(g.pattern ?? null)
    if (lastChecked.current === text) return
    lastChecked.current = text
    recordSigFigGrade(g)
    if (g.status === 'correct') finish()
  }

  function toggleTap(index: number) {
    if (done) return
    const next = taps.includes(index) ? taps.filter((i) => i !== index) : [...taps, index].sort((a, b) => a - b)
    setTaps(next)
    setTapGrade(null)
    useStore.getState().setFinal({ sfTaps: next })
  }

  function submitTaps() {
    if (done) return
    const g = gradeSigFigTaps(countText, taps)
    setTapGrade(g)
    if (!g.correct) setLastPattern(g.patterns[0] ?? null)
    const key = `taps:${taps.join(',')}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordSigFigTaps(g)
    if (g.correct) finish()
  }

  function submitIntermediate(e: FormEvent) {
    e.preventDefault()
    if (done || !inter) return
    flushSave()
    useStore.getState().setFinal({ sfIntermediate: interText })
    const t = interText.trim()
    if (!/^\d+$/.test(t)) {
      setInterError('Type a whole number of significant figures here, like 3.')
      return
    }
    setInterError(null)
    const g = gradeSigFigIntermediate(answer.task, interDone, { sigFigs: Number(t) })
    setInterGrade(g)
    if (g.status === 'wrong') setLastPattern(g.pattern ?? null)
    const key = `inter${interDone}:${t}`
    if (lastChecked.current !== key) {
      lastChecked.current = key
      recordSigFigGrade(g)
    }
    if (g.status === 'correct') {
      setLastPattern(null)
      setInterText('')
      setInterGrade(null)
      useStore.getState().setFinal({ sfIntermediateDone: interDone + 1, sfIntermediate: '' })
    }
  }

  // --- frame ------------------------------------------------------------------
  const total = intermediates.length + 1
  const progress: ProgressLine = {
    stage: done ? total : interDone,
    total,
    label: done
      ? 'answer checked'
      : inter
        ? `note the precision of ${inter.expression}`
        : intermediates.length > 0
          ? 'now the final answer'
          : tapMode
            ? 'mark the significant digits'
            : 'give the answer',
    solved: done,
    offPath: false,
  }
  const nudgeText = tapMode
    ? 'Still here? Tap every digit that counts, then press Check — the hint button is right there.'
    : inter
      ? 'Still here? Note how precise the part in parentheses is, then the final answer — the hint button is right there.'
      : 'Still here? Type your answer in the box below — the hint button is right there.'
  const showQuantities = answer.quantities.length > 1 || answer.quantities.some((q) => q.exact)

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      nudgeText={nudgeText}
      statement={
        <div className="space-y-2">
          <p className="text-sm text-navy/80">{answer.context}</p>
          <p className="text-xl font-semibold text-navy sm:text-2xl">{answer.prompt}</p>
          {showQuantities && (
            <ul className="flex flex-wrap gap-2 text-sm text-navy/80" aria-label="The numbers in this problem">
              {answer.quantities.map((q, i) => (
                <li key={i} className="rounded-lg bg-white/70 px-2 py-1">
                  <span className="font-mono font-semibold text-navy">
                    {q.display}
                    {q.unit ? `${q.unit === '%' ? '' : ' '}${q.unit}` : ''}
                  </span>
                  <span> · {q.label}</span>
                  {q.exact && (
                    <span className="ml-1 rounded bg-gold px-1 text-xs font-semibold text-gold-text">exact{q.note ? ` · ${q.note}` : ''}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      hints={<SigFigHintPanel rung={activeHint.rung} content={hintContent} onAdvance={activeHint.advance} disabled={done} />}
      keymap={{ onHint: activeHint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="sf-answer-title">
        {tapMode ? (
          <>
            <h2 id="sf-answer-title" className="font-semibold text-navy">
              Mark the significant digits
            </h2>
            <p className="text-sm text-navy/70">Tap every digit that counts, then check. The zeros are the whole game.</p>
            <SigFigDigits text={countText} unit={answer.quantities[0]?.unit ?? ''} selected={taps} onToggle={toggleTap} feedback={tapGrade} disabled={done} />
            {tapGrade && !tapGrade.correct && <SigFigRejection message={tapGrade.message} patterns={tapGrade.patterns} />}
            {tapGrade?.correct && <SigFigCorrect message={tapGrade.message} />}
            {!done && (
              <button type="button" onClick={submitTaps} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                Check
              </button>
            )}
          </>
        ) : (
          <>
            <h2 id="sf-answer-title" className="font-semibold text-navy">
              Final answer
            </h2>
            {interDone > 0 && (
              <ul className="space-y-1 text-sm text-navy" aria-label="Intermediate results">
                {intermediates.slice(0, interDone).map((it) => (
                  <li key={it.operandIndex}>
                    <span aria-hidden className="text-ok">
                      ✓{' '}
                    </span>
                    <span className="font-mono">{it.expression}</span> is good to the {it.placeName} place: it carries {figures(it.sigFigs)}. Keep all its digits.
                  </li>
                ))}
              </ul>
            )}
            {inter ? (
              <form onSubmit={submitIntermediate} noValidate className="space-y-2" aria-label="Intermediate precision">
                <p className="text-sm text-navy">
                  First, the part in parentheses: <span className="font-mono font-semibold">{inter.expression}</span>. Work it out and keep every digit — but note how
                  precise it is.
                </p>
                <label htmlFor="sf-inter" className="block text-sm font-semibold text-navy">
                  Significant figures it carries into the next step
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="sf-inter"
                    type="text"
                    inputMode="numeric"
                    value={interText}
                    disabled={done}
                    onChange={(e) => {
                      setInterText(e.target.value)
                      setInterError(null)
                      save({ sfIntermediate: e.target.value })
                    }}
                    autoCapitalize="off"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    placeholder="3"
                    aria-invalid={interError ? true : undefined}
                    className="min-h-12 w-24 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(18px,1.125rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
                  />
                  <button type="submit" disabled={done} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
                    Check
                  </button>
                </div>
                {interError && (
                  <p role="alert" className="text-sm font-medium text-bad">
                    {interError}
                  </p>
                )}
                {interGrade?.status === 'wrong' && <SigFigRejection message={interGrade.message} patterns={interGrade.pattern ? [interGrade.pattern] : []} />}
              </form>
            ) : (
              <>
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
                  unit={answer.unit}
                  disabled={done}
                  autoFocus={bp === 'desktop' && !done}
                  error={grade?.status === 'parse_error' ? grade.parseError : null}
                />
                {grade?.status === 'wrong' && <SigFigRejection message={grade.message} patterns={grade.pattern ? [grade.pattern] : []} />}
                {grade?.status === 'correct' && <SigFigCorrect message={grade.message} note={grade.note} />}
              </>
            )}
          </>
        )}
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
    </ProblemFrame>
  )
}
