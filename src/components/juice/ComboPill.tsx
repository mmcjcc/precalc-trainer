import { comboTier } from '@/session/combo'
import { Flame } from './Flame'

const TIER = {
  1: { box: 'gap-1 px-2.5 py-1 text-sm', flame: 14 },
  2: { box: 'gap-1.5 px-3 py-1 text-base', flame: 18 },
  3: { box: 'gap-1.5 px-3.5 py-1.5 text-lg', flame: 22 },
} as const

/**
 * "3 in a row!" with a small flame: the combo (session/combo.ts) from 3 on, a size up at 5 and again at 10. It slides
 * in when it appears and bumps when the count goes up (CSS, none under reduced motion). The page places it (rewards on
 * only); it does not read the screen size. Plain text, not a live region: the verdict beside it is what she hears.
 */
export function ComboPill({ count }: { count: number }) {
  const tier = comboTier(count)
  if (tier === 0) return null
  const t = TIER[tier]
  return (
    <span
      className={`combo-pill inline-flex items-center rounded-full border font-semibold shadow-sm ${t.box} ${
        tier === 3 ? 'border-gold-text/40 bg-gold text-navy' : 'border-gold bg-gold-100 text-navy'
      }`}
      data-combo={count}
      data-combo-tier={tier}
    >
      <Flame px={t.flame} />
      <span key={count} className="combo-count">
        {count} in a row!
      </span>
    </span>
  )
}
