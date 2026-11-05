import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { encodeStudySet } from '@/study/code'
import { StudyMissing, useRouteStudySet } from '@/study/frame'
import { btnPrimary, btnSecondary, fieldClass, textClass } from '@/study/ui'
import { useStore } from '@/store'
import { blankCardsNote, newStudyId, type StudyDraftCard } from '@/store/studySets'

const MODES = [
  ['flash', 'Flashcards'],
  ['learn', 'Learn'],
  ['match', 'Match'],
  ['test', 'Test'],
] as const

/** One deck: edit the cards, then open a study mode or copy a share code. */
export function StudySetPage() {
  const set = useRouteStudySet()
  if (!set) return <StudyMissing />
  return <Editor key={set.id} id={set.id} />
}

function Editor({ id }: { id: string }) {
  const set = useStore((s) => s.studySets.find((item) => item.id === id) ?? null)
  const saveStudySet = useStore((s) => s.saveStudySet)
  const deleteStudySet = useStore((s) => s.deleteStudySet)
  const toast = useStore((s) => s.toast)
  const navigate = useNavigate()
  const [title, setTitle] = useState(set?.title ?? '')
  const [rows, setRows] = useState<StudyDraftCard[]>(() => set?.cards.map((card) => ({ ...card })) ?? [])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (!set) return <StudyMissing />

  function persist() {
    const result = saveStudySet(id, { title, cards: rows })
    if (!result.ok) {
      setError(result.error)
      setNote(null)
      return null
    }
    setTitle(result.set.title)
    setRows(result.set.cards.map((card) => ({ ...card })))
    setError(null)
    setNote(result.dropped > 0 ? blankCardsNote(result.dropped) : null)
    return result
  }

  function openMode(mode: (typeof MODES)[number][0]) {
    const result = persist()
    if (!result) return
    if (result.set.cards.length === 0) {
      setError('Add a card before you study.')
      return
    }
    navigate(`/study/${id}/${mode}`)
  }

  async function share() {
    const result = persist()
    if (!result) return
    const code = encodeStudySet(result.set)
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(code)
      toast('Copied the share code.', { tone: 'ok' })
    } catch {
      toast('Select the code in the box and copy it.', { tone: 'info' })
    }
  }

  const code = encodeStudySet(set)

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link to="/study" className="text-sm font-semibold text-navy underline">
        All study sets
      </Link>
      <h1 className="text-3xl font-semibold text-navy">{set.title}</h1>
      {set.bestMatchMs !== undefined && <p className="text-sm text-navy/80">Best match {formatSeconds(set.bestMatchMs)}</p>}
      <div className="grid grid-cols-2 gap-2">
        {MODES.map(([mode, label]) => (
          <button key={mode} type="button" className={btnSecondary} onClick={() => openMode(mode)}>
            {label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          persist()
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-navy">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="Title" className={fieldClass} />
        </label>
        <ul className="flex flex-col gap-4">
          {rows.map((row, i) => (
            <li key={row.id ?? i} className="flex flex-col gap-2 rounded-2xl border border-navy-100 bg-white p-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-navy">Term</span>
                <textarea
                  value={row.term}
                  onChange={(e) => setRows((prev) => prev.map((item, n) => (n === i ? { ...item, term: e.target.value } : item)))}
                  rows={2}
                  maxLength={500}
                  aria-label={`Term ${i + 1}`}
                  className={`${fieldClass} ${textClass}`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-navy">Definition</span>
                <textarea
                  value={row.definition}
                  onChange={(e) => setRows((prev) => prev.map((item, n) => (n === i ? { ...item, definition: e.target.value } : item)))}
                  rows={2}
                  maxLength={500}
                  aria-label={`Definition ${i + 1}`}
                  className={`${fieldClass} ${textClass}`}
                />
              </label>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => setRows((prev) => prev.filter((_, n) => n !== i))}
              >
                Remove card {i + 1}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={btnSecondary} onClick={() => setRows((prev) => [...prev, { id: newStudyId(), term: '', definition: '' }])}>
          Add card
        </button>
        {error && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {error}
          </p>
        )}
        {note && (
          <p role="status" className="text-sm font-semibold text-navy">
            {note}
          </p>
        )}
        <button type="submit" className={btnPrimary}>
          Save
        </button>
      </form>
      <section className="flex flex-col gap-2" aria-labelledby="share-heading">
        <h2 id="share-heading" className="text-lg font-semibold text-navy">
          Share
        </h2>
        <p className="text-sm text-navy/80">A classmate pastes this code to get a copy. Save first if you changed the cards.</p>
        <textarea readOnly value={code} rows={4} aria-label="Share code" className={`${fieldClass} font-mono text-sm`} />
        <button type="button" className={btnSecondary} onClick={() => void share()}>
          Share
        </button>
      </section>
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-navy">Delete {set.title}? This cannot be undone.</p>
          <button
            type="button"
            className={btnPrimary}
            onClick={() => {
              deleteStudySet(id)
              navigate('/study')
            }}
          >
            Delete this set
          </button>
          <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </div>
      ) : (
        <button type="button" className={btnSecondary} onClick={() => setConfirming(true)}>
          Delete set
        </button>
      )}
    </div>
  )
}

function formatSeconds(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
