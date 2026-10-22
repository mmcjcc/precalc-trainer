import { useMemo, type CSSProperties } from 'react'
import { useMotionAllowed } from '@/components/juice/motion'
import { useRewards } from '@/store'
import { patternTitle } from './collection'
import { MonsterArt } from './MonsterArt'
import { isMonster, speciesOf } from './species'

/** The mistakes one finished attempt squashed (the rewards decide; this only reads their awards). */
export function useSquashedBy(attemptId: string | undefined): string[] {
  const view = useRewards()
  return useMemo(
    () => (attemptId ? view.awards.filter((a) => a.attemptId === attemptId && a.kind === 'squash' && a.pattern).map((a) => a.pattern!) : []),
    [attemptId, view],
  )
}

/** Where the splat's drops fly. */
const DROPS: readonly [number, number][] = [
  [-30, -14],
  [-22, -26],
  [-8, -30],
  [12, -28],
  [26, -20],
  [32, -6],
]

/**
 * The squash on the finish sheet (and the completion card): each monster this problem squashed lands with a splat,
 * its card turning gold, "Squashed: <name>" and the mistake's title. The pop sound is the juice's (useJuice). Under
 * reduced motion: no splat, the card gold and the monster flattened from the start.
 */
export function SquashMoment({ patterns }: { patterns: readonly string[] }) {
  const motion = useMotionAllowed()
  const monsters = [...new Set(patterns)].filter(isMonster)
  if (monsters.length === 0) return null
  return (
    <ul aria-label="Monsters squashed" className="space-y-2" data-squash-moment="">
      {monsters.map((id) => {
        const species = speciesOf(id)!
        return (
          <li
            key={id}
            data-squashed={id}
            className={`flex items-center gap-3 rounded-2xl border-2 border-gold bg-gold-100 p-3 text-left ${motion ? 'squash-card' : ''}`}
          >
            <span className="relative inline-flex h-16 w-16 shrink-0 items-end justify-center">
              <span className={`inline-flex ${motion ? 'monster-splat' : 'monster-squashed'}`} data-monster-motion={motion ? 'splat' : undefined}>
                <MonsterArt id={id} size={64} sticker />
              </span>
              {motion && (
                <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                  {DROPS.map(([dx, dy], i) => (
                    <span key={i} className="splat-drop" style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties} />
                  ))}
                </span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-navy">Squashed: {species.name}</span>
              <span className="block text-sm text-navy">{patternTitle(id)}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
