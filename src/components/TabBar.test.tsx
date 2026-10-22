// @vitest-environment jsdom
/**
 * Navigation by screen size: on a phone the menu screens get the bottom tab bar (the top navigation hides), and a
 * problem screen or a running set gets neither; a wide screen keeps today's top navigation everywhere. The tab bar is
 * Home, Monsters, Progress, Settings on every screen; the top navigation shows the same four first, then Ask (tutor
 * configured) and the Sandbox (family app) (docs/progress/phone-monsters.md).
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
  it('Home: Home, Monsters, Progress, Settings, icons and labels, 48 px tall, Home marked; no top navigation', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    renderAt('/')
    const bar = tabBar()!
    expect(bar).toBeTruthy()
    expect(bar.getAttribute('aria-label')).toBe('Main')
    const links = within(bar).getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Progress', 'Settings'])
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/monsters', '/progress', '/settings'])
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

describe('a wide screen keeps today’s top navigation', () => {
  it('Home: the name and the text links, Home marked; no tab bar', { timeout: PAGE_TIMEOUT }, () => {
    renderAt('/')
    expect(tabBar()).toBeNull()
    expect(brand()).toBeTruthy()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Progress', 'Settings', 'Sandbox'])
    expect(within(nav).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    expect(nav.querySelector('svg')).toBeNull()
  })

  it('a problem keeps the top navigation too', { timeout: PAGE_TIMEOUT }, async () => {
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(await screen.findByRole('button', { name: 'shortcuts (?)' }, LAZY)).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy()
    expect(brand()).toBeTruthy()
    expect(tabBar()).toBeNull()
  })
})

describe('which item is current', () => {
  const items = tabItems()

  it('the tab bar always marks the page’s tab; the top navigation is as it was', () => {
    expect(items.map((i) => i.label)).toEqual(['Home', 'Monsters', 'Progress', 'Settings'])
    // The wide top navigation: the four, then Ask while the tutor is configured, then the Sandbox (family app).
    expect(navItems(true).map((i) => i.label)).toEqual(['Home', 'Monsters', 'Progress', 'Settings', 'Ask', 'Sandbox'])
    expect(navItems(false).map((i) => i.label)).toEqual(['Home', 'Monsters', 'Progress', 'Settings', 'Sandbox'])
    expect(tabOf('/', items)).toBe('/')
    expect(tabOf('/c/precalc/unit2', items)).toBe('/')
    expect(tabOf('/m/inequalities', items)).toBe('/')
    expect(tabOf('/review/unit1', items)).toBe('/')
    expect(tabOf('/monsters', items)).toBe('/monsters')
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
