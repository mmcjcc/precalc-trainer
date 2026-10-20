import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProblemInstance } from '@/content/types'
import { attemptTouched, mastery, useStore, type Attempt, type ProblemSummary } from '@/store'
import { attemptResolves } from './attemptResolves'
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
 * She opened a problem while another one has her work in it. The page asks in its own sheet (no system dialog):
 * `leave` abandons the other problem (it counts as unfinished) and starts this one; `stay` goes back to it.
 */
export interface LeaveQuestion {
  /** The problem with her work in it. */
  attempt: Attempt
  leave: () => void
  stay: () => void
}

export interface AttemptLifecycle {
  /** This page's attempt, or null while none is open (or while the leave question waits for her). */
  attempt: Attempt | null
  /** Set while the page is asking whether to leave the other problem; the page shows it (LeaveProblemSheet). */
  leaveQuestion: LeaveQuestion | null
}

/**
 * Attempt lifecycle (UX-11): on entering a problem route, resume the stored attempt when it is for
 * this problem (id and difficulty flags); otherwise start a fresh one. When a different problem is
 * unfinished and has her work in it, ask first — "Leave" abandons it, "Back to it" navigates back to it.
 * A problem she only opened is left without a word. A stored attempt for this same URL whose problem id
 * differs (the generator was updated) is not asked about: it is abandoned with a toast and the problem
 * starts fresh. `active` = false once the problem is finished so no new attempt starts on the same URL.
 */
export function useAttemptLifecycle(instance: ProblemInstance, flags: string, active: boolean): AttemptLifecycle {
  const navigate = useNavigate()
  const attempt = useStore((s) => s.attempt)
  /** The other problem she is being asked about, keyed by this page's problem (one question per page). */
  const [asking, setAsking] = useState<{ key: string; attempt: Attempt } | null>(null)

  const start = useCallback(() => {
    useStore.getState().startAttempt({
      problemId: instance.id,
      moduleId: instance.moduleId,
      templateId: instance.templateId,
      skill: instance.skill,
      seed: (instance.seed >>> 0).toString(36),
      difficulty: flags,
      genVersion: instance.genVersion,
    })
  }, [instance, flags])

  useEffect(() => {
    if (!active) return
    const s = useStore.getState()
    const current = s.attempt
    if (current && isFor(current, instance, flags)) return
    if (current && sameRoute(current, instance, flags)) {
      // Her link now generates a different problem: the old lines would not match it.
      start() // records problem_abandoned for the stale attempt
      s.toast('This problem was updated, so it starts fresh', {
        tone: 'info',
        detail: 'The lines you saved were for the older version of this problem, so they would not fit the new one.',
      })
      return
    }
    // A saved attempt whose problem this build cannot open (a module or template renamed or retired): "Back to it"
    // would only bounce Home, so it does not ask. This problem replaces it; her events stay (attemptResolves.ts).
    if (current && !attemptResolves(current)) {
      start()
      return
    }
    // A problem she only opened is left without a word; only one with her work in it asks first.
    if (current && attemptTouched(current, s.events)) {
      const key = `${instance.id}?${flags}`
      // Asked once per page: a second run of this effect (React's strict mode) finds the question already up.
      setAsking((q) => (q?.key === key ? q : { key, attempt: current }))
      return
    }
    start()
  }, [instance, flags, active, start])

  const leaveQuestion = useMemo<LeaveQuestion | null>(() => {
    if (!asking) return null
    const other = asking.attempt
    return {
      attempt: other,
      leave: () => {
        setAsking(null)
        start() // records problem_abandoned for the other attempt
      },
      stay: () => {
        setAsking(null)
        // A different route: the stored problem's page mounts fresh and resumes (or, if its generator
        // changed, starts fresh via the branch above) — never a dead page.
        navigate(problemPath(other.moduleId, other.templateId, other.seed, other.difficulty), { replace: true })
      },
    }
  }, [asking, start, navigate])

  return { attempt: attempt && isFor(attempt, instance, flags) ? attempt : null, leaveQuestion }
}

export interface Completion {
  summary: ProblemSummary
  newlyMastered: boolean
}

/** A completion card on the page (ProblemFrame marks it); it says everything the toast would. */
function completionCardShown(): boolean {
  return typeof document !== 'undefined' && document.querySelector('[data-completion-card]') !== null
}

/** The completion in words: the toast's message and detail, and what the card's live region says. */
export function completionWords(summary: ProblemSummary, newlyMastered: boolean, templateTitle: string): { message: string; detail: string } {
  const hints = summary.hints === 1 ? '1 hint' : `${summary.hints} hints`
  const work = summary.steps > 0 ? `${summary.steps} steps, ${summary.firstTry} first-try, ` : ''
  return {
    message: summary.finalCorrect ? 'Problem complete' : 'Problem finished',
    detail: `${work}${hints}${newlyMastered ? ` — ${templateTitle} newly mastered` : ''}`,
  }
}

/**
 * Finish the current attempt; reports whether the skill just became mastered. The completion card says the
 * problem is done, so the completion toast appears only where no card shows. Whether the final answer counts
 * as correct is decided by the attempt (any wrong final answer, verdict or check makes it "Problem finished").
 * `takeSecs` hands over the active seconds not yet added to the attempt (see useActiveClock).
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
  /** The toast for the finish just made, shown after the render that would put a completion card on the page. */
  const pendingToast = useRef<(() => void) | null>(null)

  useEffect(() => {
    const show = pendingToast.current
    pendingToast.current = null
    if (show && !completionCardShown()) show()
  }, [completion])

  const finish = () => {
    const store = useStore.getState()
    if (!store.attempt) return
    const before = mastery(store.events, instance.skill).mastered
    const summary = store.finishAttempt({ secs: takeSecs?.() ?? 0 })
    if (!summary) return
    const after = mastery(useStore.getState().events, instance.skill).mastered
    const newlyMastered = after && !before
    const { message, detail } = completionWords(summary, newlyMastered, templateTitle)
    pendingToast.current = () => useStore.getState().toast(message, { tone: summary.finalCorrect ? 'ok' : 'info', detail })
    setCompletion({ summary, newlyMastered })
  }
  return { completion, finish }
}
