import { useState } from 'react'
import { parseStudyCode, STUDY_CODE_ERROR, type ParsedStudyCode } from '@/study/code'
import { btnPrimary, btnSecondary, fieldClass, textClass } from '@/study/ui'
import { blankCardsNote } from '@/store/studySets'
import { useStore } from '@/store'

/** Paste a share code, see what it is, then add a copy to this device. */
export function ImportPanel({ onAdded }: { onAdded?: (id: string) => void }) {
  const createStudySet = useStore((s) => s.createStudySet)
  const toast = useStore((s) => s.toast)
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedStudyCode | null>(null)

  function preview() {
    setParsed(parseStudyCode(text))
  }

  function add() {
    if (!parsed?.ok) return
    const result = createStudySet({
      title: parsed.set.title,
      source: 'imported',
      cards: parsed.set.cards.map((card) => ({ term: card.term, definition: card.definition })),
    })
    if (!result.ok) {
      setParsed({ ok: false, error: result.error })
      return
    }
    if (result.dropped > 0) toast(blankCardsNote(result.dropped), { tone: 'info' })
    toast('Added to your study sets.', { tone: 'ok' })
    onAdded?.(result.set.id)
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        preview()
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="font-semibold text-navy">Paste the share code</span>
        <span className="text-sm text-navy/70">A share code is the block of letters a classmate copies from the bottom of their set. To make cards from your own notes, use "Make a new set" instead.</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setParsed(null)
          }}
          rows={4}
          spellCheck={false}
          aria-label="Share code"
          className={`${fieldClass} font-mono text-sm`}
        />
      </label>
      <button type="submit" className={btnSecondary}>
        Show the set
      </button>
      {parsed && !parsed.ok && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {parsed.error || STUDY_CODE_ERROR}
        </p>
      )}
      {parsed?.ok && (
        <div className="flex flex-col gap-3 rounded-2xl border border-navy-100 bg-white p-4">
          <h2 className="text-lg font-semibold text-navy">{parsed.set.title}</h2>
          <p className="text-sm text-navy/80">
            {parsed.set.cards.length} {parsed.set.cards.length === 1 ? 'card' : 'cards'}
          </p>
          {parsed.set.cards.length > 0 && (
            <ol className="flex flex-col gap-2">
              {parsed.set.cards.slice(0, 3).map((card, i) => (
                <li key={i} className="rounded-xl bg-navy-50 px-3 py-2">
                  <p className={`font-semibold text-navy ${textClass}`}>{card.term}</p>
                  <p className={`text-sm text-navy/80 ${textClass}`}>{card.definition}</p>
                </li>
              ))}
            </ol>
          )}
          <button type="button" onClick={add} className={btnPrimary}>
            Add to my sets
          </button>
        </div>
      )}
    </form>
  )
}
