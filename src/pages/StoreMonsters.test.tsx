// @vitest-environment jsdom
/** The store app (STORE, math only): the Monsters tab shows the math species, every math mistake placed in one. */
import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SPECIES } from '@/components/monsters/species'
import { resetStoreForTests, useStore } from '@/store'
import { MonstersPage } from './Monsters'

vi.mock('@/edition', () => ({
  EDITION: 'store',
  STORE: true,
  STORE_SKIPS_SUBJECTS: ['Chemistry'],
  includesSubject: (subject: string | undefined) => subject !== 'Chemistry',
}))

beforeEach(() => {
  resetStoreForTests()
})

describe('the store app’s Monsters tab', () => {
  it('the math species only; a chemistry mistake (from a family backup) has no monster here', { timeout: 120_000 }, () => {
    useStore.setState({ events: [{ t: 'final_answer', at: Date.now() - 86_400_000, attemptId: 'a', skill: 'sf.count', correct: false, pattern: 'sf_leading_zeros', via: 'text' }] })
    render(
      <MemoryRouter>
        <MonstersPage />
      </MemoryRouter>,
    )
    const shown = [...document.querySelectorAll('[data-species]')].map((s) => s.getAttribute('data-species'))
    expect(shown).toEqual(SPECIES.filter((s) => s.subject === 'math').map((s) => s.id))
    expect(screen.queryByRole('region', { name: /^The Zero Hoarder/ })).toBeNull()
    expect(document.querySelector('[data-monster-tally]')!.textContent).toBe('0 squashed · 0 on the loose')
    const sign = screen.getByRole('region', { name: /^The Sign Flipper/ })
    expect(within(sign).getByText('None caught yet')).toBeTruthy()
    // Opened, a species shows every one of its monsters, each not seen yet.
    const details = sign.querySelector('details')!
    act(() => {
      details.open = true
      details.dispatchEvent(new Event('toggle'))
    })
    const tiles = sign.querySelectorAll('[data-monster-tile]')
    expect(tiles).toHaveLength(SPECIES[0]!.variants.length)
    expect([...tiles].every((t) => t.getAttribute('data-status') === 'unseen')).toBe(true)
  })
})
