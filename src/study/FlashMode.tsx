import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { celebrateRound, soundRight } from '@/study/effects'
import { btnPrimary, btnSecondary, textClass } from '@/study/ui'
import { useStore } from '@/store'
import type { StudySet } from '@/store/studySets'

function shuffleIds(ids: readonly string[]): string[] {
  const out = ids.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = out[i]!
    out[i] = out[j]!
    out[j] = a
  }
  return out
}

/**
 * One card at a time. A tap or Space turns it over; Got it / Still learning sort the pass, and the
 * running count shows both piles. Afterwards she can run the still-learning pile again.
 */
export function FlashMode({ set }: { set: StudySet }) {
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const learned = useRef(new Set<string>())
  const roundNoted = useRef(false)
  const streak = useRef(0)
  const [order, setOrder] = useState(() => set.cards.map((card) => card.id))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [buckets, setBuckets] = useState<Record<string, 'got' | 'learning'>>({})
  const [shuffled, setShuffled] = useState(false)
  const [done, setDone] = useState(false)

  const card = set.cards.find((item) => item.id === order[index])
  const showing = flipped ? card?.definition : card?.term

  function finishPass(sorted: Record<string, 'got' | 'learning'>) {
    if (!roundNoted.current) {
      roundNoted.current = true
      noteStudyRound(set.id, 'flash')
      celebrateRound(order.every((id) => sorted[id] === 'got'))
    }
    setDone(true)
  }

  function go(next: number, sorted: Record<string, 'got' | 'learning'> = buckets) {
    if (next >= order.length) {
      finishPass(sorted)
      return
    }
    if (next < 0) return
    setIndex(next)
    setFlipped(false)
  }

  function mark(bucket: 'got' | 'learning') {
    const id = order[index]
    if (!id) return
    const sorted = { ...buckets, [id]: bucket }
    setBuckets(sorted)
    if (bucket === 'got') {
      streak.current += 1
      soundRight(streak.current)
      if (!learned.current.has(id)) {
        learned.current.add(id)
        noteStudyLearned(set.id, id)
      }
    } else streak.current = 0
    go(index + 1, sorted)
  }

  function begin(ids: readonly string[], mix: boolean) {
    roundNoted.current = false
    streak.current = 0
    setOrder(mix ? shuffleIds(ids) : [...ids])
    setIndex(0)
    setFlipped(false)
    setBuckets({})
    setDone(false)
    setShuffled(mix)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (done) return
      if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') {
        e.preventDefault()
        setFlipped((v) => !v)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        go(index + 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        go(index - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (set.cards.length === 0) return <p className="text-navy">Add a card before you study.</p>

  if (done) {
    const learning = order.filter((id) => buckets[id] !== 'got')
    const got = order.length - learning.length
    return (
      <div className="study-in flex flex-col gap-4" data-study-done="">
        <div className={`rounded-2xl border p-5 text-center ${learning.length === 0 ? 'border-ok bg-ok-100' : 'border-navy-100 bg-white'}`}>
          <p className="text-2xl font-semibold text-navy">{learning.length === 0 ? 'You know them all!' : 'Pass complete'}</p>
          <p role="status" className="mt-1 text-lg font-semibold text-navy">
            {got} got it. {learning.length} still learning.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {learning.length > 0 && (
            <button type="button" className={btnPrimary} onClick={() => begin(learning, shuffled)}>
              Practice {learning.length} still learning
            </button>
          )}
          <button type="button" className={learning.length > 0 ? btnSecondary : btnPrimary} onClick={() => begin(set.cards.map((c) => c.id), shuffled)}>
            Start over
          </button>
          <Link to={`/study/${set.id}`} className={btnSecondary}>
            Back to the set
          </Link>
        </div>
      </div>
    )
  }

  if (!card || showing === undefined) return <p className="text-navy">Add a card before you study.</p>

  const gotCount = order.filter((id) => buckets[id] === 'got').length
  const learningCount = order.filter((id) => buckets[id] === 'learning').length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
        <p data-study-progress className="text-navy/80">
          {index + 1} of {order.length}
        </p>
        <p aria-label={`${gotCount} got it, ${learningCount} still learning`}>
          <span className="text-ok">✓ {gotCount}</span>
          <span className="mx-2 text-navy/40">·</span>
          <span className="text-gold-text">↻ {learningCount}</span>
        </p>
      </div>
      <button
        type="button"
        aria-label={`${flipped ? 'Definition' : 'Term'}: ${showing}`}
        onClick={() => setFlipped((v) => !v)}
        className={`flex min-h-48 flex-col items-center justify-center rounded-2xl border p-6 text-center ${flipped ? 'border-gold bg-gold-100' : 'border-navy-100 bg-white'}`}
      >
        <span key={flipped ? 'back' : 'front'} className="study-flip flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-navy/60">{flipped ? 'Definition' : 'Term'}</span>
          <span className={`text-2xl font-semibold text-navy ${textClass}`}>{showing}</span>
        </span>
      </button>
      <p className="text-sm text-navy/70">
        {flipped ? 'Did you know it? Sort the card.' : 'Say the answer to yourself, then tap the card (or press Space) to turn it over.'}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btnSecondary} onClick={() => mark('learning')}>
          Still learning
        </button>
        <button type="button" className={btnPrimary} onClick={() => mark('got')}>
          Got it
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={btnSecondary} onClick={() => go(index - 1)} disabled={index === 0}>
          Back
        </button>
        <button type="button" className={btnSecondary} onClick={() => go(index + 1)}>
          {index === order.length - 1 ? 'Finish' : 'Skip'}
        </button>
        <button
          type="button"
          aria-pressed={shuffled}
          className={`${btnSecondary} ${shuffled ? 'border-2 border-navy bg-navy-100' : ''}`}
          onClick={() => {
            const next = !shuffled
            setShuffled(next)
            setOrder(next ? shuffleIds(order) : set.cards.map((c) => c.id).filter((id) => order.includes(id)))
            setIndex(0)
            setFlipped(false)
          }}
        >
          Shuffle
        </button>
      </div>
    </div>
  )
}
