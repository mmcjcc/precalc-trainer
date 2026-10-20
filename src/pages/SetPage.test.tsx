// @vitest-environment jsdom
/**
 * Sets (pages/SetPage.tsx): three problems one after another on the usual problem screen, the set's progress in the
 * phone's header and in the completion area on a wide screen, Skip (the header's menu or the leave sheet), leaving
 * and resuming, the results, and the set's one break (session/breaks.ts): called once, at "See results", never by
 * "Next in set", "Another set" or "Start a set".
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem } from '@/content'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { problemPath } from '@/problem/url'
import { loadActiveSet, saveActiveSet, SET_STORAGE_KEY, type ActiveSet } from '@/session/activeSet'
import { registerSetEndBreak } from '@/session/breaks'
import { resetStoreForTests, useStore, type Ev } from '@/store'
import { Home } from './Home'
import ProblemPage from './Problem'
import { SetPage } from './SetPage'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

/** Each test renders whole problem pages: slow under a full parallel run. */
const PAGE_TIMEOUT = 120_000

function PathProbe() {
  const { pathname } = useLocation()
  return <p data-testid="path">{pathname}</p>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PathProbe />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/set" element={<SetPage />} />
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const path = () => screen.getByTestId('path').textContent

/** A set made by hand, so the test knows its problems. */
function handSet(problems: { moduleId: string; templateId: string; seed: number }[]): ActiveSet {
  return {
    version: 1,
    id: 'set-test',
    courseId: 'precalc',
    startedAt: Date.now(),
    timed: false,
    problems: problems.map((p) => ({ ...p, flags: '', pick: 'unit' as const })),
    index: 0,
    attemptIds: problems.map(() => null),
    status: problems.map(() => 'pending' as const),
  }
}

const NL = (seed: number) => ({ moduleId: 'numberLine', templateId: 'nl.read', seed })
const INEQ = (seed: number) => ({ moduleId: 'inequalities', templateId: 'ineq.linear', seed })

/** The number line answered right on the first check: the quickest finish. */
function finishNumberLine(seed: number) {
  const inst = generateProblem('numberLine', 'nl.read', seed, {})
  if (inst.answer.type !== 'set') throw new Error('expected a set answer')
  fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
  fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
}

const setHeader = () => document.querySelector('[data-set-header]') as HTMLElement
const breakSpy = vi.fn((go: () => void) => go())
let unregister: (() => void) | null = null

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  breakSpy.mockClear()
  unregister = registerSetEndBreak(breakSpy)
  // jsdom logs "Not implemented" instead of scrolling.
  window.scrollTo = () => {}
})

afterEach(() => {
  unregister?.()
  unregister = null
  removePointer()
})

describe('a set on a phone, rewards on', () => {
  it('runs three problems: Next in set, Skip from the header’s menu, See results (the one break), then Another set', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    useStore.getState().setSettings({ rewards: true })
    saveActiveSet(handSet([NL(101), INEQ(202), NL(303)]))
    renderAt('/set')

    // Problem 1: the set's progress in the compact header, no top navigation of its own.
    expect(within(setHeader()).getByText('1 of 3')).toBeTruthy()
    expect(within(setHeader()).getByText('Problem 1 of 3 in your set')).toBeTruthy()
    expect(setHeader().querySelectorAll('[data-set-dot]')).toHaveLength(3)
    const close = within(setHeader()).getByRole('link', { name: 'Close, back to Home. Your set is kept.' })
    expect(close.getAttribute('href')).toBe('/')
    finishNumberLine(101)
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(within(sheet).queryByRole('button', { name: 'Next problem' })).toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Next in set' }))
    expect(breakSpy).not.toHaveBeenCalled()

    // Problem 2: skipped from the ⋯ menu. She only opened it, so nothing is recorded as left unfinished.
    expect(within(setHeader()).getByText('2 of 3')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: generateProblem('inequalities', 'ineq.linear', 202, {}).title })).toBeTruthy()
    expect(loadActiveSet()?.status).toEqual(['done', 'pending', 'pending'])
    fireEvent.click(within(setHeader()).getByRole('button', { name: 'Set options' }))
    const menu = screen.getByRole('dialog', { name: 'Your set · problem 2 of 3' })
    fireEvent.click(within(menu).getByRole('button', { name: 'Skip this problem' }))
    expect(useStore.getState().events.some((e) => e.t === 'problem_abandoned')).toBe(false)
    expect(loadActiveSet()?.status).toEqual(['done', 'skipped', 'pending'])

    // Problem 3, the last: its main button is See results, which runs the break once and shows the results.
    expect(within(setHeader()).getByText('3 of 3')).toBeTruthy()
    finishNumberLine(303)
    const last = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(breakSpy).not.toHaveBeenCalled()
    fireEvent.click(within(last).getByRole('button', { name: 'See results' }))
    expect(breakSpy).toHaveBeenCalledTimes(1)
    expect(breakSpy).toHaveBeenCalledWith(expect.any(Function), { timed: false })

    expect(screen.getByRole('heading', { level: 1, name: 'Set done' })).toBeTruthy()
    const items = within(screen.getByRole('list', { name: 'Problems in this set' })).getAllByRole('listitem')
    expect(items.map((li) => li.getAttribute('data-outcome'))).toEqual(['firstTry', 'skipped', 'firstTry'])
    expect(items[0]!.textContent).toContain('Right first time')
    expect(items[1]!.textContent).toContain('Skipped')
    // Two clean number lines: 50 XP each, the ring that moved, today's goal.
    expect(screen.getByText('+100 XP')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Today’s goal' }).getAttribute('aria-valuetext')).toBe('100 of 60 XP, goal met')
    expect(screen.getByRole('img', { name: 'Read the number line: Practiced: 2 of the last 5 went well' })).toBeTruthy()
    expect(screen.getByText('New → Practiced')).toBeTruthy()
    expect(loadActiveSet()?.index).toBe(3)

    // Another set starts something: no break. It is a new set, on its first problem.
    fireEvent.click(screen.getByRole('button', { name: 'Another set' }))
    expect(breakSpy).toHaveBeenCalledTimes(1)
    const another = loadActiveSet()!
    expect(another.id).not.toBe('set-test')
    expect(another.index).toBe(0)
    expect(another.problems).toHaveLength(3)
    expect(within(setHeader()).getByText('1 of 3')).toBeTruthy()
    expect(path()).toBe('/set')
  })
})

describe('a set on a wide screen, rewards off', () => {
  it('keeps the page and shows the set’s progress in a bar and in the completion area; Done goes Home', { timeout: PAGE_TIMEOUT }, () => {
    saveActiveSet(handSet([NL(11), NL(12)]))
    renderAt('/set')
    const bar = document.querySelector('[data-set-bar]') as HTMLElement
    expect(within(bar).getByText('Your set · 1 of 2')).toBeTruthy()
    expect(within(bar).getByRole('button', { name: 'Skip this problem…' })).toBeTruthy()
    // Today's wide page: the breadcrumb and the shortcuts stay.
    expect(screen.getByRole('button', { name: 'shortcuts (?)' })).toBeTruthy()

    finishNumberLine(11)
    const card = document.querySelector('[data-completion-card]') as HTMLElement
    expect(within(card).getByText('Your set · 1 of 2')).toBeTruthy()
    expect(within(card).queryByRole('link', { name: /^Back to/ })).toBeNull()
    expect(within(card).queryByText(/XP/)).toBeNull()
    // Finished: nothing left to skip.
    expect(within(bar).queryByRole('button', { name: 'Skip this problem…' })).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: 'Next in set' }))

    finishNumberLine(12)
    expect(breakSpy).not.toHaveBeenCalled()
    fireEvent.click(within(document.querySelector('[data-completion-card]') as HTMLElement).getByRole('button', { name: 'See results' }))
    expect(breakSpy).toHaveBeenCalledTimes(1)

    // Rewards off: the same results without XP, rings and the goal.
    expect(screen.getByRole('heading', { level: 1, name: 'Set done' })).toBeTruthy()
    expect(within(screen.getByRole('list', { name: 'Problems in this set' })).getAllByText('Right first time')).toHaveLength(2)
    expect(screen.queryByText(/XP/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(path()).toBe('/')
    expect(localStorage.getItem(SET_STORAGE_KEY)).toBeNull()
    expect(screen.queryByRole('link', { name: /^Resume your set/ })).toBeNull()
  })

  it('skipping the last problem leaves its See results to her; a second tap while the break is up does nothing', { timeout: PAGE_TIMEOUT }, () => {
    // The store app's break: the results come when its ad closes.
    unregister?.()
    let closeAd: (() => void) | null = null
    const ad = vi.fn((go: () => void) => {
      closeAd = go
    })
    unregister = registerSetEndBreak(ad)
    saveActiveSet({ ...handSet([NL(21), INEQ(22)]), index: 1, status: ['done', 'pending'], attemptIds: ['gone', null] })
    renderAt('/set')
    fireEvent.click(screen.getByRole('button', { name: 'Skip this problem…' }))
    const menu = screen.getByRole('dialog', { name: 'Your set · problem 2 of 2' })
    expect(menu.textContent).toContain('your results come next')
    fireEvent.click(within(menu).getByRole('button', { name: 'Skip this problem' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Skipped' })).toBeTruthy()
    expect(ad).not.toHaveBeenCalled()
    // She only opened it: no trace of it, and no unfinished problem left behind for Home.
    expect(useStore.getState().attempt).toBeNull()
    expect(useStore.getState().events).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'See results' }))
    fireEvent.click(screen.getByRole('button', { name: 'See results' }))
    expect(ad).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('heading', { name: 'Set done' })).toBeNull()
    act(() => closeAd!())
    expect(screen.getByRole('heading', { level: 1, name: 'Set done' })).toBeTruthy()
    expect(loadActiveSet()?.index).toBe(2)
  })
})

describe('leaving and resuming', () => {
  it('Start a set on Home; leave with work in it; Home offers Resume; the problem comes back with her work', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    // Home on Unit 1 (a set with no history starts from the unit Home shows).
    useStore.getState().setSettings({ courseId: 'precalc', unitByCourse: { precalc: 'unit1' } })
    renderAt('/')
    fireEvent.click(screen.getByRole('button', { name: 'Start a set' }))
    expect(path()).toBe('/set')
    expect(breakSpy).not.toHaveBeenCalled()
    const set = loadActiveSet()!
    expect(set.problems).toHaveLength(3)
    // No history: the first type of the unit Home shows.
    expect(set.problems[0]!.templateId).toBe('nl.read')

    // A wrong check: she has work in it now.
    fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: '[-inf, 2)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    const attemptId = useStore.getState().attempt!.id
    expect(loadActiveSet()?.attemptIds[0]).toBe(attemptId)

    fireEvent.click(within(setHeader()).getByRole('link', { name: 'Close, back to Home. Your set is kept.' }))
    expect(path()).toBe('/')
    const resume = screen.getByRole('link', { name: 'Resume your set · 1 of 3' })
    expect(resume.getAttribute('href')).toBe('/set')
    // The unfinished problem is the set's, so it has no card of its own.
    expect(screen.queryByRole('link', { name: 'Continue' })).toBeNull()
    expect(useStore.getState().events.some((e) => e.t === 'problem_abandoned')).toBe(false)

    fireEvent.click(resume)
    expect(path()).toBe('/set')
    expect(useStore.getState().attempt?.id).toBe(attemptId)
    expect(within(setHeader()).getByText('1 of 3')).toBeTruthy()
  })

  it('the leave sheet knows a set problem: Back to it returns to the set, Skip it skips it there', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    saveActiveSet(handSet([NL(31), NL(32), NL(33)]))
    const first = renderAt('/set')
    fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: '[-inf, 2)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
    const setAttempt = useStore.getState().attempt!.id
    first.unmount()

    // Another problem, opened from elsewhere: the sheet names her set.
    const elsewhere = problemPath('inequalities', 'ineq.linear', 4242)
    const second = renderAt(elsewhere)
    let sheet = screen.getByRole('dialog', { name: 'Unfinished problem' })
    expect(sheet.textContent).toContain('problem 1 of 3 in your set')
    fireEvent.click(within(sheet).getByRole('button', { name: 'Back to it' }))
    expect(path()).toBe('/set')
    expect(useStore.getState().attempt?.id).toBe(setAttempt)
    second.unmount()

    renderAt(elsewhere)
    sheet = screen.getByRole('dialog', { name: 'Unfinished problem' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Skip it' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const set = loadActiveSet()!
    expect(set.status).toEqual(['skipped', 'pending', 'pending'])
    expect(set.index).toBe(1)
    expect(set.attemptIds[0]).toBe(setAttempt)
    // Her work there is left unfinished (counted as skipped in the set); the other problem starts.
    const events: Ev[] = useStore.getState().events
    expect(events.filter((e) => e.t === 'problem_abandoned').map((e) => (e.t === 'problem_abandoned' ? e.attemptId : ''))).toEqual([setAttempt])
    expect(useStore.getState().attempt?.templateId).toBe('ineq.linear')
  })

  it('a corrupt or old stored set is ignored: the set page goes Home, and Home offers no Resume', { timeout: PAGE_TIMEOUT }, () => {
    localStorage.setItem(SET_STORAGE_KEY, JSON.stringify({ ...handSet([NL(1)]), version: 0 }))
    renderAt('/set')
    expect(path()).toBe('/')
    expect(screen.queryByRole('link', { name: /^Resume your set/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Start a set' })).toBeTruthy()
  })
})

describe('the results', () => {
  const DAY = 86_400_000
  const now = Date.now()
  const at = (offset: number) => now - offset

  /** A set she finished: a linear inequality with two caught mistakes, a clean number line that squashed a mistake, a skip. */
  function seedFinishedSet() {
    const nlSkill = 'nl.read'
    const ineq = 'ineq.linear'
    const events: Ev[] = [
      // Before the set: a number-line mistake, then two clean number lines (2 of 3 to squash it).
      { t: 'step_rejected', at: at(3 * DAY), attemptId: 'r0', skill: nlSkill, stepIdx: 0, pattern: 'endpoint_type' },
      { t: 'problem_done', at: at(2 * DAY), attemptId: 'x1', skill: nlSkill, moduleId: 'numberLine', steps: 0, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 30 },
      { t: 'problem_done', at: at(DAY), attemptId: 'x2', skill: nlSkill, moduleId: 'numberLine', steps: 0, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 30 },
      // The set, today.
      { t: 'step_rejected', at: at(600), attemptId: 'a1', skill: ineq, stepIdx: 0, pattern: 'no_sign_flip' },
      { t: 'step_rejected', at: at(590), attemptId: 'a1', skill: ineq, stepIdx: 0 },
      { t: 'step_accepted', at: at(580), attemptId: 'a1', skill: ineq, stepIdx: 0, firstTry: false, revealed: false, property: 'skipped' },
      { t: 'final_answer', at: at(570), attemptId: 'a1', skill: ineq, correct: true, via: 'text' },
      { t: 'problem_done', at: at(560), attemptId: 'a1', skill: ineq, moduleId: 'inequalities', steps: 1, firstTryRate: 0, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 90 },
      { t: 'final_answer', at: at(400), attemptId: 'a2', skill: nlSkill, correct: true, via: 'text', part: 'Interval notation' },
      { t: 'final_answer', at: at(399), attemptId: 'a2', skill: nlSkill, correct: true, via: 'text', part: 'Set-builder notation' },
      { t: 'problem_done', at: at(390), attemptId: 'a2', skill: nlSkill, moduleId: 'numberLine', steps: 0, firstTryRate: 1, hints: 0, revealed: 0, finalCorrect: true, mode: 'normal', secs: 40 },
      { t: 'step_accepted', at: at(200), attemptId: 'a3', skill: 'dr.domain', stepIdx: 0, firstTry: true, revealed: false, property: 'skipped' },
      { t: 'problem_abandoned', at: at(100), attemptId: 'a3', skill: 'dr.domain' },
    ]
    useStore.setState({ events })
    saveActiveSet({
      ...handSet([INEQ(1), NL(2), { moduleId: 'domainRange', templateId: 'dr.domain', seed: 3 }]),
      index: 3,
      attemptIds: ['a1', 'a2', 'a3'],
      status: ['done', 'done', 'skipped'],
    })
  }

  const items = () => within(screen.getByRole('list', { name: 'Problems in this set' })).getAllByRole('listitem')

  it('rewards on: each problem, the set’s XP (its attempts’ awards), the goal ring, the rings that moved, the mistake squashed', { timeout: PAGE_TIMEOUT }, () => {
    useStore.getState().setSettings({ rewards: true })
    seedFinishedSet()
    renderAt('/set')
    expect(screen.getByRole('heading', { level: 1, name: 'Set done' })).toBeTruthy()
    expect(items().map((li) => li.getAttribute('data-outcome'))).toEqual(['fixed', 'firstTry', 'skipped'])
    expect(items()[0]!.textContent).toContain('Caught and fixed 2 mistakes')
    expect(items()[0]!.textContent).toContain(generateProblem('inequalities', 'ineq.linear', 1, {}).title)
    expect(items()[1]!.textContent).toContain('Right first time')
    expect(items()[2]!.textContent).toContain('Skipped')
    // a1: a fixed line 5 + the answer 10 + finished 20 + no hints 10; a2: two boxes 20 + 20 + 10 + squash 50; a3: a line 10.
    expect(screen.getByText('+155 XP')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Today’s goal' }).getAttribute('aria-valuetext')).toBe('155 of 60 XP, goal met')
    expect(screen.getByRole('img', { name: 'Linear inequality: Practiced: 0 of the last 5 went well' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Read the number line: Solid: 3 of the last 5 went well' })).toBeTruthy()
    expect(screen.getByText('Practiced → Solid')).toBeTruthy()
    const squashed = screen.getByRole('list', { name: 'Mistakes squashed' })
    expect(squashed.textContent).toContain('Squashed:')
    expect(within(squashed).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Another set' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy()
    expect(breakSpy).not.toHaveBeenCalled()
  })

  it('rewards off: the same problems, without XP, rings, the goal or the squashed mistakes', { timeout: PAGE_TIMEOUT }, () => {
    seedFinishedSet()
    renderAt('/set')
    expect(screen.getByRole('heading', { level: 1, name: 'Set done' })).toBeTruthy()
    expect(items().map((li) => li.getAttribute('data-outcome'))).toEqual(['fixed', 'firstTry', 'skipped'])
    expect(screen.queryByText(/XP/)).toBeNull()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByRole('list', { name: 'Mistakes squashed' })).toBeNull()
  })
})
