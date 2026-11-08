// @vitest-environment jsdom
/**
 * The Monster Dash page (pages/Dash.tsx): hidden behind the rewards switch, a runner only once a
 * monster is caught, plays earned by the day's finished sets (store/dash.ts), the game mounted on
 * Play. The game itself is proven in src/dash/engine.test.ts; jsdom has no 2d canvas.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { resetStoreForTests, useStore, type Ev } from '@/store'
import DashPage from './Dash'

function dayAt(offset: number, hour = 9): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, hour).getTime()
}

function rejected(attemptId: string, at: number, pattern: string): Ev {
  return { t: 'step_rejected', at, attemptId, skill: 'ineq.linear', stepIdx: 0, pattern }
}

function setDone(at: number, skipped = 0): Ev {
  return { t: 'set_done', at, setId: `set-${at}`, done: ['a1', 'a2', 'a3'], skipped }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dash']}>
      <DashPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  resetStoreForTests()
  useStore.getState().setSettings({ rewards: true })
})

describe('the gate and the runner', () => {
  it('rewards off: the page only points at Settings', () => {
    useStore.getState().setSettings({ rewards: false })
    renderPage()
    expect(screen.getByText(/Turn rewards on in Settings/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull()
  })

  it('no monster caught yet: no game, a pointer to the collection', () => {
    renderPage()
    expect(screen.getByText(/monster you have caught/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'See the monsters' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull()
  })

  it('a caught monster appears as the runner, pressed by default', () => {
    useStore.setState({ events: [rejected('a', dayAt(0, 8), 'flip_on_add')] })
    renderPage()
    const pick = screen.getByRole('button', { name: /^Run as / })
    expect(pick.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('plays', () => {
  it('zero plays: the button is disabled and the page says how to earn one', () => {
    useStore.setState({ events: [rejected('a', dayAt(0, 8), 'flip_on_add')] })
    renderPage()
    const play = screen.getByRole('button', { name: /Play · 1 play/ })
    expect((play as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/Finish a practice set/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Start a set' })).toBeTruthy()
  })

  it("a set finished today earns a play; yesterday's does not", () => {
    useStore.setState({ events: [rejected('a', dayAt(-3), 'flip_on_add'), setDone(dayAt(-1)), setDone(dayAt(0, 8))] })
    renderPage()
    expect(screen.getByText(/1 play left today/)).toBeTruthy()
    const play = screen.getByRole('button', { name: /Play · 1 play/ })
    expect((play as HTMLButtonElement).disabled).toBe(false)
  })

  it('Play mounts the game canvas', () => {
    useStore.setState({ events: [rejected('a', dayAt(-3), 'flip_on_add'), setDone(dayAt(0, 8))] })
    const { container } = renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Play · 1 play/ }))
    expect(container.querySelector('[data-dash-canvas]')).toBeTruthy()
    expect(screen.getByText(/press Space to jump/)).toBeTruthy()
  })

  it('the best score shows beside the plays', () => {
    useStore.setState({
      events: [rejected('a', dayAt(-3), 'flip_on_add')],
      rewards: { ...useStore.getState().rewards, dashBest: 420 },
    })
    renderPage()
    expect(screen.getByText(/best 420/)).toBeTruthy()
  })
})
