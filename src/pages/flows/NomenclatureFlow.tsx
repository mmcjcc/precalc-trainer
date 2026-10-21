import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import {
  gradeNmStage,
  halogenFamilyReference,
  NM_KEYS,
  NM_RULES,
  nmRuleFor,
  nmShown,
  notAnAttempt,
  polyatomicReference,
  safeNote,
  type NmGrade,
  type NmShown,
} from '@/content/modules/nomenclature'
import type { NmStage, NomenclatureAnswer, RuleCard } from '@/content/types'
import { formulaDisplay, formulaLatex, ionByFormula, readChemicalFormula, readIonFormula } from '@/engine'
import type { ProgressLine } from '@/problem/stepEngine'
import { verdictFromNm } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyChoice, savePolyEntries } from './polyUi'
import { recordNmGrade } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: NmGrade
  shown: NmShown
  text: string
}

const CARDS = new Map(NM_RULES.map((card) => [card.id, card]))

const BOX =
  'min-h-12 w-full max-w-md rounded-xl border-2 border-navy-100 bg-white px-3 py-2 text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50 aria-[invalid=true]:border-bad'

/** Keys that are awkward on a phone keyboard, for formulas and ions. Digits are typed as plain digits. */
const FORMULA_KEYS: readonly { label: string; insert: string; name: string }[] = [
  { label: '(', insert: '(', name: 'open parenthesis' },
  { label: ')', insert: ')', name: 'close parenthesis' },
  { label: '·', insert: '·', name: 'hydrate dot' },
  { label: '(aq)', insert: '(aq)', name: 'dissolved in water, (aq)' },
]
const ION_KEYS: readonly { label: string; insert: string; name: string }[] = [
  { label: '(', insert: '(', name: 'open parenthesis' },
  { label: ')', insert: ')', name: 'close parenthesis' },
  { label: '^', insert: '^', name: 'charge mark' },
  { label: '+', insert: '+', name: 'plus' },
  { label: '−', insert: '-', name: 'minus' },
]

/** The problem, with its formulas drawn by KaTeX; a screen reader gets the same sentence as plain text. */
function Statement({ answer }: { answer: NomenclatureAnswer }) {
  if (answer.promptParts.every((part) => 'text' in part)) return <p className="text-lg text-navy sm:text-xl">{answer.prompt}</p>
  return (
    <p className="text-lg text-navy sm:text-xl">
      <span className="sr-only">{answer.prompt}</span>
      <span aria-hidden>
        {answer.promptParts.map((part, i) =>
          'text' in part ? (
            <span key={i}>{part.text}</span>
          ) : (
            <span key={i} className="font-semibold">
              <Katex tex={formulaLatex(part.formula)} />
            </span>
          ),
        )}
      </span>
    </p>
  )
}

/** Her text, with the place the checker points at underlined: a capital-letter problem, an unknown symbol. */
function CaretView({ text, position, length }: { text: string; position: number; length: number }) {
  if (!text || position < 0 || position >= text.length) return null
  const end = Math.min(text.length, position + Math.max(1, length))
  return (
    <p className="mt-1 font-mono text-base text-navy">
      <span className="sr-only">{`The checker points at character ${position + 1} of what you typed: ${text.slice(position, end)}.`}</span>
      <span aria-hidden>
        {text.slice(0, position)}
        <mark className="rounded bg-bad-100 px-0.5 text-bad underline decoration-2">{text.slice(position, end)}</mark>
        {text.slice(end)}
      </span>
    </p>
  )
}

/**
 * What she typed, drawn with real subscripts and charges as she types it. A reader's note goes through the same
 * filter as every other note (the case note names Co and CO, which can be this part's answer).
 */
function readsAs(stage: NmStage, text: string): { ok: true; latex: string; display: string } | { ok: false; message: string } | null {
  if (text.trim() === '') return null
  if (stage.kind === 'formula') {
    const r = readChemicalFormula(text)
    if (!r.ok) return { ok: false, message: safeNote(stage, r.error.message, r.error.reason, text) }
    return { ok: true, latex: formulaLatex(r.value.text), display: formulaDisplay(r.value.text) }
  }
  const r = readIonFormula(text)
  if (!r.ok) return { ok: false, message: safeNote(stage, r.error.message, r.error.reason, text) }
  // "SO42-" reads two ways; show the one that is an ion (SO₄²⁻), as the checker does.
  const ion = ionByFormula(text)
  const reading = (ion && r.value.find((x) => x.charge === ion.charge)) || r.value[0]!
  return { ok: true, latex: formulaLatex(reading.text), display: formulaDisplay(reading.text) }
}

/** A checked part's entry as it is shown after the part is done: the picked kind, her name, her formula with subscripts. */
function entryShown(stage: NmStage, text: string): string {
  if (stage.kind === 'choice') return stage.choices?.find((c) => c.id === text)?.text ?? text
  if (stage.kind === 'name') return text
  const reading = readsAs(stage, text)
  return reading?.ok ? reading.display : text
}

function FormulaBox({
  stage,
  value,
  invalid,
  onChange,
  inputRef,
}: {
  stage: NmStage
  value: string
  invalid: boolean
  onChange: (v: string) => void
  inputRef: (el: HTMLInputElement | null) => void
}) {
  const id = `nm-${stage.id}`
  const local = useRef<HTMLInputElement | null>(null)
  const caret = useRef<number | null>(null)
  useEffect(() => {
    if (caret.current === null || !local.current) return
    local.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [value])
  const keys = stage.kind === 'ion' ? ION_KEYS : stage.kind === 'formula' ? FORMULA_KEYS : []
  const reading = stage.kind === 'formula' || stage.kind === 'ion' ? readsAs(stage, value) : null
  function insert(token: string) {
    const el = local.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    caret.current = start + token.length
    onChange(value.slice(0, start) + token + value.slice(end))
    el?.focus()
  }
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-navy">
        {stage.label}
      </label>
      <input
        ref={(el) => {
          local.current = el
          inputRef(el)
        }}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="text"
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        aria-invalid={invalid ? true : undefined}
        aria-describedby={`${id}-hint${reading ? ` ${id}-reads` : ''}`}
        className={`${BOX} ${stage.kind === 'name' ? '' : 'font-mono'}`}
      />
      <p id={`${id}-hint`} className="mt-1 text-xs text-navy/70">
        {stage.hint}
      </p>
      {keys.length > 0 && (
        <div role="toolbar" aria-label="Formula symbols" className="-mx-1 mt-1 flex gap-1 overflow-x-auto px-1 py-1">
          {keys.map((key) => (
            <button
              key={key.name}
              type="button"
              aria-label={key.name}
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(key.insert)}
              className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-navy-100 bg-white px-2 font-mono text-base text-navy hover:bg-gold-100"
            >
              {key.label}
            </button>
          ))}
        </div>
      )}
      {(stage.kind === 'formula' || stage.kind === 'ion') && (
        <p id={`${id}-reads`} className="mt-1 flex min-h-10 flex-wrap items-center gap-2 text-sm text-navy">
          {reading?.ok ? (
            <>
              <span>reads as</span>
              <Katex tex={reading.latex} className="text-xl" ariaLabel={reading.display} />
            </>
          ) : reading ? (
            <span className="text-bad">{reading.message}</span>
          ) : (
            <span className="text-navy/60">What you type shows here with real subscripts{stage.kind === 'ion' ? ' and the charge' : ''}.</span>
          )}
        </p>
      )}
    </div>
  )
}

function GradeNote({ feedback }: { feedback: Feedback }) {
  const shown = feedback.shown
  if (shown.kind === 'invalid')
    return (
      <div>
        <NotAnAttemptNotice messages={[shown.message]} />
        {shown.position !== undefined && <CaretView text={feedback.text} position={shown.position} length={shown.length ?? 1} />}
      </div>
    )
  if (shown.kind === 'correct') return <SigFigCorrect message={shown.message} />
  if (shown.kind === 'mistake') return <SigFigRejection message={shown.witness} patterns={[{ id: shown.id, title: shown.title, lesson: shown.lesson, example: shown.example }]} />
  return <SigFigRejection message={shown.message} patterns={[]} />
}

/** The textbook's polyatomic ion table, open on request beside the exercises. */
function PolyatomicTable() {
  const groups = useMemo(() => polyatomicReference(), [])
  const halogens = useMemo(() => halogenFamilyReference(), [])
  return (
    <details className="rounded-2xl border border-navy-100 bg-white p-3 text-navy">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">Polyatomic ion table</summary>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <table key={group.charge} className="w-full text-left text-sm">
            <caption className="text-left text-xs font-semibold uppercase tracking-wide text-navy/60">Charge {group.charge}</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Formula</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.name} className="border-t border-navy-50">
                  <td className="py-1 pr-2">{row.name}</td>
                  <td className="py-1 font-mono">{row.display}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
      <p className="mt-3 text-xs text-navy/70">Bromine and iodine form the same family as chlorine (not in the textbook’s table):</p>
      <p className="mt-1 text-sm">
        {halogens.map((row, i) => (
          <span key={row.name}>
            {i > 0 && ', '}
            {row.name} <span className="font-mono">{row.display}</span>
          </span>
        ))}
      </p>
    </details>
  )
}

function partTitle(index: number, total: number, label: string): string {
  return total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label
}

/**
 * Chapter 7 (chemical nomenclature). Parts are checked one at a time by the engine's graders; a named mistake shows
 * its lesson, a sentence about her answer and an example line, none of which gives the answer away. Hints are the
 * shared three-rung ladder per part; her entries survive a reload. A formula or ion is drawn as she types it.
 */
export function NomenclatureFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'nomenclature') return <p className="text-navy">This problem has no naming question — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: NomenclatureAnswer }) {
  const done = Boolean(completion)
  const stages = answer.stages
  const last = stages.length - 1
  const [entries, setEntries] = useState<Entries>(() => ({ ...attempt?.final?.polyEntries }))
  const [passed, setPassed] = useState(() => Math.min(attempt?.final?.polyStage ?? 0, last))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const lastChecked = useRef<string | null>(null)
  const boxes = useRef(new Map<string, HTMLInputElement>())
  const stage = stages[passed]!
  const hint = useHintLadder(attempt, done, passed)

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    setEntries({ ...attempt.final?.polyEntries })
    setPassed(Math.min(attempt.final?.polyStage ?? 0, last))
  }, [attempt, last])

  const register = useCallback(
    (key: string) => (el: HTMLInputElement | null) => {
      if (el) boxes.current.set(key, el)
      else boxes.current.delete(key)
    },
    [],
  )

  const focusBox = useCallback((key: string) => {
    boxes.current.get(key)?.focus({ preventScroll: true })
  }, [])

  const opened = useRef(passed)
  useEffect(() => {
    if (opened.current === passed) return
    opened.current = passed
    focusBox(NM_KEYS[stages[passed]!.id])
  }, [passed, stages, focusBox])

  function update(key: string, value: string) {
    const next = { ...entries, [key]: value }
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && notAnAttempt(f.grade) ? null : f))
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = entries[NM_KEYS[stage.id]] ?? ''
    const grade = gradeNmStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade, shown: nmShown(stage, grade, text), text })
    if (notAnAttempt(grade)) {
      focusBox(NM_KEYS[stage.id])
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordNmGrade(grade)
    const s = useStore.getState()
    if (grade.verdict !== 'correct') {
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
  const invalid = shown ? notAnAttempt(shown.grade) : false
  const mistake = shown?.grade.verdict === 'mistake' ? shown.grade.mistake : null

  const { card, related } = useMemo(() => {
    const firstId = mistake ? nmRuleFor(mistake, stage.part, stage.ruleCard) : stage.ruleCard
    const others = [stage.ruleCard, ...answer.ruleCards]
      .filter((id, i, all) => id !== firstId && all.indexOf(id) === i)
      .map((id) => CARDS.get(id))
      .filter((c): c is RuleCard => c !== undefined)
    return { card: CARDS.get(firstId) ?? null, related: others }
  }, [answer, stage, mistake])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? (stages.length > 1 ? 'all parts checked' : 'answer checked') : `find ${stage.label.toLowerCase()}`,
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
      tutorVerdict={shown ? verdictFromNm(shown.grade) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = NM_KEYS[s.id]
        const titleId = `nm-part-${i}`
        return (
          <section key={s.id} aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
            <h2 id={titleId} className="font-semibold text-navy">
              {partTitle(i, stages.length, s.label)}
            </h2>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {s.kind === 'choice' ? (
                  <>
                    <PolyChoice
                      legend={s.label}
                      name={`nm-choice-${s.id}`}
                      options={(s.choices ?? []).map((choice) => ({ value: choice.id, label: choice.text }))}
                      value={entries[key] ?? ''}
                      disabled={false}
                      onChange={(v) => update(key, v)}
                      firstRef={register(key)}
                    />
                    <p className="text-xs text-navy/70">{s.hint}</p>
                  </>
                ) : (
                  <FormulaBox stage={s} value={entries[key] ?? ''} invalid={invalid} onChange={(v) => update(key, v)} inputRef={register(key)} />
                )}
                <button type="submit" className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {`Check ${s.label.toLowerCase()}`}
                </button>
                {shown && <GradeNote feedback={shown} />}
              </form>
            ) : (
              <>
                <p className={`text-base font-semibold text-navy ${s.kind === 'formula' || s.kind === 'ion' ? 'font-mono' : ''}`}>{entryShown(s, entries[key] ?? '')}</p>
                {stages.length > 1 && (
                  <p role="status" className="text-sm font-semibold text-navy">
                    <span aria-hidden>✓ </span>
                    Correct.
                  </p>
                )}
              </>
            )}
          </section>
        )
      })}

      <PolyatomicTable />

      {done && (
        <section aria-labelledby="nm-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="nm-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
