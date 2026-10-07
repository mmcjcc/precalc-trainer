import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { GraphPanel } from '@/components/GraphPanel'
import { Katex } from '@/components/Katex'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { gradeK, gradePwSet, type PwGrade } from '@/content/modules/piecewiseRate/grade'
import { PW_RULE_IDS } from '@/content/modules/piecewiseRate/rules'
import { gradeWrite, type WriteRow } from '@/content/modules/piecewiseRate/write'
import { transformPattern } from '@/content/modules/transformations/patterns'
import { getModule } from '@/content/registry'
import type { AnswerSpec, RuleCard } from '@/content/types'
import { gradePiecewiseValue, patternHit, toRational, type PiecewisePiece, type TransformGrade } from '@/engine'
import { safeLatex, type ProgressLine } from '@/problem/stepEngine'
import { verdictFromPw, verdictFromTransform } from '@/problem/tutorContext'
import type { ErrorPatternId } from '@/shared/types'
import { ProblemFrame } from './ProblemFrame'
import { SetAnswerField, saveFnEntries } from './fnUi'
import { HintLadder, NotAnAttemptNotice, useHintLadder } from './hintLadder'
import { recordPwGrade, recordTransformGrade } from './record'
import type { FlowProps } from './types'

type PiecewiseAnswer = Extract<AnswerSpec, { type: 'piecewiseRate' }>
type Part = NonNullable<PiecewiseAnswer['parts']>[number]
type Entries = Record<string, string>
type Shown = PwGrade | TransformGrade

const CARD: Partial<Record<ErrorPatternId, string>> = {
  pw_piecewise_boundary: PW_RULE_IDS.dots,
  pw_piecewise_wrong_piece: PW_RULE_IDS.dots,
  pw_piecewise_value_where_undefined: PW_RULE_IDS.dots,
  pw_piecewise_undefined_where_defined: PW_RULE_IDS.dots,
  pw_domain_gap: PW_RULE_IDS.domain,
  pw_domain_closed: PW_RULE_IDS.domain,
  pw_range_from_x: PW_RULE_IDS.range,
  pw_range_unrestricted: PW_RULE_IDS.range,
  pw_k_wrong_piece: PW_RULE_IDS.continuous,
  pw_k_sign: PW_RULE_IDS.continuous,
  pw_k_other_boundary: PW_RULE_IDS.continuous,
  pw_write_boundary: PW_RULE_IDS.write,
  pw_write_slope: PW_RULE_IDS.write,
  pw_write_intercept: PW_RULE_IDS.write,
  pw_write_overlap: PW_RULE_IDS.write,
}

const BOX =
  'min-h-12 w-full min-w-0 flex-1 rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50'

function enginePieces(answer: PiecewiseAnswer): PiecewisePiece[] {
  return (answer.pieces ?? []).map((p) => ({
    formula: p.formula,
    interval: {
      lo: p.lo === '-inf' ? '-inf' : (toRational(p.lo) ?? { n: 0, d: 1 }),
      hi: p.hi === 'inf' ? 'inf' : (toRational(p.hi) ?? { n: 0, d: 1 }),
      loClosed: p.loClosed,
      hiClosed: p.hiClosed,
    },
  }))
}

function casesTex(answer: PiecewiseAnswer): string {
  const rows = (answer.pieces ?? []).map((p) => `${safeLatex(p.formula)} & ${safeLatex(p.condition)}`).join(' \\\\ ')
  return `f(x)=\\begin{cases} ${rows} \\end{cases}`
}

function kTex(answer: PiecewiseAnswer): string {
  const left = answer.pieces?.[0]
  const right = answer.pieces?.[1]
  const rows = [
    `${safeLatex(answer.leftFormula ?? '')} & ${safeLatex(left?.condition ?? '')}`,
    `${safeLatex(answer.rightFormula ?? '')} & ${safeLatex(right?.condition ?? '')}`,
  ].join(' \\\\ ')
  return `f(x)=\\begin{cases} ${rows} \\end{cases}`
}

function rowCount(entries: Entries): number {
  const n = Number(entries.n)
  if (!Number.isInteger(n) || n < 1) return 1
  return Math.min(4, n)
}

function rowsOf(entries: Entries): WriteRow[] {
  return Array.from({ length: rowCount(entries) }, (_, i) => ({ formula: entries[`f${i}`] ?? '', condition: entries[`c${i}`] ?? '' }))
}

function isPw(grade: Shown): grade is PwGrade {
  if (grade.verdict === 'unsupported') return false
  if (grade.verdict === 'mistake') return 'id' in grade
  return true
}

/**
 * Graph reading, domain and range, continuity, and writing a piecewise function.
 * The graph is the problem for reading and writing. For domain and continuity it appears only after she finishes.
 */
export function PiecewiseMore({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: PiecewiseAnswer }) {
  const done = Boolean(completion)
  const parts = answer.parts ?? []
  const last = Math.max(0, parts.length - 1)
  const [entries, setEntries] = useState<Entries>(() => ({ ...(attempt?.final?.fnEntries ?? {}) }))
  const [passed, setPassed] = useState(() => clampPassed(attempt?.final?.fnEntries?.passed, last))
  const [grade, setGrade] = useState<Shown | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useHintLadder(attempt, done, passed)
  const mod = getModule(instance.moduleId)
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])

  const restoredFor = useRef<string | null>(attempt?.id ?? null)
  useEffect(() => {
    if (!attempt || restoredFor.current === attempt.id) return
    restoredFor.current = attempt.id
    setEntries({ ...(attempt.final?.fnEntries ?? {}) })
    setPassed(clampPassed(attempt.final?.fnEntries?.passed, last))
  }, [attempt, last])

  function store(next: Entries) {
    setEntries(next)
    saveFnEntries(next)
    setBlocked(null)
  }

  function update(key: string, value: string) {
    store({ ...entries, [key]: value, passed: String(passed) })
  }

  const part = parts[Math.min(passed, last)]
  const write = answer.question === 'write'

  function submit() {
    if (done || !part) return
    if (write) {
      const rows = rowsOf(entries)
      const g = gradeWrite(enginePieces(answer), (answer.traps ?? []).flatMap((t) => (t.rows ? [{ id: t.id, rows: t.rows }] : [])), rows)
      apply(g, JSON.stringify(rows))
      return
    }
    const text = entries[part.key] ?? ''
    if (answer.question === 'graph') {
      const ask = answer.asks?.[passed]
      if (!ask) return
      apply(gradePiecewiseValue(enginePieces(answer), ask.x, text), `${passed}:${text.trim()}`)
      return
    }
    if (answer.question === 'domain') {
      apply(gradePwSet(answer.pieces ?? [], part.key === 'range' ? 'range' : 'domain', text), `${part.key}:${text.trim()}`)
      return
    }
    apply(gradeK(answer.kText ?? '', (answer.traps ?? []).flatMap((t) => (t.text ? [{ id: t.id, text: t.text }] : [])), text), text.trim())
  }

  function apply(g: Shown, key: string) {
    setGrade(g)
    if (g.verdict === 'invalid' || g.verdict === 'unsupported') {
      setBlocked(g.message)
      return
    }
    setBlocked(null)
    if (lastChecked.current === key) return
    lastChecked.current = key
    if (isPw(g)) recordPwGrade(g)
    else recordTransformGrade(g)
    if (g.verdict !== 'correct') return
    if (passed < last) {
      const next = passed + 1
      setPassed(next)
      store({ ...entries, passed: String(next) })
      setGrade(null)
      lastChecked.current = null
      return
    }
    finish()
  }

  const patternId: ErrorPatternId | null =
    grade?.verdict === 'mistake' ? ('id' in grade ? grade.id : transformPattern(grade.mistake, grade.witness).id) : null
  const cardId = (patternId && CARD[patternId]) || part?.ruleCard || answer.ruleCard
  const card: RuleCard | null = cardsById.get(cardId) ?? null
  const total = Math.max(1, parts.length)
  const progress: ProgressLine = {
    stage: done ? total : passed,
    total,
    label: done ? 'answer checked' : (part?.label ?? 'give the answer'),
    solved: done,
    offPath: false,
  }
  const showGraphNow = (answer.question === 'graph' || answer.question === 'write') && answer.sketch
  const showGraphAfter = done && (answer.question === 'domain' || answer.question === 'continuous') && answer.sketch
  const tutorVerdict = grade ? (isPw(grade) ? verdictFromPw(grade) : verdictFromTransform(grade)) : undefined

  const statement = (
    <div className="space-y-3">
      {showGraphNow && <GraphPanel spec={answer.sketch!} />}
      {answer.question === 'domain' && <Katex tex={casesTex(answer)} display />}
      {answer.question === 'continuous' && <Katex tex={kTex(answer)} display />}
      <p className="text-sm text-navy">{instance.statementText}</p>
    </div>
  )

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      tutorVerdict={tutorVerdict ?? undefined}
      statement={statement}
      hints={
        <HintLadder
          rung={hint.rung}
          nudge={part?.nudge ?? answer.nudge}
          card={card}
          explanation={part?.reveal ?? answer.reveal}
          onAdvance={hint.advance}
          disabled={done}
        />
      }
      keymap={{ onHint: hint.advance }}
    >
      <section className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="pw-more-title">
        <h2 id="pw-more-title" className="font-semibold text-navy">
          {write ? 'The pieces' : parts.length > 1 ? `Part ${Math.min(passed, last) + 1} of ${parts.length}` : 'Answer'}
        </h2>
        {write ? (
          <WriteRows entries={entries} disabled={done} onChange={update} onCount={(n) => store({ ...entries, n: String(n), passed: String(passed) })} onSubmit={submit} />
        ) : (
          parts.map((p, i) => {
            if (i > passed) return null
            return (
              <PartField
                key={p.key}
                part={p}
                value={entries[p.key] ?? ''}
                disabled={done || i < passed}
                set={answer.question === 'domain'}
                variable={p.key === 'range' ? 'y' : 'x'}
                onChange={(v) => update(p.key, v)}
                onSubmit={submit}
              />
            )
          })
        )}
        {blocked && <NotAnAttemptNotice messages={[blocked]} />}
        {!blocked && <GradeLine grade={grade} />}
        {done && <SigFigExplanation steps={answer.reveal} />}
      </section>
      {showGraphAfter && (
        <section className="space-y-2 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="pw-after-graph">
          <h2 id="pw-after-graph" className="font-semibold text-navy">
            The graph of f
          </h2>
          <GraphPanel spec={answer.sketch!} />
        </section>
      )}
    </ProblemFrame>
  )
}

function clampPassed(raw: string | undefined, last: number): number {
  const n = Number(raw ?? '0')
  if (!Number.isInteger(n)) return 0
  return Math.min(Math.max(0, n), last)
}

function GradeLine({ grade }: { grade: Shown | null }) {
  if (!grade || grade.verdict === 'invalid' || grade.verdict === 'unsupported') return null
  if (grade.verdict === 'correct') return <SigFigCorrect message={grade.message} />
  if (grade.verdict === 'mistake' && 'id' in grade) return <SigFigRejection message={grade.witness} patterns={[patternHit(grade.id, grade.witness)]} />
  if (grade.verdict === 'mistake') return <SigFigRejection message={grade.witness} patterns={[transformPattern(grade.mistake, grade.witness)]} />
  return <SigFigRejection message={grade.message} patterns={[]} />
}

function PartField({
  part,
  value,
  disabled,
  set,
  variable,
  onChange,
  onSubmit,
}: {
  part: Part
  value: string
  disabled: boolean
  set: boolean
  variable: 'x' | 'y'
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  if (set) {
    return <SetAnswerField value={value} onChange={onChange} onSubmit={onSubmit} label={part.label} variable={variable} disabled={disabled} placeholder={part.placeholder} />
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!disabled) onSubmit()
      }}
      className="space-y-2"
      noValidate
    >
      <label htmlFor={`pw-${part.key}`} className="block text-sm font-semibold text-navy">
        {part.label}
      </label>
      <div className="flex gap-2">
        <input
          id={`pw-${part.key}`}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          placeholder={part.placeholder}
          inputMode="text"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          className={BOX}
        />
        <button type="submit" disabled={disabled} className="min-h-12 shrink-0 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
          Check
        </button>
      </div>
    </form>
  )
}

function WriteRows({
  entries,
  disabled,
  onChange,
  onCount,
  onSubmit,
}: {
  entries: Entries
  disabled: boolean
  onChange: (key: string, value: string) => void
  onCount: (n: number) => void
  onSubmit: () => void
}) {
  const n = rowCount(entries)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!disabled) onSubmit()
  }
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor={`pw-f${i}`} className="block text-sm font-semibold text-navy">
              Formula for piece {i + 1}
            </label>
            <input
              id={`pw-f${i}`}
              type="text"
              value={entries[`f${i}`] ?? ''}
              disabled={disabled}
              onChange={(e) => onChange(`f${i}`, e.target.value)}
              placeholder="formula in x"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className={`mt-1 ${BOX}`}
            />
          </div>
          <div>
            <label htmlFor={`pw-c${i}`} className="block text-sm font-semibold text-navy">
              Interval for piece {i + 1}
            </label>
            <input
              id={`pw-c${i}`}
              type="text"
              value={entries[`c${i}`] ?? ''}
              disabled={disabled}
              onChange={(e) => onChange(`c${i}`, e.target.value)}
              placeholder="left <= x < right"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className={`mt-1 ${BOX}`}
            />
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled || n >= 4} onClick={() => onCount(n + 1)} className="min-h-12 rounded-xl border-2 border-navy-100 px-3 font-semibold text-navy hover:bg-navy-50 disabled:opacity-50">
          Add a piece
        </button>
        <button type="button" disabled={disabled || n <= 1} onClick={() => onCount(n - 1)} className="min-h-12 rounded-xl border-2 border-navy-100 px-3 font-semibold text-navy hover:bg-navy-50 disabled:opacity-50">
          Remove a piece
        </button>
        <button type="submit" disabled={disabled} className="min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600 disabled:opacity-50">
          Check
        </button>
      </div>
    </form>
  )
}
