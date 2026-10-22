import type { ReactNode } from 'react'
import { useLayout } from './useBreakpoint'

const GAP = { 3: 'gap-3', 4: 'gap-4', 6: 'gap-6' } as const

/**
 * A page's list of cards (docs/progress/app-tablet.md): one column in the phone layout, two in the tablet layout (840
 * px and more), so a wide screen never stretches a card across it. The layout decides; the cards inside never know.
 *  - `flow="rows"` (the default) goes row by row: cards that are read side by side (a module's problem types).
 *  - `flow="columns"` fills the first column, then the second: sections of uneven height read top to bottom (Settings).
 */
export function CardColumns({
  children,
  flow = 'rows',
  gap = 4,
  className = '',
}: {
  children: ReactNode
  flow?: 'rows' | 'columns'
  gap?: keyof typeof GAP
  className?: string
}) {
  const two = useLayout() === 'tablet'
  const layout =
    flow === 'columns'
      ? two
        ? 'columns-2 gap-6 [&>*]:mb-6 [&>*]:break-inside-avoid'
        : 'space-y-6'
      : two
        ? `grid grid-cols-2 items-start ${GAP[gap]}`
        : `grid ${GAP[gap]}`
  return (
    <div data-columns={two ? 2 : 1} className={`${layout} ${className}`}>
      {children}
    </div>
  )
}
