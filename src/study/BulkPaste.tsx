import { useMemo, useRef, useState } from 'react'
import { BULK_SPLIT_LABELS, parseBulkCards, type BulkFound, type BulkResult, type BulkSplit } from '@/study/bulk'
import { shrinkPhoto } from '@/study/photo'
import { btnSecondary, fieldClass, textClass } from '@/study/ui'
import { STUDY_LIMITS, type StudyDraftCard } from '@/store/studySets'
import { cardsFromPhoto } from '@/tutor/api'
import { useTutorStatus } from '@/tutor/useTutorStatus'

const SPLITS: readonly BulkSplit[] = ['auto', 'dash', 'colon', 'tab', 'equals', 'lines']

const FOUND: Readonly<Record<BulkFound, string>> = {
  tab: 'a tab',
  dash: 'a dash',
  colon: 'a colon',
  equals: 'an equals sign',
  lines: 'a new line',
}

export interface BulkDraft {
  text: string
  setText: (text: string) => void
  split: BulkSplit
  setSplit: (split: BulkSplit) => void
  /** Cards read from photos of her notes; they follow the pasted ones. */
  photoCards: readonly StudyDraftCard[]
  addPhotoCards: (cards: readonly StudyDraftCard[]) => void
  dropPhotoCards: () => void
  /** Every card the box holds: the pasted ones, then the photos'. */
  result: BulkResult
  clear: () => void
}

/** The paste box's state: her text, her choice of separator, cards from photos, and the cards they all make. `room` is the space left in the set. */
export function useBulkDraft(room: number): BulkDraft {
  const [text, setText] = useState('')
  const [split, setSplit] = useState<BulkSplit>('auto')
  const [photoCards, setPhotoCards] = useState<StudyDraftCard[]>([])
  const result = useMemo(() => {
    const pasted = parseBulkCards(text, split, room)
    const space = Math.max(0, room - pasted.cards.length)
    const fromPhotos = photoCards.slice(0, space)
    return { ...pasted, cards: [...pasted.cards, ...fromPhotos], overflow: pasted.overflow + (photoCards.length - fromPhotos.length) }
  }, [text, split, room, photoCards])
  return {
    text,
    setText,
    split,
    setSplit,
    photoCards,
    addPhotoCards: (cards) => setPhotoCards((prev) => [...prev, ...cards]),
    dropPhotoCards: () => setPhotoCards([]),
    result,
    clear: () => {
      setText('')
      setSplit('auto')
      setPhotoCards([])
    },
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * A photo of her notes, read into cards by the tutor (one of the day's tutor questions). Shown only
 * where a tutor that can read photos is running; the photo is shrunk in the browser first and is
 * not kept anywhere.
 */
function PhotoCards({ draft }: { draft: BulkDraft }) {
  const tutor = useTutorStatus()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null)
  const [left, setLeft] = useState<number | null>(null)

  if (!tutor.status?.configured || !tutor.status.photoCards) return null
  const remaining = left ?? tutor.status.remaining

  async function onFile(file: File | undefined) {
    if (!file || busy) return
    setBusy(true)
    setNote(null)
    try {
      let image
      try {
        image = await shrinkPhoto(file)
      } catch {
        setNote({ tone: 'bad', text: "That file isn't a photo this device can open. Try a JPEG or PNG." })
        return
      }
      const result = await cardsFromPhoto(image)
      if (!result.ok) {
        setNote({ tone: 'bad', text: result.message })
        return
      }
      setLeft(result.remaining)
      if (result.cards.length === 0) {
        setNote({ tone: 'bad', text: "I couldn't find any notes to read in that photo. Try a closer, brighter photo of one page." })
        return
      }
      draft.addPhotoCards(result.cards)
      setNote({ tone: 'ok', text: `Read ${plural(result.cards.length, 'card', 'cards')} from your photo. Handwriting is easy to misread: check them after you add them.` })
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-navy-100 p-3" data-photo-cards="">
      <p className="font-semibold text-navy">Or start from a photo of your notes</p>
      <p className="text-sm text-navy/70">
        The tutor reads the page and writes the cards. It uses one of today's tutor questions ({remaining} left), and the photo is not kept.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Photo of your notes"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        className={`${btnSecondary} disabled:cursor-not-allowed disabled:opacity-40`}
        disabled={busy || remaining === 0}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Reading your notes…' : draft.photoCards.length > 0 ? 'Add another photo' : 'Take or choose a photo'}
      </button>
      {note && (
        <p role={note.tone === 'bad' ? 'alert' : 'status'} className={`text-sm font-semibold ${note.tone === 'bad' ? 'text-bad' : 'text-ok'}`}>
          {note.text}
        </p>
      )}
    </div>
  )
}

/**
 * The paste box and what it found: a few of the cards, and every line it could not use. The page
 * around it owns the button that adds them, so nothing is added while she is still pasting.
 */
export function BulkPaste({ draft, label = 'Paste your notes' }: { draft: BulkDraft; label?: string }) {
  const { text, setText, split, setSplit, result, photoCards } = draft
  const shown = result.cards.slice(0, 4)
  const typed = text.trim() !== ''
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-semibold text-navy">{label}</span>
        <span className="text-sm text-navy/70">
          One card per line, like <span className="font-semibold">term - definition</span>. A list copied from Quizlet, Google Docs or a spreadsheet works too.
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          aria-label={label}
          placeholder={'Photon - a particle of light\nOrbital - where an electron probably is'}
          className={`${fieldClass} text-sm`}
        />
      </label>
      <PhotoCards draft={draft} />
      {(typed || photoCards.length > 0) && (
        <div className="flex flex-col gap-3 rounded-2xl border border-navy-100 bg-navy-50 p-3" data-bulk-preview="">
          <p className="font-semibold text-navy" data-bulk-count={result.cards.length}>
            {result.cards.length === 0 ? 'No cards found yet.' : `${plural(result.cards.length, 'card', 'cards')} found`}
            {result.cards.length > 0 && typed && split === 'auto' && result.split ? (
              <span className="font-normal text-navy/70"> · split at {FOUND[result.split]}</span>
            ) : null}
            {photoCards.length > 0 ? <span className="font-normal text-navy/70"> · {photoCards.length} from your photo</span> : null}
          </p>
          {result.cards.length === 0 && (
            <p className="text-sm text-navy">Put each card on its own line, with a dash, a colon or a tab between the term and its definition.</p>
          )}
          {shown.length > 0 && (
            <ol className="flex flex-col gap-2">
              {shown.map((card, i) => (
                <li key={i} className="rounded-xl bg-white px-3 py-2">
                  <p className={`font-semibold text-navy ${textClass}`}>{card.term}</p>
                  <p className={`text-sm text-navy/80 ${textClass}`}>{card.definition}</p>
                </li>
              ))}
            </ol>
          )}
          {result.cards.length > shown.length && <p className="text-sm text-navy/70">and {result.cards.length - shown.length} more</p>}
          {result.skipped.length > 0 && (
            <p className="text-sm text-navy">
              {plural(result.skipped.length, 'line', 'lines')} left out (no definition found): {result.skipped.slice(0, 3).join(' · ')}
              {result.skipped.length > 3 ? ' …' : ''}
            </p>
          )}
          {result.clipped > 0 && <p className="text-sm text-navy">{plural(result.clipped, 'card was', 'cards were')} shortened to fit a card.</p>}
          {result.overflow > 0 && (
            <p className="text-sm font-semibold text-bad">
              {plural(result.overflow, 'card does', 'cards do')} not fit: a set holds {STUDY_LIMITS.maxCards} cards.
            </p>
          )}
          {photoCards.length > 0 && (
            <button type="button" className="self-start text-sm font-semibold text-navy underline" onClick={draft.dropPhotoCards}>
              Remove the photo's cards
            </button>
          )}
          {typed && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-navy">Cards look wrong? Tell it what sits between a term and its definition</span>
              <select value={split} onChange={(e) => setSplit(e.target.value as BulkSplit)} aria-label="What separates a term from its definition" className={fieldClass}>
                {SPLITS.map((s) => (
                  <option key={s} value={s}>
                    {BULK_SPLIT_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )
}
