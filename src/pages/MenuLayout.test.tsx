// @vitest-environment jsdom
/**
 * The menu pages by window size (docs/progress/app-tablet.md): in the tablet layout (1280 x 800, 1024 x 768) Home, the
 * module page, Monsters, Progress and Settings keep a comfortable width with their cards in two columns; in the phone
 * layout (800 x 1280, a tablet upright, and 375 x 812) one column. The cards are the same; the page's layout decides.
 */
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetWindowSize, setWindowSize, WINDOWS } from '@/components/layoutTesting'
import { resetStoreForTests, useStore } from '@/store'
import { Home } from './Home'
import { ModulePage } from './Module'
import { MonstersPage } from './Monsters'
import { ProgressPage } from './Progress'
import { SettingsPage } from './Settings'

const PAGE_TIMEOUT = 120_000

function renderAt(path: string, route: string, page: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={page} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Every list of cards on the page, by how many columns it has. */
const columns = () => Array.from(document.querySelectorAll('[data-columns]')).map((el) => el.getAttribute('data-columns'))
/** The page's own root: it never stretches past its max width. */
const pageRoot = () => (document.querySelector('[data-columns]')!.closest('.mx-auto') ?? document.body.firstElementChild!.firstElementChild) as HTMLElement

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  window.scrollTo = () => {}
})

afterEach(() => {
  resetWindowSize()
})

describe.each([
  [WINDOWS.wide, 2],
  [WINDOWS.landscape, 2],
  [WINDOWS.upright, 1],
  [WINDOWS.phone, 1],
] as const)('at %j', ([width, height], n) => {
  beforeEach(() => setWindowSize(width, height))

  it('Home: today’s part beside the class’s part in the tablet layout, one column on a phone', { timeout: PAGE_TIMEOUT }, () => {
    useStore.getState().setSettings({ rewards: true })
    renderAt('/', '/', <Home />)
    const root = document.querySelector<HTMLElement>('[data-columns]')!
    expect(root.getAttribute('data-columns')).toBe(String(n))
    expect(root.className).toMatch(/max-w-(4xl|6xl)/)
    const title = screen.getByRole('heading', { level: 1, name: 'Math & Science Trainer' })
    const start = screen.getByRole('button', { name: 'Start a set' })
    const classes = screen.getByRole('tablist', { name: 'Classes' })
    if (n === 2) {
      const today = document.querySelector<HTMLElement>('[data-home-column="today"]')!
      const klass = document.querySelector<HTMLElement>('[data-home-column="class"]')!
      expect(today.contains(title) && today.contains(start)).toBe(true)
      expect(klass.contains(classes)).toBe(true)
      expect(klass.querySelector('[data-path-stop]')).toBeTruthy()
    } else {
      expect(document.querySelector('[data-home-column]')).toBeNull()
    }
    // The same order either way: the title, Start a set, then the classes.
    expect(title.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(start.compareDocumentPosition(classes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('the module page: its problem types as cards in the page’s columns', { timeout: PAGE_TIMEOUT }, () => {
    renderAt('/m/inequalities', '/m/:moduleId', <ModulePage />)
    expect(columns()).toEqual([String(n)])
    expect(pageRoot().className).toContain('max-w-4xl')
  })

  it('Monsters: the species as cards in the page’s columns', { timeout: PAGE_TIMEOUT }, () => {
    renderAt('/monsters', '/monsters', <MonstersPage />)
    expect(columns()).toEqual([String(n)])
    expect(pageRoot().className).toContain('max-w-5xl')
    expect(document.querySelectorAll('[data-columns] > [data-species]').length).toBeGreaterThan(10)
  })

  it('Progress: its cards in the page’s columns', { timeout: PAGE_TIMEOUT }, () => {
    renderAt('/progress', '/progress', <ProgressPage />)
    expect(columns()).toEqual([String(n)])
    const habits = screen.getByRole('region', { name: 'Habits' })
    expect(habits.parentElement!.getAttribute('data-columns')).toBe(String(n))
    expect(pageRoot().className).toContain('max-w-5xl')
  })

  it('Settings: its sections in two columns read top to bottom in the tablet layout, one column on a phone', { timeout: PAGE_TIMEOUT }, () => {
    renderAt('/settings', '/settings', <SettingsPage />)
    expect(columns()).toEqual([String(n)])
    const list = document.querySelector<HTMLElement>('[data-columns]')!
    expect(within(list).getByRole('region', { name: 'Calculator' })).toBeTruthy()
    expect(list.className).toContain(n === 2 ? 'columns-2' : 'space-y-6')
    expect(pageRoot().className).toContain(n === 2 ? 'max-w-5xl' : 'max-w-2xl')
  })
})
