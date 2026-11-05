import { useRef, useState } from 'react'
import { mulberry32 } from '@/content/rng'
import { pickTestCards, studyAnswersMatch } from '@/study/grade'
import { btnPrimary, btnSecondary, fieldClass, textClass } from '@/study/ui'
import { useStore } from '@/store'
import type { StudyCard, StudySet } from '@/store/studySets'

/** Typed definitions. Spacing and capital letters do not count. She can mark a row right when the check is wrong. */
export function TestMode({ set }: { set: StudySet }) {
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const learned = useRef(new Set<string>())
  const [picked] = useState(() => pickTestCards(set.cards, mulberry32((Math.random() * 0xffffffff) >>> 0)))
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  if (set.cards.length === 0) return <p className="text-navy">Add a card before you study.</p>

  function remember(card: StudyCard) {
    if (learned.current.has(card.id)) return
    learned.current.add(card.id)
    noteStudyLearned(set.id, card.id)
  }

  function submit() {
    if (submitted) return
    setSubmitted(true)
    for (const card of picked) {
      if (studyAnswersMatch(answers[card.id] ?? '', card.definition)) remember(card)
    }
    noteStudyRound(set.id, 'test')
  }

  function override(card: StudyCard) {
    setOverrides((prev) => {
      const next = !prev[card.id]
      if (next) remember(card)
      return { ...prev, [card.id]: next }
    })
  }

  const right = (card: StudyCard) => studyAnswersMatch(answers[card.id] ?? '', card.definition) || overrides[card.id] === true
  const score = picked.filter(right).length
  const sampled = picked.length < set.cards.length

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <p className="text-sm font-semibold text-navy/80">{sampled ? `${picked.length} of ${set.cards.length} cards` : `All ${picked.length} cards`}</p>
      <ol className="flex flex-col gap-4">
        {picked.map((card, i) => {
          const given = answers[card.id] ?? ''
          const graded = studyAnswersMatch(given, card.definition)
          const marked = overrides[card.id] === true
          return (
            <li key={card.id} className="flex flex-col gap-2 rounded-2xl border border-navy-100 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">Term</p>
              <p className={`font-semibold text-navy ${textClass}`}>{card.term}</p>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-navy">Definition</span>
                <textarea
                  value={given}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [card.id]: e.target.value }))}
                  disabled={submitted}
                  rows={2}
                  aria-label={`Definition for ${card.term}`}
                  className={fieldClass}
                />
              </label>
              {submitted && (graded || marked) && <p className="text-sm font-semibold text-ok">Right</p>}
              {submitted && !graded && (
                <div className="flex flex-col gap-2">
                  <p className={`text-sm text-navy ${textClass}`}>Your answer: {given}</p>
                  <p className={`text-sm text-navy ${textClass}`}>Definition: {card.definition}</p>
                  <button type="button" className={btnSecondary} onClick={() => override(card)} aria-pressed={marked}>
                    I was right
                  </button>
                </div>
              )}
              <span className="sr-only">Card {i + 1}</span>
            </li>
          )
        })}
      </ol>
      {submitted ? (
        <p role="status" className="text-lg font-semibold text-navy">
          Score: {score} of {picked.length}
        </p>
      ) : (
        <button type="submit" className={btnPrimary}>
          Submit
        </button>
      )}
    </form>
  )
}
