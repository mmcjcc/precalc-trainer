import { useId, useMemo } from 'react'
import { formatNumber } from '@/grapher/format'
import type { GraphModel } from '@/grapher/model'
import { tableRows } from '@/grapher/table'
import type { GraphRowState } from '@/grapher/state'
import { useGraphStore } from './graphStore'
import { NumberBox } from './NumberBox'
import { tableable } from './RowList'

/**
 * The TI-84's TABLE for one row: x from Start in steps of Step (TblStart, ΔTbl), the row's y beside each, "undefined"
 * where it has none. Folded under its heading until she opens it.
 */
export function TablePanel({ model, rows, stamp }: { model: GraphModel; rows: readonly GraphRowState[]; stamp: string }) {
  const table = useGraphStore((s) => s.table)
  const setTable = useGraphStore((s) => s.setTable)
  const selectId = useId()
  const byId = useMemo(() => new Map(model.rows.map((r) => [r.id, r])), [model])
  const choices = rows.map((r, i) => ({ row: r, n: i + 1 })).filter(({ row }) => tableable(byId.get(row.id)))
  const chosen = choices.find((c) => c.row.id === table.rowId) ?? choices[0]
  const values = useMemo(() => {
    if (!chosen) return []
    const fn = model.curve(byId.get(chosen.row.id)!.index)
    return fn ? tableRows(fn, table.start, table.step) : []
    // `stamp` changes with the sliders and the angle mode, which the model reads live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.row.id, model, table.start, table.step, stamp, byId])

  return (
    <details id="graph-table" className="rounded-xl border border-navy-100 bg-white px-3 py-1" data-graph-table="">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-navy">Table</summary>
      {choices.length === 0 ? (
        <p className="pb-2 text-sm text-navy/70">Type a row like y = x^2 to see its table.</p>
      ) : (
        <div className="space-y-2 pb-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-navy">
            <label htmlFor={selectId} className="font-semibold">
              Row
            </label>
            <select
              id={selectId}
              value={chosen?.row.id}
              onChange={(e) => setTable({ rowId: e.target.value })}
              className="min-h-11 max-w-[14rem] rounded-lg border-2 border-navy-100 bg-white px-2 font-mono text-navy"
            >
              {choices.map((c) => (
                <option key={c.row.id} value={c.row.id}>
                  {`${c.n}: ${c.row.text}`}
                </option>
              ))}
            </select>
            <span className="flex items-center gap-1.5">
              Start
              <NumberBox label="Table start" value={table.start} onCommit={(start) => setTable({ start })} className="w-20" />
            </span>
            <span className="flex items-center gap-1.5">
              Step
              <NumberBox label="Table step" value={table.step} onCommit={(step) => (step !== 0 ? setTable({ step }) : undefined)} className="w-20" />
            </span>
          </div>
          <table className="w-full max-w-sm border-collapse font-mono text-sm text-navy">
            <caption className="sr-only">{chosen ? `Values of row ${chosen.n}` : 'Values'}</caption>
            <thead>
              <tr className="border-b border-navy-100 text-left">
                <th scope="col" className="py-1 pr-4 font-semibold italic">
                  x
                </th>
                <th scope="col" className="py-1 font-semibold italic">
                  y
                </th>
              </tr>
            </thead>
            <tbody>
              {values.map((v) => (
                <tr key={v.x} className="border-b border-navy-50">
                  <td className="py-1 pr-4">{formatNumber(v.x)}</td>
                  <td className={`py-1 ${Number.isNaN(v.y) ? 'text-navy/60' : ''}`}>{formatNumber(v.y)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  )
}
