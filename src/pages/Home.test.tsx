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
    expect(chemistryTitles).toEqual(['Significant figures', 'Atomic structure'])
    const links = within(chemistrySection).getAllByRole('link', { name: /Choose a type/ }).map((l) => l.getAttribute('href'))
    expect(links).toEqual(['/m/sigFigs', '/m/atoms'])
  })

  it('lists Difference quotient last under Precalculus', () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    )
    const precalcSection = screen.getByRole('heading', { name: 'Precalculus' }).closest('section')!
    const titles = within(precalcSection)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
    expect(titles[titles.length - 1]).toBe('Difference quotient')
    expect(within(precalcSection).getAllByRole('link', { name: /Choose a type/ }).map((l) => l.getAttribute('href'))).toContain('/m/diffQuotient')
    const chemistrySection = screen.getByRole('heading', { name: 'Chemistry' }).closest('section')!
    expect(within(chemistrySection).queryByText('Difference quotient')).toBeNull()
  })
})
