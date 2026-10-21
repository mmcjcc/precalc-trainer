import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { channel } from './channel'
import { motionAllowed } from './motion'

/**
 * Confetti: a short burst of CSS particles (no library, no canvas) over the whole screen, on a set's results, today's
 * goal met, a type newly mastered and a streak milestone. Decorative (aria-hidden, no pointer events). Nothing at all
 * under reduced motion. It does not read the screen size: a burst starts from a point of the viewport.
 */

export interface BurstOptions {
  /** Where it starts, as fractions of the viewport (default: the middle, a third of the way down). */
  x?: number
  y?: number
  /** Particles (default 44). */
  count?: number
}

interface Bit {
  key: number
  style: CSSProperties
}

interface Burst {
  id: number
  bits: Bit[]
}

const bursts = channel<BurstOptions>()

/** The palette's colors, and two lighter ones so a burst reads as a party, not a warning. */
const COLORS = ['#F96167', '#F9E795', '#2F3C7E', '#0F7A3E', '#F6B93B', '#8FB8FF']
/** The longest a particle lives (its delay plus its duration), with room to spare. */
const LIFE_MS = 2000
/** Two bursts asked for in the same moment (the goal and a mastery) are one. */
const MERGE_MS = 400

/** Throw a burst of confetti (nothing under reduced motion, or where no layer is mounted). */
export function burstConfetti(opts: BurstOptions = {}): void {
  if (!motionAllowed()) return
  bursts.emit(opts)
}

function between(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo)
}

function makeBits(opts: BurstOptions, seq: number): Bit[] {
  const count = opts.count ?? 44
  const x = `${(opts.x ?? 0.5) * 100}vw`
  const y = `${(opts.y ?? 0.35) * 100}vh`
  return Array.from({ length: count }, (_, i) => {
    const wide = i % 3 === 0
    const style = {
      left: x,
      top: y,
      width: wide ? '10px' : '7px',
      height: wide ? '6px' : '10px',
      borderRadius: i % 4 === 0 ? '9999px' : '2px',
      background: COLORS[i % COLORS.length],
      '--dx': `${between(-170, 170).toFixed(0)}px`,
      '--up': `${between(-230, -90).toFixed(0)}px`,
      '--fall': `${between(140, 420).toFixed(0)}px`,
      '--rot': `${between(-600, 600).toFixed(0)}deg`,
      animationDuration: `${between(1100, 1600).toFixed(0)}ms`,
      animationDelay: `${between(0, 140).toFixed(0)}ms`,
    } as CSSProperties
    return { key: seq * 1000 + i, style }
  })
}

let seq = 0

/** Mount once (the app shell): draws the bursts. */
export function ConfettiLayer() {
  const [live, setLive] = useState<Burst[]>([])
  useEffect(() => {
    let lastAt = 0
    const timers = new Set<ReturnType<typeof setTimeout>>()
    const off = bursts.on((opts) => {
      const now = Date.now()
      if (now - lastAt < MERGE_MS) return
      lastAt = now
      const id = ++seq
      setLive((b) => [...b, { id, bits: makeBits(opts, id) }])
      const timer = setTimeout(() => {
        timers.delete(timer)
        setLive((b) => b.filter((x) => x.id !== id))
      }, LIFE_MS)
      timers.add(timer)
    })
    return () => {
      off()
      for (const t of timers) clearTimeout(t)
    }
  }, [])
  if (live.length === 0 || typeof document === 'undefined') return null
  return createPortal(
    <div aria-hidden="true" className="confetti-layer" data-confetti="">
      {live.flatMap((b) => b.bits.map((bit) => <span key={bit.key} className="confetti-bit" style={bit.style} />))}
    </div>,
    document.body,
  )
}
