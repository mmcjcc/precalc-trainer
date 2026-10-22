import { useLayoutEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { STORE } from '@/edition'
import { NavIconSvg, railOf, type NavItem } from './navItems'

/**
 * The rail's width on <html> while it is up (`--rail-w`, like the tab bar's `--tabbar-h`): the page, the keypad and the
 * toasts start right of it (index.css).
 */
export const RAIL_WIDTH = 'calc(5rem + env(safe-area-inset-left, 0px))'

/**
 * The navigation rail (the tablet layout, 840 px and more): the bottom tabs' destinations down the left edge, in the same
 * order, each an icon in a pill and a short label, at least 56 px tall, the current one marked (aria-current, the pill
 * filled, the label bold); then Ask and the Sandbox where the app has them. The app's mark on top goes Home. The app
 * shell shows it; it does not know the screen size itself.
 */
export function NavRail({ items }: { items: readonly NavItem[] }) {
  const { pathname } = useLocation()
  const current = railOf(pathname, items)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--rail-w', RAIL_WIDTH)
    return () => {
      root.style.removeProperty('--rail-w')
    }
  }, [])

  const name = STORE ? 'Math Trainer' : 'Math & Science Trainer'
  return (
    <div className="nav-rail" data-nav-rail="">
      <Link
        to="/"
        aria-label={name}
        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-gold hover:bg-navy-600"
      >
        <svg aria-hidden focusable="false" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.2 4.2L19 7" />
        </svg>
      </Link>
      <nav aria-label="Main">
        <ul className="flex flex-col items-stretch gap-1">
          {items.map((item) => {
            const active = item.to === current
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-navy hover:bg-navy-50"
                >
                  <span
                    aria-hidden
                    data-tab-marker={active ? '' : undefined}
                    className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? 'bg-navy-100 text-navy' : 'text-navy/80'}`}
                  >
                    <NavIconSvg icon={item.icon} />
                  </span>
                  <span className={`max-w-full truncate text-xs leading-tight ${active ? 'font-bold text-navy' : 'font-medium text-navy/80'}`}>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
