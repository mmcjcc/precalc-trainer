import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { channel } from './channel'
import { motionAllowed } from './motion'

/**
 * "+10" floating up from a kept line or a part (rewards on): the award's XP, drawn at a point of the page and gone in
 * a second. Decorative (aria-hidden: the finish sheet says what she earned). Nothing under reduced motion.
 */

export interface XpFloat {
  xp: number
  /** Page coordinates (px) of the point it rises from. */
  x: number
  y: number
  /** Milliseconds before it starts (two parts checked together rise one after the other). */
  delay?: number
}

interface Live extends XpFloat {
  id: number
}

const floats = channel<XpFloat>()
const LIFE_MS = 1100

export function floatXp(f: XpFloat): void {
  if (!motionAllowed() || !(f.xp > 0)) return
  floats.emit(f)
}

/** The keypad's height while it is open (the page keeps that much room at the bottom). */
function keypadHeight(): number {
  try {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--keypad-h')) || 0
  } catch {
    return 0
  }
}

/**
 * Where a float rises from, in page coordinates: the top middle of an element's box on the screen (a kept line's check,
 * the box or the button of a part), kept above the keypad. `scroll` is the page's scroll when the box was measured
 * (default: now). Null when the element is gone or out of sight.
 */
export function floatPoint(
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height' | 'bottom'>,
  scroll: { x: number; y: number } = typeof window === 'undefined' ? { x: 0, y: 0 } : { x: window.scrollX, y: window.scrollY },
): { x: number; y: number } | null {
  if (typeof window === 'undefined' || rect.width === 0 || rect.height === 0) return null
  const visibleBottom = window.innerHeight - keypadHeight()
  if (rect.bottom < 0 || rect.top > visibleBottom) return null
  const y = Math.min(Math.max(rect.top, 8), visibleBottom - 28)
  return { x: rect.left + rect.width / 2 + scroll.x, y: y + scroll.y }
}

let seq = 0

/** Mount once (the app shell): draws the floats. */
export function XpFloatLayer() {
  const [live, setLive] = useState<Live[]>([])
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const off = floats.on((f) => {
      const id = ++seq
      setLive((l) => [...l, { ...f, id }])
      const timer = setTimeout(() => {
        timers.delete(timer)
        setLive((l) => l.filter((x) => x.id !== id))
      }, LIFE_MS + (f.delay ?? 0))
      timers.add(timer)
    })
    return () => {
      off()
      for (const t of timers) clearTimeout(t)
    }
  }, [])
  if (live.length === 0 || typeof document === 'undefined') return null
  return createPortal(
    <div aria-hidden="true" className="xp-float-layer" data-xp-floats="">
      {live.map((f) => (
        <span key={f.id} className="xp-float" style={{ left: f.x, top: f.y, animationDelay: `${f.delay ?? 0}ms` }}>
          +{f.xp}
        </span>
      ))}
    </div>,
    document.body,
  )
}
