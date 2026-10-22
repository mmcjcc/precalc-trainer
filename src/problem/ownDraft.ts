/**
 * What the "Check my own problem" builder keeps on this device (`pct.own`): per module, the kind she picked, the
 * text in the box and, where the module offers it, the decimal places she asked for (none: the exact answer), so Back
 * from her problem (or a later visit) finds the builder as she left it. Device memory like the grapher's rows
 * (`pct.graph`): not in backups, never synced. Checked on read: anything unreadable is ignored.
 */
import type { StripKey } from '@/components/symbolStrip'
import { DIFF_QUOTIENT_KEYS, FUNCTION_KEYS, LOG_KEYS, STRIP_KEYS } from '@/components/symbolStrip'
import { OWN_PLACES } from '@/content/own/core'
import { safeRead, safeWrite } from '@/store/storage'

export const OWN_STORAGE_KEY = 'pct.own'

export interface OwnDraft {
  kind: string
  text: string
  /** Round the answer to this many decimal places; absent: the exact answer. */
  places?: number
}

type Stored = Record<string, OwnDraft>

function isPlaces(v: unknown): v is number {
  return typeof v === 'number' && (OWN_PLACES as readonly number[]).includes(v)
}

function readAll(): Stored {
  const raw = safeRead<unknown>(OWN_STORAGE_KEY)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Stored = {}
  for (const [moduleId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const { kind, text, places } = value as Record<string, unknown>
    if (typeof kind === 'string' && typeof text === 'string' && text.length <= 400) out[moduleId] = { kind, text, ...(isPlaces(places) ? { places } : {}) }
  }
  return out
}

export function loadOwnDraft(moduleId: string): OwnDraft | null {
  return readAll()[moduleId] ?? null
}

export function saveOwnDraft(moduleId: string, draft: OwnDraft): void {
  const all = readAll()
  all[moduleId] = { kind: draft.kind, text: draft.text.slice(0, 400), ...(isPlaces(draft.places) ? { places: draft.places } : {}) }
  safeWrite(OWN_STORAGE_KEY, all)
}

/**
 * The keys of the box she types her problem in: the same set the module's flow gives her for her lines (the phone's
 * math keypad shows them in its context row; a computer shows them as the symbol strip).
 */
export function ownKeysFor(moduleId: string): readonly StripKey[] {
  switch (moduleId) {
    case 'expLogEquations':
    case 'logProperties':
      return LOG_KEYS
    case 'quadratics':
      return FUNCTION_KEYS
    case 'diffQuotient':
      return DIFF_QUOTIENT_KEYS
    default:
      return STRIP_KEYS
  }
}
