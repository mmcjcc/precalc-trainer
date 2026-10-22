// @vitest-environment jsdom
/**
 * Home as a Today screen on a phone: a short title, the rewards' Today card (rewards on), ONE big primary button
 * "Start a set" with its line, then Resume (the active set, or the unfinished problem), then the class and unit
 * lists. A wide screen keeps today's layout, plus the button.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getCourse } from '@/content'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { markSlotDone, newActiveSet, nextInSet, noteSetAttempt, saveActiveSet, type ActiveSet } from '@/session/activeSet'
import { buildSet } from '@/session/buildSet'
import { emptyRewards, resetStoreForTests, useStore } from '@/store'
import { Home } from './Home'

const PAGE_TIMEOUT = 120_000

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Filled buttons and links that are actions (a selected class tab or unit chip is a choice, not an action). */
function primaryActions(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('button, a')].filter((el) => {
    if (el.getAttribute('role') === 'tab' || el.hasAttribute('aria-pressed')) return false
    const classes = el.className.split(/\s+/)
    return classes.includes('bg-navy') && classes.includes('text-white')
  })
}

function precalcSet(): ActiveSet {
  const built = buildSet({ course: getCourse('precalc')!, events: [], rewards: emptyRewards(), now: Date.now(), seed: 77 })
  return newActiveSet(built, { now: Date.now(), timed: false })
}

/** She finished problem 1 of her set and went on to problem 2; she also left another problem unfinished. */
function seedSetAndOtherWork(): ActiveSet {
  const set = nextInSet(markSlotDone(noteSetAttempt(precalcSet(), 0, 'first'), 0))
  saveActiveSet(set)
  useStore.getState().startAttempt({
    problemId: 'inequalities/ineq.linear@1/abc',
    moduleId: 'inequalities',
    templateId: 'ineq.linear',
    skill: 'ineq.linear',
    seed: 'abc',
    difficulty: '',
    genVersion: 1,
  })
  useStore.getState().acceptStep({ text: 'x < 3' })
  return set
}

const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
})

afterEach(() => {
  removePointer()
})

describe('Home on a phone: the Today screen', () => {
  it('a short title, then ONE primary button, Start a set, with its line; no sales paragraph', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    renderHome()
    const title = screen.getByRole('heading', { level: 1, name: 'Math & Science Trainer' })
    expect(title.className).toContain('text-2xl')
    expect(screen.queryByText(/Practice that checks your work as you go/)).toBeNull()
    const start = screen.getByRole('button', { name: 'Start a set' })
    expect(start.getAttribute('aria-describedby')).toBeTruthy()
    expect(document.getElementById(start.getAttribute('aria-describedby')!)?.textContent).toBe('3 problems, about 5 minutes')
    expect(primaryActions()).toEqual([start])
    // The class and unit lists are still there, their buttons outlined; the unit's path (it replaced the module
    // cards) adds no primary action: its stops are nodes, not filled buttons.
    expect(screen.getByRole('tablist', { name: 'Classes' })).toBeTruthy()
    expect(document.querySelectorAll('[data-path-stop]').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Modules in this unit' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Practice weak spots' })).toBeTruthy()
  })

  it('rewards on: the Today card, then Start a set, then Resume your set · 2 of 3, then the other unfinished problem, then the classes', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    useStore.getState().setSettings({ rewards: true })
    seedSetAndOtherWork()
    renderHome()
    const today = screen.getByRole('region', { name: 'Today' })
    const start = screen.getByRole('button', { name: 'Start a set' })
    const resume = screen.getByRole('link', { name: 'Resume your set · 2 of 3' })
    const other = screen.getByRole('link', { name: 'Continue' })
    const classes = screen.getByRole('tablist', { name: 'Classes' })
    expect(resume.getAttribute('href')).toBe('/set')
    expect(follows(today, start)).toBe(true)
    expect(follows(start, resume)).toBe(true)
    expect(follows(resume, other)).toBe(true)
    expect(follows(other, classes)).toBe(true)
    // Still one primary action: Resume and Continue are outlined.
    expect(primaryActions()).toEqual([start])
  })

  it('rewards off: the button and Resume still show', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    seedSetAndOtherWork()
    renderHome()
    expect(screen.queryByRole('region', { name: 'Today' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Start a set' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Resume your set · 2 of 3' })).toBeTruthy()
  })

  it('a set whose results she has seen is not offered again', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    const set = precalcSet()
    saveActiveSet({ ...set, index: 3, status: ['done', 'done', 'skipped'] })
    renderHome()
    expect(screen.queryByRole('link', { name: /^Resume your set/ })).toBeNull()
  })
})

describe('Home on a wide screen', () => {
  it('keeps today’s layout (the paragraph, filled buttons), plus the Start a set button', { timeout: PAGE_TIMEOUT }, () => {
    seedSetAndOtherWork()
    renderHome()
    const title = screen.getByRole('heading', { level: 1, name: 'Math & Science Trainer' })
    expect(title.className).toContain('text-3xl')
    expect(screen.getByText(/Practice that checks your work as you go/)).toBeTruthy()
    const start = screen.getByRole('button', { name: 'Start a set' })
    const primary = primaryActions()
    expect(primary).toContain(start)
    expect(primary).toContain(screen.getByRole('link', { name: 'Continue' }))
    expect(primary).toContain(screen.getByRole('link', { name: 'Resume your set · 2 of 3' }))
    expect(primary).toContain(screen.getByRole('button', { name: 'Practice weak spots' }))
    // The module cards' filled "Random problem" buttons gave way to the path: its stops are not filled actions there
    // either, and the module pages are a list of links.
    const stops = [...document.querySelectorAll<HTMLElement>('[data-path-stop]')]
    expect(stops.length).toBeGreaterThan(0)
    for (const stop of stops) expect(primary).not.toContain(stop)
    expect(screen.getByRole('region', { name: 'Modules in this unit' })).toBeTruthy()
  })
})
