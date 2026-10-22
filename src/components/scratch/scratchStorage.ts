/**
 * Scratch pads on this device (docs/progress/app-tablet.md): one pad per problem attempt, its strokes as compact text in
 * localStorage under `pct.scratch.<attempt id>`, and an index (`pct.scratch`) with when each pad last changed, its size
 * and the graph-paper switch. Device memory like the grapher (`pct.graph`) and the path (`pct.path`): never in backups
 * (a backup is the store's slices: settings, events, rewards), never synced, never read by the app's checks.
 *
 * All the pads together stay under SCRATCH_CAP characters (and SCRATCH_MAX_PADS pads): saving a pad drops the pads that
 * changed longest ago until the rest fit. The pad being saved is never dropped. Every storage call is in try/catch: with
 * storage blocked or full the pad still works for as long as the page is open.
 */
import { safeRead, safeRemove, safeWrite } from '@/store/storage'
import { decodeStrokes, encodeStrokes, type Stroke } from './ink'

export const SCRATCH_INDEX_KEY = 'pct.scratch'
export const SCRATCH_PAD_PREFIX = 'pct.scratch.'
/** About 0.8 MB of localStorage (it counts UTF-16 code units) for every pad together. */
export const SCRATCH_CAP = 400_000
/** At most this many pads are kept, whatever their size. */
export const SCRATCH_MAX_PADS = 40

export interface PadEntry {
  /** The attempt the pad belongs to. */
  id: string
  /** When it last changed (ms). */
  at: number
  /** Characters of its stored text. */
  size: number
}

export interface ScratchIndex {
  version: 1
  pads: PadEntry[]
  /** Graph paper under the ink (on by default). */
  paper: boolean
}

function emptyIndex(): ScratchIndex {
  return { version: 1, pads: [], paper: true }
}

function isEntry(v: unknown): v is PadEntry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return typeof e.id === 'string' && e.id !== '' && typeof e.at === 'number' && Number.isFinite(e.at) && typeof e.size === 'number' && e.size >= 0
}

/** The index, checked on read: anything unreadable is dropped (its pads are then only found by key, never listed). */
export function readScratchIndex(): ScratchIndex {
  const raw = safeRead<unknown>(SCRATCH_INDEX_KEY)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return emptyIndex()
  const r = raw as Record<string, unknown>
  if (r.version !== 1) return emptyIndex()
  const pads = Array.isArray(r.pads) ? r.pads.filter(isEntry) : []
  return { version: 1, pads, paper: r.paper !== false }
}

function writeIndex(index: ScratchIndex): boolean {
  return safeWrite(SCRATCH_INDEX_KEY, index)
}

export function padKey(id: string): string {
  return `${SCRATCH_PAD_PREFIX}${id}`
}

/** The pad of an attempt, or null when there is none (or it cannot be read). */
export function loadPad(id: string): Stroke[] | null {
  const raw = safeRead<unknown>(padKey(id))
  if (typeof raw !== 'string') return null
  return decodeStrokes(raw)
}

/**
 * Keep an attempt's pad (an empty pad is removed), then drop the oldest other pads until all of them fit the cap.
 * Returns false when storage refused it.
 */
export function savePad(id: string, strokes: readonly Stroke[], now = Date.now()): boolean {
  const index = readScratchIndex()
  const others = index.pads.filter((p) => p.id !== id)
  if (strokes.length === 0) {
    safeRemove(padKey(id))
    writeIndex({ ...index, pads: others })
    return true
  }
  const text = encodeStrokes(strokes)
  // Oldest first: they go first.
  const kept = others.slice().sort((a, b) => a.at - b.at)
  let total = text.length + kept.reduce((sum, p) => sum + p.size, 0)
  while (kept.length > 0 && (total > SCRATCH_CAP || kept.length + 1 > SCRATCH_MAX_PADS)) {
    const old = kept.shift()!
    safeRemove(padKey(old.id))
    total -= old.size
  }
  let ok = safeWrite(padKey(id), text)
  if (!ok) {
    // Storage is full of something else: make room from the pads, oldest first, then try once more.
    while (!ok && kept.length > 0) {
      safeRemove(padKey(kept.shift()!.id))
      ok = safeWrite(padKey(id), text)
    }
  }
  writeIndex({ ...index, pads: [...kept, ...(ok ? [{ id, at: now, size: text.length }] : [])] })
  return ok
}

export function removePad(id: string): void {
  safeRemove(padKey(id))
  const index = readScratchIndex()
  writeIndex({ ...index, pads: index.pads.filter((p) => p.id !== id) })
}

export function readPaper(): boolean {
  return readScratchIndex().paper
}

export function writePaper(on: boolean): void {
  writeIndex({ ...readScratchIndex(), paper: on })
}
