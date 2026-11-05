import type { NavItem } from '@/components/navItems'

/** Study sits with the main destinations, after Home. Ask and the Sandbox stay at the end of the rail. */
export function withStudy(items: readonly NavItem[]): NavItem[] {
  if (items.some((item) => item.to === '/study')) return [...items]
  const study: NavItem = { to: '/study', label: 'Study', icon: 'home' }
  const home = items.findIndex((item) => item.to === '/')
  const at = home < 0 ? items.length : home + 1
  return [...items.slice(0, at), study, ...items.slice(at)]
}

/** 24 px line icon, same stroke as the other navigation icons. A stack of cards. */
export function StudyIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      <path d="M8 7h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8" />
      <rect x="3" y="3" width="13" height="16" rx="2" />
      <path d="M6 8h7M6 12h7M6 16h4" />
    </svg>
  )
}
