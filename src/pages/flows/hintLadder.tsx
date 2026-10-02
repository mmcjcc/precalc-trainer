import { useCallback } from 'react'
import type { RuleCard } from '@/content/types'
import { RuleCardView } from '@/components/HintPanel'
import { SigFigExplanation } from '@/components/SigFigFeedback'
import { useStore, type Attempt } from '@/store'

/** Hint-ladder key (attempt.hintsUsed) for a problem with one ladder. */
export const ANSWER_HINT_KEY = 0

export type LadderRung = 0 | 1 | 2 | 3

const HINT_LABEL: Record<LadderRung, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Explain the answer',
  3: 'All hints shown',
}

/**
 * Three-rung hint ladder: nudge, rule card, explanation. Rung 3 shows the answer, so it is flagged on the
 * attempt the same way every other flow flags a reveal, and the attempt no longer counts as a first try.
 */
export function useHintLadder(attempt: Attempt | null, disabled: boolean, key: number = ANSWER_HINT_KEY): { rung: LadderRung; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(key)] ?? 0) as LadderRung
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(key)] ?? 0
    if (cur >= 3) return
    const next = (cur + 1) as 1 | 2 | 3
    s.useHint(key, next)
    if (next === 3) s.setFinal({ revealed: true, firstCorrect: false })
  }, [disabled, key])
  return { rung, advance }
}

/**
 * The hints panel for an answer-only screen: the nudge, then the rule card (with any related cards folded
 * under it), then the worked explanation.
 */
export function HintLadder({
  rung,
  nudge,
  card,
  related = [],
  explanation,
  onAdvance,
  disabled,
}: {
  rung: LadderRung
  nudge: string
  card: RuleCard | null
  related?: RuleCard[]
  explanation: readonly string[]
  onAdvance: () => void
  disabled: boolean
}) {
  const exhausted = rung === 3
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">Hints never appear on their own. Ctrl+Shift+H steps through them.</p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || exhausted}
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
          {related.length > 0 && (
            <details className="mt-2 rounded-xl border border-navy-100 bg-white p-2">
              <summary className="min-h-11 cursor-pointer text-sm font-semibold text-navy">
                Related {related.length === 1 ? 'rule' : 'rules'} ({related.length})
              </summary>
              <div className="mt-2 space-y-2">
                {related.map((c) => (
                  <RuleCardView key={c.id} card={c} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
      {rung >= 3 && <SigFigExplanation steps={explanation} title="Worked explanation" />}
    </div>
  )
}

/**
 * Unreadable input, or an answer that is equal but not in the form asked for: said plainly, and never
 * recorded. One line per message.
 */
export function NotAnAttemptNotice({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null
  return (
    <div role="alert" className="rounded-2xl border border-bad bg-bad-100 p-3 text-navy">
      <p className="font-semibold">This doesn’t count as an attempt</p>
      {messages.map((message, i) => (
        <p key={i} className="mt-1 text-sm">
          {message}
        </p>
      ))}
    </div>
  )
}
