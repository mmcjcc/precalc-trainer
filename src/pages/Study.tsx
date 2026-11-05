import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ImportPanel } from '@/study/ImportPanel'
import { btnPrimary, fieldClass } from '@/study/ui'
import { useStore } from '@/store'

/** Her decks: make one, open it, or bring in a classmate's code. */
export function StudyPage() {
  const sets = useStore((s) => s.studySets)
  const createStudySet = useStore((s) => s.createStudySet)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ordered = sets.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title))

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
