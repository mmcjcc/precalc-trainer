import { useMotionAllowed } from '@/components/juice/motion'
import { useJustCaught } from './catchMoment'
import { MonsterArt } from './MonsterArt'
import { isMonster, isRare, speciesOf } from './species'

/**
 * The catch, in the verdict that names a mistake made for the first time: its monster flipping in (then a wiggle),
 * "Caught: <name>" and that it is new in her collection. Nothing otherwise. The words are text inside the verdict, so
 * they are read with it; the picture is decorative. No flip and no wiggle under reduced motion.
 */
export function CaughtBanner({ pattern, compact = false }: { pattern: string | null | undefined; compact?: boolean }) {
  const caught = useJustCaught(pattern)
  const motion = useMotionAllowed()
  const species = pattern ? speciesOf(pattern) : null
  if (!caught || !species || !pattern) return null
  const rare = isRare(pattern)
  return (
    // A span (laid out as a row), so it can sit inside a verdict that is a paragraph.
    <span
      data-monster-caught={pattern}
      className={`flex items-center gap-3 rounded-xl border-2 border-gold bg-white text-left font-normal ${compact ? 'mb-2 px-2 py-1' : 'mb-2 p-2'}`}
    >
      <span className={`inline-flex shrink-0 ${motion ? 'monster-flip-in' : ''}`} data-monster-motion={motion ? 'flip' : undefined}>
        <MonsterArt id={pattern} size={compact ? 44 : 64} sticker className={motion ? 'monster-wiggle' : undefined} />
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-navy">Caught: {species.name}</span>
        <span className={`block text-navy/80 ${compact ? 'text-xs' : 'text-sm'}`}>
          {rare ? 'A rare one, new in your collection.' : 'New in your monster collection.'}
        </span>
      </span>
    </span>
  )
}

/**
 * The catch in one line (the phone composer's folded verdict, with the keypad up): the monster small, flipping in, in a
 * gold ring, before the mistake's title; "Caught: <name>." is said, not shown (the banner shows it when the line unfolds).
 */
export function CaughtBadge({ pattern }: { pattern: string | null | undefined }) {
  const caught = useJustCaught(pattern)
  const motion = useMotionAllowed()
  const species = pattern ? speciesOf(pattern) : null
  if (!caught || !species || !pattern) return null
  return (
    <span data-monster-caught={pattern} data-caught-badge="" className="mr-1 inline-flex shrink-0 items-center rounded-full bg-white align-middle ring-2 ring-gold">
      <span className={`inline-flex ${motion ? 'monster-flip-in' : ''}`}>
        <MonsterArt id={pattern} size={24} sticker />
      </span>
      <span className="sr-only">Caught: {species.name}. </span>
    </span>
  )
}

/**
 * A named mistake's monster, small, beside its title: every time after the first (the catch shows it the first time).
 * Decorative; the title beside it is the words.
 */
export function MistakeAvatar({ pattern, size = 28, className = '' }: { pattern: string | null | undefined; size?: number; className?: string }) {
  const caught = useJustCaught(pattern)
  if (!pattern || caught || !isMonster(pattern)) return null
  return <MonsterArt id={pattern} size={size} className={`inline-block shrink-0 align-middle ${className}`} />
}
