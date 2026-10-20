// @vitest-environment jsdom
/** The store app (STORE): rewards are on until she switches them off; the family web app is the other test file. */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetStoreForTests, useStore } from '@/store'
import { Home } from '@/pages/Home'
import { SettingsPage } from '@/pages/Settings'

vi.mock('@/edition', () => ({
  EDITION: 'store',
  STORE: true,
  STORE_SKIPS_SUBJECTS: ['Chemistry'],
  includesSubject: (subject: string | undefined) => subject !== 'Chemistry',
}))

beforeEach(() => {
  resetStoreForTests()
})

describe('the store app', () => {
  it('shows the rewards on Home by default, and the Settings switch can turn them off', { timeout: 120_000 }, () => {
    const { unmount } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    expect(screen.getByRole('region', { name: 'Today' })).toBeTruthy()
    unmount()

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    const sw = screen.getByRole('switch', { name: 'Rewards (XP, daily goal, streak)' })
    expect(sw.getAttribute('aria-checked')).toBe('true')
    expect(useStore.getState().settings.rewards).toBeUndefined()
    fireEvent.click(sw)
    expect(useStore.getState().settings.rewards).toBe(false)
    expect(screen.queryByRole('group', { name: 'Daily goal' })).toBeNull()
  })
})
