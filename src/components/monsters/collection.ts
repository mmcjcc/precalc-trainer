/**
 * The monster collection (docs/progress/phone-monsters.md), from the rewards' mistake cards (store/rewards.ts: a card
 * per mistake and problem type, caught, and squashed after three clean problems of that type). A monster is a mistake
 * across every type she made it in: on the loose while any of its cards is open, squashed once every card is, not
 * seen while it has none. Pure: no XP here (rewards off, the collection is the same).
 */
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { SQUASH_AFTER, type MistakeCard } from '@/store'
import { isRare, type Species } from './species'

export type MonsterStatus = 'unseen' | 'caught' | 'squashed'

export interface MonsterEntry {
  /** The catalog id. */
  id: string
  /** Its tagline: the catalog title. */
  title: string
  status: MonsterStatus
  rare: boolean
  /** Times she made it, every problem type together. */
  count: number
  /** Clean problems toward squashing it, 0 to 3 (3 once squashed). */
  pips: number
  /** The latest time she made it, and in which problem type. */
  lastAt: number | null
  lastSkill: string | null
  /** The type "Practice this" opens: the open card closest to squashed (else the latest one). */
  practiceSkill: string | null
}

export interface SpeciesEntry {
  species: Species
  monsters: MonsterEntry[]
  onTheLoose: number
  squashed: number
}

export interface Collection {
  species: SpeciesEntry[]
  squashed: number
  onTheLoose: number
}

export function patternTitle(id: string): string {
  return id in ERROR_PATTERNS ? ERROR_PATTERNS[id as ErrorPatternId].title : id.replace(/_/g, ' ')
}

/** The open card that is closest to squashed, then the most recent (the order the rewards list them in). */
function activeCard(open: readonly MistakeCard[]): MistakeCard | undefined {
  return [...open].sort((a, b) => b.clean - a.clean || b.lastAt - a.lastAt)[0]
}

export function monsterEntry(id: string, cards: readonly MistakeCard[]): MonsterEntry {
  const mine = cards.filter((c) => c.pattern === id)
  const base = { id, title: patternTitle(id), rare: isRare(id) }
  if (mine.length === 0) return { ...base, status: 'unseen', count: 0, pips: 0, lastAt: null, lastSkill: null, practiceSkill: null }
  const latest = mine.reduce((a, b) => (b.lastAt > a.lastAt ? b : a))
  const open = mine.filter((c) => !c.squashed)
  const active = activeCard(open)
  return {
    ...base,
    status: active ? 'caught' : 'squashed',
    count: mine.reduce((s, c) => s + c.count, 0),
    pips: active ? Math.min(active.clean, SQUASH_AFTER) : SQUASH_AFTER,
    lastAt: latest.lastAt,
    lastSkill: latest.skill,
    practiceSkill: (active ?? latest).skill,
  }
}

/** The collection for these species (the edition's), from her mistake cards. */
export function monsterCollection(cards: readonly MistakeCard[], species: readonly Species[]): Collection {
  let squashed = 0
  let onTheLoose = 0
  const out: SpeciesEntry[] = species.map((s) => {
    const monsters = s.variants.map((id) => monsterEntry(id, cards))
    const sq = monsters.filter((m) => m.status === 'squashed').length
    const loose = monsters.filter((m) => m.status === 'caught').length
    squashed += sq
    onTheLoose += loose
    return { species: s, monsters, squashed: sq, onTheLoose: loose }
  })
  return { species: out, squashed, onTheLoose }
}

/** "14 squashed · 3 on the loose". */
export function tallyLine(c: Pick<Collection, 'squashed' | 'onTheLoose'>): string {
  return `${c.squashed} squashed · ${c.onTheLoose} on the loose`
}

/** "Caught 3 times", "Caught once". */
export function timesCaught(n: number): string {
  return n === 1 ? 'Caught once' : n === 2 ? 'Caught twice' : `Caught ${n} times`
}

/** A monster in words: its state, how many times, and how close it is to squashed. */
export function monsterStateWords(m: MonsterEntry): string {
  if (m.status === 'unseen') return 'Not caught yet'
  if (m.status === 'squashed') return `Squashed. ${timesCaught(m.count)}`
  return `${timesCaught(m.count)}, ${m.pips} of ${SQUASH_AFTER} clean problems to squash it`
}
