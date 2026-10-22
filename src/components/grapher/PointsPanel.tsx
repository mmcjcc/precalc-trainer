import { formatPoint } from '@/grapher/format'
import { kindWords, type Poi } from '@/grapher/poi'
import type { Selection } from './graphStore'

/** "Row 1: maximum", "Rows 1 and 2: intersection". */
export function poiTitle(p: Poi, rowNumber: (index: number) => number): string {
  const rows = p.rows.map(rowNumber)
  const who = rows.length === 1 ? `Row ${rows[0]}` : `Rows ${rows.slice(0, -1).join(', ')} and ${rows[rows.length - 1]}`
  return `${who}: ${kindWords(p)}`
}

export function samePoi(s: Selection | null, p: Poi): boolean {
  return s?.kind === 'poi' && s.x === p.x && s.y === p.y && s.rows.join() === p.rows.join()
}

/**
 * The points of interest as text, under the plane: each a button that picks it on the plane (its label shows there,
 * and the status line says it), reachable by keyboard. Folded under its count until she opens it.
 */
export function PointsPanel({ pois, rowNumber, selection, onPick }: { pois: readonly Poi[]; rowNumber: (index: number) => number; selection: Selection | null; onPick: (p: Poi) => void }) {
  return (
    <details className="rounded-xl border border-navy-100 bg-white px-3 py-1" data-graph-points="">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-navy">
        Points of interest ({pois.length})
      </summary>
      {pois.length === 0 ? (
        <p className="pb-2 text-sm text-navy/70">None in this window: zeros, highs and lows, y-intercepts and crossings show here.</p>
      ) : (
        <ul className="space-y-1 pb-2">
          {pois.map((p) => (
            <li key={`${p.rows.join()}:${p.x}:${p.y}:${p.kinds.join()}`}>
              <button
                type="button"
                aria-pressed={samePoi(selection, p)}
                onClick={() => onPick(p)}
                className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 rounded-lg px-2 text-left text-sm text-navy hover:bg-navy-50 ${samePoi(selection, p) ? 'bg-gold-100' : ''}`}
              >
                <span>{poiTitle(p, rowNumber)}</span>
                <span className="font-mono">{formatPoint(p.x, p.y)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  )
}
