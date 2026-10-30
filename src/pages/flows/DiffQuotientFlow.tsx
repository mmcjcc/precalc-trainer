import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LEFT_TO_DO, stripFxhLabel, type DqLineResult } from '@/engine'
import { dqStart, gradeDqStep, gradeFxh, type DqAnswer } from '@/content/modules/diffQuotient/grade'
import type { AttemptStep } from '@/store'
import { hintView, liveParseError, progressLine, safeLatex, type SubmitOutcome } from '@/problem/stepEngine'
import { verdictFromStep } from '@/problem/tutorContext'
import { useStepEngine } from '@/problem/useStepEngine'
import { useGuidedCards } from '@/problem/useGuidedCards'
import type { LineCard } from '@/problem/lineCards'
import { getModule } from '@/content/registry'
import type { StepResult } from '@/shared/types'
import { useStore } from '@/store'
import { engineVerdict, KEPT, stepVerdict } from '@/components/ComposerVerdict'
import { GuidedStep } from '@/components/LineCards'
import { HintPanel } from '@/components/HintPanel'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { DIFF_QUOTIENT_KEYS } from '@/components/symbolStrip'
import { PropertyChips } from '@/components/PropertyChips'
import { RejectionCard } from '@/components/RejectionCard'
import { WorkedColumn } from '@/components/WorkedColumn'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

const DQ_TEX = '\\dfrac{f(x+h)-f(x)}{h}'

function toSubmit(r: DqLineResult, shown: string): SubmitOutcome {
  if (r.verdict === 'parse_error' && r.parseError) return { kind: 'parse', error: r.parseError }
  if (r.ok) return { kind: 'accepted', result: r, text: r.normalized?.text ?? shown, latex: safeLatex(shown) }
  return { kind: 'rejected', result: r }
}

/** "h != 0" → "h ≠ 0", "x >= -3" → "x ≥ −3". */
function prettyRestriction(r: string): string {
  return r.replace('!=', '≠').replace('>=', '≥').replace('<=', '≤').replace(/-/g, '−')
}

/**
 * Difference-quotient flow. Part 1: she writes f(x + h) (attempt step 0, checked against f(x + h)).
 * Part 2: the column starts from (f(x + h) − (f(x)))/h with HER f(x + h) dropped in, and every
 * line she adds (steps 1..) is checked against the line before it and the difference quotient. The
 * problem is finished when a line is simplified: no h left underneath.
 */
export function DiffQuotientFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'diffQuotient') return <p className="text-navy">This problem has no function to work with — pick another from the module page.</p>
  return <DqBody {...props} answer={answer} />
}

function DqBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: DqAnswer }) {
  const done = Boolean(completion)
  const steps = useMemo(() => attempt?.steps ?? [], [attempt])
  const fxhStep: AttemptStep | null = steps[0] ?? null
  const dqSteps = steps.slice(1)
  const part: 1 | 2 = fxhStep ? 2 : 1
  const start = fxhStep ? dqStart(instance, fxhStep.text) : null
  const lastLine = steps.length ? steps[steps.length - 1]!.text : null
  const current = dqSteps.length ? dqSteps[dqSteps.length - 1]!.text : start
  const historyKey = steps.map((s) => s.text).join('\n')

  const progress = useMemo(
    () => progressLine(instance, lastLine, false, historyKey ? historyKey.split('\n') : []),
    [instance, lastLine, historyKey],
  )
  const solved = progress.solved
  const baseHint = useMemo(() => hintView(instance, lastLine, false, null, solved), [instance, lastLine, solved])

  const classify = useCallback(
    (typed: string): SubmitOutcome => {
      if (part === 1) return toSubmit(gradeFxh(instance, typed), stripFxhLabel(typed))
      return toSubmit(gradeDqStep(instance, current ?? '', typed), typed.trim())
    },
    [part, instance, current],
  )
  const engine = useStepEngine({ instance, attempt, currentLine: lastLine, classify, hint: baseHint, disabled: done })
  const displayHint = engine.lastPattern ? hintView(instance, lastLine, false, engine.lastPattern, solved) : baseHint
  const live = !done && !solved && attempt !== null
  const previousForCards = part === 1 ? '' : (current ?? '')
  const nextText = getModule(instance.moduleId).nextStep(instance, lastLine, false)?.text ?? null
  const guided = useGuidedCards({ instance, attempt, previous: previousForCards, live, nextText })
  const [picked, setPicked] = useState<{ result: StepResult; text: string } | null>(null)
  const [pickedKept, setPickedKept] = useState(false)
  useEffect(() => {
    setPicked(null)
    setPickedKept(false)
  }, [steps.length])
  function pickCard(card: LineCard) {
    const outcome = classify(card.text)
    if (outcome.kind === 'parse') return
    if (outcome.kind === 'rejected') {
      useStore.getState().rejectCard({ pattern: outcome.result.pattern?.id, text: card.text, key: guided.lineKey })
      setPicked({ result: outcome.result, text: card.text })
      setPickedKept(false)
      return
    }
    setPicked(null)
    setPickedKept(true)
    useStore.getState().acceptStep({
      text: outcome.text,
      latex: outcome.latex,
      via: 'card',
      ...(guided.stepType ? { rule: guided.stepType } : {}),
    })
  }
  const rejection = guided.showingCards ? (picked?.result ?? engine.rejection) : engine.rejection
  const lineVerdict = useMemo(() => {
    if (picked) return stepVerdict(picked.result)
    if (pickedKept) return KEPT
    return engineVerdict({ rejection: engine.rejection, kept: engine.kept, caveat: engine.caveat })
  }, [picked, pickedKept, engine.rejection, engine.kept, engine.caveat])

  // Finished: close the attempt once the simplified line's chip question (if any) is answered or skipped.
  const finishing = useRef(false)
  useEffect(() => {
    if (!solved || done || !attempt || engine.chipPrompt || finishing.current) return
    finishing.current = true
    finish()
  }, [solved, done, attempt, engine.chipPrompt, finish])
  useEffect(() => {
    if (!solved) finishing.current = false
  }, [solved])

  const validate = useCallback(
    (t: string) => {
      if (part === 2) return liveParseError(t, instance.vars, 'expression')
      const body = stripFxhLabel(t)
      const err = liveParseError(body, instance.vars, 'expression')
      return err ? { ...err, position: err.position + Math.max(0, t.trimEnd().length - body.length) } : null
    },
    [part, instance.vars],
  )

  const chipUi = engine.chipPrompt ? (
    <PropertyChips onPick={engine.pickChip} onSkip={engine.skipChip} />
  ) : engine.chipNote ? (
    <p role="status" className="text-sm text-navy">
      {engine.chipNote}
    </p>
  ) : null

  const fxhRow = fxhStep ? [{ ...fxhStep, latex: `f(x+h) = ${fxhStep.latex || safeLatex(fxhStep.text)}` }] : []
  const lastIsFxh = dqSteps.length === 0
  const f = answer.f
  const final = solved && dqSteps.length ? dqSteps[dqSteps.length - 1]! : null

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      statement={
        <div className="space-y-1">
          <Katex tex={`f(x) = ${safeLatex(f)}`} display />
          <p className="text-sm">
            Simplify the difference quotient <Katex tex={DQ_TEX} /> for <Katex tex="h \ne 0" />.
          </p>
        </div>
      }
      graphCaption={`f(x) = ${f} with one secant line`}
      hints={
        <HintPanel
          rung={engine.hintRung}
          view={solved ? { ...displayHint, nudge: 'That line is simplified: no h is left underneath.' } : displayHint}
          onAdvance={engine.advanceHint}
          onUseLine={engine.useRevealedLine}
          highlight={engine.hintHighlight && !solved}
          disabled={solved || done}
        />
      }
      tutorVerdict={rejection ? verdictFromStep(rejection, picked?.text ?? engine.draft) : undefined}
      lineVerdict={lineVerdict}
      pickLine={guided.pickOffer}
      nudgeText={
        guided.showingCards
          ? 'Still here? Pick the next line from the cards. The hint button is right there.'
          : solved
            ? 'Still here? Name the property for your last line, or skip it, to finish.'
            : undefined
      }
      keymap={{
        onHint: solved ? undefined : engine.advanceHint,
        onUndo: engine.undo,
        onDigit: engine.pickChipByDigit,
        chipsActive: Boolean(engine.chipPrompt),
        onEscape: engine.chipPrompt ? engine.skipChip : undefined,
      }}
      composer={
        !solved && (
          <GuidedStep
            offers={guided.offers}
            guidedOn={guided.guidedOn}
            onGuideChange={guided.chooseGuide}
            showingCards={guided.showingCards}
            lineKey={guided.lineKey}
            cards={guided.cardsLeft}
            onPick={pickCard}
            onType={guided.typeInstead}
            showBack={Boolean(attempt?.picks?.[String(guided.lineKey)]?.typing && guided.cards.length > 0)}
            onBack={guided.backToCards}
            typedNote={guided.typedNote}
            inputRef={engine.inputRef}
          >
            <MathInput
              key={part}
              value={engine.draft}
              onChange={engine.setDraft}
              onSubmit={() => void engine.submit()}
              validate={validate}
              error={engine.parseError}
              inputRef={engine.inputRef}
              autoFocus
              label={part === 1 ? 'f(x + h) line' : 'Next line'}
              submitLabel={part === 1 ? 'Check f(x + h)' : 'Check this step'}
              placeholder={part === 1 ? 'every x becomes (x + h)' : 'next line of the difference quotient'}
              stripKeys={DIFF_QUOTIENT_KEYS}
            />
          </GuidedStep>
        )
      }
    >
      <section aria-labelledby="dq-part1" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-3">
        <h2 id="dq-part1" className="font-semibold text-navy">
          Part 1 · Find f(x + h)
        </h2>
        <p className="text-xs text-navy/70">
          Replace every x in <Katex tex={safeLatex(f)} /> with (x + h). You may leave it unexpanded.
        </p>
        {fxhStep && <WorkedColumn start={null} steps={fxhRow} onUndo={engine.undo} canUndo={engine.canUndo && lastIsFxh} />}
        {part === 1 && picked && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-navy" data-picked-line="">
            <span>You picked</span>
            <Katex tex={safeLatex(picked.text)} ariaLabel={picked.text} />
          </p>
        )}
        {part === 1 && rejection && (
          <>
            <RejectionCard result={rejection} />
            {!rejection.pattern && (
              <p className="text-sm text-navy">
                That is not f(x + h). Put (x + h), in parentheses, in place of EVERY x in {f}.
              </p>
            )}
          </>
        )}
      </section>

      {start !== null && (
        <section aria-labelledby="dq-part2" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-3">
          {/* Plain-text headings: their accessible name is what a screen reader announces. */}
          <h2 id="dq-part2" className="font-semibold text-navy">
            Part 2 · Build and simplify the difference quotient
          </h2>
          <p className="text-xs text-navy/70">
            Your f(x + h) is dropped in, and f(x) sits in parentheses so the minus reaches all of it. One move per line.
          </p>
          <WorkedColumn start={start} steps={dqSteps} onUndo={engine.undo} canUndo={engine.canUndo && !lastIsFxh} afterLast={chipUi} />
          {part === 2 && picked && (
            <p className="flex flex-wrap items-center gap-2 text-sm text-navy" data-picked-line="">
              <span>You picked</span>
              <Katex tex={safeLatex(picked.text)} ariaLabel={picked.text} />
            </p>
          )}
          {engine.rejection && part === 2 && <RejectionCard result={rejection ?? engine.rejection} />}
          {!engine.rejection && dqSteps.length > 0 && !solved && (
            <p role="status" className="text-sm text-navy">
              <span aria-hidden>✓ </span>
              {LEFT_TO_DO}
            </p>
          )}
          {solved && !done && (
            <p role="status" className="text-sm font-semibold text-ok">
              <span aria-hidden>✓ </span>
              Simplified: no h is left underneath.
            </p>
          )}
        </section>
      )}

      {done && final && (
        <section aria-labelledby="dq-answer" className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="dq-answer" className="font-semibold text-navy">
            Answer
          </h2>
          <Katex tex={`${DQ_TEX} = ${final.latex || safeLatex(final.text)}`} display />
          <p className="text-sm text-navy">
            for {answer.restrictions.map(prettyRestriction).join(', ')}
          </p>
          {answer.note && <p className="text-sm text-navy">{answer.note}</p>}
        </section>
      )}
    </ProblemFrame>
  )
}
