import { useCallback, useMemo } from 'react'
import { generateProblem, getModule, getTemplate, hasModule } from '@/content'
import type { Attempt } from '@/store'
import type { LeaveQuestion } from '@/problem/useAttempt'
import { knobsFromFlags, parseSeedParam } from '@/problem/url'
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
      where = `${mod.title} · ${getTemplate(attempt.moduleId, attempt.templateId).title}`
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

/**
 * Leaving a problem with her work in it, asked in the app's own sheet (not a system dialog). The problem it is
 * about is shown first, so "this problem" is the one she worked on, not the page behind the sheet. Closing the
 * sheet any other way (Esc, the backdrop, ×) is "Back to it", as Cancel was for the old dialog: nothing is lost.
 */
export function LeaveProblemSheet({ question }: { question: LeaveQuestion | null }) {
  const other = useMemo(() => (question ? describe(question.attempt) : null), [question])
  // Stable while the sheet is open (the sheet re-runs its focus handling when onClose changes).
  const close = useCallback(() => question?.stay(), [question])
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
          <p>You have work on this problem. Leave it? It will count as unfinished.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={question.stay} className="min-h-11 flex-1 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
              Back to it
            </button>
            <button
              type="button"
              onClick={question.leave}
              className="min-h-11 flex-1 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
            >
              Leave
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
