import { useEffect, useState, type ReactNode } from 'react'
import { useMotionAllowed } from '@/components/juice/motion'
import type { SkillRingInfo } from '@/store'
import { RING_WORD } from './words'

type Tone = 'navy' | 'ok'

const TONE: Record<Tone, string> = { navy: 'stroke-navy', ok: 'stroke-ok' }

/**
 * A progress ring (SVG). Decorative: the caller gives it a role and words (color is never the only signal). A value
 * that changes sweeps there (CSS transition; reduced motion makes it a jump), from empty too: the arc is always drawn,
 * invisible at 0.
 */
export function Ring({ value, size, tone, children }: { value: number; size: number; tone: Tone; children?: ReactNode }) {
  const stroke = Math.max(4, Math.round(size / 10))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-navy-100" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          strokeOpacity={v > 0 ? undefined : 0}
          className={`${TONE[tone]} transition-[stroke-dashoffset] duration-700 ease-out`}
          data-ring-value={v > 0 ? v.toFixed(2) : undefined}
        />
      </svg>
      {children && <span className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">{children}</span>}
    </span>
  )
}

/**
 * Today's XP against the goal (or twice the goal while a missed day waits to be mended). `from` (the XP before what she
 * just did) makes the ring sweep from there to now where it appears after a change: the finish sheet, the set's
 * results, Home after a problem. What it says is always the XP now.
 */
export function GoalRing({ xp, target, size = 88, label = 'Today’s goal', from }: { xp: number; target: number; size?: number; label?: string; from?: number }) {
  const met = xp >= target
  const shown = useSlide(from === undefined ? xp / target : Math.min(from, xp) / target, xp / target)
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(xp, target)}
      aria-valuetext={`${xp} of ${target} XP${met ? ', goal met' : ''}`}
      className="inline-flex"
    >
      <Ring value={shown} size={size} tone={met ? 'ok' : 'navy'}>
        <span className={`font-bold text-navy ${size >= 80 ? 'text-2xl' : 'text-lg'}`}>{xp}</span>
        <span className="mt-0.5 text-[11px] text-navy/70">of {target} XP</span>
      </Ring>
    </span>
  )
}

/** Mounted at `from`, then sweeps to `to`: the ring that moved. At once under reduced motion. */
function useSlide(from: number, to: number): number {
  const motion = useMotionAllowed()
  const sweep = motion && from !== to
  const [value, setValue] = useState(from)
  useEffect(() => {
    if (!sweep) return
    const timer = setTimeout(() => setValue(to), 80)
    return () => clearTimeout(timer)
  }, [sweep, to])
  return sweep ? value : to
}

/** The words a problem-type ring says (its accessible name, and the line under it). */
export function ringWords(ring: SkillRingInfo): string {
  if (ring.level === 'new') return 'New: none finished yet'
  if (ring.level === 'mastered') return 'Mastered'
  return `${RING_WORD[ring.level]}: ${ring.strong} of the last 5 went well`
}

/**
 * A problem type's ring from the last-five mastery rule: a fifth for each of the last five problems that went well,
 * full and green once mastered. `from` (the finish sheet) is where it stood before this problem.
 */
export function SkillRing({ ring, title, size = 56, from }: { ring: SkillRingInfo; title: string; size?: number; from?: SkillRingInfo }) {
  const value = useSlide(from ? from.fill : ring.fill, ring.fill)
  // A practiced type shows a sliver even when none of its problems went well yet.
  const shown = ring.level === 'practiced' ? Math.max(value, 0.04) : value
  return (
    <span role="img" aria-label={`${title}: ${ringWords(ring)}`} className="inline-flex" data-ring-level={ring.level}>
      <Ring value={shown} size={size} tone={ring.level === 'mastered' ? 'ok' : 'navy'}>
        {ring.level === 'mastered' ? (
          <span className={`font-bold text-ok ${size >= 80 ? 'text-3xl' : 'text-xl'}`}>✓</span>
        ) : ring.level === 'new' ? null : (
          <span className={`font-semibold text-navy ${size >= 80 ? 'text-lg' : 'text-sm'}`}>{ring.strong}/5</span>
        )}
      </Ring>
    </span>
  )
}
