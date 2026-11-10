import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ComboPill } from '@/components/juice/ComboPill'
import { mulberry32 } from '@/content/rng'
import { celebrateRound, RIGHT_PAUSE_MS, soundRight, soundWrong } from '@/study/effects'
import { answerLearn, learnChoices, learnSeed, startLearn, type LearnChoice } from '@/study/learn'
import { btnPrimary, btnSecondary, textClass } from '@/study/ui'
import { useRewardsOn, useStore } from '@/store'
import type { StudySet } from '@/store/studySets'

function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}

/**
 * Term, then the definition: four choices when the set can make them, otherwise reveal and self-grade.
 * A choice is answered where she tapped it: hers turns green or red, the right one is always shown, and a
 * line says which it was. A right answer moves on by itself; after a miss she reads, then taps Next.
 */
export function LearnMode({ set }: { set: StudySet }) {
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const rewards = useRewardsOn()
  const learned = useRef(new Set<string>())
  const roundNoted = useRef(false)
  const [ids, setIds] = useState(() => set.cards.map((card) => card.id))
  const [state, setState] = useState(() => startLearn(ids, mulberry32(newSeed())))
  const [revealed, setRevealed] = useState(false)
  const [picked, setPicked] = useState<LearnChoice | null>(null)
  const [streak, setStreak] = useState(0)
  const [missed, setMissed] = useState<string[]>([])
  const pending = useRef<{ correct: boolean } | null>(null)
  const timer = useRef<number | null>(null)
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  useEffect(() => {
    if (picked && !picked.correct) nextRef.current?.focus()
  }, [picked])

  if (set.cards.length === 0) return <p className="text-navy">Add a card before you study.</p>

  function grade(correct: boolean) {
    const current = state.queue[0]
    if (!current) return
    if (correct && !learned.current.has(current.id)) {
      learned.current.add(current.id)
      noteStudyLearned(set.id, current.id)
    }
    if (!correct) setMissed((prev) => (prev.includes(current.id) ? prev : [...prev, current.id]))
    const next = answerLearn(state, correct)
    if (next.done && !roundNoted.current) {
      roundNoted.current = true
      noteStudyRound(set.id, 'learn')
      celebrateRound(next.neededRetry === 0)
    }
    setRevealed(false)
    setPicked(null)
    setState(next)
  }

  function hear(correct: boolean) {
    if (correct) {
      soundRight(streak + 1)
      setStreak(streak + 1)
    } else {
      soundWrong()
      setStreak(0)
    }
  }

  function moveOn() {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    const answer = pending.current
    pending.current = null
    if (answer) grade(answer.correct)
  }

  function choose(choice: LearnChoice) {
    if (picked) return
    pending.current = { correct: choice.correct }
    setPicked(choice)
    hear(choice.correct)
    if (choice.correct) timer.current = window.setTimeout(moveOn, RIGHT_PAUSE_MS)
  }

  function selfGrade(correct: boolean) {
    hear(correct)
    grade(correct)
  }

  function restart(next: readonly string[]) {
    roundNoted.current = false
    pending.current = null
    setIds([...next])
    setState(startLearn(next, mulberry32(newSeed())))
    setRevealed(false)
    setPicked(null)
    setStreak(0)
    setMissed([])
  }

  if (state.done) {
    const again = missed.filter((id) => set.cards.some((card) => card.id === id))
    return (
      <div className="study-in flex flex-col gap-4" data-study-done="">
        <div className="rounded-2xl border border-ok bg-ok-100 p-5 text-center">
          <p className="text-2xl font-semibold text-navy">{state.neededRetry === 0 ? 'Perfect round!' : 'Round complete!'}</p>
          <p role="status" className="mt-1 text-lg font-semibold text-navy">
            {state.firstTry} right on the first try. {state.neededRetry} needed another try.
          </p>
        </div>
        {again.length > 0 && (
          <section aria-labelledby="learn-missed" className="flex flex-col gap-2">
            <h2 id="learn-missed" className="font-semibold text-navy">
              Worth another look
            </h2>
            <ul className="flex flex-col gap-2">
              {again.map((id) => {
                const card = set.cards.find((item) => item.id === id)
                if (!card) return null
                return (
                  <li key={id} className="rounded-xl border border-navy-100 bg-white px-3 py-2">
                    <p className={`font-semibold text-navy ${textClass}`}>{card.term}</p>
                    <p className={`text-sm text-navy/80 ${textClass}`}>{card.definition}</p>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {again.length > 0 && (
            <button type="button" className={btnPrimary} onClick={() => restart(again)}>
              Practice the {again.length} I missed
            </button>
          )}
          <button type="button" className={again.length > 0 ? btnSecondary : btnPrimary} onClick={() => restart(set.cards.map((card) => card.id))}>
            Go again
          </button>
          <Link to={`/study/${set.id}`} className={btnSecondary}>
            Back to the set
          </Link>
        </div>
      </div>
    )
  }

  const current = state.queue[0]
  const card = current ? set.cards.find((item) => item.id === current.id) : undefined
  if (!current || !card) return <p className="text-navy">Add a card before you study.</p>

  const choices = learnChoices(set.cards, card.id, mulberry32(learnSeed(`${set.id}:${card.id}:${current.misses}`)))
  const total = ids.length
  const done = total - state.queue.length
  const comingBack = state.queue.filter((item) => item.misses > 0).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-navy/80" data-study-progress="">
            {done} of {total} learned{comingBack > 0 ? ` · ${comingBack} coming back` : ''}
          </p>
          {rewards && <ComboPill count={streak} />}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-navy-100" aria-hidden="true">
          <div className="h-full rounded-full bg-ok transition-[width] duration-300" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>
      <div className="rounded-2xl border border-navy-100 bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Term</p>
        <p className={`mt-2 text-2xl font-semibold text-navy ${textClass}`}>{card.term}</p>
      </div>
      {choices ? (
        <>
          {!picked && <p className="text-sm text-navy/70">Pick the definition that matches.</p>}
          <div className="flex flex-col gap-2" role="group" aria-label="Choices">
            {choices.map((choice) => {
              const mine = picked?.text === choice.text
              const show = picked !== null
              const tone = !show
                ? 'border-navy-100 bg-white hover:bg-navy-50'
                : choice.correct
                  ? `border-2 border-ok bg-ok-100 ${mine ? 'study-pop' : ''}`
                  : mine
                    ? 'study-shake border-2 border-bad bg-bad-100'
                    : 'border-navy-100 bg-white opacity-50'
              return (
                <button
                  key={choice.text}
                  type="button"
                  disabled={show}
                  data-choice={show ? (choice.correct ? 'right' : mine ? 'wrong' : 'other') : undefined}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left text-base font-semibold text-navy ${tone}`}
                  onClick={() => choose(choice)}
                >
                  {show && (choice.correct || mine) && (
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${choice.correct ? 'bg-ok' : 'bg-bad'}`}
                    >
                      {choice.correct ? '✓' : '✕'}
                    </span>
                  )}
                  <span className={textClass}>{choice.text}</span>
                </button>
              )
            })}
          </div>
          {picked && (
            <div
              role="status"
              data-verdict={picked.correct ? 'right' : 'wrong'}
              className={`study-in flex flex-col gap-3 rounded-2xl border-2 p-4 sm:flex-row sm:items-center sm:justify-between ${
                picked.correct ? 'border-ok bg-ok-100' : 'border-bad bg-bad-100'
              }`}
            >
              <div>
                <p className={`text-xl font-bold ${picked.correct ? 'text-ok' : 'text-bad'}`}>{picked.correct ? 'Correct!' : 'Not quite.'}</p>
                <p className="text-sm text-navy">
                  {picked.correct
                    ? streak >= 3 && !rewards
                      ? `${streak} in a row!`
                      : 'Nice.'
                    : 'The right answer is the green one. This card will come back.'}
                </p>
              </div>
              <button ref={nextRef} type="button" className={btnPrimary} onClick={moveOn}>
                Next
              </button>
            </div>
          )}
        </>
      ) : revealed ? (
        <div className="flex flex-col gap-3">
          <div className="study-flip rounded-2xl border border-navy-100 bg-navy-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Definition</p>
            <p className={`mt-1 text-lg text-navy ${textClass}`}>{card.definition}</p>
          </div>
          <p className="text-sm text-navy/70">Did you have it?</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnSecondary} onClick={() => selfGrade(false)}>
              Missed it
            </button>
            <button type="button" className={btnPrimary} onClick={() => selfGrade(true)}>
              Got it
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-navy/70">Say the definition to yourself, then check.</p>
          <button type="button" className={btnPrimary} onClick={() => setRevealed(true)}>
            Show the definition
          </button>
        </>
      )}
    </div>
  )
}
