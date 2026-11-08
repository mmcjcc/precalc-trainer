// @vitest-environment jsdom
/**
 * The end of a run (pages/Dash.tsx `finish`): a real run spends a play and records the score, a
 * `?test=1` practice run leaves the store untouched. The canvas game cannot run under jsdom, so
 * DashGame is stubbed with a button that ends the run; the game itself is proven in
 * src/dash/engine.test.ts.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStoreForTests, useStore, type Ev } from '@/store'

vi.mock('@/components/dash/DashGame', () => ({
  DashGame: ({ onDone }: { onDone: (score: number) => void }) => (
    <button type="button" onClick={() => onDone(42)}>
      end run
    </button>
  ),
}))

import DashPage from './Dash'

function dayAt(offset: number, hour = 9): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, hour).getTime()
}

function seedCatchAndSet() {
  useStore.setState({
    events: [
      { t: 'step_rejected', at: dayAt(-3), attemptId: 'a', skill: 'ineq.linear', stepIdx: 0, pattern: 'flip_on_add' },
      { t: 'set_done', at: dayAt(0, 8), setId: 'set-1', done: ['a1', 'a2', 'a3'], skipped: 0 },
    ] as Ev[],
  })
}

function renderPage(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <DashPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  resetStoreForTests()
  useStore.getState().setSettings({ rewards: true })
})

describe('ending a run', () => {
  it('a real run spends the play and keeps the score', () => {
    seedCatchAndSet()
    renderPage('/dash')
    fireEvent.click(screen.getByRole('button', { name: /Play · 1 play/ }))
    fireEvent.click(screen.getByRole('button', { name: 'end run' }))
    expect(screen.getByText(/Run over — score 42/)).toBeTruthy()
    expect(screen.getByText(/new best!/)).toBeTruthy()
    expect(screen.queryByText(/on the house/)).toBeNull()
    const s = useStore.getState()
    expect(s.events.filter((e) => e.t === 'dash_run').length).toBe(1)
    expect(s.rewards.dashBest).toBe(42)
    expect(screen.getByText(/0 plays left today/)).toBeTruthy()
  })

  it('a ?test=1 practice run spends and records nothing', () => {
    seedCatchAndSet()
    renderPage('/dash?test=1')
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    fireEvent.click(screen.getByRole('button', { name: 'end run' }))
    expect(screen.getByText(/Run over — score 42/)).toBeTruthy()
    expect(screen.getByText(/Practice run — nothing saved/)).toBeTruthy()
    expect(screen.queryByText(/new best!/)).toBeNull()
    const s = useStore.getState()
    expect(s.events.some((e) => e.t === 'dash_run')).toBe(false)
    expect(s.rewards.dashBest ?? 0).toBe(0)
  })
})
