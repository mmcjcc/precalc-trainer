import { describe, expect, it } from 'vitest'
import { mulberry32 } from '@/content/rng'
import { fasterMatch, recordMatchIn, type StudySet } from '@/store/studySets'
import { formatMatchTime, planBoards, tapTile, tilesFor, type MatchPair, type MatchTile } from './match'

function cards(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `c${i}`, term: `term ${i}`, definition: `def ${i}` }))
}

/** Tap each pair’s term, then its definition. Returns how many tiles are still up. */
function playBoard(pairs: readonly MatchPair[], rng: () => number): number {
  const tiles = tilesFor(pairs, rng)
  let gone = new Set<string>()
  let selected: string | null = null
  for (const pair of pairs) {
    const term = tiles.find((tile) => tile.cardId === pair.cardId && tile.side === 'term')!
    const def = tiles.find((tile) => tile.cardId === pair.cardId && tile.side === 'definition')!
    const picked = tapTile(tiles, gone, selected, term.key)
    expect(picked.result).toBe('selected')
    const matched = tapTile(tiles, picked.gone, picked.selected, def.key)
    expect(matched.result).toBe('matched')
    gone = matched.gone
    selected = matched.selected
  }
  return tiles.length - gone.size
}

function expectPairs(tiles: readonly MatchTile[], pairs: readonly MatchPair[]) {
  expect(tiles).toHaveLength(pairs.length * 2)
  expect(new Set(tiles.map((tile) => tile.key)).size).toBe(tiles.length)
  for (const pair of pairs) {
    const sides = tiles.filter((tile) => tile.cardId === pair.cardId)
    expect(sides.map((tile) => tile.side).sort()).toEqual(['definition', 'term'])
    expect(sides.find((tile) => tile.side === 'term')!.text).toBe(pair.term)
    expect(sides.find((tile) => tile.side === 'definition')!.text).toBe(pair.definition)
  }
}

describe('match boards', () => {
  it('splits the set into boards of at most six, and every board’s tiles pair exactly', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = mulberry32(seed)
      const n = 1 + Math.floor(rng() * 20)
      const deck = cards(n)
      const boards = planBoards(deck, rng)
      expect(boards.flat()).toHaveLength(n)
      expect(boards.every((board) => board.length <= 6 && board.length > 0)).toBe(true)
      expect(new Set(boards.flat().map((pair) => pair.cardId)).size).toBe(n)
      for (const board of boards) expectPairs(tilesFor(board, mulberry32(seed + 50)), board)
    }
    const thirteen = planBoards(cards(13), mulberry32(7))
    expect(thirteen.map((board) => board.length)).toEqual([6, 6, 1])
  })

  it('a wrong pair flashes and stays up; clearing every board is the whole pass', () => {
    const boards = planBoards(cards(13), mulberry32(4))
    const first = tilesFor(boards[0]!, () => 0)
    const termA = first.find((tile) => tile.side === 'term')!
    const other = first.find((tile) => tile.side === 'definition' && tile.cardId !== termA.cardId)!
    const missed = tapTile(first, new Set(), termA.key, other.key)
    expect(missed.result).toBe('missed')
    expect(missed.selected).toBeNull()
    expect(missed.gone.size).toBe(0)
    expect(missed.flash).toEqual([termA.key, other.key])
    const alone = tapTile(first, new Set(), null, other.key)
    expect(alone.result).toBe('ignored')
    let cleared = 0
    for (const board of boards) {
      expect(playBoard(board, mulberry32(cleared + 3))).toBe(0)
      cleared += 1
    }
    expect(cleared).toBe(boards.length)
    expect(boards.flat().map((pair) => pair.cardId).sort()).toEqual(cards(13).map((card) => card.id).sort())
  })

  it('stores a best time only when the new one is faster', () => {
    const set: StudySet = {
      id: 's',
      title: 'Cells',
      cards: [{ id: 'c', term: 'cell', definition: 'unit' }],
      createdAt: 1,
      updatedAt: 1,
      source: 'made',
    }
    expect(fasterMatch(undefined, 5000)).toBe(5000)
    expect(fasterMatch(5000, 5000)).toBe(5000)
    expect(fasterMatch(5000, 8000)).toBe(5000)
    expect(fasterMatch(5000, Number.NaN)).toBe(5000)
    expect(fasterMatch(5000, -1)).toBe(5000)
    const first = recordMatchIn([set], 's', 5000, 10)
    expect(first[0]!.bestMatchMs).toBe(5000)
    expect(first[0]!.updatedAt).toBe(10)
    expect(recordMatchIn(first, 's', 8000, 20)).toBe(first)
    expect(recordMatchIn(first, 's', Number.NaN, 21)).toBe(first)
    const faster = recordMatchIn(first, 's', 1000, 30)
    expect(faster[0]!.bestMatchMs).toBe(1000)
    expect(faster[0]!.updatedAt).toBe(30)
    expect(recordMatchIn(first, 'missing', 1, 40)).toBe(first)
  })

  it('formats the elapsed time', () => {
    expect(formatMatchTime(0)).toBe('0:00')
    expect(formatMatchTime(1500)).toBe('0:02')
    expect(formatMatchTime(65_000)).toBe('1:05')
  })
})
