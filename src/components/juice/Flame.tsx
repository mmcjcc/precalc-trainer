import { useState } from 'react'
import { useMotionAllowed } from './motion'

/**
 * The flame: the combo pill's small one, the streak's on the Today card (it grows with the streak and flares when
 * today's goal is met), and the milestone banner's big one. Decorative: the words beside it say what it means.
 */
export function Flame({ px, lit = true, className = '' }: { px: number; lit?: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={px}
      height={px}
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      data-flame={lit ? 'lit' : 'unlit'}
    >
      <path
        d="M12 1.5C13 5 17.5 7.6 17.5 13.5a5.5 5.5 0 0 1-11 0c0-3 1.5-4.7 2.7-5.9.1 1.7.8 3 1.8 3.6C10.6 7.8 11.2 4.2 12 1.5Z"
        className={lit ? 'fill-coral stroke-coral-700' : 'fill-navy-100 stroke-navy/35'}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M12 11c1.2 1.6 2.6 2.6 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.6 1.2-2.8 2.6-4.6Z" className={lit ? 'fill-gold' : 'fill-white'} />
    </svg>
  )
}

export type FlameSize = 'none' | 'small' | 'medium' | 'large'

/** The streak flame's size: none at 0 days, then 1-6, 7-29 and 30 or more. */
export function flameSize(days: number): FlameSize {
  if (days <= 0) return 'none'
  if (days < 7) return 'small'
  if (days < 30) return 'medium'
  return 'large'
}

const FLAME_PX: Record<Exclude<FlameSize, 'none'>, number> = { small: 20, medium: 28, large: 38 }

/** The day the flame last flared in this session: it flares once a day, the first time she sees it lit. */
let flaredOn: string | null = null

function claimFlare(day: string, motion: boolean): boolean {
  if (!motion || flaredOn === day) return false
  flaredOn = day
  return true
}

/** Tests: the next lit flame flares again. */
export function resetFlareForTests(): void {
  flaredOn = null
}

/**
 * The Today card's streak flame: no flame without a streak; small, medium or large with it; dim until today's goal is
 * met, then lit, with one flare the first time she sees it lit that day (not under reduced motion).
 */
export function StreakFlame({ days, lit, day }: { days: number; lit: boolean; day: string }) {
  const size = flameSize(days)
  const motion = useMotionAllowed()
  // Decided when it first shows lit (on mount, or when the goal is met while it is on screen), so a re-render does
  // not start the flare again.
  const [flare, setFlare] = useState(() => lit && claimFlare(day, motion))
  const [seenLit, setSeenLit] = useState(lit)
  if (seenLit !== lit) {
    setSeenLit(lit)
    if (lit && claimFlare(day, motion)) setFlare(true)
  }
  if (size === 'none') return null
  return (
    <span className={`inline-flex shrink-0 ${flare ? 'flame-flare' : ''}`} data-flame-size={size} data-flame-lit={lit ? 'true' : 'false'}>
      <Flame px={FLAME_PX[size]} lit={lit} />
    </span>
  )
}
