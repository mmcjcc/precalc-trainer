import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { practicePath, skillTitle } from '@/components/rewards/words'
import { PatternLesson } from '@/components/SigFigFeedback'
import { ERROR_PATTERNS } from '@/engine'
import type { ErrorPatternId } from '@/shared/types'
import { SQUASH_AFTER, XP, relativeDays } from '@/store'
import { timesCaught, type MonsterEntry } from './collection'
import { MonsterArt } from './MonsterArt'
import type { Species } from './species'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
}

/** Three pips: one filled for each clean problem since she last made the mistake (all three, gold, once squashed). */
export function SquashPips({ pips, squashed, size = 'sm' }: { pips: number; squashed: boolean; size?: 'sm' | 'md' }) {
  const dot = size === 'md' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5'
  return (
    <span aria-hidden="true" className="inline-flex gap-1" data-pips={pips}>
      {Array.from({ length: SQUASH_AFTER }, (_, i) => (
        <span key={i} className={`${dot} rounded-full ${i < pips ? (squashed ? 'bg-gold-text' : 'bg-navy') : 'border-2 border-navy-100 bg-white'}`} />
      ))}
    </span>
  )
}

/** Two little sparkles at a rare monster's corners (decorative). */
export function RareSparkles({ motion }: { motion: boolean }) {
  return (
    <>
      <span aria-hidden className={`pointer-events-none absolute -right-1.5 -top-2 text-base leading-none text-gold-text ${motion ? 'monster-twinkle' : ''}`}>
        ✦
      </span>
      <span
        aria-hidden
        className={`pointer-events-none absolute -bottom-1.5 -left-1 text-xs leading-none text-gold-text ${motion ? 'monster-twinkle' : ''}`}
        style={{ animationDelay: '900ms' }}
      >
        ✦
      </span>
    </>
  )
}

/**
 * A monster's card: its picture, its species' name and character, the mistake's title (its tagline), the catalog
 * lesson and example, how many times and where she last caught it, the squash pips, and "Practice this" (a problem of
 * the type she caught it in). A bottom sheet on a phone, a dialog in the middle on a wide screen; either way it keeps
 * focus inside (Tab and Shift+Tab go round), closes with Escape, its close button or a tap outside, and gives focus
 * back to the tile that opened it. XP is mentioned only with rewards on.
 */
export function MonsterCardDialog({
  monster,
  species,
  variant,
  rewards,
  motion,
  returnFocus,
  onClose,
}: {
  monster: MonsterEntry
  species: Species
  variant: 'sheet' | 'modal'
  rewards: boolean
  motion: boolean
  returnFocus: HTMLElement | null
  onClose: () => void
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const panel = panelRef.current
    panel?.focus({ preventScroll: true })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      closeRef.current()
    }
    // Focus that lands outside (a screen reader's cursor, a click on the page) comes back in.
    const onFocusIn = (e: FocusEvent) => {
      const p = panelRef.current
      if (!p || !(e.target instanceof Node) || p.contains(e.target)) return
      ;(focusables(p)[0] ?? p).focus({ preventScroll: true })
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocusIn)
      document.body.style.overflow = overflow
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true })
    }
  }, [returnFocus])

  function trap(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return
    const panel = panelRef.current
    if (!panel) return
    const items = focusables(panel)
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) {
      e.preventDefault()
      return
    }
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === panel || !panel.contains(active))) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
      e.preventDefault()
      first.focus()
    }
  }

  const squashed = monster.status === 'squashed'
  const practice = monster.practiceSkill ? practicePath(monster.practiceSkill) : null
  const info = monster.id in ERROR_PATTERNS ? ERROR_PATTERNS[monster.id as ErrorPatternId] : null
  const state = squashed ? 'Squashed' : 'On the loose'
  const pipsWords = squashed
    ? `Squashed: ${SQUASH_AFTER} clean problems in a row.`
    : `${monster.pips} of ${SQUASH_AFTER} clean problems to squash it${rewards ? ` (+${XP.squash} XP)` : ''}.`

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`relative inline-flex shrink-0 rounded-2xl p-1 ${squashed ? 'border-2 border-gold bg-gold-100' : 'border border-navy-100 bg-white'} ${monster.rare ? 'monster-rare' : ''}`}>
            <MonsterArt id={monster.id} size={96} sticker />
            {monster.rare && <RareSparkles motion={motion} />}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">
              {state}
              {monster.rare ? ' · Rare' : ''}
            </p>
            <h2 id={titleId} className="mt-0.5 text-xl font-bold text-navy">
              {species.name}
            </h2>
            <p className="mt-0.5 font-semibold text-navy">{monster.title}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-navy hover:bg-navy-100"
        >
          <span aria-hidden className="text-xl">
            ×
          </span>
        </button>
      </div>
      <p className="mt-2 text-sm italic text-navy/80">{species.personality}</p>
      <div className="mt-3 space-y-1 rounded-xl bg-navy-50 p-3 text-sm text-navy" data-monster-record="">
        <p className="flex items-center gap-2">
          <SquashPips pips={monster.pips} squashed={squashed} size="md" />
          <span>{pipsWords}</span>
        </p>
        <p>
          {timesCaught(monster.count)}
          {monster.lastSkill && monster.lastAt !== null && (
            <>
              . Last caught in {skillTitle(monster.lastSkill)}, {relativeDays(monster.lastAt)}
            </>
          )}
          .
        </p>
      </div>
      {info && (
        <div className="mt-3 text-navy" data-monster-lesson="">
          <PatternLesson hit={info} showTitle={false} />
        </div>
      )}
      {practice && (
        <button
          type="button"
          onClick={() => navigate(practicePath(monster.practiceSkill!) ?? practice)}
          className="btn-chunky mt-4 min-h-12 w-full rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
        >
          Practice this
        </button>
      )}
    </>
  )

  return (
    <div className={`fixed inset-0 z-40 flex justify-center ${variant === 'sheet' ? 'items-end' : 'items-center p-4'}`} data-monster-card="">
      <div aria-hidden className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trap}
        className={`relative max-h-[88dvh] w-full overflow-y-auto bg-white p-4 shadow-2xl outline-none ${
          variant === 'sheet' ? 'max-w-lg rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]' : 'max-w-md rounded-2xl'
        }`}
      >
        {variant === 'sheet' && <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-navy-100" />}
        {body}
      </div>
    </div>
  )
}
