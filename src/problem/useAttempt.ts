import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProblemInstance } from '@/content/types'
import { mastery, useStore, type Attempt, type ProblemSummary } from '@/store'
import { problemPath } from './url'

/** The stored attempt belongs to this page: same problem id AND same difficulty flags. */
function isFor(attempt: Attempt, instance: ProblemInstance, flags: string): boolean {
  return attempt.problemId === instance.id && attempt.difficulty === flags
}

/** The stored attempt was opened from this very URL (module, template, seed, flags). */
function sameRoute(attempt: Attempt, instance: ProblemInstance, flags: string): boolean {
  return (
    attempt.moduleId === instance.moduleId &&
    attempt.templateId === instance.templateId &&
    attempt.seed === (instance.seed >>> 0).toString(36) &&
    attempt.difficulty === flags
  )
}

/**
 * Attempt lifecycle (UX-11): on entering a problem route, resume the stored attempt when it is for
 * this problem (id and difficulty flags); otherwise start a fresh one. When a different problem is
 * unfinished, confirm first — "Leave" abandons it, "Cancel" navigates back to it. A stored attempt
 * for this same URL whose problem id differs (the generator was updated) is not asked about: it is
 * abandoned with a toast and the problem starts fresh. `active` = false once the problem is finished
 * so no new attempt starts on the same URL.
 */
export function useAttemptLifecycle(instance: ProblemInstance, flags: string, active: boolean): Attempt | null {
  const navigate = useNavigate()
  const attempt = useStore((s) => s.attempt)
  const asked = useRef<string | null>(null)

  useEffect(() => {
    if (!active) return
    const s = useStore.getState()
    const current = s.attempt
    if (current && isFor(current, instance, flags)) return
    const start = () =>
      s.startAttempt({
        problemId: instance.id,
        moduleId: instance.moduleId,
        templateId: instance.templateId,
        skill: instance.skill,
        seed: (instance.seed >>> 0).toString(36),
        difficulty: flags,
        genVersion: instance.genVersion,
      })
    if (current && sameRoute(current, instance, flags)) {
      // Her link now generates a different problem: the old lines would not match it.
      start() // records problem_abandoned for the stale attempt
      s.toast('This problem was updated, so it starts fresh', {
        tone: 'info',
        detail: 'The lines you saved were for the older version of this problem, so they would not fit the new one.',
      })
      return
    }
    const askKey = `${instance.id}?${flags}`
    if (current && asked.current !== askKey) {
      asked.current = askKey
      const leave = typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Leave the problem you were working on? It will count as unfinished.')
        : true
      if (!leave) {
        // A different route: the stored problem's page mounts fresh and resumes (or, if its generator
        // changed, starts fresh via the branch above) — never a dead page.
        navigate(problemPath(current.moduleId, current.templateId, current.seed, current.difficulty), { replace: true })
        return
      }
    }
    start()
  }, [instance, flags, active, navigate])

  return attempt && isFor(attempt, instance, flags) ? attempt : null
}

export interface Completion {
  summary: ProblemSummary
  newlyMastered: boolean
}

/**
 * Finish the current attempt with a completion toast; reports whether the skill just became mastered.
 * Whether the final answer counts as correct is decided by the attempt (any wrong final answer,
 * verdict or check makes it "Problem finished"). `takeSecs` hands over the active seconds not yet
 * added to the attempt (see useActiveClock).
 */
export function useCompletion(
  instance: ProblemInstance,
  templateTitle: string,
  takeSecs?: () => number,
): {
  completion: Completion | null
  finish: () => void
} {
  const [completion, setCompletion] = useState<Completion | null>(null)
  const finish = () => {
    const store = useStore.getState()
    if (!store.attempt) return
    const before = mastery(store.events, instance.skill).mastered
    const summary = store.finishAttempt({ secs: takeSecs?.() ?? 0 })
    if (!summary) return
    const after = mastery(useStore.getState().events, instance.skill).mastered
    const newlyMastered = after && !before
    const hints = summary.hints === 1 ? '1 hint' : `${summary.hints} hints`
    const work = summary.steps > 0 ? `${summary.steps} steps, ${summary.firstTry} first-try, ` : ''
    const detail = `${work}${hints}${newlyMastered ? ` — ${templateTitle} newly mastered` : ''}`
    store.toast(summary.finalCorrect ? 'Problem complete' : 'Problem finished', { tone: summary.finalCorrect ? 'ok' : 'info', detail })
    setCompletion({ summary, newlyMastered })
  }
  return { completion, finish }
}
