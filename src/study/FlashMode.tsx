import { useEffect, useRef, useState } from 'react'
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
 * One card at a time. Space or a tap flips it. Got it / Still learning sort the pass;
 * afterwards she can run the still-learning pile again.
 */
export function FlashMode({ set }: { set: StudySet }) {
  const noteStudyLearned = useStore((s) => s.noteStudyLearned)
  const noteStudyRound = useStore((s) => s.noteStudyRound)
  const learned = useRef(new Set<string>())
  const roundNoted = useRef(false)
  const [order, setOrder] = useState(() => set.cards.map((card) => card.id))
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [buckets, setBuckets] = useState<Record<string, 'got' | 'learning'>>({})
  const [shuffled, setShuffled] = useState(false)
  const [done, setDone] = useState(false)

  const card = set.cards.find((item) => item.id === order[index])
  const showing = flipped ? card?.definition : card?.term

  function finishPass() {
    if (!roundNoted.current) {
      roundNoted.current = true
      noteStudyRound(set.id, 'flash')
    }
    setDone(true)
  }

  function go(next: number) {
    if (next >= order.length) {
      finishPass()
      return
    }
    if (next < 0) return
    setIndex(next)
    setFlipped(false)
  }

  function mark(bucket: 'got' | 'learning') {
    const id = order[index]
    if (!id) return
    setBuckets((prev) => ({ ...prev, [id]: bucket }))
    if (bucket === 'got' && !learned.current.has(id)) {
      learned.current.add(id)
      noteStudyLearned(set.id, id)
    }
    go(index + 1)
  }

  function begin(ids: readonly string[], mix: boolean) {
    roundNoted.current = false
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
      <div className="flex flex-col gap-3">
        <p role="status" className="text-lg font-semibold text-navy">
          {got} got it. {learning.length} still learning.
        </p>
        {learning.length > 0 && (
          <button type="button" className={btnPrimary} onClick={() => begin(learning, shuffled)}>
            Practice {learning.length} still learning
          </button>
        )}
        <button type="button" className={btnSecondary} onClick={() => begin(set.cards.map((c) => c.id), shuffled)}>
          Start over
        </button>
      </div>
    )
  }

  if (!card || showing === undefined) return <p className="text-navy">Add a card before you study.</p>

  return (
    <div className="flex flex-col gap-3">
      <p data-study-progress className="text-sm font-semibold text-navy/80">
        {index + 1} of {order.length}
      </p>
      <button
        type="button"
        aria-label={`${flipped ? 'Definition' : 'Term'}: ${showing}`}
        onClick={() => setFlipped((v) => !v)}
        className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-2xl border border-navy-100 bg-white p-6 text-center"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-navy/60">{flipped ? 'Definition' : 'Term'}</span>
        <span className={`text-2xl font-semibold text-navy ${textClass}`}>{showing}</span>
      </button>
      <p className="text-sm text-navy/70">Space flips. Arrow keys move between cards.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btnSecondary} onClick={() => go(index - 1)} disabled={index === 0}>
          Previous
        </button>
        <button type="button" className={btnSecondary} onClick={() => go(index + 1)}>
          {index === order.length - 1 ? 'Finish' : 'Next'}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className={btnSecondary} onClick={() => mark('learning')}>
          Still learning
        </button>
        <button type="button" className={btnPrimary} onClick={() => mark('got')}>
          Got it
        </button>
      </div>
      <button
        type="button"
        aria-pressed={shuffled}
        className={btnSecondary}
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
  )
}
