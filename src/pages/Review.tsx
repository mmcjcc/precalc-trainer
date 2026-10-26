import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DEFAULT_REVIEW_COUNT,
  getReview,
  resolveReview,
  REVIEW_COUNTS,
  SAT_DOMAIN_REVIEW_COUNT,
  type ReviewDef,
} from '@/content'
import { seedToBase36 } from '@/content/rng'
import { useFullScreenPage } from '@/components/appChrome'
import { useAttempt, useEvents, useSettings, useStore, type Attempt } from '@/store'
import { ReviewChromeProvider } from './review/chrome'
import {
  advanceReview,
  clearReview,
  createReviewSession,
  formatClock,
  formatDuration,
  loadReview,
  noteAttempt,
  SAT_FULL_MODULE_COUNT,
  SAT_FULL_MODULE_MINUTES,
  satTimerMinutes,
  satTimerSeconds,
  saveReview,
  summarizeReview,
  summarizeSatDomains,
  weakestSatDomain,
  type DomainSummaryLine,
  type ReviewProblem,
  type ReviewSession,
  type TopicSummaryLine,
} from './review/session'

export { createReviewSession }

const ProblemView = lazy(() => import('./Problem').then((m) => ({ default: m.ProblemView })))

function sameProblem(attempt: Attempt, problem: ReviewProblem): boolean {
  return (
    attempt.moduleId === problem.moduleId &&
    attempt.templateId === problem.templateId &&
    attempt.seed === seedToBase36(problem.seed) &&
    attempt.difficulty === ''
  )
}

export function ReviewPage() {
  const { reviewId = '' } = useParams()
  const review = getReview(reviewId)
  const [session, setSession] = useState<ReviewSession | null>(() => (review ? loadReview(review.id) : null))
  const warned = useRef(false)
  const seenId = useRef(reviewId)
  if (seenId.current !== reviewId) {
    seenId.current = reviewId
    setSession(review ? loadReview(review.id) : null)
  }

  useEffect(() => {
    // Only while the set is open: the summary must not switch test mode back on.
    if (!session || session.index >= session.problems.length) return
    if (useStore.getState().settings.testMode !== session.timed) {
      useStore.getState().setSettings({ testMode: session.timed })
    }
  }, [session])

  if (!review) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold text-navy">No review by that name</h1>
        <p className="text-navy/80">The Unit 1 set is the one that's ready.</p>
        <Link to="/review/unit1" className="inline-flex min-h-11 items-center font-semibold text-navy underline">
          Unit 1 review
        </Link>
      </div>
    )
  }

  function commit(next: ReviewSession | null) {
    // The set just ended: put test mode back, so later practice counts toward mastery again.
    const wasOpen = session !== null && session.index < session.problems.length
    if (next && wasOpen && next.index >= next.problems.length && typeof next.testModeBefore === 'boolean') {
      useStore.getState().setSettings({ testMode: next.testModeBefore })
    }
    if (next) {
      const ok = saveReview(next)
      if (!ok && !warned.current) {
        warned.current = true
        useStore.getState().toast('This review could not be saved on this device.', {
          tone: 'bad',
          detail: 'It will keep going until you leave this page, but a reload will not bring it back.',
        })
      }
    } else {
      clearReview(review!.id)
    }
    setSession(next)
  }

  if (!session) return <StartScreen review={review} onStart={commit} />
  if (session.index >= session.problems.length) {
    return <SummaryScreen review={review} session={session} onAgain={() => commit(null)} onSwitchSession={setSession} />
  }
  return <InProgress review={review} session={session} onSession={commit} />
}

function StartScreen({ review, onStart }: { review: ReviewDef; onStart: (session: ReviewSession) => void }) {
  const settings = useSettings()
  const counts = review.counts ?? REVIEW_COUNTS
  const [count, setCount] = useState<number>(review.defaultCount ?? DEFAULT_REVIEW_COUNT)
  const [timed, setTimed] = useState(settings.testMode)
  const topics = useMemo(() => resolveReview(review), [review])
  const titleId = useId()
  const coversAll = count >= topics.length
  const isSat = Boolean(review.satKind)
  const targetMins = satTimerMinutes(count)

  function start() {
    const testModeBefore = useStore.getState().settings.testMode
    useStore.getState().setSettings({ testMode: timed })
    onStart(createReviewSession(review.id, { count, timed, testModeBefore }))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-coral-700">For the test</p>
        <h1 id={titleId} className="text-3xl font-semibold text-navy">
          {review.title}
        </h1>
        <p className="text-navy/80">
          {review.satKind === 'sat-mixed'
            ? 'Problems are drawn from all four SAT Math domains weighted like the test (35% Algebra, 35% Advanced Math, 15% Problem-Solving and Data Analysis, 15% Geometry and Trigonometry), with at least one problem from each domain.'
            : review.satKind === 'sat-domain'
              ? `${count} problems drawn from this domain's mapped problem types, leaning toward ones you've missed or haven't tried.`
              : coversAll
                ? `Every topic comes up at least once (${topics.length} topics). Extra problems lean toward ones you've missed or haven't tried.`
                : `${count} problems can't cover all ${topics.length} topics, so this set picks ${count} of them, leaning toward ones you've missed or haven't tried.`}
        </p>
      </header>

      <section aria-labelledby={titleId} className="space-y-4 rounded-2xl border border-navy-100 bg-white p-4">
        <fieldset>
          <legend className="text-sm font-semibold text-navy">How many problems</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {counts.map((n) => {
              const checked = count === n
              return (
                <label
                  key={n}
                  className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl px-4 text-lg font-semibold ${
                    checked ? 'bg-navy text-white' : 'border border-navy-100 bg-white text-navy hover:bg-navy-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="review-count"
                    value={n}
                    checked={checked}
                    onChange={() => setCount(n)}
                    className="sr-only"
                  />
                  {n}
                </label>
              )
            })}
          </div>
        </fieldset>

        <div className="flex items-start justify-between gap-4 border-t border-navy-100 pt-3">
          <div className="min-w-0">
            <p id="review-timed-label" className="font-semibold text-navy">
              Timed
            </p>
            <p id="review-timed-desc" className="mt-0.5 text-sm text-navy/80">
              {isSat
                ? `${targetMins} minutes for ${count} problems${count < SAT_FULL_MODULE_COUNT ? `, scaled from the test's ${SAT_FULL_MODULE_MINUTES} minutes for ${SAT_FULL_MODULE_COUNT}` : ', as on the test'}. The timer only shows the time; it never stops you.`
                : 'Turns on test mode for these problems: a timer you can pause, and the set stays out of your mastery bars. Same switch as Settings.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={timed}
            aria-labelledby="review-timed-label"
            aria-describedby="review-timed-desc"
            onClick={() => setTimed((v) => !v)}
            className={`min-h-11 min-w-20 shrink-0 rounded-full px-3 text-sm font-semibold ${
              timed ? 'bg-navy text-white hover:bg-navy-600' : 'border-2 border-navy-100 bg-white text-navy hover:bg-navy-50'
            }`}
          >
            {timed ? (
              <>
                <span aria-hidden>✓ </span>On
              </>
            ) : (
              'Off'
            )}
          </button>
        </div>

        <button type="button" onClick={start} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
          Start the set
        </button>
      </section>
    </div>
  )
}

function Bar({
  index,
  total,
  finished,
  timed,
  isSat,
  elapsedSecs,
  onNext,
  onSkip,
}: {
  index: number
  total: number
  finished: boolean
  timed: boolean
  isSat: boolean
  elapsedSecs: number
  onNext: () => void
  onSkip: () => void
}) {
  const targetSecs = satTimerSeconds(total)
  const targetMins = satTimerMinutes(total)
  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-navy-100 bg-white px-4 py-2">
      <p className="font-semibold text-navy" aria-live="polite">
        Problem {index + 1} of {total}
      </p>
      {timed && isSat && (
        <p
          role="timer"
          aria-label="Set timer"
          data-testid="sat-timer"
          className="rounded-lg bg-navy-50 px-2.5 py-1 text-sm font-semibold text-navy"
        >
          {formatClock(elapsedSecs)} / {formatClock(targetSecs)} ({targetMins} min — timer only shows the time, never stops you)
        </p>
      )}
      {finished ? (
        <button type="button" onClick={onNext} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
          Next
        </button>
      ) : (
        <button
          type="button"
          onClick={onSkip}
          className="min-h-11 rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
        >
          Skip
        </button>
      )}
    </div>
  )
}

function InProgress({
  review,
  session,
  onSession,
}: {
  review: ReviewDef
  session: ReviewSession
  onSession: (next: ReviewSession) => void
}) {
  // A running set: on a phone, full screen (no tab bar, no top navigation), its own bar on top.
  useFullScreenPage()
  const attempt = useAttempt()
  const events = useEvents()
  const index = session.index
  const problem = session.problems[index]!
  const [elapsedSecs, setElapsedSecs] = useState<number>(session.elapsedSecs ?? 0)
  const elapsedRef = useRef(elapsedSecs)
  elapsedRef.current = elapsedSecs
  const sessionRef = useRef(session)
  sessionRef.current = session
  const onSessionRef = useRef(onSession)
  onSessionRef.current = onSession
  const lock = useRef(false)
  // Keep the finished work on screen. A reload of an already-finished slot shows a short note
  // instead, so the problem view does not start that problem over.
  const shown = useRef<{ index: number; live: boolean }>({ index, live: session.status[index] !== 'done' })
  if (shown.current.index !== index) shown.current = { index, live: session.status[index] !== 'done' }

  useEffect(() => {
    if (!session.timed) return
    const id = window.setInterval(() => {
      setElapsedSecs((s) => s + 1)
    }, 1000)
    return () => window.clearInterval(id)
  }, [session.timed])

  useEffect(() => {
    lock.current = false
  }, [index])

  useEffect(() => {
    try {
      window.scrollTo(0, 0)
    } catch {
      /* jsdom has no layout */
    }
  }, [index])

  useEffect(() => {
    if (session.index >= session.problems.length) return
    let next = session
    const current = session.problems[session.index]!
    if (attempt && sameProblem(attempt, current)) next = noteAttempt(next, session.index, attempt.id)
    const id = next.attemptIds[session.index]
    if (id && next.status[session.index] !== 'done' && events.some((e) => e.t === 'problem_done' && e.attemptId === id)) {
      const status = next.status.slice()
      status[session.index] = 'done'
      next = { ...next, status }
    }
    if (next !== session) onSession(next)
  }, [attempt, events, session, onSession])

  function go(outcome: 'done' | 'skipped') {
    if (lock.current) return
    const prev = sessionRef.current
    if (prev.index >= prev.problems.length) return
    lock.current = true
    let next: ReviewSession = { ...prev, elapsedSecs: elapsedRef.current }
    const live = useStore.getState().attempt
    const current = prev.problems[prev.index]!
    if (live && sameProblem(live, current)) {
      next = noteAttempt(next, prev.index, live.id)
      if (outcome === 'skipped') useStore.getState().abandonAttempt()
    }
    onSessionRef.current(advanceReview(next, outcome))
  }

  const attemptId = session.attemptIds[index]
  const finished =
    session.status[index] === 'done' ||
    (attemptId != null && events.some((e) => e.t === 'problem_done' && e.attemptId === attemptId))
  const chrome = { onNext: () => go('done'), onSkip: () => go('skipped') }

  return (
    <div className="space-y-4">
      <Bar
        index={index}
        total={session.problems.length}
        finished={finished}
        timed={session.timed}
        isSat={Boolean(review.satKind)}
        elapsedSecs={elapsedSecs}
        onNext={chrome.onNext}
        onSkip={chrome.onSkip}
      />
      {shown.current.live ? (
        <ReviewChromeProvider value={chrome}>
          <Suspense fallback={<p role="status" className="py-6 text-center text-navy/70">Loading…</p>}>
            <ProblemView
              key={`${index}:${problem.moduleId}/${problem.templateId}/${problem.seed}`}
              moduleId={problem.moduleId}
              templateId={problem.templateId}
              seed={seedToBase36(problem.seed)}
            />
          </Suspense>
        </ReviewChromeProvider>
      ) : (
        <section className="rounded-2xl border border-ok bg-ok-100 p-4">
          <h2 className="font-semibold text-navy">
            <span aria-hidden>✓ </span>This problem is already finished
          </h2>
          <p className="mt-1 text-sm text-navy">Your work on it is saved with the set. Next goes on to the following one.</p>
        </section>
      )}
    </div>
  )
}

function topicStat(line: TopicSummaryLine): string {
  if (line.finished === 0) return line.skipped === 1 ? '1 skipped' : `${line.skipped} skipped`
  const right = `${line.firstTryRight} of ${line.finished} right on the first try`
  return line.skipped > 0 ? `${right} · ${line.skipped} skipped` : right
}

function domainStat(line: DomainSummaryLine): string {
  const probLabel = `${line.problems} ${line.problems === 1 ? 'problem' : 'problems'}`
  const pct = Math.round(line.firstTryRate * 100)
  const rateLabel =
    line.finished > 0
      ? `${line.firstTryRight} of ${line.finished} right on the first try (${pct}%)`
      : '0 right on the first try (0%)'
  const skipLabel = line.skipped > 0 ? ` · ${line.skipped} skipped` : ''
  return `${probLabel} · ${rateLabel}${skipLabel} · Time: ${formatDuration(line.secs)}`
}

function SummaryScreen({
  review,
  session,
  onAgain,
  onSwitchSession,
}: {
  review: ReviewDef
  session: ReviewSession
  onAgain: () => void
  onSwitchSession: (next: ReviewSession) => void
}) {
  const events = useEvents()
  const navigate = useNavigate()
  const lines = useMemo(() => summarizeReview(session, events), [session, events])
  const domainLines = useMemo(
    () => (review.satKind ? summarizeSatDomains(session, events) : []),
    [review.satKind, session, events],
  )
  const weakest = useMemo(() => weakestSatDomain(domainLines), [domainLines])
  const titleId = useId()
  const domainHeadingId = useId()

  function practiceDomain(targetReviewId: string) {
    const next = createReviewSession(targetReviewId, {
      count: SAT_DOMAIN_REVIEW_COUNT,
      timed: false,
      testModeBefore: useStore.getState().settings.testMode,
    })
    saveReview(next)
    if (targetReviewId === review.id) {
      onSwitchSession(next)
    } else {
      navigate(`/review/${targetReviewId}`)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-coral-700">Set finished</p>
        <h1 id={titleId} className="text-3xl font-semibold text-navy">
          {review.title}
        </h1>
        <p className="text-navy/80">
          {session.timed
            ? 'These were timed, so they stay out of your mastery bars. First try means the answer was right with no rejection and nothing revealed.'
            : 'First try means the answer was right with no rejection and nothing revealed.'}
        </p>
      </header>

      {review.satKind && domainLines.length > 0 && (
        <section aria-labelledby={domainHeadingId} className="space-y-3" data-sat-domain-results="">
          <h2 id={domainHeadingId} className="text-xl font-semibold text-navy">
            Results by domain
          </h2>
          <ul className="space-y-3">
            {domainLines.map((line) => (
              <li
                key={line.domainId}
                data-domain-result={line.domainId}
                className="rounded-2xl border border-navy-100 bg-white p-4"
              >
                <h3 className="text-lg font-semibold text-navy">{line.title}</h3>
                <p className="mt-1 text-sm text-navy/80">{domainStat(line)}</p>
                {line.mistakes.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-sm text-navy">
                    {line.mistakes.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {weakest && (
            <div
              data-weakest-domain={weakest.domainId}
              className="rounded-2xl border border-coral bg-white p-4 space-y-2"
            >
              <p className="text-navy">
                Weakest domain: <strong className="font-semibold">{weakest.title}</strong>
              </p>
              <button
                type="button"
                onClick={() => practiceDomain(weakest.reviewId)}
                className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
              >
                Practice {weakest.title}
              </button>
            </div>
          )}
        </section>
      )}

      {!review.satKind && (
        <ul aria-labelledby={titleId} className="space-y-3">
          {lines.map((line) => (
            <li key={line.topicId} className="rounded-2xl border border-navy-100 bg-white p-4">
              <h2 className="text-lg font-semibold text-navy">{line.title}</h2>
              <p className="mt-1 text-sm text-navy/80">{topicStat(line)}</p>
              {line.mistakes.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-navy">
                  {line.mistakes.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              {line.practice && (
                <Link
                  to={`/m/${line.moduleId}`}
                  className="mt-3 inline-flex min-h-11 items-center font-semibold text-navy underline"
                >
                  Practice {line.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={onAgain} className="min-h-11 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600">
        Start another set
      </button>
    </div>
  )
}

export default ReviewPage
