import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import type { LineCard } from '@/problem/lineCards'
import type { LineEntry } from '@/store'
import { ComposerExtra } from './Composer'
import { notePress } from './keypadStore'
import { Katex } from './Katex'

/**
 * Guided mode (docs/progress/phone-guided.md): the next line picked from three cards instead of typed. None of these
 * pieces reads the screen size; the page layout places them (a tablet layout can place them differently).
 */

const ENTRIES: { value: LineEntry; label: string }[] = [
  { value: 'type', label: 'Type' },
  { value: 'pick', label: 'Pick' },
]

/** "Type" / "Pick", with what Pick means under it. Arrow keys move between the two, as in any radio group. */
export function LineEntrySwitch({ value, onChange }: { value: LineEntry; onChange: (value: LineEntry) => void }) {
  const captionId = useId()
  const refs = useRef<Partial<Record<LineEntry, HTMLButtonElement | null>>>({})
  const onKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next: LineEntry = value === 'type' ? 'pick' : 'type'
    onChange(next)
    refs.current[next]?.focus()
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-line-entry="">
      <div
        role="radiogroup"
        aria-label="How you write each line"
        aria-describedby={captionId}
        onKeyDown={onKeyDown}
        className="inline-flex shrink-0 rounded-xl border border-navy-100 bg-navy-50 p-1"
      >
        {ENTRIES.map((entry) => {
          const on = value === entry.value
          return (
            <button
              key={entry.value}
              ref={(el) => {
                refs.current[entry.value] = el
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(entry.value)}
              className={`min-h-10 min-w-16 rounded-lg px-3 text-sm font-semibold ${on ? 'bg-navy text-white' : 'text-navy hover:bg-white'}`}
            >
              {entry.label}
            </button>
          )
        })}
      </div>
      <p id={captionId} className="text-xs text-navy/70">
        Pick: choose each next line from three (counts less)
      </p>
    </div>
  )
}

/**
 * "Guide me" on the composer: ON shows the cards for every line; OFF she types, and the cards stay in Hints.
 * Remembered as settings.lineEntry. Only rendered by GuidedStep on types that have a card source.
 */
export function GuideSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const captionId = useId()
  const labelId = useId()
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1" data-guide-switch="" data-line-entry="">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        aria-describedby={captionId}
        onClick={() => onChange(!on)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-1 font-semibold text-navy hover:bg-navy-50"
      >
        <span
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 ${on ? 'border-navy bg-navy' : 'border-navy-100 bg-navy-50'}`}
          aria-hidden
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </span>
        <span id={labelId}>Guide me</span>
      </button>
      <p id={captionId} className="text-xs text-navy/70">
        {on ? 'On: pick each next line from three (counts less)' : 'Off: type your lines. Cards stay in Hints.'}
      </p>
    </div>
  )
}

/**
 * The composer/step area for a type that offers cards: the Guide me switch, then either the cards or the
 * typing children. Lives in the composer (not ProblemFrame) so another builder can redesign the desktop
 * problem screen without moving the switch.
 */
export function GuidedStep({
  offers,
  guidedOn,
  onGuideChange,
  showingCards,
  lineKey,
  cards,
  onPick,
  onType,
  showBack,
  onBack,
  typedNote,
  noteExtra,
  inputRef,
  children,
}: {
  offers: boolean
  guidedOn: boolean
  onGuideChange: (on: boolean) => void
  showingCards: boolean
  lineKey: number
  cards: readonly LineCard[]
  onPick: (card: LineCard) => void
  onType: () => void
  showBack: boolean
  onBack: () => void
  typedNote: string | null
  noteExtra?: ReactNode
  inputRef?: RefObject<HTMLInputElement | null>
  children: ReactNode
}) {
  const focusBoxNext = useRef(false)
  function typeInstead() {
    focusBoxNext.current = true
    onType()
  }
  useEffect(() => {
    if (!focusBoxNext.current || showingCards) return
    focusBoxNext.current = false
    const box = inputRef?.current
    if (!box) return
    notePress()
    if (document.activeElement === box) box.blur()
    box.focus({ preventScroll: true })
  }, [showingCards, inputRef])
  return (
    <>
      {offers && (
        <ComposerExtra>
          <GuideSwitch on={guidedOn} onChange={onGuideChange} />
        </ComposerExtra>
      )}
      {showingCards ? (
        <LineCards key={lineKey} cards={cards} onPick={onPick} onType={typeInstead} />
      ) : (
        <>
          {typedNote && (
            <ComposerExtra>
              <p className="mb-2 text-sm text-navy/80" data-typed-note="">
                {typedNote}
                {noteExtra}
              </p>
            </ComposerExtra>
          )}
          {children}
          {showBack && (
            <ComposerExtra>
              <button type="button" onClick={onBack} className="mt-2 min-h-11 rounded-lg px-2 text-sm font-semibold text-navy underline hover:bg-navy-50">
                Back to the cards
              </button>
            </ComposerExtra>
          )}
        </>
      )}
    </>
  )
}

/**
 * The cards for one line, full width, in the order they come in (fixed by the problem's seed and the line). A tap
 * picks a card; "Type it yourself instead" puts this line on the keypad.
 */
export function LineCards({ cards, onPick, onType }: { cards: readonly LineCard[]; onPick: (card: LineCard) => void; onType: () => void }) {
  const headingId = useId()
  const listRef = useRef<HTMLUListElement>(null)
  // When focus is nowhere (the card she tapped left the list, or a new line's cards came in), it goes to the first
  // card, not to the page: keyboards and screen readers carry on from there. Give each line its own `key`, so the
  // right card's button never carries focus over to the next line.
  useEffect(() => {
    const active = document.activeElement
    if (active === null || active === document.body) listRef.current?.querySelector('button')?.focus({ preventScroll: true })
  }, [cards.length])
  return (
    <div className="space-y-2" data-line-cards="">
      <p id={headingId} className="text-sm font-semibold text-navy">
        Pick the next line
      </p>
      <ul ref={listRef} aria-labelledby={headingId} className="space-y-2">
        {cards.map((card) => (
          <li key={card.key}>
            <button
              type="button"
              onClick={() => onPick(card)}
              aria-label={card.text}
              className="flex min-h-14 w-full items-center overflow-x-auto rounded-xl border-2 border-navy-100 bg-white px-4 py-2 text-left text-lg text-navy hover:border-navy hover:bg-navy-50 focus-visible:border-navy"
            >
              <Katex tex={card.latex} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onType} className="min-h-11 rounded-lg px-2 text-sm font-semibold text-navy underline hover:bg-navy-50">
        Type it yourself instead
      </button>
    </div>
  )
}

/**
 * In the hints, first, while she types: the cards for this one line, then back to typing. Stuck? opens the hints, so
 * this is the first thing it offers; the hint ladder under it is unchanged.
 */
export function PickLineOffer({ onPick }: { onPick: () => void }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-white p-3" data-pick-offer="">
      <button
        type="button"
        onClick={onPick}
        className="min-h-11 w-full rounded-xl border-2 border-navy bg-white px-3 font-semibold text-navy hover:bg-navy-50"
      >
        Pick the next line
      </button>
      <p className="mt-1 text-xs text-navy/70">Three next lines, one of them right: pick it, then type again. A picked line counts less.</p>
    </div>
  )
}
