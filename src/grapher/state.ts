/**
 * What the grapher keeps on the device (`pct.graph`): the rows (text, colour, hidden), the sliders (value, range,
 * step), the window, the angle mode and the table's row, start and step. Device memory like the active set
 * (`pct.set`) and the path (`pct.path`): not in backups, never synced, kept across reloads. Versioned and checked on
 * read: anything unreadable falls back to the defaults, a bad part alone to its own default. Pure apart from the two
 * storage calls.
 */
import { safeRead, safeWrite } from '@/store/storage'
import type { AngleMode } from './compile'
import { isGraphColor, nextColor, type GraphColor } from './colors'
import { isValidWindow, STANDARD_WINDOW, type ViewWindow } from './view'

export const GRAPH_STORAGE_KEY = 'pct.graph'

export const MAX_ROWS = 60
export const MAX_ROW_TEXT = 400

export interface GraphRowState {
  id: string
  text: string
  color: GraphColor
  hidden: boolean
}

export interface SliderState {
  value: number
  min: number
  max: number
  step: number
}

export interface TableState {
  /** The row it shows, or null (none chosen yet: the first row that can make one). */
  rowId: string | null
  start: number
  step: number
}

export interface GraphState {
  version: 1
  rows: GraphRowState[]
  /** By letter (lower case). Kept while a letter is out of use, so its value comes back with it. */
  sliders: Record<string, SliderState>
  window: ViewWindow
  mode: AngleMode
  table: TableState
  /** The next row id's number (ids are never reused, so React keys and the table's row stay stable). */
  nextId: number
}

export const DEFAULT_SLIDER: Readonly<SliderState> = Object.freeze({ value: 1, min: -10, max: 10, step: 0.1 })
export const DEFAULT_TABLE: Readonly<TableState> = Object.freeze({ rowId: null, start: 0, step: 1 })

export function defaultGraphState(): GraphState {
  return {
    version: 1,
    rows: [{ id: 'r1', text: '', color: 'navy', hidden: false }],
    sliders: {},
    window: { ...STANDARD_WINDOW },
    mode: 'rad',
    table: { ...DEFAULT_TABLE },
    nextId: 2,
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function isSlider(v: unknown): v is SliderState {
  if (!isObj(v)) return false
  return finite(v.value) && finite(v.min) && finite(v.max) && finite(v.step) && v.max > v.min && v.step > 0
}

function readRows(v: unknown): GraphRowState[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > MAX_ROWS) return null
  const ids = new Set<string>()
  const rows: GraphRowState[] = []
  for (const r of v) {
    if (!isObj(r) || typeof r.id !== 'string' || !/^r\d{1,9}$/.test(r.id) || ids.has(r.id)) return null
    if (typeof r.text !== 'string' || r.text.length > MAX_ROW_TEXT) return null
    ids.add(r.id)
    rows.push({ id: r.id, text: r.text, color: isGraphColor(r.color) ? r.color : nextColor(rows.map((x) => x.color)), hidden: r.hidden === true })
  }
  return rows
}

function readSliders(v: unknown): Record<string, SliderState> {
  const out: Record<string, SliderState> = {}
  if (!isObj(v)) return out
  for (const [letter, s] of Object.entries(v)) {
    if (/^[a-z]$/.test(letter) && isSlider(s)) out[letter] = { value: s.value, min: s.min, max: s.max, step: s.step }
  }
  return out
}

function readTable(v: unknown, rows: GraphRowState[]): TableState {
  if (!isObj(v)) return { ...DEFAULT_TABLE }
  const rowId = typeof v.rowId === 'string' && rows.some((r) => r.id === v.rowId) ? v.rowId : null
  const start = finite(v.start) ? v.start : DEFAULT_TABLE.start
  const step = finite(v.step) && v.step !== 0 ? v.step : DEFAULT_TABLE.step
  return { rowId, start, step }
}

/** A stored state made safe to use, or null when it is not one at all (then the defaults). */
export function normalizeGraphState(raw: unknown): GraphState | null {
  if (!isObj(raw) || raw.version !== 1) return null
  const rows = readRows(raw.rows)
  if (!rows) return null
  const highest = Math.max(0, ...rows.map((r) => Number(r.id.slice(1))))
  const nextId = finite(raw.nextId) && Number.isInteger(raw.nextId) && raw.nextId > highest ? raw.nextId : highest + 1
  return {
    version: 1,
    rows,
    sliders: readSliders(raw.sliders),
    window: isValidWindow(raw.window) ? { xMin: raw.window.xMin, xMax: raw.window.xMax, yMin: raw.window.yMin, yMax: raw.window.yMax } : { ...STANDARD_WINDOW },
    mode: raw.mode === 'deg' ? 'deg' : 'rad',
    table: readTable(raw.table, rows),
    nextId,
  }
}

export function readGraphState(): GraphState {
  return normalizeGraphState(safeRead<unknown>(GRAPH_STORAGE_KEY)) ?? defaultGraphState()
}

/** False when this device could not save it (storage blocked or full): the graph still works while the app is open. */
export function writeGraphState(state: GraphState): boolean {
  return safeWrite(GRAPH_STORAGE_KEY, state)
}
