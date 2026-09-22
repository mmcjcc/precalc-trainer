import { useCallback, useMemo, useState } from 'react'
import { buildStepContext, classifyStep, hintView, liveParseError, progressLine } from '@/problem/stepEngine'
import { verdictFromSetAnswer, verdictFromStep } from '@/problem/tutorContext'
import type { TutorVerdict } from '@/shared/tutor'
import { currentLineOf, useStepEngine } from '@/problem/useStepEngine'
import { FinalAnswerCard } from '@/components/FinalAnswerCard'
import { HintPanel } from '@/components/HintPanel'
import { MathInput } from '@/components/MathInput'
import { PropertyChips } from '@/components/PropertyChips'
import { CaveatBanner, RejectionCard } from '@/components/RejectionCard'
import { WorkedColumn } from '@/components/WorkedColumn'
import { ProblemFrame } from './ProblemFrame'
import { recordSetAnswer } from './record'
import type { FlowProps } from './types'

/**
 * Inequality flow (BUILD_GUIDE §7): steps until ModuleDef.solved says the variable is isolated,
 * then interval + set-builder. Progress is the best anchor over every accepted line.
 */
export function InequalityFlow({ instance, attempt, flags, templateTitle, completion, finish }: FlowProps) {
  const answer = instance.answer
  const done = Boolean(completion)
  const steps = attempt?.steps ?? []
  const swapped = attempt?.swapped ?? false
  const currentLine = currentLineOf(instance, steps)
  const historyKey = steps.map((s) => s.text).join('\n')
  const ctx = useMemo(() => buildStepContext(instance, swapped), [instance, swapped])
  const progress = useMemo(
    () => progressLine(instance, currentLine, swapped, historyKey ? historyKey.split('\n') : []),
    [instance, currentLine, swapped, historyKey],
  )
  const solved = progress.solved
  const baseHint = useMemo(() => hintView(instance, currentLine, swapped, null, solved), [instance, currentLine, swapped, solved])
  const classify = useCallback((typed: string) => classifyStep(currentLine ?? '', typed, ctx), [currentLine, ctx])
  // Not disabled while solved: Undo must still work on the last line before the answer is checked.
  const engine = useStepEngine({ instance, attempt, currentLine, classify, hint: baseHint, disabled: done })
  const displayHint = engine.lastPattern ? hintView(instance, currentLine, swapped, engine.lastPattern, solved) : baseHint
  const validate = useCallback((t: string) => liveParseError(t, instance.vars), [instance.vars])
  const [answerVerdict, setAnswerVerdict] = useState<TutorVerdict | null>(null)
  const tutorVerdict = engine.rejection ? verdictFromStep(engine.rejection, engine.draft) : answerVerdict

  const chipUi = engine.chipPrompt ? (
    <PropertyChips onPick={engine.pickChip} onSkip={engine.skipChip} />
  ) : engine.chipNote ? (
    <p role="status" className="text-sm text-navy">
      {engine.chipNote}
    </p>
  ) : null

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      hints={
        <HintPanel
          rung={engine.hintRung}
          view={displayHint}
          onAdvance={engine.advanceHint}
          onUseLine={engine.useRevealedLine}
          highlight={engine.hintHighlight && !solved}
          disabled={solved || done}
        />
      }
      tutorVerdict={tutorVerdict}
      keymap={{
        onHint: solved ? undefined : engine.advanceHint,
        onUndo: engine.undo,
        onDigit: engine.pickChipByDigit,
        chipsActive: Boolean(engine.chipPrompt),
        onEscape: engine.chipPrompt ? engine.skipChip : undefined,
      }}
      composer={
        !solved && (
          <MathInput
            value={engine.draft}
            onChange={engine.setDraft}
            onSubmit={() => void engine.submit()}
            validate={validate}
            error={engine.parseError}
            inputRef={engine.inputRef}
            autoFocus
            placeholder="Next line, like 3x <= 9"
          />
        )
      }
    >
      <WorkedColumn start={instance.start} steps={steps} onUndo={engine.undo} canUndo={engine.canUndo} afterLast={chipUi} />
      {steps.length === 0 && chipUi}
      {engine.caveat && <CaveatBanner restriction={engine.caveat.restriction} />}
      {engine.rejection && <RejectionCard result={engine.rejection} />}
      {solved && !done && (
        <p role="status" className="text-sm font-semibold text-ok">
          <span aria-hidden>✓ </span>
          {instance.vars[0] ?? 'x'} is isolated — now write the solution set both ways.
        </p>
      )}
      {solved && answer.type === 'set' && (
        <FinalAnswerCard
          target={{ set: answer.set, requireInterval: answer.requireInterval, requireSetBuilder: answer.requireSetBuilder }}
          initial={{ interval: attempt?.final?.interval, set: attempt?.final?.set }}
          onGrade={(grade, texts) => {
            setAnswerVerdict(verdictFromSetAnswer(grade, texts))
            recordSetAnswer(grade, texts)
            if (grade.done) finish()
          }}
          done={done}
          variable={instance.vars[0] ?? 'x'}
        />
      )}
    </ProblemFrame>
  )
}
