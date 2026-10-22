// @vitest-environment jsdom
/**
 * Navigation by window size: in the phone layout the menu screens get the bottom tab bar, and a problem screen or a
 * running set gets none; the tablet layout (840 px and more) has the navigation rail everywhere. The tab bar is Home,
 * Monsters, Graph, Progress, Settings on every screen; the rail shows the same five first, then Ask (tutor configured)
 * and the Sandbox (family app) (docs/progress/phone-monsters.md, docs/progress/app-grapher.md, docs/progress/app-tablet.md).
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { problemPath } from '@/problem/url'
import { newActiveSet, saveActiveSet } from '@/session/activeSet'
import { buildSet } from '@/session/buildSet'
import { getCourse } from '@/content'
import { emptyRewards, resetStoreForTests } from '@/store'
import { isNavActive, navItems, tabItems, tabOf } from './navItems'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

/** Lazy routes transform on first use; give them the long timeout. */
const LAZY = { timeout: 120_000 }
const PAGE_TIMEOUT = 120_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

const tabBar = () => document.querySelector<HTMLElement>('[data-tab-bar]')
const brand = () => screen.queryByRole('link', { name: 'Math & Science Trainer' })
const tabbarHeight = () => document.documentElement.style.getPropertyValue('--tabbar-h')

beforeAll(async () => {
  await import('@/pages/Problem')
  await import('@/pages/SetPage')
  await import('@/pages/Drill')
}, 120_000)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  window.scrollTo = () => {}
})

afterEach(() => {
  removePointer()
})

describe('a phone: the bottom tab bar on menu screens', () => {
  it('Home: Home, Monsters, Graph, Progress, Settings, icons and labels, 48 px tall, Home marked; no top navigation', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    renderAt('/')
    const bar = tabBar()!
    expect(bar).toBeTruthy()
    expect(bar.getAttribute('aria-label')).toBe('Main')
    const links = within(bar).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings'])
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/monsters', '/graph', '/progress', '/settings'])
    for (const a of links) {
      expect(a.className).toContain('min-h-12')
      expect(a.querySelector('svg')).toBeTruthy()
    }
    const home = within(bar).getByRole('link', { name: 'Home' })
    expect(home.getAttribute('aria-current')).toBe('page')
    expect(home.querySelector('[data-tab-marker]')).toBeTruthy()
    expect(bar.querySelectorAll('[aria-current]')).toHaveLength(1)
    expect(bar.querySelectorAll('[data-tab-marker]')).toHaveLength(1)
    // The top text navigation is gone on a phone: one "Main" navigation, the bar.
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toEqual([bar])
    expect(brand()).toBeNull()
    // The page and the toasts keep the bar's room (index.css reads --tabbar-h).
    expect(tabbarHeight()).toContain('3.5rem')
  })

  it.each([
    ['/monsters', 'Monsters'],
    ['/graph', 'Graph'],
    ['/progress', 'Progress'],
    ['/settings', 'Settings'],
    ['/tutor-log', 'Settings'],
    ['/m/inequalities', 'Home'],
    ['/c/chemistry/ch5', 'Home'],
    ['/sandbox', 'Home'],
  ])('%s shows the bar with %s marked', (path, current) => {
    installPointer(true)
    renderAt(path)
    const bar = tabBar()!
    expect(bar).toBeTruthy()
    expect(within(bar).getByRole('link', { name: current }).getAttribute('aria-current')).toBe('page')
    expect(brand()).toBeNull()
  }, PAGE_TIMEOUT)

  it('the Drill (a lazy page) keeps its route and has the bar from its first frame, Home marked', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    renderAt('/drill')
    expect(await screen.findByRole('heading', { level: 1, name: 'Properties drill' }, LAZY)).toBeTruthy()
    expect(within(tabBar()!).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    expect(within(tabBar()!).queryByRole('link', { name: 'Drill' })).toBeNull()
  })
})

describe('a phone: problem screens and a running set are full screen', () => {
  it('a problem has no tab bar and no top navigation, only its compact header', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(await screen.findByRole('link', { name: /^Close, back to/ }, LAZY)).toBeTruthy()
    expect(tabBar()).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(brand()).toBeNull()
    expect(tabbarHeight()).toBe('')
  })

  it('a running set has no tab bar and no top navigation', { timeout: PAGE_TIMEOUT }, async () => {
    installPointer(true)
    const built = buildSet({ course: getCourse('precalc')!, events: [], rewards: emptyRewards(), now: Date.now(), seed: 5 })
    saveActiveSet(newActiveSet(built, { now: Date.now(), timed: false }))
    renderAt('/set')
    expect(await screen.findByRole('link', { name: 'Close, back to Home. Your set is kept.' }, LAZY)).toBeTruthy()
    expect(tabBar()).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('the bar keeps its room only while it is up', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    const view = renderAt('/')
    expect(tabbarHeight()).not.toBe('')
    view.unmount()
    expect(tabbarHeight()).toBe('')
  })
})

// The layout moved (docs/progress/app-tablet.md): from 840 px the top navigation gave way to the navigation rail. jsdom
// without matchMedia is that layout; NavRail.test.tsx checks the rail at each window size.
describe('the tablet layout (jsdom’s own window) has the navigation rail', () => {
  it('Home: the rail with the app’s mark and the same destinations, then the Sandbox; Home marked; no tab bar', { timeout: PAGE_TIMEOUT }, () => {
    renderAt('/')
    expect(tabBar()).toBeNull()
    expect(brand()).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav.closest('[data-nav-rail]')).toBeTruthy()
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings', 'Sandbox'])
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
  })

  it('a problem keeps the rail too', { timeout: PAGE_TIMEOUT }, async () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(await screen.findByRole('button', { name: 'shortcuts (?)' }, LAZY)).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Main' }).closest('[data-nav-rail]')).toBeTruthy()
    expect(brand()).toBeTruthy()
    expect(tabBar()).toBeNull()
  })
})

describe('five tabs on a phone', () => {
  it('fit a 360 px screen: about 70 px a tab, and the longest label (8 letters at 12 px) is about 55 px', () => {
    const items = tabItems()
    expect(items).toHaveLength(5)
    // The bar's side padding is 4 px each side; each tab is flex-1 with 2 px of padding each side.
    const tabWidth = (360 - 8) / items.length
    // Inter at 12 px, overestimated on purpose: 8 px a capital, 9.5 px an m or w, 6.6 px any other letter.
    const width = (label: string) => [...label].reduce((w, c) => w + (/[A-Z]/.test(c) ? 8 : /[mw]/.test(c) ? 9.5 : 6.6), 0)
    for (const t of items) expect(width(t.label) + 4).toBeLessThan(tabWidth)
    // The pill behind the icon is 56 px and shrinks to the tab (max-w-full) if it must.
    expect(tabWidth).toBeGreaterThan(56)
  })
})

describe('which item is current', () => {
  const items = tabItems()

  it('the tab bar always marks the page’s tab; the top navigation is as it was', () => {
    expect(items.map((i) => i.label)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings'])
    // The wide top navigation: the five, then Ask while the tutor is configured, then the Sandbox (family app).
    expect(navItems(true).map((i) => i.label)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings', 'Ask', 'Sandbox'])
    expect(navItems(false).map((i) => i.label)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings', 'Sandbox'])
    expect(tabOf('/', items)).toBe('/')
    expect(tabOf('/c/precalc/unit2', items)).toBe('/')
    expect(tabOf('/m/inequalities', items)).toBe('/')
    expect(tabOf('/review/unit1', items)).toBe('/')
    expect(tabOf('/monsters', items)).toBe('/monsters')
    expect(tabOf('/graph', items)).toBe('/graph')
    // Pages without a tab of their own, reached from Home: the drill, Ask, the Sandbox.
    expect(tabOf('/ask', items)).toBe('/')
    expect(tabOf('/drill', items)).toBe('/')
    expect(tabOf('/sandbox', items)).toBe('/')
    expect(tabOf('/tutor-log', items)).toBe('/settings')
    expect(tabOf('/nowhere', items)).toBeNull()
    // The top navigation: unchanged (a module page marks nothing there).
    expect(isNavActive('/m/inequalities', '/', true)).toBe(false)
    expect(isNavActive('/c/chemistry', '/', true)).toBe(true)
    expect(isNavActive('/progress', '/progress')).toBe(true)
  })
})
