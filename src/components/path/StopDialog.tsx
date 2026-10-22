import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { SkillRing, ringWords } from '@/components/rewards/Rings'
import type { PathStop } from './pathModel'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)]
}

/**
 * A stop's small dialog: the type's title (its module above it), its ring and state in words, "You are here" where
 * the next set starts, "Practice this type" (a problem of that type, as the module page's Start gives) and "About
 * this module" (the module page). A bottom sheet on a phone, a popover under the stop on a wide screen; either way it
 * keeps focus inside (Tab and Shift+Tab go round), closes with Escape, its close button or a tap outside, and gives
 * focus back to the stop. Nothing in it is ever disabled.
 */
export function StopDialog({
  stop,
  here,
  variant,
  style,
  returnFocus,
  onClose,
  onPractice,
}: {
  stop: PathStop
  here: boolean
  variant: 'sheet' | 'popover'
  /** The popover's place under its stop (the path row places it). */
  style?: CSSProperties
  /** The stop that opened it: focus goes back there on close. */
  returnFocus: HTMLElement | null
  onClose: () => void
  onPractice: () => void
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // The latest close, so the effect below runs once per dialog however often the page re-renders.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const panel = panelRef.current
    panel?.focus({ preventScroll: true })
    if (variant === 'popover') panel?.scrollIntoView?.({ block: 'nearest' })
    let overflow: string | null = null
    if (variant === 'sheet') {
      overflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
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
      if (overflow !== null) document.body.style.overflow = overflow
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true })
    }
  }, [variant, returnFocus])

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

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-coral-700">{stop.moduleTitle}</p>
          <h2 id={titleId} className="mt-0.5 text-lg font-semibold text-navy">
            {stop.title}
          </h2>
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
      <div className="mt-3 flex items-center gap-3">
        {/* The ring is a picture of the words beside it. */}
        <span aria-hidden className="inline-flex">
          <SkillRing ring={stop.ring} title={stop.title} size={56} />
        </span>
        <p className="text-sm text-navy" data-stop-state-words="">
          {ringWords(stop.ring)}
        </p>
      </div>
      {here && (
        <p className="mt-3 rounded-xl border border-gold bg-gold-100 px-3 py-2 text-sm font-semibold text-navy">
          You are here: your next set starts with this type.
        </p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPractice}
          className="btn-chunky min-h-12 rounded-xl bg-navy px-4 font-semibold text-white hover:bg-navy-600"
        >
          Practice this type
        </button>
        <Link
          to={`/m/${stop.moduleId}`}
          className="flex min-h-12 items-center justify-center rounded-xl border border-navy-100 bg-white px-4 font-semibold text-navy hover:bg-navy-50"
        >
          About this module
        </Link>
      </div>
    </>
  )

  if (variant === 'sheet') {
    return (
      <div className="fixed inset-0 z-40 flex items-end justify-center" data-path-sheet="">
        <div aria-hidden className="absolute inset-0 bg-navy/40" onClick={onClose} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={trap}
          className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl outline-none"
        >
          <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-navy-100" />
          {body}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* A tap anywhere outside closes it. */}
      <div aria-hidden className="fixed inset-0 z-30" onClick={onClose} data-path-popover-backdrop="" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trap}
        style={style}
        data-path-popover=""
        className="absolute z-40 w-72 max-w-[calc(100vw_-_2rem)] -translate-x-1/2 rounded-2xl border border-navy-100 bg-white p-4 text-left shadow-xl outline-none"
      >
        <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-navy-100 bg-white" />
        {body}
      </div>
    </>
  )
}
