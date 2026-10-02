import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Katex } from '@/components/Katex'
import { SigFigExplanation } from '@/components/SigFigFeedback'
import { polyShow } from '@/content/modules/polynomials/patterns'
import { SD_FIRST_KEY, SD_KEYS, gradeDivisionStage, sdRuleIdFor, type PolyDivisionAnswer, type PolyDivisionStageId } from '@/content/modules/polyDivision'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { liveParseError, safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromPoly } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { ProblemFrame } from './ProblemFrame'
import { HintLadder, PolyChoice, PolyGradeList, PolyTextBox, polyAllCorrect, polyBlocked, savePolyEntries, useHintLadder, type PolyPart } from './polyUi'
import { recordPolyGrades } from './record'
import type { FlowProps } from './types'

type Entries = Record<string, string>

/** The last check: which part it was for, its graded parts, and the box flagged when it was not an attempt. */
interface Feedback {
  stage: number
  parts: PolyPart[]
  flag: string | null
}

const STAGE_TITLE: Record<PolyDivisionStageId, string> = {
  row: 'The top row',
  grid: 'The table',
  answers: 'Quotient and remainder',
  bottom: 'The bottom row',
  value: 'The value',
  factor: 'Factor or not',
}

const STAGE_LABEL: Record<PolyDivisionStageId, string> = {
  row: 'write the top row',
  grid: 'fill in the table',
  answers: 'give the quotient and the remainder',
  bottom: 'give the bottom row',
  value: 'give the value',
  factor: 'answer yes or no',
}

const CHECK_LABEL: Record<PolyDivisionStageId, string> = {
  row: 'Check the row',
  grid: 'Check the table',
  answers: 'Check answers',
  bottom: 'Check the row',
  value: 'Check the value',
  factor: 'Check the answer',
}

/**
 * Said once a part is right, in place of the engine's sentence: that one states the quotient and the
 * remainder, which the next part asks for.
 */
const PASSED_NOTE: Record<PolyDivisionStageId, string> = {
  row: 'The top row is right.',
  grid: 'The table is right: every column checks out.',
  answers: 'Quotient and remainder are right.',
  bottom: 'The bottom row is right.',
  value: 'The value is right.',
  factor: 'That is the right answer.',
}

const ordinalWord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth']

function Statement({ answer }: { answer: PolyDivisionAnswer }) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <Katex tex={`f(x) = ${safeLatex(answer.f)}`} display ariaLabel={`f(x) = ${polyShow(answer.f)}`} />
      </div>
      <p className="text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

const CELL =
  'h-11 w-11 rounded-lg border-2 bg-white px-0.5 text-center font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50'

function Cell({
  entryKey,
  label,
  boxed,
  entries,
  disabled,
  flag,
  onChange,
  register,
}: {
  entryKey: string
  label: string
  /** The box cell: a heavier border, like the bracket drawn around it on paper. */
  boxed?: boolean
  entries: Entries
  disabled: boolean
  flag: string | null
  onChange: (key: string, value: string) => void
  register: (key: string) => (el: HTMLInputElement | null) => void
}) {
  return (
    <input
      ref={register(entryKey)}
      type="text"
      aria-label={label}
      value={entries[entryKey] ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(entryKey, e.target.value)}
      inputMode="text"
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="next"
      aria-invalid={flag === entryKey ? true : undefined}
      className={`${CELL} ${boxed ? 'border-navy' : 'border-navy-100'}`}
    />
  )
}

/**
 * The synthetic-division table. The checked top row is printed; the box, the products and the bottom row
 * are hers. Inputs sit in the document column by column (product, then sum), so Tab follows the method.
 * Nothing marks the last bottom cell as the remainder: reading the row is the next part's question.
 */
function DivisionGrid({
  answer,
  entries,
  disabled,
  flag,
  onChange,
  register,
}: {
  answer: PolyDivisionAnswer
  entries: Entries
  disabled: boolean
  flag: string | null
  onChange: (key: string, value: string) => void
  register: (key: string) => (el: HTMLInputElement | null) => void
}) {
  const top = answer.rows.coefficients
  const shared = { entries, disabled, flag, onChange, register }
  return (
    <div className="overflow-x-auto pb-1">
      <div role="group" aria-label="Synthetic division table" className="inline-flex items-start">
        <span className="sr-only">Top row: {polyShow(top.join(', '))}.</span>
        <div className="pr-1">
          <Cell entryKey={SD_KEYS.box} label="Number in the box" boxed {...shared} />
        </div>
        <div aria-hidden className="w-0.5 self-stretch bg-navy" />
        {top.map((coefficient, i) => {
          const nth = ordinalWord[i] ?? `${i + 1}th`
          return (
            <div key={i} className="flex flex-col items-center px-0.5">
              <div aria-hidden className="flex h-11 w-11 items-center justify-center font-mono text-navy">
                {polyShow(coefficient)}
              </div>
              {i === 0 ? <div aria-hidden className="h-11 w-11" /> : <Cell entryKey={SD_KEYS.product(i)} label={`Product, ${nth} column`} {...shared} />}
              <div aria-hidden className="-mx-0.5 my-1 h-0.5 self-stretch bg-navy" />
              <Cell entryKey={SD_KEYS.bottom(i)} label={`Bottom row, ${nth} column`} {...shared} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StageCard({ index, total, id, state, children }: { index: number; total: number; id: PolyDivisionStageId; state: 'open' | 'passed'; children: ReactNode }) {
  const titleId = `sd-part-${index}`
  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
      <h2 id={titleId} className="font-semibold text-navy">
        Part {index + 1} of {total}: {STAGE_TITLE[id]}
      </h2>
      {children}
      {state === 'passed' && (
        <p role="status" className="text-sm font-semibold text-navy">
          <span aria-hidden>✓ </span>
          {PASSED_NOTE[id]}
        </p>
      )}
    </section>
  )
}

/**
 * Synthetic division, the remainder theorem and the factor theorem. Every problem is answered in parts,
 * one Check each, and the next part opens when the one before is right:
 *  - sd.table: the coefficient row as a free list, then the table cell by cell, then quotient and remainder;
 *  - sd.value: the bottom row as a list, then f(c);
 *  - sd.factor: the bottom row as a list, then yes or no.
 * Each part has its own hint ladder. No graph and no calculator panel.
 */
export function PolyDivisionFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'polyDivision') return <p className="text-navy">This problem has no division to work with — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: PolyDivisionAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  /** How many parts have been checked right: the index of the part that is open. */
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const lastChecked = useRef<string | null>(null)
  const cells = useRef(new Map<string, HTMLInputElement>())
  const stage = stages[passed]!
  // One ladder per part, so a hint opened for the top row does not open by itself on the table.
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

  // When a part opens, focus goes to its first box (the Check button she pressed is gone).
  const opened = useRef(passed)
  useEffect(() => {
    if (opened.current === passed) return
    opened.current = passed
    cells.current.get(SD_FIRST_KEY[stages[passed]!.id])?.focus({ preventScroll: true })
  }, [passed, stages])

  function update(key: string, value: string) {
    const next = { ...entries, [key]: value }
    setEntries(next)
    savePolyEntries(next)
    // An unreadable box was not an attempt: its notice goes as soon as she edits.
    setFeedback((f) => (f && polyBlocked(f.parts.map((p) => p.grade)) ? null : f))
  }

  function check(e: FormEvent) {
    e.preventDefault()
    if (done) return
    savePolyEntries(entries)
    const { parts, focus } = gradeDivisionStage(answer, stage.id, entries)
    const grades = parts.map((p) => p.grade)
    setFeedback({ stage: passed, parts, flag: focus })
    if (polyBlocked(grades)) {
      // Not an attempt: nothing is recorded, and the box that needs her goes into focus.
      if (focus) cells.current.get(focus)?.focus({ preventScroll: true })
      return
    }
    // The same answers checked again are not a second try.
    const key = `${passed} ${JSON.stringify(entries)}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordPolyGrades(grades)
    const s = useStore.getState()
    if (!polyAllCorrect(grades)) {
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

  const shown = feedback && feedback.stage === passed ? feedback : null
  const flag = shown && polyBlocked(shown.parts.map((p) => p.grade)) ? shown.flag : null
  const named = shown?.parts.find((p) => p.grade.verdict === 'mistake')?.grade
  const mistake = named && named.verdict === 'mistake' ? named.mistake : null

  // The module's rule card for the slip just named, else this part's own card; the rest fold under it.
  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = (mistake && sdRuleIdFor(mistake)) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const quotient = entries[SD_KEYS.quotient] ?? ''
  const quotientTex = useMemo(() => (quotient.trim() && !liveParseError(quotient, ['x'], 'expression') ? safeLatex(quotient) : ''), [quotient])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? 'all parts checked' : STAGE_LABEL[stage.id],
    solved: done,
    offPath: false,
  }
  const c = polyShow(answer.c)
  const divisor = polyShow(answer.divisor)

  function inputs(id: PolyDivisionStageId, locked: boolean): ReactNode {
    const text = (key: string) => entries[key] ?? ''
    switch (id) {
      case 'row':
        return (
          <PolyTextBox
            id="sd-row"
            label="Top row of the table"
            hint="The coefficients of f(x), in order, with commas between them."
            placeholder=""
            value={text(SD_KEYS.row)}
            disabled={locked}
            invalid={flag === SD_KEYS.row}
            onChange={(v) => update(SD_KEYS.row, v)}
            inputRef={register(SD_KEYS.row)}
          />
        )
      case 'grid':
        return (
          <>
            <p className="text-sm text-navy/80">Your top row is in place. Fill in the box and every empty cell. Tab moves down a column, then on to the next one.</p>
            <DivisionGrid answer={answer} entries={entries} disabled={locked} flag={flag} onChange={update} register={register} />
          </>
        )
      case 'answers':
        return (
          <>
            <div>
              <PolyTextBox
                id="sd-quotient"
                label="Quotient"
                hint="A polynomial in x. Type powers with ^."
                placeholder=""
                value={quotient}
                disabled={locked}
                invalid={flag === SD_KEYS.quotient}
                onChange={(v) => update(SD_KEYS.quotient, v)}
                inputRef={register(SD_KEYS.quotient)}
              />
              {quotientTex && (
                <div className="mt-1 overflow-x-auto text-navy">
                  <Katex tex={quotientTex} ariaLabel={`You typed ${polyShow(quotient)}`} />
                </div>
              )}
            </div>
            <PolyTextBox
              id="sd-remainder"
              label="Remainder"
              hint="One exact number."
              placeholder=""
              value={text(SD_KEYS.remainder)}
              disabled={locked}
              invalid={flag === SD_KEYS.remainder}
              onChange={(v) => update(SD_KEYS.remainder, v)}
              inputRef={register(SD_KEYS.remainder)}
            />
          </>
        )
      case 'bottom':
        return (
          <PolyTextBox
            id="sd-bottom"
            label="Bottom row of your table"
            hint="Every number of the row, in order, with commas between them."
            placeholder=""
            value={text(SD_KEYS.bottomRow)}
            disabled={locked}
            invalid={flag === SD_KEYS.bottomRow}
            onChange={(v) => update(SD_KEYS.bottomRow, v)}
            inputRef={register(SD_KEYS.bottomRow)}
          />
        )
      case 'value':
        return (
          <PolyTextBox
            id="sd-value"
            label={`f(${c}) =`}
            hint="One exact number."
            placeholder=""
            value={text(SD_KEYS.value)}
            disabled={locked}
            invalid={flag === SD_KEYS.value}
            onChange={(v) => update(SD_KEYS.value, v)}
            inputRef={register(SD_KEYS.value)}
          />
        )
      case 'factor':
        return (
          <PolyChoice
            legend={`Is ${divisor} a factor of f(x)?`}
            name="sd-factor"
            options={[
              { value: 'yes', label: 'yes' },
              { value: 'no', label: 'no' },
            ]}
            value={text(SD_KEYS.factor)}
            disabled={locked}
            onChange={(v) => update(SD_KEYS.factor, v)}
            firstRef={register(SD_KEYS.factor)}
          />
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
      tutorVerdict={shown ? verdictFromPoly(shown.parts.map((p) => p.grade)) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        // Parts she has not reached stay out of the page: their boxes would say how the problem goes on.
        if (i > passed) return null
        const open = i === passed && !done
        return (
          <StageCard key={s.id} index={i} total={stages.length} id={s.id} state={open ? 'open' : 'passed'}>
            {open ? (
              <form onSubmit={check} noValidate className="space-y-4">
                {inputs(s.id, false)}
                <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {CHECK_LABEL[s.id]}
                </button>
              </form>
            ) : (
              <div className="space-y-4">{inputs(s.id, true)}</div>
            )}
            {open && shown && <PolyGradeList parts={shown.parts} />}
          </StageCard>
        )
      })}

      {done && (
        <section aria-labelledby="sd-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="sd-worked-title" className="font-semibold text-navy">
            The whole division
          </h2>
          {shown && <PolyGradeList parts={shown.parts} />}
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
