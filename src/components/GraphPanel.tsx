import type { RuleCard } from '@/content/types'
import type { GraphSpec } from '@/shared/types'
import { Graph } from './Graph'
import { NumberLineSet } from './NumberLineSet'
import { RuleCardView } from './HintPanel'

/** Graph panel: function plot or number line, from `instance.graph`. */
export function GraphPanel({ spec, caption }: { spec: GraphSpec; caption?: string }) {
  if (spec.kind === 'function' && spec.f) return <Graph spec={spec} />
  if (spec.kind === 'numberLine' && spec.set) {
    return (
      <div>
        <NumberLineSet set={spec.set} domain={spec.xDomain} caption={caption} />
        {spec.badge && <p className="mt-2 text-sm font-semibold text-coral-700">{spec.badge}</p>}
      </div>
    )
  }
  return <p className="text-sm text-navy/60">Nothing to graph for this problem.</p>
}

/** Rule cards of the module, all open (they are short). */
export function RuleCardsPanel({ cards }: { cards: RuleCard[] }) {
  if (cards.length === 0) return <p className="text-sm text-navy/60">No rule cards for this module.</p>
  return (
    <div className="space-y-2">
      {cards.map((c) => (
        <RuleCardView key={c.id} card={c} />
      ))}
    </div>
  )
}
