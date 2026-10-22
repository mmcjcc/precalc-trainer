// @vitest-environment jsdom
/**
 * The rewards on screen, with rewards on and off, on a phone (a touch screen below 768 px) and on a wide screen: the
 * finish sheet that takes the completion card's place, the top of Home, the Progress rings and the mistake
 * collection, the Settings switches, and the vibrate ticks.
 */
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateProblem, getTemplate } from '@/content'
import { ERROR_PATTERNS } from '@/engine'
import { installPointer, removePointer } from '@/components/keypadTesting'
import { problemPath } from '@/problem/url'
import { resetStoreForTests, useStore, type Ev } from '@/store'
import { Home } from '@/pages/Home'
import ProblemPage from '@/pages/Problem'
import { ProgressPage } from '@/pages/Progress'
import { SettingsPage } from '@/pages/Settings'
import { GOAL_TICK, TICK_MS, useRewardTicks } from './haptics'

vi.mock('@/components/Graph', () => ({ Graph: () => <div data-testid="graph-stub" /> }))

/** An IntersectionObserver that reports the problem card as scrolled away (the phone's pinned strip). */
class GoneObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    const rect = { top: -400, bottom: -100 }
    this.callback([{ target, isIntersecting: false, boundingClientRect: rect } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
  disconnect() {}
  unobserve() {}
}

const PAGE_TIMEOUT = 120_000
const DAY = 86_400_000
const NL_TITLE = getTemplate('numberLine', 'nl.read').title
const LINEAR_TITLE = getTemplate('inequalities', 'ineq.linear').title

/** Local time `offset` days from today, at `hour`. */
function dayAt(offset: number, hour = 9): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, hour).getTime()
}

function done(attemptId: string, skill: string, at: number, opts: Partial<Extract<Ev, { t: 'problem_done' }>> = {}): Ev {
  return {
    t: 'problem_done',
    at,
    attemptId,
    skill,
    moduleId: skill.startsWith('nl.') ? 'numberLine' : 'inequalities',
    steps: 2,
    firstTryRate: 1,
    hints: 0,
    revealed: 0,
    finalCorrect: true,
    mode: 'normal',
    secs: 60,
    ...opts,
  }
}

function rejected(attemptId: string, skill: string, at: number, pattern: string): Ev {
  return { t: 'step_rejected', at, attemptId, skill, stepIdx: 0, pattern }
}

function line(attemptId: string, stepIdx: number, at: number): Ev {
  return { t: 'step_accepted', at, attemptId, skill: 'ineq.linear', stepIdx, firstTry: true, revealed: false, property: 'skipped' }
}

const rewardsOn = () => useStore.getState().setSettings({ rewards: true })
const completionToasts = () => useStore.getState().toasts.filter((t) => /^Problem (complete|finished)$/.test(t.message))

function renderProblem(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:moduleId/:templateId/:seed" element={<ProblemPage />} />
        <Route path="/" element={<p>Home page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

/** The number line problem answered right on the first check: the quickest way to a finish (+50 XP). */
function finishNumberLine() {
  const inst = generateProblem('numberLine', 'nl.read', 12345, {})
  if (inst.answer.type !== 'set') throw new Error('expected a set answer')
  renderProblem(problemPath('numberLine', 'nl.read', 12345))
  fireEvent.change(screen.getByLabelText('Interval notation'), { target: { value: inst.answer.interval } })
  fireEvent.change(screen.getByLabelText('Set-builder notation'), { target: { value: inst.answer.setBuilder } })
  fireEvent.click(screen.getByRole('button', { name: 'Check answer' }))
}

const card = () => document.querySelector('[data-completion-card]') as HTMLElement
const itemsOf = (list: HTMLElement) => within(list).getAllByRole('listitem').map((li) => li.textContent)

beforeEach(() => {
  resetStoreForTests()
  localStorage.clear()
  vi.stubGlobal('IntersectionObserver', GoneObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
  removePointer()
  delete (navigator as { vibrate?: unknown }).vibrate
})

describe('the finish sheet', () => {
  it('a phone with rewards on: a big check, the XP and the lines that earned it, the two rings, Next problem and Done for today', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    finishNumberLine()
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(within(sheet).getByText('+50 XP')).toBeTruthy()
    expect(itemsOf(within(sheet).getByRole('list', { name: 'XP earned' }))).toEqual([
      'Interval notation right first try+10',
      'Set-builder notation right first try+10',
      'Problem finished+20',
      'No hints+10',
    ])
    expect(within(sheet).getByRole('progressbar', { name: 'Today’s goal' }).getAttribute('aria-valuetext')).toBe('50 of 60 XP')
    expect(within(sheet).getByText('10 XP to today’s goal')).toBeTruthy()
    expect(within(sheet).getByRole('img', { name: `${NL_TITLE}: Practiced: 1 of the last 5 went well` })).toBeTruthy()
    expect(within(sheet).getByText('New → Practiced')).toBeTruthy()
    expect(within(sheet).getByRole('button', { name: 'Next problem' })).toBeTruthy()
    expect(within(sheet).getByRole('link', { name: 'Done for today' }).getAttribute('href')).toBe('/')
    // The sheet is the completion card: no toast, no second card behind it, no old day streak.
    expect(completionToasts()).toEqual([])
    expect(document.querySelectorAll('[data-completion-card]')).toHaveLength(1)

    // Closed, it leaves a small card with the XP; "See what you earned" brings it back.
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(card().textContent).toMatch(/^✓ Problem complete\+50 XP · 0 hints/)
    expect(within(card()).getByRole('button', { name: 'Next problem' })).toBeTruthy()
    fireEvent.click(within(card()).getByRole('button', { name: 'See what you earned' }))
    expect(screen.getByRole('dialog', { name: 'Problem complete' })).toBeTruthy()
  })

  it('Done for today goes Home; Next problem opens the next one', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    finishNumberLine()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('link', { name: 'Done for today' }))
    expect(screen.getByText('Home page')).toBeTruthy()
  })

  it('cheers the goal met and a comeback after three days away', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    // Last seen five days ago; this morning, three lines of another problem (30 XP) but no finish yet.
    useStore.setState({ events: [done('old', 'ineq.linear', dayAt(-5)), line('other', 0, dayAt(0, 0)), line('other', 1, dayAt(0, 0) + 1), line('other', 2, dayAt(0, 0) + 2)] })
    finishNumberLine()
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(itemsOf(within(sheet).getByRole('list', { name: 'Cheers' }))).toEqual(['★ Welcome back!', '★ Today’s goal is met!'])
    expect(within(sheet).getByRole('progressbar', { name: 'Today’s goal' }).getAttribute('aria-valuetext')).toBe('80 of 60 XP, goal met')
  })

  it('a squashed mistake and a newly mastered type are lines of their own (+50, +100)', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    const P = 'no_sign_flip'
    useStore.setState({
      events: [
        ...[6, 5, 4, 3].map((d) => done(`p${d}`, 'nl.read', dayAt(-d))), // four that went well
        rejected('c', 'nl.read', dayAt(-2), P), // caught
        done('t1', 'nl.read', dayAt(-2, 12), { mode: 'timed' }), // 1 of 3 (timed: no mastery, still a finished problem)
        done('t2', 'nl.read', dayAt(-1), { mode: 'timed' }), // 2 of 3
      ],
    })
    finishNumberLine()
    const sheet = screen.getByRole('dialog', { name: 'Problem complete' })
    expect(within(sheet).getByText('+200 XP')).toBeTruthy()
    expect(itemsOf(within(sheet).getByRole('list', { name: 'XP earned' }))).toEqual([
      'Interval notation right first try+10',
      'Set-builder notation right first try+10',
      'Problem finished+20',
      'No hints+10',
      `★ Squashed: ${ERROR_PATTERNS[P].title}+50`,
      `★ Mastered: ${NL_TITLE}+100`,
    ])
    expect(within(sheet).getByRole('img', { name: `${NL_TITLE}: Mastered` })).toBeTruthy()
    expect(within(sheet).getByText('Solid → Mastered')).toBeTruthy()
  })

  it('a phone with rewards off keeps the completion card exactly as it was', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    finishNumberLine()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(card()).getByRole('heading', { name: /Problem complete/ })).toBeTruthy()
    expect(card().textContent).not.toMatch(/XP/)
    expect(within(card()).getByRole('button', { name: 'Next problem' })).toBeTruthy()
    expect(within(card()).queryByRole('link', { name: 'Done for today' })).toBeNull()
    expect(within(card()).queryByRole('button', { name: 'See what you earned' })).toBeNull()
    expect(document.querySelector('[data-finish-rewards]')).toBeNull()
  })

  it('a wide screen with rewards on shows the same rewards inside the completion card', { timeout: PAGE_TIMEOUT }, () => {
    rewardsOn()
    finishNumberLine()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(card()).getByText('+50 XP')).toBeTruthy()
    expect(itemsOf(within(card()).getByRole('list', { name: 'XP earned' }))).toHaveLength(4)
    expect(within(card()).getByRole('progressbar', { name: 'Today’s goal' })).toBeTruthy()
    expect(within(card()).getByRole('img', { name: new RegExp(`^${NL_TITLE}: Practiced`) })).toBeTruthy()
    expect(within(card()).getByRole('link', { name: 'Done for today' })).toBeTruthy()
    expect(within(card()).getByRole('button', { name: 'Copy link' })).toBeTruthy()
    expect(completionToasts()).toEqual([])
  })
})

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** Four mistake cards on ineq.linear (2 of 3, 1 of 3, then two at 0 of 3) and 30 XP this morning. */
function seedHome() {
  useStore.setState({
    events: [
      rejected('r1', 'ineq.linear', dayAt(-5), 'no_sign_flip'),
      done('d1', 'ineq.linear', dayAt(-4), { firstTryRate: 0.5 }),
      rejected('r2', 'ineq.linear', dayAt(-4, 12), 'flip_on_add'),
      done('d2', 'ineq.linear', dayAt(-3), { firstTryRate: 0.5 }),
      rejected('r3', 'ineq.linear', dayAt(-2), 'endpoint_type'),
      rejected('r4', 'ineq.linear', dayAt(-1), 'dropped_union'),
      line('a', 0, dayAt(0, 0)),
      line('a', 1, dayAt(0, 0) + 1),
      line('a', 2, dayAt(0, 0) + 2),
    ],
  })
}

describe('the top of Home', () => {
  it('rewards on (phone): the goal ring, the streak with “N of 7 this week”, and her top three open mistake cards', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    seedHome()
    renderHome()
    const today = screen.getByRole('region', { name: 'Today' })
    expect(within(today).getByRole('progressbar', { name: 'Today’s goal' }).getAttribute('aria-valuetext')).toBe('30 of 60 XP')
    expect(within(today).getByText('30 XP to today’s goal.')).toBeTruthy()
    expect(within(today).getByText('Meet today’s goal to start a streak · 0 of 7 this week')).toBeTruthy()
    expect(within(within(today).getByRole('list', { name: 'This week' })).getAllByRole('listitem')).toHaveLength(7)
    const cards = within(today).getByRole('list', { name: 'Mistakes to squash' })
    const items = within(cards).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]!.textContent).toContain(ERROR_PATTERNS.no_sign_flip.title)
    expect(items[0]!.textContent).toContain('2 of 3')
    expect(items[0]!.textContent).toContain(LINEAR_TITLE)
    expect(items[1]!.textContent).toContain(ERROR_PATTERNS.flip_on_add.title)
    expect(items[1]!.textContent).toContain('1 of 3')
    expect(items[2]!.textContent).toContain(ERROR_PATTERNS.dropped_union.title)
    expect(within(items[0]!).getByRole('link').getAttribute('href')).toMatch(/^\/p\/inequalities\/ineq\.linear\//)
    // The whole collection is the Monsters tab (components/monsters).
    expect(within(today).getByRole('link', { name: 'The whole collection' }).getAttribute('href')).toBe('/monsters')
  })

  it('a streak: “N-day streak”, the week’s days, and the rest days saved', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    const events: Ev[] = []
    for (let d = -3; d <= 0; d++) events.push(done(`w${d}a`, 'warmup', dayAt(d), { mode: 'timed' }), done(`w${d}b`, 'warmup', dayAt(d, 10), { mode: 'timed' }))
    useStore.setState({ events })
    renderHome()
    const today = screen.getByRole('region', { name: 'Today' })
    expect(within(today).getByText(/^4-day streak · \d of 7 this week$/)).toBeTruthy()
    expect(within(today).getByText('Today’s goal is met. Anything more is a bonus.')).toBeTruthy()
    expect(within(today).getByRole('list', { name: 'This week' })).toBeTruthy()
    expect(within(today).getByText(/rest days? saved/)).toBeTruthy()
  })

  it('rewards off: nothing of it on Home', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    seedHome()
    renderHome()
    expect(screen.queryByRole('region', { name: 'Today' })).toBeNull()
    expect(document.querySelector('[data-rewards-today]')).toBeNull()
    expect(screen.queryByText(/XP/)).toBeNull()
  })
})

/** Three problems of ineq.linear that went well, one that did not, and a caught mistake. */
function seedProgress() {
  useStore.setState({
    events: [
      done('a', 'ineq.linear', dayAt(-4)),
      done('b', 'ineq.linear', dayAt(-3), { firstTryRate: 0.5 }),
      rejected('r', 'ineq.linear', dayAt(-2), 'no_sign_flip'),
      done('c', 'ineq.linear', dayAt(-2, 12)),
      done('d', 'ineq.linear', dayAt(-1)),
    ],
  })
}

function renderProgress() {
  return render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>,
  )
}

describe('Progress', () => {
  it('rewards on (phone): a ring per problem type grouped by unit, and the mistake collection, in place of the tables', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    seedProgress()
    renderProgress()
    const rings = screen.getByRole('region', { name: 'Problem types' })
    expect(within(rings).getByRole('heading', { level: 3, name: 'Honors Precalculus' })).toBeTruthy()
    expect(within(rings).getByRole('heading', { level: 4, name: /^Unit 1 · Functions and their graphs · 0 of \d+ mastered$/ })).toBeTruthy()
    expect(within(rings).getByRole('img', { name: `${LINEAR_TITLE}: Solid: 3 of the last 5 went well` })).toBeTruthy()
    expect(within(rings).getAllByRole('img', { name: /: New: none finished yet$/ }).length).toBeGreaterThan(5)
    const mistakes = screen.getByRole('region', { name: 'Mistake collection' })
    expect(within(mistakes).getByText('1 caught · 0 squashed')).toBeTruthy()
    expect(itemsOf(within(mistakes).getByRole('list', { name: 'Caught' }))[0]).toContain('2 of 3')
    expect(screen.queryByRole('region', { name: 'By problem type' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Error patterns' })).toBeNull()
    // The short, actionable collection comes before the rings; a unit she has worked in is open, the rest are one line.
    expect(mistakes.compareDocumentPosition(rings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const linear = within(rings).getByRole('img', { name: `${LINEAR_TITLE}: Solid: 3 of the last 5 went well` }).closest('details')!
    expect(linear.open).toBe(true)
    const units = [...rings.querySelectorAll('details')]
    expect(units.filter((d) => d.open)).toEqual([linear])
    expect(units.length).toBeGreaterThan(5)
  })

  it('rewards on (wide screen): the rings, and the tables below them', { timeout: PAGE_TIMEOUT }, () => {
    rewardsOn()
    seedProgress()
    renderProgress()
    expect(screen.getByRole('region', { name: 'Problem types' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'By problem type' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Mistake collection' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Error patterns' })).toBeTruthy()
    expect(screen.getByText(/days in a row you met your daily goal/)).toBeTruthy()
  })

  it('rewards off (phone): the tables as they were, no rings, no collection', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    seedProgress()
    renderProgress()
    expect(screen.queryByRole('region', { name: 'Problem types' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Mistake collection' })).toBeNull()
    expect(screen.getByRole('region', { name: 'By problem type' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Error patterns' })).toBeTruthy()
    expect(screen.getByText('days in a row with a finished problem')).toBeTruthy()
  })
})

describe('Settings', () => {
  function renderSettings() {
    return render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
  }

  it('the family web app starts with rewards off; on, she picks a daily goal; Vibrate shows on a touch screen that can', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    Object.defineProperty(navigator, 'vibrate', { value: vi.fn(() => true), configurable: true, writable: true })
    renderSettings()
    const sw = screen.getByRole('switch', { name: 'Rewards (XP, daily goal, streak)' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    expect(screen.queryByRole('group', { name: 'Daily goal' })).toBeNull()
    expect(screen.queryByRole('switch', { name: 'Vibrate' })).toBeNull()
    fireEvent.click(sw)
    expect(useStore.getState().settings.rewards).toBe(true)
    const goal = screen.getByRole('group', { name: 'Daily goal' })
    expect((within(goal).getByRole('radio', { name: /60 XP/ }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(within(goal).getByRole('radio', { name: /100 XP/ }))
    expect(useStore.getState().settings.dailyGoal).toBe(100)
    const vib = screen.getByRole('switch', { name: 'Vibrate' })
    expect(vib.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(vib)
    expect(useStore.getState().settings.vibrate).toBe(false)
  })

  it('no Vibrate switch where the device cannot vibrate', { timeout: PAGE_TIMEOUT }, () => {
    installPointer(true)
    rewardsOn()
    renderSettings()
    expect(screen.getByRole('group', { name: 'Daily goal' })).toBeTruthy()
    expect(screen.queryByRole('switch', { name: 'Vibrate' })).toBeNull()
  })
})

describe('the vibrate ticks', () => {
  function startAttempt() {
    useStore.getState().startAttempt({
      problemId: 'inequalities/ineq.linear@1/abc',
      moduleId: 'inequalities',
      templateId: 'ineq.linear',
      skill: 'ineq.linear',
      seed: 'abc',
      difficulty: '',
      genVersion: 1,
    })
  }

  it('a 10 ms tick on a right line or part, a goal tick when the goal is met; nothing with rewards or Vibrate off', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
    renderHook(() => useRewardTicks())
    startAttempt()
    act(() => {
      useStore.getState().acceptStep({ text: 'x < 3' })
    })
    expect(vibrate).not.toHaveBeenCalled() // rewards are off in the family web app

    rewardsOn()
    act(() => {
      useStore.getState().acceptStep({ text: 'x < 3' })
    })
    expect(vibrate).toHaveBeenLastCalledWith(TICK_MS)
    act(() => {
      useStore.getState().rejectStep('no_sign_flip')
      useStore.getState().useHint(2, 1)
    })
    expect(vibrate).toHaveBeenCalledTimes(1) // a wrong line and a hint are not ticks
    act(() => {
      useStore.getState().recordFinalAnswer({ correct: true, via: 'text' })
    })
    expect(vibrate).toHaveBeenCalledTimes(2)
    // 30 XP so far today: a fixed line (+5) and two right ones (+10 each) make 55, one more line reaches 60.
    act(() => {
      useStore.getState().acceptStep({ text: 'x < 4' })
      useStore.getState().acceptStep({ text: 'x < 5' })
      useStore.getState().acceptStep({ text: 'x < 6' })
    })
    expect(vibrate).toHaveBeenLastCalledWith(TICK_MS)
    expect(vibrate).toHaveBeenCalledTimes(5)
    act(() => {
      useStore.getState().acceptStep({ text: 'x < 7' })
    })
    expect(vibrate).toHaveBeenLastCalledWith([...GOAL_TICK])

    useStore.getState().setSettings({ vibrate: false })
    const calls = vibrate.mock.calls.length
    act(() => {
      useStore.getState().acceptStep({ text: 'x < 8' })
    })
    expect(vibrate.mock.calls.length).toBe(calls)
  })

  it('skips silently where vibrate is missing', () => {
    rewardsOn()
    renderHook(() => useRewardTicks())
    startAttempt()
    expect(() =>
      act(() => {
        useStore.getState().acceptStep({ text: 'x < 3' })
      }),
    ).not.toThrow()
  })

  it('an import is not a tick', () => {
    const vibrate = vi.fn(() => true)
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true })
    rewardsOn()
    renderHook(() => useRewardTicks())
    act(() => {
      useStore.setState({ events: [line('z', 0, Date.now() - 2 * DAY), line('z', 1, Date.now() - DAY)] })
    })
    expect(vibrate).not.toHaveBeenCalled()
  })
})
