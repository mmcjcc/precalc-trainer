import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useLayout } from './useBreakpoint'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Sheet id so a toolbar button can set aria-controls. */
  id?: string
}

/**
 * Modal bottom sheet (UX-03). The keyboard and the sheet are never open together: opening blurs
 * the active input first. Esc / backdrop / close button close it; focus returns to the opener.
 * The layout decides how it looks: from the bottom of the screen in the phone layout, a centred
 * dialog in the tablet layout (840 px and more). What is in it never knows.
 */
export function BottomSheet({ open, onClose, title, children, id }: Props) {
  const autoId = useId()
  const sheetId = id ?? `sheet-${autoId}`
  const titleId = `${sheetId}-title`
  const panelRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement
    // Close the on-screen keyboard before the sheet slides up.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusTimer = setTimeout(() => panelRef.current?.focus({ preventScroll: true }), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
      const opener = openerRef.current
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus({ preventScroll: true })
    }
  }, [open, onClose])

  const dialog = useLayout() === 'tablet'
  if (!open) return null
  return (
    <div className={`fixed inset-0 z-40 flex justify-center ${dialog ? 'items-center p-6' : 'items-end'}`} data-sheet={dialog ? 'dialog' : 'sheet'}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-navy/40" tabIndex={-1} />
      <div
        ref={panelRef}
        id={sheetId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full max-w-lg overflow-y-auto bg-white p-4 shadow-2xl outline-none ${
          dialog ? 'max-h-[min(85dvh,48rem)] rounded-2xl' : 'max-h-[85dvh] rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]'
        }`}
      >
        {!dialog && <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-navy-100" aria-hidden />}
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold text-navy">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-navy hover:bg-navy-100"
            aria-label="Close"
          >
            <span aria-hidden className="text-xl">
              ×
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
