// @vitest-environment jsdom
/** The store app (STORE): rewards are on until she switches them off, so the quests, the chest and the themes are too. */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Home } from '@/pages/Home'
import { SettingsPage } from '@/pages/Settings'
import { resetQuestCacheForTests } from '@/session/quests'
import { resetStoreForTests, useStore } from '@/store'

vi.mock('@/edition', () => ({
  EDITION: 'store',
  STORE: true,
  STORE_SKIPS_SUBJECTS: ['Chemistry'],
  includesSubject: (subject: string | undefined) => subject !== 'Chemistry',
}))

beforeEach(() => {
  resetStoreForTests()
  resetQuestCacheForTests()
})

describe('the store app', () => {
  it('shows the day’s quests on Home and the colour themes in Settings by default', { timeout: 120_000 }, () => {
    // A class chosen (a brand-new user first sees the class picker, pages/Welcome.tsx).
    useStore.getState().setSettings({ courseId: 'precalc' })
    expect(useStore.getState().settings.rewards).toBeUndefined()
    const { unmount } = render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const quests = screen.getByRole('region', { name: 'Quests: 0 of 3 done' })
    expect(within(quests).getAllByRole('listitem')).toHaveLength(3)
    unmount()
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    const themes = screen.getByRole('group', { name: 'Colour theme' })
    expect(within(themes).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['navy'])
  })
})
