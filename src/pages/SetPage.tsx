import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { getCourse } from '@/content'
import { seedToBase36 } from '@/content/rng'
import {
  clearActiveSet,
  loadActiveSet,
  markSlotDone,
  nextInSet,
  noteSetAttempt,
  readyForResults,
  resumeSet,
  sameSetProblem,
  saveActiveSet,
  setFinished,
  showSetResults,
  skipInSet,
  type ActiveSet,
} from '@/session/activeSet'
import { setEndBreak } from '@/session/breaks'
import { setRewards, summarizeSet } from '@/session/summary'
import { useQuestNews } from '@/components/quests/useQuests'
import { useAttempt, useEvents, useRewards, useRewardsOn, useStore, type Ev } from '@/store'
import { ProblemView } from './Problem'
import { SetChromeProvider, type SetChrome } from './set/chrome'
import { SetDots } from '@/components/set/SetProgress'
import { SetSummary } from '@/components/set/SetSummary'
import { startSet, warnSetNotSaved } from './set/startSet'

/** Opened again (Resume on Home, a reload): past a problem she finished but did not leave with "Next in set". */
function openStoredSet(): ActiveSet | null {
  const stored = loadActiveSet()
  if (!stored) return null
  const resumed = resumeSet(stored)
  if (resumed !== stored) saveActiveSet(resumed)
  return resumed
}

function scrollToTop() {
  try {
    window.scrollTo(0, 0)
  } catch {
    /* jsdom has no layout */
  }
}

function finishedInLog(events: readonly Ev[], attemptId: string | null | undefined): boolean {
  return attemptId != null && events.some((e) => e.t === 'problem_done' && e.attemptId === attemptId)
}

/**
 * The set runner (route /set): the active set's problems one after another on the usual problem screen, then the
 * results. Leaving keeps the set (Home offers "Resume your set"). It does not know the screen size: the problem
 * screen shows the set's progress where it fits, and a phone shows the whole route full screen (App.tsx).
 */
export function SetPage() {
  const navigate = useNavigate()
  const [set, setSet] = useState<ActiveSet | null>(openStoredSet)
  const warned = useRef(false)

  const commit = useCallback((next: ActiveSet) => {
    if (!saveActiveSet(next) && !warned.current) {
      warned.current = true
      warnSetNotSaved()
    }
    setSet(next)
  }, [])

  if (!set) return <Navigate to="/" replace />

  if (setFinished(set)) {
    return (
      <SetResults
        set={set}
        onAnother={() => {
          // Starts something: never the set's break.
          const course = getCourse(set.courseId)
          const next = course ? startSet(course) : null
          if (!next) {
            clearActiveSet()
            navigate('/')
            return
          }
          setSet(next)
          scrollToTop()
        }}
        onDone={() => {
          clearActiveSet()
          navigate('/')
        }}
      />
    )
  }

  return <SetRun key={set.id} set={set} onSet={commit} />
}

function SetRun({ set, onSet }: { set: ActiveSet; onSet: (next: ActiveSet) => void }) {
  const attempt = useAttempt()
  const events = useEvents()
  const index = set.index
  const total = set.problems.length
  const problem = set.problems[index]!
  const last = index === total - 1
  const setRef = useRef(set)
  setRef.current = set
  const onSetRef = useRef(onSet)
  onSetRef.current = onSet
  /** One move per problem: a double tap on Next or Skip moves once. */
  const lock = useRef(false)
  /** "See results" runs the break once per set. */
  const breakTaken = useRef(false)
  // The finished problem stays on screen (its completion card or finish sheet). A problem that was already finished
  // when it was opened (a reload on the last one) shows a short card instead, so its problem does not start over.
  const shown = useRef<{ index: number; live: boolean }>({ index, live: set.status[index] === 'pending' })
  if (shown.current.index !== index) shown.current = { index, live: set.status[index] === 'pending' }

  useEffect(() => {
    lock.current = false
    scrollToTop()
  }, [index])

  // This problem's attempt belongs to the set; once the log says it is finished, so is the slot.
  useEffect(() => {
    let next = set
    if (attempt && set.status[index] === 'pending' && sameSetProblem(attempt, problem)) next = noteSetAttempt(next, index, attempt.id)
    if (next.status[index] === 'pending' && finishedInLog(events, next.attemptIds[index])) next = markSlotDone(next, index)
    if (next !== set) onSet(next)
  }, [attempt, events, set, problem, index, onSet])

  const next = useCallback(() => {
    if (lock.current) return
    const prev = setRef.current
    if (prev.index >= prev.problems.length - 1) return
    lock.current = true
    onSetRef.current(nextInSet(prev))
  }, [])

  const skip = useCallback(() => {
    if (lock.current) return
    const prev = setRef.current
    if (prev.index >= prev.problems.length || prev.status[prev.index] !== 'pending') return
    lock.current = true
    let next = prev
    const store = useStore.getState()
    const live = store.attempt
    if (live && sameSetProblem(live, prev.problems[prev.index]!)) {
      next = noteSetAttempt(next, prev.index, live.id)
      // Work in it is left as unfinished (as when another problem starts); a problem she only opened leaves no trace.
      store.leaveAttempt()
    }
    onSetRef.current(skipInSet(next))
  }, [])

  const seeResults = useCallback(() => {
    if (breakTaken.current) return
    let prev = setRef.current
    if (prev.status[prev.index] === 'pending' && finishedInLog(useStore.getState().events, prev.attemptIds[prev.index])) {
      prev = markSlotDone(prev, prev.index)
    }
    if (!readyForResults(prev)) return
    breakTaken.current = true
    const ready = prev
    // The set's one break (session/breaks.ts): the store app's announced ad, or straight to the results here. The set's
    // end goes into the log with the results, after the break (the daily quests read it, and the chest it may earn is
    // opened on the results: an ad never comes between her tap on a chest and its reward).
    setEndBreak(() => {
      useStore.getState().noteSetDone({
        setId: ready.id,
        done: ready.attemptIds.filter((id, i): id is string => id !== null && ready.status[i] === 'done'),
        skipped: ready.status.filter((st) => st === 'skipped').length,
      })
      onSetRef.current(showSetResults(ready))
    }, { timed: ready.timed })
  }, [])

  const chrome = useMemo<SetChrome>(
    () => ({
      index,
      total,
      status: set.status,
      attemptIds: set.attemptIds,
      nextLabel: last ? 'See results' : 'Next in set',
      onNext: last ? seeResults : next,
      onSkip: skip,
    }),
    [index, total, set.status, set.attemptIds, last, seeResults, next, skip],
  )

  const status = set.status[index]
  if (status === 'skipped' || (status === 'done' && !shown.current.live)) return <SettledSlot set={set} chrome={chrome} />

  return (
    <SetChromeProvider value={chrome}>
      <ProblemView
        key={`${set.id}:${index}`}
        moduleId={problem.moduleId}
        templateId={problem.templateId}
        seed={seedToBase36(problem.seed)}
        flags={problem.flags}
      />
    </SetChromeProvider>
  )
}

/** The last problem, already settled when the set was opened (finished before a reload, or skipped): its button. */
function SettledSlot({ set, chrome }: { set: ActiveSet; chrome: SetChrome }) {
  const skipped = set.status[set.index] === 'skipped'
  const last = set.index === set.problems.length - 1
  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          aria-label="Close, back to Home. Your set is kept."
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-navy hover:bg-navy-50"
        >
          <span aria-hidden className="text-2xl leading-none">
            ×
          </span>
        </Link>
        <SetDots index={set.index} total={set.problems.length} status={set.status} prefix="Your set ·" />
      </div>
      <section aria-labelledby="set-settled-title" className="space-y-3 rounded-2xl border border-navy-100 bg-white p-4">
        <h1 id="set-settled-title" className="text-xl font-semibold text-navy">
          {skipped ? (
            'Skipped'
          ) : (
            <>
              <span aria-hidden>✓ </span>Problem finished
            </>
          )}
        </h1>
        <p className="text-navy">
          {skipped ? 'It counts as skipped, not as wrong.' : 'Your work on it is saved with the set.'}
          {last ? ' That was the last problem in your set.' : ''}
        </p>
        <button type="button" onClick={chrome.onNext} className="btn-chunky min-h-14 w-full rounded-2xl bg-navy px-4 text-lg font-semibold text-white hover:bg-navy-600">
          {chrome.nextLabel}
        </button>
      </section>
    </div>
  )
}

function SetResults({ set, onAnother, onDone }: { set: ActiveSet; onAnother: () => void; onDone: () => void }) {
  const events = useEvents()
  const rewardsOn = useRewardsOn()
  const view = useRewards()
  const lines = useMemo(() => summarizeSet(set, events), [set, events])
  const rewards = useMemo(() => (rewardsOn ? setRewards(set, events, view.awards, view.today.day) : null), [rewardsOn, set, events, view.awards, view.today.day])
  // With rewards on: what the set did to today's quests, and the chest (it waits here, after the set's break).
  const attempts = useMemo(() => set.attemptIds.filter((id): id is string => id !== null), [set.attemptIds])
  const quests = useQuestNews(rewardsOn ? attempts : null, set.id)
  return (
    <SetSummary
      lines={lines}
      rewards={rewards}
      today={rewardsOn ? view.today : null}
      quests={quests}
      setId={set.id}
      onAnother={onAnother}
      onDone={onDone}
    />
  )
}

export default SetPage
