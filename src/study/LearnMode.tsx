import { useRef, useState } from 'react'
import { mulberry32 } from '@/content/rng'
import { answerLearn, learnChoices, learnSeed, startLearn } from '@/study/learn'
import { btnPrimary, btnSecondary, textClass } from '@/study/ui'
import { useStore } from '@/store'
import type { StudySet } from '@/store/studySets'

/** Term, then the definition: four choices when the set can make them, otherwise reveal and self-grade. */
export function LearnMode({ set }: { set: StudySet }) {
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const learned = useRef(new Set<string>())
  const roundNoted = useRef(false)
  const [seed] = useState(() => (Math.random() * 0xffffffff) >>> 0)
  const [state, setState] = useState(() => startLearn(set.cards.map((card) => card.id), mulberry32(seed)))
  const [revealed, setRevealed] = useState(false)

  if (set.cards.length === 0) return <p className="text-navy">Add a card before you study.</p>

  function grade(correct: boolean) {
    const current = state.queue[0]
    if (!current) return
    if (correct && !learned.current.has(current.id)) {
      learned.current.add(current.id)
      noteStudyLearned(set.id, current.id)
    }
    const next = answerLearn(state, correct)
    if (next.done && !roundNoted.current) {
      roundNoted.current = true
      noteStudyRound(set.id, 'learn')
    }
    setRevealed(false)
    setState(next)
  }

  if (state.done) {
    return (
      <p role="status" className="text-lg font-semibold text-navy">
        {state.firstTry} right on the first try. {state.neededRetry} needed another try.
      </p>
    )
  }

  const current = state.queue[0]
  const card = current ? set.cards.find((item) => item.id === current.id) : undefined
  if (!current || !card) return <p className="text-navy">Add a card before you study.</p>

  const choices = learnChoices(set.cards, card.id, mulberry32(learnSeed(`${set.id}:${card.id}:${current.misses}`)))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-navy/80">
        {set.cards.length - state.queue.length + 1} left in this round, counting cards that come back
      </p>
      <div className="rounded-2xl border border-navy-100 bg-white p-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Term</p>
        <p className={`mt-2 text-2xl font-semibold text-navy ${textClass}`}>{card.term}</p>
      </div>
      {choices ? (
        <div className="flex flex-col gap-2" role="group" aria-label="Choices">
          {choices.map((choice) => (
            <button key={choice.text} type="button" className={btnSecondary} onClick={() => grade(choice.correct)}>
              <span className={textClass}>{choice.text}</span>
            </button>
          ))}
        </div>
      ) : revealed ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-navy-100 bg-navy-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Definition</p>
            <p className={`mt-1 text-lg text-navy ${textClass}`}>{card.definition}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btnSecondary} onClick={() => grade(false)}>
              Wrong
            </button>
            <button type="button" className={btnPrimary} onClick={() => grade(true)}>
              Right
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={btnPrimary} onClick={() => setRevealed(true)}>
          Reveal
        </button>
      )}
    </div>
  )
}
