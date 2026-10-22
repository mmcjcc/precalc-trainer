/**
 * The app's destinations (docs/progress/phone-monsters.md, docs/progress/app-grapher.md). The bottom tab bar on a phone
 * shows five, on every screen and in both editions: Home, Monsters, Graph, Progress, Settings. The top navigation on a
 * wide screen shows the same five, then Ask while the tutor is configured and the Sandbox in the family app (it has the
 * room). The drill has neither: it keeps its route and is reached from its module in Unit 1 and from Progress; Ask and
 * the Sandbox are on Home too.
 */
import { STORE } from '@/edition'

export type NavIcon = 'home' | 'monsters' | 'graph' | 'progress' | 'settings' | 'ask' | 'sandbox'

export interface NavItem {
  to: string
  label: string
  icon: NavIcon
  /** Current only on this exact path (Home). */
  end?: boolean
}

const TABS: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/monsters', label: 'Monsters', icon: 'monsters' },
  { to: '/graph', label: 'Graph', icon: 'graph' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]
const ASK: NavItem = { to: '/ask', label: 'Ask', icon: 'ask' }
const SANDBOX: NavItem = { to: '/sandbox', label: 'Sandbox', icon: 'sandbox' }

/** The phone's bottom tab bar: the five, always. */
export function tabItems(): readonly NavItem[] {
  return TABS
}

/** The wide top navigation: the five, then Ask (tutor configured) and the Sandbox (family app). */
export function navItems(askOn: boolean): NavItem[] {
  return [...TABS, ...(askOn ? [ASK] : []), ...(STORE ? [] : [SANDBOX])]
}

/** Pages Home leads to without a tab of their own: the tab bar marks Home on them. */
const UNDER_HOME = ['/drill', '/ask', '/sandbox']

/** Top navigation: Home stays current on `/` and on a class deep link (`/c/...`). Other items match their path. */
export function isNavActive(pathname: string, to: string, end?: boolean): boolean {
  if (to === '/' && (pathname === '/c' || pathname.startsWith('/c/'))) return true
  if (end || to === '/') return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * The tab a page belongs to, so the tab bar always marks one: Home for a class, a module page, the unit review, the
 * drill, Ask and the Sandbox (Home leads to them), Settings for the tutor log (Settings links to it).
 */
export function tabOf(pathname: string, items: readonly NavItem[]): string | null {
  if (pathname === '/' || pathname === '/c' || /^\/(c|m|review)\//.test(pathname)) return '/'
  if (UNDER_HOME.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return '/'
  if (pathname === '/tutor-log' || pathname.startsWith('/tutor-log/')) return items.some((i) => i.to === '/settings') ? '/settings' : null
  return items.find((i) => i.to !== '/' && isNavActive(pathname, i.to, i.end))?.to ?? null
}

/** 24 px line icons in the current text color. Decorative: the label next to each says what it is. */
export function NavIconSvg({ icon }: { icon: NavIcon }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
  switch (icon) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
        </svg>
      )
    case 'monsters':
      // A little monster: horns, two eyes, a ragged hem.
      return (
        <svg {...common}>
          <path d="M5 20v-7a7 7 0 0 1 14 0v7l-2.3-1.6L14.3 20 12 18.4 9.7 20l-2.4-1.6z" />
          <path d="M8.6 7.3 7 3.6M15.4 7.3 17 3.6" />
          <circle cx="9.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'graph':
      // Crossed axes and a parabola (Progress has the L-shaped axes and bars).
      return (
        <svg {...common}>
          <path d="M12 3v18M3 13h18" strokeOpacity={0.55} />
          <path d="M5.5 4c1.8 9.5 4.3 13 6.5 13s4.7-3.5 6.5-13" />
        </svg>
      )
    case 'progress':
      return (
        <svg {...common}>
          <path d="M4 20V4" />
          <path d="M4 20h16" />
          <path d="M8 16v-4" />
          <path d="M12 16V8" />
          <path d="M16 16v-6" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M4 6h9" />
          <path d="M17 6h3" />
          <circle cx="15" cy="6" r="2" />
          <path d="M4 12h3" />
          <path d="M11 12h9" />
          <circle cx="9" cy="12" r="2" />
          <path d="M4 18h11" />
          <path d="M19 18h1" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      )
    case 'ask':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4z" />
          <path d="M10 8.5a2 2 0 1 1 2.5 1.9c-.4.1-.5.4-.5.8v.3" />
          <path d="M12 13.6v.1" />
        </svg>
      )
    case 'sandbox':
      return (
        <svg {...common}>
          <path d="M4 20h4L19 9l-4-4L4 16z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      )
  }
}
