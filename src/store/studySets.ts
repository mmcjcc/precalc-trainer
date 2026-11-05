/**
 * Study sets: decks of term/definition cards she makes or imports (src/study).
 * Limits fail with a message; nothing here throws. A blank card (empty term or definition after trim) is dropped on save.
 */
export const STUDY_LIMITS = {
  maxSets: 100,
  maxCards: 200,
  maxField: 500,
  maxTitle: 80,
} as const

export interface StudyCard {
  id: string
  term: string
  definition: string
}

export interface StudySet {
  id: string
  title: string
  cards: StudyCard[]
  createdAt: number
  updatedAt: number
  source: 'made' | 'imported'
  /** Best Match time, when she has finished a match. Only replaced by a faster one. */
  bestMatchMs?: number
}

export interface StudyDraftCard {
  id?: string
  term: string
  definition: string
}

export type StudyWriteResult =
  | { ok: true; set: StudySet; dropped: number }
  | { ok: false; error: string }

export function newStudyId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

export function blankCardsNote(n: number): string {
  return n === 1 ? '1 blank card removed' : `${n} blank cards removed`
}

export function checkTitle(title: string): { ok: true; title: string } | { ok: false; error: string } {
  const trimmed = title.trim()
  if (!trimmed) return { ok: false, error: 'Give the set a title.' }
  if (trimmed.length > STUDY_LIMITS.maxTitle) {
    return { ok: false, error: `A title can be at most ${STUDY_LIMITS.maxTitle} characters.` }
  }
  return { ok: true, title: trimmed }
}

/** Trim, drop blanks, reject a field or a deck that is over the limit. Ids already on a card are kept. */
export function prepareCards(raw: readonly StudyDraftCard[]): { ok: true; cards: StudyCard[]; dropped: number } | { ok: false; error: string } {
  const cards: StudyCard[] = []
  const seen = new Set<string>()
  let dropped = 0
  for (const row of raw) {
    const term = row.term.trim()
    const definition = row.definition.trim()
    if (!term || !definition) {
      dropped += 1
      continue
    }
    if (term.length > STUDY_LIMITS.maxField || definition.length > STUDY_LIMITS.maxField) {
      return { ok: false, error: `A term or a definition can be at most ${STUDY_LIMITS.maxField} characters.` }
    }
    let id = typeof row.id === 'string' && row.id.length > 0 && !seen.has(row.id) ? row.id : newStudyId()
    seen.add(id)
    cards.push({ id, term, definition })
  }
  if (cards.length > STUDY_LIMITS.maxCards) {
    return { ok: false, error: `A set can have at most ${STUDY_LIMITS.maxCards} cards.` }
  }
  return { ok: true, cards, dropped }
}

export function createStudySetIn(
  sets: readonly StudySet[],
  input: { title: string; cards?: readonly StudyDraftCard[]; source?: 'made' | 'imported'; now?: number },
): { sets: StudySet[]; result: StudyWriteResult } {
  if (sets.length >= STUDY_LIMITS.maxSets) {
    return {
      sets: [...sets],
      result: { ok: false, error: `You can keep up to ${STUDY_LIMITS.maxSets} study sets. Delete one to add another.` },
    }
  }
  const title = checkTitle(input.title)
  if (!title.ok) return { sets: [...sets], result: title }
  const cards = prepareCards(input.cards ?? [])
  if (!cards.ok) return { sets: [...sets], result: cards }
  const now = input.now ?? Date.now()
  const set: StudySet = {
    id: newStudyId(),
    title: title.title,
    cards: cards.cards,
    createdAt: now,
    updatedAt: now,
    source: input.source === 'imported' ? 'imported' : 'made',
  }
  return { sets: [...sets, set], result: { ok: true, set, dropped: cards.dropped } }
}

export function renameStudySetIn(sets: readonly StudySet[], id: string, title: string, now = Date.now()): { sets: StudySet[]; result: StudyWriteResult } {
  const checked = checkTitle(title)
  if (!checked.ok) return { sets: [...sets], result: checked }
  const idx = sets.findIndex((set) => set.id === id)
  if (idx < 0) return { sets: [...sets], result: { ok: false, error: 'That study set is not on this device.' } }
  const prev = sets[idx]!
  const set: StudySet = { ...prev, title: checked.title, updatedAt: now }
  const next = sets.slice()
  next[idx] = set
  return { sets: next, result: { ok: true, set, dropped: 0 } }
}

export function saveStudySetIn(
  sets: readonly StudySet[],
  id: string,
  input: { title: string; cards: readonly StudyDraftCard[]; now?: number },
): { sets: StudySet[]; result: StudyWriteResult } {
  const title = checkTitle(input.title)
  if (!title.ok) return { sets: [...sets], result: title }
  const cards = prepareCards(input.cards)
  if (!cards.ok) return { sets: [...sets], result: cards }
  const idx = sets.findIndex((set) => set.id === id)
  if (idx < 0) return { sets: [...sets], result: { ok: false, error: 'That study set is not on this device.' } }
  const prev = sets[idx]!
  const set: StudySet = { ...prev, title: title.title, cards: cards.cards, updatedAt: input.now ?? Date.now() }
  const next = sets.slice()
  next[idx] = set
  return { sets: next, result: { ok: true, set, dropped: cards.dropped } }
}

/** Keep the previous best unless `ms` is a finite, faster time. */
export function fasterMatch(current: number | undefined, ms: number): number | undefined {
  if (!Number.isFinite(ms) || ms < 0) return current
  if (current === undefined || ms < current) return ms
  return current
}

export function recordMatchIn(sets: readonly StudySet[], id: string, ms: number, now = Date.now()): readonly StudySet[] {
  const idx = sets.findIndex((set) => set.id === id)
  if (idx < 0) return sets
  const prev = sets[idx]!
  const best = fasterMatch(prev.bestMatchMs, ms)
  if (best === prev.bestMatchMs) return sets
  const next = sets.slice()
  const set: StudySet = { ...prev, updatedAt: now }
  if (best === undefined) delete set.bestMatchMs
  else set.bestMatchMs = best
  next[idx] = set
  return next
}

function isSource(v: unknown): v is StudySet['source'] {
  return v === 'made' || v === 'imported'
}

function normalizeCard(raw: unknown): StudyCard | null {
  if (typeof raw !== 'object' || raw === null) return null
  const card = raw as Record<string, unknown>
  if (typeof card.id !== 'string' || card.id.length === 0) return null
  if (typeof card.term !== 'string' || typeof card.definition !== 'string') return null
  return { id: card.id, term: card.term, definition: card.definition }
}

function normalizeOne(raw: unknown): StudySet | null {
  if (typeof raw !== 'object' || raw === null) return null
  const set = raw as Record<string, unknown>
  if (typeof set.id !== 'string' || set.id.length === 0) return null
  if (typeof set.title !== 'string') return null
  if (!isSource(set.source)) return null
  if (typeof set.createdAt !== 'number' || !Number.isFinite(set.createdAt)) return null
  if (typeof set.updatedAt !== 'number' || !Number.isFinite(set.updatedAt)) return null
  if (!Array.isArray(set.cards)) return null
  const cards: StudyCard[] = []
  for (const card of set.cards) {
    const next = normalizeCard(card)
    if (next) cards.push(next)
  }
  const out: StudySet = { id: set.id, title: set.title, cards, createdAt: set.createdAt, updatedAt: set.updatedAt, source: set.source }
  if (typeof set.bestMatchMs === 'number' && Number.isFinite(set.bestMatchMs) && set.bestMatchMs >= 0) out.bestMatchMs = set.bestMatchMs
  return out
}

/** A slice from storage or a backup. Anything unreadable is dropped; a missing slice is empty. */
export function normalizeStudySets(raw: unknown): StudySet[] {
  if (!Array.isArray(raw)) return []
  const out: StudySet[] = []
  for (const item of raw) {
    const set = normalizeOne(item)
    if (set) out.push(set)
  }
  return out
}

/**
 * Merge two devices' sets by id. The copy with the newer `updatedAt` wins; a tie keeps `current`.
 * Sets only on one side are kept. Order follows `current`, then sets that arrived with `incoming`.
 */
export function mergeStudySets(current: readonly StudySet[], incoming: readonly StudySet[]): StudySet[] {
  const byId = new Map<string, StudySet>()
  for (const set of current) byId.set(set.id, set)
  for (const set of incoming) {
    const mine = byId.get(set.id)
    if (!mine || set.updatedAt > mine.updatedAt) byId.set(set.id, set)
  }
  const seen = new Set<string>()
  const out: StudySet[] = []
  for (const set of current) {
    const next = byId.get(set.id)
    if (next) out.push(next)
    seen.add(set.id)
  }
  for (const set of incoming) {
    if (seen.has(set.id)) continue
    const next = byId.get(set.id)
    if (next) out.push(next)
    seen.add(set.id)
  }
  return out
}
