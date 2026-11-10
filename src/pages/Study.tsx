import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BulkPaste, useBulkDraft } from '@/study/BulkPaste'
import { ImportPanel } from '@/study/ImportPanel'
import { starterDecks } from '@/study/starterDecks'
import { btnPrimary, btnSecondary, fieldClass } from '@/study/ui'
import { useStore } from '@/store'
import { STUDY_LIMITS } from '@/store/studySets'

/**
 * Her decks: open one, make one (a title and, if she likes, her notes pasted in: each line becomes a
 * card), start from a ready-made deck, or bring in a classmate's code.
 */
export function StudyPage() {
  const sets = useStore((s) => s.studySets)
  const createStudySet = useStore((s) => s.createStudySet)
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [starterError, setStarterError] = useState<string | null>(null)
  const draft = useBulkDraft(STUDY_LIMITS.maxCards)
  const ordered = sets.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title))
  const titles = new Map(sets.map((set) => [set.title, set.id]))
  const found = draft.result.cards.length

  function onAddStarter(deckId: string) {
    const deck = starterDecks().find((d) => d.id === deckId)
    if (!deck) return
    const result = createStudySet({ title: deck.title, cards: deck.cards })
    setStarterError(result.ok ? null : result.error)
  }

  function onCreate(e: FormEvent) {
    e.preventDefault()
    const result = createStudySet({ title, cards: draft.result.cards })
    if (!result.ok) {
      setError(result.error)
      return
    }
    navigate(`/study/${result.set.id}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-navy">Study sets</h1>
        <p className="text-navy/80">Flashcards for anything you need to memorize. Study a set four ways: flip, multiple choice, a matching race, or a written test.</p>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="mine-heading">
        <h2 id="mine-heading" className="text-xl font-semibold text-navy">
          Your sets
        </h2>
        {ordered.length === 0 ? (
          <p className="text-navy">You have no study sets yet. Make one below, or add a starter set.</p>
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
      </section>

      <section aria-labelledby="new-heading">
        <form onSubmit={onCreate} className="flex flex-col gap-4 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 id="new-heading" className="text-xl font-semibold text-navy">
            Make a new set
          </h2>
          <label className="flex flex-col gap-1">
            <span className="font-semibold text-navy">Name it</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="New set title"
              placeholder="Chemistry chapter 5"
              maxLength={80}
              className={fieldClass}
            />
          </label>
          <BulkPaste draft={draft} label="Paste your notes (optional)" />
          {error && (
            <p role="alert" className="text-sm font-semibold text-bad">
              {error}
            </p>
          )}
          <button type="submit" className={btnPrimary}>
            {found > 0 ? `Create set with ${found} ${found === 1 ? 'card' : 'cards'}` : 'Create set'}
          </button>
          {found === 0 && <p className="text-sm text-navy/70">No notes to paste? Create the set and type the cards in.</p>}
        </form>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="starter-heading">
        <h2 id="starter-heading" className="text-xl font-semibold text-navy">
          Starter sets
        </h2>
        <p className="text-sm text-navy/70">Ready-made sets for your classes. Add one to get your own copy, which you can change.</p>
        {starterError && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {starterError}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {starterDecks().map((deck) => {
            const mine = titles.get(deck.title)
            return (
              <li key={deck.id} className="flex flex-col gap-2 rounded-2xl border border-navy-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold text-navy">{deck.title}</span>
                  <span className="text-sm text-navy/70">
                    {deck.cards.length} cards · {deck.blurb}
                  </span>
                </div>
                {mine ? (
                  <Link to={`/study/${mine}`} className={`${btnSecondary} sm:shrink-0`} aria-label={`Open ${deck.title}`}>
                    Open
                  </Link>
                ) : (
                  <button type="button" onClick={() => onAddStarter(deck.id)} className={`${btnSecondary} sm:shrink-0`} aria-label={`Add ${deck.title}`}>
                    Add
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="import-heading">
        <h2 id="import-heading" className="text-xl font-semibold text-navy">
          Got a code from a classmate?
        </h2>
        <ImportPanel />
      </section>
    </div>
  )
}
