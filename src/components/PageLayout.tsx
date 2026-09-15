import { useId, useState, type ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'
import { useBreakpoint } from './useBreakpoint'

export interface RailPanel {
  id: string
  title: string
  /** Short label for the mobile toolbar button (defaults to title). */
  short?: string
  content: ReactNode
}

type Props = {
  children: ReactNode
  /** Right-rail panels: stacked ≥1024px, tabs 768–1023px, bottom-sheet toolbar <768px. */
  rail?: RailPanel[]
  /** Controlled open panel (for Ctrl+Shift+G / C). Uncontrolled when omitted. */
  openPanel?: string | null
  onOpenPanel?: (id: string | null) => void
  /** Where to put the mobile toolbar: rendered by the caller (e.g. inside Composer) when 'none'. */
  mobileToolbar?: 'top' | 'none'
}

/**
 * Page grid: single column mobile-first, 640px steps column + 360px right rail on desktop.
 * The rail is a slot; pages hand in panels and get the right presentation per breakpoint.
 */
export function PageLayout({ children, rail = [], openPanel, onOpenPanel, mobileToolbar = 'top' }: Props) {
  const bp = useBreakpoint()
  const [internalOpen, setInternalOpen] = useState<string | null>(null)
  const [tab, setTab] = useState<string>(rail[0]?.id ?? '')
  const baseId = useId()
  const open = openPanel !== undefined ? openPanel : internalOpen
  const setOpen = (id: string | null) => {
    setInternalOpen(id)
    onOpenPanel?.(id)
  }

  if (rail.length === 0) return <div className="mx-auto w-full max-w-3xl">{children}</div>

  if (bp === 'desktop') {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,640px)_360px] lg:justify-center">
        <div className="min-w-0">{children}</div>
        <aside className="space-y-4" aria-label="Side panels">
          {rail.map((p) => (
            <section key={p.id} id={`${baseId}-${p.id}`} className="rounded-2xl border border-navy-100 bg-white p-4">
              <h2 className="mb-2 font-semibold text-navy">{p.title}</h2>
              {p.content}
            </section>
          ))}
        </aside>
      </div>
    )
  }

  if (bp === 'tablet') {
    const active = rail.find((p) => p.id === tab) ?? rail[0]!
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div className="min-w-0">{children}</div>
        <div role="tablist" aria-label="Side panels" className="flex flex-wrap gap-2 border-b border-navy-100">
          {rail.map((p) => (
            <button
              key={p.id}
              role="tab"
              type="button"
              id={`${baseId}-tab-${p.id}`}
              aria-selected={active.id === p.id}
              aria-controls={`${baseId}-panel-${p.id}`}
              onClick={() => setTab(p.id)}
              className={`min-h-11 border-b-2 px-3 text-sm font-semibold ${active.id === p.id ? 'border-navy text-navy' : 'border-transparent text-navy/60 hover:text-navy'}`}
            >
              {p.short ?? p.title}
            </button>
          ))}
        </div>
        <section role="tabpanel" id={`${baseId}-panel-${active.id}`} aria-labelledby={`${baseId}-tab-${active.id}`} className="rounded-2xl border border-navy-100 bg-white p-4">
          {active.content}
        </section>
      </div>
    )
  }

  const current = rail.find((p) => p.id === open) ?? null
  return (
    <div className="mx-auto w-full max-w-3xl">
      {mobileToolbar === 'top' && (
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
      {children}
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
