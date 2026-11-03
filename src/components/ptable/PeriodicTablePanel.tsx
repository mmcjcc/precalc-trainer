import { memo, useId, useMemo, useState } from 'react'
import { classOf, type ClassName } from '@/content/modules/periodic/facts'
import { ELEMENTS, type ElementInfo } from '@/engine/chem/elements'
import { TRANSURANICS } from './transuranics'

export const ALL_ELEMENTS: readonly ElementInfo[] = [...ELEMENTS, ...TRANSURANICS]

const CLASS_TINT: Record<ClassName, string> = {
  metal: 'border-navy-100 bg-navy-50 hover:bg-navy-100',
  metalloid: 'border-gold bg-gold-100 hover:bg-gold/50',
  nonmetal: 'border-ok/30 bg-ok-100 hover:bg-ok-100/80',
}

const LEGEND_ITEMS: readonly { kind: ClassName; label: string; swatch: string }[] = [
  { kind: 'metal', label: 'Metal', swatch: 'border-navy-100 bg-navy-50' },
  { kind: 'metalloid', label: 'Metalloid', swatch: 'border-gold bg-gold-100' },
  { kind: 'nonmetal', label: 'Nonmetal', swatch: 'border-ok/30 bg-ok-100' },
]

export function elementClass(el: ElementInfo): ClassName {
  return el.z > 92 ? 'metal' : classOf(el)
}

export function gridPosition(el: ElementInfo): { gridColumn: number; gridRow: number } {
  if (el.group !== null) {
    return { gridColumn: el.group, gridRow: el.period }
  }
  if (el.period === 6) {
    return { gridColumn: el.z - 57 + 3, gridRow: 9 }
  }
  return { gridColumn: el.z - 89 + 3, gridRow: 10 }
}

function capitalize(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toUpperCase() + name.slice(1)
}

export function formatAtomicMass(el: ElementInfo): string {
  return el.radioactive && !el.atomicWeight.includes('.') ? `[${el.atomicWeight}]` : el.atomicWeight
}

export function formatGroup(el: ElementInfo): string {
  if (el.group !== null) return String(el.group)
  return el.period === 6 ? 'lanthanide' : 'actinide'
}

export function formatCharges(charges: readonly number[]): string {
  return charges.map((n) => (n > 0 ? `${n}+` : `${Math.abs(n)}−`)).join(' or ')
}

function findMatchingElements(rawQuery: string): ElementInfo[] {
  const q = rawQuery.trim().toLowerCase()
  if (!q) return []
  const exactSymbol = ALL_ELEMENTS.filter((el) => el.symbol.toLowerCase() === q)
  if (exactSymbol.length > 0) return exactSymbol
  return ALL_ELEMENTS.filter((el) => el.name.toLowerCase().includes(q))
}

// memo: the panel takes no props, so problem-flow state changes (every keypress
// and check in a chem problem) must not re-reconcile its 118 cells.
export const PeriodicTablePanel = memo(function PeriodicTablePanel() {
  const searchId = useId()
  const [query, setQuery] = useState('')
  const [selectedZ, setSelectedZ] = useState<number | null>(null)

  const matches = useMemo(() => findMatchingElements(query), [query])
  const highlightedZs = useMemo(() => new Set(matches.map((el) => el.z)), [matches])

  const selected = useMemo(
    () => (selectedZ !== null ? (ALL_ELEMENTS.find((el) => el.z === selectedZ) ?? null) : null),
    [selectedZ],
  )

  const handleSearchChange = (next: string) => {
    setQuery(next)
    const nextMatches = findMatchingElements(next)
    setSelectedZ(nextMatches.length === 1 ? nextMatches[0]!.z : null)
  }

  return (
    <div data-ptable="" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-44 flex-1">
          <label htmlFor={searchId} className="block text-xs font-semibold text-navy/80">
            Find an element
          </label>
          <input
            id={searchId}
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Symbol or name (e.g. Fe, iron)"
            className="mt-1 min-h-9 w-full rounded-xl border border-navy-100 bg-white px-3 py-1 text-sm text-navy outline-none focus:border-navy"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-navy/80" aria-label="Element classes">
          {LEGEND_ITEMS.map((item) => (
            <span key={item.kind} className="inline-flex items-center gap-1">
              <span aria-hidden className={`inline-block h-3 w-3 rounded-sm border ${item.swatch}`} />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      {selected && (
        <div
          data-ptable-detail=""
          className="rounded-xl border border-navy-100 bg-navy-50/60 p-3 text-sm text-navy"
        >
          <div className="flex items-baseline justify-between gap-2 border-b border-navy-100 pb-1.5">
            <p className="font-semibold text-navy">
              {capitalize(selected.name)} <span className="font-mono">({selected.symbol})</span>
            </p>
            <span className="font-mono text-xs text-navy/70">Atomic number {selected.z}</span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-navy/60">Atomic mass</dt>
              <dd className="font-mono font-semibold text-navy">{formatAtomicMass(selected)}</dd>
            </div>
            <div>
              <dt className="text-navy/60">Period</dt>
              <dd className="font-semibold text-navy">{selected.period}</dd>
            </div>
            <div>
              <dt className="text-navy/60">Group</dt>
              <dd className="font-semibold text-navy">{formatGroup(selected)}</dd>
            </div>
            <div>
              <dt className="text-navy/60">Class</dt>
              <dd className="font-semibold text-navy">{elementClass(selected)}</dd>
            </div>
            {selected.commonCharges.length > 0 && (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-navy/60">Common ion charge(s)</dt>
                <dd className="font-mono font-semibold text-navy">{formatCharges(selected.commonCharges)}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[612px] grid-cols-[repeat(18,minmax(32px,1fr))] grid-rows-[repeat(7,minmax(34px,auto))_10px_repeat(2,minmax(34px,auto))] gap-1">
          {ALL_ELEMENTS.map((el) => {
            const { gridColumn, gridRow } = gridPosition(el)
            const cls = elementClass(el)
            const isHighlighted = highlightedZs.has(el.z)
            const isSelected = selected?.z === el.z
            const ringClass = isHighlighted
              ? 'ring-2 ring-coral'
              : isSelected
                ? 'ring-2 ring-navy'
                : ''
            return (
              <button
                key={el.z}
                type="button"
                data-ptable-cell={el.symbol}
                data-highlighted={isHighlighted ? 'true' : undefined}
                aria-label={`${el.name}, ${el.symbol}, ${el.z}`}
                aria-pressed={isSelected}
                style={{ gridColumn, gridRow }}
                onClick={() => setSelectedZ(el.z)}
                className={`flex min-h-[34px] min-w-[32px] flex-col items-center justify-center rounded border px-0.5 py-0.5 text-navy transition-colors ${CLASS_TINT[cls]} ${ringClass}`}
              >
                <span className="block font-mono text-[9px] leading-none text-navy/70" aria-hidden>
                  {el.z}
                </span>
                <span className="block text-xs font-semibold leading-tight text-navy" aria-hidden>
                  {el.symbol}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})
