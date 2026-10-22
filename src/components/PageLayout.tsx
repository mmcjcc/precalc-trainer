import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BottomSheet } from './BottomSheet'
import { useKeypadStore } from './keypadStore'
import { useLayout } from './useBreakpoint'

export interface RailPanel {
  id: string
  title: string
  /** Short label for the mobile toolbar button (defaults to title). */
  short?: string
  content: ReactNode
}

type Props = {
  /**
   * The problem: its header and card, with its figure or graph. The phone layout: the top of the column. The tablet
   * layout: the top of the left pane, over its tools.
   */
  problem: ReactNode
  /**
   * Her work (lines, parts, answers, the completion card). The phone layout: the column under the problem. The tablet
   * layout: the right pane, which scrolls on its own.
   */
  children: ReactNode
  /**
   * The composer. The phone layout: docked at the end of the column, on the keypad. The tablet layout: under her work in
   * the right pane, with the keypad docked under it (not across the screen).
   */
  composer?: ReactNode
  /** At the end of her work (the idle nudge on a screen without a composer). */
  after?: ReactNode
  /** The tools: stacked in the left pane in the tablet layout, bottom sheets from a toolbar in the phone layout. */
  rail?: RailPanel[]
  /** Controlled open panel (for Ctrl+Shift+G / C). Uncontrolled when omitted. */
  openPanel?: string | null
  onOpenPanel?: (id: string | null) => void
  /** Where to put the mobile toolbar: rendered by the caller (e.g. inside Composer) when 'none'. */
  mobileToolbar?: 'top' | 'none'
  /**
   * The scratch pad, in the tablet layout: a second view of the left pane ("Scratch pad", beside "Tools"), never over
   * her work. The phone layout takes it as one more panel of the rail (a sheet from the tools row).
   */
  scratch?: ReactNode
  /** Outside the column and the panes: the pinned problem, the sheets. */
  overlays?: ReactNode
}

/** The panes fill the window from where they start down to its bottom; returns that height and the page's padding. */
function useFillHeight(ref: RefObject<HTMLElement | null>, on: boolean): { height: number; pad: number } {
  const [size, setSize] = useState({ height: 640, pad: 0 })
  useLayoutEffect(() => {
    if (!on) return
    const measure = () => {
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const view = window.visualViewport?.height ?? window.innerHeight
      const main = el.closest('main')
      const pad = main ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0
      const height = Math.max(360, Math.floor(view - top - 16))
      setSize((s) => (s.height === height && s.pad === pad ? s : { height, pad }))
    }
    measure()
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [ref, on])
  return size
}

/**
 * The work pane keeps her newest line in view: when her work grows (a line kept, a verdict) while she was at its end,
 * the pane follows it to its new end, as a conversation does. Scrolled up to read, it stays where she is.
 */
function useFollowEnd(ref: RefObject<HTMLElement | null>, on: boolean): void {
  useEffect(() => {
    const el = ref.current
    if (!on || !el || typeof MutationObserver !== 'function') return
    let atEnd = true
    const toEnd = () => {
      el.scrollTop = el.scrollHeight
    }
    toEnd()
    const onScroll = () => {
      atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 64
    }
    const observer = new MutationObserver(() => {
      if (atEnd) toEnd()
    })
    observer.observe(el, { childList: true, subtree: true, characterData: true })
    // The pane gets shorter when the keypad docks under it (or the window turns): at the end it stays at the end.
    const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => atEnd && toEnd()) : null
    resized?.observe(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      resized?.disconnect()
      el.removeEventListener('scroll', onScroll)
    }
  }, [ref, on])
}

/** The right pane's keypad slot: while it is mounted, the keypad docks here instead of covering the screen. */
function useKeypadSlot(): (el: HTMLDivElement | null) => void {
  const current = useRef<HTMLDivElement | null>(null)
  useEffect(
    () => () => {
      if (current.current) useKeypadStore.getState().setDock(null, current.current)
    },
    [],
  )
  return useCallback((el: HTMLDivElement | null) => {
    const store = useKeypadStore.getState()
    if (el) store.setDock(el)
    else if (current.current) store.setDock(null, current.current)
    current.current = el
  }, [])
}

/** One tools panel as a section of the left pane (the tablet layout). */
function PanelSection({ baseId, panel }: { baseId: string; panel: RailPanel }) {
  return (
    <section id={`${baseId}-${panel.id}`} className="rounded-2xl border border-navy-100 bg-white p-4">
      <h2 className="mb-2 font-semibold text-navy">{panel.title}</h2>
      {panel.content}
    </section>
  )
}

/**
 * The problem screen's layout. The components inside never read the screen size; this decides:
 * - the phone layout (below 840 px): one column, the problem, her work, then the composer docked at the bottom; the
 *   tools are bottom sheets from a toolbar (in the composer, or under the problem);
 * - the tablet layout (840 px and more): two panes that fill the window and scroll on their own. Left: the problem, its
 *   figure or graph, and its tools (Hints, Graph, Calculator, Rule cards...) stacked under it, with the scratch pad as a
 *   second view. Right: her work, the composer under it and the keypad docked at the bottom of the pane.
 */
export function PageLayout({ problem, children, composer, after, rail = [], openPanel, onOpenPanel, mobileToolbar = 'top', scratch, overlays }: Props) {
  const tablet = useLayout() === 'tablet'
  const [internalOpen, setInternalOpen] = useState<string | null>(null)
  const baseId = useId()
  const open = openPanel !== undefined ? openPanel : internalOpen
  const setOpen = (id: string | null) => {
    setInternalOpen(id)
    onOpenPanel?.(id)
  }
  const panesRef = useRef<HTMLDivElement>(null)
  const workRef = useRef<HTMLDivElement>(null)
  const { height, pad } = useFillHeight(panesRef, tablet)
  useFollowEnd(workRef, tablet && Boolean(composer))
  const slotRef = useKeypadSlot()
  // The left pane shows its tools or the scratch pad; asking for a tool (a shortcut, Stuck?) brings the tools back.
  const [view, setView] = useState<'tools' | 'scratch'>('tools')
  useEffect(() => {
    if (open) setView('tools')
  }, [open])

  if (tablet) {
    const tools = (
      <aside className="space-y-4" aria-label="Side panels">
        {rail.map((p) => (
          <PanelSection key={p.id} baseId={baseId} panel={p} />
        ))}
      </aside>
    )
    return (
      <>
        <div
          ref={panesRef}
          data-panes=""
          className="grid grid-cols-[minmax(0,9fr)_minmax(0,11fr)] gap-5"
          style={{ height, marginBottom: pad ? -pad + 16 : undefined }}
        >
          <section aria-label="Problem and tools" data-pane="problem" className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pb-4 pr-1">
            {problem}
            {scratch ? (
              <>
                <div role="tablist" aria-label="Problem tools" className="flex gap-1 rounded-xl bg-navy-50 p-1" data-pane-views="">
                  {(['tools', 'scratch'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      id={`${baseId}-view-${v}`}
                      aria-selected={view === v}
                      aria-controls={`${baseId}-viewpanel-${v}`}
                      onClick={() => setView(v)}
                      className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-semibold ${view === v ? 'bg-white text-navy shadow-sm' : 'text-navy/70 hover:text-navy'}`}
                    >
                      {v === 'tools' ? 'Tools' : 'Scratch pad'}
                    </button>
                  ))}
                </div>
                <div role="tabpanel" id={`${baseId}-viewpanel-tools`} aria-labelledby={`${baseId}-view-tools`} hidden={view !== 'tools'}>
                  {tools}
                </div>
                <div role="tabpanel" id={`${baseId}-viewpanel-scratch`} aria-labelledby={`${baseId}-view-scratch`} hidden={view !== 'scratch'}>
                  {view === 'scratch' && scratch}
                </div>
              </>
            ) : (
              tools
            )}
          </section>
          <section aria-label="Your working" data-pane="work" className="flex min-h-0 flex-col">
            <div ref={workRef} data-pane-scroll="" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-3 pr-1">
              {children}
              {after}
            </div>
            {composer && <div className="shrink-0 pt-3">{composer}</div>}
            <div ref={slotRef} data-keypad-slot="" className="shrink-0 [&:not(:empty)]:pt-3" />
          </section>
        </div>
        {overlays}
      </>
    )
  }

  const current = rail.find((p) => p.id === open) ?? null
  return (
    <div className="mx-auto w-full max-w-3xl">
      {mobileToolbar === 'top' && rail.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Side panels">
          {rail.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setOpen(p.id)}
              aria-haspopup="dialog"
              className="min-h-11 rounded-lg border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50"
            >
              {p.short ?? p.title}
            </button>
          ))}
        </div>
      )}
      {/* With a composer the column fills the screen and the composer sits at its end, on the keypad (index.css). */}
      <div data-problem-column="" className={composer ? 'phone-problem-column flex flex-col space-y-4' : 'space-y-4'}>
        {problem}
        {children}
        {composer}
        {after}
      </div>
      {overlays}
      <BottomSheet open={current !== null} onClose={() => setOpen(null)} title={current?.title ?? ''}>
        {current?.content}
      </BottomSheet>
    </div>
  )
}

/** Toolbar buttons for the mobile composer when the page renders them itself (mobileToolbar='none'). */
export function RailToolbar({ rail, onOpen }: { rail: RailPanel[]; onOpen: (id: string) => void }) {
  return (
    <>
      {rail.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onOpen(p.id)}
          aria-haspopup="dialog"
          className="min-h-11 rounded-lg border border-navy-100 bg-white px-3 text-sm font-semibold text-navy hover:bg-navy-50"
        >
          {p.short ?? p.title}
        </button>
      ))}
    </>
  )
}
