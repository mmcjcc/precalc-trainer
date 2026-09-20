// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { MODULES } from '@/content'
import { resetStoreForTests } from '@/store'
import { Home } from './Home'

beforeEach(() => {
  resetStoreForTests()
})

describe('Home: modules grouped by subject', () => {
  it('keeps the precalculus modules together and puts Chemistry under its own heading', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const precalc = screen.getByRole('heading', { name: 'Precalculus' })
    const chemistry = screen.getByRole('heading', { name: 'Chemistry' })
    expect(precalc.compareDocumentPosition(chemistry) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const precalcSection = precalc.closest('section')!
    const chemistrySection = chemistry.closest('section')!
    const precalcTitles = within(precalcSection)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    const chemistryTitles = within(chemistrySection)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(precalcTitles).toEqual(MODULES.filter((m) => !m.subject).map((m) => m.title))
    expect(chemistryTitles).toEqual(['Significant figures'])
    expect(within(chemistrySection).getByRole('link', { name: /Choose a type/ }).getAttribute('href')).toBe('/m/sigFigs')
  })
})
