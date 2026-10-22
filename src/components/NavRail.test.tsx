// @vitest-environment jsdom
/**
 * The navigation by window size (docs/progress/app-tablet.md): from 840 px wide (and 480 px tall) the navigation rail down
 * the left, on every screen; narrower, the bottom tab bar on menu screens. The layout follows the window, not the device:
 * the same touch screen gets either one, and a phone's user agent at 1280 px still gets the rail.
 */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from '@/App'
import { problemPath } from '@/problem/url'
import { resetStoreForTests } from '@/store'
import { resetWindowSize, setWindowSize, WINDOWS } from './layoutTesting'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const LAZY = { timeout: 120_000 }
const PAGE_TIMEOUT = 120_000

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  )
}

const rail = () => document.querySelector<HTMLElement>('[data-nav-rail]')
const tabBar = () => document.querySelector<HTMLElement>('[data-tab-bar]')
const main = () => document.getElementById('main')!
const railWidth = () => document.documentElement.style.getPropertyValue('--rail-w')

beforeAll(async () => {
  await import('@/pages/Problem')
}, 120_000)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  window.scrollTo = () => {}
})

afterEach(() => {
  resetWindowSize()
})

describe('the tablet layout: the rail', () => {
  it.each([WINDOWS.wide, WINDOWS.landscape])(
    '%i x %i: the five destinations in the tab bar’s order (then the Sandbox), icons and labels, the current one marked',
    (width, height) => {
      setWindowSize(width, height)
      renderAt('/progress')
      expect(tabBar()).toBeNull()
      const nav = within(rail()!).getByRole('navigation', { name: 'Main' })
      const links = within(nav).getAllByRole('link')
      expect(links.map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings', 'Sandbox'])
      expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/monsters', '/graph', '/progress', '/settings', '/sandbox'])
      for (const a of links) {
        expect(a.className).toContain('min-h-14')
        expect(a.querySelector('svg')).toBeTruthy()
      }
      const current = within(nav).getByRole('link', { name: 'Progress' })
      expect(current.getAttribute('aria-current')).toBe('page')
      expect(current.querySelector('[data-tab-marker]')).toBeTruthy()
      expect(nav.querySelectorAll('[aria-current]')).toHaveLength(1)
      // The app's mark goes Home; the page starts right of the rail (index.css reads --rail-w).
      expect(within(rail()!).getByRole('link', { name: 'Math & Science Trainer' }).getAttribute('href')).toBe('/')
      expect(railWidth()).toContain('5rem')
      expect(main().getAttribute('data-layout')).toBe('tablet')
    },
    PAGE_TIMEOUT,
  )

  it('starts at exactly 840 px: 839 px is still the phone layout', { timeout: PAGE_TIMEOUT }, () => {
    setWindowSize(840, 700)
    const view = renderAt('/')
    expect(rail()).toBeTruthy()
    expect(tabBar()).toBeNull()
    view.unmount()
    setWindowSize(839, 700)
    renderAt('/')
    expect(rail()).toBeNull()
    expect(tabBar()).toBeTruthy()
  })

  it('marks Home on a module page and a class, as the tab bar does', { timeout: PAGE_TIMEOUT }, () => {
    setWindowSize(...WINDOWS.landscape)
    const view = renderAt('/m/inequalities')
    expect(within(rail()!).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    view.unmount()
    renderAt('/c/chemistry/ch5')
    expect(within(rail()!).getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
  })

  it('stays on a problem screen (the problem and her work in two panes beside it)', { timeout: PAGE_TIMEOUT }, async () => {
    setWindowSize(...WINDOWS.wide)
    renderAt(problemPath('inequalities', 'ineq.linear', 12345))
    expect(await screen.findByRole('region', { name: 'Your working' }, LAZY)).toBeTruthy()
    expect(rail()).toBeTruthy()
    expect(tabBar()).toBeNull()
  })

  it('follows the width, not the device: a phone’s user agent at 1280 px still gets the rail', { timeout: PAGE_TIMEOUT }, () => {
    const ua = vi.spyOn(Navigator.prototype, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    setWindowSize(...WINDOWS.wide)
    renderAt('/')
    expect(rail()).toBeTruthy()
    expect(tabBar()).toBeNull()
    ua.mockRestore()
  })
})

describe('the phone layout: the tab bar', () => {
  it.each([WINDOWS.upright, WINDOWS.phone])('%i x %i: the tab bar on a menu screen, no rail', (width, height) => {
    setWindowSize(width, height)
    renderAt('/progress')
    expect(rail()).toBeNull()
    expect(railWidth()).toBe('')
    const bar = tabBar()!
    expect(within(bar).getAllByRole('link').map((a) => a.textContent)).toEqual(['Home', 'Monsters', 'Graph', 'Progress', 'Settings'])
    expect(within(bar).getByRole('link', { name: 'Progress' }).getAttribute('aria-current')).toBe('page')
    expect(main().getAttribute('data-layout')).toBe('phone')
  }, PAGE_TIMEOUT)

  it('a tablet held upright (800 x 1280) reads in a wider column: 42rem, still one column', { timeout: PAGE_TIMEOUT }, () => {
    setWindowSize(...WINDOWS.upright)
    renderAt('/')
    expect(main().className).toContain('max-w-2xl')
    expect(document.querySelector('[data-columns]')!.getAttribute('data-columns')).toBe('1')
  })

  it('a big phone on its side (932 x 430) is too short for two panes: the phone layout', { timeout: PAGE_TIMEOUT }, () => {
    setWindowSize(932, 430)
    renderAt('/')
    expect(rail()).toBeNull()
    expect(tabBar()).toBeTruthy()
  })

  it('turning a tablet upright swaps the rail for the tab bar on the page she is on', { timeout: PAGE_TIMEOUT }, () => {
    setWindowSize(...WINDOWS.landscape)
    renderAt('/settings')
    expect(rail()).toBeTruthy()
    setWindowSize(...WINDOWS.upright)
    expect(rail()).toBeNull()
    expect(within(tabBar()!).getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe('page')
    setWindowSize(...WINDOWS.landscape)
    expect(tabBar()).toBeNull()
    expect(rail()).toBeTruthy()
  })
})
