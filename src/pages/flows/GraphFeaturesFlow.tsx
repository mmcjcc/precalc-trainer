import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { getModule } from '@/content/registry'
import type { RuleCard } from '@/content/types'
import { gradeGraphFeatures, type GfAnswer, type GfEntries, type GfFieldGrade, type GfGrade } from '@/content/modules/graphFeatures/grade'
import { GF_RULE_IDS } from '@/content/modules/graphFeatures/rules'
import type { ErrorPatternId, PatternHit } from '@/shared/types'
import { useStore, type Attempt } from '@/store'
import type { ProgressLine } from '@/problem/stepEngine'
import { GraphPanel } from '@/components/GraphPanel'
import { RuleCardView } from '@/components/HintPanel'
import { SigFigCorrect, SigFigExplanation, SigFigRejection } from '@/components/SigFigFeedback'
import { ProblemFrame } from './ProblemFrame'
import { recordGraphFeatures } from './record'
import type { FlowProps } from './types'

/** Hint-ladder key (attempt.hintsUsed): one ladder per problem. */
const HINT_KEY = 0

const FIELDS: { id: keyof GfEntries; label: string; placeholder: string }[] = [
  { id: 'increasing', label: 'Increasing', placeholder: '(-3, 1) U (4, inf)' },
  { id: 'decreasing', label: 'Decreasing', placeholder: '(-inf, -3) U (1, 4)' },
  { id: 'globalMax', label: 'Global max', placeholder: 'none' },
  { id: 'globalMin', label: 'Global min', placeholder: '(x, y) or none' },
  { id: 'localMax', label: 'Local max', placeholder: '(x, y) or none' },
  { id: 'localMin', label: 'Local min', placeholder: '(x, y) and (x, y)' },
]

/** Rung-2 card for a named mistake. U between points always lands on "Which joiner?". */
const CARD_FOR: Partial<Record<ErrorPatternId, string>> = {
  gf_union_between_points: GF_RULE_IDS.joiner,
  dropped_union: GF_RULE_IDS.joiner,
  gf_y_for_intervals: GF_RULE_IDS.xValues,
  gf_brackets_at_turns: GF_RULE_IDS.open,
  infinity_bracket: GF_RULE_IDS.infinity,
  gf_swapped_inc_dec: GF_RULE_IDS.direction,
  gf_global_on_ray: GF_RULE_IDS.unbounded,
  gf_global_not_local: GF_RULE_IDS.globalLocal,
  gf_not_turning_point: GF_RULE_IDS.points,
  gf_swapped_coordinates: GF_RULE_IDS.points,
}

const EMPTY: GfEntries = { increasing: '', decreasing: '', globalMax: '', globalMin: '', localMax: '', localMin: '' }

function readEntries(attempt: Attempt | null): GfEntries {
  const saved = attempt?.final?.gfEntries
  if (!saved) return { ...EMPTY }
  return {
    increasing: saved.increasing ?? '',
    decreasing: saved.decreasing ?? '',
    globalMax: saved.globalMax ?? '',
    globalMin: saved.globalMin ?? '',
    localMax: saved.localMax ?? '',
    localMin: saved.localMin ?? '',
  }
}

/**
 * Three rungs: nudge, rule card, worked explanation. Rung 3 shows the answer, so it is flagged on
 * the attempt (`final.revealed`) and the answer no longer counts as a first try.
 */
function useGraphHint(attempt: Attempt | null, disabled: boolean): { rung: 0 | 1 | 2 | 3; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(HINT_KEY)] ?? 0) as 0 | 1 | 2 | 3
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(HINT_KEY)] ?? 0
    if (cur >= 3) return
    const next = (cur + 1) as 1 | 2 | 3
    s.useHint(HINT_KEY, next)
    if (next === 3) s.setFinal({ revealed: true, firstCorrect: false })
  }, [disabled])
  return { rung, advance }
}

const HINT_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

function HintLadder({
  rung,
  nudge,
  card,
  explanation,
  onAdvance,
  disabled,
}: {
  rung: 0 | 1 | 2 | 3
  nudge: string
  card: RuleCard | null
  explanation: string[]
  onAdvance: () => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">Hints never appear on their own. Ctrl+Shift+H steps through them.</p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || rung === 3}
        className="min-h-11 w-full rounded-xl bg-gold px-3 font-semibold text-navy hover:bg-gold/80 disabled:opacity-50"
      >
        {HINT_LABEL[rung]}
        {rung === 2 && <span className="ml-1 text-xs font-normal text-gold-text">(marks the answer as shown)</span>}
      </button>
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">{nudge}</p>
        </div>
      )}
      {rung >= 2 && card && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">Rule</p>
          <RuleCardView card={card} />
        </div>
      )}
      {rung >= 3 && <SigFigExplanation steps={explanation} title="Worked explanation" />}
    </div>
  )
}

function headline(patterns: PatternHit[]): PatternHit | null {
  return patterns.find((p) => p.id === 'gf_union_between_points') ?? patterns[0] ?? null
}

/**
 * Reading a graph: the labelled curve is the question (shown up front, not behind the reveal gate),
 * then the six boxes, then Check. No calculator panel. A wrong U between points opens the
 * "Which joiner?" card at hint rung 2.
 */
export function GraphFeaturesFlow(props: FlowProps) {
  const answer = props.instance.answer
  if (answer.type !== 'graphFeatures') return <p className="text-navy">This problem has no graph to read — pick another from the module page.</p>
  return <GraphFeaturesBody {...props} answer={answer} />
}

function GraphFeaturesBody({ instance, attempt, flags, templateTitle, completion, finish, answer }: FlowProps & { answer: GfAnswer }) {
  const done = Boolean(completion)
  const mod = getModule(instance.moduleId)
  const cardsById = useMemo(() => new Map(mod.ruleCards.map((c) => [c.id, c])), [mod])
  const [entries, setEntries] = useState<GfEntries>(() => readEntries(attempt))
  const [grade, setGrade] = useState<GfGrade | null>(null)
  const [lastPattern, setLastPattern] = useState<PatternHit | null>(null)
  const lastChecked = useRef<string | null>(null)
  const hint = useGraphHint(attempt, done)

  function savedEntries(next: GfEntries): Record<string, string> {
    return {
      increasing: next.increasing,
      decreasing: next.decreasing,
      globalMax: next.globalMax,
      globalMin: next.globalMin,
      localMax: next.localMax,
      localMin: next.localMin,
    }
  }

  function save(next: GfEntries) {
    setEntries(next)
    useStore.getState().setFinal({ gfEntries: savedEntries(next) })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (done) return
    const g = gradeGraphFeatures(answer, entries)
    setGrade(g)
    if (!g.incomplete && !g.correct) setLastPattern(headline(g.patterns))
    if (g.correct) setLastPattern(null)
    if (g.incomplete) return
    const key = FIELDS.map((f) => entries[f.id].trim()).join('\n')
    if (lastChecked.current === key) return
    lastChecked.current = key
    useStore.getState().setFinal({ gfEntries: savedEntries(entries) })
    recordGraphFeatures(g)
    if (g.correct) finish()
  }

  const patternCard = lastPattern ? cardsById.get(CARD_FOR[lastPattern.id] ?? '') : undefined
  const fallbackCard: RuleCard | null = lastPattern
    ? { id: lastPattern.id, title: lastPattern.title, body: lastPattern.lesson, example: lastPattern.example }
    : null
  const card = patternCard ?? (lastPattern ? fallbackCard : (cardsById.get(answer.ruleCard) ?? null))

  const progress: ProgressLine = {
    stage: done ? 1 : 0,
    total: 1,
    label: done ? 'answer checked' : 'read the graph',
    solved: done,
    offPath: false,
  }
  const byId = new Map(grade?.fields.map((f) => [f.id, f]))

  return (
    <ProblemFrame
      instance={instance}
      attempt={attempt}
      flags={flags}
      templateTitle={templateTitle}
      progress={progress}
      completion={completion}
      nudgeText="Still here? Read the labelled turns, then fill in the six boxes — the hint button is right there."
      graphCaption="the function, with its turning points labelled"
      statement={
        <div className="space-y-1">
          <GraphPanel spec={instance.graph} caption="the function, with its turning points labelled" />
        </div>
      }
      hints={<HintLadder rung={hint.rung} nudge={answer.nudge} card={card} explanation={answer.reveal} onAdvance={hint.advance} disabled={done} />}
      keymap={{ onHint: hint.advance }}
    >
      <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4" aria-labelledby="gf-answer-title">
        <h2 id="gf-answer-title" className="font-semibold text-navy">
          Your answers
        </h2>
        <p className="text-sm text-navy/70">
          Increasing and decreasing: interval notation, using x-values. A max or min: (x, y), or none. More than one point: separate them with and or a comma.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const field = byId.get(f.id)
            const wide = f.id === 'increasing' || f.id === 'decreasing'
            return (
              <div key={f.id} className={wide ? 'sm:col-span-2' : undefined}>
                <label htmlFor={`gf-${f.id}`} className="block text-sm font-semibold text-navy">
                  {f.label}
                </label>
                <input
                  id={`gf-${f.id}`}
                  type="text"
                  inputMode="text"
                  value={entries[f.id]}
                  disabled={done}
                  placeholder={f.placeholder}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={field?.status === 'wrong' || field?.status === 'empty' ? true : undefined}
                  onChange={(e) => save({ ...entries, [f.id]: e.target.value })}
                  className="mt-1 min-h-12 w-full rounded-xl border-2 border-navy-100 bg-white px-3 py-2 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy disabled:bg-navy-50"
                />
                <FieldNote field={field} />
              </div>
            )
          })}
        </div>
        {grade && !grade.correct && !grade.incomplete && <SigFigRejection message={grade.patterns[0]?.witness ?? wrongSummary(grade)} patterns={grade.patterns} />}
        {grade?.incomplete && (
          <p role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-sm text-navy">
            <span aria-hidden>✗ </span>
            {grade.fields
              .filter((f) => f.status === 'empty')
              .map((f) => f.message)
              .join(' ')}
          </p>
        )}
        {grade?.correct && <SigFigCorrect message="That's the graph." />}
        {!done && (
          <button type="submit" className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
            Check
          </button>
        )}
        {done && <SigFigExplanation steps={answer.reveal} title="How to read it" />}
      </form>
    </ProblemFrame>
  )
}

function FieldNote({ field }: { field: GfFieldGrade | undefined }) {
  if (!field || field.status === 'unchecked') return null
  if (field.status === 'ok') {
    return (
      <p className="mt-1 text-sm text-ok">
        <span aria-hidden>✓ </span>Looks right.
      </p>
    )
  }
  if (!field.message) return null
  return (
    <p className={`mt-1 text-sm ${field.status === 'wrong' ? 'text-bad' : 'text-navy/70'}`}>
      {field.status === 'wrong' && <span aria-hidden>✗ </span>}
      {field.message}
    </p>
  )
}

function wrongSummary(grade: GfGrade): string {
  return grade.fields.find((f) => f.status === 'wrong')?.message ?? 'Not quite — check each box.'
}
