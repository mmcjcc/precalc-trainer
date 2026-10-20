import { useLayoutEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { NavIconSvg, tabOf, type NavItem } from './navItems'

/**
 * The bar's height on <html> while it is up (`--tabbar-h`, like the keypad's `--keypad-h`): its 3.5rem row plus the
 * phone's navigation bar under it. The page keeps that room at the bottom and the toasts sit above it (index.css).
 */
export const TABBAR_HEIGHT = 'calc(3.5rem + env(safe-area-inset-bottom, 0px))'

/**
 * The bottom tab bar: the app's destinations within thumb reach, each an icon and a short label, at least 48 px
 * tall, the current one marked (aria-current and a pill behind its icon, its label bold). The app shell shows it on a
 * phone's menu screens; it does not know the screen size itself.
 */
export function TabBar({ items }: { items: readonly NavItem[] }) {
  const { pathname } = useLocation()
  const current = tabOf(pathname, items)

  useLayoutEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--tabbar-h', TABBAR_HEIGHT)
    return () => {
      root.style.removeProperty('--tabbar-h')
    }
  }, [])

  return (
    <nav aria-label="Main" className="tab-bar" data-tab-bar="">
      <ul className="mx-auto flex h-14 max-w-xl items-stretch">
        {items.map((item) => {
          const active = item.to === current
          return (
            <li key={item.to} className="flex min-w-0 flex-1">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-navy hover:bg-navy-50"
              >
                <span
                  aria-hidden
                  data-tab-marker={active ? '' : undefined}
                  className={`flex h-7 w-14 max-w-full items-center justify-center rounded-full ${active ? 'bg-navy-100 text-navy' : 'text-navy/80'}`}
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
  )
}
