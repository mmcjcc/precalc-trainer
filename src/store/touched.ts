import type { Attempt, Ev } from './types'

/**
 * Has she done anything on this attempt: a line, a part answered, a hint, a rejected try, a draft? An
 * attempt she only opened is not an attempt: leaving it records nothing and asks nothing.
 */
export function attemptTouched(attempt: Attempt, events: readonly Ev[]): boolean {
  return (
    attempt.steps.length > 0 ||
    Object.keys(attempt.hintsUsed).length > 0 ||
    attempt.draft.trim() !== '' ||
    attempt.currentRejections > 0 ||
    Object.values(attempt.rejectionsByIdx ?? {}).some((n) => n > 0) ||
    attempt.final !== undefined ||
    events.some((e) => 'attemptId' in e && e.attemptId === attempt.id)
  )
}
