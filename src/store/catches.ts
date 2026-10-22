/**
 * Mistake Monsters' catches (docs/progress/phone-monsters.md): the first time she makes a mistake she has never made
 * before, the verdict shows its monster, caught. Which mistakes have had that moment is kept in the rewards' slice
 * (`RewardsState.caught`, in backups, like the streak milestones), so it never comes twice: not after a reload, not on
 * another device that imported the backup. A mistake she made before the monsters existed (it is in her log or in the
 * folded cards) counts as caught already. Pure.
 */
import type { Ev, RewardsState } from './types'

/** The catalog pattern an event names as her mistake: a rejected line or a wrong check that names one. */
export function namedPattern(e: Ev): string | null {
  if (e.t === 'step_rejected' && e.pattern) return e.pattern
  if (e.t === 'final_answer' && !e.correct && e.pattern) return e.pattern
  return null
}

/** Every mistake she has caught: named in the log, in the cards folded from older events, or in the memory. */
export function caughtPatterns(events: readonly Ev[], rewards: Pick<RewardsState, 'cards' | 'caught'>): Set<string> {
  const out = new Set<string>(rewards.caught ?? [])
  for (const card of Object.values(rewards.cards)) out.add(card.pattern)
  for (const e of events) {
    const p = namedPattern(e)
    if (p) out.add(p)
  }
  return out
}

/** The mistakes `added` names for the first time ever (log order, each once), given the state before them. */
export function firstCatches(added: readonly Ev[], before: { events: readonly Ev[]; rewards: Pick<RewardsState, 'cards' | 'caught'> }): string[] {
  const seen = caughtPatterns(before.events, before.rewards)
  const out: string[] = []
  for (const e of added) {
    const p = namedPattern(e)
    if (!p || seen.has(p)) continue
    seen.add(p)
    out.push(p)
  }
  return out
}

/** The remembered catches, sorted, each once: `a` and `b` together. */
export function mergeCatches(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])].filter((p) => p.length > 0).sort()
}

/** From storage or a backup: strings only; undefined when there are none. */
export function normalizeCatches(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = mergeCatches(
    raw.filter((p): p is string => typeof p === 'string'),
    [],
  )
  return out.length > 0 ? out : undefined
}
