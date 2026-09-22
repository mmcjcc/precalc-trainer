import { useCallback, useMemo, useState } from 'react'
import { verdictFromChecked, verdictFromStep, verdictFromYesNo } from '@/problem/tutorContext'
import type { TutorVerdict } from '@/shared/tutor'
import type { OneToOneReason } from '@/content/types'
import { useStore } from '@/store'
import { detectInverseCompletion, gradeOneToOne, ONE_TO_ONE_REASONS, type InverseAnswer } from '@/problem/inverse'
import { buildStepContext, classifyStep, hintView, liveParseError, progressLine, type HintView, type ProgressLine } from '@/problem/stepEngine'
import { useKeyedHint } from '@/problem/useKeyedHint'
import { currentLineOf, useStepEngine } from '@/problem/useStepEngine'
import { HintPanel } from '@/components/HintPanel'
import { MathInput } from '@/components/MathInput'
import { PropertyChips } from '@/components/PropertyChips'
import { CaveatBanner, RejectionCard } from '@/components/RejectionCard'
import { CheckItCard, OneToOneCard, TwinCard } from '@/components/VerdictCards'
import { WorkedColumn } from '@/components/WorkedColumn'
import { BonusInverseColumn } from './BonusInverseColumn'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

/**
 * Inverse flow (BUILD_GUIDE §7): one-to-one verdict first. Yes → step column (swap once) until the
 * line is y = f⁻¹(x), then "check it". No → twin evidence f(k) = f(twin), then an optional bonus.
 */
export function InverseFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'inverse') return <p className="text-navy">This problem has no function to invert — pick another from the module page.</p>
  return <InverseBody {...props} answer={answer} />
}

const VERDICT_HINT = -1
const CHECK_HINT = -2

function InverseBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: InverseAnswer }) {
  const done = Boolean(completion)
  const f = instance.graph.f ?? instance.statementText.replace(/^\s*y\s*=\s*/, '')
  const check = instance.check

  // --- verdict (restored from attempt.final on reload) ----------------------
  const storedVerdict = attempt?.final?.oneToOne
  const storedReason: OneToOneReason | null = ONE_TO_ONE_REASONS.find((r) => r.id === attempt?.final?.reason)?.id ?? null
  const verdictOk = useMemo(
    () => (storedVerdict ? gradeOneToOne(answer, f, storedVerdict, storedReason, instance.seed).correct : false),
    [answer, f, storedVerdict, storedReason, instance.seed],
  )
  const stepsOpen = verdictOk && answer.oneToOne

  // --- step column ------------------------------------------------------------
  const steps = attempt?.steps ?? []
  const swapped = attempt?.swapped ?? false
  const currentLine = currentLineOf(instance, steps)
  const historyKey = steps.map((s) => s.text).join('\n')
  const ctx = useMemo(() => buildStepContext(instance, swapped), [instance, swapped])
  const found = useMemo(
    () => (stepsOpen && steps.length > 0 ? detectInverseCompletion(currentLine, answer.inverse, instance.seed) : null),
    [stepsOpen, steps.length, currentLine, answer.inverse, instance.seed],
  )
  const baseProgress = useMemo(
    () => progressLine(instance, currentLine, swapped, historyKey ? historyKey.split('\n') : []),
    [instance, currentLine, swapped, historyKey],
  )
  const progress: ProgressLine | null = !stepsOpen
    ? null
    : found
      ? { ...baseProgress, stage: baseProgress.total, label: 'f⁻¹ found', solved: true, offPath: false }
      : baseProgress
  const baseHint = useMemo(() => hintView(instance, currentLine, swapped, null, Boolean(found)), [instance, currentLine, swapped, found])
  const classify = useCallback((typed: string) => classifyStep(currentLine ?? '', typed, ctx), [currentLine, ctx])
  const engine = useStepEngine({ instance, attempt, currentLine, classify, hint: baseHint, disabled: done || !stepsOpen })
  const stepHint: HintView = engine.lastPattern
    ? hintView(instance, currentLine, swapped, engine.lastPattern, Boolean(found))
    : found
      ? { ...baseHint, nudge: 'y is by itself in x — that is f⁻¹(x). Now check it with the stored number below.' }
      : baseHint
  const validate = useCallback((t: string) => liveParseError(t, instance.vars), [instance.vars])
  const [cardVerdict, setCardVerdict] = useState<TutorVerdict | null>(null)
  const tutorVerdict = engine.rejection ? verdictFromStep(engine.rejection, engine.draft) : cardVerdict

  // --- non-column hints -------------------------------------------------------
  const verdictHint = useKeyedHint(attempt, VERDICT_HINT, done)
  const checkHint = useKeyedHint(attempt, CHECK_HINT, done)
  const verdictView: HintView = {
    next: null,
    nudge: `Slide a horizontal line up and down the graph of f(x) = ${f} (open “Graph it”). If it ever crosses the graph twice, two inputs share an output.`,
    card: {
      id: 'hlt',
      title: 'Horizontal line test',
      body: 'f has an inverse only when every output comes from exactly one input: no horizontal line crosses the graph twice. Even powers fail it — (−2)² = 2² = 4.',
    },
    reveal: null,
  }
  const checkView: HintView = answer.oneToOne
    ? {
        next: null,
        nudge: check ? `Put k = ${check.k} into f first. Then put that answer into your f⁻¹ — you should land back on ${check.k}.` : 'Plug a number into f, then into f⁻¹.',
        card: { id: 'undo', title: 'An inverse undoes f', body: 'f⁻¹(f(k)) = k for every k in the domain. If you do not get k back, one of the steps went wrong.' },
        reveal: null,
      }
    : {
        next: null,
        nudge: check
          ? `Plug ${check.k} into f, one operation at a time. Then plug ${check.twin ?? 'the other input'} in. Same number?`
          : 'Find two different inputs with the same output.',
        card: { id: 'twin', title: 'One output, two inputs', body: 'If f(a) = f(b) with a ≠ b, an inverse would have to send that one output back to two places — so there is no inverse.' },
        reveal: null,
      }

  function onVerdict(correct: boolean, verdict: 'yes' | 'no', reason: OneToOneReason | null, message: string) {
    setCardVerdict(verdictFromYesNo(correct, message, reason ? `${verdict}: ${reason}` : verdict))
    const s = useStore.getState()
    s.setFinal({ oneToOne: verdict, reason: reason ?? undefined })
    // "No" without a reason is a prompt for the reason, not a wrong answer.
    if (verdict === 'yes' || reason) s.recordFinalAnswer({ correct, via: 'builder' })
    if (correct && !answer.oneToOne && !check) finish()
  }

  const chipUi = engine.chipPrompt ? (
    <PropertyChips onPick={engine.pickChip} onSkip={engine.skipChip} />
  ) : engine.chipNote ? (
    <p role="status" className="text-sm text-navy">
      {engine.chipNote}
    </p>
  ) : null

  const phase: 'verdict' | 'steps' | 'check' = !verdictOk ? 'verdict' : stepsOpen && !found ? 'steps' : 'check'
  const nudgeText =
    phase === 'verdict'
      ? 'Still here? Decide whether f is one-to-one in the card below — the hint button is right there.'
      : phase === 'steps'
        ? undefined
        : !check
          ? 'Still here? f⁻¹ is found — press Finish below.'
          : answer.oneToOne
            ? `Still here? Check your inverse with k = ${check.k} in the card below — the hint button is right there.`
            : `Still here? Plug ${check.k} and ${check.twin ?? 'the other input'} into f in the card below — the hint button is right there.`
  const hints =
    phase === 'verdict' ? (
      <HintPanel rung={verdictHint.rung} view={verdictView} onAdvance={verdictHint.advance} onUseLine={() => undefined} disabled={done} />
    ) : phase === 'steps' ? (
      <HintPanel
        rung={engine.hintRung}
        view={stepHint}
        onAdvance={engine.advanceHint}
        onUseLine={engine.useRevealedLine}
        highlight={engine.hintHighlight}
        disabled={done}
      />
    ) : (
      <HintPanel rung={checkHint.rung} view={checkView} onAdvance={checkHint.advance} onUseLine={() => undefined} disabled={done} />
    )

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      graphCaption={`f(x) = ${f}`}
      nudgeText={nudgeText}
      hints={hints}
      tutorVerdict={tutorVerdict}
      keymap={{
        onHint: phase === 'verdict' ? verdictHint.advance : phase === 'steps' ? engine.advanceHint : checkHint.advance,
        onUndo: stepsOpen ? engine.undo : undefined,
        onDigit: engine.pickChipByDigit,
        chipsActive: Boolean(engine.chipPrompt),
        onEscape: engine.chipPrompt ? engine.skipChip : undefined,
      }}
      composer={
        phase === 'steps' && (
          <MathInput
            value={engine.draft}
            onChange={engine.setDraft}
            onSubmit={() => void engine.submit()}
            validate={validate}
            error={engine.parseError}
            inputRef={engine.inputRef}
            autoFocus
            placeholder="Next line, like x = 2y + 3"
          />
        )
      }
    >
      <OneToOneCard answer={answer} f={f} seed={instance.seed} done={verdictOk || done} onResult={(g, verdict, reason) => onVerdict(g.correct, verdict, reason, g.message)} />

      {stepsOpen && (
        <>
          <WorkedColumn start={instance.start} steps={steps} onUndo={engine.undo} canUndo={engine.canUndo} afterLast={chipUi} />
          {steps.length === 0 && chipUi}
          {engine.caveat && <CaveatBanner restriction={engine.caveat.restriction} />}
          {engine.rejection && <RejectionCard result={engine.rejection} />}
          {found && check && (
            <CheckItCard
              check={check}
              f={f}
              inverse={found}
              done={done}
              onResult={(g) => {
                setCardVerdict(verdictFromChecked([g.fk, g.back], g.done))
                if (g.fk.status !== 'empty' && g.back.status !== 'empty') useStore.getState().recordFinalAnswer({ correct: g.done, via: 'text' })
                if (g.done) finish()
              }}
            />
          )}
          {found && !check && !done && (
            <button type="button" onClick={() => finish()} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
              Finish
            </button>
          )}
        </>
      )}

      {verdictOk && !answer.oneToOne && check && (
        <TwinCard
          check={check}
          done={done}
          onResult={(g) => {
            setCardVerdict(verdictFromChecked([g.fk, g.twin], g.done))
            if (g.fk.status !== 'empty' && g.twin.status !== 'empty') useStore.getState().recordFinalAnswer({ correct: g.done, via: 'text' })
            if (g.done) finish()
          }}
        />
      )}

      {done && !answer.oneToOne && answer.bonusInverse && instance.start && instance.canonical.length > 0 && (
        <BonusInverseColumn instance={instance} bonusInverse={answer.bonusInverse} />
      )}
    </ProblemFrame>
  )
}
