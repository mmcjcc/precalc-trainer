/**
 * What the path last showed for each problem type on this device (`pct.path`), so a stop that levelled up since (a
 * type went from Practiced to Solid, say) celebrates once, the next time Home shows it. Device memory like the active
 * set (`pct.set`): not in backups, never synced. Pure apart from the two storage calls.
 *
 * - The first time the path is shown on a device it remembers every ring as it is: nothing old celebrates.
 * - A stop is remembered when Home shows it, except one that levelled up: that one is remembered when its celebration
 *   plays (when it comes into view), so a level-up she has not scrolled to yet waits for her.
 * - A ring that went down is remembered lower wherever it is (a reset of progress, a slip), so winning the level back
 *   celebrates again.
 */
import type { RingLevel, SkillRingInfo } from '@/store/rewards'
import { safeRead, safeWrite } from '@/store/storage'

export const PATH_STORAGE_KEY = 'pct.path'

/** What a stop's ring showed: its level and how full it was (0 to 1). */
export interface SeenRing {
  level: RingLevel
  fill: number
}

export interface PathMemory {
  version: 1
  /** Problem type (skill) to the ring the path last showed for it. A type that is not here showed New. */
  seen: Record<string, SeenRing>
}

const RANK: Record<RingLevel, number> = { new: 0, practiced: 1, solid: 2, mastered: 3 }

export function levelRank(level: RingLevel): number {
  return RANK[level]
}

function isLevel(v: unknown): v is RingLevel {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(RANK, v)
}

function isSeenRing(v: unknown): v is SeenRing {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false
  const r = v as Record<string, unknown>
  return isLevel(r.level) && typeof r.fill === 'number' && Number.isFinite(r.fill) && r.fill >= 0 && r.fill <= 1
}

/** The memory, or null: none yet on this device, or unreadable (then the path starts over, celebrating nothing). */
export function readPathMemory(): PathMemory | null {
  const raw = safeRead<unknown>(PATH_STORAGE_KEY)
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (r.version !== 1 || typeof r.seen !== 'object' || r.seen === null || Array.isArray(r.seen)) return null
  const seen: Record<string, SeenRing> = {}
  for (const [skill, ring] of Object.entries(r.seen as Record<string, unknown>)) {
    if (skill && isSeenRing(ring)) seen[skill] = { level: ring.level, fill: ring.fill }
  }
  return { version: 1, seen }
}

export function writePathMemory(memory: PathMemory): boolean {
  return safeWrite(PATH_STORAGE_KEY, memory)
}

const NEW_SEEN: SeenRing = { level: 'new', fill: 0 }

function seenOf(memory: PathMemory, skill: string): SeenRing {
  return memory.seen[skill] ?? NEW_SEEN
}

function ringNow(rings: ReadonlyMap<string, SkillRingInfo>, skill: string): SeenRing {
  const r = rings.get(skill)
  return r ? { level: r.level, fill: r.fill } : NEW_SEEN
}

/**
 * The stops among `shown` whose level went up since the path last showed them, each with the ring it showed then
 * (where the celebration's sweep starts). None without a memory: the first visit on a device celebrates nothing.
 */
export function levelUps(memory: PathMemory | null, rings: ReadonlyMap<string, SkillRingInfo>, shown: readonly string[]): Map<string, SeenRing> {
  const out = new Map<string, SeenRing>()
  if (!memory) return out
  for (const skill of shown) {
    const before = seenOf(memory, skill)
    if (levelRank(ringNow(rings, skill).level) > levelRank(before.level)) out.set(skill, before)
  }
  return out
}

/**
 * The memory after the path showed `record`: those types keep their ring now, and every remembered type whose level
 * went down since is lowered (anywhere in any class). Without a memory, it starts from every ring now.
 */
export function memoryAfter(memory: PathMemory | null, rings: ReadonlyMap<string, SkillRingInfo>, record: readonly string[]): PathMemory {
  const seen: Record<string, SeenRing> = {}
  if (memory) {
    for (const [skill, before] of Object.entries(memory.seen)) {
      const now = ringNow(rings, skill)
      const kept = levelRank(now.level) < levelRank(before.level) ? now : before
      if (kept.level !== 'new') seen[skill] = kept
    }
  } else {
    for (const [skill, ring] of rings) if (ring.level !== 'new') seen[skill] = { level: ring.level, fill: ring.fill }
  }
  for (const skill of record) {
    const now = ringNow(rings, skill)
    if (now.level === 'new') delete seen[skill]
    else seen[skill] = now
  }
  return { version: 1, seen }
}

/** Read, update and write in one go (the path's visit, a celebration that just played). */
export function rememberPath(rings: ReadonlyMap<string, SkillRingInfo>, record: readonly string[]): void {
  writePathMemory(memoryAfter(readPathMemory(), rings, record))
}
