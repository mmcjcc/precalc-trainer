import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ImportPanel } from '@/study/ImportPanel'
import { starterDecks } from '@/study/starterDecks'
import { btnPrimary, btnSecondary, fieldClass } from '@/study/ui'
import { useStore } from '@/store'

/** Her decks: make one, open it, start from a ready-made deck, or bring in a classmate's code. */
export function StudyPage() {
  const sets = useStore((s) => s.studySets)
  const createStudySet = useStore((s) => s.createStudySet)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [starterError, setStarterError] = useState<string | null>(null)
  const ordered = sets.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title))
  const titles = new Set(sets.map((set) => set.title))

  function onAddStarter(deckId: string) {
    const deck = starterDecks().find((d) => d.id === deckId)
    if (!deck) return
    const result = createStudySet({ title: deck.title, cards: deck.cards })
    setStarterError(result.ok ? null : result.error)
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    const result = createStudySet({ title })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTitle('')
    setError(null)
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <h1 className="text-3xl font-semibold text-navy">Study sets</h1>
      <form onSubmit={onCreate} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-semibold text-navy">New set</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="New set title"
            maxLength={80}
            className={fieldClass}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {error}
          </p>
        )}
        <button type="submit" className={btnPrimary}>
          Create set
        </button>
      </form>
      {ordered.length === 0 ? (
        <p className="text-navy">You have no study sets yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((set) => (
            <li key={set.id}>
              <Link to={`/study/${set.id}`} className="flex min-h-14 flex-col justify-center rounded-2xl border border-navy-100 bg-white px-4 py-3 hover:bg-navy-50">
                <span className="font-semibold text-navy">{set.title}</span>
                <span className="text-sm text-navy/70">
                  {set.cards.length} {set.cards.length === 1 ? 'card' : 'cards'}
                  {set.source === 'imported' ? ' · Imported' : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-3" aria-labelledby="starter-heading">
        <h2 id="starter-heading" className="text-xl font-semibold text-navy">
          Starter sets
        </h2>
        <p className="text-sm text-navy/70">Ready-made decks from your classes. Adding one makes your own editable copy.</p>
        {starterError && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {starterError}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {starterDecks().map((deck) => (
            <li key={deck.id} className="flex flex-col gap-2 rounded-2xl border border-navy-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col">
                <span className="font-semibold text-navy">{deck.title}</span>
                <span className="text-sm text-navy/70">
                  {deck.cards.length} cards · {deck.blurb}
                </span>
              </div>
              {titles.has(deck.title) ? (
                <span className="text-sm font-semibold text-navy/70 sm:shrink-0">In your sets</span>
              ) : (
                <button type="button" onClick={() => onAddStarter(deck.id)} className={`${btnSecondary} sm:shrink-0`} aria-label={`Add ${deck.title}`}>
                  Add
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="import-heading">
        <h2 id="import-heading" className="text-xl font-semibold text-navy">
          Import a set
        </h2>
        <Link to="/study/import" className="font-semibold text-navy underline">
          Open the import page
        </Link>
        <ImportPanel />
      </section>
    </div>
  )
}
