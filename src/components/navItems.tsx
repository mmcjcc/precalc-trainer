/**
 * The app's destinations: the top navigation on a wide screen and the bottom tab bar on a phone show the same ones
 * (Ask only while the tutor is configured).
 */

export type NavIcon = 'home' | 'ask' | 'drill' | 'progress' | 'settings' | 'sandbox'

export interface NavItem {
  to: string
  label: string
  icon: NavIcon
  /** Current only on this exact path (Home). */
  end?: boolean
}

const HOME: NavItem = { to: '/', label: 'Home', icon: 'home', end: true }
const ASK: NavItem = { to: '/ask', label: 'Ask', icon: 'ask' }
const REST: NavItem[] = [
  { to: '/drill', label: 'Drill', icon: 'drill' },
  { to: '/progress', label: 'Progress', icon: 'progress' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
  { to: '/sandbox', label: 'Sandbox', icon: 'sandbox' },
]

export function navItems(askOn: boolean): NavItem[] {
  return askOn ? [HOME, ASK, ...REST] : [HOME, ...REST]
}

/** Top navigation: Home stays current on `/` and on a class deep link (`/c/...`). Other items match their path. */
export function isNavActive(pathname: string, to: string, end?: boolean): boolean {
  if (to === '/' && (pathname === '/c' || pathname.startsWith('/c/'))) return true
  if (end || to === '/') return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * The tab a page belongs to, so the tab bar always marks one: Home for a class, a module page and the unit review
 * (Home opens them), Settings for the tutor log (Settings links to it).
 */
export function tabOf(pathname: string, items: readonly NavItem[]): string | null {
  if (pathname === '/' || pathname === '/c' || /^\/(c|m|review)\//.test(pathname)) return '/'
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
    case 'ask':
      return (
        <svg {...common}>
          <path d="M4 5h16v11H9l-5 4z" />
          <path d="M10 8.5a2 2 0 1 1 2.5 1.9c-.4.1-.5.4-.5.8v.3" />
          <path d="M12 13.6v.1" />
        </svg>
      )
    case 'drill':
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
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
    case 'sandbox':
      return (
        <svg {...common}>
          <path d="M4 20h4L19 9l-4-4L4 16z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      )
  }
}
