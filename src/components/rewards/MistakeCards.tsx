import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { SQUASH_AFTER, type MistakeCard } from '@/store'
import { patternTitle, practicePath, skillTitle } from './words'

function times(n: number): string {
  return n === 1 ? 'caught once' : n === 2 ? 'caught twice' : `caught ${n} times`
}

/** Three dots: one filled for each clean finished problem since she last made the mistake. */
function SquashDots({ clean }: { clean: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-1">
      {Array.from({ length: SQUASH_AFTER }, (_, i) => (
        <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < clean ? 'bg-navy' : 'border-2 border-navy-100'}`} />
      ))}
    </span>
  )
}

/**
 * One card of the mistake collection: the catalog title, the problem type, how many times, and Caught with "2 of 3"
 * (clean finished problems of its type since she last made it) or Squashed. With `practice`, the card opens a fresh
 * problem of its type.
 */
export function MistakeCardView({ card, practice = false }: { card: MistakeCard; practice?: boolean }) {
  const href = useMemo(() => (practice && !card.squashed ? practicePath(card.skill) : null), [practice, card.squashed, card.skill])
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="font-semibold text-navy">{patternTitle(card.pattern)}</span>
        {card.squashed ? (
          <span className="shrink-0 rounded-full bg-ok-100 px-2 py-0.5 text-xs font-semibold text-ok">
            <span aria-hidden>✓ </span>Squashed
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-text">Caught</span>
        )}
      </span>
      <span className="mt-0.5 block text-sm text-navy/80">
        {skillTitle(card.skill)} · {times(card.count)}
      </span>
      {!card.squashed && (
        <span className="mt-1.5 flex items-center gap-2 text-sm text-navy">
          <SquashDots clean={card.clean} />
          <span>
            {card.clean} of {SQUASH_AFTER}
            <span className="sr-only"> clean problems to squash it</span>
          </span>
          {href && <span className="ml-auto text-sm font-semibold text-navy underline">Practice</span>}
        </span>
      )}
    </>
  )
  const box = 'block rounded-xl border border-navy-100 bg-white p-3'
  return href ? (
    <Link to={href} data-mistake-card={card.key} className={`${box} hover:border-navy`}>
      {body}
    </Link>
  ) : (
    <div data-mistake-card={card.key} className={box}>
      {body}
    </div>
  )
}

export function MistakeCardList({ cards, practice = false, label }: { cards: readonly MistakeCard[]; practice?: boolean; label: string }) {
  return (
    <ul aria-label={label} className="grid gap-2 sm:grid-cols-2">
      {cards.map((card) => (
        <li key={card.key}>
          <MistakeCardView card={card} practice={practice} />
        </li>
      ))}
    </ul>
  )
}
