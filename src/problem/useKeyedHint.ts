import { useCallback } from 'react'
import { useStore, type Attempt } from '@/store'

/**
 * A two-rung hint ladder (nudge, rule card) for phases without a step column — number-line
 * answers, the one-to-one verdict, the twin / check-it cards. Rungs are recorded with the store's
 * hint action under `key` (a step index; negative keys for phases outside the column) so hints
 * still count toward mastery.
 */
export function useKeyedHint(attempt: Attempt | null, key: number, disabled: boolean): { rung: 0 | 1 | 2 | 3; advance: () => void } {
  const rung = (attempt?.hintsUsed[String(key)] ?? 0) as 0 | 1 | 2 | 3
  const advance = useCallback(() => {
    if (disabled) return
    const s = useStore.getState()
    if (!s.attempt) return
    const cur = s.attempt.hintsUsed[String(key)] ?? 0
    if (cur >= 2) return
    s.useHint(key, (cur + 1) as 1 | 2)
  }, [disabled, key])
  return { rung, advance }
}
