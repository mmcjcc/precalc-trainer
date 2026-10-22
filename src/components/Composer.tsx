import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useDockedComposer } from './appChrome'
import { useKeypadStore } from './keypadStore'
import { useLayout } from './useBreakpoint'

/**
 * translateY (px) that pins a bottom-anchored element to the VISUAL viewport while the on-screen
 * keyboard is open (iOS Safari does not resize the layout viewport) — UX-03.
 */
export function useVisualViewportOffset(enabled: boolean): number {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setOffset(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const next = Math.round(vv.offsetTop + vv.height - window.innerHeight)
      setOffset(Math.min(0, next))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return offset
}

/**
 * The phone composer's extras (the verdict line, the nudge, Stuck?, the combo, the tools row, a flow's notes) fold to one
 * line while the keypad is up, so the line she writes, her last lines of work and the problem strip keep the screen
 * (docs/progress/app-tablet.md). A tap on that line (or its ⌄ button) unfolds them; they fold again after her next
 * Check, and whenever the keypad goes down or comes back.
 */
export interface ComposerFold {
  /** A phone composer (the extras are wrapped so they can fold). */
  phone: boolean
  /** The keypad (or the abc bar) is up on a phone: the extras can fold. */
  foldable: boolean
  /** Folded now. */
  folded: boolean
  toggle: () => void
}

const NO_FOLD: ComposerFold = { phone: false, foldable: false, folded: false, toggle: () => {} }

const FoldContext = createContext<ComposerFold>(NO_FOLD)

/** Inside a composer: whether its extras are folded, and the switch. Outside one: never folded. */
export function useComposerFold(): ComposerFold {
  return useContext(FoldContext)
}

/**
 * A part of the composer that folds away with the extras (a flow's note, the nudge, the tools row). On a wide screen it
 * is its children, unwrapped.
 */
export function ComposerExtra({ children }: { children: ReactNode }) {
  const { phone, folded } = useComposerFold()
  if (!phone) return <>{children}</>
  return (
    <div hidden={folded} data-composer-extra="">
      {children}
    </div>
  )
}

type Props = {
  children: ReactNode
  /** Toolbar rendered above the strip on mobile (Hints / Graph / Calculator / Rule / Scratch). */
  toolbar?: ReactNode
  /** Inline banner above the composer (idle nudge, chip prompt). */
  banner?: ReactNode
  /** Row right above the input (the phone's verdict about her last line, Why?, Stuck?). */
  status?: ReactNode
}

/**
 * Mobile composer: sticky to the visual viewport bottom on phones (or to the top of the math keypad
 * while it is open), at the end of a column that fills the screen, so it always sits on the keypad (no
 * blank band between them); a plain block on wider screens. Put the live preview + MathInput inside.
 * The keypad treats it as one region, and after a Check brings her newest line of work right above it.
 */
export function Composer({ children, toolbar, banner, status }: Props) {
  const mobile = useLayout() === 'phone'
  const offset = useVisualViewportOffset(mobile)
  useDockedComposer(mobile)
  const keypadUp = useKeypadStore((s) => s.target !== null)
  const checks = useKeypadStore((s) => s.checks)
  const foldable = mobile && keypadUp
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setOpen(false)
  }, [foldable, checks])
  const fold = useMemo<ComposerFold>(
    () => ({ phone: mobile, foldable, folded: foldable && !open, toggle: () => setOpen((o) => !o) }),
    [mobile, foldable, open],
  )
  return (
    <FoldContext.Provider value={fold}>
      <div
        data-keypad-region=""
        data-keypad-scroll="end"
        data-keypad-dock={mobile ? '' : undefined}
        data-folded={fold.folded ? '' : undefined}
        className={
          mobile
            ? `composer-sticky sticky z-20 -mx-4 mt-auto border-t border-navy-100 bg-white px-4 ${fold.folded ? 'pt-1' : 'pt-2'}`
            : 'rounded-2xl border border-navy-100 bg-white p-3'
        }
        style={mobile && offset ? { transform: `translateY(${offset}px)` } : undefined}
      >
        {banner && <ComposerExtra>{banner}</ComposerExtra>}
        {toolbar && (
          <ComposerExtra>
            <div className="mb-2 flex flex-wrap gap-2">{toolbar}</div>
          </ComposerExtra>
        )}
        {status}
        {children}
      </div>
    </FoldContext.Provider>
  )
}
