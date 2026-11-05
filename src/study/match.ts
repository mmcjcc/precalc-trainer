/**
 * Match: boards of up to six pairs. She taps a term, then its definition. A wrong pair does not stay selected.
 */

export interface MatchPair {
  cardId: string
  term: string
  definition: string
}

export interface MatchTile {
  key: string
  cardId: string
  side: 'term' | 'definition'
  text: string
}

export interface MatchTap {
  gone: Set<string>
  selected: string | null
  result: 'selected' | 'matched' | 'missed' | 'ignored'
  /** Tiles to flash after a miss. */
  flash: string[]
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

/** Every card once, split into boards of at most six pairs. */
export function planBoards(cards: readonly { id: string; term: string; definition: string }[], rng: () => number): MatchPair[][] {
  const order = shuffle(
    cards.map((card) => ({ cardId: card.id, term: card.term, definition: card.definition })),
    rng,
  )
  const boards: MatchPair[][] = []
  for (let i = 0; i < order.length; i += 6) boards.push(order.slice(i, i + 6))
  return boards
}

/** The board's terms and definitions, shuffled together. Each card is one term tile and one definition tile. */
export function tilesFor(pairs: readonly MatchPair[], rng: () => number): MatchTile[] {
  const tiles: MatchTile[] = []
  for (const pair of pairs) {
    tiles.push({ key: `${pair.cardId}:term`, cardId: pair.cardId, side: 'term', text: pair.term })
    tiles.push({ key: `${pair.cardId}:definition`, cardId: pair.cardId, side: 'definition', text: pair.definition })
  }
  return shuffle(tiles, rng)
}

export function tapTile(tiles: readonly MatchTile[], gone: ReadonlySet<string>, selected: string | null, key: string): MatchTap {
  const tile = tiles.find((item) => item.key === key)
  if (!tile || gone.has(key)) return { gone: new Set(gone), selected, result: 'ignored', flash: [] }
  if (tile.side === 'term') return { gone: new Set(gone), selected: key, result: 'selected', flash: [] }
  if (!selected) return { gone: new Set(gone), selected: null, result: 'ignored', flash: [] }
  const term = tiles.find((item) => item.key === selected)
  if (!term || term.side !== 'term') return { gone: new Set(gone), selected: null, result: 'ignored', flash: [] }
  if (term.cardId === tile.cardId) {
    const next = new Set(gone)
    next.add(term.key)
    next.add(tile.key)
    return { gone: next, selected: null, result: 'matched', flash: [] }
  }
  return { gone: new Set(gone), selected: null, result: 'missed', flash: [term.key, tile.key] }
}

export function formatMatchTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
