import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Katex } from '@/components/Katex'
import { MathInput } from '@/components/MathInput'
import { KEYPAD_SETS } from '@/components/keypadKeys'
import { MathTextInput } from '@/components/MathTextInput'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { FUNCTION_KEYS } from '@/components/symbolStrip'
import {
  FA_FIRST_KEY,
  FA_KEYS,
  faAllCorrect,
  faBlocked,
  faRuleIdFor,
  faShow,
  gcfText,
  gradeFactoringStage,
  type FactoringAnswer,
  type FaGrade,
  type FaPart,
} from '@/content/modules/factoring'
import { getModule } from '@/content/registry'
import type { FactoringStageId, RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { liveParseError, safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromFactoring } from '@/problem/tutorContext'
import type { VarName } from '@/shared/types'
import { useStore } from '@/store'
import { ProblemFrame } from './ProblemFrame'
import { HintLadder, NotAnAttemptNotice, PolyChoice, PolyTextBox, savePolyEntries, useHintLadder } from './polyUi'
import type { FlowProps } from './types'

type Entries = Record<string, string>

/** The last check: which part it was for, its graded boxes, and the box flagged when it was not an attempt. */
interface Feedback {
  stage: number
  parts: FaPart[]
  flag: string | null
}

const STAGE_TITLE: Record<FactoringStageId, string> = {
  cubed: 'What is cubed',
  pairs: 'Factor each pair',
  product: 'The factored form',
}

const STAGE_LABEL: Record<FactoringStageId, string> = {
  cubed: 'say what is cubed in each term',
  pairs: 'factor each pair',
  product: 'type the factored form',
}

const CHECK_LABEL: Record<FactoringStageId, string> = {
  cubed: 'Check the cube roots',
  pairs: 'Check the pairs',
  product: 'Check the answer',
}

/** Said once a part is right when another part follows (the full sentences come after the last part). */
const PASSED_NOTE: Record<FactoringStageId, string> = {
  cubed: 'Both cube roots are right.',
  pairs: 'Both pairs are right, and they share a binomial.',
  product: 'That is the complete factorization.',
}

const PRODUCT_LABEL = 'Factored form'
const PRODUCT_VARS: VarName[] = ['x', 'y']

const SMALL_BOX =
  'min-h-12 w-24 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50'

/**
 * Log one check of a factoring part. A named mistake is stored under its fa_ id. Any box that is not an attempt
 * drops the whole check. All boxes right is ONE correct record; otherwise one wrong record per box that is not right.
 */
export function recordFaGrades(grades: readonly FaGrade[]): void {
  if (grades.length === 0 || faBlocked(grades)) return
  const s = useStore.getState()
  const bad = grades.filter((g) => g.verdict !== 'correct')
  if (bad.length === 0) {
    s.recordFinalAnswer({ correct: true, via: 'text' })
    return
  }
  for (const g of bad) s.recordFinalAnswer({ correct: false, pattern: g.verdict === 'mistake' ? g.mistake : undefined, via: 'text' })
}

/** One graded box: a named slip shows its catalog lesson (and its monster) with the sentence about her answer. */
function GradeCard({ part, many }: { part: FaPart; many: boolean }) {
  const g = part.grade
  const caption = many && part.label ? <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">{part.label}</p> : null
  if (g.verdict === 'invalid') return <NotAnAttemptNotice messages={[many && part.label ? `${part.label}: ${g.message}` : g.message]} />
  return (
    <div className="space-y-1">
      {caption}
      {g.verdict === 'correct' ? (
        <SigFigCorrect message={g.message} />
      ) : g.verdict === 'mistake' ? (
        <SigFigRejection message={g.witness} patterns={[patternHit(g.mistake, g.witness)]} />
      ) : (
        <SigFigRejection message={g.message} patterns={[]} />
      )}
    </div>
  )
}

/** Feedback for one press of Check: if any box is not an attempt, only that notice; else one card per box. */
function GradeList({ parts }: { parts: readonly FaPart[] }) {
  if (parts.length === 0) return null
  const blocked = parts.filter((p) => p.grade.verdict === 'invalid')
  if (blocked.length > 0) {
    return <NotAnAttemptNotice messages={blocked.map((p) => (p.grade.verdict === 'invalid' ? (parts.length > 1 && p.label ? `${p.label}: ${p.grade.message}` : p.grade.message) : ''))} />
  }
  return (
    <div className="space-y-3">
      {parts.map((p) => (
        <GradeCard key={p.key} part={p} many={parts.length > 1} />
      ))}
    </div>
  )
}

function Statement({ answer }: { answer: FactoringAnswer }) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Katex tex={safeLatex(answer.f)} display ariaLabel={faShow(answer.f)} />
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

function StageCard({ index, total, id, passed, children }: { index: number; total: number; id: FactoringStageId; passed: boolean; children: ReactNode }) {
  const titleId = `fa-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      <h2 id={titleId} className="font-semibold text-navy">
        {total > 1 ? `Part ${index + 1} of ${total}: ${STAGE_TITLE[id]}` : STAGE_TITLE[id]}
      </h2>
      {children}
      {passed && (
        <p role="status" className="text-sm font-semibold text-navy">
          <span aria-hidden>✓ </span>
          {PASSED_NOTE[id]}
        </p>
      )}
    </section>
  )
}

/**
 * Factoring polynomials. Every problem is answered in parts, one Check each, and a later part is not on the page
 * until the one before is right: fa.cubes asks what is cubed in each term first, fa.grouping the two pairs; every
 * template ends with the factored form, typed in the math box with its live preview (fa.squares can also say it does
 * not factor). Each part has its own hint ladder; her boxes are kept on the attempt, so a reload restores them.
 */
export function FactoringFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'factoring') return <p className="text-navy">This problem has no polynomial to factor — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: FactoringAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  /** How many parts have been checked right: the index of the part that is open. */
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const lastChecked = useRef<string | null>(null)
  const cells = useRef(new Map<string, HTMLInputElement>())
  const productRef = useRef<HTMLInputElement | null>(null)
  const stage = stages[passed]!
  // One ladder per part, so a hint opened for the first part does not open by itself on the next.
  const hint = useHintLadder(attempt, done, passed)

  // Restore her boxes when the attempt arrives after the first render (resume after a reload).
  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    setEntries({ ...attempt.final?.polyEntries })
    setPassed(Math.min(attempt.final?.polyStage ?? 0, last))
  }, [attempt, last])

  const register = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      if (el) cells.current.set(key, el)
      else cells.current.delete(key)
    },
    [],
  )

  const focusBox = useCallback((key: string) => {
    const el = key === FA_KEYS.product ? productRef.current : cells.current.get(key)
    el?.focus({ preventScroll: true })
  }, [])

  // When a part opens, focus goes to its first box (the Check button she pressed is gone).
  const opened = useRef(passed)
  useEffect(() => {
    if (opened.current === passed) return
    opened.current = passed
    focusBox(FA_FIRST_KEY[stages[passed]!.id])
  }, [passed, stages, focusBox])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    // A check that was not an attempt: its notice goes as soon as she edits.
    setFeedback((f) => (f && faBlocked(f.parts.map((p) => p.grade)) ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const { parts, focus } = gradeFactoringStage(answer, stage.id, entries)
    const grades = parts.map((p) => p.grade)
    setFeedback({ stage: passed, parts, flag: focus })
    if (faBlocked(grades)) {
      // Not an attempt: nothing is recorded, and the box that needs her goes into focus.
      if (focus) focusBox(focus)
      return
    }
    // The same answers checked again are not a second try.
    const key = `${passed} ${JSON.stringify(entries)}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordFaGrades(grades)
    const s = useStore.getState()
    if (!faAllCorrect(grades)) {
      // First try means every part right the first time, not only the first part.
      s.setFinal({ firstCorrect: false })
      return
    }
    if (passed === last) {
      finish()
      return
    }
    s.setFinal({ polyStage: passed + 1 })
    setPassed(passed + 1)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    check()
  }

  const shown = feedback && feedback.stage === passed ? feedback : null
  const flag = shown && faBlocked(shown.parts.map((p) => p.grade)) ? shown.flag : null
  const named = shown?.parts.find((p) => p.grade.verdict === 'mistake')?.grade
  const mistake = named && named.verdict === 'mistake' ? named.mistake : null

  // The rule card for the slip just named, else this part's own card; the rest fold under it.
  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = (mistake && faRuleIdFor(mistake)) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const validateProduct = useCallback((t: string) => liveParseError(t, PRODUCT_VARS, 'expression'), [])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? (stages.length > 1 ? 'all parts checked' : 'answer checked') : STAGE_LABEL[stage.id],
    solved: done,
    offPath: false,
  }

  const text = (key: string) => entries[key] ?? ''
  const gcf = faShow(gcfText(answer.shape.g, answer.shape.e))

  function inputs(id: FactoringStageId, locked: boolean): ReactNode {
    switch (id) {
      case 'cubed': {
        const box = (key: string, label: string) => (
          <MathTextInput
            ref={register(key)}
            keypad={{ keys: KEYPAD_SETS.xy }}
            type="text"
            aria-label={label}
            value={text(key)}
            disabled={locked}
            onChange={(e) => update(key, e.target.value)}
            inputMode="text"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-invalid={flag === key ? true : undefined}
            className={SMALL_BOX}
          />
        )
        return (
          <div className="space-y-2">
            <div role="group" aria-label="Each term written as something cubed" className="flex flex-wrap items-center gap-1 font-mono text-navy">
              {gcf && <span>{gcf}(</span>}
              <span aria-hidden>(</span>
              {box(FA_KEYS.cube1, 'What is cubed in the first term')}
              <span aria-hidden>)^3</span>
              <span className="px-1">{answer.shape.s > 0 ? '+' : '−'}</span>
              <span aria-hidden>(</span>
              {box(FA_KEYS.cube2, 'What is cubed in the second term')}
              <span aria-hidden>)^3</span>
              {gcf && <span>)</span>}
            </div>
            <p className="text-xs text-navy/70">A term like 5x in the first box, a whole number in the second.</p>
          </div>
        )
      }
      case 'pairs': {
        const pairs = answer.pairs!
        return (
          <div className="space-y-3">
            <PolyTextBox
              id="fa-pair1"
              label={`First pair: ${faShow(pairs.first)} =`}
              hint="What the two terms share, times a binomial."
              placeholder=""
              value={text(FA_KEYS.pair1)}
              disabled={locked}
              invalid={flag === FA_KEYS.pair1}
              onChange={(v) => update(FA_KEYS.pair1, v)}
              inputRef={register(FA_KEYS.pair1)}
              keypad={{ keys: KEYPAD_SETS.xy }}
            />
            <PolyTextBox
              id="fa-pair2"
              label={`Second pair: ${faShow(pairs.second)} =`}
              hint="Its binomial should match the first pair’s."
              placeholder=""
              value={text(FA_KEYS.pair2)}
              disabled={locked}
              invalid={flag === FA_KEYS.pair2}
              onChange={(v) => update(FA_KEYS.pair2, v)}
              inputRef={register(FA_KEYS.pair2)}
              keypad={{ keys: KEYPAD_SETS.xy }}
            />
          </div>
        )
      }
      case 'product':
        return (
          <div className="space-y-3">
            {answer.question === 'squares' && (
              <PolyChoice
                legend="This polynomial"
                name="fa-choice"
                options={(answer.choiceOrder ?? ['factors', 'prime']).map((value) => ({
                  value,
                  label: value === 'factors' ? 'factors: type the product below' : 'does not factor over the integers',
                }))}
                value={text(FA_KEYS.choice)}
                disabled={locked}
                onChange={(v) => update(FA_KEYS.choice, v)}
              />
            )}
            <div className="space-y-1">
              <p className="text-sm font-semibold text-navy">{PRODUCT_LABEL}</p>
              <MathInput
                value={text(FA_KEYS.product)}
                onChange={(v) => update(FA_KEYS.product, v)}
                onSubmit={check}
                validate={validateProduct}
                inputRef={productRef}
                label={PRODUCT_LABEL}
                placeholder="your product"
                submitLabel={CHECK_LABEL.product}
                showSubmit={!locked}
                stripKeys={FUNCTION_KEYS}
                disabled={locked}
                toTex={safeLatex}
              />
            </div>
          </div>
        )
    }
  }

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={shown ? verdictFromFactoring(shown.parts.map((p) => p.grade)) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        // Parts she has not reached stay off the page: their boxes would say how the problem goes on.
        if (i > passed) return null
        const open = i === passed && !done
        return (
          <StageCard key={s.id} index={i} total={stages.length} id={s.id} passed={!open && stages.length > 1}>
            {!open ? (
              <div className="space-y-4">{inputs(s.id, true)}</div>
            ) : s.id === 'product' ? (
              // The math input brings its own form and Check button.
              inputs(s.id, false)
            ) : (
              <form onSubmit={submit} noValidate className="space-y-4">
                {inputs(s.id, false)}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {CHECK_LABEL[s.id]}
                </button>
              </form>
            )}
            {open && shown && <GradeList parts={shown.parts} />}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="fa-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="fa-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          {shown && <GradeList parts={shown.parts} />}
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
