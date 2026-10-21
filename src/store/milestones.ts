/**
 * Streak milestones (docs/progress/phone-juice.md): the first time her goal streak reaches 7, 30 and 100 days, a
 * one-time celebration. The ones already celebrated are kept in the rewards' slice (`RewardsState.milestones`, in
 * backups), so a celebration never repeats: not after a streak breaks and is built again, not after a reload, not on
 * another device that imported the backup. Pure.
 */

export const STREAK_MILESTONES: readonly number[] = [7, 30, 100]

/**
 * The milestone a streak just reached, going from `before` to `after` days: the highest one crossed that was never
 * celebrated, or null. A streak that was already past a milestone (an existing streak, an import) crosses nothing.
 */
export function milestoneReached(before: number, after: number, celebrated: readonly number[] = []): number | null {
  let out: number | null = null
  for (const m of STREAK_MILESTONES) if (before < m && after >= m && !celebrated.includes(m)) out = m
  return out
}

/** Every milestone a streak of `days` has reached (the lower ones count as celebrated with the highest). */
export function milestonesThrough(days: number): number[] {
  return STREAK_MILESTONES.filter((m) => days >= m)
}

/** The celebrated milestones, sorted, each once: `a` and `b` together. */
export function mergeMilestones(a: readonly number[] | undefined, b: readonly number[] | undefined): number[] {
  return [...new Set([...(a ?? []), ...(b ?? [])])].filter((m) => STREAK_MILESTONES.includes(m)).sort((x, y) => x - y)
}

/** From storage or a backup: known milestones only; undefined when there are none. */
export function normalizeMilestones(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = mergeMilestones(raw.filter((m): m is number => typeof m === 'number'), [])
  return out.length > 0 ? out : undefined
}
