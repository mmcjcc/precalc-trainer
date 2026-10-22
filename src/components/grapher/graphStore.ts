/**
 * The grapher's state: the rows, the sliders, the window, the angle mode and the table (persisted on this device in
 * `pct.graph`, src/grapher/state.ts), and what is passing (the selected point, a row to focus, rows that just came from
 * a problem's "Graph it", a Zoom to fit waiting for its rows to be read). Saved a moment after each change and when
 * the app goes to the background, so a reload brings the graph back as it was.
 */
import { create } from 'zustand'
import { COLOR_ORDER, nextColor, type GraphColor } from '@/grapher/colors'
import type { AngleMode } from '@/grapher/compile'
import type { GraphItRequest } from '@/grapher/graphIt'
import type { PoiKind } from '@/grapher/poi'
import {
  DEFAULT_SLIDER,
  defaultGraphState,
  isSlider,
  MAX_ROW_TEXT,
  MAX_ROWS,
  readGraphState,
  writeGraphState,
  type GraphRowState,
  type GraphState,
  type SliderState,
  type TableState,
} from '@/grapher/state'
import { clampWindow, STANDARD_WINDOW, type ViewWindow } from '@/grapher/view'

/** A point she tapped (or picked from the list): a point of interest, a spot traced on a curve, or one of her points. */
export type Selection =
  | { kind: 'poi'; x: number; y: number; kinds: PoiKind[]; rows: number[] }
  | { kind: 'trace'; rowId: string; x: number }
  | { kind: 'point'; rowId: string; x: number; y: number }

interface Passing {
  selection: Selection | null
  /** A row to focus once it is on the page (a new row, the next row after Enter). */
  focus: { id: string; seq: number } | null
  /** Rows that came from a problem's "Graph it" just now. */
  arrived: string[]
  /** Zoom to fit once the rows are read (Graph it with no window of its own). */
  fitPending: boolean
}

export interface GraphStore extends GraphState, Passing {
  setText: (id: string, text: string) => void
  /** A new empty row after `after` (at the end without it); its id, or null at the row limit. */
  addRow: (after?: string, text?: string) => string | null
  deleteRow: (id: string) => void
  moveRow: (id: string, by: -1 | 1) => void
  setColor: (id: string, color: GraphColor) => void
  toggleHidden: (id: string) => void
  setSlider: (letter: string, change: Partial<SliderState>) => void
  /** Give each letter a slider if it has none yet. */
  ensureSliders: (letters: readonly string[]) => void
  setWindow: (w: ViewWindow) => void
  setMode: (mode: AngleMode) => void
  setTable: (change: Partial<TableState>) => void
  /** Every row and slider gone, the standard window (the angle mode stays: it is like the TI-84's MODE). */
  clearAll: () => void
  /** "Graph it": the problem's rows added (or brought back if they are there already), in the problem's window. */
  importRows: (req: GraphItRequest) => void
  select: (s: Selection | null) => void
  requestFocus: (id: string) => void
  takeFit: () => boolean
}

const PASSING: Passing = { selection: null, focus: null, arrived: [], fitPending: false }

function persisted(s: GraphStore): GraphState {
  return { version: 1, rows: s.rows, sliders: s.sliders, window: s.window, mode: s.mode, table: s.table, nextId: s.nextId }
}

const squash = (t: string) => t.replace(/\s+/g, '').toLowerCase()

export const useGraphStore = create<GraphStore>()((set, get) => ({
  ...readGraphState(),
  ...PASSING,

  // Her first edit ends the "from your problem" highlight.
  setText: (id, text) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, text: text.slice(0, MAX_ROW_TEXT) } : r)), arrived: s.arrived.length ? [] : s.arrived })),

  addRow: (after, text = '') => {
    const s = get()
    if (s.rows.length >= MAX_ROWS) return null
    const id = `r${s.nextId}`
    const row: GraphRowState = { id, text: text.slice(0, MAX_ROW_TEXT), color: nextColor(s.rows.map((r) => r.color)), hidden: false }
    const at = after ? s.rows.findIndex((r) => r.id === after) : -1
    const rows = [...s.rows]
    rows.splice(at >= 0 ? at + 1 : rows.length, 0, row)
    set({ rows, nextId: s.nextId + 1 })
    return id
  },

  deleteRow: (id) =>
    set((s) => {
      let rows = s.rows.filter((r) => r.id !== id)
      let nextId = s.nextId
      if (rows.length === 0) {
        rows = [{ id: `r${nextId}`, text: '', color: COLOR_ORDER[0]!, hidden: false }]
        nextId++
      }
      const selection = s.selection && 'rowId' in s.selection && s.selection.rowId === id ? null : s.selection?.kind === 'poi' ? null : s.selection
      return { rows, nextId, selection, table: s.table.rowId === id ? { ...s.table, rowId: null } : s.table, arrived: s.arrived.filter((a) => a !== id) }
    }),

  moveRow: (id, by) =>
    set((s) => {
      const i = s.rows.findIndex((r) => r.id === id)
      const j = i + by
      if (i < 0 || j < 0 || j >= s.rows.length) return s
      const rows = [...s.rows]
      ;[rows[i], rows[j]] = [rows[j]!, rows[i]!]
      return { rows, selection: s.selection?.kind === 'poi' ? null : s.selection }
    }),

  setColor: (id, color) => set((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, color } : r)) })),

  toggleHidden: (id) =>
    set((s) => ({
      rows: s.rows.map((r) => (r.id === id ? { ...r, hidden: !r.hidden } : r)),
      selection: s.selection?.kind === 'poi' || (s.selection && 'rowId' in s.selection && s.selection.rowId === id) ? null : s.selection,
    })),

  setSlider: (letter, change) =>
    set((s) => {
      const before = s.sliders[letter] ?? DEFAULT_SLIDER
      let next: SliderState = { ...before, ...change }
      if (!Number.isFinite(next.value)) next.value = before.value
      // A value typed outside the range takes the range with it.
      if (next.value < next.min) next = { ...next, min: next.value }
      if (next.value > next.max) next = { ...next, max: next.value }
      if (!isSlider(next)) return s
      return { sliders: { ...s.sliders, [letter]: next } }
    }),

  ensureSliders: (letters) => {
    const missing = letters.filter((l) => !get().sliders[l])
    if (missing.length === 0) return
    set((s) => ({ sliders: { ...s.sliders, ...Object.fromEntries(missing.map((l) => [l, { ...DEFAULT_SLIDER }])) } }))
  },

  setWindow: (w) => set({ window: clampWindow(w) }),
  setMode: (mode) => set((s) => ({ mode, selection: s.selection?.kind === 'poi' ? null : s.selection })),
  setTable: (change) => set((s) => ({ table: { ...s.table, ...change } })),

  clearAll: () =>
    set((s) => {
      const fresh = defaultGraphState()
      return { ...fresh, mode: s.mode, rows: [{ ...fresh.rows[0]!, id: `r${s.nextId}` }], nextId: s.nextId + 1, ...PASSING }
    }),

  importRows: (req) =>
    set((s) => {
      let rows = s.rows
      let nextId = s.nextId
      // A grapher with only an empty row starts from the problem's rows.
      if (rows.length === 1 && !rows[0]!.text.trim()) rows = []
      const arrived: string[] = []
      for (const r of req.rows) {
        const same = rows.find((x) => squash(x.text) === squash(r.text))
        if (same) {
          rows = rows.map((x) => (x === same ? { ...x, hidden: false } : x))
          arrived.push(same.id)
          continue
        }
        if (rows.length >= MAX_ROWS) break
        const id = `r${nextId++}`
        rows = [...rows, { id, text: r.text.slice(0, MAX_ROW_TEXT), color: r.color ?? nextColor(rows.map((x) => x.color)), hidden: false }]
        arrived.push(id)
      }
      if (rows.length === 0) rows = [{ id: `r${nextId++}`, text: '', color: COLOR_ORDER[0]!, hidden: false }]
      return {
        rows,
        nextId,
        arrived,
        selection: null,
        window: req.window ? clampWindow(req.window) : s.window,
        fitPending: !req.window,
      }
    }),

  select: (selection) => set({ selection }),
  requestFocus: (id) => set((s) => ({ focus: { id, seq: (s.focus?.seq ?? 0) + 1 } })),
  takeFit: () => {
    if (!get().fitPending) return false
    set({ fitPending: false })
    return true
  },
}))

// ---- saving ------------------------------------------------------------------------------------------------------

const SAVE_AFTER_MS = 250
let timer: ReturnType<typeof setTimeout> | undefined
let lastSaved: GraphState | null = null

function changed(a: GraphState | null, b: GraphState): boolean {
  return !a || a.rows !== b.rows || a.sliders !== b.sliders || a.window !== b.window || a.mode !== b.mode || a.table !== b.table || a.nextId !== b.nextId
}

/** Write the graph now (also what the timer and the app going to the background do). */
export function flushGraphSave(): void {
  clearTimeout(timer)
  timer = undefined
  const state = persisted(useGraphStore.getState())
  if (!changed(lastSaved, state)) return
  writeGraphState(state)
  lastSaved = state
}

lastSaved = persisted(useGraphStore.getState())
useGraphStore.subscribe((s) => {
  if (!changed(lastSaved, persisted(s))) return
  clearTimeout(timer)
  timer = setTimeout(flushGraphSave, SAVE_AFTER_MS)
})

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushGraphSave()
  })
}
if (typeof window !== 'undefined') window.addEventListener('pagehide', flushGraphSave)

/** Tests: the graph as a fresh device has it. */
export function resetGraphStoreForTests(): void {
  clearTimeout(timer)
  timer = undefined
  useGraphStore.setState({ ...defaultGraphState(), ...PASSING })
  lastSaved = persisted(useGraphStore.getState())
}

/** Tests: what a reload does, reading the graph back from this device's storage. */
export function reloadGraphStoreForTests(): void {
  clearTimeout(timer)
  timer = undefined
  useGraphStore.setState({ ...readGraphState(), ...PASSING })
  lastSaved = persisted(useGraphStore.getState())
}

export { STANDARD_WINDOW }
