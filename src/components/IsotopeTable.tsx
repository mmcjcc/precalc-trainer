import type { AtomIsotope, AtomIsotopeRow } from '@/shared/types'
import type { AtomPeriodicEntry } from '@/content/types'

type Row = AtomIsotope & { abundance?: string }

/**
 * Isotope table for the average-atomic-mass and abundance problems: isotope, isotopic mass (u) and,
 * when known, percent abundance. Numbers are right-aligned in a monospace face so the decimal
 * points line up; the table fits a 375 px phone (short column heads, no fixed widths) and scrolls
 * sideways inside its own box rather than pushing the page wider if a label is ever long.
 */
export function IsotopeTable({ rows, caption, unknownLabel }: { rows: readonly (Row | AtomIsotopeRow)[]; caption: string; unknownLabel?: string }) {
  const hasAbundance = rows.some((r) => r.abundance !== undefined) || unknownLabel !== undefined
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-0 border-collapse text-left text-navy">
        <caption className="mb-1 text-left text-sm text-navy/80">{caption}</caption>
        <thead>
          <tr className="border-b border-navy-100 text-xs uppercase tracking-wide text-navy/70">
            <th scope="col" className="py-1.5 pr-2 font-semibold">
              Isotope
            </th>
            <th scope="col" className="py-1.5 pr-2 text-right font-semibold">
              Mass (u)
            </th>
            {hasAbundance && (
              <th scope="col" className="py-1.5 text-right font-semibold">
                Abundance
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-navy-100/60 last:border-b-0">
              <th scope="row" className="py-2 pr-2 font-semibold whitespace-nowrap">
                {r.label}
              </th>
              <td className="py-2 pr-2 text-right font-mono tabular-nums">{r.mass}</td>
              {hasAbundance && (
                <td className="py-2 text-right font-mono tabular-nums">{r.abundance !== undefined ? `${r.abundance}%` : (unknownLabel ?? '?')}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Periodic-table tiles (atomic number, symbol, name), the way the squares look on a real table. */
export function PeriodicTiles({ entries }: { entries: readonly AtomPeriodicEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">From the periodic table</p>
      <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Periodic table">
        {entries.map((e) => (
          <li key={e.z} className="min-w-16 rounded-lg border border-navy-100 bg-white px-2 py-1 text-navy" aria-label={`${e.name}, symbol ${e.symbol}, atomic number ${e.z}`}>
            <span className="block text-xs font-mono" aria-hidden>
              {e.z}
            </span>
            <span className="block text-lg font-semibold leading-tight" aria-hidden>
              {e.symbol}
            </span>
            <span className="block text-[11px] leading-tight text-navy/70" aria-hidden>
              {e.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
