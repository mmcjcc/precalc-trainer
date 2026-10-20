import { useEffect, useState, type ReactNode } from 'react'
import { useBreakpoint } from './useBreakpoint'

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

type Props = {
  children: ReactNode
  /** Toolbar rendered above the strip on mobile (Hints / Graph / Calculator / Rule). */
  toolbar?: ReactNode
  /** Inline banner above the composer (idle nudge, chip prompt). */
  banner?: ReactNode
  /** Row right above the input (the phone's verdict about her last line, Why?, Stuck?). */
  status?: ReactNode
}

/**
 * Mobile composer: sticky to the visual viewport bottom on phones (or to the top of the math keypad
 * while it is open); a plain block on wider screens. Put the live preview + MathInput inside.
 * The keypad treats it as one region, and after a Check scrolls the page to its end, where her newest
 * line and its message are.
 */
export function Composer({ children, toolbar, banner, status }: Props) {
  const bp = useBreakpoint()
  const mobile = bp === 'mobile'
  const offset = useVisualViewportOffset(mobile)
  return (
    <div
      data-keypad-region=""
      data-keypad-scroll="end"
      data-keypad-dock={mobile ? '' : undefined}
      className={
        mobile
          ? 'composer-sticky sticky z-20 -mx-4 border-t border-navy-100 bg-white px-4 pt-2'
          : 'rounded-2xl border border-navy-100 bg-white p-3'
      }
      style={mobile && offset ? { transform: `translateY(${offset}px)` } : undefined}
    >
      {banner}
      {toolbar && <div className="mb-2 flex flex-wrap gap-2">{toolbar}</div>}
      {status}
      {children}
    </div>
  )
}
