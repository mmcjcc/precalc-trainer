import { useCallback, useDeferredValue, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BottomSheet } from '@/components/BottomSheet'
import type { Hit } from '@/components/grapher/draw'
import type { GraphFromState } from '@/components/grapher/GraphItButton'
import { useGraphStore } from '@/components/grapher/graphStore'
import { Plane } from '@/components/grapher/Plane'
import { PointsPanel, poiTitle } from '@/components/grapher/PointsPanel'
import { RowList } from '@/components/grapher/RowList'
import { SliderList } from '@/components/grapher/SliderList'
import { TablePanel } from '@/components/grapher/TablePanel'
import { useMotionAllowed } from '@/components/juice/motion'
import { useKeypadStore } from '@/components/keypadStore'
import { useBreakpoint } from '@/components/useBreakpoint'
import { useMathKeypadOn } from '@/components/useMathKeypad'
import { GRAPH_COLORS } from '@/grapher/colors'
import { zoomToFit } from '@/grapher/fit'
import { formatNumber, formatPoint, speakable } from '@/grapher/format'
import { buildModel, visibleCurves, type DrawItem, type GraphModel } from '@/grapher/model'
import { pointsOfInterest, type Poi } from '@/grapher/poi'
import { DEFAULT_SLIDER, type GraphRowState } from '@/grapher/state'
import { STANDARD_WINDOW, type ViewWindow } from '@/grapher/view'

/**
 * The page fills the screen between its top and whatever covers the bottom (the tab bar, or the keypad while it is
 * up), so the plane and the rows share the screen instead of scrolling past each other. Returns its height and the
 * margin that cancels the page's own bottom padding.
 */
function useFillHeight(ref: RefObject<HTMLElement | null>): { height: number; pad: number } {
  const [size, setSize] = useState({ height: 600, pad: 0 })
  const keypadH = useKeypadStore((s) => (s.target ? s.height : 0))
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const view = window.visualViewport?.height ?? window.innerHeight
      const bar = document.querySelector('[data-tab-bar]')?.getBoundingClientRect().height ?? 0
      const main = el.closest('main')
      const pad = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0
      const height = Math.max(300, Math.floor(view - top - Math.max(keypadH, bar) - 8))
      setSize((s) => (s.height === height && s.pad === pad ? s : { height, pad }))
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [ref, keypadH])
  return size
}

function describeItem(item: DrawItem | null, text: string): string {
  if (!item) return ''
  switch (item.kind) {
    case 'curve':
      return `the curve ${text}`
    case 'region':
      return `shading ${item.below ? 'below' : 'above'} its edge, ${text}, the edge ${item.strict ? 'dashed (not included)' : 'solid (included)'}`
    case 'vline':
      return `the vertical line x = ${formatNumber(item.x)}`
    case 'xregion':
      return `shading ${item.left ? 'left' : 'right'} of x = ${formatNumber(item.x)}`
    case 'points':
      return item.points.length === 1 ? `the point ${formatPoint(item.points[0]!.x, item.points[0]!.y)}` : `the points ${item.points.map((p) => formatPoint(p.x, p.y)).join(', ')}`
  }
}

/** The plane in words: its window and each row. */
function describePlane(rows: readonly GraphRowState[], model: GraphModel, drawn: readonly (DrawItem | null)[], w: ViewWindow, mode: 'rad' | 'deg'): string {
  const parts = [`x from ${formatNumber(w.xMin)} to ${formatNumber(w.xMax)}, y from ${formatNumber(w.yMin)} to ${formatNumber(w.yMax)}. Angles in ${mode === 'deg' ? 'degrees' : 'radians'}.`]
  const byId = new Map(model.rows.map((r) => [r.id, r]))
  rows.forEach((row, i) => {
    if (!row.text.trim()) return
    const m = byId.get(row.id)
    const color = GRAPH_COLORS[row.color].name
    if (row.hidden) parts.push(`Row ${i + 1} is hidden.`)
    else if (m?.error) parts.push(`Row ${i + 1} cannot be graphed yet.`)
    else if (m?.kind === 'constant') parts.push(`Row ${i + 1} gives ${speakable(row.text.trim())}.`)
    else if (m) {
      const what = describeItem(drawn[m.index] ?? null, speakable(row.text.trim()))
      if (what) parts.push(`Row ${i + 1}, ${color}: ${what}.`)
    }
  })
  return parts.join(' ')
}

function ModeSwitch() {
  const mode = useGraphStore((s) => s.mode)
  const setMode = useGraphStore((s) => s.setMode)
  const button = (value: 'rad' | 'deg', label: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => setMode(value)}
      className={`min-h-11 rounded-lg px-2.5 text-xs font-bold tracking-wide ${mode === value ? 'bg-navy text-white' : 'bg-navy-50 text-navy hover:bg-navy-100'}`}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label="Angle mode" className="flex gap-1">
      {button('rad', 'RADIAN')}
      {button('deg', 'DEGREE')}
    </div>
  )
}

/**
 * The grapher (/graph, the Graph tab): an expression list typed on the math keypad, and the plane. On a phone the plane
 * is on top (about 55% of the screen) with the rows under it; on a wide screen the rows are on the left and the plane
 * on the right. Rows, sliders, the window and the angle mode stay on the device (pct.graph). From a problem's "Graph
 * it" it opens with that function and the problem's window, and "Back to the problem" returns to her work.
 */
export function GrapherPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as GraphFromState | null)?.graphFrom
  const rows = useGraphStore((s) => s.rows)
  const sliders = useGraphStore((s) => s.sliders)
  const committed = useGraphStore((s) => s.window)
  const mode = useGraphStore((s) => s.mode)
  const selection = useGraphStore((s) => s.selection)
  const arrived = useGraphStore((s) => s.arrived)
  const fitPending = useGraphStore((s) => s.fitPending)
  const { setWindow, select, addRow, requestFocus, clearAll, takeFit } = useGraphStore.getState()
  const phone = useBreakpoint() === 'mobile'
  const keypadOn = useMathKeypadOn()
  const keypadOpen = useKeypadStore((s) => s.target !== null && s.height > 0)
  const animate = useMotionAllowed()
  const descId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLElement>(null)
  const { height, pad } = useFillHeight(rootRef)
  const [confirmClear, setConfirmClear] = useState(false)

  // The model lags typing a moment (a deferred value), so typing stays quick with many rows.
  const deferredRows = useDeferredValue(rows)
  const model = useMemo(() => buildModel(deferredRows.map((r) => ({ id: r.id, text: r.text, hidden: r.hidden }))), [deferredRows])
  const stamp = useMemo(() => {
    const values = Object.fromEntries(model.sliders.map((l) => [l, sliders[l]?.value ?? DEFAULT_SLIDER.value]))
    model.setParams(values)
    model.setMode(mode)
    return `${mode}|${model.sliders.map((l) => `${l}=${values[l]}`).join(',')}`
  }, [model, sliders, mode])
  // Drawing each row once here also finds the errors only the sliders' values reveal (not linear in y...).
  const drawn = useMemo(() => {
    void stamp
    return model.rows.map((r) => model.draw(r.index))
  }, [model, stamp])
  const current = useMemo(() => {
    const was = new Map(deferredRows.map((r) => [r.id, r.text]))
    return new Map(rows.map((r) => [r.id, was.get(r.id) === r.text]))
  }, [rows, deferredRows])
  const names = useMemo(() => new Map([...model.functions.values()].map((f) => [f.index, f.display])), [model])
  const colorById = useMemo(() => new Map(rows.map((r) => [r.id, r.color])), [rows])
  const looks = useMemo(() => model.rows.map((r) => ({ id: r.id, color: GRAPH_COLORS[colorById.get(r.id) ?? 'navy'].hex })), [model, colorById])
  const rowNumber = useCallback((index: number) => {
    const id = model.rows[index]?.id
    return rows.findIndex((r) => r.id === id) + 1
  }, [model, rows])

  // ---- points of interest, a moment after the graph settles ----
  const [pois, setPois] = useState<Poi[]>([])
  const vlines = useMemo(() => model.rows.flatMap((r) => {
    const d = drawn[r.index]
    return d && d.kind === 'vline' ? [{ index: r.index, x: d.x }] : []
  }), [model, drawn])
  useEffect(() => {
    const t = setTimeout(() => {
      const curves = visibleCurves(model).map((c) => ({ index: c.index, fn: c.fn }))
      setPois(pointsOfInterest({ curves, vlines, xMin: committed.xMin, xMax: committed.xMax }))
    }, 90)
    return () => clearTimeout(t)
  }, [model, stamp, vlines, committed])

  // ---- Zoom to fit, and a fit waiting for the rows "Graph it" just brought ----
  const fit = useCallback(() => {
    const curves = visibleCurves(model).map((c) => ({ index: c.index, fn: c.fn }))
    const points = drawn.flatMap((d) => (d && d.kind === 'points' ? d.points : []))
    setWindow(zoomToFit({ curves, vlines, points }))
  }, [model, drawn, vlines, setWindow])
  useEffect(() => {
    if (fitPending && deferredRows === rows && takeFit()) fit()
  }, [fitPending, deferredRows, rows, fit, takeFit])

  // ---- the point she picked ----
  const picked = useMemo(() => {
    void stamp
    if (!selection) return null
    const colorOfIndex = (i: number) => looks[i]?.color ?? GRAPH_COLORS.navy.hex
    if (selection.kind === 'poi') {
      const title = poiTitle({ x: selection.x, y: selection.y, kinds: selection.kinds, rows: selection.rows }, rowNumber)
      return { marker: { x: selection.x, y: selection.y, color: colorOfIndex(selection.rows[0]!), text: formatPoint(selection.x, selection.y) }, say: `${title} ${formatPoint(selection.x, selection.y)}` }
    }
    const index = model.rows.findIndex((r) => r.id === selection.rowId)
    if (index < 0) return null
    const n = rowNumber(index)
    if (selection.kind === 'point') {
      return { marker: { x: selection.x, y: selection.y, color: colorOfIndex(index), text: formatPoint(selection.x, selection.y) }, say: `Row ${n}: the point ${formatPoint(selection.x, selection.y)}` }
    }
    const fn = model.curve(index)
    const y = fn && (!fn.allow || fn.allow(selection.x)) ? fn.f(selection.x) : Number.NaN
    if (!Number.isFinite(y)) return { marker: null, say: `Row ${n} has no value at x = ${formatNumber(selection.x)}.` }
    return { marker: { x: selection.x, y, color: colorOfIndex(index), text: formatPoint(selection.x, y) }, say: `Row ${n}: ${formatPoint(selection.x, y)}` }
  }, [selection, model, stamp, looks, rowNumber])

  // A picked point of interest belongs to the graph it was found on: when the rows or a slider change, it goes.
  const lastGraph = useRef<{ model: GraphModel; stamp: string } | null>(null)
  useEffect(() => {
    const before = lastGraph.current
    lastGraph.current = { model, stamp }
    if (before && (before.model !== model || before.stamp !== stamp) && useGraphStore.getState().selection?.kind === 'poi') select(null)
  }, [model, stamp, select])

  const onTap = useCallback(
    (hit: Hit | null) => {
      if (!hit) select(null)
      else if (hit.kind === 'poi') select({ kind: 'poi', x: hit.poi.x, y: hit.poi.y, kinds: hit.poi.kinds, rows: hit.poi.rows })
      else if (hit.kind === 'point') select({ kind: 'point', rowId: hit.rowId, x: hit.x, y: hit.y })
      else select({ kind: 'trace', rowId: hit.rowId, x: hit.x })
    },
    [select],
  )

  const description = useMemo(() => describePlane(rows, model, drawn, committed, mode), [rows, model, drawn, committed, mode])
  const arrivedWords = useMemo(() => {
    if (arrived.length === 0) return ''
    const ns = arrived.map((id) => rows.findIndex((r) => r.id === id) + 1).filter((n) => n > 0)
    return ns.length === 1 ? `From your problem: row ${ns[0]}.` : `From your problem: rows ${ns.join(' and ')}.`
  }, [arrived, rows])

  // With the keypad up the list is shorter: keep the box she is typing in in view.
  useEffect(() => {
    if (!keypadOpen) return
    const active = document.activeElement
    if (active instanceof HTMLElement && listRef.current?.contains(active) && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest' })
  }, [keypadOpen, height])

  const back = () => {
    if (location.key !== 'default') navigate(-1)
    else if (from) navigate(from)
  }

  const planeHeight = phone ? Math.round(height * (keypadOpen ? 0.45 : 0.55)) : undefined
  const points = <PointsPanel pois={pois} rowNumber={rowNumber} selection={selection} onPick={(p) => select({ kind: 'poi', x: p.x, y: p.y, kinds: p.kinds, rows: p.rows })} />

  return (
    <div ref={rootRef} data-grapher="" className="flex flex-col gap-2" style={{ height, marginBottom: -pad + 8 }}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {from && (
          <button type="button" onClick={back} className="flex min-h-11 items-center gap-1 rounded-lg px-1 font-semibold text-navy underline hover:bg-navy-50">
            <span aria-hidden>←</span> Back to the problem
          </button>
        )}
        <h1 className="text-xl font-semibold text-navy">Graph</h1>
        <div className="ml-auto">
          <ModeSwitch />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2 md:flex-row md:gap-4">
        <section aria-label="The graph" className="flex flex-none flex-col gap-1 md:order-2 md:min-w-0 md:flex-1" style={planeHeight ? { height: planeHeight } : undefined}>
          <div className="min-h-0 flex-1">
            <Plane
              model={model}
              looks={looks}
              stamp={stamp}
              window={committed}
              onWindow={setWindow}
              pois={pois}
              marker={picked?.marker ?? null}
              onTap={onTap}
              label={`Graph, x from ${formatNumber(committed.xMin)} to ${formatNumber(committed.xMax)}, y from ${formatNumber(committed.yMin)} to ${formatNumber(committed.yMax)}`}
              describedBy={descId}
              onFit={fit}
              onStandard={() => setWindow({ ...STANDARD_WINDOW })}
              animate={animate}
            />
          </div>
          <p id={descId} className="sr-only">
            {description}
          </p>
          <p role="status" aria-live="polite" className="min-h-5 text-sm text-navy" data-graph-status="">
            {picked?.say ?? (arrivedWords || <span className="text-navy/60">Tap a curve or a dot to see its coordinates.</span>)}
          </p>
          {!phone && points}
        </section>

        <section ref={listRef} aria-label="Expression list" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2 md:order-1 md:w-[23rem] md:flex-none md:pr-1">
          {phone && points}
          <RowList model={model} current={current} names={names} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const id = addRow()
                if (id) requestFocus(id)
              }}
              className="min-h-11 rounded-xl border-2 border-dashed border-navy-100 px-3 text-sm font-semibold text-navy hover:bg-navy-50"
            >
              + Add a row
            </button>
            {!keypadOn && <p className="text-xs text-navy/60">Type like a calculator: x^2, sqrt(x), |x|, pi, &lt;=, f(x) = …</p>}
          </div>
          <SliderList letters={model.sliders} />
          <TablePanel model={model} rows={rows} stamp={stamp} />
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            aria-haspopup="dialog"
            className="min-h-11 rounded-xl px-2 text-sm font-semibold text-bad underline hover:bg-navy-50"
          >
            Clear all…
          </button>
        </section>
      </div>

      <BottomSheet open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear the graph?">
        <p className="text-navy">Every row and slider goes, and the window goes back to the standard one. This can’t be undone.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              clearAll()
              setConfirmClear(false)
            }}
            className="min-h-11 rounded-xl bg-bad px-4 font-semibold text-white hover:opacity-90"
          >
            Clear all
          </button>
          <button type="button" onClick={() => setConfirmClear(false)} className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50">
            Keep them
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}

export default GrapherPage
