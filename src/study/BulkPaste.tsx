import { useMemo, useState } from 'react'
import { BULK_SPLIT_LABELS, parseBulkCards, type BulkFound, type BulkResult, type BulkSplit } from '@/study/bulk'
import { fieldClass, textClass } from '@/study/ui'
import { STUDY_LIMITS } from '@/store/studySets'

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
  result: BulkResult
  clear: () => void
}

/** The paste box's state: her text, her choice of separator, and the cards they make. `room` is the space left in the set. */
export function useBulkDraft(room: number): BulkDraft {
  const [text, setText] = useState('')
  const [split, setSplit] = useState<BulkSplit>('auto')
  const result = useMemo(() => parseBulkCards(text, split, room), [text, split, room])
  return {
    text,
    setText,
    split,
    setSplit,
    result,
    clear: () => {
      setText('')
      setSplit('auto')
    },
  }
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * The paste box and what it found: a few of the cards, and every line it could not use. The page
 * around it owns the button that adds them, so nothing is added while she is still pasting.
 */
export function BulkPaste({ draft, label = 'Paste your notes' }: { draft: BulkDraft; label?: string }) {
  const { text, setText, split, setSplit, result } = draft
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
      {typed && (
        <div className="flex flex-col gap-3 rounded-2xl border border-navy-100 bg-navy-50 p-3" data-bulk-preview="">
          <p className="font-semibold text-navy" data-bulk-count={result.cards.length}>
            {result.cards.length === 0 ? 'No cards found yet.' : `${plural(result.cards.length, 'card', 'cards')} found`}
            {result.cards.length > 0 && split === 'auto' && result.split ? (
              <span className="font-normal text-navy/70"> · split at {FOUND[result.split]}</span>
            ) : null}
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
        </div>
      )}
    </div>
  )
}
