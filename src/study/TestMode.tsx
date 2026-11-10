import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { mulberry32 } from '@/content/rng'
import { celebrateRound } from '@/study/effects'
import { gradeStudyAnswer, pickTestCards, testAnswerSide } from '@/study/grade'
import { btnPrimary, btnSecondary, fieldClass, textClass } from '@/study/ui'
import { useStore } from '@/store'
import type { StudyCard, StudySet } from '@/store/studySets'

/**
 * A written test. She types the short side of each card (study/grade.ts picks it and forgives capitals,
 * spacing and a slipped letter); after Submit every row says right or not, shows the answer, and she can
 * mark a row right when the check was too strict.
 */
export function TestMode({ set }: { set: StudySet }) {
  const [round, setRound] = useState(0)
  return <Paper key={round} set={set} onAgain={() => setRound((n) => n + 1)} />
}

function Paper({ set, onAgain }: { set: StudySet; onAgain: () => void }) {
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const learned = useRef(new Set<string>())
  const [picked] = useState(() => pickTestCards(set.cards, mulberry32((Math.random() * 0xffffffff) >>> 0)))
  const [side] = useState(() => testAnswerSide(set.cards))
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!submitted) return
    resultRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    resultRef.current?.focus({ preventScroll: true })
  }, [submitted])

  if (set.cards.length === 0) return <p className="text-navy">Add a card before you study.</p>

  const asked = (card: StudyCard) => (side === 'term' ? card.definition : card.term)
  const wanted = (card: StudyCard) => (side === 'term' ? card.term : card.definition)
  const askedLabel = side === 'term' ? 'Definition' : 'Term'
  const wantedLabel = side === 'term' ? 'Term' : 'Definition'
  const gradeOf = (card: StudyCard) => gradeStudyAnswer(answers[card.id] ?? '', wanted(card))

  function remember(card: StudyCard) {
    if (learned.current.has(card.id)) return
    learned.current.add(card.id)
    noteStudyLearned(set.id, card.id)
  }

  function submit() {
    if (submitted) return
    setSubmitted(true)
    let right = 0
    for (const card of picked) {
      if (gradeOf(card) !== 'wrong') {
        remember(card)
        right += 1
      }
    }
    noteStudyRound(set.id, 'test')
    if (right * 5 >= picked.length * 4) celebrateRound(right === picked.length)
  }

  function override(card: StudyCard) {
    setOverrides((prev) => {
      const next = !prev[card.id]
      if (next) remember(card)
      return { ...prev, [card.id]: next }
    })
  }

  const right = (card: StudyCard) => gradeOf(card) !== 'wrong' || overrides[card.id] === true
  const score = picked.filter(right).length
  const sampled = picked.length < set.cards.length
  const headline = score === picked.length ? 'Perfect score!' : score * 5 >= picked.length * 4 ? 'Nice work!' : 'Keep at it.'

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {submitted ? (
        <div
          ref={resultRef}
          tabIndex={-1}
          className={`study-in rounded-2xl border p-5 text-center outline-none ${score * 5 >= picked.length * 4 ? 'border-ok bg-ok-100' : 'border-navy-100 bg-white'}`}
          data-study-done=""
        >
          <p className="text-2xl font-semibold text-navy">{headline}</p>
          <p role="status" className="mt-1 text-lg font-semibold text-navy">
            Score: {score} of {picked.length}
          </p>
          <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
            <button type="button" className={btnPrimary} onClick={onAgain}>
              New test
            </button>
            <Link to={`/study/${set.id}`} className={btnSecondary}>
              Back to the set
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-navy/80">{sampled ? `${picked.length} of ${set.cards.length} cards` : `All ${picked.length} cards`}</p>
          <p className="text-sm text-navy/70">
            Type the {wantedLabel.toLowerCase()} for each one, then Submit. Capitals, spacing and a small spelling slip don't count against you.
          </p>
        </div>
      )}
      <ol className="flex flex-col gap-4">
        {picked.map((card, i) => {
          const given = answers[card.id] ?? ''
          const grade = gradeOf(card)
          const marked = overrides[card.id] === true
          const good = grade !== 'wrong' || marked
          return (
            <li
              key={card.id}
              data-row={submitted ? (good ? 'right' : 'wrong') : undefined}
              className={`flex flex-col gap-2 rounded-2xl border bg-white p-4 ${submitted ? (good ? 'border-2 border-ok' : 'border-2 border-bad') : 'border-navy-100'}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/60">
                {i + 1}. {askedLabel}
              </p>
              <p className={`font-semibold text-navy ${textClass}`}>{asked(card)}</p>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-navy">{wantedLabel}</span>
                <input
                  value={given}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [card.id]: e.target.value }))}
                  disabled={submitted}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  aria-label={`Answer for ${asked(card)}`}
                  className={fieldClass}
                />
              </label>
              {submitted && good && (
                <p className="text-sm font-bold text-ok">
                  {marked && grade === 'wrong' ? '✓ Counted as right' : grade === 'close' ? `✓ Right - spelled "${wanted(card)}"` : '✓ Right'}
                </p>
              )}
              {submitted && grade === 'wrong' && (
                <div className="flex flex-col gap-2">
                  {!marked && <p className="text-sm font-bold text-bad">{given.trim() ? '✕ Not quite' : '✕ Left blank'}</p>}
                  {given.trim() !== '' && <p className={`text-sm text-navy ${textClass}`}>Your answer: {given}</p>}
                  <p className={`text-sm font-semibold text-navy ${textClass}`}>Answer: {wanted(card)}</p>
                  <button type="button" className={btnSecondary} onClick={() => override(card)} aria-pressed={marked}>
                    I was right
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {!submitted && (
        <button type="submit" className={btnPrimary}>
          Submit
        </button>
      )}
    </form>
  )
}
