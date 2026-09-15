import { toLatex } from '@/notation'
import type { RuleCard } from '@/content/types'
import type { HintView } from '@/problem/stepEngine'
import { Katex } from './Katex'

type Props = {
  rung: 0 | 1 | 2 | 3
  view: HintView
  onAdvance: () => void
  onUseLine: () => void
  /** Pulse the button after two consecutive rejections (never opens on its own). */
  highlight?: boolean
  disabled?: boolean
}

const LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Nudge me',
  1: 'Show the rule',
  2: 'Show the step',
  3: 'All hints shown',
}

export function RuleCardView({ card }: { card: RuleCard | { id: string; title: string; body: string; example?: string } }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3">
      <p className="font-semibold text-navy">{card.title}</p>
      <p className="mt-1 text-sm text-navy/90">{card.body}</p>
      {card.example && <p className="mt-1 font-mono text-xs text-navy/70">{card.example}</p>}
    </div>
  )
}

/**
 * Hint ladder (BUILD_GUIDE §7): rung 1 nudge, rung 2 rule card (or the last pattern's lesson),
 * rung 3 reveal the next canonical line with "Use this line" (marks the step revealed).
 */
export function HintPanel({ rung, view, onAdvance, onUseLine, highlight = false, disabled = false }: Props) {
  const exhausted = rung === 3 || (rung === 2 && !view.reveal)
  return (
    <div className="space-y-3">
      <p className="text-sm text-navy/70">Hints never appear on their own. Ctrl+Shift+H steps through them.</p>
      <button
        type="button"
        onClick={onAdvance}
        disabled={disabled || exhausted}
        className={`min-h-11 w-full rounded-xl px-3 font-semibold text-navy disabled:opacity-50 ${highlight ? 'bg-gold ring-2 ring-coral' : 'bg-gold hover:bg-gold/80'}`}
        aria-describedby={highlight ? 'hint-highlight' : undefined}
      >
        {exhausted ? LABEL[3] : LABEL[rung]}
        {rung === 2 && !exhausted && <span className="ml-1 text-xs font-normal text-gold-text">(marks the step as shown)</span>}
      </button>
      {highlight && (
        <p id="hint-highlight" className="text-xs text-coral-700">
          Two tries in a row did not land — a nudge is right here.
        </p>
      )}
      {view.offPath && (
        <p className="rounded-xl border border-navy-100 bg-white p-3 text-sm text-navy" role="status">
          <span aria-hidden>↪ </span>
          <span className="font-semibold">Off the usual route. </span>
          Your line is legal, so there is no single “next line” to show — Show the step is not available from here. Undo back to a
          line on the path, or keep going your way.
        </p>
      )}
      {rung >= 1 && (
        <div className="rounded-xl bg-navy-50 p-3 text-sm text-navy">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Nudge</p>
          <p className="mt-1">{view.nudge}</p>
        </div>
      )}
      {rung >= 2 && view.card && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-navy/60">Rule</p>
          <RuleCardView card={view.card} />
        </div>
      )}
      {rung >= 3 && view.reveal && (
        <div className="rounded-xl border border-navy-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Next line</p>
          <div className="mt-1 overflow-x-auto text-navy">
            <Katex tex={toLatex(view.reveal)} />
          </div>
          <button
            type="button"
            onClick={onUseLine}
            disabled={disabled}
            className="mt-2 min-h-10 rounded-lg bg-navy px-3 text-sm font-semibold text-white hover:bg-navy-600 disabled:opacity-50"
          >
            Use this line
          </button>
        </div>
      )}
    </div>
  )
}
