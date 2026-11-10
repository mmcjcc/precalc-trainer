import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BulkPaste, useBulkDraft } from '@/study/BulkPaste'
import { encodeStudySet } from '@/study/code'
import { StudyMissing, useRouteStudySet } from '@/study/frame'
import { btnPrimary, btnSecondary, fieldClass, textClass } from '@/study/ui'
import { useStore } from '@/store'
import { blankCardsNote, newStudyId, STUDY_LIMITS, type StudyDraftCard } from '@/store/studySets'

const MODES = [
  ['flash', 'Flashcards', 'Flip each card and sort what you know.'],
  ['learn', 'Learn', 'Multiple choice. Misses come back until they stick.'],
  ['match', 'Match', 'Pair terms with definitions against the clock.'],
  ['test', 'Test', 'Type the answers and get a score.'],
] as const

/** One deck: pick a way to study it, change its cards (one at a time or pasted in), or copy a share code. */
export function StudySetPage() {
  const set = useRouteStudySet()
  if (!set) return <StudyMissing />
  return <Editor key={set.id} id={set.id} />
}

function sameCards(a: readonly StudyDraftCard[], b: readonly StudyDraftCard[]): boolean {
  return a.length === b.length && a.every((card, i) => card.term === b[i]!.term && card.definition === b[i]!.definition)
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
  const [pasting, setPasting] = useState(() => (set?.cards.length ?? 0) === 0)
  const draft = useBulkDraft(STUDY_LIMITS.maxCards - rows.length)

  if (!set) return <StudyMissing />

  function persist(cards: readonly StudyDraftCard[] = rows, done?: string) {
    const result = saveStudySet(id, { title, cards })
    if (!result.ok) {
      setError(result.error)
      setNote(null)
      return null
    }
    setTitle(result.set.title)
    setRows(result.set.cards.map((card) => ({ ...card })))
    setError(null)
    setNote(result.dropped > 0 ? blankCardsNote(result.dropped) : (done ?? null))
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

  function addPasted() {
    const found = draft.result.cards
    if (found.length === 0) return
    const added = found.map((card) => ({ id: newStudyId(), term: card.term, definition: card.definition }))
    // Rows she has not typed in yet would only come back as "blank cards removed".
    const kept = rows.filter((row) => row.term.trim() !== '' || row.definition.trim() !== '')
    const result = persist([...kept, ...added], `Added ${found.length} ${found.length === 1 ? 'card' : 'cards'}.`)
    if (!result) return
    draft.clear()
    setPasting(false)
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
  const unsaved = title.trim() !== set.title || !sameCards(rows, set.cards)
  const found = draft.result.cards.length

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <Link to="/study" className="text-sm font-semibold text-navy underline">
        All study sets
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-navy">{set.title}</h1>
        <p className="text-sm text-navy/80">
          {set.cards.length} {set.cards.length === 1 ? 'card' : 'cards'}
          {set.bestMatchMs !== undefined ? ` · Best match ${formatSeconds(set.bestMatchMs)}` : ''}
        </p>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="study-heading">
        <h2 id="study-heading" className="text-xl font-semibold text-navy">
          Study this set
        </h2>
        {set.cards.length === 0 && rows.length === 0 ? (
          <p className="text-navy">This set has no cards yet. Paste your notes or add cards below, then come back up here to study.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {MODES.map(([mode, label, about]) => (
              <button
                key={mode}
                type="button"
                data-mode={mode}
                className="flex min-h-16 flex-col items-start justify-center rounded-2xl border border-navy-100 bg-white px-4 py-3 text-left hover:bg-navy-50"
                onClick={() => openMode(mode)}
              >
                <span className="text-lg font-semibold text-navy">{label}</span>
                <span className="text-sm text-navy/70">{about}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <form
        className="flex flex-col gap-4"
        aria-labelledby="cards-heading"
        onSubmit={(e) => {
          e.preventDefault()
          persist(rows, 'Saved.')
        }}
      >
        <h2 id="cards-heading" className="text-xl font-semibold text-navy">
          Cards
        </h2>
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-navy">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="Title" className={fieldClass} />
        </label>

        {pasting ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-4" data-bulk-add="">
            <BulkPaste draft={draft} label="Paste your notes" />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-40`} disabled={found === 0} onClick={addPasted}>
                {found > 0 ? `Add ${found} ${found === 1 ? 'card' : 'cards'}` : 'Add cards'}
              </button>
              <button type="button" className={btnSecondary} onClick={() => setPasting(false)}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={btnSecondary} onClick={() => setPasting(true)}>
            Paste many cards at once
          </button>
        )}

        <ul className="flex flex-col gap-3">
          {rows.map((row, i) => (
            <li key={row.id ?? i} className="flex flex-col gap-2 rounded-2xl border border-navy-100 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-navy/70">Card {i + 1}</span>
                <button
                  type="button"
                  aria-label={`Remove card ${i + 1}`}
                  className="min-h-9 rounded-lg px-3 text-sm font-semibold text-navy underline hover:bg-navy-50"
                  onClick={() => setRows((prev) => prev.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
              </div>
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
        {unsaved && <p className="text-sm text-navy/70">You have changes that are not saved yet. Starting a study mode saves them too.</p>}
      </form>

      <section className="flex flex-col gap-2" aria-labelledby="share-heading">
        <h2 id="share-heading" className="text-lg font-semibold text-navy">
          Share with a classmate
        </h2>
        <p className="text-sm text-navy/80">Send them this code. They paste it under "Got a code from a classmate?" on their Study page and get their own copy.</p>
        <textarea readOnly value={code} rows={4} aria-label="Share code" className={`${fieldClass} font-mono text-sm`} />
        <button type="button" className={btnSecondary} onClick={() => void share()}>
          Copy the share code
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
