// @vitest-environment jsdom
/**
 * The combo pill on the problem screen (pages/flows/ProblemFrame.tsx): "3 in a row!" from 3 on with rewards on, in the
 * composer near the verdict line (a phone) or at the top of the composer under the work list (a wide screen), at the
 * bottom of the screen where a problem has no composer, carried across a running set; never with rewards off.
 */
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installPointer, removePointer } from '@/components/keypadTesting'
import ProblemPage from '@/pages/Problem'
import { SetPage } from '@/pages/SetPage'
import { problemPath } from '@/problem/url'
import { saveActiveSet, type ActiveSet } from '@/session/activeSet'
import { resetStoreForTests, useStore, type Ev } from '@/store'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

const PAGE_TIMEOUT = 120_000

/** An IntersectionObserver that never reports (jsdom has none). */
class QuietObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/set" element={<SetPage />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

let clock = Date.now() - 60_000
function lineOf(attemptId: string, stepIdx: number): Ev {
  clock += 10
  return { t: 'step_accepted', at: clock, attemptId, skill: 'ineq.linear', stepIdx, firstTry: true, revealed: false, property: 'skipped' }
}
function partOf(attemptId: string, skill: string): Ev {
  clock += 10
  return { t: 'final_answer', at: clock, attemptId, skill, correct: true, via: 'text' }
}

/** Her log gains these events (the pill reads the log; the lines need not be on the screen). */
function add(events: Ev[]) {
  act(() => useStore.setState((s) => ({ events: [...s.events, ...events] })))
}

const liveId = () => useStore.getState().attempt!.id
const row = () => document.querySelector<HTMLElement>('[data-combo-row]')
const pill = () => row()?.querySelector<HTMLElement>('[data-combo-tier]') ?? null

const INEQ = problemPath('inequalities', 'ineq.linear', 12345)
const NUMBER_LINE = problemPath('numberLine', 'nl.read', 12345)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  vi.stubGlobal('IntersectionObserver', QuietObserver)
  window.scrollTo = () => {}
})

afterEach(() => {
  vi.unstubAllGlobals()
  removePointer()
})

describe('rewards on', () => {
  beforeEach(() => {
    useStore.getState().setSettings({ rewards: true })
  })

  it('a phone: from 3 in a row, the pill in the composer right above the verdict line; it grows at 5 and 10; a slip resets it quietly', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    renderAt(INEQ)
    const id = liveId()
    add([lineOf(id, 0), lineOf(id, 1)])
    expect(row()).toBeNull()
    add([lineOf(id, 2)])
    expect(pill()!.textContent).toBe('3 in a row!')
    expect(pill()!.getAttribute('data-combo-tier')).toBe('1')
    // In the composer, not inside the verdict row (which keeps its own words).
    expect(row()!.closest('[data-keypad-region]')).toBeTruthy()
    expect(document.querySelector('[data-composer-status]')?.contains(row()) ?? false).toBe(false)
    expect(pill()!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    add([lineOf(id, 3), lineOf(id, 4)])
    expect(pill()!.textContent).toBe('5 in a row!')
    expect(pill()!.getAttribute('data-combo-tier')).toBe('2')
    add([5, 6, 7, 8, 9].map((i) => lineOf(id, i)))
    expect(pill()!.getAttribute('data-combo-tier')).toBe('3')
    add([{ t: 'step_rejected', at: (clock += 10), attemptId: id, skill: 'ineq.linear', stepIdx: 10, pattern: 'no_sign_flip' }])
    expect(row()).toBeNull()
  })

  it('a wide screen: at the top of the composer, under the work list', { timeout: PAGE_TIMEOUT }, () => {
    renderAt(INEQ)
    const id = liveId()
    add([lineOf(id, 0), lineOf(id, 1), lineOf(id, 2), lineOf(id, 3)])
    expect(pill()!.textContent).toBe('4 in a row!')
    const composer = row()!.closest('[data-keypad-region]')!
    expect(composer).toBeTruthy()
    expect(composer.firstElementChild).toBe(row())
    expect(document.querySelector('[data-composer-status]')).toBeNull()
  })

  it('a problem with no composer: the pill waits at the bottom of the screen, above the keypad', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    renderAt(NUMBER_LINE)
    const id = liveId()
    add([partOf(id, 'nl.read'), partOf(id, 'nl.read'), partOf(id, 'nl.read')])
    expect(pill()!.textContent).toBe('3 in a row!')
    expect(row()!.className).toContain('combo-dock')
    expect(row()!.closest('[data-keypad-region]')).toBeNull()
  })

  it('carried across a running set: the earlier problem’s right lines count', { timeout: PAGE_TIMEOUT }, () => {
    const nl = (seed: number) => ({ moduleId: 'numberLine', templateId: 'nl.read', seed, flags: '', pick: 'unit' as const })
    const set: ActiveSet = {
      version: 1,
      id: 'set-combo',
      courseId: 'precalc',
      startedAt: Date.now(),
      timed: false,
      problems: [nl(101), nl(202), nl(303)],
      index: 1,
      attemptIds: ['p1', null, null],
      status: ['done', 'pending', 'pending'],
    }
    saveActiveSet(set)
    useStore.setState({
      events: [
        lineOf('p1', 0),
        lineOf('p1', 1),
        { t: 'problem_done', at: (clock += 10), attemptId: 'p1', skill: 'nl.read', moduleId: 'numberLine', steps: 2, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 30 },
      ],
    })
    renderAt('/set')
    expect(row()).toBeNull()
    add([partOf(liveId(), 'nl.read')])
    expect(pill()!.textContent).toBe('3 in a row!')
  })
})

describe('rewards off', () => {
  it('never shows the pill, however many in a row', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    renderAt(INEQ)
    const id = liveId()
    add([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => lineOf(id, i)))
    expect(row()).toBeNull()
    expect(screen.queryByText(/in a row!/)).toBeNull()
  })
})
