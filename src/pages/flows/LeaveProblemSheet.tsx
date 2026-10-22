import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateProblem, getModule, getTemplate, hasModule } from '@/content'
import { ownProblemFromRoute } from '@/content/own'
import type { Attempt } from '@/store'
import type { LeaveQuestion } from '@/problem/useAttempt'
import { knobsFromFlags, parseSeedParam } from '@/problem/url'
import { currentSlotOf, loadActiveSet, noteSetAttempt, saveActiveSet, skipInSet } from '@/session/activeSet'
import { BottomSheet } from '@/components/BottomSheet'
import { Katex } from '@/components/Katex'
import { pinnedSummary, type PinnedSummary } from './PinnedProblem'

interface OtherProblem {
  /** "Inequalities · Linear inequality". */
  where: string
  title: string | null
  summary: PinnedSummary | null
}

/** Which problem has her work in it: its module and template, and its statement when it still generates the same. */
function describe(attempt: Attempt): OtherProblem {
  let where = ''
  let title: string | null = null
  let summary: PinnedSummary | null = null
  try {
    if (hasModule(attempt.moduleId)) {
      const mod = getModule(attempt.moduleId)
      where = `${mod.title} · ${attempt.own !== undefined ? 'Your own problem' : getTemplate(attempt.moduleId, attempt.templateId).title}`
    }
    if (attempt.own !== undefined) {
      // Her own problem: rebuilt from her statement, as its route does.
      const r = ownProblemFromRoute(attempt.moduleId, attempt.templateId, attempt.own)
      if (r.ok && r.instance.id === attempt.problemId) {
        title = r.instance.title
        summary = pinnedSummary(r.instance.statementText, r.instance.vars)
      }
      return { where, title, summary }
    }
    const seed = parseSeedParam(attempt.seed)
    if (seed !== null && hasModule(attempt.moduleId)) {
      const instance = generateProblem(attempt.moduleId, attempt.templateId, seed, knobsFromFlags(attempt.difficulty))
      // An updated generator makes a different problem from the same link: then only its name is shown.
      if (instance.id === attempt.problemId) {
        title = instance.title
        summary = pinnedSummary(instance.statementText, instance.vars)
      }
    }
  } catch {
    /* a template that no longer exists: the sentence alone */
  }
  return { where, title, summary }
}

/** Where the problem sits in the active set, when it is the set problem she is on (pages/SetPage.tsx). */
function setSlotOf(attempt: Attempt): { position: number; total: number } | null {
  const set = loadActiveSet()
  const i = set ? currentSlotOf(set, attempt) : null
  return set && i !== null ? { position: i + 1, total: set.problems.length } : null
}

/** "Skip it": the set counts the problem as skipped and goes on; `leave()` then leaves her attempt as unfinished. */
function skipInActiveSet(attempt: Attempt): void {
  const set = loadActiveSet()
  const i = set ? currentSlotOf(set, attempt) : null
  if (set && i !== null) saveActiveSet(skipInSet(noteSetAttempt(set, i, attempt.id)))
}

/**
 * Leaving a problem with her work in it, asked in the app's own sheet (not a system dialog). The problem it is
 * about is shown first, so "this problem" is the one she worked on, not the page behind the sheet. Closing the
 * sheet any other way (Esc, the backdrop, ×) is "Back to it", as Cancel was for the old dialog: nothing is lost.
 * When that problem is the one she is on in her set, "Back to it" goes back to the set, and "Skip it" skips it there
 * (it counts as skipped, not as wrong).
 */
export function LeaveProblemSheet({ question }: { question: LeaveQuestion | null }) {
  const navigate = useNavigate()
  const other = useMemo(() => (question ? describe(question.attempt) : null), [question])
  const inSet = useMemo(() => (question ? setSlotOf(question.attempt) : null), [question])
  // Stable while the sheet is open (the sheet re-runs its focus handling when onClose changes).
  const close = useCallback(() => {
    if (inSet) navigate('/set', { replace: true })
    else question?.stay()
  }, [question, inSet, navigate])
  const leave = useCallback(() => {
    if (!question) return
    if (inSet) skipInActiveSet(question.attempt)
    question.leave()
  }, [question, inSet])
  return (
    <BottomSheet open={question !== null} onClose={close} title="Unfinished problem">
      {question && other && (
        <div className="space-y-3 text-navy">
          {(other.title || other.where) && (
            <div className="rounded-2xl bg-gold-100 px-4 py-3">
              {other.where && <p className="text-xs font-semibold uppercase tracking-wide text-navy/70">{other.where}</p>}
              {other.title && <p className="font-semibold">{other.title}</p>}
              {other.summary && <p className="mt-1 truncate text-sm">{other.summary.tex ? <Katex tex={other.summary.tex} /> : other.summary.text}</p>}
            </div>
          )}
          {inSet ? (
            <p>
              You have work on this problem, problem {inSet.position} of {inSet.total} in your set. Skip it? It counts as skipped in
              your set, not as wrong.
            </p>
          ) : (
            <p>You have work on this problem. Leave it? It will count as unfinished.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={close} className="min-h-11 flex-1 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
              Back to it
            </button>
            <button
              type="button"
              onClick={leave}
              className="min-h-11 flex-1 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
            >
              {inSet ? 'Skip it' : 'Leave'}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
