import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { BottomSheet } from '@/components/BottomSheet'
import { Katex } from '@/components/Katex'
import { KEYPAD_SETS } from '@/components/keypadKeys'
import { MathTextInput } from '@/components/MathTextInput'
import { COLOR_ORDER, GRAPH_COLORS, type GraphColor } from '@/grapher/colors'
import { plainNumber } from '@/grapher/format'
import type { GraphModel, ModelRow } from '@/grapher/model'
import { planTex } from '@/grapher/preview'
import type { GraphRowState, SliderState } from '@/grapher/state'
import { DEFAULT_SLIDER } from '@/grapher/state'
import { useGraphStore } from './graphStore'

const NEXT = { label: 'Next', name: 'next row' }

/** What a row draws, in words (the options sheet's title and the plane's description use the same words). */
export function rowPlaceholder(n: number): string {
  return n === 1 ? 'y = x^2' : ''
}

/** Rows whose table can be made (a curve, her function, a region's edge). */
export function tableable(r: ModelRow | undefined): boolean {
  return Boolean(r && !r.error && (r.kind === 'curve' || r.kind === 'define' || r.kind === 'region' || r.kind === 'implicit'))
}

function Swatch({ color, hidden, size = 'h-6 w-6' }: { color: GraphColor; hidden: boolean; size?: string }) {
  const hex = GRAPH_COLORS[color].hex
  return (
    <span
      aria-hidden
      className={`block rounded-full border-[3px] ${size}`}
      // The row's own colour: not a theme colour, so it is set here rather than with a class.
      style={{ borderColor: hex, background: hidden ? '#fff' : hex }}
    />
  )
}

interface RowProps {
  row: GraphRowState
  n: number
  total: number
  modelRow: ModelRow | undefined
  /** The model was read from this very text (it lags typing a little). */
  current: boolean
  names: ReadonlyMap<number, string>
  arrived: boolean
  onOptions: () => void
  slider: SliderState | undefined
}

function GraphRow({ row, n, total, modelRow, current, names, arrived, onOptions, slider }: RowProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement | null>(null)
  const focus = useGraphStore((s) => s.focus)
  const store = useGraphStore.getState
  const lastGood = useRef('')

  useEffect(() => {
    if (focus?.id !== row.id) return
    inputRef.current?.focus({ preventScroll: false })
    // Taken: a request left over would grab the box again the next time the page opens.
    useGraphStore.setState({ focus: null })
  }, [focus, row.id])

  // The model writes an error it finds with the sliders' values onto the row (not linear in y...): it is a dependency.
  const modelError = modelRow?.error
  const tex = useMemo(() => (modelRow && current && !modelError ? planTex(modelRow.parse.tex, names) : ''), [modelRow, current, names, modelError])
  if (tex) lastGood.current = tex
  if (!row.text.trim()) lastGood.current = ''
  const error = current && row.text.trim() ? (modelRow?.error ?? null) : null
  const shownTex = tex || (row.text.trim() ? lastGood.current : '')

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Enter (or the keypad's Next) goes to a new row below, as on a graphing calculator's Y= list.
      const id = store().addRow(row.id)
      if (id) store().requestFocus(id)
      return
    }
    if (e.key === 'Backspace' && row.text === '' && total > 1) {
      e.preventDefault()
      const rows = store().rows
      const i = rows.findIndex((r) => r.id === row.id)
      const before = rows[i - 1] ?? rows[i + 1]
      store().deleteRow(row.id)
      if (before) store().requestFocus(before.id)
      return
    }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !e.shiftKey) {
      const rows = store().rows
      const i = rows.findIndex((r) => r.id === row.id)
      const to = rows[i + (e.key === 'ArrowDown' ? 1 : -1)]
      if (to) {
        e.preventDefault()
        store().requestFocus(to.id)
      }
    }
  }

  // A row that gives a letter a plain number (a = 2) gets that letter's slider right under it.
  const constant = modelRow && current && !modelRow.error && modelRow.parse.shape.kind === 'constant' ? modelRow.parse.shape : null
  const constantValue = constant ? Number(row.text.split('=')[1]?.trim()) : Number.NaN
  const constantSlider = constant && Number.isFinite(constantValue) && /^\s*[A-Za-z]\s*=\s*-?\d*\.?\d+\s*$/.test(row.text)
  const range = slider ?? DEFAULT_SLIDER

  return (
    <li data-graph-row={row.id} className={`flex items-start gap-1.5 rounded-xl px-1 py-1.5 ${arrived ? 'bg-gold-100' : ''}`}>
      <button
        type="button"
        aria-pressed={!row.hidden}
        aria-label={`Row ${n} on the graph (${GRAPH_COLORS[row.color].name})`}
        onClick={() => store().toggleHidden(row.id)}
        className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-[11px] font-semibold leading-none text-navy/70 hover:bg-navy-50"
      >
        <Swatch color={row.color} hidden={row.hidden} />
        <span className="mt-0.5">{n}</span>
      </button>
      <div className="min-w-0 flex-1">
        {shownTex && (
          <div aria-hidden className={`mb-1 overflow-x-auto text-navy ${tex ? '' : 'opacity-50'}`} data-row-preview="">
            <Katex tex={shownTex} />
          </div>
        )}
        <label htmlFor={inputId} className="sr-only">
          Row {n}
        </label>
        <MathTextInput
          ref={inputRef}
          id={inputId}
          type="text"
          value={row.text}
          onChange={(e) => store().setText(row.id, e.target.value)}
          onKeyDown={onKeyDown}
          keypad={{ keys: KEYPAD_SETS.graph, enter: NEXT }}
          placeholder={rowPlaceholder(n)}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className={`min-h-11 w-full min-w-0 rounded-lg border-2 bg-white px-2.5 py-1.5 font-mono text-[max(16px,1rem)] text-ink outline-none focus:border-navy ${row.hidden ? 'border-dashed border-navy-100 text-navy/60' : 'border-navy-100'}`}
        />
        {error && (
          <p id={errorId} className="mt-1 text-sm text-navy/80" data-row-error="">
            <span aria-hidden className="text-bad">
              ⚠{' '}
            </span>
            {error.position !== undefined ? `Check character ${Math.min(error.position, row.text.length - 1) + 1}: ` : ''}
            {error.message}
          </p>
        )}
        {constantSlider && constant && (
          <input
            type="range"
            aria-label={`${constant.display}, from ${plainNumber(range.min)} to ${plainNumber(range.max)}`}
            min={Math.min(range.min, constantValue)}
            max={Math.max(range.max, constantValue)}
            step={range.step}
            value={constantValue}
            onChange={(e) => store().setText(row.id, `${constant.display} = ${plainNumber(Number(e.target.value))}`)}
            className="mt-1 h-11 w-full accent-[var(--color-navy)]"
          />
        )}
      </div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={`Row ${n} options`}
        onClick={onOptions}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl font-bold text-navy/70 hover:bg-navy-50"
      >
        <span aria-hidden>⋯</span>
      </button>
    </li>
  )
}

function RowOptions({ row, n, total, canTable, onClose }: { row: GraphRowState; n: number; total: number; canTable: boolean; onClose: () => void }) {
  const store = useGraphStore.getState
  const act = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const button = 'min-h-11 w-full rounded-xl border border-navy-100 bg-white px-3 text-left font-semibold text-navy hover:bg-navy-50 disabled:opacity-40'
  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy">Colour</legend>
        <div className="flex flex-wrap gap-2">
          {COLOR_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={row.color === c}
              aria-label={GRAPH_COLORS[c].name}
              onClick={() => store().setColor(row.id, c)}
              className={`flex h-11 w-11 items-center justify-center rounded-full ${row.color === c ? 'ring-2 ring-navy ring-offset-2' : ''}`}
            >
              <Swatch color={c} hidden={false} size="h-8 w-8" />
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <button type="button" className={button} onClick={act(() => store().toggleHidden(row.id))}>
          {row.hidden ? 'Show on the graph' : 'Hide from the graph'}
        </button>
        <button type="button" className={button} disabled={n === 1} onClick={act(() => store().moveRow(row.id, -1))}>
          Move up
        </button>
        <button type="button" className={button} disabled={n === total} onClick={act(() => store().moveRow(row.id, 1))}>
          Move down
        </button>
        {canTable && (
          <button
            type="button"
            className={button}
            onClick={act(() => {
              store().setTable({ rowId: row.id })
              document.getElementById('graph-table')?.setAttribute('open', '')
              document.getElementById('graph-table')?.scrollIntoView?.({ block: 'nearest' })
            })}
          >
            Show its table
          </button>
        )}
        <button type="button" className={`${button} text-bad`} onClick={act(() => store().deleteRow(row.id))}>
          Delete row {n}
        </button>
      </div>
    </div>
  )
}

/** The expression list: one row per entry, its swatch (show or hide), its box on the math keypad, its options. */
export function RowList({ model, current, names }: { model: GraphModel; current: ReadonlyMap<string, boolean>; names: ReadonlyMap<number, string> }) {
  const rows = useGraphStore((s) => s.rows)
  const arrived = useGraphStore((s) => s.arrived)
  const sliders = useGraphStore((s) => s.sliders)
  const [options, setOptions] = useState<string | null>(null)
  const byId = useMemo(() => new Map(model.rows.map((r) => [r.id, r])), [model])
  const listRef = useRef<HTMLOListElement>(null)

  // Rows that came from a problem come into view.
  useEffect(() => {
    if (arrived.length === 0) return
    const el = listRef.current?.querySelector(`[data-graph-row="${arrived[0]}"]`)
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') (el as HTMLElement).scrollIntoView({ block: 'nearest' })
  }, [arrived])

  const open = rows.find((r) => r.id === options) ?? null
  const openIndex = open ? rows.indexOf(open) : -1
  return (
    <>
      <ol ref={listRef} aria-label="Rows" className="space-y-0.5">
        {rows.map((row, i) => {
          const modelRow = byId.get(row.id)
          const shape = modelRow?.parse.shape
          const letter = shape?.kind === 'constant' ? shape.name : null
          return (
            <GraphRow
              key={row.id}
              row={row}
              n={i + 1}
              total={rows.length}
              modelRow={modelRow}
              current={current.get(row.id) === true}
              names={names}
              arrived={arrived.includes(row.id)}
              onOptions={() => setOptions(row.id)}
              slider={letter ? sliders[letter] : undefined}
            />
          )
        })}
      </ol>
      <BottomSheet open={open !== null} onClose={() => setOptions(null)} title={open ? `Row ${openIndex + 1}` : ''}>
        {open && <RowOptions row={open} n={openIndex + 1} total={rows.length} canTable={tableable(byId.get(open.id))} onClose={() => setOptions(null)} />}
      </BottomSheet>
    </>
  )
}
