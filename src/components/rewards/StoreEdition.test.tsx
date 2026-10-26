// @vitest-environment jsdom
/** The store app (STORE): rewards are on until she switches them off; the family web app is the other test file. */
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCourse, getModule, getReview, resolveReview, SAT_SKILLS } from '@/content'
import type { ModuleId } from '@/shared/types'
import { classTypes } from '@/session/buildSet'
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
    // A class chosen (a brand-new user first sees the class picker, pages/Welcome.tsx).
    useStore.getState().setSettings({ courseId: 'precalc' })
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

  it('shows the SAT Math Prep class and never a Chemistry type', () => {
    useStore.getState().setSettings({ courseId: 'sat' })
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )

    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Precalculus', 'Geometry', 'SAT Math Prep'])
    expect(tabs).not.toContain('Chemistry')
    expect(screen.getByRole('tab', { name: 'SAT Math Prep', selected: true })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'SAT practice set' })).toBeTruthy()

    const sat = getCourse('sat')!
    const types = classTypes(sat)
    expect(types.length).toBeGreaterThan(0)
    for (const ref of types) {
      expect(getModule(ref.moduleId as ModuleId)?.subject).not.toBe('Chemistry')
    }

    for (const skill of SAT_SKILLS) {
      for (const ref of skill.types) {
        expect(getModule(ref.moduleId)?.subject).not.toBe('Chemistry')
      }
    }

    const reviewTopics = resolveReview(getReview('sat')!)
    expect(reviewTopics.length).toBeGreaterThan(0)
    for (const topic of reviewTopics) {
      expect(getModule(topic.moduleId)?.subject).not.toBe('Chemistry')
    }
  })
})
