import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { GeoFigure } from '@/components/GeoFigure'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { SymbolStrip } from '@/components/MathSymbolStrip'
import { insertToken, type StripKey } from '@/components/symbolStrip'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { GEO_KEYS, GEO_RULE_FOR, exampleShowsAnswer, gradeGeoStage, type GeoGrade, type GeometryAnswer } from '@/content/modules/geometry'
import { stageDisplay } from '@/content/modules/geometry/grade'
import { REASON_GROUPS, reasonLabel, reasonsInGroup, type ReasonId } from '@/content/modules/geometry/reasons'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { patternHit } from '@/engine'
import { type ProgressLine } from '@/problem/stepEngine'
import { verdictFromGeo } from '@/problem/tutorContext'
import { useStore } from '@/store'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { PolyChoice, PolyTextBox, savePolyEntries } from './polyUi'
import { recordGeoGrades } from './record'
import { ProblemFrame } from './ProblemFrame'
import type { FlowProps } from './types'

type Entries = Record<string, string>

interface Feedback {
  stage: number
  grade: GeoGrade
}

const GEO_KEYS_STRIP: readonly StripKey[] = [
  { label: '√', insert: 'sqrt()', caret: -1, name: 'square root' },
  { label: '°', insert: '°', caret: 0, name: 'degrees' },
  { label: '(', insert: '(', caret: 0, name: 'open parenthesis' },
  { label: ')', insert: ')', caret: 0, name: 'close parenthesis' },
  { label: ',', insert: ',', caret: 0, name: 'comma' },
]

/** A line is written as an equation in x and y (y = x + 1); the strip leaves the letters to the keyboard. */
const LINE_VARS: readonly string[] = ['x', 'y']

function Statement({ answer }: { answer: GeometryAnswer }) {
  return (
    <div className="space-y-3">
      {answer.figure.points.length > 0 && <GeoFigure spec={answer.figure} />}
      {answer.lines && answer.lines.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5 text-sm text-navy">
          {answer.lines.map((line, index) => (
            <li key={`${index}-${line}`}>{line}</li>
          ))}
        </ol>
      )}
      <p className="whitespace-pre-line text-sm text-navy">{answer.prompt}</p>
    </div>
  )
}

function pickedText(stage: GeometryAnswer['stages'][number], id: string): string {
  if (stage.kind === 'choice') return stage.choices?.find((choice) => choice.id === id)?.text ?? id
  if (stage.kind === 'reason') return id ? reasonLabel(id) : ''
  return id
}

/** The shared reason bank: a search box, then one 44 px radio per reason, grouped. Arrow keys move the pick. */
function ReasonList({
  stageId,
  value,
  disabled,
  onChange,
  searchRef,
}: {
  stageId: string
  value: string
  disabled: boolean
  onChange: (id: string) => void
  searchRef?: Ref<HTMLInputElement>
}) {
  const [query, setQuery] = useState('')
  const groupRef = useRef<HTMLDivElement>(null)
  const pending = useRef<string | null>(null)
  const q = query.trim().toLowerCase()
  const groups = REASON_GROUPS.map((group) => ({
    ...group,
    reasons: reasonsInGroup(group.id).filter((reason) => !q || reason.label.toLowerCase().includes(q)),
  })).filter((group) => group.reasons.length > 0)
  const visible = groups.flatMap((group) => group.reasons)
  const firstId = visible[0]?.id ?? ''

  useEffect(() => {
    const id = pending.current
    if (!id) return
    pending.current = null
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-reason-id="${id}"]`)?.focus()
  }, [value, query])

  function move(fromId: ReasonId, dir: 1 | -1 | 'start' | 'end') {
    const ids = visible.map((reason) => reason.id)
    const index = ids.indexOf(fromId)
    const next =
      dir === 'start' ? ids[0] : dir === 'end' ? ids[ids.length - 1] : ids[Math.max(0, Math.min(ids.length - 1, (index < 0 ? 0 : index) + dir))]
    if (!next) return
    pending.current = next
    onChange(next)
  }

  function onRadioKey(event: KeyboardEvent<HTMLButtonElement>, id: ReasonId) {
    if (event.key === 'ArrowDown') move(id, 1)
    else if (event.key === 'ArrowUp') move(id, -1)
    else if (event.key === 'Home') move(id, 'start')
    else if (event.key === 'End') move(id, 'end')
    else return
    event.preventDefault()
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') event.preventDefault()
    if (event.key === 'ArrowDown' && firstId) {
      event.preventDefault()
      pending.current = firstId
      onChange(firstId)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-navy">
        Search reasons
        <input
          ref={searchRef}
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onSearchKey}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="mt-1 min-h-11 w-full rounded-xl border-2 border-navy-100 px-3 text-base text-navy outline-none focus:border-navy"
        />
      </label>
      <div ref={groupRef} id={`geo-reasons-${stageId}`} role="radiogroup" aria-label="Reason" className="space-y-3">
        {groups.map((group) => (
          <fieldset key={group.id} className="space-y-1">
            <legend className="text-xs font-semibold uppercase tracking-wide text-navy/60">{group.title}</legend>
            {group.reasons.map((reason) => {
              const selected = value === reason.id
              return (
                <button
                  key={reason.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-reason-id={reason.id}
                  disabled={disabled}
                  tabIndex={selected || (!value && reason.id === firstId) ? 0 : -1}
                  onClick={() => onChange(reason.id)}
                  onKeyDown={(event) => onRadioKey(event, reason.id)}
                  className={`flex min-h-11 w-full items-center rounded-xl border-2 px-3 text-left text-sm text-navy ${selected ? 'border-navy bg-gold-100' : 'border-navy-100 bg-white'} ${disabled ? 'opacity-60' : 'hover:border-navy'}`}
                >
                  {reason.label}
                </button>
              )
            })}
          </fieldset>
        ))}
        {visible.length === 0 && <p className="text-sm text-navy">No reason has those words. Clear the search to see the whole list.</p>}
      </div>
    </div>
  )
}

function GradeNote({ grade, answerText }: { grade: GeoGrade; answerText: string }) {
  if (grade.verdict === 'invalid') return <NotAnAttemptNotice messages={[grade.message]} />
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake') {
    const hit = patternHit(grade.mistake, grade.witness)
    const shown = exampleShowsAnswer(hit.example, answerText) ? { ...hit, example: '' } : hit
    return <SigFigRejection message={grade.witness} patterns={[shown]} />
  }
  return <SigFigRejection message={grade.message} patterns={[]} />
}

function partTitle(index: number, total: number, label: string): string {
  return total > 1 ? `Part ${index + 1} of ${total}: ${label}` : label
}

/**
 * Honors geometry. The figure is the problem, so it is on screen before she answers. Parts are
 * checked one at a time. Hints are the shared three-rung ladder; her entries survive a reload.
 */
export function GeometryFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'geometry') return <p className="text-navy">This problem has no figure to work with — pick another from the module page.</p>
  return <Body {...props} answer={answer} />
}

function Body({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: GeometryAnswer }) {
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
  const keypadOn = useMathKeypadOn()

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
    focusBox(GEO_KEYS[stages[passed]!.id])
  }, [passed, stages, focusBox])

  function store(next: Entries) {
    setEntries(next)
    savePolyEntries(next)
    setFeedback((f) => (f && f.grade.verdict === 'invalid' ? null : f))
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value })
  }

  function insert(key: StripKey) {
    const boxKey = GEO_KEYS[stage.id]
    const el = boxes.current.get(boxKey)
    const value = entries[boxKey] ?? ''
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = insertToken(value, start, end, key)
    update(boxKey, next.value)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.caret, next.caret)
    })
  }

  function check() {
    if (done) return
    savePolyEntries(entries)
    const text = entries[GEO_KEYS[stage.id]] ?? ''
    const grade = gradeGeoStage(answer, stage.id, text)
    setFeedback({ stage: passed, grade })
    if (grade.verdict === 'invalid') {
      focusBox(GEO_KEYS[stage.id])
      return
    }
    const key = `${passed} ${text}`
    if (lastChecked.current === key) return
    lastChecked.current = key
    recordGeoGrades(grade)
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
  const invalid = shown?.grade.verdict === 'invalid'
  const mistake = shown?.grade.verdict === 'mistake' ? shown.grade.mistake : null

  const mod = getModule(instance.moduleId)
  const { card, related } = useMemo(() => {
    const byId = new Map(mod.ruleCards.map((c) => [c.id, c]))
    const firstId = (mistake && GEO_RULE_FOR[mistake]) || stage.ruleCard
    const others = answer.ruleCards.filter((id) => id !== firstId).map((id) => byId.get(id)).filter((c): c is RuleCard => c !== undefined)
    return { card: byId.get(firstId) ?? null, related: others }
  }, [mod, answer, stage, mistake])

  const progress: ProgressLine = {
    stage: done ? stages.length : passed,
    total: stages.length,
    label: done ? (stages.length > 1 ? 'all parts checked' : 'answer checked') : `find ${stage.label}`,
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
      tutorVerdict={shown ? verdictFromGeo(shown.grade) : undefined}
      nudgeText="Still here? The part that is open is waiting for you below. The hint button is right there."
      keymap={{ onHint: hint.advance }}
      statement={<Statement answer={answer} />}
      hints={<HintLadder rung={hint.rung} nudge={stage.nudge} card={card} related={related} explanation={stage.reveal} onAdvance={hint.advance} disabled={done} />}
    >
      {stages.map((s, i) => {
        if (i > passed) return null
        const open = i === passed && !done
        const key = GEO_KEYS[s.id]
        const titleId = `geo-part-${i}`
        return (
          <section key={s.id} aria-labelledby={titleId} className="space-y-3 rounded-2xl border border-navy-100 bg-white p-3 sm:p-4">
            <h2 id={titleId} className="font-semibold text-navy">
              {partTitle(i, stages.length, s.label)}
            </h2>
            {open ? (
              <form onSubmit={submit} noValidate className="space-y-4">
                {s.note && <p className="text-sm text-navy">{s.note}</p>}
                {s.kind === 'choice' ? (
                  <PolyChoice
                    legend="Choices"
                    name={`geo-choice-${s.id}`}
                    options={(s.choices ?? []).map((choice) => ({ value: choice.id, label: choice.text }))}
                    value={entries[key] ?? ''}
                    disabled={false}
                    onChange={(v) => update(key, v)}
                    firstRef={register(key)}
                  />
                ) : s.kind === 'reason' ? (
                  <ReasonList stageId={s.id} value={entries[key] ?? ''} disabled={false} onChange={(v) => update(key, v)} searchRef={register(key)} />
                ) : (
                  <>
                    <PolyTextBox
                      id={`geo-${s.id}`}
                      label={s.label}
                      hint={s.hint}
                      placeholder=""
                      value={entries[key] ?? ''}
                      disabled={false}
                      invalid={Boolean(invalid)}
                      onChange={(v) => update(key, v)}
                      inputRef={register(key)}
                      keypad={{ keys: GEO_KEYS_STRIP, vars: s.kind === 'line' ? LINE_VARS : undefined }}
                    />
                    {!keypadOn && <SymbolStrip onInsert={insert} keys={GEO_KEYS_STRIP} disabled={false} />}
                  </>
                )}
                {(s.kind === 'choice' || s.kind === 'reason') && (
                  <p id={`geo-${s.id}-hint`} className="text-xs text-navy/70">
                    {s.hint}
                  </p>
                )}
                <button type="submit" className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
                  {`Check ${s.label}`}
                </button>
                {shown && <GradeNote grade={shown.grade} answerText={stageDisplay(s)} />}
              </form>
            ) : s.kind === 'choice' || s.kind === 'reason' ? (
              <>
                {s.note && <p className="text-sm text-navy">{s.note}</p>}
                <p className="text-sm font-semibold text-navy">{pickedText(s, entries[key] ?? '')}</p>
                {stages.length > 1 && (
                  <p role="status" className="text-sm font-semibold text-navy">
                    <span aria-hidden>✓ </span>
                    Correct.
                  </p>
                )}
              </>
            ) : (
              <>
                <PolyTextBox
                  id={`geo-${s.id}`}
                  label={s.label}
                  hint={s.hint}
                  placeholder=""
                  value={entries[key] ?? ''}
                  disabled
                  invalid={false}
                  onChange={() => {}}
                />
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

      {done && (
        <section aria-labelledby="geo-worked-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="geo-worked-title" className="font-semibold text-navy">
            The answer, worked out
          </h2>
          <SigFigExplanation steps={answer.reveal} />
        </section>
      )}
    </ProblemFrame>
  )
}
