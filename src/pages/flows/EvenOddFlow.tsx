import { useCallback, useMemo, useState, type RefObject } from 'react'
import { getModule } from '@/content/registry'
import type { StepContext } from '@/shared/types'
import { useStore, type AttemptStep } from '@/store'
import {
  decodeSlotStep,
  encodeSlotStep,
  gradeSlotLine,
  slotHelp,
  slotHintView,
  slotLines,
  SLOT_LABEL,
  type ParityAnswer,
  type Slot,
  type SlotOutcome,
} from '@/problem/evenOdd'
import { liveParseError, safeLatex, type HintView, type ProgressLine, type SubmitOutcome } from '@/problem/stepEngine'
import { useStepEngine, type StepEngine } from '@/problem/useStepEngine'
import { HintPanel } from '@/components/HintPanel'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { PropertyChips } from '@/components/PropertyChips'
import { RejectionCard } from '@/components/RejectionCard'
import { ParityVerdictCard } from '@/components/VerdictCards'
import { WorkedColumn } from '@/components/WorkedColumn'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

function toSubmit(o: SlotOutcome, typed: string): SubmitOutcome {
  switch (o.kind) {
    case 'parse':
      return { kind: 'parse', error: o.error }
    case 'accepted':
      return { kind: 'accepted', result: o.result, text: o.text, latex: safeLatex(typed.trim()) }
    case 'rejected':
      return { kind: 'rejected', result: o.result }
  }
}

const SLOT_TEX: Record<Slot, string> = { A: 'f(-x)', B: '-f(x)' }

/** Even/odd flow (BUILD_GUIDE §7): two slot columns — f(−x) and −f(x) — then the verdict. */
export function EvenOddFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'parity') return <p className="text-navy">This problem has no function to test — pick another from the module page.</p>
  return <EvenOddBody {...props} answer={answer} />
}

function useSlotEngine(slot: Slot, lines: string[], props: FlowProps & { answer: ParityAnswer }, ctx: StepContext, cards: HintView['card'][]): { engine: StepEngine; view: HintView } {
  const { instance, attempt, completion, answer } = props
  const slotView = useMemo(() => slotHintView(slot, answer, lines, cards.filter((c): c is NonNullable<typeof c> => c !== null)), [slot, answer, lines, cards])
  const hint = useMemo<HintView>(() => ({ next: null, nudge: slotView.nudge, card: slotView.card, reveal: slotView.reveal }), [slotView])
  const classify = useCallback(
    (typed: string) => {
      const outcome = toSubmit(gradeSlotLine(slot, lines, typed, answer, ctx), typed)
      // Evidence lines are substitutions and simplifications, not property moves: no chip prompt.
      return outcome.kind === 'accepted' ? { ...outcome, result: { ...outcome.result, acceptableChips: [] } } : outcome
    },
    [slot, lines, answer, ctx],
  )
  const encode = useCallback((t: string) => encodeSlotStep(slot, t), [slot])
  const owns = useCallback((s: AttemptStep) => decodeSlotStep(s.text)?.slot === slot, [slot])
  const stepToDraft = useCallback((t: string) => decodeSlotStep(t)?.expr ?? t, [])
  const engine = useStepEngine({
    instance,
    attempt,
    currentLine: lines[lines.length - 1] ?? null,
    classify,
    encode,
    hint,
    disabled: Boolean(completion),
    owns,
    stepToDraft,
    persistDraft: false,
    // Each column keeps its own hint ladder and rejection count: A = 0.., B = 1000..
    hintKey: (slot === 'B' ? 1000 : 0) + lines.length,
  })
  const view: HintView = engine.lastPattern
    ? { ...hint, card: { id: engine.lastPattern.id, title: engine.lastPattern.title, body: engine.lastPattern.lesson, example: engine.lastPattern.example } }
    : hint
  return { engine, view }
}

function EvenOddBody(props: FlowProps & { answer: ParityAnswer }) {
  const { instance, attempt, flags, templateTitle, completion, finish, answer } = props
  const done = Boolean(completion)
  const steps = useMemo(() => attempt?.steps ?? [], [attempt])
  const textsKey = steps.map((s) => s.text).join('\n')
  const lines = useMemo(() => slotLines(textsKey ? textsKey.split('\n') : []), [textsKey])
  const ctx = useMemo<StepContext>(
    () => ({ vars: instance.vars, seed: instance.seed, checkValue: answer.k, moduleId: instance.moduleId }),
    [instance.vars, instance.seed, instance.moduleId, answer.k],
  )
  const cards = useMemo(() => getModule(instance.moduleId).ruleCards, [instance.moduleId])
  const a = useSlotEngine('A', lines.A, props, ctx, cards)
  const b = useSlotEngine('B', lines.B, props, ctx, cards)
  const [active, setActive] = useState<Slot>('A')
  const activeSlot = active === 'A' ? a : b
  const chipEngine = a.engine.chipPrompt ? a.engine : b.engine.chipPrompt ? b.engine : null
  const undoEngine = a.engine.canUndo ? a.engine : b.engine.canUndo ? b.engine : null
  const validate = useCallback((t: string) => liveParseError(t, instance.vars, 'expression'), [instance.vars])
  const bothWritten = lines.A.length > 0 && lines.B.length > 0

  const progress: ProgressLine = {
    stage: (lines.A.length > 0 ? 1 : 0) + (lines.B.length > 0 ? 1 : 0) + (done ? 1 : 0),
    total: 3,
    label: done ? 'verdict checked' : bothWritten ? 'choose the verdict' : lines.A.length > 0 ? 'now write −f(x)' : 'write f(−x)',
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
      statement={<Katex tex={`f(x) = ${safeLatex(answer.f)}`} display />}
      graphCaption={`f(x) = ${answer.f}`}
      nudgeText={
        bothWritten
          ? 'Still here? Choose the verdict below: does f(−x) match f(x), match −f(x), or neither?'
          : undefined
      }
      hints={
        <div className="space-y-2">
          <p className="text-sm font-semibold text-navy">
            Hints for the {SLOT_LABEL[active]} column
          </p>
          <HintPanel
            rung={activeSlot.engine.hintRung}
            view={activeSlot.view}
            onAdvance={activeSlot.engine.advanceHint}
            onUseLine={activeSlot.engine.useRevealedLine}
            highlight={activeSlot.engine.hintHighlight}
            disabled={done}
          />
        </div>
      }
      keymap={{
        onHint: activeSlot.engine.advanceHint,
        onUndo: undoEngine?.undo,
        onDigit: chipEngine?.pickChipByDigit,
        chipsActive: Boolean(chipEngine),
        onEscape: chipEngine?.skipChip,
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {(['A', 'B'] as const).map((slot) => {
          const s = slot === 'A' ? a : b
          return (
            <SlotColumn
              key={slot}
              slot={slot}
              f={answer.f}
              steps={steps}
              lineCount={lines[slot].length}
              engine={s.engine}
              validate={validate}
              done={done}
              onFocus={() => setActive(slot)}
              inputRef={s.engine.inputRef}
            />
          )
        })}
      </div>
      <ParityVerdictCard
        answer={answer}
        enabled={bothWritten}
        done={done}
        onResult={(grade, verdict, reason) => {
          const st = useStore.getState()
          st.setFinal({ parity: verdict, reason: reason ?? undefined })
          // "Neither" without a reason is a prompt, not a wrong answer.
          if (verdict !== 'neither' || reason) st.recordFinalAnswer({ correct: grade.correct, via: 'builder' })
          if (grade.correct) finish()
        }}
      />
    </ProblemFrame>
  )
}

type SlotColumnProps = {
  slot: Slot
  f: string
  steps: AttemptStep[]
  lineCount: number
  engine: StepEngine
  validate: (t: string) => { message: string; position?: number } | null
  done: boolean
  onFocus: () => void
  inputRef: RefObject<HTMLInputElement | null>
}

function SlotColumn({ slot, f, steps, lineCount, engine, validate, done, onFocus, inputRef }: SlotColumnProps) {
  const own = steps
    .map((s) => ({ s, d: decodeSlotStep(s.text) }))
    .filter((x): x is { s: AttemptStep; d: { slot: Slot; expr: string } } => x.d?.slot === slot)
    .map(({ s, d }) => ({ ...s, text: d.expr }))
  const chipUi = engine.chipPrompt ? (
    <PropertyChips onPick={engine.pickChip} onSkip={engine.skipChip} />
  ) : engine.chipNote ? (
    <p role="status" className="text-sm text-navy">
      {engine.chipNote}
    </p>
  ) : null
  const label = SLOT_LABEL[slot]
  return (
    <section className="min-w-0 space-y-2 rounded-2xl border border-navy-100 bg-white p-3" aria-label={`${label} column`} onFocusCapture={onFocus}>
      <h2 className="font-semibold text-navy">
        <span className="sr-only">{label} = ?</span>
        <span aria-hidden>
          <Katex tex={`${SLOT_TEX[slot]} = \\;?`} />
        </span>
      </h2>
      <p className="text-xs text-navy/70">
        {slot === 'A' ? `Replace every x in ${f} with (−x), then simplify.` : `Negate the whole function −(${f}), then distribute.`}
      </p>
      <WorkedColumn start={null} steps={own} onUndo={engine.undo} canUndo={engine.canUndo} afterLast={chipUi} />
      {engine.rejection && (
        <>
          <RejectionCard result={engine.rejection} />
          {!engine.rejection.pattern && <p className="text-sm text-navy">{slotHelp(slot, f, lineCount === 0)}</p>}
        </>
      )}
      {!done && (
        <MathInput
          value={engine.draft}
          onChange={engine.setDraft}
          onSubmit={() => void engine.submit()}
          validate={validate}
          error={engine.parseError}
          inputRef={inputRef}
          autoFocus={slot === 'A'}
          label={`${label} line`}
          submitLabel={`Check ${label}`}
          placeholder={slot === 'A' ? '5(-x)^3 - 3(-x)' : '-(5x^3 - 3x)'}
          hideStrip={slot === 'B'}
        />
      )}
      {lineCount > 0 && !done && <p className="text-xs text-navy/60">Add another line to simplify, or move on when this column is clean.</p>}
    </section>
  )
}
